// Router, welcome, onboarding (slides → date → tutor, then the account), wait page, login, unlock (store), terms and privacy.
import { $, $$, view, esc, store, api, today, addDays, ic, toast, confetti, sfx } from "./util.js";
import { t, lang, setLang, courseLang, errText, pages as pagesTxt, fileCount, lessonCount, minutesLeft, inDays, inWeeks, fmtDay, fmtShortMonth } from "./i18n.js";
import { ham } from "./art.js";
import { countPages, validFile, daysBetween } from "./forecast.js";
import { courseRoute, tutorArt, TUTORS, tutorWith, resetCourse, storeInfo } from "./course.js";
import { BACK, CLOSE, PACE_ICONS, langSheet, applyTheme } from "./ui.js";

const draft = () => { const d = store.get("draft", null); if (d && !STEPS.includes(d.step)) d.step = d.slug ? "account" : "files"; return d; };
const saveDraft = d => store.set("draft", d);
const session = () => store.get("session", null);
const STEPS = ["files", "date", "tutor", "account"], COUNTED = 3; // the account step isn't counted in the progress bar
const MIN_AGE = 15; // same as pc-api
const nav = h => { if (location.hash === h) render(); else location.hash = h; };
const fail = (el, e) => { el.textContent = errText(e.code || e.message); el.hidden = false; sfx.wrong(); };
const hideNav = () => { $("#nav").hidden = true; document.body.classList.remove("has-tabs"); };
let cfgP = null;
const storeConfig = () => cfgP ||= fetch("store.config.json").then(r => r.json()).catch(e => { cfgP = null; throw e; });
const testBadge = () => `<span class="pc-badge" data-testbadge style="display:none">${t("testBadge")}</span>`;
const showBadge = () => storeConfig().then(c => { if (c.testMode) $$("[data-testbadge]").forEach(b => b.style.display = ""); }).catch(() => { });
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
function bindStepBack(step) { const i = STEPS.indexOf(step); $("#stepBack").onclick = () => nav(i ? "#/new/" + STEPS[i - 1] : "#/"); }

/* ---------- welcome ---------- */
function viewWelcome() {
  hideNav(); plain();
  const s = session(), d = draft();
  if (s) return nav("#/wait");
  view().innerHTML = `<div class="ob ob-welcome"><div class="ob-top">${testBadge()}${langBtn()}</div>
    <div class="ob-wbody"><div class="ob-hero">${ham("happy", "bob")}</div>
    <h1 class="ob-display">${t("welcomeTitle1")} <em>${t("welcomeTitle2")}</em></h1>
    <p class="ob-sub">${t("welcomeSub")}</p>
    <div class="ob-chips"><span>${t("chipFiles")}</span><i>→</i><span>${t("chipLevels")}</span><i>→</i><span>${t("chipExam")}</span></div>
    <p class="ob-note c" id="priceNote" hidden></p></div>
    <div class="ob-foot">${d ? `<a class="btn-p" href="#/new/${d.step || "files"}">${t("welcomeResume")}</a>` : `<button class="btn-p" id="goStart">${t("welcomeStart")}</button>`}
      <a class="btn-t" href="#/login">${t("welcomeHave")}</a>${legalLinks()}</div></div>`;
  bindLang(); showBadge();
  storeConfig().then(c => { const p = c.plans?.[0], el = $("#priceNote"); if (p && el) { el.textContent = t("welcomePrice", { price: `${p.price} ${c.currency}` }); el.hidden = false; } }).catch(() => { });
  const go = $("#goStart");
  if (go) go.onclick = async () => {
    go.disabled = true;
    try {
      const { orderToken } = await api("start", { lang: courseLang() });
      saveDraft({ orderToken, step: "files", files: [], days: 7 });
      nav("#/new/files");
    } catch (e) { go.disabled = false; toast(errText(e.code)); }
  };
}

