/**
 * Dawid's picture for the lobby's hero and the game card: David on the pastures with his sling whirling,
 * its ring breathing with a focus that comes and goes (the notch of the threshold, the arc turning gold,
 * the multiplier), beasts closing in and running off in a puff of dust, silver coins on the grass, the
 * lamb behind him, the camp's fire and the guardian far off.  In the lobby (with progress) the land is
 * the player's current one.  Drawn every frame, so it stays cheap: no state.
 */
import { fmtNum } from '../../i18n';
import { BEAST_KINDS, type BeastKind } from './content';
import { landAt, type DawidProgress } from './meta';
import { C, GROUND, LOOKS, ellipse, glow, hash, paintBeast, paintCoin, paintDeco, paintFire, paintLamb, paintPerson } from './paint';

const TAU = Math.PI * 2;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: DawidProgress): void {
  const { spec } = landAt(p ? p.land : 0);
  const g = GROUND[spec.ground];
  const s = Math.max(14, Math.min(w / 11, h / 6.4));
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.35);
  sky.addColorStop(0, '#f0b46a');
  sky.addColorStop(1, '#f6d9a0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9a8a62';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.3);
  for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.3 - Math.sin(x / 70) * h * 0.04);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  const ground = ctx.createLinearGradient(0, h * 0.32, 0, h);
  ground.addColorStop(0, g.a);
  ground.addColorStop(1, g.b);
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.33, w, h);
  for (let i = 0; i < 40; i++) {
    const x = hash(i) * w, y = h * (0.36 + hash(i + 40) * 0.62);
    ctx.strokeStyle = g.tuft;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y - s * 0.15);
    ctx.stroke();
  }
  paintDeco(ctx, { kind: 'olive', x: 0, y: 0, r: 1.1, seed: 3 }, w * 0.12, h * 0.48, s, t);
  paintDeco(ctx, { kind: 'terebinth', x: 0, y: 0, r: 1.2, seed: 8 }, w * 0.9, h * 0.44, s, t);
  paintFire(ctx, w * 0.2, h * 0.86, s * 0.8, t);
  const cx = w / 2, cy = h * 0.68;
  // the focus comes and goes: the whirl breathes with it
  const level = 0.5 + 0.45 * Math.sin(t * 0.7);
  const R = s * 1.35, Ry = R * 0.55, a0 = Math.PI + 0.4, span = Math.PI + 0.8;
  const arc = (from: number, to: number) => { ctx.beginPath(); ctx.ellipse(cx, cy, R, Ry, 0, a0 - from * span, a0 - to * span, true); };
  if (level > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, cx, cy, R * 1.4, 'rgba(255,214,110,', 0.3);
    ctx.restore();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, s * 0.12);
  ctx.strokeStyle = 'rgba(255,250,232,.35)';
  arc(0, 1);
  ctx.stroke();
  ctx.strokeStyle = '#fff3d6';
  arc(0, Math.min(0.5, level));
  ctx.stroke();
  if (level > 0.5) {
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = Math.max(4, s * 0.15);
    arc(0.5, level);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,250,232,.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy + Ry - s * 0.14);
  ctx.lineTo(cx, cy + Ry + s * 0.2);
  ctx.stroke();
  // coins on the grass
  for (let i = 0; i < 7; i++) {
    const a = hash(i * 5) * TAU, d = s * (1.6 + hash(i + 9) * 2.6);
    paintCoin(ctx, 'silver', cx + Math.cos(a) * d * 1.4, cy + Math.sin(a) * d * 0.35 + s * 0.4, s, t, i);
  }
  // beasts closing in, running off when the stone comes
  const kinds = spec.camps.map(c => c[0]);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.4;
    const cyc = (t * 0.32 + hash(i * 3)) % 1;
    const dist = s * (4.4 - 2.6 * cyc);
    const fleeing = cyc > 0.8 ? (cyc - 0.8) / 0.2 : 0;
    const kind = (kinds[i % kinds.length] ?? BEAST_KINDS[0]) as BeastKind;
    const x = cx + Math.cos(a) * dist * 1.4 * (1 + fleeing * 0.6), y = cy + Math.sin(a) * dist * 0.42 + s * 0.2;
    paintBeast(ctx, kind, x, y, s * 0.9, { flip: fleeing > 0 ? (x < cx ? -1 : 1) : x < cx ? 1 : -1, step: t * 12 + i, moving: 1, hit: 0, doze: 0, t, air: 0, tele: 0, flee: fleeing, seed: i, hidden: false });
  }
  // the whirling stone, golden above the threshold
  const spin = t * (2 + level * 6);
  for (let i = 4; i >= 0; i--) {
    const a = spin - i * 0.2;
    ctx.globalAlpha = i === 0 ? 1 : 0.3 * (1 - i / 5);
    ellipse(ctx, cx + Math.cos(a) * R, cy + Math.sin(a) * Ry - s * 0.55, s * 0.1, s * 0.1, level > 0.5 ? C.gold : '#ece6da');
  }
  ctx.globalAlpha = 1;
  paintLamb(ctx, cx - s * 1.1, cy + s * 0.1, s, { flip: 1, step: t * 10, walking: 0.3, sleep: 0, talk: Math.sin(t * 2) > 0.6, t });
  paintPerson(ctx, cx, cy, s, LOOKS.david, { flip: Math.sin(t * 0.5) > 0 ? 1 : -1, step: 0, walking: 0, sit: 0, act: 1, hit: 0, t });
  if (level > 0.5) {
    ctx.font = `900 ${Math.round(s * 0.5)}px "Manrope Variable", Manrope, system-ui, sans-serif`;
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    const m = Math.round((2 + (2 * (level - 0.5)) / 0.5) * 2) / 2;
    ctx.fillText(`×${fmtNum(m, Number.isInteger(m) ? 0 : 1)}`, cx + R + s * 0.2, cy);
  }
}
