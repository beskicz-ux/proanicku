// Router, welcome, onboarding (slides → date → tutor, then the account), wait page, login, unlock (store), terms and privacy.
import { $, $$, view, esc, store, api, today, addDays, ic, toast, confetti, sfx } from "./util.js";
import { t, lang, setLang, courseLang, errText, pages as pagesTxt, fileCount, lessonCount, minutesLeft, inDays, inWeeks, fmtDay, fmtShortMonth } from "./i18n.js";
import { ham } from "./art.js";
import { isImage, imagesToPdfs } from "./images.js";
import { countPages, validFile, daysBetween, ACCEPT } from "./forecast.js";
import { phaseOf, QUEUED, stepsHtml, barTarget, phaseStart, clock, stageText } from "./build.js";
import { courseRoute, tutorArt, TUTORS, tutorWith, resetCourse, storeInfo, snapGoal, money } from "./course.js";
import { BACK, CLOSE, PACE_ICONS, langSheet, applyTheme } from "./ui.js";

const draft = () => { const d = store.get("draft", null); if (d && !STEPS.includes(d.step)) d.step = d.slug ? "account" : "files"; return d; };
const saveDraft = d => store.set("draft", d);
const session = () => store.get("session", null);
// "How did you hear about Penny": on the account step, so it adds no screen. Same list in pc-api's accountFields.
const SOURCES = ["tiktok", "instagram", "youtube", "google", "friend", "other"];
const STEPS = ["files", "date", "tutor", "account"], COUNTED = 3; // the account step isn't counted in the progress bar
const MIN_AGE = 15; // same as pc-api
const nav = h => { if (location.hash === h) render(); else location.hash = h; };
const fail = (el, e) => { el.textContent = errText(e.code || e.message); el.hidden = false; sfx.wrong(); };
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

/* ---------- the onboarding frame: back, 3 segments, title, body, one button ---------- */
function frame(step, { title, body, btn, btnId = "nextBtn", sub = "" }) {
  const i = STEPS.indexOf(step), segs = i < COUNTED ? `<div class="ob-segs">${Array.from({ length: COUNTED }, (_, k) => `<i class="${k <= i ? "on" : ""}"></i>`).join("")}</div>` : `<div class="ob-segs"></div>`;
  return `<div class="ob"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${i ? BACK : CLOSE}</button>${segs}<span class="ob-bkpad"></span></div>
    <h1 class="ob-h">${title}</h1>${sub ? `<p class="ob-sub">${sub}</p>` : ""}
    <div class="ob-body">${body}</div>
    <div class="ob-foot"><button class="btn-p" id="${btnId}">${btn}</button></div></div>`;
}
// X on the first step: a signed-in student (another subject) goes straight back to their course, not via #/ and #/wait,
// which flashed the setup, then a blank wait page, then the map.
const homeOf = () => { const s = session(); return s ? (store.get("readySeen") === s.slug ? "#/s/" + s.slug : "#/wait") : "#/"; };
function bindStepBack(step) { const i = STEPS.indexOf(step); $("#stepBack").onclick = () => nav(i ? "#/new/" + STEPS[i - 1] : homeOf()); }

