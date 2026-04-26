import * as crypto from "crypto";
import { db, adminSessionsTable } from "@workspace/db";
import { eq, and, isNull, gt, lt } from "drizzle-orm";

export const ADMIN_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createAdminSession(opts: {
  adminId?: number | null;
  userAgent?: string | null;
  ip?: string | null;
  ttlMs?: number;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const ttl = opts.ttlMs ?? ADMIN_SESSION_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);
  await db.insert(adminSessionsTable).values({
    tokenHash,
    adminId: opts.adminId ?? null,
    role: "admin",
    expiresAt,
    userAgent: opts.userAgent ?? null,
    ip: opts.ip ?? null,
  });
  return { token, expiresAt };
}

export async function validateAdminSession(
  token: string,
): Promise<{ id: number; role: string; adminId: number | null } | null> {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const now = new Date();
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(
      and(
        eq(adminSessionsTable.tokenHash, tokenHash),
        isNull(adminSessionsTable.revokedAt),
        gt(adminSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  // Touch lastUsedAt (best-effort, non-blocking on failure)
  db.update(adminSessionsTable)
    .set({ lastUsedAt: now })
    .where(eq(adminSessionsTable.id, row.id))
    .catch(() => {});
  return { id: row.id, role: row.role, adminId: row.adminId };
}

export async function revokeAdminSession(token: string): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await db
    .update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessionsTable.tokenHash, tokenHash));
}

export async function revokeAllAdminSessions(): Promise<void> {
  await db
    .update(adminSessionsTable)
    .set({ revokedAt: new Date() })
    .where(isNull(adminSessionsTable.revokedAt));
}

export async function purgeExpiredAdminSessions(): Promise<void> {
  // Best-effort cleanup; safe to call from a periodic job.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db
    .delete(adminSessionsTable)
    .where(lt(adminSessionsTable.expiresAt, cutoff));
}
