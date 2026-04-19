import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { trackAddToCart } from '@/lib/tracking';

export interface HamperLineItem {
  productId?: number;
  name: string;
  quantity: number;
  imageUrl?: string;
}

export interface HamperPayload {
  hamperId: number;
  hamperSlug: string;
  hamperName: string;
  items: HamperLineItem[];
  giftMessage?: string;
  recipientName?: string;
  isCustom?: boolean;
}

export interface CartItem {
  id: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  size?: string;
  color?: string;
  customNote?: string;
  customImages?: string[];
  hamperPayload?: HamperPayload;
}

interface CartState {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

interface CartActions {
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  /**
   * Atomically adjust a line's quantity by a delta (positive or negative).
   * Always reads the latest quantity inside a functional setState, so rapid
   * taps that fire faster than React can re-render don't collide. Quantity
   * is clamped to >= 1; remove items with `removeFromCart`.
   */
  changeQuantity: (id: string, delta: number) => void;
  clearCart: () => void;
}

const CartStateContext = createContext<CartState | undefined>(undefined);
const CartActionsContext = createContext<CartActions | undefined>(undefined);

const STORAGE_KEY = 'trynex_cart';
const FLUSH_DELAY_MS = 250;

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Debounced localStorage persistence — coalesces rapid +/- clicks into a
  // single write. A best-effort sync flush also runs on tab hide/unload so
  // we don't lose recent edits when the user navigates away.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    const flush = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsRef.current));
      } catch {
        /* quota exceeded or storage disabled — ignore */
      }
    };

    const handle = window.setTimeout(flush, FLUSH_DELAY_MS);
    const onHide = () => flush();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      window.clearTimeout(handle);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [items]);

  // Stable actions — functional setState removes the need for item deps,
  // so these callbacks keep referential equality across renders.
  const addToCart = useCallback((newItem: Omit<CartItem, 'id'>) => {
    trackAddToCart({ id: newItem.productId, name: newItem.name, price: newItem.price, quantity: newItem.quantity });
    setItems(prev => {
      const isStudioDesign = (() => {
        try { return !!JSON.parse(newItem.customNote ?? "{}").studioDesign; } catch { return false; }
      })();

      if (isStudioDesign) {
        const id = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return [...prev, { ...newItem, id }];
      }

      if (newItem.hamperPayload) {
        const id = `hamper-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        return [...prev, { ...newItem, id }];
      }

      const id = `${newItem.productId}-${newItem.size || 'nosize'}-${newItem.color || 'nocolor'}`;
      const existing = prev.find(item => item.id === id);
      if (existing) {
        return prev.map(item =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity + newItem.quantity,
                customNote: newItem.customNote || item.customNote,
                customImages: newItem.customImages?.length
                  ? [...(item.customImages || []), ...newItem.customImages]
                  : item.customImages,
              }
            : item
        );
      }
      return [...prev, { ...newItem, id }];
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (item.id === id && item.quantity !== quantity) {
          changed = true;
          return { ...item, quantity };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, []);

  const changeQuantity = useCallback((id: string, delta: number) => {
    if (!delta) return;
    setItems(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (item.id !== id) return item;
        const nextQty = Math.max(1, item.quantity + delta);
        if (nextQty === item.quantity) return item;
        changed = true;
        return { ...item, quantity: nextQty };
      });
      return changed ? next : prev;
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  // Single-pass derived totals memoized on items reference.
  const stateValue = useMemo<CartState>(() => {
    let subtotal = 0;
    let itemCount = 0;
    for (const it of items) {
      subtotal += it.price * it.quantity;
      itemCount += it.quantity;
    }
    return { items, subtotal, itemCount };
  }, [items]);

  const actionsValue = useMemo<CartActions>(
    () => ({ addToCart, removeFromCart, updateQuantity, changeQuantity, clearCart }),
    [addToCart, removeFromCart, updateQuantity, changeQuantity, clearCart]
  );

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartStateContext.Provider value={stateValue}>
        {children}
      </CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

// Action-only consumers (ProductCard, ProductDetail, etc.) should prefer
// this hook so they don't re-render when the cart state changes.
export const useCartActions = (): CartActions => {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error('useCartActions must be used within a CartProvider');
  return ctx;
};

export const useCartState = (): CartState => {
  const ctx = useContext(CartStateContext);
  if (!ctx) throw new Error('useCartState must be used within a CartProvider');
  return ctx;
};

// Backwards-compat combined hook. Components that only need actions or only
// need state should switch to the dedicated hooks above for fewer renders.
export const useCart = (): CartState & CartActions => {
  const state = useCartState();
  const actions = useCartActions();
  return { ...state, ...actions };
};
