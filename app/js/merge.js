// Progress merge, same logic as Penny's mergeState. Used by the browser and by pc-api (keep both copies identical; a test checks it).
export function defaults() {
  return { v: 1, saved: 0, cards: {}, q: {}, read: {}, lessons: {}, xp: {}, done: {}, seen: {}, sound: true };
}
export function mergeState(a, b) {
  if (!b || typeof b !== "object" || !Object.keys(b).length) return a;
  if (!a || !Object.keys(a).length) return Object.assign(defaults(), b);
  if ((a.epoch || 0) !== (b.epoch || 0)) return Object.assign(defaults(), (a.epoch || 0) > (b.epoch || 0) ? a : b);
  const newer = (a.saved || 0) >= (b.saved || 0) ? a : b, older = newer === a ? b : a;
  const out = Object.assign(defaults(), older, newer);
  const by = (k, f) => { const x = a[k] || {}, y = b[k] || {}; const o = {}; for (const id of new Set([...Object.keys(x), ...Object.keys(y)])) o[id] = !(id in x) ? y[id] : !(id in y) ? x[id] : f(x[id], y[id]); out[k] = o; };
  by("read", (x, y) => Math.min(x || y, y || x));
  by("cards", (x, y) => ((x.last || 0) !== (y.last || 0) ? ((x.last || 0) > (y.last || 0) ? x : y) : ((x.reps || 0) >= (y.reps || 0) ? x : y)));
  by("q", (x, y) => ((x.last || 0) >= (y.last || 0) ? x : y));
  by("lessons", (x, y) => ((x.ts || 0) >= (y.ts || 0) ? x : y));
  by("xp", (x, y) => Math.max(x || 0, y || 0));
  by("seen", (x, y) => x || y);
  by("done", (x, y) => { const o = { ...x }; for (const k in y) o[k] = typeof y[k] === "number" ? Math.max(o[k] || 0, y[k]) : (o[k] || y[k]); return o; });
  out.saved = Math.max(a.saved || 0, b.saved || 0);
  return out;
}
