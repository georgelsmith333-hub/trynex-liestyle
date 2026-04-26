import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/context/CartContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Link, useLocation } from "wouter";
import { ShoppingBag, X, ArrowRight, Tag, Truck, Clock } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const POPUP_DURATION_S = 10 * 60;

interface CountdownResult {
  display: string;
  pct: number;
  expired: boolean;
}

function useCartCountdown(active: boolean): CountdownResult {
  const [remaining, setRemaining] = useState(POPUP_DURATION_S);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(POPUP_DURATION_S);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    display: `${pad(m)}:${pad(s)}`,
    pct: (remaining / POPUP_DURATION_S) * 100,
    expired: remaining === 0,
  };
}

/**
 * Parse promo discount string (e.g. "৳100", "10%", "15% off") and compute the
 * actual taka savings given the current cart subtotal.
 * Returns 0 if the string cannot be parsed or the discount is negligible.
 */
function calcSavings(discountStr: string | undefined, subtotal: number): number {
  if (!discountStr || subtotal <= 0) return 0;
  const trimmed = discountStr.trim();
  // Percentage: "10%", "15% off", etc.
  const pctMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pctMatch) {
    return Math.round((subtotal * parseFloat(pctMatch[1])) / 100);
  }
  // Fixed taka: "৳100", "100", "BDT 100"
  const fixedMatch = trimmed.match(/(\d+(?:\.\d+)?)/);
  if (fixedMatch) {
    return parseFloat(fixedMatch[1]);
  }
  return 0;
}

export function AbandonedCartPopup() {
  const { items, subtotal } = useCart();
  const settings = useSiteSettings();
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [location] = useLocation();
  const freeShippingThreshold = settings.freeShippingThreshold ?? 1500;
  const promoCode = settings.exitIntentPromoCode || "WELCOME5";
  const promoDiscount = settings.exitIntentPromoDiscount || "৳100";
  const remainingForFreeShip = Math.max(0, freeShippingThreshold - subtotal);
  const showFreeShipNudge = subtotal > 0 && subtotal < freeShippingThreshold;

  const excludedPaths = ["/cart", "/checkout", "/admin"];
  const isExcluded = excludedPaths.some(p => location.startsWith(p));

  const { display: countdownDisplay, pct: countdownPct, expired: countdownExpired } = useCartCountdown(show);

  // Dynamically calculated savings in taka from active promo
  const savingsAmount = calcSavings(promoDiscount, subtotal);

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

  useEffect(() => {
    if (countdownExpired && show) {
      handleDismiss();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownExpired, show]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem("cart_popup_dismissed", String(Date.now()));
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Countdown urgency bar — decreases as time runs out */}
            <div className="h-1 bg-gray-100 relative overflow-hidden">
              <motion.div
                className="h-full absolute left-0 top-0"
                style={{ background: "linear-gradient(90deg, #E85D04, #FB8500)" }}
                animate={{ width: `${countdownPct}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>

            <div className="relative p-6 text-center"
              style={{ background: "linear-gradient(135deg, #FFF4EE, #FFF8F0)" }}>
              <button onClick={handleDismiss}
                aria-label="Close cart reminder"
                className="absolute top-3 right-3 touch-target text-gray-400 hover:text-gray-600 rounded-xl hover:bg-white/60 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-black font-display text-gray-900 mb-1">Don't leave these behind!</h3>
              <p className="text-sm text-gray-500 mb-3">
                You have <strong className="text-orange-600">{items.length} item{items.length !== 1 ? "s" : ""}</strong> worth <strong className="text-orange-600">{formatPrice(subtotal)}</strong> in your cart.
              </p>
              {/* Savings badge */}
              {savingsAmount > 0 && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black mb-2"
                  style={{ background: "rgba(22,163,74,0.08)", color: "#15803d", border: "1px solid rgba(22,163,74,0.15)" }}>
                  You save {formatPrice(savingsAmount)} with code {promoCode}!
                </div>
              )}
              {/* Countdown timer */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(232,93,4,0.08)", color: "#E85D04" }}>
                <Clock className="w-3.5 h-3.5" />
                Cart reserved for <span className="font-mono ml-1">{countdownDisplay}</span>
              </div>
            </div>

            <div className="p-5 space-y-3">
              {/* Item thumbnails */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100">
                {items.slice(0, 4).map((item, i) => (
                  <div key={i} className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200 shadow-sm">
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/40x40?text=?"; }} />
                  </div>
                ))}
                {items.length > 4 && (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-gray-500">+{items.length - 4}</span>
                  </div>
                )}
                <div className="ml-auto text-right">
                  <p className="text-[10px] text-gray-400 font-medium">Subtotal</p>
                  <p className="text-sm font-black text-gray-900">{formatPrice(subtotal)}</p>
                  {savingsAmount > 0 && (
                    <p className="text-[10px] font-bold text-green-600">Save {formatPrice(savingsAmount)}</p>
                  )}
                </div>
              </div>

              {promoCode ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl"
                  style={{ background: "rgba(232,93,4,0.06)", border: "1px solid rgba(232,93,4,0.18)" }}>
                  <Tag className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-orange-700 leading-tight">
                      Use code <span className="px-1.5 py-0.5 rounded bg-white text-orange-600 font-black border border-orange-100">{promoCode}</span>
                      {savingsAmount > 0
                        ? ` to save ${formatPrice(savingsAmount)} — one-time only!`
                        : ` for ${promoDiscount} off — one-time only!`}
                    </p>
                    {showFreeShipNudge && (
                      <p className="text-[10px] text-orange-600 mt-1 opacity-80">
                        Add {formatPrice(remainingForFreeShip)} more for FREE delivery!
                      </p>
                    )}
                  </div>
                </div>
              ) : showFreeShipNudge ? (
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: "rgba(232,93,4,0.06)", border: "1px solid rgba(232,93,4,0.18)" }}>
                  <Truck className="w-4 h-4 text-orange-600 shrink-0" />
                  <p className="text-xs font-bold text-orange-700 leading-tight">
                    Only {formatPrice(remainingForFreeShip)} more for FREE delivery!
                    <span className="block mt-0.5 text-[10px] opacity-80">Free shipping on orders above {formatPrice(freeShippingThreshold)}</span>
                  </p>
                </div>
              ) : null}

              <Link
                href="/cart"
                onClick={handleDismiss}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
              >
                Complete Your Order <ArrowRight className="w-4 h-4" />
              </Link>

              <button onClick={handleDismiss}
                className="w-full py-2.5 text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors">
                I'll come back later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
