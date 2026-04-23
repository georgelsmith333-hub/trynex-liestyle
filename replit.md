# TryNex Lifestyle - E-Commerce Platform

## Overview

TryNex Lifestyle is a full-stack e-commerce platform specializing in premium custom apparel from Bangladesh. The project aims to provide a robust online storefront, an efficient administration panel, and a unique design studio for personalized products. It leverages a modern tech stack to ensure high performance, scalability, and a rich user experience, targeting the growing market for custom fashion.

## User Preferences

I prefer iterative development with clear communication before significant changes. Please prioritize high-level features and architectural decisions. I want to be informed about the implications of any proposed changes, especially concerning database interactions and user data. Ensure that user-facing data is never auto-reset, replaced, or seeded by code deployments. Always confirm major architectural shifts or external dependency integrations.

## System Architecture

The platform is built as a pnpm workspace monorepo using TypeScript.

### Storefront
-   **Technology**: React 19, Vite 7, Tailwind CSS v4, Framer Motion, Radix UI, shadcn-style components.
-   **Routing**: `wouter`.
-   **State Management**: TanStack React Query for server data.
-   **Features**: PWA support, rich text editor (Tiptap) for admin blog, dynamic GPU-heavy effects gated to large screens for performance optimization on mobile.
-   **UI/UX**: Responsive design verified across various mobile viewports, adherence to touch target guidelines, correct mobile keyboard types for form inputs, iOS auto-zoom prevention. Product cards maintain consistent alignment regardless of content length.

### API Server
-   **Technology**: Express 5, TypeScript.
-   **Functionality**: Manages 18+ route modules including products, orders, categories, authentication, blog, reviews, settings, and administration.
-   **Security**: Rate limiting on all critical endpoints (auth, admin login, orders, reviews, promo codes, order tracking, public reads). JWT authentication for admin panel. Admin token uses dual defense: `sessionStorage` in the browser + HttpOnly Secure cookie set by the server simultaneously. CSRF protection on cookie-only admin mutations. Graceful SIGTERM/SIGINT shutdown with 10s drain window (required by Render free tier).
-   **Database Integration**: Auto-migration and auto-seeding on startup for new databases.
-   **Reviews**: `verified` flag correctly stored on insert (checks if reviewer email has matching order). productId type-safe comparison with `Number()` on both sides.

### Database
-   **Technology**: PostgreSQL with Drizzle ORM.
-   **Schema**: Defined in `lib/db/src/schema/index.ts` with tables for admins, settings, categories, products, orders, blog posts, customers, testimonials, promo codes, reviews, and referrals.
-   **Data Preservation**: Migrations are non-destructive, using `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. `autoSeedIfEmpty()` only runs on empty databases.

### Key Business Features
-   **Products**: Custom apparel (t-shirts, hoodies, mugs, caps).
-   **Currency**: BDT (Bangladeshi Taka).
-   **Payment**: COD, bKash, Nagad, Rocket, Card. Free shipping threshold at ৳1500.
-   **Admin Panel**: Comprehensive management for products, orders, blog, settings, and users. Includes GitHub integration for automated deployments.
-   **Design Studio**: Realtime custom apparel designer with photographic mockup templates and precise print area calibration.
-   **Social Integration**: Facebook product import, Google/Facebook sign-in.
-   **Marketing**: Referral system, promo codes, product review system.
-   **SEO & Performance**: Canonical domain `https://trynexshop.com`. SEOHead auto-generates canonical URLs from the current route when no explicit prop is given, so every page always has a canonical. `hreflang` tags (`en-BD` + `x-default`) on all pages. Google Search Console verification meta tag driven by `googleSiteVerification` setting (no code deploy needed). Structured data (JSON-LD) for key pages (Product, BreadcrumbList, BlogPosting, FAQPage, etc.). Optimized LCP and Core Web Vitals through image preloading, explicit dimensions, font subsetting, and API preconnects. Dynamic sitemap and robots.txt.
-   **Admin token security**: Stored in `sessionStorage` (not `localStorage`) — clears on tab/window close. Server simultaneously sets an HttpOnly Secure cookie as a second auth layer. One-time migration on app load moves any legacy localStorage token to sessionStorage without disrupting existing sessions.
-   **React Query caching**: Default staleTime upgraded from 30s to 3 minutes; gcTime 10 minutes. Reduces redundant API calls significantly on typical browsing sessions.
-   **TrackingPixels**: Reads from SiteSettingsContext (already loaded globally) instead of triggering a duplicate `/settings` API call.
-   **Cart Performance**: Optimized with split contexts, debounced `localStorage` writes, and memoized components to minimize re-renders.

## Search-Engine Submission Checklist (post-deploy)

After every Render deploy, complete these three steps to keep search engines fresh:

