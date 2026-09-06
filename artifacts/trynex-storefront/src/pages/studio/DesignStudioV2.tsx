import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions, type OriginalAsset } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, RotateCcw, Trash2, ShoppingCart, ZoomIn, ZoomOut, RotateCw,
  Move, Ruler, ArrowUp, ArrowDown, Scissors, Info, Eye, EyeOff, Loader2,
  Wand2, Type, Layers as LayersIcon, Sparkles, Undo2, Redo2, Lock, Unlock,
  ChevronUp, ChevronDown, Image as ImageIcon, Plus, Check, CloudUpload,
  Search, X, ChevronRight, Palette, Package, FlipHorizontal, Copy,
  Crosshair, Maximize2, Download, AlignLeft, AlignCenter, AlignRight,
  ShieldCheck,
} from "lucide-react";
import {
  PRODUCTS, GarmentSVG, FlatZoneSVG, MUG_PZ, MUG_WRAP_BACK_PZ, MUG_SIDE_PZ, MUG_SIDE_BACK_PZ, resolveMockup,
  getActiveMockupReleaseVersion, getApparelZones, getZonePZ, type ApparelZone, isNearBlack, isLightTint,
  type PrintZone, type DesignProduct, type Face,
} from "../design-studio/mockups";
import {
  composeMockupSurface, composeMockupSurfaceTexture, autoFixImage,
  type ComposerLayer,
} from "../design-studio/composer";

import { useDesignStore } from "@/hooks/useDesignStore";
import { LayerPanel } from "./panels/LayerPanel";
import { TextPanel } from "./panels/TextPanel";
import { ImagePanel } from "./panels/ImagePanel";
import { ShapePanel } from "./panels/ShapePanel";
import { MainToolbar } from "./toolbar/MainToolbar";
import { ProductSwitcher } from "./toolbar/ProductSwitcher";
import { CanvasArea } from "./CanvasArea";
import { AIPanel } from "./AIPanel";
import { fitImageTransform } from "./autoFit";
import { ClipArtBrowser } from "./ClipArtBrowser";
import { QRCodePanel } from "./QRCodePanel";
import { FONT_FAMILIES, type Layer, type ImageLayer, type TextLayer, type ShapeLayer, DRAFT_VERSION } from "./types";
import { StudioFirstUseGuide, StudioQualityBanner } from "./v1-components/V1StudioSupport";

const LazyProductViewer3D = lazy(() => import("../design-studio/ProductViewer3D"));

function getSwitchPrintZone(
  face: Face,
  product: DesignProduct,
  colorHex: string,
  mugMode: "side1" | "side2" | "wrap",
): PrintZone {
  if (product.category === "mug") {
    if (mugMode === "wrap") return face === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ;
    return face === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
  }
  return getZonePZ(face, product, colorHex);
}

const DRAFT_STORAGE_KEY = "trynex-design-draft-v2";
const LOCAL_PSD_TSHIRT_STAGE_ROOT = "/@fs/home/ubuntu/webdev-static-assets/trynex-tshirt-psd-staging";
const LOCAL_PSD_TSHIRT_STAGE_SESSION_KEY = "trynex-local-psd-tshirt-staging";
const PSD_TSHIRT_STAGE_COLOR_SLUGS: Record<string, string> = {
  "#f8f7f4": "white",
  "#1a1a1a": "black",
  "#1e3a5f": "navy",
  "#7f1d1d": "maroon",
  "#4a5240": "olive",
  "#0ea5e9": "sky-blue",
  "#6b7280": "grey",
  "#dc2626": "red",
};
const SIZE_CHART = [
  { size: "XS", chest: "36", length: "26" }, { size: "S", chest: "38", length: "27" },
  { size: "M", chest: "40", length: "28" }, { size: "L", chest: "42", length: "29" },
  { size: "XL", chest: "44", length: "30" }, { size: "XXL", chest: "46", length: "31" },
  { size: "XXXL", chest: "48", length: "32" },
];

const QUICK_PRODUCT_IDS = ["tshirt", "hoodie", "mug", "cap"] as const;
const LEGACY_ID_MAP: Record<string, string> = {
  "white-tshirt": "tshirt", "black-tshirt": "tshirt",
  "t-shirt": "tshirt", "t-shirts": "tshirt", "tshirts": "tshirt", "tee": "tshirt", "tees": "tshirt",
  "white-hoodie": "hoodie", "black-hoodie": "hoodie",
  "white-longsleeve": "longsleeve", "black-longsleeve": "longsleeve",
  "long-sleeve": "longsleeve", "long-sleeves": "longsleeve", "longsleeves": "longsleeve",
  "white-mug": "mug", "black-mug": "mug",
  "white-cap": "cap", "black-cap": "cap",
  "white-waterbottle": "waterbottle", "black-waterbottle": "waterbottle",
  "water-bottle": "waterbottle", "water-bottles": "waterbottle", "bottle": "waterbottle",
};

