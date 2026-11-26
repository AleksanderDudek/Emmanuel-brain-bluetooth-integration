/**
 * The epidermis close up (DESIGN.md §24.3, depth 2, under the lens): the basement membrane over the dermis's
 * papillae with their capillary loops, and on it the living epidermis in columns of cells — the basal layer, where
 * cells divide; the spinous layer; the granular layer, where they flatten and fill with granules; the horny layer of
 * flat cells without nuclei, from which the topmost flake away.  Among the basal cells sit melanocytes, each reaching
 * with its dendrites to the keratinocytes around it; melanin rides in the cells as caps over their nuclei.  The
 * player's skin tone colours the cells and sets how much melanin they carry and how high.
 *
 *   podzial     basal cells divide; each daughter rises and the column steps up — the newborn rimmed in gold
 *   wedrowka    one newborn cell's journey (gold): up through the layers, flattening, losing its nucleus (≈ 39 days)
 *   luszczenie  the horny layer: enzymes loosen the topmost cells and they flake away — as many as are born below
 *   melanocyty  the melanocytes' dendrites reach out, granules travel along them (one to about 36 keratinocytes)
 *   parasole    melanin gathers as a cap over each nucleus, on the side of the sun; light from above meets it
 *
 * The cells move only as the scene grows (a time-lapse of weeks): nothing moves for the player without focus.
 */
import { clamp, ease } from '../kit/juice';
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, PEARL, TAU, VIOLET, glow, glowEllipse, hash, mix, rgba } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cnt } from './i18n';
import { airLight, seen, span, toneOf, type Tone } from './tone';

export const EPI_VIEW: Rect = { x: -48, y: -6, w: 96, h: 64 };
/** the melanin scenes look a little closer at the base */
export const EPI_BASE_VIEW: Rect = { x: -40, y: 6, w: 80, h: 50 };

/** the basement membrane's mean depth; above it the epidermis, below it the dermis */
const BM0 = 44;
/** The dermal–epidermal junction: the dermal papillae reach up where it is highest (smaller y). */
export const bm = (x: number): number => BM0 + 3.2 * Math.sin(x * 0.1 + 0.6);
/** a column of cells */
const COL = 7.6;
/** where a cell leaves the surface (rows of cells above the base) */
const TOPH = 16.5;
const RB = 6.2;

/** A row's height at a height (in rows) above the base: tall basal cells, the spinous layer, the flat granular cells, the thin horny plates. */
function rowH(h: number): number {
  if (h < 1) return RB;
  if (h < 5) return 5.4 - 0.22 * (h - 1);
  if (h < 6.5) return 3;
  return 1.2;
}
/** The height (world units) of the rows below a height. */
function cum(h: number): number {
  let s = Math.min(h, 1) * RB;
  if (h <= 1) return s;
  const b = Math.min(h, 5) - 1;
  s += b * 5.4 - 0.11 * b * b;
  if (h <= 5) return s;
  s += (Math.min(h, 6.5) - 5) * 3;
  if (h <= 6.5) return s;
  return s + (h - 6.5) * 1.2;
}
/** the skin's surface (the top of the horny layer) */
export const SURFACE = BM0 - cum(TOPH);

/** A cell's centre at a height in a column (the upper layers lie flat, the base follows the junction). */
function cellY(x: number, h: number): number {
  const base = bm(x) + (BM0 - bm(x)) * clamp(h / 5);
  return base - cum(h) - rowH(h) / 2;
}

/** The melanocytes: one every five columns, on the membrane between two basal cells. */
const MELANO_EVERY = 5;
const melanoX = (k: number): number => k * MELANO_EVERY * COL + COL / 2;
/** the column whose newborn cell the journey follows */
const HERO_COL = -2;

/** The conveyor's offset in a column (rows risen) for a scene at a growth: the cells move only as the scene grows. */
function offset(scene: string, c: number, g: number): number {
  const base = 0.37 * c + 0.13 * Math.sin(c * 1.7);
  if (scene === 'wedrowka') return base + 13 * g;
  if (scene === 'luszczenie') return base + 2.4 * g;
  if (scene === 'podzial') return base + divisions(c, g);
  return base;
}
/** the division times of a column in the dividing scene (two each, spread over it) */
const divAt = (c: number, k: number): number => 0.06 + (k + 0.15 + 0.7 * hash(c * 13 + k * 7 + 5)) * 0.42;
const DIV_LEN = 0.09;
function divisions(c: number, g: number): number {
  let n = 0;
  for (let k = 0; k < 2; k++) n += ease.inOutSine(clamp((g - divAt(c, k)) / DIV_LEN));
  return n;
}

