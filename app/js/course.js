// The course itself: path, lessons, the five item players, practice, progress, sync.
import { $, $$, view, esc, store, api, today, addDays, fmtDate, shuffle, pick, norm, md, mdi, sfx, confetti, toast, ic } from "./util.js";
import { t, lang, setLang, itemCount, errText } from "./i18n.js";
import { ham, teacher } from "./art.js";
import { mergeState, defaults } from "./merge.js";
import { daysBetween } from "./forecast.js";
import { viewVoice } from "./voice.js";

const DAY = 86400000;
export const TUTORS = [
  { id: "penny", idx: -1, name: "Penny", hi: { cs: "Křeček, který všechno vysvětlí.", en: "A hamster who explains it all." } },
  { id: "bear", idx: 0, name: "Bára", hi: { cs: "Klidná. Pomalu a pořádně.", en: "Calm. Slow and thorough." } },
  { id: "fox", idx: 1, name: "Emil", hi: { cs: "Chytrý. Najde zkratku.", en: "Clever. Finds the shortcut." } },
  { id: "cat", idx: 2, name: "Oskar", hi: { cs: "Přesný. Žádné zbytečnosti.", en: "Precise. No fluff." } },
  { id: "pig", idx: 3, name: "Rozárka", hi: { cs: "Veselá. S ní to uteče.", en: "Cheerful. Time flies." } },
  { id: "frog", idx: 4, name: "Kvido", hi: { cs: "Skočí rovnou na věc.", en: "Jumps straight to the point." } },
  { id: "panda", idx: 5, name: "Mia", hi: { cs: "V pohodě. Krok za krokem.", en: "Relaxed. Step by step." } },
];
const tutorOf = id => TUTORS.find(x => x.id === id) || TUTORS[0];
export function tutorArt(id, cls = "", mood = "open") {
  const x = tutorOf(id);
  return x.idx < 0 ? ham(mood, cls) : teacher(x.idx, cls);
}

/* ---------- state ---------- */
let ACCESS = { paid: true, building: false, status: "ready" }, restTimer = null;
let C = null, SLUG = null, STUDENT = null, S = defaults(), ITEM = {}, LESSON = {}, TOKEN = null;
const lsKey = () => "progress." + SLUG;
export function resetCourse() { C = null; SLUG = null; clearTimeout(restTimer); }
const SYNC = {
  timer: null, state: "ok",
  later() { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1500); this.state = "saving"; badge(); },
  async pull() {
    try { const r = await api("progress_load", { session: TOKEN }); S = mergeState(S, r.data); store.set(lsKey(), S); this.state = "ok"; } catch (e) { this.state = "offline"; }
    badge();
  },
  async push() {
    clearTimeout(this.timer);
    try { const r = await api("progress_save", { session: TOKEN, data: S }); S = mergeState(S, r.data); store.set(lsKey(), S); this.state = "ok"; } catch (e) { this.state = "offline"; }
    badge();
  },
};
const badge = () => { const b = $("#syncState"); if (b) b.textContent = t(SYNC.state === "ok" ? "synced" : SYNC.state === "offline" ? "offline" : "syncing"); };
addEventListener("online", () => { if (TOKEN) SYNC.push(); });
document.addEventListener("visibilitychange", () => { if (!TOKEN) return; if (document.hidden) { if (SYNC.state !== "ok") SYNC.push(); } else SYNC.pull(); });
function save() { S.saved = Date.now(); store.set(lsKey(), S); SYNC.later(); }

const doneToday = () => { const d = today(); S.done[d] = S.done[d] || {}; return S.done[d]; };
function addXP(n) { const d = today(); S.xp[d] = (S.xp[d] || 0) + n; doneToday().items = (doneToday().items || 0) + 1; save(); }
function streak() {
  let n = 0, d = today();
  if (!S.xp[d]) d = addDays(d, -1);
  while (S.xp[d]) { n++; d = addDays(d, -1); }
  return n;
}
const examDate = () => STUDENT?.examDate || C?.meta.examDate || null;
const daysToExam = () => examDate() ? daysBetween(today(), examDate()) : null;

