// Scope is /app/ only. This never touches Penny's cache: only caches named pc-* are ever deleted.
const CACHE = "pc-bd028ef-mwkpm7y0"; // scripts/deploy-web.mjs stamps a new name here on every deploy, so the new worker replaces the old cache
const CORE = ["./", "index.html", "base.css", "pc.css", "app.css", "js/app.js", "js/ui.js", "js/course.js", "js/i18n.js", "js/art.js", "js/merge.js", "js/forecast.js", "js/images.js", "js/util.js", "js/voice.js", "js/persona.js", "js/build.js", "js/push.js", "vendor/marked.min.js", "vendor/katex.min.js", "vendor/katex.min.css", "store.config.json"];
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

// Daily study reminder (js/push.js). pc-api sends an empty push, so the words come from IndexedDB, written by the page
// in the student's language. Cache Storage would not do: Anna's Penny worker on this origin deletes every cache but its own.
const pushText = () => new Promise(res => {
  try {
    const rq = indexedDB.open("pc-push", 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
    rq.onsuccess = () => { const g = rq.result.transaction("kv").objectStore("kv").get("text"); g.onsuccess = () => { res(g.result || null); rq.result.close(); }; g.onerror = () => res(null); };
    rq.onerror = () => res(null);
  } catch (e) { res(null); }
});
self.addEventListener("push", e => e.waitUntil((async () => {
  let m = { title: "Kvizoo", body: "Dnešní lekce na tebe čeká. Stačí pár minut." };
  const saved = await pushText(); if (saved) m = { ...m, ...saved };
  try { if (e.data) m = { ...m, ...e.data.json() }; } catch (er) { /* an empty push is the normal case */ }
  return self.registration.showNotification(m.title, { body: m.body, icon: "icon-192.png", badge: "icon-192.png", tag: "pc-remind", lang: m.lang, data: { url: "./" } });
})()));
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => new URL(c.url).pathname.startsWith(new URL("./", location.href).pathname));
    return w ? w.focus() : self.clients.openWindow("./");
  }));
});
