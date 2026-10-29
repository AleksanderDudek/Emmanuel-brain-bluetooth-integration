/**
 * Glina's clay on the wheel, as numbers only (no DOM, no randomness), so every rule is unit-tested.
 *
 * A vessel is a surface of revolution: its height H (cm) and the outer radius r[k] (cm) at 16
 * rings, u_k = k/15 from the foot to the rim.  A form names a nominal height N and its target
 * profile q*[k] (radius ÷ height), so the dotted outline the player matches is H·q*[k] at the
 * current height.  Pulling raises H at constant radii (the cylinder rises and its walls narrow
 * against the outline, so a potter widens afterwards); a sideways drag moves the wall in or out
 * under a Gaussian brush at the hand's height.  The chalk line caps the height: within its last
 * 3 % the pull eases, and at the line it stops with a creak.
 *
 * Whatever the input, the shape stays intentional: radii are clamped, the curvature between three
 * rings is limited to 0.2·H, a light smoothing runs while the wheel turns, the foot stays between
 * 0.3 and 0.9 of the widest ring and the rim keeps a little body (the randomised test in
 * arcade-glina.test.ts drives thousands of random gestures through it).
 *
 * The only failure is the player's own act, Jeremiah 18:4: a drag held 24 px past the line for
 * 0.6 s (or a key held at the line for 1.2 s) twists the wall, and it slumps; the hands gather it
 * back into a centred lump in 1.2 s.  Taps and presses never overpull.
 */

export const RINGS = 16;
/** The rings' heights as a share of the vessel's height, foot (0) to rim (1). */
export const U: Float64Array = Float64Array.from({ length: RINGS }, (_, k) => k / (RINGS - 1));

export const CLAY = {
  /** the chalk line spans these shares of the nominal height */
  hmin: 0.5,
  hmax: 1.25,
  /** the lump: its height (× N), its radius (× the target's mean radius at N) and its taper */
  h0: 0.3,
  r0: 0.8,
  taper: 0.12,
  /** the pull eases within this share of the line's span below the line, down to this factor */
  ease: 0.03,
  easeMin: 0.15,
  /** a tap or a key press (× N), a held key (× N per s), a drag (cm per px ÷ the stage scale) */
  tap: 0.06,
  hold: 0.25,
  drag: 0.6,
  /** the shaping brush's width (in u), the keys' shaping speed (cm/s) and the hand's speed (u per s) */
  brush: 0.12,
  keyShape: 3,
  handSpeed: 0.8,
  /** the curvature limit (× H), the smoothing's weight and how many smoothing passes run per second */
  curve: 0.2,
  lambda: 0.08,
  passes: 2,
  /** the foot's share of the widest ring, the rim's body (cm) above the thinnest wall */
  footLo: 0.3,
  footHi: 0.9,
  rim: 0.4,
  /** rMin = 0.06·N + 0.6 cm; rMax = 1.3·max(q*)·Hmax */
  rMinN: 0.06,
  rMinC: 0.6,
  rMax: 1.3,
  /** the overpull: the finger 24 px past the contact for 0.6 s, or a key held at the line for 1.2 s; the slump takes 1.2 s */
  overPx: 24,
  overSec: 0.6,
  keyOverSec: 1.2,
  slump: 1.2,
  /** a ring "fits" within this share of its target */
  fit: 0.08,
} as const;

/** What a form gives the clay: its nominal height (cm) and the target profile (radius ÷ height) at the 16 rings. */
export interface ClayForm {
  N: number;
  q: Float64Array;
}

/**
 * The target profile at the 16 rings from a form's control points (u, q*), interpolated with a
 * monotone cubic (Fritsch–Carlson), so the outline never overshoots between its points.
 */
