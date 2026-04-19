# TryNex Lifestyle — Pre-Launch Deploy Verification

This is the final go/no-go checklist that must pass against the **live** production environment before paid Facebook ads are turned on. Every item must be verified by a real human in a real browser — automated dev checks are not a substitute.

## Production environment of record

| Layer        | Service         | URL / identifier                          |
| ------------ | --------------- | ----------------------------------------- |
| Frontend     | Cloudflare Pages| `https://trynexshop.com`                  |
| Backend API  | Render          | `https://trynex-api.onrender.com`         |
| Database     | Managed Postgres| `DATABASE_URL` env var on the Render svc  |
| DNS / TLS    | Cloudflare      | Automatic edge cert for `trynexshop.com`  |

There must be **zero** dependencies on `*.replit.dev`, `*.repl.co`, or any other Replit-hosted infrastructure in the live request flow. Search the live HTML and Network tab for those substrings before launch.

---

## 1. Build & deploy preview

1. From the repo root, on `main`:
   ```bash
   pnpm install
   pnpm --filter @workspace/trynex-storefront run build
   pnpm --filter @workspace/api-server run build
   ```
2. Push `main` to GitHub. Cloudflare Pages and Render auto-build.
3. Note the Cloudflare Pages **preview** URL (not the production alias yet) and the Render deploy ID.
4. Wait for both deploys to go green in their respective dashboards.

## 2. Smoke test the preview URL

Run section 3–6 against the **preview** URL first. Only promote to production once everything passes.

## 3. Production environment health

Run on `https://trynexshop.com` from a clean, signed-out browser session, mobile + desktop:

