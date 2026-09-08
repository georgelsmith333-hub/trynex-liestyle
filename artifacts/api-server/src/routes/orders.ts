import { Router, type IRouter, type Request, type Response } from "express";
import { createHash } from "crypto";
import { db, ordersTable, productsTable, settingsTable, promoCodesTable, referralsTable, hamperPackagesTable, notificationsTable, adminActivityLogsTable } from "@workspace/db";
import { eq, and, desc, sql, inArray, lte, or, ilike, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import { verifyCustomerToken, extractCustomerToken } from "../lib/customerAuth";
import { logger } from "../lib/logger";
import { getVirtualPromo, calcVirtualDiscount } from "../lib/spinPromos";
import { ObjectStorageService } from "../lib/objectStorage";
import { z } from "zod";
import { tgSend, getEffectiveChatId } from "../lib/telegram";
import { checkRevenueMilestone } from "../lib/scheduler";
import { syncOrderEntitlement } from "../lib/spinLedger";
import { sendOrderConfirmationEmail, sendStatusUpdateEmail } from "../lib/email";

// ---------------------------------------------------------------------------
// Zod schemas for order creation
// ---------------------------------------------------------------------------
const OrderItemSchema = z.object({
  productId:    z.union([z.number(), z.string()]).transform(v => Number(v)),
  quantity:     z.number().int().min(1).max(100),
  productName:  z.string().max(300).optional(),
  name:         z.string().max(300).optional(),
  size:         z.string().max(50).optional().nullable(),
  color:        z.string().max(50).optional().nullable(),
  variantId:    z.string().max(80).optional().nullable(),
  variantName:  z.string().max(120).optional().nullable(),
  customizationFee: z.number().nonnegative().optional(),
  customNote:   z.string().max(10000).optional().nullable(),
  // customImages may contain base64 data-URLs (for studio mockup preview) which
  // are far longer than a plain URL — no per-item length cap here; we strip
  // data-URLs before DB storage below.
  customImages: z.array(z.string()).max(20).optional().nullable(),
  // Studio originals are uploaded to object storage before checkout. Keep
  // their paths and metadata in the validated order payload so the server can
  // move them from the staging prefix into the order prefix.
  originalAssetUrls: z.array(z.string()).max(20).optional().nullable(),
  originalAssets: z.array(z.object({
    objectPath: z.string().max(500),
    filename: z.string().max(300),
    mime: z.string().max(150),
    bytes: z.number().nonnegative(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  })).max(20).optional().nullable(),
  price:        z.number().nonnegative().optional(),
  // No length cap — imageUrl may be a data-URL (base64 mockup preview) which can be 50–200 KB.
  // Data-URLs are stripped server-side before DB storage; only object-storage paths are kept.
  imageUrl:     z.string().optional().nullable(),
});

const OrderCreateSchema = z.object({
  customerName:  z.string().max(150).optional(),
  firstName:     z.string().max(75).optional(),
  lastName:      z.string().max(75).optional(),
  customerEmail: z.string().email().max(254).optional().nullable(),
  customerPhone: z.string().min(7).max(25),
  shippingAddress: z.string().min(1).max(500),
  shippingCity:    z.string().max(100).optional().nullable(),
  shippingDistrict: z.string().max(100).optional().nullable(),
  paymentMethod: z.string().max(50).optional(),
  items:         z.array(OrderItemSchema).min(1, "Cart must have at least one item"),
  notes:         z.string().max(2000).optional().nullable(),
  promoCode:     z.string().max(50).optional().nullable(),
  utmSource:     z.string().max(100).optional().nullable(),
  utmMedium:     z.string().max(100).optional().nullable(),
  utmCampaign:   z.string().max(100).optional().nullable(),
});

const SUPPORTED_PAYMENT_METHODS = ["bkash", "nagad", "upay", "bank", "card", "cod"] as const;

const orderStorageService = new ObjectStorageService();

class StockOutError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super("STOCK_OUT");
    this.name = "StockOutError";
  }
}

class ProductMissingError extends Error {
  constructor(public readonly productName: string) {
    super("PRODUCT_MISSING");
    this.name = "ProductMissingError";
  }
}

const router: IRouter = Router();

function normalizeContactEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeBangladeshPhone(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("880") ? `0${digits.slice(3)}` : digits;
}

function isValidBangladeshPhone(value: string): boolean {
  return /^01[3-9]\d{8}$/.test(value);
}

function normalizePaymentProofPath(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, "http://payment-proof.local");
    const pathname = parsed.pathname;
    // Payment evidence may only point at a private object path issued by our
    // storage API, never at an arbitrary external URL.
    if (
      !/^\/api\/storage\/objects\/[A-Za-z0-9._~!$&'()*+,;=:@/-]+$/.test(pathname) ||
      pathname.includes("..") ||
      parsed.search ||
      parsed.hash
    ) return null;
    return pathname;
  } catch {
    return null;
  }
}

async function migrateOrdersTable() {
  try {
    await db.execute(sql`
      ALTER TABLE orders
        ADD COLUMN IF NOT EXISTS utm_source TEXT,
        ADD COLUMN IF NOT EXISTS utm_medium TEXT,
        ADD COLUMN IF NOT EXISTS utm_campaign TEXT
    `);
  } catch (err) {
    logger.warn({ err }, "migrateOrdersTable failed; UTM columns may be missing");
  }
}
// Delay migration until DB failover probe settles so we run against the correct DB
import("@workspace/db").then(({ dbReady }) => dbReady).then(() => migrateOrdersTable()).catch(() => {});

