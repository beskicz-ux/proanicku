/* Halíř — studijní parťák pro 1MT300 Měnová teorie a politika.
   Learning engine: retrieval practice (kvízy, kartičky), spaced repetition (SRS), interleaving (mix),
   self-explanation (Vysvětli Halířovi), worked examples (příklady krok za krokem), dual coding (grafy). */

/* ===== NASTAVENÍ ===== */
const AGENT_ID = "agent_4601m6ett2qefv7vzde4710n5656";            // ElevenLabs Conversational AI agent id (Halíř hlas). Prázdné = jen offline vyhledávání v poznámkách.
const DEFAULT_EXAM_DAYS = 14;
const EXAM_DATE = "2026-11-16";  // zkouška 1MT300
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
  return { v: 1, examDate: EXAM_DATE > t ? EXAM_DATE : addDays(t, DEFAULT_EXAM_DAYS), start: t, cards: {}, q: {}, read: {}, xp: {}, goal: 150, sound: true,
    feyn: {}, lists: {}, done: {}, exams: [], planFor: null, onlyRead: false };
}
let S = (() => { try { return Object.assign(defaults(), JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) { return defaults(); } })();
function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { } }
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
  info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
};

/* ---------- Halíř (křeček) ---------- */
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
<text x="100" y="155" text-anchor="middle" font-family="Georgia,serif" font-size="20" font-weight="700" fill="#8a5a17">h</text>
<ellipse cx="80" cy="148" rx="10" ry="8" fill="#f6c99a"/><ellipse cx="120" cy="148" rx="10" ry="8" fill="#f6c99a"/>
<ellipse cx="74" cy="183" rx="14" ry="7" fill="#f6c99a"/><ellipse cx="126" cy="183" rx="14" ry="7" fill="#f6c99a"/>
<g transform="rotate(-8 100 34)"><path d="M58 30l42-18 42 18-42 17z" fill="#d9475f"/><path d="M75 37v12q25 11 50 0V37l-25 10z" fill="#a82e45"/><path d="M142 30v22" stroke="#f4cf96" stroke-width="3"/><circle cx="142" cy="54" r="4.5" fill="#f4cf96"/></g>
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
  const cols = ["#ff8fa8", "#f4cf96", "#8fd6a8", "#fff6ef", "#d9475f"];
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

