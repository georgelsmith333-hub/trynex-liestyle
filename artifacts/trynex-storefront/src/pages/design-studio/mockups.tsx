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

/** All possible design zones — front/back are garment views; sleeve/neck are flat templates. */
export type Face =
  | "front"
  | "back"
  | "left-sleeve"
  | "right-sleeve"
  | "neck-label";

export interface PrintZone { x: number; y: number; w: number; h: number }

export interface DesignProduct {
  id: ProductType;
  name: string;
  icon: string;
  category: "tshirt" | "mug" | "hoodie" | "cap" | "longsleeve" | "waterbottle";
  garmentColor: string;
  description: string;
  viewBox: string;
  aspect: number;
  printZone: PrintZone;
  printZoneBack?: PrintZone;
  baseHeight: number;
  frontSrc: string;
  backSrc?: string;
}

/* ── Per-zone print zones ─────────────────────────────────
   All in the unified 1000×1000 viewBox.
   Garment zones:
     TSHIRT_PZ / LONGSLEEVE_PZ / HOODIE_PZ / CAP_PZ — front/back
   Flat-template zones (no garment image):
     SLEEVE_PZ    — left-sleeve and right-sleeve
     NECK_LABEL_PZ — neck-label
   Mug zones:
     MUG_SIDE_PZ — single-side editing
     MUG_PZ      — full 360° wrap
──────────────────────────────────────────────────────── */
export const TSHIRT_PZ: PrintZone        = { x: 320, y: 270, w: 360, h: 430 };
export const LONGSLEEVE_PZ: PrintZone    = { x: 330, y: 285, w: 340, h: 410 };
export const HOODIE_PZ: PrintZone        = { x: 335, y: 305, w: 330, h: 380 };
export const CAP_PZ: PrintZone           = { x: 365, y: 370, w: 270, h: 200 };
export const MUG_PZ: PrintZone           = { x: 150, y: 180, w: 700, h: 640 };
export const MUG_SIDE_PZ: PrintZone      = { x: 185, y: 205, w: 430, h: 570 };
export const WATERBOTTLE_PZ: PrintZone   = { x: 358, y: 345, w: 284, h: 420 };
/** Sleeve print area — roughly square (1228×1087px real-world ratio). */
export const SLEEVE_PZ: PrintZone        = { x: 175, y: 175, w: 650, h: 650 };
/** Neck label — wider than tall (1299×945px real-world ratio). */
export const NECK_LABEL_PZ: PrintZone    = { x: 150, y: 265, w: 700, h: 470 };

export const WATERBOTTLE_MOCKUP_URL = "/mockups/white-waterbottle-front.png";

/* ── Zone configuration ─────────────────────────────────── */
export interface ApparelZone {
  face: Face;
  label: string;
  shortLabel: string;
  /** Indicative print resolution dimensions shown to the designer. */
  pxDimensions: string;
  pz: PrintZone;
  /** Whether this zone uses a flat-template canvas (no garment photo). */
  isFlat: boolean;
}

const FRONT_BACK_DIMS = "4606 × 5787 px";
const SLEEVE_DIMS = "1228 × 1087 px";
const NECK_DIMS = "1299 × 945 px";

/** Returns the ordered print zones for a given product category. */
export function getApparelZones(
  category: DesignProduct["category"],
  productPZ?: PrintZone,
): ApparelZone[] {
  const frontPZ = productPZ ?? TSHIRT_PZ;
  switch (category) {
    case "tshirt":
    case "longsleeve":
    case "hoodie":
      return [
        { face: "front",       label: "Front",       shortLabel: "Front",    pxDimensions: FRONT_BACK_DIMS, pz: frontPZ,       isFlat: false },
        { face: "back",        label: "Back",        shortLabel: "Back",     pxDimensions: FRONT_BACK_DIMS, pz: frontPZ,       isFlat: false },
        { face: "left-sleeve", label: "Left Sleeve", shortLabel: "L.Sleeve", pxDimensions: SLEEVE_DIMS,     pz: SLEEVE_PZ,     isFlat: true },
        { face: "right-sleeve",label: "Right Sleeve",shortLabel: "R.Sleeve", pxDimensions: SLEEVE_DIMS,     pz: SLEEVE_PZ,     isFlat: true },
        { face: "neck-label",  label: "Neck Label",  shortLabel: "Neck",     pxDimensions: NECK_DIMS,       pz: NECK_LABEL_PZ, isFlat: true },
      ];
    default:
      return [
        { face: "front", label: "Front", shortLabel: "Front", pxDimensions: FRONT_BACK_DIMS, pz: frontPZ, isFlat: false },
      ];
  }
}

