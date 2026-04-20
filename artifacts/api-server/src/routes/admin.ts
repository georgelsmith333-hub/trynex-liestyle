import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, adminTable, customersTable } from "@workspace/db";
import { eq, sql, desc, lte, asc } from "drizzle-orm";
import * as crypto from "crypto";
import { signToken, requireAdmin } from "../middlewares/adminAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admins@Trynex";
const SALT = process.env.ADMIN_SALT || "trynex_salt_2024";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + SALT).digest("hex");
}

async function ensureAdminExists() {
  const desiredHash = hashPassword(ADMIN_PASSWORD);
  const existing = await db.select().from(adminTable).limit(1);
  if (existing.length === 0) {
    await db.insert(adminTable).values({
      username: "admin",
      passwordHash: desiredHash,
    });
  } else if (existing[0].passwordHash !== desiredHash) {
    // Auto-sync to current ADMIN_PASSWORD env var so a fresh deploy
    // with a new password takes effect without manual reset.
    await db
      .update(adminTable)
      .set({ passwordHash: desiredHash })
      .where(eq(adminTable.username, "admin"));
  }
}

// Run admin sync once at module load (server startup) instead of on every
// login attempt — avoids a DB write on every failed login.
let adminEnsuredOnce: Promise<void> | null = null;
function ensureAdminOnce(): Promise<void> {
  if (!adminEnsuredOnce) {
    adminEnsuredOnce = ensureAdminExists().catch((err) => {
      // Reset so a future login attempt can retry if startup ensure failed.
      adminEnsuredOnce = null;
      throw err;
    });
  }
  return adminEnsuredOnce;
}
ensureAdminOnce().catch(() => { /* logged on first login retry */ });

router.post("/admin/login", async (req, res) => {
  try {
    await ensureAdminOnce();
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: "validation_error", message: "password required" });
      return;
    }
    const admin = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    const storedHash = admin[0]?.passwordHash || hashPassword(ADMIN_PASSWORD);
    if (hashPassword(password) !== storedHash) {
      res.status(401).json({ error: "unauthorized", message: "Invalid password" });
      return;
    }
    const token = signToken({ role: "admin" });
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("admin_token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ success: true, token });
  } catch (err) {
    req.log.error({ err }, "Admin login failed");
    res.status(500).json({ error: "internal_error", message: "Login failed" });
  }
});

router.post("/admin/reset-password", async (req, res) => {
  try {
    const { resetKey } = req.body;
    const expectedKey = process.env.ADMIN_RESET_KEY || "TRYNEX_RESET_2026";
    if (!resetKey || resetKey !== expectedKey) {
      res.status(403).json({ error: "forbidden", message: "Invalid reset key" });
      return;
    }
    const newHash = hashPassword(ADMIN_PASSWORD);
    const existing = await db.select().from(adminTable).where(eq(adminTable.username, "admin")).limit(1);
    if (existing.length > 0) {
      await db.update(adminTable).set({ passwordHash: newHash }).where(eq(adminTable.username, "admin"));
    } else {
      await db.insert(adminTable).values({ username: "admin", passwordHash: newHash });
    }
    res.json({ success: true, message: "Admin password reset to ADMIN_PASSWORD env value" });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: "internal_error", message: "Reset failed" });
  }
});

router.post("/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ success: true, message: "Logged out" });
});

router.get("/admin/me", requireAdmin, async (req, res) => {
  res.json({ authenticated: true, username: "admin" });
});

router.get("/admin/health", requireAdmin, async (req, res) => {
  const start = Date.now();
  let dbLatencyMs: number | null = null;
  let ok = true;
  try {
    await db.execute(sql`SELECT 1`);
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    ok = false;
    req.log.warn({ err, route: "GET /admin/health" }, "DB ping failed");
  }
  const mem = process.memoryUsage();
  res.json({
    ok,
    dbLatencyMs,
    uptimeSec: Math.round(process.uptime()),
    memoryMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    version: process.env.npm_package_version || process.env.APP_VERSION || "0.0.0",
  });
});

