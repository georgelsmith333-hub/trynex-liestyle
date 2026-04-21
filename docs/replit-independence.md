# TryNex — Replit Independence Audit

**Date:** 2026-04-21  
**Scope:** Full monorepo (`artifacts/`, `lib/`, `packages/`, root config)  
**Conclusion:** Production is fully Replit-independent. All Replit-specific code is fenced to the development fallback path and is never reachable on Render.

---

## 1. Codebase Sweep

A full grep for `replit`, `REPLIT`, `repl.it`, `repl.co`, `sidecar`, `*.replit.*`, and `replit.dev` was run across all source directories (`artifacts/`, `lib/`, `packages/`, `scripts/`), excluding `node_modules`, `dist/`, and `.git`. Complete results:

| File | Reference | Production status |
|------|-----------|-------------------|
| `artifacts/api-server/src/lib/objectStorage.ts` | `REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106"` — GCS sidecar URL, all sidecar calls, `type Backend = "r2" | "s3" | "replit"`, `@google-cloud/storage` import | **Dev-only fallback.** Only reached when backend resolves to `"replit"`. `index.ts` now hard-exits in production before any sidecar call is possible. |
| `artifacts/api-server/src/lib/objectStorage.ts` | `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (referenced in comment only) | **Comment only.** The env var is set by the Replit platform; never present on Render. |
| `artifacts/api-server/src/lib/objectStorage.ts` | `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` env vars | **Cross-backend.** For R2/S3 these are optional overrides unrelated to Replit. |
| `artifacts/api-server/src/app.ts` | Comment: `"no Replit-hosted origins — production must stay independent of any *.replit.dev / *.repl.co host"` | **Comment only.** CORS code itself contains no Replit origin. |
| `artifacts/api-server/src/routes/storage.ts` | Comments: `"R2 / S3 / Replit sidecar"`, `"PUBLIC_OBJECT_SEARCH_PATHS for the Replit sidecar"` | **Comments only.** No runtime dependency. |
| `artifacts/api-server/src/index.ts` | Comments explaining the production storage guard | **New protective code.** Hard-exits if backend = `"replit"` in production. |
| `artifacts/trynex-storefront/src/components/ui/badge.tsx` | Comments: `// @replit shadow-xs instead of shadow`, `// @replit no hover because we use hover-elevate`, etc. | **Scaffold comments only.** These are Replit's UI component generator annotations describing style choices. Zero runtime dependency; purely CSS class documentation. |
| `artifacts/trynex-storefront/src/components/ui/button.tsx` | Comments: `// @replit: no hover, and add primary border`, `// @replit changed sizes`, etc. | **Scaffold comments only.** Same as above — Replit UI generator annotations. No runtime dependency. |
| `scripts/generate-overview-pdf.mjs` | References to "local sidecar" in architecture description and in section 9 (Replit Independence) | **Documentation only.** Descriptive text about the dev fallback. |
| `docs/launch-checklist.md` | Checklist items verifying zero `*.replit.dev` traffic in production | **Correct and intentional.** These are QA gates that protect against Replit dependency in production. |
| `.replit` | Platform metadata (workflow config, agent stack, port mapping) | **Platform config only.** Never loaded at runtime on Render. |
| `replit.md` | Development documentation file | **Documentation only.** Loaded only by the Replit agent during development. |

**Net result:** Zero Replit-specific runtime code paths are reachable in production. All remaining references are either (a) the dev-fallback sidecar path which is blocked by the production guard, (b) UI scaffold comments with no runtime effect, or (c) documentation/configuration.

---

## 2. Production Storage Guard

`artifacts/api-server/src/index.ts` now contains an explicit guard:

```typescript
if (process.env.NODE_ENV === "production" && storageBackend === "replit") {
  logger.error(...);
  process.exit(1);
}
```

A `NODE_ENV=production` boot with only Replit sidecar env vars configured will **fail fast with a clear error message** instead of timing-out at the first upload/download request.

Additionally, `logActiveStorageBackend(logger)` is called immediately after the server starts listening, so the Render log stream shows:

```
{"backend":"r2","msg":"[storage] active backend: r2"}
```

This provides instant confirmation that R2 is active, not the sidecar.

---

## 3. Migration Verification

All migrations in `artifacts/api-server/src/lib/autoSeed.ts` (`runMigrations()`) use only standard PostgreSQL DDL:

- `CREATE TABLE IF NOT EXISTS` — idempotent, no data loss
- `ALTER TABLE … ADD COLUMN IF NOT EXISTS` — idempotent column backfill
- `CREATE UNIQUE INDEX IF NOT EXISTS` — idempotent index creation

