import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, formatPrice } from "@/lib/utils";
import { Gift, Plus, Trash2, Edit3, X, Save, Star } from "lucide-react";

interface HamperItem {
  productId?: number;
  name: string;
  quantity: number;
  imageUrl?: string;
}

interface Hamper {
  id: number;
  slug: string;
  name: string;
  nameBn?: string;
  description?: string;
  descriptionBn?: string;
  category: string;
  occasion?: string;
  imageUrl?: string;
  basePrice: number;
  discountPrice?: number;
  items: HamperItem[];
  active: boolean;
  featured: boolean;
  sortOrder: number;
  stock: number;
}

const empty: Partial<Hamper> = {
  slug: "",
  name: "",
  nameBn: "",
  description: "",
  category: "general",
  occasion: "",
  imageUrl: "",
  basePrice: 0,
  items: [],
  active: true,
  featured: false,
  stock: 100,
  sortOrder: 0,
};

export default function AdminHampers() {
  const { toast } = useToast();
  const [hampers, setHampers] = useState<Hamper[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Hamper> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem("trynex_admin_token");
      const res = await fetch(getApiUrl("/api/admin/hampers"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setHampers(data.hampers || []);
    } catch {
      toast({ title: "Failed to load hampers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.slug || !editing.basePrice) {
      toast({ title: "Missing fields", description: "Name, slug, and base price are required.", variant: "destructive" });
      return;
    }
    try {
      const token = sessionStorage.getItem("trynex_admin_token");
      const isUpdate = !!editing.id;
      const url = isUpdate ? getApiUrl(`/api/admin/hampers/${editing.id}`) : getApiUrl("/api/admin/hampers");
      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editing),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Save failed", description: err.message || "Try again", variant: "destructive" });
        return;
      }
      toast({ title: isUpdate ? "Hamper updated" : "Hamper created" });
      setEditing(null);
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this hamper?")) return;
    const token = sessionStorage.getItem("trynex_admin_token");
    await fetch(getApiUrl(`/api/admin/hampers/${id}`), {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const updateItem = (idx: number, patch: Partial<HamperItem>) => {
    if (!editing) return;
    const items = [...(editing.items || [])];
    items[idx] = { ...items[idx], ...patch };
    setEditing({ ...editing, items });
  };

  const addItem = () => {
    if (!editing) return;
    setEditing({ ...editing, items: [...(editing.items || []), { name: "", quantity: 1 }] });
  };

  const removeItem = (idx: number) => {
    if (!editing) return;
    setEditing({ ...editing, items: (editing.items || []).filter((_, i) => i !== idx) });
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black font-display text-gray-900 flex items-center gap-2">
              <Gift className="w-7 h-7 text-orange-500" /> Gift Hampers
            </h1>
            <p className="text-sm text-gray-500 mt-1">Curate gift packages for your customers.</p>
          </div>
          <button
            onClick={() => setEditing({ ...empty })}
            className="px-4 py-2.5 rounded-xl font-bold text-white text-sm flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}
          >
            <Plus className="w-4 h-4" /> New Hamper
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hampers.map(h => (
              <div key={h.id} className="rounded-2xl bg-white p-4" style={{ border: '1px solid #e5e7eb' }}>
                <div className="aspect-[4/3] rounded-xl bg-gray-50 overflow-hidden mb-3">
                  {h.imageUrl ? (
                    <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Gift className="w-10 h-10 text-gray-300" /></div>
                  )}
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-black text-gray-900 truncate">{h.name}</p>
                    <p className="text-xs text-gray-400 truncate">/{h.slug}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {h.featured && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
                    {!h.active && <span className="text-[10px] font-black text-red-500 px-1.5 py-0.5 rounded bg-red-50">OFF</span>}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">{h.items.length} items · {formatPrice(h.discountPrice ?? h.basePrice)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(h)}
                    className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => remove(h.id)}
                    className="px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold flex items-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {hampers.length === 0 && (
              <div className="col-span-full text-center py-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-semibold">No hampers yet — click "New Hamper" to create one.</p>
              </div>
            )}
          </div>
        )}

        {/* Editor modal */}
        {editing && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white p-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900">{editing.id ? "Edit" : "New"} Hamper</h2>
                <button onClick={() => setEditing(null)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={editing.name || ""}
                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Name (English)"
                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                  <input
                    value={editing.nameBn || ""}
                    onChange={e => setEditing({ ...editing, nameBn: e.target.value })}
                    placeholder="Name (Bangla)"
                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <input
                  value={editing.slug || ""}
                  onChange={e => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="Slug (e.g. birthday-classic)"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                />
                <textarea
                  value={editing.description || ""}
                  onChange={e => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Description"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none"
                />
                <input
                  value={editing.imageUrl || ""}
                  onChange={e => setEditing({ ...editing, imageUrl: e.target.value })}
                  placeholder="Image URL"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    value={editing.occasion || ""}
                    onChange={e => setEditing({ ...editing, occasion: e.target.value })}
                    placeholder="Occasion"
                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                  <input
                    type="number"
                    value={editing.basePrice ?? 0}
                    onChange={e => setEditing({ ...editing, basePrice: Number(e.target.value) })}
                    placeholder="Base price"
                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                  <input
                    type="number"
                    value={editing.discountPrice ?? ""}
                    onChange={e => setEditing({ ...editing, discountPrice: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="Discount price"
                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.active} onChange={e => setEditing({ ...editing, active: e.target.checked })} />
                    Active
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={!!editing.featured} onChange={e => setEditing({ ...editing, featured: e.target.checked })} />
                    Featured
                  </label>
                  <input
                    type="number"
                    value={editing.stock ?? 100}
                    onChange={e => setEditing({ ...editing, stock: Number(e.target.value) })}
                    placeholder="Stock"
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-gray-700">Items in this hamper</p>
                    <button onClick={addItem} className="text-xs font-bold text-orange-600 flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> Add item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editing.items || []).map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          value={item.name}
                          onChange={e => updateItem(idx, { name: e.target.value })}
                          placeholder="Item name"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                        />
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 1 })}
                          className="w-16 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                          placeholder="Qty"
                        />
                        <button onClick={() => removeItem(idx)} className="px-2 rounded-lg hover:bg-red-50 text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="sticky bottom-0 bg-white p-4 border-t border-gray-100 flex justify-end gap-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg bg-gray-100 font-bold text-sm">Cancel</button>
                <button onClick={save} className="px-4 py-2 rounded-lg text-white font-bold text-sm flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #E85D04, #FB8500)' }}>
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