/* ---------- spaced repetition, same rules as Penny ---------- */
function grade(id, g) {
  const s = S.cards[id] || { reps: 0, ease: 2.4, ivl: 0, lapses: 0 };
  const now = Date.now(), sod = new Date(now).setHours(0, 0, 0, 0);
  if (g === 0) { s.lapses++; s.ease = Math.max(1.3, s.ease - .2); s.ivl = 0; s.reps = 0; s.due = now + 60e3; }
  else if (g === 1) {
    s.ease = Math.max(1.3, s.ease - .15);
    if (s.reps === 0) { s.ivl = 0; s.due = now + 6 * 60e3; } else { s.ivl = Math.max(1, Math.round(s.ivl * 1.2)); }
    s.reps++;
  } else if (g === 2) { s.ivl = s.reps === 0 ? 1 : s.reps === 1 ? 3 : Math.round(Math.max(1, s.ivl) * s.ease); s.reps++; }
  else { s.ease += .15; s.ivl = s.reps === 0 ? 3 : Math.round(Math.max(1, s.ivl) * s.ease * 1.3); s.reps++; }
  if (s.ivl >= 1) {
    const left = daysToExam();
    if (left != null) s.ivl = Math.min(s.ivl, Math.max(1, Math.floor(Math.max(1, left) / 2)));
    s.due = sod + s.ivl * DAY;
  }
  s.last = now; S.cards[id] = s; save();
  return s;
}
const mastered = it => it.type === "flashcard" ? (S.cards[it.id]?.reps || 0) >= 1 : !!S.q[it.id]?.ok;
const dueIds = () => Object.keys(S.cards).filter(id => ITEM[id] && S.cards[id].due <= Date.now());
const mistakeIds = () => Object.keys(S.q).filter(id => ITEM[id] && !S.q[id].ok);
const lessonPct = l => l.items.length ? l.items.filter(mastered).length / l.items.length : (S.lessons[l.id] ? 1 : 0);
function record(it, ok) { S.q[it.id] = { ok, last: Date.now(), n: (S.q[it.id]?.n || 0) + 1 }; save(); }
const allLessons = () => C.units.flatMap(u => u.lessons);
const openLessons = () => allLessons().filter(l => !l.locked);
const lockedCount = () => allLessons().length - openLessons().length;
const dailyGoal = () => Math.max(5, Math.round((STUDENT?.minutes || 20) * 1.5)); // roughly 40 seconds an item

function srcText(s) {
  if (!s) return "";
  const out = [];
  if (s.file) out.push(s.file);
  if (s.page) out.push(`${t("srcPage")} ${s.page}`);
  if (s.slides?.length) out.push(`${t("srcSlides")} ${s.slides.slice(0, 4).join(", ")}`);
  if (!s.page && !s.slides?.length && s.lecture) out.push(`${t("srcLecture")} ${s.lecture}`);
  return out.join(", ");
}
const srcLine = it => { const x = srcText(it.source); return x ? `<p class="pc-source">${t("source")}: ${esc(x)}</p>` : ""; };

