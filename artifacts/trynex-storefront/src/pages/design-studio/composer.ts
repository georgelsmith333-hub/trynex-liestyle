/* ═══════════════════════════════════════════════════════
   COMPOSER — render a list of design layers onto a canvas
   Shared by:
     • realtime 3D preview  (CanvasTexture source)
     • add-to-cart snapshot (downloadable thumbnail)
════════════════════════════════════════════════════════ */

import type { SmartMockupRuntimeRoles } from "./smart-mockup-manifest";

export interface ComposerTransform {
  x: number; y: number; scale: number; rotation: number; opacity: number;
  scaleX?: number; scaleY?: number;
}
export interface ComposerImageLayer {
  type: "image";
  visible: boolean;
  src: string;
  naturalW: number; naturalH: number;
  transform: ComposerTransform;
  flipH?: boolean;
  flipV?: boolean;
  brightness?: number;   // 0–200, default 100
  contrast?: number;     // 0–200, default 100
  saturation?: number;   // 0–200, default 100
}
export interface ComposerTextLayer {
  type: "text";
  visible: boolean;
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  transform: ComposerTransform;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;   // em units
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}
export interface ComposerShapeLayer {
  type: "shape";
  visible: boolean;
  transform: ComposerTransform;
  shapeType: "rect" | "circle" | "star" | "arrow" | "polygon" | "line";
  fill?: string;
  strokeColor?: string;
  strokeWidth?: number;
  width: number;
  height: number;
  sides?: number;
  points?: number[];
}
export type ComposerLayer = ComposerImageLayer | ComposerTextLayer | ComposerShapeLayer;

export interface ComposerPrintZone {
  x: number;
  y: number;
  w: number;
  h: number;
  shape?: "rect" | "mug-front-body" | "mug-back-body" | "mug-wrap-body" | "cap-front" | "bottle-body";
}

/**
 * A separately reviewed raster effect exported from a licensed PSD layer.
 * It is intentionally opt-in: existing products continue using their current
 * resolver/composition behavior until a source-specific staging path supplies
 * both reviewed effect URLs and a matching front-view garment source.
 */
export interface PsdMaterialEffectLayer {
  src: string;
  blendMode: "multiply" | "screen";
  opacity: number;
}

export function tracePrintZone(
  ctx: CanvasRenderingContext2D,
  zone: ComposerPrintZone,
  sx: number,
  sy: number,
) {
  const shape = zone.shape;
  const x = zone.x * sx;
  const y = zone.y * sy;
  const w = zone.w * sx;
  const h = zone.h * sy;
  if (!shape || shape === "rect") {
    ctx.rect(x, y, w, h);
    return;
  }

  if (shape === "bottle-body") {
    const shoulder = Math.min(h * 0.12, 54 * sy);
    const base = Math.min(h * 0.08, 38 * sy);
    const side = Math.min(w * 0.16, 28 * sx);
    ctx.moveTo(x + side, y + shoulder);
    ctx.quadraticCurveTo(x + w / 2, y + shoulder * 0.45, x + w - side, y + shoulder);
    ctx.lineTo(x + w - side, y + h - base);
    ctx.quadraticCurveTo(x + w / 2, y + h + base * 0.2, x + side, y + h - base);
    ctx.closePath();
    return;
  }

  if (shape === "cap-front") {
    const crown = Math.min(h * 0.18, 56 * sy);
    const side = Math.min(w * 0.12, 34 * sx);
    ctx.moveTo(x + side, y + crown);
    ctx.quadraticCurveTo(x + w / 2, y - crown * 0.15, x + w - side, y + crown);
    ctx.lineTo(x + w - side * 0.7, y + h - 18 * sy);
    ctx.quadraticCurveTo(x + w / 2, y + h + 12 * sy, x + side * 0.7, y + h - 18 * sy);
    ctx.closePath();
    return;
  }

  const topInset = Math.min(18 * sx, w * 0.04);
  const sideRadius = Math.min(24 * sx, w * 0.06);
  const left = x + topInset;
  const right = x + w - topInset;
  const top = y + 10 * sy;
  const bottom = y + h - 10 * sy;
  const cx = x + w / 2;
  ctx.moveTo(left, top);
  ctx.quadraticCurveTo(cx, y - 4 * sy, right, top);
  ctx.quadraticCurveTo(x + w, top + 4 * sy, x + w, top + sideRadius);
  ctx.lineTo(x + w, bottom - sideRadius);
  ctx.quadraticCurveTo(x + w, bottom - 2 * sy, right, bottom);
  ctx.quadraticCurveTo(cx, y + h + 4 * sy, left, bottom);
  ctx.quadraticCurveTo(x, bottom - 2 * sy, x, bottom - sideRadius);
  ctx.lineTo(x, top + sideRadius);
  ctx.quadraticCurveTo(x, top + 4 * sy, left, top);
  ctx.closePath();
}

