import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Tag, Copy, Check, ArrowRight, Loader2, Clock } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/utils";
import { trackLead } from "@/lib/tracking";

const SESSION_KEY = "trynex_exit_intent_shown";
const OFFER_DURATION_S = 15 * 60;

function useOfferCountdown(active: boolean) {
  const [remaining, setRemaining] = useState(OFFER_DURATION_S);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(OFFER_DURATION_S);
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { display: `${pad(m)}:${pad(s)}`, pct: (remaining / OFFER_DURATION_S) * 100, expired: remaining === 0 };
}

export function ExitIntentPopup() {
  const { exitIntentPromoEnabled, exitIntentPromoDiscount } = useSiteSettings();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState<"capture" | "code">("capture");
  const [contact, setContact] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [location] = useLocation();
  const shownRef = useRef(false);

  const excluded = ["/checkout", "/admin"].some(p => location.startsWith(p));

  const { display: countdownDisplay, pct: countdownPct, expired: offerExpired } = useOfferCountdown(show);

  useEffect(() => {
    if (!exitIntentPromoEnabled || excluded || shownRef.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 5 && !shownRef.current) {
        shownRef.current = true;
        sessionStorage.setItem(SESSION_KEY, "1");
        setShow(true);
      }
    };

    let lastScrollY = window.scrollY;
    let lastScrollTime = Date.now();

    const onScroll = () => {
      const now = Date.now();
      const scrollY = window.scrollY;
      const velocity = (lastScrollY - scrollY) / (now - lastScrollTime);
      lastScrollY = scrollY;
      lastScrollTime = now;

      if (velocity > 2 && scrollY < 50 && !shownRef.current) {
        shownRef.current = true;
        sessionStorage.setItem(SESSION_KEY, "1");
        setShow(true);
      }
    };

    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("scroll", onScroll);
    };
  }, [exitIntentPromoEnabled, excluded]);

  useEffect(() => {
    if (offerExpired && show) setShow(false);
  }, [offerExpired, show]);

  const handleDismiss = () => setShow(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch(getApiUrl("/api/promo-codes/exit-intent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contact.trim() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (body.error === "not_available") {
          setError("No promo available right now — check back soon!");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }

      const data = await response.json();
      setPromoCode(data.code);
      setStep("code");
      trackLead({ content_name: "exit_intent_promo" });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!promoCode) return;
    navigator.clipboard.writeText(promoCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!exitIntentPromoEnabled) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Urgency timer bar */}
            <div className="h-1 bg-gray-100">
              <motion.div
                className="h-full"
                style={{ background: "linear-gradient(90deg, #E85D04, #FB8500)" }}
                animate={{ width: `${countdownPct}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>

            <button
              onClick={handleDismiss}
              aria-label="Close offer"
              className="absolute top-3 right-3 z-10 touch-target rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="p-8 pb-6 text-center text-white relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #E85D04 0%, #FB8500 100%)" }}
            >
              {/* Decorative dots */}
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }} />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Tag className="w-8 h-8 text-white" />
                </div>
                <p className="text-white/80 text-sm font-semibold uppercase tracking-widest mb-1">Wait! Before you go…</p>
                <h2 className="text-3xl font-black font-display mb-2">
                  Get {exitIntentPromoDiscount || "10%"} OFF
                </h2>
                <p className="text-white/90 text-sm leading-relaxed mb-3">
                  {step === "capture"
                    ? "Enter your phone or email to unlock your exclusive discount."
                    : "Your personal discount code is ready! Use it at checkout."}
                </p>
                {/* Countdown badge */}
                {step === "capture" && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-white/20">
                    <Clock className="w-3.5 h-3.5" />
                    Offer expires in <span className="font-mono ml-1">{countdownDisplay}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {step === "capture" ? (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input
                    type="text"
                    value={contact}
                    onChange={e => { setContact(e.target.value); setError(""); }}
                    placeholder="01712-345678 or you@email.com"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                    autoFocus
                  />
                  {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading || !contact.trim()}
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <>Get My Code <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={handleDismiss} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium">
                    No thanks, I'll pay full price
                  </button>
                </form>
              ) : (
                <>
                  <div
                    onClick={handleCopy}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:shadow-sm"
                    style={{ borderColor: "#E85D04", background: "#FFF8F4" }}
                  >
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-0.5">Your exclusive code (expires in 24h)</p>
                      <p className="text-xl font-black tracking-widest font-mono" style={{ color: "#E85D04" }}>
                        {promoCode}
                      </p>
                    </div>
                    <button
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-bold transition-transform active:scale-95 shrink-0"
                      style={{ background: copied ? "#22c55e" : "#E85D04" }}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  <a
                    href="/shop"
                    onClick={handleDismiss}
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm transition-transform active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
                  >
                    Shop Now &amp; Save {exitIntentPromoDiscount || "10%"} <ArrowRight className="w-4 h-4" />
                  </a>
                  <button onClick={handleDismiss} className="w-full py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors font-medium">
                    Maybe later
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
