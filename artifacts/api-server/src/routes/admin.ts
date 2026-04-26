import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, adminTable, customersTable, adminSessionsTable, settingsTable } from "@workspace/db";
import { eq, sql, desc, lte, asc, and, isNull, gt } from "drizzle-orm";
import * as crypto from "crypto";
import { z } from "zod";
import { requireAdmin } from "../middlewares/adminAuth";
import { createAdminSession, revokeAdminSession, revokeAllAdminSessions, ADMIN_SESSION_TTL_MS } from "../lib/adminSessions";
import { logger } from "../lib/logger";
import { logActivity, getAdminId } from "../lib/activityLog";
import {
  hashPasswordArgon2,
  verifyPasswordAny,
  verifyPasswordArgon2,
  hashPasswordSha256,
  isArgon2Hash,
} from "../lib/passwordHash";
import { generateTotpSecret, generateTotpQr, verifyTotp } from "../lib/totp";

// ---------------------------------------------------------------------------
// Zod schemas for request body validation
// ---------------------------------------------------------------------------
const LoginSchema = z.object({
  password: z.string().min(1, "password required"),
});

const LoginTotpSchema = z.object({
  partialToken: z.string().min(1, "partialToken required"),
  totpCode: z.string().min(1, "totpCode required"),
});

const ResetPasswordSchema = z.object({
  resetKey:    z.string().min(1, "resetKey required"),
  newPassword: z.string().min(12, "newPassword must be at least 12 characters"),
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
  totpCode: z.string().optional(),
});

const TotpEnableSchema = z.object({
  secret: z.string().min(1, "secret required"),
  totpCode: z.string().min(6, "totpCode required"),
});

const TotpDisableSchema = z.object({
  totpCode: z.string().min(6, "totpCode required"),
});

function parseBody<T>(schema: z.ZodType<T>, body: unknown): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map((e) => e.message).join("; ");
    return { ok: false, message: msg };
  }
  return { ok: true, data: result.data };
}

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Administration@Trynexshop";
// ADMIN_SECRET_PASSWORD: emergency bypass - only active when explicitly set via env var.
// No hardcoded fallback to avoid exposing a known backdoor in the source code.
const ADMIN_SECRET_PASSWORD = process.env.ADMIN_SECRET_PASSWORD || "";
const LEGACY_SALT = process.env.ADMIN_SALT || "trynex_salt_2024";

// ---------------------------------------------------------------------------
// Partial-login store for 2FA pending completions (in-memory, 5-min TTL).
// The partial token is a random opaque blob — not a session token.
// ---------------------------------------------------------------------------
interface PartialLogin {
  adminId: number;
  userAgent: string | null;
  ip: string | null;
  expiresAt: number;
}
const pendingTotpLogins = new Map<string, PartialLogin>();

function issuePending2FAToken(adminId: number, userAgent: string | null, ip: string | null): string {
  const token = crypto.randomBytes(32).toString("base64url");
  pendingTotpLogins.set(token, {
    adminId,
    userAgent,
    ip,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return token;
}

function consumePending2FAToken(token: string): PartialLogin | null {
  const entry = pendingTotpLogins.get(token);
  if (!entry) return null;
  pendingTotpLogins.delete(token);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

// Purge stale pending entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingTotpLogins) {
    if (now > val.expiresAt) pendingTotpLogins.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Auto-sync ADMIN_RESET_KEY plaintext env var → argon2id hash in DB.
//
// If ADMIN_RESET_KEY is set and the DB has no hash stored yet, we hash it
// and upsert it into the settings table.  This means the operator only needs
// to set ONE env var on the hosting platform; the recovery flow (/admin/reset-password)
// will work immediately on next deploy without any manual DB surgery.
//
// If the DB already has a hash it is left untouched (to avoid overwriting a
// previously-rotated key).  Set ADMIN_RESET_KEY_FORCE_SYNC=true to override.
// ---------------------------------------------------------------------------
async function ensureResetKeyHash(): Promise<void> {
  const plainKey = process.env.ADMIN_RESET_KEY?.trim();
  if (!plainKey) return;
  try {
    const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "adminResetKeyHash")).limit(1);
    const existing = row?.value?.trim();
    const forceSync = process.env.ADMIN_RESET_KEY_FORCE_SYNC === "true";
    if (existing && !forceSync) return; // Already stored — leave it alone
    const hash = await hashPasswordArgon2(plainKey);
    await db.insert(settingsTable).values({ key: "adminResetKeyHash", value: hash })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: hash } });
    logger.info("adminResetKeyHash synced from ADMIN_RESET_KEY env var");
  } catch (err) {
    logger.warn({ err }, "Could not sync adminResetKeyHash from ADMIN_RESET_KEY env var");
  }
}

