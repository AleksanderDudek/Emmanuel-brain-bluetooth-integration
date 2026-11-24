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
 * Round 16 (DESIGN §20): where a lie has burned, its truth unfolds on a golden slip in the same place and waits,
 * readable in dim gold; held focus fills its letters with light, left to right, line by line; gilded, it folds into
 * the golden light that flies to the point.  A set (a warownia, an own one) stands behind the flame as a stronghold of
 * hewn stones, one a pair, with a light behind it that shows only through the joints: each lie burned, its stone
 * crumbles and the light shines through the gap; each truth gilded, that light warms; the last stone down, the
 * stronghold falls and the light breaks through.
 *
 * The background is baked once per size; a slip is baked once with its words (paint.ts `bakeSlip`, `bakeGoldSlip`), a
 * stone once per size; a frame draws a few glows, the flame, the ring, the wall's stones, one slip through a clip, and
 * at most a couple of hundred small particles — no shadowBlur, no filters.  Reduced motion: fades instead of motion (no
 * drift, no flicker, no flying lights, no falling stones).
 */
import { approach, clamp, ease } from '../kit/juice';
import type { Insets } from '../kit/types';
import { blend, flameTones, type Mix } from './content';
import { drawHud, hudOn, type HudState } from './hud';
import { inRect, layout, previewLayout, scaleParts, tapTargets, type Layout, type Rect } from './layout';
import {
  GOLD, GOLD_HI, NIGHT, WARM, bakeGoldSlip, bakeSlip, bakeStone, drawFlame, font, glow, hash, layer, mix, rgbaPrefix, wallStones, type GoldSlip, type Layer, type Slip,
  type Stone,
} from './paint';
import { RULES } from './rules';
import { stoneSlots } from './sets';
import type { CoachAt, MysliSim, SimEvent, Thought } from './sim';

const TAU = Math.PI * 2;

interface Bit { x: number; y: number; vx: number; vy: number; t: number; life: number; size: number; color: string; kind: 'ash' | 'spark' }
interface Flying { x: number; y: number; t: number; dur: number }
interface Crumble { slip: Slip; x: number; y: number; ang: number; from: number; t: number; tones: [string, string]; seed: number }
interface Fold { g: GoldSlip; x: number; y: number; ang: number; t: number }
/** a falling stone's pieces: each a part of the stone's picture, falling and turning as it fades */
interface Piece { sx: number; sy: number; sw: number; sh: number; x: number; y: number; vx: number; vy: number; rot: number; vr: number }
interface Crumbling { slot: number; t: number; pieces: Piece[] }

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

/**
 * A truth's golden slip at (x, y), its tilt, how far it has unfolded (0..1: it opens from its middle, like a folded leaf)
 * and how far its letters are filled with light (0..1: left to right, line by line, a spark at the front); `live` how
 * brightly it answers now (focus held), `alpha` its visibility.
 */
