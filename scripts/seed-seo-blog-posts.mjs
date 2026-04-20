#!/usr/bin/env node
/**
 * Idempotent SEO blog seeder.
 * Inserts 6 keyword-targeted posts for trynexshop.com if they don't already exist.
 * Each post gets BlogPosting + FAQPage JSON-LD baked into its `content` (HTML).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/seed-seo-blog-posts.mjs
 */
import pg from "pg";

const SITE_URL = "https://trynexshop.com";
const AUTHOR = "TryNex Lifestyle Editorial";

const POSTS = [
  {
    slug: "best-custom-tshirt-printing-bangladesh",
    title: "Best Custom T-Shirt Printing in Bangladesh — 2026 Buyer's Guide",
    excerpt: "Compare DTF, screen and sublimation printing in Bangladesh. Learn what TryNex Lifestyle uses, prices, turnaround time and how to get the sharpest result for your custom tee.",
    keyword: "custom t-shirt printing bangladesh",
    faqs: [
      { q: "How much does custom t-shirt printing cost in Bangladesh?", a: "TryNex Lifestyle starts at ৳399 for a single-color print on a premium combed-cotton tee, with bulk pricing from ৳299 each above 25 pieces. Full-color DTF prints start at ৳549." },
      { q: "How long does delivery take?", a: "Most orders ship within 48 hours from our Dhaka facility. Standard delivery is 1 day inside Dhaka and 2–4 days for the other 63 districts." },
      { q: "Can I upload my own design?", a: "Yes — use the Design Studio, upload PNG/JPG/SVG, position it live on the 3D mockup, and add to cart. Background removal and HD upscale are one click." },
    ],
  },
  {
    slug: "personalized-mug-gift-bangladesh",
    title: "Personalized Mug Gifts in Bangladesh — Photo, Name & Logo Mugs",
    excerpt: "Looking for a thoughtful birthday or anniversary gift? Personalized photo mugs from TryNex are dishwasher-safe, Grade-A ceramic, and ready in 48 hours.",
    keyword: "personalized mug bangladesh",
    faqs: [
      { q: "Are TryNex mugs dishwasher-safe?", a: "Yes. We use sublimation-coated Grade-A ceramic that survives 500+ dishwasher cycles without fading." },
      { q: "Can I print on both sides of the mug?", a: "Absolutely. The Design Studio lets you set independent front and back artwork before checkout." },
    ],
  },
  {
    slug: "custom-hoodie-design-online-bangladesh",
    title: "Design Your Own Hoodie Online in Bangladesh — Step-by-Step",
    excerpt: "Walk through TryNex's online hoodie designer: pick a color, drop in your art, see a live 3D preview, and get it delivered nationwide in 3 days.",
    keyword: "custom hoodie bangladesh",
    faqs: [
      { q: "What hoodie weight do you offer?", a: "Our standard pullover is 320 GSM brushed-fleece, perfect for Dhaka winter. Premium zip-ups are 380 GSM." },
      { q: "Do you offer XS to 4XL sizing?", a: "Yes — every hoodie is stocked from S to 3XL, with 4XL available on request at no extra charge." },
    ],
  },
  {
    slug: "corporate-gift-hampers-dhaka",
    title: "Corporate Gift Hampers in Dhaka — Branded for Every Budget",
    excerpt: "From employee onboarding kits to client thank-you boxes, build a fully branded hamper of mugs, tees, caps and notebooks with TryNex's hamper builder.",
    keyword: "corporate gift hampers dhaka",
    faqs: [
      { q: "What is the minimum order quantity for hampers?", a: "Just 5 hampers. Volume discounts kick in at 25 and 100 units." },
      { q: "Can you deliver pre-built hampers to multiple addresses?", a: "Yes — share an Excel of recipient addresses and we'll dispatch each hamper individually anywhere in Bangladesh." },
    ],
  },
  {
    slug: "couple-tshirt-design-ideas",
    title: "20 Couple T-Shirt Design Ideas You Can Print Today",
    excerpt: "King & Queen, Tom & Jerry, matching anniversary dates — see 20 trending couple-tee concepts ready to customize on TryNex Design Studio.",
    keyword: "couple t-shirt design",
    faqs: [
      { q: "Can I order one Small and one Large together?", a: "Yes. Each tee in the order has its own size, color and print selection." },
      { q: "Do couple tees come in matching colors?", a: "We stock 20+ shades and the Design Studio shows a live colour-matched preview before you check out." },
    ],
  },
  {
    slug: "cap-printing-customization-bangladesh",
    title: "Custom Cap Printing in Bangladesh — Embroidery vs Print",
    excerpt: "Embroidered logo cap or printed snapback? Compare durability, price and turnaround for custom caps in Bangladesh and order from TryNex.",
    keyword: "custom cap bangladesh",
    faqs: [
      { q: "Do you offer embroidery on caps?", a: "Yes. Up to 8,000 stitches included free; larger logos are quoted per stitch count." },
      { q: "What cap styles can I customize?", a: "Snapback, dad cap, trucker, and bucket hat — all with curved or flat brim options." },
    ],
  },
];

const internalLinks = [
  { href: `${SITE_URL}/design-studio`, text: "Design Studio" },
  { href: `${SITE_URL}/products`, text: "Shop all custom apparel" },
  { href: `${SITE_URL}/hampers`, text: "Hamper builder" },
  { href: `${SITE_URL}/track`, text: "Track your order" },
];

function buildHtml(post) {
  const today = new Date().toISOString();
  const blogPostingLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    keywords: post.keyword,
    inLanguage: "en-BD",
    datePublished: today,
    dateModified: today,
    author: { "@type": "Organization", name: AUTHOR },
    publisher: {
      "@type": "Organization",
      name: "TryNex Lifestyle",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon-512.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/blog/${post.slug}` },
  };
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: post.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const intro = `<p>${post.excerpt}</p>
<p>If you're searching for <strong>${post.keyword}</strong> with reliable quality and fast delivery across Bangladesh, this guide is for you. TryNex Lifestyle has shipped 50,000+ custom orders nationwide since 2023, so we've packed every lesson into one place.</p>`;

  const faqHtml =
    `<h2>Frequently Asked Questions</h2>` +
    post.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join("");

  const linksHtml =
    `<h2>Ready to start?</h2><ul>` +
    internalLinks.map((l) => `<li><a href="${l.href}">${l.text}</a></li>`).join("") +
    `</ul>`;

  const ldHtml = `<script type="application/ld+json">${JSON.stringify(
    blogPostingLd
  )}</script><script type="application/ld+json">${JSON.stringify(faqLd)}</script>`;

  return `${intro}${faqHtml}${linksHtml}${ldHtml}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let inserted = 0,
    skipped = 0;
  for (const p of POSTS) {
    const exists = await client.query("SELECT id FROM blog_posts WHERE slug = $1", [p.slug]);
    if (exists.rows.length) {
      skipped++;
      continue;
    }
    const html = buildHtml(p);
    await client.query(
      `INSERT INTO blog_posts (slug, title, excerpt, content, author, published, image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, $6, NOW(), NOW())`,
      [
        p.slug,
        p.title,
        p.excerpt,
        html,
        AUTHOR,
        `${SITE_URL}/opengraph.jpg`,
      ]
    );
    inserted++;
    console.log(`✓ ${p.slug}`);
  }
  await client.end();
  console.log(`\nDone. Inserted: ${inserted}, skipped (already present): ${skipped}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
