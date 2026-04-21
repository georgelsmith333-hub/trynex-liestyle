import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Loader } from "@/components/ui/Loader";
import { getAuthHeaders, getApiUrl } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { Save, Store, Phone, Globe, CreditCard, Truck, BarChart3, Megaphone, Image, Search, KeyRound, Palette, Plus, Trash2, Zap, Tag, CheckCircle2, XCircle } from "lucide-react";

const inputClass = "w-full px-4 py-3 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-400 transition-all placeholder:text-gray-400";
const inputStyle = { background: 'white', border: '1px solid #e5e7eb', color: '#111827' };

/* ── Studio Colors Manager ── */
interface StudioColor { name: string; hex: string }

function StudioColorsManager({ value, onChange }: { value: string; onChange: (json: string) => void }) {
  const parseColors = (raw: string): StudioColor[] => {
    try { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; } catch {}
    return [];
  };
  const [colors, setColors] = useState<StudioColor[]>(() => parseColors(value));
  const [newName, setNewName] = useState("");
  const [newHex, setNewHex] = useState("#000000");

  // Sync internal state when async-loaded settings arrive
  useEffect(() => {
    setColors(parseColors(value));
  }, [value]);

  const commit = (next: StudioColor[]) => { setColors(next); onChange(JSON.stringify(next)); };
  const remove = (i: number) => commit(colors.filter((_, idx) => idx !== i));
  const add = () => {
    if (!newName.trim()) return;
    commit([...colors, { name: newName.trim(), hex: newHex }]);
    setNewName(""); setNewHex("#000000");
  };

  return (
    <div>
      <div className="space-y-2 mb-3">
        {colors.length === 0 && (
          <p className="text-xs text-gray-400 italic">No colors added yet. Using 12 default colors.</p>
        )}
        {colors.map((c, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div className="w-7 h-7 rounded-lg border border-gray-200 shrink-0" style={{ background: c.hex }} />
            <span className="text-sm font-semibold text-gray-800 flex-1">{c.name}</span>
            <span className="text-xs text-gray-400 font-mono">{c.hex}</span>
            <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={newHex}
          onChange={e => setNewHex(e.target.value)}
          className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer shrink-0 p-0.5"
          style={{ background: 'white' }}
        />
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="Color name (e.g. Royal Blue)"
          className={inputClass + " flex-1"}
          style={inputStyle}
        />
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg,#E85D04,#FB8500)' }}
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </div>
  );
}

const SectionCard = ({ icon: Icon, title, iconColor = "#E85D04", children }: {
  icon: any; title: string; iconColor?: string; children: React.ReactNode;
}) => (
  <div className="rounded-2xl overflow-hidden" style={{ background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
    <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100" style={{ background: '#f9fafb' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${iconColor}15`, border: `1px solid ${iconColor}25` }}>
        <Icon className="w-4 h-4" style={{ color: iconColor }} />
      </div>
      <h2 className="font-bold text-sm text-gray-800">{title}</h2>
    </div>
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">{children}</div>
    </div>
  </div>
);

const Field = ({ label, children, full = false }: { label: string; children: React.ReactNode; full?: boolean }) => (
  <div className={full ? "md:col-span-2" : ""}>
    <label className="block text-[11px] font-black uppercase tracking-widest text-gray-400 mb-2">{label}</label>
    {children}
  </div>
);

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const siteSettings = useSiteSettings();
  const { data: settings, isLoading } = useGetSettings({ request: { headers: getAuthHeaders() } });
  const { mutateAsync: updateSettings, isPending } = useUpdateSettings({
    request: { headers: getAuthHeaders() }
  });
  const { register, handleSubmit, reset } = useForm();

  // Studio colors managed outside react-hook-form — separate per product type
  const [tshirtColorsJson, setTshirtColorsJson] = useState("");
  const [mugColorsJson, setMugColorsJson] = useState("");

  // Remove.bg configured status — fetched from /api/remove-bg/status
  const [removeBgConfigured, setRemoveBgConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(getApiUrl("/api/remove-bg/status"))
      .then(r => r.json())
      .then((d: { configured: boolean }) => setRemoveBgConfigured(d.configured))
      .catch(() => setRemoveBgConfigured(false));
  }, []);

  useEffect(() => {
    if (settings) {
      reset(settings);
      setTshirtColorsJson(settings.studioTshirtColors ?? "");
      setMugColorsJson(settings.studioMugColors ?? "");
    }
  }, [settings, reset]);

  const validateSettings = (data: Record<string, string | undefined>): string | null => {
    const requiredFields: Array<{ key: string; label: string }> = [
      { key: "siteName", label: "Store Name" },
    ];
    for (const { key, label } of requiredFields) {
      if (!data[key] || !data[key]?.trim()) {
        return `${label} is required`;
      }
    }

    const phoneFields: Array<{ key: string; label: string }> = [
      { key: "phone", label: "Support Phone" },
      { key: "whatsappNumber", label: "WhatsApp Number" },
      { key: "bkashNumber", label: "bKash Number" },
      { key: "nagadNumber", label: "Nagad Number" },
      { key: "rocketNumber", label: "Rocket Number" },
    ];
    const bdPhoneRegex = /^(\+?880\s?)?0?1[3-9]\d{2}[-\s]?\d{6}$/;
    for (const { key, label } of phoneFields) {
      const val = data[key];
      if (val && val.trim()) {
        if (!bdPhoneRegex.test(val.trim())) {
          return `${label}: Please enter a valid Bangladesh phone number (e.g. 01712-345678)`;
        }
      }
    }

    const urlFields: Array<{ key: string; label: string }> = [
      { key: "facebookUrl", label: "Facebook URL" },
      { key: "instagramUrl", label: "Instagram URL" },
      { key: "youtubeUrl", label: "YouTube URL" },
    ];
    const urlRegex = /^https?:\/\/.+\..+/;
    for (const { key, label } of urlFields) {
      const val = data[key];
      if (val && val.trim()) {
        if (!urlRegex.test(val.trim())) {
          return `${label}: Please enter a valid URL starting with http:// or https://`;
        }
      }
    }

    const emailVal = data["email"];
    if (emailVal && emailVal.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal.trim())) {
        return "Support Email: Please enter a valid email address";
      }
    }

    return null;
  };

  const onSubmit = async (data: Record<string, string | undefined>) => {
    const validationError = validateSettings(data);
    if (validationError) {
      toast({ title: "Validation Error", description: validationError, variant: "destructive" });
      return;
    }
    try {
      await updateSettings({ data: { ...data, studioTshirtColors: tshirtColorsJson, studioMugColors: mugColorsJson } });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "✓ Settings saved successfully!" });
      // Refresh remove.bg configured status so the badge reflects any newly-saved key immediately
      fetch(getApiUrl("/api/remove-bg/status"))
        .then(r => r.json())
        .then((d: { configured: boolean }) => setRemoveBgConfigured(d.configured))
        .catch(() => {});
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  };

  if (isLoading) return <AdminLayout><Loader /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="mb-10">
        <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">Configuration</p>
        <h1 className="text-4xl font-black font-display tracking-tighter text-gray-900">Store Settings</h1>
        <p className="text-sm text-gray-400 mt-2">Configure your store details, payment numbers and more.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">

        {/* General */}
        <SectionCard icon={Store} title="General Information">
          <Field label="Store Name">
            <input {...register("siteName")} className={inputClass} style={inputStyle} placeholder="TryNex Lifestyle" />
          </Field>
          <Field label="Tagline">
            <input {...register("tagline")} className={inputClass} style={inputStyle} placeholder="You imagine, we craft." />
          </Field>
          <Field label="Hero Section Title" full>
            <input {...register("heroTitle")} className={inputClass} style={inputStyle} placeholder="Premium Custom Apparel" />
          </Field>
          <Field label="Hero Subtitle" full>
            <input {...register("heroSubtitle")} className={inputClass} style={inputStyle} placeholder="Elevate your wardrobe with bespoke custom apparel." />
          </Field>
          <Field label="Announcement Bar Text" full>
            <input {...register("announcementBar")} className={inputClass} style={inputStyle} placeholder="🚚 Free delivery on orders above ৳1,500!" />
            <p className="text-xs text-gray-400 mt-1">Separate multiple messages with <code>|</code> — each becomes a ticker item.</p>
          </Field>
          <Field label="Show Announcement Bar" full>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("announcementEnabled")} className="w-5 h-5 rounded accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Display the scrolling ticker bar at the top of every page</span>
            </label>
            <p className="text-xs text-gray-400 mt-1">Same setting as Designer → Announcement Bar. Toggling here also updates that page.</p>
          </Field>
          <Field label="Auto-Hide After 6 Seconds" full>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("announcementAutoHide")} className="w-5 h-5 rounded accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Slide the bar out automatically (default off — bar stays until visitor closes it)</span>
            </label>
          </Field>
        </SectionCard>

        {/* Promo Banner */}
        <SectionCard icon={Megaphone} title="Homepage Promo Banner" iconColor="#f59e0b">
          <Field label="Banner Title" full>
            <input {...register("promoBannerTitle")} className={inputClass} style={inputStyle} placeholder="Up to 30% OFF" />
            <p className="text-xs text-gray-400 mt-1">Main headline for the flash sale banner on the homepage.</p>
          </Field>
          <Field label="Banner Subtitle" full>
            <input {...register("promoBannerSubtitle")} className={inputClass} style={inputStyle} placeholder="On selected T-shirts & Hoodies. Limited stock!" />
          </Field>
          <Field label="Discount Text">
            <input {...register("promoBannerDiscount")} className={inputClass} style={inputStyle} placeholder="30% OFF" />
            <p className="text-xs text-gray-400 mt-1">The highlighted discount text (e.g. "30% OFF", "50% OFF").</p>
          </Field>
          <Field label="Button Text">
            <input {...register("promoBannerCTA")} className={inputClass} style={inputStyle} placeholder="Shop the Sale" />
          </Field>
        </SectionCard>

        {/* Contact */}
        <SectionCard icon={Phone} title="Contact Information" iconColor="#60a5fa">
          <Field label="Support Phone">
            <input {...register("phone")} className={inputClass} style={inputStyle} placeholder="+880 1700-000000" />
          </Field>
          <Field label="WhatsApp Number">
            <input {...register("whatsappNumber")} className={inputClass} style={inputStyle} placeholder="01700-000000" />
          </Field>
          <Field label="Support Email">
            <input {...register("email")} className={inputClass} style={inputStyle} placeholder="hello@trynex.com" />
          </Field>
          <Field label="Business Address">
            <input {...register("address")} className={inputClass} style={inputStyle} placeholder="Banani, Dhaka-1213, Bangladesh" />
          </Field>
        </SectionCard>

        {/* Social Media */}
        <SectionCard icon={Globe} title="Social Media" iconColor="#a78bfa">
          <Field label="Facebook Page URL">
            <input {...register("facebookUrl")} className={inputClass} style={inputStyle} placeholder="https://facebook.com/trynex" />
          </Field>
          <Field label="Instagram Profile URL">
            <input {...register("instagramUrl")} className={inputClass} style={inputStyle} placeholder="https://instagram.com/trynex" />
          </Field>
          <Field label="YouTube Channel URL">
            <input {...register("youtubeUrl")} className={inputClass} style={inputStyle} placeholder="https://youtube.com/@trynex" />
          </Field>
        </SectionCard>

        {/* Payment */}
        <SectionCard icon={CreditCard} title="Payment Methods" iconColor="#e2136e">
          <Field label="bKash Merchant Number">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: '#e2136e' }}>bK</span>
              <input {...register("bkashNumber")} className={inputClass} style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="01712-345678" />
            </div>
          </Field>
          <Field label="Nagad Merchant Number">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: '#f7941d' }}>N</span>
              <input {...register("nagadNumber")} className={inputClass} style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="01811-234567" />
            </div>
          </Field>
          <Field label="Rocket (DBBL) Number">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black" style={{ color: '#8b2291' }}>R</span>
              <input {...register("rocketNumber")} className={inputClass} style={{ ...inputStyle, paddingLeft: '2.5rem' }} placeholder="01611-234567" />
            </div>
          </Field>
        </SectionCard>

        {/* Analytics & Tracking */}
        <SectionCard icon={BarChart3} title="Analytics & Tracking" iconColor="#2563eb">
          <Field label="Google Analytics Measurement ID" full>
            <input {...register("googleAnalyticsId")} className={inputClass} style={inputStyle} placeholder="G-XXXXXXXXXX" />
            <p className="text-xs text-gray-400 mt-1">Enter your GA4 Measurement ID (starts with G-). Find it in Google Analytics → Admin → Data Streams.</p>
          </Field>
          <Field label="Facebook Pixel ID" full>
            <input {...register("facebookPixelId")} className={inputClass} style={inputStyle} placeholder="123456789012345" />
            <p className="text-xs text-gray-400 mt-1">Enter your Facebook Pixel ID (15-16 digit number). Find it in Meta Events Manager → Data Sources.</p>
          </Field>
          <Field label="Google Ads Conversion ID" full>
            <input {...register("googleAdsId")} className={inputClass} style={inputStyle} placeholder="AW-XXXXXXXXX" />
            <p className="text-xs text-gray-400 mt-1">Enter your Google Ads Conversion ID (starts with AW-). Find it in Google Ads → Tools → Conversions.</p>
          </Field>
        </SectionCard>

        {/* Shipping */}
        <SectionCard icon={Truck} title="Shipping & Delivery" iconColor="#4ade80">
          <Field label="Free Shipping Threshold (৳)">
            <input type="number" {...register("freeShippingThreshold")} className={inputClass} style={inputStyle} placeholder="1500" />
          </Field>
          <Field label="Standard Shipping Cost (৳)">
            <input type="number" {...register("shippingCost")} className={inputClass} style={inputStyle} placeholder="100" />
          </Field>
        </SectionCard>

        {/* Branding Assets */}
        <SectionCard icon={Image} title="Branding & Logo" iconColor="#7c3aed">
          <Field label="Site Icon / Favicon URL" full>
            <input {...register("siteIcon")} className={inputClass} style={inputStyle} placeholder="https://cdn.example.com/favicon.png" />
            <p className="text-xs text-gray-400 mt-1">Paste a direct image URL (PNG, SVG, ICO). This will replace the favicon and browser tab icon across the entire site immediately.</p>
          </Field>
        </SectionCard>

        {/* OAuth & Third-party */}
        <SectionCard icon={KeyRound} title="Authentication & OAuth" iconColor="#1877F2">
          <Field label="Google Client ID" full>
            <input {...register("googleClientId")} className={inputClass} style={inputStyle} placeholder="123456789-abc.apps.googleusercontent.com" />
            <p className="text-xs text-gray-400 mt-1">
              Required for <strong>Google Sign-In</strong>. Get it from{" "}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">console.cloud.google.com</a>{" "}
              → Create OAuth 2.0 Client ID → Web Application.
              Add <strong>https://trynexshop.com</strong> as an Authorized JavaScript Origin.
            </p>
          </Field>
          <Field label="Facebook App ID" full>
            <input {...register("facebookAppId")} className={inputClass} style={inputStyle} placeholder="1234567890123456" />
            <p className="text-xs text-gray-400 mt-1">
              Required for <strong>Facebook Login</strong>. Get it from{" "}
              <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">developers.facebook.com</a>{" "}
              → Your App → Settings → Basic.
              Add <strong>trynexshop.com</strong> as an App Domain.
            </p>
          </Field>
        </SectionCard>

        {/* Google Search Console */}
        <SectionCard icon={Search} title="Google Search Console" iconColor="#4285F4">
          <Field label="Google Site Verification Code" full>
            <input {...register("googleSiteVerification")} className={inputClass} style={inputStyle} placeholder="abc123xyz..." />
            <p className="text-xs text-gray-400 mt-1">Paste the content value from the Google Search Console verification meta tag. This allows Google to verify site ownership and enable indexing.</p>
          </Field>
        </SectionCard>

        {/* Design Studio */}
        <SectionCard icon={Palette} title="Design Studio" iconColor="#E85D04">
          <Field label="Remove.bg API Key" full>
            {/* Configured / not configured status badge */}
            {removeBgConfigured !== null && (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2 ${removeBgConfigured ? "text-green-700" : "text-amber-700"}`}
                style={{ background: removeBgConfigured ? "#dcfce7" : "#fef3c7", border: `1px solid ${removeBgConfigured ? "#bbf7d0" : "#fde68a"}` }}>
                {removeBgConfigured
                  ? <><CheckCircle2 className="w-3.5 h-3.5" /> API key configured — background removal active</>
                  : <><XCircle className="w-3.5 h-3.5" /> Not configured — background removal will use in-browser AI fallback</>}
              </div>
            )}
            <input {...register("removeBgApiKey")} className={inputClass} style={inputStyle} placeholder="Paste new key to update (leave blank to keep current)" type="password" autoComplete="off" />
            <p className="text-xs text-gray-400 mt-1">
              Get a free API key from{" "}
              <a href="https://www.remove.bg/api" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">remove.bg</a>.
              Free tier gives 50 removals/month. Leave blank to keep the existing key. When no key is configured, background removal falls back to an in-browser AI model (free, slower).
            </p>
          </Field>
          <Field label="Custom T-Shirt Price (৳)" full={false}>
            <input {...register("studioTshirtPrice")} className={inputClass} style={inputStyle} placeholder="1099" type="number" min="0" max="50000" step="1" />
            <p className="text-xs text-gray-400 mt-1">
              Price charged per custom studio T-shirt order. Applied server-side — clients cannot override this.
            </p>
          </Field>
          <Field label="Custom Mug Price (৳)" full={false}>
            <input {...register("studioMugPrice")} className={inputClass} style={inputStyle} placeholder="799" type="number" min="0" max="50000" step="1" />
            <p className="text-xs text-gray-400 mt-1">
              Price charged per custom studio Mug order. Applied server-side — clients cannot override this.
            </p>
          </Field>
          <Field label="T-Shirt Colors" full>
            <StudioColorsManager value={tshirtColorsJson} onChange={setTshirtColorsJson} />
            <p className="text-xs text-gray-400 mt-2">
              Colors shown in the Design Studio swatch grid when a T-shirt product is selected. Clicking a swatch updates the live mockup color. Leave empty for 12 defaults.
            </p>
          </Field>
          <Field label="Mug Colors" full>
            <StudioColorsManager value={mugColorsJson} onChange={setMugColorsJson} />
            <p className="text-xs text-gray-400 mt-2">
              Colors shown when a Mug product is selected. Leave empty for 6 defaults.
            </p>
          </Field>
        </SectionCard>

        {/* Facebook Ads Conversion Suite */}
        <SectionCard icon={Zap} title="Flash Sale & Urgency" iconColor="#E85D04">
          <Field label="Enable Flash Sale Bar" full>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("flashSaleEnabled")} className="w-5 h-5 rounded accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Show a countdown bar at the top of every page</span>
            </label>
          </Field>
          <Field label="Flash Sale End Date & Time" full>
            <input type="datetime-local" {...register("flashSaleEndTime")} className={inputClass} style={inputStyle} />
            <p className="text-xs text-gray-400 mt-1">When the countdown reaches zero the bar disappears automatically. Leave blank for no countdown.</p>
          </Field>
          <Field label="Flash Sale Message" full>
            <input {...register("flashSaleMessage")} className={inputClass} style={inputStyle} placeholder="⚡ FLASH SALE — Limited Stock!" />
          </Field>
          <Field label="Scarcity Stock Threshold" full={false}>
            <input type="number" {...register("scarcityThreshold")} className={inputClass} style={inputStyle} placeholder="10" min="1" max="100" />
            <p className="text-xs text-gray-400 mt-1">Show "Only X left!" badge when stock is at or below this number.</p>
          </Field>
          <Field label="Sale Page Title" full>
            <input {...register("salePageTitle")} className={inputClass} style={inputStyle} placeholder="Mega Sale — Up to 50% Off!" />
          </Field>
          <Field label="Sale Page Subtitle" full>
            <input {...register("salePageSubtitle")} className={inputClass} style={inputStyle} placeholder="Bangladesh's best custom apparel at unbeatable prices." />
          </Field>
          <Field label="Sale Page Badge Text" full={false}>
            <input {...register("salePageBadge")} className={inputClass} style={inputStyle} placeholder="LIMITED TIME" />
          </Field>
        </SectionCard>

        <SectionCard icon={Tag} title="Exit-Intent Promo Popup" iconColor="#7c3aed">
          <Field label="Enable Exit-Intent Popup" full>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("exitIntentPromoEnabled")} className="w-5 h-5 rounded accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Show a promo code popup when a visitor tries to leave</span>
            </label>
          </Field>
          <Field label="Promo Code to Show" full={false}>
            <input {...register("exitIntentPromoCode")} className={inputClass} style={inputStyle} placeholder="SAVE10" />
            <p className="text-xs text-gray-400 mt-1">Create the promo code in the Promo Codes section first, then enter it here.</p>
          </Field>
          <Field label="Discount Label" full={false}>
            <input {...register("exitIntentPromoDiscount")} className={inputClass} style={inputStyle} placeholder="10%" />
            <p className="text-xs text-gray-400 mt-1">Shown on the popup headline (e.g. "10% OFF"). Must match the actual discount of the promo code.</p>
          </Field>
        </SectionCard>

        <SectionCard icon={Zap} title="Spin-the-Wheel Offer Game" iconColor="#ea580c">
          <Field label="Enable Spin-the-Wheel Popup" full>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" {...register("spinWheelEnabled")} className="w-5 h-5 rounded accent-orange-500" />
              <span className="text-sm font-medium text-gray-700">Show the spin-the-wheel popup once per visitor on the home page</span>
            </label>
            <p className="text-xs text-gray-400 mt-2">
              Built-in prizes (always work, no setup needed): <strong>SPIN5</strong> (5% off), <strong>SPIN10</strong> (10% off), <strong>SPIN15</strong> (15% off), <strong>FREEDELIV</strong> (free delivery on ৳1500+), <strong>SUPERDEAL</strong> (free delivery + 10% off on ৳1500+). 60% chance of "Try Again" so margins stay safe.
            </p>
          </Field>
          <Field label="Auto-Open Delay (seconds)" full={false}>
            <input type="number" {...register("spinWheelDelay", { valueAsNumber: true })} className={inputClass} style={inputStyle} placeholder="4" min="1" max="30" />
            <p className="text-xs text-gray-400 mt-1">How many seconds after the home page loads before the popup appears.</p>
          </Field>
          <Field label="Headline" full={false}>
            <input {...register("spinWheelTitle")} className={inputClass} style={inputStyle} placeholder="Spin & Win an Offer!" />
          </Field>
          <Field label="Subtitle" full>
            <input {...register("spinWheelSubtitle")} className={inputClass} style={inputStyle} placeholder="One free spin — no purchase needed." />
          </Field>
        </SectionCard>

        <SectionCard icon={Search} title="SEO Defaults & Auto-SEO" iconColor="#16a34a">
          <Field label="Default Page Title" full>
            <input {...register("seoDefaultTitle")} className={inputClass} style={inputStyle} placeholder="TryNex Lifestyle — Custom Apparel & Gifts in Bangladesh" />
            <p className="text-xs text-gray-400 mt-1">Used on every page that doesn't set its own title. Keep under 60 characters for best Google ranking.</p>
          </Field>
          <Field label="Default Meta Description" full>
            <textarea {...register("seoDefaultDescription")} className={inputClass} style={{ ...inputStyle, minHeight: 80 }} placeholder="Design and order custom T-shirts, hoodies, mugs..." />
            <p className="text-xs text-gray-400 mt-1">Shown in Google search results. Keep under 160 characters. New product pages auto-generate descriptions from this template.</p>
          </Field>
          <Field label="Default Keywords" full>
            <input {...register("seoDefaultKeywords")} className={inputClass} style={inputStyle} placeholder="custom t-shirt bangladesh, personalized mug, gift hamper" />
            <p className="text-xs text-gray-400 mt-1">Comma-separated. Modern Google ignores these but Bing & Yandex still use them.</p>
          </Field>
          <Field label="Default Social Share Image (URL)" full>
            <input {...register("seoOgImage")} className={inputClass} style={inputStyle} placeholder="https://trynexshop.com/og.jpg" />
            <p className="text-xs text-gray-400 mt-1">Shown when someone shares your link on Facebook, WhatsApp, Twitter, LinkedIn. Recommended: 1200×630 PNG/JPG.</p>
          </Field>
          <Field label="Twitter / X Handle" full={false}>
            <input {...register("seoTwitterHandle")} className={inputClass} style={inputStyle} placeholder="@trynexshop" />
          </Field>
          <div className="rounded-xl p-3 border border-green-200 bg-green-50">
            <p className="text-xs font-bold text-green-800 mb-1">Auto-SEO is active</p>
            <p className="text-xs text-green-700 leading-relaxed">
              ✓ All product pages auto-generate meta tags + structured data (rich snippets)<br/>
              ✓ Sitemap.xml regenerates automatically when you add products or blog posts<br/>
              ✓ Robots.txt exposes the sitemap to Google, Bing, and other crawlers<br/>
              ✓ Open Graph tags inserted on every page for clean social shares<br/>
              ✓ Canonical URLs prevent duplicate-content penalties
            </p>
          </div>
        </SectionCard>

        <SectionCard icon={BarChart3} title="Meta CAPI (Server-Side Events)" iconColor="#1877F2">
          <Field label="Meta Conversions API Token" full>
            {siteSettings.metaCapiTokenConfigured && (
              <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-green-600">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Token configured — leave blank to keep existing
              </div>
            )}
            <input {...register("metaCapiToken")} className={inputClass} style={inputStyle} placeholder={siteSettings.metaCapiTokenConfigured ? "Enter new token to replace (leave blank to keep)" : "Paste your Meta CAPI access token"} type="password" autoComplete="off" />
            <p className="text-xs text-gray-400 mt-1">
              Get it from <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">Meta Events Manager</a> → Data Sources → Your Pixel → Settings → Conversions API → Generate Access Token. Requires Facebook Pixel ID to be set above. <strong>Never shared publicly.</strong>
            </p>
          </Field>
        </SectionCard>

        {/* Save Button */}
        <div className="flex items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="btn-glow flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-white text-sm disabled:opacity-50 disabled:transform-none"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), rgba(255,152,64,1))', boxShadow: '0 8px 30px rgba(255,107,43,0.35)' }}
          >
            <Save className="w-4 h-4" />
            {isPending ? "Saving Changes..." : "Save All Settings"}
          </button>
          <p className="text-xs text-gray-400">Changes take effect immediately.</p>
        </div>
      </form>
    </AdminLayout>
  );
}
