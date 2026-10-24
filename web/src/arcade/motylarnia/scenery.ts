/**
 * Motylarnia's scenery, painted once per size into offscreen canvases: the Victorian glasshouse (the
 * lobby, the card art, the finale at sunset), the soft-focus afternoon behind the chrysalis, and the
 * host plant's stem the chrysalis hangs from or is girdled to (the stem is painted once with its
 * shadow; its leaves are sprites that sway every frame).
 */
import { PLANTS, type PlantId } from './content';
import type { SideArea } from './layout';
import { canvas, ctx2d, darken, hash, lighten, mix, rgba, roundRect, speckle } from './paint';

const TAU = Math.PI * 2;

export function paintPaperGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  speckle(ctx, Math.min(1600, Math.round((w * h) / 380)), ['rgba(110,84,50,.05)', 'rgba(110,84,50,.08)', 'rgba(255,255,248,.09)', 'rgba(255,255,248,.15)'], i =>
    [hash(i * 3 + 1) * w, hash(i * 7 + 2) * h, 1, hash(i * 13 + 5)]);
}

/**
 * The Victorian glasshouse: sky through the panes, the white iron frame with its arch, a tiled
 * floor with terracotta pots of host plants, hanging greenery and light shafts.  `sunset` 0..1
 * warms it to the golden hour.
 */
