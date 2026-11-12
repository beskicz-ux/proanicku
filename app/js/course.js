// The course itself: the map, notes, review, the profile with settings, the lesson players and sync.
import { $, $$, view, esc, store, api, today, addDays, shuffle, pick, norm, md, mdi, sfx, confetti, toast, ic } from "./util.js";
import { t, pl, lang, itemCount, errText, days as daysTxt, inDays, inWeeks, fmtDay, studyTime, courseLang } from "./i18n.js";
import { ham, teacher } from "./art.js";
import { mergeState, defaults } from "./merge.js";
import { daysBetween } from "./forecast.js";
import { viewVoice } from "./voice.js";
import { mix, chapterColour, TAB_ICONS, PRAC_ICONS, ringIcon, calIcon, doneIcon, timeIcon, GEAR, CHEV_DOWN, CHEV, CLOSE, NOTES_ICON, setIcon, LEVEL_ICONS, TICK, levelIcon, langSheet, langName, sheet, applyTheme } from "./ui.js";
import { rulerHtml, bindRuler, datePanel, carouselHtml, bindCarousel, startNewSubject } from "./app.js";

const DAY = 86400000;
export const TUTORS = [
  { id: "penny", idx: -1, name: "Penny", with: "s Penny" },
  { id: "bear", idx: 0, name: "Bára", with: "s Bárou" },
  { id: "fox", idx: 1, name: "Emil", with: "s Emilem" },
  { id: "cat", idx: 2, name: "Oskar", with: "s Oskarem" },
  { id: "pig", idx: 3, name: "Rozárka", with: "s Rozárkou" },
  { id: "frog", idx: 4, name: "Kvido", with: "s Kvidem" },
  { id: "panda", idx: 5, name: "Mia", with: "s Miou" },
];
const tutorOf = id => TUTORS.find(x => x.id === id) || TUTORS[0];
// Czech needs the instrumental ("Učit se s Emilem"); the other languages take the plain name in {name}.
export const tutorWith = id => lang() === "cs" ? tutorOf(id).with : tutorOf(id).name;
export function tutorArt(id, cls = "", mood = "open") {
  const x = tutorOf(id);
  return x.idx < 0 ? ham(mood, cls) : teacher(x.idx, cls);
}

/* ---------- state ---------- */
let ACCESS = { paid: true, building: false, status: "ready" }, restTimer = null;
let TAPPED = null; // the locked lesson the student tapped, so the store can name it
let C = null, SLUG = null, STUDENT = null, S = defaults(), ITEM = {}, LESSON = {}, TOKEN = null;
const lsKey = () => "progress." + SLUG;
export function resetCourse() { C = null; SLUG = null; clearTimeout(restTimer); }
const SYNC = {
  timer: null, state: "ok",
  later() { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 1500); this.state = "saving"; },
  async pull() {
    try { const r = await api("progress_load", { session: TOKEN }); S = mergeState(S, r.data); store.set(lsKey(), S); this.state = "ok"; } catch (e) { this.state = "offline"; }
  },
  async push() {
    clearTimeout(this.timer);
    try { const r = await api("progress_save", { session: TOKEN, data: S }); S = mergeState(S, r.data); store.set(lsKey(), S); this.state = "ok"; } catch (e) { this.state = "offline"; }
  },
};
addEventListener("online", () => { if (TOKEN) SYNC.push(); });
document.addEventListener("visibilitychange", () => { if (!TOKEN) return; if (document.hidden) { if (SYNC.state !== "ok") SYNC.push(); } else SYNC.pull(); });
function save() { S.saved = Date.now(); store.set(lsKey(), S); SYNC.later(); }

const doneToday = () => { const d = today(); S.done[d] = S.done[d] || {}; return S.done[d]; };
function addXP(n) { const d = today(); S.xp[d] = (S.xp[d] || 0) + n; doneToday().items = (doneToday().items || 0) + 1; save(); }
const totalMs = () => Object.values(S.done).reduce((a, d) => a + (d.ms || 0), 0);
const examDate = () => STUDENT?.examDate || C?.meta.examDate || null;
const daysToExam = () => examDate() ? daysBetween(today(), examDate()) : null;
const curTutor = () => store.get("tutor." + SLUG, null) || STUDENT?.tutor || C?.meta.tutor || "fox";

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
// Gold: every card repeated at least twice and every question answered right after two tries or more.
const solid = it => it.type === "flashcard" ? (S.cards[it.id]?.reps || 0) >= 2 : !!S.q[it.id]?.ok && (S.q[it.id]?.n || 0) >= 2;
const dueIds = () => Object.keys(S.cards).filter(id => ITEM[id] && S.cards[id].due <= Date.now());
const mistakeIds = () => Object.keys(S.q).filter(id => ITEM[id] && !S.q[id].ok);
const lessonPct = l => l.items.length ? l.items.filter(mastered).length / l.items.length : (S.lessons[l.id] ? 1 : 0);
function record(it, ok) { S.q[it.id] = { ok, last: Date.now(), n: (S.q[it.id]?.n || 0) + 1 }; save(); }
const allLessons = () => C.units.flatMap(u => u.lessons);
const openLessons = () => allLessons().filter(l => !l.locked);
const lockedCount = () => allLessons().length - openLessons().length;
const lastReview = l => Math.max(0, ...l.items.map(it => Math.max(S.cards[it.id]?.last || 0, S.q[it.id]?.last || 0)), S.lessons[l.id]?.ts || 0);
// Readiness: the average over every topic of how much is mastered; a topic's score halves for each 7 days since it was last reviewed.
// One level's readiness, 0-100: how much of it is mastered, halving for each 7 days since it was last practised.
const lessonReady = l => { const last = lastReview(l); return Math.round(lessonPct(l) * (last ? Math.pow(.5, Math.max(0, Date.now() - last) / (7 * DAY)) : 0) * 100); };
const chapterReady = ui => { const ls = C.units[ui].lessons; return ls.length ? Math.round(ls.reduce((a, l) => a + lessonReady(l), 0) / ls.length) : 0; };
// The ring drawn round a level on the map: full = ready for the test on this level.
// Map buttons are squished ellipses on a lip: [face width, face height, lip]. Keep in step with .n .c / .exam .c in app.css.
const NODE = { n: [76, 63, 7], cur: [76, 63, 7], test: [76, 63, 7], exam: [76, 63, 7] }; // every level and the exam the same size, like Anna's
// Readiness ring that hugs the button and its lip with a small even gap; starts at the top, runs clockwise.
const levelRing = (p, [fw, fh, lip]) => {
  const g = 4, sw = 7.5, rx = fw / 2 + g + sw / 2, ry = (fh + lip) / 2 + g + sw / 2, W = 2 * rx + sw, H = 2 * ry + sw, cx = W / 2, cy = H / 2;
  const d = `M${cx} ${cy - ry}A${rx} ${ry} 0 1 1 ${cx} ${cy + ry}A${rx} ${ry} 0 1 1 ${cx} ${cy - ry}`;
  return `<svg class="rg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="margin:${-H / 2 + lip / 2}px 0 0 ${-W / 2}px" aria-hidden="true"><path d="${d}" pathLength="100" class="rg-t"/>${p > 0 ? `<path d="${d}" pathLength="100" class="rg-p" stroke-dasharray="${Math.max(4, p)} 100"/>` : ""}</svg>`;
};
function readiness() {
  const ls = allLessons(); if (!ls.length) return 0;
  const now = Date.now();
  return Math.round(ls.reduce((a, l) => { const last = lastReview(l); return a + lessonPct(l) * (last ? Math.pow(.5, Math.max(0, now - last) / (7 * DAY)) : 0); }, 0) / ls.length * 100);
}

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

