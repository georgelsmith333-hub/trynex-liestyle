import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Loader } from "@/components/ui/Loader";
import { ArrowLeft, Calendar, User, Clock, Share2, Copy, Check, BookOpen, ChevronRight, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { getApiUrl } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";

interface BlogPostData {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  imageUrl?: string;
  author: string;
  authorBio?: string;
  authorAvatarUrl?: string;
  category: string;
  tags: string[];
  published: boolean;
  featured: boolean;
  readingTime: number;
  viewCount: number;
  createdAt: string;
}

interface TocItem {
  id: string;
  text: string;
  level: number;
}

function useBlogPost(slug: string | undefined) {
  return useQuery<BlogPostData>({
    queryKey: ["/api/blog", slug],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/blog/${slug}`));
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });
}

function useRelatedPosts(slug: string | undefined) {
  return useQuery<{ posts: BlogPostData[] }>({
    queryKey: ["/api/blog", slug, "related"],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/blog/${slug}/related`));
      if (!res.ok) return { posts: [] };
      return res.json();
    },
    enabled: !!slug,
    staleTime: 120_000,
  });
}

function extractToc(html: string, isHtml: boolean): TocItem[] {
  if (isHtml) {
    const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
    if (!parser) return [];
    const doc = parser.parseFromString(html, "text/html");
    const headings = Array.from(doc.querySelectorAll("h2, h3"));
    return headings.map((el, i) => ({
      id: `heading-${i}`,
      text: el.textContent?.trim() ?? "",
      level: parseInt(el.tagName[1]),
    }));
  }
  const items: TocItem[] = [];
  html.split("\n").forEach((line, i) => {
    if (line.startsWith("## ")) items.push({ id: `heading-${i}`, text: line.slice(3).trim(), level: 2 });
    else if (line.startsWith("### ")) items.push({ id: `heading-${i}`, text: line.slice(4).trim(), level: 3 });
  });
  return items;
}

interface FaqEntry {
  question: string;
  answer: string;
}

function extractFaqSchema(content: string, isHtml: boolean): FaqEntry[] {
  const entries: FaqEntry[] = [];

  if (isHtml) {
    if (typeof DOMParser === "undefined") return [];
    const doc = new DOMParser().parseFromString(content, "text/html");
    const headings = Array.from(doc.querySelectorAll("h2, h3"));
    const faqHeading = headings.find(h => /faq|frequently asked|questions/i.test(h.textContent ?? ""));
    if (!faqHeading) return [];

    let node: Element | null = faqHeading.nextElementSibling;
    let currentQ = "";
    let answerParts: string[] = [];

    const flush = () => {
      if (currentQ && answerParts.length > 0) {
        entries.push({ question: currentQ, answer: answerParts.join(" ").trim() });
      }
      currentQ = "";
      answerParts = [];
    };

    while (node) {
      const tag = node.tagName.toLowerCase();
      if (tag === "h2" || tag === "h3") {
        if (/faq|frequently asked|questions/i.test(node.textContent ?? "")) {
          node = node.nextElementSibling;
          continue;
        }
        if (["h2", "h3"].includes(tag) && !currentQ) {
          node = node.nextElementSibling;
          continue;
        }
        flush();
        break;
      }
      if (tag === "h4" || (tag === "strong" && node.parentElement?.tagName.toLowerCase() === "p")) {
        flush();
        currentQ = node.textContent?.trim() ?? "";
      } else if (currentQ) {
        const text = node.textContent?.trim();
        if (text) answerParts.push(text);
      }
      node = node.nextElementSibling;
    }
    flush();
  } else {
    const lines = content.split("\n");
    let inFaq = false;
    let currentQ = "";
    let answerParts: string[] = [];

    const flush = () => {
      if (currentQ && answerParts.length > 0) {
        entries.push({ question: currentQ, answer: answerParts.join(" ").trim() });
      }
      currentQ = "";
      answerParts = [];
    };

    for (const line of lines) {
      if (!inFaq && /^#{1,3}\s.*(faq|frequently asked|questions)/i.test(line)) {
        inFaq = true;
        continue;
      }
      if (!inFaq) continue;
      if (/^#{1,2}\s/.test(line) && !/faq|frequently asked/i.test(line)) {
        flush();
        break;
      }
      if (/^###\s|^####\s/.test(line)) {
        flush();
        currentQ = line.replace(/^#+\s/, "").trim();
      } else if (/^\*\*(.+)\*\*$/.test(line)) {
        flush();
        currentQ = line.replace(/^\*\*|\*\*$/g, "").trim();
      } else if (currentQ && line.trim()) {
        answerParts.push(line.trim());
      }
    }
    flush();
  }

  return entries.slice(0, 10);
}

function injectHeadingIds(html: string): string {
  let idx = 0;
  return html.replace(/<(h[23])([\s>])/gi, (_match, tag, rest) => {
    const id = `heading-${idx++}`;
    return `<${tag} id="${id}"${rest}`;
  });
}

function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const handler = () => {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1" style={{ background: "rgba(0,0,0,0.06)" }}>
      <div
        className="h-full transition-all duration-100"
        style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--color-primary, #E85D04), var(--color-primary-medium, #FB8500))" }}
      />
    </div>
  );
}

