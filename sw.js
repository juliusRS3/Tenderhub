// Offline support: caches the app files so TenderHub opens even with a weak connection.
// When you change any file, bump the version number below so users get the update.
const VERSION = "tenderhub-v4";
const FILES = [
  "./", "index.html", "config.js", "manifest.webmanifest", "css/app.css",
  "js/app.js", "js/ui.js", "js/store.js", "js/store-local.js", "js/store-supabase.js", "js/crypto.js",
  "js/pages/landing.js", "js/pages/auth.js", "js/pages/buyer.js", "js/pages/rfq.js",
  "js/pages/supplier.js", "js/pages/billing.js", "js/pages/support.js", "js/pages/keys.js",
  "js/vendor/preact-htm.js", "icons/icon-192.png", "icons/logo-96.png", "icons/favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first (always fresh when online), fall back to cache when offline.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // never cache Supabase/API calls
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
