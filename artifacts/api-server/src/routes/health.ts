import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getConfiguredGoogleClientId } from "./auth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Storage backend health. Reports the active backend, whether it is a
// portable (production-ready) backend, and best-effort connectivity by
// minting a presigned upload URL (which exercises the credentials without
// writing any real data).
router.get("/health/storage", async (_req, res) => {
  const svc = new ObjectStorageService();
  const backend = svc.getBackendName();
  let reachable = false;
  let error: string | null = null;
  try {
    // For S3/R2 this signs a PutObject URL; for the Replit sidecar it
    // signs a GET URL via the local sidecar. Either way, success means
    // the backend is reachable with the configured credentials.
    await svc.getObjectEntityUploadURL();
    reachable = true;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  res.json({
    backend,
    portable: backend === "r2" || backend === "s3",
    reachable,
    error,
  });
});

// Strict-contract auth diagnostic. Returns ONLY the three required
// booleans so external monitors / curl-based smoke checks have a stable
// shape. Never returns secret values. The richer diagnostic with
// per-column / per-table booleans lives at /api/auth/health.
router.get("/health/auth", async (_req, res) => {
  let dbReachable = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbReachable = true;
  } catch {
    // dbReachable stays false
  }
  res.json({
    google_configured: Boolean(await getConfiguredGoogleClientId()),
    jwt_secret_present: Boolean(process.env.JWT_SECRET),
    db_reachable: dbReachable,
  });
});

export default router;
