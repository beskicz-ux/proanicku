/* Penny — studijní parťák pro 1MT300 Měnová teorie a politika.
   Learning engine: retrieval practice (kvízy, kartičky), spaced repetition (SRS), interleaving (mix),
   self-explanation (Vysvětli to Penny), worked examples (příklady krok za krokem), dual coding (grafy). */

/* ===== NASTAVENÍ ===== */
const AGENT_ID = "agent_4601m6ett2qefv7vzde4710n5656";            // ElevenLabs Conversational AI agent id (Penny hlas). Prázdné = jen offline vyhledávání v poznámkách.
const DEFAULT_EXAM_DAYS = 14;
const EXAM_DATE = "2026-11-16";  // zkouška 1MT300
const START_DATE = "2026-11-11"; // Anička chce začít 11. 11. (dá se změnit v Plánu nebo tlačítkem „Začít dřív“)
/* ===================== */

const LS = "halir.v1";
const DAY = 86400000;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const view = () => document.getElementById("view");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return iso(d); };
const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / DAY);
const sod = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DOW = ["ne", "po", "út", "st", "čt", "pá", "so"];
const plural = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\$[^$]*\$/g, " ");

/* ---------- state ---------- */
function defaults() {
  const t = today();
  return { v: 1, examDate: EXAM_DATE > t ? EXAM_DATE : addDays(t, DEFAULT_EXAM_DAYS), essays: {}, essayDraft: {}, start: t, cards: {}, q: {}, read: {}, xp: {}, goal: 150, sound: true,
    feyn: {}, lists: {}, done: {}, exams: [], planFor: null, onlyRead: false, startDate: START_DATE };
}
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) { return defaults(); } })();
function save() { S.saved = Date.now(); try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } SYNC.later(); }

/* ---------- synchronizace mezi zařízeními (heslo = stejné jako na proanicku.cz) ---------- */
const SB_URL = "https://mlgedjxcoqaccbzxtmsu.supabase.co", SB_KEY = "sb_publishable_U1OfGCnogCusRBjEtQckGA_RPYUnRwo";
const PIN_KEY = "penny.pin";
async function rpc(fn, body) {
  const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  const err = !r.ok ? ((j && j.message) || "http " + r.status) : (j && j.error) ? j.error : (fn === "penny_save" && !j) ? "bad_pin" : null;
  if (err) { const e = new Error(err); e.server = true; throw e; }
  return j;
}
// sloučí dva stavy: u každé kartičky / otázky / eseje vyhraje novější záznam, nic se neztratí
function mergeState(a, b) {
  if (!b || typeof b !== "object" || !Object.keys(b).length) return a;
  if (!a || !Object.keys(a).length) return Object.assign(defaults(), b);
  if ((a.epoch || 0) !== (b.epoch || 0)) return Object.assign(defaults(), (a.epoch || 0) > (b.epoch || 0) ? a : b); // smazání / nahrání zálohy
  const newer = (a.saved || 0) >= (b.saved || 0) ? a : b, older = newer === a ? b : a;
  const out = Object.assign(defaults(), older, newer);
  const by = (k, f) => { const x = a[k] || {}, y = b[k] || {}; const o = {}; for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) o[id] = !(id in x) ? y[id] : !(id in y) ? x[id] : f(x[id], y[id]); out[k] = o; };
  by("read", (x, y) => Math.min(x || y, y || x));
  by("cards", (x, y) => ((x.last || 0) !== (y.last || 0) ? ((x.last || 0) > (y.last || 0) ? x : y) : ((x.reps || 0) >= (y.reps || 0) ? x : y)));
  by("q", (x, y) => ((x.last || 0) >= (y.last || 0) ? x : y));
  for (const k of ["essays", "feyn", "lists"]) by(k, (x, y) => ((x.ts || 0) >= (y.ts || 0) ? x : y));
  by("essayDraft", (x, y) => (String(x || "").length >= String(y || "").length ? x : y));
  by("xp", (x, y) => Math.max(x || 0, y || 0));
  by("uq", (x, y) => Math.max(x || 0, y || 0));
  by("seen", (x, y) => x || y);
  by("done", (x, y) => { const o = { ...x }; for (const k in y) o[k] = typeof y[k] === "number" ? Math.max(o[k] || 0, y[k]) : (o[k] || y[k]); return o; });
  const ex = {}; [...(a.exams || []), ...(b.exams || [])].forEach(e => ex[e.ts] = e); out.exams = Object.values(ex).sort((x, y) => x.ts - y.ts);
  out.saved = Math.max(a.saved || 0, b.saved || 0);
  return out;
}
const SYNC = {
  t: null, busy: false, again: false, state: "local", at: 0,
  pin: () => { try { return localStorage.getItem(PIN_KEY); } catch (e) { return null; } },
  later() { if (!this.pin()) return; clearTimeout(this.t); this.t = setTimeout(() => this.run(), 3000); },
  async run(pullOnly = false) {
    const pin = this.pin(); if (!pin) return false;
    if (this.busy) { this.again = true; return false; }
    this.busy = true; let changed = false;
    try {
      const remote = await rpc("penny_load", { p_pin: pin });
      const before = JSON.stringify(S);
      S = mergeState(S, remote.data);
      changed = JSON.stringify(S) !== before;
      try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
      if (!pullOnly || JSON.stringify(remote.data) !== JSON.stringify(S)) await rpc("penny_save", { p_pin: pin, p_data: S });
      this.state = "ok"; this.at = Date.now();
    } catch (e) { this.state = "offline"; }
    this.busy = false;
    if (this.again) { this.again = false; this.later(); }
    syncBadge();
    return changed;
  },
};
function syncBadge() { const b = document.getElementById("syncState"); if (b) b.textContent = SYNC.state === "ok" ? "V cloudu ✓" : SYNC.state === "offline" ? "Offline · uloží se později" : "Ukládá se…"; }
window.addEventListener("online", () => SYNC.run());
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "hidden") { clearTimeout(SYNC.t); SYNC.run(); }
  else if (C && SYNC.pin() && await SYNC.run(true) && !SESSION) render();
});

/* zámek: stejné 4místné heslo jako hlavní stránka */
function lockScreen() {
  return new Promise(done => {
    let pin = "";
    const el = document.createElement("div"); el.className = "lock"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Zadej heslo");
    el.innerHTML = `<div class="lock-in">${ham("happy", "idle")}<h1>Zadej heslo</h1><p class="muted small">Stejné jako na proanicku.cz. Postup se pak uloží na všech tvých zařízeních.</p>
      <div class="pin" id="pinDots"><i></i><i></i><i></i><i></i></div><p class="small" id="pinHint" aria-live="polite">&nbsp;</p>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join("")}<span></span><button data-d="0">0</button><button data-del aria-label="Smazat">⌫</button></div></div>`;
    document.body.appendChild(el); document.body.classList.add("locked");
    const dots = [...el.querySelectorAll("#pinDots i")]; const hint = el.querySelector("#pinHint");
    const draw = () => dots.forEach((d, i) => d.classList.toggle("on", i < pin.length));
    const fail = msg => { const b = el.querySelector(".pin"); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); hint.textContent = msg; setTimeout(() => { pin = ""; draw(); }, 450); };
    const press = async d => {
      if (pin.length >= 4) return; pin += d; draw(); if (pin.length < 4) return;
      hint.textContent = "Ověřuju…";
      try {
        const remote = await rpc("penny_load", { p_pin: pin });
        localStorage.setItem(PIN_KEY, pin);
        S = mergeState(S, remote.data); try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
        await rpc("penny_save", { p_pin: pin, p_data: S }).catch(() => { });
        SYNC.state = "ok"; el.querySelector(".pin").classList.add("ok");
        setTimeout(() => { el.remove(); document.body.classList.remove("locked"); window.onkeydown = null; done(); }, 350);
      } catch (e) {
        if (e.server) fail(/too_many/.test(e.message) ? "Moc pokusů — zkus to za chvíli." : "To není ono, zkus to znovu ♡");
        else fail("Nejde internet — připoj se a zkus to znovu.");
      }
    };
    el.querySelector(".pad").onclick = e => { const b = e.target.closest("button"); if (!b) return; if (b.hasAttribute("data-del")) { pin = pin.slice(0, -1); draw(); } else press(b.dataset.d); };
    window.onkeydown = e => { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === "Backspace") { pin = pin.slice(0, -1); draw(); } };
  });
}
function doneToday() { const t = today(); S.done[t] = S.done[t] || {}; return S.done[t]; }
function addXP(n) { const t = today(); S.xp[t] = (S.xp[t] || 0) + n; save(); }
const xpToday = () => S.xp[today()] || 0;
function streak() {
  let n = 0, d = today();
  if (!S.xp[d]) d = addDays(d, -1);
  while (S.xp[d]) { n++; d = addDays(d, -1); }
  return n;
}

/* ---------- course ---------- */
let C = null, LEC = {}, CARD = {}, QZ = {}, EXQ = {}, LIST = {}, SEC = {};
async function loadCourse() {
  const r = await fetch("data/course.json", { cache: "no-cache" });
  C = await r.json();
  for (const l of C.lectures) {
    LEC[l.id] = l;
    l.sections.forEach((s, i) => { s.lec = l.id; s.idx = i; SEC[s.id] = s; });
    l.flashcards.forEach(c => { c.lec = l.id; CARD[c.id] = c; });
    l.quiz.forEach(q => { q.lec = l.id; q.t = "mc"; QZ[q.id] = q; });
    (l.trueFalse || []).forEach(q => { q.lec = l.id; q.t = "tf"; QZ[q.id] = q; });
    (l.examQuestions || []).forEach(q => { q.lec = l.id; EXQ[q.id] = q; });
    (l.lists || []).forEach(q => { q.lec = l.id; LIST[q.id] = q; });
  }
}
const lectures = () => C.lectures;
const unitOf = id => C.units.find(u => u.ids.includes(id));

/* ---------- markdown + math ---------- */
function md(text, inline = false) {
  const math = [];
  let t = String(text ?? "").replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, (m, a, b) => { math.push([a ?? b, a != null]); return `@@M${math.length - 1}@@`; });
  let html = inline ? marked.parseInline(t) : marked.parse(t);
  html = html.replace(/@@M(\d+)@@/g, (m, i) => {
    const [tex, disp] = math[+i];
    try { return katex.renderToString(tex, { displayMode: disp, throwOnError: false, strict: false }); } catch (e) { return esc(tex); }
  });
  return html;
}
const mdi = t => md(t, true);

