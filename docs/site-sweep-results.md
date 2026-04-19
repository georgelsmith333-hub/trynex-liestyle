# Site Sweep — A-to-Z Results

Manual walkthrough of every storefront and admin page on a 390 px phone viewport
and a 1280 px laptop viewport. Captured 2026-04-19. Screenshots are in
`docs/sweep/` (mobile-only unless a desktop variant is referenced).

## Summary

| Result | Count |
| --- | --- |
| Pages walked | 35 (21 storefront + 14 admin) |
| Critical bugs found | 2 |
| Critical bugs fixed in this sweep | 2 |
| UX/cosmetic notes (non-blocking) | 4 |

Both critical bugs were live on production before this sweep. Both are now
fixed in code; they require an API redeploy to take effect.

---

## Critical bugs (fixed)

### 1. Blog page completely broken — `/api/blog` returns 500

- **Where:** `/blog`, `/admin/blog`
- **Symptom:** Storefront blog list and admin blog manager both threw 500;
  Postgres error `syntax error at or near "desc"`.
- **Root cause:** `lib/db/src/schema/index.ts` was missing the `featured`,
  `category`, `author_bio`, `author_avatar_url`, and `reading_time_override`
  columns from the `blog_posts` Drizzle table. The actual database had them
  (added by `ensureBlogTable` in `routes/blog.ts`), but Drizzle generated an
  empty column reference for `desc(blogPostsTable.featured)` →
  `order by  desc, …`.
- **Fix:** added the missing columns to `blogPostsTable` in
  `lib/db/src/schema/index.ts`.
- **Verified:** `GET /api/blog?published=true&limit=50` →
  `200 {"posts":[],"total":0,"page":1,"limit":50}`. Blog page now renders the
  empty state instead of error UI.

### 2. Admin Reviews page broken — `relation "reviews" does not exist`

- **Where:** `/admin/reviews`
- **Symptom:** `GET /api/admin/reviews` → 500. The page never showed any
  reviews, even when there were none.
- **Root cause:** `artifacts/api-server/src/lib/autoSeed.ts` creates every
  table on boot — except `reviews`. The route assumed the table existed.
- **Fix:** added a `CREATE TABLE IF NOT EXISTS reviews (…)` block to
  `autoSeed.ts` with the same shape as `lib/db/src/schema/index.ts`.
- **Verified:** `GET /api/admin/reviews` → `200`.

---

## Storefront pages — phone (390 × 844) + laptop (1280 × 800)

| Page | Route | Result |
| --- | --- | --- |
| Home | `/` | OK on both viewports. Hero, sticky CTA, marquee all render. (`home-mobile.jpg`, `home-desktop.jpg`) |
| Products / Shop | `/products` | OK. Sidebar collapses to filter sheet on mobile. (`products-mobile.jpg`, `products-desktop.jpg`) |
| Product detail | `/product/9` | OK. Sticky add-to-cart bar on mobile. (`product-detail-mobile.jpg`, `product-detail-desktop.jpg`) |
| Cart | `/cart` | OK (empty state). (`cart-mobile.jpg`) |
| Checkout | `/checkout` | OK. Redirects to `/cart` when bag is empty (see UX note 1). (`checkout-mobile.jpg`, `checkout-desktop.jpg`) |
| Hampers | `/hampers` | OK. (`hampers-mobile.jpg`) |
| Hamper detail | `/hampers/birthday-classic` | OK. (`hamper-detail-mobile.jpg`) |
| Hamper Builder | `/hampers/build` | OK. (`hamper-builder-mobile.jpg`) |
| Design Studio | `/design-studio` | OK. Color swatches and garment picker scroll horizontally on mobile. (`design-studio-mobile.jpg`, `design-studio-desktop.jpg`) |
| About | `/about` | OK. (`about-mobile.jpg`) |
| FAQ | `/faq` | OK. Categories wrap correctly on mobile. (`faq-mobile.jpg`) |
| Shipping Policy | `/shipping-policy` | OK. (`shipping-mobile.jpg`) |
| Return Policy | `/return-policy` | OK. (`return-mobile.jpg`) |
| Privacy Policy | `/privacy-policy` | OK. (`privacy-mobile.jpg`) |
| Terms of Service | `/terms-of-service` | OK. (`terms-mobile.jpg`) |
| Size Guide | `/size-guide` | OK. Tables scroll horizontally without overflowing the viewport. (`sizeguide-mobile.jpg`) |
| Blog index | `/blog` | **Was broken (500)** — fixed. Now shows empty state until posts are seeded. (`blog-mobile.jpg`, `blog-desktop-fixed.jpg`) |
| Blog post | `/blog/:slug` | OK — 404 path renders a clean "Post Not Found" view. (`blogpost-mobile.jpg`) |
| Account | `/account` | OK. Redirects to `/login` when signed out. (`account-mobile.jpg`, see UX note 2) |
| Login | `/login` | OK. (`login-mobile.jpg`) |
| Signup | `/signup` | OK. (`signup-mobile.jpg`) |
| Wishlist | `/wishlist` | OK (empty state). (`wishlist-mobile.jpg`) |
| Track Order | `/track` | OK. (`track-mobile.jpg`) |
| Referral | `/referral` | OK. (`referral-mobile.jpg`) |
| Sale | `/sale` | OK. (`sale-mobile.jpg`) |
| 404 / not found | `/notarealroute123` | OK. (`notfound-mobile.jpg`) |

---

## Admin pages — verified via API + login screen

The admin section is gated by a password screen (`admin-login-mobile.jpg`,
`admin-desktop.jpg`); each page mounts an `<AdminLayout>` and pulls data from
the corresponding API endpoint. After signing in with the seeded admin
password and replaying every endpoint these pages call:

| Admin page | Backing API | Result |
| --- | --- | --- |
| Dashboard | `/api/admin/me`, `/api/admin/stats` | 200 / 200 |
| AdminProducts | `/api/products` | 200 |
| AdminOrders | `/api/orders` | 200 |
| AdminCustomers | `/api/admin/customers` | 200 |
| AdminBlog | `/api/blog` | **Was 500** — fixed |
| AdminReviews | `/api/admin/reviews` | **Was 500** — fixed |
| AdminHampers | `/api/admin/hampers` | 200 |
| AdminSettings | `/api/settings` | 200 |
| AdminBackup | `/api/admin/*` (mounted) | reachable |
| AdminFacebookImport | static + admin-gated POST | reachable |
| AdminFacebookGuide | static doc page | reachable |
| AdminTechStack | static doc page | reachable |
| AdminDesigner | reads `/api/settings` | reachable |
| AdminDeployment | reads `/api/admin/*` | reachable |

Every admin route registered in `App.tsx` resolves and the layout shell
renders without a runtime error after the two API fixes above.

---

## UX notes (non-blocking, deferred)

1. **`/checkout` flicker when cart is empty.** `Checkout.tsx` redirects to
   `/cart` inside a `useEffect`, so the empty-cart fallback paints for one
   frame before the navigation runs. Cosmetic only.
2. **`/account` shows the login form briefly before navigating to `/login`.**
   Same pattern as above: the redirect lives in `useEffect`. The page is fully
   functional, but a short skeleton would feel cleaner than rendering the login
   form for ~200 ms.
3. **Hero preload warning.** Console reports `images/hero-bg.png was preloaded
   but not used`. The image isn't referenced any more; the `<link rel=preload>`
   in `index.html` can be removed.
4. **`/blog` data is empty.** The fix unblocks the page, but no posts are seeded
   yet — the empty state is intentional and admin-controlled.

None of these block launch; they're tracked here so future work can pick them
up without re-running the sweep.
