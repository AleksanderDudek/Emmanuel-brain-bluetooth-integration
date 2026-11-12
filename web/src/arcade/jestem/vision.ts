/**
 * A vision's playable geometry, without the canvas (DESIGN §13.8): the window's arch, the mosaic's cells
 * that lie inside it, each cell's capacity for colour, its neighbours, and the fragments — the picture's
 * named parts for the eighteen declarations (scenes.ts), or colour-and-place clusters for a player's own
 * photo.  `autoNext` is the rule the colour follows when the player lets it flow by itself: from the
 * picture's heart outward, a fragment at a time, finishing what it began.
 *
 * Everything here is in the picture's own units (RULES.PW × RULES.PH), y down.
 */
import { inPoly, type Mosaic, type Pt } from '../kit/mosaic';
import { clamp } from '../kit/juice';
import { RULES } from './rules';
import type { Region } from './scenes';

export interface VCell {
  id: number;
  /** the mosaic's cell */
  m: number;
  poly: Pt[];
  /** the centre and the area of its visible part */
  cx: number;
  cy: number;
  area: number;
  /** colour it holds (units: a mean cell holds about 1) */
  cap: number;
  frag: number;
  /** neighbours inside the window */
  nb: number[];
  /** distance from the heart (picture units) */
  heartD: number;
}

export interface VFrag {
  /** the fragment's name key (`frag.<key>`), or `part<n>` for an own photo's clusters */
  key: string;
  cells: number[];
  cx: number;
  cy: number;
}

/** An edge of the leading: between two cells inside the window, or (b = -1) a cell's border with the frame. */
export interface VEdge { a: number; b: number; p: Pt; q: Pt }

export interface VisionGeo {
  w: number;
  h: number;
  heart: Pt;
  cells: VCell[];
  frags: VFrag[];
  edges: VEdge[];
}

// ── the window ───────────────────────────────────────────────────
/** The round arch: its radius, and how far down its sides reach (picture units). */
export const ARCH_R = RULES.archR * RULES.PW;
export const ARCH_H = ARCH_R - Math.sqrt(ARCH_R * ARCH_R - (RULES.PW / 2) ** 2);

/** Inside the window: below the arch's sides, or under its curve. */
export function inWindow(x: number, y: number, w: number = RULES.PW, h: number = RULES.PH): boolean {
  const k = w / RULES.PW;
  if (x < 0 || x > w || y > h) return false;
  if (y >= ARCH_H * k) return y >= 0;
  return (x - w / 2) ** 2 + (y - ARCH_R * k) ** 2 <= (ARCH_R * k) ** 2;
}

/** The arch's outline as points (picture units scaled by `k`), clockwise from the bottom left. */
export function windowOutline(k = 1, steps = 28): Pt[] {
  const w = RULES.PW * k, h = RULES.PH * k, r = ARCH_R * k, ah = ARCH_H * k;
  const pts: Pt[] = [{ x: 0, y: h }, { x: 0, y: ah }];
  const a0 = Math.atan2(ah - r, -w / 2), a1 = Math.atan2(ah - r, w / 2);
  for (let i = 1; i < steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    pts.push({ x: w / 2 + Math.cos(a) * r, y: r + Math.sin(a) * r });
  }
  pts.push({ x: w, y: ah }, { x: w, y: h });
  return pts;
}

// ── building ─────────────────────────────────────────────────────
/** The share of a cell inside the window, and the centre of that part (a 10 × 10 sample of its box). */
function visible(poly: readonly Pt[], w: number, h: number): { share: number; cx: number; cy: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const n = 10;
  let inP = 0, inW = 0, sx = 0, sy = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0), y = y0 + ((j + 0.5) / n) * (y1 - y0);
      if (!inPoly(poly, x, y)) continue;
      inP++;
      if (inWindow(x, y, w, h)) { inW++; sx += x; sy += y; }
    }
  }
  if (!inP) return { share: 0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  return { share: inW / inP, cx: inW ? sx / inW : (x0 + x1) / 2, cy: inW ? sy / inW : (y0 + y1) / 2 };
}

