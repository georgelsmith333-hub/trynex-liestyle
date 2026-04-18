import { Router, type IRouter } from "express";
import { db, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      productCount: c.productCount ?? 0,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    res.status(500).json({ error: "internal_error", message: "Failed to list categories" });
  }
});

router.post("/categories", requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, imageUrl } = req.body;
    if (!name || !slug) {
      res.status(400).json({ error: "validation_error", message: "name and slug are required" });
      return;
    }
    const [category] = await db.insert(categoriesTable).values({ name, slug, description, imageUrl }).returning();
    res.status(201).json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageUrl: category.imageUrl,
      productCount: category.productCount ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ error: "internal_error", message: "Failed to create category" });
  }
});

export default router;
