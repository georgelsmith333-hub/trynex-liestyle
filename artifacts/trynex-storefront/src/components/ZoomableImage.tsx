import { useState, useEffect, useRef, useCallback } from "react";
import { Package, ZoomIn, ZoomOut, Maximize2, Minimize2, Expand, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export type PreviewItem = { src: string; alt: string; isStudio: boolean };

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export type ZoomControls = {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
};

export function ZoomableImage({
  src,
  alt,
  onZoomChange,
  onControlsChange,
}: {
  src: string;
  alt: string;
  onZoomChange?: (zoomed: boolean) => void;
  onControlsChange?: (controls: ZoomControls) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ startDist: number; startScale: number; startTx: number; startTy: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null);
  const interactingRef = useRef(false);

  useEffect(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, [src]);

  useEffect(() => {
    onZoomChange?.(scale > 1);
  }, [scale, onZoomChange]);

  const zoomCenter = useCallback((nextScale: number) => {
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));
    const ratio = s / scale;
    const nx = tx * ratio;
    const ny = ty * ratio;
    setScale(s);
    const el = containerRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      setTx(Math.max(-maxX, Math.min(maxX, nx)));
      setTy(Math.max(-maxY, Math.min(maxY, ny)));
    } else {
      setTx(nx);
      setTy(ny);
    }
  }, [scale, tx, ty]);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => {
    onControlsChange?.({
      scale,
      zoomIn: () => zoomCenter(scale * 1.4),
      zoomOut: () => zoomCenter(scale / 1.4),
      reset,
    });
  }, [scale, zoomCenter, reset, onControlsChange]);

  const clamp = useCallback((s: number, x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return { x, y };
    const rect = el.getBoundingClientRect();
    const maxX = (rect.width * (s - 1)) / 2;
    const maxY = (rect.height * (s - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  const apply = useCallback((nextScale: number, nextX: number, nextY: number) => {
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, nextScale));
    const c = clamp(s, nextX, nextY);
    setScale(s);
    setTx(c.x);
    setTy(c.y);
  }, [clamp]);

  const zoomAt = useCallback((nextScale: number, clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const ratio = nextScale / scale;
    apply(nextScale, cx - (cx - tx) * ratio, cy - (cy - ty) * ratio);
  }, [scale, tx, ty, apply]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    zoomAt(scale * factor, e.clientX, e.clientY);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) {
      apply(1, 0, 0);
    } else {
      zoomAt(2.5, e.clientX, e.clientY);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchRef.current = { startDist: dist, startScale: scale, startTx: tx, startTy: ty };
      panRef.current = null;
      interactingRef.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      e.stopPropagation();
    } else if (pointersRef.current.size === 1 && scale > 1) {
      panRef.current = { startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
      interactingRef.current = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      e.stopPropagation();
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values()).slice(0, 2);
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ratio = dist / pinchRef.current.startDist;
      apply(pinchRef.current.startScale * ratio, pinchRef.current.startTx, pinchRef.current.startTy);
      e.stopPropagation();
    } else if (panRef.current && scale > 1) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      apply(scale, panRef.current.startTx + dx, panRef.current.startTy + dy);
      e.stopPropagation();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      panRef.current = null;
      setTimeout(() => { interactingRef.current = false; }, 0);
    }
  };

  const onTouchStartCapture = (e: React.TouchEvent) => {
    if (scale > 1 || e.touches.length > 1) e.stopPropagation();
  };
  const onTouchMoveCapture = (e: React.TouchEvent) => {
    if (scale > 1 || e.touches.length > 1) e.stopPropagation();
  };
  const onTouchEndCapture = (e: React.TouchEvent) => {
    if (scale > 1 || interactingRef.current) e.stopPropagation();
  };

  const onContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const isInteracting = !!pinchRef.current || !!panRef.current;
  const zoomed = scale > 1;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
      onClick={onContainerClick}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onTouchStartCapture={onTouchStartCapture}
      onTouchMoveCapture={onTouchMoveCapture}
      onTouchEndCapture={onTouchEndCapture}
      style={{ cursor: zoomed ? (isInteracting ? 'grabbing' : 'grab') : 'zoom-in' }}
    >
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-full object-contain select-none pointer-events-none"
        style={{
          transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isInteracting ? 'none' : 'transform 0.2s ease-out',
          willChange: 'transform',
        }}
        draggable={false}
      />
    </div>
  );
}