/* ---------- icons ---------- */
const I = (p, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const ic = {
  home: I('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  map: I('<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  cards: I('<rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/>'),
  plan: I('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  play: I('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  check: I('<path d="M4 12l5 5L20 6"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: I('<path d="M15 5l-7 7 7 7"/>'),
  right: I('<path d="M9 5l7 7-7 7"/>'),
  mic: I('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  send: I('<path d="M4 12l16-8-6 16-3-7z"/>'),
  book: I('<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>'),
  flame: I('<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-4 2-8 2-8z"/>'),
  target: I('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  graph: I('<path d="M4 4v16h16"/><path d="M7 16c4-1 6-6 12-9"/><path d="M7 7c3 1 7 6 12 9"/>'),
  list: I('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>'),
  pen: I('<path d="M4 20l4-1 11-11-3-3L5 16z"/>'),
  bolt: I('<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>'),
  trophy: I('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  search: I('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  brain: I('<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h1V4z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3h-1V4z"/>'),
  calc: I('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>'),
  sound: I('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>'),
  moon: I('<path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/>'),
  stop: I('<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'),
  clip: I('<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7.5"/>'),
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  gear: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81a.48.48 0 0 0-.48-.41h-3.84a.47.47 0 0 0-.47.41L9.25 5.35c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/></svg>`,
};

/* ---------- Penny (křeček) ---------- */
function ham(mood = "open", cls = "") {
  return `<svg class="ham m-${mood} ${cls}" viewBox="0 0 200 200" aria-hidden="true">
<defs><radialGradient id="fur" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#f6bf7a"/><stop offset="1" stop-color="#d98a43"/></radialGradient>
<radialGradient id="coin" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#ffe7a8"/><stop offset="1" stop-color="#d9a441"/></radialGradient></defs>
<ellipse cx="100" cy="187" rx="58" ry="8" fill="#000" opacity=".25"/>
<g class="body">
<ellipse cx="58" cy="56" rx="20" ry="19" fill="#d98a43"/><ellipse cx="58" cy="57" rx="11" ry="10" fill="#ff8fa8"/>
<ellipse cx="142" cy="56" rx="20" ry="19" fill="#d98a43"/><ellipse cx="142" cy="57" rx="11" ry="10" fill="#ff8fa8"/>
<path d="M100 44c46 0 74 34 74 76 0 42-30 64-74 64s-74-22-74-64c0-42 28-76 74-76z" fill="url(#fur)"/>
<path d="M100 100c30 0 46 20 46 43 0 25-18 39-46 39s-46-14-46-39c0-23 16-43 46-43z" fill="#fff1df"/>
<ellipse cx="54" cy="114" rx="24" ry="20" fill="#fff1df"/><ellipse cx="146" cy="114" rx="24" ry="20" fill="#fff1df"/>
<ellipse cx="56" cy="110" rx="10" ry="6" fill="#ff8fa8" opacity=".55"/><ellipse cx="144" cy="110" rx="10" ry="6" fill="#ff8fa8" opacity=".55"/>
<g class="e-open"><circle cx="76" cy="88" r="9" fill="#2b0c15"/><circle cx="124" cy="88" r="9" fill="#2b0c15"/><circle cx="79" cy="85" r="3" fill="#fff"/><circle cx="127" cy="85" r="3" fill="#fff"/></g>
<g class="e-happy" fill="none" stroke="#2b0c15" stroke-width="5" stroke-linecap="round"><path d="M67 91q9-11 18 0"/><path d="M115 91q9-11 18 0"/></g>
<g class="e-sad"><circle cx="76" cy="92" r="8" fill="#2b0c15"/><circle cx="124" cy="92" r="8" fill="#2b0c15"/><path d="M66 78l18 6M134 78l-18 6" stroke="#2b0c15" stroke-width="4" stroke-linecap="round"/></g>
<path d="M94 102h12l-6 7z" fill="#d9475f"/>
<g class="mouth-s"><path d="M100 109q-6 8-13 3M100 109q6 8 13 3" fill="none" stroke="#4a1a26" stroke-width="3" stroke-linecap="round"/><rect x="96" y="113" width="8" height="7" rx="1.5" fill="#fff"/></g>
<ellipse class="mouth-o" cx="100" cy="117" rx="6" ry="7" fill="#4a1a26"/>
<g stroke="#4a1a26" stroke-width="2" stroke-linecap="round" opacity=".45"><path d="M34 106l-18-4M34 114l-18 2M166 106l18-4M166 114l18 2"/></g>
<circle cx="100" cy="148" r="22" fill="url(#coin)" stroke="#b9822c" stroke-width="3"/>
<text x="100" y="155" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="700" fill="#8a5a17">P</text>
<ellipse cx="80" cy="148" rx="10" ry="8" fill="#f6c99a"/><ellipse cx="120" cy="148" rx="10" ry="8" fill="#f6c99a"/>
<ellipse cx="74" cy="183" rx="14" ry="7" fill="#f6c99a"/><ellipse cx="126" cy="183" rx="14" ry="7" fill="#f6c99a"/>
<g transform="rotate(-8 100 34)"><path d="M58 30l42-18 42 18-42 17z" fill="#7a5ae6"/><path d="M75 37v12q25 11 50 0V37l-25 10z" fill="#5a3cc4"/><path d="M142 30v22" stroke="#f4cf96" stroke-width="3"/><circle cx="142" cy="54" r="4.5" fill="#f4cf96"/></g>
</g></svg>`;
}
function hamReact(el, mood) {
  if (!el) return;
  el.classList.remove("m-open", "m-happy", "m-sad", "m-wow", "bounce");
  void el.getBoundingClientRect();
  el.classList.add("m-" + mood, "bounce");
}

const SAY = {
  hello: ["Ahoj Aničko! Plné líčka vědomostí čekají.", "Čau! Dneska si zase něco schováme do tvářiček.", "Křeček nezapomíná — ale jen proto, že opakuje. Jdeme na to?", "Hezky, že jsi tu. Pár minut denně a zkouška bude hračka."],
  right: ["Přesně tak!", "Bomba!", "To si schovám do líček.", "Jako když ČNB trefí inflační cíl!", "Výborně!", "Ano! Tohle už ti nikdo nevezme."],
  wrong: ["Nevadí — právě teď se to učíš nejvíc.", "Chyba je jen nezaplacená lekce. Teď už to víš.", "Skoro! Přečti si vysvětlení.", "Klid, tohle ti příště zopakuju."],
  done: ["Hotovo! Líčka plná.", "Skvělá práce, Aničko!", "Takhle se dělá měnová politika — systematicky!", "Tak tohle byl výkon."],
};

/* ---------- sound ---------- */
let AC = null;
function tone(seq) {
  if (!S.sound) return;
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
const sfx = {
  right: () => tone([[660, .12], [990, .22]]),
  wrong: () => tone([[220, .2, "triangle", .12], [180, .25, "triangle", .1]]),
  flip: () => tone([[520, .06, "sine", .06]]),
  done: () => tone([[523, .12], [659, .12], [784, .12], [1046, .3]]),
};
function confetti() {
  const box = document.createElement("div"); box.className = "confetti";
  const cols = ["#58cc02", "#1cb0f6", "#ffc800", "#ff4b4b", "#ce82ff", "#ff9600"];
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw"; p.style.background = pick(cols);
    p.style.animationDuration = (1.6 + Math.random() * 1.8) + "s"; p.style.animationDelay = (Math.random() * .4) + "s";
    p.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4000);
}
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ---------- spaced repetition ---------- */
const daysToExam = () => diffDays(today(), S.examDate);
function strength(id) {
  const s = S.cards[id]; if (!s) return 0;
  if (s.ivl >= 6) return 1; if (s.ivl >= 3) return .75; if (s.ivl >= 1) return .5; return .25;
}
function grade(id, g) {
  const s = S.cards[id] || { reps: 0, ease: 2.4, ivl: 0, lapses: 0 };
  const now = Date.now();
  if (g === 0) { s.lapses++; s.ease = Math.max(1.3, s.ease - .2); s.ivl = 0; s.reps = 0; s.due = now + 60e3; }
  else if (g === 1) {
    s.ease = Math.max(1.3, s.ease - .15);
    if (s.reps === 0) { s.ivl = 0; s.due = now + 6 * 60e3; } else { s.ivl = Math.max(1, Math.round(s.ivl * 1.2)); }
    s.reps++;
  } else if (g === 2) { s.ivl = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(Math.max(1, s.ivl) * s.ease); s.reps++; }
  else { s.ease += .15; s.ivl = s.reps === 0 ? 3 : Math.round(Math.max(1, s.ivl) * s.ease * 1.3); s.reps++; }
  if (s.ivl >= 1) {
    const cap = Math.max(1, Math.floor(Math.max(1, daysToExam()) / 2));
    s.ivl = Math.min(s.ivl, cap);
    s.due = sod(now) + s.ivl * DAY;
  }
  s.last = now; S.cards[id] = s; save();
  return s;
}
const isDue = id => S.cards[id] && S.cards[id].due <= Date.now();
const dueIds = () => Object.keys(S.cards).filter(id => CARD[id] && isDue(id));
const lecCards = id => LEC[id].flashcards.map(c => c.id);

// Kartičky z přečtené části jdou všechny do opakování (Anička chce umět úplně všechno); mechanismy a definice první.
const TYPE_PRIO = { "mechanismus": 0, "proč": 1, "definice": 2, "srovnání": 3, "vzorec": 4, "seznam": 5, "příklad": 6, "fakt": 7 };
function sectionCards(l, secId) {
  const cs = l.flashcards.filter(c => c.section === secId && !S.cards[c.id]);
  return [...cs].sort((a, b) => (TYPE_PRIO[a.type] ?? 9) - (TYPE_PRIO[b.type] ?? 9));
}

/* ---------- progress ---------- */
const sectionsRead = id => LEC[id].sections.filter(s => S.read[s.id]).length;
const lectureRead = id => sectionsRead(id) === LEC[id].sections.length;
function mastery(id) { const ids = lecCards(id); return ids.length ? ids.reduce((a, c) => a + strength(c), 0) / ids.length : 0; }
function quizAcc(id) {
  let n = 0, ok = 0;
  for (const q of [...LEC[id].quiz, ...(LEC[id].trueFalse || [])]) { const r = S.q[q.id]; if (r) { n += r.n; ok += r.ok; } }
  return n ? ok / n : null;
}
function overall() {
  const ls = lectures(); return ls.reduce((a, l) => a + (sectionsRead(l.id) / l.sections.length) * .3 + mastery(l.id) * .7, 0) / ls.length;
}

/* ---------- připravenost na zkoušku (odhad z toho, co umí, ne z aktivity) ---------- */
function readiness(id) {
  const l = LEC[id];
  const read = sectionsRead(id) / l.sections.length;
  const mem = mastery(id);
  const items = [...l.quiz, ...(l.trueFalse || [])];
  const answered = items.filter(q => S.q[q.id]);
  const acc = answered.length ? answered.filter(q => S.q[q.id].lastOk).length / answered.length : 0;
  const cover = items.length ? answered.length / items.length : 0;
  const quiz = acc * Math.min(1, cover / .5);          // přesnost se počítá naplno, až když máš za sebou aspoň půlku otázek
  return { read, mem, acc, cover, quiz, score: .15 * read + .4 * mem + .45 * quiz };
}
function essayReady() {
  const es = ESSAYS(); const done = es.filter(e => S.essays?.[e.id]);
  const avg = done.length ? done.reduce((a, e) => a + S.essays[e.id].score, 0) / done.length : 0;
  return { done: done.length, n: es.length, avg };
}
function overallReady() {
  const ls = lectures(); const lec = ls.reduce((a, l) => a + readiness(l.id).score, 0) / ls.length;
  const es = essayReady();
  const essay = es.done ? es.avg * Math.min(1, es.done / 3) : 0;   // 3 napsané eseje = plná váha
  return { lec, essay, score: .8 * lec + .2 * essay };
}
const LEVELS = [[85, "Připravená na výbornou"], [65, "Skoro tam"], [40, "Rozjeté"], [15, "Začátek"], [0, "Ještě jsme nezačali"]];
const levelOf = pct => LEVELS.find(([t]) => pct >= t)[1];

/* ---------- plan ---------- */
const DAYTYPE = {
  learn: { tag: "learn", name: "Nová látka" },
  mix: { tag: "mix", name: "Prokládaný mix" },
  weak: { tag: "weak", name: "Slabá místa" },
  exam: { tag: "exam", name: "Simulace zkoušky" },
  final: { tag: "final", name: "Poslední den" },
};
function buildPlan(fromDate, n, unread) {
  const days = [];
  if (n <= 0) return days;
  // posledních ~5 dní před zkouškou = jen opakování a simulace, nová látka musí být hotová dřív
  const review = n >= 9 ? 5 : n >= 7 ? 2 : 1;
  let learnDays = unread.length ? Math.min(unread.length, Math.max(1, n - review)) : 0;
  if (n <= 2 && unread.length) learnDays = n;
  let k = 0, j = 0;
  const cyc = review <= 2 ? ["exam"] : ["mix", "exam", "weak", "exam", "mix", "weak"];
  for (let d = 0; d < n; d++) {
    const date = addDays(fromDate, d);
    if (d < learnDays) {
      const take = Math.ceil((unread.length - k) / (learnDays - d));
      days.push({ date, type: "learn", ids: unread.slice(k, k + take) }); k += take;
    } else if (n - d === 1 && n > 1) days.push({ date, type: "final", ids: [] });
    else days.push({ date, type: cyc[j++ % cyc.length], ids: [] });
  }
  return days;
}
const planStart = () => (S.startDate && S.startDate > today()) ? S.startDate : today();
const beforeStart = () => planStart() > today();
const cram = () => diffDays(planStart(), S.examDate) <= 7;   // zhuštěný režim: málo dní na všechno
function plan() {
  if (beforeStart()) { const n = diffDays(planStart(), S.examDate); return n > 0 ? buildPlan(planStart(), n, lectures().map(l => l.id).filter(id => !lectureRead(id))) : []; }
  const t = today(); const n = daysToExam();
  if (n <= 0) return [];
  const unread = lectures().map(l => l.id).filter(id => !lectureRead(id));
  if (!S.planFor || S.planFor.date !== t || S.planFor.exam !== S.examDate) {
    const p = buildPlan(t, n, unread)[0];
    S.planFor = { date: t, exam: S.examDate, type: p.type, ids: p.ids }; save();
  }
  const first = { date: t, type: S.planFor.type, ids: S.planFor.ids };
  const rest = buildPlan(addDays(t, 1), n - 1, unread.filter(id => !first.ids.includes(id)));
  return [first, ...rest];
}

function missions() {
  if (beforeStart()) return [];
  const p = plan()[0]; const dt = doneToday(); const list = [];
  const due = dueIds().length; const anyCards = Object.keys(S.cards).length > 0;
  const readIds = lectures().map(l => l.id).filter(id => sectionsRead(id) > 0);
  if (anyCards) list.push({ k: "review", ico: ic.cards, t: "Opakování kartiček", c: `Zopakovat ${due} ${plural(due, "kartičku", "kartičky", "kartiček")}`, s: due ? `${due} ${plural(due, "kartička čeká", "kartičky čekají", "kartiček čeká")}` : "Na dnešek vše zopakováno", href: "#/karty", done: due === 0 });
  if (!p) return list;
  if (p.type === "learn") {
    for (const id of p.ids) { const n = LEC[id].sections.length, rd = sectionsRead(id); list.push({ k: "learn", ico: ic.book, t: `Nauč se ${id}: ${LEC[id].title}`, c: rd ? `Pokračovat v ${id} · zbývá ${n - rd}` : `Začít ${id} · ${n} ${plural(n, "část", "části", "částí")}`, s: `${LEC[id].sections.length} částí · čtení + rychlé kontroly + kartičky`, href: `#/uc/${id}`, done: lectureRead(id) }); }
    if (readIds.length) list.push({ k: "quiz", ico: ic.bolt, t: "Mini mix kvíz", c: "Spustit kvíz · 10 otázek", s: "10 otázek a/b/c/d napříč probranou látkou", href: "#/kviz?mix=1&n=10&m=quiz", done: (dt.quiz || 0) >= 1 });
    const fullyRead = lectures().map(l => l.id).filter(lectureRead);
    const e = pickEssay(fullyRead); if (e && e.lectures.every(id => fullyRead.includes(id))) list.push({ k: "essay", ico: ic.pen, t: "Esej na 15 minut", c: "Psát esej · 15 min", s: e.title, href: `#/esej/${e.id}`, done: (dt.essay || 0) >= 1 });
  } else if (p.type === "mix" || p.type === "final") {
    list.push({ k: "quiz", ico: ic.bolt, t: "Prokládaný kvíz", c: "Spustit kvíz · 20 otázek", s: "20 otázek ze všech lekcí najednou", href: "#/kviz?mix=1&n=20&m=quiz", done: (dt.quiz || 0) >= 1 });
    if (p.type !== "final") list.push({ k: "essay", ico: ic.pen, t: "Esej na 15 minut", c: "Psát esej · 15 min", s: "Propojí víc přednášek — jako na zkoušce", href: `#/esej/${(pickEssay(lectures().map(l => l.id)) || {}).id}`, done: (dt.essay || 0) >= 1 });
    if (p.type === "final") {
      if (cram()) list.push({ k: "exam", ico: ic.trophy, t: "Simulace zkoušky", c: "Začít simulaci · 30 otázek + esej", s: "30× a/b/c/d + esej — ráno, s čistou hlavou", href: "#/zkouska", done: !!dt.exam });
      list.push({ k: "weak", ico: ic.target, t: "Slabá místa", c: "Procvičit slabá místa · 20 otázek", s: "Jen to, co ti ještě nejde", href: "#/kviz?weak=1&n=20&m=weak", done: !!dt.weak });
      list.push({ k: "tahak", ico: ic.book, t: "Tahák: projeď celý kurz", c: "Otevřít tahák · 12 přednášek", s: "Velký obraz, vzorce a seznamy všech 12 přednášek", href: "#/tahak", done: !!dt.tahak });
    }
  } else if (p.type === "weak") {
    list.push({ k: "weak", ico: ic.target, t: "Slabá místa", c: "Procvičit slabá místa · 20 otázek", s: "Otázky a kartičky, kde chybuješ", href: "#/kviz?weak=1&n=20&m=weak", done: !!dt.weak });
    list.push({ k: "lists", ico: ic.list, t: "Vyjmenuj to", c: "Vyjmenovat 3 seznamy", s: "3 seznamy, které se na zkoušce vyjmenovávají", href: "#/seznamy?pick=1", done: (dt.lists || 0) >= 3 });
  } else if (p.type === "exam") {
    list.push({ k: "exam", ico: ic.trophy, t: "Simulace zkoušky", c: "Začít simulaci · 30 otázek + esej", s: "30× a/b/c/d + esej, na čas", href: "#/zkouska", done: !!dt.exam });
    list.push({ k: "essay", ico: ic.pen, t: "Druhá esej", c: "Psát esej · 15 min", s: "Jiné téma než v simulaci", href: "#/esej", done: (dt.essay || 0) >= 2 });
  }
  return list;
}


/* ---------- čtení nahlas (lekce, kartičky, otázky, odpovědi Penny) ---------- */
const TTS = { voice: null, unlocked: false, now: "" };
const hasSS = () => "speechSynthesis" in window;
const hasTTS = () => hasSS() || "Audio" in window;
function ttsVoice() {
  if (TTS.voice || !hasSS()) return TTS.voice;
  const vs = speechSynthesis.getVoices().filter(v => /^cs/i.test(v.lang));
  TTS.voice = vs.find(v => /premium|enhanced|vylepš/i.test(v.name)) || vs.find(v => /Zuzana|Iveta|Vlasta/i.test(v.name)) || vs[0] || null;
  return TTS.voice;
}
if (hasSS()) speechSynthesis.onvoiceschanged = () => { TTS.voice = null; ttsVoice(); };
function speakable(t) {
  return String(t || "")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1 lomeno $2").replace(/\\(bar|overline|text|mathrm|mathit|textbf)\{([^}]*)\}/g, "$2")
    .replace(/\\pi/g, "pí").replace(/\\Delta/g, "změna ").replace(/\\rho/g, "ró").replace(/\\alpha/g, "alfa").replace(/\\beta/g, "beta").replace(/\\cdot|\\times/g, " krát ")
    .replace(/\\(uparrow)/g, " roste ").replace(/\\(downarrow)/g, " klesá ").replace(/\\(Rightarrow|rightarrow|to)/g, " vede k ").replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[$]/g, "").replace(/\^/g, " na ").replace(/_\{?([^}\s]*)\}?/g, " $1").replace(/[{}]/g, "")
    .replace(/↑/g, " roste ").replace(/↓/g, " klesá ").replace(/[→⇒]/g, " vede k ").replace(/=/g, " rovná se ").replace(/\+/g, " plus ").replace(/ − | - /g, " mínus ")
    .replace(/\*\*|__|`|#+ |^> ?/gm, "").replace(/\|/g, ", ").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/[ \t]+/g, " ").trim();
}
/* Čtení nahlas hlasem Penny (ElevenLabs přes Supabase funkci penny-tts); když není k dispozici, čte prohlížeč */
const PV = { ok: true, gen: 0, a: null, ctl: null, cache: new Map() };
function silentWav() {
  const n = 800, b = new DataView(new ArrayBuffer(44 + n)); const w = (o, t) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); b.setUint32(4, 36 + n, true); w(8, "WAVEfmt "); b.setUint32(16, 16, true); b.setUint16(20, 1, true); b.setUint16(22, 1, true);
  b.setUint32(24, 8000, true); b.setUint32(28, 8000, true); b.setUint16(32, 1, true); b.setUint16(34, 8, true); w(36, "data"); b.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}
const pvAudio = () => PV.a || (PV.a = Object.assign(new Audio(), { preload: "auto" }));
function splitText(t, max) {
  const out = []; let cur = "";
  for (const s of t.split(/(?<=[.!?:;\n])\s+/)) { if ((cur + " " + s).length > max && cur) { out.push(cur); cur = s; } else cur = cur ? cur + " " + s : s; }
  if (cur) out.push(cur); return out;
}
async function pvFetch(t, signal) {
  if (PV.cache.has(t)) return PV.cache.get(t);
  const r = await fetch(SB_URL + "/functions/v1/penny-tts", { method: "POST", headers: { "content-type": "application/json", apikey: SB_KEY }, body: JSON.stringify({ pin: SYNC.pin(), text: t }), signal });
  if (r.status === 503 || r.status === 401) { PV.ok = false; throw new Error("off"); }
  if (!r.ok) throw new Error("tts " + r.status);
  const u = URL.createObjectURL(await r.blob()); PV.cache.set(t, u); return u;
}
function browserSpeak(t) {
  if (!hasSS()) return; speechSynthesis.cancel();
  for (const c of splitText(t, 220)) { const u = new SpeechSynthesisUtterance(c); u.lang = "cs-CZ"; const v = ttsVoice(); if (v) u.voice = v; u.rate = 1.02; speechSynthesis.speak(u); }
}
async function speak(text) {
  stopSpeak(); const g = PV.gen;
  const t = speakable(text); if (!t) return;
  if (!PV.ok || !SYNC.pin() || !navigator.onLine) return browserSpeak(t);
  const parts = splitText(t, 1200); const ctl = PV.ctl = new AbortController();
  try {
    let next = pvFetch(parts[0], ctl.signal);
    for (let i = 0; i < parts.length; i++) {
      const url = await next; if (g !== PV.gen) return;
      if (i + 1 < parts.length) next = pvFetch(parts[i + 1], ctl.signal);
      const a = pvAudio(); a.src = url;
      await new Promise((res, rej) => { a.onended = res; a.onerror = rej; PV.stopCur = res; a.play().catch(rej); });
      if (g !== PV.gen) return;
    }
  } catch (e) { if (g === PV.gen && !ctl.signal.aborted) browserSpeak(parts.join(" ")); }
}
function stopSpeak() { PV.gen++; PV.ctl?.abort(); if (PV.a) { PV.a.pause(); PV.stopCur?.(); } if (hasSS()) speechSynthesis.cancel(); }
function readNow(text) { TTS.now = text; if (S.readAloud) speak(text); }
function readBtn() { return hasTTS() ? `<button class="read-toggle ${S.readAloud ? "on" : ""}" data-read aria-pressed="${!!S.readAloud}" aria-label="Číst nahlas">${ic.sound}<span>${S.readAloud ? "Čte nahlas" : "Číst nahlas"}</span></button>` : ""; }
document.addEventListener("click", e => {
  if (!TTS.unlocked) { TTS.unlocked = true; if (hasSS()) { const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); } try { const a = pvAudio(); a.src = silentWav(); a.play().catch(() => {}); } catch (err) {} }
  const b = e.target.closest("[data-read]");
  if (b) {
    S.readAloud = !S.readAloud; save();
    $$("[data-read]").forEach(x => { x.classList.toggle("on", !!S.readAloud); x.setAttribute("aria-pressed", !!S.readAloud); const sp = x.querySelector("span"); if (sp) sp.textContent = S.readAloud ? "Čte nahlas" : "Číst nahlas"; });
    if (S.readAloud) { if (TTS.now) speak(TTS.now); else toast("Penny ti teď bude všechno číst nahlas"); } else stopSpeak();
  }
  const sb = e.target.closest("[data-speak-sec]"); if (sb) { const sec = SEC[sb.dataset.speakSec]; if (sec) speak(sectionText(sec)); }
}, true);
const sectionText = s => `${s.title}. ${s.body}${s.analogy ? ". Představ si to takhle: " + s.analogy : ""}`;

/* =================================================================== */
/* ILUSTRACE: symboly přednášek, učitelé jednotek, truhla, jiskřičky     */
/* =================================================================== */
const LI_ = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const LEC_ICON = {
  "1A": LI_('<path d="M3 9.5L12 4l9 5.5"/><path d="M4 20h16M6 10v8M10 10v8M14 10v8M18 10v8"/>'),                     // budova banky
  "1B": LI_('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.6" fill="currentColor"/>'),           // cenovka
  "2A": LI_('<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/><path d="M5 10v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/><path d="M5 14v4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4"/>'), // mince
  "2B": LI_('<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>'), // bankovka
  "3A": LI_('<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.2" fill="currentColor"/><circle cx="15" cy="12" r="2.2" fill="currentColor"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/>'), // ovladače
  "3B": LI_('<circle cx="11" cy="13" r="8"/><circle cx="11" cy="13" r="4"/><path d="M11 13L21 3M16 3h5v5"/>'),     // terč se šipkou
  "4A": LI_('<path d="M3 20l6-6 4 3 8-10"/><path d="M15 7h6v6"/>'),                                                 // rostoucí ceny
  "4B": LI_('<path d="M3 8a2 2 0 0 1 2-2h13v4"/><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M16 14h2"/>'), // peněženka
  "5A": LI_('<path d="M4 3v17h17"/><path d="M7 5c2 7 6 11 13 12"/>'),                                               // klesající IS
  "5B": LI_('<path d="M4 3v17h17"/><path d="M7 17L19 6"/><path d="M7 6c3 6 7 9 12 10"/>'),                         // MP × AD
  "6A": LI_('<path d="M4 3v17h17"/><path d="M7 6l12 12M7 18L19 6"/><circle cx="13" cy="12" r="1.6" fill="currentColor"/>'), // AS × AD
  "6B": LI_('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'), // žárovka
};
const NODE_ICO = {
  check: LI_('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3.4"/>'),
  quiz: LI_('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>'),
  book: LI_('<path d="M3 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3z"/><path d="M21 5h-6a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h7z"/>'),
};
const SPARK = `<svg class="spark" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0c.8 5.2 4 8.6 10 10-6 1.4-9.2 4.8-10 10-.8-5.2-4-8.6-10-10 6-1.4 9.2-4.8 10-10z" fill="#fff"/></svg>`;

/* Učitelé jednotek — každá jednotka má svou postavičku (lepší zapamatování) */
const TEACHERS = [
  { n: "Medvědice Bára", kind: "bear", c: "#c07a45", c2: "#f6dcc0", acc: "bowler", prop: "coin", hi: "Ahoj! Já hlídám centrální banky a ceny." },
  { n: "Lišák Emil", kind: "fox", c: "#ff8a3d", c2: "#fff1e2", acc: "glasses", prop: "note", hi: "Čau! Ukážu ti, odkud se berou peníze." },
  { n: "Kocour Repo", kind: "cat", c: "#7f8ea8", c2: "#eef2f8", acc: "tie", prop: "pointer", hi: "Zdravím! Nástroje ČNB mám v malíčku." },
  { n: "Prasátko Infla", kind: "pig", c: "#ff9cb4", c2: "#ffe4eb", acc: "scarf", prop: "balloon", hi: "Ahoj! Proč všechno zdražuje? To ti povím." },
  { n: "Žabka Křivka", kind: "frog", c: "#5bc236", c2: "#e4ffd2", acc: "bow", prop: "chart", hi: "Kvák! Křivky IS, MP a AD jsou moje parketa." },
  { n: "Panda Rovnováha", kind: "panda", c: "#ffffff", c2: "#f1f1f1", acc: "grad", prop: "scale", hi: "Ahoj! Spolu najdeme rovnováhu v AS–AD." },
];
const unitIdx = lec => Math.max(0, C.units.findIndex(u => u.ids.includes(lec)));
let TEACHER_ID = 0;
function teacher(i, cls = "", scene = false) {
  const t = TEACHERS[i % TEACHERS.length]; const K = t.kind, c = t.c, c2 = t.c2, ink = "#2b2b2b";
  const dark = K === "panda" ? ink : shade(c, -28);
  let ears = "", face = "", top = "";
  if (K === "bear") ears = `<circle cx="30" cy="44" r="13" fill="${c}"/><circle cx="90" cy="44" r="13" fill="${c}"/><circle cx="30" cy="44" r="6.5" fill="${c2}"/><circle cx="90" cy="44" r="6.5" fill="${c2}"/>`;
  if (K === "panda") ears = `<circle cx="30" cy="44" r="13" fill="${ink}"/><circle cx="90" cy="44" r="13" fill="${ink}"/>`;
  if (K === "fox") ears = `<path d="M24 58L28 20 54 44z" fill="${c}"/><path d="M96 58L92 20 66 44z" fill="${c}"/><path d="M31 50l2-20 13 13z" fill="${c2}"/><path d="M89 50l-2-20-13 13z" fill="${c2}"/>`;
  if (K === "cat") ears = `<path d="M26 56L30 26 52 44z" fill="${c}"/><path d="M94 56L90 26 68 44z" fill="${c}"/><path d="M33 50l1.5-15 10 9z" fill="#ffb3c6"/><path d="M87 50l-1.5-15-10 9z" fill="#ffb3c6"/>`;
  if (K === "pig") ears = `<ellipse cx="32" cy="42" rx="13" ry="9" fill="${dark}" transform="rotate(-38 32 42)"/><ellipse cx="88" cy="42" rx="13" ry="9" fill="${dark}" transform="rotate(38 88 42)"/>`;
  if (K === "frog") ears = `<circle cx="42" cy="42" r="15" fill="${c}"/><circle cx="78" cy="42" r="15" fill="${c}"/>`;
  const ey = K === "frog" ? 40 : 70;
  const eyes = K === "frog"
    ? `<circle cx="42" cy="40" r="9" fill="#fff"/><circle cx="78" cy="40" r="9" fill="#fff"/><circle class="pup" cx="43" cy="42" r="5" fill="${ink}"/><circle class="pup" cx="79" cy="42" r="5" fill="${ink}"/><circle cx="45" cy="39" r="1.8" fill="#fff"/><circle cx="81" cy="39" r="1.8" fill="#fff"/>`
    : `${K === "panda" ? `<ellipse cx="45" cy="71" rx="13" ry="11" fill="${ink}" transform="rotate(-18 45 71)"/><ellipse cx="75" cy="71" rx="13" ry="11" fill="${ink}" transform="rotate(18 75 71)"/>` : ""}
       <g><ellipse cx="46" cy="${ey}" rx="8.5" ry="9.5" fill="#fff"/><ellipse cx="74" cy="${ey}" rx="8.5" ry="9.5" fill="#fff"/>
       <circle cx="47" cy="${ey + 2}" r="5" fill="${ink}"/><circle cx="75" cy="${ey + 2}" r="5" fill="${ink}"/><circle cx="49" cy="${ey - .5}" r="1.8" fill="#fff"/><circle cx="77" cy="${ey - .5}" r="1.8" fill="#fff"/></g>`;
  if (K === "bear" || K === "panda") face = `<ellipse cx="60" cy="88" rx="13" ry="9" fill="${K === "panda" ? "#fff" : c2}"/><ellipse cx="60" cy="84" rx="5" ry="3.5" fill="${ink}"/><path d="M54 90q6 5 12 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (K === "fox") face = `<path d="M44 82q16 16 32 0q-4 14-16 14t-16-14z" fill="${c2}"/><ellipse cx="60" cy="85" rx="4.5" ry="3.2" fill="${ink}"/><path d="M55 91q5 4 10 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (K === "cat") face = `<path d="M57 83h6l-3 3.5z" fill="#ff7a9c"/><path d="M55 89q5 4 10 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/><g stroke="${ink}" stroke-width="1.6" opacity=".5" stroke-linecap="round"><path d="M40 84l-12-2M40 88l-12 2M80 84l12-2M80 88l12 2"/></g>`;
  if (K === "pig") face = `<ellipse cx="60" cy="87" rx="12" ry="8.5" fill="${dark}"/><ellipse cx="56" cy="87" rx="2.4" ry="3.2" fill="#b4566f"/><ellipse cx="64" cy="87" rx="2.4" ry="3.2" fill="#b4566f"/><path d="M54 98q6 4 12 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (K === "frog") face = `<path d="M40 70q20 16 40 0" stroke="${shade(c, -45)}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const cheeks = K === "frog" ? `<circle cx="34" cy="66" r="5" fill="#ff8fa8" opacity=".5"/><circle cx="86" cy="66" r="5" fill="#ff8fa8" opacity=".5"/>` : `<circle cx="34" cy="84" r="5.5" fill="#ff8fa8" opacity=".45"/><circle cx="86" cy="84" r="5.5" fill="#ff8fa8" opacity=".45"/>`;
  if (t.acc === "bowler") top = `<path d="M40 38q0-18 20-18t20 18z" fill="#3b3b3b"/><ellipse cx="60" cy="38" rx="27" ry="5.5" fill="#2b2b2b"/><rect x="40" y="31" width="40" height="4" fill="#c0392b"/>`;
  if (t.acc === "grad") top = `<g transform="rotate(-8 60 30)"><path d="M28 30l32-13 32 13-32 12z" fill="#3c3c3c"/><path d="M42 35v9q18 8 36 0v-9l-18 7z" fill="#2b2b2b"/><path d="M92 30v16" stroke="#ffc800" stroke-width="2.4"/><circle cx="92" cy="48" r="3.4" fill="#ffc800"/></g>`;
  if (t.acc === "bow") top = `<path d="M60 26l-12-7v14zM60 26l12-7v14z" fill="#ff4b4b"/><circle cx="60" cy="26" r="3.4" fill="#ea2b2b"/>`;
  let neck = "";
  if (t.acc === "glasses") face += `<g fill="none" stroke="${ink}" stroke-width="2.6"><circle cx="46" cy="70" r="11"/><circle cx="74" cy="70" r="11"/><path d="M57 70h6"/></g>`;
  if (t.acc === "tie") neck = `<path d="M54 104h12l-3 4 4 14-7 6-7-6 4-14z" fill="#ff4b4b"/>`;
  if (t.acc === "scarf") neck = `<path d="M30 102q30 12 60 0l-2 9q-28 10-56 0z" fill="#1cb0f6"/><path d="M76 108l6 16-9 1-3-14z" fill="#1899d6"/>`;
  const P = {
    coin: `<g transform="translate(96 96)"><circle r="12" fill="#ffc800" stroke="#e5a400" stroke-width="3"/><text y="5" text-anchor="middle" font-size="13" font-weight="900" fill="#b07800" font-family="Nunito,sans-serif">Kč</text></g>`,
    note: `<g transform="translate(84 92) rotate(-14)"><rect width="30" height="18" rx="3" fill="#58cc02" stroke="#46a302" stroke-width="2.4"/><circle cx="15" cy="9" r="4.5" fill="#d7ffb8"/></g>`,
    pointer: `<path d="M96 104L116 74" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/><circle cx="116" cy="74" r="3.5" fill="#ff4b4b"/>`,
    balloon: `<path d="M102 100q4-14 2-30" stroke="#777" stroke-width="1.6" fill="none"/><ellipse cx="106" cy="58" rx="11" ry="13" fill="#ff4b4b"/><path d="M106 52v10M102 56l4-4 4 4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    chart: `<g transform="translate(86 86) rotate(8)"><rect width="30" height="26" rx="4" fill="#fff" stroke="#1cb0f6" stroke-width="2.6"/><path d="M5 6c3 8 9 13 20 15" stroke="#ff4b4b" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`,
    scale: `<g transform="translate(100 82)"><path d="M0 0v22M-12 4h24" stroke="#777" stroke-width="2.6" stroke-linecap="round"/><path d="M-16 14q4 6 8 0zM8 14q4 6 8 0z" fill="#ffc800" stroke="#e5a400" stroke-width="1.6"/><path d="M-12 4l-4 10M-12 4l4 10M12 4l-4 10M12 4l4 10" stroke="#999" stroke-width="1"/></g>`,
  }[t.prop] || "";
  const SC = scene ? SCENES_FN[i % SCENES_FN.length]() : "";
  const lidC = K === "panda" ? ink : c, ly = K === "frog" ? 40 : ey, lx = K === "frog" ? [42, 78] : [46, 74], bd = (4.4 + i * .37).toFixed(2);
  // mrkání: víčko sjede shora dolů přes oko (oříznuté tvarem oka) a zase vyjede
  const er = K === "frog" ? [9, 9] : [8.5, 9.5], bt = (4.6 + i * .43).toFixed(2), uid = "e" + (++TEACHER_ID);
  const lids = lx.map((x, n) => { const top = ly - er[1] - 2.2, bot = ly + er[1] + 2.2, meet = ly + er[1] * .3;
    const kt = 'keyTimes="0;.9;.93;.95;.98;1"', D = `dur="${bt}s" repeatCount="indefinite"`;
    const mv = d => `<animateTransform attributeName="transform" type="translate" ${D} ${kt} values="0 0;0 0;0 ${d.toFixed(1)};0 ${d.toFixed(1)};0 0;0 0"/>`;
    return `<clipPath id="${uid}${n}"><ellipse cx="${x}" cy="${ly}" rx="${er[0] + .6}" ry="${er[1] + .6}"/></clipPath>
    <g clip-path="url(#${uid}${n})">
      <g>${mv(meet - bot)}<rect x="${x - 12}" y="${bot}" width="24" height="26" fill="${lidC}"/></g>
      <g>${mv(meet - top)}<rect x="${x - 12}" y="${top - 26}" width="24" height="26.4" fill="${lidC}"/><path d="M${x - 10.5} ${top}q10.5 4.5 21 0" stroke="${K === "panda" ? "#000" : shade(lidC, -55)}" stroke-width="2.8" fill="none" stroke-linecap="round"/></g></g>`; }).join("");
  const bob = scene ? `<animateTransform attributeName="transform" type="translate" dur="3.2s" repeatCount="indefinite" keyTimes="0;.5;1" values="0 0;0 -4;0 0"/>` : "";
  return `<svg class="teacher ${cls} ${scene ? "scene sc" + i : ""}" viewBox="${scene ? "0 0 196 134" : "0 0 124 134"}" aria-label="${esc(t.n)}" role="img">
<ellipse class="tsh" cx="62" cy="128" rx="34" ry="5.5" fill="#000" opacity=".12"/>
<g class="tj">${scene ? BODYMOVE[i % BODYMOVE.length] : ""}<g class="${scene ? "tbs" : "tb"}">${bob}${ears}
<ellipse cx="60" cy="80" rx="42" ry="44" fill="${c}" ${K === "panda" ? `stroke="#e5e5e5" stroke-width="2"` : ""}/>
<ellipse cx="60" cy="100" rx="26" ry="20" fill="${c2}"/>
<ellipse cx="22" cy="98" rx="8" ry="12" fill="${K === "panda" ? ink : c}" transform="rotate(20 22 98)"/>
<ellipse cx="98" cy="98" rx="8" ry="12" fill="${K === "panda" ? ink : c}" transform="rotate(-20 98 98)"/>
<ellipse cx="44" cy="122" rx="11" ry="6" fill="${K === "panda" ? ink : dark}"/><ellipse cx="76" cy="122" rx="11" ry="6" fill="${K === "panda" ? ink : dark}"/>
${neck}${eyes}${lids}${cheeks}${face}${top}${scene ? "" : P}</g></g>${SC}</svg>`;
}

/* Scénky učitelů: klid → akce → zase klid (SMIL animace — fungují stejně v Safari i Chrome) */
const kf = (dur, fr) => `dur="${dur}s" repeatCount="indefinite" keyTimes="${fr.map(f => Math.min(1, Math.max(0, f[0] / dur)).toFixed(4)).join(";")}" values="${fr.map(f => f[1]).join(";")}"`;
const aT = (type, dur, fr) => `<animateTransform attributeName="transform" type="${type}" ${kf(dur, fr)}/>`;
const aA = (attr, dur, fr) => `<animate attributeName="${attr}" ${kf(dur, fr)}/>`;
const hold = (d, v) => [[0, v], [d, v]];
function flight(dur, t, from, mid, to, fadeAt) {
  const tr = aT("translate", dur, [[0, from], [t, from], [t + .35, mid], [t + 1.1, to], [dur, to]]);
  const op = aA("opacity", dur, [[0, 0], [t, 0], [t + .01, 1], [fadeAt ?? t + 1.05, 1], [(fadeAt ?? t + 1.05) + .15, 0], [dur, 0]]);
  return tr + op;
}
const BILLSHAPE = `<rect x="-10" y="-5.5" width="20" height="11" rx="2" fill="#7ed957" stroke="#46a302" stroke-width="1.6"/><circle r="2.6" fill="#46a302"/>`;
// tělo učitele: skok/naklonění během akce (na obalovou skupinu)
const BODYMOVE = [
  aT("translate", 9, [[0, "0 0"], [4.0, "0 0"], [4.15, "3 2"], [4.5, "0 0"], [5.2, "0 0"], [5.35, "0 -7"], [5.6, "0 0"], [9, "0 0"]]),
  aT("translate", 8, [[0, "0 0"], [5.0, "0 0"], [5.15, "0 -9"], [5.35, "0 0"], [8, "0 0"]]),
  aT("translate", 8, [[0, "0 0"], [4.2, "0 0"], [4.35, "0 -6"], [4.5, "0 0"], [6.2, "0 0"], [6.35, "0 -4"], [6.5, "0 0"], [8, "0 0"]]),
  aT("translate", 8, [[0, "0 0"], [5.0, "0 0"], [5.15, "0 -14"], [5.4, "0 0"], [5.55, "0 -5"], [5.7, "0 0"], [8, "0 0"]]),
  aT("translate", 8, [[0, "0 0"], [5.5, "0 0"], [5.7, "0 -10"], [5.9, "0 0"], [6.05, "0 -6"], [6.2, "0 0"], [8, "0 0"]]),
  aT("translate", 9, [[0, "0 0"], [5.9, "0 0"], [6.05, "0 -5"], [6.2, "0 0"], [6.35, "0 -5"], [6.5, "0 0"], [9, "0 0"]]),
];
function sceneGun() { // Bára: střílí peníze → zasekne se → zatřese → hodí o zem → vyskočí zpátky → funguje
  const D = 9, shots = [0, .6, 1.2, 1.8, 2.4, 6, 6.6, 7.2, 7.8];
  const rot = [[0, -6]]; for (const t of shots.filter(s => s < 3)) rot.push([t, -6], [t + .08, -20], [t + .3, -6]);
  for (let k = 0; k < 9; k++) rot.push([3 + k * .1, k % 2 ? 8 : -14]);
  rot.push([3.9, -6], [4.3, 110], [4.6, 95], [4.9, -40], [5.2, 4], [5.4, -6]);
  for (const t of shots.filter(s => s >= 6)) rot.push([t, -6], [t + .08, -20], [t + .3, -6]);
  rot.push([9, -6]);
  const gunRot = aT("rotate", D, rot.map(([t, a]) => [t, `${a} 104 96`]));
  const gunMove = aT("translate", D, [[0, "0 0"], [3.9, "0 0"], [4.3, "20 26"], [4.6, "24 26"], [4.9, "8 -26"], [5.2, "0 3"], [5.4, "0 0"], [9, "0 0"]]);
  const bills = shots.map(t => `<g>${flight(D, t, "140 92", "166 58", "184 126")}${BILLSHAPE}</g>`).join("");
  const smoke = `<circle cx="140" cy="86" r="0" fill="#c7c7c7">${aA("r", D, [[0, 0], [3.1, 0], [3.5, 9], [3.9, 0], [9, 0]])}${aA("opacity", D, [[0, 0], [3.1, .9], [3.9, 0], [9, 0]])}</circle>`;
  const q = `<text x="64" y="16" font-size="22" font-weight="900" fill="#ffc800" font-family="Nunito,sans-serif" text-anchor="middle" opacity="0">?${aA("opacity", D, [[0, 0], [3.1, 0], [3.2, 1], [3.9, 1], [4.0, 0], [9, 0]])}</text>`;
  return `<g>${gunMove}<g>${gunRot}<rect x="94" y="86" width="36" height="14" rx="4" fill="#58cc02"/><rect x="126" y="88" width="11" height="10" rx="2" fill="#46a302"/><rect x="99" y="97" width="10" height="15" rx="3" fill="#46a302"/><circle cx="113" cy="93" r="4" fill="#ffc800"/></g></g>${bills}${smoke}${q}`;
}
function scenePress() { // Emil: tiskne peníze → zasekne se a kouří → bouchne do ní → vyletí dvě bankovky
  const D = 8, prints = [.4, 1.4, 2.4, 3.4, 5.6, 6.1, 7.0];
  const lev = [[0, -20]]; for (const t of [0, 1, 2, 3, 5.4, 6.4]) lev.push([t, -20], [t + .5, 22], [t + 1, -20]); lev.push([D, -20]);
  const lever = `<g>${aT("rotate", D, lev.map(([t, a]) => [t, `${a} 130 81`]))}<path d="M130 81V60" stroke="#4b4b4b" stroke-width="4" stroke-linecap="round"/><circle cx="130" cy="58" r="6" fill="#ff4b4b"/></g>`;
  const shake = []; shake.push([0, "0 0"], [4.0, "0 0"]); for (let k = 0; k < 9; k++) shake.push([4.05 + k * .1, k % 2 ? "2 0" : "-2 0"]); shake.push([4.95, "0 0"], [5.15, "0 4"], [5.35, "0 0"], [D, "0 0"]);
  const notes = prints.map(t => `<g>${flight(D, t, "150 106", "164 104", "170 120")}${BILLSHAPE}</g>`).join("");
  const smoke = `<circle cx="128" cy="76" r="0" fill="#c7c7c7">${aA("r", D, [[0, 0], [4.1, 0], [4.6, 10], [5.0, 0], [D, 0]])}${aA("opacity", D, [[0, 0], [4.1, .9], [5.0, 0], [D, 0]])}</circle>`;
  const star = `<path d="M118 70l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#ffc800" opacity="0">${aA("opacity", D, [[0, 0], [5.1, 0], [5.15, 1], [5.6, 1], [5.7, 0], [D, 0]])}</path>`;
  return `<g>${aT("translate", D, shake)}<rect x="106" y="80" width="48" height="38" rx="7" fill="#8a9ba3"/><rect x="106" y="80" width="48" height="11" rx="6" fill="#6b7c85"/><rect x="152" y="98" width="5" height="12" rx="2" fill="#4b5a62"/><circle cx="118" cy="104" r="4" fill="#ffc800"/><circle cx="130" cy="104" r="4" fill="#ff4b4b"/>${lever}</g>
    <rect x="160" y="120" width="24" height="4" rx="1" fill="#7ed957" stroke="#46a302"/>${notes}${smoke}${star}`;
}
function scenePanel() { // Repo: klidně ladí sazby → zatáhne za páku → všechno vystřelí nahoru, bliká alarm → vrátí to
  const D = 8;
  const bar = (x, c, ph) => { const fr = [[0, 10 + ph], [1, 14 - ph], [2, 9 + ph], [3, 13], [4.2, 10], [4.6, 22], [6, 22], [6.5, 11], [7.3, 12 + ph], [D, 10 + ph]];
    return `<rect x="${x}" width="8" rx="2" fill="${c}">${aA("height", D, fr)}${aA("y", D, fr.map(([t, h]) => [t, 96 - h]))}</rect>`; };
  const lever = `<g>${aT("rotate", D, [[0, "-20 150 112"], [4.0, "-20 150 112"], [4.4, "40 150 112"], [6.0, "40 150 112"], [6.5, "-20 150 112"], [D, "-20 150 112"]])}<path d="M150 112V96" stroke="#afafaf" stroke-width="4" stroke-linecap="round"/><circle cx="150" cy="94" r="5.5" fill="#ff4b4b"/></g>`;
  const led = `<circle cx="160" cy="110" r="3.4" fill="#58cc02">${aA("fill", D, [[0, "#58cc02"], [4.6, "#58cc02"], [4.61, "#ff4b4b"], [4.9, "#ffc800"], [5.2, "#ff4b4b"], [5.5, "#ffc800"], [5.8, "#ff4b4b"], [6.1, "#58cc02"], [D, "#58cc02"]])}</circle>`;
  const knob = `<g>${aT("rotate", D, [[0, "-50 122 109"], [4, "50 122 109"], [D, "-50 122 109"]])}<circle cx="122" cy="109" r="7" fill="#ffc800"/><path d="M122 109v-6" stroke="#4b4b4b" stroke-width="2.5" stroke-linecap="round"/></g>`;
  return `<rect x="104" y="66" width="62" height="54" rx="8" fill="#4b4b4b"/><rect x="110" y="72" width="50" height="26" rx="4" fill="#10303f"/>${bar(116, "#1cb0f6", 2)}${bar(128, "#58cc02", -2)}${bar(140, "#ffc800", 1)}${knob}${lever}${led}`;
}
function sceneBalloon() { // Infla: pumpuje → balónek roste → PRÁSK → vyskočí leknutím → nový balónek
  const D = 8;
  const pump = []; pump.push([0, "0 0"]); for (let t = 0; t < 4.8; t += .5) pump.push([t, "0 0"], [t + .25, "0 10"]); pump.push([4.8, "0 0"], [D, "0 0"]);
  const scale = aT("scale", D, [[0, .3], [4.8, 1.12], [5.0, 1.45], [5.01, .3], [D, .3]]);
  const op = aA("opacity", D, [[0, 1], [5.0, 1], [5.01, 0], [6.4, 0], [6.6, 1], [D, 1]]);
  const burst = `<g stroke="#ffc800" stroke-width="3" stroke-linecap="round" opacity="0">${aA("opacity", D, [[0, 0], [5.0, 0], [5.01, 1], [5.4, 1], [5.6, 0], [D, 0]])}<path d="M154 36v-8M134 48l-6-5M174 48l6-5M132 72h-8M176 72h8"/></g>`;
  return `<path d="M126 116q20 6 26-30" stroke="#4b4b4b" stroke-width="3" fill="none"/>
   <rect x="112" y="94" width="16" height="26" rx="4" fill="#1cb0f6"/><rect x="108" y="118" width="24" height="5" rx="2" fill="#1899d6"/>
   <g>${aT("translate", D, pump)}<rect x="118" y="78" width="4" height="18" fill="#777"/><rect x="106" y="74" width="28" height="6" rx="3" fill="#4b4b4b"/></g>
   <g transform="translate(154 86)"><g>${scale}${op}<g transform="translate(-154 -86)"><ellipse cx="154" cy="66" rx="15" ry="18" fill="#ff4b4b"/><ellipse cx="148" cy="59" rx="4" ry="6" fill="#fff" opacity=".45"/><path d="M151 84h6l-3 4z" fill="#ea2b2b"/></g></g></g>${burst}`;
}
function sceneBoard() { // Křivka: nakreslí IS, pak MP → radost → smaže tabuli
  const D = 8;
  const draw = (d, c, t0, t1) => `<path d="${d}" stroke="${c}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-dasharray="64" stroke-dashoffset="64">${aA("stroke-dashoffset", D, [[0, 64], [t0, 64], [t1, 0], [7.6, 0], [7.61, 64], [D, 64]])}${aA("opacity", D, [[0, 1], [t0, 1], [6.1, 1], [7.5, 0], [7.7, 0], [7.71, 1], [D, 1]])}</path>`;
  const marker = `<g>${aT("translate", D, [[0, "100 98"], [0.5, "114 52"], [1.1, "120 68"], [1.8, "132 80"], [2.5, "156 88"], [2.9, "114 86"], [3.6, "128 78"], [4.3, "142 66"], [5.0, "154 52"], [5.5, "100 98"], [6.4, "100 98"], [6.6, "120 70"], [6.8, "150 70"], [7.0, "122 80"], [7.2, "150 80"], [7.5, "100 98"], [D, "100 98"]])}<rect x="-3" y="-16" width="7" height="16" rx="2" fill="#ffc800" transform="rotate(28)"/><rect x="-3" y="-3" width="7" height="4" fill="#4b4b4b" transform="rotate(28)"/></g>`;
  return `<path d="M112 98l-6 26M156 98l6 26" stroke="#8a5a2b" stroke-width="3.5" stroke-linecap="round"/>
   <rect x="100" y="40" width="68" height="60" rx="5" fill="#fff" stroke="#c7c7c7" stroke-width="3"/>
   <path d="M108 48v44h54" stroke="#4b4b4b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
   ${draw("M114 52c6 20 18 32 42 36", "#ff4b4b", .5, 2.5)}${draw("M114 86c14-6 28-18 40-34", "#1cb0f6", 2.9, 5.0)}${marker}`;
}
function sceneStack() { // Rovnováha: skládá míčky na sebe → věž se kývá → všechno spadne → pokrčí rameny → znovu
  const D = 9; const spots = [[150, 85, "#ff4b4b", 1, "14 39"], [150, 71, "#1cb0f6", 2.2, "26 53"], [150, 57, "#ffc800", 3.4, "36 67"]];
  const balls = spots.map(([x, y, c, t, fall], k) => { const off = `${104 - x} ${96 - y}`, mid = `${(104 - x) / 2} ${(96 - y) / 2 - 24}`;
    return `<g>${aT("translate", D, [[0, off], [t, off], [t + .3, mid], [t + .6, "0 0"], [5.0, "0 0"], [5.6 + k * .1, fall], [D, fall]])}${aA("opacity", D, [[0, 0], [t, 0], [t + .01, 1], [7.6, 1], [8.2, 0], [D, 0]])}<circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x - 2}" cy="${y - 2.5}" r="2" fill="#fff" opacity=".6"/></g>`; }).join("");
  const wob = aT("rotate", D, [[0, "0 150 92"], [4.1, "0 150 92"], [4.35, "6 150 92"], [4.6, "-8 150 92"], [4.85, "11 150 92"], [5.0, "0 150 92"], [D, "0 150 92"]]);
  return `<path d="M150 122V92" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/><path d="M138 124h24" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/><path d="M140 92h20" stroke="#4b4b4b" stroke-width="4" stroke-linecap="round"/>
   <g>${wob}${balls}</g>`;
}
const SCENES_FN = [sceneGun, scenePress, scenePanel, sceneBalloon, sceneBoard, sceneStack];
function pennyFlag() { // Penny v cíli drží šachovnicovou vlajku, mává; občas vyskočí a zamává naplno
  const D = 7, P = "160 146";
  const flagRot = aT("rotate", D, [[0, `-6 ${P}`], [1, `6 ${P}`], [2, `-6 ${P}`], [3, `6 ${P}`], [3.8, `-6 ${P}`], [4.1, `-28 ${P}`], [4.4, `22 ${P}`], [4.7, `-28 ${P}`], [5.0, `22 ${P}`], [5.3, `-6 ${P}`], [6.2, `6 ${P}`], [D, `-6 ${P}`]]);
  const jump = aT("translate", D, [[0, "0 0"], [3.9, "0 0"], [4.15, "0 -16"], [4.4, "0 0"], [4.65, "0 -10"], [4.9, "0 0"], [D, "0 0"]]);
  const sq = [0, 1, 2, 3, 4].flatMap(a => [0, 1, 2].map(b => (a + b) % 2 ? "" : `<rect x="${192 + a * 10}" y="${6 + b * 10}" width="10" height="10" fill="#2b2b2b"/>`)).join("");
  const body = ham("happy").replace('<svg class="ham', '<svg width="200" height="200" y="8" class="ham')
    .replace(/<circle cx="100" cy="148" r="22"[^>]*\/>/, "").replace(/<text x="100" y="155"[^<]*<\/text>/, "")
    .replace('<ellipse cx="120" cy="148" rx="10" ry="8" fill="#f6c99a"/>', "");
  return `<svg class="penny-flag" viewBox="0 -4 250 218" role="img" aria-label="Penny v cíli"><g>${jump}${body}
    <g>${flagRot}<path d="M160 152L192 4" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/><path d="M192 4q25 -6 50 2v30q-25 -8 -50 -2z" fill="#fff" stroke="#2b2b2b" stroke-width="2"/>${sq.replace(/<rect /g, '<rect clip-path="url(#pflag)" ')}
      <clipPath id="pflag"><path d="M192 4q25 -6 50 2v30q-25 -8 -50 -2z"/></clipPath>
      <ellipse cx="160" cy="146" rx="11" ry="9" fill="#f6c99a" stroke="#d98a43" stroke-width="1.5"/></g></g></svg>`;
}
function shade(hex, p) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v + 255 * p / 100))); return "#" + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }

/* ---------- router ---------- */
let SESSION = null;
function nav(h) { if (location.hash === h) render(); else location.hash = h; }
function route() {
  const h = location.hash.slice(1) || "/";
  const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
function setNav(k) { $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.k === k)); }
/* ---------- horní lišta: jen statistiky (jako Duolingo) ---------- */
/* ---------- horní lišta: série · kartičky · zkouška (klepnutím vysvětlí) ---------- */
const SV = {
  flame: `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2c3 5 9 8 9 16a9 9 0 0 1-18 0c0-4 2-7 4-9 0 3 1 5 3 6 0-5 1-9 2-13z" fill="currentColor"/><path d="M16 15c2 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-4 2-5 0 2 1 2 2 3z" fill="#ffc800"/></svg>`,
  cards: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="10" y="3" width="17" height="22" rx="4" fill="#a568cc" transform="rotate(10 18 14)"/><rect x="5" y="6" width="17" height="23" rx="4" fill="#ce82ff"/><path d="M10 15h7M10 20h4" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`,
  cal: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="6" width="24" height="23" rx="5" fill="#ff4b4b"/><rect x="4" y="12" width="24" height="17" rx="4" fill="#fff" stroke="#ff4b4b" stroke-width="2.4"/><path d="M10 3v6M22 3v6" stroke="#ea2b2b" stroke-width="3" stroke-linecap="round"/><path d="M10 19h4M18 19h4M10 24h4" stroke="#ff4b4b" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  target: `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13.5" fill="#ffc800"/><circle cx="16" cy="16" r="9" fill="#fff"/><circle cx="16" cy="16" r="4.6" fill="#ffc800"/></svg>`,
};
SV.days = SV.flame; SV.ready = SV.target;
function topbar(back = null, right = "") {
  const n = Math.max(0, daysToExam()); const due = C ? dueIds().length : 0; const st = streak(); const lit = xpToday() > 0;
  const left = back ? `<button class="back" data-back="${esc(back)}">${ic.left}<span>Zpět</span></button>` : `<a class="brand" href="#/" aria-label="Penny">${ham("happy")}</a>`;
  const stats = right || `<button class="stat-chip streak ${lit ? "lit" : ""}" data-chip="streak" aria-label="Série ${st} dní">${SV.flame}${st}</button>
    <button class="stat-chip cards" data-chip="cards" aria-label="Kartiček k opakování: ${due}">${SV.cards}${due}</button>
    <button class="stat-chip exam" data-chip="exam" aria-label="Do zkoušky ${n} dní">${SV.cal}${n}</button>`;
  return `<div class="topbar">${left}<div class="sp"></div>${stats}</div>`;
}
function chipPop(kind, btn) {
  const old = $(".chip-pop"); const same = old && old.dataset.k === kind; old?.remove(); $$(".stat-chip").forEach(b => b.classList.remove("open")); if (same) return;
  let h = "";
  if (kind === "streak") {
    const st = streak(); const lit = xpToday() > 0; const D = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
    const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
    h = `<div class="cp-head">${SV.flame}<div><b>${st} ${plural(st, "den", "dny", "dní")} v řadě</b><span>${lit ? "Dnešek máš. Zítra pokračuj!" : "Dnes se ještě uč, ať série nevyhasne."}</span></div></div>
      <div class="week">${days.map(d => `<div class="wd ${S.xp[d] ? "on" : ""} ${d === today() ? "now" : ""}"><span>${D[parseD(d).getDay()]}</span><i>${S.xp[d] ? SV.flame : ""}</i></div>`).join("")}</div>`;
    const nm = missions().find(m => !m.done); if (!lit && nm) h += `<a class="btn block" href="${nm.href}">Učit se</a>`;
  } else if (kind === "cards") {
    const due = dueIds().length;
    h = `<div class="cp-head">${SV.cards}<div><b>${due ? `${due} ${plural(due, "kartička čeká", "kartičky čekají", "kartiček čeká")}` : "Vše zopakováno"}</b><span>${due ? "Opakuj, dokud je to čerstvé." : "Další kartičky dozrají později."}</span></div></div>${due ? `<a class="btn block" style="--c:var(--purple);--lip:var(--purple-lip)" href="#/karty">Opakovat</a>` : ""}`;
  } else {
    const pct = Math.round(overallReady().score * 100); const d = parseD(S.examDate); const n = Math.max(0, daysToExam());
    h = `<div class="cp-head">${SV.cal}<div><b>Zkouška ${d.getDate()}. ${d.getMonth() + 1}. · za ${n} ${plural(n, "den", "dny", "dní")}</b><span>Připravenost ${pct} % · ${levelOf(pct)}</span></div></div>
      <div class="bar yellow" style="margin:4px 0 14px"><i style="width:${Math.max(3, pct)}%"></i></div><a class="btn block blue" href="#/pripravenost">Můj pokrok</a>`;
  }
  btn.classList.add("open");
  const p = document.createElement("div"); p.className = "chip-pop"; p.dataset.k = kind; p.innerHTML = h;
  btn.closest(".topbar").appendChild(p);
  const r = btn.getBoundingClientRect(), tr = btn.closest(".topbar").getBoundingClientRect();
  p.style.setProperty("--ax", (r.left + r.width / 2 - tr.left) + "px");
}
document.addEventListener("click", e => {
  const c = e.target.closest("[data-chip]"); if (c) { e.preventDefault(); chipPop(c.dataset.chip, c); return; }
  if (!e.target.closest(".chip-pop")) { $(".chip-pop")?.remove(); $$(".stat-chip.open").forEach(b => b.classList.remove("open")); }
});
document.addEventListener("click", e => {
  const b = e.target.closest("[data-back]"); if (b) { e.preventDefault(); history.length > 1 ? history.back() : nav(b.dataset.back); }
});

async function render() {
  document.querySelectorAll(".feedback,.praise,.chip-pop,.to-bottom").forEach(f => f.remove());
  closeDrawer(); stopSpeak(); TTS.now = ""; document.querySelector(".viewer")?.remove();
  const { parts, q } = route();
  const r = parts[0] || "";
  if (r !== "halir") tutorStop();
  document.getElementById("fab")?.remove();
  window.onkeydown = null;
  const map = {
    "": viewToday, mapa: viewMap, lekce: viewLecture, uc: viewLearn, karty: viewCards, kviz: viewQuiz, zkouska: viewExam,
    otazky: viewQuestions, otazka: viewFeynman, esej: viewEssays, seznamy: viewLists, priklady: viewProblems, grafy: viewGraphs,
    halir: viewTutor, plan: viewPlan, jak: viewScience, hledat: viewSearch, tahak: viewCheat, pripravenost: viewReadiness, procvic: viewPractice,
  };
  const NK = { "": "cesta", mapa: "cesta", lekce: "cesta", uc: "cesta", halir: "halir", pripravenost: "pokrok", plan: "pokrok", jak: "pokrok" };
  setNav(NK[r] || "procvic");
  const focus = ["uc", "karty", "kviz", "zkouska", "seznamy", "otazka", "priklady", "halir"].includes(r) || (r === "esej" && parts[1]);
  document.body.classList.toggle("focus", !!focus);
  document.body.classList.toggle("tutor", r === "halir");
  document.body.classList.toggle("wide", ["grafy"].includes(r) && !focus);
  document.body.classList.toggle("home-wide", r === "" || r === "mapa");
  (map[r] || viewToday)(parts, q);
  const v = view(); v.classList.remove("enter"); void v.offsetWidth; v.classList.add("enter");
  window.scrollTo(0, 0);
}

/* =================================================================== */
/* DNES                                                                 */
/* =================================================================== */
/* =================================================================== */
/* CESTA — domov jako v Duolingu                                        */
/* =================================================================== */
/* =================================================================== */
/* CESTA — domov jako v Duolingu                                        */
/* =================================================================== */
/* aktuální lekce: elektrické jiskry kolem tlačítka (jako v Duolingu) */
const ZAP = "";
const ZIG = [0, 70, 30];
function viewToday() {
  if (!S.onboarded) return viewWelcome();
  const before = beforeStart(); const day = plan()[0]; const tIds = (!before && day?.ids) || [];
  const ids = lectures().map(l => l.id);
  const cur = tIds.find(id => !lectureRead(id)) || ids.find(id => !lectureRead(id));
  const ms = missions(); const next = ms.find(m => !m.done); const doneN = ms.filter(m => m.done).length;
  let quest = "";
  if (before) {
    const st = parseD(planStart()); const d = diffDays(today(), planStart());
    quest = `<div class="quest">${SV.cal}<div class="t"><b>Start ${st.getDate()}. ${st.getMonth() + 1}. · za ${d} ${plural(d, "den", "dny", "dní")}</b><span class="small muted">Klidně začni dřív.</span></div><button class="btn sm" id="early">Začít</button></div>`;
  } else if (ms.length) {
    quest = `<a class="quest" href="${next ? next.href : "#/pripravenost"}">${SV.target}<div class="t"><b>${next ? esc(next.t) : "Dnešek hotový!"}</b><div class="bar yellow"><i style="width:${Math.max(4, doneN / ms.length * 100)}%"></i></div></div><span class="qn">${doneN}/${ms.length}</span></a>`;
  }
  const units = C.units.map((u, ui) => {
    const dir = ui % 2 ? -1 : 1; let k = 0;
    const node = (html, cls) => `<div class="pnode ${cls}" style="--dx:${ZIG[k++ % ZIG.length] * dir}px">${html}</div>`;
    const lect = u.ids.map(id => {
      const l = LEC[id]; const rd = sectionsRead(id), ns = l.sections.length; const r = Math.round(readiness(id).score * 100);
      const done = lectureRead(id), gold = done && r >= 85, isCur = id === cur;
      const cls = gold ? "gold" : done ? "done" : isCur ? "cur" : rd ? "" : "fresh";
      return node(`<span class="ring2" style="--p:${r}"></span>${isCur ? ZAP : ""}
        <button data-node="${id}" aria-label="${id} ${esc(l.title)}">${done ? NODE_ICO.check : LEC_ICON[id] || `<b>${id}</b>`}${gold ? SPARK + SPARK.replace("spark", "spark s2") : ""}</button>
        <span class="label">${esc(l.title)} <em>${id}</em></span>`, cls);
    }).join("");
    const uq = S.uq?.[ui];
    const quiz = node(`<span class="ring2" style="--p:${uq || 0}"></span><button data-node="u${ui}" aria-label="Kvíz jednotky">${uq != null ? NODE_ICO.check : NODE_ICO.quiz}${uq >= 90 ? SPARK : ""}</button><span class="label">Kvíz jednotky</span>`,
      uq >= 90 ? "gold" : uq != null ? "blue" : u.ids.some(id => sectionsRead(id)) ? "" : "fresh");
    const gb = u.ids.find(id => !lectureRead(id)) || u.ids[0];
    return `<section class="unit u${ui + 1}"><div class="unit-head"><div class="t"><span class="cap">Jednotka ${ui + 1}</span><b>${esc(u.title)}</b></div>
        <a class="gb" href="#/lekce/${gb}" aria-label="Průvodce">${NODE_ICO.book}<span>Průvodce</span></a></div>
      <div class="path">${lect}${quiz}
        <button class="tspot ${dir > 0 ? "l" : "r"}" data-teacher="${ui}" aria-label="${esc(TEACHERS[ui].n)}">${teacher(ui, "idle", true)}</button></div></section>`;
  }).join("");
  const exam = `<section class="unit final"><div class="path"><div class="pnode gold big" style="--dx:-64px"><button data-node="exam" aria-label="Zkouška nanečisto">${NODE_ICO.quiz}${SPARK}</button><span class="label">Zkouška nanečisto</span></div>
    <div class="tspot r static flag">${pennyFlag()}</div></div></section>`;
  view().innerHTML = `${topbar()}<div class="home"><div class="home-main">${quest}${units}${exam}</div>${homeRail(ms)}</div>`;
  const e = $("#early"); if (e) e.onclick = () => { S.startDate = today(); S.planFor = null; save(); confetti(); render(); };
  view().querySelectorAll("[data-node]").forEach(b => b.onclick = ev => { ev.stopPropagation(); nodePop(b); });
  view().querySelectorAll("[data-teacher]").forEach(b => b.onclick = ev => { ev.stopPropagation(); teacherSay(b); });
  const c = view().querySelector(".pnode.cur"); if (c && !before) setTimeout(() => c.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
}
function homeRail(ms) {
  const st = streak(); const pct = Math.round(overallReady().score * 100); const due = dueIds().length;
  const D = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"]; const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  return `<aside class="home-rail">
    <div class="card rail-streak"><div class="cp-head">${SV.flame}<div><b>${st} ${plural(st, "den", "dny", "dní")} v řadě</b><span>${xpToday() ? "Dnešek máš!" : "Dnes se ještě uč."}</span></div></div>
      <div class="week">${days.map(d => `<div class="wd ${S.xp[d] ? "on" : ""} ${d === today() ? "now" : ""}"><span>${D[parseD(d).getDay()]}</span><i>${S.xp[d] ? SV.flame : ""}</i></div>`).join("")}</div></div>
    ${ms.length ? `<div class="card"><h3 style="margin-bottom:10px">Dnešní úkoly</h3>${ms.map(m => `<a class="rail-m ${m.done ? "done" : ""}" href="${m.href}"><span class="ico">${m.done ? NODE_ICO.check : m.ico}</span><b>${esc(m.t)}</b></a>`).join("")}</div>` : ""}
    <a class="card rail-ready" href="#/pripravenost"><div class="ring big" style="--p:${pct};--rc:var(--yellow)"><span>${pct}%</span></div><div><b>Připravenost</b><span>${levelOf(pct)} · ${due} ${plural(due, "kartička", "kartičky", "kartiček")}</span></div></a>
    <a class="card rail-penny" href="#/halir">${ham("happy", "idle")}<div><b>Zeptej se Penny</b><span>Nahlas nebo písemně</span></div></a>
  </aside>`;
}
function teacherSay(b) {
  $$(".tsay").forEach(x => x.remove()); const t = TEACHERS[+b.dataset.teacher];
  b.insertAdjacentHTML("beforeend", `<span class="tsay"><b>${esc(t.n)}</b>${esc(t.hi)}</span>`);
  const sy = b.querySelector(".tsay"), r = sy.getBoundingClientRect(), vw = document.documentElement.clientWidth;
  if (r.right > vw - 10) sy.style.marginLeft = `${vw - 10 - r.right}px`; else if (r.left < 10) sy.style.marginLeft = `${10 - r.left}px`;
  b.querySelector(".teacher")?.classList.add("jump"); setTimeout(() => { b.querySelector(".teacher")?.classList.remove("jump"); $$(".tsay").forEach(x => x.remove()); }, 3200);
}
function nodePop(b) {
  const open = b.parentElement.querySelector(".pop"); $$(".pop").forEach(p => p.remove()); if (open) return;
  const key = b.dataset.node; let h;
  if (key === "exam") h = `<b>Zkouška nanečisto</b><p>${EXAM_MC} otázek + esej, jako ve škole</p><a class="btn block" href="#/zkouska">Start</a>`;
  else if (key[0] === "u") { const ui = +key.slice(1), u = C.units[ui], uq = S.uq?.[ui]; h = `<b>Kvíz: ${esc(u.title)}</b><p>${uq != null ? `Nejlépe ${uq} % · zkus 90 % a víc` : "12 otázek z celé jednotky"}</p><a class="btn block" href="#/kviz?u=${ui}&n=12">${uq != null ? "Znovu" : "Start"}</a>`; }
  else {
    const l = LEC[key]; const rd = sectionsRead(key), ns = l.sections.length; const r = Math.round(readiness(key).score * 100);
    h = lectureRead(key) ? `<b>${esc(l.title)}</b><p>${r >= 85 ? "Zlatá úroveň! " : ""}Připravenost ${r} %</p><a class="btn block" href="#/karty?l=${key}">${r >= 85 ? "Udržet zlato" : "Opakovat"}</a><a class="btn-text" href="#/lekce/${key}">Průvodce</a>`
      : `<b>${esc(l.title)}</b><p>Část ${rd + 1} z ${ns}</p><a class="btn block" href="#/uc/${key}">${rd ? "Pokračovat" : "Start"}</a><a class="btn-text" href="#/lekce/${key}">Průvodce</a>`;
  }
  b.insertAdjacentHTML("afterend", `<div class="pop">${h}</div>`);
  const pp = b.parentElement.querySelector(".pop"); setTimeout(() => pp?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 60);
}
/* ---------- pochvala od učitele jednotky (max 3× denně) ---------- */
const PRAISE = { 5: ["5 v řadě! Jsi v ráži.", "Pět správně za sebou. Tak se to dělá!", "5 v řadě! Tohle si pamatuješ."], 10: ["10 v řadě! To je úroveň na jedničku.", "Deset správně za sebou! Klobouk dolů.", "10 v řadě! Zkouška se může bát."] };
function praise(lec, n) {
  const d = today(); S.praise = S.praise?.d === d ? S.praise : { d, n: 0 };
  if (S.praise.n >= 3) return false; S.praise.n++; save();
  const ui = unitIdx(lec); const el = document.createElement("div"); el.className = "praise";
  el.innerHTML = `${teacher(ui, "jump")}<div class="pb"><b>${esc(TEACHERS[ui].n)}</b>${esc(pick(PRAISE[n] || PRAISE[5]))}</div>`;
  document.body.appendChild(el); sfx.done(); setTimeout(() => el.classList.add("out"), 2300); setTimeout(() => el.remove(), 2700);
  return true;
}
function unitIntro(ui, go) {
  const t = TEACHERS[ui], u = C.units[ui];
  view().innerHTML = `<div class="welcome intro">${teacher(ui, "idle", true)}<span class="cap">Jednotka ${ui + 1}</span><h1>${esc(u.title)}</h1>
    <div class="bubble"><b>${esc(t.n)}</b>${esc(t.hi)} Budu tě provázet ${u.ids.join(" a ")}.</div></div>
    <div class="dock"><div class="dock-in"><button class="btn block big" id="introGo">Jdeme na to</button></div></div>`;
  sfx.done();
  $("#introGo").onclick = () => { S.seen = S.seen || {}; S.seen["u" + ui] = 1; save(); go(); };
}
function banner(cls, title, line, art) {
  return `<div class="banner ${cls}"><div class="t"><h2>${title}</h2><p>${line}</p></div><div class="art">${art}</div>
    <i class="arc"></i><i class="cloud c1"></i><i class="cloud c2"></i>${SPARK.replace("spark", "spark b1")}${SPARK.replace("spark", "spark b2")}</div>`;
}
document.addEventListener("click", e => { if (!e.target.closest(".pop,[data-node]")) $$(".pop").forEach(p => p.remove()); });
function weakest() {
  return lectures().map(l => ({ l, r: readiness(l.id) })).sort((a, b) => a.r.score - b.r.score)[0];
}
const lvlColor = pct => pct >= 85 ? "var(--green)" : pct >= 65 ? "var(--blue)" : pct >= 40 ? "var(--yellow)" : "var(--red)";
/* ---------- konec sezení: oslava + 3 čísla + pokračovat (jako Duolingo) ---------- */
const dayLabel = d => d.type === "learn" ? `nová látka ${d.ids.join(", ")}` : DAYTYPE[d.type].name.toLowerCase();
function tomorrowLine() { const t = plan()[1]; return t ? `Zítra: ${dayLabel(t)}` : "Zítra je zkouška. Vyspi se."; }
function countUp(el) {
  const to = parseFloat(el.dataset.to); if (isNaN(to)) return; const suf = el.dataset.suf || ""; const pre = el.dataset.pre || ""; const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / 700); el.textContent = pre + Math.round(to * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function endScreen({ mood = "happy", title, sub, boxes = [], r0, next, extra = "", who = null }) {
  const r1 = overallReady().score; const d = Math.round(r1 * 100) - Math.round((r0 ?? r1) * 100);
  const nm = missions().find(m => !m.done);
  const go = next || (nm ? { href: nm.href, label: "Pokračovat" } : { href: "#/", label: "Pokračovat" });
  const all = [...boxes, ["Posun", d, "y", d > 0 ? "+" : d < 0 ? "" : "±", " %"]].slice(0, 3);
  sfx.done(); confetti();
  view().innerHTML = `<div class="done-screen">${who != null ? teacher(who, "jump") : ham(mood, "jump")}<div class="title">${esc(title)}</div>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}
    <div class="statboxes">${all.map(([h, v, c, pre = "", suf = ""]) => `<div class="sbox ${c}"><div class="h">${esc(h)}</div><div class="v"><span data-to="${v}" data-pre="${pre}" data-suf="${suf}">${pre}${v}${suf}</span></div></div>`).join("")}</div>
    ${!nm && !next ? `<p class="sub" style="margin-top:24px">Dnešek je hotový. ${esc(tomorrowLine())}.</p>` : ""}${extra}</div>
    <div class="dock"><div class="dock-in"><a class="btn block big" href="${go.href}">${esc(go.label)}</a></div></div>`;
  $$(".sbox [data-to]").forEach(countUp);
}
/* =================================================================== */
/* POKROK — připravenost, plán, přednášky                               */
/* =================================================================== */
function viewReadiness() {
  const o = overallReady(); const pct = Math.round(o.score * 100); const es = essayReady(); const p = plan(); const t = today();
  const rows = lectures().map(l => ({ l, r: readiness(l.id) })).sort((a, b) => a.r.score - b.r.score);
  view().innerHTML = `${topbar(null, `<a class="icon-btn" href="#/plan" aria-label="Nastavení">${ic.gear}</a>`)}
    ${banner("c-green", `${pct} % připraveno`, `${levelOf(pct)} · zkouška za ${Math.max(0, daysToExam())} ${plural(Math.max(0, daysToExam()), "den", "dny", "dní")} · eseje ${es.done}/${es.n}`, teacher(5, "idle"))}
    <div class="sec-title"><h2>Plán</h2></div>
    <div class="card">${p.map(d => { const dd = parseD(d.date); const ty = DAYTYPE[d.type];
      return `<div class="dayrow ${d.date === t ? "is-today" : ""}"><div class="d">${dd.getDate()}.</div><div class="what"><b>${ty.name}</b><span>${d.ids.length ? d.ids.join(" · ") : d.date === t ? "dnes" : DOW[dd.getDay()]}</span></div></div>`; }).join("")}
      <div class="dayrow"><div class="d" style="background:var(--yellow);color:#fff">${parseD(S.examDate).getDate()}.</div><div class="what"><b>Zkouška</b><span>Ty to dáš!</span></div></div></div>
    <div class="sec-title"><h2>Přednášky</h2></div>
    <div class="card">${rows.map(({ l, r }) => { const pc = Math.round(r.score * 100); const go = sectionsRead(l.id) < l.sections.length ? [`#/uc/${l.id}`, "Učit"] : r.mem < .6 ? [`#/karty?l=${l.id}`, "Kartičky"] : [`#/kviz?l=${l.id}&n=12`, "Kvíz"];
      return `<div class="ready-row"><div class="ring" style="--p:${pc};--rc:${lvlColor(pc)}"><span>${pc}</span></div><a class="t" href="#/lekce/${l.id}"><b>${l.id} ${esc(l.title)}</b></a><a class="btn ghost sm" href="${go[0]}">${go[1]}</a></div>`; }).join("")}</div>`;
}
/* =================================================================== */
/* PROCVIČOVAT — jako Duolingo „Practice hub"                            */
/* =================================================================== */
function viewPractice() {
  const due = dueIds().length; const es = essayReady();
  const weakN = Object.values(S.q).filter(r => r.lastOk === false).length;
  const tile = (href, c, ico, t, s, badge) => `<a class="tile ${c}" href="${href}"><div class="t"><b>${t}</b><span>${s}</span></div>${badge ? `<span class="badge">${badge}</span>` : ""}<div class="pic">${ico}</div></a>`;
  const hero = due ? `<a class="tile hero c-purple" href="#/karty"><div class="t"><b>Kartičky</b><span>${due} ${plural(due, "čeká", "čekají", "čeká")} na zopakování</span></div><div class="pic">${ic.cards}</div></a>`
    : `<a class="tile hero c-blue" href="#/kviz?mix=1&n=10"><div class="t"><b>Rychlý kvíz</b><span>10 otázek ze všeho</span></div><div class="pic">${ic.bolt}</div></a>`;
  view().innerHTML = `${topbar()}${banner("c-purple", "Procvičovat", "Krátce a často. Tak si to mozek uloží nejlíp.", ham("happy", "idle"))}${hero}
    <div class="sec-title"><h2>Všechno</h2></div>
    <div class="tiles">
      ${due ? tile("#/kviz?mix=1&n=10", "c-blue", ic.bolt, "Rychlý kvíz", "10 otázek ze všeho") : tile("#/karty", "c-purple", ic.cards, "Kartičky", "Vše zopakováno")}
      ${tile("#/kviz?weak=1&n=20&m=weak", "c-red", ic.target, "Moje chyby", "Jen to, co nejde", weakN || "")}
      ${tile("#/zkouska", "c-yellow", ic.trophy, "Zkouška nanečisto", `${EXAM_MC} otázek + esej`)}
      ${tile("#/esej", "c-orange", ic.pen, "Esej", `${es.done} z ${es.n} napsáno`)}
      ${tile("#/otazky?pick=1", "c-green", ic.brain, "Vysvětli to", "Zkouškové otázky vlastními slovy")}
      ${tile("#/seznamy", "c-purple", ic.list, "Vyjmenuj", "Seznamy na zpaměť")}
      ${tile("#/grafy", "c-blue", ic.graph, "Grafy", "IS · MP · AD–AS")}
      ${tile("#/tahak", "c-green", ic.book, "Tahák", "Celý kurz na jedné stránce")}
      ${tile("#/hledat", "c-orange", ic.search, "Hledat", "Najdi pojem")}
    </div>`;
}
/* ---------- první spuštění: 3 krátké karty ---------- */
/* ---------- první spuštění: 3 krátké karty ---------- */
function viewWelcome() {
  const ios = /iPhone|iPad/.test(navigator.userAgent) && !navigator.standalone;
  const slides = [
    { m: "happy", h: "Ahoj, já jsem Penny!", p: "Naučím tě Měnovou teorii. Kousek po kousku." },
    { m: "open", h: "Čti · odpovídej · opakuj", p: "Krátká část, pár otázek, kartičky. Každý den." },
    { m: "wow", h: "Na konci zkouška nanečisto", p: ios ? "a/b/c/d + esej. Tip: Sdílet → Přidat na plochu." : "a/b/c/d + esej, jako ve škole." },
  ];
  let i = 0;
  const draw = () => {
    const sl = slides[i];
    view().innerHTML = `<div class="welcome">${ham(sl.m, "idle")}<h1>${sl.h}</h1><p class="lead">${sl.p}</p>
      <div class="dots">${slides.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div></div>
      <div class="dock"><div class="dock-in"><button class="btn block big" id="wNext">${i < slides.length - 1 ? "Pokračovat" : "Jdeme na to"}</button></div></div>`;
    $("#wNext").onclick = () => { if (i < slides.length - 1) { i++; draw(); } else { S.onboarded = 1; save(); render(); } };
  };
  document.body.classList.add("focus");
  draw();
}
function viewWaiting() { return viewToday(); }
/* =================================================================== */
/* MAPA                                                                 */
/* =================================================================== */
function viewMap() { return viewToday(); }
/* =================================================================== */
/* LEKCE                                                                */
/* =================================================================== */
/* =================================================================== */
/* PRŮVODCE PŘEDNÁŠKOU                                                  */
/* =================================================================== */
const TABS = [["vyklad", "Výklad"], ["pojmy", "Pojmy"], ["vzorce", "Vzorce"], ["priklady", "Příklady"], ["grafy", "Grafy"], ["seznamy", "Seznamy"], ["otazky", "Otázky"], ["triky", "Triky"]];
const UNIT_C = [["var(--green)", "var(--green-lip)"], ["#ce82ff", "#a568cc"], ["#00cd9c", "#00a47d"], ["#ff9600", "#e58700"], ["#1cb0f6", "#1899d6"], ["#ff4b4b", "#ea2b2b"]];
function viewLecture(parts, q) {
  const id = parts[1]; const l = LEC[id]; if (!l) return nav("#/");
  const tab = q.get("tab") || "vyklad";
  const tabs = TABS.filter(([k]) => k === "vyklad" || k === "pojmy" || k === "otazky" || k === "triky" ||
    (k === "vzorce" && l.formulas?.length) || (k === "seznamy" && l.lists?.length) || (k === "priklady" && l.problems?.length) || (k === "grafy" && l.graphs?.length));
  const rd = sectionsRead(id), ns = l.sections.length; const r = Math.round(readiness(id).score * 100);
  const ui = C.units.findIndex(u => u.ids.includes(id)); const [uc, ul] = UNIT_C[ui] || UNIT_C[0];
  const due = lecCards(id).filter(c => !S.cards[c] || isDue(c)).length;
  const cta = !lectureRead(id) ? `<a class="btn block big" href="#/uc/${id}">${rd ? "Pokračovat" : "Start"}</a>`
    : `<div class="grid2"><a class="btn big nowrap" href="#/karty?l=${id}">Kartičky${due ? ` <span class="cnt">${due}</span>` : ""}</a><a class="btn blue big" href="#/kviz?l=${id}&n=12">Kvíz</a></div>`;
  view().innerHTML = `${topbar("#/")}
    <div class="guide-head" style="--uc:${uc};--ul:${ul}"><div class="t"><span class="cap">Přednáška ${id} · ${rd}/${ns}</span><h1>${esc(l.title)}</h1></div><div class="ring big" style="--p:${r}"><span>${r}%</span></div></div>
    ${cta}
    <div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>
    <div id="tabc"></div>${fab(`${l.id} ${l.title}`)}`;
  $$(".tab").forEach(b => b.onclick = () => { history.replaceState(null, "", `#/lekce/${id}?tab=${b.dataset.tab}`); viewLecture(parts, new URLSearchParams("tab=" + b.dataset.tab)); });
  $("#tabc").innerHTML = lectureTab(l, tab);
  bindAsk();
}
function askBtn(text, ctx) { return `<button class="btn ghost sm" data-ask="${esc(text)}" data-ctx="${esc(ctx)}">${ham("open")} Nerozumím — zeptej se Penny</button>`; }
function bindAsk() {
  $$("[data-ask]").forEach(b => b.onclick = () => openDrawer(b.dataset.ctx, b.dataset.ask, b.dataset.shown));
}
function askLink(label, ctx, ask, shown, cls = "btn ghost sm") { return `<button class="${cls}" data-ask="${esc(ask)}" data-ctx="${esc(ctx)}" data-shown="${esc(shown || label)}">${ham("open")} ${esc(label)}</button>`; }
const CALC = "Odpovídej jako trpělivá doučovatelka počítání: nejdřív řekni, co ve vzorci znamená každá značka a proč tam je, pak ukaž JEDEN krok s dosazenými čísly (vzorce piš v LaTeXu mezi $…$, každý krok na nový řádek) a zeptej se mě, jestli to sedí, než půjdeš dál. Nevyzrazuj hned celý výsledek.";
function sectionSheet(s, withAsk = true) {
  const l = LEC[s.lec];
  const sl = [...new Set((s.slides || []).flatMap(nums))].filter(n => n > 0);
  return `<div class="sheet"><h3>${esc(s.title)}</h3>${sl.length ? slideThumbs(s.lec, sl, s.title) : ""}
    <div class="md">${md(s.body)}</div>
    ${s.analogy ? `<div class="analogy"><b>Představ si</b>${mdi(s.analogy)}</div>` : ""}
    ${s.halir ? `<div class="aside">${ham("happy")}<p>${esc(s.halir)}</p></div>` : ""}
    ${withAsk ? `<div class="sheet-actions">${askBtn(`Vysvětli mi jednoduše a s příkladem: ${s.title}`, `${l.id} ${l.title} – ${s.title}`)}</div>` : ""}</div>`;
}
function lectureTab(l, tab) {
  if (tab === "vyklad") return `<div class="sheet" style="margin-bottom:16px"><span class="cap">Velký obraz</span><div class="md" style="margin-top:8px">${md(l.bigPicture)}</div></div>` + l.sections.map(s => sectionSheet(s)).join("");
  if (tab === "pojmy") return `<div class="card">${l.keyTerms.map(t => `<div class="term"><b>${mdi(t.term)}</b><p class="md">${mdi(t.def)}</p></div>`).join("")}</div>`;
  if (tab === "vzorce") return l.formulas.map(f => `<div class="formula"><b>${esc(f.name)}</b><div class="f">${md("$$" + f.tex + "$$")}</div><div class="md small">${md(f.meaning)}</div>
    <div class="sheet-actions">${askLink("Vysvětli vzorec", `${l.id} ${l.title}`, `Vysvětli mi vzorec „${f.name}“: $${f.tex}$ (${f.meaning}). ${CALC} Na konci mi dej jeden jednoduchý příklad s čísly, ať si to zkusím sama.`, `Vysvětli mi vzorec: ${f.name}`)}</div></div>`).join("");
  if (tab === "seznamy") return `<a class="btn block" href="#/seznamy?l=${l.id}" style="margin-bottom:16px">Vyjmenovat</a>` +
    l.lists.map(x => `<div class="card"><b>${esc(x.title)}</b><${x.ordered ? "ol" : "ul"} class="md" style="margin-top:8px">${x.items.map(i => `<li>${mdi(i)}</li>`).join("")}</${x.ordered ? "ol" : "ul"}></div>`).join("");
  if (tab === "priklady") return `<a class="btn block" href="#/priklady/${l.id}" style="margin-bottom:16px">Počítat krok za krokem</a>` +
    l.problems.map((p, i) => `<div class="card"><b>Příklad ${i + 1}</b><div class="md" style="margin-top:6px">${md(p.q)}</div></div>`).join("");
  if (tab === "otazky") return l.examQuestions.map(e => { const f = S.feyn[e.id]; return `<a class="hit" href="#/otazka/${e.id}"><b>${mdi(e.q)}</b><span>${f ? `${Math.round(f.score * 100)} % bodů` : "Nezkoušeno"}</span></a>`; }).join("");
  if (tab === "grafy") return `<a class="btn blue block" href="#/grafy" style="margin-bottom:16px">Grafická laboratoř</a>` +
    l.graphs.map(g => `<div class="card"><b>${esc(g.title)}</b><p class="small muted">osa x: ${esc(g.x)} · osa y: ${esc(g.y)}</p><div class="md" style="margin-top:8px">${md(g.story)}</div></div>`).join("");
  if (tab === "triky") return `${(l.mnemonics || []).length ? l.mnemonics.map(m => `<div class="tip"><span class="k">✦</span><div><b>${mdi(m.for)}</b><div class="md small">${md(m.trick)}</div></div></div>`).join("") : ""}
    ${(l.pitfalls || []).length ? `<div class="sec-title"><h2>Pozor na</h2></div>` + l.pitfalls.map(p => `<div class="tip"><span class="k">!</span><div class="md small">${md(p)}</div></div>`).join("") : ""}`;
  return "";
}
/* =================================================================== */
/* UČENÍ LEKCE (čti → hned si vyzkoušej)                                */
/* =================================================================== */
/* =================================================================== */
/* LEKCE: čti → otázky → kartičky                                       */
/* =================================================================== */
function viewLearn(parts) {
  const id = parts[1]; const l = LEC[id]; if (!l) return nav("#/");
  const ui = unitIdx(id); if (!S.seen?.["u" + ui] && !sectionsRead(id)) return unitIntro(ui, () => render());
  if (!SESSION || SESSION.kind !== "learn" || SESSION.id !== id) {
    const first = l.sections.findIndex(s => !S.read[s.id]);
    SESSION = { kind: "learn", id, si: first < 0 ? 0 : first, phase: "read", r0: overallReady().score, ok: 0, n: 0, t0: Date.now(), s0: first < 0 ? 0 : first };
  }
  const st = SESSION; const s = l.sections[st.si];
  const prog = (st.si + (st.phase === "check" ? .5 : 0)) / l.sections.length * 100;
  const head = `<div class="session-top"><button class="x" data-back="#/" aria-label="Zavřít">${ic.x}</button><div class="bar"><i style="width:${prog}%"></i></div>${readBtn()}</div>`;
  if (st.phase === "read") {
    view().innerHTML = `${head}${st.si === 0 ? `<div class="hero">${ham("happy", "idle")}<div class="bubble">${esc(l.halirIntro || "Jdeme na to!")}</div></div>` : ""}
      ${sectionSheet(s)}
      <div class="dock"><div class="dock-in"><button class="btn block big" id="goCheck">Pokračovat</button></div></div>${fab(`${l.id} ${l.title} – ${s.title}`)}`;
    bindAsk(); readNow(sectionText(s));
    $("#goCheck").onclick = () => {
      const pool = Object.values(QZ).filter(x => x.lec === id && x.section === s.id);
      const unseen = pool.filter(x => !S.q[x.id]);
      const nChecks = cram() ? 2 : 3; st.checks = shuffle(unseen.length >= 2 ? unseen : pool).slice(0, Math.min(nChecks, pool.length));
      st.ci = 0;
      if (!st.checks.length) return finishSection();
      st.phase = "check"; render();
    };
  } else {
    const item = st.checks[st.ci];
    view().innerHTML = `${head}<div id="qbox"></div>`;
    renderQuestion($("#qbox"), item, ok => { st.n++; if (ok) st.ok++; st.ci++; if (st.ci >= st.checks.length) finishSection(); else render(); });
  }
  function finishSection() {
    if (!S.read[s.id]) { S.read[s.id] = Date.now(); addXP(15); }
    sectionCards(l, s.id).forEach(c => { S.cards[c.id] = { reps: 0, ease: 2.4, ivl: 0, lapses: 0, due: Date.now() }; });
    save();
    if (st.si + 1 < l.sections.length) { st.si++; st.phase = "read"; render(); }
    else {
      l.flashcards.filter(c => !S.cards[c.id]).forEach(c => { S.cards[c.id] = { reps: 0, ease: 2.4, ivl: 0, lapses: 0, due: Date.now() }; });
      save(); const r0 = st.r0; SESSION = null;
      const nNew = lecCards(id).filter(isDue).length;
      endScreen({ title: `${id} hotovo!`, sub: l.title, r0, who: unitIdx(id),
        boxes: [["Přesnost", st.n ? Math.round(st.ok / st.n * 100) : 100, "g", "", " %"], ["Kartičky", nNew, "p"]],
        next: { href: `#/karty?l=${id}`, label: `Opakovat kartičky` } });
    }
  }
}
/* =================================================================== */
/* KVÍZOVÁ OTÁZKA (sdílená)                                             */
/* =================================================================== */
function recordQ(item, ok) {
  const r = S.q[item.id] || { n: 0, ok: 0, last: 0, wrong: 0 };
  r.n++; if (ok) r.ok++; else r.wrong++; r.last = Date.now(); r.lastOk = ok; S.q[item.id] = r;
  addXP(ok ? 10 : 3);
}
function renderQuestion(box, item, onNext, opts = {}) {
  const exam = opts.exam;
  const L = ["A", "B", "C", "D", "E"];
  let html = `<div class="qcard"><div class="lbl">${item.t === "tf" ? "Pravda, nebo ne?" : "Vyber správnou odpověď"}</div>`;
  if (item.t === "tf") {
    html += `<div class="q">${mdi(item.s)}</div><div class="tf"><button class="opt" data-v="1"><span class="k">✓</span>Pravda</button><button class="opt" data-v="0"><span class="k">✗</span>Nepravda</button></div>`;
  } else {
    const order = item._order || (item._order = shuffle(item.options.map((_, i) => i)));
    html += `<div class="q">${mdi(item.q)}</div><div class="opts">${order.map((oi, k) => `<button class="opt" data-v="${oi}"><span class="k">${L[k]}</span><span>${mdi(item.options[oi])}</span></button>`).join("")}</div>`;
  }
  html += `</div><div class="dock" id="qdock"><div class="dock-in"><button class="btn block big off" id="qcheck">Kontrola</button></div></div>`;
  box.innerHTML = html;
  if (!exam) readNow(item.t === "tf" ? `Pravda, nebo ne? ${item.s}` : `${item.q}. ${(item._order || []).map((oi, k) => `${L[k]}: ${item.options[oi]}`).join(". ")}`);
  let sel = null;
  const pickOpt = b => { $$(".opt", box).forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = +b.dataset.v; $("#qcheck").classList.remove("off"); sfx.flip(); };
  const answer = v => {
    const correct = item.t === "tf" ? (v === 1) === !!item.true : v === item.correct;
    $$(".opt", box).forEach(b => {
      b.disabled = true; const bv = +b.dataset.v; b.classList.remove("sel");
      const isRight = item.t === "tf" ? (bv === 1) === !!item.true : bv === item.correct;
      if (!exam) { if (isRight) b.classList.add("right"); else if (bv === v) b.classList.add("wrong"); }
      else if (bv === v) b.classList.add("picked");
    });
    $("#qdock")?.remove();
    if (exam) { onNext(correct, v); return; }
    recordQ(item, correct);
    correct ? sfx.right() : sfx.wrong();
    window._combo = correct ? (window._combo || 0) + 1 : 0;
    if ((window._combo === 5 || window._combo === 10) && praise(item.lec, window._combo)) { } else if ([3, 5, 10, 15, 20].includes(window._combo)) { const p = document.createElement("div"); p.className = "streakpop"; p.textContent = `${window._combo} v řadě!`; document.body.appendChild(p); setTimeout(() => p.remove(), 1700); }
    const rightTxt = item.t === "tf" ? (item.true ? "Pravda" : "Nepravda") : item.options[item.correct];
    const fb = document.createElement("div");
    fb.className = "feedback " + (correct ? "good" : "badf");
    fb.innerHTML = `<div class="in"><h3><span class="ok-ico">${correct ? ic.check : ic.x}</span>${esc(correct ? pick(SAY.right) : "Správně je:")}</h3>
      ${correct ? "" : `<div class="ans">${mdi(rightTxt)}</div>`}
      <div class="md">${md(item.explain || "")}</div>
      <div class="row"><button class="btn ${correct ? "ok" : "bad"} big" style="flex:1" id="fbNext">Pokračovat</button>
      ${!correct ? `<button class="icon-btn" id="fbAsk" aria-label="Zeptej se Penny" style="width:54px;height:54px">${ham("open")}</button>` : ""}</div></div>`;
    document.body.appendChild(fb);
    if (S.readAloud) { TTS.now = ""; speak(`${correct ? "Správně." : "Správně je: " + rightTxt + "."} ${item.explain || ""}`); }
    const go = () => { fb.remove(); window.onkeydown = null; onNext(correct); };
    $("#fbNext", fb).onclick = go;
    const ask = $("#fbAsk", fb);
    if (ask) ask.onclick = () => { fb.remove(); const qt = item.t === "tf" ? item.s : item.q; openDrawer(item.lec + " " + LEC[item.lec].title, "Proč je to takhle? Otázka: " + qt + " Vysvětli mi to jednoduše.", "Proč je to takhle?"); };
    setTimeout(() => window.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }, 200);
  };
  $$(".opt", box).forEach(b => b.onclick = () => pickOpt(b));
  $("#qcheck").onclick = () => { if (sel != null) answer(sel); };
  window.onkeydown = e => {
    const k = e.key.toUpperCase(); const btns = $$(".opt", box);
    const i = L.indexOf(k) >= 0 ? L.indexOf(k) : ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0 && btns[i] && !btns[i].disabled) pickOpt(btns[i]);
    else if (e.key === "Enter" && sel != null) { e.preventDefault(); answer(sel); }
  };
}
/* =================================================================== */
/* KVÍZ                                                                 */
/* =================================================================== */
function quizPool(q) {
  const all = Object.values(QZ);
  const l = q.get("l");
  if (l) return all.filter(x => x.lec === l);
  if (q.get("u") != null && C.units[+q.get("u")]) { const ids = C.units[+q.get("u")].ids; return all.filter(x => ids.includes(x.lec)); }
  if (q.get("weak")) {
    const w = all.filter(x => S.q[x.id] && (S.q[x.id].lastOk === false || S.q[x.id].ok / S.q[x.id].n < .75));
    return w.length >= 5 ? w : all.filter(x => S.q[x.id] && S.q[x.id].wrong > 0).concat(w);
  }
  const readL = lectures().map(x => x.id).filter(id => sectionsRead(id) > 0);
  return all.filter(x => !readL.length || readL.includes(x.lec));
}
function prioritize(pool, n) {
  const score = x => { const r = S.q[x.id]; if (!r) return 2 + Math.random(); return (1 - r.ok / r.n) * 2 + (r.lastOk === false ? 1.5 : 0) + Math.min(1, (Date.now() - r.last) / (3 * DAY)) + Math.random() * .6; };
  return [...pool].sort((a, b) => score(b) - score(a)).slice(0, n);
}
function interleave(items) {
  const by = {}; items.forEach(x => (by[x.lec] = by[x.lec] || []).push(x));
  const keys = shuffle(Object.keys(by)); const out = [];
  while (out.length < items.length) for (const k of keys) if (by[k].length) out.push(by[k].shift());
  return out;
}
function viewQuiz(parts, q) {
  const key = location.hash;
  if (!SESSION || SESSION.kind !== "quiz" || SESSION.key !== key) {
    const n = +(q.get("n") || 10);
    const pool = quizPool(q);
    const nTF = Math.floor(n * .2);
    let items = [...prioritize(pool.filter(x => x.t === "mc"), n - nTF), ...prioritize(pool.filter(x => x.t === "tf"), nTF)];
    if (items.length < n) items = prioritize(pool, n);
    if (!q.get("l")) items = interleave(items);
    items.forEach(i => delete i._order);
    SESSION = { kind: "quiz", key, r0: overallReady().score, items, i: 0, ok: 0, total: items.length, retried: new Set(), m: q.get("m"), t0: Date.now() };
  }
  const st = SESSION;
  if (!st.items.length) { view().innerHTML = `${topbar("#/procvic")}<div class="empty">${ham("open")}<h2 style="margin-top:8px">${q.get("weak") ? "Žádné chyby!" : "Zatím nic"}</h2><p style="margin-top:6px">${q.get("weak") ? "Nejdřív si udělej kvíz." : "Začni první lekcí."}</p><a class="btn" href="${q.get("weak") ? "#/kviz?mix=1&n=10" : "#/"}" style="margin-top:16px">${q.get("weak") ? "Rychlý kvíz" : "Na cestu"}</a></div>`; return; }
  if (st.i >= st.items.length) return quizDone(st);
  const item = st.items[st.i];
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/procvic" aria-label="Zavřít">${ic.x}</button><div class="bar"><i style="width:${st.i / st.items.length * 100}%"></i></div>${readBtn()}</div>
    ${st.i >= st.total ? `<p class="lbl" style="color:var(--orange)">Oprava chyby</p>` : ""}<div id="qbox"></div>`;
  renderQuestion($("#qbox"), item, ok => {
    if (st.i < st.total && ok) st.ok++;
    if (!ok && !st.retried.has(item.id)) { st.retried.add(item.id); delete item._order; st.items.push(item); }
    st.i++; render();
  });
}
function quizDone(st) {
  const pct = Math.round(st.ok / st.total * 100); const mins = Math.max(1, Math.round((Date.now() - st.t0) / 60000));
  const dt = doneToday(); if (st.m === "weak") dt.weak = 1; else dt.quiz = (dt.quiz || 0) + 1;
  const um = /[?&]u=(\d+)/.exec(st.key); if (um) { S.uq = S.uq || {}; S.uq[um[1]] = Math.max(S.uq[um[1]] ?? 0, pct); } save();
  const r0 = st.r0; SESSION = null;
  endScreen({ mood: pct >= 60 ? "happy" : "open", r0, title: pct >= 80 ? "Skvělá jízda!" : pct >= 50 ? "Dobrá práce!" : "Kvíz hotový!",
    boxes: [["Přesnost", pct, "g", "", " %"], ["Čas", mins, "b", "", " min"]] });
}
/* =================================================================== */
/* KARTIČKY (SRS)                                                       */
/* =================================================================== */
function viewCards(parts, q) {
  const key = location.hash;
  if (!SESSION || SESSION.kind !== "cards" || SESSION.key !== key) {
    const l = q.get("l");
    let ids;
    if (l) {
      lecCards(l).forEach(c => { if (!S.cards[c]) S.cards[c] = { reps: 0, ease: 2.4, ivl: 0, lapses: 0, due: Date.now() }; }); save();
      ids = shuffle(lecCards(l).filter(isDue));
    } else ids = interleave(shuffle(dueIds()).map(id => CARD[id])).map(c => c.id).slice(0, 60);
    SESSION = { kind: "cards", key, r0: overallReady().score, queue: ids, total: ids.length, done: 0, g: [0, 0, 0, 0] };
  }
  const st = SESSION;
  if (!st.queue.length) {
    if (st.done) return cardsDone(st);
    view().innerHTML = `${topbar("#/procvic")}<div class="empty">${ham("happy", "idle")}<h2 style="margin-top:8px">${Object.keys(S.cards).length ? "Vše zopakováno!" : "Zatím žádné kartičky"}</h2>
      <p style="margin-top:6px">${Object.keys(S.cards).length ? "Další dozrají později." : "Odemknou se s první lekcí."}</p>
      <a class="btn" style="margin-top:16px" href="${Object.keys(S.cards).length ? "#/kviz?mix=1&n=10" : "#/"}">${Object.keys(S.cards).length ? "Rychlý kvíz" : "Na cestu"}</a></div>`;
    return;
  }
  const id = st.queue[0]; const c = CARD[id]; const s = S.cards[id] || {};
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/procvic" aria-label="Zavřít">${ic.x}</button><div class="bar purple"><i style="width:${st.done / Math.max(1, st.done + st.queue.length) * 100}%"></i></div>${readBtn()}<span>${st.queue.length}</span></div>
    <div class="flash"><div class="face" id="face"><div class="lbl"><span>${esc(c.lec)}</span><span>${s.reps ? "opakování" : "nová"}</span></div>
      <div class="q">${mdi(c.q)}</div>
      <div id="recall"><button class="link small" id="typeIt">Napsat odpověď</button></div>
      <div class="a" id="ans" hidden><div class="md">${md(c.a)}</div><div class="sheet-actions" id="cask"></div></div>
      <div style="flex:1"></div></div></div>
    <div class="dock"><div class="dock-in" id="ctrl"><button class="btn blue block big" id="reveal">Ukázat odpověď</button></div></div>`;
  readNow(c.q);
  $("#typeIt").onclick = () => { $("#recall").innerHTML = `<textarea class="recall-input" placeholder="Tvoje odpověď…"></textarea>`; $(".recall-input").focus(); };
  const reveal = () => {
    sfx.flip(); $("#ans").hidden = false; $("#face").classList.add("reveal"); $("#typeIt")?.remove(); TTS.now = c.a; if (S.readAloud) speak(c.a);
    $("#cask").innerHTML = askBtn(`Vysvětli mi to: ${c.q} (odpověď: ${c.a})`, `${c.lec} ${LEC[c.lec].title}`);
    $("#ctrl").innerHTML = `<div class="grades">
      <button class="btn bad" data-g="0">Nevěděla<small>znovu</small></button>
      <button class="btn ghost" data-g="1">Těžké<small>brzy</small></button>
      <button class="btn ok" data-g="2">Věděla<small>${s.reps ? "později" : "zítra"}</small></button>
      <button class="btn blue" data-g="3">Hračka<small>za dlouho</small></button></div>`;
    bindAsk();
    $$("[data-g]").forEach(b => b.onclick = () => doGrade(+b.dataset.g));
    window.onkeydown = e => { if ("1234".includes(e.key)) doGrade(+e.key - 1); };
  };
  const doGrade = g => {
    window.onkeydown = null;
    const ns = grade(id, g); st.g[g]++; st.queue.shift();
    addXP(g >= 2 ? 5 : 2); if (g >= 2) sfx.right();
    if (ns.due <= Date.now() + 15 * 60e3) st.queue.splice(Math.min(st.queue.length, 3 + Math.floor(Math.random() * 3)), 0, id);
    else st.done++;
    render();
  };
  $("#reveal").onclick = reveal;
  window.onkeydown = e => { if (e.key === " " || e.key === "Enter") { if (document.activeElement?.tagName === "TEXTAREA") return; e.preventDefault(); reveal(); } };
}
function cardsDone(st) {
  const r0 = st.r0; SESSION = null; const knew = st.g[2] + st.g[3]; const tot = st.g.reduce((a, b) => a + b, 0);
  endScreen({ r0, title: "Kartičky hotové!", boxes: [["Kartičky", st.done, "p"], ["Věděla", tot ? Math.round(knew / tot * 100) : 0, "g", "", " %"]] });
}
/* =================================================================== */
/* SIMULACE ZKOUŠKY                                                     */
/* =================================================================== */
const EXAM_MC = 30, ESSAY_MIN = 20;
function viewExam(parts, q) {
  if (!SESSION || SESSION.kind !== "exam") {
    view().innerHTML = `${topbar("#/procvic")}<div class="welcome" style="min-height:auto;padding-top:8px">${ham("open", "idle")}<h1>Zkouška nanečisto</h1><p class="lead">${EXAM_MC} otázek a/b/c/d, pak esej ${ESSAY_MIN} min. Bez nápověd.</p></div>
      <label class="check"><input type="checkbox" id="onlyRead" ${S.onlyRead ? "checked" : ""}><span>Jen z přečtených lekcí</span></label>
      <div class="dock"><div class="dock-in"><button class="btn block big" id="startExam">Začít</button></div></div>`;
    $("#startExam").onclick = () => {
      S.onlyRead = $("#onlyRead").checked; save();
      let ls = lectures().map(l => l.id); if (S.onlyRead) { const r = ls.filter(id => sectionsRead(id) > 0); if (r.length) ls = r; }
      const per = Math.max(2, Math.ceil(EXAM_MC / ls.length));
      let items = [];
      for (const id of ls) items.push(...prioritize(Object.values(QZ).filter(x => x.lec === id && x.t === "mc"), per));
      items = shuffle(items).slice(0, EXAM_MC); items.forEach(i => delete i._order);
      const essay = pickEssay(ls);
      SESSION = { kind: "exam", r0: overallReady().score, items, i: 0, ans: [], essay, t0: Date.now(), phase: "mc" };
      render();
    };
    return;
  }
  const st = SESSION;
  if (st.phase === "mc" && st.i >= st.items.length) { st.phase = st.essay ? "essay" : "done"; st.te = Date.now(); }
  if (st.phase === "essay") {
    view().innerHTML = `<div class="session-top"><button class="x" id="quitExam" aria-label="Ukončit">${ic.x}</button><div class="bar"><i style="width:100%"></i></div><span>esej</span></div><div id="ebox"></div>`;
    $("#quitExam").onclick = () => { if (confirm("Ukončit simulaci?")) { SESSION = null; nav("#/"); } };
    renderEssay($("#ebox"), st.essay, { minutes: ESSAY_MIN, exam: true, onDone: sc => { st.essayScore = sc; st.phase = "done"; render(); } });
    return;
  }
  if (st.phase === "done") return examDone(st);
  const item = st.items[st.i];
  const el = Math.floor((Date.now() - st.t0) / 1000);
  view().innerHTML = `<div class="session-top"><button class="x" id="quitExam" aria-label="Ukončit">${ic.x}</button><div class="bar"><i style="width:${st.i / st.items.length * 100}%"></i></div><span id="clock">${Math.floor(el / 60)}:${pad(el % 60)}</span></div><div id="qbox"></div>`;
  $("#quitExam").onclick = () => { if (confirm("Ukončit simulaci?")) { SESSION = null; nav("#/"); } };
  clearInterval(window._clk); window._clk = setInterval(() => { const c = $("#clock"); if (!c) return clearInterval(window._clk); const e = Math.floor((Date.now() - st.t0) / 1000); c.textContent = `${Math.floor(e / 60)}:${pad(e % 60)}`; }, 1000);
  renderQuestion($("#qbox"), item, (ok, v) => { st.ans.push({ id: item.id, ok, v }); recordQ(item, ok); setTimeout(() => { st.i++; render(); }, 350); }, { exam: true });
}
function examDone(st) {
  clearInterval(window._clk); clearInterval(window._etimer);
  const ok = st.ans.filter(a => a.ok).length; const pct = Math.round(ok / Math.max(1, st.ans.length) * 100);
  if (!st.saved) { S.exams.push({ ts: Date.now(), pct, essay: st.essayScore ?? null }); doneToday().exam = 1; save(); st.saved = 1; }
  const wrong = st.ans.filter(a => !a.ok).map(a => QZ[a.id]);
  const r0 = st.r0; SESSION = null;
  endScreen({ mood: pct >= 60 ? "happy" : "open", r0, title: pct >= 70 ? "Zkouška zvládnutá!" : "Zkouška hotová!",
    boxes: [["Část A", pct, "g", "", " %"], ["Esej", st.essayScore == null ? 0 : Math.round(st.essayScore * 100), "b", "", " %"]],
    extra: wrong.length ? `<div class="list"><div class="sec-title"><h2>Chyby (${wrong.length})</h2></div>${wrong.map(w => `<div class="card"><span class="cap">${w.lec}</span><b style="display:block;margin-top:4px">${mdi(w.q)}</b>
      <p style="margin-top:8px;color:var(--green-ink);font-weight:800">✓ ${mdi(w.options[w.correct])}</p><div class="md small" style="margin-top:8px">${md(w.explain || "")}</div></div>`).join("")}</div>` : "" });
}
/* =================================================================== */
/* ESEJ — psaní na čas, osnova, klíčové body, vzor, hodnocení Penny   */
/* =================================================================== */
const ESSAYS = () => C.essays || [];
function pickEssay(ls) {
  const pool = ESSAYS().filter(e => e.lectures.every(id => ls.includes(id)));
  const pl = pool.length ? pool : ESSAYS();
  const sc = e => (S.essays?.[e.id] ? 1 + S.essays[e.id].score : 0) + Math.random() * .5;
  return [...pl].sort((a, b) => sc(a) - sc(b))[0] || null;
}
function renderEssay(box, e, opts = {}) {
  S.essayDraft = S.essayDraft || {};
  const draft = opts.exam ? "" : (S.essayDraft[e.id] || "");
  box.innerHTML = `<p class="cap">${opts.exam ? "Část B · esej" : "Esej"} · přednášky ${e.lectures.join(" + ")}</p><h2 style="margin:4px 0 12px">${esc(e.title)}</h2>
    <div class="sheet" style="padding:16px 16px"><div class="md">${md(e.prompt)}</div></div>
    <div class="row" style="margin:12px 0 8px"><span class="pill" id="etime">${ic.plan} ${opts.minutes || 15}:00</span><span class="small dim" id="ewc">0 slov</span><div class="sp" style="flex:1"></div>
      ${opts.exam ? "" : `<button class="link small" id="eout">osnova</button>`}</div>
    <div id="eoutline" hidden class="card dark" style="margin-bottom:12px"><b class="small">Doporučená osnova</b><ol class="md small" style="margin-top:8px">${(e.outline || []).map(o => `<li>${mdi(o)}</li>`).join("")}</ol></div>
    <p class="small muted" style="margin-bottom:8px">Nejdřív si 2 minuty naplánuj body (teze → mechanismus → graf → příklad → závěr). Grafy si kresli na papír.</p>
    <div class="row" style="align-items:flex-end"><textarea class="answer" id="etext" style="min-height:260px" placeholder="Piš esej…">${esc(draft)}</textarea><button class="mic" id="emic">${ic.mic}</button></div>
    <button class="btn block big" id="edone" style="margin-top:12px">Odevzdat esej · 0 slov</button><div id="eres"></div>`;
  const ta = $("#etext", box); dictation($("#emic", box), ta);
  const wc = () => { const n = (ta.value.trim().match(/\S+/g) || []).length; $("#ewc", box).textContent = `${n} ${plural(n, "slovo", "slova", "slov")}`; const ed = $("#edone", box); if (ed) ed.textContent = `Odevzdat esej · ${n} ${plural(n, "slovo", "slova", "slov")}`; if (!opts.exam) { S.essayDraft[e.id] = ta.value; save(); } };
  ta.oninput = wc; wc();
  const ob = $("#eout", box); if (ob) ob.onclick = () => { $("#eoutline", box).hidden = !$("#eoutline", box).hidden; };
  let left = (opts.minutes || 15) * 60;
  clearInterval(window._etimer);
  window._etimer = setInterval(() => {
    const t = $("#etime", box); if (!t) return clearInterval(window._etimer);
    left--; t.innerHTML = `${ic.plan} ${left < 0 ? "-" : ""}${Math.floor(Math.abs(left) / 60)}:${pad(Math.abs(left) % 60)}`;
    if (left === 0) { t.style.color = "var(--bad)"; toast("Čas! Dopiš větu a odevzdej."); }
  }, 1000);
  $("#edone", box).onclick = () => {
    clearInterval(window._etimer); if (REC) REC.stop();
    const a = ta.value.trim(); const kp = e.keyPoints || [];
    $("#edone", box).remove(); ta.readOnly = true;
    $("#eres", box).innerHTML = `<div class="sec-title"><h2>Klíčové body</h2><span class="small muted">odškrtni, co v eseji máš</span></div>
      ${kp.map(p => `<label class="check ${a && keyMatch(a, p) ? "on" : ""}"><input type="checkbox" ${a && keyMatch(a, p) ? "checked" : ""}><span class="md">${mdi(p)}</span></label>`).join("")}
      ${(e.graphs || []).length ? `<p class="cap" style="margin:16px 0 8px">Grafy, které tam patří</p>` + e.graphs.map(g => `<label class="check"><input type="checkbox"><span class="md">${mdi(g)}</span></label>`).join("") : ""}
      <details class="card dark" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Vzorová esej</summary><div class="md" style="margin-top:8px">${md(e.modelAnswer)}</div></details>
      <div class="stack" style="margin-top:16px"><button class="btn" id="esave">${opts.exam ? "Pokračovat na výsledky" : "Uložit výsledek"}</button>
      ${a && AGENT_ID ? `<button class="btn ghost" id="egrade">${ham("open")} Ať esej ohodnotí Penny</button>` : ""}</div>`;
    $$(".check input", box).forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
    $("#esave", box).onclick = () => {
      const got = $$("#eres .check input:checked", box).length, tot = $$("#eres .check input", box).length;
      const score = tot ? got / tot : 1;
      S.essays = S.essays || {}; S.essays[e.id] = { score, ts: Date.now() }; const dt = doneToday(); dt.essay = (dt.essay || 0) + 1;
      if (!opts.exam) delete S.essayDraft[e.id];
      addXP(40); save(); sfx.done(); if (score >= .7) confetti();
      if (opts.onDone) opts.onDone(score); else { toast(`Uloženo: ${Math.round(score * 100)} %`); setTimeout(() => nav("#/esej"), 700); }
    };
    const g = $("#egrade", box);
    if (g) g.onclick = () => openDrawer("Esej: " + e.title, `Ohodnoť mou esej jako zkoušející. Zadání: „${e.prompt}“. Řekni, co je dobře, co chybí (mechanismy, grafy, příklady) a co bych měla doplnit, a dej známku. Moje esej: ${a}`);
  };
}
function viewEssays(parts) {
  if (parts[1]) {
    const e = ESSAYS().find(x => x.id === parts[1]); if (!e) return nav("#/esej");
    view().innerHTML = `${topbar("#/esej")}<div id="ebox"></div>`;
    renderEssay($("#ebox"), e, { minutes: 15 });
    return;
  }
  view().innerHTML = `${topbar("#/procvic")}${banner("c-orange", "Esej", "15 minut na čas, pak srovnání se vzorem.", teacher(1, "idle"))}
    <details class="card" style="margin-bottom:16px"><summary><b>Jak napsat esej na výbornou</b></summary><ol class="md small" style="margin-top:8px">
      <li><strong>Teze hned v první větě</strong> — odpověz na otázku, pak to rozveď.</li>
      <li><strong>Mechanismus řetězem</strong> „X ↑ → Y ↑ → Z ↓, protože…“ — za to jsou body.</li>
      <li><strong>Graf</strong> s popsanými osami, výchozí a posunutou křivkou a šipkou.</li>
      <li><strong>Příklad</strong> z přednášky (ČNB, Fed, ECB, krize 2008, covid…).</li>
      <li><strong>Pojmy přesně</strong> (reálná vs. nominální sazba, pohyb po křivce vs. posun).</li>
      <li><strong>Krátký závěr</strong> — shrň odpověď jednou dvěma větami.</li></ol></details>
    ${ESSAYS().map(e => { const r = S.essays?.[e.id]; return `<a class="hit" href="#/esej/${e.id}"><b>${esc(e.title)}</b><span>${e.lectures.join(" + ")} · ${r ? `naposledy ${Math.round(r.score * 100)} %` : "nenapsáno"}</span></a>`; }).join("")}`;
}

/* =================================================================== */
/* OTÁZKY + VYSVĚTLI HALÍŘOVI (self-explanation)                        */
/* =================================================================== */
function viewQuestions(parts, q) {
  const l = q.get("l");
  if (q.get("pick")) {
    // vyber otázku z lekce s nejhorší úspěšností (nebo nezkoušenou)
    const readL = lectures().map(x => x.id).filter(id => sectionsRead(id) > 0);
    const pool = Object.values(EXQ).filter(e => !readL.length || readL.includes(e.lec));
    const sc = e => (S.feyn[e.id] ? S.feyn[e.id].score : -1) + ((quizAcc(e.lec) ?? .5)) + Math.random() * .3;
    const e = pool.sort((a, b) => sc(a) - sc(b))[0];
    if (e) { history.replaceState(null, "", "#/otazka/" + e.id); return viewFeynman(["otazka", e.id], q); }
  }
  const qs = Object.values(EXQ).filter(e => !l || e.lec === l);
  view().innerHTML = `${topbar("#/procvic")}<h1>Vysvětli to Penny</h1><p class="muted" style="margin:8px 0 16px">Zkouškové otázky. Vysvětli je vlastními slovy.</p>
    <div class="tabs"><a class="tab ${!l ? "on" : ""}" href="#/otazky">Vše</a>${lectures().map(x => `<a class="tab ${l === x.id ? "on" : ""}" href="#/otazky?l=${x.id}">${x.id}</a>`).join("")}</div>
    ${qs.map(e => { const f = S.feyn[e.id]; return `<a class="hit" href="#/otazka/${e.id}"><b>${mdi(e.q)}</b><span>${e.lec} · ${f ? `naposledy ${Math.round(f.score * 100)} %` : "nezkoušeno"}</span></a>`; }).join("")}`;
}
function keyMatch(answer, point) {
  const a = norm(answer);
  const words = norm(point).split(/[^a-z0-9]+/).filter(w => w.length >= 5).map(w => w.slice(0, 5));
  const uniq = [...new Set(words)]; if (!uniq.length) return false;
  const hit = uniq.filter(w => a.includes(w)).length;
  return hit / uniq.length >= .45;
}
let REC = null;
function dictation(btn, ta) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { btn.hidden = true; return; }
  btn.onclick = () => {
    if (REC) { REC.stop(); return; }
    REC = new SR(); REC.lang = "cs-CZ"; REC.continuous = true; REC.interimResults = true;
    const base = ta.value ? ta.value.trimEnd() + " " : "";
    REC.onresult = ev => { let txt = ""; for (const r of ev.results) txt += r[0].transcript; ta.value = base + txt; };
    REC.onend = () => { btn.classList.remove("live"); REC = null; };
    REC.onerror = () => { btn.classList.remove("live"); REC = null; toast("Mikrofon nefunguje — zkus psát."); };
    REC.start(); btn.classList.add("live");
  };
}
function viewFeynman(parts) {
  const e = EXQ[parts[1]]; if (!e) return nav("#/otazky");
  view().innerHTML = `${topbar("#/otazky")}<p class="cap">${e.lec} · ${esc(LEC[e.lec].title)}</p>
    <div class="hero" style="margin-top:4px">${ham("open", "idle")}<div class="bubble">${mdi(e.q)}</div></div>
    <p class="muted small" style="margin-bottom:8px">Vysvětli to vlastními slovy.</p>
    <div class="row" style="align-items:flex-end"><textarea class="answer" id="ans" placeholder="Moje odpověď…"></textarea><button class="mic" id="mic" title="Diktovat">${ic.mic}</button></div>
    <button class="btn block big" id="check" style="margin-top:16px">Porovnat s ${(e.keyPoints || []).length} klíčovými body</button>
    <div id="res"></div>`;
  dictation($("#mic"), $("#ans"));
  $("#check").onclick = () => {
    if (REC) REC.stop();
    const a = $("#ans").value.trim();
    const kp = e.keyPoints || [];
    $("#check").hidden = true;
    $("#res").innerHTML = `<div class="sec-title"><h2>Klíčové body</h2><span class="small muted">odškrtni, co jsi řekla</span></div>
      ${kp.map((p, i) => `<label class="check ${a && keyMatch(a, p) ? "on" : ""}"><input type="checkbox" data-i="${i}" ${a && keyMatch(a, p) ? "checked" : ""}><span class="md">${mdi(p)}</span></label>`).join("")}
      <details class="card dark" style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Vzorová odpověď</summary><div class="md" style="margin-top:8px">${md(e.answer)}</div></details>
      <div class="stack" style="margin-top:16px"><button class="btn" id="saveF">Uložit výsledek</button>
      ${a ? `<button class="btn ghost" id="sendH">${ham("open")} Ať to Penny ohodnotí</button>` : ""}</div>`;
    $$(".check input").forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
    $("#saveF").onclick = () => {
      const got = $$(".check input:checked").length; const score = kp.length ? got / kp.length : 1;
      S.feyn[e.id] = { score, ts: Date.now() }; const dt = doneToday(); dt.explain = (dt.explain || 0) + 1; addXP(20); save();
      sfx.done(); if (score >= .7) confetti(); toast(`Uloženo: ${Math.round(score * 100)} % bodů`);
      setTimeout(() => nav(dt.explain < 2 ? "#/otazky?pick=1&r=" + Date.now() : "#/"), 900);
    };
    const sh = $("#sendH");
    if (sh) sh.onclick = () => openDrawer(e.lec + " " + LEC[e.lec].title, `Ohodnoť mou odpověď na zkouškovou otázku „${e.q}“. Řekni, co chybí nebo je špatně. Moje odpověď: ${a}`);
  };
}

/* =================================================================== */
/* SEZNAMY (vyjmenuj)                                                   */
/* =================================================================== */
function viewLists(parts, q) {
  const l = q.get("l");
  let pool = Object.values(LIST).filter(x => !l || x.lec === l);
  if (!l) { const readL = lectures().map(x => x.id).filter(id => sectionsRead(id) > 0); if (readL.length) pool = pool.filter(x => readL.includes(x.lec)); }
  if (!SESSION || SESSION.kind !== "lists" || SESSION.key !== location.hash) {
    const sc = x => (S.lists[x.id] ? S.lists[x.id].ok / S.lists[x.id].n : -.5) + Math.random() * .4;
    SESSION = { kind: "lists", key: location.hash, r0: overallReady().score, ok: 0, tot: 0, items: (l ? pool : pool.sort((a, b) => sc(a) - sc(b))).slice(0, l ? 50 : 5), i: 0 };
  }
  const st = SESSION;
  if (!st.items.length) { SESSION = null; view().innerHTML = `${topbar("#/")}<div class="empty">${ham("open")}<h2 style="margin-top:8px">Seznamy se odemknou s lekcí</h2><p style="margin:8px auto 0;max-width:32ch">Přečti první lekci a budeš tu mít, co vyjmenovávat.</p><a class="btn" href="#/mapa" style="margin-top:16px">Vybrat lekci</a></div>`; return; }
  if (st.i >= st.items.length) { const r0 = st.r0, n = st.items.length, pc = st.tot ? Math.round(st.ok / st.tot * 100) : 0; SESSION = null;
    return endScreen({ title: "Vyjmenováno!", r0, boxes: [["Seznamy", n, "p"], ["Položky", pc, "g", "", " %"]] }); }
  const x = st.items[st.i];
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/">${ic.x}</button><div class="bar candle"><i style="width:${st.i / st.items.length * 100}%"></i></div><span class="small muted">${st.i + 1}/${st.items.length}</span></div>
    <div class="qcard"><div class="lbl">${x.lec} · vyjmenuj (${x.items.length} ${plural(x.items.length, "položka", "položky", "položek")})${x.ordered ? " · ve správném pořadí" : ""}</div>
    <div class="q">${esc(x.title)}</div>
    <div class="row" style="align-items:flex-end"><textarea class="answer" id="ans" style="min-height:110px" placeholder="Napiš nebo řekni, co si vybavíš…"></textarea><button class="mic" id="mic">${ic.mic}</button></div>
    <div id="items"></div></div><div class="dock"><div class="dock-in" id="ldock"><button class="btn block big" id="rev">Ukázat seznam · ${x.items.length} ${plural(x.items.length, "položka", "položky", "položek")}</button></div></div>`;
  dictation($("#mic"), $("#ans"));
  $("#rev").onclick = () => {
    if (REC) REC.stop(); const a = $("#ans").value;
    $("#ldock").innerHTML = `<button class="btn block big" id="nx">${st.i + 1 < st.items.length ? `Další seznam · ${st.i + 2} z ${st.items.length}` : "Dokončit"}</button>`;
    $("#items").innerHTML = `<p class="small muted" style="margin:12px 0 8px">Odškrtni, co jsi věděla:</p>` + x.items.map((it, i) => `<label class="check ${a && keyMatch(a, it) ? "on" : ""}"><input type="checkbox" ${a && keyMatch(a, it) ? "checked" : ""}><span class="md">${x.ordered ? (i + 1) + ". " : ""}${mdi(it)}</span></label>`).join("");
    $$(".check input").forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
    $("#nx").onclick = () => {
      const ok = $$(".check input:checked").length; S.lists[x.id] = { ok, n: x.items.length, ts: Date.now() }; st.ok += ok; st.tot += x.items.length;
      const dt = doneToday(); dt.lists = (dt.lists || 0) + 1; addXP(10); save(); st.i++; render();
    };
  };
}