export function profileFrom(points: readonly (readonly [number, number])[]): Float64Array {
  const n = points.length;
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const d: number[] = [], m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }
  const out = new Float64Array(RINGS);
  for (let k = 0; k < RINGS; k++) {
    const u = U[k];
    let i = 0;
    while (i < n - 2 && u > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (u - xs[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    out[k] = h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  }
  return out;
}

/** A clay's limits for a form. */
export function limits(f: ClayForm) {
  let maxQ = 0, sumQ = 0;
  for (let k = 0; k < RINGS; k++) {
    maxQ = Math.max(maxQ, f.q[k]);
    sumQ += f.q[k];
  }
  const Hmin = CLAY.hmin * f.N, Hmax = CLAY.hmax * f.N;
  return {
    Hmin, Hmax, H0: CLAY.h0 * f.N, R0: CLAY.r0 * (sumQ / RINGS) * f.N,
    rMin: CLAY.rMinN * f.N + CLAY.rMinC, rMax: CLAY.rMax * maxQ * Hmax, maxQ,
  };
}

/** The line's height (cm) for the brain's fill F (0..1). */
export const lineAt = (f: ClayForm, F: number): number => CLAY.hmin * f.N + (CLAY.hmax - CLAY.hmin) * f.N * Math.min(1, Math.max(0, F));

/** Stars for a similarity: ★ always, ★★ from 0.75, ★★★ from 0.90 (the first-ever vessel: 0.70 and 0.85). */
export function starsFor(sim: number, first = false): 1 | 2 | 3 {
  const [two, three] = first ? [0.7, 0.85] : [0.75, 0.9];
  return sim >= three - 1e-9 ? 3 : sim >= two - 1e-9 ? 2 : 1;
}

/** The next star's threshold when the shape fell within 5 points of it (the honest near miss), else null. */
export function nextStar(sim: number, first = false): number | null {
  const [two, three] = first ? [0.7, 0.85] : [0.75, 0.9];
  const next = sim < two - 1e-9 ? two : sim < three - 1e-9 ? three : null;
  return next !== null && next - sim <= 0.05 + 1e-9 ? next : null;
}

/** What a pull did: nothing, raised the wall, reached the line now, or pushed against it. */
export type PullResult = 'none' | 'moved' | 'contact' | 'blocked';

export class Clay {
  readonly r = new Float64Array(RINGS);
  H = 0;
  /** the cap the wall may rise to (cm): the chalk line in a visible throw, the dusk line in a blind one */
  line: number;
  /** the hand's height (u, 0.05..1) and the finger's side of the axis (+1 right, −1 left) */
  hand = 0.5;
  side = 1;
  /** the first pull happened: the vessel counts in the headline */
  opened = false;
  /** a Druga forma happened on this vessel */
  second = false;
  /** overpulling may slump the wall (false in the first-ever vessel and the sponge's last seconds) */
  overpull = true;
  /** the strain before a slump (0..1) and the slump's time left (s); while it runs, input is ignored */
  strain = 0;
  slump = 0;
  /** the profile as the slump began (the view sags it into the lump) */
  readonly before = new Float64Array(RINGS);
  beforeH = 0;
  /** the finger's y (px) on the screen while it drags, and where it was when the wall met the line */
  private fingerY: number | null = null;
  private contactY: number | null = null;
  private fingerT = 0;
  private keyT = 0;
  /** a held key pulls continuously (the sim switches it on after the press) */
  keyHold = false;
  private settleAcc = 0;
  private readonly tmp = new Float64Array(RINGS);
  readonly lim: ReturnType<typeof limits>;

  constructor(readonly form: ClayForm, line?: number) {
    this.lim = limits(form);
    this.line = line ?? this.lim.Hmin;
    this.lump();
  }

  /** The centred lump: H0 high, R0 wide, a little narrower at the top. */
  lump(): void {
    const { H0, R0 } = this.lim;
    this.H = H0;
    for (let k = 0; k < RINGS; k++) this.r[k] = R0 * (1 - CLAY.taper * U[k]);
    this.intentional();
  }

  /** The target radius at ring k for the current height (cm). */
  target(k: number): number { return this.H * this.form.q[k]; }

  get atLine(): boolean { return this.H >= this.line - 1e-6; }

  /** Whether touch shapes the clay now (not while it slumps). */
  get free(): boolean { return this.slump <= 0; }

  // ── input ──────────────────────────────────────────────────────
  /** Raise the wall by `dh` cm, easing within the last 3 % below the line and stopping at it. */
  pull(dh: number): PullResult {
    if (!(dh > 0) || !this.free) return 'none';
    const span = this.lim.Hmax - this.lim.Hmin;
    const gap = this.line - this.H;
    if (gap <= 1e-6) return 'blocked';
    const band = CLAY.ease * span;
    const k = gap < band ? Math.max(CLAY.easeMin, gap / band) : 1;
    this.H = Math.min(this.line, this.H + dh * k);
    this.opened = true;
    this.intentional();
    return this.atLine ? 'contact' : 'moved';
  }

  /** A tap or a key press: a small pull (never an overpull). */
  tap(): PullResult { return this.pull(CLAY.tap * this.form.N); }

  /** Move the wall out (+) or in (−) by `dr` cm at the brush's centre, the hand's height. */
  shape(dr: number): void {
    if (!dr || !this.free) return;
    const uf = this.hand;
    for (let k = 0; k < RINGS; k++) {
      const z = (U[k] - uf) / CLAY.brush;
      this.r[k] += dr * Math.exp(-z * z);
    }
    this.intentional();
  }

  /** A finger lands at height `u` on the vessel, on `side` of the axis: the hand moves there. */
  touch(u: number, side: number): void {
    this.hand = Math.min(1, Math.max(0.05, u));
    this.side = side < 0 ? -1 : 1;
  }

  /**
   * One step of a drag: `dxOut` px away from the axis on the finger's side (+ widens), `dyUp` px
   * upward (pulls), the finger at `fingerY` px, `scale` px per cm.  Up and out flares a bowl, up and
   * in draws a neck.
   */
  drag(dxOut: number, dyUp: number, fingerY: number, u: number, scale: number): PullResult {
    this.fingerY = fingerY;
    if (!this.free) return 'none';
    this.hand = Math.min(1, Math.max(0.05, u));
    let res: PullResult = 'none';
    if (dyUp > 0) {
      res = this.pull((CLAY.drag * dyUp) / scale);
      if ((res === 'contact' || res === 'blocked') && this.contactY === null) this.contactY = fingerY;
    }
    if (dxOut) this.shape((CLAY.drag * dxOut) / scale);
    return res;
  }

  /** The finger lifted: no strain any more. */
  release(): void {
    this.fingerY = null;
    this.contactY = null;
    this.fingerT = 0;
  }

  /**
   * Time passes: the strain of an overpull builds (and slumps the wall), a slump runs out, a held
   * key pulls, and the light smoothing works while the wheel turns (`turning`).  Returns what happened.
   */
  update(dt: number, turning: boolean): 'slump' | 'gather' | null {
    if (!(dt > 0)) return null;
    if (this.slump > 0) {
      this.slump = Math.max(0, this.slump - dt);
      if (this.slump === 0) return 'gather';
      return null;
    }
    if (this.keyHold) this.pull(CLAY.hold * this.form.N * dt);
    if (this.H < this.line - 1e-6) this.contactY = null;   // the line rose away from the wall: a new contact is needed
    const finger = this.overpull && this.atLine && this.fingerY !== null && this.contactY !== null && this.fingerY <= this.contactY - CLAY.overPx;
    this.fingerT = finger ? this.fingerT + dt : 0;
    const key = this.overpull && this.keyHold && this.atLine;
    this.keyT = key ? this.keyT + dt : 0;
    this.strain = Math.max(this.fingerT / CLAY.overSec, this.keyT / CLAY.keyOverSec);
    if (this.strain >= 1) {
      this.startSlump();
      return 'slump';
    }
    if (turning) this.settle(dt);
    return null;
  }

  /** The wall twists and slumps: the hands gather it back into the lump (the line and the clock run on). */
  startSlump(): void {
    this.before.set(this.r);
    this.beforeH = this.H;
    this.second = true;
    this.slump = CLAY.slump;
    this.strain = 0;
    this.fingerT = 0;
    this.keyT = 0;
    this.contactY = null;
    this.lump();
  }

  /** Stop any strain without slumping (the sponge locks the input, the throw ends). */
  calm(): void {
    this.strain = 0;
    this.fingerT = 0;
    this.keyT = 0;
    this.keyHold = false;
    this.contactY = null;
  }

  // ── the cut's last pull ────────────────────────────────────────
  /**
   * The floors and the blind reveal: when the final line stands above the line at the cut, the hands
   * draw the wall up in one stroke, keeping the share of the height the player pulled and the shape
   * (the radii grow with it).  It never lowers a wall.  Returns the height added (cm).
   */
  lastPull(lineCut: number, lineFinal: number): number {
    const { H0 } = this.lim;
    if (!(lineFinal > lineCut + 1e-9) || !(lineCut > H0) || this.H <= H0 + 1e-9) return 0;
    const H = H0 + (this.H - H0) * (lineFinal - H0) / (lineCut - H0);
    const k = H / this.H;
    const before = this.H;
    for (let i = 0; i < RINGS; i++) this.r[i] *= k;
    this.H = H;
    this.line = Math.max(this.line, lineFinal);
    this.intentional();
    return this.H - before;
  }

  // ── always intentional ─────────────────────────────────────────
  /**
   * Keep the shape a potter's: finite numbers, radii in [rMin, rMax], a rim with body, a foot
   * between 0.3 and 0.9 of the widest ring, and no sharper bend than 0.2·H between three rings.
   */
  intentional(): void {
    const r = this.r, { H0, rMin, rMax } = this.lim;
    let ok = Number.isFinite(this.H);
    for (let k = 0; k < RINGS && ok; k++) ok = Number.isFinite(r[k]);
    if (!ok) {
      this.H = H0;
      for (let k = 0; k < RINGS; k++) r[k] = this.lim.R0 * (1 - CLAY.taper * U[k]);
    }
    this.H = Math.min(Math.max(this.H, H0), Math.max(H0, this.lim.Hmax));
    const lim = CLAY.curve * this.H;
    // the foot follows the widest ring and the curvature limit moves the rings beside it: alternate until both hold
    for (let pass = 0; pass < 60; pass++) {
      let moved = 0;
      for (let k = 0; k < RINGS; k++) r[k] = Math.min(rMax, Math.max(rMin, r[k]));
      r[RINGS - 1] = Math.min(rMax, Math.max(r[RINGS - 1], rMin + CLAY.rim));
      let body = 0;
      for (let k = 1; k < RINGS; k++) body = Math.max(body, r[k]);
      const foot = Math.min(CLAY.footHi * body, Math.max(CLAY.footLo * body, r[0]));
      moved += Math.abs(foot - r[0]);
      r[0] = foot;
      // the curvature limit, swept until it holds (each step moves a ring toward its neighbours' mean)
      for (let sweep = 0; sweep < 40; sweep++) {
        let worst = 0;
        for (let k = 1; k < RINGS - 1; k++) {
          const d2 = r[k - 1] - 2 * r[k] + r[k + 1];
          const over = Math.abs(d2) - lim;
          if (over > 0) {
            const step = (Math.sign(d2) * over) / 2;
            r[k] += step;
            moved += Math.abs(step);
            worst = Math.max(worst, over);
          }
        }
        if (worst < 1e-10) break;
      }
      if (moved < 1e-10) break;
    }
  }

  /** The light smoothing while the wheel turns: two passes a second of a gentle Laplacian, then the limits. */
  settle(dt: number): void {
    this.settleAcc += dt * CLAY.passes;
    if (this.settleAcc < 1) return;
    this.settleAcc -= Math.floor(this.settleAcc);
    const r = this.r, tmp = this.tmp;
    tmp.set(r);
    for (let k = 1; k < RINGS - 1; k++) r[k] = tmp[k] + CLAY.lambda * ((tmp[k - 1] + tmp[k + 1]) / 2 - tmp[k]);
    this.intentional();
  }

  // ── shape and stars ────────────────────────────────────────────
  /** 1 − Σ|r − H·q*| ÷ Σ H·q*, in [0, 1]: how well the wall follows the outline (size never matters). */
  similarity(): number {
    let num = 0, den = 0;
    for (let k = 0; k < RINGS; k++) {
      const t = this.target(k);
      num += Math.abs(this.r[k] - t);
      den += t;
    }
    return den > 0 ? Math.min(1, Math.max(0, 1 - num / den)) : 0;
  }

  /** Whether ring k lies within 8 % of its target (its chalk dot lights). */
  fits(k: number): boolean {
    const t = this.target(k);
    return Math.abs(this.r[k] - t) <= CLAY.fit * t;
  }

  /** How many rings fit. */
  fitCount(): number {
    let n = 0;
    for (let k = 0; k < RINGS; k++) if (this.fits(k)) n++;
    return n;
  }

  /** The profile as ratios × 100 (integers), for the book and the street. */
  ratios(): number[] {
    const out: number[] = [];
    for (let k = 0; k < RINGS; k++) out.push(Math.round((this.r[k] / this.H) * 100));
    return out;
  }
}
