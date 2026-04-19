import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { Gift, ShoppingBag, Heart, Plus, Minus, Package, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Product {
  id: number;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  imageUrl?: string;
}

const MIN_ITEMS = 3;

export default function HamperBuilder() {
  const [, setLocation] = useLocation();
  const { addToCart } = useCartActions();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Record<number, number>>({});
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");

  useEffect(() => {
    fetch(getApiUrl("/api/products?limit=24"))
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const totalCount = useMemo(() => Object.values(picked).reduce((a, b) => a + b, 0), [picked]);
  const totalPrice = useMemo(() => {
    let sum = 0;
    for (const p of products) {
      const q = picked[p.id] || 0;
      const unit = p.discountPrice ?? p.price;
      sum += unit * q;
    }
    return Math.round(sum * 0.95); // 5% bundle discount
  }, [picked, products]);

  const change = (id: number, delta: number) => {
    setPicked(prev => {
      const next = { ...prev };
      const cur = next[id] || 0;
      const v = Math.max(0, Math.min(10, cur + delta));
      if (v === 0) delete next[id];
      else next[id] = v;
      return next;
    });
  };

  const handleAddToCart = () => {
    if (totalCount < MIN_ITEMS) {
      toast({ title: `Pick at least ${MIN_ITEMS} items`, description: `Add ${MIN_ITEMS - totalCount} more to build your hamper.`, variant: "destructive" });
      return;
    }
    if (giftMessage.length > 200) {
      toast({ title: "Gift message too long", variant: "destructive" });
      return;
    }
    const items = products
      .filter(p => picked[p.id])
      .map(p => ({
        productId: p.id,
        name: p.name,
        quantity: picked[p.id],
        imageUrl: p.imageUrl,
      }));

    addToCart({
      productId: 0,
      name: "Custom Gift Hamper",
      price: totalPrice,
      quantity: 1,
      imageUrl: items[0]?.imageUrl,
      hamperPayload: {
        hamperId: 0,
        hamperSlug: "build-your-own",
        hamperName: "Custom Gift Hamper",
        items,
        giftMessage: giftMessage.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
        isCustom: true,
      },
    });
    toast({ title: "Custom hamper added!", description: `${totalCount} items, ${formatPrice(totalPrice)}` });
    setLocation("/cart");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Build Your Own Gift Hamper | TryNex Lifestyle"
        description="Pick any 3+ products and build your custom gift hamper with a personal message. Bangladesh-wide delivery."
        canonical="/hampers/build"
      />
      <Navbar />

      <main className="flex-1 pt-header pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center pt-6 pb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(232,93,4,0.08)', border: '1px solid rgba(232,93,4,0.2)' }}>
              <Package className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-orange-600">Build Your Own • নিজেই তৈরি করুন</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tighter text-gray-900 mb-2">
              Pick your perfect hamper
            </h1>
            <p className="text-gray-500">Choose at least {MIN_ITEMS} items — 5% bundle discount applied automatically.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Products */}
            <div className="lg:col-span-8">
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="aspect-square bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map(p => {
                    const q = picked[p.id] || 0;
                    const isSelected = q > 0;
                    const unit = p.discountPrice ?? p.price;
                    return (
                      <div key={p.id}
                        className="rounded-2xl overflow-hidden bg-white transition-all"
                        style={{
                          border: isSelected ? '2px solid #E85D04' : '1px solid #e5e7eb',
                          boxShadow: isSelected ? '0 4px 16px rgba(232,93,4,0.15)' : 'none',
                        }}
                      >
                        <div className="aspect-square bg-gray-50 overflow-hidden relative">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Gift className="w-10 h-10 text-gray-300" /></div>
                          )}
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-black shadow-lg">
                              {q}
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="font-bold text-xs text-gray-900 line-clamp-2 leading-tight mb-1 min-h-[2rem]">{p.name}</p>
                          <p className="font-black text-sm text-orange-600 mb-2">{formatPrice(unit)}</p>
                          <div className="flex items-center justify-between gap-1">
                            <button
                              onClick={() => change(p.id, -1)}
                              disabled={q === 0}
                              className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-sm text-gray-900 min-w-[1.5rem] text-center">{q}</span>
                            <button
                              onClick={() => change(p.id, 1)}
                              className="w-7 h-7 rounded-lg bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart */}
            <div className="lg:col-span-4">
              <div className="sticky top-28 rounded-3xl p-6 bg-white" style={{ border: '1px solid #e5e7eb' }}>
                <h3 className="text-lg font-black font-display mb-1 text-gray-900">Your Hamper</h3>
                <p className="text-xs text-gray-500 mb-4">{totalCount} of {MIN_ITEMS}+ items</p>

                {totalCount === 0 ? (
                  <div className="text-center py-8 rounded-2xl bg-gray-50 mb-4">
                    <Gift className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Pick items from the left to start building.</p>
                  </div>
                ) : (
                  <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                    <AnimatePresence>
                      {products.filter(p => picked[p.id]).map(p => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="flex items-center gap-3 p-2 rounded-xl bg-gray-50"
                        >
                          <div className="w-10 h-10 rounded-lg bg-white overflow-hidden shrink-0">
                            {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{p.name}</p>
                            <p className="text-xs text-gray-500">× {picked[p.id]}</p>
                          </div>
                          <p className="text-xs font-black text-orange-600 shrink-0">
                            {formatPrice((p.discountPrice ?? p.price) * picked[p.id])}
                          </p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <div className="space-y-3 mb-4">
                  <input
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="Recipient name (optional)"
                    maxLength={60}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-100"
                    style={{ border: '1px solid #e5e7eb' }}
                  />
                  <textarea
                    value={giftMessage}
                    onChange={e => setGiftMessage(e.target.value.slice(0, 200))}
                    placeholder="Gift message (optional, ≤200 chars)"
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 resize-none"
                    style={{ border: '1px solid #e5e7eb' }}
                  />
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Items</span><span>{totalCount}</span>
                  </div>
                  <div className="flex justify-between text-xs text-green-600 font-bold">
                    <span>Bundle discount</span><span>-5%</span>
                  </div>
                  <div className="flex justify-between font-black text-lg pt-2">
                    <span className="text-gray-900">Total</span>
                    <span className="text-orange-600">{formatPrice(totalPrice)}</span>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={totalCount < MIN_ITEMS}
                  className="w-full py-3.5 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
                >
                  {totalCount < MIN_ITEMS ? (
                    <>Pick {MIN_ITEMS - totalCount} more</>
                  ) : (
                    <><ShoppingBag className="w-4 h-4" /> Add Hamper to Cart</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
