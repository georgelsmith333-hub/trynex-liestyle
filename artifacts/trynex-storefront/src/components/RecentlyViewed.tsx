import { Link } from "wouter";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function RecentlyViewed() {
  const { items } = useRecentlyViewed();

  if (items.length === 0) return null;

  return (
    <section className="py-16 px-4" style={{ background: '#FAFAFA' }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(232,93,4,0.06)', border: '1px solid rgba(232,93,4,0.12)' }}>
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-orange-600 font-bold text-xs uppercase tracking-widest">Recently Viewed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-display text-gray-800">Continue Where You Left Off</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.slice(0, 4).map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link href={`/product/${item.id}`}>
                <div className="group bg-white rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
                  style={{ border: '1px solid #f0f0f0', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div className="aspect-square overflow-hidden bg-gray-50" style={{ aspectRatio: '1/1' }}>
                    <img
                      src={item.imageUrl?.startsWith('http') ? item.imageUrl : (item.imageUrl ? getApiUrl(item.imageUrl) : '')}
                      alt={item.name}
                      width={400}
                      height={400}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-xs sm:text-sm font-bold text-gray-800 line-clamp-1">{item.name}</h3>
                    <p className="text-sm sm:text-base font-black mt-1" style={{ color: '#E85D04' }}>
                      {formatPrice(item.price)}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link href="/products"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
            style={{ background: 'rgba(232,93,4,0.06)', color: '#E85D04', border: '1px solid rgba(232,93,4,0.15)' }}>
            View All Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
