import jwt from "jsonwebtoken";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production");
}
const JWT_SECRET = process.env.JWT_SECRET || "dev_only_secret_not_for_production";

export function verifyCustomerToken(token: string): { id: number; email: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; email: string; role: string };
    if (decoded.role !== "customer") return null;
    return decoded;
  } catch (err) {
    return null;
  }
}

export function extractCustomerToken(req: { headers: { authorization?: string }; cookies?: Record<string, string> }): string | null {
  return req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.customer_token ?? null;
}
