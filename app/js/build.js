// The live build, shared by the wait page (first lessons) and the map card (the rest of a paid course).
// Everything shown is a real signal from pc-api: a cloud run started or checked in, the builder's stage, lessons written.
// The bar creeps toward the next real milestone (never past it) so it never stalls, and jumps when a milestone is reached.
import { t } from "./i18n.js";
import { ic } from "./util.js";

export const QUEUED = ["free_queued", "paid_test"];
// Share of the bar each phase covers, and how long it usually takes (s); lessons are split by done/total.
const SPAN = { queued: [0, .06, 60], boot: [.03, .1, 25], reading: [.1, .16, 10], outline: [.16, .34, 45], lessons: [.34, .95, 60], checking: [.34, .95, 30], publishing: [.95, .99, 8] };
const STEP_OF = { queued: 2, boot: 2, reading: 3, outline: 3, lessons: 4, checking: 4, publishing: 4, done: 6 };
export const stepOf = phase => STEP_OF[phase] || 2;

// Where the build really is. "reading" also counts while still queued: the builder reports it before it changes the status.
export function phaseOf(status, r) {
  const b = r.build, p = b?.progress;
  if (["ready", "free_ready"].includes(status)) return "done";
  if (status === "failed") return "failed";
  if (status === "building") return p && p.stage !== "reading" && SPAN[p.stage] ? p.stage : "reading";
  if (QUEUED.includes(status) && p?.stage === "reading" && b.progressAge != null && b.progressAge < 120) return "reading";
  const w = r.worker;
  if (w && ((w.kicked != null && w.kicked < 180) || (w.seen != null && w.seen < 60))) return "boot"; // a cloud run was started, or a builder is up
  return "queued";
}

// Small animated pictures, one per step, shown in the circle of the step that is running.
const SV = body => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const STEP_ICON = {
  2: SV(`<g class="si-gear"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></g>`),
  3: SV(`<path d="M7 3h7l4 4v14H7z"/><path class="si-scan" d="M5 9h15"/>`),
  4: SV(`<path d="M5 19h6" class="si-line"/><g class="si-pen"><path d="M14.5 5.5l4 4L9 19H5v-4z"/></g>`),
  5: SV(`<path class="si-star" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>`),
};
// prev: the phase shown last time, so steps that just finished get the pop-and-draw animation once.
export function stepsHtml(phase, p, prev) {
  const ls = p?.lessons || [], now = stepOf(phase), before = prev ? stepOf(prev) : now;
  const n = ls.length && now === 4 ? ` <small>${ls.filter(l => l.done).length}/${ls.length}</small>` : "";
  return `<ol class="pc-steps">${["waitS1", "waitSBoot", "waitS2", "waitS3", "waitS4"].map((k, i) => {
    const step = i + 1, done = step < now, cur = step === now && phase !== "queued";
    const cls = [done ? "done" : cur ? "now" : "", done && step >= before ? "just" : ""].join(" ").trim();
    return `<li class="${cls}" style="--d:${Math.max(0, step - before) * 220}ms"><i>${done ? ic.check : cur && STEP_ICON[step] ? STEP_ICON[step] : step}</i><span>${t(k)}${step === 4 ? n : ""}</span></li>`;
  }).join("")}</ol>`;
}
export const iconFor = phase => STEP_ICON[stepOf(phase)] || STEP_ICON[2];

// The bar's width (0..1) for a phase entered at phaseAt: eases from the phase's start toward its end over its usual time.
export function barTarget(phase, p, phaseAt) {
  if (phase === "done") return 1;
  let [a, b, secs] = SPAN[phase] || SPAN.queued;
  if ((phase === "lessons" || phase === "checking") && p?.total > 1) {
    const step = (b - a) / p.total;
    a += step * Math.max(0, p.done || 0); b = Math.min(b, a + step);
    secs = p.etaSeconds > 0 ? Math.max(8, p.etaSeconds / Math.max(1, p.total - p.done)) : 30;
  }
  const t0 = (Date.now() - phaseAt) / 1000;
  return a + (b - a) * (1 - Math.exp(-t0 / (secs / 1.6)));
}
// When this phase started, as far as we know: for the builder's own stages, minus how old its last report is (up to a minute).
export const phaseStart = (phase, build) => Date.now() - (["outline", "lessons", "checking", "publishing"].includes(phase) ? Math.min(60, build?.progressAge || 0) * 1000 : 0);
export const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export const stageText = phase => phase === "boot" ? t("buildBooting") : phase === "queued" ? "" : t("buildStage_" + phase);
