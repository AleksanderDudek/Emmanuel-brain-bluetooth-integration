/**
 * Anioł Stróż's own words and pictures over the room, drawn phone first (src/arcade/DESIGN.md §12; the runner
 * draws the standard HUD: the Mendi panel, the score, the coach marks).  Here: the window whose sky holds the
 * band's last 40 s (kit/trace: gold above the threshold, a cool band behind lullabies, a dotted gap without
 * signal, a veil over a blind block, the lag bracket at "now") and whose sill holds a star a second; the
 * night's level as a feather bar under the sill; the combo ladder by the angel; the three thumb pads at the
 * bottom (pressed on touch-down, gold while a strike on their side would land, brighter in the perfect band);
 * Pan Guzik's and the child's speech bubbles; toasts; the words floating over the room; the story cards (two
 * pages on a small phone, never under the block's banner); the choice of gifts (a bottom sheet of full-width
 * cards on a phone upright); the dawn.
 *
 * Sizes are for a 360 px phone at u = 1: nothing is drawn under MIN_TEXT (paint.ts `font` has the floor), what
 * the player reads to play is at least MIN_READ, the story and the bubbles 14–16 px.  No shadowBlur per frame:
 * the soft shadows are offset shapes, the glows wide translucent strokes.
 */
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { passage } from '../kit/scripture';
import { LAG_SEC, drawTrace, traceBars, type TraceStyle } from '../kit/trace';
import { CHAPTERS, chapterName, giftById, type GiftId } from './content';
import { t } from './i18n';
import { PADS, type Layout, type Pad, type Rect } from './layout';
import { nightInChapter } from './meta';
import { C, SANS, SERIF, font, fontPx, paintFeather, paintGiftIcon, paintSill, paintStar, paintWindow } from './paint';
import { RULES, comboRung, levelNeed, type AniolSim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Card { title: string; sub: string; color: string; t: number; dur: number }
interface Story { title: string; text: string; verse: { text: string; ref: string } | null; t: number; dur: number }

/** A story card laid out for the room it has: one page, or two (the words, then the verse) on a small phone. */
interface StoryPage { lines: { text: string; font: string; color: string; lh: number; gap: number }[]; h: number }
interface StoryLayout { key: string; title: string; titleFont: string; pages: StoryPage[]; split: number }

/** The band's curve in the window's night sky: moonlight below the threshold, gold above it. */
const NIGHT: TraceStyle = {
  line: 'rgba(222,226,255,.85)', above: '#ffd36b', lineWidth: 2, aboveFill: 'rgba(255,211,107,.26)', threshold: 'rgba(222,226,255,.55)',
  focusBand: 'rgba(255,211,107,.07)', restBand: 'rgba(127,167,224,.24)', gap: 'rgba(222,226,255,.6)', veil: 'rgba(78,70,120,.93)',
  now: '#ffe7a0', glow: 'rgba(255,211,107,.4)',
};

const PX = /(\d+(?:\.\d+)?)px/;
const TAU = Math.PI * 2;

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private story: Story | null = null;
  private storyShown = 0;
  private storyLay: StoryLayout | null = null;
  /** text scale: 1 on a phone, a little more on a tablet or a desktop (the geometry grows with u) */
  private tu = 1;
  private F = Hud.fontsFor(1);
  private finaleA = 0;
  private choiceA = 0;
  private levelPop = 0;
  private comboPop = 0;
  private comboShown = 0;
  private padsA = 1;
  private readonly wraps = new Map<string, string[]>();
  private readonly paras = new Map<string, { lines: string[]; font: string; size: number }>();
  private readonly lag: number;
  private readonly lagLabel: string;
  // the pads: a finger down on each (pointer id → pad), the flash of a press or a key, the tell, a whiff
  private readonly padDown = new Map<number, Pad>();
  private readonly padFlash: Record<Pad, number> = { left: 0, mid: 0, right: 0 };
  private readonly padGlow: Record<Pad, number> = { left: 0, mid: 0, right: 0 };
  private readonly padWhiff: Record<Pad, number> = { left: 0, mid: 0, right: 0 };
  private readonly padReady: Record<Pad, 0 | 1 | 2> = { left: 0, mid: 0, right: 0 };
  private nearSide: -1 | 1 = 1;
  private giftPress = -1;
  private giftPressT = 0;
  private clock = 0;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean, private readonly touch: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(tu: number) {
    return {
      small: font(700, 13 * tu, SANS), cardTitle: font(500, 18 * tu, SERIF, true), cardSub: font(650, 13.5 * tu, SANS), big: font(500, 26 * tu, SERIF, true),
      lag: font(800, 13 * tu, SANS), level: font(800, 13 * tu, SANS), combo: font(600, 30 * tu, SERIF), comboLabel: font(850, 13 * tu, SANS),
      mult: font(850, 13.5 * tu, SANS), giftName: font(650, 16 * tu, SERIF), giftText: font(600, 13.5 * tu, SANS), giftKey: font(800, 13 * tu, SANS),
      choiceTitle: font(500, 19 * tu, SERIF, true), bubble: font(650, 14.5 * tu, SANS), bubbleChild: font(500, 14.5 * tu, SERIF, true),
      storyTitle: font(500, 20 * tu, SERIF, true), stars: font(500, 24 * tu, SERIF), padKey: font(800, 13 * tu, SANS),
    };
  }

  /** The view's own cards are on screen (a story card, a toast): Pan Guzik and the coach marks wait (sim.busy). */
  get busy(): boolean { return !!this.story || this.cards.length > 0; }

  /** the middle and the width of the room's part of the screen (cards and the choice centre there) */
  private get mx(): number { return (this.L.roomX0 + this.L.roomX1) / 2; }
  private get aw(): number { return this.L.roomX1 - this.L.roomX0; }

  resize(L: Layout): void {
    this.L = L;
    this.tu = 1 + (L.u - 1) * 0.6;
    this.F = Hud.fontsFor(this.tu);
    this.wraps.clear();
    this.paras.clear();
    this.storyLay = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, this.L.roomX0 + 40 * u, this.L.roomX1 - 40 * u);
    this.floats.push({ text, x, y: Math.max(this.L.roomTop + 10 * u, y), t: 0, dur, color, font: font(800, Math.max(MIN_READ, size) * this.tu, SANS), rise: rise * u });
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
      this.story = { title: t('story.open.title'), text: t('story.open.text'), verse: { text: p.text, ref: p.ref }, t: 0, dur: 8.5 };
    } else {
      this.story = { title: t('story.title', { dream: chapterName(ch.id), n: nightInChapter(night) }), text: t(`story.${ch.id}`), verse: null, t: 0, dur: 6 };
    }
    this.storyLay = null;
  }

  // ── the pads (index.ts presses them, render.ts tells them what a strike would do) ──
  press(pad: Pad, id: number): void {
    this.padDown.set(id, pad);
    this.padFlash[pad] = 1;
  }

  /** A finger lifts (null: every finger, the pause). */
  release(id: number | null): void {
    if (id === null) this.padDown.clear();
    else this.padDown.delete(id);
  }

  flash(pad: Pad): void { this.padFlash[pad] = 1; }

  whiff(side: -1 | 1): void {
    this.padWhiff[side < 0 ? 'left' : 'right'] = 1;
  }

  pressGift(i: number): void {
    this.giftPress = i;
    this.giftPressT = 0.35;
  }

  update(dt: number, sim: AniolSim): void {
    this.clock += dt;
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.2);
    }
    // the story card waits for the block's banner to go (the runner shows it under the HUD) and for the gifts:
    // it pauses and fades, and comes back where it was
    const free = !sim.choice && (!sim.started || sim.phase !== 'play' || sim.block.kind === 'warmup' || sim.blockT >= 4.6);
    this.storyShown = approach(this.storyShown, free && this.story ? 1 : 0, dt, 0.1);
    if (this.story && free && (this.story.t += dt) >= this.story.dur) this.story = null;
    this.levelPop = Math.max(0, this.levelPop - dt * 1.5);
    this.comboPop = Math.max(0, this.comboPop - dt * 3);
    this.comboShown = approach(this.comboShown, sim.combo >= 2 ? 1 : 0, dt, 0.12);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length ? 1 : 0, dt, 0.5);
    this.choiceA = approach(this.choiceA, sim.choice ? 1 : 0, dt, 0.08);
    this.padsA = approach(this.padsA, sim.phase === 'done' ? 0 : 1, dt, 0.4);
    this.giftPressT = Math.max(0, this.giftPressT - dt);
    // the pads' tell: what a strike on each side would do now (the middle one: the nearer side)
    this.nearSide = sim.nearerSide();
    this.padReady.left = sim.ready(-1);
    this.padReady.right = sim.ready(1);
    this.padReady.mid = sim.ready(this.nearSide);
    for (const p of PADS) {
      this.padGlow[p] = approach(this.padGlow[p], this.padReady[p] > 0 ? 1 : 0, dt, this.padReady[p] > 0 ? 0.04 : 0.12);
      this.padFlash[p] = Math.max(0, this.padFlash[p] - dt * 5);
      this.padWhiff[p] = Math.max(0, this.padWhiff[p] - dt * 3.5);
    }
  }

  /** Drawn over the room: the level bar, the combo, the pads, the floats, a toast, the story, the dawn, the gifts. */
  draw(sim: AniolSim): void {
    this.xpBar(sim);
    this.combo(sim);
    this.pads();
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

  /** A soft shadow under a card: an offset translucent shape (a blur per frame costs a phone too much). */
  private shade(x: number, y: number, w: number, h: number, r: number, a = 0.3): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.fillStyle = `rgba(8,6,24,${a})`;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 4 * u, w, h, r);
    ctx.fill();
  }

  /** The font `f`, shrunk (never under `min` px) so `text` fits `maxW`. */
  private fit(text: string, maxW: number, f: string, min: number = MIN_READ): string {
    const ctx = this.ctx;
    ctx.font = f;
    const w = ctx.measureText(text).width;
    if (w <= maxW) return f;
    const m = f.match(PX);
    if (!m) return f;
    const size = Math.max(min, Math.floor(((Number(m[1]) * maxW) / w) * 10) / 10);
    return f.replace(m[0], `${fontPx(size)}px`);
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
      if (this.wraps.size > 120) this.wraps.clear();
      this.wraps.set(key, out);
    }
    return out;
  }

  /** The largest size from `px` down to `min` at which `text` wraps into `max` lines of `maxW` (then cut at `min`); cached. */
  private para(text: string, maxW: number, px: number, min: number, max: number, weight: number, family: string, italic = false): { lines: string[]; font: string; size: number } {
    const key = `${Math.round(maxW)}|${px}|${min}|${max}|${weight}|${family}|${italic}|${text}`;
    const known = this.paras.get(key);
    if (known) return known;
    let out: { lines: string[]; font: string; size: number } | null = null;
    for (let size = px; size >= min - 1e-6 && !out; size -= 0.5) {
      const f = font(weight, size, family, italic);
      this.ctx.font = f;
      const ls = wrap(this.ctx, text, maxW);
      if (ls.length <= max) out = { lines: ls, font: f, size };
    }
    if (!out) {
      const f = font(weight, min, family, italic);
      out = { lines: this.lines(text, maxW, f, max), font: f, size: min };
    }
    if (this.paras.size > 80) this.paras.clear();
    this.paras.set(key, out);
    return out;
  }

  /** Text with a dark rim, so it reads on a busy picture. */
  private rimmed(text: string, x: number, y: number, fill: string, rim = 'rgba(20,16,44,.75)', lw = 3): void {
    const ctx = this.ctx;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = rim;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  // ── the night's level: a feather bar under the sill ─────────────
  private xpBar(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, r = L.xp;
    if (r.w <= 0) return;
    const label = t('hud.lvl', { n: sim.nightLevel + 1 });
    ctx.font = F.level;
    const lw = ctx.measureText(label).width;
    const cy = r.y + r.h / 2, k = 1 + 0.22 * this.levelPop;
    const bx = r.x + 16 * u + lw + 8 * u, bw = r.x + r.w - bx, bh = 5 * u;
    ctx.save();
    ctx.translate(r.x, cy);
    ctx.scale(k, k);
    ctx.translate(-r.x, -cy);
    paintFeather(ctx, r.x + 5 * u, cy, 6 * u, 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    this.rimmed(label, r.x + 14 * u, cy, C.goldLight, 'rgba(20,14,40,.7)');
    ctx.restore();
    if (bw < 20) return;
    ctx.fillStyle = 'rgba(20,14,40,.55)';
    ctx.beginPath();
    ctx.roundRect(bx, cy - bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.roundRect(bx, cy - bh / 2, Math.max(bh, bw * clamp(sim.xp / levelNeed(sim.nightLevel))), bh, bh / 2);
    ctx.fill();
  }

  // ── the combo ladder by the angel ───────────────────────────────
  private combo(sim: AniolSim): void {
    const a = this.comboShown;
    if (a < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const n = sim.combo, m = sim.mult, rung = comboRung(n);
    const { x, y } = L.combo;
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
    this.rimmed(String(n), 0, 0, col, 'rgba(20,16,44,.75)', 4);
    const nw = ctx.measureText(String(n)).width;
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    // the label and the multiplier pill
    ctx.font = F.comboLabel;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    this.rimmed(t('hud.combo').toUpperCase(), x + 1, y + 33 * u, 'rgba(255,246,220,.95)', 'rgba(20,16,44,.7)');
    if (m > 1) {
      ctx.font = F.mult;
      const txt = t('hud.mult', { n: m });
      const ph = 19 * u, pw = ctx.measureText(txt).width + 12 * u, px = x + nw + 8 * u, py = y + 7 * u;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, ph, ph / 2);
      ctx.fill();
      ctx.fillStyle = C.night;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, px + pw / 2, py + ph / 2 + 0.5);
    }
    // the rungs: ×2 ×3 ×4 ×5, the next one filling
    const rw = 14 * u, rh = 4 * u, gap = 3 * u, ry = y + 52 * u;
    for (let i = 0; i < RULES.comboAt.length; i++) {
      const rx = x + i * (rw + gap);
      ctx.fillStyle = 'rgba(20,14,40,.55)';
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

  // ── the thumb pads ──────────────────────────────────────────────
  /**
   * The three pads at the bottom: ◀ the left side, the nearer side in the middle, ▶ the right side.  A press
   * shows at once (lighter, a little squashed); a pad is gold while a strike on its side would land, and
   * pulses brighter in the perfect band; a whiff greys its side for the recovery.  On a desktop each pad
   * also names its key.
   */
  private pads(): void {
    const a = this.padsA * (1 - this.choiceA);
    if (a < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const held = new Set(this.padDown.values());
    const pulse = 0.5 + 0.5 * Math.sin(this.clock * 10);
    ctx.save();
    ctx.globalAlpha = a;
    for (const p of PADS) {
      const r = L.pads[p];
      const k = Math.max(held.has(p) ? 1 : 0, this.padFlash[p]);
      const glow = this.padGlow[p], perfect = this.padReady[p] === 2 ? 1 : 0, whiff = this.padWhiff[p];
      const rad = Math.min(r.h / 2, 18 * u);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2, s = 1 - 0.07 * k;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      ctx.translate(-cx, -cy);
      // the soft halo of a ready pad: a wide translucent stroke (no blur)
      if (glow > 0.02) {
        ctx.strokeStyle = `rgba(255,211,107,${0.22 * glow + 0.18 * perfect * pulse})`;
        ctx.lineWidth = 8 * u;
        ctx.beginPath();
        ctx.roundRect(r.x, r.y, r.w, r.h, rad);
        ctx.stroke();
      }
      ctx.fillStyle = whiff > 0.02 ? `rgba(60,52,80,${0.55 + 0.2 * whiff})` : `rgba(16,14,40,${0.48 + 0.16 * k})`;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, rad);
      ctx.fill();
      if (glow > 0.02 || k > 0.02) {
        ctx.fillStyle = `rgba(255,${glow > 0.02 ? 211 : 244},${glow > 0.02 ? 107 : 214},${0.12 * glow + 0.1 * perfect * pulse + 0.3 * k})`;
        ctx.fill();
      }
      ctx.strokeStyle = glow > 0.02 ? `rgba(255,211,107,${0.45 + 0.5 * glow})` : 'rgba(255,244,214,.3)';
      ctx.lineWidth = (1.5 + 1.2 * glow) * u;
      ctx.stroke();
      // the icon: a chevron toward the side (the middle pad: both, the nearer one lit)
      const ink = (lit: boolean): string => (lit ? (perfect ? '#fff1b8' : '#ffd36b') : whiff > 0.02 ? 'rgba(200,190,220,.55)' : 'rgba(255,244,214,.78)');
      const keys = !this.touch;
      const iy = keys ? r.y + r.h * 0.4 : cy;
      const size = Math.min(r.h * (keys ? 0.24 : 0.3), 20 * u);
      if (p === 'mid') {
        const off = size * 0.95;
        chevron(ctx, cx - off, iy, size * 0.78, -1, ink(glow > 0.02 && this.nearSide < 0));
        chevron(ctx, cx + off, iy, size * 0.78, 1, ink(glow > 0.02 && this.nearSide > 0));
        ctx.fillStyle = ink(glow > 0.02);
        ctx.beginPath();
        ctx.arc(cx, iy, size * 0.2, 0, TAU);
        ctx.fill();
      } else chevron(ctx, cx, iy, size, p === 'left' ? -1 : 1, ink(glow > 0.02));
      if (keys) {
        const label = p === 'left' ? '← A' : p === 'right' ? 'D →' : t('pad.space');
        ctx.font = this.fit(label, r.w - 12 * u, this.F.padKey);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,244,214,.72)';
        ctx.fillText(label, cx, r.y + r.h * 0.76);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  // ── speech bubbles ──────────────────────────────────────────────
  /** A bubble pointing at (ax, ay): Pan Guzik's to the upper right, the child's sleep-talk to the upper left. */
  bubble(text: string, who: 'bear' | 'child', ax: number, ay: number, k: number): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    const f = who === 'child' ? this.F.bubbleChild : this.F.bubble;
    const maxW = Math.min(270 * u, (L.roomX1 - L.roomX0 - 24) * 0.8);
    const ls = this.lines(text, maxW - 22 * u, f, 4);
    ctx.font = f;
    const lh = Math.round(fontPx(14.5 * this.tu) * 1.28);
    const w = Math.max(...ls.map(l => ctx.measureText(l).width)) + 22 * u, h = ls.length * lh + 14 * u;
    let x = who === 'bear' ? ax - 24 * u : ax - w + 24 * u;
    x = clamp(x, L.roomX0 + 8, L.roomX1 - w - 8);
    const y = Math.max(L.roomTop + 2, ay - h - 16 * u);
    const pop = ease.outBack(clamp(k / 0.18));
    const out = clamp((1 - k) / 0.12);
    ctx.save();
    ctx.globalAlpha = Math.min(1, out);
    ctx.translate(ax, ay);
    ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
    ctx.translate(-ax, -ay);
    this.shade(x, y, w, h, 12 * u, 0.28);
    ctx.fillStyle = who === 'child' ? 'rgba(214,224,255,.97)' : 'rgba(255,250,238,.98)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
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
        ctx.arc(tx + (ax - tx) * (0.4 + i * 0.4), y + h + (6 + i * 7) * u, (4 - i * 1.4) * u, 0, TAU);
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
      this.rimmed(this.lagLabel, lay.xOf(last.t - this.lag) - 3 * u, box.y + 1, 'rgba(255,240,200,.95)', 'rgba(14,12,40,.7)');
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
        ctx.arc(x, cy, step * 0.28, 0, TAU);
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
        ctx.arc(x, cy, rr * 1.6, 0, TAU);
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
      const x = Math.min(this.L.roomX1 - half, Math.max(this.L.roomX0 + half, f.x));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      this.rimmed(f.text, 0, 0, f.color, 'rgba(20,16,44,.75)', 4);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c || (this.story && this.storyShown > 0.02)) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = L.card.w, pad = 12 * u, mx = L.card.x + w / 2;
    const sub = c.sub ? this.para(c.sub, w - 2 * pad, 13.5 * this.tu, MIN_READ, 2, 650, SANS) : null;
    const subLh = sub ? Math.round(sub.size * 1.3) : 0;
    const titleH = Math.round(fontPx(18 * this.tu) * 1.3);
    const h = pad * 0.8 + titleH + (sub ? 3 * u + sub.lines.length * subLh : 0) + pad * 0.8;
    const x = L.card.x, y = L.card.y + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(mx, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-mx, -(y + h / 2));
    this.shade(x, y, w, h, 10 * u, 0.3);
    this.paper(x, y, w, h, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(c.title, w - 2 * pad, F.cardTitle, 15);
    ctx.fillText(c.title, mx, y + pad * 0.8);
    if (sub) {
      ctx.fillStyle = c.color;
      ctx.font = sub.font;
      sub.lines.forEach((l, i) => ctx.fillText(l, mx, y + pad * 0.8 + titleH + 3 * u + i * subLh));
    }
    ctx.restore();
  }

  /** The story card laid out for this room: the largest text (16 → 15 px) on one page, else two pages (the words, the verse). */
  private storyLayout(s: Story): StoryLayout {
    const L = this.L, u = L.u, key = `${s.title}|${L.w}x${L.h}|${L.story.y}`;
    if (this.storyLay && this.storyLay.key === key) return this.storyLay;
    const w = L.story.w, pad = 14 * u, inner = w - 2 * pad, tu = this.tu;
    const titleFont = this.fit(s.title, inner, this.F.storyTitle, 15);
    const titleH = Math.round(fontPx(20 * tu) * 1.3) + 4 * u;
    const ref = s.verse ? { text: s.verse.ref, font: font(750, 13 * tu, SANS), color: 'rgba(255,233,184,.8)', lh: Math.round(fontPx(13 * tu) * 1.3), gap: 2 * u } : null;
    const page = (parts: { text: string; px: number; italic: boolean; serif: boolean; color: string; gap: number }[], room: number, floor: number): StoryPage | null => {
      for (let px = parts[0].px; px >= floor - 1e-6; px -= 0.5) {
        const lines: StoryPage['lines'] = [];
        for (const p of parts) {
          const f = font(p.serif ? 500 : 560, px * tu, p.serif ? SERIF : SANS, p.italic);
          this.ctx.font = f;
          const lh = Math.round(fontPx(px * tu) * 1.3);
          wrap(this.ctx, p.text, inner).forEach((l, i) => lines.push({ text: l, font: f, color: p.color, lh, gap: i === 0 ? p.gap : 0 }));
        }
        if (ref && parts.some(p => p.italic)) lines.push({ ...ref });
        const h = pad + titleH + lines.reduce((a, l) => a + l.lh + l.gap, 0) + pad;
        if (h <= room || px - 0.5 < floor - 1e-6) return { lines, h };
      }
      return null;
    };
    const text = { text: s.text, px: 16, italic: false, serif: false, color: 'rgba(240,236,255,.94)', gap: 0 };
    const verse = s.verse ? { text: s.verse.text, px: 16, italic: true, serif: true, color: '#ffe9b8', gap: 10 * u } : null;
    const room = L.story.maxH;
    let pages: StoryPage[];
    const one = page(verse ? [text, verse] : [text], room, 15);
    if (one && one.h <= room) pages = [one];
    else if (verse) pages = [page([text], room, MIN_READ)!, page([{ ...verse, gap: 0 }], room, MIN_READ)!];
    else pages = [page([text], room, MIN_READ)!];
    const lay: StoryLayout = { key, title: s.title, titleFont, pages, split: pages.length > 1 ? 0.55 : 1 };
    this.storyLay = lay;
    return lay;
  }

  /** The story card as laid out for this room now (null: none): its pages, for the tests. */
  storyNow(): StoryLayout | null { return this.story ? this.storyLayout(this.story) : null; }

  /**
   * A gift card's words as drawn on card `r`: its name's font (fitted) and what it does, wrapped at the largest
   * size from 13.5 px that fits (never under MIN_READ).  On a phone's stacked card the icon is left of them.
   */
  giftWords(id: GiftId, r: Rect): { nameFont: string; nameW: number; body: { lines: string[]; font: string; size: number }; textW: number } {
    const L = this.L, u = L.u, F = this.F, g = giftById(id);
    if (L.stacked) {
      const ir = Math.min(18 * u, r.h * 0.28);
      const tx = r.x + 2 * ir + (this.touch ? 30 : 36) * u, tw = r.x + r.w - 12 * u - tx;
      return { nameFont: this.fit(g.name, tw, F.giftName, 14), nameW: tw, body: this.para(g.text, tw, 13.5 * this.tu, MIN_READ, 2, 600, SANS), textW: tw };
    }
    const ir = Math.min(16 * u, r.h * 0.14);
    const nameY = 18 * u + 2 * ir, textY = nameY + Math.round(fontPx(16 * this.tu) * 1.3);
    const max = Math.max(1, Math.floor((r.h - 8 * u - textY) / Math.round(fontPx(13.5 * this.tu) * 1.28)));
    const tw = r.w - 16 * u;
    return { nameFont: this.fit(g.name, r.w - 14 * u, F.giftName, 14), nameW: r.w - 14 * u, body: this.para(g.text, tw, 13.5 * this.tu, MIN_READ, max, 600, SANS), textW: tw };
  }

  /** The story card: the dream's name and two sentences; the first night's also carries the root verse (a page of its own on a small phone). */
  private drawStory(): void {
    const s = this.story;
    if (!s || s.t <= 0 || this.storyShown < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const lay = this.storyLayout(s);
    const splitT = s.dur * lay.split;
    const pi = lay.pages.length > 1 && s.t >= splitT ? 1 : 0;
    const pg = lay.pages[pi];
    // two pages cross-fade at the split
    const turn = lay.pages.length > 1 ? clamp(Math.abs(s.t - splitT) / 0.22) : 1;
    const w = L.story.w, h = Math.min(pg.h, Math.max(...lay.pages.map(p => p.h))), pad = 14 * u;
    const inK = ease.outBack(clamp(s.t / 0.35)), outK = clamp((s.dur - s.t) / 0.5);
    const x = this.mx - w / 2;
    const y = L.mode === 'wide' ? Math.max(L.story.y, Math.min(L.card.y - 20 * u, L.floorY - L.S * 1.3 - h)) : L.story.y;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK, this.storyShown);
    ctx.translate(this.mx, y);
    ctx.scale(0.92 + 0.08 * inK, 0.92 + 0.08 * inK);
    ctx.translate(-this.mx, -y);
    this.shade(x, y, w, h, 14 * u, 0.35);
    ctx.fillStyle = 'rgba(28,29,63,.95)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245,201,106,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = lay.titleFont;
    ctx.fillStyle = C.goldLight;
    ctx.fillText(lay.title, this.mx, y + pad * 0.8);
    ctx.globalAlpha *= turn;
    let ly = y + pad * 0.8 + Math.round(fontPx(20 * this.tu) * 1.3) + 4 * u;
    for (const l of pg.lines) {
      ly += l.gap;
      ctx.font = l.font;
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, this.mx, ly);
      ly += l.lh;
    }
    // two pages: two dots under the card's words
    if (lay.pages.length > 1) {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = i === pi ? C.goldLight : 'rgba(255,243,196,.3)';
        ctx.beginPath();
        ctx.arc(this.mx + (i - 0.5) * 12 * u, y + h - 7 * u, 2.6 * u, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ── the dawn ────────────────────────────────────────────────────
  private finale(sim: AniolSim): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const w = Math.max(L.card.w, Math.min(this.aw - 32, 300 * u)), pad = 12 * u;
    const sub = this.para(t('finale.sub'), w - 2 * pad, 13.5 * this.tu, MIN_READ, 2, 650, SANS);
    const subLh = Math.round(sub.size * 1.3);
    const h = 8 * u + 36 * this.tu + 34 * this.tu + sub.lines.length * subLh + pad;
    const x = L.mode === 'short' ? L.card.x : this.mx - w / 2, y = L.card.y, mx = x + w / 2;
    ctx.save();
    ctx.globalAlpha = this.finaleA;
    this.shade(x, y, w, h, 10 * u, 0.3);
    this.paper(x, y, w, h, 0.96);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    const title = t('finale.title');
    ctx.font = this.fit(title, w - 24 * u, this.F.big, 18);
    ctx.fillText(title, mx, y + 8 * u);
    const n = sim.nightStars;
    ctx.font = this.F.stars;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < n ? C.goldDeep : 'rgba(80,70,110,.25)';
      ctx.fillText('★', mx + (i - 1) * 28 * u, y + 8 * u + 36 * this.tu);
    }
    ctx.font = sub.font;
    ctx.fillStyle = C.textSoft;
    sub.lines.forEach((l, i) => ctx.fillText(l, mx, y + 8 * u + 70 * this.tu + i * subLh));
    ctx.restore();
  }

  // ── the choice of gifts ─────────────────────────────────────────
  /**
   * A level-up's three gifts.  On a phone upright a bottom sheet slides up with three full-width cards under the
   * thumb (the icon, the name, what it does); elsewhere a row of three cards near the bottom.  The first card is
   * taken by itself when the time runs out: its gold rim and the bar along its foot count down.
   */
  private choice(sim: AniolSim): void {
    const c = sim.choice;
    if (!c && this.choiceA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = this.choiceA;
    ctx.fillStyle = `rgba(14,12,34,${0.5 * a})`;
    ctx.fillRect(0, L.top - 6, L.w, L.h - L.top + 6);
    if (!c) return;
    const slide = (1 - ease.outCubic(clamp(c.t / 0.3))) * 40 * u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, slide);
    if (L.stacked) {
      const s = L.sheet;
      ctx.fillStyle = 'rgba(28,29,63,.96)';
      ctx.beginPath();
      ctx.roundRect(s.x, s.y, s.w, s.h, 18 * u);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,201,106,.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const title = t('level.title', { n: sim.nightLevel + 1 });
    ctx.font = this.fit(title, this.aw - 40 * u, F.choiceTitle, 15);
    this.rimmed(title, this.mx, L.sheetTitle + 4 * u, C.goldLight, 'rgba(14,12,34,.7)', 4);
    const left = Math.max(0, RULES.choiceSec - c.t);
    c.options.forEach((id, i) => {
      const g = giftById(id), r = L.gifts[i];
      const inK = ease.outBack(clamp((c.t - i * 0.06) / 0.28));
      const pressed = this.giftPress === i && this.giftPressT > 0 ? this.giftPressT / 0.35 : 0;
      const dy = (1 - inK) * 20 * u;
      ctx.save();
      ctx.globalAlpha = a * clamp(inK);
      const cx = r.x + r.w / 2, cy = r.y + dy + r.h / 2, sc = 1 - 0.04 * pressed;
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.translate(-cx, -cy);
      const y = r.y + dy;
      this.shade(r.x, y, r.w, r.h, 12 * u, 0.3);
      this.paper(r.x, y, r.w, r.h, 0.98, 12);
      ctx.strokeStyle = i === 0 ? `rgba(211,154,44,${0.75 + 0.25 * Math.sin(sim.t * 5)})` : 'rgba(160,140,190,.5)';
      ctx.lineWidth = i === 0 ? 2.5 : 1;
      ctx.beginPath();
      ctx.roundRect(r.x, y, r.w, r.h, 12 * u);
      ctx.stroke();
      if (pressed > 0) {
        ctx.fillStyle = `rgba(255,214,120,${0.3 * pressed})`;
        ctx.fill();
      }
      if (!this.touch) {
        ctx.fillStyle = 'rgba(80,70,110,.8)';
        ctx.font = F.giftKey;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(i + 1), r.x + 8 * u, y + 6 * u);
      }
      const words = this.giftWords(id, r);
      const lh = Math.round(words.body.size * 1.28);
      if (L.stacked) {
        // icon left, the name and what it does right of it
        const ir = Math.min(18 * u, r.h * 0.28);
        paintGiftIcon(ctx, id, r.x + 14 * u + ir + (this.touch ? 0 : 6 * u), y + r.h / 2, ir);
        const tx = r.x + 2 * ir + (this.touch ? 30 : 36) * u;
        const nameH = Math.round(fontPx(16 * this.tu) * 1.25);
        const blockH = nameH + 2 * u + words.body.lines.length * lh;
        let ty = y + (r.h - blockH) / 2;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = words.nameFont;
        ctx.fillStyle = C.text;
        ctx.fillText(g.name, tx, ty);
        ty += nameH + 2 * u;
        ctx.font = words.body.font;
        ctx.fillStyle = C.textSoft;
        words.body.lines.forEach((l, k) => ctx.fillText(l, tx, ty + k * lh));
      } else {
        const ir = Math.min(16 * u, r.h * 0.14);
        paintGiftIcon(ctx, id, cx, y + 12 * u + ir, ir);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = C.text;
        const nameY = y + 18 * u + 2 * ir;
        ctx.font = words.nameFont;
        ctx.fillText(g.name, cx, nameY);
        const textY = nameY + Math.round(fontPx(16 * this.tu) * 1.3);
        ctx.font = words.body.font;
        ctx.fillStyle = C.textSoft;
        words.body.lines.forEach((l, k) => ctx.fillText(l, cx, textY + k * lh));
      }
      ctx.restore();
    });
    // the countdown: a bar along the first card's foot, and the words under the cards
    const r0 = L.gifts[0];
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(r0.x + 10 * u, r0.y + r0.h - 6 * u, (r0.w - 20 * u) * clamp(left / RULES.choiceSec), 3 * u);
    const last = L.gifts[2];
    const hint = t(this.touch ? 'level.hint' : 'level.hint.keys', { n: Math.ceil(left) });
    const hy = (L.stacked ? last.y + last.h : Math.max(...L.gifts.map(g => g.y + g.h))) + 7 * u;
    ctx.font = this.fit(hint, this.aw - 32, F.small);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (hy + 14 * u < L.h - L.ins.bottom) this.rimmed(hint, this.mx, hy, 'rgba(255,248,230,.95)', 'rgba(14,12,34,.6)');
    ctx.restore();
  }
}

/** A chevron (a rounded triangle) at (x, y) pointing left (−1) or right (+1), `s` px from its centre to its tip. */
function chevron(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: -1 | 1, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, s * 0.28);
  ctx.beginPath();
  ctx.moveTo(x + dir * s, y);
  ctx.lineTo(x - dir * s * 0.55, y - s * 0.9);
  ctx.lineTo(x - dir * s * 0.55, y + s * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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
