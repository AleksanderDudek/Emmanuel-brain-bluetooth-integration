/**
 * Glina's places, painted as flat, sun-bleached gouache shapes: the potter's courtyard (sky over a
 * hill town, the whitewashed wall with its terracotta coping, the gate arch with a slice of the
 * street, the fig tree, the paved floor, and the beehive kiln when the screen is wide), baked to an
 * offscreen layer once per size; the leaf shadows and a cloud's shadow drift over it live.  The kiln
 * up close for the firing (its glowing door, the vessel inside, ash motes; plugged for a closed
 * kiln), the opening with its steam, and the street at sunset with the three households' houses,
 * their vessels in use and the houses that came alive.  No faces anywhere: neighbours are warm
 * silhouettes.
 */
import { clamp } from '../kit/juice';
import { RINGS } from './clay';
import { FORM, HOUSES, STORY, type GiftId, type HouseId } from './content';
import type { Layout, Rect } from './layout';
import type { GlinaProgress, StreetItem, VesselRec } from './meta';
import { C, GLAZE, almond, cat, hash, mix } from './paint';
import { drawVessel, look, type VesselLook } from './vessel';

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

// ── pieces ───────────────────────────────────────────────────────
/** A soft round shadow sprite (leaf shadows, the cloud), made once. */
let blob: HTMLCanvasElement | null = null;
export function softBlob(): HTMLCanvasElement | null {
  if (blob || typeof document === 'undefined') return blob;
  const o = offscreen(64, 64, 1);
  if (!o) return null;
  const g = o.ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(107,91,115,1)');
  g.addColorStop(0.55, 'rgba(107,91,115,.55)');
  g.addColorStop(1, 'rgba(107,91,115,0)');
  o.ctx.fillStyle = g;
  o.ctx.fillRect(0, 0, 64, 64);
  blob = o.c;
  return blob;
}

/** A flat-roofed hill-town house seen far off. */
function farHouse(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, i: number): void {
  ctx.fillStyle = mix(C.whitewash, C.sand, 0.25 + hash(i) * 0.3);
  ctx.fillRect(x, base - h, w, h);
  ctx.fillStyle = 'rgba(107,91,115,.18)';
  ctx.fillRect(x + w * 0.72, base - h, w * 0.28, h);
  ctx.fillStyle = 'rgba(59,42,34,.42)';
  const n = 1 + Math.floor(hash(i + 3) * 3);
  for (let k = 0; k < n; k++) ctx.fillRect(x + w * (0.18 + k * 0.26), base - h * 0.62, Math.max(1.5, w * 0.1), Math.max(2, h * 0.22));
  if (hash(i + 5) < 0.3) {
    ctx.fillStyle = mix(C.whitewash, C.sand, 0.2);
    ctx.beginPath();
    ctx.arc(x + w / 2, base - h, w * 0.28, Math.PI, TAU);
    ctx.fill();
  }
}

/** A gouache hill line between x0 and x1 at `y`, `amp` high, filled down to `bottom`. */
function hills(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, amp: number, bottom: number, color: string, seed: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1 + 8; x += 8) {
    const k = x / 140;
    ctx.lineTo(x, y - amp * (0.5 + 0.3 * Math.sin(k + seed) + 0.2 * Math.sin(k * 2.7 + seed * 1.7)));
  }
  ctx.lineTo(x1, bottom);
  ctx.closePath();
  ctx.fill();
}

/** A fig leaf: five rounded lobes. */
function figLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const la = -Math.PI / 2 + (i - 2) * 0.62;
    const lr = s * (i === 2 ? 1 : i === 1 || i === 3 ? 0.86 : 0.6);
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(la - 0.35) * lr * 0.9, Math.sin(la - 0.35) * lr * 0.9, Math.cos(la) * lr, Math.sin(la) * lr);
    ctx.quadraticCurveTo(Math.cos(la + 0.35) * lr * 0.9, Math.sin(la + 0.35) * lr * 0.9, 0, 0);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,50,20,.35)';
  ctx.lineWidth = Math.max(0.6, s * 0.05);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const la = -Math.PI / 2 + (i - 2) * 0.62;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(la) * s * 0.6, Math.sin(la) * s * 0.6);
  }
  ctx.stroke();
  ctx.restore();
}