/* =================================================================== */
/* PŘÍKLADY (worked examples, krok za krokem)                           */
/* =================================================================== */
function viewProblems(parts) {
  const l = LEC[parts[1]]; if (!l) return nav("#/mapa");
  const ctx = `${l.id} ${l.title}`;
  view().innerHTML = `${topbar("#/lekce/" + l.id)}<h1>Příklady ${l.id}</h1><p class="muted" style="margin:8px 0 16px">Krok za krokem. Nejdřív zkus sama.</p>
    ${l.problems.map((p, i) => `<div class="card dark" data-p="${i}"><b>Příklad ${i + 1}</b><div class="md" style="margin-top:8px">${md(p.q)}</div><div class="steps" style="margin-top:12px"></div>
      <div class="sheet-actions"><button class="btn ghost sm" data-step>Ukázat krok 1 z ${p.steps.length}</button>
      ${askLink("Počítat s Penny", ctx, `Pojďme spolu krok za krokem spočítat příklad z přednášky ${l.id}: ${p.q} — Pro tebe (neprozrazuj mi to hned): postup je ${p.steps.map((x, k) => `(${k + 1}) ${x}`).join(" ")} Výsledek: ${p.result}. ${CALC} Začni tím, že se mě zeptáš, čím bych začala.`, `Počítejme spolu příklad ${i + 1} z ${l.id}`)}</div></div>`).join("")}`;
  bindAsk();
  $$("[data-p]").forEach(card => {
    const p = l.problems[+card.dataset.p]; let k = 0; const box = $(".steps", card); const b = $("[data-step]", card);
    b.onclick = () => {
      if (k < p.steps.length) {
        box.insertAdjacentHTML("beforeend", `<div class="step"><div class="md"><b>Krok ${k + 1}.</b> ${md(p.steps[k])}</div>${askLink("Nerozumím tomuhle kroku", ctx, `Vysvětli mi úplně jednoduše tento krok příkladu z přednášky ${l.id}: „${p.steps[k]}“. Zadání příkladu: ${p.q}. ${k ? `Předchozí kroky: ${p.steps.slice(0, k).join(" ")}` : ""} Řekni, co znamená každá značka, odkud se vzalo každé číslo a proč se to počítá takhle. Vzorce piš v LaTeXu mezi $…$, každý mezivýpočet na nový řádek.`, `Nerozumím kroku ${k + 1} v příkladu ${+card.dataset.p + 1}`, "link small step-ask")}</div>`); k++;
        bindAsk();
      } else { box.insertAdjacentHTML("beforeend", `<div class="step result"><b>Výsledek:</b> <span class="md">${mdi(p.result)}</span></div>`); b.remove(); addXP(8); }
      if (b.isConnected) b.textContent = k === p.steps.length ? "Ukázat výsledek" : `Ukázat krok ${k + 1} z ${p.steps.length}`;
    };
  });
}

