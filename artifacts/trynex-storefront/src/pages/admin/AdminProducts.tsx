import { useState, useEffect, useRef } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListProducts, useCreateProduct, useDeleteProduct, useUpdateProduct, useListCategories,
  getListProductsQueryKey,
  type Category, type Product, type CreateProductRequest, type UpdateProductRequest
} from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders, formatPrice, getApiUrl } from "@/lib/utils";
import { Plus, Trash2, X, Package, Edit3, AlertTriangle, Search, Star, Upload, FileText, CheckCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSearch } from "wouter";

const productSchema = z.object({
  name: z.string().min(2, "Name required"),
  slug: z.string().min(2, "Slug required"),
  description: z.string().optional(),
  price: z.coerce.number().min(1, "Price required"),
  discountPrice: z.coerce.number().optional(),
  stock: z.coerce.number().min(0),
  categoryId: z.coerce.number().optional(),
  imageUrl: z.string().optional(),
  sizes: z.string().optional(),
  colors: z.string().optional(),
  featured: z.boolean().optional(),
  customizable: z.boolean().optional(),
}).refine(
  (data) => !data.discountPrice || data.discountPrice < data.price,
  { message: "Discount price must be less than the regular price", path: ["discountPrice"] }
);

type ProductForm = z.infer<typeof productSchema>;

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400 border border-gray-200 bg-white text-gray-900";
const inputStyle = { background: 'white', border: '1px solid #e5e7eb', color: '#111827' };

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{children}</label>
);

type EditingProduct = { id: number } & ProductForm & { rawSizes?: string[]; rawColors?: string[] };