/** The fig tree: a grey trunk from behind the wall and a canopy of broad leaves. */
function figTree(ctx: CanvasRenderingContext2D, cx: number, top: number, s: number, wallTop: number): void {
  ctx.strokeStyle = '#7A6E64';
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.1, wallTop + s * 0.4);
  ctx.quadraticCurveTo(cx - s * 0.2, top + s * 1.1, cx + s * 0.15, top + s * 0.55);
  ctx.stroke();
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, top + s * 0.9);
  ctx.quadraticCurveTo(cx - s * 0.7, top + s * 0.6, cx - s * 1.1, top + s * 0.7);
  ctx.moveTo(cx + s * 0.1, top + s * 0.75);
  ctx.quadraticCurveTo(cx + s * 0.7, top + s * 0.5, cx + s * 1.2, top + s * 0.62);
  ctx.stroke();
  for (let i = 0; i < 26; i++) {
    const a = hash(i + 200) * TAU, d = Math.sqrt(hash(i + 201)) * s * 1.25;
    const lx = cx + Math.cos(a) * d * 1.25, ly = top + s * 0.55 + Math.sin(a) * d * 0.62;
    const tone = hash(i + 202);
    figLeaf(ctx, lx, ly, s * (0.32 + hash(i + 203) * 0.16), a * 0.5 - 0.4, tone < 0.33 ? '#3E6630' : tone < 0.7 ? C.fig : '#6E9A4C');
  }
}