async function sendMetaCAPIEvent(event: {
  eventName: string;
  orderId: string;
  total: number;
  currency: string;
  items: { id: string | number; name: string; price: number; quantity: number }[];
  email?: string;
  phone?: string;
  sourceUrl?: string;
}) {
  try {
    const [tokenRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "metaCapiToken"));
    const [pixelRow] = await db.select().from(settingsTable).where(eq(settingsTable.key, "facebookPixelId"));
    const capiToken = tokenRow?.value?.trim();
    const pixelId = pixelRow?.value?.trim();
    if (!capiToken || !pixelId) return;

    const sha256 = (input: string): string =>
      createHash("sha256").update(input).digest("hex");

    const hashedEmail = event.email
      ? sha256(event.email.toLowerCase().trim())
      : undefined;
    const hashedPhone = event.phone
      ? sha256(event.phone.replace(/\D/g, ""))
      : undefined;

    const payload = {
      data: [{
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.orderId,
        action_source: "website",
        event_source_url: event.sourceUrl || `${process.env.API_PUBLIC_URL || "https://trynex-lifestyle-shop.pages.dev"}/checkout`,
        user_data: {
          em: hashedEmail ? [hashedEmail] : undefined,
          ph: hashedPhone ? [hashedPhone] : undefined,
        },
        custom_data: {
          currency: event.currency,
          value: event.total,
          content_ids: event.items.map(i => String(i.id)),
          content_type: "product",
          num_items: event.items.length,
        },
      }],
    };

    const capiController = new AbortController();
    const capiTimeout = setTimeout(() => capiController.abort(), 5000);
    try {
      await fetch(
        `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${capiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: capiController.signal,
        }
      );
    } finally {
      clearTimeout(capiTimeout);
    }
  } catch (err) {
    logger.error({ err }, "Meta CAPI event failed (non-blocking)");
  }
}

async function sendTelegramNotification(orderData: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getEffectiveChatId();
  if (!botToken || !chatId) return;

  const itemsList = (orderData.items || [])
    .slice(0, 5)
    .map((i: any) => `  • ${i.productName || i.name} x${i.quantity}`)
    .join("\n");
  const moreItems = (orderData.items || []).length > 5 ? `\n  + ${(orderData.items || []).length - 5} more` : "";
  const total = Number(orderData.total) || 0;
  const isFullPayment = String(orderData.notes ?? "").includes("Payment plan: full payment");
  const amountDueNow = isFullPayment ? total : Math.ceil(total * 0.25);
  const remaining = Math.max(0, total - amountDueNow);

  const message = [
    `🛍️ <b>NEW ORDER #${orderData.orderNumber}</b>`,
    ``,
    `👤 <b>Customer:</b> ${orderData.customerName}`,
    `📞 <b>Phone:</b> ${orderData.customerPhone}`,
    `📧 <b>Email:</b> ${orderData.customerEmail || 'N/A'}`,
    `📍 <b>District:</b> ${orderData.shippingDistrict || 'N/A'}${orderData.shippingCity ? ` (${orderData.shippingCity})` : ''}`,
    `🏠 <b>Address:</b> ${orderData.shippingAddress}`,
    ``,
    `🛒 <b>Items:</b>`,
    itemsList + moreItems,
    ``,
    `💰 <b>Total:</b> ৳${total}`,
    `💳 <b>Payment:</b> ${(orderData.paymentMethod || 'COD').toUpperCase()}`,
    `🏷️ <b>${isFullPayment ? "Due now (full payment)" : "Advance (25%)"}:</b> ৳${amountDueNow}`,
    !isFullPayment ? `🏷️ <b>Remaining on delivery:</b> ৳${remaining}` : '',
    orderData.promoCode ? `🎟️ <b>Promo:</b> ${orderData.promoCode} (-৳${orderData.promoDiscount})` : '',
    orderData.notes ? `📝 <b>Notes:</b> ${orderData.notes}` : '',
    ``,
    `⏰ ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`,
  ].filter((s): s is string => typeof s === "string" && s.length >= 0).join("\n");

  const orderNum = orderData.orderNumber;
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: "🚚 Ship", callback_data: `ship:${orderNum}` },
        { text: "✅ Deliver", callback_data: `deliver:${orderNum}` },
      ],
      [
        { text: "❌ Cancel", callback_data: `cancel:${orderNum}` },
        { text: "📄 Invoice", callback_data: `invoice:${orderNum}` },
        { text: "👤 Customer", callback_data: `customer:${orderNum}` },
      ],
    ],
  };

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        reply_markup: JSON.stringify(inlineKeyboard),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err }, "Telegram notification failed (non-blocking)");
  }
}

async function sendWhatsAppNotification(orderData: any) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apiKey) return;

  const itemsList = (orderData.items || [])
    .map((i: any) => `${i.productName} x${i.quantity}`)
    .join(", ");

  const total = Number(orderData.total) || 0;
  const isFullPayment = String(orderData.notes ?? "").includes("Payment plan: full payment");
  const amountDueNow = isFullPayment ? total : Math.ceil(total * 0.25);
  const remaining = Math.max(0, total - amountDueNow);
  const message = [
    `🛒 *NEW ORDER!* #${orderData.orderNumber}`,
    `━━━━━━━━━━━━━━━`,
    `👤 *Customer:* ${orderData.customerName}`,
    `📱 *Phone:* ${orderData.customerPhone}`,
    `📧 *Email:* ${orderData.customerEmail || 'N/A'}`,
    `📍 *Location:* ${orderData.shippingDistrict}${orderData.shippingCity ? ` (${orderData.shippingCity})` : ''}`,
    `🏠 *Address:* ${orderData.shippingAddress}`,
    `━━━━━━━━━━━━━━━`,
    `🛍️ *Items:* ${itemsList}`,
    `💰 *Total:* ৳${total}`,
    `💳 *Payment:* ${orderData.paymentMethod?.toUpperCase()}`,
    `🏷️ *${isFullPayment ? "Due now (full payment)" : "Advance (25%)"}:* ৳${amountDueNow}`,
    !isFullPayment ? `🏷️ *Remaining on delivery:* ৳${remaining}` : '',
    orderData.promoCode ? `🎟️ *Promo:* ${orderData.promoCode} (-৳${orderData.promoDiscount})` : '',
    orderData.notes ? `📝 *Notes:* ${orderData.notes}` : '',
    `━━━━━━━━━━━━━━━`,
    `⏰ ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`,
  ].filter(Boolean).join("\n");

  try {
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
    );
  } catch (err) {
    logger.error({ err }, "WhatsApp notification failed (non-blocking)");
  }
}

