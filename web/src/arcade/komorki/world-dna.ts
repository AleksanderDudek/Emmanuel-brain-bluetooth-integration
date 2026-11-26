/**
 * The DNA (DESIGN.md §24, Każda komórka · Naprawa): a double helix lying across the picture inside the nucleus'
 * violet glow — two sugar-phosphate backbones winding round each other (a wide and a narrow groove), the base pairs as
 * rungs between them, A–T and G–C in two quiet colours — and the crews that keep it whole:
 *
 *   ksiega   a long stretch with dimmed, broken letters here and there; one by one a crew comes and each is lit again
 *            (tens of thousands of lesions a cell a day, by estimate — Tubbs & Nussenzweig 2017; Lindahl 1993)
 *   litera   base excision repair (Lindahl): a glycosylase slides in, flips the damaged base out and cuts it away; a
 *            polymerase puts in a new one, a ligase seals the strand
 *   odcinek  nucleotide excision repair (Sancar): UV has joined two neighbouring letters; the crew opens the helix,
 *            cuts the strand on both sides, lifts the short stretch away and a polymerase writes it anew
 */
import { AQUA, GOLD, GOLD_HI, LILAC, TAU, VIOLET, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { blobPath, dot, phase, sparkle, stagger } from './draw';
import { t } from './i18n';

const R = 13; // the helix's radius
const P = 34; // its pitch (one turn ≈ 10.5 base pairs)
const STEP = P / 10.5;
const PHI = 2.35; // the strands' offset: a wide and a narrow groove
const XMAX = 170;

/** The x of base pair i. */
export const bpX = (i: number): number => i * STEP;
const ang = (x: number): number => (x / P) * TAU;

/** The lesions in the long view (base-pair indices), repaired one after another. */
const LESIONS = [-27, -19, -12, -5, 3, 10, 17, 24];

interface BpState {
  /** 0 healthy … 1 damaged (dim, broken) */
  dmg: number;
  /** a gold glow of a fresh repair (0..1) */
  gold: number;
  /** the base on strand A missing (0 there … 1 gone) */
  goneA: number;
}
interface HelixOpts {
  /** extra separation of the strands at x (an opened bubble) */
  open?: (x: number) => number;
  /** strand A's segment hidden (cut away) at x, 0..1 */
  cutA?: (x: number) => number;
  /** strand A's segment gilded (new) at x, 0..1 */
  newA?: (x: number) => number;
  bp?: (i: number) => BpState | null;
  /** strand A's segment lifted away: the offset and alpha of [from, to] */
  lift?: { from: number; to: number; dy: number; a: number };
  x0?: number;
  x1?: number;
}

const strandA = (x: number, open = 0): [number, number] => {
  const a = ang(x);
  return [-(R + open) * Math.sin(a) - open * 0.6, Math.cos(a)];
};
const strandB = (x: number, open = 0): [number, number] => {
  const a = ang(x) + PHI;
  return [-(R + open) * Math.sin(a) + open * 0.6, Math.cos(a)];
};

/** Draw the helix between x0 and x1 with what each scene changes on it. */
function drawHelix(ctx: CanvasRenderingContext2D, o: HelixOpts, px: number): void {
  const x0 = o.x0 ?? -XMAX, x1 = o.x1 ?? XMAX;
  const open = o.open ?? (() => 0);
  const seg = 0.9;
  const backbone = (which: 0 | 1, front: boolean): void => {
    for (let x = x0; x < x1; x += seg) {
      const xm = x + seg / 2;
      const [ya, za] = which === 0 ? strandA(x, open(x)) : strandB(x, open(x));
      const [yb, zb] = which === 0 ? strandA(x + seg, open(x + seg)) : strandB(x + seg, open(x + seg));
      const z = (za + zb) / 2;
      if ((z >= 0) !== front) continue;
      let alpha = 1, gold = 0, dy = 0;
      if (which === 0) {
        const cut = o.cutA?.(xm) ?? 0;
        alpha *= 1 - cut;
        gold = o.newA?.(xm) ?? 0;
        if (o.lift && xm >= o.lift.from && xm <= o.lift.to) {
          dy = o.lift.dy;
          alpha = o.lift.a;
        }
      }
      if (alpha <= 0.01) continue;
      const light = 0.35 + 0.65 * (z * 0.5 + 0.5);
      const w = 2.6 * (0.75 + 0.25 * z);
      const col = gold > 0.01 ? (gold > 0.5 ? GOLD_HI : GOLD) : which === 0 ? '#e6d4ff' : '#ffd6e8';
      ctx.strokeStyle = rgba(col, alpha * light * (gold > 0.01 ? 1 : 0.9));
      ctx.lineWidth = w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, ya + dy);
      ctx.lineTo(x + seg, yb + dy);
      ctx.stroke();
      if (front && z > 0.6) {
        ctx.strokeStyle = rgba('#ffffff', alpha * 0.35 * (z - 0.6) * 2.5);
        ctx.lineWidth = Math.max(0.4, 0.8 / px);
        ctx.beginPath();
        ctx.moveTo(x, ya + dy - 0.6);
        ctx.lineTo(x + seg, yb + dy - 0.6);
        ctx.stroke();
      }
      if (gold > 0.01) glow(ctx, GOLD, xm, (ya + yb) / 2 + dy, 3.5, 0.25 * gold);
    }
  };
  backbone(0, false);
  backbone(1, false);
  // the rungs: each base pair two coloured halves meeting in the middle
  const i0 = Math.ceil(x0 / STEP), i1 = Math.floor(x1 / STEP);
  for (let i = i0; i <= i1; i++) {
    const x = bpX(i);
    const op = open(x);
    const [ya, za] = strandA(x, op);
    const [yb, zb] = strandB(x, op);
    const z = (za + zb) / 2;
    const st = o.bp?.(i) ?? null;
    const dmg = st?.dmg ?? 0, gold = st?.gold ?? 0, goneA = st?.goneA ?? 0;
    const kind = Math.floor(hash(i * 1.7 + 3) * 4); // A T G C
    const cA = kind < 2 ? '#9fe9ff' : '#ffcf7a', cB = kind < 2 ? '#c59bff' : '#ff9cbc';
    const mid = (ya + yb) / 2 + (op > 0.5 ? 0 : 0);
    const light = 0.45 + 0.55 * (z * 0.5 + 0.5);
    const w = 1.5 * (0.8 + 0.2 * z);
    ctx.lineCap = 'round';
    // half on strand A
    if (goneA < 0.99) {
      ctx.strokeStyle = rgba(gold > 0.02 ? GOLD_HI : dmg > 0.02 ? '#ff4d7a' : cA, light * (1 - goneA) * (dmg > 0.02 ? 0.95 : 0.8));
      ctx.lineWidth = dmg > 0.02 ? w * 1.5 : w;
      ctx.beginPath();
      ctx.moveTo(x, ya);
      ctx.lineTo(x, op > 1 ? ya + (mid - ya) * 0.75 : mid - (dmg > 0.5 ? 1.6 * Math.sign(yb - ya) : 0));
      ctx.stroke();
    }
    // half on strand B
    ctx.strokeStyle = rgba(cB, light * 0.8);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, yb);
    ctx.lineTo(x, op > 1 ? yb + (mid - yb) * 0.75 : mid);
    ctx.stroke();
    if (dmg > 0.02) {
      glow(ctx, '#ff4d7a', x, ya * 0.65 + yb * 0.35, 7, 0.55 * dmg);
      dot(ctx, x, ya * 0.65 + yb * 0.35, 1.1, '#ffd0dc', null, 0.8 * dmg);
    }
    if (gold > 0.02) {
      glow(ctx, GOLD, x, mid, 7, 0.6 * gold);
      sparkle(ctx, x, mid, 4.2, 0.7 * gold);
    }
  }
  backbone(1, true);
  backbone(0, true);
}

