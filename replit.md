# TryNex Lifestyle - E-Commerce Platform

## Overview

Full-stack e-commerce platform for TryNex Lifestyle, a premium custom apparel brand from Bangladesh. Built as a pnpm workspace monorepo with TypeScript.

## Production URLs & Auth Setup

- **Storefront** (Cloudflare Pages): `https://trynexshop.com`
- **API server** (Render): `https://trynex-api.onrender.com`
- **Admin panel**: `https://trynexshop.com/admin/login` — default password `Admins@Trynex` (overridable by setting `ADMIN_PASSWORD` env var on Render; the password auto-syncs to the env value on every login attempt).
- **Push to GitHub from Admin** → `Admin → Deployment`. Save your GitHub owner/repo/branch + a fine-grained PAT (Contents: Read & Write). The token is stored in the `settings` table and never echoed back to the browser. Hitting "Push to GitHub Now" stages all changes in the workspace, commits with your message, and pushes — Cloudflare Pages and Render then auto-deploy. The push command uses `execFile` (no shell), strict allowlist regexes for owner/repo/branch/email/token, and scrubs the PAT from any returned error/log output.

The storefront has the production API URL hardcoded as a fallback (`PRODUCTION_API_BASE_URL` in `artifacts/trynex-storefront/src/lib/utils.ts`), so it works even if `VITE_API_BASE_URL` is not set in Cloudflare Pages env. Only `localhost`/`127.0.0.1` use same-origin requests; every other host (including Cloudflare Pages preview URLs) hits the Render API directly. **Production has zero dependencies on any `*.replit.dev`, `*.repl.co`, or other Replit-hosted infrastructure.**

### Allowed production hosts (post Task #20 sweep)
- **Frontend origin**: `https://trynexshop.com` (Cloudflare Pages)
- **Backend origin**: `https://trynex-api.onrender.com` (Render)
- **API CORS allowlist**: controlled by the `ALLOWED_ORIGINS` env var on Render (comma-separated). Set this to `https://trynexshop.com` plus any Cloudflare Pages preview origin you want to enable. There are no Replit entries hardcoded in `artifacts/api-server/src/app.ts`. **In production (`NODE_ENV=production`) the API server refuses to start if `ALLOWED_ORIGINS` is unset** — this guarantees a misconfigured deploy can never silently fall back to a permissive `allow-all` CORS policy. In dev, a built-in default allowlist is used (`https://trynexshop.com` + localhost dev ports).
- **Cloudflare Pages `_redirects`**: only `/api/* → https://trynex-api.onrender.com/api/:splat` (proxy) + SPA fallback. No Replit hosts.
- The storefront `getApiBaseUrl()` no longer special-cases `.replit.dev`. The Replit dev environment, when used, just talks to the Render API like any other non-localhost host.

### Google sign-in setup (one-time, optional)
1. In Google Cloud Console, create an OAuth 2.0 Client ID (type: Web application).
2. Under "Authorized JavaScript origins" add: `https://trynexshop.com`
3. Copy the Client ID and paste it into Admin Settings → "Google Client ID".

### Facebook sign-in setup (one-time, optional)
1. At developers.facebook.com create an App (type: Consumer) and add the "Facebook Login" product.
2. Under Facebook Login → Settings → "Valid OAuth Redirect URIs" add: `https://trynexshop.com/`
3. Under App Settings → Basic, add `trynexshop.com` to "App Domains".
4. Copy the App ID and paste it into Admin Settings → "Facebook App ID".

If those fields are blank in Admin Settings, the social buttons simply hide on the login/signup pages — the rest of the site still works.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19 + Vite 7 + Tailwind CSS v4 + Framer Motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT for admin, cookie-based for customers
- **Build**: esbuild (CJS bundle for API server)

## Architecture

### Storefront (port 8081 → external 80)
- `artifacts/trynex-storefront/` — React + Vite SPA
- Routing via `wouter`
- State: TanStack React Query for server data
- UI: Radix UI + Tailwind v4 + shadcn-style components
- PWA support (service worker via vite-plugin-pwa)
- Rich text editor (Tiptap) for admin blog

