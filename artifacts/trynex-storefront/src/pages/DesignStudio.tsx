import { useRef, useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions, type OriginalAsset } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useGesture } from "@use-gesture/react";
import {
  Upload, RotateCcw, Trash2, ShoppingCart,
  ZoomIn, ZoomOut, RotateCw, Move, Ruler,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Scissors, Info, Eye, EyeOff, Loader2, Wand2,
  Type, Layers as LayersIcon, Sparkles,
  Undo2, Redo2, Lock, Unlock, ChevronUp, ChevronDown,
  Image as ImageIcon, Plus, Check, CloudUpload,
  Box, Image as Image2D, Search, X, ChevronRight,
  Palette, Package,
} from "lucide-react";
import {
  PRODUCTS, type DesignProduct, GarmentSVG, FlatZoneSVG,
  STICKERS, BASE_BY_CATEGORY, MUG_SIDE_PZ, MUG_PZ,
  getApparelZones, getZonePZ, type ApparelZone,
} from "./design-studio/mockups";
import { composeLayers, composeGarmentMockup, composeDesignTexture, hasWebGL2, type ComposerLayer } from "./design-studio/composer";

// Lazy-load the 3D bundle so first-paint stays light.
const ProductViewer3D = lazy(() => import("./design-studio/ProductViewer3D"));

/* ═══════════════════════════════════════════════════════
   LAYER MODEL
════════════════════════════════════════════════════════ */

interface Transform { x: number; y: number; scale: number; rotation: number; opacity: number }
const ZERO_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

type Face = "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label";
interface BaseLayer { id: string; name: string; visible: boolean; locked: boolean; transform: Transform; face?: Face }
interface ImageLayer extends BaseLayer { type: "image"; src: string; naturalW: number; naturalH: number }
interface TextLayer extends BaseLayer {
  type: "text"; text: string; fontFamily: string; fontWeight: number;
  fontStyle: "normal" | "italic"; fontSize: number; color: string;
}
type Layer = ImageLayer | TextLayer;

const SIZE_CHART = [
  { size: "XS", chest: "36", length: "26" },
  { size: "S",  chest: "38", length: "27" },
  { size: "M",  chest: "40", length: "28" },
  { size: "L",  chest: "42", length: "29" },
  { size: "XL", chest: "44", length: "30" },
  { size: "XXL",  chest: "46", length: "31" },
  { size: "XXXL", chest: "48", length: "32" },
];

const FONT_FAMILIES = [
  { label: "Sans (Inter)",  value: "Inter, system-ui, sans-serif" },
  { label: "Display Bold",  value: "'Helvetica Neue', Arial, sans-serif" },
  { label: "Serif",         value: "'Playfair Display', Georgia, serif" },
  { label: "Mono",          value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Script",        value: "'Brush Script MT', cursive" },
];

interface Template { id: string; name: string; preview: string; create: () => Layer[] }
function uid() { return Math.random().toString(36).slice(2, 10); }
const TEMPLATES: Template[] = [
  {
    id: "tpl-bigword", name: "Big Word", preview: "DREAM",
    create: () => [{
      id: uid(), name: "DREAM", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM, scale: 1.4 },
      text: "DREAM", fontFamily: FONT_FAMILIES[1].value, fontWeight: 900,
      fontStyle: "normal", fontSize: 64, color: "#111111",
    }],
  },
  {
    id: "tpl-namaste", name: "Namaste", preview: "নমস্কার",
    create: () => [{
      id: uid(), name: "নমস্কার", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM },
      text: "নমস্কার", fontFamily: FONT_FAMILIES[2].value, fontWeight: 700,
      fontStyle: "italic", fontSize: 48, color: "#7c2d12",
    }],
  },
  {
    id: "tpl-stack", name: "Stacked", preview: "GOOD\nVIBES",
    create: () => [
      {
        id: uid(), name: "GOOD", type: "text", visible: true, locked: false,
        transform: { ...ZERO_TRANSFORM, y: -22 },
        text: "GOOD", fontFamily: FONT_FAMILIES[1].value, fontWeight: 900,
        fontStyle: "normal", fontSize: 50, color: "#E85D04",
      },
      {
        id: uid(), name: "VIBES", type: "text", visible: true, locked: false,
        transform: { ...ZERO_TRANSFORM, y: 22 },
        text: "VIBES", fontFamily: FONT_FAMILIES[1].value, fontWeight: 900,
        fontStyle: "normal", fontSize: 50, color: "#111111",
      },
    ],
  },
  {
    id: "tpl-mono", name: "Mono Tag", preview: "// trynex",
    create: () => [{
      id: uid(), name: "// trynex", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM },
      text: "// trynex", fontFamily: FONT_FAMILIES[3].value, fontWeight: 600,
      fontStyle: "normal", fontSize: 38, color: "#111111",
    }],
  },
  {
    id: "tpl-script", name: "Script", preview: "Cheers",
    create: () => [{
      id: uid(), name: "Cheers", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM, rotation: -8 },
      text: "Cheers", fontFamily: FONT_FAMILIES[4].value, fontWeight: 700,
      fontStyle: "italic", fontSize: 60, color: "#1e3a5f",
    }],
  },
  {
    id: "tpl-emoji", name: "Heart Stack", preview: "♥ DHAKA",
    create: () => [{
      id: uid(), name: "♥ DHAKA", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM },
      text: "♥ DHAKA", fontFamily: FONT_FAMILIES[1].value, fontWeight: 800,
      fontStyle: "normal", fontSize: 44, color: "#dc2626",
    }],
  },
];

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */

type RightTab = "upload" | "text" | "layers" | "templates";

const DRAFT_STORAGE_KEY = "trynex-design-draft-v1";
// Bumped to v2 when garment coordinate space changed from per-product viewBoxes
// to a unified 1000x1000 space (photographic mockups). Old drafts are dropped.
const DRAFT_VERSION = 2;
type SaveStatus = "idle" | "saving" | "saved";
interface DraftPayload {
  version: number;
  layers: Layer[];
  productId: string;
  color: { name: string; hex: string };
  size: string;
  savedAt: number;
}

