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
  if (DOC_TYPES.includes(ext)) return countDocPages(ext, buf);
  if (ext === "pdf") {
    const pageObjs = s => (s.match(/\/Type\s*\/Page\b(?!s)/g) || []).length;
    let pages = pageObjs(text);
    if (pages) return { pages, estimated: false };
    // Newer exporters pack the page objects into compressed object streams: unpack those and look again.
    const packed = await objectStreams(buf, text);
    pages = pageObjs(packed);
    if (pages) return { pages, estimated: false };
    const counts = [...(text + packed).matchAll(/\/Count\s+(\d+)/g)].map(m => +m[1]);
    if (counts.length) return { pages: Math.max(...counts), estimated: false };
  }
  return { pages: Math.max(1, Math.round(file.size / (1024 * 1024) * PAGES_PER_MB_GUESS)), estimated: true };
}
// The text of every Flate-compressed object stream (/Type /ObjStm) in a PDF, joined. A stream that won't inflate is skipped.
async function objectStreams(buf, text) {
  if (typeof DecompressionStream === "undefined") return "";
  let out = "";
  for (const m of text.matchAll(/\/Type\s*\/ObjStm\b/g)) {
    const objStart = text.lastIndexOf(" obj", m.index), kw = text.indexOf("stream", m.index);
    if (objStart < 0 || kw < 0 || !/\/FlateDecode/.test(text.slice(objStart, kw))) continue;
    let start = kw + 6;
    if (text[start] === "\r") start++;
    if (text[start] === "\n") start++;
    let end = text.indexOf("endstream", start);
    if (end < 0) continue;
    while (end > start && (text[end - 1] === "\n" || text[end - 1] === "\r")) end--;
    try {
      const s = new Blob([buf.subarray(start, end)]).stream().pipeThrough(new DecompressionStream("deflate"));
      out += new TextDecoder("latin1").decode(await new Response(s).arrayBuffer()) + "\n";
    } catch (e) { }
  }
  return out;
}
// What the upload picker offers: PDF, PowerPoint (old .ppt too), Word (.docx, .doc), RTF, text (.txt, .md) and slide pictures
// (joined into one PDF in the browser). The builder turns Word, RTF and text into a PDF with LibreOffice.
export const DOC_TYPES = ["docx", "doc", "rtf", "txt", "md"];
// One Word or text page counts as 3 slides toward the 250 cap, the free start and PRO's allowance (Marek, 2026-11-13):
// a Word page holds ~3,000 characters against a few hundred on a slide. Same rule in pc-api and the builder.
export const SLIDES_PER_DOC_PAGE = 3;
export const slidesOf = (name, pages) => pages * (DOC_TYPES.includes(String(name).split(".").pop().toLowerCase()) ? SLIDES_PER_DOC_PAGE : 1);
export const ACCEPT = ".pdf,.pptx,.ppt,.docx,.doc,.rtf,.txt,.md,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp";
export const validFile = (name, head) => {
  const ext = name.split(".").pop().toLowerCase();
  const h = String.fromCharCode(...head.slice(0, 4));
  if (ext === "txt" || ext === "md") return head.length > 0 && (h.startsWith("\xFF\xFE") || h.startsWith("\xFE\xFF") || !head.slice(0, 4).includes(0)); // text: no zero bytes unless UTF-16
  return (ext === "pdf" && h === "%PDF") || ((ext === "pptx" || ext === "docx") && h.startsWith("PK"))
    || ((ext === "ppt" || ext === "doc") && h === "\xD0\xCF\x11\xE0") // old Office (OLE file)
    || (ext === "rtf" && h === "{\\rt");
};

// LibreOffice prints plain text at about 90 characters a line and 50 lines a page (measured 2026-11-13 on .txt files).
export const TXT_LINE = 90, TXT_LINES = 50, DOC_CHARS_PER_PAGE = 3000, DOC_KB_PER_PAGE = 15;
export const textPages = s => Math.max(1, Math.ceil(s.split(/\r?\n/).reduce((n, l) => n + Math.max(1, Math.ceil(l.length / TXT_LINE)), 0) / TXT_LINES));
const decodeText = buf => {
  if (buf[0] === 0xFF && buf[1] === 0xFE) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xFE && buf[1] === 0xFF) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  return new TextDecoder("utf-8").decode(buf);
};
// Word and text pages. Only a .docx that Word saved with its page count is exact; the rest is a guess, and the builder
// keeps at most 250 real pages whatever the guess said.
async function countDocPages(ext, buf) {
  if (ext === "txt" || ext === "md") return { pages: textPages(decodeText(buf)), estimated: true };
  if (ext === "docx") {
    const app = await zipEntry(buf, "docProps/app.xml"), n = +(app.match(/<Pages>(\d+)<\/Pages>/)?.[1] || 0);
    if (n > 0) return { pages: n, estimated: false };
    const doc = await zipEntry(buf, "word/document.xml");
    const chars = [...doc.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].reduce((a, m) => a + m[1].length, 0);
    if (chars) return { pages: Math.max(1, Math.ceil(chars / DOC_CHARS_PER_PAGE)), estimated: true };
  }
  if (ext === "rtf") {
    const s = new TextDecoder("latin1").decode(buf).replace(/[0-9a-f\s]{200,}/gi, " ").replace(/\'[0-9a-f]{2}/gi, "x").replace(/\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "");
    return { pages: Math.max(1, Math.ceil(s.trim().length / DOC_CHARS_PER_PAGE)), estimated: true };
  }
  return { pages: Math.max(1, Math.round(buf.length / 1024 / DOC_KB_PER_PAGE)), estimated: true };
}
// One file of a zip as text (UTF-8), found through the central directory; "" when it's missing or won't inflate.
async function zipEntry(buf, name) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), dec = new TextDecoder("utf-8");
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return "";
  let p = v.getUint32(eocd + 16, true);
  for (let k = v.getUint16(eocd + 10, true); k > 0 && p + 46 <= buf.length && v.getUint32(p, true) === 0x02014b50; k--) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    if (dec.decode(buf.subarray(p + 46, p + 46 + nl)) === name) {
      const start = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = buf.subarray(start, start + size);
      if (method === 0) return dec.decode(data);
      if (method !== 8 || typeof DecompressionStream === "undefined") return "";
      try { return dec.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()); } catch { return ""; }
    }
    p += 46 + nl + xl + cl;
  }
  return "";
}
