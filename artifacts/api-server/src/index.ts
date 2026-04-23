import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations, autoSeedIfEmpty } from "./lib/autoSeed";
import { logActiveStorageBackend, ObjectStorageService } from "./lib/objectStorage";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/* ─── Storage backend detection ─────────────────────────────────────────────
 * Backends (in priority order):
 *   1. R2  — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   2. S3  — set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET
 *   3. local — default; stores files under LOCAL_STORAGE_PATH (./uploads)
 *
 * For Render + Cloudflare R2: set R2_* env vars on the Render service.
 * The local backend works out-of-the-box with no configuration needed.
 * ───────────────────────────────────────────────────────────────────────── */
const storageService = new ObjectStorageService();
const storageBackend = storageService.getBackendName();

/* ─── Env-var health matrix ─────────────────────────────────────────────────
 *
 * Logs which recommended production env vars are present / missing at boot.
 * Missing REQUIRED vars cause a hard exit; missing OPTIONAL ones are warned.
 *
 * Storage vars are checked per-backend: only the vars for the active backend
 * are validated, so an S3 deployment does not emit false warnings about R2
 * vars and vice versa.
 * ───────────────────────────────────────────────────────────────────────── */
type EnvVarSpec = {
  name: string;
  required: boolean;
  description: string;
};

// Core vars that every production deployment requires regardless of backend.
const CORE_ENV_VAR_MATRIX: EnvVarSpec[] = [
  { name: "DATABASE_URL",     required: true,  description: "PostgreSQL connection string" },
  { name: "ADMIN_JWT_SECRET", required: true,  description: "Admin JWT signing secret (32+ chars, must differ from JWT_SECRET)" },
  // JWT_SECRET is required: customerAuth.ts hard-throws at module load in production
  { name: "JWT_SECRET",       required: true,  description: "Customer JWT signing secret (must differ from ADMIN_JWT_SECRET)" },
  { name: "ADMIN_PASSWORD",   required: true,  description: "Initial admin password" },
  { name: "ALLOWED_ORIGINS",  required: true,  description: "Comma-separated CORS allowlist (e.g. https://trynexshop.com)" },
  { name: "PORT",             required: true,  description: "HTTP port for the API server" },
];

// Storage-backend-specific var specs. Only the active backend's vars are checked.
const STORAGE_ENV_VAR_MATRIX: Record<string, EnvVarSpec[]> = {
  r2: [
    { name: "R2_ACCOUNT_ID",        required: true,  description: "Cloudflare R2 account ID" },
    { name: "R2_ACCESS_KEY_ID",     required: true,  description: "Cloudflare R2 access key" },
    { name: "R2_SECRET_ACCESS_KEY", required: true,  description: "Cloudflare R2 secret access key" },
    { name: "R2_BUCKET",            required: true,  description: "Cloudflare R2 bucket name" },
    { name: "R2_PUBLIC_BASE_URL",   required: false, description: "Cloudflare R2 public CDN base URL (optional)" },
  ],
  s3: [
    { name: "S3_ACCESS_KEY_ID",     required: true,  description: "AWS S3 (or S3-compatible) access key" },
    { name: "S3_SECRET_ACCESS_KEY", required: true,  description: "AWS S3 secret access key" },
    { name: "S3_BUCKET",            required: true,  description: "S3 bucket name" },
    { name: "S3_REGION",            required: false, description: "S3 region (default: us-east-1)" },
    { name: "S3_ENDPOINT",          required: false, description: "S3-compatible endpoint URL (MinIO, etc.)" },
    { name: "S3_PUBLIC_BASE_URL",   required: false, description: "S3 public CDN base URL (optional)" },
  ],
  local: [
    { name: "LOCAL_STORAGE_PATH",   required: false, description: "Local filesystem path for uploads (default: ./uploads)" },
    { name: "API_BASE_URL",         required: false, description: "Public base URL of this API server, used for local upload URLs (e.g. https://trynex-api.onrender.com)" },
  ],
};

// Optional vars that are always checked regardless of backend.
const OPTIONAL_ENV_VAR_MATRIX: EnvVarSpec[] = [
  { name: "GOOGLE_CLIENT_ID", required: false, description: "Google OAuth 2.0 client ID (social login)" },
  { name: "FACEBOOK_APP_ID",  required: false, description: "Facebook App ID (social login)" },
];

if (process.env.NODE_ENV === "production") {
  const missing: string[] = [];
  const present: string[] = [];

  const allSpecs = [
    ...CORE_ENV_VAR_MATRIX,
    ...(STORAGE_ENV_VAR_MATRIX[storageBackend] ?? []),
    ...OPTIONAL_ENV_VAR_MATRIX,
  ];

  for (const spec of allSpecs) {
    if (process.env[spec.name]) {
      present.push(spec.name);
    } else {
      if (spec.required) {
        missing.push(`MISSING (required): ${spec.name} — ${spec.description}`);
      } else {
        logger.warn({ envVar: spec.name }, `[env] Optional env var not set: ${spec.name} (${spec.description})`);
      }
    }
  }

  if (missing.length > 0) {
    logger.error({ missing }, "[env] Production startup refused: required env vars are missing");
    for (const m of missing) logger.error(`  ${m}`);
    process.exit(1);
  }

  logger.info({ present, storageBackend }, "[env] All required env vars confirmed present");
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Log the active object storage backend (r2 / s3 / local).
  logActiveStorageBackend(logger);

  await runMigrations();
  await autoSeedIfEmpty();
});
