import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();

// Keys allowed to be written via PUT /settings (admin-only write)
const SETTINGS_KEYS = [
  "siteName", "tagline", "phone", "email", "address",
  "facebookUrl", "instagramUrl", "youtubeUrl",
  "heroTitle", "heroSubtitle",
  "announcementBar", "freeShippingThreshold",
  "bkashNumber", "nagadNumber", "rocketNumber",
  "whatsappNumber", "shippingCost",
  "googleAnalyticsId", "facebookPixelId", "googleAdsId",
  "siteIcon", "facebookAppId", "googleClientId", "googleSiteVerification",
  "promoBannerTitle", "promoBannerSubtitle", "promoBannerDiscount", "promoBannerCTA", "promoBannerEnabled",
  // Design Studio keys — removeBgApiKey is secret (write-only via admin, NEVER in public response)
  "removeBgApiKey", "studioTshirtColors", "studioMugColors",
  "studioTshirtPrice", "studioMugPrice",
  // Visual Designer keys (Task #7)
  "heroImageUrl", "heroGradient", "heroCTAText", "heroCTALink",
  "primaryColor", "announcementColor",
  "trustBadge1Title", "trustBadge1Desc",
  "trustBadge2Title", "trustBadge2Desc",
  "trustBadge3Title", "trustBadge3Desc",
  "trustBadge4Title", "trustBadge4Desc",
  "sectionFeaturedEnabled", "sectionCategoriesEnabled",
  "sectionFlashSaleEnabled", "sectionTestimonialsEnabled",
  "sectionStatsEnabled",
  // Per-category visibility
  "categoryTshirtsEnabled", "categoryHoodiesEnabled",
  "categoryCapsEnabled", "categoryMugsEnabled", "categoryCustomEnabled",
  // Trust badge icons
  "trustBadge1Icon", "trustBadge2Icon", "trustBadge3Icon", "trustBadge4Icon",
  // Announcement bar toggle + auto-hide
  "announcementEnabled", "announcementAutoHide",
  // Facebook Ads Conversion Suite (Task #9)
  "flashSaleEnabled", "flashSaleEndTime", "flashSaleMessage",
  "scarcityThreshold", "metaCapiToken",
  "exitIntentPromoEnabled", "exitIntentPromoCode", "exitIntentPromoDiscount",
  "salePageTitle", "salePageSubtitle", "salePageBadge",
  // Spin-the-Wheel settings
  "spinWheelEnabled", "spinWheelDelay", "spinWheelTitle", "spinWheelSubtitle",
  // SEO defaults
  "seoDefaultTitle", "seoDefaultDescription", "seoDefaultKeywords", "seoOgImage", "seoTwitterHandle",
];

