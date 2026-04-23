import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useWishlist } from "@/context/WishlistContext";
import { useCartActions } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { type Product } from "@workspace/api-client-react";
import { Heart, ShoppingCart, ArrowRight, Trash2, X, Check } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";
import { formatPrice, getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const COLOR_MAP: Record<string, string> = {
  'Black': '#1a1a1a', 'White': '#f0f0f0', 'Grey': '#6b7280', 'Gray': '#6b7280',
  'Navy': '#1e3a5f', 'Olive': '#4a5240', 'Charcoal': '#374151', 'Maroon': '#7f1d1d',
  'Red': '#dc2626', 'Blue': '#1d4ed8', 'Cream': '#fef3c7', 'Khaki': '#a18b52',
  'Burgundy': '#6b1a2a', 'Brown': '#7c4a2b', 'Yellow': '#eab308', 'Green': '#16a34a',
  'Orange': '#ea580c', 'Pink': '#ec4899', 'Purple': '#7c3aed', 'Teal': '#0d9488',
};

function VariantPicker({ product, onClose, onAdd }: {
  product: Product;
  onClose: () => void;
  onAdd: (size?: string, color?: string) => void;
}) {
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  const sizes = product.sizes || [];
  const colors = product.colors || [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-sm rounded-3xl bg-white overflow-hidden"
        style={{ border: '1px solid #e5e7eb', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-black text-gray-900">Select Options</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
              {sizes.length > 0 && (
                <div>
                  <p className="font-bold text-sm text-gray-900 mb-2">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                        className="px-4 py-2 rounded-xl font-bold text-sm transition-all"
                        style={selectedSize === size ? {
                          background: 'linear-gradient(135deg, #E85D04, #FB8500)',
                          color: 'white',
                          border: '1px solid transparent',
                        } : {
                          background: 'white',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {colors.length > 0 && (
                <div>
                  <p className="font-bold text-sm text-gray-900 mb-2">
                    Color {selectedColor && <span className="text-orange-600 font-normal">· Selected: {selectedColor}</span>}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color === selectedColor ? "" : color)}
                        title={color}
                        className="relative"
                      >
                        <div
                          className="w-8 h-8 rounded-lg transition-all hover:scale-110"
                          style={{
                            background: COLOR_MAP[color] || '#aaa',
                            border: selectedColor === color
                              ? '3px solid #E85D04'
                              : color === 'White' ? '2px solid #d1d5db' : '2px solid transparent',
                            boxShadow: selectedColor === color ? '0 0 0 2px white, 0 0 0 4px #E85D04' : '0 1px 4px rgba(0,0,0,0.15)',
                          }}
                        />
                        {selectedColor === color && (
                          <Check className="absolute inset-0 m-auto w-3.5 h-3.5 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

          {((sizes.length > 0 && !selectedSize) || (colors.length > 0 && !selectedColor)) && (
              <p className="text-xs text-amber-600 font-medium text-center">Please select {sizes.length > 0 && !selectedSize ? 'a size' : ''}{sizes.length > 0 && !selectedSize && colors.length > 0 && !selectedColor ? ' and ' : ''}{colors.length > 0 && !selectedColor ? 'a color' : ''}</p>
          )}
          <button
            onClick={() => onAdd(selectedSize || undefined, selectedColor || undefined)}
            disabled={(sizes.length > 0 && !selectedSize) || (colors.length > 0 && !selectedColor)}
            className="w-full py-3 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
          >
            <ShoppingCart className="w-4 h-4" /> Add to Cart
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Wishlist() {
  const [, navigate] = useLocation();
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCartActions();
  const { toast } = useToast();
  const [pendingItem, setPendingItem] = useState<typeof items[0] | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  const handleAddToCart = async (item: typeof items[0]) => {
    try {
      const res = await fetch(getApiUrl(`/api/products/${item.id}`));
      if (!res.ok) throw new Error();
      const product: Product = await res.json();
      const hasVariants = (product.sizes && product.sizes.length > 0) || (product.colors && product.colors.length > 0);
      if (hasVariants) {
        setPendingItem(item);
        setPendingProduct(product);
      } else {
        addToCart({
          productId: item.id,
          name: item.name,
          price: item.discountPrice || item.price,
          quantity: 1,
          imageUrl: item.imageUrl || undefined,
        });
        toast({
          title: "✓ Added to cart!",
          description: item.name,
          action: (
            <ToastAction altText="Checkout now" onClick={() => navigate("/checkout")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap border-0"
              style={{ background: '#E85D04' }}>
              Checkout <ArrowRight className="w-3 h-3" />
            </ToastAction>
          ),
        });
      }
    } catch {
      toast({ title: "Could not load product options", description: "Please try again or add from the product page.", variant: "destructive" });
    }
  };

  const handleVariantConfirm = (size?: string, color?: string) => {
    if (!pendingItem) return;
    addToCart({
      productId: pendingItem.id,
      name: pendingItem.name,
      price: pendingItem.discountPrice || pendingItem.price,
      quantity: 1,
      imageUrl: pendingItem.imageUrl || undefined,
      size,
      color,
    });
    toast({
      title: "✓ Added to cart!",
      description: pendingItem.name,
      action: (
        <ToastAction altText="Checkout now" onClick={() => navigate("/checkout")}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap border-0"
          style={{ background: '#E85D04' }}>
          Checkout <ArrowRight className="w-3 h-3" />
        </ToastAction>
      ),
    });
    setPendingItem(null);
    setPendingProduct(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead title="My Wishlist" description="Your saved items at TryNex Lifestyle." noindex />
      <Navbar />
      <main className="flex-1 pt-header pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="mb-10">
            <span className="section-eyebrow mb-4">
              <Heart className="w-3 h-3" /> My Wishlist
            </span>
            <h1 className="text-4xl font-black font-display tracking-tight text-gray-900 mt-3">
              Saved Items <span className="text-gray-400 font-normal">({items.length})</span>
            </h1>
          </div>

          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 rounded-3xl"
              style={{ background: 'white', border: '1px dashed #e5e7eb' }}
            >
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 relative"
                style={{ background: 'linear-gradient(135deg, #fff1f0, #ffe4d6)', border: '2px solid #fed7c3' }}
              >
                <Heart className="w-11 h-11 text-orange-400" />
              </motion.div>
              <h3 className="text-2xl font-black font-display text-gray-800 mb-3">No saved items yet</h3>
              <p className="text-gray-400 mb-8 max-w-sm mx-auto">Tap the heart icon on any product to save it here for later.</p>
              <Link
                href="/products"
                className="btn-primary inline-flex items-center gap-2 active:scale-95 transition-transform"
              >
                Discover Products <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 group"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" width="300" height="300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">🛍️</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{item.name}</h3>
                      <div className="flex items-center gap-2 mb-4">
                        {item.discountPrice ? (
                          <>
                            <span className="font-black text-orange-600">{formatPrice(item.discountPrice)}</span>
                            <span className="text-sm line-through text-gray-400">{formatPrice(item.price)}</span>
                          </>
                        ) : (
                          <span className="font-black text-gray-900">{formatPrice(item.price)}</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
                        >
                          <ShoppingCart className="w-4 h-4" /> Add to Cart
                        </button>
                        <button
                          onClick={() => {
                            removeFromWishlist(item.id);
                            toast({ title: "Removed from wishlist", description: item.name });
                          }}
                          aria-label={`Remove ${item.name} from wishlist`}
                          className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-gray-200 btn-press"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {pendingProduct !== null && (
          <VariantPicker
            product={pendingProduct}
            onClose={() => { setPendingItem(null); setPendingProduct(null); }}
            onAdd={handleVariantConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
