// Router, welcome, onboarding (slides → date → tutor, then the account), wait page, login, unlock (store), terms and privacy.
import { $, $$, view, esc, store, api, today, addDays, ic, I, toast, confetti, sfx } from "./util.js";
import { t, lang, setLang, courseLang, errText, pages as pagesTxt, fileCount, lessonCount, minutesLeft, inDays, inWeeks, fmtDay, fmtShortMonth } from "./i18n.js";
import { ham } from "./art.js";
import { isImage, imagesToPdfs } from "./images.js";
import { countPages, validFile, daysBetween, ACCEPT, slidesOf } from "./forecast.js";
import { phaseOf, QUEUED, stepsHtml, barTarget, phaseStart, clock, stageText } from "./build.js";
import { courseRoute, tutorArt, TUTORS, tutorWith, resetCourse, storeInfo, snapGoal, money } from "./course.js";
import { BACK, CLOSE, CHEV_DOWN, PACE_ICONS, calIcon, langSheet, applyTheme, sheet, yearWheel } from "./ui.js";
import { pushSupported, pushState, askPush, subscribe, sendSub, remindTime } from "./push.js";
import { persona } from "./persona.js";

const draft = () => { const d = store.get("draft", null); if (d && !STEPS.includes(d.step)) d.step = d.slug ? "account" : "files"; return d; };
const saveDraft = d => store.set("draft", d);
const session = () => store.get("session", null);
// "How did you hear about Penny": its own screen after the tutor (Marek, 2026-11-15, like Duolingo's). Same list in pc-api's accountFields.
const SOURCES = ["tiktok", "instagram", "youtube", "google", "friend", "other"];
// The free lessons start building when the tutor is picked; the screens after that (where they heard of us, reminders,
// the account) fill that wait. The account step isn't counted in the progress bar.
const STEPS = ["files", "date", "tutor", "source", "notify", "account"], COUNTED = 5;
const AFTER = ["source", "notify", "account"]; // once the free lessons are queued, the steps before these can't change
// The reminders screen shows only where a browser can push and hasn't been asked yet (or the student is coming back to it).
const showNotify = d => pushSupported() && (pushState() === "default" || !!d?.notifyAsked);
const tutorName = id => (TUTORS.find(x => x.id === id) || TUTORS[0]).name;
const MIN_AGE = 15; // same as pc-api
const nav = h => { if (location.hash === h) render(); else location.hash = h; };
// el can be gone: an upload that fails after the student moved on to the next step still has to say so.
const fail = (el, e) => { const msg = errText(e.code || e.message); sfx.wrong(); if (!el) return toast(msg); el.textContent = msg; el.hidden = false; };
// "Write to us" outside the course (the wait page, a failed build): the same feedback the course's menu sends.
function writeUs(token, where) {
  const sh = sheet(`<h2 class="sh-h">${esc(t("fbH"))}</h2><p class="sh-p">${esc(t("fbSub"))}</p><textarea class="ob-in" id="wuText" rows="5" maxlength="2000" placeholder="${esc(t("fbPh"))}"></textarea><button class="btn-p" id="wuSend">${esc(t("fbSend"))}</button>`);
  $("#wuSend").onclick = async () => {
    const text = $("#wuText").value.trim(); if (text.length < 2) return $("#wuText").focus();
    $("#wuSend").disabled = true;
    try { await api("feedback", { session: token, text, where }); sh.close(); toast(t("fbThanks")); } catch (e) { $("#wuSend").disabled = false; toast(errText(e.code)); }
  };
}
const hideNav = () => { $("#nav").hidden = true; document.body.classList.remove("has-tabs"); };
let cfgP = null;
const storeConfig = () => cfgP ||= fetch("store.config.json").then(r => r.json()).catch(e => { cfgP = null; throw e; });
const legalLinks = () => `<p class="ob-legal"><a href="#/terms">${t("termsTitle")}</a> · <a href="#/privacy">${t("privTitle")}</a></p>`;
const plain = () => document.body.classList.add("plain"); // screens without the tab bar: centred on desktop
const globe = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3 3.2-3 13.8 0 17M12 3.5c3 3.2 3 13.8 0 17"/></svg>`;
const langBtn = () => `<button class="ob-lang" id="langBtn" aria-label="${t("setLang")}">${globe}<span>${lang().toUpperCase()}</span></button>`;
function bindLang() {
  const b = $("#langBtn"); if (!b) return;
  b.onclick = () => langSheet(async l => {
    const d = draft();
    if (d?.orderToken) api("update_order", { orderToken: d.orderToken, lang: courseLang() }).catch(() => { });
    render();
  });
}

/* ---------- the onboarding frame: back, segments, title (or the tutor saying it), body, one button ---------- */
// say: a tutor id. The title then comes as that tutor's speech bubble, like Duolingo's owl. skip: a quiet second button.
// pre: html above the button (the Google button on the account step). after: a quiet line under it.
function frame(step, { title, body, btn, btnId = "nextBtn", sub = "", say = "", skip = "", pre = "", after = "" }) {
  const i = STEPS.indexOf(step), segs = i < COUNTED ? `<div class="ob-segs">${Array.from({ length: COUNTED }, (_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>` : `<div class="ob-segs"></div>`;
  const head = say ? `<div class="ob-say"><div class="ob-say-art" aria-hidden="true">${tutorArt(say, "", "happy")}</div><h1 class="ob-bub" id="obTitle">${title}</h1></div>` : `<h1 class="ob-h" id="obTitle">${title}</h1>`;
  return `<div class="ob"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${prevStep(step) ? BACK : CLOSE}</button>${segs}<span class="ob-bkpad"></span></div>
    ${head}${sub ? `<p class="ob-sub">${sub}</p>` : ""}
    <div class="ob-body">${body}</div>
    <div class="ob-foot">${pre}<button class="btn-p" id="${btnId}">${btn}</button>${skip ? `<button class="btn-t" id="skipBtn">${skip}</button>` : ""}${after}</div></div>`;
}
// X on the first step: a signed-in student (another subject) goes straight back to their course, not via #/ and #/wait,
// which flashed the setup, then a blank wait page, then the map.
const homeOf = () => { const s = session(); return s ? (store.get("readySeen") === s.slug ? "#/s/" + s.slug : "#/wait") : "#/"; };
// The step Back goes to: never one locked by the queued free lessons, never the reminders screen where it isn't shown.
function prevStep(step) {
  const d = draft();
  for (let k = STEPS.indexOf(step) - 1; k >= 0; k--) {
    const s = STEPS[k];
    if (d?.slug && !AFTER.includes(s)) return null;
    if (s === "notify" && !showNotify(d)) continue;
    return s;
  }
  return null;
}
function bindStepBack(step) { const p = prevStep(step); $("#stepBack").onclick = () => nav(p ? "#/new/" + p : homeOf()); }

