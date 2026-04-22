import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Pen, Flame, Zap, Truck, Layers, ShieldCheck, Star, Sparkles,
} from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const DEFAULT_PHRASES: string[] = [
  "T-Shirts.",
  "Hoodies.",
  "Mugs.",
  "Caps.",
  "Custom Gifts.",
  "আপনার ডিজাইন.",
];

const HERO_STATS = [
  { value: "5,000+", label: "Happy Customers" },
  { value: "48hr", label: "Production" },
  { value: "64", label: "Districts" },
  { value: "4.9★", label: "Rated" },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useTypewriter(phrases: string[], opts?: {
  typeSpeed?: number;
  deleteSpeed?: number;
  holdMs?: number;
  enabled?: boolean;
}) {
  const typeSpeed = opts?.typeSpeed ?? 80;
  const deleteSpeed = opts?.deleteSpeed ?? 38;
  const holdMs = opts?.holdMs ?? 1400;
  const enabled = opts?.enabled ?? true;
  const safe = phrases.length > 0 ? phrases : [""];

  const [text, setText] = useState(safe[0]);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("holding");
  const indexRef = useRef(0);

  useEffect(() => {
    if (enabled) return;
    setText(safe[indexRef.current % safe.length]);
    const id = window.setInterval(() => {
      indexRef.current = (indexRef.current + 1) % safe.length;
      setText(safe[indexRef.current]);
    }, 2500);
    return () => window.clearInterval(id);
  }, [enabled, safe]);

  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const current = safe[indexRef.current];

    if (phase === "typing") {
      if (text.length < current.length) {
        timer = window.setTimeout(() => setText(current.slice(0, text.length + 1)), typeSpeed);
      } else {
        timer = window.setTimeout(() => setPhase("holding"), holdMs);
      }
    } else if (phase === "holding") {
      timer = window.setTimeout(() => setPhase("deleting"), holdMs);
    } else {
      if (text.length > 0) {
        timer = window.setTimeout(() => setText(current.slice(0, text.length - 1)), deleteSpeed);
      } else {
        indexRef.current = (indexRef.current + 1) % safe.length;
        setPhase("typing");
      }
    }
    return () => { if (timer) window.clearTimeout(timer); };
  }, [text, phase, safe, typeSpeed, deleteSpeed, holdMs, enabled]);

  return text;
}

const FLOATING_PRODUCTS = [
  {
    src: "/mockups/white-tshirt-front-cutout.png",
    alt: "Premium custom T-shirt",
    style: {
      top: "8%", left: "12%", width: "78%",
      transform: "rotate(-4deg)", zIndex: 3,
    },
    delay: 0,
    floatY: 14,
  },
];

const ROTATING_BADGES = [
  { label: "T-Shirts", color: "#E85D04" },
  { label: "Hoodies", color: "#7C3AED" },
  { label: "Mugs", color: "#0EA5E9" },
  { label: "Caps", color: "#10B981" },
];