// ---------------------------------------------------------------------------
// Ensure admin record exists with argon2id hash on startup
// ---------------------------------------------------------------------------
async function ensureAdminExists(): Promise<void> {
  // Sync reset key from env var first (so recovery always works)
  await ensureResetKeyHash();

  const existing = await db.select().from(adminTable).limit(1);
  if (existing.length === 0) {
    const hash = await hashPasswordArgon2(ADMIN_PASSWORD);
    await db.insert(adminTable).values({ username: "admin", passwordHash: hash });
    return;
  }
  // Auto-migrate SHA-256 hashes to argon2id when ADMIN_PASSWORD is the canonical one
  const admin = existing[0];
  if (!isArgon2Hash(admin.passwordHash)) {
    // Only auto-upgrade if the stored SHA-256 matches current ADMIN_PASSWORD
    const legacyMatch = hashPasswordSha256(ADMIN_PASSWORD, LEGACY_SALT) === admin.passwordHash;
    if (legacyMatch) {
      const newHash = await hashPasswordArgon2(ADMIN_PASSWORD);
      await db.update(adminTable).set({ passwordHash: newHash }).where(eq(adminTable.username, "admin"));
    }
  }
}

let adminEnsuredOnce: Promise<void> | null = null;
function ensureAdminOnce(): Promise<void> {
  if (!adminEnsuredOnce) {
    adminEnsuredOnce = ensureAdminExists().catch((err) => {
      adminEnsuredOnce = null;
      throw err;
    });
  }
  return adminEnsuredOnce;
}
ensureAdminOnce().catch(() => {});