/* ---------- landing: the tutors, one line, two buttons (Marek, 2026-11-15: "Duolingo has a cleaner homepage") ---------- */
// Same features as the drop-box page before: files dropped anywhere on the page or picked with the big button go straight
// to the files step, the language button, sign in, the three steps and the legal links. Only the look is calmer.
let handoff = null; // files dropped or picked on the landing page, uploaded by the files step as soon as it opens
const UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>`;
const SPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8"/></svg>`;
// The picture (Marek 2026-11-15: "only Penny and the books, files and stuff she turns into the course", then "make it
// the best possible"). Left: the student's files, only kinds the upload takes (PDF, PowerPoint, Word, a photo of a slide),
// on plain greyish paper. One by one each flies into Penny's open book, curving under her face; out of the book comes a
// purple level that lands on the dotted path round her, which ends at the exam trophy. The trophy lights up, confetti,
// Penny cheers, and the round starts again. One timeline in seconds (T, E, TR, RS below); each piece gets its own
// keyframes from it, written into a <style> next to the picture, so the pieces stay in step. Under reduced motion the
// picture is one still: the files, Penny and the finished path. Positions are % of the square box; moves are in cqw.
const crew = (() => { // scoped, so the short names below can't clash with the rest of the file
  const PAPER = "#F5F2EA", INK = "#CDC7BA";
  const lines = (x, ys, ws, h = 2.4) => ys.map((y, i) => `<rect x="${x}" y="${y}" width="${ws[i]}" height="${h}" rx="${h / 2}"/>`).join("");
  const badge = (x, y, w, h, fill, txt, size) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3.2" fill="${fill}"/><text x="${x + w / 2}" y="${(y + h / 2 + size * .36).toFixed(1)}" text-anchor="middle" font-size="${size}" font-weight="800" font-family="system-ui, sans-serif" fill="#fff">${txt}</text>`;
  const PDF = `<svg viewBox="0 0 44 56"><path d="M5 0h24l15 15v36a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5V5a5 5 0 0 1 5-5z" fill="${PAPER}"/><path d="M29 0v10a5 5 0 0 0 5 5h10z" fill="#DDD7CA"/>
    <g fill="${INK}">${lines(6, [9, 16, 21, 26, 31], [17, 30, 32, 26, 31], 2.6)}</g>${badge(6, 38, 25, 12, "#E5484D", "PDF", 8.5)}</svg>`;
  const PPT = `<svg viewBox="0 0 64 48"><rect width="64" height="44" rx="5" fill="${PAPER}"/><rect x="6" y="6" width="28" height="4.6" rx="2.3" fill="#B8B1A3"/>
    <rect x="6" y="15" width="22" height="20" rx="2.5" fill="#E2DDD1"/><path d="M8 33l6-8 4.5 5 3-3.5L26 33z" fill="#C6BFB0"/><circle cx="23" cy="20" r="2.4" fill="#C6BFB0"/>
    <g fill="${INK}">${lines(32, [16, 22, 28], [24, 19, 22])}</g>${badge(47, 33, 15, 14, "#D35230", "P", 10)}</svg>`;
  const DOC = `<svg viewBox="0 0 44 56"><rect width="44" height="56" rx="5" fill="${PAPER}"/><g fill="${INK}">${lines(6, [8, 15, 20, 25, 30, 35, 40], [20, 32, 30, 32, 27, 31, 18])}</g>
    <circle cx="30" cy="31" r="8.5" fill="none" stroke="#C9A57E" stroke-width="2.2" opacity=".5"/>${badge(5, 43, 15, 12, "#2B5DB8", "W", 9)}</svg>`;
  const PHOTO = `<svg viewBox="0 0 60 52"><rect width="60" height="52" rx="4" fill="#fff"/><rect x="4" y="4" width="52" height="37" rx="2" fill="#3A3E56"/>
    <path d="M11 8.5l38 2.5v20l-38 3.5z" fill="#E7E3D9"/><g fill="#BDB6A8"><path d="M15 13l18 1v2.6l-18-1z"/><path d="M15 19.5l26 1.3v2.2l-26-1z"/><path d="M15 25l22 .8v2.2l-22-.6z"/></g>
    <path d="M10 41a7 7 0 0 1 14 0zM33 41a8 8 0 0 1 16 0z" fill="#23263A"/></svg>`;
  const GLYPH = [ // the levels: a lesson, flashcards, a quiz, a star
    `<path d="M11 14.5q4.5-1.6 9 1 4.5-2.6 9-1v12q-4.5-1.6-9 1-4.5-2.6-9-1z"/><path d="M20 15.5v12"/>`,
    `<rect x="11.5" y="14" width="13" height="15" rx="2.5"/><path d="M16 10.5h10a2.5 2.5 0 0 1 2.5 2.5v12"/>`,
    `<path d="M12.5 20.5l5 5 10-10"/>`,
    `<path d="M20 11.5l2.5 5.2 5.7.7-4.2 3.9 1.1 5.6L20 24.2l-5.1 2.7 1.1-5.6-4.2-3.9 5.7-.7z" fill="#fff" stroke-width="1.6"/>`];
  const NODE = g => `<svg viewBox="0 0 40 44"><circle cx="20" cy="24" r="18" fill="#5A4BD1"/><circle cx="20" cy="20" r="18" fill="#7B6CF0"/><g fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${g}</g></svg>`;
  const SLOT = `<svg viewBox="0 0 40 44"><circle class="s2" cx="20" cy="24" r="18"/><circle class="s1" cx="20" cy="20" r="18"/></svg>`;
  const CUP = `<path d="M16 13h16v6.5a8 8 0 0 1-16 0z"/><path d="M16 15.5h-3.6v1.2a4.6 4.6 0 0 0 4.6 4.6M32 15.5h3.6v1.2a4.6 4.6 0 0 1-4.6 4.6" fill="none" stroke-width="2.6"/><rect x="22.1" y="26.5" width="3.8" height="4.5"/><rect x="18" y="31" width="12" height="4.2" rx="1.6"/>`;
  const TROPHY = on => `<svg viewBox="0 0 48 52"><circle class="s2" cx="24" cy="28" r="23"${on ? ' fill="#D9890A"' : ""}/><circle class="s1" cx="24" cy="24" r="23"${on ? ' fill="#F5A524"' : ""}/><g class="g"${on ? ' fill="#fff" stroke="#fff"' : ""}>${CUP}</g></svg>`;
  const SPARK = `<svg viewBox="0 0 20 20"><path d="M10 0q1.2 8.8 10 10-8.8 1.2-10 10Q8.8 11.2 0 10q8.8-1.2 10-10z" fill="#F5A524"/></svg>`;
  const T = 8.6, E = [1.4, 2.5, 3.6, 4.7], TR = 6, RS = 7.3, BACK = 7.45, D = .5; // round length, gulps, trophy, clear-up, files back, start
  const BOOK = [49, 66.5], PEN = [25, 30, 48], LEFT = [32, 65], RIGHT = [67, 70]; // Penny's book; her box; the bends under her face
  const INS = [[PDF, 6, 6, 15, -10, 56 / 44], [PPT, 0, 31, 24, 7, 48 / 64], [DOC, 8, 54, 15, -5, 56 / 44], [PHOTO, 2, 77, 21, 8, 52 / 60]];
  const SLOTS = [[84, 82], [90, 62], [85, 42], [76, 23]], CUPAT = [55, 11], NW = 12, CW = 16;
  const r1 = n => +n.toFixed(2);
  const box = (x, y, w) => `left:${r1(x)}%;top:${r1(y)}%;width:${w}%`;
  const go = (dx, dy, rest = "") => `transform:translate(${dx.toFixed(1)}cqw,${dy.toFixed(1)}cqw)${rest && " " + rest}`;
  const kf = (name, fr) => `@keyframes ${name}{${fr.map(([s, css, ease]) => `${(s / T * 100).toFixed(2)}%{${css}${ease ? ";animation-timing-function:" + ease : ""}}`).join("")}}`;
  const blink = (spans, on, off) => [[0, off], ...spans.flatMap(([a, b]) => [[a, off], [a + .03, on], [b, on], [b + .03, off]]), [T, off]];
  const PTS = [...SLOTS, CUPAT]; // the road: a smooth line through the levels to the trophy
  const ROAD = PTS.map((c, i) => {
    if (!i) return `M${c[0]} ${c[1]}`;
    const a = PTS[i - 2] || PTS[i - 1], b = PTS[i - 1], d = PTS[i + 1] || c;
    return `C${r1(b[0] + (c[0] - a[0]) / 6)} ${r1(b[1] + (c[1] - a[1]) / 6)} ${r1(c[0] - (d[0] - b[0]) / 6)} ${r1(c[1] - (d[1] - b[1]) / 6)} ${c[0]} ${c[1]}`;
  }).join("");
  const LEN = PTS.slice(1).map((p, i) => Math.hypot(p[0] - PTS[i][0], p[1] - PTS[i][1]));
  const LEFTOVER = LEN.map((_, i) => r1(100 - 100 * LEN.slice(0, i + 1).reduce((s, x) => s + x) / LEN.reduce((s, x) => s + x))); // road still to draw at each stop
  function heroCss() {
    const css = [], run = [];
    const add = (sel, name, fr) => { css.push(kf(name, fr)); run.push(`#ldArt ${sel}{animation:${name} ${T}s ${D}s infinite backwards}`); };
    const hidden = "opacity:0;transform:scale(0)";
    INS.forEach(([, x, y, w, , k], i) => {
      const e = E[i], c = [x + w / 2, y + w * k / 2], back = BACK + .12 * i, inside = go(BOOK[0] - c[0], BOOK[1] - c[1], "scale(.08)") + ";opacity:0";
      add(`.i${i} .mv`, `ld-i${i}`, [[0, "transform:none;opacity:1"], [e - .95, "transform:none;opacity:1", "cubic-bezier(.3,0,.4,1)"],
        [e - .75, "transform:translate(0,-3cqw) rotate(-8deg) scale(1.08)", "cubic-bezier(.5,0,.6,1)"],
        [e - .3, go(LEFT[0] - c[0], LEFT[1] - c[1], "rotate(12deg) scale(.6)"), "cubic-bezier(.5,0,.9,.6)"],
        [e, go(BOOK[0] - c[0], BOOK[1] - c[1], "rotate(30deg) scale(.12)") + ";opacity:1"], [e + .04, inside], [back - .01, inside],
        [back, "transform:scale(0);opacity:0", "cubic-bezier(.3,1.6,.5,1)"], [back + .4, "transform:none;opacity:1"], [T, "transform:none;opacity:1"]]);
    });
    SLOTS.forEach(([x, y], i) => {
      const e = E[i], off = RS + .06 * (3 - i), inBook = go(BOOK[0] - x, BOOK[1] - y, "scale(.1)") + ";opacity:0";
      add(`.n${i} .mv`, `ld-n${i}`, [[0, inBook], [e + .02, inBook, "cubic-bezier(.3,.6,.5,1)"], [e + .3, go(RIGHT[0] - x, RIGHT[1] - y, "scale(.65)") + ";opacity:1", "cubic-bezier(.3,1.5,.5,1)"],
        [e + .68, "transform:none"], [e + .76, "transform:scale(1.12,.9)"], [e + .86, "transform:none;opacity:1"], [off, "transform:none;opacity:1", "cubic-bezier(.5,0,.9,.5)"],
        [off + .3, hidden], [off + .31, inBook], [T, inBook]]);
      add(`.p${i}`, `ld-p${i}`, [[0, "opacity:0;transform:scale(.8)"], [e + .7, "opacity:0;transform:scale(.8)"], [e + .74, "opacity:.8;transform:scale(.95)"], [e + 1.25, "opacity:0;transform:scale(1.8)"], [T, "opacity:0;transform:scale(.8)"]]);
    });
    add(".ld-road .r1", "ld-road", [[0, "stroke-dashoffset:100"], ...[1, 2, 3].flatMap(k => [[E[k] + .45, `stroke-dashoffset:${k > 1 ? LEFTOVER[k - 2] : 100}`], [E[k] + .75, `stroke-dashoffset:${LEFTOVER[k - 1]}`]]),
      [TR - .45, `stroke-dashoffset:${LEFTOVER[2]}`], [TR, "stroke-dashoffset:0"], [RS, "stroke-dashoffset:0"], [RS + .35, "stroke-dashoffset:100"], [T, "stroke-dashoffset:100"]]);
    add(".ld-tro.on", "ld-tro", [[0, "opacity:0;transform:scale(.5)"], [TR - .05, "opacity:0;transform:scale(.5)", "cubic-bezier(.3,1.6,.5,1)"], [TR + .35, "opacity:1;transform:none"],
      [TR + .5, "transform:rotate(-10deg)"], [TR + .7, "transform:rotate(8deg)"], [TR + .9, "transform:rotate(-4deg)"], [TR + 1.05, "opacity:1;transform:none"],
      [RS, "opacity:1;transform:none", "ease-in"], [RS + .35, "opacity:0;transform:scale(.7)"], [T, "opacity:0;transform:scale(.5)"]]);
    add(".ld-tglow", "ld-tglow", [[0, "opacity:0;transform:scale(.5)"], [TR, "opacity:0;transform:scale(.5)"], [TR + .3, "opacity:1;transform:scale(1.15)"], [TR + 1.4, "opacity:0;transform:scale(1.7)"], [T, "opacity:0;transform:scale(.5)"]]);
    add(".cf", "ld-cf", [[0, "opacity:0;transform:none"], [TR + .02, "opacity:0;transform:none", "cubic-bezier(.15,.8,.35,1)"], [TR + .08, "opacity:1"],
      [TR + .75, "transform:translate(var(--cx),var(--cy)) rotate(var(--cr))", "cubic-bezier(.5,0,.8,.5)"], [TR + 1.2, "opacity:1"],
      [TR + 1.6, "opacity:0;transform:translate(var(--cx),calc(var(--cy) + 12cqw)) rotate(calc(var(--cr) * 2))"], [T, "opacity:0;transform:none"]]);
    const hop = [[TR - .04, "transform:none"], [TR + .1, "transform:scale(1.08,.9)", "cubic-bezier(.2,.7,.4,1)"], [TR + .34, "transform:translateY(-7cqw) scale(.96,1.05)", "cubic-bezier(.6,0,.8,.4)"],
      [TR + .56, "transform:scale(1.06,.94)"], [TR + .7, "transform:none"], [TR + .78, "transform:none", "cubic-bezier(.2,.7,.4,1)"], [TR + .94, "transform:translateY(-3.5cqw)", "cubic-bezier(.6,0,.8,.4)"],
      [TR + 1.1, "transform:scale(1.03,.97)"], [TR + 1.2, "transform:none"]];
    add(".cw-penny .mv", "ld-pen", [[0, "transform:none"], ...E.flatMap(e => [[e - .04, "transform:none"], [e + .1, "transform:scale(1.07,.93)"], [e + .24, "transform:scale(.97,1.04)"], [e + .38, "transform:none"]]), ...hop, [T, "transform:none"]]);
    const glad = [...E.map(e => [e + .05, e + .5]), [TR, RS - .15]];
    add(".e-happy", "ld-eh", blink(glad, "opacity:1", "opacity:0"));
    add(".e-open", "ld-eo", blink(glad, "opacity:0", "opacity:1"));
    add(".mouth-o", "ld-mo", blink([[TR + .05, RS - .15]], "opacity:1", "opacity:0"));
    add(".mouth-s", "ld-ms", blink([[TR + .05, RS - .15]], "opacity:0", "opacity:1"));
    add(".ld-glow", "ld-glow", [[0, "opacity:0;transform:scale(.4)"], ...E.flatMap(e => [[e - .01, "opacity:0;transform:scale(.4)"], [e + .12, "opacity:.95;transform:scale(1)"], [e + .6, "opacity:0;transform:scale(1.5)"]]), [T, "opacity:0;transform:scale(.4)"]]);
    [0, 1, 2].forEach(j => add(`.sp${j}`, `ld-sp${j}`, [[0, hidden], ...E.flatMap(e => [[e + .05 * j, hidden + " rotate(0deg)"], [e + .05 * j + .18, "opacity:1;transform:scale(1.2) rotate(45deg)"], [e + .05 * j + .45, hidden + " rotate(90deg)"]]), [T, hidden]]));
    return `<style>${css.join("")}@media (prefers-reduced-motion:no-preference){#ldArt .cw-penny .e-happy,#ldArt .cw-penny .mouth-o{display:inline}${run.join("")}}</style>`;
  }
  const COLORS = ["#6C5CE7", "#F5A524", "#3FC98F", "#FF5A47", "#4C8DF6", "#FF8FA8"];
  return () => heroCss()
    + `<svg class="ld-road" viewBox="0 0 100 100" preserveAspectRatio="none"><path class="r0" d="${ROAD}"/><path class="r1" d="${ROAD}" pathLength="100"/></svg>`
    + SLOTS.map(([x, y]) => `<div class="ld-slot" style="${box(x - NW / 2, y - NW * .55, NW)}">${SLOT}</div>`).join("")
    + `<i class="ld-tglow" style="${box(CUPAT[0] - 13, CUPAT[1] - 13, 26)}"></i>`
    + [false, true].map(on => `<div class="ld-tro ${on ? "on" : "off"}" style="${box(CUPAT[0] - CW / 2, CUPAT[1] - CW * 52 / 96, CW)}">${TROPHY(on)}</div>`).join("")
    + `<div class="fl cw cw-penny" style="${box(...PEN)}"><div class="mv">${tutorArt("penny", "", "open")}</div></div>`
    + `<i class="ld-glow" style="${box(BOOK[0] - 16, BOOK[1] - 16, 32)}"></i>`
    + [[40, 58], [57, 56], [52, 71]].map(([x, y], j) => `<i class="ld-spk sp${j}" style="${box(x - 2.5, y - 2.5, 5)}">${SPARK}</i>`).join("")
    + INS.map(([art, x, y, w, r], i) => `<div class="fl in i${i}" style="${box(x, y, w)};--r:${r}deg;--p:${(.08 * i).toFixed(2)}s;--t:${(3.2 + i * .5).toFixed(1)}s"><div class="mv">${art}</div></div>`).join("")
    + SLOTS.map(([x, y], i) => `<div class="fl nd n${i}" style="${box(x - NW / 2, y - NW * .55, NW)}"><div class="mv">${NODE(GLYPH[i])}</div></div><i class="ld-ping p${i}" style="${box(x - NW / 2, y - .6 - NW / 2, NW)}"></i>`).join("")
    + Array.from({ length: 14 }, (_, i) => {
      const a = (-168 + i * 156 / 13) * Math.PI / 180, r = 13 + (i * 7 % 5) * 2.6;
      return `<i class="cf" style="${box(CUPAT[0] - 1.2, CUPAT[1] - .6, 2.4)};background:${COLORS[i % 6]};--cx:${(Math.cos(a) * r).toFixed(1)}cqw;--cy:${(Math.sin(a) * r * .8).toFixed(1)}cqw;--cr:${(i % 2 ? 1 : -1) * (160 + i * 25)}deg"></i>`;
    }).join("");
})();
const STEP_ICONS = [UPLOAD, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/></svg>`];
function viewWelcome() {
  hideNav(); plain(); document.body.classList.add("landing");
  const s = session(), d = draft();
  if (s) return nav(homeOf());
  const locked = !!d?.slug; // the free lessons are already building: the files can't change, so offer to finish the setup
  view().innerHTML = `<div class="ld" id="ld">
    <header class="ld-top"><span class="ld-logo"><b>${t("brand")}</b></span><span class="ld-gap"></span>${langBtn()}</header>
    <section class="ld-hero">
      <div class="ld-art" id="ldArt" aria-hidden="true">${crew()}</div>
      <div class="ld-copy">
        <h1 class="ld-h">${t("landTitle1")} <em>${t("landTitle2")}</em></h1>
        <p class="ld-sub">${t("landSub")}</p>
        <div class="ld-cta">
          ${locked ? `<a class="ld-b ld-go" href="#/new/${d.step || "account"}">${t("welcomeResume")}</a>`
            : `<button class="ld-b ld-go" id="drop" type="button" aria-describedby="dropHint">${UPLOAD}<span id="dropTxt">${t("landDrop")}</span></button>`}
          <a class="ld-b ld-have" href="#/login">${t("welcomeHave")}</a>
          ${d && !locked ? `<a class="btn-t sm ld-resume" href="#/new/${d.step || "files"}">${t("welcomeResume")}</a>` : ""}
        </div>
        ${locked ? "" : `<p class="ld-types" id="dropHint"><span class="ld-drag">${t("landDrag")} · </span>${t("landTypes")}</p>
        <input type="file" id="pick" accept="${ACCEPT}" multiple hidden>`}
        <p class="ob-err c" id="err" hidden role="alert"></p>
      </div>
    </section>
    <ol class="ld-steps">${[1, 2, 3].map(i => `<li><span class="ld-si">${STEP_ICONS[i - 1]}</span><span><small>${i}</small>${t("landS" + i)}</span></li>`).join("")}</ol>
    <footer class="ld-foot">${legalLinks()}</footer>
    <div class="ld-over" aria-hidden="true"><div>${ham("open")}<b>${t("landDropHere")}</b></div></div></div>`;
  bindLang();
  if (locked) return;
  const drop = $("#drop"), pick = $("#pick"), ld = $("#ld");
  let busy = false;
  const start = async list => {
    const files = [...list]; if (!files.length || busy) return;
    busy = true; drop.classList.add("busy"); drop.setAttribute("aria-busy", "true"); drop.querySelector("svg").outerHTML = SPIN; $("#dropTxt").textContent = t("landBusy"); $("#err").hidden = true;
    try {
      if (!draft()) {
        const { orderToken } = await api("start", { lang: courseLang() });
        saveDraft({ orderToken, step: "files", files: [], days: 7 });
      }
      handoff = files;
      nav("#/new/files");
    } catch (e) {
      busy = false; drop.classList.remove("busy"); drop.removeAttribute("aria-busy"); drop.querySelector("svg").outerHTML = UPLOAD; $("#dropTxt").textContent = t("landDrop");
      fail($("#err"), e);
    }
  };
  drop.onclick = () => pick.click(); // a real button: Enter and Space open the picker too
  pick.onchange = e => { start(e.target.files); e.target.value = ""; };
  // Files dropped anywhere on the page count, so a near miss doesn't make the browser open the PDF instead.
  let depth = 0;
  ld.ondragenter = e => { e.preventDefault(); depth++; ld.classList.add("over"); };
  ld.ondragleave = () => { if (--depth <= 0) { depth = 0; ld.classList.remove("over"); } };
  ld.ondragover = e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"; };
  ld.ondrop = e => { e.preventDefault(); depth = 0; ld.classList.remove("over"); start(e.dataTransfer?.files || []); };
}

/* ---------- login ---------- */
// Access codes are gone from the app (Marek, 2026-11-12): email and password only.
function signedIn(r, email) {
  store.set("session", { token: r.session, slug: r.student.slug });
  if (email) store.set("email", email);
  resetCourse();
  nav(r.course ? "#/s/" + r.student.slug : "#/wait");
}
function loginFrame(title, form) {
  hideNav(); plain();
  view().innerHTML = `<div class="ob"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${CLOSE}</button></div>
    <div class="ob-login">${ham("open", "ob-mini")}<h1 class="ob-h">${title}</h1>${form}</div></div>`;
  $("#stepBack").onclick = () => nav("#/");
}
/* ---------- Continue with Google (2026-11-15) ---------- */
// Google's own button, from Google's script, so it looks the way their brand rules ask. It hands back a signed ID token
// that pc-api checks (signup and login take it as "google"); the page reads the email and first name out of it only to show
// them. Off, with nothing loaded from Google, until store.config.json has google.clientId.
// Our own button face in the app's style, with Google's real button laid over it, invisible and stretched to cover: the tap
// still lands on Google's button, and the page's buttons match (Marek, 2026-11-17).
const G_LOGO = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;
// On sign-in an "or" line follows, with the e-mail form under it; on the new-account step it is one of two buttons.
const G_BOX = (signup = false) => `<div class="ob-g" id="gBox" hidden><div class="ob-gwrap"><div class="btn-s ob-gface" aria-hidden="true">${G_LOGO}<span>${t(signup ? "gSignup" : "gContinue")}</span></div><div class="ob-gbtn"></div></div>${signup ? "" : `<p class="ob-or"><span>${t("orWord")}</span></p>`}</div>`;
let gsiP;
const loadGsi = () => gsiP ||= new Promise((ok, no) => {
  const s = Object.assign(document.createElement("script"), { src: "https://accounts.google.com/gsi/client", async: true });
  s.onload = () => window.google?.accounts?.id ? ok(window.google.accounts.id) : no(new Error("offline"));
  s.onerror = () => { gsiP = null; s.remove(); no(new Error("offline")); };
  document.head.append(s);
});
const tokenClaims = tok => {
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0)))); } catch { return {}; }
};
async function googleButton(box, onToken, signup = false) {
  const id = (await storeConfig().catch(() => ({}))).google?.clientId;
  if (!id || !box?.isConnected) return;
  const g = await loadGsi().catch(() => null);
  if (!g || !box.isConnected) return; // offline, a blocker, or the page moved on: the email form is still there
  const th = document.documentElement.dataset.theme, dark = th === "dark" || (!th && matchMedia("(prefers-color-scheme: dark)").matches);
  g.initialize({ client_id: id, callback: r => r?.credential && onToken(r.credential), ux_mode: "popup", auto_select: false });
  box.hidden = false;
  const slot = box.querySelector(".ob-gbtn"), w = Math.round(Math.max(200, Math.min(400, box.clientWidth)));
  g.renderButton(slot, { type: "standard", theme: dark ? "filled_black" : "outline", size: "large", shape: "pill", text: signup ? "signup_with" : "continue_with", logo_alignment: "center", width: w, locale: lang() });
  slot.style.transform = `scale(${(box.clientWidth / w).toFixed(3)}, 1.5)`; // Google's button is 40 high and at most 400 wide: stretch it over our 56-high face
}

function viewLogin() {
  loginFrame(t("signinTitle"), `${G_BOX()}<form id="f" class="ob-form"><input class="ob-in" id="email" type="email" autocomplete="email" placeholder="${t("accEmail")}" aria-label="${t("accEmail")}" maxlength="200">
    <input class="ob-in" id="pass" type="password" autocomplete="current-password" placeholder="${t("accPass")}" aria-label="${t("accPass")}" maxlength="200">
    <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p" id="go">${t("loginGo")}</button><p class="ob-legal" id="forgot" hidden></p></form>`);
  $("#email").focus();
  // No reset e-mail yet: the student writes in and gets a new password by hand (pc password <email>). Shown once the contact address is set.
  storeConfig().then(c => { const el = $("#forgot"), m = c.operator?.email; if (el && m) { el.textContent = t("signinForgot", { email: m }); el.hidden = false; } }).catch(() => { });
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#pass").value;
    if (!email || !password) return;
    $("#go").disabled = true; $("#err").hidden = true;
    try { const r = await api("login", { email, password }); store.set("session", { token: r.session, slug: r.student.slug }); await useInvite(); signedIn(r, email); } catch (er) { fail($("#err"), er); $("#go").disabled = false; }
  };
  googleButton($("#gBox"), async token => {
    $("#err").hidden = true;
    try { const r = await api("login", { google: token }); store.set("session", { token: r.session, slug: r.student.slug }); await useInvite(); signedIn(r, r.email || tokenClaims(token).email); } catch (er) { fail($("#err"), er); }
  });
}

