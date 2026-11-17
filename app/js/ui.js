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
  // The original house, with one tall door where the arch and the round window used to be (together they read as a person) (Marek, 2026-11-12).
  home: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 19 20 10.5 31 19v13a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z" fill="#E8B23A"/><path d="M9 18 20 9.5 31 18v12a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4z" fill="#FFD25C"/><path d="M4.5 19.5 20 6.5l15.5 13a2.6 2.6 0 0 1-3.3 4L20 13.3 7.8 23.5a2.6 2.6 0 0 1-3.3-4z" fill="#C93A2B"/><path d="M4.5 18 20 5l15.5 13a2.6 2.6 0 0 1-3.3 4L20 11.8 7.8 22a2.6 2.6 0 0 1-3.3-4z" fill="#FF5A47"/><path d="M15.5 34V22a2.5 2.5 0 0 1 2.5-2.5h4a2.5 2.5 0 0 1 2.5 2.5V34z" fill="#B8642A"/><circle cx="22" cy="27.5" r="1.2" fill="#FFD25C"/></svg>`,
  more: `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="21.5" r="15" fill="#7C3AED"/><circle cx="20" cy="20" r="15" fill="#A866FF"/><circle cx="13" cy="20" r="2.6" fill="#fff"/><circle cx="20" cy="20" r="2.6" fill="#fff"/><circle cx="27" cy="20" r="2.6" fill="#fff"/></svg>`,
  notes: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="8" y="6" width="26" height="31" rx="5" fill="#1E5BD6"/><rect x="8" y="4" width="26" height="31" rx="5" fill="#3B8BFF"/><rect x="13" y="9" width="17" height="21" rx="2.5" fill="#fff"/><rect x="16" y="13" width="11" height="3" rx="1.5" fill="#3B8BFF"/><rect x="16" y="18.5" width="11" height="3" rx="1.5" fill="#BFD7FF"/><rect x="16" y="24" width="7" height="3" rx="1.5" fill="#BFD7FF"/><rect x="5" y="9" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/><rect x="5" y="17.5" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/><rect x="5" y="26" width="7" height="3.6" rx="1.8" fill="#0F3E9E"/></svg>`,
  review: `<svg viewBox="0 0 40 40" aria-hidden="true"><g transform="rotate(12 26 19)"><rect x="16" y="5" width="19" height="25" rx="4.5" fill="#7BD9B0"/></g><rect x="6" y="11" width="20" height="26" rx="4.5" fill="#128A5E"/><rect x="6" y="9" width="20" height="26" rx="4.5" fill="#22C07F"/><path d="M11 22.5l3.6 3.6 6.6-7.4" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  progress: `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M11 9H6.5a1.5 1.5 0 0 0-1.5 1.7C5.6 15.5 8.5 19 13 19.5M29 9h4.5a1.5 1.5 0 0 1 1.5 1.7C34.4 15.5 31.5 19 27 19.5" fill="none" stroke="#E09A10" stroke-width="3.4" stroke-linecap="round"/><path d="M11 6h18v9a9 9 0 0 1-18 0z" fill="#E09A10"/><path d="M11 5h18v8.5a9 9 0 0 1-18 0z" fill="#FFC531"/><path d="M15.5 9v4.5a4.5 4.5 0 0 0 2 3.7" fill="none" stroke="#FFE69A" stroke-width="2.6" stroke-linecap="round"/><path d="M17 22h6l1 5h-8z" fill="#E09A10"/><rect x="10" y="28" width="20" height="9" rx="3" fill="#7C3AED"/><rect x="10" y="27" width="20" height="8" rx="3" fill="#A866FF"/></svg>`,
};

