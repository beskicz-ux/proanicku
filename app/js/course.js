// The course itself: the map, notes, review, the profile with settings, the lesson players and sync.
import { $, $$, view, esc, store, api, today, addDays, shuffle, pick, norm, md, mdi, sfx, confetti, toast, ic } from "./util.js";
import { t, lang, itemCount, errText, days as daysTxt, inDays, inWeeks, fmtDay, studyTime, courseLang } from "./i18n.js";
import { ham, teacher } from "./art.js";
import { mergeState, defaults } from "./merge.js";
import { daysBetween } from "./forecast.js";
import { viewVoice } from "./voice.js";
import { mix, chapterColour, TAB_ICONS, PRAC_ICONS, ringIcon, calIcon, doneIcon, timeIcon, GEAR, CHEV_DOWN, CHEV, CLOSE, NOTES_ICON, setIcon, LEVEL_ICONS, TICK, levelIcon, langSheet, langName, sheet, applyTheme } from "./ui.js";
import { rulerHtml, bindRuler, datePanel, carouselHtml, bindCarousel } from "./app.js";

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
const curTutor = () => store.get("tutor." + SLUG, null) || STUDENT?.tutor || C?.meta.tutor || "penny";

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
const levelRing = p => `<svg class="rg" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" pathLength="100" class="rg-t"/>${p > 0 ? `<circle cx="50" cy="50" r="45" pathLength="100" class="rg-p" stroke-dasharray="${Math.max(4, p)} 100"/>` : ""}</svg>`;
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
  if (!C || SLUG !== slug) $("#view").innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  try { await loadCourse(slug); }
  catch (e) {
    if (e.status === 401) { store.del("session"); toast(t("sessionExpired")); return nav("#/login"); }
    if (e.code === "not_ready") return nav("#/wait");
    $("#nav").hidden = true;
    view().innerHTML = `<div class="ob ob-center">${ham("sad")}<h1 class="ob-h">${t("courseFail")}</h1><p class="ob-sub">${esc(errText(e.code))}</p><div class="ob-foot"><button class="btn-p" id="again">${t("retry")}</button></div></div>`;
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
  if (sub === "review") return startReview(arg);
  nav("#/s/" + slug);
}
let ctx = null;
const TAB_COL = { home: "#E9773A", notes: "#3B82F6", review: "#22A06B", progress: "#A855F7" };
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
  return `<header class="tb"><button class="subj" id="subjBtn"><span class="sq">${esc((title[0] || "P").toUpperCase())}</span><b>${esc(title)}</b>${CHEV_DOWN}</button>
    <div class="mets"><a class="met ready" href="#/s/${SLUG}/progress" aria-label="${t("readinessTitle")}: ${r} %">${ringIcon(r)}<span>${r} %</span></a>
    ${left == null ? "" : `<a class="met" href="#/s/${SLUG}/progress" aria-label="${esc(daysTxt(Math.max(0, left)))} ${t("toExam")}">${calIcon(new Date(examDate() + "T12:00").getDate())}<span>${esc(daysTxt(Math.max(0, left)))}</span></a>`}</div></header>`;
}
function bindTopbar() {
  const b = $("#subjBtn"); if (!b) return;
  const title = C.meta.subject || C.meta.title || "";
  b.onclick = () => {
    const s = sheet(`<h2 class="sh-h">${t("subjTitle")}</h2><div class="sh-list">
      <button class="subrow on" id="subCur"><span class="sq">${esc((title[0] || "P").toUpperCase())}</span><div><b>${esc(C.meta.title || title)}</b><small>${examDate() ? esc(fmtDay(examDate())) : ""}</small></div><i class="lok">${TICK}</i></button>
      <button class="subrow add" id="subNew"><span class="sq">+</span><div><b>${t("subjNew")}</b><small>${t("soon")}</small></div></button></div>`);
    $("#subCur").onclick = s.close;
    $("#subNew").onclick = () => { s.close(); toast(t("subjSoon")); };
  };
}

