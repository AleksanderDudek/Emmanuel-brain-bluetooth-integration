/**
 * The lining of the small intestine (DESIGN.md §24, Każda komórka · Odnowa tkanek · "Nabłonek jelita"): a section
 * through the mucosa — four villi rising into the lumen, the crypts between them reaching down — lined by one layer
 * of tall epithelial cells (their nuclei near the base, a bright brush border on top); inside each villus its core
 * with a capillary loop and the pale lacteal.  At the bottom of each crypt the stem cells (aqua) sit between the
 * Paneth cells (gold grains).  As the scene grows a wave of new cells climbs from the crypts up both sides of the
 * villi to their tips, where the oldest are shed into the lumen — the lining renewed in a few days (Darwich et al.
 * 2014: ≈ 3.5 days in humans; Barker et al. 2007: the crypt-base stem cells).
 */
import { AQUA, GOLD, GOLD_HI, PEARL, TAU, glow, glowEllipse, hash, rgba, smoothPath, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { dot, sparkle, type P2 } from './draw';
import { t } from './i18n';

const BASE_Y = 30, TIP_Y = -66, CRYPT_Y = 82;
const VW = 13, CW = 7;
export const VILLI = [-84, -28, 28, 84];
/** Each villus' tip (they are not all of one height). */
const TIPS = [-60, -70, -64, -68];
const tipOf = (vx: number): number => TIPS[VILLI.indexOf(vx)] ?? TIP_Y;
const nearestVillus = (x: number): number => VILLI.reduce((m, v) => (Math.abs(v - x) < Math.abs(m - x) ? v : m), VILLI[0]);
export const CRYPTS = [-112, -56, 0, 56, 112];
const EPI = 7.5; // the epithelium's height

/** The apical surface as points, left to right (villi up, crypts down), sampled about every unit. */
const SURF: P2[] = (() => {
  const raw: P2[] = [[-150, BASE_Y]];
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number): void => {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      raw.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  const xs = [...CRYPTS.map(x => ({ x, k: 'c' as const })), ...VILLI.map(x => ({ x, k: 'v' as const }))].sort((a, b) => a.x - b.x);
  for (const { x, k } of xs) {
    if (k === 'c') {
      raw.push([x - CW, BASE_Y]);
      raw.push([x - CW, CRYPT_Y]);
      arc(x, CRYPT_Y, CW, Math.PI, 0);
      raw.push([x + CW, BASE_Y]);
    } else {
      raw.push([x - VW, BASE_Y]);
      raw.push([x - VW, tipOf(x)]);
      arc(x, tipOf(x), VW, Math.PI, TAU);
      raw.push([x + VW, BASE_Y]);
    }
  }
  raw.push([150, BASE_Y]);
  // resample evenly
  const out: P2[] = [raw[0]];
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const [ax, ay] = raw[i - 1], [bx, by] = raw[i];
    const d = Math.hypot(bx - ax, by - ay);
    let s = 1 - carry;
    while (s <= d) {
      out.push([ax + ((bx - ax) * s) / d, ay + ((by - ay) * s) / d]);
      s += 1;
    }
    carry = d - (s - 1);
  }
  return out;
})();

/** The inward normal at i (toward the tissue: right of the direction of travel, y down). */
function normal(i: number): P2 {
  const a = SURF[Math.max(0, i - 2)], b = SURF[Math.min(SURF.length - 1, i + 2)];
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
  return [-dy / d, dx / d];
}

/** The cells: every CELL_W units of surface one tall cell; its age along the conveyor (0 crypt bottom … 1 villus tip). */
const CELL_W = 4.2;
interface Cell { i0: number; i1: number; age: number; side: number; tip: boolean; stem: boolean; paneth: boolean }
const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  const step = Math.round(CELL_W);
  for (let i0 = 0; i0 + step < SURF.length; i0 += step) {
    const i1 = i0 + step;
    const [x, y] = SURF[Math.floor((i0 + i1) / 2)];
    // the nearest crypt bottom and villus tip along x
    const c = CRYPTS.reduce((m, cx) => (Math.abs(cx - x) < Math.abs(m - x) ? cx : m), CRYPTS[0]);
    const inCrypt = y > BASE_Y + 1 && Math.abs(x - c) <= CW + 0.5;
    let age: number;
    if (inCrypt) age = 0.32 * ((CRYPT_Y + CW - y) / (CRYPT_Y + CW - BASE_Y));
    else if (y > BASE_Y - 1) age = 0.34;
    else age = 0.34 + 0.66 * ((BASE_Y - y) / (BASE_Y - (tipOf(nearestVillus(x)) - VW)));
    const stem = inCrypt && y > CRYPT_Y - 4;
    const paneth = stem && Math.floor(i0 / step) % 2 === 0;
    out.push({ i0, i1, age: Math.min(1, age), side: x < c ? -1 : 1, tip: y < tipOf(nearestVillus(x)) + 2, stem: stem && !paneth, paneth });
  }
  return out;
})();

