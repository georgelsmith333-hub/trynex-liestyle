import { Router, type IRouter } from "express";
import { db, adminActivityLogsTable, productsTable, blogPostsTable, categoriesTable, ordersTable, hamperPackagesTable, promoCodesTable, reviewsTable, settingsTable } from "@workspace/db";
import { eq, desc, and, gte, lte, ilike, or, sql } from "drizzle-orm";
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

    const conditions: any[] = [];
    if (action) conditions.push(eq(adminActivityLogsTable.action, action));
    if (entity) conditions.push(eq(adminActivityLogsTable.entity, entity));
    if (search) conditions.push(ilike(adminActivityLogsTable.entityName, `%${search}%`));
    if (dateFrom) conditions.push(gte(adminActivityLogsTable.createdAt, new Date(dateFrom)));
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(adminActivityLogsTable.createdAt, end));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countResult] = await Promise.all([
      db.select().from(adminActivityLogsTable)
        .where(where)
        .orderBy(desc(adminActivityLogsTable.createdAt))
        .limit(limitNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(adminActivityLogsTable)
        .where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    res.json({
      logs,
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

    const before = entry.before as Record<string, any> | null;
    if (!before) {
      res.status(400).json({ error: "no_snapshot", message: "No before-snapshot available for this entry" });
      return;
    }

    const entityId = entry.entityId ? parseInt(entry.entityId, 10) : null;
    const adminId = getAdminId(req);
    const entity = entry.entity;

    let currentBefore: Record<string, any> | null = null;
    let rollbackResult: any = null;

    // ── Per-entity rollback logic ────────────────────────────────────────────
    if (entity === "product") {
      if (!entityId) throw new Error("Missing entity ID for product rollback");
      if (entry.action === "delete") {
        // Re-insert deleted product
        const { id: _id, createdAt: _ca, ...insertData } = before;
        [rollbackResult] = await db.insert(productsTable).values({
          ...insertData,
          id: entityId,
        } as any).onConflictDoUpdate({ target: productsTable.id, set: insertData as any }).returning();
      } else {
        const [cur] = await db.select().from(productsTable).where(eq(productsTable.id, entityId));
        currentBefore = cur as any;
        const { id: _id, createdAt: _ca, ...updateData } = before;
        [rollbackResult] = await db.update(productsTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(productsTable.id, entityId)).returning();
      }

    } else if (entity === "blog") {
      if (!entityId) throw new Error("Missing entity ID for blog rollback");
      if (entry.action === "delete") {
        const { id: _id, createdAt: _ca, ...insertData } = before;
        [rollbackResult] = await db.insert(blogPostsTable).values({ ...insertData, id: entityId } as any).onConflictDoUpdate({ target: blogPostsTable.id, set: insertData as any }).returning();
      } else {
        const [cur] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, entityId));
        currentBefore = cur as any;
        const { id: _id, createdAt: _ca, ...updateData } = before;
        [rollbackResult] = await db.update(blogPostsTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(blogPostsTable.id, entityId)).returning();
      }

    } else if (entity === "category") {
      if (!entityId) throw new Error("Missing entity ID for category rollback");
      if (entry.action === "delete") {
        const { id: _id, createdAt: _ca, ...insertData } = before;
        [rollbackResult] = await db.insert(categoriesTable).values({ ...insertData, id: entityId } as any).onConflictDoUpdate({ target: categoriesTable.id, set: insertData as any }).returning();
      } else {
        const [cur] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, entityId));
        currentBefore = cur as any;
        const { id: _id, createdAt: _ca, ...updateData } = before;
        [rollbackResult] = await db.update(categoriesTable).set(updateData as any).where(eq(categoriesTable.id, entityId)).returning();
      }

    } else if (entity === "order") {
      if (!entityId) throw new Error("Missing entity ID for order rollback");
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.id, entityId));
      currentBefore = cur as any;
      const { id: _id, createdAt: _ca, ...updateData } = before;
      [rollbackResult] = await db.update(ordersTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(ordersTable.id, entityId)).returning();

    } else if (entity === "hamper") {
      if (!entityId) throw new Error("Missing entity ID for hamper rollback");
      if (entry.action === "delete") {
        const { id: _id, createdAt: _ca, ...insertData } = before;
        [rollbackResult] = await db.insert(hamperPackagesTable).values({ ...insertData, id: entityId } as any).onConflictDoUpdate({ target: hamperPackagesTable.id, set: insertData as any }).returning();
      } else {
        const [cur] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.id, entityId));
        currentBefore = cur as any;
        const { id: _id, createdAt: _ca, ...updateData } = before;
        [rollbackResult] = await db.update(hamperPackagesTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(hamperPackagesTable.id, entityId)).returning();
      }

    } else if (entity === "promo") {
      if (!entityId) throw new Error("Missing entity ID for promo rollback");
      if (entry.action === "delete") {
        const { id: _id, createdAt: _ca, ...insertData } = before;
        [rollbackResult] = await db.insert(promoCodesTable).values({ ...insertData, id: entityId } as any).onConflictDoUpdate({ target: promoCodesTable.id, set: insertData as any }).returning();
      } else {
        const [cur] = await db.select().from(promoCodesTable).where(eq(promoCodesTable.id, entityId));
        currentBefore = cur as any;
        const { id: _id, createdAt: _ca, ...updateData } = before;
        [rollbackResult] = await db.update(promoCodesTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(promoCodesTable.id, entityId)).returning();
      }

    } else if (entity === "review") {
      if (!entityId) throw new Error("Missing entity ID for review rollback");
      const [cur] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, entityId));
      currentBefore = cur as any;
      const { id: _id, createdAt: _ca, ...updateData } = before;
      [rollbackResult] = await db.update(reviewsTable).set({ ...updateData, updatedAt: new Date() } as any).where(eq(reviewsTable.id, entityId)).returning();

    } else if (entity === "setting") {
      // before is a map of { key: value } pairs
      const updates: Array<{ key: string; value: string }> = [];
      for (const [key, value] of Object.entries(before)) {
        await db.insert(settingsTable).values({ key, value: String(value) }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value: String(value), updatedAt: new Date() },
        });
        updates.push({ key, value: String(value) });
      }
      rollbackResult = updates;

    } else {
      res.status(400).json({ error: "unsupported_entity", message: `Rollback not supported for entity type '${entity}'` });
      return;
    }

    // Log the rollback action
    await logActivity({
      action: "rollback",
      entity: entry.entity as any,
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