/* ---------- login ---------- */
function signedIn(r, code, email) {
  store.set("session", { token: r.session, slug: r.student.slug });
  if (code) store.set("code", code.toUpperCase());
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
    <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p" id="go">${t("loginGo")}</button></form>
    <p class="ob-note">${t("signinForgot")}</p><a class="btn-t" href="#/login/code">${t("signinCode")}</a>`);
  $("#email").focus();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#pass").value;
    if (!email || !password) return;
    $("#go").disabled = true; $("#err").hidden = true;
    try { signedIn(await api("login", { email, password }), null, email); } catch (er) { fail($("#err"), er); $("#go").disabled = false; }
  };
}
function viewCodeLogin() {
  loginFrame(t("loginTitle"), `<p class="ob-sub">${t("loginSub")}</p><form id="f" class="ob-form"><input class="ob-in code" id="code" placeholder="${t("loginPh")}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" aria-label="${t("loginPh")}">
    <p class="ob-err" id="err" hidden role="alert"></p><button class="btn-p" id="go">${t("loginGo")}</button></form>`);
  $("#code").focus();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const v = $("#code").value.trim(); if (!v) return;
    $("#go").disabled = true; $("#err").hidden = true;
    try { signedIn(await api("login", { code: v }), v); } catch (er) { fail($("#err"), er); $("#go").disabled = false; }
  };
}

/* ---------- step 1: slides ---------- */
const uploading = new Map();
const fileKind = name => /\.pptx$/i.test(name) ? "pptx" : "pdf";
function fileRows(d) {
  const rows = d.files.map(f => `<div class="ob-file"><span class="ob-fk ${fileKind(f.name)}">${fileKind(f.name).toUpperCase()}</span><div class="t"><b>${esc(f.name)}</b><span>${pagesTxt(f.pages)}${f.estimated ? ` (${t("filesEst")})` : ""}</span></div><button class="ob-x" data-rm="${esc(f.path)}" aria-label="${t("filesRemove")}">${ic.x}</button></div>`).join("");
  const up = [...uploading.values()].map(u => `<div class="ob-file busy"><span class="ob-fk ${fileKind(u.name)}">${fileKind(u.name).toUpperCase()}</span><div class="t"><b>${esc(u.name)}</b><div class="ob-bar"><i style="width:${u.pct}%"></i></div></div></div>`).join("");
  return rows + up;
}
function viewFiles() {
  view().innerHTML = frame("files", { title: t("filesTitle"), sub: t("filesSub"), btn: t("next"),
    body: `<div id="list"></div>
      <label class="ob-drop" id="drop">${ic.upload}<b id="dropTxt"></b><input type="file" id="pick" accept=".pdf,.pptx" multiple hidden></label>
      <p class="ob-err" id="err" hidden role="alert"></p><div class="ob-sum" id="total" hidden></div><p class="ob-note">${t("filesNote")}</p>` });
  bindStepBack("files");
  const refresh = () => {
    const cur = draft();
    $("#list").innerHTML = fileRows(cur);
    $("#dropTxt").textContent = cur.files.length || uploading.size ? t("filesAdd") : t("filesDrop");
    $("#drop").classList.toggle("more", !!(cur.files.length || uploading.size));
    const n = cur.files.reduce((a, f) => a + f.pages, 0);
    $("#total").hidden = !cur.files.length;
    $("#total").innerHTML = `${ic.book}<span>${t("filesSummary", { pages: `<b>${pagesTxt(n)}</b>` })}</span>`;
    $("#nextBtn").disabled = !cur.files.length || uploading.size > 0;
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
      uploading.set(key, { name: file.name, pct: 0 }); refresh();
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
  const addAll = files => { $("#err").hidden = true; [...files].forEach(add); };
  $("#pick").onchange = e => { addAll(e.target.files); e.target.value = ""; };
  const drop = $("#drop");
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove("over"); addAll(e.dataTransfer.files); };
  $("#nextBtn").onclick = () => {
    const cur = draft();
    if (!cur.files.length || uploading.size) return;
    cur.pages = cur.files.reduce((a, f) => a + f.pages, 0); cur.step = "date"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, pages: cur.pages }).catch(() => { });
    nav("#/new/date");
  };
  refresh();
}

/* ---------- step 2: exam date, a timeline under a fixed needle ---------- */
export const RULER = { MIN: 3, MAX: 150, STEP: 12 };
const paceOf = n => n < 14 ? "sprint" : n < 35 ? "tempo" : "chill";
// Minutes a day: one pass plus three repeats of every page (3 min a page), spread over the days before the last two.
export const minutesFor = (pages, n) => Math.max(10, Math.min(90, Math.round((pages || 20) * 3 / Math.max(1, n - 2) / 5) * 5));
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
  rs.onkeydown = e => { const k = { ArrowRight: 1, ArrowLeft: -1, PageUp: 7, PageDown: -7 }[e.key]; if (k) { e.preventDefault(); rs.scrollLeft = (at() + k - RULER.MIN) * RULER.STEP; } };
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
const pickable = () => TUTORS.filter(x => x.idx >= 0);
export function carouselHtml() {
  return `<div class="car" id="car" dir="ltr">${pickable().map(x => `<div class="slot"><div class="fig">${tutorArt(x.id)}</div></div>`).join("")}</div><div class="car-floor" aria-hidden="true"></div>
    <div class="tinfo"><b id="tName"></b></div><div class="dots" id="dots" aria-hidden="true">${pickable().map(() => "<i></i>").join("")}</div>`;
}
export function bindCarousel(startId, onChange) {
  const c = $("#car");
  let cur = -1;
  const paint = () => {
    const mid = c.scrollLeft + c.clientWidth / 2;
    let best = 0, bd = 1e9;
    [...c.children].forEach((s, i) => {
      const dist = Math.abs(s.offsetLeft + s.offsetWidth / 2 - mid) / s.offsetWidth, k = Math.min(dist, 1.4);
      s.firstChild.style.transform = `scale(${1 - k * 0.42}) translateY(${k * 10}px)`;
      s.firstChild.style.opacity = 1 - k * 0.45;
      s.firstChild.style.filter = k > .5 ? "saturate(.6)" : "";
      if (dist < bd) { bd = dist; best = i; }
    });
    if (best !== cur) { cur = best; $("#tName").textContent = pickable()[best].name; [...$("#dots").children].forEach((d, i) => d.classList.toggle("on", i === best)); onChange(pickable()[best]); }
  };
  const go = (i, smooth = true) => { const s = c.children[Math.max(0, Math.min(pickable().length - 1, i))]; c.scrollTo({ left: s.offsetLeft + s.offsetWidth / 2 - c.clientWidth / 2, behavior: smooth ? "smooth" : "auto" }); };
  c.addEventListener("scroll", paint, { passive: true });
  [...c.children].forEach((s, i) => s.onclick = () => go(i));
  c.tabIndex = 0; c.onkeydown = e => { if (e.key === "ArrowRight") go(cur + 1); if (e.key === "ArrowLeft") go(cur - 1); };
  const startI = Math.max(0, pickable().findIndex(x => x.id === startId));
  requestAnimationFrame(() => { go(startI, false); paint(); });
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
      <label class="ob-check"><input type="checkbox" id="aPrivacy"><span>${t("accPrivacy").replace("%", `<a href="#/privacy" target="_blank" rel="noopener">${t("accPrivacyLink")}</a>`)}</span></label>
      <label class="ob-check"><input type="checkbox" id="aMkt"><span>${t("accMarketing")}</span></label>
      <p class="ob-err" id="err" hidden role="alert"></p>
    </form><p class="ob-note">${t("accHave")} <a href="#/login">${t("accLogin")}</a></p>` });
  $("#nextBtn").setAttribute("form", "f"); $("#nextBtn").type = "submit";
  $("#stepBack").onclick = () => nav("#/");
  const err = $("#err"), show = code => { err.textContent = errText(code); err.hidden = false; sfx.wrong(); err.scrollIntoView({ block: "center" }); };
  if (!d.slug) api("queue_free", { orderToken: d.orderToken }).then(r => { const x = draft(); if (x) { x.slug = r.slug; saveDraft(x); } }).catch(e => fail(err, e));
  // Remembers what's typed on this device, except the password and phone, so a reload doesn't lose it.
  const keep = () => { const x = draft(); if (x) { x.acc = { name: $("#aName").value, email: $("#aEmail").value, year: $("#aYear").value }; saveDraft(x); } };
  ["#aName", "#aEmail", "#aYear"].forEach(s => $(s).oninput = keep);
  $("#f").onsubmit = async e => {
    e.preventDefault(); err.hidden = true;
    const v = { name: $("#aName").value.trim(), email: $("#aEmail").value.trim(), password: $("#aPass").value, birthYear: Math.round(+$("#aYear").value), phone: $("#aPhone").value.trim(), privacy: $("#aPrivacy").checked, marketing: $("#aMkt").checked };
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
      store.set("code", r.code); store.set("email", v.email); store.set("name", v.name);
      store.del("draft");
      confetti(); sfx.done();
      nav("#/wait");
    } catch (er) { fail(err, er); btn.disabled = false; btn.textContent = t("accGo"); }
  };
}