### API Server (port 8080)
- `artifacts/api-server/` — Express 5 + TypeScript
- 18+ route modules: products, orders, categories, auth, blog, reviews, settings, admin, promoCodes, referrals, testimonials, publicStats, storage, backup, facebook, removeBg, sitemap, health
- Rate limiting on auth/order/promo endpoints
- JWT authentication for admin panel
- Auto-migration and auto-seed on startup

### Database (PostgreSQL)
- Tables: admins, settings, categories, products, orders, blog_posts, customers, testimonials, promo_codes, reviews, referrals
- Schema defined in `lib/db/src/schema/index.ts`
- Migrations run inline via `autoSeed.ts` at startup

## Key Business Features

- **Brand**: TryNex Lifestyle — premium custom apparel (t-shirts, hoodies, mugs, caps) from Bangladesh
- **Currency**: BDT (Bangladeshi Taka, ৳)
- **Payment methods**: COD (Cash on Delivery), bKash, Nagad, Rocket, Card
- **Free shipping** threshold: ৳1500
- **WhatsApp** order support: 01903426915
- **Admin panel**: `/admin/login` — default creds: admin / admin123
- **Design Studio**: custom apparel designer with canvas
- **Facebook Import**: import products from Facebook Ads
- **Blog**: full CMS with rich text editor
- **Referral system**: customer referral tracking
- **Promo codes**: percentage/fixed discount codes
- **Reviews**: product review system with approval workflow

## Admin Access

- URL: `/admin/login`
- Default username: `admin`
- Default password: `admin123`
- Secret access: tap footer element 5 times to reveal hidden link

## Key Commands

```bash
# Install all dependencies
pnpm install

# Start API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start storefront (port 8081)
pnpm --filter @workspace/trynex-storefront run dev

# Build for production
pnpm --filter @workspace/trynex-storefront run build
pnpm --filter @workspace/api-server run build

# Type check
pnpm --filter @workspace/trynex-storefront run typecheck
pnpm --filter @workspace/api-server run typecheck
```

## Package Structure

```
artifacts/
  api-server/        — Express API (port 8080)
  trynex-storefront/ — React Vite storefront (port 8081)
lib/
  api-client-react/  — React Query hooks + types for all API endpoints
  api-spec/          — OpenAPI spec + orval codegen
  api-zod/           — Zod schemas generated from OpenAPI
  db/                — Drizzle ORM schema + database client
```

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `JWT_SECRET` — Secret for signing customer JWTs (login/account tokens)
- `ADMIN_JWT_SECRET` — Separate secret for signing admin panel JWTs. Must be distinct from `JWT_SECRET` so a customer token cannot pass admin signature verification. Required in production.
- `SESSION_SECRET` — Legacy/session secret (still read in some places)
- `PORT` — Port for each service (set by Replit workflows)
- `API_PORT` — API server port for storefront proxy (default: 8080)

## Ports

- `8080` → API server (external 8080)
- `8081` → Storefront (external 80, main web)

## Mobile UX QA checklist (Task #21)

Before merging any new page or floating widget, verify on **iPhone SE (375)**, **iPhone 14 Pro (393)**, and **Pixel 7 (412)**:

- [ ] **No horizontal scroll** on Home, Products, ProductDetail, Cart, Checkout, Hampers, Account at widths 360–430. Long product names use `truncate`/`line-clamp`, hero images are `max-w-full`.
- [ ] **All tap targets ≥ 44×44px** (use the `.touch-target` utility for icon-only buttons).
- [ ] **All bottom-fixed floaters** (`WhatsAppButton`, `BackToTop`, `SocialProofToast`) honor BOTH `--mobile-sticky-offset` (set by ProductDetail when its sticky CTA bar is mounted, so floaters lift above it) AND `env(safe-area-inset-bottom)` (so they clear the iPhone home indicator). The pattern is `bottom: calc(<base> + var(--mobile-sticky-offset, 0px) + env(safe-area-inset-bottom, 0px))`.
- [ ] **Sticky bottom CTA bars** (e.g. ProductDetail) include `paddingBottom: 'calc(<base> + env(safe-area-inset-bottom, 0px))'` so the buttons clear the home indicator.
- [ ] **Modals/drawers** prefer `max-h-[100dvh]` over `100vh` and use the `.drawer-mobile` utility (which falls back to `-webkit-fill-available` on iOS Safari).
- [ ] **Form inputs** declare the right `type` AND a matching `inputMode` so the correct mobile keyboard appears:
  - Email → `type="email" inputMode="email" autoComplete="email" autoCapitalize="off"`
  - Phone → `type="tel" inputMode="tel" autoComplete="tel"` (BD format: `01XXXXXXXXX`)
  - Numeric (qty, postal code) → `inputMode="numeric"`
  - Order ID, promo code, tracking number → `autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}`
  - Names → `autoCapitalize="words" autoComplete="name"`
  - Add `enterKeyHint="next" | "done" | "search"` so the on-screen keyboard's primary action button matches the field's role.