/* ---------- step 1: slides ---------- */
// One course holds at most 250 slide pages (Marek, 2026-11-12): a 458-slide semester cost ~300 Kč to build, close to PRO's price.
// Same number in pc-api (upload_url) and the worker (keeps the first 250). Word and text pages count 3 each (slidesOf).
export const MAX_PAGES = 250;
const uploading = new Map();
const tooMany = () => Object.assign(new Error("too_many_pages"), { code: "too_many_pages" });
const fileKind = name => /\.pptx?$/i.test(name) ? "pptx" : /\.(docx?|rtf)$/i.test(name) ? "doc" : /\.(txt|md)$/i.test(name) ? "txt" : "pdf";
function fileRows(d) {
  const rows = d.files.map(f => `<div class="ob-file"><span class="ob-fk ${fileKind(f.name)}">${fileKind(f.name).toUpperCase()}</span><div class="t"><b>${esc(f.name)}</b><span>${pagesTxt(f.pages)}${slidesOf(f.name, 1) > 1 ? ` ×${slidesOf(f.name, 1)}` : ""}${f.estimated ? ` (${t("filesEst")})` : ""}</span></div><button class="ob-x" data-rm="${esc(f.path)}" aria-label="${t("filesRemove")}">${ic.x}</button></div>`).join("");
  const up = [...uploading.values()].map(u => `<div class="ob-file busy"><span class="ob-fk ${fileKind(u.name)}">${fileKind(u.name).toUpperCase()}</span><div class="t"><b>${esc(u.name)}</b><div class="ob-bar"><i style="width:${u.pct}%"></i></div></div></div>`).join("");
  return rows + up;
}
function viewFiles() {
  view().innerHTML = frame("files", { title: t("filesTitle"), sub: t("filesSub"), btn: t("next"),
    body: `<div id="list"></div>
      <label class="ob-drop" id="drop">${ic.upload}<b id="dropTxt"></b><input type="file" id="pick" accept="${ACCEPT}" multiple hidden></label>
      <p class="ob-err" id="err" hidden role="alert"></p><div class="ob-sum" id="total" hidden></div><p class="ob-note">${t("filesNote")}</p>` });
  bindStepBack("files");
  const refresh = () => {
    const cur = draft();
    $("#list").innerHTML = fileRows(cur);
    $("#dropTxt").textContent = cur.files.length || uploading.size ? t("filesAdd") : t("filesDrop");
    $("#drop").classList.toggle("more", !!(cur.files.length || uploading.size));
    const n = cur.files.reduce((a, f) => a + slidesOf(f.name, f.pages), 0), over = n > MAX_PAGES;
    $("#total").hidden = !cur.files.length;
    $("#total").classList.toggle("over", over);
    // Just what was uploaded (Marek, 2026-11-17): the free start is one lesson, so "x of 250" said nothing here. The cap speaks up only once it is passed.
    $("#total").innerHTML = `${over ? ic.book : ic.check}<span>${t(over ? "filesOver" : "filesSummary", { pages: `<b>${pagesTxt(n)}</b>`, max: MAX_PAGES })}</span>`;
    $("#nextBtn").disabled = !cur.files.length || uploading.size > 0 || over;
    $$("[data-rm]").forEach(b => b.onclick = async () => {
      const x = draft(); x.files = x.files.filter(f => f.path !== b.dataset.rm); saveDraft(x); refresh();
      api("remove_file", { orderToken: x.orderToken, path: b.dataset.rm }).catch(() => { });
    });
  };
  const add = async file => {
    const key = crypto.randomUUID();
    try {
      const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (!validFile(file.name, head)) { const e = new Error("fake"); e.code = "fake"; throw e; }
      if (file.size > 50 * 1024 * 1024) { const e = new Error("too_big"); e.code = "too_big"; throw e; }
      const { pages, estimated } = await countPages(file);
      // counts files still uploading too, so several picked at once can't pass the cap together
      const have = draft().files.reduce((a, f) => a + slidesOf(f.name, f.pages), 0) + [...uploading.values()].reduce((a, u) => a + (u.slides || 0), 0);
      if (have + slidesOf(file.name, pages) > MAX_PAGES) throw tooMany();
      uploading.set(key, { name: file.name, pct: 0, slides: slidesOf(file.name, pages) }); refresh();
      const { url, path, mime } = await api("upload_url", { orderToken: draft().orderToken, name: file.name, size: file.size, pages });
      await new Promise((res, rej) => {
        const x = new XMLHttpRequest(); x.open("PUT", url); x.setRequestHeader("Content-Type", mime);
        x.upload.onprogress = e => { if (e.lengthComputable) { uploading.get(key).pct = e.loaded / e.total * 100; if ($("#list")) $("#list").innerHTML = fileRows(draft()); } };
        x.onload = () => x.status < 300 ? res() : rej(Object.assign(new Error("server"), { code: "server" }));
        x.onerror = () => rej(Object.assign(new Error("offline"), { code: "offline" }));
        x.send(file);
      }).catch(e => { api("remove_file", { orderToken: draft().orderToken, path }).catch(() => { }); throw e; });
      const cur = draft(); cur.files.push({ path, name: file.name, size: file.size, pages, estimated }); saveDraft(cur);
    } catch (e) { fail($("#err"), e); }
    uploading.delete(key); if ($("#list")) refresh();
  };
  // Pictures picked or dropped together become one PDF (a page each, in file-name order), then upload like any PDF.
  const addImages = async imgs => {
    const key = crypto.randomUUID();
    uploading.set(key, { name: t("imagesConverting", { n: imgs.length }), pct: 0 }); refresh();
    try {
      const pdfs = await imagesToPdfs(imgs, (part, n) => t("imagesPdf", { n }) + (part ? ` (${part})` : ""), (done, total) => {
        uploading.get(key).pct = done / total * 100; if ($("#list")) $("#list").innerHTML = fileRows(draft());
      });
      uploading.delete(key);
      for (const f of pdfs) await add(f);
    } catch (e) { uploading.delete(key); fail($("#err"), e); if ($("#list")) refresh(); }
  };
  const addAll = files => {
    $("#err").hidden = true;
    const all = [...files], imgs = all.filter(isImage);
    all.filter(f => !isImage(f)).forEach(add);
    if (imgs.length) addImages(imgs);
  };
  $("#pick").onchange = e => { addAll(e.target.files); e.target.value = ""; };
  const drop = $("#drop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addAll(e.dataTransfer.files); };
  $("#nextBtn").onclick = () => {
    const cur = draft();
    if (!cur.files.length || uploading.size) return;
    cur.pages = cur.files.reduce((a, f) => a + slidesOf(f.name, f.pages), 0);
    if (cur.pages > MAX_PAGES) return fail($("#err"), tooMany());
    cur.step = "date"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, pages: cur.pages }).catch(() => { });
    nav("#/new/date");
  };
  refresh();
  if (handoff) { const f = handoff; handoff = null; addAll(f); } // dropped on the landing page: upload them here, no second pick
}

