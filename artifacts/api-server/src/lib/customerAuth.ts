import jwt from "jsonwebtoken";

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
