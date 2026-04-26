import { Router, type IRouter } from "express";
import { db, reviewsTable, productsTable, ordersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";

const router: IRouter = Router();

router.get("/reviews/:productId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const reviews = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.approved, true)))
      .orderBy(desc(reviewsTable.createdAt));

    const stats = reviews.reduce((acc, r) => {
      acc.total++;
      acc.sum += r.rating;
      acc.distribution[r.rating] = (acc.distribution[r.rating] || 0) + 1;
      return acc;
    }, { total: 0, sum: 0, distribution: {} as Record<number, number> });

    res.json({
      reviews,
      stats: {
        total: stats.total,
        average: stats.total > 0 ? Math.round((stats.sum / stats.total) * 10) / 10 : 0,
        distribution: stats.distribution,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get reviews");
    res.status(500).json({ error: "internal_error", message: "Failed to get reviews" });
  }
});

router.post("/reviews", async (req, res) => {
  try {
    const { productId, customerName, customerEmail, rating, text } = req.body;

    if (!productId || !customerName || !customerEmail || !rating) {
      res.status(400).json({ error: "validation_error", message: "productId, name, email, rating required" });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "validation_error", message: "Rating must be between 1 and 5" });
      return;
    }

    const existingReview = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, productId), eq(reviewsTable.customerEmail, customerEmail)));
    if (existingReview.length > 0) {
      res.status(409).json({ error: "duplicate", message: "You have already reviewed this product" });
      return;
    }

    let verified = false;
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.customerEmail, customerEmail));
    for (const order of orders) {
      const items = order.items as any[];
      // Use Number() on both sides to handle string/number type mismatch in
      // JSON order items (e.g. productId stored as string "42" vs number 42).
      if (items?.some((item: any) => Number(item.productId) === Number(productId))) {
        verified = true;
        break;
      }
    }

    const [review] = await db.insert(reviewsTable).values({
      productId,
      customerName,
      customerEmail,
      rating,
      body: text || "",
      approved: false,
    }).returning();

    res.status(201).json({ ...review, message: "Review submitted! It will appear after approval." });
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    res.status(500).json({ error: "internal_error", message: "Failed to submit review" });
  }
});

router.get("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const reviews = await db.select().from(reviewsTable).orderBy(desc(reviewsTable.createdAt));
    res.json({ reviews });
  } catch (err) {
    req.log.error({ err }, "Failed to list all reviews");
    res.status(500).json({ error: "internal_error", message: "Failed to list reviews" });
  }
});

router.put("/admin/reviews/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [beforeSnap] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    const [review] = await db.update(reviewsTable)
      .set({ approved: true })
      .where(eq(reviewsTable.id, id))
      .returning();
    if (!review) {
      res.status(404).json({ error: "not_found", message: "Review not found" });
      return;
    }

    const approvedReviews = await db.select().from(reviewsTable)
      .where(and(eq(reviewsTable.productId, review.productId), eq(reviewsTable.approved, true)));
    const avgRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length;
    await db.update(productsTable).set({
      rating: avgRating.toFixed(2),
      reviewCount: approvedReviews.length,
    }).where(eq(productsTable.id, review.productId));

    logActivity({ action: "update", entity: "review", entityId: id, entityName: `Review by ${review.customerName}`, before: (beforeSnap ?? null) as unknown as Record<string, unknown>, after: review as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json(review);
  } catch (err) {
    req.log.error({ err }, "Failed to approve review");
    res.status(500).json({ error: "internal_error", message: "Failed to approve review" });
  }
});

router.delete("/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [beforeSnap] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, id));
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    if (beforeSnap) logActivity({ action: "delete", entity: "review", entityId: id, entityName: `Review by ${beforeSnap.customerName}`, before: beforeSnap as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete review");
    res.status(500).json({ error: "internal_error", message: "Failed to delete review" });
  }
});

export default router;
