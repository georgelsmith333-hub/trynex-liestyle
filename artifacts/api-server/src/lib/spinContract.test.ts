import { describe, expect, it } from "vitest";
import {
  assertIdempotencyKey,
  completedProductTicketGrant,
  countCompletedProducts,
  dailyGrantSourceKey,
  isCompletedPurchase,
  purchaseGrantSourceKey,
  utcDateKey,
} from "./spinContract";

describe("Spin & Win entitlement contract", () => {
  it("grants exactly three tickets per product only for delivered paid orders", () => {
    const order = {
      id: 42,
      status: "delivered",
      paymentStatus: "paid",
      items: [{ quantity: 1 }, { quantity: "2" }, { quantity: 0 }, { quantity: "bad" }],
    };
    expect(isCompletedPurchase(order)).toBe(true);
    expect(countCompletedProducts(order.items)).toBe(3);
    expect(completedProductTicketGrant(order)).toBe(9);
  });

  it("does not grant for cart, payment-pending, shipped, cancelled, or malformed snapshots", () => {
    const base = { id: 7, items: [{ quantity: 2 }] };
    expect(completedProductTicketGrant({ ...base, status: "pending", paymentStatus: "paid" })).toBe(0);
    expect(completedProductTicketGrant({ ...base, status: "shipped", paymentStatus: "paid" })).toBe(0);
    expect(completedProductTicketGrant({ ...base, status: "delivered", paymentStatus: "pending" })).toBe(0);
    expect(completedProductTicketGrant({ ...base, status: "cancelled", paymentStatus: "paid" })).toBe(0);
    expect(countCompletedProducts({ quantity: 2 })).toBe(0);
  });

  it("produces stable source keys for once-only grants and daily claims", () => {
    expect(purchaseGrantSourceKey(42)).toBe("purchase:order:42:delivered:v1");
    expect(dailyGrantSourceKey("customer:9", "2026-08-28")).toBe("daily:customer:9:2026-08-28");
    expect(utcDateKey(new Date("2026-08-28T23:59:59.000Z"))).toBe("2026-08-28");
  });

  it("accepts bounded idempotency keys and rejects replay-unsafe input", () => {
    expect(assertIdempotencyKey("spin:customer:9:abc123")).toBe("spin:customer:9:abc123");
    expect(() => assertIdempotencyKey("short")).toThrow("invalid_idempotency_key");
    expect(() => assertIdempotencyKey("../../secret")) .toThrow("invalid_idempotency_key");
  });
});
