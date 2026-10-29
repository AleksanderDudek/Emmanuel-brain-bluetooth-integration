/**
 * Arka's HUD on the play canvas: the status (the hold's eyebrow, the block's name, a strategy to
 * try, the block's progress and the telegraph), the score (pairs) with the hold's stars, the olive
 * leaf chip, the cards that take turns over the new land (a block's name, a verdict, the dove's
 * return, a cleared hold) and the hint pill above the landing (the first lines, a jam), and the
 * floating words over the deck and the landing.  Every string is fitted to its room, so it reads on
 * a 390 px phone in German and Swedish too; fonts and wrapped lines are made again only when their
 * text or room changes, so a frame leaves no garbage.
 */
import { approach, clamp, ease } from '../kit/juice';
import { bare, t } from './i18n';
import { type Layout } from './layout';
import { C, SANS, SERIF, font, paintLeaf } from './paint';
import { RULES, type ArkaSim } from './sim';

/** A font size fitted for one place on screen, with its font: measured again only when its text or room changes. */
interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

/** Advance timed items and drop the finished ones, in place. */
export function age<T extends { t: number; dur: number }>(list: T[], dt: number): void {
  let n = 0;
  for (const it of list) {
    it.t += dt;
    if (it.t < it.dur) list[n++] = it;
  }
  list.length = n;
}

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; font: string; rise: number }

/** A card over the land: a title and a line under it, shown in turn (lower rank first). */
interface Card { title: string; sub: string; color: string; t: number; dur: number; rank: number; icon: 'post' | 'leaf' | 'olive' | 'stars' | 'plank' | 'none'; stars: number; lines: string[]; subLines: string[]; w: number }

const TXT = {
  day: t('block.day'), evening: t('block.evening'), blind: t('block.blind'), finale: t('block.finale'),
  nextDay: t('next.day'), nextEvening: t('next.evening'), fogDay: t('fog.day'), fogEvening: t('fog.evening'),
  daily: t('hud.daily'), great: t('hud.great'), jam: t('hud.jam'), jamLeaf: t('hud.jamLeaf'), armed: t('hud.armed'),
  ftueTap: t('ftue.tap'), ftuePlank: t('ftue.plank'),
};

