import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getConfiguredGoogleClientId } from "./auth";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
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