**No Replit-specific extensions** (e.g., no `uuid-ossp` from Replit's managed Postgres, no `pgvector`, no Replit-specific roles) are used.

**Idempotency verified on a fresh database:** A throwaway PostgreSQL database (`replit_independence_verify_tmp`) was created on the same server, started completely empty, and migrations were run twice against it. Both runs completed with zero errors. The throwaway DB was then dropped.

```
Run 1 — fresh database (no tables):
Migration run complete (all DDL: zero errors)

Run 2 — idempotency check (same schema already present):
Migration run complete (all DDL: zero errors)

Tables in fresh DB: admins, categories, customers, orders, products, reviews, settings, testimonials
Throwaway DB dropped (cleanup complete)
```

**Seeding guard:** `autoSeedIfEmpty()` checks `SELECT COUNT(*) FROM products` before inserting anything. An existing database with data is never overwritten.

### How to trigger migrations

Migrations run automatically every time the API server starts (inside `app.listen` callback). The simplest way to run them against any Postgres is to start the server:

```bash
# Point at any standard PostgreSQL (Render, Supabase, Neon, local Docker, etc.)
DATABASE_URL="postgres://user:pass@host:5432/dbname" \
NODE_ENV=production \
PORT=3001 \
JWT_SECRET="your-jwt-secret" \
ADMIN_JWT_SECRET="your-32-char-secret-here-xxxxxxxx" \
ADMIN_PASSWORD="your-admin-password" \
ALLOWED_ORIGINS="https://trynexshop.com" \
R2_ACCOUNT_ID="your-r2-account-id" \
R2_ACCESS_KEY_ID="your-r2-key" \
R2_SECRET_ACCESS_KEY="your-r2-secret" \
R2_BUCKET="your-bucket" \
  node artifacts/api-server/dist/index.mjs
```

On Render, migrations run automatically on every deploy — no manual step required. Migrations are safe to run on a database that already has the schema: every statement is idempotent.

---

## 4. Required Environment Variables (Render)

The following table is the canonical env-var matrix for production. The server performs a boot-time check and **exits with a clear error** if any REQUIRED var is absent when `NODE_ENV=production`.

### Required (hard-fail if missing)

| Env Var | Description |
|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/db`) |
| `ADMIN_JWT_SECRET` | Admin JWT signing secret — must be 32+ chars and differ from `JWT_SECRET` |
| `JWT_SECRET` | Customer JWT signing secret — hard-throw at module load in `customerAuth.ts` if absent in production |
| `ADMIN_PASSWORD` | Initial admin login password |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist — must include `https://trynexshop.com` |
| `PORT` | HTTP port — Render sets this automatically |

### Storage — exactly one group required (checked per active backend)

The startup check is backend-aware: only the env vars for the configured storage backend are validated. An R2 deployment does not emit warnings about missing S3 vars and vice versa.

**Group A — Cloudflare R2 (recommended):**

| Env Var | Required | Description |
|---------|----------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | Yes | Cloudflare R2 access key |
| `R2_SECRET_ACCESS_KEY` | Yes | Cloudflare R2 secret access key |
| `R2_BUCKET` | Yes | Cloudflare R2 bucket name |
| `R2_PUBLIC_BASE_URL` | No | R2 public CDN URL for direct image serving |

**Group B — AWS S3 or S3-compatible (MinIO, Backblaze B2, etc.):**

| Env Var | Required | Description |
|---------|----------|-------------|
| `S3_ACCESS_KEY_ID` | Yes | S3 access key |
| `S3_SECRET_ACCESS_KEY` | Yes | S3 secret access key |
| `S3_BUCKET` | Yes | S3 bucket name |
| `S3_REGION` | No | S3 region (default: `us-east-1`) |
| `S3_ENDPOINT` | No | S3-compatible endpoint URL |
| `S3_PUBLIC_BASE_URL` | No | S3 public CDN base URL |

### Optional (warnings logged if absent)

| Env Var | Description |
|---------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID |
| `FACEBOOK_APP_ID` | Facebook App ID |

---

## 5. Production Topology (Replit-independent)

```
Browser / Mobile
      │
      ▼
Cloudflare Pages (static)          trynexshop.com
      │  _redirects: /api/* → Render
      ▼
Render Web Service (Express API)   trynex-api.onrender.com
      │
      ├── PostgreSQL (Render managed / external)
      │     └── Standard pg driver — no Replit extensions
      │
      └── Cloudflare R2 (object storage)
            └── @aws-sdk/client-s3 — S3-compatible API
```

No component in this topology has any dependency on Replit infrastructure.

---

## 6. Dev vs Production Backend Summary

| Concern | Development (Replit) | Production (Render) |
|---------|---------------------|---------------------|
| Object storage | Replit GCS sidecar (auto-fallback) | Cloudflare R2 via S3 API |
| Database | Replit-managed Postgres (`DATABASE_URL`) | External Postgres (`DATABASE_URL`) |
| CORS | Dev origins (localhost:5173, etc.) | `ALLOWED_ORIGINS` env var (required) |
| Auth guard | Relaxed (`ADMIN_JWT_SECRET` min length) | Strict 32+ char check at boot |
| Storage guard | No guard (sidecar allowed) | Hard-exit if backend = "replit" |
| Host config | Replit workspace | Render + Cloudflare Pages |
