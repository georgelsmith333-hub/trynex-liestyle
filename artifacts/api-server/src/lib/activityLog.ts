import type { Request } from "express";
import { db, adminActivityLogsTable } from "@workspace/db";
import { logger } from "./logger";

export type ActivityAction = "create" | "update" | "delete" | "rollback";
export type ActivityEntity =
  | "product" | "order" | "blog" | "category"
  | "setting" | "hamper" | "promo" | "review" | "customer";

/** Extend Express Request with the session property set by requireAdmin middleware */
export interface AdminRequest extends Request {
  adminSession?: { adminId?: number | null; role?: string };
}

/**
 * Log an admin mutation. Never throws — logging failures are caught and
 * logged to stderr so they never interrupt the primary request.
 */
export async function logActivity(opts: {
  action: ActivityAction;
  entity: ActivityEntity | string;
  entityId: string | number;
  entityName: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  adminId?: number | null;
}): Promise<void> {
  try {
    await db.insert(adminActivityLogsTable).values({
      adminId: opts.adminId ?? null,
      action: opts.action,
      entity: opts.entity,
      entityId: String(opts.entityId),
      entityName: opts.entityName,
      before: opts.before ?? null,
      after: opts.after ?? null,
    });
  } catch (err) {
    logger.error({ err, opts }, "[activity-log] Failed to insert activity log");
  }
}

/**
 * Extract a numeric admin ID from the request object (set by requireAdmin middleware).
 * Returns null if not available.
 */
export function getAdminId(req: AdminRequest): number | null {
  return req.adminSession?.adminId ?? null;
}
