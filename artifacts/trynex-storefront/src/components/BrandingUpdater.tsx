import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSiteSettings } from "@/context/SiteSettingsContext";

declare global {
  interface Window {
    FB?: {
      init: (config: Record<string, unknown>) => void;
      login?: (cb: (resp: { authResponse?: { accessToken: string } }) => void, opts: { scope: string }) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function BrandingUpdater() {
  const { siteIcon, facebookAppId, googleSiteVerification, primaryColor, isLoaded } = useSiteSettings();

  useEffect(() => {
    if (!isLoaded) return;
    const color = primaryColor || "#E85D04";
    document.documentElement.style.setProperty("--color-primary", color);
    document.documentElement.style.setProperty("--color-primary-light", `${color}22`);
    document.documentElement.style.setProperty("--color-primary-medium", `${color}44`);
  }, [primaryColor, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;

    if (siteIcon && siteIcon.trim()) {
      const faviconEl = document.getElementById("favicon-link") as HTMLLinkElement | null;
      const appleEl = document.getElementById("apple-touch-icon-link") as HTMLLinkElement | null;
      if (faviconEl) {
        faviconEl.href = siteIcon;
        faviconEl.type = siteIcon.endsWith(".svg") ? "image/svg+xml" : "image/png";
      }
      if (appleEl) appleEl.href = siteIcon;
    }
  }, [siteIcon, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !facebookAppId || !facebookAppId.trim()) return;

    if (window.FB) return;

    window.fbAsyncInit = function () {
      window.FB?.init({
        appId: facebookAppId,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
    };

    const id = "facebook-jssdk";
    if (document.getElementById(id)) return;

    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = `https://connect.facebook.net/en_US/sdk.js`;
    document.head.appendChild(script);
  }, [facebookAppId, isLoaded]);

  return (
    <>
      {googleSiteVerification && googleSiteVerification.trim() && (
        <Helmet>
          <meta name="google-site-verification" content={googleSiteVerification.trim()} />
        </Helmet>
      )}
    </>
  );
}
