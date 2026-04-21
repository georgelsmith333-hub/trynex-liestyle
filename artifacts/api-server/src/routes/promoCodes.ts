import { Router, type IRouter } from "express";
import { db, promoCodesTable, referralsTable, settingsTable } from "@workspace/db";
import { eq, sql, and, gt, or, isNull } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { getVirtualPromo, calcVirtualDiscount } from "../lib/spinPromos";

// Simple in-memory IP rate limiter for exit-intent endpoint: 1 code per IP per 10 minutes
const exitIntentCooldowns = new Map<string, number>();
const EXIT_INTENT_COOLDOWN_MS = 10 * 60 * 1000;
function isExitIntentRateLimited(ip: string): boolean {
  const last = exitIntentCooldowns.get(ip);
  if (last && Date.now() - last < EXIT_INTENT_COOLDOWN_MS) return true;
  exitIntentCooldowns.set(ip, Date.now());
  // Prune old entries periodically to avoid unbounded growth
  if (exitIntentCooldowns.size > 5000) {
    const cutoff = Date.now() - EXIT_INTENT_COOLDOWN_MS;
    for (const [k, v] of exitIntentCooldowns) { if (v < cutoff) exitIntentCooldowns.delete(k); }
  }
  return false;
}

const router: IRouter = Router();

router.get("/promo-codes", requireAdmin, async (req, res) => {
  try {
    const codes = await db.select().from(promoCodesTable).orderBy(promoCodesTable.createdAt);
    res.json({ promoCodes: codes });
  } catch (err) {
    req.log.error({ err }, "Failed to list promo codes");
    res.status(500).json({ error: "internal_error", message: "Failed to list promo codes" });
  }
});

router.post("/promo-codes", requireAdmin, async (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderAmount, maxUses, expiresAt } = req.body;
    if (!code || !discountValue) {
      res.status(400).json({ error: "validation_error", message: "code and discountValue required" });
      return;
    }
    const [promo] = await db.insert(promoCodesTable).values({
      code: code.toUpperCase().trim(),
      discountType: discountType || "percentage",
      discountValue: String(discountValue),
      minOrderAmount: minOrderAmount ? String(minOrderAmount) : "0",
      maxUses: maxUses || 0,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.status(201).json(promo);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "duplicate", message: "Promo code already exists" });
      return;
    }
    req.log.error({ err }, "Failed to create promo code");
    res.status(500).json({ error: "internal_error", message: "Failed to create promo code" });
  }
});

