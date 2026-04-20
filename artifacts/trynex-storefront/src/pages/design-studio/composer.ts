/* ═══════════════════════════════════════════════════════
   COMPOSER — render a list of design layers onto a canvas
   Shared by:
     • realtime 3D preview  (CanvasTexture source)
     • add-to-cart snapshot (downloadable thumbnail)
════════════════════════════════════════════════════════ */

export interface ComposerTransform {
  x: number; y: number; scale: number; rotation: number; opacity: number;
}
export interface ComposerImageLayer {
  type: "image";
  visible: boolean;
  src: string;
  naturalW: number; naturalH: number;
  transform: ComposerTransform;
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
}
export type ComposerLayer = ComposerImageLayer | ComposerTextLayer;

export interface ComposerPrintZone { x: number; y: number; w: number; h: number; }

interface ComposeOptions {
  canvas: HTMLCanvasElement;
  /** The coordinate space height — for the unified 1000×1000 viewBox this is 1000 */
  baseHeight: number;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  /** garment fill color; pass `null` for a transparent background */
  garmentColor: string | null;
  outW: number;
  outH: number;
  imageCache?: Map<string, HTMLImageElement>;
  clipToPrintZone?: boolean;
  /** blend mode for TEXT layers (multiply gives fabric-ink feel); image layers always use source-over so photos are not tinted */
  blendMode?: GlobalCompositeOperation;
}