1. **Google Search Console** — open https://search.google.com/search-console, select the `trynexshop.com` property, go to Sitemaps, and submit `https://trynexshop.com/sitemap.xml`. Then use the URL Inspection tool on the homepage and request indexing.
2. **Bing Webmaster Tools** — open https://www.bing.com/webmasters, select the property, go to Sitemaps, and submit `https://trynexshop.com/sitemap.xml`. Use Submit URLs to push the homepage and any new product/blog URLs.
3. **Render env vars** — confirm `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `JWT_SECRET`, `ADMIN_JWT_SECRET` (must be distinct from `JWT_SECRET`; production auth refuses to start without it), `ADMIN_PASSWORD`, `ALLOWED_ORIGINS` (comma-separated; production refuses to start without this), `GOOGLE_CLIENT_ID` (the storefront reads `settings` table key `googleClientId`; the API now falls back to this env var when that DB row is absent so one-tap login keeps working under partial misconfig), and `DATABASE_URL` are all set on the Render service so storage uploads, signed downloads, social sign-in, and admin login work in production.

## Auth health check (post-deploy)

Three diagnostic endpoints are available:

* **`GET /api/health/auth`** — strict-contract endpoint for monitors / smoke checks. Returns ONLY `{ google_configured, jwt_secret_present, db_reachable }`.
* **`GET /api/auth/health`** — extended diagnostic. Adds `admin_jwt_secret_present`, `allowed_origins_configured`, `customers_table_exists`, `guest_sequence_column_exists`, `node_env`.
* **`GET /api/health/storage`** — storage backend diagnostic. Returns `{ backend: "r2" | "s3" | "replit", portable: bool, reachable: bool, error: string | null }`. In production `backend` MUST be `"r2"` or `"s3"` and `reachable` MUST be `true`; if `backend` is `"replit"` the server would have refused to start at boot, so this endpoint will not respond at all in that case.

Verify in 5 seconds:

```bash
curl https://<your-render-host>/api/health/auth   # strict 3-boolean check
curl https://<your-render-host>/api/auth/health   # full diagnostic
```

Expected response (all `true`):

```json
{
  "google_configured": true,
  "jwt_secret_present": true,
  "admin_jwt_secret_present": true,
  "allowed_origins_configured": true,
  "db_reachable": true,
  "customers_table_exists": true,
  "guest_sequence_column_exists": true,
  "node_env": "production"
}
```

Any `false` value points directly at the missing config. `google_configured: false` → set `GOOGLE_CLIENT_ID` in Render env. `db_reachable: false` → check `DATABASE_URL`. `guest_sequence_column_exists: false` → migrations did not run; restart the service to trigger auto-migration.

## Incident Log

### April 2026 — Blank homepage on trynexshop.com (P0, resolved)
- **Symptom:** Returning visitors saw a blank white screen on `/`. Other routes worked.
- **Root cause:** `vite.config.ts` precaches `/offline.html` via `additionalManifestEntries`, but the file didn't exist in `public/`. Workbox's SW install therefore failed → new SW never activated → the previously installed (broken) SW kept serving cached empty navigation responses.
- **Fixes shipped:** created `public/offline.html`; added 30s SW self-unregister safety net if `activate` never fires; navigation handler now requires HTML content-type + non-zero body before returning a cached response and falls back to network when offline page is unavailable; pre-hydration brand splash + 18s watchdog in `index.html` so visitors never see a totally blank screen (loop-guarded to 2 attempts / 10 min); bumped `CURRENT_BUILD` to `2026.04.21-blank-homepage-fix-offline-html` to nuke stale SWs for returning visitors.
- **Prevention:** every release that changes precache entries must (a) verify referenced files exist via `pnpm build`, and (b) bump `CURRENT_BUILD` in `src/lib/cache-recovery.ts`.

## Replit Independence

Production is **fully Replit-independent**. The Replit GCS sidecar (object storage fallback) is the lowest-priority backend and is only activated in the Replit dev sandbox when no R2/S3 env vars are set. In production (`NODE_ENV=production`) the server hard-exits at boot if the storage backend resolves to `"replit"`, preventing silent failures on Render.

Full audit: `docs/replit-independence.md`

Production topology:
- **Storefront** — Cloudflare Pages (static build)
- **API** — Render Web Service (Express 5)
- **Database** — Standard PostgreSQL via `DATABASE_URL` (any provider: Render, Supabase, Neon, etc.)
- **Object storage** — Cloudflare R2 via S3-compatible API (`R2_*` env vars)

No component depends on `*.replit.dev`, `*.repl.co`, or the Replit Object Storage sidecar in production.

## External Dependencies

-   **Hosting**: Cloudflare Pages (storefront), Render (API server).
-   **Database**: PostgreSQL (any standard provider — Render, Supabase, Neon, etc.).
-   **Object Storage**: Cloudflare R2 (production) via S3-compatible API; Replit GCS sidecar (dev fallback only).
-   **Authentication**: Google OAuth 2.0, Facebook Login.
-   **Monitoring**: External HTTP keep-alive monitor (e.g., UptimeRobot).
-   **Analytics/Tracking**: Google Analytics 4 (GA4), Google Tag Manager (GTM), Meta Pixel.
-   **Social Media**: WhatsApp for order support.
-   **Build Tools**: pnpm workspaces, Vite, esbuild.