async function checkLowStock() {
  try {
    const lowStock = await db.select({ id: productsTable.id, name: productsTable.name, stock: productsTable.stock })
      .from(productsTable).where(lte(productsTable.stock, 3));

    if (lowStock.length === 0) return;

    const list = lowStock.map(p => {
      const dot = (p.stock ?? 0) === 0 ? "🔴 OUT" : (p.stock ?? 0) <= 1 ? "🔴" : "🟠";
      return `${dot} ${p.name}: ${p.stock} left`;
    }).join("\n");

    await tgSend(`🚨 <b>Low Stock Alert</b>\n\n${list}\n\n👉 Admin → Products to restock`);

    const phone = process.env.CALLMEBOT_PHONE;
    const apiKey = process.env.CALLMEBOT_APIKEY;
    if (phone && apiKey) {
      const waMsg = `🚨 *Low Stock Alert*\n${lowStock.map(p => `⚠️ ${p.name}: ${p.stock} left`).join("\n")}`;
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(waMsg)}&apikey=${apiKey}`)
        .catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "Low stock notification failed (non-blocking)");
  }
}

function generateOrderNumber(): string {
  const date = new Date();
  const dateStr = date.getFullYear().toString().slice(2) +
    String(date.getMonth() + 1).padStart(2, "0") +
    String(date.getDate()).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `TN${dateStr}${random}`;
}

/**
 * After an order number is known, move each studio item's original uploads
 * from their staging path (`uploads/<uuid>`) into a per-order prefix
 * (`uploads/orders/<orderNumber>/<itemIdx>/<filename>`).
 *
 * Mutates `studioItems` in-place (updates `customNote` JSON with new paths).
 * All errors are swallowed — the move is best-effort and must not block the order.
 */
async function moveStudioOriginals(
  studioItems: any[],
  orderNumber: string,
): Promise<{ assetsMissing: boolean }> {
  let assetsMissing = false;
  for (let itemIdx = 0; itemIdx < studioItems.length; itemIdx++) {
    const item = studioItems[itemIdx];
    let note: any;
    try { note = JSON.parse(item.customNote ?? "{}"); } catch { continue; }
    if (!note?.studioDesign) continue;

    const assets: any[] = Array.isArray(note.originalAssets) ? note.originalAssets : [];
    if (assets.length === 0) continue;

    const updatedAssets: any[] = [];
    for (const asset of assets) {
      if (!asset?.objectPath) { updatedAssets.push(asset); continue; }
      try {
        const newPath = await orderStorageService.moveObjectToOrderPrefix(
          asset.objectPath,
          orderNumber,
          itemIdx,
          asset.filename || "original",
        );
        updatedAssets.push({ ...asset, objectPath: newPath });
      } catch (err) {
        logger.warn({ err, orderNumber, itemIdx, asset: asset.filename }, "moveStudioOriginals: failed to move asset — order will be flagged studio_assets_missing");
        updatedAssets.push({ ...asset, missing: true });
        assetsMissing = true;
      }
    }

    note.originalAssets = updatedAssets;
    note.originalAssetUrls = updatedAssets.map((a: any) => a.objectPath);
    item.customNote = JSON.stringify(note);
  }
  return { assetsMissing };
}

function mapOrder(o: any) {
  return {
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
    subtotal: parseFloat(o.subtotal ?? "0") || 0,
    shippingCost: parseFloat(o.shippingCost ?? "0") || 0,
    promoCode: o.promoCode || null,
    promoDiscount: o.promoDiscount ? parseFloat(o.promoDiscount) || 0 : 0,
    total: parseFloat(o.total ?? "0") || 0,
    notes: o.notes,
    studioAssetsMissing: !!o.studioAssetsMissing,
    utmSource: o.utmSource || null,
    utmMedium: o.utmMedium || null,
    utmCampaign: o.utmCampaign || null,
    courierName: (o as any).courierName || null,
    trackingNumber: (o as any).trackingNumber || null,
    trackingUrl: (o as any).trackingUrl || null,
    createdAt: o.createdAt?.toISOString(),
    updatedAt: o.updatedAt?.toISOString(),
  };
}

async function getOrderTimeline(orderId: number) {
  try {
    const logs = await db
      .select()
      .from(adminActivityLogsTable)
      .where(and(eq(adminActivityLogsTable.entity, "order"), eq(adminActivityLogsTable.entityId, String(orderId))))
      .orderBy(asc(adminActivityLogsTable.createdAt));

    const timeline = [];

    // Map creation
    const creationLog = logs.find((l) => l.action === "create");
    if (creationLog) {
      timeline.push({
        status: "pending",
        timestamp: creationLog.createdAt.toISOString(),
        note: "Order has been placed",
      });
    }

    // Map status updates
    for (const log of logs) {
      if (log.action === "update" && log.after && (log.after as any).status && (log.after as any).status !== (log.before as any)?.status) {
        timeline.push({
          status: (log.after as any).status,
          timestamp: log.createdAt.toISOString(),
          note: `Order status changed to ${(log.after as any).status}`,
        });
      }
    }

    // Deduplicate and sort
    const unique: Record<string, any> = {};
    timeline.forEach(t => {
      unique[`${t.status}_${t.timestamp}`] = t;
    });
    
    return Object.values(unique).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (err) {
    logger.error({ err, orderId }, "Failed to get order timeline");
    return [];
  }
}

router.get("/orders/my", async (req, res) => {
  try {
    const token = extractCustomerToken(req as any);
    if (!token) {
      res.status(401).json({ error: "unauthorized", message: "Not authenticated" });
      return;
    }
    const decoded = verifyCustomerToken(token);
    if (!decoded) {
      res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
      return;
    }
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.customerEmail, decoded.email.toLowerCase()))
      .orderBy(desc(ordersTable.createdAt));
    res.json({ orders: orders.map(mapOrder) });
  } catch (err) {
    req.log.error({ err }, "Failed to get customer orders");
    res.status(500).json({ error: "internal_error", message: "Failed to get orders" });
  }
});

router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const { status, search, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(ordersTable.status, status as string));
    if (search && typeof search === "string" && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(ordersTable.customerName, q),
          ilike(ordersTable.customerPhone, q),
          ilike(ordersTable.orderNumber, q),
          ilike(ordersTable.customerEmail, q),
        )!
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [orders, countResult] = await Promise.all([
      db.select().from(ordersTable).where(where).orderBy(desc(ordersTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    res.json({
      orders: orders.map(mapOrder),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    res.status(500).json({ error: "internal_error", message: "Failed to list orders" });
  }
});

router.post("/orders/track", async (req, res) => {
  try {
    const { orderNumber, email, phone } = req.body;
    if (!orderNumber) {
      res.status(400).json({ error: "validation_error", message: "orderNumber is required" });
      return;
    }
    // Accept email OR phone — at least one identifier must be provided
    const identifier = (email || "").trim().toLowerCase();
    const phoneClean = (phone || "").replace(/\D/g, "").slice(-10);
    if (!identifier && !phoneClean) {
      res.status(400).json({ error: "validation_error", message: "email or phone is required" });
      return;
    }
    // Try matching by orderNumber + email first, then fall back to phone
    let order: typeof ordersTable.$inferSelect | undefined;
    if (identifier) {
      [order] = await db.select().from(ordersTable).where(
        and(eq(ordersTable.orderNumber, orderNumber), eq(ordersTable.customerEmail, identifier))
      );
    }
    if (!order && phoneClean) {
      // Match by last 10 digits of stored phone
      const [byPhone] = await db.select().from(ordersTable).where(
        eq(ordersTable.orderNumber, orderNumber)
      );
      if (byPhone) {
        const storedPhone = (byPhone.customerPhone || "").replace(/\D/g, "").slice(-10);
        if (storedPhone === phoneClean) order = byPhone;
      }
    }
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found. Check your order number and contact details." });
      return;
    }
    const mapped = mapOrder(order);
    const timeline = await getOrderTimeline(order.id);
    res.json({ ...mapped, timeline });
  } catch (err) {
    req.log.error({ err }, "Failed to track order");
    res.status(500).json({ error: "internal_error", message: "Failed to track order" });
  }
});

router.get("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid order id" });
      return;
    }
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    res.status(500).json({ error: "internal_error", message: "Failed to get order" });
  }
});

async function sendAutoConfirmationMessage(order: {
  id: number;
  orderNumber: string;
  customerName: string;
  total: number;
  paymentMethod?: string | null;
  notes?: string | null;
}) {
  try {
    const firstName = order.customerName.split(" ")[0] || order.customerName;
    const total = Number(order.total) || 0;
    const isFullPayment = String(order.notes ?? "").includes("Payment plan: full payment");
    const dueNow = isFullPayment ? total : Math.ceil(total * 0.25);
    const remaining = Math.max(0, total - dueNow);
    const method = String(order.paymentMethod || "cod").toUpperCase();
    const paymentSummary = isFullPayment
      ? `${method}: full payment ৳${dueNow.toLocaleString("en-BD")}`
      : `${method}: 25% advance ৳${dueNow.toLocaleString("en-BD")}, remaining ৳${remaining.toLocaleString("en-BD")} on delivery`;
    const message = `🎉 ধন্যবাদ ${firstName}! আপনার অর্ডার #${order.orderNumber} সফলভাবে গ্রহণ করা হয়েছে।\n\nপেমেন্ট: ${paymentSummary}\nমোট: ৳${total.toLocaleString("en-BD")}\n\nআমরা শীঘ্রই আপনার অর্ডার প্রসেস করা শুরু করব। যেকোনো প্রশ্ন বা আপডেটের জন্য এখানে মেসেজ করুন। 🙏\n\n────────────────────\nThank you ${firstName}! Trynext Lifestyle received order #${order.orderNumber}.\nPayment: ${paymentSummary}\nOrder total: ৳${total.toLocaleString("en-BD")}\nWe will start processing it shortly. Feel free to message us here for any queries. 🛍️`;
    await db.execute(
      sql`INSERT INTO order_messages (order_id, sender_type, sender_name, message, read_by_admin)
          VALUES (${order.id}, 'admin', 'Trynext Lifestyle Team', ${message}, true)
          ON CONFLICT DO NOTHING`
    );
  } catch (err) {
    logger.warn({ err, orderId: order.id }, "sendAutoConfirmationMessage: failed to insert");
  }
}

