import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ArrowLeft, ArrowRight, Search, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";
import { useListProducts } from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { ProductCardSkeleton } from "@/components/ui/skeleton";

export default function NotFound() {
  const { data: productsData, isLoading } = useListProducts({ limit: 4, featured: true });
  const products: Product[] = productsData?.products ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead title="Page Not Found | TryNex Lifestyle" noindex />
      <Navbar />
      <main className="flex-1 pt-header pb-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 sm:py-20"
          >
            <div className="w-24 h-24 rounded-3xl bg-orange-50 flex items-center justify-center mx-auto mb-6 border border-orange-100">
              <Search className="w-12 h-12 text-orange-400" aria-hidden="true" />
            </div>
            <h1 className="text-7xl font-black font-display tracking-tighter text-gray-900 mb-3">
              404
            </h1>
            <p className="text-2xl font-bold text-gray-600 mb-2">Page Not Found</p>
            <p className="text-gray-400 mb-10 leading-relaxed max-w-sm mx-auto">
              The page you're looking for doesn't exist or has been moved. Let's get you back on track.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-20">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white transition-all hover:-translate-y-0.5"
                style={{
                  background: "linear-gradient(135deg, #E85D04, #FB8500)",
                  boxShadow: "0 6px 24px rgba(232,93,4,0.35)",
                }}
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Go Home
              </Link>
              <Link
                href="/products"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-gray-700 bg-white border-2 border-gray-200 hover:border-orange-400 hover:text-orange-600 transition-all"
              >
                <Search className="w-4 h-4" aria-hidden="true" /> Browse All Products
              </Link>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                <RefreshCcw className="w-4 h-4" aria-hidden="true" /> Go Back
              </button>
            </div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            aria-labelledby="popular-products-heading"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1">While You're Here</p>
                <h2 id="popular-products-heading" className="text-2xl font-black font-display tracking-tight text-gray-900">
                  Popular Products
                </h2>
              </div>
              <Link
                href="/products"
                className="flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-600 transition-colors group"
              >
                View All <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Link>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" aria-label="Loading popular products" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {products.map((product, i) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.07 }}
                  >
                    <Link
                      href={`/product/${product.id}`}
                      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-orange-200 hover:shadow-lg transition-all"
                    >
                      <div className="aspect-[4/5] overflow-hidden bg-gray-50">
                        {product.images?.[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <Search className="w-8 h-8" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                        <p className="text-orange-500 font-black text-sm mt-1">{formatPrice(Number(product.price))}</p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : null}
          </motion.section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
