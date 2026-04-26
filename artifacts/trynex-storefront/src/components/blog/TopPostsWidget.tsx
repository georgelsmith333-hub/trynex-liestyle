import { Link } from "wouter";
import { Eye, TrendingUp, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { getApiUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

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

function useTopPosts() {
  return useQuery<{ posts: BlogPost[] }>({
    queryKey: ["/api/blog/top-posts"],
    queryFn: async () => {
      const url = getApiUrl("/api/blog?sort=views&limit=5&published=true");
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load top posts");
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function TopPostsWidget() {
  const { data, isLoading, isError } = useTopPosts();
  const posts = data?.posts ?? [];

  return (
    <motion.aside
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl overflow-hidden mb-10"
      style={{ border: "1px solid #f0f0f0", boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-center gap-2 px-5 py-4"
        style={{ background: "linear-gradient(135deg,#E85D04 0%,#FB8500 100%)" }}>
        <TrendingUp className="w-4 h-4 text-white" />
        <h2 className="text-sm font-black uppercase tracking-wider text-white">Top Posts</h2>
      </div>

      <div className="bg-white divide-y divide-gray-50">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
              <span className="w-5 h-5 rounded bg-gray-100 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-100 rounded w-4/5" />
                <div className="h-2.5 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
          ))
        ) : isError ? (
          <p className="px-5 py-6 text-sm text-red-400 text-center">Could not load top posts.</p>
        ) : posts.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400 text-center">No posts yet.</p>
        ) : (
          posts.map((post, idx) => (
            <Link key={post.id} href={`/blog/${post.slug}`}
              className="flex items-center gap-3 px-5 py-3.5 group hover:bg-orange-50/60 transition-colors">
              <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-[11px] font-black"
                style={idx === 0
                  ? { background: "rgba(232,93,4,0.12)", color: "#E85D04" }
                  : { background: "#f5f5f5", color: "#9ca3af" }}>
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 group-hover:text-orange-600 transition-colors leading-snug line-clamp-2">
                  {post.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 font-medium">
                  <Eye className="w-3 h-3" />
                  {post.viewCount.toLocaleString()} views
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-orange-400 flex-shrink-0 transition-colors" />
            </Link>
          ))
        )}
      </div>
    </motion.aside>
  );
}
