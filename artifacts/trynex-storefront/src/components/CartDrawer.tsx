import { Link, useLocation } from "wouter";
import { useCartState, useCartActions, type CartItem } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { formatPrice } from "@/lib/utils";
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Sparkles, Truck, Lock, Gift } from "lucide-react";
import { CartItemThumbnail } from "@/components/CartItemThumbnail";
import { motion, AnimatePresence } from "framer-motion";
import { memo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

interface CartLineProps {
  item: CartItem;
  onChangeQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onCloseDrawer: () => void;
  removeFromCart: (id: string) => void;
}

const CartLine = memo(function CartLine({ item, onChangeQuantity, onRemove, onCloseDrawer, removeFromCart }: CartLineProps) {
  const [, setLocation] = useLocation();
  const studioMeta = (() => {
    if (!item.customNote) return null;
    try {
      const p = JSON.parse(item.customNote);
      if (p?.studioDesign) return p;
    } catch {}
    return null;
  })();

  const handleReedit = () => {
    if (!studioMeta?.sessionId) return;
    const sessionRaw = localStorage.getItem(`studio_session_${studioMeta.sessionId}`);
    if (sessionRaw) {
      localStorage.setItem("trynex-design-draft-v1", sessionRaw);
      removeFromCart(item.id);
      onCloseDrawer();
      setLocation("/design-studio?edit=1");
    }
  };

  return (
    <motion.div
      key={item.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3 p-3 rounded-xl"
      style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}
    >
      <CartItemThumbnail item={item} size={64} />
      <div className="flex-1 min-w-0">
        <Link
          href={`/product/${item.productId}`}
          onClick={onCloseDrawer}
          className="text-sm font-bold text-gray-900 hover:text-orange-600 transition-colors truncate block"
        >
          {item.name}
        </Link>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {item.size && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-200/60 text-gray-500">
              {item.size}
            </span>
          )}
          {item.color && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-200/60 text-gray-500 capitalize">
              {item.color}
            </span>
          )}
        </div>
        
        {studioMeta && (
          <button
            onClick={handleReedit}
            className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 text-[10px] font-bold hover:bg-orange-100 transition-colors"
          >
            ✏️ Re-edit
          </button>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
              <button
                onClick={() => onChangeQuantity(item.id, -1)}
                className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors active:bg-gray-100"
                style={{ width: '36px', height: '36px' }}
                aria-label="Decrease quantity"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-black w-8 text-center text-sm text-gray-900 select-none">{item.quantity}</span>
              <button
                onClick={() => onChangeQuantity(item.id, +1)}
                className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors active:bg-gray-100"
                style={{ width: '36px', height: '36px' }}
                aria-label="Increase quantity"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            {studioMeta?.sessionId && (
              <button
                onClick={handleReedit}
                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 px-2 py-1 rounded bg-orange-50 w-fit"
              >
                ✏️ Re-edit
              </button>
            )}
          </div>
          <span className="font-black text-sm text-gray-900">{formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="self-start flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors active:scale-90"
        style={{ width: '32px', height: '32px' }}
        aria-label={`Remove ${item.name}`}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
});

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, subtotal, itemCount } = useCartState();
  const { changeQuantity, removeFromCart } = useCartActions();
  const [, setLocation] = useLocation();
  const settings = useSiteSettings();
  const freeShippingThreshold = settings.freeShippingThreshold ?? 1500;

  const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
  const amountLeft = Math.max(freeShippingThreshold - subtotal, 0);
  const hasFreeShipping = subtotal >= freeShippingThreshold;

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open, onClose]);

  const handleCheckout = useCallback(() => {
    onClose();
    setLocation("/checkout");
  }, [onClose, setLocation]);

  const handleViewCart = useCallback(() => {
    onClose();
    setLocation("/cart");
  }, [onClose, setLocation]);

  const handleBrowse = useCallback(() => {
    onClose();
    setLocation("/products");
  }, [onClose, setLocation]);

  // changeQuantity / removeFromCart are already stable refs from useCartActions,
  // so they can be passed directly to memoized CartLine without wrapping.

  if (typeof document === 'undefined') return null;

  const drawerNode = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 99990 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 w-full max-w-md bg-white shadow-2xl flex flex-col"
            style={{ zIndex: 99991, height: '100dvh', maxHeight: '100dvh' }}
            role="dialog"
            aria-label="Shopping cart"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-black font-display text-gray-900">
                  Your Bag
                  {itemCount > 0 && (
                    <span className="ml-2 text-sm font-bold text-gray-400">({itemCount})</span>
                  )}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center"
                aria-label="Close cart"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Free Shipping Progress Bar */}
            {items.length > 0 && (
              <div className="px-5 py-3 border-b border-gray-50 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 shrink-0" style={{ color: hasFreeShipping ? '#16a34a' : '#E85D04' }} />
                    <span className="text-xs font-bold" style={{ color: hasFreeShipping ? '#16a34a' : '#374151' }}>
                      {hasFreeShipping
                        ? 'You unlocked FREE delivery!'
                        : `Add ${formatPrice(amountLeft)} more for free delivery`}
                    </span>
                  </div>
                  {!hasFreeShipping && (
                    <span className="text-[10px] font-bold text-gray-400">{Math.round(shippingProgress)}%</span>
                  )}
                </div>
                <div className="shipping-progress-track">
                  <motion.div
                    className="shipping-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${shippingProgress}%` }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                {hasFreeShipping && (
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] font-bold text-green-600">Free shipping applied at checkout</span>
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ background: '#f3f4f6' }}>
                  <ShoppingBag className="w-10 h-10 text-gray-300" />
                </div>
                <p className="text-lg font-bold text-gray-900 mb-2">Your bag is empty</p>
                <p className="text-sm text-gray-400 mb-6 text-center">Discover amazing custom products and add them here</p>
                <button
                  onClick={handleBrowse}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', minHeight: '44px' }}
                >
                  Browse Collection <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {/* Cart items */}
                <div
                  className="flex-1 overflow-y-auto px-5 py-3 space-y-3 overscroll-contain"
                  style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
                >
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <CartLine
                        key={item.id}
                        item={item}
                        onChangeQuantity={changeQuantity}
                        onRemove={removeFromCart}
                        onCloseDrawer={onClose}
                        removeFromCart={removeFromCart}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-5 py-4 space-y-3 shrink-0 pb-safe">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-gray-500">Subtotal</span>
                      <p className="text-[10px] text-gray-400">Shipping calculated at checkout</p>
                    </div>
                    <span className="text-xl font-black text-gray-900">{formatPrice(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-center gap-4 py-1">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                      <Lock className="w-3 h-3" /> Secure Checkout
                    </div>
                    <div className="w-px h-3 bg-gray-200" />
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                      <Gift className="w-3 h-3" /> Free Returns
                    </div>
                    <div className="w-px h-3 bg-gray-200" />
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                      <Sparkles className="w-3 h-3" /> Premium Quality
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    className="w-full rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shimmer-btn"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)', minHeight: '52px' }}
                  >
                    Checkout Now <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={handleViewCart}
                    className="w-full py-2 rounded-xl font-semibold text-sm text-gray-500 hover:text-gray-700 transition-colors text-center"
                    style={{ minHeight: '40px' }}
                  >
                    View Full Cart
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(drawerNode, document.body);
}
