import { useState, useEffect } from "react";
import { Eye } from "lucide-react";

interface ViewerCountProps {
  productId: number | string;
  className?: string;
}

export function ViewerCount({ productId, className = "" }: ViewerCountProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const seed = typeof productId === "number" ? productId : parseInt(String(productId), 10) || 1;
    const initial = 3 + (seed % 10);
    setCount(Math.max(3, Math.min(initial, 12)));

    const id = setInterval(() => {
      setCount(prev => {
        if (prev === null) return null;
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(3, Math.min(prev + delta, 12));
      });
    }, 30000);

    return () => clearInterval(id);
  }, [productId]);

  if (count === null) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      <Eye className="w-3.5 h-3.5" style={{ color: "#E85D04" }} />
      <span className="text-gray-600">
        <span style={{ color: "#E85D04" }} className="font-black">{count}</span> people viewing now
      </span>
    </span>
  );
}