/* ---------- the map: one column, bottom-up, chapters in colour ---------- */
// Every chapter ends with a test (a mixed round of the chapter's items). Levels open one after another.
function nodes() {
  const out = [];
  C.units.forEach((u, ui) => {
    u.lessons.forEach((l, k) => out.push({ kind: "lesson", ui, l, k, done: lessonPct(l) >= 1, gold: l.items.length > 0 && l.items.every(solid), locked: !!l.locked }));
    const items = u.lessons.flatMap(l => l.items);
    if (items.length) { const r = S.lessons["test:" + (u.id || ui)]; out.push({ kind: "test", ui, done: !!r, gold: !!r && r.best >= .9, locked: u.lessons.some(l => l.locked) }); }
  });
  const cur = out.findIndex(n => !n.done);
  out.forEach((n, i) => { n.cur = i === cur && !n.locked; n.next = cur >= 0 && i > cur; });
  return { list: out, cur };
}
const MAPMAX = 620; // widest the map gets; wider screens get the side panel instead of empty map
const STEPY = 100, CURX = 60, DIVH = 84, TOPPAD = 200, BOTPAD = 120;
const SWAY = [0, 56, 74, 40, -12, -58, -74, -40];
const isDark = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
// Scenery only at the edges, so the path stays clean. Seeded per chapter: every chapter gets its own mix of
// hills, pines, round trees, bushes and clouds at uneven spacing, instead of one tile repeated down the page.
function scenery(col, h, W, dark, seed = 1) {
  let r = (seed * 7919) % 233280; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
  const base = dark ? "#141821" : "#ffffff", h1 = mix(col, base, dark ? .76 : .72), h2 = mix(col, base, dark ? .68 : .6);
  const leaf = mix(col, dark ? "#0b0e14" : "#1d2b1f", dark ? .55 : .45), trunk = dark ? "#00000055" : "#0000002a";
  const cloud = dark ? "#ffffff10" : "#ffffffe0", rock = dark ? "#ffffff0d" : "#00000012";
  const zone = Math.max(70, W / 2 - (74 * Math.min(1.7, W / 375) + 46));
  const X = (L, f) => L ? f * zone : W - f * zone;
  const hill = (L, y) => { const w = zone * (.9 + rnd() * .7), hh = 46 + rnd() * 54, e = L ? -20 : W + 20, d = L ? 1 : -1;
    return `<path d="M${e} ${y + hh} C${e + d * w * .3} ${y} ${e + d * w * .7} ${y + hh * .15} ${e + d * w} ${y + hh}Z" fill="${h1}"/><path d="M${e} ${y + hh + 10} C${e + d * w * .2} ${y + hh * .45} ${e + d * w * .45} ${y + hh * .5} ${e + d * w * .7} ${y + hh + 10}Z" fill="${h2}"/>`; };
  const pine = (x, y, z) => `<rect x="${x - 1.5 * z}" y="${y - 4 * z}" width="${3 * z}" height="${6 * z}" fill="${trunk}"/><path d="M${x} ${y - 28 * z} l${12 * z} ${24 * z} h${-24 * z}z" fill="${leaf}"/>`;
  const round = (x, y, z) => `<rect x="${x - 1.5 * z}" y="${y - 8 * z}" width="${3 * z}" height="${10 * z}" fill="${trunk}"/><circle cx="${x}" cy="${y - 16 * z}" r="${10 * z}" fill="${leaf}"/>`;
  const bush = (x, y, z) => `<g fill="${h2}"><circle cx="${x - 7 * z}" cy="${y}" r="${6 * z}"/><circle cx="${x + 1 * z}" cy="${y - 4 * z}" r="${8 * z}"/><circle cx="${x + 9 * z}" cy="${y}" r="${6 * z}"/></g>`;
  const rocks = (x, y, z) => `<g fill="${rock}"><ellipse cx="${x}" cy="${y}" rx="${9 * z}" ry="${5 * z}"/><ellipse cx="${x + 12 * z}" cy="${y + 2 * z}" rx="${5 * z}" ry="${3 * z}"/></g>`;
  const cloudAt = (x, y, z) => `<g fill="${cloud}"><circle cx="${x - 12 * z}" cy="${y}" r="${9 * z}"/><circle cx="${x + 1 * z}" cy="${y - 5 * z}" r="${13 * z}"/><circle cx="${x + 14 * z}" cy="${y + 1 * z}" r="${8 * z}"/><rect x="${x - 22 * z}" y="${y}" width="${45 * z}" height="${9 * z}" rx="${4.5 * z}"/></g>`;
  let s = "";
  for (let y = 30 + rnd() * 50; y < h - 30; y += 80 + rnd() * 110) {
    for (const L of [true, false]) {
      if (rnd() < .3) continue; // leave some gaps, so it breathes
      const k = rnd(), z = .75 + rnd() * .55, yy = y + rnd() * 40;
      if (k < .28) s += hill(L, yy);
      else if (k < .5) { const n = 1 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) s += (rnd() < .5 ? pine : round)(X(L, .2 + rnd() * .65), yy + i * 7, z * (.8 + rnd() * .4)); }
      else if (k < .64) s += bush(X(L, .25 + rnd() * .55), yy, z);
      else if (k < .76) s += rocks(X(L, .2 + rnd() * .6), yy, z);
      else s += cloudAt(X(L, .35 + rnd() * .45), yy, z);
    }
  }
  return s;
}
const smooth = P => P.map((p, i) => {
  if (!i) return `M${p[0]} ${p[1]}`;
  const a = P[i - 2] || P[i - 1], b = P[i - 1], c = p, e = P[i + 1] || p;
  return `C${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6} ${c[0]} ${c[1]}`;
}).join(" ");
function examLine() {
  const left = daysToExam();
  if (left == null) return "";
  if (left < 0) return t("examPast");
  if (left === 0) return t("examToday");
  return `${fmtDay(examDate())} · ${left < 14 ? inDays(left) : inWeeks(Math.round(left / 7))}`;
}
function viewMap() {
  const { list, cur } = nodes(), locked = lockedCount(), dark = isDark();
  document.body.classList.add("map-page");
  view().innerHTML = `<div class="mlay"><div class="mmain"><div class="mtop">${topbar()}<div class="unitwrap"><div class="unit" id="unitHead"></div></div></div>${unlockCard(locked)}<div class="mapv"><div class="mw" id="mw"></div></div></div>${sidePanel(locked)}</div>`;
  bindTopbar();
  const mw = $("#mw"), W = Math.min(MAPMAX, mw.clientWidth || 375), CX = W / 2, sc = Math.min(1.15, W / 375), sw = Math.min(1.7, W / 375);
  mw.dataset.w = W;
  const byCh = C.units.map((u, ui) => list.filter(n => n.ui === ui));
  const chH = byCh.map(ns => DIVH + ns.length * STEPY + (ns.some(n => n.cur) ? CURX : 0));
  const total = TOPPAD + chH.reduce((a, b) => a + b, 0) + BOTPAD;
  let out = "", y = total - BOTPAD, k = 0, curPt = -1, curY = 0;
  const pts = [], ptCol = [], chTop = [];
  C.units.forEach((u, ui) => {
    const col = chapterColour(ui), top = y - chH[ui], hh = chH[ui] + (ui === 0 ? BOTPAD : 0);
    const g1 = dark ? mix(col, "#141821", .86) : mix(col, "#ffffff", .9), g2 = dark ? mix(col, "#141821", .82) : mix(col, "#ffffff", .85);
    chTop.push([top, y]);
    out += `<div class="band" style="top:${top}px;height:${hh}px;background:linear-gradient(${g1},${g2})"><svg viewBox="0 0 ${W} ${hh}" width="${W}" height="${hh}">${scenery(col, hh, W, dark, ui + 3)}</svg></div>`;
    out += `<div class="div" style="top:${y - DIVH / 2 + 8}px"><span><small>${t("chapter", { n: ui + 1 })}</small>${esc(u.title)}</span></div>`;
    y -= DIVH;
    byCh[ui].forEach(n => {
      const big = n.cur ? CURX : 0, ny = y - STEPY / 2 - big * .25, nx = CX + SWAY[k % SWAY.length] * sw;
      pts.push([nx, ny]); ptCol.push(col);
      const state = n.locked || n.next ? "nlock" : n.cur ? "cur" : n.gold ? "gold" : n.done ? "done" : "cur";
      const icon = n.kind === "test" ? LEVEL_ICONS.test : levelIcon(n.l.title, n.k);
      const rp = n.locked || n.next ? null : n.kind === "test" ? chapterReady(ui) : lessonReady(n.l);
      const label = (n.kind === "test" ? `${t("testTitle")}: ${u.title}` : n.l.title) + (rp == null ? "" : ` · ${rp} % ${t("readiness")}`);
      const key = n.kind === "test" ? `data-test="${ui}"` : `data-lesson="${esc(n.l.id)}"`;
      out += `<div class="n ${state} ${n.kind === "test" ? "test" : ""}" style="left:${nx}px;top:${ny}px;--chc:${col}">
        ${rp == null ? "" : levelRing(rp)}<button class="c" ${key} data-state="${n.locked ? "paywall" : n.next ? "next" : "open"}" aria-label="${esc(label)}">${icon}${(n.done || n.gold) && !n.cur ? `<span class="tick">${TICK}</span>` : ""}</button></div>`;
      if (n.cur) { curPt = pts.length - 1; curY = ny; out += `<div class="tut" style="left:${nx > CX ? nx - 120 * sc : nx + 120 * sc}px;top:${ny}px">${ham("happy")}</div>`; }
      y -= STEPY + big; k++;
    });
  });
  out = `<div class="band" style="top:0;height:${TOPPAD}px;background:linear-gradient(${dark ? "#141821,#202036" : "#FFF6EA,#E7E3F4"})"></div>` + out;
  out += `<div class="exam" style="top:${TOPPAD / 2 + 10}px;left:${CX}px"><div class="c">${LEVEL_ICONS.flag}</div><b>${t("exam")}</b><small>${esc(examLine())}</small></div>`;
  const all = [...pts, [CX, TOPPAD / 2 + 10]], walkedTo = curPt < 0 ? (list.length && list.every(n => n.done) ? all.length - 1 : 0) : curPt;
  let walked = "", i = 0;
  while (i < walkedTo) { let j = i; while (j < walkedTo && ptCol[j + 1] === ptCol[i]) j++; if (j === i) j = i + 1; walked += `<path d="${smooth(all.slice(i, j + 1))}" fill="none" stroke="${ptCol[Math.min(j, ptCol.length - 1)]}" stroke-opacity=".75" stroke-width="9" stroke-linecap="round"/>`; i = j; }
  const road = dark ? "#00000040" : "#ffffffa6", edge = dark ? "#ffffff10" : "#00000010";
  out += `<svg class="trail" style="width:${W}px;height:${total}px" viewBox="0 0 ${W} ${total}" aria-hidden="true">
    <path d="${smooth(all)}" fill="none" stroke="${edge}" stroke-width="26" stroke-linecap="round"/><path d="${smooth(all)}" fill="none" stroke="${road}" stroke-width="22" stroke-linecap="round"/>${walked}</svg>`;
  mw.style.height = total + "px"; mw.style.width = W + "px"; mw.innerHTML = out;
  // The header shows the chapter in view.
  const curIdx = cur < 0 ? list.length : cur;
  const head = ui => {
    const col = chapterColour(ui), h = $("#unitHead"); if (!h || h.dataset.ui == ui) return;
    h.dataset.ui = ui;
    h.style.background = `linear-gradient(118deg, transparent 0 60%, #ffffff14 60% 74%, transparent 74%), ${col}`;
    h.style.setProperty("--uc", col);
    h.innerHTML = `<div class="ut">${tutorArt(curTutor())}</div><div><small>${t("chapter", { n: ui + 1 })} · ${t("doneOf", { x: list.filter(n => n.ui === ui && n.done).length, y: list.filter(n => n.ui === ui).length })}</small><b>${esc(C.units[ui].title)}</b></div><a class="unotes" href="#/s/${SLUG}/notes/${ui}" aria-label="${t("navNotes")}">${NOTES_ICON}</a>`;
  };
  const mwTop = () => mw.getBoundingClientRect().top + scrollY;
  const onScroll = () => {
    const mid = scrollY + innerHeight * .55 - mwTop();
    let ui = chTop.findIndex(([top, bot]) => mid >= top && mid <= bot);
    if (ui < 0) ui = mid < (chTop.at(-1)?.[0] ?? 0) ? C.units.length - 1 : 0;
    head(ui);
  };
  head(cur >= 0 ? list[cur].ui : C.units.length - 1);
  window.onscroll = onScroll;
  $$("[data-lesson],[data-test]", mw).forEach(b => b.onclick = () => {
    const st = b.dataset.state;
    if (st === "paywall") return ACCESS.paid ? toast(t(ACCESS.status === "failed" ? "restFailed" : "restBuilding")) : ctx.nav("#/unlock");
    if (st === "next") return toast(t(b.dataset.test != null ? "testLocked" : "levelLocked"));
    ctx.nav(b.dataset.test != null ? `#/s/${SLUG}/test/${b.dataset.test}` : `#/s/${SLUG}/lesson/${b.dataset.lesson}`);
  });
  requestAnimationFrame(() => { scrollTo({ top: Math.max(0, mwTop() + (curPt >= 0 ? curY : total - BOTPAD) - innerHeight * .55), behavior: "instant" }); onScroll(); });
  if (locked && ACCESS.building) watchRest();
}
// Free start: the card that sells the rest, or says the rest is being written.
// Wide screens only (CSS hides it below 1200px): readiness, exam, today's goal, chapters.
const FLAME = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2.200 1-3.600 2-4.600 0 1.600.800 2.600 2 2.600 0-3.400-1.200-5.800 1-9z" fill="#FF9600"/><path d="M12 12c.6 2 2.400 2.800 2.400 4.600a2.400 2.400 0 0 1-4.800 0c0-1.400.800-2.200 1.400-2.800.1.900.500 1.300 1 1.300 0-1.300-.300-2.100 0-3.100z" fill="#FFC800"/></svg>`;
function sidePanel(locked) {
  const r = readiness(), left = daysToExam(), goal = STUDENT?.minutes || 20, todayM = Math.round((doneToday().ms || 0) / 60000);
  const gp = Math.min(100, Math.round(todayM / goal * 100));
  const chs = C.units.map((u, ui) => { const its = u.lessons.flatMap(l => l.items), p = its.length ? Math.round(its.filter(mastered).length / its.length * 100) : 0;
    return `<a class="sch" href="#/s/${SLUG}/notes/${ui}" style="--chc:${chapterColour(ui)}"><span class="sq">${ui + 1}</span><div><b>${esc(u.title)}</b><div class="bar"><i style="width:${p}%"></i></div></div><em>${p} %</em></a>`; }).join("");
  const studied = d => (S.done[d]?.ms || 0) > 0, td = today();
  let streak = 0; for (let d = studied(td) ? td : addDays(td, -1); studied(d); d = addDays(d, -1)) streak++;
  const week = Array.from({ length: 7 }, (_, i) => addDays(td, i - 6)).map(d => `<div class="${studied(d) ? "on" : ""} ${d === td ? "now" : ""}"><span>${esc(new Date(d + "T12:00").toLocaleDateString(lang(), { weekday: "narrow" }))}</span><i>${studied(d) ? FLAME : ""}</i></div>`).join("");
  return `<aside class="side">
    <div class="sc sc-streak"><div class="sc-st">${FLAME}<div><b>${esc(daysTxt(streak))} ${t("inARow")}</b><span>${t(studied(td) ? "todayDone" : "todayNot")}</span></div></div><div class="wk">${week}</div></div>
    <div class="sc sc-ready">${ringIcon(r, 64)}<div><b>${r} %</b><span>${t("readiness")}</span></div>${left == null ? "" : `<div class="sc-exam">${calIcon(new Date(examDate() + "T12:00").getDate())}<div><b>${esc(daysTxt(Math.max(0, left)))}</b><span>${t("toExam")}</span></div></div>`}</div>
    <div class="sc"><div class="sc-h"><b>${t("setGoal")}</b><span>${t("timeM", { m: todayM })} / ${t("timeM", { m: goal })}</span></div><div class="bar goal"><i style="width:${gp}%"></i></div></div>
    ${locked ? unlockCard(locked) : ""}
    <div class="sc"><div class="sc-h"><b>${t("profChapters")}</b></div><div class="schs">${chs}</div></div></aside>`;
}
function unlockCard(locked) {
  if (!locked) return "";
  if (!ACCESS.paid) return `<a class="pc-unlock" href="#/unlock">${ic.lock}<div><b>${t("unlockCard")}</b><span>${t("unlockCardSub").replace("%", locked)}</span></div></a>`;
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
function viewNotes(arg) {
  const chapters = C.units.map((u, ui) => {
    const col = chapterColour(ui);
    const secs = u.lessons.flatMap(l => l.locked ? [] : (l.reading || []));
    const anyLocked = u.lessons.some(l => l.locked);
    const body = secs.length ? secs.map(s => `<details class="note"><summary>${esc(s.title)}${CHEV}</summary><div class="md">${md(s.body)}</div>${srcLine(s)}</details>`).join("")
      : `<p class="note-empty">${t(anyLocked ? "notesLocked" : "notesEmpty")}</p>`;
    return `<section class="nch" id="nch${ui}" style="--chc:${col}"><div class="nch-h"><small>${t("chapter", { n: ui + 1 })}</small><b>${esc(u.title)}</b></div>${body}${anyLocked && secs.length ? `<p class="note-empty">${t("notesLocked")}</p>` : ""}</section>`;
  }).join("");
  view().innerHTML = `${topbar()}<div class="pg"><h1 class="pg-h">${t("notesTitle")}</h1>${C.units.length ? chapters : `<p class="note-empty">${t("notesNone")}</p>`}</div>`;
  bindTopbar();
  if (arg != null && $("#nch" + arg)) { const s = $("#nch" + arg); s.querySelector("details")?.setAttribute("open", ""); requestAnimationFrame(() => s.scrollIntoView({ block: "start" })); }
}


/* ---------- session runner ---------- */
const ROUND = 10;
function startLesson(id) {
  const l = LESSON[id];
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
  save(); SYNC.push();
  const more = l && lessonPct(l) < 1;
  sfx.done(); confetti();
  const boxes = [[t("xp"), st.xp, "y"], [t("correct"), pct + " %", "g"], [t("profTime"), studyTime(Date.now() - st.started), "b"]];
  view().innerHTML = `<div class="done-screen">${tutorArt(curTutor(), "jump", "happy")}<div class="title">${t(st.test != null ? "testDone" : more ? "doneMore" : "doneTitle")}</div>${l || st.test != null ? `<p class="sub">${esc(st.title)}</p>` : ""}
    <div class="statboxes">${boxes.map(([h, v, c]) => `<div class="sbox ${c}"><div class="h">${esc(h)}</div><div class="v">${esc(v)}</div></div>`).join("")}</div></div>
    ${dock(`<a class="btn block big" href="${more ? `#/s/${SLUG}/lesson/${esc(l.id)}?r=${Date.now()}` : st.back}" id="endNext">${t("cont")}</a>`)}`;
}

/* ---------- review ---------- */
function viewPractice() {
  const due = dueIds().length, mis = mistakeIds().length, seen = Object.keys(S.cards).length + Object.keys(S.q).length;
  const tile = (kind, title, n, color, icon) => `<a class="rv ${color} ${n ? "" : "off"}" ${n ? `href="#/s/${SLUG}/review/${kind}"` : `aria-disabled="true"`}><span class="rv-ic">${icon}</span><div><b>${title}</b><span>${n ? itemCount(n) : t("pracNone")}</span></div>${n ? CHEV : ""}</a>`;
  view().innerHTML = `${topbar()}<div class="pg"><h1 class="pg-h">${t("pracTitle")}</h1><p class="pg-sub">${seen ? t("pracSub") : t("pracEmpty")}</p>
    <div class="rvs">${tile("due", t("pracDue"), due, "purple", TAB_ICONS.review)}${tile("mistakes", t("pracMistakes"), mis, "red", PRAC_ICONS.mistakes)}${tile("mix", t("pracMix"), Math.min(seen, ROUND), "blue", PRAC_ICONS.mix)}</div></div>`;
  bindTopbar();
}

/* ---------- profile ---------- */
function viewProfile() {
  const ls = allLessons(), done = ls.filter(l => lessonPct(l) >= 1).length, left = daysToExam(), r = readiness();
  const name = store.get("name", "") || t("student"), tu = curTutor();
  const tutorLine = lang() === "cs" ? tutorWith(tu) : t("withTutor", { name: tutorOf(tu).name });
  const tile = (icon, v, label) => `<div class="pt">${icon}<div><b>${esc(v)}</b><span>${esc(label)}</span></div></div>`;
  view().innerHTML = `<div class="prof"><div class="prof-hero"><div class="prof-t"><h1>${esc(name)}</h1><p>${esc(C.meta.subject || C.meta.title || "")} · ${esc(tutorLine)}</p></div>
      <a class="prof-gear" href="#/s/${SLUG}/settings" aria-label="${t("settings")}">${GEAR}</a><div class="prof-art">${tutorArt(tu)}</div></div>
    <div class="pg"><h2 class="grp">${t("profOverview")}</h2><div class="ptiles">
      ${tile(ringIcon(r, 34), r + " %", t("readiness"))}${tile(calIcon(examDate() ? new Date(examDate() + "T12:00").getDate() : ""), left == null ? "–" : daysTxt(Math.max(0, left)), t("toExam"))}
      ${tile(doneIcon, `${done}/${ls.length}`, t("profLevels"))}${tile(timeIcon, studyTime(totalMs()), t("profTime"))}</div>
    <h2 class="grp">${t("profChapters")}</h2><div class="pchs">${C.units.map((u, ui) => { const its = u.lessons.flatMap(l => l.items), p = its.length ? Math.round(its.filter(mastered).length / its.length * 100) : 0; return `<div class="pch" style="--chc:${chapterColour(ui)}"><span class="sq">${ui + 1}</span><div><b>${esc(u.title)}</b><div class="bar"><i style="width:${p}%"></i></div></div><em>${p} %</em></div>`; }).join("")}</div></div></div>`;
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
      ${row("pay", "pay", t("setSubjects"), "1")}
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
function goalSheet() {
  const cur = STUDENT?.minutes || 20;
  const s = sheet(`<h2 class="sh-h">${t("goalTitle")}</h2><div class="chips">${[10, 15, 20, 30, 45, 60, 90].map(m => `<button class="chip ${m === cur ? "on" : ""}" data-m="${m}">${t("timeM", { m })}</button>`).join("")}</div><button class="btn-p" id="shSave">${t("save")}</button>`);
  let m = cur;
  $$("[data-m]", s.el).forEach(b => b.onclick = () => { m = +b.dataset.m; $$("[data-m]", s.el).forEach(x => x.classList.toggle("on", x === b)); });
  $("#shSave").onclick = async () => { if (await saveStudent({ minutes: m })) { s.close(); viewSettings(); } };
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