function cellPath(c: Cell, inset = 0): Path2D {
  const a = SURF[c.i0], b = SURF[c.i1];
  const na = normal(c.i0), nb = normal(c.i1);
  const p = new Path2D();
  p.moveTo(a[0] + na[0] * inset, a[1] + na[1] * inset);
  p.lineTo(b[0] + nb[0] * inset, b[1] + nb[1] * inset);
  p.lineTo(b[0] + nb[0] * EPI, b[1] + nb[1] * EPI);
  p.lineTo(a[0] + na[0] * EPI, a[1] + na[1] * EPI);
  p.closePath();
  return p;
}
const nucleusAt = (c: Cell): P2 => {
  const m = Math.floor((c.i0 + c.i1) / 2);
  const [x, y] = SURF[m], [nx, ny] = normal(m);
  return [x + nx * EPI * 0.68, y + ny * EPI * 0.68];
};

function bakeGut(ctx: CanvasRenderingContext2D): void {
  // the lumen: deep indigo with a few drifting motes; the tissue below: rose
  const lum = ctx.createLinearGradient(0, -110, 0, BASE_Y);
  lum.addColorStop(0, 'rgba(22,12,44,.98)');
  lum.addColorStop(1, 'rgba(44,20,64,.98)');
  ctx.fillStyle = lum;
  ctx.fillRect(-420, -420, 840, 840);
  for (let i = 0; i < 90; i++) dot(ctx, (hash(i * 3 + 601) * 2 - 1) * 160, -120 + hash(i * 5 + 603) * 140, 0.5 + 0.8 * hash(i + 607), '#ffe6c8', null, 0.15);
  // the tissue under the surface (the cores of the villi and round the crypts)
  const tissue = new Path2D();
  smoothPath(tissue, SURF);
  tissue.lineTo(150, 420);
  tissue.lineTo(-150, 420);
  tissue.closePath();
  const tg = ctx.createLinearGradient(0, TIP_Y, 0, 120);
  tg.addColorStop(0, 'rgba(150,52,96,.98)');
  tg.addColorStop(0.6, 'rgba(118,40,88,.98)');
  tg.addColorStop(1, 'rgba(80,28,72,.98)');
  ctx.fillStyle = tg;
  ctx.fill(tissue);
  ctx.save();
  ctx.clip(tissue);
  for (let i = 0; i < 260; i++) {
    const x = (hash(i * 7 + 621) * 2 - 1) * 150, y = TIP_Y + hash(i * 11 + 623) * 190;
    ctx.strokeStyle = 'rgba(255,190,220,.09)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 3, y + 2, x + 6 * hash(i + 625), y + 4);
    ctx.stroke();
  }
  // each villus' core: a capillary loop and the lacteal
  for (const vx of VILLI) {
    const TIP_Y = tipOf(vx);
    ctx.strokeStyle = 'rgba(255,230,200,.5)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(vx, BASE_Y + 10);
    ctx.lineTo(vx, TIP_Y + 4);
    ctx.stroke();
    glow(ctx, '#fff0d8', vx, TIP_Y + 4, 4, 0.3);
    const loop = new Path2D();
    loop.moveTo(vx - 6.5, BASE_Y + 12);
    loop.bezierCurveTo(vx - 7, -10, vx - 7, TIP_Y - 4, vx, TIP_Y - 5);
    loop.bezierCurveTo(vx + 7, TIP_Y - 4, vx + 7, -10, vx + 6.5, BASE_Y + 12);
    ctx.strokeStyle = 'rgba(255,84,112,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke(loop);
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = 'rgba(255,110,130,.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const y = TIP_Y + 8 + k * 14;
      ctx.moveTo(vx - 6.5, y);
      ctx.quadraticCurveTo(vx, y + 3, vx + 6.5, y + 1);
      ctx.stroke();
    }
  }
  // the muscle layer under the mucosa
  ctx.fillStyle = 'rgba(150,40,70,.5)';
  ctx.fillRect(-160, CRYPT_Y + 16, 320, 12);
  ctx.fillStyle = 'rgba(110,30,64,.6)';
  ctx.fillRect(-160, CRYPT_Y + 28, 320, 400);
  for (let x = -160; x < 160; x += 5) {
    ctx.strokeStyle = 'rgba(255,170,190,.18)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x, CRYPT_Y + 17);
    ctx.lineTo(x + 4, CRYPT_Y + 27);
    ctx.stroke();
  }
  ctx.restore();
  // the epithelium: one layer of tall cells, the nucleus low, the brush border bright
  for (const c of CELLS) {
    const p = cellPath(c);
    ctx.fillStyle = c.paneth ? 'rgba(170,110,90,.95)' : c.stem ? 'rgba(80,140,170,.95)' : 'rgba(214,150,186,.95)';
    ctx.fill(p);
    ctx.strokeStyle = 'rgba(255,230,240,.35)';
    ctx.lineWidth = 0.3;
    ctx.stroke(p);
    const [nx, ny] = nucleusAt(c);
    dot(ctx, nx, ny, 1.25, c.stem ? '#3a90b0' : '#6a3c8e', null, 0.95);
    if (c.paneth) for (let k = 0; k < 4; k++) dot(ctx, nx + Math.cos(k * 1.7) * 1.4, ny - 2 + Math.sin(k * 2.3) * 0.9, 0.5, GOLD, null, 0.9);
  }
  // the brush border and the surface's light
  ctx.strokeStyle = 'rgba(255,244,236,.85)';
  ctx.lineWidth = 0.7;
  const surf = new Path2D();
  smoothPath(surf, SURF);
  ctx.stroke(surf);
  ctx.strokeStyle = 'rgba(255,220,236,.18)';
  ctx.lineWidth = 3;
  ctx.stroke(surf);
}

