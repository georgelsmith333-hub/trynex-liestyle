import { Router, type IRouter } from "express";
import { requireAdmin } from "../middlewares/adminAuth";
import { db, productsTable, categoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const FB_API = "https://graph.facebook.com/v19.0";

const KNOWN_COLORS = [
  "Black", "White", "Red", "Blue", "Green", "Yellow", "Orange", "Pink",
  "Purple", "Navy", "Gray", "Grey", "Brown", "Maroon", "Teal", "Cyan",
  "Olive", "Beige", "Coral", "Gold", "Silver", "Cream", "Lavender",
  "Burgundy", "Charcoal", "Ivory", "Khaki", "Magenta", "Peach", "Rust",
  "Salmon", "Tan", "Turquoise", "Violet", "Wine", "Ash", "Sky Blue",
  "Royal Blue", "Forest Green", "Mint", "Rose", "Sand", "Chocolate",
];

const KNOWN_SIZES = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "2XL", "3XL", "4XL", "5XL",
  "Free Size", "One Size",
];

function extractColorsFromText(text: string): string[] {
  const found: string[] = [];
  const upper = text.toUpperCase();
  for (const color of KNOWN_COLORS) {
    const regex = new RegExp(`\\b${color.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(text)) {
      if (!found.some(f => f.toUpperCase() === color.toUpperCase())) {
        found.push(color);
      }
    }
  }
  const hexMatches = text.match(/#[0-9A-Fa-f]{6}\b/g);
  if (hexMatches) found.push(...hexMatches);
  return found;
}

function extractSizesFromText(text: string): string[] {
  const found: string[] = [];
  for (const size of KNOWN_SIZES) {
    const regex = new RegExp(`\\b${size.replace(/\s+/g, "\\s+")}\\b`, "i");
    if (regex.test(text)) {
      if (!found.some(f => f.toUpperCase() === size.toUpperCase())) {
        found.push(size);
      }
    }
  }
  const rangeMatch = text.match(/\b((?:XXS|XS|S|M|L|XL|XXL|2XL|3XL)\s*[-–]\s*(?:XXS|XS|S|M|L|XL|XXL|2XL|3XL|4XL|5XL))\b/i);
  if (rangeMatch && found.length === 0) {
    const allSizes = ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL", "5XL"];
    const parts = rangeMatch[1].toUpperCase().split(/[-–]/).map(s => s.trim());
    const startIdx = allSizes.indexOf(parts[0]);
    const endIdx = allSizes.indexOf(parts[1]);
    if (startIdx >= 0 && endIdx >= 0 && startIdx <= endIdx) {
      return allSizes.slice(startIdx, endIdx + 1);
    }
  }
  return found;
}

function extractPriceFromText(text: string): { price: number | null; discountPrice: number | null } {
  const prices: number[] = [];
  const patterns = [
    /৳\s*([0-9,]+)/g,
    /([0-9,]+)\s*(?:taka|tk|BDT)/gi,
    /(?:price|মূল্য|দাম)[:\s]*৳?\s*([0-9,]+)/gi,
    /(?:only|just|মাত্র)[:\s]*৳?\s*([0-9,]+)/gi,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const val = parseInt(m[1].replace(/,/g, ""), 10);
      if (val > 0 && val < 100000 && !prices.includes(val)) prices.push(val);
    }
  }
  if (prices.length >= 2) {
    prices.sort((a, b) => a - b);
    return { price: prices[prices.length - 1], discountPrice: prices[0] };
  }
  if (prices.length === 1) return { price: prices[0], discountPrice: null };
  return { price: null, discountPrice: null };
}

function generateSEOTitle(rawTitle: string, category?: string): string {
  let title = rawTitle
    .replace(/[#*🔥🎉💥✨🎁❤️💯🔴⚡️]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const lines = title.split(/\n/).filter(Boolean);
  title = lines[0] || title;

  title = title.replace(/^\W+/, "").trim();

  if (title.length > 130) {
    title = title.slice(0, 127) + "...";
  }

  if (title.length < 20 && category) {
    title = `${title} - Premium ${category} Bangladesh`;
  }

  const keywords = ["Custom", "Premium", "Bangladesh", "TryNex"];
  const hasKeyword = keywords.some(k => title.toLowerCase().includes(k.toLowerCase()));
  if (!hasKeyword && title.length < 100) {
    title = `${title} | Custom Apparel BD`;
  }

  if (title.length > 130) {
    title = title.slice(0, 127) + "...";
  }

  return title;
}

function extractCategoryGuess(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\b(t-?shirt|tee|jersey)\b/i.test(lower)) return "T-Shirts";
  if (/\b(hoodie|hoody|sweatshirt)\b/i.test(lower)) return "Hoodies";
  if (/\b(cap|hat|snapback|beanie)\b/i.test(lower)) return "Caps";
  if (/\b(mug|cup)\b/i.test(lower)) return "Mugs";
  if (/\b(polo)\b/i.test(lower)) return "Polo Shirts";
  if (/\b(jacket|bomber)\b/i.test(lower)) return "Jackets";
  if (/\b(bag|tote|backpack)\b/i.test(lower)) return "Bags";
  return null;
}

function parsePostData(post: any) {
  const images: string[] = [];
  if (post.full_picture) images.push(post.full_picture);
  if (post.attachments?.data) {
    for (const att of post.attachments.data) {
      if (att.media?.image?.src && !images.includes(att.media.image.src)) {
        images.push(att.media.image.src);
      }
      if (att.subattachments?.data) {
        for (const sub of att.subattachments.data) {
          if (sub.media?.image?.src && !images.includes(sub.media.image.src)) {
            images.push(sub.media.image.src);
          }
        }
      }
    }
  }

  const message = (post.message || "").trim();
  const { price, discountPrice } = extractPriceFromText(message);
  const colors = extractColorsFromText(message);
  const sizes = extractSizesFromText(message);
  const categoryGuess = extractCategoryGuess(message);

  const lines = message.split("\n").filter(Boolean);
  const rawName = lines[0]?.replace(/[#*]/g, "").trim().slice(0, 200) || "Imported Product";
  const suggestedName = generateSEOTitle(rawName, categoryGuess || undefined);

  return {
    id: post.id,
    message,
    images,
    createdTime: post.created_time,
    permalink: post.permalink_url,
    suggestedName,
    suggestedPrice: price,
    suggestedDiscountPrice: discountPrice,
    suggestedColors: colors,
    suggestedSizes: sizes.length > 0 ? sizes : ["S", "M", "L", "XL", "XXL"],
    suggestedCategory: categoryGuess,
    hasImages: images.length > 0,
  };
}

function extractPostIdFromUrl(url: string): { postId: string | null; type: "facebook" | "instagram" | "unknown" } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "").replace("m.", "");

    if (host.includes("facebook.com") || host.includes("fb.com") || host.includes("fb.watch")) {
      const pathParts = u.pathname.split("/").filter(Boolean);

      const fbidParam = u.searchParams.get("fbid");
      if (fbidParam) return { postId: fbidParam, type: "facebook" };

      const storyFbid = u.searchParams.get("story_fbid");
      if (storyFbid) return { postId: storyFbid, type: "facebook" };

      const postsIdx = pathParts.indexOf("posts");
      if (postsIdx >= 0 && pathParts[postsIdx + 1]) {
        return { postId: pathParts[postsIdx + 1], type: "facebook" };
      }

      const photoIdx = pathParts.indexOf("photos");
      if (photoIdx >= 0) {
        const photoId = pathParts[photoIdx + 2] || pathParts[photoIdx + 1];
        if (photoId && /^\d+$/.test(photoId)) return { postId: photoId, type: "facebook" };
      }

      if (pathParts.includes("permalink") || pathParts.includes("permalink.php")) {
        const id = u.searchParams.get("id") || u.searchParams.get("story_fbid");
        if (id) return { postId: id, type: "facebook" };
      }

      for (const part of pathParts) {
        if (/^\d{10,}$/.test(part)) return { postId: part, type: "facebook" };
      }

      const pfbid = pathParts.find(p => p.startsWith("pfbid"));
      if (pfbid) return { postId: pfbid, type: "facebook" };

      return { postId: null, type: "facebook" };
    }

    if (host.includes("instagram.com")) {
      const pathParts = u.pathname.split("/").filter(Boolean);
      if ((pathParts[0] === "p" || pathParts[0] === "reel") && pathParts[1]) {
        return { postId: pathParts[1], type: "instagram" };
      }
      return { postId: null, type: "instagram" };
    }

    return { postId: null, type: "unknown" };
  } catch {
    return { postId: null, type: "unknown" };
  }
}

router.post("/admin/facebook/posts", requireAdmin, async (req, res) => {
  try {
    const { pageId, accessToken } = req.body;

    if (!pageId || !accessToken) {
      res.status(400).json({ error: "validation_error", message: "pageId and accessToken are required" });
      return;
    }

    const fields = "message,full_picture,created_time,permalink_url,attachments{media,subattachments}";
    const url = `${FB_API}/${pageId}/posts?fields=${fields}&limit=30&access_token=${accessToken}`;

    const fbRes = await fetch(url);
    const fbData = await fbRes.json() as any;

    if (fbData.error) {
      res.status(400).json({
        error: "facebook_error",
        message: fbData.error.message || "Failed to fetch Facebook posts",
        code: fbData.error.code,
      });
      return;
    }

    const posts = (fbData.data || []).map(parsePostData).filter((p: any) => p.hasImages);
    res.json({ posts, total: posts.length });
  } catch (err) {
    req.log.error({ err }, "Facebook posts fetch failed");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch posts" });
  }
});

router.post("/admin/social/fetch-url", requireAdmin, async (req, res) => {
  try {
    const { url: postUrl, accessToken } = req.body;

    if (!postUrl) {
      res.status(400).json({ error: "validation_error", message: "Post URL is required" });
      return;
    }

    const { postId, type } = extractPostIdFromUrl(postUrl);

    if (type === "instagram") {
      try {
        const oembedUrl = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&access_token=${accessToken || ""}`;
        const oRes = await fetch(oembedUrl);
        const oData = await oRes.json() as any;

        if (oData.error && accessToken) {
          const igFields = "caption,media_type,media_url,thumbnail_url,timestamp,permalink,children{media_url,media_type}";
          const igUrl = `${FB_API}/${postId}?fields=${igFields}&access_token=${accessToken}`;
          const igRes = await fetch(igUrl);
          const igData = await igRes.json() as any;

          if (!igData.error) {
            const images: string[] = [];
            if (igData.media_url) images.push(igData.media_url);
            if (igData.thumbnail_url) images.push(igData.thumbnail_url);
            if (igData.children?.data) {
              for (const child of igData.children.data) {
                if (child.media_url && !images.includes(child.media_url)) {
                  images.push(child.media_url);
                }
              }
            }

            const message = igData.caption || "";
            const { price, discountPrice } = extractPriceFromText(message);
            const colors = extractColorsFromText(message);
            const sizes = extractSizesFromText(message);
            const categoryGuess = extractCategoryGuess(message);
            const lines = message.split("\n").filter(Boolean);
            const rawName = lines[0]?.replace(/[#*@]/g, "").trim().slice(0, 200) || "Imported Product";

            res.json({
              post: {
                id: postId || "ig-import",
                message,
                images,
                createdTime: igData.timestamp,
                permalink: igData.permalink || postUrl,
                suggestedName: generateSEOTitle(rawName, categoryGuess || undefined),
                suggestedPrice: price,
                suggestedDiscountPrice: discountPrice,
                suggestedColors: colors,
                suggestedSizes: sizes.length > 0 ? sizes : ["S", "M", "L", "XL", "XXL"],
                suggestedCategory: categoryGuess,
                hasImages: images.length > 0,
              },
              source: "instagram",
            });
            return;
          }
        }

        if (!oData.error) {
          const thumbUrl = oData.thumbnail_url || "";
          const title = oData.title || "";
          const authorName = oData.author_name || "";
          const htmlContent = oData.html || "";

          const imgMatches = htmlContent.match(/src="([^"]+)"/g) || [];
          const images: string[] = [];
          if (thumbUrl) images.push(thumbUrl);
          for (const m of imgMatches) {
            const src = m.replace('src="', '').replace('"', '');
            if (src && !images.includes(src)) images.push(src);
          }

          const caption = title || authorName;
          const { price, discountPrice } = extractPriceFromText(caption);
          const colors = extractColorsFromText(caption);
          const sizes = extractSizesFromText(caption);
          const categoryGuess = extractCategoryGuess(caption);

          res.json({
            post: {
              id: postId || "ig-oembed",
              message: caption,
              images,
              permalink: postUrl,
              suggestedName: generateSEOTitle(caption || "Instagram Product", categoryGuess || undefined),
              suggestedPrice: price,
              suggestedDiscountPrice: discountPrice,
              suggestedColors: colors,
              suggestedSizes: sizes.length > 0 ? sizes : ["S", "M", "L", "XL", "XXL"],
              suggestedCategory: categoryGuess,
              hasImages: images.length > 0,
            },
            source: "instagram_oembed",
          });
          return;
        }

        res.status(400).json({
          error: "instagram_error",
          message: "Could not fetch Instagram post. Try providing an access token or use a public post URL.",
        });
        return;
      } catch (igErr) {
        res.status(400).json({
          error: "instagram_error",
          message: "Failed to fetch Instagram post. The post may be private.",
        });
        return;
      }
    }

    if (type === "facebook") {
      if (!accessToken) {
        res.status(400).json({
          error: "auth_required",
          message: "A Page Access Token is required to fetch Facebook posts. Enter it in the settings above.",
        });
        return;
      }

      let fbPostId = postId;

      if (!fbPostId || fbPostId.startsWith("pfbid")) {
        try {
          const oembedUrl = `${FB_API}/oembed_post?url=${encodeURIComponent(postUrl)}&access_token=${accessToken}`;
          const oRes = await fetch(oembedUrl);
          const oData = await oRes.json() as any;
          if (oData.html) {
            const idMatch = oData.html.match(/data-href="[^"]*\/(\d+)/);
            if (idMatch) fbPostId = idMatch[1];
          }
        } catch {}
      }

      if (fbPostId) {
        const fields = "message,full_picture,created_time,permalink_url,attachments{media,subattachments}";
        const fbUrl = `${FB_API}/${fbPostId}?fields=${fields}&access_token=${accessToken}`;
        const fbRes = await fetch(fbUrl);
        const fbData = await fbRes.json() as any;

        if (!fbData.error) {
          const parsed = parsePostData(fbData);
          res.json({ post: parsed, source: "facebook" });
          return;
        }

        if (fbData.error?.code === 100) {
          try {
            const pageIdFromUrl = new URL(postUrl).pathname.split("/").filter(Boolean)[0];
            if (pageIdFromUrl) {
              const compositeId = `${pageIdFromUrl}_${fbPostId}`;
              const fbUrl2 = `${FB_API}/${compositeId}?fields=${fields}&access_token=${accessToken}`;
              const fbRes2 = await fetch(fbUrl2);
              const fbData2 = await fbRes2.json() as any;
              if (!fbData2.error) {
                const parsed = parsePostData(fbData2);
                res.json({ post: parsed, source: "facebook" });
                return;
              }
            }
          } catch {}
        }

        res.status(400).json({
          error: "facebook_error",
          message: fbData.error?.message || "Could not fetch this post. The post may be private or the token may lack permissions.",
        });
        return;
      }

      res.status(400).json({
        error: "parse_error",
        message: "Could not extract a post ID from this URL. Try copying the URL directly from the post's share button.",
      });
      return;
    }

    res.status(400).json({
      error: "unsupported_url",
      message: "This URL is not recognized as a Facebook or Instagram post. Please paste a direct post link.",
    });
  } catch (err) {
    req.log.error({ err }, "Social URL fetch failed");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch post from URL" });
  }
});

