// Router, landing, invite, onboarding, account, wait page, login, unlock (store), privacy.
import { $, $$, view, esc, store, api, today, addDays, ic, toast, confetti, sfx } from "./util.js";
import { t, lang, setLang, errText, days as daysTxt, pages as pagesTxt, fileCount, lessonCount, minutesLeft } from "./i18n.js";
import { ham } from "./art.js";
import { forecast, scenarios, countPages, validFile, daysBetween } from "./forecast.js";
import { courseRoute, tutorArt, TUTORS, resetCourse } from "./course.js";

const draft = () => { const d = store.get("draft", null); if (d?.step === "store") d.step = "account"; return d; }; // drafts from before accounts
const saveDraft = d => store.set("draft", d);
const session = () => store.get("session", null);
const STEPS = ["files", "tutor", "date", "time", "account"];
const MIN_AGE = 15; // same as pc-api
const nav = h => { if (location.hash === h) render(); else location.hash = h; };
const fail = (el, e) => { el.textContent = errText(e.code || e.message); el.hidden = false; sfx.wrong(); };
const hideNav = () => { $("#nav").hidden = true; document.body.classList.remove("has-dock"); };

function stepTop(step) {
  const i = STEPS.indexOf(step);
  return `<div class="session-top"><button class="x" id="stepBack" aria-label="${t("back")}">${i ? ic.back : ic.x}</button><div class="bar"><i style="width:${(i + 1) / STEPS.length * 100}%"></i></div></div>`;
}
function bindStepBack(step) { const i = STEPS.indexOf(step); $("#stepBack").onclick = () => nav(i ? "#/new/" + STEPS[i - 1] : "#/"); }
function langToggle() {
  return `<div class="pc-lang" role="group" aria-label="${t("setLang")}"><button data-lang="cs" class="${lang() === "cs" ? "on" : ""}">CS</button><button data-lang="en" class="${lang() === "en" ? "on" : ""}">EN</button></div>`;
}
function bindLang() { $$("[data-lang]").forEach(b => b.onclick = () => { setLang(b.dataset.lang); const d = draft(); if (d?.orderToken) api("update_order", { orderToken: d.orderToken, lang: lang() }).catch(() => { }); render(); }); }

/* ---------- landing ---------- */
function viewLanding() {
  hideNav();
  const s = session(), d = draft();
  if (s) return nav("#/wait");
  const main = d ? `<a class="btn block big" href="#/new/${d.step || "files"}">${t("landingResume")}</a>`
      : `<a class="btn block big" href="#/start" id="goStart">${t("landingStart")}</a>`;
  view().innerHTML = `<div class="pc-land">
    <div class="pc-land-top"><span class="pc-badge">${t("testBadge")}</span>${langToggle()}</div>
    <div class="pc-hero">${ham("happy", "bob")}</div>
    <h1>${t("landingTitle")}</h1><p class="pc-sub">${t("landingSub")}</p>
    <div class="pc-how">${[1, 2, 3, 4].map(n => `<div><b>${n}</b><span>${t("how" + n)}</span></div>`).join("")}</div>
    <div class="pc-land-cta">${main}<a class="btn ghost block" href="#/login">${t("landingSignIn")}</a></div></div>`;
  bindLang();
}

