/**
 * The inner mitochondrial membrane up close (DESIGN.md §24, Każda komórka · Energia): a lipid bilayer across the
 * picture, the space inside the crista above, the matrix below, and in the membrane the respiratory chain — complex I
 * (its long arm reaching into the matrix), complex II, complex III (a pair), cytochrome c shuttling above, complex IV
 * where oxygen takes the electrons and becomes water — and ATP synthase: its ring of eight c-subunits in the
 * membrane, the central stalk, the F₁ head of three α and three β in the matrix, the side stalk holding it.
 *
 *   lancuch  electrons (gold) walk the chain from NADH to oxygen; the complexes pump protons (aqua) up; they gather
 *   wirnik   protons flow back down through the ring and turn it; each third of a turn a β-subunit lets an ATP go
 *
 * The ring really turns (Noji 1997; ≈ 100 turns a second in animal mitochondria, Watt 2010) — drawn far slower, of
 * course, its pace rising with the scene's growth.
 */
import { AQUA, GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { blobPath, dot, partOf, phase, sparkle, strokeThrough, type P2 } from './draw';
import { t } from './i18n';

export const SYN = { x: 76, ringY: 0, headY: 36 };
const HALF = 150;

/** The electrons' way: NADH in the matrix → complex I → ubiquinone in the membrane → III → cytochrome c → IV → oxygen. */
const E_PATH: readonly P2[] = [[-60, 50], [-66, 36], [-74, 20], [-84, 2], [-66, 0], [-46, 1], [-28, 0], [-16, -4], [-14, -17], [0, -20], [16, -18], [24, -8], [24, 6], [26, 20], [32, 28]];
/** The pumps: where protons rise through the membrane (x), how many at once. */
const PUMPS: readonly (readonly [number, number, number])[] = [[-90, 4, 0.18], [-18, 2, 0.55], [24, 2, 0.8]];

function bakeMembrane(ctx: CanvasRenderingContext2D): void {
  // the space inside the crista (above) and the matrix (below)
  const up = ctx.createLinearGradient(0, -120, 0, -6);
  up.addColorStop(0, 'rgba(60,20,70,.95)');
  up.addColorStop(1, 'rgba(98,34,90,.95)');
  ctx.fillStyle = up;
  ctx.fillRect(-HALF - 260, -420, 2 * HALF + 520, 414);
  const dn = ctx.createLinearGradient(0, 6, 0, 100);
  dn.addColorStop(0, 'rgba(176,66,96,.95)');
  dn.addColorStop(1, 'rgba(110,36,82,.95)');
  ctx.fillStyle = dn;
  ctx.fillRect(-HALF - 260, 6, 2 * HALF + 520, 420);
  glowEllipse(ctx, '#ffb080', 0, 40, 160, 50, 0, 0.12);
  for (let i = 0; i < 260; i++) {
    const x = (hash(i * 3 + 1) * 2 - 1) * HALF, y = 10 + hash(i * 5 + 2) * 90;
    dot(ctx, x, y, 0.4 + 0.5 * hash(i + 7), '#ffe0d0', null, 0.12);
  }
  // the bilayer: two rows of heads with their tails meeting in the middle
  ctx.fillStyle = 'rgba(70,24,70,.95)';
  ctx.fillRect(-HALF - 260, -6, 2 * HALF + 520, 12);
  for (let x = -HALF - 120; x <= HALF + 120; x += 2.2) {
    for (const s of [-1, 1]) {
      ctx.strokeStyle = 'rgba(255,200,170,.28)';
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      ctx.moveTo(x, s * 4.6);
      ctx.lineTo(x + 0.4 * s, s * 0.6);
      ctx.moveTo(x + 0.6, s * 4.6);
      ctx.lineTo(x + 0.9, s * 0.8);
      ctx.stroke();
      dot(ctx, x, s * 5, 1.05, '#ffd2b8', null, 0.85);
    }
  }
  glowEllipse(ctx, '#ffe0c8', 0, -5, HALF, 2.5, 0, 0.12);
  glowEllipse(ctx, '#ffe0c8', 0, 5, HALF, 2.5, 0, 0.12);

  // complex I: the membrane arm and the long arm into the matrix
  protein(ctx, blobPath(-88, 0, 22, 8.5, 21, 0.06, 14), '#b9a2ff');
  protein(ctx, blobPath(-70, 24, 8, 19, 22, 0.08, 12, -0.35), '#b9a2ff');
  // complex II, mostly in the matrix
  protein(ctx, blobPath(-48, 12, 7.5, 11, 23, 0.1, 12), '#ff9cc0');
  // complex III, a pair
  protein(ctx, blobPath(-24, -1, 7, 14, 24, 0.08, 12), '#ffb38c');
  protein(ctx, blobPath(-10, -1, 7, 14, 25, 0.08, 12), '#ffb38c');
  // complex IV
  protein(ctx, blobPath(24, 0, 9.5, 15, 26, 0.08, 12), '#86dcd2');
  // ATP synthase: the a-subunit and the side stalk (still parts); the ring, stalk and head are drawn turning
  protein(ctx, blobPath(SYN.x + 15, 0, 4.6, 9, 27, 0.06, 10), '#ffe0a0');
  ctx.strokeStyle = 'rgba(255,230,180,.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(SYN.x + 16, 8);
  ctx.quadraticCurveTo(SYN.x + 22, 20, SYN.x + 17, SYN.headY - 12);
  ctx.stroke();
}

/** A protein: a translucent body lit from within with a bright rim. */
function protein(ctx: CanvasRenderingContext2D, p: Path2D, hex: string, a = 1): void {
  ctx.fillStyle = rgba(hex, 0.55 * a);
  ctx.fill(p);
  ctx.strokeStyle = rgba('#fff4ec', 0.75 * a);
  ctx.lineWidth = 0.6;
  ctx.stroke(p);
}

// ── the ring's turn: an integrator, so its pace can change without a jump ──
let lastT = -1, rot = 0;
function ringAngle(st: WorldState): number {
  const speed = 0.35 + 2.4 * st.g * st.g + (st.growing ? 0.4 : 0);
  if (lastT < 0 || st.time < lastT || st.time - lastT > 0.5) rot = st.time * speed;
  else rot += (st.time - lastT) * speed * (st.reduced ? 0.4 : 1);
  lastT = st.time;
  return rot;
}

/** ATP synthase drawn at its angle: the back of the ring, the ring, the front c-subunits, the stalk, the head. */
function drawSynthase(ctx: CanvasRenderingContext2D, ang: number, lit: number): void {
  const { x, ringY, headY } = SYN;
  const rx = 12, ry = 8;
  // the ring's back half
  for (let k = 0; k < 8; k++) {
    const th = ang + (k * TAU) / 8;
    if (Math.cos(th) >= 0) continue;
    const cx = x + rx * Math.sin(th);
    ctx.fillStyle = rgba('#d8b070', 0.5);
    ctx.fillRect(cx - 1.6, ringY - ry + 1, 3.2, 2 * ry - 2);
  }
  const ring = new Path2D();
  ring.ellipse(x, ringY, rx, ry, 0, 0, TAU);
  ctx.fillStyle = rgba('#ffd890', 0.3 + 0.15 * lit);
  ctx.fill(ring);
  for (let k = 0; k < 8; k++) {
    const th = ang + (k * TAU) / 8;
    const z = Math.cos(th);
    if (z < 0) continue;
    const cx = x + rx * Math.sin(th);
    const w = 3.4 * (0.45 + 0.55 * z);
    ctx.fillStyle = rgba(k === 0 ? '#fff1c9' : '#ffd98a', 0.55 + 0.4 * z);
    ctx.beginPath();
    ctx.ellipse(cx, ringY, w / 2, ry - 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff8e8', 0.6 * z);
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  ctx.strokeStyle = rgba('#fff4dc', 0.8);
  ctx.lineWidth = 0.6;
  ctx.stroke(ring);
  // the central stalk (γ), turning with the ring: its eccentric foot seen through the head
  ctx.strokeStyle = rgba('#ffe7a8', 0.95);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const ex = x + 3.5 * Math.sin(ang), ez = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(x, ringY + 4);
  ctx.quadraticCurveTo(x + 1.5 * Math.sin(ang), (ringY + headY) / 2, ex, headY - 2);
  ctx.stroke();
  // the head: three α and three β round it (the β's take turns making ATP)
  const active = Math.floor((((ang % TAU) + TAU) % TAU) / (TAU / 3));
  for (let k = 0; k < 6; k++) {
    const th = (k * TAU) / 6 + 0.3;
    const lx = x + 10 * Math.sin(th), ly = headY + 5.5 * Math.cos(th);
    const beta = k % 2 === 1;
    const on = beta && Math.floor(k / 2) === active;
    const p = blobPath(lx, ly, 6.6, 6.8, 40 + k, 0.08, 10);
    protein(ctx, p, beta ? '#ffcf7a' : '#c8b4ff', 0.9);
    if (on) glow(ctx, GOLD_HI, lx, ly, 9, 0.35 + 0.4 * lit);
  }
  glow(ctx, GOLD, ex, headY + 1, 5, 0.3 + 0.3 * (ez * 0.5 + 0.5));
  if (lit > 0.01) glowEllipse(ctx, GOLD, x, headY, 22, 16, 0, 0.18 * lit);
}

/** Protons gathered above (their number follows the growth), drifting a little. */
function drawProtonPool(ctx: CanvasRenderingContext2D, n: number, st: WorldState): void {
  for (let i = 0; i < n; i++) {
    const x = (hash(i * 3 + 501) * 2 - 1) * (HALF - 10);
    const y = -12 - hash(i * 7 + 503) * 44;
    const dx = 1.5 * Math.sin(st.time * 0.7 + i), dy = 1.2 * Math.cos(st.time * 0.6 + i * 1.3);
    dot(ctx, x + dx, y + dy, 1.15, AQUA, '#e8fbff', 0.85, 0.3);
    glow(ctx, AQUA, x + dx, y + dy, 3.4, 0.28);
  }
}

/** Protons flowing down through the ring, from the pool to the matrix. */
function drawProtonFlow(ctx: CanvasRenderingContext2D, ang: number, rate: number, st: WorldState): void {
  const n = Math.round(3 + 6 * rate);
  for (let i = 0; i < n; i++) {
    const f = (st.time * (0.25 + 0.5 * rate) + i / n) % 1;
    const x = SYN.x + 8 + 4 * Math.sin(ang + i), y = -22 + 40 * f;
    dot(ctx, x, y, 1.1, AQUA, '#e8fbff', 0.9 * Math.sin(f * Math.PI), 0.3);
    glow(ctx, AQUA, x, y, 3, 0.3 * Math.sin(f * Math.PI));
  }
}

/** ATP leaving the head: a gold bead with three small phosphates, drifting out into the matrix. */
function drawAtp(ctx: CanvasRenderingContext2D, ang: number, rate: number): void {
  const turns = ang / (TAU / 3);
  const n = Math.min(10, 4 + Math.round(6 * rate));
  for (let i = 0; i < n; i++) {
    const age = (turns - Math.floor(turns) + i) / n;
    if (age > 1) continue;
    const k = Math.floor(turns) - i;
    const dir = ((k % 3) + 3) % 3;
    const a0 = 0.3 + dir * (TAU / 3) + 1.05;
    const r = 12 + age * 30;
    const x = SYN.x + Math.sin(a0) * r, y = SYN.headY + 6 + Math.cos(a0) * r * 0.55 + age * 10;
    const a = Math.sin(age * Math.PI) * 0.95;
    dot(ctx, x, y, 1.6, GOLD_HI, '#ffffff', a, 0.3);
    for (let p = 0; p < 3; p++) dot(ctx, x + 2.2 + p * 1.5, y - 0.6 + (p % 2) * 1.2, 0.7, '#ffe6a0', null, a);
    glow(ctx, GOLD, x, y, 5, 0.4 * a);
  }
}

function drawChain(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  // the way, faint, then the walked part bright
  strokeThrough(ctx, E_PATH, '#ffe8b0', 0.6, 0.18);
  const walked = partOf(E_PATH, g);
  strokeThrough(ctx, walked, GOLD, 2.2, 0.25);
  strokeThrough(ctx, walked, GOLD_HI, 0.7, 0.85);
  let head: Pt = E_PATH[0];
  if (walked.length) head = walked[walked.length - 1];
  // electrons: sparks running along the walked way, and one at its head
  const n = 7;
  for (let i = 0; i < n; i++) {
    const f = ((st.time * 0.18 + i / n) % 1) * g;
    const p = partOf(E_PATH, f);
    if (!p.length) continue;
    const [x, y] = p[p.length - 1];
    dot(ctx, x, y, 0.9, GOLD_HI, null, 0.9);
    glow(ctx, GOLD, x, y, 3.2, 0.45);
  }
  sparkle(ctx, head[0], head[1], 5, 0.9);
  // cytochrome c on its little shuttle above, once the electrons reach it
  const cyt = phase(g, 0.5, 0.6);
  const cx = -14 + 36 * ((Math.sin(st.time * 0.8) + 1) / 2) * cyt;
  dot(ctx, cx, -17, 3, '#ff7a6a', '#ffe0d8', 0.9, 0.5);
  // the pumps lift protons from the matrix as the electrons pass them
  for (const [i, [px, count, at]] of PUMPS.entries()) {
    const on = phase(g, at - 0.08, at + 0.1);
    if (on <= 0) continue;
    for (let c = 0; c < count; c++) {
      const f = (st.time * 0.35 + c / count + i * 0.3) % 1;
      const x = px + (c - (count - 1) / 2) * 3.4, y = 24 - 46 * f;
      dot(ctx, x, y, 1.1, AQUA, '#e8fbff', on * Math.sin(f * Math.PI), 0.3);
      glow(ctx, AQUA, x, y, 3, 0.3 * on * Math.sin(f * Math.PI));
    }
  }
  drawProtonPool(ctx, Math.round(42 * g), st);
  // oxygen meets the electrons and the protons: water
  const water = phase(g, 0.82, 1);
  if (water > 0) {
    for (let i = 0; i < 4; i++) {
      const f = (st.time * 0.2 + i / 4) % 1;
      dot(ctx, 30 + i * 3 + f * 6, 26 + f * 18, 1.6, '#d8f0ff', '#ffffff', water * (1 - f), 0.3);
    }
    glow(ctx, '#d8f0ff', 26, 20, 8, 0.4 * water);
  }
  drawSynthase(ctx, ringAngle(st), 0.2 * g);
  return head;
}

function drawRotor(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  drawProtonPool(ctx, 34, st);
  const ang = ringAngle(st);
  drawProtonFlow(ctx, ang, g, st);
  drawSynthase(ctx, ang, 0.4 + 0.6 * g);
  drawAtp(ctx, ang, g);
  return [SYN.x, SYN.headY];
}

export const MEMBRANE_WORLD: WorldPainter = {
  depth: 3,
  lens: true,
  bake: ctx => bakeMembrane(ctx),
  draw(ctx, st) {
    if (st.deep > 0.01) glowEllipse(ctx, '#ffb090', 0, 30, 150, 50, 0, 0.08 * st.deep * (0.6 + 0.4 * st.breath));
    if (st.scene === 'wirnik') drawRotor(ctx, st);
    else drawChain(ctx, st);
  },
  focusAt(scene, g) {
    if (scene === 'wirnik') return [SYN.x, SYN.headY - 2];
    const p = partOf(E_PATH, Math.max(0.02, g));
    return p[p.length - 1];
  },
  counter: (scene, g) => (scene === 'wirnik' && g > 0.2 ? t('count.wirnik') : null),
};

