import { Router, type IRouter } from "express";
import { db, blogPostsTable, settingsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin, validateToken } from "../middlewares/adminAuth";
import { logActivity, getAdminId } from "../lib/activityLog";
import { z } from "zod";

const DEFAULT_BLOG_CATEGORIES = ["General", "Fashion", "Tips", "News", "Lifestyle"];

// ---------------------------------------------------------------------------
// Zod schemas for blog mutation endpoints
// ---------------------------------------------------------------------------
const BlogCreateSchema = z.object({
  title:               z.string().min(1, "title is required").max(300),
  slug:                z.string().min(1, "slug is required").max(300).regex(/^[a-z0-9-]+$/, "slug must be lowercase-kebab"),
  content:             z.string().min(1, "content is required"),
  excerpt:             z.string().max(1000).optional().nullable(),
  imageUrl:            z.string().url().max(2048).optional().nullable(),
  author:              z.string().max(100).optional().nullable(),
  authorBio:           z.string().max(1000).optional().nullable(),
  authorAvatarUrl:     z.string().url().max(2048).optional().nullable(),
  category:            z.string().max(100).optional().nullable(),
  tags:                z.array(z.string().max(60)).max(20).optional(),
  published:           z.boolean().optional(),
  featured:            z.boolean().optional(),
  readingTimeOverride: z.number().int().positive().optional().nullable(),
});

const BlogUpdateSchema = BlogCreateSchema.partial();

function parseBlogBody<T>(schema: z.ZodSchema<T>, body: unknown):
  | { ok: true; data: T }
  | { ok: false; message: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, message: result.error.errors.map(e => e.message).join("; ") };
  }
  return { ok: true, data: result.data };
}

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Blog categories helpers (stored in settings table as JSON under "blogCategories")
// ---------------------------------------------------------------------------

async function getBlogCategories(): Promise<string[]> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, "blogCategories"));
  if (!row?.value) return DEFAULT_BLOG_CATEGORIES;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_BLOG_CATEGORIES;
  } catch {
    return DEFAULT_BLOG_CATEGORIES;
  }
}

async function saveBlogCategories(categories: string[]): Promise<void> {
  const value = JSON.stringify(categories);
  const [existing] = await db.select().from(settingsTable).where(eq(settingsTable.key, "blogCategories"));
  if (existing) {
    await db.update(settingsTable).set({ value, updatedAt: new Date() }).where(eq(settingsTable.key, "blogCategories"));
  } else {
    await db.insert(settingsTable).values({ key: "blogCategories", value });
  }
}

// GET /blog/categories — public, returns the configured list
router.get("/blog/categories", async (req, res) => {
  try {
    const categories = await getBlogCategories();
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to get blog categories");
    res.status(500).json({ error: "internal_error", message: "Failed to get blog categories" });
  }
});

// POST /blog/categories — admin only, adds a new category
router.post("/blog/categories", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "validation_error", message: "Category name is required" });
      return;
    }
    if (name.length > 60) {
      res.status(400).json({ error: "validation_error", message: "Category name must be 60 characters or fewer" });
      return;
    }
    const categories = await getBlogCategories();
    if (categories.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
      res.status(409).json({ error: "conflict", message: "Category already exists" });
      return;
    }
    const updated = [...categories, name];
    await saveBlogCategories(updated);
    res.status(201).json({ categories: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to add blog category");
    res.status(500).json({ error: "internal_error", message: "Failed to add blog category" });
  }
});

// DELETE /blog/categories/:name — admin only, removes a category
router.delete("/blog/categories/:name", requireAdmin, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name ?? "").trim();
    if (!name) {
      res.status(400).json({ error: "validation_error", message: "Category name is required" });
      return;
    }
    const categories = await getBlogCategories();
    const updated = categories.filter(c => c.toLowerCase() !== name.toLowerCase());
    if (updated.length === categories.length) {
      res.status(404).json({ error: "not_found", message: "Category not found" });
      return;
    }
    await saveBlogCategories(updated);
    res.json({ categories: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to delete blog category");
    res.status(500).json({ error: "internal_error", message: "Failed to delete blog category" });
  }
});