async function buildSettings(map: Record<string, string | null>) {
  return {
    siteName: map["siteName"] ?? "TryNex Lifestyle",
    tagline: map["tagline"] ?? "You imagine, we craft.",
    phone: map["phone"] ?? "+880 1700-000000",
    email: map["email"] ?? "hello@trynex.com",
    address: map["address"] ?? "Banani, Dhaka-1213, Bangladesh",
    facebookUrl: map["facebookUrl"] ?? "",
    instagramUrl: map["instagramUrl"] ?? "",
    youtubeUrl: map["youtubeUrl"] ?? "",
    heroTitle: map["heroTitle"] ?? "",
    heroSubtitle: map["heroSubtitle"] ?? "",
    announcementBar: map["announcementBar"] ?? "🚚 Free delivery on orders above ৳1,500!",
    freeShippingThreshold: parseFloat(map["freeShippingThreshold"] ?? "1500"),
    bkashNumber: map["bkashNumber"] ?? "01712-345678",
    nagadNumber: map["nagadNumber"] ?? "01811-234567",
    rocketNumber: map["rocketNumber"] ?? "01611-234567",
    whatsappNumber: map["whatsappNumber"] ?? "01700-000000",
    shippingCost: parseFloat(map["shippingCost"] ?? "100"),
    googleAnalyticsId: map["googleAnalyticsId"] ?? "",
    facebookPixelId: map["facebookPixelId"] ?? "",
    googleAdsId: map["googleAdsId"] ?? "",
    siteIcon: map["siteIcon"] ?? "",
    facebookAppId: map["facebookAppId"] ?? "",
    googleClientId: map["googleClientId"] ?? "",
    googleSiteVerification: map["googleSiteVerification"] ?? "",
    promoBannerTitle: map["promoBannerTitle"] ?? "",
    promoBannerSubtitle: map["promoBannerSubtitle"] ?? "",
    promoBannerDiscount: map["promoBannerDiscount"] ?? "",
    promoBannerCTA: map["promoBannerCTA"] ?? "",
    promoBannerEnabled: (map["promoBannerEnabled"] ?? "true") !== "false",
    // Public Design Studio settings (safe to expose) — per product type
    studioTshirtColors: map["studioTshirtColors"] ?? "",
    studioMugColors: map["studioMugColors"] ?? "",
    // Admin-configured prices for custom studio orders (BDT)
    studioTshirtPrice: parseFloat(map["studioTshirtPrice"] ?? "1099"),
    studioMugPrice: parseFloat(map["studioMugPrice"] ?? "799"),
    // Visual Designer settings (Task #7)
    heroImageUrl: map["heroImageUrl"] ?? "",
    heroGradient: map["heroGradient"] ?? "",
    heroCTAText: map["heroCTAText"] ?? "Shop Now",
    heroCTALink: map["heroCTALink"] ?? "/shop",
    primaryColor: map["primaryColor"] ?? "#E85D04",
    announcementColor: map["announcementColor"] ?? "#E85D04",
    trustBadge1Title: map["trustBadge1Title"] ?? "100% Secure Payments",
    trustBadge1Desc: map["trustBadge1Desc"] ?? "bKash, Nagad, Rocket & COD",
    trustBadge2Title: map["trustBadge2Title"] ?? "Nationwide Delivery",
    trustBadge2Desc: map["trustBadge2Desc"] ?? "All 64 districts of Bangladesh",
    trustBadge3Title: map["trustBadge3Title"] ?? "Quality Guarantee",
    trustBadge3Desc: map["trustBadge3Desc"] ?? "230-320GSM premium fabric",
    trustBadge4Title: map["trustBadge4Title"] ?? "5,000+ Happy Customers",
    trustBadge4Desc: map["trustBadge4Desc"] ?? "98% satisfaction rate",
    sectionFeaturedEnabled: (map["sectionFeaturedEnabled"] ?? "true") !== "false",
    sectionCategoriesEnabled: (map["sectionCategoriesEnabled"] ?? "true") !== "false",
    sectionFlashSaleEnabled: (map["sectionFlashSaleEnabled"] ?? "true") !== "false",
    sectionTestimonialsEnabled: (map["sectionTestimonialsEnabled"] ?? "true") !== "false",
    sectionStatsEnabled: (map["sectionStatsEnabled"] ?? "true") !== "false",
    // Per-category visibility
    categoryTshirtsEnabled: (map["categoryTshirtsEnabled"] ?? "true") !== "false",
    categoryHoodiesEnabled: (map["categoryHoodiesEnabled"] ?? "true") !== "false",
    categoryCapsEnabled: (map["categoryCapsEnabled"] ?? "true") !== "false",
    categoryMugsEnabled: (map["categoryMugsEnabled"] ?? "true") !== "false",
    categoryCustomEnabled: (map["categoryCustomEnabled"] ?? "true") !== "false",
    // Trust badge icons (default icon keys)
    trustBadge1Icon: map["trustBadge1Icon"] ?? "shield",
    trustBadge2Icon: map["trustBadge2Icon"] ?? "truck",
    trustBadge3Icon: map["trustBadge3Icon"] ?? "award",
    trustBadge4Icon: map["trustBadge4Icon"] ?? "users",
    announcementEnabled: (map["announcementEnabled"] ?? "true") !== "false",
    announcementAutoHide: (map["announcementAutoHide"] ?? "false") === "true",
    // Facebook Ads Conversion Suite (Task #9)
    flashSaleEnabled: (map["flashSaleEnabled"] ?? "false") !== "false",
    flashSaleEndTime: map["flashSaleEndTime"] ?? "",
    flashSaleMessage: map["flashSaleMessage"] ?? "⚡ FLASH SALE — Limited Stock!",
    scarcityThreshold: parseInt(map["scarcityThreshold"] ?? "5", 10),
    exitIntentPromoEnabled: (map["exitIntentPromoEnabled"] ?? "true") !== "false",
    exitIntentPromoCode: map["exitIntentPromoCode"] ?? "",
    exitIntentPromoDiscount: map["exitIntentPromoDiscount"] ?? "10%",
    salePageTitle: map["salePageTitle"] ?? "Mega Sale — Up to 50% Off!",
    salePageSubtitle: map["salePageSubtitle"] ?? "Bangladesh's best custom apparel at unbeatable prices.",
    salePageBadge: map["salePageBadge"] ?? "LIMITED TIME",
    // Spin-the-Wheel
    spinWheelEnabled: (map["spinWheelEnabled"] ?? "true") !== "false",
    spinWheelDelay: parseInt(map["spinWheelDelay"] ?? "4", 10),
    spinWheelTitle: map["spinWheelTitle"] ?? "Spin & Win an Offer!",
    spinWheelSubtitle: map["spinWheelSubtitle"] ?? "One free spin — no purchase needed.",
    // SEO defaults (used as fallback when page has no override)
    seoDefaultTitle: map["seoDefaultTitle"] ?? "TryNex Lifestyle — Custom Apparel & Gifts in Bangladesh",
    seoDefaultDescription: map["seoDefaultDescription"] ?? "Design and order custom T-shirts, hoodies, mugs, caps, and gift hampers in Bangladesh. Premium quality, nationwide delivery, cash on delivery.",
    seoDefaultKeywords: map["seoDefaultKeywords"] ?? "custom t-shirt bangladesh, personalized mug, gift hamper, custom hoodie, design studio, trynex",
    seoOgImage: map["seoOgImage"] ?? "",
    seoTwitterHandle: map["seoTwitterHandle"] ?? "",
    // NOTE: removeBgApiKey is intentionally NOT included here — it is server-only secret
    // NOTE: metaCapiToken is intentionally NOT included — server-only
    // Safe boolean flag: tells admin UI whether the token is configured (no secret exposed)
    metaCapiTokenConfigured: !!(map["metaCapiToken"]?.trim()),
  };
}

async function getPublicSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string | null> = {};
  for (const row of rows) { map[row.key] = row.value; }
  return buildSettings(map);
}

async function getAdminSettings() {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string | null> = {};
  for (const row of rows) { map[row.key] = row.value; }
  const base = await buildSettings(map);
  return {
    ...base,
    // Admin-only: include whether a remove.bg API key is configured (masked, not the actual value)
    removeBgApiKeyConfigured: !!(map["removeBgApiKey"]?.trim()),
  };
}

/** Public endpoint — NO secrets */
router.get("/settings", async (req, res) => {
  try {
    res.json(await getPublicSettings());
  } catch (err) {
    req.log.error({ err }, "Failed to get settings");
    res.status(500).json({ error: "internal_error", message: "Failed to get settings" });
  }
});

/** Admin-only: returns masked metadata (NOT the actual API key value) */
router.get("/admin/studio-settings", requireAdmin, async (req, res) => {
  try {
    res.json(await getAdminSettings());
  } catch (err) {
    req.log.error({ err }, "Failed to get admin settings");
    res.status(500).json({ error: "internal_error", message: "Failed to get settings" });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  try {
    for (const key of SETTINGS_KEYS) {
      if (req.body[key] !== undefined) {
        const value = req.body[key]?.toString() ?? null;
        // For removeBgApiKey/metaCapiToken: only write if a non-empty value is provided (don't overwrite with blank)
        if (key === "removeBgApiKey" && !value?.trim()) continue;
        if (key === "metaCapiToken" && !value?.trim()) continue;
        await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value, updatedAt: new Date() },
        });
      }
    }
    res.json(await getPublicSettings());
  } catch (err) {
    req.log.error({ err }, "Failed to update settings");
    res.status(500).json({ error: "internal_error", message: "Failed to update settings" });
  }
});

