/**
 * A hand in light (DESIGN.md §24.3, depth 0, free on the ground): the back of a resting right hand, fingers to the
 * right, the thumb above — no features but its outline, its nails and the soft lines of its tendons, in the player's
 * skin tone and lit from above.
 *
 *   cieplo   warmth spreads from the wrist to the fingertips: the skin's vessels widen, the veins on the back of the
 *            hand glow, a little heat rises off it — the skin keeping the body's temperature
 */
import { clamp, ease } from '../kit/juice';
import { BLOOD, GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, mix, rgba } from '../kit/healthlib/paint';
import type { Pt, Rect, WorldPainter, WorldState } from '../kit/healthlib/spec';
import { span, toneOf } from './tone';

export const HAND_VIEW: Rect = { x: -76, y: -44, w: 150, h: 88 };

interface Cap { a: Pt; b: Pt; ra: number; rb: number }
/** the fingers (index, middle, ring, little), the thumb and the forearm as capsules */
const FINGERS: Cap[] = [
  { a: [3, -13.2], b: [52, -18.4], ra: 4.5, rb: 3.4 },
  { a: [6, -4], b: [60, -4.8], ra: 4.7, rb: 3.6 },
  { a: [5, 5], b: [55, 8.6], ra: 4.5, rb: 3.4 },
  { a: [0, 13.2], b: [41, 19.8], ra: 4, rb: 3 },
];
const THUMB: Cap[] = [
  { a: [-33, -13.5], b: [-15, -26.5], ra: 6.6, rb: 5 },
  { a: [-15, -26.5], b: [3, -33.5], ra: 5, rb: 3.8 },
];
const ARM: Cap = { a: [-160, 0.5], b: [-44, 0], ra: 15.5, rb: 13.6 };

function capsule(p: Path2D, c: Cap): void {
  const ang = Math.atan2(c.b[1] - c.a[1], c.b[0] - c.a[0]);
  p.moveTo(c.b[0] + Math.cos(ang - Math.PI / 2) * c.rb, c.b[1] + Math.sin(ang - Math.PI / 2) * c.rb);
  p.arc(c.b[0], c.b[1], c.rb, ang - Math.PI / 2, ang + Math.PI / 2);
  p.arc(c.a[0], c.a[1], c.ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  p.closePath();
}

let sil: Path2D | null = null;
/** The hand's silhouette (one path; its pieces wind the same way, so a fill or a clip is their union). */
function silhouette(): Path2D {
  if (sil) return sil;
  const p = new Path2D();
  // the back of the hand: from the wrist widening to the knuckles
  p.moveTo(-46, -13.4);
  p.bezierCurveTo(-30, -17.5, -10, -19, 5, -17.4);
  p.bezierCurveTo(10, -9, 10, 9, 3, 17);
  p.bezierCurveTo(-14, 19, -32, 16.5, -46, 13.6);
  p.closePath();
  for (const c of [...FINGERS, ...THUMB, ARM]) capsule(p, c);
  sil = p;
  return p;
}

/** the dorsal veins and the tendons: soft lines from the wrist toward the knuckles */
const TENDONS: Pt[][] = FINGERS.map(f => [[-42, f.a[1] * 0.35], [-18, f.a[1] * 0.7], [f.a[0] - 2, f.a[1]]]);
const VEINS: Pt[][] = [
  [[-70, -6], [-50, -8], [-34, -12], [-20, -10], [-8, -13]],
  [[-70, 5], [-50, 7], [-36, 9], [-22, 6], [-10, 9]],
  [[-34, -12], [-30, -2], [-36, 9]],
  [[-20, -10], [-12, -1], [-22, 6]],
];

function bake(ctx: CanvasRenderingContext2D, _variant: string, look: string): void {
  const tone = toneOf(look);
  const s = silhouette();
  // the light the hand rests in: a soft warm pool behind it
  glowEllipse(ctx, '#ffd9b8', -10, 0, 110, 60, 0, 0.12);
  glowEllipse(ctx, '#c8a0ff', 20, -20, 70, 40, 0, 0.05);
  // the rim: a line of light round the silhouette (its inside is covered by the fill)
  ctx.strokeStyle = rgba(mix(tone.hi, '#ffffff', 0.4), 0.85);
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  ctx.stroke(s);
  const g = ctx.createLinearGradient(0, -40, 0, 26);
  g.addColorStop(0, mix(tone.hi, tone.skin, 0.35));
  g.addColorStop(0.45, tone.skin);
  g.addColorStop(1, mix(tone.deep, '#3a1a30', 0.25));
  ctx.fillStyle = g;
  ctx.fill(s);
  ctx.save();
  ctx.clip(s);
  // light from above, shade toward the lower edge
  const lg = ctx.createLinearGradient(0, -40, 0, 24);
  lg.addColorStop(0, rgba('#ffffff', 0.22));
  lg.addColorStop(0.5, rgba('#ffffff', 0));
  lg.addColorStop(1, rgba('#1a0a20', 0.3));
  ctx.fillStyle = lg;
  ctx.fillRect(-170, -50, 260, 80);
  // the tendons: faint lighter lines
  ctx.strokeStyle = rgba(tone.hi, 0.18);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  for (const t of TENDONS) {
    ctx.beginPath();
    ctx.moveTo(t[0][0], t[0][1]);
    ctx.quadraticCurveTo(t[1][0], t[1][1], t[2][0], t[2][1]);
    ctx.stroke();
  }
  // the knuckles: soft highlights
  for (const f of FINGERS) glow(ctx, mix(tone.hi, '#ffffff', 0.4), f.a[0] + 1.5, f.a[1] - 0.6, 4.5, 0.12);
  // the knuckles of the fingers' joints: two faint creases each
  ctx.strokeStyle = rgba(tone.deep, 0.35);
  ctx.lineWidth = 0.35;
  for (const f of FINGERS) {
    for (const k of [0.42, 0.72]) {
      const x = f.a[0] + (f.b[0] - f.a[0]) * k, y = f.a[1] + (f.b[1] - f.a[1]) * k;
      const r = f.ra + (f.rb - f.ra) * k;
      ctx.beginPath();
      ctx.moveTo(x - 0.4, y - r * 0.5);
      ctx.quadraticCurveTo(x + 0.6, y, x - 0.4, y + r * 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
  // the nails: pale, rounded, near each fingertip (and the thumb's)
  const nails: [Cap, number][] = [...FINGERS.map(f => [f, 0.86] as [Cap, number]), [THUMB[1], 0.8]];
  for (const [f, k] of nails) {
    const ang = Math.atan2(f.b[1] - f.a[1], f.b[0] - f.a[0]);
    const x = f.a[0] + (f.b[0] - f.a[0]) * k, y = f.a[1] + (f.b[1] - f.a[1]) * k;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, f.rb * 1.05, f.rb * 0.66, 0, 0, TAU);
    ctx.fillStyle = rgba(mix(tone.hi, '#ffe8ee', 0.6), 0.75);
    ctx.fill();
    ctx.strokeStyle = rgba(mix(tone.deep, '#ffffff', 0.2), 0.5);
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.restore();
  }
}

function draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const tone = toneOf(st.look);
  const { g } = st;
  const s = silhouette();
  // the warm front travels from the wrist to the fingertips
  const front = -110 + 175 * ease.inOutSine(span(g, 0.02, 0.92));
  ctx.save();
  ctx.clip(s);
  const op = ctx.globalCompositeOperation;
  const wg = ctx.createLinearGradient(-120, 0, front + 22, 0);
  const a = 0.1 + 0.16 * clamp(g * 3) + 0.06 * st.deep;
  const warm = mix('#ff6a50', tone.skin, 0.3);
  wg.addColorStop(0, rgba(warm, a));
  wg.addColorStop(Math.max(0.01, (front + 120 - 22) / (front + 142)), rgba(warm, a * 0.9));
  wg.addColorStop(1, rgba(warm, 0));
  ctx.fillStyle = wg;
  ctx.fillRect(-170, -50, 260, 80);
  ctx.globalCompositeOperation = 'lighter';
  // the veins fill with warm light as the front passes
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const v of VEINS) {
    const k = clamp((front - v[0][0]) / 30);
    if (k <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(v[0][0], v[0][1]);
    for (let i = 1; i < v.length; i++) ctx.lineTo(v[i][0], v[i][1]);
    ctx.strokeStyle = rgba(BLOOD, 0.1 * k);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = rgba('#ff8a7a', 0.09 * k);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // fingertips glow once the warmth arrives
  for (const f of [...FINGERS, THUMB[1]]) {
    const k = clamp((front - f.b[0] + 6) / 14);
    if (k > 0) glow(ctx, '#ff9a70', f.b[0] - 2, f.b[1], 8, 0.16 * k);
  }
  ctx.globalCompositeOperation = op;
  ctx.restore();
  // a little heat rising off the back of the hand (it moves only as the warmth grows)
  for (let i = 0; i < 16; i++) {
    const x = -60 + i * 7.2 + 2 * Math.sin(i * 1.7);
    if (x > front) continue;
    const ph = (g * 2.6 + hash(i * 3 + 1)) % 1;
    const y = -22 - ph * 22 + (x > 0 ? 4 : 0);
    const k = Math.sin(ph * Math.PI) * clamp(g * 4);
    glowEllipse(ctx, GOLD, x + 2 * Math.sin(ph * 6 + i), y, 1.4, 3.2, 0, 0.18 * k);
  }
  if (st.growing) glow(ctx, GOLD_HI, Math.min(48, front), 0, 6, 0.3);
  // rest's deepening: the whole hand a little warmer, a pearl sheen
  if (st.deep > 0.02) {
    glowEllipse(ctx, '#ffb08a', -10, 0, 90, 40, 0, 0.1 * st.deep);
    glowEllipse(ctx, PEARL, 0, -12, 60, 16, 0, 0.04 * st.deep);
  }
}

export const handPt = {
  back: [-22, -2] as Pt,
  wrist: [-58, 6] as Pt,
  tip: [48, -6] as Pt,
  vein: [-36, 9] as Pt,
};

export const HAND: WorldPainter = {
  depth: 0,
  lens: false,
  bake,
  draw,
  focusAt(_scene, g) {
    const x = -60 + 104 * ease.inOutSine(span(g, 0.02, 0.92));
    return [x, x > 0 ? -5 : 0];
  },
};
