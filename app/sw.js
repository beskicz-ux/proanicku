// proanicku.cz/app/ now forwards to kvizoo.com/app/. This worker replaces the app's old one at the same address: it deletes
// only the app's own caches (pc-*), never Penny's (penny-v*), then unregisters itself. Open tabs are left alone.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("pc-")).map(k => caches.delete(k)))).then(() => self.registration.unregister()));
});
