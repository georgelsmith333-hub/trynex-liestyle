import { motion } from "framer-motion";
import { ShoppingCart, Zap, Star, Package, Shield, Paintbrush } from "lucide-react";
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

interface DisplayProduct {
  id: string | number;
  name: string;
  emoji?: string;
  imageUrl?: string | null;
  description?: string | null;
  price: number;
  discountPrice?: number | null;
  tag?: string;
  tagColor?: string;
  highlight?: boolean;
  href: string;
}

const SHOWCASE_PRODUCTS: DisplayProduct[] = [
  {
    id: "s1",
    name: "General Mug",
    emoji: "☕",
    description: "Fully Customized Just for You",
    price: 600,
    href: "/design-studio",
  },
  {
    id: "s2",
    name: "Love Shape Mug",
    emoji: "💝",
    description: "Small Gift, Big Smiles 😊",
    price: 690,
    tag: "Romantic",
    tagColor: "#e1306c",
    href: "/design-studio",
  },
  {
    id: "s3",
    name: "Water Bottle",
    emoji: "🍶",
    description: "Free Image Editing Included",
    price: 650,
    href: "/design-studio",
  },
  {
    id: "s4",
    name: "2 General Mugs",
    emoji: "☕☕",
    description: "Perfect for couples or gifting",
    price: 1200,
    discountPrice: 899,
    tag: "Popular",
    tagColor: "#2563eb",
    href: "/design-studio",
  },
  {
    id: "s5",
    name: "1 General + 1 Love Mug",
    emoji: "☕💝",
    description: "We Accept Any Custom Request",
    price: 1290,
    discountPrice: 1170,
    href: "/design-studio",
  },
  {
    id: "s6",
    name: "2 Water Bottles",
    emoji: "🍶🍶",
    description: "Auto discount applied",
    price: 1300,
    discountPrice: 1100,
    tag: "Deal",
    tagColor: "#16a34a",
    href: "/design-studio",
  },
  {
    id: "s7",
    name: "Mega Combo Pack",
    emoji: "🎁",
    description: "1 General Mug + 1 Love Mug + 1 Water Bottle",
    price: 1940,
    discountPrice: 1390,
    tag: "BEST VALUE",
    tagColor: "#E85D04",
    highlight: true,
    href: "/design-studio",
  },
];

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

export function ProductOffersSection({ fullPage = false }: { fullPage?: boolean }) {
  const { data, isLoading } = useListProducts({ limit: 20 });

  const liveProducts: DisplayProduct[] = (() => {
    const all = data?.products ?? [];
    const specialOfferTagged = all.filter((p) => {
      const tags: string[] = Array.isArray(p.tags) ? (p.tags as unknown as string[]) : [];
      return tags.includes("special-offer");
    });
    const discounted = all
      .filter((p) => p.discountPrice && p.discountPrice < p.price)
      .sort((a, b) => {
        const savA = ((a.price - (a.discountPrice ?? a.price)) / a.price) * 100;
        const savB = ((b.price - (b.discountPrice ?? b.price)) / b.price) * 100;
        return savB - savA;
      });
    const merged = [...specialOfferTagged, ...discounted.filter(p => {
      const tags: string[] = Array.isArray(p.tags) ? (p.tags as unknown as string[]) : [];
      return !tags.includes("special-offer");
    })];
    const source = merged.length >= 3 ? merged : (discounted.length >= 3 ? discounted : all);
    return source.slice(0, 9).map((p, i) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
      description: p.description,
      price: p.price,
      discountPrice: p.discountPrice,
      highlight: i === 0,
      tag: (() => {
        if (!p.discountPrice) return undefined;
        const pct = Math.round(((p.price - p.discountPrice) / p.price) * 100);
        if (i === 0) return "BEST DEAL";
        if (pct >= 30) return `${pct}% OFF`;
        if (pct >= 15) return "ON SALE";
        return undefined;
      })(),
      tagColor: (() => {
        if (!p.discountPrice) return undefined;
        const pct = Math.round(((p.price - p.discountPrice) / p.price) * 100);
        if (i === 0) return "#E85D04";
        if (pct >= 30) return "#16a34a";
        return "#2563eb";
      })(),
      href: `/product/${p.id}`,
    }));
  })();

  const products: DisplayProduct[] =
    !isLoading && liveProducts.length > 0 ? liveProducts : SHOWCASE_PRODUCTS;

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product, i) => {
              const isHighlight = !!product.highlight;
              const hasDiscount =
                product.discountPrice != null && product.discountPrice < product.price;
              const savings = hasDiscount
                ? Math.round(product.price - (product.discountPrice ?? product.price))
                : 0;
              const discountPct = hasDiscount
                ? Math.round(
                    ((product.price - (product.discountPrice ?? product.price)) / product.price) *
                      100,
                  )
                : 0;

              return (
                <motion.div
                  key={String(product.id)}
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

                  {product.tag && (
                    <div className="absolute top-3 right-3 z-10">
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-wide"
                        style={{ background: product.tagColor ?? "#E85D04" }}
                      >
                        {product.tag}
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
                        className={`${isHighlight ? "text-5xl" : "text-4xl"} mb-3`}
                        aria-hidden="true"
                      >
                        {product.emoji ?? "🎁"}
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
                            ৳{product.price.toLocaleString()}
                          </span>
                          {savings > 0 && (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                              style={{ background: "#16a34a" }}
                            >
                              Save ৳{savings.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-end gap-1 mb-4">
                        <span
                          className={`font-black leading-none ${isHighlight ? "text-4xl" : "text-3xl"}`}
                          style={{ color: "#E85D04" }}
                        >
                          ৳{(product.discountPrice ?? product.price).toLocaleString()}
                        </span>
                        <span className="text-xs text-gray-400 mb-1">Tk</span>
                      </div>

                      {isHighlight && savings > 0 && (
                        <div className="text-[11px] text-orange-700 font-bold mb-3 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-orange-500 text-orange-500" /> Best value
                          — save ৳{savings.toLocaleString()}!
                        </div>
                      )}

                      {discountPct > 0 && !isHighlight && (
                        <div className="text-[11px] text-green-700 font-bold mb-3 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> {discountPct}% off today
                        </div>
                      )}

                      <Link
                        href={product.href}
                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: isHighlight
                            ? "linear-gradient(135deg,#E85D04,#FB8500)"
                            : "linear-gradient(135deg,#f3f4f6,#e9eaec)",
                          color: isHighlight ? "white" : "#374151",
                          boxShadow: isHighlight ? "0 4px 14px rgba(232,93,4,0.35)" : "none",
                        }}
                      >
                        <ShoppingCart className="w-4 h-4" /> Order Now
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