interface Cell { x: number; y: number; w: number; ht: number; h: number; a: number; born: boolean; hero: boolean; rot: number }

function cellsOf(scene: string, c: number, g: number): Cell[] {
  const out: Cell[] = [];
  const oc = offset(scene, c, g);
  const ob = offset(scene, c, 0);
  const heroB = Math.floor(offset('wedrowka', HERO_COL, 0));
  for (let b = Math.ceil(oc - TOPH - 1.8); b <= Math.floor(oc); b++) {
    const hh = oc - b;
    const shift = (b & 1 ? COL / 2 : 0) * clamp(hh - 0.6);
    const x = c * COL + shift + 0.35 * Math.sin(b * 1.3 + c);
    let y = cellY(x, Math.min(hh, TOPH));
    let a = 1, rot = 0;
    if (hh > TOPH) {
      if (scene !== 'luszczenie' && scene !== 'wedrowka') continue;
      const k = hh - TOPH;
      y = cellY(x, TOPH) - k * 6.5;
      a = clamp(1 - k / 1.3) * (scene === 'luszczenie' ? 1 : 0.6);
      rot = (hash(b * 3 + c) - 0.5) * 0.5 * k;
    }
    if (a <= 0.01) continue;
    const hc = Math.min(hh, TOPH);
    const w = hc < 1 ? COL * 0.74 : hc < 5 ? COL * (1 + 0.03 * hc) : hc < 6.5 ? COL * 1.28 : COL * 1.56;
    const ht = hc < 1 ? RB * 1.02 : rowH(hc) * (hc < 6.5 ? 0.92 : 0.86);
    out.push({ x, y, w, ht, h: hh, a, born: b > Math.floor(ob), hero: scene === 'wedrowka' && c === HERO_COL && b === heroB, rot });
  }
  return out;
}

