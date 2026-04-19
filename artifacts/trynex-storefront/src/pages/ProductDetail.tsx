import { useParams, Link, useLocation } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Loader } from "@/components/ui/Loader";
import { useGetProduct, useListProducts } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { formatPrice, cn, getApiUrl } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useCartActions } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { trackViewContent } from "@/lib/tracking";
import { ViewerCount } from "@/components/ViewerCount";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import {
  Minus, Plus, ShoppingBag, ShieldCheck, Truck, Star, Search,
  RotateCcw, ArrowLeft, ArrowRight, Check, Heart, Share2, Ruler, MessageCircle, Sparkles,
  Upload, Image as ImageIcon, X as XIcon, ZoomIn
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useCallback } from "react";

const COLOR_MAP: Record<string, string> = {
  'Black': '#1a1a1a', 'White': '#f0f0f0', 'Grey': '#6b7280', 'Gray': '#6b7280',
  'Navy': '#1e3a5f', 'Olive': '#4a5240', 'Charcoal': '#374151', 'Maroon': '#7f1d1d',
  'Red': '#dc2626', 'Blue': '#1d4ed8', 'Cream': '#fef3c7', 'Khaki': '#a18b52',
  'Burgundy': '#6b1a2a', 'Brown': '#7c4a2b', 'Yellow': '#eab308', 'Green': '#16a34a',
  'Orange': '#ea580c', 'Pink': '#ec4899', 'Purple': '#7c3aed', 'Teal': '#0d9488',
  'Sky Blue': '#0ea5e9', 'Lime': '#84cc16', 'Coral': '#f97316', 'Indigo': '#6366f1',
};

const SIZE_GUIDE = [
  { size: "S", chest: "36-38", length: "27", sleeve: "32" },
  { size: "M", chest: "38-40", length: "28", sleeve: "33" },
  { size: "L", chest: "40-42", length: "29", sleeve: "34" },
  { size: "XL", chest: "42-44", length: "30", sleeve: "35" },
  { size: "2XL", chest: "44-46", length: "31", sleeve: "36" },
  { size: "3XL", chest: "46-48", length: "32", sleeve: "37" },
];

const REVIEW_SAMPLES = [
  { name: "Rakib H.", rating: 5, text: "Amazing quality! The print is sharp and fabric is premium. Delivery was super fast.", date: "2 days ago", location: "Dhaka" },
  { name: "Priya M.", rating: 5, text: "Exactly what I ordered. The color is vibrant and the stitching is perfect.", date: "1 week ago", location: "Chittagong" },
  { name: "Tanvir A.", rating: 4, text: "Good quality product. Would recommend TryNex to everyone!", date: "2 weeks ago", location: "Sylhet" },
];

