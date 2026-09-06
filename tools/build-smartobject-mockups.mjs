/**
 * TryNex smart-object mockup master builder.
 *
 * Produces real layered PSD masters in which the artwork layer is a genuine
 * Photoshop smart object: a `PlLd` placed-layer descriptor on the layer plus a
 * `lnk2` linked-file block carrying the embedded smart-object document.
 * Double-clicking "Artwork" in Photoshop opens the embedded document; editing
 * and saving it updates the mockup live.
 *
 * Usage:
 *   node tools/build-smartobject-mockups.mjs [--out dir] [--only family]
 *   node tools/build-smartobject-mockups.mjs --v10 --out dist-mockups/staging/smart-v10/masters
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { ColorMode, writePsdUint8Array } from "ag-psd";

const REPO = path.resolve(import.meta.dirname, "..");
const SOURCE_KIT = path.join(REPO, "attached_assets", "trynex-mockup-source-kit");
const SOURCE_PREVIEWS = path.join(SOURCE_KIT, "previews");
const SOURCE_MANIFEST = path.join(SOURCE_KIT, "manifest.json");
const V10_SOURCE_ROOT = path.resolve(
  process.env.TRYNEX_V10_SOURCE_ROOT ??
    path.join(REPO, "attached_assets", "generated_images", "v10-sources-v3"),
);

const CANVAS = 1024;
const BUILD_VERSION = "smart-v1.4";
const V10_BUILD_VERSION = "smart-v10.3";

/** The complete canonical matrix. Missing faces are explicitly derived below. */
export const CANONICAL = {
  tshirt: {
    label: "Unisex T-Shirt",
    colors: ["white", "black", "navy", "maroon", "olive", "sky-blue", "grey", "red"],
    views: {
      front: { zone: { x: 240, y: 185, w: 520, h: 580 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 240, y: 185, w: 520, h: 580 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  longsleeve: {
    label: "Unisex Long Sleeve",
    colors: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
    views: {
      front: { zone: { x: 312, y: 222, w: 376, h: 404 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 292, y: 195, w: 416, h: 458 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  hoodie: {
    label: "Unisex Hoodie",
    colors: ["white", "black", "charcoal", "heather-grey", "navy", "royal-blue", "forest-green", "burgundy", "red", "sand"],
    views: {
      front: { zone: { x: 240, y: 270, w: 520, h: 400 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 292, y: 184, w: 416, h: 448 }, sourceView: "back", provenance: "authentic-preserved" },
      "left-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "left-sleeve-polygon" },
      "right-sleeve": { zone: { x: 175, y: 175, w: 650, h: 650 }, sourceView: "front", provenance: "generated-master", derivation: "right-sleeve-polygon" },
      "neck-label": { zone: { x: 150, y: 265, w: 700, h: 470 }, sourceView: "front", provenance: "generated-master", derivation: "neck-label-crop" },
    },
  },
  mug: {
    label: "Ceramic Mug",
    colors: ["white", "black", "navy", "red", "green", "purple", "sky-blue", "pink", "maroon", "orange"],
    views: {
      front: { zone: { x: 165, y: 220, w: 475, h: 580 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 384, y: 220, w: 451, h: 580 }, sourceView: "back", provenance: "authentic-preserved" },
      wrap: { zone: { x: 165, y: 220, w: 670, h: 580 }, sourceView: "front", provenance: "generated-master", derivation: "mug-wrap-body-composite" },
    },
  },
  cap: {
    label: "Structured Cap",
    colors: ["white", "black", "navy", "maroon", "olive", "red", "grey", "forest"],
    views: {
      front: { zone: { x: 240, y: 260, w: 540, h: 320 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 285, y: 270, w: 430, h: 230 }, sourceView: "back", provenance: "authentic-preserved" },
    },
  },
  waterbottle: {
    label: "Water Bottle - White Sublimation Aluminium",
    colors: ["white"],
    views: {
      front: { zone: { x: 335, y: 320, w: 276, h: 590 }, sourceView: "front", provenance: "authentic-preserved" },
      back: { zone: { x: 335, y: 320, w: 276, h: 590 }, sourceView: "back", provenance: "authentic-preserved" },
    },
  },
};

function readSourceManifest() {
  if (!existsSync(SOURCE_MANIFEST)) {
    throw new Error(`source manifest is missing: ${SOURCE_MANIFEST}`);
  }
  return JSON.parse(readFileSync(SOURCE_MANIFEST, "utf8"));
}

function normalizeSlug(value) {
  return String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function sourceSurface(family, color, view, manifest = readSourceManifest()) {
  const row = manifest.documents.find((entry) =>
    normalizeSlug(entry.product) === normalizeSlug(family) &&
    normalizeSlug(entry.color) === normalizeSlug(color) &&
    normalizeSlug(entry.view) === normalizeSlug(view)
  );
  if (!row) {
    throw new Error(`source manifest has no ${family}/${color}/${view} surface`);
  }
  return row;
}

export function readPng(file) {
  const png = PNG.sync.read(readFileSync(file));
  return { data: new Uint8Array(png.data.buffer, png.data.byteOffset, png.data.length), width: png.width, height: png.height };
}

function mirrorPng(source) {
  const data = new Uint8Array(source.data.length);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const from = (y * source.width + x) * 4;
      const to = (y * source.width + (source.width - 1 - x)) * 4;
      data[to] = source.data[from];
      data[to + 1] = source.data[from + 1];
      data[to + 2] = source.data[from + 2];
      data[to + 3] = source.data[from + 3];
    }
  }
  return { data, width: source.width, height: source.height };
}

export function pngBytes({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(png.data);
  return PNG.sync.write(png);
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function copyPixel(source, target, sourceX, sourceY, targetX, targetY, alpha = 255) {
  if (sourceX < 0 || sourceY < 0 || sourceX >= source.width || sourceY >= source.height) return;
  if (targetX < 0 || targetY < 0 || targetX >= target.width || targetY >= target.height) return;
  const si = (sourceY * source.width + sourceX) * 4;
  const ti = (targetY * target.width + targetX) * 4;
  const sourceAlpha = (source.data[si + 3] * alpha) / 255;
  const inverse = 1 - sourceAlpha / 255;
  target.data[ti] = Math.round(source.data[si] * sourceAlpha / 255 + target.data[ti] * inverse);
  target.data[ti + 1] = Math.round(source.data[si + 1] * sourceAlpha / 255 + target.data[ti + 1] * inverse);
  target.data[ti + 2] = Math.round(source.data[si + 2] * sourceAlpha / 255 + target.data[ti + 2] * inverse);
  target.data[ti + 3] = Math.min(255, Math.round(sourceAlpha + target.data[ti + 3] * inverse));
}

function transparentCanvas(width = CANVAS, height = CANVAS) {
  return solid(width, height, 0, 0, 0, 0);
}

function polygonContains(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y)) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Derive a missing canonical face from an immutable same-family source photo.
 * This is intentionally explicit: the manifest records the source face and
 * derivation, and no missing face is silently substituted as an authentic view.
 */
const COLOR_HEX = {
  white: "#f8f7f4", black: "#1a1a1a", navy: "#1e3a5f", maroon: "#7f1d1d",
  olive: "#4a5240", "sky-blue": "#0ea5e9", grey: "#6b7280", red: "#dc2626",
  burgundy: "#6b1a2c", forest: "#166534", "forest-green": "#166534",
  charcoal: "#303030", "heather-grey": "#a3a3a3", "royal-blue": "#2563eb",
  sand: "#d2bd88", green: "#16a34a", purple: "#7c3aed", pink: "#ec4899", orange: "#ea580c",
};

function colorizeTemplate(template, color, alphaMask) {
  const target = color === "white"
    ? [1, 1, 1]
    : (() => {
      const hex = COLOR_HEX[color];
      if (!hex) throw new Error(`no approved color transform for ${color}`);
      return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
    })();
  const data = new Uint8Array(template.data.length);
  for (let i = 0; i < template.data.length; i += 4) {
    const luminance = (0.2126 * template.data[i] + 0.7152 * template.data[i + 1] + 0.0722 * template.data[i + 2]) / 255;
    data[i] = color === "white" ? template.data[i] : Math.round(target[0] * luminance);
    data[i + 1] = color === "white" ? template.data[i + 1] : Math.round(target[1] * luminance);
    data[i + 2] = color === "white" ? template.data[i + 2] : Math.round(target[2] * luminance);
    data[i + 3] = Math.round(template.data[i + 3] * (alphaMask ? alphaMask.data[i] / 255 : 1));
  }
  return { data, width: template.width, height: template.height };
}

/**
 * Apply a material colour to a photoreal source while retaining its lighting,
 * alpha silhouette, folds, seams, and protected details. White and the
 * sublimation bottle remain source-authentic rather than being tinted.
 */
function colorizePhoto(source, color, family) {
  if (color === "white" || family === "waterbottle") return source;
  const hex = COLOR_HEX[color];
  if (!hex) throw new Error(`no approved photoreal color transform for ${color}`);
  const target = [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
  const data = new Uint8Array(source.data.length);
  for (let i = 0; i < source.data.length; i += 4) {
    const luminance = (0.2126 * source.data[i] + 0.7152 * source.data[i + 1] + 0.0722 * source.data[i + 2]) / 255;
    const value = Math.max(0.08, Math.min(1, 0.16 + luminance * 0.84));
    data[i] = Math.round(target[0] * value);
    data[i + 1] = Math.round(target[1] * value);
    data[i + 2] = Math.round(target[2] * value);
    data[i + 3] = source.data[i + 3];
  }
  return { data, width: source.width, height: source.height };
}

function v10SourceSurface(family, color, view) {
  const sourcePath = path.join(V10_SOURCE_ROOT, `${family}-${view}.png`);
  if (!existsSync(sourcePath)) throw new Error(`missing v10 source ${path.relative(REPO, sourcePath)}`);
  const original = readPng(sourcePath);
  const source = family === "mug" && view === "back" ? mirrorPng(original) : original;
  return {
    path: sourcePath,
    bytes: readFileSync(sourcePath),
    png: colorizePhoto(source, color, family),
    transform: family === "mug" && view === "back" ? "horizontal-mirror-for-opposite-handle" : "preserved-source",
  };
}

function clipFaceTemplateAlpha(alphaMask, family, view) {
  if (!alphaMask || view !== "neck-label") return alphaMask;
  const points = family === "tshirt"
    ? [[130, 280], [240, 235], [784, 235], [894, 280], [894, 790], [130, 790]]
    : family === "longsleeve"
      ? [[130, 560], [250, 455], [380, 430], [650, 430], [780, 455], [894, 560], [894, 780], [130, 780]]
      : [[140, 360], [260, 300], [760, 300], [880, 360], [880, 820], [140, 820]];
  const data = new Uint8Array(alphaMask.data);
  for (let y = 0; y < alphaMask.height; y++) {
    for (let x = 0; x < alphaMask.width; x++) {
      if (polygonContains(x, y, points)) continue;
      const i = (y * alphaMask.width + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  return { data, width: alphaMask.width, height: alphaMask.height };
}

function deriveSurfaceBase({ family, color, view, source, sourceBack, faceTemplate, faceAlpha }) {
  if (faceTemplate) return colorizeTemplate(faceTemplate, color, clipFaceTemplateAlpha(faceAlpha, family, view));
  if (view === "front" || view === "back") return source;
  const out = transparentCanvas(source.width, source.height);
  const mirror = (x) => source.width - 1 - x;

  if (view === "left-sleeve" || view === "right-sleeve") {
    const points = family === "tshirt"
      ? [[0, 210], [270, 145], [390, 285], [285, 600], [150, 850], [0, 900]]
      : family === "longsleeve"
        ? [[0, 180], [300, 145], [365, 300], [285, 700], [160, 930], [0, 960]]
        : [[0, 170], [330, 110], [390, 325], [285, 760], [155, 970], [0, 980]];
    const selected = view === "left-sleeve" ? points : points.map(([x, y]) => [mirror(x), y]);
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (polygonContains(x, y, selected)) copyPixel(source, out, x, y, x, y);
      }
    }
  } else if (view === "neck-label") {
    const box = { x: 300, y: 35, w: 424, h: 285 };
    for (let y = box.y; y < box.y + box.h; y++) {
      for (let x = box.x; x < box.x + box.w; x++) copyPixel(source, out, x, y, x, y);
    }
  } else if (view === "wrap") {
    // A wrap is a distinct body derivation: blend the front body with the
    // mirrored back body to create a wider, seam-padded operator surface.
    const back = sourceBack ?? source;
    const body = { x: 150, y: 200, w: 700, h: 650 };
    for (let y = body.y; y < body.y + body.h; y++) {
      for (let x = body.x; x < body.x + body.w; x++) {
        const t = (x - body.x) / Math.max(1, body.w - 1);
        const sourceX = Math.round((x < body.x + body.w / 2 ? x : mirror(x)) * (source.width - 1) / Math.max(1, source.width - 1));
        const first = x < body.x + body.w / 2 ? source : back;
        const second = x < body.x + body.w / 2 ? back : source;
        const firstX = Math.max(0, Math.min(first.width - 1, sourceX));
        const secondX = Math.max(0, Math.min(second.width - 1, sourceX));
        copyPixel(first, out, firstX, y, x, y, Math.round(255 * (1 - t * 0.18)));
        copyPixel(second, out, secondX, y, x, y, Math.round(255 * (t * 0.18)));
      }
    }
  } else {
    throw new Error(`no approved derivation for ${family}/${view}`);
  }
  return out;
}

/** Solid RGBA canvas. */
export function solid(w, h, r, g, b, a = 255) {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { data, width: w, height: h };
}

/** Visible proof artwork that can be edited inside the embedded Smart Object. */
function artworkProof(w, h, label = "TRY NEX") {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const onBorder = x < 6 || y < 6 || x >= w - 6 || y >= h - 6;
      const onCross = Math.abs(x - y) < 6 || Math.abs(x + y - (w - 1)) < 6;
      const stripe = Math.floor((x + y) / Math.max(1, Math.floor(w / 10))) % 2 === 0;
      if (onBorder || onCross || (stripe && x > w * 0.18 && x < w * 0.82 && y > h * 0.42 && y < h * 0.58)) {
        data[i] = 238; data[i + 1] = 84; data[i + 2] = 48; data[i + 3] = 230;
      } else {
        data[i] = 0; data[i + 1] = 0; data[i + 2] = 0; data[i + 3] = 0;
      }
    }
  }
  return { data, width: w, height: h };
}

/** Encode the embedded proof artwork as the editable linked-file payload. */
function soPngBytes({ data, width, height }) {
  const png = new PNG({ width, height });
  Buffer.from(data.buffer, data.byteOffset, data.length).copy(png.data);
  return PNG.sync.write(png);
}

/** Stable GUID-like IDs keep the staging output reproducible across runs. */
function stableSoId(family, color, view) {
  const seed = `${family}:${color}:${view}:trynex-smart-object`;
  const hex = Array.from(seed).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 2166136261).toString(16).padStart(8, "0");
  const doubled = `${hex}${hex}${hex}${hex}`;
  return `${doubled.slice(0, 8)}-${doubled.slice(8, 12)}-${doubled.slice(12, 16)}-${doubled.slice(16, 20)}-${doubled.slice(20, 32)}`;
}

export function shadowMap(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const luminance = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
    const alpha = Math.max(0, Math.min(72, Math.round((235 - luminance) * 0.55)));
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = alpha;
  }
  return { data, width: base.width, height: base.height };
}

export function highlightMap(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const luminance = 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
    const alpha = Math.max(0, Math.min(36, Math.round((luminance - 205) * 0.28)));
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = alpha;
  }
  return { data, width: base.width, height: base.height };
}

/**
 * Extract only source-photo detail pixels that must sit above artwork.
 *
 * The base pass already owns the complete product silhouette. Repeating that
 * silhouette in the protected layer would make the runtime brittle and would
 * hide artwork instead of preserving seams and hardware. This pass therefore
 * keeps local contrast edges from the reviewed source photo, which captures
 * collars, hood cords, stitching, rims, handles, cap seams, and bottle
 * hardware while remaining transparent over ordinary body fabric.
 */
export function protectedDetails(base, family, view, zone) {
  const data = new Uint8Array(base.data.length);
  const isApparel = family === "tshirt" || family === "longsleeve" || family === "hoodie";
  const threshold = family === "cap" ? 8 : family === "mug" ? 9 : family === "waterbottle" ? 10 : 11;
  const edgeGain = family === "cap" ? 22 : family === "waterbottle" ? 20 : 18;
  let luminanceTotal = 0;
  let visiblePixels = 0;
  for (let index = 0; index < base.data.length; index += 4) {
    if (base.data[index + 3] === 0) continue;
    luminanceTotal += 0.2126 * base.data[index] + 0.7152 * base.data[index + 1] + 0.0722 * base.data[index + 2];
    visiblePixels++;
  }
  // colorizePhoto scales contrast with the target garment colour. Normalize
  // the edge signal back toward the reviewed white source so black/navy
  // surfaces do not lose their collar/stitch detail during extraction.
  const averageLuminance = visiblePixels ? luminanceTotal / visiblePixels : 255;
  const contrastScale = Math.min(10, Math.max(1, 220 / Math.max(averageLuminance, 22)));
  const luminanceAt = (x, y) => {
    const px = Math.max(0, Math.min(base.width - 1, x));
    const py = Math.max(0, Math.min(base.height - 1, y));
    const i = (py * base.width + px) * 4;
    return 0.2126 * base.data[i] + 0.7152 * base.data[i + 1] + 0.0722 * base.data[i + 2];
  };
  const alphaAt = (x, y) => base.data[(y * base.width + x) * 4 + 3];
  const inZone = (x, y) => x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h;

  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const sourceIndex = (y * base.width + x) * 4;
      if (base.data[sourceIndex + 3] === 0) continue;

      // A protected role may include detail outside the print zone (handles,
      // rims, brims, and hardware), but never turns into a second full base.
      const localEdge = Math.max(
        Math.abs(luminanceAt(x, y) - luminanceAt(x - 2, y)),
        Math.abs(luminanceAt(x, y) - luminanceAt(x + 2, y)),
        Math.abs(luminanceAt(x, y) - luminanceAt(x, y - 2)),
        Math.abs(luminanceAt(x, y) - luminanceAt(x, y + 2)),
      );
      const normalizedEdge = localEdge * contrastScale;

      // Keep hardware's broad dark material, not just its outline. This is
      // important for the bottle lid/loop and the dark adjustment hardware on
      // the rear cap, whose interiors have intentionally low local contrast.
      const bottleHardware = family === "waterbottle" && y < 330 && luminanceAt(x, y) < 105;
      const rearCapHardware = family === "cap" && view === "back" && y > 420 && luminanceAt(x, y) < 120;

      // Ordinary body edges outside the printable region are safe to retain
      // and make the role useful for handles, hems, and outer seams. Inside
      // the zone only the edge/detail signal is allowed through.
      const allowed = normalizedEdge >= threshold || bottleHardware || rearCapHardware;
      if (!allowed) continue;
      const inside = inZone(x, y);
      const detailAlpha = bottleHardware || rearCapHardware
        ? 210
        : Math.max(0, Math.min(235, Math.round((normalizedEdge - threshold) * edgeGain)));
      if (inside && isApparel && view === "neck-label") {
        // Neck-label is a flat detail crop; keep its seam signal slightly
        // stronger so the label boundary survives artwork placed on it.
        data[sourceIndex + 3] = Math.max(detailAlpha, Math.min(180, Math.round(normalizedEdge * 10)));
      } else {
        data[sourceIndex + 3] = detailAlpha;
      }
      data[sourceIndex] = base.data[sourceIndex];
      data[sourceIndex + 1] = base.data[sourceIndex + 1];
      data[sourceIndex + 2] = base.data[sourceIndex + 2];
    }
  }
  return { data, width: base.width, height: base.height };
}

function flattenProof(base, proof, zone) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const alpha = base.data[i + 3] / 255;
    const inverse = 1 - alpha;
    data[i] = Math.round(base.data[i] * alpha + 250 * inverse);
    data[i + 1] = Math.round(base.data[i + 1] * alpha + 248 * inverse);
    data[i + 2] = Math.round(base.data[i + 2] * alpha + 245 * inverse);
    data[i + 3] = 255;
  }
  for (let y = 0; y < zone.h; y++) {
    const sourceY = Math.min(proof.height - 1, Math.floor(y * proof.height / zone.h));
    for (let x = 0; x < zone.w; x++) {
      const sourceX = Math.min(proof.width - 1, Math.floor(x * proof.width / zone.w));
      const destinationX = zone.x + x;
      const destinationY = zone.y + y;
      if (destinationX < 0 || destinationY < 0 || destinationX >= base.width || destinationY >= base.height) continue;
      const sourceIndex = (sourceY * proof.width + sourceX) * 4;
      const destinationIndex = (destinationY * base.width + destinationX) * 4;
      const alpha = proof.data[sourceIndex + 3] / 255;
      const inverse = 1 - alpha;
      data[destinationIndex] = Math.round(proof.data[sourceIndex] * alpha + data[destinationIndex] * inverse);
      data[destinationIndex + 1] = Math.round(proof.data[sourceIndex + 1] * alpha + data[destinationIndex + 1] * inverse);
      data[destinationIndex + 2] = Math.round(proof.data[sourceIndex + 2] * alpha + data[destinationIndex + 2] * inverse);
      data[destinationIndex + 3] = 255;
    }
  }
  return { data, width: base.width, height: base.height };
}

function flattenBase(base) {
  const data = new Uint8Array(base.data.length);
  for (let i = 0; i < base.data.length; i += 4) {
    const alpha = base.data[i + 3] / 255;
    const inverse = 1 - alpha;
    data[i] = Math.round(base.data[i] * alpha + 250 * inverse);
    data[i + 1] = Math.round(base.data[i + 1] * alpha + 248 * inverse);
    data[i + 2] = Math.round(base.data[i + 2] * alpha + 245 * inverse);
    data[i + 3] = 255;
  }
  return { data, width: base.width, height: base.height };
}

/**
 * Build one layered PSD master with a real smart-object artwork layer.
 */
export function buildMaster({ family, color, view, zone, basePng, proofLabel = "TRY NEX" }) {
  const base = basePng ?? readPng(path.join(SOURCE_PREVIEWS, `${family}-${color}-${view}.png`));
  const soId = stableSoId(family, color, view);

  // Smart object content: a square artwork canvas matching the print zone's
  // larger dimension, so a pasted design keeps its aspect ratio.
  const soSize = Math.max(zone.w, zone.h);
  const soDoc = artworkProof(soSize, soSize, proofLabel);
  const soBytes = soPngBytes(soDoc);

  // Photoshop stores the four destination corners as x/y pairs.
  const transform = [
    zone.x, zone.y,
    zone.x + zone.w, zone.y,
    zone.x + zone.w, zone.y + zone.h,
    zone.x, zone.y + zone.h,
  ];

  const layers = [];
  const linkedFiles = [];

  // 1. Studio background (bottom)
  layers.push({
    name: "00 Studio Background - Warm White",
    imageData: solid(CANVAS, CANVAS, 250, 248, 245, 255),
  });

  // 2. Product photo (the blank garment)
  layers.push({
    name: `10 Product Base - ${family} - ${color} - ${view}`,
    imageData: base,
  });

  // 3. Source-derived fold/shadow response
  layers.push({
    name: "20 Shadow / Fold Map - multiply",
    blendMode: "multiply",
    opacity: 0.22,
    imageData: shadowMap(base),
  });

  // 4. ARTWORK - the real smart object
  layers.push({
    name: `30 Artwork - SMART OBJECT - ${family}-${color}-${view}`,
    imageData: soDoc,
    placedLayer: {
      id: soId,
      placed: `${soId}-placed`,
      type: "raster",
      transform,
      width: soSize,
      height: soSize,
      resolution: { units: "Density", value: 72 },
    },
  });

  // 5. Protected source-photo details stay above artwork.
  layers.push({
    name: "40 Protected Details - reviewed source edges",
    imageData: protectedDetails(base, family, view, zone),
  });

  // 6. Source-derived highlight response
  layers.push({
    name: "50 Highlight / Material Response - screen",
    blendMode: "screen",
    opacity: 0.18,
    imageData: highlightMap(base),
  });

  // 7. Hidden print-zone review layer
  layers.push({
    name: "60 Print Zone Mask - hidden review",
    hidden: true,
    imageData: zoneMask(zone),
  });

  // 8. Hidden placement guide
  layers.push({
    name: "70 Placement Guide - hidden review",
    hidden: true,
    imageData: zoneGuide(zone),
  });

  linkedFiles.push({
    id: soId,
    name: `${family}-${color}-${view}-artwork-proof.png`,
    type: "png ",
    creator: "TryNex",
    data: new Uint8Array(soBytes),
    time: "2026-09-01T00:00:00.000Z",
    descriptor: { compInfo: { compID: 0, originalCompID: 0 } },
  });

  return {
    psd: {
      width: CANVAS,
      height: CANVAS,
      channels: 4,
      bitsPerChannel: 8,
      colorMode: ColorMode.RGB,
      imageData: flattenProof(base, soDoc, zone),
      children: layers,
      linkedFiles,
    },
    soId,
    proofDesign: soDoc,
    transform,
  };
}

/** Semi-transparent zone fill for a hidden review layer. */
function zoneMask(zone) {
  const data = new Uint8Array(CANVAS * CANVAS * 4);
  for (let y = Math.max(0, zone.y); y < Math.min(CANVAS, zone.y + zone.h); y++) {
    for (let x = Math.max(0, zone.x); x < Math.min(CANVAS, zone.x + zone.w); x++) {
      const i = (y * CANVAS + x) * 4;
      data[i] = 255;
      data[i + 1] = 140;
      data[i + 2] = 40;
      data[i + 3] = 28;
    }
  }
  return { data, width: CANVAS, height: CANVAS };
}

/** Dashed rectangle marking the print zone. */
function zoneGuide(zone) {
  const data = new Uint8Array(CANVAS * CANVAS * 4);
  const put = (x, y) => {
    if (x < 0 || y < 0 || x >= CANVAS || y >= CANVAS) return;
    const i = (y * CANVAS + x) * 4;
    data[i] = 255; data[i + 1] = 60; data[i + 2] = 20; data[i + 3] = 255;
  };
  const dash = 14;
  for (let x = zone.x; x < zone.x + zone.w; x++) {
    if (Math.floor(x / dash) % 2 === 0) { put(x, zone.y); put(x, zone.y + zone.h - 1); }
  }
  for (let y = zone.y; y < zone.y + zone.h; y++) {
    if (Math.floor(y / dash) % 2 === 0) { put(zone.x, y); put(zone.x + zone.w - 1, y); }
  }
  return { data, width: CANVAS, height: CANVAS };
}

function parseArgs(argv) {
  const get = (name, fallback = null) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  return {
    outRoot: path.resolve(get("--out", path.join(REPO, "dist-mockups", "staging", "smart-v1", "masters"))),
    stage1: argv.includes("--stage1"),
    v10: argv.includes("--v10"),
    only: get("--only"),
    resume: argv.includes("--resume"),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const { outRoot, stage1, v10, only, resume } = parseArgs(argv);
  const sourceManifest = v10 ? null : readSourceManifest();
  const stagingRoot = path.dirname(outRoot);
  const sourceRoot = path.join(stagingRoot, "sources");
  const templateRoot = path.join(stagingRoot, "templates");
  const previewRoot = path.join(stagingRoot, "previews");
  const proofPreviewRoot = path.join(stagingRoot, "proof-previews");

  let built = 0, failed = 0;
  for (const [family, spec] of Object.entries(CANONICAL)) {
    if (only && family !== only) continue;
    const famDir = path.join(outRoot, family);
    mkdirSync(famDir, { recursive: true });
    const surfaces = stage1 ? [["white", "front"]] : spec.colors.flatMap((color) => Object.keys(spec.views).map((view) => [color, view]));
    for (const [color, view] of surfaces) {
      try {
        const viewSpec = spec.views[view];
        const sourceView = viewSpec.sourceView;
          const source = v10 ? v10SourceSurface(family, color, sourceView) : sourceSurface(family, color, sourceView, sourceManifest);
          const sourceBack = view === "wrap"
            ? (v10 ? v10SourceSurface(family, color, "back") : sourceSurface(family, color, "back", sourceManifest))
            : null;
          const basePath = v10 ? source.path : path.join(SOURCE_KIT, source.preview);
          const backPath = sourceBack ? (v10 ? sourceBack.path : path.join(SOURCE_KIT, sourceBack.preview)) : null;
          if (!existsSync(basePath)) throw new Error(`missing source preview ${v10 ? path.relative(REPO, basePath) : source.preview}`);
          if (backPath && !existsSync(backPath)) throw new Error(`missing source preview ${v10 ? path.relative(REPO, backPath) : sourceBack.preview}`);
          const sourceBytes = v10 ? source.bytes : readFileSync(basePath);
          const sourcePng = v10 ? source.png : readPng(basePath);
          const templatePath = !v10 && view !== "front" && view !== "back" ? path.join(templateRoot, family, `${view}.png`) : null;
        const templateAlphaPath = view !== "front" && view !== "back" ? path.join(templateRoot, family, `${view}-alpha.png`) : null;
        const faceTemplate = templatePath && existsSync(templatePath) ? readPng(templatePath) : undefined;
        const faceTemplateChecksum = templatePath && existsSync(templatePath) ? sha256(readFileSync(templatePath)) : null;
          const faceAlpha = !v10 && templateAlphaPath && existsSync(templateAlphaPath) ? readPng(templateAlphaPath) : undefined;
        const faceAlphaTemplateChecksum = templateAlphaPath && existsSync(templateAlphaPath) ? sha256(readFileSync(templateAlphaPath)) : null;
        const base = deriveSurfaceBase({
          family,
          color,
          view,
          source: sourcePng,
            sourceBack: backPath ? (v10 ? sourceBack.png : readPng(backPath)) : undefined,
          faceTemplate,
          faceAlpha,
        });
        const baseBytes = pngBytes(base);
        const sourceChecksum = sha256(sourceBytes);
        const baseChecksum = sha256(baseBytes);
        const surfaceDir = path.join(sourceRoot, family, color);
        const previewDir = path.join(previewRoot, family, color);
        const proofDir = path.join(proofPreviewRoot, family, color);
        mkdirSync(surfaceDir, { recursive: true });
        mkdirSync(previewDir, { recursive: true });
        mkdirSync(proofDir, { recursive: true });
        const derivedBasePath = path.join(surfaceDir, `${view}.png`);
        const runtimePreviewPath = path.join(previewDir, `${view}.png`);
        const proofPath = path.join(proofDir, `${view}.png`);
        writeFileSync(derivedBasePath, baseBytes);
        const zone = viewSpec.zone;
          const masterFormat = v10 && (family === "mug" || family === "waterbottle") ? "psb" : "psd";
          const outputPath = path.join(famDir, `${family}-${color}-${view}.${masterFormat}`);
        const metadataPath = path.join(famDir, `${family}-${color}-${view}.json`);
        if (resume && existsSync(outputPath) && existsSync(metadataPath)) {
          try {
            const prior = JSON.parse(readFileSync(metadataPath, "utf8"));
            if (prior.schema === "trynex-smart-master/v3" && prior.generatorVersion === (v10 ? V10_BUILD_VERSION : BUILD_VERSION) && prior.sourceChecksum === sourceChecksum && prior.baseChecksum === baseChecksum && prior.faceTemplateChecksum === faceTemplateChecksum && prior.faceAlphaTemplateChecksum === faceAlphaTemplateChecksum && prior.derivation === (viewSpec.derivation ?? "preserved-source")) {
              console.log(`  = resume ${family}/${color}/${view}`);
              built++;
              continue;
            }
          } catch {
            // An unreadable or stale metadata file is rebuilt below.
          }
        }
        const { psd, transform } = buildMaster({
          family,
          color,
          view,
          zone,
          basePng: base,
          proofLabel: stage1 ? `STAGE 1 - ${family}` : "TRY NEX",
        });
         writeFileSync(outputPath, writePsdUint8Array(psd, { psb: masterFormat === "psb" }));
        writeFileSync(runtimePreviewPath, pngBytes(flattenBase(base)));
        writeFileSync(proofPath, pngBytes(psd.imageData));
        const masterBytes = readFileSync(outputPath);
        writeFileSync(metadataPath, JSON.stringify({
          schema: "trynex-smart-master/v3",
          generator: "tools/build-smartobject-mockups.mjs",
           generatorVersion: v10 ? V10_BUILD_VERSION : BUILD_VERSION,
          family, color, view,
          sourceView,
           sourcePreview: v10 ? path.relative(REPO, source.path) : source.preview,
           sourceChecksum,
           sourceTransform: v10 ? source.transform : "preserved-source",
           sourceBackPreview: sourceBack ? (v10 ? path.relative(REPO, sourceBack.path) : sourceBack.preview) : null,
           sourceBackChecksum: sourceBack ? sha256(readFileSync(backPath)) : null,
           sourceBackTransform: sourceBack ? (v10 ? sourceBack.transform : "preserved-source") : null,
          faceTemplatePath: templatePath ? path.relative(REPO, templatePath) : null,
          faceTemplateChecksum,
          faceAlphaTemplatePath: templateAlphaPath ? path.relative(REPO, templateAlphaPath) : null,
          faceAlphaTemplateChecksum,
          derivedBasePath: path.relative(REPO, derivedBasePath),
          baseChecksum,
          printZone: zone,
          normalizedFrame: { canvasWidth: CANVAS, canvasHeight: CANVAS, x: 0, y: 0, w: CANVAS, h: CANVAS },
          derivation: viewSpec.derivation ?? "preserved-source",
          provenance: viewSpec.provenance,
          warp: family === "mug" || family === "waterbottle"
            ? { mode: "cylinder", curvature: 0.16, seamPadding: 0.035, preserveAspect: true }
            : family === "cap"
              ? { mode: "cap-panel", curvature: 0.10, seamPadding: 0.025, preserveAspect: true }
              : { mode: "flat", curvature: 0, seamPadding: 0.02, preserveAspect: true },
          smartObject: {
            layerName: `30 Artwork - SMART OBJECT - ${family}-${color}-${view}`,
            id: psd.linkedFiles[0].id,
            placed: psd.children[3].placedLayer.placed,
            transform,
            proofDesign: "embedded-linked-file",
          },
          masterPath: path.relative(REPO, outputPath),
          masterChecksum: sha256(masterBytes),
          previewPath: path.relative(REPO, runtimePreviewPath),
          previewChecksum: sha256(readFileSync(runtimePreviewPath)),
          proofPreviewPath: path.relative(REPO, proofPath),
          proofPreviewChecksum: sha256(readFileSync(proofPath)),
           masterFormat,
          reviewStatus: "candidate",
        }, null, 2) + "\n");
        built++;
      } catch (err) {
        console.error(`  ! ${family}/${color}/${view}: ${err instanceof Error ? err.message : String(err)}`);
        failed++;
      }
    }
  }
  console.log(`built=${built} failed=${failed} -> ${outRoot}`);
  if (stage1 && built === 6 && failed === 0) {
    writeFileSync(
      path.join(path.dirname(outRoot), "stage1-representatives.json"),
      JSON.stringify({
        schema: "trynex-smart-mockup-stage1/v1",
        status: "candidate",
           generatedAt: v10 ? "2026-09-06" : "2026-09-01",
        representatives: Object.keys(CANONICAL).map((family) => ({
          family,
          color: "white",
          view: "front",
          master: path.relative(REPO, path.join(outRoot, family, `${family}-white-front.psd`)),
        })),
      }, null, 2) + "\n"
    );
  } else if (!stage1 && built === 188 && failed === 0) {
    const records = [];
    for (const [family, spec] of Object.entries(CANONICAL)) {
      for (const color of spec.colors) {
        for (const view of Object.keys(spec.views)) {
          records.push(JSON.parse(readFileSync(path.join(outRoot, family, `${family}-${color}-${view}.json`), "utf8")));
        }
      }
    }
    writeFileSync(path.join(stagingRoot, "manifest.json"), JSON.stringify({
      schema: "trynex-smart-mockup-staging/v2",
      status: "candidate",
      generatedAt: v10 ? "2026-09-06" : "2026-09-01",
      surfaceCount: records.length,
      canonicalSurfaceCount: 188,
      editableMastersOutsidePublic: true,
      waterbottleColors: ["white"],
      surfaces: records,
    }, null, 2) + "\n");
  }
  if (failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
