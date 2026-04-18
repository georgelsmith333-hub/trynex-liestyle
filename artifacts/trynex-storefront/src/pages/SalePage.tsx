import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { Zap, Clock, Shield, Truck, Star, ChevronRight } from "lucide-react";
import { useListProducts } from "@workspace/api-client-react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { formatPrice } from "@/lib/utils";
import { trackViewContent } from "@/lib/tracking";

function SaleCountdown({ endTime }: { endTime: string }) {
  const [left, setLeft] = useState({ h: 0, m: 0, s: 0, expired: false });

  useEffect(() => {
    if (!endTime) return;
    const end = new Date(endTime).getTime();
    if (isNaN(end)) return;

    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setLeft({ h: 0, m: 0, s: 0, expired: true });
        return;
      }
      setLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        expired: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  if (left.expired) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Clock className="w-4 h-4 text-yellow-400" />
      <span className="text-white/80 text-sm font-semibold">Offer ends in:</span>
      {[left.h, left.m, left.s].map((val, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 text-white font-mono font-black text-xl min-w-[2.75rem] text-center">
            {pad(val)}
          </span>
          {i < 2 && <span className="text-white/50 font-black text-xl">:</span>}
        </span>
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: any }) {
  const price = product.discountPrice ? parseFloat(product.discountPrice) : parseFloat(product.price);
  const originalPrice = parseFloat(product.price);
  const hasDiscount = product.discountPrice && price < originalPrice;
  const discountPct = hasDiscount ? Math.round(100 - (price / originalPrice) * 100) : 0;
  const isLowStock = product.stock > 0 && product.stock <= 5;

  return (
    <Link href={`/product/${product.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 cursor-pointer hover:shadow-2xl transition-shadow"
      >
        <div className="relative overflow-hidden aspect-square bg-gray-50">
          <img
            src={product.imageUrl || product.images?.[0] || "https://placehold.co/400x400?text=Product"}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          {hasDiscount && (
            <div className="absolute top-3 left-3">
              <span className="bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
                -{discountPct}% OFF
              </span>
            </div>
          )}
          {isLowStock && (
            <div className="absolute bottom-0 left-0 right-0 bg-amber-500/90 text-white text-xs font-bold py-1.5 text-center">
              Only {product.stock} left — Order now!
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-900 text-sm font-black px-4 py-2 rounded-xl">Sold Out</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-center gap-1 mb-1.5">
            {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />)}
            <span className="text-xs text-gray-400 ml-1">({20 + (product.id % 60)} reviews)</span>
          </div>
          <h3 className="font-bold text-gray-900 mb-3 leading-tight">{product.name}</h3>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl font-black" style={{ color: "#E85D04" }}>{formatPrice(price)}</span>
            {hasDiscount && <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>}
          </div>

          <div
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-white text-sm"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
          >
            <ChevronRight className="w-4 h-4" /> View Deal
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export default function SalePage() {
  const {
    flashSaleEnabled, flashSaleEndTime,
    salePageTitle, salePageSubtitle, salePageBadge,
    freeShippingThreshold,
  } = useSiteSettings();
  const [location] = useLocation();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const categoryParam = params.get("category") || "";
  const limitParam = Math.min(parseInt(params.get("limit") || "3", 10), 6);

  const { data } = useListProducts({ limit: limitParam, featured: true, ...(categoryParam ? { category: categoryParam } : {}) });
  const products = (data?.products || []).slice(0, limitParam || 3);

  useEffect(() => {
    if (products.length > 0) {
      products.forEach(p => {
        const price = p.discountPrice ? parseFloat(p.discountPrice) : parseFloat(p.price);
        trackViewContent({ id: p.id, name: p.name, price, category: p.category });
      });
    }
  }, [products.length]);

  const hasCountdown = flashSaleEnabled && !!flashSaleEndTime && !isNaN(new Date(flashSaleEndTime).getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <div
        className="relative overflow-hidden text-white py-20 px-4"
        style={{ background: "linear-gradient(135deg, #c44b02 0%, #E85D04 45%, #FB8500 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)",
          backgroundSize: "36px 36px"
        }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full px-4 py-1.5 text-sm font-bold mb-5"
          >
            <Zap className="w-4 h-4 fill-yellow-300 text-yellow-300" />
            {salePageBadge || "LIMITED TIME"}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black font-display mb-4 leading-tight"
          >
            {salePageTitle || "Mega Sale — Up to 50% Off!"}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/85 text-lg max-w-xl mx-auto"
          >
            {salePageSubtitle || "Bangladesh's best custom apparel at unbeatable prices."}
          </motion.p>

          {hasCountdown && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              <SaleCountdown endTime={flashSaleEndTime} />
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-6 mt-6 text-sm text-white/80"
          >
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> 100% Secure</span>
            <span className="flex items-center gap-1.5"><Truck className="w-4 h-4" /> Free over ৳{freeShippingThreshold}</span>
            <span className="flex items-center gap-1.5"><Star className="w-4 h-4" /> 5,000+ Happy Customers</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8"
          >
            <a
              href="#products"
              className="inline-flex items-center gap-2 bg-white font-black px-8 py-4 rounded-xl shadow-lg transition-transform active:scale-[0.98] text-sm"
              style={{ color: "#E85D04" }}
            >
              Shop the Sale <ChevronRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </div>

      <div id="products" className="max-w-4xl mx-auto px-4 py-12">
        {products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">Sale products coming soon</p>
          </div>
        ) : (
          <div className={`grid gap-6 ${products.length === 1 ? "max-w-sm mx-auto" : products.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center mt-8">Free shipping above ৳{freeShippingThreshold} • Nationwide delivery • COD available</p>
      </div>

      <div className="bg-white border-t border-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-green-500" /> 100% secure checkout</span>
          <span className="flex items-center gap-2"><Truck className="w-4 h-4 text-blue-500" /> All 64 districts of Bangladesh</span>
          <span className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" /> Premium 230-320GSM fabric</span>
        </div>
      </div>
    </div>
  );
}