/* ---------- load ---------- */
async function loadCourse(slug) {
  const sess = store.get("session");
  if (!sess) throw Object.assign(new Error("no_session"), { status: 401 });
  if (sess.slug !== slug) throw Object.assign(new Error("no_session"), { status: 401 });
  TOKEN = sess.token;
  if (C && SLUG === slug) return;
  const [r, voice] = await Promise.all([api("course", { session: TOKEN }), api("voice_status", { session: TOKEN }).catch(() => null)]);
  const cr = await fetch(r.url);
  if (!cr.ok) throw new Error("server");
  C = await cr.json(); SLUG = slug; STUDENT = r.student; ACCESS = r.access || { paid: true, building: false, status: "ready" };
  for (const l of allLessons()) l.items ||= [];
  if (voice) C.meta.voice = voice.enabled;
  ITEM = {}; LESSON = {};
  for (const l of allLessons()) { LESSON[l.id] = l; for (const it of l.items) { it._l = l.id; ITEM[it.id] = it; } }
  S = Object.assign(defaults(), store.get(lsKey(), {}));
  await SYNC.pull();
}
export async function courseRoute(parts, nav, render) {
  const [slug, sub, arg] = parts;
  $("#view").innerHTML = `<p class="empty">…</p>`;
  try { await loadCourse(slug); }
  catch (e) {
    if (e.status === 401) { store.del("session"); toast(t("sessionExpired")); return nav("#/login"); }
    if (e.code === "not_ready") return nav("#/wait");
    $("#nav").hidden = true;
    view().innerHTML = `<div class="pc-center">${ham("sad")}<h1>${t("courseFail")}</h1><p class="pc-sub">${esc(errText(e.code))}</p><button class="btn block big" id="again">${t("retry")}</button></div>`;
    $("#again").onclick = render;
    return;
  }
  ctx = { nav, render, slug };
  setTabs(slug, sub);
  if (!sub) return viewPath();
  if (sub === "practice") return viewPractice();
  if (sub === "progress") return viewProgress();
  if (sub === "voice") return viewVoice({ token: TOKEN, art: tutorArt(STUDENT?.tutor || C.meta.tutor, "bob"), topbar: topbar(), onOut: () => { store.del("session"); nav("#/login"); } });
  if (sub === "lesson") return startLesson(arg);
  if (sub === "review") return startReview(arg);
  nav("#/s/" + slug);
}
let ctx = null;
function setTabs(slug, sub) {
  const n = $("#nav");
  const inSession = sub === "lesson" || sub === "review";
  n.hidden = inSession;
  $$("a", n).forEach(a => {
    const k = a.dataset.k;
    if (k === "hlas") { a.hidden = !C?.meta.voice; a.href = `#/s/${slug}/voice`; a.setAttribute("aria-label", t("navVoice")); a.classList.toggle("on", sub === "voice"); return; }
    a.href = k === "cesta" ? `#/s/${slug}` : k === "procvic" ? `#/s/${slug}/practice` : `#/s/${slug}/progress`;
    a.setAttribute("aria-label", t(k === "cesta" ? "navPath" : k === "procvic" ? "navPractice" : "navProgress"));
    a.classList.toggle("on", (k === "cesta" && !sub) || (k === "procvic" && sub === "practice") || (k === "pokrok" && sub === "progress"));
  });
}
function topbar() {
  const left = daysToExam(), due = dueIds().length, st = streak();
  const exam = left == null ? "" : `<a class="stat-chip exam" href="#/s/${SLUG}/progress" aria-label="${left} ${t("daysLeft")}">📅 ${Math.max(0, left)}</a>`;
  return `<div class="topbar">${exam}<span class="sp"></span><a class="stat-chip cards" href="#/s/${SLUG}/practice" aria-label="${t("pracDue")}">🃏 ${due}</a><a class="stat-chip streak ${st ? "lit" : ""}" href="#/s/${SLUG}/progress" aria-label="${t("progStreak")}">🔥 ${st}</a></div>`;
}

