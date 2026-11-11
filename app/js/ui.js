// Redesign pieces shared by the onboarding and the course: tab icons, metric icons, settings icons, flags, the language list,
// the level icon set, colour mixing and the bottom sheet. SVGs are copied from design/mockup3.html and design/settings.html.
import { $, esc, store } from "./util.js";
import { t, lang, setLang } from "./i18n.js";

/* ---------- colours ---------- */
const hx = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const mix = (a, b, t) => "#" + hx(a).map((v, i) => Math.round(v + (hx(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
// One colour per chapter, from the palette tokens --ch1..--ch6 in app.css.
export const CHAPTER_COLOURS = [1, 2, 3, 4, 5, 6].map(n => `var(--ch${n})`);
export const chapterColour = i => CHAPTER_COLOURS[i % CHAPTER_COLOURS.length];

/* ---------- tab bar (4 chunky icons, no labels) ---------- */
export const TAB_ICONS = {
  home: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 19 20 10.5 31 19v13a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z" fill="#E8B23A"/><path d="M9 18 20 9.5 31 18v12a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z" fill="#FFD25C"/><path d="M4.5 19.5 20 6.5l15.5 13a2.6 2.6 0 0 1-3.3 4L20 13.3 7.8 23.5a2.6 2.6 0 0 1-3.3-4z" fill="#C93A2B"/><path d="M4.5 18 20 5l15.5 13a2.6 2.6 0 0 1-3.3 4L20 11.8 7.8 22a2.6 2.6 0 0 1-3.3-4z" fill="#FF5A47"/><path d="M15.5 34v-6.5a4.5 4.5 0 0 1 9 0V34z" fill="#B8642A"/><circle cx="20" cy="22" r="2.6" fill="#B8642A"/></svg>`,
  notes: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="6" width="26" height="31" rx="5" fill="#1E5BD6"/><rect x="8" y="4" width="26" height="31" rx="5" fill="#3B8BFF"/><rect x="13" y="9" width="17" height="21" rx="2.5" fill="#fff"/><rect x="16" y="13" width="11" height="3" rx="1.5" fill="#3B8BFF"/><rect x="16" y="18.5" width="11" height="3" rx="1.5" fill="#BFD7FF"/><rect x="16" y="24" width="7" height="3" rx="1.5" fill="#BFD7FF"/><rect x="5" y="9" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/><rect x="5" y="17.5" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/><rect x="5" y="26" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/></svg>`,
  review: `<svg viewBox="0 0 40 40" aria-hidden="true"><g transform="rotate(12 26 19)"><rect x="16" y="5" width="19" height="25" rx="4.5" fill="#7BD9B0"/></g><rect x="6" y="11" width="20" height="26" rx="4.5" fill="#128A5E"/><rect x="6" y="9" width="20" height="26" rx="4.5" fill="#22C07F"/><path d="M11 22.5l3.6 3.6 6.6-7.4" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  progress: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 9H6.5a1.5 1.5 0 0 0-1.5 1.7C5.6 15.5 8.5 19 13 19.5M29 9h4.5a1.5 1.5 0 0 1 1.5 1.7C34.4 15.5 31.5 19 27 19.5" fill="none" stroke="#E09A10" stroke-width="3.4" stroke-linecap="round"/><path d="M11 6h18v9a9 9 0 0 1-18 0z" fill="#E09A10"/><path d="M11 5h18v8.5a9 9 0 0 1-18 0z" fill="#FFC531"/><path d="M15.5 9v4.5a4.5 4.5 0 0 0 2 3.7" fill="none" stroke="#FFE69A" stroke-width="2.6" stroke-linecap="round"/><path d="M17 22h6l1 5h-8z" fill="#E09A10"/><rect x="10" y="28" width="20" height="9" rx="3" fill="#7C3AED"/><rect x="10" y="27" width="20" height="8" rx="3" fill="#A866FF"/></svg>`,
};

/* ---------- top bar and profile metrics ---------- */
export const ringIcon = (pct, size = 28) => {
  const c = 62.8, on = Math.max(0, Math.min(1, pct / 100)) * c;
  return `<svg viewBox="0 0 28 28" width="${size}" height="${size}" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="#22C07F" stroke-opacity=".22" stroke-width="5"/>${on > .1 ? `<circle cx="14" cy="14" r="10" fill="none" stroke="#22C07F" stroke-width="5" stroke-linecap="round" stroke-dasharray="${on.toFixed(1)} ${c}" transform="rotate(-90 14 14)"/>` : ""}</svg>`;
};
export const calIcon = day => `<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="3" y="6" width="22" height="20" rx="4.5" fill="#D9473A"/><rect x="3" y="5" width="22" height="19" rx="4.5" fill="#fff"/><path d="M3 9.5A4.5 4.5 0 0 1 7.5 5h13A4.5 4.5 0 0 1 25 9.5V11H3z" fill="#FF5A47"/><rect x="8" y="2.5" width="3" height="6" rx="1.5" fill="#B8342A"/><rect x="17" y="2.5" width="3" height="6" rx="1.5" fill="#B8342A"/><text x="14" y="21.6" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="9.5" fill="#2A2F3A">${esc(day)}</text></svg>`;
export const doneIcon = `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="15" r="11" fill="#1E5BD6"/><circle cx="14" cy="13.5" r="11" fill="#3B8BFF"/><path d="M9 13.8l3.4 3.4 6.6-7" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const timeIcon = `<svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="16" r="10.5" fill="#E07A12"/><circle cx="14" cy="14.5" r="10.5" fill="#FF9F2E"/><circle cx="14" cy="14.5" r="7" fill="#FFE2B8"/><path d="M14 10.5v4.3l2.8 1.8" fill="none" stroke="#E07A12" stroke-width="2.4" stroke-linecap="round"/><rect x="11.5" y="1.5" width="5" height="3" rx="1.5" fill="#E07A12"/></svg>`;
export const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>`;
export const CHEV_DOWN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
export const CHEV = `<svg class="ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>`;
export const BACK = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;
export const CLOSE = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
export const SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>`;
export const NOTES_ICON = `<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="7" y="4" width="16" height="20" rx="3.5" fill="#fff"/><rect x="11" y="9" width="8.5" height="2.4" rx="1.2" fill="currentColor"/><rect x="11" y="13.3" width="8.5" height="2.4" rx="1.2" fill="currentColor"/><rect x="11" y="17.6" width="5.5" height="2.4" rx="1.2" fill="currentColor"/><rect x="4" y="7.5" width="5" height="2.6" rx="1.3" fill="#fff"/><rect x="4" y="12.7" width="5" height="2.6" rx="1.3" fill="#fff"/><rect x="4" y="17.9" width="5" height="2.6" rx="1.3" fill="#fff"/></svg>`;

/* ---------- date badges ---------- */
export const PACE_ICONS = {
  sprint: `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>`,
  tempo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M4 18h4l3-12 3 12h6"/></svg>`,
  chill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3"/></svg>`,
};

/* ---------- settings icons ---------- */
const W = 'fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
export const SET_ICONS = {
  date: ["#FF5A47", `<svg viewBox="0 0 24 24" ${W}><rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>`],
  goal: ["#FF8A2B", `<svg viewBox="0 0 24 24" ${W}><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M10 3h4"/></svg>`],
  bell: ["#A866FF", `<svg viewBox="0 0 24 24" ${W}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>`],
  voice: ["#E5446D", `<svg viewBox="0 0 24 24" ${W}><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5v3"/></svg>`],
  lang: ["#3B8BFF", `<svg viewBox="0 0 24 24" ${W}><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3 3.2-3 13.8 0 17M12 3.5c3 3.2 3 13.8 0 17"/></svg>`],
  sound: ["#22C07F", `<svg viewBox="0 0 24 24" ${W}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>`],
  look: ["#334155", `<svg viewBox="0 0 24 24" ${W}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg>`],
  mail: ["#14B8A6", `<svg viewBox="0 0 24 24" ${W}><rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>`],
  pay: ["#F2A516", `<svg viewBox="0 0 24 24" ${W}><rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h4"/></svg>`],
  out: ["#94A3B8", `<svg viewBox="0 0 24 24" ${W}><path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7M10 12h10M17 8.5l3.5 3.5-3.5 3.5"/></svg>`],
};
export const setIcon = k => `<span class="s-ic" style="background:${SET_ICONS[k][0]}">${SET_ICONS[k][1]}</span>`;

/* ---------- level icons: picked from the level's title, so every level has its own topic icon ---------- */
const L = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
export const LEVEL_ICONS = {
  limit: L('<path d="M3 18c5 0 7-12 18-12"/><path d="M17 3l4 3-3 4"/>'),
  inf: L('<path d="M12 12c-2-3-4-4.5-6-4.5a4.5 4.5 0 0 0 0 9c2 0 4-1.5 6-4.5s4-4.5 6-4.5a4.5 4.5 0 0 1 0 9c-2 0-4-1.5-6-4.5z"/>'),
  curve: L('<path d="M3 17c3 0 4-10 9-10s6 10 9 10"/><circle cx="12" cy="7" r="1.6" fill="currentColor"/>'),
  deriv: L('<path d="M4 20L20 4"/><path d="M8 16h8V8"/>'),
  chain: L('<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/>'),
  divide: L('<path d="M5 12h14"/><circle cx="12" cy="6.5" r="1.9" fill="currentColor"/><circle cx="12" cy="17.5" r="1.9" fill="currentColor"/>'),
  tangent: L('<circle cx="12" cy="12" r="6"/><path d="M3 4l18 3"/>'),
  graph: L('<path d="M4 4v16h16"/><path d="M7 15l4-5 3 3 5-7"/>'),
  integral: L('<path d="M15 3c-3 0-3 3-3 9s0 9-3 9"/><path d="M15 3c1.5 0 2 1 2 2M9 21c-1.5 0-2-1-2-2"/>'),
  money: L('<circle cx="12" cy="12" r="8.5"/><path d="M14.8 8.6c-.6-.8-1.6-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2.1 0 3 5.8 1.6 5.8 4.6 0 1.4-1.3 2.3-3 2.3-1.3 0-2.4-.5-3-1.4M12 5.5v13"/>'),
  scale: L('<path d="M12 4v16M6 20h12M4 8h16"/><path d="M4 8l-2.5 6a3 3 0 0 0 5 0zM20 8l-2.5 6a3 3 0 0 0 5 0z"/>'),
  market: L('<path d="M4 9h16l-1.2-4.5H5.2z"/><path d="M5 9v10h14V9M10 19v-5h4v5"/>'),
  people: L('<circle cx="9" cy="8" r="3.2"/><path d="M3 19a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>'),
  law: L('<path d="M4 20h16M6 17V10M10 17V10M14 17V10M18 17V10M3 10l9-6 9 6z"/>'),
  globe: L('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3 3.2-3 13.8 0 17M12 3.5c3 3.2 3 13.8 0 17"/>'),
  flask: L('<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>'),
  atom: L('<circle cx="12" cy="12" r="1.8" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>'),
  leaf: L('<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/>'),
  heart: L('<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.5 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'),
  brain: L('<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3.2 3.2 0 0 0 7 18a3 3 0 0 0 5 1.5V6a2.5 2.5 0 0 0-3-1.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2A3.2 3.2 0 0 1 17 18a3 3 0 0 1-5 1.5"/>'),
  code: L('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  book: L('<path d="M4 5.5A2 2 0 0 1 6 3.5h5v16H6a2 2 0 0 0-2 2zM20 5.5a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2z"/>'),
  clock: L('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
  chart: L('<path d="M5 20V11M10 20V5M15 20v-7M20 20V8"/>'),
  bulb: L('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  sigma: L('<path d="M18 5H6l6 7-6 7h12"/>'),
  test: L('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 12l2.5 2.5L16 9.5"/>'),
  flag: L('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
};
export const TICK = L('<path d="M5 12.5l4.5 4.5L19 7.5" stroke-width="3.4"/>');
// Keywords in several languages; course content stays in the slides' language.
const KEYWORDS = [
  ["limit", /limit|lim\b|konverg|converg/], ["inf", /nekonečn|infinit|unendlich|řad[ay]|series/], ["curve", /spojit|continu|funkc|function|průběh/],
  ["deriv", /deriv|ableitung|diferenc/], ["chain", /složen|chain|kett|vazb|bond|link/], ["divide", /podíl|zlom|quotient|fraction|dělen|divis|poměr|ratio/],
  ["tangent", /tečn|tangent|kruh|circle|geometr/], ["integral", /integr/], ["graph", /graf|graph|růst|growth|trend|vývoj/],
  ["money", /peně|money|měn|currenc|inflac|úrok|interest|bank|cen[ay]|price|nákl|cost|příjm|revenue|daň|tax|zisk|profit/],
  ["scale", /rovnováh|equilib|balanc|nabídk|poptáv|supply|demand/], ["market", /trh|market|firm|podnik|obchod|trade/],
  ["people", /společ|social|soci|lidé|people|psych|chován|behav|populac|demograf/], ["law", /práv|law|zákon|ústav|constit|stát|state|politi|govern/],
  ["globe", /svět|world|geograf|globál|global|mezinár|internat|zem[ěi]|countr|histor|válk|war/], ["flask", /chemi|chem|reakc|reaction|lát|kyselin|acid/],
  ["atom", /fyzik|physic|atom|energ|síl[ay]|force|pohyb|motion|elektr/], ["leaf", /biolog|rostlin|plant|ekolog|ecolog|evoluc|evolut|buň|cell/],
  ["heart", /medic|lék|zdrav|health|anatom|srdc|heart|krev|blood|nemoc|disease/], ["brain", /mozek|brain|neuro|kogni|cognit|pamě|memory|učen|learn/],
  ["code", /program|kód|code|algorit|informat|comput|počítač|data|databáz/], ["sigma", /statist|pravděp|probab|souč|sum|rovnic|equat|algebr|matic|matri|vektor|vector/],
  ["chart", /analý|analys|ukazatel|index|měřen|measur|model/], ["clock", /čas|time|období|period|dějin/], ["bulb", /teori|theor|princip|koncep|concept|úvod|intro|základ|basic/],
];
const FALLBACK = ["book", "bulb", "chart", "graph", "sigma", "globe", "clock", "people"];
export function levelIcon(title, i = 0) {
  const s = String(title || "").toLowerCase();
  for (const [k, re] of KEYWORDS) if (re.test(s)) return LEVEL_ICONS[k];
  return LEVEL_ICONS[FALLBACK[i % FALLBACK.length]];
}

/* ---------- languages and flags (3:2 box, none letterboxed) ---------- */
const star = (cx, cy, r, f) => { let d = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .4 : r; d += (i ? "L" : "M") + (cx + q * Math.cos(a)).toFixed(2) + " " + (cy + q * Math.sin(a)).toFixed(2); } return `<path d="${d}z" fill="${f}"/>`; };
const hb = (...c) => c.map((f, i) => `<rect y="${i * 20 / c.length}" width="30" height="${20 / c.length + .1}" fill="${f}"/>`).join("");
const vb = (...c) => c.map((f, i) => `<rect x="${i * 10}" width="10.1" height="20" fill="${f}"/>`).join("");
const F = s => `<svg viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${s}</svg>`;
export const FLAG = {
  cs: F(`${hb("#fff", "#D7141A")}<path d="M0 0l15 10L0 20z" fill="#11457E"/>`),
  en: F(`<rect width="30" height="20" fill="#012169"/><path d="M-3 -2 33 22M33 -2 -3 22" stroke="#fff" stroke-width="4.5"/><path d="M-3 -2 33 22M33 -2 -3 22" stroke="#C8102E" stroke-width="1.6"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6.5"/><path d="M15 0v20M0 10h30" stroke="#C8102E" stroke-width="3.6"/>`),
  es: F(`<rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/>`),
  zh: F(`<rect width="30" height="20" fill="#EE1C25"/>${star(6, 6, 3.6, "#FFDE00")}${star(11.5, 2.6, 1.1, "#FFDE00")}${star(13.4, 5, 1.1, "#FFDE00")}${star(13.4, 8.2, 1.1, "#FFDE00")}${star(11.5, 10.4, 1.1, "#FFDE00")}`),
  hi: F(`${hb("#FF9933", "#fff", "#138808")}<circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".9"/><circle cx="15" cy="10" r=".7" fill="#000080"/>`),
  ar: F(`<rect width="30" height="20" fill="#006C35"/><path d="M8 7.5h14M9 9.5h12" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/><path d="M8 13.5h14" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`),
  pt: F(`<rect width="30" height="20" fill="#009C3B"/><path d="M15 2.5 27 10 15 17.5 3 10z" fill="#FFDF00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2q4.2-1.4 8.4 1.4" stroke="#fff" stroke-width=".8" fill="none"/>`),
  fr: F(vb("#0055A4", "#fff", "#EF4135")),
  de: F(hb("#000", "#DD0000", "#FFCE00")),
  ru: F(hb("#fff", "#0039A6", "#D52B1E")),
  ja: F(`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#BC002D"/>`),
  id: F(hb("#CE1126", "#fff")),
  tr: F(`<rect width="30" height="20" fill="#E30A17"/><circle cx="11.5" cy="10" r="5" fill="#fff"/><circle cx="12.8" cy="10" r="4" fill="#E30A17"/>${star(18.2, 10, 2.6, "#fff")}`),
  ko: F(`<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5" fill="#0047A0"/><path d="M10 10a5 5 0 0 1 10 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 0-5 0z" fill="#CD2E3A"/><g fill="#000"><rect x="4" y="3" width="4.5" height=".9" transform="rotate(-33 6 4)"/><rect x="4.5" y="4.6" width="4.5" height=".9" transform="rotate(-33 6 4)"/><rect x="21.5" y="15" width="4.5" height=".9" transform="rotate(-33 24 16)"/><rect x="21" y="16.6" width="4.5" height=".9" transform="rotate(-33 24 16)"/><rect x="21.5" y="3" width="4.5" height=".9" transform="rotate(33 24 4)"/><rect x="21" y="4.6" width="4.5" height=".9" transform="rotate(33 24 4)"/><rect x="4" y="15" width="4.5" height=".9" transform="rotate(33 6 16)"/><rect x="4.5" y="16.6" width="4.5" height=".9" transform="rotate(33 6 16)"/></g>`),
  it: F(vb("#009246", "#fff", "#CE2B37")),
  pl: F(hb("#fff", "#DC143C")),
  uk: F(hb("#0057B7", "#FFD700")),
  sk: F(`${hb("#fff", "#0B4EA2", "#EE1C25")}<path d="M7 5.5h6v5.5q0 3-3 4.2-3-1.2-3-4.2z" fill="#EE1C25" stroke="#fff" stroke-width=".7"/><path d="M10 7v6.5M8.4 9h3.2M8.8 10.8h2.4" stroke="#fff" stroke-width=".8"/>`),
  vi: F(`<rect width="30" height="20" fill="#DA251D"/>${star(15, 10.4, 5.2, "#FFFF00")}`),
  bn: F(`<rect width="30" height="20" fill="#006A4E"/><circle cx="13.5" cy="10" r="5.4" fill="#F42A41"/>`),
};
// [code, own name]. The second name (in the UI language) comes from Intl.DisplayNames.
export const LANGS = [["cs", "Čeština"], ["en", "English"], ["es", "Español"], ["zh", "中文"], ["hi", "हिन्दी"], ["ar", "العربية"], ["pt", "Português"], ["fr", "Français"], ["de", "Deutsch"],
  ["ru", "Русский"], ["ja", "日本語"], ["bn", "বাংলা"], ["id", "Bahasa Indonesia"], ["tr", "Türkçe"], ["ko", "한국어"], ["vi", "Tiếng Việt"], ["it", "Italiano"], ["pl", "Polski"], ["uk", "Українська"], ["sk", "Slovenčina"]];
export const langName = code => (LANGS.find(l => l[0] === code) || LANGS[0])[1];

/* ---------- bottom sheet ---------- */
export function sheet(html, { onClose } = {}) {
  closeSheet();
  const dim = document.createElement("div"); dim.className = "sh-dim"; dim.id = "shDim";
  const sh = document.createElement("div"); sh.className = "sh"; sh.id = "sh"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
  sh.innerHTML = `<div class="sh-hdl" aria-hidden="true"></div>${html}`;
  document.body.append(dim, sh);
  requestAnimationFrame(() => { dim.classList.add("in"); sh.classList.add("in"); });
  let shut = false;
  const esc_ = e => { if (e.key === "Escape") close(); };
  const close = () => { if (shut) return; shut = true; document.removeEventListener("keydown", esc_); fadeOut(sh, dim); onClose?.(); };
  dim.onclick = close;
  document.addEventListener("keydown", esc_);
  return { el: sh, close };
}
// Closing slides/fades the sheet out (the same way it came in) and removes it after; a new sheet replaces it at once.
export function closeSheet() { $("#sh")?.remove(); $("#shDim")?.remove(); }
function fadeOut(...els) {
  const now = matchMedia("(prefers-reduced-motion:reduce)").matches;
  // its ids go at once, so a sheet opened during the fade never finds this one's buttons with $("#…")
  for (const e of els) { for (const x of [e, ...e.querySelectorAll("[id]")]) x.removeAttribute("id"); e.classList.remove("in"); if (now) e.remove(); else setTimeout(() => e.remove(), 280); }
}

/* ---------- appearance: auto follows the system, or a forced light/dark ---------- */
export function applyTheme() {
  const th = store.get("theme", "auto");
  if (th === "light" || th === "dark") document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
}

/* ---------- the language sheet: search, 20 languages with flags, Done applies ---------- */
export function langSheet(onPick) {
  let pick = lang();
  const other = code => { try { return new Intl.DisplayNames([lang()], { type: "language" }).of(code === "en" ? "en" : code); } catch (e) { return ""; } };
  const row = ([code, name]) => { const o = other(code); return `<button class="lrow ${code === pick ? "on" : ""}" data-l="${code}" lang="${code}"><span class="flag">${FLAG[code]}</span><b>${esc(name)}</b>${o && o.toLowerCase() !== name.toLowerCase() ? `<small lang="${lang()}">${esc(o)}</small>` : ""}${code === pick ? `<i class="lok">${TICK}</i>` : ""}</button>`; };
  const s = sheet(`<h2 class="sh-h">${t("langTitle")}</h2><label class="sh-search">${SEARCH}<input id="lq" type="search" placeholder="${t("langSearch")}" aria-label="${t("langSearch")}" autocomplete="off"></label>
    <div class="sh-list" id="ll"></div><p class="sh-note">${t("langNote")}</p><button class="btn-p" id="lDone">${t("done")}</button>`);
  const draw = () => {
    const q = $("#lq").value.trim().toLowerCase();
    $("#ll").innerHTML = LANGS.filter(l => !q || (l[0] + " " + l[1] + " " + other(l[0])).toLowerCase().includes(q)).map(row).join("");
    s.el.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { pick = b.dataset.l; draw(); });
  };
  $("#lq").oninput = draw; draw();
  $("#lDone").onclick = async () => { s.close(); if (pick !== lang()) { await setLang(pick); onPick?.(pick); } };
}

/* Practice tiles: same chunky two-tone style as the tab icons (lip underneath, white symbol on top). */
export const PRAC_ICONS = {
  mistakes: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="28" rx="7" fill="#C2352B"/><rect x="5" y="6" width="30" height="28" rx="7" fill="#FF5A4E"/><path d="M14.5 15.5a7.5 7.5 0 1 1-1.2 9" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M10.5 12.5l1.8 6.4 6.3-2" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mix: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="28" rx="7" fill="#1E5BD6"/><rect x="5" y="6" width="30" height="28" rx="7" fill="#3B8BFF"/><path d="M11 14h4.5c5 0 5 12 10 12H29M11 26h4.5c1.800 0 3-1.500 3.800-3.400M29 14h-3.500c-1.800 0-3 1.500-3.800 3.400" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M26.5 10.5 30 14l-3.500 3.500M26.5 22.5 30 26l-3.500 3.500" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};