/* ---------- invite and login ---------- */
function codeForm({ title, sub, ph, go, onSubmit }) {
  hideNav();
  view().innerHTML = `<div class="session-top"><button class="x" id="stepBack" aria-label="${t("back")}">${ic.x}</button></div>
    <div class="pc-center">${ham("open", "pc-small")}<h1>${esc(title)}</h1><p class="pc-sub">${esc(sub)}</p>
    <form id="f"><input class="pc-input code" id="code" placeholder="${esc(ph)}" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" aria-label="${esc(ph)}">
    <p class="pc-err" id="err" hidden role="alert"></p><button class="btn block big" id="go">${esc(go)}</button></form></div>`;
  $("#stepBack").onclick = () => nav("#/");
  $("#code").focus();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const v = $("#code").value.trim(); if (!v) return;
    $("#go").classList.add("off"); $("#err").hidden = true;
    try { await onSubmit(v); } catch (er) { fail($("#err"), er); $("#go").classList.remove("off"); }
  };
}
function viewInvite() {
  if (draft()) return nav("#/new/" + (draft().step || "files"));
  codeForm({ title: t("inviteTitle"), sub: t("inviteSub"), ph: t("invitePh"), go: t("next"), onSubmit: async v => {
    const { orderToken } = await api("start", { invite: v, lang: lang() });
    saveDraft({ orderToken, step: "files", files: [], minutes: 30, days: 5 });
    nav("#/new/files");
  } });
}
function signedIn(r, code) {
  store.set("session", { token: r.session, slug: r.student.slug });
  if (code) store.set("code", code.toUpperCase());
  resetCourse();
  nav(r.course ? "#/s/" + r.student.slug : "#/wait");
}
function viewLogin() {
  hideNav();
  view().innerHTML = `<div class="session-top"><button class="x" id="stepBack" aria-label="${t("back")}">${ic.x}</button></div>
    <div class="pc-center">${ham("open", "pc-small")}<h1>${t("signinTitle")}</h1>
    <form id="f" class="pc-form"><input class="pc-input" id="email" type="email" autocomplete="email" placeholder="${t("accEmail")}" aria-label="${t("accEmail")}" maxlength="200">
    <input class="pc-input" id="pass" type="password" autocomplete="current-password" placeholder="${t("accPass")}" aria-label="${t("accPass")}" maxlength="200">
    <p class="pc-err" id="err" hidden role="alert"></p><button class="btn block big" id="go">${t("loginGo")}</button></form>
    <p class="pc-note">${t("signinForgot")}</p><a class="btn ghost block" href="#/login/code">${t("signinCode")}</a></div>`;
  $("#stepBack").onclick = () => nav("#/");
  $("#email").focus();
  $("#f").onsubmit = async e => {
    e.preventDefault();
    const email = $("#email").value.trim(), password = $("#pass").value;
    if (!email || !password) return;
    $("#go").classList.add("off"); $("#err").hidden = true;
    try { signedIn(await api("login", { email, password })); } catch (er) { fail($("#err"), er); $("#go").classList.remove("off"); }
  };
}
function viewCodeLogin() {
  codeForm({ title: t("loginTitle"), sub: t("loginSub"), ph: t("loginPh"), go: t("loginGo"), onSubmit: async v => signedIn(await api("login", { code: v }), v) });
}

/* ---------- step 1: files ---------- */
const uploading = new Map();
function fileRows(d) {
  const rows = d.files.map(f => `<div class="pc-file">${ic.file}<div class="t"><b>${esc(f.name)}</b><span>${f.pages} ${t("filesPages")}${f.estimated ? ` (${t("filesEst")})` : ""}</span></div><button class="x" data-rm="${esc(f.path)}" aria-label="${t("filesRemove")}">${ic.x}</button></div>`).join("");
  const up = [...uploading.values()].map(u => `<div class="pc-file busy">${ic.file}<div class="t"><b>${esc(u.name)}</b><div class="bar blue"><i style="width:${u.pct}%"></i></div></div></div>`).join("");
  return rows + up;
}
function viewFiles() {
  const d = draft();
  view().innerHTML = `${stepTop("files")}<div class="pc-step"><h1>${t("filesTitle")}</h1><p class="pc-sub">${t("filesSub")}</p>
    <label class="pc-drop" id="drop">${ic.upload}<b>${t("filesDrop")}</b><input type="file" id="pick" accept=".pdf,.pptx" multiple hidden></label>
    <p class="pc-err" id="err" hidden role="alert"></p><div id="list"></div><p class="pc-total" id="total"></p><p class="pc-note">${t("filesNote")}</p></div>
    <div class="dock"><div class="dock-in"><button class="btn block big" id="nextBtn">${t("next")}</button></div></div>`;
  bindStepBack("files");
  const refresh = () => {
    const cur = draft();
    $("#list").innerHTML = fileRows(cur);
    const n = cur.files.reduce((a, f) => a + f.pages, 0);
    $("#total").textContent = cur.files.length ? `${t("filesTotal")}: ~${pagesTxt(n)}` : "";
    $("#nextBtn").classList.toggle("off", !cur.files.length || uploading.size > 0);
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
    cur.pages = cur.files.reduce((a, f) => a + f.pages, 0); cur.step = "tutor"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, pages: cur.pages }).catch(() => { });
    nav("#/new/tutor");
  };
  refresh();
}

