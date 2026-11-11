// Scope is /app/ only. This never touches Penny's cache: only caches named pc-* are ever deleted.
const CACHE = "pc-b5a87bc-mwccfca3"; // scripts/deploy-web.mjs stamps a new name here on every deploy, so the new worker replaces the old cache
const CORE = ["./", "index.html", "base.css", "pc.css", "app.css", "js/app.js", "js/ui.js", "js/course.js", "js/i18n.js", "js/art.js", "js/merge.js", "js/forecast.js", "js/util.js", "js/voice.js", "vendor/marked.min.js", "vendor/katex.min.js", "vendor/katex.min.css", "store.config.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(p => new Request(p, { cache: "no-cache" })))).catch(() => {})); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pc-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !u.pathname.startsWith(new URL("./", location.href).pathname)) return;
  // no-cache: always ask the server (a cheap 304 when nothing changed), so the browser's HTTP cache can't hand a new app.js an old course.js.
  // A navigation request can't be copied with options, so a page load is fetched by its URL.
  const fresh = e.request.mode === "navigate" ? fetch(u.href, { cache: "no-cache", credentials: "same-origin" }) : fetch(new Request(e.request, { cache: "no-cache" }));
  e.respondWith(fresh.then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
