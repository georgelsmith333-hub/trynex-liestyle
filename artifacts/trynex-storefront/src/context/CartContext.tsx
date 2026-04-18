import React, { createContext, useContext, useState, useEffect } from 'react';
import { trackAddToCart } from '@/lib/tracking';

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
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('trynex_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('trynex_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (newItem: Omit<CartItem, 'id'>) => {
    trackAddToCart({ id: newItem.productId, name: newItem.name, price: newItem.price, quantity: newItem.quantity });
    setItems(prev => {
      // Studio designs are always unique cart lines (each has its own custom artwork)
      const isStudioDesign = (() => {
        try { return !!JSON.parse(newItem.customNote ?? "{}").studioDesign; } catch { return false; }
      })();

      if (isStudioDesign) {
        const id = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
  };

  const removeFromCart = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      subtotal,
      itemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
