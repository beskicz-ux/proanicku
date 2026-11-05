// Study forecast: arithmetic from the student's own numbers, never a pass rate.
// The per-page minutes are assumptions, shown as an estimate in the UI.
export const MIN_PER_PAGE_FIRST = 1.5, MIN_PER_PAGE_REPEAT = 0.5, PAGES_PER_MB_GUESS = 8;

export function daysBetween(fromIso, toIso) {
  const p = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(toIso) - p(fromIso)) / 86400000);
}
export function forecast({ pages, today, examDate, minutes, days }) {
  const left = Math.max(0, daysBetween(today, examDate));
  const sessions = Math.floor(left * days / 7);
  const total = sessions * minutes;
  const firstPass = Math.max(1, pages) * MIN_PER_PAGE_FIRST;
  const coverage = Math.min(1, total / firstPass);
  const repeats = coverage < 1 ? 0 : Math.floor((total - firstPass) / (Math.max(1, pages) * MIN_PER_PAGE_REPEAT));
  const gap = 7 / days; // average days between sessions; shorter gaps mean less forgetting
  const level = coverage < 1 ? 0 : repeats < 1 ? 1 : repeats < 3 || gap > 3.5 ? 2 : 3;
  return { daysLeft: left, sessions, totalMinutes: total, hours: Math.round(total / 6) / 10, coverage, repeats, gap, level };
}
// What the same plan looks like with more time or more regularity, for the comparison rows.
export function scenarios(input) {
  const rows = [{ key: "you", ...input }];
  const minutes = input.minutes >= 120 ? input.minutes : input.minutes + (input.minutes >= 45 ? 30 : 15);
  if (minutes !== input.minutes) rows.push({ key: "more", ...input, minutes });
  if (input.days < 7) rows.push({ key: "daily", ...input, days: 7 });
  return rows.map(r => ({ key: r.key, minutes: r.minutes, days: r.days, ...forecast(r) }));
}
// Page count from the file itself, so the forecast has a real number. estimated:true means it's a guess from file size.
export async function countPages(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const buf = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder("latin1").decode(buf);
  if (ext === "pptx") {
    const names = new Set(text.match(/ppt\/slides\/slide\d+\.xml/g) || []);
    if (names.size) return { pages: names.size, estimated: false };
  }
  if (ext === "pdf") {
    const pages = (text.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
    if (pages) return { pages, estimated: false };
    const counts = [...text.matchAll(/\/Count\s+(\d+)/g)].map(m => +m[1]);
    if (counts.length) return { pages: Math.max(...counts), estimated: false };
  }
  return { pages: Math.max(1, Math.round(file.size / (1024 * 1024) * PAGES_PER_MB_GUESS)), estimated: true };
}
export const validFile = (name, head) => {
  const ext = name.split(".").pop().toLowerCase();
  const h = String.fromCharCode(...head.slice(0, 4));
  return (ext === "pdf" && h === "%PDF") || (ext === "pptx" && h.startsWith("PK"));
};