/* ---------- step 2: exam date, a month calendar ---------- */
// Marek, 2026-11-15: "I still hate the timeline". A plain month you tap, like the calendar on a phone. The days from today
// to the exam are tinted, so the student sees how much time is left. The same picker is in Settings → exam date.
export const DATE_MIN = 1, DATE_MAX = 180; // from tomorrow to about half a year out
const paceOf = n => n < 14 ? "sprint" : n < 35 ? "tempo" : "chill";
// Minutes a day: one pass plus three repeats of every page (3 min a page), spread over the days before the last two.
// The plan's daily minutes, snapped to the goals the settings offer (10/15/20/30/60).
export const minutesFor = (pages, n) => snapGoal(Math.max(10, Math.min(90, Math.round((pages || 20) * 3 / Math.max(1, n - 2) / 5) * 5)));
const p2 = n => String(n).padStart(2, "0");
const ymd = (y, m, d) => `${y}-${p2(m + 1)}-${p2(d)}`;
const monthName = (y, m) => { try { return new Date(y, m, 1, 12).toLocaleDateString(lang(), { month: "long", year: "numeric" }); } catch { return `${m + 1}/${y}`; } };
// Monday first; 1 Jan 2024 was a Monday.
const weekdays = () => Array.from({ length: 7 }, (_, i) => { try { return new Date(2024, 0, 1 + i, 12).toLocaleDateString(lang(), { weekday: "short" }).replace(".", ""); } catch { return ""; } });
export function calHtml() {
  return `<div class="mcal"><div class="cal-hd"><button type="button" class="cal-nav" id="calPrev" aria-label="${esc(t("calPrev"))}">${BACK}</button><b id="calMonth" aria-live="polite"></b><button type="button" class="cal-nav nx" id="calNext" aria-label="${esc(t("calNext"))}">${BACK}</button></div>
    <div class="cal-wd" aria-hidden="true">${weekdays().map(w => `<span>${esc(w)}</span>`).join("")}</div><div class="cal-grid" id="calGrid"></div></div>`;
}
// The line under the calendar: the date in words, how far off it is, minutes a day and the pace.
export function planHtml(n, iso, pages) {
  if (!iso) return `<div class="cal-plan empty">${calIcon()}<span>${esc(t("datePick"))}</span></div>`;
  const kind = paceOf(n), when = n < 14 ? inDays(n) : inWeeks(Math.round(n / 7));
  return `<div class="cal-plan"><div class="t"><b>${esc(fmtDay(iso))}</b><span>${esc(t("dateRel", { when, min: minutesFor(pages, n) }))}</span></div><span class="badge ${kind}">${PACE_ICONS[kind]}${t({ sprint: "paceSprint", tempo: "paceTempo", chill: "paceChill" }[kind])}</span></div>`;
}
// Binds the calendar from calHtml(). onPick(n, iso) after every pick (and once at the start when a date is already set).
export function bindCal(startIso, onPick) {
  const t0 = today(), min = addDays(t0, DATE_MIN), max = addDays(t0, DATE_MAX);
  let sel = startIso && startIso >= min && startIso <= max ? startIso : null;
  let [y, m] = (sel || t0).split("-").map(Number); m--;
  const first = t0.slice(0, 7), last = max.slice(0, 7), grid = $("#calGrid");
  // The tint is drawn cell by cell, so it moves cell by cell: after a pick the new cells fill in one after another from the old
  // end towards the tapped day, slowing down as they arrive; when the day moves earlier the cells left over empty out back
  // to it. `was` is the pick before this one (undefined = no motion: a month turn). CSS runs it only without reduced motion.
  const draw = (focus, was) => {
    const cur = ymd(y, m, 1).slice(0, 7);
    $("#calMonth").textContent = monthName(y, m);
    $("#calPrev").disabled = cur <= first; $("#calNext").disabled = cur >= last;
    const lead = (new Date(y, m, 1, 12).getDay() + 6) % 7, len = new Date(y, m + 1, 0).getDate();
    let html = "";
    const move = was !== undefined && sel && was !== sel, back = move && was && was > sel;
    const inMove = day => move && (back ? day > sel && day <= was : day >= t0 && day <= sel && (!was || day > was));
    let n = 0, k = 0;
    for (let d = 1; d <= len; d++) if (inMove(ymd(y, m, d))) n++;
    const T = Math.min(420, 140 + 24 * n), ease = x => 1 - (1 - x) ** 2;
    for (let i = 0; i < lead; i++) html += `<span class="cd blank"></span>`;
    for (let d = 1; d <= len; d++) {
      const day = ymd(y, m, d), col = (lead + d - 1) % 7, off = day < min || day > max;
      // the tint runs from today to the exam day; it is rounded where it starts and ends, and at the ends of each week row
      const band = sel && day >= t0 && day <= sel;
      const mv = inMove(day), out = mv && back, end = out ? was : sel;
      const cls = ["cd", off && "off", day === t0 && "today", day === sel && "sel", band && "band", mv && (out ? "bout" : "gin"), move && day === sel && "cpop", // not "pop": that's the map popover in base.css
        (band || out) && (day === t0 || col === 0 || d === 1) && "bs", (band || out) && (day === end || col === 6 || d === len) && "be"].filter(Boolean).join(" ");
      let st = "";
      if (mv) { const i = out ? n - 1 - k : k; k++; st = ` style="--d:${Math.round(T * ease(i / n))}ms;--t:${Math.max(16, Math.round(T * (ease((i + 1) / n) - ease(i / n))))}ms"`; }
      html += `<button type="button" class="${cls}"${st} data-d="${day}"${off ? " disabled" : ""} aria-pressed="${day === sel}" aria-label="${esc(fmtDay(day))}"${day === t0 ? ' aria-current="date"' : ""}><span>${d}</span></button>`;
    }
    grid.innerHTML = html;
    if (focus) grid.querySelector(`[data-d="${focus}"]`)?.focus();
  };
  const choose = (day, focus) => {
    const was = sel;
    sel = day; [y, m] = day.split("-").map(Number); m--;
    draw(focus && day, was); sfx.flip();
    onPick(daysBetween(t0, day), day);
  };
  const month = k => { m += k; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } draw(); };
  $("#calPrev").onclick = () => month(-1);
  $("#calNext").onclick = () => month(1);
  grid.onclick = e => { const b = e.target.closest("[data-d]"); if (b && !b.disabled) choose(b.dataset.d); };
  // Arrow keys move the pick a day or a week (mirrored in right-to-left languages).
  grid.onkeydown = e => {
    const rtl = document.documentElement.dir === "rtl";
    const k = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowDown: 7, ArrowUp: -7 }[e.key];
    if (!k) return;
    e.preventDefault();
    const from = sel || e.target.closest("[data-d]")?.dataset.d || min, to = addDays(from, k);
    choose(to < min ? min : to > max ? max : to, true);
  };
  // Phones: a sideways swipe turns the month.
  let sx = null, sy = 0;
  grid.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") { sx = e.clientX; sy = e.clientY; } });
  grid.addEventListener("pointerup", e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const k = (dx < 0) !== (document.documentElement.dir === "rtl") ? 1 : -1;
    if (!(k > 0 ? $("#calNext") : $("#calPrev")).disabled) month(k);
  });
  draw(null, null);
  onPick(sel ? daysBetween(t0, sel) : 0, sel);
  return { get: () => sel };
}
function viewDate() {
  const d = draft();
  view().innerHTML = frame("date", { title: t("dateTitle"), btn: t("next"),
    body: `<div class="ob-date">${calHtml()}<div id="calPlan" aria-live="polite"></div></div>` });
  bindStepBack("date");
  const cal = bindCal(d.examDate, (n, iso) => { $("#calPlan").innerHTML = planHtml(n, iso, d.pages); $("#nextBtn").disabled = !iso; });
  $("#nextBtn").onclick = () => {
    const iso = cal.get(); if (!iso) return;
    const n = daysBetween(today(), iso), cur = draft();
    cur.examDate = iso; cur.minutes = minutesFor(cur.pages, n); cur.days = 7; cur.step = "tutor"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, examDate: cur.examDate, minutes: cur.minutes, days: 7 }).catch(() => { });
    nav("#/new/tutor");
  };
}