/** Load an image as a Promise; uses cache if provided. */
export function loadImage(src: string, cache?: Map<string, HTMLImageElement>): Promise<HTMLImageElement> {
  if (cache?.has(src)) {
    const img = cache.get(src)!;
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { cache?.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}

/** Compute the SVG-space bounding box of a layer (matches DesignStudio.layerGeom). */
function layerGeom(l: ComposerLayer, pz: ComposerPrintZone) {
  const cx = pz.x + pz.w / 2 + l.transform.x;
  const cy = pz.y + pz.h / 2 + l.transform.y;
  if (l.type === "image") {
    const aspect = l.naturalW / Math.max(l.naturalH, 1);
    const w = pz.w * l.transform.scale;
    const h = w / aspect;
    return { cx, cy, w, h };
  }
  const w = (l.text.length * l.fontSize * 0.55) * l.transform.scale;
  const h = l.fontSize * 1.2 * l.transform.scale;
  return { cx, cy, w, h };
}

/**
 * Compose layers onto a canvas. All async image loads are awaited.
 * Coordinate space: unified 1000×1000 (matches SVG viewBox "0 0 1000 1000").
 * Image layers always use source-over (no tinting); text layers use blendMode (default "multiply").
 */
export async function composeLayers(opts: ComposeOptions): Promise<HTMLCanvasElement> {
  const { canvas, baseHeight, printZone, layers, garmentColor, outW, outH, imageCache, clipToPrintZone = true, blendMode = "multiply" } = opts;
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Scale from the 1000×1000 coordinate space to canvas pixels
  const sx = outW / baseHeight;
  const sy = outH / baseHeight;

  ctx.clearRect(0, 0, outW, outH);
  if (garmentColor) {
    ctx.fillStyle = garmentColor;
    ctx.fillRect(0, 0, outW, outH);
  }

  if (clipToPrintZone) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(printZone.x * sx, printZone.y * sy, printZone.w * sx, printZone.h * sy);
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
        // Always source-over for photos — multiply would tint them with garment color
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(img, -(g.w * sx) / 2, -(g.h * sy) / 2, g.w * sx, g.h * sy);
      } catch {
        /* missing image — skip */
      }
    } else {
      ctx.globalCompositeOperation = blendMode;
      ctx.fillStyle = l.color;
      ctx.font = `${l.fontStyle} ${l.fontWeight} ${Math.round(l.fontSize * l.transform.scale * sy)}px ${l.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(l.text, 0, 0);
    }
    ctx.restore();
  }

  if (clipToPrintZone) ctx.restore();

  return canvas;
}

/**
 * Compose a full garment + design snapshot for the cart thumbnail.
 * Draws: garment photo → color tint (if non-white) → design layers on top.
 * Uses the 1000×1000 coordinate space matching the SVG viewBox.
 */
export async function composeGarmentMockup(opts: {
  canvas: HTMLCanvasElement;
  garmentSrc: string;
  garmentColor: string;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
}): Promise<HTMLCanvasElement> {
  const { canvas, garmentSrc, garmentColor, printZone, layers, outSize, imageCache } = opts;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const s = outSize / 1000;

  ctx.clearRect(0, 0, outSize, outSize);

  // 1. Draw garment PNG
  try {
    const garmentImg = await loadImage(garmentSrc, imageCache);
    ctx.drawImage(garmentImg, 0, 0, outSize, outSize);

    // 2. Multiply-tint for non-white colors, CLIPPED to the garment alpha mask
    //    so transparent areas around the garment never become tinted (no card bleed).
    const r = parseInt(garmentColor.slice(1, 3), 16) || 0;
    const g = parseInt(garmentColor.slice(3, 5), 16) || 0;
    const b = parseInt(garmentColor.slice(5, 7), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (luminance < 0.92) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = garmentColor;
      ctx.fillRect(0, 0, outSize, outSize);
      // Re-mask to the garment's alpha so the multiply tint cannot leak past the silhouette
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(garmentImg, 0, 0, outSize, outSize);
      ctx.globalCompositeOperation = "source-over";
    }
  } catch {
    // Fallback: solid garment color clipped to a rounded rect so it doesn't fill the whole card
    ctx.fillStyle = garmentColor;
    ctx.beginPath();
    const r = outSize * 0.06;
    const x = outSize * 0.12, y = outSize * 0.10, w = outSize * 0.76, h = outSize * 0.80;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // 3. Draw design layers at their correct 1000-unit positions
  for (const layer of layers) {
    if (!layer.visible) continue;
    const geom = layerGeom(layer, printZone);
    const cx = geom.cx * s;
    const cy = geom.cy * s;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.transform.opacity;

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src, imageCache);
        const w = geom.w * s;
        const h = geom.h * s;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } catch {}
    } else {
      const fs = Math.round(layer.fontSize * layer.transform.scale * s);
      ctx.fillStyle = layer.color;
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${fs}px ${layer.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text, 0, 0);
    }
    ctx.restore();
  }

  return canvas;
}

/**
 * Compose just the design as a texture for the 3D viewer.
 * Transparent background; design placed at its 1000×1000 coordinate position.
 * The output covers the full 1000-unit space so it UV-maps correctly onto the garment mesh.
 */
export async function composeDesignTexture(opts: {
  canvas: HTMLCanvasElement;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  outSize: number;
  imageCache?: Map<string, HTMLImageElement>;
}): Promise<HTMLCanvasElement> {
  const { canvas, printZone, layers, outSize, imageCache } = opts;
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const s = outSize / 1000;

  ctx.clearRect(0, 0, outSize, outSize);

  for (const layer of layers) {
    if (!layer.visible) continue;
    const geom = layerGeom(layer, printZone);
    const cx = geom.cx * s;
    const cy = geom.cy * s;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((layer.transform.rotation * Math.PI) / 180);
    ctx.globalAlpha = layer.transform.opacity;

    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src, imageCache);
        const w = geom.w * s;
        const h = geom.h * s;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      } catch {}
    } else {
      const fs = Math.round(layer.fontSize * layer.transform.scale * s);
      ctx.fillStyle = layer.color;
      ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${fs}px ${layer.fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(layer.text, 0, 0);
    }
    ctx.restore();
  }

  return canvas;
}

/** Cheap WebGL2 capability probe — used to decide whether to offer the 3D toggle. */
export function hasWebGL2(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
