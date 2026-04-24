/* ═══════════════════════════════════════════════════════
   GARMENT MOCKUPS — photographic templates
   All products use a unified 1000×1000 coordinate space.
   The mockup PNGs live in /public/mockups/<id>-<face>.png
════════════════════════════════════════════════════════ */
import { useMemo } from "react";

export type ProductType =
  | "white-tshirt"
  | "black-tshirt"
  | "white-mug"
  | "black-mug"
  | "white-hoodie"
  | "black-hoodie"
  | "white-cap"
  | "black-cap"
  | "white-longsleeve"
  | "white-waterbottle";

export type Face = "front" | "back";

export interface PrintZone { x: number; y: number; w: number; h: number }

export interface DesignProduct {
  id: ProductType;
  name: string;
  category: "tshirt" | "mug" | "hoodie" | "cap" | "longsleeve" | "waterbottle";
  garmentColor: string;
  description: string;
  /** viewBox string — unified 1000×1000 coordinate space */
  viewBox: string;
  /** aspect ratio of viewBox (width/height) */
  aspect: number;
  /** print zone for the front face */
  printZone: PrintZone;
  /** optional separate print zone for back; falls back to front */
  printZoneBack?: PrintZone;
  /** base canvas height (used for snapshot composition) */
  baseHeight: number;
  /** front-face mockup image (relative to /public) */
  frontSrc: string;
  /** back-face mockup image; absent for products without a back (cap, mug) */
  backSrc?: string;
}

// Print zones — UNIFIED per garment so flipping front↔back keeps the same
// design at the same apparent size and position. Each garment uses ONE
// zone for both faces; the front-only fields below are the source of
// truth and `printZoneBack` is no longer set per product.
//
// Sizes were averaged from the previous front/back values and re-centred
// so a 200×200 logo lands in the same spot on both sides.
//   tshirt        →  360 × 430   (was 350×400 / 370×460)
//   longsleeve    →  340 × 410   (was 330×380 / 350×440)
//   hoodie        →  330 × 380   (was 310×320 / 350×440 — chest pocket aware)
// Coordinates live in the unified 1000×1000 viewBox.
export const TSHIRT_PZ: PrintZone        = { x: 320, y: 270, w: 360, h: 430 };
export const LONGSLEEVE_PZ: PrintZone    = { x: 330, y: 285, w: 340, h: 410 };
export const HOODIE_PZ: PrintZone        = { x: 335, y: 305, w: 330, h: 380 };
export const CAP_PZ: PrintZone           = { x: 365, y: 370, w: 270, h: 200 };
export const MUG_PZ: PrintZone           = { x: 150, y: 180, w: 700, h: 640 };
export const WATERBOTTLE_PZ: PrintZone   = { x: 358, y: 345, w: 284, h: 420 };

/* ── Water Bottle / Tumbler — inline SVG mockup (no PNG asset exists).
   White/light-grey shapes on transparent background so the multiply-tint
   filter in GarmentSVG colours the bottle correctly.               ── */
const _WB_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><path d="M385 225 L615 225 L636 295 Q652 325 655 360 L672 755 Q676 835 618 858 L382 858 Q324 835 328 755 L345 360 Q348 325 364 295 Z" fill="#F4F3F1" stroke="#DDDCDA" stroke-width="6"/><path d="M390 172 L610 172 L615 225 L385 225 Z" fill="#ECEBE9" stroke="#D5D4D2" stroke-width="5"/><rect x="425" y="128" width="150" height="48" rx="18" fill="#E0DFDD" stroke="#C8C7C5" stroke-width="5"/><rect x="447" y="110" width="106" height="24" rx="10" fill="#D5D4D2" stroke="#BFBEBC" stroke-width="4"/><path d="M363 325 C360 455 361 600 364 750" stroke="white" stroke-width="24" stroke-linecap="round" fill="none" opacity="0.65"/><path d="M637 325 C640 455 639 600 636 750" stroke="white" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.28"/><ellipse cx="500" cy="858" rx="138" ry="14" fill="#C8C6C4" opacity="0.35"/></svg>`;
export const WATERBOTTLE_MOCKUP_URL = `data:image/svg+xml,${encodeURIComponent(_WB_SVG)}`;

