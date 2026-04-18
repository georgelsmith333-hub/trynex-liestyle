import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable is required in production");
}
const jwtSecret = JWT_SECRET || "dev_only_secret_not_for_production";

interface AdminTokenPayload {
  role: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: { role: string }): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as AdminTokenPayload;
    if (!decoded || decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Legacy helper kept for backwards compatibility — now strictly enforces
 * role === "admin" so customer-issued tokens (signed with the same secret)
 * cannot escalate to admin endpoints.
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
