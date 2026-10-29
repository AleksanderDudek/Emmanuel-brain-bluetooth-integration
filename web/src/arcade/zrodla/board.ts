/**
 * The valley's picture: one painter per valley in play (render.ts keeps one for the valley and one
 * for the valley sliding away).  The land is baked once per valley and size — limestone with
 * contour lines, the road, the rose-rock rim with the springs' mouths, the valley floor, rock
 * outcrops and the terraced field beds — and so is the green, an offscreen layer that only gains the
 * dots its fields' radii newly reach.  Per frame it draws the pools with their depth ticks, the
 * carved stones (baked sprites, turned through 120 ms), the water in their grooves with its front
 * and shimmer, the joined grooves' bright outline, the leaks' splashes, the springs' ripple rings,
 * curb stones and gauge, the nest and its pair, the pilgrims at the rim, and the Sela's veil, the
 * blind Nurt's lids and slabs, the hint and the keyboard cursor.  It reads the run; it changes nothing.
 */
import { clamp, ease } from '../kit/juice';
import { depthOf } from './content';
import type { Layout } from './layout';
import {
  C, GROOVE, STREAM, canvas, hash, isBend, paintBird, paintContours, paintFieldBed, paintNest, paintPilgrim, paintRock, poolColor, rgba,
  roundRect, stoneSprite, strokeArm, type StoneLook,
} from './paint';
import type { Run } from './sim';
import { BIT, DX, DY, FIELD, FOUR, ROCK, STONE, WELL, opp } from './valley';

const TAU = Math.PI * 2;
/** A stone's picture follows a turn in this long (s), easing out without overshoot. */
export const TURN_SEC = 0.12;

/** What the board shows this frame beyond the run itself (the view passes it). */
export interface BoardState {
  /** the view's clock (s) */
  t: number;
  /** how much water runs, 0..1 (the gauge, the ripples and the shimmer) */
  phi: number;
  /** the springs pour now (a Nurt, the Oaza or the warm-up, no beat) */
  flowing: boolean;
  /** the water is hidden under lids and slabs */
  blind: boolean;
  /** ripple rings and gauges show (a sighted Nurt or the warm-up) */
  gauge: boolean;
  veil: number;
  /** the signal failing, 0..1: a haze over the sources, the ripples still */
  haze: number;
  curb: number;
  hint: number;
  cursor: number;
  /** the pilgrims sit by the water (a Sela) */
  rest: boolean;
  reduced: boolean;
  /** a nest's pair fluttering down, 0..1 (1: settled) */
  nestIn: number;
}

interface Dot { x: number; y: number; d: number; r: number; c: string; blade: boolean }

/** The dots of a field's green (cell units around its centre), nearest first: leaves, then flowers that open past radius 1. */
function greenDots(seed: number): { leaves: Dot[]; flowers: Dot[] } {
  const leaves: Dot[] = [], flowers: Dot[] = [];
  for (let i = 0; i < 340; i++) {
    const a = hash(seed + i * 1.37) * TAU, d = 3.25 * Math.sqrt(hash(seed * 3 + i * 2.11));
    const kind = hash(seed * 7 + i);
    const dot = { x: Math.cos(a) * d, y: Math.sin(a) * d, d, r: 0.022 + 0.034 * hash(seed + i * 5.3), c: kind < 0.5 ? C.sage : kind < 0.82 ? C.olive : '#a9c08f', blade: kind > 0.9 };
    leaves.push(dot);
    if (i % 9 === 4 && d > 0.35) {
      const f = hash(seed * 11 + i);
      flowers.push({ ...dot, r: 0.026, c: f < 0.4 ? C.anemone : f < 0.7 ? C.crocus : C.oleander, blade: false });
    }
  }
  leaves.sort((p, q) => p.d - q.d);
  flowers.sort((p, q) => p.d - q.d);
  return { leaves, flowers };
}

/** A spill's tuft (cell units around the spot), nearest first. */
function tuftDots(seed: number): Dot[] {
  const out: Dot[] = [];
  for (let i = 0; i < 18; i++) {
    const a = hash(seed + i * 2.7) * TAU, d = 0.42 * Math.sqrt(hash(seed * 5 + i));
    out.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, d, r: 0.02 + 0.025 * hash(seed + i), c: i % 3 ? C.sage : C.olive, blade: i % 4 === 0 });
  }
  return out.sort((p, q) => p.d - q.d);
}

export class ValleyPainter {
  private land: HTMLCanvasElement | null = null;
  private landKey = '';
  private green: HTMLCanvasElement | null = null;
  private greenKey = '';
  private readonly leaves: Dot[][];
  private readonly flowers: Dot[][];
  private readonly tuft: Dot[];
  private readonly drawnLeaves: Int16Array;
  private readonly drawnFlowers: Int16Array;
  private readonly drawnTufts: Int16Array;
  /** per cell: the picture's angle still to turn (quarter turns) at the start of its turn, and the time into the turn */
  private readonly turnFrom: Float32Array;
  private readonly turnT: Float32Array;
  /** per field: the water level the picture shows (eases toward the jars) */
  private readonly shown: Float32Array;

