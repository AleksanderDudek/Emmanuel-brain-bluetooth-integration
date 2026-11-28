/**
 * Złota passa's stage (DESIGN.md §29, round 25, the film — builder P2): the geometry every place of the day is painted
 * in, the light of the hour indoors, and the small painted pieces the places share (a plastered wall, a window with
 * the sky and the view of its hour, the sun's patch through it, a lamp's pool, a plant, books, a person seen softly).
 *
 * A place is painted in **units** on a stage: x across (0 at the camera's vanishing point, the layout's `street.cx`),
 * y down (0 at the surface line — a table, a counter, a desk, the road's edge — which stands at the layout's `street.hy`,
 * just above the moment's card, so what stands on it is in sight over the card).  `u` px per unit: the strip over the
 * card is ~2.9 units high; a phone upright shows x ±2, a desk up to ±8, so every place keeps its heart within x ±1.6
 * and carries on to the sides.  The baked layers are larger than the canvas by `M` px on every side (the overscan the
 * camera moves in).
 */
import type { Age } from '../kit/ages';
import type { Layout } from './layout';
import { TAU, clamp01, glow, hash, lerp, lightAt, mixHex, rgbHex, rgba, type Light, type RGB } from './paint';

export type Ctx = CanvasRenderingContext2D;

export interface Stage {
  /** the canvas (CSS px) and the overscan on every side */
  w: number; h: number; M: number;
  /** the stage's origin on the canvas (CSS px, without the overscan) and px per unit */
  cx: number; hy: number; u: number;
  /** the units the baked canvas spans (overscan included) */
  x0: number; x1: number; y0: number; y1: number;
  /** the top of the strip over the card (units; the HUD above it) */
  top: number;
  /** (optional) the age group whose day this is: a few things in the places follow it */
  age?: Age;
}

/** The stage for a layout: the strip over the free card ~2.9 units high, never narrower than 15 units across. */
export function stageOf(l: Layout): Stage {
  const w = Math.max(1, l.w), h = Math.max(1, l.h);
  const cam = l.street ?? { cx: w / 2, hy: h * 0.5, f: 300 };
  const bandY = l.band?.y ?? 0;
  const strip = Math.max(40, cam.hy - bandY);
  const u = Math.max(8, strip / 2.9, w / 15);
  const M = Math.round(Math.max(w, h) * 0.07);
  return {
    w, h, M, cx: cam.cx, hy: cam.hy, u,
    x0: (-M - cam.cx) / u, x1: (w + M - cam.cx) / u, y0: (-M - cam.hy) / u, y1: (h + M - cam.hy) / u,
    top: (bandY - cam.hy) / u,
  };
}

// ── the light of the hour indoors ─────────────────────────────────

export interface Room {
  Lt: Light;
  day: number;
  /** the ambient light indoors (multiplies a surface), the sun's colour and how much of it comes in (0..1) */
  amb: RGB;
  sun: RGB;
  sunK: number;
  /** the room's lamps 0..1 (on at dawn and from dusk), the night 0..1 */
  lamp: number;
  night: number;
}

/**
 * The light in a room at a moment of the day: daylight from its windows (a little warm), the sun coming in most at
 * the hour `face` (0.15 an east window in the morning … 0.7 a west one in the afternoon), the lamps' warmth at dawn
 * and from dusk on.
 */
export function roomAt(day: number, face = 0.3): Room {
  const d = clamp01(day);
  const Lt = lightAt(d);
  const night = clamp01((Lt.dusk - 0.15) / 0.75);
  const dayAmb: RGB = [
    lerp(Lt.amb[0], 0.92, 0.38) * (0.82 + 0.18 * (1 - Lt.dusk)),
    lerp(Lt.amb[1], 0.88, 0.38) * (0.82 + 0.18 * (1 - Lt.dusk)),
    lerp(Lt.amb[2], 0.82, 0.38) * (0.82 + 0.18 * (1 - Lt.dusk)),
  ];
  const lampAmb: RGB = [0.62, 0.5, 0.4];
  const lamp = clamp01(Lt.lamps);
  const k = night * 0.85;
  const amb: RGB = [lerp(dayAmb[0], lampAmb[0], k), lerp(dayAmb[1], lampAmb[1], k), lerp(dayAmb[2], lampAmb[2], k)];
  const dt = (d - face) / 0.24;
  const sunK = clamp01(Lt.sunI * Math.exp(-dt * dt) * (1 - Lt.dusk) * 1.1);
  return { Lt, day: d, amb, sun: Lt.sun, sunK, lamp, night };
}