- [ ] **iOS auto-zoom prevention**: input/select/textarea font-size ≥ 16px on mobile. Globally enforced via the `@media (max-width: 640px)` rule in `index.css`.
- [ ] **Empty / loading / error states**: every list-driven page renders a friendly empty state with a CTA, a skeleton loader (use `.skeleton`), and a non-blank error state instead of raw JSON.

The `--mobile-sticky-offset` CSS variable is the single source of truth for "how much vertical space is currently consumed by a sticky bottom CTA bar". Pages that mount such a bar should set it to the bar's height in a `useEffect` and reset it to `0px` on unmount (see `artifacts/trynex-storefront/src/pages/ProductDetail.tsx`). All floating widgets honor it automatically.

## Cart performance notes (Task #19)

The cart context (`artifacts/trynex-storefront/src/context/CartContext.tsx`) is split into two contexts to minimize re-renders:

- `CartStateContext` — `{ items, subtotal, itemCount }`. Subtotal and itemCount are computed in a single pass and memoized on `items`. Updates only when the cart actually changes.
- `CartActionsContext` — `{ addToCart, removeFromCart, updateQuantity, changeQuantity, clearCart }`. Actions are wrapped in `useCallback` with the functional `setItems` form, so they keep referential equality across renders. Cart line +/- buttons call `changeQuantity(id, ±1)` (delta-based, atomic inside `setItems`) so rapid mobile taps can't read stale quantities.
- `useCart()` is a backwards-compat combined hook. **Action-only consumers (ProductCard, ProductDetail, DesignStudio, HamperDetail, HamperBuilder, Wishlist) use `useCartActions()` instead** so they don't re-render when items change.
- `localStorage` writes are debounced 250ms and flushed on `visibilitychange`/`beforeunload` so rapid +/- clicks don't jank the main thread.
- `updateQuantity` returns the previous array reference if nothing actually changed, avoiding spurious renders.
- `Cart.tsx` and `CartDrawer.tsx` extract each cart row into a `React.memo`-wrapped subcomponent with stable callback props; cart line images use `loading="lazy" decoding="async"` with explicit width/height.

## SEO + Core Web Vitals (Task #22)

**Canonical domain**: `https://trynexshop.com` — used consistently across `index.html`, `SEOHead.tsx`, `sitemap.xml`, `robots.txt`, and all per-page `jsonLd` URLs. Previously `sitemap.xml` and `robots.txt` referenced the wrong `trynex.com.bd` host; corrected to match the production Cloudflare Pages domain.

### Per-route SEO (verified)
Every public route renders `SEOHead` with a unique `title`, `description`, and `canonical`. Routes audited and confirmed:
Home, Products, ProductDetail, Hampers, HamperDetail, HamperBuilder, DesignStudio, Cart, Checkout, Login, Signup, Wishlist, Account, TrackOrder, Blog, BlogPost, FAQ, About, Referral, Sale, Size Guide, Shipping/Return/Privacy/Terms policy, 404.

### Structured data (JSON-LD)
- **Home / index.html (global)**: Organization, WebSite (with SearchAction), ClothingStore (LocalBusiness with aggregateRating).
- **ProductDetail**: Product (price BDT, availability, brand, optional aggregateRating) + BreadcrumbList.
- **HamperDetail**: Product (priced in BDT, InStock, Gift Hamper category) + BreadcrumbList.
- **Hampers (list)**: BreadcrumbList + ItemList of up to 20 hampers.
- **FAQ**: FAQPage with all 18 questions.