router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [
      totalResult,
      pendingResult,
      processingResult,
      shippedResult,
      deliveredResult,
      totalRevenueResult,
      todayRevenueResult,
      totalProductsResult,
      lowStockResult,
      recentOrders,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(ordersTable),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "pending")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "processing")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "shipped")),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "delivered")),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable),
      db.select({ total: sql<number>`COALESCE(SUM(total::numeric), 0)` }).from(ordersTable).where(
        sql`created_at::date = CURRENT_DATE`
      ),
      db.select({ count: sql<number>`count(*)` }).from(productsTable),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(lte(productsTable.stock, 5)),
      db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt)).limit(5),
    ]);

    const mapOrder = (o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      shippingCity: o.shippingCity,
      shippingDistrict: o.shippingDistrict,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      status: o.status,
      items: (o.items ?? []).map((item: any, idx: number) => ({ id: idx + 1, ...item })),
      subtotal: parseFloat(o.subtotal),
      shippingCost: parseFloat(o.shippingCost ?? "0"),
      total: parseFloat(o.total),
      notes: o.notes,
      createdAt: o.createdAt?.toISOString(),
      updatedAt: o.updatedAt?.toISOString(),
    });

    const [weeklyRevenueData, paymentMethodData, topProductsData] = await Promise.all([
      db.select({
        day: sql<string>`TO_CHAR(created_at, 'Dy')`,
        revenue: sql<number>`COALESCE(SUM(total::numeric), 0)`,
        orders: sql<number>`COUNT(*)`,
      }).from(ordersTable)
        .where(sql`created_at >= NOW() - INTERVAL '7 days'`)
        .groupBy(sql`TO_CHAR(created_at, 'Dy'), DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`),

      db.select({
        method: ordersTable.paymentMethod,
        count: sql<number>`COUNT(*)`,
      }).from(ordersTable)
        .groupBy(ordersTable.paymentMethod),

      db.execute(sql`
        SELECT
          item->>'productId' AS id,
          item->>'productName' AS name,
          item->>'productImage' AS "imageUrl",
          COALESCE(SUM((item->>'quantity')::int), 0) AS "totalSold"
        FROM orders, jsonb_array_elements(items) AS item
        GROUP BY item->>'productId', item->>'productName', item->>'productImage'
        ORDER BY "totalSold" DESC
        LIMIT 5
      `),
    ]);

    const totalPaymentOrders = paymentMethodData.reduce((s, p) => s + Number(p.count), 0);
    const paymentColors: Record<string, string> = {
      bkash: "#e2136e", nagad: "#f7941d", cod: "#16a34a", rocket: "#8b2291"
    };
    const paymentLabels: Record<string, string> = {
      bkash: "bKash", nagad: "Nagad", cod: "COD", rocket: "Rocket"
    };
    const paymentDistribution = paymentMethodData.map(p => ({
      name: paymentLabels[p.method] || p.method,
      value: totalPaymentOrders > 0 ? Math.round((Number(p.count) / totalPaymentOrders) * 100) : 0,
      color: paymentColors[p.method] || "#6b7280",
    }));

    const weeklyData = weeklyRevenueData.map(w => ({
      day: w.day,
      revenue: Number(w.revenue),
      orders: Number(w.orders),
    }));

    const topProducts = (topProductsData.rows ?? []).map((p: Record<string, unknown>) => ({
      id: Number(p.id),
      name: String(p.name ?? ''),
      imageUrl: String(p.imageUrl ?? ''),
      totalSold: Number(p.totalSold ?? 0),
    }));

    res.json({
      totalOrders: Number(totalResult[0]?.count ?? 0),
      pendingOrders: Number(pendingResult[0]?.count ?? 0),
      processingOrders: Number(processingResult[0]?.count ?? 0),
      shippedOrders: Number(shippedResult[0]?.count ?? 0),
      deliveredOrders: Number(deliveredResult[0]?.count ?? 0),
      totalRevenue: Number(totalRevenueResult[0]?.total ?? 0),
      todayRevenue: Number(todayRevenueResult[0]?.total ?? 0),
      totalProducts: Number(totalProductsResult[0]?.count ?? 0),
      lowStockProducts: Number(lowStockResult[0]?.count ?? 0),
      recentOrders: recentOrders.map(mapOrder),
      weeklyData,
      paymentDistribution,
      topProducts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get admin stats");
    res.status(500).json({ error: "internal_error", message: "Failed to get stats" });
  }
});

