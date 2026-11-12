/**
 * Mosaics for the visualisation games (DESIGN.md §13.2): Voronoi tiles over a picture, and the
 * analysis that turns a picture into a mosaic — each tile's colour, an edge map, a pencil sketch and
 * a dark veil.  Rozświetl breaks a dark mosaic open along its cracks; Ja jestem… colours a sketch
 * cell by cell.  Pure functions on plain numbers and pixel arrays (no DOM), except `cellPath`.
 *
 * Coordinates are the mosaic's own units (0..w × 0..h, y down); a game scales them to the screen.
 * Pictures are `Pixels` (ImageData-compatible: width, height, RGBA bytes).
 */

export interface Pt { x: number; y: number }

export interface MosaicCell {
  id: number;
  /** the convex polygon of the tile */
  poly: Pt[];
  /** its centroid and area */
  cx: number;
  cy: number;
  area: number;
  /** the Voronoi site (seed) the tile belongs to: `cellAt` finds the nearest site */
  sx: number;
  sy: number;
  /** ids of the tiles sharing an edge with this one */
  neighbors: number[];
  /** the centroid's distance from the mosaic's centre: 0 in the middle, 1 in a corner */
  ring: number;
}

/** An edge between two tiles (`b` = -1: the frame). */
export interface MosaicEdge { a: number; b: number; p: Pt; q: Pt }

export interface Mosaic { w: number; h: number; cells: MosaicCell[]; edges: MosaicEdge[] }

/** RGBA pixels, row by row (ImageData has this shape). */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray }

export interface SeedOptions {
  /** density: tiles are smaller where it is higher (0..1; e.g. `detailWeight`) */
  weight?: (x: number, y: number) => number;
  /** Lloyd steps that even the tiles out (default 2) */
  relax?: number;
}

const EPS = 1e-9;

// ── geometry ─────────────────────────────────────────────────────────────────────

/** Signed area (positive for a clockwise polygon on screen, y down). */
function signedArea(poly: readonly Pt[]): number {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  return a / 2;
}

function centroid(poly: readonly Pt[]): { x: number; y: number; area: number } {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const cross = poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    a += cross;
    cx += (poly[j].x + poly[i].x) * cross;
    cy += (poly[j].y + poly[i].y) * cross;
  }
  if (Math.abs(a) < EPS) {
    const n = Math.max(1, poly.length);
    return { x: poly.reduce((s, p) => s + p.x, 0) / n, y: poly.reduce((s, p) => s + p.y, 0) / n, area: 0 };
  }
  return { x: cx / (3 * a), y: cy / (3 * a), area: Math.abs(a / 2) };
}

