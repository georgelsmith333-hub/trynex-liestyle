import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { Gift, Sparkles, ArrowRight, Package, Heart } from "lucide-react";
import { motion } from "framer-motion";

interface HamperLite {
  id: number;
  slug: string;
  name: string;
  nameBn?: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  discountPrice?: number;
  occasion?: string;
  category?: string;
  items: Array<{ name: string; quantity: number; imageUrl?: string }>;
  featured?: boolean;
}

export default function Hampers() {
  const [hampers, setHampers] = useState<HamperLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(getApiUrl("/api/hampers"))
      .then(r => r.json())
      .then(d => setHampers(d.hampers || []))
      .catch(() => setHampers([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Gift Hampers • উপহার হ্যাম্পার"
        description="Premium curated gift hampers from Bangladesh's #1 lifestyle brand. Birthday, anniversary, corporate gifts, and build-your-own bundles — wrapped and delivered nationwide."
        canonical="/hampers"
        keywords="gift hampers bangladesh, gift box, corporate gift, birthday gift, anniversary gift, উপহার হ্যাম্পার"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trynexshop.com/" },
              { "@type": "ListItem", "position": 2, "name": "Gift Hampers", "item": "https://trynexshop.com/hampers" },
            ],
          },
          ...(hampers.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": "TryNex Gift Hampers",
            "itemListElement": hampers.slice(0, 20).map((h, i) => ({
              "@type": "ListItem",
              "position": i + 1,
              "url": `https://trynexshop.com/hampers/${h.slug}`,
              "name": h.name,
            })),
          }] : []),
        ]}
      />
      <Navbar />

      <main className="flex-1 pt-header pb-24">
        {/* Hero */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center pt-8 pb-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: 'rgba(232,93,4,0.08)', border: '1px solid rgba(232,93,4,0.2)' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-[11px] font-black uppercase tracking-widest text-orange-600">Curated for every occasion</span>
            </motion.div>
            <h1 className="text-4xl sm:text-6xl font-black font-display tracking-tighter text-gray-900 mb-3">
              Gift Hampers <span className="text-orange-500">•</span> উপহার হ্যাম্পার
            </h1>
            <p className="text-gray-500 text-base max-w-2xl mx-auto">
              Thoughtfully curated gift packages — or build your own. Wrapped, delivered, and ready to delight anywhere in Bangladesh.
            </p>
          </div>

          {/* Build Your Own CTA */}
          <Link href="/hampers/build">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="block mb-12 rounded-3xl p-6 sm:p-8 cursor-pointer group"
              style={{
                background: 'linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%)',
                border: '2px dashed rgba(232,93,4,0.35)',
              }}
            >
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 20px rgba(232,93,4,0.3)' }}>
                  <Package className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 mb-1">Build Your Own</p>
                  <h3 className="text-xl sm:text-2xl font-black font-display text-gray-900">Pick your perfect gift bundle</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Choose any 3+ products, add a gift message, we'll wrap it.</p>
                </div>
                <ArrowRight className="w-5 h-5 text-orange-500 shrink-0 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          </Link>

          {/* Hamper grid */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="rounded-3xl bg-gray-50 animate-pulse h-80" />
              ))}
            </div>
          ) : hampers.length === 0 ? (
            <div className="text-center py-16 rounded-3xl bg-gray-50 border border-dashed border-gray-200">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-semibold">No curated hampers yet — try Build Your Own above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {hampers.map((h, idx) => {
                const price = h.discountPrice ?? h.basePrice;
                const hasDiscount = !!h.discountPrice && h.discountPrice < h.basePrice;
                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Link href={`/hampers/${h.slug}`}>
                      <div className="group cursor-pointer rounded-3xl overflow-hidden bg-white hover:shadow-xl transition-all duration-300"
                        style={{ border: '1px solid #e5e7eb' }}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                          {h.imageUrl ? (
                            <img src={h.imageUrl} alt={`${h.name} gift hamper`}
                              width={600} height={450}
                              loading={idx < 3 ? "eager" : "lazy"}
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Gift className="w-16 h-16 text-orange-300" />
                            </div>
                          )}
                          {h.featured && (
                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
                              style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                              ⭐ Featured
                            </span>
                          )}
                          {h.occasion && (
                            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/95 text-gray-700">
                              {h.occasion}
                            </span>
                          )}
                        </div>
                        <div className="p-5">
                          <h3 className="font-black text-lg text-gray-900 leading-tight mb-1">{h.name}</h3>
                          {h.nameBn && <p className="text-xs text-gray-400 mb-2">{h.nameBn}</p>}
                          {h.description && (
                            <p className="text-sm text-gray-500 line-clamp-2 mb-3">{h.description}</p>
                          )}
                          <p className="text-xs font-semibold text-gray-400 mb-3">
                            {h.items.length} item{h.items.length === 1 ? '' : 's'} included
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="font-black text-2xl text-orange-600">{formatPrice(price)}</span>
                              {hasDiscount && (
                                <span className="text-sm text-gray-400 line-through">{formatPrice(h.basePrice)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs font-bold text-orange-500 group-hover:translate-x-1 transition-transform">
                              View <ArrowRight className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Trust strip */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Gift, label: 'Free Gift Wrap', sub: 'Premium packaging included' },
              { icon: Heart, label: 'Personal Message', sub: 'Up to 200 characters' },
              { icon: Package, label: 'Nationwide Delivery', sub: 'All 64 districts' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shrink-0">
                  <f.icon className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900">{f.label}</p>
                  <p className="text-xs text-gray-500">{f.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
