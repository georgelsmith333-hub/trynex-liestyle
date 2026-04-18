import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "trynex_recently_viewed";
const MAX_ITEMS = 8;

interface RecentProduct {
  id: number;
  name: string;
  slug: string;
  price: number;
  imageUrl: string;
  viewedAt: number;
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch {}
  }, []);

  const addProduct = useCallback((product: Omit<RecentProduct, "viewedAt">) => {
    setItems(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [{ ...product, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, []);

  return { items, addProduct };
}