function bakeDna(ctx: CanvasRenderingContext2D, variant: string): void {
  // the nucleus' violet glow round the helix and soft out-of-focus chromatin behind it
  ctx.fillStyle = 'rgba(30,16,60,.9)';
  ctx.fillRect(-420, -420, 840, 840);
  glowEllipse(ctx, '#7a5ad0', 0, 0, 260, 160, 0, 0.4);
  glowEllipse(ctx, '#c59bff', 0, 0, 160, 40, 0, 0.12);
  for (let k = 0; k < 14; k++) {
    const y = -160 + k * (320 / 13) + 6 * hash(k + 901);
    if (Math.abs(y) < 26) continue;
    ctx.strokeStyle = rgba(k % 2 ? '#b49cff' : '#ff9cbc', variant === 'close' ? 0.035 : 0.045);
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let x = -200; x <= 200; x += 6) {
      const yy = y + 9 * Math.sin(x * 0.05 + k * 1.7) + 4 * Math.sin(x * 0.13 + k);
      if (x === -200) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 400; i++) dot(ctx, (hash(i * 3 + 911) * 2 - 1) * 220, (hash(i * 7 + 913) * 2 - 1) * 180, 0.4 + 0.6 * hash(i + 917), '#e8dcff', null, 0.12);
}

/** A repair protein: a soft translucent body with a rim (aqua for those that find the damage, lilac for the writers). */
function crew(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hex: string, a: number, seed: number): void {
  if (a <= 0.01) return;
  const p = blobPath(x, y, r, r * 0.86, seed, 0.12, 12);
  ctx.fillStyle = rgba(hex, 0.38 * a);
  ctx.fill(p);
  ctx.strokeStyle = rgba('#f4fbff', 0.8 * a);
  ctx.lineWidth = 0.5;
  ctx.stroke(p);
  glow(ctx, hex, x, y, r * 1.8, 0.3 * a);
}

// ── ksiega: the long stretch ────────────────────────────────────
function drawBook(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  const n = LESIONS.length;
  const state = new Map<number, BpState>();
  let front: Pt = [bpX(LESIONS[0]), 0];
  for (const [k, i] of LESIONS.entries()) {
    const fix = stagger(g, k, n, 0.16, 0.02, 0.98);
    const gold = fix > 0 && fix < 1 ? Math.sin(fix * Math.PI) : fix >= 1 ? 0.25 + 0.15 * Math.sin(st.time * 1.5 + k) : 0;
    state.set(i, { dmg: 1 - fix, gold: fix > 0.5 ? gold : 0, goneA: 0 });
    // the crew: comes from above, rests on the letter, leaves
    if (fix > 0 && fix < 1) {
      const a = Math.sin(fix * Math.PI);
      crew(ctx, bpX(i), -R - 5 - 10 * (1 - a), 4.4, AQUA, a, 60 + k);
      front = [bpX(i), 0];
    }
  }
  drawHelix(ctx, { bp: i => state.get(i) ?? null }, st.px);
  return front;
}

// ── litera: base excision ───────────────────────────────────────
function drawLetter(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  const slide = phase(g, 0, 0.2), flip = phase(g, 0.2, 0.42), fill = phase(g, 0.48, 0.76), seal = phase(g, 0.78, 0.96);
  const x = bpX(0);
  const [ya] = strandA(x);
  drawHelix(ctx, {
    x0: -70, x1: 70,
    bp: i => (i === 0 ? { dmg: flip > 0 ? 0 : 1, gold: fill > 0 ? fill * (1 - 0.6 * seal) + (seal >= 1 ? 0.3 : 0) : 0, goneA: flip > 0 && fill <= 0 ? 1 : fill > 0 ? 1 - fill : 0 } : null),
    newA: xx => (Math.abs(xx - x) < 2.4 ? seal * (st.after > 0 ? 0.5 : 1) : 0),
  }, st.px);
  // the damaged base turning out of the helix and away
  if (flip > 0 && flip < 1) {
    const out = flip;
    const bx = x + 4 * out, by = ya - 10 * out;
    dot(ctx, bx, by, 1.8, '#a04070', '#ffc0d0', 1 - out * 0.8, 0.4);
    glow(ctx, '#ff5470', bx, by, 4, 0.35 * (1 - out));
  }
  // the glycosylase slides along the DNA to the letter, then the polymerase, then the ligase
  const gly = slide * (1 - phase(g, 0.44, 0.52));
  crew(ctx, -30 + 30 * slide, ya - 9, 6.5, AQUA, gly, 71);
  const pol = phase(g, 0.44, 0.52) * (1 - phase(g, 0.76, 0.82));
  crew(ctx, x + 1, ya - 9, 7.5, '#c59bff', pol, 72);
  const lig = phase(g, 0.76, 0.82) * (1 - phase(g, 0.97, 1));
  crew(ctx, x - 1, ya - 7, 5, '#ffe6a0', lig, 73);
  if (seal > 0 && seal < 1) sparkle(ctx, x, ya, 5, 0.9);
  if (flip <= 0) glow(ctx, '#ff4d7a', x, ya * 0.6, 8, 0.4);
  return g < 0.2 ? [-30 + 30 * slide, ya - 9] : [x, ya];
}

// ── odcinek: nucleotide excision ────────────────────────────────
const CUT_L = -16, CUT_R = 9;
function drawStretch(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  const gather = phase(g, 0, 0.22), cut = phase(g, 0.24, 0.4), lift = phase(g, 0.4, 0.55), write = phase(g, 0.55, 0.88), close = phase(g, 0.86, 1);
  const bubble = gather * (1 - close);
  const open = (x: number): number => 3.5 * bubble * Math.exp(-(((x + 3) / 14) ** 2));
  const writtenTo = CUT_L + (CUT_R - CUT_L) * write;
  const dimerOn = lift < 1;
  drawHelix(ctx, {
    x0: -90, x1: 90,
    open,
    cutA: x => (x > CUT_L && x < CUT_R ? (lift >= 1 ? (x < writtenTo ? 0 : 1) : 0) : 0),
    newA: x => (x > CUT_L && x < CUT_R && lift >= 1 && x < writtenTo ? 1 - 0.5 * close + (st.after > 0 ? -0.3 : 0) : 0),
    lift: lift > 0 && lift < 1 ? { from: CUT_L, to: CUT_R, dy: -16 * lift, a: 1 - lift } : undefined,
    bp: i => {
      const x = bpX(i);
      if (x <= CUT_L || x >= CUT_R) return null;
      const isDimer = i === -1 || i === 0;
      if (lift < 1) return { dmg: isDimer && dimerOn ? 1 : 0, gold: 0, goneA: lift > 0 ? lift : 0 };
      return { dmg: 0, gold: x < writtenTo ? 0.6 * (1 - close) : 0, goneA: x < writtenTo ? 0 : 1 };
    },
  }, st.px);
  // the dimer: two letters joined, a violet glow and a kink
  if (dimerOn) {
    const [y0] = strandA(bpX(-1), open(bpX(-1)));
    const [y1] = strandA(bpX(0), open(bpX(0)));
    const dy = -16 * lift;
    ctx.strokeStyle = rgba('#d08cff', 0.95 * (1 - lift));
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bpX(-1), y0 * 0.55 + dy);
    ctx.lineTo(bpX(0), y1 * 0.55 + dy);
    ctx.stroke();
    glow(ctx, VIOLET, (bpX(-1) + bpX(0)) / 2, (y0 + y1) * 0.3 + dy, 7, 0.55 * (1 - lift));
  }
  // the crew: finders (aqua), the opener (lilac pair), then the cutters; a polymerase writes
  const team = gather * (1 - phase(g, 0.5, 0.6));
  crew(ctx, -24, -R - 8, 6, AQUA, team, 81);
  crew(ctx, -4, -R - 11, 7.5, LILAC, team, 82);
  crew(ctx, 14, -R - 7, 5.5, '#ff9cbc', team, 83);
  if (cut > 0 && cut < 1) {
    sparkle(ctx, CUT_L, strandA(CUT_L, open(CUT_L))[0], 4.5, Math.sin(cut * Math.PI));
    sparkle(ctx, CUT_R, strandA(CUT_R, open(CUT_R))[0], 4.5, Math.sin(cut * Math.PI));
  }
  const pol = write > 0 && write < 1 ? 1 : write >= 1 ? 1 - close : 0;
  const [wy] = strandA(writtenTo, open(writtenTo));
  crew(ctx, writtenTo, wy - 8, 7, '#c59bff', pol, 84);
  if (g < 0.24) return [-3, -R - 6];
  if (g < 0.55) return [(CUT_L + CUT_R) / 2, -12 * lift - 6];
  return [writtenTo, wy];
}

export const DNA_WORLD: WorldPainter = {
  depth: 2,
  lens: true,
  bake: (ctx, variant) => bakeDna(ctx, variant),
  draw(ctx, st) {
    glowEllipse(ctx, '#b49cff', 0, 0, 160, 30, 0, 0.06 + 0.08 * st.deep * (0.6 + 0.4 * st.breath));
    if (st.scene === 'litera') drawLetter(ctx, st);
    else if (st.scene === 'odcinek') drawStretch(ctx, st);
    else drawBook(ctx, st);
  },
  focusAt(scene, g) {
    if (scene === 'litera') return g < 0.2 ? [-30 + 30 * phase(g, 0, 0.2), strandA(0)[0] - 9] : [0, strandA(0)[0]];
    if (scene === 'odcinek') return g < 0.55 ? [-3, -R - 4] : [CUT_L + (CUT_R - CUT_L) * phase(g, 0.55, 0.88), strandA(0)[0]];
    const k = Math.min(LESIONS.length - 1, Math.floor(g * LESIONS.length));
    return [bpX(LESIONS[k]), 0];
  },
  counter: (scene, g) => (scene === 'ksiega' && g > 0.15 ? t('count.ksiega') : null),
};

/** Where a label can point on the helix: strand A's y at base pair i. */
export const strandAY = (i: number): number => strandA(bpX(i))[0];
export const LESION_X = LESIONS.map(bpX);