router.get("/admin/customers", requireAdmin, async (req, res) => {
  try {
    const allOrders = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));

    const customerMap = new Map<string, {
      name: string;
      email: string;
      phone: string;
      district: string;
      city: string;
      address: string;
      totalOrders: number;
      totalSpent: number;
      firstOrder: string;
      lastOrder: string;
      paymentMethods: string[];
      statuses: string[];
    }>();

    for (const o of allOrders) {
      const key = o.customerPhone || o.customerEmail;
      const existing = customerMap.get(key);
      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpent += parseFloat(String(o.total));
        if (o.createdAt && o.createdAt.toISOString() < existing.firstOrder) {
          existing.firstOrder = o.createdAt.toISOString();
        }
        if (o.createdAt && o.createdAt.toISOString() > existing.lastOrder) {
          existing.lastOrder = o.createdAt.toISOString();
        }
        if (!existing.paymentMethods.includes(o.paymentMethod)) {
          existing.paymentMethods.push(o.paymentMethod);
        }
        if (!existing.statuses.includes(o.status)) {
          existing.statuses.push(o.status);
        }
      } else {
        customerMap.set(key, {
          name: o.customerName,
          email: o.customerEmail,
          phone: o.customerPhone,
          district: o.shippingDistrict || "",
          city: o.shippingCity || "",
          address: o.shippingAddress || "",
          totalOrders: 1,
          totalSpent: parseFloat(String(o.total)),
          firstOrder: o.createdAt?.toISOString() || "",
          lastOrder: o.createdAt?.toISOString() || "",
          paymentMethods: [o.paymentMethod],
          statuses: [o.status],
        });
      }
    }

    const customers = Array.from(customerMap.values()).sort((a, b) =>
      new Date(b.lastOrder).getTime() - new Date(a.lastOrder).getTime()
    );

    const districtCounts: Record<string, number> = {};
    for (const c of customers) {
      if (c.district) {
        districtCounts[c.district] = (districtCounts[c.district] || 0) + 1;
      }
    }

    const topDistricts = Object.entries(districtCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([district, count]) => ({ district, count }));

    res.json({
      totalCustomers: customers.length,
      totalOrders: allOrders.length,
      customers,
      topDistricts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get customers");
    res.status(500).json({ error: "internal_error", message: "Failed to get customers" });
  }
});

// Guest customers (created via /api/auth/guest) — admin visibility.
// Joins to orders by customer email so we can show order activity.
router.get("/admin/guest-customers", requireAdmin, async (req, res) => {
  try {
    const guests = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.isGuest, true))
      .orderBy(desc(customersTable.guestSequence));

    const enriched = await Promise.all(guests.map(async (g: typeof customersTable.$inferSelect) => {
      const orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.customerEmail, g.email))
        .orderBy(desc(ordersTable.createdAt));
      const totalSpent = orders.reduce((s: number, o: typeof ordersTable.$inferSelect) => s + parseFloat(String(o.total)), 0);
      const last = orders[0];
      return {
        id: g.id,
        guestSequence: g.guestSequence,
        name: g.name,
        email: g.email,
        phone: g.phone,
        createdAt: g.createdAt?.toISOString(),
        totalOrders: orders.length,
        totalSpent,
        lastOrderAt: last?.createdAt?.toISOString() || null,
        lastOrderNumber: last?.orderNumber || null,
        lastOrderStatus: last?.status || null,
        shippingDistrict: last?.shippingDistrict || null,
        shippingCity: last?.shippingCity || null,
        shippingAddress: last?.shippingAddress || null,
      };
    }));

    res.json({
      totalGuests: enriched.length,
      withOrders: enriched.filter((g: { totalOrders: number }) => g.totalOrders > 0).length,
      guests: enriched,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load guest customers");
    res.status(500).json({ error: "internal_error", message: "Failed to load guest customers" });
  }
});

// Convert a guest account into a full registered account.
// Body: { email, password, name? } — email becomes the real login.
router.post("/admin/guest-customers/:id/convert", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const { email, password, name } = (req.body ?? {}) as { email?: string; password?: string; name?: string };
    if (!email || !password) {
      res.status(400).json({ error: "validation_error", message: "email and password are required" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "validation_error", message: "Password must be at least 6 characters" });
      return;
    }
    const emailLc = email.toLowerCase().trim();
    const taken = await db.select().from(customersTable).where(eq(customersTable.email, emailLc)).limit(1);
    if (taken.length > 0 && taken[0].id !== id) {
      res.status(409).json({ error: "conflict", message: "An account with this email already exists" });
      return;
    }
    const SALT = process.env.CUSTOMER_SALT || "trynex_customer_2024";
    const passwordHash = crypto.createHash("sha256").update(password + SALT).digest("hex");
    const updates: Record<string, unknown> = {
      email: emailLc,
      passwordHash,
      isGuest: false,
      verified: true,
      updatedAt: new Date(),
    };
    if (name && name.trim()) updates.name = name.trim();

    const [updated] = await db.update(customersTable)
      .set(updates)
      .where(eq(customersTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    res.json({ success: true, customer: { id: updated.id, name: updated.name, email: updated.email, isGuest: updated.isGuest } });
  } catch (err) {
    req.log.error({ err }, "Failed to convert guest");
    res.status(500).json({ error: "internal_error", message: "Failed to convert guest account" });
  }
});

router.delete("/admin/guest-customers/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "validation_error", message: "Invalid id" });
      return;
    }
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Customer not found" });
      return;
    }
    if (!existing.isGuest) {
      res.status(400).json({ error: "bad_request", message: "Refusing to delete a non-guest account from this endpoint" });
      return;
    }
    await db.delete(customersTable).where(eq(customersTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete guest");
    res.status(500).json({ error: "internal_error", message: "Failed to delete guest account" });
  }
});

export default router;
