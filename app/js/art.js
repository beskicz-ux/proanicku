// Tutor art, drawing code copied from Penny (hamster and the six teachers). Names are subject-neutral here; scenes are left out.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
const BODYMOVE = [], SCENES_FN = [];
function shade(hex, p) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v + 255 * p / 100))); return "#" + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, "0")).join(""); }
const TEACHERS = [
  { n: "Bára", kind: "bear", c: "#c07a45", c2: "#f6dcc0", acc: "bowler", prop: "pointer" },
  { n: "Emil", kind: "fox", c: "#ff8a3d", c2: "#fff1e2", acc: "glasses", prop: "chart" },
  { n: "Oskar", kind: "cat", c: "#7f8ea8", c2: "#eef2f8", acc: "tie", prop: "pointer" },
  { n: "Rozárka", kind: "pig", c: "#ff9cb4", c2: "#ffe4eb", acc: "scarf", prop: "balloon" },
  { n: "Kvido", kind: "frog", c: "#5bc236", c2: "#e4ffd2", acc: "bow", prop: "chart" },
  { n: "Mia", kind: "panda", c: "#ffffff", c2: "#f1f1f1", acc: "grad", prop: "scale" },
];
let TEACHER_ID = 0;
function teacher(i, cls = "", scene = false) {
  const t = TEACHERS[i % TEACHERS.length]; const K = t.kind, c = t.c, c2 = t.c2, ink = "#2b2b2b";
  const dark = K === "panda" ? ink : shade(c, -28);
  let ears = "", face = "", top = "";
  if (K === "bear") ears = `<circle cx="30" cy="44" r="13" fill="${c}"/><circle cx="90" cy="44" r="13" fill="${c}"/><circle cx="30" cy="44" r="6.5" fill="${c2}"/><circle cx="90" cy="44" r="6.5" fill="${c2}"/>`;
  if (K === "panda") ears = `<circle cx="30" cy="44" r="13" fill="${ink}"/><circle cx="90" cy="44" r="13" fill="${ink}"/>`;
  if (K === "fox") ears = `<path d="M24 58L28 20 54 44z" fill="${c}"/><path d="M96 58L92 20 66 44z" fill="${c}"/><path d="M31 50l2-20 13 13z" fill="${c2}"/><path d="M89 50l-2-20-13 13z" fill="${c2}"/>`;
  if (K === "cat") ears = `<path d="M26 56L30 26 52 44z" fill="${c}"/><path d="M94 56L90 26 68 44z" fill="${c}"/><path d="M33 50l1.5-15 10 9z" fill="#ffb3c6"/><path d="M87 50l-1.5-15-10 9z" fill="#ffb3c6"/>`;
  if (K === "pig") ears = `<ellipse cx="32" cy="42" rx="13" ry="9" fill="${dark}" transform="rotate(-38 32 42)"/><ellipse cx="88" cy="42" rx="13" ry="9" fill="${dark}" transform="rotate(38 88 42)"/>`;
  if (K === "frog") ears = `<circle cx="42" cy="42" r="15" fill="${c}"/><circle cx="78" cy="42" r="15" fill="${c}"/>`;
  const ey = K === "frog" ? 40 : 70;
  const eyes = K === "frog"
    ? `<circle cx="42" cy="40" r="9" fill="#fff"/><circle cx="78" cy="40" r="9" fill="#fff"/><circle class="pup" cx="43" cy="42" r="5" fill="${ink}"/><circle class="pup" cx="79" cy="42" r="5" fill="${ink}"/><circle cx="45" cy="39" r="1.8" fill="#fff"/><circle cx="81" cy="39" r="1.8" fill="#fff"/>`
    : `${K === "panda" ? `<ellipse cx="45" cy="71" rx="13" ry="11" fill="${ink}" transform="rotate(-18 45 71)"/><ellipse cx="75" cy="71" rx="13" ry="11" fill="${ink}" transform="rotate(18 75 71)"/>` : ""}
       <g><ellipse cx="46" cy="${ey}" rx="8.5" ry="9.5" fill="#fff"/><ellipse cx="74" cy="${ey}" rx="8.5" ry="9.5" fill="#fff"/>
       <circle cx="47" cy="${ey + 2}" r="5" fill="${ink}"/><circle cx="75" cy="${ey + 2}" r="5" fill="${ink}"/><circle cx="49" cy="${ey - .5}" r="1.8" fill="#fff"/><circle cx="77" cy="${ey - .5}" r="1.8" fill="#fff"/></g>`;
  if (K === "bear" || K === "panda") face = `<ellipse cx="60" cy="88" rx="13" ry="9" fill="${K === "panda" ? "#fff" : c2}"/><ellipse cx="60" cy="84" rx="5" ry="3.5" fill="${ink}"/><path d="M54 90q6 5 12 0" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (K === "fox") face = `<path d="M44 82q16 16 32 0q-4 14-16 14t-16-14z" fill="${c2}"/><ellipse cx="60" cy="85" rx="4.5" ry="3.2" fill="${ink}"/><path d="M55 91q5 4 10 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (K === "cat") face = `<path d="M57 83h6l-3 3.5z" fill="#ff7a9c"/><path d="M55 89q5 4 10 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/><g stroke="${ink}" stroke-width="1.6" opacity=".5" stroke-linecap="round"><path d="M40 84l-12-2M40 88l-12 2M80 84l12-2M80 88l12 2"/></g>`;
  if (K === "pig") face = `<ellipse cx="60" cy="87" rx="12" ry="8.5" fill="${dark}"/><ellipse cx="56" cy="87" rx="2.4" ry="3.2" fill="#b4566f"/><ellipse cx="64" cy="87" rx="2.4" ry="3.2" fill="#b4566f"/><path d="M54 98q6 4 12 0" stroke="${ink}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  if (K === "frog") face = `<path d="M40 70q20 16 40 0" stroke="${shade(c, -45)}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const cheeks = K === "frog" ? `<circle cx="34" cy="66" r="5" fill="#ff8fa8" opacity=".5"/><circle cx="86" cy="66" r="5" fill="#ff8fa8" opacity=".5"/>` : `<circle cx="34" cy="84" r="5.5" fill="#ff8fa8" opacity=".45"/><circle cx="86" cy="84" r="5.5" fill="#ff8fa8" opacity=".45"/>`;
  if (t.acc === "bowler") top = `<path d="M40 38q0-18 20-18t20 18z" fill="#3b3b3b"/><ellipse cx="60" cy="38" rx="27" ry="5.5" fill="#2b2b2b"/><rect x="40" y="31" width="40" height="4" fill="#c0392b"/>`;
  if (t.acc === "grad") top = `<g transform="rotate(-8 60 30)"><path d="M28 30l32-13 32 13-32 12z" fill="#3c3c3c"/><path d="M42 35v9q18 8 36 0v-9l-18 7z" fill="#2b2b2b"/><path d="M92 30v16" stroke="#ffc800" stroke-width="2.4"/><circle cx="92" cy="48" r="3.4" fill="#ffc800"/></g>`;
  if (t.acc === "bow") top = `<path d="M60 26l-12-7v14zM60 26l12-7v14z" fill="#ff4b4b"/><circle cx="60" cy="26" r="3.4" fill="#ea2b2b"/>`;
  let neck = "";
  if (t.acc === "glasses") face += `<g fill="none" stroke="${ink}" stroke-width="2.6"><circle cx="46" cy="70" r="11"/><circle cx="74" cy="70" r="11"/><path d="M57 70h6"/></g>`;
  if (t.acc === "tie") neck = `<path d="M54 104h12l-3 4 4 14-7 6-7-6 4-14z" fill="#ff4b4b"/>`;
  if (t.acc === "scarf") neck = `<path d="M30 102q30 12 60 0l-2 9q-28 10-56 0z" fill="#1cb0f6"/><path d="M76 108l6 16-9 1-3-14z" fill="#1899d6"/>`;
  const P = {
    coin: `<g transform="translate(96 96)"><circle r="12" fill="#ffc800" stroke="#e5a400" stroke-width="3"/><text y="5" text-anchor="middle" font-size="13" font-weight="900" fill="#b07800" font-family="Nunito,sans-serif">Kč</text></g>`,
    note: `<g transform="translate(84 92) rotate(-14)"><rect width="30" height="18" rx="3" fill="#58cc02" stroke="#46a302" stroke-width="2.4"/><circle cx="15" cy="9" r="4.5" fill="#d7ffb8"/></g>`,
    pointer: `<path d="M96 104L116 74" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/><circle cx="116" cy="74" r="3.5" fill="#ff4b4b"/>`,
    balloon: `<path d="M102 100q4-14 2-30" stroke="#777" stroke-width="1.6" fill="none"/><ellipse cx="106" cy="58" rx="11" ry="13" fill="#ff4b4b"/><path d="M106 52v10M102 56l4-4 4 4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/>`,
    chart: `<g transform="translate(86 86) rotate(8)"><rect width="30" height="26" rx="4" fill="#fff" stroke="#1cb0f6" stroke-width="2.6"/><path d="M5 6c3 8 9 13 20 15" stroke="#ff4b4b" stroke-width="2.6" fill="none" stroke-linecap="round"/></g>`,
    scale: `<g transform="translate(100 82)"><path d="M0 0v22M-12 4h24" stroke="#777" stroke-width="2.6" stroke-linecap="round"/><path d="M-16 14q4 6 8 0zM8 14q4 6 8 0z" fill="#ffc800" stroke="#e5a400" stroke-width="1.6"/><path d="M-12 4l-4 10M-12 4l4 10M12 4l-4 10M12 4l4 10" stroke="#999" stroke-width="1"/></g>`,
  }[t.prop] || "";
  const SC = scene ? SCENES_FN[i % SCENES_FN.length]() : "";
  const lidC = K === "panda" ? ink : c, ly = K === "frog" ? 40 : ey, lx = K === "frog" ? [42, 78] : [46, 74], bd = (4.4 + i * .37).toFixed(2);
  // mrkání: víčko sjede shora dolů přes oko (oříznuté tvarem oka) a zase vyjede
  const er = K === "frog" ? [9, 9] : [8.5, 9.5], bt = (4.6 + i * .43).toFixed(2), uid = "e" + (++TEACHER_ID);
  const lids = lx.map((x, n) => { const top = ly - er[1] - 2.2, bot = ly + er[1] + 2.2, meet = ly + er[1] * .3;
    const kt = 'keyTimes="0;.9;.93;.95;.98;1"', D = `dur="${bt}s" repeatCount="indefinite"`;
    const mv = d => `<animateTransform attributeName="transform" type="translate" ${D} ${kt} values="0 0;0 0;0 ${d.toFixed(1)};0 ${d.toFixed(1)};0 0;0 0"/>`;
    return `<clipPath id="${uid}${n}"><ellipse cx="${x}" cy="${ly}" rx="${er[0] + .6}" ry="${er[1] + .6}"/></clipPath>
    <g clip-path="url(#${uid}${n})">
      <g>${mv(meet - bot)}<rect x="${x - 12}" y="${bot}" width="24" height="26" fill="${lidC}"/></g>
      <g>${mv(meet - top)}<rect x="${x - 12}" y="${top - 26}" width="24" height="26.4" fill="${lidC}"/><path d="M${x - 10.5} ${top}q10.5 4.5 21 0" stroke="${K === "panda" ? "#000" : shade(lidC, -55)}" stroke-width="2.8" fill="none" stroke-linecap="round"/></g></g>`; }).join("");
  const bob = scene ? `<animateTransform attributeName="transform" type="translate" dur="3.2s" repeatCount="indefinite" keyTimes="0;.5;1" values="0 0;0 -4;0 0"/>` : "";
  return `<svg class="teacher ${cls} ${scene ? "scene sc" + i : ""}" viewBox="${scene ? "0 0 196 134" : "0 0 124 134"}" aria-label="${esc(t.n)}" role="img">
<ellipse class="tsh" cx="62" cy="128" rx="34" ry="5.5" fill="#000" opacity=".12"/>
<g class="tj">${scene ? BODYMOVE[i % BODYMOVE.length] : ""}<g class="${scene ? "tbs" : "tbody"}">${bob}${ears}
<ellipse cx="60" cy="80" rx="42" ry="44" fill="${c}" ${K === "panda" ? `stroke="#d9d9d9" stroke-width="2"` : ""}/>
<ellipse cx="60" cy="100" rx="26" ry="20" fill="${c2}"/>
<ellipse cx="22" cy="98" rx="8" ry="12" fill="${K === "panda" ? ink : shade(c, -8)}" transform="rotate(20 22 98)"/>
<ellipse cx="98" cy="98" rx="8" ry="12" fill="${K === "panda" ? ink : shade(c, -8)}" transform="rotate(-20 98 98)"/>
<ellipse cx="44" cy="122" rx="11" ry="6" fill="${K === "panda" ? ink : dark}"/><ellipse cx="76" cy="122" rx="11" ry="6" fill="${K === "panda" ? ink : dark}"/>
<g fill="${K === "panda" ? "#555" : c2}" opacity=".7"><ellipse cx="44" cy="123" rx="4.5" ry="2.6"/><ellipse cx="76" cy="123" rx="4.5" ry="2.6"/></g>
${neck}${eyes}${lids}${cheeks}${face}${top}${scene ? "" : P}</g></g>${SC}</svg>`;
}