/* ---------- plan ---------- */
const DAYTYPE = {
  learn: { tag: "learn", name: "Nová látka" },
  mix: { tag: "mix", name: "Prokládaný mix" },
  weak: { tag: "mix", name: "Slabá místa" },
  exam: { tag: "exam", name: "Simulace zkoušky" },
  final: { tag: "exam", name: "Poslední den" },
};
function buildPlan(fromDate, n, unread) {
  const days = [];
  if (n <= 0) return days;
  // posledních ~5 dní před zkouškou = jen opakování a simulace, nová látka musí být hotová dřív
  const review = n >= 9 ? 5 : Math.max(1, Math.floor(n * .4));
  let learnDays = unread.length ? Math.min(unread.length, Math.max(1, n - review)) : 0;
  if (n <= 2 && unread.length) learnDays = n;
  let k = 0, j = 0;
  const cyc = ["mix", "exam", "weak", "exam", "mix", "weak"];
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
function plan() {
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
  const p = plan()[0]; const dt = doneToday(); const list = [];
  const due = dueIds().length; const anyCards = Object.keys(S.cards).length > 0;
  const readIds = lectures().map(l => l.id).filter(id => sectionsRead(id) > 0);
  if (anyCards) list.push({ k: "review", ico: ic.cards, t: "Opakování kartiček", s: due ? `${due} ${plural(due, "kartička čeká", "kartičky čekají", "kartiček čeká")}` : "Na dnešek vše zopakováno", href: "#/karty", done: due === 0 });
  if (!p) return list;
  if (p.type === "learn") {
    for (const id of p.ids) list.push({ k: "learn", ico: ic.book, t: `Nauč se ${id}: ${LEC[id].title}`, s: `${LEC[id].sections.length} částí · čtení + rychlé kontroly + kartičky`, href: `#/uc/${id}`, done: lectureRead(id) });
    if (readIds.length) list.push({ k: "quiz", ico: ic.bolt, t: "Mini mix kvíz", s: "10 otázek napříč probranou látkou", href: "#/kviz?mix=1&n=10&m=quiz", done: (dt.quiz || 0) >= 1 });
  } else if (p.type === "mix" || p.type === "final") {
    list.push({ k: "quiz", ico: ic.bolt, t: "Prokládaný kvíz", s: "20 otázek ze všech lekcí najednou", href: "#/kviz?mix=1&n=20&m=quiz", done: (dt.quiz || 0) >= 1 });
    list.push({ k: "explain", ico: ic.brain, t: "Vysvětli Halířovi", s: "2 zkouškové otázky vlastními slovy", href: "#/otazky?pick=1", done: (dt.explain || 0) >= 2 });
    if (p.type === "final") {
      list.push({ k: "weak", ico: ic.target, t: "Slabá místa", s: "Jen to, co ti ještě nejde", href: "#/kviz?weak=1&n=20&m=weak", done: !!dt.weak });
      list.push({ k: "tahak", ico: ic.book, t: "Tahák: projeď celý kurz", s: "Velký obraz, vzorce a seznamy všech 12 přednášek", href: "#/tahak", done: !!dt.tahak });
    }
  } else if (p.type === "weak") {
    list.push({ k: "weak", ico: ic.target, t: "Slabá místa", s: "Otázky a kartičky, kde chybuješ", href: "#/kviz?weak=1&n=20&m=weak", done: !!dt.weak });
    list.push({ k: "lists", ico: ic.list, t: "Vyjmenuj to", s: "3 seznamy, které se na zkoušce vyjmenovávají", href: "#/seznamy?pick=1", done: (dt.lists || 0) >= 3 });
  } else if (p.type === "exam") {
    list.push({ k: "exam", ico: ic.trophy, t: "Simulace zkoušky", s: "24 otázek na čas + 2 otevřené", href: "#/zkouska", done: !!dt.exam });
    list.push({ k: "explain", ico: ic.brain, t: "Rozbor: vysvětli Halířovi", s: "2 otázky z lekcí, kde jsi chybovala", href: "#/otazky?pick=1", done: (dt.explain || 0) >= 2 });
  }
  return list;
}

/* ---------- router ---------- */
let SESSION = null;
function nav(h) { if (location.hash === h) render(); else location.hash = h; }
function route() {
  const h = location.hash.slice(1) || "/";
  const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean), q: new URLSearchParams(qs || "") };
}
function setNav(k) { $$(".nav a").forEach(a => a.classList.toggle("on", a.dataset.k === k)); }
function topbar(back = null, right = "") {
  const st = streak();
  return `<div class="topbar">${back ? `<button class="back" data-back="${esc(back)}">${ic.left}<span>Zpět</span></button>` :
    `<a class="brand" href="#/">${ham("happy")}<b>Halíř</b></a>`}<div class="sp"></div>${right}
    <span class="pill" title="Dny v řadě" style="color:var(--rose)">${ic.flame}${st}</span></div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-back]"); if (b) { e.preventDefault(); history.length > 1 ? history.back() : nav(b.dataset.back); }
});

async function render() {
  document.querySelectorAll(".feedback").forEach(f => f.remove());
  const { parts, q } = route();
  const r = parts[0] || "";
  if (r !== "halir") tutorStop();
  window.onkeydown = null;
  const map = {
    "": viewToday, mapa: viewMap, lekce: viewLecture, uc: viewLearn, karty: viewCards, kviz: viewQuiz, zkouska: viewExam,
    otazky: viewQuestions, otazka: viewFeynman, seznamy: viewLists, priklady: viewProblems, grafy: viewGraphs,
    halir: viewTutor, plan: viewPlan, jak: viewScience, hledat: viewSearch, tahak: viewCheat,
  };
  setNav({ "": "dnes", mapa: "mapa", lekce: "mapa", uc: "mapa", karty: "karty", kviz: "dnes", halir: "halir", plan: "plan", jak: "plan" }[r] || "");
  (map[r] || viewToday)(parts, q);
  window.scrollTo(0, 0);
}

/* =================================================================== */
/* DNES                                                                 */
/* =================================================================== */
function viewToday() {
  const n = daysToExam(); const ms = missions(); const xp = xpToday();
  const pct = Math.min(100, Math.round(xp / S.goal * 100));
  const next = ms.find(m => !m.done);
  const greet = n > 0 ? pick(SAY.hello) : n === 0 ? "Dneska je to tady! Dýchej, věříš si, umíš to." : "Zkouška je za námi. Jsem na tebe pyšný!";
  view().innerHTML = `${topbar()}
  <div class="hero">${ham("happy", "idle")}<div class="bubble"><span class="hand">${n > 0 ? `zbývá ${n} ${plural(n, "den", "dny", "dní")}` : "Halíř říká"}</span>${esc(greet)}</div></div>
  <div class="stats">
    <div class="stat countdown"><b>${Math.max(0, n)}</b><span>${plural(Math.max(0, n), "den", "dny", "dní")} do zkoušky</span></div>
    <div class="stat streak"><b>${streak()}</b><span>dní v řadě</span></div>
    <div class="stat"><b>${Math.round(overall() * 100)}%</b><span>umíš celkem</span></div>
  </div>
  <div class="card" style="margin-top:12px"><div class="row"><div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
    <div style="flex:1"><b>Dnešní líčka</b><p class="muted small">${xp} / ${S.goal} XP · ${pct >= 100 ? "Cíl splněn, Halíř tančí!" : "Každá správná odpověď = oříšek do tváře."}</p></div></div></div>
  <div class="sec-title"><h2>Dnešní mise</h2><a class="link small" href="#/plan">celý plán</a></div>
  <div class="stack">${ms.length ? ms.map(m => `<a class="mission ${m.done ? "done" : ""} ${m === next ? "next" : ""}" href="${m.href}">
      <div class="ico">${m.done ? ic.check : m.ico}</div><div class="txt"><b>${esc(m.t)}</b><span>${esc(m.s)}</span></div><div class="go">${ic.right}</div></a>`).join("")
      : `<div class="card empty">Na dnešek nic — zkouška už proběhla. ♡</div>`}</div>
  ${next ? `<a class="btn block" style="margin-top:16px" href="${next.href}">${ic.play} Pokračovat: ${esc(next.t)}</a>` : ms.length ? `<p class="hand" style="text-align:center;margin-top:18px">Všechny mise hotové! Zítra pokračujem ♡</p>` : ""}
  <div class="sec-title"><h2>Rychlé trénování</h2></div>
  <div class="grid2">
    <a class="mission" href="#/kviz?mix=1&n=10"><div class="ico">${ic.bolt}</div><div class="txt"><b>Kvíz</b><span>10 otázek mix</span></div></a>
    <a class="mission" href="#/zkouska"><div class="ico">${ic.trophy}</div><div class="txt"><b>Zkouška</b><span>simulace</span></div></a>
    <a class="mission" href="#/otazky"><div class="ico">${ic.brain}</div><div class="txt"><b>Vysvětli</b><span>otevřené otázky</span></div></a>
    <a class="mission" href="#/grafy"><div class="ico">${ic.graph}</div><div class="txt"><b>Grafy</b><span>IS · MP · AD–AS</span></div></a>
    <a class="mission" href="#/seznamy"><div class="ico">${ic.list}</div><div class="txt"><b>Vyjmenuj</b><span>seznamy</span></div></a>
    <a class="mission" href="#/hledat"><div class="ico">${ic.search}</div><div class="txt"><b>Hledat</b><span>pojem v látce</span></div></a>
  </div>
  <p class="small dim" style="text-align:center;margin-top:22px"><a class="link" href="#/jak">Proč se takhle učíme?</a></p>`;
}

/* =================================================================== */
/* MAPA                                                                 */
/* =================================================================== */
function viewMap() {
  const tIds = (plan()[0] || {}).ids || [];
  view().innerHTML = `${topbar()}<h1>Cesta kurzem</h1><p class="muted" style="margin-top:6px">12 přednášek, 6 zastávek. Kroužek kolem lekce = jak moc ji umíš.</p>
  ${C.units.map((u, i) => `<div class="unit"><div class="unit-head"><span class="num">${i + 1}</span><b>${esc(u.title)}</b></div>
    <div class="path">${u.ids.map(id => {
      const l = LEC[id]; const m = Math.round(mastery(id) * 100); const rd = sectionsRead(id);
      const cls = lectureRead(id) && m >= 75 ? "done" : rd === 0 ? "fresh" : "";
      return `<a class="node ${cls} ${tIds.includes(id) ? "today" : ""}" href="#/lekce/${id}"><div class="disc" style="--p:${m}"><span>${id}</span></div>
        <div class="meta"><b>${esc(l.title)}</b><span>${rd}/${l.sections.length} přečteno · ${m}% upevněno</span></div></a>`;
    }).join("")}</div></div>`).join("")}`;
}

/* =================================================================== */
/* LEKCE                                                                */
/* =================================================================== */
const TABS = [["vyklad", "Výklad"], ["pojmy", "Pojmy"], ["vzorce", "Vzorce"], ["seznamy", "Seznamy"], ["priklady", "Příklady"], ["otazky", "Otázky"], ["grafy", "Grafy"], ["triky", "Triky"]];
function viewLecture(parts, q) {
  const id = parts[1]; const l = LEC[id]; if (!l) return nav("#/mapa");
  const tab = q.get("tab") || "vyklad";
  const tabs = TABS.filter(([k]) => k === "vyklad" || k === "pojmy" || k === "otazky" || k === "triky" ||
    (k === "vzorce" && l.formulas?.length) || (k === "seznamy" && l.lists?.length) || (k === "priklady" && l.problems?.length) || (k === "grafy" && l.graphs?.length));
  const rd = sectionsRead(id), m = Math.round(mastery(id) * 100), qa = quizAcc(id);
  const newCount = lecCards(id).filter(c => !S.cards[c]).length;
  const dueC = lecCards(id).filter(isDue).length;
  let cta;
  if (!lectureRead(id)) cta = `<a class="btn block" href="#/uc/${id}">${ic.play} ${rd ? "Pokračovat v učení" : "Nauč se lekci"}</a>`;
  else cta = `<div class="grid2"><a class="btn" href="#/karty?l=${id}">${ic.cards} Kartičky${dueC + newCount ? ` (${dueC + newCount})` : ""}</a><a class="btn candle" href="#/kviz?l=${id}&n=12">${ic.bolt} Kvíz</a></div>`;
  view().innerHTML = `${topbar("#/mapa")}
  <p class="hand">${esc(unitOf(id)?.title || "")} · přednáška ${id}</p><h1 style="margin-top:4px">${esc(l.title)}</h1>
  <p class="muted" style="margin-top:6px">${esc(l.tagline)}</p>
  <div class="card" style="margin-top:14px"><div class="stack" style="gap:8px">
    <div class="row small"><span style="width:90px">Přečteno</span><div class="bar" style="flex:1"><i style="width:${rd / l.sections.length * 100}%"></i></div><b>${rd}/${l.sections.length}</b></div>
    <div class="row small"><span style="width:90px">Upevněno</span><div class="bar candle" style="flex:1"><i style="width:${m}%"></i></div><b>${m}%</b></div>
    <div class="row small"><span style="width:90px">Kvízy</span><div class="bar ok" style="flex:1"><i style="width:${qa == null ? 0 : qa * 100}%"></i></div><b>${qa == null ? "–" : Math.round(qa * 100) + "%"}</b></div>
  </div><div style="margin-top:14px">${cta}</div></div>
  <div class="tabs" style="margin-top:16px">${tabs.map(([k, n]) => `<button class="tab ${k === tab ? "on" : ""}" data-tab="${k}">${n}</button>`).join("")}</div>
  <div id="tabc"></div>`;
  $$(".tab").forEach(b => b.onclick = () => { history.replaceState(null, "", `#/lekce/${id}?tab=${b.dataset.tab}`); viewLecture(parts, new URLSearchParams("tab=" + b.dataset.tab)); });
  $("#tabc").innerHTML = lectureTab(l, tab);
  bindAsk();
}
function askBtn(text, ctx) { return `<button class="btn ghost sm" data-ask="${esc(text)}" data-ctx="${esc(ctx)}">${ham("open")} Nerozumím — zeptej se Halíře</button>`; }
function bindAsk() {
  $$("[data-ask]").forEach(b => b.onclick = () => nav(`#/halir?ctx=${encodeURIComponent(b.dataset.ctx)}&q=${encodeURIComponent(b.dataset.ask)}`));
}
function sectionSheet(s, withAsk = true) {
  const l = LEC[s.lec];
  return `<div class="sheet"><div class="slides">Snímky ${esc((s.slides || []).join(", "))}</div><h3>${esc(s.title)}</h3>
    <div class="md">${md(s.body)}</div>
    ${s.analogy ? `<div class="analogy"><b>Představ si to takhle</b>${mdi(s.analogy)}</div>` : ""}
    ${s.halir ? `<div class="aside">${ham("happy")}<p>${esc(s.halir)}</p></div>` : ""}
    ${withAsk ? `<div class="sheet-actions">${askBtn(`Vysvětli mi jednoduše a s příkladem: ${s.title}`, `${l.id} ${l.title} – ${s.title}`)}</div>` : ""}</div>`;
}
function lectureTab(l, tab) {
  if (tab === "vyklad") return `<div class="card dark" style="margin-bottom:14px"><p class="hand">Velký obraz</p><div class="md" style="margin-top:6px">${md(l.bigPicture)}</div>
     ${l.literature ? `<p class="small dim" style="margin-top:8px">Literatura: ${esc(l.literature)}</p>` : ""}</div>` + l.sections.map(s => sectionSheet(s)).join("");
  if (tab === "pojmy") return `<div class="card dark">${l.keyTerms.map(t => `<div class="term"><b>${mdi(t.term)}</b><p class="md">${mdi(t.def)}</p></div>`).join("")}</div>`;
  if (tab === "vzorce") return l.formulas.map(f => `<div class="formula dark"><b>${esc(f.name)}</b><div class="f">${md("$$" + f.tex + "$$")}</div><div class="md small">${md(f.meaning)}</div></div>`).join("");
  if (tab === "seznamy") return `<a class="btn block" href="#/seznamy?l=${l.id}" style="margin-bottom:12px">${ic.list} Procvič vyjmenování</a>` +
    l.lists.map(x => `<div class="card dark"><b>${esc(x.title)}</b><${x.ordered ? "ol" : "ul"} class="md" style="margin-top:6px">${x.items.map(i => `<li>${mdi(i)}</li>`).join("")}</${x.ordered ? "ol" : "ul"}></div>`).join("");
  if (tab === "priklady") return `<a class="btn block" href="#/priklady/${l.id}" style="margin-bottom:12px">${ic.calc} Počítej krok za krokem</a>` +
    l.problems.map((p, i) => `<div class="card dark"><b>Příklad ${i + 1}</b><div class="md">${md(p.q)}</div></div>`).join("");
  if (tab === "otazky") return `<p class="muted small" style="margin-bottom:10px">Otevřené otázky jako u zkoušky. Nejdřív odpověz sama (nahlas nebo písemně), pak porovnej s klíčovými body — tím se to naučíš nejlíp.</p>` +
    l.examQuestions.map(e => { const f = S.feyn[e.id]; return `<a class="hit" href="#/otazka/${e.id}"><b>${mdi(e.q)}</b><span>${f ? `Naposledy ${Math.round(f.score * 100)} % klíčových bodů` : "Ještě nezkoušeno"}</span></a>`; }).join("");
  if (tab === "grafy") return `<a class="btn block" href="#/grafy" style="margin-bottom:12px">${ic.graph} Otevřít grafickou laboratoř</a>` +
    l.graphs.map(g => `<div class="card dark"><b>${esc(g.title)}</b><p class="small dim">Snímek ${esc(g.slide)} · osa x: ${esc(g.x)} · osa y: ${esc(g.y)}${g.curves?.length ? " · křivky: " + esc(g.curves.join(", ")) : ""}</p><div class="md" style="margin-top:6px">${md(g.story)}</div></div>`).join("");
  if (tab === "triky") return `${(l.mnemonics || []).length ? `<h3 style="margin:4px 0 10px">Oslí můstky</h3>` + l.mnemonics.map(m => `<div class="tip"><span class="k">✦</span><div><b>${mdi(m.for)}</b><div class="md small">${md(m.trick)}</div></div></div>`).join("") : ""}
    ${(l.pitfalls || []).length ? `<h3 style="margin:18px 0 10px">Na co si dát pozor</h3>` + l.pitfalls.map(p => `<div class="tip"><span class="k">!</span><div class="md small">${md(p)}</div></div>`).join("") : ""}
    ${(l.connections || []).length ? `<h3 style="margin:18px 0 10px">Souvislosti</h3>` + l.connections.map(c => `<a class="hit" href="#/lekce/${c.to}"><b>→ ${esc(c.to)} ${esc(LEC[c.to]?.title || "")}</b><span>${mdi(c.how)}</span></a>`).join("") : ""}`;
  return "";
}

