/**
 * Pasterz's HUD on the play canvas: the status on a parchment wash (the block's name, a strategy to
 * try, the block's progress and the telegraph), the headline — sheep gathered this session —
 * counting up live, the pasture's bar (gathered / on the hill), the tally strip (the band's last
 * 40 s in a parchment skin with the lag bracket at its "now" end), the block card after each block
 * (its own mini-curve, its name and its verdict), the toasts (a named lamb, a mission, the day's
 * gift), the words floating over the hill, the fold's count with its lit steps, and the finisher.
 * Every string is fitted to its room so it reads on a 390 px phone in German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, drawTrace, type TraceBand, type TraceStyle } from '../kit/trace';
import { TIPS } from './content';
import { t, unit } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintStar } from './paint';
import { RULES, type BlockKind, type PasterzSim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

/** A card after a block: its name, its verdict and the block's own curve (normalised 0..1). */
interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  bands: TraceBand[]; blind: boolean; kind: BlockKind | 'toast'; dot?: string;
}

const TXT = {
  warmup: t('block.warmup'), call: t('block.call'), blind: t('block.blind'), watch: t('block.watch'), finale: t('block.finale'),
  nextCall: t('next.call'), nextBlind: t('next.blind'), nextWatch: t('next.watch'), nextFinale: t('next.finale'),
  hint: t('hint.walk'), fold: t('bar.fold'), self: t('bar.self'), night: t('bar.night'), count: t('bar.count'),
  finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
};

const PARCHMENT: TraceStyle = {
  line: 'rgba(92,74,50,.85)', above: '#d08a10', lineWidth: 2, aboveFill: 'rgba(242,182,50,.32)', threshold: 'rgba(92,74,50,.55)',
  focusBand: 'rgba(242,182,50,.10)', restBand: 'rgba(95,140,205,.22)', gap: 'rgba(92,80,60,.7)', veil: 'rgba(64,56,84,.88)',
  now: '#c98a12', glow: 'rgba(242,182,50,.35)',
};

