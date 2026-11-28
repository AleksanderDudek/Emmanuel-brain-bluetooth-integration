/**
 * Dobry bój through the boxer's eyes (DESIGN.md §29): the hall and the ring seen from inside it — what stands behind
 * the opponent.  The hall is baked once per size and style as a wide panorama (the dark, the far wall's warm spill,
 * the lamps high up with their shafts of light through the haze, the crowd on its tiers rising behind the far ropes),
 * slid sideways as the pair circles; the crowd's small lights twinkle live over it.  The ring is drawn live in true
 * perspective each frame: the canvas (or the cage's mat) with the light's pool, the ropes (blue, white, white, red)
 * running to the far corner's padded post and toward the eye on both sides, or the cage's mesh between its padded posts;
 * dust hanging in the light (still in the slow motion).
 *
 * The ring's place: its centre (cx, cz) in the player's frame and its turn `psi` — the fighters stand in its middle;
 * `psi` ≈ 0.55 puts a far corner a little to the left of the opponent, π/4 puts it straight behind them (the corners).
 */
import type { Style } from './moves';
import { C, TAU, clamp01, glow, hash, layer, rgba } from './paint';
import { NEAR, camSpace, camToScreen, project, type FCam, type SP } from './fpaint';

export interface RingGeo { cx: number; cz: number; psi: number }

/** The ring's half side inside the ropes, the canvas beyond them, the cage's radius (units of a standing height). */
export const FP_RING = { half: 1.6, apron: 0.28, cage: 1.75, ropes: [0.26, 0.45, 0.64, 0.83] as const, fence: 1.0 };

/** The eye's height the hall is baked for (the guard's eyes). */
export const EYE = 0.89;

/** A point of the ring (ring axes: rx, rz about its centre, turned by psi) in the player's frame. */
export function ringPoint(g: RingGeo, rx: number, y: number, rz: number): [number, number, number] {
  const c = Math.cos(g.psi), s = Math.sin(g.psi);
  return [g.cx + rx * c - rz * s, y, g.cz + rx * s + rz * c];
}

/** A polygon on the floor (world points), clipped to what is in front of the camera, on the screen. */
function floorPoly(cam: FCam, pts: [number, number, number][]): SP[] {
  const cs = pts.map(p => camSpace(cam, p[0], p[1], p[2]));
  const out: [number, number, number][] = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    const ina = a[2] >= NEAR, inb = b[2] >= NEAR;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  return out.map(p => camToScreen(cam, p[0], p[1], p[2]));
}

/** A segment in the world, clipped to the camera's near plane, on the screen (null: wholly behind). */
function segment(cam: FCam, a: [number, number, number], b: [number, number, number]): [SP, SP] | null {
  let p = camSpace(cam, a[0], a[1], a[2]), q = camSpace(cam, b[0], b[1], b[2]);
  if (p[2] < NEAR && q[2] < NEAR) return null;
  if (p[2] < NEAR || q[2] < NEAR) {
    const t = (NEAR - p[2]) / (q[2] - p[2]);
    const m: [number, number, number] = [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, NEAR];
    if (p[2] < NEAR) p = m; else q = m;
  }
  return [camToScreen(cam, p[0], p[1], p[2]), camToScreen(cam, q[0], q[1], q[2])];
}

// ── the hall: a baked panorama ───────────────────────────────────────────────────────────

interface Pano { key: string; c: HTMLCanvasElement | null; m: number; f: number; oy: number; lights: { x: number; y: number; r: number; warm: boolean; ph: number }[] }

export class FpHall {
  private p: Pano | null = null;

