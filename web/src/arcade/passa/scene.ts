/**
 * Złota passa's street through one day (DESIGN.md §26, builder B), canvas 2D in one-point perspective: a small European
 * street seen from the pavement (world.ts), from the dawn's mist to the blue evening.
 *
 *   the sky     live: a gradient through the day (paint.ts `lightAt`), the stars at night, the sun's glow (behind the
 *               viewer in the morning, high at noon, ahead in the afternoon, setting behind the church), a few soft
 *               clouds drifting, birds crossing in the morning
 *   the street  baked per size and per step of the day (offscreen, two steps crossfaded): the houses with their
 *               windows, shutters, cornices and gables, the café's striped awning, the bakery's pretzel, the florist's
 *               buckets, the grocer's crates, the pharmacy's cross, the bus stop, the linden, the lamps, the bench, the
 *               zebra crossing and its traffic light, the square and the church; the sun's light and the long shadows
 *               of the houses and the lamps; at dusk the windows light up one by one, the lamps and their pools
 *   the life    live: the traffic light's lamp, pigeons pecking by the crossing, a cat on a sill (its tail), a few
 *               people as soft silhouettes walking the pavements, the dawn's mist
 *
 * Reduced motion: nothing walks, flies or drifts; the light still follows the day.
 */
import {
  BENCH, BUCKETS, BUS_STOP, CAFE_TABLES, CAM_X, CAT, CHURCH, CROSSING, EYE, HALF, HOUSES, KERB, LAMPS, PAVE,
  PIGEONS, SQUARE, STREET_END, TRAFFIC, TREES, type House,
} from './world';
import {
  TAU, band, clamp01, glow, hash, hazeAt, layer, lerp, lightAt, mixHex, rgbHex, rgba, shade, type Light, type RGB,
} from './paint';

/** The street's camera on the canvas: the vanishing point's x, the horizon's y, the focal length (px per m at 1 m). */
export interface Cam { cx: number; hy: number; f: number }

export type V3 = [number, number, number];

/** The nearest depth drawn (m): what is closer is clipped. */
const ZN = 0.7;
/** Steps of the day the street is baked at (crossfaded between). */
export const DAY_STEPS = 40;

export const project = (c: Cam, x: number, y: number, z: number): [number, number] =>
  [c.cx + (c.f * (x - CAM_X)) / z, c.hy - (c.f * (y - EYE)) / z];

/** A polygon clipped to z ≥ ZN (Sutherland–Hodgman). */
function clipZ(pts: readonly V3[]): V3[] {
  const out: V3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ina = a[2] >= ZN, inb = b[2] >= ZN;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (ZN - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, ZN]);
    }
  }
  return out;
}

function path(ctx: CanvasRenderingContext2D, c: Cam, pts: readonly V3[]): boolean {
  const q = clipZ(pts);
  if (q.length < 3) return false;
  ctx.beginPath();
  for (let i = 0; i < q.length; i++) {
    const [x, y] = project(c, q[i][0], q[i][1], q[i][2]);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
  return true;
}

function fill(ctx: CanvasRenderingContext2D, c: Cam, pts: readonly V3[], col: string): void {
  if (!path(ctx, c, pts)) return;
  ctx.fillStyle = col;
  ctx.fill();
}

/** A quad on a facade's plane (x = s·(HALF + inset)) between two depths and two heights. */
const wallQ = (s: number, z0: number, z1: number, y0: number, y1: number, inset = 0): V3[] => {
  const x = s * (HALF + inset);
  return [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]];
};
/** A quad facing the viewer (z plane) between two x and two heights. */
const frontQ = (z: number, x0: number, x1: number, y0: number, y1: number): V3[] => [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]];
/** A quad on the ground (or at height y) between two x and two depths. */
const flatQ = (y: number, x0: number, x1: number, z0: number, z1: number): V3[] => [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];

/** The ground floor's height and an upper floor's. */
const GF = 3.7, FH = 3.05;

/** How squarely the sun falls on a facade of side s (its normal points to the street's middle). */
const litSide = (s: number, Lt: Light): number => -s * Lt.L[0];

/** One window of the street (for its light at dusk): a stable index → when it lights. */
const winOn = (i: number): number => 0.79 + 0.17 * hash(i * 3 + 1);
const winEarly = (i: number): number => (hash(i * 7 + 2) < 0.2 ? 0.05 + 0.05 * hash(i * 5 + 3) : -1);
const windowLit = (i: number, day: number): number => {
  const on = band(winOn(i), winOn(i) + 0.015, day);
  const e = winEarly(i);
  const early = e > 0 ? 1 - band(e, e + 0.02, day) : 0;
  return Math.max(on, early);
};

