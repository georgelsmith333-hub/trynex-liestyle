import { useMemo } from "react";
import { Check, ChevronRight, Package, Search, Sparkles, X } from "lucide-react";
import {
  getProductPickerFallbackSrc, getProductPickerPreviewSrc, getZonePZ,
  MUG_PZ, MUG_WRAP_BACK_PZ, MUG_SIDE_PZ, MUG_SIDE_BACK_PZ,
  PRODUCTS, type DesignProduct,
} from "@/pages/design-studio/mockups";
import { useDesignStore } from "@/hooks/useDesignStore";

const CATEGORY_LABELS: Array<{ id: "all" | DesignProduct["category"]; label: string }> = [
  { id: "all", label: "All products" },
  { id: "tshirt", label: "T-Shirts" },
  { id: "longsleeve", label: "Long Sleeves" },
  { id: "hoodie", label: "Hoodies" },
  { id: "mug", label: "Mugs" },
  { id: "cap", label: "Caps" },
  { id: "waterbottle", label: "Water Bottles" },
];

const CARD_IMAGE_CLASS: Record<DesignProduct["category"], string> = {
  tshirt: "h-[88%] w-[88%]",
  longsleeve: "h-[84%] w-[88%]",
  hoodie: "h-[91%] w-[91%]",
  mug: "h-[77%] w-[82%]",
  cap: "h-[78%] w-[84%]",
  waterbottle: "h-[90%] w-[76%]",
};

const CARD_TONE: Record<DesignProduct["category"], string> = {
  tshirt: "from-[#f7f0e8] via-[#fbfaf8] to-[#eee8df]",
  longsleeve: "from-[#f2eee8] via-[#fbfaf8] to-[#e8e2d9]",
  hoodie: "from-[#f5eee7] via-[#fcfaf8] to-[#ebe3da]",
  mug: "from-[#eee9e2] via-[#faf9f6] to-[#e4ddd3]",
  cap: "from-[#f3eee7] via-[#fbfaf8] to-[#e7dfd5]",
  waterbottle: "from-[#f0eee9] via-[#fbfaf8] to-[#e4e1da]",
};

function getSwitchPrintZone(
  face: "front" | "back" | "left-sleeve" | "right-sleeve" | "neck-label",
  product: DesignProduct,
  colorHex: string,
  mugMode: "side1" | "side2" | "wrap",
) {
  if (product.category === "mug") {
    if (mugMode === "wrap") return face === "back" ? MUG_WRAP_BACK_PZ : MUG_PZ;
    return face === "back" ? MUG_SIDE_BACK_PZ : MUG_SIDE_PZ;
  }
  return getZonePZ(face, product, colorHex);
}

function ProductCardImage({ product }: { product: DesignProduct }) {
  const previewSrc = getProductPickerPreviewSrc(product);
  const fallbackSrc = getProductPickerFallbackSrc(product);
  return (
    <div className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gradient-to-br ${CARD_TONE[product.category]}`}>
      <div className="pointer-events-none absolute inset-x-[14%] bottom-[10%] h-5 rounded-[50%] bg-black/10 blur-xl" aria-hidden="true" />
      <img
        src={previewSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={(event) => {
          const image = event.currentTarget;
          if (fallbackSrc) {
            image.onerror = null;
            image.src = fallbackSrc;
          }
        }}
        className={`relative z-[1] max-h-full max-w-full object-contain drop-shadow-[0_14px_18px_rgba(28,25,23,0.14)] transition duration-300 ease-out group-hover/card:scale-[1.035] ${CARD_IMAGE_CLASS[product.category]}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,255,255,0.68),transparent_58%)]" aria-hidden="true" />
    </div>
  );
}

