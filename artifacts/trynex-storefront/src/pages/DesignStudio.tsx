import { useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCart } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, RotateCcw, Trash2, ShoppingCart,
  ZoomIn, ZoomOut, RotateCw, Move, Ruler, Palette,
  ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
  Scissors, Info, Eye, EyeOff, Loader2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   PRODUCT DEFINITIONS
   All SVG coordinates are in the base coordinate space
   (before the padded viewBox offset is applied).
════════════════════════════════════════════════════════ */

type ProductType = "white-tshirt" | "black-tshirt" | "white-mug" | "black-mug";

interface DesignProduct {
  id: ProductType;
  name: string;
  garmentColor: string;
  description: string;
  /** viewBox string — includes 24px padding on all sides */
  viewBox: string;
  /** aspect ratio of viewBox (width/height) */
  aspect: number;
  /** print zone in base (un-padded) SVG coordinates */
  printZone: { x: number; y: number; w: number; h: number };
}

// T-shirt: base space 400×480; viewBox with 24px padding = "-24 -24 448 528"
// Mug: base space 400×340; viewBox with 24px padding = "-24 -24 448 388"
const TSHIRT_PZ = { x: 128, y: 168, w: 144, h: 155 };
const MUG_PZ   = { x: 80,  y: 58,  w: 210, h: 148 };

const PRODUCTS: DesignProduct[] = [
  { id: "white-tshirt", name: "White T-Shirt",  garmentColor: "#F8F7F4", description: "230GSM Cotton", viewBox: "-24 -24 448 528", aspect: 448/528, printZone: TSHIRT_PZ },
  { id: "black-tshirt", name: "Black T-Shirt",  garmentColor: "#1a1a1a", description: "230GSM Cotton", viewBox: "-24 -24 448 528", aspect: 448/528, printZone: TSHIRT_PZ },
  { id: "white-mug",    name: "White Mug",       garmentColor: "#F5F5F5", description: "11oz Ceramic",  viewBox: "-24 -24 448 388", aspect: 448/388, printZone: MUG_PZ   },
  { id: "black-mug",    name: "Black Mug",       garmentColor: "#1C1917", description: "11oz Ceramic",  viewBox: "-24 -24 448 388", aspect: 448/388, printZone: MUG_PZ   },
];

/* ═══════════════════════════════════════════════════════
   SVG PRODUCT MOCKUPS
════════════════════════════════════════════════════════ */

