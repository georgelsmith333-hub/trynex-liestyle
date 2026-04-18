import { Router, type IRouter } from "express";
import { db, referralsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

router.get("/referrals", requireAdmin, async (req, res) => {
  try {
    const referrals = await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt));
    res.json({ referrals });
  } catch (err) {
    req.log.error({ err }, "Failed to list referrals");
    res.status(500).json({ error: "internal_error", message: "Failed to list referrals" });
  }
});

router.post("/referrals", async (req, res) => {
  try {
    const { ownerName, ownerEmail, ownerPhone } = req.body;
    if (!ownerName || !ownerEmail) {
      res.status(400).json({ error: "validation_error", message: "Name and email are required" });
      return;
    }

    const existing = await db.select().from(referralsTable).where(eq(referralsTable.ownerEmail, ownerEmail));
    if (existing.length > 0) {
      res.json({ referral: existing[0], message: "You already have a referral code!" });
      return;
    }

    const code = "TRYNEX" + ownerName.replace(/\s+/g, "").toUpperCase().slice(0, 6) + Math.random().toString(36).slice(2, 5).toUpperCase();

    const [referral] = await db.insert(referralsTable).values({
      code,
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone || null,
      discountPercent: 10,
      maxUses: 0,
    }).returning();

    res.status(201).json({ referral, message: "Your referral code has been created!" });
  } catch (err) {
    req.log.error({ err }, "Failed to create referral");
    res.status(500).json({ error: "internal_error", message: "Failed to create referral" });
  }
});

router.get("/referrals/check/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.code, code));

    if (!referral || !referral.active) {
      res.status(404).json({ error: "invalid", message: "Invalid referral code" });
      return;
    }

    if (referral.maxUses && referral.maxUses > 0 && (referral.totalUses || 0) >= referral.maxUses) {
      res.status(400).json({ error: "max_uses", message: "This referral code has reached its limit" });
      return;
    }

    res.json({
      valid: true,
      code: referral.code,
      discountPercent: referral.discountPercent,
      ownerName: referral.ownerName,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to check referral");
    res.status(500).json({ error: "internal_error", message: "Failed to check referral" });
  }
});

router.put("/referrals/:code/use", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase().trim();
    const { orderTotal } = req.body;

    await db.update(referralsTable).set({
      totalUses: sql`COALESCE(total_uses, 0) + 1`,
      totalEarnings: sql`COALESCE(total_earnings, 0) + ${Math.round((orderTotal || 0) * 0.10)}`,
    }).where(eq(referralsTable.code, code));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to use referral");
    res.status(500).json({ error: "internal_error", message: "Failed to update referral usage" });
  }
});

router.get("/referrals/my/:email", async (req, res) => {
  try {
    const email = req.params.email.toLowerCase().trim();
    const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.ownerEmail, email));
    if (!referral) {
      res.json({ referral: null });
      return;
    }
    res.json({ referral });
  } catch (err) {
    req.log.error({ err }, "Failed to get referral by email");
    res.status(500).json({ error: "internal_error", message: "Failed" });
  }
});

router.delete("/referrals/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    await db.delete(referralsTable).where(eq(referralsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete referral");
    res.status(500).json({ error: "internal_error", message: "Failed to delete referral" });
  }
});

export default router;
