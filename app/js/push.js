// Daily study reminders by web push (Marek, 2026-11-15: a Duolingo-style notifications step in the setup).
// pc-api sends an empty push once a day at 18:00 the student's time, only on a day they haven't studied yet
// (action "remind", pg_cron hourly). An empty push needs no payload encryption: the service worker writes the words itself,
// from the text this page leaves in IndexedDB. Not Cache Storage: Anna's Penny worker on the same origin deletes every other cache.
import { api } from "./util.js";
import { t, lang } from "./i18n.js";

// The public half of the VAPID key pair. The private half is the pc-api secret PC_VAPID_JWK (and in .env).
export const VAPID_PUBLIC = "BOYBe4gg1-AtUD1kSyJ1u4pSg2xJ6aTKQJb_BLtcvtdlDQHj9yhhZUOqL80aswEECQQxvqVwffC3FVtAh_DMquE";
export const REMIND_HOUR = 18; // same default as pc-api
// 18:00 or 6:00 PM, as the student's language writes it
export const remindTime = () => { try { return new Date(2024, 0, 1, REMIND_HOUR).toLocaleTimeString(lang(), { hour: "numeric", minute: "2-digit" }); } catch { return REMIND_HOUR + ":00"; } };

// iPhone Safari has push only for an app added to the home screen (iOS 16.4+); in a normal tab there is no PushManager.
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && window.isSecureContext;
// "unsupported" | "default" (never asked) | "granted" | "denied"
export const pushState = () => pushSupported() ? Notification.permission : "unsupported";
const bytes = b64 => { const s = atob((b64 + "=".repeat((4 - b64.length % 4) % 4)).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(s, c => c.charCodeAt(0)); };
const ready = () => Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("no_sw")), 6000))]);

// The words of the reminder, in the app's language, for the service worker.
export function saveText(tutorName) {
  return new Promise(res => {
    try {
      const rq = indexedDB.open("pc-push", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onsuccess = () => {
        const tx = rq.result.transaction("kv", "readwrite");
        tx.objectStore("kv").put({ title: tutorName || t("brand"), body: t("pushBody"), lang: lang() }, "text");
        tx.oncomplete = () => { rq.result.close(); res(true); }; tx.onerror = () => res(false);
      };
      rq.onerror = () => res(false);
    } catch { res(false); }
  });
}
// Asks the browser (only from a tap: browsers ignore or block a prompt nobody asked for) and subscribes.
// Returns the subscription as JSON, or null if the student said no or the browser can't.
export async function askPush(tutorName) {
  if (!pushSupported()) return null;
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (p !== "granted") return null;
  return subscribe(tutorName);
}
export async function subscribe(tutorName) {
  const reg = await ready();
  // a browser without a reachable push service can leave subscribe() pending: give up after 10 s rather than hold the button
  const sub = await reg.pushManager.getSubscription() || await Promise.race([reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes(VAPID_PUBLIC) }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("push_timeout")), 10000))]);
  await saveText(tutorName);
  return sub.toJSON();
}
export async function current() {
  if (pushState() !== "granted") return null;
  try { return (await (await ready()).pushManager.getSubscription())?.toJSON() || null; } catch { return null; }
}
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Prague"; } catch { return "Europe/Prague"; } };
export const sendSub = (session, sub) => api("push_sub", { session, sub, tz: tz(), lang: lang() });
export async function turnOff(session) {
  const sub = await current();
  try { await api("push_off", { session, endpoint: sub?.endpoint }); } finally {
    try { const s = await (await ready()).pushManager.getSubscription(); await s?.unsubscribe(); } catch { /* the server row is gone either way */ }
  }
}