function TShirtSVGParts({ color, showPrintZone }: { color: string; showPrintZone: boolean }) {
  const isDark = /^#[01234]/i.test(color);
  const stitchColor = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const highlight = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
  const shadeColor = isDark ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.07)";

  const BODY = "M130,55 Q122,82 110,100 L0,140 L12,218 L108,192 L108,448 L292,448 L292,192 L388,218 L400,140 L290,100 Q278,82 270,55 Q242,98 200,106 Q158,98 130,55 Z";
  const COLLAR = "M130,55 Q158,98 200,106 Q242,98 270,55 Q260,40 200,36 Q140,40 130,55 Z";
  const pz = TSHIRT_PZ;

  return (
    <>
      <defs>
        <filter id="ts-shadow" x="-8%" y="-8%" width="116%" height="120%">
          <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="rgba(0,0,0,0.18)" />
        </filter>
        <filter id="ts-fabric" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="2" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feComponentTransfer in="grey" result="subtleNoise">
            <feFuncA type="linear" slope="0.15" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="subtleNoise" mode="soft-light" />
        </filter>
        <linearGradient id="ts-hl" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="40%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.03)"} />
        </linearGradient>
        <linearGradient id="ts-body-grad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0)"} />
          <stop offset="50%" stopColor="transparent" />
          <stop offset="100%" stopColor={isDark ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.04)"} />
        </linearGradient>
        <radialGradient id="ts-chest-light" cx="0.5" cy="0.35" r="0.45">
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.25)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="ts-clip"><path d={BODY} /></clipPath>
        <clipPath id="ts-pz-clip">
          <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} />
        </clipPath>
        <filter id="ts-wrinkle-overlay" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.025" numOctaves="3" seed="7" result="wrinkle" />
          <feColorMatrix type="saturate" values="0" in="wrinkle" result="greyWrinkle" />
          <feComponentTransfer in="greyWrinkle" result="subtleWrinkle">
            <feFuncA type="linear" slope="0.12" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="subtleWrinkle" mode="multiply" />
        </filter>
      </defs>
      <path d={BODY} fill={color} filter="url(#ts-shadow)" />
      <g clipPath="url(#ts-clip)" filter="url(#ts-fabric)">
        <path d={BODY} fill={color} />
      </g>
      <path d={BODY} fill="url(#ts-hl)" />
      <path d={BODY} fill="url(#ts-body-grad)" />
      <path d={BODY} fill="url(#ts-chest-light)" />
      <path d="M108,192 L12,218 L12,175 L108,148 Z" fill={shadeColor} clipPath="url(#ts-clip)" />
      <path d="M292,192 L388,218 L388,175 L292,148 Z" fill={shadeColor} clipPath="url(#ts-clip)" />
      <path d="M155,148 Q178,155 200,156 Q222,155 245,148 L245,170 Q222,178 200,180 Q178,178 155,170 Z" fill={isDark ? "rgba(0,0,0,0.06)" : "rgba(0,0,0,0.02)"} clipPath="url(#ts-clip)" />
      <path d={COLLAR} fill={isDark ? "#0d0d0d" : "#e8e6e2"} />
      <path d={COLLAR} fill={isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)"} />
      <ellipse cx="200" cy="100" rx="68" ry="16" fill="rgba(0,0,0,0.08)" clipPath="url(#ts-clip)" />
      <g clipPath="url(#ts-clip)" stroke={stitchColor} fill="none" strokeWidth="1" strokeDasharray="3 2.5">
        <line x1="108" y1="195" x2="108" y2="448" />
        <line x1="292" y1="195" x2="292" y2="448" />
      </g>
      <line x1="108" y1="448" x2="292" y2="448" stroke={stitchColor} fill="none" strokeWidth="1" strokeDasharray="3 2.5" />
      <path d="M12,218 L108,192" stroke={stitchColor} fill="none" strokeWidth="0.8" strokeDasharray="3 2.5" />
      <path d="M388,218 L292,192" stroke={stitchColor} fill="none" strokeWidth="0.8" strokeDasharray="3 2.5" />
      {showPrintZone && (
        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
          fill="rgba(232,93,4,0.03)" stroke="rgba(232,93,4,0.45)"
          strokeWidth="1.5" strokeDasharray="6 4" rx="4" />
      )}
    </>
  );
}

function MugSVGParts({ color, showPrintZone }: { color: string; showPrintZone: boolean }) {
  const isDark = /^#[01234]/i.test(color);
  const highlight = isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";
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
        <filter id="mug-ceramic" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.5" numOctaves="2" seed="5" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feComponentTransfer in="grey" result="subtleNoise">
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="subtleNoise" mode="soft-light" />
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
          <stop offset="0%" stopColor={isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.35)"} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="mug-body-clip"><path d={MUG_BODY} /></clipPath>
        <filter id="mug-wrinkle-overlay" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.02" numOctaves="2" seed="11" result="ceramicGrain" />
          <feColorMatrix type="saturate" values="0" in="ceramicGrain" result="greyCeramic" />
          <feComponentTransfer in="greyCeramic" result="subtleCeramic">
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="subtleCeramic" mode="multiply" />
        </filter>
      </defs>
      <path d="M332,105 Q380,100 388,168 Q388,235 332,230 L332,208 Q362,208 366,168 Q366,130 332,128 Z"
        fill={handleColor} filter="url(#mug-shadow)" />
      <path d="M335,112 Q370,108 375,168 Q375,226 335,222" stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.08)"} fill="none" strokeWidth="1.5" />
      <path d={MUG_BODY} fill={color} filter="url(#mug-shadow)" />
      <g clipPath="url(#mug-body-clip)" filter="url(#mug-ceramic)">
        <path d={MUG_BODY} fill={color} />
      </g>
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

/* ═══════════════════════════════════════════════════════
   SIZE CHART
════════════════════════════════════════════════════════ */

const SIZE_CHART = [
  { size: "XS", chest: "36", length: "26" },
  { size: "S",  chest: "38", length: "27" },
  { size: "M",  chest: "40", length: "28" },
  { size: "L",  chest: "42", length: "29" },
  { size: "XL", chest: "44", length: "30" },
  { size: "XXL",  chest: "46", length: "31" },
  { size: "XXXL", chest: "48", length: "32" },
];

/* ═══════════════════════════════════════════════════════
   DESIGN STATE
════════════════════════════════════════════════════════ */

