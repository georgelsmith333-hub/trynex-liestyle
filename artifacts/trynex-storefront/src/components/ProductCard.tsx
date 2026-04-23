import { useLocation } from "wouter";
  import { ShoppingCart, Star, Heart, Check, Eye, ArrowRight, MessageCircle, Flame } from "lucide-react";
  import { formatPrice } from "@/lib/utils";
  import type { Product } from "@workspace/api-client-react";
  import { motion, AnimatePresence } from "framer-motion";
  import { useCartActions } from "@/context/CartContext";
  import { useWishlist } from "@/context/WishlistContext";
  import { useSiteSettings } from "@/context/SiteSettingsContext";
  import { useToast } from "@/hooks/use-toast";
  import { ToastAction } from "@/components/ui/toast";
  import { useState, useRef, useCallback, useEffect } from "react";
  import { cn } from "@/lib/utils";

  interface ProductCardProps {
    product: Product;
    index?: number;
  }

  const COLOR_MAP: Record<string, string> = {
    'Black': '#1a1a1a', 'White': '#f0f0f0', 'Grey': '#6b7280', 'Gray': '#6b7280',
    'Navy': '#1e3a5f', 'Olive': '#4a5240', 'Charcoal': '#374151', 'Maroon': '#7f1d1d',
    'Red': '#dc2626', 'Blue': '#1d4ed8', 'Cream': '#fef3c7', 'Khaki': '#a18b52',
    'Burgundy': '#6b1a2a', 'Brown': '#7c4a2b', 'Yellow': '#eab308', 'Green': '#16a34a',
    'Orange': '#ea580c', 'Pink': '#ec4899', 'Purple': '#7c3aed', 'Teal': '#0d9488',
    'Sky Blue': '#0ea5e9', 'Lime': '#84cc16', 'Coral': '#f97316', 'Indigo': '#6366f1',
  };

  export function ProductCard({ product, index = 0 }: ProductCardProps) {
    const [, navigate] = useLocation();
    const { addToCart } = useCartActions();
    const { toggleWishlist, isWishlisted } = useWishlist();
    const { toast } = useToast();
    const { scarcityThreshold } = useSiteSettings();
    const [isAdding, setIsAdding] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0, glare: { x: 50, y: 50 } });
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

    // Track mobile breakpoint correctly
    useEffect(() => {
      const check = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', check, { passive: true });
      return () => window.removeEventListener('resize', check);
    }, []);

    const price = parseFloat(String(product.price)) || 0;
    const discountPrice = product.discountPrice ? parseFloat(String(product.discountPrice)) : null;
    const discount = discountPrice
      ? Math.round(((price - discountPrice) / price) * 100)
      : 0;

    const rating = product.rating ? parseFloat(String(product.rating)) : 4.9;
    const wishlisted = isWishlisted(product.id);
    const isLowStock = product.stock > 0 && product.stock <= (scarcityThreshold || 10);

    // Build WhatsApp order URL
    const whatsappNumber = "8801903426915";
    const whatsappMsg = encodeURIComponent(
      `Hello TryNex! I want to order:\n*${product.name}*\nPrice: ${formatPrice(discountPrice || price)}\nProduct link: https://trynexshop.com/product/${product.id}`
    );
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotateX = ((y - cy) / cy) * -8;
      const rotateY = ((x - cx) / cx) * 8;
      setTilt({
        x: rotateX,
        y: rotateY,
        glare: { x: (x / rect.width) * 100, y: (y / rect.height) * 100 },
      });
    }, [isMobile]);

    const handleMouseLeave = useCallback(() => {
      setHovered(false);
      setTilt({ x: 0, y: 0, glare: { x: 50, y: 50 } });
    }, []);

    const handleQuickAdd = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isAdding || product.stock === 0) return;
      setIsAdding(true);
      addToCart({
        productId: product.id,
        name: product.name,
        price: discountPrice || price,
        quantity: 1,
        imageUrl: product.imageUrl ?? undefined,
      });
      toast({
        title: "✓ Added to bag",
        description: product.name,
        action: (
          <ToastAction altText="Checkout now" onClick={() => navigate("/checkout")}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap border-0"
            style={{ background: '#E85D04' }}>
            Checkout <ArrowRight className="w-3 h-3" />
          </ToastAction>
        ),
      });
      setTimeout(() => setIsAdding(false), 1400);
    };

    const handleWishlist = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleWishlist({
        id: product.id,
        name: product.name,
        price: price,
        discountPrice: discountPrice ?? undefined,
        imageUrl: product.imageUrl ?? undefined,
      });
    };

    const goToDetail = () => navigate(`/product/${product.id}`);

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1, margin: "0px 0px -10% 0px" }}
        transition={{ duration: 0.35, delay: Math.min(index, 6) * 0.04, ease: [0.22, 1, 0.36, 1] }}
        style={{ perspective: '800px' }}
        className="h-full"
      >
        <div
          ref={cardRef}
          onMouseEnter={() => setHovered(true)}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={goToDetail}
          className="rounded-2xl overflow-hidden group cursor-pointer select-none bg-white relative h-full flex flex-col"
          style={{
            border: hovered ? '1.5px solid #fbd5b4' : '1.5px solid #f0e8e0',
            boxShadow: hovered
              ? '0 20px 60px rgba(232,93,4,0.15), 0 8px 24px rgba(0,0,0,0.1)'
              : '0 2px 12px rgba(0,0,0,0.05)',
            transform: hovered && !isMobile
              ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(4px)`
              : 'rotateX(0deg) rotateY(0deg)',
            transition: hovered ? 'transform 0.1s ease, box-shadow 0.3s ease, border-color 0.3s ease' : 'all 0.5s cubic-bezier(0.22,1,0.36,1)',
            willChange: 'transform',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Glare overlay */}
          {hovered && !isMobile && (
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl z-30"
              style={{
                background: `radial-gradient(circle at ${tilt.glare.x}% ${tilt.glare.y}%, rgba(255,255,255,0.18) 0%, transparent 60%)`,
                mixBlendMode: 'screen',
              }}
            />
          )}

          {/* Image */}
          <div className="relative aspect-[4/5] overflow-hidden" style={{ background: '#f9f5f2', aspectRatio: '4/5' }}>
            {product.imageUrl ? (
              <>
                {!imgLoaded && (
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 to-gray-200" aria-hidden="true" />
                )}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  width={400}
                  height={500}
                  loading={index < 4 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "auto"}
                  onLoad={() => setImgLoaded(true)}
                  className="w-full h-full object-cover"
                  style={{
                    opacity: imgLoaded ? 1 : 0,
                    transform: hovered ? 'scale(1.06)' : 'scale(1)',
                    transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1), opacity 0.25s ease',
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                <ShoppingCart className="w-16 h-16 text-orange-300" aria-hidden="true" />
              </div>
            )}

            {/* Discount / Stock Badges */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-1.5">
              {discount > 0 && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 2px 8px rgba(232,93,4,0.4)' }}>
                  -{discount}%
                </span>
              )}
              {isLowStock && (
                <motion.span
                  animate={{ scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-700 flex items-center gap-1"
                  style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)' }}>
                  <span className="live-dot bg-amber-500" />
                  Only {product.stock} left!
                </motion.span>
              )}
              {product.stock === 0 && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-red-600"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Sold Out
                </span>
              )}
            </div>

            {/* Wishlist — larger touch target (40px) with heart-pop animation */}
            <motion.button
              onClick={handleWishlist}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              aria-pressed={wishlisted}
              className="absolute top-3 right-3 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 overflow-visible"
              style={{
                background: wishlisted ? '#fff1f0' : 'rgba(255,255,255,0.92)',
                border: wishlisted ? '1.5px solid #fecaca' : '1px solid rgba(0,0,0,0.08)',
                backdropFilter: 'blur(8px)',
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* Radiating burst when adding to wishlist */}
              <AnimatePresence>
                {wishlisted && (
                  <motion.span
                    key="burst"
                    initial={{ scale: 0, opacity: 0.7 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ background: 'radial-gradient(circle, #E85D04 0%, transparent 70%)' }}
                    aria-hidden="true"
                  />
                )}
              </AnimatePresence>
              {/* Heart with spring-bounce on toggle */}
              <motion.span
                key={wishlisted ? "filled" : "empty"}
                initial={{ scale: wishlisted ? 0.4 : 1 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 600, damping: 14 }}
                className="relative z-10 flex items-center justify-center"
              >
                <Heart className="w-4 h-4 transition-colors duration-200"
                  style={{ color: wishlisted ? '#E85D04' : '#9ca3af', fill: wishlisted ? '#E85D04' : 'none' }} />
              </motion.span>
            </motion.button>

            {/* Quick view — desktop hover */}
            <AnimatePresence>
              {!isMobile && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-3 left-3 right-3 z-20"
                >
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); goToDetail(); }}
                    className="w-full py-2 rounded-xl font-bold text-sm text-gray-700 flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    <Eye className="w-3.5 h-3.5" /> Quick View
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Product Info */}
          <div className="p-3 sm:p-4 flex-1 flex flex-col">
            {/* Rating */}
            <div className="flex items-center gap-1 mb-1.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <Star key={j} className="w-3 h-3"
                  style={{ fill: j < Math.floor(rating) ? '#FB8500' : '#e5e7eb', color: j < Math.floor(rating) ? '#FB8500' : '#e5e7eb' }} />
              ))}
              <span className="text-xs text-gray-400 ml-1 font-semibold">{rating}</span>
              {discount > 0 && (
                <span className="ml-auto savings-badge">Save {discount}%</span>
              )}
            </div>

            {/* Name */}
            <h3 className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
              {product.name}
            </h3>

            {/* Color dots */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scroll-snap-x pb-0.5">
                {product.colors.slice(0, 6).map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full shrink-0 transition-transform hover:scale-125 scroll-snap-item"
                    style={{
                      background: COLOR_MAP[color] || '#ccc',
                      border: color === 'White' ? '1.5px solid #d1d5db' : '1.5px solid rgba(0,0,0,0.1)',
                    }}
                    title={color}
                  />
                ))}
                {product.colors.length > 6 && (
                  <span className="text-[10px] text-gray-400 font-semibold shrink-0">+{product.colors.length - 6}</span>
                )}
              </div>
            )}

            {/* Price + Cart — anchored to bottom so all cards in a row line up */}
            <div className="flex items-center justify-between gap-2 mt-auto">
              <div className="flex items-baseline gap-1.5 min-w-0">
                {discountPrice ? (
                  <>
                    <span className="font-black text-orange-600 text-base">{formatPrice(discountPrice)}</span>
                    <span className="text-xs line-through text-gray-400 shrink-0">{formatPrice(price)}</span>
                  </>
                ) : (
                  <span className="font-black text-gray-900 text-base">{formatPrice(price)}</span>
                )}
              </div>

              {/* Desktop cart button */}
              {!isMobile && (
                <motion.button
                  onClick={handleQuickAdd}
                  disabled={product.stock === 0}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Add to cart"
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  style={{
                    background: isAdding ? 'rgba(22,163,74,0.1)' : 'linear-gradient(135deg, #E85D04, #FB8500)',
                    border: isAdding ? '1px solid rgba(22,163,74,0.3)' : 'none',
                    boxShadow: isAdding ? 'none' : '0 2px 8px rgba(232,93,4,0.3)',
                    color: isAdding ? '#16a34a' : 'white',
                  }}
                >
                  {isAdding ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                </motion.button>
              )}
            </div>

            {/* Mobile: full-width Add to Bag button */}
            {isMobile && (
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <motion.button
                  onClick={handleQuickAdd}
                  disabled={product.stock === 0}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-1.5 active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: isAdding ? 'rgba(22,163,74,0.12)' : 'linear-gradient(135deg, #E85D04, #FB8500)',
                    border: isAdding ? '1px solid rgba(22,163,74,0.3)' : 'none',
                    boxShadow: isAdding ? 'none' : '0 3px 12px rgba(232,93,4,0.3)',
                    color: isAdding ? '#16a34a' : 'white',
                    minHeight: '44px',
                  }}
                >
                  {isAdding ? (
                    <><Check className="w-4 h-4" /> Added!</>
                  ) : product.stock === 0 ? (
                    'Sold Out'
                  ) : (
                    <><ShoppingCart className="w-4 h-4" /> Add to Bag</>
                  )}
                </motion.button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Order via WhatsApp"
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-95"
                  style={{ background: '#25D366', boxShadow: '0 2px 8px rgba(37,211,102,0.3)', minHeight: '44px' }}
                >
                  <MessageCircle className="w-5 h-5 text-white" />
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
  