export function paintGlasshouse(ctx: CanvasRenderingContext2D, w: number, h: number, sunset: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#CFE4E6', '#F2B983', sunset));
  sky.addColorStop(0.6, mix('#EEF1E2', '#F6D7A4', sunset));
  sky.addColorStop(1, mix('#E8E2CC', '#E9B98A', sunset));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.2, 0, w * 0.78, h * 0.2, Math.max(w, h) * 0.7);
  sun.addColorStop(0, sunset ? 'rgba(255,226,170,.9)' : 'rgba(255,252,236,.9)');
  sun.addColorStop(0.35, 'rgba(255,244,214,.3)');
  sun.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // distant garden through the glass
  for (let i = 0; i < 22; i++) {
    const x = hash(i * 7 + 3) * w, y = h * (0.55 + 0.2 * hash(i * 5)), r = Math.min(w, h) * (0.06 + 0.1 * hash(i * 9));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${110 + 40 * sunset},${150 - 20 * sunset},${90 - 20 * sunset},.35)`);
    g.addColorStop(1, 'rgba(110,150,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the frame
  const frame = sunset ? '#FFF2DC' : '#FCFAF2', shadow = 'rgba(120,100,70,.35)';
  const lw = Math.max(2, Math.min(w, h) * 0.008);
  const archY = h * 0.34, cx = w / 2, R = w * 0.62;
  const line = (f: (c: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.strokeStyle = shadow;
    ctx.lineWidth = lw * 1.6;
    ctx.translate(1.5, 2);
    f(ctx);
    ctx.restore();
    ctx.strokeStyle = frame;
    ctx.lineWidth = lw;
    f(ctx);
  };
  ctx.lineCap = 'round';
  line(c => {
    c.beginPath();
    c.ellipse(cx, archY, R, archY * 1.05, 0, Math.PI, TAU);
    c.stroke();
  });
  line(c => {
    c.beginPath();
    c.ellipse(cx, archY, R * 0.62, archY * 0.72, 0, Math.PI, TAU);
    c.stroke();
  });
  for (let i = -3; i <= 3; i++) {
    line(c => {
      const a = Math.PI * 1.5 + i * 0.24;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 0.62, archY + Math.sin(a) * archY * 0.72);
      c.lineTo(cx + Math.cos(a) * R, archY + Math.sin(a) * archY * 1.05);
      c.stroke();
    });
  }
  for (let i = 0; i <= 6; i++) {
    const x = (w * i) / 6;
    line(c => {
      c.beginPath();
      c.moveTo(x, archY);
      c.lineTo(x, h * 0.78);
      c.stroke();
    });
  }
  line(c => {
    c.beginPath();
    c.moveTo(0, archY);
    c.lineTo(w, archY);
    c.moveTo(0, h * 0.56);
    c.lineTo(w, h * 0.56);
    c.stroke();
  });
  // a rose window in the arch
  line(c => {
    c.beginPath();
    c.arc(cx, archY * 0.62, Math.min(w, h) * 0.06, 0, TAU);
    c.stroke();
  });
  // light shafts
  for (let i = 0; i < 4; i++) {
    const x = w * (0.18 + i * 0.22);
    const g = ctx.createLinearGradient(x, 0, x + w * 0.2, h);
    g.addColorStop(0, `rgba(255,252,236,${0.14 + 0.05 * i})`);
    g.addColorStop(1, 'rgba(255,252,236,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.06, 0);
    ctx.lineTo(x + w * 0.3, h);
    ctx.lineTo(x + w * 0.18, h);
    ctx.closePath();
    ctx.fill();
  }
  // the floor and the pots
  const floorY = h * 0.78;
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, mix('#D7A07A', '#C77C52', sunset));
  floor.addColorStop(1, mix('#B57B58', '#9A5A3A', sunset));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(90,50,30,.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 11, floorY);
    ctx.lineTo((w * i) / 11 + (i - 5.5) * w * 0.04, h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, floorY + (h - floorY) * 0.45);
  ctx.lineTo(w, floorY + (h - floorY) * 0.45);
  ctx.stroke();
  const plants = ['pokrzywa', 'kapusta', 'koniczyna', 'kruszyna', 'trawa'] as const;
  const potW = Math.min(w * 0.11, h * 0.14);
  plants.forEach((p, i) => {
    const x = w * (0.1 + i * 0.2), y = floorY + potW * 0.15;
    const look = PLANTS[p];
    // leaves
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.36, L = potW * (0.8 + 0.5 * hash(i * 7 + k));
      ctx.save();
      ctx.translate(x, y - potW * 0.3);
      ctx.rotate(a + Math.PI / 2);
      const g = ctx.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, look.dark);
      g.addColorStop(1, look.light);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(L * 0.4, -L * 0.3, L * 0.3, -L * 0.85, 0, -L);
      ctx.bezierCurveTo(-L * 0.3, -L * 0.85, -L * 0.4, -L * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    // the pot
    const pg = ctx.createLinearGradient(x - potW / 2, 0, x + potW / 2, 0);
    pg.addColorStop(0, '#9E5534');
    pg.addColorStop(0.45, '#D4855A');
    pg.addColorStop(1, '#8E4A2C');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(x - potW * 0.5, y - potW * 0.36);
    ctx.lineTo(x + potW * 0.5, y - potW * 0.36);
    ctx.lineTo(x + potW * 0.38, y + potW * 0.42);
    ctx.lineTo(x - potW * 0.38, y + potW * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#C9764C';
    roundRect(ctx, x - potW * 0.56, y - potW * 0.46, potW * 1.12, potW * 0.16, 3);
    ctx.fill();
  });
  // hanging vines
  ctx.strokeStyle = 'rgba(80,110,50,.7)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const x = w * (0.08 + 0.21 * i), len = h * (0.12 + 0.12 * hash(i * 5));
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 10, len * 0.5, x - 4, len);
    ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const y = (len * k) / 6, lx = x + Math.sin(k) * 4;
      ctx.fillStyle = k % 2 ? '#6E9E48' : '#8DBF5A';
      ctx.beginPath();
      ctx.ellipse(lx + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
      ctx.fill();
    }
  }
  paintPaperGrain(ctx, w, h);
}



/** The soft-focus afternoon behind the chrysalis: warm light, glasshouse bokeh, blurred foliage. */
export function paintSideBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, golden: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#F4E9CC', '#F6D9A2', golden));
  sky.addColorStop(0.55, mix('#EDD7A8', '#EFC27E', golden));
  sky.addColorStop(1, mix('#CDA977', '#C88A52', golden));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.85, h * 0.08, 0, w * 0.85, h * 0.08, Math.max(w, h) * 0.75);
  sun.addColorStop(0, 'rgba(255,248,222,.95)');
  sun.addColorStop(0.3, 'rgba(255,238,196,.35)');
  sun.addColorStop(1, 'rgba(255,238,196,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // light falling through the glass roof
  for (let i = 0; i < 3; i++) {
    const x = w * (0.55 + 0.18 * i);
    const g = ctx.createLinearGradient(x, 0, x - w * 0.5, h);
    g.addColorStop(0, `rgba(255,252,232,${0.2 - 0.04 * i})`);
    g.addColorStop(1, 'rgba(255,252,232,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.08, 0);
    ctx.lineTo(x - w * 0.36, h);
    ctx.lineTo(x - w * 0.5, h);
    ctx.closePath();
    ctx.fill();
  }
  // out-of-focus glasshouse: soft discs of light and leaves
  const m = Math.min(w, h);
  for (let i = 0; i < 34; i++) {
    const x = hash(i * 5 + 1) * w, y = h * (0.15 + 0.85 * hash(i * 7 + 3)), r = m * (0.03 + 0.09 * hash(i * 11));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const kind = hash(i * 13);
    const c = kind < 0.55 ? [118, 150, 76] : kind < 0.8 ? [255, 244, 210] : [214, 160, 104];
    const a = kind < 0.55 ? 0.22 : 0.38;
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`);
    g.addColorStop(0.7, `rgba(${c[0]},${c[1]},${c[2]},${a * 0.6})`);
    g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // blurred foliage in front, low in the frame (a shape drawn far away casts its soft shadow here;
  // shadow offsets are in device pixels, hence the transform's scale)
  const px = ctx.getTransform().a || 1;
  ctx.save();
  ctx.shadowColor = 'rgba(70,96,46,.55)';
  ctx.shadowBlur = m * 0.06 * px;
  ctx.shadowOffsetX = 4000 * px;
  ctx.fillStyle = '#000';
  for (let i = 0; i < 9; i++) {
    const x = (i / 8) * w + (hash(i * 3) - 0.5) * w * 0.1, L = m * (0.18 + 0.16 * hash(i * 7)), a = -Math.PI / 2 + (hash(i * 9) - 0.5) * 1.2;
    ctx.save();
    ctx.translate(x - 4000, h + L * 0.15);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.4, -L * 0.3, L * 0.3, -L * 0.85, 0, -L);
    ctx.bezierCurveTo(-L * 0.3, -L * 0.85, -L * 0.4, -L * 0.3, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  paintPaperGrain(ctx, w, h);
}