/** Inside a convex polygon (either orientation), the border included. */
export function inPoly(poly: readonly Pt[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const c = (poly[i].x - poly[j].x) * (y - poly[j].y) - (poly[i].y - poly[j].y) * (x - poly[j].x);
    if (Math.abs(c) < 1e-9) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

interface LabelledPoly { pts: Pt[]; labels: number[] }   // labels[k]: the edge from pts[k] to pts[k + 1]

/** Keep the side of the bisector of `a` and `b` nearer to `a` (Sutherland–Hodgman on one line), labelling new edges `label`. */
function clipToSite(poly: LabelledPoly, a: Pt, b: Pt, label: number): LabelledPoly {
  const nx = b.x - a.x, ny = b.y - a.y;
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const side = (p: Pt) => (p.x - mx) * nx + (p.y - my) * ny;   // ≤ 0: nearer to a
  const pts: Pt[] = [], labels: number[] = [];
  const n = poly.pts.length;
  for (let k = 0; k < n; k++) {
    const P = poly.pts[k], Q = poly.pts[(k + 1) % n];
    const sp = side(P), sq = side(Q);
    const inP = sp <= 1e-9, inQ = sq <= 1e-9;
    if (inP) {
      pts.push(P);
      labels.push(poly.labels[k]);
    }
    if (inP !== inQ) {
      const t = sp / (sp - sq);
      const I = { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t };
      pts.push(I);
      labels.push(inP ? label : poly.labels[k]);
    }
  }
  return { pts, labels };
}

/** The Voronoi tiles of `seeds` clipped to the w × h frame, with neighbours and shared edges. */
export function buildMosaic(w: number, h: number, seeds: readonly Pt[]): Mosaic {
  const cx0 = w / 2, cy0 = h / 2, half = Math.hypot(w, h) / 2;
  const cells: MosaicCell[] = [];
  const labelled: LabelledPoly[] = [];
  for (let i = 0; i < seeds.length; i++) {
    let poly: LabelledPoly = { pts: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], labels: [-1, -1, -1, -1] };
    const s = seeds[i];
    // nearer seeds first: they cut the most, so later clips have fewer vertices to test
    const order = seeds.map((_, j) => j).filter(j => j !== i).sort((p, q) => {
      const dp = (seeds[p].x - s.x) ** 2 + (seeds[p].y - s.y) ** 2, dq = (seeds[q].x - s.x) ** 2 + (seeds[q].y - s.y) ** 2;
      return dp - dq;
    });
    for (const j of order) {
      const o = seeds[j];
      if (Math.abs(o.x - s.x) < EPS && Math.abs(o.y - s.y) < EPS) continue;   // a twin seed: the first one keeps the tile
      // a seed farther than twice the farthest vertex cannot cut the tile any more
      let far = 0;
      for (const p of poly.pts) far = Math.max(far, (p.x - s.x) ** 2 + (p.y - s.y) ** 2);
      if ((o.x - s.x) ** 2 + (o.y - s.y) ** 2 > 4 * far + EPS) break;
      poly = clipToSite(poly, s, o, j);
      if (poly.pts.length < 3) break;
    }
    // drop zero-length edges (a clip through a vertex)
    const pts: Pt[] = [], labels: number[] = [];
    for (let k = 0; k < poly.pts.length; k++) {
      const P = poly.pts[k], Q = poly.pts[(k + 1) % poly.pts.length];
      if (Math.hypot(Q.x - P.x, Q.y - P.y) < 1e-7) continue;
      pts.push(P);
      labels.push(poly.labels[k]);
    }
    labelled.push({ pts, labels });
    const c = centroid(pts);
    cells.push({
      id: i, poly: pts, cx: c.x, cy: c.y, area: c.area, sx: s.x, sy: s.y, neighbors: [],
      ring: Math.min(1, Math.hypot(c.x - cx0, c.y - cy0) / half),
    });
  }
  const edges: MosaicEdge[] = [];
  for (let i = 0; i < labelled.length; i++) {
    const { pts, labels } = labelled[i];
    const near = new Set<number>();
    for (let k = 0; k < pts.length; k++) {
      const b = labels[k];
      const P = pts[k], Q = pts[(k + 1) % pts.length];
      if (b < 0) edges.push({ a: i, b: -1, p: P, q: Q });
      else {
        near.add(b);
        if (i < b) edges.push({ a: i, b, p: P, q: Q });
      }
    }
    cells[i].neighbors = [...near].sort((a, b) => a - b);
  }
  // keep the neighbourhood symmetric (a sliver edge may exist on one side only)
  for (const c of cells) for (const n of c.neighbors) if (!cells[n].neighbors.includes(c.id)) cells[n].neighbors.push(c.id);
  for (const c of cells) c.neighbors.sort((a, b) => a - b);
  return { w, h, cells, edges };
}

/**
 * `n` seeds spread evenly over the frame (best-candidate sampling), denser where `weight` is high,
 * then evened out by `relax` Lloyd steps (each moves a seed most of the way to its tile's centroid).
 */
export function mosaicSeeds(w: number, h: number, n: number, rng: () => number, opts: SeedOptions = {}): Pt[] {
  const count = Math.max(1, Math.round(n));
  const weight = opts.weight ?? (() => 1);
  const seeds: Pt[] = [];
  const tries = 14;
  for (let i = 0; i < count; i++) {
    let best: Pt | null = null, bestScore = -1;
    for (let t = 0; t < (i === 0 ? 1 : tries); t++) {
      const p = { x: (0.02 + 0.96 * rng()) * w, y: (0.02 + 0.96 * rng()) * h };
      let d = Infinity;
      for (const s of seeds) d = Math.min(d, Math.hypot(s.x - p.x, s.y - p.y));
      if (!seeds.length) d = 1;
      const score = d * (0.2 + Math.max(0, Math.min(1, weight(p.x, p.y))));
      if (score > bestScore) { bestScore = score; best = p; }
    }
    seeds.push(best!);
  }
  const relax = opts.relax ?? 2;
  let cur = seeds;
  for (let r = 0; r < relax; r++) {
    const m = buildMosaic(w, h, cur);
    cur = m.cells.map(c => (c.area > 0
      ? { x: c.sx + (c.cx - c.sx) * 0.7, y: c.sy + (c.cy - c.sy) * 0.7 }
      : { x: c.sx, y: c.sy }));
  }
  return cur;
}

/** `mosaicSeeds` + `buildMosaic`. */
export function makeMosaic(w: number, h: number, n: number, rng: () => number, opts: SeedOptions = {}): Mosaic {
  return buildMosaic(w, h, mosaicSeeds(w, h, n, rng, opts));
}

/** The tile under a point (the nearest site; points outside the frame get the nearest tile). */
export function cellAt(m: Mosaic, x: number, y: number): number {
  let best = 0, bd = Infinity;
  for (const c of m.cells) {
    const d = (c.sx - x) ** 2 + (c.sy - y) ** 2;
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}

/** A convex polygon moved inward by `d` along every edge (it shrinks toward its centroid when too small). */
export function insetPoly(poly: readonly Pt[], d: number): Pt[] {
  const n = poly.length;
  if (n < 3 || d <= 0) return poly.map(p => ({ ...p }));
  const c = centroid(poly);
  const orient = signedArea(poly) >= 0 ? 1 : -1;
  const lines: { px: number; py: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < n; i++) {
    const P = poly[i], Q = poly[(i + 1) % n];
    const dx = Q.x - P.x, dy = Q.y - P.y, len = Math.hypot(dx, dy) || 1;
    // inward normal: for a clockwise polygon on screen (y down) it is (-dy, dx)
    const nx = (-dy / len) * orient, ny = (dx / len) * orient;
    lines.push({ px: P.x + nx * d, py: P.y + ny * d, dx, dy });
  }
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const L1 = lines[(i - 1 + n) % n], L2 = lines[i];
    const den = L1.dx * L2.dy - L1.dy * L2.dx;
    if (Math.abs(den) < EPS) { out.push({ x: L2.px, y: L2.py }); continue; }
    const t = ((L2.px - L1.px) * L2.dy - (L2.py - L1.py) * L2.dx) / den;
    out.push({ x: L1.px + L1.dx * t, y: L1.py + L1.dy * t });
  }
  const ok = out.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && inPoly(poly, p.x, p.y))
    && Math.sign(signedArea(out)) === Math.sign(signedArea(poly)) && Math.abs(signedArea(out)) < Math.abs(signedArea(poly));
  if (ok) return out;
  // too small to offset: shrink toward the centroid instead
  const r = Math.sqrt(Math.max(c.area, EPS) / Math.PI);
  const k = Math.max(0, 1 - d / Math.max(r, EPS));
  return poly.map(p => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }));
}

/** A Path2D of a tile in screen space (`scale` and offset), optionally inset (browser only). */
export function cellPath(cell: MosaicCell, scale = 1, ox = 0, oy = 0, inset = 0): Path2D {
  const pts = inset > 0 ? insetPoly(cell.poly, inset / scale) : cell.poly;
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(ox + p.x * scale, oy + p.y * scale) : path.moveTo(ox + p.x * scale, oy + p.y * scale)));
  path.closePath();
  return path;
}

/**
 * A tile broken into about `k` shards for a burst: a fan from a point near the middle, cut at random
 * places along the border (each shard keeps the border's corners between its cuts).
 */
export function shards(cell: MosaicCell, k: number, rng: () => number): Pt[][] {
  const poly = cell.poly, n = poly.length;
  const count = Math.max(2, Math.round(k));
  const r = Math.sqrt(Math.max(cell.area, EPS) / Math.PI);
  const hub = { x: cell.cx + (rng() - 0.5) * r * 0.5, y: cell.cy + (rng() - 0.5) * r * 0.5 };
  const center = inPoly(poly, hub.x, hub.y) ? hub : { x: cell.cx, y: cell.cy };
  // perimeter positions of the cuts, evenly spread with jitter
  const lens = poly.map((p, i) => Math.hypot(poly[(i + 1) % n].x - p.x, poly[(i + 1) % n].y - p.y));
  const per = lens.reduce((s, l) => s + l, 0);
  const off = rng() * per;
  const cuts = Array.from({ length: count }, (_, i) => (off + (i + 0.5 + (rng() - 0.5) * 0.7) * per / count) % per).sort((a, b) => a - b);
  const at = (s: number): { p: Pt } => {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      if (s <= acc + lens[i] || i === n - 1) {
        const t = lens[i] > 0 ? Math.min(1, (s - acc) / lens[i]) : 0;
        const A = poly[i], B = poly[(i + 1) % n];
        return { p: { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t } };
      }
      acc += lens[i];
    }
    return { p: { ...poly[0] } };
  };
  const cum: number[] = [];
  let acc = 0;
  for (let i = 0; i < n; i++) { cum.push(acc); acc += lens[i]; }
  const out: Pt[][] = [];
  for (let c = 0; c < cuts.length; c++) {
    const s0 = cuts[c], s1 = c + 1 < cuts.length ? cuts[c + 1] : cuts[0] + per;
    // the border's corners between the two cuts, in order along the border
    const corners: { s: number; p: Pt }[] = [];
    for (let k = 0; k < n; k++) {
      for (const s of [cum[k], cum[k] + per]) if (s > s0 + 1e-9 && s < s1 - 1e-9) corners.push({ s, p: poly[k] });
    }
    corners.sort((u, v) => u.s - v.s);
    out.push([{ ...center }, at(s0).p, ...corners.map(q => ({ ...q.p })), at(s1 % per).p]);
  }
  return out;
}

