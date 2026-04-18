import { useEffect, useRef } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import {
  initGoogleAnalytics,
  initFacebookPixel,
  initGoogleAds,
  trackPageView,
} from "@/lib/tracking";

export function TrackingPixels() {
  const { data: settings } = useGetSettings();
  const [location] = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!settings || initialized.current) return;
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
  }, [settings]);

  useEffect(() => {
    if (initialized.current) {
      trackPageView(location);
    }
  }, [location]);

  return null;
}
