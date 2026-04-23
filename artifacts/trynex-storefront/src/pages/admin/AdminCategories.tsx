import { useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  type Category,
} from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders } from "@/lib/utils";
import { Plus, Trash2, Edit3, Layers, Package, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const categorySchema = z.object({
  name: z.string().min(2, "Name required"),
  slug: z.string().min(2, "Slug required").regex(/^[a-z0-9-]+$/, "lowercase letters, numbers, hyphens only"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
});

type CategoryForm = z.infer<typeof categorySchema>;

const inputClass = "w-full px-3.5 py-2.5 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400 border border-gray-200 bg-white text-gray-900";

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">{children}</label>
);

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminCategories() {
  const { toast } = useToast();
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const { data, isLoading } = useListCategories();
  const reqOpts = { request: { headers: getAuthHeaders() } };
  const { mutateAsync: createCategory, isPending: isCreating } = useCreateCategory(reqOpts);
  const { mutateAsync: updateCategory, isPending: isUpdating } = useUpdateCategory(reqOpts);
  const { mutateAsync: deleteCategory } = useDeleteCategory(reqOpts);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CategoryForm>({
    resolver: zodResolver(categorySchema),
  });

  const categories: Category[] = data?.categories ?? [];

  const openAddModal = () => {
    setEditingId(null);
    reset({ name: "", slug: "", description: "", imageUrl: "" });
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingId(cat.id);
    reset({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      imageUrl: cat.imageUrl ?? "",
    });
    setModalOpen(true);
  };

  const onSubmit = async (formData: CategoryForm) => {
    try {
      if (editingId) {
        await updateCategory({ id: editingId, data: formData });
        toast({ title: "Category updated" });
      } else {
        await createCategory(formData);
        toast({ title: "Category created" });
      }
      setModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err?.message || "Could not save category",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteCategory(deleteConfirm.id);
      toast({ title: "Category deleted" });
    } catch (err: any) {
      toast({
        title: "Failed to delete",
        description: err?.message || "Some categories cannot be deleted while products are linked to them.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-black text-2xl text-gray-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-orange-500" />
              Categories
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage product categories shown in the storefront filters.</p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 16px rgba(232,93,4,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No categories yet. Create your first one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  {cat.imageUrl ? (
                    <img src={cat.imageUrl} alt={cat.name} className="w-14 h-14 rounded-xl object-cover bg-gray-50" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center">
                      <Package className="w-6 h-6 text-orange-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{cat.name}</h3>
                    <p className="text-xs text-gray-400 truncate">/{cat.slug}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      <span className="font-semibold text-gray-700">{cat.productCount ?? 0}</span> products
                    </p>
                  </div>
                </div>
                {cat.description && (
                  <p className="text-xs text-gray-500 mt-3 line-clamp-2">{cat.description}</p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => openEditModal(cat)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-gray-100"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  {(cat.productCount ?? 0) === 0 ? (
                    <button
                      onClick={() => setDeleteConfirm({ id: cat.id, name: cat.name })}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-red-500 bg-red-50 hover:bg-red-100"
                      aria-label="Delete category"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-gray-300 bg-gray-50 cursor-not-allowed"
                      aria-label="Cannot delete — category has products"
                      title={`Cannot delete — ${cat.productCount} product(s) linked. Move or remove them first.`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-black text-xl text-gray-900">
                  {editingId ? "Edit Category" : "Add Category"}
                </h2>
                <button onClick={() => setModalOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label>Name</Label>
                  <input
                    {...register("name", {
                      onChange: (e) => {
                        if (!editingId && !watch("slug")) {
                          setValue("slug", slugify(e.target.value));
                        }
                      }
                    })}
                    className={inputClass}
                    placeholder="e.g. T-Shirts"
                  />
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <Label>Slug</Label>
                  <input {...register("slug")} className={inputClass} placeholder="e.g. t-shirts" />
                  {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug.message}</p>}
                </div>

                <div>
                  <Label>Description (optional)</Label>
                  <textarea {...register("description")} className={inputClass} rows={3} />
                </div>

                <div>
                  <Label>Image URL (optional)</Label>
                  <input {...register("imageUrl")} className={inputClass} placeholder="https://..." />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || isUpdating}
                    className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
                  >
                    {isCreating || isUpdating ? "Saving..." : editingId ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete category?"
        description={deleteConfirm ? `"${deleteConfirm.name}" will be permanently removed. This category has no linked products.` : ""}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </AdminLayout>
  );
}
