/**
 * The body of light seen whole (DESIGN.md §24, Lekkość i siła): the figure standing, seen from the front (or from
 * behind — a featureless figure looks the same — with its spine and shoulder blades), or lying asleep at night, in
 * the silhouette the player chose.  World units: the figure's ×100 (geo.ts), the crown at (0, 0).
 *
 *   oddech    the lungs fill with light; CO₂ rides the blood to them and leaves with each exhale as bubbles of light
 *   sen       asleep: leptin from the fat tissue (gold) and ghrelin from the stomach (rose) reach the hypothalamus
 *   lopatki   from behind: the rhomboids and the middle trapezius light and draw the shoulder blades back and together
 *   gorset    the deep corset: transversus abdominis wraps, then the obliques, then the rectus
 *   wszedzie  the store of fat (honey) lightens evenly over the whole body, not only where the belly was exercised
 *   trzewny   the fat round the organs of the belly shrinks with regular movement
 *   lekkosc   the whole: breath leaving, the long muscles lit
 *   postac    the whole: light rising from the soles to the crown, the body upright in a quiet aura
 */
import { BLOOD, GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, rgba, smoothPath } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { bubble, figureLight, growSparks, lightLine, motes, phase, sparkle, stagger, wave, wpx } from './draw';
import { F, PLACE, airways, frontPath, halfAt, lookOf, lungShape, lying, scapula, up, type Look, type P } from './geo';
import { CO2, GHRELIN, HONEY_DEEP, HONEY_FAT, LEPTIN, MUSCLE, NIGHT, PEARL_W } from './palette';

const W = (p: P): [number, number] => [p[0] * F, p[1] * F];

// ── cached shapes ────────────────────────────────────────────────
const paths = new Map<string, Path2D>();
function bodyPath(look: Look, lie = false): Path2D {
  const k = `${look}|${lie ? 'lie' : 'up'}`;
  let p = paths.get(k);
  if (!p) paths.set(k, (p = frontPath(look, lie ? lying : up)));
  return p;
}
function polyPath(pts: readonly P[], map: (x: number, y: number) => [number, number] = up): Path2D {
  const p = new Path2D();
  const m = pts.map(([x, y]) => map(x, y));
  smoothClosed(p, m);
  return p;
}
function smoothClosed(p: Path2D, m: readonly (readonly [number, number])[]): void {
  const n = m.length;
  const mid = (i: number): [number, number] => [(m[i % n][0] + m[(i + 1) % n][0]) / 2, (m[i % n][1] + m[(i + 1) % n][1]) / 2];
  const s = mid(n - 1);
  p.moveTo(s[0], s[1]);
  for (let i = 0; i < n; i++) {
    const e = mid(i);
    p.quadraticCurveTo(m[i][0], m[i][1], e[0], e[1]);
  }
  p.closePath();
}
const lungPaths = new Map<string, Path2D[]>();
function lungs(look: Look): Path2D[] {
  let l = lungPaths.get(look);
  if (!l) lungPaths.set(look, (l = [polyPath(lungShape(-1, look)), polyPath(lungShape(1, look))]));
  return l;
}

/** Points inside a polygon (figure units), deterministic: the alveoli's clusters, motes in the body. */
function inside(poly: readonly P[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const alveoliCache = new Map<string, [number, number][]>();
function alveoli(look: Look): [number, number][] {
  let a = alveoliCache.get(look);
  if (a) return a;
  a = [];
  for (const side of [-1, 1] as const) {
    const poly = lungShape(side, look);
    for (let i = 0; a.length < (side < 0 ? 26 : 52) && i < 600; i++) {
      const x = side * (0.012 + 0.066 * hash(i * 3 + (side > 0 ? 71 : 13))), y = 0.2 + 0.18 * hash(i * 7 + (side > 0 ? 19 : 5));
      if (inside(poly, x, y) && Math.abs(x) > 0.02) a.push(W([x, y]));
    }
  }
  alveoliCache.set(look, a);
  return a;
}
/** Points spread inside the body (the torso and limbs), for motes and the fat's light. */
const bodyPtsCache = new Map<string, [number, number][]>();
function bodyPoints(look: Look): [number, number][] {
  let a = bodyPtsCache.get(look);
  if (a) return a;
  a = [];
  for (let i = 0; a.length < 90 && i < 2000; i++) {
    const y = 0.2 + 0.72 * hash(i * 5 + 3);
    const hw = halfAt(look, y);
    let x = (hash(i * 11 + 7) * 2 - 1) * hw * 0.82;
    if (y > 0.54) x = (hash(i * 13 + 1) > 0.5 ? 1 : -1) * (0.02 + (hw - 0.025) * hash(i * 17 + 2)); // a leg each
    a.push(W([x, y]));
  }
  // the arms
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1, k = hash(i * 23 + 5);
    a.push(W([side * (0.112 + 0.045 * k), 0.23 + 0.24 * k]));
  }
  bodyPtsCache.set(look, a);
  return a;
}

// ── the breath ───────────────────────────────────────────────────
/**
 * The breath's fullness (0 out … 1 in) and how strongly it flows out now (0..1), without memory (several canvases
 * draw this world): in rest the engine's own breath, the out-flow strongest as the lungs empty; else a calm 5 s cycle
 * (12 breaths a minute, Meerman & Brown) whose out-breath is known from its phase.
 */
function breathOf(st: WorldState): { b: number; out: number } {
  const rest = Math.abs(st.breath - 0.5) > 1e-4;
  if (rest) return { b: st.breath, out: 0.25 + 0.75 * (1 - st.breath) };
  const ph = (st.time / 5) * TAU;
  return { b: 0.5 + 0.5 * Math.cos(ph), out: st.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(ph) };
}

// ── the still layer ──────────────────────────────────────────────
function bake(ctx: CanvasRenderingContext2D, variant: string, lk: string): void {
  const look = lookOf(lk);
  if (variant === 'night') {
    // the night round the sleeper: a deep blue haze and a few far stars
    const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 110);
    g.addColorStop(0, 'rgba(70,80,170,.20)');
    g.addColorStop(0.6, 'rgba(40,40,120,.10)');
    g.addColorStop(1, 'rgba(20,20,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-140, -110, 280, 220);
    for (let i = 0; i < 70; i++) {
      const x = -130 + 260 * hash(i * 3 + 901), y = -100 + 200 * hash(i * 7 + 902);
      if (Math.abs(y) < 22 && Math.abs(x) < 58) continue;
      ctx.fillStyle = `rgba(226,230,255,${(0.25 + 0.5 * hash(i + 903) ** 2).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(x, y, wpx(ctx, 0.6 + 1.1 * hash(i * 5 + 904) ** 3), 0, TAU);
      ctx.fill();
    }
    // the bed of light under the body
    glowEllipse(ctx, '#8c8cff', 0, 0, 66, 20, 0, 0.16);
    figureLight(ctx, bodyPath(look, true), -50, 50, { horizontal: true, alpha: 0.95 });
    return;
  }
  // the ground's warmth under the feet
  glowEllipse(ctx, '#ffb89a', 0, 99.5, 26, 3.2, 0, 0.2);
  figureLight(ctx, bodyPath(look), 0, 100);
  ctx.save();
  ctx.clip(bodyPath(look));
  if (variant === 'back') {
    // the spine from behind: the vertebrae as small beads of light down the midline
    for (let i = 0; i < 24; i++) {
      const y = 15.5 + i * 1.55;
      ctx.fillStyle = `rgba(255,236,226,${(0.22 + 0.08 * Math.sin(i)).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, y, 0.95, 0.55, 0, 0, TAU);
      ctx.fill();
    }
  } else {
    // the breastbone and the ribs, very faint
    ctx.strokeStyle = 'rgba(255,236,226,.10)';
    ctx.lineWidth = wpx(ctx, 1);
    ctx.beginPath();
    ctx.moveTo(0, 20.5);
    ctx.lineTo(0, 30);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const y = 21 + i * 2.2, w = 4 + i * 0.9;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 0.8, y);
        ctx.quadraticCurveTo(s * w, y - 1.2, s * (w + 2.5), y + 2.5);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ── the scenes ───────────────────────────────────────────────────
function drawLungs(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, k: number, br: { b: number; out: number }): void {
  const fill = 0.25 + 0.55 * k;
  const swell = 1 + 0.03 * (br.b - 0.5);
  for (const [i, p] of lungs(look).entries()) {
    ctx.save();
    const cx = i ? 4.5 : -4.5, cy = 29;
    ctx.translate(cx, cy);
    ctx.scale(swell, swell);
    ctx.translate(-cx, -cy);
    const g = ctx.createLinearGradient(0, 19, 0, 38);
    g.addColorStop(0, rgba(PEARL_W, 0.22 * fill));
    g.addColorStop(0.6, rgba('#ffc4c8', 0.2 * fill));
    g.addColorStop(1, rgba('#c7a6ff', 0.16 * fill));
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = rgba('#ffe6ee', 0.25 + 0.45 * fill);
    ctx.lineWidth = 0.9 / st.px;
    ctx.stroke(p);
    ctx.restore();
  }
  // the airways
  for (const line of airways()) lightLine(ctx, line.map(W), 0.75 / st.px * 1.6, '#ffe9f0', 0.25 + 0.5 * k, 0.3);
  // the alveoli's clusters breathe
  const al = alveoli(look);
  const shown = Math.round(al.length * (0.25 + 0.75 * k));
  for (let i = 0; i < shown; i++) {
    const [x, y] = al[i];
    const tw = st.reduced ? 0.6 : 0.5 + 0.5 * Math.sin(st.time * 1.3 + i * 2.1);
    glow(ctx, '#ffd6e6', x, y, 1.7 + 0.5 * br.b, 0.18 + 0.25 * k * tw);
    ctx.fillStyle = rgba('#fff3f6', 0.25 + 0.35 * k);
    ctx.beginPath();
    ctx.arc(x, y, 0.42, 0, TAU);
    ctx.fill();
  }
}

/** The breath's bubbles: CO₂ leaving at the mouth and rising (stronger while breathing out). */
function drawExhale(ctx: CanvasRenderingContext2D, st: WorldState, k: number, br: { out: number }, scale = 1): void {
  const n = Math.round(3 + 15 * k);
  const [mx, my] = W(PLACE.mouth);
  glowEllipse(ctx, CO2, mx, my - 8 * scale, 7 * scale, 10 * scale, 0, (0.08 + 0.22 * k) * (0.35 + 0.65 * br.out));
  for (let i = 0; i < n; i++) {
    const life = st.reduced ? (i + 0.5) / n : ((st.time * 0.16 + hash(i * 3.7)) % 1);
    const side = hash(i * 9.1) > 0.5 ? 1 : -1;
    const sway = st.reduced ? 0 : Math.sin(st.time * 0.9 + i) * 1.2;
    const x = mx + side * (1 + 9 * life * hash(i * 2.3 + 1)) * scale + sway * life;
    const y = my - 2 * scale - 26 * life * scale;
    const r = (0.6 + 1.1 * hash(i * 5.3)) * (0.7 + 0.6 * life) * scale;
    bubble(ctx, x, y, r, (0.3 + 0.7 * br.out) * Math.sin(Math.PI * life) * (0.4 + 0.6 * k), st.px);
  }
}

/** Blood bringing CO₂ from the body to the lungs: rose motes riding up to the heart and into the lungs. */
const BLOOD_PATHS: readonly P[][] = [
  [[-10, 46], [-5, 38], [1.8, 28], [-4, 27]],
  [[10, 46], [6, 38], [1.8, 28], [6, 28]],
  [[-14, 32], [-6, 29], [1.8, 27.5], [-5, 31]],
  [[14, 32], [7, 29], [1.8, 27.5], [5, 31]],
];

function oddech(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, br: { b: number; out: number }): void {
  const g = st.g;
  drawLungs(ctx, st, look, phase(g, 0, 0.5), br);
  const kBlood = phase(g, 0.15, 0.6);
  BLOOD_PATHS.forEach((p, i) => motes(ctx, p, 3, st.time, 0.6, 0.55, '#ff8aa0', 0.45 * kBlood + 0.1, i * 13, st.reduced));
  // the heart, a soft warm light between the lungs
  glow(ctx, BLOOD, 1.8, 27.5, 3.4, 0.16 + 0.12 * kBlood * wave(st.time, 1, 0, st.reduced));
  drawExhale(ctx, st, phase(g, 0.35, 1), br);
  if (st.growing) growSparks(ctx, ...focusOddech(g), 3.5, st.time, 5, 0.6, st.reduced);
}
const focusOddech = (g: number): [number, number] => [0, 31 - 22 * phase(g, 0.2, 1)];

// the night
const HYPO = lying(...PLACE.hypothalamus);
const STOMACH = lying(...PLACE.stomach);
const FAT_SOURCES: readonly [number, number][] = [lying(0, 0.44), lying(0.085, 0.49), lying(-0.085, 0.49), lying(0.055, 0.63), lying(-0.055, 0.63), lying(0.1, 0.3), lying(-0.1, 0.3)];
const toHypo = (s: readonly [number, number], i: number): P[] => {
  const midY = s[1] * 0.4 + (i % 2 ? 2 : -2);
  return [s, [(s[0] + HYPO[0]) / 2, midY], [HYPO[0] + 6, HYPO[1] * 0.5], HYPO];
};

function sen(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = st.g;
  const kL = phase(g, 0.05, 0.85), kG = 1 - 0.55 * phase(g, 0.2, 1);
  // the fat tissue's places glow softly honey (a store of energy, and a messenger)
  FAT_SOURCES.forEach(([x, y], i) => glow(ctx, HONEY_FAT, x, y, 6 + (i < 1 ? 2 : 0), 0.1 + 0.16 * kL));
  // leptin: gold motes from the fat to the hypothalamus
  FAT_SOURCES.forEach((s, i) => {
    const path = toHypo(s, i);
    ctx.save();
    ctx.globalAlpha *= 0.12 + 0.3 * kL;
    ctx.beginPath();
    smoothPath(ctx, path);
    ctx.strokeStyle = LEPTIN;
    ctx.lineWidth = 0.5 / st.px * 1.6;
    ctx.stroke();
    ctx.restore();
    motes(ctx, path, 3 + Math.round(5 * kL), st.time, 0.5, 0.8, LEPTIN, 0.2 + 0.8 * kL, i * 31, st.reduced);
  });
  // ghrelin: rose motes from the stomach, calmer through the night
  const gPath: P[] = [STOMACH, [STOMACH[0] - 10, STOMACH[1] + 6], [HYPO[0] + 8, 5], HYPO];
  glow(ctx, GHRELIN, STOMACH[0], STOMACH[1], 4.5, 0.12 + 0.12 * kG);
  ctx.save();
  ctx.globalAlpha *= 0.12 + 0.2 * kG;
  ctx.beginPath();
  smoothPath(ctx, gPath);
  ctx.strokeStyle = GHRELIN;
  ctx.lineWidth = 0.5 / st.px * 1.6;
  ctx.stroke();
  ctx.restore();
  motes(ctx, gPath, 2 + Math.round(4 * kG), st.time, 0.5, 0.75, GHRELIN, 0.3 + 0.5 * kG, 77, st.reduced);
  // the hypothalamus answers: a calm pearl-gold light at the base of the brain
  glow(ctx, GOLD_HI, HYPO[0], HYPO[1], 3.5 + 2.5 * kL, 0.25 + 0.45 * kL * (0.85 + 0.15 * wave(st.time, 6, 0, st.reduced)));
  // the night's slow breath: a quiet rise and fall of light over the chest
  glowEllipse(ctx, NIGHT, lying(0, 0.29)[0], 0, 9, 7, 0, 0.08 + 0.08 * wave(st.time, 6, 0, st.reduced) + 0.1 * st.deep);
}

function lopatki(ctx: CanvasRenderingContext2D, st: WorldState, look: Look): void {
  const g = st.g;
  const ret = phase(g, 0.3, 1);
  const kT = phase(g, 0.2, 0.75);
  ctx.save();
  ctx.clip(bodyPath(look));
  // the trapezius as a whole: a soft diamond from the skull's base to the shoulders and down to the mid-back
  const shoulder = look === 'on' ? 0.112 : 0.092;
  const trap = new Path2D();
  smoothClosed(trap, [W([0, 0.13]), W([shoulder * 0.55, 0.178]), W([shoulder, 0.205]), W([0.06, 0.25]), W([0.02, 0.36]), W([0, 0.42]), W([-0.02, 0.36]), W([-0.06, 0.25]), W([-shoulder, 0.205]), W([-shoulder * 0.55, 0.178])]);
  ctx.fillStyle = rgba(MUSCLE, 0.06 + 0.1 * kT);
  ctx.fill(trap);
  ctx.strokeStyle = rgba('#ffc0b0', 0.12 + 0.2 * kT);
  ctx.lineWidth = 0.8 / st.px;
  ctx.stroke(trap);
  for (const s of [-1, 1] as const) {
    const sc = scapula(s, ret);
    const path = polyPath(sc);
    // the middle trapezius: fibres across, from the spine to the shoulder blade's spine
    for (let i = 0; i < 6; i++) {
      const y = 0.192 + i * 0.007;
      const a = stagger(g, i, 6, 0.2, 0.75);
      lightLine(ctx, [W([0, y]), W([s * 0.05, y + 0.004]), W([s * (0.084 - 0.012 * ret) , 0.21 + i * 0.002])], 0.42 / st.px * 1.4, i % 2 ? '#ffb69a' : GOLD, 0.15 + 0.6 * a, 0.35);
    }
    // the rhomboids: from the spine down and out to the shoulder blade's inner border
    for (let i = 0; i < 7; i++) {
      const y0 = 0.2 + i * 0.013, k = i / 6;
      const bx = s * (0.03 + 0.01 * k) - s * 0.012 * ret, by = 0.215 + 0.1 * k;
      const a = stagger(g, i, 7, 0.04, 0.55);
      lightLine(ctx, [W([0, y0]), W([bx, by])], 0.5 / st.px * 1.5, i % 2 ? MUSCLE : '#ffa48c', 0.15 + 0.65 * a, 0.4);
    }
    // the shoulder blade: a pearl triangle drawn in
    ctx.fillStyle = rgba(PEARL_W, 0.08 + 0.1 * ret);
    ctx.fill(path);
    ctx.strokeStyle = rgba(PEARL_W, 0.35 + 0.35 * ret);
    ctx.lineWidth = 0.9 / st.px;
    ctx.stroke(path);
    // its spine (the ridge across the top) and the arrow of its movement
    ctx.beginPath();
    ctx.moveTo(...W([s * 0.032 - s * 0.012 * ret, 0.228]));
    ctx.lineTo(...W([s * 0.09 - s * 0.012 * ret, 0.212]));
    ctx.strokeStyle = rgba('#fff0e0', 0.3 + 0.4 * ret);
    ctx.stroke();
  }
  ctx.restore();
  // the chest opening: an arc of gold across the shoulders at the end
  const open = phase(g, 0.7, 1);
  if (open > 0.01) {
    ctx.save();
    ctx.strokeStyle = rgba(GOLD, 0.5 * open);
    ctx.lineWidth = 1.2 / st.px;
    ctx.beginPath();
    ctx.moveTo(-shoulder * F - 2, 20.5);
    ctx.quadraticCurveTo(0, 15.5 - 2 * open, shoulder * F + 2, 20.5);
    ctx.stroke();
    ctx.restore();
    sparkle(ctx, -shoulder * F - 2, 20.5, 2.5, open);
    sparkle(ctx, shoulder * F + 2, 20.5, 2.5, open);
  }
}

function gorset(ctx: CanvasRenderingContext2D, st: WorldState, look: Look): void {
  const g = st.g;
  ctx.save();
  ctx.clip(bodyPath(look));
  // transversus abdominis: fibres round the waist like a corset, drawn in from the sides toward the front
  const kT = phase(g, 0, 0.55);
  for (let i = 0; i < 12; i++) {
    const yy = 0.335 + i * 0.016;
    const hw = halfAt(look, yy) * F;
    const reach = stagger(g, i, 12, 0, 0.55, 3);
    for (const s of [-1, 1]) {
      const x0 = s * (hw + 1), x1 = s * (hw + 1 - (hw + 1) * reach);
      ctx.beginPath();
      ctx.moveTo(x0, yy * F);
      ctx.quadraticCurveTo((x0 + x1) / 2, yy * F + 0.9 * reach, x1, yy * F + 1.2 * reach);
      ctx.strokeStyle = rgba(i % 2 ? GOLD : '#ffb08a', 0.2 + 0.55 * reach);
      ctx.lineWidth = 0.55 / st.px * 1.6;
      ctx.stroke();
    }
  }
  glowEllipse(ctx, GOLD, 0, 43, 14 * (0.6 + 0.4 * kT), 8, 0, 0.12 * kT);
  // the obliques: diagonal fibres on the sides, from the ribs down and in
  for (let i = 0; i < 8; i++) {
    const a = stagger(g, i, 8, 0.35, 0.8);
    for (const s of [-1, 1]) {
      const yy = 0.3 + i * 0.022;
      const hw = halfAt(look, yy + 0.02) * F;
      lightLine(ctx, [[s * (hw - 0.5), yy * F], [s * (hw * 0.45), yy * F + 7]], 0.45 / st.px * 1.5, '#ff9d8a', 0.12 + 0.55 * a, 0.35);
    }
  }
  // the rectus: two columns with three bands across
  const kR = phase(g, 0.6, 1);
  for (const s of [-1, 1]) {
    for (let j = 0; j < 4; j++) {
      const y0 = 29.5 + j * 6, y1 = y0 + 5.2;
      const x0 = s * 0.6, x1 = s * (look === 'on' ? 3.6 : 3.2);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1, y0 - 0.3, x1, y0 + 1.4);
      ctx.lineTo(x1, y1 - 1);
      ctx.quadraticCurveTo(x1, y1, x0, y1);
      ctx.closePath();
      ctx.fillStyle = rgba(MUSCLE, 0.04 + 0.16 * kR);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffd0c0', 0.1 + 0.4 * kR);
      ctx.lineWidth = 0.6 / st.px;
      ctx.stroke();
    }
  }
  ctx.restore();
  if (st.growing) growSparks(ctx, 0, 43, 5, st.time, 6, 0.6, st.reduced);
}

function wszedzie(ctx: CanvasRenderingContext2D, st: WorldState, look: Look): void {
  const g = st.g;
  const body = bodyPath(look);
  ctx.save();
  ctx.clip(body);
  // the store of fat: honey light everywhere in the body, lightening evenly
  const fat = 0.3 * (1 - 0.6 * phase(g, 0, 1));
  const grad = ctx.createLinearGradient(0, 15, 0, 100);
  grad.addColorStop(0, rgba(HONEY_FAT, fat * 0.8));
  grad.addColorStop(0.4, rgba(HONEY_DEEP, fat));
  grad.addColorStop(1, rgba(HONEY_FAT, fat * 0.85));
  ctx.fillStyle = grad;
  ctx.fillRect(-30, 10, 60, 92);
  // the belly's muscles were the ones exercised (a faint coral)
  ctx.fillStyle = rgba(MUSCLE, 0.12);
  ctx.beginPath();
  ctx.ellipse(0, 41, 4, 11, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // from everywhere at once: small lights rise and leave as breath
  const pts = bodyPoints(look);
  const k = phase(g, 0.05, 1);
  const n = Math.round(pts.length * (0.2 + 0.8 * k));
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const life = st.reduced ? 0.5 : ((st.time * 0.22 + hash(i * 2.9)) % 1);
    const yy = y - 6 * life;
    const a = Math.sin(Math.PI * life) * (0.25 + 0.6 * k);
    glow(ctx, GOLD_HI, x, yy, 1.6, 0.35 * a);
    ctx.fillStyle = rgba(PEARL_W, 0.7 * a);
    ctx.beginPath();
    ctx.arc(x, yy, 0.38, 0, TAU);
    ctx.fill();
  }
}

/** The intestines as a meandering tube in the belly (world units). */
const GUT: readonly P[] = (() => {
  const out: P[] = [];
  for (let r = 0; r < 5; r++) {
    const y = 38 + r * 3.2;
    const dir = r % 2 ? -1 : 1;
    for (let i = 0; i <= 8; i++) {
      const k = i / 8;
      out.push([dir * (-5.6 + 11.2 * k), y + Math.sin(k * Math.PI * 3) * 0.9]);
    }
  }
  return out;
})();
/** The visceral fat: small lobules between and round the loops (the omentum). */
const VFAT: readonly { x: number; y: number; r: number }[] = (() => {
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 34; i++) {
    const x = -6.8 + 13.6 * hash(i * 3 + 41), y = 36 + 15.5 * hash(i * 7 + 43);
    out.push({ x, y, r: 0.9 + 1.3 * hash(i * 11 + 47) });
  }
  return out;
})();

function trzewny(ctx: CanvasRenderingContext2D, st: WorldState, look: Look): void {
  const g = st.g;
  ctx.save();
  ctx.clip(bodyPath(look));
  // the stomach and the liver's edge, faint
  ctx.strokeStyle = rgba('#ffd6c8', 0.3);
  ctx.lineWidth = 0.8 / st.px;
  ctx.beginPath();
  ctx.ellipse(3.6, 33.5, 3.2, 2.4, -0.4, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-8.5, 30.5);
  ctx.quadraticCurveTo(-3, 35, 2, 31.5);
  ctx.stroke();
  // the loops of the gut
  ctx.beginPath();
  smoothPath(ctx, GUT);
  ctx.strokeStyle = rgba('#ff9db0', 0.18);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = rgba('#ffd4dc', 0.45);
  ctx.lineWidth = 0.7 / st.px;
  ctx.stroke();
  // the fat round the organs: honey lobules, shrinking as movement goes on
  const k = phase(g, 0.05, 1);
  VFAT.forEach((f, i) => {
    const s = 1 - 0.62 * stagger(g, i, VFAT.length, 0.05, 1, 6);
    glow(ctx, HONEY_FAT, f.x, f.y, f.r * 1.5 * s, 0.1 * s);
    ctx.fillStyle = rgba(HONEY_FAT, 0.34 * s + 0.05);
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * s, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba('#fff0cc', 0.35 * s);
    ctx.lineWidth = 0.5 / st.px;
    ctx.stroke();
  });
  ctx.restore();
  // movement's light: gold waves passing up through the belly
  for (let i = 0; i < 3; i++) {
    const life = st.reduced ? (i + 0.5) / 3 : ((st.time * 0.25 + i / 3) % 1);
    glowEllipse(ctx, GOLD, 0, 54 - 20 * life, 9, 1.6, 0, 0.22 * k * Math.sin(Math.PI * life));
  }
}

/** The long muscles lit along the arms and legs (the whole: strong), world units. */
function limbLines(look: Look): P[][] {
  const sh = look === 'on' ? 0.112 : 0.09;
  const out: P[][] = [];
  for (const s of [-1, 1] as const) {
    out.push([W([s * (sh + 0.012), 0.215]), W([s * 0.128, 0.3]), W([s * 0.142, 0.38]), W([s * 0.158, 0.46])]);
    out.push([W([s * 0.07, 0.53]), W([s * 0.062, 0.62]), W([s * 0.05, 0.72])]);
    out.push([W([s * 0.05, 0.76]), W([s * 0.048, 0.85]), W([s * 0.04, 0.93])]);
    out.push([W([s * 0.055, 0.205]), W([s * 0.05, 0.25]), W([s * 0.03, 0.29])]);
  }
  return out;
}

function lekkosc(ctx: CanvasRenderingContext2D, st: WorldState, look: Look, br: { b: number; out: number }): void {
  const g = st.g;
  drawLungs(ctx, st, look, 0.35 + 0.4 * phase(g, 0, 0.5), br);
  const lines = limbLines(look);
  lines.forEach((l, i) => lightLine(ctx, l, 0.9 / st.px * 1.8, i % 2 ? GOLD : '#ffb59a', 0.12 + 0.6 * stagger(g, i, lines.length, 0.15, 0.85), 0.4));
  drawExhale(ctx, st, phase(g, 0.3, 1), br, 0.8);
  // lightness: the whole body's light rises a little
  const k = phase(g, 0.5, 1);
  ctx.save();
  ctx.clip(bodyPath(look));
  const gr = ctx.createLinearGradient(0, 100, 0, 0);
  gr.addColorStop(0, rgba(GOLD, 0.0));
  gr.addColorStop(0.5, rgba(GOLD_HI, 0.1 * k));
  gr.addColorStop(1, rgba(PEARL_W, 0.16 * k));
  ctx.fillStyle = gr;
  ctx.fillRect(-30, 0, 60, 100);
  ctx.restore();
}

function postac(ctx: CanvasRenderingContext2D, st: WorldState, look: Look): void {
  const g = st.g;
  const k = phase(g, 0, 0.85);
  const level = 100 - 102 * k;
  ctx.save();
  ctx.clip(bodyPath(look));
  const gr = ctx.createLinearGradient(0, level - 6, 0, level + 10);
  gr.addColorStop(0, rgba(GOLD_HI, 0));
  gr.addColorStop(0.35, rgba(GOLD_HI, 0.32));
  gr.addColorStop(1, rgba(GOLD, 0.2));
  ctx.fillStyle = gr;
  ctx.fillRect(-30, level - 6, 60, 110 - level);
  ctx.restore();
  // the line of the upright body: crown over the heart over the feet
  const kl = phase(g, 0.2, 0.9);
  ctx.save();
  ctx.setLineDash([1.2, 1.8]);
  ctx.strokeStyle = rgba(GOLD, 0.15 + 0.4 * kl);
  ctx.lineWidth = 0.6 / st.px;
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, 100);
  ctx.stroke();
  ctx.restore();
  // the front of the light rising
  glowEllipse(ctx, GOLD_HI, 0, level, 13, 2.2, 0, 0.3 * (1 - phase(g, 0.85, 1)) * (g > 0.001 ? 1 : 0));
  // the aura when whole
  const aura = phase(g, 0.75, 1);
  if (aura > 0.01) {
    const pulse = 0.9 + 0.1 * wave(st.time, 7, 0, st.reduced);
    glowEllipse(ctx, '#ffe2c0', 0, 50, 34 * pulse, 58 * pulse, 0, 0.12 * aura);
    glowEllipse(ctx, GOLD, 0, 2, 12, 9, 0, 0.18 * aura);
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + (st.reduced ? 0 : st.time * 0.05);
      sparkle(ctx, Math.cos(ang) * 30, 50 + Math.sin(ang) * 54, 2.2, aura * (0.5 + 0.5 * wave(st.time, 3, i, st.reduced)));
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const look = lookOf(st.look);
  const br = breathOf(st);
  // rest's deepening: a warm breath of light over the chest
  if (st.deep > 0.02 && st.scene !== 'sen') glowEllipse(ctx, '#ffcdb0', 0, 32, 16, 20, 0, 0.1 * st.deep * (0.7 + 0.3 * br.b));
  switch (st.scene) {
    case 'oddech': oddech(ctx, st, look, br); break;
    case 'sen': sen(ctx, st); break;
    case 'lopatki': lopatki(ctx, st, look); break;
    case 'gorset': gorset(ctx, st, look); break;
    case 'wszedzie': wszedzie(ctx, st, look); break;
    case 'trzewny': trzewny(ctx, st, look); break;
    case 'lekkosc': lekkosc(ctx, st, look, br); break;
    case 'postac': postac(ctx, st, look); break;
    default: break;
  }
}

function focusAt(scene: string, g: number): [number, number] {
  switch (scene) {
    case 'oddech': return focusOddech(g);
    case 'sen': return [HYPO[0] + 8, HYPO[1]];
    case 'lopatki': return [0, 24];
    case 'gorset': return [0, 43];
    case 'wszedzie': return [0, 46];
    case 'trzewny': return [0, 45];
    case 'lekkosc': return [0, 30 - 14 * phase(g, 0.3, 1)];
    case 'postac': return [0, 96 - 90 * phase(g, 0, 0.85)];
    default: return [0, 40];
  }
}

export const BODY_WORLD: WorldPainter = { depth: 0, lens: false, bake, draw, focusAt };

/** Places of the body world used for labels and portals (world units). */
export const BODY = {
  hypo: HYPO, stomach: STOMACH, hip: [9, 47] as const, thigh: [5.5, 62] as const, chest: [0, 26] as const,
  leptinAt: toHypo(FAT_SOURCES[0], 0)[1], lungL: W(PLACE.lungL), mouth: W(PLACE.mouth),
};