/** Admin Visual Designer: read all designer-specific settings */
router.get("/admin/designer-settings", requireAdmin, async (req, res) => {
  try {
    const all = await getAdminSettings();
    const s = all as Record<string, unknown>;
    res.json({
      primaryColor: s["primaryColor"] ?? "#E85D04",
      announcementColor: s["announcementColor"] ?? "#E85D04",
      heroImageUrl: s["heroImageUrl"] ?? "",
      heroGradient: s["heroGradient"] ?? "",
      heroCTAText: s["heroCTAText"] ?? "Shop Now",
      heroCTALink: s["heroCTALink"] ?? "/products",
      heroTitle: s["heroTitle"] ?? "",
      heroSubtitle: s["heroSubtitle"] ?? "",
      announcementBar: s["announcementBar"] ?? "",
      promoBannerTitle: s["promoBannerTitle"] ?? "",
      promoBannerSubtitle: s["promoBannerSubtitle"] ?? "",
      promoBannerDiscount: s["promoBannerDiscount"] ?? "",
      promoBannerCTA: s["promoBannerCTA"] ?? "",
      trustBadge1Title: s["trustBadge1Title"] ?? "",
      trustBadge1Desc: s["trustBadge1Desc"] ?? "",
      trustBadge2Title: s["trustBadge2Title"] ?? "",
      trustBadge2Desc: s["trustBadge2Desc"] ?? "",
      trustBadge3Title: s["trustBadge3Title"] ?? "",
      trustBadge3Desc: s["trustBadge3Desc"] ?? "",
      trustBadge4Title: s["trustBadge4Title"] ?? "",
      trustBadge4Desc: s["trustBadge4Desc"] ?? "",
      trustBadge1Icon: s["trustBadge1Icon"] ?? "shield",
      trustBadge2Icon: s["trustBadge2Icon"] ?? "truck",
      trustBadge3Icon: s["trustBadge3Icon"] ?? "award",
      trustBadge4Icon: s["trustBadge4Icon"] ?? "users",
      sectionFeaturedEnabled: s["sectionFeaturedEnabled"] ?? true,
      sectionCategoriesEnabled: s["sectionCategoriesEnabled"] ?? true,
      sectionFlashSaleEnabled: s["sectionFlashSaleEnabled"] ?? true,
      sectionTestimonialsEnabled: s["sectionTestimonialsEnabled"] ?? true,
      sectionStatsEnabled: s["sectionStatsEnabled"] ?? true,
      categoryTshirtsEnabled: s["categoryTshirtsEnabled"] ?? true,
      categoryHoodiesEnabled: s["categoryHoodiesEnabled"] ?? true,
      categoryCapsEnabled: s["categoryCapsEnabled"] ?? true,
      categoryMugsEnabled: s["categoryMugsEnabled"] ?? true,
      categoryCustomEnabled: s["categoryCustomEnabled"] ?? true,
      announcementEnabled: s["announcementEnabled"] ?? true,
      announcementAutoHide: s["announcementAutoHide"] ?? false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get designer settings");
    res.status(500).json({ error: "internal_error", message: "Failed to get designer settings" });
  }
});

/** Admin Visual Designer: partial update of designer-specific settings */
router.patch("/admin/designer-settings", requireAdmin, async (req, res) => {
  const DESIGNER_KEYS = [
    "primaryColor", "announcementColor",
    "heroImageUrl", "heroGradient", "heroCTAText", "heroCTALink",
    "heroTitle", "heroSubtitle", "announcementBar",
    "promoBannerTitle", "promoBannerSubtitle", "promoBannerDiscount", "promoBannerCTA",
    "trustBadge1Title", "trustBadge1Desc", "trustBadge1Icon",
    "trustBadge2Title", "trustBadge2Desc", "trustBadge2Icon",
    "trustBadge3Title", "trustBadge3Desc", "trustBadge3Icon",
    "trustBadge4Title", "trustBadge4Desc", "trustBadge4Icon",
    "sectionFeaturedEnabled", "sectionCategoriesEnabled",
    "sectionFlashSaleEnabled", "sectionTestimonialsEnabled", "sectionStatsEnabled",
    "categoryTshirtsEnabled", "categoryHoodiesEnabled",
    "categoryCapsEnabled", "categoryMugsEnabled", "categoryCustomEnabled",
    "announcementEnabled", "announcementAutoHide",
  ];
  try {
    for (const key of DESIGNER_KEYS) {
      if (req.body[key] !== undefined) {
        const value = req.body[key]?.toString() ?? null;
        await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({
          target: settingsTable.key,
          set: { value, updatedAt: new Date() },
        });
      }
    }
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update designer settings");
    res.status(500).json({ error: "internal_error", message: "Failed to update designer settings" });
  }
});

export default router;