/**
 * About `n` jagged crack lines inside a tile, from `from` toward its border (each ends on the border):
 * a game draws a growing share of each line as the light presses.
 */
export function cracks(cell: MosaicCell, from: Pt, n: number, rng: () => number): Pt[][] {
  const poly = cell.poly;
  const start = inPoly(poly, from.x, from.y) ? from : { x: cell.cx, y: cell.cy };
  const r = Math.sqrt(Math.max(cell.area, EPS) / Math.PI);
  const step = Math.max(r / 5, 0.5);
  const count = Math.max(1, Math.round(n));
  const base = rng() * Math.PI * 2;
  const out: Pt[][] = [];
  for (let i = 0; i < count; i++) {
    let ang = base + (i / count) * Math.PI * 2 + (rng() - 0.5) * (Math.PI / count);
    const line: Pt[] = [{ ...start }];
    let p = { ...start };
    for (let guard = 0; guard < 60; guard++) {
      ang += (rng() - 0.5) * 0.9;
      const q = { x: p.x + Math.cos(ang) * step * (0.7 + rng() * 0.6), y: p.y + Math.sin(ang) * step * (0.7 + rng() * 0.6) };
      if (!inPoly(poly, q.x, q.y)) {
        line.push(borderHit(poly, p, q));
        break;
      }
      line.push(q);
      p = q;
    }
    if (line.length > 1) out.push(line);
  }
  return out;
}

/** Where the segment p→q (p inside, q outside) leaves a convex polygon. */
function borderHit(poly: readonly Pt[], p: Pt, q: Pt): Pt {
  let lo = 0, hi = 1;
  for (let k = 0; k < 24; k++) {
    const m = (lo + hi) / 2;
    if (inPoly(poly, p.x + (q.x - p.x) * m, p.y + (q.y - p.y) * m)) lo = m; else hi = m;
  }
  return { x: p.x + (q.x - p.x) * lo, y: p.y + (q.y - p.y) * lo };
}

// ── pictures ─────────────────────────────────────────────────────────────────────

/** The part of a picture (iw × ih) that covers a w × h frame, centred (like CSS `object-fit: cover`). */
export function fitCover(iw: number, ih: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale, sh = h / scale;
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh };
}

const lumOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** Each tile's mean colour (0..255) and luminance (0..1), sampling the picture fitted to the mosaic (cover). */
export function cellColors(m: Mosaic, img: Pixels): { r: number; g: number; b: number; lum: number }[] {
  const fit = fitCover(img.width, img.height, m.w, m.h);
  const kx = fit.sw / m.w, ky = fit.sh / m.h;
  return m.cells.map(c => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of c.poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const stepX = Math.max((maxX - minX) / 14, EPS), stepY = Math.max((maxY - minY) / 14, EPS);
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = minY + stepY / 2; y < maxY; y += stepY) {
      for (let x = minX + stepX / 2; x < maxX; x += stepX) {
        if (!inPoly(c.poly, x, y)) continue;
        const ix = Math.min(img.width - 1, Math.max(0, Math.floor(fit.sx + x * kx)));
        const iy = Math.min(img.height - 1, Math.max(0, Math.floor(fit.sy + y * ky)));
        const o = (iy * img.width + ix) * 4;
        r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; n++;
      }
    }
    if (!n) {
      const ix = Math.min(img.width - 1, Math.max(0, Math.floor(fit.sx + c.cx * kx)));
      const iy = Math.min(img.height - 1, Math.max(0, Math.floor(fit.sy + c.cy * ky)));
      const o = (iy * img.width + ix) * 4;
      r = img.data[o]; g = img.data[o + 1]; b = img.data[o + 2]; n = 1;
    }
    r /= n; g /= n; b /= n;
    return { r, g, b, lum: lumOf(r, g, b) };
  });
}

function grayOf(img: Pixels): Float32Array {
  const n = img.width * img.height, out = new Float32Array(n), d = img.data;
  for (let i = 0; i < n; i++) out[i] = lumOf(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  return out;
}

/** A box blur of radius `r`, three passes (≈ Gaussian), in place on a copy. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const rad = Math.max(1, Math.round(r));
  const a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {               // horizontal
      let acc = 0;
      const row = y * w;
      for (let x = -rad; x <= rad; x++) acc += a[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        b[row + x] = acc / (2 * rad + 1);
        acc += a[row + Math.min(w - 1, x + rad + 1)] - a[row + Math.max(0, x - rad)];
      }
    }
    for (let x = 0; x < w; x++) {               // vertical
      let acc = 0;
      for (let y = -rad; y <= rad; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = acc / (2 * rad + 1);
        acc += b[Math.min(h - 1, y + rad + 1) * w + x] - b[Math.max(0, y - rad) * w + x];
      }
    }
  }
  return a;
}

/** Edge strength per pixel, 0..1 (Sobel on luminance, scaled by its 98th percentile). */
export function edgeMap(img: Pixels): Float32Array {
  const w = img.width, h = img.height, g = grayOf(img), out = new Float32Array(w * h);
  const at = (x: number, y: number) => g[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  let max = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      const v = Math.hypot(gx, gy);
      out[y * w + x] = v;
      if (v > max) max = v;
    }
  }
  if (max <= EPS) return out;
  // the 98th percentile, from a histogram (robust against a few very hard edges)
  const bins = new Uint32Array(256);
  for (const v of out) bins[Math.min(255, Math.floor((v / max) * 255))]++;
  let acc = 0, p98 = max;
  for (let i = 0; i < 256; i++) {
    acc += bins[i];
    if (acc >= out.length * 0.98) { p98 = Math.max(EPS, ((i + 1) / 256) * max); break; }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, out[i] / p98);
  return out;
}

/**
 * A density for `mosaicSeeds` from an edge map (iw × ih) laid over a w × h mosaic (cover): high where
 * the picture has detail, so the tiles are smaller there.  Values 0.25..1, smooth.
 */