interface ComposeOptions {
  canvas: HTMLCanvasElement;
  baseHeight: number;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  garmentColor: string | null;
  outW: number;
  outH: number;
  imageCache?: Map<string, HTMLImageElement>;
  clipToPrintZone?: boolean;
  blendMode?: GlobalCompositeOperation;
  /** 0 = flat (apparel). >0 fakes a cylindrical/dome wrap for curved surfaces
   *  (mug, water bottle, cap) — edges compress horizontally, bow slightly
   *  vertically, and darken to mimic the surface curving away from camera.
   *  Typical values: 0.16 (mug/bottle side curve), 0.10 (cap dome). */
  curvature?: number;
  /** Add a subtle procedural fabric grain to the design so it looks printed
   *  on fabric rather than floating on top. Lightweight and cached. */
  fabricTexture?: boolean;
  /** Use the garment photo's luminosity to shade the design (real smart mockup). */
  smartShading?: boolean;
  /** Strength of the smart shading (0-1). */
  shadingStrength?: number;
  /** Keep an existing base pass when the unified surface compositor adds artwork. */
  clearCanvas?: boolean;
  /** Text-only blend mode; shapes and images remain source-over. */
  textBlendMode?: GlobalCompositeOperation;
}

const IMAGE_CACHE_MAX = 60;
const fabricTextureCache = new Map<string, HTMLCanvasElement>();

/** Procedural cotton/polyester weave texture — grey-based noise + thread grid.
 *  Used as a soft-light overlay in the print zone. */
function createFabricTexture(size: number): HTMLCanvasElement {
  const key = `fabric-${size}`;
  if (fabricTextureCache.has(key)) return fabricTextureCache.get(key)!;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 40;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  ctx.globalCompositeOperation = "overlay";
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  const step = Math.max(2, Math.floor(size / 128));
  for (let i = 0; i < size; i += step) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  fabricTextureCache.set(key, canvas);
  return canvas;
}

/** Draw a soft fabric-grain overlay over the current drawing region. */
function applyFabricGrain(ctx: CanvasRenderingContext2D, outW: number, outH: number, strength = 0.10) {
  const size = 256;
  const tex = createFabricTexture(size);
  const pattern = ctx.createPattern(tex, "repeat");
  if (!pattern) return;
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = strength;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, outW, outH);
  ctx.restore();
}

export function loadImage(src: string, cache?: Map<string, HTMLImageElement>): Promise<HTMLImageElement> {
  if (cache?.has(src)) {
    const img = cache.get(src)!;
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cache) {
        if (cache.size >= IMAGE_CACHE_MAX) {
          const firstKey = cache.keys().next().value;
          if (firstKey !== undefined) cache.delete(firstKey);
        }
        cache.set(src, img);
      }
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function layerGeom(l: ComposerLayer, pz: ComposerPrintZone) {
  const cx = pz.x + pz.w / 2 + l.transform.x;
  const cy = pz.y + pz.h / 2 + l.transform.y;
  if (l.type === "image") {
    // The editor stores image transforms in product-space pixels: Konva renders
    // naturalW/naturalH multiplied by transform.scale. Do not reinterpret the
    // scale as a percentage of printZone.w, otherwise uploads resize again when
    // they reach the compositor and preview/export no longer match.
    const w = Math.max(1, l.naturalW) * l.transform.scale * (l.transform.scaleX ?? 1);
    const h = Math.max(1, l.naturalH) * l.transform.scale * (l.transform.scaleY ?? 1);
    return { cx, cy, w, h };
  }
  if (l.type === "text") {
    const w = (l.text.length * l.fontSize * 0.55) * l.transform.scale * (l.transform.scaleX ?? 1);
    const h = l.fontSize * 1.2 * l.transform.scale * (l.transform.scaleY ?? 1);
    return { cx, cy, w, h };
  }
  return {
    cx,
    cy,
    w: l.width * l.transform.scale * (l.transform.scaleX ?? 1),
    h: l.height * l.transform.scale * (l.transform.scaleY ?? 1),
  };
}

/** Build CSS filter string for image adjustments. Returns '' if no adjustments. */
function buildImageFilter(l: ComposerImageLayer): string {
  const br = l.brightness ?? 100;
  const co = l.contrast ?? 100;
  const sa = l.saturation ?? 100;
  if (br === 100 && co === 100 && sa === 100) return "";
  const parts: string[] = [];
  if (br !== 100) parts.push(`brightness(${br}%)`);
  if (co !== 100) parts.push(`contrast(${co}%)`);
  if (sa !== 100) parts.push(`saturate(${sa}%)`);
  return parts.join(" ");
}

/** Draw text with full stroke, shadow, letterSpacing, and textAlign support. */
function drawText(
  ctx: CanvasRenderingContext2D,
  l: ComposerTextLayer,
  fontSize: number,
  textX: number,
  textY: number,
  sx: number,
  sy: number,
) {
  const align = l.textAlign ?? "center";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  if (l.letterSpacing != null && l.letterSpacing !== 0) {
    (ctx as any).letterSpacing = `${l.letterSpacing * fontSize}px`;
  } else {
    (ctx as any).letterSpacing = "0px";
  }

  if (l.shadowBlur || l.shadowOffsetX || l.shadowOffsetY) {
    ctx.shadowColor = l.shadowColor ?? "rgba(0,0,0,0.5)";
    ctx.shadowBlur = (l.shadowBlur ?? 0) * Math.min(sx, sy);
    ctx.shadowOffsetX = (l.shadowOffsetX ?? 0) * sx;
    ctx.shadowOffsetY = (l.shadowOffsetY ?? 0) * sy;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  if (l.strokeWidth && l.strokeWidth > 0) {
    ctx.strokeStyle = l.strokeColor ?? "#000000";
    ctx.lineWidth = l.strokeWidth * l.transform.scale * Math.min(sx, sy);
    ctx.lineJoin = "round";
    ctx.strokeText(l.text, textX, textY);
  }

  ctx.fillStyle = l.color;
  ctx.fillText(l.text, textX, textY);

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  (ctx as any).letterSpacing = "0px";
}

/** Get the X offset for a text alignment relative to the layer center. */
function textAlignOffset(align: "left" | "center" | "right", halfW: number): number {
  if (align === "left") return -halfW;
  if (align === "right") return halfW;
  return 0;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  layer: ComposerShapeLayer,
  w: number,
  h: number,
  sx: number,
  sy: number,
) {
  const fill = layer.fill ?? "#111111";
  const stroke = layer.strokeColor ?? fill;
  const lineWidth = Math.max(0, (layer.strokeWidth ?? 0) * Math.min(sx, sy));
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (layer.shapeType === "line" || layer.shapeType === "arrow") {
    const raw = layer.points && layer.points.length >= 4 ? layer.points : [-layer.width / 2, 0, layer.width / 2, 0];
    const points = raw.map((point, index) => point * (index % 2 === 0 ? sx : sy));
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.stroke();
    if (layer.shapeType === "arrow") {
      const end = points.length - 2;
      const angle = Math.atan2(points[end + 1] - points[end - 1], points[end] - points[end - 2]);
      const head = Math.max(10, 18 * Math.min(sx, sy));
      ctx.beginPath();
      ctx.moveTo(points[end], points[end + 1]);
      ctx.lineTo(points[end] - head * Math.cos(angle - Math.PI / 6), points[end + 1] - head * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(points[end], points[end + 1]);
      ctx.lineTo(points[end] - head * Math.cos(angle + Math.PI / 6), points[end + 1] - head * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }
    return;
  }

  if (layer.shapeType === "circle") {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    if (lineWidth) ctx.stroke();
    return;
  }

  if (layer.shapeType === "star" || layer.shapeType === "polygon") {
    const sides = Math.max(3, layer.sides ?? (layer.shapeType === "star" ? 5 : 6));
    const count = sides * (layer.shapeType === "star" ? 2 : 1);
    const outer = Math.min(w, h) / 2;
    const inner = layer.shapeType === "star" ? outer * 0.45 : outer;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const radius = layer.shapeType === "star" && i % 2 === 1 ? inner : outer;
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / count;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    if (lineWidth) ctx.stroke();
    return;
  }

  ctx.fillRect(-w / 2, -h / 2, w, h);
  if (lineWidth) ctx.strokeRect(-w / 2, -h / 2, w, h);
}

/** Draw an image warped to fake a cylindrical / dome surface curve.
 *  Simulates a round object photographed front-on: the centre faces the camera
 *  full-size, the edges pinch horizontally, recede vertically, and darken as
 *  they curve away from the light. A subtle centre highlight adds realism.
 *  Higher `quality` = more vertical strips for a smoother warp. */
function drawImageCurved(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  curvature: number,
) {
  const STRIPS = 80;
  const stripW = w / STRIPS;
  const curve = Math.max(0, curvature);
  // Keep the warp bounded: the source photos already communicate most curvature.
  // Excessive pinch/bow made artwork visibly buckle at mug and bottle edges.
  const pinchStrength = Math.min(0.48, 0.18 + curve * 1.2);
  const bowStrength = 0.03 + curve * 0.12;
  const edgeShadeStrength = 0.18 + curve * 0.60;
  for (let i = 0; i < STRIPS; i++) {
    // u ranges -0.5 (left edge) .. 0 (centre) .. 0.5 (right edge)
    const u = (i + 0.5) / STRIPS - 0.5;
    const u2 = 2 * u; // -1..1
    const edgeFactor = Math.abs(u2); // 0..1
    const edgeCurve = Math.pow(edgeFactor, 1.85);

    // Cylindrical pinch: edge strips become narrower (foreshortening).
    const pinch = Math.pow(Math.cos(u2 * Math.PI / 2), 1.55);
    const renderStripW = stripW * (1 - pinchStrength * edgeCurve) * (0.98 + 0.02 * pinch);

    // Barrel bow: centre sits closest to camera; edges drop away.
    const bow = (1 - Math.cos((u2 * Math.PI) / 2)) * h * curve * bowStrength;

    // Edge darkening: surface curving away catches less light.
    const shade = 1 - Math.min(0.22, Math.pow(edgeFactor, 1.2) * edgeShadeStrength);

    // Source x keeps the original proportions; we take slightly wider source
    // strips at the edges so the compressed pixels still map correctly.
    const sx0 = (i / STRIPS) * img.naturalWidth;
    const sw = img.naturalWidth / STRIPS;
    const dx0 = -w / 2 + i * stripW + (stripW - renderStripW) * 0.5;

    ctx.save();
    ctx.filter = `brightness(${Math.max(0.36, shade) * 100}%)`;
    ctx.drawImage(
      img,
      sx0, 0, sw, img.naturalHeight,
      dx0, -h / 2 + bow, Math.max(0.4, renderStripW + 0.6), h,
    );
    ctx.restore();
  }

  // Do not synthesize a second light pass here. Canonical mug, bottle, and cap
  // photos already contain their real highlight and edge falloff. The compositor
  // only performs geometric warp; extra overlay/multiply passes create the ghost
  // shadows and washed white surfaces reported in the live editor.
}

export async function composeLayers(opts: ComposeOptions): Promise<HTMLCanvasElement> {
  const {
    canvas, baseHeight, printZone, layers, garmentColor,
    outW, outH, imageCache, clipToPrintZone = true, blendMode = "source-over",
    curvature = 0, fabricTexture = false, clearCanvas = true, textBlendMode = blendMode,
  } = opts;
  // Resizing a canvas clears it. Preserve an existing base pass when the
  // unified compositor asks composeLayers to add artwork on top of it.
  if (canvas.width !== outW || canvas.height !== outH) {
    canvas.width = outW;
    canvas.height = outH;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const sx = outW / baseHeight;
  const sy = outH / baseHeight;

  if (clearCanvas) ctx.clearRect(0, 0, outW, outH);
  if (garmentColor) {
    ctx.fillStyle = garmentColor;
    ctx.fillRect(0, 0, outW, outH);
  }

  if (clipToPrintZone) {
    ctx.save();
    ctx.beginPath();
    tracePrintZone(ctx, printZone, sx, sy);
    ctx.clip();
  }

  for (const l of layers) {
    if (!l.visible) continue;
    const g = layerGeom(l, printZone);
    ctx.save();
    ctx.translate(g.cx * sx, g.cy * sy);
    ctx.rotate((l.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = l.transform.opacity;

    if (l.type === "image") {
      try {
        const img = await loadImage(l.src, imageCache);
        ctx.globalCompositeOperation = "source-over";

        const cssFilter = buildImageFilter(l);
        if (cssFilter) ctx.filter = cssFilter;

        const flipSX = l.flipH ? -1 : 1;
        const flipSY = l.flipV ? -1 : 1;
        if (l.flipH || l.flipV) ctx.scale(flipSX, flipSY);

        const w = g.w * sx;
        const h = g.h * sy;
        if (curvature > 0) {
          drawImageCurved(ctx, img, w, h, curvature);
        } else {
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        }

        if (cssFilter) ctx.filter = "none";
      } catch (imgErr) {
        throw new Error(`Artwork layer could not be rendered: ${l.src}`, { cause: imgErr });
      }
    } else if (l.type === "text") {
      ctx.globalCompositeOperation = textBlendMode;
      const fs = Math.round(l.fontSize * l.transform.scale * sy);
      ctx.font = `${l.fontStyle} ${l.fontWeight} ${fs}px ${l.fontFamily}`;

      const align = l.textAlign ?? "center";
      const xOffset = textAlignOffset(align, (g.w * sx) / 2);
      drawText(ctx, l, fs, xOffset, 0, sx, sy);
    } else {
      ctx.globalCompositeOperation = blendMode;
      drawShape(ctx, l, g.w * sx, g.h * sy, sx, sy);
    }
    ctx.restore();
  }

  if (fabricTexture) {
    applyFabricGrain(ctx, outW, outH, 0.035);
  }

  if (clipToPrintZone) ctx.restore();
  return canvas;
}

async function drawRuntimeRoles(opts: {
  ctx: CanvasRenderingContext2D;
  runtimeRoles: SmartMockupRuntimeRoles;
  printZone: ComposerPrintZone;
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  scale: number;
}) {
  const { ctx, runtimeRoles, printZone, outSize, imageCache, scale } = opts;
  const effectCanvas = document.createElement("canvas");
  effectCanvas.width = outSize;
  effectCanvas.height = outSize;
  const effectCtx = effectCanvas.getContext("2d");
  if (!effectCtx) return;

  const shadow = await loadImage(runtimeRoles.shadow, imageCache);
  const highlight = await loadImage(runtimeRoles.highlight, imageCache);
  const printMask = await loadImage(runtimeRoles.printMask, imageCache);

  // Keep the geometric clip as a defensive guard, then apply the reviewed
  // grayscale print mask as an alpha mask. The mask is grayscale (not alpha),
  // so destination-in alone would incorrectly leave black outside pixels in
  // the effect layer.
  effectCtx.save();
  effectCtx.beginPath();
  tracePrintZone(effectCtx, printZone, scale, scale);
  effectCtx.clip();
  effectCtx.globalCompositeOperation = "multiply";
  effectCtx.drawImage(shadow, 0, 0, outSize, outSize);
  effectCtx.globalCompositeOperation = "screen";
  effectCtx.drawImage(highlight, 0, 0, outSize, outSize);
  effectCtx.restore();

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = outSize;
  maskCanvas.height = outSize;
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (maskCtx) {
    maskCtx.drawImage(printMask, 0, 0, outSize, outSize);
    const maskData = maskCtx.getImageData(0, 0, outSize, outSize);
    for (let index = 0; index < maskData.data.length; index += 4) {
      const luminance = maskData.data[index];
      maskData.data[index] = 255;
      maskData.data[index + 1] = 255;
      maskData.data[index + 2] = 255;
      maskData.data[index + 3] = luminance;
    }
    maskCtx.putImageData(maskData, 0, 0);
    effectCtx.save();
    effectCtx.globalCompositeOperation = "destination-in";
    effectCtx.drawImage(maskCanvas, 0, 0);
    effectCtx.restore();
  }

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(effectCanvas, 0, 0);
  ctx.restore();

  // This pass deliberately stays outside the artwork clip. Reviewed alpha
  // detail exports keep collars, seams, handles, cuffs, and bottle hardware
  // above artwork without ever redrawing a second full product silhouette.
  const protectedDetails = await loadImage(runtimeRoles.protected, imageCache);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(protectedDetails, 0, 0, outSize, outSize);
  ctx.restore();
}

export async function composeGarmentMockup(opts: {
  canvas: HTMLCanvasElement;
  garmentSrc: string;
  garmentColor: string;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  curvature?: number;
  /** Legacy compatibility flag. Prefer `requiresTint` from resolveMockup. */
  isColorPhoto?: boolean;
  /** Explicit resolver metadata: only transparent fallback cutouts may need tint. */
  requiresTint?: boolean;
  fabricTexture?: boolean;
  /** Reapply garment luminosity over artwork to simulate a PSD smart object. */
  smartShading?: boolean;
  /** Shading opacity for the multiply/screen passes. */
  shadingStrength?: number;
  /** Optional reviewed PSD-native fold/detail passes for an isolated staging source. */
  psdMaterialEffects?: readonly PsdMaterialEffectLayer[];
  /** v10.3 role exports used to keep artwork beneath authentic folds/details. */
  runtimeRoles?: SmartMockupRuntimeRoles;
}): Promise<HTMLCanvasElement> {
  const {
    canvas,
    garmentSrc,
    garmentColor,
    printZone,
    layers,
    outSize,
    imageCache,
    curvature = 0,
    requiresTint = false,
    fabricTexture = false,
    runtimeRoles,
  } = opts;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const s = outSize / 1000;

  ctx.clearRect(0, 0, outSize, outSize);
  // v10.3 separates the studio background, product base, and material roles.
  // Draw the background and base once; never stack a second full garment photo.
  if (runtimeRoles) {
    const studioBackground = await loadImage(runtimeRoles.studioBackground, imageCache);
    ctx.drawImage(studioBackground, 0, 0, outSize, outSize);
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outSize, outSize);
  }

  const garmentImg = runtimeRoles
    ? await loadImage(runtimeRoles.base, imageCache)
    : await loadImage(garmentSrc, imageCache);
  ctx.drawImage(garmentImg, 0, 0, outSize, outSize);

  // Exact runtime sources are already color-specific. Keep the alpha contract
  // explicit for the few legacy transparent cutouts that still opt into tinting.
  if (requiresTint && garmentColor) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = garmentColor;
    ctx.fillRect(0, 0, outSize, outSize);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(garmentImg, 0, 0, outSize, outSize);
    ctx.globalCompositeOperation = "source-over";
  }

  const gr = parseInt(garmentColor?.slice(1, 3) ?? "ff", 16);
  const gg = parseInt(garmentColor?.slice(3, 5) ?? "ff", 16);
  const gb = parseInt(garmentColor?.slice(5, 7) ?? "ff", 16);
  const glum = (0.299 * gr + 0.587 * gg + 0.114 * gb) / 255;
  await composeLayers({
    canvas,
    baseHeight: 1000,
    printZone,
    layers,
    garmentColor: null,
    outW: outSize,
    outH: outSize,
    imageCache,
    clipToPrintZone: true,
    blendMode: "source-over",
    textBlendMode: glum > 0.92 ? "multiply" : "source-over",
    curvature,
    fabricTexture,
    clearCanvas: false,
  });

  if (runtimeRoles && layers.some((layer) => layer.visible)) {
    await drawRuntimeRoles({
      ctx,
      runtimeRoles,
      printZone,
      outSize,
      imageCache,
      scale: s,
    });
  }

  // Do not redraw the full garment over the artwork here. A whole-frame
  // multiply pass creates the duplicate/ghost silhouette users see on dark
  // variants. The clipped luminosity masks below are the single shading source.
  if (fabricTexture && layers.some(l => l.visible)) {
    ctx.save();
    ctx.beginPath();
    tracePrintZone(ctx, printZone, s, s);
    ctx.clip();
    applyFabricGrain(ctx, outSize, outSize, 0.035);
    ctx.restore();
  }

  return canvas;
}

export interface UnifiedMockupSurface {
  sourceKitKey: string;
  manifestRevision: string;
  runtimeStatus: "approved" | "disabled";
  disabledReason?: string;
  contractErrors: readonly string[];
  alphaMode: "opaque-photo" | "transparent-cutout";
  baseSrc: string;
  runtimeRoles?: SmartMockupRuntimeRoles;
  printZone: ComposerPrintZone;
}

export interface UnifiedMockupRenderRequest {
  canvas: HTMLCanvasElement;
  surface: UnifiedMockupSurface;
  garmentColor: string;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  curvature?: number;
  fabricTexture?: boolean;
}

function assertRenderableSurface(surface: UnifiedMockupSurface): void {
  if (surface.runtimeStatus !== "approved") {
    throw new Error(surface.disabledReason ?? `Mockup surface ${surface.sourceKitKey} is not approved for runtime rendering.`);
  }
  if (surface.contractErrors.length > 0) {
    throw new Error(`Mockup surface ${surface.sourceKitKey} failed validation: ${surface.contractErrors.join(", ")}`);
  }
  if (!surface.baseSrc) {
    throw new Error(`Mockup surface ${surface.sourceKitKey} has no runtime asset.`);
  }
}

/** The only customer-facing base compositor. Every thumbnail and export must
 * use the same serialized surface request and release validation. */
export async function composeMockupSurface(request: UnifiedMockupRenderRequest): Promise<HTMLCanvasElement> {
  assertRenderableSurface(request.surface);
  return composeGarmentMockup({
    canvas: request.canvas,
    garmentSrc: request.surface.baseSrc,
    runtimeRoles: request.surface.runtimeRoles,
    garmentColor: request.garmentColor,
    printZone: request.surface.printZone,
    layers: request.layers,
    outSize: request.outSize,
    imageCache: request.imageCache,
    curvature: request.curvature,
    fabricTexture: request.fabricTexture,
    isColorPhoto: request.surface.alphaMode === "opaque-photo",
    requiresTint: false,
  });
}

/** Shared artwork-only pass for 3D face textures. It uses the same release
 * guard as the full thumbnail/export pass instead of silently drawing against
 * an unrelated face or legacy photo. */
export async function composeMockupSurfaceTexture(opts: {
  canvas: HTMLCanvasElement;
  surface: Pick<UnifiedMockupSurface, "sourceKitKey" | "manifestRevision" | "runtimeStatus" | "disabledReason" | "contractErrors" | "alphaMode" | "printZone" | "runtimeRoles">;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  curvature?: number;
  fabricTexture?: boolean;
  clipToPrintZone?: boolean;
}): Promise<HTMLCanvasElement> {
  assertRenderableSurface({ ...opts.surface, baseSrc: "texture-only" });
  return composeDesignTexture({
    canvas: opts.canvas,
    printZone: opts.surface.printZone,
    layers: opts.layers,
    outSize: opts.outSize,
    imageCache: opts.imageCache,
    curvature: opts.curvature,
    fabricTexture: opts.fabricTexture,
    clipToPrintZone: opts.clipToPrintZone,
    runtimeRoles: opts.surface.runtimeRoles,
  });
}

export async function composeDesignTexture(opts: {
  canvas: HTMLCanvasElement;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
  clipToPrintZone?: boolean;
  curvature?: number;
  fabricTexture?: boolean;
  runtimeRoles?: SmartMockupRuntimeRoles;
}): Promise<HTMLCanvasElement> {
  const result = await composeLayers({
    canvas: opts.canvas,
    baseHeight: 1000,
    printZone: opts.printZone,
    layers: opts.layers,
    garmentColor: null,
    outW: opts.outSize,
    outH: opts.outSize,
    imageCache: opts.imageCache,
    clipToPrintZone: opts.clipToPrintZone,
    curvature: opts.curvature,
    fabricTexture: opts.fabricTexture,
    blendMode: "source-over",
    textBlendMode: "source-over",
  });
  if (opts.runtimeRoles && opts.layers.some((layer) => layer.visible)) {
    const ctx = result.getContext("2d");
    if (ctx) {
      await drawRuntimeRoles({
        ctx,
        runtimeRoles: opts.runtimeRoles,
        printZone: opts.printZone,
        outSize: opts.outSize,
        imageCache: opts.imageCache,
        scale: opts.outSize / 1000,
      });
    }
  }
  return result;
}

/** Analyse a small downscaled copy of the image and return suggested
 *  brightness / contrast corrections so logos/artwork pop on fabric.
 *  Returns the original src if no correction is needed. */
export async function autoFixImage(src: string): Promise<{ src: string; brightness: number; contrast: number }> {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = src; });
  try { await img.decode?.(); } catch {}

  const canvas = document.createElement("canvas");
  const size = 256;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { src, brightness: 100, contrast: 100 };

  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  // Compute average luminance and a simple contrast metric (std-dev-like).
  let sum = 0, sumSq = 0, count = 0, transparentCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const a = data[i + 3];
    if (a < 250) transparentCount++;
    if (a < 32) continue; // ignore fully transparent pixels
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum; sumSq += lum * lum; count++;
  }
  if (count === 0) return { src, brightness: 100, contrast: 100 };
  // Transparent logos and cutout art already carry intentional color values;
  // do not flatten their alpha-backed palette with a global correction filter.
  if (transparentCount / (data.length / 4) > 0.02) return { src, brightness: 100, contrast: 100 };
  const avg = sum / count;
  const variance = sumSq / count - avg * avg;
  const std = Math.sqrt(Math.max(0, variance));

  // Correct only unusually flat photographic uploads. Keep the correction
  // deliberately narrow so the product color and artwork palette stay honest.
  let brightness = 100;
  let contrast = 100;
  if (avg < 96) brightness = Math.round(100 + (96 - avg) * 0.22);
  if (avg > 184) brightness = Math.round(100 - (avg - 184) * 0.22);
  if (std < 48) contrast = Math.round(100 + (48 - std) * 0.45);
  if (std > 104) contrast = Math.round(100 - (std - 104) * 0.25);

  brightness = Math.max(92, Math.min(112, brightness));
  contrast = Math.max(94, Math.min(116, contrast));

  if (brightness === 100 && contrast === 100) return { src, brightness, contrast };

  // Render corrected image at original size.
  const out = document.createElement("canvas");
  out.width = img.naturalWidth; out.height = img.naturalHeight;
  const octx = out.getContext("2d");
  if (!octx) return { src, brightness, contrast };
  octx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
  octx.drawImage(img, 0, 0, out.width, out.height);
  return { src: out.toDataURL("image/png"), brightness, contrast };
}

export function hasWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
