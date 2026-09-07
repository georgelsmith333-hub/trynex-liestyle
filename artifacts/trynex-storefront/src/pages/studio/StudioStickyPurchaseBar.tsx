import { Check, Loader2, Minus, Plus, ShoppingBag, ShieldAlert } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface StudioStickyPurchaseBarProps {
  productName: string;
  colorName: string;
  price: number;
  quantity: number;
  stock?: number;
  isAdding: boolean;
  added?: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  onChangeQuantity: (quantity: number) => void;
  onAddToCart: () => void;
}

/**
 * The customer-facing studio CTA is intentionally always present on mobile.
 * It does not depend on observing a header button because the editor canvas and
 * mobile sheet can change the scroll position without making a product CTA
 * visible. Safe-area padding is handled here so the button stays above the
 * phone's home indicator.
 */
export function StudioStickyPurchaseBar({
  productName,
  colorName,
  price,
  quantity,
  stock = 99,
  isAdding,
  added = false,
  disabled = false,
  disabledReason,
  onChangeQuantity,
  onAddToCart,
}: StudioStickyPurchaseBarProps) {
  const reason = disabledReason ?? (disabled ? "Add artwork to continue." : null);
  const actionLabel = isAdding ? "Preparing…" : added ? "Added" : "Add to cart";

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[50] border-t border-gray-200/90 bg-white/95 shadow-[0_-10px_30px_rgba(17,24,39,0.12)] backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(0.65rem, env(safe-area-inset-bottom, 0px))" }}
      data-testid="studio-sticky-purchase"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 pt-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-black text-gray-900">{productName}</p>
          <p className="truncate text-[10px] font-semibold text-gray-500">
            {colorName} · <span className="text-orange-600">{formatPrice(price * quantity)}</span>
          </p>
          {reason && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] font-bold text-amber-700" role="status">
              <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
              {reason}
            </p>
          )}
        </div>

        <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <button
            type="button"
            className="flex h-11 w-9 items-center justify-center text-gray-500 transition active:bg-gray-200 disabled:opacity-40"
            aria-label="Decrease quantity"
            disabled={quantity <= 1 || isAdding}
            onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <span className="w-5 text-center text-sm font-black tabular-nums text-gray-900" aria-label={`Quantity ${quantity}`}>
            {quantity}
          </span>
          <button
            type="button"
            className="flex h-11 w-9 items-center justify-center text-gray-500 transition active:bg-gray-200 disabled:opacity-40"
            aria-label="Increase quantity"
            disabled={quantity >= stock || isAdding}
            onClick={() => onChangeQuantity(Math.min(stock, quantity + 1))}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-xs font-black text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
          style={{ background: added ? "#16a34a" : "linear-gradient(135deg, #E85D04, #FB8500)" }}
          disabled={disabled || isAdding}
          aria-label={reason ? `${actionLabel}. ${reason}` : actionLabel}
          onClick={onAddToCart}
        >
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : added ? <Check className="h-4 w-4" aria-hidden="true" /> : <ShoppingBag className="h-4 w-4" aria-hidden="true" />}
          <span>{actionLabel}</span>
        </button>
      </div>
    </div>
  );
}