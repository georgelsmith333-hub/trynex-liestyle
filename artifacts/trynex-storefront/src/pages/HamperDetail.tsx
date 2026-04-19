import { useEffect, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useCartActions } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { Gift, ShoppingBag, Heart, ArrowLeft, Check } from "lucide-react";
import { motion } from "framer-motion";

interface Hamper {
  id: number;
  slug: string;
  name: string;
  nameBn?: string;
  description?: string;
  descriptionBn?: string;
  imageUrl?: string;
  images?: string[];
  basePrice: number;
  discountPrice?: number;
  occasion?: string;
  items: Array<{ name: string; quantity: number; imageUrl?: string; productId?: number }>;
}

export default function HamperDetail() {
  const [, params] = useRoute("/hampers/:slug");
  const [, setLocation] = useLocation();
  const { addToCart } = useCartActions();
  const { toast } = useToast();
  const [hamper, setHamper] = useState<Hamper | null>(null);
  const [loading, setLoading] = useState(true);
  const [recipientName, setRecipientName] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [related, setRelated] = useState<Hamper[]>([]);

  useEffect(() => {
    if (!params?.slug) return;
    setLoading(true);
    fetch(getApiUrl(`/api/hampers/${params.slug}`))
      .then(r => r.ok ? r.json() : null)
      .then(d => setHamper(d))
      .catch(() => setHamper(null))
      .finally(() => setLoading(false));
    fetch(getApiUrl("/api/hampers"))
      .then(r => r.json())
      .then(d => setRelated((d.hampers || []).filter((h: Hamper) => h.slug !== params.slug).slice(0, 3)))
      .catch(() => {});
  }, [params?.slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-1 pt-header pb-24 max-w-7xl mx-auto px-4 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-8">
            <div className="aspect-square rounded-3xl bg-gray-100 animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 bg-gray-100 rounded animate-pulse w-2/3" />
              <div className="h-32 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!hamper) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-1 pt-header pb-24 flex items-center justify-center">
          <div className="text-center">
            <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h1 className="text-2xl font-black mb-2 text-gray-900">Hamper not found</h1>
            <Link href="/hampers" className="text-orange-600 font-bold hover:underline">← Back to Hampers</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const price = hamper.discountPrice ?? hamper.basePrice;
  const hasDiscount = !!hamper.discountPrice && hamper.discountPrice < hamper.basePrice;

  const handleAddToCart = () => {
    if (giftMessage.length > 200) {
      toast({ title: "Gift message too long", description: "Please keep it under 200 characters.", variant: "destructive" });
      return;
    }
    addToCart({
      productId: 0,
      name: hamper.name,
      price,
      quantity: 1,
      imageUrl: hamper.imageUrl,
      hamperPayload: {
        hamperId: hamper.id,
        hamperSlug: hamper.slug,
        hamperName: hamper.name,
        items: hamper.items,
        giftMessage: giftMessage.trim() || undefined,
        recipientName: recipientName.trim() || undefined,
      },
    });
    toast({ title: "Hamper added to cart!", description: hamper.name });
    setLocation("/cart");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title={`${hamper.name} | Gift Hamper`}
        description={hamper.description || `Premium ${hamper.name} gift hamper from TryNex Lifestyle Bangladesh — beautifully wrapped, delivered nationwide.`}
        canonical={`/hampers/${hamper.slug}`}
        ogImage={hamper.imageUrl}
        ogType="product"
        keywords={`${hamper.name}, gift hamper bangladesh, ${hamper.occasion || 'gift'} hamper, corporate gift bd`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": hamper.name,
            "description": hamper.description || `Premium ${hamper.name} gift hamper from TryNex Lifestyle.`,
            "image": hamper.imageUrl || "",
            "sku": `hamper-${hamper.id}`,
            "brand": { "@type": "Brand", "name": "TryNex Lifestyle" },
            "category": "Gift Hamper",
            "offers": {
              "@type": "Offer",
              "priceCurrency": "BDT",
              "price": price,
              "availability": "https://schema.org/InStock",
              "seller": { "@type": "Organization", "name": "TryNex Lifestyle" },
              "url": `https://trynexshop.com/hampers/${hamper.slug}`,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trynexshop.com/" },
              { "@type": "ListItem", "position": 2, "name": "Gift Hampers", "item": "https://trynexshop.com/hampers" },
              { "@type": "ListItem", "position": 3, "name": hamper.name, "item": `https://trynexshop.com/hampers/${hamper.slug}` },
            ],
          },
        ]}
      />
      <Navbar />

      <main className="flex-1 pt-header pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/hampers" className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-orange-600 transition-colors mb-6 mt-4">
            <ArrowLeft className="w-3.5 h-3.5" /> All Hampers
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Image */}
            <div>
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="aspect-square rounded-3xl overflow-hidden bg-gray-50"
                style={{ border: '1px solid #e5e7eb' }}
              >
                {hamper.imageUrl ? (
                  <img
                    src={hamper.imageUrl}
                    alt={`${hamper.name} — premium gift hamper from TryNex Lifestyle`}
                    className="w-full h-full object-cover"
                    width={800}
                    height={800}
                    fetchPriority="high"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="w-32 h-32 text-orange-300" />
                  </div>
                )}
              </motion.div>
            </div>

            {/* Info */}
            <div>
              {hamper.occasion && (
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-500 mb-2">{hamper.occasion}</p>
              )}
              <h1 className="text-3xl sm:text-5xl font-black font-display tracking-tighter text-gray-900 mb-1">{hamper.name}</h1>
              {hamper.nameBn && <p className="text-lg text-gray-500 mb-3">{hamper.nameBn}</p>}
              {hamper.description && <p className="text-gray-500 leading-relaxed mb-6">{hamper.description}</p>}

              <div className="flex items-baseline gap-3 mb-6">
                <span className="font-black text-4xl text-orange-600">{formatPrice(price)}</span>
                {hasDiscount && (
                  <span className="text-lg text-gray-400 line-through">{formatPrice(hamper.basePrice)}</span>
                )}
                {hasDiscount && (
                  <span className="px-2 py-0.5 rounded-md text-xs font-black bg-green-100 text-green-700">
                    SAVE {formatPrice(hamper.basePrice - price)}
                  </span>
                )}
              </div>

              {/* Contents */}
              <div className="rounded-2xl p-5 mb-6 bg-gray-50 border border-gray-100">
                <h3 className="font-black text-sm uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-orange-500" /> What's inside
                </h3>
                <ul className="space-y-2">
                  {hamper.items.map((item, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-orange-600" />
                      </div>
                      <span className="font-semibold text-gray-700">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-gray-400">× {item.quantity}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Gift personalization */}
              <div className="rounded-2xl p-5 mb-6 border border-orange-200" style={{ background: 'rgba(232,93,4,0.04)' }}>
                <h3 className="font-black text-sm uppercase tracking-wider text-orange-700 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4" /> Personalize this gift
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1.5">Recipient name (optional)</label>
                    <input
                      type="text"
                      inputMode="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      enterKeyHint="next"
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Ayesha"
                      maxLength={60}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                      style={{ border: '1px solid #e5e7eb' }}
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-600 mb-1.5">
                      <span>Gift message (optional)</span>
                      <span className={giftMessage.length > 200 ? 'text-red-500' : 'text-gray-400'}>{giftMessage.length}/200</span>
                    </label>
                    <textarea
                      autoCapitalize="sentences"
                      enterKeyHint="done"
                      value={giftMessage}
                      onChange={e => setGiftMessage(e.target.value.slice(0, 200))}
                      placeholder="Happy Birthday! শুভ জন্মদিন!"
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 resize-none"
                      style={{ border: '1px solid #e5e7eb' }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                className="w-full py-4 rounded-2xl font-bold text-white flex items-center justify-center gap-2 text-base"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.35)' }}
              >
                <ShoppingBag className="w-5 h-5" /> Add Gift Hamper to Cart
              </button>
            </div>
          </div>

          {/* Customers also gifted */}
          {related.length > 0 && (
            <div className="mt-20">
              <h2 className="text-2xl font-black font-display text-gray-900 mb-2">Customers also gifted</h2>
              <p className="text-sm text-gray-500 mb-6">More curated bundles people love</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {related.map(r => (
                  <Link key={r.id} href={`/hampers/${r.slug}`}>
                    <div className="group cursor-pointer rounded-2xl overflow-hidden bg-white border border-gray-200 hover:shadow-md transition-all">
                      <div className="aspect-[4/3] bg-gray-50 overflow-hidden">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><Gift className="w-12 h-12 text-orange-300" /></div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="font-black text-sm text-gray-900 truncate">{r.name}</p>
                        <p className="font-black text-orange-600 mt-1">{formatPrice(r.discountPrice ?? r.basePrice)}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