// ── the still layer: the dermis's papillae, their loops, the membrane ─────
function bake(ctx: CanvasRenderingContext2D, variant: string, look: string): void {
  const tone = toneOf(look);
  const X0 = -260, X1 = 260;
  // the dermis: a rose-plum ground that glows faintly from within
  ctx.beginPath();
  ctx.moveTo(X0, bm(X0));
  for (let x = X0; x <= X1; x += 1) ctx.lineTo(x, bm(x));
  ctx.lineTo(X1, 200);
  ctx.lineTo(X0, 200);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, BM0 - 4, 0, BM0 + 40);
  dg.addColorStop(0, '#6a2552');
  dg.addColorStop(0.35, '#4c1c46');
  dg.addColorStop(1, '#2a1030');
  ctx.fillStyle = dg;
  ctx.fill();
  // collagen of the papillary dermis: fine wavy threads catching the light
  for (let i = 0; i < 420; i++) {
    const x = X0 + hash(i * 19 + 3) * (X1 - X0);
    const y = bm(x) + 4 + hash(i * 23 + 4) * 40;
    const l = 5 + 9 * hash(i + 5);
    ctx.strokeStyle = i % 3 ? 'rgba(255,170,214,.12)' : 'rgba(255,220,236,.2)';
    ctx.lineWidth = i % 3 ? 0.5 : 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 1.1, x + l * 0.6, y + 1.1, x + l, y);
    ctx.stroke();
  }
  // the shallow network of vessels the loops rise from, a little deeper
  const op = ctx.globalCompositeOperation;
  for (const [y, col, w] of [[BM0 + 18.5, BLOOD, 1.1], [BM0 + 21, '#8a70f0', 1.3]] as const) {
    const p = new Path2D();
    for (let x = X0; x <= X1; x += 4) {
      const yy = y + 1.2 * Math.sin(x * 0.045 + (w > 1.2 ? 1.3 : 0));
      if (x === X0) p.moveTo(x, yy);
      else p.lineTo(x, yy);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(col, 0.16);
    ctx.lineWidth = w * 3;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(w > 1.2 ? '#b8a8ff' : mix(BLOOD_HI, '#ffd0c0', 0.3), 0.55);
    ctx.lineWidth = w * 0.6;
    ctx.stroke(p);
  }
  // a capillary loop up into every papilla (where the junction rises), warm red
  for (let k = -8; k <= 8; k++) {
    const cx = (Math.PI * 1.5 - 0.6 + TAU * k) / 0.1;
    if (cx < X0 || cx > X1) continue;
    const top = bm(cx) + 2.2;
    const p = new Path2D();
    const foot = BM0 + 18.5 + 1.2 * Math.sin(cx * 0.045) - top;
    p.moveTo(cx - 1.6, top + foot);
    p.bezierCurveTo(cx - 1.9, top + 6, cx - 1.3, top + 0.5, cx, top);
    p.bezierCurveTo(cx + 1.3, top + 0.5, cx + 1.9, top + 6, cx + 1.6, top + foot);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(BLOOD, 0.22);
    ctx.lineWidth = 2.4;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(mix(BLOOD_HI, '#ffd0c0', 0.3), 0.7);
    ctx.lineWidth = 0.7;
    ctx.stroke(p);
    glow(ctx, BLOOD, cx, top + 2, 6, 0.18);
  }
  // the basement membrane: a fine luminous line the basal cells stand on
  ctx.beginPath();
  for (let x = X0; x <= X1; x += 1) {
    if (x === X0) ctx.moveTo(x, bm(x) + 0.4);
    else ctx.lineTo(x, bm(x) + 0.4);
  }
  ctx.strokeStyle = rgba(mix(AQUA, PEARL, 0.5), 0.55);
  ctx.lineWidth = 0.5;
  ctx.stroke();
  // a faint warmth of the whole epidermis (its colour follows the tone)
  const eg = ctx.createLinearGradient(0, SURFACE - 2, 0, BM0 + 2);
  eg.addColorStop(0, rgba(tone.hi, 0.1));
  eg.addColorStop(1, rgba(tone.skin, 0.16));
  ctx.fillStyle = eg;
  ctx.fillRect(X0, SURFACE - 1, X1 - X0, BM0 - SURFACE + 2);
  // the air above, lit (more so where the sun is the subject)
  airLight(ctx, SURFACE - 1.5, 0.5, variant === 'sun' ? 1.6 : 1);
}