/* ---------- path ---------- */
const ZIG = [0, 70, 30];
function viewPath() {
  const cur = openLessons().find(l => lessonPct(l) < 1) || null, locked = lockedCount();
  const goal = dailyGoal(), did = doneToday().items || 0;
  const tu = tutorOf(STUDENT?.tutor || C.meta.tutor);
  const units = C.units.map((u, ui) => {
    const dir = ui % 2 ? -1 : 1;
    const nodes = u.lessons.map((l, k) => {
      if (l.locked) return `<div class="pnode locked" style="--dx:${ZIG[k % ZIG.length] * dir}px"><button data-locked="${esc(l.id)}" aria-label="${esc(l.title)}: ${t("lockedLesson")}">${ic.lock}</button><span class="label">${esc(l.title)}</span></div>`;
      const p = lessonPct(l), done = p >= 1, isCur = cur && l.id === cur.id;
      const cls = done ? "gold" : isCur ? "cur" : p > 0 ? "" : "fresh";
      return `<div class="pnode ${cls}" style="--dx:${ZIG[k % ZIG.length] * dir}px"><span class="ring2" style="--p:${Math.round(p * 100)}"></span>
        ${isCur ? `<span class="startbub">${t("startBubble")}</span>` : ""}
        <button data-lesson="${esc(l.id)}" aria-label="${esc(l.title)}">${done ? ic.check : ic.star}</button><span class="label">${esc(l.title)}</span></div>`;
    }).join("");
    return `<section class="unit u${(ui % 6) + 1}"><div class="unit-head"><div class="t"><span class="cap">${t("unit")} ${ui + 1}</span><b>${esc(u.title)}</b></div></div><div class="path">${nodes}</div></section>`;
  }).join("");
  view().innerHTML = `${topbar()}<div class="home-main">
    <div class="pc-title"><h1>${esc(C.meta.title)}</h1></div>
    <div class="pc-say">${tutorArt(tu.id, "pc-mini")}<div class="bubble">${esc(tu.hi[lang()])}</div></div>
    <a class="quest" href="${cur ? `#/s/${SLUG}/lesson/${esc(cur.id)}` : locked && !ACCESS.paid ? "#/unlock" : `#/s/${SLUG}/practice`}"><div class="t"><b>${t("todayGoal")}: ${Math.min(did, goal)} / ${goal} ${t("todayItems")}</b><div class="bar yellow"><i style="width:${Math.min(100, did / goal * 100)}%"></i></div></div></a>
    ${unlockCard(locked)}${units}</div>`;
  $$("[data-locked]").forEach(b => b.onclick = () => ACCESS.paid ? toast(t(ACCESS.status === "failed" ? "restFailed" : "restBuilding")) : ctx.nav("#/unlock"));
  $$("[data-lesson]").forEach(b => b.onclick = () => ctx.nav(`#/s/${SLUG}/lesson/${b.dataset.lesson}`));
  const c = $(".pnode.cur");
  if (c) setTimeout(() => c.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
  if (locked && ACCESS.building) watchRest();
}
// Free start: the card that sells the rest, or says the rest is being written.
function unlockCard(locked) {
  if (!locked) return "";
  if (!ACCESS.paid) return `<a class="pc-unlock" href="#/unlock">${ic.lock}<div><b>${t("unlockCard")}</b><span>${t("unlockCardSub").replace("%", locked)}</span></div></a>`;
  if (ACCESS.status === "failed") return `<div class="pc-unlock off" role="status"><div><b>${t("restFailed")}</b></div></div>`;
  return `<div class="pc-unlock off" role="status"><div><b>${t("restBuilding")}</b><span>${t("restBuildingSub")}</span></div></div>`;
}
// While the rest of a paid course is written, checks every 20 s and reloads the path when it's there. Progress stays: lesson IDs don't change.
function watchRest() {
  clearTimeout(restTimer);
  const slug = SLUG;
  restTimer = setTimeout(async () => {
    if (location.hash !== "#/s/" + slug || SLUG !== slug) return;
    try {
      const r = await api("status", { session: TOKEN });
      if (r.building) return watchRest();
      resetCourse(); toast(t(r.status === "failed" ? "restFailed" : "restReady")); ctx.render();
    } catch (e) { watchRest(); }
  }, 20000);
}

/* ---------- session runner ---------- */
const ROUND = 10;
function startLesson(id) {
  const l = LESSON[id];
  if (!l || l.locked) return ctx.nav(l && !ACCESS.paid ? "#/unlock" : "#/s/" + SLUG);
  const unread = (l.reading || []).filter(s => !S.read[s.id]);
  const todo = l.items.filter(it => !mastered(it));
  const pool = todo.length ? todo : l.items;
  runSession({ title: l.title, reading: unread, items: pool.slice(0, ROUND), lesson: l, back: "#/s/" + SLUG });
}
function startReview(kind) {
  const list = kind === "due" ? dueIds().map(id => ITEM[id]) : kind === "mistakes" ? mistakeIds().map(id => ITEM[id])
    : shuffle(Object.values(ITEM).filter(it => S.cards[it.id] || S.q[it.id])).slice(0, ROUND);
  if (!list.length) return ctx.nav(`#/s/${SLUG}/practice`);
  runSession({ title: t("pracTitle"), reading: [], items: shuffle(list).slice(0, ROUND * 2), back: `#/s/${SLUG}/practice` });
}
function sessionTop(st) {
  const done = st.total - st.queue.length - st.reading.length;
  return `<div class="session-top"><button class="x" id="quit" aria-label="${t("close")}">${ic.x}</button><div class="bar"><i style="width:${Math.max(3, done / Math.max(1, st.total) * 100)}%"></i></div></div>`;
}
function runSession(cfg) {
  const st = { ...cfg, reading: [...cfg.reading], queue: [...cfg.items], total: cfg.reading.length + cfg.items.length, right: 0, answered: 0, xp: 0, retried: new Set(), wrongFirst: new Set() };
  step(st);
}
function step(st) {
  window.onkeydown = null;
  window.scrollTo(0, 0);
  if (st.reading.length) return playReading(st);
  if (!st.queue.length) return finish(st);
  const it = st.queue[0];
  ({ flashcard: playCard, mc: playMc, tf: playTf, fill: playFill, match: playMatch })[it.type](st, it);
  $("#quit").onclick = () => { SYNC.push(); ctx.nav(st.back); };
}
function dock(html) { return `<div class="dock" id="qdock"><div class="dock-in">${html}</div></div>`; }
function playReading(st) {
  const s = st.reading[0];
  view().innerHTML = `${sessionTop(st)}<article class="pc-read"><h1>${esc(s.title)}</h1><div class="md">${md(s.body)}</div>${srcLine(s)}</article>${dock(`<button class="btn block big" id="go">${t("cont")}</button>`)}`;
  $("#quit").onclick = () => { SYNC.push(); ctx.nav(st.back); };
  $("#go").onclick = () => { S.read[s.id] = Date.now(); save(); st.reading.shift(); step(st); };
}
function answered(st, it, ok, { record: rec = true, answerHtml = "", verdict } = {}) {
  if (rec) record(it, ok);
  st.answered++;
  if (ok) { st.right++; addXP(10); st.xp += 10; sfx.right(); } else { addXP(1); st.xp += 1; sfx.wrong(); }
  $("#qdock")?.remove();
  const fb = document.createElement("div");
  fb.className = "feedback " + (ok ? "good" : "badf");
  fb.innerHTML = `<div class="in"><h3><span class="ok-ico">${ok ? ic.check : ic.x}</span>${esc(verdict || (ok ? pick([t("say1"), t("say2"), t("say3"), t("say4")]) : t("correctIs")))}</h3>
    ${answerHtml}<div class="md">${md(it.explanation || "")}</div>${srcLine(it)}
    <div class="row"><button class="btn ${ok ? "ok" : "bad"} big" style="flex:1" id="fbNext">${t("cont")}</button></div></div>`;
  document.body.appendChild(fb);
  const go = () => {
    fb.remove(); window.onkeydown = null;
    st.queue.shift();
    if (!ok && !st.retried.has(it.id)) { st.retried.add(it.id); st.queue.push(it); st.total++; } // one more try at the end, as in Duolingo
    step(st);
  };
  $("#fbNext", fb).onclick = go;
  setTimeout(() => window.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } }, 200);
}
const correctBox = html => `<div class="ans">${html}</div>`;