/* ---------- the store's view of this course: progress so far, what is locked, the exam. Null if the course can't load. ---------- */
export async function storeInfo(slug) {
  try { await loadCourse(slug); } catch { return null; }
  const ls = allLessons(), free = ls.filter(l => !l.locked), tap = TAPPED && LESSON[TAPPED]?.locked ? LESSON[TAPPED].title : "";
  return { tutor: curTutor(), exam: examDate(), left: daysToExam(), done: free.filter(l => lessonPct(l) >= 1).length, free: free.length,
    locked: ls.length - free.length, tapped: tap,
    units: C.units.map((u, ci) => ({ ci, title: u.title, n: u.lessons.filter(l => l.locked).length, titles: u.lessons.filter(l => l.locked).map(l => l.title) })).filter(u => u.n),
    pages: coursePages(ls) };
}
// Slide pages the whole course covers, from each lesson's page ranges (locked stubs carry them too). 0 if the course has none.
function coursePages(ls) {
  return ls.reduce((n, l) => n + (Array.isArray(l.pages) ? l.pages.reduce((m, r) => m + (r && r.to >= r.from ? r.to - r.from + 1 : 0), 0) : 0), 0);
}

/* ---------- presentation tags (1A, 1B, 2A…) ---------- */
// A level shows a chip like "1A" only when the student's own presentations are tagged that way: every lesson's source
// carries a tag (Anna's lecture ids, or a tag in the file name such as "1A Derivace.pdf" / "prednaska_2b.pptx") and
// there are at least two different ones. Otherwise no chip: we never invent numbering the slides don't have.
let TAGS = null;
const fileTag = f => { const m = String(f || "").replace(/\.[a-z0-9]{2,5}$/i, "").match(/(?:^|[\s_\-.(\[])0?(\d{1,2})\s?([a-z])(?=$|[\s_\-.)\]])/i); return m ? m[1] + m[2].toUpperCase() : ""; };
function lessonTags() {
  const out = {}, seen = new Set();
  for (const l of allLessons()) {
    const src = [...(l.reading || []), ...l.items].map(x => x.source).find(Boolean);
    const tag = src?.lecture ? String(src.lecture).toUpperCase() : fileTag(src?.file);
    if (!tag) return null;
    out[l.id] = tag; seen.add(tag);
  }
  return seen.size >= 2 ? out : null;
}

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
  TAGS = lessonTags();
  S = Object.assign(defaults(), store.get(lsKey(), {}));
  await SYNC.pull();
}
export async function courseRoute(parts, nav, render) {
  const [slug, sub, arg] = parts;
  if (!C || SLUG !== slug) $("#view").innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  try { await loadCourse(slug); }
  catch (e) {
    if (e.status === 401) { store.del("session"); toast(t("sessionExpired")); return nav("#/login"); }
    if (e.code === "not_ready") return nav("#/wait");
    $("#nav").hidden = true;
    view().innerHTML = `<div class="ob ob-center">${tutorArt(curTutor(), "", "sad")}<h1 class="ob-h">${t("courseFail")}</h1><p class="ob-sub">${esc(errText(e.code))}</p><div class="ob-foot"><button class="btn-p" id="again">${t("retry")}</button></div></div>`;
    $("#again").onclick = render;
    return;
  }
  ctx = { nav, render, slug };
  setTabs(slug, sub);
  if (!sub) return viewMap();
  if (sub === "notes") return viewNotes(arg);
  if (sub === "practice") return viewPractice();
  if (sub === "progress") return viewProfile();
  if (sub === "settings") return viewSettings();
  if (sub === "voice") return viewVoice({ token: TOKEN, art: tutorArt(curTutor(), "bob"), topbar: "", onOut: () => { store.del("session"); nav("#/login"); } });
  if (sub === "lesson") return startLesson(arg);
  if (sub === "test") return startTest(+arg);
  if (sub === "gold") return startGold(arg);
  if (sub === "review") return startReview(arg);
  nav("#/s/" + slug);
}
let ctx = null;
const TAB_COL = { home: "var(--accent)", notes: "var(--accent)", review: "var(--accent)", progress: "var(--accent)" }; // one selected colour for every tab
function setTabs(slug, sub) {
  const n = $("#nav");
  const show = !sub || ["notes", "practice", "progress"].includes(sub);
  n.hidden = !show; document.body.classList.toggle("has-tabs", show);
  const on = { "": "home", notes: "notes", practice: "review", progress: "progress" }[sub || ""];
  $$("a", n).forEach(a => {
    const k = a.dataset.k;
    a.href = `#/s/${slug}` + { home: "", notes: "/notes", review: "/practice", progress: "/progress" }[k];
    const label = t({ home: "navHome", notes: "navNotes", review: "navReview", progress: "navProgress" }[k]);
    a.setAttribute("aria-label", label);
    a.style.setProperty("--tc", TAB_COL[k]);
    if (!a.querySelector("svg")) a.innerHTML = TAB_ICONS[k] + '<span class="nl" aria-hidden="true"></span>';
    a.querySelector(".nl").textContent = label;
    a.classList.toggle("on", k === on);
    if (k === on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

/* ---------- top bar: subject, readiness, days to the exam ---------- */
function topbar() {
  const left = daysToExam(), r = readiness(), title = C.meta.subject || C.meta.title || "";
  return `<header class="tb"><button class="subj"><span class="sq">${esc((title[0] || "P").toUpperCase())}</span><b>${esc(title)}</b>${CHEV_DOWN}</button>
    <div class="mets"><a class="met ready" href="#/s/${SLUG}/progress" aria-label="${t("readinessTitle")}: ${r} %">${ringIcon(r)}<span>${r} %</span></a>
    ${left == null ? "" : `<a class="met" href="#/s/${SLUG}/progress" aria-label="${esc(daysTxt(Math.max(0, left)))} ${t("toExam")}">${calIcon(new Date(examDate() + "T12:00").getDate())}<span>${esc(daysTxt(Math.max(0, left)))}</span></a>`}</div></header>`;
}
// The subject switcher: every course of the account, the current one ticked, and + New subject.
// The account's list is fetched when the top bar is drawn and kept, so the sheet opens complete (no row popping in later);
// opening it refreshes the list quietly and only redraws if something changed.
let ACCT = null; // { token, a }: the last account reply for this session
const acctFetch = () => { const tk = TOKEN; return api("account", { session: tk }).then(a => (ACCT = { token: tk, a }, a)); };
function bindTopbar() {
  const title = C.meta.subject || C.meta.title || "";
  if (ACCT?.token !== TOKEN) { ACCT = { token: TOKEN, a: null }; acctFetch().catch(() => { }); }
  const row = c => `<button class="subrow${c.current ? " on" : ""}" data-slug="${esc(c.slug)}"><span class="sq">${esc(((c.current ? title : c.title) || "?")[0].toUpperCase())}</span><div><b>${esc(c.current ? C.meta.title || title : c.title || t("subjUntitled"))}</b><small>${t(!c.ready ? "subjBuilding" : c.paid ? "payPaid" : "payFree")}</small></div>${c.current ? `<i class="lok">${TICK}</i>` : ""}</button>`;
  const add = `<button class="subrow add" id="subNew"><span class="sq">+</span><div><b>${t("subjNew")}</b><small>${t("subjNewSub")}</small></div></button>`;
  const me = { slug: SLUG, current: true, ready: true, paid: ACCESS.paid };
  // Before the first reply: this subject, and + New subject when signed in with an account (an e-mail is stored).
  const rows = a => a ? (a.courses.length ? a.courses : [me]).map(row).join("") + (a.account ? add : "") : row(me) + (store.get("email") ? add : "");
  $$(".subj").forEach(b => b.onclick = async () => {
    if (HOVER.matches) return popOpen(b, "subj"); // a mouse: the subjects drop down under the button instead of a sheet
    const html = rows(ACCT?.a);
    const s = sheet(`<h2 class="sh-h">${t("subjTitle")}</h2><div class="sh-list" id="subList">${html}</div>`);
    wireSubjects(s.el, s.close);
    try {
      const fresh = rows(await acctFetch()), list = s.el.querySelector(".sh-list");
      if (list && s.el.isConnected && fresh !== html) { list.innerHTML = fresh; wireSubjects(s.el, s.close); }
    } catch (e) { /* offline: what we had is enough */ }
  });
  // With a mouse, the subject button, the readiness ring and the countdown each open a little card on hover (like
  // Duolingo's streak card). Clicking the ring or the countdown still opens Progress.
  if (HOVER.matches) $$(".tb").forEach(tb => {
    const [ready, exam] = tb.querySelectorAll(".met");
    [[tb.querySelector(".subj"), "subj"], [ready, "ready"], [exam, "exam"]].forEach(([el, kind]) => {
      if (!el) return;
      el.onmouseenter = () => { clearTimeout(popT); popT = setTimeout(() => popOpen(el, kind), POP ? 0 : 90); };
      el.onmouseleave = () => { clearTimeout(popT); popT = setTimeout(popClose, 200); };
      el.onfocus = () => popOpen(el, kind);
    });
  });
  subjRows = rows;
}
let subjRows = () => "";
// The subject rows work the same in the sheet (phone) and the drop-down (mouse): pick one to switch, + to start a new one.
function wireSubjects(root, close) {
  root.querySelectorAll("[data-slug]").forEach(x => x.onclick = async () => {
    if (x.dataset.slug === SLUG) return close();
    x.disabled = true;
    try {
      await SYNC.push();
      const r = await api("switch_course", { session: TOKEN, slug: x.dataset.slug });
      store.set("session", { token: r.session, slug: r.student.slug }); TOKEN = r.session; close(); resetCourse();
      ctx.nav(r.course ? "#/s/" + r.student.slug : "#/wait");
    } catch (e) { x.disabled = false; toast(errText(e.code)); }
  });
  // + New subject: the row shows it's working and stays until the setup is ready, then the files step opens
  const n = root.querySelector(".subrow.add"); if (n) n.onclick = async () => {
    n.disabled = true; n.classList.add("busy");
    try { const to = await startNewSubject(); close(); ctx.nav(to); }
    catch (e) { n.disabled = false; n.classList.remove("busy"); toast(errText(e.code)); }
  };
}

/* ---------- hover cards on the top bar: subjects, readiness, countdown ---------- */
const HOVER = matchMedia("(hover:hover) and (pointer:fine)");
let POP = null, popT = 0;
// days in a row with any study, counting back from today (or from yesterday while today is still open)
function studyStreak() {
  let d = today(), n = 0;
  if (!(S.xp[d] > 0)) d = addDays(d, -1);
  while (S.xp[d] > 0) { n++; d = addDays(d, -1); }
  return n;
}
const CHECK = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const FLAG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4m0 1h11l-2.5 4L17 13H6" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const wd = iso => { try { return new Date(iso + "T12:00").toLocaleDateString(lang(), { weekday: "short" }).replace(".", "").slice(0, 2); } catch (e) { return ""; } };
function popHtml(kind) {
  if (kind === "subj") return `<div class="hc-lbl">${t("popCourses")}</div><div class="hc-list">${subjRows(ACCT?.a)}</div>`;
  if (kind === "ready") {
    // a round flask that fills to the readiness with a wobbling surface and rising bubbles; the number counts up
    const r = readiness();
    const wave = "M0 6 Q 12.5 0 25 6 T 50 6 T 75 6 T 100 6 T 125 6 T 150 6 T 175 6 T 200 6 V 120 H 0 Z";
    return `<div class="hc-top"><div class="flask" style="--lvl:${Math.max(3, r)}%" aria-hidden="true"><i class="fl-liq"><svg viewBox="0 0 200 120" preserveAspectRatio="none"><path d="${wave}"/></svg><svg class="w2" viewBox="0 0 200 120" preserveAspectRatio="none"><path d="${wave}"/></svg></i>
        <i class="bub b1"></i><i class="bub b2"></i><i class="bub b3"></i><i class="fl-shine"></i><b class="fl-n" data-to="${r}">0 %</b></div>
      <div class="hc-t"><b>${t("readinessTitle")}</b><p>${t("popReadySub")}</p></div></div>`;
  }
  // the calendar counts down to the days left; under it the road from today to the exam, one stop per day
  const ex = examDate(), left = Math.max(0, daysToExam()), now = today(), streak = studyStreak(), doneToday = S.xp[now] > 0;
  const idx = left <= 7 ? [...Array(left + 1).keys()] : [0, 1, 2, 3, 4, 5, -1, left];
  const stops = idx.map((k, j) => {
    if (k < 0) return `<i class="dy gap" style="--i:${j}"><small>&nbsp;</small><span>…</span></i>`;
    const d = addDays(now, k), cls = k === left ? " ex" : k === 0 ? (doneToday ? " now done" : " now") : "";
    return `<i class="dy${cls}" style="--i:${j}"><small>${esc(wd(d))}</small><span>${k === left ? FLAG : k === 0 && doneToday ? CHECK : ""}</span></i>`;
  }).join("");
  return `<div class="hc-top"><div class="cal" aria-hidden="true"><i class="tr-ring"></i><i class="tr-ring r2"></i><div class="tr-pg"><b data-to="${left}">${left}</b></div></div>
      <div class="hc-t"><b>${esc(daysTxt(left))} ${t("toExam")}</b><p>${esc(fmtDay(ex))}</p></div></div>
    <div class="road"><div class="dys" style="--n:${idx.length}">${stops}</div>
      <p>${doneToday ? t("todayDone") : t("todayNot")}${streak ? ` · <b>${esc(daysTxt(streak))}</b> ${t("inARow")}` : ""}</p></div>`;
}
const calm = () => matchMedia("(prefers-reduced-motion:reduce)").matches;
// counts the flask's number up while it fills
function countUp(el) {
  const n = el.querySelector(".fl-n"); if (!n) return;
  const to = +n.dataset.to, t0 = performance.now(), dur = calm() ? 0 : 900;
  const tick = now => { const k = dur ? Math.min(1, (now - t0 - 150) / dur) : 1, e = 1 - Math.pow(1 - Math.max(0, k), 3); n.textContent = Math.round(to * e) + " %"; if (k < 1 && el.isConnected) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
// the calendar's number ticks down to the days left, slowing as it lands
function countDown(el) {
  const n = el.querySelector(".cal b"); if (!n || calm()) return;
  const to = +n.dataset.to, steps = 7; let k = 0;
  n.textContent = to + steps;
  const step = () => {
    if (!el.isConnected) return;
    k++; n.textContent = to + steps - k;
    n.classList.remove("tk"); void n.offsetWidth; n.classList.add(k === steps ? "land" : "tk");
    if (k < steps) setTimeout(step, 55 + k * k * 9);
  };
  setTimeout(step, 180);
}
function popClose(now) {
  clearTimeout(popT);
  const p = POP; if (!p) return;
  POP = null; p.trig.classList.remove("popped"); p.el.classList.remove("in");
  if (now === true) p.el.remove(); else setTimeout(() => p.el.remove(), 170);
}
function popOpen(trig, kind) {
  clearTimeout(popT);
  if (POP?.trig === trig) return;
  popClose(true);
  const el = document.createElement("div");
  el.className = "hc hc-" + kind; el.setAttribute("role", kind === "subj" ? "menu" : "dialog");
  el.innerHTML = popHtml(kind);
  document.body.append(el);
  const r = trig.getBoundingClientRect(), w = el.offsetWidth, left = Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  el.style.left = left + "px"; el.style.top = r.bottom + 12 + "px"; el.style.setProperty("--ax", r.left + r.width / 2 - left + "px");
  POP = { el, trig }; trig.classList.add("popped");
  el.onmouseenter = () => clearTimeout(popT);
  el.onmouseleave = () => { clearTimeout(popT); popT = setTimeout(popClose, 200); };
  if (kind === "subj") {
    wireSubjects(el, () => popClose(true));
    acctFetch().then(a => { const list = el.querySelector(".hc-list"), fresh = subjRows(a); if (list && el.isConnected && list.innerHTML !== fresh) { list.innerHTML = fresh; wireSubjects(el, () => popClose(true)); } }).catch(() => { });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("in")));
  if (kind === "ready") countUp(el);
  if (kind === "exam") countDown(el);
}
addEventListener("keydown", e => { if (e.key === "Escape") popClose(); });
addEventListener("scroll", () => { if (POP) popClose(true); }, { passive: true });
addEventListener("hashchange", () => popClose(true));
// One desktop frame for the map, practice and progress: a content column and a side column whose top is the stats row.
// Below 1200px the side column is hidden and the page is the content column alone (its own top bar shows instead).
function framed(page, main) {
  document.body.classList.add("framed");
  return `<div class="mlay pg-${page}"><div class="mmain">${main}</div>${sidePanel(lockedCount(), page)}</div>`;
}

/* ---------- the map: one column, bottom-up, chapters in colour ---------- */
// Every chapter ends with a test (a mixed round of the chapter's items). Levels open one after another.
function nodes() {
  const out = [];
  C.units.forEach((u, ui) => {
    u.lessons.forEach((l, k) => out.push({ kind: "lesson", ui, l, k, done: lessonPct(l) >= 1, gold: l.items.length > 0 && (l.items.every(solid) || !!S.lessons["gold:" + l.id]), locked: !!l.locked }));
    const items = u.lessons.flatMap(l => l.items);
    if (items.length) { const r = S.lessons["test:" + (u.id || ui)]; out.push({ kind: "test", ui, done: !!r, gold: !!r && r.best >= .9, locked: u.lessons.some(l => l.locked) }); }
  });
  const cur = out.findIndex(n => !n.done);
  out.forEach((n, i) => { n.cur = i === cur && !n.locked; n.next = cur >= 0 && i > cur; });
  return { list: out, cur };
}
const MAPMAX = 590; // widest the map gets; wider screens get the side panel instead of empty map
// Top-down like a book: chapter divider, its levels, the next chapter, and the exam goal at the end.
const TOPPAD = 8, EXAMH = 300, BANH = 112; // BANH: a unit banner plus the gap under it
// Desktop (side panel showing) packs the nodes tighter with a gentler zig-zag; phones keep the roomier map.
// the short name under a level: the course's own short title if it has one, else the topic half of "Topic: detail"
const mapName = l => {
  if (l.short) return l.short;
  const t = (l.title || "").trim(); if (t.length <= 24) return t;
  const parts = t.split(/\s*[:–—]\s+|\s+-\s+/).filter(Boolean);
  return parts.length > 1 && parts[0].split(" ").length > 1 ? parts[0] : t;
};
const mapSpacing = () => matchMedia("(min-width:1200px)").matches ? { STEPY: 166, CURX: 0, SWX: .8 } : { STEPY: 158, CURX: 0, SWX: 0 };
const SWAY = [0, 56, 74, 40, -12, -58, -74, -40];
// The goal at the end of the map: a solid trophy on a gold coin.
const EXAM_CUP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3h11v5.5a5.5 5.5 0 0 1-11 0z" fill="currentColor"/><path d="M6.6 5H3.8v1.6a3.6 3.6 0 0 0 3.4 3.6M17.4 5h2.8v1.6a3.6 3.6 0 0 1-3.4 3.6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="10.8" y="13" width="2.4" height="4" fill="currentColor"/><rect x="7" y="17.5" width="10" height="3" rx="1.5" fill="currentColor"/></svg>`;
const EXAM_FLAG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="2.8" height="19" rx="1.4" fill="currentColor"/><path d="M6.4 3.6h11.9c.8 0 1.2.9.7 1.5l-2.6 3.4 2.6 3.4c.5.6.1 1.5-.7 1.5H6.4z" fill="currentColor"/></svg>`;
function examLine() {
  const left = daysToExam();
  if (left == null) return "";
  if (left < 0) return t("examPast");
  if (left === 0) return t("examToday");
  return `${fmtDay(examDate())} · ${left < 14 ? inDays(left) : inWeeks(Math.round(left / 7))}`;
}
function viewMap() {
  const { list, cur } = nodes(), locked = lockedCount();
  document.body.classList.add("map-page");
  TAPPED = null; // the store names the lesson tapped since the map was last shown
  view().innerHTML = framed("map", `<div class="mtop">${topbar()}</div>${unlockCard(locked)}<div class="mapv"><div class="mw" id="mw"></div></div>`);
  bindTopbar();
  const { STEPY, CURX, SWX } = mapSpacing();
  const mw = $("#mw"), W = Math.min(MAPMAX, mw.clientWidth || 375), CX = W / 2, sc = Math.min(1.15, W / 375), sw = SWX || Math.min(1.7, W / 375);
  mw.dataset.w = W;
  const byCh = C.units.map((u, ui) => list.filter(n => n.ui === ui));
  let out = "", y = TOPPAD, k = 0, curPt = -1, curY = 0;
  const pts = [], chTop = [];
  C.units.forEach((u, ui) => {
    const col = chapterColour(ui), top = y;
    // Every unit opens with its own banner in its colour, like Anna's.
    const nDone = byCh[ui].filter(n => n.done).length;
    out += `<div class="ubn" style="top:${y}px"><div class="unit" style="background:${col};--uc:${col}"><div><small>${t("chapter", { n: ui + 1 })} · ${t("doneOf", { x: nDone, y: byCh[ui].length })}</small><b>${esc(u.title)}</b></div><a class="guide" href="#/s/${SLUG}/notes/${ui}">${HUB.book}<span>${t("guide")}</span></a></div></div>`;
    y += BANH;
    const me = curTutor();
    byCh[ui].forEach((n, j) => {
      const big = n.cur ? CURX : 0, ny = y + STEPY / 2 + big * .75, nx = CX + SWAY[k % SWAY.length] * sw;
      pts.push([nx, ny]);
      const state = n.locked || n.next ? "nlock" : n.cur ? "cur" : n.gold ? "gold" : n.done ? "done" : "cur";
      const icon = n.kind === "test" ? LEVEL_ICONS.test : levelIcon(n.l.title, n.k);
      const rp = !n.cur ? null : n.kind === "test" ? chapterReady(ui) : lessonReady(n.l); // the ring only goes round the level in progress
      const label = (n.kind === "test" ? `${t("testTitle")}: ${u.title}` : n.l.title) + (rp == null ? "" : ` · ${rp} % ${t("readiness")}`);
      const key = n.kind === "test" ? `data-test="${ui}"` : `data-lesson="${esc(n.l.id)}"`;
      const name = n.kind === "test" ? t("unitQuiz") : mapName(n.l), chip = n.kind === "test" || !TAGS?.[n.l.id] ? "" : `<i>${esc(TAGS[n.l.id])}</i>`;
      out += `<div class="n ${state} ${n.kind === "test" ? "test" : ""}" style="left:${nx}px;top:${ny}px;--chc:${col}">
        ${rp == null ? "" : levelRing(rp, NODE[n.kind === "test" ? "test" : "cur"])}<button class="c" ${key} data-state="${n.locked ? "paywall" : n.next ? "next" : n.done && !n.gold && !n.cur ? "gold" : "open"}" aria-label="${esc(label)}">${icon}${(n.done || n.gold) && !n.cur ? `<span class="tick">${TICK}</span>` : ""}</button><span class="nl" aria-hidden="true">${esc(name)}${chip}</span></div>`;
      if (n.cur) { curPt = pts.length - 1; curY = ny; }
      // One tutor on the whole map, beside the level in progress (one per chapter looked spammy, Marek 2026-11-11)
      if (n.cur) out += `<div class="tut" style="left:${nx > CX ? nx - 140 * sc : nx + 140 * sc}px;top:${ny + 14}px">${tutorArt(me, "", "happy")}</div>`;
      y += STEPY + big; k++;
    });
    y += 28; // room between the last level's name and the next banner
    chTop.push([top, y]);
  });
  const EXAMY = y + 110, total = y + EXAMH;
  // Bright gold once every level is done or the exam is a week away; muted gold before that.
  const left = daysToExam(), near = (list.length && list.every(n => n.done)) || (left != null && left <= 7);
  out += `<div class="exam ${near ? "near" : "far"}" style="top:${EXAMY}px;left:${CX}px"><div class="eb"><div class="c">${EXAM_CUP}</div>${curPt < 0 ? `<div class="etut">${tutorArt(curTutor(), "", "happy")}</div>` : ""}</div><b>${t("exam")}</b><small>${esc(examLine())}</small></div>`;
  mw.style.height = total + "px"; mw.style.width = W + "px"; mw.innerHTML = out;
  // The header shows the chapter in view.
  const curIdx = cur < 0 ? list.length : cur;
  const head = ui => {
    const col = chapterColour(ui), h = $("#unitHead"); if (!h || h.dataset.ui == ui) return;
    h.dataset.ui = ui;
    h.style.background = col;
    h.style.setProperty("--uc", col);
    h.innerHTML = `<div><small>${t("chapter", { n: ui + 1 })} · ${t("doneOf", { x: list.filter(n => n.ui === ui && n.done).length, y: list.filter(n => n.ui === ui).length })}</small><b>${esc(C.units[ui].title)}</b></div><a class="guide" href="#/s/${SLUG}/notes/${ui}">${HUB.book}<span>${t("guide")}</span></a>`;
  };
  const mwTop = () => mw.getBoundingClientRect().top + scrollY;
  const onScroll = () => {
    const mid = scrollY + innerHeight * .55 - mwTop();
    let ui = chTop.findIndex(([top, bot]) => mid >= top && mid <= bot);
    if (ui < 0) ui = mid < (chTop[0]?.[0] ?? 0) ? 0 : C.units.length - 1;
    head(ui);
  };
  head(cur >= 0 ? list[cur].ui : C.units.length - 1);
  window.onscroll = onScroll;
  $$("[data-lesson],[data-test]", mw).forEach(b => b.onclick = () => {
    const st = b.dataset.state;
    if (st === "paywall") { TAPPED = b.dataset.lesson ?? null; return ACCESS.paid ? toast(t(ACCESS.status === "failed" ? "restFailed" : "restBuilding")) : ctx.nav("#/unlock"); }
    if (st === "next") return toast(t(b.dataset.test != null ? "testLocked" : "levelLocked"));
    if (st === "gold") return goldSheet(b.dataset.lesson, b.dataset.test);
    ctx.nav(b.dataset.test != null ? `#/s/${SLUG}/test/${b.dataset.test}` : `#/s/${SLUG}/lesson/${b.dataset.lesson}`);
  });
  requestAnimationFrame(() => { scrollTo({ top: Math.max(0, mwTop() + (curPt >= 0 ? curY : EXAMY) - innerHeight * .55), behavior: "instant" }); onScroll(); });
  if (locked && ACCESS.building) watchRest();
}
// Free start: the card that sells the rest, or says the rest is being written.
// Wide screens only (CSS hides it below 1200px): today's tasks, readiness, the tutor. No streak: readiness and the countdown replace it.
function sidePanel(locked, page = "map") {
  const r = readiness(), left = daysToExam(), due = dueIds().length, seen = Object.keys(S.cards).length + Object.keys(S.q).length;
  const ls = openLessons(), done = ls.filter(l => lessonPct(l) >= 1).length;
  const tasks = [];
  if (due) tasks.push([`#/s/${SLUG}/review/due`, HUB.cards, t("taskCards")]);
  ls.filter(l => lessonPct(l) < 1).slice(0, 3).forEach(l => tasks.push([`#/s/${SLUG}/lesson/${encodeURIComponent(l.id)}`, HUB.book, t("taskLearn", { name: l.title })]));
  if (seen) tasks.push([`#/s/${SLUG}/review/mix`, HUB.bolt, t("taskMix")]);
  const taskCard = tasks.length ? `<div class="sc"><div class="sc-h"><b>${t("todayTasks")}</b></div>${tasks.map(([href, icon, label]) => `<a class="task" href="${href}"><span class="ico">${icon}</span><b>${esc(label)}</b></a>`).join("")}</div>` : "";
  const readyCard = `<a class="sc sc-ready" href="#/s/${SLUG}/progress">${ringIcon(r, 64)}<div><b>${r} %</b><span>${t("readinessTitle")} · ${esc(t("doneOf", { x: done, y: ls.length }))}</span></div>${left == null ? "" : `<div class="sc-exam">${calIcon(new Date(examDate() + "T12:00").getDate())}<div><b>${esc(daysTxt(Math.max(0, left)))}</b><span>${t("toExam")}</span></div></div>`}</a>`;
  const cards = { map: [taskCard, readyCard], practice: [readyCard, taskCard], progress: [taskCard] }[page] || [taskCard, readyCard];
  return `<aside class="side"><div class="side-tb">${topbar()}</div>
    ${locked ? unlockCard(locked) : ""}${cards.join("")}
    ${C.meta.voice ? `<a class="sc sc-ask" href="#/s/${SLUG}/voice">${tutorArt(curTutor())}<div><b>${t("voiceTitle")}</b><span>${t("voiceSub")}</span></div></a>` : ""}</aside>`;
}
function unlockCard(locked) {
  if (!locked) return "";
  if (!ACCESS.paid) return `<a class="pc-unlock" href="#/unlock"><i class="ul-ic">${ic.lock}</i><div><b>${t("unlockCard")}</b><span>${t("unlockCardSub").replace("%", locked)}</span></div><i class="ul-go">${CHEV}</i></a>`;
  if (ACCESS.status === "failed") return `<div class="pc-unlock off" role="status"><div><b>${t("restFailed")}</b></div></div>`;
  return `<div class="pc-unlock off" role="status"><div><b>${t("restBuilding")}</b><span>${t("restBuildingSub")}</span></div></div>`;
}
// While the rest of a paid course is written, checks every 20 s and reloads the map when it's there. Progress stays: lesson IDs don't change.
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

/* ---------- notes: the reading sections, chapter by chapter ---------- */
// Notes: a banner with the tutor, then each chapter as a coloured banner like the map, every section a numbered
// row that turns into a tick once read, and the locked lessons listed (with a lock) so you can see what unlocking adds.
const LOCK_IC = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10.5" width="14" height="10" rx="2.6" fill="currentColor"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`;
function viewNotes(arg) {
  let all = 0, read = 0;
  const chapters = C.units.map((u, ui) => {
    const col = chapterColour(ui);
    const secs = u.lessons.flatMap(l => l.locked ? [] : (l.reading || []));
    const locked = u.lessons.filter(l => l.locked);
    const nRead = secs.filter(x => S.read[x.id]).length;
    all += secs.length; read += nRead;
    const rows = secs.map((x, i) => `<details class="note${S.read[x.id] ? " read" : ""}" data-sec="${esc(x.id)}"><summary><span class="nn">${S.read[x.id] ? TICK : i + 1}</span><b>${esc(x.title)}</b>${CHEV}</summary><div class="md">${md(x.body)}</div>${srcLine(x)}</details>`).join("");
    const lockRows = locked.map(l => `<a class="note nlk" href="#/unlock"><span class="nn">${LOCK_IC}</span><b>${esc(l.title)}</b><i class="nlk-go">${t("notesUnlock")}</i></a>`).join("");
    const empty = !secs.length && !locked.length ? `<p class="note-empty">${t("notesEmpty")}</p>` : "";
    const line = secs.length ? ` · <span class="nr">${t("notesRead", { x: nRead, y: secs.length })}</span>` : "";
    return `<section class="nch" id="nch${ui}" style="--chc:${col}"><div class="nch-h"><div><small>${t("chapter", { n: ui + 1 })}${line}</small><b>${esc(u.title)}</b></div><span class="nch-ic">${NOTES_ICON}</span></div>${rows}${lockRows}${empty}</section>`;
  }).join("");
  const banner = `<div class="banner c-blue nbanner"><div class="t"><h2>${t("notesTitle")}</h2><p>${t("notesBanner")}</p>${all ? `<span class="nb-count">${t("notesRead", { x: read, y: all })}</span>` : ""}</div><div class="art">${tutorArt(curTutor())}</div><i class="arc"></i><i class="cloud"></i></div>`;
  view().innerHTML = framed("notes", `${topbar()}<div class="pg notes-pg">${banner}${C.units.length ? chapters : `<p class="note-empty">${t("notesNone")}</p>`}</div>`);
  bindTopbar();
  // opening a section counts as reading it
  $$("details.note").forEach(d => d.addEventListener("toggle", () => {
    if (!d.open || S.read[d.dataset.sec]) return;
    S.read[d.dataset.sec] = Date.now(); save(); d.classList.add("read"); d.querySelector(".nn").innerHTML = TICK;
    // keep the counts in the chapter banner and the top banner in step
    const cnt = el => { const r = $$("details.note", el), x = r.filter(n => n.classList.contains("read")).length; return t("notesRead", { x, y: r.length }); };
    const ch = d.closest(".nch").querySelector(".nr"); if (ch) ch.textContent = cnt(d.closest(".nch"));
    const nb = $(".nb-count"); if (nb) nb.textContent = cnt(document);
  }));
  if (arg != null && $("#nch" + arg)) { const x = $("#nch" + arg); x.querySelector("details")?.setAttribute("open", ""); requestAnimationFrame(() => x.scrollIntoView({ block: "start" })); }
}


/* ---------- session runner ---------- */
const ROUND = 10;
function startLesson(id) {
  const l = LESSON[id];
  if (l?.locked) TAPPED = id;
  if (!l || l.locked) return ctx.nav(l && !ACCESS.paid ? "#/unlock" : "#/s/" + SLUG);
  const unread = (l.reading || []).filter(s => !S.read[s.id]);
  const todo = l.items.filter(it => !mastered(it));
  const pool = todo.length ? todo : l.items;
  const own = pool.slice(0, ROUND - 2), back = reviewPicks(l, 2);
  const items = [...own]; back.forEach((it, i) => items.splice(Math.min(items.length, 2 + i * 3), 0, it));
  runSession({ title: l.title, reading: unread, items, lesson: l, back: "#/s/" + SLUG });
}
// Up to n questions from earlier, already-seen levels: due cards and past mistakes first, then the oldest.
function reviewPicks(l, n) {
  const seen = Object.values(ITEM).filter(it => it._l !== l.id && !LESSON[it._l]?.locked && (S.cards[it.id] || S.q[it.id]));
  const score = it => (S.q[it.id] && !S.q[it.id].ok ? 0 : S.cards[it.id]?.due <= Date.now() ? 1 : 2) * 1e13 + Math.max(S.cards[it.id]?.last || 0, S.q[it.id]?.last || 0);
  return seen.sort((a, b) => score(a) - score(b)).slice(0, n);
}
// The chapter test: a mixed round of everything in the chapter.
function startTest(ui) {
  const u = C.units[ui];
  if (!u || u.lessons.some(l => l.locked)) return ctx.nav("#/s/" + SLUG);
  const items = shuffle(u.lessons.flatMap(l => l.items)).slice(0, 12);
  if (!items.length) return ctx.nav("#/s/" + SLUG);
  runSession({ title: `${t("testTitle")}: ${u.title}`, reading: [], items, test: u.id || ui, back: "#/s/" + SLUG });
}
// Gold (like Duolingo's Legendary): a finished level, every question once, no reading. 90 % on first tries turns it gold.
const GOLD_AT = 90;
function startGold(id) {
  const l = LESSON[id];
  if (!l || l.locked || !l.items.length) return ctx.nav("#/s/" + SLUG);
  runSession({ title: l.title, reading: [], items: shuffle(l.items), gold: l, back: "#/s/" + SLUG });
}
function goldSheet(lessonId, test) {
  const isTest = test != null, href = isTest ? `#/s/${SLUG}/test/${test}` : `#/s/${SLUG}/gold/${encodeURIComponent(lessonId)}`;
  const s = sheet(`<div class="gold-ic" aria-hidden="true">${EXAM_CUP}</div><h2 class="sh-h">${t("goldTitle")}</h2><p class="sh-p">${t(isTest ? "goldTestSub" : "goldSub", { n: GOLD_AT })}</p>
    <a class="btn-p gold-go" href="${href}" id="goldGo">${t("goldGo")}</a>${isTest ? "" : `<a class="btn-s" href="#/s/${SLUG}/lesson/${encodeURIComponent(lessonId)}" id="goldRep">${t("goldRepeat")}</a>`}`);
  $$("a", s.el).forEach(a => a.addEventListener("click", () => s.close()));
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
  const st = { ...cfg, reading: [...cfg.reading], queue: [...cfg.items], total: cfg.reading.length + cfg.items.length, right: 0, answered: 0, xp: 0, retried: new Map(), firstSeen: new Set(), firstN: 0, firstRight: 0, started: Date.now(), tick: Date.now() };
  step(st);
}
function step(st) {
  const now = Date.now(); doneToday().ms = (doneToday().ms || 0) + Math.min(120e3, now - st.tick); st.tick = now; // study time, capped per step
  window.onkeydown = null;
  window.scrollTo({ top: 0, behavior: "instant" });
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
  if (!st.firstSeen.has(it.id)) { st.firstSeen.add(it.id); st.firstN++; if (ok) st.firstRight++; } // the score counts first tries; retries are for learning
  if (ok) { st.right++; addXP(10); st.xp += 10; sfx.right(); } else { addXP(1); st.xp += 1; sfx.wrong(); }
  $("#qdock")?.remove();
  const fb = document.createElement("div");
  fb.className = "feedback " + (ok ? "good" : "badf");
  fb.innerHTML = `<div class="in"><h3><span class="ok-ico">${ok ? ic.check : ic.x}</span>${esc(verdict || (ok ? pick([t("say1"), t("say2"), t("say3"), t("say4")]) : t("correctIs")))}</h3>
    ${ok ? "" : `${answerHtml}<div class="md">${md(it.explanation || "")}</div>${srcLine(it)}`}
    <div class="row"><button class="btn ${ok ? "ok" : "bad"} big" style="flex:1" id="fbNext">${t("cont")}</button></div></div>`;
  document.body.appendChild(fb);
  const go = () => {
    fb.remove(); window.onkeydown = null;
    st.queue.shift();
    if (!ok && (st.retried.get(it.id) || 0) < 3) { st.retried.set(it.id, (st.retried.get(it.id) || 0) + 1); st.queue.push(it); st.total++; } // back at the end until it's right, as in Duolingo
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
    // Two honest choices instead of Anki's four: students can't reliably tell "hard" from "good" from "easy",
    // and the choice itself costs attention. Knew it = normal spacing; didn't = comes back this round.
    $("#ctrl").innerHTML = `<div class="grades two">
      <button class="btn bad" data-g="0">${t("gNo")}<small>${t("gNoS")}</small></button>
      <button class="btn ok" data-g="2">${t("gYes")}<small>${t("gYesS")}</small></button></div>`;
    $$("[data-g]").forEach(b => b.onclick = () => doGrade(+b.dataset.g));
    window.onkeydown = e => { if (e.key === "1") doGrade(0); else if (e.key === "2") doGrade(2); };
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
  // One grid, row by row, so each left box lines up with the right box next to it.
  view().innerHTML = `${sessionTop(st)}<div class="qcard"><div class="lbl">${t("matchQ")}</div><div class="pc-match mx">
    ${lefts.map((x, r) => `<button class="opt ml" data-side="l" data-i="${x.i}">${mdi(x.s)}</button><button class="opt mr" data-side="r" data-i="${rights[r].i}">${mdi(rights[r].s)}</button>`).join("")}</div></div>`;
  let sel = null, mistakes = 0, left = it.pairs.length;
  $$(".pc-match .opt").forEach(b => b.onclick = () => {
    if (b.disabled) return;
    if (!sel || sel.dataset.side === b.dataset.side) {
      $$(".pc-match .opt").forEach(x => x.classList.remove("sel"));
      b.classList.add("sel"); sel = b; sfx.flip(); return;
    }
    if (sel.dataset.i === b.dataset.i) {
      [sel, b].forEach(x => { x.classList.remove("sel"); x.classList.add("right"); x.disabled = true; setTimeout(() => x.classList.add("gone"), 350); });
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
  const pct = st.firstN ? Math.round(st.firstRight / st.firstN * 100) : st.answered ? Math.round(st.right / st.answered * 100) : 100;
  if (l) S.lessons[l.id] = { ts: Date.now(), best: Math.max(S.lessons[l.id]?.best || 0, lessonPct(l)) };
  if (st.test != null) { const k = "test:" + st.test; S.lessons[k] = { ts: Date.now(), best: Math.max(S.lessons[k]?.best || 0, pct / 100) }; }
  const won = st.gold && pct >= GOLD_AT;
  if (won) S.lessons["gold:" + st.gold.id] = { ts: Date.now(), best: pct / 100 };
  save(); SYNC.push();
  const more = l && lessonPct(l) < 1;
  sfx.done(); if (!st.gold || won) confetti();
  const boxes = [[t("xp"), st.xp, "y"], [t("correct"), pct + " %", "g"], [t("profTime"), studyTime(Date.now() - st.started), "b"]];
  view().innerHTML = `<div class="done-screen">${tutorArt(curTutor(), "jump", "happy")}<div class="title">${st.gold ? t(won ? "goldWon" : "goldMiss", { n: GOLD_AT }) : t(st.test != null ? "testDone" : more ? "doneMore" : "doneTitle")}</div>${l || st.test != null || st.gold ? `<p class="sub">${esc(st.title)}</p>` : ""}
    <div class="statboxes">${boxes.map(([h, v, c]) => `<div class="sbox ${c}"><div class="h">${esc(h)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div></div>
    ${dock(`<a class="btn block big" href="${more ? `#/s/${SLUG}/lesson/${esc(l.id)}?r=${Date.now()}` : st.back}" id="endNext">${t("cont")}</a>`)}`;
}

/* ---------- review ---------- */
function viewPractice() {
  const due = dueIds().length, mis = mistakeIds().length, seen = Object.keys(S.cards).length + Object.keys(S.q).length, mixN = Math.min(seen, ROUND);
  const go = kind => `#/s/${SLUG}/review/${kind}`;
  // Outlined rows (2px edge, title, subtitle, an illustration bleeding off the right edge), like a calm list rather than coloured blocks.
  const row = (href, c, icon, title, sub, badge) => `<a class="prow ${c} ${href ? "" : "off"}" ${href ? `href="${href}"` : `aria-disabled="true"`}><div class="t"><b>${title}</b><span>${sub}</span></div>${badge ? `<span class="badge">${badge}</span>` : ""}<div class="ill" aria-hidden="true"><i></i><i></i>${icon}</div></a>`;
  // The hero offers the one best next step: due flashcards, else a quick quiz.
  const [heroHref, heroLabel] = due ? [go("due"), `${t("pracCards")} · ${due}`] : mixN ? [go("mix"), t("pracQuiz")] : ["", ""];
  view().innerHTML = framed("practice", `${topbar()}<div class="pg prac">
    <div class="banner c-purple"><div class="t"><h2>${t("pracTitle")}</h2><p>${t("pracBanner")}</p>${heroHref ? `<a class="hero-go" href="${heroHref}">${esc(heroLabel)}</a>` : ""}</div><div class="art">${tutorArt(curTutor())}</div><i class="arc"></i><i class="cloud"></i></div>
    <h2 class="sec">${t("pracAll")}</h2>
    <div class="prows">
      ${row(due ? go("due") : "", "c-purple", HUB.cards, t("pracCards"), due ? pl("due", due) : t("pracCardsNone"))}
      ${row(mixN ? go("mix") : "", "c-blue", HUB.bolt, t("pracQuiz"), mixN ? pl("quizQs", mixN) : t("pracEmpty"))}
      ${row(mis ? go("mistakes") : "", "c-red", HUB.target, t("pracMistakes"), mis ? t("pracMistakesSub") : t("pracNoMistakes"), mis || "")}
    </div></div>`);
  bindTopbar();
}
// Chunky round icons for the practice tiles (white on the tile colour, like Penny's).
const HI = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const HUB = {
  cards: HI('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 4.5H6.5a2 2 0 0 0-2 2V16"/>'),
  bolt: HI('<path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z"/>'),
  target: HI('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>'),
  book: HI('<path d="M4 5.5A2 2 0 0 1 6 3.5h5v16H6a2 2 0 0 0-2 2zM20 5.5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z"/>'),
};

/* ---------- profile ---------- */
function viewProfile() {
  const ls = allLessons(), done = ls.filter(l => lessonPct(l) >= 1).length, left = daysToExam(), r = readiness();
  const name = store.get("name", "") || t("student"), tu = curTutor();
  const tutorLine = lang() === "cs" ? tutorWith(tu) : t("withTutor", { name: tutorOf(tu).name });
  const tile = (icon, v, label) => `<div class="pt">${icon}<div><b>${esc(v)}</b><span>${esc(label)}</span></div></div>`;
  view().innerHTML = framed("progress", `<div class="prof"><div class="prof-hero"><i class="pb1"></i><i class="pb2"></i><i class="pb3"></i>
      <a class="prof-gear" href="#/s/${SLUG}/settings" aria-label="${t("settings")}">${GEAR}</a><div class="prof-art">${tutorArt(tu)}</div></div>
    <div class="prof-t"><h1>${esc(name)}</h1><p>${esc(C.meta.subject || C.meta.title || "")} · ${esc(tutorLine)}</p>${examDate() ? `<p class="prof-meta">${calIcon(new Date(examDate() + "T12:00").getDate())}<span>${t("exam")}: ${esc(fmtDay(examDate()))}</span></p>` : ""}</div>
    <div class="pg"><h2 class="grp">${t("profOverview")}</h2><div class="ptiles">
      ${tile(ringIcon(r, 34), r + " %", t("readiness"))}${tile(calIcon(examDate() ? new Date(examDate() + "T12:00").getDate() : ""), left == null ? "–" : daysTxt(Math.max(0, left)), t("toExam"))}
      ${tile(doneIcon, `${done}/${ls.length}`, t("profLevels"))}${tile(timeIcon, studyTime(totalMs()), t("profTime"))}</div>
    <h2 class="grp">${t("profChapters")}</h2><div class="pchs">${C.units.map((u, ui) => { const its = u.lessons.flatMap(l => l.items), p = its.length ? Math.round(its.filter(mastered).length / its.length * 100) : 0; return `<div class="pch" style="--chc:${chapterColour(ui)}"><span class="sq">${ui + 1}</span><div><b>${esc(u.title)}</b><div class="bar"><i style="width:${p}%"></i></div></div><em>${p} %</em></div>`; }).join("")}</div></div></div>`);
  bindTopbar();
}

/* ---------- settings: full screen, closes with X ---------- */
function viewSettings() {
  const th = store.get("theme", "auto"), snd = store.get("sound", true), email = store.get("email", "");
  const row = (k, icon, label, value = "", { chev = true, cls = "" } = {}) => `<button class="srow ${cls}" data-s="${k}">${setIcon(icon)}<b>${label}</b><span class="sv">${value}</span>${chev ? CHEV : ""}</button>`;
  view().innerHTML = `<div class="set"><header class="set-h"><a class="set-x" href="#/s/${SLUG}/progress" aria-label="${t("close")}">${CLOSE}</a><h1>${t("settings")}</h1><span></span></header>
    <h2 class="grp">${t("grpLearn")}</h2><div class="sgrp">
      ${row("date", "date", t("setDate"), examDate() ? esc(fmtDay(examDate())) : "")}
      ${row("goal", "goal", t("setGoal"), STUDENT?.minutes ? t("timeM", { m: STUDENT.minutes }) : "")}
      <button class="srow" data-s="tutor"><span class="s-ic stut">${tutorArt(curTutor())}</span><b>${t("setTutor")}</b><span class="sv">${esc(tutorOf(curTutor()).name)}</span>${CHEV}</button>
      ${row("remind", "bell", t("setRemind"), `<span class="soon">${t("soon")}</span>`)}
      ${C.meta.voice ? row("voice", "voice", t("setVoice")) : ""}</div>
    <h2 class="grp">${t("grpApp")}</h2><div class="sgrp">
      ${row("lang", "lang", t("setLang"), esc(langName(lang())))}
      <label class="srow">${setIcon("sound")}<b>${t("setSound")}</b><span class="sv"></span><input type="checkbox" class="sw" id="sndSw" ${snd ? "checked" : ""} role="switch"></label>
      ${row("look", "look", t("setLook"), t({ auto: "lookAuto", light: "lookLight", dark: "lookDark" }[th] || "lookAuto"))}</div>
    <h2 class="grp">${t("grpAccount")}</h2><div class="sgrp">
      ${row("email", "mail", t("setEmail"), esc(email), { chev: false, cls: "static" })}
      ${row("pay", "pay", t("setSubjects"), "")}
      <div id="proRow"></div>
      ${row("out", "out", t("setLogout"), "", { chev: false, cls: "muted" })}</div>
    <p class="set-foot"><a href="#/terms">${t("footTerms")}</a> · <a href="#/privacy">${t("footPrivacy")}</a> · <a href="#" id="contact">${t("footContact")}</a></p>
    <p class="set-foot"><a href="#" id="delAcc" class="del">${t("setDelete")}</a></p></div>`;
  $("#sndSw").onchange = e => { store.set("sound", e.target.checked); if (e.target.checked) sfx.right?.(); };
  $("#contact").onclick = async e => {
    e.preventDefault();
    const op = (await fetch("store.config.json").then(r => r.json()).catch(() => ({}))).operator || {};
    if (op.email) location.href = "mailto:" + op.email; else toast(t("contactSoon"));
  };
  $("#delAcc").onclick = e => { e.preventDefault(); toast(t("deleteSoon")); };
  const H = {
    date: dateSheet, goal: goalSheet, tutor: tutorSheet, look: lookSheet, pay: paySheet,
    remind: () => toast(t("setRemindSoon")),
    voice: () => ctx.nav(`#/s/${SLUG}/voice`),
    lang: () => langSheet(l => { if (l === "cs" || l === "en") api("update_student", { session: TOKEN, lang: courseLang() }).catch(() => { }); viewSettings(); }),
    out: async () => {
      if (!confirm(t("setLogoutQ"))) return;
      await SYNC.push();
      ["session", "code", "readySeen", "email", "name", lsKey()].forEach(k => store.del(k)); TOKEN = null; resetCourse();
      ctx.nav("#/");
    },
  };
  $$("[data-s]").forEach(b => b.onclick = () => H[b.dataset.s]?.());
  api("account", { session: TOKEN }).then(a => {
    const el = $("#proRow"); if (!el) return;
    const sv = $('[data-s="pay"] .sv'); if (sv) sv.textContent = String(a.courses.length || 1);
    if (a.pro?.status) { el.outerHTML = row("pro", "pay", t("setPro"), esc(proLine(a.pro))); $('[data-s="pro"]').onclick = () => proSheet(a.pro); }
  }).catch(() => { });
}
const proDate = p => p.until ? fmtDay(new Date(Date.parse(p.until) - 86400e3).toISOString().slice(0, 10)) : ""; // pro_until carries a day of grace
const proLine = p => !p.active ? t("proOff") : p.cancelAtEnd ? t("proEnds", { date: proDate(p) }) : t("proRenews", { date: proDate(p) });
function proSheet(p) {
  const s = sheet(`<h2 class="sh-h">${t("setPro")}</h2><p class="sh-p">${esc(proLine(p))}</p>
    ${p.active ? `<p class="sh-p">${esc(t("proLeft", { n: p.newLeft, x: p.newPerWindow, m: Math.floor(p.voiceLeftSeconds / 60) }))}</p>` : ""}
    ${p.active ? `<button class="${p.cancelAtEnd ? "btn-p" : "btn-s"}" id="proGo">${t(p.cancelAtEnd ? "proResume" : "proCancel")}</button>` : ""}`);
  const b = $("#proGo"); if (!b) return;
  b.onclick = async () => {
    if (!p.cancelAtEnd && !confirm(t("proCancelQ", { date: proDate(p) }))) return;
    b.disabled = true;
    try {
      const r = await api("pro_cancel", { session: TOKEN, resume: p.cancelAtEnd });
      s.close(); toast(r.pro.cancelAtEnd ? t("proCanceled", { date: proDate(r.pro) }) : t("proResumed")); viewSettings();
    } catch (e) { b.disabled = false; toast(errText(e.code)); }
  };
}
async function saveStudent(fields) {
  try { const r = await api("update_student", { session: TOKEN, ...fields }); STUDENT = { ...STUDENT, ...(r.student || fields) }; toast(t("saved")); return true; }
  catch (e) { toast(errText(e.code)); return false; }
}
function dateSheet() {
  const start = examDate() ? daysBetween(today(), examDate()) : 42;
  const s = sheet(`<h2 class="sh-h">${t("setDate")}</h2><div class="dbig"><b id="dDate"></b><span id="dRel"></span></div><div class="dbadge" id="dBadge"></div>${rulerHtml()}<button class="btn-p" id="shSave">${t("save")}</button>`);
  let pickIso = null;
  const pages = allLessons().reduce((a, l) => a + l.items.length, 0) / 3;
  bindRuler(start, (n, iso) => { pickIso = iso; const p = datePanel(n, iso, pages); $("#dDate").textContent = p.date; $("#dRel").textContent = p.rel; $("#dBadge").innerHTML = p.badge; });
  $("#shSave").onclick = async () => { if (await saveStudent({ examDate: pickIso })) { s.close(); viewSettings(); } };
}
// The only daily goals there are (Marek 2026-11-11). Older picks like 45 or 90 show as the nearest.
export const GOALS = [10, 15, 20, 30, 60];
export const snapGoal = m => GOALS.reduce((a, g) => Math.abs(g - m) < Math.abs(a - m) ? g : a, GOALS[0]);
function goalSheet() {
  const cur = snapGoal(STUDENT?.minutes || 20);
  // One clean list, one tap saves: a name for the pace on the left, the minutes on the right.
  const s = sheet(`<h2 class="sh-h">${t("goalTitle")}</h2><div class="goals">${GOALS.map(m => `<button class="goal ${m === cur ? "on" : ""}" data-m="${m}"><b>${t("goal" + m)}</b><span>${t("timeM", { m })}</span></button>`).join("")}</div>`);
  $$("[data-m]", s.el).forEach(b => b.onclick = async () => {
    $$("[data-m]", s.el).forEach(x => x.classList.toggle("on", x === b));
    if (await saveStudent({ minutes: +b.dataset.m })) { s.close(); viewSettings(); }
  });
}
function tutorSheet() {
  const s = sheet(`<h2 class="sh-h">${t("tutorChange")}</h2><div class="sh-car">${carouselHtml()}</div><p class="sh-note">${t("tutorLocal")}</p><button class="btn-p" id="shSave">${t("save")}</button>`);
  const car = bindCarousel(curTutor(), () => { });
  $("#shSave").onclick = () => { store.set("tutor." + SLUG, car.get().id); s.close(); toast(t("saved")); viewSettings(); };
}
function lookSheet() {
  const cur = store.get("theme", "auto");
  const s = sheet(`<h2 class="sh-h">${t("setLook")}</h2><div class="sh-list">${["auto", "light", "dark"].map(k => `<button class="lrow ${k === cur ? "on" : ""}" data-th="${k}"><b>${t({ auto: "lookAuto", light: "lookLight", dark: "lookDark" }[k])}</b>${k === cur ? `<i class="lok">${TICK}</i>` : ""}</button>`).join("")}</div>`);
  $$("[data-th]", s.el).forEach(b => b.onclick = () => { store.set("theme", b.dataset.th); applyTheme(); s.close(); viewSettings(); });
}
function paySheet() {
  const title = C.meta.subject || C.meta.title || "";
  const s = sheet(`<h2 class="sh-h">${t("setSubjects")}</h2><div class="sh-list"><div class="subrow on"><span class="sq">${esc((title[0] || "P").toUpperCase())}</span><div><b>${esc(C.meta.title || title)}</b><small>${t(ACCESS.paid ? "payPaid" : "payFree")}</small></div></div></div>
    ${ACCESS.paid ? "" : `<button class="btn-p" id="payGo">${t("payUnlock")}</button>`}`);
  const b = $("#payGo"); if (b) b.onclick = () => { s.close(); ctx.nav("#/unlock"); };
}

// Redraw the map when its width changes (window resize, iPad rotation), so nodes stay centred.
let resizeT = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    const mw = document.getElementById("mw");
    if (mw && Math.min(MAPMAX, mw.parentNode.clientWidth) !== +mw.dataset.w) viewMap();
  }, 150);
});