/** The beehive kiln of mud bricks: a dome with a door arch (dark when cold), soot above the door. */
export function kilnDome(ctx: CanvasRenderingContext2D, r: Rect, door: 'cold' | 'glow' | 'plugged' | 'open', heat: number): void {
  const cx = r.x + r.w / 2, base = r.y + r.h;
  const dw = r.w * 0.36, dh = r.h * 0.42;
  // the dome
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
  // brick courses
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(58,42,38,.28)';
  ctx.lineWidth = 1;
  const course = Math.max(6, r.h / 14);
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
  // soot over the door, and the vent at the top
  const sg = ctx.createRadialGradient(cx, base - dh * 1.05, 0, cx, base - dh * 1.05, dw * 1.3);
  sg.addColorStop(0, 'rgba(58,42,38,.55)');
  sg.addColorStop(1, 'rgba(58,42,38,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.fillStyle = C.soot;
  ctx.beginPath();
  ctx.ellipse(cx, r.y + r.h * 0.04, r.w * 0.07, r.h * 0.025, 0, 0, TAU);
  ctx.fill();
  // the door arch
  ctx.beginPath();
  ctx.moveTo(cx - dw / 2, base);
  ctx.lineTo(cx - dw / 2, base - dh + dw / 2);
  ctx.arc(cx, base - dh + dw / 2, dw / 2, Math.PI, TAU);
  ctx.lineTo(cx + dw / 2, base);
  ctx.closePath();
  if (door === 'cold') {
    ctx.fillStyle = '#2A1D18';
    ctx.fill();
  } else if (door === 'plugged') {
    ctx.fillStyle = mix(C.brick, '#5A3A2A', 0.35);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(40,26,20,.45)';
    for (let y = base - course * 0.8, row = 0; y > base - dh; y -= course * 0.8, row++) {
      ctx.beginPath();
      ctx.moveTo(cx - dw, y);
      ctx.lineTo(cx + dw, y);
      ctx.stroke();
      for (let x = cx - dw + (row % 2) * course * 0.8; x < cx + dw; x += course * 1.6) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + course * 0.8);
        ctx.stroke();
      }
    }
    ctx.restore();
    // the spy-holes, a steady glow
    for (const k of [-0.22, 0.22]) {
      ctx.fillStyle = `rgba(255,170,90,${(0.7 + 0.2 * heat).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + k * dw, base - dh * 0.55, Math.max(2, dw * 0.05), 0, TAU);
      ctx.fill();
    }
  } else {
    const gg = ctx.createRadialGradient(cx, base - dh * 0.4, 0, cx, base - dh * 0.4, dh * 0.9);
    const k = door === 'open' ? 0.45 + 0.4 * heat : 0.75 + 0.25 * heat;
    gg.addColorStop(0, mix('#3A2A26', C.chamber1, k));
    gg.addColorStop(0.55, mix('#3A2A26', C.chamber2, k));
    gg.addColorStop(1, mix('#2A1D18', C.ember, k * 0.85));
    ctx.fillStyle = gg;
    ctx.fill();
  }
  // the arch's stones
  ctx.strokeStyle = mix(C.brick, '#E8C49C', 0.35);
  ctx.lineWidth = Math.max(2, dw * 0.08);
  ctx.beginPath();
  ctx.moveTo(cx - dw / 2, base);
  ctx.lineTo(cx - dw / 2, base - dh + dw / 2);
  ctx.arc(cx, base - dh + dw / 2, dw / 2, Math.PI, TAU);
  ctx.lineTo(cx + dw / 2, base);
  ctx.stroke();
  // the firebox mouth below the door, and a stack of olive prunings
  ctx.fillStyle = '#20150F';
  ctx.fillRect(cx - dw * 0.3, base - course * 0.9, dw * 0.6, course * 0.9);
}

/** The door's chamber in the kiln rect (where the vessel sits while it fires). */
export function kilnDoor(r: Rect): Rect {
  const cx = r.x + r.w / 2, base = r.y + r.h;
  const dw = r.w * 0.36, dh = r.h * 0.42;
  return { x: cx - dw / 2, y: base - dh, w: dw, h: dh };
}

// ── the courtyard ────────────────────────────────────────────────
export interface CourtyardDyn {
  t: number;
  /** 0 morning … 1 the golden hour */
  light: number;
  /** the cloud's shadow when the signal fails (0..1) */
  cloud: number;
  /** leaf shadows move (not with reduced motion) */
  still: boolean;
  /** the received gifts that live in the courtyard, and today's treat */
  gifts: readonly GiftId[];
  treat: GiftId | null;
}

export class Courtyard {
  private bg: HTMLCanvasElement | null = null;
  private key = '';

  /** The static layer for this size (sky, town, wall, gate, fig tree, floor, the kiln when wide). */
  bake(L: Layout, dpr: number): HTMLCanvasElement | null {
    const key = `${L.w}x${L.h}@${dpr}`;
    if (this.bg && this.key === key) return this.bg;
    const o = offscreen(L.w, L.h, dpr);
    if (!o) return null;
    paintCourtyard(o.ctx, L);
    this.bg = o.c;
    this.key = key;
    return this.bg;
  }

  draw(ctx: CanvasRenderingContext2D, L: Layout, dpr: number, d: CourtyardDyn): void {
    const bg = this.bake(L, dpr);
    if (bg) ctx.drawImage(bg, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = C.whitewash;
      ctx.fillRect(0, 0, L.w, L.h);
    }
    // leaf shadows drifting over the wall
    const sp = softBlob();
    if (sp) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      const wallH = L.floor - L.wallTop;
      for (let i = 0; i < 7; i++) {
        const drift = d.still ? 0 : Math.sin(d.t * 0.21 + i * 1.9) * 14 * L.u;
        const x = L.w * (0.52 + 0.46 * hash(i + 300)) + drift, y = L.wallTop + wallH * (0.08 + 0.5 * hash(i + 301));
        const s = (46 + 40 * hash(i + 302)) * L.u;
        ctx.drawImage(sp, x - s, y - s * 0.6, s * 2, s * 1.2);
      }
      ctx.restore();
    }
    gifts(ctx, L, d);
    // the light of the day: a cool morning, a neutral noon, the golden hour's warmth
    const warm = clamp((d.light - 0.55) / 0.45);
    ctx.save();
    if (warm > 0) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.28 * warm;
      ctx.fillStyle = C.golden;
      ctx.fillRect(0, 0, L.w, L.h);
    } else if (d.light < 0.25) {
      ctx.globalAlpha = 0.07 * (1 - d.light / 0.25);
      ctx.fillStyle = '#BFD6EA';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    ctx.restore();
    // a cloud's shadow drifts over the courtyard while the signal fails
    if (d.cloud > 0.01 && sp) {
      ctx.save();
      ctx.globalAlpha = 0.3 * d.cloud;
      const cx = L.w * (0.3 + 0.4 * Math.sin(d.t * 0.07)), s = Math.max(L.w, L.h) * 0.6;
      ctx.drawImage(sp, cx - s, L.h * 0.45 - s * 0.6, s * 2, s * 1.2);
      ctx.restore();
    }
  }
}

function paintCourtyard(ctx: CanvasRenderingContext2D, L: Layout): void {
  const { w, h, wallTop, floor } = L;
  // the sky: deep at the top (the runner's white timer stays readable), pale at the horizon
  const sky = ctx.createLinearGradient(0, 0, 0, wallTop);
  sky.addColorStop(0, C.zenith);
  sky.addColorStop(Math.min(0.9, 80 / Math.max(1, wallTop)), C.sky);
  sky.addColorStop(1, C.horizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, wallTop + 2);
  // the hill town beyond the wall
  const town = wallTop + 2;
  hills(ctx, 0, w, town - 18 * L.u, 26 * L.u, town, mix(C.olive, C.horizon, 0.62), 1.3);
  hills(ctx, 0, w, town - 6 * L.u, 18 * L.u, town, mix(C.sand, C.olive, 0.25), 4.1);
  for (let i = 0; i < 14; i++) {
    const hw = (14 + hash(i + 50) * 16) * L.u, hh = (9 + hash(i + 51) * 14) * L.u;
    const x = (hash(i + 52) * 1.1 - 0.05) * w;
    farHouse(ctx, x, town + 1, hw, hh, i);
  }
  for (let i = 0; i < 5; i++) {
    const x = hash(i + 90) * w, s = (6 + hash(i + 91) * 5) * L.u;
    ctx.fillStyle = mix(C.olive, '#3E5A2A', 0.4);
    ctx.beginPath();
    ctx.ellipse(x, town - s * 1.2, s * 0.45, s * 1.5, 0, 0, TAU);
    ctx.fill();
  }
  // the wall: whitewash in the sun, its grain, the terracotta coping
  const wall = ctx.createLinearGradient(0, wallTop, 0, floor);
  wall.addColorStop(0, '#F8F4EC');
  wall.addColorStop(1, mix(C.whitewash, C.sand, 0.35));
  ctx.fillStyle = wall;
  ctx.fillRect(0, wallTop, w, floor - wallTop);
  ctx.fillStyle = 'rgba(107,91,115,.05)';
  for (let i = 0; i < 520; i++) {
    const gx = hash(i * 3 + 1) * w, gy = wallTop + hash(i * 3 + 2) * (floor - wallTop);
    ctx.fillRect(gx, gy, 1 + hash(i * 3 + 3) * 2, 1);
  }
  for (let i = 0; i < 6; i++) {
    // patches of older plaster
    ctx.fillStyle = `rgba(233,216,188,${(0.25 + hash(i + 120) * 0.25).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(hash(i + 121) * w, wallTop + (0.3 + hash(i + 122) * 0.6) * (floor - wallTop), (20 + hash(i + 123) * 40) * L.u, (8 + hash(i + 124) * 14) * L.u, 0, 0, TAU);
    ctx.fill();
  }
  const cop = 9 * L.u;
  ctx.fillStyle = C.terracotta;
  ctx.fillRect(0, wallTop - cop * 0.4, w, cop);
  ctx.fillStyle = 'rgba(80,30,16,.35)';
  ctx.fillRect(0, wallTop + cop * 0.6, w, Math.max(1, cop * 0.25));
  ctx.fillStyle = 'rgba(255,214,180,.4)';
  for (let x = 0; x < w; x += 12 * L.u) ctx.fillRect(x, wallTop - cop * 0.4, 6 * L.u, Math.max(1, cop * 0.2));
  // the fig tree over the wall, away from the gate
  const figX = L.kind === 'desktop' ? L.card.x + L.card.w + (L.axis - L.halfW - L.card.x - L.card.w) * 0.5 : w * 0.86;
  figTree(ctx, figX, wallTop - 70 * L.u, 62 * L.u, wallTop);
  // the gate arch with a slice of the street beyond (its houses' items are drawn live)
  gateArch(ctx, L.gate, L.u);
  // the floor: sun sand with large flagstones, a cool shadow along the wall
  const fl = ctx.createLinearGradient(0, floor, 0, h);
  fl.addColorStop(0, mix(C.sand, C.shadow, 0.12));
  fl.addColorStop(0.18, C.sand);
  fl.addColorStop(1, mix(C.sand, '#FFFFFF', 0.2));
  ctx.fillStyle = fl;
  ctx.fillRect(0, floor, w, h - floor);
  ctx.strokeStyle = 'rgba(138,90,60,.14)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const y = floor + (h - floor) * (i / 7) ** 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(L.axis + i * 46 * L.u, floor);
    ctx.lineTo(L.axis + i * 120 * L.u, h);
    ctx.stroke();
  }
  // the kiln at the side when the screen is wide
  if (L.kiln) {
    ctx.fillStyle = 'rgba(107,91,115,.25)';
    ctx.beginPath();
    ctx.ellipse(L.kiln.x + L.kiln.w * 0.5, L.kiln.y + L.kiln.h, L.kiln.w * 0.62, L.kiln.w * 0.09, 0, 0, TAU);
    ctx.fill();
    kilnDome(ctx, L.kiln, 'cold', 0);
  }
}

function gateArch(ctx: CanvasRenderingContext2D, g: Rect, u: number): void {
  const r = g.w / 2, top = g.y + r;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + g.h);
  ctx.lineTo(g.x, top);
  ctx.arc(g.x + r, top, r, Math.PI, TAU);
  ctx.lineTo(g.x + g.w, g.y + g.h);
  ctx.closePath();
  ctx.clip();
  // beyond the gate: the sky, the house across the street, the road
  ctx.fillStyle = C.horizon;
  ctx.fillRect(g.x, g.y, g.w, g.h);
  const road = g.y + g.h * 0.78;
  ctx.fillStyle = mix(C.whitewash, C.sand, 0.15);
  ctx.fillRect(g.x - 2, g.y + g.h * 0.18, g.w + 4, road - g.y - g.h * 0.18);
  ctx.fillStyle = C.terracotta;
  ctx.fillRect(g.x - 2, g.y + g.h * 0.18, g.w + 4, 4 * u);
  ctx.fillStyle = mix(C.wood, '#2E4A6E', 0.35);
  ctx.fillRect(g.x + g.w * 0.56, road - g.h * 0.34, g.w * 0.2, g.h * 0.34);
  ctx.fillStyle = 'rgba(59,42,34,.5)';
  ctx.fillRect(g.x + g.w * 0.16, road - g.h * 0.4, g.w * 0.14, g.h * 0.12);
  ctx.fillStyle = mix(C.sand, '#FFFFFF', 0.1);
  ctx.fillRect(g.x, road, g.w, g.h - (road - g.y));
  ctx.fillStyle = 'rgba(107,91,115,.18)';
  ctx.fillRect(g.x, road, g.w, 3 * u);
  ctx.restore();
  // the arch's stones
  ctx.strokeStyle = mix(C.sand, C.wood, 0.25);
  ctx.lineWidth = 7 * u;
  ctx.beginPath();
  ctx.moveTo(g.x, g.y + g.h);
  ctx.lineTo(g.x, top);
  ctx.arc(g.x + r, top, r, Math.PI, TAU);
  ctx.lineTo(g.x + g.w, g.y + g.h);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,250,240,.6)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.arc(g.x + r, top, r + 2.5 * u, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
}