  /** Bake (once per size, style and lens) for a camera at rest: its focal length and horizon. */
  bake(w: number, h: number, dpr: number, style: Style, f: number, ox: number, oy: number): void {
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${style}|${Math.round(f)}|${Math.round(ox)}|${Math.round(oy)}`;
    if (this.p?.key === key) return;
    // room to slide: the ring turns at most ~0.24 rad from its usual place (the circling, the corners)
    const m = Math.round(Math.min(0.27 * f, 700));
    const L = layer(w + 2 * m, h, Math.min(dpr, 2));
    const lights: Pano['lights'] = [];
    if (L) paintPano(L.ctx, w + 2 * m, h, ox + m, oy, f, style, lights);
    else paintLightsOnly(w + 2 * m, ox + m, oy, f, lights);
    this.p = { key, c: L?.c ?? null, m, f, oy, lights };
  }

  /** Draw the panorama slid by `shift` px (the ring's turn), raised by `lift` px (the eye going down), tilted by the roll. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, cam: FCam, shift: number, lift: number): void {
    const p = this.p;
    if (!p) return;
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    ctx.rotate(cam.roll);
    ctx.translate(-cam.ox, -cam.oy);
    const pad = Math.abs(cam.roll) * w * 0.6 + 4;
    const sx = -p.m + Math.max(-p.m + pad, Math.min(p.m - pad, shift));
    const sy = lift + (cam.oy - p.oy) + cam.f * Math.tan(cam.pitch);
    if (p.c) {
      // a hair of overscan so the tilt never shows the edge
      const k = 1 + Math.abs(cam.roll) * 0.9;
      ctx.translate(w / 2, h / 2);
      ctx.scale(k, k);
      ctx.translate(-w / 2, -h / 2);
      ctx.drawImage(p.c, sx, sy, w + 2 * p.m, h);
    } else {
      ctx.fillStyle = C.hall;
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }
    ctx.restore();
  }

  /** The crowd's small lights (phones, warm and a few cool), twinkling with the mood: live over the bake. */
  lights(ctx: CanvasRenderingContext2D, cam: FCam, w: number, shift: number, lift: number, time: number, mood: number, reduced: boolean): void {
    const p = this.p;
    if (!p) return;
    const sx = -p.m + Math.max(-p.m, Math.min(p.m, shift));
    const n = Math.min(p.lights.length, 26 + Math.round(22 * clamp01(mood)));
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    ctx.rotate(cam.roll);
    ctx.translate(-cam.ox, -cam.oy);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const L = p.lights[i];
      const x = L.x + sx;
      if (x < -10 || x > w + 10) continue;
      const tw = reduced ? 0.7 : 0.5 + 0.5 * Math.sin(time * (0.6 + L.ph * 1.4) + i);
      glow(ctx, L.warm ? '#ffe2b0' : '#bcd8ff', x, L.y + lift + (cam.oy - p.oy) + cam.f * Math.tan(cam.pitch), L.r, (0.25 + 0.5 * clamp01(mood)) * tw);
    }
    ctx.restore();
  }
}

/** The rows of the crowd: distance, the heads' height above the ring's floor (tiers rising behind the far side). */
const ROWS = Array.from({ length: 9 }, (_, i) => ({ dist: 3.3 + 0.55 * i, y: 0.02 + 0.27 * i }));

function paintPano(ctx: CanvasRenderingContext2D, W: number, h: number, ox: number, oy: number, f: number, style: Style, lights: Pano['lights']): void {
  // the dark, a little warmer about the horizon where the ring's light spills on the far tiers
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#060508');
  g.addColorStop(clamp01((oy - f * 0.3) / h), '#0e0a0f');
  g.addColorStop(clamp01(oy / h), '#1d1419');
  g.addColorStop(1, '#120c10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
  const sp = ctx.createRadialGradient(ox, oy - f * 0.05, 0, ox, oy - f * 0.05, Math.max(W * 0.45, h));
  sp.addColorStop(0, rgba('#5a3a2c', 0.5));
  sp.addColorStop(0.45, rgba('#2a1a1c', 0.28));
  sp.addColorStop(1, rgba('#0a080c', 0));
  ctx.fillStyle = sp;
  ctx.fillRect(0, 0, W, h);
  // the lamps high over the far tiers and their shafts down through the haze toward the ring
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lampY = oy - f * 0.46;
  const nL = Math.max(5, Math.round(W / Math.max(120, f * 0.38)));
  for (let i = 0; i < nL; i++) {
    const x = (W * (i + 0.5)) / nL + (hash(i * 5) - 0.5) * f * 0.06;
    const toX = ox + (x - ox) * 0.25, toY = oy + f * 0.3;
    const sh = ctx.createLinearGradient(x, lampY, toX, toY);
    sh.addColorStop(0, rgba('#ffe7c4', 0.13));
    sh.addColorStop(1, rgba('#ffe7c4', 0));
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.moveTo(x - f * 0.012, lampY);
    ctx.lineTo(x + f * 0.012, lampY);
    ctx.lineTo(toX + f * 0.16, toY);
    ctx.lineTo(toX - f * 0.16, toY);
    ctx.closePath();
    ctx.fill();
    glow(ctx, '#fff0d0', x, lampY, Math.max(6, f * 0.035), 0.85);
    glow(ctx, '#ffd9a0', x, lampY, Math.max(14, f * 0.11), 0.22);
  }
  ctx.restore();
  // the crowd: far rows first, each a little lighter and rimmed by the ring's light toward the middle
  for (let ri = ROWS.length - 1; ri >= 0; ri--) {
    const r = ROWS[ri];
    const k = f / r.dist;
    const y = oy + (f * (EYE - r.y)) / r.dist;
    const hr = 0.052 * k;
    const shade = 1 - ri / ROWS.length;
    ctx.fillStyle = `rgb(${Math.round(20 + 20 * shade)},${Math.round(14 + 13 * shade)},${Math.round(20 + 14 * shade)})`;
    // the tier's front (the seats' backs), a low band in the dark
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, y + hr * 2.5, W, hr * 1.1);
    ctx.globalAlpha = 1;
    for (let i = 0, x = (hash(ri) - 0.5) * 0.2 * k; x < W + k * 0.3; i++, x += 0.21 * k * (0.85 + 0.3 * hash(i * 7 + ri * 131))) {
      const hh = hash(i * 13 + ri * 71);
      const py = y - hh * 0.05 * k;
      const hr2 = hr * (0.88 + 0.24 * hh);
      ctx.beginPath();
      ctx.ellipse(x, py + hr2 * 2.25, hr2 * 2.15, hr2 * 1.5, 0, Math.PI, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, py, hr2, 0, TAU);
      ctx.fill();
      const near = Math.max(0, 1 - Math.abs(x - ox) / (f * 1.1));
      if (near > 0.02) {
        ctx.strokeStyle = rgba('#d8a070', 0.06 + 0.3 * near * (0.6 + 0.4 * shade));
        ctx.lineWidth = Math.max(0.6, hr2 * 0.25);
        ctx.beginPath();
        ctx.arc(x, py, hr2 * 0.92, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      if (hash(i * 3 + ri * 17) > 0.86 && lights.length < 64) {
        lights.push({ x, y: py + hr2 * 0.8, r: Math.max(2.5, hr2 * 0.55), warm: hash(i * 41 + ri) > 0.25, ph: hash(i * 3 + ri * 5) });
      }
    }
  }
  // the barrier by the ring and the press tables' edge, in the dark below the first row
  const by = oy + (f * (EYE + 0.05)) / 3.0;
  ctx.fillStyle = '#0d0a0d';
  ctx.fillRect(0, by, W, h - by);
  ctx.fillStyle = rgba('#e9d2b0', 0.08);
  ctx.fillRect(0, by, W, Math.max(1, f * 0.004));
  // shuffle the lights so a calm crowd's few are spread across
  lights.sort((a, b) => hash(a.x * 0.13) - hash(b.x * 0.13));
  void style;
}

function paintLightsOnly(W: number, ox: number, oy: number, f: number, lights: Pano['lights']): void {
  for (let i = 0; i < 40; i++) lights.push({ x: hash(i * 7) * W, y: oy - f * 0.1 + hash(i * 11) * f * 0.3, r: 3, warm: hash(i) > 0.25, ph: hash(i * 5) });
  void ox;
}

// ── the ring, live ───────────────────────────────────────────────────────────────────────

/** The floor (the canvas and its apron, or the cage's mat) with the light's pool. */
export function fpFloor(ctx: CanvasRenderingContext2D, cam: FCam, g: RingGeo, style: Style, light: number): void {
  const boks = style === 'boks';
  const R = boks ? FP_RING.half + FP_RING.apron : FP_RING.cage + 0.05;
  const n = boks ? 4 : 8;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = boks ? Math.PI / 4 + (i * TAU) / 4 : Math.PI / 8 + (i * TAU) / 8;
    const rr = boks ? R * Math.SQRT2 : R / Math.cos(Math.PI / 8);
    pts.push(ringPoint(g, Math.cos(a) * rr, 0, Math.sin(a) * rr));
  }
  const poly = floorPoly(cam, pts);
  if (poly.length < 3) return;
  let top = Infinity, bot = -Infinity;
  for (const p of poly) { top = Math.min(top, p.y); bot = Math.max(bot, p.y); }
  ctx.save();
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  const fl = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, bot));
  if (boks) {
    fl.addColorStop(0, '#5d554c');
    fl.addColorStop(0.35, '#a99e8f');
    fl.addColorStop(1, '#8d8274');
  } else {
    fl.addColorStop(0, '#1c1d23');
    fl.addColorStop(0.4, '#363843');
    fl.addColorStop(1, '#2a2b33');
  }
  ctx.fillStyle = fl;
  ctx.fill();
  ctx.clip();
  // the light's pool about the ring's middle
  const c = project(cam, ...ringPoint(g, 0, 0, 0));
  if (c.d > NEAR) {
    const e1 = project(cam, ...ringPoint(g, 0, 0, -1.4));
    const ry = Math.max(8, Math.abs(c.y - e1.y) * 1.2 + c.k * 0.1), rx = c.k * 1.5;
    ctx.translate(c.x, c.y);
    ctx.scale(1, Math.min(1, ry / Math.max(1, rx)));
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    pool.addColorStop(0, rgba(boks ? '#fff3dc' : '#c8c0d8', 0.5 * light));
    pool.addColorStop(0.6, rgba(boks ? '#ffe2b8' : '#9a94b0', 0.16 * light));
    pool.addColorStop(1, rgba('#000000', 0));
    ctx.fillStyle = pool;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  }
  ctx.restore();
  if (!boks) {
    // the mat's painted circle, faint
    ctx.strokeStyle = rgba('#8a8ca0', 0.22);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let on = false;
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      const p = camSpace(cam, ...ringPoint(g, Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05));
      if (p[2] < NEAR) { on = false; continue; }
      const s = camToScreen(cam, p[0], p[1], p[2]);
      if (on) ctx.lineTo(s.x, s.y); else ctx.moveTo(s.x, s.y);
      on = true;
    }
    ctx.stroke();
  } else {
    // the canvas's edge, where the apron ends
    ctx.strokeStyle = rgba('#e9dcc8', 0.45);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const s = segment(cam, pts[i], pts[(i + 1) % 4]);
      if (!s) continue;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      ctx.lineTo(s[1].x, s[1].y);
      ctx.stroke();
    }
  }
}

/** The corner posts' colours: the far (the opponent's) corner red, the player's blue, the two neutral corners white. */
const POST_COL = ['#8a3a34', '#dcd6cc', '#34508a', '#dcd6cc'];

/** The ropes and the posts (boxing) or the cage's fence. */
export function fpRopes(ctx: CanvasRenderingContext2D, cam: FCam, g: RingGeo, style: Style, light: number): void {
  if (style === 'mma') { cage(ctx, cam, g, light); return; }
  const H = FP_RING.half;
  const corners: [number, number][] = [[H, -H], [H, H], [-H, H], [-H, -H]];
  // the posts behind the ropes
  corners.forEach(([x, z], i) => post(ctx, cam, ringPoint(g, x, 0, z), POST_COL[i], light));
  // the ropes: each side's four, sagging a little, thicker as they come near
  const N = 22;
  FP_RING.ropes.forEach((rh, ri) => {
    const col = ri === 3 ? '#a83f39' : ri === 0 ? '#3a4f86' : '#d6cdbf';
    for (let s = 0; s < 4; s++) {
      const a = corners[s], b = corners[(s + 1) % 4];
      const strip: SP[] = [];
      const flush = (): void => {
        if (strip.length >= 2) ropeStrip(ctx, strip, col, light);
        strip.length = 0;
      };
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const y = rh - 0.018 * Math.sin(Math.PI * u);
        const p = camSpace(cam, ...ringPoint(g, a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u));
        if (p[2] < NEAR * 1.5) { flush(); continue; }
        strip.push(camToScreen(cam, p[0], p[1], p[2]));
      }
      flush();
    }
  });
}

function ropeStrip(ctx: CanvasRenderingContext2D, pts: SP[], col: string, light: number): void {
  const L: [number, number][] = [], Rr: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const r = Math.max(0.7, Math.min(40, 0.0095 * pts[i].k));
    const nx = -dy / d, ny = dx / d;
    L.push([pts[i].x + nx * r, pts[i].y + ny * r]);
    Rr.push([pts[i].x - nx * r, pts[i].y - ny * r]);
  }
  ctx.beginPath();
  L.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = Rr.length - 1; i >= 0; i--) ctx.lineTo(Rr[i][0], Rr[i][1]);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  // the light along its top
  ctx.strokeStyle = rgba('#fff4e0', 0.35 * light);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const top = L[0][1] < Rr[0][1] ? L : Rr;
  top.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
}

function post(ctx: CanvasRenderingContext2D, cam: FCam, at: [number, number, number], pad: string, light: number): void {
  const b = camSpace(cam, at[0], 0, at[2]);
  if (b[2] < NEAR * 2) return;
  const p0 = camToScreen(cam, b[0], b[1], b[2]);
  const t = camSpace(cam, at[0], 1.0, at[2]);
  const p1 = camToScreen(cam, t[0], t[1], t[2]);
  const w = Math.max(2, 0.05 * p0.k), wp = Math.max(3, 0.08 * p0.k);
  ctx.fillStyle = C.post;
  ctx.fillRect(p0.x - w / 2, p1.y, w, p0.y - p1.y);
  const y0 = p1.y + (p0.y - p1.y) * 0.08, y1 = p1.y + (p0.y - p1.y) * 0.8;
  ctx.fillStyle = pad;
  ctx.beginPath();
  ctx.roundRect(p0.x - wp / 2, y0, wp, y1 - y0, wp * 0.35);
  ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.18 * light);
  ctx.fillRect(p0.x - wp / 2 + wp * 0.14, y0 + wp * 0.2, wp * 0.18, y1 - y0 - wp * 0.4);
}

/** The cage: a fine diamond mesh between padded posts, the top rail — the crowd seen through it. */
function cage(ctx: CanvasRenderingContext2D, cam: FCam, g: RingGeo, light: number): void {
  const Rc = FP_RING.cage, top = FP_RING.fence, n = 8;
  const at = (i: number): [number, number] => {
    const a = Math.PI / 8 + (i * TAU) / n;
    const rr = Rc / Math.cos(Math.PI / 8);
    return [Math.cos(a) * rr, Math.sin(a) * rr];
  };
  ctx.save();
  ctx.strokeStyle = rgba(C.fence, 0.2 * light + 0.07);
  ctx.lineWidth = 1;
  ctx.beginPath();
  const cell = 0.08;
  for (let i = 0; i < n; i++) {
    const A = at(i), B = at(i + 1);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const P = (s: number, y: number): [number, number, number] => ringPoint(g, A[0] + ((B[0] - A[0]) * s) / L, y, A[1] + ((B[1] - A[1]) * s) / L);
    const h0 = 0.06, h1 = top;
    // lines s − y = c and s + y = c across the panel
    for (let c = -(h1 - h0); c <= L; c += cell) {
      for (const dir of [1, -1]) {
        // from the panel's bottom to its top along s = c + dir·(y − h0)
        let s0 = dir > 0 ? c : c + (h1 - h0), s1 = dir > 0 ? c + (h1 - h0) : c;
        let y0 = h0, y1 = h1;
        // clip to 0 ≤ s ≤ L
        const clipS = (sA: number, yA: number, sB: number, yB: number): [number, number, number, number] | null => {
          if ((sA < 0 && sB < 0) || (sA > L && sB > L)) return null;
          const lerpY = (sv: number): number => yA + ((yB - yA) * (sv - sA)) / (sB - sA || 1e-9);
          if (sA < 0) { yA = lerpY(0); sA = 0; }
          if (sB < 0) { yB = lerpY(0); sB = 0; }
          if (sA > L) { yA = lerpY(L); sA = L; }
          if (sB > L) { yB = lerpY(L); sB = L; }
          return [sA, yA, sB, yB];
        };
        const cl = clipS(s0, y0, s1, y1);
        if (!cl) continue;
        [s0, y0, s1, y1] = cl;
        const seg = segment(cam, P(s0, y0), P(s1, y1));
        if (!seg) continue;
        ctx.moveTo(seg[0].x, seg[0].y);
        ctx.lineTo(seg[1].x, seg[1].y);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
  // the top rail and the bottom pad, the posts
  for (let i = 0; i < n; i++) {
    const A = at(i), B = at(i + 1);
    for (const [y, wk, col] of [[top, 0.04, '#141418'], [0.05, 0.05, '#18181d']] as const) {
      const s = segment(cam, ringPoint(g, A[0], y, A[1]), ringPoint(g, B[0], y, B[1]));
      if (!s) continue;
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, wk * (s[0].k + s[1].k) * 0.5);
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      ctx.lineTo(s[1].x, s[1].y);
      ctx.stroke();
      if (y === top) {
        ctx.strokeStyle = rgba('#ffffff', 0.1 * light);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const A = at(i);
    const b = camSpace(cam, ...ringPoint(g, A[0], 0, A[1]));
    if (b[2] < NEAR * 2) continue;
    const p0 = camToScreen(cam, b[0], b[1], b[2]);
    const tt = camSpace(cam, ...ringPoint(g, A[0], top, A[1]));
    const p1 = camToScreen(cam, tt[0], tt[1], tt[2]);
    const w = Math.max(2, 0.055 * p0.k);
    ctx.fillStyle = '#121216';
    ctx.fillRect(p0.x - w / 2, p1.y, w, p0.y - p1.y);
    ctx.fillStyle = rgba('#ffffff', 0.08 * light + 0.02);
    ctx.fillRect(p0.x - w / 2, p1.y, w * 0.3, p0.y - p1.y);
  }
}

/** The light from the rig above: a soft warm haze about the fighters (no hard edges near the eye). */
export function fpCone(ctx: CanvasRenderingContext2D, cam: FCam, g: RingGeo, light: number): void {
  const a = project(cam, ...ringPoint(g, 0, 1.4, 0));
  if (a.d < NEAR * 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.warm, a.x, a.y, a.k * 1.3, 0.1 * light);
  glow(ctx, C.warmHi, a.x, a.y - a.k * 0.5, a.k * 0.6, 0.06 * light);
  ctx.restore();
}

/** Dust in the light about the fighters: still in the slow motion (it moves on the world's clock). */
export function fpDust(ctx: CanvasRenderingContext2D, cam: FCam, g: RingGeo, wt: number, amount: number, reduced: boolean): void {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = '#ffe9c8';
  for (let i = 0; i < 34; i++) {
    const t = reduced ? 0 : wt;
    const x = (hash(i * 7) - 0.5) * 2.2 + 0.06 * Math.sin(t * 0.3 + i);
    const z = (hash(i * 19) - 0.5) * 2.2;
    const y = 0.15 + ((hash(i * 13) * 2.2 + t * 0.03 * (0.5 + hash(i))) % 2.2);
    const p = project(cam, ...ringPoint(g, x, y, z));
    if (p.d < 0.3) continue;
    const r = Math.max(0.7, p.k * 0.004 * (0.6 + hash(i * 23)));
    const inCone = clamp01(1 - Math.hypot(x, z) / (0.6 + y * 0.35));
    ctx.globalAlpha = amount * (0.1 + 0.45 * inCone) * (0.6 + 0.4 * Math.sin(i + t * 0.7));
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