export default function AdminProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const filterLowStock = urlParams.get("filter") === "lowstock";
  const [search, setSearch] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditingProduct | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [showLowStock, setShowLowStock] = useState(filterLowStock);

  const { data, isLoading } = useListProducts({ limit: 200 });
  const { data: categoriesData } = useListCategories();
  const reqOpts = { request: { headers: getAuthHeaders() } };
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProduct(reqOpts);
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProduct(reqOpts);
  const { mutateAsync: deleteProduct } = useDeleteProduct(reqOpts);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { featured: false, customizable: true, stock: 0 }
  });

  const categories: Category[] = categoriesData?.categories ?? [];

  const openAddModal = () => {
    setEditingProduct(null);
    reset({ featured: false, customizable: true, stock: 0, categoryId: categories[0]?.id });
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct({ id: product.id, slug: product.slug } as EditingProduct);
    reset({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: parseFloat(product.price),
      discountPrice: product.discountPrice ? parseFloat(product.discountPrice) : undefined,
      stock: product.stock,
      categoryId: product.categoryId || undefined,
      imageUrl: product.imageUrl || '',
      sizes: (product.sizes || []).join(', '),
      colors: (product.colors || []).join(', '),
      featured: product.featured ?? false,
      customizable: product.customizable ?? true,
    });
    setModalOpen(true);
  };

  const onSubmit = async (formData: ProductForm) => {
    try {
      const sizes = formData.sizes ? formData.sizes.split(',').map(s => s.trim()).filter(Boolean) : [];
      const colors = formData.colors ? formData.colors.split(',').map(s => s.trim()).filter(Boolean) : [];
      const payload = {
        ...formData,
        sizes,
        colors,
        discountPrice: formData.discountPrice || undefined,
        customizable: formData.customizable ?? true,
        featured: formData.featured ?? false,
        categoryId: formData.categoryId || undefined,
        description: formData.description || undefined,
        imageUrl: formData.imageUrl || undefined,
      };

      if (editingProduct) {
        const updatePayload: UpdateProductRequest = {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          price: payload.price,
          discountPrice: payload.discountPrice,
          stock: payload.stock,
          categoryId: payload.categoryId,
          imageUrl: payload.imageUrl,
          sizes: payload.sizes,
          colors: payload.colors,
          featured: payload.featured,
          customizable: payload.customizable,
        };
        await updateProduct({ id: editingProduct.id, data: updatePayload });
        toast({ title: "✓ Product updated successfully!" });
      } else {
        const createPayload: CreateProductRequest = {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
          price: payload.price,
          discountPrice: payload.discountPrice,
          stock: payload.stock,
          categoryId: payload.categoryId,
          imageUrl: payload.imageUrl,
          sizes: payload.sizes,
          colors: payload.colors,
          featured: payload.featured,
          customizable: payload.customizable,
        };
        await createProduct({ data: createPayload });
        toast({ title: "✓ Product added successfully!" });
      }
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setModalOpen(false);
      setEditingProduct(null);
      reset();
    } catch {
      toast({ title: `Failed to ${editingProduct ? 'update' : 'add'} product`, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProduct({ id });
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      toast({ title: "Product deleted" });
    } catch {
      toast({ title: "Failed to delete product", variant: "destructive" });
    }
  };

  const filteredProducts = (data?.products ?? []).filter(p => {
    if (showLowStock && p.stock > 5) return false;
    if (!search) return true;
    return p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase());
  });

  const lowStockCount = (data?.products ?? []).filter(p => p.stock <= 5).length;
  const isSaving = isCreating || isUpdating;

  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvRows = (text: string): string[][] => {
    const rows: string[][] = [];
    let current = '';
    let inQuotes = false;
    const fields: string[] = [];
    const raw = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < raw.length && raw[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else if (ch === '\n') {
          fields.push(current.trim());
          current = '';
          if (fields.some(f => f.length > 0)) rows.push([...fields]);
          fields.length = 0;
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    if (fields.some(f => f.length > 0)) rows.push([...fields]);
    return rows;
  };

  const parseCsvToBulk = (text: string) => {
    const rows = parseCsvRows(text);
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.toLowerCase());
    return rows.slice(1).map(row => {
      const values = row;
      const obj: any = {};
      headers.forEach((h, i) => {
        const val = values[i] || '';
        if (h === 'name') obj.name = val;
        else if (h === 'slug') obj.slug = val || val.toLowerCase().replace(/\s+/g, '-');
        else if (h === 'price') obj.price = parseFloat(val) || 0;
        else if (h === 'discountprice' || h === 'discount_price') obj.discountPrice = parseFloat(val) || undefined;
        else if (h === 'stock') obj.stock = parseInt(val) || 0;
        else if (h === 'description') obj.description = val;
        else if (h === 'imageurl' || h === 'image_url' || h === 'image') obj.imageUrl = val;
        else if (h === 'sizes') obj.sizes = val.split(/[;|]/).map((s: string) => s.trim()).filter(Boolean).join(',');
        else if (h === 'colors') obj.colors = val.split(/[;|]/).map((s: string) => s.trim()).filter(Boolean).join(',');
        else if (h === 'featured') obj.featured = val === 'true' || val === '1';
        else if (h === 'customizable') obj.customizable = val === 'true' || val === '1';
        else if (h === 'categoryid' || h === 'category_id') obj.categoryId = parseInt(val) || undefined;
      });
      if (!obj.slug && obj.name) obj.slug = obj.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return obj;
    }).filter(p => p.name && p.price);
  };

  const handleBulkFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBulkText(ev.target?.result as string || "");
      setBulkResult(null);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBulkUpload = async () => {
    const products = parseCsvToBulk(bulkText);
    if (products.length === 0) {
      toast({ title: "No valid products found", description: "Ensure CSV has headers: name,slug,price,stock", variant: "destructive" });
      return;
    }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const resp = await fetch(getApiUrl('/api/products/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ products }),
      });
      const result = await resp.json();
      setBulkResult(result);
      if (result.success > 0) {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: `${result.success} products added!`, description: result.failed > 0 ? `${result.failed} failed` : undefined });
      }
    } catch {
      toast({ title: "Bulk upload failed", variant: "destructive" });
    } finally {
      setBulkUploading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setModalOpen(false);
        setEditingProduct(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isModalOpen]);

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Inventory</p>
          <h1 className="text-4xl font-black font-display tracking-tighter text-gray-900">Products</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 font-medium">{data?.total ?? 0} total products</span>
            {lowStockCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
                <AlertTriangle className="w-3 h-3" /> {lowStockCount} low stock
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => { setBulkModalOpen(true); setBulkText(""); setBulkResult(null); }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
          >
            <Upload className="w-4 h-4" /> Bulk Upload
          </button>
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white text-sm transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all border border-gray-200 bg-white text-gray-900"
          />
        </div>
        <button
          onClick={() => setShowLowStock(!showLowStock)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            showLowStock
              ? "text-white shadow-md"
              : "text-gray-500 bg-gray-100 hover:bg-gray-200 border border-gray-200"
          }`}
          style={showLowStock ? { background: "linear-gradient(135deg, #d97706, #b45309)" } : {}}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Low Stock ({lowStockCount})
        </button>
      </div>

      {isLoading ? <Loader /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-2xl overflow-hidden group"
              style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}
            >
              {/* Image */}
              <div className="aspect-square relative overflow-hidden bg-gray-50">
                <img
                  src={product.imageUrl || `https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&fit=crop`}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {product.stock <= 5 && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-600">
                    <AlertTriangle className="w-3 h-3" /> Low Stock
                  </div>
                )}
                {product.featured && (
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 bg-orange-50 border border-orange-200 text-orange-600">
                    <Star className="w-2.5 h-2.5 fill-orange-500" /> Featured
                  </div>
                )}
                {/* Hover actions */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-end p-3 gap-2"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)' }}>
                  <button
                    onClick={() => openEditModal(product)}
                    className="p-2.5 rounded-xl transition-all hover:scale-110 bg-white/20 border border-white/30 text-white"
                    title="Edit product"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                    className="p-2.5 rounded-xl transition-all hover:scale-110"
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}
                    title="Delete product"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-sm leading-tight truncate mb-1 text-gray-900">{product.name}</h3>
                <p className="text-xs text-gray-400 truncate mb-3">{product.slug}</p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-black text-orange-600 text-sm">{formatPrice(parseFloat(product.price))}</span>
                    {product.discountPrice && (
                      <span className="ml-2 text-xs line-through text-gray-400">{formatPrice(parseFloat(product.discountPrice))}</span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                    style={{
                      background: product.stock === 0 ? 'rgba(239,68,68,0.1)' : product.stock <= 5 ? 'rgba(245,158,11,0.1)' : '#f3f4f6',
                      color: product.stock === 0 ? '#ef4444' : product.stock <= 5 ? '#f59e0b' : '#6b7280',
                      border: `1px solid ${product.stock === 0 ? 'rgba(239,68,68,0.2)' : product.stock <= 5 ? 'rgba(245,158,11,0.2)' : '#e5e7eb'}`
                    }}>
                    {product.stock === 0 ? 'Out of stock' : `Stock: ${product.stock}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                  <button
                    onClick={() => openEditModal(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: product.id, name: product.name })}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="col-span-full py-20 text-center">
              <Package className="w-14 h-14 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-400 font-medium text-lg">
                {search ? `No products matching "${search}"` : 'No products yet. Add your first product!'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-lg rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto bg-white"
              style={{ border: '1px solid #e5e7eb', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-black font-display text-gray-900">
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  {editingProduct && (
                    <p className="text-xs text-gray-400 mt-0.5">ID #{editingProduct.id} · {editingProduct.slug}</p>
                  )}
                </div>
                <button
                  onClick={() => { setModalOpen(false); setEditingProduct(null); }}
                  aria-label="Close modal"
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-xl transition-colors hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-7 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Product Name *</Label>
                    <input {...register("name")} className={inputClass} style={inputStyle} placeholder="e.g. Premium Oversized Hoodie" />
                    {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
                  </div>
                  <div>
                    <Label>URL Slug *</Label>
                    <input {...register("slug")} className={inputClass} style={inputStyle} placeholder="premium-hoodie" />
                    {errors.slug && <p className="text-red-500 text-xs mt-1">{errors.slug.message}</p>}
                  </div>
                  <div>
                    <Label>Category</Label>
                    <select {...register("categoryId")} className={inputClass} style={inputStyle}>
                      <option value="">Select category...</option>
                      {categories.map((cat: Category) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Price (৳) *</Label>
                    <input type="number" {...register("price")} className={inputClass} style={inputStyle} placeholder="1200" />
                    {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
                  </div>
                  <div>
                    <Label>Discount Price (৳)</Label>
                    <input type="number" {...register("discountPrice")} className={inputClass} style={inputStyle} placeholder="950 (optional)" />
                    {errors.discountPrice && <p className="text-red-500 text-xs mt-1">{errors.discountPrice.message}</p>}
                  </div>
                  <div>
                    <Label>Stock Quantity *</Label>
                    <input type="number" {...register("stock")} className={inputClass} style={inputStyle} placeholder="50" />
                  </div>
                  <div>
                    <Label>Image URL</Label>
                    <input {...register("imageUrl")} className={inputClass} style={inputStyle} placeholder="https://..." />
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <textarea {...register("description")} rows={3} className={`${inputClass} resize-none`} style={inputStyle} placeholder="Product description..." />
                  </div>
                  <div>
                    <Label>Sizes (comma separated)</Label>
                    <input {...register("sizes")} className={inputClass} style={inputStyle} placeholder="S, M, L, XL, XXL" />
                  </div>
                  <div>
                    <Label>Colors (comma separated)</Label>
                    <input {...register("colors")} className={inputClass} style={inputStyle} placeholder="Black, White, Grey" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" {...register("featured")} id="featured" className="w-4 h-4 rounded accent-orange-500" />
                    <label htmlFor="featured" className="text-sm font-semibold text-gray-600 cursor-pointer">Mark as Featured</label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" {...register("customizable")} id="customizable" className="w-4 h-4 rounded accent-orange-500" />
                    <label htmlFor="customizable" className="text-sm font-semibold text-gray-600 cursor-pointer">Allow Customization</label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 mt-2 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
                >
                  {editingProduct ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {isSaving ? "Saving..." : editingProduct ? "Update Product" : "Add Product"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Bulk Upload Modal */}
      <AnimatePresence>
        {bulkModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={(e) => e.target === e.currentTarget && setBulkModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[90vh] overflow-y-auto bg-white"
              style={{ border: '1px solid #e5e7eb', boxShadow: '0 25px 60px rgba(0,0,0,0.15)' }}
            >
              <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-xl font-black font-display text-gray-900">Bulk Product Upload</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Upload CSV file or paste data</p>
                </div>
                <button
                  onClick={() => setBulkModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 rounded-xl transition-colors hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-7 space-y-5">
                <div className="p-4 rounded-2xl bg-orange-50 border border-orange-100">
                  <p className="text-xs font-bold text-orange-700 mb-2">CSV Format (required headers):</p>
                  <code className="text-[11px] text-orange-600 block font-mono">
                    name,slug,price,stock,description,sizes,colors,imageUrl,featured,customizable
                  </code>
                  <p className="text-[11px] text-orange-500 mt-2">Sizes & colors: use semicolons to separate (e.g. "S;M;L;XL")</p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleBulkFileSelect}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    <FileText className="w-4 h-4" /> Choose CSV File
                  </button>
                  <span className="text-xs text-gray-400">or paste below</span>
                </div>

                <textarea
                  value={bulkText}
                  onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                  placeholder={`name,slug,price,stock,sizes,colors\nPremium Hoodie,premium-hoodie,1500,50,S;M;L;XL,Black;White\nCustom Mug,custom-mug,450,100,,`}
                  rows={8}
                  className="w-full px-4 py-3 rounded-2xl text-xs font-mono focus:outline-none bg-white border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all resize-none text-gray-800 placeholder-gray-400"
                />

                {bulkText && (
                  <p className="text-xs text-gray-500">
                    {parseCsvToBulk(bulkText).length} valid products detected
                  </p>
                )}

                {bulkResult && (
                  <div className={`p-4 rounded-2xl border ${bulkResult.failed > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className={`w-4 h-4 ${bulkResult.failed > 0 ? 'text-amber-600' : 'text-green-600'}`} />
                      <p className={`text-sm font-bold ${bulkResult.failed > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        {bulkResult.success} added, {bulkResult.failed} failed
                      </p>
                    </div>
                    {bulkResult.errors.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {bulkResult.errors.slice(0, 10).map((err, i) => (
                          <p key={i} className="text-xs text-red-500">{err}</p>
                        ))}
                        {bulkResult.errors.length > 10 && (
                          <p className="text-xs text-gray-400">...and {bulkResult.errors.length - 10} more</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !bulkText.trim()}
                  className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 6px 24px rgba(232,93,4,0.3)' }}
                >
                  <Upload className="w-4 h-4" />
                  {bulkUploading ? "Uploading..." : "Upload Products"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={`Delete "${deleteConfirm?.name}"?`}
        description="This action cannot be undone. The product will be permanently removed."
        confirmText="Delete Product"
        onConfirm={() => {
          if (deleteConfirm) {
            handleDelete(deleteConfirm.id);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </AdminLayout>
  );
}