/** Get the print zone for a given face and product (used by DesignStudio). */
export function getZonePZ(face: Face, product: DesignProduct): PrintZone {
  if (product.category === "mug") return MUG_SIDE_PZ;
  if (face === "left-sleeve" || face === "right-sleeve") return SLEEVE_PZ;
  if (face === "neck-label") return NECK_LABEL_PZ;
  if (face === "back" && product.printZoneBack) return product.printZoneBack;
  return product.printZone;
}

const VIEWBOX = "0 0 1000 1000";
const ASPECT = 1;
const BASE = 1000;

export const PRODUCTS: DesignProduct[] = [
  { id: "white-tshirt",     name: "Unisex T-Shirt",    icon: "👕", category: "tshirt",     garmentColor: "#F5F5F3",
    description: "230GSM Cotton",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: TSHIRT_PZ,
    frontSrc: "/mockups/white-tshirt-front.png", backSrc: "/mockups/white-tshirt-back.png" },
  { id: "white-mug",        name: "Coffee Mug",        icon: "☕", category: "mug",        garmentColor: "#F5F5F5",
    description: "11oz Ceramic · Pick a color",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: MUG_SIDE_PZ,
    frontSrc: "/mockups/white-mug-front.png" },
  { id: "white-longsleeve", name: "Unisex Long Sleeve", icon: "👔", category: "longsleeve", garmentColor: "#F5F5F3",
    description: "240GSM Cotton",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: LONGSLEEVE_PZ,
    frontSrc: "/mockups/white-longsleeve-front.png", backSrc: "/mockups/white-longsleeve-back.png" },
  { id: "white-cap",        name: "Cap",               icon: "🧢", category: "cap",        garmentColor: "#F5F2EC",
    description: "Cotton Twill · Pick a color",    viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: CAP_PZ,
    frontSrc: "/mockups/white-cap-front.png" },
  { id: "white-hoodie",     name: "Unisex Hoodie",     icon: "🧥", category: "hoodie",     garmentColor: "#F2EFE9",
    description: "320GSM Fleece · Pick a color",   viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: HOODIE_PZ,
    frontSrc: "/mockups/white-hoodie-front.png", backSrc: "/mockups/white-hoodie-back.png" },
  { id: "white-waterbottle", name: "Water Bottle",     icon: "🥤", category: "waterbottle", garmentColor: "#F4F3F1",
    description: "600ml Stainless · Pick a color", viewBox: VIEWBOX, aspect: ASPECT, baseHeight: BASE,
    printZone: WATERBOTTLE_PZ,
    frontSrc: WATERBOTTLE_MOCKUP_URL },
];

/* ═══════════════════════════════════════════════════════
   GARMENT RENDERER — embeds the mockup PNG inside the
   parent <svg viewBox="0 0 1000 1000"> as an SVG <image>.

   MUG SPECIAL HANDLING:
   • Left Side (face="front"): normal image, handle visible on right.
   • Right Side (face="back") : image flipped horizontally so handle
     appears on the left — this represents the opposite side of the mug
     as seen from outside.
════════════════════════════════════════════════════════ */

export const BASE_BY_CATEGORY: Record<DesignProduct["category"], { front: string; back?: string } | undefined> = {
  tshirt:      { front: "/mockups/white-tshirt-front-cutout.png",     back: "/mockups/white-tshirt-back-cutout.png" },
  longsleeve:  { front: "/mockups/white-longsleeve-front-cutout.png", back: "/mockups/white-longsleeve-back-cutout.png" },
  hoodie:      { front: "/mockups/white-hoodie-front-cutout.png",     back: "/mockups/white-hoodie-back-cutout.png" },
  mug:         { front: "/mockups/white-mug-front-cutout.png",        back: "/mockups/white-mug-front-cutout.png" },
  cap:         undefined,
  waterbottle: undefined,
};