/* ---------- top bar and profile metrics ---------- */
export const ringIcon = (pct, size = 28) => {
  const c = 62.8, on = Math.max(0, Math.min(1, pct / 100)) * c;
  return `<svg viewBox="0 0 28 28" width="${size}" height="${size}" aria-hidden="true"><circle cx="14" cy="14" r="10" fill="none" stroke="#22C07F" stroke-opacity=".22" stroke-width="5"/>${on > .1 ? `<circle cx="14" cy="14" r="10" fill="none" stroke="#22C07F" stroke-width="5" stroke-linecap="round" stroke-dasharray="${on.toFixed(1)} ${c}" transform="rotate(-90 14 14)"/>` : ""}</svg>`;
};
export const calIcon = () => `<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="3" y="6" width="22" height="20" rx="4.5" fill="#D9473A"/><rect x="3" y="5" width="22" height="19" rx="4.5" fill="#fff"/><path d="M3 9.5A4.5 4.5 0 0 1 7.5 5h13A4.5 4.5 0 0 1 25 9.5V11H3z" fill="#FF5A47"/><rect x="8" y="2.5" width="3" height="6" rx="1.5" fill="#B8342A"/><rect x="17" y="2.5" width="3" height="6" rx="1.5" fill="#B8342A"/></svg>`;
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
  gear: ["#64748B", `<svg viewBox="0 0 24 24" ${W}><circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/></svg>`],
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
// mid: a small card in the middle of the screen (the year picker), not a sheet from the bottom
export function sheet(html, { onClose, mid } = {}) {
  closeSheet();
  const dim = document.createElement("div"); dim.className = "sh-dim"; dim.id = "shDim";
  const sh = document.createElement("div"); sh.className = mid ? "sh mid" : "sh"; sh.id = "sh"; sh.setAttribute("role", "dialog"); sh.setAttribute("aria-modal", "true");
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

/* ---------- a wheel of years: a scroll-snap list, the middle row is the pick ---------- */
// Like the phone's own picker: flick it and it settles on a row. A mouse scrolls it or clicks a row; keys: arrows (a year),
// Page Up/Down (five), Home/End, or the four digits typed. Only min…max exist, so nothing out of range can be picked.
export function yearWheel(box, { min, max, value, labelledby, onChange, rows = 3 }) {
  const ROW = 44, n = max - min + 1, clamp = i => Math.max(0, Math.min(n - 1, i));
  let cur = clamp((value ?? max) - min), typed = "", typedAt = 0, timer = 0;
  box.className = "wheel"; box.style.setProperty("--rows", rows);
  box.innerHTML = `<div class="wh-list" role="listbox" tabindex="0" aria-labelledby="${esc(labelledby)}"><i class="wh-pad"></i>${Array.from({ length: n }, (_, i) => `<div class="wh-o" role="option" id="whO${i}" data-i="${i}" aria-selected="false">${min + i}</div>`).join("")}<i class="wh-pad"></i></div>`;
  const list = box.firstElementChild, opts = list.querySelectorAll(".wh-o");
  const mark = i => {
    opts[cur].classList.remove("on"); opts[cur].setAttribute("aria-selected", "false");
    cur = i; opts[i].classList.add("on"); opts[i].setAttribute("aria-selected", "true"); list.setAttribute("aria-activedescendant", opts[i].id);
  };
  // the row in the middle is the pick; the draft hears about it once the wheel has settled
  const sync = () => { const i = clamp(Math.round(list.scrollTop / ROW)); if (i !== cur) { mark(i); clearTimeout(timer); timer = setTimeout(() => onChange?.(min + cur), 120); } };
  const go = (i, smooth) => {
    list.scrollTo({ top: clamp(i) * ROW, behavior: smooth && !matchMedia("(prefers-reduced-motion:reduce)").matches ? "smooth" : "instant" });
    if (!smooth) sync();
  };
  list.onscroll = sync;
  list.onclick = e => { const o = e.target.closest(".wh-o"); if (o) go(+o.dataset.i, true); };
  list.onkeydown = e => {
    const k = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key];
    if (k) { e.preventDefault(); return go(cur + k); }
    if (e.key === "Home" || e.key === "End") { e.preventDefault(); return go(e.key === "Home" ? 0 : n - 1); }
    if (/^\d$/.test(e.key)) { // 2 0 0 4 typed in a row jumps there
      const now = Date.now(); typed = (now - typedAt > 1500 ? "" : typed) + e.key; typedAt = now;
      if (typed.length === 4) { go(+typed - min); typed = ""; }
    }
  };
  mark(cur); list.scrollTop = cur * ROW;
  return { get: () => min + cur, el: list };
}

/* ---------- appearance: auto follows the system, or a forced light/dark ---------- */
export function applyTheme() {
  const th = store.get("theme", "auto");
  if (th === "light" || th === "dark") document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme;
}

