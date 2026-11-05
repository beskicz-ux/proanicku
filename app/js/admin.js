// Admin page: courses, students, last activity, voice minutes, code reset. The key stays in memory only, so a reload asks again.
import { esc, api } from "./util.js";

const root = document.getElementById("ad");
let key = null, data = null, note = "";
const call = (name, body = {}) => api("admin_" + name, { adminKey: key, ...body });
const when = v => v ? new Date(v).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" }) : "–";
const mins = s => `${Math.round((s || 0) / 60)}`;
const total = c => ["flashcard", "mc", "tf", "fill", "match"].reduce((n, k) => n + (c?.[k] || 0), 0);

function login(err = "") {
  root.innerHTML = `<h1>Penny admin</h1><form class="ad-login" id="f"><input id="k" type="password" autocomplete="off" placeholder="Admin key" aria-label="Admin key"><button class="btn block">Open</button><p class="ad-err" role="alert">${esc(err)}</p></form>`;
  document.getElementById("f").onsubmit = async e => {
    e.preventDefault();
    key = document.getElementById("k").value.trim();
    try { await load(); } catch (er) { key = null; login(er.code === "too_many" ? "Too many tries. Wait 10 minutes." : "That key doesn't work."); }
  };
}
async function load() { data = await call("overview"); paint(); }

const stageText = o => {
  if (o.status !== "building" || !o.progress) return "";
  const age = o.progress_at ? Math.round((Date.now() - new Date(o.progress_at)) / 60000) : 0;
  return ` · ${esc(o.progress.stage)} ${o.progress.done}/${o.progress.total}${age >= 3 ? ` · no update for ${age} min` : ""}`;
};
function paint() {
  const bySlug = {};
  for (const s of data.students) (bySlug[s.slug] ||= []).push(s);
  root.innerHTML = `<h1>Penny admin</h1>${note ? `<div class="ad-note">${note}</div>` : ""}
  <h2>Orders (${data.orders.length})</h2>
  <div class="ad-scroll"><table><tr><th>Status</th><th>Course</th><th>Plan</th><th>Files</th><th>Bought</th><th>Ready</th></tr>
  ${data.orders.map(o => `<tr><td>${esc(o.status)}${stageText(o)}</td><td>${esc(o.slug || "–")}</td><td>${esc(o.plan_id || "–")}</td><td>${esc(o.files.join(", "))}${o.pages ? ` <span class="ad-muted">~${o.pages} pp</span>` : ""}</td><td>${when(o.paid_at)}</td><td>${when(o.ready_at)}</td></tr>`).join("")}</table></div>
  <h2>Courses (${data.courses.length})</h2>
  <div class="ad-scroll"><table><tr><th>Course</th><th>Items</th><th>Version</th><th>Students</th><th>Voice</th><th></th></tr>
  ${data.courses.map(c => `<tr><td><b>${esc(c.title)}</b><br><span class="ad-muted">${esc(c.slug)}</span></td><td>${total(c.counts)}</td><td>${c.version}</td><td>${(bySlug[c.slug] || []).length}</td><td>${c.voice ? (c.voice_agent_id ? "on" : "on, no agent yet") : "off"}</td><td><button data-voice="${esc(c.slug)}" data-on="${c.voice ? "" : "1"}">${c.voice ? "Turn voice off" : "Turn voice on"}</button></td></tr>`).join("")}</table></div>
  <h2>Students (${data.students.length})</h2>
  <div class="ad-scroll"><table><tr><th>Course</th><th>Tutor</th><th>Exam</th><th>Joined</th><th>Last activity</th><th>Voice min</th><th></th></tr>
  ${data.students.map(s => `<tr><td>${esc(s.slug)}</td><td>${esc(s.tutor_id || "–")}</td><td>${esc(s.exam_date || "–")}</td><td>${when(s.created_at)}</td><td>${when(s.lastActivity)}</td><td>${mins(s.voiceUsedSeconds)} of ${mins(s.voice_cap_seconds)}${s.voiceUnsettled ? ` <span class="ad-muted">(${s.voiceUnsettled} unsettled)</span>` : ""}</td><td><button data-reset="${esc(s.id)}">Reset code</button><button data-grant="${esc(s.id)}">+60 min</button></td></tr>`).join("")}</table></div>`;
  note = "";
  root.querySelectorAll("[data-reset]").forEach(b => b.onclick = async () => {
    if (!confirm("New code for this student? The old code and open sessions stop working.")) return;
    await act(async () => { const { code } = await call("code_reset", { studentId: b.dataset.reset }); note = `New code, shown once: <span class="ad-code">${esc(code)}</span>`; });
  });
  root.querySelectorAll("[data-grant]").forEach(b => b.onclick = () => act(async () => { const { capSeconds } = await call("voice_grant", { studentId: b.dataset.grant, seconds: 3600 }); note = `Voice cap is now ${mins(capSeconds)} min.`; }));
  root.querySelectorAll("[data-voice]").forEach(b => b.onclick = () => act(async () => { await call("course_voice", { slug: b.dataset.voice, voice: !!b.dataset.on }); note = `Voice ${b.dataset.on ? "on" : "off"} for ${esc(b.dataset.voice)}.`; }));
}
async function act(fn) {
  try { await fn(); await load(); }
  catch (e) { note = `<span class="ad-err">Failed: ${esc(e.code || e.message)}</span>`; paint(); }
}
login();
