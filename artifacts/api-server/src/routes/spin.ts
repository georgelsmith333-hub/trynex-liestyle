import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { extractCustomerToken, verifyCustomerToken } from "../lib/customerAuth";
import { logger } from "../lib/logger";
import { assertIdempotencyKey, utcDateKey } from "../lib/spinContract";

const router: IRouter = Router();

const REWARDS = [
  { id: "miss1", label: "Better luck next time", code: null, weight: 28 },
  { id: "off5", label: "5% off your next order", code: "SPIN5", weight: 16 },
  { id: "miss2", label: "Better luck next time", code: null, weight: 28 },
  { id: "off10", label: "10% off your next order", code: "SPIN10", weight: 12 },
  { id: "freedeliv", label: "Free delivery on ৳1500+", code: "FREEDELIV", weight: 6 },
  { id: "off15", label: "15% off your next order", code: "SPIN15", weight: 6 },
  { id: "super", label: "SUPER DEAL: Free delivery + 10% off", code: "SUPERDEAL", weight: 4 },
] as const;

function requireCustomer(req: any, res: any, next: any): void {
  const token = extractCustomerToken(req);
  const customer = token ? verifyCustomerToken(token) : null;
  if (!customer) {
    res.status(401).json({ error: "unauthorized", message: "Sign in to use Spin & Win." });
    return;
  }
  req.customer = customer;
  next();
}

function pickReward() {
  const total = REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
  let cursor = Math.random() * total;
  for (const reward of REWARDS) {
    cursor -= reward.weight;
    if (cursor <= 0) return reward;
  }
  return REWARDS[0];
}

async function getWallet(subjectKey: string, customerId: number) {
  await db.execute(sql`
    INSERT INTO spin_wallets (subject_key, customer_id)
    VALUES (${subjectKey}, ${customerId})
    ON CONFLICT (subject_key) DO UPDATE SET updated_at = NOW()
  `);
  const result = await db.execute(sql`
    SELECT id, subject_key, customer_id, free_tickets, daily_spin_claimed_at
    FROM spin_wallets
    WHERE subject_key = ${subjectKey}
    FOR UPDATE
  `);
  return (result as any).rows?.[0] ?? null;
}

router.get("/spin/state", requireCustomer, async (req: any, res) => {
  try {
    const subjectKey = `customer:${req.customer.id}`;
    const result = await db.execute(sql`
      SELECT free_tickets, daily_spin_claimed_at
      FROM spin_wallets
      WHERE subject_key = ${subjectKey}
    `);
    const wallet = (result as any).rows?.[0] ?? null;
    const today = utcDateKey(new Date());
    const dailyClaimed = wallet?.daily_spin_claimed_at
      ? utcDateKey(new Date(wallet.daily_spin_claimed_at)) === today
      : false;
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ dailyAvailable: !dailyClaimed, ticketCount: Number(wallet?.free_tickets ?? 0) });
  } catch (err) {
    logger.error({ err }, "Failed to fetch Spin & Win state");
    res.status(503).json({ error: "unavailable", message: "Spin & Win is temporarily unavailable." });
  }
});

router.post("/spin/reserve", requireCustomer, async (req: any, res) => {
  let idempotencyKey: string;
  try {
    idempotencyKey = assertIdempotencyKey(req.body?.idempotencyKey);
  } catch (err) {
    res.status(400).json({ error: "validation_error", message: err instanceof Error ? err.message : "invalid_idempotency_key" });
    return;
  }

  const subjectKey = `customer:${req.customer.id}`;
  try {
    const result = await db.transaction(async (tx) => {
      const existingResult = await tx.execute(sql`
        SELECT id, entitlement_type, status, reward_code, reward_payload, created_at, settled_at
        FROM spin_plays
        WHERE idempotency_key = ${idempotencyKey} AND subject_key = ${subjectKey}
      `);
      const existing = (existingResult as any).rows?.[0];
      if (existing) return { play: existing, replay: true };

      const walletResult = await tx.execute(sql`
        INSERT INTO spin_wallets (subject_key, customer_id)
        VALUES (${subjectKey}, ${req.customer.id})
        ON CONFLICT (subject_key) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `);
      if (!(walletResult as any).rows?.[0]) throw new Error("wallet_unavailable");
      const lockedResult = await tx.execute(sql`
        SELECT free_tickets, daily_spin_claimed_at
        FROM spin_wallets
        WHERE subject_key = ${subjectKey}
        FOR UPDATE
      `);
      const wallet = (lockedResult as any).rows?.[0];
      if (!wallet) throw new Error("wallet_unavailable");

      const today = utcDateKey(new Date());
      const dailyClaimed = wallet.daily_spin_claimed_at
        ? utcDateKey(new Date(wallet.daily_spin_claimed_at)) === today
        : false;
      const entitlementType = !dailyClaimed ? "daily" : Number(wallet.free_tickets ?? 0) > 0 ? "ticket" : null;
      if (!entitlementType) throw new Error("no_spin_entitlement");

      if (entitlementType === "daily") {
        await tx.execute(sql`
          UPDATE spin_wallets
          SET daily_spin_claimed_at = NOW(), updated_at = NOW()
          WHERE subject_key = ${subjectKey}
        `);
      } else {
        await tx.execute(sql`
          UPDATE spin_wallets
          SET free_tickets = free_tickets - 1, updated_at = NOW()
          WHERE subject_key = ${subjectKey} AND free_tickets > 0
        `);
      }

      const reward = pickReward();
      const insertedResult = await tx.execute(sql`
        INSERT INTO spin_plays
          (subject_key, customer_id, idempotency_key, entitlement_type, status, reward_code, reward_payload)
        VALUES
          (${subjectKey}, ${req.customer.id}, ${idempotencyKey}, ${entitlementType}, 'reserved', ${reward.code}, ${JSON.stringify({ id: reward.id, label: reward.label })}::jsonb)
        RETURNING id, entitlement_type, status, reward_code, reward_payload, created_at, settled_at
      `);
      const play = (insertedResult as any).rows?.[0];
      if (!play) throw new Error("spin_reservation_failed");
      return { play, replay: false };
    });

    res.setHeader("Cache-Control", "private, no-store");
    res.status(result.replay ? 200 : 201).json({
      replay: result.replay,
      play: {
        id: Number(result.play.id),
        entitlementType: result.play.entitlement_type,
        status: result.play.status,
        rewardCode: result.play.reward_code,
        reward: result.play.reward_payload,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "spin_reservation_failed";
    if (message === "no_spin_entitlement") {
      res.status(409).json({ error: "not_eligible", message: "No Spin & Win entitlement is available." });
      return;
    }
    logger.error({ err }, "Failed to reserve Spin & Win play");
    res.status(503).json({ error: "unavailable", message: "Spin & Win is temporarily unavailable." });
  }
});

router.post("/spin/plays/:id/settle", requireCustomer, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      res.status(400).json({ error: "validation_error", message: "Invalid play id." });
      return;
    }
    const subjectKey = `customer:${req.customer.id}`;
    const result = await db.execute(sql`
      UPDATE spin_plays
      SET status = CASE WHEN status = 'reserved' THEN 'settled' ELSE status END,
          settled_at = CASE WHEN status = 'reserved' THEN NOW() ELSE settled_at END
      WHERE id = ${id} AND subject_key = ${subjectKey}
      RETURNING id, status, reward_code, reward_payload
    `);
    const play = (result as any).rows?.[0];
    if (!play) {
      res.status(404).json({ error: "not_found", message: "Spin play not found." });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.json({ play: { id: Number(play.id), status: play.status, rewardCode: play.reward_code, reward: play.reward_payload } });
  } catch (err) {
    logger.error({ err }, "Failed to settle Spin & Win play");
    res.status(503).json({ error: "unavailable", message: "Spin settlement is temporarily unavailable." });
  }
});

export default router;
