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
  /** target canvas (the function will set width/height to outW × outH) */
  canvas: HTMLCanvasElement;
  /** 400-wide source coordinate space height of the garment */
  baseHeight: number;
  printZone: ComposerPrintZone;
  layers: ComposerLayer[];
  /** garment fill color; pass `null` for a transparent background (texture overlay use case) */
  garmentColor: string | null;
  outW: number;
  outH: number;
  /** pre-loaded image cache (src → HTMLImageElement) to avoid reload thrash */
  imageCache?: Map<string, HTMLImageElement>;
  /** when true, only paint inside the print zone (matches DesignStudio clipPath) */
  clipToPrintZone?: boolean;
  /** "multiply" (default) makes ink react with garment color; "source-over" for naked print */
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
 * Returns the same canvas for chaining.
 */
export async function composeLayers(opts: ComposeOptions): Promise<HTMLCanvasElement> {
  const { canvas, baseHeight, printZone, layers, garmentColor, outW, outH, imageCache, clipToPrintZone = true, blendMode = "multiply" } = opts;
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // The 2D editor uses a 400-wide coordinate space (baseHeight tall) for its garment.
  const sx = outW / 400;
  const sy = outH / baseHeight;

  // Clear & fill
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
        ctx.globalCompositeOperation = blendMode;
        ctx.drawImage(img, -(g.w * sx) / 2, -(g.h * sy) / 2, g.w * sx, g.h * sy);
      } catch {
        /* missing image — skip */
      }
    } else {
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