/** A surface's colour in the room: its base × the ambient, plus the sun where `lit` (0..1) of it falls on it. */
export function tone(base: string, R: Room, lit = 0, warm = 0): string {
  const c = base.startsWith('#') ? base : '#808080';
  const v = parseInt(c.slice(1, 7), 16);
  const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
  const s = Math.max(0, lit) * R.sunK * 0.75;
  const wk = warm * R.lamp * 0.35;
  return rgbHex([
    255 * r * (R.amb[0] + (R.sun[0] / 255) * s + wk),
    255 * g * (R.amb[1] + (R.sun[1] / 255) * s + wk * 0.8),
    255 * b * (R.amb[2] + (R.sun[2] / 255) * s + wk * 0.5),
  ]);
}

// ── small helpers ────────────────────────────────────────────────

export function rect(c: Ctx, x: number, y: number, w: number, h: number, col: string | CanvasGradient): void {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

export function ell(c: Ctx, x: number, y: number, rx: number, ry: number, col: string | CanvasGradient, rot = 0): void {
  c.fillStyle = col;
  c.beginPath();
  c.ellipse(x, y, Math.max(1e-4, rx), Math.max(1e-4, ry), rot, 0, TAU);
  c.fill();
}

export function poly(c: Ctx, pts: readonly number[], col: string | CanvasGradient): void {
  c.fillStyle = col;
  c.beginPath();
  for (let i = 0; i < pts.length; i += 2) {
    if (i) c.lineTo(pts[i], pts[i + 1]); else c.moveTo(pts[i], pts[i + 1]);
  }
  c.closePath();
  c.fill();
}

/** A vertical gradient fill of a rectangle (top colour → bottom colour). */
export function vgrad(c: Ctx, x: number, y: number, w: number, h: number, top: string, bot: string): void {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, top);
  g.addColorStop(1, bot);
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
}

/** A soft contact shadow under something (an ellipse fading out). */
export function shadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28): void {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, rgba('#1a120c', a));
  g.addColorStop(1, rgba('#1a120c', 0));
  c.save();
  c.translate(x, y);
  c.scale(1, ry / Math.max(1e-4, rx));
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rx, 0, TAU);
  c.fill();
  c.restore();
}

/** A warm light's glow in units (additive inside). */
export function lightGlow(c: Ctx, x: number, y: number, r: number, a: number, col = '#ffd59a'): void {
  if (a <= 0.005) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, col, x, y, r, a);
  c.restore();
}

/** The plaster of a wall across the stage (a gentle vertical gradient, darker near the ceiling and the floor). */
export function wall(c: Ctx, S: Stage, R: Room, base: string, y0: number, y1: number, x0 = S.x0, x1 = S.x1): void {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, tone(mixHex(base, '#000000', 0.12), R));
  g.addColorStop(0.45, tone(base, R, 0.2));
  g.addColorStop(1, tone(mixHex(base, '#3a2a20', 0.1), R));
  c.fillStyle = g;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/** A floor of boards or tiles from the surface line down (a perspective of soft stripes). */
export function floor(c: Ctx, S: Stage, R: Room, base: string, y0: number, kind: 'boards' | 'tiles' | 'rug' = 'boards'): void {
  const y1 = S.y1;
  vgrad(c, S.x0, y0, S.x1 - S.x0, y1 - y0, tone(mixHex(base, '#000000', 0.18), R), tone(base, R, 0.15));
  c.strokeStyle = rgba('#2a1c12', 0.16);
  c.lineWidth = 0.015;
  if (kind === 'boards') {
    for (let i = -24; i <= 24; i++) {
      const xb = i * 0.55;
      c.beginPath();
      c.moveTo(xb * 0.35, y0);
      c.lineTo(xb * 1.6, y1);
      c.stroke();
    }
  } else if (kind === 'tiles') {
    for (let i = -24; i <= 24; i++) {
      c.beginPath();
      c.moveTo(i * 0.25, y0);
      c.lineTo(i * 1.1, y1);
      c.stroke();
    }
    for (let j = 1; j < 8; j++) {
      const y = y0 + (y1 - y0) * (j / 8) ** 1.6;
      c.beginPath();
      c.moveTo(S.x0, y);
      c.lineTo(S.x1, y);
      c.stroke();
    }
  }
}