/* flashcard */
function playCard(st, it) {
  const s = S.cards[it.id] || {};
  view().innerHTML = `${sessionTop(st)}<div class="flash"><div class="face" id="face"><div class="lbl"><span>${esc(LESSON[it._l]?.title || "")}</span><span>${s.reps ? t("cardRepeat") : t("cardNew")}</span></div>
    <div class="q">${mdi(it.front)}</div>
    <div class="a" id="ans" hidden><div class="md">${md(it.back)}</div>${it.explanation && it.explanation !== it.back ? `<div class="md pc-expl">${md(it.explanation)}</div>` : ""}${srcLine(it)}</div>
    <div style="flex:1"></div></div></div>
    ${dock(`<div id="ctrl"><button class="btn blue block big" id="reveal">${t("showAns")}</button></div>`)}`;
  const doGrade = g => {
    window.onkeydown = null;
    const ns = grade(it.id, g);
    st.answered++; if (g >= 2) { st.right++; sfx.right(); }
    addXP(g >= 2 ? 5 : 2); st.xp += g >= 2 ? 5 : 2;
    st.queue.shift();
    if (ns.due <= Date.now() + 15 * 60e3) { st.queue.splice(Math.min(st.queue.length, 3), 0, it); st.total++; }
    step(st);
  };
  const reveal = () => {
    sfx.flip(); $("#ans").hidden = false; $("#face").classList.add("reveal");
    $("#ctrl").innerHTML = `<div class="grades">
      <button class="btn bad" data-g="0">${t("gNo")}<small>${t("gNoS")}</small></button>
      <button class="btn ghost" data-g="1">${t("gHard")}<small>${t("gHardS")}</small></button>
      <button class="btn ok" data-g="2">${t("gYes")}<small>${t("gYesS")}</small></button>
      <button class="btn blue" data-g="3">${t("gEasy")}<small>${t("gEasyS")}</small></button></div>`;
    $$("[data-g]").forEach(b => b.onclick = () => doGrade(+b.dataset.g));
    window.onkeydown = e => { if ("1234".includes(e.key)) doGrade(+e.key - 1); };
  };
  $("#reveal").onclick = reveal;
  window.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); reveal(); } };
}