/* ---------- unlock: the store, after the free lessons ---------- */
async function viewUnlock() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  // render() has already dropped the map's layout class, so the old map would show squeezed while this loads
  view().innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  const [cfg, st, info] = await Promise.all([storeConfig(), api("status", { session: s.token }).catch(e => e), storeInfo(s.slug)]);
  if (st.status === 401) { store.del("session"); return nav("#/login"); }
  if (st.paid) return nav("#/s/" + s.slug);
  document.body.classList.add("store");
  const L = o => o?.[lang()] || o?.en || o?.cs, cur = esc(cfg.currency), left = info?.left;
  // Outcome first: the exam, the lesson they tapped, what unlocks, then one boxed payment card (sticky on the right on desktop).
  const title = t("stTitle");
  const what = info?.units.length ? `<h2 class="st-h">${t("stWhat")}</h2><ul class="st-units">${info.units.map(u => `<li style="--chc:var(--ch${u.ci % 6 + 1})"><i>${ic.lock}</i><b>${esc(u.title)}</b><small>${esc(lessonCount(u.n))}</small></li>`).join("")}</ul>` : "";
  const tl = info ? `<ol class="st-tl">
      <li class="${info.done ? "done" : ""}"><i>${info.done ? ic.check : ""}</i><div><small>${t("stTlDone")}</small><b>${esc(t("doneOf", { x: info.done, y: info.free }))}</b></div></li>
      <li class="now"><i></i><div><small>${t("stTlNow")}</small><b>${esc(t("stUnlockN").replace("%", lessonCount(info.locked)))}</b></div></li>
      ${info.exam ? `<li class="ex"><i></i><div><small>${t("stTlExam")}</small><b>${esc(fmtDay(info.exam))}${left > 0 ? " · " + esc(inDays(left)) : ""}</b></div></li>` : ""}</ol>` : "";
  const pro = st.pro, proOpen = pro?.active && pro.newLeft > 0;
  const buy = p => `<button class="${p.highlight ? "btn-p" : "btn-s"}" data-plan="${p.id}">${t(cfg.testMode ? "storeBuyTest" : "storeBuy")} · ${p.price} ${cur}${p.interval === "month" ? " / " + t("stMonthShort") : ""}</button>`;
  const plan = p => `<div class="st-plan${p.highlight ? " hi" : ""}"><div class="st-price"><b>${p.price} ${cur}</b><span>${t(p.interval === "month" ? "stMonth" : "stOnce")}</span></div>
      <h3 class="st-pname">${esc(L(p.name) || "")}</h3>
      ${left > 0 && p.interval !== "month" ? `<p class="st-perday">${esc(t("stPerDay").replace("%", `${Math.max(1, Math.round(p.price / left))} ${cfg.currency}`))}</p>` : ""}
      <ul>${L(p.features).map(x => `<li>${ic.check}<span>${esc(x)}</span></li>`).join("")}</ul>${buy(p)}</div>`;
  // Already Pro: this subject opens from the month's allowance. Allowance used up: only the one-off course is sold.
  const plans = proOpen ? `<div class="st-plan hi"><h3 class="st-pname">Pro</h3><p>${esc(t("stProOn"))}</p><p class="st-perday">${esc(t("stProLeft", { n: pro.newLeft, x: pro.newPerWindow }))}</p><button class="btn-p" data-pro>${t("stProOpen")}</button></div>`
    : (pro?.active ? `<p class="ob-note">${esc(errText("pro_cap"))}</p>` : "") + cfg.plans.filter(p => !(pro?.active && p.id === "pro")).map(plan).join("");
  view().innerHTML = `<div class="ob st"><div class="ob-hd"><button class="ob-bk" id="stepBack" aria-label="${t("back")}">${CLOSE}</button></div>
    <div class="st-grid"><div class="st-main">
      <div class="st-hero"><div class="st-art">${tutorArt(info?.tutor || "penny")}</div><p class="st-say">${t("stSay")}</p></div>
      <h1 class="ob-h">${title}</h1>
      ${info?.tapped ? `<p class="st-tap">${ic.lock}<span>${esc(t("stTapped").replace("%", info.tapped))}</span></p>` : `<p class="ob-sub">${t("unlockSub")}</p>`}
      ${what}${tl}
    </div><aside class="st-pay">
      ${cfg.testMode ? `<div class="ob-test" role="note">${t("storeTest")}</div>` : ""}
      <label class="ob-check"><input type="checkbox" id="terms"><span>${t("storeTerms").replace("%", `<a href="#/terms" target="_blank" rel="noopener">${t("storeTermsLink")}</a>`)}</span></label>
      <p class="ob-err" id="err" hidden role="alert"></p>
      ${plans}
      <p class="ob-note c">${t("storeSecure")}</p>
      <a class="st-free" href="#/s/${esc(s.slug)}">${t("stFree")}</a>
    </aside></div></div>`;
  $("#stepBack").onclick = () => nav("#/s/" + s.slug);
  const proBtn = $("[data-pro]");
  if (proBtn) proBtn.onclick = async () => {
    $("#err").hidden = true; proBtn.disabled = true;
    try { await api("pro_unlock", { session: s.token }); resetCourse(); confetti(); sfx.done(); toast(t("unlockDone")); nav("#/s/" + s.slug); }
    catch (e) { fail($("#err"), e); proBtn.disabled = false; }
  };
  $$("[data-plan]").forEach(b => b.onclick = async () => {
    const label = b.textContent;
    $("#err").hidden = true;
    if (!$("#terms").checked) return fail($("#err"), { code: "no_terms" });
    $$("[data-plan]").forEach(x => x.disabled = true); b.textContent = t("storeBuying");
    try {
      const r = await api("checkout", { session: s.token, plan: b.dataset.plan, terms: true });
      if (r.url) { location.href = r.url; return; } // Stripe Checkout; it comes back to #/paid
      resetCourse();
      confetti(); sfx.done(); toast(t("unlockDone"));
      nav("#/s/" + s.slug);
    } catch (e) { fail($("#err"), e); $$("[data-plan]").forEach(x => x.disabled = false); b.textContent = label; }
  });
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
  const cfg = await storeConfig().catch(() => ({})), plan = (cfg.plans || [])[0];
  const price = plan ? `${plan.price} ${cfg.currency}` : "";
  legalFrame(`<h1 class="ob-h">${t("termsTitle")}</h1><p class="ob-note">${t("termsVersion")}</p>
    <h2>${t("termsSeller")}</h2><p>${operatorHtml(cfg.operator || {})}</p>
    ${[1, 2, 3, 4, 5, 6, 7].map(n => `<h2>${t("termsH" + n)}</h2><p>${t("termsP" + n).replace("%", price)}</p>`).join("")}`);
}
async function viewPrivacy() {
  const who = operatorHtml((await storeConfig().catch(() => ({}))).operator || {});
  legalFrame(`<h1 class="ob-h">${t("privTitle")}</h1><p class="ob-note">${t("privVersion")}</p>
    ${[1, 2, 3, 4, 5, 6].map(n => `<h2>${t("privH" + n)}</h2><p>${t("privP" + n)}</p>`).join("")}
    <h2>${t("privOperator")}</h2><p>${who}</p>`);
}

