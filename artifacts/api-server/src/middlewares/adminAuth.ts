import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable is required in production");
}
const jwtSecret = JWT_SECRET || "dev_only_secret_not_for_production";

export function signToken(payload: { role: string }): string {
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

export function validateToken(token: string): boolean {
  try {
    jwt.verify(token, jwtSecret);
    return true;
  } catch {
    return false;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token =
    req.headers.authorization?.replace("Bearer ", "") ??
    req.cookies?.admin_token;
  if (!token || !validateToken(token)) {
    res.status(401).json({ error: "unauthorized", message: "Admin authentication required" });
    return;
  }
  next();
}
