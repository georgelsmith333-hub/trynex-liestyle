import { Router, type IRouter } from "express";
import { db, hamperPackagesTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

function mapHamper(h: any) {
  return {
    id: h.id,
    slug: h.slug,
    name: h.name,
    nameBn: h.nameBn,
    description: h.description,
    descriptionBn: h.descriptionBn,
    category: h.category,
    occasion: h.occasion,
    imageUrl: h.imageUrl,
    images: h.images ?? [],
    basePrice: parseFloat(h.basePrice),
    discountPrice: h.discountPrice ? parseFloat(h.discountPrice) : undefined,
    items: h.items ?? [],
    isCustomizable: !!h.isCustomizable,
    active: !!h.active,
    featured: !!h.featured,
    sortOrder: h.sortOrder ?? 0,
    stock: h.stock ?? 100,
    tags: h.tags ?? [],
  };
}

// Public: list active hampers
router.get("/hampers", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(hamperPackagesTable)
      .where(eq(hamperPackagesTable.active, true))
      .orderBy(desc(hamperPackagesTable.featured), hamperPackagesTable.sortOrder, desc(hamperPackagesTable.createdAt));
    res.json({ hampers: rows.map(mapHamper) });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to list hampers" });
  }
});

// Public: get hamper by slug or id
router.get("/hampers/:slug", async (req, res) => {
  try {
    const idOrSlug = req.params.slug;
    const isNumeric = /^\d+$/.test(idOrSlug);
    let row: any;
    if (isNumeric) {
      [row] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.id, parseInt(idOrSlug, 10)));
    }
    if (!row) {
      [row] = await db.select().from(hamperPackagesTable).where(eq(hamperPackagesTable.slug, idOrSlug));
    }
    if (!row) {
      res.status(404).json({ error: "not_found", message: "Hamper not found" });
      return;
    }
    res.json(mapHamper(row));
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to get hamper" });
  }
});

// Admin: list all hampers (including inactive)
router.get("/admin/hampers", requireAdmin, async (_req, res) => {
  try {
    const rows = await db.select().from(hamperPackagesTable).orderBy(desc(hamperPackagesTable.createdAt));
    res.json({ hampers: rows.map(mapHamper) });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to list hampers" });
  }
});

// Admin: create
router.post("/admin/hampers", requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.slug || !b.name || b.basePrice === undefined) {
      res.status(400).json({ error: "validation_error", message: "slug, name, basePrice required" });
      return;
    }
    const [row] = await db.insert(hamperPackagesTable).values({
      slug: String(b.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      name: b.name,
      nameBn: b.nameBn || null,
      description: b.description || null,
      descriptionBn: b.descriptionBn || null,
      category: b.category || "general",
      occasion: b.occasion || null,
      imageUrl: b.imageUrl || null,
      images: Array.isArray(b.images) ? b.images : [],
      basePrice: String(b.basePrice),
      discountPrice: b.discountPrice ? String(b.discountPrice) : null,
      items: Array.isArray(b.items) ? b.items : [],
      isCustomizable: !!b.isCustomizable,
      active: b.active !== false,
      featured: !!b.featured,
      sortOrder: Number(b.sortOrder) || 0,
      stock: b.stock !== undefined ? Number(b.stock) : 100,
      tags: Array.isArray(b.tags) ? b.tags : [],
    }).returning();
    res.status(201).json(mapHamper(row));
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "duplicate", message: "Slug already exists" });
      return;
    }
    res.status(500).json({ error: "internal_error", message: "Failed to create hamper" });
  }
});

// Admin: update
router.put("/admin/hampers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const updates: any = { updatedAt: new Date() };
    if (b.slug !== undefined) updates.slug = String(b.slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (b.name !== undefined) updates.name = b.name;
    if (b.nameBn !== undefined) updates.nameBn = b.nameBn;
    if (b.description !== undefined) updates.description = b.description;
    if (b.descriptionBn !== undefined) updates.descriptionBn = b.descriptionBn;
    if (b.category !== undefined) updates.category = b.category;
    if (b.occasion !== undefined) updates.occasion = b.occasion;
    if (b.imageUrl !== undefined) updates.imageUrl = b.imageUrl;
    if (b.images !== undefined) updates.images = Array.isArray(b.images) ? b.images : [];
    if (b.basePrice !== undefined) updates.basePrice = String(b.basePrice);
    if (b.discountPrice !== undefined) updates.discountPrice = b.discountPrice ? String(b.discountPrice) : null;
    if (b.items !== undefined) updates.items = Array.isArray(b.items) ? b.items : [];
    if (b.isCustomizable !== undefined) updates.isCustomizable = !!b.isCustomizable;
    if (b.active !== undefined) updates.active = !!b.active;
    if (b.featured !== undefined) updates.featured = !!b.featured;
    if (b.sortOrder !== undefined) updates.sortOrder = Number(b.sortOrder) || 0;
    if (b.stock !== undefined) updates.stock = Number(b.stock);
    if (b.tags !== undefined) updates.tags = Array.isArray(b.tags) ? b.tags : [];
    const [row] = await db.update(hamperPackagesTable).set(updates).where(eq(hamperPackagesTable.id, id)).returning();
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(mapHamper(row));
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to update hamper" });
  }
});

// Admin: delete
router.delete("/admin/hampers/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(hamperPackagesTable).where(eq(hamperPackagesTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "internal_error", message: "Failed to delete hamper" });
  }
});

export default router;
