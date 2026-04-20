/**
 * Cache recovery utilities.
 *
 * The single biggest source of "white screen" and "HTTP 400 password required"
 * reports has been stale Service Worker installations on returning visitors.
 * The previous SW versions:
 *   1. Cached cross-origin /api/* responses (so Render error replies were
 *      replayed forever as "Incorrect password").
 *   2. Cached /index.html so navigations resolved to old HTML referencing
 *      JS chunks whose hashes no longer exist on the server. The dynamic
 *      import then 404s, React's Suspense rejects, and the page goes blank.
 *
 * The fixes already shipped in `sw.ts` solve this for new installs, but we
 * still need to evict users who already have an old SW. This module:
 *   - On every boot, compares a build-time version stamp against the value
 *     stored in localStorage. A mismatch triggers a one-shot "nuke" that
 *     unregisters every SW, deletes every cache, and reloads. The reload
 *     pulls fresh HTML, fresh chunks, and the corrected SW.
 *   - Exposes `nukeAndReload()` for use from error boundaries and other
 *     recovery paths (e.g. the admin login page when it sees a body-less
 *     400, which is the signature of an intercepted/mangled SW request).
 */

// Bumped on every meaningful change to client caching behaviour. Compared
// against localStorage["trynex_build"]. When it differs from the stored
// value the user is auto-recovered.
const CURRENT_BUILD = "2026.04.21-blank-homepage-fix-offline-html";
const STORAGE_KEY = "trynex_build";
const RECENT_NUKE_KEY = "trynex_last_nuke";
const RECENT_NUKE_WINDOW_MS = 60_000;

let nukeInFlight: Promise<void> | null = null;

export async function nukeAndReload(reason: string): Promise<void> {
  if (nukeInFlight) return nukeInFlight;
  nukeInFlight = (async () => {
    // Guard against reload loops: if we just nuked, don't do it again.
    try {
      const last = Number(sessionStorage.getItem(RECENT_NUKE_KEY) || "0");
      if (Date.now() - last < RECENT_NUKE_WINDOW_MS) {
        // eslint-disable-next-line no-console
        console.warn(`[trynex] Skipping nuke (recent): ${reason}`);
        return;
      }
      sessionStorage.setItem(RECENT_NUKE_KEY, String(Date.now()));
    } catch { /* sessionStorage unavailable — proceed anyway */ }

    // eslint-disable-next-line no-console
    console.warn(`[trynex] Recovering from stale cache: ${reason}`);

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
      }
    } catch { /* ignore */ }

    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
      }
    } catch { /* ignore */ }

    try {
      localStorage.setItem(STORAGE_KEY, CURRENT_BUILD);
    } catch { /* ignore */ }

    // Add a cache-buster query param so the reload is guaranteed to bypass
    // any HTTP cache as well.
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  })();
  return nukeInFlight;
}

export function checkBuildVersion(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === CURRENT_BUILD) return;
    if (stored == null) {
      // First visit on this build — just record it, don't nuke.
      localStorage.setItem(STORAGE_KEY, CURRENT_BUILD);
      return;
    }
    // Stored a different build => returning visitor with old assets.
    void nukeAndReload(`build mismatch ${stored} -> ${CURRENT_BUILD}`);
  } catch { /* localStorage blocked — skip */ }
}

/**
 * Watch for the telltale signs of a stale-bundle problem and auto-recover:
 *   - Failed dynamic imports (chunk 404 after deploy).
 *   - "Loading chunk X failed" / "Failed to fetch dynamically imported
 *     module" runtime errors.
 */
export function installChunkErrorRecovery(): void {
  const looksLikeChunkError = (msg: string): boolean => {
    const m = msg.toLowerCase();
    return (
      m.includes("failed to fetch dynamically imported module") ||
      m.includes("loading chunk") ||
      m.includes("importing a module script failed") ||
      m.includes("error loading dynamically imported")
    );
  };

  window.addEventListener("error", (event) => {
    const msg = event?.message || event?.error?.message || "";
    if (looksLikeChunkError(msg)) {
      void nukeAndReload(`chunk error: ${msg.slice(0, 120)}`);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const msg = typeof reason === "string"
      ? reason
      : (reason?.message || String(reason || ""));
    if (looksLikeChunkError(msg)) {
      void nukeAndReload(`chunk error (rejection): ${msg.slice(0, 120)}`);
    }
  });
}