router.post("/orders", async (req, res) => {
  try {
    // Zod validation — structured 400 with field-level error messages.
    const zodResult = OrderCreateSchema.safeParse(req.body ?? {});
    if (!zodResult.success) {
      res.status(400).json({
        error: "validation_error",
        message: zodResult.error.errors.map(e => e.message).join("; "),
      });
      return;
    }
    const body = zodResult.data;

    // Accept either combined customerName OR separate firstName+lastName
    const customerName: string = body.customerName?.trim() ||
      [body.firstName, body.lastName].filter(Boolean).join(" ").trim();
    if (!customerName) {
      res.status(400).json({ error: "validation_error", message: "Please fill in: Full name" });
      return;
    }
    const customerEmail: string | null | undefined = body.customerEmail;
    const customerPhone: string = body.customerPhone;
    const shippingAddress: string = body.shippingAddress;
    const shippingCity: string | null | undefined = body.shippingCity;
    const shippingDistrict: string | null | undefined = body.shippingDistrict;
    const paymentMethod: string = body.paymentMethod || "";
    const normalizedPaymentMethod = paymentMethod.trim().toLowerCase();
    if (!(SUPPORTED_PAYMENT_METHODS as readonly string[]).includes(normalizedPaymentMethod)) {
      res.status(400).json({ error: 'validation_error', message: 'Select a supported payment method: bKash, Nagad, uPay, bank transfer, card on delivery, or cash on delivery.' });
      return;
    }
    const { items, notes, promoCode, utmSource, utmMedium, utmCampaign } = body;
    const customerEmailLower = customerEmail ? customerEmail.toLowerCase().trim() : null;

    // Separate studio design items (productId: 0 + customNote.studioDesign === true)
    // and hamper items (productId: 0 + customNote.hamper) from regular catalog items.
    const parseNote = (item: any): any => {
      try { return JSON.parse(item.customNote ?? "{}"); } catch { return {}; }
    };
    const isStudioItem = (item: any): boolean => {
      if (Number(item.productId) !== 0) return false;
      return !!parseNote(item).studioDesign;
    };
    const isHamperItem = (item: any): boolean => {
      if (Number(item.productId) !== 0) return false;
      return !!parseNote(item).hamper;
    };

    const catalogItems = items.filter((i: any) => !isStudioItem(i) && !isHamperItem(i));
    const studioItems = items.filter((i: any) => isStudioItem(i));
    const hamperItems = items.filter((i: any) => isHamperItem(i));

    // Fetch studio prices from server-side settings (never trust client price)
    // Defaults must match buildSettings() in settings.ts
    // Custom Design Studio prices are business rules, not client-controlled values:
    // short-sleeve T-shirt ৳450 + ৳99 customization; general mug ৳449 + ৳99.
    let studioTshirtPrice = 549;
    let studioMugPrice = 548;
    let studioHoodiePrice = 1699;
    let studioLongsleevePrice = 1299;
    let studioCapPrice = 699;
    let studioWaterbottlePrice = 899;
    try {
      const allSettings = await db.select().from(settingsTable);
      const settingsMap = Object.fromEntries(allSettings.map((s: any) => [s.key, s.value]));
      // Do not apply legacy studioTshirtPrice/studioMugPrice settings here;
      // those values predate the current published base-plus-customization rules.
      // Other product studio prices remain admin-configurable below.

      if (settingsMap["studioHoodiePrice"] != null) studioHoodiePrice = parseFloat(settingsMap["studioHoodiePrice"]) || 1699;
      if (settingsMap["studioLongsleevePrice"] != null) studioLongsleevePrice = parseFloat(settingsMap["studioLongsleevePrice"]) || 1299;
      if (settingsMap["studioCapPrice"] != null) studioCapPrice = parseFloat(settingsMap["studioCapPrice"]) || 699;
      if (settingsMap["studioWaterbottlePrice"] != null) studioWaterbottlePrice = parseFloat(settingsMap["studioWaterbottlePrice"]) || 899;
    } catch (err) {
      logger.warn({ err, route: "POST /orders" }, "Failed to load studio prices from settings; using defaults");
    }

    const productIds = [...new Set(catalogItems.map((i: any) => Number(i.productId)))];

    // Single batched query for all product IDs (replaces N individual selects)
    const products = productIds.length > 0
      ? await db.select().from(productsTable).where(inArray(productsTable.id, productIds))
      : [];

    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const missingProduct = catalogItems.find((item: any) => !productMap[item.productId]);
    if (missingProduct) {
      res.status(400).json({
        error: "product_missing",
        message: `One of the products in your cart is no longer available. Please remove it and try again.`,
        productId: missingProduct.productId,
        productName: missingProduct.name || null,
      });
      return;
    }

    // Persist customer-uploaded design images instead of dropping base64 data URLs.
    // The old implementation kept only non-data URLs, which made custom photos
    // disappear permanently from admin order details after checkout. Data URLs
    // are converted to private object-storage paths; existing object paths are
    // normalized to the API's renderable `/api/storage/objects/...` form.
    function renderableObjectPath(value: string): string {
      if (value.startsWith("/objects/")) return `/api/storage${value}`;
      return value;
    }

    async function persistCustomImages(imgs: string[] | null | undefined): Promise<string[]> {
      if (!Array.isArray(imgs)) return [];
      const saved: string[] = [];
      for (const value of imgs) {
        if (typeof value !== "string" || !value.trim()) continue;
        if (value.startsWith("data:image/")) {
          try {
            const stored = await orderStorageService.saveMockupImage(value);
            if (stored) saved.push(stored);
            else logger.warn("persistCustomImages: rejected invalid or oversized data URL");
          } catch (err) {
            logger.warn({ err }, "persistCustomImages: failed to persist customer image");
          }
          continue;
        }
        saved.push(renderableObjectPath(value));
      }
      return saved;
    }

    // Convert a URL to a storable path: real object-storage paths are kept as-is;
    // data-URL thumbnails are saved to storage and replaced with the resulting path.
    // Returns null only for genuinely absent/invalid URLs.
    function sanitizeImageUrlSync(url: string | null | undefined): string | null {
      if (!url || typeof url !== "string") return null;
      if (url.startsWith("data:")) return null; // handled by async pass below
      return url;
    }

    // Async pre-pass: for studio items whose imageUrl is a data-URL (canvas mockup
    // thumbnail), upload the image to object storage so the admin panel can display it.
    // Failures are non-fatal — imageUrl falls back to null gracefully.
    const studioMockupUrls: (string | null)[] = await Promise.all(
      studioItems.map(async (item: any) => {
        const url: string | undefined = item.imageUrl;
        if (!url || typeof url !== "string") return null;
        if (!url.startsWith("data:")) return url; // already a real path
        try {
          const saved = await orderStorageService.saveMockupImage(url);
          return saved;
        } catch (err) {
          logger.warn({ err }, "saveMockupImage failed — imageUrl will be null for this item");
          return null;
        }
      })
    );

    const catalogCustomImages = await Promise.all(
      catalogItems.map((item: any) => persistCustomImages(item.customImages))
    );

    const catalogOrderItems = catalogItems.map((item: any, idx: number) => {
      const product = productMap[item.productId];
      const selectedVariant = Array.isArray(product.variants)
        ? product.variants.find((v: any) => v?.id === item.variantId && v.active !== false)
        : null;
      if (item.variantId && !selectedVariant) {
        throw new Error("VARIANT_INVALID");
      }
      const requestedQty = Math.max(1, Math.floor(Number(item.quantity)));
      if (selectedVariant && Number(selectedVariant.stock) < requestedQty) {
        throw new StockOutError(`${product.name} — ${selectedVariant.name}`, Number(selectedVariant.stock), requestedQty);
      }
      const basePrice = selectedVariant ? Number(selectedVariant.price) : (product.discountPrice ? parseFloat(product.discountPrice) : parseFloat(product.price));
      const hasCustomization = Boolean(item.customNote || (Array.isArray(item.customImages) && item.customImages.length > 0));
      const price = basePrice + (hasCustomization && selectedVariant ? Number(selectedVariant.customizationFee || 0) : 0);
      return {
        productId: item.productId,
        productName: product.name,
        productImage: product.imageUrl,
        quantity: requestedQty,
        size: item.size,
        color: item.color,
        variantId: item.variantId,
        variantName: selectedVariant?.name ?? item.variantName,
        price,
        customNote: item.customNote,
        customImages: catalogCustomImages[idx],
        imageUrl: sanitizeImageUrlSync(item.imageUrl),
        isStudio: false,
      };
    });

    const studioCustomImages = await Promise.all(
      studioItems.map((item: any) => persistCustomImages(item.customImages))
    );

    // Studio items: price is derived server-side from settings; client price is ignored
    const studioOrderItems = studioItems.map((item: any, idx: number) => {
      let note: any = {};
      try { note = JSON.parse(item.customNote ?? "{}"); } catch (err) { logger.warn({ err }, "Failed to parse customNote"); }
      // The cart keeps originals as top-level fields to avoid bloating the
      // compact customNote. Merge them back before moveStudioOriginals()
      // relocates the files into this order's durable storage prefix.
      if (Array.isArray(item.originalAssets) && item.originalAssets.length > 0) {
        note.originalAssets = item.originalAssets;
      }
      if (Array.isArray(item.originalAssetUrls) && item.originalAssetUrls.length > 0 && !Array.isArray(note.originalAssetUrls)) {
        note.originalAssetUrls = item.originalAssetUrls;
      }
      // Determine product type from the studio note to apply the correct price
      const productType = (note.product ?? "").toLowerCase();
      let serverPrice: number;
      let defaultName: string;
      if (productType.includes("mug")) {
        serverPrice = studioMugPrice; defaultName = "Custom Studio Mug";
      } else if (productType.includes("hoodie")) {
        serverPrice = studioHoodiePrice; defaultName = "Custom Studio Hoodie";
      } else if (productType.includes("longsleeve") || productType.includes("long sleeve") || productType.includes("long-sleeve")) {
        serverPrice = studioLongsleevePrice; defaultName = "Custom Studio Long-Sleeve";
      } else if (productType.includes("cap") || productType.includes("hat")) {
        serverPrice = studioCapPrice; defaultName = "Custom Studio Cap";
      } else if (productType.includes("bottle") || productType.includes("waterbottle")) {
        serverPrice = studioWaterbottlePrice; defaultName = "Custom Studio Water Bottle";
      } else {
        serverPrice = studioTshirtPrice; defaultName = "Custom Studio T-Shirt";
      }
      // Use the async-saved mockup URL (converts data-URL → object storage path)
      const savedImageUrl = studioMockupUrls[idx] ?? null;
      return {
        productId: 0,
        productName: item.name || defaultName,
        productImage: savedImageUrl,
        quantity: Math.max(1, Math.floor(Number(item.quantity))),
        size: item.size,
        color: item.color,
        price: serverPrice,
        customNote: JSON.stringify(note),
        customImages: studioCustomImages[idx],
        imageUrl: savedImageUrl,
        isStudio: true,
      };
    });

    // Hamper items: ALWAYS recompute price server-side. Never trust client.
    const hamperOrderItems: any[] = [];
    for (const item of hamperItems) {
      const note = parseNote(item);
      const h = note.hamper || {};
      let unitPrice = -1; // sentinel; must be set by curated or custom branch
      let hamperName = h.hamperName || item.name || "Gift Hamper";
      let hamperContents = Array.isArray(h.items) ? h.items : [];

      if (h.hamperId && !h.isCustom) {
        // Curated hamper — must exist and be active
        const [dbHamper] = await db
          .select()
          .from(hamperPackagesTable)
          .where(and(eq(hamperPackagesTable.id, h.hamperId), eq(hamperPackagesTable.active, true)));
        if (!dbHamper) {
          res.status(400).json({ error: "hamper_invalid", message: `Hamper ${h.hamperId} not available` });
          return;
        }
        unitPrice = dbHamper.discountPrice ? parseFloat(dbHamper.discountPrice) : parseFloat(dbHamper.basePrice);
        hamperName = dbHamper.name;
        hamperContents = (dbHamper.items as any[]) || hamperContents;
      } else if (h.isCustom) {
        // Custom hamper: recompute price server-side from real product prices.
        const productIds = hamperContents
          .map((it: any) => Number(it.productId))
          .filter((id: number) => Number.isFinite(id) && id > 0);
        if (productIds.length === 0) {
          res.status(400).json({ error: "hamper_invalid", message: "Custom hamper requires at least one product" });
          return;
        }
        const dbProducts = await db
          .select({ id: productsTable.id, price: productsTable.price, discountPrice: productsTable.discountPrice })
          .from(productsTable)
          .where(inArray(productsTable.id, productIds));
        const priceById = new Map<number, number>(dbProducts.map(p => [
          p.id,
          p.discountPrice ? parseFloat(p.discountPrice) : parseFloat(p.price),
        ]));
        const validConstituents: Array<{ productId: number; quantity: number }> = [];
        let raw = 0;
        for (const it of hamperContents) {
          const pid = Number(it.productId);
          const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
          const unit = priceById.get(pid);
          if (unit == null || !Number.isFinite(unit)) continue;
          raw += unit * qty;
          validConstituents.push({ productId: pid, quantity: qty });
        }
        if (validConstituents.length === 0 || raw <= 0) {
          res.status(400).json({ error: "hamper_invalid", message: "Custom hamper has no valid products" });
          return;
        }
        // 5% bundle discount, matches storefront builder
        unitPrice = Math.round(raw * 0.95);
        hamperName = "Custom Gift Hamper";
        (h as any).__constituents = validConstituents;
      } else {
        // Hamper line with neither valid curated id nor isCustom — reject.
        res.status(400).json({ error: "hamper_invalid", message: "Hamper line item missing required identifier" });
        return;
      }

      if (unitPrice < 0 || !Number.isFinite(unitPrice)) {
        res.status(400).json({ error: "hamper_invalid", message: "Hamper price could not be calculated" });
        return;
      }

      const lineQty = Math.max(1, Math.floor(Number(item.quantity)));
      const noteH: any = { ...h, items: hamperContents, hamperName };
      delete noteH.__constituents;
      hamperOrderItems.push({
        productId: 0,
        productName: hamperName,
        productImage: item.imageUrl || null,
        quantity: lineQty,
        price: unitPrice,
        customNote: JSON.stringify({ hamper: noteH }),
        customImages: [],
        isHamper: true,
        // For custom hampers we must decrement stock of each constituent product.
        constituentProducts: (h as any).__constituents
          ? ((h as any).__constituents as Array<{ productId: number; quantity: number }>).map(c => ({
              productId: c.productId,
              quantity: c.quantity * lineQty,
            }))
          : [],
      });
    }

    const orderItems = [...catalogOrderItems, ...studioOrderItems, ...hamperOrderItems];

    // Pre-generate the order number so we can compute per-order storage paths
    // before the DB transaction. The same value is passed directly to the insert
    // below — no second call to generateOrderNumber() is made.
    const preGeneratedOrderNumber = generateOrderNumber();

    // Move studio uploads to per-order bucket prefix (best-effort, non-blocking).
    // This runs BEFORE the DB transaction intentionally: doing it inside the
    // transaction would couple S3 calls to DB lock duration, which is worse.
    //
    // Orphan risk: if the order creation transaction fails after a successful
    // move, the relocated objects live under an order prefix that never becomes
    // a real order. This is accepted: the files are harmless dead storage (no
    // admin surface exposes them without a matching order record), and an S3/R2
    // lifecycle rule on `uploads/orders/` can purge unreferenced prefixes after
    // N days. For a future improvement, consider a post-commit move that reads
    // the committed orderNumber and patches items JSONB in a second UPDATE.
    let studioAssetsMissing = false;
    if (studioOrderItems.length > 0) {
      const moveResult = await moveStudioOriginals(studioOrderItems, preGeneratedOrderNumber);
      studioAssetsMissing = moveResult.assetsMissing;
    }

    const subtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    // Shipping config is admin-controlled via the settings table.
    // Defaults match the buildSettings() function in settings.ts so that
    // orders placed before the admin customises these values are still correct.
    let freeThreshold = 1500; // ৳1,500 free-shipping threshold (default)
    let shipCost = 100;       // ৳100 flat shipping fee (default)
    try {
      const settings = await db.select().from(settingsTable);
      const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
      if (settingsMap["freeShippingThreshold"] != null) freeThreshold = Number(settingsMap["freeShippingThreshold"]) || 1500;
      if (settingsMap["shippingCost"] != null) shipCost = Number(settingsMap["shippingCost"]) || 100;
    } catch (err) {
      logger.warn({ err, route: "POST /orders" }, "Failed to load shipping settings — using defaults (৳100 / ৳1500 threshold)");
    }
    const shippingCost = freeThreshold > 0 && subtotal >= freeThreshold ? 0 : shipCost;

    const wantsPromo = promoCode && typeof promoCode === "string" && promoCode.trim().length > 0;
    const promoCodeNormalized = wantsPromo ? promoCode.trim().toUpperCase() : null;

    const order = await db.transaction(async (tx) => {
      for (const item of orderItems) {
        // Studio items have no catalog product — skip
        if ((item as any).isStudio) continue;

        // Custom hampers: validate + decrement stock of each constituent product
        if ((item as any).isHamper) {
          const constituents = ((item as any).constituentProducts || []) as Array<{ productId: number; quantity: number }>;
          for (const c of constituents) {
            const [prod] = await tx.select({ stock: productsTable.stock, name: productsTable.name }).from(productsTable).where(eq(productsTable.id, c.productId));
            if (!prod) {
              throw new ProductMissingError(`Hamper item #${c.productId}`);
            }
            if (prod.stock < c.quantity) {
              throw new StockOutError(`${prod.name} (in hamper)`, prod.stock, c.quantity);
            }
            await tx.update(productsTable).set({ stock: prod.stock - c.quantity }).where(eq(productsTable.id, c.productId));
          }
          continue;
        }

        const [prod] = await tx.select({ stock: productsTable.stock, variants: productsTable.variants }).from(productsTable).where(eq(productsTable.id, item.productId));
        if (!prod) {
          throw new ProductMissingError(item.productName);
        }
        if (prod.stock < item.quantity) {
          throw new StockOutError(item.productName, prod.stock, item.quantity);
        }
        const variantId = (item as any).variantId as string | null | undefined;
        let nextVariants: any[] | undefined;
        if (variantId) {
          const variants = Array.isArray(prod.variants) ? [...(prod.variants as any[])] : [];
          const index = variants.findIndex((v: any) => v?.id === variantId && v.active !== false);
          if (index < 0 || Number(variants[index].stock) < item.quantity) {
            throw new StockOutError(`${item.productName} — selected variant`, index < 0 ? 0 : Number(variants[index].stock || 0), item.quantity);
          }
          nextVariants = variants;
          nextVariants[index] = { ...variants[index], stock: Number(variants[index].stock) - item.quantity };
        }
        await tx.update(productsTable).set({
          stock: sql`${productsTable.stock} - ${item.quantity}`,
          ...(nextVariants ? { variants: nextVariants } : {}),
        }).where(eq(productsTable.id, item.productId));
      }

      let validatedPromoCode: string | null = null;
      let validatedPromoDiscount = 0;

      // Apply virtual spin-wheel promos before consulting DB
      let virtualFreeShipping = false;
      if (promoCodeNormalized) {
        const virtual = getVirtualPromo(promoCodeNormalized);
        if (virtual) {
          if (virtual.minOrderAmount && subtotal < virtual.minOrderAmount) {
            throw new Error("PROMO_INVALID");
          }
          // Virtual spin codes are not stored in promoCodesTable, so enforce
          // one redeemed spin reward per customer identity from order history.
          // This prevents creating multiple guest sessions to reuse rewards.
          const priorSpinUse = await tx
            .select({ id: ordersTable.id })
            .from(ordersTable)
            .where(and(
              or(
                ilike(ordersTable.promoCode, "SPIN%"),
                eq(ordersTable.promoCode, "FREEDELIV"),
                eq(ordersTable.promoCode, "SUPERDEAL"),
              ),
              or(
                eq(ordersTable.customerPhone, customerPhone),
                ...(customerEmailLower ? [eq(ordersTable.customerEmail, customerEmailLower)] : []),
              ),
            ))
            .limit(1);
          if (priorSpinUse.length > 0) {
            throw new Error("PROMO_ALREADY_USED");
          }
          const { discount, freeShipping } = calcVirtualDiscount(virtual, subtotal, shippingCost);
          validatedPromoCode = virtual.code;
          validatedPromoDiscount = discount;
          virtualFreeShipping = freeShipping;
        }
      }
      if (promoCodeNormalized && !validatedPromoCode) {
        const [promo] = await tx
          .select()
          .from(promoCodesTable)
          .where(eq(promoCodesTable.code, promoCodeNormalized));

        if (promo) {
          if (
            !promo.active ||
            (promo.expiresAt && new Date(promo.expiresAt) <= new Date()) ||
            (promo.maxUses && promo.maxUses > 0 && (promo.usedCount ?? 0) >= promo.maxUses) ||
            (promo.minOrderAmount && subtotal < parseFloat(promo.minOrderAmount))
          ) {
            throw new Error("PROMO_INVALID");
          }

          await tx
            .update(promoCodesTable)
            .set({ usedCount: sql`COALESCE(${promoCodesTable.usedCount}, 0) + 1` })
            .where(eq(promoCodesTable.id, promo.id));

          validatedPromoCode = promo.code;
          if (promo.discountType === "percentage") {
            validatedPromoDiscount = Math.round(subtotal * parseFloat(promo.discountValue) / 100);
          } else {
            validatedPromoDiscount = parseFloat(promo.discountValue);
          }
        } else {
          const [referral] = await tx
            .select()
            .from(referralsTable)
            .where(eq(referralsTable.referralCode, promoCodeNormalized));

          if (
            !referral ||
            !referral.active
          ) {
            throw new Error("PROMO_INVALID");
          }

          if (customerEmailLower && referral.ownerEmail && customerEmailLower === referral.ownerEmail.toLowerCase().trim()) {
            throw new Error("SELF_REFERRAL");
          }

          const discountPct = 10;
          validatedPromoDiscount = Math.round(subtotal * discountPct / 100);
          validatedPromoCode = referral.referralCode;

          await tx
            .update(referralsTable)
            .set({
              usedCount: sql`COALESCE(used_count, 0) + 1`,
              totalEarnings: sql`COALESCE(total_earnings, 0) + ${Math.round(subtotal * 0.10)}`,
            })
            .where(eq(referralsTable.referralCode, referral.referralCode));
        }

        validatedPromoDiscount = Math.min(validatedPromoDiscount, subtotal + shippingCost);
      }

      const effectiveShipping = virtualFreeShipping ? 0 : shippingCost;
      const total = Math.max(0, subtotal + effectiveShipping - validatedPromoDiscount);

      const [created] = await tx.insert(ordersTable).values({
        orderNumber: preGeneratedOrderNumber,
        customerName,
        customerEmail: customerEmail ?? "",
        customerPhone,
        shippingAddress,
        shippingCity: shippingCity ?? null,
        shippingDistrict: shippingDistrict ?? null,
           paymentMethod: normalizedPaymentMethod,
        items: orderItems,
        subtotal: subtotal.toString(),
        shippingCost: shippingCost.toString(),
        promoCode: validatedPromoCode,
        promoDiscount: validatedPromoDiscount > 0 ? validatedPromoDiscount.toString() : null,
        total: total.toString(),
        notes,
        studioAssetsMissing,
      }).returning();
      return created;
    });

    const mapped = mapOrder(order);
    res.status(201).json(mapped);

    sendWhatsAppNotification(mapped).catch((err) => logger.warn({ err }, "WhatsApp notification failed (fire-and-forget)"));
    sendTelegramNotification(mapped).catch((err) => logger.warn({ err }, "Telegram notification failed (fire-and-forget)"));
    sendOrderConfirmationEmail(mapped).catch((err) => logger.warn({ err }, "Order confirmation email failed (fire-and-forget)"));
    sendAutoConfirmationMessage({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName,
      total: Number(mapped.total),
      paymentMethod: mapped.paymentMethod,
      notes: mapped.notes,
    }).catch((err) => logger.warn({ err }, "Auto confirmation message failed (fire-and-forget)"));
    checkLowStock().catch((err) => logger.warn({ err }, "checkLowStock failed (fire-and-forget)"));
    checkRevenueMilestone().catch((err) => logger.warn({ err }, "checkRevenueMilestone failed (fire-and-forget)"));
    sendMetaCAPIEvent({
      eventName: "Purchase",
      orderId: mapped.orderNumber,
      total: mapped.total,
      currency: "BDT",
      items: (mapped.items || []).map((i: any) => ({
        id: i.productId,
        name: i.productName,
        price: i.price,
        quantity: i.quantity,
      })),
      email: mapped.customerEmail,
      phone: mapped.customerPhone,
    }).catch((err) => logger.warn({ err }, "Meta CAPI event failed (fire-and-forget)"));
  } catch (err: any) {
    if (err?.message === "PROMO_INVALID") {
      res.status(400).json({ error: "promo_invalid", message: "Promo code is invalid, expired, or has reached its usage limit" });
      return;
    }
    if (err?.message === "SELF_REFERRAL") {
      res.status(400).json({ error: "self_referral", message: "You cannot use your own referral code" });
      return;
    }
    if (err instanceof StockOutError) {
      res.status(409).json({
        error: "stock_out",
        message: `Sorry, "${err.productName}" only has ${err.available} in stock — you requested ${err.requested}. Please reduce the quantity or remove this item.`,
        productName: err.productName,
        available: err.available,
        requested: err.requested,
      });
      return;
    }
    if (err instanceof ProductMissingError) {
      res.status(400).json({
        error: "product_missing",
        message: `"${err.productName}" is no longer available. Please remove it from your cart.`,
        productName: err.productName,
      });
      return;
    }
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "internal_error", message: "Something went wrong on our end. Please try again, or contact us on WhatsApp if the issue persists." });
  }
});

