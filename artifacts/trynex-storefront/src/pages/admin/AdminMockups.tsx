import { useState, useRef, useCallback, useEffect } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useListProducts } from "@workspace/api-client-react";
import { getAuthHeaders, getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImageIcon, Upload, Trash2, Pencil, X, Check, Plus, Search,
  Tag, Package, Eye, EyeOff, GripVertical, Loader2, RefreshCw,
  ChevronUp, ChevronDown, Filter,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Mockup {
  id: number;
  name: string;
  description: string | null;
  productId: number | null;
  productName: string | null;
  imageUrl: string;
  thumbUrl: string | null;
  tags: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  isCanonical?: boolean;
  masterFileUrl?: string | null;
  masterFileName?: string | null;
  masterFileMime?: string | null;
  masterFileSize?: number | null;
  masterFileSha256?: string | null;
  sourceKitKey?: string | null;
  face?: string | null;
  color?: string | null;
  manifestJson?: Record<string, unknown> | null;
  ingestionStatus?: "preview-only" | "pending" | "ready" | "failed";
  ingestionError?: string | null;
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(getApiUrl(path), {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      ...getAuthHeaders(),
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).message ?? `HTTP ${res.status}`);
  }
  return res.json();
}

function isMasterFile(file: File): boolean {
  return /\.(psd|psb)$/i.test(file.name) || [
    "image/vnd.adobe.photoshop",
    "application/vnd.adobe.photoshop",
    "image/x-photoshop",
  ].includes(file.type);
}

function contentTypeFor(file: File): string {
  if (/\.psb$/i.test(file.name)) return "application/vnd.adobe.photoshop";
  if (/\.psd$/i.test(file.name)) return "image/vnd.adobe.photoshop";
  if (file.type) return file.type;
  return "application/octet-stream";
}