/* =================================================================== */
/* HLEDAT                                                               */
/* =================================================================== */
function searchNotes(query, n = 5) {
  const qn = norm(query).split(/[^a-z0-9]+/).filter(w => w.length >= 3);
  if (!qn.length) return [];
  const docs = [];
  for (const l of lectures()) {
    for (const s of l.sections) docs.push({ kind: "s", l, s, title: s.title, text: s.title + " " + s.body });
    for (const t of l.keyTerms) docs.push({ kind: "t", l, t, title: t.term, text: t.term + " " + t.term + " " + t.def });
  }
  return docs.map(d => {
    const tx = norm(d.text); const ti = norm(d.title);
    let sc = 0; for (const w of qn) { const st = w.slice(0, Math.max(4, w.length - 2)); if (ti.includes(st)) sc += 3; if (tx.includes(st)) sc += 1 + Math.min(2, tx.split(st).length - 2) * .3; }
    return { d, sc };
  }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, n).map(x => x.d);
}
function viewSearch(parts, q) {
  view().innerHTML = `${topbar("#/")}<h1>Hledat v látce</h1><input class="search" id="sq" style="margin:16px 0" placeholder="např. repo sazba, multiplikátor, IS křivka…" value="${esc(q.get("q") || "")}"><div id="hits"></div>`;
  const run = () => {
    const hits = searchNotes($("#sq").value, 12);
    $("#hits").innerHTML = hits.map(h => h.kind === "s" ? `<a class="hit" href="#/lekce/${h.l.id}"><b>${h.l.id} · ${esc(h.s.title)}</b><span>${esc(h.s.body.replace(/[*$#>|_-]/g, "").slice(0, 160))}…</span></a>`
      : `<a class="hit" href="#/lekce/${h.l.id}?tab=pojmy"><b>${mdi(h.t.term)}</b><span>${h.l.id} · ${mdi(h.t.def)}</span></a>`).join("") || `<p class="empty">Napiš pojem…</p>`;
  };
  $("#sq").oninput = run; run(); $("#sq").focus();
}