/* multiple choice and true/false share the option screen */
function optionScreen(st, it, { label, q, opts, isRight, rightHtml }) {
  view().innerHTML = `${sessionTop(st)}<div class="qcard"><div class="lbl">${esc(label)}</div><div class="q">${mdi(q)}</div>${opts}</div>${dock(`<button class="btn block big off" id="qcheck">${t("check")}</button>`)}`;
  let sel = null;
  const btns = $$(".opt");
  const pickOpt = b => { btns.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = b.dataset.v; $("#qcheck").classList.remove("off"); sfx.flip(); };
  const check = () => {
    if (sel == null) return;
    const ok = isRight(sel);
    btns.forEach(b => { b.disabled = true; b.classList.remove("sel"); if (isRight(b.dataset.v)) b.classList.add("right"); else if (b.dataset.v === sel) b.classList.add("wrong"); });
    window.onkeydown = null;
    answered(st, it, ok, { answerHtml: ok ? "" : correctBox(rightHtml) });
  };
  btns.forEach(b => b.onclick = () => pickOpt(b));
  $("#qcheck").onclick = check;
  window.onkeydown = e => {
    const i = ["1", "2", "3", "4", "5", "6"].indexOf(e.key);
    if (i >= 0 && btns[i] && !btns[i].disabled) pickOpt(btns[i]);
    else if (e.key === "Enter" && sel != null) { e.preventDefault(); check(); }
  };
}
function playMc(st, it) {
  const L = "ABCDEF";
  const order = it._order || (it._order = shuffle(it.options.map((_, i) => i)));
  optionScreen(st, it, {
    label: t("pick"), q: it.question,
    opts: `<div class="opts">${order.map((oi, k) => `<button class="opt" data-v="${oi}"><span class="k">${L[k]}</span><span>${mdi(it.options[oi])}</span></button>`).join("")}</div>`,
    isRight: v => +v === it.correct, rightHtml: mdi(it.options[it.correct]),
  });
}
function playTf(st, it) {
  optionScreen(st, it, {
    label: t("tfQ"), q: it.statement,
    opts: `<div class="tf"><button class="opt" data-v="1"><span class="k">✓</span>${t("tfT")}</button><button class="opt" data-v="0"><span class="k">✗</span>${t("tfF")}</button></div>`,
    isRight: v => (v === "1") === !!it.answer, rightHtml: esc(it.answer ? t("tfT") : t("tfF")),
  });
}

