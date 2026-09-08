import { sql } from "drizzle-orm";
import {
  completedProductTicketGrant,
  isCompletedPurchase,
  purchaseGrantSourceKey,
  purchaseReversalSourceKey,
  type SpinOrderLike,
} from "./spinContract";

type Tx = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

type OrderSnapshot = SpinOrderLike & {
  customerId: number | null;
  orderNumber?: string;
};

async function walletSubject(tx: Tx, subjectKey: string, customerId: number): Promise<any> {
  await tx.execute(sql`
    INSERT INTO spin_wallets (subject_key, customer_id)
    VALUES (${subjectKey}, ${customerId})
    ON CONFLICT (subject_key) DO UPDATE SET updated_at = NOW()
  `);
  const result = await tx.execute(sql`
    SELECT id, free_tickets
    FROM spin_wallets
    WHERE subject_key = ${subjectKey}
    FOR UPDATE
  `);
  const wallet = (result as any).rows?.[0];
  if (!wallet) throw new Error("spin_wallet_unavailable");
  return wallet;
}

async function applyEvent(
  tx: Tx,
  order: OrderSnapshot,
  sourceKey: string,
  quantity: number,
  direction: "grant" | "reversal",
): Promise<"applied" | "already_applied"> {
  if (!order.customerId || quantity <= 0) return "already_applied";
  const subjectKey = `customer:${order.customerId}`;
  const wallet = await walletSubject(tx, subjectKey, order.customerId);
  const existingResult = await tx.execute(sql`
    SELECT id
    FROM spin_entitlement_events
    WHERE source_key = ${sourceKey}
  `);
  if ((existingResult as any).rows?.[0]) return "already_applied";

  const nextBalance = direction === "grant"
    ? Number(wallet.free_tickets ?? 0) + quantity
    : Number(wallet.free_tickets ?? 0) - quantity;
  if (nextBalance < 0) throw new Error("spin_reversal_exceeds_balance");

  await tx.execute(sql`
    UPDATE spin_wallets
    SET free_tickets = ${nextBalance}, updated_at = NOW()
    WHERE subject_key = ${subjectKey}
  `);
  await tx.execute(sql`
    INSERT INTO spin_entitlement_events
      (subject_key, customer_id, order_id, source_key, source_type, quantity, direction, metadata)
    VALUES
      (${subjectKey}, ${order.customerId}, ${order.id}, ${sourceKey}, 'purchase', ${quantity}, ${direction}, ${JSON.stringify({ orderNumber: order.orderNumber ?? null })}::jsonb)
  `);
  return "applied";
}

/**
 * Synchronize an order transition with the ticket ledger inside the caller's
 * transaction. The unique source keys make repeated admin updates harmless;
 * the wallet lock prevents concurrent updates from racing the balance.
 */
export async function syncOrderEntitlement(
  tx: Tx,
  before: OrderSnapshot | null,
  after: OrderSnapshot,
): Promise<"none" | "granted" | "reversed" | "already_applied"> {
  if (!after.customerId) return "none";
  const becameCompleted = isCompletedPurchase(after) && !isCompletedPurchase(before ?? after);
  const becameReversible = Boolean(before && isCompletedPurchase(before) && (
    after.status === "cancelled" || after.paymentStatus === "refunded" || after.paymentStatus === "wrong"
  ));
  if (becameCompleted) {
    const quantity = completedProductTicketGrant(after);
    const result = await applyEvent(tx, after, purchaseGrantSourceKey(after.id), quantity, "grant");
    return result === "applied" ? "granted" : "already_applied";
  }
  if (becameReversible) {
    const quantity = completedProductTicketGrant(before!);
    const result = await applyEvent(tx, after, purchaseReversalSourceKey(after.id), quantity, "reversal");
    return result === "applied" ? "reversed" : "already_applied";
  }
  return "none";
}
