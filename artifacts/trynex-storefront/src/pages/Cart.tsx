import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartState, useCartActions, type CartItem } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { formatPrice } from "@/lib/utils";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, ShieldCheck, Tag, XCircle, Image as ImageIcon, Gift, ChevronDown, ChevronUp, Heart } from "lucide-react";
import { memo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LineProps {
  item: CartItem;
  onChangeQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
}

const HamperCartLine = memo(function HamperCartLine({ item, onChangeQuantity, onRemove }: LineProps) {
  const [open, setOpen] = useState(false);
  const h = item.hamperPayload!;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, height: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)', border: '1px solid #FED7AA', boxShadow: '0 1px 4px rgba(232,93,4,0.08)' }}
    >
      <div className="flex gap-5 p-4">
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" width={112} height={112} />
            : <Gift className="w-10 h-10 text-white" />}
        </div>
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="flex justify-between items-start gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest text-white mb-1.5"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                <Gift className="w-2.5 h-2.5" /> Gift Hamper
              </span>
              <p className="font-bold text-base leading-tight text-gray-900 truncate">{h.hamperName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{h.items.length} item{h.items.length === 1 ? '' : 's'} included</p>
              {h.recipientName && (
                <p className="text-xs text-gray-600 mt-1.5 italic flex items-center gap-1">
                  <Heart className="w-3 h-3 text-orange-400" /> For: <strong>{h.recipientName}</strong>
                </p>
              )}
            </div>
            <button onClick={() => onRemove(item.id)} className="p-2 rounded-lg hover:bg-red-50 hover:text-red-500 text-gray-300 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center rounded-xl border border-orange-200 overflow-hidden bg-white">
              <button onClick={() => onChangeQuantity(item.id, -1)} className="px-3 py-2 text-orange-400 hover:text-orange-700"><Minus className="w-3.5 h-3.5" /></button>
              <span className="font-black w-8 text-center text-sm text-gray-900">{item.quantity}</span>
              <button onClick={() => onChangeQuantity(item.id, +1)} className="px-3 py-2 text-orange-400 hover:text-orange-700"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <span className="font-black text-base text-gray-900">{formatPrice(item.price * item.quantity)}</span>
          </div>
        </div>
      </div>
      <button onClick={() => setOpen(!open)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-orange-700 border-t border-orange-100 hover:bg-orange-50 transition-colors">
        <span>{open ? 'Hide' : 'View'} hamper contents</span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-1.5 bg-white/60 border-t border-orange-100">
          {h.items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
              <span className="font-semibold flex-1">{it.name}</span>
              {it.quantity > 1 && <span className="text-gray-400">× {it.quantity}</span>}
            </div>
          ))}
          {h.giftMessage && (
            <div className="mt-3 p-2.5 rounded-lg bg-orange-50 border border-orange-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-1">Gift Message</p>
              <p className="text-xs text-gray-700 italic">"{h.giftMessage}"</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
});

const CatalogCartLine = memo(function CatalogCartLine({ item, onChangeQuantity, onRemove }: LineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30, height: 0 }}
      className="flex gap-5 p-4 rounded-2xl"
      style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
    >
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden shrink-0" style={{ background: '#f3f4f6' }}>
        <img
          src={item.imageUrl || `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=200&h=200&fit=crop`}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          width={112}
          height={112}
        />
      </div>
      <div className="flex-1 flex flex-col justify-between min-w-0">
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0">
            <Link href={`/product/${item.productId}`} className="font-bold text-base leading-tight hover:text-orange-600 transition-colors block truncate text-gray-900">
              {item.name}
            </Link>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {item.size && (
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  Size: {item.size}
                </span>
              )}
              {item.color && (
                <span className="text-xs px-2 py-0.5 rounded-md font-semibold capitalize" style={{ background: '#f3f4f6', color: '#6b7280' }}>
                  {item.color}
                </span>
              )}
            </div>
            {item.customNote && (
              <p className="text-xs mt-2 italic text-gray-400 border-l-2 border-orange-200 pl-2 pr-2 truncate">
                "{item.customNote}"
              </p>
            )}
            {item.customImages && item.customImages.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2">
                <ImageIcon className="w-3 h-3 text-orange-400 shrink-0" />
                <div className="flex gap-1">
                  {item.customImages.slice(0, 4).map((img, idx) => (
                    <img key={idx} src={img} alt={`Design ${idx + 1}`}
                      loading="lazy" decoding="async" width={32} height={32}
                      className="w-8 h-8 rounded-md object-cover border border-gray-200" />
                  ))}
                  {item.customImages.length > 4 && (
                    <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                      +{item.customImages.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => onRemove(item.id)}
            className="p-2 rounded-lg transition-colors hover:bg-red-50 hover:text-red-500 text-gray-300 shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden" style={{ background: '#f9fafb' }}>
            <button onClick={() => onChangeQuantity(item.id, -1)} className="px-3 py-2 text-gray-400 hover:text-gray-700 transition-colors active:scale-90">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="font-black w-8 text-center text-sm text-gray-900">{item.quantity}</span>
            <button onClick={() => onChangeQuantity(item.id, +1)} className="px-3 py-2 text-gray-400 hover:text-gray-700 transition-colors active:scale-90">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="font-black text-base text-gray-900">{formatPrice(item.price * item.quantity)}</span>
        </div>
      </div>
    </motion.div>
  );
});

export default function Cart() {
  const { items, subtotal } = useCartState();
  const { changeQuantity, removeFromCart, clearCart } = useCartActions();
  const [, setLocation] = useLocation();
  const settings = useSiteSettings();
  const freeShippingThreshold = settings.freeShippingThreshold ?? 1500;
  const shippingFee = settings.shippingCost ?? 100;

  const shippingCost = subtotal > 0 && subtotal < freeShippingThreshold ? shippingFee : 0;
  const total = subtotal + shippingCost;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead title="Your Cart" description="Review your shopping cart at TryNex Lifestyle." noindex />
      <Navbar />

      <main className="flex-1 pt-header pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6 sm:mb-10 pt-4 sm:pt-0">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-1 sm:mb-2">Your Cart</p>
            <h1 className="text-3xl sm:text-5xl font-black font-display tracking-tighter text-gray-900">
              {items.length > 0 ? `${items.length} item${items.length > 1 ? 's' : ''}` : "Your bag is empty"}
            </h1>
          </div>

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-28 rounded-3xl"
              style={{ background: 'white', border: '1px dashed #e5e7eb' }}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 relative"
                style={{ background: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '2px solid #fed7aa' }}
              >
                <ShoppingBag className="w-11 h-11 text-orange-400" />
                <motion.div
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-black"
                  style={{ background: '#d1d5db' }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  0
                </motion.div>
              </motion.div>
              <h2 className="text-2xl font-black font-display mb-3 text-gray-900">Your bag is empty</h2>
              <p className="text-gray-400 mb-8 max-w-sm mx-auto">Discover premium custom products crafted just for you</p>
              <Link
                href="/products"
                className="btn-glow inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
              >
                Browse Collection <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 space-y-4">
                <div className="flex justify-end mb-1">
                  <button
                    onClick={() => {
                      if (confirm("Remove all items from your cart?")) clearCart();
                    }}
                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Clear Cart
                  </button>
                </div>
                <AnimatePresence>
                  {items.map((item) => (
                    item.hamperPayload ? (
                      <HamperCartLine
                        key={item.id}
                        item={item}
                        onChangeQuantity={changeQuantity}
                        onRemove={removeFromCart}
                      />
                    ) : (
                      <CatalogCartLine
                        key={item.id}
                        item={item}
                        onChangeQuantity={changeQuantity}
                        onRemove={removeFromCart}
                      />
                    )
                  ))}
                </AnimatePresence>
              </div>

              <div className="lg:col-span-5">
                <div className="sticky top-28 rounded-3xl p-7" style={{ background: 'white', border: '1px solid #e5e7eb' }}>
                  <h3 className="text-xl font-bold font-display mb-6 text-gray-900">Order Summary</h3>

                  <div className="space-y-3 mb-6 text-sm">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-semibold text-gray-900">{formatPrice(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>Shipping</span>
                      <span className={shippingCost === 0 ? "font-bold text-green-600" : "font-semibold text-gray-900"}>
                        {shippingCost === 0 ? "FREE" : formatPrice(shippingCost)}
                      </span>
                    </div>
                    {subtotal > 0 && subtotal < freeShippingThreshold && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(232,93,4,0.06)', border: '1px solid rgba(232,93,4,0.15)', color: '#E85D04' }}>
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        Add {formatPrice(freeShippingThreshold - subtotal)} more for FREE shipping!
                      </div>
                    )}
                    <div className="pt-4 border-t border-gray-200 flex justify-between items-center">
                      <span className="font-bold text-lg text-gray-900">Total</span>
                      <span className="font-black text-3xl text-orange-600">{formatPrice(total)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setLocation("/checkout")}
                    className="btn-glow w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 text-base mb-4"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)' }}
                  >
                    Checkout <ArrowRight className="w-5 h-5" />
                  </button>

                  <Link
                    href="/products"
                    className="block text-center text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors py-2"
                  >
                    ← Continue Shopping
                  </Link>

                  <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 font-medium">
                    <ShieldCheck className="w-4 h-4 text-orange-400" />
                    Secure & encrypted checkout
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
