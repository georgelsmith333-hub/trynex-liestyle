import { Link, useLocation } from "wouter";
  import { useCart } from "@/context/CartContext";
  import { useSiteSettings } from "@/context/SiteSettingsContext";
  import { formatPrice } from "@/lib/utils";
  import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Sparkles, Truck, Lock, Gift } from "lucide-react";
  import { motion, AnimatePresence } from "framer-motion";
  import { useEffect, useMemo } from "react";
  import { createPortal } from "react-dom";

  export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { items, updateQuantity, removeFromCart, subtotal, itemCount } = useCart();
    const [, setLocation] = useLocation();
    const settings = useSiteSettings();
    const freeShippingThreshold = settings.freeShippingThreshold ?? 1500;

    // Calculate free shipping progress
    const shippingProgress = Math.min((subtotal / freeShippingThreshold) * 100, 100);
    const amountLeft = Math.max(freeShippingThreshold - subtotal, 0);
    const hasFreeShipping = subtotal >= freeShippingThreshold;

    // Total savings from discounted items
    const totalSavings = useMemo(() => {
      return items.reduce((acc, item) => {
        // We don't have original price in cart items easily, but we track discountPrice through product
        return acc;
      }, 0);
    }, [items]);

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

    const handleCheckout = () => {
      onClose();
      setLocation("/checkout");
    };

    const handleViewCart = () => {
      onClose();
      setLocation("/cart");
    };

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

              {/* Free Shipping Progress Bar — always show */}
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
                    onClick={() => { onClose(); setLocation("/products"); }}
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-white text-sm active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', minHeight: '44px' }}
                  >
                    Browse Collection <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  {/* Cart items */}
                  <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                    <AnimatePresence initial={false}>
                      {items.map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex gap-3 p-3 rounded-xl"
                          style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                            <img
                              src={item.imageUrl || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=120&h=120&fit=crop'}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/product/${item.productId}`}
                              onClick={onClose}
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
                            <div className="flex items-center justify-between mt-2">
                              {/* Quantity controls — touch-friendly (44px touch area) */}
                              <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden bg-white">
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors active:bg-gray-100"
                                  style={{ width: '36px', height: '36px' }}
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-black w-8 text-center text-sm text-gray-900 select-none">{item.quantity}</span>
                                <button
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors active:bg-gray-100"
                                  style={{ width: '36px', height: '36px' }}
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="font-black text-sm text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="self-start flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors active:scale-90"
                            style={{ width: '32px', height: '32px' }}
                            aria-label={`Remove ${item.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3 shrink-0 pb-safe">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-500">Subtotal</span>
                        <p className="text-[10px] text-gray-400">Shipping calculated at checkout</p>
                      </div>
                      <span className="text-xl font-black text-gray-900">{formatPrice(subtotal)}</span>
                    </div>

                    {/* Trust row */}
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

                    {/* Checkout CTA */}
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
  