import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Sparkles, X, Copy, Check } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

type Prize = {
  id: string;
  label: string;
  short: string;
  emoji?: string;
  code?: string;
  weight: number;
  color: string;
  textColor?: string;
  message?: string;
};

const PRIZES: Prize[] = [
  { id: "miss1",     label: "Better luck next time", short: "TRY\nAGAIN",      emoji: "🌟", weight: 28, color: "#1e293b", textColor: "#ffffff" },
  { id: "off5",      label: "5% off your next order", short: "5%\nOFF",        emoji: "🎉", code: "SPIN5",     weight: 16, color: "#ea580c", textColor: "#ffffff" },
  { id: "miss2",     label: "Better luck next time", short: "TRY\nAGAIN",      emoji: "🌟", weight: 28, color: "#0f172a", textColor: "#ffffff" },
  { id: "off10",     label: "10% off your next order", short: "10%\nOFF",      emoji: "🔥", code: "SPIN10",    weight: 12, color: "#f97316", textColor: "#ffffff" },
  { id: "freedeliv", label: "Free delivery on ৳1500+", short: "FREE\nDELIV",  emoji: "🚚", code: "FREEDELIV", weight:  6, color: "#16a34a", textColor: "#ffffff" },
  { id: "off15",     label: "15% off your next order", short: "15%\nOFF",      emoji: "💎", code: "SPIN15",    weight:  6, color: "#dc2626", textColor: "#ffffff" },
  { id: "super",     label: "SUPER DEAL: Free delivery + 10% off", short: "SUPER\nDEAL", emoji: "🏆", code: "SUPERDEAL", weight: 4, color: "#7c3aed", textColor: "#ffffff", message: "Jackpot! 🎊" },
];

const SLICES = PRIZES.length;
const SLICE_DEG = 360 / SLICES;

function pickWeighted(): number {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PRIZES.length; i++) {
    r -= PRIZES[i].weight;
    if (r <= 0) return i;
  }
  return 0;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const STORAGE_LAST_SPIN = "spin_last_date";
const STORAGE_SHOWN     = "spin_modal_shown_v2";
const STORAGE_REWARD    = "spin_reward";

interface Particle {
  id: number;
  x: number;
  y: number;
  vy: number;
  vx: number;
  color: string;
  size: number;
  rotation: number;
  rotSpeed: number;
  shape: "rect" | "circle";
}

const CONFETTI_COLORS = ["#E85D04", "#FB8500", "#fbbf24", "#34d399", "#60a5fa", "#f472b6", "#a78bfa"];