/* Scénky učitelů: klid → akce → zase klid (SMIL animace — fungují stejně v Safari i Chrome) */
const kf = (dur, fr) => `dur="${dur}s" repeatCount="indefinite" keyTimes="${fr.map(f => Math.min(1, Math.max(0, f[0] / dur)).toFixed(4)).join(";")}" values="${fr.map(f => f[1]).join(";")}"`;
const aT = (type, dur, fr) => `<animateTransform attributeName="transform" type="${type}" ${kf(dur, fr)}/>`;
const aA = (attr, dur, fr) => `<animate attributeName="${attr}" ${kf(dur, fr)}/>`;
let HAM_ID = 0;
function ham(mood = "open", cls = "") {
  const f = "fur" + (++HAM_ID);
  return `<svg class="ham m-${mood} ${cls}" viewBox="0 0 200 200" aria-hidden="true">
<defs><radialGradient id="${f}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#e9a45c"/><stop offset="1" stop-color="#da8c46"/></radialGradient></defs>
<ellipse cx="100" cy="187" rx="58" ry="8" fill="#000" opacity=".25"/>
<g class="body">
<ellipse cx="58" cy="56" rx="20" ry="19" fill="#d98a43"/><ellipse cx="58" cy="57" rx="11" ry="10" fill="#ff8fa8"/>
<ellipse cx="142" cy="56" rx="20" ry="19" fill="#d98a43"/><ellipse cx="142" cy="57" rx="11" ry="10" fill="#ff8fa8"/>
<path d="M100 44c46 0 74 34 74 76 0 42-30 64-74 64s-74-22-74-64c0-42 28-76 74-76z" fill="url(#${f})"/>
<path d="M100 100c30 0 46 20 46 43 0 25-18 39-46 39s-46-14-46-39c0-23 16-43 46-43z" fill="#fff1df"/>
<ellipse cx="54" cy="114" rx="24" ry="20" fill="#fff1df"/><ellipse cx="146" cy="114" rx="24" ry="20" fill="#fff1df"/>
<ellipse cx="56" cy="110" rx="10" ry="6" fill="#ff8fa8" opacity=".55"/><ellipse cx="144" cy="110" rx="10" ry="6" fill="#ff8fa8" opacity=".55"/>
<g class="e-open"><circle cx="76" cy="88" r="9" fill="#2b0c15"/><circle cx="124" cy="88" r="9" fill="#2b0c15"/><circle cx="79" cy="85" r="3" fill="#fff"/><circle cx="127" cy="85" r="3" fill="#fff"/></g>
<g class="e-happy" fill="none" stroke="#2b0c15" stroke-width="5" stroke-linecap="round"><path d="M67 91q9-11 18 0"/><path d="M115 91q9-11 18 0"/></g>
<g class="e-sad"><circle cx="76" cy="92" r="8" fill="#2b0c15"/><circle cx="124" cy="92" r="8" fill="#2b0c15"/><path d="M66 78l18 6M134 78l-18 6" stroke="#2b0c15" stroke-width="4" stroke-linecap="round"/></g>
<path d="M94 102h12l-6 7z" fill="#d9475f"/>
<g class="mouth-s"><path d="M96.2 111h7.6v5.6q0 2.6-2.4 2.6h-2.8q-2.4 0-2.4-2.6z" fill="#fff" stroke="#e2c9b4" stroke-width="1"/><path d="M100 112.5v6.4" stroke="#e2c9b4" stroke-width="1"/><path d="M100 109q-6 8-13 3M100 109q6 8 13 3" fill="none" stroke="#4a1a26" stroke-width="3" stroke-linecap="round"/></g>
<ellipse class="mouth-o" cx="100" cy="117" rx="6" ry="7" fill="#4a1a26"/>
<g stroke="#4a1a26" stroke-width="2" stroke-linecap="round" opacity=".45"><path d="M34 106l-18-4M34 114l-18 2M166 106l18-4M166 114l18 2"/></g>
<g class="book"><path d="M66 137q17-5 34 3q17-8 34-3v32q-17-5-34 3q-17-8-34-3z" fill="#5a3cc4"/>
<path d="M70 133q15-4 30 3v31q-15-7-30-3z" fill="#fff"/><path d="M130 133q-15-4-30 3v31q15-7 30-3z" fill="#f1edff"/>
<g stroke="#c9c0f2" stroke-width="2" stroke-linecap="round" fill="none"><path d="M76 142q9-1 18 2M76 149q9-1 18 2M76 156q9-1 13 1"/><path d="M106 144q9-3 18-2M106 151q9-3 18-2M106 158q6-2 13-2"/></g>
<path d="M100 136v31" stroke="#4a32b0" stroke-width="1.6"/></g>
<ellipse cx="68" cy="152" rx="9" ry="8" fill="#f6c99a"/><ellipse cx="132" cy="152" rx="9" ry="8" fill="#f6c99a"/>
<ellipse cx="74" cy="183" rx="14" ry="7" fill="#f6c99a"/><ellipse cx="126" cy="183" rx="14" ry="7" fill="#f6c99a"/>
<g transform="rotate(-8 100 34)"><path d="M58 30l42-18 42 18-42 17z" fill="#7a5ae6"/><path d="M75 37v12q25 11 50 0V37l-25 10z" fill="#5a3cc4"/><path d="M142 30v22" stroke="#f4cf96" stroke-width="3"/><circle cx="142" cy="54" r="4.5" fill="#f4cf96"/></g>
</g></svg>`;
}
export { ham, teacher, TEACHERS };
