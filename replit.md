# TryNex Lifestyle - E-Commerce Platform

## Overview

Full-stack e-commerce platform for TryNex Lifestyle, a premium custom apparel brand from Bangladesh. Built as a pnpm workspace monorepo with TypeScript.

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
