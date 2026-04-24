import { db, adminActivityLogsTable } from "@workspace/db";
import { logger } from "./logger";

export type ActivityAction = "create" | "update" | "delete" | "rollback";
export type ActivityEntity =
  | "product" | "order" | "blog" | "category"
  | "setting" | "hamper" | "promo" | "review";

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
      before: (opts.before ?? null) as any,
      after: (opts.after ?? null) as any,
    });
  } catch (err) {
    logger.error({ err, opts }, "[activity-log] Failed to insert activity log");
  }
}

/**
 * Extract a numeric admin ID from the request object (set by requireAdmin middleware).
 * Returns null if not available.
 */
export function getAdminId(req: any): number | null {
  return req.adminSession?.adminId ?? null;
}