function ReviewsSection({ productId, rating }: { productId: number; rating: number }) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitName, setSubmitName] = useState("");
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitRating, setSubmitRating] = useState(5);
  const [submitText, setSubmitText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const fetchReviews = async () => {
    try {
      const res = await fetch(getApiUrl(`/api/reviews/${productId}`));
      const data = await res.json();
      setReviews(data.reviews || []);
      setStats(data.stats || null);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, [productId]);

  const handleSubmitReview = async () => {
    if (!submitName || !submitEmail || !submitRating) return;
    setSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/reviews"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, customerName: submitName, customerEmail: submitEmail, rating: submitRating, text: submitText }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.message || "Failed", variant: "destructive" }); return; }
      toast({ title: "Review submitted!", description: "It will appear once approved by our team." });
      setShowForm(false);
      setSubmitName(""); setSubmitEmail(""); setSubmitRating(5); setSubmitText("");
    } catch { toast({ title: "Failed to submit", variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const avg = stats?.average || rating;
  const total = stats?.total || 0;

  return (
    <motion.div key="reviews" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
      <div className="flex items-center gap-8 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="text-center">
          <div className="text-5xl font-black text-gray-900">{avg}</div>
          <div className="flex justify-center mt-2">
            {Array.from({ length: 5 }).map((_, j) => (
              <Star key={j} className="w-4 h-4" style={{ fill: j < Math.floor(avg) ? '#FB8500' : '#e5e7eb', color: j < Math.floor(avg) ? '#FB8500' : '#e5e7eb' }} />
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">{total} review{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((s) => {
            const count = stats?.distribution?.[s] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-500 w-4">{s}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#FB8500' }} />
                </div>
                <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl font-bold text-sm border-2 border-dashed border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all">
          Write a Review
        </button>
      ) : (
        <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm space-y-4">
          <h4 className="font-black text-gray-900">Write Your Review</h4>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} type="button" onClick={() => setSubmitRating(s)}>
                <Star className="w-6 h-6" style={{ fill: s <= submitRating ? '#FB8500' : '#e5e7eb', color: s <= submitRating ? '#FB8500' : '#e5e7eb' }} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Your name *" value={submitName} onChange={e => setSubmitName(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="email" placeholder="Your email *" value={submitEmail} onChange={e => setSubmitEmail(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <textarea placeholder="Share your experience (optional)" rows={3} value={submitText} onChange={e => setSubmitText(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-semibold text-sm text-gray-500">Cancel</button>
            <button type="button" onClick={handleSubmitReview} disabled={submitting || !submitName || !submitEmail}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
              {submitting ? "Submitting..." : "Submit Review"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading reviews...</div>
      ) : reviews.length > 0 ? reviews.map((review: any, i: number) => (
        <motion.div key={review.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                {review.customerName?.[0] || "?"}
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                  {review.customerName}
                  {review.verified && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-bold border border-green-100">Verified</span>}
                </p>
                <p className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex">
              {Array.from({ length: review.rating }).map((_: any, j: number) => (
                <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          {review.text && <p className="text-sm text-gray-600 leading-relaxed">{review.text}</p>}
        </motion.div>
      )) : (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">No reviews yet. Be the first to review this product!</p>
        </div>
      )}

      {REVIEW_SAMPLES.length > 0 && reviews.length === 0 && (
        <>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-6">Sample Reviews</p>
          {REVIEW_SAMPLES.map((review, i) => (
            <div key={`sample-${i}`} className="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm opacity-60">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                    {review.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{review.name}</p>
                    <p className="text-xs text-gray-400">{review.location} · {review.date}</p>
                  </div>
                </div>
                <div className="flex">
                  {Array.from({ length: review.rating }).map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{review.text}</p>
            </div>
          ))}
        </>
      )}
    </motion.div>
  );
}

function compressAndConvertToBase64(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ProductDetail() {
  const { id } = useParams();
  const numericId = Number(id);
  const isNumeric = !isNaN(numericId) && numericId > 0;
  const isSlug = !isNumeric && !!id && id.length > 0;

  const { data: productFromHook, isLoading: hookLoading, error: hookError } = useGetProduct(isNumeric ? numericId : 0, {
    query: { enabled: isNumeric, retry: 2, staleTime: 30000 } as any
  });

  const [slugProduct, setSlugProduct] = useState<any>(null);
  const [slugLoading, setSlugLoading] = useState(isSlug);
  const [slugError, setSlugError] = useState(false);

  useEffect(() => {
    if (!isSlug) return;
    setSlugLoading(true);
    setSlugError(false);
    fetch(getApiUrl(`/api/products/${encodeURIComponent(id!)}`))
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => setSlugProduct(data))
      .catch(() => setSlugError(true))
      .finally(() => setSlugLoading(false));
  }, [id, isSlug]);

  const product = isNumeric ? productFromHook : slugProduct;
  const isLoading = isNumeric ? hookLoading : slugLoading;
  const error = isNumeric ? hookError : slugError;
  const productId = product?.id ?? numericId;
  const isValidId = isNumeric || isSlug;

  const { data: relatedData } = useListProducts(
    { limit: 4, categoryId: product?.categoryId || undefined },
    { query: { enabled: !!product, staleTime: 60000 } as any }
  );
  const relatedProducts = (relatedData?.products || []).filter(p => p.id !== productId).slice(0, 4);

  const [, navigate] = useLocation();
  const { addToCart } = useCartActions();
  const { toggleWishlist, isWishlisted } = useWishlist();
  const { toast } = useToast();
  const settings = useSiteSettings();
  const { addProduct: trackRecentlyViewed } = useRecentlyViewed();
  const whatsappNum = (settings.whatsappNumber?.replace(/[^0-9]/g, '') || '8801903426915');

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [customNote, setCustomNote] = useState("");
  const [customImages, setCustomImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [addedToBag, setAddedToBag] = useState(false);
  const [activeImage, setActiveImage] = useState<string>("");
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "reviews">("details");
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleImageMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  }, []);

  useEffect(() => {
    if (!product || product.stock < 1) return;
    const setOffset = () => {
      const isMobile = window.innerWidth < 768;
      document.documentElement.style.setProperty('--mobile-sticky-offset', isMobile ? '76px' : '0px');
    };
    setOffset();
    window.addEventListener('resize', setOffset, { passive: true });
    return () => {
      window.removeEventListener('resize', setOffset);
      document.documentElement.style.setProperty('--mobile-sticky-offset', '0px');
    };
  }, [product?.id, product?.stock]);

  useEffect(() => {
    setActiveImage("");
    setQuantity(1);
    setSelectedSize("");
    setSelectedColor("");
    setCustomNote("");
    setCustomImages([]);
    if (product) {
      trackViewContent({
        id: product.id,
        name: product.name,
        price: product.discountPrice || product.price,
      });
      trackRecentlyViewed({
        id: product.id,
        name: product.name,
        slug: product.slug || String(product.id),
        price: product.discountPrice || product.price,
        imageUrl: product.imageUrl || '',
      });
    }
  }, [product?.id]);

  if (isLoading) return <Loader fullScreen />;

  const NotFound = (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-20">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-4xl font-black font-display tracking-tight text-gray-900 mb-3">Product Not Found</h2>
          <p className="text-gray-500 mb-8 max-w-sm mx-auto">This product may have been removed or the link is incorrect.</p>
          <Link href="/products" className="btn-primary inline-flex">
            <ArrowLeft className="w-5 h-5" /> Browse All Products
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );

  if (!isValidId || error || !product) return NotFound;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadingImage(true);
    let successCount = 0;
    try {
      for (const file of fileArray) {
        if (file.size > 15 * 1024 * 1024) {
          toast({ title: "File too large", description: `${file.name} exceeds 15MB. Please use a smaller image.`, variant: "destructive" });
          continue;
        }
        if (!file.type.startsWith("image/")) {
          toast({ title: "Invalid file type", description: `${file.name} is not an image. Please upload PNG, JPG, or SVG.`, variant: "destructive" });
          continue;
        }
        try {
          const compressed = await compressAndConvertToBase64(file);
          setCustomImages(prev => [...prev, compressed]);
          successCount++;
        } catch {
          toast({ title: "Could not process image", description: `${file.name} could not be loaded. Please try a different image.`, variant: "destructive" });
        }
      }
      if (successCount > 0) {
        toast({ title: `${successCount} image${successCount > 1 ? 's' : ''} attached!`, description: "Your design reference has been added to the order." });
      }
    } catch {
      toast({ title: "Upload failed", description: "Something went wrong. Please try selecting the image again.", variant: "destructive" });
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddToCart = () => {
    if (product.stock < 1) return;
    const itemPrice = product.discountPrice || product.price;
    addToCart({
      productId: product.id,
      name: product.name,
      price: itemPrice,
      quantity,
      imageUrl: displayImage || product.imageUrl,
      size: selectedSize || undefined,
      color: selectedColor || undefined,
      customNote: customNote || undefined,
      customImages: customImages.length > 0 ? customImages : undefined,
    });
    setAddedToBag(true);
    toast({
      title: "✓ Added to cart!",
      description: `${product.name} × ${quantity}`,
      action: (
        <ToastAction altText="Checkout now" onClick={() => navigate("/checkout")}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white whitespace-nowrap border-0"
          style={{ background: '#E85D04' }}>
          Checkout <ArrowRight className="w-3 h-3" />
        </ToastAction>
      ),
    });
    setTimeout(() => setAddedToBag(false), 2000);
  };

  const discount = product.discountPrice
    ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
    : 0;

  const displayImage = activeImage || product.imageUrl || "";
  const wishlisted = isWishlisted(product.id);
  const rating = product.rating ? parseFloat(String(product.rating)) : 4.9;

  const handleShare = async () => {
    try {
      await navigator.share({ title: product.name, url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copied!", description: "Share it with your friends." });
    }
  };

  const handleWhatsAppOrder = () => {
    const itemPrice = product.discountPrice || product.price;
    const totalPrice = itemPrice * quantity;
    const lines = [
      `Assalamu Alaikum, TryNex!`,
      ``,
      `I'd like to place an order:`,
      ``,
      `🛍️ *Product:* ${product.name}`,
      `💰 *Price:* ${formatPrice(itemPrice)}${product.discountPrice ? ` (was ${formatPrice(product.price)})` : ``}`,
      `📦 *Quantity:* ${quantity}`,
      `💵 *Total:* ${formatPrice(totalPrice)}`,
    ];
    if (selectedSize) lines.push(`📏 *Size:* ${selectedSize}`);
    if (selectedColor) lines.push(`🎨 *Color:* ${selectedColor}`);
    if (customNote) lines.push(`✏️ *Custom Note:* ${customNote}`);
    lines.push(``);
    lines.push(`🔗 *Product Link:* ${window.location.href}`);
    lines.push(``);
    lines.push(`Please confirm availability and delivery details. Thank you!`);
    const msg = lines.join('\n');
    let waNum = whatsappNum.replace(/^(\+?88)+/, '');
    waNum = '88' + waNum;
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <SEOHead
        title={product.name}
        description={product.description || `Buy ${product.name} from TryNex Lifestyle. Premium quality, fast delivery across Bangladesh.`}
        canonical={`/product/${product.id}`}
        ogImage={product.imageUrl || undefined}
        ogType="product"
        keywords={`${product.name}, buy ${product.name} bangladesh, trynex ${product.name}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": product.name,
            "description": product.description || `Premium ${product.name} from TryNex Lifestyle`,
            "image": product.imageUrl || "",
            "sku": String(product.id),
            "brand": { "@type": "Brand", "name": "TryNex Lifestyle" },
            "offers": {
              "@type": "Offer",
              "priceCurrency": "BDT",
              "price": product.discountPrice || product.price,
              "availability": product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              "seller": { "@type": "Organization", "name": "TryNex Lifestyle" },
              "url": `https://trynexshop.com/product/${product.id}`,
            },
            ...(product.reviewCount && product.reviewCount > 0 ? {
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": rating,
                "reviewCount": product.reviewCount,
              },
            } : {}),
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trynexshop.com/" },
              { "@type": "ListItem", "position": 2, "name": "Shop", "item": "https://trynexshop.com/products" },
              { "@type": "ListItem", "position": 3, "name": product.name, "item": `https://trynexshop.com/product/${product.id}` },
            ],
          },
        ]}
      />
      <Navbar />

      <main className="flex-1 pt-header pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mb-4 sm:mb-8 font-medium">
            <Link href="/" className="hover:text-orange-600 transition-colors">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-orange-600 transition-colors">Shop</Link>
            <span>/</span>
            <span className="text-gray-700 line-clamp-1">{product.name}</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12">
            {/* Images */}
            <div className="space-y-4">
              <motion.div
                ref={imageContainerRef}
                className="relative aspect-square rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm group cursor-zoom-in hidden md:block"
                layoutId={`product-image-${product.id}`}
                onMouseEnter={() => setZoomActive(true)}
                onMouseLeave={() => setZoomActive(false)}
                onMouseMove={handleImageMouseMove}
                style={zoomActive && displayImage ? {
                  cursor: 'zoom-in',
                } : undefined}
              >
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={`${product.name} — TryNex Lifestyle`}
                    className="w-full h-full object-cover transition-transform duration-300"
                    width={800}
                    height={800}
                    {...({ fetchpriority: 'high' } as any)}
                    decoding="async"
                    style={zoomActive ? {
                      transform: 'scale(2)',
                      transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                    } : undefined}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                    <ShoppingBag className="w-24 h-24 text-orange-300" />
                  </div>
                )}
                {discount > 0 && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl font-black text-white text-sm pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                    -{discount}% OFF
                  </div>
                )}
                {product.stock > 0 && product.stock <= (settings.scarcityThreshold || 10) && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl font-bold text-amber-700 text-xs pointer-events-none"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
                    Only {product.stock} left!
                  </div>
                )}
                {!zoomActive && displayImage && (
                  <div className="absolute bottom-4 right-4 px-2.5 py-1.5 rounded-lg bg-black/50 text-white text-xs font-semibold flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <ZoomIn className="w-3.5 h-3.5" /> Hover to zoom
                  </div>
                )}
                {(() => {
                  const rawImages = [product.imageUrl, ...(product.images || [])].filter(Boolean) as string[];
                  const allImages = [...new Set(rawImages)];
                  if (allImages.length <= 1 || zoomActive) return null;
                  const activeIdx = Math.max(0, activeImage ? allImages.indexOf(activeImage) : 0);
                  const goPrev = (e: React.MouseEvent) => { e.stopPropagation(); setActiveImage(allImages[(activeIdx - 1 + allImages.length) % allImages.length]); };
                  const goNext = (e: React.MouseEvent) => { e.stopPropagation(); setActiveImage(allImages[(activeIdx + 1) % allImages.length]); };
                  return (
                    <>
                      <button onClick={goPrev} aria-label="Previous image"
                        className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 hover:bg-white border border-gray-200 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-105 active:scale-95">
                        <ArrowLeft className="w-4 h-4 text-gray-700" />
                      </button>
                      <button onClick={goNext} aria-label="Next image"
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/90 hover:bg-white border border-gray-200 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-105 active:scale-95">
                        <ArrowRight className="w-4 h-4 text-gray-700" />
                      </button>
                      <span className="absolute bottom-4 left-4 z-10 px-2.5 py-1 rounded-full text-[11px] font-bold bg-black/55 text-white backdrop-blur-sm pointer-events-none">
                        {activeIdx + 1} / {allImages.length}
                      </span>
                    </>
                  );
                })()}
              </motion.div>

              <motion.div
                className="relative aspect-square rounded-3xl overflow-hidden bg-white border border-gray-100 shadow-sm md:hidden"
                layoutId={`product-image-mobile-${product.id}`}
              >
                {displayImage ? (
                  <img
                    src={displayImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    width="600"
                    height="600"
                    fetchPriority="high"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
                    <ShoppingBag className="w-24 h-24 text-orange-300" />
                  </div>
                )}
                {discount > 0 && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl font-black text-white text-sm"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                    -{discount}% OFF
                  </div>
                )}
                {product.stock > 0 && product.stock <= (settings.scarcityThreshold || 10) && (
                  <div className="absolute top-4 right-4 px-3 py-1.5 rounded-xl font-bold text-amber-700 text-xs"
                    style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.4)' }}>
                    Only {product.stock} left!
                  </div>
                )}
              </motion.div>

              {(() => {
                const rawImages = [product.imageUrl, ...(product.images || [])].filter(Boolean) as string[];
                const allImages = [...new Set(rawImages)];
                if (allImages.length <= 1) return null;
                const activeIdx = Math.max(0, activeImage ? allImages.indexOf(activeImage) : 0);
                return (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scroll-snap-x">
                    {allImages.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImage(img)}
                        aria-label={`View image ${idx + 1}`}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 transition-all scroll-snap-item"
                        style={{
                          border: idx === activeIdx ? '3px solid #E85D04' : '2px solid #e5e7eb',
                          opacity: idx === activeIdx ? 1 : 0.6,
                          transform: idx === activeIdx ? 'scale(1.05)' : 'scale(1)',
                        }}
                      >
                        <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" width="80" height="80" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Product Info */}
            <div>
              {/* Category + Actions */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-black uppercase tracking-widest text-orange-500">
                  {product.customizable ? "✨ Customizable" : "Ready Made"}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleWishlist({ id: product.id, name: product.name, price: product.price, discountPrice: product.discountPrice, imageUrl: product.imageUrl })}
                    className="p-2.5 rounded-xl transition-all"
                    style={{
                      background: wishlisted ? '#fff1f0' : '#f9fafb',
                      border: `1px solid ${wishlisted ? '#fecaca' : '#e5e7eb'}`
                    }}
                  >
                    <Heart className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem', color: wishlisted ? '#E85D04' : '#9ca3af', fill: wishlisted ? '#E85D04' : 'none' }} />
                  </button>
                  <button
                    onClick={handleShare}
                    className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 transition-all"
                  >
                    <Share2 className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
                  </button>
                </div>
              </div>

              <h1 className="text-3xl font-black font-display tracking-tight text-gray-900 mb-4 leading-tight">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="w-4 h-4"
                      style={{ fill: j < Math.floor(rating) ? '#FB8500' : '#e5e7eb', color: j < Math.floor(rating) ? '#FB8500' : '#e5e7eb' }} />
                  ))}
                </div>
                <span className="font-bold text-sm text-gray-700">{rating}</span>
                <span className="text-sm text-gray-400">(128 reviews)</span>
              </div>

              {/* Price */}
              <div className="mb-8 p-5 rounded-2xl" style={{ background: '#fff8f5', border: '1px solid #fde4d0' }}>
                <div className="flex items-baseline gap-4 mb-2">
                  {product.discountPrice ? (
                    <>
                      <span className="text-4xl font-black text-orange-600">{formatPrice(product.discountPrice)}</span>
                      <span className="text-xl line-through text-gray-400">{formatPrice(product.price)}</span>
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black text-white"
                        style={{ background: '#E85D04' }}>Save {discount}%</span>
                    </>
                  ) : (
                    <span className="text-4xl font-black text-gray-900">{formatPrice(product.price)}</span>
                  )}
                </div>
                <ViewerCount productId={product.id} />
              </div>

              {/* Sizes */}
              {product.sizes && product.sizes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-gray-900 text-sm">Size</p>
                    <button
                      onClick={() => setShowSizeGuide(!showSizeGuide)}
                      className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
                    >
                      <Ruler className="w-3.5 h-3.5" /> Size Guide
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size === selectedSize ? "" : size)}
                        className={cn(
                          "px-4 py-2.5 rounded-xl font-bold text-sm transition-all",
                          selectedSize === size
                            ? "text-white shadow-md"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-orange-400 hover:text-orange-600"
                        )}
                        style={selectedSize === size ? {
                          background: 'linear-gradient(135deg, #E85D04, #FB8500)',
                          border: '1px solid transparent',
                          boxShadow: '0 4px 12px rgba(232,93,4,0.3)'
                        } : undefined}
                      >
                        {size}
                      </button>
                    ))}
                  </div>

                  {/* Size Guide Table */}
                  <AnimatePresence>
                    {showSizeGuide && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden mt-4"
                      >
                        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
                          <p className="font-bold text-sm text-gray-900 mb-3">Size Chart (inches)</p>
                          <table className="w-full text-xs text-center">
                            <thead>
                              <tr className="border-b border-gray-100">
                                {["Size", "Chest", "Length", "Sleeve"].map(h => (
                                  <th key={h} className="py-2 font-black text-gray-500 uppercase tracking-wider">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {SIZE_GUIDE.map((row, i) => (
                                <tr key={row.size} className={cn("border-b border-gray-50", i % 2 === 0 ? "bg-gray-50" : "bg-white")}>
                                  <td className="py-2 font-black text-orange-600">{row.size}</td>
                                  <td className="py-2 text-gray-600">{row.chest}</td>
                                  <td className="py-2 text-gray-600">{row.length}</td>
                                  <td className="py-2 text-gray-600">{row.sleeve}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Colors */}
              {product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <p className="font-bold text-gray-900 text-sm mb-3">
                    Color {selectedColor && <span className="text-orange-600 font-normal">— {selectedColor}</span>}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((color, colorIdx) => (
                      <button
                        key={color}
                        onClick={() => {
                          const isDeselect = color === selectedColor;
                          setSelectedColor(isDeselect ? "" : color);
                          const allImages = [product.imageUrl, ...(product.images || [])].filter(Boolean) as string[];
                          if (!isDeselect && allImages.length > 1 && colorIdx < allImages.length) {
                            setActiveImage(allImages[colorIdx]);
                          } else if (isDeselect) {
                            setActiveImage("");
                          }
                        }}
                        title={color}
                        className="relative"
                      >
                        <div
                          className="w-9 h-9 rounded-xl transition-all hover:scale-110"
                          style={{
                            background: COLOR_MAP[color] || '#aaa',
                            border: selectedColor === color
                              ? '3px solid #E85D04'
                              : color === 'White' ? '2px solid #d1d5db' : '2px solid transparent',
                            boxShadow: selectedColor === color ? '0 0 0 2px white, 0 0 0 4px #E85D04' : '0 2px 6px rgba(0,0,0,0.15)',
                          }}
                        />
                        {selectedColor === color && (
                          <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {product.customizable && (
                <div className="mb-6 space-y-4">
                  <label className="block font-bold text-gray-900 text-sm mb-2">
                    <Sparkles className="inline w-4 h-4 mr-1.5 text-orange-500" />
                    Customize Your Design
                  </label>

                  <textarea
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Describe your design idea, text, placement, or any instructions..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl text-sm font-medium focus:outline-none bg-white border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none text-gray-800 placeholder-gray-400"
                  />

                  <div className="p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 transition-colors"
                    style={{ background: '#fffaf5' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <ImageIcon className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="font-bold text-sm text-gray-900">Upload Design / Logo</p>
                        <p className="text-xs text-gray-400">PNG, JPG, or SVG — Max 10MB each</p>
                      </div>
                    </div>
                    <label className={cn(
                      "flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold cursor-pointer transition-all",
                      uploadingImage
                        ? "bg-gray-100 text-gray-400 cursor-wait"
                        : "bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400"
                    )}>
                      <Upload className="w-4 h-4" />
                      {uploadingImage ? "Uploading..." : "Choose Files"}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                    {customImages.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {customImages.map((img, idx) => (
                          <div key={idx} className="relative group">
                            <img src={img} alt={`Design ${idx + 1}`}
                              className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                            <button
                              onClick={() => setCustomImages(prev => prev.filter((_, i) => i !== idx))}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quantity + Add to Cart */}
              <div className="flex gap-3 mb-6">
                <div className="flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-3 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors font-bold"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-5 font-black text-gray-900 text-lg min-w-[3rem] text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(quantity + 1, product.stock))}
                    className="px-4 py-3 text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock < 1}
                  className="flex-1 h-14 rounded-xl font-bold text-white flex items-center justify-center gap-2.5 text-base disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:-translate-y-0.5"
                  style={{
                    background: product.stock > 0
                      ? (addedToBag ? '#16a34a' : 'linear-gradient(135deg, #E85D04, #FB8500)')
                      : '#e5e7eb',
                    boxShadow: product.stock > 0 ? '0 6px 24px rgba(232,93,4,0.35)' : 'none',
                    color: product.stock === 0 ? '#9ca3af' : 'white',
                  }}
                >
                  {addedToBag ? (
                    <><Check className="w-5 h-5" /> Added to Bag!</>
                  ) : (
                    <><ShoppingBag className="w-5 h-5" />{product.stock > 0 ? "Add to Bag" : "Sold Out"}</>
                  )}
                </button>
              </div>

              {/* WhatsApp Order */}
              <button
                onClick={handleWhatsAppOrder}
                className="w-full h-12 rounded-xl font-bold flex items-center justify-center gap-2.5 text-sm transition-all hover:-translate-y-0.5 mb-6"
                style={{ background: '#25D366', color: 'white', boxShadow: '0 4px 16px rgba(37,211,102,0.3)' }}
              >
                <MessageCircle className="w-4.5 h-4.5" style={{ width: '1.1rem', height: '1.1rem' }} />
                Order via WhatsApp
              </button>

              {/* Trust Guarantees */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Truck, label: "Nationwide Delivery", color: '#2563eb', bg: '#eff6ff' },
                  { icon: ShieldCheck, label: "Quality Guarantee", color: '#16a34a', bg: '#f0fdf4' },
                  { icon: RotateCcw, label: "Easy Returns", color: '#d97706', bg: '#fffbeb' },
                ].map(({ icon: Icon, label, color, bg }) => (
                  <div key={label}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center"
                    style={{ background: bg }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                    <span className="text-xs font-semibold text-gray-600 leading-tight">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs: Details & Reviews */}
          <div className="mt-16">
            <div className="flex gap-1 border-b border-gray-200 mb-8">
              {[
                { id: "details", label: "Product Details" },
                { id: "reviews", label: "Customer Reviews" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "details" | "reviews")}
                  className={cn(
                    "px-6 py-3 font-bold text-sm transition-all border-b-2 -mb-px",
                    activeTab === tab.id
                      ? "text-orange-600 border-orange-500"
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "details" ? (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                  <div>
                    <h3 className="font-black text-gray-900 mb-4">Description</h3>
                    <p className="text-gray-600 leading-relaxed text-sm">
                      {product.description || "Premium quality product from TryNex Lifestyle. Crafted with care using the finest materials, designed to last and impress. Perfect for custom designs, corporate gifts, or personal style."}
                    </p>
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900 mb-4">Specifications</h3>
                    <div className="space-y-3">
                      {[
                        { label: "Material", value: "230-320 GSM Premium Cotton" },
                        { label: "Print Method", value: "DTF / Screen Print / Sublimation" },
                        { label: "Available Sizes", value: product.sizes?.join(", ") || "S, M, L, XL, 2XL" },
                        { label: "Available Colors", value: product.colors?.join(", ") || "Multiple" },
                        { label: "Production Time", value: "24-48 hours", highlight: true },
                        { label: "Delivery", value: "24-48 hours nationwide", highlight: true },
                      ].map(({ label, value, highlight }) => (
                        <div key={label} className="flex items-start gap-3 py-2 border-b border-gray-100">
                          <span className="font-bold text-sm text-gray-500 w-36 shrink-0">{label}</span>
                          {highlight ? (
                            <span className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5" /> {value}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-800 font-medium">{value}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <ReviewsSection productId={product.id} rating={rating} />
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {relatedProducts.length > 0 && (
        <section className="py-16 px-4 bg-white border-t border-gray-100">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3"
                  style={{ background: '#fff4ee', color: '#E85D04' }}>
                  <Sparkles className="w-3 h-3" /> You may also like
                </span>
                <h2 className="text-2xl font-black font-display tracking-tight text-gray-900">Related Products</h2>
              </div>
              <Link href="/products" className="flex items-center gap-1.5 font-bold text-sm text-orange-600 hover:text-orange-700 transition-colors">
                View All <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
              {relatedProducts.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />

      {product.stock > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid #e5e7eb',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl overflow-hidden shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="w-9 h-11 flex items-center justify-center text-gray-500 active:bg-gray-100"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-black text-gray-900 tabular-nums">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(quantity + 1, product.stock))}
                aria-label="Increase quantity"
                className="w-9 h-11 flex items-center justify-center text-gray-500 active:bg-gray-100"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-gray-500 truncate leading-tight">{product.name}</p>
              <p className="text-base font-black text-orange-600 leading-tight">
                {formatPrice((product.discountPrice || product.price) * quantity)}
              </p>
            </div>
            <button
              onClick={handleAddToCart}
              className="flex items-center gap-1.5 px-4 h-11 rounded-xl font-bold text-white text-sm shrink-0 active:scale-95 transition-transform"
              style={{
                background: addedToBag ? '#16a34a' : 'linear-gradient(135deg, #E85D04, #FB8500)',
                boxShadow: '0 4px 16px rgba(232,93,4,0.3)',
              }}
              aria-label="Add to cart"
            >
              {addedToBag ? (
                <><Check className="w-4 h-4" /> Added</>
              ) : (
                <><ShoppingBag className="w-4 h-4" /> Add</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
