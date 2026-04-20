import { useRef, useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useGesture } from "@use-gesture/react";
import {
  Upload, RotateCcw, Trash2, ShoppingCart,
  ZoomIn, ZoomOut, RotateCw, Move, Ruler,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Scissors, Info, Eye, EyeOff, Loader2,
  Type, Layers as LayersIcon, Sparkles,
  Undo2, Redo2, Lock, Unlock, ChevronUp, ChevronDown,
  Image as ImageIcon, Plus, Check, CloudUpload,
  Box, Image as Image2D,
} from "lucide-react";
import {
  PRODUCTS, type DesignProduct, GarmentSVG,
  STICKERS, BASE_BY_CATEGORY,
} from "./design-studio/mockups";
import { composeLayers, composeGarmentMockup, composeDesignTexture, hasWebGL2, type ComposerLayer } from "./design-studio/composer";

// Lazy-load the 3D bundle so first-paint stays light.
const ProductViewer3D = lazy(() => import("./design-studio/ProductViewer3D"));

/* ═══════════════════════════════════════════════════════
   LAYER MODEL
════════════════════════════════════════════════════════ */

interface Transform { x: number; y: number; scale: number; rotation: number; opacity: number }
const ZERO_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 };

type Face = "front" | "back";
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
  const [selectedSize, setSelectedSize] = useState("M");
  const [showPrintZone, setShowPrintZone] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  /* View mode + active face */
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [activeFace, setActiveFace] = useState<Face>("front");
  const supports3D = useMemo(() => hasWebGL2(), []);
  // Tee/longsleeve/hoodie support a back face. Mug/cap → front only.
  const supportsBack = useMemo(
    () => ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category),
    [selectedProduct.category]
  );
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
  const draftRestoredRef = useRef(false);

  // Restore draft on mount (runs once)
  useEffect(() => {
    try {
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
            toast({ title: "Draft restored", description: "We brought back your last design." });
          }
        }
      }
    } catch {
      // Corrupt JSON or storage access failure — ignore and start fresh.
    }
    draftRestoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft when layers / product / color / size change (debounced)
  useEffect(() => {
    if (!draftRestoredRef.current) return;
    if (layers.length === 0) {
      // Nothing meaningful to save — clear any prior draft so a refresh starts fresh.
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
  }, [layers, selectedProduct, selectedColor, selectedSize]);

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

  // Print zone is face-aware: products may have a different rectangle for the back panel.
  // Front and back share the same print zone per garment, so flipping
  // faces preserves a design's apparent size and position. The
  // `printZoneBack` field is kept on the type for backward compatibility
  // but is no longer set by any product — the fallback always wins.
  const pz = useMemo(
    () => (activeFace === "back" && selectedProduct.printZoneBack) ? selectedProduct.printZoneBack : selectedProduct.printZone,
    [activeFace, selectedProduct]
  );
  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";

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

  /* ── File upload ───────────────────────────────────── */
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload a JPG or PNG image.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const layer: ImageLayer = {
          id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
          type: "image", src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
          visible: true, locked: false, transform: { ...ZERO_TRANSFORM },
        };
        addLayer(layer);
        setActiveTab("layers");
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  /* ── Background removal (only on selected image layer) ── */
  const handleRemoveBg = async () => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    setIsRemoving(true);
    try {
      const res = await fetch(getApiUrl("/api/remove-bg"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedLayer.src }),
      });
      if (!res.ok) throw new Error("Failed");
      const { result } = await res.json();
      const img = new Image();
      img.onload = () => {
        updateLayer(selectedLayer.id, l => l.type === "image"
          ? { ...l, src: result, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
          : l, true);
      };
      img.src = result;
      toast({ title: "Background removed!", description: "Your image background has been removed." });
    } catch {
      toast({
        title: "Remove background failed",
        description: "Couldn't remove background. Please add your remove.bg API key in Admin → Settings.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
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
      const frontPZ = selectedProduct.printZone;
      const backPZ = selectedProduct.printZoneBack ?? selectedProduct.printZone;
      const frontLayers = layers.filter(l => (l.face ?? "front") === "front") as unknown as ComposerLayer[];
      const backLayers  = layers.filter(l => (l.face ?? "front") === "back")  as unknown as ComposerLayer[];
      const imageCache  = new Map<string, HTMLImageElement>();

      // 1. Full garment + design composite → cart thumbnail (imageUrl)
      //    Uses the white-cutout PNG so tinting matches the 2D editor exactly.
      const garmentBase = BASE_BY_CATEGORY[selectedProduct.category];
      const garmentSrc  = garmentBase?.front ?? selectedProduct.frontSrc;
      const mockupCanvas = document.createElement("canvas");
      await composeGarmentMockup({
        canvas: mockupCanvas,
        garmentSrc,
        garmentColor: selectedColor.hex,
        printZone: frontPZ,
        layers: frontLayers,
        outSize: 800,
        imageCache,
      });
      const mockupUrl = mockupCanvas.toDataURL("image/png", 0.85);

      // 2. Design-only texture (transparent bg, full 1000-unit space)
      //    Stored in customImages[0] — used by CartViewer3D for the UV texture.
      const frontTexCanvas = document.createElement("canvas");
      await composeDesignTexture({
        canvas: frontTexCanvas,
        printZone: frontPZ,
        layers: frontLayers,
        outSize: 512,
        imageCache,
      });
      const frontTexUrl = frontTexCanvas.toDataURL("image/webp", 0.8);

      // 3. Back-face design texture (if back has layers)
      let backTexUrl: string | undefined;
      if (backLayers.length > 0) {
        const backTexCanvas = document.createElement("canvas");
        await composeDesignTexture({
          canvas: backTexCanvas,
          printZone: backPZ,
          layers: backLayers,
          outSize: 512,
          imageCache,
        });
        backTexUrl = backTexCanvas.toDataURL("image/webp", 0.8);
      }

      const displayPrice = isMug
        ? (settings.studioMugPrice || 799)
        : (settings.studioTshirtPrice || 1099);

      addToCart({
        productId: 0,
        name: `Custom ${selectedProduct.name}`,
        price: displayPrice,
        quantity: 1,
        size: isMug || isCap ? undefined : selectedSize,
        color: selectedColor.name,
        imageUrl: mockupUrl,
        customImages: backTexUrl ? [frontTexUrl, backTexUrl] : [frontTexUrl],
        customNote: JSON.stringify({
          studioDesign: true,
          product: selectedProduct.name,
          category: selectedProduct.category,
          color: selectedColor.name,
          colorHex: selectedColor.hex,
          size: selectedSize,
          layerCount: layers.length,
          frontLayerCount: frontLayers.length,
          backLayerCount: backLayers.length,
        }),
      });

      toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready.` });
      // Draft is now in the cart — clear local draft so a refresh doesn't restore it.
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false);
      setSaveStatus("idle");
      setTimeout(() => navigate("/cart"), 800);
    } finally {
      setIsAddingToCart(false);
    }
  }, [layers, selectedProduct, selectedColor, selectedSize, isMug, isCap, pz, addToCart, toast, navigate, settings]);

  /* ── Studio color palette — per product type ───────── */
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
    { name: "Navy", hex: "#1e3a5f" }, { name: "Red", hex: "#dc2626" },
    { name: "Pink", hex: "#f472b6" }, { name: "Sky Blue", hex: "#0ea5e9" },
  ];
  const studioColors = isMug
    ? (parseColors(settings.studioMugColors) ?? DEFAULT_MUG_COLORS)
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

      {/* Page header */}
      <div className="border-b border-gray-200 sticky top-0 z-30" style={{ background: "white" }}>
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-xl text-gray-900">Design Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5">You imagine — we craft it.</p>
          </div>
          <div className="flex items-center gap-2">
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
            {hasDraft && (
              <button
                onClick={clearDraft}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 hover:text-red-600 transition-colors"
                style={{ background: "#f3f4f6" }}
                title="Clear saved draft"
                data-testid="clear-draft"
              >
                <Trash2 className="w-3 h-3" /> Clear draft
              </button>
            )}
            {/* Undo / Redo */}
            <button onClick={undo} disabled={!canUndo}
              className="p-2 rounded-xl text-gray-600 disabled:opacity-30"
              style={{ background: "#f3f4f6" }} title="Undo (Ctrl+Z)">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={!canRedo}
              className="p-2 rounded-xl text-gray-600 disabled:opacity-30"
              style={{ background: "#f3f4f6" }} title="Redo (Ctrl+Y)">
              <Redo2 className="w-4 h-4" />
            </button>
            {/* 2D / 3D toggle (visible on mobile too — it's a hero feature) */}
            {supports3D && (
              <div className="flex items-center rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb", background: "white" }} data-testid="view-mode-toggle">
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
            <motion.button
              onClick={handleAddToCart}
              disabled={layers.length === 0 || isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.35)" }}
            >
              {isAddingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              Add to Cart
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ═══════ LEFT: MOCKUP CANVAS ═══════ */}
          <div className="flex-1 min-w-0">
            {/* Product tabs (scrollable on mobile) */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
              {PRODUCTS.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => {
                    setSelectedProduct(prod);
                    setSelectedColor({ name: prod.name, hex: prod.garmentColor });
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                  style={{
                    background: selectedProduct.id === prod.id ? "linear-gradient(135deg,#E85D04,#FB8500)" : "white",
                    color: selectedProduct.id === prod.id ? "white" : "#374151",
                    border: selectedProduct.id === prod.id ? "none" : "1.5px solid #e5e7eb",
                    boxShadow: selectedProduct.id === prod.id ? "0 4px 12px rgba(232,93,4,0.3)" : "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border shrink-0"
                    style={{ background: prod.garmentColor, borderColor: prod.garmentColor === "#F8F7F4" || prod.garmentColor === "#F5F5F5" || prod.garmentColor === "#F2EFE9" || prod.garmentColor === "#F5F2EC" ? "#d1d5db" : prod.garmentColor }}
                  />
                  {prod.name}
                </button>
              ))}
            </div>

            {/* Face switcher (only for tee/longsleeve/hoodie) */}
            {supportsBack && (
              <div className="flex gap-1.5 mb-3" data-testid="face-switcher">
                {(["front", "back"] as const).map(f => (
                  <button key={f}
                    onClick={() => setActiveFace(f)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: activeFace === f ? "linear-gradient(135deg,#1f2937,#374151)" : "white",
                      color: activeFace === f ? "white" : "#374151",
                      border: activeFace === f ? "none" : "1.5px solid #e5e7eb",
                      boxShadow: activeFace === f ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
                    }}
                    data-testid={`face-${f}`}
                  >
                    {f === "front" ? "Front" : "Back"}
                  </button>
                ))}
                {otherFaceCount > 0 && (
                  <span className="px-3 py-2 text-[11px] font-bold text-gray-500" style={{ background: "#f3f4f6", borderRadius: 12 }}>
                    {otherFaceCount} layer{otherFaceCount !== 1 ? "s" : ""} on the {activeFace === "front" ? "back" : "front"}
                  </span>
                )}
              </div>
            )}

            {/* Garment color swatches */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {studioColors.map(c => {
                const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                return (
                  <button key={c.hex} title={c.name}
                    onClick={() => setSelectedColor({ name: c.name, hex: c.hex })}
                    className="w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110"
                    style={{
                      background: c.hex,
                      borderColor: isSelected ? "#E85D04" : (c.hex.toUpperCase() === "#FFFFFF" || c.hex === "#F5F5F5" ? "#d1d5db" : c.hex),
                      boxShadow: isSelected ? "0 0 0 2px rgba(232,93,4,0.3)" : "0 1px 3px rgba(0,0,0,0.10)",
                    }}
                  />
                );
              })}
            </div>

            {/* Mockup area */}
            <div
              className="relative rounded-3xl overflow-hidden select-none"
              style={{
                background: "radial-gradient(ellipse at 50% 40%, #F2F0ED 0%, #E8E5E1 50%, #DDDAD5 100%)",
                border: "1px solid #d8d5d0",
                boxShadow: "inset 0 2px 20px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.08)",
              }}
            >
              <div
                className="relative w-full"
                style={{ aspectRatio: `${selectedProduct.aspect}`, touchAction: "none" }}
              >
                {viewMode === "3d" && supports3D ? (
                  <div className="absolute inset-0" data-testid="viewer-3d">
                    <Suspense fallback={
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading 3D preview…
                      </div>
                    }>
                      <ProductViewer3D
                        product={selectedProduct}
                        garmentColor={selectedColor.hex}
                        front={{
                          layers: layers.filter(l => (l.face ?? "front") === "front") as unknown as ComposerLayer[],
                          printZone: selectedProduct.printZone,
                          baseHeight: selectedProduct.baseHeight,
                        }}
                        back={supportsBack ? {
                          layers: layers.filter(l => (l.face ?? "front") === "back") as unknown as ComposerLayer[],
                          printZone: selectedProduct.printZoneBack ?? selectedProduct.printZone,
                          baseHeight: selectedProduct.baseHeight,
                        } : undefined}
                        activeFace={activeFace}
                      />
                    </Suspense>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[11px] font-bold text-white pointer-events-none"
                      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
                      Drag to rotate · Scroll to zoom
                    </div>
                  </div>
                ) : (
                <>
                {/* Floating face label inside the canvas — gives a clear, premium
                    "you are looking at the FRONT" indicator and animates between
                    faces. Doesn't affect interaction (pointer-events: none). */}
                {supportsBack && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeFace}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest pointer-events-none z-10"
                      style={{ background: "rgba(17,24,39,0.85)", color: "white", letterSpacing: "0.12em", backdropFilter: "blur(4px)" }}
                    >
                      {activeFace}
                    </motion.div>
                  </AnimatePresence>
                )}
                <AnimatePresence mode="wait" initial={false}>
                <motion.svg
                  key={`${selectedProduct.id}-${activeFace}`}
                  ref={svgRef}
                  viewBox={selectedProduct.viewBox}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: "none", userSelect: "none" }}
                  initial={{ opacity: 0, rotateY: activeFace === "back" ? -12 : 12 }}
                  animate={{ opacity: 1, rotateY: 0 }}
                  exit={{ opacity: 0, rotateY: activeFace === "back" ? 12 : -12 }}
                  transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                  {...bindCanvasGestures()}
                >
                  <GarmentSVG product={selectedProduct} color={selectedColor.hex} showPrintZone={effectiveShowPrintZone} face={activeFace} />

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

                {/* Empty state */}
                {layers.length === 0 && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="text-center px-8 py-8 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.85)", border: "2px dashed rgba(232,93,4,0.35)", backdropFilter: "blur(6px)" }}
                    >
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg,#fff4ee,#ffe8d4)" }}
                      >
                        <Upload className="w-7 h-7 text-orange-500" />
                      </div>
                      <p className="font-black text-gray-800 text-base mb-1">Upload or add text</p>
                      <p className="text-xs text-gray-500">JPG, PNG · or pick a Template</p>
                    </motion.div>
                  </div>
                )}

                {/* Fabric label */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black"
                    style={{ background: "rgba(255,255,255,0.9)", color: "#374151", backdropFilter: "blur(4px)", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                    {selectedProduct.description}
                  </span>
                </div>
                </>
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
          <div className="lg:w-[340px] shrink-0 flex flex-col gap-4">

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
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                      className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />
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
                        <button onClick={handleRemoveBg} disabled={isRemoving}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                          style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb" }}
                        >
                          {isRemoving
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing background...</>
                            : <><Scissors className="w-4 h-4" /> Remove Background</>}
                        </button>
                      </>
                    )}

                    {/* Garment size picker (apparel only) */}
                    {!isMug && !isCap && (
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

            {/* Add to cart */}
            <motion.button
              onClick={handleAddToCart}
              disabled={layers.length === 0 || isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 8px 24px rgba(232,93,4,0.35)" }}
            >
              {isAddingToCart
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Adding to Cart...</>
                : <><ShoppingCart className="w-5 h-5" /> Add Custom {selectedProduct.name} to Cart</>}
            </motion.button>

            {!isMug && !isCap && (
              <p className="text-center text-xs text-gray-400">
                Size: <strong className="text-gray-600">{selectedSize}</strong> · Free shipping above ৳1,500
              </p>
            )}
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}