/* =================================================================== */
/* UČENÍ LEKCE (čti → hned si vyzkoušej)                                */
/* =================================================================== */
function viewLearn(parts) {
  const id = parts[1]; const l = LEC[id]; if (!l) return nav("#/mapa");
  if (!SESSION || SESSION.kind !== "learn" || SESSION.id !== id) {
    const first = l.sections.findIndex(s => !S.read[s.id]);
    SESSION = { kind: "learn", id, si: first < 0 ? 0 : first, phase: "read" };
  }
  const st = SESSION; const s = l.sections[st.si];
  const prog = (st.si + (st.phase === "check" ? .5 : 0)) / l.sections.length * 100;
  const head = `<div class="session-top"><button class="x" data-back="#/lekce/${id}">${ic.x}</button><div class="bar"><i style="width:${prog}%"></i></div><span class="small muted">${st.si + 1}/${l.sections.length}</span></div>`;
  if (st.phase === "read") {
    view().innerHTML = `${head}<p class="hand">${esc(id)} · část ${st.si + 1}</p>
      ${st.si === 0 ? `<div class="hero" style="margin:6px 0 10px">${ham("happy", "idle")}<div class="bubble">${esc(l.halirIntro || "Jdeme na to!")}</div></div>` : ""}
      ${sectionSheet(s)}
      <p class="small dim" style="margin:14px 2px">Tip: čti pomalu a u každého odstavce si v duchu řekni „proč?“. Pak tě hned vyzkouším.</p>
      <button class="btn block" id="goCheck">Přečteno — vyzkoušej mě ${ic.right}</button>`;
    bindAsk();
    $("#goCheck").onclick = () => {
      const pool = Object.values(QZ).filter(x => x.lec === id && x.section === s.id);
      const unseen = pool.filter(x => !S.q[x.id]);
      st.checks = shuffle(unseen.length >= 2 ? unseen : pool).slice(0, pool.length > 3 ? 3 : pool.length);
      st.ci = 0;
      if (!st.checks.length) return finishSection();
      st.phase = "check"; render();
    };
  } else {
    const item = st.checks[st.ci];
    view().innerHTML = `${head}<p class="hand" style="margin-bottom:8px">Rychlá kontrola ${st.ci + 1}/${st.checks.length}</p><div id="qbox"></div>`;
    renderQuestion($("#qbox"), item, () => { st.ci++; if (st.ci >= st.checks.length) finishSection(); else render(); });
  }
  function finishSection() {
    if (!S.read[s.id]) { S.read[s.id] = Date.now(); addXP(15); }
    // karty z této části vstupují do opakování
    l.flashcards.filter(c => c.section === s.id && !S.cards[c.id]).forEach(c => { S.cards[c.id] = { reps: 0, ease: 2.4, ivl: 0, lapses: 0, due: Date.now() }; });
    save();
    if (st.si + 1 < l.sections.length) { st.si++; st.phase = "read"; render(); }
    else {
      l.flashcards.filter(c => !S.cards[c.id]).forEach(c => { S.cards[c.id] = { reps: 0, ease: 2.4, ivl: 0, lapses: 0, due: Date.now() }; });
      save(); SESSION = null; sfx.done(); confetti();
      const nNew = lecCards(id).filter(isDue).length;
      view().innerHTML = `<div class="done-screen">${ham("happy", "bounce")}<p class="hand" style="margin-top:8px">${pick(SAY.done)}</p>
        <h1 style="margin-top:6px">${esc(l.title)} přečteno!</h1>
        <p class="muted" style="margin:10px auto 22px;max-width:30ch">Teď to nejdůležitější: vybavování. ${nNew} kartiček z této lekce čeká — dokud je to čerstvé.</p>
        <a class="btn block" href="#/karty?l=${id}">${ic.cards} Kartičky z ${id}</a>
        <a class="btn ghost block" style="margin-top:10px" href="#/">Zpět na dnešek</a></div>`;
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
  let html = `<div class="qcard"><div class="lbl">${esc(item.lec)} · ${item.t === "tf" ? "pravda, nebo ne?" : "vyber odpověď"}</div>`;
  if (item.t === "tf") {
    html += `<div class="q">${mdi(item.s)}</div><div class="tf"><button class="opt" data-v="1"><span class="k">✓</span>Pravda</button><button class="opt" data-v="0"><span class="k">✗</span>Nepravda</button></div>`;
  } else {
    const order = item._order || (item._order = shuffle(item.options.map((_, i) => i)));
    html += `<div class="q">${mdi(item.q)}</div><div class="opts">${order.map((oi, k) => `<button class="opt" data-v="${oi}"><span class="k">${L[k]}</span><span>${mdi(item.options[oi])}</span></button>`).join("")}</div>`;
  }
  html += `</div>`;
  box.innerHTML = html;
  const hamEl = document.querySelector(".hero .ham");
  const answer = v => {
    const correct = item.t === "tf" ? (v === 1) === !!item.true : v === item.correct;
    $$(".opt", box).forEach(b => {
      b.disabled = true; const bv = +b.dataset.v;
      const isRight = item.t === "tf" ? (bv === 1) === !!item.true : bv === item.correct;
      if (!exam) { if (isRight) b.classList.add("right"); else if (bv === v) b.classList.add("wrong"); }
      else if (bv === v) b.style.borderColor = "var(--candle)";
    });
    if (exam) { onNext(correct, v); return; }
    recordQ(item, correct);
    correct ? sfx.right() : sfx.wrong();
    hamReact(hamEl, correct ? "happy" : "sad");
    const fb = document.createElement("div");
    fb.className = "feedback " + (correct ? "good" : "badf");
    fb.innerHTML = `<div class="in"><h3>${correct ? ic.check : ic.x} ${esc(pick(correct ? SAY.right : SAY.wrong))}</h3>
      <div class="md">${md(item.explain || "")}</div>
      <div class="row"><button class="btn ${correct ? "ok" : "bad"}" style="flex:1" id="fbNext">Pokračovat</button>
      ${!correct ? `<button class="btn ghost" id="fbAsk" title="Zeptej se Halíře">${ham("open")}</button>` : ""}</div></div>`;
    document.body.appendChild(fb);
    const go = () => { fb.remove(); window.onkeydown = null; onNext(correct); };
    $("#fbNext", fb).onclick = go;
    const ask = $("#fbAsk", fb);
    if (ask) ask.onclick = () => { fb.remove(); const qt = item.t === "tf" ? item.s : item.q; nav(`#/halir?ctx=${encodeURIComponent(item.lec + " " + LEC[item.lec].title)}&q=${encodeURIComponent("Proč je to takhle? Otázka: " + qt + " Vysvětli mi to jednoduše.")}`); };
    setTimeout(() => window.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }, 200);
  };
  $$(".opt", box).forEach(b => b.onclick = () => answer(+b.dataset.v));
  window.onkeydown = e => {
    const k = e.key.toUpperCase(); const btns = $$(".opt", box);
    const i = L.indexOf(k) >= 0 ? L.indexOf(k) : ["1", "2", "3", "4"].indexOf(e.key);
    if (i >= 0 && btns[i] && !btns[i].disabled) { window.onkeydown = null; btns[i].click(); }
  };
}

/* =================================================================== */
/* KVÍZ                                                                 */
/* =================================================================== */
function quizPool(q) {
  const all = Object.values(QZ);
  const l = q.get("l");
  if (l) return all.filter(x => x.lec === l);
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
    let items = prioritize(quizPool(q), n);
    if (!q.get("l")) items = interleave(items);
    items.forEach(i => delete i._order);
    SESSION = { kind: "quiz", key, items, i: 0, ok: 0, total: items.length, retried: new Set(), m: q.get("m"), title: q.get("l") ? `Kvíz ${q.get("l")}` : q.get("weak") ? "Slabá místa" : "Mix kvíz" };
  }
  const st = SESSION;
  if (!st.items.length) { view().innerHTML = `${topbar("#/")}<div class="empty">${ham("sad")}<p style="margin-top:10px">Tady zatím nic není. ${q.get("weak") ? "Žádná slabá místa — nebo jsi ještě nic nezkoušela." : ""}</p><a class="btn" href="#/" style="margin-top:14px">Zpět</a></div>`; return; }
  if (st.i >= st.items.length) return quizDone(st);
  const item = st.items[st.i];
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/">${ic.x}</button><div class="bar"><i style="width:${st.i / st.items.length * 100}%"></i></div><span class="small muted">${st.ok}✓</span></div>
    <div class="hero" style="margin:0 0 4px">${ham("open")}<div class="bubble" style="margin-bottom:14px">${esc(st.title)} · otázka ${Math.min(st.i + 1, st.total)}${st.i >= st.total ? " (oprava)" : ""}</div></div><div id="qbox"></div>`;
  renderQuestion($("#qbox"), item, ok => {
    if (st.i < st.total && ok) st.ok++;
    if (!ok && !st.retried.has(item.id)) { st.retried.add(item.id); delete item._order; st.items.push(item); }
    st.i++; render();
  });
}
function quizDone(st) {
  const pct = Math.round(st.ok / st.total * 100);
  const dt = doneToday(); if (st.m === "weak") dt.weak = 1; else dt.quiz = (dt.quiz || 0) + 1; save();
  sfx.done(); if (pct >= 70) confetti();
  SESSION = null;
  view().innerHTML = `<div class="done-screen">${ham(pct >= 60 ? "happy" : "open", "bounce")}<p class="hand">${pct >= 80 ? "Tohle byla jízda!" : pct >= 50 ? "Dobrá práce, chyby si zopakujeme." : "Nevadí — právě jsi našla, co se doučit."}</p>
    <div class="big-num" style="margin-top:8px">${pct}%</div><p class="muted">${st.ok} z ${st.total} napoprvé správně</p>
    <div class="stack" style="margin-top:22px"><a class="btn block" href="#/">Zpět na dnešek</a><a class="btn ghost block" href="#/kviz?mix=1&n=10&r=${Date.now()}">Další kolo</a></div></div>`;
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
    SESSION = { kind: "cards", key, queue: ids, total: ids.length, done: 0, g: [0, 0, 0, 0] };
  }
  const st = SESSION;
  if (!st.queue.length) {
    if (st.done) return cardsDone(st);
    const next = Object.values(S.cards).filter(s => s.due > Date.now()).sort((a, b) => a.due - b.due)[0];
    view().innerHTML = `${topbar("#/")}<div class="done-screen">${ham("happy", "idle")}<h2 style="margin-top:8px">Nic k opakování</h2>
      <p class="muted" style="margin:8px auto 18px;max-width:32ch">${Object.keys(S.cards).length ? `Všechno zopakováno! Další kartičky dozrají ${next ? (sod(next.due) <= sod(Date.now()) ? "ještě dnes" : "zítra nebo později") : "později"}.` : "Kartičky se odemykají, jak čteš lekce. Začni první lekcí na mapě."}</p>
      <a class="btn" href="#/mapa">${ic.map} Na mapu</a></div>`;
    return;
  }
  const id = st.queue[0]; const c = CARD[id]; const s = S.cards[id] || {};
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/">${ic.x}</button><div class="bar candle"><i style="width:${st.done / Math.max(1, st.done + st.queue.length) * 100}%"></i></div><span class="small muted">${st.queue.length}</span></div>
    <div class="flash"><div class="face" id="face"><div class="lbl"><span>${esc(c.lec)} · ${esc(c.type || "kartička")}</span><span>${s.reps ? "opakování" : "nová"}</span></div>
      <div class="q">${mdi(c.q)}</div>
      <div id="recall"><button class="link small" id="typeIt">✎ napiš si odpověď (pomáhá)</button></div>
      <div class="a" id="ans" hidden><div class="md">${md(c.a)}</div></div>
      <div style="flex:1"></div></div></div>
    <div id="ctrl"><button class="btn block" id="reveal" style="margin-top:16px">Ukázat odpověď</button>
    <p class="small dim" style="text-align:center;margin-top:10px">Nejdřív si odpověď opravdu vybav — nahlas nebo v hlavě. Až pak otoč.</p></div>`;
  $("#typeIt").onclick = () => { $("#recall").innerHTML = `<textarea class="recall-input" placeholder="Tvoje odpověď…"></textarea>`; $(".recall-input").focus(); };
  const reveal = () => {
    sfx.flip(); $("#ans").hidden = false; $("#face").classList.add("reveal");
    $("#ctrl").innerHTML = `<div class="grades">
      <button class="btn bad" data-g="0">Nevěděla<small>znovu</small></button>
      <button class="btn ghost" data-g="1">Těžké<small>${s.reps ? "brzy" : "za chvíli"}</small></button>
      <button class="btn ok" data-g="2">Věděla<small>${s.reps ? "později" : "zítra"}</small></button>
      <button class="btn candle" data-g="3">Hračka<small>za dlouho</small></button></div>
      <div style="text-align:center;margin-top:12px">${askBtn(`Vysvětli mi to: ${c.q} (odpověď: ${c.a})`, `${c.lec} ${LEC[c.lec].title}`)}</div>`;
    bindAsk();
    $$("[data-g]").forEach(b => b.onclick = () => doGrade(+b.dataset.g));
    window.onkeydown = e => { if ("1234".includes(e.key)) doGrade(+e.key - 1); };
  };
  const doGrade = g => {
    window.onkeydown = null;
    const ns = grade(id, g); st.g[g]++; st.queue.shift();
    addXP(g >= 2 ? 5 : 2);
    if (ns.due <= Date.now() + 15 * 60e3) st.queue.splice(Math.min(st.queue.length, 3 + Math.floor(Math.random() * 3)), 0, id);
    else st.done++;
    render();
  };
  $("#reveal").onclick = reveal;
  window.onkeydown = e => { if (e.key === " " || e.key === "Enter") { if (document.activeElement?.tagName === "TEXTAREA") return; e.preventDefault(); reveal(); } };
}
function cardsDone(st) {
  sfx.done(); confetti(); SESSION = null;
  view().innerHTML = `<div class="done-screen">${ham("happy", "bounce")}<p class="hand">${pick(SAY.done)}</p><div class="big-num" style="margin-top:8px">${st.done}</div>
    <p class="muted">${plural(st.done, "kartička upevněna", "kartičky upevněny", "kartiček upevněno")}</p>
    <p class="small dim" style="margin-top:10px">Nevěděla ${st.g[0]}× · Těžké ${st.g[1]}× · Věděla ${st.g[2]}× · Hračka ${st.g[3]}×</p>
    <a class="btn block" style="margin-top:22px" href="#/">Zpět na dnešek</a></div>`;
}

