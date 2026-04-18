/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";

declare let self: ServiceWorkerGlobalScope;

// Take over from any older SW immediately so users don't have to refresh
// twice to pick up new code. Pairs with autoUpdate in vite.config.
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// One-time cleanup of the api-cache that older SW versions populated. It
// stored cross-origin and error responses that broke admin login for
// returning visitors.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k === "api-cache" || k === "navigation-cache")
          .map((k) => caches.delete(k))
      )
    )
  );
});

registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "gstatic-fonts-cache",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

registerRoute(
  /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i,
  new StaleWhileRevalidate({
    cacheName: "images-cache",
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// IMPORTANT: never intercept API traffic. The previous version of this file
// matched any URL whose path contained "/api/" — that included the
// cross-origin Render backend (https://trynex-api.onrender.com/api/...) and
// caused stale 4xx responses to be replayed as "Incorrect password". All API
// calls must hit the network directly, with the browser's normal CORS and
// credentials handling.

const navigationHandler = new NetworkFirst({
  cacheName: "navigation-cache-v2",
  networkTimeoutSeconds: 5,
  plugins: [new CacheableResponsePlugin({ statuses: [200] })],
});

registerRoute(
  new NavigationRoute(async (params) => {
    try {
      return await navigationHandler.handle(params);
    } catch {
      const offlinePage = await matchPrecache("/offline.html");
      return offlinePage || Response.error();
    }
  }, {
    // Skip API, SW, manifest, and admin routes entirely so the SW never
    // returns cached HTML for them.
    denylist: [/^\/api\//, /^\/sw\.js$/, /^\/manifest\.json$/, /^\/admin/],
  })
);

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
