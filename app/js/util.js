// Shared helpers, mostly the same ones Penny uses. Every localStorage key here starts with pc., so Penny on the same site is never touched.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const view = () => document.getElementById("view");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = a => a[Math.floor(Math.random() * a.length)];
const pad = n => String(n).padStart(2, "0");
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => iso(new Date());
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
export const fmtDate = (s, lang) => parseD(s).toLocaleDateString(lang === "en" ? "en-GB" : "cs-CZ", { day: "numeric", month: "long", year: "numeric" });
export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

export const store = {
  get(k, dflt = null) { try { const v = localStorage.getItem("pc." + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
  set(k, v) { try { localStorage.setItem("pc." + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem("pc." + k); } catch (e) { } },
};

const API = "https://mlgedjxcoqaccbzxtmsu.supabase.co/functions/v1/pc-api";
export async function api(action, body = {}) {
  // Local testing only: a fake backend from scripts/dev (never on the live site, which isn't 127.0.0.1).
  if (location.hostname === "127.0.0.1" && localStorage.getItem("pc.dev.mock")) return (await import("/scripts/dev/mock-api.js")).mock(action, body);
  let r;
  try { r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...body }) }); }
  catch (e) { const err = new Error("offline"); err.code = "offline"; throw err; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const err = new Error(j.error || "server"); err.code = j.error || "server"; err.status = r.status; throw err; }
  return j;
}

// Course text is written by an AI from uploaded slides and shares an origin with Anna's Penny, so it never becomes live HTML:
// raw HTML is shown as text, and links only go to web, mail or in-app addresses.
if (globalThis.marked) marked.use({
  renderer: { html: ({ text }) => esc(text) },
  walkTokens(tok) { if ((tok.type === "link" || tok.type === "image") && !/^(https?:|mailto:|#)/i.test(String(tok.href || "").trim())) tok.href = "#"; },
});
export function md(text, inline = false) {
  const math = [];
  const t = String(text ?? "").replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m, a, b) => { math.push([a ?? b, a != null]); return `@@M${math.length - 1}@@`; });
  const html = inline ? marked.parseInline(t) : marked.parse(t);
  return html.replace(/@@M(\d+)@@/g, (m, i) => {
    const [tex, disp] = math[+i];
    try { return katex.renderToString(tex, { displayMode: disp, throwOnError: false, strict: false }); } catch (e) { return esc(tex); }
  });
}
export const mdi = t => md(t, true);

let AC = null;
function tone(seq) {
  if (store.get("sound", true) === false) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    let t = AC.currentTime;
    for (const [f, d, type = "sine", v = .14] of seq) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d); t += d * .75;
    }
  } catch (e) { }
}
// Haptics: phones that allow vibration in the browser (Android Chrome). iPhone Safari ignores it, so this simply does nothing there.
const touch = (() => { try { return matchMedia("(pointer:coarse)").matches; } catch (e) { return false; } })();
export const buzz = p => { if (touch && navigator.vibrate && store.get("haptics", true) !== false) try { navigator.vibrate(p); } catch (e) { } };
export const sfx = {
  right: () => { buzz(18); tone([[660, .12], [990, .22]]); },
  wrong: () => { buzz([35, 50, 35]); tone([[220, .2, "triangle", .12], [180, .25, "triangle", .1]]); },
  flip: () => { buzz(8); tone([[520, .06, "sine", .06]]); },
  done: () => { buzz([20, 40, 20, 40, 60]); tone([[523, .12], [659, .12], [784, .12], [1046, .3]]); },
};
export function confetti(n = 70) {
  const box = document.createElement("div"); box.className = "confetti";
  const cols = ["#58cc02", "#1cb0f6", "#ffc800", "#ff4b4b", "#ce82ff", "#ff9600"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw"; p.style.background = pick(cols);
    p.style.animationDuration = (1.6 + Math.random() * 1.8) + "s"; p.style.animationDelay = (Math.random() * .4) + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4000);
}
export function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
export const I = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
export const ic = {
  x: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  back: I('<path d="M15 18l-6-6 6-6"/>'),
  check: I('<path d="M20 6L9 17l-5-5"/>'),
  upload: I('<path d="M12 16V4M6 10l6-6 6 6M4 20h16"/>'),
  file: I('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'),
  book: I('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  star: I('<path d="M12 2l3 7 7 .6-5.3 4.6L18.300 22 12 18l-6.300 4 1.600-7.800L2 9.600 9 9z"/>'),
  copy: I('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
};
