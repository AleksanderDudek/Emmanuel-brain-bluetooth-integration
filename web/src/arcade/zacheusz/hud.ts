/**
 * Zacheusz's HUD on the play canvas: the status on a paper wash (the block's name, a strategy to
 * try, the block's progress and the telegraph), the denarii counting up live with their bent unit,
 * the course's name, its progress to the sycamore and its five special slots, the figs in the
 * shade; the block card after each block (its own curve in miniature, its name, its verdict in
 * craft words — and for the crowd the reveal of what it hid), never in the way of a tap; the cards
 * over the sky (a household restored, a mission, a course, the sycamore), the warm-up's hint pill
 * and the words floating over the street.  Every string is fitted to its room.
 */
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, drawTrace, type SignalTrace } from '../kit/trace';
import type { Tier } from './content';
import { grouped, t, unit } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintCoin } from './paint';
import { RULES, type Block, type ZacheuszSim } from './sim';

interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

export type CardIcon = 'home' | 'mission' | 'course' | 'tree' | 'coin' | 'view' | 'none';
interface Card { title: string; sub: string; t: number; dur: number; rank: number; icon: CardIcon; color: string; tier: Tier; lines: string[]; subLines: string[]; w: number }

/** The block card: the block's span in play time, its name, its verdict, a second line. */
interface BlockCard { block: Block; t0: number; t1: number; verdict: string; sub: string; good: boolean | null; t: number; blind: boolean }

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'),
  nextPush: t('next.push'), nextRest: t('next.rest'), nextFinale: t('next.finale'), hint: t('hint.tap'),
  daily: t('hud.daily'),
};

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private F = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly nextFit = fitSlot();
  private readonly courseFit = fitSlot();
  private readonly hintFit = fitSlot();
  private readonly bcFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, lines: [] as string[] };
  private shown = 0;
  private scoreN = -1;
  private scoreText = '0';
  private unitText = unit(0);
  private pop = 0;
  private hintA = 0;
  private bc: BlockCard | null = null;
  private slotPop = [0, 0, 0, 0, 0];

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      tip: font(500, 13 * u, SANS), score: font(500, 40 * u, SERIF), unit: font(650, 13 * u, SANS), small: font(700, 11.5 * u, SANS),
      cardTitle: font(500, 19 * u, SERIF, true), cardSub: font(600, 12.5 * u, SANS), bcName: font(700, 11 * u, SANS),
      bcVerdict: font(500, 17 * u, SERIF, true), bcSub: font(600, 11 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.nameFit.maxW = this.nextFit.maxW = this.courseFit.maxW = this.hintFit.maxW = this.bcFit.maxW = -1;
    this.tipWrap.maxW = -1;
    for (const c of this.cards) c.w = -1;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 34): void {
    const u = this.L.u;
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(750, size * u, SANS), rise: rise * u });
    if (this.floats.length > 12) this.floats.shift();
  }

  card(title: string, sub: string, o: { dur?: number; rank?: number; icon?: CardIcon; color?: string; tier?: Tier } = {}): void {
    const c: Card = {
      title, sub, t: 0, dur: o.dur ?? 2.6, rank: o.rank ?? 1, icon: o.icon ?? 'none', color: o.color ?? C.ink, tier: o.tier ?? 'silver', lines: [], subLines: [], w: -1,
    };
    let i = this.cards.length;
    while (i > 1 && this.cards[i - 1].rank > c.rank) i--;
    this.cards.splice(i, 0, c);
    if (this.cards.length > 6) this.cards.pop();
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.4, head.t) + 0.3);
  }

  /** The block card after a judged block. */
  blockCard(block: Block, t0: number, t1: number, verdict: boolean | null, share: number, need: number, revealSec: number | null): void {
    const kind = block.kind;
    const word = verdict === null ? t('card.none') : kind === 'push' ? t(verdict ? 'card.push.pass' : 'card.push.fail') : t(verdict ? 'card.rest.pass' : 'card.rest.fail');
    let sub = '';
    if (revealSec !== null) sub = t('blind.reveal', { n: revealSec });
    else if (verdict === false && share >= need - 0.15) sub = t('card.near', { share: Math.round(share * 100), need: Math.round(need * 100) });
    this.bc = { block, t0, t1, verdict: word, sub, good: verdict, t: 0, blind: block.kind === 'push' && block.blind };
  }

  popScore(): void { this.pop = 1; }
  popSlot(i: number): void { if (i >= 0 && i < 5) this.slotPop[i] = 1; }

  update(dt: number, sim: ZacheuszSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.2);
    }
    if (this.bc && (this.bc.t += dt) >= RULES.cardSec) this.bc = null;
    this.pop = Math.max(0, this.pop - dt * 2.4);
    for (let i = 0; i < 5; i++) this.slotPop[i] = Math.max(0, this.slotPop[i] - dt * 1.6);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.1);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
  }

  draw(sim: ZacheuszSim): void {
    this.status(sim);
    this.score(sim);
    this.drawBlockCard(sim);
    this.hintPill();
    this.drawFloats();
    this.drawCard();
  }

  // ── the status ──────────────────────────────────────────────────
  private blockName(sim: ZacheuszSim): string {
    if (sim.phase !== 'play') return TXT.finale;
    const b = sim.block;
    return b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
  }

  private tone(sim: ZacheuszSim): string {
    if (sim.phase !== 'play') return C.madder;
    const b = sim.block;
    return b.kind === 'rest' ? C.teal2 : b.kind === 'warmup' ? '#6d5a3a' : b.blind ? '#6a5f74' : C.indigo;
  }

  private status(sim: ZacheuszSim): void {
    const { ctx, L, F } = this;
    const u = L.u, s = L.status;
    const x = s.x + 12 * u, w = s.w - 24 * u;
    const done = sim.phase !== 'play';
    const name = this.blockName(sim);
    const lines = !done && sim.tip ? this.wrapTip(sim.tip, w) : [];
    const nameSize = this.fitIn(this.nameFit, name, w, 23 * u, 500, SERIF);
    const nx = sim.next;
    const tele = !done && sim.toNext !== null && sim.toNext <= RULES.telegraph && nx
      ? (nx.kind === 'rest' ? TXT.nextRest : TXT.nextPush)
      : !done && sim.toNext === null && sim.block.dur - sim.blockT <= RULES.telegraph ? TXT.nextFinale : '';
    const tipN = Math.min(2, lines.length);
    const hh = 12 * u + nameSize + tipN * 16 * u + (done ? 6 * u : 16 * u) + (tele ? 18 * u : 0);
    ctx.save();
    ctx.fillStyle = 'rgba(251,241,220,.84)';
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
    ctx.fillStyle = 'rgba(42,30,23,.86)';
    for (let i = 0; i < tipN; i++) {
      y += 16 * u;
      ctx.fillText(lines[i], x, y);
    }
    if (!done) {
      y += 9 * u;
      const prog = clamp(sim.blockT / sim.block.dur);
      ctx.fillStyle = 'rgba(42,30,23,.14)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = this.tone(sim);
      ctx.fillRect(x, y, w * prog, 3);
      if (tele) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.t * 6);
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = nx?.kind === 'rest' ? C.teal : C.indigo;
        ctx.beginPath();
        ctx.arc(x + 4, y + 13 * u, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        this.fitIn(this.nextFit, tele, w - 14, 12 * u, 650, SANS);
        ctx.font = this.nextFit.font;
        ctx.fillStyle = 'rgba(42,30,23,.9)';
        ctx.fillText(tele, x + 13, y + 17 * u);
      }
    }
    ctx.restore();
  }

  // ── the denarii and the course ──────────────────────────────────
  private score(sim: ZacheuszSim): void {
    const { ctx, L, F } = this;
    const u = L.u;
    const right = L.scoreX, top = L.scoreY;
    const n = Math.round(this.shown);
    if (n !== this.scoreN) {
      this.scoreN = n;
      this.scoreText = grouped(n);
      this.unitText = unit(n);
    }
    ctx.save();
    ctx.font = F.score;
    const numW = ctx.measureText(this.scoreText).width;
    ctx.font = F.unit;
    const unitW = ctx.measureText(this.unitText).width;
    const bw = Math.max(numW + unitW + 30 * u, 132 * u);
    const bh = 92 * u;
    ctx.fillStyle = 'rgba(251,241,220,.84)';
    ctx.beginPath();
    ctx.roundRect(right - bw, top, bw, bh, 14 * u);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.unit;
    ctx.fillStyle = 'rgba(42,30,23,.66)';
    ctx.fillText(this.unitText, right - 12 * u, top + 40 * u);
    const p = this.pop > 0 ? 1 + 0.14 * ease.outElastic(1 - this.pop) * this.pop : 1;
    ctx.save();
    ctx.translate(right - 18 * u - unitW, top + 40 * u);
    ctx.scale(p, p);
    ctx.font = F.score;
    ctx.fillStyle = C.ink;
    ctx.fillText(this.scoreText, 0, 0);
    ctx.restore();
    // the course: its name (and the figs of the shade), its five specials and its way to the sycamore
    const x0 = right - bw + 12 * u, x1 = right - 12 * u;
    const r = sim.running;
    const label = r ? (r.course.index < 0 ? TXT.daily : t('hud.course', { n: r.course.index + 1 })) : sim.resting ? TXT.rest : '';
    const showFigs = sim.figs > 0 || sim.resting;
    const figsW = showFigs ? 30 * u : 0;
    if (label) {
      this.fitIn(this.courseFit, label, x1 - x0 - figsW, 11.5 * u, 700, SANS);
      ctx.font = this.courseFit.font;
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(42,30,23,.78)';
      ctx.fillText(label, x0, top + 59 * u);
    }
    if (showFigs) {
      ctx.font = F.small;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(42,30,23,.8)';
      const ft = String(sim.figs);
      ctx.fillText(ft, x1, top + 59 * u);
      ctx.fillStyle = C.figRipe;
      ctx.beginPath();
      ctx.ellipse(x1 - ctx.measureText(ft).width - 7 * u, top + 55 * u, 4 * u, 5 * u, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (r) {
      const sy = top + 75 * u;
      for (let i = 0; i < RULES.specials; i++) {
        const got = r.got.has(i);
        const pp = this.slotPop[i];
        paintCoin(ctx, x0 + 5 * u + i * 11 * u, sy - pp * 4 * u, (4.6 + pp * 2.2) * u, sim.tier, 0, !got);
      }
      const bx = x0 + 60 * u;
      if (x1 - bx > 16 * u) {
        ctx.fillStyle = 'rgba(42,30,23,.14)';
        ctx.fillRect(bx, sy - 2 * u, x1 - bx - 6 * u, 4 * u);
        ctx.fillStyle = C.saffron;
        ctx.fillRect(bx, sy - 2 * u, (x1 - bx - 6 * u) * sim.courseProgress, 4 * u);
        ctx.fillStyle = C.leaf;
        ctx.beginPath();
        ctx.arc(x1 - 4 * u, sy, 4.5 * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── the block card ──────────────────────────────────────────────
  private drawBlockCard(sim: ZacheuszSim): void {
    const c = this.bc;
    if (!c) return;
    const { ctx, L, F } = this;
    const u = L.u, b = L.block;
    const a = Math.min(1, c.t / 0.25, (RULES.cardSec - c.t) / 0.4);
    if (a <= 0) return;
    const slide = (1 - ease.outCubic(Math.min(1, c.t / 0.3))) * -10 * u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, slide);
    ctx.fillStyle = 'rgba(42,30,23,.18)';
    ctx.beginPath();
    ctx.roundRect(b.x + 2, b.y + 3, b.w, b.h, 12 * u);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = 'rgba(42,30,23,.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 12 * u);
    ctx.fill();
    ctx.stroke();
    // the mini curve: the block's own span of the trace (the crowd's reveal fades in)
    const kind = c.block.kind;
    const box = { x: b.x + 10 * u, y: b.y + 40 * u, w: b.w - 20 * u, h: b.h - 48 * u };
    const lay = sim.trace.layout(box, c.t1, { span: Math.max(4, c.t1 - c.t0) });
    // the crowd's block: the card itself lifts the veil from what it hid, over its first second
    const lift = c.blind ? ease.inOutSine(clamp((c.t - 0.3) / 1.1)) : 1;
    if (c.blind) {
      for (const p of lay.points) p.shown = lift;
      for (const band of lay.bands) band.veiled = false;
    }
    ctx.fillStyle = kind === 'rest' ? 'rgba(79,163,154,.12)' : 'rgba(52,71,126,.07)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    drawTrace(ctx, lay, {
      line: kind === 'rest' ? C.teal2 : '#7b6a58', above: C.gold2, lineWidth: 2, aboveFill: 'rgba(242,193,78,.35)',
      threshold: 'rgba(42,30,23,.4)', gap: 'rgba(42,30,23,.5)', veil: 'rgba(122,100,130,.55)',
    });
    if (c.blind && lift < 1) {
      ctx.fillStyle = `rgba(122,100,130,${0.6 * (1 - lift)})`;
      ctx.fillRect(box.x, box.y, box.w * (1 - lift), box.h);
    }
    // the name and the verdict
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.bcName;
    ctx.fillStyle = kind === 'rest' ? C.teal2 : c.blind ? '#6a5f74' : C.indigo;
    const name = c.blind ? t('card.blind') : kind === 'rest' ? TXT.rest : TXT.push;
    ctx.fillText(name.toLocaleUpperCase(), b.x + 10 * u, b.y + 15 * u);
    this.fitIn(this.bcFit, c.verdict, b.w - 20 * u, 17 * u, 500, SERIF, true);
    ctx.font = this.bcFit.font;
    ctx.fillStyle = c.good ? (kind === 'rest' ? C.figRipe : C.gold2) : 'rgba(42,30,23,.8)';
    ctx.fillText(c.verdict, b.x + 10 * u, b.y + 34 * u);
    if (c.sub) {
      ctx.font = F.bcSub;
      ctx.fillStyle = 'rgba(42,30,23,.7)';
      ctx.textAlign = 'right';
      ctx.fillText(c.sub, b.x + b.w - 10 * u, b.y + 15 * u);
    }
    ctx.restore();
  }

  // ── the warm-up's hint ──────────────────────────────────────────
  private hintPill(): void {
    if (this.hintA < 0.02) return;
    const { ctx, L } = this;
    const u = L.u;
    const size = this.fitIn(this.hintFit, TXT.hint, L.w - 60 * u, 13 * u, 650, SANS);
    ctx.save();
    ctx.font = this.hintFit.font;
    const tw = ctx.measureText(TXT.hint).width;
    const pw = tw + 26 * u, ph = size + 14 * u;
    const cx = L.w / 2, cy = L.h - 66 - 36 * u - ph / 2;
    ctx.globalAlpha = this.hintA;
    ctx.fillStyle = 'rgba(42,30,23,.86)';
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.hint, cx, cy + 0.5);
    ctx.restore();
  }

  get hintAlpha(): number { return this.hintA; }

  private drawFloats(): void {
    const { ctx, L } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.16 ? ease.outBack(k / 0.16) : 1;
      const x = clamp(f.x, 60, L.w - 60), y = f.y - f.rise * ease.outCubic(k);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.font = f.font;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(251,241,220,.92)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── the cards over the sky ──────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const { ctx, L, F } = this;
    const u = L.u;
    const a = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    const maxW = Math.min(L.w - 32, 400 * u);
    const iconW = c.icon === 'none' ? 0 : 36 * u;
    if (c.w !== maxW) {
      c.w = maxW;
      c.lines = this.wrapLines(c.title, maxW - 32 * u - iconW, F.cardTitle);
      c.subLines = c.sub ? this.wrapLines(c.sub, maxW - 32 * u - iconW, F.cardSub) : [];
    }
    const lh = 23 * u, sh = 17 * u;
    const ch = 18 * u + c.lines.length * lh + c.subLines.length * sh + 4 * u;
    ctx.save();
    let tw = 0;
    ctx.font = F.cardTitle;
    for (const l of c.lines) tw = Math.max(tw, ctx.measureText(l).width);
    ctx.font = F.cardSub;
    for (const l of c.subLines) tw = Math.max(tw, ctx.measureText(l).width);
    const cw = Math.min(maxW, tw + 32 * u + iconW);
    const x = L.w / 2 - cw / 2, y = L.cardY - ch / 2 + (1 - ease.outCubic(Math.min(1, c.t / 0.35))) * 8;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,30,23,.22)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, cw, ch, 12);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = 'rgba(42,30,23,.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.stroke();
    if (c.icon !== 'none') this.icon(c, x + 14 * u + iconW / 2 - 4 * u, y + ch / 2, u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let yy = y + 10 * u;
    ctx.font = F.cardTitle;
    ctx.fillStyle = c.color;
    for (const l of c.lines) {
      yy += lh;
      ctx.fillText(l, x + 16 * u + iconW, yy - 6 * u);
    }
    ctx.font = F.cardSub;
    ctx.fillStyle = 'rgba(42,30,23,.72)';
    for (const l of c.subLines) {
      yy += sh;
      ctx.fillText(l, x + 16 * u + iconW, yy - 4 * u);
    }
    ctx.restore();
  }

  private icon(c: Card, x: number, y: number, u: number): void {
    const { ctx } = this;
    switch (c.icon) {
      case 'coin': paintCoin(ctx, x, y, 12 * u, c.tier, 0.3); break;
      case 'home':
        ctx.fillStyle = C.brick;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.2;
        ctx.fillRect(x - 11 * u, y - 7 * u, 22 * u, 17 * u);
        ctx.strokeRect(x - 11 * u, y - 7 * u, 22 * u, 17 * u);
        ctx.fillStyle = C.parapet;
        ctx.fillRect(x - 13 * u, y - 10 * u, 26 * u, 4 * u);
        ctx.fillStyle = C.doorway;
        ctx.fillRect(x - 3 * u, y + 1 * u, 6 * u, 9 * u);
        break;
      case 'tree':
        ctx.fillStyle = '#57893c';
        ctx.beginPath();
        ctx.ellipse(x, y - 4 * u, 13 * u, 9 * u, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.trunk;
        ctx.fillRect(x - 2.5 * u, y + 2 * u, 5 * u, 10 * u);
        break;
      case 'view':
        ctx.strokeStyle = C.gold2;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x - 12 * u, y + 6 * u);
        ctx.lineTo(x + 12 * u, y - 6 * u);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(236,214,170,.9)';
        ctx.beginPath();
        ctx.arc(x + 12 * u, y - 7 * u, 6 * u, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'mission':
      case 'course':
        ctx.fillStyle = '#d8b57a';
        ctx.fillRect(x - 10 * u, y - 12 * u, 20 * u, 24 * u);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(x - 10 * u, y - 12 * u, 20 * u, 24 * u);
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          ctx.moveTo(x - 6 * u, y - 6 * u + i * 5 * u);
          ctx.lineTo(x + 6 * u, y - 6 * u + i * 5 * u);
        }
        ctx.stroke();
        break;
      default: break;
    }
  }

  // ── text helpers ────────────────────────────────────────────────
  fitIn(slot: Fit, text: string, maxW: number, size: number, weight: number, family: string, italic = false): number {
    if (slot.text !== text || slot.maxW !== maxW || slot.size !== size) {
      this.ctx.font = font(weight, size, family, italic);
      const tw = this.ctx.measureText(text).width;
      slot.text = text;
      slot.maxW = maxW;
      slot.size = size;
      slot.fit = tw <= maxW ? size : Math.max(9, Math.floor(((size * maxW) / tw) * 10) / 10);
      slot.font = font(weight, slot.fit, family, italic);
    }
    return slot.fit;
  }

  private wrapTip(text: string, maxW: number): string[] {
    const k = this.tipWrap;
    if (k.text !== text || k.maxW !== maxW) {
      k.text = text;
      k.maxW = maxW;
      k.lines = this.wrapLines(text, maxW, this.F.tip);
      if (k.lines.length > 2) {
        let last = k.lines.slice(1).join(' ');
        this.ctx.font = this.F.tip;
        while (last.length > 4 && this.ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        k.lines = [k.lines[0], `${last.trimEnd()}…`];
      }
    }
    return k.lines;
  }

  private wrapLines(text: string, maxW: number, f: string): string[] {
    const { ctx } = this;
    ctx.font = f;
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
}

/** The lag bracket's label ("≈ 5 s") for the band in use. */
export const lagLabel = (eeg: boolean): string => t('lag', { n: LAG_SEC[eeg ? 'eeg' : 'fnirs'] });

export type { SignalTrace };