router.post("/admin/facebook/import", requireAdmin, async (req, res) => {
  try {
    const { name, description, price, discountPrice, imageUrl, images, category, stock, sizes, colors, tags } = req.body;

    if (!name || !price || !imageUrl) {
      res.status(400).json({ error: "validation_error", message: "name, price, and imageUrl are required" });
      return;
    }

    let categoryId: number | null = null;
    if (category) {
      const cats = await db.select().from(categoriesTable).where(eq(categoriesTable.name, category)).limit(1);
      if (cats.length > 0) {
        categoryId = cats[0].id;
      } else {
        const catSlug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const newCat = await db.insert(categoriesTable).values({ name: category, slug: catSlug }).returning();
        categoryId = newCat[0].id;
      }
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) + "-" + Date.now();

    const [product] = await db.insert(productsTable).values({
      name,
      slug,
      description: description || "",
      price: String(price),
      discountPrice: discountPrice ? String(discountPrice) : null,
      imageUrl,
      images: Array.isArray(images) ? images : [],
      categoryId,
      stock: stock || 50,
      sizes: Array.isArray(sizes) ? sizes : [],
      colors: Array.isArray(colors) ? colors : [],
      tags: Array.isArray(tags) ? tags : [],
      featured: false,
      customizable: true,
      rating: "4.9",
    }).returning();

    if (categoryId) {
      try {
        await db.execute(
          `UPDATE categories SET product_count = (SELECT COUNT(*) FROM products WHERE category_id = ${categoryId}) WHERE id = ${categoryId}`
        );
      } catch {}
    }

    res.status(201).json({ success: true, product });
  } catch (err) {
    req.log.error({ err }, "Facebook import failed");
    res.status(500).json({ error: "internal_error", message: "Import failed" });
  }
});

export default router;
