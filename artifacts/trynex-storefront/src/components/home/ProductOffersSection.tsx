import { motion } from "framer-motion";
import { ShoppingCart, Zap, Star, Package, Shield, Paintbrush, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";

const TRUST_ITEMS = [
  { icon: Paintbrush, label: "Free Editing" },
  { icon: Star, label: "HD Print" },
  { icon: Shield, label: "Safe Delivery" },
  { icon: Package, label: "Gift Wrapping" },
];

const cardVariant = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.55, ease: [0.23, 1, 0.32, 1] as number[] },
  }),
};

function SkeletonCard() {
  return (
    <div className="rounded-3xl border border-gray-100 bg-white overflow-hidden animate-pulse">
      <div className="p-5 space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-gray-100" />
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-8 bg-gray-100 rounded w-1/3 mt-4" />
        <div className="h-10 bg-gray-100 rounded-xl mt-2" />
      </div>
    </div>
  );
}

export function ProductOffersSection() {
  const { data, isLoading } = useListProducts({ limit: 20 });

  const products = (() => {
    const all = data?.products ?? [];
    const discounted = all
      .filter((p) => p.discountPrice && p.discountPrice < p.price)
      .sort((a, b) => {
        const savA = ((a.price - (a.discountPrice ?? a.price)) / a.price) * 100;
        const savB = ((b.price - (b.discountPrice ?? b.price)) / b.price) * 100;
        return savB - savA;
      });
    if (discounted.length >= 3) return discounted.slice(0, 9);
    return all.slice(0, 9);
  })();

  const getTag = (p: typeof products[number], rank: number) => {
    if (!p.discountPrice) return undefined;
    const pct = Math.round(((p.price - p.discountPrice) / p.price) * 100);
    if (rank === 0) return { label: "BEST DEAL", color: "#E85D04" };
    if (pct >= 30) return { label: `${pct}% OFF`, color: "#16a34a" };
    if (pct >= 15) return { label: "ON SALE", color: "#2563eb" };
    return undefined;
  };

  return (
    <section
      id="product-offers"
      className="py-20 px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #fff8f3 50%, #ffffff 100%)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(circle,#E85D04 1px,transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
            style={{ background: "#fff4ee", color: "#E85D04", border: "1.5px solid #fdd5b4" }}
          >
            <Zap className="w-4 h-4" /> Special Offers
          </div>
          <h2
            className="font-display font-black leading-tight text-gray-900 mb-3"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.03em" }}
          >
            Choose Your Perfect Gift 🎁
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Fully customized, premium quality — delivered to your door. Every gift tells a story.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-12"
        >
          {TRUST_ITEMS.map((t) => (
            <div
              key={t.label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "#fff4ee", color: "#E85D04", border: "1px solid #fdd5b4" }}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </div>
          ))}
        </motion.div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-orange-300" />
            <p className="text-sm font-semibold">Loading offers…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product, i) => {
              const isHighlight = i === 0;
              const hasDiscount = product.discountPrice && product.discountPrice < product.price;
              const savings = hasDiscount
                ? Math.round(product.price - (product.discountPrice ?? product.price))
                : 0;
              const discountPct = hasDiscount
                ? Math.round(((product.price - (product.discountPrice ?? product.price)) / product.price) * 100)
                : 0;
              const tag = getTag(product, i);

              return (
                <motion.div
                  key={product.id}
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={cardVariant}
                  whileHover={{ y: -4, transition: { duration: 0.25 } }}
                  className="relative flex flex-col rounded-3xl border overflow-hidden transition-shadow hover:shadow-2xl"
                  style={{
                    background: isHighlight
                      ? "linear-gradient(145deg, #fff8f3, #fff4ee)"
                      : "white",
                    borderColor: isHighlight ? "#fdd5b4" : "#f0ede8",
                    boxShadow: isHighlight
                      ? "0 4px 24px rgba(232,93,4,0.18), 0 1px 4px rgba(0,0,0,0.06)"
                      : "0 1px 6px rgba(0,0,0,0.05)",
                  }}
                >
                  {isHighlight && (
                    <div
                      className="absolute inset-0 rounded-3xl pointer-events-none"
                      style={{ border: "2px solid #E85D04", boxShadow: "inset 0 0 0 1px #fdd5b4" }}
                    />
                  )}

                  {tag && (
                    <div className="absolute top-3 right-3 z-10">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-wide"
                        style={{ background: tag.color }}
                      >
                        {tag.label}
                      </span>
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {product.imageUrl ? (
                      <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-gray-50">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    ) : (
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-3 shrink-0"
                        style={{ background: "linear-gradient(135deg,#fff4ee,#fde8d0)" }}
                        aria-hidden="true"
                      >
                        🎁
                      </div>
                    )}

                    <h3
                      className={`font-black text-gray-900 leading-tight mb-1 ${
                        isHighlight ? "text-lg" : "text-base"
                      }`}
                    >
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-auto">
                      {hasDiscount && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-gray-400 line-through font-medium">
                            {formatPrice(product.price)}
                          </span>
                          {savings > 0 && (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                              style={{ background: "#16a34a" }}
                            >
                              Save {formatPrice(savings)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex items-end gap-1 mb-4">
                        <span
                          className={`font-black leading-none ${isHighlight ? "text-4xl" : "text-3xl"}`}
                          style={{ color: "#E85D04" }}
                        >
                          {formatPrice(product.discountPrice ?? product.price)}
                        </span>
                      </div>

                      {isHighlight && savings > 0 && (
                        <div className="text-[11px] text-orange-700 font-bold mb-3 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-orange-500 text-orange-500" /> Best value
                          — save {formatPrice(savings)}!
                        </div>
                      )}

                      {discountPct > 0 && !isHighlight && (
                        <div className="text-[11px] text-green-700 font-bold mb-3 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {discountPct}% off today
                        </div>
                      )}

                      <Link
                        href={`/product/${product.id}`}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: isHighlight
                            ? "linear-gradient(135deg,#E85D04,#FB8500)"
                            : "linear-gradient(135deg,#f3f4f6,#e9eaec)",
                          color: isHighlight ? "white" : "#374151",
                          boxShadow: isHighlight ? "0 4px 14px rgba(232,93,4,0.35)" : "none",
                        }}
                      >
                        <ShoppingCart className="w-4 h-4" /> View Offer
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 py-5 px-6 rounded-2xl flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-semibold text-gray-600"
          style={{ background: "#f9fafb", border: "1px solid #e9e9e9" }}
        >
          {[
            "Free Image Editing Included",
            "Fully Customized Just for You",
            "We Accept Any Custom Request",
            "HD Print Quality Guaranteed",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              {t}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
