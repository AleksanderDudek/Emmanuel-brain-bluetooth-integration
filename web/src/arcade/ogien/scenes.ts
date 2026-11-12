/**
 * The seven worlds of Ogień, ogień, ogień, each at its own scale and in its own palette (DESIGN §13.6):
 *
 *   iskra     a spark on tinder in cupped hands, macro: the night far out of focus behind, the fingers lit
 *             from inside by the ember; at dawn in the second picture
 *   świeca    a candle on a windowsill, the winter night outside (snow, a village, the moon), a curtain the
 *             draughts lift; an oil lamp in a stone window over a desert night in the second
 *   ognisko   a bonfire on a hilltop under the stars, people sitting round it rim-lit, sparks into the sky;
 *             a charcoal fire by a lake at dawn (a boat, fishermen) in the second
 *   słup      the pillar of fire from the sand to the clouds over Israel's camp in the desert (Exodus 13:21),
 *             tents to the horizon, the near ones lit from it; under a mountain in the second
 *   gwiazda   a star in space: a limb-darkened disc, granulation, the corona's streamers, prominences;
 *             hydrogen pairs that fuse; a blue giant in the second
 *   mega      a hypergiant inside its nebula of glowing gas and dark dust, shells it threw off; a blue one in
 *             a two-lobed nebula in the second
 *   zesłanie  Pentecost at dawn: the city, a house with its upper room open to the street, the wind, tongues
 *             of fire coming DOWN on the gathered (no dove, no figure in the light, §13.4), the light spilling
 *             into the city as the ring fills; the crowd in the streets in the second
 *
 * Each scene paints a backdrop once (cached by the view on a resize or a change) and three live layers each
 * frame: `under` (light on the world, weather), `fire` (the fire itself) and `over` (props in front, the hands'
 * targets).  Positions are units of the ring's radius around the fire (`g.R` px a unit).  Per frame: no
 * shadowBlur, no filters; glows are baked sprites, the stars' discs and coronas are baked once per size.
 */
import { RULES } from './rules';
import type { OgienSim } from './sim';
import { CANDLE, FIRE, SPIRIT, TAU, clamp01, drawBlaze, drawFlame, drawGlow, drawGlowEllipse, hash, mixRgb, rgba, seeded, type FlamePalette } from './paint';

export interface Geo { w: number; h: number; cx: number; cy: number; R: number; top: number; bottom: number; u: number; dpr?: number }

/** What the live layers need this frame. */
export interface Live {
  t: number;
  /** the shown heat (0.5 the threshold, neutral) and the ring as shown */
  heat: number;
  charge: number;
  /** the fire's light 0..1, its size factor, its flicker */
  glow: number;
  grow: number;
  energy: number;
  /** rest: the breath 0..1 and calm 0..1 */
  rest: boolean;
  breath: number;
  calm: number;
  /** the candle: the draught's bend (−1..1, eased), its warning 0..1, the hands around the flame 0..1 */
  bend: number;
  warn: number;
  shield: number;
  /** a flash after a task or a change 0..1 */
  flare: number;
  variant: number;
  reduced: boolean;
  sim: OgienSim;
}

export interface Scene {
  back(ctx: CanvasRenderingContext2D, g: Geo, variant: number): void;
  under(ctx: CanvasRenderingContext2D, g: Geo, L: Live): void;
  fire(ctx: CanvasRenderingContext2D, g: Geo, L: Live): void;
  over(ctx: CanvasRenderingContext2D, g: Geo, L: Live): void;
  /** the colour of this scene's light (the view's sparks, the ring's tint) */
  light: readonly number[];
  /** a scene of the earth (sparks rise, crackles) or of the sky (motes drift, hums) */
  earth: boolean;
}

const px = (g: Geo, x: number): number => g.cx + x * g.R;
const py = (g: Geo, y: number): number => g.cy + y * g.R;

function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, stops: readonly (readonly [number, string])[]): CanvasGradient {
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  return gr;
}

/** A field of stars over a rectangle (cached layers only). */
function stars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, seed: number, bright = 1, tint: readonly number[] = [255, 255, 255]): void {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const sx = x + r() * w, sy = y + r() * h * (0.3 + 0.7 * r());
    const m = r();
    const a = (0.25 + 0.75 * m * m) * bright;
    const s = 0.5 + m * m * 1.2;
    ctx.fillStyle = rgba(mixRgb(tint, [255, 236, 210], r() * 0.5), a);
    ctx.beginPath();
    ctx.arc(sx, sy, s, 0, TAU);
    ctx.fill();
    if (m > 0.95) {
      drawGlow(ctx, sx, sy, s * 6, tint, a * 0.3);
      ctx.strokeStyle = rgba(tint, a * 0.45);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - s * 5, sy);
      ctx.lineTo(sx + s * 5, sy);
      ctx.moveTo(sx, sy - s * 5);
      ctx.lineTo(sx, sy + s * 5);
      ctx.stroke();
    }
  }
}

/** A rolling silhouette from x0 to x1 around y, filled down to `floor`. */
function hills(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, amp: number, floor: number, color: string | CanvasGradient, seed: number, waves = 3): void {
  const r = seeded(seed);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, floor);
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k;
    const v = Math.sin(k * TAU * 0.5 * waves * 0.6 + ph[0]) * 0.55 + Math.sin(k * TAU * waves * 0.9 + ph[1]) * 0.3 + Math.sin(k * TAU * waves * 2.3 + ph[2]) * 0.15;
    ctx.lineTo(x, y - v * amp);
  }
  ctx.lineTo(x1, floor);
  ctx.closePath();
  ctx.fill();
}

function vignette(ctx: CanvasRenderingContext2D, g: Geo, a = 0.55): void {
  const r = Math.hypot(g.w, g.h) * 0.62;
  const gr = ctx.createRadialGradient(g.cx, g.cy, r * 0.35, g.cx, g.cy, r);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, g.w, g.h);
}

// ── sprites baked once per size (the stars' discs, coronas) ─────
const baked = new Map<string, HTMLCanvasElement | null>();

function bake(key: string, w: number, h: number, dpr: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  if (baked.has(key)) return baked.get(key)!;
  if (baked.size > 24) baked.clear();
  let c: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    if (g) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(g);
    } else c = null;
  }
  baked.set(key, c);
  return c;
}