export function detailWeight(edges: Float32Array, iw: number, ih: number, w: number, h: number): (x: number, y: number) => number {
  const G = 24, gw = G, gh = Math.max(2, Math.round(G * (h / w)));
  const fit = fitCover(iw, ih, w, h);
  const grid = new Float32Array(gw * gh);
  const counts = new Uint32Array(gw * gh);
  const stepX = Math.max(1, Math.floor(fit.sw / (gw * 6))), stepY = Math.max(1, Math.floor(fit.sh / (gh * 6)));
  for (let y = Math.floor(fit.sy); y < fit.sy + fit.sh && y < ih; y += stepY) {
    for (let x = Math.floor(fit.sx); x < fit.sx + fit.sw && x < iw; x += stepX) {
      const cx = Math.min(gw - 1, Math.floor(((x - fit.sx) / fit.sw) * gw));
      const cy = Math.min(gh - 1, Math.floor(((y - fit.sy) / fit.sh) * gh));
      grid[cy * gw + cx] += edges[y * iw + x];
      counts[cy * gw + cx]++;
    }
  }
  let max = EPS;
  for (let i = 0; i < grid.length; i++) { grid[i] = counts[i] ? grid[i] / counts[i] : 0; max = Math.max(max, grid[i]); }
  const smooth = blur(grid, gw, gh, 1);
  let smax = EPS;
  for (const v of smooth) smax = Math.max(smax, v);
  return (x: number, y: number) => {
    const gx = Math.min(gw - 1, Math.max(0, (x / w) * gw - 0.5)), gy = Math.min(gh - 1, Math.max(0, (y / h) * gh - 0.5));
    const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
    const fx = gx - x0, fy = gy - y0;
    const v = smooth[y0 * gw + x0] * (1 - fx) * (1 - fy) + smooth[y0 * gw + x1] * fx * (1 - fy)
      + smooth[y1 * gw + x0] * (1 - fx) * fy + smooth[y1 * gw + x1] * fx * fy;
    return 0.25 + 0.75 * Math.min(1, v / smax);
  };
}

/** A small deterministic grain (−1..1) for paper. */
const grain = (x: number, y: number) => {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) & 0xffff) / 32768 - 1;
};

/**
 * A pencil sketch of a picture on paper: the "colour dodge" of the luminance by its blurred negative
 * (soft graphite shading), strengthened along the edges, inked in `ink` on `paper`, with a fine grain.
 */
export function sketch(img: Pixels, opts: { paper?: readonly [number, number, number]; ink?: readonly [number, number, number]; strength?: number } = {}): Pixels {
  const w = img.width, h = img.height, n = w * h;
  const paper = opts.paper ?? [246, 238, 222], ink = opts.ink ?? [58, 50, 44];
  const strength = opts.strength ?? 1;
  const g = grayOf(img);
  const inv = new Float32Array(n);
  for (let i = 0; i < n; i++) inv[i] = 1 - g[i];
  const soft = blur(inv, w, h, Math.max(2, Math.round(Math.min(w, h) * 0.012)));
  const edges = edgeMap(img);
  const out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dodge = Math.min(1, g[i] / Math.max(1e-3, 1 - soft[i]));
      let dark = (1 - dodge) * 1.15 + edges[i] * 0.55 * strength;
      dark = Math.max(0, Math.min(1, dark)) ** 0.9;
      const gr = grain(x, y) * 5;
      const o = i * 4;
      out[o] = paper[0] + (ink[0] - paper[0]) * dark + gr;
      out[o + 1] = paper[1] + (ink[1] - paper[1]) * dark + gr;
      out[o + 2] = paper[2] + (ink[2] - paper[2]) * dark + gr;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

/**
 * The dark veil of a picture (Rozświetl's "before" when the player gave only the bright "after"):
 * desaturated, darkened, softened and tinted toward a cold grey.
 */
export function veil(img: Pixels, opts: { dark?: number; desaturate?: number; tint?: readonly [number, number, number]; soften?: number } = {}): Pixels {
  const w = img.width, h = img.height, n = w * h;
  const dark = opts.dark ?? 0.42, desat = opts.desaturate ?? 0.85, tint = opts.tint ?? [58, 66, 86];
  const chan = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const r = img.data[i * 4], gg = img.data[i * 4 + 1], b = img.data[i * 4 + 2];
    const l = lumOf(r, gg, b) * 255;
    const rgb = [r, gg, b];
    for (let c = 0; c < 3; c++) {
      const v = rgb[c] + (l - rgb[c]) * desat;            // toward grey
      chan[c][i] = (v * dark) * 0.75 + tint[c] * 0.25 * (0.5 + dark);
    }
  }
  const r = opts.soften ?? Math.max(1, Math.round(Math.min(w, h) * 0.004));
  const soft = chan.map(c => blur(c, w, h, r));
  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = soft[0][i];
    out[i * 4 + 1] = soft[1][i];
    out[i * 4 + 2] = soft[2][i];
    out[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data: out };
}
