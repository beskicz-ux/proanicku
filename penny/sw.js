/* Penny offline: network-first for everything on this site, cached copy when offline. */
const CACHE = "penny-v22";
const CORE = ["./", "index.html", "app.js?v=22", "app.css?v=22", "data/course.json", "vendor/marked.min.js", "vendor/katex.min.js", "vendor/katex.min.css", "icon.svg", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(m => m || caches.match(e.request, { ignoreSearch: true }))));
});
