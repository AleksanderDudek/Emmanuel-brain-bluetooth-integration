/**
 * Jerzy i smok's picture for the lobby's hero and the game card: the knight in the middle of the
 * field, the brood closing in from every side, his shield's aura swelling with a focus that comes
 * and goes (the dotted threshold ring, the rim turning gold) and throwing them back, a sword's arc,
 * a falcon circling, scales on the grass, a fireball going out in the light; Linda behind him.  In
 * the lobby (with progress) the land is the player's current one and the companion who comes along
 * trots beside Linda.  Drawn every frame, so it stays cheap: no state.
 */
import { clamp } from '../kit/juice';
import { BROOD_KINDS, type CompanionId } from './content';
import { paintPal, type PalPose } from './figures';
import { fightOf, type JerzyProgress } from './meta';
import { glow, hash, paintBrood, paintFalcon, paintField, paintFireball, paintKnight, paintLinda, paintScale, type KnightPose, type LindaPose } from './paint';

const kp: KnightPose = { flip: 1, step: 0, walking: 0, swing: 0, roll: 0, down: 0, hit: 0, charge: 0, ready: false, t: 0 };
const lp: LindaPose = { flip: 1, step: 0, walking: 0, arm: 0, sit: 0, talk: false, t: 0 };
const pp: PalPose = { flip: 1, step: 0, walking: 0, t: 0, act: 0, roll: 0, nap: 0 };
const TAU = Math.PI * 2;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: JerzyProgress): void {
  const spec = p ? fightOf(p).spec : fightOf({ land: 0, tier: 0 } as JerzyProgress).spec;
  const s = Math.max(14, Math.min(w / 11, h / 6.2));
  const cx = w / 2, cy = h * 0.6;
  paintField(ctx, spec.arena, t * 0.15, 0, cx, cy, s, w, h, t);
  // the focus comes and goes: the aura breathes with it
  const level = 0.5 + 0.45 * Math.sin(t * 0.8);
  const R = (0.42 + level * 2.8) * s * 0.62, mark = (0.42 + 1.4) * s * 0.62;
  const ay = cy - s * 0.35;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, cx, ay, R * 1.15, level > 0.5 ? 'rgba(255,224,150,' : 'rgba(255,240,200,', 0.35);
  ctx.restore();
  // scales on the grass
  for (let i = 0; i < 9; i++) {
    const a = hash(i) * TAU, d = s * (1.2 + hash(i + 9) * 3.5);
    paintScale(ctx, cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.6, s * 0.13, i % 4 === 0 ? 3 : 1, t);
  }
  // the brood, thrown back when the aura reaches them
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.3;
    const cyc = (t * 0.35 + hash(i * 3)) % 1;
    const dist = s * (4.2 - 2.6 * cyc);
    const pushed = Math.max(0, R * 1.05 - dist * 0.7);
    const d = (dist + pushed * 1.6) * 0.7;
    const x = cx + Math.cos(a) * d * 1.45, y = cy + Math.sin(a) * d * 0.62;
    paintBrood(ctx, x, y, s * 0.8, {
      kind: BROOD_KINDS[i % 3], land: spec.kind, r: 0.32, flip: x < cx ? 1 : -1, t, hit: pushed > 0 ? 0.1 : 0, elite: i === 4, drowsy: 0, spit: 0, seed: i,
    });
  }
  // the threshold ring and the rim
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = 'rgba(255,250,232,.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, ay, mark, mark * 0.8, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = level > 0.5 ? '#ffd36b' : 'rgba(255,250,232,.85)';
  ctx.lineWidth = level > 0.5 ? 3 : 2;
  ctx.beginPath();
  ctx.ellipse(cx, ay, R, R * 0.8, 0, 0, TAU);
  ctx.stroke();
  // a fireball flying in and going out at the rim
  const fk = (t * 0.6) % 1;
  const fx = cx + s * 4.5 * (1 - fk), fy = ay - s * 1.2 * (1 - fk);
  if (Math.hypot(fx - cx, (fy - ay) / 0.8) > R) paintFireball(ctx, fx, fy, s * 0.2, s * 0.17, t);
  else {
    ctx.fillStyle = 'rgba(240,244,248,.7)';
    ctx.beginPath();
    ctx.arc(fx, fy - s * 0.2, s * 0.18 * (1 + fk), 0, TAU);
    ctx.fill();
  }
  // Linda, the knight, his sword's arc, the falcon
  lp.t = t;
  lp.flip = 1;
  lp.arm = 0.5 + 0.4 * Math.sin(t * 3);
  paintLinda(ctx, cx - s * 1.0, cy - s * 0.15, s * 0.85, lp);
  // the companion who comes along
  const pal = p?.party?.[0] as CompanionId | undefined;
  if (pal) {
    pp.t = t;
    pp.step = t * 9;
    pp.walking = 0.6;
    pp.roll = t * 5;
    pp.act = pal === 'iskierka' ? 0.5 + 0.5 * Math.sin(t * 3) : 0;
    paintPal(ctx, pal, cx - s * 1.75, cy + s * 0.25, s * 0.9, pp);
  }
  kp.t = t;
  kp.charge = clamp((t % 6) / 6);
  kp.ready = kp.charge > 0.95;
  kp.swing = Math.max(0, 1 - ((t % 1.1) / 1.1) * 4);
  paintKnight(ctx, cx, cy, s, kp);
  const sk = (t % 1.1) / 1.1;
  if (sk < 0.25) {
    ctx.strokeStyle = `rgba(255,251,232,${1 - sk * 4})`;
    ctx.lineWidth = s * 0.14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(cx, ay, s * 1.7, s * 1.35, 0, -0.9, -0.9 + 1.8 * Math.min(1, sk * 6));
    ctx.stroke();
  }
  const ba = t * 2.6;
  paintFalcon(ctx, cx + Math.cos(ba) * s * 1.9, ay - s * 0.6 + Math.sin(ba) * s * 1.2, s * 0.8, t * 14);
}