/** The courtyard's gifts: a cat on the coping, an almond sprig, a woven mat by the wheel, a bell at the gate, today's treat. */
function gifts(ctx: CanvasRenderingContext2D, L: Layout, d: CourtyardDyn): void {
  const u = L.u;
  if (d.gifts.includes('mata')) {
    ctx.save();
    ctx.translate(L.axis - L.halfW * 1.15, L.foot + 18 * u);
    ctx.fillStyle = '#C9A96E';
    ctx.beginPath();
    ctx.ellipse(0, 0, 46 * u, 11 * u, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,80,40,.45)';
    ctx.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 46 * u * (1 - Math.abs(i) * 0.12), 11 * u * (1 - Math.abs(i) * 0.12), 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (d.gifts.includes('kot')) cat(ctx, L.w * (L.kind === 'portrait' ? 0.62 : 0.4), L.wallTop - 3 * u, 22 * u, d.t);
  if (d.gifts.includes('migdal')) almond(ctx, L.gate.x + L.gate.w + 26 * u, L.floor - 2, 30 * u);
  if (d.gifts.includes('dzwonek')) {
    const x = L.gate.x + L.gate.w * 0.5, y = L.gate.y + 8 * u;
    ctx.strokeStyle = '#5E4636';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 6 * u);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = '#B8862E';
    ctx.beginPath();
    ctx.moveTo(x - 6 * u, y + 9 * u);
    ctx.quadraticCurveTo(x - 5 * u, y, x, y);
    ctx.quadraticCurveTo(x + 5 * u, y, x + 6 * u, y + 9 * u);
    ctx.closePath();
    ctx.fill();
  }
  if (d.treat) {
    const x = L.gate.x + L.gate.w + 70 * u, y = L.floor + 8 * u;
    ctx.fillStyle = '#A8885E';
    ctx.beginPath();
    ctx.ellipse(x, y, 20 * u, 6 * u, 0, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = d.treat === 'figi' ? '#5B3A5E' : d.treat === 'oliwki' ? '#5E6B2E' : '#C99A5B';
      ctx.beginPath();
      ctx.arc(x - 12 * u + i * 4.8 * u, y - 4 * u - (i % 2) * 3 * u, (d.treat === 'chleb' ? 7 : 3.4) * u, 0, TAU);
      ctx.fill();
      if (d.treat === 'chleb') break;
    }
  }
}

