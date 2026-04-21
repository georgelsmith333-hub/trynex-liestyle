import { Router, type IRouter } from "express";
import { db, ordersTable, productsTable, settingsTable, promoCodesTable, referralsTable, hamperPackagesTable } from "@workspace/db";
import { eq, and, desc, sql, inArray, lte } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { verifyCustomerToken, extractCustomerToken } from "../lib/customerAuth";
import { logger } from "../lib/logger";
import { getVirtualPromo, calcVirtualDiscount } from "../lib/spinPromos";
import { ObjectStorageService } from "../lib/objectStorage";

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
migrateOrdersTable();

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

    const sha256 = (input: string): string => {
      const { createHash } = require("crypto");
      return createHash("sha256").update(input).digest("hex");
    };

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
        event_source_url: event.sourceUrl || "https://trynex.com.bd/checkout",
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

    await fetch(
      `https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${capiToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  } catch (err) {
    logger.error({ err }, "Meta CAPI event failed (non-blocking)");
  }
}

async function sendWhatsAppNotification(orderData: any) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apiKey) return;

  const itemsList = (orderData.items || [])
    .map((i: any) => `${i.productName} x${i.quantity}`)
    .join(", ");

  const advance = Math.ceil(orderData.total * 0.15);
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
    `💰 *Total:* ৳${orderData.total}`,
    `💳 *Payment:* ${orderData.paymentMethod?.toUpperCase()}`,
    `🏷️ *Advance (15%):* ৳${advance}`,
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
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apiKey) return;

  try {
    const lowStock = await db.select({ id: productsTable.id, name: productsTable.name, stock: productsTable.stock })
      .from(productsTable).where(lte(productsTable.stock, 3));

    if (lowStock.length === 0) return;

    const list = lowStock.map(p => `⚠️ ${p.name}: ${p.stock} left`).join("\n");
    const message = `🚨 *Low Stock Alert*\n${list}`;

    await fetch(
      `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`
    );
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
): Promise<void> {
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
        logger.warn({ err }, "moveStudioOriginals: failed to move asset (non-fatal)");
        updatedAssets.push(asset);
      }
    }

    note.originalAssets = updatedAssets;
    note.originalAssetUrls = updatedAssets.map((a: any) => a.objectPath);
    item.customNote = JSON.stringify(note);
  }
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
    utmSource: o.utmSource || null,
    utmMedium: o.utmMedium || null,
    utmCampaign: o.utmCampaign || null,
    createdAt: o.createdAt?.toISOString(),
    updatedAt: o.updatedAt?.toISOString(),
  };
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
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (status) conditions.push(eq(ordersTable.status, status as string));
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
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to track order");
    res.status(500).json({ error: "internal_error", message: "Failed to track order" });
  }
});

router.get("/orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
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

router.post("/orders", async (req, res) => {
  try {
    const body = req.body ?? {};
    // Accept either combined customerName OR separate firstName+lastName
    const customerName: string = body.customerName?.trim() ||
      [body.firstName, body.lastName].filter(Boolean).join(" ").trim();
    const customerEmail: string = body.customerEmail;
    const customerPhone: string = body.customerPhone;
    const shippingAddress: string = body.shippingAddress;
    const shippingCity: string = body.shippingCity;
    const shippingDistrict: string = body.shippingDistrict;
    // Default payment method to COD so missing/empty values don't block orders
    const paymentMethod: string = body.paymentMethod || "cod";
    const { items, notes, promoCode, utmSource, utmMedium, utmCampaign } = body;
    const customerEmailLower = customerEmail ? customerEmail.toLowerCase().trim() : null;

    const missing: string[] = [];
    if (!customerName) missing.push("Full name");
    if (!customerPhone) missing.push("Phone number");
    if (!shippingAddress) missing.push("Street address");
    if (!items?.length) missing.push("Cart items");
    if (missing.length > 0) {
      res.status(400).json({
        error: "validation_error",
        message: `Please fill in: ${missing.join(", ")}`,
      });
      return;
    }

    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) {
        res.status(400).json({ error: "validation_error", message: "Quantity must be a positive integer (1-100)" });
        return;
      }
      if (item.customImages && (!Array.isArray(item.customImages) || item.customImages.length > 10)) {
        res.status(400).json({ error: "validation_error", message: "Maximum 10 custom images per item" });
        return;
      }
    }

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
    let studioTshirtPrice = 1099;
    let studioMugPrice = 799;
    try {
      const allSettings = await db.select().from(settingsTable);
      const settingsMap = Object.fromEntries(allSettings.map((s: any) => [s.key, s.value]));
      if (settingsMap.studioTshirtPrice) studioTshirtPrice = parseFloat(settingsMap.studioTshirtPrice) || 1099;
      if (settingsMap.studioMugPrice) studioMugPrice = parseFloat(settingsMap.studioMugPrice) || 799;
    } catch (err) {
      logger.warn({ err, route: "POST /orders" }, "Failed to load studio prices from settings; using defaults");
    }

    const productIds = catalogItems.map((i: any) => Number(i.productId));

    const products = await Promise.all(
      productIds.map(async (id: number) => {
        const [p] = await db.select().from(productsTable).where(eq(productsTable.id, id));
        return p;
      })
    );

    // `products` may contain `undefined` slots for deleted product IDs — filter
     // those out before building the map, otherwise `p.id` throws and the
     // request 500s instead of returning a structured `product_missing` error.
    const productMap = Object.fromEntries(
      products.filter((p): p is NonNullable<typeof p> => !!p).map(p => [p.id, p])
    );

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

    const catalogOrderItems = catalogItems.map((item: any) => {
      const product = productMap[item.productId];
      const price = product.discountPrice ? parseFloat(product.discountPrice) : parseFloat(product.price);
      return {
        productId: item.productId,
        productName: product.name,
        productImage: product.imageUrl,
        quantity: Math.max(1, Math.floor(Number(item.quantity))),
        size: item.size,
        color: item.color,
        price,
        customNote: item.customNote,
        customImages: item.customImages || [],
        isStudio: false,
      };
    });

    // Studio items: price is derived server-side from settings; client price is ignored
    const studioOrderItems = studioItems.map((item: any) => {
      let note: any = {};
      try { note = JSON.parse(item.customNote ?? "{}"); } catch (err) { logger.warn({ err }, "Failed to parse customNote"); }
      // Determine product type from the studio note to apply the correct price
      const isMug = (note.product ?? "").toLowerCase().includes("mug");
      const serverPrice = isMug ? studioMugPrice : studioTshirtPrice;
      return {
        productId: 0,
        productName: item.name || (isMug ? "Custom Studio Mug" : "Custom Studio T-Shirt"),
        productImage: item.imageUrl || null,
        quantity: Math.max(1, Math.floor(Number(item.quantity))),
        size: item.size,
        color: item.color,
        price: serverPrice,
        customNote: item.customNote,
        customImages: item.customImages || [],
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
    if (studioOrderItems.length > 0) {
      await moveStudioOriginals(studioOrderItems, preGeneratedOrderNumber);
    }

    const subtotal = orderItems.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

    let freeThreshold = 1500;
    let shipCost = 100;
    try {
      const settings = await db.select().from(settingsTable);
      const settingsMap = Object.fromEntries(settings.map(s => [s.key, s.value]));
      if (settingsMap.freeShippingThreshold) freeThreshold = Number(settingsMap.freeShippingThreshold) || 1500;
      if (settingsMap.shippingCost) shipCost = Number(settingsMap.shippingCost) || 100;
    } catch (err) {
      logger.warn({ err, route: "POST /orders" }, "Failed to load shipping settings; using defaults");
    }
    const shippingCost = subtotal >= freeThreshold ? 0 : shipCost;

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

        const [prod] = await tx.select({ stock: productsTable.stock }).from(productsTable).where(eq(productsTable.id, item.productId));
        if (!prod) {
          throw new ProductMissingError(item.productName);
        }
        if (prod.stock < item.quantity) {
          throw new StockOutError(item.productName, prod.stock, item.quantity);
        }
        await tx.execute(
          sql`UPDATE products SET stock = stock - ${item.quantity} WHERE id = ${item.productId}`
        );
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
        customerEmail,
        customerPhone,
        shippingAddress,
        shippingCity,
        shippingDistrict,
        paymentMethod,
        items: orderItems,
        subtotal: subtotal.toString(),
        shippingCost: shippingCost.toString(),
        promoCode: validatedPromoCode,
        promoDiscount: validatedPromoDiscount > 0 ? validatedPromoDiscount.toString() : null,
        total: total.toString(),
        notes,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
      }).returning();
      return created;
    });

    const mapped = mapOrder(order);
    res.status(201).json(mapped);

    sendWhatsAppNotification(mapped).catch((err) => logger.warn({ err }, "WhatsApp notification failed (fire-and-forget)"));
    checkLowStock().catch((err) => logger.warn({ err }, "checkLowStock failed (fire-and-forget)"));
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

async function sendStatusUpdateNotification(orderData: any, newStatus: string) {
  const phone = process.env.CALLMEBOT_PHONE;
  const apiKey = process.env.CALLMEBOT_APIKEY;
  if (!phone || !apiKey) return;

  const statusEmojis: Record<string, string> = {
    processing: "⚙️",
    confirmed: "✅",
    shipped: "🚚",
    delivered: "📦",
    cancelled: "❌",
  };

  const emoji = statusEmojis[newStatus] || "📋";
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

router.put("/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { status } = req.body;
    if (!status) {
      res.status(400).json({ error: "validation_error", message: "status is required" });
      return;
    }
    const [order] = await db.update(ordersTable).set({ status, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    const mapped = mapOrder(order);
    res.json(mapped);

    sendStatusUpdateNotification(mapped, status).catch((err) => logger.warn({ err }, "sendStatusUpdateNotification failed (fire-and-forget)"));
  } catch (err) {
    req.log.error({ err }, "Failed to update order status");
    res.status(500).json({ error: "internal_error", message: "Failed to update order status" });
  }
});

router.put("/orders/:id/payment-status", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { paymentStatus } = req.body;
    if (!paymentStatus) {
      res.status(400).json({ error: "validation_error", message: "paymentStatus is required" });
      return;
    }
    const [order] = await db.update(ordersTable).set({ paymentStatus, updatedAt: new Date() }).where(eq(ordersTable.id, id)).returning();
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to update payment status");
    res.status(500).json({ error: "internal_error", message: "Failed to update payment status" });
  }
});

router.put("/orders/:id/payment-info", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { lastFourDigits, promoCode } = req.body;
    const notes = [
      lastFourDigits ? `Payment last 4 digits: ${lastFourDigits}` : null,
      promoCode ? `Promo code: ${promoCode}` : null,
    ].filter(Boolean).join(" | ");

    const [order] = await db.update(ordersTable)
      .set({ paymentStatus: "submitted", notes, updatedAt: new Date() })
      .where(eq(ordersTable.id, id))
      .returning();
    if (!order) {
      res.status(404).json({ error: "not_found", message: "Order not found" });
      return;
    }
    res.json(mapOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to update payment info");
    res.status(500).json({ error: "internal_error", message: "Failed to update payment info" });
  }
});

export default router;
