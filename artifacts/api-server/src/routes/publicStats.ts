import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { sql, desc, gte } from "drizzle-orm";

const router: IRouter = Router();

router.get("/public-stats", async (_req, res) => {
  try {
    const now = new Date();
    const BST_OFFSET_MS = 6 * 60 * 60 * 1000;
    const nowBST = new Date(now.getTime() + BST_OFFSET_MS);
    const startOfTodayBST = new Date(
      Date.UTC(nowBST.getUTCFullYear(), nowBST.getUTCMonth(), nowBST.getUTCDate())
    );
    const startOfToday = new Date(startOfTodayBST.getTime() - BST_OFFSET_MS);

    const [todayCountRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(ordersTable)
      .where(gte(ordersTable.createdAt, startOfToday));

    const [totalCountRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(ordersTable);

    const [lastOrderRow] = await db
      .select({ createdAt: ordersTable.createdAt })
      .from(ordersTable)
      .orderBy(desc(ordersTable.createdAt))
      .limit(1);

    const todayOrders = todayCountRow?.total ?? 0;
    const totalOrders = totalCountRow?.total ?? 0;

    let minutesSinceLastOrder: number | null = null;
    if (lastOrderRow?.createdAt) {
      const diff = Date.now() - new Date(lastOrderRow.createdAt).getTime();
      minutesSinceLastOrder = Math.floor(diff / 60000);
    }

    res.json({ todayOrders, totalOrders, minutesSinceLastOrder });
  } catch {
    res.json({ todayOrders: 0, totalOrders: 0, minutesSinceLastOrder: null });
  }
});

export default router;
