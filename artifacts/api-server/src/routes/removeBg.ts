import { Router, type IRouter, type Request, type Response } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

/* ── Simple in-memory rate limiter ─────────────────────────
   Allows MAX_CALLS requests per IP per WINDOW_MS.
   Resets the window for each IP after WINDOW_MS elapses.
─────────────────────────────────────────────────────────── */
const MAX_CALLS = 10;          // max remove-bg calls per IP per window
const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10 MB base64 image cap

interface RateBucket { count: number; resetAt: number }
const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (bucket.count >= MAX_CALLS) return false;
  bucket.count++;
  return true;
}

/* ── Status endpoint — public, no auth needed ──────────────
   Returns whether the remove.bg API key is configured so
   the storefront can show the correct UI state without
   having to attempt a real removal first.
─────────────────────────────────────────────────────────── */
router.get("/remove-bg/status", async (_req: Request, res: Response) => {
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "removeBgApiKey"));
    return res.json({ configured: Boolean(row?.value) });
  } catch {
    return res.json({ configured: false });
  }
});

router.post("/remove-bg", async (req: Request, res: Response) => {
  try {
    // Rate limit — use req.ip (respects Express trust proxy setting for reverse proxies)
    const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
    if (!checkRateLimit(ip)) {
      return res.status(429).json({
        error: "rate_limited",
        message: "Too many background removal requests. Please wait before trying again.",
      });
    }

    const { image } = req.body;
    if (!image || typeof image !== "string") {
      return res.status(400).json({ error: "image_required", message: "image field (base64 data URL) is required" });
    }

    // Payload size guard — reject oversized images before processing
    if (image.length > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({
        error: "image_too_large",
        message: "Image exceeds the 10 MB limit. Try HD-Upscale after resizing the image first.",
      });
    }

    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "");
    const mimeType = image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    const [apiKeyRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "removeBgApiKey"));
    const apiKey = apiKeyRow?.value;

    if (!apiKey) {
      return res.status(503).json({
        error: "no_api_key",
        message: "Background removal isn't configured — admin needs to add a remove.bg key.",
      });
    }

    const buffer = Buffer.from(base64Data, "base64");
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("image_file", blob, "image.png");
    formData.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      req.log?.error?.({ status: response.status, error: errorText }, "remove.bg API error");
      if (response.status === 402) {
        return res.status(402).json({
          error: "quota_exceeded",
          message: "Remove.bg quota exhausted. Please upgrade the remove.bg plan or wait until next month.",
        });
      }
      return res.status(502).json({
        error: "remove_bg_failed",
        message: "Background removal failed on the server. Please try again.",
      });
    }

    const resultBuffer = Buffer.from(await response.arrayBuffer());
    const resultBase64 = `data:image/png;base64,${resultBuffer.toString("base64")}`;
    return res.json({ result: resultBase64 });
  } catch (err) {
    req.log?.error?.({ err }, "remove-bg error");
    return res.status(500).json({ error: "internal_error", message: "Failed to remove background — please try again." });
  }
});

export default router;
