/* ═══════════════════════════════════════════════════════
   useCartItemPreview — shared preview-composition hook
   Derives both the 2D thumbnail src and 3D texture URLs
   from the persisted cart-item payload.
════════════════════════════════════════════════════════ */
import { useState, useEffect, useMemo } from "react";
import { composeGarmentMockup } from "@/pages/design-studio/composer";
import type { ComposerPrintZone } from "@/pages/design-studio/composer";

export type GarmentCategory = "tshirt" | "longsleeve" | "hoodie" | "mug" | "cap";

const GARMENT_CATEGORIES = new Set<GarmentCategory>(["tshirt", "longsleeve", "hoodie", "mug", "cap"]);
function toCategory(v: unknown): GarmentCategory {
  return GARMENT_CATEGORIES.has(v as GarmentCategory) ? (v as GarmentCategory) : "tshirt";
}

export interface CartItemPreviewPayload {
  thumbnailSrc: string | null;    // 2D composed mockup → feed to <img src>
  frontTexUrl: string | undefined; // 3D front design texture (customImages[0])
  backTexUrl: string | undefined;  // 3D back design texture (customImages[1])
  category: GarmentCategory;      // product category for 3D model selection
  colorHex: string;               // garment colour for 3D tinting
}

export interface CartItemPreviewInput {
  imageUrl?: string;
  customNote?: string;
  customImages?: string[];
}

function parseMeta(note?: string): Record<string, unknown> | null {
  if (!note) return null;
  try { return JSON.parse(note) as Record<string, unknown>; } catch { return null; }
}

/**
 * Returns the canonical 2D+3D preview payload for any cart item.
 *
 * Priority:
 *   1. item.imageUrl — already the composed garment+design mockup (generated at
 *      add-to-cart time by composeGarmentMockup). Available for all studio items
 *      and persists in localStorage (guest) / DB (authenticated) across reloads.
 *   2. mockupSrc + colorHex + printZone (from customNote) — compose a plain
 *      garment mockup (no design layers) as a graceful fallback for items where
 *      imageUrl was not captured (e.g., older cart entries).
 *   3. null — display component shows its own neutral placeholder.
 *
 * 3D textures: frontTexUrl / backTexUrl come from customImages[0/1], which are
 * generated in the same studio session as imageUrl, so 2D and 3D are always in
 * sync from the same persisted payload.
 */
export function useCartItemPreview(item: CartItemPreviewInput): CartItemPreviewPayload {
  const meta = useMemo(() => parseMeta(item.customNote), [item.customNote]);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);

  useEffect(() => {
    if (item.imageUrl || !meta?.mockupSrc || !meta?.colorHex || !meta?.printZone) {
      setFallbackSrc(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const canvas = document.createElement("canvas");
        await composeGarmentMockup({
          canvas,
          garmentSrc: meta.mockupSrc as string,
          garmentColor: meta.colorHex as string,
          printZone: meta.printZone as ComposerPrintZone,
          layers: [],
          outSize: 400,
        });
        if (!cancelled) setFallbackSrc(canvas.toDataURL("image/png"));
      } catch { /* no-op — component will show its own placeholder */ }
    })();
    return () => { cancelled = true; };
  }, [item.imageUrl, meta]);

  return {
    thumbnailSrc: item.imageUrl ?? fallbackSrc,
    frontTexUrl: item.customImages?.[0],
    backTexUrl: item.customImages?.[1],
    category: toCategory(meta?.category),
    colorHex: (meta?.colorHex as string) || "#1a1a1a",
  };
}
