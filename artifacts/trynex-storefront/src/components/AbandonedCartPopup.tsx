import { useState, useEffect } from "react";
import { useCart } from "@/context/CartContext";
import { Link, useLocation } from "wouter";
import { ShoppingBag, X, ArrowRight } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function AbandonedCartPopup() {
  const { items, subtotal } = useCart();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [location] = useLocation();

  const excludedPaths = ["/cart", "/checkout", "/admin"];
  const isExcluded = excludedPaths.some(p => location.startsWith(p));

  useEffect(() => {
    if (items.length === 0 || isExcluded || dismissed) return;

    const lastDismiss = sessionStorage.getItem("cart_popup_dismissed");
    if (lastDismiss && Date.now() - parseInt(lastDismiss) < 5 * 60 * 1000) return;

    const timer = setTimeout(() => setShow(true), 45000);
    return () => clearTimeout(timer);
  }, [items.length, isExcluded, dismissed]);

  useEffect(() => {
    if (items.length === 0 || isExcluded || dismissed) return;

    const handleBeforeLeave = (e: MouseEvent) => {
      if (e.clientY <= 5) setShow(true);
    };

    document.addEventListener("mousemove", handleBeforeLeave);
    return () => document.removeEventListener("mousemove", handleBeforeLeave);
  }, [items.length, isExcluded, dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("cart_popup_dismissed", String(Date.now()));
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <div className="relative p-6 text-center"
              style={{ background: "linear-gradient(135deg, #FFF4EE, #FFF8F0)" }}>
              <button onClick={handleDismiss}
                className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-white/50">
                <X className="w-4 h-4" />
              </button>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black font-display text-gray-900 mb-1">Wait! Don't leave yet</h3>
              <p className="text-sm text-gray-500">
                You have <strong className="text-orange-600">{items.length} item{items.length !== 1 ? "s" : ""}</strong> worth <strong className="text-orange-600">{formatPrice(subtotal)}</strong> in your cart!
              </p>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                {items.slice(0, 3).map((item, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40?text=?"; }} />
                  </div>
                ))}
                {items.length > 3 && (
                  <span className="text-xs font-bold text-gray-400">+{items.length - 3} more</span>
                )}
              </div>

              <Link
                href="/cart"
                onClick={handleDismiss}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
              >
                Complete Your Order <ArrowRight className="w-4 h-4" />
              </Link>

              <button onClick={handleDismiss}
                className="w-full py-2.5 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