/* =================================================================== */
/* PLÁN                                                                 */
/* =================================================================== */
/* ---------- nastavení (data, synchronizace, záloha) ---------- */
function viewPlan() {
  view().innerHTML = `${topbar("#/pripravenost", " ")}<h1 style="margin-bottom:16px">Nastavení</h1>
    <div class="card">
      <div class="setrow"><span>Zkouška</span><input type="date" id="ed" value="${S.examDate}" min="${today()}"></div>
      <div class="setrow"><span>Začátek učení</span><input type="date" id="sd" value="${planStart()}" min="${today()}" max="${S.examDate}"></div>
      <div class="setrow"><span>Zvuky</span><button class="btn ghost sm" id="snd">${S.sound ? "Zapnuto" : "Vypnuto"}</button></div>
      <div class="setrow"><span>Číst nahlas</span><button class="btn ghost sm" data-read>${S.readAloud ? "Zapnuto" : "Vypnuto"}</button></div>
    </div>
    <div class="card"><div class="setrow"><span>Uloženo</span><span class="small muted" id="syncState" style="flex:none;font-weight:700"></span></div>
      <div class="setrow"><span>Záloha</span><button class="btn ghost sm" id="exp">Stáhnout</button><label class="btn ghost sm">Nahrát<input type="file" id="imp" accept=".json" hidden></label></div></div>
    <button class="btn-text" id="rst" style="color:var(--red-ink);margin-top:12px">Smazat celý postup</button>
    <a class="btn-text" href="#/jak">Proč se učíme takhle</a>`;
  syncBadge();
  $("#ed").onchange = e => { if (e.target.value) { S.examDate = e.target.value; S.planFor = null; save(); render(); } };
  $("#sd").onchange = e => { if (e.target.value) { S.startDate = e.target.value; S.planFor = null; save(); render(); } };
  $("#snd").onclick = () => { S.sound = !S.sound; save(); render(); };
  $("#exp").onclick = () => { const b = new Blob([JSON.stringify(S)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `penny-zaloha-${today()}.json`; a.click(); };
  $("#imp").onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.cards) throw 0; S = Object.assign(defaults(), d, { epoch: Date.now() }); save(); SYNC.run(); toast("Záloha nahrána"); render(); } catch (err) { toast("Tohle není záloha Penny."); } };
  $("#rst").onclick = () => { if (confirm("Opravdu smazat celý postup?")) { localStorage.removeItem(LS); S = Object.assign(defaults(), { epoch: Date.now(), onboarded: 1 }); save(); SYNC.run(); render(); } };
}
/* =================================================================== */
/* TAHÁK — rychlý přehled celého kurzu na poslední den                 */
/* =================================================================== */
function viewCheat() {
  const dt = doneToday(); if (!dt.tahak) { dt.tahak = 1; addXP(20); save(); }
  view().innerHTML = `${topbar("#/")}<h1>Tahák celého kurzu</h1>
    <p class="muted" style="margin:8px 0 16px">Nejdřív si řekni, o čem přednáška je. Pak čti.</p>
    ${lectures().map(l => `<details class="card dark" style="margin-bottom:12px"><summary style="cursor:pointer"><span><b>${l.id} · ${esc(l.title)}</b><span class="small dim" style="display:block;font-weight:700">${Math.round(mastery(l.id) * 100)} % upevněno</span></span></summary>
      <div class="md" style="margin-top:12px">${md(l.bigPicture)}</div>
      ${l.formulas?.length ? `<p class="cap" style="margin-top:16px">Vzorce</p>` + l.formulas.map(f => `<div class="formula"><b>${esc(f.name)}</b><div class="f">${md("$$" + f.tex + "$$")}</div></div>`).join("") : ""}
      ${l.lists?.length ? `<p class="cap" style="margin-top:16px">Vyjmenuj</p>` + l.lists.map(x => `<div style="margin:8px 0"><b class="small">${esc(x.title)}</b><div class="md small">${x.items.map(i => mdi(i)).join(" · ")}</div></div>`).join("") : ""}
      ${l.pitfalls?.length ? `<p class="cap" style="margin-top:16px">Pozor na</p><ul class="md small">${l.pitfalls.map(x => `<li>${mdi(x)}</li>`).join("")}</ul>` : ""}
      <a class="btn ghost sm" style="margin-top:12px" href="#/kviz?l=${l.id}&n=8">${ic.bolt} 8 otázek z ${l.id}</a></details>`).join("")}`;
}