/* ---------- wait page ---------- */
let waitTimer = null;
const STAGE_STEP = { outline: 1, lessons: 2, checking: 2, publishing: 3 };
const buildMinutesOf = pages => Math.max(3, Math.round(pages / 12) + 2); // same formula as scripts/gen/cost.mjs
function stepsHtml(status, build) {
  const stage = build?.progress?.stage;
  const active = status === "building" && STAGE_STEP[stage] ? STAGE_STEP[stage] : { paid_test: 1, free_queued: 1, draft: 1, building: 2, free_ready: 4, ready: 4, failed: 1 }[status] ?? 1;
  const queued = status === "paid_test" || status === "free_queued";
  return `<ol class="pc-steps">${[1, 2, 3, 4].map(n => `<li class="${n <= active ? "done" : n === active + 1 && !queued ? "now" : ""}"><i>${n <= active ? ic.check : n}</i>${t("waitS" + n)}</li>`).join("")}</ol>`;
}
function buildHtml(status, build, free, offline) {
  if (!build || ["ready", "free_ready", "failed"].includes(status)) return "";
  const buildMinutes = free ? () => "1–2" : buildMinutesOf;
  const p = status === "building" ? build.progress : null, pages = p?.pages || build.pages || 0;
  const stale = p && build.progressAge > 180;
  const files = build.files.length ? `<ul class="pc-build-files">${build.files.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}${build.files.length > 3 ? `<li>+${build.files.length - 3}</li>` : ""}</ul>` : "";
  const time = offline && !p ? t("buildOffline") : stale ? t("buildStale") : p ? (p.etaSeconds > 0 ? minutesLeft(p.etaSeconds) : t("buildAlmost")) : status === "building" ? t("buildTotal").replace("%", buildMinutes(pages)) : t("buildQueued").replace("%", buildMinutes(pages));
  const pct = p?.total ? Math.round(p.done / p.total * 100) : 0;
  const lessons = p?.lessons || [];
  return `<div class="pc-build"><span>${t("buildWhat")}</span>
    ${p?.title ? `<b>${esc(p.title)}</b>` : ""}
    <p>${[build.files.length ? fileCount(build.files.length) : "", pages ? pagesTxt(pages) : "", lessons.length ? lessonCount(lessons.length) : ""].filter(Boolean).join(" · ")}</p>
    ${lessons.length ? "" : files}
    <p class="pc-build-time">${time}</p>
    ${p ? `<div class="ob-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p class="pc-build-stage">${t("buildStage_" + p.stage)}</p>` : ""}
    ${lessons.length ? `<ul class="pc-build-lessons">${lessons.map(l => `<li class="${l.done ? "done" : ""}"><i>${l.done ? ic.check : ""}</i>${esc(l.title)}</li>`).join("")}</ul>` : ""}
  </div>`;
}
async function viewWait() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  let painted = null;
  const paint = r => {
    const { status, student, build } = r, free = !r.paid, ready = !!r.course, failed = !ready && status === "failed";
    const offline = r.workerOnline === false && ["free_queued", "paid_test"].includes(status); // building runs on one computer that can be off
    const tutor = student ? student.tutor || "penny" : null, key = [status, tutor, ready, free, lang()].join();
    const shown = ready ? (free ? "free_ready" : "ready") : status;
    if (painted === key + offline && $("#pcLive")) { $("#pcLive").innerHTML = stepsHtml(shown, build) + buildHtml(shown, build, free, offline); return; } // keeps the mascot animation running
    painted = key + offline;
    const code = store.get("code");
    const title = ready ? (free ? "waitFreeReady" : "waitReady") : failed ? "waitFailed" : free ? (status === "free_queued" ? "waitFreeQueued" : "waitFreeTitle") : status === "paid_test" ? "waitQueued" : "waitTitle";
    const sub = ready ? (free ? "waitFreeReadySub" : "waitReadySub") : failed ? "waitFailedSub" : offline ? "waitOfflineSub" : free ? "waitFreeSub" : "waitSub";
    view().innerHTML = `<div class="ob ob-wait"><div class="ob-top">${testBadge()}${langBtn()}</div>
      <div class="pc-hero ${ready ? "" : "working"}">${tutor ? tutorArt(tutor, "bob") : ""}</div>
      <h1 class="ob-h">${t(title)}</h1><p class="ob-sub">${t(sub)}</p>
      ${failed ? "" : `<div id="pcLive">${stepsHtml(shown, build) + buildHtml(shown, build, free, offline)}</div>`}
      ${code ? `<div class="pc-code"><span>${t("codeTitle")}</span><b id="codeV">${esc(code)}</b><button class="btn-t sm" id="copy">${ic.copy} ${t("codeCopy")}</button><small>${t("codeSave")}</small></div>` : ""}
      ${ready ? `<div class="ob-foot"><a class="btn-p" href="#/s/${esc(s.slug)}" id="startCourse">${t(free ? "waitFreeStart" : "waitStart")}</a></div>` : ""}</div>`;
    bindLang(); showBadge();
    const c = $("#copy");
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(code); toast(t("codeCopied")); } catch (e) { } };
  };
  const poll = async () => {
    clearTimeout(waitTimer);
    if (!location.hash.startsWith("#/wait")) return;
    try {
      const r = await api("status", { session: s.token });
      if (r.course && store.get("readySeen") === s.slug) return nav("#/s/" + s.slug);
      paint(r);
      if (r.course) { store.set("readySeen", s.slug); confetti(); sfx.done(); return; }
    } catch (e) {
      if (e.status === 401) { store.del("session"); return nav("#/login"); }
    }
    waitTimer = setTimeout(poll, 5000);
  };
  if (store.get("readySeen") !== s.slug) paint({ status: "free_queued", paid: false });
  poll();
}

/* ---------- another subject for a signed-in account: the same setup, without the account step ---------- */
async function newSubject() {
  hideNav(); plain();
  const s = session(); if (!s) return nav("#/login");
  const d = draft();
  if (d?.acct) return nav("#/new/" + (d.step || "files")); // one in progress already
  view().innerHTML = `<div class="loading" role="status" aria-label="…"><i></i></div>`;
  try {
    const { orderToken } = await api("new_subject", { session: s.token, lang: courseLang() });
    saveDraft({ orderToken, step: "files", files: [], days: 7, acct: true });
    nav("#/new/files");
  } catch (e) {
    if (e.status === 401) { store.del("session"); return nav("#/login"); }
    toast(errText(e.code)); nav("#/s/" + s.slug);
  }
}

/* ---------- router ---------- */
export function render() {
  clearTimeout(waitTimer); clearTimeout(paidTimer);
  document.querySelectorAll(".feedback,.confetti,#sh,#shDim").forEach(e => e.remove());
  document.body.classList.remove("plain", "map-page", "framed", "store");
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
  if (parts[0] === "login") return parts[1] === "code" ? viewCodeLogin() : viewLogin();
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
