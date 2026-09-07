import type {
  DesignProduct,
  ApparelZone,
  PrintZone,
} from "../design-studio/mockups";

export type { DesignProduct, ApparelZone, PrintZone };

export type Face = "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label";
export type MugMode = "side1" | "side2" | "wrap";
export type ToolType = "select" | "text" | "shape" | "draw" | "eyedrop";
export type RightTab = "upload" | "text" | "layers" | "templates" | "ai" | "qrcode";
export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type ShapeType = "rect" | "circle" | "star" | "arrow" | "polygon" | "line";
export type GradientType = "linear" | "radial" | "conic";

export interface Transform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  scaleX?: number;
  scaleY?: number;
}

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  transform: Transform;
  face?: Face;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string;
  naturalW: number;
  naturalH: number;
  flipH?: boolean;
  flipV?: boolean;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  // Advanced fill for uploaded SVG-like shapes / stickers
  tint?: string;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontWeight: number;
  fontStyle: "normal" | "italic";
  fontSize: number;
  color: string;
  textAlign?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  shadowColor?: string;
  letterSpacing?: number;
  // Advanced typography
  gradient?: GradientConfig;
  arcRadius?: number;
  arcAngle?: number;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shapeType: ShapeType;
  fill: string | GradientConfig | PatternConfig;
  strokeColor?: string;
  points?: number[];

  strokeWidth?: number;
  width: number;
  height: number;
  sides?: number; // for polygon/star
}

export type Layer = ImageLayer | TextLayer | ShapeLayer;

export interface GradientConfig {
  type: GradientType;
  angle?: number;
  stops: { offset: number; color: string }[];
}

export interface PatternConfig {
  type: "pattern";
  pattern: "stripes" | "dots" | "chevrons" | "custom";
  color1: string;
  color2: string;
  scale?: number;
}

export interface GradientStop {
  offset: number;
  color: string;
}

export interface DraftPayload {
  version: number;
  layers: Layer[];
  productId: string;
  color: { name: string; hex: string };
  size: string;
  savedAt: number;
  activeFace?: Face;
  mugMode?: string;
  linkedStoreProductId?: number;
  linkedStoreProductName?: string;
  linkedStoreProductPrice?: number;
}

export interface LinkedStoreProduct {
  id: number;
  name: string;
  price: number;
  imageUrl?: string;
}

export interface ProductState {
  selectedProduct: DesignProduct;
  selectedColor: { name: string; hex: string };
  activeFace: Face;
  mugMode: MugMode;
  selectedSize: string;
  quantity: number;
}

export interface StudioUIState {
  activeTab: RightTab;
  showProductPicker: boolean;
  productSearch: string;
  productPickerCategory: "all" | DesignProduct["category"];
  mobileToolOpen: boolean;
  mobileTab: "product" | "color" | "edit";
  show3D: boolean;
  showPrintZone: boolean;
  isMobile: boolean;
  canvasZoom: number;
  canvasPan: { x: number; y: number };
  snapGuides: { v: boolean; h: boolean };
}

export interface AIState {
  prompt: string;
  negativePrompt: string;
  generating: boolean;
  phase: string | null;
  progress: number;
  error: string | null;
  history: { prompt: string; url: string }[];
  styleTab: number;
  refFile: File | null;
}

export interface ExportState {
  format: "png" | "pdf";
  dpi: 72 | 150 | 300;
  includeBleed: boolean;
  includeGuides: boolean;
  open: boolean;
}

export const ZERO_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export const FONT_FAMILIES = [
  { label: "Sans", value: "Inter, system-ui, sans-serif" },
  { label: "Bold Display", value: "'Helvetica Neue', Arial, sans-serif" },
  { label: "Space Grotesk", value: "'Space Grotesk', sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', Impact, sans-serif" },
  { label: "Barlow Cond.", value: "'Barlow Condensed', 'Arial Narrow', sans-serif" },
  { label: "Nunito", value: "'Nunito', 'Comic Sans MS', sans-serif" },
  { label: "Playfair", value: "'Playfair Display', Georgia, serif" },
  { label: "Pacifico", value: "'Pacifico', cursive" },
  { label: "Marker", value: "'Permanent Marker', 'Brush Script MT', cursive" },
  { label: "বাংলা (Bangla)", value: "'Hind Siliguri', sans-serif" },
  { label: "Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Script", value: "'Brush Script MT', cursive" },
];

export const QUICK_PRODUCT_IDS = ["tshirt", "hoodie", "mug", "cap"] as const;

export const DRAFT_VERSION = 2;
export const DRAFT_STORAGE_KEY = "trynex-design-draft-v2";

export interface AIStylePreset {
  id: string;
  label: string;
  suffix: string;
}

export const AI_STYLE_PRESETS: AIStylePreset[] = [
  { id: "realistic", label: "Realistic", suffix: ", photorealistic, 8k, studio lighting" },
  { id: "cartoon", label: "Cartoon", suffix: ", flat vector cartoon, bold outlines, vibrant" },
  { id: "watercolor", label: "Watercolor", suffix: ", watercolor painting, soft edges, artistic" },
  { id: "pixel", label: "Pixel Art", suffix: ", pixel art, 16-bit retro game style" },
  { id: "minimalist", label: "Minimalist", suffix: ", clean minimalist design, simple shapes" },
  { id: "streetwear", label: "Streetwear", suffix: ", bold streetwear graphic, urban aesthetic" },
  { id: "bangla", label: "Bangla Art", suffix: ", traditional Bangladeshi folk art style" },
];

export interface ClipArtItem {
  id: string;
  name: string;
  svg: string;
  category: string;
}

export const STUDIO_CUSTOM_COLOR_ENABLED = false;
