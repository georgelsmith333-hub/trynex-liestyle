import { motion } from "framer-motion";
import { ShoppingCart, Zap, Star, Package, Shield, Paintbrush } from "lucide-react";
import { Link } from "wouter";

interface OfferProduct {
  id: number;
  title: string;
  emoji: string;
  desc: string;
  regularPrice?: number;
  offerPrice: number;
  savings?: number;
  tag?: string;
  tagColor?: string;
  highlight?: boolean;
}

const PRODUCTS: OfferProduct[] = [
  {
    id: 1,
    title: "General Mug",
    emoji: "☕",
    desc: "Fully Customized Just for You",
    offerPrice: 600,
  },
  {
    id: 2,
    title: "Love Shape Mug",
    emoji: "💝",
    desc: "Small Gift, Big Smiles 😊",
    offerPrice: 690,
    tag: "Romantic",
    tagColor: "#e1306c",
  },
  {
    id: 3,
    title: "Water Bottle",
    emoji: "🍶",
    desc: "Free Image Editing Included",
    offerPrice: 650,
  },
  {
    id: 4,
    title: "2 General Mugs",
    emoji: "☕☕",
    desc: "Perfect for couples or gifting",
    regularPrice: 1200,
    offerPrice: 899,
    savings: 301,
    tag: "Popular",
    tagColor: "#2563eb",
  },
  {
    id: 5,
    title: "1 General + 1 Love Mug",
    emoji: "☕💝",
    desc: "We Accept Any Custom Request",
    regularPrice: 1290,
    offerPrice: 1170,
    savings: 120,
  },
  {
    id: 6,
    title: "2 Water Bottles",
    emoji: "🍶🍶",
    desc: "Auto discount applied",
    regularPrice: 1300,
    offerPrice: 1100,
    savings: 200,
    tag: "Deal",
    tagColor: "#16a34a",
  },
  {
    id: 7,
    title: "Mega Combo Pack",
    emoji: "🎁",
    desc: "1 General Mug + 1 Love Mug + 1 Water Bottle",
    regularPrice: 1940,
    offerPrice: 1390,
    savings: 550,
    tag: "BEST VALUE",
    tagColor: "#E85D04",
    highlight: true,
  },
];

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
    transition: { delay: i * 0.07, duration: 0.55, ease: [0.23, 1, 0.32, 1] },
  }),
};

export function ProductOffersSection() {
  return (
    <section id="product-offers" className="py-20 px-4 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #ffffff 0%, #fff8f3 50%, #ffffff 100%)" }}>

      {/* Subtle background pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "radial-gradient(circle,#E85D04 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="max-w-7xl mx-auto relative z-10">

        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-4"
            style={{ background: "#fff4ee", color: "#E85D04", border: "1.5px solid #fdd5b4" }}>
            <Zap className="w-4 h-4" /> Special Offers
          </div>
          <h2 className="font-display font-black leading-tight text-gray-900 mb-3"
            style={{ fontSize: "clamp(1.8rem, 4vw, 2.8rem)", letterSpacing: "-0.03em" }}>
            Choose Your Perfect Gift 🎁
          </h2>
          <p className="text-gray-500 text-base max-w-xl mx-auto">
            Fully customized, premium quality — delivered to your door. Every gift tells a story.
          </p>
        </motion.div>

        {/* Trust Bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-12"
        >
          {TRUST_ITEMS.map((t) => (
            <div key={t.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "#fff4ee", color: "#E85D04", border: "1px solid #fdd5b4" }}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </div>
          ))}
        </motion.div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {PRODUCTS.map((product, i) => (
            <motion.div
              key={product.id}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={cardVariant}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className={`relative flex flex-col rounded-3xl border overflow-hidden transition-shadow hover:shadow-2xl ${product.highlight ? "lg:col-span-1 xl:col-span-1" : ""}`}
              style={{
                background: product.highlight ? "linear-gradient(145deg, #fff8f3, #fff4ee)" : "white",
                borderColor: product.highlight ? "#fdd5b4" : "#f0ede8",
                boxShadow: product.highlight
                  ? "0 4px 24px rgba(232,93,4,0.18), 0 1px 4px rgba(0,0,0,0.06)"
                  : "0 1px 6px rgba(0,0,0,0.05)",
              }}
            >
              {/* Highlight ring */}
              {product.highlight && (
                <div className="absolute inset-0 rounded-3xl pointer-events-none"
                  style={{ border: "2px solid #E85D04", boxShadow: "inset 0 0 0 1px #fdd5b4" }} />
              )}

              {/* Tag */}
              {product.tag && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-wide"
                    style={{ background: product.tagColor }}>
                    {product.tag}
                  </span>
                </div>
              )}

              <div className="p-5 flex flex-col flex-1">
                {/* Emoji */}
                <div className={`text-4xl mb-3 ${product.highlight ? "text-5xl" : ""}`} aria-hidden="true">{product.emoji}</div>

                {/* Title & Desc */}
                <h3 className={`font-black text-gray-900 leading-tight mb-1 ${product.highlight ? "text-lg" : "text-base"}`}>
                  {product.title}
                </h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">{product.desc}</p>

                {/* Price Block */}
                <div className="mt-auto">
                  {product.regularPrice && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-gray-400 line-through font-medium">৳{product.regularPrice.toLocaleString()}</span>
                      {product.savings && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                          style={{ background: "#16a34a" }}>
                          Save ৳{product.savings}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-end gap-1 mb-4">
                    <span className={`font-black leading-none ${product.highlight ? "text-4xl" : "text-3xl"}`}
                      style={{ color: "#E85D04" }}>
                      ৳{product.offerPrice.toLocaleString()}
                    </span>
                    <span className="text-xs text-gray-400 mb-1">Tk</span>
                  </div>

                  {/* Microcopy */}
                  {product.highlight && (
                    <div className="text-[11px] text-orange-700 font-bold mb-3 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-orange-500 text-orange-500" /> Best value — save ৳{product.savings}!
                    </div>
                  )}

                  {/* CTA */}
                  <Link href="/design-studio"
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: product.highlight
                        ? "linear-gradient(135deg,#E85D04,#FB8500)"
                        : "linear-gradient(135deg,#f3f4f6,#e9eaec)",
                      color: product.highlight ? "white" : "#374151",
                      boxShadow: product.highlight ? "0 4px 14px rgba(232,93,4,0.35)" : "none",
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" /> Order Now
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom trust bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 py-5 px-6 rounded-2xl flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm font-semibold text-gray-600"
          style={{ background: "#f9fafb", border: "1px solid #e9e9e9" }}
        >
          {["Free Image Editing Included", "Fully Customized Just for You", "We Accept Any Custom Request", "HD Print Quality Guaranteed"].map((t) => (
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
