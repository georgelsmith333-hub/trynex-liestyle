import { useEffect, useRef } from "react";
import { useSiteSettings } from "@/context/SiteSettingsContext";
import { useLocation } from "wouter";
import {
  initGoogleAnalytics,
  initFacebookPixel,
  initGoogleAds,
  trackPageView,
} from "@/lib/tracking";

export function TrackingPixels() {
  const settings = useSiteSettings();
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings.isLoaded || initialized.current) return;
    initialized.current = true;

    if (settings.googleAnalyticsId) {
      initGoogleAnalytics(settings.googleAnalyticsId);
    }
    if (settings.facebookPixelId) {
      initFacebookPixel(settings.facebookPixelId);
    }
    if (settings.googleAdsId) {
      initGoogleAds(settings.googleAdsId);
    }
  }, [settings.isLoaded, settings.googleAnalyticsId, settings.facebookPixelId, settings.googleAdsId]);

  useEffect(() => {
    if (initialized.current) {
      trackPageView(location);
    }
  }, [location]);

  return null;
}