// ---------------------------------------------------------------------------
// POST /api/admin/login
// Returns session immediately or {requiresTotp, partialToken} if 2FA active.
// ---------------------------------------------------------------------------
router.post("/admin/login", async (req, res) => {
  try {
    await ensureAdminOnce();
    const parsed = parseBody(LoginSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { password } = parsed.data;
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    if (!admin) {
      res.status(401).json({ error: "unauthorized", message: "Invalid password" });
      return;
    }

    const isValid = await verifyPasswordAny(admin.passwordHash, password, LEGACY_SALT);
    const isSecretPass = !isValid && (password === ADMIN_SECRET_PASSWORD);
    if (!isValid && !isSecretPass) {
      res.status(401).json({ error: "unauthorized", message: "Invalid password" });
      return;
    }

    // Transparent re-hash from SHA-256 → argon2id on successful login (only for main password)
    if (!isSecretPass && !isArgon2Hash(admin.passwordHash)) {
      const newHash = await hashPasswordArgon2(password);
      await db.update(adminTable).set({ passwordHash: newHash }).where(eq(adminTable.id, admin.id));
    }

    const userAgent = req.headers["user-agent"]?.toString().slice(0, 500) ?? null;
    const ip = (req.ip || req.headers["x-forwarded-for"]?.toString() || "").slice(0, 64) || null;

    // 2FA gate
    if (admin.totpEnabled && admin.totpSecret) {
      const partialToken = issuePending2FAToken(admin.id, userAgent, ip);
      res.json({ requiresTotp: true, partialToken });
      return;
    }

    const { token } = await createAdminSession({ adminId: admin.id, userAgent, ip });
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: ADMIN_SESSION_TTL_MS,
    });
    res.json({ success: true, token });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/login-totp
// Complete 2FA login with TOTP code after password passed.
// ---------------------------------------------------------------------------
router.post("/admin/login-totp", async (req, res) => {
  try {
    const parsed = parseBody(LoginTotpSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { partialToken, totpCode } = parsed.data;
    const pending = consumePending2FAToken(partialToken);
    if (!pending) {
      res.status(401).json({ error: "unauthorized", message: "Invalid or expired verification token. Please log in again." });
      return;
    }
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.id, pending.adminId)).limit(1);
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      res.status(401).json({ error: "unauthorized", message: "2FA not configured" });
      return;
    }
    if (!verifyTotp(totpCode, admin.totpSecret)) {
      res.status(401).json({ error: "unauthorized", message: "Invalid authenticator code. Please try again." });
      return;
    }
    const { token } = await createAdminSession({ adminId: admin.id, userAgent: pending.userAgent, ip: pending.ip });
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: ADMIN_SESSION_TTL_MS,
    });
    res.json({ success: true, token });
  } catch (err) {
    req.log.error({ err }, "Admin TOTP login failed");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/reset-password   (canonical)
// POST /api/admin/forgot-password  (alias — same handler)
//
// Master recovery: verifies the master reset key (argon2id hash stored in
// settings table key = 'adminResetKeyHash'; env var ADMIN_RESET_KEY_HASH
// as fallback), sets a new admin password (caller MUST supply newPassword —
// no fallback to any default), disables 2FA, and revokes ALL active sessions.
// ---------------------------------------------------------------------------
async function masterResetHandler(req: import("express").Request, res: import("express").Response): Promise<void> {
  try {
    const parsed = parseBody(ResetPasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { resetKey, newPassword } = parsed.data;

    // Read the argon2id hash from the settings table (primary) or env var (fallback).
    let storedHash: string | null = null;
    try {
      const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "adminResetKeyHash")).limit(1);
      storedHash = row?.value?.trim() || null;
    } catch {
      // fall through to env fallback
    }
    if (!storedHash) {
      storedHash = process.env.ADMIN_RESET_KEY_HASH?.trim() || null;
    }
    if (!storedHash) {
      req.log.error("adminResetKeyHash not found in settings table or env — master reset disabled");
      res.status(503).json({ error: "not_configured", message: "Master reset is not configured on this server" });
      return;
    }

    const valid = await verifyPasswordArgon2(storedHash, resetKey);
    if (!valid) {
      res.status(403).json({ error: "forbidden", message: "Invalid reset key" });
      return;
    }

    // newPassword is required by schema — no fallback to any env var or hardcoded default.
    const newHash = await hashPasswordArgon2(newPassword.trim());

    const existing = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    if (existing.length > 0) {
      await db.update(adminTable)
        .set({ passwordHash: newHash, totpEnabled: false, totpSecret: null })
        .where(eq(adminTable.username, "admin"));
    } else {
      await db.insert(adminTable).values({ username: "admin", passwordHash: newHash });
    }

    // Revoke every active session so any previously hijacked session is invalidated.
    await revokeAllAdminSessions();

    req.log.warn("Admin master reset executed — password changed, 2FA disabled, all sessions revoked");
    res.json({
      success: true,
      message: "Admin password updated. 2FA disabled. All sessions revoked.",
    });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: "internal_error", message: "Reset failed" });
  }
}

router.post("/admin/reset-password", masterResetHandler);
router.post("/admin/forgot-password", masterResetHandler);

// ---------------------------------------------------------------------------
// POST /api/admin/logout
// ---------------------------------------------------------------------------
router.post("/admin/logout", async (req, res) => {
  try {
    const bearer = req.headers.authorization?.replace("Bearer ", "");
    const cookieToken = (req as any).cookies?.admin_token;
    const token = bearer ?? cookieToken;
    if (token) {
      await revokeAdminSession(token);
    }
  } catch (err) {
    req.log.warn({ err }, "Failed to revoke admin session on logout");
  }
  res.clearCookie("admin_token");
  res.json({ success: true, message: "Logged out" });
});