/* ---------- the language sheet: search, 20 languages with flags, a tap applies ---------- */
export function langSheet(onPick) {
  const pick = lang();
  const other = code => { try { return new Intl.DisplayNames([lang()], { type: "language" }).of(code === "en" ? "en" : code); } catch (e) { return ""; } };
  const row = ([code, name]) => { const o = other(code); return `<button class="lrow ${code === pick ? "on" : ""}" data-l="${code}" lang="${code}"><span class="flag">${FLAG[code]}</span><b>${esc(name)}</b>${o && o.toLowerCase() !== name.toLowerCase() ? `<small lang="${lang()}">${esc(o)}</small>` : ""}${code === pick ? `<i class="lok">${TICK}</i>` : ""}</button>`; };
  const s = sheet(`<h2 class="sh-h">${t("langTitle")}</h2><label class="sh-search">${SEARCH}<input id="lq" type="search" placeholder="${t("langSearch")}" aria-label="${t("langSearch")}" autocomplete="off"></label>
    <div class="sh-list" id="ll"></div><p class="sh-note">${t("langNote")}</p>`);
  s.el.classList.add("sh-lang");
  // A tap on a language applies and saves it and closes the sheet: no Done button to scroll down to (Marek, 2026-11-17).
  const choose = async code => { s.close(); if (code !== lang()) { await setLang(code); onPick?.(code); } };
  const draw = () => {
    const q = $("#lq").value.trim().toLowerCase();
    $("#ll").innerHTML = LANGS.filter(l => !q || (l[0] + " " + l[1] + " " + other(l[0])).toLowerCase().includes(q)).map(row).join("");
    s.el.querySelectorAll("[data-l]").forEach(b => b.onclick = () => choose(b.dataset.l));
  };
  $("#lq").oninput = draw; draw();
}