// ── what lives: the cells, the melanocytes, the light ─────────────
function cellFill(t: Tone, h: number): string {
  if (h < 1) return mix(t.skin, '#8fc8e8', 0.32);
  if (h < 5) return mix(t.skin, '#ffb2c2', 0.12 + 0.03 * h);
  if (h < 6.5) return mix(t.skin, '#ffd9b0', 0.32);
  return mix(t.hi, t.skin, 0.25);
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const tone = toneOf(st.look);
  const { scene, g } = st;
  const v = seen(ctx, 12);
  const c0 = Math.max(-40, Math.floor(v.x0 / COL) - 1), c1 = Math.min(40, Math.ceil(v.x1 / COL) + 1);
  const capK = scene === 'parasole' ? ease.outCubic(span(g, 0.05, 0.85)) : 1;
  const dendK = scene === 'melanocyty' ? ease.outCubic(span(g, 0.04, 0.8)) : 1;
  const nuclei = new Path2D();
  const gran = new Path2D();
  const kerat = new Path2D();
  const op = ctx.globalCompositeOperation;
  let hero: Cell | null = null;
  const caps: Pt[] = [];
  for (let c = c0; c <= c1; c++) {
    for (const cell of cellsOf(scene, c, g)) {
      const { x, y, w, ht, h, a } = cell;
      if (cell.hero) hero = cell;
      ctx.save();
      ctx.translate(x, y);
      if (cell.rot) ctx.rotate(cell.rot);
      ctx.beginPath();
      if (h < 1) ctx.ellipse(0, 0, w / 2, ht / 2, 0, 0, TAU);
      else {
        // flattened rounded plates; spinous cells a little angular
        const rx = w / 2, ry = ht / 2, k = h < 5 ? 0.62 : 0.8;
        ctx.moveTo(-rx, 0);
        ctx.bezierCurveTo(-rx, -ry * k * 1.6, -rx * k, -ry, 0, -ry);
        ctx.bezierCurveTo(rx * k, -ry, rx, -ry * k * 1.6, rx, 0);
        ctx.bezierCurveTo(rx, ry * k * 1.6, rx * k, ry, 0, ry);
        ctx.bezierCurveTo(-rx * k, ry, -rx, ry * k * 1.6, -rx, 0);
        ctx.closePath();
      }
      ctx.fillStyle = rgba(cellFill(tone, h), (h < 6.5 ? 0.78 : 0.6) * a);
      ctx.fill();
      const rim = cell.hero ? GOLD_HI : cell.born && scene === 'podzial' ? GOLD_HI : h < 1 ? AQUA : tone.hi;
      ctx.strokeStyle = rgba(rim, (cell.hero || (cell.born && scene === 'podzial') ? 0.95 : 0.42) * a);
      ctx.lineWidth = cell.hero ? 0.55 : cell.born && scene === 'podzial' ? 0.4 : 0.22;
      ctx.stroke();
      ctx.restore();
      // the nucleus (gone once the cell hardens), with melanin's cap on its sunward side
      if (h < 6.2) {
        const nr = h < 1 ? 1.5 : h < 5 ? 1.35 : 1.0;
        const ny = h < 1 ? y + 0.6 : y;
        nuclei.moveTo(x + nr * 1.1, ny);
        nuclei.ellipse(x, ny, nr * 1.1, Math.min(nr, ht * 0.32), 0, 0, TAU);
        if (h < 5 && capK > 0) caps.push([x, ny - nr * 0.9]);
      }
      if (h >= 5 && h < 6.5) {
        // keratohyalin granules: the granular layer's dark grains
        for (let k = -2; k <= 2; k++) {
          const gx = x + k * 1.3 + 0.3 * Math.sin(k * 3 + c);
          kerat.moveTo(gx + 0.28, y + 0.5);
          kerat.arc(gx, y + 0.5, 0.28, 0, TAU);
        }
      }
      // melanin carried higher in darker skin: a dust of granules in the upper cells
      if (h >= 5 && tone.mel > 0.45 && a > 0.3) {
        const n = Math.round((tone.mel - 0.35) * 5);
        for (let k = 0; k < n; k++) {
          const gx = x + (hash(c * 31 + k * 7 + Math.floor(h * 0 + 1)) - 0.5) * w * 0.7;
          const gy = y + (hash(c * 17 + k * 5) - 0.5) * ht * 0.5;
          const r = 0.2 * tone.size;
          gran.moveTo(gx + r, gy);
          gran.arc(gx, gy, r, 0, TAU);
        }
      }
    }
  }
  ctx.fillStyle = rgba('#4a2a6e', 0.72);
  ctx.fill(nuclei);
  ctx.fillStyle = rgba('#3a1e36', 0.7);
  ctx.fill(kerat);
  // the caps: granules gathered over each nucleus (fewer and smaller in lighter skin)
  if (caps.length) {
    const n = Math.round(4 + tone.mel * 8);
    ctx.fillStyle = rgba(tone.gran, (0.22 + 0.4 * tone.mel) * capK);
    for (const [cx, cy] of caps) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + 0.9, 1.75, 1.05, 0, Math.PI, TAU);
      ctx.ellipse(cx, cy + 1.25, 1.45, 0.55, 0, TAU, Math.PI, true);
      ctx.fill();
    }
    caps.forEach(([cx, cy], i) => {
      const m = Math.round(n * capK);
      for (let k = 0; k < m; k++) {
        const ang = Math.PI + (k + 0.5) / n * Math.PI;
        const rr = 1.5 + 0.45 * hash(i * 11 + k);
        const gx = cx + Math.cos(ang) * rr * 0.9, gy = cy + 0.9 + Math.sin(ang) * rr * 0.55;
        const r = 0.27 * tone.size;
        gran.moveTo(gx + r, gy);
        gran.arc(gx, gy, r, 0, TAU);
      }
    });
  }
  ctx.fillStyle = rgba(tone.gran, 0.92);
  ctx.fill(gran);
  if (scene === 'parasole' && capK > 0.02) {
    // a warm glint where the cap meets the light
    for (const [cx, cy] of caps) if (cy < BM0 - 4) glowEllipse(ctx, GOLD, cx, cy + 0.4, 2.2, 1.1, 0, 0.22 * capK * (0.6 + 0.4 * st.light));
  }
  // the melanocytes
  for (let k = -6; k <= 6; k++) {
    const mx = melanoX(k);
    if (mx < v.x0 - 20 || mx > v.x1 + 20) continue;
    melanocyte(ctx, mx, tone, dendK, st, k, scene === 'melanocyty' || scene === 'parasole' ? 1 : 0.5);
  }
  // the newborn's journey: its gold rim and a soft light
  if (hero) {
    const hc = hero as Cell;
    glow(ctx, GOLD, hc.x, hc.y, 7, 0.5 + 0.3 * (st.growing ? 1 : 0.3));
    glow(ctx, GOLD_HI, hc.x, hc.y, 2.5, 0.5);
  }
  // podzial: the dividing cells glow gold for their moment
  if (scene === 'podzial') {
    for (let c = c0; c <= c1; c++) {
      for (let k = 0; k < 2; k++) {
        const t = (g - divAt(c, k)) / DIV_LEN;
        if (t <= 0 || t >= 1.4) continue;
        const x = c * COL, y = bm(x) - RB / 2 - 0.4;
        const f = Math.sin(Math.min(1, t) * Math.PI);
        glow(ctx, GOLD, x, y - 1.5 * clamp(t), 5.5, 0.55 * f);
        // the two sets of chromosomes parting
        ctx.strokeStyle = rgba(GOLD_HI, 0.9 * f);
        ctx.lineWidth = 0.45;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(x - 1.4, y + s * 1.4 * clamp(t * 1.4));
          ctx.lineTo(x + 1.4, y + s * 1.4 * clamp(t * 1.4));
          ctx.stroke();
        }
      }
    }
  }
  // luszczenie: enzymes loosening the topmost cells, glints along the surface
  if (scene === 'luszczenie') {
    for (let i = 0; i < 18; i++) {
      const x = -60 + i * 7.1 + 2 * Math.sin(i * 2.3);
      const ph = (g * 3 + hash(i * 3 + 1)) % 1;
      const a = Math.sin(ph * Math.PI) * clamp(g * 6);
      if (a > 0.02) glow(ctx, AQUA, x, SURFACE + 1.6 + 0.6 * Math.sin(i), 2.2, 0.4 * a);
    }
  }
  // parasole: the light from above, meeting the caps
  if (scene === 'parasole') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const x = -44 + i * 11 + 3 * Math.sin(i * 1.9);
      const lg = ctx.createLinearGradient(x, SURFACE - 30, x + 6, SURFACE + 22);
      lg.addColorStop(0, 'rgba(255,226,160,0)');
      lg.addColorStop(0.55, `rgba(255,226,160,${(0.16 * (0.5 + 0.5 * capK)).toFixed(3)})`);
      lg.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.strokeStyle = lg;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, SURFACE - 30);
      ctx.lineTo(x + 6, SURFACE + 22 - 10 * capK);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = op;
  }
  // rest's deepening: warmth through the skin
  if (st.deep > 0.02) {
    glow(ctx, '#ffb08a', 0, BM0 - 14, 70, 0.08 * st.deep);
    glow(ctx, AQUA, 0, BM0 - 2, 40, 0.05 * st.deep);
  }
}

