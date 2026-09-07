import { createHash } from "node:crypto";
import { readPsd } from "ag-psd";

export type PhotoshopMasterFormat = "psd" | "psb";

export type ParsedSmartObject = {
  layerName: string;
  layerId?: number;
  smartObjectId?: string;
  smartObjectType?: string;
  bounds: { x: number; y: number; w: number; h: number };
  transform?: number[];
};

export type ParsedPsdMaster = {
  fileName: string;
  mime: "image/vnd.adobe.photoshop" | "application/vnd.adobe.photoshop";
  format: PhotoshopMasterFormat;
  size: number;
  sha256: string;
  canvas: { width: number; height: number };
  smartObject: ParsedSmartObject;
};

export type PsdMasterParseResult =
  | { ok: true; value: ParsedPsdMaster }
  | { ok: false; errors: string[] };

const PSD_MIME = "image/vnd.adobe.photoshop";
const PSB_MIME = "application/vnd.adobe.photoshop";
const MAX_CANVAS_EDGE = 16_384;

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizedName(fileName: string): string {
  return fileName.trim().split(/[\\/]/).pop() ?? fileName.trim();
}

function detectFormat(buffer: Buffer): PhotoshopMasterFormat | null {
  if (buffer.length < 6 || buffer.subarray(0, 4).toString("ascii") !== "8BPS") return null;
  const version = buffer.readUInt16BE(4);
  return version === 1 ? "psd" : version === 2 ? "psb" : null;
}

function expectedMime(format: PhotoshopMasterFormat): ParsedPsdMaster["mime"] {
  return format === "psb" ? PSB_MIME : PSD_MIME;
}

function layerBounds(layer: Record<string, any>): ParsedSmartObject["bounds"] | null {
  const left = layer.left;
  const top = layer.top;
  const right = layer.right;
  const bottom = layer.bottom;
  if (![left, top, right, bottom].every(finiteNumber)) return null;
  const bounds = { x: left, y: top, w: right - left, h: bottom - top };
  return bounds.w > 0 && bounds.h > 0 ? bounds : null;
}

function findSmartObjects(layers: unknown[], matches: ParsedSmartObject[] = []): ParsedSmartObject[] {
  for (const candidate of layers) {
    if (!isRecord(candidate)) continue;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const placedLayer = isRecord(candidate.placedLayer) ? candidate.placedLayer : null;
    if (placedLayer) {
      const bounds = layerBounds(candidate);
      if (bounds) {
        const transform = Array.isArray(placedLayer.transform) && placedLayer.transform.every(finiteNumber)
          ? placedLayer.transform
          : undefined;
        matches.push({
          layerName: name,
          layerId: finiteNumber(candidate.id) ? candidate.id : undefined,
          smartObjectId: typeof placedLayer.id === "string" ? placedLayer.id : undefined,
          smartObjectType: typeof placedLayer.type === "string" ? placedLayer.type : undefined,
          bounds,
          transform,
        });
      }
    }
    if (Array.isArray(candidate.children)) findSmartObjects(candidate.children, matches);
  }
  return matches;
}

function parsePhotoshop(buffer: Buffer): { width: number; height: number; smartObjects: ParsedSmartObject[] } {
  const document = readPsd(buffer, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
  } as any) as any;
  const width = document?.width;
  const height = document?.height;
  if (!finiteNumber(width) || !finiteNumber(height)) {
    throw new Error("Photoshop document dimensions are missing.");
  }
  return {
    width,
    height,
    smartObjects: findSmartObjects(Array.isArray(document.children) ? document.children : []),
  };
}

export function parsePsdMaster(
  buffer: Buffer,
  fileName: string,
  declaredMime?: string | null,
): PsdMasterParseResult {
  const errors: string[] = [];
  const safeName = normalizedName(fileName);
  const format = detectFormat(buffer);
  const extension = /\.psb$/i.test(safeName) ? "psb" : /\.psd$/i.test(safeName) ? "psd" : null;

  if (!format) errors.push("The uploaded file is not a valid PSD/PSB document.");
  if (!extension) errors.push("The master filename must end in .psd or .psb.");
  if (format && extension && format !== extension) {
    errors.push(`The file signature is ${format.toUpperCase()} but the filename is ${extension.toUpperCase()}.`);
  }
  if (format && declaredMime && declaredMime !== expectedMime(format) && !(format === "psd" && declaredMime === "image/x-photoshop")) {
    errors.push(`The file MIME type does not match the ${format.toUpperCase()} signature.`);
  }
  if (buffer.length === 0) errors.push("The uploaded master is empty.");

  if (errors.length || !format) return { ok: false, errors };

  let parsed: { width: number; height: number; smartObjects: ParsedSmartObject[] };
  try {
    parsed = parsePhotoshop(buffer);
  } catch (error) {
    errors.push(error instanceof Error ? `Photoshop parser rejected the master: ${error.message}` : "Photoshop parser rejected the master.");
    return { ok: false, errors };
  }

  if (
    parsed.width < 1 ||
    parsed.height < 1 ||
    parsed.width > MAX_CANVAS_EDGE ||
    parsed.height > MAX_CANVAS_EDGE
  ) {
    errors.push(`Canvas dimensions must be between 1 and ${MAX_CANVAS_EDGE}px.`);
  }
  if (parsed.smartObjects.length !== 1) {
    errors.push(`Expected exactly one embedded Smart Object layer; found ${parsed.smartObjects.length}.`);
  }

  const smartObject = parsed.smartObjects[0];
  if (smartObject && !/(artwork|smart.?object)/i.test(smartObject.layerName)) {
    errors.push("The Smart Object layer must identify itself as artwork or a Smart Object.");
  }
  if (errors.length || !smartObject) return { ok: false, errors };

  return {
    ok: true,
    value: {
      fileName: safeName,
      mime: expectedMime(format),
      format,
      size: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      canvas: { width: parsed.width, height: parsed.height },
      smartObject,
    },
  };
}