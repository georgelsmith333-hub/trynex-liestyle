/* ═══════════════════════════════════════════════════════════════════════════
   OBJECT STORAGE — portable adapter
   ----------------------------------------------------------------------------
   This file is the single boundary between the app and the storage backend.
   We auto-detect at runtime:

     • If R2_* env vars are set                  → Cloudflare R2 (S3-compatible)
     • Else if S3_* env vars are set             → AWS S3 (or any S3-compatible)
     • Else (DEFAULT_OBJECT_STORAGE_BUCKET_ID)   → Replit Object Storage sidecar

   Production deployments (Render etc.) should set R2_* — making the project
   completely Replit-independent.
═══════════════════════════════════════════════════════════════════════════ */

import { Storage, type File } from "@google-cloud/storage";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
  type GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/* ─── Backend selection ─────────────────────────────────────────────────── */
type Backend = "r2" | "s3" | "replit";

function selectedBackend(): Backend {
  if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET) {
    return "r2";
  }
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY && process.env.S3_BUCKET) {
    return "s3";
  }
  return "replit";
}

const BACKEND: Backend = selectedBackend();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/* ─── S3-compatible client (R2 + AWS S3 + any other S3 API) ─────────────── */
let s3Client: S3Client | null = null;
let s3BucketName = "";
let s3PublicBaseUrl = "";

function ensureS3Client(): { client: S3Client; bucket: string } {
  if (s3Client) return { client: s3Client, bucket: s3BucketName };
  if (BACKEND === "r2") {
    const accountId = process.env.R2_ACCOUNT_ID!;
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
    });
    s3BucketName = process.env.R2_BUCKET!;
    s3PublicBaseUrl = process.env.R2_PUBLIC_BASE_URL || "";
  } else if (BACKEND === "s3") {
    s3Client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.S3_FORCE_PATH_STYLE,
    });
    s3BucketName = process.env.S3_BUCKET!;
    s3PublicBaseUrl = process.env.S3_PUBLIC_BASE_URL || "";
  } else {
    throw new Error("S3 client requested but no S3/R2 env vars configured");
  }
  return { client: s3Client, bucket: s3BucketName };
}

/* ─── Replit sidecar Google Cloud Storage client (legacy / dev) ─────────── */
let gcsClient: Storage | null = null;
function ensureGcsClient(): Storage {
  if (gcsClient) return gcsClient;
  gcsClient = new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  return gcsClient;
}

// Backwards-compat export (some legacy code may import this)
export const objectStorageClient = {
  get bucket() {
    return ensureGcsClient().bucket.bind(ensureGcsClient());
  },
};

/* ─── Path helpers ──────────────────────────────────────────────────────── */
function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  if (!path.startsWith("/")) path = `/${path}`;
  const pathParts = path.split("/");
  if (pathParts.length < 3) throw new Error("Invalid path: must contain at least a bucket name");
  return { bucketName: pathParts[1], objectName: pathParts.slice(2).join("/") };
}

/* ─── Public API used by routes ─────────────────────────────────────────── */
export class ObjectStorageService {
  constructor() {}