export interface BuildOptions {
  /** where the colour starts (picture units) */
  heart: Pt;
  /** the declaration's named parts (u, v tests in 0..1): the first that holds for a cell's centre */
  regions?: readonly Region[];
  /** each mosaic cell's mean colour (0..255), for an own photo's clusters */
  colors?: readonly { r: number; g: number; b: number }[];
}

/** The playable vision of a mosaic laid over the window. */
export function buildVision(m: Mosaic, o: BuildOptions): VisionGeo {
  const w = m.w, h = m.h;
  const ids = new Map<number, number>();
  const cells: VCell[] = [];
  for (const c of m.cells) {
    const vis = visible(c.poly, w, h);
    if (vis.share < RULES.inside) continue;
    ids.set(c.id, cells.length);
    cells.push({
      id: cells.length, m: c.id, poly: c.poly, cx: vis.cx, cy: vis.cy, area: c.area * vis.share, cap: 1, frag: 0, nb: [],
      heartD: Math.hypot(vis.cx - o.heart.x, vis.cy - o.heart.y),
    });
  }
  const mean = cells.reduce((s, c) => s + c.area, 0) / Math.max(1, cells.length);
  for (const c of cells) {
    c.cap = clamp(RULES.capBase + RULES.capArea * (c.area / Math.max(1e-9, mean)), RULES.capMin, RULES.capMax);
    c.nb = m.cells[c.m].neighbors.map(n => ids.get(n)).filter((n): n is number => n !== undefined);
  }
  const edges: VEdge[] = [];
  for (const e of m.edges) {
    const a = ids.get(e.a), b = e.b >= 0 ? ids.get(e.b) : undefined;
    if (a === undefined && b === undefined) continue;
    if (a !== undefined && b !== undefined) edges.push({ a, b, p: e.p, q: e.q });
    else edges.push({ a: (a ?? b)!, b: -1, p: e.p, q: e.q });
  }
  const frags = o.regions ? regionFrags(cells, o.regions, w, h) : clusterFrags(cells, m, o.colors ?? [], o.heart);
  return { w, h, heart: { ...o.heart }, cells, frags, edges };
}

/**
 * Fragments by the picture's named parts (empty parts are dropped).  The first part is the picture's
 * subject: it always keeps at least the cell nearest the heart, however coarse the mosaic.
 */
function regionFrags(cells: VCell[], regions: readonly Region[], w: number, h: number): VFrag[] {
  const groups = new Map<number, number[]>();
  for (const c of cells) {
    let r = regions.findIndex(g => g.test(c.cx / w, c.cy / h));
    if (r < 0) r = regions.length - 1;
    const list = groups.get(r) ?? [];
    list.push(c.id);
    groups.set(r, list);
  }
  if (!groups.has(0) && cells.length > 1) {
    const heart = cells.reduce((b, c) => (c.heartD < cells[b].heartD ? c.id : b), 0);
    for (const list of groups.values()) {
      const i = list.indexOf(heart);
      if (i < 0) continue;
      if (list.length > 1) {
        list.splice(i, 1);
        groups.set(0, [heart]);
      }
      break;
    }
  }
  const out: VFrag[] = [];
  for (const [r, list] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const fi = out.length;
    for (const id of list) cells[id].frag = fi;
    out.push(fragOf(regions[r].key, list, cells));
  }
  return out;
}

function fragOf(key: string, list: number[], cells: readonly VCell[]): VFrag {
  let sx = 0, sy = 0, a = 0;
  for (const id of list) { const c = cells[id]; sx += c.cx * c.area; sy += c.cy * c.area; a += c.area; }
  return { key, cells: list, cx: a ? sx / a : 0, cy: a ? sy / a : 0 };
}

/**
 * An own photo's fragments: k-means over the cells' place and colour (k = cells / fragPer, 3…6), seeded
 * deterministically (the cell nearest the heart, then the farthest from those chosen), ordered from the
 * heart outward and named "part1…".
 */
