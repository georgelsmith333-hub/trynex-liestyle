import { Router, type IRouter } from "express";
import { db, testimonialsTable } from "@workspace/db";
import type { Testimonial } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

function mapTestimonial(t: Testimonial) {
  return {
    id: t.id,
    name: t.name,
    role: t.role,
    location: t.location,
    stars: t.stars,
    body: t.body,
    active: t.active,
    sortOrder: t.sortOrder,
    createdAt: t.createdAt?.toISOString(),
  };
}

interface TestimonialUpdate {
  name?: string;
  role?: string;
  location?: string;
  stars?: number | string;
  body?: string;
  active?: boolean;
  sortOrder?: number | string;
}

router.get("/testimonials", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(testimonialsTable)
      .where(eq(testimonialsTable.active, true))
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    res.json({ testimonials: rows.map(mapTestimonial) });
  } catch (err) {
    req.log.error({ err }, "Failed to list testimonials");
    res.status(500).json({ error: "internal_error", message: "Failed to list testimonials" });
  }
});

router.get("/admin/testimonials", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(testimonialsTable)
      .orderBy(asc(testimonialsTable.sortOrder), asc(testimonialsTable.id));
    res.json({ testimonials: rows.map(mapTestimonial) });
  } catch (err) {
    req.log.error({ err }, "Failed to list all testimonials");
    res.status(500).json({ error: "internal_error", message: "Failed to list testimonials" });
  }
});

router.post("/admin/testimonials", requireAdmin, async (req, res) => {
  try {
    const { name, role, location, stars, body, active, sortOrder } = req.body as TestimonialUpdate & { name?: string; body?: string };
    if (!name?.trim() || !body?.trim()) {
      res.status(400).json({ error: "validation_error", message: "name and body are required" });
      return;
    }
    const parsedStars = Math.min(5, Math.max(1, Number(stars) || 5));
    const [created] = await db.insert(testimonialsTable).values({
      name: name.trim(),
      role: role?.trim() ?? "",
      location: location?.trim() ?? "",
      stars: parsedStars,
      body: body.trim(),
      active: active !== false,
      sortOrder: Number(sortOrder) || 0,
    }).returning();
    res.status(201).json(mapTestimonial(created));
  } catch (err) {
    req.log.error({ err }, "Failed to create testimonial");
    res.status(500).json({ error: "internal_error", message: "Failed to create testimonial" });
  }
});

router.patch("/admin/testimonials/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { name, role, location, stars, body, active, sortOrder } = req.body as TestimonialUpdate;
    const isPartial = name === undefined && body === undefined;
    if (!isPartial && (!name?.trim() || !body?.trim())) {
      res.status(400).json({ error: "validation_error", message: "name and body are required" });
      return;
    }
    type TestimonialSetFields = Partial<Pick<Testimonial, "name" | "role" | "location" | "stars" | "body" | "active" | "sortOrder">> & { updatedAt: Date };
    const setFields: TestimonialSetFields = { updatedAt: new Date() };
    if (name !== undefined) setFields.name = name.trim();
    if (role !== undefined) setFields.role = role?.trim() ?? "";
    if (location !== undefined) setFields.location = location?.trim() ?? "";
    if (stars !== undefined) setFields.stars = Math.min(5, Math.max(1, Number(stars) || 5));
    if (body !== undefined) setFields.body = body.trim();
    if (active !== undefined) setFields.active = active !== false;
    if (sortOrder !== undefined) setFields.sortOrder = Number(sortOrder) || 0;
    const [updated] = await db.update(testimonialsTable)
      .set(setFields)
      .where(eq(testimonialsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Testimonial not found" });
      return;
    }
    res.json(mapTestimonial(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update testimonial");
    res.status(500).json({ error: "internal_error", message: "Failed to update testimonial" });
  }
});

router.delete("/admin/testimonials/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    await db.delete(testimonialsTable).where(eq(testimonialsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete testimonial");
    res.status(500).json({ error: "internal_error", message: "Failed to delete testimonial" });
  }
});

export default router;
