/* ═══════════════════════════════════════════════════════
   GARMENT MOCKUPS — clean SVGs with subtle texture
   All paths use a 400×N "base" coordinate space.
   The viewBox includes 24px of padding on every side.
════════════════════════════════════════════════════════ */

export type ProductType =
  | "white-tshirt"
  | "black-tshirt"
  | "white-mug"
  | "black-mug"
  | "white-hoodie"
  | "black-hoodie"
  | "white-cap"
  | "black-cap"
  | "white-longsleeve";

export interface DesignProduct {
  id: ProductType;
  name: string;
  category: "tshirt" | "mug" | "hoodie" | "cap" | "longsleeve";
  garmentColor: string;
  description: string;
  /** viewBox string — includes 24px padding on all sides */
  viewBox: string;
  /** aspect ratio of viewBox (width/height) */
  aspect: number;
  /** print zone in base (un-padded) SVG coordinates */
  printZone: { x: number; y: number; w: number; h: number };
  /** base canvas height (used for snapshot composition) */
  baseHeight: number;
}

export const TSHIRT_PZ = { x: 128, y: 168, w: 144, h: 155 };
export const MUG_PZ = { x: 80, y: 58, w: 210, h: 148 };
export const HOODIE_PZ = { x: 132, y: 200, w: 136, h: 150 };
export const CAP_PZ = { x: 140, y: 110, w: 120, h: 80 };
export const LONGSLEEVE_PZ = { x: 128, y: 168, w: 144, h: 155 };

export const PRODUCTS: DesignProduct[] = [
  { id: "white-tshirt",     name: "White T-Shirt",     category: "tshirt",     garmentColor: "#F8F7F4", description: "230GSM Cotton",   viewBox: "-24 -24 448 528", aspect: 448/528, printZone: TSHIRT_PZ,     baseHeight: 480 },
  { id: "black-tshirt",     name: "Black T-Shirt",     category: "tshirt",     garmentColor: "#1a1a1a", description: "230GSM Cotton",   viewBox: "-24 -24 448 528", aspect: 448/528, printZone: TSHIRT_PZ,     baseHeight: 480 },
  { id: "white-longsleeve", name: "White Long Sleeve", category: "longsleeve", garmentColor: "#F8F7F4", description: "240GSM Cotton",   viewBox: "-24 -24 448 568", aspect: 448/568, printZone: LONGSLEEVE_PZ, baseHeight: 520 },
  { id: "white-hoodie",     name: "White Hoodie",      category: "hoodie",     garmentColor: "#F2EFE9", description: "320GSM Fleece",   viewBox: "-24 -24 448 588", aspect: 448/588, printZone: HOODIE_PZ,     baseHeight: 540 },
  { id: "black-hoodie",     name: "Black Hoodie",      category: "hoodie",     garmentColor: "#161616", description: "320GSM Fleece",   viewBox: "-24 -24 448 588", aspect: 448/588, printZone: HOODIE_PZ,     baseHeight: 540 },
  { id: "white-cap",        name: "White Cap",         category: "cap",        garmentColor: "#F5F2EC", description: "Cotton Twill",    viewBox: "-24 -24 448 348", aspect: 448/348, printZone: CAP_PZ,        baseHeight: 300 },
  { id: "black-cap",        name: "Black Cap",         category: "cap",        garmentColor: "#161616", description: "Cotton Twill",    viewBox: "-24 -24 448 348", aspect: 448/348, printZone: CAP_PZ,        baseHeight: 300 },
  { id: "white-mug",        name: "White Mug",         category: "mug",        garmentColor: "#F5F5F5", description: "11oz Ceramic",    viewBox: "-24 -24 448 388", aspect: 448/388, printZone: MUG_PZ,        baseHeight: 340 },
  { id: "black-mug",        name: "Black Mug",         category: "mug",        garmentColor: "#1C1917", description: "11oz Ceramic",    viewBox: "-24 -24 448 388", aspect: 448/388, printZone: MUG_PZ,        baseHeight: 340 },
];

/* ── shared helpers ───────────────────────────────────── */
function isDarkColor(hex: string) {
  return /^#[01234]/i.test(hex);
}

interface MockupProps { color: string; showPrintZone: boolean }

/* ═══════════════════════════════════════════════════════
   T-SHIRT
════════════════════════════════════════════════════════ */
export function TShirtSVGParts({ color, showPrintZone }: MockupProps) {
  const isDark = isDarkColor(color);
  const stitch = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const highlight = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)";
  const shade = isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)";

  const BODY = "M130,55 Q122,82 110,100 L0,140 L12,218 L108,192 L108,448 L292,448 L292,192 L388,218 L400,140 L290,100 Q278,82 270,55 Q242,98 200,106 Q158,98 130,55 Z";
  const COLLAR = "M130,55 Q158,98 200,106 Q242,98 270,55 Q260,40 200,36 Q140,40 130,55 Z";
  const pz = TSHIRT_PZ;

  return (
    <>
      <defs>
        <filter id="ts-shadow" x="-8%" y="-8%" width="116%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="rgba(0,0,0,0.18)" />
        </filter>
        <linearGradient id="ts-hl" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.04)"} />
        </linearGradient>
        <linearGradient id="ts-body-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0)"} />
          <stop offset="50%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.05)"} />
        </linearGradient>
        <radialGradient id="ts-chest-light" cx="0.5" cy="0.35" r="0.45">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="ts-clip"><path d={BODY} /></clipPath>
      </defs>
      <path d={BODY} fill={color} filter="url(#ts-shadow)" />
      <path d={BODY} fill="url(#ts-hl)" />
      <path d={BODY} fill="url(#ts-body-grad)" />
      <path d={BODY} fill="url(#ts-chest-light)" />
      <path d="M108,192 L12,218 L12,175 L108,148 Z" fill={shade} clipPath="url(#ts-clip)" />
      <path d="M292,192 L388,218 L388,175 L292,148 Z" fill={shade} clipPath="url(#ts-clip)" />
      <path d="M155,148 Q178,155 200,156 Q222,155 245,148 L245,170 Q222,178 200,180 Q178,178 155,170 Z" fill={isDark ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.02)"} clipPath="url(#ts-clip)" />
      <path d={COLLAR} fill={isDark ? "#0d0d0d" : "#e8e6e2"} />
      <path d={COLLAR} fill={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} />
      <ellipse cx="200" cy="100" rx="68" ry="14" fill="rgba(0,0,0,0.07)" clipPath="url(#ts-clip)" />
      <g clipPath="url(#ts-clip)" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5">
        <line x1="108" y1="195" x2="108" y2="448" />
        <line x1="292" y1="195" x2="292" y2="448" />
      </g>
      <line x1="108" y1="448" x2="292" y2="448" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5" />
      <path d="M12,218 L108,192" stroke={stitch} fill="none" strokeWidth="0.8" strokeDasharray="3 2.5" />
      <path d="M388,218 L292,192" stroke={stitch} fill="none" strokeWidth="0.8" strokeDasharray="3 2.5" />
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4" />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   LONG SLEEVE
════════════════════════════════════════════════════════ */
export function LongSleeveSVGParts({ color, showPrintZone }: MockupProps) {
  const isDark = isDarkColor(color);
  const stitch = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const highlight = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.45)";
  const shade = isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)";

  // Long sleeves extend down to ~y=380
  const BODY = "M130,55 Q122,82 110,100 L20,135 L8,360 L94,388 L108,200 L108,488 L292,488 L292,200 L306,388 L392,360 L380,135 L290,100 Q278,82 270,55 Q242,98 200,106 Q158,98 130,55 Z";
  const COLLAR = "M130,55 Q158,98 200,106 Q242,98 270,55 Q260,40 200,36 Q140,40 130,55 Z";
  const pz = LONGSLEEVE_PZ;

  return (
    <>
      <defs>
        <filter id="ls-shadow" x="-8%" y="-8%" width="116%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="rgba(0,0,0,0.18)" />
        </filter>
        <linearGradient id="ls-hl" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.04)"} />
        </linearGradient>
        <linearGradient id="ls-body-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0)"} />
          <stop offset="50%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.05)"} />
        </linearGradient>
        <radialGradient id="ls-chest-light" cx="0.5" cy="0.35" r="0.45">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.22)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="ls-clip"><path d={BODY} /></clipPath>
      </defs>
      <path d={BODY} fill={color} filter="url(#ls-shadow)" />
      <path d={BODY} fill="url(#ls-hl)" />
      <path d={BODY} fill="url(#ls-body-grad)" />
      <path d={BODY} fill="url(#ls-chest-light)" />
      {/* Cuff stitching */}
      <line x1="8" y1="360" x2="94" y2="388" stroke={shade} strokeWidth="1.2" clipPath="url(#ls-clip)" />
      <line x1="392" y1="360" x2="306" y2="388" stroke={shade} strokeWidth="1.2" clipPath="url(#ls-clip)" />
      <path d="M155,148 Q178,155 200,156 Q222,155 245,148 L245,170 Q222,178 200,180 Q178,178 155,170 Z" fill={isDark ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.02)"} clipPath="url(#ls-clip)" />
      <path d={COLLAR} fill={isDark ? "#0d0d0d" : "#e8e6e2"} />
      <path d={COLLAR} fill={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} />
      <ellipse cx="200" cy="100" rx="68" ry="14" fill="rgba(0,0,0,0.07)" clipPath="url(#ls-clip)" />
      <g clipPath="url(#ls-clip)" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5">
        <line x1="108" y1="195" x2="108" y2="488" />
        <line x1="292" y1="195" x2="292" y2="488" />
      </g>
      <line x1="108" y1="488" x2="292" y2="488" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5" />
      {/* Cuff bands */}
      <rect x="8" y="360" width="86" height="20" fill={shade} clipPath="url(#ls-clip)" rx="2" />
      <rect x="306" y="360" width="86" height="20" fill={shade} clipPath="url(#ls-clip)" rx="2" />
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4" />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   HOODIE
════════════════════════════════════════════════════════ */
export function HoodieSVGParts({ color, showPrintZone }: MockupProps) {
  const isDark = isDarkColor(color);
  const stitch = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.07)";
  const highlight = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.40)";
  const shade = isDark ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.08)";
  const drawColor = isDark ? "#e8e8e8" : "#3a3a3a";

  // Hoodie body extends taller; hood drawn behind shoulders
  const BODY = "M120,90 Q108,118 96,138 L0,178 L18,260 L108,232 L108,508 L292,508 L292,232 L382,260 L400,178 L304,138 Q292,118 280,90 Q258,128 200,134 Q142,128 120,90 Z";
  const HOOD = "M118,92 Q90,40 200,32 Q310,40 282,92 Q258,128 200,134 Q142,128 118,92 Z";
  const POCKET = "M134,358 L266,358 Q278,360 280,372 L286,432 Q284,442 274,442 L126,442 Q116,442 114,432 L120,372 Q122,360 134,358 Z";
  const pz = HOODIE_PZ;

  return (
    <>
      <defs>
        <filter id="hd-shadow" x="-8%" y="-8%" width="116%" height="120%">
          <feDropShadow dx="0" dy="12" stdDeviation="18" floodColor="rgba(0,0,0,0.20)" />
        </filter>
        <linearGradient id="hd-hl" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="45%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.10)" : "rgba(0,0,0,0.04)"} />
        </linearGradient>
        <linearGradient id="hd-body-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0)"} />
          <stop offset="55%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.07)"} />
        </linearGradient>
        <radialGradient id="hd-chest-light" cx="0.5" cy="0.42" r="0.42">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="hd-clip"><path d={BODY} /></clipPath>
      </defs>
      {/* Hood (drawn first so body covers it at neckline) */}
      <path d={HOOD} fill={color} filter="url(#hd-shadow)" />
      <path d={HOOD} fill={shade} opacity="0.6" />
      {/* Body */}
      <path d={BODY} fill={color} filter="url(#hd-shadow)" />
      <path d={BODY} fill="url(#hd-hl)" />
      <path d={BODY} fill="url(#hd-body-grad)" />
      <path d={BODY} fill="url(#hd-chest-light)" />
      {/* Sleeve shadow */}
      <path d="M108,232 L18,260 L18,210 L108,184 Z" fill={shade} clipPath="url(#hd-clip)" />
      <path d="M292,232 L382,260 L382,210 L292,184 Z" fill={shade} clipPath="url(#hd-clip)" />
      {/* Cuffs */}
      <rect x="8" y="244" width="100" height="22" fill={shade} clipPath="url(#hd-clip)" rx="3" />
      <rect x="292" y="244" width="100" height="22" fill={shade} clipPath="url(#hd-clip)" rx="3" />
      {/* Hem band */}
      <rect x="108" y="488" width="184" height="22" fill={shade} clipPath="url(#hd-clip)" rx="3" />
      {/* Kangaroo pocket */}
      <path d={POCKET} fill={shade} opacity="0.7" />
      <path d={POCKET} fill="none" stroke={stitch} strokeWidth="1" strokeDasharray="3 2.5" />
      {/* Drawstrings */}
      <ellipse cx="200" cy="130" rx="42" ry="10" fill={isDark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.18)"} />
      <line x1="180" y1="132" x2="172" y2="218" stroke={drawColor} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="220" y1="132" x2="228" y2="218" stroke={drawColor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="172" cy="222" r="4" fill={drawColor} />
      <circle cx="228" cy="222" r="4" fill={drawColor} />
      {/* Stitching */}
      <g clipPath="url(#hd-clip)" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5">
        <line x1="108" y1="232" x2="108" y2="488" />
        <line x1="292" y1="232" x2="292" y2="488" />
      </g>
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4" />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   CAP
════════════════════════════════════════════════════════ */
export function CapSVGParts({ color, showPrintZone }: MockupProps) {
  const isDark = isDarkColor(color);
  const stitch = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const highlight = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.40)";
  const shade = isDark ? "rgba(0,0,0,0.30)" : "rgba(0,0,0,0.10)";

  const CROWN = "M80,200 Q70,90 200,60 Q330,90 320,200 L80,200 Z";
  const BRIM = "M48,200 Q200,180 352,200 Q358,232 200,238 Q42,232 48,200 Z";
  const pz = CAP_PZ;

  return (
    <>
      <defs>
        <filter id="cap-shadow" x="-8%" y="-8%" width="116%" height="130%">
          <feDropShadow dx="0" dy="10" stdDeviation="14" floodColor="rgba(0,0,0,0.20)" />
        </filter>
        <radialGradient id="cap-hl" cx="0.5" cy="0.3" r="0.55">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="cap-shade" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={shade} />
          <stop offset="60%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="cap-brim-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.18)"} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>
        <clipPath id="cap-crown-clip"><path d={CROWN} /></clipPath>
      </defs>
      {/* Brim (behind crown) */}
      <path d={BRIM} fill={color} filter="url(#cap-shadow)" />
      <path d={BRIM} fill="url(#cap-brim-shade)" />
      <path d="M48,200 Q200,180 352,200" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5" />
      {/* Crown */}
      <path d={CROWN} fill={color} filter="url(#cap-shadow)" />
      <path d={CROWN} fill="url(#cap-hl)" />
      <path d={CROWN} fill="url(#cap-shade)" />
      {/* Panel seams (6-panel cap suggestion) */}
      <g clipPath="url(#cap-crown-clip)" stroke={stitch} fill="none" strokeWidth="1" strokeDasharray="3 2.5">
        <path d="M200,60 Q200,130 200,200" />
        <path d="M134,68 Q150,130 156,200" />
        <path d="M266,68 Q250,130 244,200" />
      </g>
      {/* Sweatband shadow */}
      <ellipse cx="200" cy="200" rx="120" ry="6" fill={shade} opacity="0.6" />
      {/* Top button */}
      <circle cx="200" cy="62" r="5" fill={isDark ? "#2a2a2a" : "#d6d3cc"} />
      <circle cx="200" cy="61" r="2.5" fill={isDark ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.5)"} />
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4"
          clipPath="url(#cap-crown-clip)" />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   MUG
════════════════════════════════════════════════════════ */
export function MugSVGParts({ color, showPrintZone }: MockupProps) {
  const isDark = isDarkColor(color);
  const highlight = isDark ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.45)";
  const rimColor = isDark ? "#2a2a2a" : "#d0d0d0";
  const handleColor = isDark ? "#222" : "#c8c8c8";
  const innerColor = isDark ? "#111" : "#e8e6e2";
  const pz = MUG_PZ;

  const MUG_BODY = "M68,45 L72,285 Q75,312 95,318 L305,318 Q325,312 328,285 L332,45 Z";

  return (
    <>
      <defs>
        <filter id="mug-shadow" x="-8%" y="-8%" width="120%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="18" floodColor="rgba(0,0,0,0.2)" />
        </filter>
        <linearGradient id="mug-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,0.20)" />
          <stop offset="8%" stopColor="rgba(0,0,0,0.06)" />
          <stop offset="45%" stopColor="transparent" />
          <stop offset="85%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.25)" />
        </linearGradient>
        <linearGradient id="mug-hl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="15%" stopColor={highlight} />
          <stop offset="35%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="mug-vshade" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0)"} />
          <stop offset="85%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.06)"} />
        </linearGradient>
        <radialGradient id="mug-specular" cx="0.28" cy="0.25" r="0.25">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.30)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="mug-body-clip"><path d={MUG_BODY} /></clipPath>
      </defs>
      <path d="M332,105 Q380,100 388,168 Q388,235 332,230 L332,208 Q362,208 366,168 Q366,130 332,128 Z"
        fill={handleColor} filter="url(#mug-shadow)" />
      <path d="M335,112 Q370,108 375,168 Q375,226 335,222" stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)"} fill="none" strokeWidth="1.5" />
      <path d={MUG_BODY} fill={color} filter="url(#mug-shadow)" />
      <path d={MUG_BODY} fill="url(#mug-shade)" />
      <path d={MUG_BODY} fill="url(#mug-hl)" />
      <path d={MUG_BODY} fill="url(#mug-vshade)" />
      <path d={MUG_BODY} fill="url(#mug-specular)" />
      <ellipse cx="200" cy="45" rx="132" ry="24" fill={rimColor} />
      <ellipse cx="200" cy="43" rx="130" ry="22" fill={color} />
      <ellipse cx="200" cy="41" rx="124" ry="18" fill={innerColor} />
      <ellipse cx="200" cy="41" rx="118" ry="14" fill="rgba(0,0,0,0.12)" />
      <ellipse cx="200" cy="318" rx="116" ry="10" fill="rgba(0,0,0,0.12)" />
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4"
          clipPath="url(#mug-body-clip)" />
      )}
    </>
  );
}

/* Convenience renderer that picks the right component for a product */
export function GarmentSVG({ product, color, showPrintZone }: { product: DesignProduct; color: string; showPrintZone: boolean }) {
  switch (product.category) {
    case "tshirt":     return <TShirtSVGParts color={color} showPrintZone={showPrintZone} />;
    case "longsleeve": return <LongSleeveSVGParts color={color} showPrintZone={showPrintZone} />;
    case "hoodie":     return <HoodieSVGParts color={color} showPrintZone={showPrintZone} />;
    case "cap":        return <CapSVGParts color={color} showPrintZone={showPrintZone} />;
    case "mug":        return <MugSVGParts color={color} showPrintZone={showPrintZone} />;
  }
}
