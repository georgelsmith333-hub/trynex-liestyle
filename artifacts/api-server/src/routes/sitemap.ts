import { Router, type IRouter } from "express";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SITE_URL = "https://trynexshop.com";

router.get("/sitemap.xml", async (_req, res) => {
  try {
    const products = await db
      .select({
        slug: productsTable.slug,
        updatedAt: productsTable.updatedAt,
        imageUrl: productsTable.imageUrl,
        name: productsTable.name,
      })
      .from(productsTable)
      .orderBy(desc(productsTable.createdAt));

    const categories = await db
      .select({
        slug: categoriesTable.slug,
        name: categoriesTable.name,
      })
      .from(categoriesTable);

    let blogPosts: { slug: string; updatedAt: Date | null }[] = [];
    try {
      const result = await db.execute(sql`SELECT slug, updated_at FROM blog_posts WHERE published = true ORDER BY created_at DESC`);
      blogPosts = (result.rows || []) as any[];
    } catch (err) {
      logger.warn({ err, route: "GET /sitemap.xml" }, "Failed to load blog posts for sitemap");
    }

    const today = new Date().toISOString().split("T")[0];

    const staticPages = [
      { loc: "/", priority: "1.0", changefreq: "daily" },
      { loc: "/products", priority: "0.9", changefreq: "daily" },
      { loc: "/blog", priority: "0.7", changefreq: "weekly" },
      { loc: "/sale", priority: "0.8", changefreq: "daily" },
      { loc: "/design-studio", priority: "0.7", changefreq: "monthly" },
      { loc: "/about", priority: "0.6", changefreq: "monthly" },
      { loc: "/faq", priority: "0.6", changefreq: "monthly" },
      { loc: "/size-guide", priority: "0.5", changefreq: "monthly" },
      { loc: "/track", priority: "0.6", changefreq: "monthly" },
      { loc: "/shipping-policy", priority: "0.5", changefreq: "monthly" },
      { loc: "/return-policy", priority: "0.5", changefreq: "monthly" },
      { loc: "/privacy-policy", priority: "0.4", changefreq: "monthly" },
      { loc: "/terms-of-service", priority: "0.4", changefreq: "monthly" },
      { loc: "/referral", priority: "0.5", changefreq: "monthly" },
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
    xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n`;
    xml += `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n\n`;

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}${page.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="en-BD" href="${SITE_URL}${page.loc}"/>\n`;
      xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${page.loc}"/>\n`;
      xml += `  </url>\n`;
    }

    for (const cat of categories) {
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/products?category=${encodeURIComponent(cat.slug)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `  </url>\n`;
    }

    for (const product of products) {
      const lastmod = product.updatedAt
        ? new Date(product.updatedAt).toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/product/${product.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      if (product.imageUrl) {
        xml += `    <image:image>\n`;
        xml += `      <image:loc>${escapeXml(product.imageUrl)}</image:loc>\n`;
        xml += `      <image:title>${escapeXml(product.name)}</image:title>\n`;
        xml += `    </image:image>\n`;
      }
      xml += `  </url>\n`;
    }

    for (const post of blogPosts) {
      const lastmod = post.updatedAt
        ? new Date(post.updatedAt).toISOString().split("T")[0]
        : today;
      xml += `  <url>\n`;
      xml += `    <loc>${SITE_URL}/blog/${post.slug}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.6</priority>\n`;
      xml += `  </url>\n`;
    }

    xml += `\n</urlset>\n`;

    res.header("Content-Type", "application/xml");
    res.header("Cache-Control", "public, max-age=3600");
    res.send(xml);
  } catch (err) {
    console.error("Sitemap generation failed:", err);
    res.status(500).send("Sitemap generation failed");
  }
});

router.get("/robots.txt", (_req, res) => {
  const robotsTxt = [
    "User-agent: *",
    "Allow: /",
    "",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /checkout",
    "Disallow: /account",
    "Disallow: /login",
    "Disallow: /signup",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
  ].join("\n");

  res.header("Content-Type", "text/plain");
  res.header("Cache-Control", "public, max-age=86400");
  res.send(robotsTxt);
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export default router;
