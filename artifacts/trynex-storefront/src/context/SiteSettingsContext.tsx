import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useGetSettings } from "@workspace/api-client-react";

interface SiteSettings {
  siteName: string;
  tagline: string;
  phone: string;
  whatsappNumber: string;
  email: string;
  address: string;
  heroTitle: string;
  heroSubtitle: string;
  announcementBar: string;
  googleAnalyticsId: string;
  facebookPixelId: string;
  googleAdsId: string;
  freeShippingThreshold: number;
  shippingCost: number;
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  promoBannerTitle: string;
  promoBannerSubtitle: string;
  promoBannerDiscount: string;
  promoBannerCTA: string;
  promoBannerEnabled: boolean;
  siteIcon: string;
  facebookAppId: string;
  googleClientId: string;
  googleSiteVerification: string;
  studioTshirtColors: string;
  studioMugColors: string;
  studioTshirtPrice: number;
  studioMugPrice: number;
  heroImageUrl: string;
  heroGradient: string;
  heroCTAText: string;
  heroCTALink: string;
  primaryColor: string;
  announcementColor: string;
  trustBadge1Title: string;
  trustBadge1Desc: string;
  trustBadge2Title: string;
  trustBadge2Desc: string;
  trustBadge3Title: string;
  trustBadge3Desc: string;
  trustBadge4Title: string;
  trustBadge4Desc: string;
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
  trustBadge1Icon: string;
  trustBadge2Icon: string;
  trustBadge3Icon: string;
  trustBadge4Icon: string;
  announcementEnabled: boolean;
  flashSaleEnabled: boolean;
  flashSaleEndTime: string;
  flashSaleMessage: string;
  scarcityThreshold: number;
  exitIntentPromoEnabled: boolean;
  exitIntentPromoCode: string;
  exitIntentPromoDiscount: string;
  salePageTitle: string;
  salePageSubtitle: string;
  salePageBadge: string;
  metaCapiTokenConfigured: boolean;
  isLoaded: boolean;
}

const CACHE_KEY = "trynex_site_settings_v5";

function getCachedSettings(): Partial<SiteSettings> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}
  return {};
}

const cached = getCachedSettings();

const c = (key: keyof SiteSettings) => (cached[key] as any) ?? undefined;