/* =================================================================== */
/* SIMULACE ZKOUŠKY                                                     */
/* =================================================================== */
function viewExam(parts, q) {
  if (!SESSION || SESSION.kind !== "exam") {
    view().innerHTML = `${topbar("#/")}<div class="hero">${ham("open", "idle")}<div class="bubble"><span class="hand">simulace zkoušky</span>24 otázek ze všech přednášek, bez nápověd. Výsledky a vysvětlení až na konci. Pak 2 otevřené otázky.</div></div>
      <div class="card"><label class="check" style="margin:0"><input type="checkbox" id="onlyRead" ${S.onlyRead ? "checked" : ""}><span>Jen z lekcí, které už mám přečtené</span></label></div>
      <button class="btn block" id="startExam" style="margin-top:16px">${ic.play} Začít</button>`;
    $("#startExam").onclick = () => {
      S.onlyRead = $("#onlyRead").checked; save();
      let ls = lectures().map(l => l.id); if (S.onlyRead) { const r = ls.filter(id => sectionsRead(id) > 0); if (r.length) ls = r; }
      const per = Math.max(2, Math.ceil(24 / ls.length));
      let items = [];
      for (const id of ls) items.push(...prioritize(Object.values(QZ).filter(x => x.lec === id), per));
      items = shuffle(items).slice(0, 24); items.forEach(i => delete i._order);
      const open = shuffle(Object.values(EXQ).filter(e => ls.includes(e.lec))).slice(0, 2);
      SESSION = { kind: "exam", items, i: 0, ans: [], open, t0: Date.now() };
      render();
    };
    return;
  }
  const st = SESSION;
  if (st.i >= st.items.length) return examDone(st);
  const item = st.items[st.i];
  const el = Math.floor((Date.now() - st.t0) / 1000);
  view().innerHTML = `<div class="session-top"><button class="x" id="quitExam">${ic.x}</button><div class="bar ok"><i style="width:${st.i / st.items.length * 100}%"></i></div><span class="small muted" id="clock">${Math.floor(el / 60)}:${pad(el % 60)}</span></div>
    <p class="hand" style="margin-bottom:8px">Otázka ${st.i + 1} / ${st.items.length}</p><div id="qbox"></div>`;
  $("#quitExam").onclick = () => { if (confirm("Ukončit simulaci?")) { SESSION = null; nav("#/"); } };
  clearInterval(window._clk); window._clk = setInterval(() => { const c = $("#clock"); if (!c) return clearInterval(window._clk); const e = Math.floor((Date.now() - st.t0) / 1000); c.textContent = `${Math.floor(e / 60)}:${pad(e % 60)}`; }, 1000);
  renderQuestion($("#qbox"), item, (ok, v) => { st.ans.push({ id: item.id, ok, v }); recordQ(item, ok); setTimeout(() => { st.i++; render(); }, 350); }, { exam: true });
}
function examDone(st) {
  clearInterval(window._clk);
  const ok = st.ans.filter(a => a.ok).length; const pct = Math.round(ok / st.ans.length * 100);
  const mins = Math.round((Date.now() - st.t0) / 60000);
  if (!st.saved) { S.exams.push({ ts: Date.now(), pct }); doneToday().exam = 1; save(); st.saved = 1; sfx.done(); if (pct >= 70) confetti(); }
  const byL = {}; st.ans.forEach(a => { const l = QZ[a.id].lec; byL[l] = byL[l] || [0, 0]; byL[l][1]++; if (a.ok) byL[l][0]++; });
  const wrong = st.ans.filter(a => !a.ok).map(a => QZ[a.id]);
  view().innerHTML = `${topbar("#/")}<div class="done-screen" style="padding-top:0">${ham(pct >= 60 ? "happy" : "open", "bounce")}
    <div class="big-num">${pct}%</div><p class="muted">${ok} / ${st.ans.length} správně · ${mins} min</p></div>
    <div class="card"><b>Podle přednášek</b><div class="stack" style="gap:7px;margin-top:10px">${Object.keys(byL).sort().map(l => `<div class="row small"><a href="#/lekce/${l}" style="width:34px;color:var(--ink);font-weight:700">${l}</a><div class="bar ${byL[l][0] / byL[l][1] >= .7 ? "ok" : ""}" style="flex:1"><i style="width:${byL[l][0] / byL[l][1] * 100}%"></i></div><span>${byL[l][0]}/${byL[l][1]}</span></div>`).join("")}</div></div>
    ${wrong.length ? `<div class="sec-title"><h2>Rozbor chyb</h2></div>` + wrong.map(w => `<div class="card dark"><p class="small dim">${w.lec}</p><b>${mdi(w.t === "tf" ? w.s : w.q)}</b>
      <p style="margin-top:6px;color:var(--ok)">✓ ${w.t === "tf" ? (w.true ? "Pravda" : "Nepravda") : mdi(w.options[w.correct])}</p><div class="md small" style="margin-top:6px">${md(w.explain || "")}</div></div>`).join("") : ""}
    ${st.open.length ? `<div class="sec-title"><h2>Otevřené otázky</h2></div><p class="muted small" style="margin-bottom:10px">Odpověz vlastními slovy, pak porovnej s klíčovými body.</p>` + st.open.map(e => `<a class="hit" href="#/otazka/${e.id}"><b>${mdi(e.q)}</b><span>${e.lec} · ${esc(LEC[e.lec].title)}</span></a>`).join("") : ""}
    <a class="btn block" style="margin-top:18px" href="#/">Hotovo</a>`;
  SESSION = null;
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
  view().innerHTML = `${topbar("#/")}<h1>Vysvětli Halířovi</h1><p class="muted" style="margin:6px 0 14px">Zkouškové otázky. Nejlepší způsob, jak zjistit, jestli látce rozumíš: vysvětli ji vlastními slovy, jako bys ji učila křečka.</p>
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
  view().innerHTML = `${topbar("#/otazky")}<p class="hand">${e.lec} · ${esc(LEC[e.lec].title)}</p>
    <div class="hero" style="margin-top:4px">${ham("open", "idle")}<div class="bubble">${mdi(e.q)}</div></div>
    <p class="muted small" style="margin-bottom:8px">Odpověz, jako bys to vysvětlovala mně — celými větami, s mechanismem „protože… a proto…“. Klidně nahlas přes mikrofon.</p>
    <div class="row" style="align-items:flex-end"><textarea class="answer" id="ans" placeholder="Moje odpověď…"></textarea><button class="mic" id="mic" title="Diktovat">${ic.mic}</button></div>
    <button class="btn block" id="check" style="margin-top:14px">Hotovo — porovnej s klíčovými body</button>
    <div id="res"></div>`;
  dictation($("#mic"), $("#ans"));
  $("#check").onclick = () => {
    if (REC) REC.stop();
    const a = $("#ans").value.trim();
    const kp = e.keyPoints || [];
    $("#check").hidden = true;
    $("#res").innerHTML = `<div class="sec-title"><h2>Klíčové body</h2><span class="small muted">odškrtni, co jsi řekla</span></div>
      ${kp.map((p, i) => `<label class="check ${a && keyMatch(a, p) ? "on" : ""}"><input type="checkbox" data-i="${i}" ${a && keyMatch(a, p) ? "checked" : ""}><span class="md">${mdi(p)}</span></label>`).join("")}
      <details class="card dark" style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">Vzorová odpověď</summary><div class="md" style="margin-top:8px">${md(e.answer)}</div></details>
      <div class="stack" style="margin-top:14px"><button class="btn" id="saveF">Uložit výsledek</button>
      ${a ? `<button class="btn ghost" id="sendH">${ham("open")} Ať to Halíř ohodnotí</button>` : ""}</div>`;
    $$(".check input").forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
    $("#saveF").onclick = () => {
      const got = $$(".check input:checked").length; const score = kp.length ? got / kp.length : 1;
      S.feyn[e.id] = { score, ts: Date.now() }; const dt = doneToday(); dt.explain = (dt.explain || 0) + 1; addXP(20); save();
      sfx.done(); if (score >= .7) confetti(); toast(`Uloženo: ${Math.round(score * 100)} % bodů`);
      setTimeout(() => nav(dt.explain < 2 ? "#/otazky?pick=1&r=" + Date.now() : "#/"), 900);
    };
    const sh = $("#sendH");
    if (sh) sh.onclick = () => nav(`#/halir?ctx=${encodeURIComponent(e.lec + " " + LEC[e.lec].title)}&q=${encodeURIComponent(`Ohodnoť mou odpověď na zkouškovou otázku „${e.q}“. Řekni, co chybí nebo je špatně. Moje odpověď: ${a}`)}`);
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
    SESSION = { kind: "lists", key: location.hash, items: (l ? pool : pool.sort((a, b) => sc(a) - sc(b))).slice(0, l ? 50 : 5), i: 0 };
  }
  const st = SESSION;
  if (st.i >= st.items.length || !st.items.length) { SESSION = null; view().innerHTML = `<div class="done-screen">${ham("happy", "bounce")}<h2>Vyjmenováno!</h2><a class="btn" style="margin-top:16px" href="#/">Zpět</a></div>`; return; }
  const x = st.items[st.i];
  view().innerHTML = `<div class="session-top"><button class="x" data-back="#/">${ic.x}</button><div class="bar candle"><i style="width:${st.i / st.items.length * 100}%"></i></div><span class="small muted">${st.i + 1}/${st.items.length}</span></div>
    <div class="qcard"><div class="lbl">${x.lec} · vyjmenuj (${x.items.length} ${plural(x.items.length, "položka", "položky", "položek")})${x.ordered ? " · ve správném pořadí" : ""}</div>
    <div class="q">${esc(x.title)}</div>
    <div class="row" style="align-items:flex-end"><textarea class="answer" id="ans" style="min-height:110px" placeholder="Napiš nebo řekni, co si vybavíš…"></textarea><button class="mic" id="mic">${ic.mic}</button></div>
    <button class="btn block" id="rev" style="margin-top:12px">Ukázat seznam</button><div id="items"></div></div>`;
  dictation($("#mic"), $("#ans"));
  $("#rev").onclick = () => {
    if (REC) REC.stop(); const a = $("#ans").value;
    $("#rev").remove();
    $("#items").innerHTML = `<p class="small muted" style="margin:12px 0 8px">Odškrtni, co jsi věděla:</p>` + x.items.map((it, i) => `<label class="check ${a && keyMatch(a, it) ? "on" : ""}"><input type="checkbox" ${a && keyMatch(a, it) ? "checked" : ""}><span class="md">${x.ordered ? (i + 1) + ". " : ""}${mdi(it)}</span></label>`).join("") +
      `<button class="btn block" id="nx" style="margin-top:10px">Další</button>`;
    $$(".check input").forEach(c => c.onchange = () => c.closest(".check").classList.toggle("on", c.checked));
    $("#nx").onclick = () => {
      const ok = $$(".check input:checked").length; S.lists[x.id] = { ok, n: x.items.length, ts: Date.now() };
      const dt = doneToday(); dt.lists = (dt.lists || 0) + 1; addXP(10); save(); st.i++; render();
    };
  };
}

