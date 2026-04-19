import { Router, type IRouter } from "express";
import { db, blogPostsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin, validateToken } from "../middlewares/adminAuth";

const router: IRouter = Router();

let blogTableReady: Promise<void> | null = null;
function ensureBlogTable(): Promise<void> {
  if (!blogTableReady) {
    blogTableReady = db.execute(sql`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        content TEXT NOT NULL,
        image_url TEXT,
        author TEXT DEFAULT 'TryNex Team',
        author_bio TEXT,
        author_avatar_url TEXT,
        category TEXT DEFAULT 'General',
        tags TEXT[] DEFAULT '{}',
        published BOOLEAN DEFAULT false,
        featured BOOLEAN DEFAULT false,
        reading_time_override INTEGER,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `).then(() =>
      db.execute(sql`
        ALTER TABLE blog_posts
          ADD COLUMN IF NOT EXISTS author_bio TEXT,
          ADD COLUMN IF NOT EXISTS author_avatar_url TEXT,
          ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General',
          ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
          ADD COLUMN IF NOT EXISTS reading_time_override INTEGER
      `)
    ).then(() => {}).catch(() => { blogTableReady = null; }) as Promise<void>;
  }
  return blogTableReady ?? Promise.resolve();
}

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
    createdAt: p.createdAt?.toISOString(),
    updatedAt: p.updatedAt?.toISOString(),
  };
}

router.get("/blog", async (req, res) => {
  try {
    await ensureBlogTable();
    const { published, page = "1", limit = "12", category } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    const token = req.headers.authorization?.replace("Bearer ", "") ?? req.cookies?.admin_token;
    const isAdmin = token ? validateToken(token) : false;
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
    await ensureBlogTable();
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
    res.json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to get blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to get blog post" });
  }
});

router.get("/blog/:id/related", async (req, res) => {
  try {
    await ensureBlogTable();
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
    await ensureBlogTable();
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride } = req.body;
    if (!title || !slug || !content) {
      res.status(400).json({ error: "validation_error", message: "title, slug, content are required" });
      return;
    }
    const [post] = await db.insert(blogPostsTable).values({
      title, slug, excerpt, content, imageUrl,
      author: author || "TryNex Team",
      authorBio, authorAvatarUrl,
      category: category || "General",
      tags: tags || [],
      published: published ?? false,
      featured: featured ?? false,
      readingTimeOverride: readingTimeOverride ? Number(readingTimeOverride) : undefined,
    }).returning();
    res.status(201).json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to create blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to create blog post" });
  }
});

router.put("/blog/:id", requireAdmin, async (req, res) => {
  try {
    await ensureBlogTable();
    const id = parseInt(req.params.id as string, 10);
    const { title, slug, excerpt, content, imageUrl, author, authorBio, authorAvatarUrl, category, tags, published, featured, readingTimeOverride } = req.body;

    const updateData: any = { updatedAt: new Date() };
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
    if (readingTimeOverride !== undefined) updateData.readingTimeOverride = readingTimeOverride ? Number(readingTimeOverride) : null;

    const [post] = await db.update(blogPostsTable).set(updateData).where(eq(blogPostsTable.id, id)).returning();
    if (!post) {
      res.status(404).json({ error: "not_found", message: "Blog post not found" });
      return;
    }
    res.json(mapPost(post));
  } catch (err) {
    req.log.error({ err }, "Failed to update blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to update blog post" });
  }
});

router.delete("/blog/:id", requireAdmin, async (req, res) => {
  try {
    await ensureBlogTable();
    const id = parseInt(req.params.id as string, 10);
    const [post] = await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id)).returning();
    if (!post) {
      res.status(404).json({ error: "not_found", message: "Blog post not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete blog post");
    res.status(500).json({ error: "internal_error", message: "Failed to delete blog post" });
  }
});

export default router;