function normalizeStudioProductId(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const compact = trimmed.replace(/[-_\s]/g, "");
  return LEGACY_ID_MAP[trimmed] ?? LEGACY_ID_MAP[compact] ?? compact;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

function detectCategoryFromProduct(prod: any): DesignProduct["category"] {
  const text = [prod.name ?? "", prod.category?.name ?? "", prod.categoryName ?? ""].join(" ").toLowerCase();
  if (text.includes("mug") || text.includes("cup")) return "mug";
  if (text.includes("hoodie") || text.includes("sweatshirt")) return "hoodie";
  if (text.includes("cap") || text.includes("hat")) return "cap";
  if (text.includes("long sleeve") || text.includes("longsleeve") || text.includes("long-sleeve")) return "longsleeve";
  if (text.includes("bottle") || text.includes("tumbler") || text.includes("flask")) return "waterbottle";
  return "tshirt";
}

function detectColorFromProduct(prod: any): string {
  const name = (prod.name ?? "").toLowerCase();
  if (name.includes("black")) return "#1a1a1a";
  if (name.includes("navy")) return "#1e3a5f";
  if (name.includes("maroon")) return "#7f1d1d";
  if (name.includes("grey") || name.includes("gray")) return "#6b7280";
  if (name.includes("olive")) return "#4a5240";
  if (Array.isArray(prod.colors) && prod.colors.length > 0) {
    const first = prod.colors[0];
    if (typeof first === "string" && first.startsWith("#")) return first;
    if (typeof first === "object" && first?.hex) return first.hex;
  }
  return "#F5F5F3";
}

export default function DesignStudioV2() {
  const [, navigate] = useLocation();
  const { addToCart } = useCartActions();
  const settings = useSiteSettings();
  const { toast } = useToast();
  const [psdTshirtStageRequested] = useState(() => {
    if (!import.meta.env.DEV) return false;
    const request = new URLSearchParams(window.location.search).get("psdTshirtStage");
    if (request === "0") {
      sessionStorage.removeItem(LOCAL_PSD_TSHIRT_STAGE_SESSION_KEY);
      return false;
    }
    if (request === "1") {
      sessionStorage.setItem(LOCAL_PSD_TSHIRT_STAGE_SESSION_KEY, "1");
      return true;
    }
    return sessionStorage.getItem(LOCAL_PSD_TSHIRT_STAGE_SESSION_KEY) === "1";
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(600);
  const [imageAction, setImageAction] = useState<"remove-bg" | "upscale" | "auto-fix" | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveRetryNonce, setSaveRetryNonce] = useState(0);
  const activeDrawIdRef = useRef<string | null>(null);
  const urlInitializedRef = useRef(false);

  const store = useDesignStore();
  const {
    selectedProduct, selectedColor, activeFace, mugMode, selectedSize, quantity,
    layers, selectedIds, linkedStoreProduct, showPrintZone, show3D, activeTab, activeTool,
    saveStatus, hasDraft, isMobile, fabricTexture, mobileToolOpen,
     setProduct, setColor, setFace, setMugMode, setMugView, switchProduct, setSize, setQuantity,
    addLayer, updateLayer, deleteLayer, moveLayer, setLayerVisibility, selectLayer, clearSelection, setLayers, commit,
    undo, redo, setShowPrintZone, setActiveTab, setActiveTool, setShow3D, setLinkedStoreProduct, setSaveStatus, setHasDraft, setMobileToolOpen, setShowProductPicker, setIsMobile,
  } = store;

  const selectedLayerId = selectedIds[0] ?? null;
  const selectedLayer = useMemo(() => layers.find(l => l.id === selectedLayerId) ?? null, [layers, selectedLayerId]);

  const isMug = selectedProduct.category === "mug";
  const isCap = selectedProduct.category === "cap";
  const isWaterBottle = selectedProduct.category === "waterbottle";
  const isPsdTshirtStaging = useMemo(() => {
    const colorSlug = PSD_TSHIRT_STAGE_COLOR_SLUGS[selectedColor.hex.toLowerCase()];
    return psdTshirtStageRequested
      && selectedProduct.category === "tshirt"
      && !!colorSlug
      && (activeFace === "front" || activeFace === "back");
  }, [activeFace, psdTshirtStageRequested, selectedColor.hex, selectedProduct.category]);
  const psdTshirtStageAssets = useMemo(() => {
    if (!isPsdTshirtStaging || (activeFace !== "front" && activeFace !== "back")) return null;
    const colorSlug = PSD_TSHIRT_STAGE_COLOR_SLUGS[selectedColor.hex.toLowerCase()];
    if (!colorSlug) return null;
    return {
      base: `${LOCAL_PSD_TSHIRT_STAGE_ROOT}/colors/tshirt-${colorSlug}-${activeFace}.png?v=psd-stage-color-v2`,
      multiply: `${LOCAL_PSD_TSHIRT_STAGE_ROOT}/tshirt-white-${activeFace}-multiply.png`,
      screen: `${LOCAL_PSD_TSHIRT_STAGE_ROOT}/tshirt-white-${activeFace}-screen.png`,
    };
  }, [activeFace, isPsdTshirtStaging, selectedColor.hex]);
  const psdTshirtStageEffectOpacity = useMemo(() => {
    const hex = selectedColor.hex.replace("#", "");
    const red = Number.parseInt(hex.slice(0, 2), 16) || 0;
    const green = Number.parseInt(hex.slice(2, 4), 16) || 0;
    const blue = Number.parseInt(hex.slice(4, 6), 16) || 0;
    const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    return {
      multiply: 0.77,
      // The supplied screen map was authored for a white garment. Preserve the
      // native 38% behavior for white but attenuate highlights on tint-derived
      // fabrics to avoid a full-shirt grey wash in local staging.
      screen: 0.38 * Math.max(0.1, luminance),
    };
  }, [selectedColor.hex]);
  const supportsBack = ["tshirt", "longsleeve", "hoodie", "mug", "cap", "waterbottle"].includes(selectedProduct.category);
  const isZoneTabs = ["tshirt", "longsleeve", "hoodie"].includes(selectedProduct.category);
  const frontMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "front"),
    [selectedProduct, selectedColor.hex],
  );
  const backMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, "back"),
    [selectedProduct, selectedColor.hex],
  );
  const activeMockup = useMemo(
    () => resolveMockup(selectedProduct, selectedColor.hex, isMug && mugMode === "wrap" ? "wrap" : activeFace as Face),
    [activeFace, isMug, mugMode, selectedColor.hex, selectedProduct],
  );
  const activePsdMaterialEffects = useMemo(() => {
    if (psdTshirtStageAssets) {
      return [
        { src: psdTshirtStageAssets.multiply, blendMode: "multiply" as const, opacity: psdTshirtStageEffectOpacity.multiply },
        { src: psdTshirtStageAssets.screen, blendMode: "screen" as const, opacity: psdTshirtStageEffectOpacity.screen },
      ];
    }
    return activeMockup.psdMaterialEffects ?? [];
  }, [activeMockup.psdMaterialEffects, psdTshirtStageAssets, psdTshirtStageEffectOpacity]);

  const apparelZones = useMemo(
    () => getApparelZones(selectedProduct.category, selectedProduct.printZone, selectedProduct.printZoneBack, selectedColor.hex),
    [selectedProduct, selectedColor.hex],
  );
  const activeZoneConfig = useMemo(() => apparelZones.find(z => z.face === activeFace) ?? apparelZones[0], [apparelZones, activeFace]);
  const isFlatZone = activeFace === "left-sleeve" || activeFace === "right-sleeve" || activeFace === "neck-label";
  const activeSurfaceUnavailable = activeMockup.runtimeStatus !== "approved" || activeMockup.contractErrors.length > 0;
  const frontSurfaceUnavailable = frontMockup.runtimeStatus !== "approved" || frontMockup.contractErrors.length > 0;
  const unavailableSurfaceReason = activeMockup.disabledReason
    ?? (activeMockup.contractErrors.length > 0 ? activeMockup.contractErrors.join(", ") : "This product surface is not ready for artwork rendering.");
  const requiredArtworkSurfaceUnavailable = useMemo(() => {
    const faces = new Set(
      layers
        .filter((layer) => layer.visible)
        .map((layer) => (layer.face ?? "front") as Face),
    );
    if (faces.size === 0) return frontSurfaceUnavailable;
    return Array.from(faces).some((face) => {
      const surface = resolveMockup(selectedProduct, selectedColor.hex, face);
      return surface.runtimeStatus !== "approved" || surface.contractErrors.length > 0;
    });
  }, [frontSurfaceUnavailable, layers, selectedColor.hex, selectedProduct]);

  const pz = useMemo(() => {
    if (isMug) {
      if (mugMode === "wrap") return activeFace === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ;
      return activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
    }
    return getZonePZ(activeFace, selectedProduct, selectedColor.hex);
  }, [isMug, mugMode, activeFace, selectedProduct, selectedColor.hex]);

  const isBlackGarment = isNearBlack(selectedColor.hex);
  const isLightGarment = isLightTint(selectedColor.hex);

  useEffect(() => {
    if (isPsdTshirtStaging) setShow3D(false);
  }, [isPsdTshirtStaging, setShow3D]);

  useEffect(() => {
    const onResize = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      const maxWidth = mobile ? width - 32 : Math.min(width - 360, 720);
      setCanvasSize(Math.max(320, Math.min(maxWidth, 720)));
    };
    onResize();
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, [setIsMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, undo]);

  // URL params + draft restore. An explicit product query is authoritative;
  // cloud/local draft restoration must not silently replace it with Hoodie.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const isEdit = sp.get("edit") === "1";
    const explicitUrlProduct = sp.get("product");
    const token = localStorage.getItem("trynex_customer_token");
    const restore = async () => {
      if (token) {
        try {
          const res = await fetch(getApiUrl("/api/drafts"), { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const json = await res.json();
            if (json.draft?.payload) applyDraftPayload(json.draft.payload, "cloud");
          }
        } catch {}
      }
      try {
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) applyDraftPayload(JSON.parse(raw), "local");
      } catch {}
    };
    restore();
    const urlProduct = explicitUrlProduct;
    if (urlProduct) {
      const resolved = normalizeStudioProductId(urlProduct);
      const found = PRODUCTS.find(p => p.id === resolved || p.category === resolved);
      if (found) { setProduct(found); setColor(found.colors[0]); }
    }
    const storeProductId = sp.get("storeProductId");
    if (storeProductId) {
      fetch(getApiUrl(`/api/products/${storeProductId}`))
        .then(r => r.ok ? r.json() : null)
        .then((found: any) => {
          if (!found) return;
          const category = detectCategoryFromProduct(found);
          const template = PRODUCTS.find(p => p.category === category) ?? PRODUCTS[0];
          const garmentColor = detectColorFromProduct(found);
          const price = parseFloat(String(found.discountPrice || found.price)) || 0;
          setProduct(template);
          const colorMatch = template.colors.find(c => c.hex.toLowerCase() === garmentColor.toLowerCase()) ?? template.colors[0];
          setColor(colorMatch);
          setLinkedStoreProduct({ id: found.id, name: found.name, price, imageUrl: found.imageUrl ?? undefined });
          toast({ title: `Designing: ${found.name}`, description: "Upload your artwork or add text to customise this product." });
        })
        .catch(() => {});
    }
    const urlTab = sp.get("tab");
    if (urlTab && ["upload", "text", "layers", "templates", "ai"].includes(urlTab)) {
      setActiveTab(urlTab as any);
    }
    if (sp.get("view") === "back") setFace("back");
    const urlSize = sp.get("size");
    if (urlSize && ["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(urlSize)) setSize(urlSize);
    urlInitializedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyDraftPayload(data: any, source: "cloud" | "local") {
    if (!data || data.version !== DRAFT_VERSION) return;
    const explicitUrlProduct = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("product")
      : null;
    if (typeof data.productId === "string" && !explicitUrlProduct) {
      const resolved = normalizeStudioProductId(data.productId);
      const p = PRODUCTS.find(x => x.id === resolved || x.category === resolved);
      if (p) setProduct(p);
    }
    if (data.color?.hex && data.color?.name) setColor(data.color);
    if (typeof data.size === "string") setSize(data.size);
    if (data.mugMode) setMugMode(data.mugMode);
    if (data.linkedStoreProductId) setLinkedStoreProduct({ id: data.linkedStoreProductId, name: data.linkedStoreProductName, price: data.linkedStoreProductPrice });
    if (Array.isArray(data.layers) && data.layers.length > 0) {
      setLayers(data.layers);
      setHasDraft(true);
      setSaveStatus("saved");
      toast({ title: "Draft restored", description: source === "cloud" ? "Loaded from cloud." : "Welcome back — your design is here." });
    }
  }

  // Auto-save draft
  useEffect(() => {
    if (layers.length === 0) {
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
      setHasDraft(false);
      setSaveStatus("idle");
      return;
    }
    setSaveStatus("saving");
    setSaveError(null);
    const handle = window.setTimeout(async () => {
      const payload = {
        version: DRAFT_VERSION, layers, productId: selectedProduct.id, color: selectedColor, size: selectedSize,
        mugMode, mockupRelease: getActiveMockupReleaseVersion(), savedAt: Date.now(),
        ...(linkedStoreProduct ? { linkedStoreProductId: linkedStoreProduct.id, linkedStoreProductName: linkedStoreProduct.name, linkedStoreProductPrice: linkedStoreProduct.price } : {}),
      };
      let localSaved = false;
      let cloudError: string | null = null;
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        localSaved = true;
      } catch {
        cloudError = "This browser blocked local draft storage.";
      }
      const token = localStorage.getItem("trynex_customer_token");
      if (token) {
        try {
          const response = await fetch(getApiUrl("/api/drafts"), {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            body: JSON.stringify({ payload }),
          });
          if (!response.ok) cloudError = "Cloud draft backup is unavailable.";
        } catch {
          cloudError = "Cloud draft backup is unavailable.";
        }
      }
      if (!localSaved && !token) {
        setSaveError(cloudError ?? "The draft could not be saved.");
        setSaveStatus("error");
        return;
      }
      if (cloudError) {
        setSaveError(localSaved ? `${cloudError} Your draft is still saved on this device.` : cloudError);
        setSaveStatus("error");
        return;
      }
      setHasDraft(true);
      setSaveStatus("saved");
    }, 500);
    return () => window.clearTimeout(handle);
  }, [layers, selectedProduct, selectedColor, selectedSize, mugMode, linkedStoreProduct, saveRetryNonce]);

  // Sync URL params only after the initial query has been applied.
  useEffect(() => {
    if (!urlInitializedRef.current) return;
    const params = new URLSearchParams();
    if (linkedStoreProduct) params.set("storeProductId", String(linkedStoreProduct.id));
    else if (selectedProduct.id !== PRODUCTS[0].id) params.set("product", selectedProduct.id);
    if (activeTab !== "upload") params.set("tab", activeTab);
    if (activeFace !== "front") params.set("view", activeFace);
    if (selectedSize !== "M") params.set("size", selectedSize);
    const q = params.toString();
    const newUrl = window.location.pathname + (q ? "?" + q : "");
    if (newUrl !== window.location.pathname + window.location.search) window.history.replaceState(null, "", newUrl);
  }, [selectedProduct.id, activeTab, activeFace, selectedSize, linkedStoreProduct]);

  const handleQuickProductSwitch = (prod: DesignProduct) => {
    if (prod.id === selectedProduct.id) return;
    const matchingColor = prod.colors.find(c => c.hex.toLowerCase() === selectedColor.hex.toLowerCase()) ?? prod.colors[0];
    const oldMugMode = selectedProduct.category === "mug" ? mugMode : "side1";
    const nextMugMode = selectedProduct.category === "mug" && prod.category === "mug" ? mugMode : "side1";
    const layerTransforms = layers.map((layer) => {
      const face = layer.face ?? "front";
      const oldZone = getSwitchPrintZone(face, selectedProduct, selectedColor.hex, oldMugMode);
      const nextZone = getSwitchPrintZone(face, prod, matchingColor.hex, nextMugMode);
      const widthRatio = nextZone.w / Math.max(1, oldZone.w);
      const heightRatio = nextZone.h / Math.max(1, oldZone.h);
      const fitRatio = Math.min(widthRatio, heightRatio);
      return {
        id: layer.id,
        transform: {
          ...layer.transform,
          x: layer.transform.x * widthRatio,
          y: layer.transform.y * heightRatio,
          scale: layer.transform.scale * fitRatio,
          scaleX: layer.transform.scaleX ? layer.transform.scaleX * fitRatio : undefined,
          scaleY: layer.transform.scaleY ? layer.transform.scaleY * fitRatio : undefined,
        },
      };
    });
    switchProduct(prod, matchingColor, layerTransforms, nextMugMode);
    setLinkedStoreProduct(null);
    setQuantity(1);
  };

  const handleFileUpload = (file: File) => {
    const extension = file.name.toLowerCase().split(".").pop();
    const acceptedExtension = ["jpg", "jpeg", "png", "webp"].includes(extension ?? "");
    if (!file.type.startsWith("image/") && !acceptedExtension) {
      toast({ title: "Invalid file", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 10MB. Please compress or resize the image first.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => toast({ title: "Couldn't read file", description: "Try another image.", variant: "destructive" });
    reader.onload = async (e) => {
      try {
        const src = e.target?.result as string;
        if (!src) throw new Error("The selected file was empty.");
        const img = new Image();
        img.src = src;
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("This image could not be decoded.")); });
        try { await img.decode?.(); } catch {}
        const fixed = await autoFixImage(src);
        const layer: ImageLayer = {
          id: uid(), name: file.name.replace(/\.[^.]+$/, "") || "Image",
          type: "image", src: fixed.src, naturalW: img.naturalWidth, naturalH: img.naturalHeight,
          visible: true, locked: false,
          transform: fitImageTransform(img.naturalWidth, img.naturalHeight, { w: pz.w, h: pz.h }, { padding: 0.92, maxScale: 4 }),
          face: activeFace, brightness: fixed.brightness, contrast: fixed.contrast,
        };
        addLayer(layer);
        selectLayer(layer.id);
        // A successful upload should land on the image-edit tab rather than the
        // layer list, so mobile customers immediately see background removal,
        // HD preparation, and brightness/contrast controls for the selected art.
        setActiveTab("upload");
        if (isMobile) setMobileToolOpen(true);
        toast({ title: "✓ Design placed!", description: "Your image tools are open—remove the background, improve print quality, or adjust it before checkout." });
      } catch (error) {
        console.error("Design upload failed", error);
        toast({ title: "Upload failed", description: "This image could not be prepared. Try a JPG, PNG, or WebP under 10MB.", variant: "destructive" });
      }
    };
    reader.readAsDataURL(file);
  };

  const replaceSelectedImage = async (dataUrl: string) => {
    if (!selectedLayer || selectedLayer.type !== "image") return;
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The processed image could not be decoded."));
      img.src = dataUrl;
    });
    updateLayer(selectedLayer.id, { src: dataUrl, naturalW: img.naturalWidth, naturalH: img.naturalHeight });
    commit();
  };

  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("The processed image could not be read."));
    reader.readAsDataURL(blob);
  });

  const withOperationTimeout = async <T,>(operation: Promise<T>, timeoutMs: number, message: string): Promise<T> => {
    let timeoutId: number | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timeoutId = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  const inspectProcessedImage = async (dataUrl: string, operation: "remove-bg" | "upscale", minimum?: { width: number; height: number }) => {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The processed image could not be decoded for validation."));
      image.src = dataUrl;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > 16_000_000) throw new Error("The processed image dimensions are not safe for the Studio.");
    if (operation === "upscale" && minimum && (width < minimum.width || height < minimum.height)) {
      throw new Error("The HD result did not preserve the original image dimensions.");
    }
    if (operation === "remove-bg") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("This browser cannot validate the removed-background output.");
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height).data;
      let hasTransparency = false;
      for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] < 255) { hasTransparency = true; break; }
      }
      if (!hasTransparency) throw new Error("The removed-background result has no transparent pixels, so your original artwork was kept.");
    }
    return { width, height };
  };

  const handleRemoveBackground = async () => {
    if (!selectedLayer || selectedLayer.type !== "image" || imageAction) return;
    setImageAction("remove-bg");
    try {
      let result: string | null = null;
      const controller = new AbortController();
      const serverTimeout = window.setTimeout(() => controller.abort(), 18_000);
      let response: Response;
      try {
        response = await fetch(getApiUrl("/api/remove-bg"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: selectedLayer.src }),
          signal: controller.signal,
        });
      } catch (error) {
        if ((error as DOMException).name === "AbortError") {
          throw new Error("Background removal timed out. Your original image is unchanged; please retry.");
        }
        throw error;
      } finally {
        window.clearTimeout(serverTimeout);
      }
      const json = await response.json().catch(() => ({})) as { result?: string; error?: string };
      if (response.ok && json.result) {
        result = json.result;
      } else if (json.error === "rate_limited") {
        throw new Error("Background removal is temporarily rate-limited. Please try again later.");
      } else if (json.error === "image_too_large") {
        throw new Error("This image is over the 10MB processing limit. Use a smaller image first.");
      }

      if (!result) {
        const { removeBackground } = await withOperationTimeout(
          import("@imgly/background-removal"),
          20_000,
          "Background removal could not start on this connection. Your original image is unchanged; please retry.",
        );
        const blob = await withOperationTimeout(
          removeBackground(selectedLayer.src, {
            publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
            output: { format: "image/png", quality: 0.9 },
          }),
          45_000,
          "Background removal took too long. Your original image is unchanged; please retry.",
        );
        result = await blobToDataUrl(blob);
      }

      await inspectProcessedImage(result, "remove-bg");
      await replaceSelectedImage(result);
      toast({ title: "Background removed", description: "Your transparent cutout is ready on the product." });
    } catch (error) {
      console.error("[studio] background removal failed", error);
      toast({ title: "Background removal unavailable", description: error instanceof Error ? error.message : "Try another image or retry.", variant: "destructive" });
    } finally {
      setImageAction(null);
    }
  };

  const handleUpscale = async () => {
    if (!selectedLayer || selectedLayer.type !== "image" || imageAction) return;
    setImageAction("upscale");
    try {
      const img = new Image();
      if (!selectedLayer.src.startsWith("data:")) img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("This image could not be decoded for upscaling."));
        img.src = selectedLayer.src;
      });
      try { await img.decode?.(); } catch {}

      const scale = Math.min(2, 4096 / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(img.naturalWidth, Math.round(img.naturalWidth * scale));
      const height = Math.max(img.naturalHeight, Math.round(img.naturalHeight * scale));
      const enlarged = document.createElement("canvas");
      enlarged.width = width;
      enlarged.height = height;
      const enlargedCtx = enlarged.getContext("2d");
      if (!enlargedCtx) throw new Error("This browser cannot create an upscale canvas.");
      enlargedCtx.imageSmoothingEnabled = true;
      enlargedCtx.imageSmoothingQuality = "high";
      enlargedCtx.drawImage(img, 0, 0, width, height);

      const blurCanvas = document.createElement("canvas");
      blurCanvas.width = width;
      blurCanvas.height = height;
      const blurCtx = blurCanvas.getContext("2d");
      if (!blurCtx) throw new Error("This browser cannot prepare the sharpening pass.");
      (blurCtx as CanvasRenderingContext2D & { filter?: string }).filter = "blur(1.2px)";
      blurCtx.drawImage(enlarged, 0, 0);
      (blurCtx as CanvasRenderingContext2D & { filter?: string }).filter = "none";

      const original = enlargedCtx.getImageData(0, 0, width, height);
      const blurred = blurCtx.getImageData(0, 0, width, height);
      for (let i = 0; i < original.data.length; i += 4) {
        for (let channel = 0; channel < 3; channel += 1) {
          const value = original.data[i + channel] + 0.55 * (original.data[i + channel] - blurred.data[i + channel]);
          original.data[i + channel] = Math.max(0, Math.min(255, value));
        }
      }
      enlargedCtx.putImageData(original, 0, 0);
      const output = enlarged.toDataURL("image/png");
      await inspectProcessedImage(output, "upscale", { width: img.naturalWidth, height: img.naturalHeight });
      await replaceSelectedImage(output);
      toast({ title: "HD artwork ready", description: `Prepared a ${width}×${height}px print layer.` });
    } catch (error) {
      console.error("[studio] upscale failed", error);
      toast({ title: "Upscale unavailable", description: error instanceof Error ? error.message : "Try a smaller image or a different format.", variant: "destructive" });
    } finally {
      setImageAction(null);
    }
  };

  const handleAutoFix = async () => {
    if (!selectedLayer || selectedLayer.type !== "image" || imageAction) return;
    setImageAction("auto-fix");
    try {
      const fixed = await withOperationTimeout(
        autoFixImage(selectedLayer.src),
        20_000,
        "Image improvement took too long. Your original image is unchanged; please retry.",
      );
      await replaceSelectedImage(fixed.src);
      toast({
        title: "Image improved",
        description: `Adjusted brightness and contrast locally (${fixed.brightness}% brightness, ${fixed.contrast}% contrast).`,
      });
    } catch (error) {
      console.error("[studio] auto-fix failed", error);
      toast({ title: "Image improvement unavailable", description: error instanceof Error ? error.message : "Your original image is unchanged; please retry.", variant: "destructive" });
    } finally {
      setImageAction(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const addText = () => {
    const layer: TextLayer = {
      id: uid(), name: "New text", type: "text", visible: true, locked: false,
      transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
      text: "Your text", fontFamily: FONT_FAMILIES[0].value, fontWeight: 700, fontStyle: "normal", fontSize: 40, color: selectedColor.hex,
      face: activeFace,
    };
    addLayer(layer);
    selectLayer(layer.id);
    setActiveTab("text");
  };

  const handleCanvasAction = (point: { x: number; y: number }) => {
    const id = uid();
    const transform = { x: point.x, y: point.y, scale: 1, rotation: 0, opacity: 1 };
    if (activeTool === "text") {
      const layer: TextLayer = {
        id, name: "Canvas text", type: "text", visible: true, locked: false,
        transform, text: "Your text", fontFamily: FONT_FAMILIES[0].value, fontWeight: 700,
        fontStyle: "normal", fontSize: 40, color: selectedColor.hex, face: activeFace,
      };
      addLayer(layer);
      selectLayer(id);
      setActiveTab("text");
      return;
    }
    if (activeTool === "shape") {
      const layer: ShapeLayer = {
        id, name: "Rectangle", type: "shape", visible: true, locked: false,
        transform, shapeType: "rect", fill: selectedColor.hex,
        strokeColor: selectedColor.hex, strokeWidth: 0, width: 240, height: 160,
        face: activeFace,
      };
      addLayer(layer);
      selectLayer(id);
      setActiveTab("layers");
    }
  };

  const handleDrawStart = (point: { x: number; y: number }) => {
    const id = uid();
    const layer: ShapeLayer = {
      id, name: "Pen stroke", type: "shape", visible: true, locked: false,
      transform: { x: point.x, y: point.y, scale: 1, rotation: 0, opacity: 1 },
      shapeType: "line", fill: selectedColor.hex, strokeColor: selectedColor.hex,
      strokeWidth: 12, width: 1, height: 1, points: [0, 0], face: activeFace,
    };
    activeDrawIdRef.current = id;
    addLayer(layer);
    selectLayer(id);
    setActiveTab("layers");
  };

  const handleDrawMove = (point: { x: number; y: number }) => {
    const id = activeDrawIdRef.current;
    if (!id) return;
    const layer = layers.find((item) => item.id === id);
    if (!layer || layer.type !== "shape") return;
    const localX = point.x - layer.transform.x;
    const localY = point.y - layer.transform.y;
    const existing = layer.points && layer.points.length >= 2 ? layer.points : [0, 0];
    const lastX = existing[existing.length - 2];
    const lastY = existing[existing.length - 1];
    if (Math.hypot(localX - lastX, localY - lastY) < 3) return;
    const nextPoints = [...existing, localX, localY];
    const xs = nextPoints.filter((_, index) => index % 2 === 0);
    const ys = nextPoints.filter((_, index) => index % 2 === 1);
     updateLayer(id, {
      points: nextPoints,
      width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
      height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
     }, { history: false });
  };

  const handleDrawEnd = () => {
    const id = activeDrawIdRef.current;
    if (id) {
      const layer = layers.find((item) => item.id === id);
      if (layer?.type === "shape" && (layer.points?.length ?? 0) < 4) {
        updateLayer(id, { points: [0, 0, 160, 0], width: 160, height: 1 });
      }
      commit();
    }
    activeDrawIdRef.current = null;
  };

  const handlePickColor = (hex: string) => {
    if (!selectedLayer) {
      toast({ title: "Color sampled", description: `${hex} is ready. Select a text or shape layer to apply it.` });
      return;
    }
    if (selectedLayer.type === "text") updateLayer(selectedLayer.id, { color: hex });
    else if (selectedLayer.type === "shape") updateLayer(selectedLayer.id, { fill: hex, strokeColor: hex });
    else updateLayer(selectedLayer.id, { tint: hex });
    commit();
    toast({ title: "Color applied", description: `${hex} applied to ${selectedLayer.name || "the selected layer"}.` });
  };

  const frontLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === "front") as unknown as ComposerLayer[], [layers]);
  const backLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === "back") as unknown as ComposerLayer[], [layers]);
  const qualityIssues = useMemo(() => {
    return layers
      .filter((layer): layer is ImageLayer => layer.type === "image" && layer.visible)
      .flatMap((layer) => {
        const shortestEdge = Math.min(layer.naturalW, layer.naturalH);
        if (!Number.isFinite(shortestEdge) || shortestEdge >= 1_200) return [];
        const surface = layer.face === "back" ? "back" : layer.face === "left-sleeve"
          ? "left sleeve" : layer.face === "right-sleeve" ? "right sleeve"
          : layer.face === "neck-label" ? "neck label" : "front";
        const blocking = shortestEdge < 600;
        return [{
          id: `resolution-${layer.id}`,
          label: blocking ? "Image resolution is too low" : "Image resolution needs review",
          detail: `${layer.name || "This image"} is ${Math.round(layer.naturalW)}×${Math.round(layer.naturalH)}px on the ${surface}. ${blocking ? "Replace it or use HD preparation before checkout to avoid a visibly soft print." : "For the sharpest print, use an image at least 1,200px on its shortest edge."}`,
          tone: blocking ? "danger" as const : "warning" as const,
          actionLabel: "Edit image",
          onAction: () => {
            setFace(layer.face ?? "front");
            selectLayer(layer.id);
            setActiveTab("upload");
            if (isMobile) setMobileToolOpen(true);
          },
        }];
      });
  }, [isMobile, layers, selectLayer, setActiveTab, setFace, setMobileToolOpen]);

  const handleAddToCart = async () => {
    if (isAddingToCart) return;
    setIsAddingToCart(true);
    try {
      if (isPsdTshirtStaging) {
        toast({ title: "Local PSD staging preview", description: "This white-front T-shirt review mode cannot be added to cart." });
        return;
      }
      if (layers.length === 0) {
        toast({ title: "No design", description: "Add an image or text layer first.", variant: "destructive" });
        return;
      }
      if (qualityIssues.some((issue) => issue.tone === "danger")) {
        toast({ title: "Improve image quality first", description: "Replace the low-resolution image or use HD preparation before adding this design to cart.", variant: "destructive" });
        return;
      }
      if (requiredArtworkSurfaceUnavailable) {
        throw new Error(frontMockup.disabledReason ?? "This product surface is not ready for customer artwork yet. Please try again later.");
      }
    const imageCache = new Map<string, HTMLImageElement>();
    const originalAssets: OriginalAsset[] = [];
    const originalAssetUrls: string[] = [];
    const requiredOriginalAssetCount = layers.filter((layer) => layer.type === "image" && layer.visible && layer.src.startsWith("data:")).length;
    for (const layer of layers) {
      if (layer.type !== "image" || !layer.visible) continue;
      const src = (layer as ImageLayer).src;
      if (!src.startsWith("data:")) continue;
      try {
        const blob = await (await fetch(src)).blob();
        const mime = blob.type || "image/png";
        const ext = mime === "image/png" ? "png" : mime === "image/jpeg" ? "jpg" : mime === "image/webp" ? "webp" : "png";
        const safeName = (layer.name || "design").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
        const filename = `${safeName}-${Date.now()}.${ext}`;
        const reqRes = await fetch(getApiUrl("/api/storage/uploads/request-url"), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: filename, size: blob.size, contentType: mime }),
        });
        if (!reqRes.ok) throw new Error("Original artwork storage is unavailable. Your design was not added to cart; please retry.");
        const { uploadURL, objectPath } = await reqRes.json();
        if (!uploadURL || !objectPath) throw new Error("Original artwork storage returned an incomplete upload response. Please retry.");
        const putRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": mime }, body: blob });
        if (!putRes.ok) throw new Error("Original artwork could not be uploaded. Your design was not added to cart; please retry.");
        originalAssets.push({ objectPath, filename, mime, bytes: blob.size, width: (layer as ImageLayer).naturalW, height: (layer as ImageLayer).naturalH });
        originalAssetUrls.push(objectPath);
      } catch (error) {
        if (error instanceof Error && error.message.includes("Original artwork")) throw error;
        throw new Error("Original artwork could not be prepared for checkout. Your design was not added to cart; please retry.");
      }
    }
    if (originalAssets.length !== requiredOriginalAssetCount) {
      throw new Error("Every uploaded artwork must be preserved before checkout. Your design was not added to cart; please retry.");
    }

    // Use the same canonical transparent cutout as the live SVG preview. The
    // opaque photo is source metadata only and must not create a second silhouette.
    const garmentSrc = frontMockup.cutoutSrc;
    const isColorPhoto = frontMockup.isColorPhoto;
    const frontPZ = isMug
      ? (mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ)
      : getZonePZ("front", selectedProduct, selectedColor.hex);
    const backPZ = isMug
      ? (mugMode === "wrap" ? MUG_WRAP_BACK_PZ : MUG_SIDE_BACK_PZ)
      : getZonePZ("back", selectedProduct, selectedColor.hex);
    const leftSleeveLayers = layers.filter(l => l.face === "left-sleeve") as unknown as ComposerLayer[];
    const rightSleeveLayers = layers.filter(l => l.face === "right-sleeve") as unknown as ComposerLayer[];
    const neckLabelLayers = layers.filter(l => l.face === "neck-label") as unknown as ComposerLayer[];

    let mockupUrl: string;
    try {
      const mockupCanvas = document.createElement("canvas");
      await composeMockupSurface({ canvas: mockupCanvas, surface: { ...frontMockup, baseSrc: garmentSrc, printZone: frontPZ }, garmentColor: selectedColor.hex, layers: frontLayers, outSize: 400, imageCache, fabricTexture });
      mockupUrl = mockupCanvas.toDataURL("image/webp", 0.8);
    } catch (err) {
      console.error("Mockup compose failed", err);
      toast({ title: "Preview failed", description: "Could not generate the design preview. Try a different image or refresh.", variant: "destructive" });
      return;
    }

    let frontTexUrl: string;
    try {
      const frontTexCanvas = document.createElement("canvas");
      if (isMug) {
         await composeMockupSurfaceTexture({ canvas: frontTexCanvas, surface: { ...frontMockup, printZone: frontPZ }, layers: frontLayers, outSize: 2048, imageCache, clipToPrintZone: true, curvature: 0.16, fabricTexture });
      } else {
         await composeMockupSurfaceTexture({ canvas: frontTexCanvas, surface: { ...frontMockup, printZone: frontPZ }, layers: frontLayers, outSize: 1024, imageCache, curvature: isWaterBottle ? 0.16 : isCap ? 0.1 : 0, fabricTexture });
      }
      frontTexUrl = frontTexCanvas.toDataURL("image/webp", 0.85);
    } catch (err) {
      console.error("Front texture compose failed", err);
      toast({ title: "Print preview failed", description: "Could not generate the printable texture. Try a different image or refresh.", variant: "destructive" });
      return;
    }

    let backTexUrl: string | undefined;
    if (!isMug && backLayers.length > 0) {
      const backTexCanvas = document.createElement("canvas");
       await composeMockupSurfaceTexture({ canvas: backTexCanvas, surface: { ...backMockup, printZone: backPZ }, layers: backLayers, outSize: 1024, imageCache, fabricTexture });
      backTexUrl = backTexCanvas.toDataURL("image/webp", 0.85);
    }

    let leftSleeveTexUrl: string | undefined;
    let rightSleeveTexUrl: string | undefined;
    let neckLabelTexUrl: string | undefined;
    if (isZoneTabs) {
      const { SLEEVE_PZ, NECK_LABEL_PZ } = await import("../design-studio/mockups");
      if (leftSleeveLayers.length > 0) {
        const c = document.createElement("canvas");
         await composeMockupSurfaceTexture({ canvas: c, surface: { ...resolveMockup(selectedProduct, selectedColor.hex, "left-sleeve"), printZone: SLEEVE_PZ }, layers: leftSleeveLayers, outSize: 1024, imageCache, fabricTexture });
        leftSleeveTexUrl = c.toDataURL("image/webp", 0.85);
      }
      if (rightSleeveLayers.length > 0) {
        const c = document.createElement("canvas");
         await composeMockupSurfaceTexture({ canvas: c, surface: { ...resolveMockup(selectedProduct, selectedColor.hex, "right-sleeve"), printZone: SLEEVE_PZ }, layers: rightSleeveLayers, outSize: 1024, imageCache, fabricTexture });
        rightSleeveTexUrl = c.toDataURL("image/webp", 0.85);
      }
      if (neckLabelLayers.length > 0) {
        const c = document.createElement("canvas");
         await composeMockupSurfaceTexture({ canvas: c, surface: { ...resolveMockup(selectedProduct, selectedColor.hex, "neck-label"), printZone: NECK_LABEL_PZ }, layers: neckLabelLayers, outSize: 1024, imageCache, fabricTexture });
        neckLabelTexUrl = c.toDataURL("image/webp", 0.85);
      }
    }

    // Admin-controlled custom-design pricing. A product launched from the
    // catalog keeps its authoritative linked product/variant price; a blank
    // studio product uses the configured base price plus one customization fee.
    const configuredStudioPrice = isMug
      ? Number(settings.studioMugPrice) + Number(settings.studioMugCustomizationFee)
      : selectedProduct.category === "tshirt"
        ? Number(settings.studioTshirtPrice) + Number(settings.studioTshirtCustomizationFee)
        : isWaterBottle
          ? Number(settings.studioWaterbottlePrice) + Number(settings.studioWaterbottleCustomizationFee)
          : selectedProduct.category === "hoodie"
            ? Number(settings.studioHoodiePrice) + Number(settings.studioHoodieCustomizationFee)
            : selectedProduct.category === "longsleeve"
              ? Number(settings.studioLongsleevePrice) + Number(settings.studioLongsleeveCustomizationFee)
              : isCap
                ? Number(settings.studioCapPrice) + Number(settings.studioCapCustomizationFee)
                : Number(settings.studioTshirtPrice) + Number(settings.studioTshirtCustomizationFee);
    const studioPrice = linkedStoreProduct?.price ?? configuredStudioPrice;
    const mockupRelease = getActiveMockupReleaseVersion();
    const sessionId = Date.now().toString(36);
    try {
      localStorage.setItem(`studio_session_${sessionId}`, JSON.stringify({ version: DRAFT_VERSION, layers, productId: selectedProduct.id, color: selectedColor, size: selectedSize, mugMode, mockupRelease, savedAt: Date.now() }));
    } catch {}

    addToCart({
      productId: linkedStoreProduct?.id ?? 0,
      name: linkedStoreProduct?.name ?? `Custom ${selectedProduct.name}`,
      price: studioPrice,
      quantity,
      size: isMug || isCap || isWaterBottle ? undefined : selectedSize,
      color: selectedColor.name,
      imageUrl: mockupUrl,
      customImages: [frontTexUrl, ...(backTexUrl ? [backTexUrl] : []), ...(leftSleeveTexUrl ? [leftSleeveTexUrl] : []), ...(rightSleeveTexUrl ? [rightSleeveTexUrl] : []), ...(neckLabelTexUrl ? [neckLabelTexUrl] : [])],
      originalAssetUrls,
      originalAssets,
      customNote: JSON.stringify({ studioDesign: true, sessionId, mockupRelease, product: selectedProduct.name, category: selectedProduct.category, color: selectedColor.name, colorHex: selectedColor.hex, size: selectedSize, layerCount: layers.length, frontLayerCount: frontLayers.length, backLayerCount: backLayers.length, mockupSrc: garmentSrc, mockupSource: frontMockup.source, mockupPhotoSrc: frontMockup.photoSrc, mockupIsColorPhoto: frontMockup.isColorPhoto, mockupManifestRevision: frontMockup.manifestRevision, mockupSourceKitKey: frontMockup.sourceKitKey, mockupRuntimeStatus: frontMockup.runtimeStatus, printZone: frontPZ, printZoneBack: backPZ, originalAssets }),
    });
    toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready.` });
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch {}
    setHasDraft(false);
    setSaveStatus("idle");
    setTimeout(() => navigate("/cart"), 800);
    } catch (error) {
      console.error("[studio] add to cart failed", error);
      toast({
        title: "Couldn’t add design to cart",
        description: error instanceof Error ? error.message : "Your design was not added. Please retry.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleExportPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (isPsdTshirtStaging) {
        toast({ title: "Local PSD staging preview", description: "Export is disabled until this source passes the reviewed release workflow." });
        return;
      }
      const activeLayers = layers.filter(l => (l.face ?? "front") === activeFace) as unknown as ComposerLayer[];
      if (activeLayers.length === 0) { toast({ title: "Nothing to export", description: "Add a layer first." }); return; }
      const exportMockup = activeFace === "front" ? frontMockup : activeFace === "back" ? backMockup : activeMockup;
      if (exportMockup.runtimeStatus !== "approved" || exportMockup.contractErrors.length > 0) {
        throw new Error(exportMockup.disabledReason ?? "This product surface is not ready for export yet. Please try again later.");
      }
      const garmentSrc = exportMockup.cutoutSrc;
      const canvas = document.createElement("canvas");
      const exportPrintZone = isMug
        ? (mugMode === "wrap" ? (activeFace === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ) : (activeFace === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ))
        : getZonePZ(activeFace, selectedProduct, selectedColor.hex);
      await composeMockupSurface({ canvas, surface: { ...exportMockup, baseSrc: garmentSrc, printZone: exportPrintZone }, garmentColor: selectedColor.hex, layers: activeLayers, outSize: 1200, imageCache: new Map(), fabricTexture });
      const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = `trynex-${selectedProduct.id}-${activeFace}-design.png`; a.click();
      toast({ title: "PNG exported!", description: "High-res PNG saved to your downloads." });
    } catch (error) {
      console.error("[studio] export failed", error);
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "The preview could not be exported. Please retry.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const studioColors = useMemo(() => {
    try {
      const raw = isMug ? settings.studioMugColors : selectedProduct.category === "tshirt" ? settings.studioTshirtColors : null;
      const arr = raw ? JSON.parse(raw) : null;
      if (Array.isArray(arr) && arr.length > 0) {
        const canonical = new Map(selectedProduct.colors.map(color => [color.hex.toLowerCase(), color]));
        const filtered = arr
          .map((color: any) => typeof color === "string" ? { name: color, hex: color } : color)
          .filter((color: any) => color?.hex && canonical.has(String(color.hex).toLowerCase()))
          .map((color: any) => canonical.get(String(color.hex).toLowerCase())!);
        if (filtered.length > 0) return filtered;
      }
    } catch {}
    return selectedProduct.colors;
  }, [isMug, settings.studioMugColors, settings.studioTshirtColors, selectedProduct]);

  const currentFaceLayers = useMemo(() => layers.filter(l => (l.face ?? "front") === activeFace), [layers, activeFace]);
  const hasVisibleArtworkOnFace = currentFaceLayers.some((layer) => layer.visible);
  const materialEffectClipPath = useMemo(() => {
    const left = Math.max(0, Math.min(100, pz.x / 10));
    const top = Math.max(0, Math.min(100, pz.y / 10));
    const right = Math.max(left, Math.min(100, (pz.x + pz.w) / 10));
    const bottom = Math.max(top, Math.min(100, (pz.y + pz.h) / 10));
    return `polygon(${left}% ${top}%, ${right}% ${top}%, ${right}% ${bottom}%, ${left}% ${bottom}%)`;
  }, [pz]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#F5F3F0" }}>
      <SEOHead title="Design Studio | Create Custom Apparel Online — Trynext Lifestyle" description="Design your own custom T-shirts, hoodies, mugs & more." canonical="/design-studio" />
      <Navbar />
      <div style={{ height: "calc(var(--announcement-height, 0px) + 4.25rem)" }} />

      <div className="border-b border-gray-200 sticky z-30 bg-white" style={{ top: "calc(var(--announcement-height, 0px) + 4.25rem)" }}>
        <div className="container-wide mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-shrink">
            <h1 className="font-display font-black text-base sm:text-xl text-gray-900 truncate">Design Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Designing: <strong className="text-gray-700">{linkedStoreProduct?.name ?? selectedProduct.name}</strong>
              {linkedStoreProduct && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black text-white bg-orange-500">STORE</span>}
              <span className="text-gray-400"> · {isMug ? (mugMode === "side1" ? "Left Side" : mugMode === "side2" ? "Right Side" : "Full Wrap") : (activeZoneConfig?.label ?? activeFace)}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
             {(saveStatus !== "idle" || hasDraft) && (
               <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${saveStatus === "error" ? "bg-red-50 text-red-700" : saveStatus === "saving" ? "bg-gray-100 text-gray-600" : "bg-emerald-50 text-emerald-700"}`} title={saveError ?? undefined}>
                 {saveStatus === "saving" ? <><CloudUpload className="w-3 h-3 animate-pulse" /> Saving…</> : saveStatus === "error" ? <><Info className="w-3 h-3" /> Save needs attention</> : <><Check className="w-3 h-3" /> Saved</>}
               </div>
             )}
             {saveStatus === "error" && (
               <button type="button" onClick={() => setSaveRetryNonce((value) => value + 1)} className="hidden sm:inline-flex items-center rounded-lg bg-red-100 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-200" title={saveError ?? "Retry saving draft"}>
                 Retry save
               </button>
             )}
            <button type="button" onClick={undo} disabled={store.history.length === 0} aria-label="Undo last change" className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"><Undo2 className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={redo} disabled={store.future.length === 0} aria-label="Redo last change" className="p-2 rounded-xl bg-gray-100 text-gray-600 disabled:opacity-30 active:scale-95 transition-transform"><Redo2 className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setShowPrintZone(!showPrintZone)} aria-pressed={showPrintZone} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${showPrintZone ? "text-orange-500 bg-orange-50" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}><Eye className="w-3 h-3" /> Print Zone</button>
            {!isFlatZone && <button type="button" onClick={() => setShow3D(!show3D)} aria-pressed={show3D} className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold ${show3D ? "text-blue-500 bg-blue-50" : "text-gray-500 bg-gray-100 hover:bg-gray-200"}`}><Package className="w-3 h-3" /> {show3D ? "2D Edit" : "3D Preview"}</button>}
             <motion.button type="button" onClick={handleAddToCart} disabled={isAddingToCart || requiredArtworkSurfaceUnavailable} aria-label={isAddingToCart ? "Adding design to cart" : requiredArtworkSurfaceUnavailable ? "Add to cart unavailable for this surface" : "Add design to cart"} title={requiredArtworkSurfaceUnavailable ? unavailableSurfaceReason : undefined} whileTap={{ scale: 0.97 }} className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg shadow-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50" style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
               {isAddingToCart ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />} <span className="hidden sm:inline">{isAddingToCart ? "Preparing…" : "Add to Cart"}</span><span className="sm:hidden">{isAddingToCart ? "Wait" : "Cart"}</span>
            </motion.button>
          </div>
        </div>
      </div>

      <div className="flex-1 container-wide mx-auto w-full px-2 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 space-y-3">
          <StudioFirstUseGuide
            steps={[
              { id: "upload", title: "Upload your artwork", description: "Choose a JPG, PNG, or WebP and it will be fitted to the selected print area." },
              { id: "refine", title: "Refine the design", description: "Drag, resize, rotate, or add text. Switch surfaces to add artwork to the back or sleeves." },
              { id: "review", title: "Preview and order", description: "Check print zone and quality warnings, preview curved products in 3D, then add to cart." },
            ]}
            onFocusCanvas={() => containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
          <StudioQualityBanner
            issues={qualityIssues}
            onShowPrintZone={() => {
              setShowPrintZone(true);
              containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="flex-1 min-w-0" ref={containerRef}>
            <ProductSwitcher />
            <div className="mt-3 mb-3">
             <MainToolbar onExport={handleExportPNG} isExporting={isExporting} exportDisabled={activeSurfaceUnavailable} />
              <div className="mb-3 flex items-center gap-2 overflow-x-auto rounded-2xl border border-orange-100 bg-orange-50/70 p-2 md:hidden no-scrollbar">
                <button type="button" onClick={() => setShowProductPicker(true)} aria-label="Choose product" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-gray-800 shadow-sm active:scale-95"><Package className="h-3.5 w-3.5 text-orange-500" /> Product</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload design image" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-95"><Upload className="h-3.5 w-3.5" /> Upload</button>
                <button type="button" onClick={addText} aria-label="Add text layer" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-black text-gray-800 shadow-sm active:scale-95"><Type className="h-3.5 w-3.5 text-blue-500" /> Text</button>
                <button type="button" onClick={() => setMobileToolOpen(true)} aria-label="Open all design tools" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-2 text-[11px] font-black text-white shadow-sm active:scale-95"><Wand2 className="h-3.5 w-3.5" /> All tools</button>
              </div>
            </div>
            <input
              id="design-studio-upload"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload design image"
              className="absolute left-0 top-0 h-px w-px opacity-0"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { handleFileUpload(f); e.target.value = ""; } }}
            />

            {isZoneTabs && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 no-scrollbar">
                {apparelZones.map(zone => {
                  const isActive = activeFace === zone.face;
                  const count = layers.filter(l => (l.face ?? "front") === zone.face).length;
                  return (
                    <button key={zone.face} onClick={() => setFace(zone.face)} className="relative shrink-0 px-3.5 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: isActive ? "#1C1C1E" : "white", color: isActive ? "white" : "#374151", border: isActive ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                      {zone.shortLabel}
                      {count > 0 && !isActive && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white bg-orange-500 border-2 border-white">{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {isMug && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar">
                {(["side1", "side2", "wrap"] as const).map(v => (
                   <button key={v} onClick={() => setMugView(v)} className="shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: mugMode === v ? "#1C1C1E" : "white", color: mugMode === v ? "white" : "#374151", border: mugMode === v ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: mugMode === v ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                    {v === "side1" ? "Left Side" : v === "side2" ? "Right Side" : "Wrap"}
                  </button>
                ))}
              </div>
            )}
            {(!isMug && !isZoneTabs && (isCap || isWaterBottle)) && (
              <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 no-scrollbar" aria-label="Product view">
                {(["front", "back"] as const).map(view => (
                  <button key={view} onClick={() => setFace(view)} className="shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all active:scale-95" style={{ background: activeFace === view ? "#1C1C1E" : "white", color: activeFace === view ? "white" : "#374151", border: activeFace === view ? "1.5px solid #3a3a3c" : "1.5px solid #e5e7eb", boxShadow: activeFace === view ? "0 4px 12px rgba(0,0,0,0.15)" : "none" }}>
                    {view === "front" ? "Front" : "Back"}
                  </button>
                ))}
              </div>
            )}

            <div className="mb-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2"><Palette className="w-3.5 h-3.5 text-orange-500" /><span className="text-[11px] font-black uppercase tracking-widest text-gray-400">Garment Color</span></div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: selectedColor.hex, color: isLightTint(selectedColor.hex) ? "#374151" : "white" }}>{selectedColor.name}</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5 pb-1.5 items-center justify-items-center">
                {studioColors.map((c: any) => {
                  const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                  return (
                    <button key={c.hex} title={c.name} aria-label={`Select ${c.name}`} onClick={() => setColor(c)} className="relative touch-manipulation transition-transform duration-100 hover:scale-110 active:scale-90" style={{ width: 36, height: 36 }}>
                      {isSelected && <span className="absolute inset-0 rounded-full pointer-events-none" style={{ border: "2.5px solid #E85D04", transform: "scale(1.28)", boxShadow: "0 0 0 2px rgba(232,93,4,0.20)" }} />}
                      <span className="absolute rounded-full transition-transform duration-100" style={{ inset: 3, background: c.hex, border: isLightTint(c.hex) ? "1.5px solid #d1d5db" : "1px solid rgba(0,0,0,0.10)", transform: isSelected ? "scale(0.88)" : "scale(1)", boxShadow: isSelected ? "0 2px 8px rgba(0,0,0,0.28)" : "0 1px 4px rgba(0,0,0,0.14)" }} />
                    </button>
                  );
                })}
              </div>
            </div>

             <div className="relative rounded-3xl overflow-hidden select-none" style={{ background: "radial-gradient(ellipse at 50% 35%, #ffffff 0%, #f8f8f8 55%, #f0f0f0 100%)", border: "1px solid #e5e5e7", boxShadow: "0 6px 40px rgba(0,0,0,0.08)" }} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
               {activeSurfaceUnavailable && (
                 <div role="alert" className="absolute inset-x-4 top-4 z-30 rounded-2xl border border-amber-300 bg-amber-50/95 px-4 py-3 text-center shadow-lg backdrop-blur">
                   <div className="flex items-center justify-center gap-2 text-sm font-black text-amber-950"><ShieldCheck className="h-4 w-4" /> Surface unavailable</div>
                   <p className="mt-1 text-xs font-medium text-amber-900">{unavailableSurfaceReason}</p>
                   <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">Preview, export, and checkout are disabled for this surface</p>
                 </div>
               )}
              <div style={{ position: "relative", width: canvasSize, height: canvasSize, margin: "0 auto" }}>
                 {show3D && !isFlatZone && !isPsdTshirtStaging && !activeSurfaceUnavailable && (
                  <div className="absolute inset-0 z-20 rounded-3xl overflow-hidden flex items-center justify-center" style={{ background: "radial-gradient(ellipse at 50% 40%, #f4f4f4 0%, #e8e8e8 100%)" }}>
                    <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-blue-400" />}>
                      <LazyProductViewer3D product={selectedProduct} garmentColor={selectedColor.hex} front={{ layers: frontLayers, printZone: isMug ? (mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ) : getZonePZ("front", selectedProduct, selectedColor.hex), baseHeight: selectedProduct.baseHeight, surface: { ...frontMockup, baseSrc: frontMockup.cutoutSrc, printZone: isMug ? (mugMode === "wrap" ? MUG_PZ : MUG_SIDE_PZ) : getZonePZ("front", selectedProduct, selectedColor.hex) } }} back={supportsBack && backLayers.length > 0 ? { layers: backLayers, printZone: isMug ? (mugMode === "wrap" ? MUG_WRAP_BACK_PZ : MUG_SIDE_BACK_PZ) : getZonePZ("back", selectedProduct, selectedColor.hex), baseHeight: selectedProduct.baseHeight, surface: { ...backMockup, baseSrc: backMockup.cutoutSrc, printZone: isMug ? (mugMode === "wrap" ? MUG_WRAP_BACK_PZ : MUG_SIDE_BACK_PZ) : getZonePZ("back", selectedProduct, selectedColor.hex) } } : undefined} activeFace={activeFace as "front" | "back"} isWrapMode={isMug && mugMode === "wrap"} />
                    </Suspense>
                     <button type="button" onClick={() => setShow3D(false)} aria-label="Return to 2D editor" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold text-white shadow-xl" style={{ background: "rgba(17,24,39,0.85)", backdropFilter: "blur(8px)" }}><Eye className="w-3 h-3 inline mr-1" /> Back to 2D</button>
                  </div>
                )}
                <CanvasArea
                  width={canvasSize}
                  height={canvasSize}
                  printZone={pz}
                  onCanvasAction={handleCanvasAction}
                  onDrawStart={handleDrawStart}
                  onDrawMove={handleDrawMove}
                  onDrawEnd={handleDrawEnd}
                  onPickColor={handlePickColor}
                  onOpenImageTools={() => {
                    setActiveTab("upload");
                    if (isMobile) setMobileToolOpen(true);
                  }}
                  overlay={activePsdMaterialEffects.length > 0 && hasVisibleArtworkOnFace ? (
                    <div className="absolute inset-0 z-[5] pointer-events-none" style={{ clipPath: materialEffectClipPath }} aria-hidden="true">
                      {activePsdMaterialEffects.map((effect) => (
                        <img key={`${effect.src}-${effect.blendMode}`} src={effect.src} alt="" className="absolute inset-0 h-full w-full" style={{ mixBlendMode: effect.blendMode, opacity: effect.opacity }} />
                      ))}
                    </div>
                  ) : undefined}
                  mockup={
                    isFlatZone && activeZoneConfig
                      ? <FlatZoneSVG zone={activeZoneConfig} showPrintZone={showPrintZone} mockup={activeMockup} />
                      : <GarmentSVG product={selectedProduct} color={selectedColor.hex} showPrintZone={showPrintZone} face={activeFace} mugMode={isMug ? mugMode : undefined} baseSrcOverride={psdTshirtStageAssets?.base} />
                  }
                />
                {isPsdTshirtStaging && (
                  <div className="absolute left-3 right-3 bottom-3 z-10 pointer-events-none rounded-xl border border-amber-300 bg-amber-50/95 px-3 py-2 text-center text-[11px] font-semibold text-amber-950 shadow-sm backdrop-blur">
                    Local PSD T-shirt staging · {selectedColor.name} {activeFace} · 2D review · Cart and export disabled
                  </div>
                )}
                 {!show3D && !isFlatZone && layers.length === 0 && !activeSurfaceUnavailable && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-orange-200"
                      style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 10px 28px rgba(232,93,4,0.30)" }}
                      aria-label={`Upload an image for the ${selectedProduct.name}`}
                    >
                      <CloudUpload className="w-5 h-5" />
                      Upload Image
                    </button>
                  </div>
                )}
              </div>
            </div>

            {currentFaceLayers.length > 0 && (
              <div className="px-4 py-2 mt-2 text-[10px] font-semibold text-gray-500 flex items-center gap-2 bg-white border border-gray-200 rounded-xl">
                <Move className="w-3 h-3 text-orange-500" /> Drag · Pinch to scale & rotate · +/− to zoom
              </div>
            )}
          </div>

          {/* ═══════ MOBILE TOOL SHEET BACKDROP ═══════ */}
          {isMobile && mobileToolOpen && (
            <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px]" onClick={() => setMobileToolOpen(false)} />
          )}

          {/* ═══════ RIGHT PANEL / MOBILE BOTTOM SHEET ═══════ */}
          <div className={`md:w-[320px] lg:w-[340px] shrink-0 flex flex-col gap-4 transition-all duration-300
            ${isMobile ? `fixed bottom-0 left-0 right-0 z-[70] bg-[#faf9f6] rounded-t-[32px] shadow-2xl overflow-hidden transform ${mobileToolOpen ? 'translate-y-0' : 'translate-y-full'}` : 'relative'}`}
            style={isMobile ? { maxHeight: "85vh" } : {}}>
            
            {isMobile && (
              <div className="flex flex-col items-center pt-3 pb-1 shrink-0 sticky top-0 z-10 bg-[#faf9f6]" onClick={() => setMobileToolOpen(false)}>
                <div className="w-10 h-1 rounded-full bg-gray-300 mb-2" />
                <div className="w-full flex items-center justify-between px-5 pb-2">
                  <span className="text-sm font-black text-gray-800 uppercase tracking-wider">Design Tools</span>
                  <button onClick={() => setMobileToolOpen(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100"><X className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <div className={`rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col ${isMobile ? 'flex-1 overflow-hidden mx-2 mb-2' : ''}`}>
              <div className="flex p-1.5 gap-1 bg-[#f8f7f5] rounded-t-2xl border-b border-gray-200 shrink-0">
                {[
                  { id: "upload" as const, label: "Upload", icon: Upload },
                  { id: "text" as const, label: "Text", icon: Type },
                  { id: "ai" as const, label: "AI Art", icon: Wand2 },
                  { id: "layers" as const, label: "Layers", icon: LayersIcon },
                  { id: "templates" as const, label: "Stickers", icon: Sparkles },
                  { id: "qrcode" as const, label: "QR", icon: Crosshair },
                ].map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)} className="relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[9px] font-black transition-all active:scale-90" style={{ background: activeTab === id ? "white" : "transparent", color: activeTab === id ? "#E85D04" : "#9ca3af", boxShadow: activeTab === id ? "0 1px 6px rgba(0,0,0,0.10)" : "none" }}>
                    <Icon className="w-4 h-4" />{label}
                    {id === "layers" && layers.length > 0 && <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white bg-orange-500 border border-white">{layers.length}</span>}
                  </button>
                ))}
              </div>
              <div className={`p-2 ${isMobile ? 'overflow-y-auto' : ''}`}>
                {activeTab === "upload" && (
                  <div className="p-4 space-y-3">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white shadow-md active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)" }}><Upload className="w-4 h-4" /> Upload Image</button>
                    <p className="text-[11px] text-gray-500 text-center">JPG, PNG, or WebP · Max 10MB</p>
                          {selectedLayer?.type === "image" && (
                            <ImagePanel
                              onRemoveBackground={() => void handleRemoveBackground()}
                              onUpscale={() => void handleUpscale()}
                              onAutoFix={() => void handleAutoFix()}
                              onOpenAiReference={() => setActiveTab("ai")}
                              busyAction={imageAction}
                            />
                          )}
                    {!isMug && !isCap && !isWaterBottle && (
                      <div className="pt-3 border-t border-gray-100">
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Garment Size</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_CHART.map(s => (
                            <button key={s.size} onClick={() => setSize(s.size)} className="px-3 py-1.5 rounded-lg text-xs font-black transition-all active:scale-90" style={{ background: selectedSize === s.size ? "linear-gradient(135deg,#E85D04,#FB8500)" : "#f3f4f6", color: selectedSize === s.size ? "white" : "#374151", boxShadow: selectedSize === s.size ? "0 2px 8px rgba(232,93,4,0.2)" : "none" }}>{s.size}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "text" && <TextPanel />}
                {activeTab === "layers" && (
                  <div className="p-2">
                    <div className="flex gap-2 mb-2">
                      <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all"><ImageIcon className="w-3.5 h-3.5 text-orange-500" /> Image</button>
                      <button onClick={addText} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all"><Type className="w-3.5 h-3.5 text-blue-500" /> Text</button>
                    </div>
                    <LayerPanel />
                    {selectedLayer?.type === "shape" && <ShapePanel />}
                  </div>
                )}
                {activeTab === "templates" && <ClipArtBrowser />}
                {activeTab === "ai" && <AIPanel />}
                {activeTab === "qrcode" && <QRCodePanel />}
              </div>
            </div>

            <div className={`p-4 rounded-2xl bg-white border border-gray-200 shadow-sm ${isMobile ? 'mx-2 mb-4' : ''}`}>
              <label className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2 block">Export Design</label>
              <div className="flex gap-2">
                 <button onClick={handleExportPNG} disabled={isExporting || activeSurfaceUnavailable} title={activeSurfaceUnavailable ? "Export is unavailable for this surface" : "Export design as PNG"} className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-200 bg-white hover:bg-gray-50 active:scale-95 transition-all flex items-center justify-center gap-1 disabled:cursor-not-allowed disabled:opacity-60">{isExporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} {isExporting ? "Preparing…" : "PNG"}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ MOBILE FLOATING ACTION BUTTONS ═══════ */}
      {isMobile && (
        <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-3">
          <button
            onClick={() => setMobileToolOpen(true)}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl active:scale-90 transition-transform"
            style={{ background: "linear-gradient(135deg,#E85D04,#FB8500)", boxShadow: "0 8px 24px rgba(232,93,4,0.4)" }}
          >
            <Wand2 className="w-6 h-6" />
          </button>
        </div>
      )}
      <Footer />
    </div>
  );
}
