import { useState } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Search, Calendar, Clock, ArrowRight, BookOpen, Star, Eye, TrendingUp, Flame } from "lucide-react";
import { motion } from "framer-motion";
import { getApiUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { BlogCardSkeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  imageUrl?: string;
  author: string;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  readingTime: number;
  viewCount: number;
  trending: boolean;
  createdAt: string;
}

function useBlogCategories() {
  return useQuery<{ categories: string[] }>({
    queryKey: ["/api/blog/categories"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/blog/categories"));
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    staleTime: 5 * 60_000,
    placeholderData: { categories: ["General", "Fashion", "Tips", "News", "Lifestyle"] },
  });
}

function useBlogPosts(category: string, sortBy: "newest" | "views") {
  return useQuery<{ posts: BlogPost[] }>({
    queryKey: ["/api/blog", category, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams({ published: "true", limit: "50" });
      if (category !== "All") params.set("category", category);
      if (sortBy === "views") params.set("sort", "views");
      const url = getApiUrl(`/api/blog?${params.toString()}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
    staleTime: 60_000,
  });
}

function HeroPost({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-3xl overflow-hidden mb-12 cursor-pointer"
        style={{ boxShadow: "0 12px 60px rgba(0,0,0,0.12)" }}
      >
        <div className="aspect-[21/9] sm:aspect-[16/7] relative">
          {post.imageUrl ? (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }} />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)" }} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white"
              style={{ background: "var(--color-primary, #E85D04)" }}>
              <Star className="w-3 h-3 fill-white" /> Featured
            </span>
            {post.category && (
              <span className="px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white/90"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                {post.category}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black font-display tracking-tighter leading-tight text-white mb-3 max-w-3xl group-hover:opacity-90 transition-opacity">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-white/70 text-sm sm:text-base max-w-2xl mb-5 leading-relaxed line-clamp-2">
              {post.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 text-white/60 text-xs font-medium">
            <span className="font-semibold text-white/80">{post.author}</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(post.createdAt).toLocaleDateString("en-BD", { dateStyle: "medium" })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {post.readingTime} min read
            </span>
            {post.viewCount > 0 && (
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                {post.viewCount.toLocaleString()} views
              </span>
            )}
            <span className="hidden sm:flex items-center gap-1.5 ml-auto text-white/80 font-bold group-hover:gap-2.5 transition-all">
              Read Article <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function PostCard({ post, idx }: { post: BlogPost; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: idx * 0.07 }}
    >
      <Link href={`/blog/${post.slug}`} className="block group h-full">
        <div className="rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-2 bg-white h-full flex flex-col"
          style={{ border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div className="aspect-video overflow-hidden flex-shrink-0">
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)" }}>
                <BookOpen className="w-10 h-10 text-gray-200" />
              </div>
            )}
          </div>
          <div className="p-6 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {post.category && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider"
                  style={{ background: "rgba(232,93,4,0.08)", color: "var(--color-primary, #E85D04)" }}>
                  {post.category}
                </span>
              )}
              {post.featured && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100">
                  ★ Featured
                </span>
              )}
              {post.trending && (
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black text-red-600 bg-red-50 border border-red-100">
                  <Flame className="w-3 h-3" /> Trending
                </span>
              )}
            </div>
            <h3 className="font-black text-lg leading-tight mb-2 group-hover:text-orange-600 transition-colors line-clamp-2 text-gray-900 flex-1">
              {post.title}
            </h3>
            {post.excerpt && (
              <p className="text-sm text-gray-400 line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
            )}
            <div className="flex items-center justify-between mt-auto pt-2">
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(post.createdAt).toLocaleDateString("en-BD", { dateStyle: "medium" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {post.readingTime} min
                </span>
                {post.viewCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    {post.viewCount.toLocaleString()}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-xs font-bold text-orange-500 group-hover:gap-2 transition-all">
                Read <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Blog() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "views">("newest");
  const { data, isLoading } = useBlogPosts(activeCategory, sortBy);
  const { data: categoriesData } = useBlogCategories();
  const CATEGORIES = ["All", ...(categoriesData?.categories ?? ["General", "Fashion", "Tips", "News", "Lifestyle"])];

  const posts = data?.posts ?? [];

  const filtered = posts.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q);
  });

  const featuredPost = sortBy === "newest"
    ? (filtered.find(p => p.featured) ?? (filtered.length > 0 ? filtered[0] : null))
    : (filtered.length > 0 ? filtered[0] : null);
  const gridPosts = featuredPost ? filtered.filter(p => p.id !== featuredPost.id) : [];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead
        title="Blog"
        description="Read the latest tips, trends, and updates from TryNex Lifestyle. Custom apparel guides, fashion inspiration, and brand stories from Bangladesh."
        canonical="/blog"
        keywords="trynex blog, custom apparel tips, bangladesh fashion blog"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "Blog",
            "name": "TryNex Lifestyle Blog",
            "description": "Premium custom apparel tips, fashion trends, and lifestyle content from Bangladesh.",
            "publisher": { "@type": "Organization", "name": "TryNex Lifestyle" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trynex.com.bd/" },
              { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://trynex.com.bd/blog" },
            ],
          },
        ]}
      />
      <Navbar />

      <main className="flex-1 pt-header pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center pt-6 pb-4 sm:py-16 mb-4 sm:mb-8"
          >
            <div className="hidden sm:inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-6"
              style={{ background: "rgba(232,93,4,0.08)", border: "1px solid rgba(232,93,4,0.15)" }}>
              <BookOpen className="w-7 h-7 text-orange-500" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-orange-500 mb-2 sm:mb-3">Stories & Updates</p>
            <h1 className="text-3xl sm:text-6xl font-black font-display tracking-tighter mb-2 sm:mb-4 text-gray-900">TryNex Magazine</h1>
            <p className="text-gray-400 text-sm sm:text-lg max-w-md mx-auto">
              Style tips, brand stories, and custom apparel inspiration from Bangladesh.
            </p>
          </motion.div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-10 items-start sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 bg-white text-gray-900 placeholder:text-gray-400"
                style={{ border: "1px solid #e5e7eb" }}
              />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); setSearch(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeCategory === cat ? "text-white" : "text-gray-500 hover:text-gray-700 bg-white"}`}
                  style={activeCategory === cat ? { background: "var(--color-primary, #E85D04)" } : { border: "1px solid #e5e7eb" }}
                >
                  {cat}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 hidden sm:block" />
              <button
                onClick={() => setSortBy(sortBy === "views" ? "newest" : "views")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === "views" ? "text-white" : "text-gray-500 hover:text-gray-700 bg-white"}`}
                style={sortBy === "views" ? { background: "linear-gradient(135deg,#E85D04,#FB8500)" } : { border: "1px solid #e5e7eb" }}
                title="Sort by most viewed"
              >
                {sortBy === "views" ? <Flame className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                {sortBy === "views" ? "Most Viewed" : "Newest"}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div aria-label="Loading blog posts" aria-busy="true">
              <div className="rounded-3xl overflow-hidden animate-pulse mb-12 aspect-[21/9] sm:aspect-[16/7] bg-gray-100" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <BlogCardSkeleton key={i} />)}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen className="w-14 h-14 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 text-xl font-black mb-2">
                {posts.length === 0 ? "No Posts Yet" : "No matching articles"}
              </p>
              <p className="text-gray-400 text-sm">
                {posts.length === 0
                  ? "Check back soon for style tips and brand updates."
                  : "Try a different category or search term."}
              </p>
            </div>
          ) : (
            <ErrorBoundary section="blog posts">
              <>
                {featuredPost && <HeroPost post={featuredPost} />}

                {gridPosts.length > 0 && (
                  <>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="text-xl font-black font-display tracking-tight text-gray-900 flex items-center gap-2">
                        {sortBy === "views" ? (
                          <><Flame className="w-5 h-5 text-red-500" /> Most Viewed</>
                        ) : activeCategory === "All" ? "Latest Articles" : activeCategory}
                      </h2>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-sm text-gray-400 font-medium">{gridPosts.length} articles</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {gridPosts.map((post, idx) => (
                        <PostCard key={post.id} post={post} idx={idx} />
                      ))}
                    </div>
                  </>
                )}
              </>
            </ErrorBoundary>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
