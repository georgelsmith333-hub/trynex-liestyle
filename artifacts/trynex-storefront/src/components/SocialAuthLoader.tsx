import { useEffect } from "react";
import { useSiteSettings } from "@/context/SiteSettingsContext";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (config: Record<string, unknown>) => void;
      login: (cb: (resp: { authResponse?: { accessToken: string } }) => void, opts: { scope: string }) => void;
    };
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            ux_mode?: string;
          }) => void;
          renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
          prompt: (momentListener?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}

export function SocialAuthLoader() {
  const { facebookAppId, googleClientId } = useSiteSettings();

  useEffect(() => {
    if (!googleClientId) return;
    if (window.google?.accounts?.id) return;
    if (document.getElementById("google-gsi-script")) return;

    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, [googleClientId]);

  useEffect(() => {
    if (!facebookAppId) return;
    if (window.FB) return;

    window.fbAsyncInit = () => {
      window.FB!.init({
        appId: facebookAppId,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
    };

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.body.appendChild(script);
    }
  }, [facebookAppId]);

  return null;
}