export type View = 'roofs' | 'trees' | 'city' | 'garden' | 'field';

/**
 * The world through a window (in its rectangle, units): the sky of the hour (its sun, its stars), and a view — the
 * roofs across the street with their chimneys and, at night, their lit windows; trees; a city's towers; a garden.
 */
export function windowView(c: Ctx, R: Room, x0: number, y0: number, x1: number, y1: number, view: View, seed = 1): void {
  const Lt = R.Lt;
  const w = x1 - x0, h = y1 - y0;
  c.save();
  c.beginPath();
  c.rect(x0, y0, w, h);
  c.clip();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgbHex(Lt.top));
  g.addColorStop(0.6, rgbHex(Lt.mid));
  g.addColorStop(1, rgbHex(Lt.hor));
  c.fillStyle = g;
  c.fillRect(x0, y0, w, h);
  // stars at night
  if (Lt.stars > 0.05) {
    c.fillStyle = rgba('#fff6e4', Lt.stars * 0.9);
    for (let i = 0; i < 14; i++) {
      const sx = x0 + w * hash(seed * 31 + i), sy = y0 + h * 0.6 * hash(seed * 17 + i * 3);
      c.beginPath();
      c.arc(sx, sy, 0.012 + 0.012 * hash(i + seed), 0, TAU);
      c.fill();
    }
  }
  // a soft cloud or two by day
  if (Lt.dusk < 0.7) {
    c.fillStyle = rgba(mixHex(rgbHex(Lt.hor), '#ffffff', 0.6), 0.5 * (1 - Lt.dusk));
    for (let i = 0; i < 2; i++) {
      const cx = x0 + w * (0.2 + 0.6 * hash(seed + i * 7)), cy = y0 + h * (0.18 + 0.2 * hash(seed * 3 + i));
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.ellipse(cx + (k - 1.5) * w * 0.07, cy - Math.sin((k / 3) * Math.PI) * h * 0.03, w * 0.08, h * 0.035, 0, 0, TAU);
        c.fill();
      }
    }
  }
  // the low sun's warm light at the window's lower part (morning and evening)
  if (R.sunK > 0.05 || (Lt.dusk > 0.1 && Lt.dusk < 0.8)) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, rgbHex(Lt.hor), x0 + w * 0.5, y1, w * 0.7, 0.35 * Math.max(R.sunK, Lt.dusk < 0.8 ? Lt.dusk * 0.6 : 0), 0.6);
    c.restore();
  }
  const far = mixHex(rgbHex(Lt.hor), rgbHex(Lt.mid), 0.45);
  const lit = (i: number): boolean => Lt.dusk > 0.45 && hash(seed * 13 + i) < 0.55 * Lt.dusk;
  if (view === 'roofs' || view === 'city') {
    const n = view === 'city' ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const bx = x0 + w * (i / n) - w * 0.05, bw = w / n + w * 0.08;
      const bh = h * (view === 'city' ? 0.35 + 0.45 * hash(seed * 7 + i) : 0.25 + 0.2 * hash(seed * 7 + i));
      const by = y1 - bh;
      const col = mixHex(mixHex(far, '#4a4652', 0.35 + 0.15 * hash(i + seed)), '#0e1226', Lt.dusk * 0.55);
      c.fillStyle = col;
      if (view === 'roofs') {
        c.beginPath();
        c.moveTo(bx, y1); c.lineTo(bx, by + h * 0.06); c.lineTo(bx + bw / 2, by - h * 0.06); c.lineTo(bx + bw, by + h * 0.06); c.lineTo(bx + bw, y1);
        c.closePath();
        c.fill();
        c.fillRect(bx + bw * 0.68, by - h * 0.08, bw * 0.08, h * 0.08);
      } else c.fillRect(bx, by, bw * 0.86, bh);
      // windows
      const rows = view === 'city' ? 6 : 2, cols = 3;
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const wx = bx + bw * (0.18 + q * 0.24), wy = by + h * 0.1 + r * h * 0.075;
          if (wy > y1 - h * 0.04) continue;
          const on = lit(i * 31 + r * 7 + q);
          c.fillStyle = on ? '#ffd58a' : rgba('#ffffff', 0.08 + 0.1 * (1 - Lt.dusk));
          c.fillRect(wx, wy, bw * 0.1, h * 0.04);
        }
      }
    }
  } else if (view === 'trees' || view === 'garden' || view === 'field') {
    const ground = mixHex('#6f9a5a', '#0e1a20', Lt.dusk * 0.75);
    c.fillStyle = mixHex(ground, far, 0.3);
    c.beginPath();
    c.moveTo(x0, y1);
    for (let i = 0; i <= 8; i++) c.lineTo(x0 + (w * i) / 8, y1 - h * (0.18 + 0.06 * Math.sin(i * 1.7 + seed)));
    c.lineTo(x1, y1);
    c.closePath();
    c.fill();
    const nT = view === 'field' ? 2 : 4;
    for (let i = 0; i < nT; i++) {
      const tx = x0 + w * (0.12 + 0.76 * hash(seed * 5 + i)), tr = h * (0.14 + 0.08 * hash(seed + i * 3));
      const ty = y1 - h * 0.2 - tr * 0.8;
      const col = mixHex(mixHex('#4f7a44', far, 0.25 + 0.2 * hash(i)), '#0c1418', Lt.dusk * 0.8);
      c.fillStyle = col;
      c.fillRect(tx - tr * 0.08, ty, tr * 0.16, tr * 1.6);
      c.beginPath();
      c.arc(tx, ty, tr, 0, TAU);
      c.arc(tx - tr * 0.6, ty + tr * 0.3, tr * 0.7, 0, TAU);
      c.arc(tx + tr * 0.6, ty + tr * 0.3, tr * 0.7, 0, TAU);
      c.fill();
    }
  }
  c.restore();
}