export function drawGoldSlip(ctx: CanvasRenderingContext2D, g: GoldSlip, x: number, y: number, ang: number, open: number, fill: number, live: number, alpha = 1, still = false): void {
  if (alpha <= 0.01 || open <= 0.01) return;
  const w = g.w, h = g.h;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha *= alpha;
  // the leaf's own glow: a little while it waits, more as it fills
  glow(ctx, GOLD, 0, 0, Math.max(w, h) * (0.55 + 0.25 * fill), (0.1 + 0.25 * fill + 0.1 * live) * open);
  if (!still) ctx.scale(1, Math.max(0.02, ease.outCubic(clamp(open))));
  else ctx.globalAlpha *= clamp(open);
  ctx.drawImage(g.base, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  const k = clamp(fill);
  if (k > 0 && open >= 0.98) {
    // the light fills the letters: whole lines before the front, part of the line at it
    const total = g.widths.reduce((a, b) => a + b, 0) || 1;
    let left = k * total;
    const lh = Math.round(g.size * 1.3);
    let front: { x: number; y: number } | null = null;
    ctx.save();
    ctx.beginPath();
    g.lines.forEach((_, i) => {
      if (left <= 0) return;
      const lw = g.widths[i];
      const part = Math.min(lw, left);
      left -= part;
      const x0 = -lw / 2, ly = -h / 2 + g.pad + i * lh;
      ctx.rect(x0 - 6, ly - 2, part + 6, lh + 4);
      if (part < lw || i === g.lines.length - 1) front = { x: x0 + part, y: ly + lh / 2 };
    });
    ctx.clip();
    ctx.drawImage(g.lit, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
    ctx.restore();
    const f = front as { x: number; y: number } | null;
    if (f && k < 1) glow(ctx, GOLD_HI, f.x, f.y, g.size * (0.9 + 0.5 * live), 0.35 + 0.45 * live);
  }
  ctx.restore();
}

/**
 * The light behind a stronghold: a soft source behind the wall's middle (never a lit box) — the stones in front hide
 * it, so it shows as a thin rim round the wall, through the joints and through each gap; `k` how warm it has grown.
 */
function drawFortLight(ctx: CanvasRenderingContext2D, r: Rect, k: number, warmth: number): void {
  const cx = r.x + r.w / 2, cy = r.y + r.h * 0.52;
  const R = Math.max(r.w, r.h) * 0.62;
  const col = mix('#ffe7b0', '#ffbf5c', warmth);
  glow(ctx, col, cx, cy, R * 1.5, 0.08 + 0.12 * k);
  glow(ctx, mix('#fff8e6', col, 0.35), cx, cy, R * 0.9, 0.45 + 0.35 * k);
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
  private gold: { seq: number; g: GoldSlip } | null = null;
  private shownBurn = 0;
  private shownGild = 0;
  private ringShown = 0;
  private flameK = 0.4;
  private veilK = 0;
  private lightsShown = 0;
  private readonly bits: Bit[] = [];
  private readonly flying: Flying[] = [];
  private crumble: Crumble | null = null;
  private fold: Fold | null = null;
  private sparkAcc = 0;
  private revealK = 0;
  private hoverOn = false;
  private readonly motes: { x: number; y: number; v: number; a: number }[] = [];
  // ── the stronghold ──
  private fort: { key: string; stones: Stone[]; layers: (Layer | null)[]; slots: number[] } | null = null;
  private readonly crumbling: Crumbling[] = [];
  private fortK = 0;
  /** the fall's moment, 0 → 1 (and after it the light that broke through stays) */
  private fallT = -1;
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
    this.gold = null;
    this.fort = null;
  }

  /** The current lie's slip, baked for this size. */
  private slipFor(th: Thought): Slip | null {
    if (this.slip && this.slip.seq === th.seq) return this.slip.s;
    const L = this.L;
    const s = bakeSlip(th.text, th.mix, Math.round(L.slip.w), L.font.slip, L.font.slipMin, this.dpr, th.seq * 13 + 7);
    if (!s) return null;
    this.slip = { seq: th.seq, s };
    return s;
  }

  /** The current truth's golden slip, baked for this size. */
  private goldFor(th: Thought): GoldSlip | null {
    if (this.gold && this.gold.seq === th.seq) return this.gold.g;
    const L = this.L;
    const g = bakeGoldSlip(th.truth, Math.round(L.slip.w), L.font.slip, L.font.slipMin, this.dpr, th.seq * 17 + 3);
    if (!g) return null;
    this.gold = { seq: th.seq, g };
    return g;
  }

  /** Where the current slip is now (drifting in, waiting, drifting away) and how visible. */
  private slipPlace(sim: MysliSim, w: number): { x: number; y: number; ang: number; a: number } {
    const c = sim.cur!;
    const rest = restOf(this.L, c.seq);
    const from = startOf(this.L, c.seq, w);
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

  /** The set's wall for this size: its stones, baked once, and each pair's slot. */
  private fortFor(sim: MysliSim): { stones: Stone[]; layers: (Layer | null)[]; slots: number[] } | null {
    const s = sim.set;
    if (!s) return null;
    const r = this.L.fort;
    const key = `${s.size}|${s.seed}|${Math.round(r.w)}x${Math.round(r.h)}@${this.dpr}`;
    if (this.fort && this.fort.key === key) return this.fort;
    const stones = wallStones(s.size, r.w, r.h, s.seed % 9973);
    this.fort = { key, stones, layers: stones.map((st, i) => bakeStone(st, this.dpr, s.seed % 977 + i * 31)), slots: stoneSlots(s.size, s.seed) };
    return this.fort;
  }

  on(e: SimEvent, sim: MysliSim): void {
    switch (e.type) {
      case 'arrive':
        this.shownBurn = 0;
        this.shownGild = 0;
        this.slip = null;
        break;
      case 'burned': {
        const s = this.slip && this.slip.seq === e.thought.seq ? this.slip.s : null;
        const rest = restOf(this.L, e.thought.seq);
        if (s) this.crumble = { slip: s, x: rest.x, y: rest.y, ang: rest.ang, from: Math.min(0.95, this.shownBurn), t: 0, tones: flameTones(e.thought.mix), seed: e.thought.seq };
        this.slip = null;
        this.shownBurn = 0;
        this.shownGild = 0;
        this.burst(rest.x, rest.y, e.thought.mix, s?.w ?? this.L.slip.w, s?.h ?? 60);
        if (sim.set && e.thought.src !== 'lib' && e.thought.pair >= 0) this.stoneDown(sim, e.thought.pair);
        break;
      }
      case 'gilded': {
        const g = this.gold && this.gold.seq === e.thought.seq ? this.gold.g : null;
        const rest = restOf(this.L, e.thought.seq);
        if (g) this.fold = { g, x: rest.x, y: rest.y, ang: rest.ang, t: 0 };
        this.gold = null;
        this.shownGild = 0;
        this.flying.push({ x: rest.x, y: rest.y, t: this.opts.reducedMotion ? 0 : -0.45, dur: this.opts.reducedMotion ? 0.01 : 1.3 });
        break;
      }
      case 'fall':
        this.fallT = 0;
        break;
      case 'blindEnd':
        if (e.gained > 0) this.revealK = 1;
        break;
      default: break;
    }
  }

  /** A burned lie's stone loosens and crumbles: its pieces fall and turn as they fade; gold sparks rise from the gap. */
  private stoneDown(sim: MysliSim, pair: number): void {
    const f = this.fortFor(sim);
    if (!f) return;
    const slot = f.slots[pair] ?? pair;
    const st = f.stones[slot];
    if (!st) return;
    const r = this.L.fort;
    const pieces: Piece[] = [];
    if (!this.opts.reducedMotion) {
      const cols = 3, rows = 2;
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const sw = st.w / cols, sh = st.h / rows;
        pieces.push({
          sx: i * sw, sy: j * sh, sw, sh, x: r.x + st.x + i * sw, y: r.y + st.y + j * sh,
          vx: (i - 1) * 18 + (Math.random() - 0.5) * 20, vy: -20 - 30 * Math.random(), rot: 0, vr: (Math.random() - 0.5) * 3,
        });
      }
      for (let i = 0; i < 18; i++) {
        this.bits.push({
          x: r.x + st.x + Math.random() * st.w, y: r.y + st.y + Math.random() * st.h, vx: (Math.random() - 0.5) * 20, vy: -30 - 40 * Math.random(),
          t: 0, life: 0.8 + 0.8 * Math.random(), size: 1.3 + Math.random() * 1.3, color: i % 2 ? GOLD : GOLD_HI, kind: 'spark',
        });
      }
    }
    this.crumbling.push({ slot, t: 0, pieces });
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
    // the flame follows the light of focus; the ring reaches the slip only while it burns or gilds
    this.flameK = approach(this.flameK, sim.blind ? RULES.baseLight : sim.light, dt, 0.4);
    this.ringShown = approach(this.ringShown, sim.blind ? 0.1 : sim.ring, dt, 0.25);
    const lie = !!sim.cur && (sim.curState === 'wait' || sim.curState === 'arrive' || sim.curState === 'leave');
    this.shownBurn = lie && sim.burn < this.shownBurn ? sim.burn : approach(this.shownBurn, lie ? sim.burn : 0, dt, sim.blind ? 0.6 : 0.2);
    this.shownGild = sim.truthUp ? approach(this.shownGild, sim.gild, dt, sim.blind ? 0.6 : 0.2) : 0;
    this.veilK = approach(this.veilK, sim.blind ? 1 : 0, dt, 0.5);
    this.revealK = Math.max(0, this.revealK - dt / 1.6);
    this.lightsShown = approach(this.lightsShown, Math.min(RULES.lightsDrawn, sim.lights) - this.flying.length, dt, 0.15);
    this.hud.guideK = approach(this.hud.guideK, sim.restBlock ? 1 : 0, dt, 0.35);
    // the light behind the stronghold warms with each truth gilded (and stays once it has broken through)
    const s = sim.set;
    const warm = s ? (sim.fellNow ? 1 : s.place.gilded.length / Math.max(1, s.size)) : 0;
    this.fortK = approach(this.fortK, warm, dt, 0.8);
    if (this.fallT >= 0 && this.fallT < 1) this.fallT = Math.min(1, this.fallT + dt / RULES.fallSec);
    // the caption eases in and out
    const line = sim.talk.line;
    if (line) {
      this.hud.capText = line.text;
      this.hud.capK = approach(this.hud.capK, line.t < line.dur - 0.5 ? 1 : 0, dt, 0.18);
    } else this.hud.capK = approach(this.hud.capK, 0, dt, 0.18);
    this.hud.bandGlow = clamp(sim.reshow / RULES.reshowSec);
    // sparks from the ember front while a lie burns; a few golden motes while a truth fills with light
    if (!still && sim.goldOn && sim.cur && (this.slip || this.gold)) {
      const gilding = sim.truthReady;
      this.sparkAcc += dt * (gilding ? 5 : 16);
      const rest = restOf(this.L, sim.cur.seq);
      const sw = gilding ? this.gold?.g.w ?? this.L.slip.w : this.slip?.s.w ?? this.L.slip.w;
      const sh = gilding ? this.gold?.g.h ?? 60 : this.slip?.s.h ?? 60;
      const tones = flameTones(sim.cur.mix);
      while (this.sparkAcc >= 1) {
        this.sparkAcc -= 1;
        const fy = gilding ? rest.y - sh / 2 + Math.random() * sh : rest.y + sh / 2 - this.shownBurn * sh;
        this.bits.push({
          x: rest.x + (Math.random() - 0.5) * sw * 0.9, y: fy, vx: (Math.random() - 0.5) * 14, vy: gilding ? -14 - 16 * Math.random() : -26 - 34 * Math.random(),
          t: 0, life: 0.6 + 0.7 * Math.random(), size: 1.1 + Math.random(), color: gilding ? GOLD_HI : tones[Math.random() < 0.5 ? 0 : 1],
          kind: !gilding && Math.random() < 0.25 ? 'ash' : 'spark',
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
    if (this.fold) {
      this.fold.t += dt;
      if (this.fold.t > (still ? 0.4 : 0.6)) this.fold = null;
    }
    for (let i = this.crumbling.length - 1; i >= 0; i--) {
      const c = this.crumbling[i];
      c.t += dt;
      for (const p of c.pieces) {
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
      if (c.t > (still ? 0.8 : 1.4)) this.crumbling.splice(i, 1);
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

  /**
   * The stronghold behind the flame: the light behind it (only through its joints and gaps), its standing stones,
   * the pieces of the ones falling, the light through each gap; at its fall the light breaks through.
   */
  private drawFort(ctx: CanvasRenderingContext2D, sim: MysliSim): void {
    const f = this.fortFor(sim);
    if (!f) return;
    const r = this.L.fort, still = this.opts.reducedMotion;
    const down = new Set(sim.stonesDown.map(k => f.slots[k] ?? k));
    const k = this.fortK;
    const fell = sim.fellNow;
    // the light behind: dim through the joints at first, warmer with each truth; broken through after the fall
    if (!fell || this.fallT < 1) drawFortLight(ctx, r, k * (fell ? 1 - this.fallT : 1), k);
    const busy = new Set(this.crumbling.map(c => c.slot));
    if (!fell || this.crumbling.length) {
      f.stones.forEach((st, i) => {
        const layerI = f.layers[i];
        if (!layerI || (down.has(i) && !busy.has(i))) return;
        if (busy.has(i)) return;
        ctx.drawImage(layerI, r.x + st.x - 2, r.y + st.y - 2, st.w + 4, st.h + 4);
      });
    }
    // the gaps: the light shines through where a stone was (a soft glow in each, warmer with each truth)
    for (const i of down) {
      const st = f.stones[i];
      if (!st || fell) continue;
      glow(ctx, mix('#ffe7b0', '#ffbf5c', k), r.x + st.x + st.w / 2, r.y + st.y + st.h / 2, Math.max(st.w, st.h) * 0.7, 0.14 + 0.2 * k);
    }
    // the stones crumbling now
    for (const c of this.crumbling) {
      const st = f.stones[c.slot];
      const lay = f.layers[c.slot];
      if (!st || !lay) continue;
      const life = still ? 0.8 : 1.4;
      const a = clamp(1 - c.t / life);
      ctx.save();
      ctx.globalAlpha *= a;
      if (!c.pieces.length) ctx.drawImage(lay, r.x + st.x - 2, r.y + st.y - 2, st.w + 4, st.h + 4);
      for (const p of c.pieces) {
        ctx.save();
        ctx.translate(p.x + p.sw / 2, p.y + p.sh / 2);
        ctx.rotate(p.rot);
        ctx.drawImage(lay, (p.sx + 2) * this.dpr, (p.sy + 2) * this.dpr, p.sw * this.dpr, p.sh * this.dpr, -p.sw / 2, -p.sh / 2, p.sw, p.sh);
        ctx.restore();
      }
      ctx.restore();
    }
    // the stones stand in the candle's warm light
    glow(ctx, WARM, this.L.fx, this.L.fy, r.h * 0.9, 0.08);
    if (fell) {
      // the fall: the light breaks through — a widening glow and rays (still with reduced motion), then it stays, softer
      const cx = r.x + r.w / 2, cy = r.y + r.h * 0.55;
      const t = this.fallT < 0 ? 1 : this.fallT;
      const burst = Math.sin(Math.PI * Math.min(1, t * 1.6)) * (t < 1 ? 1 : 0);
      glow(ctx, '#fff2cc', cx, cy, Math.max(r.w, r.h) * (0.9 + 1.6 * t), 0.18 + 0.5 * burst);
      glow(ctx, GOLD, cx, cy, Math.max(r.w, r.h) * 1.3, 0.16);
      if (burst > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const n = 12, len = Math.max(r.w, r.h) * (1.1 + 1.2 * t);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + (still ? 0 : this.time * 0.08);
          const g = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
          g.addColorStop(0, `rgba(255,236,190,${0.16 * burst})`);
          g.addColorStop(1, 'rgba(255,236,190,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(a - 0.035) * len, cy + Math.sin(a - 0.035) * len);
          ctx.lineTo(cx + Math.cos(a + 0.035) * len, cy + Math.sin(a + 0.035) * len);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /** Everything but the words: the room, the stronghold, the lights, the ring, the flame, the slip, the ash. */
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
    if (sim.set) this.drawFort(ctx, sim);
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
    // the lights flying from a gilded truth to the point (a moment after the truth folds)
    for (const f of this.flying) {
      if (f.t < 0) continue;
      const k = ease.inOutSine(clamp(f.t / f.dur));
      const tx = fx + L.orbit.rx * Math.cos(this.time * 0.12), ty = fy + L.fs * 0.2 + L.orbit.ry * Math.sin(this.time * 0.12);
      const x = f.x + (tx - f.x) * k, y = f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * 24;
      glow(ctx, GOLD_HI, x, y, 14, 0.7);
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fill();
    }
    // the slip: a lie drifting in, waiting, burning — or its truth unfolding, waiting, filling with light
    const c = sim.cur;
    // the quiet is the point alone: a thought left at the ring waits out of sight
    if (c && sim.phase === 'play' && sim.curState !== 'fall' && !sim.quietBlock) {
      const dim = sim.restBlock ? 0.22 : 1;
      if (sim.truthUp) {
        const g = this.goldFor(c);
        if (g) {
          const pl = sim.curState === 'arrive' ? this.slipPlace(sim, g.w) : { ...restOf(L, c.seq), a: 1 };
          const open = sim.curState === 'unfold' ? clamp(sim.curT / RULES.unfoldSec) : 1;
          drawGoldSlip(ctx, g, pl.x, pl.y, pl.ang, open, this.shownGild, sim.goldOn ? 1 : 0, pl.a * (sim.restBlock ? 0.5 : 1), still);
          if (this.revealK > 0) glow(ctx, GOLD_HI, pl.x, pl.y, g.w * 0.6, 0.5 * this.revealK);
        }
      } else {
        const s = this.slipFor(c);
        if (s) {
          const pl = this.slipPlace(sim, s.w);
          drawBurningSlip(ctx, s, pl.x, pl.y, pl.ang, this.shownBurn, flameTones(c.mix), c.seq * 1.7, sim.goldOn ? 1 : 0.15, pl.a * dim);
          if (this.revealK > 0) glow(ctx, WARM, pl.x, pl.y + s.h / 2, s.w * 0.6, 0.5 * this.revealK);
        }
      }
    }
    // a burned slip's last moment: the rest of it goes up quickly
    if (this.crumble) {
      const cr = this.crumble;
      const k = clamp(cr.t / (still ? 0.3 : 0.9));
      drawBurningSlip(ctx, cr.slip, cr.x, cr.y - k * 6, cr.ang, cr.from + (1 - cr.from) * Math.min(1, k * 1.25), cr.tones, cr.seed * 1.7, 1 - k, 1 - k);
    }
    // a gilded truth folds into its golden light
    if (this.fold) {
      const fo = this.fold;
      const k = clamp(fo.t / (still ? 0.4 : 0.6));
      ctx.save();
      ctx.translate(fo.x, fo.y);
      if (!still) ctx.scale(1 - 0.7 * k, 1 - k * 0.98);
      drawGoldSlip(ctx, fo.g, 0, 0, fo.ang, 1, 1, 1, 1 - k * (still ? 1 : 0.6), true);
      ctx.restore();
      glow(ctx, GOLD_HI, fo.x, fo.y, 18 + 30 * (1 - k), 0.5 + 0.4 * k);
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
