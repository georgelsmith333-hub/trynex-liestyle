import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import sharp, { type OverlayOptions } from "sharp";
import {
  REQUIRED_RUNTIME_ROLES,
  validateRenderSurfaceManifest,
  type RuntimeRole,
  type SmartMockupIngestionManifest,
} from "../lib/mockupContract";

const router = Router();
const MAX_INPUT_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_PIXELS = 4096 * 4096;

function decodeImage(value: unknown): Buffer {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new Error("image_must_be_data_url");
  }
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("invalid_data_url");
  const buffer = Buffer.from(value.slice(comma + 1), "base64");
  if (!buffer.length || buffer.length > MAX_INPUT_BYTES) throw new Error("image_too_large");
  return buffer;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function numberInRange(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function ensureRoleImages(
  value: unknown,
  surface: SmartMockupIngestionManifest,
): Record<RuntimeRole, Buffer> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("runtime_role_images_required");
  }
  const input = value as Record<string, unknown>;
  const result = {} as Record<RuntimeRole, Buffer>;
  for (const role of REQUIRED_RUNTIME_ROLES) {
    const buffer = decodeImage(input[role]);
    if (sha256(buffer) !== surface.runtimeRoles[role].sha256.toLowerCase()) {
      throw new Error(`runtime_role_checksum_mismatch:${role}`);
    }
    result[role] = buffer;
  }
  return result;
}

async function applyOpacity(image: Buffer, opacity: number): Promise<Buffer> {
  if (opacity >= 1) return image;
  const metadata = await sharp(image).metadata();
  const width = metadata.width ?? 1;
  const height = metadata.height ?? 1;
  const alpha = Buffer.alloc(width * height, Math.round(opacity * 255));
  return sharp(image)
    .removeAlpha()
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();
}

router.post("/mockup/render", async (req: Request, res: Response) => {
  try {
    const validation = validateRenderSurfaceManifest(req.body?.surface);
    if (validation.errors.length > 0 || !validation.value) {
      throw new Error(`surface_contract_invalid:${validation.errors.join("|")}`);
    }
    const surface = validation.value;
    const roles = ensureRoleImages(req.body?.runtimeRoleImages, surface);
    const artwork = decodeImage(req.body?.artwork);

    const fit = req.body?.fit === "cover" ? "cover" : "contain";
    const opacity = numberInRange(req.body?.opacity, 0, 1, 1);
    const rotation = numberInRange(req.body?.rotation, -180, 180, 0);
    const brightness = numberInRange(req.body?.brightness, 0.4, 2.5, 1);
    const contrast = numberInRange(req.body?.contrast, 0.4, 2.5, 1);

    const baseImage = sharp(roles.base, { limitInputPixels: MAX_OUTPUT_PIXELS });
    const baseMeta = await baseImage.metadata();
    const canvasW = baseMeta.width ?? 1000;
    const canvasH = baseMeta.height ?? 1000;
    const zoneW = Math.max(1, Math.min(canvasW, Math.round(surface.printZone.w * canvasW)));
    const zoneH = Math.max(1, Math.min(canvasH, Math.round(surface.printZone.h * canvasH)));
    const zoneX = Math.round(numberInRange(surface.printZone.x, 0, 1, 0) * canvasW);
    const zoneY = Math.round(numberInRange(surface.printZone.y, 0, 1, 0) * canvasH);

    const artMeta = await sharp(artwork, { limitInputPixels: MAX_OUTPUT_PIXELS }).metadata();
    const artW = artMeta.width ?? zoneW;
    const artH = artMeta.height ?? zoneH;
    const scale = fit === "cover"
      ? Math.max(zoneW / artW, zoneH / artH)
      : Math.min(zoneW / artW, zoneH / artH);
    const resizedW = Math.max(1, Math.round(artW * scale));
    const resizedH = Math.max(1, Math.round(artH * scale));
    const left = Math.round(zoneX + (zoneW - resizedW) / 2);
    const top = Math.round(zoneY + (zoneH - resizedH) / 2);

    const renderedArtworkBase = await sharp(artwork, { limitInputPixels: MAX_OUTPUT_PIXELS })
      .resize(resizedW, resizedH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
      .modulate({ brightness })
      .linear(contrast, 128 - 128 * contrast)
      .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .png()
      .toBuffer();
    const renderedArtwork = await applyOpacity(renderedArtworkBase, opacity);

    const mask = await sharp(roles.printMask)
      .extract({ left: zoneX, top: zoneY, width: zoneW, height: zoneH })
      .resize(resizedW, resizedH, { fit: "fill" })
      .greyscale()
      .png()
      .toBuffer();
    const maskedArtwork = await sharp(renderedArtwork)
      .removeAlpha()
      .joinChannel(mask)
      .png()
      .toBuffer();

    const background = await sharp(roles.studioBackground)
      .resize(canvasW, canvasH, { fit: "fill" })
      .ensureAlpha()
      .png()
      .toBuffer();
    const composites: OverlayOptions[] = [
      { input: roles.base, left: 0, top: 0 },
      { input: maskedArtwork, left, top },
      { input: await sharp(roles.shadow).resize(canvasW, canvasH, { fit: "fill" }).ensureAlpha().png().toBuffer(), left: 0, top: 0, blend: "multiply" },
      { input: await sharp(roles.protected).resize(canvasW, canvasH, { fit: "fill" }).ensureAlpha().png().toBuffer(), left: 0, top: 0 },
      { input: await sharp(roles.highlight).resize(canvasW, canvasH, { fit: "fill" }).ensureAlpha().png().toBuffer(), left: 0, top: 0, blend: "screen" },
    ];

    const output = await sharp(background, { limitInputPixels: MAX_OUTPUT_PIXELS })
      .composite(composites)
      .png({ compressionLevel: 9 })
      .toBuffer();
    res.setHeader("Cache-Control", "private, max-age=60");
    res.setHeader("X-Mockup-Surface-Key", surface.sourceKitKey);
    res.type("image/png").send(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : "render_failed";
    const status = message.startsWith("surface_contract_invalid") ||
      message === "runtime_role_images_required" ||
      message === "image_must_be_data_url" ||
      message === "invalid_data_url" ||
      message === "image_too_large" ||
      message.startsWith("runtime_role_checksum_mismatch")
      ? 400
      : 422;
    req.log.warn({ err: error }, "Mockup render failed");
    res.status(status).json({ error: "mockup_render_failed", message });
  }
});

export default router;