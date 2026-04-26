import { useState, useEffect } from "react";
import { Zap, X, Sparkles, Gift } from "lucide-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

function useCountdown(endTime: string) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    if (!endTime) {
      setTimeLeft({ h: 0, m: 0, s: 0, expired: false });
      return;
    }
    const end = new Date(endTime).getTime();
    if (isNaN(end)) {
      setTimeLeft({ h: 0, m: 0, s: 0, expired: false });
      return;
    }

    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setTimeLeft({ h: 0, m: 0, s: 0, expired: true });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ h, m, s, expired: false });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return timeLeft;
}

interface SeasonConfig {
  message: string;
  gradient: string;
  icon: "zap" | "sparkles" | "gift";
  animation: string;
}

function getSeasonConfig(): SeasonConfig {
  const month = new Date().getMonth() + 1;
  const day   = new Date().getDate();

  if (month === 4 && day >= 10 && day <= 20) {
    return {
      message: "🌸 Pohela Boishakh Sale — Free delivery on orders above ৳1500!",
      gradient: "linear-gradient(90deg, #b45309, #d97706, #f59e0b, #d97706, #b45309)",
      icon: "sparkles",
      animation: "flashGradient 3s ease infinite",
    };
  }
  if ((month === 3 && day >= 25) || (month === 4 && day <= 9)) {
    return {
      message: "🌸 Boishakh Special — Order custom gifts before the rush!",
      gradient: "linear-gradient(90deg, #b45309, #d97706, #f59e0b, #d97706, #b45309)",
      icon: "sparkles",
      animation: "flashGradient 3s ease infinite",
    };
  }
  if (month === 12 || month === 1 || month === 2) {
    return {
      message: "❄️ Winter Exclusive — Custom hoodies & warm gifts now available!",
      gradient: "linear-gradient(90deg, #1e3a5f, #1d4ed8, #3b82f6, #1d4ed8, #1e3a5f)",
      icon: "gift",
      animation: "flashGradient 5s ease infinite",
    };
  }
  if (month === 3) {
    return {
      message: "🌺 Spring Collection — Fresh designs at special prices!",
      gradient: "linear-gradient(90deg, #7c2d6a, #a21caf, #d946ef, #a21caf, #7c2d6a)",
      icon: "sparkles",
      animation: "flashGradient 4s ease infinite",
    };
  }
  if (month === 6 || month === 7) {
    return {
      message: "☔ Monsoon Sale — Stay stylish through the rain, free delivery on ৳1500+!",
      gradient: "linear-gradient(90deg, #065f46, #059669, #10b981, #059669, #065f46)",
      icon: "zap",
      animation: "flashGradient 4s ease infinite",
    };
  }
  if (month === 10 || month === 11) {
    return {
      message: "🍂 Festival Season Sale — Custom gifts for every occasion!",
      gradient: "linear-gradient(90deg, #7c2d12, #c2410c, #ea580c, #c2410c, #7c2d12)",
      icon: "gift",
      animation: "flashGradient 4s ease infinite",
    };
  }
  return {
    message: "⚡ FLASH SALE — Limited Stock! Free delivery on orders above ৳1500!",
    gradient: "linear-gradient(90deg, #c44b02, #E85D04, #FB8500, #E85D04, #c44b02)",
    icon: "zap",
    animation: "flashGradient 4s ease infinite",
  };
}

const DEFAULT_MESSAGE = "⚡ FLASH SALE — Limited Stock!";

export function FlashSaleBar() {
  const { flashSaleEnabled, flashSaleEndTime, flashSaleMessage } = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);
  const countdown = useCountdown(flashSaleEndTime);

  if (!flashSaleEnabled || dismissed || countdown.expired) return null;

  const hasCountdown = !!flashSaleEndTime && !isNaN(new Date(flashSaleEndTime).getTime());
  const pad = (n: number) => String(n).padStart(2, "0");

  const isDefaultMessage = !flashSaleMessage || flashSaleMessage === DEFAULT_MESSAGE;
  const season = isDefaultMessage ? getSeasonConfig() : null;
  const displayMessage = season ? season.message : flashSaleMessage;
  const gradient = season ? season.gradient : "linear-gradient(90deg, #c44b02, #E85D04, #FB8500, #E85D04, #c44b02)";
  const anim = season ? season.animation : "flashGradient 4s ease infinite";
  const iconType = season ? season.icon : "zap";

  return (
    <div
      className="relative z-50 flex items-center justify-center gap-3 py-2.5 px-4 text-white text-sm font-semibold"
      style={{ background: gradient, backgroundSize: "300% 100%", animation: anim }}
    >
      {iconType === "sparkles" ? (
        <Sparkles className="w-4 h-4 shrink-0 fill-yellow-200 text-yellow-200" />
      ) : iconType === "gift" ? (
        <Gift className="w-4 h-4 shrink-0 fill-yellow-200 text-yellow-200" />
      ) : (
        <Zap className="w-4 h-4 shrink-0 fill-yellow-300 text-yellow-300" />
      )}
      <span className="text-center leading-tight">{displayMessage}</span>
      {hasCountdown && !countdown.expired && (
        <span className="inline-flex items-center gap-1 bg-white/20 rounded-lg px-2.5 py-0.5 font-mono font-black text-sm tracking-wider ml-1">
          <span>{pad(countdown.h)}</span>
          <span className="opacity-60">:</span>
          <span>{pad(countdown.m)}</span>
          <span className="opacity-60">:</span>
          <span>{pad(countdown.s)}</span>
        </span>
      )}
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-1 top-1/2 -translate-y-1/2 touch-target rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss flash sale bar"
      >
        <X className="w-4 h-4" />
      </button>
      <style>{`
        @keyframes flashGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </div>
  );
}
