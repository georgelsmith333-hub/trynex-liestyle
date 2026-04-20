import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

// Hand-rolled validator (api-server has no zod dep). Limit upload size to
// 25 MB so a malicious caller can't request multi-GB presigned URLs.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
function parseUploadBody(body: unknown):
  | { ok: true; data: { name: string; size: number; contentType: string } }
  | { ok: false } {
  if (!body || typeof body !== "object") return { ok: false };
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name || b.name.length > 255) return { ok: false };
  if (typeof b.size !== "number" || !Number.isFinite(b.size) || b.size <= 0 || b.size > MAX_UPLOAD_BYTES) return { ok: false };
  if (typeof b.contentType !== "string" || !b.contentType || b.contentType.length > 127) return { ok: false };
  return { ok: true, data: { name: b.name, size: b.size, contentType: b.contentType } };
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Returns a presigned URL the client uploads the file to directly.
 * The active backend (R2 / S3 / Replit sidecar) is auto-detected at runtime.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = parseUploadBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json({
      uploadURL,
      objectPath,
      backend: objectStorageService.getBackendName(),
      metadata: { name, size, contentType },
    });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/<path>
 * Serves files from the public area (R2/S3 prefix `public/` or
 * PUBLIC_OBJECT_SEARCH_PATHS for the Replit sidecar).
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    await objectStorageService.streamPublicObject(filePath, res);
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/<id>
 * Serves a private uploaded object (e.g. the original print-ready design file).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    await objectStorageService.streamPrivateObject(`/objects/${wildcardPath}`, res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    if (!res.headersSent) res.status(500).json({ error: "Failed to serve object" });
  }
});

/**
 * GET /storage/objects/sign-download?path=/objects/<id>
 * Returns a short-lived presigned download URL for the admin
 * "Download original print file" button. Admin-only.
 */
import { requireAdmin } from "../middlewares/adminAuth";
router.get("/storage/sign-download", requireAdmin, async (req: Request, res: Response) => {
  try {
    const path = String(req.query.path || "");
    if (!path.startsWith("/objects/")) {
      res.status(400).json({ error: "validation_error", message: "path must start with /objects/" });
      return;
    }
    const url = await objectStorageService.getObjectDownloadURL(path, 900);
    res.json({ url, expiresInSeconds: 900 });
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error signing download URL");
    res.status(500).json({ error: "Failed to sign download URL" });
  }
});

export default router;