let _filterUid = 0;
function nextFilterId() { _filterUid = (_filterUid + 1) % 1_000_000; return `tint-${_filterUid}`; }

function isLightTint(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.92;
}

export function GarmentSVG({
  product,
  color,
  showPrintZone,
  face = "front",
  mugMode,
}: {
  product: DesignProduct;
  color?: string;
  showPrintZone: boolean;
  face?: Face;
  mugMode?: "side1" | "side2" | "wrap";
}) {
  const isMug = product.category === "mug";

  const base = BASE_BY_CATEGORY[product.category];
  const useBase = !!base;

  const src = useBase
    ? (face === "back" && base!.back ? base!.back : base!.front)
    : (face === "back" && product.backSrc ? product.backSrc : product.frontSrc);

  const pz = (() => {
    if (!isMug) {
      return (face === "back" && product.printZoneBack) ? product.printZoneBack : product.printZone;
    }
    if (mugMode === "wrap") return MUG_PZ;
    return MUG_SIDE_PZ;
  })();

  const tintHex = color || product.garmentColor;
  const applyTint = useBase && !!tintHex && !isLightTint(tintHex);
  const filterId = useMemo(() => nextFilterId(), [product.id, face, tintHex]);

  const isMugRightSide = isMug && (face === "back" || mugMode === "side2");

  return (
    <>
      {applyTint && (
        <defs>
          <filter id={filterId} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
            <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="gray" />
            <feFlood floodColor={tintHex} result="flood" />
            <feComposite in="flood" in2="SourceAlpha" operator="in" result="tinted" />
            <feBlend in="tinted" in2="gray" mode="multiply" result="blended" />
            <feComposite in="blended" in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
      )}

      {isMugRightSide ? (
        <g transform="translate(1000,0) scale(-1,1)">
          <image
            href={src}
            x={0} y={0} width={1000} height={1000}
            preserveAspectRatio="xMidYMid meet"
            filter={applyTint ? `url(#${filterId})` : undefined}
            style={{ pointerEvents: "none" }}
          />
        </g>
      ) : (
        <image
          href={src}
          x={0} y={0} width={1000} height={1000}
          preserveAspectRatio="xMidYMid meet"
          filter={applyTint ? `url(#${filterId})` : undefined}
          style={{ pointerEvents: "none" }}
        />
      )}

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
            {isMug && mugMode === "wrap" ? "Full Wrap Area" : "Print Area"}
          </text>
        </g>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   FLAT ZONE RENDERER — used for sleeve and neck-label zones
   where no garment photo is needed. Renders a professional
   flat canvas / artboard view with the print zone outlined.
════════════════════════════════════════════════════════ */
export function FlatZoneSVG({
  zone,
  showPrintZone,
}: {
  zone: ApparelZone;
  showPrintZone: boolean;
}) {
  const { pz, label, pxDimensions } = zone;
  const cx = pz.x + pz.w / 2;

  const isNeck = zone.face === "neck-label";
  const isLeftSleeve = zone.face === "left-sleeve";

  return (
    <>
      <defs>
        <pattern id="flat-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(0,0,0,0.06)" />
        </pattern>
        <filter id="flat-shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor="rgba(0,0,0,0.10)" />
        </filter>
      </defs>

      {/* Background */}
      <rect width={1000} height={1000} fill="#EDEAE5" />
      <rect width={1000} height={1000} fill="url(#flat-dots)" />

      {/* White artboard */}
      <rect x={60} y={60} width={880} height={880} rx={12} fill="white" filter="url(#flat-shadow)" />

      {/* Zone label above artboard */}
      <text
        x={500} y={44}
        textAnchor="middle" fontSize={22} fontWeight={800}
        fill="#6b7280"
        style={{ fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase" }}
      >
        {label.toUpperCase()}
      </text>

      {/* Garment zone diagram — mini silhouette showing where this zone lives */}
      {isNeck ? (
        /* Neck label indicator: collar icon */
        <g transform="translate(500,145)" style={{ pointerEvents: "none" }}>
          <path d="M -38 0 Q -28 -30 0 -30 Q 28 -30 38 0 Q 24 10 0 10 Q -24 10 -38 0 Z"
            fill="none" stroke="#E85D04" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M -12 -30 Q 0 -42 12 -30"
            fill="none" stroke="#E85D04" strokeWidth="2.5" strokeLinecap="round" />
          <text y={30} textAnchor="middle" fontSize={11} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            inside collar
          </text>
        </g>
      ) : isLeftSleeve ? (
        /* Left sleeve indicator */
        <g transform="translate(500,145)" style={{ pointerEvents: "none" }}>
          <rect x={-45} y={-28} width={30} height={56} rx={6} fill="none" stroke="#E85D04" strokeWidth={2.5} />
          <rect x={-15} y={-28} width={60} height={56} rx={4} fill="none" stroke="#9ca3af" strokeWidth={1.5} />
          <text y={46} textAnchor="middle" fontSize={11} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            left sleeve
          </text>
        </g>
      ) : (
        /* Right sleeve indicator */
        <g transform="translate(500,145)" style={{ pointerEvents: "none" }}>
          <rect x={15} y={-28} width={30} height={56} rx={6} fill="none" stroke="#E85D04" strokeWidth={2.5} />
          <rect x={-45} y={-28} width={60} height={56} rx={4} fill="none" stroke="#9ca3af" strokeWidth={1.5} />
          <text y={46} textAnchor="middle" fontSize={11} fontWeight={700} fill="#9ca3af"
            style={{ fontFamily: "system-ui" }}>
            right sleeve
          </text>
        </g>
      )}

      {/* Print zone border */}
      {showPrintZone && (
        <g style={{ pointerEvents: "none" }}>
          {/* Subtle fill to indicate printable area */}
          <rect
            x={pz.x} y={pz.y} width={pz.w} height={pz.h}
            fill="rgba(232,93,4,0.04)"
            rx={6}
          />
          <rect
            x={pz.x} y={pz.y} width={pz.w} height={pz.h}
            fill="none"
            stroke="rgba(232,93,4,0.65)"
            strokeWidth={2.5}
            strokeDasharray="9 6"
            rx={6}
          />
          {/* Corner registration marks */}
          {[
            [pz.x, pz.y],
            [pz.x + pz.w, pz.y],
            [pz.x, pz.y + pz.h],
            [pz.x + pz.w, pz.y + pz.h],
          ].map(([cx2, cy2], i) => {
            const dx = i % 2 === 0 ? 1 : -1;
            const dy = i < 2 ? 1 : -1;
            return (
              <g key={i} style={{ pointerEvents: "none" }}>
                <line x1={cx2 + dx * 6} y1={cy2} x2={cx2 + dx * 22} y2={cy2}
                  stroke="rgba(232,93,4,0.4)" strokeWidth={1.5} />
                <line x1={cx2} y1={cy2 + dy * 6} x2={cx2} y2={cy2 + dy * 22}
                  stroke="rgba(232,93,4,0.4)" strokeWidth={1.5} />
              </g>
            );
          })}
          {/* Zone name */}
          <text
            x={cx} y={pz.y - 14}
            textAnchor="middle" fontSize={16} fontWeight={700}
            fill="rgba(232,93,4,0.85)"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            Print Area
          </text>
          {/* Pixel dimensions */}
          <text
            x={cx} y={pz.y + pz.h + 26}
            textAnchor="middle" fontSize={13} fontWeight={600}
            fill="rgba(107,114,128,0.75)"
            style={{ fontFamily: "ui-monospace, monospace" }}
          >
            {pxDimensions}
          </text>
        </g>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   STICKERS — curated vector decoration library
════════════════════════════════════════════════════════ */

export interface Sticker {
  id: string;
  name: string;
  svg: string;
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
