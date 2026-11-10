// Scope is /app/ only. This never touches Penny's cache: only caches named pc-* are ever deleted.
const CACHE = "pc-v5";
const CORE = ["./", "index.html", "base.css", "pc.css", "app.css", "js/app.js", "js/ui.js", "js/course.js", "js/i18n.js", "js/art.js", "js/merge.js", "js/forecast.js", "js/util.js", "js/voice.js", "vendor/marked.min.js", "vendor/katex.min.js", "vendor/katex.min.css", "store.config.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pc-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith(new URL("./", location.href).pathname)) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
