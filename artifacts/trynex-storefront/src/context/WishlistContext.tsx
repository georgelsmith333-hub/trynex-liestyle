import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface WishlistItem {
  id: number;
  name: string;
  price: number;
  discountPrice?: number | null;
  imageUrl?: string | null;
  slug?: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: number) => void;
  isWishlisted: (id: number) => boolean;
  toggleWishlist: (item: WishlistItem) => void;
  count: number;
}

const WishlistContext = createContext<WishlistContextType | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>(() => {
    try {
      const stored = localStorage.getItem("trynex_wishlist");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("trynex_wishlist", JSON.stringify(items));
  }, [items]);

  const addToWishlist = (item: WishlistItem) => {
    setItems(prev => {
      if (prev.some(i => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeFromWishlist = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const isWishlisted = (id: number) => items.some(i => i.id === id);

  const toggleWishlist = (item: WishlistItem) => {
    if (isWishlisted(item.id)) {
      removeFromWishlist(item.id);
      toast({ title: "Removed from wishlist", description: item.name });
    } else {
      addToWishlist(item);
      toast({ title: "❤️ Added to wishlist!", description: item.name });
    }
  };

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isWishlisted, toggleWishlist, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
};
