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