interface DesignState {
  /** offset in SVG base-space units from print-zone center */
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════ */

export default function DesignStudio() {
  const [, navigate] = useLocation();
  const { addToCart } = useCart();
  const settings = useSiteSettings();
  const { toast } = useToast();

  const [selectedProduct, setSelectedProduct] = useState<DesignProduct>(PRODUCTS[1]);
  // selectedColor tracks the independently-chosen garment color (may differ from selectedProduct when admin colors don't match any product exactly)
  const [selectedColor, setSelectedColor] = useState<{ name: string; hex: string }>({ name: PRODUCTS[1].name, hex: PRODUCTS[1].garmentColor });
  const [activeTab, setActiveTab] = useState<"controls" | "sizes" | "colors">("controls");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imgNaturalW, setImgNaturalW] = useState(1);
  const [imgNaturalH, setImgNaturalH] = useState(1);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showPrintZone, setShowPrintZone] = useState(true);
  const [selectedSize, setSelectedSize] = useState("M");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [design, setDesign] = useState<DesignState>({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; dx: number; dy: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number; angle: number; rot: number } | null>(null);

  const pz = selectedProduct.printZone;
  const isMug = selectedProduct.id.includes("mug");

  /* ── SVG coordinate transform helpers ── */
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

  /* ── File upload ── */
  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload a JPG or PNG image.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setImageDataUrl(src);
      setDesign({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });
      // Get natural dimensions
      const img = new Image();
      img.onload = () => { setImgNaturalW(img.naturalWidth); setImgNaturalH(img.naturalHeight); };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  /* ── Background removal ── */
  const handleRemoveBg = async () => {
    if (!imageDataUrl) return;
    setIsRemoving(true);
    try {
      const res = await fetch("/api/remove-bg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageDataUrl }),
      });
      if (!res.ok) throw new Error("Failed");
      const { result } = await res.json();
      setImageDataUrl(result);
      // Update dimensions for the new image
      const img = new Image();
      img.onload = () => { setImgNaturalW(img.naturalWidth); setImgNaturalH(img.naturalHeight); };
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

  /* ── SVG drag interaction ── */
  const handleSVGPointerDown = useCallback((e: React.PointerEvent<SVGImageElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    const svgPt = clientToSVG(e.clientX, e.clientY);
    dragRef.current = { startX: svgPt.x, startY: svgPt.y, dx: design.x, dy: design.y };
    setIsDragging(true);
  }, [clientToSVG, design.x, design.y]);

  const handleSVGPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const svgPt = clientToSVG(e.clientX, e.clientY);
    setDesign(prev => ({
      ...prev,
      x: dragRef.current!.dx + (svgPt.x - dragRef.current!.startX),
      y: dragRef.current!.dy + (svgPt.y - dragRef.current!.startY),
    }));
  }, [clientToSVG]);

  const handleSVGPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  /* ── Touch pinch-to-zoom on the SVG ── */
  const handleSVGTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      pinchRef.current = {
        dist: Math.sqrt(dx * dx + dy * dy),
        scale: design.scale,
        angle: Math.atan2(dy, dx) * (180 / Math.PI),
        rot: design.rotation,
      };
    }
  }, [design.scale, design.rotation]);

  const handleSVGTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      setDesign(prev => ({
        ...prev,
        scale: Math.max(0.1, Math.min(5, pinchRef.current!.scale * (dist / pinchRef.current!.dist))),
        rotation: pinchRef.current!.rot + (angle - pinchRef.current!.angle),
      }));
    }
  }, []);

  const handleSVGTouchEnd = useCallback(() => { pinchRef.current = null; }, []);

  /* ── SVG corner resize handle drag ── */
  const handleResizeHandleDown = useCallback((e: React.PointerEvent<SVGCircleElement>, corner: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const startPt = clientToSVG(e.clientX, e.clientY);
    const startScale = design.scale;
    const cx = pz.x + pz.w / 2 + design.x;
    const cy = pz.y + pz.h / 2 + design.y;

    const onMove = (me: PointerEvent) => {
      const pt = clientToSVG(me.clientX, me.clientY);
      const startDist = Math.sqrt((startPt.x - cx) ** 2 + (startPt.y - cy) ** 2);
      const newDist = Math.sqrt((pt.x - cx) ** 2 + (pt.y - cy) ** 2);
      setDesign(prev => ({
        ...prev,
        scale: Math.max(0.1, Math.min(5, startScale * (newDist / Math.max(startDist, 1)))),
      }));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [clientToSVG, design.scale, design.x, design.y, pz]);

  /* ── Add to cart ── */
  const handleAddToCart = useCallback(async () => {
    if (!imageDataUrl) {
      toast({ title: "No design", description: "Please upload a design image first.", variant: "destructive" });
      return;
    }
    setIsAddingToCart(true);
    try {
      // Capture snapshot via canvas — garment color base + design overlay
      let snapshotUrl = imageDataUrl;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 600;
        canvas.height = isMug ? Math.round(600 * 340 / 400) : Math.round(600 * 480 / 400);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          // Scale from SVG base units to canvas pixels
          const scaleX = canvas.width / 400;
          const scaleY = canvas.height / (isMug ? 340 : 480);
          // 1. Fill garment color as background so snapshot reflects the actual product color
          ctx.fillStyle = selectedColor.hex;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const img = new Image();
          await new Promise<void>(r => { img.onload = () => r(); img.src = imageDataUrl; });
          const pzCx = (pz.x + pz.w / 2 + design.x) * scaleX;
          const pzCy = (pz.y + pz.h / 2 + design.y) * scaleY;
          const imgW = pz.w * design.scale * scaleX;
          const imgH = imgW * (img.naturalHeight / img.naturalWidth);
          ctx.save();
          ctx.beginPath();
          ctx.rect(pz.x * scaleX, pz.y * scaleY, pz.w * scaleX, pz.h * scaleY);
          ctx.clip();
          ctx.translate(pzCx, pzCy);
          ctx.rotate((design.rotation * Math.PI) / 180);
          ctx.globalAlpha = design.opacity;
          ctx.globalCompositeOperation = 'multiply';
          ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
          snapshotUrl = canvas.toDataURL("image/png", 0.85);
        }
      } catch {}

      // Display price from admin-configured settings (server re-derives this at order time)
      const displayPrice = isMug
        ? (settings.studioMugPrice || 799)
        : (settings.studioTshirtPrice || 1099);

      // Compress the uploaded image to ~256px max dimension before cart storage
      // to avoid hitting localStorage quotas with high-res originals
      let compressedImage = imageDataUrl;
      try {
        const compressCanvas = document.createElement("canvas");
        const compressCtx = compressCanvas.getContext("2d");
        const compressImg = new Image();
        await new Promise<void>((resolve, reject) => {
          compressImg.onload = () => resolve();
          compressImg.onerror = reject;
          compressImg.src = imageDataUrl;
        });
        const maxDim = 512;
        const ratio = Math.min(maxDim / compressImg.width, maxDim / compressImg.height, 1);
        compressCanvas.width = Math.round(compressImg.width * ratio);
        compressCanvas.height = Math.round(compressImg.height * ratio);
        compressCtx?.drawImage(compressImg, 0, 0, compressCanvas.width, compressCanvas.height);
        compressedImage = compressCanvas.toDataURL("image/webp", 0.7);
      } catch {}

      addToCart({
        productId: 0,
        name: `Custom ${selectedProduct.name}`,
        price: displayPrice,
        quantity: 1,
        size: isMug ? undefined : selectedSize,
        color: selectedColor.name,
        imageUrl: snapshotUrl,
        customImages: [compressedImage],
        customNote: JSON.stringify({
          studioDesign: true,
          product: selectedProduct.name,
          color: selectedColor.name,
          colorHex: selectedColor.hex,
          size: selectedSize,
          designParams: { x: design.x, y: design.y, scale: design.scale, rotation: design.rotation, opacity: design.opacity },
        }),
      });

      toast({ title: "✓ Added to cart!", description: `Custom ${selectedProduct.name} (${selectedColor.name}) is ready for checkout.` });
      setTimeout(() => navigate("/cart"), 800);
    } finally {
      setIsAddingToCart(false);
    }
  }, [imageDataUrl, design, selectedProduct, selectedColor, selectedSize, isMug, pz, addToCart, toast, navigate]);

  /* ── Nudge & reset ── */
  const nudge = (axis: "x" | "y", amount: number) =>
    setDesign(prev => ({ ...prev, [axis]: prev[axis] + amount }));

  const resetDesign = () =>
    setDesign({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 });

  /* ── Image in SVG coordinates ── */
  const aspect = imgNaturalW / Math.max(imgNaturalH, 1);
  // Fit image in print zone by default
  const imgSvgW = pz.w * design.scale;
  const imgSvgH = imgSvgW / aspect;
  const imgX = pz.x + pz.w / 2 + design.x - imgSvgW / 2;
  const imgY = pz.y + pz.h / 2 + design.y - imgSvgH / 2;
  const imgCx = pz.x + pz.w / 2 + design.x;
  const imgCy = pz.y + pz.h / 2 + design.y;

  /* ── Corner handle positions ── */
  const handles = imageDataUrl ? [
    { key: "nw", x: imgX, y: imgY },
    { key: "ne", x: imgX + imgSvgW, y: imgY },
    { key: "sw", x: imgX, y: imgY + imgSvgH },
    { key: "se", x: imgX + imgSvgW, y: imgY + imgSvgH },
  ].map(h => {
    // Rotate handle around image center
    const dx = h.x - imgCx, dy = h.y - imgCy;
    const rad = (design.rotation * Math.PI) / 180;
    return {
      key: h.key,
      x: imgCx + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: imgCy + dx * Math.sin(rad) + dy * Math.cos(rad),
    };
  }) : [];

  /* ── Studio color palette — per product type ── */
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

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F5F3F0' }}>
      <SEOHead
        title="Design Studio — TryNex Lifestyle"
        description="Design your own custom T-shirt or mug. Upload your artwork, position it live on the product, and add to cart instantly."
        canonical="/design-studio"
      />
      <Navbar />

      {/* Page header */}
      <div className="border-b border-gray-200 sticky top-0 z-30" style={{ background: 'white' }}>
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div>
            <h1 className="font-display font-black text-xl text-gray-900">Design Studio</h1>
            <p className="text-xs text-gray-500 mt-0.5">You imagine — we craft it.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPrintZone(v => !v)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: showPrintZone ? '#fff4ee' : '#f3f4f6', color: showPrintZone ? '#E85D04' : '#6b7280' }}
            >
              {showPrintZone ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              Print Zone
            </button>
            <motion.button
              onClick={handleAddToCart}
              disabled={!imageDataUrl || isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 12px rgba(232,93,4,0.35)' }}
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
            {/* Product tabs */}
            <div className="flex gap-2 mb-5 flex-wrap">
              {PRODUCTS.map(prod => (
                <button
                  key={prod.id}
                  onClick={() => { setSelectedProduct(prod); setSelectedColor({ name: prod.name, hex: prod.garmentColor }); resetDesign(); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: selectedProduct.id === prod.id ? 'linear-gradient(135deg,#E85D04,#FB8500)' : 'white',
                    color: selectedProduct.id === prod.id ? 'white' : '#374151',
                    border: selectedProduct.id === prod.id ? 'none' : '1.5px solid #e5e7eb',
                    boxShadow: selectedProduct.id === prod.id ? '0 4px 12px rgba(232,93,4,0.3)' : '0 1px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full border shrink-0"
                    style={{ background: prod.garmentColor, borderColor: prod.garmentColor === '#F8F7F4' || prod.garmentColor === '#F5F5F5' ? '#d1d5db' : prod.garmentColor }}
                  />
                  {prod.name}
                </button>
              ))}
            </div>

            {/* Mockup area */}
            <div
              className="relative rounded-3xl overflow-hidden select-none"
              style={{
                background: 'radial-gradient(ellipse at 50% 40%, #F2F0ED 0%, #E8E5E1 50%, #DDDAD5 100%)',
                border: '1px solid #d8d5d0',
                boxShadow: 'inset 0 2px 20px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.08)',
              }}
            >
              <div
                className="relative w-full"
                style={{ aspectRatio: `${selectedProduct.aspect}` }}
              >
                {/* The interactive SVG canvas */}
                <svg
                  ref={svgRef}
                  viewBox={selectedProduct.viewBox}
                  className="absolute inset-0 w-full h-full"
                  style={{ touchAction: 'none', userSelect: 'none' }}
                  onPointerMove={handleSVGPointerMove}
                  onPointerUp={handleSVGPointerUp}
                  onPointerCancel={handleSVGPointerUp}
                  onTouchStart={handleSVGTouchStart}
                  onTouchMove={handleSVGTouchMove}
                  onTouchEnd={handleSVGTouchEnd}
                >
                  {/* Product SVG parts — driven by selectedColor.hex for live preview */}
                  {isMug
                    ? <MugSVGParts color={selectedColor.hex} showPrintZone={showPrintZone} />
                    : <TShirtSVGParts color={selectedColor.hex} showPrintZone={showPrintZone} />
                  }

                  {/* Design image with realistic "printed on" effect */}
                  {imageDataUrl && (
                    <>
                      <defs>
                        <clipPath id="design-clip">
                          <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h} rx="4" />
                        </clipPath>
                        <filter id="design-printed" x="-5%" y="-5%" width="110%" height="110%">
                          <feTurbulence type="fractalNoise" baseFrequency={isMug ? "0.008 0.015" : "0.025 0.018"} numOctaves="3" seed="3" result="dispNoise" />
                          <feDisplacementMap in="SourceGraphic" in2="dispNoise" scale={isMug ? "3" : "4"} xChannelSelector="R" yChannelSelector="G" result="displaced" />
                          <feTurbulence type="fractalNoise" baseFrequency={isMug ? "0.8" : "0.5"} numOctaves="4" seed="9" result="texNoise" />
                          <feColorMatrix type="saturate" values="0" in="texNoise" result="greyTex" />
                          <feComponentTransfer in="greyTex" result="softTex">
                            <feFuncA type="linear" slope={isMug ? "0.06" : "0.10"} />
                          </feComponentTransfer>
                          <feBlend in="displaced" in2="softTex" mode="multiply" result="textured" />
                        </filter>
                      </defs>
                      <g clipPath="url(#design-clip)" style={{ mixBlendMode: 'multiply' }} filter="url(#design-printed)">
                        <image
                          href={imageDataUrl}
                          x={imgX}
                          y={imgY}
                          width={imgSvgW}
                          height={imgSvgH}
                          opacity={design.opacity}
                          transform={`rotate(${design.rotation}, ${imgCx}, ${imgCy})`}
                          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                          onPointerDown={handleSVGPointerDown}
                          preserveAspectRatio="none"
                        />
                      </g>
                      <g clipPath="url(#design-clip)" style={{ mixBlendMode: 'soft-light', pointerEvents: 'none' }}>
                        <rect x={pz.x} y={pz.y} width={pz.w} height={pz.h}
                          fill="url(#ts-chest-light)" opacity="0.3" />
                      </g>

                      {/* Corner resize handles */}
                      {handles.map(h => (
                        <circle
                          key={h.key}
                          cx={h.x}
                          cy={h.y}
                          r={7}
                          fill="white"
                          stroke="#E85D04"
                          strokeWidth="2"
                          style={{ cursor: h.key === "nw" || h.key === "se" ? 'nwse-resize' : 'nesw-resize', touchAction: 'none', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
                          onPointerDown={(e) => handleResizeHandleDown(e, h.key)}
                        />
                      ))}
                    </>
                  )}
                </svg>

                {/* Upload prompt (shown only when no image) */}
                {!imageDataUrl && (
                  <div
                    className="absolute inset-0 flex items-center justify-center cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="text-center px-10 py-10 rounded-2xl"
                      style={{ background: 'rgba(255,255,255,0.80)', border: '2px dashed rgba(232,93,4,0.35)', backdropFilter: 'blur(6px)' }}
                    >
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ background: 'linear-gradient(135deg,#fff4ee,#ffe8d4)' }}
                      >
                        <Upload className="w-8 h-8 text-orange-500" />
                      </div>
                      <p className="font-black text-gray-800 text-lg mb-1">Upload Your Design</p>
                      <p className="text-sm text-gray-500">JPG or PNG · Max 10MB</p>
                      <p className="text-xs text-gray-400 mt-2">or drag & drop here</p>
                    </motion.div>
                  </div>
                )}

                {/* Fabric label */}
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black"
                    style={{ background: 'rgba(255,255,255,0.9)', color: '#374151', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                    {selectedProduct.description}
                  </span>
                </div>
              </div>

              {/* Interaction hint */}
              {imageDataUrl && (
                <div className="px-4 py-3 text-xs font-semibold text-gray-500 flex items-center gap-2 border-t border-gray-100"
                  style={{ background: 'white' }}>
                  <Move className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  Drag to move · Pinch to resize (mobile) · Corner handles to resize (desktop)
                </div>
              )}
            </div>
          </div>

          {/* ═══════ RIGHT: CONTROLS ═══════ */}
          <div className="lg:w-[320px] shrink-0 flex flex-col gap-4">

            {/* Upload / Remove BG */}
            <div className="p-4 rounded-2xl" style={{ background: 'white', border: '1px solid #e9e5e0' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg,#E85D04,#FB8500)', boxShadow: '0 4px 12px rgba(232,93,4,0.3)' }}
                >
                  <Upload className="w-4 h-4" />
                  {imageDataUrl ? "Change Image" : "Upload Image"}
                </button>
                {imageDataUrl && (
                  <button
                    onClick={() => { setImageDataUrl(null); resetDesign(); }}
                    className="p-2.5 rounded-xl"
                    style={{ background: '#fee2e2', color: '#dc2626' }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {imageDataUrl && (
                <>
                  <motion.button
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    onClick={handleRemoveBg}
                    disabled={isRemoving}
                    className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
                    style={{ background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb' }}
                  >
                    {isRemoving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Removing background...</>
                      : <><Scissors className="w-4 h-4" /> Remove Background</>
                    }
                  </motion.button>
                  <div className="mt-3">
                    <img
                      src={imageDataUrl}
                      alt="Preview"
                      className="w-full h-20 object-contain rounded-xl"
                      style={{ background: 'repeating-conic-gradient(#ccc 0% 25%,#f0f0f0 0% 50%) 0 0/16px 16px' }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Tab panel */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e9e5e0' }}>
              <div className="flex border-b border-gray-100">
                {[
                  { id: "controls" as const, label: "Adjust", icon: Move },
                  { id: "sizes" as const, label: "Size Guide", icon: Ruler },
                  { id: "colors" as const, label: "Colors", icon: Palette },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold transition-colors"
                    style={{
                      color: activeTab === id ? '#E85D04' : '#6b7280',
                      borderBottom: activeTab === id ? '2px solid #E85D04' : '2px solid transparent',
                      marginBottom: '-1px',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5" />{label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "controls" && (
                  <motion.div key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4">
                    {/* Garment size */}
                    {!isMug && (
                      <div>
                        <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Garment Size</label>
                        <div className="flex flex-wrap gap-1.5">
                          {SIZE_CHART.map(s => (
                            <button key={s.size} onClick={() => setSelectedSize(s.size)}
                              className="px-3 py-1.5 rounded-lg text-xs font-black transition-all"
                              style={{
                                background: selectedSize === s.size ? 'linear-gradient(135deg,#E85D04,#FB8500)' : '#f3f4f6',
                                color: selectedSize === s.size ? 'white' : '#374151',
                                boxShadow: selectedSize === s.size ? '0 2px 8px rgba(232,93,4,0.3)' : 'none',
                              }}
                            >{s.size}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Scale */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">Scale</label>
                        <span className="text-xs font-bold text-gray-600">{Math.round(design.scale * 100)}%</span>
                      </div>
                      <input type="range" min="10" max="300" step="5"
                        value={Math.round(design.scale * 100)}
                        onChange={e => setDesign(prev => ({ ...prev, scale: parseInt(e.target.value) / 100 }))}
                        className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: '#E85D04' }}
                        disabled={!imageDataUrl} />
                      <div className="flex justify-between mt-1">
                        <button onClick={() => setDesign(p => ({ ...p, scale: Math.max(0.1, p.scale - 0.05) }))} disabled={!imageDataUrl}
                          className="text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-30"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={() => setDesign(p => ({ ...p, scale: Math.min(5, p.scale + 0.05) }))} disabled={!imageDataUrl}
                          className="text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-30"><ZoomIn className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* Rotation */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">Rotation</label>
                        <span className="text-xs font-bold text-gray-600">{Math.round(design.rotation)}°</span>
                      </div>
                      <input type="range" min="-180" max="180" step="1"
                        value={design.rotation}
                        onChange={e => setDesign(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                        className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: '#E85D04' }}
                        disabled={!imageDataUrl} />
                      <div className="flex justify-between mt-1">
                        <button onClick={() => setDesign(p => ({ ...p, rotation: p.rotation - 5 }))} disabled={!imageDataUrl}
                          className="text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-30"><RotateCcw className="w-4 h-4" /></button>
                        <button onClick={() => setDesign(p => ({ ...p, rotation: 0 }))} disabled={!imageDataUrl}
                          className="text-xs font-bold text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-30">Reset</button>
                        <button onClick={() => setDesign(p => ({ ...p, rotation: p.rotation + 5 }))} disabled={!imageDataUrl}
                          className="text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-30"><RotateCw className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">Opacity</label>
                        <span className="text-xs font-bold text-gray-600">{Math.round(design.opacity * 100)}%</span>
                      </div>
                      <input type="range" min="10" max="100" step="5"
                        value={Math.round(design.opacity * 100)}
                        onChange={e => setDesign(prev => ({ ...prev, opacity: parseInt(e.target.value) / 100 }))}
                        className="w-full h-1.5 rounded-full appearance-none bg-gray-100" style={{ accentColor: '#E85D04' }}
                        disabled={!imageDataUrl} />
                    </div>

                    {/* Position nudge */}
                    <div>
                      <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">Position</label>
                      <div className="grid grid-cols-3 gap-1 w-28 mx-auto">
                        <div />
                        <button onClick={() => nudge("y", -4)} disabled={!imageDataUrl}
                          className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center disabled:opacity-30">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <div />
                        <button onClick={() => nudge("x", -4)} disabled={!imageDataUrl}
                          className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center disabled:opacity-30">
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button onClick={resetDesign} disabled={!imageDataUrl}
                          className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center disabled:opacity-30">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => nudge("x", 4)} disabled={!imageDataUrl}
                          className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center disabled:opacity-30">
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <div />
                        <button onClick={() => nudge("y", 4)} disabled={!imageDataUrl}
                          className="p-2 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-50 flex items-center justify-center disabled:opacity-30">
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "sizes" && (
                  <motion.div key="sizes" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                    <p className="text-xs text-gray-500 mb-3">All measurements in inches. Chest = half chest (pit to pit).</p>
                    <div className="rounded-xl overflow-hidden border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: '#f9fafb' }}>
                            <th className="px-3 py-2 text-left font-black text-gray-600">Size</th>
                            <th className="px-3 py-2 text-left font-black text-gray-600">Chest</th>
                            <th className="px-3 py-2 text-left font-black text-gray-600">Length</th>
                          </tr>
                        </thead>
                        <tbody>
                          {SIZE_CHART.map((row, i) => (
                            <tr key={row.size} onClick={() => setSelectedSize(row.size)}
                              className="cursor-pointer border-t border-gray-50 transition-colors"
                              style={{ background: selectedSize === row.size ? '#fff4ee' : i % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td className="px-3 py-2.5 font-black" style={{ color: selectedSize === row.size ? '#E85D04' : '#111' }}>{row.size}</td>
                              <td className="px-3 py-2.5 font-semibold text-gray-600">{row.chest}"</td>
                              <td className="px-3 py-2.5 font-semibold text-gray-600">{row.length}"</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 p-3 rounded-xl text-xs text-gray-500 flex items-start gap-2"
                      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />
                      <span>For a relaxed fit, size up. May shrink 1–2% after first wash.</span>
                    </div>
                  </motion.div>
                )}

                {activeTab === "colors" && (
                  <motion.div key="colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4">
                    <p className="text-xs text-gray-500 mb-3">Available garment colors. Tap a swatch to switch the product view.</p>
                    <div className="grid grid-cols-6 gap-2">
                      {studioColors.map(c => {
                        const isSelected = selectedColor.hex.toLowerCase() === c.hex.toLowerCase();
                        return (
                          <div key={c.hex} className="flex flex-col items-center gap-1" title={c.name}>
                            <div
                              className="w-9 h-9 rounded-xl cursor-pointer transition-transform hover:scale-110 border-2"
                              style={{
                                background: c.hex,
                                borderColor: isSelected ? '#E85D04' : (c.hex === '#FFFFFF' || c.hex === '#F5F5F5' ? '#d1d5db' : c.hex),
                                boxShadow: isSelected ? '0 0 0 3px rgba(232,93,4,0.3)' : '0 2px 6px rgba(0,0,0,0.12)',
                              }}
                              onClick={() => {
                                setSelectedColor({ name: c.name, hex: c.hex });
                                // Switch product mockup if an exact match exists in PRODUCTS; prefer same category (shirt/mug)
                                const exactMatch = PRODUCTS.find(p => p.garmentColor.toLowerCase() === c.hex.toLowerCase());
                                if (exactMatch) {
                                  setSelectedProduct(exactMatch);
                                } else {
                                  // Pick the closest product by category (keep mug/shirt type, change color via state only)
                                  // Color reflected in canvas snapshot via selectedColor.hex; mockup stays nearest match
                                  const isDark = /^#[012345]/i.test(c.hex);
                                  const category = isMug ? "mug" : "tshirt";
                                  const fallback = PRODUCTS.find(p => p.id === `${isDark ? "black" : "white"}-${category}`);
                                  if (fallback) setSelectedProduct(fallback);
                                }
                              }}
                            />
                            <span className="text-[9px] font-semibold truncate w-full text-center" style={{ color: isSelected ? '#E85D04' : '#6b7280' }}>{c.name}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 p-3 rounded-xl text-xs text-gray-500 flex items-start gap-2"
                      style={{ background: '#fff4ee', border: '1px solid #fdd5b4' }}>
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-500" />
                      <span>More colors on request via WhatsApp.</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Add to cart */}
            <motion.button
              onClick={handleAddToCart}
              disabled={!imageDataUrl || isAddingToCart}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2.5 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#E85D04,#FB8500)', boxShadow: '0 8px 24px rgba(232,93,4,0.35)' }}
            >
              {isAddingToCart
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Adding to Cart...</>
                : <><ShoppingCart className="w-5 h-5" /> Add Custom {selectedProduct.name} to Cart</>
              }
            </motion.button>

            {!isMug && (
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
