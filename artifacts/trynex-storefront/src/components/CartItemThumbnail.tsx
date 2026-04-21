/* ═══════════════════════════════════════════════════════
   CartItemThumbnail — shared item preview image component
   Uses useCartItemPreview to derive the 2D thumbnail from
   the persisted cart-item payload (imageUrl → garment fallback).
════════════════════════════════════════════════════════ */
import { memo } from "react";
import { Package } from "lucide-react";
import { useCartItemPreview, type CartItemPreviewInput } from "@/hooks/useCartItemPreview";

export type { CartItemPreviewInput as CartItemPreviewData };

interface CartItemThumbnailProps {
  item: CartItemPreviewInput & { name: string };
  size?: number;
  className?: string;
}

export const CartItemThumbnail = memo(function CartItemThumbnail({
  item,
  size = 64,
  className = "",
}: CartItemThumbnailProps) {
  const px = size;
  const { thumbnailSrc } = useCartItemPreview(item);

  if (thumbnailSrc) {
    return (
      <div
        className={`rounded-xl overflow-hidden shrink-0 bg-gray-100 ${className}`}
        style={{ width: px, height: px }}
      >
        <img
          src={thumbnailSrc}
          alt={item.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
          width={px}
          height={px}
        />
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl overflow-hidden shrink-0 flex items-center justify-center ${className}`}
      style={{ width: px, height: px, background: "#f3f4f6" }}
    >
      <Package className="text-gray-300" style={{ width: px * 0.4, height: px * 0.4 }} />
    </div>
  );
});
