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
  } catch {
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
  const token =
    req.headers.authorization?.replace("Bearer ", "") ??
    req.cookies?.admin_token;
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }
  const decoded = verifyAdminToken(token);
  if (!decoded) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }
  next();
}