export class Hud {
  private L!: Layout;
  private dpr = 1;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private fonts = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly browFit = fitSlot();
  private readonly hintFit = fitSlot();
  private readonly unitFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, font: '', lines: [] as string[] };
  private scorePop = 0;
  private starPop = 0;
  private leafPop = 0;
  private hintA = 0;
  private hintText = '';
  /** the score shown (it counts up to the real one) */
  private shown = 0;
  private scoreText = '0';
  private scoreN = 0;
  private holdText = '';
  private holdN = -1;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      brow: font(700, 10.5 * u, SANS), tip: font(500, 13 * u, SANS), next: font(650, 12 * u, SANS),
      score: font(500, 44 * u, SERIF), unit: font(650, 12 * u, SANS),
      cardTitle: font(500, 20 * u, SERIF, true), cardSub: font(600, 12.5 * u, SANS), float: font(700, 15 * u, SANS), hint: font(650, 13 * u, SANS),
    };
  }

  resize(L: Layout, dpr: number): void {
    this.L = L;
    this.dpr = dpr;
    this.fonts = Hud.fontsFor(L.u);
    this.nameFit.maxW = -1;
    this.tipWrap.maxW = -1;
    this.browFit.maxW = -1;
    for (const c of this.cards) c.w = -1;
  }

  // ── what the view asks for ──────────────────────────────────────
  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.2, rise = 34): void {
    const f = font(700, size * this.L.u, SANS);
    this.floats.push({ text, x, y, t: 0, dur, color, size: size * this.L.u, font: f, rise: rise * this.L.u });
    if (this.floats.length > 12) this.floats.shift();
  }

  /** A card over the land, queued behind more important ones (rank 0 first). */
  card(title: string, sub: string, o: { color?: string; dur?: number; rank?: number; icon?: Card['icon']; stars?: number } = {}): void {
    const c: Card = { title, sub, color: o.color ?? C.ink, t: 0, dur: o.dur ?? 2.6, rank: o.rank ?? 1, icon: o.icon ?? 'none', stars: o.stars ?? 0, lines: [], subLines: [], w: -1 };
    let i = this.cards.length;
    while (i > 1 && this.cards[i - 1].rank > c.rank) i--;
    this.cards.splice(i, 0, c);
    if (this.cards.length > 5) this.cards.pop();
    // something waits: the card showing steps aside after a while
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.4, head.t) + 0.3);
  }

  clearCards(): void { this.cards.length = 0; }

  get showingCard(): string | null { return this.cards[0]?.title ?? null; }

  popScore(): void { this.scorePop = 1; }
  popStars(): void { this.starPop = 1; }
  popLeaf(): void { this.leafPop = 1; }

  update(dt: number, sim: ArkaSim): void {
    age(this.floats, dt);
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.2);
    }
    this.scorePop = Math.max(0, this.scorePop - dt * 2.2);
    this.starPop = Math.max(0, this.starPop - dt * 1.6);
    this.leafPop = Math.max(0, this.leafPop - dt * 1.4);
    // the number counts up quickly to the score
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    const hint = this.hint(sim);
    if (hint) this.hintText = hint;
    this.hintA = approach(this.hintA, hint ? 1 : 0, dt, 0.15);
  }

  /** The pill above the landing: the first lines of the first session, the leaf to use, a jam. */
  private hint(sim: ArkaSim): string {
    if (!sim.active) return '';
    if (sim.leafArmed) return TXT.armed;
    if (sim.jamT > 0.4) return sim.p.leaves > 0 ? TXT.jamLeaf : TXT.jam;
    if (sim.ftue === 'tap') return TXT.ftueTap;
    if (sim.ftue === 'plank') return TXT.ftuePlank;
    return '';
  }

  // ── drawing ─────────────────────────────────────────────────────
  /** `light`: light text on dusk (the Evening's land), else ink on the morning sky and the paper. */
  draw(sim: ArkaSim, now: number, light: number): void {
    // wide screens set the status and the score on the dark deck boards, so they are always light there
    const lit = this.L.mode === 'side' ? 1 : light;
    this.status(sim, now, lit);
    this.score(sim, lit);
    this.leafChip(sim, now);
    this.hintPill();
    this.drawFloats();
    this.drawCard(light);
  }

  private textColor(light: number, a = 1): string {
    const c = light > 0.5 ? [250, 244, 230] : [42, 33, 27];
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }

  /** The status: the hold's eyebrow, the block's name and line, its bar and the telegraph. */
  private status(sim: ArkaSim, now: number, light: number): void {
    const { ctx, L, fonts: F } = this;
    const u = L.u;
    const s = L.status;
    const x = s.x;
    let y = s.y + (L.mode === 'side' ? 74 * u : 4 * u);
    const w = L.mode === 'side' ? s.w : Math.min(s.w, L.w - 150 * u);
    const b = sim.block;
    const done = sim.phase !== 'play';
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    const name = done ? TXT.finale : b.kind === 'evening' ? TXT.evening : b.blind ? TXT.blind : TXT.day;
    const h = sim.hold;
    if (this.holdN !== h.n) {
      this.holdN = h.n;
      this.holdText = h.daily ? TXT.daily : h.recipe === 'great' ? TXT.great : t('hud.hold', { n: h.n });
    }
    this.fitIn(this.browFit, this.holdText, w, 10.5 * u, 700, SANS);
    ctx.font = this.browFit.font;
    ctx.fillStyle = this.textColor(light, 0.62);
    ctx.fillText(this.holdText, x, y + 10 * u);
    const nameSize = this.fitIn(this.nameFit, name, w, 25 * u, 500, SERIF);
    ctx.font = this.nameFit.font;
    const lit = light > 0.5;
    const tone = done ? (lit ? '#f0a878' : '#b86a3c') : b.kind === 'evening' ? (lit ? '#ffd9a0' : '#7a4a6e') : b.blind ? (lit ? '#b4c2ce' : '#6d7a86') : lit ? '#eeb072' : '#8a4f22';
    ctx.fillStyle = tone;
    y += 10 * u + nameSize + 2 * u;
    ctx.fillText(name, x, y);
    if (!done) {
      const lines = this.wrapTip(sim.tip, w);
      ctx.font = F.tip;
      ctx.fillStyle = this.textColor(light, 0.84);
      for (let i = 0; i < Math.min(2, lines.length); i++) {
        y += 16 * u;
        ctx.fillText(lines[i], x, y);
      }
      y += 10 * u;
      const barW = Math.min(w, 160 * u);
      const prog = clamp((now - b.start) / b.dur);
      ctx.fillStyle = this.textColor(light, 0.16);
      ctx.fillRect(x, y, barW, 3);
      ctx.fillStyle = tone;
      ctx.fillRect(x, y, barW * prog, 3);
      const nx = sim.next;
      if (nx && sim.toNext !== null && sim.toNext <= RULES.telegraph) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 6);
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = nx.kind === 'evening' ? '#b0607a' : '#d08a2a';
        ctx.beginPath();
        ctx.arc(x + 4, y + 16 * u, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = F.next;
        ctx.fillStyle = this.textColor(light, 0.9);
        ctx.fillText(nx.kind === 'evening' ? TXT.nextEvening : TXT.nextDay, x + 13, y + 20 * u);
      } else if (!sim.reliable) {
        ctx.font = F.next;
        ctx.fillStyle = this.textColor(light, 0.7);
        ctx.fillText(b.kind === 'evening' ? TXT.fogEvening : TXT.fogDay, x, y + 20 * u);
      }
    }
    ctx.restore();
  }

  /** The pairs (a big serif number counting up), the unit, and the hold's stars (three while Noah's hand has not come). */
  private score(sim: ArkaSim, light: number): void {
    const { ctx, L, fonts: F } = this;
    const u = L.u;
    const right = L.score.x, top = L.score.y;
    const n = Math.round(this.shown);
    if (n !== this.scoreN || !this.scoreText) {
      this.scoreN = n;
      this.scoreText = String(n);
    }
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const pop = this.scorePop > 0 ? 1 + 0.14 * ease.outElastic(1 - this.scorePop) * this.scorePop : 1;
    ctx.font = F.score;
    ctx.fillStyle = this.textColor(light);
    ctx.translate(right, top + 40 * u);
    ctx.scale(pop, pop);
    ctx.fillText(this.scoreText, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.textAlign = 'right';
    const word = bare('pairs', sim.score);
    this.fitIn(this.unitFit, word, 110 * u, 12 * u, 650, SANS);
    ctx.font = this.unitFit.font;
    ctx.fillStyle = this.textColor(light, 0.66);
    ctx.fillText(word, right, top + 56 * u);
    // the hold's stars
    const stars = sim.hold.hands === 0 ? 3 : sim.hold.hands === 1 ? 2 : 1;
    const r = 5.5 * u;
    for (let i = 0; i < 3; i++) {
      const sx = right - r - (2 - i) * r * 2.5, sy = top + 70 * u;
      const on = i < stars;
      const pop2 = i === stars - 1 && this.starPop > 0 ? 1 + 0.4 * this.starPop : 1;
      starPath(ctx, sx, sy, r * pop2);
      ctx.fillStyle = on ? '#d99a2b' : this.textColor(light, 0.18);
      ctx.fill();
      if (on) {
        ctx.strokeStyle = 'rgba(42,33,27,.55)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The olive leaf chip: its leaves in store, lit when armed (tap a waiting animal next). */
  private leafChip(sim: ArkaSim, now: number): void {
    const { ctx, L } = this;
    const r = L.leaf;
    const n = sim.p.leaves;
    const can = sim.active && n > 0;
    ctx.save();
    ctx.globalAlpha = sim.phase === 'play' ? 1 : 0.5;
    const pop = this.leafPop > 0 ? 1 + 0.18 * Math.sin(this.leafPop * Math.PI) : 1;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-r.w / 2, -r.h / 2);
    if (sim.leafArmed) {
      ctx.fillStyle = `rgba(255,222,140,${0.35 + 0.25 * Math.sin(now * 6)})`;
      ctx.beginPath();
      ctx.roundRect(-5, -5, r.w + 10, r.h + 10, 14);
      ctx.fill();
    }
    ctx.fillStyle = can ? C.paper : 'rgba(244,234,214,.55)';
    ctx.strokeStyle = 'rgba(42,33,27,.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(0, 0, r.w, r.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha *= can ? 1 : 0.45;
    paintLeaf(ctx, r.w * 0.18, r.h * 0.58, r.w * 0.62, -0.55);
    // the leaves in store: three small marks
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < n ? C.leaf : 'rgba(42,33,27,.18)';
      ctx.beginPath();
      ctx.arc(r.w * (0.3 + i * 0.2), r.h * 0.86, Math.max(2, r.w * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The pill just above the landing (stack) or under the leaf chip (side). */
  private hintPill(): void {
    if (this.hintA < 0.02 || !this.hintText) return;
    const { ctx, L, fonts: F } = this;
    const u = L.u;
    const maxW = L.mode === 'stack' ? L.w - 28 : L.landing.w + 20;
    const size = this.fitIn(this.hintFit, this.hintText, maxW - 24 * u, 13 * u, 650, SANS);
    ctx.save();
    ctx.font = this.hintFit.font;
    const tw = ctx.measureText(this.hintText).width;
    const pw = tw + 24 * u, ph = size + 12 * u;
    const cx = L.mode === 'stack' ? L.w / 2 : L.landing.x + L.landing.w / 2;
    const cy = L.mode === 'stack' ? L.landing.y - ph / 2 - 4 * u : Math.min(L.h - 70, L.leaf.y + L.leaf.h + ph / 2 + 10 * u);
    ctx.globalAlpha = this.hintA;
    ctx.fillStyle = 'rgba(42,33,27,.86)';
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.hintText, cx, cy + 0.5);
    ctx.restore();
    void F;
  }

  private drawFloats(): void {
    const { ctx, dpr } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.16 ? ease.outBack(k / 0.16) : 1;
      const x = clamp(f.x, 60, this.L.w - 60);
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.setTransform(dpr * pop, 0, 0, dpr * pop, x * dpr, y * dpr);
      ctx.font = f.font;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(247,240,225,.85)';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
    }
    ctx.restore();
  }

  /** The card showing now, over the land (its centre), on paper. */
  private drawCard(light: number): void {
    const c = this.cards[0];
    if (!c) return;
    const { ctx, L, fonts: F } = this;
    const u = L.u;
    const a = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    const maxW = Math.min(L.mode === 'stack' ? L.w - 32 : Math.max(L.land.w - 16, 220), 380 * u);
    const iconW = c.icon === 'none' ? 0 : 34 * u;
    if (c.w !== maxW) {
      c.w = maxW;
      c.lines = this.wrapLines(c.title, maxW - 32 * u - iconW, F.cardTitle);
      c.subLines = c.sub ? this.wrapLines(c.sub, maxW - 32 * u - iconW, F.cardSub) : [];
    }
    const lh = 24 * u, sh = 17 * u;
    const ch = 18 * u + c.lines.length * lh + c.subLines.length * sh + 4 * u;
    let tw = 0;
    ctx.save();
    ctx.font = F.cardTitle;
    for (const l of c.lines) tw = Math.max(tw, ctx.measureText(l).width);
    ctx.font = F.cardSub;
    for (const l of c.subLines) tw = Math.max(tw, ctx.measureText(l).width);
    const cw = Math.min(maxW, tw + 32 * u + iconW);
    // over the land: its middle (the play strip or column), or the sky of the Evening's land
    const cx = light > 0.5 ? L.w / 2 : L.land.x + L.land.w / 2;
    const cy = light > 0.5 ? L.h * 0.3 : L.land.y + L.land.h * (L.mode === 'stack' ? 0.62 : 0.55);
    const x = cx - cw / 2, y = cy - ch / 2 + (1 - ease.outCubic(Math.min(1, c.t / 0.35))) * 8;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,33,27,.25)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, cw, ch, 12);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.strokeStyle = 'rgba(42,33,27,.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, ch, 12);
    ctx.fill();
    ctx.stroke();
    // a carved inner line, as on a woodcut's frame
    ctx.strokeStyle = 'rgba(42,33,27,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, cw - 8, ch - 8, 9);
    ctx.stroke();
    if (c.icon !== 'none') this.cardIcon(c, x + 16 * u + iconW / 2 - 4 * u, y + ch / 2, u);
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
    ctx.fillStyle = 'rgba(42,33,27,.72)';
    for (const l of c.subLines) {
      yy += sh;
      ctx.fillText(l, x + 16 * u + iconW, yy - 4 * u);
    }
    ctx.restore();
  }

  private cardIcon(c: Card, x: number, y: number, u: number): void {
    const { ctx } = this;
    if (c.icon === 'leaf' || c.icon === 'olive') {
      paintLeaf(ctx, x - 12 * u, y + 4 * u, 26 * u, -0.6);
      if (c.icon === 'olive') {
        ctx.fillStyle = '#5c6b3a';
        ctx.beginPath();
        ctx.ellipse(x + 6 * u, y - 6 * u, 4 * u, 5 * u, 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (c.icon === 'stars') {
      for (let i = 0; i < 3; i++) {
        starPath(ctx, x - 10 * u + i * 10 * u, y + (i === 1 ? -4 : 2) * u, 5 * u);
        ctx.fillStyle = i < c.stars ? '#d99a2b' : 'rgba(42,33,27,.2)';
        ctx.fill();
      }
    } else if (c.icon === 'post') {
      ctx.fillStyle = '#8a6440';
      ctx.fillRect(x - 4 * u, y - 13 * u, 8 * u, 26 * u);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 4 * u, y - 13 * u, 8 * u, 26 * u);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(x - 4 * u, y - 9 * u + i * 6 * u);
        ctx.lineTo(x + 4 * u, y - 6 * u + i * 6 * u);
      }
      ctx.stroke();
    } else if (c.icon === 'plank') {
      ctx.fillStyle = C.fresh;
      ctx.fillRect(x - 13 * u, y - 4 * u, 26 * u, 8 * u);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x - 13 * u, y - 4 * u, 26 * u, 8 * u);
    }
  }

  // ── text helpers ────────────────────────────────────────────────
  /** The largest font size ≤ `size` at which `text` fits `maxW`, kept in `slot` until text or room change. */
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
    const k = this.tipWrap, f = this.fonts.tip;
    if (k.text !== text || k.maxW !== maxW || k.font !== f) {
      k.text = text;
      k.maxW = maxW;
      k.font = f;
      k.lines = this.wrapLines(text, maxW, f);
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

export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