/* =================================================================== */
/* JAK SE UČIT (věda)                                                   */
/* =================================================================== */
function viewScience() {
  view().innerHTML = `${topbar("#/plan")}<h1>Proč se učíme takhle</h1>
  <div class="hero" style="margin-top:12px">${ham("happy")}<div class="bubble">Přepisovat slajdy je jako nosit oříšky v ruce. Vypadá to jako práce, ale většina vypadne. Já je nosím v líčkách.</div></div>
  <div class="sheet"><div class="md science">
  <p>Velký přehled 10 studijních technik (Dunlosky a kol., 2013) zjistil, že nejlépe fungují <strong>dvě</strong>: <strong>testování se</strong> a <strong>rozložené opakování</strong>. Naopak <strong>opakované čtení, podtrhávání a přepisování/shrnování</strong> mají nízký účinek — vytvářejí pocit, že to umíš, ale paměť moc neposilují.</p>
  <ol>
  <li><strong>Vybavování (testing effect)</strong> — každá kartička a otázka tě nutí si informaci <em>vytáhnout</em> z hlavy. Právě to vytahování ji ukládá. Proto po každé části lekce hned přijde rychlá kontrola.</li>
  <li><strong>Rozložené opakování</strong> — kartička, kterou umíš, se vrátí za 1 → 3 → 7 dní, ta, co nejde, hned. Penny intervaly zkracuje podle data zkoušky, aby sis vše zopakovala ještě před ní.</li>
  <li><strong>Prokládání (interleaving)</strong> — mix kvízy míchají lekce. Je to těžší, ale učí tě rozpoznat, <em>který</em> model nebo nástroj na otázku použít — přesně to chce zkouška.</li>
  <li><strong>Vysvětlování vlastními slovy</strong> — „Vysvětli to Penny“ (Feynmanova technika). Když to umíš vysvětlit jednoduše, rozumíš tomu. Mezery uvidíš hned u klíčových bodů.</li>
  <li><strong>Řešené příklady krok za krokem</strong> — u výpočtů nejdřív vzorové řešení, pak sama.</li>
  <li><strong>Obraz + slovo</strong> — grafy IS, MP a AD–AS si posouváš sama, takže mechanismus vidíš, ne jen čteš.</li>
  <li><strong>Spánek</strong> — paměť se ukládá v noci. Poslední večer nic nového, jen lehké opakování.</li>
  </ol>
  <blockquote><p>Jak používat: každý den otevři „Dnes“ a splň mise. 30–60 minut denně stačí, když jsou to tyhle minuty.</p></blockquote>
  <p class="small">Zdroje: Dunlosky et al. (2013), <em>Improving Students' Learning With Effective Learning Techniques</em>, Psychological Science in the Public Interest; Roediger &amp; Karpicke (2006), testing effect; Cepeda et al. (2006), spacing; Rohrer &amp; Taylor (2007), interleaving.</p>
  </div></div>`;
}