function TableOfContents({ items, activeId }: { items: TocItem[]; activeId: string }) {
  if (items.length < 2) return null;
  return (
    <div className="rounded-2xl p-5 sticky top-24" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
      <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">In this article</p>
      <nav className="space-y-1">
        {items.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className={`block text-sm font-medium leading-snug transition-colors hover:text-orange-600 ${item.level === 3 ? "pl-3" : ""} ${activeId === item.id ? "text-orange-600 font-bold" : "text-gray-500"}`}
          >
            {activeId === item.id && <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: "var(--color-primary, #E85D04)" }} />}
            {item.text}
          </a>
        ))}
      </nav>
    </div>
  );
}

function ShareButtons({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-sm font-black text-gray-400 flex items-center gap-2">
        <Share2 className="w-4 h-4" /> Share
      </span>
      <a
        href={`https://wa.me/?text=${encodedTitle}%20${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
        style={{ background: "#25D366" }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
        style={{ background: "#1877F2" }}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Facebook
      </a>
      <button
        onClick={copyLink}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105"
        style={{ background: copied ? "rgba(74,222,128,0.1)" : "#f3f4f6", color: copied ? "#16a34a" : "#374151", border: copied ? "1px solid rgba(74,222,128,0.3)" : "1px solid #e5e7eb" }}
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? "Copied!" : "Copy Link"}
      </button>
    </div>
  );
}

function AuthorCard({ author, bio, avatarUrl }: { author: string; bio?: string; avatarUrl?: string }) {
  return (
    <div className="rounded-3xl p-6 sm:p-8 flex gap-6 items-start"
      style={{ background: "rgba(232,93,4,0.04)", border: "1px solid rgba(232,93,4,0.12)" }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={author} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black text-white"
          style={{ background: "linear-gradient(135deg, var(--color-primary, #E85D04), var(--color-primary-medium, #FB8500))" }}>
          {author[0]}
        </div>
      )}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-orange-500 mb-1">Written by</p>
        <h4 className="text-lg font-black text-gray-900 mb-2">{author}</h4>
        {bio && <p className="text-sm text-gray-500 leading-relaxed">{bio}</p>}
      </div>
    </div>
  );
}

function RelatedPostCard({ post }: { post: BlogPostData }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <div className="rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
        style={{ border: "1px solid #e5e7eb", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
        <div className="aspect-video overflow-hidden bg-gray-50">
          {post.imageUrl ? (
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" width="400" height="225" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-8 h-8 text-gray-200" />
            </div>
          )}
        </div>
        <div className="p-4">
          {post.category && (
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">{post.category}</span>
          )}
          <h4 className="font-black text-sm text-gray-900 mt-1 line-clamp-2 group-hover:text-orange-600 transition-colors">{post.title}</h4>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readingTime} min</span>
            <span className="flex items-center gap-1 ml-auto font-bold text-orange-500 group-hover:gap-1.5 transition-all">Read <ChevronRight className="w-3 h-3" /></span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function renderMarkdown(content: string) {
  return content.split("\n").filter(Boolean).map((para, i) => {
    if (para.startsWith("# ")) return <h2 key={i} id={`heading-${i}`} className="text-3xl font-black font-display tracking-tight mt-10 mb-4 text-gray-900">{para.slice(2)}</h2>;
    if (para.startsWith("## ")) return <h3 key={i} id={`heading-${i}`} className="text-2xl font-black font-display tracking-tight mt-8 mb-3 text-gray-900">{para.slice(3)}</h3>;
    if (para.startsWith("### ")) return <h4 key={i} id={`heading-${i}`} className="text-xl font-black mt-6 mb-2 text-gray-900">{para.slice(4)}</h4>;
    if (para.startsWith("> ")) return (
      <blockquote key={i} className="my-6 pl-6 border-l-4 border-orange-400 text-xl text-gray-600 font-medium italic leading-relaxed"
        style={{ background: "rgba(232,93,4,0.04)", padding: "1rem 1.5rem", borderRadius: "0 1rem 1rem 0" }}>
        {para.slice(2)}
      </blockquote>
    );
    if (para.startsWith("- ")) return <ul key={i} className="list-disc pl-6 mb-4 text-gray-600"><li>{para.slice(2)}</li></ul>;
    return <p key={i} className="text-gray-600 leading-relaxed mb-4">{para}</p>;
  });
}

export default function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading, isError } = useBlogPost(slug);
  const { data: relatedData } = useRelatedPosts(slug);
  const relatedPosts = relatedData?.posts ?? [];
  const [activeHeading, setActiveHeading] = useState("");
  const articleRef = useRef<HTMLDivElement>(null);

  const isHtmlContent = post ? /<[a-z][\s\S]*>/i.test(post.content) : false;
  const tocItems = post ? extractToc(post.content, isHtmlContent) : [];
  const processedContent = post && isHtmlContent ? injectHeadingIds(DOMPurify.sanitize(post.content)) : null;

  const handleScroll = useCallback(() => {
    const headings = articleRef.current?.querySelectorAll("h2[id], h3[id]");
    if (!headings) return;
    let current = "";
    headings.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top <= 120) current = el.id;
    });
    setActiveHeading(current);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  if (isLoading) return <Loader fullScreen />;

  if (isError || !post) return (
    <div className="min-h-screen flex flex-col bg-white">
      <SEOHead title="Post Not Found" noindex />
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-20">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6"
            style={{ background: "rgba(232,93,4,0.06)", border: "1px solid rgba(232,93,4,0.15)" }}>
            📄
          </div>
          <h2 className="text-4xl font-black font-display tracking-tighter mb-3 text-gray-900">Post Not Found</h2>
          <p className="text-gray-400 mb-8">This blog post may have been removed or is not yet published.</p>
          <Link href="/blog"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
            <ArrowLeft className="w-5 h-5" /> Back to Blog
          </Link>
        </motion.div>
      </div>
      <Footer />
    </div>
  );

  const pageUrl = `https://trynex.com.bd/blog/${post.slug}`;

  const faqEntries = extractFaqSchema(post.content, isHtmlContent);

  const jsonLdSchemas: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": post.title,
      "description": post.excerpt || "",
      "author": {
        "@type": "Person",
        "name": post.author,
        ...(post.authorAvatarUrl ? { "image": post.authorAvatarUrl } : {}),
      },
      "datePublished": post.createdAt,
      "dateModified": post.createdAt,
      "publisher": {
        "@type": "Organization",
        "name": "TryNex Lifestyle",
        "logo": { "@type": "ImageObject", "url": "https://trynex.com.bd/logo.png" },
      },
      "image": post.imageUrl || undefined,
      "url": pageUrl,
      "articleSection": post.category,
      "keywords": post.tags.join(", "),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://trynex.com.bd/" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://trynex.com.bd/blog" },
        { "@type": "ListItem", "position": 3, "name": post.title, "item": pageUrl },
      ],
    },
    ...(faqEntries.length > 0 ? [{
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqEntries.map(e => ({
        "@type": "Question",
        "name": e.question,
        "acceptedAnswer": { "@type": "Answer", "text": e.answer },
      })),
    }] : []),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ReadingProgress />
      <SEOHead
        title={post.title}
        description={post.excerpt || `Read "${post.title}" on TryNex Lifestyle blog.`}
        canonical={`/blog/${post.slug}`}
        ogType="article"
        ogImage={post.imageUrl || undefined}
        keywords={post.tags.join(", ")}
        jsonLd={jsonLdSchemas}
      />
      <Navbar />

      <main className="flex-1 pt-header pb-24">

        {/* Hero image — full width */}
        {post.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full aspect-[16/7] overflow-hidden mb-0"
            style={{ maxHeight: 480 }}
          >
            <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" width="1200" height="480" fetchPriority="high" />
          </motion.div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-12 pt-8 sm:pt-12">

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
                <Link href="/blog" className="hover:text-orange-600 transition-colors font-medium">Blog</Link>
                <ChevronRight className="w-3.5 h-3.5" />
                {post.category && <><span className="text-orange-500 font-bold">{post.category}</span><ChevronRight className="w-3.5 h-3.5" /></>}
                <span className="line-clamp-1 text-gray-500">{post.title}</span>
              </nav>

              {/* Category + Tags */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {post.category && (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider"
                    style={{ background: "rgba(232,93,4,0.08)", color: "var(--color-primary, #E85D04)" }}>
                    {post.category}
                  </span>
                )}
                {post.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100">{tag}</span>
                ))}
              </div>

              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl sm:text-5xl font-black font-display tracking-tighter leading-tight mb-6 text-gray-900"
              >
                {post.title}
              </motion.h1>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 text-sm text-gray-400 pb-8 mb-8 border-b border-gray-100 flex-wrap"
              >
                <div className="flex items-center gap-2">
                  {post.authorAvatarUrl ? (
                    <img src={post.authorAvatarUrl} alt={post.author} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white"
                      style={{ background: "linear-gradient(135deg, var(--color-primary, #E85D04), var(--color-primary-medium, #FB8500))" }}>
                      {post.author[0]}
                    </div>
                  )}
                  <span className="font-semibold text-gray-700">{post.author}</span>
                </div>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(post.createdAt).toLocaleDateString("en-BD", { dateStyle: "long" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {post.readingTime} min read
                </span>
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  {(post.viewCount ?? 0).toLocaleString()} views
                </span>
              </motion.div>

              {/* Excerpt pull quote */}
              {post.excerpt && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15 }}
                  className="text-xl text-gray-600 leading-relaxed mb-10 font-medium italic border-l-4 pl-6 py-2"
                  style={{ borderColor: "var(--color-primary, #E85D04)", background: "rgba(232,93,4,0.04)", borderRadius: "0 12px 12px 0" }}
                >
                  {post.excerpt}
                </motion.p>
              )}

              {/* Body content */}
              <motion.div
                ref={articleRef}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="prose max-w-none prose-headings:font-black prose-headings:font-display prose-headings:tracking-tight prose-h2:text-3xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:text-gray-900 prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3 prose-h3:text-gray-900 prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-a:text-orange-600 prose-img:rounded-xl prose-blockquote:border-orange-400 prose-blockquote:text-gray-600 prose-blockquote:not-italic"
              >
                {isHtmlContent && processedContent ? (
                  <div dangerouslySetInnerHTML={{ __html: processedContent }} />
                ) : (
                  renderMarkdown(post.content)
                )}
              </motion.div>

              {/* Share */}
              <div className="mt-12 pt-8 border-t border-gray-100">
                <ShareButtons title={post.title} url={pageUrl} />
              </div>

              {/* Author bio */}
              {(post.authorBio || post.author) && (
                <div className="mt-8">
                  <AuthorCard author={post.author} bio={post.authorBio} avatarUrl={post.authorAvatarUrl} />
                </div>
              )}

              {/* Related posts */}
              {relatedPosts.length > 0 && (
                <div className="mt-14">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-xl font-black font-display tracking-tight text-gray-900">Related Articles</h3>
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {relatedPosts.map(rp => <RelatedPostCard key={rp.id} post={rp} />)}
                  </div>
                </div>
              )}

              {/* Bottom nav */}
              <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link href="/blog"
                  className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
                  <ArrowLeft className="w-4 h-4" /> All Articles
                </Link>
                <Link href="/products"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}>
                  <BookOpen className="w-4 h-4" /> Shop TryNex Collection
                </Link>
              </div>
            </div>

            {/* ToC sidebar — desktop only */}
            {tocItems.length >= 2 && (
              <aside className="hidden xl:block w-64 flex-shrink-0">
                <TableOfContents items={tocItems} activeId={activeHeading} />
              </aside>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
