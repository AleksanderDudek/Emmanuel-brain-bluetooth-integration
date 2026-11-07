/**
 * Anioł Stróż's own words and pictures over the room (the runner draws the standard HUD: the Mendi
 * panel, the score, the coach marks).  Here: the window whose sky holds the band's last 40 s
 * (kit/trace: gold above the threshold, a cool band behind lullabies, a dotted gap without signal, a
 * veil over a blind block, the lag bracket at "now") and whose sill holds a star a second; the
 * combo ladder by the angel; the night's level as a feather bar along the floor; Pan Guzik's and
 * the child's speech bubbles; toasts; the words floating over the room; the story cards; the choice
 * of gifts at a level-up; the dawn.  Every string is fitted to its room so it reads on a 390 px phone
 * in German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { passage } from '../kit/scripture';
import { LAG_SEC, drawTrace, traceBars, type TraceStyle } from '../kit/trace';
import { CHAPTERS, chapterName, giftById } from './content';
import { t } from './i18n';
import type { Layout, Rect } from './layout';
import { nightInChapter } from './meta';
import { C, SANS, SERIF, font, paintFeather, paintGiftIcon, paintSill, paintStar, paintWindow } from './paint';
import { RULES, comboRung, levelNeed, type AniolSim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Card { title: string; sub: string; color: string; t: number; dur: number }
interface Story { title: string; text: string; verse: { text: string; ref: string } | null; t: number; dur: number }

/** The band's curve in the window's night sky: moonlight below the threshold, gold above it. */
const NIGHT: TraceStyle = {
  line: 'rgba(222,226,255,.85)', above: '#ffd36b', lineWidth: 2, aboveFill: 'rgba(255,211,107,.26)', threshold: 'rgba(222,226,255,.55)',
  focusBand: 'rgba(255,211,107,.07)', restBand: 'rgba(127,167,224,.24)', gap: 'rgba(222,226,255,.6)', veil: 'rgba(78,70,120,.93)',
  now: '#ffe7a0', glow: 'rgba(255,211,107,.4)',
};

