import { useEffect } from "react";
import { useLocation } from "wouter";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const SESSION_PREFIX = "trynex_utm_";

export function captureUtm() {
  const params = new URLSearchParams(window.location.search);
  let captured = false;
  for (const key of UTM_KEYS) {
    const val = params.get(key);
    if (val) {
      sessionStorage.setItem(SESSION_PREFIX + key, val);
      captured = true;
    }
  }
  return captured;
}

export function getStoredUtm(): { utmSource?: string; utmMedium?: string; utmCampaign?: string } {
  return {
    utmSource: sessionStorage.getItem(SESSION_PREFIX + "utm_source") || undefined,
    utmMedium: sessionStorage.getItem(SESSION_PREFIX + "utm_medium") || undefined,
    utmCampaign: sessionStorage.getItem(SESSION_PREFIX + "utm_campaign") || undefined,
  };
}

export function useUtmCapture() {
  const [location] = useLocation();
  useEffect(() => {
    captureUtm();
  }, [location]);
}