export class Street {
  private A: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; step: number } | null = null;
  private B: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; step: number } | null = null;
  private key = '';
  private w = 0;
  private h = 0;
  private dpr = 1;
  private cam: Cam = { cx: 0, hy: 0, f: 1 };
  private trafficT = 0;
  private stars: { x: number; y: number; r: number; ph: number }[] = [];

  constructor(readonly reduced: boolean) {
    for (let i = 0; i < 70; i++) this.stars.push({ x: hash(i * 3 + 11), y: hash(i * 7 + 13) ** 1.4, r: 0.5 + 1.1 * hash(i * 11 + 17) ** 3, ph: hash(i + 19) * TAU });
  }

  /** Size the street for a canvas of w × h CSS px with its camera (re-bakes lazily). */
  resize(w: number, h: number, dpr: number, cam: Cam): void {
    const key = `${Math.round(w)}|${Math.round(h)}|${dpr}|${cam.cx.toFixed(1)}|${cam.hy.toFixed(1)}|${cam.f.toFixed(1)}`;
    this.w = w;
    this.h = h;
    this.dpr = Math.min(2, Math.max(1, dpr || 1));
    this.cam = cam;
    if (key !== this.key) {
      this.key = key;
      this.A = null;
      this.B = null;
    }
  }

  get camera(): Cam { return this.cam; }

  // ── the sky (live) ───────────────────────────────────────────────

  /** The sky, the sun's glow, the stars, the clouds and the morning's birds. */
  sky(ctx: CanvasRenderingContext2D, day: number, time: number): void {
    const { w, h } = this, c = this.cam, Lt = lightAt(day);
    const g = ctx.createLinearGradient(0, Math.min(c.hy - c.f * 1.3, 0), 0, c.hy + 4);
    g.addColorStop(0, rgbHex(Lt.top));
    g.addColorStop(0.62, rgbHex(Lt.mid));
    g.addColorStop(1, rgbHex(Lt.hor));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, Math.min(h, c.hy + 6));
    // the stars
    if (Lt.stars > 0.02) {
      ctx.fillStyle = '#fff6e4';
      for (const s of this.stars) {
        const y = s.y * (c.hy - 10);
        const tw = this.reduced ? 1 : 0.65 + 0.35 * Math.sin(time * 1.3 + s.ph);
        ctx.globalAlpha = clamp01(Lt.stars * tw * (0.35 + 0.65 * (1 - s.y)));
        ctx.beginPath();
        ctx.arc(s.x * w, y, s.r, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // the sun: its glow where it stands (behind the houses, its light still spreads in the sky)
    const L = Lt.L;
    ctx.globalCompositeOperation = 'lighter';
    if (L[2] > 0.05 && Lt.sunI > 0.02) {
      const sx = c.cx + (c.f * L[0]) / L[2], sy = c.hy - (c.f * L[1]) / L[2];
      const k = Lt.sunI;
      glow(ctx, rgbHex(Lt.sun), sx, sy, c.f * 1.4, 0.32 * k);
      glow(ctx, '#fff4dc', sx, sy, c.f * 0.32, 0.55 * k);
      glow(ctx, '#ffffff', sx, sy, c.f * 0.06, 0.9 * k);
    } else if (Lt.sunI > 0.02) {
      // the sun behind the viewer: the light warms the sky's lower part ahead
      glow(ctx, rgbHex(Lt.hor), c.cx, c.hy, c.f * 1.2, 0.18 * Lt.sunI, 0.5);
    }
    // the afterglow at the street's end in the evening
    if (Lt.dusk > 0.05 && day > 0.6) glow(ctx, '#ff9a6a', c.cx + c.f * 0.04, c.hy - c.f * 0.05, c.f * 0.9, 0.22 * Lt.dusk * (1 - band(0.95, 1, day) * 0.6), 0.45);
    ctx.globalCompositeOperation = 'source-over';
    this.clouds(ctx, Lt, day, time);
    if (!this.reduced) this.birds(ctx, Lt, day, time);
  }

  private clouds(ctx: CanvasRenderingContext2D, Lt: Light, day: number, time: number): void {
    const c = this.cam, w = this.w;
    const lit = mixHex(rgbHex(Lt.hor), '#ffffff', 0.55 - 0.4 * Lt.dusk);
    const dark = mixHex(rgbHex(Lt.mid), rgbHex(Lt.top), 0.35);
    const a = 0.55 - 0.3 * band(0.9, 1, day);
    for (let i = 0; i < 5; i++) {
      const sc = c.f * (0.16 + 0.1 * hash(i * 5 + 1));
      const drift = this.reduced ? 0 : time * (2.4 + 1.6 * hash(i + 4));
      const span = w + sc * 4;
      const x = ((hash(i * 9 + 2) * span + drift) % span) - sc * 2;
      const y = c.hy - c.f * (0.42 + 0.5 * hash(i * 13 + 3));
      if (y < -sc) continue;
      ctx.globalAlpha = a * (0.6 + 0.4 * hash(i + 7));
      for (let k = 0; k < 6; k++) {
        const ox = (k - 2.5) * sc * 0.38, oy = -Math.sin((k / 5) * Math.PI) * sc * 0.22;
        const r = sc * (0.24 + 0.14 * Math.sin((k / 5) * Math.PI));
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy + r * 0.12, r, r * 0.62, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = lit;
        ctx.beginPath();
        ctx.ellipse(x + ox - r * 0.05, y + oy - r * 0.06, r * 0.9, r * 0.52, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private birds(ctx: CanvasRenderingContext2D, Lt: Light, day: number, time: number): void {
    const a = 1 - band(0.3, 0.42, day);
    if (a <= 0.01) return;
    const c = this.cam, w = this.w;
    ctx.strokeStyle = rgba(mixHex(rgbHex(Lt.top), '#1d2230', 0.7), 0.75 * a);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, c.f * 0.006);
    for (let i = 0; i < 5; i++) {
      const per = 26 + 10 * hash(i + 31);
      const t = ((time + per * hash(i * 3 + 30)) % per) / per;
      const x = -40 + (w + 80) * t;
      const y = c.hy - c.f * (0.55 + 0.25 * hash(i * 7 + 32)) + Math.sin(time * 0.9 + i) * 6;
      const s = c.f * 0.018 * (0.8 + 0.4 * hash(i + 33));
      const fl = Math.sin(time * 9 + i * 1.7);
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.5 * fl);
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.25, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.25, x + s, y - s * 0.5 * fl);
      ctx.stroke();
    }
  }

  // ── the street (baked) ──────────────────────────────────────────

  /** The street at this moment of the day: two baked steps crossfaded (drawn live where no canvas can be made). */
  street(ctx: CanvasRenderingContext2D, day: number): void {
    const d = clamp01(day);
    const f = d * DAY_STEPS;
    const s0 = Math.min(DAY_STEPS - 1, Math.floor(f));
    const s1 = s0 + 1;
    const k = f - s0;
    const a = this.baked(s0), b = k > 0.002 ? this.baked(s1) : null;
    if (!a) {
      this.paint(ctx, d);
      return;
    }
    ctx.drawImage(a.c, 0, 0, this.w, this.h);
    if (b) {
      ctx.globalAlpha = k;
      ctx.drawImage(b.c, 0, 0, this.w, this.h);
      ctx.globalAlpha = 1;
    }
  }

  /** The baked step `step`, from the two kept canvases (the older one re-baked). */
  private baked(step: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D; step: number } | null {
    if (this.A?.step === step) return this.A;
    if (this.B?.step === step) return this.B;
    // keep the one nearer the step asked; re-use the other's canvas
    const old = !this.A ? 'A' : !this.B ? 'B' : Math.abs(this.A.step - step) > Math.abs(this.B.step - step) ? 'A' : 'B';
    let L = old === 'A' ? this.A : this.B;
    if (!L) {
      const made = layer(this.w, this.h, this.dpr);
      if (!made) return null;
      L = { ...made, step: -1 };
    }
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.clearRect(0, 0, L.c.width, L.c.height);
    L.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.paint(L.ctx, step / DAY_STEPS);
    L.step = step;
    if (old === 'A') this.A = L; else this.B = L;
    return L;
  }

  /** Paint the whole street (no sky) at a moment of the day. */
  paint(ctx: CanvasRenderingContext2D, day: number): void {
    const c = this.cam, Lt = lightAt(day);
    this.far(ctx, c, Lt, day);
    this.ground(ctx, c, Lt);
    this.groundShadows(ctx, c, Lt);
    // the houses, far to near on each side; chimneys behind them
    const order = [...HOUSES].sort((a, b) => b.z0 - a.z0);
    for (const hs of order) this.chimney(ctx, c, hs, Lt);
    for (const hs of order) this.house(ctx, c, hs, Lt, day);
    this.wallShadows(ctx, c, Lt);
    // what stands out from the walls and on the pavements, far to near
    type Item = { z: number; draw: () => void };
    const items: Item[] = [];
    for (const hs of HOUSES) {
      if (hs.awn.length) items.push({ z: hs.z0 + 0.3, draw: () => this.awning(ctx, c, hs, Lt) });
    }
    for (const lp of LAMPS) items.push({ z: lp.z, draw: () => this.lamp(ctx, c, lp.x, lp.z, Lt) });
    for (const t of TREES) items.push({ z: t.z, draw: () => this.tree(ctx, c, t, Lt) });
    items.push({ z: BENCH.z0, draw: () => this.bench(ctx, c, Lt) });
    items.push({ z: BUS_STOP.z0, draw: () => this.busStop(ctx, c, Lt) });
    items.push({ z: TRAFFIC.z, draw: () => this.trafficPole(ctx, c, Lt) });
    for (const t of CAFE_TABLES) items.push({ z: t.z, draw: () => this.table(ctx, c, t.x, t.z, Lt) });
    BUCKETS.forEach((z, i) => items.push({ z, draw: () => this.bucket(ctx, c, z, i, Lt) }));
    items.push({ z: 7.2, draw: () => this.crates(ctx, c, Lt) });
    items.push({ z: 17.6, draw: () => this.bladeSign(ctx, c, -1, 17.6, 'pretzel', Lt, day) });
    items.push({ z: 29.2, draw: () => this.bladeSign(ctx, c, -1, 29.2, 'cross', Lt, day) });
    items.sort((a, b) => b.z - a.z);
    for (const it of items) it.draw();
    this.nightLights(ctx, c, Lt, day);
  }

  // ── the far end: the square, the church, the roofs beyond ──────────

  private far(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, day: number): void {
    // roofs and a hill far beyond, in the haze
    const farCol = mixHex(rgbHex(Lt.hor), rgbHex(Lt.mid), 0.5);
    const z = 95;
    ctx.fillStyle = mixHex(farCol, '#5a6278', 0.28);
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= 24; i++) {
      const x = -60 + i * 5;
      const y = 9 + 4 * Math.sin(i * 1.7) + 3 * hash(i + 70);
      const [px, py] = project(c, x, y, z);
      if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
    }
    const [ex] = project(c, 60, 0, z);
    const [sx0] = project(c, -60, 0, z);
    ctx.lineTo(ex, c.hy + 2);
    ctx.lineTo(sx0, c.hy + 2);
    ctx.closePath();
    ctx.fill();
    // the square's floor
    fill(ctx, c, flatQ(0, -30, 30, STREET_END - 0.5, CHURCH.z + 4), shade('#c4b8a6', Lt.L[1] * 0.8, 50, Lt));
    // the houses round the square, facing the viewer
    for (const q of SQUARE) {
      const lit = -Lt.L[2] * 0.9 + 0.1;
      fill(ctx, c, frontQ(q.z, q.x0, q.x1, 0, q.h), shade(q.col, lit, q.z, Lt));
      fill(ctx, c, frontQ(q.z - 0.05, q.x0, q.x1, q.h - 0.4, q.h), shade(q.trim, lit, q.z, Lt));
      const n = Math.floor((q.x1 - q.x0) / 2.2);
      for (let r = 0; r < 3; r++) {
        const y0 = GF + 0.8 + r * FH;
        if (y0 + 1.6 > q.h - 0.6) break;
        for (let i = 0; i < n; i++) {
          const x0 = q.x0 + 0.6 + i * ((q.x1 - q.x0 - 1.2) / n) + 0.3;
          const idx = 900 + q.z * 13 + i * 5 + r;
          const on = windowLit(idx, day);
          fill(ctx, c, frontQ(q.z - 0.05, x0, x0 + 0.9, y0, y0 + 1.5), on > 0.05 ? mixHex(shade('#3b4656', 0, q.z, Lt), '#ffc978', on) : shade('#3b4656', 0.2, q.z, Lt));
        }
      }
      fill(ctx, c, frontQ(q.z - 0.05, q.x0, q.x1, 0, 0.5), shade(mixHex(q.col, '#5a4a40', 0.3), lit, q.z, Lt));
    }
    // the church: the nave's front with its gable, the tower with the belfry, the clock and the spire
    const ch = CHURCH, cz = ch.z;
    const litF = -Lt.L[2] * 0.85 + 0.15;
    const wall = shade(ch.col, litF, cz, Lt), trim = shade(ch.trim, litF, cz, Lt);
    ctx.fillStyle = wall;
    path(ctx, c, [[ch.x0, 0, cz], [ch.x1, 0, cz], [ch.x1, ch.h, cz], [0, ch.h + ch.gable, cz], [ch.x0, ch.h, cz]]);
    ctx.fill();
    // the gable's edge
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, (c.f * 0.35) / cz);
    path(ctx, c, [[ch.x0 - 0.2, ch.h, cz - 0.05], [0, ch.h + ch.gable + 0.25, cz - 0.05], [ch.x1 + 0.2, ch.h, cz - 0.05]]);
    ctx.stroke();
    // the rose window and two tall windows
    const [rx, ry] = project(c, -3.6, 8.6, cz), rr0 = (c.f * 1.05) / cz;
    const glass = day > 0.8 ? mixHex(shade('#4a4060', 0, cz, Lt), '#ffbf70', band(0.84, 0.92, day) * 0.9) : shade('#4a5466', 0.1, cz, Lt);
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(rx, ry, rr0, 0, TAU);
    ctx.fill();
    for (const x of [-4.6, 4.6]) {
      if (x < 0) continue;
      fill(ctx, c, frontQ(cz - 0.05, x - 0.5, x + 0.5, 3, 8), glass);
    }
    // the tower
    const tx0 = ch.tx - ch.tw / 2, tx1 = ch.tx + ch.tw / 2, tz = cz - 1.2;
    const tWall = shade(mixHex(ch.col, '#d8c8b0', 0.4), litF, tz, Lt);
    fill(ctx, c, frontQ(tz, tx0, tx1, 0, ch.th), tWall);
    // its lit upper part at the first light (the sun from behind the viewer catches the top first)
    if (day < 0.12) {
      const k = (1 - band(0.04, 0.12, day)) * 0.55;
      fill(ctx, c, frontQ(tz - 0.02, tx0, tx1, ch.th * 0.55, ch.th), rgba('#ffb89a', k));
    }
    // string courses, the portal, the clock, the belfry's openings
    for (const y of [ch.h, ch.th - 6.5, ch.th - 0.6]) fill(ctx, c, frontQ(tz - 0.04, tx0 - 0.15, tx1 + 0.15, y - 0.35, y), trim);
    const door = shade('#5a3a2a', 0.3, tz, Lt);
    ctx.fillStyle = door;
    path(ctx, c, [[ch.tx - 0.9, 0, tz - 0.05], [ch.tx + 0.9, 0, tz - 0.05], [ch.tx + 0.9, 3.2, tz - 0.05], [ch.tx, 4.1, tz - 0.05], [ch.tx - 0.9, 3.2, tz - 0.05]]);
    ctx.fill();
    const [kx, ky] = project(c, ch.tx, ch.th - 9.2, tz - 0.06);
    const kr = (c.f * 1.05) / tz;
    ctx.fillStyle = shade('#e9d08a', litF + 0.3, tz, Lt);
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = shade('#3a3024', 0.2, tz, Lt);
    ctx.lineWidth = Math.max(0.8, kr * 0.12);
    ctx.beginPath();
    ctx.moveTo(kx, ky);
    ctx.lineTo(kx, ky - kr * 0.7);
    ctx.moveTo(kx, ky);
    ctx.lineTo(kx + kr * 0.5, ky + kr * 0.15);
    ctx.stroke();
    const hole = shade('#2a2630', 0, tz, Lt);
    for (const x of [ch.tx - 0.75, ch.tx + 0.75]) {
      ctx.fillStyle = hole;
      path(ctx, c, [[x - 0.45, ch.th - 5.6, tz - 0.05], [x + 0.45, ch.th - 5.6, tz - 0.05], [x + 0.45, ch.th - 2.4, tz - 0.05], [x, ch.th - 1.8, tz - 0.05], [x - 0.45, ch.th - 2.4, tz - 0.05]]);
      ctx.fill();
    }
    // the spire (copper green) and its cross
    const roof = shade(ch.roof, Math.max(litF, Lt.L[1]) * 0.8, tz, Lt);
    ctx.fillStyle = roof;
    path(ctx, c, [[tx0 - 0.25, ch.th, tz], [tx1 + 0.25, ch.th, tz], [ch.tx + 0.45, ch.th + 2.2, tz], [ch.tx, ch.th + ch.spire, tz], [ch.tx - 0.45, ch.th + 2.2, tz]]);
    ctx.fill();
    ctx.fillStyle = shade(mixHex(ch.roof, '#ffffff', 0.25), Math.max(0, Lt.L[0]) + 0.4, tz, Lt);
    path(ctx, c, [[ch.tx, ch.th, tz - 0.02], [tx1 + 0.25, ch.th, tz - 0.02], [ch.tx + 0.45, ch.th + 2.2, tz - 0.02], [ch.tx, ch.th + ch.spire, tz - 0.02]]);
    ctx.fill();
    const top = ch.th + ch.spire;
    ctx.strokeStyle = shade('#c9a24a', 0.6, tz, Lt);
    ctx.lineWidth = Math.max(1, (c.f * 0.14) / tz);
    ctx.beginPath();
    let [ax, ay] = project(c, ch.tx, top, tz);
    let [bx, by] = project(c, ch.tx, top + 1.5, tz);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    [ax, ay] = project(c, ch.tx - 0.45, top + 1.05, tz);
    [bx, by] = project(c, ch.tx + 0.45, top + 1.05, tz);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    ctx.stroke();
  }

  // ── the ground ─────────────────────────────────────────────────

  private ground(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const up = Lt.L[1];
    const zEnd = STREET_END;
    // the road: warm grey setts, rows across it, darker toward the kerbs
    const road = shade('#8f8a84', up * 0.9, 10, Lt);
    const roadFar = shade('#8f8a84', up * 0.9, 40, Lt);
    if (path(ctx, c, flatQ(0, -KERB, KERB, ZN, zEnd))) {
      const [, yN] = project(c, 0, 0, 1.2);
      const g = ctx.createLinearGradient(0, yN, 0, c.hy);
      g.addColorStop(0, road);
      g.addColorStop(1, roadFar);
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.strokeStyle = rgba(shade('#3e3a36', 0.2, 10, Lt), 0.28);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let z = 1.1; z < zEnd; z *= 1.055) {
      const [x0, y0] = project(c, -KERB, 0, z), [x1] = project(c, KERB, 0, z);
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y0);
    }
    // the setts' joints along the road, near only
    for (let x = -KERB + 0.5; x < KERB; x += 0.5) {
      const [a0, b0] = project(c, x, 0, ZN + 0.3), [a1, b1] = project(c, x, 0, 9);
      ctx.moveTo(a0, b0);
      ctx.lineTo(a1, b1);
    }
    ctx.stroke();
    // a gutter by each kerb
    for (const s of [-1, 1]) fill(ctx, c, flatQ(0.002, s * KERB - s * 0.35, s * KERB, ZN, zEnd), rgba(shade('#4a4642', 0.2, 10, Lt), 0.35));
    // the zebra crossing
    for (let k = 0; k < 6; k++) {
      const x0 = -KERB + 0.25 + k * 1.0;
      fill(ctx, c, flatQ(0.003, x0, x0 + 0.5, CROSSING.z0, CROSSING.z1), rgba(shade('#f2f0ea', up + 0.2, 12, Lt), 0.9));
    }
    // the pavements: light slabs with joints, and the kerbs' faces
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -HALF : KERB, x1 = s < 0 ? -KERB : HALF;
      fill(ctx, c, flatQ(PAVE, x0, x1, ZN, zEnd), shade('#cfc5b6', up * 0.9 + 0.05, 14, Lt));
      fill(ctx, c, [[s * KERB, 0, ZN], [s * KERB, 0, zEnd], [s * KERB, PAVE, zEnd], [s * KERB, PAVE, ZN]], shade('#e2dccf', litSide(s, Lt) * 0.6 + 0.2, 14, Lt));
      fill(ctx, c, flatQ(PAVE + 0.001, s * KERB, s * (KERB + 0.22), ZN, zEnd), shade('#ddd6c8', up + 0.1, 14, Lt));
      ctx.strokeStyle = rgba(shade('#6a625a', 0.2, 12, Lt), 0.3);
      ctx.beginPath();
      for (let z = 1; z < zEnd; z += z < 12 ? 0.9 : 1.8) {
        const [a0, b0] = project(c, x0, PAVE, z), [a1, b1] = project(c, x1, PAVE, z);
        ctx.moveTo(a0, b0);
        ctx.lineTo(a1, b1);
      }
      const xm = s * (KERB + HALF) / 2;
      const [m0, n0] = project(c, xm, PAVE, ZN + 0.2), [m1, n1] = project(c, xm, PAVE, zEnd);
      ctx.moveTo(m0, n0);
      ctx.lineTo(m1, n1);
      ctx.stroke();
    }
  }

  /** The houses' long shadows on the street (and on the facing walls when the sun is low). */
  private groundShadows(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const L = Lt.L, k = Lt.sunI;
    if (k < 0.04 || Math.abs(L[0]) < 0.03) return;
    const cs = L[0] < 0 ? -1 : 1;
    const col = rgba(mixHex(rgbHex(Lt.amb.map(v => v * 120) as RGB), '#1c2440', 0.5), 0.42 * k);
    ctx.fillStyle = col;
    const ax = Math.abs(L[0]), ty = L[1] / ax, tz = L[2] / ax;
    for (const hs of HOUSES) {
      if (hs.s !== cs) continue;
      const D = Math.min(2 * HALF, hs.h / Math.max(0.02, ty));
      const x0 = cs * HALF, x1 = cs * HALF - cs * D;
      if (path(ctx, c, [[x0, PAVE + 0.004, hs.z0], [x0, PAVE + 0.004, hs.z1], [x1, 0.004, hs.z1 - D * tz], [x1, 0.004, hs.z0 - D * tz]])) ctx.fill();
    }
    // the lamps' and the trees' shadows
    const sy = Math.max(0.05, L[1]);
    ctx.strokeStyle = col;
    ctx.lineCap = 'round';
    for (const lp of LAMPS) {
      const len = Math.min(26, 4.2 / sy);
      const ex = lp.x - (L[0] / sy) * 4.2 * (len / (4.2 / sy)), ez = lp.z - (L[2] / sy) * 4.2 * (len / (4.2 / sy));
      if (lp.z < ZN || ez < ZN) continue;
      const [a, b] = project(c, lp.x, PAVE, lp.z), [d, e] = project(c, Math.max(-HALF, Math.min(HALF, ex)), PAVE, ez);
      ctx.lineWidth = Math.max(1, (c.f * 0.12) / lp.z);
      ctx.beginPath();
      ctx.moveTo(a, b);
      ctx.lineTo(d, e);
      ctx.stroke();
    }
    for (const t of TREES) {
      const ox = t.x - (L[0] / sy) * t.cy, oz = t.z - (L[2] / sy) * t.cy;
      if (oz < ZN + t.r) continue;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * TAU;
        const [px, py] = project(c, Math.max(-HALF, Math.min(HALF, ox + Math.cos(a) * t.r)), PAVE, oz + Math.sin(a) * t.r * 1.3);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.fill();
    }
  }

  /** The shadow of one side's houses climbing the other side's walls in a low sun. */
  private wallShadows(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const L = Lt.L, k = Lt.sunI;
    if (k < 0.04 || Math.abs(L[0]) < 0.03) return;
    const cs = L[0] < 0 ? -1 : 1;
    const ax = Math.abs(L[0]), ty = L[1] / ax, tz = L[2] / ax;
    ctx.fillStyle = rgba('#1c2440', 0.34 * k);
    for (const hs of HOUSES) {
      if (hs.s !== cs) continue;
      const hr = hs.h - 2 * HALF * ty;
      if (hr <= 0) continue;
      const dz = -2 * HALF * tz;
      // the lit side's walls up to hr, shifted along the street
      ctx.save();
      for (const o of HOUSES) {
        if (o.s === cs) continue;
        const z0 = Math.max(o.z0, hs.z0 + dz), z1 = Math.min(o.z1, hs.z1 + dz);
        if (z1 <= z0) continue;
        if (path(ctx, c, wallQ(-cs, z0, z1, 0, Math.min(o.h, hr), -0.02))) ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── the houses ─────────────────────────────────────────────────

  private chimney(ctx: CanvasRenderingContext2D, c: Cam, hs: House, Lt: Light): void {
    const s = hs.s, z = hs.z0 + (hs.z1 - hs.z0) * (0.3 + 0.4 * hash(hs.z0 * 7 + 1));
    const x = s * (HALF + 2.2), top = hs.h + 1.3 + 0.8 * hash(hs.z0 + 3);
    const col = shade('#a0604c', 0.2, z, Lt);
    fill(ctx, c, frontQ(z, x - 0.35, x + 0.35, hs.h - 1, top), col);
    fill(ctx, c, [[x - s * 0.35, hs.h - 1, z], [x - s * 0.35, hs.h - 1, z + 0.7], [x - s * 0.35, top, z + 0.7], [x - s * 0.35, top, z]], shade('#a0604c', litSide(s, Lt), z, Lt));
    fill(ctx, c, frontQ(z - 0.02, x - 0.45, x + 0.45, top - 0.25, top), shade('#7a4a3c', 0.2, z, Lt));
  }

  private house(ctx: CanvasRenderingContext2D, c: Cam, hs: House, Lt: Light, day: number): void {
    const s = hs.s, z0 = hs.z0, z1 = hs.z1, zm = (z0 + z1) / 2, w = z1 - z0;
    const lit = litSide(s, Lt);
    const wall = shade(hs.col, lit, zm, Lt), trim = shade(hs.trim, lit, zm, Lt);
    // the wall, its plinth and the string course over the shop floor
    fill(ctx, c, wallQ(s, z0, z1, 0, hs.h), wall);
    // a soft vertical shade where it meets the next house (depth between facades)
    fill(ctx, c, wallQ(s, z1 - 0.12, z1, 0, hs.h, -0.01), shade(mixHex(hs.col, '#40384a', 0.35), lit, zm, Lt));
    fill(ctx, c, wallQ(s, z0, z1, 0, 0.55, -0.01), shade(mixHex(hs.col, '#5a4c44', 0.35), lit, zm, Lt));
    fill(ctx, c, wallQ(s, z0, z1, GF - 0.18, GF, -0.02), trim);
    // the top: a cornice (with its shadow), an attic, a curved gable or a stepped one
    this.top(ctx, c, hs, wall, trim, lit, Lt);
    // the upper floors' windows
    const floors = Math.max(1, Math.floor((hs.h - GF - 0.7) / FH));
    const n = Math.max(1, Math.round((w - 0.8) / 2.05));
    const slot = (w - 0.6) / n;
    for (let r = 0; r < floors; r++) {
      const y0 = GF + 0.85 + r * FH, wh = r === floors - 1 && floors > 2 ? 1.45 : 1.7;
      for (let i = 0; i < n; i++) {
        const za = z0 + 0.3 + i * slot + (slot - 1.05) / 2;
        const idx = Math.round(z0 * 31) * 7 + (s + 1) * 1000 + r * 13 + i;
        this.window(ctx, c, s, za, za + 1.05, y0, y0 + wh, idx, hs, lit, Lt, day);
      }
    }
    // the ground floor
    this.shopFront(ctx, c, hs, wall, trim, lit, Lt, day);
  }

  private top(ctx: CanvasRenderingContext2D, c: Cam, hs: House, wall: string, trim: string, lit: number, Lt: Light): void {
    const s = hs.s, z0 = hs.z0, z1 = hs.z1, zm = (z0 + z1) / 2, w = z1 - z0, h = hs.h;
    void lit;
    // the cornice: its underside (seen from below) and its face
    fill(ctx, c, [[s * HALF, h - 0.5, z0], [s * HALF, h - 0.5, z1], [s * (HALF - 0.32), h - 0.42, z1], [s * (HALF - 0.32), h - 0.42, z0]], shade(mixHex(hs.trim, '#5a5060', 0.45), 0, zm, Lt));
    fill(ctx, c, [[s * (HALF - 0.32), h - 0.42, z0], [s * (HALF - 0.32), h - 0.42, z1], [s * (HALF - 0.32), h, z1], [s * (HALF - 0.32), h, z0]], trim);
    if (hs.top === 'attic') {
      fill(ctx, c, wallQ(s, z0, z1, h, h + 0.85, -0.2), wall);
      fill(ctx, c, wallQ(s, z0, z1, h + 0.75, h + 0.95, -0.25), trim);
      for (const z of [z0 + 0.25, z1 - 0.25, zm]) {
        const x = s * (HALF - 0.25);
        const [px, py] = project(c, x, h + 0.95, z);
        const r = (c.f * 0.22) / z;
        ctx.fillStyle = trim;
        ctx.beginPath();
        ctx.ellipse(px, py - r * 1.1, r * 0.75, r * 1.1, 0, 0, TAU);
        ctx.fill();
      }
    } else if (hs.top === 'gable') {
      ctx.fillStyle = wall;
      const x = s * (HALF - 0.05);
      const a = w * 0.36;
      if (path(ctx, c, [[x, h, zm - a], [x, h + 0.9, zm - a], [x, h + 1.7, zm - a * 0.55], [x, h + 2.7, zm - 0.25], [x, h + 2.7, zm + 0.25], [x, h + 1.7, zm + a * 0.55], [x, h + 0.9, zm + a], [x, h, zm + a]])) ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = Math.max(1, (c.f * 0.16) / zm);
      if (path(ctx, c, [[x, h + 0.9, zm - a], [x, h + 1.7, zm - a * 0.55], [x, h + 2.7, zm - 0.25], [x, h + 2.7, zm + 0.25], [x, h + 1.7, zm + a * 0.55], [x, h + 0.9, zm + a]])) ctx.stroke();
      // an oculus
      const [ox, oy] = project(c, x, h + 1.55, zm);
      const [ox2] = project(c, x, h + 1.55, zm + 0.42);
      ctx.fillStyle = shade('#3a4252', 0.1, zm, Lt);
      ctx.beginPath();
      ctx.ellipse(ox, oy, Math.max(0.6, Math.abs(ox2 - ox)), (c.f * 0.42) / zm, 0, 0, TAU);
      ctx.fill();
    } else if (hs.top === 'step') {
      ctx.fillStyle = wall;
      const x = s * (HALF - 0.05);
      const a = w * 0.42;
      const pts: V3[] = [[x, h, zm - a]];
      for (let k = 0; k < 3; k++) {
        const zz = zm - a + (a / 3) * k;
        pts.push([x, h + 0.9 * (k + 1), zz], [x, h + 0.9 * (k + 1), zz + a / 3]);
      }
      for (let k = 2; k >= 0; k--) {
        const zz = zm + a - (a / 3) * k;
        pts.push([x, h + 0.9 * (k + 1), zz - a / 3], [x, h + 0.9 * (k + 1), zz]);
      }
      pts.push([x, h, zm + a]);
      if (path(ctx, c, pts)) ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = Math.max(1, (c.f * 0.14) / zm);
      if (path(ctx, c, pts.slice(1, -1))) ctx.stroke();
    }
  }

  private window(ctx: CanvasRenderingContext2D, c: Cam, s: number, za: number, zb: number, y0: number, y1: number, idx: number, hs: House, lit: number, Lt: Light, day: number): void {
    const zm = (za + zb) / 2;
    const on = windowLit(idx, day);
    // the shutters
    if (hs.shut) {
      const sh = shade(hs.shut, lit, zm, Lt);
      fill(ctx, c, wallQ(s, za - 0.5, za - 0.04, y0, y1, -0.01), sh);
      fill(ctx, c, wallQ(s, zb + 0.04, zb + 0.5, y0, y1, -0.01), sh);
    }
    // the frame, the reveal on the far side (the wall's thickness), the glass
    fill(ctx, c, wallQ(s, za - 0.1, zb + 0.1, y0 - 0.1, y1 + 0.12, -0.01), shade(hs.trim, lit, zm, Lt));
    fill(ctx, c, wallQ(s, za, zb, y0, y1, -0.012), shade(mixHex(hs.col, '#3a3440', 0.4), lit * 0.4, zm, Lt));
    const sky = mixHex(rgbHex(Lt.mid), rgbHex(Lt.hor), 0.4);
    const dark = shade('#2e3846', 0.15, zm, Lt);
    let glass = mixHex(dark, sky, 0.28 * (1 - Lt.dusk));
    if (on > 0.02) glass = mixHex(glass, hash(idx + 5) < 0.3 ? '#ffd9a0' : '#ffc46e', on);
    fill(ctx, c, wallQ(s, za + 0.12, zb, y0 + 0.08, y1, 0.1), glass);
    // a curtain's edge in a lit window, a pale reflection in a dark one
    if (on > 0.02) {
      fill(ctx, c, wallQ(s, zb - 0.28, zb, y0 + 0.08, y1, 0.09), rgba(hash(idx) < 0.5 ? '#c86a4a' : '#e8d8b0', 0.55 * on));
    } else {
      fill(ctx, c, [[s * (HALF + 0.09), y0 + 0.5, za + 0.2], [s * (HALF + 0.09), y1 - 0.1, za + 0.55], [s * (HALF + 0.09), y1 - 0.1, za + 0.75], [s * (HALF + 0.09), y0 + 0.5, za + 0.4]], rgba('#ffffff', 0.08 + 0.06 * (1 - Lt.dusk)));
    }
    // the cross bar and the sill
    fill(ctx, c, wallQ(s, za + 0.12, zb, (y0 + y1) / 2 + 0.15, (y0 + y1) / 2 + 0.22, 0.08), shade(hs.trim, lit * 0.6, zm, Lt));
    fill(ctx, c, [[s * HALF, y0 - 0.1, za - 0.15], [s * HALF, y0 - 0.1, zb + 0.15], [s * (HALF - 0.14), y0 - 0.05, zb + 0.15], [s * (HALF - 0.14), y0 - 0.05, za - 0.15]], shade(hs.trim, 0.6, zm, Lt));
    // flowers on some sills
    if (hash(idx * 3 + 9) < 0.22 && y0 < 9) {
      const cols = ['#e0607a', '#f2a03a', '#d24a4a', '#f4d04a'];
      for (let k = 0; k < 4; k++) {
        const z = za + 0.12 + k * 0.26;
        const [px, py] = project(c, s * (HALF - 0.12), y0 + 0.06, z);
        const r = (c.f * 0.14) / z;
        ctx.fillStyle = shade('#4f7a46', 0.3, z, Lt);
        ctx.beginPath();
        ctx.arc(px, py - r * 0.4, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = shade(cols[(idx + k) % 4], 0.6, z, Lt);
        ctx.beginPath();
        ctx.arc(px, py - r * 0.9, r * 0.55, 0, TAU);
        ctx.fill();
      }
    }
  }

  private shopFront(ctx: CanvasRenderingContext2D, c: Cam, hs: House, wall: string, trim: string, lit: number, Lt: Light, day: number): void {
    const s = hs.s, z0 = hs.z0, z1 = hs.z1, zm = (z0 + z1) / 2;
    void wall;
    // shops light up in the evening (and the bakery and the grocer already at dawn)
    const warm = hs.shop === 'door' ? 0 : Math.max(band(0.76, 0.84, day), hs.shop === 'bakery' || hs.shop === 'grocer' ? 1 - band(0.08, 0.16, day) : 0);
    const glassDay = mixHex(shade('#26303c', 0.1, zm, Lt), mixHex(rgbHex(Lt.mid), rgbHex(Lt.hor), 0.5), 0.3 * (1 - Lt.dusk));
    if (hs.shop === 'door') {
      // a house door with an arch and two small windows
      const dz0 = zm - 0.75, dz1 = zm + 0.75;
      fill(ctx, c, wallQ(s, dz0 - 0.15, dz1 + 0.15, 0, 3.0, -0.01), trim);
      fill(ctx, c, wallQ(s, dz0, dz1, 0, 2.75, 0.06), shade(hash(z0) < 0.5 ? '#5a3a28' : '#2f4a5a', lit * 0.5, zm, Lt));
      fill(ctx, c, wallQ(s, dz0 + 0.1, dz1 - 0.1, 2.3, 2.65, 0.05), mixHex(glassDay, '#ffc878', warm * 0.6 + band(0.8, 0.86, day) * 0.4));
      for (const zz of [z0 + 0.6, z1 - 1.6]) {
        if (zz + 1 > dz0 - 0.2 && zz < dz1 + 0.2) continue;
        fill(ctx, c, wallQ(s, zz - 0.08, zz + 1.08, 0.9, 2.62, -0.01), trim);
        fill(ctx, c, wallQ(s, zz, zz + 1, 1.0, 2.5, 0.08), glassDay);
      }
      return;
    }
    // a shop: the sign band, the big window, the door
    const SIGN_COL: Record<string, string> = { cafe: '#2f5a4a', bakery: '#7a3a2a', florist: '#4a6a3a', pharmacy: '#f2f2ea', books: '#34466a', grocer: '#5a3a2a', shop: '#4a4658' };
    fill(ctx, c, wallQ(s, z0 + 0.25, z1 - 0.25, 2.8, 3.38, -0.02), shade(SIGN_COL[hs.shop] ?? '#4a4658', lit, zm, Lt));
    fill(ctx, c, wallQ(s, z0 + 0.25, z1 - 0.25, 2.8, 2.86, -0.03), shade('#d8b060', lit + 0.3, zm, Lt));
    fill(ctx, c, wallQ(s, z0 + 0.25, z1 - 0.25, 3.32, 3.38, -0.03), shade('#d8b060', lit + 0.3, zm, Lt));
    const wz0 = z0 + 0.55, wz1 = z1 - 2.0, dz0 = z1 - 1.75, dz1 = z1 - 0.6;
    const frame = shade(SIGN_COL[hs.shop] ?? '#4a4658', lit * 0.8, zm, Lt);
    fill(ctx, c, wallQ(s, wz0 - 0.12, wz1 + 0.12, 0.45, 2.66, -0.01), frame);
    fill(ctx, c, wallQ(s, dz0 - 0.12, dz1 + 0.12, 0, 2.66, -0.01), frame);
    const inside = mixHex(glassDay, hs.shop === 'pharmacy' ? '#e8fff0' : '#ffcf86', warm * 0.92);
    fill(ctx, c, wallQ(s, wz0, wz1, 0.55, 2.56, 0.1), inside);
    fill(ctx, c, wallQ(s, dz0, dz1, 0.04, 2.56, 0.1), mixHex(inside, '#000000', 0.15));
    // what is in the window
    const items = (cols: string[], rows: number, y0: number, kind: 'round' | 'book' | 'bread' | 'leaf'): void => {
      const n = Math.max(2, Math.floor((wz1 - wz0) / 0.42));
      for (let r = 0; r < rows; r++) {
        for (let i = 0; i < n; i++) {
          const z = wz0 + 0.2 + (i + 0.5) * ((wz1 - wz0 - 0.4) / n);
          const y = y0 + r * 0.45;
          const col = shade(cols[(i * 3 + r) % cols.length], 0.4, z, Lt, warm * 0.08);
          const [px, py] = project(c, s * (HALF + 0.12), y, z);
          const k = c.f / z;
          ctx.fillStyle = col;
          ctx.beginPath();
          if (kind === 'book') ctx.rect(px - k * 0.03, py - k * 0.36, Math.max(1, k * 0.07), k * 0.36);
          else if (kind === 'bread') ctx.ellipse(px, py - k * 0.1, k * 0.09, k * 0.07, 0, 0, TAU);
          else if (kind === 'leaf') ctx.ellipse(px, py - k * 0.14, k * 0.06, k * 0.16, 0.2 * (i % 3 - 1), 0, TAU);
          else ctx.arc(px, py - k * 0.08, k * 0.07, 0, TAU);
          ctx.fill();
        }
      }
    };
    if (hs.shop === 'bakery') items(['#c8873a', '#e0a85a', '#a8642a', '#f0c27a'], 3, 1.0, 'bread');
    else if (hs.shop === 'books') items(['#b84a3a', '#3a6a8a', '#e0b84a', '#4a7a4a', '#7a4a8a', '#e8e0d0'], 3, 1.1, 'book');
    else if (hs.shop === 'florist') items(['#4f8a46', '#6aa25a', '#3f7a3a'], 2, 1.0, 'leaf');
    else if (hs.shop === 'grocer') items(['#f2a03a', '#d84a3a', '#a8c84a', '#f4d04a'], 2, 0.9, 'round');
    else if (hs.shop === 'cafe') {
      // the café: a counter, pendant lamps over it
      fill(ctx, c, wallQ(s, wz0 + 0.1, wz1 - 0.1, 0.55, 1.25, 0.14), shade('#6a4a34', 0.3, zm, Lt, warm * 0.05));
      const n = 3;
      for (let i = 0; i < n; i++) {
        const z = wz0 + (i + 0.5) * ((wz1 - wz0) / n);
        const [px, py] = project(c, s * (HALF + 0.14), 2.5, z), [, py2] = project(c, s * (HALF + 0.14), 1.95, z);
        const k = c.f / z;
        ctx.strokeStyle = shade('#2a2420', 0.2, z, Lt);
        ctx.lineWidth = Math.max(0.6, k * 0.02);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px, py2);
        ctx.stroke();
        ctx.fillStyle = warm > 0.1 ? mixHex(shade('#d8b070', 0.5, z, Lt), '#fff0c0', warm) : shade('#c89a5a', 0.4, z, Lt);
        ctx.beginPath();
        ctx.moveTo(px - k * 0.16, py2 + k * 0.12);
        ctx.quadraticCurveTo(px, py2 - k * 0.12, px + k * 0.16, py2 + k * 0.12);
        ctx.closePath();
        ctx.fill();
      }
    }
    // a pane's sheen
    fill(ctx, c, [[s * (HALF + 0.09), 0.7, wz0 + 0.2], [s * (HALF + 0.09), 2.4, wz0 + 0.9], [s * (HALF + 0.09), 2.4, wz0 + 1.2], [s * (HALF + 0.09), 0.7, wz0 + 0.5]], rgba('#ffffff', 0.07 + 0.08 * (1 - Lt.dusk)));
  }

  private awning(ctx: CanvasRenderingContext2D, c: Cam, hs: House, Lt: Light): void {
    const s = hs.s, z0 = hs.z0 + 0.3, z1 = hs.z1 - 0.3, out = 1.5, yT = 3.0, yB = 2.42, val = 0.26;
    const lit = litSide(s, Lt);
    const n = Math.max(2, Math.round((z1 - z0) / 0.42));
    const step = (z1 - z0) / n;
    const cols = hs.awn;
    for (let i = 0; i < n; i++) {
      const a = z0 + i * step, b = a + step;
      const col = cols[i % cols.length];
      const zm = (a + b) / 2;
      // the underside (in its own shade, a little light through it)
      fill(ctx, c, [[s * HALF, yT, a], [s * HALF, yT, b], [s * (HALF - out), yB, b], [s * (HALF - out), yB, a]], shade(mixHex(col, '#2a2428', 0.35), 0.25 + lit * 0.3, zm, Lt));
      // the valance with its scallop
      const vc = shade(col, lit + 0.25, zm, Lt);
      ctx.fillStyle = vc;
      const x = s * (HALF - out);
      const q = clipZ([[x, yB, a], [x, yB, b], [x, yB - val, b], [x, yB - val, a]]);
      if (q.length >= 3) {
        const [pa, qa] = project(c, x, yB, a), [pb, qb] = project(c, x, yB, b);
        const [, qa2] = project(c, x, yB - val, a), [, qb2] = project(c, x, yB - val, b);
        ctx.beginPath();
        ctx.moveTo(pa, qa);
        ctx.lineTo(pb, qb);
        ctx.lineTo(pb, qb2);
        ctx.quadraticCurveTo((pa + pb) / 2, (qa2 + qb2) / 2 + (qb2 - qb) * 0.55, pa, qa2);
        ctx.closePath();
        ctx.fill();
      }
    }
    // the valance's top edge catches the light
    ctx.strokeStyle = shade('#fff4e0', lit + 0.4, (z0 + z1) / 2, Lt);
    ctx.lineWidth = Math.max(0.8, (c.f * 0.03) / ((z0 + z1) / 2));
    if (path(ctx, c, [[s * (HALF - out), yB, z0], [s * (HALF - out), yB, z1]])) ctx.stroke();
  }

  // ── the street's furniture ─────────────────────────────────────────

  private lamp(ctx: CanvasRenderingContext2D, c: Cam, x: number, z: number, Lt: Light): void {
    if (z < ZN + 0.5) return;
    const k = c.f / z;
    const s = Math.sign(x);
    const [px, py] = project(c, x, PAVE, z);
    const col = shade('#2c3430', 0.3, z, Lt);
    ctx.fillStyle = col;
    // the base, the post, the bracket over the pavement and the lantern
    ctx.fillRect(px - k * 0.12, py - k * 0.5, k * 0.24, k * 0.5);
    ctx.fillRect(px - k * 0.055, py - k * 4.1, k * 0.11, k * 3.7);
    const [lx, ly] = project(c, x - s * 0.55, 4.05, z);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(1, k * 0.06);
    ctx.beginPath();
    ctx.moveTo(px, py - k * 4.0);
    ctx.quadraticCurveTo(px, py - k * 4.35, lx, ly - k * 0.12);
    ctx.stroke();
    const on = Lt.lamps;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(lx - k * 0.2, ly);
    ctx.lineTo(lx + k * 0.2, ly);
    ctx.lineTo(lx + k * 0.13, ly + k * 0.08);
    ctx.lineTo(lx - k * 0.13, ly + k * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = on > 0.05 ? mixHex(shade('#d8d4c4', 0.4, z, Lt), '#fff0c4', on) : shade('#d8d4c4', 0.4, z, Lt);
    ctx.beginPath();
    ctx.moveTo(lx - k * 0.13, ly + k * 0.08);
    ctx.lineTo(lx + k * 0.13, ly + k * 0.08);
    ctx.lineTo(lx + k * 0.09, ly + k * 0.42);
    ctx.lineTo(lx - k * 0.09, ly + k * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = col;
    ctx.fillRect(lx - k * 0.11, ly + k * 0.42, k * 0.22, k * 0.05);
  }

  private tree(ctx: CanvasRenderingContext2D, c: Cam, t: { x: number; z: number; r: number; cy: number }, Lt: Light): void {
    const k = c.f / t.z;
    const [bx, by] = project(c, t.x, PAVE, t.z);
    // a grate round its foot, the trunk, the crown in clusters (the sun's side lighter)
    ctx.fillStyle = shade('#5a524a', 0.3, t.z, Lt);
    ctx.beginPath();
    ctx.ellipse(bx, by, k * 0.7, k * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade('#5a4636', 0.3 + Math.max(0, -Lt.L[0] * Math.sign(t.x)) * 0.5, t.z, Lt);
    ctx.beginPath();
    ctx.moveTo(bx - k * 0.2, by);
    ctx.lineTo(bx - k * 0.11, by - k * (t.cy - t.r * 0.4));
    ctx.lineTo(bx + k * 0.11, by - k * (t.cy - t.r * 0.4));
    ctx.lineTo(bx + k * 0.2, by);
    ctx.closePath();
    ctx.fill();
    const [cx, cy] = project(c, t.x, t.cy, t.z);
    const R = k * t.r;
    // the light's side on the crown: the sun's direction on screen (x), from above at noon
    const lx = Math.max(-1, Math.min(1, Lt.L[0] * 1.4)), ly = Math.min(1, 0.4 + Lt.L[1]);
    const sunK = Lt.sunI;
    const tones = [
      shade('#2f5232', 0.05, t.z, Lt), shade('#3f6a3c', 0.25, t.z, Lt),
      shade('#55804a', 0.45 + 0.35 * sunK, t.z, Lt), shade('#79a35a', 0.55 + 0.45 * sunK, t.z, Lt),
    ];
    // many small leaf clusters in four tones: the dark under-crown first, the lit ones toward the light
    for (let pass = 0; pass < 4; pass++) {
      ctx.fillStyle = tones[pass];
      const n = [16, 18, 14, 9][pass];
      for (let i = 0; i < n; i++) {
        const a = hash(i * 5 + pass * 31 + t.z) * TAU, d = Math.sqrt(hash(i * 7 + pass * 17 + t.z + 1));
        const spread = [0.78, 0.7, 0.58, 0.46][pass];
        let ox = Math.cos(a) * d * R * spread, oy = Math.sin(a) * d * R * spread * 0.82;
        ox += lx * R * 0.1 * pass;
        oy -= ly * R * 0.08 * pass - (pass === 0 ? R * 0.08 : 0);
        const r = R * [0.3, 0.25, 0.2, 0.15][pass] * (0.75 + 0.5 * hash(i * 3 + pass + 3));
        ctx.beginPath();
        ctx.ellipse(cx + ox, cy + oy, r, r * 0.86, hash(i + pass) * 3, 0, TAU);
        ctx.fill();
      }
    }
  }

  private bench(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const b = BENCH, x = b.x, wood = '#8a5a3a', iron = '#2c3430';
    const lit = litSide(-1, Lt);
    for (const z of [b.z0 + 0.1, b.z1 - 0.1]) fill(ctx, c, [[x - 0.2, PAVE, z], [x + 0.2, PAVE, z], [x + 0.2, 0.46, z], [x - 0.2, 0.46, z]], shade(iron, 0.2, z, Lt));
    fill(ctx, c, flatQ(0.46, x - 0.22, x + 0.22, b.z0, b.z1), shade(wood, Lt.L[1] + 0.2, b.z0, Lt));
    fill(ctx, c, [[x + 0.22, 0.4, b.z0], [x + 0.22, 0.4, b.z1], [x + 0.22, 0.46, b.z1], [x + 0.22, 0.46, b.z0]], shade(wood, lit, b.z0, Lt));
    fill(ctx, c, wallQ(-1, b.z0, b.z1, 0.55, 0.95, -(HALF + x) - 0.24), shade(wood, lit, b.z0, Lt));
  }

  private busStop(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const b = BUS_STOP, x = b.x;
    const lit = litSide(-1, Lt);
    const frame = shade('#3c4a52', 0.3, b.z0, Lt);
    // the back glass (the wall seen through it), the roof's underside and edge, the posts
    fill(ctx, c, wallQ(-1, b.z0, b.z1, 0.15, 2.3, -(HALF + x)), rgba(mixHex(rgbHex(Lt.mid), '#ffffff', 0.3), 0.28));
    fill(ctx, c, wallQ(-1, b.z0, b.z1, 1.7, 2.3, -(HALF + x) - 0.01), rgba(shade('#e9e2d0', lit + 0.3, b.z0, Lt), 0.85));
    fill(ctx, c, flatQ(2.32, x - 0.1, x + 1.1, b.z0 - 0.1, b.z1 + 0.1), shade('#2c3238', 0.1, b.z0, Lt));
    fill(ctx, c, [[x - 0.1, 2.32, b.z0 - 0.1], [x + 1.1, 2.32, b.z0 - 0.1], [x + 1.1, 2.48, b.z0 - 0.1], [x - 0.1, 2.48, b.z0 - 0.1]], frame);
    for (const z of [b.z0, b.z1]) {
      const [p, q] = project(c, x + 1.0, 2.32, z), [, q2] = project(c, x + 1.0, PAVE, z);
      ctx.fillStyle = frame;
      ctx.fillRect(p - (c.f * 0.04) / z, q, (c.f * 0.08) / z, q2 - q);
    }
    fill(ctx, c, [[x + 0.05, 0.48, b.z0 + 0.3], [x + 0.45, 0.48, b.z0 + 0.3], [x + 0.45, 0.48, b.z1 - 0.3], [x + 0.05, 0.48, b.z1 - 0.3]], shade('#8a8a86', 0.5, b.z0, Lt));
    // the stop's sign: a pole, a round sign with a bus on it
    const p = b.pole;
    const k = c.f / p.z;
    const [px, py] = project(c, p.x, PAVE, p.z);
    ctx.fillStyle = shade('#5a6066', 0.4, p.z, Lt);
    ctx.fillRect(px - k * 0.03, py - k * 2.6, k * 0.06, k * 2.6);
    const sy = py - k * 2.6;
    ctx.fillStyle = shade('#3a7a56', 0.5, p.z, Lt);
    ctx.beginPath();
    ctx.arc(px, sy, k * 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade('#e8c860', 0.6, p.z, Lt);
    ctx.beginPath();
    ctx.arc(px, sy, k * 0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = shade('#2f4a3a', 0.5, p.z, Lt);
    ctx.fillRect(px - k * 0.1, sy - k * 0.07, k * 0.2, k * 0.1);
    ctx.fillRect(px - k * 0.08, sy + k * 0.03, k * 0.04, k * 0.035);
    ctx.fillRect(px + k * 0.04, sy + k * 0.03, k * 0.04, k * 0.035);
    // the timetable under it
    ctx.fillStyle = shade('#f2efe6', 0.5, p.z, Lt);
    ctx.fillRect(px + k * 0.04, py - k * 1.9, k * 0.26, k * 0.36);
  }

  private trafficPole(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const t = TRAFFIC, k = c.f / t.z;
    const [px, py] = project(c, t.x, PAVE, t.z);
    const col = shade('#30363a', 0.3, t.z, Lt);
    ctx.fillStyle = col;
    ctx.fillRect(px - k * 0.05, py - k * t.y0, k * 0.1, k * t.y0);
    const [bx, by] = project(c, t.x, t.y1, t.z);
    ctx.fillRect(bx - k * 0.17, by, k * 0.34, k * (t.y1 - t.y0));
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = shade(['#4a2020', '#4a3a18', '#1c3a26'][i], 0.1, t.z, Lt);
      ctx.beginPath();
      ctx.arc(bx, by + k * (0.15 + i * 0.27), k * 0.095, 0, TAU);
      ctx.fill();
    }
  }

  private table(ctx: CanvasRenderingContext2D, c: Cam, x: number, z: number, Lt: Light): void {
    const k = c.f / z;
    const [px, py] = project(c, x, PAVE, z);
    const iron = shade('#2c3430', 0.3, z, Lt);
    // two chairs, the table's round top and its foot
    for (const dz of [-0.55, 0.55]) {
      const [cx, cy] = project(c, x, PAVE, z + dz);
      const kk = c.f / (z + dz);
      ctx.fillStyle = shade('#a8743a', 0.4, z, Lt);
      ctx.fillRect(cx - kk * 0.2, cy - kk * 0.46, kk * 0.4, kk * 0.06);
      ctx.fillRect(cx - kk * 0.2, cy - kk * 0.9, kk * 0.06, kk * 0.9);
      ctx.fillRect(cx + kk * 0.14, cy - kk * 0.46, kk * 0.05, kk * 0.46);
      ctx.fillRect(cx - kk * 0.2, cy - kk * 0.9, kk * 0.4, kk * 0.05);
    }
    ctx.fillStyle = iron;
    ctx.fillRect(px - k * 0.03, py - k * 0.74, k * 0.06, k * 0.74);
    ctx.fillRect(px - k * 0.2, py - k * 0.03, k * 0.4, k * 0.03);
    ctx.fillStyle = shade('#e8e2d6', Lt.L[1] + 0.3, z, Lt);
    ctx.beginPath();
    ctx.ellipse(px, py - k * 0.76, k * 0.34, k * 0.07, 0, 0, TAU);
    ctx.fill();
    // a cup on it
    ctx.fillStyle = shade('#fbf6ee', 0.8, z, Lt);
    ctx.fillRect(px - k * 0.05, py - k * 0.88, k * 0.1, k * 0.1);
  }

  private bucket(ctx: CanvasRenderingContext2D, c: Cam, z: number, i: number, Lt: Light): void {
    const x = 4.45, k = c.f / z;
    const [px, py] = project(c, x, PAVE, z);
    const cols = ['#e0607a', '#f2a03a', '#f4d04a', '#d24a6a', '#b07ad0', '#ffffff'];
    ctx.fillStyle = shade('#4f7a46', 0.3, z, Lt);
    for (let j = 0; j < 7; j++) {
      ctx.beginPath();
      ctx.ellipse(px + (hash(i * 9 + j) - 0.5) * k * 0.4, py - k * (0.5 + 0.25 * hash(i * 5 + j)), k * 0.05, k * 0.16, (hash(j) - 0.5) * 0.8, 0, TAU);
      ctx.fill();
    }
    for (let j = 0; j < 6; j++) {
      ctx.fillStyle = shade(cols[(i + j) % cols.length], 0.7, z, Lt);
      ctx.beginPath();
      ctx.arc(px + (hash(i * 7 + j + 1) - 0.5) * k * 0.42, py - k * (0.62 + 0.25 * hash(i * 3 + j)), k * 0.075, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = shade('#9aa4a8', 0.5, z, Lt);
    ctx.beginPath();
    ctx.moveTo(px - k * 0.2, py - k * 0.45);
    ctx.lineTo(px + k * 0.2, py - k * 0.45);
    ctx.lineTo(px + k * 0.15, py);
    ctx.lineTo(px - k * 0.15, py);
    ctx.closePath();
    ctx.fill();
  }

  private crates(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const cols = ['#f2a03a', '#d84a3a', '#a8c84a', '#f4d04a'];
    for (let i = 0; i < 3; i++) {
      const z = 7.4 + i * 1.1, x = -4.5, k = c.f / z;
      const [px, py] = project(c, x, PAVE, z);
      ctx.fillStyle = shade('#b08a5a', 0.5, z, Lt);
      ctx.fillRect(px - k * 0.3, py - k * 0.55, k * 0.6, k * 0.55);
      ctx.fillStyle = shade('#8a6a44', 0.3, z, Lt);
      ctx.fillRect(px - k * 0.3, py - k * 0.3, k * 0.6, k * 0.04);
      ctx.fillStyle = shade(cols[i], 0.7, z, Lt);
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.arc(px + (j - 1.5) * k * 0.15, py - k * 0.6, k * 0.08, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** A blade sign hanging from a bracket, facing the viewer: the bakery's pretzel, the pharmacy's cross. */
  private bladeSign(ctx: CanvasRenderingContext2D, c: Cam, s: number, z: number, kind: 'pretzel' | 'cross', Lt: Light, day: number): void {
    const k = c.f / z;
    const [ax, ay] = project(c, s * HALF, 3.75, z);
    const [px, py] = project(c, s * (HALF - 0.75), 3.75, z);
    ctx.strokeStyle = shade('#2c3430', 0.3, z, Lt);
    ctx.lineWidth = Math.max(1, k * 0.05);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(px + s * k * 0.05, py);
    ctx.stroke();
    if (kind === 'pretzel') {
      ctx.strokeStyle = shade('#c8873a', 0.8, z, Lt);
      ctx.lineWidth = Math.max(1.2, k * 0.1);
      const r = k * 0.3, cx = px, cy = py + r * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy + r);
      ctx.bezierCurveTo(cx - r * 2, cy + r * 0.2, cx - r * 1.2, cy - r * 1.4, cx, cy - r * 0.2);
      ctx.bezierCurveTo(cx + r * 1.2, cy - r * 1.4, cx + r * 2, cy + r * 0.2, cx, cy + r);
      ctx.moveTo(cx - r * 0.6, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.6, cy - r * 0.4);
      ctx.moveTo(cx + r * 0.6, cy + r * 0.3);
      ctx.lineTo(cx - r * 0.6, cy - r * 0.4);
      ctx.stroke();
    } else {
      const r = k * 0.32, cx = px, cy = py + r * 1.2;
      const on = band(0.78, 0.86, day);
      ctx.fillStyle = on > 0.05 ? mixHex(shade('#2f9a5a', 0.6, z, Lt), '#7dffb0', on) : shade('#2f9a5a', 0.6, z, Lt);
      ctx.fillRect(cx - r * 0.33, cy - r, r * 0.66, r * 2);
      ctx.fillRect(cx - r, cy - r * 0.33, r * 2, r * 0.66);
    }
  }

  /** The evening's light: lit windows and shops glow, the lamps and their pools on the pavement. */
  private nightLights(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, day: number): void {
    const on = Lt.lamps;
    ctx.globalCompositeOperation = 'lighter';
    if (on > 0.03) {
      for (const lp of LAMPS) {
        if (lp.z < ZN + 0.5) continue;
        const s = Math.sign(lp.x);
        const [lx, ly] = project(c, lp.x - s * 0.55, 3.85, lp.z);
        const k = c.f / lp.z;
        glow(ctx, '#ffd9a0', lx, ly, k * 1.6, 0.42 * on);
        glow(ctx, '#fff2d0', lx, ly, k * 0.4, 0.7 * on);
        const [gx, gy] = project(c, lp.x - s * 0.55, PAVE, lp.z);
        glow(ctx, '#ffc880', gx, gy, k * 2.6, 0.28 * on, 0.22);
      }
    }
    // the shops' and the windows' warmth spilling out
    for (const hs of HOUSES) {
      if (hs.shop === 'door') continue;
      const warm = Math.max(band(0.78, 0.86, day), hs.shop === 'bakery' || hs.shop === 'grocer' ? 1 - band(0.08, 0.16, day) : 0);
      if (warm < 0.03) continue;
      const zm = (hs.z0 + hs.z1) / 2 - 0.6;
      const [gx, gy] = project(c, hs.s * (HALF - 0.6), 1.4, zm);
      const k = c.f / zm;
      glow(ctx, hs.shop === 'pharmacy' ? '#a0ffc8' : '#ffc070', gx, gy, k * 2.6, 0.2 * warm, 0.7);
      const [fx, fy] = project(c, hs.s * (HALF - 1.2), PAVE, zm);
      glow(ctx, '#ffb860', fx, fy, k * 2.8, 0.18 * warm, 0.25);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── the life (live) ─────────────────────────────────────────────

  /** The traffic light's lamp, the pigeons, the cat, the people, the dawn's mist. */
  life(ctx: CanvasRenderingContext2D, day: number, time: number, dt: number): void {
    const c = this.cam, Lt = lightAt(day);
    this.trafficT += this.reduced ? 0 : Math.max(0, Math.min(0.25, dt || 0));
    this.trafficLamp(ctx, c, Lt);
    if (day < 0.8) this.pigeons(ctx, c, Lt, time, 1 - band(0.72, 0.8, day));
    this.cat(ctx, c, Lt, time);
    if (!this.reduced) this.people(ctx, c, Lt, day, time);
    this.mist(ctx, c, Lt, day, time);
  }

  /** The traffic light's state now: mostly green (a green light is a small win), amber, red, red-amber. */
  get light(): 'red' | 'amber' | 'green' | 'redAmber' {
    const t = this.trafficT % 30;
    return t < 16 ? 'green' : t < 18.5 ? 'amber' : t < 28.8 ? 'red' : 'redAmber';
  }

  private trafficLamp(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light): void {
    const t = TRAFFIC, k = c.f / t.z;
    const [bx, by] = project(c, t.x, t.y1, t.z);
    const st = this.light;
    const lamps: [number, string][] = [];
    if (st === 'red' || st === 'redAmber') lamps.push([0, '#ff4a3a']);
    if (st === 'amber' || st === 'redAmber') lamps.push([1, '#ffb43a']);
    if (st === 'green') lamps.push([2, '#3aff8a']);
    for (const [i, col] of lamps) {
      const y = by + k * (0.15 + i * 0.27);
      ctx.fillStyle = mixHex(col, '#ffffff', 0.25);
      ctx.beginPath();
      ctx.arc(bx, y, k * 0.09, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, col, bx, y, k * (0.5 + 0.6 * Lt.dusk), 0.45 + 0.35 * Lt.dusk);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private pigeons(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, time: number, a: number): void {
    const P = PIGEONS;
    ctx.globalAlpha = a;
    for (let i = 0; i < 3; i++) {
      const wander = this.reduced ? 0 : Math.sin(time * 0.13 + i * 2.1);
      const x = lerp(P.x0, P.x1, hash(i * 3 + 41)) + wander * 0.25;
      const z = lerp(P.z0, P.z1, hash(i * 5 + 42)) + (this.reduced ? 0 : Math.cos(time * 0.11 + i) * 0.3);
      const k = c.f / z;
      const [px, py] = project(c, x, 0, z);
      const peck = this.reduced ? 0 : Math.max(0, Math.sin(time * (2.2 + 0.6 * i) + i * 3)) ** 6;
      const dir = Math.cos(time * 0.13 + i * 2.1) >= 0 ? 1 : -1;
      const body = shade('#8a8e9a', Lt.L[1] + 0.2, z, Lt);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(px, py - k * 0.12, k * 0.16, k * 0.09, -0.15 * dir, 0, TAU);
      ctx.fill();
      ctx.fillStyle = shade('#6a6e7c', 0.2, z, Lt);
      ctx.beginPath();
      ctx.ellipse(px - dir * k * 0.06, py - k * 0.13, k * 0.1, k * 0.06, -0.15 * dir, 0, TAU);
      ctx.fill();
      const hx = px + dir * k * (0.14 + 0.04 * peck), hy = py - k * (0.2 - 0.12 * peck);
      ctx.fillStyle = shade('#5a6070', 0.3, z, Lt);
      ctx.beginPath();
      ctx.arc(hx, hy, k * 0.055, 0, TAU);
      ctx.fill();
      ctx.fillStyle = shade('#4a8a7a', 0.5, z, Lt);
      ctx.beginPath();
      ctx.arc(px + dir * k * 0.1, py - k * 0.15, k * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private cat(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, time: number): void {
    const z = CAT.z, k = c.f / z;
    const [px, py] = project(c, CAT.x - Math.sign(CAT.x) * 0.15, CAT.y, z);
    const col = shade('#3a3236', 0.2, z, Lt);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    // sitting: body, head with ears, and the tail hanging over the sill, swaying slowly
    ctx.beginPath();
    ctx.ellipse(px, py - k * 0.2, k * 0.15, k * 0.22, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py - k * 0.48, k * 0.11, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px - k * 0.1, py - k * 0.52);
    ctx.lineTo(px - k * 0.07, py - k * 0.66);
    ctx.lineTo(px - k * 0.01, py - k * 0.56);
    ctx.moveTo(px + k * 0.1, py - k * 0.52);
    ctx.lineTo(px + k * 0.07, py - k * 0.66);
    ctx.lineTo(px + k * 0.01, py - k * 0.56);
    ctx.fill();
    const sw = this.reduced ? 0.3 : Math.sin(time * 0.9) * 0.6;
    ctx.lineWidth = Math.max(1, k * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px + k * 0.08, py - k * 0.05);
    ctx.quadraticCurveTo(px + k * (0.2 + sw * 0.1), py + k * 0.25, px + k * (0.1 + sw * 0.18), py + k * 0.42);
    ctx.stroke();
    // its eyes catch the evening's light
    if (Lt.dusk > 0.5) {
      ctx.fillStyle = rgba('#e8f070', (Lt.dusk - 0.5) * 1.6);
      ctx.fillRect(px - k * 0.06, py - k * 0.5, k * 0.035, k * 0.02);
      ctx.fillRect(px + k * 0.025, py - k * 0.5, k * 0.035, k * 0.02);
    }
  }

  private people(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, day: number, time: number): void {
    const walkers = [
      { x: -4.1, dir: 1, per: 46, off: 0, coat: '#4a5a7a' },
      { x: 4.0, dir: -1, per: 58, off: 23, coat: '#8a4a3a' },
      { x: -3.7, dir: -1, per: 71, off: 40, coat: '#5a6a4a' },
    ];
    const n = day > 0.9 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const w = walkers[i];
      const t = ((time + w.off) % w.per) / w.per;
      const z = w.dir > 0 ? lerp(11, 44, t) : lerp(44, 14, t);
      const fade = Math.min(1, t * 8, (1 - t) * 8);
      const k = c.f / z;
      const [px, py] = project(c, w.x, PAVE, z);
      const ph = time * 5.2 + i;
      const body = shade(w.coat, 0.3, z, Lt), dark = shade('#2a2830', 0.2, z, Lt), skin = shade('#c89a7a', 0.4, z, Lt);
      ctx.globalAlpha = fade * 0.92;
      // the legs scissoring, the coat, the head
      ctx.strokeStyle = dark;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, k * 0.13);
      for (const sgn of [-1, 1]) {
        const sw = Math.sin(ph) * sgn * k * 0.1;
        ctx.beginPath();
        ctx.moveTo(px, py - k * 0.85);
        ctx.lineTo(px + sw * 0.3, py - k * 0.05 + Math.abs(sw) * 0.2);
        ctx.stroke();
      }
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(px - k * 0.2, py - k * 1.45);
      ctx.quadraticCurveTo(px - k * 0.24, py - k * 1.0, px - k * 0.2, py - k * 0.75);
      ctx.lineTo(px + k * 0.2, py - k * 0.75);
      ctx.quadraticCurveTo(px + k * 0.24, py - k * 1.0, px + k * 0.2, py - k * 1.45);
      ctx.quadraticCurveTo(px, py - k * 1.55, px - k * 0.2, py - k * 1.45);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.arc(px, py - k * 1.64, k * 0.11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.arc(px, py - k * 1.68, k * 0.1, Math.PI, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private mist(ctx: CanvasRenderingContext2D, c: Cam, Lt: Light, day: number, time: number): void {
    const a = (1 - band(0.04, 0.16, day)) * 0.5;
    if (a < 0.01) return;
    const col = rgbHex(Lt.haze);
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 7; i++) {
      const z = 14 + i * 5;
      const k = c.f / z;
      const drift = this.reduced ? 0 : Math.sin(time * 0.05 + i) * 2;
      const [px, py] = project(c, -2 + 4 * hash(i + 60) + drift, 0.6, z);
      glow(ctx, col, px, py, k * 7, a * 0.55, 0.28);
    }
    void hazeAt;
  }
}