async function createCustomerNotification(customerId: number | null | undefined, title: string, message: string, type: string = "general", link?: string) {
  if (!customerId) return;
  try {
    await db.insert(notificationsTable).values({
      customerId,
      title,
      message,
      type,
      link,
    });
  } catch (err) {
    logger.error({ err, customerId }, "Failed to create customer notification");
  }
}

const STATUS_EMOJIS: Record<string, string> = {
  pending:    "⏳",
  confirmed:  "✅",
  processing: "⚙️",
  ongoing:    "🔄",
  shipped:    "🚚",
  delivered:  "📦",
  cancelled:  "❌",
};

const PAYMENT_EMOJIS: Record<string, string> = {
  pending:   "⏳",
  submitted: "📤",
  verified:  "✅",
  paid:      "💚",
  cod:       "💵",
  failed:    "❌",
  refunded:  "↩️",
  wrong:     "⚠️",
  not_paid:  "🚫",
};

async function sendStatusUpdateNotification(orderData: any, newStatus: string) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apiKey) return;

  const emoji = STATUS_EMOJIS[newStatus] || "📋";
  const message = [
    `${emoji} *Order Status Updated*`,
    `📝 #${orderData.orderNumber}`,
    `👤 ${orderData.customerName}`,
    `📱 ${orderData.customerPhone}`,
    `📊 Status: *${newStatus.toUpperCase()}*`,
    `💰 Total: ৳${orderData.total}`,
  ].join("\n");

  try {
    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
    );
  } catch (err) {
    logger.error({ err }, "Status update WhatsApp notification failed (non-blocking)");
  }
}

async function sendTelegramStatusUpdate(orderData: any, newStatus: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getEffectiveChatId();
  if (!botToken || !chatId) return;

  const emoji = STATUS_EMOJIS[newStatus] || "📋";
  const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

  const message = [
    `${emoji} <b>Order Status → ${statusLabel}</b>`,
    ``,
    `📝 <b>Order:</b> #${orderData.orderNumber}`,
    `👤 <b>Customer:</b> ${orderData.customerName}`,
    `📞 <b>Phone:</b> ${orderData.customerPhone}`,
    `📍 <b>District:</b> ${orderData.shippingDistrict || 'N/A'}`,
    `💰 <b>Total:</b> ৳${orderData.total}`,
    `💳 <b>Payment:</b> ${(orderData.paymentMethod || 'COD').toUpperCase()}`,
    ``,
    `⏰ ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err }, "Telegram status update notification failed (non-blocking)");
  }
}

async function sendTelegramPaymentStatusUpdate(orderData: any, newPaymentStatus: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = getEffectiveChatId();
  if (!botToken || !chatId) return;

  // Only notify for meaningful payment status changes
  const notifyOn = ["submitted", "verified", "paid", "failed", "refunded", "wrong"];
  if (!notifyOn.includes(newPaymentStatus)) return;

  const emoji = PAYMENT_EMOJIS[newPaymentStatus] || "💳";
  const statusLabel = newPaymentStatus.charAt(0).toUpperCase() + newPaymentStatus.slice(1);

  const message = [
    `${emoji} <b>Payment → ${statusLabel}</b>`,
    ``,
    `📝 <b>Order:</b> #${orderData.orderNumber}`,
    `👤 <b>Customer:</b> ${orderData.customerName}`,
    `📞 <b>Phone:</b> ${orderData.customerPhone}`,
    `💰 <b>Total:</b> ৳${orderData.total}`,
    `💳 <b>Method:</b> ${(orderData.paymentMethod || 'COD').toUpperCase()}`,
    ``,
    `⏰ ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}`,
  ].join("\n");

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    logger.error({ err }, "Telegram payment status notification failed (non-blocking)");
  }
}

const updateOrderStatusHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid order id" });
      return;
    }
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "validation_error", message: "status is required" });
      return;
    }
    const transition = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id));
      const [after] = await tx.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
      if (!after) return { before: before ?? null, order: null, entitlement: "none" as const };
      const entitlement = await syncOrderEntitlement(tx, before as any, after as any);
      return { before: before ?? null, order: after, entitlement };
    });
    const beforeSnap = transition.before;
    const order = transition.order;
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    const mapped = mapOrder(order);
    logActivity({ action: "update", entity: "order", entityId: id, entityName: order.orderNumber, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: order as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json(mapped);

    sendStatusUpdateNotification(mapped, status).catch((err) => logger.warn({ err }, "sendStatusUpdateNotification failed (fire-and-forget)"));
    sendTelegramStatusUpdate(mapped, status).catch((err) => logger.warn({ err }, "Telegram status update failed (fire-and-forget)"));
    sendStatusUpdateEmail(mapped, status).catch((err) => logger.warn({ err }, "Status update email failed (fire-and-forget)"));

    if (order.customerId && beforeSnap?.status !== status) {
      const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
      createCustomerNotification(
        order.customerId,
        `Order ${statusLabel}: #${order.orderNumber}`,
        `Your order #${order.orderNumber} is now ${statusLabel.toLowerCase()}. Tap to view details.`,
        "order_status",
        `/account?order=${order.orderNumber}`
      ).catch((err) => logger.warn({ err }, "Failed to create customer notification (fire-and-forget)"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "internal_error", message: "Failed to update order status" });
  }
};
router.put("/orders/:id/status", requireAdmin, updateOrderStatusHandler);
router.patch("/orders/:id/status", requireAdmin, updateOrderStatusHandler);

const updatePaymentStatusHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid order id" });
      return;
    }
    const { paymentStatus } = req.body;
    const allowedPaymentStatuses = new Set(["pending", "not_paid", "submitted", "verified", "paid", "wrong", "refunded"]);
    if (typeof paymentStatus !== "string" || !allowedPaymentStatuses.has(paymentStatus)) {
      res.status(400).json({ error: "validation_error", message: "paymentStatus must be pending, not_paid, submitted, verified, paid, wrong, or refunded" });
      return;
    }
    const transition = await db.transaction(async (tx) => {
      const [before] = await tx.select().from(ordersTable).where(eq(ordersTable.id, id));
      const [after] = await tx.update(ordersTable).set({ paymentStatus, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
      if (!after) return { before: before ?? null, order: null, entitlement: "none" as const };
      const entitlement = await syncOrderEntitlement(tx, before as any, after as any);
      return { before: before ?? null, order: after, entitlement };
    });
    const beforeSnap = transition.before;
    const order = transition.order;
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    const mappedPayment = mapOrder(order);
    logActivity({ action: "update", entity: "order", entityId: id, entityName: order.orderNumber, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: order as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json(mappedPayment);

    sendTelegramPaymentStatusUpdate(mappedPayment, paymentStatus).catch((err) => logger.warn({ err }, "Telegram payment status update failed (fire-and-forget)"));

    if (order.customerId && beforeSnap?.paymentStatus !== paymentStatus) {
      const pStatusLabel = paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1);
      createCustomerNotification(
        order.customerId,
        `Payment Update: #${order.orderNumber}`,
        `Your payment for order #${order.orderNumber} is now ${pStatusLabel.toLowerCase()}. Tap to view details.`,
        "payment_status",
        `/account?order=${order.orderNumber}`
      ).catch((err) => logger.warn({ err }, "Failed to create customer notification (fire-and-forget)"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update payment status");
    res.status(500).json({ error: "internal_error", message: "Failed to update payment status" });
  }
};
router.put("/orders/:id/payment-status", requireAdmin, updatePaymentStatusHandler);
router.patch("/orders/:id/payment-status", requireAdmin, updatePaymentStatusHandler);

router.put("/orders/:id/payment-info", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid order id" });
      return;
    }
    const [existingOrder] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existingOrder) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }

    const suppliedEmail = normalizeContactEmail(req.body?.customerEmail);
    const suppliedPhone = normalizeBangladeshPhone(req.body?.customerPhone);
    const customerToken = extractCustomerToken(req);
    const customer = customerToken ? verifyCustomerToken(customerToken) : null;
    const tokenAuthorized = Boolean(
      customer && (
        (existingOrder.customerId != null && String(existingOrder.customerId) === String(customer.id)) ||
        (normalizeContactEmail(existingOrder.customerEmail) &&
          normalizeContactEmail(existingOrder.customerEmail) === normalizeContactEmail(customer.email))
      ),
    );
    const contactAuthorized = Boolean(
      (suppliedEmail && normalizeContactEmail(existingOrder.customerEmail) === suppliedEmail) ||
      (suppliedPhone && normalizeBangladeshPhone(existingOrder.customerPhone) === suppliedPhone),
    );
    if (!tokenAuthorized && !contactAuthorized) {
      res.status(403).json({
        error: "forbidden",
        message: "Order contact verification is required before submitting payment evidence.",
      });
      return;
    }

    const rawPaymentMethod = String(req.body?.paymentMethod ?? existingOrder.paymentMethod ?? "").trim().toLowerCase();
    if (req.body?.paymentMethod && rawPaymentMethod !== String(existingOrder.paymentMethod ?? "").toLowerCase()) {
      res.status(400).json({ error: "validation_error", message: "Payment method does not match this order." });
      return;
    }
    const rawLastFour = String(req.body?.lastFourDigits ?? "").replace(/\D/g, "").slice(0, 4);
    const submittedPaymentProof = String(req.body?.paymentProofUrl ?? "").trim().slice(0, 1000);
    if (submittedPaymentProof && !normalizePaymentProofPath(submittedPaymentProof)) {
      res.status(400).json({
        error: "validation_error",
        message: "Payment proof must be an uploaded Trynext storage object.",
      });
      return;
    }
    const rawPaymentProofUrl = normalizePaymentProofPath(submittedPaymentProof) ?? "";
    const rawSenderName = String(req.body?.senderName ?? "").replace(/[^a-zA-Z0-9.\- ]/gi, "").slice(0, 100);
    const rawBankReference = String(req.body?.bankReference ?? "").replace(/[^a-zA-Z0-9\-]/gi, "").slice(0, 100);
    const rawSenderNumber = normalizeBangladeshPhone(req.body?.senderNumber);
    const rawPromo = String(req.body?.promoCode ?? "").replace(/[^A-Z0-9_\-]/gi, "").toUpperCase().slice(0, 50);
    const walletMethod = ["bkash", "nagad", "upay"].includes(rawPaymentMethod);

    if (walletMethod) {
      if (rawLastFour.length !== 4) {
        res.status(400).json({ error: "validation_error", message: "Enter the last 4 digits of your sending wallet number." });
        return;
      }
      if (rawSenderNumber && !isValidBangladeshPhone(rawSenderNumber)) {
        res.status(400).json({ error: "validation_error", message: "Enter a valid Bangladesh mobile number used to send the payment." });
        return;
      }
    }
    if (rawPaymentMethod === "bank") {
      if (rawSenderName.trim().length < 2) {
        res.status(400).json({ error: "validation_error", message: "Enter the sender name used for the bank transfer." });
        return;
      }
      if (rawBankReference.trim().length < 4) {
        res.status(400).json({ error: "validation_error", message: "Enter the bank transfer reference number." });
        return;
      }
    }

    const evidence = [
      rawPaymentMethod ? `Wallet/payment method: ${rawPaymentMethod}` : null,
      rawLastFour ? `Payment last 4 digits: ${rawLastFour}` : null,
      rawPaymentProofUrl ? `Payment proof: ${rawPaymentProofUrl}` : null,
      rawSenderName ? `Sender name: ${rawSenderName}` : null,
      rawBankReference ? `Bank reference: ${rawBankReference}` : null,
      rawPromo ? `Promo code: ${rawPromo}` : null,
    ].filter(Boolean).join(" | ");
    const evidencePrefixes = [
      "Wallet/payment method:",
      "Payment last 4 digits:",
      "Payment proof:",
      "Sender name:",
      "Bank reference:",
      "Promo code:",
    ];
    const existingNotes = String(existingOrder.notes ?? "")
      .split(" | ")
      .filter((part) => !evidencePrefixes.some((prefix) => part.startsWith(prefix)));
    const notes = [...existingNotes, evidence].filter(Boolean).join(" | ");

    // A retry after a successful request must be safe: return the current order
    // rather than appending a second copy of the same evidence or creating a
    // second notification.
    if (existingOrder.paymentStatus === "submitted" && String(existingOrder.notes ?? "") === notes) {
      res.json(mapOrder(existingOrder));
      return;
    }

    const [order] = await db.update(ordersTable)
      .set({ paymentStatus: "submitted", ...(notes ? { notes } : {}), updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(mapOrder(order));
    if (order.customerId && existingOrder.paymentStatus !== "submitted") {
      createCustomerNotification(
        order.customerId,
        `Payment Submitted: #${order.orderNumber}`,
        `${rawPaymentProofUrl ? "We received your payment details and screenshot" : "We received your payment details"} for order #${order.orderNumber}. Our team will verify them shortly. Tap to view details.`,
        "payment_status",
        `/account?order=${order.orderNumber}`
      ).catch((err) => logger.warn({ err }, "Failed to create payment-submitted notification (fire-and-forget)"));
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update payment info");
    res.status(500).json({ error: "internal_error", message: "Failed to update payment info" });
  }
});

export default router;