const VIEWBOX = "0 0 1000 1000";
const ASPECT = 1;
const BASE = 1000;

// Tab order (per spec): t-shirt → mug → long sleeve → cap → hoodie → water bottle
export const PRODUCTS: DesignProduct[] = [
  { id: "white-tshirt",     name: "Unisex T-Shirt",    category: "tshirt",     garmentColor: "#F5F5F3",
    description: "230GSM Cotton",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: TSHIRT_PZ,
    frontSrc: "/mockups/white-tshirt-front.png", backSrc: "/mockups/white-tshirt-back.png" },
  { id: "white-mug",        name: "Coffee Mug",        category: "mug",        garmentColor: "#F5F5F5",
    description: "11oz Ceramic · Pick a color",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: MUG_PZ,
    frontSrc: "/mockups/white-mug-front.png" },
  { id: "white-longsleeve", name: "Unisex Long Sleeve", category: "longsleeve", garmentColor: "#F5F5F3",
    description: "240GSM Cotton",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: LONGSLEEVE_PZ,
    frontSrc: "/mockups/white-longsleeve-front.png", backSrc: "/mockups/white-longsleeve-back.png" },
  { id: "white-cap",        name: "Cap",               category: "cap",        garmentColor: "#F5F2EC",
    description: "Cotton Twill · Pick a color",    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: CAP_PZ,
    frontSrc: "/mockups/white-cap-front.png" },
  { id: "white-hoodie",     name: "Unisex Hoodie",     category: "hoodie",     garmentColor: "#F2EFE9",
    description: "320GSM Fleece · Pick a color",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: HOODIE_PZ,
    frontSrc: "/mockups/white-hoodie-front.png", backSrc: "/mockups/white-hoodie-back.png" },
  { id: "white-waterbottle", name: "Water Bottle",     category: "waterbottle", garmentColor: "#F4F3F1",
    description: "600ml Stainless · Pick a color", viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: WATERBOTTLE_PZ,
    frontSrc: WATERBOTTLE_MOCKUP_URL },
];

/* ═══════════════════════════════════════════════════════
   GARMENT RENDERER — embeds the mockup PNG inside the
   parent <svg viewBox="0 0 1000 1000"> as an SVG <image>.
   For tintable categories (tshirt / longsleeve / hoodie / mug)
   we always render the WHITE base photo and multiply-tint it
   with the selected garment color so all 11 colour swatches
   work on a single, consistently-framed mockup. Caps and the
   black-only variants without a white counterpart fall back
   to their bundled PNG.
════════════════════════════════════════════════════════ */

// Per-category base PNGs (white versions, BACKGROUND-REMOVED cutouts) —
// these have the best framing/lighting and have a transparent background
// so when we multiply-tint them with a swatch hex only the GARMENT pixels
// take the colour. The white card behind the SVG stays white. If you ever
// need to regenerate the cutouts, run remove_image_background_tool against
// the originals (white-*.png) and save as *-cutout.png.
export const BASE_BY_CATEGORY: Record<DesignProduct["category"], { front: string; back?: string } | undefined> = {
  tshirt:      { front: "/mockups/white-tshirt-front-cutout.png",     back: "/mockups/white-tshirt-back-cutout.png" },
  longsleeve:  { front: "/mockups/white-longsleeve-front-cutout.png", back: "/mockups/white-longsleeve-back-cutout.png" },
  hoodie:      { front: "/mockups/white-hoodie-front-cutout.png",     back: "/mockups/white-hoodie-back-cutout.png" },
  mug:         { front: "/mockups/white-mug-front-cutout.png" },
  cap:         undefined,
  // Water bottle uses its inline SVG as the tintable base (transparent bg, white shapes).
  waterbottle: { front: WATERBOTTLE_MOCKUP_URL },
};

// Generate a stable, unique filter id per render so multiple
// GarmentSVGs on the same page don't collide.
let _filterUid = 0;
function nextFilterId() { _filterUid = (_filterUid + 1) % 1_000_000; return `tint-${_filterUid}`; }

function isLightTint(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance — anything brighter than ~92% is treated
  // as "white-ish" and we skip the tint to avoid a faint grey wash.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.92;
}

