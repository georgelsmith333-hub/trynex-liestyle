export const DAILY_SPIN_TICKETS = 1;
export const TICKETS_PER_COMPLETED_PRODUCT = 3;

export const COMPLETED_ORDER_STATUS = "delivered" as const;
export const COMPLETED_PAYMENT_STATUSES = new Set(["verified", "paid"] as const);

export type SpinOrderLike = {
  id: number;
  status: string;
  paymentStatus: string;
  items: unknown;
};

/**
 * Count sellable product units from the persisted order snapshot. Invalid or
 * non-positive quantities are ignored rather than creating entitlement units.
 */
export function countCompletedProducts(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((total, item) => {
    if (!item || typeof item !== "object") return total;
    const quantity = (item as { quantity?: unknown }).quantity;
    const parsed = typeof quantity === "number"
      ? quantity
      : typeof quantity === "string" && quantity.trim() !== ""
        ? Number(quantity)
        : NaN;
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return total;
    return total + parsed;
  }, 0);
}

export function isCompletedPurchase(order: SpinOrderLike): boolean {
  return order.status === COMPLETED_ORDER_STATUS && COMPLETED_PAYMENT_STATUSES.has(order.paymentStatus as never);
}

export function completedProductTicketGrant(order: SpinOrderLike): number {
  return isCompletedPurchase(order)
    ? countCompletedProducts(order.items) * TICKETS_PER_COMPLETED_PRODUCT
    : 0;
}

export function purchaseGrantSourceKey(orderId: number): string {
  return `purchase:order:${orderId}:delivered:v1`;
}

export function purchaseReversalSourceKey(orderId: number): string {
  return `reversal:order:${orderId}:delivered:v1`;
}

export function dailyGrantSourceKey(subjectKey: string, utcDate: string): string {
  return `daily:${subjectKey}:${utcDate}`;
}

export function utcDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export type SpinEntitlementType = "daily" | "ticket";
export type SpinPlayStatus = "reserved" | "settled" | "failed" | "cancelled";

export function assertIdempotencyKey(value: unknown): string {
  if (typeof value !== "string") throw new Error("idempotency_key_required");
  const key = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
    throw new Error("invalid_idempotency_key");
  }
  return key;
}