/* ---------- step 2: teacher ---------- */
function viewTutor() {
  const d = draft();
  view().innerHTML = `${stepTop("tutor")}<div class="pc-step"><h1>${t("tutorTitle")}</h1><p class="pc-sub">${t("tutorSub")}</p>
    <div class="pc-tutors">${TUTORS.map(x => `<button class="pc-tutor ${d.tutor === x.id ? "sel" : ""}" data-t="${x.id}" aria-pressed="${d.tutor === x.id}">${tutorArt(x.id)}<b>${esc(x.name)}</b><span>${esc(x.hi[lang()])}</span></button>`).join("")}</div></div>
    <div class="dock"><div class="dock-in"><button class="btn block big ${d.tutor ? "" : "off"}" id="nextBtn">${t("next")}</button></div></div>`;
  bindStepBack("tutor");
  $$("[data-t]").forEach(b => b.onclick = () => {
    const cur = draft(); cur.tutor = b.dataset.t; saveDraft(cur); sfx.flip();
    $$("[data-t]").forEach(o => { o.classList.toggle("sel", o === b); o.setAttribute("aria-pressed", o === b); });
    $("#nextBtn").classList.remove("off");
  });
  $("#nextBtn").onclick = () => {
    const cur = draft(); if (!cur.tutor) return;
    cur.step = "date"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, tutor: cur.tutor }).catch(() => { });
    nav("#/new/date");
  };
}

/* ---------- step 3: test date ---------- */
function viewDate() {
  const d = draft(), min = addDays(today(), 1);
  view().innerHTML = `${stepTop("date")}<div class="pc-step"><h1>${t("dateTitle")}</h1><p class="pc-sub">${t("dateSub")}</p>
    <div class="pc-center-art">${tutorArt(d.tutor, "pc-small")}</div>
    <input class="pc-input" id="date" type="date" min="${min}" value="${d.examDate || ""}" aria-label="${t("dateTitle")}">
    <p class="pc-inline" id="in"></p><p class="pc-err" id="err" hidden role="alert"></p></div>
    <div class="dock"><div class="dock-in"><button class="btn block big" id="nextBtn">${t("next")}</button></div></div>`;
  bindStepBack("date");
  const upd = () => {
    const v = $("#date").value, ok = v && v >= min;
    $("#in").textContent = ok ? `${t("dateIn")} ${daysTxt(daysBetween(today(), v))}` : "";
    $("#nextBtn").classList.toggle("off", !ok);
    return ok;
  };
  $("#date").oninput = upd; upd();
  $("#nextBtn").onclick = () => {
    if (!upd()) { $("#err").textContent = t("dateErr"); $("#err").hidden = false; return; }
    const cur = draft(); cur.examDate = $("#date").value; cur.step = "time"; saveDraft(cur);
    api("update_order", { orderToken: cur.orderToken, examDate: cur.examDate }).catch(() => { });
    nav("#/new/time");
  };
}