export default function DesignStudio() {
  const [, navigate] = useLocation();
  const { addToCart } = useCartActions();
  const settings = useSiteSettings();
  const { toast } = useToast();

  const [selectedProduct, setSelectedProduct] = useState<DesignProduct>(PRODUCTS[0]);
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string }>(
    { name: PRODUCTS[0].name, hex: PRODUCTS[0].garmentColor }
  );
  const [activeTab, setActiveTab] = useState<RightTab>("upload");

  /* Product catalog picker */
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productPickerCategory, setProductPickerCategory] = useState<"all" | DesignProduct["category"]>("all");
  /* Mobile tool panel (bottom sheet) */
  const [mobileToolOpen, setMobileToolOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [showPrintZone, setShowPrintZone] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  // null = loading, true = configured (remove.bg API key set), false = not configured (will use in-browser fallback)
  const [removeBgServerConfigured, setRemoveBgServerConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(getApiUrl("/api/remove-bg/status"))
      .then(r => r.json())
      .then((d: { configured: boolean }) => setRemoveBgServerConfigured(d.configured))
      .catch(() => setRemoveBgServerConfigured(false));
  }, []);

  /* View mode + active face */
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [activeFace, setActiveFace] = useState<Face>("front");
  const supports3D = useMemo(() => hasWebGL2(), []);

  // Mug-only: 2D editor exposes a 3-way print-mode selector
  // (Side 1 / Side 2 / Wrap) instead of the apparel "Front / Back" tabs.
  // Side 1 → existing front face data, Side 2 → existing back face data,
  // Wrap   → a virtual "back" face used as a continuous 360° body design.
  type MugMode = "side1" | "side2" | "wrap";
  const [mugMode, setMugMode] = useState<MugMode>("side1");

  const isMugProduct = selectedProduct.category === "mug";

  // Tee/longsleeve/hoodie support a back face. Mug also gets back face data
  // for Side 2 / Wrap, but the *apparel* Front/Back UI must stay hidden for it.
  const supportsBack = useMemo(
    () => ["tshirt", "longsleeve", "hoodie", "mug"].includes(selectedProduct.category),
    [selectedProduct.category]
  );

  // Sync mugMode → activeFace so the existing face-aware layer system works.
  // Mapping:
  //   side1 → "front"  (front print panel)
  //   side2 → "back"   (back print panel)
  //   wrap  → "back"   (uses the back face slot too, but the renderer treats
  //                     wrap differently: when mugMode === "wrap" the design
  //                     spans the full 360° body via UV-repeat in MugBody).
  // Distinguishing Side 2 vs Wrap is handled below via `isWrapMode` so the
  // 3D preview can switch between a localized panel and a continuous body wrap.
  useEffect(() => {
    if (!isMugProduct) return;
    setActiveFace(mugMode === "side1" ? "front" : "back");
  }, [mugMode, isMugProduct]);

  // Exposed flag the 3D mug preview reads to decide between "panel" decal
  // (Side 2) and "full body wrap" (Wrap full body) when rendering.
  const isWrapMode = isMugProduct && mugMode === "wrap";
  // Reset face to "front" when switching to a single-face product
  useEffect(() => { if (!supportsBack) setActiveFace("front"); }, [supportsBack]);

  /* Layers + history */
  const [layers, setLayers] = useState<Layer[]>([]);
  const layersRef = useRef<Layer[]>([]);
  useEffect(() => { layersRef.current = layers; }, [layers]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const selectedLayerIdRef = useRef<string | null>(null);
  useEffect(() => { selectedLayerIdRef.current = selectedLayerId; }, [selectedLayerId]);
  const historyRef = useRef<{ stack: Layer[][]; index: number }>({ stack: [[]], index: 0 });
  const [, forceHistoryTick] = useState(0);

  const commitLayers = useCallback((next: Layer[]) => {
    const h = historyRef.current;
    h.stack = h.stack.slice(0, h.index + 1);
    h.stack.push(next);
    if (h.stack.length > 50) h.stack.shift();
    h.index = h.stack.length - 1;
    setLayers(next);
    forceHistoryTick(t => t + 1);
  }, []);
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (h.index > 0) { h.index -= 1; setLayers(h.stack[h.index]); forceHistoryTick(t => t + 1); }
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (h.index < h.stack.length - 1) { h.index += 1; setLayers(h.stack[h.index]); forceHistoryTick(t => t + 1); }
  }, []);
  const canUndo = historyRef.current.index > 0;
  const canRedo = historyRef.current.index < historyRef.current.stack.length - 1;

  /* Snap guides */
  const [snapGuides, setSnapGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  /* ── Draft persistence (localStorage) ──────────────── */
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasDraft, setHasDraft] = useState(false);
  const [legacyDraftFound, setLegacyDraftFound] = useState<{ version: number } | null>(null);
  const draftRestoredRef = useRef(false);
  const urlInitRef = useRef(false);

  // Restore draft on mount (runs once)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const isEdit = searchParams.get("edit") === "1";

      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<DraftPayload>;
        // Defensive shape validation — malformed/foreign data should be ignored, not crash the page.
        const isValidLayer = (l: any): l is Layer =>
          l && typeof l === "object"
          && typeof l.id === "string"
          && (l.type === "image" || l.type === "text")
          && l.transform && typeof l.transform.x === "number" && typeof l.transform.y === "number"
          && typeof l.transform.scale === "number" && typeof l.transform.rotation === "number"
          && typeof l.transform.opacity === "number"
          && (l.type === "text"
            ? typeof l.text === "string" && typeof l.fontSize === "number"
            : typeof l.src === "string" && typeof l.naturalW === "number" && typeof l.naturalH === "number");
        const validLayers = Array.isArray(data?.layers) ? (data!.layers as any[]).filter(isValidLayer) as Layer[] : [];
        // For older-format drafts, prompt the user before discarding (data not lost silently)
        if (data && typeof data.version === "number" && data.version !== DRAFT_VERSION) {
          setLegacyDraftFound({ version: data.version });
        }
        if (data && data.version === DRAFT_VERSION) {
          if (typeof data.productId === "string") {
            const p = PRODUCTS.find(x => x.id === data.productId);
            if (p) setSelectedProduct(p);
          }
          if (data.color && typeof (data.color as any).hex === "string" && typeof (data.color as any).name === "string") {
            setSelectedColor(data.color as { name: string; hex: string });
          }
          if (typeof data.size === "string") setSelectedSize(data.size);
          if (validLayers.length > 0) {
            setLayers(validLayers);
            historyRef.current = { stack: [validLayers], index: 0 };
            forceHistoryTick(t => t + 1);
            setHasDraft(true);
            setSaveStatus("saved");
            if (isEdit) {
              toast({ title: "Design Restored", description: "Your design has been restored for editing." });
            } else {
              toast({ title: "Draft restored", description: "We brought back your last design." });
            }
          }
        }
      }
    } catch {
      // Corrupt JSON or storage access failure — ignore and start fresh.
    }
    // URL params override draft settings (URL is the source of truth when shared)
    try {
      const sp = new URLSearchParams(window.location.search);
      const urlProduct = sp.get("product");
      if (urlProduct) {
        const found = PRODUCTS.find(p => p.id === urlProduct || p.category === urlProduct);
        if (found) {
          setSelectedProduct(found);
          setSelectedColor({ name: found.name, hex: found.garmentColor });
        }
      }
      const urlTab = sp.get("tab");
      if (urlTab && ["upload", "text", "layers", "templates"].includes(urlTab)) {
        setActiveTab(urlTab as typeof activeTab);
      }
      if (sp.get("view") === "back") setActiveFace("back");
      const urlSize = sp.get("size");
      if (urlSize && ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(urlSize)) {
        setSelectedSize(urlSize);
      }
    } catch {
      // Ignore URL parsing errors
    }
    draftRestoredRef.current = true;
    urlInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft when layers / product / color / size change (debounced)
  useEffect(() => {
    if (!draftRestoredRef.current) return;

    if (layers.length === 0) {
      // Nothing meaningful to save. We DO NOT touch the persisted draft key
      // when there is an unresolved legacy draft awaiting the user's
      // decision — otherwise the saved work would be deleted silently
      // before the confirm dialog is answered.
      if (legacyDraftFound) {
        setSaveStatus("idle");
        return;
      }
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false);
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    const handle = window.setTimeout(() => {
      try {
        const payload: DraftPayload = {
          version: DRAFT_VERSION,
          layers,
          productId: selectedProduct.id,
          color: selectedColor,
          size: selectedSize,
          savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        setHasDraft(true);
        setSaveStatus("saved");
      } catch {
        // Quota exceeded or serialization failure — leave status as-is silently.
        setSaveStatus("idle");
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [layers, selectedProduct, selectedColor, selectedSize, legacyDraftFound]);

  // Sync shareable URL params whenever key state changes (after init)
  useEffect(() => {
    if (!urlInitRef.current) return;
    const params = new URLSearchParams();
    if (selectedProduct.id !== PRODUCTS[0].id) params.set("product", selectedProduct.id);
    if (activeTab !== "upload") params.set("tab", activeTab);
    if (activeFace !== "front") params.set("view", activeFace);
    if (selectedSize !== "M") params.set("size", selectedSize);
    const q = params.toString();
    const newUrl = window.location.pathname + (q ? "?" + q : "");
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [selectedProduct.id, activeTab, activeFace, selectedSize]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    setLayers([]);
    setSelectedLayerId(null);
    historyRef.current = { stack: [[]], index: 0 };
    forceHistoryTick(t => t + 1);
    setHasDraft(false);
    setSaveStatus("idle");
    toast({ title: "Draft cleared", description: "Your saved design has been removed." });
  }, [toast]);

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputAddRef = useRef<HTMLInputElement>(null);

  // Print zone is face/zone-aware.
  // Mug: MUG_PZ in wrap mode, MUG_SIDE_PZ for sides.
  // Apparel sleeve/neck zones: use getZonePZ which returns SLEEVE_PZ or NECK_LABEL_PZ.
  // Apparel front/back: product's own printZone.
  const pz = useMemo(() => {
    if (isMugProduct) {
      return mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ;
    }
    return getZonePZ(activeFace, selectedProduct);
  }, [isMugProduct, mugMode, activeFace, selectedProduct]);
  const pzRef = useRef(pz);
  useEffect(() => { pzRef.current = pz; }, [pz]);

  const activeFaceRef = useRef(activeFace);
  useEffect(() => { activeFaceRef.current = activeFace; }, [activeFace]);

  /* Per-product design isolation — layers/history are stored separately for
     each product so switching between T-Shirt and Hoodie doesn't mix them up. */
  const perProductLayersRef = useRef<Record<string, { layers: Layer[]; stack: Layer[][]; index: number }>>({});

  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";
  const isWaterBottle = selectedProduct.category === "waterbottle";

  /** Zones list for apparel (tshirt/longsleeve/hoodie) — 5 tabs. */
  const apparelZones = useMemo(
    () => getApparelZones(selectedProduct.category, selectedProduct.printZone),
    [selectedProduct.category, selectedProduct.printZone]
  );
  /** True when the product supports the multi-zone tab bar. */
  const isZoneTabs = useMemo(
    () => ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category),
    [selectedProduct.category]
  );
  /** True when the active zone is a flat template (sleeve / neck-label). */
  const isFlatZone = activeFace === "left-sleeve" || activeFace === "right-sleeve" || activeFace === "neck-label";
  /** Config of the currently active apparel zone. */
  const activeZoneConfig = useMemo(
    () => apparelZones.find(z => z.face === activeFace) ?? apparelZones[0],
    [apparelZones, activeFace]
  );

  // All products now support 3D preview:
  //   tshirt      → real scanned GLB with design overlay
  //   mug         → generated GLB with cylindrical wrap texture
  //   waterbottle → procedural tumbler shape with wrap texture
  //   hoodie / longsleeve / cap → real product PHOTO as 3D billboard (photorealistic)
  // Only flat template zones (sleeve/neck) have no 3D equivalent.
  const effectiveSupports3D = supports3D && !isFlatZone;

  /* ── Cap dark-color mockup override ─────────────────
     The cap has no transparent-bg cutout PNG, so the
     multiply-tint approach can't be used. Instead, we
     swap the product's frontSrc to the black-cap PNG
     when a dark color is selected. */
  const displayProduct = useMemo(() => {
    if (selectedProduct.category === "cap") {
      const h = selectedColor.hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16) || 0;
      const g = parseInt(h.slice(2, 4), 16) || 0;
      const b = parseInt(h.slice(4, 6), 16) || 0;
      if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55) {
        return { ...selectedProduct, frontSrc: "/mockups/black-cap-front.png" };
      }
    }
    return selectedProduct;
  }, [selectedProduct, selectedColor.hex]);

  /* ── Per-product price (used in UI + cart serialisation) ── */
  const studioPrice = useMemo(
    () => isMug || isWaterBottle
      ? (settings.studioMugPrice || 799)
      : (settings.studioTshirtPrice || 1099),
    [isMug, isWaterBottle, settings.studioMugPrice, settings.studioTshirtPrice]
  );

  const selectedLayer = useMemo(
    () => layers.find(l => l.id === selectedLayerId) ?? null,
    [layers, selectedLayerId]
  );

  // Layers belonging to the current face (other-face layers stay in state, just hidden in this view).
  const currentFaceLayers = useMemo(
    () => layers.filter(l => (l.face ?? "front") === activeFace),
    [layers, activeFace]
  );
  const otherFaceCount = layers.length - currentFaceLayers.length;

  // Auto-hide the print-zone outline once a layer exists on the active face,
  // unless the user has explicitly toggled it on. The outline is only useful as a guide.
  const effectiveShowPrintZone = showPrintZone && currentFaceLayers.length === 0;

  /* ── Coord helpers ─────────────────────────────────── */
  const clientToSVG = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const r = pt.matrixTransform(ctm);
    return { x: r.x, y: r.y };
  }, []);

  /* ── Layer mutation helpers ────────────────────────── */
  const updateLayer = useCallback((id: string, mut: (l: Layer) => Layer, commit: boolean) => {
    const next = layers.map(l => (l.id === id ? mut(l) : l));
    if (commit) commitLayers(next); else setLayers(next);
  }, [layers, commitLayers]);

  const addLayer = useCallback((layer: Layer) => {
    // Stamp the layer with the face the user is currently viewing.
    const stamped: Layer = { ...layer, face: layer.face ?? activeFace };
    const next = [...layers, stamped];
    commitLayers(next);
    setSelectedLayerId(stamped.id);
  }, [layers, commitLayers, activeFace]);

  const removeLayer = useCallback((id: string) => {
    const next = layers.filter(l => l.id !== id);
    commitLayers(next);
    if (selectedLayerId === id) setSelectedLayerId(next[next.length - 1]?.id ?? null);
  }, [layers, selectedLayerId, commitLayers]);

  const moveLayer = useCallback((id: string, dir: -1 | 1) => {
    const idx = layers.findIndex(l => l.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= layers.length) return;
    const next = layers.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    commitLayers(next);
  }, [layers, commitLayers]);

  /* ── File upload — bulletproof: handles same-file re-pick, decode failures,
        oversized images (>10MB), unreadable files, and races. ───────────── */
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB. Please compress or resize the image first.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast({ title: "Couldn't read file", description: "The file may be corrupted. Try another image.", variant: "destructive" });
    reader.onload = async (e) => {
      const src = e.target?.result as string;
      if (!src || typeof src !== "string") {
        toast({ title: "Upload failed", description: "Couldn't read the image. Please try again.", variant: "destructive" });
        return;
      }
      const img = new Image();
      const ok = await new Promise<boolean>((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = src;
      });
      try { await img.decode?.(); } catch {}
      if (!ok || !img.naturalWidth || !img.naturalHeight) {
        toast({ title: "Image unreadable", description: "Try a different file (JPG/PNG/WebP).", variant: "destructive" });
        return;
      }

      // Smart auto-placement: scale the image to fit within the print zone
      // respecting both width and height, with a comfortable 85% fill.
      const currentPz = pzRef.current;
      const aspect = img.naturalWidth / Math.max(img.naturalHeight, 1);
      // At scale=1 the image fills the print zone WIDTH. Clamp so it also
      // fits within the print zone HEIGHT (tall images get scaled down).
      const maxScaleForHeight = (currentPz.h * aspect) / currentPz.w;
      const initialScale = Math.min(0.85, maxScaleForHeight);

      const layer: ImageLayer = {
        id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
        type: "image", src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
        visible: true, locked: false,
        transform: { x: 0, y: 0, scale: initialScale, rotation: 0, opacity: 1 },
        face: activeFaceRef.current,
      };

      // flushSync forces React to flush state updates synchronously so the
      // image appears immediately — critical on mobile where async callbacks
      // may otherwise defer rendering until the next user interaction.
      flushSync(() => {
        commitLayers([...layersRef.current, layer]);
        setSelectedLayerId(layer.id);
        setActiveTab("layers");
      });
      toast({ title: "✓ Image added", description: "Drag to reposition · Pinch or scroll to resize." });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  /* ── Background removal ────────────────────────────────────────────
   * Strategy (server-first, browser-fallback):
   *   1. POST to /api/remove-bg (uses remove.bg API key from admin settings).
   *      Fast, high quality.  Returns structured error codes.
   *   2. If server returns 503 "no_api_key" → fall back to in-browser ONNX
   *      model (@imgly/background-removal, ~30 MB, cached in IndexedDB).
   *      Free, runs locally, slower on first run.
   * Distinct toasts for: no key, quota, rate-limit, too large, success.
   ─────────────────────────────────────────────────────────────────── */
  const handleRemoveBg = async () => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    setIsRemoving(true);

    /* Helper — apply a new data-URL to the selected image layer */
    const applyResult = async (dataUrl: string) => {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      updateLayer(selectedLayer.id, l => l.type === "image"
        ? { ...l, src: dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
        : l, true);
    };

    /* ── Step 1: Try server (remove.bg API) ── */
    try {
      toast({ title: "Removing background…", description: "Processing via server…" });
      const r = await fetch(getApiUrl("/api/remove-bg"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedLayer.src }),
      });
      const json = await r.json().catch(() => ({}));

      if (r.ok) {
        await applyResult(json.result);
        toast({ title: "✨ Background removed", description: "Clean cutout ready." });
        setIsRemoving(false);
        return;
      }

      /* Specific error codes — decide whether to fall through to browser or stop */
      if (json.error === "rate_limited") {
        toast({ title: "Too many requests", description: "You've reached the removal limit. Please wait an hour and try again.", variant: "destructive" });
        setIsRemoving(false);
        return;
      }
      if (json.error === "image_too_large") {
        toast({ title: "Image too large", description: "Please reduce the image below 10 MB. Try HD-Upscale after resizing.", variant: "destructive" });
        setIsRemoving(false);
        return;
      }
      if (json.error === "no_api_key") {
        toast({
          title: "Background removal isn't configured",
          description: "Admin needs to add a remove.bg API key in Settings → Design Studio. Trying in-browser AI as fallback…",
        });
        /* Fall through to browser fallback */
      } else if (json.error === "quota_exceeded") {
        toast({ title: "Remove.bg quota exceeded", description: "The monthly quota is exhausted. Switching to in-browser processing…" });
        /* Fall through to browser fallback */
      } else {
        /* Unexpected server error — still try browser as a courtesy */
        console.warn("[bg-removal] server error, trying browser fallback", r.status, json);
      }
      /* All handled or unexpected errors → fall through to browser below */
    } catch (networkErr) {
      /* Network-level failure (server unreachable) — try browser */
      console.warn("[bg-removal] server unreachable, trying browser", networkErr);
    }

    /* ── Step 2: In-browser ONNX fallback (@imgly/background-removal) ── */
    try {
      toast({
        title: "Switching to in-browser AI…",
        description: "First run downloads a ~30 MB model — stays cached after.",
      });
      const { removeBackground } = await import("@imgly/background-removal");
      const blob = await removeBackground(selectedLayer.src, {
        publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
        output: { format: "image/png", quality: 0.9 },
      });
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await applyResult(dataUrl);
      toast({ title: "✨ Background removed", description: "Processed in-browser — transparent PNG ready." });
    } catch (browserErr) {
      console.error("[bg-removal] browser fallback failed", browserErr);
      const isNetworkErr = browserErr instanceof TypeError && browserErr.message.includes("fetch");
      toast({
        title: "Background removal unavailable",
        description: isNetworkErr
          ? "The AI model couldn't be downloaded. Ask your admin to add a remove.bg API key in Settings."
          : "Both server and in-browser removal failed. Try a different image.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  /* ── HD Upscale — 2× resolution with bicubic + unsharp-mask sharpening.
        Runs in-browser using canvas; no server cost. Helps low-res photos
        print sharper at large sizes. */
  const [isUpscaling, setIsUpscaling] = useState(false);
  const handleUpscale = async () => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    setIsUpscaling(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = selectedLayer.src; });
      try { await img.decode?.(); } catch {}

      // Cap output at 4096 to stay browser-safe
      const maxOut = 4096;
      const scale = Math.min(2, maxOut / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);

      // Two-pass bicubic-ish upscale via intermediate canvas (browser implementation
      // varies, but enabling imageSmoothingQuality:"high" gives bicubic on most engines)
      const c1 = document.createElement("canvas");
      c1.width = w; c1.height = h;
      const ctx1 = c1.getContext("2d")!;
      ctx1.imageSmoothingEnabled = true;
      ctx1.imageSmoothingQuality = "high";
      ctx1.drawImage(img, 0, 0, w, h);

      // Unsharp mask: blur copy, subtract from original to find edges, add back to sharpen
      const c2 = document.createElement("canvas");
      c2.width = w; c2.height = h;
      const ctx2 = c2.getContext("2d")!;
      (ctx2 as any).filter = "blur(1.2px)";
      ctx2.drawImage(c1, 0, 0);
      (ctx2 as any).filter = "none";

      const orig = ctx1.getImageData(0, 0, w, h);
      const blur = ctx2.getImageData(0, 0, w, h);
      const amount = 0.6; // sharpening strength
      for (let i = 0; i < orig.data.length; i += 4) {
        for (let k = 0; k < 3; k++) {
          const o = orig.data[i + k], b = blur.data[i + k];
          const v = o + amount * (o - b);
          orig.data[i + k] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
      ctx1.putImageData(orig, 0, 0);
      const dataUrl = c1.toDataURL("image/png");
      const newImg = new Image();
      await new Promise<void>((res, rej) => { newImg.onload = () => res(); newImg.onerror = rej; newImg.src = dataUrl; });
      updateLayer(selectedLayer.id, l => l.type === "image"
        ? { ...l, src: dataUrl, naturalW: newImg.naturalWidth, naturalH: newImg.naturalHeight }
        : l, true);
      toast({ title: "✨ Upscaled to HD", description: `Now ${w}×${h}px — sharper for large prints.` });
    } catch (err) {
      console.error("[upscale]", err);
      toast({ title: "Upscale failed", description: "Try a smaller image or different format.", variant: "destructive" });
    } finally {
      setIsUpscaling(false);
    }
  };

  /* ── Multi-pointer interaction (drag + pinch + rotate) ──
   *
   * Built on @use-gesture/react. The library handles the cross-browser
   * mess (pointer capture, touch-cancel, stylus/finger combos, lifted
   * fingers mid-pinch, fast double-taps, mouse wheel as pinch on
   * desktop) so we only have to express the intent: "drag moves the
   * layer; pinch scales+rotates+pans it."
   *
   * The one piece of bespoke logic kept is the per-pointer-down hit
   * test on `event.target` — that's how we know which layer the user
   * grabbed. Without it, dragging the white background would grab
   * whatever layer was selected last, which feels broken.
   */
  const gestureRef = useRef<
    | { mode: "drag"; layerId: string; startSvg: { x: number; y: number }; startT: Transform }
    | { mode: "pinch"; layerId: string; startMid: { x: number; y: number }; startT: Transform }
    | null
  >(null);

  const SNAP_THRESHOLD = 6; // svg units

  const bindCanvasGestures = useGesture(
    {
      onDragStart: ({ event, xy: [cx, cy] }) => {
        const target = event.target as Element;
        const layerId = target.getAttribute?.("data-layer-id");
        if (layerId) {
          const layer = layersRef.current.find(l => l.id === layerId);
          if (!layer || layer.locked) { gestureRef.current = null; return; }
          setSelectedLayerId(layerId);
          selectedLayerIdRef.current = layerId;
          gestureRef.current = {
            mode: "drag",
            layerId,
            startSvg: clientToSVG(cx, cy),
            startT: { ...layer.transform },
          };
        } else {
          // Tapped empty canvas → deselect
          setSelectedLayerId(null);
          selectedLayerIdRef.current = null;
          gestureRef.current = null;
        }
      },
      onDrag: ({ xy: [cx, cy], pinching, cancel }) => {
        if (pinching) { cancel(); return; }
        const g = gestureRef.current;
        if (!g || g.mode !== "drag") return;
        const cur = clientToSVG(cx, cy);
        let nx = g.startT.x + (cur.x - g.startSvg.x);
        let ny = g.startT.y + (cur.y - g.startSvg.y);
        const showV = Math.abs(nx) < SNAP_THRESHOLD;
        const showH = Math.abs(ny) < SNAP_THRESHOLD;
        if (showV) nx = 0;
        if (showH) ny = 0;
        setSnapGuides({ v: showV, h: showH });
        setLayers(prev => prev.map(l => l.id === g.layerId ? { ...l, transform: { ...l.transform, x: nx, y: ny } } : l));
      },
      onDragEnd: () => {
        if (gestureRef.current?.mode === "drag") {
          commitLayers(layersRef.current);
        }
        if (gestureRef.current?.mode === "drag") gestureRef.current = null;
        setSnapGuides({ v: false, h: false });
      },
      onPinchStart: ({ event, origin: [ox, oy] }) => {
        const target = event.target as Element;
        const hitId = target.getAttribute?.("data-layer-id") ?? null;
        const targetId = hitId ?? selectedLayerIdRef.current;
        if (!targetId) return;
        const layer = layersRef.current.find(l => l.id === targetId);
        if (!layer || layer.locked) return;
        if (selectedLayerIdRef.current !== targetId) {
          setSelectedLayerId(targetId);
          selectedLayerIdRef.current = targetId;
        }
        gestureRef.current = {
          mode: "pinch",
          layerId: targetId,
          startMid: clientToSVG(ox, oy),
          startT: { ...layer.transform },
        };
      },
      onPinch: ({ origin: [ox, oy], offset: [scaleOffset, angleOffset] }) => {
        const g = gestureRef.current;
        if (!g || g.mode !== "pinch") return;
        const mid = clientToSVG(ox, oy);
        const scale = Math.max(0.1, Math.min(5, g.startT.scale * scaleOffset));
        const rotation = g.startT.rotation + angleOffset;
        const x = g.startT.x + (mid.x - g.startMid.x);
        const y = g.startT.y + (mid.y - g.startMid.y);
        setLayers(prev => prev.map(l => l.id === g.layerId ? { ...l, transform: { ...l.transform, scale, rotation, x, y } } : l));
      },
      onPinchEnd: () => {
        if (gestureRef.current?.mode === "pinch") {
          commitLayers(layersRef.current);
          gestureRef.current = null;
        }
      },
    },
    {
      drag: { filterTaps: true, pointer: { touch: true }, threshold: 1 },
      // offset is multiplicative for scale (starts at 1) and additive degrees for angle (starts at 0)
      pinch: { scaleBounds: { min: 0.1, max: 5 }, rubberband: true, from: () => [1, 0] },
      eventOptions: { passive: false },
    }
  );

  /* ── Keyboard shortcuts: undo/redo, delete ─────────── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (meta && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedLayerId
        && document.activeElement?.tagName !== "INPUT"
        && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault(); removeLayer(selectedLayerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedLayerId, removeLayer]);

  /* ── Compute layer SVG geometry ────────────────────── */
  const layerGeom = (l: Layer) => {
    const cx = pz.x + pz.w / 2 + l.transform.x;
    const cy = pz.y + pz.h / 2 + l.transform.y;
    if (l.type === "image") {
      const aspect = l.naturalW / Math.max(l.naturalH, 1);
      const w = pz.w * l.transform.scale;
      const h = w / aspect;
      return { cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
    }
    // text — approximate bounding box from font metrics
    const w = (l.text.length * l.fontSize * 0.55) * l.transform.scale;
    const h = l.fontSize * 1.2 * l.transform.scale;
    return { cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
  };

  /* ── Add to cart ───────────────────────────────────── */
  const handleAddToCart = useCallback(async () => {
    if (layers.length === 0) {
      toast({ title: "No design", description: "Add an image or text layer first.", variant: "destructive" });
      return;
    }
    setIsAddingToCart(true);
    try {
      const frontPZ         = isMugProduct ? MUG_SIDE_PZ : selectedProduct.printZone;
      const backPZ          = isMugProduct ? MUG_SIDE_PZ : (selectedProduct.printZoneBack ?? selectedProduct.printZone);
      const frontLayers     = layers.filter(l => (l.face ?? "front") === "front")        as unknown as ComposerLayer[];
      const backLayers      = layers.filter(l => (l.face ?? "front") === "back")         as unknown as ComposerLayer[];
      const leftSleeveLayers = layers.filter(l => l.face === "left-sleeve")              as unknown as ComposerLayer[];
      const rightSleeveLayers = layers.filter(l => l.face === "right-sleeve")            as unknown as ComposerLayer[];
      const neckLabelLayers  = layers.filter(l => l.face === "neck-label")               as unknown as ComposerLayer[];
      const imageCache  = new Map<string, HTMLImageElement>();

      // 0. Upload ORIGINAL full-resolution image layers to object storage
      //    so the admin can download print-ready files later. We do this
      //    BEFORE compositing so the admin gets the customer's actual
      //    uploaded photos at full resolution, not the downscaled mockup.
      //    Failures here are non-fatal: cart still works without uploads.
      const originalAssets: OriginalAsset[] = [];
      const originalAssetUrls: string[] = [];
      const imageLayers = layers.filter(l => l.type === "image" && l.visible);
      for (const layer of imageLayers) {
        try {
          const imgLayer = layer as ImageLayer;
          const src = imgLayer.src;
          if (!src.startsWith("data:")) continue; // skip already-uploaded
          const blob = await (await fetch(src)).blob();
          const mime = blob.type || "image/png";
          const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
          // Sanitize layer name for use as a filename
          const safeName = (imgLayer.name || "design").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
          const filename = `${safeName}-${Date.now()}.${ext}`;
          const reqRes = await fetch(getApiUrl("/api/storage/uploads/request-url"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: filename,
              size: blob.size,
              contentType: mime,
            }),
          });
          if (!reqRes.ok) continue;
          const { uploadURL, objectPath } = await reqRes.json();
          const putRes = await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": mime },
            body: blob,
          });
          if (putRes.ok && objectPath) {
            const asset: OriginalAsset = {
              objectPath,
              filename,
              mime,
              bytes: blob.size,
              width: imgLayer.naturalW,
              height: imgLayer.naturalH,
            };
            originalAssets.push(asset);
            originalAssetUrls.push(objectPath);
          }
        } catch (uploadErr) {
          console.warn("[upload-original]", uploadErr);
          /* swallow — cart should still work even if cloud upload is down */
        }
      }

      // 1. Full garment + design composite → cart thumbnail (imageUrl)
      //    Uses the white-cutout PNG (or cap dark PNG override) so tinting
      //    matches the 2D editor exactly.
      const garmentBase = BASE_BY_CATEGORY[selectedProduct.category];
      const garmentSrc  = garmentBase?.front ?? displayProduct.frontSrc;
      const mockupCanvas = document.createElement("canvas");
      await composeGarmentMockup({
        canvas: mockupCanvas,
        garmentSrc,
        garmentColor: selectedColor.hex,
        printZone: frontPZ,
        layers: frontLayers,
        outSize: 400,
        imageCache,
      });
      const mockupUrl = mockupCanvas.toDataURL("image/webp", 0.8);

      // 2. Design-only UV texture (transparent bg) — used by CartViewer3D.
      //    Mug uses wide 2048×768 to match the studio live preview (full 360° wrap band).
      //    Garments use square 1024×1024 for front/back panel UVs.
      const frontTexCanvas = document.createElement("canvas");
      if (isMug) {
        await composeLayers({
          canvas: frontTexCanvas,
          baseHeight: selectedProduct.baseHeight,
          printZone: frontPZ,
          layers: frontLayers,
          garmentColor: null,
          outW: 2048,
          outH: 768,
          imageCache,
          clipToPrintZone: true,
          blendMode: "multiply",
        });
      } else {
        await composeDesignTexture({
          canvas: frontTexCanvas,
          printZone: frontPZ,
          layers: frontLayers,
          outSize: 1024,
          imageCache,
        });
      }
      const frontTexUrl = frontTexCanvas.toDataURL("image/webp", 0.85);

      // 3. Back-face design texture (garments only — mug has no back face)
      let backTexUrl: string | undefined;
      if (!isMug && backLayers.length > 0) {
        const backTexCanvas = document.createElement("canvas");
        await composeDesignTexture({
          canvas: backTexCanvas,
          printZone: backPZ,
          layers: backLayers,
          outSize: 1024,
          imageCache,
        });
        backTexUrl = backTexCanvas.toDataURL("image/webp", 0.85);
      }

      // 4. Sleeve & neck-label design textures (apparel with flat zones)
      let leftSleeveTexUrl: string | undefined;
      let rightSleeveTexUrl: string | undefined;
      let neckLabelTexUrl: string | undefined;
      if (isZoneTabs) {
        const { SLEEVE_PZ, NECK_LABEL_PZ } = await import("./design-studio/mockups");
        if (leftSleeveLayers.length > 0) {
          const c = document.createElement("canvas");
          await composeDesignTexture({ canvas: c, printZone: SLEEVE_PZ, layers: leftSleeveLayers, outSize: 1024, imageCache });
          leftSleeveTexUrl = c.toDataURL("image/webp", 0.85);
        }
        if (rightSleeveLayers.length > 0) {
          const c = document.createElement("canvas");
          await composeDesignTexture({ canvas: c, printZone: SLEEVE_PZ, layers: rightSleeveLayers, outSize: 1024, imageCache });
          rightSleeveTexUrl = c.toDataURL("image/webp", 0.85);
        }
        if (neckLabelLayers.length > 0) {
          const c = document.createElement("canvas");
          await composeDesignTexture({ canvas: c, printZone: NECK_LABEL_PZ, layers: neckLabelLayers, outSize: 1024, imageCache });
          neckLabelTexUrl = c.toDataURL("image/webp", 0.85);
        }
      }

      const displayPrice = studioPrice;

      // Save full session for cart re-edit — MUST match the studio's
      // DraftPayload format exactly (version, color (not selectedColor),
      // size (not selectedSize)) so the restore effect accepts it.
      const sessionId = Date.now().toString(36);
      try {
        localStorage.setItem(`studio_session_${sessionId}`, JSON.stringify({
          version: DRAFT_VERSION,
          layers,
          productId: selectedProduct.id,
          color: selectedColor,
          size: selectedSize,
          savedAt: Date.now(),
        }));
      } catch { /* quota exceeded — re-edit won't be available but cart works fine */ }

      addToCart({
        productId: 0,
        name: `Custom ${selectedProduct.name}`,
        price: displayPrice,
        quantity,
        size: isMug || isCap || isWaterBottle ? undefined : selectedSize,
        color: selectedColor.name,
        imageUrl: mockupUrl,
        customImages: [
          frontTexUrl,
          ...(backTexUrl ? [backTexUrl] : []),
          ...(leftSleeveTexUrl ? [leftSleeveTexUrl] : []),
          ...(rightSleeveTexUrl ? [rightSleeveTexUrl] : []),
          ...(neckLabelTexUrl ? [neckLabelTexUrl] : []),
        ],
        originalAssetUrls,
        originalAssets,
        customNote: JSON.stringify({
          studioDesign: true,
          sessionId,
          product: selectedProduct.name,
          category: selectedProduct.category,
          color: selectedColor.name,
          colorHex: selectedColor.hex,
          size: selectedSize,
          layerCount: layers.length,
          frontLayerCount: frontLayers.length,
          backLayerCount: backLayers.length,
          leftSleeveLayerCount: leftSleeveLayers.length,
          rightSleeveLayerCount: rightSleeveLayers.length,
          neckLabelLayerCount: neckLabelLayers.length,
          // Garment provenance — used by useCartItemPreview fallback composer
          mockupSrc: garmentSrc,
          printZone: frontPZ,
          printZoneBack: selectedProduct.printZoneBack ?? null,
          // Print-ready originals — admin downloads these to fulfill the order.
          originalAssets,
          originalAssetUrls,
        }),
      });

      toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready.` });
      // Draft is now saved per-session — clear main draft key so a fresh visit starts clean.
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false);
      setSaveStatus("idle");
      setTimeout(() => navigate("/cart"), 800);
    } finally {
      setIsAddingToCart(false);
    }
  }, [layers, selectedProduct, displayProduct, selectedColor, selectedSize, quantity, isMug, isCap, isWaterBottle, isZoneTabs, studioPrice, pz, addToCart, toast, navigate, settings]);

  /* ── Studio color palette — per product category ───── */
  const parseColors = (raw: string) => {
    try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr as { name: string; hex: string }[]; } catch {}
    return null;
  };
  const DEFAULT_TSHIRT_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F8F7F4" }, { name: "Black", hex: "#1a1a1a" },
    { name: "Navy", hex: "#1e3a5f" }, { name: "Maroon", hex: "#7f1d1d" },
    { name: "Olive", hex: "#4a5240" }, { name: "Sky Blue", hex: "#0ea5e9" },
    { name: "Grey", hex: "#6b7280" }, { name: "Red", hex: "#dc2626" },
    { name: "Orange", hex: "#E85D04" }, { name: "Yellow", hex: "#eab308" },
    { name: "Green", hex: "#16a34a" }, { name: "Purple", hex: "#7c3aed" },
  ];
  const DEFAULT_MUG_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F5F5F5" }, { name: "Black", hex: "#1C1917" },
  ];
  const DEFAULT_CAP_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F5F2EC" }, { name: "Black", hex: "#1a1a1a" },
  ];
  const DEFAULT_WATERBOTTLE_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F4F3F1" }, { name: "Black", hex: "#1C1917" },
    { name: "Navy", hex: "#1e3a5f" }, { name: "Forest", hex: "#166534" },
    { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Red", hex: "#dc2626" },
    { name: "Pink", hex: "#f472b6" }, { name: "Teal", hex: "#0f766e" },
  ];
  const studioColors = isMug
    ? (parseColors(settings.studioMugColors) ?? DEFAULT_MUG_COLORS)
    : isCap ? DEFAULT_CAP_COLORS
    : isWaterBottle ? DEFAULT_WATERBOTTLE_COLORS
    : (parseColors(settings.studioTshirtColors) ?? DEFAULT_TSHIRT_COLORS);

  /* ── Selected layer: corner handles for resize ─────── */
  const handleResizeDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    if (!selectedLayer || selectedLayer.locked) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const startPt = clientToSVG(e.clientX, e.clientY);
    const startT = { ...selectedLayer.transform };
    const cx = pz.x + pz.w / 2 + startT.x;
    const cy = pz.y + pz.h / 2 + startT.y;
    const startDist = Math.hypot(startPt.x - cx, startPt.y - cy) || 1;

    const onMove = (me: PointerEvent) => {
      const pt = clientToSVG(me.clientX, me.clientY);
      const newDist = Math.hypot(pt.x - cx, pt.y - cy);
      const next = Math.max(0.1, Math.min(5, startT.scale * (newDist / startDist)));
      setLayers(prev => prev.map(l => l.id === selectedLayer.id
        ? { ...l, transform: { ...l.transform, scale: next } } : l));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      // commit
      setLayers(curr => { commitLayers(curr); return curr; });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [selectedLayer, clientToSVG, pz, commitLayers]);

  /* ── Renderable layer geometry list (memo) ─────────── */
  const layersRender = layers.map(l => ({ layer: l, geom: layerGeom(l) }));
  const selGeom = selectedLayer ? layerGeom(selectedLayer) : null;
  // Rotated handle positions for the selected layer
  const rotatedCorners = useMemo(() => {
    if (!selectedLayer || !selGeom) return [];
    const { cx, cy, x, y, w, h } = selGeom;
    const rad = (selectedLayer.transform.rotation * Math.PI) / 180;
    const corners = [
      { key: "nw", x, y },
      { key: "ne", x: x + w, y },
      { key: "sw", x, y: y + h },
      { key: "se", x: x + w, y: y + h },
    ];
    return corners.map(c => {
      const dx = c.x - cx; const dy = c.y - cy;
      return {
        key: c.key,
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad),
      };
    });
  }, [selectedLayer, selGeom]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F3F0" }}>
      <SEOHead
        title="Design Studio — TryNex Lifestyle"
        description="Design your own custom apparel and accessories. Upload artwork or add text, position it live, and add to cart instantly."
        canonical="/design-studio"
      />
      <Navbar />

      {/*
        Spacer reserves vertical space for the fixed AnnouncementBar + Navbar
        so the sticky page header below can use `top` without also stacking a
        margin (avoids double-offset on mobile when the announcement bar is
        visible).
      */}
      <div
        aria-hidden
        style={{ height: "calc(var(--announcement-height, 0px) + 4.25rem)" }}
      />

      {/* Page header */}
      <div
        className="border-b border-gray-200 sticky z-30"
        style={{
          background: "white",
          top: "calc(var(--announcement-height, 0px) + 4.25rem)",
        }}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-shrink">
            <h1 className="font-display font-black text-base sm:text-xl text-gray-900 truncate">Design Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              <span className="hidden sm:inline">Designing: </span>
              <strong className="text-gray-700">{selectedProduct.name}</strong>
              <span className="text-gray-400"> · {
                isMugProduct
                  ? (mugMode === "side1" ? "Left Side" : mugMode === "side2" ? "Right Side" : "Full Wrap")
                  : (activeZoneConfig?.label ?? activeFace)
              }</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Saved indicator */}
            {(saveStatus !== "idle" || hasDraft) && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                style={{ background: saveStatus === "saving" ? "#f3f4f6" : "#ecfdf5", color: saveStatus === "saving" ? "#6b7280" : "#047857" }}
                data-testid="draft-status">
                {saveStatus === "saving"
                  ? <><CloudUpload className="w-3 h-3 animate-pulse" /> Saving…</>
                  : <><Check className="w-3 h-3" /> Saved</>}
              </div>
            )}
            {layers.length > 0 && (
              <button
                onClick={clearDraft}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:text-red-600 transition-colors"
                style={{ background: "#f3f4f6" }}
                title="Clear all layers and draft"
                data-testid="clear-draft"
              >
                <Trash2 className="w-3 h-3" /> Clear All
              </button>
            )}
            {/* Undo / Redo — hidden on mobile to save space */}
            <button onClick={undo} disabled={!canUndo}
              className="hidden sm:flex p-2 rounded-xl text-gray-600 disabled:opacity-30"
              style={{ background: "#f3f4f6" }} title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={!canRedo}
              className="hidden sm:flex p-2 rounded-xl text-gray-600 disabled:opacity-30"
              style={{ background: "#f3f4f6" }} title="Redo (Ctrl+Y)">
              <Redo2 className="w-4 h-4" />
            </button>
            {/* 2D / 3D toggle — hidden on mobile (shown below product tabs instead) */}
            {effectiveSupports3D && (
              <div className="hidden sm:flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb", background: "white" }} data-testid="view-mode-toggle">
                <button
                  onClick={() => setViewMode("2d")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors"
                  style={{ background: viewMode === "2d" ? "#fff4ee" : "white", color: viewMode === "2d" ? "#E85D04" : "#6b7280" }}
                  title="2D editor"
                  data-testid="view-mode-2d"
                >
                  <Image2D className="w-3.5 h-3.5" /> 2D
                </button>
                <button
                  onClick={() => setViewMode("3d")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition-colors"
                  style={{ background: viewMode === "3d" ? "#fff4ee" : "white", color: viewMode === "3d" ? "#E85D04" : "#6b7280", borderLeft: "1px solid #e5e7eb" }}
                  title="Realtime 3D preview"
                  data-testid="view-mode-3d"
                >
                  <Box className="w-3.5 h-3.5" /> 3D
                </button>
              </div>
            )}
            <button
              onClick={() => setShowPrintZone(v => !v)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: showPrintZone ? "#fff4ee" : "#f3f4f6", color: showPrintZone ? "#E85D04" : "#6b7280" }}
            >
              {showPrintZone ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Print Zone
            </button>
            {/* Add to Cart — compact on mobile (icon only + short label) */}
            <motion.button
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.35)" }}
            >
              {isAddingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              <span className="hidden sm:inline">Add to Cart</span>
              <span className="sm:hidden">Cart</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ═══════ LEFT: MOCKUP CANVAS ═══════ */}
          <div className="flex-1 min-w-0">
            {/* Mobile 2D/3D toggle — shown only on small screens above mockup */}
            {effectiveSupports3D && (
              <div className="flex sm:hidden items-center justify-between mb-3">
                <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb", background: "white" }}>
                  <button
                    onClick={() => setViewMode("2d")}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-colors"
                    style={{ background: viewMode === "2d" ? "#fff4ee" : "white", color: viewMode === "2d" ? "#E85D04" : "#6b7280" }}
                  >
                    <Image2D className="w-3.5 h-3.5" /> 2D
                  </button>
                  <button
                    onClick={() => setViewMode("3d")}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-colors"
                    style={{ background: viewMode === "3d" ? "#fff4ee" : "white", color: viewMode === "3d" ? "#E85D04" : "#6b7280", borderLeft: "1px solid #e5e7eb" }}
                  >
                    <Box className="w-3.5 h-3.5" /> 3D
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={undo} disabled={!canUndo}
                    className="p-2 rounded-xl text-gray-500 disabled:opacity-30"
                    style={{ background: "#f3f4f6" }} title="Undo">
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={redo} disabled={!canRedo}
                    className="p-2 rounded-xl text-gray-500 disabled:opacity-30"
                    style={{ background: "#f3f4f6" }} title="Redo">
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Product selector bar */}
            <div className="flex items-center gap-2 mb-4">
              {/* Current product card */}
              <button
                onClick={() => { setShowProductPicker(true); setProductSearch(""); setProductPickerCategory("all"); }}
                className="flex items-center gap-3 flex-1 min-w-0 px-3.5 py-2.5 rounded-2xl transition-all group"
                style={{
                  background: "white",
                  border: "1.5px solid #e5e7eb",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              >
                <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-gray-50 flex items-center justify-center"
                  style={{ border: "1px solid #f0efee" }}>
                  <img
                    src={displayProduct.frontSrc}
                    alt={selectedProduct.name}
                    className="w-full h-full object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-xs font-black text-gray-800 truncate">{selectedProduct.name}</div>
                  <div className="text-[10px] text-gray-400 font-semibold">{selectedProduct.description}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold text-orange-500 group-hover:text-orange-600">
                  <Package className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Change</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </button>
            </div>

            {/* Zone switcher — hidden in 3D mode.
                Apparel (tshirt/longsleeve/hoodie): shows 5 zone tabs (Front, Back,
                Left Sleeve, Right Sleeve, Neck Label) in a horizontally scrollable row.
                Mug: shows Side 1 / Side 2 / Full Wrap (handled separately below). */}
            {isZoneTabs && viewMode === "2d" && (
              <div className="mb-3" data-testid="zone-switcher">
                {/* Scrollable zone tab row */}
                <div
                  className="flex gap-1.5 overflow-x-auto pb-1"
                  style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
                >
                  {apparelZones.map(zone => {
                    const isActive = activeFace === zone.face;
                    const zoneLayerCount = layers.filter(l => (l.face ?? "front") === zone.face).length;
                    return (
                      <button
                        key={zone.face}
                        onClick={() => setActiveFace(zone.face)}
                        className="relative shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{
                          background: isActive ? "linear-gradient(135deg,#1f2937,#374151)" : "white",
                          color: isActive ? "white" : "#374151",
                          border: isActive ? "none" : "1.5px solid #e5e7eb",
                          boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                        }}
                        data-testid={`zone-${zone.face}`}
                        title={zone.label}
                      >
                        {zone.shortLabel}
                        {/* Layer badge */}
                        {zoneLayerCount > 0 && !isActive && (
                          <span
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                            style={{ background: "#E85D04", boxShadow: "0 1px 4px rgba(232,93,4,0.4)" }}
                          >
                            {zoneLayerCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {/* Dimensions hint for flat zones */}
                {isFlatZone && activeZoneConfig && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Ruler className="w-3 h-3 text-gray-400 shrink-0" />
                    <span className="text-[10px] font-semibold text-gray-400">
                      Print area: {activeZoneConfig.pxDimensions}
                    </span>
                  </div>
                )}
                {/* Copy front → back helper */}
                {activeFace === "back" && currentFaceLayers.length === 0 && (() => {
                  const frontLayers = layers.filter(l => (l.face ?? "front") === "front");
                  if (frontLayers.length === 0) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        const cloned = frontLayers.map(l => ({
                          ...l,
                          id: `${l.id}-back-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                          face: "back" as Face,
                        }));
                        commitLayers([...layers, ...cloned]);
                      }}
                      className="mt-1.5 px-3 py-1.5 text-[11px] font-bold rounded-xl transition-all"
                      style={{
                        background: "linear-gradient(135deg,#E85D04,#F48C06)",
                        color: "white",
                        boxShadow: "0 4px 12px rgba(232,93,4,0.25)",
                      }}
                      data-testid="mirror-front-to-back"
                    >
                      ↻ Apply front design to back
                    </button>
                  );
                })()}
              </div>
            )}

            {/* Mug-only print mode selector — replaces apparel Front/Back tabs.
                Side 1 / Side 2 → independent print panels (front + back faces);
                Wrap            → continuous artwork around the entire mug body.
                Hidden in 3D mode (use orbit camera instead). */}
            {isMugProduct && viewMode === "2d" && (
              <div className="flex gap-1.5 mb-3" data-testid="mug-mode-switcher">
                {([
                  { v: "side1", label: "Left Side" },
                  { v: "side2", label: "Right Side" },
                  { v: "wrap",  label: "Full Wrap" },
                ] as const).map(({ v, label }) => (
                  <button key={v}
                    onClick={() => setMugMode(v)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: mugMode === v ? "linear-gradient(135deg,#1f2937,#374151)" : "white",
                      color: mugMode === v ? "white" : "#374151",
                      border: mugMode === v ? "none" : "1.5px solid #e5e7eb",
                      boxShadow: mugMode === v ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                    }}
                    data-testid={`mug-mode-${v}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Garment color swatches + label */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Color: <span className="text-gray-600 normal-case tracking-normal font-bold">{selectedColor.name}</span>
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {studioColors.map(c => {
                  const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button key={c.hex} title={c.name}
                      onClick={() => setSelectedColor({ name: c.name, hex: c.hex })}
                      className="w-8 h-8 rounded-xl border-2 transition-all hover:scale-110 relative"
                      style={{
                        background: c.hex,
                        borderColor: isSelected ? "#E85D04" : (c.hex.toUpperCase() === "#FFFFFF" || c.hex === "#F5F5F5" || c.hex === "#F5F2EC" || c.hex === "#F4F3F1" ? "#d1d5db" : c.hex),
                        boxShadow: isSelected ? "0 0 0 3px rgba(232,93,4,0.35), 0 2px 6px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.10)",
                      }}
                    >
                      {isSelected && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" style={{ color: (0.299 * parseInt(c.hex.slice(1,3),16) + 0.587 * parseInt(c.hex.slice(3,5),16) + 0.114 * parseInt(c.hex.slice(5,7),16)) > 128 ? "#333" : "white" }} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mockup area */}
            <div
              className="relative rounded-3xl overflow-hidden select-none"
              style={{
                background: "radial-gradient(ellipse at 50% 40%, #F2F0ED 0%, #E8E5E1 50%, #DDDAD5 100%)",
                border: "1px solid #d8d5d0",
                boxShadow: "inset 0 2px 20px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.08)",
                isolation: "isolate",
              }}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={(e) => e.preventDefault()}
            >
              <div
                className="relative w-full"
                style={{ aspectRatio: `${selectedProduct.aspect}`, touchAction: "none" }}
              >
                {viewMode === "3d" && effectiveSupports3D ? (
                  <div className="absolute inset-0" data-testid="viewer-3d">
                    <Suspense fallback={
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading 3D preview…
                      </div>
                    }>
                      <ProductViewer3D
                        product={displayProduct}
                        garmentColor={selectedColor.hex}
                        front={{
                          layers: layers.filter(l => (l.face ?? "front") === "front") as unknown as ComposerLayer[],
                          printZone: isMugProduct ? MUG_SIDE_PZ : selectedProduct.printZone,
                          baseHeight: selectedProduct.baseHeight,
                        }}
                        back={supportsBack ? {
                          layers: layers.filter(l => (l.face ?? "front") === "back") as unknown as ComposerLayer[],
                          printZone: isMugProduct ? MUG_SIDE_PZ : (selectedProduct.printZoneBack ?? selectedProduct.printZone),
                          baseHeight: selectedProduct.baseHeight,
                        } : undefined}
                        activeFace={activeFace}
                        isWrapMode={isWrapMode}
                      />
                    </Suspense>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-bold text-white pointer-events-none"
                      style={{ background: "rgba(0,0,0,0.6)" }}>
                      Drag to rotate · Scroll to zoom
                    </div>
                    {layers.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center px-6 py-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.88)", border: "2px dashed rgba(232,93,4,0.35)" }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: "linear-gradient(135deg,#fff4ee,#ffe8d4)" }}>
                            <Upload className="w-5 h-5 text-orange-500" />
                          </div>
                          <p className="font-black text-gray-800 text-sm mb-0.5">No design yet</p>
                          <p className="text-xs text-gray-500">Switch to 2D to add layers →</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <>
                {/* Floating face label inside the canvas — gives a clear, premium
                    "you are looking at the FRONT" indicator and animates between
                    faces. Doesn't affect interaction (pointer-events: none). */}
                {(supportsBack || isZoneTabs) && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={isMugProduct ? mugMode : activeFace}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest pointer-events-none z-10"
                      style={{ background: "rgba(17,24,39,0.88)", color: "white", letterSpacing: "0.12em" }}
                    >
                      {isMugProduct
                        ? (mugMode === "side1" ? "Left Side" : mugMode === "side2" ? "Right Side" : "Full Wrap")
                        : (activeZoneConfig?.label ?? (activeFace === "front" ? "Front" : "Back"))}
                    </motion.div>
                  </AnimatePresence>
                )}
                <AnimatePresence mode="wait" initial={false}>
                <motion.svg
                  key={`${selectedProduct.id}-${isMugProduct ? mugMode : activeFace}`}
                  ref={svgRef}
                  viewBox={selectedProduct.viewBox}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: "none", userSelect: "none" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeInOut" }}
                  {...(bindCanvasGestures() as Record<string, unknown>)}
                >
                  {isFlatZone && activeZoneConfig
                    ? <FlatZoneSVG zone={activeZoneConfig} showPrintZone={effectiveShowPrintZone} garmentPhotoSrc={displayProduct.frontSrc} />
                    : <GarmentSVG product={displayProduct} color={selectedColor.hex} showPrintZone={effectiveShowPrintZone} face={activeFace} mugMode={isMugProduct ? mugMode : undefined} />
                  }

                  {/* Layers (clipped to print zone) */}
                  <defs>
                    <clipPath id="design-clip">
                      <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} rx="4" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#design-clip)">
                    {layersRender
                      .filter(({ layer }) => (layer.face ?? "front") === activeFace)
                      .map(({ layer: l, geom: g }) => {
                      if (!l.visible) return null;
                      if (l.type === "image") {
                        return (
                          <image key={l.id}
                            data-layer-id={l.id}
                            href={l.src}
                            x={g.x} y={g.y} width={g.w} height={g.h}
                            opacity={l.transform.opacity}
                            transform={`rotate(${l.transform.rotation}, ${g.cx}, ${g.cy})`}
                            preserveAspectRatio="none"
                            style={{ cursor: l.locked ? "not-allowed" : "grab" }}
                          />
                        );
                      }
                      // text — multiply blend so ink looks printed on fabric
                      return (
                        <text key={l.id}
                          data-layer-id={l.id}
                          x={g.cx} y={g.cy}
                          fill={l.color}
                          fontFamily={l.fontFamily}
                          fontWeight={l.fontWeight}
                          fontStyle={l.fontStyle}
                          fontSize={l.fontSize * l.transform.scale}
                          opacity={l.transform.opacity}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          transform={`rotate(${l.transform.rotation}, ${g.cx}, ${g.cy})`}
                          style={{ cursor: l.locked ? "not-allowed" : "grab", userSelect: "none", mixBlendMode: "multiply" }}
                        >{l.text}</text>
                      );
                    })}
                  </g>

                  {/* Selection outline + handles */}
                  {selectedLayer && selGeom && (
                    <g pointerEvents="none">
                      <rect x={selGeom.x} y={selGeom.y} width={selGeom.w} height={selGeom.h}
                        fill="none" stroke="#E85D04" strokeWidth="1.5" strokeDasharray="4 3"
                        transform={`rotate(${selectedLayer.transform.rotation}, ${selGeom.cx}, ${selGeom.cy})`} />
                    </g>
                  )}
                  {selectedLayer && rotatedCorners.map(h => (
                    <circle key={h.key} cx={h.x} cy={h.y} r={7}
                      fill="white" stroke="#E85D04" strokeWidth="2"
                      style={{ cursor: "nwse-resize", touchAction: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.2))" }}
                      onPointerDown={handleResizeDown}
                    />
                  ))}

                  {/* Snap guides */}
                  {snapGuides.v && (
                    <line x1={pz.x + pz.w / 2} y1={pz.y - 8} x2={pz.x + pz.w / 2} y2={pz.y + pz.h + 8}
                      stroke="#E85D04" strokeWidth="1" strokeDasharray="2 3" />
                  )}
                  {snapGuides.h && (
                    <line x1={pz.x - 8} y1={pz.y + pz.h / 2} x2={pz.x + pz.w + 8} y2={pz.y + pz.h / 2}
                      stroke="#E85D04" strokeWidth="1" strokeDasharray="2 3" />
                  )}
                </motion.svg>
                </AnimatePresence>

                {/* Empty state — drop zone (drag on desktop, tap on mobile) */}
                {layers.length === 0 && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onClick={() => fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
                    aria-label="Upload image"
                  >
                    <motion.div
                      className="text-center px-8 py-8 rounded-2xl transition-all"
                      whileHover={{ scale: 1.03 }}
                      style={{ background: "rgba(255,255,255,0.92)", border: "2px dashed rgba(232,93,4,0.35)" }}
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg,#fff4ee,#ffe8d4)" }}
                      >
                        <Upload className="w-7 h-7 text-orange-500" />
                      </div>
                      <p className="font-black text-gray-800 text-base mb-1">Tap to upload</p>
                      <p className="text-xs text-gray-500">or drag & drop your image here</p>
                    </motion.div>
                  </div>
                )}

                {/* Fabric label */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black"
                    style={{ background: "rgba(255,255,255,0.96)", color: "#374151", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
                    {selectedProduct.description}
                  </span>
                </div>
                </>
                )}

                {/* Processing overlay — shows in-viewport whenever remove-bg or upscale is running.
                    Absolute over the canvas so users never need to scroll to see it. */}
                {(isRemoving || isUpscaling) && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20"
                    style={{ background: "rgba(255,255,255,0.82)", backdropFilter: "blur(2px)" }}
                  >
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <p className="text-xs font-bold text-gray-700">
                      {isRemoving ? "Removing background…" : "Upscaling image…"}
                    </p>
                  </div>
                )}
              </div>

              {/* Interaction hint */}
              {layers.length > 0 && (
                <div className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 flex items-center gap-2 border-t border-gray-100"
                  style={{ background: "white" }}>
                  <Move className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  Drag to move · Pinch to scale & rotate · Center snaps when aligned
                </div>
              )}
            </div>
          </div>

          {/* ═══════ RIGHT: TABBED PANEL ═══════ */}
          <div className="lg:w-[340px] shrink-0 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

            {/* Persistent hidden file inputs — always mounted so empty-state tap works
                regardless of which tab is active. fileInputRef is shared by:
                  • the "Tap to upload" empty-state overlay (all tabs)
                  • the "Upload Image" button in the Upload tab
                fileInputAddRef is used by the Layers tab "Image" add button. */}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />

            {/* Tab strip */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "white", border: "1px solid #e9e5e0" }}>
              <div className="flex border-b border-gray-100">
                {[
                  { id: "upload" as const,    label: "Upload",    icon: Upload },
                  { id: "text" as const,      label: "Text",      icon: Type },
                  { id: "layers" as const,    label: "Layers",    icon: LayersIcon },
                  { id: "templates" as const, label: "Templates", icon: Sparkles },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[10px] font-bold transition-colors"
                    style={{
                      color: activeTab === id ? "#E85D04" : "#6b7280",
                      borderBottom: activeTab === id ? "2px solid #E85D04" : "2px solid transparent",
                      marginBottom: "-1px",
                    }}
                  >
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {/* ── UPLOAD TAB ── */}
                {activeTab === "upload" && (
                  <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                      style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.3)" }}
                    >
                      <Upload className="w-4 h-4" /> Upload Image
                    </button>
                    <p className="text-[11px] text-gray-500 text-center">JPG, PNG, or WebP · Max 10MB</p>

                    {selectedLayer?.type === "image" && (
                      <>
                        <div className="rounded-xl border border-gray-100 p-2">
                          <img src={selectedLayer.src} alt="Preview" className="w-full h-20 object-contain rounded-lg"
                            style={{ background: "repeating-conic-gradient(#ccc 0% 25%,#f0f0f0 0% 50%) 0 0/16px 16px" }} />
                        </div>
                        <div>
                          <button onClick={handleRemoveBg} disabled={isRemoving || isUpscaling}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                            style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                            title={removeBgServerConfigured === false ? "No remove.bg API key — will use in-browser AI (slower)" : undefined}
                          >
                            {isRemoving
                              ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing background...</>
                              : <><Scissors className="w-4 h-4" /> Remove Background</>}
                          </button>
                          {removeBgServerConfigured === false && !isRemoving && (
                            <p className="text-[10px] text-amber-600 mt-1 text-center leading-tight">
                              Uses in-browser AI — admin can enable cloud processing in{" "}
                              <a href="/admin/settings" className="underline font-semibold">Settings</a>
                            </p>
                          )}
                        </div>
                        <button onClick={handleUpscale} disabled={isRemoving || isUpscaling}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                          style={{ background: "linear-gradient(135deg,#FEF3C7,#FDE68A)", color: "#92400E", border: "1px solid #FCD34D" }}
                        >
                          {isUpscaling
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Upscaling…</>
                            : <><Wand2 className="w-4 h-4" /> Upscale to HD (2×)</>}
                        </button>
                      </>
                    )}

                    {/* Garment size picker (apparel only) */}
                    {!isMug && !isCap && !isWaterBottle && (
                      <div className="pt-3 border-t border-gray-100">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Garment Size</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_CHART.map(s => (
                            <button key={s.size} onClick={() => setSelectedSize(s.size)}
                              className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                              style={{
                                background: selectedSize === s.size ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#f3f4f6",
                                color: selectedSize === s.size ? "white" : "#374151",
                                boxShadow: selectedSize === s.size ? "0 2px 8px rgba(232,93,4,0.3)" : "none",
                              }}
                            >{s.size}</button>
                          ))}
                        </div>
                        <details className="mt-3">
                          <summary className="text-[11px] font-bold text-gray-500 cursor-pointer flex items-center gap-1">
                            <Ruler className="w-3 h-3" /> Size guide
                          </summary>
                          <div className="mt-2 rounded-lg overflow-hidden border border-gray-100">
                            <table className="w-full text-[11px]">
                              <thead><tr style={{ background: "#f9fafb" }}>
                                <th className="px-2 py-1.5 text-left font-black text-gray-600">Size</th>
                                <th className="px-2 py-1.5 text-left font-black text-gray-600">Chest</th>
                                <th className="px-2 py-1.5 text-left font-black text-gray-600">Length</th>
                              </tr></thead>
                              <tbody>
                                {SIZE_CHART.map((row, i) => (
                                  <tr key={row.size} className="border-t border-gray-50"
                                    style={{ background: selectedSize === row.size ? "#fff4ee" : i % 2 === 0 ? "white" : "#fafafa" }}>
                                    <td className="px-2 py-1.5 font-black" style={{ color: selectedSize === row.size ? "#E85D04" : "#111" }}>{row.size}</td>
                                    <td className="px-2 py-1.5 text-gray-600">{row.chest}"</td>
                                    <td className="px-2 py-1.5 text-gray-600">{row.length}"</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── TEXT TAB ── */}
                {activeTab === "text" && (
                  <motion.div key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
                    <button
                      onClick={() => {
                        const layer: TextLayer = {
                          id: uid(), name: "New text", type: "text", visible: true, locked: false,
                          transform: { ...ZERO_TRANSFORM },
                          text: "Your text", fontFamily: FONT_FAMILIES[0].value,
                          fontWeight: 700, fontStyle: "normal", fontSize: 40, color: "#111111",
                        };
                        addLayer(layer);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white"
                      style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.3)" }}
                    >
                      <Plus className="w-4 h-4" /> Add Text Layer
                    </button>

                    {selectedLayer?.type === "text" ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Text</label>
                          <input value={selectedLayer.text}
                            onChange={(e) => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, text: e.target.value, name: e.target.value || "Text" } : l, false)}
                            onBlur={() => commitLayers(layers)}
                            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 focus:border-orange-400 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Font</label>
                          <select value={selectedLayer.fontFamily}
                            onChange={(e) => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, fontFamily: e.target.value } : l, true)}
                            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 outline-none"
                          >
                            {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Size</label>
                            <input type="number" min={8} max={200} value={selectedLayer.fontSize}
                              onChange={(e) => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, fontSize: Math.max(8, Math.min(200, parseInt(e.target.value) || 12)) } : l, false)}
                              onBlur={() => commitLayers(layers)}
                              className="w-full px-2 py-1.5 rounded-lg text-sm border border-gray-200 outline-none" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Color</label>
                            <input type="color" value={selectedLayer.color}
                              onChange={(e) => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, color: e.target.value } : l, false)}
                              onBlur={() => commitLayers(layers)}
                              className="w-full h-9 rounded-lg border border-gray-200 cursor-pointer" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, fontWeight: l.fontWeight >= 800 ? 400 : 800 } : l, true)}
                            className="flex-1 py-2 rounded-lg text-sm font-black border"
                            style={{
                              background: selectedLayer.fontWeight >= 800 ? "#fff4ee" : "white",
                              color: selectedLayer.fontWeight >= 800 ? "#E85D04" : "#374151",
                              borderColor: selectedLayer.fontWeight >= 800 ? "#fdd5b4" : "#e5e7eb",
                            }}
                          >B</button>
                          <button
                            onClick={() => updateLayer(selectedLayer.id, l => l.type === "text" ? { ...l, fontStyle: l.fontStyle === "italic" ? "normal" : "italic" } : l, true)}
                            className="flex-1 py-2 rounded-lg text-sm italic font-bold border"
                            style={{
                              background: selectedLayer.fontStyle === "italic" ? "#fff4ee" : "white",
                              color: selectedLayer.fontStyle === "italic" ? "#E85D04" : "#374151",
                              borderColor: selectedLayer.fontStyle === "italic" ? "#fdd5b4" : "#e5e7eb",
                            }}
                          >I</button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-500 p-3 rounded-xl text-center" style={{ background: "#f9fafb" }}>
                        Add a text layer or select one to edit it.
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── LAYERS TAB ── */}
                {activeTab === "layers" && (
                  <motion.div key="layers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
                    {/* Add buttons */}
                    <div className="flex gap-2">
                      <input ref={fileInputAddRef} type="file" accept="image/jpeg,image/png,image/webp"
                        className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />
                      <button onClick={() => fileInputAddRef.current?.click()}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border"
                        style={{ background: "white", color: "#374151", borderColor: "#e5e7eb" }}>
                        <ImageIcon className="w-3.5 h-3.5" /> Image
                      </button>
                      <button onClick={() => setActiveTab("text")}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border"
                        style={{ background: "white", color: "#374151", borderColor: "#e5e7eb" }}>
                        <Type className="w-3.5 h-3.5" /> Text
                      </button>
                    </div>

                    {/* Layer list (top of stack first) */}
                    {layers.length === 0 ? (
                      <div className="text-xs text-gray-500 p-4 rounded-xl text-center" style={{ background: "#f9fafb" }}>
                        No layers yet. Add an image or text to start.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {[...layers].reverse().map((l) => {
                          const isSel = selectedLayerId === l.id;
                          return (
                            <div key={l.id}
                              onClick={() => setSelectedLayerId(l.id)}
                              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer border"
                              style={{
                                background: isSel ? "#fff4ee" : "white",
                                borderColor: isSel ? "#fdd5b4" : "#eee",
                              }}
                            >
                              <button onClick={(e) => { e.stopPropagation();
                                updateLayer(l.id, x => ({ ...x, visible: !x.visible }), true);
                              }} className="text-gray-400 hover:text-gray-700" title="Show/hide">
                                {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              {l.type === "image" ? (
                                <img src={l.src} alt="" className="w-7 h-7 rounded object-cover bg-gray-100 shrink-0" />
                              ) : (
                                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0"
                                  style={{ background: "#f3f4f6", color: l.color, fontWeight: 800, fontSize: 10 }}>T</div>
                              )}
                              <span className="text-xs font-bold text-gray-700 truncate flex-1">{l.name}</span>
                              <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1); }} className="text-gray-400 hover:text-gray-700" title="Bring forward">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1); }} className="text-gray-400 hover:text-gray-700" title="Send backward">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={(e) => { e.stopPropagation();
                                updateLayer(l.id, x => ({ ...x, locked: !x.locked }), true);
                              }} className="text-gray-400 hover:text-gray-700" title="Lock/unlock">
                                {l.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }} className="text-red-400 hover:text-red-600" title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* AI Tools for image layers — shown prominently in the Layers tab */}
                    {selectedLayer?.type === 'image' && (
                      <div className='pt-3 border-t border-gray-100 space-y-2'>
                        <div className='text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2'>✨ AI Image Tools</div>
                        <button onClick={handleRemoveBg} disabled={isRemoving || isUpscaling}
                          className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01]'
                          style={{ background: 'linear-gradient(135deg,#fff4ee,#ffe4cc)', color: '#E85D04', border: '1.5px solid #fdd5b4', boxShadow: '0 2px 8px rgba(232,93,4,0.15)' }}
                        >
                          {isRemoving
                            ? <><Loader2 className='w-4 h-4 animate-spin' /> Removing background...</>
                            : <><Scissors className='w-4 h-4' /> Remove Background</>}
                        </button>
                        <button onClick={handleUpscale} disabled={isRemoving || isUpscaling}
                          className='w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01]'
                          style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', color: '#92400E', border: '1.5px solid #FCD34D', boxShadow: '0 2px 8px rgba(146,64,14,0.15)' }}
                        >
                          {isUpscaling
                            ? <><Loader2 className='w-4 h-4 animate-spin' /> Upscaling…</>
                            : <><Wand2 className='w-4 h-4' /> Upscale to HD (2×)</>}
                        </button>
                      </div>
                    )}
                    {/* Adjust selected layer */}
                    {selectedLayer && (
                      <div className="pt-3 border-t border-gray-100 space-y-3">
                        <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">Adjust “{selectedLayer.name}”</div>
                        {/* Scale */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-gray-500">Scale</label>
                            <span className="text-[11px] font-bold text-gray-600">{Math.round(selectedLayer.transform.scale * 100)}%</span>
                          </div>
                          <input type="range" min="10" max="300" step="5"
                            value={Math.round(selectedLayer.transform.scale * 100)}
                            onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: parseInt(e.target.value) / 100 } }), false)}
                            onPointerUp={() => commitLayers(layers)}
                            className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: "#E85D04" }} />
                          <div className="flex justify-between mt-1">
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: Math.max(0.1, l.transform.scale - 0.05) } }), true)}
                              className="text-gray-400 hover:text-orange-500"><ZoomOut className="w-4 h-4" /></button>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: Math.min(5, l.transform.scale + 0.05) } }), true)}
                              className="text-gray-400 hover:text-orange-500"><ZoomIn className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {/* Rotation */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-gray-500">Rotation</label>
                            <span className="text-[11px] font-bold text-gray-600">{Math.round(selectedLayer.transform.rotation)}°</span>
                          </div>
                          <input type="range" min="-180" max="180" step="1"
                            value={selectedLayer.transform.rotation}
                            onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: parseInt(e.target.value) } }), false)}
                            onPointerUp={() => commitLayers(layers)}
                            className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: "#E85D04" }} />
                          <div className="flex justify-between mt-1">
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: l.transform.rotation - 5 } }), true)}
                              className="text-gray-400 hover:text-orange-500"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: 0 } }), true)}
                              className="text-xs font-bold text-gray-400 hover:text-orange-500">Reset</button>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: l.transform.rotation + 5 } }), true)}
                              className="text-gray-400 hover:text-orange-500"><RotateCw className="w-4 h-4" /></button>
                          </div>
                        </div>
                        {/* Opacity */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-bold text-gray-500">Opacity</label>
                            <span className="text-[11px] font-bold text-gray-600">{Math.round(selectedLayer.transform.opacity * 100)}%</span>
                          </div>
                          <input type="range" min="10" max="100" step="5"
                            value={Math.round(selectedLayer.transform.opacity * 100)}
                            onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, opacity: parseInt(e.target.value) / 100 } }), false)}
                            onPointerUp={() => commitLayers(layers)}
                            className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: "#E85D04" }} />
                        </div>
                        {/* Position */}
                        <div>
                          <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Position</label>
                          <div className="grid grid-cols-3 gap-1 w-28 mx-auto">
                            <div />
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, y: l.transform.y - 4 } }), true)}
                              className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center"><ArrowUp className="w-4 h-4" /></button>
                            <div />
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, x: l.transform.x - 4 } }), true)}
                              className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center"><ArrowLeft className="w-4 h-4" /></button>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...ZERO_TRANSFORM } }), true)}
                              className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center"><RotateCcw className="w-3.5 h-3.5" /></button>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, x: l.transform.x + 4 } }), true)}
                              className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center"><ArrowRight className="w-4 h-4" /></button>
                            <div />
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, y: l.transform.y + 4 } }), true)}
                              className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center"><ArrowDown className="w-4 h-4" /></button>
                            <div />
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── TEMPLATES TAB ── */}
                {activeTab === "templates" && (
                  <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                    <p className="text-[11px] text-gray-500 mb-3">Pick a starter — adds editable text layers you can tweak.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEMPLATES.map(t => (
                        <button key={t.id}
                          onClick={() => {
                            const newLayers = t.create();
                            commitLayers([...layers, ...newLayers]);
                            setSelectedLayerId(newLayers[newLayers.length - 1].id);
                            setActiveTab("layers");
                          }}
                          className="aspect-square rounded-xl flex flex-col items-center justify-center p-3 text-center border transition-all hover:border-orange-300 hover:shadow-sm"
                          style={{ background: "#fafaf8", borderColor: "#eee" }}
                        >
                          <div className="text-base font-black text-gray-800 leading-tight whitespace-pre">{t.preview}</div>
                          <div className="text-[10px] mt-2 text-gray-500 font-semibold">{t.name}</div>
                        </button>
                      ))}
                    </div>

                    {/* Stickers subsection */}
                    <div className="mt-5 pt-4 border-t border-gray-100" data-testid="sticker-section">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-gray-500">Stickers</h3>
                        <span className="text-[10px] text-gray-400 font-semibold">{STICKERS.length} shapes</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-3">Tap to drop a vector sticker — drag, pinch & rotate just like an image.</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {STICKERS.map(s => (
                          <button key={s.id}
                            data-testid={`sticker-${s.id}`}
                            title={s.name}
                            onClick={() => {
                              const img = new Image();
                              const finish = (w: number, h: number) => {
                                addLayer({
                                  id: uid(),
                                  name: s.name,
                                  type: "image",
                                  visible: true,
                                  locked: false,
                                  transform: { ...ZERO_TRANSFORM, scale: 0.4 },
                                  src: s.dataUrl,
                                  naturalW: w,
                                  naturalH: h,
                                });
                                setActiveTab("layers");
                              };
                              img.onload = () => finish(img.naturalWidth || 100, img.naturalHeight || 100);
                              // Defensive fallback: if the data URL fails to decode for any reason,
                              // still drop a layer at the SVG's known 100×100 viewBox dimensions
                              // and let the user know the preview thumbnail may be missing.
                              img.onerror = () => {
                                finish(100, 100);
                                toast({
                                  title: "Sticker added",
                                  description: "Couldn't render a preview, but the shape was placed.",
                                });
                              };
                              img.src = s.dataUrl;
                            }}
                            className="aspect-square rounded-lg flex items-center justify-center p-1.5 border transition-all hover:border-orange-300 hover:shadow-sm hover:bg-orange-50/30"
                            style={{ background: "white", borderColor: "#eee" }}
                          >
                            <img src={s.dataUrl} alt={s.name} className="w-full h-full object-contain pointer-events-none" />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-xl text-xs text-gray-500 flex items-start gap-2"
                      style={{ background: "#fff4ee", border: "1px solid #fdd5b4" }}>
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-500" />
                      <span>Tap a template or sticker, then customize from the Layers tab.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quantity + price summary */}
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
              style={{ background: "white", border: "1px solid #e9e5e0" }}
            >
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                  {quantity > 1 ? `${quantity} × ৳${studioPrice.toLocaleString()}` : `৳${studioPrice.toLocaleString()} each`}
                </div>
                <div className="text-sm font-black text-gray-900">
                  Subtotal: <span className="text-orange-500">৳{(quantity * studioPrice).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg text-gray-700 disabled:opacity-40 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
                  aria-label="Decrease quantity"
                >−</button>
                <span className="text-sm font-black text-gray-800 w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(50, q + 1))}
                  disabled={quantity >= 50}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-lg text-gray-700 disabled:opacity-40 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}
                  aria-label="Increase quantity"
                >+</button>
              </div>
            </div>

            {/* Add to cart */}
            <motion.button
              onClick={handleAddToCart}
              disabled={isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 8px 24px rgba(232,93,4,0.35)" }}
            >
              {isAddingToCart
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Adding to Cart...</>
                : <><ShoppingCart className="w-5 h-5" /> Add Custom {selectedProduct.name} to Cart</>}
            </motion.button>

            {(() => {
              const subtotal = quantity * studioPrice;
              const freeShip = subtotal >= 1500;
              return (
                <div className="text-center text-xs space-y-0.5">
                  {!isMug && !isCap && !isWaterBottle && (
                    <div className="text-gray-500">
                      Size: <strong className="text-gray-700">{selectedSize}</strong>
                    </div>
                  )}
                  <div className={freeShip ? "text-green-600 font-bold" : "text-gray-400"}>
                    {freeShip
                      ? "✓ Free shipping included!"
                      : `Add ৳${(1500 - subtotal).toLocaleString()} more for free shipping`}
                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      <Footer />

      <ConfirmDialog
        open={!!legacyDraftFound}
        title="Older design draft found"
        description={`We found a saved design from an older version of the editor (v${legacyDraftFound?.version ?? "?"}). It can't be restored automatically. Discard it and start fresh?`}
        confirmText="Discard old draft"
        cancelText="Keep for now"
        variant="warning"
        onConfirm={() => {
          try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
          setLegacyDraftFound(null);
          toast({ title: "Old draft discarded", description: "You can now start fresh." });
        }}
        onCancel={() => setLegacyDraftFound(null)}
      />

      {/* ═══════ PRODUCT CATALOG PICKER MODAL ═══════ */}
      <AnimatePresence>
        {showProductPicker && (
          <>
            {/* Backdrop */}
            <motion.div
              key="picker-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => setShowProductPicker(false)}
            />
            {/* Modal panel */}
            <motion.div
              key="picker-panel"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed inset-x-3 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 flex flex-col"
              style={{
                maxWidth: 680,
                maxHeight: "min(90vh, 720px)",
                width: "100%",
                background: "white",
                borderRadius: "24px 24px 0 0",
                boxShadow: "0 -8px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
              }}
            >
              {/* Modal header */}
              <div className="px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-black text-gray-900 text-lg">Choose a Blank Product</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Select any product to start designing</p>
                  </div>
                  <button
                    onClick={() => setShowProductPicker(false)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                    style={{ background: "#f3f4f6" }}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border border-gray-200 outline-none focus:border-orange-400"
                    style={{ background: "#f9fafb" }}
                  />
                </div>

                {/* Category filter pills */}
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                  {(["all", "tshirt", "hoodie", "longsleeve", "mug", "cap", "waterbottle"] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setProductPickerCategory(cat)}
                      className="shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                      style={{
                        background: productPickerCategory === cat ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#f3f4f6",
                        color: productPickerCategory === cat ? "white" : "#6b7280",
                        boxShadow: productPickerCategory === cat ? "0 3px 10px rgba(232,93,4,0.3)" : "none",
                      }}
                    >
                      {cat === "all" ? "All Products" : cat === "tshirt" ? "T-Shirts" : cat === "hoodie" ? "Hoodies" : cat === "longsleeve" ? "Long Sleeves" : cat === "mug" ? "Mugs" : cat === "cap" ? "Caps" : "Bottles"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product grid */}
              <div className="overflow-y-auto flex-1 px-5 pb-6">
                {(() => {
                  const query = productSearch.trim().toLowerCase();
                  const filtered = PRODUCTS.filter(p => {
                    const matchesCat = productPickerCategory === "all" || p.category === productPickerCategory;
                    const matchesSearch = !query || p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
                    return matchesCat && matchesSearch;
                  });

                  if (filtered.length === 0) return (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="font-bold text-gray-600">No products found</p>
                      <p className="text-sm text-gray-400 mt-1">Try a different search or category</p>
                    </div>
                  );

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                      {filtered.map(prod => {
                        const isSelected = selectedProduct.id === prod.id;
                        return (
                          <button
                            key={prod.id}
                            onClick={() => {
                              perProductLayersRef.current[selectedProduct.id] = {
                                layers: layersRef.current,
                                stack: historyRef.current.stack,
                                index: historyRef.current.index,
                              };
                              const saved = perProductLayersRef.current[prod.id];
                              const newLayers = saved?.layers ?? [];
                              const newStack = saved?.stack ?? [[]];
                              const newHistIdx = saved?.index ?? 0;
                              historyRef.current = { stack: newStack, index: newHistIdx };
                              flushSync(() => {
                                setLayers(newLayers);
                                setSelectedLayerId(null);
                                setSelectedProduct(prod);
                                setSelectedColor({ name: prod.name, hex: prod.garmentColor });
                                setQuantity(1);
                                setActiveFace("front");
                              });
                              forceHistoryTick(t => t + 1);
                              // All products now support 3D — no reset needed when switching
                              setShowProductPicker(false);
                            }}
                            className="flex flex-col rounded-2xl overflow-hidden transition-all text-left group"
                            style={{
                              border: isSelected ? "2.5px solid #E85D04" : "1.5px solid #e5e7eb",
                              boxShadow: isSelected ? "0 4px 16px rgba(232,93,4,0.2)" : "0 1px 6px rgba(0,0,0,0.05)",
                              background: isSelected ? "#fff9f6" : "white",
                            }}
                          >
                            {/* Product photo */}
                            <div className="w-full aspect-square relative overflow-hidden"
                              style={{ background: "radial-gradient(ellipse at 50% 40%, #f5f5f3 0%, #e8e5e0 100%)" }}>
                              <img
                                src={prod.frontSrc}
                                alt={prod.name}
                                className="w-full h-full object-contain transition-transform group-hover:scale-105"
                                style={{ padding: "8%" }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "";
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                              {prod.badge && (
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black text-white"
                                  style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}>
                                  {prod.badge}
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                                  style={{ background: "#E85D04" }}>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              )}
                            </div>
                            {/* Info */}
                            <div className="px-3 py-2.5">
                              <div className="text-xs font-black text-gray-800 leading-tight truncate">{prod.name}</div>
                              <div className="text-[10px] text-gray-400 font-semibold mt-0.5">{prod.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
