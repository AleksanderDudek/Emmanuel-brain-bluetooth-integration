/**
 * Downloading the cards (src/cards/DESIGN.md §2.2): one card as its PNG, all of them as one PDF
 * to print (A4 landscape, a card per page), or all PNGs in a ZIP.  Both files are written here,
 * in the browser, from the cards' own images — no library and no server — so the downloads work
 * from the static app as well as from the desktop server.  The writers are small on purpose: a
 * PDF of full-page JPEG images and a ZIP that stores files uncompressed (PNGs are compressed
 * already) need nothing more.
 */

const enc = new TextEncoder();

// ── PDF ────────────────────────────────────────────────────────────

export interface PdfImage {
  /** baseline JPEG bytes */
  jpeg: Uint8Array;
  width: number;
  height: number;
}

/** A4 landscape in points, and the margin around each card. */
export const PAGE_W = 842;
export const PAGE_H = 595;
const MARGIN = 18;

/** A PDF with one image per page, each scaled to fit the page inside the margin and centred. */
export function buildPdf(images: readonly PdfImage[], title = 'Emmanuel'): Uint8Array {
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;
  const push = (b: Uint8Array | string) => {
    const bytes = typeof b === 'string' ? enc.encode(b) : b;
    parts.push(bytes);
    pos += bytes.length;
  };
  const obj = (n: number, body: string) => {
    offsets[n] = pos;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };
  // binary marker in the header comment, so tools treat the file as binary
  push('%PDF-1.4\n%âãÏÓ\n');
  const n = images.length;
  // objects: 1 catalog, 2 pages, 3 info, then per page: page, contents, image
  const pageObj = (i: number) => 4 + 3 * i;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${images.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`);
  // a hex string in UTF-16BE (with its byte-order mark), so Polish letters survive in the title
  const hex = [...title].flatMap(ch => { const c = ch.codePointAt(0)!; return c > 0xffff ? [0xd800 + ((c - 0x10000) >> 10), 0xdc00 + ((c - 0x10000) & 0x3ff)] : [c]; })
    .map(u => u.toString(16).padStart(4, '0')).join('');
  obj(3, `<< /Title <FEFF${hex}> /Producer (Emmanuel) >>`);
  images.forEach((im, i) => {
    const p = pageObj(i);
    const s = Math.min((PAGE_W - 2 * MARGIN) / im.width, (PAGE_H - 2 * MARGIN) / im.height);
    const w = im.width * s, h = im.height * s;
    const x = (PAGE_W - w) / 2, y = (PAGE_H - h) / 2;
    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`);
    obj(p + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[p + 2] = pos;
    push(`${p + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
    push(im.jpeg);
    push('\nendstream\nendobj\n');
  });
  const count = 4 + 3 * n;
  const xref = pos;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let k = 1; k < count; k++) table += `${String(offsets[k]).padStart(10, '0')} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return concat(parts, pos);
}

// ── ZIP ────────────────────────────────────────────────────────────

let CRC_TABLE: Uint32Array | null = null;

export function crc32(data: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** A ZIP archive storing `files` uncompressed (method 0), names in UTF-8. */
export function buildZip(files: readonly { name: string; data: Uint8Array }[], date = new Date()): Uint8Array {
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xffff;
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff;
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let pos = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);   // names are UTF-8
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, pos, true);
    central.push(new Uint8Array(cd.buffer), name);
    parts.push(new Uint8Array(local.buffer), name, f.data);
    pos += 30 + name.length + f.data.length;
  }
  const cdStart = pos;
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, cdStart, true);
  return concat([...parts, ...central, new Uint8Array(end.buffer)], pos + cdSize + 22);
}

function concat(parts: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// ── in the browser ─────────────────────────────────────────────────

export async function fetchBytes(url: string): Promise<Uint8Array> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** A PNG (or any image the browser reads) as a JPEG of at most `maxW` pixels' width. */
export async function toJpeg(bytes: Uint8Array, maxW = 3000, quality = 0.9): Promise<PdfImage> {
  const bmp = await createImageBitmap(new Blob([bytes as BlobPart]));
  const s = Math.min(1, maxW / bmp.width);
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', quality));
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}

/** Hand the browser a file to save. */
export function saveFile(data: Uint8Array | string, name: string, type: string): void {
  const blob = new Blob([data as BlobPart], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}