/* ---------- step 4: time and forecast ---------- */
const LEVEL_C = ["red", "orange", "blue", "green"];
const prep = (r, pages) => Math.max(3, Math.min(100, r.totalMinutes / (pages * 3) * 100)); // full bar = one pass and three repeats
const rep = n => n > 20 ? "20+" : n; // a very short PDF would otherwise promise 197 repeats
function forecastHtml(d) {
  const f = forecast({ pages: d.pages || 1, today: today(), examDate: d.examDate, minutes: d.minutes, days: d.days });
  const rowLbl = { you: t("fcYou"), more: t("fcMore"), daily: t("fcDaily") };
  const rows = scenarios({ pages: d.pages || 1, today: today(), examDate: d.examDate, minutes: d.minutes, days: d.days });
  return `<h2 class="pc-fchead">${t("fcHead")}</h2>
    <div class="pc-fc ${LEVEL_C[f.level]}"><div class="meter" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i <= f.level ? "on" : ""}"></i>`).join("")}</div>
      <b>${t("fcL" + f.level)}</b><span>${t("fcL" + f.level + "s")}</span></div>
    <div class="statboxes pc-fcnums">
      <div class="sbox b"><div class="h">${t("fcHours")}</div><div class="v">${String(f.hours).replace(".", lang() === "cs" ? "," : ".")}</div></div>
      <div class="sbox g"><div class="h">${t("fcCover")}</div><div class="v">${Math.round(f.coverage * 100)} %</div></div>
      <div class="sbox y"><div class="h">${t("fcRepeat")}</div><div class="v">${rep(f.repeats)}×</div></div></div>
    <div class="pc-compare">${rows.map(r => `<button class="pc-row ${r.key === "you" ? "you" : ""}" data-apply="${r.minutes},${r.days}" ${r.key === "you" ? "disabled" : ""}>
      <div class="l"><b>${rowLbl[r.key]}</b><span>${r.minutes} ${t("fcMinDay")} · ${r.days} ${t("fcDaysWk")}</span></div>
      <div class="r"><span>${Math.round(r.coverage * 100)} % ${t("fcNoPass")}</span><span>${rep(r.repeats)}× ${t("fcRep")}</span></div>
      <div class="bar pc-prep ${LEVEL_C[r.level]}" aria-hidden="true"><i style="width:${prep(r, d.pages || 1)}%"></i></div></button>`).join("")}</div>
    <p class="pc-note">${t("fcEst")}</p>`;
}
function viewTime() {
  const d = draft();
  view().innerHTML = `${stepTop("time")}<div class="pc-step"><h1>${t("timeTitle")}</h1>
    <label class="pc-lbl" for="minS">${t("timeMin")} <b id="minV"></b></label><input class="pc-slider" id="minS" type="range" min="5" max="180" step="5" value="${d.minutes}">
    <div class="pc-lbl">${t("timeDays")}</div><div class="pc-days" role="group" aria-label="${t("timeDays")}">${[1, 2, 3, 4, 5, 6, 7].map(n => `<button data-d="${n}">${n}</button>`).join("")}</div>
    <div id="fc"></div><p class="pc-err" id="err" hidden role="alert"></p></div>
    <div class="dock"><div class="dock-in"><button class="btn block big" id="nextBtn">${t("next")}</button></div></div>`;
  bindStepBack("time");
  const paint = () => {
    const cur = draft();
    $("#minS").value = cur.minutes; $("#minV").textContent = cur.minutes;
    $$("[data-d]").forEach(b => { b.classList.toggle("on", +b.dataset.d === cur.days); b.setAttribute("aria-pressed", +b.dataset.d === cur.days); });
    $("#fc").innerHTML = forecastHtml(cur);
    $$("[data-apply]").forEach(b => b.onclick = () => { const [m, n] = b.dataset.apply.split(",").map(Number); const x = draft(); x.minutes = m; x.days = n; saveDraft(x); sfx.flip(); paint(); });
  };
  $("#minS").oninput = e => { const cur = draft(); cur.minutes = +e.target.value; saveDraft(cur); paint(); };
  $$("[data-d]").forEach(b => b.onclick = () => { const cur = draft(); cur.days = +b.dataset.d; saveDraft(cur); sfx.flip(); paint(); });
  $("#nextBtn").onclick = async () => {
    const cur = draft(), btn = $("#nextBtn");
    btn.classList.add("off"); $("#err").hidden = true;
    try { // the free lessons start building now, while the student makes an account
      await api("update_order", { orderToken: cur.orderToken, pages: cur.pages, tutor: cur.tutor, examDate: cur.examDate, minutes: cur.minutes, days: cur.days, lang: lang() });
      const { slug } = await api("queue_free", { orderToken: cur.orderToken });
      const x = draft(); x.slug = slug; x.step = "account"; saveDraft(x);
      nav("#/new/account");
    } catch (e) { fail($("#err"), e); btn.classList.remove("off"); }
  };
  paint();
}

/* ---------- step 5: account, while the free lessons build ---------- */
function viewAccount() {
  const d = draft(), y = new Date().getFullYear(), a = d.acc || {};
  view().innerHTML = `${stepTop("account")}<div class="pc-step"><h1>${t("accTitle")}</h1>
    <div class="pc-say">${tutorArt(d.tutor, "pc-mini")}<div class="bubble">${t("accBuilding")}</div></div>
    <form id="f" class="pc-form" novalidate>
      <label class="pc-lbl" for="aName">${t("accName")}</label><input class="pc-input" id="aName" autocomplete="given-name" maxlength="80" value="${esc(a.name || "")}">
      <label class="pc-lbl" for="aEmail">${t("accEmail")}</label><input class="pc-input" id="aEmail" type="email" autocomplete="email" maxlength="200" value="${esc(a.email || "")}">
      <label class="pc-lbl" for="aPass">${t("accPass")}<span>${t("accPassHint")}</span></label><input class="pc-input" id="aPass" type="password" autocomplete="new-password" maxlength="200">
      <label class="pc-lbl" for="aYear">${t("accYear")}<span>${t("accYearHint")}</span></label><input class="pc-input" id="aYear" type="number" inputmode="numeric" min="${y - 100}" max="${y}" value="${esc(a.year || "")}">
      <label class="pc-lbl" for="aPhone">${t("accPhone")}<span>${t("accOptional")}</span></label><input class="pc-input" id="aPhone" type="tel" autocomplete="tel" maxlength="20" placeholder="+420 777 123 456">
      <label class="pc-check"><input type="checkbox" id="aPrivacy"><span>${t("accPrivacy").replace("%", `<a href="#/privacy" target="_blank" rel="noopener">${t("accPrivacyLink")}</a>`)}</span></label>
      <label class="pc-check"><input type="checkbox" id="aMkt"><span>${t("accMarketing")}</span></label>
      <p class="pc-err" id="err" hidden role="alert"></p>
    </form><p class="pc-note">${t("accHave")} <a href="#/login">${t("accLogin")}</a></p></div>
    <div class="dock"><div class="dock-in"><button class="btn block big" id="nextBtn" type="submit" form="f">${t("accGo")}</button></div></div>`;
  $("#stepBack").onclick = () => nav("#/");
  const err = $("#err"), show = code => { err.textContent = errText(code); err.hidden = false; sfx.wrong(); };
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
    const btn = $("#nextBtn"); btn.classList.add("off"); btn.textContent = t("storeBuying");
    try {
      const r = await api("signup", { orderToken: draft().orderToken, ...v });
      store.set("session", { token: r.session, slug: r.slug });
      store.set("code", r.code);
      store.del("draft");
      confetti(); sfx.done();
      nav("#/wait");
    } catch (er) { fail(err, er); btn.classList.remove("off"); btn.textContent = t("accGo"); }
  };
}

/* ---------- unlock: the store, after the free lessons ---------- */
const storeConfig = () => fetch("store.config.json").then(r => r.json());
async function viewUnlock() {
  hideNav();
  const s = session(); if (!s) return nav("#/login");
  const [cfg, st] = await Promise.all([storeConfig(), api("status", { session: s.token }).catch(e => e)]);
  if (st.status === 401) { store.del("session"); return nav("#/login"); }
  if (st.paid) return nav("#/s/" + s.slug);
  view().innerHTML = `<div class="session-top"><button class="x" id="stepBack" aria-label="${t("back")}">${ic.x}</button></div>
    <div class="pc-step"><h1>${t("unlockTitle")}</h1><p class="pc-sub">${t("unlockSub")}</p>
    ${cfg.testMode ? `<div class="pc-testmode" role="note">${t("storeTest")}</div>` : ""}
    <div class="pc-plans">${cfg.plans.map(p => `<div class="pc-plan ${p.highlight ? "best" : ""}">${p.highlight ? `<span class="pc-best">${t("storeBest")}</span>` : ""}
      <h2>${esc(p.name[lang()])}</h2><div class="price">${p.price} ${esc(cfg.currency)}</div>
      <ul>${p.features[lang()].map(x => `<li>${ic.check}<span>${esc(x)}</span></li>`).join("")}</ul>
      <button class="btn block big ${p.highlight ? "" : "blue"}" data-plan="${p.id}">${t("storeBuy")}</button></div>`).join("")}</div>
    <p class="pc-err" id="err" hidden role="alert"></p></div>`;
  $(".app").classList.add("no-dock");
  $("#stepBack").onclick = () => nav("#/s/" + s.slug);
  $$("[data-plan]").forEach(b => b.onclick = async () => {
    const label = b.textContent;
    $$("[data-plan]").forEach(x => x.classList.add("off")); b.textContent = t("storeBuying"); $("#err").hidden = true;
    try {
      await api("buy", { session: s.token, plan: b.dataset.plan });
      resetCourse();
      confetti(); sfx.done(); toast(t("unlockDone"));
      nav("#/s/" + s.slug);
    } catch (e) { fail($("#err"), e); $$("[data-plan]").forEach(x => x.classList.remove("off")); b.textContent = label; }
  });
}

/* ---------- privacy ---------- */
async function viewPrivacy() {
  hideNav();
  const op = (await storeConfig().catch(() => ({}))).operator || {};
  const who = op.name ? `${esc(op.name)}${op.email ? `, <a href="mailto:${esc(op.email)}">${esc(op.email)}</a>` : ""}` : t("privOperatorTbd");
  view().innerHTML = `<div class="session-top"><button class="x" id="stepBack" aria-label="${t("back")}">${ic.x}</button></div>
    <div class="pc-step pc-privacy"><h1>${t("privTitle")}</h1><p class="pc-note">${t("privVersion")}</p>
    ${[1, 2, 3, 4, 5, 6].map(n => `<h2>${t("privH" + n)}</h2><p>${t("privP" + n)}</p>`).join("")}
    <h2>${t("privOperator")}</h2><p>${who}</p></div>`;
  $(".app").classList.add("no-dock");
  $("#stepBack").onclick = () => history.length > 1 ? history.back() : nav("#/");
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
// What's being built, how long it should take, and which lesson it's on.
function buildHtml(status, build, free) {
  if (!build || ["ready", "free_ready", "failed"].includes(status)) return "";
  const buildMinutes = free ? () => "1–2" : buildMinutesOf;
  const p = status === "building" ? build.progress : null, pages = p?.pages || build.pages || 0;
  const stale = p && build.progressAge > 180;
  const files = build.files.length ? `<ul class="pc-build-files">${build.files.slice(0, 3).map(f => `<li>${esc(f)}</li>`).join("")}${build.files.length > 3 ? `<li>+${build.files.length - 3}</li>` : ""}</ul>` : "";
  const time = stale ? t("buildStale") : p ? (p.etaSeconds > 0 ? minutesLeft(p.etaSeconds) : t("buildAlmost")) : status === "building" ? t("buildTotal").replace("%", buildMinutes(pages)) : t("buildQueued").replace("%", buildMinutes(pages));
  const pct = p?.total ? Math.round(p.done / p.total * 100) : 0;
  const lessons = p?.lessons || [];
  return `<div class="pc-build"><span>${t("buildWhat")}</span>
    ${p?.title ? `<b>${esc(p.title)}</b>` : ""}
    <p>${[build.files.length ? fileCount(build.files.length) : "", pages ? pagesTxt(pages) : "", lessons.length ? lessonCount(lessons.length) : ""].filter(Boolean).join(" · ")}</p>
    ${lessons.length ? "" : files}
    <p class="pc-build-time">${time}</p>
    ${p ? `<div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><p class="pc-build-stage">${t("buildStage_" + p.stage)}</p>` : ""}
    ${lessons.length ? `<ul class="pc-build-lessons">${lessons.map(l => `<li class="${l.done ? "done" : ""}"><i>${l.done ? ic.check : ""}</i>${esc(l.title)}</li>`).join("")}</ul>` : ""}
  </div>`;
}
async function viewWait() {
  hideNav();
  const s = session(); if (!s) return nav("#/login");
  let painted = null;
  const paint = r => {
    const { status, student, build } = r, free = !r.paid, ready = !!r.course, failed = !ready && status === "failed";
    const tutor = student ? student.tutor || "penny" : null, key = [status, tutor, ready, free].join();
    const shown = ready ? (free ? "free_ready" : "ready") : status;
    if (painted === key && $("#pcLive")) { $("#pcLive").innerHTML = stepsHtml(shown, build) + buildHtml(shown, build, free); return; } // keeps the mascot animation running
    painted = key;
    const code = store.get("code");
    const title = ready ? (free ? "waitFreeReady" : "waitReady") : failed ? "waitFailed" : free ? (status === "free_queued" ? "waitFreeQueued" : "waitFreeTitle") : status === "paid_test" ? "waitQueued" : "waitTitle";
    const sub = ready ? (free ? "waitFreeReadySub" : "waitReadySub") : failed ? "waitFailedSub" : free ? "waitFreeSub" : "waitSub";
    view().innerHTML = `<div class="pc-wait"><div class="pc-land-top"><span class="pc-badge">${t("testBadge")}</span>${langToggle()}</div>
      <div class="pc-hero ${ready ? "" : "working"}">${tutor ? tutorArt(tutor, "bob") : ""}</div>
      <h1>${t(title)}</h1><p class="pc-sub">${t(sub)}</p>
      ${failed ? "" : `<div id="pcLive">${stepsHtml(shown, build) + buildHtml(shown, build, free)}</div>`}
      ${code ? `<div class="pc-code"><span>${t("codeTitle")}</span><b id="codeV">${esc(code)}</b><button class="btn ghost sm" id="copy">${ic.copy} ${t("codeCopy")}</button><small>${t("codeSave")}</small></div>` : ""}
      </div>${ready ? `<div class="dock"><div class="dock-in"><a class="btn block big" href="#/s/${esc(s.slug)}" id="startCourse">${t(free ? "waitFreeStart" : "waitStart")}</a></div></div>` : ""}`;
    bindLang();
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

/* ---------- router ---------- */
function render() {
  clearTimeout(waitTimer);
  document.querySelectorAll(".feedback,.confetti").forEach(e => e.remove());
  window.onkeydown = null;
  const app = $(".app"); app.classList.remove("no-dock");
  const h = location.hash.replace(/^#/, "") || "/";
  const parts = h.split("/").filter(Boolean);
  window.scrollTo(0, 0);
  if (!parts.length) return viewLanding();
  if (parts[0] === "start") return viewInvite();
  if (parts[0] === "login") return parts[1] === "code" ? viewCodeLogin() : viewLogin();
  if (parts[0] === "wait") return viewWait();
  if (parts[0] === "unlock") return viewUnlock();
  if (parts[0] === "privacy") return viewPrivacy();
  if (parts[0] === "new") {
    hideNav();
    const d = draft();
    if (!d) return nav("#/start");
    const step = d.slug ? "account" : parts[1] || d.step; // once the free lessons are queued, the setup can't change
    if (step !== (parts[1] || d.step)) return nav("#/new/" + step);
    if (STEPS.indexOf(step) > STEPS.indexOf(d.step || "files")) return nav("#/new/" + (d.step || "files"));
    const stepView = { files: viewFiles, tutor: viewTutor, date: viewDate, time: viewTime, account: viewAccount }[step];
    return stepView ? stepView() : nav("#/");
  }
  if (parts[0] === "s") return courseRoute(parts.slice(1), nav, render);
  nav("#/");
}
addEventListener("hashchange", render);
setLang(lang());
render();
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => { });
