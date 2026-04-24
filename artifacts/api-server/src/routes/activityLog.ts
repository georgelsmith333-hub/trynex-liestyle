import { Router, type IRouter } from "express";
import {
  db, adminActivityLogsTable, adminTable,
  productsTable, blogPostsTable, categoriesTable, ordersTable,
  hamperPackagesTable, promoCodesTable, reviewsTable, settingsTable, customersTable,
} from "@workspace/db";
import { eq, desc, and, gte, lte, ilike, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";

const router: IRouter = Router();

// ── GET /api/admin/activity-logs ──────────────────────────────────────────────
router.get("/admin/activity-logs", requireAdmin, async (req, res) => {
  try {
    const {
      page = "1",
      limit = "20",
      action,
      entity,
      search,
      dateFrom,
      dateTo,
    } = req.query as Record<string, string | undefined>;

    const pageNum = Math.max(1, parseInt(page ?? "1", 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10)));
    const offset = (pageNum - 1) * limitNum;

    const endDate = dateTo ? new Date(dateTo) : null;
    if (endDate) endDate.setHours(23, 59, 59, 999);

    const where = and(
      action ? eq(adminActivityLogsTable.action, action) : undefined,
      entity ? eq(adminActivityLogsTable.entity, entity) : undefined,
      search ? ilike(adminActivityLogsTable.entityName, `%${search}%`) : undefined,
      dateFrom ? gte(adminActivityLogsTable.createdAt, new Date(dateFrom)) : undefined,
      endDate ? lte(adminActivityLogsTable.createdAt, endDate) : undefined,
    );

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: adminActivityLogsTable.id,
          adminId: adminActivityLogsTable.adminId,
          adminName: adminTable.username,
          action: adminActivityLogsTable.action,
          entity: adminActivityLogsTable.entity,
          entityId: adminActivityLogsTable.entityId,
          entityName: adminActivityLogsTable.entityName,
          before: adminActivityLogsTable.before,
          after: adminActivityLogsTable.after,
          createdAt: adminActivityLogsTable.createdAt,
        })
        .from(adminActivityLogsTable)
        .leftJoin(adminTable, eq(adminActivityLogsTable.adminId, adminTable.id))
        .where(where)
        .orderBy(desc(adminActivityLogsTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(adminActivityLogsTable)
        .where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      logs: rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list activity logs");
    res.status(500).json({ error: "internal_error", message: "Failed to list activity logs" });
  }
});

// ── POST /api/admin/activity-logs/:id/rollback ────────────────────────────────
router.post("/admin/activity-logs/:id/rollback", requireAdmin, async (req, res) => {
  try {
    const logId = parseInt(req.params.id as string, 10);
    if (isNaN(logId)) {
      res.status(400).json({ error: "validation_error", message: "Invalid log ID" });
      return;
    }

    const [entry] = await db.select().from(adminActivityLogsTable).where(eq(adminActivityLogsTable.id, logId));
    if (!entry) {
      res.status(404).json({ error: "not_found", message: "Log entry not found" });
      return;
    }

    if (!["update", "delete"].includes(entry.action)) {
      res.status(400).json({
        error: "not_rollbackable",
        message: `Cannot roll back a '${entry.action}' action. Only 'update' and 'delete' actions support rollback.`,
      });
      return;
    }

    const before = entry.before as Record<string, unknown> | null;
    if (!before) {
      res.status(400).json({ error: "no_snapshot", message: "No before-snapshot available for this entry" });
      return;
    }

    const entityId = entry.entityId ? parseInt(entry.entityId, 10) : null;
    const adminId = getAdminId(req);
    const entity = entry.entity;

    let currentBefore: Record<string, unknown> | null = null;
    let rollbackResult: unknown = null;

    // Strip meta-columns that shouldn't be re-inserted
    function stripMeta(data: Record<string, unknown>) {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data as Record<string, unknown> & { id?: unknown; createdAt?: unknown; updatedAt?: unknown };
      return rest;
    }

    // ── Per-entity rollback logic ────────────────────────────────────────────
    if (entity === "product") {
      if (!entityId) throw new Error("Missing entity ID for product rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof productsTable.$inferInsert;
        [rollbackResult] = await db.insert(productsTable).values(insertData).onConflictDoUpdate({ target: productsTable.id, set: stripMeta(before) as Partial<typeof productsTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(productsTable).where(eq(productsTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(productsTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof productsTable.$inferInsert>).where(eq(productsTable.id, entityId)).returning();
      }

    } else if (entity === "blog") {
      if (!entityId) throw new Error("Missing entity ID for blog rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof blogPostsTable.$inferInsert;
        [rollbackResult] = await db.insert(blogPostsTable).values(insertData).onConflictDoUpdate({ target: blogPostsTable.id, set: stripMeta(before) as Partial<typeof blogPostsTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(blogPostsTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof blogPostsTable.$inferInsert>).where(eq(blogPostsTable.id, entityId)).returning();
      }

    } else if (entity === "category") {
      if (!entityId) throw new Error("Missing entity ID for category rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof categoriesTable.$inferInsert;
        [rollbackResult] = await db.insert(categoriesTable).values(insertData).onConflictDoUpdate({ target: categoriesTable.id, set: stripMeta(before) as Partial<typeof categoriesTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(categoriesTable).set(stripMeta(before) as Partial<typeof categoriesTable.$inferInsert>).where(eq(categoriesTable.id, entityId)).returning();
      }

    } else if (entity === "order") {
      if (!entityId) throw new Error("Missing entity ID for order rollback");
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.id, entityId));
      currentBefore = cur as unknown as Record<string, unknown>;
      [rollbackResult] = await db.update(ordersTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof ordersTable.$inferInsert>).where(eq(ordersTable.id, entityId)).returning();

    } else if (entity === "hamper") {
      if (!entityId) throw new Error("Missing entity ID for hamper rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof hamperPackagesTable.$inferInsert;
        [rollbackResult] = await db.insert(hamperPackagesTable).values(insertData).onConflictDoUpdate({ target: hamperPackagesTable.id, set: stripMeta(before) as Partial<typeof hamperPackagesTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(hamperPackagesTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof hamperPackagesTable.$inferInsert>).where(eq(hamperPackagesTable.id, entityId)).returning();
      }

    } else if (entity === "promo") {
      if (!entityId) throw new Error("Missing entity ID for promo rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof promoCodesTable.$inferInsert;
        [rollbackResult] = await db.insert(promoCodesTable).values(insertData).onConflictDoUpdate({ target: promoCodesTable.id, set: stripMeta(before) as Partial<typeof promoCodesTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(promoCodesTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof promoCodesTable.$inferInsert>).where(eq(promoCodesTable.id, entityId)).returning();
      }

    } else if (entity === "review") {
      if (!entityId) throw new Error("Missing entity ID for review rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof reviewsTable.$inferInsert;
        [rollbackResult] = await db.insert(reviewsTable).values(insertData).onConflictDoUpdate({ target: reviewsTable.id, set: stripMeta(before) as Partial<typeof reviewsTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(reviewsTable).set(stripMeta(before) as Partial<typeof reviewsTable.$inferInsert>).where(eq(reviewsTable.id, entityId)).returning();
      }

    } else if (entity === "setting") {
      const updates: Array<{ key: string; value: string }> = [];
      for (const [key, value] of Object.entries(before)) {
        await db.insert(settingsTable).values({ key, value: String(value) }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: String(value), updatedAt: new Date() },
        });
        updates.push({ key, value: String(value) });
      }
      rollbackResult = updates;

    } else if (entity === "customer") {
      if (!entityId) throw new Error("Missing entity ID for customer rollback");
      if (entry.action === "delete") {
        const insertData = { ...stripMeta(before), id: entityId } as typeof customersTable.$inferInsert;
        [rollbackResult] = await db.insert(customersTable).values(insertData).onConflictDoUpdate({ target: customersTable.id, set: stripMeta(before) as Partial<typeof customersTable.$inferInsert> }).returning();
      } else {
        const [cur] = await db.select().from(customersTable).where(eq(customersTable.id, entityId));
        currentBefore = cur as unknown as Record<string, unknown>;
        [rollbackResult] = await db.update(customersTable).set({ ...stripMeta(before), updatedAt: new Date() } as Partial<typeof customersTable.$inferInsert>).where(eq(customersTable.id, entityId)).returning();
      }

    } else {
      res.status(400).json({ error: "unsupported_entity", message: `Rollback not supported for entity type '${entity}'` });
      return;
    }

    await logActivity({
      action: "rollback",
      entity: entry.entity,
      entityId: entry.entityId ?? "?",
      entityName: entry.entityName ?? "Unknown",
      before: currentBefore,
      after: before,
      adminId,
    });

    res.json({
      success: true,
      message: `Rolled back ${entry.entityName} to its previous state.`,
      result: rollbackResult,
    });
  } catch (err) {
    req.log.error({ err }, "Rollback failed");
    res.status(500).json({ error: "internal_error", message: "Rollback failed" });
  }
});

export default router;