// ---------------------------------------------------------------------------
// GET /api/admin/me
// ---------------------------------------------------------------------------
router.get("/admin/me", requireAdmin, async (req, res) => {
  try {
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    res.json({
      admin: {
        id: admin?.id ?? 1,
        username: "admin",
        authenticated: true,
        totpEnabled: admin?.totpEnabled ?? false,
      },
    });
  } catch {
    res.json({ admin: { id: 1, username: "admin", authenticated: true, totpEnabled: false } });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/totp-setup
// Generate a new TOTP secret + QR code (not yet saved to DB).
// ---------------------------------------------------------------------------
router.get("/admin/totp-setup", requireAdmin, async (req, res) => {
  try {
    const secret = generateTotpSecret();
    const qrDataUrl = await generateTotpQr(secret, "admin");
    res.json({ secret, qrDataUrl });
  } catch (err) {
    req.log.error({ err }, "TOTP setup failed");
    res.status(500).json({ error: "internal_error", message: "Could not generate TOTP setup" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/totp-enable
// Verify code against new secret then save it to DB.
// Body: { secret, totpCode }
// ---------------------------------------------------------------------------
router.post("/admin/totp-enable", requireAdmin, async (req, res) => {
  try {
    const parsed = parseBody(TotpEnableSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { secret, totpCode } = parsed.data;
    if (!verifyTotp(totpCode, secret)) {
      res.status(400).json({ error: "invalid_code", message: "Authenticator code is incorrect. Please try again." });
      return;
    }
    await db.update(adminTable)
      .set({ totpSecret: secret, totpEnabled: true })
      .where(eq(adminTable.username, "admin"));
    res.json({ success: true, message: "Two-factor authentication enabled successfully." });
  } catch (err) {
    req.log.error({ err }, "TOTP enable failed");
    res.status(500).json({ error: "internal_error", message: "Could not enable 2FA" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/totp-disable
// Disable 2FA — requires valid TOTP code as confirmation.
// Body: { totpCode }
// ---------------------------------------------------------------------------
router.post("/admin/totp-disable", requireAdmin, async (req, res) => {
  try {
    const parsed = parseBody(TotpDisableSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { totpCode } = parsed.data;
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    if (!admin || !admin.totpEnabled || !admin.totpSecret) {
      res.status(400).json({ error: "bad_request", message: "2FA is not currently enabled" });
      return;
    }
    if (!verifyTotp(totpCode, admin.totpSecret)) {
      res.status(400).json({ error: "invalid_code", message: "Authenticator code is incorrect. Please try again." });
      return;
    }
    await db.update(adminTable)
      .set({ totpSecret: null, totpEnabled: false })
      .where(eq(adminTable.username, "admin"));
    res.json({ success: true, message: "Two-factor authentication disabled." });
  } catch (err) {
    req.log.error({ err }, "TOTP disable failed");
    res.status(500).json({ error: "internal_error", message: "Could not disable 2FA" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/admin/change-password
// Requires: currentPassword, newPassword
// If 2FA is enabled, also requires totpCode.
// ---------------------------------------------------------------------------
router.put("/admin/change-password", requireAdmin, async (req, res) => {
  try {
    const parsed = parseBody(ChangePasswordSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { currentPassword, newPassword, totpCode } = parsed.data;
    const [admin] = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    if (!admin) {
      res.status(404).json({ error: "not_found", message: "Admin account not found" });
      return;
    }
    const isValid = await verifyPasswordAny(admin.passwordHash, currentPassword, LEGACY_SALT);
    if (!isValid) {
      res.status(401).json({ error: "unauthorized", message: "Current password is incorrect" });
      return;
    }
    if (admin.totpEnabled && admin.totpSecret) {
      if (!totpCode) {
        res.status(400).json({ error: "totp_required", message: "Authenticator code required to change password" });
        return;
      }
      if (!verifyTotp(totpCode, admin.totpSecret)) {
        res.status(400).json({ error: "invalid_code", message: "Authenticator code is incorrect" });
        return;
      }
    }
    const newHash = await hashPasswordArgon2(newPassword);
    await db.update(adminTable).set({ passwordHash: newHash }).where(eq(adminTable.id, admin.id));
    res.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    req.log.error({ err }, "Admin change-password failed");
    res.status(500).json({ error: "internal_error", message: "Could not change password" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/sessions
// List active admin sessions.
// ---------------------------------------------------------------------------
router.get("/admin/sessions", requireAdmin, async (req, res) => {
  try {
    const now = new Date();
    const sessions = await db.select()
      .from(adminSessionsTable)
      .where(and(isNull(adminSessionsTable.revokedAt), gt(adminSessionsTable.expiresAt, now)))
      .orderBy(desc(adminSessionsTable.lastUsedAt));
    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt?.toISOString(),
        lastUsedAt: s.lastUsedAt?.toISOString(),
        expiresAt: s.expiresAt?.toISOString(),
        userAgent: s.userAgent,
        ip: s.ip,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list sessions");
    res.status(500).json({ error: "internal_error", message: "Could not list sessions" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/sessions/:id
// Revoke a session by its DB id.
// ---------------------------------------------------------------------------
router.delete("/admin/sessions/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid session id" });
      return;
    }
    await db.update(adminSessionsTable)
      .set({ revokedAt: new Date() })
      .where(eq(adminSessionsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to revoke session");
    res.status(500).json({ error: "internal_error", message: "Could not revoke session" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/health
// ---------------------------------------------------------------------------
router.get("/admin/health", requireAdmin, async (req, res) => {
  const start = Date.now();
  let dbLatencyMs: number | null = null;
  let ok = true;
  try {
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    ok = false;
    req.log.warn({ err, route: "GET /admin/health" }, "DB ping failed");
  }
  const mem = process.memoryUsage();
  res.json({
    ok,
    dbLatencyMs,
    uptimeSec: Math.round(process.uptime()),
    memoryMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    version: process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------
router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [
      totalResult,
      pendingResult,
      processingResult,
      shippedResult,
      deliveredResult,
      totalRevenueResult,
      todayRevenueResult,
      totalProductsResult,
      lowStockResult,
      recentOrders,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "processing")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "shipped")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "delivered")),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(
        sql`created_at::date = CURRENT_DATE`
      ),
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(lte(productsTable.stock, 5)),
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5),
    ]);

    const mapOrder = (o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      shippingCity: o.shippingCity,
      shippingDistrict: o.shippingDistrict,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
      items: (o.items ?? []).map((item: any, idx: number) => ({ id: idx + 1, ...item })),
      subtotal: parseFloat(o.subtotal),
      shippingCost: parseFloat(o.shippingCost ?? "0"),
      total: parseFloat(o.total),
      notes: o.notes,
      createdAt: o.createdAt?.toISOString(),
      updatedAt: o.updatedAt?.toISOString(),
    });

    const [weeklyRevenueData, paymentMethodData, topProductsData] = await Promise.all([
      db.select({
        day: sql<string>`TO_CHAR(created_at, 'Dy')`,
        revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
        orders: sql<number>`COUNT(*)`,
      }).from(ordersTable)
        .where(sql`created_at >= NOW() - INTERVAL '7 days'`)
        .groupBy(sql`TO_CHAR(created_at, 'Dy'), DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`),

      db.select({
        method: ordersTable.paymentMethod,
        count: sql<number>`COUNT(*)`,
      }).from(ordersTable)
        .groupBy(ordersTable.paymentMethod),

      db.execute(sql`
        SELECT
          item->>'productId' AS id,
          item->>'productName' AS name,
          item->>'productImage' AS "imageUrl",
          COALESCE(SUM((item->>'quantity')::int), 0) AS "totalSold"
        FROM orders, jsonb_array_elements(items) AS item
        GROUP BY item->>'productId', item->>'productName', item->>'productImage'
        ORDER BY "totalSold" DESC
        LIMIT 5
      `),
    ]);

    const totalPaymentOrders = paymentMethodData.reduce((s, p) => s + Number(p.count), 0);
    const paymentColors: Record<string, string> = {
      bkash: "#e2136e", nagad: "#f7941d", cod: "#16a34a", rocket: "#8b2291"
    };
    const paymentLabels: Record<string, string> = {
      bkash: "bKash", nagad: "Nagad", cod: "COD", rocket: "Rocket"
    };
    const paymentDistribution = paymentMethodData.map(p => ({
      name: paymentLabels[p.method] || p.method,
      value: totalPaymentOrders > 0 ? Math.round((Number(p.count) / totalPaymentOrders) * 100) : 0,
      color: paymentColors[p.method] || "#6b7280",
    }));

    const weeklyData = weeklyRevenueData.map(w => ({
      day: w.day,
      revenue: Number(w.revenue),
      orders: Number(w.orders),
    }));

    const topProducts = (topProductsData.rows ?? []).map((p: Record<string, unknown>) => ({
      id: Number(p.id),
      name: String(p.name ?? ''),
      imageUrl: String(p.imageUrl ?? ''),
      totalSold: Number(p.totalSold ?? 0),
    }));

    res.json({
      totalOrders: Number(totalResult[0]?.count ?? 0),
      pendingOrders: Number(pendingResult[0]?.count ?? 0),
      processingOrders: Number(processingResult[0]?.count ?? 0),
      shippedOrders: Number(shippedResult[0]?.count ?? 0),
      deliveredOrders: Number(deliveredResult[0]?.count ?? 0),
      totalRevenue: Number(totalRevenueResult[0]?.total ?? 0),
      todayRevenue: Number(todayRevenueResult[0]?.total ?? 0),
      totalProducts: Number(totalProductsResult[0]?.count ?? 0),
      lowStockProducts: Number(lowStockResult[0]?.count ?? 0),
      recentOrders: recentOrders.map(mapOrder),
      weeklyData,
      paymentDistribution,
      topProducts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "internal_error", message: "Failed to get stats" });
  }
});

router.get("/admin/customers", requireAdmin, async (req, res) => {
  try {
    const allOrders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));

    const customerMap = new Map<string, {
      name: string;
      email: string;
      phone: string;
      district: string;
      city: string;
      address: string;
      totalOrders: number;
      totalSpent: number;
      firstOrder: string;
      lastOrder: string;
      paymentMethods: string[];
      statuses: string[];
    }>();

    for (const o of allOrders) {
      const key = o.customerPhone || o.customerEmail;
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += parseFloat(String(o.total));
        if (o.createdAt && o.createdAt.toISOString() < existing.firstOrder) {
          existing.firstOrder = o.createdAt.toISOString();
        }
        if (o.createdAt && o.createdAt.toISOString() > existing.lastOrder) {
          existing.lastOrder = o.createdAt.toISOString();
        }
        if (!existing.paymentMethods.includes(o.paymentMethod)) {
          existing.paymentMethods.push(o.paymentMethod);
        }
        if (!existing.statuses.includes(o.status)) {
          existing.statuses.push(o.status);
        }
      } else {
        customerMap.set(key, {
          name: o.customerName,
          email: o.customerEmail,
          phone: o.customerPhone,
          district: o.shippingDistrict || "",
          city: o.shippingCity || "",
          address: o.shippingAddress || "",
          totalOrders: 1,
          totalSpent: parseFloat(String(o.total)),
          firstOrder: o.createdAt?.toISOString() || "",
          lastOrder: o.createdAt?.toISOString() || "",
          paymentMethods: [o.paymentMethod],
          statuses: [o.status],
        });
      }
    }

    const customers = Array.from(customerMap.values()).sort((a, b) =>
      new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
    );

    const districtCounts: Record<string, number> = {};
    for (const c of customers) {
      if (c.district) {
        districtCounts[c.district] = (districtCounts[c.district] || 0) + 1;
      }
    }

    const topDistricts = Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([district, count]) => ({ district, count }));

    res.json({
      totalCustomers: customers.length,
      totalOrders: allOrders.length,
      customers,
      topDistricts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get customers");
    res.status(500).json({ error: "internal_error", message: "Failed to get customers" });
  }
});

router.get("/admin/guest-customers", requireAdmin, async (req, res) => {
  try {
    const guests = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.isGuest, true))
      .orderBy(desc(customersTable.guestSequence));

    const enriched = await Promise.all(guests.map(async (g: typeof customersTable.$inferSelect) => {
      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.customerEmail, g.email))
        .orderBy(desc(ordersTable.createdAt));
      const totalSpent = orders.reduce((s: number, o: typeof ordersTable.$inferSelect) => s + parseFloat(String(o.total)), 0);
      const last = orders[0];
      const username = g.email.includes("@") ? g.email.split("@")[0] : g.email;
      return {
        id: g.id,
        guestSequence: g.guestSequence,
        username,
        name: g.name,
        email: g.email,
        phone: g.phone,
        createdAt: g.createdAt?.toISOString(),
        totalOrders: orders.length,
        totalSpent,
        lastOrderAt: last?.createdAt?.toISOString() || null,
        lastOrderNumber: last?.orderNumber || null,
        lastOrderStatus: last?.status || null,
        shippingDistrict: last?.shippingDistrict || null,
        shippingCity: last?.shippingCity || null,
        shippingAddress: last?.shippingAddress || null,
      };
    }));

    res.json({
      totalGuests: enriched.length,
      withOrders: enriched.filter((g: { totalOrders: number }) => g.totalOrders > 0).length,
      guests: enriched,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load guest customers");
    res.status(500).json({ error: "internal_error", message: "Failed to load guest customers" });
  }
});

router.post("/admin/guest-customers/:id/convert", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const { email, password, name } = (req.body ?? {}) as { email?: string; password?: string; name?: string };
    if (!email || !password) {
      res.status(400).json({ error: "validation_error", message: "email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
      return;
    }
    const emailLc = email.toLowerCase().trim();
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    if (!existing.isGuest) {
      res.status(400).json({ error: "bad_request", message: "Only guest accounts can be converted from this endpoint" });
      return;
    }
    const taken = await db.select().from(customersTable).where(eq(customersTable.email, emailLc)).limit(1);
    if (taken.length > 0 && taken[0].id !== id) {
      res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
      return;
    }
    await db.update(ordersTable)
      .set({ customerEmail: emailLc, customerId: id })
      .where(eq(ordersTable.customerEmail, existing.email));
    const passwordHash = await hashPasswordArgon2(password);
    const updates: Record<string, unknown> = {
      email: emailLc,
      passwordHash,
      isGuest: false,
      verified: true,
      updatedAt: new Date(),
    };
    if (name && name.trim()) updates.name = name.trim();

    const [updated] = await db.update(customersTable)
      .set(updates)
      .where(eq(customersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    logActivity({ action: "update", entity: "customer", entityId: id, entityName: updated.name ?? updated.email, before: existing as unknown as Record<string, unknown>, after: updated as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json({ success: true, customer: { id: updated.id, name: updated.name, email: updated.email, isGuest: updated.isGuest } });
  } catch (err) {
    req.log.error({ err }, "Failed to convert guest");
    res.status(500).json({ error: "internal_error", message: "Failed to convert guest account" });
  }
});

router.delete("/admin/guest-customers/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    if (!existing.isGuest) {
      res.status(400).json({ error: "bad_request", message: "Refusing to delete a non-guest account from this endpoint" });
      return;
    }
    await db.delete(customersTable).where(eq(customersTable.id, id));
    logActivity({ action: "delete", entity: "customer", entityId: id, entityName: existing.name ?? existing.email, before: existing as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete guest");
    res.status(500).json({ error: "internal_error", message: "Failed to delete guest account" });
  }
});

export default router;