/* =================================================================== */
/* GRAFICKÁ LABORATOŘ                                                    */
/* =================================================================== */
const GL = { tab: "is", is: { G: 0, T: 0, C: 0, I: 0, NX: 0, f: 0 }, mp: { rbar: 0, pi: 2 }, ad: { dA: 0, rbar: 0, pie: 0, rho: 0, yp: 0 } };
function plotSVG({ xlab, ylab, xr, yr, lines, points = [], vlines = [], hlines = [] }) {
  const W = 340, H = 260, m = { l: 34, r: 14, t: 14, b: 32 };
  const sx = x => m.l + (x - xr[0]) / (xr[1] - xr[0]) * (W - m.l - m.r);
  const sy = y => H - m.b - (y - yr[0]) / (yr[1] - yr[0]) * (H - m.t - m.b);
  let s = `<svg viewBox="0 0 ${W} ${H}" font-family="Karla,system-ui,sans-serif">`;
  s += `<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#4a1a26"/></marker></defs>`;
  s += `<line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r + 4}" y2="${H - m.b}" stroke="#4a1a26" stroke-width="1.6" marker-end="url(#ar)"/>`;
  s += `<line x1="${m.l}" y1="${H - m.b}" x2="${m.l}" y2="${m.t - 4}" stroke="#4a1a26" stroke-width="1.6" marker-end="url(#ar)"/>`;
  s += `<text x="${W - m.r}" y="${H - 10}" text-anchor="end" font-size="13" font-weight="700" fill="#4a1a26">${xlab}</text>`;
  s += `<text x="${m.l - 8}" y="${m.t + 4}" text-anchor="end" font-size="13" font-weight="700" fill="#4a1a26">${ylab}</text>`;
  s += `<clipPath id="pc"><rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}"/></clipPath><g clip-path="url(#pc)">`;
  for (const v of vlines) s += `<line x1="${sx(v.x)}" y1="${m.t}" x2="${sx(v.x)}" y2="${H - m.b}" stroke="${v.c}" stroke-width="${v.w || 2.6}" ${v.dash ? `stroke-dasharray="6 5"` : ""}/>`;
  for (const v of hlines) s += `<line x1="${m.l}" y1="${sy(v.y)}" x2="${W - m.r}" y2="${sy(v.y)}" stroke="${v.c}" stroke-width="${v.w || 2.6}" ${v.dash ? `stroke-dasharray="6 5"` : ""}/>`;
  for (const L of lines) {
    const pts = []; for (let i = 0; i <= 60; i++) { const x = xr[0] + (xr[1] - xr[0]) * i / 60; pts.push(`${sx(x).toFixed(1)},${sy(L.f(x)).toFixed(1)}`); }
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${L.c}" stroke-width="${L.w || 3}" ${L.dash ? `stroke-dasharray="6 5"` : ""} opacity="${L.o || 1}"/>`;
  }
  s += `</g>`;
  for (const L of lines) if (L.label) { const lx = L.lx ?? xr[1] - (xr[1] - xr[0]) * .06; s += `<text x="${sx(lx)}" y="${sy(L.f(lx)) - 7}" text-anchor="end" font-size="13" font-weight="700" fill="${L.c}">${L.label}</text>`; }
  for (const v of vlines) if (v.label) s += `<text x="${sx(v.x) + 4}" y="${m.t + 12}" font-size="12" font-weight="700" fill="${v.c}">${v.label}</text>`;
  for (const p of points) {
    if (p.x < xr[0] || p.x > xr[1] || p.y < yr[0] || p.y > yr[1]) continue;
    s += `<line x1="${sx(p.x)}" y1="${sy(p.y)}" x2="${sx(p.x)}" y2="${H - m.b}" stroke="${p.c}" stroke-dasharray="3 4" stroke-width="1.4"/><line x1="${m.l}" y1="${sy(p.y)}" x2="${sx(p.x)}" y2="${sy(p.y)}" stroke="${p.c}" stroke-dasharray="3 4" stroke-width="1.4"/>`;
    s += `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="6" fill="${p.c}" stroke="#fff6ef" stroke-width="2"/>`;
    if (p.label) s += `<text x="${sx(p.x) + 9}" y="${sy(p.y) - 8}" font-size="12" font-weight="700" fill="${p.c}">${p.label}</text>`;
  }
  return s + `</svg>`;
}
function slider(id, label, min, max, step, val, hint) {
  return `<div class="slider"><label for="${id}">${label}</label><output id="${id}o">${val > 0 ? "+" : ""}${val}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">${hint ? `<small>${hint}</small>` : ""}</div>`;
}
function viewGraphs(parts, q) {
  GL.tab = q.get("g") || GL.tab;
  view().innerHTML = `${topbar("#/procvic")}<h1>Grafy</h1>
    <div class="tabs">${[["is", "IS"], ["mp", "MP"], ["ad", "AD–AS"]].map(([k, n]) => `<button class="tab ${GL.tab === k ? "on" : ""}" data-g="${k}">${n}</button>`).join("")}</div>
    <div class="graph-lab"><div class="graph" id="gsvg"></div><div class="graph-side"><div class="card" id="gctl"></div><div class="explain md" id="gexp"></div></div></div>
    <div style="margin-top:12px">${askBtn("Vysvětli mi, jak se v tomhle modelu posouvají křivky a proč.", GL.tab === "is" ? "5A IS křivka" : GL.tab === "mp" ? "5B MP křivka" : "6A Model AS-AD")}</div>`;
  bindAsk();
  $$("[data-g]").forEach(b => b.onclick = () => { GL.tab = b.dataset.g; history.replaceState(null, "", "#/grafy?g=" + GL.tab); viewGraphs(parts, new URLSearchParams("g=" + GL.tab)); });
  const ctl = $("#gctl");
  const bind = (obj, keys, draw) => keys.forEach(k => { const el = $("#" + k); el.oninput = () => { obj[k.split("_")[1]] = +el.value; $("#" + k + "o").textContent = (+el.value > 0 ? "+" : "") + el.value; draw(); }; });
  if (GL.tab === "is") {
    const P = GL.is;
    ctl.innerHTML = `<div class="row" style="justify-content:space-between"><b>Autonomní faktory</b><button class="link small" id="rs">Reset</button></div>` +
      slider("is_G", "Vládní nákupy Ḡ", -2, 2, .5, P.G) + slider("is_T", "Daně T̄", -2, 2, .5, P.T) + slider("is_C", "Autonomní spotřeba C̄", -2, 2, .5, P.C) +
      slider("is_I", "Autonomní investice Ī", -2, 2, .5, P.I) + slider("is_NX", "Autonomní čistý export NX̄", -2, 2, .5, P.NX) + slider("is_f", "Finanční frikce f̄", -2, 2, .5, P.f);
    const mpc = .6, d = .3, x = .1;
    const k = 1 / (1 - mpc);
    const base = r => 12 - (d + x) * k * r;
    const draw = () => {
      const dA = P.C + P.I - d * P.f + P.G + P.NX - mpc * P.T;
      const cur = r => base(r) + dA * k;
      const yr0 = 3;
      // r na svislé ose, Y na vodorovné → kreslíme r(Y)
      const lines = [
        { f: Y => (12 - Y) / ((d + x) * k), c: "#b08a7f", dash: true, label: "IS₁", lx: 5.2 },
        { f: Y => (12 + dA * k - Y) / ((d + x) * k), c: "#d9475f", w: 3.4, label: dA ? "IS₂" : "", lx: Math.max(1.5, Math.min(20, 5.2 + dA * k)) },
      ];
      $("#gsvg").innerHTML = plotSVG({ xlab: "Y (produkt)", ylab: "r", xr: [0, 22], yr: [0, 8], lines, hlines: [{ y: yr0, c: "#2f8a58", w: 1.6, dash: true }],
        points: [{ x: base(yr0), y: yr0, c: "#b08a7f", label: "A" }, ...(dA ? [{ x: cur(yr0), y: yr0, c: "#d9475f", label: "B" }] : [])] });
      const dY = (dA * k);
      const parts2 = [];
      if (P.G) parts2.push(`vládní nákupy ${P.G > 0 ? "rostou" : "klesají"} → plánované výdaje přímo ${P.G > 0 ? "rostou" : "klesají"}`);
      if (P.T) parts2.push(`daně ${P.T > 0 ? "rostou" : "klesají"} → disponibilní důchod a spotřeba ${P.T > 0 ? "klesají" : "rostou"} (jen o část danou $mpc$)`);
      if (P.C) parts2.push(`autonomní spotřeba ${P.C > 0 ? "roste" : "klesá"}`);
      if (P.I) parts2.push(`autonomní investice ${P.I > 0 ? "rostou" : "klesají"}`);
      if (P.NX) parts2.push(`autonomní čistý export ${P.NX > 0 ? "roste" : "klesá"}`);
      if (P.f) parts2.push(`finanční frikce ${P.f > 0 ? "rostou → dražší financování → investice klesají" : "klesají → levnější financování → investice rostou"}`);
      $("#gexp").innerHTML = dA === 0 && !parts2.length ? md(`Výchozí IS z přednášky: $Y = 12 - r$ (mpc = 0,6; d = 0,3; x = 0,1; multiplikátor $\\frac{1}{1-mpc} = 2{,}5$). Pohni posuvníkem — **změna autonomního faktoru = posun celé IS**. Změna $r$ = pohyb **podél** IS.`)
        : md(`${parts2.map(p => "- " + p).join("\n")}\n\n**Celkem:** autonomní výdaje se mění o ${dA.toFixed(2).replace(".", ",")}, × multiplikátor 2,5 = při každé sazbě $r$ je rovnovážný produkt o **${dY.toFixed(2).replace(".", ",")}** ${dY >= 0 ? "vyšší" : "nižší"} → IS se posouvá **${dY > 0 ? "doprava" : dY < 0 ? "doleva" : "nikam (vlivy se vyrušily)"}** (bod A → B při $r = 3$).`);
    };
    bind(P, ["is_G", "is_T", "is_C", "is_I", "is_NX", "is_f"], draw); draw();
    $("#rs").onclick = () => { Object.keys(P).forEach(k => P[k] = 0); viewGraphs(parts, q); };
  } else if (GL.tab === "mp") {
    const P = GL.mp; const lam = .5, r0 = 1;
    ctl.innerHTML = `<div class="row" style="justify-content:space-between"><b>Měnová politika</b><button class="link small" id="rs">Reset</button></div>` +
      slider("mp_rbar", "Autonomní složka r̄ (zpřísnění +, uvolnění −)", -2, 2, .5, P.rbar, "Autonomní změna = posun celé MP křivky") +
      slider("mp_pi", "Inflace π", 0, 8, .5, P.pi, "Změna inflace = pohyb podél MP křivky (Taylorův princip)");
    const draw = () => {
      const lines = [{ f: p => r0 + lam * p, c: "#b08a7f", dash: true, label: "MP₁", lx: 9 }, { f: p => r0 + P.rbar + lam * p, c: "#d9475f", w: 3.4, label: P.rbar ? "MP₂" : "", lx: 9 }];
      $("#gsvg").innerHTML = plotSVG({ xlab: "π (inflace)", ylab: "r", xr: [0, 10], yr: [-1, 9], lines, points: [{ x: P.pi, y: r0 + P.rbar + lam * P.pi, c: "#d9475f", label: "CB" }] });
      $("#gexp").innerHTML = md(`MP křivka: $r = \\bar r + \\lambda\\pi$ (zde $\\bar r = ${(r0 + P.rbar).toFixed(1).replace(".", ",")}$, $\\lambda = 0{,}5$). Kladný sklon: když inflace roste, centrální banka zvyšuje **reálnou** sazbu (nominální víc než o růst inflace — Taylorův princip).\n\n` +
        (P.rbar > 0 ? `**Autonomní zpřísnění** → MP se posouvá **nahoru**: při každé inflaci je reálná sazba vyšší.` : P.rbar < 0 ? `**Autonomní uvolnění** → MP se posouvá **dolů**: při každé inflaci je reálná sazba nižší.` : `Posuň horní posuvník pro autonomní změnu, spodní pro pohyb podél křivky.`));
    };
    bind(P, ["mp_rbar", "mp_pi"], draw); draw();
    $("#rs").onclick = () => { P.rbar = 0; P.pi = 2; viewGraphs(parts, q); };
  } else {
    const P = GL.ad; const YP0 = 10, gam = .6, pie0 = 2;
    ctl.innerHTML = `<div class="row" style="justify-content:space-between"><b>Šoky</b><button class="link small" id="rs">Reset</button></div>` +
      slider("ad_dA", "Poptávkový šok (G, C̄, Ī, NX̄, −T…)", -3, 3, .5, P.dA, "Posouvá AD") +
      slider("ad_rbar", "Autonomní zpřísnění MP r̄", -2, 2, .5, P.rbar, "Zpřísnění posouvá AD doleva") +
      slider("ad_rho", "Cenový (nabídkový) šok ρ", -2, 2, .5, P.rho, "Posouvá krátkodobou AS") +
      slider("ad_pie", "Inflační očekávání πᵉ", -2, 2, .5, P.pie, "Posouvá krátkodobou AS") +
      slider("ad_yp", "Potenciální produkt Yᴾ", -2, 2, .5, P.yp, "Trvalý nabídkový šok: posouvá LRAS i AS");
    const draw = () => {
      // AD: π = 2 + (A - Y)/s   (s = sklon), base passes through (YP0, 2)
      const s = 1.2;
      const AD = (dA, rb) => Y => pie0 + (YP0 + dA * 1.2 - rb * 1.5 - Y) / s;
      const AS = (pe, rho, yp) => Y => pie0 + pe + gam * (Y - (YP0 + yp)) + rho;
      const ad1 = AD(0, 0), ad2 = AD(P.dA, P.rbar), as1 = AS(0, 0, 0), as2 = AS(P.pie, P.rho, P.yp);
      const solve = (f, g) => { let lo = 0, hi = 22; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; (f(m) - g(m) > 0) ? lo = m : hi = m; } return lo; };
      const e1 = YP0; const y2 = solve(ad2, as2); const p2 = ad2(y2);
      const yp2 = YP0 + P.yp; const pLR = ad2(yp2);
      const changed = P.dA || P.rbar || P.rho || P.pie || P.yp;
      const lines = [{ f: ad1, c: "#b08a7f", dash: true, label: "AD₁", lx: 15 }, { f: as1, c: "#b08a7f", dash: true, label: "AS₁", lx: 15 }];
      if (P.dA || P.rbar) lines.push({ f: ad2, c: "#d9475f", w: 3.4, label: "AD₂", lx: 15 });
      if (P.pie || P.rho || P.yp) lines.push({ f: as2, c: "#2f6fb0", w: 3.4, label: "AS₂", lx: 15 });
      const vl = [{ x: YP0, c: "#b08a7f", dash: true, label: P.yp ? "LRAS₁" : "LRAS" }]; if (P.yp) vl.push({ x: yp2, c: "#2f8a58", label: "LRAS₂" });
      const pts = [{ x: e1, y: pie0, c: "#8a5a63", label: "E₁" }];
      if (changed) { pts.push({ x: y2, y: p2, c: "#d9475f", label: "E₂ (krátké obd.)" }); if (Math.abs(y2 - yp2) > .05) pts.push({ x: yp2, y: pLR, c: "#2f8a58", label: "E₃ (dlouhé)" }); }
      $("#gsvg").innerHTML = plotSVG({ xlab: "Y (produkt)", ylab: "π", xr: [4, 16], yr: [-3, 8], lines, vlines: vl, points: pts });
      const gap = y2 - yp2;
      let t = changed ? `**Krátké období:** produkt ${y2 > YP0 + .05 ? "roste" : y2 < YP0 - .05 ? "klesá" : "se nemění"} (Y ≈ ${y2.toFixed(1).replace(".", ",")}), inflace ${p2 > pie0 + .05 ? "roste" : p2 < pie0 - .05 ? "klesá" : "se nemění"} (π ≈ ${p2.toFixed(1).replace(".", ",")}).\n\n` : `Výchozí rovnováha E₁: AD protíná AS přesně na LRAS — produkt na potenciálu, inflace = očekávaná. Pohni šokem.`;
      if (changed) {
        if (Math.abs(gap) > .05) t += `**Mezera výstupu** ${gap > 0 ? "kladná (ekonomika přehřátá)" : "záporná (recese)"} → inflace ${gap > 0 ? "převyšuje" : "je pod"} očekáváními → očekávání se postupně ${gap > 0 ? "zvyšují" : "snižují"} → AS se posouvá ${gap > 0 ? "nahoru" : "dolů"} až do **E₃**, kde Y = Yᴾ (samoopravný mechanismus). `;
        else t += `Produkt zůstává na potenciálu. `;
        if ((P.dA || P.rbar) && !P.rho && !P.pie && !P.yp) t += `\n\n> V dlouhém období poptávkový šok mění jen **inflaci**, ne produkt.`;
        if (P.rho && !P.dA && !P.rbar) t += `\n\n> Dočasný nabídkový šok = **stagflace** (${P.rho > 0 ? "vyšší inflace a nižší produkt" : "nižší inflace a vyšší produkt"}). Centrální banka volí mezi stabilizací inflace a produktu.`;
      }
      $("#gexp").innerHTML = md(t);
    };
    bind(P, ["ad_dA", "ad_rbar", "ad_rho", "ad_pie", "ad_yp"], draw); draw();
    $("#rs").onclick = () => { Object.keys(P).forEach(k => P[k] = 0); viewGraphs(parts, q); };
  }
}

/* =================================================================== */
/* HALÍŘ — hlasový a textový tutor (ElevenLabs)                          */
/* =================================================================== */
const TUT = { conv: null, mode: "off", msgs: [], ctx: "", busy: false, lastQ: "", lastSlides: "" };

/* ---------- snímky z přednášek: náhledy, prohlížeč, „vysvětli mi tenhle snímek" ---------- */
const slideUrl = (lid, n) => `slides/${lid}/${n}.webp`;
const nums = v => (String(v ?? "").match(/\d+/g) || []).map(Number);
function pickSlides(sec, max = 3) {
  const l = LEC[sec.lec]; const g = new Set((l.graphs || []).flatMap(x => nums(x.slide)));
  const ss = [...new Set((sec.slides || []).flatMap(nums))].filter(n => n > 0);
  return [...ss.filter(n => g.has(n)), ...ss.filter(n => !g.has(n))].slice(0, max);
}
function slideThumbs(lid, list, title) {
  return `<div class="thumbs">${list.map((n, i) => `<button class="thumb" data-slides="${lid}|${list.join(",")}|${i}" data-stitle="${esc(title || "")}" aria-label="Snímek ${n}"><img loading="lazy" decoding="async" src="${slideUrl(lid, n)}" alt=""><span>${n}</span></button>`).join("")}</div>`;
}
function openViewer(lid, list, i, title) {
  document.querySelector(".viewer")?.remove();
  const el = document.createElement("div"); el.className = "viewer"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Snímek z přednášky");
  const draw = () => {
    el.innerHTML = `<div class="viewer-top"><div><p class="cap">Přednáška ${lid} · snímek ${list[i]}${list.length > 1 ? ` · ${i + 1} z ${list.length}` : ""}</p>${title ? `<b>${esc(title)}</b>` : ""}</div><button class="icon-btn" data-vclose aria-label="Zavřít">${ic.x}</button></div>
      <div class="viewer-img"><img src="${slideUrl(lid, list[i])}" alt="Snímek ${list[i]}"></div>
      <div class="viewer-bar">${list.length > 1 ? `<button class="icon-btn" data-vprev ${i ? "" : "disabled"} aria-label="Předchozí">${ic.left}</button>` : ""}<button class="btn block" data-vexplain>Vysvětli mi to</button>${list.length > 1 ? `<button class="icon-btn" data-vnext ${i < list.length - 1 ? "" : "disabled"} aria-label="Další">${ic.right}</button>` : ""}</div>`;
  };
  const close = () => { el.remove(); document.removeEventListener("keydown", key); };
  const key = e => { if (e.key === "Escape") close(); if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } if (e.key === "ArrowRight" && i < list.length - 1) { i++; draw(); } };
  draw(); document.body.appendChild(el); document.addEventListener("keydown", key);
  let x0 = null;
  el.addEventListener("touchstart", e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) { if (dx < 0 && i < list.length - 1) i++; else if (dx > 0 && i > 0) i--; draw(); } x0 = null; });
  el.onclick = e => {
    if (e.target.closest("[data-vclose]") || e.target.classList.contains("viewer-img")) return close();
    if (e.target.closest("[data-vprev]") && i > 0) { i--; return draw(); }
    if (e.target.closest("[data-vnext]") && i < list.length - 1) { i++; return draw(); }
    if (e.target.closest("[data-vexplain]")) {
      const ask = `Vysvětli mi jednoduše snímek ${list[i]} z přednášky ${lid}${title ? ` (${title})` : ""}: co na něm je, co znamenají osy nebo pojmy a co si z něj mám zapamatovat.`;
      close(); if (route().parts[0] === "halir") tutorSend(ask); else openDrawer(`${lid} ${LEC[lid].title}`, ask);
    }
  };
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-slides]"); if (!t) return;
  const [lid, list, i] = t.dataset.slides.split("|"); openViewer(lid, list.split(",").map(Number), +i, t.dataset.stitle);
});

