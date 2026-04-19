import { Truck, CheckCircle2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface FreeShippingProgressProps {
  subtotal: number;
  threshold: number;
}

export function FreeShippingProgress({ subtotal, threshold }: FreeShippingProgressProps) {
  if (subtotal <= 0 || threshold <= 0) return null;
  const reached = subtotal >= threshold;
  const pct = Math.min(100, Math.round((subtotal / threshold) * 100));
  const remaining = Math.max(0, threshold - subtotal);

  return (
    <div
      className="p-3 rounded-xl"
      style={{
        background: reached ? "rgba(22,163,74,0.06)" : "rgba(232,93,4,0.06)",
        border: `1px solid ${reached ? "rgba(22,163,74,0.2)" : "rgba(232,93,4,0.15)"}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        {reached ? (
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
        ) : (
          <Truck className="w-4 h-4 text-orange-600 shrink-0" />
        )}
        <p className={`text-xs font-bold ${reached ? "text-green-700" : "text-orange-700"}`}>
          {reached ? (
            <>🎉 You unlocked free shipping! <span className="font-semibold opacity-80">— ফ্রি ডেলিভারি!</span></>
          ) : (
            <>
              Add {formatPrice(remaining)} more for FREE shipping
              <span className="font-semibold opacity-80"> — আর {formatPrice(remaining)} যোগ করুন</span>
            </>
          )}
        </p>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(0,0,0,0.06)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: reached
              ? "linear-gradient(90deg, #16a34a, #22c55e)"
              : "linear-gradient(90deg, #E85D04, #FB8500)",
          }}
        />
      </div>
    </div>
  );
}