/** Draw a baked square sprite centred at (x, y), `r` its half-size, turned by `rot`. */
function sprite(ctx: CanvasRenderingContext2D, s: HTMLCanvasElement | null, x: number, y: number, r: number, rot = 0, alpha = 1): void {
  if (!s || r < 0.5) return;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * alpha;
  if (rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(s, -r, -r, r * 2, r * 2);
    ctx.restore();
  } else ctx.drawImage(s, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = a0;
}

// ═════════════════════════════════════════════════════════════════
// 1. Iskra — a spark on tinder in cupped hands
// ═════════════════════════════════════════════════════════════════
const ISKRA_BG: readonly (readonly [string, string, string])[] = [['#2a1510', '#110a0e', '#050307'], ['#3a2836', '#1a1830', '#0a0b1a']];
/** the fingertips: little, ring, middle, index (units, the left hand; the right mirrors it) */
const TIPS: readonly (readonly [number, number, number])[] = [[0.84, 0.26, 0.07], [0.73, 0.12, 0.075], [0.6, 0.05, 0.078], [0.47, 0.06, 0.072]];

function handPath(ctx: CanvasRenderingContext2D, g: Geo, side: -1 | 1): void {
  const X = (x: number) => px(g, x * side), Y = (y: number) => py(g, y);
  ctx.beginPath();
  ctx.moveTo(X(0.62), Y(1.62));
  ctx.bezierCurveTo(X(0.88), Y(1.32), X(1.04), Y(1.02), X(1.0), Y(0.74));
  ctx.bezierCurveTo(X(0.98), Y(0.52), X(0.93), Y(0.36), X(0.88), Y(0.28));
  for (const [tx, ty, r] of TIPS) {
    ctx.quadraticCurveTo(X(tx + r * 0.6), Y(ty - r * 1.5), X(tx - r * 0.2), Y(ty - r * 0.9));
    ctx.quadraticCurveTo(X(tx - r * 0.95), Y(ty - r * 0.55), X(tx - r), Y(ty + r * 0.15));
  }
  ctx.bezierCurveTo(X(0.36), Y(0.2), X(0.35), Y(0.38), X(0.28), Y(0.5));
  ctx.bezierCurveTo(X(0.2), Y(0.6), X(0.09), Y(0.65), X(0.015), Y(0.67));
  ctx.bezierCurveTo(X(0.04), Y(0.92), X(0.12), Y(1.3), X(0.2), Y(1.62));
  ctx.closePath();
}

const ISKRA: Scene = {
  light: [255, 150, 70],
  earth: true,
  back(ctx, g, v) {
    const [c0, c1, c2] = ISKRA_BG[v % 2];
    const r = Math.hypot(g.w, g.h);
    const bg = ctx.createRadialGradient(g.cx, g.cy + g.R * 0.2, 0, g.cx, g.cy, r * 0.7);
    bg.addColorStop(0, c0);
    bg.addColorStop(0.45, c1);
    bg.addColorStop(1, c2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, g.w, g.h);
    if (v % 2 === 1) drawGlowEllipse(ctx, g.w * 0.78, g.top + (g.cy - g.top) * 0.3, g.w * 0.5, g.R * 1.2, [255, 170, 130], 0.22);
    // the night's lights, far out of focus: soft discs, never loud
    const rnd = seeded(41 + v);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, d = 1.3 + rnd() * 1.8;
      const x = g.cx + Math.cos(a) * d * g.R * 1.1, y = g.cy - Math.abs(Math.sin(a)) * d * g.R * 0.9;
      const rr = g.R * (0.06 + rnd() * 0.16);
      const warm = rnd() < (v ? 0.5 : 0.75);
      const c = warm ? (v ? [255, 196, 160] : [255, 170, 96]) : (v ? [160, 186, 255] : [130, 150, 255]);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rr);
      const a0 = 0.04 + rnd() * 0.05;
      gr.addColorStop(0, rgba(c, a0));
      gr.addColorStop(0.8, rgba(c, a0 * 1.15));
      gr.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.fill();
    }
    // the forearms, in shadow
    for (const side of [-1, 1] as const) {
      ctx.fillStyle = vgrad(ctx, py(g, 1.4), g.h, [[0, v ? '#3a2630' : '#2c1610'], [1, v ? '#120c18' : '#0c0606']]);
      ctx.beginPath();
      ctx.moveTo(px(g, side * 0.2), py(g, 1.55));
      ctx.lineTo(px(g, side * 0.64), py(g, 1.55));
      ctx.lineTo(px(g, side * 1.6), py(g, 3.2));
      ctx.lineTo(px(g, side * 0.55), py(g, 3.2));
      ctx.closePath();
      ctx.fill();
    }
    // the hands, lit from inside by the ember
    const ex = px(g, 0), ey = py(g, 0.14);
    const lit = ctx.createRadialGradient(ex, ey, g.R * 0.05, ex, ey, g.R * 1.35);
    lit.addColorStop(0, v ? '#e0a07a' : '#d88e5c');
    lit.addColorStop(0.3, v ? '#a8705a' : '#9c5634');
    lit.addColorStop(0.62, v ? '#5a3a40' : '#4e2716');
    lit.addColorStop(1, v ? '#22161e' : '#1c0f0a');
    for (const side of [-1, 1] as const) {
      ctx.fillStyle = lit;
      handPath(ctx, g, side);
      ctx.fill();
      // the gaps between the fingers
      ctx.strokeStyle = 'rgba(30,12,8,.55)';
      ctx.lineWidth = Math.max(1, g.R * 0.012);
      ctx.lineCap = 'round';
      for (let i = 0; i < TIPS.length - 1; i++) {
        const [ax, ay, ar] = TIPS[i], [bx, by] = TIPS[i + 1];
        const mx = (ax - ar + bx) / 2, my = (ay + by) / 2 + 0.02;
        ctx.beginPath();
        ctx.moveTo(px(g, side * mx), py(g, my));
        ctx.quadraticCurveTo(px(g, side * (mx + 0.04)), py(g, my + 0.12), px(g, side * (mx + 0.1)), py(g, my + 0.22));
        ctx.stroke();
      }
      // the thumb lying along the front of the hand
      ctx.fillStyle = v ? '#7a5048' : '#7a4028';
      ctx.beginPath();
      ctx.ellipse(px(g, side * 0.42), py(g, 0.58), g.R * 0.2, g.R * 0.075, side * -0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,110,.35)';
      ctx.lineWidth = Math.max(1, g.R * 0.01);
      ctx.beginPath();
      ctx.ellipse(px(g, side * 0.42), py(g, 0.58), g.R * 0.2, g.R * 0.075, side * -0.75, Math.PI * 1.05, Math.PI * 1.75);
      ctx.stroke();
      // the rim of the palm facing the ember
      ctx.strokeStyle = 'rgba(255,170,100,.35)';
      ctx.lineWidth = Math.max(1, g.R * 0.014);
      ctx.beginPath();
      ctx.moveTo(px(g, side * 0.42), py(g, 0.08));
      ctx.bezierCurveTo(px(g, side * 0.36), py(g, 0.2), px(g, side * 0.35), py(g, 0.38), px(g, side * 0.28), py(g, 0.5));
      ctx.stroke();
    }
    // the tinder: a nest of dry fibres in the palms
    const fr = seeded(7 + v);
    ctx.lineCap = 'round';
    for (let i = 0; i < 110; i++) {
      const a = Math.PI * (0.02 + fr() * 0.96);
      const rr = 0.12 + fr() * 0.3;
      const x0 = Math.cos(a + Math.PI) * rr, y0 = 0.24 + Math.sin(a) * rr * 0.3;
      const len = 0.1 + fr() * 0.2;
      const dir = a + Math.PI / 2 + (fr() - 0.5) * 1.1;
      const c = fr();
      ctx.strokeStyle = c < 0.35 ? 'rgba(214,176,118,.9)' : c < 0.7 ? 'rgba(150,112,62,.9)' : 'rgba(84,58,34,.95)';
      ctx.lineWidth = Math.max(0.7, g.R * (0.005 + fr() * 0.007));
      ctx.beginPath();
      ctx.moveTo(px(g, x0), py(g, y0));
      ctx.quadraticCurveTo(px(g, x0 + Math.cos(dir) * len * 0.5), py(g, y0 + Math.sin(dir) * len * 0.2 - 0.04), px(g, x0 + Math.cos(dir) * len), py(g, y0 + Math.sin(dir) * len * 0.3));
      ctx.stroke();
    }
    vignette(ctx, g, 0.55);
  },
  under(ctx, g, L) {
    const x = px(g, 0), y = py(g, 0.14);
    // the ember lights the fingers and the fibres
    drawGlow(ctx, x, y, g.R * (0.8 + 0.9 * L.glow), [255, 110, 40], 0.16 + 0.34 * L.glow);
    drawGlow(ctx, x, y, g.R * (0.38 + 0.42 * L.glow), [255, 170, 80], 0.18 + 0.4 * L.glow);
    if (L.rest) drawGlow(ctx, x, y, g.R * (1.2 + 0.4 * L.breath), [255, 190, 120], 0.06 + 0.16 * L.calm);
  },
  fire(ctx, g, L) {
    const x = px(g, 0), y = py(g, 0.16);
    const pulse = 0.85 + 0.15 * Math.sin(L.t * 2.1) + (L.rest ? 0.12 * L.breath : 0);
    // the coal: a red heart that brightens with the heat
    drawGlow(ctx, x, y, g.R * (0.14 + 0.1 * L.heat) * pulse * L.grow, [255, 120, 40], 0.85, 0.3);
    drawGlow(ctx, x, y, g.R * (0.07 + 0.05 * L.heat) * L.grow, [255, 214, 140], 0.95, 0.5);
    drawGlow(ctx, x, y, g.R * 0.03 * L.grow, [255, 252, 230], 1, 0.7);
    // the small flame it wakes into as the ring fills — a candle's worth at the most
    const k = clamp01(L.charge * 1.1 + (L.heat - 0.5) * 0.3);
    if (k > 0.05) {
      const fh = g.R * (0.06 + 0.3 * k) * (0.85 + 0.3 * L.heat) * L.grow;
      drawFlame(ctx, x, y + g.R * 0.01, fh * 0.46, fh, L.t, L.energy, FIRE, 0, 1, Math.min(1, k * 3));
      if (k > 0.65) drawFlame(ctx, x - fh * 0.22, y + g.R * 0.02, fh * 0.26, fh * 0.5, L.t + 1.3, L.energy, FIRE, -0.25, 3, (k - 0.65) * 3);
      if (k > 0.8) drawFlame(ctx, x + fh * 0.22, y + g.R * 0.02, fh * 0.24, fh * 0.45, L.t + 2.1, L.energy, FIRE, 0.25, 5, (k - 0.8) * 4);
    }
  },
  over(ctx, g, L) {
    // a thread of smoke curling up from the ember
    const x = px(g, 0), y = py(g, 0.05);
    for (let i = 0; i < 6; i++) {
      const k = ((L.t * 0.22 + i / 6) % 1);
      const sx = x + Math.sin(L.t * 0.8 + k * 6 + i) * g.R * 0.12 * k;
      drawGlow(ctx, sx, y - k * g.R * 1.2, g.R * (0.04 + 0.16 * k), [160, 150, 160], 0.1 * (1 - k) * (1 - L.charge * 0.6));
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 2. Świeca — a candle in a window at night
// ═════════════════════════════════════════════════════════════════
const WIN = { x0: -1.02, x1: 1.02, y0: -1.85, y1: 0.42 };

function windowPath(ctx: CanvasRenderingContext2D, g: Geo, v: number): void {
  const x0 = px(g, WIN.x0), x1 = px(g, WIN.x1), y0 = py(g, WIN.y0), y1 = py(g, WIN.y1);
  ctx.beginPath();
  if (v % 2 === 1) {
    const r = (x1 - x0) / 2;
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0 + r);
    ctx.arc((x0 + x1) / 2, y0 + r, r, Math.PI, TAU);
    ctx.lineTo(x1, y1);
    ctx.closePath();
  } else ctx.rect(x0, y0, x1 - x0, y1 - y0);
}

const SWIECA: Scene = {
  light: [255, 180, 90],
  earth: true,
  back(ctx, g, v) {
    ctx.fillStyle = vgrad(ctx, 0, g.h, v ? [[0, '#2c1f1a'], [1, '#150e0c']] : [[0, '#2a1a22'], [1, '#160d12']]);
    ctx.fillRect(0, 0, g.w, g.h);
    if (v) {
      const rnd = seeded(91);
      ctx.strokeStyle = 'rgba(0,0,0,.22)';
      ctx.lineWidth = 1;
      const bh = g.R * 0.32;
      for (let y = 0, row = 0; y < g.h; y += bh, row++) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(g.w, y);
        ctx.stroke();
        for (let x = (row % 2) * g.R * 0.35; x < g.w; x += g.R * (0.6 + rnd() * 0.3)) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + bh);
          ctx.stroke();
        }
      }
    } else {
      // old plaster: a faint mottle
      const rnd = seeded(17);
      for (let i = 0; i < 40; i++) drawGlowEllipse(ctx, rnd() * g.w, rnd() * g.h, g.R * (0.3 + rnd() * 0.6), g.R * (0.2 + rnd() * 0.4), [70, 44, 56], 0.12);
    }
    // the night outside, clipped to the window
    ctx.save();
    windowPath(ctx, g, v);
    ctx.clip();
    const sy0 = py(g, WIN.y0), sy1 = py(g, WIN.y1);
    ctx.fillStyle = vgrad(ctx, sy0, sy1, v ? [[0, '#0a0d24'], [0.7, '#1b2148'], [1, '#3a2d4a']] : [[0, '#070d26'], [0.6, '#122050'], [1, '#26336a']]);
    ctx.fillRect(px(g, WIN.x0), sy0, px(g, WIN.x1) - px(g, WIN.x0), sy1 - sy0);
    stars(ctx, px(g, WIN.x0), sy0, px(g, WIN.x1) - px(g, WIN.x0), (sy1 - sy0) * 0.7, 60, 13 + v, 0.9);
    const mx = px(g, 0.55), my = py(g, -1.42), mr = g.R * 0.13;
    drawGlow(ctx, mx, my, mr * 4, [190, 210, 255], 0.22);
    ctx.fillStyle = '#f2f0e6';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = v ? '#0f1534' : '#0c1636';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.88, 0, TAU);
    ctx.fill();
    if (v) {
      hills(ctx, px(g, WIN.x0), px(g, WIN.x1), py(g, -0.05), g.R * 0.1, sy1, '#2a1c2a', 5, 2);
      hills(ctx, px(g, WIN.x0), px(g, WIN.x1), py(g, 0.12), g.R * 0.08, sy1, '#1c1220', 9, 3);
      for (const [x, s] of [[-0.62, 1], [-0.42, 0.75], [0.7, 0.9]] as const) {
        const bx = px(g, x), by = py(g, 0.1), hh = g.R * 0.62 * s;
        ctx.strokeStyle = '#120a12';
        ctx.lineWidth = Math.max(1.5, g.R * 0.03 * s);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + hh * 0.08, by - hh * 0.5, bx + hh * 0.04, by - hh);
        ctx.stroke();
        ctx.fillStyle = '#120a12';
        for (let k = 0; k < 6; k++) {
          const a = -Math.PI / 2 + (k - 2.5) * 0.55;
          ctx.beginPath();
          ctx.ellipse(bx + hh * 0.04 + Math.cos(a) * hh * 0.22, by - hh + Math.sin(a) * hh * 0.1 + hh * 0.06, hh * 0.24, hh * 0.05, a, 0, TAU);
          ctx.fill();
        }
      }
    } else {
      // a snowy village: roofs under snow, a church spire, a few lit windows
      const ry = py(g, -0.1);
      const rnd = seeded(23);
      let x = px(g, WIN.x0) - g.R * 0.1;
      let n = 0;
      while (x < px(g, WIN.x1)) {
        const w = g.R * (0.32 + rnd() * 0.3), hh = g.R * (0.16 + rnd() * 0.2), top = ry - hh + rnd() * g.R * 0.15;
        ctx.fillStyle = '#101a3a';
        ctx.fillRect(x, top, w, sy1 - top);
        ctx.fillStyle = '#d6dff0';
        ctx.beginPath();
        ctx.moveTo(x - g.R * 0.03, top + 1);
        ctx.lineTo(x + w / 2, top - hh * 0.55);
        ctx.lineTo(x + w + g.R * 0.03, top + 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#0c1430';
        ctx.beginPath();
        ctx.moveTo(x + g.R * 0.025, top + 2);
        ctx.lineTo(x + w / 2, top - hh * 0.38);
        ctx.lineTo(x + w - g.R * 0.025, top + 2);
        ctx.closePath();
        ctx.fill();
        if (rnd() < 0.6) {
          const wx = x + w * (0.3 + rnd() * 0.3), wy = top + hh * 0.35;
          drawGlow(ctx, wx, wy, g.R * 0.08, [255, 190, 100], 0.4);
          ctx.fillStyle = 'rgba(255,206,120,.95)';
          ctx.fillRect(wx, wy, Math.max(2, g.R * 0.04), Math.max(2, g.R * 0.05));
        }
        if (n === 2) {
          // a spire
          ctx.fillStyle = '#0e1736';
          ctx.beginPath();
          ctx.moveTo(x + w * 0.35, top - hh * 0.3);
          ctx.lineTo(x + w * 0.5, top - hh * 2.2);
          ctx.lineTo(x + w * 0.65, top - hh * 0.3);
          ctx.closePath();
          ctx.fill();
        }
        x += w + g.R * 0.04;
        n++;
      }
      ctx.fillStyle = vgrad(ctx, py(g, 0.18), sy1, [[0, '#8a98bc'], [1, '#5a6890']]);
      ctx.fillRect(px(g, WIN.x0), py(g, 0.2), px(g, WIN.x1) - px(g, WIN.x0), sy1 - py(g, 0.2));
    }
    ctx.restore();
    // the frame and the mullions
    const fw = Math.max(3, g.R * 0.07);
    ctx.strokeStyle = v ? '#4a3a32' : '#3d2418';
    ctx.lineWidth = fw;
    windowPath(ctx, g, v);
    ctx.stroke();
    if (!v) {
      ctx.lineWidth = fw * 0.55;
      ctx.beginPath();
      ctx.moveTo(px(g, 0), py(g, WIN.y0));
      ctx.lineTo(px(g, 0), py(g, WIN.y1));
      ctx.moveTo(px(g, WIN.x0), py(g, -0.72));
      ctx.lineTo(px(g, WIN.x1), py(g, -0.72));
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,220,180,.14)';
    ctx.lineWidth = 1;
    windowPath(ctx, g, v);
    ctx.stroke();
    // on a wide wall: a shelf with clay jars to the right, a bunch of herbs drying to the left
    if (px(g, 2.3) < g.w - 4) {
      const sy = py(g, -0.85), sx0 = px(g, 1.45), sx1 = px(g, 2.45);
      ctx.fillStyle = v ? '#4a3a30' : '#3a2416';
      ctx.fillRect(sx0, sy, sx1 - sx0, g.R * 0.06);
      ctx.fillStyle = 'rgba(255,220,170,.08)';
      ctx.fillRect(sx0, sy, sx1 - sx0, Math.max(1, g.R * 0.012));
      for (const [x, hgt, wd, col] of [[1.62, 0.26, 0.11, '#7a4a2e'], [1.88, 0.36, 0.14, '#6a3a26'], [2.16, 0.2, 0.1, '#8a5a3a']] as const) {
        const jx = px(g, x), jw = g.R * wd, jh = g.R * hgt;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(jx - jw * 0.55, sy);
        ctx.quadraticCurveTo(jx - jw * 1.1, sy - jh * 0.55, jx - jw * 0.35, sy - jh);
        ctx.lineTo(jx + jw * 0.35, sy - jh);
        ctx.quadraticCurveTo(jx + jw * 1.1, sy - jh * 0.55, jx + jw * 0.55, sy);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,190,130,.18)';
        ctx.lineWidth = Math.max(1, g.R * 0.012);
        ctx.beginPath();
        ctx.moveTo(jx - jw * 0.7, sy - jh * 0.75);
        ctx.quadraticCurveTo(jx - jw * 0.95, sy - jh * 0.45, jx - jw * 0.5, sy - jh * 0.1);
        ctx.stroke();
      }
    }
    if (px(g, -1.7) > 4) {
      const hx = px(g, -1.7), hy = py(g, -1.35);
      ctx.strokeStyle = v ? '#3a3020' : '#2e2414';
      ctx.lineWidth = Math.max(1, g.R * 0.012);
      ctx.beginPath();
      ctx.moveTo(hx, hy - g.R * 0.25);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const a = Math.PI / 2 + (i - 4) * 0.13;
        ctx.strokeStyle = i % 2 ? '#3e4a2a' : '#4a5632';
        ctx.lineWidth = Math.max(1.2, g.R * 0.018);
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo(hx + Math.cos(a) * g.R * 0.12, hy + Math.sin(a) * g.R * 0.2, hx + Math.cos(a) * g.R * 0.2, hy + Math.sin(a) * g.R * 0.42);
        ctx.stroke();
      }
      ctx.fillStyle = '#6a2a22';
      ctx.fillRect(hx - g.R * 0.04, hy - g.R * 0.02, g.R * 0.08, g.R * 0.05);
    }
    // the sill, and the old table under it
    const sill = py(g, 0.5);
    ctx.fillStyle = v ? '#5a4436' : '#4a2c1c';
    ctx.fillRect(0, sill - g.R * 0.08, g.w, g.R * 0.1);
    ctx.fillStyle = vgrad(ctx, sill, g.h, v ? [[0, '#3a2a22'], [1, '#1a120e']] : [[0, '#32200f'], [1, '#160c08']]);
    ctx.fillRect(0, sill + g.R * 0.02, g.w, g.h - sill);
    ctx.strokeStyle = 'rgba(0,0,0,.18)';
    ctx.lineWidth = 1;
    const rnd = seeded(31);
    for (let i = 0; i < 9; i++) {
      const y = sill + g.R * 0.1 + rnd() * (g.h - sill);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(g.w * 0.3, y + rnd() * 6 - 3, g.w * 0.6, y + rnd() * 6 - 3, g.w, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,220,170,.10)';
    ctx.fillRect(0, sill - g.R * 0.08, g.w, Math.max(1, g.R * 0.015));
    vignette(ctx, g, 0.5);
  },
  under(ctx, g, L) {
    const x = px(g, 0), y = py(g, -0.18);
    if (L.variant % 2 === 0) {
      // snow falling outside, sideways in a draught
      ctx.save();
      windowPath(ctx, g, 0);
      ctx.clip();
      ctx.fillStyle = 'rgba(235,242,255,.8)';
      const rnd = seeded(5);
      const span = WIN.y1 - WIN.y0;
      for (let i = 0; i < 46; i++) {
        const sp = 0.06 + rnd() * 0.1, x0 = WIN.x0 + rnd() * (WIN.x1 - WIN.x0), ph = rnd();
        const k = (L.t * sp + ph) % 1;
        const sx = x0 + Math.sin(L.t * 0.7 + i) * 0.04 + L.bend * k * 0.5;
        ctx.beginPath();
        ctx.arc(px(g, ((sx - WIN.x0 + 4) % (WIN.x1 - WIN.x0)) + WIN.x0), py(g, WIN.y0 + k * span), Math.max(0.8, g.R * (0.007 + rnd() * 0.01)), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    drawGlow(ctx, x, y, g.R * (1.1 + 1.2 * L.glow), [255, 150, 64], 0.14 + 0.3 * L.glow);
    drawGlow(ctx, x, y, g.R * (0.5 + 0.5 * L.glow), [255, 210, 140], 0.14 + 0.28 * L.glow);
    if (L.rest) drawGlow(ctx, x, y, g.R * (1.5 + 0.4 * L.breath), [255, 200, 140], 0.06 + 0.15 * L.calm);
    // the flame's reflection in the pane
    drawFlame(ctx, px(g, -0.2), py(g, -0.42), g.R * 0.1, g.R * 0.28, L.t + 0.4, L.energy, CANDLE, -L.bend * 0.6, 9, 0.16);
  },
  fire(ctx, g, L) {
    const v = L.variant % 2;
    const sill = py(g, 0.42);
    const k = (0.75 + 0.45 * L.heat) * (0.85 + 0.5 * L.charge) * L.grow;
    const bend = L.bend * (1 - L.shield * 0.85);
    if (v) {
      const bx = px(g, 0.16), by = sill - g.R * 0.08;
      ctx.fillStyle = '#8a5a3a';
      ctx.beginPath();
      ctx.ellipse(bx, by, g.R * 0.3, g.R * 0.1, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - g.R * 0.2, by - g.R * 0.04);
      ctx.quadraticCurveTo(px(g, -0.08), by - g.R * 0.07, px(g, -0.02), py(g, 0.08));
      ctx.lineTo(px(g, 0.02), py(g, 0.16));
      ctx.quadraticCurveTo(px(g, -0.04), by, bx - g.R * 0.18, by + g.R * 0.05);
      ctx.fill();
      ctx.fillStyle = '#5a3424';
      ctx.beginPath();
      ctx.ellipse(bx, by - g.R * 0.04, g.R * 0.12, g.R * 0.035, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,120,.4)';
      ctx.lineWidth = Math.max(1, g.R * 0.012);
      ctx.beginPath();
      ctx.ellipse(bx, by, g.R * 0.3, g.R * 0.1, 0, Math.PI * 1.05, Math.PI * 1.7);
      ctx.stroke();
      drawGlow(ctx, px(g, 0), py(g, 0.04), g.R * 0.3 * k, [255, 200, 120], 0.7);
      drawFlame(ctx, px(g, 0), py(g, 0.08), g.R * 0.15 * k, g.R * 0.46 * k, L.t, L.energy, CANDLE, bend, 2);
      return;
    }
    const cw = g.R * 0.13, top = py(g, 0.08);
    const cg = ctx.createLinearGradient(px(g, -0.13), 0, px(g, 0.13), 0);
    cg.addColorStop(0, '#cdb894');
    cg.addColorStop(0.42, '#fbf2dc');
    cg.addColorStop(1, '#b49c7c');
    ctx.fillStyle = cg;
    ctx.fillRect(px(g, 0) - cw, top, cw * 2, sill - top);
    ctx.fillStyle = '#fff6e0';
    ctx.beginPath();
    ctx.ellipse(px(g, 0), top, cw, g.R * 0.035, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4e8cc';
    for (const [dx, len] of [[-0.09, 0.12], [0.06, 0.2], [0.11, 0.08]] as const) {
      ctx.beginPath();
      ctx.ellipse(px(g, dx), top + g.R * len * 0.5, g.R * 0.022, g.R * len * 0.5, 0, 0, TAU);
      ctx.fill();
    }
    // a brass holder
    ctx.fillStyle = '#7a5a2a';
    ctx.beginPath();
    ctx.ellipse(px(g, 0), sill - g.R * 0.01, cw * 2.1, g.R * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b08a44';
    ctx.beginPath();
    ctx.ellipse(px(g, 0), sill - g.R * 0.03, cw * 1.9, g.R * 0.035, 0, Math.PI, TAU);
    ctx.fill();
    drawGlow(ctx, px(g, 0), top + g.R * 0.04, g.R * 0.22 * k, [255, 190, 110], 0.5);
    ctx.strokeStyle = '#2a1a14';
    ctx.lineWidth = Math.max(1.2, g.R * 0.014);
    ctx.beginPath();
    ctx.moveTo(px(g, 0), top);
    ctx.quadraticCurveTo(px(g, 0.01 + bend * 0.02), top - g.R * 0.05, px(g, 0.015 + bend * 0.03), top - g.R * 0.08);
    ctx.stroke();
    drawGlow(ctx, px(g, 0 + bend * 0.1), py(g, -0.12), g.R * 0.32 * k, [255, 200, 120], 0.55);
    drawFlame(ctx, px(g, 0.01 + bend * 0.02), top - g.R * 0.03, g.R * 0.15 * k, g.R * 0.5 * k, L.t, L.energy, CANDLE, bend, 2);
  },
  over(ctx, g, L) {
    const v = L.variant % 2;
    // the curtain (a woven cloth in the stone window), lifting at a draught
    const lift = clamp01(L.warn * 0.4 + Math.abs(L.bend));
    const x0 = px(g, WIN.x0) - g.R * 0.05, y0 = py(g, WIN.y0) - g.R * 0.05, y1 = py(g, 0.42);
    const reach = g.R * ((v ? 0.12 : 0.26) + 0.38 * lift);
    const cg = ctx.createLinearGradient(x0, 0, x0 + g.R * 0.6, 0);
    cg.addColorStop(0, v ? '#2a2230' : '#3a0e16');
    cg.addColorStop(0.6, v ? '#4a3a44' : '#6a1e2a');
    cg.addColorStop(1, v ? '#5a4650' : '#8a2a36');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(x0 - g.R * 0.1, y0);
    ctx.lineTo(x0 + g.R * 0.22, y0);
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const wob = Math.sin(L.t * (1.2 + lift * 4) + k * 5) * g.R * 0.03 * (0.4 + lift);
      ctx.lineTo(x0 + g.R * 0.22 + reach * Math.sin(k * Math.PI) * (0.4 + 0.6 * lift) + wob, y0 + (y1 - y0) * k);
    }
    ctx.lineTo(x0 - g.R * 0.1, y1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = v ? 'rgba(10,16,24,.45)' : 'rgba(24,4,8,.5)';
    ctx.lineWidth = Math.max(1, g.R * 0.016);
    for (let f = 1; f <= 3; f++) {
      ctx.beginPath();
      ctx.moveTo(x0 + g.R * 0.05 * f, y0);
      ctx.quadraticCurveTo(x0 + g.R * (0.05 * f + 0.1 * lift), (y0 + y1) / 2, x0 + g.R * 0.05 * f + reach * 0.3 * lift, y1);
      ctx.stroke();
    }
    // its edge, catching the candle's light
    ctx.strokeStyle = `rgba(255,170,100,${(0.12 + 0.25 * L.glow).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, g.R * 0.012);
    ctx.beginPath();
    for (let i = 2; i <= n; i++) {
      const k = i / n;
      const wob = Math.sin(L.t * (1.2 + lift * 4) + k * 5) * g.R * 0.03 * (0.4 + lift);
      const xx = x0 + g.R * 0.22 + reach * Math.sin(k * Math.PI) * (0.4 + 0.6 * lift) + wob, yy = y0 + (y1 - y0) * k;
      if (i === 2) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    // the draught: pale streaks from the window toward the flame
    if (L.warn > 0.02 || Math.abs(L.bend) > 0.05) {
      const a = Math.max(L.warn * 0.5, Math.abs(L.bend));
      ctx.strokeStyle = `rgba(220,232,255,${(0.32 * a).toFixed(3)})`;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.2, g.R * 0.014);
      const side = L.bend < 0 ? 1 : -1;
      for (let i = 0; i < 5; i++) {
        const k = (L.t * 1.6 + i / 5) % 1;
        const yy = py(g, -0.5 + i * 0.15);
        const xs = px(g, side * (1.0 - k * 0.9));
        ctx.beginPath();
        ctx.moveTo(xs, yy);
        ctx.quadraticCurveTo(xs - side * g.R * 0.18, yy - g.R * 0.04, xs - side * g.R * 0.35, yy + g.R * 0.02);
        ctx.stroke();
      }
    }
    // the hands cupped round the flame: palms toward it, the light shining through the fingers' edges
    if (L.shield > 0.01) {
      const s = L.shield;
      for (const side of [-1, 1] as const) {
        const X = (x: number) => px(g, side * x), Y = (y: number) => py(g, y + (1 - s) * 0.6);
        ctx.fillStyle = '#5a2e1c';
        ctx.beginPath();
        ctx.moveTo(X(0.5), Y(0.95));
        ctx.bezierCurveTo(X(0.42), Y(0.5), X(0.34), Y(0.1), X(0.3), Y(-0.28));
        ctx.quadraticCurveTo(X(0.27), Y(-0.42), X(0.2), Y(-0.38));
        ctx.bezierCurveTo(X(0.22), Y(-0.1), X(0.2), Y(0.3), X(0.24), Y(0.6));
        ctx.lineTo(X(0.3), Y(0.95));
        ctx.closePath();
        ctx.globalAlpha = s;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,140,60,.75)';
        ctx.lineWidth = Math.max(1.2, g.R * 0.022);
        ctx.beginPath();
        ctx.moveTo(X(0.24), Y(0.6));
        ctx.bezierCurveTo(X(0.2), Y(0.3), X(0.22), Y(-0.1), X(0.2), Y(-0.38));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 3. Ognisko — a bonfire on a hilltop, people round it
// ═════════════════════════════════════════════════════════════════
type Pose = 'sit' | 'stand' | 'child';
const PEOPLE: readonly (readonly [number, number, number, Pose])[] = [
  [-0.62, 0.44, 1, 'sit'], [0.66, 0.44, 1, 'sit'], [-1.05, 0.5, 1.05, 'sit'], [1.08, 0.5, 1, 'stand'], [-1.48, 0.55, 1.1, 'stand'], [1.42, 0.56, 0.75, 'child'],
];
const LAKE_PEOPLE: readonly (readonly [number, number, number, Pose])[] = [
  [-0.68, 0.44, 1, 'sit'], [0.72, 0.44, 1, 'sit'], [1.15, 0.5, 1.05, 'stand'],
];

/** A person's silhouette (feet at y); `facing` +1 toward the right. */
function person(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: Pose, facing: number): void {
  ctx.beginPath();
  if (kind === 'sit') {
    ctx.ellipse(x, y - s * 0.32, s * 0.24, s * 0.36, facing * 0.18, 0, TAU);
    ctx.moveTo(x + facing * s * 0.06 + s * 0.14, y - s * 0.78);
    ctx.arc(x + facing * s * 0.06, y - s * 0.78, s * 0.14, 0, TAU);
    ctx.moveTo(x + facing * s * 0.22 + s * 0.24, y - s * 0.06);
    ctx.ellipse(x + facing * s * 0.22, y - s * 0.06, s * 0.24, s * 0.08, 0, 0, TAU);
  } else {
    const k = kind === 'child' ? 0.7 : 1;
    ctx.moveTo(x - s * 0.22 * k, y);
    ctx.quadraticCurveTo(x - s * 0.2 * k, y - s * 0.9 * k, x, y - s * 1.0 * k);
    ctx.quadraticCurveTo(x + s * 0.2 * k, y - s * 0.9 * k, x + s * 0.22 * k, y);
    ctx.closePath();
    ctx.moveTo(x + s * 0.14 * k, y - s * 1.14 * k);
    ctx.arc(x, y - s * 1.14 * k, s * 0.14 * k, 0, TAU);
  }
  ctx.fill();
}

const OGNISKO: Scene = {
  light: [255, 140, 60],
  earth: true,
  back(ctx, g, v) {
    const horizon = py(g, 0.1);
    if (v % 2 === 0) {
      ctx.fillStyle = vgrad(ctx, 0, horizon, [[0, '#040716'], [0.6, '#0d1638'], [1, '#2a2140']]);
      ctx.fillRect(0, 0, g.w, g.h);
      stars(ctx, 0, 0, g.w, horizon, Math.round(150 * Math.min(2, g.w / 600)), 31, 1);
      // the Milky Way, faint
      ctx.save();
      ctx.translate(g.w * 0.5, horizon * 0.45);
      ctx.rotate(-0.4);
      for (let i = 0; i < 10; i++) drawGlowEllipse(ctx, (i - 5) * g.R * 0.5, Math.sin(i) * g.R * 0.1, g.R * 0.6, g.R * 0.16, [150, 150, 210], 0.07);
      ctx.restore();
      const mx = g.w * 0.8, my = g.top + (horizon - g.top) * 0.22, mr = g.R * 0.1;
      drawGlow(ctx, mx, my, mr * 5, [180, 200, 255], 0.18);
      ctx.fillStyle = '#efeee6';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0a1230';
      ctx.beginPath();
      ctx.arc(mx - mr * 0.42, my - mr * 0.1, mr * 0.9, 0, TAU);
      ctx.fill();
      hills(ctx, -10, g.w + 10, py(g, 0.12), g.R * 0.22, g.h, '#161d3a', 3, 2.2);
      hills(ctx, -10, g.w + 10, py(g, 0.26), g.R * 0.16, g.h, '#0f1328', 8, 3);
    } else {
      ctx.fillStyle = vgrad(ctx, 0, horizon, [[0, '#1a2350'], [0.55, '#6a4a7a'], [0.85, '#d98a7a'], [1, '#f2b484']]);
      ctx.fillRect(0, 0, g.w, g.h);
      stars(ctx, 0, 0, g.w, horizon * 0.5, 40, 33, 0.5);
      hills(ctx, -10, g.w + 10, py(g, 0.08), g.R * 0.14, py(g, 0.3), '#5a4a6a', 4, 2);
      const ly = py(g, 0.2);
      ctx.fillStyle = vgrad(ctx, ly, g.h, [[0, '#c98a86'], [0.4, '#5a4a70'], [1, '#1a1a34']]);
      ctx.fillRect(0, ly, g.w, g.h - ly);
      ctx.strokeStyle = 'rgba(255,220,190,.18)';
      ctx.lineWidth = 1;
      const rnd = seeded(61);
      for (let i = 0; i < 24; i++) {
        const y = ly + (g.h - ly) * rnd() * 0.6, x = rnd() * g.w, w = g.R * (0.2 + rnd() * 0.6);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.stroke();
      }
      const bx = g.w * 0.22, by = ly + g.R * 0.12;
      ctx.fillStyle = '#1e1626';
      ctx.beginPath();
      ctx.moveTo(bx - g.R * 0.45, by);
      ctx.quadraticCurveTo(bx, by + g.R * 0.14, bx + g.R * 0.45, by);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#1e1626';
      ctx.lineWidth = Math.max(1.5, g.R * 0.02);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx, by - g.R * 0.6);
      ctx.stroke();
    }
    const base = py(g, 0.42);
    ctx.fillStyle = v % 2 ? '#1a1420' : '#08080f';
    ctx.beginPath();
    ctx.moveTo(-10, g.h);
    ctx.lineTo(-10, base + g.R * 0.5);
    ctx.bezierCurveTo(px(g, -1.6), base + g.R * 0.1, px(g, -0.8), base - g.R * 0.06, px(g, 0), base - g.R * 0.04);
    ctx.bezierCurveTo(px(g, 0.8), base - g.R * 0.06, px(g, 1.6), base + g.R * 0.1, g.w + 10, base + g.R * 0.5);
    ctx.lineTo(g.w + 10, g.h);
    ctx.closePath();
    ctx.fill();
    if (v % 2 === 0) {
      const tx = px(g, -1.85), ty = base + g.R * 0.15;
      ctx.fillStyle = '#05050b';
      for (let k = 0; k < 5; k++) {
        const w = g.R * (0.42 - k * 0.07), y = ty - k * g.R * 0.26;
        ctx.beginPath();
        ctx.moveTo(tx - w, y);
        ctx.lineTo(tx, y - g.R * 0.42);
        ctx.lineTo(tx + w, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // stones round the fire pit
    ctx.fillStyle = '#1a1416';
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (0.05 + i * 0.112);
      ctx.beginPath();
      ctx.ellipse(px(g, Math.cos(a) * 0.36), py(g, 0.42 + Math.sin(a) * 0.06), g.R * 0.06, g.R * 0.035, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = v % 2 ? '#120c16' : '#06060c';
    for (const [x, y, s, kind] of v % 2 ? LAKE_PEOPLE : PEOPLE) person(ctx, px(g, x), py(g, y), g.R * 0.42 * s, kind, x < 0 ? 1 : -1);
    vignette(ctx, g, 0.4);
  },
  under(ctx, g, L) {
    const x = px(g, 0), y = py(g, 0.38);
    drawGlowEllipse(ctx, x, y, g.R * (1.4 + 1.1 * L.glow), g.R * (0.45 + 0.3 * L.glow), [255, 120, 40], 0.2 + 0.32 * L.glow);
    drawGlow(ctx, x, py(g, 0), g.R * (1.1 + 1.2 * L.glow), [255, 110, 40], 0.08 + 0.18 * L.glow);
    if (L.rest) drawGlow(ctx, x, py(g, 0.1), g.R * (1.7 + 0.4 * L.breath), [255, 170, 100], 0.05 + 0.13 * L.calm);
  },
  fire(ctx, g, L) {
    const x = px(g, 0), base = py(g, 0.4);
    const k = (0.72 + 0.45 * L.heat) * (0.75 + 0.6 * L.charge) * L.grow;
    // the logs in a tepee, glowing where they burn
    ctx.lineCap = 'round';
    for (const [a, len] of [[-0.55, 0.42], [0.5, 0.44], [-0.2, 0.36], [0.25, 0.38]] as const) {
      ctx.strokeStyle = '#2a1810';
      ctx.lineWidth = Math.max(3, g.R * 0.06);
      ctx.beginPath();
      ctx.moveTo(x + Math.sin(a) * g.R * len, base + g.R * 0.02);
      ctx.lineTo(x - Math.sin(a) * g.R * 0.05, base - g.R * len * 0.7);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,110,40,.6)';
      ctx.lineWidth = Math.max(1.5, g.R * 0.025);
      ctx.beginPath();
      ctx.moveTo(x - Math.sin(a) * g.R * 0.02, base - g.R * len * 0.3);
      ctx.lineTo(x - Math.sin(a) * g.R * 0.05, base - g.R * len * 0.68);
      ctx.stroke();
    }
    for (const b of L.sim.burning) {
      const lk = clamp01(b.t / RULES.logBurn);
      ctx.save();
      ctx.translate(x + b.x * g.R, base - g.R * 0.02);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#3a2214';
      ctx.fillRect(-g.R * 0.3, -g.R * 0.04, g.R * 0.6, g.R * 0.08);
      ctx.fillStyle = `rgba(255,${Math.round(120 + 80 * lk)},50,${(0.4 + 0.5 * (1 - lk)).toFixed(3)})`;
      ctx.fillRect(-g.R * 0.24, -g.R * 0.02, g.R * 0.48, g.R * 0.04);
      ctx.restore();
    }
    const fresh = L.sim.burning.reduce((m, b) => Math.max(m, clamp01(b.t / RULES.logBurn)), 0);
    const kk = k * (1 + 0.25 * fresh);
    drawGlow(ctx, x, base - g.R * 0.35 * kk, g.R * 0.85 * kk, [255, 150, 60], 0.5);
    drawBlaze(ctx, x, base, g.R * 0.62 * kk, g.R * 1.0 * kk, L.t, L.energy, FIRE, L.variant % 2 ? 4 : 7, 0, 1);
    drawGlow(ctx, x, base - g.R * 0.18 * kk, g.R * 0.3 * kk, [255, 236, 170], 0.55, 0.3);
    for (let i = 0; i < 9; i++) {
      const ex = x + (hash(i * 3.1) - 0.5) * g.R * 0.62, ey = base + (hash(i * 7.7) - 0.3) * g.R * 0.05;
      drawGlow(ctx, ex, ey, g.R * 0.045, [255, 120, 40], 0.5 + 0.4 * Math.sin(L.t * 3 + i));
    }
  },
  over(ctx, g, L) {
    // the fire's light on the people: their fire-side edges lit
    const people = L.variant % 2 ? LAKE_PEOPLE : PEOPLE;
    const a = (0.35 + 0.5 * L.glow);
    ctx.lineCap = 'round';
    for (const [x, y, s, kind] of people) {
      const f = x < 0 ? 1 : -1;
      const S = g.R * 0.42 * s, bx = px(g, x), by = py(g, y);
      const fade = a / (1 + Math.abs(x) * 0.5);
      ctx.strokeStyle = `rgba(255,150,70,${fade.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, S * 0.06);
      if (kind === 'sit') {
        const hx = bx + f * S * 0.06, hy = by - S * 0.78;
        ctx.beginPath();
        ctx.arc(hx, hy, S * 0.14, f > 0 ? -1.1 : Math.PI - 0.5, f > 0 ? 0.5 : Math.PI + 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(bx, by - S * 0.32, S * 0.24, S * 0.36, f * 0.18, f > 0 ? -0.9 : Math.PI - 0.2, f > 0 ? 0.2 : Math.PI + 0.9);
        ctx.stroke();
      } else {
        const k = kind === 'child' ? 0.7 : 1;
        ctx.beginPath();
        ctx.arc(bx, by - S * 1.14 * k, S * 0.14 * k, f > 0 ? -1.1 : Math.PI - 0.5, f > 0 ? 0.5 : Math.PI + 1.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx + f * S * 0.05, by - S * 0.98 * k);
        ctx.quadraticCurveTo(bx + f * S * 0.2 * k, by - S * 0.9 * k, bx + f * S * 0.22 * k, by - S * 0.1);
        ctx.stroke();
      }
      drawGlow(ctx, bx + f * S * 0.25, by - S * 0.6, S * 0.7, [255, 130, 60], fade * 0.35);
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 4. Słup ognia — the pillar of fire over the camp
// ═════════════════════════════════════════════════════════════════
/** A nomad's tent: a low ridge, the cloth sagging between its poles, a door in front. */
function tentPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.lineTo(x - w * 0.82, y - h * 0.62);
  ctx.quadraticCurveTo(x - w * 0.45, y - h * 0.82, x - w * 0.12, y - h);
  ctx.quadraticCurveTo(x, y - h * 0.9, x + w * 0.12, y - h);
  ctx.quadraticCurveTo(x + w * 0.45, y - h * 0.82, x + w * 0.82, y - h * 0.62);
  ctx.lineTo(x + w, y);
  ctx.closePath();
}

const SLUP: Scene = {
  light: [255, 160, 70],
  earth: true,
  back(ctx, g, v) {
    const horizon = py(g, 0.42);
    ctx.fillStyle = vgrad(ctx, 0, horizon, v % 2 ? [[0, '#041018'], [0.6, '#0e2a3e'], [1, '#2a4652']] : [[0, '#05051a'], [0.55, '#14123e'], [1, '#2e2452']]);
    ctx.fillRect(0, 0, g.w, g.h);
    stars(ctx, 0, 0, g.w, horizon, Math.round(150 * Math.min(2, g.w / 600)), 47 + v, 1);
    if (v % 2) {
      ctx.fillStyle = '#121a26';
      ctx.beginPath();
      ctx.moveTo(px(g, -2.6), horizon + 2);
      ctx.lineTo(px(g, -1.1), py(g, -0.5));
      ctx.lineTo(px(g, -0.75), py(g, -0.75));
      ctx.lineTo(px(g, -0.35), py(g, -0.58));
      ctx.lineTo(px(g, 0.1), py(g, -1.05));
      ctx.lineTo(px(g, 0.5), py(g, -0.7));
      ctx.lineTo(px(g, 1.0), py(g, -0.45));
      ctx.lineTo(px(g, 2.8), horizon + 2);
      ctx.closePath();
      ctx.fill();
    }
    // the clouds the pillar reaches into
    const ctop = Math.max(0, g.top - g.R * 0.4);
    for (let i = 0; i < 11; i++) {
      const rnd = seeded(300 + i);
      drawGlowEllipse(ctx, g.cx + (rnd() - 0.5) * g.w * 1.2, ctop + rnd() * g.R * 0.6, g.R * (0.9 + rnd()), g.R * (0.22 + rnd() * 0.18), v % 2 ? [36, 52, 70] : [40, 32, 70], 0.9);
    }
    hills(ctx, -10, g.w + 10, horizon, g.R * 0.08, g.h, v % 2 ? '#2e3e44' : '#2c2244', 2, 2);
    hills(ctx, -10, g.w + 10, py(g, 0.62), g.R * 0.1, g.h, v % 2 ? '#202c32' : '#201a36', 5, 3);
    hills(ctx, -10, g.w + 10, py(g, 0.95), g.R * 0.14, g.h, v % 2 ? '#151d24' : '#151128', 9, 2.5);
    // the camp: rows of tents to the horizon, a lamp here and there
    const rnd = seeded(71 + v);
    for (let row = 0; row < 6; row++) {
      const yy = horizon + (py(g, 0.6) - horizon) * (row / 5.5);
      const s = g.R * (0.045 + row * 0.024);
      for (let x = -s * 3 + rnd() * s * 2; x < g.w + s * 2; x += s * (2.3 + rnd() * 1.3)) {
        if (Math.abs(x - g.cx) < g.R * 0.24) continue;
        ctx.fillStyle = v % 2 ? '#0f181e' : '#0d0b1c';
        tentPath(ctx, x, yy, s, s * 0.95);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,180,110,.10)';
        ctx.fillRect(x - s * 0.1, yy - s * 0.9, s * 0.2, Math.max(1, s * 0.08));
        if (rnd() < 0.2) {
          drawGlow(ctx, x, yy - s * 0.25, s * 0.9, [255, 170, 80], 0.35);
          ctx.fillStyle = 'rgba(255,190,100,.8)';
          ctx.fillRect(x - s * 0.1, yy - s * 0.42, Math.max(1.5, s * 0.2), Math.max(1.5, s * 0.4));
        }
      }
    }
    vignette(ctx, g, 0.4);
  },
  under(ctx, g, L) {
    const x = px(g, 0), base = py(g, 0.78);
    drawGlowEllipse(ctx, x, base, g.R * (2.0 + 1.0 * L.glow), g.R * (0.5 + 0.25 * L.glow), [255, 140, 50], 0.2 + 0.28 * L.glow);
    drawGlowEllipse(ctx, x, Math.max(0, g.top - g.R * 0.3), g.R * (1.7 + 0.8 * L.glow), g.R * (0.45 + 0.2 * L.glow), [255, 150, 70], 0.25 + 0.35 * L.glow);
    drawGlow(ctx, x, py(g, -0.2), g.R * (1.5 + 1.0 * L.glow), [255, 120, 40], 0.07 + 0.14 * L.glow);
    if (L.rest) drawGlow(ctx, x, py(g, 0), g.R * (1.9 + 0.4 * L.breath), [255, 190, 120], 0.05 + 0.12 * L.calm);
  },
  fire(ctx, g, L) {
    const x = px(g, 0), base = py(g, 0.8), topY = Math.min(-g.R * 0.2, g.top - g.R * 0.7);
    const k = (0.75 + 0.35 * L.heat) * (0.8 + 0.45 * L.charge) * L.grow;
    const w0 = g.R * 0.17 * k, w1 = g.R * 0.36 * k;
    const hgt = base - topY;
    // the column's body: a soft wide veil, then a fiery body with rippling edges, then a white heart
    const layers: readonly (readonly [number, string, string, number])[] = [
      [1.8, 'rgba(200,60,20,0)', 'rgba(230,90,30,.35)', 0.8],
      [1.0, 'rgba(240,90,30,.6)', 'rgba(255,196,90,.95)', 1],
      [0.42, 'rgba(255,214,140,.8)', 'rgba(255,250,228,1)', 1],
    ];
    for (const [wk, edge, mid, al] of layers) {
      const col = ctx.createLinearGradient(x - w1 * wk, 0, x + w1 * wk, 0);
      col.addColorStop(0, edge);
      col.addColorStop(0.5, mid);
      col.addColorStop(1, edge);
      ctx.fillStyle = col;
      ctx.globalAlpha = al;
      ctx.beginPath();
      const n = 30;
      for (let i = 0; i <= n; i++) {
        const kk = i / n, yy = base - hgt * kk;
        const ww = (w0 + (w1 - w0) * kk * kk) * wk;
        const rip = Math.sin(kk * 16 - L.t * 5.5) * 0.14 + Math.sin(kk * 6.5 - L.t * 2.9) * 0.1;
        if (i === 0) ctx.moveTo(x - ww * (1 + rip), yy);
        else ctx.lineTo(x - ww * (1 + rip), yy);
      }
      for (let i = n; i >= 0; i--) {
        const kk = i / n, yy = base - hgt * kk;
        const ww = (w0 + (w1 - w0) * kk * kk) * wk;
        const rip = Math.sin(kk * 15 - L.t * 5.9 + 1.3) * 0.14 + Math.sin(kk * 6 - L.t * 2.7 + 2) * 0.1;
        ctx.lineTo(x + ww * (1 + rip), yy);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // turbulence climbing inside it: bright curls of light rising and fading
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const j = hash(i * 5.3);
      const kk = ((j + L.t * (0.1 + 0.06 * j)) % 1);
      const yy = base - hgt * kk;
      const ww = w0 + (w1 - w0) * kk * kk;
      const a = Math.sin(kk * Math.PI) * (0.12 + 0.12 * L.glow);
      ctx.strokeStyle = `rgba(255,236,190,${a.toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, g.R * (0.015 + 0.02 * j) * k);
      const sw = Math.sin(L.t * 1.7 + i * 2.3);
      const side = j < 0.5 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + side * ww * (0.2 + 0.5 * j), yy + g.R * 0.08);
      ctx.quadraticCurveTo(x + sw * ww * 0.5, yy - g.R * (0.06 + 0.1 * j), x - side * ww * (0.3 + 0.4 * (1 - j)), yy - g.R * 0.14);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    drawBlaze(ctx, x, base + g.R * 0.04, w0 * 3.2, g.R * 0.55 * k, L.t, L.energy, FIRE, 5, 0, 2);
    for (let i = 0; i < 5; i++) drawGlow(ctx, x, base - hgt * (i / 5), g.R * (0.45 + 0.2 * i) * k, [255, 180, 90], 0.2 + 0.14 * L.glow);
  },
  over(ctx, g, L) {
    const sim = L.sim;
    const pillar = { x: px(g, 0), y: py(g, 0.15) };
    for (const tt of sim.tents) {
      const x = px(g, tt.x), y = py(g, tt.y), w = g.R * tt.s, h = g.R * tt.s * 0.95;
      const lit = clamp01(tt.lit);
      if (lit > 0.02) drawGlowEllipse(ctx, x, y + h * 0.05, w * 2.3, h * 0.6, [255, 170, 80], 0.45 * lit);
      // the cloth: lit from above by the pillar, warmer when its lamp burns
      const cg = ctx.createLinearGradient(x, y - h, x, y);
      cg.addColorStop(0, rgba(mixRgb([86, 62, 70], [190, 120, 80], lit), 1));
      cg.addColorStop(1, rgba(mixRgb([30, 22, 36], [90, 54, 40], lit), 1));
      ctx.fillStyle = cg;
      tentPath(ctx, x, y, w, h);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,130,.22)';
      ctx.lineWidth = Math.max(1, g.R * 0.01);
      ctx.stroke();
      // the door: dark and waiting (a breath of light to find it), or glowing with its lamp
      const dw = w * 0.26, dh = h * 0.58;
      ctx.fillStyle = lit > 0.05 ? rgba(mixRgb([70, 34, 20], [255, 196, 110], lit), 1) : '#0a0812';
      ctx.beginPath();
      ctx.moveTo(x - dw, y);
      ctx.quadraticCurveTo(x - dw * 0.4, y - dh, x, y - dh);
      ctx.quadraticCurveTo(x + dw * 0.4, y - dh, x + dw, y);
      ctx.closePath();
      ctx.fill();
      if (lit > 0.05) drawGlow(ctx, x, y - h * 0.22, w * 0.6, [255, 210, 130], 0.6 * lit);
      else if (sim.handsOn) drawGlow(ctx, x, y - dh * 0.4, w * 0.35, [255, 210, 150], 0.12 + 0.1 * Math.sin(L.t * 2.4 + tt.x * 3));
      if (tt.arc >= 0) {
        const k = tt.arc;
        const ax = pillar.x + (x - pillar.x) * k, ay = pillar.y + (y - h * 0.3 - pillar.y) * k - Math.sin(k * Math.PI) * g.R * 0.6;
        drawGlow(ctx, ax, ay, g.R * 0.16, [255, 200, 110], 0.9);
        drawFlame(ctx, ax, ay + g.R * 0.04, g.R * 0.07, g.R * 0.16, L.t * 2, 1, FIRE, 0, tt.x * 7);
      }
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 5. Gwiazda — a star in space
// ═════════════════════════════════════════════════════════════════
interface StarPal { disc: readonly (readonly [number, string])[]; corona: readonly number[]; corona2: readonly number[]; prom: readonly number[]; spot: string }
const STAR_PAL: readonly StarPal[] = [
  { disc: [[0, '#fffbea'], [0.5, '#ffe696'], [0.8, '#ffae52'], [0.95, '#f07a2c'], [1, '#d24e1a']], corona: [255, 214, 150], corona2: [255, 150, 70], prom: [255, 110, 60], spot: 'rgba(120,40,10,.55)' },
  { disc: [[0, '#f8fbff'], [0.5, '#d8e6ff'], [0.8, '#9cb8ff'], [0.95, '#6a86ec'], [1, '#4a60d0']], corona: [200, 220, 255], corona2: [110, 150, 255], prom: [170, 196, 255], spot: 'rgba(40,60,140,.45)' },
];

/** The star's disc with its granulation and two spots, baked at radius `r` (px). */
function starDisc(g: Geo, r: number, v: number): HTMLCanvasElement | null {
  const dpr = g.dpr ?? 1;
  return bake(`disc|${v}|${Math.round(r)}|${dpr}`, r * 2, r * 2, dpr, c => {
    const p = STAR_PAL[v % 2];
    const dg = c.createRadialGradient(r * 0.85, r * 0.85, 0, r, r, r);
    for (const [k, col] of p.disc) dg.addColorStop(k, col);
    c.fillStyle = dg;
    c.beginPath();
    c.arc(r, r, r, 0, TAU);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(r, r, r * 0.985, 0, TAU);
    c.clip();
    const rnd = seeded(1234 + v);
    for (let i = 0; i < 260; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r;
      const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d, rr = r * (0.03 + rnd() * 0.05);
      const light = rnd() < 0.55;
      const gr = c.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, light ? 'rgba(255,255,240,.22)' : (v ? 'rgba(120,150,230,.08)' : 'rgba(150,60,20,.16)'));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr;
      c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    for (const [a, d, s] of v ? [] : [[2.3, 0.45, 0.06], [2.5, 0.5, 0.035]] as const) {
      c.fillStyle = p.spot;
      c.beginPath();
      c.ellipse(r + Math.cos(a) * d * r, r + Math.sin(a) * d * r, r * s, r * s * 0.8, a, 0, TAU);
      c.fill();
    }
    c.restore();
  });
}

/** The corona: a soft halo and long thin streamers, baked once (turned slowly each frame). */
function corona(g: Geo, r: number, v: number): HTMLCanvasElement | null {
  const dpr = Math.min(1.5, g.dpr ?? 1);
  const S = r * 3;
  return bake(`corona|${v}|${Math.round(r)}|${dpr}`, S * 2, S * 2, dpr, c => {
    const p = STAR_PAL[v % 2];
    const halo = c.createRadialGradient(S, S, r * 0.8, S, S, S);
    halo.addColorStop(0, rgba(p.corona, 0.55));
    halo.addColorStop(0.25, rgba(p.corona, 0.22));
    halo.addColorStop(0.6, rgba(p.corona2, 0.06));
    halo.addColorStop(1, rgba(p.corona2, 0));
    c.fillStyle = halo;
    c.fillRect(0, 0, S * 2, S * 2);
    c.translate(S, S);
    const rnd = seeded(77 + v);
    for (let i = 0; i < 22; i++) {
      c.rotate(TAU / 22 + (rnd() - 0.5) * 0.15);
      const len = r * (1.5 + rnd() * 1.4);
      const wd = r * (0.03 + rnd() * 0.06);
      const gr = c.createLinearGradient(r * 0.9, 0, len, 0);
      gr.addColorStop(0, rgba(p.corona, 0.28));
      gr.addColorStop(1, rgba(p.corona, 0));
      c.fillStyle = gr;
      c.beginPath();
      c.moveTo(r * 0.92, -wd);
      c.quadraticCurveTo(len * 0.6, -wd * 0.4, len, 0);
      c.quadraticCurveTo(len * 0.6, wd * 0.4, r * 0.92, wd);
      c.closePath();
      c.fill();
    }
  });
}

function space(ctx: CanvasRenderingContext2D, g: Geo, seed: number, c0: string, c1: string): void {
  const r = Math.hypot(g.w, g.h);
  const bg = ctx.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, r * 0.7);
  bg.addColorStop(0, c0);
  bg.addColorStop(1, c1);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, g.w, g.h);
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate(-0.55);
  const rnd = seeded(seed);
  const L = r * 0.8;
  for (let i = 0; i < 26; i++) drawGlowEllipse(ctx, (rnd() - 0.5) * L * 2, (rnd() - 0.5) * g.R * 0.5, g.R * (0.5 + rnd() * 0.9), g.R * (0.12 + rnd() * 0.2), [170, 160, 220], 0.1);
  for (let i = 0; i < 320; i++) {
    const x = (rnd() - 0.5) * L * 2, y = (rnd() + rnd() + rnd() - 1.5) * g.R * 0.35;
    ctx.fillStyle = `rgba(230,230,255,${(0.2 + rnd() * 0.5).toFixed(3)})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
  stars(ctx, 0, 0, g.w, g.h * 1.4, Math.round(220 * Math.min(2.2, g.w / 600)), seed + 1, 1, [220, 230, 255]);
}

const starSize = (L: Live): number => (0.85 + 0.25 * L.heat) * (0.82 + 0.3 * L.charge) * L.grow * (L.variant % 2 ? 1.12 : 1);

const GWIAZDA: Scene = {
  light: [255, 200, 120],
  earth: false,
  back(ctx, g, v) {
    space(ctx, g, 501 + v, v ? '#081228' : '#0c0a20', '#020208');
    const rnd = seeded(77 + v);
    const gx = g.w * (0.12 + rnd() * 0.2), gy = g.top + (g.h - g.top) * 0.78;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(0.6);
    drawGlowEllipse(ctx, 0, 0, g.R * 0.35, g.R * 0.1, [210, 190, 255], 0.35);
    drawGlowEllipse(ctx, 0, 0, g.R * 0.1, g.R * 0.05, [255, 240, 220], 0.6);
    ctx.restore();
  },
  under(ctx, g, L) {
    const v = L.variant % 2;
    const x = px(g, 0), y = py(g, 0);
    const size = starSize(L);
    const r0 = Math.round(g.R * 0.6);
    // the corona, turning slowly, brighter with the heat
    sprite(ctx, corona(g, r0, v), x, y, r0 * 3 * size, L.t * 0.015, 0.55 + 0.4 * L.glow);
    if (L.rest) drawGlow(ctx, x, y, g.R * (1.9 + 0.4 * L.breath) * size, STAR_PAL[v].corona, 0.06 + 0.12 * L.calm);
  },
  fire(ctx, g, L) {
    const v = L.variant % 2, p = STAR_PAL[v];
    const x = px(g, 0), y = py(g, 0);
    const size = starSize(L);
    const r = g.R * 0.58 * size;
    // prominences: loops of plasma on the limb
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i * 2.2 + 0.6 + Math.sin(L.t * 0.1 + i) * 0.2;
      const rise = 0.5 + 0.5 * Math.sin(L.t * 0.4 + i * 1.9);
      const hgt = r * (0.16 + 0.26 * rise) * (0.7 + 0.6 * L.heat);
      const a0 = a - 0.18, a1 = a + 0.18;
      const ax = x + Math.cos(a0) * r, ay = y + Math.sin(a0) * r, bx = x + Math.cos(a1) * r, by = y + Math.sin(a1) * r;
      const mx = x + Math.cos(a) * (r + hgt * 2), my = y + Math.sin(a) * (r + hgt * 2);
      ctx.strokeStyle = rgba(p.prom, 0.3);
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(mx, my, bx, by);
      ctx.stroke();
      ctx.strokeStyle = rgba(mixRgb(p.prom, [255, 240, 200], 0.5), 0.8);
      ctx.lineWidth = Math.max(1, r * 0.025);
      ctx.stroke();
    }
    // the disc, its surface turning
    sprite(ctx, starDisc(g, Math.round(g.R * 0.58 * 1.15), v), x, y, r, L.t * 0.01);
    drawGlow(ctx, x, y, r * 1.18, p.corona, 0.3 + 0.25 * L.glow);
    if (L.heat > 0.6) {
      const a = Math.floor(L.t * 0.5) * 2.3;
      const k = (L.t * 0.5) % 1;
      drawGlow(ctx, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95, r * 0.35 * Math.sin(k * Math.PI), [255, 255, 235], (L.heat - 0.6) * 1.6);
    }
  },
  over(ctx, g, L) {
    const sim = L.sim;
    for (const pr of sim.pairs) {
      const q = sim.pairAt(pr);
      const x = px(g, q.x), y = py(g, q.y);
      const life = clamp01(Math.min(pr.age / 0.4, (RULES.pairLife - pr.age) / 0.8));
      if (pr.fused >= 0) {
        const k = pr.fused / 0.8;
        drawGlow(ctx, x, y, g.R * (0.1 + 0.5 * k), [255, 255, 240], 1 - k);
        drawGlow(ctx, x + k * g.R * 0.3, y - k * g.R * 0.25, g.R * 0.07, [255, 210, 110], 1 - k);
        continue;
      }
      const d = g.R * 0.07, a = pr.spin + L.t * 3.2;
      const ax = x + Math.cos(a) * d, ay = y + Math.sin(a) * d * 0.7, bx = x - Math.cos(a) * d, by = y - Math.sin(a) * d * 0.7;
      drawGlow(ctx, x, y, g.R * 0.24, [150, 210, 255], 0.35 * life);
      ctx.strokeStyle = `rgba(190,230,255,${(0.45 * life).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      for (const [sx, sy] of [[ax, ay], [bx, by]] as const) {
        drawGlow(ctx, sx, sy, g.R * 0.07, [190, 235, 255], 0.9 * life, 0.5);
        ctx.fillStyle = `rgba(245,252,255,${life.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1.5, g.R * 0.018), 0, TAU);
        ctx.fill();
      }
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 6. Megagwiazda — a hypergiant in its nebula
// ═════════════════════════════════════════════════════════════════
const NEB_PAL: readonly (readonly (readonly number[])[])[] = [
  [[230, 70, 130], [255, 130, 80], [140, 60, 170], [70, 170, 190], [255, 206, 120]],
  [[90, 150, 255], [160, 220, 255], [150, 120, 240], [80, 210, 220], [235, 242, 255]],
];

/** The giant's disc with its huge convection cells, baked at radius `r`. */
function giantDisc(g: Geo, r: number, v: number): HTMLCanvasElement | null {
  const dpr = g.dpr ?? 1;
  return bake(`giant|${v}|${Math.round(r)}|${dpr}`, r * 2, r * 2, dpr, c => {
    const dg = c.createRadialGradient(r * 0.8, r * 0.8, 0, r, r, r);
    if (v) {
      dg.addColorStop(0, '#f4f8ff');
      dg.addColorStop(0.5, '#acc6ff');
      dg.addColorStop(0.85, '#6c8cf0');
      dg.addColorStop(1, '#4458c0');
    } else {
      dg.addColorStop(0, '#ffd8a8');
      dg.addColorStop(0.45, '#ff9050');
      dg.addColorStop(0.82, '#d84a28');
      dg.addColorStop(1, '#8a2420');
    }
    c.fillStyle = dg;
    c.beginPath();
    c.arc(r, r, r, 0, TAU);
    c.fill();
    c.save();
    c.beginPath();
    c.arc(r, r, r * 0.98, 0, TAU);
    c.clip();
    const rnd = seeded(66 + v);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.85, rr = r * (0.16 + rnd() * 0.22);
      const x = r + Math.cos(a) * d, y = r + Math.sin(a) * d;
      const light = rnd() < 0.5;
      const gr = c.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, light ? (v ? 'rgba(240,248,255,.3)' : 'rgba(255,230,190,.3)') : (v ? 'rgba(30,50,140,.28)' : 'rgba(90,20,24,.32)'));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = gr;
      c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    c.restore();
  });
}

const MEGA: Scene = {
  light: [255, 150, 110],
  earth: false,
  back(ctx, g, v) {
    space(ctx, g, 601 + v, v ? '#06081c' : '#0e0616', '#020106');
    const pal = NEB_PAL[v % 2];
    const rnd = seeded(811 + v);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 64; i++) {
      let a = rnd() * TAU, rr = 0.55 + rnd() * 1.7;
      if (v % 2) {
        a = (rnd() < 0.5 ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * 1.0;
        rr = 0.55 + rnd() * 1.6;
      }
      const c = pal[Math.floor(rnd() * pal.length)];
      drawGlowEllipse(ctx, px(g, Math.cos(a) * rr * 1.1), py(g, Math.sin(a) * rr * 0.85), g.R * (0.35 + rnd() * 0.85), g.R * (0.25 + rnd() * 0.55), c, 0.16 + rnd() * 0.18);
    }
    // bright knots and filaments in the gas
    for (let i = 0; i < 18; i++) {
      const a = rnd() * TAU, rr = 0.9 + rnd() * 1.2;
      drawGlow(ctx, px(g, Math.cos(a) * rr), py(g, Math.sin(a) * rr * 0.85), g.R * (0.05 + rnd() * 0.08), pal[4], 0.5);
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, rr = 0.8 + rnd() * 1.3;
      const c = pal[Math.floor(rnd() * pal.length)];
      ctx.strokeStyle = rgba(c, 0.18);
      ctx.lineWidth = Math.max(1, g.R * (0.01 + rnd() * 0.02));
      ctx.beginPath();
      ctx.moveTo(px(g, Math.cos(a) * rr), py(g, Math.sin(a) * rr * 0.85));
      ctx.quadraticCurveTo(px(g, Math.cos(a + 0.4) * (rr + 0.3)), py(g, Math.sin(a + 0.4) * (rr + 0.3) * 0.85), px(g, Math.cos(a + 0.8) * (rr + 0.05)), py(g, Math.sin(a + 0.8) * (rr + 0.05) * 0.85));
      ctx.stroke();
    }
    ctx.restore();
    // dark dust drifting across the glow: soft clouds, never a hard line
    for (let i = 0; i < 14; i++) {
      const a = rnd() * TAU, rr = 1.0 + rnd() * 1.1;
      drawGlowEllipse(ctx, px(g, Math.cos(a) * rr * 1.1), py(g, Math.sin(a) * rr * 0.85), g.R * (0.25 + rnd() * 0.45), g.R * (0.08 + rnd() * 0.12), [4, 2, 10], 0.55);
    }
    stars(ctx, 0, 0, g.w, g.h * 1.4, 70, 909 + v, 1);
  },
  under(ctx, g, L) {
    const v = L.variant % 2;
    const x = px(g, 0), y = py(g, 0);
    const size = (0.85 + 0.22 * L.heat) * (0.82 + 0.3 * L.charge) * L.grow * (1 + 0.025 * Math.sin(L.t * 0.8));
    const c = v ? [120, 170, 255] : [255, 110, 60];
    drawGlow(ctx, x, y, g.R * 1.7 * size, c, 0.28 + 0.2 * L.glow);
    for (let i = 0; i < 3; i++) {
      const k = ((L.t / 14) + i / 3) % 1;
      ctx.strokeStyle = rgba(v ? [170, 200, 255] : [255, 170, 130], 0.24 * (1 - k));
      ctx.lineWidth = Math.max(1, g.R * 0.02 * (1 - k));
      ctx.beginPath();
      ctx.ellipse(x, y, g.R * (0.8 + 1.5 * k) * size, g.R * (0.7 + 1.3 * k) * size, 0, 0, TAU);
      ctx.stroke();
    }
    if (L.rest) drawGlow(ctx, x, y, g.R * (2.1 + 0.4 * L.breath) * size, c, 0.05 + 0.12 * L.calm);
  },
  fire(ctx, g, L) {
    const v = L.variant % 2;
    const x = px(g, 0), y = py(g, 0);
    const size = (0.85 + 0.22 * L.heat) * (0.82 + 0.3 * L.charge) * L.grow * (1 + 0.025 * Math.sin(L.t * 0.8));
    const r = g.R * 0.68 * size;
    drawGlow(ctx, x, y, r * 1.25, v ? [150, 190, 255] : [255, 120, 70], 0.55);
    sprite(ctx, giantDisc(g, Math.round(g.R * 0.68 * 1.15), v), x, y, r, -L.t * 0.006);
    drawGlow(ctx, x, y, r * 1.12, v ? [210, 225, 255] : [255, 190, 140], 0.22 + 0.22 * L.glow);
  },
  over(ctx, g, L) {
    const sim = L.sim;
    const pal = NEB_PAL[L.variant % 2];
    for (const w of sim.wisps) {
      const q = sim.wispAt(w);
      const x = px(g, q.x), y = py(g, q.y);
      const c = pal[Math.floor(w.hue * pal.length) % pal.length];
      const fade = clamp01(w.age / 0.6) * (w.caught >= 0 ? 1 - clamp01((w.caught - RULES.wispIn * 0.8) / (RULES.wispIn * 0.2)) : clamp01((30 - w.age) / 1.5));
      if (w.caught >= 0) {
        for (let k = 1; k <= 4; k++) {
          const p = sim.wispAt({ ...w, caught: Math.max(0, w.caught - k * 0.06) });
          drawGlow(ctx, px(g, p.x), py(g, p.y), g.R * w.size * (1 - k * 0.15), c, 0.25 * fade);
        }
      }
      drawGlow(ctx, x, y, g.R * w.size * 1.7, c, 0.45 * fade);
      drawGlow(ctx, x, y, g.R * w.size * 0.5, mixRgb(c, [255, 255, 255], 0.6), 0.85 * fade, 0.4);
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 7. Zesłanie — Pentecost at dawn: the wind, the tongues of fire from above
// ═════════════════════════════════════════════════════════════════
/** the city's windows that light as the ring fills (units), made once: near the house first */
const CITY_WINDOWS: readonly (readonly [number, number])[] = (() => {
  const rnd = seeded(2027);
  const out: [number, number, number][] = [];
  for (let i = 0; i < 60; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (1.18 + rnd() * 2.2), y = 0.12 + rnd() * 0.62;
    out.push([x, y, Math.abs(x) + rnd() * 0.4]);
  }
  return out.sort((a, b) => a[2] - b[2]).map(([x, y]) => [x, y] as const);
})();

function block(ctx: CanvasRenderingContext2D, g: Geo, x: number, y: number, w: number, h: number, face: string, side: string): void {
  ctx.fillStyle = face;
  ctx.fillRect(px(g, x), py(g, y - h), w * g.R, h * g.R);
  ctx.fillStyle = side;
  ctx.fillRect(px(g, x), py(g, y - h), Math.max(1, w * g.R * 0.22), h * g.R);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(px(g, x), py(g, y - h), w * g.R, Math.max(1, g.R * 0.02));
}

const ZESLANIE: Scene = {
  light: [255, 206, 130],
  earth: false,
  back(ctx, g, v) {
    const horizon = py(g, 0.55);
    ctx.fillStyle = vgrad(ctx, 0, horizon, v % 2 ? [[0, '#28407a'], [0.45, '#7a6aa0'], [0.75, '#f0a888'], [1, '#ffd8a0']] : [[0, '#16244e'], [0.45, '#4a4686'], [0.72, '#c8788a'], [0.9, '#f4ae7c'], [1, '#ffd49a']]);
    ctx.fillRect(0, 0, g.w, g.h);
    stars(ctx, 0, 0, g.w, horizon * 0.45, 50, 71, v % 2 ? 0.3 : 0.6);
    drawGlowEllipse(ctx, px(g, -1.4), horizon, g.R * 2.6, g.R * 1.0, [255, 214, 150], 0.55);
    hills(ctx, -10, g.w + 10, py(g, 0.12), g.R * 0.18, g.h, '#9a7890', 12, 2);
    hills(ctx, -10, g.w + 10, py(g, 0.28), g.R * 0.1, g.h, '#7a5a78', 13, 3);
    // the city, far to near: flat roofs, domes, a tower, the wall
    const rnd = seeded(91 + v);
    for (let x = -3.4; x < 3.4;) {
      const w = 0.2 + rnd() * 0.3, hh = 0.2 + rnd() * 0.3;
      block(ctx, g, x, 0.45, w, hh, '#7a5a72', 'rgba(255,214,180,.25)');
      if (rnd() < 0.14) {
        ctx.fillStyle = '#7a5a72';
        ctx.beginPath();
        ctx.arc(px(g, x + w / 2), py(g, 0.45 - hh), w * g.R * 0.45, Math.PI, TAU);
        ctx.fill();
      }
      x += w + 0.02;
    }
    for (let x = -3.6; x < 3.6;) {
      const w = 0.28 + rnd() * 0.35, hh = 0.25 + rnd() * 0.35;
      if (Math.abs(x + w / 2) > 1.0) block(ctx, g, x, 0.78, w, hh, '#5a3e52', 'rgba(255,200,160,.28)');
      x += w + 0.03;
    }
    ctx.fillStyle = '#3e2a3c';
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -10 : px(g, 1.3), x1 = side < 0 ? px(g, -1.3) : g.w + 10;
      ctx.fillRect(x0, py(g, 0.64), x1 - x0, py(g, 1.0) - py(g, 0.64));
      for (let x = x0; x < x1; x += g.R * 0.12) ctx.fillRect(x, py(g, 0.6), g.R * 0.06, g.R * 0.05);
    }
    for (const [x, y] of [[-1.75, 1.0], [1.85, 1.02], [-2.4, 1.05]] as const) {
      ctx.fillStyle = '#2a2a24';
      ctx.fillRect(px(g, x) - g.R * 0.02, py(g, y - 0.2), g.R * 0.04, g.R * 0.2);
      ctx.fillStyle = '#3a4234';
      ctx.beginPath();
      ctx.ellipse(px(g, x), py(g, y - 0.3), g.R * 0.26, g.R * 0.16, 0, 0, TAU);
      ctx.fill();
    }
    // the house: an upper room open to the street, a door below, an outer stair, lit by the dawn from the left
    const hx0 = px(g, -1.08), hx1 = px(g, 1.08), roof = py(g, -0.58), floor = py(g, 0.34), ground = py(g, 0.98);
    const wall = ctx.createLinearGradient(hx0, 0, hx1, 0);
    wall.addColorStop(0, '#e8c49c');
    wall.addColorStop(0.5, '#cfa47e');
    wall.addColorStop(1, '#a87c60');
    ctx.fillStyle = wall;
    ctx.fillRect(hx0, roof, hx1 - hx0, ground - roof);
    ctx.fillStyle = '#9a7058';
    ctx.fillRect(hx0 - g.R * 0.05, roof - g.R * 0.09, hx1 - hx0 + g.R * 0.1, g.R * 0.11);
    ctx.fillStyle = 'rgba(255,236,200,.35)';
    ctx.fillRect(hx0 - g.R * 0.05, roof - g.R * 0.09, hx1 - hx0 + g.R * 0.1, Math.max(1, g.R * 0.02));
    // stones in the wall
    ctx.strokeStyle = 'rgba(90,60,40,.18)';
    ctx.lineWidth = 1;
    for (let y = roof + g.R * 0.14; y < ground; y += g.R * 0.14) {
      ctx.beginPath();
      ctx.moveTo(hx0, y);
      ctx.lineTo(hx1, y);
      ctx.stroke();
    }
    // the open room: warm darkness inside
    ctx.fillStyle = vgrad(ctx, py(g, -0.42), floor, [[0, '#2a1814'], [1, '#4a2a20']]);
    ctx.fillRect(px(g, -0.95), py(g, -0.42), px(g, 0.95) - px(g, -0.95), floor - py(g, -0.42));
    for (const cx of [-0.95, -0.32, 0.32, 0.95]) {
      ctx.fillStyle = '#d6ae86';
      ctx.fillRect(px(g, cx) - g.R * 0.035, py(g, -0.42), g.R * 0.07, floor - py(g, -0.42));
      ctx.fillStyle = 'rgba(80,50,30,.35)';
      ctx.fillRect(px(g, cx) + g.R * 0.01, py(g, -0.42), g.R * 0.025, floor - py(g, -0.42));
    }
    ctx.fillStyle = '#b8957a';
    ctx.fillRect(px(g, -1.0), floor, px(g, 1.0) - px(g, -1.0), g.R * 0.05);
    ctx.fillStyle = '#2a1a16';
    ctx.beginPath();
    ctx.moveTo(px(g, -0.16), ground);
    ctx.lineTo(px(g, -0.16), py(g, 0.62));
    ctx.arc(px(g, 0), py(g, 0.62), g.R * 0.16, Math.PI, TAU);
    ctx.lineTo(px(g, 0.16), ground);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c09a7c';
    for (let i = 0; i < 6; i++) ctx.fillRect(px(g, 1.08 + i * 0.05), py(g, 0.98 - i * 0.11), g.R * 0.12, g.R * 0.11 * (i + 1));
    ctx.fillStyle = vgrad(ctx, ground, g.h, [[0, '#6a4c50'], [1, '#2a1c2a']]);
    ctx.fillRect(0, ground, g.w, g.h - ground);
    vignette(ctx, g, 0.28);
  },
  under(ctx, g, L) {
    const x = px(g, 0), y = py(g, -0.05);
    drawGlow(ctx, x, y, g.R * (0.9 + 0.7 * L.glow), [255, 200, 120], 0.3 + 0.35 * L.glow);
    drawGlowEllipse(ctx, x, py(g, 1.15), g.R * (0.9 + 1.4 * L.charge), g.R * (0.25 + 0.3 * L.charge), [255, 210, 140], 0.2 + 0.45 * L.charge);
    const lit = L.charge * CITY_WINDOWS.length;
    CITY_WINDOWS.forEach(([wx, wy], i) => {
      const k = clamp01(lit - i);
      if (k <= 0) return;
      const sx = px(g, wx), sy = py(g, wy);
      if (sx < -10 || sx > g.w + 10) return;
      drawGlow(ctx, sx, sy, g.R * 0.13, [255, 196, 110], 0.4 * k);
      ctx.fillStyle = `rgba(255,220,150,${(0.9 * k).toFixed(3)})`;
      ctx.fillRect(sx - g.R * 0.02, sy - g.R * 0.03, g.R * 0.04, g.R * 0.05);
    });
    // the wind: bright streaks sweeping down from the sky toward the house
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const k = ((L.t * 0.3 + i / 8) % 1);
      const sx = px(g, -2.0 + i * 0.55), sy = Math.min(g.top, py(g, -1.2)) - g.R * 0.4;
      const ex = px(g, -0.7 + i * 0.2), ey = py(g, -0.4);
      const mx = (sx + ex) / 2 + g.R * 0.7, my = (sy + ey) / 2;
      const a = 0.42 * Math.sin(k * Math.PI) * (0.6 + 0.4 * L.glow);
      const P = (q: number) => [(1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * ex, (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * ey];
      for (let j = 0; j < 3; j++) {
        const q1 = Math.max(0, k - 0.1 * j), q0 = Math.max(0, q1 - 0.12);
        const [x0, y0] = P(q0), [x1, y1] = P(q1);
        ctx.strokeStyle = `rgba(255,246,226,${(a * (1 - j * 0.3)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, g.R * (0.024 - j * 0.006));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
    }
    if (L.rest) drawGlow(ctx, x, y, g.R * (1.6 + 0.4 * L.breath), [255, 220, 160], 0.06 + 0.14 * L.calm);
  },
  fire(ctx, g, L) {
    drawGlow(ctx, px(g, 0), py(g, -0.05), g.R * (0.4 + 0.3 * L.heat) * L.grow, [255, 236, 190], 0.35 + 0.3 * L.glow);
  },
  over(ctx, g, L) {
    const sim = L.sim;
    const figs = sim.figures;
    const head = (i: number) => {
      const f = figs[i];
      const hgt = f.street ? f.h * 1.05 : f.h * 0.62;
      return { x: px(g, f.x), y: py(g, f.y - hgt) - g.R * 0.04 };
    };
    for (let i = 0; i < figs.length; i++) {
      const f = figs[i];
      const x = px(g, f.x), y = py(g, f.y);
      const s = g.R * f.h;
      const lit = f.state === 'lit';
      ctx.globalAlpha = f.fade;
      if (lit) drawGlow(ctx, x, y - s * 0.6, s * 1.1, [255, 190, 110], 0.38);
      ctx.fillStyle = lit ? '#6a4636' : f.street ? '#2a2030' : '#22161a';
      if (f.street) {
        ctx.beginPath();
        ctx.moveTo(x - s * 0.26, y);
        ctx.quadraticCurveTo(x - s * 0.24, y - s * 0.75, x, y - s * 0.82);
        ctx.quadraticCurveTo(x + s * 0.24, y - s * 0.75, x + s * 0.26, y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y - s * 0.96, s * 0.15, 0, TAU);
        ctx.fill();
        ctx.fillStyle = lit ? '#8a5e48' : '#3a2c40';
        ctx.beginPath();
        ctx.arc(x, y - s * 0.98, s * 0.17, Math.PI * 1.05, Math.PI * 1.95);
        ctx.fill();
        // the dawn on their left edge
        ctx.strokeStyle = 'rgba(255,200,160,.35)';
        ctx.lineWidth = Math.max(1, s * 0.05);
        ctx.beginPath();
        ctx.moveTo(x - s * 0.25, y - s * 0.05);
        ctx.quadraticCurveTo(x - s * 0.23, y - s * 0.7, x - s * 0.05, y - s * 0.8);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.18, s * 0.26, s * 0.3, 0, Math.PI, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y - s * 0.6, s * 0.15, 0, TAU);
        ctx.fill();
      }
      if (f.state === 'wait' && sim.handsOn) {
        ctx.strokeStyle = `rgba(255,236,200,${(0.24 + 0.16 * Math.sin(L.t * 2.2 + f.seed)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, g.R * 0.012);
        ctx.beginPath();
        ctx.arc(x, y - s * (f.street ? 0.96 : 0.6), s * 0.24, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < figs.length; i++) {
      const f = figs[i];
      const hd = head(i);
      if (f.state === 'lit') {
        drawGlow(ctx, hd.x, hd.y - g.R * 0.03, g.R * 0.16, [255, 210, 120], 0.6);
        drawFlame(ctx, hd.x, hd.y + g.R * 0.02, g.R * 0.07, g.R * 0.16, L.t, 0.9, SPIRIT, 0, f.seed);
      } else if (f.state === 'tongue') {
        const k = f.k, e = 1 - (1 - k) * (1 - k);
        const sy = Math.min(g.top, py(g, -2.2)) - g.R * 0.3;
        const y = sy + (hd.y - sy) * e;
        for (let j = 1; j <= 3; j++) drawGlow(ctx, hd.x, y - j * g.R * 0.09, g.R * 0.08 * (1 - j * 0.2), [255, 220, 150], 0.4 * (1 - j * 0.25));
        drawGlow(ctx, hd.x, y - g.R * 0.03, g.R * 0.18, [255, 220, 140], 0.7);
        drawFlame(ctx, hd.x, y + g.R * 0.02, g.R * 0.08, g.R * 0.18, L.t * 1.4, 1, SPIRIT, 0, f.seed);
      } else if (f.state === 'pass' && f.from >= 0) {
        const a = head(f.from), k = f.k;
        const x = a.x + (hd.x - a.x) * k, y = a.y + (hd.y - a.y) * k - Math.sin(k * Math.PI) * g.R * 0.35;
        drawGlow(ctx, x, y, g.R * 0.16, [255, 214, 130], 0.8);
        drawFlame(ctx, x, y + g.R * 0.03, g.R * 0.06, g.R * 0.14, L.t * 2, 1, SPIRIT, 0, f.seed);
      }
    }
  },
};

export const SCENES: readonly Scene[] = [ISKRA, SWIECA, OGNISKO, SLUP, GWIAZDA, MEGA, ZESLANIE];

/** The flame of a fire as a small icon (the ladder, the button): a palette per fire. */
export const ICON_PAL: readonly FlamePalette[] = [FIRE, CANDLE, FIRE, FIRE, SPIRIT, SPIRIT, SPIRIT];