router.post("/promo-codes/validate", async (req, res) => {
  try {
    const { code, orderTotal, customerEmail } = req.body;
    if (!code) {
      res.status(400).json({ error: "validation_error", message: "code is required" });
      return;
    }

    // Virtual spin-wheel promos always validate (no DB seed required)
    const virtual = getVirtualPromo(code);
    if (virtual) {
      const subtotal = Number(orderTotal) || 0;
      if (virtual.minOrderAmount && subtotal < virtual.minOrderAmount) {
        res.status(400).json({ error: "min_order", message: `Minimum order of ৳${virtual.minOrderAmount} required for this code` });
        return;
      }
      const { discount, freeShipping } = calcVirtualDiscount(virtual, subtotal, 0);
      res.json({
        valid: true,
        code: virtual.code,
        discountType: virtual.discountType,
        discountValue: virtual.discountValue,
        discount,
        freeShipping,
        message: virtual.message,
      });
      return;
    }

    const [promo] = await db.select().from(promoCodesTable)
      .where(eq(promoCodesTable.code, code.toUpperCase().trim()));

    if (!promo) {
      const [referral] = await db.select().from(referralsTable)
        .where(eq(referralsTable.referralCode, code.toUpperCase().trim()));

      if (referral && referral.active) {
        if (customerEmail && referral.ownerEmail && customerEmail.toLowerCase().trim() === referral.ownerEmail.toLowerCase().trim()) {
          res.status(400).json({ error: "self_referral", message: "You cannot use your own referral code" });
          return;
        }
        const discountPct = 10;
        const discount = Math.round((orderTotal || 0) * discountPct / 100);
        res.json({
          valid: true,
          code: referral.referralCode,
          discountType: "percentage",
          discountValue: discountPct,
          discount,
          isReferral: true,
          referralId: referral.id,
          message: `${discountPct}% referral discount applied!`,
        });
        return;
      }

      res.status(404).json({ error: "invalid_code", message: "This promo code is not valid" });
      return;
    }

    if (!promo.active) {
      res.status(400).json({ error: "inactive", message: "This promo code is no longer active" });
      return;
    }

    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
      res.status(400).json({ error: "expired", message: "This promo code has expired" });
      return;
    }

    if (promo.maxUses && promo.maxUses > 0 && (promo.usedCount || 0) >= promo.maxUses) {
      res.status(400).json({ error: "max_uses", message: "This promo code has reached its usage limit" });
      return;
    }

    const minOrder = parseFloat(promo.minOrderAmount || "0");
    if (orderTotal && orderTotal < minOrder) {
      res.status(400).json({ error: "min_order", message: `Minimum order of ৳${minOrder} required for this code` });
      return;
    }

    let discount = 0;
    if (promo.discountType === "percentage") {
      discount = Math.round((orderTotal || 0) * parseFloat(promo.discountValue) / 100);
    } else {
      discount = parseFloat(promo.discountValue);
    }

    res.json({
      valid: true,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: parseFloat(promo.discountValue),
      discount,
      message: promo.discountType === "percentage"
        ? `${promo.discountValue}% off applied!`
        : `৳${promo.discountValue} off applied!`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to validate promo code");
    res.status(500).json({ error: "internal_error", message: "Validation failed" });
  }
});

router.put("/promo-codes/:id/use", async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await db.update(promoCodesTable)
      .set({ usedCount: sql`COALESCE(used_count, 0) + 1` })
      .where(eq(promoCodesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to increment promo usage");
    res.status(500).json({ error: "internal_error", message: "Failed to update promo usage" });
  }
});

router.delete("/promo-codes/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await db.delete(promoCodesTable).where(eq(promoCodesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete promo code");
    res.status(500).json({ error: "internal_error", message: "Failed to delete promo code" });
  }
});

router.post("/promo-codes/exit-intent", async (req, res) => {
  try {
    const { contact } = req.body;
    if (!contact || typeof contact !== "string" || contact.trim().length < 3) {
      res.status(400).json({ error: "validation_error", message: "Contact (phone or email) is required" });
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    if (isExitIntentRateLimited(clientIp)) {
      res.status(429).json({ error: "rate_limited", message: "Please wait before requesting another promo code" });
      return;
    }

    const allSettings = await db.select().from(settingsTable);
    const map = Object.fromEntries(allSettings.map(s => [s.key, s.value]));

    const promoEnabled = (map["exitIntentPromoEnabled"] ?? "true") !== "false";
    const baseCode = (map["exitIntentPromoCode"] ?? "").trim().toUpperCase();
    const discountStr = (map["exitIntentPromoDiscount"] ?? "10%").trim();

    if (!promoEnabled || !baseCode) {
      res.status(404).json({ error: "not_available", message: "Exit-intent promo not configured" });
      return;
    }

    const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
    const singleUseCode = `${baseCode}${suffix}`;
    const discountValue = parseFloat(discountStr.replace("%", "")) || 10;

    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [promo] = await db.insert(promoCodesTable).values({
      code: singleUseCode,
      discountType: "percentage",
      discountValue: String(discountValue),
      minOrderAmount: "0",
      maxUses: 1,
      expiresAt: expiry,
    }).returning();

    res.status(201).json({
      code: promo.code,
      discount: discountStr,
      expiresAt: expiry.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to generate promo code" });
  }
});

export default router;