/* ---------- landing: one big drop box ---------- */
let handoff = null; // files dropped or picked on the landing page, uploaded by the files step as soon as it opens
const PLUS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;
const SPIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M12 4a8 8 0 1 0 8 8"/></svg>`;
function viewWelcome() {
  hideNav(); plain(); document.body.classList.add("landing");
  const s = session(), d = draft();
  if (s) return nav(homeOf());
  const locked = !!d?.slug; // the free lessons are already building: the files can't change, so offer to finish the account
  view().innerHTML = `<div class="ld" id="ld">
    <header class="ld-top"><span class="ld-logo">${ham("happy", "ld-mini")}<b>${t("brand")}</b></span><span class="ld-gap"></span>${langBtn()}<a class="ld-in" href="#/login">${t("landLogin")}</a></header>
    <section class="ld-main">
      <h1 class="ld-h">${t("landTitle1")} <em>${t("landTitle2")}</em></h1>
      <p class="ld-sub">${t("landSub")}</p>
      ${locked ? `<div class="ld-resume">${ham("happy", "bob")}<a class="btn-p" href="#/new/account">${t("welcomeResume")}</a></div>` : `
      <div class="ld-box">
        <div class="ld-peek" aria-hidden="true">${ham("happy")}</div>
        <button class="ld-drop" id="drop" type="button" aria-describedby="dropHint"><span class="ld-plus" id="plus">${PLUS}</span><b id="dropTxt">${t("landDrop")}</b><span class="ld-drag">${t("landDrag")}</span><span class="ld-types" id="dropHint">${t("landTypes")}</span></button>
        <input type="file" id="pick" accept="${ACCEPT}" multiple hidden>
      </div>
      <p class="ob-err c" id="err" hidden role="alert"></p>
      ${d ? `<a class="btn-t" href="#/new/${d.step || "files"}">${t("welcomeResume")}</a>` : ""}`}
      <ol class="ld-steps"><li><i>1</i>${t("landS1")}</li><li><i>2</i>${t("landS2")}</li><li><i>3</i>${t("landS3")}</li></ol>
    </section>
    <footer class="ld-foot">${legalLinks()}</footer></div>`;
  bindLang();
  if (locked) return;
  const drop = $("#drop"), pick = $("#pick"), ld = $("#ld");
  let busy = false;
  const start = async list => {
    const files = [...list]; if (!files.length || busy) return;
    busy = true; drop.classList.add("busy"); drop.setAttribute("aria-busy", "true"); $("#plus").innerHTML = SPIN; $("#dropTxt").textContent = t("landBusy"); $("#err").hidden = true;
    try {
      if (!draft()) {
        const { orderToken } = await api("start", { lang: courseLang() });
        saveDraft({ orderToken, step: "files", files: [], days: 7 });
      }
      handoff = files;
      nav("#/new/files");
    } catch (e) {
      busy = false; drop.classList.remove("busy"); drop.removeAttribute("aria-busy"); $("#plus").innerHTML = PLUS; $("#dropTxt").textContent = t("landDrop");
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
function viewLogin() {
  loginFrame(t("signinTitle"), `<form id="f" class="ob-form"><input class="ob-in" id="email" type="email" autocomplete="email" placeholder="${t("accEmail")}" aria-label="${t("accEmail")}" maxlength="200">
    <input class="ob-in" id="pass" type="password" autocomplete="current-password" placeholder="${t("accPass")}" aria-label="${t("accPass")}" maxlength="200">
    <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p" id="go">${t("loginGo")}</button></form>`);
  $("#email").focus();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#pass").value;
    if (!email || !password) return;
    $("#go").disabled = true; $("#err").hidden = true;
    try { signedIn(await api("login", { email, password }), email); } catch (er) { fail($("#err"), er); $("#go").disabled = false; }
  };
}

/* ---------- step 1: slides ---------- */
// One course holds at most 250 slide pages (Marek, 2026-11-12): a 458-slide semester cost ~300 Kč to build, close to PRO's price.
// Same number in pc-api (upload_url) and the worker (keeps the first 250 pages).
export const MAX_PAGES = 250;
const uploading = new Map();
const tooMany = () => Object.assign(new Error("too_many_pages"), { code: "too_many_pages" });
const fileKind = name => /\.pptx?$/i.test(name) ? "pptx" : "pdf";
function fileRows(d) {
  const rows = d.files.map(f => `<div class="ob-file"><span class="ob-fk ${fileKind(f.name)}">${fileKind(f.name).toUpperCase()}</span><div class="t"><b>${esc(f.name)}</b><span>${pagesTxt(f.pages)}${f.estimated ? ` (${t("filesEst")})` : ""}</span></div><button class="ob-x" data-rm="${esc(f.path)}" aria-label="${t("filesRemove")}">${ic.x}</button></div>`).join("");
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
    const n = cur.files.reduce((a, f) => a + f.pages, 0), over = n > MAX_PAGES;
    $("#total").hidden = !cur.files.length;
    $("#total").classList.toggle("over", over);
    $("#total").innerHTML = `${ic.book}<span>${t(over ? "filesOver" : "filesSummary", { pages: `<b>${pagesTxt(n)}</b>`, max: MAX_PAGES })}</span>`;
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
      const have = draft().files.reduce((a, f) => a + f.pages, 0) + [...uploading.values()].reduce((a, u) => a + (u.pages || 0), 0);
      if (have + pages > MAX_PAGES) throw tooMany();
      uploading.set(key, { name: file.name, pct: 0, pages }); refresh();
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
    cur.pages = cur.files.reduce((a, f) => a + f.pages, 0);
    if (cur.pages > MAX_PAGES) return fail($("#err"), tooMany());
    cur.step = "date"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, pages: cur.pages }).catch(() => { });
    nav("#/new/date");
  };
  refresh();
  if (handoff) { const f = handoff; handoff = null; addAll(f); } // dropped on the landing page: upload them here, no second pick
}

