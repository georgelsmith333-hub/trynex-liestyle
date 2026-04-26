import { useRef, useState, useCallback, useEffect, useMemo, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
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
  ZoomIn, ZoomOut, RotateCw,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Scissors, Info, Eye, EyeOff, Loader2, Wand2,
  Type, Layers as LayersIcon, Sparkles,
  Undo2, Redo2, Lock, Unlock, ChevronUp, ChevronDown,
  Image as ImageIcon, Check, CloudUpload,
  Box, Image as Image2D, SlidersHorizontal,
  Package, Palette, Star,
} from "lucide-react";
import {
  PRODUCTS, type DesignProduct, GarmentSVG,
  STICKERS, BASE_BY_CATEGORY,
} from "./design-studio/mockups";
import { composeLayers, composeGarmentMockup, composeDesignTexture, hasWebGL2, type ComposerLayer } from "./design-studio/composer";

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

type LeftTab  = "products" | "colors" | "stickers" | "templates";
type RightTab = "layers"   | "adjust";

const DRAFT_STORAGE_KEY = "trynex-design-draft-v1";
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
  const [leftTab,  setLeftTab]  = useState<LeftTab>("products");
  const [rightTab, setRightTab] = useState<RightTab>("layers");
  const [selectedSize, setSelectedSize] = useState("M");
  const [quantity, setQuantity] = useState(1);
  const [showPrintZone, setShowPrintZone] = useState(true);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeBgServerConfigured, setRemoveBgServerConfigured] = useState<boolean | null>(null);
  useEffect(() => {
    fetch(getApiUrl("/api/remove-bg/status"))
      .then(r => r.json())
      .then((d: { configured: boolean }) => setRemoveBgServerConfigured(d.configured))
      .catch(() => setRemoveBgServerConfigured(false));
  }, []);

  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [activeFace, setActiveFace] = useState<Face>("front");
  const supports3D = useMemo(() => hasWebGL2(), []);

  type MugMode = "side1" | "side2" | "wrap";
  const [mugMode, setMugMode] = useState<MugMode>("side1");

  const isMugProduct = selectedProduct.category === "mug";

  const supportsBack = useMemo(
    () => ["tshirt", "longsleeve", "hoodie", "mug"].includes(selectedProduct.category),
    [selectedProduct.category]
  );

  const showFaceTabs = useMemo(
    () => ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category),
    [selectedProduct.category]
  );

  useEffect(() => {
    if (!isMugProduct) return;
    setActiveFace(mugMode === "side1" ? "front" : "back");
  }, [mugMode, isMugProduct]);

  const isWrapMode = isMugProduct && mugMode === "wrap";
  useEffect(() => { if (!supportsBack) setActiveFace("front"); }, [supportsBack]);

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

  const [snapGuides, setSnapGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasDraft, setHasDraft] = useState(false);
  const [legacyDraftFound, setLegacyDraftFound] = useState<{ version: number } | null>(null);
  const draftRestoredRef = useRef(false);
  const urlInitRef = useRef(false);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const isEdit = searchParams.get("edit") === "1";

      const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<DraftPayload>;
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
    } catch { }
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
      if (sp.get("view") === "back") setActiveFace("back");
      const urlSize = sp.get("size");
      if (urlSize && ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(urlSize)) {
        setSelectedSize(urlSize);
      }
    } catch { }
    draftRestoredRef.current = true;
    urlInitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftRestoredRef.current) return;
    if (layers.length === 0) {
      if (legacyDraftFound) { setSaveStatus("idle"); return; }
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false); setSaveStatus("idle"); return;
    }
    setSaveStatus("saving");
    const handle = window.setTimeout(() => {
      try {
        const payload: DraftPayload = {
          version: DRAFT_VERSION, layers,
          productId: selectedProduct.id, color: selectedColor,
          size: selectedSize, savedAt: Date.now(),
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        setHasDraft(true); setSaveStatus("saved");
      } catch { setSaveStatus("idle"); }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [layers, selectedProduct, selectedColor, selectedSize, legacyDraftFound]);

  useEffect(() => {
    if (!urlInitRef.current) return;
    const params = new URLSearchParams();
    if (selectedProduct.id !== PRODUCTS[0].id) params.set("product", selectedProduct.id);
    if (activeFace !== "front") params.set("view", activeFace);
    if (selectedSize !== "M") params.set("size", selectedSize);
    const q = params.toString();
    const newUrl = window.location.pathname + (q ? "?" + q : "");
    if (newUrl !== window.location.pathname + window.location.search) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [selectedProduct.id, activeFace, selectedSize]);

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    setLayers([]); setSelectedLayerId(null);
    historyRef.current = { stack: [[]], index: 0 };
    forceHistoryTick(t => t + 1);
    setHasDraft(false); setSaveStatus("idle");
    toast({ title: "Draft cleared", description: "Your saved design has been removed." });
  }, [toast]);

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputAddRef = useRef<HTMLInputElement>(null);

  const pz = useMemo(
    () => (activeFace === "back" && selectedProduct.printZoneBack) ? selectedProduct.printZoneBack : selectedProduct.printZone,
    [activeFace, selectedProduct]
  );
  const pzRef = useRef(pz);
  useEffect(() => { pzRef.current = pz; }, [pz]);

  const activeFaceRef = useRef(activeFace);
  useEffect(() => { activeFaceRef.current = activeFace; }, [activeFace]);

  const perProductLayersRef = useRef<Record<string, { layers: Layer[]; stack: Layer[][]; index: number }>>({});

  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";
  const isWaterBottle = selectedProduct.category === "waterbottle";
  const effectiveSupports3D = supports3D && !isWaterBottle;

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

  const currentFaceLayers = useMemo(
    () => layers.filter(l => (l.face ?? "front") === activeFace),
    [layers, activeFace]
  );
  const otherFaceCount = layers.length - currentFaceLayers.length;

  const effectiveShowPrintZone = showPrintZone && currentFaceLayers.length === 0;

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

  const updateLayer = useCallback((id: string, mut: (l: Layer) => Layer, commit: boolean) => {
    const next = layers.map(l => (l.id === id ? mut(l) : l));
    if (commit) commitLayers(next); else setLayers(next);
  }, [layers, commitLayers]);

  const addLayer = useCallback((layer: Layer) => {
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
      const currentPz = pzRef.current;
      const aspect = img.naturalWidth / Math.max(img.naturalHeight, 1);
      const maxScaleForHeight = (currentPz.h * aspect) / currentPz.w;
      const initialScale = Math.min(0.85, maxScaleForHeight);
      const layer: ImageLayer = {
        id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
        type: "image", src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
        visible: true, locked: false,
        transform: { x: 0, y: 0, scale: initialScale, rotation: 0, opacity: 1 },
        face: activeFaceRef.current,
      };
      flushSync(() => {
        commitLayers([...layersRef.current, layer]);
        setSelectedLayerId(layer.id);
        setRightTab("adjust");
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

  const handleRemoveBg = async () => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    setIsRemoving(true);
    const applyResult = async (dataUrl: string) => {
      const img = new Image();
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = dataUrl; });
      updateLayer(selectedLayer.id, l => l.type === "image"
        ? { ...l, src: dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight }
        : l, true);
    };
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
      if (json.error === "rate_limited") {
        toast({ title: "Too many requests", description: "You've reached the removal limit. Please wait an hour and try again.", variant: "destructive" });
        setIsRemoving(false);
        return;
      }
      if (json.error === "image_too_large") {
        toast({ title: "Image too large", description: "Please reduce the image below 10 MB.", variant: "destructive" });
        setIsRemoving(false);
        return;
      }
      if (json.error === "no_api_key") {
        toast({ title: "Background removal isn't configured", description: "Admin needs to add a remove.bg API key. Trying in-browser AI as fallback…" });
      } else if (json.error === "quota_exceeded") {
        toast({ title: "Remove.bg quota exceeded", description: "Switching to in-browser processing…" });
      } else {
        console.warn("[bg-removal] server error, trying browser fallback", r.status, json);
      }
    } catch (networkErr) {
      console.warn("[bg-removal] server unreachable, trying browser", networkErr);
    }
    try {
      toast({ title: "Switching to in-browser AI…", description: "First run downloads a ~30 MB model — stays cached after." });
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
      const isNetworkErr = browserErr instanceof TypeError && (browserErr as TypeError).message.includes("fetch");
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

  const [isUpscaling, setIsUpscaling] = useState(false);
  const handleUpscale = async () => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    setIsUpscaling(true);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = selectedLayer.src; });
      try { await img.decode?.(); } catch {}
      const maxOut = 4096;
      const scale = Math.min(2, maxOut / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const c1 = document.createElement("canvas");
      c1.width = w; c1.height = h;
      const ctx1 = c1.getContext("2d")!;
      ctx1.imageSmoothingEnabled = true;
      ctx1.imageSmoothingQuality = "high";
      ctx1.drawImage(img, 0, 0, w, h);
      const c2 = document.createElement("canvas");
      c2.width = w; c2.height = h;
      const ctx2 = c2.getContext("2d")!;
      (ctx2 as any).filter = "blur(1.2px)";
      ctx2.drawImage(c1, 0, 0);
      (ctx2 as any).filter = "none";
      const orig = ctx1.getImageData(0, 0, w, h);
      const blur = ctx2.getImageData(0, 0, w, h);
      const amount = 0.6;
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

  const gestureRef = useRef<
    | { mode: "drag"; layerId: string; startSvg: { x: number; y: number }; startT: Transform }
    | { mode: "pinch"; layerId: string; startMid: { x: number; y: number }; startT: Transform }
    | null
  >(null);

  const SNAP_THRESHOLD = 6;

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
          gestureRef.current = { mode: "drag", layerId, startSvg: clientToSVG(cx, cy), startT: { ...layer.transform } };
        } else {
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
        if (gestureRef.current?.mode === "drag") commitLayers(layersRef.current);
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
        gestureRef.current = { mode: "pinch", layerId: targetId, startMid: clientToSVG(ox, oy), startT: { ...layer.transform } };
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
        if (gestureRef.current?.mode === "pinch") { commitLayers(layersRef.current); gestureRef.current = null; }
      },
    },
    {
      drag: { filterTaps: true, pointer: { touch: true }, threshold: 1 },
      pinch: { scaleBounds: { min: 0.1, max: 5 }, rubberband: true, from: () => [1, 0] },
      eventOptions: { passive: false },
    }
  );

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

  const layerGeom = (l: Layer) => {
    const cx = pz.x + pz.w / 2 + l.transform.x;
    const cy = pz.y + pz.h / 2 + l.transform.y;
    if (l.type === "image") {
      const aspect = l.naturalW / Math.max(l.naturalH, 1);
      const w = pz.w * l.transform.scale;
      const h = w / aspect;
      return { cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
    }
    const w = (l.text.length * l.fontSize * 0.55) * l.transform.scale;
    const h = l.fontSize * 1.2 * l.transform.scale;
    return { cx, cy, w, h, x: cx - w / 2, y: cy - h / 2 };
  };

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

      const originalAssets: OriginalAsset[] = [];
      const originalAssetUrls: string[] = [];
      const imageLayers = layers.filter(l => l.type === "image" && l.visible);
      for (const layer of imageLayers) {
        try {
          const imgLayer = layer as ImageLayer;
          const src = imgLayer.src;
          if (!src.startsWith("data:")) continue;
          const blob = await (await fetch(src)).blob();
          const mime = blob.type || "image/png";
          const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
          const safeName = (imgLayer.name || "design").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
          const filename = `${safeName}-${Date.now()}.${ext}`;
          const reqRes = await fetch(getApiUrl("/api/storage/uploads/request-url"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: filename, size: blob.size, contentType: mime }),
          });
          if (!reqRes.ok) continue;
          const { uploadURL, objectPath } = await reqRes.json();
          const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
          if (putRes.ok && objectPath) {
            const asset: OriginalAsset = { objectPath, filename, mime, bytes: blob.size, width: imgLayer.naturalW, height: imgLayer.naturalH };
            originalAssets.push(asset);
            originalAssetUrls.push(objectPath);
          }
        } catch (uploadErr) {
          console.warn("[upload-original]", uploadErr);
        }
      }

      const garmentBase = BASE_BY_CATEGORY[selectedProduct.category];
      const garmentSrc  = garmentBase?.front ?? displayProduct.frontSrc;
      const mockupCanvas = document.createElement("canvas");
      await composeGarmentMockup({
        canvas: mockupCanvas, garmentSrc, garmentColor: selectedColor.hex,
        printZone: frontPZ, layers: frontLayers, outSize: 400, imageCache,
      });
      const mockupUrl = mockupCanvas.toDataURL("image/webp", 0.8);

      const frontTexCanvas = document.createElement("canvas");
      if (isMug) {
        await composeLayers({
          canvas: frontTexCanvas, baseHeight: selectedProduct.baseHeight,
          printZone: frontPZ, layers: frontLayers, garmentColor: null,
          outW: 2048, outH: 768, imageCache, clipToPrintZone: true, blendMode: "multiply",
        });
      } else {
        await composeDesignTexture({
          canvas: frontTexCanvas, printZone: frontPZ, layers: frontLayers, outSize: 1024, imageCache,
        });
      }
      const frontTexUrl = frontTexCanvas.toDataURL("image/webp", 0.85);

      let backTexUrl: string | undefined;
      if (!isMug && backLayers.length > 0) {
        const backTexCanvas = document.createElement("canvas");
        await composeDesignTexture({ canvas: backTexCanvas, printZone: backPZ, layers: backLayers, outSize: 1024, imageCache });
        backTexUrl = backTexCanvas.toDataURL("image/webp", 0.85);
      }

      const sessionId = Date.now().toString(36);
      try {
        localStorage.setItem(`studio_session_${sessionId}`, JSON.stringify({
          version: DRAFT_VERSION, layers, productId: selectedProduct.id,
          color: selectedColor, size: selectedSize, savedAt: Date.now(),
        }));
      } catch { }

      addToCart({
        productId: 0, name: `Custom ${selectedProduct.name}`, price: studioPrice, quantity,
        size: isMug || isCap || isWaterBottle ? undefined : selectedSize,
        color: selectedColor.name, imageUrl: mockupUrl,
        customImages: backTexUrl ? [frontTexUrl, backTexUrl] : [frontTexUrl],
        originalAssetUrls, originalAssets,
        customNote: JSON.stringify({
          studioDesign: true, sessionId,
          product: selectedProduct.name, category: selectedProduct.category,
          color: selectedColor.name, colorHex: selectedColor.hex, size: selectedSize,
          layerCount: layers.length, frontLayerCount: frontLayers.length, backLayerCount: backLayers.length,
          mockupSrc: garmentSrc, printZone: frontPZ, printZoneBack: selectedProduct.printZoneBack ?? null,
          originalAssets, originalAssetUrls,
        }),
      });

      toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready.` });
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false); setSaveStatus("idle");
      setTimeout(() => navigate("/cart"), 800);
    } finally {
      setIsAddingToCart(false);
    }
  }, [layers, selectedProduct, displayProduct, selectedColor, selectedSize, quantity, isMug, isCap, isWaterBottle, studioPrice, pz, addToCart, toast, navigate, settings]);

  const parseColors = (raw: string) => {
    try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr as { name: string; hex: string }[]; } catch {}
    return null;
  };
  const DEFAULT_TSHIRT_COLORS: { name: string; hex: string }[] = [
    { name: "White",    hex: "#F8F7F4" }, { name: "Black",    hex: "#1a1a1a" },
    { name: "Navy",     hex: "#1e3a5f" }, { name: "Maroon",   hex: "#7f1d1d" },
    { name: "Olive",    hex: "#4a5240" }, { name: "Sky Blue", hex: "#0ea5e9" },
    { name: "Grey",     hex: "#6b7280" }, { name: "Red",      hex: "#dc2626" },
    { name: "Orange",   hex: "#E85D04" }, { name: "Yellow",   hex: "#eab308" },
    { name: "Green",    hex: "#16a34a" }, { name: "Purple",   hex: "#7c3aed" },
  ];
  const DEFAULT_MUG_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F5F5F5" }, { name: "Black", hex: "#1C1917" },
  ];
  const DEFAULT_CAP_COLORS: { name: string; hex: string }[] = [
    { name: "White", hex: "#F5F2EC" }, { name: "Black", hex: "#1a1a1a" },
  ];
  const DEFAULT_WATERBOTTLE_COLORS: { name: string; hex: string }[] = [
    { name: "White",    hex: "#F4F3F1" }, { name: "Black",  hex: "#1C1917" },
    { name: "Navy",     hex: "#1e3a5f" }, { name: "Forest", hex: "#166534" },
    { name: "Sky Blue", hex: "#0ea5e9" }, { name: "Red",    hex: "#dc2626" },
    { name: "Pink",     hex: "#f472b6" }, { name: "Teal",   hex: "#0f766e" },
  ];
  const studioColors = isMug
    ? (parseColors(settings.studioMugColors) ?? DEFAULT_MUG_COLORS)
    : isCap ? DEFAULT_CAP_COLORS
    : isWaterBottle ? DEFAULT_WATERBOTTLE_COLORS
    : (parseColors(settings.studioTshirtColors) ?? DEFAULT_TSHIRT_COLORS);

  const handleResizeDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    if (!selectedLayer || selectedLayer.locked) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const startPt = clientToSVG(e.clientX, e.clientY);
    const startT = { ...selectedLayer.transform };
    const geom = layerGeom(selectedLayer);
    const cx = geom.cx, cy = geom.cy;

    const onMove = (ev: PointerEvent) => {
      const cur = clientToSVG(ev.clientX, ev.clientY);
      const dx = cur.x - cx, dy = cur.y - cy;
      const origDx = startPt.x - cx, origDy = startPt.y - cy;
      const origDist = Math.sqrt(origDx * origDx + origDy * origDy);
      const curDist  = Math.sqrt(dx * dx + dy * dy);
      if (origDist < 1) return;
      const scaleFactor = curDist / origDist;
      const newScale = Math.max(0.1, Math.min(5, startT.scale * scaleFactor));
      const origAngle = Math.atan2(origDy, origDx) * 180 / Math.PI;
      const curAngle  = Math.atan2(dy, dx) * 180 / Math.PI;
      const newRot = startT.rotation + (curAngle - origAngle);
      setLayers(prev => prev.map(l => l.id === selectedLayer.id
        ? { ...l, transform: { ...l.transform, scale: newScale, rotation: newRot } }
        : l));
    };
    const onUp = () => {
      commitLayers(layersRef.current);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [selectedLayer, clientToSVG, layerGeom, commitLayers]);

  const layersRender = useMemo(() => layers.map(l => ({ layer: l, geom: layerGeom(l) })), [layers, pz]);
  const selGeom = selectedLayer ? layerGeom(selectedLayer) : null;

  const rotatedCorners = useMemo(() => {
    if (!selectedLayer || !selGeom) return [];
    const { cx, cy, x, y, w, h } = selGeom;
    const rot = (selectedLayer.transform.rotation * Math.PI) / 180;
    const corners = [
      { x: x,     y: y     },
      { x: x + w, y: y     },
      { x: x + w, y: y + h },
      { x: x,     y: y + h },
    ];
    return corners.map((c, i) => {
      const dx = c.x - cx, dy = c.y - cy;
      return {
        key: i,
        x: cx + dx * Math.cos(rot) - dy * Math.sin(rot),
        y: cy + dx * Math.sin(rot) + dy * Math.cos(rot),
      };
    });
  }, [selectedLayer, selGeom]);

  /* ── Product switch helper ─────────────────────────── */
  const handleProductChange = useCallback((prod: DesignProduct) => {
    perProductLayersRef.current[selectedProduct.id] = {
      layers: layersRef.current,
      stack: historyRef.current.stack,
      index: historyRef.current.index,
    };
    const saved = perProductLayersRef.current[prod.id];
    const newLayers  = saved?.layers ?? [];
    const newStack   = saved?.stack   ?? [[]];
    const newHistIdx = saved?.index   ?? 0;
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
    if (prod.category === "waterbottle") setViewMode("2d");
  }, [selectedProduct.id]);

  /* ── Add text layer helper ─────────────────────────── */
  const addTextLayer = useCallback(() => {
    const layer: TextLayer = {
      id: uid(), name: "New text", type: "text", visible: true, locked: false,
      transform: { ...ZERO_TRANSFORM },
      text: "Your text", fontFamily: FONT_FAMILIES[0].value,
      fontWeight: 700, fontStyle: "normal", fontSize: 40, color: "#111111",
    };
    addLayer(layer);
    setRightTab("adjust");
  }, [addLayer]);

  /* ── Add sticker helper ────────────────────────────── */
  const addStickerLayer = useCallback((s: (typeof STICKERS)[0]) => {
    const img = new Image();
    const finish = (w: number, h: number) => {
      addLayer({
        id: uid(), name: s.name, type: "image",
        visible: true, locked: false,
        transform: { ...ZERO_TRANSFORM, scale: 0.4 },
        src: s.dataUrl, naturalW: w, naturalH: h,
      });
      setRightTab("adjust");
    };
    img.onload  = () => finish(img.naturalWidth || 100, img.naturalHeight || 100);
    img.onerror = () => {
      finish(100, 100);
      toast({ title: "Sticker added", description: "Couldn't render a preview, but the shape was placed." });
    };
    img.src = s.dataUrl;
  }, [addLayer, toast]);

  /* ── Apply template helper ─────────────────────────── */
  const applyTemplate = useCallback((t: Template) => {
    const newLayers = t.create().map(l => ({ ...l, face: activeFaceRef.current }));
    commitLayers([...layersRef.current, ...newLayers]);
    if (newLayers.length > 0) setSelectedLayerId(newLayers[newLayers.length - 1].id);
    setRightTab("adjust");
    toast({ title: `✓ "${t.name}" applied`, description: "Customize it in the Adjust panel." });
  }, [commitLayers, toast]);

  /* ─────────────────────────────────────────────────────
     JSX
  ───────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col" style={{ height: "100dvh", overflow: "hidden", background: "#FAF8F5" }}>
      <SEOHead
        title="Design Studio — TryNex Lifestyle"
        description="Create custom printed products with your own designs. Add text, images, and stickers."
        canonical="/customize"
      />

      {/* Navbar */}
      <div className="flex-shrink-0">
        <Navbar />
      </div>

      {/* ══ STUDIO WORKSPACE ══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ══════ LEFT SIDEBAR ══════ */}
        <aside className="hidden lg:flex flex-col border-r"
          style={{ width: 264, minWidth: 264, background: "white", borderColor: "#E8E4DF" }}>

          {/* Sidebar header */}
          <div className="px-4 py-3 border-b" style={{ borderColor: "#E8E4DF" }}>
            <h2 className="text-sm font-black text-gray-900">Design Studio</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Customize your product</p>
          </div>

          {/* Left tab strip */}
          <div className="grid grid-cols-4 border-b" style={{ borderColor: "#E8E4DF" }}>
            {([
              { id: "products"  as LeftTab, icon: Package,  label: "Products" },
              { id: "colors"    as LeftTab, icon: Palette,  label: "Colors"   },
              { id: "stickers"  as LeftTab, icon: Star,     label: "Stickers" },
              { id: "templates" as LeftTab, icon: Sparkles, label: "Tpls"     },
            ]).map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setLeftTab(id)}
                className="flex flex-col items-center gap-1 py-2.5 text-[9px] font-black uppercase tracking-wider transition-colors"
                style={{
                  color: leftTab === id ? "#E85D04" : "#9ca3af",
                  borderBottom: leftTab === id ? "2px solid #E85D04" : "2px solid transparent",
                  marginBottom: -1,
                }}>
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Left tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── PRODUCTS ── */}
            {leftTab === "products" && (
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">Choose Product</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRODUCTS.map(prod => {
                    const isSel = selectedProduct.id === prod.id;
                    return (
                      <button key={prod.id} onClick={() => handleProductChange(prod)}
                        className="relative text-left rounded-xl overflow-hidden border-2 transition-all hover:shadow-md"
                        style={{
                          borderColor: isSel ? "#E85D04" : "#F0EDE8",
                          background: isSel ? "#FFF8F4" : "white",
                          boxShadow: isSel ? "0 0 0 1px rgba(232,93,4,0.15)" : undefined,
                        }}>
                        {isSel && (
                          <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: "#E85D04" }}>
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <div className="p-2 pb-1">
                          <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center"
                            style={{ background: "#F7F4F0" }}>
                            <img src={prod.frontSrc} alt={prod.name}
                              className="w-full h-full object-contain p-1.5"
                              style={{ mixBlendMode: "multiply" }} />
                          </div>
                        </div>
                        <div className="px-2 pb-2">
                          <p className="text-[11px] font-black text-gray-800 truncate">{prod.icon} {prod.name}</p>
                          <p className="text-[9px] text-gray-400 mt-0.5">৳{(isMug || prod.category === "waterbottle" ? settings.studioMugPrice || 799 : settings.studioTshirtPrice || 1099).toLocaleString()}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── COLORS ── */}
            {leftTab === "colors" && (
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2.5">Garment Color</p>
                <div className="grid grid-cols-3 gap-2">
                  {studioColors.map(c => {
                    const isSel = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                    const isLight = parseInt(c.hex.replace("#","").slice(0,2),16) > 230 && parseInt(c.hex.replace("#","").slice(2,4),16) > 230;
                    return (
                      <button key={c.hex} onClick={() => setSelectedColor({ name: c.name, hex: c.hex })}
                        className="flex flex-col items-center gap-1.5 py-2 px-1 rounded-xl border-2 transition-all hover:scale-[1.04]"
                        style={{
                          borderColor: isSel ? "#E85D04" : "transparent",
                          background: isSel ? "#FFF8F4" : "#F9F8F6",
                        }}>
                        <div className="w-9 h-9 rounded-full border-2 transition-all"
                          style={{
                            background: c.hex,
                            borderColor: isLight ? "#d1d5db" : c.hex,
                            boxShadow: isSel ? "0 0 0 3px rgba(232,93,4,0.25)" : "0 1px 4px rgba(0,0,0,0.1)",
                          }} />
                        <span className="text-[10px] font-bold text-gray-700 text-center leading-tight">{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STICKERS ── */}
            {leftTab === "stickers" && (
              <div className="p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Tap to Add</p>
                <p className="text-[10px] text-gray-400 mb-3">{STICKERS.length} vector shapes available</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {STICKERS.map(s => (
                    <button key={s.id} data-testid={`sticker-${s.id}`} title={s.name}
                      onClick={() => addStickerLayer(s)}
                      className="aspect-square rounded-xl flex items-center justify-center p-2 border transition-all hover:border-orange-300 hover:bg-orange-50 hover:scale-110"
                      style={{ background: "white", borderColor: "#E8E4DF" }}>
                      <img src={s.dataUrl} alt={s.name} className="w-full h-full object-contain pointer-events-none" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── TEMPLATES ── */}
            {leftTab === "templates" && (
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Text Templates</p>
                <p className="text-[10px] text-gray-400 mb-3">Tap to add editable text layers</p>
                {TEMPLATES.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)}
                    className="w-full p-3 rounded-xl border text-left transition-all hover:border-orange-300 hover:bg-orange-50 group"
                    style={{ background: "#F9F8F6", borderColor: "#E8E4DF" }}>
                    <p className="text-sm font-black text-gray-800 whitespace-pre group-hover:text-orange-600 transition-colors">{t.preview}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{t.name}</p>
                  </button>
                ))}
                <div className="mt-3 p-3 rounded-xl text-[10px] text-gray-500 flex items-start gap-2"
                  style={{ background: "#fff8f4", border: "1px solid #fdd5b4" }}>
                  <Info className="w-3 h-3 shrink-0 mt-0.5 text-orange-400" />
                  Tap a template to add it, then adjust it from the right panel.
                </div>
              </div>
            )}

          </div>
        </aside>

        {/* ══════ CENTER: CANVAS ══════ */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden" style={{ background: "#F0EDE8" }}>

          {/* Canvas toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b bg-white gap-2 overflow-x-auto"
            style={{ borderColor: "#E8E4DF" }}>

            {/* Left: Product (mobile) + Face/Mug tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin flex-shrink-0">

              {/* Mobile product selector */}
              <div className="flex lg:hidden gap-1 shrink-0">
                {PRODUCTS.map(p => (
                  <button key={p.id} onClick={() => handleProductChange(p)} title={p.name}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-base transition-all shrink-0"
                    style={{
                      background: selectedProduct.id === p.id ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#F3F4F6",
                      boxShadow: selectedProduct.id === p.id ? "0 2px 6px rgba(232,93,4,0.35)" : undefined,
                    }}>
                    {p.icon}
                  </button>
                ))}
              </div>

              {/* Divider mobile */}
              <div className="lg:hidden w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

              {/* Face tabs — apparel */}
              {showFaceTabs && viewMode === "2d" && (
                <div className="flex items-center gap-1 shrink-0" data-testid="face-switcher">
                  {(["front", "back"] as const).map(f => (
                    <button key={f} onClick={() => setActiveFace(f)}
                      data-testid={`face-${f}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                      style={{
                        background: activeFace === f ? "#1f2937" : "#F3F4F6",
                        color: activeFace === f ? "white" : "#6b7280",
                      }}>
                      {f === "front" ? "Front" : "Back"}
                    </button>
                  ))}
                  {activeFace === "back" && currentFaceLayers.length === 0 && (() => {
                    const frontL = layers.filter(l => (l.face ?? "front") === "front");
                    if (!frontL.length) return null;
                    return (
                      <button onClick={() => {
                        const cloned = frontL.map(l => ({ ...l, id: `${l.id}-b-${uid()}`, face: "back" as const }));
                        commitLayers([...layers, ...cloned]);
                      }}
                        data-testid="mirror-front-to-back"
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white shrink-0"
                        style={{ background: "linear-gradient(135deg,#E85D04,#F48C06)" }}>
                        ↻ Mirror front
                      </button>
                    );
                  })()}
                  {otherFaceCount > 0 && (
                    <span className="px-2 py-1.5 text-[10px] font-bold text-gray-500 rounded-lg shrink-0"
                      style={{ background: "#F3F4F6" }}>
                      +{otherFaceCount} on {activeFace === "front" ? "back" : "front"}
                    </span>
                  )}
                </div>
              )}

              {/* Mug mode tabs */}
              {isMugProduct && viewMode === "2d" && (
                <div className="flex items-center gap-1 shrink-0" data-testid="mug-mode-switcher">
                  {([
                    { v: "side1" as MugMode, l: "Side 1" },
                    { v: "side2" as MugMode, l: "Side 2" },
                    { v: "wrap"  as MugMode, l: "Full Wrap" },
                  ]).map(({ v, l }) => (
                    <button key={v} onClick={() => setMugMode(v)}
                      data-testid={`mug-mode-${v}`}
                      className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                      style={{
                        background: mugMode === v ? "#1f2937" : "#F3F4F6",
                        color: mugMode === v ? "white" : "#6b7280",
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Save status */}
              {(saveStatus !== "idle" || hasDraft) && (
                <div className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                  style={{
                    background: saveStatus === "saved" ? "#ECFDF5" : "#F3F4F6",
                    color: saveStatus === "saved" ? "#047857" : "#6b7280",
                  }}
                  data-testid="draft-status">
                  {saveStatus === "saving"
                    ? <><CloudUpload className="w-3 h-3 animate-pulse" /> Saving</>
                    : <><Check className="w-3 h-3" /> Saved</>}
                </div>
              )}

              {/* Undo / Redo */}
              <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-lg text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)"
                className="p-1.5 rounded-lg text-gray-500 disabled:opacity-30 hover:bg-gray-100 transition-colors">
                <Redo2 className="w-4 h-4" />
              </button>

              {/* 2D / 3D toggle */}
              {effectiveSupports3D && (
                <div className="hidden sm:flex rounded-lg overflow-hidden border border-gray-200" data-testid="view-mode-toggle">
                  <button onClick={() => setViewMode("2d")} title="2D editor"
                    data-testid="view-mode-2d"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors"
                    style={{ background: viewMode === "2d" ? "#FFF4EE" : "white", color: viewMode === "2d" ? "#E85D04" : "#6b7280" }}>
                    <Image2D className="w-3 h-3" /> 2D
                  </button>
                  <button onClick={() => setViewMode("3d")} title="3D preview"
                    data-testid="view-mode-3d"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold transition-colors border-l border-gray-200"
                    style={{ background: viewMode === "3d" ? "#FFF4EE" : "white", color: viewMode === "3d" ? "#E85D04" : "#6b7280" }}>
                    <Box className="w-3 h-3" /> 3D
                  </button>
                </div>
              )}

              {/* Print zone toggle */}
              <button onClick={() => setShowPrintZone(v => !v)} title="Toggle print area"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: showPrintZone ? "#FFF4EE" : "#F3F4F6",
                  color: showPrintZone ? "#E85D04" : "#6b7280",
                }}>
                {showPrintZone ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span className="hidden md:inline">Print Area</span>
              </button>

              {/* Clear all */}
              {layers.length > 0 && (
                <button onClick={clearDraft} title="Clear all layers"
                  data-testid="clear-draft"
                  className="hidden sm:flex p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              {/* Add to Cart shortcut */}
              <motion.button onClick={handleAddToCart} disabled={isAddingToCart}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 4px 12px rgba(232,93,4,0.3)" }}>
                {isAddingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                <span className="hidden md:inline">Add to Cart</span>
              </motion.button>
            </div>
          </div>

          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden"
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
            <div className="relative flex items-center justify-center w-full h-full">
              <div className="relative select-none"
                style={{
                  width: "min(100%, min(calc(100vh - 260px), 520px))",
                  aspectRatio: String(selectedProduct.aspect),
                }}>

                {/* Canvas card */}
                <div className="absolute inset-0 rounded-2xl sm:rounded-3xl overflow-hidden"
                  style={{
                    background: "radial-gradient(ellipse at 50% 40%, #F5F2EE 0%, #ECE8E2 60%, #E0DDD8 100%)",
                    boxShadow: "0 8px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
                  }}>

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
                        style={{ background: "rgba(0,0,0,0.6)" }}>
                        Drag to rotate · Scroll to zoom
                      </div>
                      {layers.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="text-center px-6 py-5 rounded-2xl"
                            style={{ background: "rgba(255,255,255,0.88)", border: "2px dashed rgba(232,93,4,0.3)" }}>
                            <Upload className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                            <p className="font-black text-gray-800 text-sm">No design yet</p>
                            <p className="text-xs text-gray-500">Switch to 2D to add layers</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Face label badge */}
                      {supportsBack && (
                        <AnimatePresence mode="wait">
                          <motion.div key={activeFace}
                            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}
                            className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest z-10 pointer-events-none"
                            style={{ background: "rgba(17,24,39,0.7)", color: "white", letterSpacing: "0.1em" }}>
                            {activeFace}
                          </motion.div>
                        </AnimatePresence>
                      )}

                      {/* SVG canvas */}
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.svg
                          key={`${selectedProduct.id}-${activeFace}`}
                          ref={svgRef}
                          viewBox={selectedProduct.viewBox}
                          className="absolute inset-0 w-full h-full"
                          style={{ touchAction: "none", userSelect: "none" }}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          transition={{ duration: 0.18, ease: "easeInOut" }}
                          {...(bindCanvasGestures() as Record<string, unknown>)}
                        >
                          <GarmentSVG product={displayProduct} color={selectedColor.hex} showPrintZone={effectiveShowPrintZone} face={activeFace} />

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
                                    <image key={l.id} data-layer-id={l.id} href={l.src}
                                      x={g.x} y={g.y} width={g.w} height={g.h}
                                      opacity={l.transform.opacity}
                                      transform={`rotate(${l.transform.rotation},${g.cx},${g.cy})`}
                                      preserveAspectRatio="none"
                                      style={{ cursor: l.locked ? "not-allowed" : "grab" }} />
                                  );
                                }
                                return (
                                  <text key={l.id} data-layer-id={l.id}
                                    x={g.cx} y={g.cy} fill={l.color}
                                    fontFamily={l.fontFamily} fontWeight={l.fontWeight} fontStyle={l.fontStyle}
                                    fontSize={l.fontSize * l.transform.scale} opacity={l.transform.opacity}
                                    textAnchor="middle" dominantBaseline="middle"
                                    transform={`rotate(${l.transform.rotation},${g.cx},${g.cy})`}
                                    style={{ cursor: l.locked ? "not-allowed" : "grab", userSelect: "none", mixBlendMode: "multiply" }}>
                                    {l.text}
                                  </text>
                                );
                              })}
                          </g>

                          {/* Selection outline */}
                          {selectedLayer && selGeom && (
                            <g pointerEvents="none">
                              <rect x={selGeom.x} y={selGeom.y} width={selGeom.w} height={selGeom.h}
                                fill="none" stroke="#E85D04" strokeWidth="1.5" strokeDasharray="4 3"
                                transform={`rotate(${selectedLayer.transform.rotation},${selGeom.cx},${selGeom.cy})`} />
                            </g>
                          )}
                          {/* Resize handles */}
                          {selectedLayer && rotatedCorners.map(h => (
                            <circle key={h.key} cx={h.x} cy={h.y} r={7}
                              fill="white" stroke="#E85D04" strokeWidth="2"
                              style={{ cursor: "nwse-resize", touchAction: "none", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.2))" }}
                              onPointerDown={handleResizeDown} />
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

                      {/* Empty state drop zone */}
                      {currentFaceLayers.length === 0 && (
                        <div
                          className="absolute inset-0 flex items-center justify-center cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={handleDrop} onDragOver={e => e.preventDefault()}
                          role="button" tabIndex={0}
                          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
                          aria-label="Upload image">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center px-8 py-6 rounded-2xl"
                            style={{ background: "rgba(255,255,255,0.88)", border: "2px dashed rgba(232,93,4,0.3)" }}>
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                              style={{ background: "linear-gradient(135deg,#FFF4EE,#FFE8D4)" }}>
                              <Upload className="w-6 h-6 text-orange-500" />
                            </div>
                            <p className="font-black text-gray-800 mb-1">Upload your design</p>
                            <p className="text-sm text-gray-500 mb-1">Drag & drop or tap to browse</p>
                            <p className="text-xs text-gray-400">JPG, PNG, WebP · Max 10MB</p>
                            <div className="flex items-center justify-center gap-3 mt-3">
                              <button
                                onClick={e => { e.stopPropagation(); addTextLayer(); }}
                                className="text-xs font-bold text-orange-500 hover:underline">
                                + Add text
                              </button>
                              <span className="text-gray-300">·</span>
                              <button
                                onClick={e => { e.stopPropagation(); setLeftTab("stickers"); }}
                                className="text-xs font-bold text-orange-500 hover:underline">
                                Browse stickers
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile bottom: color swatches + add to cart */}
          <div className="lg:hidden flex-shrink-0 bg-white border-t px-4 py-3" style={{ borderColor: "#E8E4DF" }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-0.5">
                {studioColors.slice(0, 10).map(c => {
                  const isSel = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                  const isLight = parseInt(c.hex.replace("#","").slice(0,2),16) > 230;
                  return (
                    <button key={c.hex} title={c.name} onClick={() => setSelectedColor({ name: c.name, hex: c.hex })}
                      className="w-7 h-7 rounded-full border-2 shrink-0 transition-transform hover:scale-110"
                      style={{
                        background: c.hex,
                        borderColor: isSel ? "#E85D04" : isLight ? "#d1d5db" : c.hex,
                        boxShadow: isSel ? "0 0 0 2px rgba(232,93,4,0.3)" : undefined,
                      }} />
                  );
                })}
              </div>
              <motion.button onClick={handleAddToCart} disabled={isAddingToCart}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white shrink-0 disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}>
                {isAddingToCart ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                Add ৳{studioPrice.toLocaleString()}
              </motion.button>
            </div>
          </div>
        </main>

        {/* ══════ RIGHT PANEL ══════ */}
        <aside className="hidden lg:flex flex-col border-l"
          style={{ width: 288, minWidth: 288, background: "white", borderColor: "#E8E4DF" }}>

          {/* Quick add row */}
          <div className="flex gap-2 p-3 border-b" style={{ borderColor: "#E8E4DF" }}>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all hover:border-orange-300 hover:bg-orange-50 text-gray-700"
              style={{ borderColor: "#E8E4DF" }}>
              <Upload className="w-3.5 h-3.5 text-orange-500" /> Upload Image
            </button>
            <button onClick={addTextLayer}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border transition-all hover:border-orange-300 hover:bg-orange-50 text-gray-700"
              style={{ borderColor: "#E8E4DF" }}>
              <Type className="w-3.5 h-3.5 text-orange-500" /> Add Text
            </button>
          </div>

          {/* Right tab strip */}
          <div className="grid grid-cols-2 border-b" style={{ borderColor: "#E8E4DF" }}>
            {([
              { id: "layers" as RightTab, icon: LayersIcon, label: "Layers" },
              { id: "adjust" as RightTab, icon: SlidersHorizontal, label: "Adjust" },
            ]).map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setRightTab(id)}
                className="flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors"
                style={{
                  color: rightTab === id ? "#E85D04" : "#9ca3af",
                  borderBottom: rightTab === id ? "2px solid #E85D04" : "2px solid transparent",
                  marginBottom: -1,
                }}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          {/* Right tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* ── LAYERS TAB ── */}
            {rightTab === "layers" && (
              <div className="p-3 space-y-1.5">
                {layers.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <LayersIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">No layers yet</p>
                    <p className="text-[10px] mt-1">Upload an image or add text</p>
                  </div>
                ) : (
                  [...layers].reverse().map(l => {
                    const isSel = selectedLayerId === l.id;
                    return (
                      <div key={l.id}
                        onClick={() => { setSelectedLayerId(l.id); setRightTab("adjust"); }}
                        className="flex items-center gap-2 p-2 rounded-xl cursor-pointer border-2 transition-all hover:border-orange-200"
                        style={{
                          background: isSel ? "#FFF8F4" : "white",
                          borderColor: isSel ? "#FDD5B4" : "#F0EDE8",
                        }}>
                        <button onClick={e => { e.stopPropagation(); updateLayer(l.id, x => ({ ...x, visible: !x.visible }), true); }}
                          className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                          {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        </button>
                        {l.type === "image" ? (
                          <img src={l.src} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 8px 8px" }} />
                        ) : (
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black"
                            style={{ background: "#F3F4F6", color: (l as TextLayer).color }}>T</div>
                        )}
                        <span className="text-[11px] font-bold text-gray-700 truncate flex-1">{l.name}</span>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <button onClick={e => { e.stopPropagation(); moveLayer(l.id, 1); }}
                            className="p-1 text-gray-300 hover:text-gray-600 transition-colors" title="Bring forward">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); moveLayer(l.id, -1); }}
                            className="p-1 text-gray-300 hover:text-gray-600 transition-colors" title="Send backward">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); updateLayer(l.id, x => ({ ...x, locked: !x.locked }), true); }}
                            className="p-1 text-gray-300 hover:text-gray-600 transition-colors" title="Lock/unlock">
                            {l.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          </button>
                          <button onClick={e => { e.stopPropagation(); removeLayer(l.id); }}
                            className="p-1 text-red-400 hover:text-red-600 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── ADJUST TAB ── */}
            {rightTab === "adjust" && (
              <div className="p-3">
                {!selectedLayer ? (
                  <div className="text-center py-10 text-gray-400">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">Nothing selected</p>
                    <p className="text-[10px] mt-1">Click a layer to adjust it</p>
                  </div>
                ) : (
                  <div className="space-y-4">

                    {/* Layer preview */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "#F9F8F6" }}>
                      {selectedLayer.type === "image" ? (
                        <img src={(selectedLayer as ImageLayer).src} alt=""
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          style={{ background: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%) 0 0 / 8px 8px" }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl font-black"
                          style={{ background: "white", color: (selectedLayer as TextLayer).color }}>T</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-gray-800 truncate">{selectedLayer.name}</p>
                        <p className="text-[10px] text-gray-400">{selectedLayer.type === "image" ? "Image layer" : "Text layer"}</p>
                      </div>
                    </div>

                    {/* Text controls */}
                    {selectedLayer.type === "text" && (() => {
                      const tl = selectedLayer as TextLayer;
                      return (
                        <div className="space-y-3 p-3 rounded-xl" style={{ background: "#F9F8F6" }}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Text Content</p>
                          <input value={tl.text}
                            onChange={e => updateLayer(tl.id, l => l.type === "text" ? { ...l, text: e.target.value, name: e.target.value || "Text" } : l, false)}
                            onBlur={() => commitLayers(layers)}
                            className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                            style={{ borderColor: "#E8E4DF" }} />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">Font</label>
                              <select value={tl.fontFamily}
                                onChange={e => updateLayer(tl.id, l => l.type === "text" ? { ...l, fontFamily: e.target.value } : l, true)}
                                className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none"
                                style={{ borderColor: "#E8E4DF" }}>
                                {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">Size</label>
                              <input type="number" min={8} max={200} value={tl.fontSize}
                                onChange={e => updateLayer(tl.id, l => l.type === "text" ? { ...l, fontSize: Math.max(8, Math.min(200, parseInt(e.target.value) || 12)) } : l, false)}
                                onBlur={() => commitLayers(layers)}
                                className="w-full px-2 py-1.5 rounded-lg text-xs border outline-none"
                                style={{ borderColor: "#E8E4DF" }} />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">Color</label>
                              <input type="color" value={tl.color}
                                onChange={e => updateLayer(tl.id, l => l.type === "text" ? { ...l, color: e.target.value } : l, false)}
                                onBlur={() => commitLayers(layers)}
                                className="w-full h-9 rounded-lg border cursor-pointer"
                                style={{ borderColor: "#E8E4DF" }} />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-1">Style</label>
                              <div className="flex gap-1.5">
                                <button onClick={() => updateLayer(tl.id, l => l.type === "text" ? { ...l, fontWeight: l.fontWeight >= 800 ? 400 : 800 } : l, true)}
                                  className="flex-1 py-1.5 rounded-lg text-xs font-black border transition-all"
                                  style={{
                                    background: tl.fontWeight >= 800 ? "#FFF4EE" : "white",
                                    color: tl.fontWeight >= 800 ? "#E85D04" : "#374151",
                                    borderColor: tl.fontWeight >= 800 ? "#FDD5B4" : "#E8E4DF",
                                  }}>B</button>
                                <button onClick={() => updateLayer(tl.id, l => l.type === "text" ? { ...l, fontStyle: l.fontStyle === "italic" ? "normal" : "italic" } : l, true)}
                                  className="flex-1 py-1.5 rounded-lg text-xs italic font-bold border transition-all"
                                  style={{
                                    background: tl.fontStyle === "italic" ? "#FFF4EE" : "white",
                                    color: tl.fontStyle === "italic" ? "#E85D04" : "#374151",
                                    borderColor: tl.fontStyle === "italic" ? "#FDD5B4" : "#E8E4DF",
                                  }}>I</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Transform controls */}
                    <div className="space-y-3.5 p-3 rounded-xl" style={{ background: "#F9F8F6" }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transform</p>

                      {/* Scale */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-gray-500">Scale</label>
                          <span className="text-[10px] font-bold text-gray-600">{Math.round(selectedLayer.transform.scale * 100)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: Math.max(0.1, l.transform.scale - 0.05) } }), true)}
                            className="p-1 text-gray-400 hover:text-orange-500"><ZoomOut className="w-3.5 h-3.5" /></button>
                          <input type="range" min="10" max="300" step="5"
                            value={Math.round(selectedLayer.transform.scale * 100)}
                            onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: parseInt(e.target.value) / 100 } }), false)}
                            onPointerUp={() => commitLayers(layers)}
                            className="flex-1 h-1.5 rounded-full appearance-none" style={{ accentColor: "#E85D04" }} />
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, scale: Math.min(5, l.transform.scale + 0.05) } }), true)}
                            className="p-1 text-gray-400 hover:text-orange-500"><ZoomIn className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {/* Rotation */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-gray-500">Rotation</label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-600">{Math.round(selectedLayer.transform.rotation)}°</span>
                            <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: 0 } }), true)}
                              className="text-[9px] text-orange-500 font-bold hover:underline">Reset</button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: l.transform.rotation - 5 } }), true)}
                            className="p-1 text-gray-400 hover:text-orange-500"><RotateCcw className="w-3.5 h-3.5" /></button>
                          <input type="range" min="-180" max="180" step="1"
                            value={selectedLayer.transform.rotation}
                            onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: parseInt(e.target.value) } }), false)}
                            onPointerUp={() => commitLayers(layers)}
                            className="flex-1 h-1.5 rounded-full appearance-none" style={{ accentColor: "#E85D04" }} />
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, rotation: l.transform.rotation + 5 } }), true)}
                            className="p-1 text-gray-400 hover:text-orange-500"><RotateCw className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {/* Opacity */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-gray-500">Opacity</label>
                          <span className="text-[10px] font-bold text-gray-600">{Math.round(selectedLayer.transform.opacity * 100)}%</span>
                        </div>
                        <input type="range" min="10" max="100" step="5"
                          value={Math.round(selectedLayer.transform.opacity * 100)}
                          onChange={e => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, opacity: parseInt(e.target.value) / 100 } }), false)}
                          onPointerUp={() => commitLayers(layers)}
                          className="w-full h-1.5 rounded-full appearance-none" style={{ accentColor: "#E85D04" }} />
                      </div>

                      {/* Position nudge */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 mb-1.5">Position</p>
                        <div className="grid grid-cols-3 gap-1 w-28 mx-auto">
                          <div />
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, y: l.transform.y - 4 } }), true)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center">
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <div />
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, x: l.transform.x - 4 } }), true)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center">
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...ZERO_TRANSFORM, scale: l.transform.scale, rotation: l.transform.rotation, opacity: l.transform.opacity } }), true)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center" title="Center">
                            <RotateCcw className="w-3 h-3" />
                          </button>
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, x: l.transform.x + 4 } }), true)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center">
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <div />
                          <button onClick={() => updateLayer(selectedLayer.id, l => ({ ...l, transform: { ...l.transform, y: l.transform.y + 4 } }), true)}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center">
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <div />
                        </div>
                      </div>
                    </div>

                    {/* AI tools (image only) */}
                    {selectedLayer.type === "image" && (
                      <div className="space-y-2 p-3 rounded-xl" style={{ background: "#F9F8F6" }}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">✨ AI Tools</p>
                        {removeBgServerConfigured === false && (
                          <p className="text-[10px] text-amber-600 leading-tight">
                            In-browser AI fallback active — admin can enable cloud processing in{" "}
                            <a href="/admin/settings" className="underline font-semibold">Settings</a>
                          </p>
                        )}
                        <button onClick={handleRemoveBg} disabled={isRemoving || isUpscaling}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01]"
                          style={{ background: "linear-gradient(135deg,#FFF4EE,#FFE4CC)", color: "#E85D04", border: "1.5px solid #FDD5B4" }}>
                          {isRemoving
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing…</>
                            : <><Scissors className="w-4 h-4" /> Remove Background</>}
                        </button>
                        <button onClick={handleUpscale} disabled={isRemoving || isUpscaling}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.01]"
                          style={{ background: "linear-gradient(135deg,#FEF3C7,#FDE68A)", color: "#92400E", border: "1.5px solid #FCD34D" }}>
                          {isUpscaling
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Upscaling…</>
                            : <><Wand2 className="w-4 h-4" /> Upscale 2× HD</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Cart footer ── */}
          <div className="flex-shrink-0 border-t p-4 space-y-3" style={{ borderColor: "#E8E4DF" }}>

            {/* Size picker (apparel only) */}
            {!isMug && !isCap && !isWaterBottle && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Size</label>
                  <details className="group">
                    <summary className="text-[10px] text-orange-500 font-bold cursor-pointer list-none hover:underline">
                      Size guide ▾
                    </summary>
                    <div className="absolute right-3 mt-1 z-50 rounded-xl overflow-hidden border border-gray-100 shadow-lg bg-white"
                      style={{ width: 200 }}>
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr style={{ background: "#F9F8F6" }}>
                            <th className="px-2 py-1.5 text-left font-black text-gray-600">Size</th>
                            <th className="px-2 py-1.5 text-left font-black text-gray-600">Chest"</th>
                            <th className="px-2 py-1.5 text-left font-black text-gray-600">Length"</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SIZE_CHART.map((row, i) => (
                            <tr key={row.size} className="border-t border-gray-50"
                              style={{ background: selectedSize === row.size ? "#FFF8F4" : i % 2 === 0 ? "white" : "#FAFAF8" }}>
                              <td className="px-2 py-1 font-black" style={{ color: selectedSize === row.size ? "#E85D04" : "#111" }}>{row.size}</td>
                              <td className="px-2 py-1 text-gray-600">{row.chest}</td>
                              <td className="px-2 py-1 text-gray-600">{row.length}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {SIZE_CHART.map(s => (
                    <button key={s.size} onClick={() => setSelectedSize(s.size)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-black transition-all"
                      style={{
                        background: selectedSize === s.size ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#F3F4F6",
                        color: selectedSize === s.size ? "white" : "#374151",
                        boxShadow: selectedSize === s.size ? "0 2px 8px rgba(232,93,4,0.3)" : undefined,
                      }}>
                      {s.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-600">Quantity</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-gray-700 disabled:opacity-40 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  style={{ background: "#F3F4F6", border: "1px solid #E8E4DF" }}>−</button>
                <span className="text-sm font-black text-gray-900 w-6 text-center">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(50, q + 1))} disabled={quantity >= 50}
                  className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-gray-700 disabled:opacity-40 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  style={{ background: "#F3F4F6", border: "1px solid #E8E4DF" }}>+</button>
              </div>
            </div>

            {/* Price summary */}
            <div className="flex items-center justify-between py-2 border-t" style={{ borderColor: "#E8E4DF" }}>
              <span className="text-sm font-bold text-gray-500">
                {quantity > 1 ? `${quantity} × ৳${studioPrice.toLocaleString()}` : "Price"}
              </span>
              <span className="text-lg font-black" style={{ color: "#E85D04" }}>
                ৳{(studioPrice * quantity).toLocaleString()}
              </span>
            </div>

            {/* Free shipping indicator */}
            {(() => {
              const subtotal = studioPrice * quantity;
              const freeShip = subtotal >= 1500;
              return (
                <p className={`text-[10px] text-center font-bold ${freeShip ? "text-green-600" : "text-gray-400"}`}>
                  {freeShip
                    ? "✓ Free shipping included!"
                    : `৳${(1500 - subtotal).toLocaleString()} more for free shipping`}
                </p>
              );
            })()}

            {/* Add to Cart */}
            <motion.button onClick={handleAddToCart} disabled={isAddingToCart}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-base text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.32)" }}>
              {isAddingToCart
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Adding to Cart…</>
                : <><ShoppingCart className="w-5 h-5" /> Add to Cart</>}
            </motion.button>

            {layers.length === 0 && (
              <p className="text-[10px] text-gray-400 text-center">Add a design first to enable Add to Cart</p>
            )}
          </div>
        </aside>

      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />
      <input ref={fileInputAddRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }} />

      {/* Legacy draft dialog */}
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
    </div>
  );
}