/** A neighbour in the gate's arch: a warm silhouette, no face (`k` 0..1 as they step in). */
export function neighbour(ctx: CanvasRenderingContext2D, g: Rect, k: number, traveller: boolean, u: number): void {
  if (k <= 0.01) return;
  const x = g.x + g.w * (0.5 + (1 - k) * 0.4), base = g.y + g.h - 2;
  const hgt = Math.min(g.h * 0.62, g.w * 1.3);
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.4);
  ctx.fillStyle = traveller ? '#6B5240' : '#7A5A48';
  // the robe
  ctx.beginPath();
  ctx.moveTo(x - hgt * 0.2, base);
  ctx.quadraticCurveTo(x - hgt * 0.22, base - hgt * 0.55, x - hgt * 0.1, base - hgt * 0.78);
  ctx.lineTo(x + hgt * 0.1, base - hgt * 0.78);
  ctx.quadraticCurveTo(x + hgt * 0.22, base - hgt * 0.55, x + hgt * 0.2, base);
  ctx.closePath();
  ctx.fill();
  // the head, covered
  ctx.fillStyle = traveller ? '#8A6E52' : '#A6745A';
  ctx.beginPath();
  ctx.ellipse(x, base - hgt * 0.86, hgt * 0.085, hgt * 0.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = traveller ? '#C8B48E' : '#E4D3B4';
  ctx.beginPath();
  ctx.moveTo(x - hgt * 0.11, base - hgt * 0.8);
  ctx.quadraticCurveTo(x - hgt * 0.12, base - hgt * 1.0, x, base - hgt * 0.99);
  ctx.quadraticCurveTo(x + hgt * 0.12, base - hgt * 1.0, x + hgt * 0.12, base - hgt * 0.74);
  ctx.quadraticCurveTo(x + hgt * 0.05, base - hgt * 0.84, x - hgt * 0.11, base - hgt * 0.8);
  ctx.fill();
  if (traveller) {
    ctx.strokeStyle = '#5E4636';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(x + hgt * 0.26, base);
    ctx.lineTo(x + hgt * 0.22, base - hgt * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}

// ── the street ───────────────────────────────────────────────────
/** A vessel record drawn small (the street, the tiles, the lobby). */
export function recLook(v: VesselLook, rec: VesselRec, x: number, y: number, scale: number, rows = 40): VesselLook {
  const f = FORM[rec.f];
  const H = rec.h || f.N;
  v.x = x;
  v.y = y;
  v.scale = scale;
  v.H = H;
  const r = v.r as Float64Array;
  for (let k = 0; k < RINGS; k++) r[k] = ((rec.q[k] ?? Math.round(f.q[k] * 100)) / 100) * H;
  v.body = 'glazed';
  v.porcelain = rec.porcelain;
  v.glaze = rec.glaze;
  v.fired = 1;
  v.gloss = 0.6;
  v.wavy = 0;
  v.runs = rec.runs / 100;
  v.gift = rec.gift;
  v.wall = [0.9, 0.6, 0.4, 0.25][rec.wall] ?? 0.6;
  v.attach = f.attach;
  v.glow = 0;
  v.rows = rows;
  v.specks = false;
  v.alpha = 1;
  return v;
}

const streetLook = look();

export interface StreetDyn { t: number; dusk: number; glint: number; alive: readonly HouseId[]; lamps: boolean }

/**
 * The street at sunset: the three households' houses side by side, each with its door, windows and
 * awning, the vessels of its story in use (from the book) and its last everyday deliveries by the
 * door, the houses come alive lit and with two figures on the step.  Drawn in `r`.
 */
export function drawStreet(ctx: CanvasRenderingContext2D, r: Rect, p: GlinaProgress, d: StreetDyn): void {
  const sky = ctx.createLinearGradient(0, r.y, 0, r.y + r.h * 0.6);
  sky.addColorStop(0, mix(C.zenith, C.sunset3, d.dusk));
  sky.addColorStop(0.55, mix(C.sky, C.sunset1, d.dusk));
  sky.addColorStop(1, mix(C.horizon, C.sunset2, d.dusk * 0.8));
  ctx.fillStyle = sky;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  // the sun low over the hills
  ctx.fillStyle = `rgba(255,214,150,${(0.85 * d.dusk).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(r.x + r.w * 0.78, r.y + r.h * 0.42, Math.min(r.w, r.h) * 0.06, 0, TAU);
  ctx.fill();
  hills(ctx, r.x, r.x + r.w, r.y + r.h * 0.46, r.h * 0.07, r.y + r.h, mix(C.olive, C.sunset3, 0.55 * d.dusk), 2.2);
  const ground = r.y + r.h * 0.8;
  ctx.fillStyle = mix(C.sand, C.sunset2, 0.25 * d.dusk);
  ctx.fillRect(r.x, ground, r.w, r.y + r.h - ground);
  const n = HOUSES.length, gap = r.w * 0.03, hw = (r.w - gap * (n + 1)) / n;
  const hh = Math.min(r.h * 0.42, hw * 1.05);
  HOUSES.forEach((h, i) => house(ctx, r.x + gap + i * (hw + gap), ground, hw, hh, h, p, d, i));
}

function house(ctx: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, id: HouseId, p: GlinaProgress, d: StreetDyn, i: number): void {
  const alive = d.alive.includes(id);
  const wall = mix(C.whitewash, C.sunset1, 0.28 * d.dusk);
  ctx.fillStyle = wall;
  ctx.fillRect(x, base - h, w, h);
  ctx.fillStyle = `rgba(107,91,115,${(0.15 + 0.15 * d.dusk).toFixed(3)})`;
  ctx.fillRect(x + w * 0.78, base - h, w * 0.22, h);
  ctx.fillStyle = mix(C.terracotta, C.sunset3, 0.3 * d.dusk);
  ctx.fillRect(x - 3, base - h - 5, w + 6, 6);
  // the door
  const dw = w * 0.22, dh = h * 0.52, dx = x + w * (i === 1 ? 0.56 : 0.16);
  ctx.fillStyle = alive ? '#F2C48A' : mix(C.wood, '#2E2A3A', 0.35 * d.dusk);
  ctx.beginPath();
  ctx.roundRect(dx, base - dh, dw, dh, [dw / 2, dw / 2, 0, 0]);
  ctx.fill();
  // the windows, lit where a lamp was made or the house is alive
  const lit = alive || (id === 'piekarnia' && (p.steps.piekarnia >= 4 || d.lamps));
  for (let k = 0; k < 2; k++) {
    const wx = x + w * (i === 1 ? 0.14 + k * 0.2 : 0.52 + k * 0.22), wy = base - h * 0.72;
    ctx.fillStyle = lit ? `rgba(255,206,130,${(0.6 + 0.35 * d.dusk).toFixed(3)})` : 'rgba(59,42,34,.55)';
    ctx.fillRect(wx, wy, w * 0.12, h * 0.16);
  }
  // an awning
  ctx.fillStyle = id === 'karczma' ? '#B9653E' : id === 'piekarnia' ? '#C9A24E' : '#7E8C4F';
  ctx.beginPath();
  ctx.moveTo(dx - w * 0.05, base - dh - h * 0.06);
  ctx.lineTo(dx + dw + w * 0.05, base - dh - h * 0.06);
  ctx.lineTo(dx + dw + w * 0.09, base - dh + h * 0.04);
  ctx.lineTo(dx - w * 0.09, base - dh + h * 0.04);
  ctx.closePath();
  ctx.fill();
  if (id === 'mlodzi' && p.steps.mlodzi >= 3) {
    // the vine from the planter up the wall (over the door when alive)
    ctx.strokeStyle = '#4F7A3A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(dx + dw + w * 0.12, base - 4);
    ctx.bezierCurveTo(dx + dw + w * 0.2, base - h * 0.4, dx + dw * 0.5, base - h * (alive ? 0.95 : 0.7), dx - w * 0.04, base - dh - h * 0.1);
    ctx.stroke();
    ctx.fillStyle = '#5E8E44';
    for (let k = 0; k < (alive ? 12 : 6); k++) {
      ctx.beginPath();
      ctx.arc(dx + dw * (1.3 - k * 0.12) , base - h * (0.2 + k * 0.06), 3 + hash(k + 70) * 2, 0, TAU);
      ctx.fill();
    }
  }
  // the story's vessels in use, from the book (drawn small, the player's own shapes and glazes)
  const s = Math.max(1.2, h / 52);
  let ix = x + w * 0.06;
  const done = p.steps[id];
  for (let k = 0; k < done; k++) {
    const rec = p.book[STORY[id][k]]?.best;
    if (!rec) continue;
    const sc = Math.min(s, (h * 0.32) / Math.max(1, rec.h));
    drawVessel(ctx, recLook(streetLook, rec, ix + 8 * s, base - 1, sc, 26));
    ix += Math.max(12 * s, Math.max(...rec.q) / 100 * rec.h * sc * 2.4);
  }
  // the everyday deliveries by the door
  const items: readonly StreetItem[] = p.street[id];
  items.forEach((it, k) => {
    const rec = p.book[it.f]?.best;
    if (!rec) return;
    const sc = Math.min(s * 0.8, (h * 0.24) / Math.max(1, rec.h));
    drawVessel(ctx, recLook(streetLook, { ...rec, glaze: it.glaze }, x + w * (0.66 + k * 0.11), base - 1, sc, 20));
  });
  if (alive) {
    // two figures on the step, warm silhouettes in the doorway's light
    for (const k of [-1, 1]) {
      const fx = dx + dw / 2 + k * dw * 0.9, fh = h * 0.42;
      ctx.fillStyle = 'rgba(70,46,40,.85)';
      ctx.beginPath();
      ctx.moveTo(fx - fh * 0.14, base);
      ctx.quadraticCurveTo(fx - fh * 0.16, base - fh * 0.6, fx, base - fh * 0.78);
      ctx.quadraticCurveTo(fx + fh * 0.16, base - fh * 0.6, fx + fh * 0.14, base);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(fx, base - fh * 0.86, fh * 0.09, 0, TAU);
      ctx.fill();
    }
  }
  if (d.glint > 0) {
    ctx.fillStyle = `rgba(255,248,220,${(0.6 * d.glint).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x + w * 0.2, base - h * 0.2, 3 + 4 * d.glint, 0, TAU);
    ctx.fill();
  }
}

/** The glaze's own colour, for chips and the buckets. */
export const glazeColor = (g: keyof typeof GLAZE): string => GLAZE[g].c;
