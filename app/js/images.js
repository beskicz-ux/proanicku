// Slides as pictures (PNG, JPG, WebP): the browser turns them into one PDF, a page per picture, in file-name order
// ("slide 2" before "slide 10"). The server, storage and generator then treat it like any PDF of picture slides.
export const IMAGE_RE = /\.(png|jpe?g|webp)$/i;
export const isImage = f => IMAGE_RE.test(f.name);
const LONG_SIDE = 2000, QUALITY = 0.85, PAGE_PT = 842; // pixels kept, JPEG quality, page long side in points (A4)
export const MAX_PDF_BYTES = 45 * 1024 * 1024; // under the 50 MB upload limit, with room for the PDF wrapper

// One picture as JPEG bytes, scaled down if huge. Transparent PNG areas become white, not black.
async function toJpeg(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw Object.assign(new Error("fake"), { code: "fake" });
  const s = Math.min(1, LONG_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", QUALITY));
  return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
}

// A minimal PDF: catalog, page tree, and per page a JPEG image (DCTDecode), its drawing command and the page.
export function buildPdf(images) {
  const enc = s => Uint8Array.from(s, ch => ch.charCodeAt(0) & 255);
  const parts = [], offsets = [];
  let len = 0;
  const push = b => { parts.push(b); len += b.length; };
  const obj = (n, head, stream) => {
    offsets[n] = len;
    push(enc(`${n} 0 obj\n${head}\n`));
    if (stream) { push(enc("stream\n")); push(stream); push(enc("\nendstream\n")); }
    push(enc("endobj\n"));
  };
  push(enc("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
  const kids = images.map((_, i) => `${5 + i * 3} 0 R`).join(" ");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`);
  images.forEach((im, i) => {
    const n = 3 + i * 3, s = PAGE_PT / Math.max(im.w, im.h);
    const pw = +(im.w * s).toFixed(2), ph = +(im.h * s).toFixed(2);
    const draw = enc(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
    obj(n, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>`, im.bytes);
    obj(n + 1, `<< /Length ${draw.length} >>`, draw);
    obj(n + 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${n} 0 R >> >> /Contents ${n + 1} 0 R >>`);
  });
  const count = 3 + images.length * 3, xref = len;
  push(enc(`xref\n0 ${count}\n0000000000 65535 f \n` + offsets.slice(1).map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")));
  push(enc(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  return new Blob(parts, { type: "application/pdf" });
}

// Pictures → one or more PDF files (a new file starts before 45 MB). onStep(done, total) reports progress.
export async function imagesToPdfs(files, name, onStep = () => { }) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
  const groups = [[]];
  let size = 0;
  for (let i = 0; i < sorted.length; i++) {
    const im = await toJpeg(sorted[i]);
    if (groups.at(-1).length && size + im.bytes.length > MAX_PDF_BYTES) { groups.push([]); size = 0; }
    groups.at(-1).push(im); size += im.bytes.length;
    onStep(i + 1, sorted.length);
  }
  return groups.map((g, i) => new File([buildPdf(g)], name(groups.length > 1 ? i + 1 : 0, g.length) + ".pdf", { type: "application/pdf" }));
}
