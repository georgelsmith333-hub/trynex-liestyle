import { Helmet } from "react-helmet-async";
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
  description = "Bangladesh's #1 premium custom apparel brand. Custom T-shirts, Hoodies, Mugs & Caps. Fast delivery across all 64 districts.",
  canonical,
  ogImage = DEFAULT_IMAGE,
  ogType = "website",
  keywords,
  noindex = false,
  jsonLd,
}: SEOHeadProps) {
  const { siteName } = useSiteSettings();
  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} | Premium Custom Apparel Bangladesh`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
  const fullOgImage = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullOgImage} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:locale" content="en_BD" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullOgImage} />

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