- [ ] **TLS**: padlock shows valid cert, no mixed-content warnings in console.
- [ ] **Security headers** present on every HTML response (verify in DevTools → Network → Response Headers, or run `curl -sI https://trynexshop.com`):
  - [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - [ ] `X-Content-Type-Options: nosniff`
  - [ ] `X-Frame-Options: DENY`
  - [ ] `Referrer-Policy: strict-origin-when-cross-origin`
  - [ ] `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(self)`
  - [ ] `Content-Security-Policy:` includes `frame-ancestors 'none'` and lists Render + GTM + Facebook in `connect-src`
- [ ] **Console**: no red errors on Home, Products, ProductDetail, Cart, Checkout, Hampers, HamperDetail, DesignStudio, Account, TrackOrder.
- [ ] **404s**: Network tab shows zero failing static assets on those routes.
- [ ] **API origin**: every `/api/*` request in the Network tab resolves to `https://trynex-api.onrender.com` (Cloudflare Pages proxies via `_redirects`). Searching the Network panel for "replit" returns zero results.
- [ ] **Sitemap**: `https://trynexshop.com/sitemap.xml` returns 200 with live product/hamper/blog URLs (proxied to Render).
- [ ] **Robots**: `https://trynexshop.com/robots.txt` returns 200 and points at the canonical sitemap.

## 4. End-to-end test orders (COD, one of each type)

For each order type, complete the full Home → … → Order Confirmation flow on a real mobile device. After placing, log into `https://trynexshop.com/admin/login` and confirm the order shows correct line items, totals (with shipping fee), customer name, phone, address, district.

- [ ] **Catalog product** — add a regular t-shirt/mug/hoodie from `/products` to cart, checkout COD.
- [ ] **Design Studio custom** — design something in `/design-studio`, add to cart, checkout COD; confirm the design preview/snapshot is attached to the admin order.
- [ ] **Curated hamper** — add a featured hamper from `/hampers`, checkout COD.
- [ ] **Build-your-own hamper** — assemble at least 2 items in `/hampers/build`, checkout COD.
- [ ] **Wishlist → Cart** — add a product to wishlist, then move it to cart from `/wishlist`, checkout COD.
- [ ] **Free-shipping threshold**: cart subtotal ≥ ৳1500 hides shipping fee at checkout.
- [ ] **Promo code**: applying a known active code reduces the total correctly.

## 5. Tracking pixel verification

Install the [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper) Chrome extension. With it open, walk this exact path on `https://trynexshop.com`:

1. Land on Home → expect `PageView`.
2. Open a product → expect `PageView` + `ViewContent` (with `content_ids`, `value`, `currency: BDT`).
3. Add to cart → expect `AddToCart` (with correct value).
4. Open `/checkout` → expect `InitiateCheckout`.
5. Complete a COD order → on the confirmation page expect `Purchase` (with `value` + `currency: BDT`) firing exactly once.

- [ ] All five events fire, each exactly once, with non-zero value where applicable.
- [ ] If `googleAnalyticsId` is configured in admin Settings, GA4 DebugView shows `page_view`, `view_item`, `add_to_cart`, `begin_checkout`, `purchase` for the same flow.

## 6. Order tracking

- [ ] On mobile, visit `/track-order`, enter the order ID from one of the test orders above, and confirm the status timeline + items render correctly.

## 7. Final sign-off

- [ ] Cloudflare Pages production alias `trynexshop.com` resolves to the new build.
- [ ] Render service is on the new commit (verified in dashboard).
- [ ] No background errors in Render logs in the last 30 minutes.
- [ ] Operator marks this checklist complete with date + initials in the project tracker.

## Keep-alive monitor (UptimeRobot)

Render free-tier services sleep after 15 minutes of inactivity, which gives the
first paying visitor of the hour a 30–50 second cold start. To avoid this on a
live ad campaign, configure an external HTTP keep-alive:

1. Sign in at <https://uptimerobot.com> (the free plan covers this).
2. Add a new **HTTP(s)** monitor with:
   - **URL**: `https://trynex-api.onrender.com/api/healthz`
   - **Monitoring interval**: every **5 minutes**
   - **Monitor timeout**: 30 seconds (Render cold starts can exceed the default 10s)
3. Add an alert contact (email / SMS / Slack) so you are paged when the API
   actually goes down — not just when it's waking up.
4. Confirm the monitor reports **200 OK** with body `{"status":"ok"}`. The
   `/api/healthz` route is intentionally unauthenticated and cheap (no DB hit)
   so it is safe to ping every 5 minutes indefinitely.

> Render's `healthCheckPath` in `render.yaml` is also set to `/api/healthz`. If
> you change one, change the other — a mismatch will mark the service unhealthy
> and Render will refuse to promote new deploys.

## Rerun commands (operator quick-reference)

```bash
# Local typecheck before any push
pnpm --filter @workspace/trynex-storefront run typecheck
pnpm --filter @workspace/api-server run typecheck

# Local production build (catches build errors before CF/Render do)
pnpm --filter @workspace/trynex-storefront run build
pnpm --filter @workspace/api-server run build

# Inspect production headers
curl -sI https://trynexshop.com | sort
curl -sI https://trynex-api.onrender.com/api/healthz

# Inspect production sitemap
curl -s https://trynexshop.com/sitemap.xml | head -40
curl -s https://trynexshop.com/robots.txt
```

## What to do if something fails

- **Header missing** → edit `artifacts/trynex-storefront/public/_headers`, push, redeploy.
- **API call going somewhere wrong** → check `artifacts/trynex-storefront/public/_redirects` and the `PRODUCTION_API_BASE_URL` constant in `src/lib/utils.ts`.
- **CORS rejection** → set/extend `ALLOWED_ORIGINS` env var on the Render service (must include `https://trynexshop.com`).
- **Pixel not firing** → confirm `facebookPixelId` / `googleAnalyticsId` is filled in Admin → Settings; `TrackingPixels.tsx` only initializes if those values exist.
- **Order not appearing in admin** → check Render logs for the `POST /api/orders` request and any DB error.
- **Anything else broken** → file a follow-up task; do **not** ship paid ads with a known critical regression.