  /** `strips`: shade the land under the runner's top and bottom strips (play; not the lobby's pictures) */
  constructor(readonly run: Run, private readonly opts: { strips?: boolean } = {}) {
    const v = run.v, nf = v.fields.length;
    const g = v.fields.map((_, fi) => greenDots(run.seed % 1000 + fi * 97 + 3));
    this.leaves = g.map(x => x.leaves);
    this.flowers = g.map(x => x.flowers);
    this.tuft = tuftDots(run.seed % 977 + 11);
    this.drawnLeaves = new Int16Array(nf);
    this.drawnFlowers = new Int16Array(nf);
    this.drawnTufts = new Int16Array(v.n * 4);
    this.turnFrom = new Float32Array(v.n);
    this.turnT = new Float32Array(v.n).fill(TURN_SEC);
    this.shown = Float32Array.from(run.jars);
  }

  /** A stone turned: its picture starts from where it was showing, a quarter behind. */
  turned(cell: number, dir: 1 | -1): void {
    const now = this.offset(cell);
    this.turnFrom[cell] = now - dir;
    this.turnT[cell] = 0;
  }

  /** The angle (quarter turns) the stone's picture still lags behind its rule. */
  private offset(cell: number): number {
    const k = this.turnT[cell] / TURN_SEC;
    return k >= 1 ? 0 : this.turnFrom[cell] * (1 - ease.outCubic(k));
  }

  /** Advance the stones' turns and the pools' levels (held still while `hidden`: the blind Nurt's water rises at its reveal). */
  update(dt: number, reduced: boolean, hidden = false): void {
    for (let i = 0; i < this.turnT.length; i++) if (this.turnT[i] < TURN_SEC) this.turnT[i] = Math.min(TURN_SEC, this.turnT[i] + dt);
    const r = this.run;
    if (hidden) return;
    for (let fi = 0; fi < this.shown.length; fi++) {
      const want = r.jars[fi];
      this.shown[fi] = reduced ? want : this.shown[fi] + (want - this.shown[fi]) * Math.min(1, dt * 3);
    }
  }

  /** Show the true depths at once (a valley appearing, the blind Nurt's reveal starting from its slabs). */
  settle(): void { this.shown.set(this.run.jars); }

  /** The water level the picture shows in field `fi` (jars). */
  shownJars(fi: number): number { return this.shown[fi]; }

  // ── baked layers ───────────────────────────────────────────────
  private bakeLand(L: Layout, dpr: number): void {
    const key = `${L.w}|${L.h}|${L.S}|${dpr}`;
    if (this.landKey === key && this.land) return;
    this.landKey = key;
    const cv = (this.land = canvas(L.w * dpr, L.h * dpr));
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintLand(ctx, L, this.run, this.opts.strips ?? true);
  }