function clusterFrags(cells: VCell[], m: Mosaic, colors: readonly { r: number; g: number; b: number }[], heart: Pt): VFrag[] {
  const n = cells.length;
  if (!n) return [];
  const k = Math.max(1, Math.min(n, Math.round(clamp(n / RULES.fragPer, RULES.fragMin, RULES.fragMax))));
  const feat = cells.map(c => {
    const col = colors[c.m] ?? { r: 128, g: 128, b: 128 };
    return [c.cx / m.w, c.cy / m.h, (col.r / 255) * 0.45, (col.g / 255) * 0.45, (col.b / 255) * 0.45];
  });
  const d2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const first = cells.reduce((best, c) => (c.heartD < cells[best].heartD ? c.id : best), 0);
  const cent: number[][] = [feat[first].slice()];
  while (cent.length < k) {
    let far = 0, fd = -1;
    for (let i = 0; i < n; i++) {
      const dd = Math.min(...cent.map(c => d2(feat[i], c)));
      if (dd > fd) { fd = dd; far = i; }
    }
    cent.push(feat[far].slice());
  }
  const lab = new Array<number>(n).fill(0);
  for (let it = 0; it < 12; it++) {
    for (let i = 0; i < n; i++) {
      let bi = 0, bd = Infinity;
      for (let j = 0; j < k; j++) { const dd = d2(feat[i], cent[j]); if (dd < bd) { bd = dd; bi = j; } }
      lab[i] = bi;
    }
    for (let j = 0; j < k; j++) {
      const mem = feat.filter((_, i) => lab[i] === j);
      if (mem.length) cent[j] = cent[j].map((_, q) => mem.reduce((s, f) => s + f[q], 0) / mem.length);
    }
  }
  const groups = Array.from({ length: k }, (_, j) => lab.map((l, i) => (l === j ? i : -1)).filter(i => i >= 0)).filter(g => g.length);
  const frs = groups.map(g => fragOf('', g, cells));
  frs.sort((a, b) => Math.hypot(a.cx - heart.x, a.cy - heart.y) - Math.hypot(b.cx - heart.x, b.cy - heart.y));
  frs.forEach((f, i) => {
    f.key = `part${i + 1}`;
    for (const id of f.cells) cells[id].frag = i;
  });
  return frs;
}

// ── the colour's own way ─────────────────────────────────────────
/**
 * The cell the colour goes to next when nobody chooses: an unlit cell of the current fragment if it has one,
 * touching the light if it can, nearest the heart, a half-filled one first; then the next fragment the same
 * way.  -1 when every cell is lit.
 */
export function autoNext(g: VisionGeo, lit: readonly boolean[], ink: readonly number[], curFrag: number): number {
  const diag = Math.hypot(g.w, g.h);
  const anyLit = lit.some(Boolean);
  const fragLeft = curFrag >= 0 && g.frags[curFrag]?.cells.some(id => !lit[id]);
  let best = -1, bs = Infinity;
  for (const c of g.cells) {
    if (lit[c.id]) continue;
    const touch = !anyLit || c.nb.some(n => lit[n]);
    let s = c.heartD / diag;
    if (!touch) s += 0.35;
    if (fragLeft && c.frag !== curFrag) s += 1;
    s -= 0.3 * clamp(ink[c.id] / c.cap);
    if (s < bs) { bs = s; best = c.id; }
  }
  return best;
}

/**
 * The unlit cell for a tap at (x, y): the one under the finger, else the nearest unlit one — a tap on the
 * light still sends the colour somewhere useful (the smoke test's centre tap pours into the middle).
 */
export function pickAt(g: VisionGeo, lit: readonly boolean[], x: number, y: number): number {
  let best = -1, bd = Infinity;
  for (const c of g.cells) {
    if (lit[c.id]) continue;
    if (inPoly(c.poly, x, y)) return c.id;
    const d = Math.hypot(c.cx - x, c.cy - y);
    if (d < bd) { bd = d; best = c.id; }
  }
  return best;
}

/** The cell under a point (any state), or -1 outside the window's cells. */
export function cellUnder(g: VisionGeo, x: number, y: number): number {
  for (const c of g.cells) if (inPoly(c.poly, x, y)) return c.id;
  return -1;
}