async function uploadFile(file: File, visibility: "public" | "private" = "public"): Promise<string> {
  const contentType = contentTypeFor(file);
  const { uploadURL, objectPath } = await apiFetch("/api/storage/uploads/request-url", {
    method: "POST",
    body: JSON.stringify({
      name: `mockup-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`,
      contentType,
      size: file.size,
    }),
  });
  const put = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
  if (!put.ok) throw new Error(`Storage upload failed (${put.status})`);
  if (visibility === "private") return objectPath;
  return getApiUrl(`/api/storage/public-objects/${objectPath}`);
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function buildIngestionManifest(masterFile: File | null, sourceKitKey: string | null | undefined, masterFileSha256: string | null) {
  if (!masterFile || !sourceKitKey || !masterFileSha256) return null;
  try {
    const response = await fetch("/mockups/psd-master-v10/runtime-roles/manifest.json", { cache: "no-store" });
    if (!response.ok) return null;
    const release = await response.json() as {
      surfaces?: Array<{
        surfaceKey: string;
        family: string;
        color: string;
        view: string;
        masterPath: string;
        masterChecksum: string;
        printZone: { x: number; y: number; w: number; h: number };
        normalizedFrame?: { canvasWidth: number; canvasHeight: number };
        smartObject?: { layerName: string };
        roles: Record<string, { path: string; sha256: string; sourceLayerPrefix: string }>;
      }>;
    };
    const surface = release.surfaces?.find((candidate) => candidate.surfaceKey === sourceKitKey);
    if (!surface || !surface.roles) return null;
    const runtimeRoles = Object.fromEntries(
      Object.entries(surface.roles).map(([role, asset]) => [
        role,
        {
          ...asset,
          path: `/mockups/psd-master-v10/runtime-roles/${surface.family}/${surface.color}/${asset.path.split("/").pop()}`,
        },
      ]),
    );
    return {
      schema: "trynex-smart-mockup-ingestion/v1",
      releaseVersion: "smart-v10.3",
      sourceKitKey,
      category: surface.family,
      color: surface.color,
      face: surface.view,
      master: {
        fileName: masterFile.name,
        mime: contentTypeFor(masterFile),
        size: masterFile.size,
        // The server recomputes and binds this checksum to the uploaded bytes.
        // Never use the catalog checksum here: an uploaded replacement master
        // must be validated from its actual contents.
        sha256: masterFileSha256,
        provenance: "catalog-psd-smart-object",
         smartObjectLayer: surface.smartObject?.layerName ?? "",
         geometry: {
           canvasWidth: surface.normalizedFrame?.canvasWidth ?? 1024,
           canvasHeight: surface.normalizedFrame?.canvasHeight ?? 1024,
           x: surface.printZone.x,
           y: surface.printZone.y,
           w: surface.printZone.w,
           h: surface.printZone.h,
         },
      },
      runtimeRoles,
      printZone: {
        x: surface.printZone.x / 1024,
        y: surface.printZone.y / 1024,
        w: surface.printZone.w / 1024,
        h: surface.printZone.h / 1024,
      },
      blendModes: { shadow: "multiply", highlight: "screen", protected: "source-over" },
    };
  } catch {
    return null;
  }
}

function TagBadge({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-600 transition-colors">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}

interface EditModal {
  mockup: Mockup;
}

export default function AdminMockups() {
  const [mockups, setMockups] = useState<Mockup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState<string>("");
  const [filterActive, setFilterActive] = useState<string>("");
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editProductId, setEditProductId] = useState<string>("");
  const [editProductName, setEditProductName] = useState("");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Mockup | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: productsData } = useListProducts({ limit: 200 });
  const products = (productsData as any)?.data ?? ((productsData as any)?.products ?? []);

  const fetchMockups = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (filterProduct) params.set("productId", filterProduct);
      if (filterActive) params.set("active", filterActive);
      const data = await apiFetch(`/api/admin/mockups?${params}`);
      setMockups(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setLoadError(err.message || "Could not load mockups.");
      toast({ title: "Failed to load mockups", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [search, filterProduct, filterActive]);

  useEffect(() => {
    void fetchMockups();
  }, [fetchMockups]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    const target = uploadTarget;
    const selected = Array.from(files);
    const masters = selected.filter(isMasterFile);
    const previews = selected.filter(file => file.type.startsWith("image/"));
    if (masters.length > 0 && previews.length === 0 && !target?.imageUrl) {
      toast({ title: "PSD/PSB preview required", description: "Select the editable PSD/PSB together with a PNG, JPG, or WebP preview.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const previewFiles = previews.length ? previews : [null];
      for (let i = 0; i < Math.max(previewFiles.length, masters.length || 1); i++) {
        const previewFile = previewFiles[i] ?? previewFiles[0] ?? null;
        const masterFile = masters[i] ?? masters[0] ?? null;
        const imageUrl = previewFile ? await uploadFile(previewFile, "public") : target?.imageUrl;
        if (!imageUrl) throw new Error("A preview image is required for every gallery record.");
        const masterFileUrl = masterFile ? await uploadFile(masterFile, "private") : null;
        const masterFileSha256 = masterFile ? await sha256File(masterFile) : null;
        const manifestJson = await buildIngestionManifest(masterFile, target?.sourceKitKey, masterFileSha256);
        const fileName = (masterFile ?? previewFile)?.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ") ?? "Mockup";
        const name = target ? `${target.name} — override` : fileName;
        const tags = Array.from(new Set([...(target?.tags ?? []), ...(target ? ["override"] : ["uploaded"]), ...(masterFile ? ["psd-master"] : [])]));
        const created = await apiFetch("/api/admin/mockups", {
          method: "POST",
          body: JSON.stringify({
            name,
            description: masterFile ? `Editable ${/\.psb$/i.test(masterFile.name) ? "PSB" : "PSD"} master with preview` : target ? `Editable override for ${target.name}` : null,
            productId: target?.productId ?? null,
            productName: target?.productName ?? null,
            imageUrl,
            masterFileUrl,
            masterFileName: masterFile?.name ?? null,
            masterFileMime: masterFile ? contentTypeFor(masterFile) : null,
            masterFileSize: masterFile?.size ?? null,
            masterFileSha256,
            sourceKitKey: target?.sourceKitKey ?? null,
            face: target?.face ?? null,
            color: target?.color ?? null,
            manifestJson,
            // The API decides readiness only after the complete source-kit
            // manifest and all six runtime roles have been validated.
            ingestionStatus: masterFile ? "pending" : "preview-only",
            tags,
            isActive: true,
            sortOrder: target?.sortOrder ?? 0,
          }),
        });
        toast({
          title: masterFile ? (created.ingestionStatus === "ready" ? "Validated PSD/PSB master uploaded" : "PSD/PSB queued for validation") : target ? "Live override uploaded" : "Mockup uploaded",
          description: created.ingestionStatus === "failed" ? created.ingestionError : name,
          variant: created.ingestionStatus === "failed" ? "destructive" : "default",
        });
      }
      await fetchMockups();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadTarget(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startUpload = (target: Mockup | null = null) => {
    setUploadTarget(target);
    window.setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const openEdit = (m: Mockup) => {
    setEditModal({ mockup: m });
    setEditName(m.name);
    setEditDesc(m.description ?? "");
    setEditProductId(m.productId ? String(m.productId) : "");
    setEditProductName(m.productName ?? "");
    setEditTags(Array.isArray(m.tags) ? m.tags : []);
    setEditTagInput("");
    setEditActive(m.isActive);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    setSaving(true);
    try {
      const prod = products.find((p: any) => String(p.id) === editProductId);
      await apiFetch(`/api/admin/mockups/${editModal.mockup.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName,
          description: editDesc || null,
          productId: editProductId ? parseInt(editProductId, 10) : null,
          productName: prod?.name ?? (editProductName || null),
          tags: editTags,
          isActive: editActive,
        }),
      });
      toast({ title: "Mockup saved" });
      setEditModal(null);
      await fetchMockups();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (m: Mockup) => {
    try {
      await apiFetch(`/api/admin/mockups/${m.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !m.isActive }),
      });
      setMockups(prev => prev.map(x => x.id === m.id ? { ...x, isActive: !m.isActive } : x));
    } catch (err: any) {
      toast({ title: "Failed to toggle", description: err.message, variant: "destructive" });
    }
  };

  const deleteMockup = async (id: number) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/admin/mockups/${id}`, { method: "DELETE" });
      toast({ title: "Mockup deleted" });
      setMockups(prev => prev.filter(m => m.id !== id));
      setConfirmDelete(null);
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const moveSort = async (id: number, direction: "up" | "down") => {
    const current = mockups.find(m => m.id === id);
    if (current?.isCanonical) return;
    const idx = mockups.findIndex(m => m.id === id);
    if (idx < 0) return;
    const newMockups = [...mockups];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= newMockups.length) return;
    [newMockups[idx], newMockups[swapIdx]] = [newMockups[swapIdx], newMockups[idx]];
    const order = newMockups.map((m, i) => ({ id: m.id, sortOrder: i }));
    setMockups(newMockups.map((m, i) => ({ ...m, sortOrder: i })));
    try {
      await apiFetch("/api/admin/mockups/reorder", { method: "POST", body: JSON.stringify({ order }) });
    } catch {
      await fetchMockups();
    }
  };

  const addEditTag = () => {
    const t = editTagInput.trim().toLowerCase();
    if (t && !editTags.includes(t)) setEditTags(prev => [...prev, t]);
    setEditTagInput("");
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Mockup Gallery</h1>
            <p className="text-sm text-gray-500 mt-0.5">{mockups.length} mockup{mockups.length !== 1 ? "s" : ""} · Manage product mockup images for the Design Studio</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchMockups()}
              aria-label="Refresh mockup gallery"
              disabled={loading}
              className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.psd,.psb"
              multiple
              className="hidden"
              onChange={e => handleUpload(e.target.files)}
            />
            <button
              onClick={() => startUpload()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? "Uploading…" : "Upload Mockups"}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchMockups()}
              placeholder="Search by name…"
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
            />
          </div>
          <select
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          >
            <option value="">All Products</option>
            {products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={e => setFilterActive(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            onClick={fetchMockups}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
        </div>

        {/* Drop zone hint */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
          className="mb-6 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-orange-300 hover:bg-orange-50/30 transition-all"
        >
          <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400 font-medium">Drag & drop mockup images here, or click <strong className="text-orange-500">Upload Mockups</strong></p>
              <p className="text-xs text-gray-300 mt-1">PNG, JPG, WebP · PSD/PSB master + preview pair · Multiple files supported</p>
        </div>

        {/* Grid */}
         {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
          </div>
         ) : loadError ? (
           <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
             <p className="font-black text-red-700">Could not load mockups</p>
             <p className="mt-1 text-sm text-red-600">{loadError}</p>
             <button type="button" onClick={() => void fetchMockups()} className="mt-4 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-100">
               Try again
             </button>
           </div>
        ) : mockups.length === 0 ? (
          <div className="text-center py-20">
            <ImageIcon className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <h3 className="font-bold text-gray-400 mb-2">No mockups yet</h3>
            <p className="text-sm text-gray-300">Upload mockup images using the button above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <AnimatePresence>
              {mockups.map((m, idx) => (
               <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative rounded-2xl overflow-hidden border border-gray-100 shadow-sm bg-white"
                  style={{ opacity: m.isActive ? 1 : 0.55 }}
                >
                  {/* Image */}
                  <div
                    className="aspect-square relative overflow-hidden cursor-zoom-in"
                    style={{ background: "radial-gradient(ellipse at 50% 40%, #f5f5f3 0%, #e8e5e0 100%)" }}
                    onClick={() => setLightbox(m.imageUrl)}
                  >
                    <img
                      src={m.thumbUrl ?? m.imageUrl}
                      alt={m.name}
                      className="w-full h-full object-contain transition-transform group-hover:scale-105"
                      style={{ padding: "6%" }}
                    />
                    {!m.isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-50/60">
                        <span className="text-[10px] font-black text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">INACTIVE</span>
                      </div>
                    )}
                    {/* Database-upload controls are intentionally hidden for canonical source-kit rows. */}
                    {!m.isCanonical && <div className="absolute left-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); moveSort(m.id, "up"); }}
                        disabled={idx === 0}
                        className="p-0.5 rounded bg-white/80 text-gray-600 disabled:opacity-30 hover:bg-white"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); moveSort(m.id, "down"); }}
                        disabled={idx === mockups.length - 1}
                        className="p-0.5 rounded bg-white/80 text-gray-600 disabled:opacity-30 hover:bg-white"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>}
                    {/* Action buttons */}
                    {!m.isCanonical && <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(m); }}
                        className="p-1 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow-sm"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); toggleActive(m); }}
                        className="p-1 rounded-lg bg-white/90 text-gray-700 hover:bg-white shadow-sm"
                        title={m.isActive ? "Deactivate" : "Activate"}
                      >
                        {m.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDelete(m.id); }}
                        className="p-1 rounded-lg bg-white/90 text-red-500 hover:bg-red-50 shadow-sm"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>}
                    {m.isCanonical && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); startUpload(m); }}
                          className="absolute top-1 right-1 p-1 rounded-lg bg-orange-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          title="Upload editable live override"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-2 left-2 text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/90 text-orange-600 shadow-sm">
                          Source kit · click pencil to override
                        </span>
                      </>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-2.5 py-2 border-t border-gray-50">
                    <p className="text-[11px] font-black text-gray-800 truncate">{m.name}</p>
                    {m.productName && (
                      <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-0.5 truncate">
                        <Package className="w-2.5 h-2.5 shrink-0" /> {m.productName}
                      </p>
                    )}
                    {m.masterFileName && (
                      <p className="text-[9px] text-purple-600 mt-1 truncate" title={m.masterFileName}>Editable master: {m.masterFileName}</p>
                    )}
                     {m.ingestionStatus && (
                       <div className="mt-1">
                         <span className={`inline-flex text-[8px] font-bold px-1.5 py-0.5 rounded-full ${m.ingestionStatus === "ready" ? "bg-emerald-50 text-emerald-700" : m.ingestionStatus === "failed" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                           {m.ingestionStatus}
                         </span>
                         {m.ingestionError && (
                           <p className="mt-1 line-clamp-3 text-[9px] leading-3 text-red-600" title={m.ingestionError}>
                             {m.ingestionError}
                           </p>
                         )}
                       </div>
                     )}
                    {Array.isArray(m.tags) && m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {m.tags.slice(0, 3).map(t => (
                          <span key={t} className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">{t}</span>
                        ))}
                        {m.tags.length > 3 && <span className="text-[8px] text-gray-400">+{m.tags.length - 3}</span>}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setEditModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-black text-gray-800">Edit Mockup</h2>
                <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Preview */}
                <div className="flex gap-3 items-start">
                  <img
                    src={editModal.mockup.thumbUrl ?? editModal.mockup.imageUrl}
                    alt=""
                    className="w-16 h-16 rounded-xl object-contain border border-gray-100"
                    style={{ background: "#f5f5f3" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Image URL</p>
                    <p className="text-[10px] text-gray-500 break-all leading-tight">{editModal.mockup.imageUrl}</p>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Name *</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                    placeholder="Mockup name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Description</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 resize-none"
                    placeholder="Optional description"
                  />
                </div>

                {/* Product */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Linked Product</label>
                  <select
                    value={editProductId}
                    onChange={e => setEditProductId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                  >
                    <option value="">No product linked</option>
                    {products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {editTags.map(t => (
                      <TagBadge key={t} tag={t} onRemove={() => setEditTags(prev => prev.filter(x => x !== t))} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={editTagInput}
                      onChange={e => setEditTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEditTag(); } }}
                      placeholder="Add tag (press Enter)"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400"
                    />
                    <button onClick={addEditTag} className="px-3 py-2 rounded-xl text-sm font-bold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                 {editModal.mockup.masterFileUrl && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 space-y-2">
                    <div>
                      <p className="text-sm font-bold text-purple-900">Editable master binding</p>
                       <p className="text-[11px] text-purple-700">Only a complete PSD/PSB source package with matching six-role runtime assets can become ready. Readiness is controlled by server validation.</p>
                    </div>
                     <div className="flex items-center justify-between rounded-lg border border-purple-100 bg-white px-3 py-2">
                       <span className="text-[11px] font-bold text-purple-700">Validation status</span>
                       <span className={`text-[11px] font-black ${editModal.mockup.ingestionStatus === "ready" ? "text-emerald-700" : editModal.mockup.ingestionStatus === "failed" ? "text-red-700" : "text-amber-700"}`}>
                         {editModal.mockup.ingestionStatus ?? "pending"}
                       </span>
                     </div>
                     {editModal.mockup.ingestionError && (
                       <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] leading-4 text-red-700">{editModal.mockup.ingestionError}</p>
                     )}
                    <p className="text-[10px] text-purple-700 truncate" title={editModal.mockup.masterFileName ?? undefined}>Master: {editModal.mockup.masterFileName ?? "attached"}</p>
                  </div>
                )}

                {/* Active */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-700">Active</p>
                    <p className="text-[11px] text-gray-400">Visible in Design Studio</p>
                  </div>
                  <button
                    onClick={() => setEditActive(v => !v)}
                    className="relative w-11 h-6 rounded-full transition-colors"
                    style={{ background: editActive ? "#E85D04" : "#d1d5db" }}
                  >
                    <span
                      className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: editActive ? "translateX(22px)" : "translateX(2px)" }}
                    />
                  </button>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setEditModal(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving || !editName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, #E85D04, #FB8500)" }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm */}
      <AnimatePresence>
        {confirmDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="font-black text-gray-800 mb-2">Delete Mockup?</h3>
              <p className="text-sm text-gray-500 mb-5">This cannot be undone.</p>
              <div className="flex gap-2">
               <button type="button" onClick={() => deletingId === null && setConfirmDelete(null)} disabled={deletingId !== null} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                <button type="button" onClick={() => deleteMockup(confirmDelete!)} disabled={deletingId !== null} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60">{deletingId !== null ? "Deleting…" : "Delete"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setLightbox(null)}
          >
            <motion.img
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              src={lightbox}
              alt="Mockup preview"
              className="max-w-full max-h-[90vh] rounded-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}
