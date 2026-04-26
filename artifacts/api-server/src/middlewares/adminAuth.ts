import type { Request, Response, NextFunction } from "express";
import { validateAdminSession } from "../lib/adminSessions";

/**
 * Admin authentication middleware.
 *
 * Sessions are persisted in the `admin_sessions` table. The opaque token issued
 * at login is stored client-side (httpOnly cookie or `Authorization: Bearer`)
 * and only its SHA-256 hash is stored server-side. Every protected request
 * validates the token against the DB so that:
 *
 *   - Logout / password reset can revoke sessions immediately (set revoked_at).
 *   - Sessions expire on a real wall-clock deadline (expires_at).
 *   - lastUsedAt can be tracked for activity audits.
 *
 * No JWT — admin auth is fully stateful and can be revoked.
 *
 * CSRF Defense (layered):
 *   Layer 1: Requests using `Authorization: Bearer` are immune to CSRF by design.
 *   Layer 2: Cookie-only mutations MUST include `X-Requested-With: XMLHttpRequest`.
 *            This custom header cannot be added by a cross-origin HTML form or
 *            img/script tag — browsers block it per the CORS pre-flight rules.
 *   Layer 3: When ALLOWED_ORIGINS is configured, Origin/Referer is also checked.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const bearer = req.headers.authorization?.replace("Bearer ", "");
  const cookieToken = (req as any).cookies?.admin_token;
  const token = bearer ?? cookieToken;
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }

  validateAdminSession(token)
    .then((session) => {
      if (!session) {
        res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
        return;
      }

      // CSRF defense for cookie-only authenticated mutations.
      const isMutation =
        req.method === "POST" ||
        req.method === "PUT" ||
        req.method === "PATCH" ||
        req.method === "DELETE";
      const cookieOnly = !bearer && !!cookieToken;

      if (isMutation && cookieOnly) {
        // Layer 2: Always enforce X-Requested-With for cookie-only mutations.
        const xrw = req.headers["x-requested-with"];
        if (!xrw || String(xrw).toLowerCase() !== "xmlhttprequest") {
          res.status(403).json({ error: "csrf_blocked", message: "Cross-site request blocked (missing X-Requested-With)" });
          return;
        }

        // Layer 3: Also enforce Origin/Referer when ALLOWED_ORIGINS is configured.
        const allowedRaw = process.env.ALLOWED_ORIGINS;
        if (allowedRaw) {
          const allowed = allowedRaw.split(",").map((o) => o.trim()).filter(Boolean);
          const origin = req.headers.origin || "";
          const referer = req.headers.referer || "";
          const refererOrigin = referer
            ? (() => { try { return new URL(referer).origin; } catch { return ""; } })()
            : "";
          const ok =
            (origin && allowed.includes(origin)) ||
            (refererOrigin && allowed.includes(refererOrigin));
          if (!ok) {
            res.status(403).json({ error: "csrf_blocked", message: "Cross-site request blocked (origin mismatch)" });
            return;
          }
        }
      }

      (req as any).adminSession = session;
      next();
    })
    .catch((err) => {
      req.log?.error?.({ err }, "Admin session validation failed");
      res.status(500).json({ error: "internal_error", message: "Auth check failed" });
    });
}

export async function validateToken(token: string): Promise<boolean> {
  return (await validateAdminSession(token)) !== null;
}