/** The newest cells: lit from the crypt up to the growth's front (gold at the front); a shimmer climbs the conveyor. */
function drawRenewal(ctx: CanvasRenderingContext2D, st: WorldState): Pt {
  const g = st.g;
  const front = g * 1.02;
  let tipFront: Pt = [CRYPTS[2], CRYPT_Y];
  for (const c of CELLS) {
    if (c.age > front) continue;
    const fresh = Math.max(0, 1 - (front - c.age) / 0.14);
    const wave = 0.5 + 0.5 * Math.sin((c.age * 9 - st.time * 0.9) * 1.2);
    ctx.fillStyle = rgba(fresh > 0.3 ? GOLD_HI : PEARL, 0.2 + 0.4 * fresh + 0.1 * wave);
    ctx.fill(cellPath(c, 0.6));
    const [nx, ny] = nucleusAt(c);
    if (fresh > 0.2) {
      glow(ctx, GOLD, nx, ny, 4.5, 0.55 * fresh);
      if (fresh > 0.85) tipFront = [nx, ny];
    } else dot(ctx, nx, ny, 0.9, AQUA, null, 0.35 + 0.2 * wave);
  }
  // the stem cells divide: a soft flash now and then at each crypt's base
  for (const [k, cx] of CRYPTS.entries()) {
    const f = (st.time * 0.5 + k * 0.37) % 1;
    const a = Math.max(0, Math.sin(f * Math.PI)) ** 3 * (0.35 + 0.65 * Math.min(1, g * 3));
    glow(ctx, AQUA, cx + (k % 2 ? 3 : -3), CRYPT_Y + CW - 2, 6, 0.6 * a);
    if (a > 0.5) sparkle(ctx, cx, CRYPT_Y + CW - 3, 3, a);
  }
  // at the tips: the oldest cells let go and drift into the lumen
  const shed = Math.max(0, (g - 0.78) / 0.22);
  if (shed > 0 || st.after > 0) {
    for (const [k, vx] of VILLI.entries()) {
      for (let j = 0; j < 3; j++) {
        const f = (st.time * 0.12 + j / 3 + k * 0.21) % 1;
        const x = vx + Math.sin(f * 4 + j + k) * 5, y = tipOf(vx) - VW - 2 - f * 26;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f * 2 + j);
        ctx.fillStyle = rgba('#f0c8dc', 0.6 * Math.sin(f * Math.PI) * Math.max(shed, 0.4));
        ctx.fillRect(-1.6, -3, 3.2, 6);
        ctx.restore();
      }
    }
  }
  glowEllipse(ctx, GOLD, 0, -10, 150, 80, 0, 0.05 * g + 0.05 * st.deep * (0.6 + 0.4 * st.breath));
  return tipFront;
}

/** The front of the renewal wave on the middle villus (the gauge's light). */
function focusAt(_s: string, g: number): Pt {
  const vx = VILLI[2];
  if (g < 0.32) return [CRYPTS[2] + CW * 0.5, CRYPT_Y - (g / 0.32) * (CRYPT_Y - BASE_Y)];
  const k = (g - 0.34) / 0.66;
  return [vx - VW, BASE_Y - Math.max(0, k) * (BASE_Y - tipOf(vx))];
}

export const GUT_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: ctx => bakeGut(ctx),
  draw: (ctx, st) => {
    drawRenewal(ctx, st);
  },
  focusAt,
  counter: (_s, g) => (g > 0.3 ? t('count.jelito') : null),
};

export const GUT = { BASE_Y, TIP_Y, CRYPT_Y, VW, CW };