/* ---------- step 3: tutor, a swipe carousel ---------- */
// Every tutor, Penny too. The list is drawn three times so the carousel wraps both ways: one swipe past the
// last tutor shows the first one, and the current tutor always sits in the middle with a neighbour on each side.
const pickable = () => TUTORS;
export function carouselHtml() {
  const one = copy => pickable().map((x, i) => `<div class="slot" data-i="${i}"${copy === 1 ? "" : ' aria-hidden="true"'}><div class="fig">${tutorArt(x.id)}</div></div>`).join("");
  return `<div class="car" id="car" dir="ltr">${one(0)}${one(1)}${one(2)}</div><div class="car-floor" aria-hidden="true"></div>
    <div class="tinfo"><b id="tName"></b><span class="ttag" id="tTag"></span></div><div class="dots" id="dots" aria-hidden="true">${pickable().map(() => "<i></i>").join("")}</div>`;
}
export function bindCarousel(startId, onChange) {
  const c = $("#car"), n = pickable().length, slots = [...c.children];
  let cur = -1, abs = n, settle = null;
  // Smooth on a phone (Marek, 2026-11-17: "glitchy"): the slots are measured once (and again when the width changes), so a
  // frame of a swipe costs one read (scrollLeft) and then only writes, at most once per frame, and only for the figures
  // that changed. Before, every scroll event measured all 21 slots between writes, a CSS transition chased the finger
  // and a filter came and went mid-swipe.
  let x0 = 0, W = 180, seenW = -1, raf = 0;
  const last = new Array(slots.length).fill(-1);
  const measure = () => { // x0: where slot 0's middle sits in the scrolled content; W: a slot's width
    const sr = slots[0].getBoundingClientRect(), cr = c.getBoundingClientRect();
    W = sr.width || 180; x0 = c.scrollLeft + sr.left + W / 2 - cr.left; seenW = c.clientWidth;
  };
  // how far to scroll so slot i sits exactly in the middle of the carousel
  const centre = i => { if (c.clientWidth !== seenW) measure(); return x0 + i * W - c.clientWidth / 2; };
  const paint = () => {
    raf = 0;
    if (!c.isConnected) return; // the step was left before this frame (Back, or a fast test): nothing to paint
    if (c.clientWidth !== seenW) measure();
    const mid = c.scrollLeft + c.clientWidth / 2;
    let best = 0, bd = 1e9;
    for (let i = 0; i < slots.length; i++) {
      const dist = Math.abs(x0 + i * W - mid) / W, k = Math.round(Math.min(dist, 1.4) * 200) / 200;
      if (dist < bd) { bd = dist; best = i; }
      if (k === last[i]) continue;
      last[i] = k;
      const f = slots[i].firstChild.style;
      f.transform = `translate3d(0,${k * 10}px,0) scale(${1 - k * 0.42})`;
      f.opacity = 1 - k * 0.45;
    }
    abs = best;
    const i = best % n;
    if (i !== cur) { cur = i; $("#tName").textContent = pickable()[i].name; $("#tTag").textContent = persona(pickable()[i].id, "tag") || ""; [...$("#dots").children].forEach((d, j) => d.classList.toggle("on", j === i)); onChange(pickable()[i]); }
  };
  // Once the swipe has fully stopped on a copy, jump to the same tutor in the middle copy. The jump must look like nothing,
  // so it never happens mid-swipe or mid-snap (that cut the motion short).
  const recentre = () => {
    if (abs >= n && abs < 2 * n) return;
    c.scrollLeft = centre(abs % n + n); paint(); // painted in the same frame as the jump, so nothing flickers
  };
  const go = (k, smooth = true) => c.scrollTo({ left: centre(Math.max(0, Math.min(slots.length - 1, k))), behavior: smooth ? "smooth" : "auto" });
  // scrollend fires after momentum and snapping are done; where it doesn't exist (older Safari), wait for a quiet 300 ms
  const hasEnd = "onscrollend" in window;
  c.addEventListener("scroll", () => { raf ||= requestAnimationFrame(paint); if (!hasEnd) { clearTimeout(settle); settle = setTimeout(recentre, 300); } }, { passive: true });
  if (hasEnd) c.addEventListener("scrollend", recentre);
  slots.forEach((s, i) => s.onclick = () => go(i));
  c.tabIndex = 0; c.onkeydown = e => { if (e.key === "ArrowRight") go(abs + 1); if (e.key === "ArrowLeft") go(abs - 1); };
  const startI = Math.max(0, pickable().findIndex(x => x.id === startId));
  requestAnimationFrame(() => { go(n + startI, false); paint(); });
  return { get: () => pickable()[Math.max(0, cur)] };
}
function viewTutor() {
  const d = draft();
  view().innerHTML = frame("tutor", { title: t("tutorPick"), btn: "", body: `<div class="ob-mid">${carouselHtml()}</div>` });
  bindStepBack("tutor");
  const car = bindCarousel(d.tutor || "fox", x => { $("#nextBtn").textContent = t("tutorGo", { name: tutorWith(x.id) }); sfx.flip(); });
  $("#nextBtn").onclick = async () => {
    const x = car.get(), cur = draft(), btn = $("#nextBtn");
    cur.tutor = x.id; saveDraft(cur);
    btn.disabled = true;
    try { // the free lessons start building now, while the student makes an account
      await api("update_order", { orderToken: cur.orderToken, pages: cur.pages, tutor: cur.tutor, examDate: cur.examDate, minutes: cur.minutes || 20, days: 7, lang: courseLang() });
      const r = await api("queue_free", { orderToken: cur.orderToken });
      if (r.session) { // another subject of a signed-in account: no account step
        store.set("session", { token: r.session, slug: r.slug }); store.del("draft"); resetCourse();
        if (r.proCap) toast(errText("pro_cap"));
        return nav("#/wait");
      }
      const y = draft(); y.slug = r.slug; y.step = "source"; saveDraft(y);
      nav("#/new/source");
    } catch (e) { toast(errText(e.code)); btn.disabled = false; }
  };
}

/* ---------- step 4: where did you hear about us (Marek, 2026-11-15, like Duolingo's) ---------- */
// One tap and Next; "somewhere else" covers the rest, so nobody is stuck. The answer goes with the signup (pc_students.source),
// so the launch can tell which channel brings students. The free lessons are already building while the student answers.
const SRC_ICONS = {
  tiktok: `<svg viewBox="0 0 24 24"><path fill="#25F4EE" d="M9.4 9.9v-1a7 7 0 0 0-1-.1 6.3 6.3 0 0 0-3.6 11.5A6.3 6.3 0 0 1 9.4 9.9z"/><path fill="#25F4EE" d="M9.6 21.2a2.9 2.9 0 0 0 2.9-2.8V3.2h2.6a4.8 4.8 0 0 1-.1-1h-3.6v15.3a2.9 2.9 0 0 1-4.2 2.5 2.9 2.9 0 0 0 2.4 1.2zM19.9 8V7a4.8 4.8 0 0 1-2.7-.8A4.8 4.8 0 0 0 19.9 8z"/><path fill="#FE2C55" d="M17.2 6.2A4.8 4.8 0 0 1 16 3.2h-1a4.8 4.8 0 0 0 2.2 3zM8.4 13.7a2.9 2.9 0 0 0-1.3 5.4 2.9 2.9 0 0 1 3.3-4.5v-3.9a6.3 6.3 0 0 0-1-.1h-.1v3a2.9 2.9 0 0 0-.9-.1z"/><path fill="#FE2C55" d="M19.9 8v2.9a8.2 8.2 0 0 1-4.8-1.5v6.9a6.3 6.3 0 0 1-9.8 5.2 6.3 6.3 0 0 0 10.9-4.3V10.3a8.2 8.2 0 0 0 4.8 1.5V8.9a4.9 4.9 0 0 1-1.1-.1z"/><path fill="currentColor" d="M15.1 16.3V9.4a8.2 8.2 0 0 0 4.8 1.5V8a4.8 4.8 0 0 1-2.7-1.8 4.8 4.8 0 0 1-2.2-3h-2.5v15.2a2.9 2.9 0 0 1-5.3 1.6 2.9 2.9 0 0 1 2.2-5.3v-3a6.3 6.3 0 0 0-4.5 10.7 6.3 6.3 0 0 0 10.2-6.1z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24"><defs><radialGradient id="igG" cx="30%" cy="107%" r="150%"><stop offset="0" stop-color="#fdf497"/><stop offset=".05" stop-color="#fdf497"/><stop offset=".45" stop-color="#fd5949"/><stop offset=".6" stop-color="#d6249f"/><stop offset=".9" stop-color="#285AEB"/></radialGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igG)"/><rect x="6.5" y="6.5" width="11" height="11" rx="5.5" fill="none" stroke="#fff" stroke-width="1.9"/><circle cx="17.3" cy="6.7" r="1.2" fill="#fff"/></svg>`,
  youtube: `<svg viewBox="0 0 24 24"><rect x="1.5" y="5" width="21" height="14.5" rx="4.5" fill="#FF0033"/><path d="M10 9v6.5l5.6-3.25z" fill="#fff"/></svg>`,
  google: `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`,
  friend: `<svg viewBox="0 0 24 24"><circle cx="8.5" cy="8" r="3.6" fill="#FFB020"/><path d="M1.8 20a6.7 6.7 0 0 1 13.4 0z" fill="#FFB020"/><circle cx="16.8" cy="9.2" r="3" fill="#58CC02"/><path d="M13.4 20a5.6 5.6 0 0 1 9-4.5V20z" fill="#58CC02"/></svg>`,
  other: `<svg viewBox="0 0 24 24"><path d="M4 4.5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8.5L6.5 21v-3.5H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z" fill="var(--accent)"/><circle cx="8" cy="11" r="1.3" fill="#fff"/><circle cx="12" cy="11" r="1.3" fill="#fff"/><circle cx="16" cy="11" r="1.3" fill="#fff"/></svg>`,
};
function viewSource() {
  const d = draft();
  let pick = SOURCES.includes(d.source) ? d.source : "";
  view().innerHTML = frame("source", { say: d.tutor, title: persona(d.tutor, "src", { brand: t("brand") }) || t("srcSay", { brand: t("brand") }), btn: t("next"),
    body: `<div class="src-grid" id="src" role="radiogroup" aria-labelledby="obTitle">${SOURCES.map(s => `<button type="button" class="src" role="radio" aria-checked="${pick === s}" data-s="${s}"><span class="src-i" aria-hidden="true">${SRC_ICONS[s]}</span><b>${esc(t("src_" + s))}</b></button>`).join("")}</div>` });
  bindStepBack("source");
  const next = $("#nextBtn"); next.disabled = !pick;
  $("#src").onclick = e => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    pick = b.dataset.s; sfx.flip(); next.disabled = false;
    $$("#src .src").forEach(x => x.setAttribute("aria-checked", x.dataset.s === pick));
  };
  // arrow keys move the pick, like any radio group
  $("#src").onkeydown = e => {
    const k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return;
    e.preventDefault();
    const i = (Math.max(0, SOURCES.indexOf(pick)) + k + SOURCES.length) % SOURCES.length;
    $(`#src [data-s="${SOURCES[i]}"]`).click(); $(`#src [data-s="${SOURCES[i]}"]`).focus();
  };
  next.onclick = async () => {
    if (!pick) return;
    const x = draft(); x.source = pick;
    // the student allowed notifications earlier (another subject, or on this site before): no need to ask, just subscribe
    if (pushState() === "granted" && !x.push) x.push = await subscribe(tutorName(x.tutor)).catch(() => null);
    x.step = showNotify(x) ? "notify" : "account"; saveDraft(x);
    nav("#/new/" + x.step);
  };
}

