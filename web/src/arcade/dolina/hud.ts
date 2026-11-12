/**
 * Dolina's own layer over the climb — only what the runner's standard HUD does not show (the Mendi
 * panel, the score corner and the coach marks are the runner's): the pack's row under the road (the
 * sword's tier, the stones for the next stair, the oil, the streak), the speech bubbles, the words and
 * numbers flying off what earned them, and the cards — the opening story with its root verse, a new
 * era, a level's way out with its stars, a companion found, the dawn at the end, and short toasts.
 *
 * Phone first (src/arcade/DESIGN.md §12): sized for a 360 px phone at u = 1 (cards and bubbles at
 * 15–16 px, the pack at 15–18 px, nothing under 13 px that the player must read), cards hang under the
 * runner's HUD, and a tap on a card or a toast closes it (the tap still jumps: a card never eats a jump),
 * so each is a tap target (`targets()`).  No per-frame blur: the card's shadow is a plain offset shape.
 */
import { ease } from '../kit/juice';
import { MIN_TAP, fitText, hitRect, hits } from '../kit/mobile';
import { layoutPassage, passage, type Passage, type PassageId, type PassageLayout } from '../kit/scripture';
import type { TapTarget } from '../kit/types';
import { MATE_H, paintChest, paintMate } from './cast';
import { weaponParts, type CompId } from './content';
import { t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, TAU, font, paintLamp } from './paint';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; rise: number }
type CardKind = 'story' | 'level' | 'toast' | 'finale';
interface Card {
  kind: CardKind; title: string; sub: string; t: number; dur: number; verse?: PassageId; stars?: number; lines?: [string, boolean][];
  /** v3: a companion's portrait on the card, their name and their power's line; a toast's little picture */
  portrait?: CompId; sub2?: string; sub3?: string; icon?: 'chest' | 'check';
  /** where it was laid out (for the canvas's size), its box and its wrapped words */
  geo?: CardGeo;
}
interface CardGeo {
  key: string; x: number; y: number; w: number; h: number;
  /** the portrait's size and whether the words run beside it (a wide card) or under it (a phone) */
  pw: number; beside: boolean;
  title: string; subLines: string[]; verse: Passage | null; vl: PassageLayout | null;
}

