# TryNex Lifestyle - E-Commerce Platform

## Overview

Full-stack e-commerce platform for TryNex Lifestyle, a premium custom apparel brand from Bangladesh. Built as a pnpm workspace monorepo with TypeScript.

## Production URLs & Auth Setup

- **Storefront** (Cloudflare Pages): `https://trynexshop.com`
- **API server** (Render): `https://trynex-api.onrender.com`
- **Admin panel**: `https://trynexshop.com/admin/login` — default password `Admins@Trynex` (overridable by setting `ADMIN_PASSWORD` env var on Render; the password auto-syncs to the env value on every login attempt).

The storefront has the production API URL hardcoded as a fallback (`PRODUCTION_API_BASE_URL` in `artifacts/trynex-storefront/src/lib/utils.ts`), so it works even if `VITE_API_BASE_URL` is not set in Cloudflare Pages env. Local dev (`localhost`, `*.replit.dev`) still uses same-origin requests.

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
- `SESSION_SECRET` — Secret for JWT signing
- `PORT` — Port for each service (set by Replit workflows)
- `API_PORT` — API server port for storefront proxy (default: 8080)

## Ports

- `8080` → API server (external 8080)
- `8081` → Storefront (external 80, main web)
