import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { useSiteSettings } from "@/context/SiteSettingsContext";

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  keywords?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE_URL = "https://trynexshop.com";
const DEFAULT_IMAGE = "/opengraph.jpg";

export function SEOHead({
  title,
  description,
  canonical,
  ogImage,
  ogType = "website",
  keywords,
  noindex = false,
  jsonLd,
}: SEOHeadProps) {
  const settings = useSiteSettings() as any;
  const [location] = useLocation();

  const siteName = settings.siteName;
  const seoDefaultTitle = settings.seoDefaultTitle || `${siteName} | Premium Custom Apparel Bangladesh`;
  const seoDefaultDescription = settings.seoDefaultDescription || "Bangladesh's #1 premium custom apparel brand. Custom T-shirts, Hoodies, Mugs & Caps. Fast delivery across all 64 districts.";
  const seoDefaultKeywords = settings.seoDefaultKeywords;
  const seoOgImage = settings.seoOgImage || DEFAULT_IMAGE;
  const seoTwitterHandle = settings.seoTwitterHandle;
  const googleSiteVerification = settings.googleSiteVerification;

  const fullTitle = title ? `${title} | ${siteName}` : seoDefaultTitle;
  const finalDescription = description || seoDefaultDescription;
  const finalKeywords = keywords || seoDefaultKeywords;
  const finalOgImage = ogImage || seoOgImage;

  const canonicalPath = canonical ?? location;
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const fullOgImage = finalOgImage.startsWith("http") ? finalOgImage : `${SITE_URL}${finalOgImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={finalDescription} />
      {finalKeywords && <meta name="keywords" content={finalKeywords} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang — tells Google this is Bangladesh English content */}
      <link rel="alternate" hrefLang="en-BD" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Google Search Console verification */}
      {googleSiteVerification && (
        <meta name="google-site-verification" content={googleSiteVerification} />
      )}

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={finalDescription} />
      <meta property="og:image" content={fullOgImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:locale" content="en_BD" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={finalDescription} />
      <meta name="twitter:image" content={fullOgImage} />
      {seoTwitterHandle && <meta name="twitter:site" content={seoTwitterHandle} />}
      {seoTwitterHandle && <meta name="twitter:creator" content={seoTwitterHandle} />}

      {jsonLd && (
        Array.isArray(jsonLd) ? (
          jsonLd.map((ld, i) => (
            <script key={i} type="application/ld+json">
              {JSON.stringify(ld)}
            </script>
          ))
        ) : (
          <script type="application/ld+json">
            {JSON.stringify(jsonLd)}
          </script>
        )
      )}
    </Helmet>
  );
}