// PUT /blog/categories — admin only, replace entire list (ordered)
router.put("/blog/categories", requireAdmin, async (req, res) => {
  try {
    const rawList = req.body?.categories;
    if (!Array.isArray(rawList)) {
      res.status(400).json({ error: "validation_error", message: "categories must be an array" });
      return;
    }
    const seen = new Set<string>();
    const categories: string[] = [];
    for (const raw of rawList) {
      const name = String(raw).trim();
      if (!name) continue;
      if (name.length > 60) {
        res.status(400).json({ error: "validation_error", message: `Category name "${name}" must be 60 characters or fewer` });
        return;
      }
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        categories.push(name);
      }
    }
    if (categories.length === 0) {
      res.status(400).json({ error: "validation_error", message: "categories list cannot be empty" });
      return;
    }
    await saveBlogCategories(categories);
    res.json({ categories });
  } catch (err) {
    req.log.error({ err }, "Failed to update blog categories");
    res.status(500).json({ error: "internal_error", message: "Failed to update blog categories" });
  }
});

// blog_posts table is created at startup by lib/autoSeed.ts

function calcReadingTime(content: string): number {
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function mapPost(p: any) {
  const readingTime = p.readingTimeOverride ?? calcReadingTime(p.content ?? "");
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt,
    content: p.content,
    imageUrl: p.imageUrl,
    author: p.author,
    authorBio: p.authorBio,
    authorAvatarUrl: p.authorAvatarUrl,
    category: p.category ?? "General",
    tags: p.tags ?? [],
    published: p.published ?? false,
    featured: p.featured ?? false,
    readingTime,
    readingTimeOverride: p.readingTimeOverride ?? null,
    viewCount: p.viewCount ?? 0,
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  };
}

router.get("/blog", async (req, res) => {
  try {
    const { published, page = "1", limit = "12", category } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const token = req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.admin_token;
    const isAdmin = token ? await validateToken(token) : false;
    const conditions: any[] = [];
    if (!isAdmin || published === "true") conditions.push(eq(blogPostsTable.published, true));
    if (category && category !== "All") conditions.push(eq(blogPostsTable.category, category as string));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [posts, countResult] = await Promise.all([
      db.select().from(blogPostsTable).where(where).orderBy(desc(blogPostsTable.featured), desc(blogPostsTable.createdAt)).limit(limitNum).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(blogPostsTable).where(where),
    ]);

    res.json({
      posts: posts.map(mapPost),
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list blog posts");
    res.status(500).json({ error: "internal_error", message: "Failed to list blog posts" });
  }
});

router.get("/blog/:id", async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const numericId = parseInt(idOrSlug, 10);

    let post;
    if (!isNaN(numericId)) {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, numericId));
    } else {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, idOrSlug));
    }

    if (!post) {
      res.status(404).json({ error: "not_found", message: "Blog post not found" });
      return;
    }

    db.update(blogPostsTable)
      .set({ viewCount: sql`${blogPostsTable.viewCount} + 1` })
      .where(eq(blogPostsTable.id, post.id))
      .execute()
      .catch((err) => { req.log.error({ err, postId: post.id }, "Failed to increment view count"); });

    res.json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to get blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to get blog post" });
  }
});

