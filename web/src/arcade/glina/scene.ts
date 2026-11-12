/**
 * Glina's places and people, painted as flat, warm gouache shapes: the potter's house of Jeremiah 18
 * (a whitewashed room lit from an arched window, beams, the back shelf, the packed-earth floor, the
 * counter on the left), baked to an offscreen layer once per size; the beehive kiln of mud bricks;
 * the customers (robed figures with simple, friendly faces, each with a look of their own); Szamot
 * the cat on the shelf (sitting, sleeping, delighted, startled), and a shekel.
 */
import type { CustomerId, Look } from './content';
import { LOOK } from './content';
import type { Layout, Rect } from './layout';
import type { PieceRec } from './meta';
import { C, hash, mix } from './paint';
import { RINGS } from './shape';
import { look, type VesselLook } from './vessel';

const TAU = Math.PI * 2;

function offscreen(w: number, h: number, dpr: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

// ── the room ─────────────────────────────────────────────────────
/** The workshop's room, baked once per size. */
export class Room {
  private layer: HTMLCanvasElement | null = null;
  private key = '';

  draw(ctx: CanvasRenderingContext2D, L: Layout, dpr: number): void {
    const key = `${L.w}x${L.h}@${dpr}:${L.top}`;
    if (key !== this.key) {
      this.key = key;
      const o = offscreen(L.w, L.h, dpr);
      this.layer = o ? (paintRoom(o.ctx, L), o.c) : null;
    }
    if (this.layer) ctx.drawImage(this.layer, 0, 0, L.w, L.h);
    else paintRoom(ctx, L);
  }
}

function paintRoom(ctx: CanvasRenderingContext2D, L: Layout): void {
  const { w, h } = L;
  const floorY = L.floor + 6 * L.u;
  // the back wall: whitewash, warmer and darker away from the window
  const wall = ctx.createLinearGradient(0, 0, w, 0);
  wall.addColorStop(0, '#F6EEDF');
  wall.addColorStop(0.45, '#EFE2CC');
  wall.addColorStop(1, '#D9C3A3');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, floorY);
  // the plaster's unevenness
  for (let i = 0; i < 26; i++) {
    const r = 30 + hash(i + 3) * 90;
    const g = ctx.createRadialGradient(hash(i + 1) * w, hash(i + 2) * floorY, 0, hash(i + 1) * w, hash(i + 2) * floorY, r);
    g.addColorStop(0, `rgba(170,130,90,${(0.025 + hash(i) * 0.03).toFixed(3)})`);
    g.addColorStop(1, 'rgba(170,130,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, floorY);
  }
  // a dado: the wall's lower band, rubbed darker by years of work
  const dado = ctx.createLinearGradient(0, floorY - (floorY - L.top) * 0.28, 0, floorY);
  dado.addColorStop(0, 'rgba(176,122,85,0)');
  dado.addColorStop(0.08, 'rgba(176,122,85,.16)');
  dado.addColorStop(1, 'rgba(140,90,60,.22)');
  ctx.fillStyle = dado;
  ctx.fillRect(0, floorY - (floorY - L.top) * 0.28, w, (floorY - L.top) * 0.28);
  // the arched window on the left: sky, hills, a cypress, and its light on the wall
  const win = { x: L.portrait ? w * 0.04 : w * 0.06, y: L.portrait ? 18 : 30, w: L.portrait ? w * 0.26 : Math.min(200, w * 0.14), h: 0 };
  win.h = win.w * 1.35;
  const light = ctx.createRadialGradient(win.x + win.w * 1.6, win.y + win.h * 1.6, 0, win.x + win.w * 1.6, win.y + win.h * 1.6, Math.max(w, h) * 0.6);
  light.addColorStop(0, 'rgba(255,236,196,.55)');
  light.addColorStop(1, 'rgba(255,236,196,0)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, w, floorY);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h);
  ctx.lineTo(win.x, win.y + win.w / 2);
  ctx.arc(win.x + win.w / 2, win.y + win.w / 2, win.w / 2, Math.PI, TAU);
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.closePath();
  ctx.clip();
  const sky = ctx.createLinearGradient(0, win.y, 0, win.y + win.h);
  sky.addColorStop(0, C.sky);
  sky.addColorStop(1, C.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(win.x, win.y, win.w, win.h);
  ctx.fillStyle = '#B9C79A';
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h);
  for (let x = 0; x <= win.w; x += 6) ctx.lineTo(win.x + x, win.y + win.h * (0.7 + 0.08 * Math.sin(x / 18)));
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.fill();
  ctx.fillStyle = '#8FA27A';
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h);
  for (let x = 0; x <= win.w; x += 6) ctx.lineTo(win.x + x, win.y + win.h * (0.82 + 0.05 * Math.sin(x / 11 + 2)));
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.fill();
  ctx.fillStyle = '#4F6B3A';
  ctx.beginPath();
  ctx.ellipse(win.x + win.w * 0.7, win.y + win.h * 0.62, win.w * 0.06, win.h * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = mix(C.wood, '#000000', 0.1);
  ctx.lineWidth = Math.max(4, win.w * 0.05);
  ctx.beginPath();
  ctx.moveTo(win.x, win.y + win.h);
  ctx.lineTo(win.x, win.y + win.w / 2);
  ctx.arc(win.x + win.w / 2, win.y + win.w / 2, win.w / 2, Math.PI, TAU);
  ctx.lineTo(win.x + win.w, win.y + win.h);
  ctx.closePath();
  ctx.stroke();
  // the sill
  ctx.fillStyle = mix(C.wood, '#E9D8BC', 0.3);
  ctx.fillRect(win.x - 8, win.y + win.h, win.w + 16, 7);
  // the beams under the ceiling
  ctx.fillStyle = mix(C.wood, '#3B2A22', 0.35);
  ctx.fillRect(0, 0, w, 10);
  for (let x = w * 0.18; x < w; x += w * 0.28) {
    ctx.fillStyle = mix(C.wood, '#3B2A22', 0.25);
    ctx.fillRect(x, 0, 16, 14);
  }
  // the back shelf (the kiln shelf's board is drawn live) and some old pots on the wall shelf
  const sh = L.shelf;
  ctx.fillStyle = mix(C.wood, '#000000', 0.08);
  ctx.fillRect(sh.x - 12, sh.y, sh.w + 24, sh.h);
  ctx.fillStyle = 'rgba(59,42,34,.2)';
  ctx.fillRect(sh.x - 12, sh.y + sh.h, sh.w + 24, 5);
  for (const k of [0.08, 0.92]) {
    ctx.fillStyle = mix(C.wood, '#000000', 0.2);
    ctx.beginPath();
    ctx.moveTo(sh.x + sh.w * k - 4, sh.y + sh.h);
    ctx.lineTo(sh.x + sh.w * k + 4, sh.y + sh.h);
    ctx.lineTo(sh.x + sh.w * k, sh.y + sh.h + 16);
    ctx.fill();
  }
  // the floor: packed earth with a warm sheen, darker at the front
  const fl = ctx.createLinearGradient(0, floorY, 0, h);
  fl.addColorStop(0, '#C9A57A');
  fl.addColorStop(1, '#A47E57');
  ctx.fillStyle = fl;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = 'rgba(59,42,34,.18)';
  ctx.fillRect(0, floorY, w, 3);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(90,60,35,${(0.05 + hash(i + 50) * 0.06).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(hash(i + 51) * w, floorY + hash(i + 52) * (h - floorY), 10 + hash(i + 53) * 30, 2 + hash(i + 54) * 4, 0, 0, TAU);
    ctx.fill();
  }
  // clay splashes near the wheel
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = 'rgba(110,70,50,.25)';
    ctx.beginPath();
    ctx.ellipse(L.axis + (hash(i + 70) - 0.5) * L.wheel.rx * 3, floorY + 6 + hash(i + 71) * 30, 2 + hash(i + 72) * 5, 1 + hash(i + 73) * 2, 0, 0, TAU);
    ctx.fill();
  }
}

// ── the kiln ─────────────────────────────────────────────────────
/** The beehive kiln of mud bricks: a dome with a door arch, its fire `heat` 0..1 (0 = cold). */
export function kilnDome(ctx: CanvasRenderingContext2D, r: Rect, heat: number, flicker: number): void {
  const cx = r.x + r.w / 2, base = r.y + r.h;
  const dw = r.w * 0.4, dh = r.h * 0.46;
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, mix(C.brick, '#E0A27A', 0.35));
  g.addColorStop(0.45, C.brick);
  g.addColorStop(1, mix(C.brick, '#3A2A26', 0.4));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(r.x, base);
  ctx.bezierCurveTo(r.x, r.y + r.h * 0.18, r.x + r.w * 0.22, r.y, cx, r.y);
  ctx.bezierCurveTo(r.x + r.w * 0.78, r.y, r.x + r.w, r.y + r.h * 0.18, r.x + r.w, base);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(58,42,38,.28)';
  ctx.lineWidth = 1;
  const course = Math.max(6, r.h / 12);
  for (let y = base - course, row = 0; y > r.y; y -= course, row++) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
    const bw = course * 2.1, off = row % 2 ? bw / 2 : 0;
    for (let x = r.x + off; x < r.x + r.w; x += bw) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + course);
      ctx.stroke();
    }
  }
  // the heat glows through the bricks
  if (heat > 0.01) {
    const hg = ctx.createRadialGradient(cx, base - dh * 0.5, 0, cx, base - dh * 0.5, r.w * 0.8);
    hg.addColorStop(0, `rgba(255,140,60,${(0.35 * heat).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const sg = ctx.createRadialGradient(cx, base - dh * 1.05, 0, cx, base - dh * 1.05, dw * 1.3);
  sg.addColorStop(0, 'rgba(58,42,38,.5)');
  sg.addColorStop(1, 'rgba(58,42,38,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.fillStyle = C.soot;
  ctx.beginPath();
  ctx.ellipse(cx, r.y + r.h * 0.04, r.w * 0.07, r.h * 0.025, 0, 0, TAU);
  ctx.fill();
  // the door
  ctx.beginPath();
  ctx.moveTo(cx - dw / 2, base);
  ctx.lineTo(cx - dw / 2, base - dh + dw / 2);
  ctx.arc(cx, base - dh + dw / 2, dw / 2, Math.PI, TAU);
  ctx.lineTo(cx + dw / 2, base);
  ctx.closePath();
  const k = Math.min(1, heat) * (0.85 + 0.15 * flicker);
  const gg = ctx.createRadialGradient(cx, base - dh * 0.35, 0, cx, base - dh * 0.35, dh);
  gg.addColorStop(0, mix('#2A1D18', C.chamber1, k));
  gg.addColorStop(0.55, mix('#2A1D18', C.chamber2, k));
  gg.addColorStop(1, mix('#1E140F', C.ember, k * 0.85));
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.strokeStyle = mix(C.brick, '#E8C49C', 0.35);
  ctx.lineWidth = Math.max(2, dw * 0.08);
  ctx.stroke();
  ctx.fillStyle = '#20150F';
  ctx.fillRect(cx - dw * 0.3, base - course * 0.9, dw * 0.6, course * 0.9);
  // a smoke wisp from the vent while it fires
  if (heat > 0.2) {
    ctx.strokeStyle = `rgba(120,110,105,${(0.25 * heat).toFixed(3)})`;
    ctx.lineWidth = Math.max(2, r.w * 0.04);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const yy = r.y - i * r.h * 0.05, xx = cx + Math.sin(i * 0.8 + flicker * 6) * r.w * 0.04 * (i / 10);
      if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }
}

/** The kiln door's chamber (where the batch shows while it fires). */
export function kilnDoor(r: Rect): Rect {
  const cx = r.x + r.w / 2, base = r.y + r.h;
  const dw = r.w * 0.4, dh = r.h * 0.46;
  return { x: cx - dw / 2, y: base - dh, w: dw, h: dh };
}

// ── people ───────────────────────────────────────────────────────
export type Mood = 'wait' | 'happy' | 'meh' | 'wow';

/**
 * A customer behind the counter: a robed figure with a head covering, a friendly face (two eyes,
 * a mouth by mood), arms when they hold out a pot.  (x, y) are the feet; `s` the height; `bob` a
 * small walking or delighted hop.
 */
export function customer(ctx: CanvasRenderingContext2D, who: CustomerId, x: number, y: number, s: number, mood: Mood, bob: number, alpha = 1): void {
  const lk: Look = LOOK[who];
  ctx.save();
  ctx.globalAlpha = alpha;
  if (lk.two) {
    // the newlyweds: two, a little smaller, side by side
    figure(ctx, { ...lk, robe: '#4F7A3A', hcol: '#C4673F', beard: false }, x - s * 0.17, y, s * 0.86, mood, bob);
    figure(ctx, { ...lk, robe: '#3F6E9C', head: 'cap', hcol: '#E9D8BC', beard: true }, x + s * 0.17, y, s * 0.92, mood, -bob);
  } else figure(ctx, lk, x, y, s * lk.tall, mood, bob);
  ctx.restore();
}

function figure(ctx: CanvasRenderingContext2D, lk: Look, x: number, y: number, s: number, mood: Mood, bob: number): void {
  const by = y - Math.abs(bob) * s * 0.04;
  const skin = '#C99A72', dark = mix(lk.robe, '#000000', 0.25);
  // the robe: a soft bell
  ctx.fillStyle = lk.robe;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.24, by);
  ctx.bezierCurveTo(x - s * 0.26, by - s * 0.4, x - s * 0.2, by - s * 0.66, x - s * 0.12, by - s * 0.72);
  ctx.lineTo(x + s * 0.12, by - s * 0.72);
  ctx.bezierCurveTo(x + s * 0.2, by - s * 0.66, x + s * 0.26, by - s * 0.4, x + s * 0.24, by);
  ctx.closePath();
  ctx.fill();
  // a sash and the robe's trim
  ctx.fillStyle = lk.trim;
  ctx.fillRect(x - s * 0.2, by - s * 0.42, s * 0.4, s * 0.045);
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, s * 0.012);
  ctx.beginPath();
  ctx.moveTo(x, by - s * 0.7);
  ctx.lineTo(x, by - s * 0.44);
  ctx.stroke();
  // the head
  const hy = by - s * 0.82, hr = s * 0.11;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(x, hy, hr * 0.92, hr, 0, 0, TAU);
  ctx.fill();
  if (lk.beard) {
    ctx.fillStyle = '#5A3A28';
    ctx.beginPath();
    ctx.ellipse(x, hy + hr * 0.55, hr * 0.7, hr * 0.55, 0, 0, Math.PI);
    ctx.fill();
  }
  // the head covering
  ctx.fillStyle = lk.hcol;
  ctx.beginPath();
  if (lk.head === 'scarf') {
    ctx.moveTo(x - hr * 1.15, hy + hr * 1.3);
    ctx.quadraticCurveTo(x - hr * 1.35, hy - hr * 1.5, x, hy - hr * 1.2);
    ctx.quadraticCurveTo(x + hr * 1.35, hy - hr * 1.5, x + hr * 1.15, hy + hr * 1.3);
    ctx.quadraticCurveTo(x + hr * 0.9, hy - hr * 0.5, x, hy - hr * 0.7);
    ctx.quadraticCurveTo(x - hr * 0.9, hy - hr * 0.5, x - hr * 1.15, hy + hr * 1.3);
  } else if (lk.head === 'turban') {
    ctx.ellipse(x, hy - hr * 0.7, hr * 1.1, hr * 0.62, 0, 0, TAU);
  } else if (lk.head === 'cap') {
    ctx.ellipse(x, hy - hr * 0.55, hr * 0.95, hr * 0.55, 0, Math.PI, TAU);
  } else {
    ctx.ellipse(x, hy - hr * 0.55, hr * 0.92, hr * 0.5, 0, Math.PI, TAU);
  }
  ctx.fill();
  // the face
  ctx.fillStyle = '#2B1B12';
  const ey = hy - hr * 0.05;
  if (mood === 'happy' || mood === 'wow') {
    ctx.strokeStyle = '#2B1B12';
    ctx.lineWidth = Math.max(1, hr * 0.13);
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sx * hr * 0.36, ey + hr * 0.06, hr * 0.14, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + sx * hr * 0.36, ey, Math.max(1, hr * 0.1), 0, TAU);
      ctx.fill();
    }
  }
  ctx.strokeStyle = '#6E2E22';
  ctx.lineWidth = Math.max(1, hr * 0.11);
  ctx.beginPath();
  if (mood === 'wow') {
    ctx.fillStyle = '#6E2E22';
    ctx.ellipse(x, ey + hr * 0.45, hr * 0.16, hr * 0.2, 0, 0, TAU);
    ctx.fill();
  } else if (mood === 'meh') {
    ctx.moveTo(x - hr * 0.25, ey + hr * 0.5);
    ctx.lineTo(x + hr * 0.25, ey + hr * 0.44);
    ctx.stroke();
  } else {
    ctx.arc(x, ey + hr * 0.3, hr * (mood === 'happy' ? 0.32 : 0.22), 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  // cheeks
  ctx.fillStyle = 'rgba(217,101,59,.28)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + sx * hr * 0.55, ey + hr * 0.32, hr * 0.15, 0, TAU);
    ctx.fill();
  }
}

/** The cat's pose. */
export type CatPose = 'sit' | 'sleep' | 'happy' | 'shock' | 'talk';

/**
 * Szamot the ginger cat sitting on the shelf: body, head with ears, eyes by pose, whiskers, a tail
 * that swishes over the shelf's edge.  (x, y) is where he sits (the shelf's top); `s` his height.
 */
export function cat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, pose: CatPose): void {
  const fur = '#D9873F', dark = '#A85E26', light = '#F2C48A';
  ctx.save();
  ctx.translate(x, y);
  // the tail over the edge
  ctx.strokeStyle = fur;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  const sw = pose === 'sleep' ? 0.2 : Math.sin(t * (pose === 'happy' ? 6 : 2.2)) * (pose === 'shock' ? 0.1 : 0.6);
  ctx.beginPath();
  ctx.moveTo(s * 0.25, -s * 0.05);
  ctx.quadraticCurveTo(s * 0.55, s * 0.1, s * (0.5 + 0.12 * sw), s * (0.45 + 0.05 * sw));
  ctx.stroke();
  if (pose === 'sleep') {
    const br = 1 + 0.04 * Math.sin(t * 1.8);
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.2 * br, s * 0.42, s * 0.22 * br, 0, Math.PI, TAU);
    ctx.lineTo(s * 0.42, 0);
    ctx.lineTo(-s * 0.42, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-s * 0.3, -s * 0.18, s * 0.17, 0, TAU);
    ctx.fill();
    ears(ctx, -s * 0.3, -s * 0.3, s * 0.7, fur, light);
    ctx.strokeStyle = '#3B2A22';
    ctx.lineWidth = Math.max(1, s * 0.025);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(-s * 0.3 + sx * s * 0.07, -s * 0.18, s * 0.04, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    // z z: a drawn zigzag (a path stays crisp at any size; no tiny text)
    ctx.strokeStyle = 'rgba(59,42,34,.5)';
    ctx.lineWidth = Math.max(1.2, s * 0.03);
    const zx = -s * 0.56, zy = -s * 0.6 - (t % 2) * s * 0.1, zs = s * 0.11;
    ctx.beginPath();
    ctx.moveTo(zx, zy);
    ctx.lineTo(zx + zs, zy);
    ctx.lineTo(zx, zy + zs);
    ctx.lineTo(zx + zs, zy + zs);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const hop = pose === 'happy' ? Math.abs(Math.sin(t * 8)) * s * 0.05 : pose === 'shock' ? s * 0.06 : 0;
  ctx.translate(0, -hop);
  // the body
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-s * 0.28, 0);
  ctx.bezierCurveTo(-s * 0.34, -s * 0.36, -s * 0.18, -s * 0.6, 0, -s * 0.6);
  ctx.bezierCurveTo(s * 0.18, -s * 0.6, s * 0.34, -s * 0.36, s * 0.28, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.24, s * 0.12, s * 0.2, 0, 0, TAU);
  ctx.fill();
  // stripes
  ctx.strokeStyle = dark;
  ctx.lineWidth = Math.max(1, s * 0.03);
  for (const k of [-0.2, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(k * s, -s * 0.5);
    ctx.quadraticCurveTo(k * s * 1.3, -s * 0.4, k * s * 1.2, -s * 0.3);
    ctx.stroke();
  }
  // the head
  const hy = -s * 0.72, hr = s * 0.22;
  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.ellipse(0, hy, hr * 1.1, hr, 0, 0, TAU);
  ctx.fill();
  ears(ctx, 0, hy - hr * 0.5, s, fur, light);
  // eyes
  const blink = pose !== 'shock' && (t % 4.2) < 0.12;
  if (pose === 'happy') {
    ctx.strokeStyle = '#3B2A22';
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * hr * 0.42, hy + hr * 0.05, hr * 0.16, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#F5E27A';
      ctx.beginPath();
      ctx.ellipse(sx * hr * 0.42, hy - hr * 0.02, hr * 0.2, blink ? hr * 0.03 : hr * (pose === 'shock' ? 0.26 : 0.18), 0, 0, TAU);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#2B1B12';
        ctx.beginPath();
        ctx.ellipse(sx * hr * 0.42, hy - hr * 0.02, hr * (pose === 'shock' ? 0.12 : 0.06), hr * (pose === 'shock' ? 0.16 : 0.15), 0, 0, TAU);
        ctx.fill();
      }
    }
  }
  // the nose, the mouth, the whiskers
  ctx.fillStyle = '#C4673F';
  ctx.beginPath();
  ctx.moveTo(-hr * 0.1, hy + hr * 0.25);
  ctx.lineTo(hr * 0.1, hy + hr * 0.25);
  ctx.lineTo(0, hy + hr * 0.36);
  ctx.fill();
  ctx.strokeStyle = '#3B2A22';
  ctx.lineWidth = Math.max(0.8, s * 0.018);
  ctx.beginPath();
  if (pose === 'talk' && Math.sin(t * 14) > 0) {
    ctx.ellipse(0, hy + hr * 0.5, hr * 0.12, hr * 0.12, 0, 0, TAU);
  } else if (pose === 'shock') {
    ctx.ellipse(0, hy + hr * 0.52, hr * 0.1, hr * 0.14, 0, 0, TAU);
  } else {
    ctx.moveTo(-hr * 0.2, hy + hr * 0.45);
    ctx.quadraticCurveTo(0, hy + hr * 0.58, hr * 0.2, hy + hr * 0.45);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,248,236,.85)';
  for (const sx of [-1, 1]) for (const k of [-0.08, 0.06]) {
    ctx.beginPath();
    ctx.moveTo(sx * hr * 0.3, hy + hr * 0.36);
    ctx.lineTo(sx * hr * 1.35, hy + hr * (0.3 + k * 3));
    ctx.stroke();
  }
  // the front paws
  ctx.fillStyle = light;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.1, -s * 0.03, s * 0.08, s * 0.05, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function ears(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fur: string, light: string): void {
  for (const sx of [-1, 1]) {
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.moveTo(x + sx * s * 0.08, y + s * 0.04);
    ctx.lineTo(x + sx * s * 0.2, y - s * 0.14);
    ctx.lineTo(x + sx * s * 0.24, y + s * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(x + sx * s * 0.12, y + s * 0.03);
    ctx.lineTo(x + sx * s * 0.2, y - s * 0.08);
    ctx.lineTo(x + sx * s * 0.21, y + s * 0.04);
    ctx.closePath();
    ctx.fill();
  }
}

/** A shekel: a small silver coin with a rim. */
export function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  const sx = Math.max(0.15, Math.abs(Math.cos(spin)));
  ctx.fillStyle = '#B8B2A6';
  ctx.beginPath();
  ctx.ellipse(x, y, r * sx, r, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E6E1D6';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.12 * sx, y - r * 0.12, r * 0.72 * sx, r * 0.72, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8E877A';
  ctx.lineWidth = Math.max(0.8, r * 0.14);
  ctx.beginPath();
  ctx.ellipse(x, y, r * sx, r, 0, 0, TAU);
  ctx.stroke();
}

// ── pieces drawn small ───────────────────────────────────────────
/** A shelf piece's look (the lobby, the panel's tiles, the shelf). */
export function recLook(v: VesselLook, rec: PieceRec, x: number, y: number, scale: number, rows = 40): VesselLook {
  const r = new Float64Array(RINGS);
  for (let k = 0; k < RINGS; k++) r[k] = (rec.q[k] ?? 40) / 100 * rec.h;
  return Object.assign(v, look(), {
    x, y, scale, H: rec.h, r, body: 'glazed', glaze: rec.g, fired: 1, gloss: 0.6, gift: rec.gift, rows, specks: false,
    bands: rec.b.map(([u, g, p]) => ({ u: u / 100, glaze: g, pattern: p, k: 1 })), wall: 0.5,
  });
}
