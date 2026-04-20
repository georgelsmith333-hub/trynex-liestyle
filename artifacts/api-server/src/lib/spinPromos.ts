export type VirtualPromo = {
  code: string;
  discountType: "percentage" | "free_shipping" | "combo";
  discountValue: number;
  minOrderAmount: number;
  message: string;
  freeShipping?: boolean;
};

export const VIRTUAL_SPIN_PROMOS: Record<string, VirtualPromo> = {
  SPIN5:     { code: "SPIN5",     discountType: "percentage",    discountValue: 5,  minOrderAmount: 0,    message: "5% off applied!" },
  SPIN10:    { code: "SPIN10",    discountType: "percentage",    discountValue: 10, minOrderAmount: 0,    message: "10% off applied!" },
  SPIN15:    { code: "SPIN15",    discountType: "percentage",    discountValue: 15, minOrderAmount: 0,    message: "15% off applied!" },
  FREEDELIV: { code: "FREEDELIV", discountType: "free_shipping", discountValue: 0,  minOrderAmount: 1500, message: "Free delivery applied!", freeShipping: true },
  SUPERDEAL: { code: "SUPERDEAL", discountType: "combo",         discountValue: 10, minOrderAmount: 1500, message: "Free delivery + 10% off applied!", freeShipping: true },
};

export function getVirtualPromo(code: string | null | undefined): VirtualPromo | null {
  if (!code) return null;
  const key = code.toUpperCase().trim();
  return VIRTUAL_SPIN_PROMOS[key] || null;
}

export function calcVirtualDiscount(promo: VirtualPromo, subtotal: number, shippingCost: number): { discount: number; freeShipping: boolean } {
  let discount = 0;
  if (promo.discountType === "percentage") {
    discount = Math.round(subtotal * promo.discountValue / 100);
  } else if (promo.discountType === "combo") {
    discount = Math.round(subtotal * promo.discountValue / 100);
  }
  return { discount, freeShipping: !!promo.freeShipping };
}
