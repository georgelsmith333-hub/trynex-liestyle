import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

function mapProduct(p: any, categoryName?: string | null) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: parseFloat(p.price),
    discountPrice: p.discountPrice ? parseFloat(p.discountPrice) : undefined,
    categoryId: p.categoryId,
    categoryName: categoryName ?? undefined,
    imageUrl: p.imageUrl,
    images: p.images ?? [],
    sizes: p.sizes ?? [],
    colors: p.colors ?? [],
    stock: p.stock,
    featured: p.featured ?? false,
    rating: p.rating ? parseFloat(p.rating) : 0,
    reviewCount: p.reviewCount ?? 0,
    customizable: p.customizable ?? false,
    tags: p.tags ?? [],
  };
}

router.get("/products", async (req, res) => {
  try {
    const { categoryId, search, featured, page = "1", limit = "12" } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [];
    if (categoryId) conditions.push(eq(productsTable.categoryId, parseInt(categoryId as string, 10)));
    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(productsTable.name, pattern),
          ilike(productsTable.description, pattern),
          ilike(sql`array_to_string(${productsTable.tags}, ' ')`, pattern),
        )!,
      );
    }
    if (featured === "true") conditions.push(eq(productsTable.featured, true));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [products, countResult] = await Promise.all([
      db.select().from(productsTable).where(where).orderBy(desc(productsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(productsTable).where(where),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))];
    const categories = categoryIds.length > 0
      ? await db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(sql`id = ANY(ARRAY[${sql.join(categoryIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
      : [];
    const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

    res.json({
      products: products.map(p => mapProduct(p, p.categoryId ? catMap[p.categoryId] : null)),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    res.status(500).json({ error: "internal_error", message: "Failed to list products" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const isFullyNumeric = /^\d+$/.test(idOrSlug);
    const numericId = isFullyNumeric ? parseInt(idOrSlug, 10) : NaN;
    let product: any;

    if (isFullyNumeric && !isNaN(numericId)) {
      [product] = await db.select().from(productsTable).where(eq(productsTable.id, numericId));
    }
    if (!product) {
      [product] = await db.select().from(productsTable).where(eq(productsTable.slug, idOrSlug));
    }
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    let categoryName: string | null = null;
    if (product.categoryId) {
      const [cat] = await db.select({ name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
      categoryName = cat?.name ?? null;
    }
    res.json(mapProduct(product, categoryName));
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    res.status(500).json({ error: "internal_error", message: "Failed to get product" });
  }
});

router.post("/products", requireAdmin, async (req, res) => {
  try {
    const { name, slug, description, price, discountPrice, categoryId, imageUrl, images, sizes, colors, stock, featured, customizable, tags } = req.body;
    if (!name || !slug || price === undefined || stock === undefined) {
      res.status(400).json({ error: "validation_error", message: "name, slug, price, stock are required" });
      return;
    }
    const [product] = await db.insert(productsTable).values({
      name, slug, description,
      price: price.toString(),
      discountPrice: discountPrice?.toString(),
      categoryId,
      imageUrl, images, sizes, colors,
      stock, featured, customizable, tags,
    }).returning();

    if (categoryId) {
      await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${categoryId}`);
    }

    res.status(201).json(mapProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to create product");
    res.status(500).json({ error: "internal_error", message: "Failed to create product" });
  }
});

router.put("/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const { name, slug, description, price, discountPrice, categoryId, imageUrl, images, sizes, colors, stock, featured, customizable, tags } = req.body;

    const [existing] = await db.select({ categoryId: productsTable.categoryId }).from(productsTable).where(eq(productsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    const oldCategoryId = existing.categoryId;

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = price.toString();
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice?.toString() ?? null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (images !== undefined) updateData.images = images;
    if (sizes !== undefined) updateData.sizes = sizes;
    if (colors !== undefined) updateData.colors = colors;
    if (stock !== undefined) updateData.stock = stock;
    if (featured !== undefined) updateData.featured = featured;
    if (customizable !== undefined) updateData.customizable = customizable;
    if (tags !== undefined) updateData.tags = tags;

    const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();

    const newCategoryId = categoryId !== undefined ? categoryId : oldCategoryId;
    if (oldCategoryId !== newCategoryId) {
      if (oldCategoryId) {
        await db.execute(sql`UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ${oldCategoryId}`);
      }
      if (newCategoryId) {
        await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${newCategoryId}`);
      }
    }

    res.json(mapProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to update product");
    res.status(500).json({ error: "internal_error", message: "Failed to update product" });
  }
});

router.delete("/products/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [product] = await db.delete(productsTable).where(eq(productsTable.id, id)).returning();
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    if (product.categoryId) {
      await db.execute(sql`UPDATE categories SET product_count = GREATEST(product_count - 1, 0) WHERE id = ${product.categoryId}`);
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete product");
    res.status(500).json({ error: "internal_error", message: "Failed to delete product" });
  }
});

router.post("/products/bulk", requireAdmin, async (req, res) => {
  try {
    const { products: bulkProducts } = req.body;
    if (!Array.isArray(bulkProducts) || bulkProducts.length === 0) {
      res.status(400).json({ error: "validation_error", message: "products array is required" });
      return;
    }

    if (bulkProducts.length > 200) {
      res.status(400).json({ error: "validation_error", message: "Maximum 200 products per upload" });
      return;
    }

    const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] };

    for (let i = 0; i < bulkProducts.length; i++) {
      const p = bulkProducts[i];
      try {
        if (!p.name || !p.slug || p.price === undefined) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: name, slug, price are required`);
          continue;
        }

        const [product] = await db.insert(productsTable).values({
          name: String(p.name).trim(),
          slug: String(p.slug).trim(),
          description: p.description || null,
          price: String(p.price),
          discountPrice: p.discountPrice ? String(p.discountPrice) : null,
          categoryId: p.categoryId ? parseInt(String(p.categoryId), 10) : null,
          imageUrl: p.imageUrl || null,
          images: [],
          sizes: Array.isArray(p.sizes) ? p.sizes : (p.sizes ? String(p.sizes).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []),
          colors: Array.isArray(p.colors) ? p.colors : (p.colors ? String(p.colors).split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []),
          stock: parseInt(String(p.stock || 0), 10),
          featured: p.featured === true || p.featured === 'true',
          customizable: p.customizable === true || p.customizable === 'true',
          tags: [],
        }).returning();

        if (product.categoryId) {
          await db.execute(sql`UPDATE categories SET product_count = product_count + 1 WHERE id = ${product.categoryId}`);
        }
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Row ${i + 1} (${p.name || 'unknown'}): ${err.message?.includes('unique') ? 'duplicate slug' : 'database error'}`);
      }
    }

    res.status(201).json(results);
  } catch (err) {
    req.log.error({ err }, "Failed to bulk create products");
    res.status(500).json({ error: "internal_error", message: "Bulk upload failed" });
  }
});

/** Toggle featured flag on a product — used by Admin Visual Designer */
router.patch("/admin/products/:id/featured", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const { featured } = req.body as { featured?: boolean };
    if (typeof featured !== "boolean") {
      res.status(400).json({ error: "validation_error", message: "featured must be a boolean" });
      return;
    }
    const [updated] = await db.update(productsTable)
      .set({ featured, updatedAt: new Date() })
      .where(eq(productsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    res.json({ id: updated.id, featured: updated.featured });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle product featured flag");
    res.status(500).json({ error: "internal_error", message: "Failed to toggle featured" });
  }
});

export default router;