/* Practice tiles: same chunky two-tone style as the tab icons (lip underneath, white symbol on top). */
export const PRAC_ICONS = {
  mistakes: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="28" rx="7" fill="#C2352B"/><rect x="5" y="6" width="30" height="28" rx="7" fill="#FF5A4E"/><path d="M14.5 15.5a7.5 7.5 0 1 1-1.2 9" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M10.5 12.5l1.8 6.4 6.3-2" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  mix: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="5" y="8" width="30" height="28" rx="7" fill="#1E5BD6"/><rect x="5" y="6" width="30" height="28" rx="7" fill="#3B8BFF"/><path d="M11 14h4.5c5 0 5 12 10 12H29M11 26h4.5c1.800 0 3-1.500 3.800-3.400M29 14h-3.500c-1.800 0-3 1.500-3.800 3.400" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M26.5 10.5 30 14l-3.500 3.500M26.5 22.5 30 26l-3.500 3.500" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/* ---------- course icons (Marek, 2026-11-17): our own drawings instead of system emoji, so a course's square looks
   the same on every phone and like the rest of the app: chunky flat shapes, each sitting on a darker lip like the
   tab icons. Drawn light enough to read on any of the course colours. Keys are what is stored, so don't rename them. ---------- */
const CI = body => `<svg viewBox="0 0 40 40" aria-hidden="true">${body}</svg>`;
// a shape with its lip: the same shape, darker, 1.6 lower
const lp = (shape, lo, hi, dy = 1.6) => `<g fill="${lo}" stroke="${lo}" transform="translate(0 ${dy})">${shape}</g><g fill="${hi}" stroke="${hi}">${shape}</g>`;
const S0 = 'stroke-width="0"', LN = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';
export const COURSE_ICONS = {
  book: CI(lp(`<rect x="9" y="5" width="23" height="28" rx="4" ${S0}/>`, "#1E5BD6", "#4FA3FF") + '<path d="M13 5a4 4 0 0 0-4 4v20a4 4 0 0 0 4 4h1V5z" fill="#2F7BEA"/><rect x="14" y="26" width="18" height="4.5" rx="1.5" fill="#fff"/><path d="M23.5 5h5.5v11l-2.75-2.4L23.5 16z" fill="#FFC531"/>'),
  ruler: CI(lp(`<path d="M8 31.5V8.5l23 23zM13.5 26.5h6.5l-6.5-6.5z" fill-rule="evenodd" stroke-width="3" stroke-linejoin="round"/>`, "#E09A10", "#FFC531") + '<path d="M8 13.5h3M8 18h2M8 22.5h3M8 27h2" stroke="#B8770A" stroke-width="1.6" stroke-linecap="round"/>'),
  calc: CI(lp(`<rect x="10" y="4.5" width="20" height="29" rx="4" ${S0}/>`, "#2B3050", "#565C80") + '<rect x="13" y="8" width="14" height="7" rx="2" fill="#C9F2E0"/>' + [0, 1, 2].map(r => [0, 1, 2].map(c => `<rect x="${13 + c * 5.1}" y="${18 + r * 4.7}" width="3.8" height="3.4" rx="1.1" fill="${r === 2 && c === 2 ? "#FFB13D" : "#fff"}"/>`).join("")).join("")),
  chart: CI(lp(`<rect x="6.5" y="20" width="7.5" height="13" rx="2.5" ${S0}/>`, "#128A5E", "#3DD68C") + lp(`<rect x="16.25" y="12.5" width="7.5" height="20.5" rx="2.5" ${S0}/>`, "#E09A10", "#FFC531") + lp(`<rect x="26" y="5.5" width="7.5" height="27.5" rx="2.5" ${S0}/>`, "#D63A5A", "#FF6F8B")),
  coin: CI('<circle cx="20" cy="21.4" r="14" fill="#E09A10"/><circle cx="20" cy="19.6" r="14" fill="#FFC531"/><circle cx="20" cy="19.6" r="10" fill="none" stroke="#F0AE1E" stroke-width="2"/>' + `<path d="M17 14.5v10.2M23.6 14.5l-6.3 5.3 6.6 4.9" ${LN} stroke="#B8770A" stroke-width="3"/>`),
  scales: CI('<path d="M11 11.5 6.2 21M11 11.5 15.8 21M29 11.5 24.2 21M29 11.5 33.8 21" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>' + lp(`<path d="M4.5 21h13a6.5 6.5 0 0 1-13 0zM22.5 21h13a6.5 6.5 0 0 1-13 0z" ${S0}/>`, "#C9D0E4", "#fff") + lp(`<rect x="7" y="9.5" width="26" height="3.2" rx="1.6" ${S0}/><rect x="18.5" y="8" width="3" height="23" ${S0}/><circle cx="20" cy="8.5" r="3.2" ${S0}/><rect x="12" y="29.5" width="16" height="4.2" rx="2.1" ${S0}/>`, "#E09A10", "#FFC531", 1.2)),
  flask: CI(lp(`<path d="M15.5 5h9v3h-1.7v6.6l8.4 14.2a3.6 3.6 0 0 1-3.1 5.4H11.9a3.6 3.6 0 0 1-3.1-5.4l8.4-14.2V8h-1.7z" ${S0}/>`, "#AEB9D6", "#F2F7FF") + '<path d="M13 23.5h14l3.3 5.6a3.4 3.4 0 0 1-2.9 5.1H12.6a3.4 3.4 0 0 1-2.9-5.1z" fill="#3DD68C"/><circle cx="16.5" cy="29" r="1.7" fill="#C8F7DF"/><circle cx="22.5" cy="27" r="1.1" fill="#C8F7DF"/><circle cx="24" cy="12" r="1.3" fill="#C8F7DF"/>'),
  dna: CI('<path d="M15 8.5h10M16 16.5h8M16 23.5h8M15 31.5h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>' + `<path d="M27 4.5c0 8-14 8-14 15.5s14 7.5 14 15.5" ${LN} stroke="#4FA3FF" stroke-width="3.6"/><path d="M13 4.5c0 8 14 8 14 15.5s-14 7.5-14 15.5" ${LN} stroke="#FF6F8B" stroke-width="3.6"/>`),
  atom: CI([0, 60, 120].map(a => `<ellipse cx="20" cy="20" rx="15" ry="5.8" fill="none" stroke="#fff" stroke-width="2.2" transform="rotate(${a} 20 20)"/>`).join("") + '<circle cx="20" cy="21.2" r="4.6" fill="#E09A10"/><circle cx="20" cy="20" r="4.6" fill="#FFC531"/><circle cx="35" cy="20" r="2.3" fill="#7BE0FF"/><circle cx="12.5" cy="7" r="2.3" fill="#FF8FB0"/>'),
  heart: CI(lp(`<path d="M20 33C9.5 26.3 5.5 20.5 5.5 15a7.5 7.5 0 0 1 14.5-2.7A7.5 7.5 0 0 1 34.5 15c0 5.5-4 11.3-14.5 18z" ${S0}/>`, "#C93A2B", "#FF5A47") + `<path d="M8.5 19.5h6l2.5-5.5 4 9.5 2.5-4h8" ${LN} stroke="#fff" stroke-width="2.5"/>`),
  brain: CI(lp(`<path d="M20 8.5c-2-3.5-8-3.5-9.5.500-4 .5-6 5-4 8.5-2.5 3.5-1 8.5 3 9.5 1 4 7 5.5 10.5 2 3.5 3.5 9.5 2 10.5-2 4-1 5.5-6 3-9.5 2-3.5 0-8-4-8.5C28 5 22 5 20 8.5z" ${S0}/>`, "#D9577F", "#FF9DBB") + `<path d="M20 9v20M13 15.5c2.2 0 3.6 1.5 3.6 3.6M27 15.5c-2.2 0-3.6 1.5-3.6 3.6M12 24.5c2.2-.6 3.8-.2 4.8 1.2M28 24.5c-2.2-.6-3.8-.2-4.8 1.2" ${LN} stroke="#D9577F" stroke-width="2"/>`),
  laptop: CI(lp(`<rect x="8" y="6.5" width="24" height="18" rx="3.5" ${S0}/>`, "#2B3050", "#4A5080") + `<path d="M17 12l-3.2 3.2 3.2 3.2M23 12l3.2 3.2L23 18.4" ${LN} stroke="#fff" stroke-width="2.3"/><path d="M21 11.5l-2 7.5" ${LN} stroke="#FFC531" stroke-width="2"/>` + lp(`<path d="M4.5 26.5h31l-1.8 4.8a2.2 2.2 0 0 1-2 1.4H8.3a2.2 2.2 0 0 1-2-1.4z" ${S0}/>`, "#AEB6CF", "#EEF1FA")),
  gear: CI(lp(`<circle cx="20" cy="19.5" r="10.5" ${S0}/>` + [0, 1, 2, 3, 4, 5, 6, 7].map(k => `<rect x="17" y="4" width="6" height="9" rx="2.2" ${S0} transform="rotate(${k * 45} 20 19.5)"/>`).join(""), "#8E97B5", "#E3E7F3") + '<circle cx="20" cy="19.5" r="4.6" fill="#6C7396"/><circle cx="20" cy="19.5" r="7.3" fill="none" stroke="#C6CCE0" stroke-width="1.6"/>'),
  temple: CI(lp(`<path d="M20 5.5 34.5 14h-29z" stroke-width="2.4" stroke-linejoin="round"/><rect x="6" y="29" width="28" height="4.6" rx="2" ${S0}/>`, "#C9D0E4", "#fff") + '<rect x="9.5" y="17" width="4.2" height="12" rx="1" fill="#EEF1FA"/><rect x="17.9" y="17" width="4.2" height="12" rx="1" fill="#EEF1FA"/><rect x="26.3" y="17" width="4.2" height="12" rx="1" fill="#EEF1FA"/><circle cx="20" cy="11" r="1.8" fill="#FFC531"/>'),
  globe: CI('<circle cx="20" cy="21.4" r="14" fill="#1E5BD6"/><circle cx="20" cy="19.6" r="14" fill="#4FA3FF"/><path d="M10.5 12.5c2-3 6.5-4.5 8.5-3 1.5 1.1.300 3.2-1.3 3.7-2 .7-1.4 2.6-3.4 3.1-2.2.600-5-.6-3.8-3.8zM22 20.5c2.5-1 6.2 0 7.2 2.6 1 2.5-1 5.6-3.6 6.1-2 .4-2.6-2-3.9-3.6-1.2-1.4-2-4.1.300-5.1z" fill="#3DD68C"/>'),
  scroll: CI(lp(`<rect x="10" y="8" width="20" height="24" rx="2" ${S0}/>`, "#D9B26A", "#FFF1CF", 0) + '<rect x="14" y="14.5" width="12" height="2.2" rx="1.1" fill="#D9B26A"/><rect x="14" y="19" width="12" height="2.2" rx="1.1" fill="#D9B26A"/><rect x="14" y="23.5" width="8" height="2.2" rx="1.1" fill="#D9B26A"/>' + lp(`<rect x="7" y="4.5" width="26" height="6.5" rx="3.2" ${S0}/><rect x="7" y="28" width="26" height="6.5" rx="3.2" ${S0}/>`, "#C99A4A", "#FFE2A3", 1.2)),
  palette: CI(lp(`<path d="M20 5.5C11 5.5 5 11.5 5 19s6 13.5 14 13.5c3 0 4-1.8 3.2-4-.9-2.4.600-4.2 3.3-4.2H29c3.6 0 6-2.6 6-6.3 0-7-6.5-12.5-15-12.5z" ${S0}/>`, "#C99A4A", "#FFE9BF") + '<circle cx="12" cy="18.5" r="2.7" fill="#FF5A47"/><circle cx="16.5" cy="11.8" r="2.7" fill="#FFC531"/><circle cx="24.5" cy="11" r="2.7" fill="#3DD68C"/><circle cx="29.8" cy="16.5" r="2.7" fill="#4FA3FF"/><circle cx="13.5" cy="25.5" r="2.2" fill="#A866FF"/>'),
  music: CI(lp(`<path d="M16 26.5V10.5l13.5-3.2v16.2" fill="none" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="12.3" cy="27" rx="4.7" ry="3.7" ${S0}/><ellipse cx="25.8" cy="24" rx="4.7" ry="3.7" ${S0}/>`, "#C9D0E4", "#fff")),
  speech: CI(lp(`<path d="M9 6h22a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4H19.5l-7.5 6.5V27H9a4 4 0 0 1-4-4V10a4 4 0 0 1 4-4z" ${S0}/>`, "#C9D0E4", "#fff") + `<path d="M10.5 22.5 14.7 11l4.2 11.5M12 18.8h5.4" ${LN} stroke="#6C5CE7" stroke-width="2.6"/>` + '<rect x="22.5" y="12" width="8.5" height="2.6" rx="1.3" fill="#FF8FB0"/><rect x="22.5" y="17.2" width="6" height="2.6" rx="1.3" fill="#FFC531"/>'),
  pencil: CI('<g transform="rotate(40 20 20)"><rect x="16.3" y="2.5" width="7.4" height="5.5" rx="2" fill="#FF8FB0"/><rect x="16.3" y="6.5" width="7.4" height="2.8" fill="#DDE2F0"/><rect x="16.3" y="9.3" width="7.4" height="19" fill="#FFC531"/><rect x="16.3" y="9.3" width="2.6" height="19" fill="#E09A10"/><path d="M16.3 28.3h7.4L20 37z" fill="#FFE2B8"/><path d="M18.5 33.4h3L20 37z" fill="#3A3F5C"/></g>'),
  lens: CI('<path d="M26.5 27.7l6.5 6.5" stroke="#B8770A" stroke-width="5.4" stroke-linecap="round"/><path d="M26.5 26.5l6.5 6.5" stroke="#FFC531" stroke-width="5.4" stroke-linecap="round"/><circle cx="17" cy="18.3" r="11" fill="#C9D0E4"/><circle cx="17" cy="17" r="11" fill="#fff"/><circle cx="17" cy="17" r="7.8" fill="#9CD3FF"/><path d="M12 15.5a5.5 5.5 0 0 1 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'),
  trend: CI(lp(`<rect x="5" y="6.5" width="30" height="25" rx="4.5" ${S0}/>`, "#C9D0E4", "#fff") + `<path d="M10 25l6.5-6.5 4.5 4 8-9M24 13h5.5v5.5" ${LN} stroke="#22C07F" stroke-width="3.2"/>`),
  star: CI(lp(`<path d="M20 6l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L20 27l-8.2 4.4 1.6-9.2-6.7-6.5 9.2-1.3z" stroke-width="2.8" stroke-linejoin="round"/>`, "#E09A10", "#FFC531") + '<path d="M14.5 16.5l2.2-.3 1-2" fill="none" stroke="#FFE69A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
};
