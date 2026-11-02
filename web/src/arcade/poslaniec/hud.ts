/**
 * Posłaniec's HUD on the play canvas: the status on a parchment wash (the block's name, a strategy to
 * try, the block's progress and the telegraph), the metres counting up live with the drachmas, the
 * combo and the road to the next city under them, the block card after each block (its mini-curve,
 * name and verdict; it slides in, stays ~3 s and goes — never in the way of the hands), the cards
 * that take turns over the sky (a letter delivered, a new cloak, an errand, the day's gift), the
 * warm-up's lesson pill and the words floating over the road.  Strings are fitted to their room so
 * they read on a 390 px phone in German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import type { TraceSample } from '../kit/trace';
import { CITIES } from './content';
import type { Move } from './input';
import { grouped, road, t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintCoin } from './paint';
import { paintMiniCurve } from './ribbon';
import { RULES, type PoslaniecSim } from './sim';

interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Card { title: string; sub: string; t: number; dur: number; rank: number; color: string }
export interface BlockCard { name: string; verdict: string; tone: string; pay: number; samples: TraceSample[]; blind: boolean; t: number; dur: number }

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'),
  nextPush: t('next.push'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
};
const HINT: Record<Move, string> = { jump: t('hint.jump'), slide: t('hint.slide'), left: t('hint.left'), right: t('hint.right') };
const ARROW: Record<Move, string> = { jump: '↑', slide: '↓', left: '←', right: '→' };

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private block: BlockCard | null = null;
  private F = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly nextFit = fitSlot();
  private readonly routeFit = fitSlot();
  private readonly hintFit = fitSlot();
  private readonly cardFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, lines: [] as string[] };
  private shown = 0;
  private scoreN = -1;
  private scoreText = '0';
  private pop = 0;
  private coinPop = 0;
  private hintA = 0;
  private hint: Move = 'jump';

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      tip: font(500, 12.5 * u, SANS), score: font(500, 40 * u, SERIF), unit: font(650, 13 * u, SANS), small: font(700, 12 * u, SANS),
      cardTitle: font(500, 18 * u, SERIF, true), cardSub: font(600, 12 * u, SANS), bname: font(600, 11 * u, SANS), verdict: font(500, 17 * u, SERIF, true),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    for (const f of [this.nameFit, this.nextFit, this.routeFit, this.hintFit, this.cardFit]) f.maxW = -1;
    this.tipWrap.maxW = -1;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 34): void {
    const u = this.L.u;
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(750, size * u, SANS), rise: rise * u });
    if (this.floats.length > 12) this.floats.shift();
  }

  /** A card over the sky, queued behind more important ones (rank 0 first). */
  card(title: string, sub: string, o: { dur?: number; rank?: number; color?: string } = {}): void {
    const c: Card = { title, sub, t: 0, dur: o.dur ?? 2.6, rank: o.rank ?? 1, color: o.color ?? C.ink };
    let i = this.cards.length;
    while (i > 1 && this.cards[i - 1].rank > c.rank) i--;
    this.cards.splice(i, 0, c);
    if (this.cards.length > 5) this.cards.pop();
  }

  blockCard(c: BlockCard): void { this.block = c; }
  popScore(): void { this.pop = 1; }
  popCoin(): void { this.coinPop = 1; }

  update(dt: number, sim: PoslaniecSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) this.cards.shift();
    if (this.block && (this.block.t += dt) >= this.block.dur) this.block = null;
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.coinPop = Math.max(0, this.coinPop - dt * 4);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    const h = sim.lessonHint;
    if (h) this.hint = h;
    this.hintA = approach(this.hintA, h ? 1 : 0, dt, 0.15);
  }

  draw(sim: PoslaniecSim): void {
    this.status(sim);
    this.score(sim);
    this.drawBlockCard();
    this.hintPill();
    this.drawFloats();
    this.drawCard();
  }

  // ── fitting ─────────────────────────────────────────────────────
  private fitIn(slot: Fit, text: string, maxW: number, size: number, weight: number, family: string, italic = false): number {
    if (slot.text === text && slot.maxW === maxW && slot.size === size) return slot.fit;
    const ctx = this.ctx;
    let s = size;
    ctx.font = font(weight, s, family, italic);
    while (s > size * 0.6 && ctx.measureText(text).width > maxW) {
      s -= 0.5;
      ctx.font = font(weight, s, family, italic);
    }
    Object.assign(slot, { text, maxW, size, fit: s, font: font(weight, s, family, italic) });
    return s;
  }

  private wrapTip(text: string, maxW: number): string[] {
    const w = this.tipWrap;
    if (w.text === text && w.maxW === maxW) return w.lines;
    const ctx = this.ctx;
    ctx.font = this.F.tip;
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
    }
    if (line) lines.push(line);
    Object.assign(w, { text, maxW, lines });
    return lines;
  }

  // ── the status ──────────────────────────────────────────────────
  private blockName(sim: PoslaniecSim): string {
    if (sim.phase !== 'play') return TXT.finale;
    const b = sim.block;
    return b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
  }

  private tone(sim: PoslaniecSim): string {
    if (sim.phase !== 'play') return '#9a4f2c';
    const b = sim.block;
    return b.kind === 'rest' ? '#3d5a8c' : b.kind === 'warmup' ? '#6d5a3a' : b.blind ? '#5f6b7a' : '#a45a1c';
  }

  private status(sim: PoslaniecSim): void {
    const { ctx, L, F } = this;
    const u = L.u, s = L.status;
    const x = s.x + 12 * u, w = s.w - 24 * u;
    const done = sim.phase !== 'play';
    const name = this.blockName(sim);
    const lines = !done && sim.tip ? this.wrapTip(sim.tip, w) : [];
    const nameSize = this.fitIn(this.nameFit, name, w, 21 * u, 500, SERIF);
    const nx = sim.next;
    const tele = !done && sim.toNext !== null && sim.toNext <= RULES.telegraph && nx
      ? (nx.kind === 'rest' ? TXT.nextRest : TXT.nextPush)
      : !done && sim.toNext === null && sim.block.dur - sim.blockT <= RULES.telegraph ? TXT.nextFinale : '';
    const tipN = Math.min(2, lines.length);
    const hh = 12 * u + nameSize + tipN * 15.5 * u + (done ? 6 * u : 16 * u) + (tele ? 18 * u : 0);
    ctx.save();
    ctx.fillStyle = 'rgba(247,234,210,.84)';
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, hh, 14 * u);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let y = s.y + 6 * u + nameSize;
    ctx.font = this.nameFit.font;
    ctx.fillStyle = this.tone(sim);
    ctx.fillText(name, x, y);
    ctx.font = F.tip;
    ctx.fillStyle = 'rgba(43,34,25,.86)';
    for (let i = 0; i < tipN; i++) {
      y += 15.5 * u;
      ctx.fillText(lines[i], x, y);
    }
    if (!done) {
      y += 9 * u;
      ctx.fillStyle = 'rgba(43,34,25,.14)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = this.tone(sim);
      ctx.fillRect(x, y, w * clamp(sim.blockT / sim.block.dur), 3);
      if (tele) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.t * 6);
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = nx?.kind === 'rest' ? '#3d5a8c' : '#a45a1c';
        ctx.beginPath();
        ctx.arc(x + 4, y + 13 * u, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        this.fitIn(this.nextFit, tele, w - 14, 12 * u, 650, SANS);
        ctx.font = this.nextFit.font;
        ctx.fillStyle = 'rgba(43,34,25,.9)';
        ctx.fillText(tele, x + 13, y + 17 * u);
      }
    }
    ctx.restore();
  }

  // ── the score ───────────────────────────────────────────────────
  private score(sim: PoslaniecSim): void {
    const { ctx, L, F } = this;
    const u = L.u, right = L.scoreX, top = L.scoreY;
    const n = Math.round(this.shown);
    if (n !== this.scoreN) {
      this.scoreN = n;
      this.scoreText = grouped(n);
    }
    ctx.save();
    ctx.font = F.score;
    const bw = Math.max(L.scoreW, ctx.measureText(this.scoreText).width + 44 * u);
    const bh = 92 * u;
    ctx.fillStyle = 'rgba(247,234,210,.84)';
    ctx.beginPath();
    ctx.roundRect(right - bw, top, bw, bh, 14 * u);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.unit;
    ctx.fillStyle = 'rgba(43,34,25,.66)';
    ctx.fillText('m', right - 12 * u, top + 40 * u);
    const p = this.pop > 0 ? 1 + 0.12 * ease.outElastic(1 - this.pop) * this.pop : 1;
    ctx.save();
    ctx.translate(right - 26 * u, top + 40 * u);
    ctx.scale(p, p);
    ctx.font = F.score;
    ctx.fillStyle = C.ink;
    ctx.fillText(this.scoreText, 0, 0);
    ctx.restore();
    // the drachmas and the combo
    const y2 = top + 60 * u;
    ctx.font = F.small;
    ctx.fillStyle = 'rgba(43,34,25,.85)';
    const dt = `+${sim.drachmaGain}`;
    ctx.fillText(dt, right - 12 * u, y2);
    const dw = ctx.measureText(dt).width;
    paintCoin(ctx, right - 22 * u - dw, y2 - 4 * u, 6.5 * u * (1 + 0.35 * this.coinPop), sim.t * 3);
    if (sim.combo >= 5) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7b6a8a';
      ctx.fillText(`×${sim.combo}`, right - bw + 12 * u, y2);
    }
    // the road to the next city
    const r = sim.route;
    const route = t('hud.route', { city: CITIES[r.next].name, left: road(r.leg - r.into) });
    this.fitIn(this.routeFit, route, bw - 24 * u, 11 * u, 650, SANS);
    ctx.textAlign = 'left';
    ctx.font = this.routeFit.font;
    ctx.fillStyle = 'rgba(43,34,25,.62)';
    ctx.fillText(route, right - bw + 12 * u, top + 80 * u);
    const k = clamp(r.into / r.leg);
    ctx.fillStyle = 'rgba(43,34,25,.12)';
    ctx.fillRect(right - bw + 12 * u, top + 84 * u, bw - 24 * u, 2);
    ctx.fillStyle = '#a45a1c';
    ctx.fillRect(right - bw + 12 * u, top + 84 * u, (bw - 24 * u) * k, 2);
    ctx.restore();
  }

  // ── the block card ──────────────────────────────────────────────
  private drawBlockCard(): void {
    const c = this.block;
    if (!c) return;
    const { ctx, L, F } = this;
    const u = L.u, R = L.blockCard;
    const k = c.t < 0.35 ? ease.outCubic(c.t / 0.35) : c.t > c.dur - 0.4 ? clamp((c.dur - c.t) / 0.4) : 1;
    const x = R.x - (1 - k) * (R.w + 24), y = R.y;
    ctx.save();
    ctx.globalAlpha = clamp(k * 1.2);
    // parchment with a darker edge and a slight tilt
    ctx.translate(x + R.w / 2, y + R.h / 2);
    ctx.rotate(-0.012);
    ctx.translate(-R.w / 2, -R.h / 2);
    ctx.fillStyle = 'rgba(60,40,20,.25)';
    ctx.beginPath();
    ctx.roundRect(2, 3, R.w, R.h, 8 * u);
    ctx.fill();
    ctx.fillStyle = C.parchment;
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, R.w, R.h, 8 * u);
    ctx.fill();
    ctx.stroke();
    const pad = 10 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.bname;
    ctx.fillStyle = 'rgba(43,34,25,.65)';
    ctx.fillText(c.name.toLocaleUpperCase(), pad, pad + 9 * u, R.w - 2 * pad);
    ctx.font = F.verdict;
    ctx.fillStyle = c.tone;
    ctx.fillText(c.verdict, pad, pad + 29 * u, R.w - 2 * pad - (c.pay ? 40 * u : 0));
    if (c.pay) {
      ctx.textAlign = 'right';
      ctx.font = F.small;
      ctx.fillStyle = C.ink;
      ctx.fillText(`+${c.pay}`, R.w - pad, pad + 28 * u);
      const pw = ctx.measureText(`+${c.pay}`).width;
      paintCoin(ctx, R.w - pad - pw - 9 * u, pad + 24 * u, 6 * u, 0.4);
    }
    // the block's own curve; a blind block's is revealed as the card comes in
    const shown = c.blind ? clamp((c.t - 0.3) / 1.2) : 1;
    paintMiniCurve(ctx, c.samples, pad, pad + 38 * u, R.w - 2 * pad, R.h - pad * 2 - 40 * u, shown, u);
    if (c.blind && shown < 1) {
      ctx.globalAlpha = 1 - shown;
      ctx.fillStyle = 'rgba(232,232,240,.9)';
      ctx.fillRect(pad, pad + 36 * u, R.w - 2 * pad, R.h - pad * 2 - 36 * u);
    }
    ctx.restore();
  }

  // ── the warm-up's lesson ────────────────────────────────────────
  private hintPill(): void {
    if (this.hintA < 0.02) return;
    const { ctx, L } = this;
    const u = L.u;
    const text = `${ARROW[this.hint]}  ${HINT[this.hint]}`;
    const size = this.fitIn(this.hintFit, text, L.w - 60 * u, 15 * u, 750, SANS);
    ctx.save();
    ctx.font = this.hintFit.font;
    const pw = ctx.measureText(text).width + 30 * u, ph = size + 16 * u;
    const cx = L.w / 2, cy = L.hintY - ph / 2;
    ctx.globalAlpha = this.hintA;
    ctx.fillStyle = 'rgba(43,34,25,.86)';
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy + 0.5);
    ctx.restore();
  }

  // ── floats and cards ────────────────────────────────────────────
  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      ctx.font = f.font;
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(30,20,30,.45)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const { ctx, L, F } = this;
    const u = L.u;
    const k = c.t < 0.3 ? ease.outBack(c.t / 0.3) : 1;
    const fade = c.t > c.dur - 0.35 ? clamp((c.dur - c.t) / 0.35) : 1;
    const maxW = Math.min(L.w - 40, 420 * u);
    const size = this.fitIn(this.cardFit, c.title, maxW - 32 * u, 18 * u, 500, SERIF, true);
    ctx.save();
    ctx.font = this.cardFit.font;
    const tw = ctx.measureText(c.title).width;
    ctx.font = F.cardSub;
    const sw = c.sub ? Math.min(maxW - 32 * u, ctx.measureText(c.sub).width) : 0;
    const w = Math.min(maxW, Math.max(tw, sw) + 36 * u), h = size + (c.sub ? 34 : 22) * u;
    const cx = L.w / 2, cy = L.cardY;
    ctx.globalAlpha = fade;
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(60,40,20,.25)';
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, 12 * u);
    ctx.fill();
    ctx.fillStyle = C.parchment;
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 12 * u);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.cardFit.font;
    ctx.fillStyle = c.color;
    ctx.fillText(c.title, 0, c.sub ? -8 * u : 0);
    if (c.sub) {
      ctx.font = F.cardSub;
      ctx.fillStyle = 'rgba(43,34,25,.7)';
      ctx.fillText(c.sub, 0, 13 * u, maxW - 32 * u);
    }
    ctx.restore();
  }
}