const PX = /(\d+(?:\.\d+)?)px/;

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private F = Hud.fontsFor(1);
  private shown = 0;
  private pop = 0;
  private hintA = 0;
  private tipCache = { text: '', w: -1, lines: [] as string[] };
  private countPop = 0;
  private stepFlash = 0;
  private finaleA = 0;
  private readonly lagLabel: string;
  private readonly lag: number;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 19 * u, SERIF), tip: font(500, 12.5 * u, SANS), small: font(650, 11.5 * u, SANS), score: font(500, 40 * u, SERIF),
      unit: font(650, 12.5 * u, SANS), bar: font(700, 11.5 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true), cardSub: font(650, 12 * u, SANS),
      count: font(600, 46 * u, SERIF), step: font(750, 11 * u, SANS), big: font(500, 26 * u, SERIF, true), lag: font(650, 9 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.tipCache.w = -1;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 14) this.floats.shift();
  }

  popScore(): void { this.pop = 1; }
  popCount(): void { this.countPop = 1; }
  flashStep(): void { this.stepFlash = 1; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: PasterzSim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, stars: number): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'call' ? (blind ? TXT.blind : TXT.call) : TXT.watch;
    let sub: string, color: string = C.ink;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) });
      color = '#6a4fa0';
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'call' ? t('card.call.pass') : `${t('card.watch.pass')} · ${t('stars', { n: stars })}`;
      color = kind === 'call' ? C.goldDeep : '#3f6aa8';
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, bands: lay.bands.map(b => ({ ...b })), blind, kind });
  }

  toast(title: string, sub: string, color: string = C.ink, dot?: string): void {
    this.pushCard({ title, sub, color, t: 0, dur: 2.6, curve: null, bands: [], blind: false, kind: 'toast', dot });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  update(dt: number, sim: PasterzSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.4);
    }
    this.pop = Math.max(0, this.pop - dt * 2.4);
    this.countPop = Math.max(0, this.countPop - dt * 4);
    this.stepFlash = Math.max(0, this.stepFlash - dt * 1.6);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.1);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' || (sim.phase === 'finale' && sim.stage === 'done') ? 1 : 0, dt, 0.4);
  }

  draw(sim: PasterzSim): void {
    this.status(sim);
    this.score();
    this.bar(sim);
    this.tally(sim);
    this.drawFloats();
    this.drawCard();
    this.hintPill();
    this.finale();
  }

  // ── the status ──────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.86): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(246,239,220,${a})`;
    ctx.strokeStyle = 'rgba(160,136,96,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * this.L.u);
    ctx.fill();
    ctx.stroke();
  }

  /** The font `f`, shrunk (to `min` of its size at most) so `text` fits `maxW`. */
  private fit(text: string, maxW: number, f: string, min = 0.7): string {
    const ctx = this.ctx;
    ctx.font = f;
    const w = ctx.measureText(text).width;
    if (w <= maxW) return f;
    const m = f.match(PX);
    if (!m) return f;
    const size = Math.max(Number(m[1]) * min, (Number(m[1]) * maxW) / w);
    return f.replace(m[0], `${Math.round(size * 10) / 10}px`);
  }

  private status(sim: PasterzSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const b = sim.block;
    const name = sim.phase !== 'play' ? TXT.finale : b.kind === 'warmup' ? TXT.warmup : b.kind === 'watch' ? TXT.watch : b.blind ? TXT.blind : TXT.call;
    let tip = sim.phase !== 'play' ? '' : sim.tip;
    if (sim.phase === 'play' && b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    this.paper(r.x, r.y, r.w, r.h);
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = sim.phase === 'play' && b.kind === 'watch' ? '#34507e' : sim.blind ? '#5a4386' : C.ink;
    ctx.font = this.fit(name, r.w - 2 * pad, F.name);
    ctx.fillText(name, r.x + pad, r.y + 8 * u);
    // the tip, two lines at most
    ctx.font = F.tip;
    if (this.tipCache.text !== tip || this.tipCache.w !== r.w) {
      this.tipCache = { text: tip, w: r.w, lines: wrap(ctx, tip, r.w - 2 * pad).slice(0, 2) };
    }
    ctx.fillStyle = 'rgba(58,47,37,.82)';
    this.tipCache.lines.forEach((line, i) => ctx.fillText(line, r.x + pad, r.y + 32 * u + i * 15 * u));
    // the block's progress, or the telegraph
    const by = r.y + r.h - 8 * u;
    const left = sim.phase === 'play' ? b.dur - sim.blockT : 0;
    if (sim.phase === 'play' && left <= RULES.telegraph) {
      const nb = sim.next;
      const txt = !nb ? TXT.nextFinale : nb.kind === 'watch' ? TXT.nextWatch : TXT.nextCall;
      ctx.font = this.fit(txt, r.w - 2 * pad, F.small);
      ctx.fillStyle = '#9a5a10';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sim.t * 6);
      ctx.fillText(txt, r.x + pad, by + 5 * u);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(92,74,50,.18)';
      ctx.fillRect(r.x + pad, by, r.w - 2 * pad, 3 * u);
      ctx.fillStyle = sim.phase === 'play' && b.kind === 'watch' ? '#6f93cc' : C.gold;
      ctx.fillRect(r.x + pad, by, (r.w - 2 * pad) * clamp(sim.phase === 'play' ? sim.blockT / b.dur : 1), 3 * u);
    }
  }

  // ── the headline ────────────────────────────────────────────────
  private score(): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.18 * ease.outBack(this.pop) * this.pop;
    // a parchment tab behind the number, so it reads on any grass
    ctx.font = F.score;
    const nw = Math.max(ctx.measureText(String(n)).width, (ctx.font = F.unit, ctx.measureText(unit(n)).width));
    this.paper(L.scoreX - nw - 22 * u, L.scoreY + 2 * u, nw + 22 * u, 70 * u, 0.8);
    ctx.save();
    ctx.translate(L.scoreX, L.scoreY + 4 * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.score;
    ctx.fillStyle = C.ink;
    ctx.fillText(String(n), -11 * u, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = 'rgba(58,47,37,.8)';
    ctx.fillText(unit(n), L.scoreX - 11 * u, L.scoreY + 50 * u);
  }

  // ── the pasture's bar ───────────────────────────────────────────
  private bar(sim: PasterzSim): void {
    const ctx = this.ctx, r = this.L.bar, u = this.L.u, F = this.F;
    this.paper(r.x, r.y, r.w, r.h, 0.82);
    const pad = 9 * u;
    ctx.textBaseline = 'middle';
    const night = sim.nightBlock && sim.stage === 'graze';
    let label = t('bar.pasture', { n: sim.pastureIndex + 1 });
    if (sim.stage === 'fold') label = sim.phase === 'play' ? TXT.fold : TXT.count;
    else if (sim.stage === 'count' || sim.stage === 'done') label = sim.fold?.self ? TXT.self : TXT.count;
    else if (night) label = TXT.night;
    if (night) {
      const starsW = RULES.starMax * 10 * u;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#34507e';
      ctx.font = this.fit(label, Math.max(40, r.w - 2 * pad - starsW - 8 * u), F.bar, 0.6);
      ctx.fillText(label, r.x + pad, r.y + r.h / 2 + 0.5);
      for (let i = 0; i < RULES.starMax; i++) {
        const sx = r.x + r.w - pad - (RULES.starMax - 1 - i) * 10 * u - 4 * u;
        paintStar(ctx, sx, r.y + r.h / 2, 4 * u, i < sim.stars ? 1 : 0.22);
      }
      return;
    }
    const right = `${sim.gatheredHere}/${sim.onHill}`;
    ctx.font = F.bar;
    const rw = ctx.measureText(right).width;
    const bw = Math.min(90 * u, r.w * 0.28), bx = r.x + r.w - pad - rw - 8 * u - bw, by = r.y + r.h / 2 - 3.5 * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(label, Math.max(40, bx - r.x - pad - 8 * u), F.bar, 0.6);
    ctx.fillText(label, r.x + pad, r.y + r.h / 2 + 0.5);
    // the bar: gathered of the hill, the pasture's time as a thin line under it
    ctx.fillStyle = 'rgba(92,74,50,.18)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 7 * u, 3.5 * u);
    ctx.fill();
    const k = clamp(sim.onHill ? sim.gatheredHere / sim.onHill : 0);
    if (k > 0) {
      ctx.fillStyle = k >= RULES.gatherEnd ? C.gold : '#8fae4f';
      ctx.beginPath();
      ctx.roundRect(bx, by, Math.max(7 * u, bw * k), 7 * u, 3.5 * u);
      ctx.fill();
    }
    if (sim.stage === 'graze') {
      ctx.fillStyle = 'rgba(92,74,50,.45)';
      ctx.fillRect(bx, by + 9 * u, bw * clamp(sim.pastureT / sim.pastureDur), 1.5 * u);
    }
    ctx.textAlign = 'right';
    ctx.font = F.bar;
    ctx.fillStyle = C.ink;
    ctx.fillText(right, r.x + r.w - pad, r.y + r.h / 2 + 0.5);
  }

  // ── the tally strip: the band's last 40 s ───────────────────────
  private tally(sim: PasterzSim): void {
    const ctx = this.ctx, r = this.L.trace, u = this.L.u;
    this.paper(r.x, r.y, r.w, r.h, 0.86);
    // tally marks at the left edge, the shepherd's way of counting
    ctx.strokeStyle = 'rgba(92,74,50,.4)';
    ctx.lineWidth = 1.2;
    const tx = r.x + 8 * u;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(tx + i * 3 * u, r.y + r.h * 0.32);
      ctx.lineTo(tx + i * 3 * u, r.y + r.h * 0.68);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(tx - 2 * u, r.y + r.h * 0.6);
    ctx.lineTo(tx + 11 * u, r.y + r.h * 0.4);
    ctx.stroke();
    const box = { x: r.x + 24 * u, y: r.y + 4 * u, w: r.w - 32 * u, h: r.h - 8 * u };
    const lay = sim.trace.layout(box, sim.t);
    drawTrace(ctx, lay, { ...PARCHMENT, lag: { sec: this.lag, color: 'rgba(92,74,50,.85)' } });
    // the lag's label just left of its bracket ("≈5 s": what you do now shows there)
    const last = lay.points[lay.points.length - 1];
    if (last) {
      ctx.font = this.F.lag;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(92,74,50,.9)';
      ctx.fillText(this.lagLabel, lay.xOf(last.t - this.lag) - 3 * u, box.y + 1);
    }
  }

  // ── the floats ──────────────────────────────────────────────────
  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.font = f.font;
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,250,235,.85)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** Floats are placed in screen px; the view moves them with the camera. */
  shiftFloats(dx: number, dy: number): void {
    for (const f of this.floats) {
      f.x += dx;
      f.y += dy;
    }
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(310 * u, L.w - 32), h = (c.curve ? 104 : 58) * u;
    const x = (L.w - w) / 2, y = L.cardY - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(L.w / 2, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-L.w / 2, -(y + h / 2));
    ctx.shadowColor = 'rgba(40,30,20,.25)';
    ctx.shadowBlur = 14;
    this.paper(x, y, w, h, 0.95);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let tx = x + pad;
    if (c.dot) {
      ctx.fillStyle = c.dot;
      ctx.strokeStyle = 'rgba(40,30,20,.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x + pad + 6 * u, y + 18 * u, 6.5 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      tx += 20 * u;
    }
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(c.title, w - (tx - x) - pad, F.cardTitle);
    ctx.fillText(c.title, tx, y + 8 * u);
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.sub, w - (tx - x) - pad, F.cardSub, 0.62);
    ctx.fillText(c.sub, tx, y + 32 * u);
    if (c.curve && c.curve.length > 1) this.miniCurve(c, x + pad, y + 52 * u, w - 2 * pad, h - 60 * u);
    ctx.restore();
  }

  /** The block's own curve in miniature; a blind block's veil lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    for (const b of c.bands) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(95,140,205,.18)' : 'rgba(242,182,50,.12)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(92,74,50,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(x + p.x * w, y + p.ty * h) : ctx.moveTo(x + p.x * w, y + p.ty * h)));
    ctx.stroke();
    ctx.setLineDash([]);
    const reveal = c.blind ? clamp((c.t - 0.3) / 1.4) : 1;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!a.reliable || !b.reliable || b.x > reveal + 1e-6) continue;
      if (a.above && b.above) {
        ctx.fillStyle = 'rgba(242,182,50,.3)';
        ctx.beginPath();
        ctx.moveTo(x + a.x * w, y + a.ty * h);
        ctx.lineTo(x + a.x * w, y + a.y * h);
        ctx.lineTo(x + b.x * w, y + b.y * h);
        ctx.lineTo(x + b.x * w, y + b.ty * h);
        ctx.fill();
      }
      ctx.strokeStyle = a.above && b.above ? '#d08a10' : 'rgba(92,74,50,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(64,56,84,.85)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  // ── the hint, the count, the finisher ───────────────────────────
  private hintPill(): void {
    if (this.hintA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = this.F.cardSub;
    const w = Math.min(L.w - 32, ctx.measureText(TXT.hint).width + 28 * u), h = 30 * u;
    const x = (L.w - w) / 2, y = L.h - 66 - h - 40 * u;
    ctx.globalAlpha = this.hintA;
    this.paper(x, y, w, h, 0.92);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(TXT.hint, w - 16 * u, this.F.cardSub);
    ctx.fillText(TXT.hint, L.w / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }

  /** The count over the fold: the number popping, and Voodoo's end steps (every tenth sheep lights one). */
  drawCount(sim: PasterzSim, fx: number, fy: number): void {
    if (sim.stage !== 'count' && sim.stage !== 'done') return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const n = sim.foldedHere;
    const k = 1 + 0.3 * this.countPop;
    ctx.save();
    ctx.translate(fx, Math.max(L.hudBottom + 30 * u, fy));
    ctx.scale(k, k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.F.count;
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(58,40,20,.55)';
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = sim.stage === 'done' ? C.gold : C.cream;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    // the steps: as many as tens on the hill (three to six), rising left to right
    const steps = Math.max(3, Math.min(6, Math.ceil(sim.onHill / RULES.stepEvery)));
    const sw = Math.min(54 * u, (L.w - 48) / steps), gap = 4 * u;
    const total = steps * sw + (steps - 1) * gap;
    const x0 = (L.w - total) / 2, base = L.stepsY;
    for (let i = 0; i < steps; i++) {
      const lit = n >= (i + 1) * RULES.stepEvery;
      const hh = (16 + i * 8) * u;
      const x = x0 + i * (sw + gap), y = base - hh;
      const flash = lit && n < (i + 2) * RULES.stepEvery ? this.stepFlash : 0;
      ctx.fillStyle = lit ? C.gold : 'rgba(246,239,220,.8)';
      ctx.strokeStyle = lit ? C.goldDeep : 'rgba(160,136,96,.6)';
      ctx.lineWidth = 1.5;
      if (flash > 0) {
        ctx.shadowColor = 'rgba(255,214,110,.9)';
        ctx.shadowBlur = 18 * flash;
      }
      ctx.beginPath();
      ctx.roundRect(x, y - flash * 6 * u, sw, hh, 5 * u);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = lit ? '#5a3a08' : 'rgba(92,74,50,.7)';
      ctx.font = this.F.step;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String((i + 1) * RULES.stepEvery), x + sw / 2, y + hh / 2 - flash * 6 * u);
    }
  }

  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.w - 32, 340 * u), h = 74 * u, x = (L.w - w) / 2, y = L.cardY - h / 2;
    this.paper(x, y, w, h, 0.94);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, L.w / 2, y + 10 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = 'rgba(58,47,37,.8)';
    ctx.fillText(TXT.finaleSub, L.w / 2, y + 48 * u);
    ctx.globalAlpha = 1;
  }
}

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