/* ---------- step 5: reminders (Marek, 2026-11-15, like Duolingo's) ---------- */
// Explains the browser's question before it comes: a picture of the prompt with an arrow at "Allow". Browsers only show the
// real prompt after a tap, and a "Block" is for good, so the student should know what it is for. One reminder a day at 18:00,
// only on a day they haven't studied yet, and none after the exam. Skipped where push can't work (iPhone Safari in a tab).
function viewNotify() {
  const d = draft(), site = location.hostname.replace(/^www\./, "") || "proanicku.cz";
  const mock = `<div class="nf" aria-hidden="true"><div class="nf-box"><span class="nf-x">${CLOSE}</span><b class="nf-site">${esc(t("notifyWants", { site }))}</b>
    <span class="nf-row">${I('<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>')}${esc(t("notifyShow"))}</span><div class="nf-btns"><span>${esc(t("notifyBlock"))}</span><span class="on">${esc(t("notifyAllow"))}</span></div></div>
    <svg class="nf-arrow" viewBox="0 0 40 56"><path d="M20 52V8M6 22 20 6l14 16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  view().innerHTML = frame("notify", { say: d.tutor, title: persona(d.tutor, "notify") || t("notifySay"), btn: t("notifyGo"), skip: t("notifySkip"),
    body: `${mock}<p class="ob-note">${esc(t("notifyNote", { time: remindTime() }))}</p>` });
  bindStepBack("notify");
  const done = () => { const x = draft(); x.notifyAsked = true; x.step = "account"; saveDraft(x); nav("#/new/account"); };
  $("#nextBtn").onclick = async () => {
    const btn = $("#nextBtn"); btn.disabled = true;
    const sub = await askPush(tutorName(d.tutor)).catch(() => null);
    if (sub) { const x = draft(); x.push = sub; saveDraft(x); toast(t("notifyOn", { time: remindTime() })); }
    done();
  };
  $("#skipBtn").onclick = done;
}

/* ---------- account, while the free lesson builds (not counted in the progress bar) ---------- */
// Three short screens instead of one long form (Marek, 2026-11-17: "too crowded"), each on its own address so Back works:
//   #/new/account          two buttons: sign up with Google, or create a new account
//   #/new/account/form     name, e-mail, password (the e-mail path only)
//   #/new/account/details  year of birth (a wheel, 15+ only), optional phone, the privacy tick, then signup
// Google skips the middle one. The price and the course summary are gone from here: they come after the free lesson, in
// the store. The Google token and the password live only in this page's memory, so a reload starts at the two buttons
// again, with the name, e-mail and year kept in the draft.
const acct = { gTok: null, gName: "", pass: "", err: "" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const keepAcc = more => { const x = draft(); if (x) { x.acc = { ...x.acc, ...more }; saveDraft(x); } };
// An error that belongs to another screen of the three (an expired Google token, an e-mail that already has an account)
// is shown there once.
function accErr() {
  const el = $("#err"), code = acct.err; acct.err = "";
  const show = c => { el.textContent = errText(c); el.hidden = false; sfx.wrong(); el.scrollIntoView({ block: "center" }); };
  if (code) show(code);
  return show;
}
function viewAccount(sub) {
  const d = draft();
  if (!d.slug) api("queue_free", { orderToken: d.orderToken }).then(r => { const x = draft(); if (x) { x.slug = r.slug; saveDraft(x); } }).catch(e => fail($("#err"), e));
  if (sub === "form") return accForm(d);
  if (sub === "details") {
    const a = d.acc || {};
    if (acct.gTok || (a.name?.trim() && EMAIL_RE.test(a.email || "") && acct.pass.length >= 8)) return accDetails(d);
  }
  if (sub) return nav("#/new/account");
  accChoice(d);
}
function accChoice(d) {
  acct.gTok = null;
  view().innerHTML = frame("account", { title: t("accTitle"), sub: t("accSub"), btn: t("accNew"), btnId: "newAcc", pre: G_BOX(true),
    after: `<p class="ob-note c">${t("accHave")} <a href="#/login">${t("accLogin")}</a></p>`,
    body: `<div class="ob-mid acc-art" aria-hidden="true">${tutorArt(d.tutor || "penny", "", "happy")}</div><p class="ob-err" id="err" hidden role="alert"></p>` });
  bindStepBack("account");
  accErr();
  $("#newAcc").onclick = () => nav("#/new/account/form");
  googleButton($("#gBox"), token => {
    const c = tokenClaims(token);
    acct.gTok = token; acct.pass = "";
    acct.gName = (c.given_name || c.name || "").trim(); // what the tutor will call the student
    nav("#/new/account/details");
  }, true);
}
function accForm(d) {
  const a = d.acc || {};
  acct.gTok = null;
  view().innerHTML = frame("account", { title: t("accNewTitle"), btn: t("next"),
    body: `<form id="f" class="ob-form" novalidate>
      <label class="ob-lbl" for="aName">${t("accName")}</label><input class="ob-in" id="aName" autocomplete="given-name" maxlength="80" placeholder="${t("accNamePh")}" value="${esc(a.name || "")}">
      <label class="ob-lbl" for="aEmail">${t("accEmail")}</label><input class="ob-in" id="aEmail" type="email" autocomplete="email" maxlength="200" placeholder="${t("accEmailPh")}" value="${esc(a.email || "")}">
      <label class="ob-lbl" for="aPass">${t("accPass")}</label><input class="ob-in" id="aPass" type="password" autocomplete="new-password" maxlength="200" placeholder="${t("accPassPh")}" value="${esc(acct.pass)}">
      <p class="ob-err" id="err" hidden role="alert"></p>
    </form>` });
  $("#nextBtn").setAttribute("form", "f"); $("#nextBtn").type = "submit";
  $("#stepBack").onclick = () => nav("#/new/account");
  const show = accErr();
  // Remembers the name and e-mail on this device, never the password, so a reload doesn't lose them.
  const keep = () => keepAcc({ name: $("#aName").value, email: $("#aEmail").value });
  $("#aName").oninput = $("#aEmail").oninput = keep;
  $("#f").onsubmit = e => {
    e.preventDefault(); $("#err").hidden = true;
    const name = $("#aName").value.trim(), email = $("#aEmail").value.trim(), pass = $("#aPass").value;
    if (!name) return show("bad_name");
    if (!EMAIL_RE.test(email)) return show("bad_email");
    if (pass.length < 8) return show("bad_password");
    keepAcc({ name, email }); acct.pass = pass;
    nav("#/new/account/details");
  };
  if (matchMedia("(hover:hover)").matches) $(!a.name ? "#aName" : !a.email ? "#aEmail" : "#aPass").focus(); // a phone would throw its keyboard over the screen before it is read
}
function accDetails(d) {
  const a = d.acc || {}, y = new Date().getFullYear(), g = !!acct.gTok, gMail = g ? tokenClaims(acct.gTok).email || "" : "";
  // After Google nothing about Google is shown (Marek, 2026-11-17): the tap already said who it is. The name comes from the
  // Google account; only an account with no name at all is asked for one. Back goes to the two buttons.
  const who = g && !acct.gName ? `<label class="ob-lbl" for="aName">${t("accName")}</label><input class="ob-in" id="aName" autocomplete="given-name" maxlength="80" placeholder="${t("accNamePh")}" value="${esc(a.name || "")}">` : "";
  view().innerHTML = frame("account", { title: t("accLastTitle"), btn: t("accGo"),
    body: `<form id="f" class="ob-form" novalidate>${who}
      <label class="ob-lbl" id="aYearLbl" for="aYear">${t("accYear")} <span>${t("accYearHint")}</span></label>
      <button type="button" class="ob-in ob-pick" id="aYear" aria-haspopup="dialog"><span id="aYearV"></span>${CHEV_DOWN}</button>
      <label class="ob-lbl" for="aPhone">${t("accPhone")} <span>${t("accOptional")}</span></label><input class="ob-in" id="aPhone" type="tel" autocomplete="tel" maxlength="20" placeholder="+420 777 123 456">
      <label class="ob-check"><input type="checkbox" id="aPrivacy"><span>${t("accPrivacy").replace("%", `<a href="#/privacy" target="_blank" rel="noopener">${t("accPrivacyLink")}</a>`)}</span></label>
      <label class="ob-check"><input type="checkbox" id="aMkt"><span>${t("accMarketing")}</span></label>
      <p class="ob-err" id="err" hidden role="alert"></p>
    </form>` });
  $("#nextBtn").setAttribute("form", "f"); $("#nextBtn").type = "submit";
  const backTo = g ? "#/new/account" : "#/new/account/form";
  $("#stepBack").onclick = () => nav(backTo);
  const show = accErr();
  // Year of birth: a tap on the field opens a pop-up with a wheel of years (Marek, 2026-11-17). The newest year on it is the
  // one that makes the student 15 this year, counted from today (pc-api checks the same way and still answers too_young).
  // Nothing is picked until the student picks; the wheel opens 20 years back, since most buyers are at university.
  const maxY = y - MIN_AGE, minY = y - 100, ok = n => n >= minY && n <= maxY;
  let year = ok(Math.round(+a.year)) ? Math.round(+a.year) : 0;
  const showYear = () => { $("#aYearV").textContent = year || t("accYearPick"); $("#aYear").classList.toggle("empty", !year); };
  showYear();
  $("#aYear").onclick = () => {
    const sh = sheet(`<h2 class="sh-h" id="ywH">${esc(t("accYear"))}</h2><div id="yw"></div><button class="btn-p" id="ywOk">${esc(t("done"))}</button>`, { mid: true, onClose: () => $("#aYear")?.focus() });
    const wheel = yearWheel($("#yw"), { min: minY, max: maxY, value: year || y - 20, rows: 5, labelledby: "ywH" });
    const take = () => { year = wheel.get(); keepAcc({ year: String(year) }); showYear(); $("#err").hidden = true; sh.close(); };
    $("#ywOk").onclick = take;
    wheel.el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); take(); } });
    wheel.el.focus({ preventScroll: true });
  };
  if (who) $("#aName").oninput = () => keepAcc({ name: $("#aName").value });
  // the answer from the "where did you hear about us" step (older drafts kept it on this form)
  const source = [d.source, a.source].find(x => SOURCES.includes(x)) || "";
  $("#f").onsubmit = async e => {
    e.preventDefault(); $("#err").hidden = true;
    const cur = draft()?.acc || {};
    const v = { name: (g ? acct.gName || $("#aName").value : cur.name || "").trim(), ...(g ? { google: acct.gTok } : { email: (cur.email || "").trim(), password: acct.pass }), birthYear: year, phone: $("#aPhone").value.trim(), privacy: $("#aPrivacy").checked, marketing: $("#aMkt").checked, source };
    if (!v.name) return show("bad_name");
    if (!year) return show("bad_year");
    if (y - v.birthYear < MIN_AGE) return show("too_young");
    if (v.phone && !/^\+?\d{9,15}$/.test(v.phone.replace(/[\s()-]/g, ""))) return show("bad_phone");
    if (!v.privacy) return show("no_privacy");
    const btn = $("#nextBtn"); btn.disabled = true; btn.textContent = t("storeBuying");
    try {
      const r = await api("signup", { orderToken: draft().orderToken, ...v, invite: store.get("invite") || undefined });
      store.del("invite");
      if (r.gift === "ok") toast(t("giftOk"));
      store.set("session", { token: r.session, slug: r.slug });
      store.set("email", g ? gMail : v.email); store.set("name", v.name);
      // the reminder subscription from the notifications step can only be saved once there is an account
      const push = draft()?.push;
      if (push) sendSub(r.session, push).catch(() => { });
      store.del("draft");
      acct.gTok = null; acct.pass = "";
      confetti(); sfx.done();
      nav("#/wait");
    } catch (er) {
      // the token lasts an hour: past that, back to the two buttons. A problem with the e-mail, name or password: back to that form.
      if (g && er.code === "bad_google") { acct.gTok = null; acct.err = er.code; return nav("#/new/account"); }
      if (!g && ["email_taken", "bad_email", "bad_password", "bad_name"].includes(er.code)) { acct.err = er.code; return nav("#/new/account/form"); }
      fail($("#err"), er); btn.disabled = false; btn.textContent = t("accGo");
    }
  };
}

/* ---------- unlock: the store, after the free lessons ---------- */
const UNITS_SHOWN = 3; // chapters listed before "show all", so the page fits one screen (Marek, 2026-11-12: "too long")
async function viewUnlock() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  // render() has already dropped the map's layout class, so the old map would show squeezed while this loads
  view().innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  const [cfg, st, info] = await Promise.all([storeConfig(), api("status", { session: s.token }).catch(e => e), storeInfo(s.slug)]);
  if (st.status === 401) { store.del("session"); return nav("#/login"); }
  if (st.paid) return nav("#/s/" + s.slug);
  document.body.classList.add("store");
  // The server's payment mode wins, so the page can never say "buy" while a click is free (or "test" while Stripe charges).
  // store.config.json's testMode is only the fallback for an older pc-api that doesn't report it.
  const testMode = st.payments ? st.payments === "test" : !!cfg.testMode;
  const L = o => o?.[lang()] || o?.en || o?.cs, left = info?.left;
  // Reasons on the left (above on a phone) and one buy panel: pick a plan, tick the consent, one button.
  // PRO is pre-picked: most buyers are days before one exam (research 2026-11-11). The only urgency is the student's own exam date.
  // Czech courses pay in Kč, every other language in $; a running subscription keeps its own currency.
  const pro = st.pro?.active ? st.pro : null, need = info?.pages || 0, cur = pro?.currency || st.currency || "czk";
  const proOpen = !!pro && pro.slidesLeft >= need;
  const upsell = !!pro && !proOpen && pro.plan === "pro"; // contextual: this subject is what doesn't fit, MAX is what fits it
  const plans = cfg.plans;
  let pick = upsell ? "max" : (plans.find(p => p.default) || plans[0])?.id;
  const planOf = id => plans.find(p => p.id === id);
  const amount = p => `${money(p, cur)} / ${t("stMonthShort")}`;
  const proName = pro ? pro.plan.toUpperCase() : "";
  // A little calendar page with the exam's day, then "Zkouška za 5 dní" and the full date
  const urg = info?.exam ? `<p class="st-urg"><i class="st-cal" aria-hidden="true">${+String(info.exam).slice(8, 10) || ""}</i><span><b>${esc(t("stTlExam"))}${left > 0 ? " " + esc(inDays(left)) : ""}</b><small>${esc(fmtDay(info.exam))}</small></span></p>` : "";
  const tap = info?.tapped ? `<p class="st-tap">${ic.lock}<span>${esc(t("stTapped").replace("%", info.tapped))}</span></p>` : `<p class="ob-sub">${t("unlockSub")}</p>`;
  // Every locked lesson by title, and a rough size from the slide pages (~3 practice items and ~0.25 exam questions per page,
  // measured on Anna's 458-page course). Shown as an estimate only.
  const est = n => Math.max(10, Math.round(n / 10) * 10);
  const what = info?.units.length ? `<h2 class="st-h">${t("stWhat")}</h2>${info.pages ? `<p class="st-est">${esc(t("unlockEst", { items: est(info.pages * 3), exam: est(info.pages * .25) }))}</p>` : ""}<ul class="st-units${info.units.length > UNITS_SHOWN + 1 ? " cut" : ""}" id="units">${info.units.map(u => `<li style="--chc:var(--ch${u.ci % 6 + 1})"><i>${ic.lock}</i><span class="st-u"><b>${esc(u.title)}</b>${u.titles?.length ? `<span class="st-ul">${esc(u.titles.join(" · "))}</span>` : ""}</span><small>${esc(lessonCount(u.n))}</small></li>`).join("")}</ul>${info.units.length > UNITS_SHOWN + 1 ? `<button class="st-all" id="unitsAll" type="button">${esc(t("stAll", { n: info.units.length }))}</button>` : ""}` : "";
  const opt = p => `<label class="st-opt pl-${esc(p.id)}" data-plan="${esc(p.id)}"><input type="radio" name="plan" value="${esc(p.id)}"${p.id === pick ? " checked" : ""}><i class="st-dot">${ic.check}</i>
      <span class="st-o-t">${L(p.badge) ? `<em>${esc(L(p.badge))}</em>` : ""}<b>${esc(L(p.name) || "")}</b><small>${esc(L(p.pitch) || "")}</small></span>
      <span class="st-o-p"><b>${esc(money(p, cur))}</b><small>${esc("/ " + t("stMonthShort"))}</small></span></label>`;
  const feats = () => { const p = planOf(pick); return p ? `<h2 class="st-h">${esc(t("stGet").replace("%", L(p.name) || ""))}</h2><ul class="st-feats">${L(p.features).map(x => `<li>${ic.check}<span>${esc(x)}</span></li>`).join("")}</ul>` : ""; };
  // Subscribed: this subject opens from the month's slides. PRO without room: MAX, priced, in one tap. MAX without room: the date.
  const slidesLine = pro ? `<p class="st-perday">${esc(t("stProLeft", { need, n: pro.slidesLeft, x: pro.slides }))}</p>` : "";
  const renew = pro?.until ? fmtDay(new Date(Date.parse(pro.until) - 86400e3).toISOString().slice(0, 10)) : "";
  const pay = proOpen ? `<div class="st-proon"><h3 class="st-pname">${proName}</h3><p>${esc(t("stProOn", { plan: proName }))}</p>${slidesLine}</div>
      <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p st-buy" data-pro>${esc(t("stProOpen", { plan: proName }))}</button>`
    : upsell ? `<div class="st-proon st-up"><h3 class="st-pname">${esc(t("stUpTitle"))}</h3><p>${esc(t("stUpSub", { need, n: pro.slidesLeft }))}</p>
        <p class="st-perday">${esc(t("stUpNote", { price: amount(planOf("max")) }))}</p></div>
      <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p st-buy" data-up>${esc(t("stUpBtn", { price: amount(planOf("max")) }))}</button>`
    : pro ? `<div class="st-proon"><h3 class="st-pname">${proName}</h3><p>${esc(t("stCapMax", { date: renew }))}</p>${slidesLine}</div>`
    : `<fieldset class="st-opts"><legend class="sr">${esc(t("stTitle"))}</legend>${plans.map(opt).join("")}</fieldset>
      <label class="ob-check st-consent"><input type="checkbox" id="terms"><span>${t("storeTerms").replace("%", `<a href="#/terms" target="_blank" rel="noopener">${t("storeTermsLink")}</a>`)}</span></label>
      <p class="ob-err" id="err" hidden role="alert"></p>
      <button class="btn-p st-buy" id="buy"></button>
      ${testMode ? `<p class="st-test" role="note">${t("storeTest")}</p>` : ""}
      <p class="ob-note c">${t("storeSecure")}</p>`;
  view().innerHTML = `<div class="ob st"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${CLOSE}</button></div>
    <div class="st-grid">
      <div class="st-top">
        <div class="st-hero"><i class="st-spark s1"></i><i class="st-spark s2"></i><i class="st-spark s3"></i>
          <div class="st-hx"><h1 class="ob-h">${t("stTitle")}</h1>${urg}</div><div class="st-art">${tutorArt(info?.tutor || "penny", "", "happy")}</div></div>
        ${tap}
      </div>
      <section class="st-pay" aria-label="${esc(t("storeBuy"))}">${pay}<a class="st-free" href="#/s/${esc(s.slug)}">${t("stFree")}</a></section>
      <div class="st-more"><div id="feats">${pro && !upsell ? "" : feats()}</div>${what}</div>
    </div></div>`;
  $("#stepBack").onclick = () => nav("#/s/" + s.slug);
  const all = $("#unitsAll"); if (all) all.onclick = () => { $("#units").classList.remove("cut"); all.remove(); };
  const proBtn = $("[data-pro]");
  if (proBtn) proBtn.onclick = async () => {
    $("#err").hidden = true; proBtn.disabled = true;
    try { await api("pro_unlock", { session: s.token }); resetCourse(); confetti(); sfx.done(); toast(t("unlockDone")); nav("#/s/" + s.slug); }
    catch (e) { fail($("#err"), e); proBtn.disabled = false; }
  };
  const upBtn = $("[data-up]");
  if (upBtn) upBtn.onclick = async () => {
    $("#err").hidden = true; upBtn.disabled = true;
    try {
      const r = await api("checkout", { session: s.token, plan: "max", terms: true });
      if (r.url) { location.href = r.url; return; } // the card needs the student (3-D Secure): Stripe's invoice page
      resetCourse(); confetti(); sfx.done(); toast(t("planMaxOn")); nav("#/s/" + s.slug);
    } catch (e) { fail($("#err"), e); upBtn.disabled = false; }
  };
  const buy = $("#buy");
  if (!buy) return;
  const label = () => `${t(testMode ? "storeBuyTest" : "storeBuy")} · ${amount(planOf(pick))}`;
  const sync = () => { buy.textContent = label(); $$(".st-opt").forEach(o => o.classList.toggle("on", o.dataset.plan === pick)); $("#feats").innerHTML = feats(); };
  $$(".st-opt input").forEach(r => r.onchange = () => { pick = r.value; $("#err").hidden = true; sync(); });
  $("#terms").onchange = () => { $("#err").hidden = true; $(".st-consent").classList.remove("miss"); };
  sync();
  buy.onclick = async () => {
    $("#err").hidden = true;
    if (!$("#terms").checked) { $(".st-consent").classList.add("miss"); return fail($("#err"), { code: "no_terms" }); }
    buy.disabled = true; buy.textContent = t("storeBuying");
    try {
      const r = await api("checkout", { session: s.token, plan: pick, terms: true });
      if (r.url) { location.href = r.url; return; } // Stripe Checkout; it comes back to #/paid
      resetCourse();
      confetti(); sfx.done(); toast(t("unlockDone"));
      nav("#/s/" + s.slug);
    } catch (e) { fail($("#err"), e); buy.disabled = false; buy.textContent = label(); }
  };
}