export function ItemPreviewThumb({
  src,
  alt,
  isStudio,
  onOpen,
  size = "md",
}: {
  src: string;
  alt: string;
  isStudio: boolean;
  onOpen?: () => void;
  size?: "sm" | "md";
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!src && !failed;
  const containerClass = cn(
    "rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative group",
    size === "sm" ? "w-12 h-12" : isStudio ? "w-20 h-20" : "w-16 h-16",
    showImage && "cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
  );
  const containerStyle = {
    background: isStudio
      ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
      : '#f3f4f6',
    border: isStudio ? '1px solid rgba(232,93,4,0.2)' : '1px solid #e5e7eb',
  };
  const inner = (
    <>
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="w-6 h-6 text-gray-300" aria-hidden="true" />
      )}
      {isStudio && (
        <span
          className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest text-white shadow"
          style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
        >
          Custom
        </span>
      )}
      {showImage && (
        <span
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors duration-200"
          aria-hidden="true"
        >
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </span>
      )}
    </>
  );

  if (!showImage || !onOpen) {
    return <div className={containerClass} style={containerStyle}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className={containerClass}
      style={containerStyle}
      aria-label={`View ${alt} full size`}
    >
      {inner}
    </button>
  );
}

export function PreviewLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: PreviewItem[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const open = index !== null && index >= 0 && index < items.length;
  const current = open ? items[index] : null;
  const total = items.length;
  const hasMultiple = total > 1;
  const [isZoomed, setIsZoomed] = useState(false);
  const [controls, setControls] = useState<ZoomControls | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomPct = Math.round((controls?.scale ?? 1) * 100);
  const canZoomIn = (controls?.scale ?? 1) < MAX_ZOOM - 0.001;
  const canZoomOut = (controls?.scale ?? 1) > MIN_ZOOM + 0.001;

  const goPrev = useCallback(() => {
    if (index === null || !hasMultiple) return;
    onIndexChange((index - 1 + total) % total);
  }, [index, total, hasMultiple, onIndexChange]);

  const goNext = useCallback(() => {
    if (index === null || !hasMultiple) return;
    onIndexChange((index + 1) % total);
  }, [index, total, hasMultiple, onIndexChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, goPrev, goNext]);

  useEffect(() => {
    if (!open) {
      setIsZoomed(false);
      setControls(null);
    }
  }, [open]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === contentRef.current);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!open && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [open]);

  const toggleFullscreen = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) { touchStartX.current = null; touchStartY.current = null; return; }
    const t = e.touches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev(); else goNext();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPortal>
        <DialogOverlay className="bg-black/90" />
        <DialogPrimitive.Content
          ref={contentRef}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 max-w-none max-h-none flex items-center justify-center outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            isFullscreen ? "w-screen h-screen bg-black" : "w-[95vw] h-[95vh]"
          )}
          onClick={onClose}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <DialogPrimitive.Title className="sr-only">{current?.alt ?? 'Item preview'}</DialogPrimitive.Title>
          {current && (
            <ZoomableImage
              key={current.src}
              src={current.src}
              alt={current.alt}
              onZoomChange={setIsZoomed}
              onControlsChange={setControls}
            />
          )}
          {controls && (
            <div
              className={cn(
                "absolute bottom-16 sm:bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 p-1 rounded-full bg-white/10 backdrop-blur-md text-white shadow-lg transition-opacity",
                isZoomed ? "opacity-100" : "opacity-0 sm:opacity-100 pointer-events-none sm:pointer-events-auto"
              )}
              onClick={(e) => e.stopPropagation()}
              role="toolbar"
              aria-label="Image zoom controls"
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); controls.zoomOut(); }}
                disabled={!canZoomOut}
                className="w-9 h-9 rounded-full hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span
                className="px-2 min-w-[3.5rem] text-center text-xs font-bold tabular-nums select-none"
                aria-live="polite"
                aria-label={`Zoom ${zoomPct} percent`}
              >
                {zoomPct}%
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); controls.zoomIn(); }}
                disabled={!canZoomIn}
                className="w-9 h-9 rounded-full hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); controls.reset(); }}
                disabled={!canZoomOut}
                className="w-9 h-9 ml-0.5 rounded-full hover:bg-white/15 disabled:opacity-40 disabled:hover:bg-transparent flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Reset zoom to fit"
                title="Reset to fit"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                className="w-9 h-9 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                aria-pressed={isFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
              </button>
            </div>
          )}
          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Previous preview"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label="Next preview"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold tabular-nums select-none"
                onClick={(e) => e.stopPropagation()}
              >
                {(index ?? 0) + 1} / {total}
              </div>
            </>
          )}
          <DialogPrimitive.Close
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Close preview"
          >
            <X className="w-6 h-6" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