/* fill the gap */
function playFill(st, it) {
  const [before, after] = it.text.split("___");
  view().innerHTML = `${sessionTop(st)}<div class="qcard"><div class="lbl">${t("fillQ")}</div>
    <form id="ff" class="pc-fill"><span>${mdi(before)}</span><input id="fillIn" class="pc-gap" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${t("fillPh")}" aria-label="${t("fillPh")}"><span>${mdi(after)}</span></form></div>
    ${dock(`<button class="btn block big off" id="qcheck">${t("check")}</button>`)}`;
  const inp = $("#fillIn");
  inp.oninput = () => $("#qcheck").classList.toggle("off", !inp.value.trim());
  const check = () => {
    if (!inp.value.trim()) return;
    const ok = it.answers.some(a => norm(a) === norm(inp.value));
    inp.disabled = true; inp.classList.add(ok ? "right" : "wrong");
    answered(st, it, ok, { answerHtml: ok ? "" : correctBox(esc(it.answers[0])) });
  };
  $("#qcheck").onclick = check;
  $("#ff").onsubmit = e => { e.preventDefault(); check(); };
  inp.focus();
}

/* match pairs */
function playMatch(st, it) {
  const lefts = shuffle(it.pairs.map((p, i) => ({ i, s: p.left }))), rights = shuffle(it.pairs.map((p, i) => ({ i, s: p.right })));
  view().innerHTML = `${sessionTop(st)}<div class="qcard"><div class="lbl">${t("matchQ")}</div><div class="pc-match">
    <div>${lefts.map(x => `<button class="opt" data-side="l" data-i="${x.i}">${mdi(x.s)}</button>`).join("")}</div>
    <div>${rights.map(x => `<button class="opt" data-side="r" data-i="${x.i}">${mdi(x.s)}</button>`).join("")}</div></div></div>`;
  let sel = null, mistakes = 0, left = it.pairs.length;
  $$(".pc-match .opt").forEach(b => b.onclick = () => {
    if (b.disabled) return;
    if (!sel || sel.dataset.side === b.dataset.side) {
      $$(".pc-match .opt").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); sel = b; sfx.flip(); return;
    }
    if (sel.dataset.i === b.dataset.i) {
      [sel, b].forEach(x => { x.classList.remove("sel"); x.classList.add("right"); x.disabled = true; });
      sel = null; left--; sfx.flip();
      if (!left) answered(st, it, mistakes === 0, { verdict: mistakes ? t("mistakeMatch") : undefined });
    } else {
      mistakes++; sfx.wrong();
      const a = sel, c = b; [a, c].forEach(x => { x.classList.remove("sel"); x.classList.add("wrong"); });
      setTimeout(() => [a, c].forEach(x => x.classList.remove("wrong")), 500);
      sel = null;
    }
  });
}