/* ---------- back from Stripe: wait for the webhook to mark the order paid ---------- */
let paidTimer = null;
function viewPaid() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  view().innerHTML = `<div class="ob ob-center">${ham("happy", "bob")}<h1 class="ob-h">${t("paidTitle")}</h1><p class="ob-sub" id="paidSub">${t("paidSub")}</p>
    <a class="btn-t" href="#/s/${esc(s.slug)}" id="paidSkip" hidden>${t("paidGo")}</a></div>`;
  const started = Date.now();
  const poll = async () => {
    clearTimeout(paidTimer);
    if (!location.hash.startsWith("#/paid")) return;
    try {
      const r = await api("status", { session: s.token });
      if (r.paid) { resetCourse(); confetti(); sfx.done(); toast(t("unlockDone")); return nav("#/s/" + s.slug); }
    } catch (e) { if (e.status === 401) { store.del("session"); return nav("#/login"); } }
    if (Date.now() - started > 45e3) { $("#paidSub").textContent = t("paidSlow"); $("#paidSkip").hidden = false; }
    paidTimer = setTimeout(poll, 2500);
  };
  poll();
}

/* ---------- terms and privacy ---------- */
function operatorHtml(op) {
  if (!op.name) return t("privOperatorTbd");
  return [esc(op.name), op.id ? `${t("opId")} ${esc(op.id)}` : "", op.address ? esc(op.address) : "", op.email ? `<a href="mailto:${esc(op.email)}">${esc(op.email)}</a>` : ""].filter(Boolean).join("<br>");
}
function legalFrame(html) {
  hideNav(); plain();
  view().innerHTML = `<div class="ob ob-legalpage"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${BACK}</button></div>${html}</div>`;
  $("#stepBack").onclick = () => history.length > 1 ? history.back() : nav("#/");
}
async function viewTerms() {
  const cfg = await storeConfig().catch(() => ({})), planOf = id => (cfg.plans || []).find(p => p.id === id);
  const both = p => p ? `${money(p, "czk")} (${money(p, "usd")})` : "";
  legalFrame(`<h1 class="ob-h">${t("termsTitle")}</h1><p class="ob-note">${t("termsVersion")}</p>
    <h2>${t("termsSeller")}</h2><p>${operatorHtml(cfg.operator || {})}</p>
    ${[1, 2, 3, 4, 5, 6, 7].map(n => `<h2>${t("termsH" + n)}</h2><p>${t("termsP" + n, { pro: both(planOf("pro")), max: both(planOf("max")) })}</p>`).join("")}`);
}
async function viewPrivacy() {
  const who = operatorHtml((await storeConfig().catch(() => ({}))).operator || {});
  legalFrame(`<h1 class="ob-h">${t("privTitle")}</h1><p class="ob-note">${t("privVersion")}</p>
    ${[1, 2, 3, 4, 5, 6].map(n => `<h2>${t("privH" + n)}</h2><p>${t("privP" + n)}</p>`).join("")}
    <h2>${t("privOperator")}</h2><p>${who}</p>`);
}

