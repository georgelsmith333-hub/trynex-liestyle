import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { logger } from "../lib/logger";
import { logActivity, getAdminId } from "../lib/activityLog";

const router: IRouter = Router();

const SITE_URL = "https://trynexshop.com";
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

async function getSetting(key: string): Promise<string | null> {
  const rows = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value } });
}

router.get("/admin/seo/status", requireAdmin, async (_req, res) => {
  try {
    const lastPingAt = await getSetting("seoLastGooglePingAt");
    const lastPingStatus = await getSetting("seoLastGooglePingStatus");
    const gscServiceAccountConfigured = !!(await getSetting("seoGscServiceAccountEmail"));

    res.json({
      sitemapUrl: SITEMAP_URL,
      lastPingAt,
      lastPingStatus,
      gscServiceAccountConfigured,
    });
  } catch (err) {
    logger.error({ err }, "GET /api/admin/seo/status failed");
    res.status(500).json({ message: "Failed to load SEO status" });
  }
});

router.post("/admin/seo/ping-google", requireAdmin, async (req, res) => {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;

    let pingStatus: "ok" | "error" = "ok";
    let httpCode: number | null = null;
    let message = "";

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const pingRes = await fetch(pingUrl, { signal: controller.signal });
      clearTimeout(timeout);
      httpCode = pingRes.status;
      if (pingRes.ok) {
        message = `Google ping successful (HTTP ${httpCode})`;
      } else {
        pingStatus = "error";
        message = `Google ping returned HTTP ${httpCode}`;
      }
    } catch (fetchErr: any) {
      pingStatus = "error";
      message = fetchErr?.message?.includes("aborted")
        ? "Request timed out after 10s"
        : (fetchErr?.message ?? "Network error");
    }

    const now = new Date().toISOString();
    await setSetting("seoLastGooglePingAt", now);
    await setSetting("seoLastGooglePingStatus", pingStatus === "ok" ? `ok:${message}` : `error:${message}`);

    await logActivity({
      adminId: getAdminId(req),
      action: "update",
      entity: "setting",
      entityId: "sitemap",
      entityName: "Google Sitemap Ping",
      after: { status: pingStatus, httpCode, message },
    });

    res.json({ success: pingStatus === "ok", message, httpCode, pingUrl, pingAt: now });
  } catch (err) {
    logger.error({ err }, "POST /api/admin/seo/ping-google failed");
    res.status(500).json({ message: "Failed to ping Google" });
  }
});

router.post("/admin/seo/submit-gsc", requireAdmin, async (req, res) => {
  try {
    const serviceAccountEmail = await getSetting("seoGscServiceAccountEmail");
    const serviceAccountKey = await getSetting("seoGscServiceAccountKey");

    if (!serviceAccountEmail || !serviceAccountKey) {
      return res.status(400).json({ message: "Google Search Console service account not configured" });
    }

    let privateKey: string;
    try {
      const parsed = JSON.parse(serviceAccountKey);
      privateKey = parsed.private_key ?? serviceAccountKey;
    } catch {
      privateKey = serviceAccountKey;
    }

    const jwtHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const nowSec = Math.floor(Date.now() / 1000);
    const jwtPayload = Buffer.from(JSON.stringify({
      iss: serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/webmasters",
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    })).toString("base64url");

    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${jwtHeader}.${jwtPayload}`);
    const signature = sign.sign(privateKey, "base64url");
    const jwtToken = `${jwtHeader}.${jwtPayload}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwtToken,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      logger.error({ errBody }, "GSC token exchange failed");
      return res.status(502).json({ message: `Failed to get Google access token: ${errBody}` });
    }

    const { access_token } = await tokenRes.json() as { access_token: string };

    const siteEncoded = encodeURIComponent(SITE_URL + "/");
    const submitRes = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${siteEncoded}/sitemaps/${encodeURIComponent(SITEMAP_URL)}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    const submitOk = submitRes.ok;
    const submitStatus = submitRes.status;
    let submitMessage = submitOk
      ? "Sitemap successfully submitted to Google Search Console"
      : `Submission failed with HTTP ${submitStatus}`;

    if (!submitOk) {
      const body = await submitRes.text().catch(() => "");
      logger.warn({ submitStatus, body }, "GSC sitemap submission failed");
      submitMessage += body ? `: ${body.slice(0, 200)}` : "";
    }

    const submittedAt = new Date().toISOString();
    await setSetting("seoLastGooglePingAt", submittedAt);
    await setSetting("seoLastGooglePingStatus", submitOk ? `ok:${submitMessage}` : `error:${submitMessage}`);

    await logActivity({
      adminId: getAdminId(req),
      action: "update",
      entity: "setting",
      entityId: "sitemap",
      entityName: "Google Search Console Sitemap Submission",
      after: { success: submitOk, httpCode: submitStatus, message: submitMessage },
    });

    res.json({ success: submitOk, message: submitMessage, httpCode: submitStatus, submittedAt });
  } catch (err: any) {
    logger.error({ err }, "POST /api/admin/seo/submit-gsc failed");
    res.status(500).json({ message: err?.message ?? "Failed to submit sitemap to Google Search Console" });
  }
});

router.put("/admin/seo/gsc-config", requireAdmin, async (req, res) => {
  try {
    const { serviceAccountEmail, serviceAccountJson } = req.body as {
      serviceAccountEmail?: string;
      serviceAccountJson?: string;
    };

    if (!serviceAccountEmail && !serviceAccountJson) {
      return res.status(400).json({ message: "Nothing to save" });
    }

    if (serviceAccountEmail !== undefined) {
      await setSetting("seoGscServiceAccountEmail", serviceAccountEmail.trim());
    }

    if (serviceAccountJson !== undefined) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        if (parsed.client_email && !serviceAccountEmail) {
          await setSetting("seoGscServiceAccountEmail", parsed.client_email);
        }
        await setSetting("seoGscServiceAccountKey", serviceAccountJson);
      } catch {
        return res.status(400).json({ message: "Invalid JSON for service account key" });
      }
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "PUT /api/admin/seo/gsc-config failed");
    res.status(500).json({ message: "Failed to save GSC config" });
  }
});

router.delete("/admin/seo/gsc-config", requireAdmin, async (_req, res) => {
  try {
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountEmail"));
    await db.delete(settingsTable).where(eq(settingsTable.key, "seoGscServiceAccountKey"));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /api/admin/seo/gsc-config failed");
    res.status(500).json({ message: "Failed to remove GSC config" });
  }
});

export default router;
