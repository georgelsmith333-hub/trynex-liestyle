import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;
if (!ADMIN_JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("ADMIN_JWT_SECRET environment variable is required in production");
}
if (
  ADMIN_JWT_SECRET &&
  process.env.JWT_SECRET &&
  ADMIN_JWT_SECRET === process.env.JWT_SECRET
) {
  throw new Error(
    "ADMIN_JWT_SECRET must be different from JWT_SECRET so customer tokens cannot be used as admin tokens",
  );
}
const adminJwtSecret = ADMIN_JWT_SECRET || "dev_only_admin_secret_not_for_production";

interface AdminTokenPayload {
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: { role: string }): string {
  return jwt.sign(payload, adminJwtSecret, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, adminJwtSecret) as AdminTokenPayload;
    if (!decoded || decoded.role !== "admin") return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Legacy helper kept for backwards compatibility. Admin tokens are signed
 * with ADMIN_JWT_SECRET, which is distinct from the customer JWT_SECRET, so
 * customer-issued tokens fail signature verification before the role check.
 */
export function validateToken(token: string): boolean {
  return verifyAdminToken(token) !== null;
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const bearer = req.headers.authorization?.replace("Bearer ", "");
  const cookieToken = req.cookies?.admin_token;
  const token = bearer ?? cookieToken;
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }
  const decoded = verifyAdminToken(token);
  if (!decoded) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }

  // CSRF defense for cookie-only authenticated mutations. Cookies are
  // attached automatically by the browser on cross-origin POSTs, so a
  // malicious page could trigger admin actions purely with the user's
  // cookie. Bearer-token auth is immune (an attacker cannot read the
  // token from another origin), so we only enforce on cookie-only
  // requests. Mutations require an explicit Origin/Referer match against
  // the configured ALLOWED_ORIGINS list (or any origin if the list is
  // unset, matching the CORS policy).
  const isMutation =
    req.method === "POST" ||
    req.method === "PUT" ||
    req.method === "PATCH" ||
    req.method === "DELETE";
  const cookieOnly = !bearer && !!cookieToken;
  if (isMutation && cookieOnly) {
    const origin = req.headers.origin || "";
    const referer = req.headers.referer || "";
    const allowedRaw = process.env.ALLOWED_ORIGINS;
    if (allowedRaw) {
      const allowed = allowedRaw.split(",").map((o) => o.trim()).filter(Boolean);
      const refererOrigin = referer
        ? (() => { try { return new URL(referer).origin; } catch (err) { return ""; } })()
        : "";
      const ok =
        (origin && allowed.includes(origin)) ||
        (refererOrigin && allowed.includes(refererOrigin));
      if (!ok) {
        res.status(403).json({ error: "csrf_blocked", message: "Cross-site request blocked" });
        return;
      }
    }
  }

  next();
}