/** A melanocyte on the membrane: its body, its dendrites reaching up between the cells, granules travelling along them. */
function melanocyte(ctx: CanvasRenderingContext2D, x: number, tone: Tone, k: number, st: WorldState, seed: number, vis: number): void {
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * vis;
  const y = bm(x) - 2.6;
  const body = mix(tone.gran, VIOLET, 0.42);
  const dends: Pt[][] = [];
  for (let i = 0; i < 5; i++) {
    const ang = -Math.PI / 2 + (i - 2) * 0.42 + 0.12 * Math.sin(seed * 3 + i);
    const len = (9 + 7 * hash(seed * 7 + i)) * (i === 2 ? 1.35 : 1);
    const pts: Pt[] = [];
    for (let j = 0; j <= 6; j++) {
      const s = (j / 6) * len * k;
      const bend = 1.6 * Math.sin(j * 0.9 + i + seed);
      pts.push([x + Math.cos(ang) * s + bend * Math.cos(ang + Math.PI / 2) * (j / 6), y + Math.sin(ang) * s * 0.92]);
    }
    dends.push(pts);
  }
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pts of dends) {
    if (k <= 0.02) break;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(VIOLET, 0.22);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(mix(body, PEARL, 0.25), 0.85);
    ctx.lineWidth = 0.55;
    ctx.stroke();
    // granules travelling out along the dendrite (they move only as the scene grows)
    for (let j = 0; j < 3; j++) {
      const f = ((j / 3 + st.g * 2.2 + hash(seed + j)) % 1) * 0.96;
      const idx = f * (pts.length - 1), i0 = Math.floor(idx), fr = idx - i0;
      const a = pts[i0], b = pts[Math.min(pts.length - 1, i0 + 1)];
      ctx.beginPath();
      ctx.arc(a[0] + (b[0] - a[0]) * fr, a[1] + (b[1] - a[1]) * fr, 0.3 * tone.size, 0, TAU);
      ctx.fillStyle = rgba(tone.gran, 0.95);
      ctx.fill();
    }
  }
  glow(ctx, VIOLET, x, y, 6, 0.3 + 0.2 * (st.scene === 'melanocyty' ? st.light : 0.3));
  ctx.beginPath();
  ctx.ellipse(x, y, 2.4, 1.9, 0, 0, TAU);
  ctx.fillStyle = rgba(body, 0.95);
  ctx.fill();
  ctx.strokeStyle = rgba('#e8d4ff', 0.7);
  ctx.lineWidth = 0.3;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y + 0.2, 1.05, 0.85, 0, 0, TAU);
  ctx.fillStyle = 'rgba(40,20,60,.75)';
  ctx.fill();
  ctx.globalAlpha = ga;
}