/** The verse's reference line: never under 13 px (kit/scripture's own floor is 10). */
const REF_MIN = 13;
const VERSE_FONT = '"Fraunces Variable", Fraunces, Georgia, serif';

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private stonesShown = 0;
  private stonesPop = 0;
  private oilShown = 1;
  private oilPulse = 0;
  private tierPop = 0;
  /** the runner's block banner covers the top band: the cards wait under it (not drawn, their clocks stopped) */
  private held = false;
  private readonly wraps = new Map<string, string[]>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  resize(L: Layout): void {
    this.L = L;
    this.wraps.clear();
    for (const c of this.cards) c.geo = undefined;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 34): void {
    this.floats.push({ text, x, y, t: 0, dur, color, size, rise });
    if (this.floats.length > 24) this.floats.shift();
  }

  popStones(): void { this.stonesPop = 1; }
  popTier(): void { this.tierPop = 1; }
  hurt(): void { this.oilPulse = 1; }

  /** A card: the opening story (with a passage), a level's end with its stars, the finale, a toast. */
  card(kind: CardKind, title: string, sub: string, dur: number, extra: Partial<Pick<Card, 'verse' | 'stars' | 'lines' | 'portrait' | 'sub2' | 'sub3' | 'icon'>> = {}): void {
    const c: Card = { kind, title, sub, t: 0, dur, ...extra };
    if (kind === 'toast') {
      // toasts queue behind a story card and replace an older toast
      const i = this.cards.findIndex(x => x.kind === 'toast');
      if (i > 0) this.cards.splice(i, 1);
    } else if (this.cards[0]?.kind === 'toast') this.cards[0].dur = Math.min(this.cards[0].dur, this.cards[0].t + 0.25);
    this.cards.push(c);
  }

  /** A story or level card is up: Ćma and the hints wait. */
  get busy(): boolean { const c = this.cards[0]; return !!c && (c.kind === 'story' || c.kind === 'level' || c.kind === 'finale') && c.dur - c.t > 0.3; }

  /**
   * The card on screen now, closable by a tap: in for half a second (a jump's tap at the moment it
   * appears does not close it unread) and not on its way out.
   */
  private shown(): Card | null {
    const c = this.cards[0];
    return c && !this.held && c.t > 0.5 && c.dur - c.t > 0.3 ? c : null;
  }

  /** The card or toast on screen as a tap target: a tap on it closes it. */
  targets(): TapTarget[] {
    const c = this.shown();
    if (!c) return [];
    const g = this.geo(c);
    const r = hitRect({ x: g.x, y: g.y, w: g.w, h: g.h }, MIN_TAP);
    return [{ label: c.kind === 'toast' ? 'toast' : `card:${c.kind}`, x: r.x, y: r.y, w: r.w, h: r.h }];
  }

  /** A tap at (x, y): on the card or toast on screen it closes it (true). */
  tap(x: number, y: number): boolean {
    const c = this.shown();
    if (!c) return false;
    const g = this.geo(c);
    if (!hits({ x: g.x, y: g.y, w: g.w, h: g.h }, x, y)) return false;
    c.dur = Math.min(c.dur, c.t + 0.25);
    return true;
  }

  /** A frame: `held` while the runner's block banner covers the top band (the card waits for it). */
  update(dt: number, stones: number, oil: number, held = false): void {
    for (const f of this.floats) f.t += dt;
    for (let i = this.floats.length - 1; i >= 0; i--) if (this.floats[i].t >= this.floats[i].dur) this.floats.splice(i, 1);
    this.held = held;
    const head = this.cards[0];
    if (head && !held) {
      head.t += dt;
      if (head.t >= head.dur) this.cards.shift();
    }
    this.stonesShown += (stones - this.stonesShown) * Math.min(1, dt * 10);
    if (Math.abs(stones - this.stonesShown) < 0.05) this.stonesShown = stones;
    this.oilShown += (oil - this.oilShown) * Math.min(1, dt * 6);
    this.stonesPop = Math.max(0, this.stonesPop - dt * 3);
    this.oilPulse = Math.max(0, this.oilPulse - dt * 2);
    this.tierPop = Math.max(0, this.tierPop - dt * 2.5);
  }

  // ── drawing ─────────────────────────────────────────────────────
  drawFloats(): void {
    const ctx = this.ctx, L = this.L;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.16 ? 0.6 + 0.4 * ease.outBack(k / 0.16) : 1;
      ctx.globalAlpha = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      ctx.font = font(800, Math.max(13, f.size) * L.u * pop, SANS);
      const y = Math.max(L.top + 10, f.y - f.rise * ease.outCubic(k));
      // the whole word stays on screen (a gate's "+1 · Krótki miecz II" flies off a pilgrim near the left edge)
      const half = ctx.measureText(f.text).width / 2;
      const x = Math.max(L.left + half, Math.min(L.right - half, f.x));
      ctx.fillStyle = 'rgba(14,10,20,.6)';
      ctx.fillText(f.text, x + 1, y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The pack's row under the road, centred: the sword (its tier's name), the stones for the next stair,
   * the oil — pills a finger's height, readable at a glance; the streak beside or under it.
   */
  drawPack(tier: number, oil: number, combo: number, mult: number): void {
    const ctx = this.ctx, L = this.L, u = L.u, P = L.pack;
    const hgt = P.h, gap = 8 * u, icon = 30 * u, padR = 13 * u;
    const stones = String(Math.round(this.stonesShown));
    ctx.font = font(800, 18 * u, SANS);
    const sw = Math.max(62 * u, icon + ctx.measureText(stones).width + padR);
    const ow = 84 * u;
    // the sword's name takes what is left: shrunk to 13 px, then cut — its number always stays
    const room = Math.max(44 * u, P.w - sw - ow - gap * 2 - icon - padR);
    const name = weaponLabel(ctx, tier, room, 15 * u);
    const nameFont = ctx.font;
    const ww = icon + ctx.measureText(name).width + padR;
    const total = ww + sw + ow + gap * 2;
    let x = P.x + Math.max(0, (P.w - total) / 2);
    const y = P.y;
    const pill = (w: number, glowK = 0) => {
      ctx.fillStyle = `rgba(20,15,26,${0.84 + 0.1 * glowK})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, hgt, hgt / 2);
      ctx.fill();
      ctx.strokeStyle = glowK > 0 ? `rgba(255,214,140,${0.35 + 0.65 * glowK})` : 'rgba(255,236,190,.16)';
      ctx.lineWidth = glowK > 0 ? 2 : 1;
      ctx.stroke();
    };
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // the sword
    pill(ww, this.tierPop);
    ctx.save();
    ctx.translate(x + 16 * u, y + hgt / 2);
    ctx.rotate(-0.75);
    ctx.fillStyle = C.steel;
    ctx.fillRect(-1.9 * u, -11 * u, 3.8 * u, 15 * u);
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(-5.5 * u, 4 * u, 11 * u, 2.4 * u);
    ctx.restore();
    ctx.fillStyle = '#fff1c4';
    ctx.font = nameFont;
    ctx.fillText(name, x + icon, y + hgt / 2 + 1);
    x += ww + gap;
    // the stones for the next stair
    pill(sw, this.stonesPop);
    const bx = x + 16 * u, by = y + hgt / 2;
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(bx - 8 * u, by - 1 * u, 8 * u, 6 * u);
    ctx.fillRect(bx + 0.6 * u, by - 1 * u, 8 * u, 6 * u);
    ctx.fillStyle = '#e0b888';
    ctx.fillRect(bx - 4 * u, by - 7.5 * u, 8 * u, 6 * u);
    ctx.fillStyle = '#fff1c4';
    ctx.font = font(800, 18 * u * (1 + 0.2 * this.stonesPop), SANS);
    ctx.fillText(stones, x + icon, y + hgt / 2 + 1);
    x += sw + gap;
    // the oil
    pill(ow, this.oilPulse);
    paintLamp(ctx, x + 14 * u, y + hgt / 2 + 6 * u, 9 * u, oil < 0.3 ? 1 : 0);
    const bw = ow - 42 * u, bh = 8 * u, bx2 = x + 30 * u, by2 = y + hgt / 2 - bh / 2;
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.roundRect(bx2, by2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = this.oilShown < 0.3 ? '#ff9a5a' : '#f5c35a';
    ctx.beginPath();
    ctx.roundRect(bx2, by2, Math.max(bh, bw * Math.max(0, Math.min(1, this.oilShown))), bh, bh / 2);
    ctx.fill();
    x += ow;
    // the streak: beside the row on a wide screen, under it upright
    if (combo >= 3) {
      const text = mult > 1 ? `${t('hud.combo', { n: mult })} · ${combo}` : String(combo);
      ctx.font = font(800, 14 * u, SANS);
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = mult > 1 ? '#ffd36b' : 'rgba(255,241,196,.85)';
      if (x + gap + tw <= L.right) {
        ctx.textAlign = 'left';
        ctx.fillText(text, x + gap, y + hgt / 2 + 1);
      } else {
        ctx.textAlign = 'right';
        ctx.fillText(text, Math.min(L.right, x), y + hgt + 12 * u);
      }
    }
  }

  /** A speaker's line in a drawn bubble above them (kept on screen, under the runner's HUD). */
  drawBubble(text: string, a: number, mx: number, my: number): void {
    if (!text || a <= 0.01) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = font(600, 15 * u, SANS);
    const maxW = Math.min(300 * u, L.right - L.left);
    const lines = this.lines(text, maxW - 24 * u, ctx.font);
    const w = Math.min(maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 24 * u);
    const lh = 20 * u, h = lines.length * lh + 14 * u;
    let x = mx - w * 0.3;
    x = Math.max(L.left, Math.min(L.right - w, x));
    let y = my - h - 18 * u;
    y = Math.max(L.top + 4, y);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(246,238,220,.97)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    // the tail toward the speaker
    const tx = Math.max(x + 14 * u, Math.min(x + w - 14 * u, mx));
    if (my > y + h) {
      ctx.beginPath();
      ctx.moveTo(tx - 7 * u, y + h - 1);
      ctx.lineTo(tx + 7 * u, y + h - 1);
      ctx.lineTo(tx + 2 * u, Math.min(my - 6 * u, y + h + 12 * u));
      ctx.fill();
    }
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, x + 12 * u, y + 7 * u + i * lh + 1));
    ctx.globalAlpha = 1;
  }

  /**
   * Where a card goes and how its words wrap (once per card and canvas size): toasts are a pill at least a
   * finger tall; cards are as wide as the screen allows (328 px on the smallest phone) with 15–16 px words.
   */
  private geo(c: Card): CardGeo {
    const L = this.L, u = L.u, ctx = this.ctx;
    const key = `${L.w}x${L.h}`;
    if (c.geo && c.geo.key === key) return c.geo;
    ctx.save();
    let g: CardGeo;
    if (c.kind === 'toast') {
      const iw = c.icon ? 34 * u : 0;
      ctx.font = font(800, 16 * u, SANS);
      const tw = ctx.measureText(c.title).width;
      ctx.font = font(600, 14 * u, SANS);
      const sw = c.sub ? ctx.measureText(c.sub).width : 0;
      const w = Math.min(L.right - L.left, Math.max(tw, sw) + 36 * u + iw), h = Math.max(MIN_TAP, (c.sub ? 58 : 44) * u);
      g = { key, x: (L.w - w) / 2, y: L.cardTop, w, h, pw: 0, beside: false, title: c.title, subLines: [], verse: null, vl: null };
    } else {
      const w = L.cardW, pad = 16 * u;
      const x = (L.w - w) / 2, y = L.cardTop;
      // a companion's portrait: beside all the words on a wide card; on a phone the title runs full width,
      // the portrait under it with the name beside it, and the words under them
      const beside = w >= 420;
      const pw = c.portrait ? (beside ? Math.min(90 * u, w * 0.24) : 64 * u) : 0;
      const textW = w - 2 * pad - (beside && pw ? pw + 12 * u : 0);
      ctx.font = font(560, 15 * u, SANS);
      // a level's sparks sit on its stars' row; every other card's sub is its body
      const subLines = c.sub && c.stars === undefined ? this.lines(c.sub, textW, ctx.font) : [];
      const verse = c.verse ? passage(c.verse) : null;
      const vl = verse ? layoutPassage(ctx, verse, w - 2 * pad, 140 * u, { max: 17 * u, min: 14 }) : null;
      // the height, in the order drawCards() lays things down (each block's gap only when another follows)
      const phonePortrait = !!c.portrait && !beside;
      let cy = 38 * u + (phonePortrait ? 0 : (c.sub2 ? 22 * u : 0) + (c.sub3 ? 22 * u : 0));
      if (phonePortrait) cy += pw + 8 * u;
      if (c.stars !== undefined) cy += c.lines || subLines.length || vl ? 34 * u : 30 * u;
      if (c.lines) cy += c.lines.length * 21 * u + (subLines.length || vl ? 4 * u : -3 * u);
      if (subLines.length) cy += subLines.length * 21 * u + (vl ? 8 * u : -3 * u);
      if (vl) cy += 2 * u + vl.height + Math.max(REF_MIN, vl.refSize) - vl.refSize;
      let h = cy + pad * 2;
      if (c.portrait && beside) h = Math.max(h, pw + pad * 2);
      const tx = pad + (pw && beside ? pw + 12 * u : 0);
      const title = fitTitle(ctx, c.title, w - tx - pad - 22 * u, 22 * u);
      g = { key, x, y, w, h, pw, beside, title, subLines, verse, vl };
    }
    ctx.restore();
    c.geo = g;
    return g;
  }

  /** The card at the head of the queue. */
  drawCards(): void {
    const c = this.cards[0];
    if (!c || this.held) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const inK = Math.min(1, c.t / 0.3), outK = Math.min(1, Math.max(0, (c.dur - c.t) / 0.25));
    const a = Math.min(inK, outK);
    if (a <= 0.01) return;
    const g = this.geo(c);
    ctx.save();
    ctx.globalAlpha = a;
    const drop = (1 - ease.outCubic(inK)) * -14 * u;
    if (c.kind === 'toast') {
      const x = g.x, y = g.y + drop, w = g.w, h = g.h;
      const iw = c.icon ? 34 * u : 0;
      ctx.fillStyle = 'rgba(20,15,26,.9)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 16 * u);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,214,140,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (c.icon === 'chest') paintChest(ctx, x + 22 * u, y + h / 2 + 3 * u, 14 * u, Math.min(1, c.t / 0.5));
      else if (c.icon === 'check') {
        ctx.strokeStyle = '#9fe08a';
        ctx.lineWidth = 3.5 * u;
        ctx.beginPath();
        ctx.moveTo(x + 13 * u, y + h / 2);
        ctx.lineTo(x + 20 * u, y + h / 2 + 7 * u);
        ctx.lineTo(x + 31 * u, y + h / 2 - 8 * u);
        ctx.stroke();
      }
      const cx = x + w / 2 + iw / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd36b';
      const title = fitText(ctx, c.title, w - 28 * u - iw, 16 * u, 800, SANS, 13);
      ctx.fillText(title, cx, y + (c.sub ? 19 * u : h / 2 + 1));
      if (c.sub) {
        ctx.fillStyle = 'rgba(255,241,196,.9)';
        const sub = fitText(ctx, c.sub, w - 28 * u - iw, 14 * u, 600, SANS, 13);
        ctx.fillText(sub, cx, y + 39 * u);
      }
      ctx.restore();
      return;
    }
    const pad = 16 * u, x = g.x, y = g.y + drop, w = g.w, h = g.h;
    // a plain offset shadow (no blur: it costs a phone a full-screen pass every frame)
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 5, w, h, 16 * u);
    ctx.fill();
    ctx.fillStyle = 'rgba(246,238,220,.97)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16 * u);
    ctx.fill();
    // a little × in the corner: a tap anywhere on the card closes it
    const kx = x + w - 16 * u, ky = y + 16 * u, kr = 4.5 * u;
    ctx.strokeStyle = 'rgba(42,33,51,.35)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.moveTo(kx - kr, ky - kr);
    ctx.lineTo(kx + kr, ky + kr);
    ctx.moveTo(kx + kr, ky - kr);
    ctx.lineTo(kx - kr, ky + kr);
    ctx.stroke();
    if (c.portrait) {
      // the companion, in a warm round frame, a little hop as the card comes in (on a phone: under the title)
      const pw = g.pw;
      const fx = x + pad + pw / 2, fy = (g.beside ? y + pad : y + pad + 38 * u) + pw / 2;
      ctx.fillStyle = '#2a2440';
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2 - 2, 0, TAU);
      ctx.clip();
      const hop = Math.abs(Math.sin(c.t * 5)) * pw * 0.04;
      // scaled by their height, so the squirrel fills her frame as the giant fills his
      paintMate(ctx, c.portrait, fx, fy + pw * 0.38 - hop, (pw * 0.66) / Math.max(0.9, MATE_H[c.portrait]), { run: c.t * 6, t: c.t, act: 0, gold: true, air: false, sleep: false });
      ctx.restore();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2, 0, TAU);
      ctx.stroke();
    }
    const tx = x + pad + (g.pw && g.beside ? g.pw + 12 * u : 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    const title = fitTitle(ctx, g.title, w - (tx - x) - pad - 22 * u, 22 * u);
    ctx.fillText(title, tx, y + pad - 1 * u);
    ctx.fillStyle = C.gold;
    ctx.fillRect(tx, y + pad + 29 * u, 44 * u, 3 * u);
    let cy = y + pad + 38 * u;
    if (c.portrait && !g.beside) {
      // on a phone: the name and the power beside the portrait, the words under them, full width
      const nx = x + pad + g.pw + 12 * u, mid = cy + g.pw / 2, two = !!c.sub2 && !!c.sub3;
      ctx.textBaseline = 'middle';
      if (c.sub2) {
        ctx.fillStyle = C.goldDeep;
        ctx.font = font(800, 18 * u, SANS);
        ctx.fillText(c.sub2, nx, two ? mid - 11 * u : mid);
      }
      if (c.sub3) {
        ctx.fillStyle = C.text;
        const line = fitText(ctx, c.sub3, x + w - pad - nx, 15 * u, 700, SANS, 13);
        ctx.fillText(line, nx, two ? mid + 12 * u : mid);
      }
      ctx.textBaseline = 'top';
      cy += g.pw + 8 * u;
    } else {
      if (c.sub2) {
        ctx.fillStyle = C.goldDeep;
        ctx.font = font(800, 16 * u, SANS);
        ctx.fillText(c.sub2, tx, cy);
        cy += 22 * u;
      }
      if (c.sub3) {
        ctx.fillStyle = C.text;
        ctx.font = font(700, 15 * u, SANS);
        ctx.fillText(c.sub3, tx, cy);
        cy += 22 * u;
      }
    }
    const lx = g.beside ? tx : x + pad;
    if (c.stars !== undefined) {
      for (let i = 0; i < 3; i++) {
        const k = Math.min(1, Math.max(0, (c.t - 0.35 - i * 0.22) / 0.25));
        star(ctx, x + pad + 14 * u + i * 34 * u, cy + 13 * u, 13 * u * (i < c.stars ? 0.6 + 0.4 * ease.outBack(k) : 0.85), i < c.stars && k > 0 ? '#f5c35a' : 'rgba(42,33,51,.18)');
      }
      if (c.sub) {
        // the sparks earned, on the stars' row
        ctx.fillStyle = C.goldDeep;
        ctx.font = font(800, 16 * u, SANS);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(c.sub, x + w - pad, cy + 13 * u);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
      }
      cy += 34 * u;
    }
    if (c.lines) {
      ctx.font = font(650, 15 * u, SANS);
      for (const [line, ok] of c.lines) {
        ctx.fillStyle = ok ? C.goldDeep : 'rgba(42,33,51,.55)';
        ctx.fillText(`${ok ? '★' : '☆'} ${line}`, x + pad, cy);
        cy += 21 * u;
      }
      cy += 4 * u;
    }
    ctx.fillStyle = C.textSoft;
    ctx.font = font(560, 15 * u, SANS);
    g.subLines.forEach((s, i) => ctx.fillText(s, lx, cy + i * 21 * u));
    if (g.subLines.length) cy += g.subLines.length * 21 * u + 8 * u;
    if (g.verse && g.vl) drawVerse(ctx, g.verse, g.vl, x + w / 2, cy + 2 * u);
    ctx.restore();
  }

  private lines(text: string, maxW: number, f: string): string[] {
    const key = `${f}|${maxW}|${text}`;
    const hit = this.wraps.get(key);
    if (hit) return hit;
    const ctx = this.ctx;
    ctx.font = f;
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    if (this.wraps.size > 80) this.wraps.clear();
    this.wraps.set(key, out);
    return out;
  }
}

/** A laid-out passage centred on `cx` from `top` down, its reference at least REF_MIN px ("Ps 23,4 · Biblia Gdańska"). */
function drawVerse(ctx: CanvasRenderingContext2D, p: Passage, l: PassageLayout, cx: number, top: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = 'rgba(42,33,51,.62)';
  ctx.font = font(600, Math.max(REF_MIN, l.refSize), SANS);
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}

/**
 * The sword's label for the pack, fitted to `maxW`: "Krótki miecz II" at `px`, shrunk to 13 px if it must
 * be, then the name cut with "…" — the tier's number always stays.  Leaves ctx.font at the size chosen.
 */
export function weaponLabel(ctx: CanvasRenderingContext2D, tier: number, maxW: number, px: number): string {
  const { name, n } = weaponParts(tier);
  const full = t('weapon', { name, n });
  const fit = fitText(ctx, full, maxW, px, 800, SANS, 13);
  if (fit === full) return full;
  const tail = ` ${n}`;
  const head = fitText(ctx, name, Math.max(1, maxW - ctx.measureText(tail).width), 13, 800, SANS, 13);
  return `${head}${tail}`;
}

/** A card's title fitted to `maxW` in the serif italic: from `px` down to 17 px, then cut with "…" (leaves ctx.font set). */
function fitTitle(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number): string {
  let size = px;
  ctx.font = font(560, size, SERIF, true);
  let w = ctx.measureText(text).width;
  if (w > maxW) {
    size = Math.max(17, Math.floor((px * maxW) / w));
    ctx.font = font(560, size, SERIF, true);
    w = ctx.measureText(text).width;
  }
  if (w <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 10;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
