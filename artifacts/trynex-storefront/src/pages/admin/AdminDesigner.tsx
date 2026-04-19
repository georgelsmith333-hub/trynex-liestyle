import { useCallback, useEffect, useRef, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  useGetDesignerSettings, usePatchDesignerSettings,
  useAdminListTestimonials, useCreateTestimonial, useUpdateTestimonial, useDeleteTestimonial,
  useListProducts, useToggleProductFeatured,
  type DesignerSettings,
} from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders } from "@/lib/utils";
import { useForm, type Path } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Save, Palette, Image, Layout, ToggleLeft, ToggleRight,
  ShieldCheck, Truck, Award, Users, Plus, Trash2, Pencil, Star, X,
  Eye, EyeOff, ChevronDown, ChevronUp, MessageSquare, Megaphone, Flame, Monitor,
  RefreshCw, AlertCircle, Grid, Package,
} from "lucide-react";

const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400";
const inputStyle: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', color: '#111827' };

const BADGE_ICON_OPTIONS = [
  { key: "shield", label: "Shield" },
  { key: "truck", label: "Truck" },
  { key: "award", label: "Award" },
  { key: "users", label: "Users" },
  { key: "star", label: "Star" },
  { key: "check", label: "Check" },
  { key: "package", label: "Package" },
] as const;

type BadgeIconKey = typeof BADGE_ICON_OPTIONS[number]["key"];

function BadgeIconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {BADGE_ICON_OPTIONS.map(opt => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onChange(opt.key)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all"
          style={{
            background: value === opt.key ? '#E85D04' : 'white',
            color: value === opt.key ? 'white' : '#374151',
            borderColor: value === opt.key ? '#E85D04' : '#e5e7eb',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const SectionCard = ({
  icon: Icon, title, iconColor = "#E85D04", children, collapsible = false,
}: {
  icon: React.ElementType; title: string; iconColor?: string; children: React.ReactNode; collapsible?: boolean;
}) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={`flex items-center justify-between w-full gap-3 px-6 py-4 border-b border-gray-100 text-left${collapsible ? ' cursor-pointer hover:bg-gray-50' : ''}`}
        style={{ background: '#f9fafb' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
            <Icon className="w-4 h-4" style={{ color: iconColor }} />
          </div>
          <h2 className="font-bold text-sm text-gray-800">{title}</h2>
        </div>
        {collapsible && (open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />)}
      </button>
      {(!collapsible || open) && (
        <div className="p-6">{children}</div>
      )}
    </div>
  );
};

const Field = ({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</label>
    {children}
  </div>
);

function ToggleField({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
      <div>
        <p className="text-sm font-bold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="flex items-center gap-1.5 text-sm font-bold transition-colors ml-4"
        style={{ color: value ? '#16a34a' : '#9ca3af' }}
      >
        {value
          ? <><ToggleRight className="w-7 h-7" /> <span className="text-xs">On</span></>
          : <><ToggleLeft className="w-7 h-7" /> <span className="text-xs">Off</span></>
        }
      </button>
    </div>
  );
}

interface TestimonialRow { id: number; name: string; role: string; location: string; body: string; stars: number; active: boolean; }
interface TestimonialFormData { name: string; role: string; location: string; body: string; stars: number; }

function TestimonialsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminListTestimonials({ request: { headers: getAuthHeaders() } });
  const { mutateAsync: create, isPending: isCreating } = useCreateTestimonial({ request: { headers: getAuthHeaders() } });
  const { mutateAsync: update } = useUpdateTestimonial({ request: { headers: getAuthHeaders() } });
  const { mutateAsync: del } = useDeleteTestimonial({ request: { headers: getAuthHeaders() } });

  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TestimonialFormData>({ name: "", role: "", location: "", body: "", stars: 5 });
  const [showAdd, setShowAdd] = useState(false);

  const resetForm = () => { setForm({ name: "", role: "", location: "", body: "", stars: 5 }); setEditId(null); setShowAdd(false); };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/testimonials"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/testimonials"] });
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) { toast({ title: "Name and review text are required.", variant: "destructive" }); return; }
    try {
      if (editId !== null) {
        await update({ id: editId, data: { name: form.name, role: form.role, location: form.location, body: form.body, stars: form.stars } });
        toast({ title: "Testimonial updated!" });
      } else {
        await create({ data: { name: form.name, role: form.role, location: form.location, body: form.body, stars: form.stars } });
        toast({ title: "Testimonial added!" });
      }
      invalidate();
      resetForm();
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
  };

  const handleToggleActive = async (t: TestimonialRow) => {
    try {
      await update({ id: t.id, data: { name: t.name, body: t.body, active: !t.active } });
      invalidate();
      toast({ title: t.active ? "Hidden from homepage" : "Approved and visible!" });
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this testimonial?")) return;
    try {
      await del({ id });
      invalidate();
      toast({ title: "Deleted." });
    } catch { toast({ title: "Delete failed", variant: "destructive" }); }
  };

  const beginEdit = (t: TestimonialRow) => {
    setEditId(t.id);
    setForm({ name: t.name, role: t.role || "", location: t.location || "", body: t.body, stars: t.stars ?? 5 });
    setShowAdd(true);
  };

  const testimonials = (data?.testimonials ?? []) as TestimonialRow[];

  return (
    <div>
      {showAdd ? (
        <div className="mb-6 p-5 rounded-2xl" style={{ background: '#fff8f2', border: '1px solid #fde5cc' }}>
          <p className="text-sm font-black text-gray-700 mb-4">{editId !== null ? "Edit Testimonial" : "Add New Testimonial"}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Customer Name *</label>
              <input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Rakib Hossain" />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Role / Title</label>
              <input className={inputClass} style={inputStyle} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Regular Customer" />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Location</label>
              <input className={inputClass} style={inputStyle} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Dhaka" />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Stars</label>
              <div className="flex items-center gap-2">
                {([1, 2, 3, 4, 5] as const).map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, stars: s }))}>
                    <Star className={`w-6 h-6 transition-colors ${s <= form.stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Review Text *</label>
              <textarea className={inputClass} style={inputStyle} rows={3} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="The quality is amazing! Got my custom t-shirt in 3 days..." />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={handleSave} disabled={isCreating} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#E85D04,#FB8500)' }}>
              <Save className="w-4 h-4" /> {isCreating ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={resetForm} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-gray-600" style={{ background: '#f3f4f6' }}>
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { resetForm(); setShowAdd(true); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white mb-5" style={{ background: 'linear-gradient(135deg,#E85D04,#FB8500)' }}>
          <Plus className="w-4 h-4" /> Add Testimonial
        </button>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center py-10"><Loader /></div>
      ) : testimonials.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">No testimonials yet. Add one to override the default homepage reviews.</p>
      ) : (
        <div className="space-y-3">
          {testimonials.map(t => (
            <div key={t.id} className="flex items-start gap-4 p-4 rounded-xl" style={{ background: t.active ? '#f0fdf4' : '#f9fafb', border: `1px solid ${t.active ? '#bbf7d0' : '#e5e7eb'}` }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-sm font-bold text-gray-900">{t.name}</span>
                  {t.role && <span className="text-xs text-gray-500">· {t.role}</span>}
                  {t.location && <span className="text-xs text-gray-400">· {t.location}</span>}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: t.stars ?? 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{t.body}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" onClick={() => handleToggleActive(t)} title={t.active ? "Hide" : "Approve"} className="p-2 rounded-lg hover:bg-white transition-colors" style={{ color: t.active ? '#16a34a' : '#9ca3af' }}>
                  {t.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button type="button" onClick={() => beginEdit(t)} className="p-2 rounded-lg hover:bg-white transition-colors text-blue-500">
                  <Pencil className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => handleDelete(t.id)} className="p-2 rounded-lg hover:bg-white transition-colors text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeaturedProductsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListProducts({ limit: 50 }, { query: { queryKey: ["/api/products", "all50"] } });
  const { mutateAsync: toggleFeatured } = useToggleProductFeatured({ request: { headers: getAuthHeaders() } });

  const products = data?.products ?? [];

  const handleToggle = async (id: number, currentFeatured: boolean) => {
    try {
      await toggleFeatured({ id, data: { featured: !currentFeatured } });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: currentFeatured ? "Removed from featured" : "Added to featured products!" });
    } catch { toast({ title: "Failed to update", variant: "destructive" }); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-8"><Loader /></div>;
  if (!products.length) return <p className="text-sm text-gray-400 italic text-center py-6">No products found. Add some products first.</p>;

  const featured = products.filter(p => p.featured);
  const notFeatured = products.filter(p => !p.featured);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">Featured products appear in the homepage grid. Toggle them on or off here.</p>
      <div className="space-y-2">
        {[...featured, ...notFeatured].map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: p.featured ? '#f0fdf4' : '#f9fafb', border: `1px solid ${p.featured ? '#bbf7d0' : '#e5e7eb'}` }}>
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />}
            {!p.imageUrl && <div className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#f3f4f6' }}><Package className="w-4 h-4 text-gray-400" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{p.name}</p>
              <p className="text-xs text-gray-500">৳{p.price}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggle(p.id, p.featured ?? false)}
              className="flex items-center gap-1.5 text-xs font-bold transition-colors ml-2 px-3 py-1.5 rounded-lg"
              style={{ background: p.featured ? '#dcfce7' : '#f3f4f6', color: p.featured ? '#16a34a' : '#6b7280' }}
            >
              {p.featured
                ? <><Star className="w-3.5 h-3.5 fill-green-500 text-green-500" /> Featured</>
                : <><Star className="w-3.5 h-3.5" /> Add</>
              }
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

type DesignerFormValues = DesignerSettings & {
  trustBadge1Icon?: string;
  trustBadge2Icon?: string;
  trustBadge3Icon?: string;
  trustBadge4Icon?: string;
};

interface SectionVisibility {
  sectionFeaturedEnabled: boolean;
  sectionCategoriesEnabled: boolean;
  sectionFlashSaleEnabled: boolean;
  sectionTestimonialsEnabled: boolean;
  sectionStatsEnabled: boolean;
  categoryTshirtsEnabled: boolean;
  categoryHoodiesEnabled: boolean;
  categoryCapsEnabled: boolean;
  categoryMugsEnabled: boolean;
  categoryCustomEnabled: boolean;
  announcementEnabled: boolean;
}

export default function AdminDesigner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetDesignerSettings({ request: { headers: getAuthHeaders() } });
  const { mutateAsync: patchSettings, isPending } = usePatchDesignerSettings({ request: { headers: getAuthHeaders() } });
  const { register, handleSubmit, reset, watch, setValue, formState: { isDirty } } = useForm<DesignerFormValues>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);

  const [sections, setSections] = useState<SectionVisibility>({
    sectionFeaturedEnabled: true,
    sectionCategoriesEnabled: true,
    sectionFlashSaleEnabled: true,
    sectionTestimonialsEnabled: true,
    sectionStatsEnabled: true,
    categoryTshirtsEnabled: true,
    categoryHoodiesEnabled: true,
    categoryCapsEnabled: true,
    categoryMugsEnabled: true,
    categoryCustomEnabled: true,
    announcementEnabled: true,
  });

  const [sectionsChanged, setSectionsChanged] = useState(false);

  useEffect(() => {
    if (settings) {
      const s = settings as Record<string, unknown>;
      reset(settings);
      setSections({
        sectionFeaturedEnabled: s["sectionFeaturedEnabled"] !== false,
        sectionCategoriesEnabled: s["sectionCategoriesEnabled"] !== false,
        sectionFlashSaleEnabled: s["sectionFlashSaleEnabled"] !== false,
        sectionTestimonialsEnabled: s["sectionTestimonialsEnabled"] !== false,
        sectionStatsEnabled: s["sectionStatsEnabled"] !== false,
        categoryTshirtsEnabled: s["categoryTshirtsEnabled"] !== false,
        categoryHoodiesEnabled: s["categoryHoodiesEnabled"] !== false,
        categoryCapsEnabled: s["categoryCapsEnabled"] !== false,
        categoryMugsEnabled: s["categoryMugsEnabled"] !== false,
        categoryCustomEnabled: s["categoryCustomEnabled"] !== false,
        announcementEnabled: s["announcementEnabled"] !== false,
      });
      setSectionsChanged(false);
    }
  }, [settings, reset]);

  const hasUnsavedChanges = isDirty || sectionsChanged;

  const refreshPreview = useCallback(() => {
    setPreviewKey(k => k + 1);
  }, []);

  const onSubmit = async (values: DesignerFormValues) => {
    const payload: DesignerSettings = { ...values, ...sections };
    try {
      await patchSettings({ data: payload });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/designer-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      reset(payload);
      setSectionsChanged(false);
      toast({ title: "Page design saved!", description: "Changes are live on the storefront." });
      refreshPreview();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
  };

  if (isLoading) return <AdminLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader /></div></AdminLayout>;

  const reg = (name: Path<DesignerFormValues>) => register(name);

  const watchedBadgeIcons = {
    1: watch("trustBadge1Icon") ?? settings?.trustBadge1Icon ?? "shield",
    2: watch("trustBadge2Icon") ?? settings?.trustBadge2Icon ?? "truck",
    3: watch("trustBadge3Icon") ?? settings?.trustBadge3Icon ?? "award",
    4: watch("trustBadge4Icon") ?? settings?.trustBadge4Icon ?? "users",
  } as Record<1 | 2 | 3 | 4, string>;

  return (
    <AdminLayout>
      <div className="flex flex-col xl:flex-row gap-0 min-h-screen">
        {/* ── Left panel: controls ─────────────────────── */}
        <div className="xl:w-[52%] flex-shrink-0 overflow-y-auto">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-2xl font-black font-display text-gray-900">Visual Page Designer</h1>
                  <p className="text-sm text-gray-500 mt-0.5">Customize the homepage — no code needed.</p>
                </div>
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges && (
                    <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 px-3 py-1.5 rounded-xl" style={{ background: '#fef3c7', border: '1px solid #fde68a' }}>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Unsaved changes
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-white text-sm"
                    style={{ background: isPending ? '#d1d5db' : 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 16px rgba(232,93,4,0.3)' }}
                  >
                    <Save className="w-4 h-4" />
                    {isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Brand Colors */}
              <SectionCard icon={Palette} title="Brand Colors" iconColor="#E85D04">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Primary Color">
                    <div className="flex items-center gap-3">
                      <input type="color" {...reg("primaryColor")} className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1" style={{ background: 'white' }} />
                      <input {...reg("primaryColor")} className={`${inputClass} flex-1`} style={inputStyle} placeholder="#E85D04" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">Used for buttons, accents, and highlights site-wide.</p>
                  </Field>
                  <Field label="Announcement Bar Color">
                    <div className="flex items-center gap-3">
                      <input type="color" {...reg("announcementColor")} className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-1" style={{ background: 'white' }} />
                      <input {...reg("announcementColor")} className={`${inputClass} flex-1`} style={inputStyle} placeholder="#E85D04" />
                    </div>
                  </Field>
                </div>
              </SectionCard>

              {/* Announcement Bar */}
              <SectionCard icon={Megaphone} title="Announcement Bar" iconColor="#9333ea" collapsible>
                <div className="space-y-3">
                  <ToggleField label="Show Announcement Bar" desc="Display the scrolling ticker bar at the top of the page" value={sections.announcementEnabled} onChange={v => { setSections(s => ({ ...s, announcementEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Auto-Hide After 6 Seconds" desc="Slide the bar out automatically. Off by default — bar stays until visitor closes it." value={(watch("announcementAutoHide") as boolean) ?? false} onChange={v => { setValue("announcementAutoHide", v, { shouldDirty: true }); }} />
                </div>
                <Field label="Announcement Messages" full>
                  <textarea {...reg("announcementBar")} className={inputClass} style={inputStyle} rows={3} placeholder="🚚 Free delivery on orders above ৳1,500! | COD available | WhatsApp: 01700-000000" />
                  <p className="text-xs text-gray-400 mt-1.5">Separate messages with <code>|</code>. Each becomes a ticker item.</p>
                </Field>
              </SectionCard>

              {/* Hero Section */}
              <SectionCard icon={Image} title="Hero Section" iconColor="#2563eb" collapsible>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Hero Title Override" full>
                    <input {...reg("heroTitle")} className={inputClass} style={inputStyle} placeholder="Premium Custom Apparel" />
                    <p className="text-xs text-gray-400 mt-1.5">Leave blank to use the animated product-name rotator.</p>
                  </Field>
                  <Field label="Hero Subtitle Override" full>
                    <textarea {...reg("heroSubtitle")} className={inputClass} style={inputStyle} rows={2} placeholder="You imagine it — we craft it with premium 320GSM fabric." />
                  </Field>
                  <Field label="Background Image URL" full>
                    <input {...reg("heroImageUrl")} className={inputClass} style={inputStyle} placeholder="https://images.example.com/hero.jpg" />
                    <p className="text-xs text-gray-400 mt-1.5">Leave blank to use the animated gradient background.</p>
                  </Field>
                  <Field label="Background Gradient (CSS)" full>
                    <input {...reg("heroGradient")} className={inputClass} style={inputStyle} placeholder="linear-gradient(135deg, #FFFDF8 0%, #FFF4EA 100%)" />
                  </Field>
                  <Field label="CTA Button Text">
                    <input {...reg("heroCTAText")} className={inputClass} style={inputStyle} placeholder="Shop Now" />
                  </Field>
                  <Field label="CTA Button Link">
                    <input {...reg("heroCTALink")} className={inputClass} style={inputStyle} placeholder="/products" />
                  </Field>
                </div>
              </SectionCard>

              {/* Flash Sale */}
              <SectionCard icon={Flame} title="Flash Sale Banner" iconColor="#dc2626" collapsible>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Field label="Headline">
                    <input {...reg("promoBannerTitle")} className={inputClass} style={inputStyle} placeholder="Up to" />
                  </Field>
                  <Field label="Discount Text">
                    <input {...reg("promoBannerDiscount")} className={inputClass} style={inputStyle} placeholder="30% OFF" />
                  </Field>
                  <Field label="Subtitle" full>
                    <input {...reg("promoBannerSubtitle")} className={inputClass} style={inputStyle} placeholder="On selected T-shirts & Hoodies..." />
                  </Field>
                  <Field label="CTA Button Text">
                    <input {...reg("promoBannerCTA")} className={inputClass} style={inputStyle} placeholder="Shop the Sale" />
                  </Field>
                </div>
              </SectionCard>

              {/* Trust Badges */}
              <SectionCard icon={ShieldCheck} title="Trust Badges" iconColor="#16a34a" collapsible>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {([1, 2, 3, 4] as const).map(num => (
                    <div key={num} className="space-y-3 p-4 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Badge {num}</p>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1">Icon</label>
                        <BadgeIconPicker
                          value={watchedBadgeIcons[num] ?? "shield"}
                          onChange={v => setValue(`trustBadge${num}Icon` as Path<DesignerFormValues>, v as BadgeIconKey, { shouldDirty: true })}
                        />
                        <input type="hidden" {...reg(`trustBadge${num}Icon` as Path<DesignerFormValues>)} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1">Title</label>
                        <input {...reg(`trustBadge${num}Title` as Path<DesignerFormValues>)} className={inputClass} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-400 mb-1">Description</label>
                        <input {...reg(`trustBadge${num}Desc` as Path<DesignerFormValues>)} className={inputClass} style={inputStyle} />
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* Section Visibility */}
              <SectionCard icon={Layout} title="Section Visibility" iconColor="#9333ea">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ToggleField label="Featured Products" desc="Product grid" value={sections.sectionFeaturedEnabled} onChange={v => { setSections(s => ({ ...s, sectionFeaturedEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Categories Grid" desc="Browse by category" value={sections.sectionCategoriesEnabled} onChange={v => { setSections(s => ({ ...s, sectionCategoriesEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Flash Sale Banner" desc="Promotional countdown" value={sections.sectionFlashSaleEnabled} onChange={v => { setSections(s => ({ ...s, sectionFlashSaleEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Testimonials" desc="Customer reviews section" value={sections.sectionTestimonialsEnabled} onChange={v => { setSections(s => ({ ...s, sectionTestimonialsEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Stats Counter" desc="Orders, customers, rating" value={sections.sectionStatsEnabled} onChange={v => { setSections(s => ({ ...s, sectionStatsEnabled: v })); setSectionsChanged(true); }} />
                </div>
              </SectionCard>

              {/* Per-Category Visibility */}
              <SectionCard icon={Grid} title="Category Visibility" iconColor="#2563eb" collapsible>
                <p className="text-xs text-gray-500 mb-4">Show or hide individual product categories in the homepage categories grid.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ToggleField label="T-Shirts" desc="Custom tees category" value={sections.categoryTshirtsEnabled} onChange={v => { setSections(s => ({ ...s, categoryTshirtsEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Hoodies" desc="Premium fleece category" value={sections.categoryHoodiesEnabled} onChange={v => { setSections(s => ({ ...s, categoryHoodiesEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Caps" desc="Embroidered caps category" value={sections.categoryCapsEnabled} onChange={v => { setSections(s => ({ ...s, categoryCapsEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Mugs" desc="Ceramic mugs category" value={sections.categoryMugsEnabled} onChange={v => { setSections(s => ({ ...s, categoryMugsEnabled: v })); setSectionsChanged(true); }} />
                  <ToggleField label="Custom Orders" desc="Custom request category" value={sections.categoryCustomEnabled} onChange={v => { setSections(s => ({ ...s, categoryCustomEnabled: v })); setSectionsChanged(true); }} />
                </div>
              </SectionCard>

              {/* Save */}
              <div className="flex items-center justify-between">
                {hasUnsavedChanges && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" /> You have unsaved changes
                  </span>
                )}
                <button
                  type="submit"
                  disabled={isPending}
                  className="ml-auto flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white"
                  style={{ background: isPending ? '#d1d5db' : 'linear-gradient(135deg, #E85D04, #FB8500)', boxShadow: '0 4px 16px rgba(232,93,4,0.3)' }}
                >
                  <Save className="w-4 h-4" />
                  {isPending ? "Saving..." : "Save All Changes"}
                </button>
              </div>
            </div>
          </form>

          {/* Out-of-form sections */}
          <div className="max-w-2xl mx-auto px-4 pb-12 space-y-6">
            <SectionCard icon={Package} title="Featured Products" iconColor="#E85D04" collapsible>
              <FeaturedProductsManager />
            </SectionCard>
            <SectionCard icon={MessageSquare} title="Testimonials Manager" iconColor="#FB8500" collapsible>
              <TestimonialsManager />
            </SectionCard>
          </div>
        </div>

        {/* ── Right panel: live preview ─────────────────── */}
        <div className="hidden xl:flex flex-col flex-1 bg-gray-100 border-l border-gray-200 sticky top-0 h-screen">
          <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
              <Monitor className="w-4 h-4 text-gray-400" />
              Live Preview
              {hasUnsavedChanges && (
                <span className="ml-1 text-[10px] font-bold text-amber-500 px-2 py-0.5 rounded-full" style={{ background: '#fef3c7' }}>
                  Unsaved
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={refreshPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <iframe
              key={previewKey}
              ref={iframeRef}
              src="/"
              title="Storefront Preview"
              className="w-full h-full border-0"
              style={{ transform: 'scale(0.75)', transformOrigin: 'top left', width: '133.3%', height: '133.3%' }}
              sandbox="allow-same-origin allow-scripts allow-forms"
            />
          </div>
          <p className="text-[10px] text-gray-400 text-center py-2 bg-white border-t border-gray-100">
            Save changes then click Refresh to see them in the preview
          </p>
        </div>
      </div>
    </AdminLayout>
  );
}
