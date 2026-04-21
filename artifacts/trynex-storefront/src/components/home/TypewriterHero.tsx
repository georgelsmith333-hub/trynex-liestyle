import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight, Pen, Flame, Zap, Truck, Layers, ShieldCheck, Star,
} from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

const DEFAULT_PHRASES: string[] = [
  "ডিজাইন আপনার",
  "We craft it.",
  "Premium 320GSM cotton.",
  "Delivered in 48 hours.",
  "প্রিমিয়াম কোয়ালিটি",
  "Made in Bangladesh.",
  "শতভাগ কাস্টম",
];

const TRUST_ITEMS = [
  { label: "bKash" },
  { label: "Nagad" },
  { label: "COD" },
  { label: "48-hour express" },
  { label: "5,000+ happy customers" },
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

/**
 * Typewriter that types one phrase, holds, then deletes and types the next.
 * Honors prefers-reduced-motion (renders static fallback word).
 */
function useTypewriter(phrases: string[], opts?: {
  typeSpeed?: number;
  deleteSpeed?: number;
  holdMs?: number;
  enabled?: boolean;
}) {
  const typeSpeed = opts?.typeSpeed ?? 85;
  const deleteSpeed = opts?.deleteSpeed ?? 40;
  const holdMs = opts?.holdMs ?? 1500;
  const enabled = opts?.enabled ?? true;
  const safe = phrases.length > 0 ? phrases : [""];

  const [text, setText] = useState(safe[0]);
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("holding");
  const indexRef = useRef(0);

  // When typing is disabled (reduced motion), rotate full phrases without
  // per-character animation so the hero still feels alive.
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

export function TypewriterHero() {
  const settings = useSiteSettings();
  const reduced = usePrefersReducedMotion();

  const phrases = useMemo(() => {
    const custom = (settings.heroTypewriterPhrases || "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    return custom.length > 0 ? custom : DEFAULT_PHRASES.filter(Boolean);
  }, [settings.heroTypewriterPhrases]);
  const typed = useTypewriter(phrases, { enabled: !reduced });

  // Lightweight micro-parallax: translate the background layer slightly on
  // scroll. Disabled under reduced-motion. Uses rAF + transform only (no
  // layout work) to stay smooth on low-end devices.
  const bgRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY, 600) * 0.15;
        if (bgRef.current) bgRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [reduced]);

  // Track hero visibility so the truly-sticky trust strip can pin to the
  // viewport bottom while the hero is in view, then disappear once the user
  // scrolls past it.
  const sectionRef = useRef<HTMLElement | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setHeroVisible(entry.isIntersecting && entry.intersectionRatio > 0.05),
      { threshold: [0, 0.05, 0.25, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Phrase-level live region: announce only completed phrase changes,
  // not per-keystroke updates (avoids screen-reader spam).
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
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{
        paddingTop: "calc(var(--announcement-height, 0px) + 4.25rem)",
        paddingBottom: "4.5rem",
        minHeight: "min(88vh, 100svh)",
      }}
      aria-label="Hero"
    >
      {/* Visually hidden, phrase-level live region for assistive tech */}
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
      {/* Background (with micro-parallax) */}
      <div
        ref={bgRef}
        className="absolute inset-0 will-change-transform"
        style={{ background }}
        aria-hidden="true"
      />

      {/* Soft ambient blobs (decorative; reduced-motion safe) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-24 -right-20 w-[320px] h-[320px] rounded-full blur-[60px] opacity-30"
          style={{ background: "radial-gradient(circle, rgba(251,133,0,0.55), transparent)" }}
        />
        <div
          className="absolute -bottom-24 -left-16 w-[280px] h-[280px] rounded-full blur-[60px] opacity-25"
          style={{ background: "radial-gradient(circle, rgba(232,93,4,0.45), transparent)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-primary) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">

        {/* Eyebrow */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-5 sm:mb-7 font-bold text-[11px] sm:text-xs tracking-wide"
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
          className="font-display font-black leading-[1.05] mb-4 sm:mb-5 text-gray-900"
          style={{
            fontSize: "clamp(2.1rem, 7vw, 5rem)",
            letterSpacing: "-0.03em",
            fontFeatureSettings: '"tnum" 1, "kern" 1',
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ display: "block" }}>You Imagine,</span>
          <span
            style={{
              display: "block",
              background: "linear-gradient(135deg, var(--color-primary) 0%, #FB8500 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              minHeight: "1.1em",
            }}
          >
            We Craft{" "}
            <span style={{ display: "inline-block", whiteSpace: "nowrap" }} aria-hidden="true">
              <span>{reduced ? headlineFallback : typed}</span>
              <span
                aria-hidden="true"
                className="inline-block align-baseline ml-1"
                style={{
                  width: "0.08em",
                  height: "0.95em",
                  background: "currentColor",
                  transform: "translateY(0.08em)",
                  animation: reduced ? undefined : "twCursorBlink 1s steps(2, start) infinite",
                }}
              />
            </span>
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="text-sm sm:text-lg text-gray-600 max-w-2xl mb-5 sm:mb-7 leading-relaxed"
        >
          {settings.heroSubtitle ||
            "Premium 320GSM fabric, sharp prints, and 48-hour express delivery to all 64 districts of Bangladesh."}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-center mb-5 sm:mb-7 w-full sm:w-auto"
        >
          <Link
            href="/design-studio"
            className="inline-flex items-center justify-center gap-2 px-7 sm:px-9 py-3.5 sm:py-4 rounded-2xl font-bold text-white text-[0.95rem] sm:text-base transition-transform active:scale-95 hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg, var(--color-primary), #FB8500)",
              boxShadow: "0 10px 28px rgba(232,93,4,0.35)",
            }}
            data-testid="hero-cta-primary"
          >
            <Pen className="w-4 h-4 sm:w-[1.05rem] sm:h-[1.05rem]" />
            Start Designing
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </Link>
          <Link
            href="/products?sort=bestsellers"
            className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold text-gray-800 text-[0.95rem] sm:text-base bg-white border-2 border-gray-200 hover:border-orange-300 hover:text-orange-600 transition-colors"
            data-testid="hero-cta-secondary"
          >
            Shop Best Sellers
          </Link>
        </motion.div>

        {/* Mini feature chips */}
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="hidden sm:flex flex-wrap gap-2 sm:gap-2.5 justify-center mb-6"
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

      </div>

      {/* Truly-sticky trust strip — pinned to the viewport bottom while the
          hero is in view, then fades out as the user scrolls past. */}
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: heroVisible ? 1 : 0, y: 0 }}
        transition={{ duration: 0.35, delay: 0.45 }}
        className="fixed left-0 right-0 bottom-0 z-30 backdrop-blur-md"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 35%, rgba(255,255,255,0.97) 100%)",
          borderTop: "1px solid rgba(232,93,4,0.12)",
          pointerEvents: heroVisible ? "auto" : "none",
        }}
        role="region"
        aria-label="Trust signals"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-[11px] sm:text-xs font-semibold text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="text-gray-800 font-bold">4.9/5</span>
          </span>
          {TRUST_ITEMS.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-3">
              <span aria-hidden="true" className="text-gray-300">•</span>
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </motion.div>

      <style>{`
        @keyframes twCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </section>
  );
}