/* ---------- step 2: exam date, a timeline under a fixed needle ---------- */
export const RULER = { MIN: 3, MAX: 150, STEP: 12 };
const paceOf = n => n < 14 ? "sprint" : n < 35 ? "tempo" : "chill";
// Minutes a day: one pass plus three repeats of every page (3 min a page), spread over the days before the last two.
// The plan's daily minutes, snapped to the goals the settings offer (10/15/20/30/60).
export const minutesFor = (pages, n) => snapGoal(Math.max(10, Math.min(90, Math.round((pages || 20) * 3 / Math.max(1, n - 2) / 5) * 5)));
export function rulerHtml() {
  let html = "";
  for (let n = RULER.MIN; n <= RULER.MAX; n++) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n);
    const mo = d.getDate() === 1, wk = d.getDay() === 1;
    html += `<div class="rd ${mo ? "mo" : wk ? "wk" : ""}">${mo ? `<small>${esc(fmtShortMonth(d))}</small>` : wk ? `<small>${d.getDate()}.</small>` : ""}</div>`;
  }
  return `<div class="ruler" dir="ltr"><div class="rscroll" id="rs" tabindex="0" role="slider" aria-valuemin="${RULER.MIN}" aria-valuemax="${RULER.MAX}">${html}</div><div class="needle" aria-hidden="true"></div></div>`;
}
// Binds a ruler; onChange(n, iso) on every snap. Arrow keys move a day.
export function bindRuler(startDays, onChange) {
  const rs = $("#rs");
  const at = () => Math.min(RULER.MAX, Math.max(RULER.MIN, RULER.MIN + Math.round(rs.scrollLeft / RULER.STEP)));
  let last = -1;
  const upd = () => { const n = at(); if (n === last) return; last = n; rs.setAttribute("aria-valuenow", n); onChange(n, addDays(today(), n)); };
  rs.addEventListener("scroll", upd, { passive: true });
  const go = n => { rs.scrollLeft = (Math.min(RULER.MAX, Math.max(RULER.MIN, n)) - RULER.MIN) * RULER.STEP; };
  rs.onkeydown = e => { const k = { ArrowRight: 1, ArrowLeft: -1, PageUp: 7, PageDown: -7 }[e.key]; if (k) { e.preventDefault(); go(at() + k); } };
  // Desktop: a mouse wheel scrolls up/down, so turn that into days (sideways trackpad swipes stay native).
  let acc = 0;
  rs.addEventListener("wheel", e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    acc += e.deltaMode ? e.deltaY * 33 : e.deltaY;
    const k = Math.trunc(acc / 33);
    if (k) { acc -= k * 33; go(at() + k); }
  }, { passive: false });
  // Desktop: drag with the mouse, or click a day to jump to it.
  let drag = null;
  rs.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    drag = { x: e.clientX, left: rs.scrollLeft, moved: false };
    rs.setPointerCapture(e.pointerId); rs.classList.add("drag");
  });
  rs.addEventListener("pointermove", e => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) > 4) drag.moved = true;
    if (drag.moved) rs.scrollLeft = drag.left - (e.clientX - drag.x);
  });
  const end = e => {
    if (!drag) return;
    const d = drag; drag = null; rs.classList.remove("drag");
    if (d.moved) { go(at()); return; }
    if (e.type !== "pointerup") return;
    const r = rs.getBoundingClientRect(); // the needle sits in the middle
    go(at() + Math.round((e.clientX - (r.left + r.width / 2)) / RULER.STEP));
  };
  rs.addEventListener("pointerup", end); rs.addEventListener("pointercancel", end);
  requestAnimationFrame(() => { rs.scrollLeft = (Math.min(RULER.MAX, Math.max(RULER.MIN, startDays)) - RULER.MIN) * RULER.STEP; upd(); });
  return { get: () => addDays(today(), at()) };
}
export function datePanel(n, iso, pages) {
  const kind = paceOf(n), when = n < 14 ? inDays(n) : inWeeks(Math.round(n / 7));
  return { date: fmtDay(iso), rel: t("dateRel", { when, min: minutesFor(pages, n) }), badge: `<span class="badge ${kind}">${PACE_ICONS[kind]}${t({ sprint: "paceSprint", tempo: "paceTempo", chill: "paceChill" }[kind])}</span>` };
}
function viewDate() {
  const d = draft();
  const start = d.examDate ? daysBetween(today(), d.examDate) : 42;
  view().innerHTML = frame("date", { title: t("dateTitle"), btn: t("next"),
    body: `<div class="ob-mid"><div class="dbig"><b id="dDate"></b><span id="dRel"></span></div><div class="dbadge" id="dBadge"></div>${rulerHtml()}</div>` });
  bindStepBack("date");
  let pick = null;
  const r = bindRuler(start, (n, iso) => {
    pick = iso;
    const p = datePanel(n, iso, d.pages);
    $("#dDate").textContent = p.date; $("#dRel").textContent = p.rel; $("#dBadge").innerHTML = p.badge;
  });
  $("#nextBtn").onclick = () => {
    const iso = pick || r.get(), n = daysBetween(today(), iso), cur = draft();
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
    <div class="tinfo"><b id="tName"></b></div><div class="dots" id="dots" aria-hidden="true">${pickable().map(() => "<i></i>").join("")}</div>`;
}
export function bindCarousel(startId, onChange) {
  const c = $("#car"), n = pickable().length, slots = [...c.children];
  let cur = -1, abs = n, settle = null;
  // how far to scroll so slot s sits exactly in the middle of the carousel
  const centre = s => { const sr = s.getBoundingClientRect(), cr = c.getBoundingClientRect(); return c.scrollLeft + sr.left + sr.width / 2 - cr.left - cr.width / 2; };
  const paint = () => {
    const cr = c.getBoundingClientRect(), mid = cr.left + cr.width / 2;
    let best = 0, bd = 1e9;
    slots.forEach((s, i) => {
      const r = s.getBoundingClientRect(), dist = Math.abs(r.left + r.width / 2 - mid) / r.width, k = Math.min(dist, 1.4);
      s.firstChild.style.transform = `scale(${1 - k * 0.42}) translateY(${k * 10}px)`;
      s.firstChild.style.opacity = 1 - k * 0.45;
      s.firstChild.style.filter = k > .5 ? "saturate(.6)" : "";
      if (dist < bd) { bd = dist; best = i; }
    });
    abs = best;
    const i = best % n;
    if (i !== cur) { cur = i; $("#tName").textContent = pickable()[i].name; [...$("#dots").children].forEach((d, j) => d.classList.toggle("on", j === i)); onChange(pickable()[i]); }
  };
  // Once the swipe has fully stopped on a copy, jump to the same tutor in the middle copy. The jump must look like nothing:
  // no size transition on the figures (they would visibly shrink and regrow) and never mid-swipe or mid-snap (that
  // cut the motion short). `jump` turns the transitions off for that one frame.
  const recentre = () => {
    if (abs >= n && abs < 2 * n) return;
    c.classList.add("jump"); c.scrollLeft = centre(slots[abs % n + n]); paint();
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove("jump")));
  };
  const go = (k, smooth = true) => c.scrollTo({ left: centre(slots[Math.max(0, Math.min(slots.length - 1, k))]), behavior: smooth ? "smooth" : "auto" });
  // scrollend fires after momentum and snapping are done; where it doesn't exist (older Safari), wait for a quiet 300 ms
  const hasEnd = "onscrollend" in window;
  c.addEventListener("scroll", () => { paint(); if (!hasEnd) { clearTimeout(settle); settle = setTimeout(recentre, 300); } }, { passive: true });
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
      const y = draft(); y.slug = r.slug; y.step = "account"; saveDraft(y);
      nav("#/new/account");
    } catch (e) { toast(errText(e.code)); btn.disabled = false; }
  };
}

/* ---------- account, while the free lessons build (not counted in the progress bar) ---------- */
function viewAccount() {
  const d = draft(), y = new Date().getFullYear(), a = d.acc || {};
  const card = `<div class="ob-course"><span class="sq">${esc((d.files[0]?.name || "P")[0].toUpperCase())}</span><div><b>${t("accCourse")}</b><span>${t("accCourseSub", { pages: pagesTxt(d.pages || 0), date: d.examDate ? esc(fmtDay(d.examDate)) : "", tutor: esc(tutorWith(d.tutor)) })}</span></div></div>`;
  view().innerHTML = frame("account", { title: t("accTitle"), sub: t("accSub"), btn: t("accGo"),
    body: `${card}<form id="f" class="ob-form" novalidate>
      <label class="ob-lbl" for="aName">${t("accName")}</label><input class="ob-in" id="aName" autocomplete="given-name" maxlength="80" placeholder="${t("accNamePh")}" value="${esc(a.name || "")}">
      <label class="ob-lbl" for="aEmail">${t("accEmail")}</label><input class="ob-in" id="aEmail" type="email" autocomplete="email" maxlength="200" placeholder="${t("accEmailPh")}" value="${esc(a.email || "")}">
      <div class="ob-two"><div><label class="ob-lbl" for="aPass">${t("accPass")}</label><input class="ob-in" id="aPass" type="password" autocomplete="new-password" maxlength="200" placeholder="${t("accPassPh")}"></div>
      <div><label class="ob-lbl" for="aYear">${t("accYear")}</label><input class="ob-in" id="aYear" type="number" inputmode="numeric" min="${y - 100}" max="${y}" placeholder="2004" value="${esc(a.year || "")}"></div></div>
      <label class="ob-lbl" for="aPhone">${t("accPhone")} <span>${t("accOptional")}</span></label><input class="ob-in" id="aPhone" type="tel" autocomplete="tel" maxlength="20" placeholder="+420 777 123 456">
      <p class="ob-lbl" id="aSrcL">${t("accSrc")} <span>${t("accOptional")}</span></p><div class="ob-src" id="aSrc" role="radiogroup" aria-labelledby="aSrcL">${SOURCES.map(s => `<button type="button" role="radio" aria-checked="${a.source === s}" data-s="${s}">${t("src_" + s)}</button>`).join("")}</div>
      <label class="ob-check"><input type="checkbox" id="aPrivacy"><span>${t("accPrivacy").replace("%", `<a href="#/privacy" target="_blank" rel="noopener">${t("accPrivacyLink")}</a>`)}</span></label>
      <label class="ob-check"><input type="checkbox" id="aMkt"><span>${t("accMarketing")}</span></label>
      <p class="ob-err" id="err" hidden role="alert"></p>
    </form><p class="ob-note">${t("accHave")} <a href="#/login">${t("accLogin")}</a></p>` });
  $("#nextBtn").setAttribute("form", "f"); $("#nextBtn").type = "submit";
  $("#stepBack").onclick = () => nav("#/");
  const err = $("#err"), show = code => { err.textContent = errText(code); err.hidden = false; sfx.wrong(); err.scrollIntoView({ block: "center" }); };
  if (!d.slug) api("queue_free", { orderToken: d.orderToken }).then(r => { const x = draft(); if (x) { x.slug = r.slug; saveDraft(x); } }).catch(e => fail(err, e));
  // Remembers what's typed on this device, except the password and phone, so a reload doesn't lose it.
  let source = SOURCES.includes(a.source) ? a.source : "";
  const keep = () => { const x = draft(); if (x) { x.acc = { name: $("#aName").value, email: $("#aEmail").value, year: $("#aYear").value, source }; saveDraft(x); } };
  ["#aName", "#aEmail", "#aYear"].forEach(s => $(s).oninput = keep);
  // One tap; tapping the picked chip again clears it.
  $("#aSrc").onclick = e => { const b = e.target.closest("button"); if (!b) return; source = source === b.dataset.s ? "" : b.dataset.s; $("#aSrc").querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x.dataset.s === source)); sfx.flip(); keep(); };
  $("#f").onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const v = { name: $("#aName").value.trim(), email: $("#aEmail").value.trim(), password: $("#aPass").value, birthYear: Math.round(+$("#aYear").value), phone: $("#aPhone").value.trim(), privacy: $("#aPrivacy").checked, marketing: $("#aMkt").checked, source };
    if (!v.name) return show("bad_name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) return show("bad_email");
    if (v.password.length < 8) return show("bad_password");
    if (!(v.birthYear >= y - 100 && v.birthYear <= y)) return show("bad_year");
    if (y - v.birthYear < MIN_AGE) return show("too_young");
    if (v.phone && !/^\+?\d{9,15}$/.test(v.phone.replace(/[\s()-]/g, ""))) return show("bad_phone");
    if (!v.privacy) return show("no_privacy");
    const btn = $("#nextBtn"); btn.disabled = true; btn.textContent = t("storeBuying");
    try {
      const r = await api("signup", { orderToken: draft().orderToken, ...v });
      store.set("session", { token: r.session, slug: r.slug });
      store.set("email", v.email); store.set("name", v.name);
      store.del("draft");
      confetti(); sfx.done();
      nav("#/wait");
    } catch (er) { fail(err, er); btn.disabled = false; btn.textContent = t("accGo"); }
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
        ${ready ? `<div class="ob-foot"><a class="btn-p" href="#/s/${esc(s.slug)}" id="startCourse">${t(free ? "waitFreeStart" : "waitStart")}</a></div>` : ""}</div>`;
      bindLang();
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
function route() {
  const h = location.hash.replace(/^#/, "").split("?")[0] || "/"; // ?r= only forces a fresh render of the same lesson
  const parts = h.split("/").filter(Boolean);
  window.scrollTo({ top: 0, behavior: "instant" });
  if (!parts.length) return viewWelcome();
  if (parts[0] === "start") return nav("#/"); // the old invite page
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
    const step = d.slug ? "account" : parts[1] || d.step; // once the free lessons are queued, the setup can't change
    if (step !== (parts[1] || d.step)) return nav("#/new/" + step);
    if (STEPS.indexOf(step) > STEPS.indexOf(d.step || "files")) return nav("#/new/" + (d.step || "files"));
    const stepView = { files: viewFiles, date: viewDate, tutor: viewTutor, account: viewAccount }[step];
    return stepView ? stepView() : nav("#/");
  }
  if (parts[0] === "s") return courseRoute(parts.slice(1), nav, render);
  nav("#/");
}
addEventListener("hashchange", render);
// Safari (and Chrome) restore a page from the back-forward cache as it was left: after Back from Stripe the buy
// button would still say "One moment…" and be disabled. Draw the view afresh instead.
addEventListener("pageshow", e => { if (e.persisted) render(); });
applyTheme();
setLang(lang()).then(render);
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { });
