/**
 * Każda myśl's play view (DESIGN §19): a warm dark room and one point of light — a candle's flame drawn in code — the
 * only thing the eyes need.  Thoughts drift in from the dark edges on slips of ash-paper, tinted by their emotions
 * (fear a cold violet-blue, sadness a slate grey-blue, anger a red-orange, a mixture their blend), and wait at a safe
 * distance; while focus holds, the flame's warm ring reaches the slip and it burns from the edge nearest the flame:
 * the paper chars behind an ember front in the thought's two tones, the letters darken and crumble, the ash rises as
 * sparks, and one golden light flies to the point and joins the others circling it — beauty for ashes (Isa 61:3).
 * Without focus the ring draws back to the flame and the slip waits, its burnt edge still glowing faintly.  (Blank
 * slips waiting at the edges were tried and dropped: on a phone they read as grey boxes; the drift-in says it.)
 *
 * The background is baked once per size; a slip is baked once with its words (paint.ts `bakeSlip`); a frame draws a
 * few glows, the flame, the ring, one slip through a clip, and at most a couple of hundred small particles — no
 * shadowBlur, no filters.  Reduced motion: fades instead of motion (no drift, no flicker, no flying lights).
 */
import { approach, clamp, ease } from '../kit/juice';
import type { Insets } from '../kit/types';
import { blend, flameTones, type Mix } from './content';
import { drawHud, hudOn, type HudState } from './hud';
import { inRect, layout, previewLayout, scaleParts, tapTargets, type Layout } from './layout';
import { GOLD, GOLD_HI, NIGHT, WARM, bakeSlip, drawFlame, font, glow, hash, layer, rgbaPrefix, type Layer, type Slip } from './paint';
import { RULES } from './rules';
import type { CoachAt, MysliSim, SimEvent, Thought } from './sim';

const TAU = Math.PI * 2;

interface Bit { x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; color: string; kind: 'ash' | 'spark' }
interface Flying { x: number; y: number; t: number; dur: number }
interface Crumble { slip: Slip; x: number; y: number; ang: number; from: number; t: number; tones: [string, string]; seed: number }

/** Where a thought comes from: the dark edges (left, right, upper left, upper right), by its order. */
function startOf(L: Layout, seq: number, w: number): { x: number; y: number } {
  const s = L.stage, side = seq % 4;
  const off = w * 0.75 + 30;
  if (side === 0) return { x: s.x - off, y: L.slip.cy + 30 };
  if (side === 1) return { x: s.x + s.w + off, y: L.slip.cy + 30 };
  if (side === 2) return { x: s.x - off * 0.6, y: s.y - 60 };
  return { x: s.x + s.w + off * 0.6, y: s.y - 60 };
}

/** A thought's resting place: the slip's centre, a little off it, a little tilted (by its order, never jumping). */
export function restOf(L: Layout, seq: number): { x: number; y: number; ang: number } {
  return { x: L.slip.cx + (hash(seq * 7 + 3) - 0.5) * Math.min(18, L.stage.w * 0.04), y: L.slip.cy, ang: (hash(seq * 11 + 5) - 0.5) * 0.07 };
}

/** The ember front's height above the slip's bottom edge at local x (a gentle wave, still at 0 and at 1). */
const frontWave = (x: number, p: number, seed: number, amp: number): number =>
  p <= 0 || p >= 1 ? 0 : amp * (0.6 * Math.sin(x * 0.05 + seed) + 0.4 * Math.sin(x * 0.13 + seed * 2.1)) * Math.min(1, p * 6, (1 - p) * 6);

/**
 * A slip burning from its bottom edge: what is left of the paper (clipped above the ember front), the charred band
 * behind the front, and the front itself glowing in the thought's two tones.  (x, y) its centre, `ang` its tilt,
 * `p` how far it has burned (0..1), `live` how bright the front glows (0 when focus has gone: the edge only smoulders).
 */
export function drawBurningSlip(ctx: CanvasRenderingContext2D, s: Slip, x: number, y: number, ang: number, p: number, tones: [string, string], seed: number, live: number, alpha = 1): void {
  if (alpha <= 0.01) return;
  const w = s.w, h = s.h;
  const pp = clamp(p);
  const char = Math.min(14, h * 0.22);
  const amp = Math.min(7, h * 0.1);
  const front = (lx: number) => h / 2 - pp * (h + char) + frontWave(lx, pp, seed, amp);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha *= alpha;
  if (pp <= 0) {
    ctx.drawImage(s.c, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    ctx.restore();
    return;
  }
  const N = 18;
  const pts: [number, number][] = [];
  for (let i = 0; i <= N; i++) {
    const lx = -w / 2 - 4 + ((w + 8) * i) / N;
    pts.push([lx, front(lx)]);
  }
  // what is left of the paper
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-w / 2 - 6, -h / 2 - 6);
  ctx.lineTo(w / 2 + 6, -h / 2 - 6);
  for (let i = N; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(s.c, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  // the charred band behind the front: the letters there darken
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1] - char);
  for (const [lx, ly] of pts) ctx.lineTo(lx, ly - char);
  for (let i = N; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, front(0) - char, 0, front(0));
  g.addColorStop(0, 'rgba(40,24,14,0)');
  g.addColorStop(0.55, 'rgba(46,24,12,.6)');
  g.addColorStop(1, 'rgba(18,8,4,.95)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // where the paper is gone the words linger as glowing embers, so the thought stays readable through its whole
  // burning (the lead, round 15: on a phone a one-line thought was unreadable halfway, its line burned first);
  // they dim while focus is away and fade only near the end
  const fade = (pp < 0.72 ? 1 : Math.max(0, (1 - pp) / 0.28)) * (0.6 + 0.4 * live);
  if (fade > 0.02 && s.lines.length) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (const [lx, ly] of pts) ctx.lineTo(lx, ly);
    ctx.lineTo(w / 2 + 6, h / 2 + 8);
    ctx.lineTo(-w / 2 - 6, h / 2 + 8);
    ctx.closePath();
    ctx.clip();
    const lh = Math.round(s.size * 1.3);
    const pad = (h - s.lines.length * lh) / 2;
    ctx.font = font(s.size, 500, true, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha *= fade;
    ctx.shadowColor = tones[0];
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffe2b0';
    let ly = -h / 2 + pad + lh / 2;
    for (const line of s.lines) {
      ctx.fillText(line, 0, ly);
      ly += lh;
    }
    ctx.restore();
  }
  // the front: embers in the thought's two tones, alternating along it
  if (pp < 1) {
    const op = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < N; i++) {
      const tone = (i + Math.floor(seed)) % 2 === 0 ? tones[0] : tones[1];
      ctx.strokeStyle = `${rgbaPrefix(tone)}${0.25 + 0.6 * live})`;
      ctx.lineWidth = 2 + 1.5 * live;
      ctx.beginPath();
      ctx.moveTo(pts[i][0], pts[i][1]);
      ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = op;
    for (let i = 1; i < N; i += 3) glow(ctx, (i % 2 ? tones[0] : tones[1]), pts[i][0], pts[i][1], 8 + 10 * live, 0.2 + 0.45 * live);
  }
  ctx.restore();
}

/** The warm ring round the flame at radius `R` (its strength `a`), and a calm halo inside it. */
export function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, a: number): void {
  if (a <= 0.01 || R <= 2) return;
  const inner = Math.max(1, R * 0.55);
  const g = ctx.createRadialGradient(x, y, inner, x, y, R + 14);
  const at = clamp((R - inner) / (R + 14 - inner));
  g.addColorStop(0, 'rgba(255,170,80,0)');
  g.addColorStop(Math.max(0, at - 0.25), `rgba(255,175,90,${0.05 * a})`);
  g.addColorStop(at, `rgba(255,196,112,${0.42 * a})`);
  g.addColorStop(1, 'rgba(255,170,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R + 14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,222,160,${0.32 * a})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.stroke();
}

/** The golden lights circling the point: `n` of them on an ellipse, turning slowly; `glowK` brightens them. */
export function drawLights(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, n: number, time: number, glowK: number, still: boolean): void {
  if (n <= 0) return;
  const turn = still ? 0 : time * 0.12;
  for (let i = 0; i < n; i++) {
    const a = turn + (i / Math.max(n, 6)) * TAU + (i % 2) * 0.13;
    const px = x + Math.cos(a) * rx, py = y + Math.sin(a) * ry;
    const tw = still ? 1 : 0.8 + 0.2 * Math.sin(time * 2 + i * 1.7);
    glow(ctx, GOLD, px, py, 9 + 4 * glowK, (0.35 + 0.3 * glowK) * tw);
    ctx.fillStyle = `rgba(255,248,226,${0.75 * tw})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.6 + 0.6 * glowK, 0, TAU);
    ctx.fill();
  }
}

/** The room: warm dark, a faint glow where the flame stands, darker edges. */
export function paintRoom(ctx: CanvasRenderingContext2D, w: number, h: number, fx: number, fy: number): void {
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, w, h);
  const warm = ctx.createRadialGradient(fx, fy, 0, fx, fy, Math.max(w, h) * 0.75);
  warm.addColorStop(0, 'rgba(70,38,24,.55)');
  warm.addColorStop(0.35, 'rgba(34,20,22,.35)');
  warm.addColorStop(1, 'rgba(8,6,10,0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, w, h);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

export class MysliView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private w = 1;
  private h = 1;
  private time = 0;
  private bg: { c: Layer; key: string } | null = null;
  private slip: { seq: number; s: Slip } | null = null;
  private shownBurn = 0;
  private ringShown = 0;
  private flameK = 0.4;
  private veilK = 0;
  private lightsShown = 0;
  private readonly bits: Bit[] = [];
  private readonly flying: Flying[] = [];
  private crumble: Crumble | null = null;
  private sparkAcc = 0;
  private revealK = 0;
  private hoverOn = false;
  private readonly motes: { x: number; y: number; v: number; a: number }[] = [];
  /** what the hud draws beside the sim (the caption eased in and out, the band's glow after a tap, the guide's fade) */
  readonly hud: HudState = { capK: 0, capText: '', bandGlow: 0, guideK: 0, time: 0, reduced: false };

  constructor(ctx: CanvasRenderingContext2D | null, private readonly opts: { reducedMotion: boolean; touch: boolean; seed: number; preview?: boolean }) {
    this.ctx = ctx;
    this.L = layout(360, 640, undefined, opts.touch);
    this.hud.reduced = opts.reducedMotion;
    for (let i = 0; i < 28; i++) this.motes.push({ x: hash(opts.seed + i * 3), y: hash(opts.seed + i * 5), v: 0.004 + 0.01 * hash(i * 7), a: 0.04 + 0.1 * hash(i * 11) });
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = this.opts.preview ? previewLayout(w, h) : layout(w, h, ins, this.opts.touch);
    this.bg = null;
    this.slip = null;
  }

  /** The current thought's slip, baked for this size. */
  private slipFor(th: Thought): Slip | null {
    if (this.slip && this.slip.seq === th.seq) return this.slip.s;
    const L = this.L;
    const s = bakeSlip(th.text, th.mix, Math.round(L.slip.w), L.font.slip, L.font.slipMin, this.dpr, th.seq * 13 + 7);
    if (!s) return null;
    this.slip = { seq: th.seq, s };
    return s;
  }

  /** Where the current slip is now (drifting in, waiting, drifting away) and how visible. */
  private slipPlace(sim: MysliSim, s: Slip): { x: number; y: number; ang: number; a: number } {
    const c = sim.cur!;
    const rest = restOf(this.L, c.seq);
    const from = startOf(this.L, c.seq, s.w);
    const still = this.opts.reducedMotion;
    if (sim.curState === 'arrive') {
      const k = clamp(sim.curT / RULES.arriveSec);
      if (still) return { ...rest, a: k };
      const e = ease.outCubic(k);
      return { x: from.x + (rest.x - from.x) * e, y: from.y + (rest.y - from.y) * e, ang: rest.ang + (1 - e) * (c.seq % 2 ? 0.25 : -0.25), a: Math.min(1, k * 1.6) };
    }
    if (sim.curState === 'leave') {
      const k = clamp(sim.curT / RULES.leaveSec);
      if (still) return { ...rest, a: 1 - k };
      const e = k * k * k;
      return { x: rest.x + (from.x - rest.x) * e, y: rest.y + (from.y - rest.y) * e, ang: rest.ang, a: 1 - k };
    }
    // waiting: a slow drift in place (never closer)
    const bob = still ? 0 : Math.sin(this.time * 0.6 + c.seq) * 1.5;
    return { x: rest.x, y: rest.y + bob, ang: rest.ang, a: 1 };
  }

  /** The distance from the flame's point to the slip's near (bottom) edge: how far the ring must reach. */
  private reach(): number {
    const L = this.L;
    return Math.max(L.fs * 2.2, L.fy - (L.slip.cy + L.slip.maxH / 2) + 2);
  }

  on(e: SimEvent, sim: MysliSim): void {
    switch (e.type) {
      case 'arrive':
        this.shownBurn = 0;
        this.slip = null;
        break;
      case 'burned': {
        const s = this.slip && this.slip.seq === e.thought.seq ? this.slip.s : null;
        const rest = restOf(this.L, e.thought.seq);
        if (s) this.crumble = { slip: s, x: rest.x, y: rest.y, ang: rest.ang, from: Math.min(0.95, this.shownBurn), t: 0, tones: flameTones(e.thought.mix), seed: e.thought.seq };
        this.slip = null;
        this.shownBurn = 0;
        this.burst(rest.x, rest.y, e.thought.mix, s?.w ?? this.L.slip.w, s?.h ?? 60);
        this.flying.push({ x: rest.x, y: rest.y, t: 0, dur: this.opts.reducedMotion ? 0.01 : 1.3 });
        break;
      }
      case 'blindEnd':
        if (e.gained > 0) this.revealK = 1;
        break;
      default: break;
    }
    void sim;
  }

  /** A burned slip's last ash and sparks. */
  private burst(x: number, y: number, m: Mix, w: number, h: number): void {
    if (this.opts.reducedMotion) return;
    const tones = flameTones(m);
    for (let i = 0; i < 46; i++) {
      const spark = i % 3 === 0;
      this.bits.push({
        x: x + (Math.random() - 0.5) * w * 0.9, y: y + (Math.random() - 0.5) * h * 0.8, vx: (Math.random() - 0.5) * 24,
        vy: spark ? -40 - 50 * Math.random() : -12 - 20 * Math.random(), t: 0, life: spark ? 0.7 + 0.8 * Math.random() : 1.6 + 1.6 * Math.random(),
        size: spark ? 1.4 + Math.random() * 1.2 : 1.5 + Math.random() * 2.6, color: spark ? tones[i % 2] : '#3a3430', kind: spark ? 'spark' : 'ash',
      });
    }
  }

  update(dt: number, sim: MysliSim): void {
    this.time += dt;
    this.hud.time = this.time;
    const still = this.opts.reducedMotion;
    // the flame follows the light of focus; the ring reaches the thought only while it burns
    this.flameK = approach(this.flameK, sim.blind ? RULES.baseLight : sim.light, dt, 0.4);
    this.ringShown = approach(this.ringShown, sim.blind ? 0.1 : sim.ring, dt, 0.25);
    this.shownBurn = sim.cur && sim.burn < this.shownBurn ? sim.burn : approach(this.shownBurn, sim.cur ? sim.burn : 0, dt, sim.blind ? 0.6 : 0.2);
    this.veilK = approach(this.veilK, sim.blind ? 1 : 0, dt, 0.5);
    this.revealK = Math.max(0, this.revealK - dt / 1.6);
    this.lightsShown = approach(this.lightsShown, Math.min(RULES.lightsDrawn, sim.lights) - this.flying.length, dt, 0.15);
    this.hud.guideK = approach(this.hud.guideK, sim.restBlock ? 1 : 0, dt, 0.35);
    // the caption eases in and out
    const line = sim.talk.line;
    if (line) {
      this.hud.capText = line.text;
      this.hud.capK = approach(this.hud.capK, line.t < line.dur - 0.5 ? 1 : 0, dt, 0.18);
    } else this.hud.capK = approach(this.hud.capK, 0, dt, 0.18);
    this.hud.bandGlow = clamp(sim.reshow / RULES.reshowSec);
    // sparks from the ember front while the thought burns
    if (!still && sim.goldOn && sim.cur && this.slip) {
      this.sparkAcc += dt * 16;
      const s = this.slip.s, rest = restOf(this.L, sim.cur.seq);
      const tones = flameTones(sim.cur.mix);
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const fy = rest.y + s.h / 2 - this.shownBurn * s.h;
        this.bits.push({
          x: rest.x + (Math.random() - 0.5) * s.w * 0.9, y: fy, vx: (Math.random() - 0.5) * 14, vy: -26 - 34 * Math.random(),
          t: 0, life: 0.6 + 0.7 * Math.random(), size: 1.1 + Math.random(), color: tones[Math.random() < 0.5 ? 0 : 1], kind: Math.random() < 0.25 ? 'ash' : 'spark',
        });
      }
    }
    // the particles: sparks rise and fade (turning gold), ash drifts up and settles (falls in rest)
    const fall = sim.restBlock ? 10 : 2;
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.t += dt;
      if (b.t >= b.life) { this.bits.splice(i, 1); continue; }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.kind === 'ash') { b.vy += fall * dt; b.vx *= 0.99; } else b.vy *= 0.985;
    }
    if (this.bits.length > 260) this.bits.splice(0, this.bits.length - 260);
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt;
      if (f.t >= f.dur) this.flying.splice(i, 1);
    }
    if (this.crumble) {
      this.crumble.t += dt;
      if (this.crumble.t > (still ? 0.3 : 0.9)) this.crumble = null;
    }
    if (!still) for (const m of this.motes) m.y = (m.y - m.v * dt + 1) % 1;
  }

  draw(sim: MysliSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawScene(ctx, sim);
    if (hudOn(sim) && !this.opts.preview) drawHud(ctx, L, sim, this.hud);
    ctx.restore();
  }

  /** Everything but the words: the room, the waiting slips, the lights, the ring, the flame, the thought, the ash. */
  drawScene(ctx: CanvasRenderingContext2D, sim: MysliSim): void {
    const L = this.L, still = this.opts.reducedMotion;
    // the room (baked)
    const key = `${Math.round(this.w)}x${Math.round(this.h)}@${this.dpr}|${Math.round(L.fx)},${Math.round(L.fy)}`;
    if (!this.bg || this.bg.key !== key) {
      const B = layer(this.w, this.h, this.dpr);
      if (B) {
        paintRoom(B.ctx, this.w, this.h, L.fx, L.fy);
        this.bg = { c: B.c, key };
      }
    }
    if (this.bg) ctx.drawImage(this.bg.c, 0, 0, this.w, this.h);
    else paintRoom(ctx, this.w, this.h, L.fx, L.fy);
    // dust in the warm air
    for (const m of this.motes) {
      ctx.fillStyle = `rgba(255,220,180,${m.a * 0.6})`;
      ctx.fillRect(m.x * this.w, m.y * this.h, 1.4, 1.4);
    }
    // the golden lights, the ring, the flame
    const fx = L.fx, fy = L.fy;
    const glowK = sim.quietBlock || sim.phase !== 'play' ? 0.6 + 0.4 * this.flameK : 0.3 * this.flameK;
    drawLights(ctx, fx, fy + L.fs * 0.2, L.orbit.rx, L.orbit.ry, Math.round(this.lightsShown), this.time, glowK, still);
    if (sim.lights > RULES.lightsDrawn) glow(ctx, GOLD, fx, fy, L.orbit.rx * 1.2, 0.12);
    const r0 = L.fs * 1.5;
    const reach = this.reach();
    const focusing = sim.focusBlock || !sim.started;
    drawRing(ctx, fx, fy, r0 + (reach - r0) * clamp(this.ringShown), focusing ? 0.25 + 0.75 * clamp(this.ringShown) : 0.2);
    drawFlame(ctx, fx, fy, L.fs, this.flameK, this.time, still);
    // the lights flying from the ash to the point
    for (const f of this.flying) {
      const k = ease.inOutSine(clamp(f.t / f.dur));
      const tx = fx + L.orbit.rx * Math.cos(this.time * 0.12), ty = fy + L.fs * 0.2 + L.orbit.ry * Math.sin(this.time * 0.12);
      const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * 24;
      glow(ctx, GOLD_HI, x, y, 14, 0.7);
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fill();
    }
    // the thought: drifting in, waiting, burning — or drifting away
    if (sim.cur && sim.phase === 'play') {
      const s = this.slipFor(sim.cur);
      if (s) {
        const pl = this.slipPlace(sim, s);
        const dim = sim.restBlock ? 0.22 : 1;
        drawBurningSlip(ctx, s, pl.x, pl.y, pl.ang, this.shownBurn, flameTones(sim.cur.mix), sim.cur.seq * 1.7, sim.goldOn ? 1 : 0.15, pl.a * dim);
        if (this.revealK > 0) glow(ctx, WARM, pl.x, pl.y + s.h / 2, s.w * 0.6, 0.5 * this.revealK);
      }
    }
    // a burned slip's last moment: the rest of it goes up quickly
    if (this.crumble) {
      const c = this.crumble;
      const k = clamp(c.t / (still ? 0.3 : 0.9));
      drawBurningSlip(ctx, c.slip, c.x, c.y - k * 6, c.ang, c.from + (1 - c.from) * Math.min(1, k * 1.25), c.tones, c.seed * 1.7, 1 - k, 1 - k);
    }
    // the ash and the sparks
    for (const b of this.bits) {
      const k = b.t / b.life;
      if (b.kind === 'spark') {
        const col = k < 0.5 ? b.color : GOLD;
        glow(ctx, col, b.x, b.y, b.size * 4, 0.6 * (1 - k));
        ctx.fillStyle = `${rgbaPrefix(k < 0.5 ? '#fff0d8' : GOLD_HI)}${0.9 * (1 - k)})`;
        ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
      } else {
        ctx.fillStyle = `rgba(70,62,58,${0.75 * (1 - k)})`;
        ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size * 0.7);
      }
    }
    // a blind push: the room darkens round the flame (the flame does not show the focus)
    if (this.veilK > 0.01) {
      ctx.fillStyle = `rgba(4,3,6,${0.38 * this.veilK})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  // ── the hands ──────────────────────────────────────────────────
  targets(sim: MysliSim) {
    return tapTargets(this.L, { story: sim.story ? this.L.story : null, skip: sim.canSkip, scale: sim.asking });
  }

  skipAt(sim: MysliSim, x: number, y: number): boolean { return sim.canSkip && inRect(this.L.skip, x, y); }

  /** The finale's button under a point (0–10), or -1. */
  scaleAt(sim: MysliSim, x: number, y: number): number {
    if (!sim.asking) return -1;
    return scaleParts(this.L).buttons.findIndex(r => inRect(r, x, y));
  }

  /** A desktop's mouse over something a click does. */
  hover(sim: MysliSim, x: number, y: number): boolean {
    this.hoverOn = !!sim.story || this.skipAt(sim, x, y) || this.scaleAt(sim, x, y) >= 0;
    return this.hoverOn;
  }

  /** A tap somewhere: the words glow again (the hud reads reshow) — nothing else to show here. */
  touch(): void { /* the band's glow follows sim.reshow */ }

  /** Where a coach mark points. */
  pointAt(at: CoachAt): { x: number; y: number } | null {
    const L = this.L;
    if (at === 'flame') return { x: L.fx, y: L.fy - L.fs * 2.2 };
    if (at === 'slip') return { x: L.slip.cx, y: L.slip.cy + L.slip.maxH / 2 };
    if (at === 'skip') return { x: L.skip.x + L.skip.w / 2, y: L.skip.y };
    return { x: L.guide.cx, y: L.guide.cy };
  }

  /** The tone of the thought at the ring (for the tests: a mixture's blended colour). */
  toneOf(m: Mix): string { return blend(m); }
}