/**
 * A window in a wall (units): the view, the frame with its cross bars, the sill, the wall's reveal; `curtains` hang at
 * its sides (drawn by the caller on the front layer if they should move with it).
 */
export function windowIn(c: Ctx, R: Room, x0: number, y0: number, x1: number, y1: number, view: View, frame = '#f4ede0', seed = 1, bars = 2): void {
  const w = x1 - x0, h = y1 - y0;
  const fr = Math.min(w, h) * 0.06;
  // the reveal (the wall's depth) and the view
  rect(c, x0 - fr * 0.8, y0 - fr * 0.8, w + fr * 1.6, h + fr * 1.6, tone(mixHex(frame, '#7a6a5a', 0.3), R));
  windowView(c, R, x0, y0, x1, y1, view, seed);
  // the glass's sheen
  c.save();
  c.globalCompositeOperation = 'lighter';
  const sh = c.createLinearGradient(x0, y0, x1, y1);
  sh.addColorStop(0, rgba('#ffffff', 0.1 * (1 - R.night)));
  sh.addColorStop(0.5, rgba('#ffffff', 0));
  sh.addColorStop(0.62, rgba('#ffffff', 0.06 * (1 - R.night)));
  sh.addColorStop(1, rgba('#ffffff', 0));
  c.fillStyle = sh;
  c.fillRect(x0, y0, w, h);
  c.restore();
  // the frame and its bars
  const fc = tone(frame, R, 0.3);
  c.strokeStyle = fc;
  c.lineWidth = fr;
  c.strokeRect(x0, y0, w, h);
  c.lineWidth = fr * 0.6;
  c.beginPath();
  if (bars >= 1) { c.moveTo(x0 + w / 2, y0); c.lineTo(x0 + w / 2, y1); }
  if (bars >= 2) { c.moveTo(x0, y0 + h * 0.38); c.lineTo(x1, y0 + h * 0.38); }
  c.stroke();
  // the sill
  rect(c, x0 - fr * 1.6, y1 + fr * 0.4, w + fr * 3.2, fr * 1.1, tone(mixHex(frame, '#ffffff', 0.2), R, 0.6));
  rect(c, x0 - fr * 1.6, y1 + fr * 1.5, w + fr * 3.2, fr * 0.35, rgba('#2a1c12', 0.18));
}

/**
 * The sun's patch through a window on the wall below/beside it (a soft warm parallelogram, additive) — it slides with
 * the hour; nothing when the sun is not in.
 */
export function sunPatch(c: Ctx, R: Room, x0: number, y0: number, x1: number, y1: number, dx: number, dy: number): void {
  if (R.sunK < 0.03) return;
  const a = 0.16 * R.sunK;
  const col = rgbHex(R.sun);
  c.save();
  c.globalCompositeOperation = 'lighter';
  // the window's shape thrown on the wall, soft at its edges (three passes, each a little larger and fainter)
  for (let k = 0; k < 3; k++) {
    const g = k * 0.05;
    const grad = c.createLinearGradient(x0 + dx, y0 + dy, x0 + dx * 1.6, y1 + dy * 1.3);
    grad.addColorStop(0, rgba(col, a * (k === 0 ? 1 : 0.45)));
    grad.addColorStop(1, rgba(col, a * 0.25));
    c.fillStyle = grad;
    c.beginPath();
    c.moveTo(x0 + dx - g, y0 + dy - g);
    c.lineTo(x1 + dx + g, y0 + dy - g);
    c.lineTo(x1 + dx * 1.6 + g, y1 + dy * 1.3 + g);
    c.lineTo(x0 + dx * 1.6 - g, y1 + dy * 1.3 + g);
    c.closePath();
    c.fill();
  }
  // the window's cross bars' shadows in it
  c.globalCompositeOperation = 'source-over';
  c.strokeStyle = rgba('#3a2a20', 0.06 * R.sunK);
  c.lineWidth = Math.min(x1 - x0, y1 - y0) * 0.04;
  c.beginPath();
  c.moveTo((x0 + x1) / 2 + dx, y0 + dy); c.lineTo((x0 + x1) / 2 + dx * 1.6, y1 + dy * 1.3);
  c.stroke();
  c.globalCompositeOperation = 'lighter';
  glow(c, col, (x0 + x1) / 2 + dx * 1.3, (y0 + y1) / 2 + dy, (x1 - x0) * 1.3, a * 0.7, 0.7);
  c.restore();
}

/** A beam of light through the air from a window (a few soft bands), for a morning room. */
export function beam(c: Ctx, R: Room, x: number, y: number, w: number, len: number, ang: number): void {
  if (R.sunK < 0.05) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  c.translate(x, y);
  c.rotate(ang);
  const g = c.createLinearGradient(0, 0, 0, len);
  g.addColorStop(0, rgba(rgbHex(R.sun), 0.14 * R.sunK));
  g.addColorStop(1, rgba(rgbHex(R.sun), 0));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(-w / 2, 0); c.lineTo(w / 2, 0); c.lineTo(w * 0.9, len); c.lineTo(-w * 0.9, len);
  c.closePath();
  c.fill();
  c.restore();
}

/** A pendant or table lamp's warm light (its shade is the caller's); `on` 0..1. */
export function lampLight(c: Ctx, x: number, y: number, r: number, on: number): void {
  if (on <= 0.02) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffc878', x, y, r * 3.2, 0.32 * on);
  glow(c, '#ffe2b0', x, y, r * 1.1, 0.7 * on);
  c.restore();
}

/** A potted plant (units: its pot's centre-bottom at x, y; size s). */
export function plant(c: Ctx, R: Room, x: number, y: number, s: number, pot = '#c8774e', leaf = '#5f9a5a', seed = 1): void {
  shadow(c, x, y, s * 0.42, s * 0.08, 0.25);
  // leaves behind
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.38 + (hash(seed + i) - 0.5) * 0.2;
    const len = s * (0.55 + 0.35 * hash(seed * 3 + i));
    const ex = x + Math.cos(a) * len, ey = y - s * 0.4 + Math.sin(a) * len;
    const col = tone(mixHex(leaf, i % 2 ? '#2f5a34' : '#9acb7a', 0.25), R, 0.5);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x, y - s * 0.4);
    c.quadraticCurveTo(x + Math.cos(a - 0.5) * len * 0.6, y - s * 0.4 + Math.sin(a - 0.5) * len * 0.6, ex, ey);
    c.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.6, y - s * 0.4 + Math.sin(a + 0.5) * len * 0.6, x, y - s * 0.4);
    c.fill();
  }
  // the pot
  const g = c.createLinearGradient(x - s * 0.3, 0, x + s * 0.3, 0);
  g.addColorStop(0, tone(mixHex(pot, '#ffffff', 0.15), R, 0.6));
  g.addColorStop(1, tone(mixHex(pot, '#000000', 0.25), R));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - s * 0.3, y - s * 0.42);
  c.lineTo(x + s * 0.3, y - s * 0.42);
  c.lineTo(x + s * 0.22, y);
  c.lineTo(x - s * 0.22, y);
  c.closePath();
  c.fill();
  rect(c, x - s * 0.33, y - s * 0.46, s * 0.66, s * 0.07, tone(mixHex(pot, '#ffffff', 0.25), R, 0.6));
}

/** A row of book spines on a shelf from x0 to x1 (their feet on y), heights about h. */
export function books(c: Ctx, R: Room, x0: number, x1: number, y: number, h: number, seed = 1): void {
  const cols = ['#b5523f', '#3f6a8a', '#d8a84a', '#5a8a5a', '#8a5a7a', '#e8d8b8', '#4a4a6a', '#c87a4a'];
  let x = x0;
  let i = 0;
  while (x < x1 - 0.02) {
    const bw = h * (0.12 + 0.1 * hash(seed * 11 + i));
    const bh = h * (0.72 + 0.28 * hash(seed * 7 + i));
    const lean = hash(seed + i * 5) < 0.08 ? 0.18 : 0;
    const col = cols[Math.floor(hash(seed * 3 + i) * cols.length)];
    c.save();
    c.translate(x, y);
    c.rotate(lean);
    rect(c, 0, -bh, Math.min(bw, x1 - x), bh, tone(col, R, 0.3));
    rect(c, 0, -bh * 0.82, Math.min(bw, x1 - x), bh * 0.05, rgba('#ffffff', 0.22));
    rect(c, 0, -bh * 0.2, Math.min(bw, x1 - x), bh * 0.04, rgba('#000000', 0.15));
    c.restore();
    x += bw + h * 0.01 + (lean ? bh * 0.2 : 0);
    i++;
  }
}

/** A framed picture on the wall (a small landscape in its frame). */
export function picture(c: Ctx, R: Room, x: number, y: number, w: number, h: number, seed = 1): void {
  shadow(c, x + w * 0.52, y + h * 0.55, w * 0.62, h * 0.6, 0.14);
  rect(c, x - w * 0.06, y - h * 0.06, w * 1.12, h * 1.12, tone('#8a6a4a', R, 0.3));
  rect(c, x, y, w, h, tone('#f2ead8', R, 0.3));
  const sky = c.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, tone('#9cc4e4', R, 0.3));
  sky.addColorStop(1, tone('#f6dcb0', R, 0.3));
  c.fillStyle = sky;
  c.fillRect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8);
  c.fillStyle = tone(hash(seed) < 0.5 ? '#6a9a5a' : '#7a8ab8', R, 0.3);
  c.beginPath();
  c.moveTo(x + w * 0.1, y + h * 0.9);
  c.lineTo(x + w * 0.1, y + h * 0.62);
  c.quadraticCurveTo(x + w * 0.4, y + h * 0.42, x + w * 0.6, y + h * 0.6);
  c.quadraticCurveTo(x + w * 0.75, y + h * 0.5, x + w * 0.9, y + h * 0.58);
  c.lineTo(x + w * 0.9, y + h * 0.9);
  c.closePath();
  c.fill();
  ell(c, x + w * 0.7, y + h * 0.3, w * 0.07, w * 0.07, tone('#ffd890', R, 0.3));
}

/** A clock on the wall (its hands at the hour of the day: 6 at dawn … 22 at night). */
export function wallClock(c: Ctx, R: Room, x: number, y: number, r: number): void {
  shadow(c, x + r * 0.08, y + r * 0.12, r * 1.15, r * 1.15, 0.16);
  ell(c, x, y, r, r, tone('#3a3430', R));
  ell(c, x, y, r * 0.86, r * 0.86, tone('#fbf6ea', R, 0.4));
  c.strokeStyle = tone('#3a3430', R);
  c.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    c.lineWidth = r * (i % 3 ? 0.04 : 0.08);
    c.beginPath();
    c.moveTo(x + Math.cos(a) * r * 0.66, y + Math.sin(a) * r * 0.66);
    c.lineTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
    c.stroke();
  }
  const hour = 6 + R.day * 16;
  const ha = ((hour % 12) / 12) * TAU - Math.PI / 2, ma = ((hour % 1) * TAU) - Math.PI / 2;
  c.lineWidth = r * 0.09;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ha) * r * 0.45, y + Math.sin(ha) * r * 0.45); c.stroke();
  c.lineWidth = r * 0.06;
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ma) * r * 0.68, y + Math.sin(ma) * r * 0.68); c.stroke();
  ell(c, x, y, r * 0.07, r * 0.07, tone('#c9573a', R));
}

/** A light switch on the wall (lit a little when the room's lamp is on). */
export function lightSwitch(c: Ctx, R: Room, x: number, y: number, s: number): void {
  rect(c, x - s * 0.5 + s * 0.06, y - s * 0.5 + s * 0.08, s, s, rgba('#1a120c', 0.15));
  c.fillStyle = tone('#f6f2ea', R, 0.4);
  rrect(c, x - s * 0.5, y - s * 0.5, s, s, s * 0.12);
  c.fill();
  c.fillStyle = tone('#e4ded2', R, 0.3);
  rrect(c, x - s * 0.18, y - s * 0.3, s * 0.36, s * 0.6, s * 0.08);
  c.fill();
  rect(c, x - s * 0.18, y - s * 0.3 + (R.lamp > 0.5 ? s * 0.32 : 0), s * 0.36, s * 0.28, tone('#d2cabc', R));
}

/**
 * A person seen softly (units), `h` tall when standing: feet at (x, y) — or, sitting (`sit`), only the head and the
 * upper body down to the line y (a table's, a desk's, a seat back's).  From the front or the back; a coat's colour and
 * the hair's.  Never a face's features: a calm presence.
 */
export function person(c: Ctx, R: Room, x: number, y: number, h: number, coat: string, hair = '#3a2a22', o: { sit?: boolean; back?: boolean; skin?: string; alpha?: number; stride?: number } = {}): void {
  const k = h / 1.7;
  const skin = o.skin ?? '#d9a888';
  c.save();
  if (o.alpha != null) c.globalAlpha *= clamp01(o.alpha);
  const top = o.sit ? y - k * 0.98 : y - h;
  if (!o.sit) {
    c.strokeStyle = tone('#2e2a30', R);
    c.lineCap = 'round';
    c.lineWidth = k * 0.13;
    const sw = (o.stride ?? 0) * k * 0.16;
    c.beginPath();
    c.moveTo(x - k * 0.07, y - k * 0.85); c.lineTo(x - k * 0.08 + sw, y - k * 0.05);
    c.moveTo(x + k * 0.07, y - k * 0.85); c.lineTo(x + k * 0.08 - sw, y - k * 0.05);
    c.stroke();
  }
  // the body: shoulders, a soft coat narrowing a little, the arms' shade at its sides
  const sh = top + k * 0.34, bb = o.sit ? y + 0.02 : y - k * 0.8;
  const g = c.createLinearGradient(x - k * 0.3, 0, x + k * 0.3, 0);
  g.addColorStop(0, tone(mixHex(coat, '#ffffff', 0.14), R, 0.5));
  g.addColorStop(0.55, tone(coat, R, 0.3));
  g.addColorStop(1, tone(mixHex(coat, '#000000', 0.25), R));
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - k * 0.08, sh - k * 0.03);
  c.quadraticCurveTo(x - k * 0.27, sh - k * 0.01, x - k * 0.29, sh + k * 0.12);
  c.lineTo(x - k * 0.26, bb);
  c.lineTo(x + k * 0.26, bb);
  c.lineTo(x + k * 0.29, sh + k * 0.12);
  c.quadraticCurveTo(x + k * 0.27, sh - k * 0.01, x + k * 0.08, sh - k * 0.03);
  c.closePath();
  c.fill();
  c.strokeStyle = rgba('#000000', 0.12);
  c.lineWidth = k * 0.02;
  c.beginPath(); c.moveTo(x - k * 0.2, sh + k * 0.14); c.lineTo(x - k * 0.19, bb); c.moveTo(x + k * 0.2, sh + k * 0.14); c.lineTo(x + k * 0.19, bb); c.stroke();
  // the neck, the head, the hair
  rect(c, x - k * 0.045, sh - k * 0.09, k * 0.09, k * 0.08, tone(skin, R, 0.2));
  const hy = top + k * 0.16;
  ell(c, x, hy, k * 0.115, k * 0.135, tone(o.back ? hair : skin, R, 0.4));
  c.fillStyle = tone(hair, R, 0.2);
  c.beginPath();
  if (o.back) c.ellipse(x, hy - k * 0.005, k * 0.125, k * 0.145, 0, 0, TAU);
  else {
    c.ellipse(x, hy - k * 0.045, k * 0.125, k * 0.1, 0, Math.PI, TAU);
    c.ellipse(x - k * 0.1, hy, k * 0.03, k * 0.06, 0, 0, TAU);
    c.ellipse(x + k * 0.1, hy, k * 0.03, k * 0.06, 0, 0, TAU);
  }
  c.fill();
  // a soft light on the cheek's side
  if (!o.back) ell(c, x - k * 0.04, hy + k * 0.02, k * 0.05, k * 0.07, rgba('#ffffff', 0.08));
  c.restore();
}