  private bakeGreen(L: Layout, dpr: number): CanvasRenderingContext2D | null {
    const key = `${L.w}|${L.h}|${L.S}|${dpr}`;
    if (this.greenKey !== key || !this.green) {
      this.greenKey = key;
      this.green = canvas(L.w * dpr, L.h * dpr);
      this.drawnLeaves.fill(0);
      this.drawnFlowers.fill(0);
      this.drawnTufts.fill(0);
    }
    const ctx = this.green?.getContext('2d') ?? null;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  /** Add the dots the green has newly reached (most frames: none). */
  private growGreen(L: Layout, dpr: number): void {
    const ctx = this.bakeGreen(L, dpr);
    if (!ctx) return;
    const r = this.run, v = r.v, S = L.S;
    const dot = (cx: number, cy: number, d: Dot) => {
      const x = cx + d.x * S, y = cy + d.y * S, rad = Math.max(0.9, d.r * S);
      if (d.blade) {
        ctx.strokeStyle = d.c;
        ctx.lineWidth = Math.max(0.8, rad * 0.55);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rad * 0.7, y - rad * 2.2);
        ctx.moveTo(x, y);
        ctx.lineTo(x - rad * 0.8, y - rad * 1.8);
        ctx.stroke();
      } else {
        ctx.fillStyle = d.c;
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    for (let fi = 0; fi < v.fields.length; fi++) {
      const g = r.green[fi];
      if (g <= 0) continue;
      const c = v.fields[fi], cx = L.bx + ((c % L.cols) + 0.5) * S, cy = L.by + (Math.floor(c / L.cols) + 0.5) * S;
      const lv = this.leaves[fi];
      let k = this.drawnLeaves[fi];
      while (k < lv.length && lv[k].d <= g) dot(cx, cy, lv[k++]);
      this.drawnLeaves[fi] = k;
      if (g >= 1) {
        const fl = this.flowers[fi];
        let j = this.drawnFlowers[fi];
        while (j < fl.length && fl[j].d <= g) {
          const d = fl[j++], x = cx + d.x * S, y = cy + d.y * S, pr = Math.max(0.8, d.r * S);
          ctx.fillStyle = d.c;
          for (let p = 0; p < 5; p++) {
            ctx.beginPath();
            ctx.arc(x + Math.cos((p / 5) * TAU) * pr, y + Math.sin((p / 5) * TAU) * pr, pr * 0.8, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#f6e3a1';
          ctx.beginPath();
          ctx.arc(x, y, pr * 0.55, 0, TAU);
          ctx.fill();
        }
        this.drawnFlowers[fi] = j;
      }
    }
    for (let s = 0; s < r.tuft.length; s++) {
      const g = r.tuft[s];
      if (g <= 0) continue;
      const cell = s >> 2, d = s & 3;
      const cx = L.bx + ((cell % L.cols) + 0.5 + DX[d] * 0.5) * S, cy = L.by + (Math.floor(cell / L.cols) + 0.5 + DY[d] * 0.5) * S;
      let k = this.drawnTufts[s];
      while (k < this.tuft.length && this.tuft[k].d <= g) dot(cx, cy, this.tuft[(k++ + s) % this.tuft.length]);
      this.drawnTufts[s] = k;
    }
  }

  // ── a frame ────────────────────────────────────────────────────
  /** Draw the valley into `ctx` (CSS px, the caller set the transform), shifted by `dx` for a slide. */
  draw(ctx: CanvasRenderingContext2D, L: Layout, dpr: number, st: BoardState, dx = 0): void {
    const r = this.run, v = r.v, S = L.S, t = st.t;
    this.bakeLand(L, dpr);
    this.growGreen(L, dpr);
    ctx.save();
    if (dx) ctx.translate(dx, 0);
    if (this.land) ctx.drawImage(this.land, 0, 0, L.w, L.h);
    // damp sand where water spilt, the pools, then the green around them
    for (let k = 0; k < r.spilt.length; k++) {
      if (r.spilt[k] <= 0) continue;
      const cell = k >> 2, d = k & 3;
      const x = L.bx + ((cell % L.cols) + 0.5 + DX[d] * 0.5) * S, y = L.by + (Math.floor(cell / L.cols) + 0.5 + DY[d] * 0.5) * S;
      ctx.fillStyle = rgba('#8a6a3a', Math.min(0.32, 0.08 + r.spilt[k] * 0.04));
      ctx.beginPath();
      ctx.ellipse(x, y, S * 0.2, S * 0.13, d % 2 ? Math.PI / 2 : 0, 0, TAU);
      ctx.fill();
    }
    for (let fi = 0; fi < v.fields.length; fi++) this.pool(ctx, L, fi, st);
    if (this.green) ctx.drawImage(this.green, 0, 0, L.w, L.h);
    this.stones(ctx, L, dpr, st);
    if (!st.blind) this.water(ctx, L, st);
    this.outlines(ctx, L, st);
    if (!st.blind) this.leaks(ctx, L, st);
    this.sources(ctx, L, st);
    // the Sela's veil over the stones: a limestone haze, the green growing over it
    if (st.veil > 0.001) {
      ctx.fillStyle = rgba('#e9dfcb', 0.86 * st.veil);
      for (let i = 0; i < v.n; i++) {
        const k = v.kind[i];
        if (k !== STONE && k !== WELL && k !== FOUR) continue;
        ctx.fillRect(L.bx + (i % L.cols) * S - 0.5, L.by + Math.floor(i / L.cols) * S - 0.5, S + 1, S + 1);
      }
      if (this.green) {
        ctx.globalAlpha = st.veil;
        ctx.drawImage(this.green, 0, 0, L.w, L.h);
        ctx.globalAlpha = 1;
      }
    }
    this.nest(ctx, L, st);
    this.pilgrims(ctx, L, st);
    // the hint's glow on the water's edge, the keyboard cursor
    if (st.hint >= 0 && st.veil < 0.2) {
      const x = L.bx + (st.hint % L.cols) * S, y = L.by + Math.floor(st.hint / L.cols) * S;
      const a = st.reduced ? 0.55 : 0.35 + 0.3 * Math.sin(t * 4.2);
      ctx.save();
      ctx.shadowColor = rgba('#fff8e0', 0.9);
      ctx.shadowBlur = S * 0.25;
      ctx.strokeStyle = rgba('#fffaf0', a + 0.2);
      ctx.lineWidth = Math.max(2, S * 0.04);
      ctx.beginPath();
      roundRect(ctx, x + 2, y + 2, S - 4, S - 4, S * 0.13);
      ctx.stroke();
      ctx.restore();
    }
    if (st.cursor >= 0) {
      const x = L.bx + (st.cursor % L.cols) * S, y = L.by + Math.floor(st.cursor / L.cols) * S;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = Math.max(2, S * 0.035);
      ctx.beginPath();
      roundRect(ctx, x + 1.5, y + 1.5, S - 3, S - 3, S * 0.14);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** A field's pool: it fills from its inlet's side, turquoise at the ankle deepening to pool blue for a river; four ticks tell the depth. */
  private pool(ctx: CanvasRenderingContext2D, L: Layout, fi: number, st: BoardState): void {
    const v = this.run.v, S = L.S, cell = v.fields[fi];
    const x = L.bx + (cell % L.cols) * S, y = L.by + Math.floor(cell / L.cols) * S;
    if (st.blind) {
      // a stone slab over the pool
      ctx.save();
      const g = ctx.createLinearGradient(x, y, x + S, y + S);
      g.addColorStop(0, '#d8cbb2');
      g.addColorStop(1, '#bfae90');
      ctx.fillStyle = g;
      ctx.beginPath();
      roundRect(ctx, x + S * 0.1, y + S * 0.1, S * 0.8, S * 0.8, S * 0.12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,88,60,.45)';
      ctx.lineWidth = Math.max(1, S * 0.02);
      ctx.beginPath();
      roundRect(ctx, x + S * 0.16, y + S * 0.16, S * 0.68, S * 0.68, S * 0.08);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const jars = this.shown[fi];
    const level = depthOf(jars);
    if (jars > 0.02) {
      const k = clamp(jars / 25), fill = 0.34 + 0.66 * Math.pow(k, 0.65);
      const side = inletOf(this.run, fi);
      const ix = x + S * 0.17, iy = y + S * 0.17, iw = S * 0.66;
      let px = ix, py = iy, pw = iw, ph = iw;
      if (side === 3) pw = iw * fill;
      else if (side === 1) { pw = iw * fill; px = ix + iw - pw; }
      else if (side === 0) ph = iw * fill;
      else if (side === 2) { ph = iw * fill; py = iy + iw - ph; }
      else { pw = ph = iw * fill; px = ix + (iw - pw) / 2; py = iy + (iw - ph) / 2; }
      const frac = level + (level < 4 ? clamp((jars - [0, 3, 8, 15, 25][level]) / ([3, 8, 15, 25, 25][level] - [0, 3, 8, 15, 25][level] || 1)) : 0);
      ctx.save();
      ctx.fillStyle = poolColor(frac);
      ctx.beginPath();
      roundRect(ctx, px, py, pw, ph, S * 0.12);
      ctx.fill();
      ctx.clip();
      // the light on the water: a soft band and slow ripple lines
      ctx.strokeStyle = rgba(C.foam, 0.45);
      ctx.lineWidth = Math.max(1, S * 0.018);
      const drift = st.reduced ? 0 : (st.t * 0.12) % 1;
      for (let i = 0; i < 3; i++) {
        const yy = py + ph * ((i + drift) / 3);
        ctx.beginPath();
        ctx.moveTo(px + pw * 0.15, yy);
        ctx.quadraticCurveTo(px + pw * 0.5, yy - S * 0.03, px + pw * 0.85, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(px, py, pw, ph * 0.3);
      ctx.restore();
      if (level >= 4 && !st.reduced) {
        // a river overflows: rings at the rim
        const p = (st.t * 0.6) % 1;
        ctx.strokeStyle = rgba(C.foam, 0.5 * (1 - p));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        roundRect(ctx, x + S * (0.12 - p * 0.06), y + S * (0.12 - p * 0.06), S * (0.76 + p * 0.12), S * (0.76 + p * 0.12), S * 0.16);
        ctx.stroke();
      }
    }
    // four depth ticks on the rim
    for (let i = 0; i < 4; i++) {
      const on = i < level;
      ctx.fillStyle = on ? '#f7fffd' : 'rgba(80,60,36,.32)';
      const tx = x + S * (0.3 + i * 0.13), ty = y + S * 0.075;
      ctx.beginPath();
      roundRect(ctx, tx - S * 0.025, ty - S * 0.022, S * 0.05, S * 0.044, S * 0.012);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = rgba(C.pool, 0.6);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }

  private stones(ctx: CanvasRenderingContext2D, L: Layout, dpr: number, st: BoardState): void {
    const v = this.run.v, S = L.S;
    for (let i = 0; i < v.n; i++) {
      const k = v.kind[i];
      if (k !== STONE && k !== WELL && k !== FOUR) continue;
      const look: StoneLook = k === WELL ? 'well' : k === FOUR ? 'four' : v.fixed[i] ? 'fixed' : 'stone';
      const sp = stoneSprite(v.ports(i), look, S, dpr);
      if (!sp) continue;
      const x = L.bx + (i % L.cols) * S, y = L.by + Math.floor(i / L.cols) * S;
      const off = this.offset(i);
      if (off !== 0) {
        ctx.save();
        ctx.translate(x + S / 2, y + S / 2);
        ctx.rotate(off * Math.PI / 2);
        ctx.drawImage(sp, -S / 2, -S / 2, S, S);
        ctx.restore();
      } else ctx.drawImage(sp, x, y, S, S);
      if (st.blind) {
        // a stone lid over the channel: darker limestone, its groove line still carved
        ctx.save();
        ctx.translate(x + S / 2, y + S / 2);
        if (off) ctx.rotate(off * Math.PI / 2);
        ctx.strokeStyle = 'rgba(186,170,140,.92)';
        ctx.lineWidth = S * GROOVE * 0.92;
        ctx.lineCap = 'round';
        ctx.beginPath();
        traceAll(ctx, v.ports(i), S);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(96,78,52,.55)';
        ctx.lineWidth = Math.max(1, S * 0.025);
        ctx.beginPath();
        traceAll(ctx, v.ports(i), S);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  /** The water in the grooves: a stone fills from its upstream side, then on out; a bright front where it is still coming. */
  private water(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const r = this.run, v = r.v, S = L.S;
    let any = false;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = S * STREAM;
    ctx.strokeStyle = C.water;
    ctx.beginPath();
    for (let i = 0; i < v.n; i++) {
      const w = r.wet[i];
      if (w <= 0.001 || !v.shape[i]) continue;
      any = true;
      this.cellArms(ctx, L, i, w);
    }
    if (any) ctx.stroke();
    if (any) {
      // the shimmer: highlights moving downstream, faster and brighter with more water
      ctx.lineWidth = S * STREAM * 0.34;
      ctx.strokeStyle = rgba(C.foam, 0.35 + 0.45 * st.phi);
      ctx.setLineDash([S * 0.12, S * 0.26]);
      ctx.lineDashOffset = st.reduced ? 0 : -st.t * S * (0.6 + 2 * st.phi);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** Add cell `i`'s wet arms to the current path (filled `w` of the way). */
  private cellArms(ctx: CanvasRenderingContext2D, L: Layout, i: number, w: number): void {
    const v = this.run.v, f = v.flow, S = L.S, m = v.ports(i);
    const x = L.bx + ((i % L.cols) + 0.5) * S, y = L.by + (Math.floor(i / L.cols) + 0.5) * S;
    const off = this.offset(i);
    // where the water comes in: the cell it comes from, a spring's side, or (a well) the middle
    let up = -1;
    const from = f.from[i];
    if (from >= 0) for (let d = 0; d < 4; d++) if (v.neighbour(i, d) === from) up = d;
    if (from === -1 && v.inlet[i] >= 0) up = v.inlet[i];
    ctx.save();
    ctx.translate(x, y);
    if (off) ctx.rotate(off * Math.PI / 2);
    const inK = up >= 0 ? clamp(w / 0.5) : 1, outK = up >= 0 ? clamp((w - 0.5) / 0.5) : clamp(w);
    for (let d = 0; d < 4; d++) {
      if (!(m & BIT[d])) continue;
      if (d === up) strokeArm(ctx, m, S, d, 0, inK);
      else if (outK > 0) strokeArm(ctx, m, S, d, 1 - outK, 1);
    }
    ctx.restore();
  }

  /** The bright outline of joined grooves where the water reaches (still drawn under the blind Nurt's lids). */
  private outlines(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const v = this.run.v, f = v.flow, S = L.S, gh = (S * GROOVE) / 2 + 0.6;
    ctx.save();
    ctx.strokeStyle = rgba(C.foam, st.veil > 0 ? 0.7 * (1 - st.veil) : 0.7);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < f.count; k++) {
      const i = f.order[k], m = v.ports(i);
      if (!v.shape[i] || this.offset(i) !== 0) continue;
      const x = L.bx + ((i % L.cols) + 0.5) * S, y = L.by + (Math.floor(i / L.cols) + 0.5) * S;
      if (isBend(m)) {
        const [a, b] = [0, 1, 2, 3].filter(d => m & BIT[d]);
        if (!this.joined(i, a) || !this.joined(i, b)) continue;
        const cx = x + (DX[a] + DX[b]) * S / 2, cy = y + (DY[a] + DY[b]) * S / 2;
        const a0 = Math.atan2(y + DY[a] * S / 2 - cy, x + DX[a] * S / 2 - cx), a1 = Math.atan2(y + DY[b] * S / 2 - cy, x + DX[b] * S / 2 - cx);
        let span = a1 - a0;
        while (span > Math.PI) span -= TAU;
        while (span < -Math.PI) span += TAU;
        for (const rr of [S / 2 - gh, S / 2 + gh]) {
          ctx.moveTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
          ctx.arc(cx, cy, rr, a0, a1, span < 0);
        }
        continue;
      }
      const hub = v.kind[i] === FOUR ? S * 0.31 : v.kind[i] === WELL ? S * 0.3 : popOne(m) ? S * 0.2 : 0;
      const cross = (m & (BIT[0] | BIT[2])) !== 0 && (m & (BIT[1] | BIT[3])) !== 0;
      for (let d = 0; d < 4; d++) {
        if (!(m & BIT[d]) || !this.joined(i, d)) continue;
        const px = -DY[d], py = DX[d], start = Math.max(hub, cross ? gh : 0);
        for (const sgn of [-1, 1]) {
          ctx.moveTo(x + DX[d] * start + px * gh * sgn, y + DY[d] * start + py * gh * sgn);
          ctx.lineTo(x + DX[d] * (S / 2 - 1) + px * gh * sgn, y + DY[d] * (S / 2 - 1) + py * gh * sgn);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Whether side `d` of reached cell `i` lets the water on: a matching neighbour, a field, or its spring. */
  private joined(i: number, d: number): boolean {
    const v = this.run.v, nb = v.neighbour(i, d);
    if (nb < 0) return v.inlet[i] === d;
    const k = v.kind[nb];
    if (k === FIELD) return true;
    if (k === ROCK) return false;
    return (v.ports(nb) & BIT[opp(d)]) !== 0;
  }

  /** A splash where a full channel leaks: droplets fanning out over the edge. */
  private leaks(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const r = this.run, f = r.v.flow, S = L.S;
    for (let k = 0; k < f.nOut; k++) {
      if (f.outField[k] >= 0) continue;
      const i = f.outCell[k], d = f.outDir[k];
      if (r.wet[i] < 1) continue;
      const x = L.bx + ((i % L.cols) + 0.5 + DX[d] * 0.5) * S, y = L.by + (Math.floor(i / L.cols) + 0.5 + DY[d] * 0.5) * S;
      ctx.fillStyle = rgba(C.water, 0.85);
      for (let j = 0; j < 4; j++) {
        const ph = st.reduced ? 0.5 : (st.t * 1.6 + j * 0.27 + i * 0.13) % 1;
        const spread = (j - 1.5) * 0.5;
        const dist = S * (0.04 + 0.16 * ph);
        const px = x + DX[d] * dist + (-DY[d]) * spread * S * 0.14 * ph, py = y + DY[d] * dist + DX[d] * spread * S * 0.14 * ph;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(1, S * 0.028 * (1 - ph * 0.4)), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /** The springs and the wells: ripple rings, the curb stones laid this session, the gauge of how much water runs. */
  private sources(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const v = this.run.v, S = L.S, t = st.t;
    for (const s of v.sources) {
      const c = s.cell;
      const cx = L.bx + ((c % L.cols) + 0.5) * S, cy = L.by + (Math.floor(c / L.cols) + 0.5) * S;
      const mx = s.side >= 0 ? cx + DX[s.side] * (S / 2 + L.rim * 0.5) : cx;
      const my = s.side >= 0 ? cy + DY[s.side] * (S / 2 + L.rim * 0.5) : cy;
      if (!st.blind) {
        // ripple rings: more of them, brighter, as more water runs; still while the signal is out
        const rate = 0.6 + 1.6 * st.phi, alive = st.flowing ? 1 : 0.35;
        const n = 3;
        for (let k = 0; k < n; k++) {
          const p = st.reduced || st.haze > 0.6 ? (k + 0.5) / n : ((t * rate) / n + k / n) % 1;
          ctx.strokeStyle = rgba(C.foam, (0.25 + 0.5 * st.phi) * (1 - p) * alive);
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(mx, my, S * (0.08 + 0.32 * p), 0, TAU);
          ctx.stroke();
        }
        if (st.gauge && st.haze < 0.5) {
          ctx.strokeStyle = rgba(C.water, 0.85);
          ctx.lineWidth = Math.max(2, S * 0.035);
          ctx.lineCap = 'round';
          const base = s.side >= 0 ? Math.atan2(DY[s.side], DX[s.side]) : -Math.PI / 2;
          const span = Math.PI * (0.15 + 0.85 * st.phi);
          ctx.beginPath();
          ctx.arc(mx, my, S * 0.3, base - span / 2, base + span / 2);
          ctx.stroke();
        }
      }
      // the curb: one small dressed stone for each Nurt passed, around the mouth
      for (let k = 0; k < Math.min(6, st.curb); k++) {
        const base = s.side >= 0 ? Math.atan2(DY[s.side], DX[s.side]) : -Math.PI / 2;
        const a = base + (k - 2.5) * 0.42;
        const rr = s.side >= 0 ? S * 0.22 : S * 0.42;
        const sx = mx + Math.cos(a) * rr, sy = my + Math.sin(a) * rr;
        ctx.fillStyle = 'rgba(70,50,30,.3)';
        ctx.beginPath();
        roundRect(ctx, sx - S * 0.04 + 1, sy - S * 0.03 + 1.2, S * 0.08, S * 0.06, S * 0.015);
        ctx.fill();
        ctx.fillStyle = '#f1e8d6';
        ctx.beginPath();
        roundRect(ctx, sx - S * 0.04, sy - S * 0.03, S * 0.08, S * 0.06, S * 0.015);
        ctx.fill();
      }
      if (st.haze > 0.02) {
        // the signal failing: a soft haze drifts over the source
        const g = ctx.createRadialGradient(mx, my, 0, mx, my, S * 0.6);
        g.addColorStop(0, rgba('#f4f0e8', 0.75 * st.haze));
        g.addColorStop(1, rgba('#f4f0e8', 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx + Math.sin(t * 0.4) * S * 0.06, my, S * 0.6, 0, TAU);
        ctx.fill();
      }
    }
  }

  /** The pair of Psalm 84:3 at the greenest field's rim, with their nest (and young). */
  private nest(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const n = this.run.nest;
    if (!n) return;
    const S = L.S, c = this.run.v.fields[n.field];
    const x = L.bx + ((c % L.cols) + 0.86) * S, y = L.by + (Math.floor(c / L.cols) + 0.86) * S;
    const k = st.reduced ? 1 : ease.outCubic(clamp(st.nestIn));
    paintNest(ctx, x, y, S * 0.24, n.young, st.t);
    const size = Math.max(10, S * 0.2);
    const fly = (1 - k) * S * 1.2;
    const flap = k < 1 ? 0.5 + 0.5 * Math.sin(st.t * 30) : 0;
    paintBird(ctx, n.bird, x - S * 0.2 - fly * 0.6, y - S * 0.12 - fly, size, 1, flap);
    paintBird(ctx, n.bird, x + S * 0.16 + fly * 0.5, y - S * 0.2 - fly * 1.1, size * 0.94, -1, flap);
  }

  /** Three or four tiny pilgrims on the rim by the valley's lowest field: walking in a Nurt, sitting in a Sela. */
  private pilgrims(ctx: CanvasRenderingContext2D, L: Layout, st: BoardState): void {
    const S = L.S, size = Math.max(4.5, S * 0.075);
    const baseX = L.bx + L.bw * 0.08, y = L.by + L.bh + L.rim * 0.5;
    for (let i = 0; i < 4; i++) {
      const walk = st.rest || st.reduced ? 0 : ((st.t * 2.2 + i * 9) % (L.bw * 0.3));
      paintPilgrim(ctx, baseX + i * size * 2.6 + walk, y + (i % 2) * size * 0.4, size, i, st.rest);
    }
  }
}

const popOne = (m: number): boolean => m === 1 || m === 2 || m === 4 || m === 8;

/** The whole channel of mask `m` (for the lids). */
function traceAll(ctx: CanvasRenderingContext2D, m: number, S: number): void {
  for (let d = 0; d < 4; d++) if (m & BIT[d]) strokeArm(ctx, m, S, d, 0, 1);
}

/** The side a field drinks from (the first inlet the search found; else its solved neighbour), −1: unknown. */
function inletOf(r: Run, fi: number): number {
  const v = r.v, f = v.flow;
  for (let k = 0; k < f.nOut; k++) if (f.outField[k] === fi) return opp(f.outDir[k]);
  const cell = v.fields[fi];
  for (let d = 0; d < 4; d++) {
    const nb = v.neighbour(cell, d);
    if (nb >= 0 && v.shape[nb] && v.solvedPorts(nb) & BIT[opp(d)]) return d;
  }
  return -1;
}

/**
 * The land under a valley (baked once per valley and size): limestone with contour lines, the
 * pilgrims' road, a darker band under the runner's strip, the rose-rock rim with the springs'
 * mouths, the valley floor, rock outcrops, the field beds and their terraces.
 */
export function paintLand(ctx: CanvasRenderingContext2D, L: Layout, r: Run, strips = true): void {
  const { w, h, bx, by, bw, bh, rim, S } = L, v = r.v;
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#e2d5bd');
  bg.addColorStop(0.5, C.lime);
  bg.addColorStop(1, '#d8c9ad');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(bx + bw / 2, by + bh / 2, Math.min(bw, bh) * 0.3, bx + bw / 2, by + bh / 2, Math.max(w, h) * 0.75);
  glow.addColorStop(0, 'rgba(247,240,226,.55)');
  glow.addColorStop(1, 'rgba(247,240,226,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
  paintContours(ctx, w, h, (r.seed % 9973) + 1, { scale: 150, levels: 8, color: C.ink, alpha: 0.11 });
  // the pilgrims' road: a worn path winding across the map behind the valley
  ctx.save();
  ctx.strokeStyle = 'rgba(150,118,76,.38)';
  ctx.lineWidth = Math.max(3, S * 0.07);
  ctx.setLineDash([S * 0.09, S * 0.07]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-10, h * 0.9);
  ctx.bezierCurveTo(w * 0.25, h * 0.98, w * 0.15, by + bh * 0.4, bx - rim * 2, by + bh * 0.3);
  ctx.moveTo(bx + bw + rim * 2, by + bh * 0.7);
  ctx.bezierCurveTo(w * 0.9, by + bh * 0.4, w * 0.8, h * 0.1, w + 10, h * 0.06);
  ctx.stroke();
  ctx.restore();
  // the rim of rose rock, irregular outside, shaded where it meets the valley floor
  const ox = bx - rim, oy = by - rim, ow = bw + 2 * rim, oh = bh + 2 * rim;
  ctx.save();
  ctx.fillStyle = 'rgba(80,52,40,.22)';
  ctx.beginPath();
  rimPath(ctx, ox + rim * 0.25, oy + rim * 0.45, ow, oh, rim, r.seed);
  ctx.fill();
  const rg = ctx.createLinearGradient(ox, oy, ox + ow, oy + oh);
  rg.addColorStop(0, '#d7a796');
  rg.addColorStop(0.5, C.rose);
  rg.addColorStop(1, '#b67b67');
  ctx.fillStyle = rg;
  ctx.beginPath();
  rimPath(ctx, ox, oy, ow, oh, rim, r.seed);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(110,62,48,.22)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let k = -oh; k < ow + oh; k += Math.max(4, rim * 0.6)) {
    ctx.moveTo(ox + k, oy + oh);
    ctx.lineTo(ox + k + oh * 0.6, oy);
  }
  ctx.stroke();
  ctx.restore();
  // the valley floor, seen in the joints between the stones
  ctx.save();
  ctx.fillStyle = '#c9b796';
  ctx.beginPath();
  roundRect(ctx, bx - 1, by - 1, bw + 2, bh + 2, S * 0.1);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,40,.35)';
  ctx.lineWidth = Math.max(1.5, rim * 0.2);
  ctx.stroke();
  ctx.restore();
  // the springs' mouths in the rim
  for (const s of v.sources) {
    if (s.kind !== 'spring') continue;
    const c = s.cell, cx = bx + ((c % L.cols) + 0.5) * S, cy = by + (Math.floor(c / L.cols) + 0.5) * S;
    const mx = cx + DX[s.side] * (S / 2 + rim * 0.5), my = cy + DY[s.side] * (S / 2 + rim * 0.5);
    const along = s.side % 2 === 0;
    const rx = along ? S * 0.22 : rim * 0.62, ry = along ? rim * 0.62 : S * 0.22;
    ctx.fillStyle = '#e6c3b4';
    ctx.beginPath();
    ctx.ellipse(mx, my, rx + 2.5, ry + 2.5, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(rx, ry));
    g.addColorStop(0, '#0e2a33');
    g.addColorStop(0.7, '#1d4a55');
    g.addColorStop(1, '#3d6f73');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(mx, my, rx, ry, 0, 0, TAU);
    ctx.fill();
  }
  // rock outcrops and field beds
  for (let i = 0; i < v.n; i++) {
    const x = bx + (i % L.cols) * S, y = by + Math.floor(i / L.cols) * S;
    if (v.kind[i] === ROCK) paintRock(ctx, x, y, S, i * 13 + (r.seed % 101));
    else if (v.kind[i] === FIELD) paintFieldBed(ctx, x, y, S);
  }
  if (!strips) return;
  // darker bands under the runner's strips, so its timer and buttons read on the light land
  const top = ctx.createLinearGradient(0, 0, 0, 96);
  top.addColorStop(0, 'rgba(44,34,30,.55)');
  top.addColorStop(1, 'rgba(44,34,30,0)');
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, 96);
  const bot = ctx.createLinearGradient(0, h - 90, 0, h);
  bot.addColorStop(0, 'rgba(44,34,30,0)');
  bot.addColorStop(1, 'rgba(44,34,30,.32)');
  ctx.fillStyle = bot;
  ctx.fillRect(0, h - 90, w, 90);
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  vig.addColorStop(0, 'rgba(70,48,36,0)');
  vig.addColorStop(1, 'rgba(70,48,36,.22)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

/** The rim's outline: a rounded rectangle whose outer edge wanders a little, like worn rock. */
function rimPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rim: number, seed: number): void {
  const pts: [number, number][] = [];
  const step = Math.max(8, rim * 1.2);
  const wob = (k: number) => (hash(seed * 0.37 + k * 1.91) - 0.5) * rim * 0.5;
  let k = 0;
  for (let px = x; px < x + w; px += step) pts.push([px, y + wob(k++)]);
  for (let py = y; py < y + h; py += step) pts.push([x + w + wob(k++), py]);
  for (let px = x + w; px > x; px -= step) pts.push([px, y + h + wob(k++)]);
  for (let py = y + h; py > y; py -= step) pts.push([x + wob(k++), py]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [cx, cy] = pts[i];
    ctx.quadraticCurveTo(ax, ay, (ax + cx) / 2, (ay + cy) / 2);
  }
  ctx.closePath();
}

/**
 * A valley in miniature (the finale's strip of the day): its rim, rock, stones as faint tiles with
 * their channels (turquoise once it was watered), the pools by depth, the green and the nest.
 */
export function paintMini(ctx: CanvasRenderingContext2D, r: Run, x: number, y: number, size: number, t: number): void {
  const v = r.v, s = size / Math.max(v.cols, v.rows), w = s * v.cols, h = s * v.rows;
  const ox = x + (size - w) / 2, oy = y + (size - h) / 2, rim = Math.max(2, s * 0.14);
  ctx.save();
  ctx.fillStyle = 'rgba(70,48,36,.25)';
  ctx.beginPath();
  roundRect(ctx, ox - rim + 2, oy - rim + 3, w + 2 * rim, h + 2 * rim, rim * 2);
  ctx.fill();
  ctx.fillStyle = C.rose;
  ctx.beginPath();
  roundRect(ctx, ox - rim, oy - rim, w + 2 * rim, h + 2 * rim, rim * 2);
  ctx.fill();
  ctx.fillStyle = '#d8caae';
  ctx.fillRect(ox, oy, w, h);
  for (let i = 0; i < v.n; i++) {
    const cx = ox + (i % v.cols) * s, cy = oy + Math.floor(i / v.cols) * s, k = v.kind[i];
    if (k === ROCK) {
      ctx.fillStyle = C.rose;
      ctx.beginPath();
      ctx.arc(cx + s / 2, cy + s / 2, s * 0.36, 0, TAU);
      ctx.fill();
    } else if (k === FIELD) {
      ctx.fillStyle = '#cdae7c';
      ctx.beginPath();
      roundRect(ctx, cx + s * 0.1, cy + s * 0.1, s * 0.8, s * 0.8, s * 0.2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#efe6d4';
      ctx.fillRect(cx + 0.5, cy + 0.5, s - 1, s - 1);
    }
  }
  // the green, then the channels and the pools
  for (let fi = 0; fi < v.fields.length; fi++) {
    const g = r.green[fi];
    if (g <= 0) continue;
    const c = v.fields[fi];
    const gx = ox + ((c % v.cols) + 0.5) * s, gy = oy + (Math.floor(c / v.cols) + 0.5) * s;
    ctx.fillStyle = rgba(C.sage, 0.75);
    ctx.beginPath();
    ctx.arc(gx, gy, (g + 0.4) * s, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.strokeStyle = r.closed ? C.water : 'rgba(156,139,112,.8)';
  ctx.beginPath();
  for (let i = 0; i < v.n; i++) {
    if (!v.shape[i]) continue;
    const m = v.ports(i), cx = ox + ((i % v.cols) + 0.5) * s, cy = oy + (Math.floor(i / v.cols) + 0.5) * s;
    for (let d = 0; d < 4; d++) {
      if (!(m & BIT[d])) continue;
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + DX[d] * s * 0.5, cy + DY[d] * s * 0.5);
    }
  }
  ctx.stroke();
  for (let fi = 0; fi < v.fields.length; fi++) {
    const j = r.jars[fi];
    if (j <= 0) continue;
    const c = v.fields[fi], d = depthOf(j);
    ctx.fillStyle = poolColor(d);
    ctx.beginPath();
    ctx.arc(ox + ((c % v.cols) + 0.5) * s, oy + (Math.floor(c / v.cols) + 0.5) * s, s * (0.16 + 0.06 * d), 0, TAU);
    ctx.fill();
  }
  if (r.nest) {
    const c = v.fields[r.nest.field];
    const nx = ox + ((c % v.cols) + 0.9) * s, ny = oy + (Math.floor(c / v.cols) + 0.9) * s;
    paintNest(ctx, nx, ny, Math.max(6, s * 0.4), r.nest.young, t);
  }
  ctx.restore();
}
