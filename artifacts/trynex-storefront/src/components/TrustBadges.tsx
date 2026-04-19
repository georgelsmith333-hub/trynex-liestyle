import { Shield, RotateCcw, Truck, BadgeCheck } from "lucide-react";

export function TrustBadges() {
  const badges = [
    { icon: Shield, label: "SSL Secure", sub: "256-bit encrypted" },
    { icon: RotateCcw, label: "Easy Returns", sub: "Within 7 days" },
    { icon: Truck, label: "Cash on Delivery", sub: "Pay when you receive" },
    { icon: BadgeCheck, label: "5,000+ Customers", sub: "Verified reviews" },
  ];

  return (
    <div className="mb-4 p-3 rounded-2xl" style={{ background: "rgba(0,0,0,0.02)", border: "1px solid #f3f4f6" }}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {badges.map(({ icon: Icon, label, sub }) => (
          <div
            key={label}
            className="flex items-center gap-2 p-2 rounded-xl bg-white"
            style={{ border: "1px solid #f3f4f6" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "rgba(232,93,4,0.08)" }}
            >
              <Icon className="w-4 h-4" style={{ color: "#E85D04" }} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-gray-800 leading-tight truncate">{label}</p>
              <p className="text-[10px] text-gray-400 leading-tight truncate">{sub}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">We accept:</span>
        <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ background: "rgba(226,19,110,0.08)", color: "#e2136e" }}>bKash</span>
        <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ background: "rgba(247,148,29,0.1)", color: "#f7941d" }}>Nagad</span>
        <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.1)", color: "#7c3aed" }}>Rocket</span>
        <span className="text-[11px] font-black px-2 py-0.5 rounded" style={{ background: "rgba(16,163,74,0.08)", color: "#16a34a" }}>COD</span>
      </div>
    </div>
  );
}