/** The places a scene's names point to (world units). */
export const epiPt = {
  basal: (x: number): Pt => [x, bm(x) - RB / 2],
  membrane: (x: number): Pt => [x, bm(x) + 0.6],
  spinous: (x: number): Pt => [x, cellY(x, 3)],
  granular: (x: number): Pt => [x, cellY(x, 5.6)],
  corneum: (x: number): Pt => [x, cellY(x, 11)],
  surface: (x: number): Pt => [x, SURFACE + 0.4],
  melano: (k: number): Pt => [melanoX(k), bm(melanoX(k)) - 2.6],
  dermis: (x: number): Pt => [x, BM0 + 8],
};

/** The newborn's place on its journey (the growing point follows it). */
function heroAt(g: number): Pt {
  const oc = offset('wedrowka', HERO_COL, g);
  const b = Math.floor(offset('wedrowka', HERO_COL, 0));
  const hh = Math.min(TOPH - 0.2, oc - b);
  const x = HERO_COL * COL + (b & 1 ? COL / 2 : 0) * clamp(hh - 0.6) + 0.35 * Math.sin(b * 1.3 + HERO_COL);
  return [x, cellY(x, hh)];
}

export const EPI: WorldPainter = {
  depth: 2,
  lens: true,
  bake,
  draw,
  focusAt(scene, g) {
    if (scene === 'wedrowka') return heroAt(g);
    return SCENE_FOCUS[scene] ?? [0, 20];
  },
  counter(scene, g) {
    if (scene === 'wedrowka') return cnt('day', Math.round(39 * g));
    if (scene === 'melanocyty') return g > 0.08 ? cnt('unit36', Math.round(36 * span(g, 0.08, 0.85))) : null;
    if (scene === 'podzial') return g > 0.05 ? cnt('born', Math.round((1200 * g) / 10) * 10) : null;
    return null;
  },
};

/** The growing point of each scene of this world. */
export const SCENE_FOCUS: Record<string, Pt> = {
  podzial: [0, bm(0) - RB / 2],
  luszczenie: [0, SURFACE + 1.5],
  melanocyty: [melanoX(0), bm(melanoX(0)) - 2.6],
  parasole: [-COL, 24],
};

