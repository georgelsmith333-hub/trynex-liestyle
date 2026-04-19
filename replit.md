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
-   **Security**: Rate limiting on critical endpoints, JWT authentication for admin panel.
-   **Database Integration**: Auto-migration and auto-seeding on startup for new databases.

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
-   **SEO & Performance**: Canonical domain `https://trynexshop.com`, per-route SEO with unique titles, descriptions, and canonicals. Structured data (JSON-LD) for key pages. Optimized LCP and Core Web Vitals through image preloading, explicit dimensions, font subsetting, and API preconnects. Dynamic sitemap and robots.txt.
-   **Cart Performance**: Optimized with split contexts, debounced `localStorage` writes, and memoized components to minimize re-renders.

## External Dependencies

-   **Hosting**: Cloudflare Pages (storefront), Render (API server).
-   **Database**: PostgreSQL.
-   **Authentication**: Google OAuth 2.0, Facebook Login.
-   **Monitoring**: External HTTP keep-alive monitor (e.g., UptimeRobot).
-   **Analytics/Tracking**: Google Analytics 4 (GA4), Google Tag Manager (GTM), Meta Pixel.
-   **Social Media**: WhatsApp for order support.
-   **Build Tools**: pnpm workspaces, Vite, esbuild.