// grafy modelů přímo do odpovědi Penny (překreslené podle přednášek 5A, 5B, 6A)
const TOPIC_LEC = { is: "5A", mp: "5B", ad: "5B", asad: "6A" };
function topicOf(t) {
  t = String(t || "");
  if (/\bAD\s*[–-]\s*AS\b|\bAS\s*[–-]\s*AD\b|\bAS\b.*\bAD\b|\bAD\b.*\bAS\b|nabídkov\w* šok|potenciální produkt|LRAS/i.test(t)) return "asad";
  if (/\bIS\b/.test(t)) return "is";
  if (/\bMP\b|Taylor/.test(t)) return "mp";
  if (/\bAD\b/.test(t)) return "ad";
  return "";
}
function graphFor(q, a) {
  const tp = topicOf(q) || topicOf(a); if (!tp) return "";
  const shift = /doprava|vpravo/i.test(a) ? 1 : /doleva|vlevo/i.test(a) ? -1 : 0;
  const ud = /posun\w*\s+(\S+\s+){0,3}nahoru|nahoru/i.test(a) ? 1 : /posun\w*\s+(\S+\s+){0,3}dolů|dolů/i.test(a) ? -1 : 0;
  const key = tp + shift + ud; if (key === TUT.lastGraph && !/ukaž|ukázat|obráz|graf|nakresl|vidět/i.test(q)) return ""; TUT.lastGraph = key;
  const old = "#b08a7f", hot = "#c2185b", blue = "#2f6fb0", green = "#2f8a58";
  let svg, cap, g;
  if (tp === "is") {
    const L = [{ f: Y => 12 - Y, c: shift ? old : hot, w: shift ? 2.4 : 3.4, dash: !!shift, label: shift ? "IS₁" : "IS", lx: 4 }];
    if (shift) L.push({ f: Y => 12 + 2.5 * shift - Y, c: hot, w: 3.4, label: "IS₂", lx: 4 + 2.5 * shift });
    svg = plotSVG({ xlab: "Y (produkt)", ylab: "r", xr: [0, 16], yr: [0, 8], lines: L, points: shift ? [{ x: 9, y: 3, c: old, label: "A" }, { x: 9 + 2.5 * shift, y: 3, c: hot, label: "B" }] : [{ x: 9, y: 3, c: hot, label: "A" }, { x: 11, y: 1, c: hot, label: "B" }] });
    cap = shift ? `IS se posouvá ${shift > 0 ? "doprava" : "doleva"}: při stejné sazbě r je rovnovážný produkt ${shift > 0 ? "vyšší" : "nižší"} (A → B).` : "IS křivka z přednášky: Y = 12 − r. Vyšší r → nižší investice a čistý export → nižší Y (pohyb z B do A po křivce).";
    g = "is";
  } else if (tp === "mp") {
    const L = [{ f: p => 1 + .5 * p, c: ud ? old : hot, w: ud ? 2.4 : 3.4, dash: !!ud, label: ud ? "MP₁" : "MP", lx: 7 }];
    if (ud) L.push({ f: p => 1 + ud + .5 * p, c: hot, w: 3.4, label: "MP₂", lx: 7 });
    svg = plotSVG({ xlab: "π (inflace)", ylab: "r", xr: [0, 8], yr: [0, 7], lines: L, points: [{ x: 2, y: 2 + (ud > 0 ? ud : 0), c: hot, label: "" }] });
    cap = ud ? `Autonomní ${ud > 0 ? "zpřísnění" : "uvolnění"} → MP se posouvá ${ud > 0 ? "nahoru" : "dolů"}: při každé inflaci je reálná sazba ${ud > 0 ? "vyšší" : "nižší"}.` : "MP křivka: r = r̄ + λπ. Když inflace roste, centrální banka zvyšuje reálnou sazbu (pohyb po křivce).";
    g = "mp";
  } else if (tp === "ad") {
    const ad = d => Y => 2 + (10 + 1.8 * d - Y) / 1.2;
    const L = [{ f: ad(0), c: shift ? old : hot, w: shift ? 2.4 : 3.4, dash: !!shift, label: shift ? "AD₁" : "AD", lx: 6.5 }];
    if (shift) L.push({ f: ad(shift), c: hot, w: 3.4, label: "AD₂", lx: 6.5 + 1.8 * shift });
    svg = plotSVG({ xlab: "Y (produkt)", ylab: "π", xr: [4, 16], yr: [-1, 7], lines: L });
    cap = shift ? `AD se posouvá ${shift > 0 ? "doprava" : "doleva"}: při každé inflaci je poptávaný produkt ${shift > 0 ? "vyšší" : "nižší"}.` : "AD křivka: vyšší inflace → CB zvýší reálnou sazbu (MP) → nižší investice a NX (IS) → nižší Y. Proto klesá.";
    g = "ad";
  } else {
    const adShift = /\bAD\b[^.]{0,60}(doprava|doleva)/i.test(a) ? shift : 0;
    const asUp = /\bAS\b[^.]{0,60}(nahoru|dolů)/i.test(a) ? ud : 0;
    const ad = d => Y => 2 + (10 + 1.8 * d - Y) / 1.2, as = u => Y => 2 + .6 * (Y - 10) + u;
    const L = [{ f: ad(0), c: adShift ? old : hot, w: adShift ? 2.4 : 3.2, dash: !!adShift, label: adShift ? "AD₁" : "AD", lx: 6.5 }, { f: as(0), c: asUp ? old : blue, w: asUp ? 2.4 : 3.2, dash: !!asUp, label: asUp ? "AS₁" : "AS", lx: 15 }];
    if (adShift) L.push({ f: ad(adShift), c: hot, w: 3.4, label: "AD₂", lx: 6.5 + 1.8 * adShift });
    if (asUp) L.push({ f: as(1.5 * asUp), c: blue, w: 3.4, label: "AS₂", lx: 15 });
    svg = plotSVG({ xlab: "Y (produkt)", ylab: "π", xr: [4, 16], yr: [-1, 7], lines: L, vlines: [{ x: 10, c: green, w: 2, dash: true, label: "LRAS (Yᴾ)" }] });
    cap = adShift ? `Poptávkový šok: AD ${adShift > 0 ? "doprava" : "doleva"} → v krátkém období ${adShift > 0 ? "vyšší" : "nižší"} Y i π; v dlouhém se ekonomika vrací na Yᴾ.` : asUp ? `Nabídkový šok: AS ${asUp > 0 ? "nahoru" : "dolů"} → ${asUp > 0 ? "vyšší inflace a nižší produkt (stagflace)" : "nižší inflace a vyšší produkt"} v krátkém období.` : "Model AD–AS: rovnováha tam, kde se AD protne s krátkodobou AS; v dlouhém období je produkt na potenciálu Yᴾ (LRAS).";
    g = "ad";
  }
  return `<div class="msg-graph"><div class="graph">${svg}</div><p class="small">${esc(cap)}</p><a class="link small" href="#/grafy?g=${g}">Vyzkoušet v grafické laboratoři</a></div>`;
}

// k odpovědi Penny najde nejbližší část přednášky a přiloží její snímky
function slidesFor(answer) {
  if (String(answer).length < 90) return "";
  const hits = searchNotes(`${TUT.lastQ || ""} ${answer}`, 8).filter(h => h.kind === "s");
  if (!hits.length) return "";
  const ctxL = (TUT.ctx || "").match(/^(\d[AB])\b/)?.[1];
  const tl = TOPIC_LEC[topicOf(TUT.lastQ) || topicOf(answer)];
  const h = (tl && hits.find(x => x.l.id === tl)) || hits.slice(0, 3).find(x => x.l.id === ctxL) || hits[0];
  const key = h.s.id; if (key === TUT.lastSlides) return ""; TUT.lastSlides = key;
  const list = pickSlides(h.s, 3); if (!list.length) return "";
  return `<p class="cap">Ze slajdů · ${h.l.id} ${esc(h.s.title)}</p>${slideThumbs(h.l.id, list, h.s.title)}`;
}
// značky pro hlas ElevenLabs ([slow], [excited]…) se nemají ukazovat ani číst
const cleanAI = t => String(t || "").replace(/\[[a-z][a-z ,'’-]{1,30}\]\s*(?!\()/gi, "").replace(/[ \t]{2,}/g, " ").trim();

async function tutorStop() { const c = TUT.conv; TUT.conv = null; TUT.mode = "off"; document.body.classList.remove("in-call"); document.getElementById("callbar")?.remove(); if (c) { try { await c.endSession(); } catch (e) { } } }
function thinking(on) {
  clearTimeout(TUT.thinkT); $$(".msg.typing").forEach(x => x.remove());
  if (!on) return;
  const ch = $("#chat"); if (!ch) return;
  ch.insertAdjacentHTML("beforeend", `<div class="msg ai typing" aria-label="Penny přemýšlí"><i></i><i></i><i></i></div>`);
  ch.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" }); tutorStatus("Penny přemýšlí…");
  TUT.thinkT = setTimeout(() => thinking(false), 30000);
}
function tutorMsg(role, text) { if (role === "ai") { thinking(false); text = cleanAI(text); } if (!text) return; if (role === "me") TUT.lastQ = text; document.getElementById("chips")?.remove(); const m = { role, text }; if (role === "ai") { m.graph = graphFor(TUT.lastQ, text); m.slides = slidesFor(text); } TUT.msgs.push(m); if (role === "ai" && S.readAloud && TUT.mode !== "voice") speak(text); const ch = $("#chat"); if (ch) { ch.insertAdjacentHTML("beforeend", msgHTML(m)); const el = role === "ai" ? ch.querySelectorAll(".msg.ai")[ch.querySelectorAll(".msg.ai").length - 1] : ch.lastElementChild; el.scrollIntoView({ block: role === "ai" && text.length > 400 ? "start" : "end", behavior: "smooth" }); } if (role === "me" && AGENT_ID) thinking(true); }
const aiMd = t => md(String(t).replace(/^[ \t]*\$([^$\n]+)\$[ \t]*$/gm, (_, f) => `$$${f}$$`));
const msgHTML = m => `<div class="msg ${m.role}">${m.img ? `<img class="msg-img" src="${m.img}" alt="">` : m.file ? `<span class="msg-file">${ic.clip} ${esc(m.file)}</span>` : ""}${m.role === "ai" ? aiMd(m.text) : esc(m.text)}${m.graph || ""}${m.slides ? `<div class="msg-slides">${m.slides}</div>` : ""}</div>`;
function tutorStatus(t) { const s = $("#tstat"); if (s) s.textContent = t; }
function tutorHam(cls) { $$(".tutor-hero .ham, .drawer-head .ham").forEach(h => h.classList.toggle("talk", cls === "talk")); }
async function tutorStart(textOnly) {
  if (!AGENT_ID) return null;
  if (TUT.conv && (textOnly || TUT.mode === "voice")) return TUT.conv;
  if (TUT.conv) await tutorStop();
  TUT.busy = true; tutorStatus("Penny se připojuje…");
  try {
    const { Conversation } = await (window._elMod ||= import("./vendor/elevenlabs.mjs?v=28"));
    const conv = await Conversation.startSession({
      agentId: AGENT_ID, connectionType: "websocket", textOnly: !!textOnly,
      dynamicVariables: { tema: TUT.ctx || "celý kurz Měnová teorie a politika", jmeno: "Anička", rezim: textOnly ? "psaný chat" : "hlasový hovor" },
      onMessage: m => { if ((m.role === "agent" || m.source === "ai") && textOnly && /^Ahoj(!| Aničko)/.test(m.message)) return; if (m.role === "agent" || m.source === "ai") tutorMsg("ai", m.message); else if (!textOnly && m.message) tutorMsg("me", m.message); },
      onModeChange: ({ mode }) => { if (mode === "speaking") thinking(false); tutorHam(mode === "speaking" ? "talk" : ""); tutorStatus(mode === "speaking" ? "Penny mluví…" : TUT.mode === "voice" ? "Poslouchám tě… klidně mě přeruš" : "Píšeme si"); },
      onError: (m) => { console.warn("penny", m); tutorStatus("Spojení vypadlo — zkus to znovu."); },
      onDisconnect: () => { TUT.conv = null; TUT.mode = "off"; tutorHam(""); syncVoiceBtn(); tutorStatus("Odpojeno"); },
    });
    TUT.conv = conv; TUT.mode = textOnly ? "text" : "voice"; syncVoiceBtn();
    tutorStatus(textOnly ? "Píšeme si" : "Poslouchám tě… klidně mě přeruš");
    return conv;
  } catch (e) {
    console.error(e); tutorStatus(textOnly ? "Nepodařilo se připojit." : "Nepodařilo se připojit — povol mikrofon a zkus to znovu.");
    return null;
  } finally { TUT.busy = false; }
}
function syncVoiceBtn() {
  const live = TUT.mode === "voice";
  $$("[data-voice]").forEach(b => { b.classList.toggle("live", live); b.innerHTML = live ? ic.stop : ic.mic; b.title = live ? "Ukončit hovor" : "Mluvit s Penny"; b.setAttribute("aria-label", b.title); });
  const l = $("#vlabel"); if (l) l.textContent = live ? "Ukončit hovor" : "Mluvit s Penny";
  document.body.classList.toggle("in-call", live);
}
async function toggleVoice() { if (TUT.busy) return; if (TUT.mode === "voice") { await tutorStop(); syncVoiceBtn(); tutorStatus("Hovor ukončen"); } else { await tutorStart(false); } }
document.addEventListener("click", e => { if (e.target.closest("[data-voice]")) toggleVoice(); else if (e.target.closest("[data-voice-stop]") && TUT.mode === "voice") toggleVoice(); });
function offlineAnswer(text) {
  const hits = searchNotes(text, 3);
  if (!hits.length) return "Tohle v poznámkách nevidím. Zkus to říct jinými slovy, nebo použij hledání.";
  return "Tady je, co k tomu mám v poznámkách:\n\n" + hits.map(h => h.kind === "s" ? `**${h.l.id} · ${h.s.title}** — ${h.s.body.replace(/\n+/g, " ").slice(0, 260)}… [otevřít](#/lekce/${h.l.id})` : `**${h.t.term}** (${h.l.id}) — ${h.t.def}`).join("\n\n");
}

/* ---------- přílohy: fotka zápisků, screenshot, PDF ---------- */
const ATT = { file: null, url: "" };
async function shrinkImage(f) {
  if (!/^image\//.test(f.type) || /gif|svg/.test(f.type)) return f;
  try {
    const bmp = await createImageBitmap(f); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", .85)); return b ? new File([b], "foto.jpg", { type: "image/jpeg" }) : f;
  } catch (e) { return f; }
}
function attachPreview() {
  $$(".att-preview").forEach(el => {
    if (!ATT.file) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = `${ATT.url ? `<img src="${ATT.url}" alt="">` : `<span class="att-ico">${ic.clip}</span>`}<span class="att-name">${esc(ATT.file.name)}</span><button class="att-x" data-att-clear aria-label="Odebrat přílohu">${ic.x}</button>`;
  });
  $$("#tsend").forEach(b => b.classList.toggle("ready", !!ATT.file || !!$("#tin")?.value.trim()));
}
document.addEventListener("change", async e => {
  if (!e.target.matches("[data-att-input]")) return;
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (f.size > 15e6) return toast("Soubor je moc velký (max 15 MB).");
  ATT.file = await shrinkImage(f); if (ATT.url) URL.revokeObjectURL(ATT.url);
  ATT.url = /^image\//.test(ATT.file.type) ? URL.createObjectURL(ATT.file) : ""; attachPreview();
  $("#tin")?.focus();
});
document.addEventListener("click", e => { if (e.target.closest("[data-att-clear]")) { ATT.file = null; ATT.url = ""; attachPreview(); } });
const attachBtn = () => AGENT_ID ? `<label class="attach" aria-label="Přiložit fotku nebo soubor">${ic.clip}<input type="file" accept="image/*,application/pdf,.txt" data-att-input hidden></label>` : "";
async function sendAttachment(text) {
  const f = ATT.file, url = ATT.url; ATT.file = null; ATT.url = ""; attachPreview();
  const q = text || (/^image\//.test(f.type) ? "Podívej se na tenhle obrázek a vysvětli mi ho podle přednášek." : "Podívej se na tenhle soubor a vysvětli mi ho podle přednášek.");
  TUT.lastQ = q; document.getElementById("chips")?.remove();
  const m = { role: "me", text: text || "", img: url, file: url ? "" : f.name }; TUT.msgs.push(m);
  const ch = $("#chat"); if (ch) { ch.insertAdjacentHTML("beforeend", msgHTML(m)); ch.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" }); }
  const conv = TUT.conv || await tutorStart(true);
  if (!conv) return tutorMsg("ai", "Přílohu se nepodařilo poslat — zkontroluj internet a zkus to znovu.");
  tutorStatus("Posílám přílohu…");
  try { const { fileId } = await conv.uploadFile(f); conv.sendMultimodalMessage({ text: q, fileId }); tutorStatus(TUT.mode === "voice" ? "Poslouchám tě… klidně mě přeruš" : "Píšeme si"); }
  catch (err) { console.warn(err); tutorStatus(""); tutorMsg("ai", "Tuhle přílohu jsem nedokázala otevřít. Zkus fotku (JPG/PNG) nebo PDF."); }
}

async function tutorSend(text, shown) {
  text = text.trim(); if (ATT.file && AGENT_ID) return sendAttachment(text); if (!text) return;
  tutorMsg("me", shown || text); if (shown) TUT.lastQ = text;
  if (!AGENT_ID) { setTimeout(() => tutorMsg("ai", offlineAnswer(text)), 250); return; }
  const conv = TUT.conv || await tutorStart(true);
  if (!conv) { tutorMsg("ai", offlineAnswer(text)); return; }
  try { conv.sendUserMessage(text); } catch (e) { tutorMsg("ai", offlineAnswer(text)); }
}
function viewTutor(parts, q) {
  const ctx = q.get("ctx"); const pre = q.get("q");
  if (ctx && ctx !== TUT.ctx) { tutorStop(); TUT.ctx = ctx; }
  if (AGENT_ID && !window._elMod) setTimeout(() => { window._elMod ||= import("./vendor/elevenlabs.mjs?v=28"); }, 1200);
  const has = TUT.msgs.length > 0;
  view().innerHTML = `${topbar("#/", readBtn())}
    <div class="tutor-hero ${has ? "compact" : ""}">${ham("happy", "idle")}<h2>Zeptej se Penny</h2>
      ${has ? "" : `<p class="muted small" style="max-width:34ch">${AGENT_ID ? "Mluv, nebo piš." : "Hlasová Penny se ještě připojuje. Zatím ti najdu odpověď v poznámkách."}</p>`}
      ${TUT.ctx ? `<span class="ctx">Téma: ${esc(TUT.ctx)} <button id="clrctx" aria-label="Zrušit téma">×</button></span>` : ""}
      ${AGENT_ID ? `<button class="voice-btn" id="voice" data-voice>${ic.mic}</button><b id="vlabel" class="small">Mluvit s Penny</b>` : ""}
      <div class="tutor-status" id="tstat"></div></div>
    <div class="chat" id="chat">${TUT.msgs.map(msgHTML).join("")}</div>
    <div class="tutor-bar"><div class="tutor-bar-in">
      ${has ? "" : `<div class="chips" id="chips">${["Vyzkoušej mě z " + (TUT.ctx || "IS křivky"), "Vysvětli mi transmisní mechanismus", "Pohyb po křivce vs. posun křivky?", "Co je ke zkoušce nejdůležitější?"].map(c => `<button class="chip">${esc(c)}</button>`).join("")}</div>`}
      <div class="att-preview" hidden></div>
      <div class="composer">${AGENT_ID ? `<button class="voice-mini" data-voice aria-label="Mluvit s Penny">${ic.mic}</button>` : ""}${attachBtn()}<textarea id="tin" rows="1" placeholder="Napiš otázku…" enterkeyhint="send"></textarea><button class="send" id="tsend" aria-label="Odeslat">${ic.send}</button></div>
    </div></div>`;
  const tin = $("#tin");
  const grow = () => { tin.style.height = "auto"; tin.style.height = Math.min(120, tin.scrollHeight) + "px"; $("#tsend").classList.toggle("ready", !!tin.value.trim() || !!ATT.file); };
  tin.oninput = grow;
  $("#tsend").onclick = () => { const v = tin.value; tin.value = ""; grow(); tutorSend(v); $("#chips")?.remove(); };
  tin.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#tsend").click(); } };
  $$(".chip").forEach(c => c.onclick = () => { tutorSend(c.textContent); $("#chips")?.remove(); });
  const cl = $("#clrctx"); if (cl) cl.onclick = () => { TUT.ctx = ""; tutorStop(); nav("#/halir"); };
  syncVoiceBtn(); attachPreview();
  if (pre) { history.replaceState(null, "", "#/halir"); tin.value = pre; grow(); tin.focus(); }
  const ch = $("#chat"); if (has && ch.lastElementChild) ch.lastElementChild.scrollIntoView({ block: "end" });
  // šipka dolů: skok na nejnovější zprávu
  document.body.insertAdjacentHTML("beforeend", `<button class="to-bottom" id="toBottom" aria-label="Na nejnovější zprávu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg></button>`);
  const tb = $("#toBottom"), bar = $(".tutor-bar");
  const upd = () => {
    if (!$("#chat")) { tb.remove(); window.removeEventListener("scroll", upd); return; }
    document.documentElement.style.setProperty("--tbar-h", bar.offsetHeight + "px");
    tb.classList.toggle("show", document.documentElement.scrollHeight - scrollY - innerHeight > 240);
  };
  window.addEventListener("scroll", upd, { passive: true }); setTimeout(upd, 300);
  tb.onclick = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
}

/* ---------- Penny vedle učení: panel, který neodvede ze stránky ---------- */
function closeDrawer() {
  const d = $("#drawer"); if (!d) return;
  tutorStop(); d.remove(); $("#drawerBg")?.remove(); document.body.classList.remove("drawer-open");
}
function openDrawer(ctx, pre, shown) {
  if (!AGENT_ID) return nav(`#/halir?ctx=${encodeURIComponent(ctx || "")}&q=${encodeURIComponent(pre || "")}`);
  if ((ctx || "") !== TUT.ctx) { tutorStop(); TUT.ctx = ctx || ""; if (TUT.msgs.length) TUT.msgs.push({ role: "sys", text: "Nové téma: " + (ctx || "celý kurz") }); }
  closeDrawer();
  const bg = document.createElement("div"); bg.id = "drawerBg"; bg.className = "drawer-bg"; bg.onclick = closeDrawer; document.body.appendChild(bg);
  const d = document.createElement("aside"); d.id = "drawer"; d.className = "drawer"; d.setAttribute("aria-label", "Zeptej se Penny");
  d.innerHTML = `<div class="drawer-grip"></div>
    <div class="drawer-head">${ham("happy")}<div style="flex:1;min-width:0"><b>Penny</b><div class="tutor-status small muted" id="tstat">${TUT.ctx ? "Téma: " + esc(TUT.ctx) : "Ptej se na cokoli z kurzu"}</div></div>
      ${readBtn()}<button class="icon-btn" id="dClose" aria-label="Zavřít">${ic.x}</button></div>
    <div class="chat" id="chat">${TUT.msgs.length ? TUT.msgs.map(msgHTML).join("") : `<div class="msg sys">Napiš otázku, nebo zmáčkni mikrofon a mluv se mnou nahlas.</div>`}</div>
    <div class="att-preview drawer-att" hidden></div><div class="drawer-compose"><button class="voice-mini" data-voice aria-label="Mluvit s Penny">${ic.mic}</button>${attachBtn()}
      <textarea id="tin" rows="1" placeholder="Napiš otázku…" enterkeyhint="send"></textarea><button class="send ready" id="tsend" aria-label="Odeslat">${ic.send}</button></div>`;
  document.body.appendChild(d); document.body.classList.add("drawer-open");
  const tin = $("#tin", d);
  $("#dClose", d).onclick = closeDrawer;
  $("#tsend", d).onclick = () => { const v = tin.value; tin.value = ""; tutorSend(v); };
  tin.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#tsend", d).click(); } };
  syncVoiceBtn(); attachPreview();
  if (pre) { tutorSend(pre, shown); } else setTimeout(() => tin.focus(), 250);
  const ch = $("#chat", d); ch.scrollTop = ch.scrollHeight;
}
function fab(ctx) { return `<button class="fab" id="fab" data-fabctx="${esc(ctx)}">${ham("happy")}<span>Zeptej se</span></button>`; }
document.addEventListener("click", e => { const f = e.target.closest("#fab"); if (f) openDrawer(f.dataset.fabctx, ""); });

/* ---------- boot ---------- */
(async function boot() {
  try { await loadCourse(); }
  catch (e) { view().innerHTML = `<div class="empty">${ham("sad")}<p>Nepodařilo se načíst látku. Zkus obnovit stránku.</p></div>`; return; }
  if (!SYNC.pin()) await lockScreen(); else await SYNC.run();
  window.addEventListener("hashchange", render);
  render();
  if ("serviceWorker" in navigator && location.protocol === "https:") { try { navigator.serviceWorker.register("sw.js"); } catch (e) { } }
})();