/* =================================================================== */
/* PŘÍKLADY (worked examples, krok za krokem)                           */
/* =================================================================== */
function viewProblems(parts) {
  const l = LEC[parts[1]]; if (!l) return nav("#/mapa");
  view().innerHTML = `${topbar("#/lekce/" + l.id)}<h1>Příklady ${l.id}</h1><p class="muted" style="margin:6px 0 14px">Zkus každý krok nejdřív sama, pak si ho odkryj. Řešené příklady jsou nejrychlejší cesta, jak se naučit počítat.</p>
    ${l.problems.map((p, i) => `<div class="card dark" data-p="${i}"><p class="hand">Příklad ${i + 1}</p><div class="md">${md(p.q)}</div><div class="steps" style="margin-top:10px"></div>
      <button class="btn sm" data-step>Další krok</button></div>`).join("")}`;
  $$("[data-p]").forEach(card => {
    const p = l.problems[+card.dataset.p]; let k = 0; const box = $(".steps", card); const b = $("[data-step]", card);
    b.onclick = () => {
      if (k < p.steps.length) { box.insertAdjacentHTML("beforeend", `<div class="step md"><b>Krok ${k + 1}.</b> ${md(p.steps[k])}</div>`); k++; }
      else { box.insertAdjacentHTML("beforeend", `<div class="step" style="background:#1f3a2b"><b style="color:var(--ok)">Výsledek:</b> <span class="md">${mdi(p.result)}</span></div>`); b.remove(); addXP(8); }
      if (k === p.steps.length && b.isConnected) b.textContent = "Ukázat výsledek";
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
  view().innerHTML = `${topbar("#/")}<h1>Hledat v látce</h1><input class="search" id="sq" style="margin:14px 0" placeholder="např. repo sazba, multiplikátor, IS křivka…" value="${esc(q.get("q") || "")}"><div id="hits"></div>`;
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
function viewPlan() {
  const p = plan(); const n = daysToExam();
  view().innerHTML = `${topbar()}<h1>Plán do zkoušky</h1>
    <div class="card" style="margin-top:14px"><div class="row wrap"><label style="flex:1;min-width:160px"><b>Datum zkoušky</b><p class="small muted">Plán se podle něj sám přepočítá.</p></label><input type="date" id="ed" value="${S.examDate}" min="${today()}"></div>
    <div class="row wrap" style="margin-top:12px"><label style="flex:1;min-width:160px"><b>Denní cíl</b><p class="small muted">XP za den (≈ 1 XP = 6 s učení)</p></label>
      <select id="goal">${[80, 150, 250, 400].map(g => `<option value="${g}" ${S.goal === g ? "selected" : ""}>${g} XP${g === 80 ? " · lehký" : g === 150 ? " · normální" : g === 250 ? " · intenzivní" : " · šílený"}</option>`).join("")}</select></div>
    <div class="row wrap" style="margin-top:12px"><b style="flex:1">Zvuky</b><button class="btn ghost sm" id="snd">${ic.sound} ${S.sound ? "Zapnuto" : "Vypnuto"}</button></div></div>
    <div class="sec-title"><h2>${n > 0 ? `${n} ${plural(n, "den", "dny", "dní")}` : "Hotovo"}</h2><span class="small muted">${(() => { const last = [...p].reverse().find(d => d.type === "learn"); return last ? `nová látka hotová do ${parseD(last.date).getDate()}. ${parseD(last.date).getMonth() + 1}., pak jen opakování` : "už jen opakování a simulace"; })()}</span></div>
    <div class="card">${p.map((d, i) => {
      const dd = parseD(d.date); const ty = DAYTYPE[d.type];
      const what = d.type === "learn" ? d.ids.map(id => `<b>${id} ${esc(LEC[id].title)}</b>`).join("") + `<span>čtení + kontroly + kartičky, k tomu opakování</span>`
        : d.type === "mix" ? `<b>Prokládaný kvíz + Vysvětli Halířovi</b><span>míchání lekcí trénuje poznat, co je co</span>`
        : d.type === "weak" ? `<b>Slabá místa + vyjmenovávání</b><span>cílíme přesně na chyby</span>`
        : d.type === "exam" ? `<b>Simulace zkoušky + rozbor chyb</b><span>na čas, bez nápověd</span>`
        : `<b>Lehké opakování slabých míst</b><span>žádná nová látka, večer brzo spát (spánek ukládá paměť)</span>`;
      return `<div class="dayrow ${i === 0 ? "today" : ""}"><div class="d"><b>${dd.getDate()}.</b><span>${i === 0 ? "dnes" : DOW[dd.getDay()]}</span></div><div class="what"><span class="tag ${ty.tag}">${ty.name}</span>${what}</div></div>`;
    }).join("") || `<p class="empty">Nastav datum zkoušky.</p>`}
    <div class="dayrow"><div class="d"><b>${parseD(S.examDate).getDate()}.</b><span>${DOW[parseD(S.examDate).getDay()]}</span></div><div class="what"><span class="tag exam">Zkouška</span><b>Ty to dáš ♡</b></div></div></div>
    <div class="sec-title"><h2>Záloha</h2></div>
    <div class="card"><p class="small muted">Postup se ukládá v tomhle prohlížeči. Chceš ho přenést na jiné zařízení? Stáhni zálohu a nahraj ji tam.</p>
      <div class="row wrap" style="margin-top:10px"><button class="btn ghost sm" id="exp">Stáhnout zálohu</button><label class="btn ghost sm">Nahrát zálohu<input type="file" id="imp" accept=".json" hidden></label><button class="link small" id="rst" style="margin-left:auto;color:var(--dim)">smazat postup</button></div></div>
    <p class="small dim" style="text-align:center;margin-top:20px"><a class="link" href="#/jak">Proč se učíme takhle?</a></p>`;
  $("#ed").onchange = e => { if (e.target.value) { S.examDate = e.target.value; S.planFor = null; save(); render(); } };
  $("#goal").onchange = e => { S.goal = +e.target.value; save(); };
  $("#snd").onclick = () => { S.sound = !S.sound; save(); render(); };
  $("#exp").onclick = () => { const b = new Blob([JSON.stringify(S)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `halir-zaloha-${today()}.json`; a.click(); };
  $("#imp").onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.cards) throw 0; S = Object.assign(defaults(), d); save(); toast("Záloha nahrána ♡"); render(); } catch (err) { toast("Tohle není záloha Halíře."); } };
  $("#rst").onclick = () => { if (confirm("Opravdu smazat celý postup?")) { localStorage.removeItem(LS); S = defaults(); save(); render(); } };
}

/* =================================================================== */
/* TAHÁK — rychlý přehled celého kurzu na poslední den                 */
/* =================================================================== */
function viewCheat() {
  const dt = doneToday(); if (!dt.tahak) { dt.tahak = 1; addXP(20); save(); }
  view().innerHTML = `${topbar("#/")}<h1>Tahák celého kurzu</h1>
    <p class="muted" style="margin:6px 0 14px">Na poslední den: žádná nová látka, jen si projeď velký obraz, vzorce a seznamy. U každé přednášky si nejdřív zkus říct nahlas, o čem je — až pak čti.</p>
    ${lectures().map(l => `<details class="card dark" style="margin-bottom:10px"><summary style="cursor:pointer"><b>${l.id} · ${esc(l.title)}</b> <span class="small dim">${Math.round(mastery(l.id) * 100)} % upevněno</span></summary>
      <div class="md" style="margin-top:10px">${md(l.bigPicture)}</div>
      ${l.formulas?.length ? `<p class="hand" style="margin-top:12px">Vzorce</p>` + l.formulas.map(f => `<div class="formula"><b>${esc(f.name)}</b><div class="f">${md("$$" + f.tex + "$$")}</div></div>`).join("") : ""}
      ${l.lists?.length ? `<p class="hand" style="margin-top:12px">Vyjmenuj</p>` + l.lists.map(x => `<div style="margin:6px 0"><b class="small">${esc(x.title)}</b><div class="md small">${x.items.map(i => mdi(i)).join(" · ")}</div></div>`).join("") : ""}
      ${l.pitfalls?.length ? `<p class="hand" style="margin-top:12px">Pozor na</p><ul class="md small">${l.pitfalls.map(x => `<li>${mdi(x)}</li>`).join("")}</ul>` : ""}
      <a class="btn ghost sm" style="margin-top:10px" href="#/kviz?l=${l.id}&n=8">${ic.bolt} 8 otázek z ${l.id}</a></details>`).join("")}`;
}

/* =================================================================== */
/* JAK SE UČIT (věda)                                                   */
/* =================================================================== */
function viewScience() {
  view().innerHTML = `${topbar("#/plan")}<h1>Proč se učíme takhle</h1>
  <div class="hero" style="margin-top:10px">${ham("happy")}<div class="bubble">Přepisovat slajdy je jako nosit oříšky v ruce. Vypadá to jako práce, ale většina vypadne. Já je nosím v líčkách.</div></div>
  <div class="sheet"><div class="md science">
  <p>Velký přehled 10 studijních technik (Dunlosky a kol., 2013) zjistil, že nejlépe fungují <strong>dvě</strong>: <strong>testování se</strong> a <strong>rozložené opakování</strong>. Naopak <strong>opakované čtení, podtrhávání a přepisování/shrnování</strong> mají nízký účinek — vytvářejí pocit, že to umíš, ale paměť moc neposilují.</p>
  <ol>
  <li><strong>Vybavování (testing effect)</strong> — každá kartička a otázka tě nutí si informaci <em>vytáhnout</em> z hlavy. Právě to vytahování ji ukládá. Proto po každé části lekce hned přijde rychlá kontrola.</li>
  <li><strong>Rozložené opakování</strong> — kartička, kterou umíš, se vrátí za 1 → 3 → 7 dní, ta, co nejde, hned. Halíř intervaly zkracuje podle data zkoušky, aby sis vše zopakovala ještě před ní.</li>
  <li><strong>Prokládání (interleaving)</strong> — mix kvízy míchají lekce. Je to těžší, ale učí tě rozpoznat, <em>který</em> model nebo nástroj na otázku použít — přesně to chce zkouška.</li>
  <li><strong>Vysvětlování vlastními slovy</strong> — „Vysvětli Halířovi“ (Feynmanova technika). Když to umíš vysvětlit jednoduše, rozumíš tomu. Mezery uvidíš hned u klíčových bodů.</li>
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
  view().innerHTML = `${topbar("#/")}<h1>Grafická laboratoř</h1><p class="muted" style="margin:6px 0 12px">Hýbej posuvníky a sleduj, kam se křivky posunou. Šedá čárkovaná = výchozí stav.</p>
    <div class="tabs">${[["is", "IS křivka"], ["mp", "MP křivka"], ["ad", "AD–AS model"]].map(([k, n]) => `<button class="tab ${GL.tab === k ? "on" : ""}" data-g="${k}">${n}</button>`).join("")}</div>
    <div class="graph" id="gsvg"></div><div class="explain md" id="gexp"></div><div class="card" id="gctl" style="margin-top:12px"></div>
    <div style="margin-top:12px">${askBtn("Vysvětli mi, jak se v tomhle modelu posouvají křivky a proč.", GL.tab === "is" ? "5A IS křivka" : GL.tab === "mp" ? "5B MP křivka" : "6A Model AS-AD")}</div>`;
  bindAsk();
  $$("[data-g]").forEach(b => b.onclick = () => { GL.tab = b.dataset.g; history.replaceState(null, "", "#/grafy?g=" + GL.tab); viewGraphs(parts, new URLSearchParams("g=" + GL.tab)); });
  const ctl = $("#gctl");
  const bind = (obj, keys, draw) => keys.forEach(k => { const el = $("#" + k); el.oninput = () => { obj[k.split("_")[1]] = +el.value; $("#" + k + "o").textContent = (+el.value > 0 ? "+" : "") + el.value; draw(); }; });
  if (GL.tab === "is") {
    const P = GL.is;
    ctl.innerHTML = `<button class="link small" id="rs" style="float:right">reset</button><b>Autonomní faktory</b>` +
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
    ctl.innerHTML = `<button class="link small" id="rs" style="float:right">reset</button><b>Měnová politika</b>` +
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
    ctl.innerHTML = `<button class="link small" id="rs" style="float:right">reset</button><b>Šoky</b>` +
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
const TUT = { conv: null, mode: "off", msgs: [], ctx: "", busy: false };
async function tutorStop() { const c = TUT.conv; TUT.conv = null; TUT.mode = "off"; if (c) { try { await c.endSession(); } catch (e) { } } }
function tutorMsg(role, text) { TUT.msgs.push({ role, text }); const ch = $("#chat"); if (ch) { ch.insertAdjacentHTML("beforeend", msgHTML({ role, text })); ch.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" }); } }
const msgHTML = m => `<div class="msg ${m.role}">${m.role === "ai" ? md(m.text) : esc(m.text)}</div>`;
function tutorStatus(t) { const s = $("#tstat"); if (s) s.textContent = t; }
function tutorHam(cls) { const h = $(".tutor-hero .ham"); if (h) { h.classList.toggle("talk", cls === "talk"); } }
async function tutorStart(textOnly) {
  if (!AGENT_ID) return null;
  if (TUT.conv && (textOnly || TUT.mode === "voice")) return TUT.conv;
  if (TUT.conv) await tutorStop();
  TUT.busy = true; tutorStatus("Halíř se připojuje…");
  try {
    const { Conversation } = await import("./vendor/elevenlabs.mjs");
    const conv = await Conversation.startSession({
      agentId: AGENT_ID, connectionType: textOnly ? "websocket" : "webrtc", textOnly: !!textOnly,
      dynamicVariables: { tema: TUT.ctx || "celý kurz Měnová teorie a politika", jmeno: "Anička" },
      onMessage: m => { if (m.role === "agent" || m.source === "ai") tutorMsg("ai", m.message); else if (!textOnly && m.message) tutorMsg("me", m.message); },
      onModeChange: ({ mode }) => { tutorHam(mode === "speaking" ? "talk" : ""); tutorStatus(mode === "speaking" ? "Halíř mluví…" : TUT.mode === "voice" ? "Poslouchám tě… klidně mě přeruš" : "Píšeme si"); },
      onError: (m) => { tutorStatus("Chyba spojení: " + m); },
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
function syncVoiceBtn() { const b = $("#voice"); if (!b) return; b.classList.toggle("live", TUT.mode === "voice"); b.innerHTML = TUT.mode === "voice" ? ic.stop : ic.mic; const l = $("#vlabel"); if (l) l.textContent = TUT.mode === "voice" ? "Ukončit hovor" : "Mluvit s Halířem"; }
function offlineAnswer(text) {
  const hits = searchNotes(text, 3);
  if (!hits.length) return "Tohle v poznámkách nevidím. Zkus to říct jinými slovy, nebo použij hledání.";
  return "Tady je, co k tomu mám v poznámkách:\n\n" + hits.map(h => h.kind === "s" ? `**${h.l.id} · ${h.s.title}** — ${h.s.body.replace(/\n+/g, " ").slice(0, 260)}… [otevřít](#/lekce/${h.l.id})` : `**${h.t.term}** (${h.l.id}) — ${h.t.def}`).join("\n\n");
}
async function tutorSend(text) {
  text = text.trim(); if (!text) return;
  tutorMsg("me", text);
  if (!AGENT_ID) { setTimeout(() => tutorMsg("ai", offlineAnswer(text)), 250); return; }
  const conv = TUT.conv || await tutorStart(true);
  if (!conv) { tutorMsg("ai", offlineAnswer(text)); return; }
  try { conv.sendUserMessage(text); } catch (e) { tutorMsg("ai", offlineAnswer(text)); }
}
function viewTutor(parts, q) {
  const ctx = q.get("ctx"); const pre = q.get("q");
  if (ctx && ctx !== TUT.ctx) { tutorStop(); TUT.ctx = ctx; }
  view().innerHTML = `${topbar()}
    <div class="tutor-hero">${ham("happy", "idle")}<h2>Zeptej se Halíře</h2>
      <p class="muted small" style="max-width:34ch">${AGENT_ID ? "Mluv se mnou nahlas jako s doučovatelem, nebo piš. Znám všech 12 přednášek." : "Hlasový Halíř se ještě připojuje. Zatím ti najdu odpověď v poznámkách."}</p>
      ${TUT.ctx ? `<span class="ctx">Téma: ${esc(TUT.ctx)} <button id="clrctx" aria-label="Zrušit téma">×</button></span>` : ""}
      ${AGENT_ID ? `<button class="voice-btn" id="voice" style="margin-top:10px">${ic.mic}</button><b id="vlabel" class="small">Mluvit s Halířem</b>` : ""}
      <div class="tutor-status" id="tstat"></div></div>
    <div class="chips" id="chips">${["Vyzkoušej mě z " + (TUT.ctx || "IS křivky"), "Vysvětli mi transmisní mechanismus jednoduše", "Jaký je rozdíl mezi pohybem po křivce a posunem křivky?", "Co budu potřebovat ke zkoušce nejvíc?"].map(c => `<button class="chip">${esc(c)}</button>`).join("")}</div>
    <div class="chat" id="chat">${TUT.msgs.map(msgHTML).join("")}</div>
    <div class="composer"><textarea id="tin" rows="1" placeholder="Napiš otázku…"></textarea><button class="btn" id="tsend" aria-label="Odeslat">${ic.send}</button></div>`;
  const tin = $("#tin");
  $("#tsend").onclick = () => { const v = tin.value; tin.value = ""; tutorSend(v); };
  tin.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#tsend").click(); } };
  $$(".chip").forEach(c => c.onclick = () => tutorSend(c.textContent));
  const cl = $("#clrctx"); if (cl) cl.onclick = () => { TUT.ctx = ""; tutorStop(); nav("#/halir"); };
  const vb = $("#voice");
  if (vb) { syncVoiceBtn(); vb.onclick = async () => { if (TUT.busy) return; if (TUT.mode === "voice") { await tutorStop(); syncVoiceBtn(); tutorStatus("Hovor ukončen"); } else { await tutorStart(false); } }; }
  if (pre) { history.replaceState(null, "", "#/halir"); tin.value = pre; tin.focus(); }
}

/* ---------- boot ---------- */
(async function boot() {
  try { await loadCourse(); }
  catch (e) { view().innerHTML = `<div class="empty">${ham("sad")}<p>Nepodařilo se načíst látku. Zkus obnovit stránku.</p></div>`; return; }
  window.addEventListener("hashchange", render);
  render();
})();