function bez(p: [number, number][], t: number): [number, number] {
  const u = 1 - t;
  return [
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0],
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1],
  ];
}

/** Soft, out-of-focus leaves reaching in from the corners of the paper: the glasshouse around the table. */
export function paintCornerLeaves(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const m = Math.min(w, h), px = ctx.getTransform().a || 1;
  ctx.save();
  ctx.shadowColor = 'rgba(96,132,62,.34)';
  ctx.shadowBlur = m * 0.035 * px;
  ctx.shadowOffsetX = 4000 * px;
  ctx.fillStyle = '#000';
  const leaves: [number, number, number, number][] = [
    [-0.02, 1.02, -0.6, 0.42], [0.1, 1.04, -0.2, 0.34], [1.02, 0.98, -2.4, 0.4], [0.92, 1.05, -2.9, 0.3],
    [1.03, 0.08, 2.4, 0.3], [-0.03, 0.12, 0.7, 0.26],
  ];
  for (const [fx, fy, a, s] of leaves) {
    const L = m * s;
    ctx.save();
    ctx.translate(fx * w - 4000, fy * h);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.3, -L * 0.22, L * 0.8, -L * 0.18, L, 0);
    ctx.bezierCurveTo(L * 0.8, L * 0.18, L * 0.3, L * 0.22, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** A leaf on the stem: where it sits, its angle at rest, which side it turns to, its length. */
export interface StemLeaf { x: number; y: number; a: number; side: number; len: number }

/** The bud at a stem's tip, in stem widths. */
export const BUD = 1.9;

export interface SideGeom {
  kind: 'hanging' | 'girdled';
  /** where the pupa is attached, its length, its lean (radians) */
  ax: number;
  ay: number;
  len: number;
  tilt: number;
  /** the centre of the pupa (the emergence happens there) */
  cx: number;
  cy: number;
  /** the stem: a cubic Bézier from beyond the screen's edge to its growing tip, its width there, and its leaves */
  stem: [number, number][];
  thick: number;
  leaves: StemLeaf[];
}

/** A point on the stem (t 0..1, from its cut end beyond the screen to its tip). */
export const stemPoint = (g: SideGeom, t: number): [number, number] => bez(g.stem, t);

/** The t at which the curve (left to right) crosses x. */
function crossAt(p: [number, number][], x: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (bez(p, m)[0] < x) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
}

function leavesAlong(stem: [number, number][], len: number, at: readonly [number, number, number][]): StemLeaf[] {
  return at.map(([t, side, s]) => {
    const [x, y] = bez(stem, t), [x2, y2] = bez(stem, Math.min(1, t + 0.02)), [x1, y1] = bez(stem, Math.max(0, t - 0.02));
    return { x, y, a: Math.atan2(y2 - y1, x2 - x1) + side * 0.9, side, len: len * 0.62 * s };
  });
}

/**
 * Where the stem and the pupa go in the free part of the screen.  A hanging pupa's twig reaches in from
 * beyond the screen's left edge — under the side panel on a wide screen — sags a little to the pupa and
 * ends in a leafy tip; a girdled pupa's stem rises from below the screen to a growing tip under the
 * runner's top bar.  No cut end is ever in view.
 */
export function sideGeometry(kind: 'hanging' | 'girdled', a: SideArea): SideGeom {
  const { x0, y0, x1, y1 } = a;
  const fw = x1 - x0, fh = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const len = Math.max(70, Math.min(260, fh * 0.36, fw * 0.46)), thick = Math.max(4, len * 0.06);
  if (kind === 'hanging') {
    const ax = cx + len * 0.04, want = cy - len * 0.52;
    // low across the panel's foot, rising to the pupa: it hangs where the twig passes over ax
    const enter = Math.max(want + len * 0.45, a.under + 30);
    const stem: [number, number][] = [[-40, enter + len * 0.08], [x0 + (ax - x0) * 0.3, enter], [ax - len * 0.6, want + len * 0.05], [ax + len * 0.7, want - len * 0.08]];
    const ay = bez(stem, crossAt(stem, ax))[1] + thick * 0.2;
    const leaves = leavesAlong(stem, len, [[crossAt(stem, ax - len * 0.85), -1, 1], [crossAt(stem, ax + len * 0.32), 1, 0.8], [0.97, -1, 0.7]]);
    return { kind, ax, ay, len, tilt: 0, cx: ax, cy: ay + len * 0.52, stem, thick, leaves };
  }
  // a stem rising from the bottom; the pupa rests against it, held by a silk girdle, head up; its tip
  // (and the bud on it) stays under the top bar
  const sx = cx - len * 0.12;
  const stem: [number, number][] = [[sx - len * 0.55, y1 + 40], [sx - len * 0.1, cy + len * 0.6], [sx - len * 0.06, cy - len * 0.7], [sx + len * 0.32, y0 + 8 + thick * BUD]];
  const t = 0.5, [px, py] = bez(stem, t), [qx, qy] = bez(stem, t + 0.01);
  const tx = qx - px, ty = qy - py, tl = Math.hypot(tx, ty) || 1;
  // the stem's direction (pointing up), its right-hand normal, and the lean from vertical
  const ux = tx / tl, uy = ty / tl, nx = -uy, ny = ux;
  const tilt = Math.atan2(ux, -uy);
  const ax = px + nx * len * 0.16 - ux * len * 0.5, ay = py + ny * len * 0.16 - uy * len * 0.5;
  return {
    kind, ax, ay, len, tilt, cx: ax + ux * len * 0.5, cy: ay + uy * len * 0.5, stem, thick,
    leaves: leavesAlong(stem, len, [[0.16, 1, 0.9], [0.78, -1, 0.85], [0.9, 1, 0.62]]),
  };
}

/**
 * The stem itself, tapering to its tip and closed by a bud, with its soft shadow: painted once into
 * the side view's backdrop (the leaves sway, the stem does not).
 */
export function paintStem(ctx: CanvasRenderingContext2D, g: SideGeom, plant: PlantId): void {
  const look = PLANTS[plant], woody = plant === 'kruszyna', px = ctx.getTransform().a || 1;
  const n = 48, left: number[] = [], right: number[] = [], hiL: number[] = [], hiR: number[] = [];
  let tipX = 0, tipY = 0, tipA = 0, tipW = 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n, [x, y] = bez(g.stem, t), [xa, ya] = bez(g.stem, Math.max(0, t - 0.01)), [xb, yb] = bez(g.stem, Math.min(1, t + 0.01));
    const a = Math.atan2(yb - ya, xb - xa), nx = -Math.sin(a), ny = Math.cos(a), hw = (g.thick / 2) * (1 - 0.5 * t);
    left.push(x + nx * hw, y + ny * hw);
    right.push(x - nx * hw, y - ny * hw);
    // the light catches its upper side
    const ox = x - nx * hw * 0.32, oy = y - ny * hw * 0.32, hh = hw * 0.26;
    hiL.push(ox + nx * hh, oy + ny * hh);
    hiR.push(ox - nx * hh, oy - ny * hh);
    if (i === n) { tipX = x; tipY = y; tipA = a; tipW = hw; }
  }
  const ribbon = (l: number[], r: number[], cap: number): Path2D => {
    const p = new Path2D();
    p.moveTo(l[0], l[1]);
    for (let i = 2; i < l.length; i += 2) p.lineTo(l[i], l[i + 1]);
    for (let i = r.length - 2; i >= 0; i -= 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
    if (cap > 0) {
      p.moveTo(tipX + cap, tipY);
      p.arc(tipX, tipY, cap, 0, Math.PI * 2);
    }
    return p;
  };
  ctx.save();
  ctx.shadowColor = 'rgba(60,40,20,.28)';
  ctx.shadowBlur = 6 * px;
  ctx.shadowOffsetY = 2.5 * px;
  ctx.fillStyle = woody ? '#6E5236' : darken(look.dark, 0.1);
  ctx.fill(ribbon(left, right, tipW));
  ctx.restore();
  ctx.fillStyle = woody ? 'rgba(214,180,130,.55)' : rgba(look.light, 0.55);
  ctx.fill(ribbon(hiL, hiR, 0));
  // the growing tip: a closed bud
  const b = g.thick * BUD;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(tipA);
  const bud = ctx.createLinearGradient(0, 0, b, 0);
  bud.addColorStop(0, look.dark);
  bud.addColorStop(1, look.light);
  ctx.fillStyle = bud;
  ctx.beginPath();
  ctx.moveTo(-tipW * 0.6, 0);
  ctx.bezierCurveTo(b * 0.2, -b * 0.42, b * 0.75, -b * 0.18, b, 0);
  ctx.bezierCurveTo(b * 0.75, b * 0.18, b * 0.2, b * 0.42, -tipW * 0.6, 0);
  ctx.fill();
  ctx.restore();
}

const leafSprites = new Map<string, { c: HTMLCanvasElement; ox: number; oy: number }>();

/** A stem leaf `L` px long pointing along +x and curling to −y, at `px` device px per unit (cached). */
function stemLeafSprite(plant: PlantId, L: number, px: number): { c: HTMLCanvasElement; ox: number; oy: number } {
  const key = `${plant}|${Math.round(L * px)}`;
  let s = leafSprites.get(key);
  if (!s) {
    const look = PLANTS[plant], D = L * px, ox = 2, oy = Math.ceil(D * 0.26) + 2;
    const c = canvas(D + 4, oy + D * 0.14 + 4), ctx = ctx2d(c);
    ctx.translate(ox, oy);
    ctx.scale(px, px);
    const grad = ctx.createLinearGradient(0, 0, L, 0);
    grad.addColorStop(0, look.dark);
    grad.addColorStop(0.6, look.mid);
    grad.addColorStop(1, lighten(look.light, 0.1));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(L * 0.3, -L * 0.3, L * 0.8, -L * 0.22, L, 0);
    ctx.bezierCurveTo(L * 0.75, L * 0.12, L * 0.3, L * 0.14, 0, 0);
    ctx.fill();
    ctx.strokeStyle = rgba(look.vein, 0.75);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.5, -L * 0.06, L * 0.95, 0);
    ctx.stroke();
    s = { c, ox, oy };
    leafSprites.set(key, s);
    if (leafSprites.size > 24) leafSprites.delete(leafSprites.keys().next().value!);
  }
  return s;
}

/** The stem's leaves, swaying by `sway` (radians), from cached sprites; `px` = device px per CSS px. */
export function drawStemLeaves(ctx: CanvasRenderingContext2D, g: SideGeom, plant: PlantId, sway: number, px: number): void {
  for (const lf of g.leaves) {
    const s = stemLeafSprite(plant, lf.len, px);
    ctx.save();
    ctx.translate(lf.x, lf.y);
    ctx.rotate(lf.a + sway * 2);
    if (lf.side < 0) ctx.scale(1, -1);
    ctx.drawImage(s.c, -s.ox / px, -s.oy / px, s.c.width / px, s.c.height / px);
    ctx.restore();
  }
}