/* ---------- wait page ---------- */
// Shows the real build as it happens (see build.js): a builder starting, reading the files, planning, each lesson as it's written.
let waitTimer = null, waitTick = null;
const buildMinutesOf = pages => Math.max(3, Math.round(pages / 12) + 2); // same formula as scripts/gen/cost.mjs
function buildHtml(phase, build, free, offline, bar = 0, seenN = 0) { // bar: width shown so far; seenN: lessons already shown (only new ones fade in)
  if (!build || ["done", "failed"].includes(phase)) return "";
  const p = ["reading", "queued", "boot"].includes(phase) ? null : build.progress, pages = p?.pages || build.pages || 0;
  const stale = p && build.progressAge > 180;
  const mins = free ? "1–2" : buildMinutesOf(pages);
  const time = offline && phase === "queued" ? t("buildOffline") : stale ? t("buildStale")
    : p ? (p.etaSeconds > 0 ? `<span id="pcEta">${minutesLeft(p.etaSeconds)}</span>` : t("buildAlmost"))
    : (phase === "queued" ? t("buildQueued") : t("buildTotal")).replace("%", mins);
  const now = phase === "reading" ? `<span id="pcRead">${stageText(phase)}</span>` : stageText(phase);
  const lessons = p?.lessons || [], writing = ["lessons", "checking"].includes(phase);
  const files = build.files.length ? `<ul class="pc-build-files">${build.files.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}${build.files.length > 3 ? `<li>+${build.files.length - 3}</li>` : ""}</ul>` : "";
  return `<div class="pc-build"><span>${t("buildWhat")}<em id="pcClock" aria-hidden="true"></em></span>
    ${p?.title ? `<b>${esc(p.title)}</b>` : ""}
    <p>${[build.files.length ? fileCount(build.files.length) : "", pages ? pagesTxt(pages) : "", lessons.length ? lessonCount(lessons.length) : ""].filter(Boolean).join(" · ")}</p>
    ${lessons.length ? "" : files}
    <p class="pc-build-time">${time}</p>
    ${offline && phase === "queued" ? "" : `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i id="pcBar" style="width:${(bar * 100).toFixed(1)}%"></i></div>`}
    ${now ? `<p class="pc-build-stage">${now}</p>` : ""}
    ${lessons.length ? `<p class="pc-build-plan">${t("buildPlan")}</p><ul class="pc-build-lessons">${lessons.map((l, i) => `<li class="${l.done ? "done" : writing ? "now" : ""}${i >= seenN ? " new" : ""}" style="--d:${(i - seenN) * 70}ms" data-l="${i}"><i>${l.done ? ic.check : ""}</i>${esc(l.title)}</li>`).join("")}</ul>` : ""}
  </div>`;
}
// A poll updates the card in place instead of replacing it: the lesson list stays the same element, so a scroll the student
// is in the middle of (a fling on a phone, dragging the scrollbar) isn't cut off and the rows' spinners don't restart.
function patchCard(html) {
  const card = $("#pcCard"), old = $(".pc-build", card), tmp = document.createElement("div");
  tmp.innerHTML = html;
  const neu = tmp.firstElementChild, os = old ? [...old.children] : [], ns = neu ? [...neu.children] : [];
  const shape = els => els.map(e => e.tagName + "." + e.className).join();
  if (!old || !neu || shape(os) !== shape(ns)) { // the card's layout changed (a new phase): redraw it, keeping the list's scroll
    const top = $(".pc-build-lessons", card)?.scrollTop || 0;
    card.replaceChildren(...tmp.childNodes);
    const ul = $(".pc-build-lessons", card); if (ul) ul.scrollTop = top;
    return;
  }
  os.forEach((o, i) => {
    const n = ns[i];
    if (o.matches(".bar")) return; // tick() moves the bar; replacing it would restart its transition
    if (!o.matches(".pc-build-lessons")) { if (o.outerHTML !== n.outerHTML) o.replaceWith(n); return; }
    const nls = [...n.children]; // a copy: appending a row moves it out of n
    nls.forEach((nl, j) => {
      const ol = o.children[j];
      if (!ol) return o.append(nl); // a newly planned lesson fades in
      for (const c of ["done", "now"]) ol.classList.toggle(c, nl.classList.contains(c));
      if (ol.innerHTML !== nl.innerHTML) ol.innerHTML = nl.innerHTML;
    });
    while (o.children.length > nls.length) o.lastElementChild.remove();
  });
}
const tipsHtml = () => `<div class="pc-tips"><span>${t("waitTipH")}</span><p id="pcTip">${t("waitTip1")}</p></div>`;
async function viewWait() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  let painted = null, last = null, gotAt = 0, phaseKey = "", phaseAt = 0, shown = 0, doneSeen = null, tip = 1, tipAt = Date.now(), stepsFor = null;
  const target = () => last ? barTarget(last.phase, last.r.build?.progress, phaseAt) : 0;
  const tick = () => {
    const bar = $("#pcBar");
    if (bar) { shown = Math.max(shown, target()); bar.style.width = (shown * 100).toFixed(1) + "%"; bar.parentNode.setAttribute("aria-valuenow", Math.round(shown * 100)); }
    const since = (Date.now() - gotAt) / 1000, b = last?.r.build;
    const c = $("#pcClock"); if (c && b?.queuedAge != null) c.textContent = clock(b.queuedAge + since);
    const eta = $("#pcEta"), p = b?.progress; if (eta && p?.etaSeconds > 0) eta.textContent = minutesLeft(Math.max(0, p.etaSeconds - (b.progressAge || 0) - since));
    const rd = $("#pcRead"); if (rd && b?.files?.length) rd.textContent = t("buildReadingFile", { name: b.files[Math.floor(since / 2.5) % b.files.length] });
    const tipEl = $("#pcTip");
    if (tipEl && Date.now() - tipAt > 7000) { // a new tip every 7 s
      tipAt = Date.now(); tip = tip % 3 + 1;
      tipEl.classList.remove("in"); void tipEl.offsetWidth; tipEl.textContent = t("waitTip" + tip); tipEl.classList.add("in");
    }
  };
  const paint = r => {
    const { status, student, build } = r, free = !r.paid, ready = !!r.course, failed = !ready && status === "failed";
    const offline = r.workerOnline === false && QUEUED.includes(status); // nothing started a builder and none checked in lately
    const shownStatus = ready ? (free ? "free_ready" : "ready") : status, phase = phaseOf(shownStatus, r);
    const p = build?.progress, pk = phase + ":" + (p?.done ?? "");
    if (pk !== phaseKey) { phaseKey = pk; phaseAt = phaseStart(phase, build); }
    last = { phase, r }; gotAt = Date.now();
    // small wins: each lesson that turned done since the last poll pops and ticks
    const doneNow = (phase === "lessons" || phase === "checking" || phase === "publishing" ? p?.lessons || [] : []).map(l => !!l.done);
    const fresh = doneSeen ? doneNow.map((d, i) => d && !doneSeen[i]) : [];
    doneSeen = doneNow;
    const waiting = phase === "queued"; // the heading says "in the queue" only until a builder has it
    const tutor = student ? student.tutor || "penny" : null, key = [status, waiting, tutor, ready, free, lang(), offline].join();
    // The steps are redrawn only when the phase or lesson count changes, so their animations play once and aren't restarted by every poll.
    const seenN = $$(".pc-build-lessons li").length;
    const sk = phase + ":" + (p?.lessons || []).filter(l => l.done).length + "/" + (p?.lessons || []).length;
    const steps = () => { const prev = stepsFor?.split(":")[0]; stepsFor = sk; return stepsHtml(phase, p, prev); };
    if (painted === key && $("#pcLive")) { // keeps the mascot animation running
      if (sk !== stepsFor) $("#pcSteps").innerHTML = steps();
      patchCard(buildHtml(phase, build, free, offline, shown, seenN));
    } else {
      painted = key;
      const title = ready ? (free ? "waitFreeReady" : "waitReady") : failed ? "waitFailed" : free ? (waiting ? "waitFreeQueued" : "waitFreeTitle") : waiting ? "waitQueued" : "waitTitle";
      const sub = ready ? (free ? "waitFreeReadySub" : "waitReadySub") : failed ? "waitFailedSub" : offline ? "waitOfflineSub" : free ? "waitFreeSub" : "waitSub";
      view().innerHTML = `<div class="ob ob-wait"><div class="ob-top">${langBtn()}</div>
        <div class="pc-hero ${ready ? "" : "working"}">${tutor ? tutorArt(tutor, "bob") : ""}</div>
        <h1 class="ob-h">${t(title)}</h1><p class="ob-sub">${t(sub)}</p>
        ${failed ? "" : `<div id="pcLive"><div id="pcSteps">${steps()}</div><div id="pcCard">${buildHtml(phase, build, free, offline, shown, seenN)}</div></div>`}
        ${ready || failed ? "" : tipsHtml()}
        ${failed ? `<div class="ob-foot pc-failed"><button class="btn-p" id="wfWrite">${t("fbH")}</button><button class="btn-s" id="wfNew">${t("waitFailedNew")}</button><button class="btn-t" id="wfOut">${t("waitFailedOut")}</button></div>` : ready ? "" : `<p class="ob-legal"><a href="#/wait" id="wfWrite">${t("fbH")}</a></p>`}
        ${ready ? `<div class="ob-foot"><a class="btn-p" href="#/s/${esc(s.slug)}" id="startCourse">${t(free ? "waitFreeStart" : "waitStart")}</a></div>` : ""}</div>`;
      bindLang();
      // a failed build must not be a dead end: write to us, start over with other files, or sign out
      const w = $("#wfWrite"), n = $("#wfNew"), o = $("#wfOut");
      if (w) w.onclick = e => { e.preventDefault(); writeUs(s.token, failed ? "failed" : "wait"); };
      if (n) n.onclick = async () => { n.disabled = true; try { nav(await startNewSubject()); } catch (e) { n.disabled = false; toast(errText(e.code)); } };
      if (o) o.onclick = () => { store.del("session"); store.del("readySeen"); nav("#/"); };
    }
    fresh.forEach((f, i) => f && $(`.pc-build-lessons [data-l="${i}"]`)?.classList.add("pc-pop")); // not "pop": that's the map popover in base.css
    if (fresh.some(Boolean)) sfx.flip();
    tick();
  };
  const poll = async () => {
    clearTimeout(waitTimer);
    if (!location.hash.startsWith("#/wait")) return;
    try {
      const r = await api("status", { session: s.token });
      if (r.course && store.get("readySeen") === s.slug) return nav("#/s/" + s.slug);
      paint(r);
      if (r.course) { store.set("readySeen", s.slug); confetti(); sfx.done(); clearInterval(waitTick); return; }
    } catch (e) {
      if (e.status === 401) { store.del("session"); return nav("#/login"); }
    }
    waitTimer = setTimeout(poll, last && !["queued", "failed"].includes(last.phase) ? 2500 : 5000); // quicker while something moves
  };
  clearInterval(waitTick);
  waitTick = setInterval(() => (location.hash.startsWith("#/wait") ? tick() : clearInterval(waitTick)), 250);
  if (store.get("readySeen") !== s.slug) paint({ status: "free_queued", paid: false });
  else view().innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`; // only passing through to the course: never leave the old page up
  poll();
}

/* ---------- another subject for a signed-in account: the same setup, without the account step ---------- */
// Starts (or resumes) the setup and returns where it continues. The subject switcher calls it while its sheet is still
// open, so the map never blanks to a spinner in between.
export async function startNewSubject() {
  const s = session(); if (!s) return "#/login";
  const d = draft();
  if (d?.acct) return "#/new/" + (d.step || "files"); // one in progress already
  const { orderToken } = await api("new_subject", { session: s.token, lang: courseLang() });
  saveDraft({ orderToken, step: "files", files: [], days: 7, acct: true });
  return "#/new/files";
}
async function newSubject() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  view().innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  try { nav(await startNewSubject()); } catch (e) {
    if (e.status === 401) { store.del("session"); return nav("#/login"); }
    toast(errText(e.code)); nav("#/s/" + s.slug);
  }
}

/* ---------- router ---------- */
export function render() {
  clearTimeout(waitTimer); clearInterval(waitTick); clearTimeout(paidTimer);
  document.querySelectorAll(".feedback,.confetti,#sh,#shDim,.hc").forEach(e => e.remove());
  document.body.classList.remove("plain", "map-page", "framed", "store", "landing");
  window.onkeydown = null; window.onscroll = null;
  try { Promise.resolve(route()).catch(viewError); } catch (e) { viewError(e); }
}
// A view that couldn't load (no network, store.config or the API failing) shows why and a retry button, never a blank page.
function viewError(e) {
  console.error(e);
  view().innerHTML = `<div class="ob ob-center">${ham("sad")}<h1 class="ob-h">${esc(errText(e?.code || (e instanceof TypeError ? "offline" : "server")))}</h1><div class="ob-foot"><button class="btn-p" id="again">${t("retry")}</button></div></div>`;
  $("#again").onclick = render;
}
// A tester link (#/t/<code>): the code waits on this device until the account is made, where it gives the plan for free.
// Someone already signed in gets the plan at once. A wrong or used-up code changes nothing: the free start works as for anyone.
async function testerLink(code) {
  code = String(code || "").slice(0, 20);
  if (code) store.set("invite", code);
  await useInvite();
  nav("#/");
}
// Puts a waiting tester code on the signed-in account (after the link, or after signing in). Kept if the call fails, to try again.
async function useInvite() {
  const code = store.get("invite"), s = store.get("session");
  if (!code || !s?.token) return;
  try { const r = await api("redeem", { session: s.token, invite: code }); store.del("invite"); if (r.gift === "ok") toast(t("giftOk")); } catch { /* the app works without it */ }
}
function route() {
  const h = location.hash.replace(/^#/, "").split("?")[0] || "/"; // ?r= only forces a fresh render of the same lesson
  const parts = h.split("/").filter(Boolean);
  window.scrollTo({ top: 0, behavior: "instant" });
  if (!parts.length) return viewWelcome();
  if (parts[0] === "start") return nav("#/"); // the old invite page
  if (parts[0] === "t") return testerLink(parts[1]);
  if (parts[0] === "login") return viewLogin();
  if (parts[0] === "wait") return viewWait();
  if (parts[0] === "unlock") return viewUnlock();
  if (parts[0] === "privacy") return viewPrivacy();
  if (parts[0] === "terms") return viewTerms();
  if (parts[0] === "paid") return viewPaid();
  if (parts[0] === "new-subject") return newSubject();
  if (parts[0] === "new") {
    hideNav(); plain();
    const d = draft();
    if (!d) return nav("#/");
    // once the free lessons are queued, files, date and tutor can't change; the last three steps can still be revisited
    let step = parts[1] || d.step;
    if (d.slug && !AFTER.includes(step)) step = AFTER.includes(d.step) ? d.step : "account";
    if (step === "notify" && !showNotify(d)) { step = "account"; if (d.step === "notify") { d.step = "account"; saveDraft(d); } }
    if (step !== (parts[1] || d.step)) return nav("#/new/" + step);
    if (STEPS.indexOf(step) > STEPS.indexOf(d.step || "files")) return nav("#/new/" + (d.step || "files"));
    const stepView = { files: viewFiles, date: viewDate, tutor: viewTutor, source: viewSource, notify: viewNotify, account: () => viewAccount(parts[2]) }[step];
    return stepView ? stepView() : nav("#/");
  }
  if (parts[0] === "s") return courseRoute(parts.slice(1), nav, render);
  nav("#/");
}
// index.html loads this file as app.js?v=…, and course.js imports it as app.js: the browser runs two copies of the module.
// Only the first one may run the page, or every view is drawn twice and the wait page polls twice.
const first = !window.pcBooted; window.pcBooted = true;
if (first) addEventListener("hashchange", render);
// Safari (and Chrome) restore a page from the back-forward cache as it was left: after Back from Stripe the buy
// button would still say "One moment…" and be disabled. Draw the view afresh instead.
if (first) addEventListener("pageshow", e => { if (e.persisted) render(); });
if (first) { applyTheme(); setLang(lang()).then(render); }
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { });
