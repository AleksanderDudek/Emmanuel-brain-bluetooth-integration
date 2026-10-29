/**
 * Glina's picture for the lobby's hero and the game card: the whitewashed wall under a strip of
 * sky, the gate arch on the left with a white house beyond, a fig-leaf shadow drifting, and the
 * wheel turning a vessel — on the cards a honey-glazed jug with two runs, in the lobby the player's
 * newest page (its shape, glaze, runs and kiln gift), with the courtyard's gifts and the street's
 * vessels through the gate.  Drawn every frame in the lobby, so it stays cheap: the scenery is
 * baked once per size and progress, and the vessel draws at most 60 rows.
 */
import { RINGS } from './clay';
import { FORM, HOUSES, STORY } from './content';
import type { GlinaProgress } from './meta';
import { C, almond, cat, hash, mix } from './paint';
import { recLook, softBlob } from './scene';
import { TILT, drawVessel, look } from './vessel';

const TAU = Math.PI * 2;
const v = look();
const tiny = look();
let bg: { key: string; c: HTMLCanvasElement | null } = { key: '', c: null };

/** The card's jug: a honey glaze with two runs (made once). */
const JUG = (() => {
  const f = FORM.dzbanek;
  const q: number[] = [];
  for (let k = 0; k < RINGS; k++) q.push(Math.round(f.q[k] * 100));
  return { f: f.id, h: f.N, q, stars: 3 as const, sim: 92, wall: 2, centre: true, glaze: 'miod' as const, runs: 38, gift: null, second: false, porcelain: false };
})();

function signature(w: number, h: number, p?: GlinaProgress): string {
  if (!p) return `${w}x${h}|card`;
  return `${w}x${h}|${p.gifts.join(',')}|${HOUSES.map(x => `${p.steps[x]}:${p.street[x].length}`).join(',')}|${p.vessels}`;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: GlinaProgress): void {
  const key = signature(w, h, p);
  if (bg.key !== key) bg = { key, c: bake(w, h, p) };
  if (bg.c) ctx.drawImage(bg.c, 0, 0, w, h);
  else scenery(ctx, w, h, p);
  // a fig leaf's shadow drifting over the wall
  const sp = softBlob();
  if (sp) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 3; i++) {
      const s = Math.min(w, h) * (0.16 + 0.06 * i);
      ctx.drawImage(sp, w * (0.62 + 0.12 * i) + Math.sin(t * 0.3 + i * 2) * w * 0.02 - s, h * (0.3 + 0.08 * i) - s * 0.6, s * 2, s * 1.2);
    }
    ctx.restore();
  }
  if (p?.gifts.includes('kot')) cat(ctx, w * 0.72, h * 0.235, Math.min(w, h) * 0.06, t);
  // the wheel and its vessel, turning
  const floor = h * 0.82, cx = w * 0.56;
  const wr = Math.min(w * 0.17, h * 0.2);
  ctx.fillStyle = mix(C.wood, '#5A3A26', 0.25);
  ctx.beginPath();
  ctx.ellipse(cx, floor + wr * 0.05, wr * 1.15, wr * TILT * 1.2 + 3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix('#8E7B6A', C.wet, 0.3);
  ctx.beginPath();
  ctx.ellipse(cx, floor, wr, wr * TILT, 0, 0, TAU);
  ctx.fill();
  const rec = p?.newest ? p.book[p.newest]?.best ?? JUG : JUG;
  const f = FORM[rec.f];
  let maxQ = 0;
  for (const qv of rec.q) maxQ = Math.max(maxQ, qv / 100);
  const H = rec.h || f.N;
  const scale = Math.min((h * 0.5) / H, (wr * 0.95) / Math.max(0.1, maxQ * H));
  recLook(v, rec, cx, floor, scale, 60);
  v.rot = t * 1.1;
  drawVessel(ctx, v);
}

function bake(w: number, h: number, p?: GlinaProgress): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scenery(ctx, w, h, p);
  return c;
}

/** The still part: sky, the wall and its coping, the gate with the street beyond, the floor, the gifts. */
function scenery(ctx: CanvasRenderingContext2D, w: number, h: number, p?: GlinaProgress): void {
  const wallTop = h * 0.26, floor = h * 0.7;
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, C.zenith);
  sky.addColorStop(0.7, C.sky);
  sky.addColorStop(1, C.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, wallTop);
  // a far town line
  ctx.fillStyle = mix(C.olive, C.horizon, 0.6);
  ctx.beginPath();
  ctx.moveTo(0, wallTop);
  for (let x = 0; x <= w; x += 10) ctx.lineTo(x, wallTop - h * (0.03 + 0.025 * Math.sin(x / 50 + 1.2)));
  ctx.lineTo(w, wallTop);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    const bw = w * (0.05 + hash(i + 7) * 0.04), bh = h * (0.03 + hash(i + 8) * 0.04);
    ctx.fillStyle = mix(C.whitewash, C.sand, 0.3);
    ctx.fillRect(w * (0.4 + i * 0.1), wallTop - bh, bw, bh);
  }
  const wall = ctx.createLinearGradient(0, wallTop, 0, floor);
  wall.addColorStop(0, '#F8F4EC');
  wall.addColorStop(1, mix(C.whitewash, C.sand, 0.4));
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, w, floor - wallTop);
  ctx.fillStyle = C.terracotta;
  ctx.fillRect(0, wallTop - 3, w, Math.max(5, h * 0.022));
  // the gate on the left, a white house and the street beyond
  const gx = w * 0.06, gw = w * 0.26, gy = wallTop + h * 0.08, gh = floor - gy;
  const r = gw / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(gx, floor);
  ctx.lineTo(gx, gy + r);
  ctx.arc(gx + r, gy + r, r, Math.PI, TAU);
  ctx.lineTo(gx + gw, floor);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = C.horizon;
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = mix(C.whitewash, C.sand, 0.12);
  ctx.fillRect(gx, gy + gh * 0.22, gw, gh * 0.6);
  ctx.fillStyle = mix(C.wood, '#2E4A6E', 0.35);
  ctx.fillRect(gx + gw * 0.58, gy + gh * 0.5, gw * 0.2, gh * 0.32);
  ctx.fillStyle = 'rgba(59,42,34,.45)';
  ctx.fillRect(gx + gw * 0.18, gy + gh * 0.46, gw * 0.14, gh * 0.12);
  ctx.fillStyle = mix(C.sand, '#FFFFFF', 0.1);
  ctx.fillRect(gx, gy + gh * 0.82, gw, gh * 0.18);
  if (p) {
    // the street's vessels: the inn's story in use by its door
    let x = gx + gw * 0.12;
    for (let k = 0; k < Math.min(3, p.steps.karczma); k++) {
      const rec = p.book[STORY.karczma[k]]?.best;
      if (!rec) continue;
      drawVessel(ctx, recLook(tiny, rec, x, gy + gh * 0.82, Math.min(1.6, (gh * 0.16) / Math.max(1, rec.h)), 18));
      x += gw * 0.16;
    }
  }
  ctx.restore();
  ctx.strokeStyle = mix(C.sand, C.wood, 0.25);
  ctx.lineWidth = Math.max(3, w * 0.012);
  ctx.beginPath();
  ctx.moveTo(gx, floor);
  ctx.lineTo(gx, gy + r);
  ctx.arc(gx + r, gy + r, r, Math.PI, TAU);
  ctx.lineTo(gx + gw, floor);
  ctx.stroke();
  // the floor
  const fl = ctx.createLinearGradient(0, floor, 0, h);
  fl.addColorStop(0, mix(C.sand, C.shadow, 0.14));
  fl.addColorStop(0.3, C.sand);
  fl.addColorStop(1, mix(C.sand, '#FFFFFF', 0.2));
  ctx.fillStyle = fl;
  ctx.fillRect(0, floor, w, h - floor);
  if (p?.gifts.includes('migdal')) almond(ctx, gx + gw + w * 0.05, floor, Math.min(w, h) * 0.08);
  if (p?.gifts.includes('mata')) {
    ctx.fillStyle = '#C9A96E';
    ctx.beginPath();
    ctx.ellipse(w * 0.84, h * 0.9, w * 0.1, h * 0.03, 0, 0, TAU);
    ctx.fill();
  }
}