export function ProductSwitcher() {
  const selectedProduct = useDesignStore((s) => s.selectedProduct);
  const showProductPicker = useDesignStore((s) => s.showProductPicker);
  const productSearch = useDesignStore((s) => s.productSearch);
  const productPickerCategory = useDesignStore((s) => s.productPickerCategory);
  const switchProduct = useDesignStore((s) => s.switchProduct);
  const setLinkedStoreProduct = useDesignStore((s) => s.setLinkedStoreProduct);
  const setQuantity = useDesignStore((s) => s.setQuantity);
  const mugMode = useDesignStore((s) => s.mugMode);
  const layers = useDesignStore((s) => s.layers);
  const selectedColor = useDesignStore((s) => s.selectedColor);
  const setShowProductPicker = useDesignStore((s) => s.setShowProductPicker);
  const setProductSearch = useDesignStore((s) => s.setProductSearch);
  const setProductPickerCategory = useDesignStore((s) => s.setProductPickerCategory);

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return PRODUCTS.filter((product) => {
      const inCategory = productPickerCategory === "all" || product.category === productPickerCategory;
      const inSearch = !search || `${product.name} ${product.description}`.toLowerCase().includes(search);
      return inCategory && inSearch;
    });
  }, [productPickerCategory, productSearch]);

  const chooseProduct = (product: DesignProduct) => {
    if (product.id !== selectedProduct.id) {
      const nextColor = product.colors.find((color) => color.hex.toLowerCase() === selectedColor.hex.toLowerCase()) ?? product.colors[0];
      const oldMugMode = selectedProduct.category === "mug" ? mugMode : "side1";
      const nextMugMode = selectedProduct.category === "mug" && product.category === "mug" ? mugMode : "side1";
      const layerTransforms = layers.map((layer) => {
        const face = layer.face ?? "front";
        const oldZone = getSwitchPrintZone(face, selectedProduct, selectedColor.hex, oldMugMode);
        const nextZone = getSwitchPrintZone(face, product, nextColor.hex, nextMugMode);
        const widthRatio = nextZone.w / Math.max(1, oldZone.w);
        const heightRatio = nextZone.h / Math.max(1, oldZone.h);
        const fitRatio = Math.min(widthRatio, heightRatio);
        return {
          id: layer.id,
          transform: {
            ...layer.transform,
            x: layer.transform.x * widthRatio,
            y: layer.transform.y * heightRatio,
            scale: layer.transform.scale * fitRatio,
            scaleX: layer.transform.scaleX ? layer.transform.scaleX * fitRatio : undefined,
            scaleY: layer.transform.scaleY ? layer.transform.scaleY * fitRatio : undefined,
          },
        };
      });
      // Product, colour, face, mug mode, and refitted artwork are one history
      // transaction so one undo restores the complete previous design state.
      switchProduct(product, nextColor, layerTransforms, nextMugMode);
      // Preserve artwork for the apply-to-product workflow, but reset product-specific
      // commerce identity, quantity, and incompatible face/mug state.
      setLinkedStoreProduct(null);
      setQuantity(1);
    }
    setProductSearch("");
    setProductPickerCategory("all");
    setShowProductPicker(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShowProductPicker(true)}
        aria-haspopup="dialog"
        aria-expanded={showProductPicker}
        className="group flex min-w-0 items-center gap-2 rounded-2xl border border-stone-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-black text-stone-800 shadow-[0_5px_18px_rgba(28,25,23,0.06)] transition hover:border-orange-400 hover:shadow-[0_8px_24px_rgba(28,25,23,0.10)] active:scale-[0.985]"
      >
        <Package className="h-4 w-4 shrink-0 text-orange-500" />
        <span className="min-w-0 truncate">{selectedProduct.name}</span>
        <span className="hidden shrink-0 text-[10px] font-bold text-stone-400 sm:inline">{selectedProduct.description}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-0.5" />
      </button>

      {showProductPicker && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/50 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-picker-title"
        >
          <div className="flex max-h-[min(94svh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-[30px] bg-[#f8f7f4] shadow-[0_24px_80px_rgba(28,25,23,0.28)] sm:max-h-[88svh] sm:rounded-[30px]">
            <div className="shrink-0 border-b border-stone-200/80 bg-white/95 px-4 py-4 sm:px-7 sm:py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-black text-stone-950 sm:text-base">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    <h2 id="product-picker-title">Choose your product</h2>
                  </div>
                  <p className="mt-1 max-w-2xl text-[11px] leading-5 text-stone-500 sm:text-xs">
                    Select a product preview. Your current artwork stays attached and will be reapplied to the new print area.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProductPicker(false)}
                  aria-label="Close product picker"
                  className="shrink-0 rounded-xl p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search products</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search products…"
                    className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
                  />
                </label>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1 sm:max-w-[68%]">
                  {CATEGORY_LABELS.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setProductPickerCategory(category.id)}
                      aria-pressed={productPickerCategory === category.id}
                      className={`shrink-0 rounded-full px-3 py-2 text-[11px] font-black transition active:scale-95 ${productPickerCategory === category.id ? "bg-stone-950 text-white shadow-sm" : "border border-stone-200 bg-white text-stone-600 hover:border-orange-300 hover:text-orange-600"}`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-6">
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" role="list" aria-label="Available products">
                  {filteredProducts.map((product) => {
                    const active = product.id === selectedProduct.id;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => chooseProduct(product)}
                        aria-pressed={active}
                        className={`group/card flex min-h-[250px] flex-col overflow-hidden rounded-[22px] border bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(28,25,23,0.14)] active:scale-[0.985] focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 ${active ? "border-orange-500 ring-2 ring-orange-100" : "border-stone-200/90 hover:border-orange-300"}`}
                      >
                        <ProductCardImage product={product} />
                        <div className="shrink-0 border-t border-stone-100 px-3.5 py-3 sm:px-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-xs font-black text-stone-950 sm:text-sm">{product.name}</div>
                              <div className="mt-1 truncate text-[10px] font-semibold text-stone-500 sm:text-[11px]">{product.description}</div>
                            </div>
                            {active && (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white shadow-md" aria-label="Selected">
                                <Check className="h-4 w-4" />
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            {product.badge ? (
                              <span className="inline-flex rounded-full bg-orange-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-orange-600">{product.badge}</span>
                            ) : (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-stone-400">Studio blank</span>
                            )}
                            <span className="text-[9px] font-bold text-stone-400">Tap to customize</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-14 text-center text-sm text-stone-500">
                  No product matches this search. Try another category or keyword.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
