import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAdmin } from "../middlewares/adminAuth";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Allowed MIME types and their magic-byte signatures
const ALLOWED_IMAGE_TYPES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png":  [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif":  [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // RIFF header; also verify offset 8 = WEBP
};

const ALLOWED_TYPES = new Set(Object.keys(ALLOWED_IMAGE_TYPES));

function matchesMagicBytes(buf: Buffer, signatures: number[][]): boolean {
  return signatures.some(sig => sig.every((byte, i) => buf[i] === byte));
}

// Returns a validated content-type based on actual file magic bytes,
// or null if the content is not a recognised image.
function detectImageType(buf: Buffer): string | null {
  for (const [mimeType, sigs] of Object.entries(ALLOWED_IMAGE_TYPES)) {
    if (matchesMagicBytes(buf, sigs)) {
      // Extra check for WebP: bytes 8-11 must be "WEBP"
      if (mimeType === "image/webp") {
        if (buf.length >= 12 && buf.slice(8, 12).toString("ascii") === "WEBP") {
          return mimeType;
        }
        continue;
      }
      return mimeType;
    }
  }
  return null;
}

function parseUploadBody(body: unknown):
  | { ok: true; data: { name: string; size: number; contentType: string } }
  | { ok: false } {
  if (!body || typeof body !== "object") return { ok: false };
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string" || !b.name || b.name.length > 255) return { ok: false };
  if (typeof b.size !== "number" || !Number.isFinite(b.size) || b.size <= 0 || b.size > MAX_UPLOAD_BYTES) return { ok: false };
  if (typeof b.contentType !== "string" || !b.contentType || b.contentType.length > 127) return { ok: false };
  // Validate the declared content-type is in the allowed set
  const declaredType = String(b.contentType).toLowerCase().split(";")[0].trim();
  if (!ALLOWED_TYPES.has(declaredType)) return { ok: false };
  return { ok: true, data: { name: b.name, size: b.size, contentType: declaredType } };
}

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 * Returns an upload URL the client sends the file to.
 * - R2/S3 backends: returns a presigned PUT URL pointing at the cloud bucket.
 * - Local backend:  returns a PUT URL pointing at /api/storage/upload-direct/<uuid>.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = parseUploadBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "Missing or invalid required fields. Only JPEG, PNG, GIF, and WebP images are allowed." });
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
 * PUT /storage/upload-direct/:objectId
 * Accepts a raw binary body, validates magic bytes, and saves to local disk.
 * Only active when the local backend is in use — on R2/S3 the client
 * uploads directly to the cloud bucket using the presigned URL.
 */
router.put("/storage/upload-direct/:objectId", async (req: Request, res: Response) => {
  if (objectStorageService.getBackendName() !== "local") {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const objectId = String(req.params.objectId ?? "");
  if (!objectId || !/^[a-zA-Z0-9-]+$/.test(objectId)) {
    res.status(400).json({ error: "Invalid object id" });
    return;
  }

  try {
    // Read the raw body into a buffer so we can validate magic bytes
    // before persisting. Express raw body is available if bodyParser.raw
    // is mounted; otherwise we collect from the stream.
    let bodyBuf: Buffer;
    if (Buffer.isBuffer(req.body)) {
      bodyBuf = req.body;
    } else {
      // Collect stream chunks
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      await new Promise<void>((resolve, reject) => {
        req.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > MAX_UPLOAD_BYTES) {
            reject(new Error("Upload too large"));
            return;
          }
          chunks.push(chunk);
        });
        req.on("end", resolve);
        req.on("error", reject);
      });
      bodyBuf = Buffer.concat(chunks);
    }

    // Enforce size limit
    if (bodyBuf.length === 0) {
      res.status(400).json({ error: "Empty upload" });
      return;
    }
    if (bodyBuf.length > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "Upload too large (max 25 MB)" });
      return;
    }

    // Magic-byte validation
    const detectedType = detectImageType(bodyBuf);
    if (!detectedType) {
      res.status(415).json({ error: "Unsupported file type. Only JPEG, PNG, GIF, and WebP images are accepted." });
      return;
    }

    // Save the validated buffer via the storage service
    const { Readable } = await import("stream");
    const readable = Readable.from(bodyBuf);
    await objectStorageService.saveLocalUpload(objectId, readable as unknown as import("stream").Readable);
    res.status(200).json({ success: true, detectedType });
  } catch (err) {
    req.log.error({ err }, "Local upload failed");
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * GET /storage/public-objects/<path>
 * Serves files from the public area.
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
 * GET /storage/sign-download?path=/objects/<id>
 * Returns a short-lived download URL for the admin "Download original" button.
 */
router.get("/storage/sign-download", requireAdmin, async (req: Request, res: Response) => {
  try {
    const p = String(req.query.path || "");
    if (!p.startsWith("/objects/")) {
      res.status(400).json({ error: "validation_error", message: "path must start with /objects/" });
      return;
    }
    const url = await objectStorageService.getObjectDownloadURL(p, 900);
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
