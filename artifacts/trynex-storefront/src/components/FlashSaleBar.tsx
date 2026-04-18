import { useState, useEffect } from "react";
import { Zap, X } from "lucide-react";
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

export function FlashSaleBar() {
  const { flashSaleEnabled, flashSaleEndTime, flashSaleMessage } = useSiteSettings();
  const [dismissed, setDismissed] = useState(false);
  const countdown = useCountdown(flashSaleEndTime);

  if (!flashSaleEnabled || dismissed || countdown.expired) return null;

  const hasCountdown = !!flashSaleEndTime && !isNaN(new Date(flashSaleEndTime).getTime());

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div
      className="relative z-50 flex items-center justify-center gap-3 py-2.5 px-4 text-white text-sm font-semibold"
      style={{ background: "linear-gradient(90deg, #c44b02, #E85D04, #FB8500, #E85D04, #c44b02)", backgroundSize: "300% 100%", animation: "flashGradient 4s ease infinite" }}
    >
      <Zap className="w-4 h-4 shrink-0 fill-yellow-300 text-yellow-300" />
      <span className="text-center leading-tight">{flashSaleMessage}</span>
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
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/20 transition-colors"
        aria-label="Dismiss flash sale bar"
      >
        <X className="w-3.5 h-3.5" />
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