/** A soft dark vignette at a layer's edges (baked into the front layer of interiors). */
export function vignette(c: Ctx, S: Stage, a = 0.22): void {
  const cx = 0, cy = (S.top + 0) / 2;
  const r0 = (S.x1 - S.x0) * 0.32, r1 = Math.hypot(S.x1 - S.x0, S.y1 - S.y0) * 0.62;
  const g = c.createRadialGradient(cx, cy, r0, cx, cy, r1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, rgba('#0a0608', a));
  c.fillStyle = g;
  c.fillRect(S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0);
}

/**
 * People passing (live): `n` walkers along a lane (units: feet on y, `h` tall) between x0 and x1, each at its own pace
 * and way, fading in and out at the lane's ends; clipped to `clip` (a window) when given.
 */
export function walkers(c: Ctx, R: Room, t: number, o: { y: number; h: number; x0: number; x1: number; n: number; speed: number; seed: number; clip?: readonly [number, number, number, number]; coats?: readonly string[]; alpha?: number }): void {
  if (t === 0) return;
  const coats = o.coats ?? ['#4a5a7a', '#8a4a3a', '#5a6a4a', '#7a5a8a', '#c88a4a', '#3a4a5a'];
  const span = o.x1 - o.x0;
  c.save();
  if (o.clip) {
    c.beginPath();
    c.rect(o.clip[0], o.clip[1], o.clip[2] - o.clip[0], o.clip[3] - o.clip[1]);
    c.clip();
  }
  for (let i = 0; i < o.n; i++) {
    const dir = hash(o.seed * 7 + i) < 0.5 ? 1 : -1;
    const per = (span / o.speed) * (0.8 + 0.5 * hash(o.seed * 3 + i));
    const rest = per * (0.3 + 0.6 * hash(o.seed * 11 + i));
    const cyc = per + rest;
    const ph = ((t + cyc * hash(o.seed * 5 + i)) % cyc) / per;
    if (ph > 1) continue;
    const x = dir > 0 ? o.x0 + span * ph : o.x1 - span * ph;
    const fade = Math.min(1, ph * 6, (1 - ph) * 6);
    const hh = o.h * (0.9 + 0.2 * hash(o.seed + i * 13));
    const bob = Math.abs(Math.sin(t * 5.4 + i)) * hh * 0.012;
    person(c, R, x, o.y - bob, hh, coats[(o.seed + i) % coats.length], hash(i * 3 + o.seed) < 0.5 ? '#3a2a22' : '#c8a06a', { alpha: fade * (o.alpha ?? 0.9), stride: Math.sin(t * 5.4 + i) });
  }
  c.restore();
}
