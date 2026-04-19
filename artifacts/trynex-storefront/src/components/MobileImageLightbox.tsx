import { useEffect, useRef, useState, useCallback } from "react";
import { X as XIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";


interface Props {
  images: string[];
  startIndex: number;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_MS = 280;
const SWIPE_THRESHOLD = 60;

type Pt = { clientX: number; clientY: number };

function distance(a: Pt, b: Pt) {
  const dx = a.clientX - b.clientX;
  const dy = a.clientY - b.clientY;
  return Math.hypot(dx, dy);
}

function midpoint(a: Pt, b: Pt) {
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export function MobileImageLightbox({ images, startIndex, alt, onClose }: Props) {
  const [index, setIndex] = useState(startIndex);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const gestureRef = useRef<{
    mode: "none" | "pan" | "pinch" | "swipe";
    startDist: number;
    startScale: number;
    startTx: number;
    startTy: number;
    startMidX: number;
    startMidY: number;
    startTouchX: number;
    startTouchY: number;
    lastTapAt: number;
    lastTapX: number;
    lastTapY: number;
  }>({
    mode: "none",
    startDist: 0,
    startScale: 1,
    startTx: 0,
    startTy: 0,
    startMidX: 0,
    startMidY: 0,
    startTouchX: 0,
    startTouchY: 0,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
  });

  const resetTransform = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  useEffect(() => {
    resetTransform();
  }, [index, resetTransform]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && images.length > 1) setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft" && images.length > 1) setIndex((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [images.length, onClose]);

  const clampPan = useCallback((nextScale: number, nextTx: number, nextTy: number) => {
    const el = containerRef.current;
    if (!el) return { x: nextTx, y: nextTy };
    const rect = el.getBoundingClientRect();
    const overflowX = (rect.width * (nextScale - 1)) / 2;
    const overflowY = (rect.height * (nextScale - 1)) / 2;
    return {
      x: Math.max(-overflowX, Math.min(overflowX, nextTx)),
      y: Math.max(-overflowY, Math.min(overflowY, nextTy)),
    };
  }, []);

  const goNext = useCallback(() => {
    if (images.length < 2) return;
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length < 2) return;
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    setIsAnimating(false);
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      g.mode = "pinch";
      g.startDist = distance(t1, t2);
      g.startScale = scale;
      g.startTx = tx;
      g.startTy = ty;
      const mid = midpoint(t1, t2);
      g.startMidX = mid.x;
      g.startMidY = mid.y;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      g.startTouchX = t.clientX;
      g.startTouchY = t.clientY;
      g.startTx = tx;
      g.startTy = ty;
      g.mode = scale > 1 ? "pan" : "swipe";
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (g.mode === "pinch" && e.touches.length === 2) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const d = distance(t1, t2);
      let nextScale = (d / g.startDist) * g.startScale;
      nextScale = Math.max(MIN_SCALE * 0.9, Math.min(MAX_SCALE, nextScale));
      const mid = midpoint(t1, t2);
      const dx = mid.x - g.startMidX;
      const dy = mid.y - g.startMidY;
      const nextTx = g.startTx + dx;
      const nextTy = g.startTy + dy;
      const clamped = clampPan(nextScale, nextTx, nextTy);
      setScale(nextScale);
      setTx(clamped.x);
      setTy(clamped.y);
    } else if (g.mode === "pan" && e.touches.length === 1) {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - g.startTouchX;
      const dy = t.clientY - g.startTouchY;
      const clamped = clampPan(scale, g.startTx + dx, g.startTy + dy);
      setTx(clamped.x);
      setTy(clamped.y);
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (g.mode === "pinch") {
      if (scale < 1.05) {
        setIsAnimating(true);
        resetTransform();
      } else if (scale > MAX_SCALE) {
        setIsAnimating(true);
        setScale(MAX_SCALE);
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        g.startTouchX = t.clientX;
        g.startTouchY = t.clientY;
        g.startTx = tx;
        g.startTy = ty;
        g.mode = "pan";
      } else {
        g.mode = "none";
      }
      return;
    }

    if (g.mode === "swipe" && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - g.startTouchX;
      const dy = t.clientY - g.startTouchY;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) goNext();
        else goPrev();
        g.mode = "none";
        return;
      }
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
        const now = Date.now();
        const dt = now - g.lastTapAt;
        const closeToLast = Math.abs(t.clientX - g.lastTapX) < 30 && Math.abs(t.clientY - g.lastTapY) < 30;
        if (dt < DOUBLE_TAP_MS && closeToLast) {
          setIsAnimating(true);
          if (scale > 1.05) {
            resetTransform();
          } else {
            const el = containerRef.current;
            if (el) {
              const rect = el.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const targetScale = 2.5;
              const offsetX = (cx - t.clientX) * (targetScale - 1);
              const offsetY = (cy - t.clientY) * (targetScale - 1);
              const clamped = clampPan(targetScale, offsetX, offsetY);
              setScale(targetScale);
              setTx(clamped.x);
              setTy(clamped.y);
            }
          }
          g.lastTapAt = 0;
        } else {
          g.lastTapAt = now;
          g.lastTapX = t.clientX;
          g.lastTapY = t.clientY;
        }
      }
    }

    if (g.mode === "pan") {
      g.mode = "none";
    }
  };

  const content = (
    <div className="fixed inset-0 z-[100] bg-black select-none" style={{ touchAction: "none" }}>
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),0.75rem)] pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white text-sm font-bold">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ""}
        </div>
        <button
          onClick={onClose}
          aria-label="Close image viewer"
          className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 active:bg-white/35 flex items-center justify-center text-white backdrop-blur-sm"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={images[index]}
          alt={alt || `Image ${index + 1}`}
          draggable={false}
          className="max-w-full max-h-full object-contain pointer-events-none"
          style={{
            transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
            transformOrigin: "center center",
            transition: isAnimating ? "transform 200ms ease-out" : "none",
            willChange: "transform",
          }}
          onTransitionEnd={() => setIsAnimating(false)}
        />
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous image"
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 items-center justify-center text-white z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            aria-label="Next image"
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 items-center justify-center text-white z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 z-10 flex gap-1.5" style={{ bottom: "max(env(safe-area-inset-bottom), 1rem)" }}>
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to image ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 24 : 8,
                  background: i === index ? "#FB8500" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        </>
      )}

      <p className="absolute left-1/2 -translate-x-1/2 top-[max(env(safe-area-inset-top),0.75rem)] mt-12 text-[11px] font-semibold text-white/60 pointer-events-none z-10">
        Pinch to zoom · Double-tap · Swipe
      </p>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