function Confetti({ active }: { active: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animRef = useRef<number | null>(null);
  const stateRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      stateRef.current = [];
      return;
    }

    const initial: Particle[] = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: 35 + Math.random() * 30,
      y: 50,
      vy: -(6 + Math.random() * 8),
      vx: (Math.random() - 0.5) * 8,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.4 ? "rect" : "circle",
    }));

    stateRef.current = initial;
    setParticles([...stateRef.current]);

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;
      stateRef.current = stateRef.current
        .map((p): Particle => ({
          ...p,
          x: p.x + p.vx * dt * 0.4,
          y: p.y + p.vy * dt * 0.4,
          vy: p.vy + 0.25 * dt,
          rotation: p.rotation + p.rotSpeed * dt,
        }))
        .filter(p => p.y < 130);
      setParticles([...stateRef.current]);
      if (stateRef.current.length > 0) {
        animRef.current = requestAnimationFrame(tick);
      }
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  if (!active || particles.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
      aria-hidden="true"
    >
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.shape === "rect" ? p.size * 0.5 : p.size,
            borderRadius: p.shape === "circle" ? "50%" : 2,
            background: p.color,
            transform: `rotate(${p.rotation}deg)`,
            opacity: Math.max(0, 1 - (p.y - 50) / 80),
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  autoOpen?: boolean;
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function SpinWheel({ autoOpen = true, forceOpen = false, onClose }: Props) {
  const settings = useSiteSettings();
  const enabled = settings.spinWheelEnabled !== false;
  const delaySeconds = Math.max(1, settings.spinWheelDelay ?? 4);
  const title = settings.spinWheelTitle || "Spin & Win an Offer!";
  const subtitle = settings.spinWheelSubtitle || "One free spin — no purchase needed.";

  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const spunTodayRef = useRef(false);

  const RESET_HOURS = 24;
  useEffect(() => {
    if (!enabled) return;
    if (forceOpen) { setOpen(true); return; }
    if (!autoOpen) return;
    try {
      const stored = localStorage.getItem(STORAGE_SHOWN);
      if (stored) {
        const ts = parseInt(stored, 10);
        const ageHours = (Date.now() - ts) / (1000 * 60 * 60);
        if (!isNaN(ts) && ageHours < RESET_HOURS) return;
      }
    } catch { return; }
    const t = setTimeout(() => {
      setOpen(true);
      try { localStorage.setItem(STORAGE_SHOWN, String(Date.now())); } catch {}
    }, delaySeconds * 1000);
    return () => clearTimeout(t);
  }, [autoOpen, forceOpen, enabled, delaySeconds]);

  useEffect(() => {
    try { spunTodayRef.current = localStorage.getItem(STORAGE_LAST_SPIN) === todayKey(); } catch {}
  }, [open]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => {
    setOpen(false);
    setResult(null);
    setCopied(false);
    setShowConfetti(false);
    onClose?.();
  };

  const spin = () => {
    if (spinning) return;
    if (spunTodayRef.current) return;

    const idx = pickWeighted();
    const prize = PRIZES[idx];
    const sliceCenter = idx * SLICE_DEG + SLICE_DEG / 2;
    const targetAngle = 360 - sliceCenter;
    const fullSpins = 6 + Math.floor(Math.random() * 3);
    const finalRotation = rotation + fullSpins * 360 + (targetAngle - (rotation % 360));

    setSpinning(true);
    setRotation(finalRotation);

    setTimeout(() => {
      setSpinning(false);
      setResult(prize);
      if (prize.code) setShowConfetti(true);
      try {
        localStorage.setItem(STORAGE_LAST_SPIN, todayKey());
        if (prize.code) {
          localStorage.setItem(STORAGE_REWARD, JSON.stringify({
            code: prize.code,
            label: prize.label,
            wonAt: Date.now(),
          }));
        }
      } catch {}
      spunTodayRef.current = true;
    }, 5200);
  };

  const copyCode = async () => {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const conicStyle = useMemo(() => {
    const stops: string[] = [];
    PRIZES.forEach((p, i) => {
      const start = i * SLICE_DEG;
      const end = (i + 1) * SLICE_DEG;
      stops.push(`${p.color} ${start}deg ${end}deg`);
    });
    return { background: `conic-gradient(from 0deg, ${stops.join(", ")})` };
  }, []);

  if (!enabled && !forceOpen) return null;
  if (typeof document === "undefined") return null;

  const WHEEL_SIZE = 320;
  const RADIUS = WHEEL_SIZE / 2;
  const LABEL_RADIUS = RADIUS - 58;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}
          onClick={() => !spinning && close()}
        >
          <motion.div
            initial={{ scale: 0.85, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            className="relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            style={{ background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 60%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <Confetti active={showConfetti} />

            <button
              onClick={close}
              disabled={spinning}
              aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors z-30 disabled:opacity-40 shadow-md"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="px-6 pt-7 pb-4 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white"
                style={{ background: "linear-gradient(90deg, #ea580c, #f97316)" }}>
                <Sparkles className="w-3 h-3" /> Free Spin
              </div>
              <h2 className="text-2xl font-black font-display text-gray-900 mt-3">{title}</h2>
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            </div>

            <div className="relative mx-auto" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
              {/* Pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -top-2 z-20"
                style={{
                  width: 0, height: 0,
                  borderLeft: "16px solid transparent",
                  borderRight: "16px solid transparent",
                  borderTop: "26px solid #E85D04",
                  filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))",
                }} />
              {/* Wheel */}
              <motion.div
                animate={{ rotate: rotation }}
                transition={{ duration: 5, ease: [0.17, 0.67, 0.21, 0.99] }}
                className="absolute inset-0 rounded-full shadow-xl"
                style={{
                  ...conicStyle,
                  border: "8px solid #fff",
                  boxShadow: "0 0 0 4px #E85D04, 0 14px 40px rgba(0,0,0,0.3)",
                }}
              >
                {/* Separator lines */}
                {PRIZES.map((_, i) => {
                  const a = i * SLICE_DEG;
                  return (
                    <div
                      key={`sep-${i}`}
                      className="absolute left-1/2 top-1/2 origin-top"
                      style={{
                        width: 1.5,
                        height: RADIUS - 8,
                        background: "rgba(255,255,255,0.45)",
                        transform: `translate(-50%, 0) rotate(${a}deg)`,
                        transformOrigin: "50% 0",
                      }}
                    />
                  );
                })}
                {/* Labels */}
                {PRIZES.map((p, i) => {
                  const angleDeg = i * SLICE_DEG + SLICE_DEG / 2;
                  const angleRad = (angleDeg - 90) * Math.PI / 180;
                  const x = RADIUS + LABEL_RADIUS * Math.cos(angleRad);
                  const y = RADIUS + LABEL_RADIUS * Math.sin(angleRad);
                  return (
                    <div
                      key={p.id}
                      className="absolute select-none pointer-events-none"
                      style={{
                        left: x,
                        top: y,
                        transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
                        width: 76,
                        textAlign: "center",
                      }}
                    >
                      <div className="text-base leading-none mb-0.5">{p.emoji}</div>
                      <div
                        className="font-black uppercase whitespace-pre-line leading-tight"
                        style={{
                          color: p.textColor || "#ffffff",
                          fontSize: 10,
                          letterSpacing: "0.05em",
                          textShadow: "0 1px 3px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.4)",
                        }}
                      >
                        {p.short}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
              {/* Hub */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center z-10"
                style={{
                  background: "radial-gradient(circle at 30% 30%, #fff, #f3f4f6)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.1)",
                  border: "3px solid #fff",
                }}>
                <Gift className="w-7 h-7 text-orange-500" />
              </div>
            </div>

            <div className="px-6 pb-6 pt-5 text-center">
              {!result ? (
                <>
                  <button
                    onClick={spin}
                    disabled={spinning || spunTodayRef.current}
                    data-testid="button-spin-wheel"
                    className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                    style={{ background: spinning ? "#9ca3af" : "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 16px rgba(232,93,4,0.35)" }}
                  >
                    {spinning ? "Spinning…" : spunTodayRef.current ? "Come back tomorrow!" : "SPIN NOW 🎰"}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-3 uppercase tracking-widest font-bold">
                    One spin per day &middot; T&amp;Cs apply
                  </p>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {result.code ? (
                    <>
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-widest">
                        {result.message || "You Won! 🎊"}
                      </p>
                      <p className="text-lg font-black text-gray-900">{result.label}</p>
                      <button
                        onClick={copyCode}
                        className="mx-auto inline-flex items-center gap-2 px-5 py-3 rounded-xl font-black border-2 border-dashed text-base transition-all active:scale-95"
                        style={{ borderColor: "#E85D04", color: "#E85D04", background: "#fff7ed" }}
                      >
                        {result.code}
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <p className="text-[11px] text-gray-500">
                        {copied ? "✓ Copied to clipboard!" : "Tap the code to copy it. Applies at checkout automatically."}
                      </p>
                      <button onClick={close} className="w-full py-3 rounded-xl font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #1f2937, #374151)" }}>
                        Continue Shopping
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-black text-gray-900">Better luck next time! ✨</p>
                      <p className="text-sm text-gray-500">Come back tomorrow for another free spin. Every day is a new chance!</p>
                      <button onClick={close} className="w-full py-3 rounded-xl font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                        Keep Shopping
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