  getBackendName(): Backend {
    return BACKEND;
  }

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(pathsStr.split(",").map(p => p.trim()).filter(p => p.length > 0)),
    );
    if (paths.length === 0 && BACKEND === "replit") {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set the env var.",
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (BACKEND !== "replit") {
      // For S3/R2, "uploads" is the standard prefix; allow override via env.
      return dir || "uploads";
    }
    if (!dir) {
      throw new Error("PRIVATE_OBJECT_DIR not set.");
    }
    return dir;
  }

  /* ── Generate a presigned PUT URL the client uploads to directly ── */
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();

    if (BACKEND === "r2" || BACKEND === "s3") {
      const { client, bucket } = ensureS3Client();
      const key = `uploads/${objectId}`;
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, cmd, { expiresIn: 900 });
    }

    // Replit sidecar
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return signReplitSidecarURL({ bucketName, objectName, method: "PUT", ttlSec: 900 });
  }

  /* ── Convert any storage URL into the canonical /objects/<id> path ── */
  normalizeObjectEntityPath(rawPath: string): string {
    if (BACKEND === "r2" || BACKEND === "s3") {
      // R2 presigned URLs look like https://<acct>.r2.cloudflarestorage.com/<bucket>/uploads/<id>?X-Amz...
      // We normalize anything ending in /uploads/<id> to /objects/<id>.
      try {
        const url = new URL(rawPath);
        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("uploads");
        if (idx >= 0 && parts[idx + 1]) {
          return `/objects/${parts.slice(idx + 1).join("/")}`;
        }
      } catch {
        /* not a URL — fall through */
      }
      // If it's already /objects/<id>, return as-is.
      if (rawPath.startsWith("/objects/")) return rawPath;
      return rawPath;
    }

    // Replit sidecar (Google Cloud Storage URLs)
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith("/")) objectEntityDir = `${objectEntityDir}/`;
    if (!rawObjectPath.startsWith(objectEntityDir)) return rawObjectPath;
    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  /* ── Stream a public object back to the client ── */
  async streamPublicObject(filePath: string, res: import("express").Response): Promise<void> {
    if (BACKEND === "r2" || BACKEND === "s3") {
      const { client, bucket } = ensureS3Client();
      const key = `public/${filePath}`;
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        await streamS3ObjectToResponse(out, res, /* isPublic */ true);
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
          res.status(404).json({ error: "File not found" });
          return;
        }
        throw err;
      }
      return;
    }

    // Replit sidecar
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = ensureGcsClient().bucket(bucketName);
      const f = bucket.file(objectName);
      const [exists] = await f.exists();
      if (exists) {
        await streamGcsFileToResponse(f, res, /* isPublic */ true);
        return;
      }
    }
    res.status(404).json({ error: "File not found" });
  }

  /* ── Stream a private object back to the client ── */
  async streamPrivateObject(objectPath: string, res: import("express").Response): Promise<void> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const entityId = objectPath.slice("/objects/".length);
    if (!entityId) throw new ObjectNotFoundError();

    if (BACKEND === "r2" || BACKEND === "s3") {
      const { client, bucket } = ensureS3Client();
      const key = `uploads/${entityId}`;
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        await streamS3ObjectToResponse(out, res, /* isPublic */ false);
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        if (e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) {
          throw new ObjectNotFoundError();
        }
        throw err;
      }
      return;
    }

    // Replit sidecar
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = ensureGcsClient().bucket(bucketName);
    const f = bucket.file(objectName);
    const [exists] = await f.exists();
    if (!exists) throw new ObjectNotFoundError();
    await streamGcsFileToResponse(f, res, /* isPublic */ false);
  }

  /* ── Issue a temporary download URL for the admin "Download original" button ── */
  async getObjectDownloadURL(objectPath: string, ttlSec = 900): Promise<string> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const entityId = objectPath.slice("/objects/".length);

    if (BACKEND === "r2" || BACKEND === "s3") {
      const { client, bucket } = ensureS3Client();
      const key = `uploads/${entityId}`;
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, cmd, { expiresIn: ttlSec });
    }

    // Replit sidecar
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    return signReplitSidecarURL({ bucketName, objectName, method: "GET", ttlSec });
  }

  /* ── Legacy methods (kept so existing imports don't break) ─────────── */
  async searchPublicObject(filePath: string): Promise<File | null> {
    if (BACKEND !== "replit") return null;
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = ensureGcsClient().bucket(bucketName);
      const file = bucket.file(objectName);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: File, cacheTtlSec = 3600): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === "public";
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    const headers: Record<string, string> = {
      "Content-Type": (metadata.contentType as string) || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (metadata.size) headers["Content-Length"] = String(metadata.size);
    return new Response(webStream, { headers });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (BACKEND !== "replit") {
      throw new Error("getObjectEntityFile is only available with the Replit backend");
    }
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) throw new ObjectNotFoundError();
    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) entityDir = `${entityDir}/`;
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = ensureGcsClient().bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) throw new ObjectNotFoundError();
    return objectFile;
  }

  async trySetObjectEntityAclPolicy(rawPath: string, aclPolicy: ObjectAclPolicy): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (BACKEND !== "replit") return normalizedPath;
    if (!normalizedPath.startsWith("/")) return normalizedPath;
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */
async function streamS3ObjectToResponse(
  out: GetObjectCommandOutput,
  res: import("express").Response,
  isPublic: boolean,
): Promise<void> {
  res.setHeader("Content-Type", out.ContentType || "application/octet-stream");
  res.setHeader("Cache-Control", `${isPublic ? "public" : "private"}, max-age=3600`);
  if (out.ContentLength) res.setHeader("Content-Length", String(out.ContentLength));
  const body = out.Body as Readable | undefined;
  if (!body) {
    res.end();
    return;
  }
  body.pipe(res);
}

async function streamGcsFileToResponse(
  file: File,
  res: import("express").Response,
  isPublic: boolean,
): Promise<void> {
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", (metadata.contentType as string) || "application/octet-stream");
  res.setHeader("Cache-Control", `${isPublic ? "public" : "private"}, max-age=3600`);
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  file.createReadStream().pipe(res);
}

async function signReplitSidecarURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL via Replit sidecar (status ${response.status}). ` +
        `Configure R2_* or S3_* env vars to use a portable backend instead.`,
    );
  }
  const { signed_url: signedURL } = (await response.json()) as { signed_url: string };
  return signedURL;
}

/* ─── Tiny check used at boot to log the active backend ─────────────────── */
export function logActiveStorageBackend(log: { info: (obj: object, msg: string) => void }): void {
  log.info({ backend: BACKEND }, `[storage] active backend: ${BACKEND}`);
}

void HeadObjectCommand;