const PX = /(\d+(?:\.\d+)?)px/;

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private story: Story | null = null;
  private F = Hud.fontsFor(1);
  private finaleA = 0;
  private choiceA = 0;
  private levelPop = 0;
  private comboPop = 0;
  private comboShown = 0;
  private readonly wraps = new Map<string, string[]>();
  private readonly lag: number;
  private readonly lagLabel: string;
  /** the gift cards on screen while a choice is open (for taps) */
  readonly giftRects: Rect[] = [];

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      small: font(650, 11 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true), cardSub: font(650, 12 * u, SANS), big: font(500, 26 * u, SERIF, true),
      lag: font(700, 9 * u, SANS), level: font(800, 10.5 * u, SANS), combo: font(600, 30 * u, SERIF), comboLabel: font(800, 9.5 * u, SANS),
      mult: font(850, 12 * u, SANS), giftName: font(650, 14.5 * u, SERIF), giftText: font(600, 11.5 * u, SANS), choiceTitle: font(500, 20 * u, SERIF, true),
      bubble: font(650, 12.5 * u, SANS), bubbleChild: font(500, 12.5 * u, SERIF, true), storyTitle: font(500, 19 * u, SERIF, true),
      storyText: font(560, 12.5 * u, SANS), verse: font(500, 12.5 * u, SERIF, true), ref: font(750, 10 * u, SANS), stars: font(500, 22 * u, SERIF),
    };
  }

  /** the middle and the width of the room's part of the screen (cards and the choice centre there) */
  private get mx(): number { return (this.L.roomX0 + this.L.w) / 2; }
  private get aw(): number { return this.L.w - this.L.roomX0; }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, this.L.roomX0 + 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y: Math.max(this.L.roomTop + 10 * u, y), t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 16) this.floats.shift();
  }

  popLevel(): void { this.levelPop = 1; }
  popCombo(): void { this.comboPop = 1; }

  toast(title: string, sub: string, color: string = C.text): void {
    this.cards.push({ title, sub, color, t: 0, dur: 2.6 });
    if (this.cards.length > 4) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.4, head.t) + 0.3);
  }

  /** The story card: the first night's (with the root verse) or the dream's. */
  showStory(kind: 'open' | 'chapter', chapter: number, night: number): void {
    const ch = CHAPTERS[chapter];
    if (kind === 'open') {
      const p = passage('psa91.11');
      this.story = { title: t('story.open.title'), text: t('story.open.text'), verse: { text: p.text, ref: p.ref }, t: 0, dur: 8 };
    } else {
      this.story = { title: t('story.title', { dream: chapterName(ch.id), n: nightInChapter(night) }), text: t(`story.${ch.id}`), verse: null, t: 0, dur: 6 };
    }
  }

  update(dt: number, sim: AniolSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.2);
    }
    // the story card waits for the block's banner to go (it is shown over the same place)
    const free = !sim.started || sim.phase !== 'play' || sim.block.kind === 'warmup' || sim.blockT >= 4.6;
    if (this.story && (free || this.story.t > 0) && (this.story.t += dt) >= this.story.dur) this.story = null;
    this.levelPop = Math.max(0, this.levelPop - dt * 1.5);
    this.comboPop = Math.max(0, this.comboPop - dt * 3);
    this.comboShown = approach(this.comboShown, sim.combo >= 2 ? 1 : 0, dt, 0.12);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length ? 1 : 0, dt, 0.5);
    this.choiceA = approach(this.choiceA, sim.choice ? 1 : 0, dt, 0.08);
  }

  /** Drawn over the room (under the choice of gifts). */
  draw(sim: AniolSim): void {
    this.xpBar(sim);
    this.combo(sim);
    this.drawFloats();
    this.drawCard();
    this.drawStory();
    this.finale(sim);
    this.choice(sim);
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.9, r = 10): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(247,240,226,${a})`;
    ctx.strokeStyle = 'rgba(160,140,190,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r * this.L.u);
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

  /** `text` wrapped to `maxW` in font `f`, at most `max` lines (the last one ends in "…" when cut); cached. */
  private lines(text: string, maxW: number, f: string, max: number): string[] {
    const key = `${f}|${Math.round(maxW)}|${max}|${text}`;
    let out = this.wraps.get(key);
    if (!out) {
      this.ctx.font = f;
      out = wrap(this.ctx, text, maxW);
      if (out.length > max) {
        out = out.slice(0, max);
        let last = out[max - 1];
        while (last.length > 1 && this.ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        out[max - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
      }
      if (this.wraps.size > 80) this.wraps.clear();
      this.wraps.set(key, out);
    }
    return out;
  }

  // ── the night's level: a feather bar along the floor ────────────
  private xpBar(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const label = t('hud.lvl', { n: sim.nightLevel + 1 });
    ctx.font = F.level;
    const lw = ctx.measureText(label).width;
    const span = Math.min(L.S * 5.2, (L.w - L.roomX0) * 0.7);
    const x0 = L.cx - span / 2, y = L.floorY + Math.max(8 * u, (L.h - L.floorY) * 0.14), h = 5 * u;
    const k = 1 + 0.25 * this.levelPop;
    ctx.save();
    ctx.translate(x0, y);
    ctx.scale(k, k);
    ctx.translate(-x0, -y);
    paintFeather(ctx, x0 - lw - 18 * u, y + h / 2, 6 * u, 0.5);
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 - lw - 10 * u, y + h / 2);
    ctx.fillStyle = 'rgba(20,14,40,.45)';
    ctx.beginPath();
    ctx.roundRect(x0, y, span, h, h / 2);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.roundRect(x0, y, Math.max(h, span * clamp(sim.xp / levelNeed(sim.nightLevel))), h, h / 2);
    ctx.fill();
    ctx.restore();
  }

  // ── the combo ladder by the angel ───────────────────────────────
  private combo(sim: AniolSim): void {
    const a = this.comboShown;
    if (a < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, S = L.S;
    const n = sim.combo, m = sim.mult, rung = comboRung(n);
    const x = Math.min(L.cx + S * 1.3, L.w - 70 * u), y = Math.max(L.roomTop + 6 * u, L.floorY - S * 3.25);
    const pop = 1 + 0.35 * ease.outBack(this.comboPop) * this.comboPop;
    ctx.save();
    ctx.globalAlpha = a;
    // the number, its pitch in colour: warmer up the ladder
    const col = m >= 5 ? '#ff8f6b' : m >= 4 ? '#ffa35a' : m >= 3 ? '#ffc35a' : m >= 2 ? '#ffe08a' : '#fff6dc';
    ctx.translate(x, y + 16 * u);
    ctx.scale(pop, pop);
    ctx.font = F.combo;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(20,16,44,.75)';
    ctx.strokeText(String(n), 0, 0);
    ctx.fillStyle = col;
    ctx.fillText(String(n), 0, 0);
    const nw = ctx.measureText(String(n)).width;
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    // the label and the multiplier pill
    ctx.font = F.comboLabel;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,246,220,.85)';
    ctx.fillText(t('hud.combo').toUpperCase(), x + 1, y + 32 * u);
    if (m > 1) {
      ctx.font = F.mult;
      const txt = t('hud.mult', { n: m });
      const pw = ctx.measureText(txt).width + 12 * u, px = x + nw + 8 * u, py = y + 8 * u;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, 17 * u, 8.5 * u);
      ctx.fill();
      ctx.fillStyle = C.night;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, px + pw / 2, py + 9 * u);
    }
    // the rungs: ×2 ×3 ×4 ×5, the next one filling
    const rw = 13 * u, rh = 4 * u, gap = 3 * u, ry = y + 46 * u;
    for (let i = 0; i < RULES.comboAt.length; i++) {
      const rx = x + i * (rw + gap);
      ctx.fillStyle = 'rgba(20,14,40,.5)';
      ctx.fillRect(rx, ry, rw, rh);
      const done = n >= RULES.comboAt[i];
      const filling = !done && rung.next === RULES.comboAt[i];
      if (done || filling) {
        ctx.fillStyle = done ? col : 'rgba(255,236,170,.75)';
        ctx.fillRect(rx, ry, rw * (done ? 1 : rung.k), rh);
      }
    }
    ctx.restore();
  }

  // ── speech bubbles ──────────────────────────────────────────────
  /** A bubble pointing at (ax, ay): Pan Guzik's to the upper right, the child's sleep-talk to the upper left. */
  bubble(text: string, who: 'bear' | 'child', ax: number, ay: number, k: number): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    const f = who === 'child' ? this.F.bubbleChild : this.F.bubble;
    const maxW = Math.min(250 * u, (L.w - L.roomX0) * 0.62);
    const ls = this.lines(text, maxW - 20 * u, f, 3);
    ctx.font = f;
    const w = Math.max(...ls.map(l => ctx.measureText(l).width)) + 22 * u, lh = 16 * u, h = ls.length * lh + 14 * u;
    let x = who === 'bear' ? ax - 24 * u : ax - w + 24 * u;
    x = clamp(x, L.roomX0 + 8, L.w - w - 8);
    const y = Math.max(L.roomTop + 2, ay - h - 16 * u);
    const pop = ease.outBack(clamp(k / 0.18));
    const out = clamp((1 - k) / 0.12);
    ctx.save();
    ctx.globalAlpha = Math.min(1, out);
    ctx.translate(ax, ay);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.translate(-ax, -ay);
    ctx.shadowColor = 'rgba(10,8,30,.35)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = who === 'child' ? 'rgba(214,224,255,.96)' : 'rgba(255,250,238,.97)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    // the tail (the child's: little thought bubbles)
    const tx = clamp(ax, x + 14 * u, x + w - 14 * u);
    if (who === 'bear') {
      ctx.beginPath();
      ctx.moveTo(tx - 7 * u, y + h - 1);
      ctx.lineTo(ax, Math.min(ay - 2, y + h + 12 * u));
      ctx.lineTo(tx + 7 * u, y + h - 1);
      ctx.closePath();
      ctx.fill();
    } else {
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(tx + (ax - tx) * (0.4 + i * 0.4), y + h + (6 + i * 7) * u, (4 - i * 1.4) * u, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = who === 'child' ? '#34507e' : C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x + 11 * u, y + 7 * u + i * lh));
    ctx.restore();
  }

  // ── the window: the band's last 40 s ────────────────────────────
  /** The window's night sky with the curve, and the sill with a star for each second; drawn with the room (under the angel). */
  drawWindow(sim: AniolSim, dawn: number, curtains: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.win, s = L.sill;
    if (r.w < 20) return;
    paintWindow(ctx, r.x, r.y, r.w, r.h, sim.t, dawn, curtains);
    const box = { x: r.x + 6 * u, y: r.y + 4 * u, w: r.w - 12 * u, h: r.h - 8 * u };
    const lay = sim.trace.layout(box, sim.t);
    drawTrace(ctx, lay, { ...NIGHT, lag: { sec: this.lag, color: 'rgba(255,240,200,.85)' } });
    const last = lay.points[lay.points.length - 1];
    if (last) {
      ctx.font = this.F.lag;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.fillText(this.lagLabel, lay.xOf(last.t - this.lag) - 3 * u, box.y + 1);
    }
    if (s.h <= 0) return;
    // the sill: one star a second, gold above the threshold, blue in a lullaby, a dot where the signal failed
    paintSill(ctx, s.x, s.y, s.w, s.h);
    const n = 40;
    const bars = traceBars(sim.trace, sim.t, n);
    const step = s.w / n, cy = s.y + s.h / 2;
    bars.forEach((b, i) => {
      const x = s.x + (i + 0.5) * step;
      if (b.empty) return;
      if (b.shown <= 0) {
        ctx.fillStyle = 'rgba(78,70,120,.85)';
        ctx.beginPath();
        ctx.arc(x, cy, step * 0.28, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (!b.reliable) {
        ctx.fillStyle = 'rgba(60,40,30,.55)';
        ctx.fillRect(x - 1, cy - 1, 2, 2);
        return;
      }
      const rr = Math.min(step * 0.48, (2.2 + b.level * 4.2) * u, s.h * 0.48);
      const color = b.above ? (b.phase === 'rest' ? '#cfe0ff' : '#ffd36b') : b.phase === 'rest' ? '#9dbcf0' : 'rgba(255,248,230,.75)';
      if (b.above) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.shown * 0.5;
        ctx.fillStyle = 'rgba(255,211,107,.6)';
        ctx.beginPath();
        ctx.arc(x, cy, rr * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      paintStar(ctx, x, cy, rr, b.shown, color);
    });
    // the lag bracket over the newest stars
    const lagStars = Math.max(1, Math.round(this.lag));
    const bx0 = s.x + (n - lagStars) * step, bx1 = s.x + s.w;
    ctx.strokeStyle = 'rgba(60,35,20,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx0 + 1, s.y + s.h - 2);
    ctx.lineTo(bx0 + 1, s.y + s.h + 2);
    ctx.lineTo(bx1 - 1, s.y + s.h + 2);
    ctx.lineTo(bx1 - 1, s.y + s.h - 2);
    ctx.stroke();
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
      const half = ctx.measureText(f.text).width / 2 + 6;
      const x = Math.min(this.L.w - half, Math.max(this.L.roomX0 + half, f.x));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20,16,44,.75)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(320 * u, this.aw - 32), h = (c.sub ? 56 : 40) * u;
    const x = this.mx - w / 2, y = L.cardY - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(this.mx, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-this.mx, -(y + h / 2));
    ctx.shadowColor = 'rgba(10,8,30,.35)';
    ctx.shadowBlur = 16;
    this.paper(x, y, w, h, 0.96);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(c.title, w - 2 * pad, F.cardTitle);
    ctx.fillText(c.title, this.mx, y + 8 * u);
    if (c.sub) {
      ctx.fillStyle = c.color;
      ctx.font = this.fit(c.sub, w - 2 * pad, F.cardSub, 0.62);
      ctx.fillText(c.sub, this.mx, y + 33 * u);
    }
    ctx.restore();
  }

  /** The story card: the dream's name and two sentences; the first night's also carries the root verse. */
  private drawStory(): void {
    const s = this.story;
    if (!s || s.t <= 0) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const w = Math.min(420 * u, this.aw - 28), pad = 14 * u;
    const textLs = this.lines(s.text, w - 2 * pad, F.storyText, 4);
    const verseLs = s.verse ? this.lines(s.verse.text, w - 2 * pad, F.verse, 4) : [];
    const lh = 16 * u;
    const h = 36 * u + textLs.length * lh + (verseLs.length ? 10 * u + verseLs.length * lh + 16 * u : 0) + 12 * u;
    const inK = ease.outBack(clamp(s.t / 0.35)), outK = clamp((s.dur - s.t) / 0.5);
    const x = this.mx - w / 2, y = Math.max(L.roomTop + 4 * u, Math.min(L.cardY - 30 * u, L.floorY - L.S * 2.2 - h));
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(this.mx, y);
    ctx.scale(0.92 + 0.08 * inK, 0.92 + 0.08 * inK);
    ctx.translate(-this.mx, -y);
    ctx.shadowColor = 'rgba(10,8,30,.4)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(28,29,63,.93)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(245,201,106,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = this.fit(s.title, w - 2 * pad, F.storyTitle);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(s.title, this.mx, y + 10 * u);
    ctx.font = F.storyText;
    ctx.fillStyle = 'rgba(240,236,255,.92)';
    textLs.forEach((l, i) => ctx.fillText(l, this.mx, y + 36 * u + i * lh));
    if (verseLs.length && s.verse) {
      const vy = y + 36 * u + textLs.length * lh + 10 * u;
      ctx.font = F.verse;
      ctx.fillStyle = '#ffe9b8';
      verseLs.forEach((l, i) => ctx.fillText(l, this.mx, vy + i * lh));
      ctx.font = F.ref;
      ctx.fillStyle = 'rgba(255,233,184,.7)';
      ctx.fillText(s.verse.ref, this.mx, vy + verseLs.length * lh + 2 * u);
    }
    ctx.restore();
  }

  // ── the dawn ────────────────────────────────────────────────────
  private finale(sim: AniolSim): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(this.aw - 32, 340 * u), h = 96 * u, x = this.mx - w / 2, y = L.cardY - 20 * u;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    const title = t('finale.title');
    ctx.font = this.fit(title, w - 24 * u, this.F.big);
    ctx.fillText(title, this.mx, y + 8 * u);
    const n = sim.nightStars;
    ctx.font = this.F.stars;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < n ? C.goldDeep : 'rgba(80,70,110,.25)';
      ctx.fillText('★', this.mx + (i - 1) * 26 * u, y + 40 * u);
    }
    const sub = t('finale.sub');
    ctx.font = this.fit(sub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(sub, this.mx, y + 72 * u);
    ctx.globalAlpha = 1;
  }

  // ── the choice of gifts ─────────────────────────────────────────
  private choice(sim: AniolSim): void {
    this.giftRects.length = 0;
    const c = sim.choice;
    if (!c && this.choiceA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = this.choiceA;
    ctx.fillStyle = `rgba(14,12,34,${0.42 * a})`;
    ctx.fillRect(L.roomX0, L.roomTop - 6, L.w - L.roomX0, L.h - L.roomTop + 6);
    if (!c) return;
    const gap = 10 * u;
    const cw = Math.min(180 * u, (this.aw - 32 - 2 * gap) / 3);
    const titleY = L.roomTop + 6 * u;
    const ch = clamp(L.floorY - titleY - 44 * u, 70 * u, 150 * u);
    const total = 3 * cw + 2 * gap;
    const x0 = this.mx - total / 2;
    const y0 = titleY + 28 * u;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const title = t('level.title', { n: sim.nightLevel + 1 });
    ctx.font = this.fit(title, this.aw - 32, F.choiceTitle);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(14,12,34,.7)';
    ctx.strokeText(title, this.mx, titleY);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(title, this.mx, titleY);
    const left = Math.max(0, RULES.choiceSec - c.t);
    c.options.forEach((id, i) => {
      const g = giftById(id);
      const x = x0 + i * (cw + gap);
      const inK = ease.outBack(clamp((c.t - i * 0.06) / 0.28));
      const y = y0 + (1 - inK) * 20 * u;
      this.giftRects.push({ x, y: y0, w: cw, h: ch });
      ctx.save();
      ctx.globalAlpha = a * clamp(inK);
      ctx.shadowColor = 'rgba(255,214,120,.45)';
      ctx.shadowBlur = i === 0 ? 18 * (0.6 + 0.4 * Math.sin(sim.t * 4)) : 10;
      this.paper(x, y, cw, ch, 0.97);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = i === 0 ? C.gold : 'rgba(160,140,190,.5)';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10 * u);
      ctx.stroke();
      ctx.fillStyle = 'rgba(80,70,110,.75)';
      ctx.font = F.level;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 8 * u, y + 7 * u);
      paintGiftIcon(ctx, id, x + cw / 2, y + 30 * u, 16 * u);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.text;
      ctx.font = this.fit(g.name, cw - 12 * u, F.giftName, 0.6);
      ctx.fillText(g.name, x + cw / 2, y + 56 * u);
      ctx.fillStyle = C.textSoft;
      if (ch >= 104 * u) this.lines(g.text, cw - 14 * u, F.giftText, Math.max(1, Math.floor((ch - 84 * u) / (14 * u)))).forEach((line, k) => {
        ctx.font = F.giftText;
        ctx.fillText(line, x + cw / 2, y + 78 * u + k * 14 * u);
      });
      ctx.restore();
    });
    const hint = t('level.hint', { n: Math.ceil(left) });
    const hy = y0 + ch + 8 * u;
    ctx.globalAlpha = a;
    ctx.font = this.fit(hint, this.aw - 32, F.small);
    ctx.fillStyle = 'rgba(255,248,230,.9)';
    ctx.textAlign = 'center';
    if (hy + 14 * u < L.h - 4) ctx.fillText(hint, this.mx, hy);
    const r0 = this.giftRects[0];
    ctx.fillStyle = C.gold;
    ctx.fillRect(r0.x + 8 * u, r0.y + ch - 5 * u, (cw - 16 * u) * clamp(left / RULES.choiceSec), 2.5 * u);
    ctx.globalAlpha = 1;
  }

  /** Which gift card is at a point (−1: none). */
  giftAt(x: number, y: number): number {
    return this.giftRects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
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