export function GarmentSVG({
  product,
  color,
  showPrintZone,
  face = "front",
}: {
  product: DesignProduct;
  /** Selected garment colour. For tintable categories the white
   *  base PNG is multiplied by this hex so all colours work on
   *  a single, consistently-framed mockup. */
  color?: string;
  showPrintZone: boolean;
  face?: Face;
}) {
  const base = BASE_BY_CATEGORY[product.category];
  const useBase = !!base;
  const src = useBase
    ? (face === "back" && base!.back ? base!.back : base!.front)
    : (face === "back" && product.backSrc ? product.backSrc : product.frontSrc);
  const pz = face === "back" && product.printZoneBack ? product.printZoneBack : product.printZone;

  const tintHex = color || product.garmentColor;
  const applyTint = useBase && !!tintHex && !isLightTint(tintHex);
  const filterId = useMemo(() => nextFilterId(), [product.id, face, tintHex]);

  return (
    <>
      {applyTint && (
        <defs>
          {/* Multiply-tint filter: paints the source with the tint hex
              wherever the garment has opacity, then multiplies the
              result with the original photograph to preserve fabric
              shading, folds and shadows. */}
          <filter id={filterId} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            <feFlood floodColor={tintHex} result="flood" />
            <feComposite in="flood" in2="SourceAlpha" operator="in" result="tinted" />
            <feBlend in="tinted" in2="SourceGraphic" mode="multiply" />
          </filter>
        </defs>
      )}
      <image
        href={src}
        x={0} y={0} width={1000} height={1000}
        preserveAspectRatio="xMidYMid meet"
        filter={applyTint ? `url(#${filterId})` : undefined}
        style={{ pointerEvents: "none" }}
      />
      {showPrintZone && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={pz.x} y={pz.y} width={pz.w} height={pz.h}
            fill="none"
            stroke="rgba(232,93,4,0.55)"
            strokeWidth={2.5}
            strokeDasharray="8 6"
            rx={6}
          />
          <text
            x={pz.x + pz.w / 2} y={pz.y - 10}
            textAnchor="middle"
            fontSize={18}
            fontWeight={700}
            fill="rgba(232,93,4,0.85)"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Print Area
          </text>
        </g>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   STICKERS — curated vector decoration library
   Each sticker is a self-contained 100×100 SVG string.
   They are added to the canvas as image layers (data URLs)
   so they inherit move/scale/rotate/opacity/snap/undo for free.
════════════════════════════════════════════════════════ */

export interface Sticker {
  id: string;
  name: string;
  /** Inline SVG markup, viewBox 0 0 100 100, with width/height set so
   *  HTMLImageElement.naturalWidth resolves reliably across browsers. */
  svg: string;
  /** Pre-encoded data: URL — derived once at module load, not per render. */
  dataUrl: string;
}

const W = (s: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${s}</svg>`;

const RAW_STICKERS: { id: string; name: string; svg: string }[] = [
  { id: "stk-heart",      name: "Heart",       svg: W(`<path d="M50 86 C20 64 8 46 8 30 A20 20 0 0 1 50 22 A20 20 0 0 1 92 30 C92 46 80 64 50 86 Z" fill="#dc2626"/>`) },
  { id: "stk-star",       name: "Star",        svg: W(`<path d="M50 8 L61 38 L93 40 L68 60 L77 92 L50 74 L23 92 L32 60 L7 40 L39 38 Z" fill="#f59e0b"/>`) },
  { id: "stk-bolt",       name: "Lightning",   svg: W(`<path d="M58 6 L18 56 L44 56 L36 94 L80 40 L52 40 L60 6 Z" fill="#facc15" stroke="#a16207" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "stk-crown",      name: "Crown",       svg: W(`<path d="M14 70 L20 28 L38 50 L50 22 L62 50 L80 28 L86 70 Z" fill="#f59e0b" stroke="#92400e" stroke-width="2" stroke-linejoin="round"/><rect x="14" y="72" width="72" height="10" fill="#92400e"/><circle cx="50" cy="20" r="4" fill="#dc2626"/>`) },
  { id: "stk-circle",     name: "Circle",      svg: W(`<circle cx="50" cy="50" r="40" fill="#111827"/>`) },
  { id: "stk-square",     name: "Square",      svg: W(`<rect x="14" y="14" width="72" height="72" rx="6" fill="#111827"/>`) },
  { id: "stk-triangle",   name: "Triangle",    svg: W(`<path d="M50 12 L90 84 L10 84 Z" fill="#E85D04"/>`) },
  { id: "stk-diamond",    name: "Diamond",     svg: W(`<path d="M50 8 L92 50 L50 92 L8 50 Z" fill="#06b6d4"/>`) },
  { id: "stk-hex",        name: "Hexagon",     svg: W(`<path d="M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z" fill="#7c3aed"/>`) },
  { id: "stk-smile",      name: "Smiley",      svg: W(`<circle cx="50" cy="50" r="42" fill="#facc15" stroke="#a16207" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#1f2937"/><circle cx="64" cy="42" r="5" fill="#1f2937"/><path d="M30 60 Q50 80 70 60" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>`) },
  { id: "stk-sun",        name: "Sun",         svg: W(`<g stroke="#f59e0b" stroke-width="4" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="94"/><line x1="6" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="94" y2="50"/><line x1="18" y1="18" x2="26" y2="26"/><line x1="74" y1="74" x2="82" y2="82"/><line x1="82" y1="18" x2="74" y2="26"/><line x1="18" y1="82" x2="26" y2="74"/></g><circle cx="50" cy="50" r="22" fill="#f59e0b"/>`) },
  { id: "stk-moon",       name: "Moon",        svg: W(`<path d="M68 14 A40 40 0 1 0 86 64 A30 30 0 0 1 68 14 Z" fill="#1e3a8a"/>`) },
  { id: "stk-cloud",      name: "Cloud",       svg: W(`<path d="M28 70 A18 18 0 0 1 30 36 A20 20 0 0 1 68 32 A16 16 0 0 1 80 70 Z" fill="#60a5fa" stroke="#1e3a8a" stroke-width="2"/>`) },
  { id: "stk-arrow",      name: "Arrow",       svg: W(`<path d="M10 40 H60 V24 L92 50 L60 76 V60 H10 Z" fill="#111827"/>`) },
  { id: "stk-check",      name: "Check",       svg: W(`<path d="M14 52 L40 78 L88 22" fill="none" stroke="#16a34a" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`) },
  { id: "stk-cross",      name: "Cross",       svg: W(`<path d="M20 20 L80 80 M80 20 L20 80" stroke="#dc2626" stroke-width="14" stroke-linecap="round"/>`) },
  { id: "stk-flower",     name: "Flower",      svg: W(`<g fill="#ec4899"><circle cx="50" cy="22" r="14"/><circle cx="78" cy="50" r="14"/><circle cx="50" cy="78" r="14"/><circle cx="22" cy="50" r="14"/></g><circle cx="50" cy="50" r="12" fill="#fde047"/>`) },
  { id: "stk-coffee",     name: "Coffee",      svg: W(`<path d="M22 30 H72 V62 A18 18 0 0 1 54 80 H40 A18 18 0 0 1 22 62 Z" fill="#92400e"/><path d="M72 38 H82 A10 10 0 0 1 82 58 H72" fill="none" stroke="#92400e" stroke-width="6"/><path d="M34 18 Q40 10 34 4 M50 18 Q56 10 50 4 M66 18 Q72 10 66 4" stroke="#9ca3af" stroke-width="3" fill="none" stroke-linecap="round"/>`) },
  { id: "stk-ribbon",     name: "Ribbon",      svg: W(`<path d="M8 38 H92 L78 50 L92 62 H8 L22 50 Z" fill="#dc2626" stroke="#7f1d1d" stroke-width="2" stroke-linejoin="round"/>`) },
  { id: "stk-music",      name: "Music Note",  svg: W(`<path d="M44 14 V64 A12 12 0 1 1 36 52 V26 L72 18 V58 A12 12 0 1 1 64 46 V14 Z" fill="#111827"/>`) },
];

export function stickerToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const STICKERS: Sticker[] = RAW_STICKERS.map(s => ({
  ...s,
  dataUrl: stickerToDataUrl(s.svg),
}));
