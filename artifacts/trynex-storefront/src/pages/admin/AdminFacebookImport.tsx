import { AdminLayout } from "@/components/layout/AdminLayout";
import { getAuthHeaders } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Facebook, Search, Download, CheckCircle2, Loader2,
  ChevronRight, ExternalLink, ImageIcon, Tag, X, AlertTriangle, Info,
  Link2, Instagram, Sparkles, Palette, Ruler, Hash, RefreshCw
} from "lucide-react";
import {
  useListCategories, useFetchFacebookPosts, useImportFacebookProduct,
  useFetchSocialUrl, type Category, type FacebookPost, type FetchSocialUrl200Post
} from "@workspace/api-client-react";

type Tab = "url" | "page";

interface ImportForm {
  name: string;
  description: string;
  price: string;
  discountPrice: string;
  imageUrl: string;
  images: string[];
  category: string;
  stock: string;
  sizes: string[];
  colors: string[];
  tags: string;
}

export default function AdminFacebookImport() {
  const { toast } = useToast();
  const { data: categoriesData } = useListCategories({ request: { headers: getAuthHeaders() } });
  const fetchPostsMutation = useFetchFacebookPosts({ request: { headers: getAuthHeaders() } });
  const importProductMutation = useImportFacebookProduct({ request: { headers: getAuthHeaders() } });
  const fetchUrlMutation = useFetchSocialUrl({ request: { headers: getAuthHeaders() } });

  const [activeTab, setActiveTab] = useState<Tab>("url");

  const [pageId, setPageId] = useState(sessionStorage.getItem("fb_page_id") || "");
  const [accessToken, setAccessToken] = useState(sessionStorage.getItem("fb_token") || "");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [fetched, setFetched] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<FacebookPost | null>(null);
  const [importForm, setImportForm] = useState<ImportForm | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [postUrl, setPostUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlPost, setUrlPost] = useState<FetchSocialUrl200Post | null>(null);
  const [urlSource, setUrlSource] = useState<string>("");

  const fetchPosts = async () => {
    if (!pageId.trim() || !accessToken.trim()) {
      toast({ title: "Missing credentials", description: "Please enter your Page ID and Access Token.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setError(null);
    setPosts([]);
    setFetched(false);

    sessionStorage.setItem("fb_page_id", pageId.trim());
    sessionStorage.setItem("fb_token", accessToken.trim());

    try {
      const result = await fetchPostsMutation.mutateAsync({
        data: { pageId: pageId.trim(), accessToken: accessToken.trim() },
      });
      const fetchedPosts = result.posts || [];
      setPosts(fetchedPosts);
      setFetched(true);
      if (fetchedPosts.length === 0) {
        toast({ title: "No posts found", description: "No posts with images were found on this page." });
      } else {
        toast({ title: `${fetchedPosts.length} posts found!`, description: "Select any post to import it as a product." });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to fetch posts. Check your credentials and try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFromUrl = async () => {
    if (!postUrl.trim()) {
      toast({ title: "Missing URL", description: "Please paste a Facebook or Instagram post URL.", variant: "destructive" });
      return;
    }
    setUrlLoading(true);
    setUrlError(null);
    setUrlPost(null);
    setUrlSource("");

    try {
      const result = await fetchUrlMutation.mutateAsync({
        data: { url: postUrl.trim(), accessToken: accessToken.trim() || undefined },
      });
      if (!result.post) {
        setUrlError("No post data returned for this URL.");
        return;
      }
      setUrlPost(result.post);
      setUrlSource(result.source ?? "");
      openImportModal(result.post);
      toast({ title: "Post fetched!", description: `Source: ${result.source}. Review and import the product.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not fetch this post. Check the URL and try again.";
      setUrlError(message);
    } finally {
      setUrlLoading(false);
    }
  };

  const openImportModal = (post: FacebookPost | FetchSocialUrl200Post) => {
    setEditingPost(post as FacebookPost);
    setSelectedImageIdx(0);
    const richPost = post as FetchSocialUrl200Post;
    setImportForm({
      name: richPost.suggestedName || "",
      description: ((richPost.message) || "").slice(0, 500),
      price: richPost.suggestedPrice ? String(richPost.suggestedPrice) : "",
      discountPrice: richPost.suggestedDiscountPrice ? String(richPost.suggestedDiscountPrice) : "",
      imageUrl: (richPost.images || [])[0] || "",
      images: richPost.images || [],
      category: richPost.suggestedCategory || "",
      stock: "50",
      sizes: richPost.suggestedSizes || ["S", "M", "L", "XL", "XXL"],
      colors: richPost.suggestedColors || [],
      tags: "",
    });
  };

  const handleImport = async () => {
    if (!editingPost || !importForm) return;
    if (!importForm.name || !importForm.price || !importForm.imageUrl) {
      toast({ title: "Required fields missing", description: "Please fill in name, price, and select an image.", variant: "destructive" });
      return;
    }

    if (importForm.name.length > 130) {
      toast({ title: "Title too long", description: "Product name must be under 130 characters for best SEO.", variant: "destructive" });
      return;
    }

    setImportingId(editingPost.id);
    try {
      await importProductMutation.mutateAsync({
        data: {
          name: importForm.name,
          description: importForm.description,
          price: parseInt(importForm.price, 10),
          discountPrice: importForm.discountPrice ? parseInt(importForm.discountPrice, 10) : undefined,
          imageUrl: importForm.imageUrl,
          images: importForm.images.filter(img => img !== importForm.imageUrl),
          category: importForm.category || undefined,
          stock: parseInt(importForm.stock, 10) || 50,
          sizes: importForm.sizes,
          colors: importForm.colors,
          tags: importForm.tags ? importForm.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        },
      });
      setImportedIds(prev => new Set([...prev, editingPost.id]));
      setEditingPost(null);
      setImportForm(null);
      toast({ title: "Product imported!", description: `"${importForm.name}" is now live on your store.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Import failed";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    } finally {
      setImportingId(null);
    }
  };

  const toggleSize = (size: string) => {
    if (!importForm) return;
    setImportForm(f => {
      if (!f) return f;
      const has = f.sizes.includes(size);
      return { ...f, sizes: has ? f.sizes.filter(s => s !== size) : [...f.sizes, size] };
    });
  };

  const addColor = (color: string) => {
    if (!importForm || importForm.colors.includes(color)) return;
    setImportForm(f => f ? { ...f, colors: [...f.colors, color] } : f);
  };

  const removeColor = (color: string) => {
    if (!importForm) return;
    setImportForm(f => f ? { ...f, colors: f.colors.filter(c => c !== color) } : f);
  };

  const [newColor, setNewColor] = useState("");

  const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL"];
  const QUICK_COLORS = ["Black", "White", "Red", "Blue", "Green", "Navy", "Gray", "Pink", "Orange", "Yellow", "Brown", "Purple"];

  const detectPlatform = (url: string): "facebook" | "instagram" | null => {
    if (/facebook\.com|fb\.com|fb\.watch/i.test(url)) return "facebook";
    if (/instagram\.com/i.test(url)) return "instagram";
    return null;
  };

  const platform = detectPlatform(postUrl);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, #1877F2, #E1306C)" }}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black font-display text-gray-900">Social Media Import</h1>
            <p className="text-sm text-gray-500">Import products from Facebook & Instagram posts</p>
          </div>
        </div>

        <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("url")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === "url"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Link2 className="w-4 h-4" />
            Fetch from URL
          </button>
          <button
            onClick={() => setActiveTab("page")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === "page"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Facebook className="w-4 h-4" />
            Browse Page Posts
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Facebook Page ID</label>
              <input
                type="text"
                value={pageId}
                onChange={e => setPageId(e.target.value)}
                placeholder="e.g. 123456789012345"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1.5">Page Access Token</label>
              <input
                type="password"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder="Paste your access token"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <Info className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">
              Token is needed for Facebook posts and helps get better data from Instagram.
              Get it from <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noopener noreferrer" className="underline font-medium">Graph API Explorer</a>.
            </p>
          </div>
        </div>

        {activeTab === "url" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-5 h-5 text-orange-500" />
                <h2 className="font-bold text-gray-800">Paste Post URL</h2>
              </div>
              <p className="text-sm text-gray-500">
                Paste any Facebook or Instagram post URL. We'll extract product details, images, variants, and generate an SEO-optimized title automatically.
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <input
                    type="url"
                    value={postUrl}
                    onChange={e => setPostUrl(e.target.value)}
                    placeholder="https://www.facebook.com/page/posts/... or https://www.instagram.com/p/..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    onKeyDown={e => e.key === "Enter" && fetchFromUrl()}
                  />
                  {platform && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {platform === "facebook" ? (
                        <Facebook className="w-4 h-4 text-blue-500" />
                      ) : (
                        <Instagram className="w-4 h-4 text-pink-500" />
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchFromUrl}
                  disabled={urlLoading || !postUrl.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60 whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                >
                  {urlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {urlLoading ? "Fetching..." : "Fetch & Import"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <Facebook className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-blue-700">Facebook Posts</p>
                  <p className="text-[10px] text-blue-500">Page posts, photos</p>
                </div>
                <div className="bg-pink-50 rounded-xl p-3 text-center">
                  <Instagram className="w-5 h-5 text-pink-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-pink-700">Instagram Posts</p>
                  <p className="text-[10px] text-pink-500">Feed posts, reels</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <Sparkles className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-orange-700">Auto-Detect</p>
                  <p className="text-[10px] text-orange-500">Size, color, price</p>
                </div>
              </div>
            </div>

            {urlError && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-700 text-sm">Fetch failed</p>
                  <p className="text-red-600 text-sm mt-0.5">{urlError}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "page" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="font-bold text-gray-800">Browse All Page Posts</h2>
              <p className="text-sm text-gray-500">Fetch the latest 30 posts from your Facebook page and select which ones to import.</p>
              <button
                onClick={fetchPosts}
                disabled={loading || !pageId.trim() || !accessToken.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #1877F2, #42A5F5)" }}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Fetching posts..." : "Fetch All Posts"}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-700 text-sm">Connection failed</p>
                  <p className="text-red-600 text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {fetched && posts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-800">{posts.length} posts found</h2>
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {importedIds.size} imported
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {posts.map(post => {
                    const isImported = importedIds.has(post.id);
                    return (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isImported ? "border-green-200 opacity-70" : "border-gray-100 hover:border-orange-200"}`}
                      >
                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                          {(post.images || []).length > 0 ? (
                            <img src={(post.images || [])[0]} alt="" className="w-full h-full object-cover"
                              onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/400x300?text=No+Image"; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-10 h-10 text-gray-300" />
                            </div>
                          )}
                          {(post.images || []).length > 1 && (
                            <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-semibold">
                              +{(post.images || []).length - 1} photos
                            </div>
                          )}
                          {isImported && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <div className="bg-green-500 text-white rounded-full p-2"><CheckCircle2 className="w-6 h-6" /></div>
                            </div>
                          )}
                        </div>
                        <div className="p-4 space-y-2">
                          <p className="font-bold text-gray-900 text-sm line-clamp-1">{post.suggestedName || "Untitled"}</p>
                          <p className="text-gray-500 text-xs line-clamp-2">{post.message || ""}</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {post.suggestedPrice && (
                              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Tag className="w-3 h-3" /> ৳{post.suggestedPrice.toLocaleString()}
                              </span>
                            )}
                            {(post.suggestedColors || []).length > 0 && (
                              <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Palette className="w-3 h-3" /> {(post.suggestedColors || []).length} colors
                              </span>
                            )}
                            {(post.suggestedSizes || []).length > 0 && (
                              <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Ruler className="w-3 h-3" /> {(post.suggestedSizes || []).join(", ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-blue-500 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => openImportModal(post)}
                              disabled={isImported}
                              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ background: isImported ? "#10b981" : "linear-gradient(135deg, #E85D04, #FB8500)" }}
                            >
                              {isImported ? <><CheckCircle2 className="w-3.5 h-3.5" /> Imported</> : <><Download className="w-3.5 h-3.5" /> Import</>}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {fetched && posts.length === 0 && !loading && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="font-bold text-gray-500">No posts with images found</p>
                <p className="text-sm text-gray-400 mt-1">Only posts with at least one photo are shown here.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {editingPost && importForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) { setEditingPost(null); setImportForm(null); } }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                <div>
                  <h2 className="font-black font-display text-gray-900">Import as Product</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {importForm.name.length}/130 characters
                    {importForm.name.length > 130 && <span className="text-red-500 ml-1">(too long!)</span>}
                  </p>
                </div>
                <button onClick={() => { setEditingPost(null); setImportForm(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {(editingPost.images || []).length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-600">Select Product Image</label>
                    <div className="flex gap-2 flex-wrap">
                      {(editingPost.images || []).map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedImageIdx(idx);
                            setImportForm(f => f ? { ...f, imageUrl: img } : f);
                          }}
                          className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${selectedImageIdx === idx ? "border-orange-500 ring-2 ring-orange-200" : "border-gray-200 hover:border-gray-300"}`}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).src = "https://placehold.co/64x64?text=?"; }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">
                      Product Name <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-400 ml-2 font-normal">SEO-optimized, under 130 chars</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={importForm.name}
                        onChange={e => setImportForm(f => f ? { ...f, name: e.target.value } : f)}
                        maxLength={130}
                        className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${
                          importForm.name.length > 130 ? "border-red-300" : "border-gray-200"
                        }`}
                      />
                      <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${
                        importForm.name.length > 120 ? "text-red-500" : "text-gray-400"
                      }`}>
                        {importForm.name.length}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5">Description</label>
                    <textarea
                      value={importForm.description}
                      onChange={e => setImportForm(f => f ? { ...f, description: e.target.value } : f)}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Price (৳) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        value={importForm.price}
                        onChange={e => setImportForm(f => f ? { ...f, price: e.target.value } : f)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Sale Price (৳)</label>
                      <input
                        type="number"
                        value={importForm.discountPrice}
                        onChange={e => setImportForm(f => f ? { ...f, discountPrice: e.target.value } : f)}
                        placeholder="Optional"
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Category</label>
                      <select
                        value={importForm.category}
                        onChange={e => setImportForm(f => f ? { ...f, category: e.target.value } : f)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      >
                        <option value="">Select category</option>
                        {(categoriesData?.categories ?? []).map((c: Category) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1.5">Stock</label>
                      <input
                        type="number"
                        value={importForm.stock}
                        onChange={e => setImportForm(f => f ? { ...f, stock: e.target.value } : f)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <Ruler className="w-4 h-4" /> Sizes
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ALL_SIZES.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => toggleSize(size)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            importForm.sizes.includes(size)
                              ? "bg-orange-500 text-white border-orange-500"
                              : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                      <Palette className="w-4 h-4" /> Colors
                    </label>
                    {importForm.colors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {importForm.colors.map(c => (
                          <span key={c} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-gray-100 text-gray-700">
                            {c}
                            <button type="button" onClick={() => removeColor(c)} className="text-gray-400 hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_COLORS.filter(c => !importForm.colors.includes(c)).map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => addColor(c)}
                          className="px-2 py-1 rounded-lg text-xs border border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all"
                        >
                          + {c}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newColor}
                        onChange={e => setNewColor(e.target.value)}
                        placeholder="Custom color..."
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
                        onKeyDown={e => { if (e.key === "Enter" && newColor.trim()) { addColor(newColor.trim()); setNewColor(""); } }}
                      />
                      <button
                        type="button"
                        onClick={() => { if (newColor.trim()) { addColor(newColor.trim()); setNewColor(""); } }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-orange-600 border border-orange-200 hover:bg-orange-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1.5 flex items-center gap-2">
                      <Hash className="w-4 h-4" /> SEO Tags
                      <span className="text-xs text-gray-400 font-normal">comma-separated</span>
                    </label>
                    <input
                      type="text"
                      value={importForm.tags}
                      onChange={e => setImportForm(f => f ? { ...f, tags: e.target.value } : f)}
                      placeholder="custom t-shirt, bangladesh, premium apparel"
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setEditingPost(null); setImportForm(null); }}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={!!importingId}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                  >
                    {importingId ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                    ) : (
                      <><ChevronRight className="w-4 h-4" /> Import Product</>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
