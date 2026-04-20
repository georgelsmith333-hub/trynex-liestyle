/* Generates the TryNex Lifestyle product/engineering overview PDF. */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs/TryNex-Lifestyle-Overview.pdf");
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const doc = new PDFDocument({ size: "A4", margin: 56, info: {
  Title: "TryNex Lifestyle — Product & Engineering Overview",
  Author: "TryNex Lifestyle",
  Subject: "Custom apparel e-commerce platform overview",
}});
doc.pipe(fs.createWriteStream(OUT));

const ORANGE = "#E85D04";
const DARK = "#0f172a";
const GREY = "#475569";

function h1(text) {
  doc.moveDown(0.4);
  doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(22).text(text);
  doc.moveTo(56, doc.y).lineTo(539, doc.y).strokeColor(ORANGE).lineWidth(1.5).stroke();
  doc.moveDown(0.6);
}
function h2(text) {
  doc.moveDown(0.5);
  doc.fillColor(DARK).font("Helvetica-Bold").fontSize(14).text(text);
  doc.moveDown(0.2);
}
function p(text) {
  doc.fillColor(GREY).font("Helvetica").fontSize(10.5).text(text, { align: "justify", lineGap: 2 });
  doc.moveDown(0.3);
}
function bullets(items) {
  doc.fillColor(GREY).font("Helvetica").fontSize(10.5);
  for (const it of items) doc.text("• " + it, { indent: 12, lineGap: 2 });
  doc.moveDown(0.3);
}

// Cover
doc.fillColor(ORANGE).font("Helvetica-Bold").fontSize(34).text("TryNex Lifestyle", { align: "center" });
doc.moveDown(0.2);
doc.fillColor(DARK).fontSize(16).font("Helvetica").text("Premium Custom Apparel — Bangladesh", { align: "center" });
doc.moveDown(0.2);
doc.fillColor(GREY).fontSize(11).text("Product & Engineering Overview", { align: "center" });
doc.moveDown(0.5);
doc.fillColor(GREY).fontSize(10).text(new Date().toISOString().slice(0, 10), { align: "center" });
doc.moveDown(2);

h1("1. Product Summary");
p("TryNex Lifestyle is a full-stack custom-apparel e-commerce platform built for the Bangladesh market. Customers can browse premium T-shirts, hoodies, mugs, caps, and gift hampers, design their own products in a 3D-powered Design Studio, and place orders with cash-on-delivery, bKash, Nagad, Rocket, Upay, or card payments. The site is bilingual-aware (English + Bengali keywords) and ships to all 64 districts.");

h2("Key Customer Features");
bullets([
  "Catalog with category/price/rating filters and instant search",
  "Product detail with reviews, size/color variants, AR-style 3D preview",
  "Design Studio with image upload, AI background-remove, HD upscale, layers, fonts, presets",
  "3D realtime preview using react-three-fiber + GLB shirt mesh + canvas-composed UV textures",
  "Cart with 3D viewer of the saved design exactly as composed in studio",
  "Checkout with split shipping (Dhaka/outside), promo codes, COD 15% advance handling",
  "Guest checkout that auto-creates a user account and emails credentials",
  "Order tracking by phone + order number, real-time status updates for admins",
  "Blog system with categories, related posts, FAQ-aware structured data, share buttons",
]);

h2("Admin Features");
bullets([
  "Live orders dashboard (auto-refreshes every 3s, BroadcastChannel cross-tab sync)",
  "Order detail with payment-status workflow (pending → submitted → verified)",
  "Bulk and per-design original-asset download (15-min presigned URLs)",
  "Product, category, blog, hero, testimonial, promo-code, and site-settings CRUD",
  "Customer list with order history, UTM attribution capture per order",
]);

h1("2. Architecture");
p("The repo is a pnpm monorepo with three artifacts: the storefront (React 19 + Vite), the API server (Express 5), and a mockup-sandbox used for component prototyping. PostgreSQL with Drizzle ORM holds all data. Object storage uses an auto-detecting adapter (Cloudflare R2 / AWS S3 / local sidecar) so the platform is fully Replit-independent in production.");

h2("Stack");
bullets([
  "Frontend: React 19, Vite, Tailwind CSS, framer-motion, react-three-fiber, @tanstack/react-query, Wouter routing, vite-plugin-pwa",
  "Backend: Node 20, Express 5, Drizzle ORM, PostgreSQL, Pino structured logging, helmet, express-rate-limit, JWT admin sessions",
  "Storage: Cloudflare R2 (production) via @aws-sdk/client-s3 with auto-fallback to local sidecar in dev",
  "Auth: bcrypt password hash, Google + Facebook OAuth, guest auto-account creation",
  "Build/Deploy: Render web service (API) + static site (storefront), GitHub-connected auto-deploy",
]);