const defaults: SiteSettings = {
  siteName: c("siteName") || "TryNex Lifestyle",
  tagline: c("tagline") || "You Imagine, We Craft.",
  phone: c("phone") || "",
  whatsappNumber: c("whatsappNumber") || "",
  email: c("email") || "",
  address: c("address") || "",
  heroTitle: c("heroTitle") || "",
  heroSubtitle: c("heroSubtitle") || "",
  announcementBar: c("announcementBar") || "",
  googleAnalyticsId: c("googleAnalyticsId") || "",
  facebookPixelId: c("facebookPixelId") || "",
  googleAdsId: c("googleAdsId") || "",
  freeShippingThreshold: c("freeShippingThreshold") ?? 1500,
  shippingCost: c("shippingCost") ?? 100,
  bkashNumber: c("bkashNumber") || "",
  nagadNumber: c("nagadNumber") || "",
  rocketNumber: c("rocketNumber") || "",
  facebookUrl: c("facebookUrl") || "",
  instagramUrl: c("instagramUrl") || "",
  youtubeUrl: c("youtubeUrl") || "",
  promoBannerTitle: c("promoBannerTitle") || "",
  promoBannerSubtitle: c("promoBannerSubtitle") || "",
  promoBannerDiscount: c("promoBannerDiscount") || "",
  promoBannerCTA: c("promoBannerCTA") || "",
  promoBannerEnabled: c("promoBannerEnabled") ?? true,
  siteIcon: c("siteIcon") || "",
  facebookAppId: c("facebookAppId") || "",
  googleClientId: c("googleClientId") || "",
  googleSiteVerification: c("googleSiteVerification") || "",
  studioTshirtColors: c("studioTshirtColors") || "",
  studioMugColors: c("studioMugColors") || "",
  studioTshirtPrice: Number(c("studioTshirtPrice")) || 1099,
  studioMugPrice: Number(c("studioMugPrice")) || 799,
  heroImageUrl: c("heroImageUrl") || "",
  heroGradient: c("heroGradient") || "",
  heroCTAText: c("heroCTAText") || "Shop Now",
  heroCTALink: c("heroCTALink") || "/shop",
  primaryColor: c("primaryColor") || "#E85D04",
  announcementColor: c("announcementColor") || "#E85D04",
  trustBadge1Title: c("trustBadge1Title") || "100% Secure Payments",
  trustBadge1Desc: c("trustBadge1Desc") || "bKash, Nagad, Rocket & COD",
  trustBadge2Title: c("trustBadge2Title") || "Nationwide Delivery",
  trustBadge2Desc: c("trustBadge2Desc") || "All 64 districts of Bangladesh",
  trustBadge3Title: c("trustBadge3Title") || "Quality Guarantee",
  trustBadge3Desc: c("trustBadge3Desc") || "230-320GSM premium fabric",
  trustBadge4Title: c("trustBadge4Title") || "5,000+ Happy Customers",
  trustBadge4Desc: c("trustBadge4Desc") || "98% satisfaction rate",
  sectionFeaturedEnabled: c("sectionFeaturedEnabled") ?? true,
  sectionCategoriesEnabled: c("sectionCategoriesEnabled") ?? true,
  sectionFlashSaleEnabled: c("sectionFlashSaleEnabled") ?? true,
  sectionTestimonialsEnabled: c("sectionTestimonialsEnabled") ?? true,
  sectionStatsEnabled: c("sectionStatsEnabled") ?? true,
  categoryTshirtsEnabled: c("categoryTshirtsEnabled") ?? true,
  categoryHoodiesEnabled: c("categoryHoodiesEnabled") ?? true,
  categoryCapsEnabled: c("categoryCapsEnabled") ?? true,
  categoryMugsEnabled: c("categoryMugsEnabled") ?? true,
  categoryCustomEnabled: c("categoryCustomEnabled") ?? true,
  trustBadge1Icon: c("trustBadge1Icon") || "shield",
  trustBadge2Icon: c("trustBadge2Icon") || "truck",
  trustBadge3Icon: c("trustBadge3Icon") || "award",
  trustBadge4Icon: c("trustBadge4Icon") || "users",
  announcementEnabled: c("announcementEnabled") ?? true,
  flashSaleEnabled: c("flashSaleEnabled") ?? false,
  flashSaleEndTime: c("flashSaleEndTime") || "",
  flashSaleMessage: c("flashSaleMessage") || "⚡ FLASH SALE — Limited Stock!",
  scarcityThreshold: Number(c("scarcityThreshold")) || 5,
  exitIntentPromoEnabled: c("exitIntentPromoEnabled") ?? true,
  exitIntentPromoCode: c("exitIntentPromoCode") || "",
  exitIntentPromoDiscount: c("exitIntentPromoDiscount") || "10%",
  salePageTitle: c("salePageTitle") || "Mega Sale — Up to 50% Off!",
  salePageSubtitle: c("salePageSubtitle") || "Bangladesh's best custom apparel at unbeatable prices.",
  salePageBadge: c("salePageBadge") || "LIMITED TIME",
  metaCapiTokenConfigured: c("metaCapiTokenConfigured") ?? false,
  isLoaded: false,
};

const SiteSettingsContext = createContext<SiteSettings>(defaults);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const { data } = useGetSettings();
  const prevNameRef = useRef<string | null>(null);
  const settings: SiteSettings = { ...defaults, ...(data as Partial<SiteSettings> || {}), isLoaded: !!data };

  useEffect(() => {
    if (data) {
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
      if (prevNameRef.current === null) {
        prevNameRef.current = (data as any).siteName || "";
      }
    }
  }, [data]);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
