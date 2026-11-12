/**
 * Zastępy's own HUD on the play canvas — only what belongs to the game (the runner draws the Mendi panel, the
 * score corner and the coach marks), laid out by layout.ts phone first (DESIGN §8.3 "Mobile first", §12):
 *
 *   under the HUD (passive)  the gates' bar — the gate of light's walls on the left, the gate of ash's (or the
 *                            boss's life) on the right, each with its number, the chapter's five battles between
 *                            them — Tymek's portrait and bubble, and the coming wave's kinds ("Nadchodzą")
 *   along the road           the banners (the band's last 40 s: gold above the threshold, cool in a Cisza, a
 *                            broken pole without signal, fog over a blind block, the lag bracket at "now")
 *   the thumb zone           the light's row — the lantern, drawn large, whose arc is what focus drives with
 *                            the threshold at its top (or, in a Cisza, the calm that mends), the stream of motes
 *                            out of it, the light bar, the pillar's and the trumpet's buttons — and the unit
 *                            cards: the shade each is the bane of, ×2 and lifted when that shade comes, the
 *                            price, the cooldown
 *   over the play            the toasts and the words over the road, the stars of a battle won, the card between
 *                            battles (a bottom sheet of stacked offers on a phone), the story cards, the evening
 *
 * No text under 11 px (paint.ts `font`), what the player reads to play at 13 px and up; key badges only for a
 * keyboard; glows are sprites and double strokes, never a per-frame shadowBlur.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT, hits } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { LAG_SEC, traceBars } from '../kit/trace';
import type { TapTarget } from '../kit/types';
import { AGES, AGE_STORY, DEMON_NAME, HOST_NAME } from './content';
import { t } from './i18n';
import { cardAt, discRect, tapTargets, type Layout, type Rect } from './layout';
import {
  ageOf, bossOf, chapterOf, flowFor, gateLevel, heroLevel, isBossBattle, pillarFor, unitLevel, unitStats, wallsFor,
} from './meta';
import { C, POSE, SANS, SERIF, coin, font, gateGlyph, glow, lightDrop, paintDemon, paintHost, paintLightGate, paintTrumpet, paintTymek, star, type Pose } from './paint';
import { BANE, HOST, HOST_IDS, RULES, type HostId, type WaveId } from './rules';
import type { Offer, ZastepySim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Toast { title: string; sub: string; color: string; t: number; dur: number }
interface Story { kind: 'open' | 'age'; age: number; t: number; out: number }

export type Hit =
  | { kind: 'card'; id: HostId } | { kind: 'locked'; id: HostId } | { kind: 'trumpet' } | { kind: 'pillar' }
  | { kind: 'offer'; i: number } | { kind: 'go' } | { kind: 'story' } | { kind: 'none' };

const TXT = {
  walls: t('hud.walls'), soon: t('hud.soon'),
  finaleTitle: t('finale.title'), finaleSub: t('finale.sub'), upTitle: t('up.title'), upGo: t('up.go'),
  storyTap: t('story.tap'), storyTapKeys: t('story.tap.keys'), openTitle: t('story.openTitle'), openText: t('story.open'),
};

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly toasts: Toast[] = [];
  private F = Hud.fontsFor(1);
  private clock = 0;
  private readonly lag: number;
  private readonly lagLabel: string;
  private readonly shakeT = new Map<HostId, number>();
  private readonly pressT = new Map<HostId, number>();
  private trumpetPop = 0;
  private pillarPop = 0;
  /** a press on a round button (its squash), a shake when it is not ready */
  private readonly btnPress = { pillar: 0, trumpet: 0 };
  private readonly btnShake = { pillar: 0, trumpet: 0 };
  private boughtT = 0;
  private finaleA = 0;
  private upA = 0;
  /** the gates' bar flashes where a gate is struck */
  private wallHit = 0;
  private ashHit = 0;
  private readonly pose: Pose = { ...POSE };
  /** the stream's motes from the lantern into the bar (or into the walls in a Cisza) */
  private readonly motes: { k: number; v: number; rest: boolean }[] = [];
  private moteAcc = 0;
  /** where the walls' fill ends in the gates' bar (the Cisza's motes fly there) */
  private wallsAt = { x: 0, y: 0 };
  /** the lantern's shown value (eased) */
  private lamp = 0;
  /** Tymek's line */
  private bubble: { text: string; t: number; dur: number } | null = null;
  private story: Story | null = null;
  private verse: PassageLayout | null = null;
  private verseKey = '';
  /** the box of the story card while it shows (a tap anywhere closes it) */
  storyRect: Rect | null = null;
  /** the right edge the coming wave's box hangs from (the view sets it over the gate of ash) */
  soonX: number | null = null;
  /** the stars of a battle won, popping in (s since, how many) */
  private stars: { t: number; n: number; fresh: number } | null = null;
  /** the cards' backgrounds for this layout (open, hot, locked) */
  private grads = new Map<string, CanvasGradient>();
  /** each card's unit, painted once per card size and age (a static layer, not ~50 paths a card a frame) */
  private sprites = new Map<string, HTMLCanvasElement | null>();
  private dpr = 1;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  /** The sizes at u = 1 are for a 360 px phone: nothing under 11 px, what is read to play at 13 and up. */
  private static fontsFor(u: number) {
    return {
      wall: font(800, 13 * u, SANS), title: font(500, 18 * u, SERIF, true), sub: font(650, 13.5 * u, SANS),
      big: font(500, 26 * u, SERIF, true), tag: font(750, 12 * u, SANS), soon: font(800, 13 * u, SANS), key: font(800, 11 * u, SANS),
      cost: font(800, 15 * u, SANS), count: font(800, 14 * u, SANS), mult: font(850, 15 * u, SANS), lamp: font(800, 13 * u, SANS),
      bane: font(850, 13 * u, SANS), upName: font(750, 15 * u, SANS), upNums: font(600, 13 * u, SANS), price: font(800, 15 * u, SANS),
      btn: font(800, 15 * u, SANS), map: font(700, 13 * u, SANS), say: font(600, 14 * u, SANS), ask: font(800, 18 * u, SANS),
      storyTitle: font(500, 22 * u, SERIF, true), storyText: font(560, 15 * u, SANS), storyTap: font(650, 13 * u, SANS),
    };
  }

  resize(L: Layout, dpr = 1): void {
    this.L = L;
    this.dpr = Math.max(1, Math.min(3, dpr));
    this.F = Hud.fontsFor(L.u);
    this.verse = null;
    this.grads.clear();
    this.sprites.clear();
  }

  /** A card's unit as a sprite of the card's size (null where there is no document: tests, workers). */
  private unitSprite(id: HostId, w: number, h: number, x: number, y: number, s: number, age: number): HTMLCanvasElement | null {
    const key = `${id}|${Math.round(w)}x${Math.round(h)}|${age}`;
    let c = this.sprites.get(key);
    if (c === undefined) {
      c = null;
      if (typeof document !== 'undefined') {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.ceil(w * this.dpr));
        cv.height = Math.max(1, Math.ceil(h * this.dpr));
        const g = cv.getContext('2d');
        if (g) {
          g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
          paintHost(g, id, x, y, s, { ...POSE, age, seed: HOST_IDS.indexOf(id), walk: 0 });
          c = cv;
        }
      }
      this.sprites.set(key, c);
    }
    return c;
  }

  get layout(): Layout { return this.L; }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const L = this.L, u = L.u;
    x = clamp(x, L.left + 36 * u, L.right - 36 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, Math.max(MIN_READ, size * u), SANS), rise: rise * u });
    if (this.floats.length > 18) this.floats.shift();
  }

  shiftFloats(dx: number): void { for (const f of this.floats) f.x += dx; }
  shakeCard(id: HostId): void { this.shakeT.set(id, 0.35); }
  pressCard(id: HostId): void { this.pressT.set(id, 0.25); }
  popTrumpet(): void { this.trumpetPop = 1; }
  popPillar(): void { this.pillarPop = 1; }
  /** a finger came down on a round button: it squashes; `ready` false shakes it */
  pressButton(which: 'pillar' | 'trumpet', ready: boolean): void {
    this.btnPress[which] = 1;
    if (!ready) this.btnShake[which] = 0.35;
  }
  gateHit(side: 1 | -1): void {
    if (side === 1) this.wallHit = 1;
    else this.ashHit = 1;
  }
  bought(): void { this.boughtT = 1; }
  say(text: string, dur: number): void { this.bubble = { text, t: 0, dur }; }
  showStars(n: number, fresh: number): void { this.stars = { t: 0, n, fresh }; }

  toast(title: string, sub: string, color: string = C.ink, dur = 2.4): void {
    this.toasts.push({ title, sub, color, t: 0, dur });
    if (this.toasts.length > 3) this.toasts.splice(0, this.toasts.length - 3);
    const head = this.toasts[0];
    if (this.toasts.length > 1) head.dur = Math.min(head.dur, Math.max(1.2, head.t) + 0.3);
  }

  showStory(kind: 'open' | 'age', age: number): void { this.story = { kind, age, t: 0, out: 0 }; }

  /** A tap hides a story card shown for a moment already; true when one is up (the tap is used up). */
  hideStory(): boolean {
    const s = this.story;
    if (!s) return false;
    if (s.t < (s.kind === 'open' ? 2 : 1.2) || s.out > 0) return true;
    s.out = 0.001;
    return true;
  }

  get storyOn(): boolean { return this.story !== null; }

  /** The card between battles is up (and takes the taps). */
  upOn(sim: ZastepySim): boolean { return sim.stage === 'upgrade' && this.upA > 0.5; }

  update(dt: number, sim: ZastepySim): void {
    this.clock += dt;
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.toasts[0];
    if (head && (head.t += dt) >= head.dur) {
      this.toasts.shift();
      const next = this.toasts[0];
      if (next && this.toasts.length > 1) next.dur = Math.min(next.dur, 2);
    }
    for (const m of [this.shakeT, this.pressT]) for (const [k, v] of m) (v - dt <= 0 ? m.delete(k) : m.set(k, v - dt));
    this.trumpetPop = Math.max(0, this.trumpetPop - dt * 1.5);
    this.pillarPop = Math.max(0, this.pillarPop - dt * 1.5);
    for (const k of ['pillar', 'trumpet'] as const) {
      this.btnPress[k] = Math.max(0, this.btnPress[k] - dt * 5);
      this.btnShake[k] = Math.max(0, this.btnShake[k] - dt);
    }
    this.wallHit = Math.max(0, this.wallHit - dt * 4);
    this.ashHit = Math.max(0, this.ashHit - dt * 4);
    this.boughtT = Math.max(0, this.boughtT - dt * 1.2);
    this.finaleA = approach(this.finaleA, sim.phase !== 'play' ? 1 : 0, dt, 0.4);
    this.upA = approach(this.upA, sim.stage === 'upgrade' && sim.phase === 'play' ? 1 : 0, dt, 0.12);
    if (this.bubble && (this.bubble.t += dt) >= this.bubble.dur) this.bubble = null;
    if (this.stars && (this.stars.t += dt) >= 2.6) this.stars = null;
    const s = this.story;
    if (s) {
      s.t += dt;
      if (s.out > 0) s.out += dt / 0.35;
      if (s.t > (s.kind === 'open' ? 9 : 6) && s.out === 0) s.out = 0.001;
      if (s.out >= 1) this.story = null;
    }
    // the lantern: what the band drives right now, eased
    const want = this.lampValue(sim);
    this.lamp = approach(this.lamp, want ?? 0.5, dt, 0.18);
    // the stream: motes leave the lantern as fast as the band drives
    const b = sim.battle;
    const rest = sim.calmNow > 0;
    const rate = rest ? 3 + sim.calmNow * 10 : sim.stage === 'battle' && b.light < b.lightMax ? 2 + (sim.mult - 1) * 10 : 0;
    this.moteAcc += rate * dt;
    while (this.moteAcc >= 1) {
      this.moteAcc -= 1;
      if (this.motes.length < 40) this.motes.push({ k: 0, v: (0.9 + (rest ? 0.2 : (sim.mult - 1) * 0.8)) * (rest ? 0.7 : 1), rest });
    }
    let m = 0;
    for (const o of this.motes) if ((o.k += dt * o.v) < 1) this.motes[m++] = o;
    this.motes.length = m;
  }

  /** The lantern's value: the level in a Natarcie (and the warm-up), the calm in a Cisza; null when hidden. */
  private lampValue(sim: ZastepySim): number | null {
    if (!sim.reliable || sim.blind) return null;
    return sim.restBlock ? sim.calm : sim.level;
  }

  /** Over the world: the gates' bar, the light's row, the cards, the words, the bubble, the coming wave, the cards of the story. */
  draw(sim: ZastepySim): void {
    this.gatesBar(sim);
    this.row(sim);
    this.cardsRow(sim);
    this.drawFloats();
    this.drawStars();
    this.drawToast();
    const bubble = this.drawBubble();
    this.drawSoon(sim, bubble);
    this.upgrade(sim);
    this.finale();
    this.drawStory();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private vellum(x: number, y: number, w: number, h: number, a = 0.88, r = 10): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,248,232,${a})`;
    ctx.strokeStyle = 'rgba(185,127,31,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r * this.L.u, h / 2, w / 2));
    ctx.fill();
    ctx.stroke();
  }

  /** A soft drop shadow under a card (an offset translucent box; no shadowBlur). */
  private dropShadow(x: number, y: number, w: number, h: number, r: number, a = 0.18): void {
    const ctx = this.ctx, u = this.L.u;
    ctx.fillStyle = `rgba(40,30,20,${a})`;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 4 * u, w, h, r * u);
    ctx.fill();
    ctx.fillStyle = `rgba(40,30,20,${a * 0.5})`;
    ctx.beginPath();
    ctx.roundRect(x - 2, y + 1 * u, w + 4, h + 6 * u, r * u + 2);
    ctx.fill();
  }

  /**
   * Set the font so `text` fits `maxW`: from `px` down to `min` (italic kept), then cut it with "…".  Returns
   * what to draw (kit/mobile `fitText`, with the italic serif of the titles).
   */
  private fitIn(text: string, maxW: number, px: number, weight: number, family: string, min = MIN_READ, italic = false): string {
    const ctx = this.ctx;
    let size = Math.max(min, px);
    ctx.font = font(weight, size, family, italic);
    let w = ctx.measureText(text).width;
    while (w > maxW && size > min) {
      size = Math.max(min, Math.min(size - 0.5, Math.floor((size * maxW) / w * 10) / 10));
      ctx.font = font(weight, size, family, italic);
      w = ctx.measureText(text).width;
    }
    if (w <= maxW || !text) return text;
    let lo = 0, hi = text.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid; else hi = mid - 1;
    }
    return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
  }

  private lines(text: string, maxW: number, f: string, max: number): string[] {
    this.ctx.font = f;
    const out = wrap(this.ctx, text, maxW);
    if (out.length > max) {
      out.length = max;
      out[max - 1] = `${out[max - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    return out;
  }

  /** Text with a light plate around its letters (numbers over a bar, tags over the sky). */
  private plated(text: string, x: number, y: number, fill: string, plate = 'rgba(255,248,232,.9)', w = 3): void {
    const ctx = this.ctx;
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    ctx.strokeStyle = plate;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  // ── the gates' bar: both gates' walls with their numbers, the chapter between them ─────────
  private gatesBar(sim: ZastepySim): void {
    if (this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, r = L.bar, b = sim.battle;
    this.vellum(r.x, r.y, r.w, r.h, 0.88, r.h / 2);
    const at = chapterOf(b.battle);
    const boss = isBossBattle(b.battle);
    const gy = r.y + r.h / 2, gs = r.h * 0.74;
    // the chapter's five battles in the middle: where this one is
    const dots = RULES.chapter, dx = 9 * u, dotsW = (dots - 1) * dx;
    const mid = r.x + r.w / 2;
    for (let i = 0; i < dots; i++) {
      const bb = at.chapter * dots + i, here = bb === b.battle, done = bb < sim.p.battle && bb !== b.battle;
      ctx.fillStyle = i === dots - 1 ? (done ? C.goldDeep : '#3a2c3c') : done ? C.gold : here ? '#fff1c9' : 'rgba(42,31,46,.2)';
      ctx.beginPath();
      ctx.arc(mid - dotsW / 2 + i * dx, gy, (here ? 3.8 : 2.8) * u, 0, Math.PI * 2);
      ctx.fill();
      if (here) {
        ctx.strokeStyle = C.goldDeep;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    const inner = dotsW / 2 + 10 * u;
    const bh = Math.max(14, r.h * 0.56);
    // the gate of light: the walls, gold (red when low, blue while calm mends them), the number on them
    gateGlyph(ctx, 'light', r.x + 6 * u + gs * 0.32, gy + gs / 2, gs);
    const lx0 = r.x + 10 * u + gs * 0.64, lx1 = mid - inner;
    const wk = clamp(b.walls / b.wallsMax);
    const mend = sim.restBlock && sim.calmNow > 0;
    this.barTrack(lx0, gy - bh / 2, lx1 - lx0, bh, wk, wk < 0.3 ? '#c2552c' : mend ? '#7fa6e0' : '#d8b979', false);
    this.wallsAt = { x: lx0 + Math.max(bh, (lx1 - lx0) * wk), y: gy };
    if (mend) {
      const sh = (this.clock * 0.8) % 1;
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(lx0 + (lx1 - lx0) * wk * sh - 6 * u, gy - bh / 2, 12 * u, bh);
    }
    if (this.wallHit > 0) {
      ctx.fillStyle = `rgba(194,85,44,${0.35 * this.wallHit})`;
      ctx.beginPath();
      ctx.roundRect(lx0, gy - bh / 2, lx1 - lx0, bh, bh / 2);
      ctx.fill();
    }
    const walls = fmtNum(Math.ceil(b.walls));
    const wl = `${TXT.walls} ${walls}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = F.wall;
    const wText = ctx.measureText(wl).width <= lx1 - lx0 - 12 * u ? wl : this.fitIn(walls, lx1 - lx0 - 10 * u, 13 * u, 800, SANS, MIN_TEXT);
    this.plated(wText, lx0 + 6 * u, gy + 0.5, wk < 0.3 ? '#7a2010' : C.ink);
    // the gate of ash: its walls (ember), or the boss's life with its name while the gate is sealed
    gateGlyph(ctx, 'ash', r.x + r.w - 6 * u - gs * 0.35, gy + gs / 2, gs);
    const ax0 = mid + inner, ax1 = r.x + r.w - 10 * u - gs * 0.7;
    const k = boss ? (b.boss ? clamp(b.boss.hp / b.boss.maxHp) : 1) : clamp(b.ash / b.ashMax);
    this.barTrack(ax0, gy - bh / 2, ax1 - ax0, bh, k, boss ? '#a8361c' : '#b5502c', true);
    if (this.ashHit > 0) {
      ctx.fillStyle = `rgba(255,224,138,${0.4 * this.ashHit})`;
      ctx.beginPath();
      ctx.roundRect(ax0, gy - bh / 2, ax1 - ax0, bh, bh / 2);
      ctx.fill();
    }
    const label = boss ? DEMON_NAME[bossOf(b.battle)] : fmtNum(Math.ceil(b.ash));
    ctx.textAlign = 'right';
    ctx.font = F.wall;
    const aText = this.fitIn(label, ax1 - ax0 - 10 * u, 13 * u, 800, SANS, MIN_TEXT);
    this.plated(aText, ax1 - 6 * u, gy + 0.5, '#fff6ea', 'rgba(60,30,40,.75)');
  }

  /** A rounded bar's track and fill (from the right when `fromRight`: the gate of ash's side). */
  private barTrack(x: number, y: number, w: number, h: number, k: number, color: string, fromRight: boolean): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(42,31,46,.14)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    const fw = Math.max(h, w * k);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(fromRight ? x + w - fw : x, y, fw, h, h / 2);
    ctx.fill();
  }

  // ── the banners along the road: the band's last 40 s ───────────
  /** Drawn by the view between the road's far edge and the fighters. */
  banners(sim: ZastepySim, x0 = this.L.banners.x0, x1 = this.L.banners.x1): void {
    const ctx = this.ctx, L = this.L, u = L.u, B = { ...L.banners, x0, x1 };
    const span = B.x1 - B.x0;
    if (span < 60) return;
    // as many banners as the screen's width holds (not the span: a gate coming into view squeezes them, never
    // changes their count)
    const n = Math.round(clamp((L.banners.x1 - L.banners.x0) / (24 * u), 12, 34));
    const bars = traceBars(sim.trace, sim.t, n);
    const step = span / n;
    const foot = B.y, top = B.y - B.h;
    const hOf = (lv: number) => B.h * (0.28 + 0.72 * clamp(lv));
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty || b.phase !== 'rest') continue;
      ctx.fillStyle = 'rgba(143,179,232,.16)';
      ctx.fillRect(B.x0 + i * step, top - 4 * u, step + 0.5, B.h + 4 * u);
    }
    // the threshold: a dashed line where a banner of level 0.5 reaches
    const ty = foot - hOf(0.5);
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(B.x0, ty);
    ctx.lineTo(B.x1, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    const wave = this.clock * 3;
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty) continue;
      const x = B.x0 + (i + 0.5) * step;
      if (!b.reliable) {
        // no signal: a broken stump and a dotted foot — never a low value
        ctx.strokeStyle = 'rgba(120,108,104,.7)';
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(x, foot);
        ctx.lineTo(x, foot - B.h * 0.18);
        ctx.lineTo(x + 3 * u, foot - B.h * 0.24);
        ctx.stroke();
        ctx.setLineDash([1.5, 3]);
        ctx.beginPath();
        ctx.moveTo(x - step / 2 + 2, foot - 1);
        ctx.lineTo(x + step / 2 - 2, foot - 1);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const ph = b.phase === 'rest';
      const hh = hOf(b.level);
      ctx.globalAlpha = b.shown;
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.beginPath();
      ctx.moveTo(x, foot);
      ctx.lineTo(x, foot - hh);
      ctx.stroke();
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(x, foot - hh, 2.2 * u, 0, Math.PI * 2);
      ctx.fill();
      const above = b.above;
      const pw = Math.min(step * 0.8, 16 * u), ph2 = Math.min(10 * u, B.h * 0.22);
      const wv = Math.sin(wave + i * 0.7) * 2 * u;
      ctx.fillStyle = above ? (ph ? '#d9c27a' : C.gold) : ph ? '#bcd0ee' : '#fbf3df';
      ctx.strokeStyle = above ? C.goldDeep : ph ? '#6f8fbf' : 'rgba(150,130,100,.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, foot - hh + 2 * u);
      ctx.quadraticCurveTo(x + pw * 0.5, foot - hh + 2 * u + wv, x + pw, foot - hh + 2 * u + ph2 * 0.5 + wv * 0.5);
      ctx.quadraticCurveTo(x + pw * 0.5, foot - hh + 2 * u + ph2 + wv, x, foot - hh + 2 * u + ph2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // the veil: fog over what a blind block hides (it lifts when the block ends)
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty || b.shown >= 1) continue;
      ctx.fillStyle = `rgba(106,90,140,${0.82 * (1 - b.shown)})`;
      ctx.beginPath();
      ctx.roundRect(B.x0 + i * step - 1, top - 4 * u, step + 2, B.h + 4 * u, 4 * u);
      ctx.fill();
    }
    // the lag bracket at "now": what you do now shows there
    const lx1 = B.x1 - step / 2, lx0 = lx1 - (this.lag / sim.trace.windowSec) * span;
    const by = top - 8 * u;
    ctx.strokeStyle = 'rgba(42,31,46,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx0, by + 5 * u);
    ctx.lineTo(lx0, by);
    ctx.lineTo(lx1, by);
    ctx.lineTo(lx1, by + 5 * u);
    ctx.stroke();
    ctx.font = this.F.tag;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    this.plated(this.lagLabel, lx0 - 4 * u, by, 'rgba(42,31,46,.9)', 'rgba(255,248,232,.9)', 3.5);
  }

  // ── the coming wave: "Nadchodzą" and an icon of each kind, under the gates' bar on the right ─────
  private drawSoon(sim: ZastepySim, bubble: Rect | null): void {
    const kinds = sim.battle.nextWave;
    if (!kinds || !kinds.length || sim.stage !== 'battle' || this.story || this.upA > 0.5) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const uniq = [...new Set(kinds)];
    const sz = L.soon.icon, gap = 5 * u, pad = 7 * u;
    ctx.font = this.F.soon;
    const tw = ctx.measureText(TXT.soon).width;
    const w = Math.max(tw + 2 * pad, uniq.length * (sz + gap) - gap + 2 * pad);
    const h = 18 * u + sz + pad;
    const right = Math.min(this.soonX ?? L.soon.x, L.soon.x);
    const bx = clamp(right - w, L.left, L.right - w);
    let by = L.soon.y;
    // Tymek talks across the top: the wave's box steps down under his bubble rather than over his words
    if (bubble && bx < bubble.x + bubble.w + 4 && by < bubble.y + bubble.h + 4) by = bubble.y + bubble.h + 6 * u;
    const pulse = 0.88 + 0.12 * Math.sin(this.clock * 6);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(42,31,46,.78)';
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, 8 * u);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffd9b0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.soon, bx + w / 2, by + 10 * u);
    const iw = uniq.length * (sz + gap) - gap;
    uniq.forEach((k, i) => {
      const cx = bx + (w - iw) / 2 + i * (sz + gap) + sz / 2;
      const cy = by + 18 * u + sz / 2;
      this.pose.t = this.clock;
      this.pose.seed = i;
      this.pose.walk = 0;
      this.pose.age = 0;
      ctx.fillStyle = 'rgba(255,236,210,.2)';
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      paintDemon(ctx, k, cx, cy + sz / 2 - 2 * u, sz / (k === 'cien' || k === 'bestia' || k === 'miotacz' ? 1.75 : 1.2), this.pose);
    });
    ctx.restore();
  }

  // ── the light's row: the lantern, the light, the pillar, the trumpet ─
  private row(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const lr = L.light, R = L.row;
    const blind = sim.blind;
    const live = sim.sighted && sim.reliable;
    // the vellum under the row (on its side the strip's parts stand on their own)
    if (!L.short) this.vellum(R.x, R.y, R.w, R.h, 0.82, 14);
    this.lantern(sim, live);
    // the stream: motes from the lantern into what it drives (the light bar; the walls in the gates' bar in a Cisza)
    const A = L.lantern;
    for (const m of this.motes) {
      const tx = m.rest ? this.wallsAt.x : lr.x + clamp(b.light / b.lightMax) * lr.w;
      const ty2 = m.rest ? this.wallsAt.y : lr.y + lr.h / 2;
      const e = ease.inOutSine(m.k);
      const arc = m.rest ? Math.sin(m.k * Math.PI) * 30 * u : Math.sin(m.k * Math.PI) * 14 * u;
      const x = A.x + (tx - A.x) * e + (m.rest ? arc : 0), y = A.y - A.r * 0.2 + (ty2 - A.y + A.r * 0.2) * e - (m.rest ? 0 : arc);
      ctx.fillStyle = m.rest ? `rgba(160,195,255,${1 - m.k * 0.4})` : `rgba(255,214,110,${1 - m.k * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, (m.rest ? 2.4 : 2.8) * u, 0, Math.PI * 2);
      ctx.fill();
    }
    // the light bar, with ticks at the open cards' prices
    const lk = clamp(b.light / b.lightMax);
    ctx.fillStyle = 'rgba(42,31,46,.14)';
    ctx.beginPath();
    ctx.roundRect(lr.x, lr.y, lr.w, lr.h, lr.h / 2);
    ctx.fill();
    if (L.short) {
      ctx.strokeStyle = 'rgba(185,127,31,.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    const lg = ctx.createLinearGradient(lr.x, 0, lr.x + lr.w, 0);
    lg.addColorStop(0, '#ffe9a8');
    lg.addColorStop(1, live && sim.mult > 1.02 ? '#ffc23a' : C.gold);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(lr.x, lr.y, Math.max(lr.h, lr.w * lk), lr.h, lr.h / 2);
    ctx.fill();
    if (b.light > b.lightMax) {
      // overfilled (a blind block's pay): a halo stroke, then the gold line
      ctx.strokeStyle = 'rgba(255,214,110,.45)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = C.goldLight;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(42,31,46,.35)';
    ctx.lineWidth = 1;
    for (const id of sim.cards) {
      const x = lr.x + lr.w * clamp(HOST[id].cost / b.lightMax);
      ctx.beginPath();
      ctx.moveTo(x, lr.y + 2);
      ctx.lineTo(x, lr.y + lr.h - 2);
      ctx.stroke();
    }
    const dr = Math.min(lr.h * 0.3, 6 * u);
    lightDrop(ctx, lr.x + lr.h * 0.55, lr.y + lr.h / 2 + 1 * u, dr);
    ctx.font = F.count;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    this.plated(String(Math.floor(b.light)), lr.x + lr.h * 0.55 + dr + 5 * u, lr.y + lr.h / 2 + 0.5, C.ink, 'rgba(255,248,232,.85)');
    // the flow's multiplier at the bar's end (×1 in grey: never below)
    const on = live && sim.mult > 1.02;
    const mx = on ? `×${fmtNum(sim.mult, 1)}` : blind ? '×?' : '×1';
    ctx.textAlign = 'right';
    ctx.font = on ? F.mult : F.count;
    this.plated(mx, lr.x + lr.w - lr.h * 0.4, lr.y + lr.h / 2 + 0.5, on ? '#8a5a08' : 'rgba(42,31,46,.6)', 'rgba(255,248,232,.8)');
    this.pillarBtn(sim);
    this.trumpetBtn(sim, live);
  }

  /**
   * The lantern: the large gauge of what the band drives.  Its arc runs from the lower left over the top to
   * the lower right; the threshold is the tick at its top (0.5), gold above it.  In a Natarcie its flame is the
   * stream's strength (×1 … ×2,2 under it); in a Cisza the arc turns blue (the calm that mends the walls); a
   * blind block fogs it; without a signal it rests grey, never low.
   */
  private lantern(sim: ZastepySim, live: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, A = L.lantern;
    const rest = sim.restBlock, blind = sim.blind, has = sim.reliable && !blind;
    const v = has ? this.lamp : 0;
    const above = has && v >= 0.5;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    if (above && (live || rest)) glow(ctx, A.x, A.y, A.r * 1.45, rest ? '150,190,255' : '255,200,80', 0.55);
    // the disc
    const bg = ctx.createRadialGradient(A.x, A.y - A.r * 0.3, 0, A.x, A.y, A.r);
    bg.addColorStop(0, rest ? '#eef3ff' : '#fffaf0');
    bg.addColorStop(1, rest ? '#c9d7f2' : '#f3e0b5');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(A.x, A.y, A.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the track and the fill
    const rr = A.r * 0.8, lw = Math.max(5, A.r * 0.2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(42,31,46,.16)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(A.x, A.y, rr, a0, a1);
    ctx.stroke();
    if (has) {
      ctx.strokeStyle = rest ? (above ? '#5f86c9' : '#9fb3d6') : above ? '#e8a21c' : '#d9c79c';
      ctx.beginPath();
      ctx.arc(A.x, A.y, rr, a0, a0 + (a1 - a0) * clamp(v));
      ctx.stroke();
    }
    // the threshold tick at the top
    ctx.strokeStyle = rest ? C.blueDeep : C.goldDeep;
    ctx.lineWidth = Math.max(2, 2.4 * u);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(A.x, A.y - rr - lw * 0.9);
    ctx.lineTo(A.x, A.y - rr + lw * 0.9);
    ctx.stroke();
    // the heart: a flame as big as the stream (Natarcie), a wall stone (Cisza), fog (blind)
    const k = clamp((sim.mult - 1) / (RULES.flowTop - 1));
    if (blind) {
      ctx.fillStyle = 'rgba(106,90,140,.85)';
      ctx.beginPath();
      ctx.arc(A.x, A.y, A.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2ecff';
      ctx.font = this.F.ask;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', A.x, A.y + 1);
    } else if (rest) {
      const s = A.r * 0.22, c = sim.calmNow;
      ctx.fillStyle = c > 0 ? '#7fa6e0' : '#b8c3d8';
      for (let i = 0; i < 3; i++) {
        const row = i === 2 ? 1 : 0;
        ctx.fillRect(A.x - s * 1.05 + (i % 2) * s * 1.1 + row * s * 0.55, A.y - s * 0.6 + row * -s * 0.8, s, s * 0.7);
      }
      if (c > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.abs(Math.sin(this.clock * 3))})`;
        ctx.fillRect(A.x - s * 1.05, A.y - s * 1.4, s * 2.2, s * 1.5);
      }
    } else {
      const fh = A.r * (0.3 + 0.34 * k + 0.04 * Math.sin(this.clock * 9));
      const fx = A.x, fy = A.y + A.r * 0.08;
      const fg = ctx.createRadialGradient(fx, fy - fh * 0.4, 0, fx, fy - fh * 0.4, fh);
      fg.addColorStop(0, '#fffdf0');
      fg.addColorStop(0.5, live && k > 0 ? '#ffd27a' : '#f6e2b0');
      fg.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - fh * 0.42, fy);
      ctx.quadraticCurveTo(fx - fh * 0.2, fy - fh * 1.1, fx, fy - fh * 1.25);
      ctx.quadraticCurveTo(fx + fh * 0.2, fy - fh * 1.1, fx + fh * 0.42, fy);
      ctx.quadraticCurveTo(fx, fy + fh * 0.25, fx - fh * 0.42, fy);
      ctx.fill();
    }
    // the number under it: ×n (or +n/s for the walls); a small lantern leaves it to the light bar's end
    const mendS = RULES.mend * sim.calmNow * sim.battle.wallsMax;
    const txt = blind || A.r < 24 ? '' : rest ? (mendS >= 0.5 ? `+${fmtNum(mendS, 0)}/s` : '') : live ? `×${fmtNum(sim.mult, 1)}` : '';
    if (txt) {
      ctx.font = this.F.lamp;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.plated(txt, A.x, A.y + A.r * 0.56, rest ? C.blueDeep : '#8a5a08', 'rgba(255,250,238,.9)');
    }
  }

  /** A key's badge at a button's shoulder — for a keyboard only (a finger never hears of keys). */
  private keyBadge(key: string, x: number, y: number, on: boolean): void {
    if (this.L.touch) return;
    const ctx = this.ctx, u = this.L.u;
    ctx.fillStyle = on ? C.goldDeep : 'rgba(42,31,46,.6)';
    ctx.beginPath();
    ctx.arc(x, y, 9 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.font = this.F.key;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(key, x, y + 0.5);
  }

  private pillarBtn(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, P = L.pillar, b = sim.battle;
    const ready = b.pillarReady && sim.stage === 'battle';
    const standing = b.pillar;
    const pulse = ready ? 0.5 + 0.5 * Math.sin(this.clock * 5) : 0;
    const k = 1 + this.pillarPop * 0.18 + pulse * 0.03 - this.btnPress.pillar * 0.1;
    const shake = this.btnShake.pillar > 0 ? Math.sin(this.btnShake.pillar * 60) * this.btnShake.pillar * 8 * u : 0;
    if (ready) glow(ctx, P.x, P.y, P.r * 1.55, '255,240,200', 0.6 + pulse * 0.4);
    ctx.save();
    ctx.translate(P.x + shake, P.y);
    ctx.scale(k, k);
    ctx.fillStyle = ready ? '#ffffff' : 'rgba(255,248,232,.9)';
    ctx.beginPath();
    ctx.arc(0, 0, P.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ready ? 'rgba(208,178,106,.9)' : 'rgba(185,127,31,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the ring: the cooldown (or the time it still stands)
    const ring = standing ? clamp(standing.t / standing.sec) : 1 - clamp(b.pillarCd / Math.max(0.01, b.pillarStats.cool));
    const rr = P.r - 4 * u;
    ctx.strokeStyle = 'rgba(42,31,46,.14)';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = standing ? C.gold : ready ? '#d0b26a' : 'rgba(150,130,100,.75)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
    ctx.stroke();
    // the cloud column icon
    ctx.fillStyle = ready || standing ? '#efe4cc' : 'rgba(200,190,170,.85)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(Math.sin(i * 2 + this.clock * (ready ? 2 : 0)) * P.r * 0.08, P.r * (0.35 - i * 0.22), P.r * (0.26 - i * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ready || standing ? 'rgba(255,190,90,.8)' : 'rgba(200,170,120,.45)';
    ctx.fillRect(-P.r * 0.07, -P.r * 0.4, P.r * 0.14, P.r * 0.75);
    ctx.restore();
    this.keyBadge('H', P.x + P.r * 0.74, P.y - P.r * 0.74, ready);
  }

  private trumpetBtn(sim: ZastepySim, live: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, T = L.trumpet;
    const ready = sim.ready;
    const pulse = ready ? 0.5 + 0.5 * Math.sin(this.clock * 6) : 0;
    const k = 1 + this.trumpetPop * 0.18 + pulse * 0.04 - this.btnPress.trumpet * 0.1;
    const shake = this.btnShake.trumpet > 0 ? Math.sin(this.btnShake.trumpet * 60) * this.btnShake.trumpet * 8 * u : 0;
    if (ready) glow(ctx, T.x, T.y, T.r * 1.7, '255,200,80', 0.7 + pulse * 0.3);
    ctx.save();
    ctx.translate(T.x + shake, T.y);
    ctx.scale(k, k);
    ctx.fillStyle = ready ? '#fff1c9' : 'rgba(255,248,232,.92)';
    ctx.beginPath();
    ctx.arc(0, 0, T.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ready ? C.goldDeep : 'rgba(185,127,31,.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const rr = T.r - 4 * u;
    ctx.strokeStyle = 'rgba(42,31,46,.15)';
    ctx.lineWidth = 4.5 * u;
    ctx.beginPath();
    ctx.arc(0, 0, rr, 0, Math.PI * 2);
    ctx.stroke();
    if (sim.charge > 0) {
      ctx.strokeStyle = ready ? C.gold : live ? '#e8b04a' : 'rgba(232,176,74,.6)';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sim.charge);
      ctx.stroke();
    }
    paintTrumpet(ctx, 1 * u, 2 * u, T.r * 1.15, ready ? C.goldDeep : 'rgba(150,120,70,.8)');
    ctx.restore();
    this.keyBadge('T', T.x + T.r * 0.74, T.y - T.r * 0.74, ready);
  }

  // ── the cards ───────────────────────────────────────────────────
  /** Where a card sits (for the coach mark): its top's middle. */
  cardAt(id: HostId): { x: number; y: number } | null {
    const c = this.L.cards.find(s => s.id === id);
    return c ? { x: c.r.x + c.r.w / 2, y: c.r.y } : null;
  }

  /** The shades coming or on the road that a card is the bane of. */
  private wanted(sim: ZastepySim): Set<WaveId> {
    const out = new Set<WaveId>();
    for (const k of sim.battle.nextWave ?? []) out.add(k);
    for (const f of sim.battle.fighters) if (f.side === -1 && f.state !== 'gone' && f.x < sim.battle.road - 1) out.add(f.kind as WaveId);
    return out;
  }

  /** A card's background for its height and state, made once per layout. */
  private cardGrad(h: number, state: 'open' | 'hot' | 'locked'): CanvasGradient {
    const key = `${Math.round(h)}|${state}`;
    let g = this.grads.get(key);
    if (!g) {
      g = this.ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, state === 'locked' ? 'rgba(225,215,200,.8)' : '#fffaf0');
      g.addColorStop(1, state === 'locked' ? 'rgba(200,188,170,.8)' : state === 'hot' ? '#ffe2a8' : '#f3e3bd');
      this.grads.set(key, g);
    }
    return g;
  }

  private cardsRow(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const fighting = sim.stage === 'battle' && sim.phase !== 'done';
    const full = b.light >= b.lightMax - 0.5;
    const want = this.wanted(sim);
    const age = ageOf(b.battle);
    const dim = this.upA > 0.02 && !L.tall ? 1 - this.upA * 0.5 : 1;
    L.cards.forEach(({ id, r, open }, i) => {
      const st = HOST[id];
      const cool = b.cool[id] / st.cool;
      const afford = b.light >= st.cost;
      const ready = open && fighting && cool <= 0 && afford;
      const bane = BANE[id];
      const hot = open && fighting && bane !== null && want.has(bane);
      const press = this.pressT.get(id) ?? 0, shake = this.shakeT.get(id) ?? 0;
      const narrow = r.w < 64 * u;
      const rad = Math.min(10 * u, r.w * 0.18);
      ctx.save();
      ctx.globalAlpha = dim;
      ctx.translate(r.x + r.w / 2 + Math.sin(shake * 60) * shake * 10 * u, r.y + r.h / 2 - (hot ? 3 * u : 0));
      const sc = 1 - press * 0.3 + (ready && (full || hot) ? 0.025 * Math.sin(this.clock * 5 + i) : 0);
      ctx.scale(sc, sc);
      ctx.translate(-r.w / 2, -r.h / 2);
      // the glow of a ready card (a soft outer ring; no shadowBlur)
      if (ready || hot) {
        ctx.strokeStyle = hot ? 'rgba(255,170,60,.38)' : `rgba(255,200,80,${full ? 0.4 : 0.26})`;
        ctx.lineWidth = 7 * u;
        ctx.beginPath();
        ctx.roundRect(-1, -1, r.w + 2, r.h + 2, rad + 2);
        ctx.stroke();
      }
      ctx.fillStyle = this.cardGrad(r.h, open ? (hot ? 'hot' : 'open') : 'locked');
      ctx.beginPath();
      ctx.roundRect(0, 0, r.w, r.h, rad);
      ctx.fill();
      ctx.strokeStyle = hot ? '#e0861c' : ready ? C.gold : 'rgba(185,127,31,.4)';
      ctx.lineWidth = hot ? 3 : ready ? 2.5 : 1;
      ctx.stroke();
      // the unit, painted, standing on the price's strip (a wide, low card: the unit on the left, the price on the right)
      const land = r.w >= r.h * 1.3;
      const strip = land ? 0 : Math.max(20 * u, Math.min(26 * u, r.h * 0.28));
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, r.w, r.h, rad);
      ctx.clip();
      const big = id === 'jezdziec' || id === 'archaniol' || id === 'serafin';
      const s = land
        ? Math.min((r.w * 0.6) / (big ? 2.1 : 1.6), (r.h - 6 * u) / (big ? 1.95 : 1.7))
        : Math.min(r.w / (big ? 2.1 : 1.6), (r.h - strip) / (big ? 1.95 : 1.7));
      const ux = land ? r.w * 0.34 : r.w / 2 + (narrow ? 2 : 5) * u, uy = land ? r.h - 3 * u : r.h - strip + 2 * u;
      ctx.globalAlpha = dim * (open ? 1 : 0.35);
      const hx = ux - (id === 'jezdziec' ? 0.1 * s : 0), hy = uy + (id === 'serafin' ? -0.1 * s : 0);
      const spr = this.unitSprite(id, r.w, r.h, hx, hy, s, age);
      if (spr) ctx.drawImage(spr, 0, 0, r.w, r.h);
      else {
        this.pose.t = this.clock;
        this.pose.seed = i;
        this.pose.age = age;
        this.pose.walk = 0;
        paintHost(ctx, id, hx, hy, s, this.pose);
      }
      ctx.globalAlpha = dim;
      if (open && cool > 0) {
        ctx.fillStyle = 'rgba(42,31,46,.45)';
        ctx.fillRect(0, 0, r.w, r.h * cool);
      }
      if (open && !afford) {
        ctx.fillStyle = 'rgba(255,250,240,.45)';
        ctx.fillRect(0, 0, r.w, r.h);
        ctx.fillStyle = 'rgba(232,176,74,.75)';
        ctx.fillRect(0, r.h - 4 * u, r.w * clamp(b.light / st.cost), 4 * u);
      }
      ctx.restore();
      if (open) {
        // the bane: the shade it beats ×2, a badge at the top left — the top right of a wide, low card, over its
        // price (orange and "×2" when that shade comes)
        if (bane) {
          const br = 10 * u;
          ctx.font = F.bane;
          const tw = ctx.measureText('×2').width;
          const pw = narrow ? 2 * br : 2 * br + tw + 6 * u;
          const bx = land ? r.w - 4 * u - (hot ? pw : 2 * br) + br : 4 * u + br, by = 4 * u + br;
          if (hot) {
            ctx.fillStyle = 'rgba(224,134,28,.95)';
            ctx.beginPath();
            ctx.roundRect(bx - br, by - br, pw, 2 * br, br);
            ctx.fill();
            if (!narrow) {
              ctx.fillStyle = '#fff6e0';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText('×2', bx + br + 1 * u, by + 0.5);
            }
          } else {
            ctx.fillStyle = 'rgba(42,31,46,.12)';
            ctx.beginPath();
            ctx.arc(bx, by, br, 0, Math.PI * 2);
            ctx.fill();
          }
          this.pose.age = 0;
          ctx.globalAlpha = dim * (hot ? 1 : 0.6);
          paintDemon(ctx, bane, bx, by + 7 * u, (bane === 'cien' || bane === 'bestia' || bane === 'miotacz' ? 9 : 12) * u, this.pose);
          ctx.globalAlpha = dim;
          if (hot && narrow) {
            // a narrow card says "×2" over the unit's shoulder
            ctx.font = F.bane;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            this.plated('×2', r.w / 2, by + br + 9 * u, '#8a3a08', 'rgba(255,246,224,.95)');
          }
        }
        // the unit's level: gold pips at the top right (a column on a narrow card; the top left of a wide, low one)
        const lv = unitLevel(sim.p, id);
        const keyed = !L.touch;
        for (let k = 0; k < lv; k++) {
          ctx.fillStyle = C.gold;
          ctx.beginPath();
          if (land) ctx.arc(7 * u + k * 6 * u + (keyed ? 14 * u : 0), 8 * u, 2.4 * u, 0, Math.PI * 2);
          else if (narrow) ctx.arc(r.w - 6 * u, 7 * u + k * 6 * u + (keyed ? 14 * u : 0), 2.2 * u, 0, Math.PI * 2);
          else ctx.arc(r.w - 7 * u - k * 6 * u - (keyed ? 16 * u : 0), 8 * u, 2.4 * u, 0, Math.PI * 2);
          ctx.fill();
        }
        // the key (a keyboard's shortcut), the price
        if (keyed) {
          ctx.font = F.key;
          ctx.textAlign = land ? 'left' : 'right';
          ctx.textBaseline = 'top';
          ctx.fillStyle = 'rgba(42,31,46,.6)';
          ctx.fillText(String(i + 1), land ? 5 * u : r.w - 5 * u, 3 * u);
        }
        const cy = land ? r.h - 14 * u : r.h - strip / 2;
        ctx.font = F.cost;
        const cost = String(st.cost);
        const cw = ctx.measureText(cost).width, dr = 4.5 * u;
        const x0 = land ? r.w - 9 * u - (cw + dr * 2 + 3 * u) : r.w / 2 - (cw + dr * 2 + 3 * u) / 2;
        lightDrop(ctx, x0 + dr, cy + 0.5 * u, dr, afford ? 1 : 0.6);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        this.plated(cost, x0 + dr * 2 + 3 * u, cy + 0.5, afford ? C.ink : 'rgba(42,31,46,.6)', 'rgba(255,250,240,.85)');
      } else {
        // the next card: the gate level that opens it
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lab = this.fitIn(t('hud.locked', { n: st.gate }), r.w - 10 * u, 12 * u, 750, SANS, MIN_TEXT);
        this.plated(lab, r.w / 2, land ? r.h - 14 * u : r.h - strip / 2, 'rgba(42,31,46,.75)', 'rgba(240,232,218,.9)');
      }
      ctx.restore();
    });
  }

  /** What a tap at (x, y) touches on the HUD (null: the road). */
  hit(x: number, y: number, sim: ZastepySim): Hit | null {
    const L = this.L;
    if (this.story) return { kind: 'story' };
    if (this.upOn(sim)) {
      const S = L.sheet;
      for (let i = 0; i < sim.offers.length; i++) if (inside(x, y, S.offers[i])) return { kind: 'offer', i };
      if (inside(x, y, S.go)) return { kind: 'go' };
      if (inside(x, y, S.box)) return { kind: 'none' };
    }
    if (hits(discRect(L.trumpet), x, y)) return { kind: 'trumpet' };
    if (hits(discRect(L.pillar), x, y)) return { kind: 'pillar' };
    const c = cardAt(L, x, y);
    if (c) return c.open ? { kind: 'card', id: c.id } : { kind: 'locked', id: c.id };
    // the rest of the controls' band is no road
    if (y >= L.row.y) return { kind: 'none' };
    return null;
  }

  /** Every control a finger can press now, as `hit` tests it (ArcadeGame.targets). */
  targets(sim: ZastepySim): TapTarget[] {
    if (this.story) return tapTargets(this.L, { story: this.storyRect ?? this.L.story });
    if (this.upOn(sim)) return tapTargets(this.L, { offers: sim.offers.length });
    return tapTargets(this.L);
  }

  // ── the card between battles ────────────────────────────────────
  /** Where the first offer sits (for the coach mark). */
  offerAt(): { x: number; y: number } | null {
    const o = this.L.sheet.offers[0];
    return { x: o.x + o.w / 2, y: o.y };
  }

  /** An offer's name and its numbers before → after. */
  private offerText(sim: ZastepySim, o: Offer): { name: string; nums: string } {
    const p = sim.p, age = ageOf(p.battle);
    if (o.what === 'gate') {
      const a = gateLevel(p);
      return {
        name: t('up.gate', { n: o.level }),
        nums: t('up.gateNums', { a: wallsFor(a), b: wallsFor(o.level), c: fmtNum(flowFor(a), 1), d: fmtNum(flowFor(o.level), 1) }),
      };
    }
    if (o.what === 'hero') {
      const a = pillarFor(heroLevel(p)), b = pillarFor(o.level);
      return { name: t('up.hero', { n: o.level }), nums: t('up.heroNums', { a: fmtNum(a.sec, a.sec % 1 ? 1 : 0), b: fmtNum(b.sec, b.sec % 1 ? 1 : 0), c: fmtNum(a.cool, a.cool % 1 ? 1 : 0), d: fmtNum(b.cool, b.cool % 1 ? 1 : 0) }) };
    }
    const a = unitStats(o.what, o.level - 1, age), b = unitStats(o.what, o.level, age);
    return { name: t('up.unit', { name: HOST_NAME[o.what], n: o.level }), nums: t('up.unitNums', { a: a.dmg, b: b.dmg, c: a.hp, d: b.hp }) };
  }

  /** An offer's picture in a square of `iw` at (ix, base). */
  private offerIcon(sim: ZastepySim, o: Offer, ix: number, base: number, iw: number): void {
    const ctx = this.ctx;
    if (o.what === 'gate') {
      paintLightGate(ctx, ix + iw * 0.12, base, Math.max(3, iw / 5.4), { glow: 0.5, walls: 1, t: this.clock, mend: 0, age: ageOf(sim.p.battle) });
    } else if (o.what === 'hero') {
      ctx.fillStyle = '#f3ead8';
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.arc(ix, base - (j + 0.5) * iw / 4.2, iw * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,190,90,.75)';
      ctx.fillRect(ix - iw * 0.04, base - iw, iw * 0.08, iw);
    } else {
      const big = o.what === 'jezdziec' || o.what === 'archaniol' || o.what === 'serafin';
      this.pose.t = this.clock;
      this.pose.age = ageOf(sim.p.battle);
      paintHost(ctx, o.what, ix, base, Math.max(4, iw / (big ? 2.1 : 1.6)), this.pose);
    }
  }

  private upgrade(sim: ZastepySim): void {
    if (this.upA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, S = L.sheet, U = S.box;
    ctx.save();
    ctx.globalAlpha = this.upA;
    const k = ease.outBack(this.upA);
    if (S.stacked) {
      // a bottom sheet rises from the thumb zone
      ctx.translate(0, (1 - k) * 40 * u);
    } else {
      ctx.translate(U.x + U.w / 2, U.y + U.h / 2);
      ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
      ctx.translate(-(U.x + U.w / 2), -(U.y + U.h / 2));
    }
    this.dropShadow(U.x, U.y, U.w, U.h, 16, 0.16);
    this.vellum(U.x, U.y, U.w, U.h, 0.97, 16);
    if (S.stacked) {
      ctx.fillStyle = 'rgba(185,127,31,.45)';
      ctx.beginPath();
      ctx.roundRect(U.x + U.w / 2 - 18 * u, U.y + 5 * u, 36 * u, 4 * u, 2 * u);
      ctx.fill();
    }
    // the title and the gold
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(this.fitIn(TXT.upTitle, S.title.w, 18 * u, 500, SERIF, 14, true), S.title.x, S.title.y);
    const gt = fmtNum(sim.p.gold);
    ctx.font = F.price;
    const gw = ctx.measureText(gt).width;
    ctx.textAlign = 'right';
    ctx.fillText(gt, S.gold.x, S.gold.y + 0.5);
    coin(ctx, S.gold.x - gw - 12 * u, S.gold.y, 7 * u);
    if (this.boughtT > 0) {
      ctx.globalAlpha = this.upA * this.boughtT;
      ctx.font = F.btn;
      ctx.textAlign = 'center';
      this.plated(t('up.bought'), S.map.x + S.map.w / 2, S.map.y - (1 - this.boughtT) * 10 * u, C.goldDeep, 'rgba(255,248,232,.95)', 4);
      ctx.globalAlpha = this.upA;
    }
    // the chapter's map: five battles, the stars won, the boss gate, where the next battle is
    this.mapStrip(sim, S.map);
    for (let i = 0; i < sim.offers.length && i < S.offers.length; i++) this.offerCard(sim, sim.offers[i], S.offers[i], i, S.stacked);
    // go on now (it goes by itself when the bar runs out)
    const g = S.go;
    const left = Math.max(0, RULES.upgradeSec - sim.stageT);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, g.h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232,176,74,.5)';
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, Math.max(g.h, g.w * clamp(left / RULES.upgradeSec)), g.h, g.h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lab = this.fitIn(`${TXT.upGo} · ${t('up.auto', { n: Math.ceil(left) })}`, g.w - 24 * u, 15 * u, 800, SANS);
    ctx.fillText(lab, g.x + g.w / 2, g.y + g.h / 2 + 0.5);
    ctx.restore();
  }

  /** One offer: its picture, its name, its numbers before → after, its price (stacked full-width on a phone, a tile elsewhere). */
  private offerCard(sim: ZastepySim, o: Offer, r: Rect, i: number, stacked: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    ctx.fillStyle = o.can ? '#fff6dc' : 'rgba(230,220,205,.85)';
    ctx.strokeStyle = o.can ? C.gold : 'rgba(150,130,100,.45)';
    ctx.lineWidth = o.can ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12 * u);
    ctx.fill();
    ctx.stroke();
    const { name, nums } = this.offerText(sim, o);
    const pt = fmtNum(o.price);
    ctx.font = F.price;
    const pw = ctx.measureText(pt).width + 18 * u;
    if (stacked) {
      const iw = Math.min(r.h - 12 * u, 54 * u);
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      this.offerIcon(sim, o, r.x + 8 * u + iw / 2, r.y + r.h - 6 * u, iw);
      ctx.restore();
      const tx = r.x + 16 * u + iw, tw = r.x + r.w - 12 * u - tx;
      const nl = this.lines(nums, tw, F.upNums, 2);
      const lh = 15.5 * u;
      const top = r.y + Math.max(6 * u, (r.h - (19 * u + nl.length * lh)) / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink;
      const nm = this.fitIn(name, tw - pw - 8 * u, 15 * u, 750, SANS);
      ctx.fillText(nm, tx, top + 9 * u);
      ctx.font = F.upNums;
      ctx.fillStyle = 'rgba(42,31,46,.8)';
      nl.forEach((l, j) => ctx.fillText(l, tx, top + 19 * u + lh * (j + 0.5)));
      ctx.font = F.price;
      ctx.textAlign = 'right';
      ctx.fillStyle = o.can ? C.ink : '#9a3a20';
      ctx.fillText(pt, r.x + r.w - 12 * u, top + 9 * u + 0.5);
      coin(ctx, r.x + r.w - 12 * u - pw + 7 * u, top + 9 * u, 6 * u);
    } else {
      // a tile: the picture at the top left, the name and the price beside it, the numbers across the foot
      const iw = Math.min(r.h * 0.46, 46 * u);
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      this.offerIcon(sim, o, r.x + 8 * u + iw / 2, r.y + 8 * u + iw, iw);
      ctx.restore();
      const tx = r.x + 16 * u + iw, tw = r.x + r.w - 10 * u - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink;
      ctx.fillText(this.fitIn(name, tw - (L.touch ? 0 : 14 * u), 15 * u, 750, SANS), tx, r.y + 17 * u);
      ctx.font = F.price;
      ctx.fillStyle = o.can ? C.ink : '#9a3a20';
      coin(ctx, tx + 6 * u, r.y + 39 * u, 6 * u);
      ctx.fillText(pt, tx + 17 * u, r.y + 39.5 * u);
      const nl = this.lines(nums, r.w - 18 * u, F.upNums, 2);
      ctx.font = F.upNums;
      ctx.fillStyle = 'rgba(42,31,46,.8)';
      const ny = Math.max(r.y + iw + 14 * u, r.y + r.h - 8 * u - nl.length * 16 * u);
      nl.forEach((l, j) => ctx.fillText(l, r.x + 9 * u, ny + 8 * u + j * 16 * u));
    }
    if (!L.touch) {
      ctx.font = F.key;
      ctx.fillStyle = 'rgba(42,31,46,.5)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), r.x + r.w - 6 * u, r.y + (stacked ? r.h - 17 * u : 5 * u));
    }
  }

  /** The chapter's five battles in a strip under its name: stars on the won ones, the boss gate, the next battle pulsing. */
  private mapStrip(sim: ZastepySim, m: Rect): void {
    const ctx = this.ctx, u = this.L.u, p = sim.p;
    const at = chapterOf(p.battle), n = RULES.chapter;
    const label = this.fitIn(t('map.chapter', { c: at.chapter + 1, age: AGES[ageOf(p.battle)] }), m.w, 13 * u, 700, SANS);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(42,31,46,.75)';
    ctx.fillText(label, m.x, m.y + 7 * u);
    const cy = m.y + m.h * 0.52;
    const mx = m.x + 12 * u, mw = m.w - 24 * u;
    const step = mw / (n - 1);
    ctx.strokeStyle = 'rgba(185,127,31,.5)';
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, cy);
    ctx.lineTo(mx + mw, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < n; i++) {
      const b = at.chapter * n + i, cx = mx + i * step;
      const here = b === p.battle, done = b < p.battle, boss = i === n - 1;
      const pulse = here ? 1 + 0.15 * Math.sin(this.clock * 5) : 1;
      ctx.fillStyle = boss ? (done ? C.goldDeep : '#3a2c3c') : done ? C.gold : here ? '#fff1c9' : '#efe6d6';
      ctx.strokeStyle = here ? C.goldDeep : 'rgba(42,31,46,.35)';
      ctx.lineWidth = here ? 2.5 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (boss ? 8 : 6.5) * u * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (boss && !done) {
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(cx - 2.4 * u, cy - 0.5 * u, 1.2 * u, 0, Math.PI * 2);
        ctx.arc(cx + 2.4 * u, cy - 0.5 * u, 1.2 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      const st = p.stars[b] ?? 0;
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < st ? C.gold : 'rgba(42,31,46,.16)';
        star(ctx, cx - 7.5 * u + s * 7.5 * u, cy + 15 * u, 3.4 * u);
      }
    }
  }

  // ── the floats, the stars, the toasts ───────────────────────────
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
      this.plated(f.text, 0, 0, f.color, 'rgba(255,250,235,.88)', 3.5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawStars(): void {
    const s = this.stars;
    if (!s || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const cy = L.cardY + 44 * u, r = 20 * u;
    const out = s.t > 2.1 ? 1 - (s.t - 2.1) / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, out);
    for (let i = 0; i < 3; i++) {
      const k = clamp((s.t - 0.25 - i * 0.22) / 0.3);
      const sc = k > 0 ? ease.outBack(k) : 0;
      const cx = L.cardX + (i - 1) * r * 2.4;
      ctx.save();
      ctx.translate(cx, cy - (i === 1 ? 8 * u : 0));
      ctx.scale(Math.max(0.001, sc), Math.max(0.001, sc));
      ctx.fillStyle = 'rgba(42,31,46,.25)';
      star(ctx, 2 * u, 3 * u, r);
      ctx.fillStyle = i < s.n ? C.gold : 'rgba(255,248,232,.7)';
      star(ctx, 0, 0, r);
      ctx.strokeStyle = i < s.n ? C.goldDeep : 'rgba(150,130,100,.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawToast(): void {
    const c = this.toasts[0];
    if (!c || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(L.cardW, L.right - L.left), h = (c.sub ? 60 : 40) * u;
    const x = L.cardX - w / 2, y = L.cardY - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK) * (this.upA > 0.5 ? 0.25 : 1);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    this.dropShadow(x, y, w, h, 10, 0.14);
    this.vellum(x, y, w, h, 0.96);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.color;
    const title = this.fitIn(c.title, w - 24 * u, 18 * u, 500, SERIF, 14, true);
    ctx.fillText(title, L.cardX, c.sub ? y + 20 * u : y + h / 2);
    if (c.sub) {
      ctx.fillStyle = 'rgba(42,31,46,.82)';
      const sub = this.fitIn(c.sub, w - 24 * u, 13.5 * u, 650, SANS);
      ctx.fillText(sub, L.cardX, y + 42 * u);
    }
    ctx.restore();
  }

  // ── Tymek ───────────────────────────────────────────────────────
  /** Tymek's portrait and, while he talks, his bubble (its box, for the coming wave to keep clear of). */
  private drawBubble(): Rect | null {
    const b = this.bubble;
    const ctx = this.ctx, L = this.L, u = L.u, T = L.tymek;
    if (this.story || this.upA > 0.5) return null;
    const talk = b ? 1 : 0;
    // the portrait stays in its corner; it lights up when he speaks
    ctx.save();
    ctx.globalAlpha = b ? 1 : 0.8;
    paintTymek(ctx, T.x, T.y, T.r, this.clock, b ? clamp(1 - b.t / Math.max(0.1, b.dur - 0.4)) * talk : 0);
    ctx.restore();
    if (!b) return null;
    const inK = ease.outBack(clamp(b.t / 0.25)), outK = clamp((b.dur - b.t) / 0.3);
    const lines = this.lines(b.text, T.maxW - 20 * u, this.F.say, 4);
    ctx.font = this.F.say;
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    const lh = 19 * u, w = tw + 20 * u, h = lines.length * lh + 12 * u;
    const x = T.x + T.r + 10 * u, y = T.y - Math.min(h / 2, T.r);
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(x, T.y);
    ctx.scale(inK, inK);
    ctx.translate(-x, -T.y);
    ctx.fillStyle = 'rgba(255,252,242,.97)';
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * u);
    ctx.moveTo(x + 1, T.y - 5 * u);
    ctx.lineTo(x - 8 * u, T.y);
    ctx.lineTo(x + 1, T.y + 5 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 6 * u + (i + 0.5) * lh));
    ctx.restore();
    return { x, y, w, h };
  }

  // ── the story cards ─────────────────────────────────────────────
  private drawStory(): void {
    const s = this.story;
    this.storyRect = null;
    if (!s) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, R = L.story;
    const a = Math.min(1, s.t / 0.35) * (1 - Math.min(1, s.out));
    const open = s.kind === 'open';
    const w = open ? R.w : Math.min(R.w, 420 * u);
    const title = open ? TXT.openTitle : AGES[s.age];
    const text = open ? TXT.openText : AGE_STORY[s.age];
    const lh = 20 * u, head = 50 * u, tail = 36 * u;
    const art = open ? 0 : Math.min(84 * u, R.h * 0.22);
    // the words first; the verse takes the room that is left (it shrinks to 13 px before it is cut)
    const tl = this.lines(text, w - 32 * u, F.storyText, Math.max(3, Math.floor((R.h - head - tail - art - (open ? 70 * u : 0)) / lh)));
    let vh = 0;
    if (open) {
      const room = R.h - head - tail - tl.length * lh - 12 * u;
      const key = `${Math.round(w)}|${Math.round(room)}`;
      if (!this.verse || this.verseKey !== key) {
        this.verse = layoutPassage(ctx, passage('rev12.7-8'), w - 40 * u, Math.max(60, room), { max: 16 * u, min: MIN_READ });
        this.verseKey = key;
      }
      vh = this.verse.height + 12 * u;
    }
    const h = Math.min(R.h, head + art + tl.length * lh + vh + tail);
    const x = R.x + (R.w - w) / 2;
    const y = R.y + (R.h - h) / 2;
    this.storyRect = { x, y, w, h };
    // a veil over the battle (it waits)
    ctx.save();
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = '#2a1f2e';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.restore();
    const k = s.t < 0.3 ? ease.outBack(s.t / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    this.dropShadow(0, 0, w, h, 16, 0.2);
    this.vellum(0, 0, w, h, 0.98, 16);
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(16 * u, 44 * u, w - 32 * u, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(this.fitIn(title, w - 28 * u, 22 * u, 500, SERIF, 16, true), w / 2, 24 * u);
    if (art) {
      // the gate in its new age
      paintLightGate(ctx, w / 2 + 1.15 * art / 6, head + art - 4 * u, art / 6.2, { glow: 0.7, walls: 1, t: this.clock, mend: 0, age: s.age });
      for (const [i, id] of (['straznik', 'tarczownik'] as const).entries()) {
        this.pose.t = this.clock;
        this.pose.age = s.age;
        this.pose.seed = i;
        paintHost(ctx, id, w / 2 + (i ? 1 : -1) * art * 0.75, head + art - 4 * u, art / 2.4, this.pose);
      }
    }
    ctx.font = F.storyText;
    ctx.fillStyle = 'rgba(42,31,46,.88)';
    tl.forEach((l, i) => ctx.fillText(l, w / 2, head + art + (i + 0.5) * lh));
    if (open && this.verse) drawPassage(ctx, passage('rev12.7-8'), this.verse, w / 2, head + tl.length * lh + 10 * u, { text: '#5a4020', ref: 'rgba(90,64,32,.75)' });
    ctx.font = F.storyTap;
    ctx.fillStyle = 'rgba(58,42,24,.6)';
    ctx.fillText(L.touch ? TXT.storyTap : TXT.storyTapKeys, w / 2, h - 18 * u);
    ctx.restore();
  }

  // ── the evening ─────────────────────────────────────────────────
  private finale(): void {
    if (this.finaleA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.right - L.left, 360 * u), h = 82 * u, x = L.cardX - w / 2, y = L.cardY - h / 2;
    this.vellum(x, y, w, h, 0.96);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(this.fitIn(TXT.finaleTitle, w - 24 * u, 26 * u, 500, SERIF, 16, true), L.cardX, y + 28 * u);
    ctx.fillStyle = 'rgba(42,31,46,.82)';
    ctx.fillText(this.fitIn(TXT.finaleSub, w - 24 * u, 13.5 * u, 650, SANS), L.cardX, y + 60 * u);
    ctx.globalAlpha = 1;
  }
}

const inside = (x: number, y: number, r: Rect): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

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