router.get("/blog/:id/related", async (req, res) => {
  try {
    const idOrSlug = req.params.id;
    const numericId = parseInt(idOrSlug, 10);

    let post;
    if (!isNaN(numericId)) {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, numericId));
    } else {
      [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, idOrSlug));
    }

    if (!post) {
      res.json({ posts: [] });
      return;
    }

    const LIMIT = 3;

    // First: try same category (excluding self)
    const sameCat = await db
      .select()
      .from(blogPostsTable)
      .where(and(eq(blogPostsTable.published, true), eq(blogPostsTable.category, post.category ?? "General")))
      .orderBy(desc(blogPostsTable.createdAt))
      .limit(LIMIT + 1);

    const sameCatFiltered = sameCat.filter(r => r.id !== post!.id).slice(0, LIMIT);

    if (sameCatFiltered.length >= LIMIT) {
      res.json({ posts: sameCatFiltered.map(mapPost) });
      return;
    }

    // Fallback: add posts sharing at least one tag (excluding already found + self)
    const alreadyIds = new Set([post.id, ...sameCatFiltered.map(r => r.id)]);
    const postTags: string[] = post.tags ?? [];

    let tagMatches: typeof sameCat = [];
    if (postTags.length > 0) {
      const allPublished = await db
        .select()
        .from(blogPostsTable)
        .where(eq(blogPostsTable.published, true))
        .orderBy(desc(blogPostsTable.createdAt))
        .limit(50);

      tagMatches = allPublished
        .filter(r => !alreadyIds.has(r.id) && (r.tags ?? []).some((t: string) => postTags.includes(t)))
        .slice(0, LIMIT - sameCatFiltered.length);
    }

    const combined = [...sameCatFiltered, ...tagMatches].slice(0, LIMIT);
    res.json({ posts: combined.map(mapPost) });
  } catch (err) {
    req.log.error({ err }, "Failed to get related posts");
    res.status(500).json({ error: "internal_error", message: "Failed to get related posts" });
  }
});

router.post("/blog", requireAdmin, async (req, res) => {
  try {
    const parsed = parseBlogBody(BlogCreateSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride } = parsed.data;
    const [post] = await db.insert(blogPostsTable).values({
      title, slug,
      excerpt:             excerpt ?? undefined,
      content,
      imageUrl:            imageUrl ?? undefined,
      author:              author ?? "TryNex Team",
      authorBio:           authorBio ?? undefined,
      authorAvatarUrl:     authorAvatarUrl ?? undefined,
      category:            category ?? "General",
      tags:                tags ?? [],
      published:           published ?? false,
      featured:            featured ?? false,
      readingTimeOverride: readingTimeOverride ?? undefined,
    }).returning();
    logActivity({ action: "create", entity: "blog", entityId: post.id, entityName: post.title, after: post as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.status(201).json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to create blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to create blog post" });
  }
});

router.put("/blog/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "validation_error", message: "Invalid blog post id" }); return; }
    const parsed = parseBlogBody(BlogUpdateSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: "validation_error", message: parsed.message }); return; }
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride } = parsed.data;
    const [beforeSnapshot] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (author !== undefined) updateData.author = author;
    if (authorBio !== undefined) updateData.authorBio = authorBio;
    if (authorAvatarUrl !== undefined) updateData.authorAvatarUrl = authorAvatarUrl;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (published !== undefined) updateData.published = published;
    if (featured !== undefined) updateData.featured = featured;
    if (readingTimeOverride !== undefined) updateData.readingTimeOverride = readingTimeOverride ?? null;

    const [post] = await db.update(blogPostsTable).set(updateData).where(eq(blogPostsTable.id, id)).returning();
    if (!post) {
      res.status(404).json({ error: "not_found", message: "Blog post not found" });
      return;
    }
    logActivity({ action: "update", entity: "blog", entityId: id, entityName: post.title, before: (beforeSnapshot ?? null) as unknown as Record<string, unknown>, after: post as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to update blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to update blog post" });
  }
});

router.delete("/blog/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    const [beforeSnapshot] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id));
    const [post] = await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id)).returning();
    if (!post) {
      res.status(404).json({ error: "not_found", message: "Blog post not found" });
      return;
    }
    logActivity({ action: "delete", entity: "blog", entityId: id, entityName: post.title, before: (beforeSnapshot ?? post) as unknown as Record<string, unknown>, adminId: getAdminId(req) });
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to delete blog post" });
  }
});

export default router;
