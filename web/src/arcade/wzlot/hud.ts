/**
 * Wzlot's HUD on the play canvas: the status on a paper wash (the block's name, a strategy to try,
 * the block's progress and the telegraph), the metres flown counting up live with the soaring
 * chain and the plumage's feathers under them, the cards that take turns over the sky (a feather,
 * a vista, a page of the flight log, new plumage), the hint pill of the warm-up, and the words
 * floating over the hills.  Every string is fitted to its room so it reads on a 390 px phone in
 * German and Swedish; wrapped lines are made again only when their text or room changes.
 */
import { approach, clamp, ease } from '../kit/juice';
import { TIPS, type Land, type Light } from './content';
import { grouped, t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintVista } from './paint';
import { RULES, type WzlotSim } from './sim';

interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

export type CardIcon = 'feather' | 'vista' | 'log' | 'stage' | 'thermal' | 'none';
interface Card {
  title: string; sub: string; t: number; dur: number; rank: number; icon: CardIcon; color: string;
  vista: { land: Land; light: Light } | null; lines: string[]; subLines: string[]; w: number;
}

const TXT = {
  warmup: t('block.warmup'), lekcja: t('block.lekcja'), blind: t('block.blind'), wzn: t('block.wzn'), stretch: t('block.stretch'),
  finale: t('block.finale'), nextLekcja: t('next.lekcja'), nextStretch: t('next.stretch'), nextWzn: t('next.wzn'), nextFinale: t('next.finale'),
  hint: t('hint.hold'), unit: 'm',
};

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private F = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly nextFit = fitSlot();
  private readonly chainFit = fitSlot();
  private readonly hintFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, lines: [] as string[] };
  private shown = 0;
  private scoreN = -1;
  private scoreText = '0';
  private pop = 0;
  private featherPop = 0;
  private hintA = 0;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      tip: font(500, 13 * u, SANS), next: font(650, 12 * u, SANS), score: font(500, 42 * u, SERIF), unit: font(650, 13 * u, SANS),
      chain: font(700, 12 * u, SANS), cardTitle: font(500, 19 * u, SERIF, true), cardSub: font(600, 12.5 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.nameFit.maxW = this.nextFit.maxW = this.chainFit.maxW = this.hintFit.maxW = -1;
    this.tipWrap.maxW = -1;
    for (const c of this.cards) c.w = -1;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.2, rise = 34): void {
    const u = this.L.u;
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(750, size * u, SANS), rise: rise * u });
    if (this.floats.length > 10) this.floats.shift();
  }

  /** A card over the sky, queued behind more important ones (rank 0 first). */
  card(title: string, sub: string, o: { dur?: number; rank?: number; icon?: CardIcon; color?: string; vista?: { land: Land; light: Light } } = {}): void {
    const c: Card = {
      title, sub, t: 0, dur: o.dur ?? 2.6, rank: o.rank ?? 1, icon: o.icon ?? 'none', color: o.color ?? C.ink, vista: o.vista ?? null, lines: [], subLines: [], w: -1,
    };
    let i = this.cards.length;
    while (i > 1 && this.cards[i - 1].rank > c.rank) i--;
    this.cards.splice(i, 0, c);
    if (this.cards.length > 6) this.cards.pop();
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.4, head.t) + 0.3);
  }

  clearCards(): void { this.cards.length = 0; }
  popScore(): void { this.pop = 1; }
  popFeather(): void { this.featherPop = 1; }

  update(dt: number, sim: WzlotSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.2);
    }
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.featherPop = Math.max(0, this.featherPop - dt * 1.5);
    // the metres count up quickly to the score: it accrues live
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.12);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
  }

  draw(sim: WzlotSim): void {
    this.status(sim);
    this.score(sim);
    this.hintPill();
    this.drawFloats();
    this.drawCard();
  }

  // ── the status ──────────────────────────────────────────────────
  private blockName(sim: WzlotSim): string {
    if (sim.phase !== 'play') return TXT.finale;
    const b = sim.block;
    if (b.kind === 'warmup') return TXT.warmup;
    if (b.kind === 'wzn') return TXT.wzn;
    return b.blind ? TXT.blind : b.stretch ? TXT.stretch : TXT.lekcja;
  }

  private tone(sim: WzlotSim): string {
    if (sim.phase !== 'play') return '#9a4f2c';
    const b = sim.block;
    return b.kind === 'wzn' ? '#b5652f' : b.kind === 'warmup' ? '#6d5a3a' : b.blind ? '#5f6b7a' : '#7a4a22';
  }

  private status(sim: WzlotSim): void {
    const { ctx, L, F } = this;
    const u = L.u, s = L.status;
    const x = s.x + 12 * u, w = s.w - 24 * u;
    const done = sim.phase !== 'play';
    const name = this.blockName(sim);
    const tip = done ? '' : sim.lapse === 'lapse' && sim.sighted ? TIPS.lapse : sim.tip;
    const lines = tip ? this.wrapTip(tip, w) : [];
    const nameSize = this.fitIn(this.nameFit, name, w, 23 * u, 500, SERIF);
    const nx = sim.next;
    const tele = !done && sim.toNext !== null && sim.toNext <= RULES.telegraph && nx
      ? (nx.kind === 'wzn' ? TXT.nextWzn : nx.stretch ? TXT.nextStretch : TXT.nextLekcja)
      : !done && sim.toNext === null && sim.block.dur - sim.blockT <= RULES.telegraph ? TXT.nextFinale : '';
    const tipN = Math.min(2, lines.length);
    const hh = 12 * u + nameSize + tipN * 16 * u + (done ? 6 * u : 16 * u) + (tele ? 18 * u : 0);
    ctx.save();
    // the paper wash keeps the text readable over any sky
    ctx.fillStyle = 'rgba(251,243,228,.78)';
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
      y += 16 * u;
      ctx.fillText(lines[i], x, y);
    }
    if (!done) {
      y += 9 * u;
      const prog = clamp(sim.blockT / sim.block.dur);
      ctx.fillStyle = 'rgba(43,34,25,.14)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = this.tone(sim);
      ctx.fillRect(x, y, w * prog, 3);
      if (tele) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.t * 6);
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = nx?.kind === 'wzn' ? '#d0782e' : '#7a4a22';
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
  private score(sim: WzlotSim): void {
    const { ctx, L, F } = this;
    const u = L.u;
    const right = L.scoreX, top = L.scoreY;
    const n = Math.round(this.shown);
    if (n !== this.scoreN) {
      this.scoreN = n;
      this.scoreText = grouped(n);
    }
    ctx.save();
    ctx.font = F.score;
    const sw = Math.max(ctx.measureText(this.scoreText).width, 60 * u) + 44 * u;
    const chain = sim.soaring ? t('hud.soar', { n: sim.chain }) : sim.chain > 0 ? t('hud.chain', { n: sim.chain }) : '';
    const bw = Math.max(sw, 112 * u);
    ctx.fillStyle = 'rgba(251,243,228,.78)';
    ctx.beginPath();
    ctx.roundRect(right - bw, top, bw, 82 * u, 14 * u);
    ctx.fill();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    // the unit, then the number counting up (a pop on a new record moment)
    ctx.font = F.unit;
    ctx.fillStyle = 'rgba(43,34,25,.66)';
    ctx.fillText(TXT.unit, right - 12 * u, top + 42 * u);
    const p = this.pop > 0 ? 1 + 0.12 * ease.outElastic(1 - this.pop) * this.pop : 1;
    ctx.save();
    ctx.translate(right - 28 * u, top + 42 * u);
    ctx.scale(p, p);
    ctx.font = F.score;
    ctx.fillStyle = C.ink;
    ctx.fillText(this.scoreText, 0, 0);
    ctx.restore();
    // the chain or the soaring, and the plumage's feathers
    const y2 = top + 62 * u;
    if (chain) {
      this.fitIn(this.chainFit, chain, bw - 50 * u, 12 * u, 700, SANS);
      ctx.font = this.chainFit.font;
      ctx.fillStyle = sim.soaring ? '#b6781e' : 'rgba(43,34,25,.78)';
      ctx.textAlign = 'left';
      ctx.fillText(chain, right - bw + 12 * u, y2 + 8 * u);
    }
    const fp = this.featherPop > 0 ? 1 + 0.4 * Math.sin(this.featherPop * Math.PI) : 1;
    ctx.textAlign = 'right';
    ctx.font = F.chain;
    ctx.fillStyle = 'rgba(43,34,25,.78)';
    const ft = String(sim.p.feathers);
    ctx.fillText(ft, right - 12 * u, y2 + 8 * u);
    const fw = ctx.measureText(ft).width;
    featherIcon(ctx, right - 20 * u - fw, y2 + 3 * u, 9 * u * fp, -0.7);
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
    ctx.fillStyle = 'rgba(43,34,25,.86)';
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
      const x = clamp(f.x, 70, L.w - 70), y = f.y - f.rise * ease.outCubic(k);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.font = f.font;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(251,243,228,.9)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const { ctx, L, F } = this;
    const u = L.u;
    const a = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    const maxW = Math.min(L.w - 32, 400 * u);
    const iconW = c.vista ? 70 * u : c.icon === 'none' ? 0 : 34 * u;
    if (c.w !== maxW) {
      c.w = maxW;
      c.lines = this.wrapLines(c.title, maxW - 32 * u - iconW, F.cardTitle);
      c.subLines = c.sub ? this.wrapLines(c.sub, maxW - 32 * u - iconW, F.cardSub) : [];
    }
    const lh = 23 * u, sh = 17 * u;
    const ch = Math.max(18 * u + c.lines.length * lh + c.subLines.length * sh + 4 * u, c.vista ? 62 * u : 0);
    ctx.save();
    let tw = 0;
    ctx.font = F.cardTitle;
    for (const l of c.lines) tw = Math.max(tw, ctx.measureText(l).width);
    ctx.font = F.cardSub;
    for (const l of c.subLines) tw = Math.max(tw, ctx.measureText(l).width);
    const cw = Math.min(maxW, tw + 32 * u + iconW);
    const x = L.w / 2 - cw / 2, y = L.cardY - ch / 2 + (1 - ease.outCubic(Math.min(1, c.t / 0.35))) * 8;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(43,34,25,.22)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, cw, ch, 12);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = 'rgba(43,34,25,.6)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.stroke();
    if (c.vista) {
      const vw = 56 * u, vh = ch - 14 * u;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 9 * u, y + 7 * u, vw, vh, 8);
      ctx.clip();
      paintVista(ctx, c.vista.land, c.vista.light, x + 9 * u, y + 7 * u, vw, vh);
      ctx.restore();
    } else if (c.icon !== 'none') this.icon(c.icon, x + 16 * u + iconW / 2 - 4 * u, y + ch / 2, u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let yy = y + 10 * u + (ch - (18 * u + c.lines.length * lh + c.subLines.length * sh + 4 * u)) / 2;
    ctx.font = F.cardTitle;
    ctx.fillStyle = c.color;
    for (const l of c.lines) {
      yy += lh;
      ctx.fillText(l, x + 16 * u + iconW, yy - 6 * u);
    }
    ctx.font = F.cardSub;
    ctx.fillStyle = 'rgba(43,34,25,.72)';
    for (const l of c.subLines) {
      yy += sh;
      ctx.fillText(l, x + 16 * u + iconW, yy - 4 * u);
    }
    ctx.restore();
  }

  private icon(icon: CardIcon, x: number, y: number, u: number): void {
    const { ctx } = this;
    if (icon === 'feather' || icon === 'stage') {
      featherIcon(ctx, x, y, 15 * u, -0.6, icon === 'stage' ? '#c99443' : '#8a5a34');
      if (icon === 'stage') featherIcon(ctx, x + 6 * u, y + 2 * u, 12 * u, -0.2, '#8a5a34');
    } else if (icon === 'log') {
      ctx.fillStyle = '#c9a46a';
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
    } else if (icon === 'thermal') {
      ctx.strokeStyle = '#d0782e';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        for (let j = 0; j <= 10; j++) ctx.lineTo(x + i * 7 * u + Math.sin(j * 0.9) * 2.5 * u, y + 12 * u - j * 2.4 * u);
        ctx.stroke();
      }
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
        // two lines at most: the second ends with an ellipsis that fits
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

/** A small feather: a curved shaft and its vane. */
export function featherIcon(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, rot: number, color = '#8a5a34'): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.quadraticCurveTo(0, -len * 0.32, len * 0.5, -len * 0.04);
  ctx.quadraticCurveTo(0, len * 0.3, -len * 0.5, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(251,243,228,.85)';
  ctx.lineWidth = Math.max(0.8, len * 0.06);
  ctx.beginPath();
  ctx.moveTo(-len * 0.62, len * 0.04);
  ctx.quadraticCurveTo(0, -len * 0.06, len * 0.5, -len * 0.04);
  ctx.stroke();
  ctx.restore();
}