### LCP / Core Web Vitals
- Hero fallback image (`/images/hero-bg.png`) preloaded with `fetchpriority="high"` from `index.html`.
- ProductDetail and HamperDetail main images render with explicit `width`/`height`, `decoding="async"`, and `fetchpriority="high"` to anchor LCP and prevent CLS.
- Hampers grid: first 3 cards `loading="eager"`, the rest `loading="lazy"`.
- Google Fonts subset trimmed to weights actually used (Outfit 400/600/700/800/900 + Plus Jakarta Sans 400-800) with `display=swap` to eliminate FOIT/CLS.
- Added `preconnect` to the Render API origin (`trynex-api.onrender.com`) and `dns-prefetch` for GTM + Facebook pixel domains.
- Global `<img>` tags across product cards already use `loading="lazy"`/`decoding="async"`/explicit dimensions (verified during the Cart / Products audit in Task #21).

### Sitemap + robots
- **Dynamic sitemap**: `https://trynexshop.com/sitemap.xml` and `/robots.txt` are now proxied by Cloudflare Pages (`public/_redirects`) directly to the API server's DB-backed endpoints (`artifacts/api-server/src/routes/sitemap.ts`). Every product, hamper, blog post, and category appears in the sitemap as soon as it is published — no manual regeneration required.
- **Static fallback**: `public/sitemap.xml` and `public/robots.txt` remain in the repo as a safety net for the (rare) case where the API is unreachable. Both list the canonical static routes (home, products + 4 category filter URLs, hampers, hampers/build, design-studio, sale, blog, about, faq, track, size-guide, referral, 4 policy pages). Lastmod 2026-04-19.
- robots.txt explicitly disallows `/admin/`, `/api/`, `/cart`, `/checkout`, `/wishlist`, `/account`, `?search=`, `?sort=`, and explicitly allows Googlebot, Bingbot, and facebookexternalhit.

### Measurement
Lighthouse mobile audit must be run against the live Cloudflare Pages URL (`https://trynexshop.com`) — the dev environment's localhost cannot produce representative CWV numbers because it bypasses the CDN, real network latency, and the production-built bundle. Task #23 (pre-launch deploy verification) executes this measurement against the live build and records before/after deltas. Baseline targets: ≥85 Performance, ≥95 SEO, ≥95 Best Practices on a Slow 4G + 4× CPU profile, with LCP < 2.5s, CLS < 0.1, INP < 200ms on Home and ProductDetail.

## Pre-launch verification (Task #23)

The end-to-end go/no-go checklist for paid-ad launch lives at `docs/launch-checklist.md`. It is operator-run against the **live** site (real browser, real Meta Pixel Helper, real COD test orders) — it cannot be automated from this dev environment.

### Verified production hostnames
| Layer | Provider | Hostname / identifier |
| --- | --- | --- |
| Storefront | Cloudflare Pages project `trynex-liestyle` (see `artifacts/trynex-storefront/wrangler.toml`) | `https://trynexshop.com` |
| API | Render web service | `https://trynex-api.onrender.com` |
| Database | Managed Postgres attached to the Render service via `DATABASE_URL` | n/a (private) |
| Sitemap & robots | Edge-rewritten by `_redirects` to the API's DB-backed routes | `/sitemap.xml`, `/robots.txt` |

### Security headers (set in `artifacts/trynex-storefront/public/_headers`)
Every HTML response from Cloudflare Pages now ships with:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Content-Security-Policy` — `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `upgrade-insecure-requests`; explicitly allows the Render API origin in `connect-src`, plus GTM / GA / Facebook Pixel / Google Sign-In / Facebook Login origins where actually used.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`.

### Tracking pixel surface (verified-in-checklist)
`TrackingPixels.tsx` lazy-initializes Meta Pixel + GA4 + Google Ads only if their IDs are filled in Admin → Settings. The launch checklist's section 5 walks the operator through verifying `PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, and `Purchase` in Meta Pixel Helper.

### What "done" means for Task #23
Checklist sections 1–7 in `docs/launch-checklist.md` all pass against `https://trynexshop.com` after the next deploy. The infrastructure prerequisites that this codebase controls (security headers, CORS lockdown, dynamic sitemap, no Replit hosts) are all in place; only the live-site walkthrough remains, and that is the operator's responsibility.
