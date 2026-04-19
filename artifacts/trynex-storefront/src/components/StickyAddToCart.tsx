import { useEffect, useRef, useState, type RefObject } from "react";
import { ShoppingBag, Check, Minus, Plus } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface StickyAddToCartProps {
  triggerRef: RefObject<HTMLElement | null>;
  product: {
    id: number;
    name: string;
    price: number;
    discountPrice?: number | null;
    imageUrl?: string | null;
    stock: number;
  };
  quantity: number;
  onChangeQuantity: (q: number) => void;
  onAddToCart: () => void;
  added: boolean;
  imageOverride?: string;
}

export function StickyAddToCart({
  triggerRef,
  product,
  quantity,
  onChangeQuantity,
  onAddToCart,
  added,
  imageOverride,
}: StickyAddToCartProps) {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const el = triggerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px -20px 0px" }
    );
    observerRef.current.observe(el);
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [triggerRef]);

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    if (visible && isMobile && product.stock >= 1) {
      document.documentElement.dataset.stickyAddVisible = '1';
    } else {
      delete document.documentElement.dataset.stickyAddVisible;
    }
    return () => {
      delete document.documentElement.dataset.stickyAddVisible;
    };
  }, [visible, product.stock]);

  if (product.stock < 1) return null;

  const price = product.discountPrice || product.price;
  const img = imageOverride || product.imageUrl || "";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden transition-transform duration-300"
      style={{
        background: "rgba(255,255,255,0.97)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid #e5e7eb",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        transform: visible ? "translateY(0)" : "translateY(120%)",
        pointerEvents: visible ? "auto" : "none",
      }}
      aria-hidden={!visible}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-2.5"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {img ? (
          <img
            src={img}
            alt={product.name}
            width={44}
            height={44}
            className="w-11 h-11 rounded-lg object-cover border border-gray-200 shrink-0"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-gray-300" />
          </div>
        )}
        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shrink-0">
          <button
            onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
            aria-label="Decrease quantity"
            className="w-8 h-10 flex items-center justify-center text-gray-500 active:bg-gray-100"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-black text-gray-900 tabular-nums">{quantity}</span>
          <button
            onClick={() => onChangeQuantity(Math.min(quantity + 1, product.stock))}
            aria-label="Increase quantity"
            className="w-8 h-10 flex items-center justify-center text-gray-500 active:bg-gray-100"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 truncate leading-tight">{product.name}</p>
          <p className="text-base font-black text-orange-600 leading-tight">{formatPrice(price * quantity)}</p>
        </div>
        <button
          onClick={onAddToCart}
          className="flex items-center gap-1.5 px-4 h-11 rounded-xl font-bold text-white text-sm shrink-0 active:scale-95 transition-transform"
          style={{
            background: added ? "#16a34a" : "linear-gradient(135deg, #E85D04, #FB8500)",
            boxShadow: "0 4px 16px rgba(232,93,4,0.3)",
          }}
          aria-label="Add to cart"
        >
          {added ? (
            <>
              <Check className="w-4 h-4" /> Added
            </>
          ) : (
            <>
              <ShoppingBag className="w-4 h-4" /> Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}