h2("Repository layout");
bullets([
  "artifacts/trynex-storefront — customer-facing SPA, served as static from Render",
  "artifacts/api-server — REST + JSON API, Drizzle migrations, sitemap/robots routes",
  "packages/api-spec — OpenAPI definition that codegens shared TS client",
  "packages/api-client-react — generated React Query hooks shared by storefront",
  "scripts/ — operational scripts (PDF gen, deploy webhooks)",
]);

h1("3. Security & Production Hardening");
bullets([
  "Helmet headers (frame-ancestors, X-Content-Type-Options, HSTS in production)",
  "Per-route rate limits: admin login (8/15m), auth (20/15m), orders (30/15m), tracking (20/5m), public reads (200/5m), promo (30/5m)",
  "Strict CORS allowlist via ALLOWED_ORIGINS — production refuses to start if unset",
  "Admin JWT secret must be 32+ chars in production, validated at boot",
  "Order tracking limiter prevents enumeration of TN-XXXXX numbers",
  "All admin write endpoints behind verifyAdminToken middleware",
  "DOMPurify sanitization of all user-rendered HTML (blog content)",
  "Presigned URLs (15 min TTL) for private original-design downloads",
]);

h1("4. SEO & Discoverability");
bullets([
  "Static SEO meta on every route via SEOHead component (title, description, canonical, OG, Twitter)",
  "Organization, WebSite SearchAction, ClothingStore (LocalBusiness), Product, BlogPosting, BreadcrumbList, FAQPage JSON-LD",
  "Bilingual keyword strategy (English + Bengali: কাস্টম গিফট বাংলাদেশ)",
  "Generated sitemap.xml + robots.txt served from API, mirrored at storefront root",
  "Image-aware sitemap entries for product detail pages",
  "Bengali-aware canonical = https://trynexshop.com",
  "Performance: preconnect to fonts/API, preload hero image, fetchpriority=high on LCP",
  "PWA manifest + service-worker offline page",
]);

h1("5. Order & Payment Flow");
p("A customer places an order; the API creates the order with a TN-XXXXX number, computes shipping (free over ৳1500 for Dhaka, configurable by district), applies promo code, and stores UTM attribution. For COD a 15% advance is requested; the customer chooses bKash/Nagad/etc., enters a transaction ID, and the admin verifies in the dashboard. Order status flows: pending → processing → shipped → ongoing → delivered, with cancellation supported at any pre-shipped stage. All status changes broadcast to other admin tabs via BroadcastChannel for sub-second cross-device sync.");

h1("6. Design Studio & 3D");
p("The Design Studio exposes a 1000×1000 SVG canvas where users place image and text layers within product-specific print zones. composer.ts re-renders these layers onto a 2D canvas (with destination-in alpha-masked color tinting so transparent corners never bleed onto cards). The same composer feeds the realtime react-three-fiber preview: tshirts use a real GLB mesh with UV-mapped overlay; mugs use a wide cylinder wrap; hoodies/caps/longsleeves use a curved silhouette panel. The cart 3D viewer reuses the composed texture so what the user saw in studio is exactly what they see in cart.");

h1("7. Operations");
bullets([
  "Hosting: Render web service (Express API) + Render static site (storefront build)",
  "DNS: trynexshop.com (root + www → Render)",
  "Object storage: Cloudflare R2 bucket via S3-compatible API",
  "Database: managed Postgres on Render or external provider, connection via DATABASE_URL",
  "Logs: structured JSON via pino, viewable in Render dashboard",
  "Deploy: git push main → GitHub → Render auto-builds both services",
  "Monitoring: /api/healthz endpoint for uptime checks",
]);

h2("Required production env vars");
bullets([
  "DATABASE_URL — Postgres connection string",
  "ADMIN_JWT_SECRET — 32+ chars",
  "ALLOWED_ORIGINS — comma-separated (https://trynexshop.com)",
  "ADMIN_PASSWORD — initial admin password",
  "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET — Cloudflare R2",
  "GOOGLE_CLIENT_ID / FACEBOOK_APP_ID — optional social login",
]);

h1("8. Manual Onboarding Checklist");
bullets([
  "Verify domain in Google Search Console + Bing Webmaster Tools, submit sitemap.xml",
  "Configure R2 bucket + CORS for image hosting",
  "Set DNS A/CNAME records to Render endpoints",
  "Set up Render auto-deploy webhook for both services",
  "Add Meta Pixel / Google Analytics IDs in Site Settings (admin)",
  "Seed initial categories, products, hero images, and blog posts",
]);

doc.end();
console.log("Wrote", OUT);
