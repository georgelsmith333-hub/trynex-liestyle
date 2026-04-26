import { AdminLayout } from "@/components/layout/AdminLayout";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, Eye, EyeOff, X, Save, FileText, Calendar, ImageIcon, Star, Upload, Tag, Settings2, BarChart2, GripVertical, AlertTriangle, Flame } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders, getApiUrl } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  useListBlogPosts,
  useCreateBlogPost,
  useUpdateBlogPost,
  useDeleteBlogPost,
  type BlogPost as ApiBlogPost,
  type BlogPostInput,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";

type BlogPost = ApiBlogPost;

const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400 border border-gray-200 bg-white text-gray-900";

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim();
}

const EMPTY_POST: Partial<BlogPost> = {
  title: "", slug: "", excerpt: "", content: "", imageUrl: "",
  author: "TryNex Team", authorBio: "", authorAvatarUrl: "",
  category: "General", tags: [], published: false, featured: false,
};

function useBlogCategories() {
  return useQuery<{ categories: string[] }>({
    queryKey: ["/api/blog/categories"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/blog/categories"));
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export default function AdminBlog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reqOpts = { request: { headers: getAuthHeaders() } };
  const { data: blogData, isLoading } = useListBlogPosts({ limit: "100" }, reqOpts);
  const posts = blogData?.posts ?? [];

  const { data: categoriesData, refetch: refetchCategories } = useBlogCategories();
  const categories = categoriesData?.categories ?? ["General", "Fashion", "Tips", "News", "Lifestyle"];

  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost();
  const deleteMutation = useDeleteBlogPost();

  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "most-viewed">("newest");

  const sortedPosts = [...posts].sort((a, b) => {
    if (sortBy === "most-viewed") return (b.viewCount ?? 0) - (a.viewCount ?? 0);
    if (sortBy === "oldest") return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
  });

  const [editing, setEditing] = useState<Partial<BlogPost> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCatManagerOpen, setIsCatManagerOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [catDeleteConfirm, setCatDeleteConfirm] = useState<string | null>(null);
  const [catReassignTo, setCatReassignTo] = useState<string>("");
  const [localCatOrder, setLocalCatOrder] = useState<string[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const catItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(getApiUrl("/api/blog/categories"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to add category");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/categories"] });
      setNewCatName("");
      toast({ title: "Category added" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ name, reassignTo }: { name: string; reassignTo?: string }) => {
      const base = getApiUrl(`/api/blog/categories/${encodeURIComponent(name)}`);
      const url = reassignTo ? `${base}?reassignTo=${encodeURIComponent(reassignTo)}` : base;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to delete category");
      }
      return res.json() as Promise<{ categories: string[]; affectedCount: number }>;
    },
    onSuccess: (data, { reassignTo }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/categories"] });
      if (reassignTo && data.affectedCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
      }
      const msg = data.affectedCount > 0 && reassignTo
        ? `Category removed · ${data.affectedCount} post${data.affectedCount !== 1 ? "s" : ""} moved to "${reassignTo}"`
        : "Category removed";
      toast({ title: msg });
    },
    onError: (err: Error) => {
      const isReassignMissing =
        err.message.toLowerCase().includes("does not exist") ||
        err.message.toLowerCase().includes("reassign target");
      if (isReassignMissing) {
        toast({
          title: "Reassign target no longer exists",
          description: "The category you chose to reassign posts to has been deleted by another admin. Please close this dialog and try again — the list will be refreshed.",
          variant: "destructive",
        });
        refetchCategories();
      } else {
        toast({ title: err.message, variant: "destructive" });
      }
    },
  });

  const reorderCategoriesMutation = useMutation({
    mutationFn: async (newOrder: string[]) => {
      const res = await fetch(getApiUrl("/api/blog/categories"), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ categories: newOrder }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to reorder categories");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blog/categories"] });
      toast({ title: "Category order saved" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (isCatManagerOpen) setLocalCatOrder(categories);
  }, [isCatManagerOpen, categories]);

  const finalizeCatReorder = useCallback((order: string[]) => {
    const unchanged = order.length === categories.length &&
      order.every((c, i) => c === categories[i]);
    if (!unchanged) {
      reorderCategoriesMutation.mutate(order);
    }
  }, [categories, reorderCategoriesMutation]);

  const handleGripPointerDown = useCallback((e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragIdxRef.current = idx;
    setDraggingIdx(idx);
  }, []);

  const handleRowPointerEnter = useCallback((idx: number) => {
    if (dragIdxRef.current === null || dragIdxRef.current === idx) return;
    setLocalCatOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdxRef.current!, 1);
      next.splice(idx, 0, moved);
      dragIdxRef.current = idx;
      setDraggingIdx(idx);
      return next;
    });
  }, []);

  const handleCatPointerUp = useCallback(() => {
    if (dragIdxRef.current !== null) {
      setLocalCatOrder(prev => {
        finalizeCatReorder(prev);
        return prev;
      });
    }
    dragIdxRef.current = null;
    setDraggingIdx(null);
  }, [finalizeCatReorder]);

  useEffect(() => {
    document.addEventListener("pointerup", handleCatPointerUp);
    document.addEventListener("pointercancel", handleCatPointerUp);
    return () => {
      document.removeEventListener("pointerup", handleCatPointerUp);
      document.removeEventListener("pointercancel", handleCatPointerUp);
    };
  }, [handleCatPointerUp]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isEditorOpen) closeEditor();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isEditorOpen]);

  const openEditor = (post?: BlogPost) => {
    if (post) {
      setEditing({ ...post });
      setTagsInput((post.tags || []).join(", "));
    } else {
      setEditing({ ...EMPTY_POST });
      setTagsInput("");
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditing(null);
    setTagsInput("");
  };

  const handleTitleChange = (title: string) => {
    setEditing(prev => ({
      ...prev!,
      title,
      slug: prev?.id ? prev.slug : slugify(title),
    }));
  };

  const invalidateBlog = () => queryClient.invalidateQueries({ queryKey: ["/api/blog"] });

  const handleUploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      const reqRes = await fetch(getApiUrl("/api/storage/uploads/request-url"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) {
        const errData = await reqRes.json().catch(() => ({}));
        throw new Error(errData.message ?? "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await reqRes.json();

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      const imageUrl = getApiUrl(`/api/storage/objects${objectPath.replace(/^\/objects/, "")}`);
      setEditing(prev => ({ ...prev!, imageUrl }));
      toast({ title: "Image uploaded successfully" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!editing?.title || !editing?.content) {
      toast({ title: "Title and content are required", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      const slug = editing.slug || slugify(editing.title!);
      const rtoValue = editing.readingTimeOverride;
      const payload = {
        title: editing.title!,
        slug,
        content: editing.content!,
        excerpt: editing.excerpt,
        imageUrl: editing.imageUrl,
        author: editing.author,
        authorBio: editing.authorBio,
        authorAvatarUrl: editing.authorAvatarUrl,
        category: editing.category || "General",
        tags,
        published: editing.published,
        featured: editing.featured,
        readingTimeOverride: rtoValue ? Number(rtoValue) : null,
        ...(editing.id && editing.viewCount !== undefined ? { viewCount: editing.viewCount } : {}),
      } satisfies Omit<BlogPostInput, "readingTimeOverride"> & { readingTimeOverride: number | null };

      if (editing.id) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload as BlogPostInput, ...reqOpts });
        toast({ title: "✓ Post updated!" });
      } else {
        await createMutation.mutateAsync({ data: payload as BlogPostInput, ...reqOpts });
        toast({ title: "✓ Post published!" });
      }
      invalidateBlog();
      closeEditor();
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id, ...reqOpts });
      invalidateBlog();
      toast({ title: "✓ Post deleted" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      await updateMutation.mutateAsync({
        id: post.id,
        data: { title: post.title, slug: post.slug, content: post.content, published: !post.published },
        ...reqOpts,
      });
      invalidateBlog();
      toast({ title: !post.published ? "✓ Post published!" : "Post moved to drafts" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-orange-500 mb-2">Content</p>
          <h1 className="text-3xl font-black font-display tracking-tighter text-gray-900">Blog Posts</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">{posts.length} total posts</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-100"
            aria-label="Sort posts"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="most-viewed">Most viewed</option>
          </select>
          <button
            onClick={() => setIsCatManagerOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 bg-gray-50 border border-gray-200 text-gray-700"
          >
            <Tag className="w-4 h-4" /> Categories
          </button>
          <button
            onClick={() => openEditor()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 6px 24px rgba(232,93,4,0.3)" }}
          >
            <Plus className="w-4 h-4" /> New Post
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-24 rounded-3xl bg-gray-50 border border-gray-100">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <p className="font-bold text-xl text-gray-400 mb-2">No blog posts yet</p>
          <p className="text-gray-400 text-sm mb-6">Create your first post to engage with customers</p>
          <button
            onClick={() => openEditor()}
            className="px-6 py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
          >
            <Plus className="w-4 h-4 inline mr-2" />Create First Post
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sortedPosts.map((post, idx) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="rounded-2xl overflow-hidden group bg-white"
              style={{ border: "1px solid #e5e7eb", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}
            >
              {post.imageUrl ? (
                <div className="aspect-video overflow-hidden bg-gray-100">
                  <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-gray-50">
                  <ImageIcon className="w-10 h-10 text-gray-300" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${post.published ? "bg-green-50 text-green-600 border border-green-200" : "bg-gray-100 text-gray-500 border border-gray-200"}`}>
                    {post.published ? "● Published" : "○ Draft"}
                  </span>
                  {post.featured && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-200 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-amber-500" /> Featured
                    </span>
                  )}
                  {post.trending && (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-red-50 text-red-600 border border-red-100 flex items-center gap-1">
                      <Flame className="w-2.5 h-2.5" /> Trending
                    </span>
                  )}
                  {post.category && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-500 border border-orange-100">
                      {post.category}
                    </span>
                  )}
                </div>
                <h3 className="font-black text-base text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                {post.excerpt && (
                  <p className="text-xs text-gray-400 line-clamp-2 mb-3 leading-relaxed">{post.excerpt}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-4 flex-wrap">
                  <Calendar className="w-3 h-3" />
                  {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-BD", { dateStyle: "medium" }) : ""}
                  {post.readingTime && <span className="ml-1">· {post.readingTime} min read</span>}
                  <span className="flex items-center gap-1 ml-auto font-semibold text-gray-500">
                    <BarChart2 className="w-3 h-3" />
                    {(post.viewCount ?? 0).toLocaleString()} views
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditor(post)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 bg-orange-50 border border-orange-200 text-orange-600"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => handleTogglePublish(post)}
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-105"
                    style={{
                      background: post.published ? "rgba(239,68,68,0.08)" : "rgba(74,222,128,0.1)",
                      border: `1px solid ${post.published ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.2)"}`,
                      color: post.published ? "#ef4444" : "#16a34a",
                    }}
                    title={post.published ? "Move to Draft" : "Publish"}
                  >
                    {post.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(post.id)}
                    className="flex items-center justify-center w-10 h-10 rounded-xl transition-all hover:scale-105"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#ef4444" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && editing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 py-8"
            onClick={e => e.target === e.currentTarget && closeEditor()}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-3xl rounded-3xl overflow-hidden bg-white"
              style={{ border: "1px solid #e5e7eb", boxShadow: "0 25px 60px rgba(0,0,0,0.15)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-black font-display text-gray-900">
                    {editing.id ? "Edit Post" : "Create New Post"}
                  </h2>
                  {editing.id && <p className="text-xs text-gray-400 mt-0.5">ID #{editing.id}</p>}
                </div>
                <button onClick={closeEditor} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="p-6 space-y-5 max-h-[calc(100dvh-200px)] overflow-y-auto">

                {/* Title */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Title *</label>
                  <input
                    value={editing.title || ""}
                    onChange={e => handleTitleChange(e.target.value)}
                    placeholder="Post title..."
                    className={inputClass}
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Slug (URL)</label>
                  <input
                    value={editing.slug || ""}
                    onChange={e => setEditing(prev => ({ ...prev!, slug: e.target.value }))}
                    placeholder="post-url-slug"
                    className={inputClass}
                    style={{ fontFamily: "monospace" }}
                  />
                </div>

                {/* Category + Tags */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Category</label>
                    <select
                      value={editing.category || "General"}
                      onChange={e => setEditing(prev => ({ ...prev!, category: e.target.value }))}
                      className={inputClass}
                    >
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Tags (comma separated)</label>
                    <input
                      value={tagsInput}
                      onChange={e => setTagsInput(e.target.value)}
                      placeholder="fashion, tips, style"
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Cover Image</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      value={editing.imageUrl || ""}
                      onChange={e => setEditing(prev => ({ ...prev!, imageUrl: e.target.value }))}
                      placeholder="https://... or upload below"
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 whitespace-nowrap"
                      style={{ background: "rgba(232,93,4,0.08)", border: "1px solid rgba(232,93,4,0.2)", color: "#E85D04" }}
                    >
                      {isUploading ? (
                        <span className="animate-spin inline-block">↻</span>
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isUploading ? "Uploading..." : "Upload"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadImage(file);
                      }}
                    />
                  </div>
                  {editing.imageUrl && (
                    <div className="relative group">
                      <img
                        src={editing.imageUrl}
                        alt="preview"
                        className="mt-1 h-28 rounded-xl object-cover w-full border border-gray-100"
                        onError={e => (e.currentTarget.style.display = "none")}
                      />
                      <button
                        type="button"
                        onClick={() => setEditing(prev => ({ ...prev!, imageUrl: "" }))}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1.5">Accepts JPEG, PNG, GIF, WebP · Max 25 MB</p>
                </div>

                {/* Excerpt */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Excerpt</label>
                  <textarea
                    value={editing.excerpt || ""}
                    onChange={e => setEditing(prev => ({ ...prev!, excerpt: e.target.value }))}
                    placeholder="Brief summary shown in listings..."
                    rows={2}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Content *</label>
                  <RichTextEditor
                    content={editing.content || ""}
                    onChange={val => setEditing(prev => ({ ...prev!, content: val }))}
                    placeholder="Write your full blog post content here..."
                  />
                </div>

                {/* Author info */}
                <div className="rounded-2xl p-5 space-y-4" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-black uppercase tracking-wider text-gray-400">Author Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">Author Name</label>
                      <input
                        value={editing.author || ""}
                        onChange={e => setEditing(prev => ({ ...prev!, author: e.target.value }))}
                        placeholder="Author name"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1.5">Avatar URL</label>
                      <input
                        value={editing.authorAvatarUrl || ""}
                        onChange={e => setEditing(prev => ({ ...prev!, authorAvatarUrl: e.target.value }))}
                        placeholder="https://..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1.5">Author Bio</label>
                    <textarea
                      value={editing.authorBio || ""}
                      onChange={e => setEditing(prev => ({ ...prev!, authorBio: e.target.value }))}
                      placeholder="Brief author bio shown at the end of each post..."
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>

                {/* Reading time override */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-400 mb-2">Reading Time Override (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={editing.readingTimeOverride ?? ""}
                    onChange={e => setEditing(prev => ({ ...prev!, readingTimeOverride: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="Auto-calculated if empty"
                    className={inputClass}
                  />
                </div>

                {/* View count adjustment — only shown when editing an existing post */}
                {editing.id && (
                  <div className="rounded-2xl p-5 space-y-3" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-gray-400" />
                      <p className="text-xs font-black uppercase tracking-wider text-gray-400">View Count</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editing.viewCount ?? 0}
                        onChange={e => setEditing(prev => ({ ...prev!, viewCount: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                        className={`${inputClass} flex-1`}
                        aria-label="View count"
                      />
                      <button
                        type="button"
                        onClick={() => setEditing(prev => ({ ...prev!, viewCount: 0 }))}
                        className="px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all hover:scale-105"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                      >
                        Reset to 0
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">Adjust or reset the view count to correct bot inflation or testing data.</p>
                  </div>
                )}

                {/* Featured + Published toggles */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <div
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${editing.featured ? "bg-amber-500" : "bg-gray-300"}`}
                      onClick={() => setEditing(prev => ({ ...prev!, featured: !prev?.featured }))}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${editing.featured ? "left-7" : "left-1"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        <Star className={`w-3.5 h-3.5 ${editing.featured ? "fill-amber-500 text-amber-500" : "text-gray-400"}`} />
                        {editing.featured ? "Featured" : "Not Featured"}
                      </p>
                      <p className="text-xs text-gray-400">Hero spot on listing</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                    <div
                      className={`w-12 h-6 rounded-full transition-all duration-300 relative cursor-pointer ${editing.published ? "bg-green-500" : "bg-gray-300"}`}
                      onClick={() => setEditing(prev => ({ ...prev!, published: !prev?.published }))}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${editing.published ? "left-7" : "left-1"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {editing.published ? "Published" : "Draft"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {editing.published ? "Visible to all" : "Hidden from public"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={closeEditor}
                  className="px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white text-sm disabled:opacity-50 transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)", boxShadow: "0 4px 16px rgba(232,93,4,0.3)" }}
                >
                  {isSaving ? (
                    <><span className="animate-spin inline-block">↻</span> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" /> {editing.id ? "Update Post" : "Publish Post"}</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Categories Manager Modal */}
      <AnimatePresence>
        {isCatManagerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setIsCatManagerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-3xl overflow-hidden bg-white"
              style={{ border: "1px solid #e5e7eb", boxShadow: "0 25px 60px rgba(0,0,0,0.15)" }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(232,93,4,0.08)", border: "1px solid rgba(232,93,4,0.15)" }}>
                    <Settings2 className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black font-display text-gray-900">Blog Categories</h2>
                    <p className="text-xs text-gray-400">Drag to reorder · add or remove categories</p>
                  </div>
                </div>
                <button onClick={() => setIsCatManagerOpen(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(() => {
                    const postCountByCategory = posts.reduce<Record<string, number>>((acc, p) => {
                      const cat = p.category ?? "General";
                      acc[cat] = (acc[cat] ?? 0) + 1;
                      return acc;
                    }, {});
                    return localCatOrder.map((cat, idx) => (
                      <div
                        key={cat}
                        ref={el => { catItemRefs.current[idx] = el; }}
                        onPointerEnter={() => handleRowPointerEnter(idx)}
                        className="flex items-center justify-between px-3 py-3 rounded-xl border cursor-default select-none transition-all duration-150"
                        style={{
                          background: draggingIdx === idx ? "#fff7ed" : "#f9fafb",
                          borderColor: draggingIdx === idx ? "rgba(232,93,4,0.35)" : "#f3f4f6",
                          boxShadow: draggingIdx === idx ? "0 4px 16px rgba(232,93,4,0.12)" : undefined,
                          opacity: draggingIdx !== null && draggingIdx !== idx ? 0.6 : 1,
                          transform: draggingIdx === idx ? "scale(1.02)" : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            onPointerDown={e => handleGripPointerDown(e, idx)}
                            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-orange-400 transition-colors shrink-0"
                            style={{ touchAction: "none" }}
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="text-sm font-semibold text-gray-800 truncate">{cat}</span>
                          {(() => {
                            const count = postCountByCategory[cat] ?? 0;
                            return count > 0 ? (
                              <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-100 shrink-0">
                                {count} {count === 1 ? "post" : "posts"}
                              </span>
                            ) : (
                              <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-gray-400 bg-gray-100 border border-gray-200 shrink-0">
                                No posts
                              </span>
                            );
                          })()}
                        </div>
                        <button
                          onClick={async () => { await refetchCategories(); setCatDeleteConfirm(cat); setCatReassignTo(""); }}
                          disabled={deleteCategoryMutation.isPending}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                          title="Remove category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ));
                  })()}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <input
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && newCatName.trim() && addCategoryMutation.mutate(newCatName.trim())}
                    placeholder="New category name..."
                    className={`${inputClass} flex-1`}
                    maxLength={60}
                  />
                  <button
                    onClick={() => newCatName.trim() && addCategoryMutation.mutate(newCatName.trim())}
                    disabled={!newCatName.trim() || addCategoryMutation.isPending}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:scale-105"
                    style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Delete this blog post?"
        description="This action cannot be undone. The post will be permanently removed."
        confirmText="Delete Post"
        onConfirm={() => {
          if (deleteConfirm !== null) {
            handleDelete(deleteConfirm);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <AnimatePresence>
        {catDeleteConfirm !== null && (() => {
          const affectedPosts = posts.filter(p => p.category === catDeleteConfirm);
          const affectedCount = affectedPosts.length;
          const otherCategories = categories.filter(c => c !== catDeleteConfirm);
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={e => { if (e.target === e.currentTarget) setCatDeleteConfirm(null); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-sm">Remove "{catDeleteConfirm}" category?</h3>
                      {affectedCount > 0 ? (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          <span className="font-semibold text-orange-600">{affectedCount} post{affectedCount !== 1 ? "s" : ""}</span> use this category and will become orphaned unless reassigned.
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          No posts use this category. It will be removed from the dropdown.
                        </p>
                      )}
                    </div>
                    <button onClick={() => setCatDeleteConfirm(null)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {affectedCount > 0 && otherCategories.length > 0 && (
                    <div className="rounded-xl p-3 space-y-2" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                      <p className="text-xs font-semibold text-gray-600">Reassign affected posts to:</p>
                      <select
                        value={catReassignTo}
                        onChange={e => setCatReassignTo(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      >
                        <option value="">— Leave as-is (orphaned) —</option>
                        {otherCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {catReassignTo && catReassignTo === catDeleteConfirm && (
                  <p className="mx-6 -mt-2 mb-2 text-xs text-red-600 font-semibold">
                    Cannot reassign posts to the same category being deleted.
                  </p>
                )}
                <div className="flex gap-3 px-6 pb-6">
                  <button
                    onClick={() => setCatDeleteConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (catReassignTo && catReassignTo === catDeleteConfirm) return;
                      deleteCategoryMutation.mutate({ name: catDeleteConfirm, reassignTo: catReassignTo || undefined });
                      setCatDeleteConfirm(null);
                    }}
                    disabled={deleteCategoryMutation.isPending || (!!catReassignTo && catReassignTo === catDeleteConfirm)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </AdminLayout>
  );
}
