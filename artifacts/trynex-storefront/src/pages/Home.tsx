import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductCard } from "@/components/ProductCard";
import { SEOHead } from "@/components/SEOHead";
import { InstagramFeed } from "@/components/InstagramFeed";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SpinWheel from "@/components/SpinWheel";
import { useListProducts, useGetTestimonials } from "@workspace/api-client-react";
import { getApiUrl } from "@/lib/utils";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import {
  ArrowRight, Sparkles, Zap, Package, Star, Check, Truck,
  ShieldCheck, Clock, Palette, Layers, Award, ChevronRight,
  Users, BadgeCheck, Flame, Shirt, Coffee, Crown
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import { TypewriterHero } from "@/components/home/TypewriterHero";

const MARQUEE_ITEMS = [
  "PREMIUM QUALITY", "CUSTOM DESIGNS", "FAST DELIVERY", "MADE IN BANGLADESH",
  "YOU IMAGINE WE CRAFT", "LIMITED EDITION", "EXCLUSIVE DROPS", "100% AUTHENTIC",
  "PREMIUM 320GSM FABRIC", "BEST PRICE IN BD"
];

const FEATURES = [
  {
    icon: Palette,
    title: "100% Custom Design",
    desc: "Every piece crafted to your exact vision — from concept sketch to wearable masterpiece, delivered to your door.",
    color: "var(--color-primary)",
    bg: "#fff4ee",
    badge: "Unlimited Creativity"
  },
  {
    icon: Zap,
    title: "48-Hour Express",
    desc: "Lightning-fast production with nationwide delivery across all 64 districts. Speed meets premium quality.",
    color: "#2563eb",
    bg: "#eff6ff",
    badge: "Super Fast"
  },
  {
    icon: Layers,
    title: "Premium Materials",
    desc: "We source only the finest 230-320GSM fabrics. Vibrant colors, sharp prints, lasting comfort — every time.",
    color: "#16a34a",
    bg: "#f0fdf4",
    badge: "Top Grade"
  },
];

const PROCESS = [
  { step: "01", title: "Choose & Design", desc: "Pick your product and share your design — or let our team help create something incredible.", icon: Palette },
  { step: "02", title: "We Craft It", desc: "Our artisans use premium fabrics and state-of-the-art printing to bring your vision to life.", icon: Layers },
  { step: "03", title: "Fast Delivery", desc: "Packed with care, delivered express anywhere in Bangladesh within 3-7 business days.", icon: Truck },
];

const TESTIMONIALS = [
  {
    name: "Rakib Hasan", role: "Fashion Influencer", stars: 5,
    text: "TryNex is literally the best custom apparel brand in BD. The hoodie quality is insane — thick, premium, and the print doesn't fade. 10/10!",
    location: "Dhaka"
  },
  {
    name: "Mithila Chowdhury", role: "Small Business Owner", stars: 5,
    text: "Ordered 50 custom tees for my brand launch. Every single one was perfect. The colors were exactly what I wanted. Will order again!",
    location: "Chittagong"
  },
  {
    name: "Farhan Ahmed", role: "University Student", stars: 5,
    text: "Got a custom hoodie for my crew. Everyone was shocked at how premium it felt. The delivery was super fast too. Highly recommend!",
    location: "Sylhet"
  },
  {
    name: "Nadia Islam", role: "Corporate Manager", stars: 5,
    text: "We use TryNex for all our company merch now. Professional quality, great service, and the best prices in Bangladesh. Absolutely love it!",
    location: "Rajshahi"
  },
];

const STATS = [
  { value: "5000", suffix: "+", label: "Happy Customers", icon: Users, color: "var(--color-primary)" },
  { value: "98", suffix: "%", label: "Satisfaction Rate", icon: Star, color: "#eab308" },
  { value: "48", suffix: "h", label: "Production Time", icon: Zap, color: "#2563eb" },
  { value: "64", suffix: "", label: "Districts Served", icon: Truck, color: "#16a34a" },
];

const CATEGORIES = [
  { name: "T-Shirts", icon: "tshirt", desc: "Premium custom tees", count: "Starting ৳599", color: "#fff4ee", accent: "var(--color-primary)" },
  { name: "Hoodies", icon: "hoodie", desc: "320GSM premium fleece", count: "Starting ৳1,299", color: "#eff6ff", accent: "#2563eb" },
  { name: "Caps", icon: "cap", desc: "Embroidered & printed", count: "Starting ৳499", color: "#f0fdf4", accent: "#16a34a" },
  { name: "Mugs", icon: "mug", desc: "Ceramic & sublimation", count: "Starting ৳399", color: "#fdf4ff", accent: "#9333ea" },
  { name: "Custom", icon: "custom", desc: "Anything you imagine", count: "Get a quote", color: "#fffbeb", accent: "#d97706" },
];


const PAYMENT_METHODS = [
  {
    name: "bKash", shortName: "bKash",
    color: "#e2136e", textColor: "#fff", bg: "#e2136e",
    labelStyle: { fontFamily: "serif", fontStyle: "italic", fontWeight: 900, letterSpacing: "-0.02em" },
  },
  {
    name: "Nagad", shortName: "Nagad",
    color: "#f7941d", textColor: "#fff", bg: "#f7941d",
    labelStyle: { fontWeight: 900, letterSpacing: "0.02em" },
  },
  {
    name: "Rocket", shortName: "Rocket",
    color: "#8b2291", textColor: "#fff", bg: "#8b2291",
    labelStyle: { fontWeight: 900 },
  },
  {
    name: "Cash on Delivery", shortName: "COD",
    color: "#16a34a", textColor: "#fff", bg: "#16a34a",
    labelStyle: { fontWeight: 900, letterSpacing: "0.05em" },
  },
  {
    name: "Visa", shortName: "VISA",
    color: "#1a1f71", textColor: "#fff", bg: "#1a1f71",
    labelStyle: { fontFamily: "serif", fontWeight: 900, letterSpacing: "0.1em" },
  },
];

/**
 * 24/7 rolling flash-sale window. The day is split into four 6-hour
 * blocks (BST): Midnight-6am, 6am-Noon, Noon-6pm, 6pm-Midnight. The
 * countdown always points to the END of the current block, so a visitor
 * at any hour sees a live "grab it before it ends" timer. The label
 * cycles to keep the hero feeling fresh for return visitors.
 *
 * (Previously the timer went dormant 12am–6am BST, so 30%+ of late-night
 *  shoppers saw an inactive 00:00:00 banner — killing urgency.)
 */
function getBSTSaleTarget(): { end: Date; label: string; active: boolean } {
  const now = new Date();
  const bstOffset = 6 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const bstMinutes = (utcMinutes + bstOffset) % 1440;

  const todayUTCMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const bstMidnightUTC = new Date(todayUTCMidnight.getTime() - bstOffset * 60000);

  // 6-hour boundaries in BST minutes-of-day
  const blocks: Array<{ end: number; label: string }> = [
    { end:  6 * 60, label: "Midnight Flash Sale" },   //  0–6am
    { end: 12 * 60, label: "Morning Mega Sale" },     //  6am–12pm
    { end: 18 * 60, label: "Afternoon Hot Deals" },   // 12pm–6pm
    { end: 24 * 60, label: "Evening Grand Sale" },    //  6pm–12am
  ];

  for (const block of blocks) {
    if (bstMinutes < block.end) {
      return {
        end: new Date(bstMidnightUTC.getTime() + block.end * 60000),
        label: block.label,
        active: true,
      };
    }
  }
  // Fallback (shouldn't hit) — point to next midnight
  return {
    end: new Date(bstMidnightUTC.getTime() + 24 * 60 * 60000),
    label: "Flash Sale",
    active: true,
  };
}

function FlipDigit({ value, prevValue }: { value: string; prevValue: string }) {
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (value !== prevValue) {
      setFlipping(true);
      const t = setTimeout(() => setFlipping(false), 500);
      return () => clearTimeout(t);
    }
  }, [value, prevValue]);

  return (
    <div className="relative w-[2.2rem] sm:w-[3rem] h-[2.8rem] sm:h-[3.8rem]" style={{ perspective: '200px' }}>
      <div className="absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #FF8C00 0%, var(--color-primary) 48%, #CC4E03 48.5%, var(--color-primary) 49%, #D45A04 100%)',
          boxShadow: '0 8px 32px rgba(232,93,4,0.6), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)',
        }}>
        <div className="absolute inset-x-0 top-0 h-[48%] rounded-t-xl sm:rounded-t-2xl"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.05) 100%)' }} />
        <div className="absolute inset-x-0 top-[48%] h-[1px]"
          style={{ background: 'rgba(0,0,0,0.2)', boxShadow: '0 1px 0 rgba(255,255,255,0.1)' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-black text-white text-xl sm:text-3xl font-mono tabular-nums drop-shadow-lg transition-transform duration-300 ${flipping ? 'scale-110' : 'scale-100'}`}
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,140,0,0.3)' }}>
            {value}
          </span>
        </div>
      </div>
      <div className="absolute -inset-[2px] rounded-xl sm:rounded-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,200,100,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.2) 100%)',
          borderRadius: 'inherit',
        }} />
    </div>
  );
}

function CountdownTimer() {
  const [sale, setSale] = useState(getBSTSaleTarget);
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });
  const prevRef = useRef({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const current = getBSTSaleTarget();
      if (current.end.getTime() !== sale.end.getTime()) {
        setSale(current);
      }
      setTimeLeft(prev => {
        prevRef.current = prev;
        const diff = Math.max(0, current.end.getTime() - Date.now());
        return {
          h: Math.floor(diff / 3600000),
          m: Math.floor((diff % 3600000) / 60000),
          s: Math.floor((diff % 60000) / 1000),
        };
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sale.end]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const prev = prevRef.current;
  const label = sale.active ? "Ends in" : sale.label;

  return (
    <div className="flex flex-col items-center gap-3 relative">
      <div className="flex items-center gap-2">
        <div className="h-px w-8 sm:w-12" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,93,4,0.4))' }} />
        <p className="text-gray-500 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em]">{label}</p>
        <div className="h-px w-8 sm:w-12" style={{ background: 'linear-gradient(90deg, rgba(232,93,4,0.4), transparent)' }} />
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {[
          { v: timeLeft.h, p: prev.h, l: "HRS" },
          { v: timeLeft.m, p: prev.m, l: "MIN" },
          { v: timeLeft.s, p: prev.s, l: "SEC" },
        ].map(({ v, p, l }, i) => (
          <div key={l} className="flex items-center gap-2 sm:gap-3">
            <div className="text-center">
              <div className="flex gap-[3px] sm:gap-1">
                <FlipDigit value={pad(v)[0]} prevValue={pad(p)[0]} />
                <FlipDigit value={pad(v)[1]} prevValue={pad(p)[1]} />
              </div>
              <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 mt-1.5 tracking-[0.2em] uppercase">{l}</p>
            </div>
            {i < 2 && (
              <div className="flex flex-col gap-1.5 sm:gap-2 mb-5">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse" style={{ background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary-medium)' }} />
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-pulse" style={{ background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary-medium)', animationDelay: '0.3s' }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimatedCounter({ target, suffix = "", duration = 2200 }: { target: string; suffix?: string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting && !started) setStarted(true); }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const numTarget = parseFloat(target);
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(eased * numTarget);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return <span ref={ref}>{display.toLocaleString()}{suffix}</span>;
}


function SplitTextReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return <span className={className}>{text}</span>;
  }

  const words = text.split(" ");
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          <motion.span
            style={{ display: 'inline-block' }}
            initial={{ opacity: 0, y: 24, rotateX: -30 }}
            animate={inView ? { opacity: 1, y: 0, rotateX: 0 } : {}}
            transition={{
              duration: 0.45,
              delay: delay + wi * 0.06,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {wi < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

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


function useMagneticEffect<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMobile) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setPos({
      x: (e.clientX - cx) * 0.35,
      y: (e.clientY - cy) * 0.35,
    });
  }, [isMobile]);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
    setPos({ x: 0, y: 0 });
  }, []);

  const magneticStyle: React.CSSProperties = {
    transform: hovered ? `translate(${pos.x}px, ${pos.y}px)` : 'translate(0,0)',
    transition: hovered ? 'transform 0.15s ease' : 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
  };

  const eventHandlers = {
    onMouseEnter: () => setHovered(true),
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
  };

  return { ref, magneticStyle, eventHandlers };
}

function MagneticButton({ children, className, style, href, onClick }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  onClick?: () => void;
}) {
  const linkMagnet = useMagneticEffect<HTMLAnchorElement>();
  const btnMagnet = useMagneticEffect<HTMLButtonElement>();
  const [, navigate] = useLocation();

  if (href) {
    return (
      <a
        ref={linkMagnet.ref}
        href={href}
        onClick={(e) => { e.preventDefault(); navigate(href); }}
        className={className}
        style={{ ...style, ...linkMagnet.magneticStyle }}
        {...linkMagnet.eventHandlers}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      ref={btnMagnet.ref}
      onClick={onClick}
      className={className}
      style={{ ...style, ...btnMagnet.magneticStyle }}
      {...btnMagnet.eventHandlers}
    >
      {children}
    </button>
  );
}

function HowItWorksConnector({ active }: { active: boolean }) {
  return (
    <svg
      className="hidden md:block absolute top-10 left-1/2 w-full"
      height="2"
      style={{ overflow: 'visible', zIndex: 0 }}
      aria-hidden="true"
    >
      <line
        x1="0" y1="1" x2="100%" y2="1"
        stroke="url(#connectorGrad)"
        strokeWidth="2"
        strokeDasharray="200"
        strokeDashoffset={active ? 0 : 200}
        style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)' }}
      />
      <defs>
        <linearGradient id="connectorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fb8500" />
          <stop offset="100%" stopColor="#fbd580" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type PublicStats = {
  todayOrders: number;
  totalOrders: number;
  minutesSinceLastOrder: number | null;
} | null;

function usePublicStats(): PublicStats {
  const [stats, setStats] = useState<PublicStats>(null);

  useEffect(() => {
    const fetchStats = () =>
      fetch(getApiUrl("/api/public-stats"))
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setStats(data); })
        .catch(() => {});

    fetchStats();
    const id = setInterval(fetchStats, 60000);
    return () => clearInterval(id);
  }, []);

  return stats;
}

function LiveSocialProof({ stats, primaryColor = 'var(--color-primary)' }: { stats: PublicStats; primaryColor?: string }) {
  if (!stats) return null;

  const lastOrderLabel = stats.minutesSinceLastOrder === null
    ? null
    : stats.minutesSinceLastOrder < 2
    ? "Last order just now"
    : stats.minutesSinceLastOrder < 60
    ? `Last order ${stats.minutesSinceLastOrder}m ago`
    : stats.minutesSinceLastOrder < 1440
    ? `Last order ${Math.floor(stats.minutesSinceLastOrder / 60)}h ago`
    : "Last order today";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-3"
    >
      {stats.todayOrders > 0 && (
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: '#fff4ee', color: primaryColor, border: '1.5px solid #fdd5b4' }}>
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: primaryColor }}
          />
          {stats.todayOrders.toLocaleString()} orders placed today
        </span>
      )}
      {stats.todayOrders === 0 && stats.totalOrders > 0 && (
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: '#fff4ee', color: primaryColor, border: '1.5px solid #fdd5b4' }}>
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: primaryColor }}
          />
          {stats.totalOrders.toLocaleString()}+ happy customers
        </span>
      )}
      {lastOrderLabel && (
        <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' }}>
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: '#16a34a' }}
          />
          {lastOrderLabel}
        </span>
      )}
    </motion.div>
  );
}

export default function Home() {
  const { data: productsData, isLoading } = useListProducts({ limit: 8, featured: true });
  const { data: testimonialsData } = useGetTestimonials();
  const publicStats = usePublicStats();
  const featuredProducts = productsData?.products || [];
  const dynamicTestimonials = testimonialsData?.testimonials || [];
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const howItWorksInView = useInView(howItWorksRef, { once: true, margin: "-80px" });
  const settings = useSiteSettings();

  const testimonials = dynamicTestimonials.length > 0
    ? dynamicTestimonials.map(t => ({ name: t.name, role: t.role || "", stars: t.stars ?? 5, text: t.body, location: t.location || "" }))
    : TESTIMONIALS;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="TryNex Lifestyle | Premium Custom Apparel Bangladesh | কাস্টম গিফট বাংলাদেশ"
        description="TryNex Lifestyle — Bangladesh's #1 premium custom apparel brand. কাস্টম গিফট বাংলাদেশ — custom T-shirts, Hoodies, Mugs, Caps. Fast delivery to Dhaka & across all 64 districts. You imagine, we craft."
        canonical="/"
        keywords="custom t-shirt bangladesh, কাস্টম গিফট বাংলাদেশ, customized gift Bangladesh, gift hamper Dhaka, custom hoodie bd, premium apparel bangladesh, trynex lifestyle, custom printing dhaka"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "OnlineStore",
            "name": settings.siteName || "TryNex Lifestyle",
            "url": "https://trynexshop.com",
            "description": settings.heroSubtitle || "Bangladesh's #1 premium custom apparel brand. Custom T-shirts, Hoodies, Mugs & Caps.",
            "areaServed": { "@type": "Country", "name": "Bangladesh" },
            "currenciesAccepted": "BDT",
            "paymentAccepted": "Cash on Delivery, bKash, Nagad, Rocket",
            "priceRange": "৳399 - ৳3,999",
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": settings.siteName || "TryNex Lifestyle",
            "url": "https://trynexshop.com",
            "potentialAction": {
              "@type": "SearchAction",
              "target": "https://trynexshop.com/products?search={search_term_string}",
              "query-input": "required name=search_term_string",
            },
          },
        ]}
      />
      <Navbar />
      <SpinWheel autoOpen />

      <TypewriterHero />

      {/* ═══════════════════════════════════════
          MARQUEE TICKER
      ═══════════════════════════════════════ */}
      <section className="py-4 overflow-hidden border-y border-orange-100"
        style={{ background: 'linear-gradient(135deg, #FFF4EA, #FFF8F2)' }}>
        <div className="animate-marquee">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="flex items-center gap-4 px-6 text-sm font-black tracking-widest"
              style={{ color: 'var(--color-primary)' }}>
              {item}
              <Star className="w-3 h-3 fill-orange-400 text-orange-400" />
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════
          PAYMENT TRUST RIBBON
      ═══════════════════════════════════════ */}
      <section className="py-6 px-4 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-3"
          >
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 text-center">
              Accepted Payments
            </p>
            <div className="w-full overflow-x-auto no-scrollbar">
              <div className="flex items-center justify-center gap-2 sm:gap-3 min-w-max mx-auto px-2">
                {PAYMENT_METHODS.map((pm, i) => (
                  <motion.div
                    key={pm.name}
                    initial={{ opacity: 0, scale: 0.85 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    whileHover={{ y: -2, scale: 1.05 }}
                    className="cursor-default shrink-0"
                    title={pm.name}
                  >
                    <div
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs text-white flex items-center shadow-sm"
                      style={{
                        background: pm.bg,
                        boxShadow: `0 2px 8px ${pm.color}30`,
                      }}
                    >
                      <span style={{ ...pm.labelStyle, color: pm.textColor, fontSize: '11px' }}>
                        {pm.shortName}
                      </span>
                    </div>
                  </motion.div>
                ))}
                <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shrink-0"
                  style={{ background: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                  <ShieldCheck className="w-3.5 h-3.5" /> 100% Secure
                </span>
              </div>
            </div>
            <LiveSocialProof stats={publicStats} primaryColor="var(--color-primary)" />
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FLASH SALE BANNER
      ═══════════════════════════════════════ */}
      {settings.sectionFlashSaleEnabled !== false && <section className="py-8 sm:py-12 px-4" style={{ background: 'white' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-3xl p-6 sm:p-10 flex flex-col items-center text-center gap-6"
            style={{
              background: 'linear-gradient(160deg, #1a1512 0%, #231c17 40%, #1C1917 100%)',
              border: '1px solid rgba(232,93,4,0.15)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 80px rgba(232,93,4,0.08)',
            }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full blur-[100px] opacity-15"
              style={{ background: 'radial-gradient(ellipse, var(--color-primary), transparent)' }} />
            <div className="absolute bottom-0 right-0 w-[300px] h-[200px] rounded-full blur-[80px] opacity-10"
              style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)' }} />
            <div className="absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
                style={{ background: 'rgba(232,93,4,0.12)', border: '1px solid rgba(232,93,4,0.25)' }}>
                <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                <span className="text-orange-400 font-black text-xs uppercase tracking-[0.2em]">Flash Sale</span>
                <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-display text-white mb-2 leading-tight">
                {(() => {
                  const title = settings.promoBannerTitle || "Up to";
                  const discount = settings.promoBannerDiscount || "30% OFF";
                  if (title.toLowerCase().includes(discount.toLowerCase())) {
                    return <>{title.replace(new RegExp(discount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')} <span className="relative" style={{ color: 'var(--color-primary)' }}>{discount}<div className="absolute -inset-1 blur-lg opacity-30" style={{ background: 'var(--color-primary)' }} /></span></>;
                  }
                  return <>{title} <span className="relative" style={{ color: 'var(--color-primary)' }}>{discount}<div className="absolute -inset-1 blur-lg opacity-30" style={{ background: 'var(--color-primary)' }} /></span></>;
                })()}
              </h2>
              <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
                {settings.promoBannerSubtitle || "On selected T-shirts & Hoodies. Limited stock — don't miss out!"}
              </p>
            </div>

            <CountdownTimer />

            <Link
              href="/products"
              className="relative group px-8 sm:px-10 py-3.5 sm:py-4 rounded-2xl font-black text-gray-900 text-sm sm:text-base flex items-center gap-2 transition-all duration-300 hover:-translate-y-1 hover:scale-105 shimmer-btn"
              style={{
                background: 'linear-gradient(135deg, #FFB347 0%, var(--color-primary) 40%, var(--color-primary) 100%)',
                boxShadow: '0 8px 32px var(--color-primary-medium), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <Flame className="w-4 h-4 transition-transform group-hover:rotate-12" /> {settings.promoBannerCTA || "Shop the Sale"}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </section>}

      {/* ═══════════════════════════════════════
          CATEGORIES GRID
      ═══════════════════════════════════════ */}
      {settings.sectionCategoriesEnabled !== false && <section className="py-20 px-4" style={{ background: '#FAFAFA' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="section-eyebrow mb-4"
            >
              <Package className="w-3 h-3" /> Our Collections
            </motion.span>
            <h2 className="section-heading mt-4">
              <SplitTextReveal text="Shop by Category" delay={0.05} />
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-500 mt-4 max-w-xl mx-auto"
            >
              From premium tees to cozy hoodies — every product made with care, ready for your custom design.
            </motion.p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORIES.filter(cat => {
              if (cat.icon === "tshirt" && settings.categoryTshirtsEnabled === false) return false;
              if (cat.icon === "hoodie" && settings.categoryHoodiesEnabled === false) return false;
              if (cat.icon === "cap" && settings.categoryCapsEnabled === false) return false;
              if (cat.icon === "mug" && settings.categoryMugsEnabled === false) return false;
              if (cat.icon === "custom" && settings.categoryCustomEnabled === false) return false;
              return true;
            }).map((cat, i) => {
              const CategoryIcon = cat.icon === "tshirt" ? Shirt
                : cat.icon === "hoodie" ? Layers
                : cat.icon === "cap" ? Crown
                : cat.icon === "mug" ? Coffee
                : Sparkles;
              return (
                <motion.div
                  key={cat.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -8, scale: 1.03 }}
                  style={{ transformOrigin: 'center bottom' }}
                >
                  <Link href="/products"
                    className="flex flex-col items-center p-6 rounded-2xl text-center transition-all cursor-pointer group border relative overflow-hidden"
                    style={{
                      background: cat.color,
                      borderColor: `${cat.accent}20`,
                      boxShadow: `0 4px 20px ${cat.accent}10`,
                    }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{ background: `linear-gradient(135deg, ${cat.accent}06, transparent)` }} />
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3"
                      style={{ background: `${cat.accent}12`, border: `1.5px solid ${cat.accent}25` }}>
                      <CategoryIcon className="w-6 h-6" style={{ color: cat.accent }} />
                    </div>
                    <h3 className="font-black text-gray-900 text-base mb-1">{cat.name}</h3>
                    <p className="text-xs text-gray-500 mb-3">{cat.desc}</p>
                    <span className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: `${cat.accent}15`, color: cat.accent }}>
                      {cat.count}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>}

      {/* ═══════════════════════════════════════
          FEATURED PRODUCTS
      ═══════════════════════════════════════ */}
      {settings.sectionFeaturedEnabled !== false && <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
            <div>
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="section-eyebrow mb-4"
              >
                <Sparkles className="w-3 h-3" /> Featured Products
              </motion.span>
              <h2 className="section-heading mt-4">
                <SplitTextReveal text="Best Sellers" delay={0.04} />
              </h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.25 }}
                className="text-gray-500 mt-3 max-w-lg"
              >
                Our most-loved products — hand-picked for quality and style.
              </motion.p>
            </div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <Link href="/products"
                className="flex items-center gap-2 font-bold text-orange-600 hover:text-orange-700 transition-colors shrink-0 group">
                View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </motion.div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5" aria-label="Loading products" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <ErrorBoundary section="featured products">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                {featuredProducts.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
            </ErrorBoundary>
          )}
        </div>
      </section>}

      {/* ═══════════════════════════════════════
          FEATURES / WHY CHOOSE US
      ═══════════════════════════════════════ */}
      <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, #FFF8F3 0%, #FFF4EC 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="section-eyebrow mb-4"
            >
              <Award className="w-3 h-3" /> Why TryNex?
            </motion.span>
            <h2 className="section-heading mt-4">
              <SplitTextReveal text="Built for Bangladesh" delay={0.04} />
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.25 }}
              className="text-gray-500 mt-4 max-w-xl mx-auto"
            >
              We combine premium quality, lightning-fast production, and Bangladesh-first service — all in one brand.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.6 }}
                  whileHover={{ y: -8, boxShadow: `0 20px 60px ${f.color}18` }}
                  className="p-8 rounded-3xl text-center border relative overflow-hidden group"
                  style={{
                    background: 'white',
                    borderColor: `${f.color}20`,
                    boxShadow: `0 4px 24px ${f.color}08`,
                    transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
                  }}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `linear-gradient(135deg, ${f.color}05, transparent 60%)` }} />
                  <motion.div
                    whileHover={{ rotate: 8, scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                    style={{ background: f.bg, border: `1.5px solid ${f.color}25` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: f.color }} />
                  </motion.div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black mb-4"
                    style={{ background: f.bg, color: f.color }}>
                    {f.badge}
                  </span>
                  <h3 className="text-xl font-black text-gray-900 mb-3">{f.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HOW IT WORKS — Animated SVG connector
      ═══════════════════════════════════════ */}
      <section className="py-20 px-4 bg-white" ref={howItWorksRef}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="section-eyebrow mb-4"
            >
              <Clock className="w-3 h-3" /> How It Works
            </motion.span>
            <h2 className="section-heading mt-4">
              <SplitTextReveal text="Simple as 1-2-3" delay={0.04} />
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PROCESS.map((p, i) => {
              const StepIcon = p.icon;
              return (
                <motion.div
                  key={p.step}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="text-center relative"
                >
                  {i < PROCESS.length - 1 && (
                    <HowItWorksConnector active={howItWorksInView} />
                  )}
                  <motion.div
                    whileHover={{ rotate: 6, scale: 1.08 }}
                    transition={{ duration: 0.3 }}
                    className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
                    style={{ background: 'linear-gradient(135deg, #fff4ee, #ffe8d4)', border: '2px solid #fdd5b4' }}
                  >
                    <StepIcon className="w-8 h-8 text-orange-500" />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
                      className="absolute inset-0 rounded-2xl"
                      style={{ border: '2px solid var(--color-primary)' }}
                    />
                  </motion.div>
                  <div className="text-xs font-black text-orange-400 tracking-widest mb-2">STEP {p.step}</div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          DESIGN STUDIO CTA BANNER
      ═══════════════════════════════════════ */}
      <section className="py-14 px-4 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1C1917 0%, #2d2116 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(ellipse 60% 80% at 15% 50%, rgba(232,93,4,0.12) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 85% 50%, rgba(251,133,0,0.08) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-12 relative">
          <div className="flex-1 text-center md:text-left">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase mb-5"
              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-medium)' }}
            >
              🎨 New Feature
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="font-display font-black text-3xl md:text-4xl text-white mb-4 leading-tight"
            >
              Design Your Own<br />
              <span style={{ color: 'var(--color-primary)' }}>T-Shirt or Mug</span> — Live
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-300 text-base mb-8 max-w-md mx-auto md:mx-0"
            >
              Upload your artwork, position it on the product, adjust size and rotation — then add to cart. No calls needed.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-3 justify-center md:justify-start"
            >
              <a
                href="/design-studio"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary))', boxShadow: '0 8px 24px var(--color-primary-medium)' }}
              >
                🎨 Open Design Studio
              </a>
              <a
                href="/products"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm"
                style={{ background: 'rgba(255,255,255,0.08)', color: '#e5e7eb', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                Browse Ready Products
              </a>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="shrink-0 flex gap-4 items-center"
          >
            {[
              { label: "Upload Art", icon: "📤", desc: "Any JPG/PNG" },
              { label: "Position", icon: "🎯", desc: "Drag & resize" },
              { label: "Order", icon: "✅", desc: "Add to cart" },
            ].map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="text-center px-4 py-4 rounded-2xl w-24"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="text-2xl mb-2">{step.icon}</div>
                <div className="text-xs font-black text-white mb-0.5">{step.label}</div>
                <div className="text-[10px] text-gray-400">{step.desc}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS — Enhanced animated counters
      ═══════════════════════════════════════ */}
      {settings.sectionStatsEnabled !== false && <section className="py-16 px-4 relative overflow-hidden" style={{ background: '#1C1917' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-1"
            style={{ background: 'linear-gradient(90deg, transparent, var(--color-primary), transparent)' }} />
          <motion.div
            animate={{ opacity: [0.04, 0.08, 0.04] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute inset-0"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)', backgroundSize: '40px 40px' }}
          />
        </div>
        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => {
              const StatIcon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 24, scale: 0.9 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ scale: 1.05 }}
                  className="text-center relative"
                >
                  <div className="relative w-12 h-12 mx-auto mb-3">
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
                      className="absolute inset-0 rounded-xl will-change-transform"
                      style={{ background: stat.color }}
                    />
                    <div
                      className="relative w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: `${stat.color}18`, border: `1px solid ${stat.color}30` }}
                    >
                      <StatIcon className="w-5 h-5" style={{ color: stat.color }} />
                    </div>
                  </div>
                  <div className="text-4xl md:text-5xl font-black font-display mb-1 tabular-nums"
                    style={{ color: stat.color }}>
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="text-gray-500 text-sm font-semibold">{stat.label}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>}

      {/* ═══════════════════════════════════════
          TESTIMONIALS
      ═══════════════════════════════════════ */}
      {settings.sectionTestimonialsEnabled !== false && <section className="py-20 px-4" style={{ background: 'linear-gradient(180deg, #FAFAFA 0%, #FFF4EC 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="section-eyebrow mb-4"
            >
              <Star className="w-3 h-3" /> Testimonials
            </motion.span>
            <h2 className="section-heading mt-4">
              <SplitTextReveal text="Loved Across Bangladesh" delay={0.025} />
            </h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-gray-500 mt-4"
            >
              Real reviews from real customers — from Dhaka to Chittagong.
            </motion.p>
          </div>

          {/* Summary row */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap items-center justify-center gap-6 mb-10"
          >
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(s => <Star key={s} className="w-5 h-5 fill-amber-400 text-amber-400" />)}
              <span className="font-black text-gray-900 ml-1">4.9</span>
              <span className="text-gray-400 text-sm">/5</span>
            </div>
            <div className="w-px h-5 bg-gray-200" />
            <span className="text-gray-500 text-sm font-semibold">Based on 5,000+ reviews</span>
            <div className="w-px h-5 bg-gray-200" />
            <div className="flex -space-x-2">
              {['#E85D04','#2563eb','#16a34a','#9333ea'].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-black"
                  style={{ background: `linear-gradient(135deg, ${c}, ${c}dd)` }}>
                  {['R','M','F','N'][i]}
                </div>
              ))}
            </div>
            <span className="text-xs text-gray-500 font-semibold">+5,000 happy customers</span>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(() => {
              const AVATAR_GRADIENTS = [
                'linear-gradient(135deg, #E85D04, #FB8500)',
                'linear-gradient(135deg, #2563eb, #3b82f6)',
                'linear-gradient(135deg, #16a34a, #22c55e)',
                'linear-gradient(135deg, #9333ea, #a855f7)',
              ];
              return testimonials.map((t, i) => (
                <motion.div
                  key={t.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -6 }}
                  className="p-6 rounded-2xl bg-white border border-gray-100 relative overflow-hidden group cursor-default"
                  style={{
                    boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
                    transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
                  }}
                >
                  {/* Top gradient accent on hover */}
                  <div className="absolute top-0 left-0 w-full h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }} />

                  {/* Quote mark */}
                  <div className="absolute top-4 right-5 text-5xl font-black text-gray-100 leading-none select-none" aria-hidden="true">"</div>

                  <div className="flex mb-3">
                    {Array.from({ length: t.stars }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-5 relative">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm shrink-0"
                      style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length] }}>
                      {t.name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                        {t.name}
                        <BadgeCheck className="w-3.5 h-3.5 text-blue-500" />
                      </p>
                      <p className="text-xs text-gray-400">{t.role}{t.location ? ` · ${t.location}` : ''}</p>
                    </div>
                  </div>
                </motion.div>
              ));
            })()}
          </div>
        </div>
      </section>}

      {/* ═══════════════════════════════════════
          TRUST BADGES
      ═══════════════════════════════════════ */}
      <section className="py-12 px-4 bg-white border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { iconKey: settings.trustBadge1Icon || "shield", title: settings.trustBadge1Title || "100% Secure Payments", desc: settings.trustBadge1Desc || "bKash, Nagad, Rocket & COD", color: "#16a34a", bg: "#f0fdf4" },
              { iconKey: settings.trustBadge2Icon || "truck", title: settings.trustBadge2Title || "Nationwide Delivery", desc: settings.trustBadge2Desc || "All 64 districts of Bangladesh", color: "#2563eb", bg: "#eff6ff" },
              { iconKey: settings.trustBadge3Icon || "award", title: settings.trustBadge3Title || "Quality Guarantee", desc: settings.trustBadge3Desc || "230-320GSM premium fabric", color: 'var(--color-primary)', bg: "#fff4ee" },
              { iconKey: settings.trustBadge4Icon || "users", title: settings.trustBadge4Title || "5,000+ Happy Customers", desc: settings.trustBadge4Desc || "98% satisfaction rate", color: "#9333ea", bg: "#fdf4ff" },
            ].map(({ iconKey, title, desc, color, bg }, i) => {
              const iconMap: Record<string, React.ElementType> = {
                shield: ShieldCheck, truck: Truck, award: Award,
                users: Users, star: Star, check: Check, package: Package,
              };
              const Icon = iconMap[iconKey] ?? ShieldCheck;
              return (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="flex items-center gap-3 p-4 rounded-2xl"
                style={{ background: bg }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${color}15` }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-tight">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </motion.div>
            );
            })}
          </div>
        </div>
      </section>

      {/* Recently Viewed + Instagram */}
      <RecentlyViewed />
      <InstagramFeed />

      {/* ═══════════════════════════════════════
          CTA SECTION — Glowing animated border
      ═══════════════════════════════════════ */}
      <section className="py-24 px-4 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)' }}>
        {/* Animated glow rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.12, 0.24, 0.12] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, var(--color-primary), transparent)', filter: 'blur(60px)' }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto text-center relative z-10"
        >
          <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold mb-8"
            style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary-medium)' }}>
            <Palette className="w-4 h-4" /> Custom Order
          </span>
          <h2 className="font-display font-black text-white leading-tight mb-6"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', letterSpacing: '-0.03em' }}>
            Have a design in mind?<br />
            <span style={{ color: 'var(--color-primary)' }}>Let's make it real.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-lg mx-auto mb-12 leading-relaxed">
            Share your idea — we handle design, print and delivery. 100% unique, 100% yours.
            Starting from just <strong className="text-white">৳750</strong>.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <MagneticButton
              href="/design-studio"
              className="inline-flex items-center justify-center gap-2.5 px-10 py-5 rounded-2xl font-bold text-white text-lg shimmer-btn"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #FB8500)',
                boxShadow: '0 8px 32px var(--color-primary-medium)',
              }}
            >
              Start Designing <ArrowRight className="w-5 h-5" />
            </MagneticButton>
            <Link
              href="/track"
              className="inline-flex items-center justify-center gap-2.5 px-10 py-5 rounded-2xl font-bold text-white text-lg transition-all hover:bg-white/10"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)' }}
            >
              Track Your Order
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-12 text-sm font-semibold text-gray-500">
            {["Free shipping above ৳1,500", "48-hour production", "100% satisfaction guarantee"].map(t => (
              <span key={t} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-orange-500" /> {t}
              </span>
            ))}
          </div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