export function TypewriterHero() {
  const settings = useSiteSettings();
  const reduced = usePrefersReducedMotion();

  const phrases = useMemo(() => {
    const custom = (settings.heroTypewriterPhrases || "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    return custom.length > 0 ? custom : DEFAULT_PHRASES;
  }, [settings.heroTypewriterPhrases]);
  const typed = useTypewriter(phrases, { enabled: !reduced });

  // Lightweight scroll-driven parallax for the background blob layer.
  const bgRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY, 600) * 0.18;
        if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Phrase-level live region: announce only completed phrase changes.
  const [announcedPhrase, setAnnouncedPhrase] = useState(phrases[0] ?? "");
  useEffect(() => {
    if (reduced) return;
    const current = phrases.find(p => p === typed);
    if (current && current !== announcedPhrase) setAnnouncedPhrase(current);
  }, [typed, phrases, reduced, announcedPhrase]);

  const background = settings.heroImageUrl
    ? `url(${settings.heroImageUrl}) center/cover no-repeat`
    : settings.heroGradient
      ? settings.heroGradient
      : "linear-gradient(145deg, #FFFCF8 0%, #FFF6ED 35%, #FFEEDE 65%, #FFF2E4 100%)";

  const headlineFallback = phrases[0];

  return (
    <section
      className="relative overflow-hidden"
      style={{
        paddingTop: "calc(var(--announcement-height, 0px) + 3rem)",
        paddingBottom: "3.5rem",
        minHeight: "min(92vh, 100svh)",
      }}
      aria-label="Hero"
    >
      {/* Hidden phrase-level live region for assistive tech */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
          overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0,
        }}
      >
        We craft {announcedPhrase}
      </span>

      {/* Background w/ micro-parallax */}
      <div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        style={{ background }}
        aria-hidden="true"
      />

      {/* Soft ambient blobs + dot grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full blur-[80px] opacity-40"
          style={{ background: "radial-gradient(circle, rgba(251,133,0,0.55), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-32 -left-24 w-[420px] h-[420px] rounded-full blur-[80px] opacity-30"
          style={{ background: "radial-gradient(circle, rgba(232,93,4,0.45), transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-primary) 1px, transparent 1px)",
            backgroundSize: "30px 30px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">

        {/* ── LEFT: copy ── */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">

          {/* Eyebrow */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-5 font-bold text-[11px] sm:text-xs tracking-wide"
            style={{
              background: "linear-gradient(135deg, #fff4ee, #ffe8d4)",
              color: "var(--color-primary)",
              border: "1.5px solid #fdd5b4",
            }}
          >
            <Flame className="w-3.5 h-3.5" aria-hidden="true" />
            Bangladesh's #1 Custom Apparel Brand
            <span
              className="px-1.5 py-0.5 rounded-full text-[9px] text-white font-black tracking-wider"
              style={{ background: "var(--color-primary)" }}
            >
              NEW
            </span>
          </motion.div>

          {/* Headline */}
          <h1
            className="font-display font-black leading-[1.02] mb-4 sm:mb-5 text-gray-900"
            style={{
              fontSize: "clamp(2.1rem, 5.6vw, 4.5rem)",
              letterSpacing: "-0.03em",
            }}
          >
            <span style={{ display: "block" }}>You Imagine,</span>
            <span style={{ display: "block" }}>
              <span
                style={{
                  background: "linear-gradient(135deg, var(--color-primary) 0%, #FB8500 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                We Craft
              </span>{" "}
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  minWidth: "0.6em",
                  color: "var(--color-primary)",
                }}
              >
                {reduced ? headlineFallback : typed}
                <span
                  aria-hidden="true"
                  className="inline-block align-baseline ml-1"
                  style={{
                    width: "0.06em",
                    height: "0.85em",
                    background: "currentColor",
                    transform: "translateY(0.06em)",
                    borderRadius: "1px",
                    animation: reduced ? undefined : "twCursorBlink 1s steps(2, start) infinite",
                  }}
                />
              </span>
            </span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-sm sm:text-lg text-gray-600 max-w-xl mb-6 leading-relaxed"
          >
            {settings.heroSubtitle ||
              "Premium 320GSM cotton, vibrant prints, and 48-hour express delivery to all 64 districts of Bangladesh."}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full sm:w-auto mb-6"
          >
            <Link
              href="/design-studio"
              className="group inline-flex items-center justify-center gap-2 px-7 sm:px-9 py-3.5 sm:py-4 rounded-2xl font-bold text-white text-[0.95rem] sm:text-base transition-transform active:scale-95 hover:-translate-y-0.5 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, var(--color-primary), #FB8500)",
                boxShadow: "0 12px 32px rgba(232,93,4,0.38)",
              }}
              data-testid="hero-cta-primary"
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity"
                style={{ background: "linear-gradient(120deg, transparent, white, transparent)" }}
                aria-hidden="true"
              />
              <Pen className="w-4 h-4 sm:w-[1.05rem] sm:h-[1.05rem] relative" />
              <span className="relative">Start Designing</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 relative transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/products?sort=bestsellers"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-gray-800 text-[0.95rem] sm:text-base bg-white/90 backdrop-blur-sm border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600 hover:shadow-lg transition-all"
              data-testid="hero-cta-secondary"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              Shop Best Sellers
            </Link>
          </motion.div>

          {/* Trust chips */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="flex flex-wrap gap-2 sm:gap-2.5 justify-center lg:justify-start mb-7"
          >
            {[
              { icon: Zap, label: "48hr Production" },
              { icon: Truck, label: "64 Districts" },
              { icon: Layers, label: "320GSM Fabric" },
              { icon: ShieldCheck, label: "COD Available" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold bg-white/85 backdrop-blur-sm"
                style={{ border: "1px solid rgba(232,93,4,0.18)", color: "#444" }}
              >
                <Icon className="w-3.5 h-3.5 text-orange-500" aria-hidden="true" />
                {label}
              </span>
            ))}
          </motion.div>

          {/* Animated stats row */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="grid grid-cols-4 gap-3 sm:gap-5 w-full max-w-md lg:max-w-none lg:w-auto"
          >
            {HERO_STATS.map((s, i) => (
              <div
                key={s.label}
                className="flex flex-col items-center lg:items-start lg:px-5 lg:border-l lg:border-orange-200 first:lg:border-l-0 first:lg:pl-0"
              >
                <span
                  className="font-black text-lg sm:text-2xl lg:text-3xl leading-none"
                  style={{ color: "var(--color-primary)" }}
                >
                  {s.value}
                </span>
                <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-gray-500 font-semibold mt-1">
                  {s.label}
                </span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── RIGHT: floating product showcase (hidden on mobile) ── */}
        <div className="hidden lg:block relative aspect-[4/5] w-full max-w-xl ml-auto">
          {/* Decorative ring */}
          <div
            aria-hidden="true"
            className="absolute inset-[8%] rounded-[40%_60%_55%_45%/50%_45%_55%_50%] opacity-50"
            style={{
              background: "linear-gradient(135deg, rgba(251,133,0,0.18), rgba(232,93,4,0.08))",
              filter: "blur(2px)",
            }}
          />
          <motion.div
            aria-hidden="true"
            className="absolute inset-[14%] rounded-full border-2 border-dashed"
            style={{ borderColor: "rgba(232,93,4,0.18)" }}
            animate={reduced ? undefined : { rotate: 360 }}
            transition={reduced ? undefined : { duration: 60, repeat: Infinity, ease: "linear" }}
          />

          {FLOATING_PRODUCTS.map((p, i) => (
            <motion.div
              key={p.src}
              className="absolute"
              style={{
                ...p.style as React.CSSProperties,
                filter: "drop-shadow(0 24px 30px rgba(56,30,8,0.22)) drop-shadow(0 4px 6px rgba(56,30,8,0.12))",
              }}
              initial={reduced ? false : { opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 + p.delay, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Soft halo behind each product to pop white-on-cream */}
              <div
                aria-hidden="true"
                className="absolute inset-[8%] rounded-full"
                style={{
                  background: "radial-gradient(ellipse at center, rgba(232,93,4,0.18), transparent 65%)",
                  filter: "blur(28px)",
                  zIndex: -1,
                }}
              />
              <motion.img
                src={p.src}
                alt={p.alt}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full h-auto select-none pointer-events-none relative"
                draggable={false}
                animate={reduced ? undefined : { y: [0, -p.floatY, 0] }}
                transition={reduced ? undefined : {
                  duration: 5 + i * 0.7,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.4,
                }}
              />
            </motion.div>
          ))}

          {/* Floating rating chip */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="absolute top-4 left-4 bg-white rounded-2xl px-4 py-3 flex items-center gap-3 z-10"
            style={{
              boxShadow: "0 16px 40px rgba(232,93,4,0.18), 0 4px 12px rgba(0,0,0,0.06)",
              border: "1px solid rgba(232,93,4,0.12)",
            }}
          >
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map(i => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <div>
              <div className="font-black text-sm text-gray-900 leading-none">4.9 / 5</div>
              <div className="text-[10px] text-gray-500 mt-0.5">5,000+ reviews</div>
            </div>
          </motion.div>

          {/* Floating delivery chip */}
          <motion.div
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 1.4 }}
            className="absolute bottom-6 right-2 bg-white rounded-2xl px-4 py-3 flex items-center gap-3 z-10"
            style={{
              boxShadow: "0 16px 40px rgba(232,93,4,0.18), 0 4px 12px rgba(0,0,0,0.06)",
              border: "1px solid rgba(232,93,4,0.12)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #fff4ee, #ffe8d4)" }}
            >
              <Truck className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <div className="font-black text-sm text-gray-900 leading-none">48-hour</div>
              <div className="text-[10px] text-gray-500 mt-0.5">Express delivery</div>
            </div>
          </motion.div>
        </div>
      </div>

      <style>{`
        @keyframes twCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