/* end of a round */
function finish(st) {
  const l = st.lesson;
  if (l) { S.lessons[l.id] = { ts: Date.now(), best: Math.max(S.lessons[l.id]?.best || 0, lessonPct(l)) }; save(); }
  SYNC.push();
  const more = l && lessonPct(l) < 1;
  const pct = st.answered ? Math.round(st.right / st.answered * 100) : 100;
  const tu = STUDENT?.tutor || C.meta.tutor;
  sfx.done(); confetti();
  const boxes = [[t("xp"), st.xp, "y"], [t("correct"), pct + " %", "g"], [t("streak"), streak(), "b"]];
  view().innerHTML = `<div class="done-screen">${tutorArt(tu, "jump", "happy")}<div class="title">${t(more ? "doneMore" : "doneTitle")}</div>${l ? `<p class="sub">${esc(l.title)}</p>` : ""}
    <div class="statboxes">${boxes.map(([h, v, c]) => `<div class="sbox ${c}"><div class="h">${esc(h)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div></div>
    ${dock(`<a class="btn block big" href="${more ? `#/s/${SLUG}/lesson/${esc(l.id)}?r=${Date.now()}` : st.back}" id="endNext">${t("cont")}</a>`)}`;
}

/* ---------- practice ---------- */
function viewPractice() {
  const due = dueIds().length, mis = mistakeIds().length, seen = Object.keys(S.cards).length + Object.keys(S.q).length;
  const tile = (kind, title, n, color) => `<a class="pc-tile ${color} ${n ? "" : "off"}" ${n ? `href="#/s/${SLUG}/review/${kind}"` : ""}><b>${title}</b><span>${n ? itemCount(n) : t("pracNone")}</span></a>`;
  view().innerHTML = `${topbar()}<div class="pc-step"><h1>${t("pracTitle")}</h1>
    ${seen ? "" : `<p class="pc-sub">${t("pracEmpty")}</p>`}
    <div class="pc-tiles">${tile("due", t("pracDue"), due, "purple")}${tile("mistakes", t("pracMistakes"), mis, "red")}${tile("mix", t("pracMix"), Math.min(seen, ROUND), "blue")}</div></div>`;
}

/* ---------- progress ---------- */
function viewProgress() {
  const items = Object.values(ITEM), done = items.filter(mastered).length, left = daysToExam();
  const code = store.get("code");
  const remaining = items.length - done;
  const studyDays = left > 0 ? Math.max(1, Math.floor(left * (STUDENT?.days || 7) / 7)) : 1;
  const pace = Math.ceil(remaining / studyDays);
  view().innerHTML = `${topbar()}<div class="pc-step"><h1>${t("progTitle")}</h1>
    <div class="statboxes"><div class="sbox g"><div class="h">${t("progLearned")}</div><div class="v">${done}/${items.length}</div></div>
      <div class="sbox y"><div class="h">${t("progStreak")}</div><div class="v">${streak()}</div></div>
      <div class="sbox b"><div class="h">${t("progDays")}</div><div class="v">${left == null ? "–" : Math.max(0, left)}</div></div></div>
    ${left != null && left > 0 && remaining ? `<div class="card pc-pace"><b>${t("progPaceNeed")}</b><span>~${itemCount(pace)} ${t("paceDaily")}</span></div>` : ""}
    <div class="card"><b>${t("progPlan")}</b><p class="pc-sub small">${STUDENT?.minutes ? `${STUDENT.minutes} ${t("minPerDay")}, ${STUDENT.days}${t("perWeek")}` : t("noPlan")}${examDate() ? ` · ${esc(fmtDate(examDate(), lang()))}` : ""}</p></div>
    ${C.units.map(u => { const its = u.lessons.flatMap(l => l.items), p = its.length ? its.filter(mastered).length / its.length * 100 : 0; return `<div class="pc-unitbar"><span>${esc(u.title)}</span><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join("")}
    <h2 class="pc-h2">${t("settings")}</h2>
    <div class="card pc-set"><div><span>${t("setLang")}</span><div class="pc-lang"><button data-lang="cs" class="${lang() === "cs" ? "on" : ""}">CS</button><button data-lang="en" class="${lang() === "en" ? "on" : ""}">EN</button></div></div>
      <div><span>${t("setSound")}</span><button class="btn ghost sm" id="snd">${store.get("sound", true) ? t("setOn") : t("setOff")}</button></div>
      ${code ? `<div><span>${t("setCode")}</span><b>${esc(code)}</b></div>` : ""}
      <div><span id="syncState"></span><button class="btn ghost sm" id="logout">${t("setLogout")}</button></div></div></div>`;
  badge();
  $$("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); api("update_student", { session: TOKEN, lang: lang() }).catch(() => { }); viewProgress(); setTabs(SLUG, "progress"); });
  $("#snd").onclick = () => { store.set("sound", !store.get("sound", true)); viewProgress(); };
  $("#logout").onclick = async () => {
    if (!confirm(t("setLogoutQ"))) return;
    await SYNC.push();
    store.del("session"); store.del("code"); store.del("readySeen"); store.del(lsKey()); TOKEN = null; resetCourse();
    ctx.nav("#/");
  };
}
