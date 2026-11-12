/**
 * Jerzy i smok's own bits over the field, drawn on the canvas phone first (layout.ts) — never the
 * band's panel nor the score (the runner draws those): the status band (the hearts, the level and its
 * bar, the build and its treasures), the dragon's bar (his road, his weak spot when it opens), the
 * Miecz światła's dial — the one button, in the thumb zone — and the short banners; the level-up's
 * cards (a bottom sheet of full-width cards on a phone, a row elsewhere) with their numbers, the duet
 * a card would form and the treasure that works on it, and Linda's reshuffle; the run's tally with
 * what each weapon did; the story cards; Linda's speech bubble.
 *
 * Text never goes under the kit's floor (paint.font: 11 px); what the player reads to play — a card,
 * a bubble, a button — is 13 px or more, and what a finger taps is 44 px or more (kit/mobile).
 */
import { fmtNum } from '../../i18n';
import { ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import {
  WEAPONS, dragonName, duetName, flawName, gearStats, isWeapon, itemName, palStats, roadName, townName, townStory, treasureName, treasureText,
  weaponStats, type GearId, type WeaponId,
} from './content';
import { paintPal, paintTreasureIcon, type PalPose } from './figures';
import { hand, t, scales as scalesText } from './i18n';
import { tallyBox, type Layout, type Rect, type Sheet } from './layout';
import { C, SANS, SERIF, font, glow, paintApple, paintItemIcon, paintScale } from './paint';
import { RULES } from './rules';
import type { Card, JerzySim } from './sim';
import { xpNeed } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const PAL_POSE: PalPose = { flip: 1, step: 0, walking: 0, t: 0, act: 0, roll: 0, nap: 0 };
/** the pressed index of the reshuffle button (cards are 0..n−1) */
export const REROLL = -2;

/** Lines of at most `maxW` at the current font; at most `max` of them, the last one cut with "…" when more would follow. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, max = Infinity): string[] {
  const words = text.split(/\s+/).filter(Boolean), out: string[] = [];
  let line = '';
  for (const w of words) {
    const tryL = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryL).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = tryL;
  }
  if (line) out.push(line);
  if (out.length <= max) return out;
  const kept = out.slice(0, Math.max(1, max));
  kept[kept.length - 1] = cut(ctx, `${kept[kept.length - 1]} ${out[kept.length]}`, maxW);
  return kept;
}

/** `text` cut with "…" to fit `maxW` at the current font. */
function cut(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
}

/** Set a font that fits `text` into `maxW`, from `px` down to `min` (never under it), and return the text (cut if it must be). */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number, family: string, min = MIN_READ, italic = false): string {
  let size = Math.max(min, px);
  ctx.font = font(weight, size, family, italic);
  const w = ctx.measureText(text).width;
  if (w > maxW && size > min) {
    size = Math.max(min, Math.floor((size * maxW * 10) / w) / 10);
    ctx.font = font(weight, size, family, italic);
  }
  return cut(ctx, text, maxW);
}

/** A paragraph at the largest size from `max` down to `min` whose lines fit `maxH`; the font is left set. */
function para(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxH: number, max: number, min: number, weight: number, family: string, lh = 1.24): { lines: string[]; lineH: number } {
  for (let size = max; size >= min - 1e-6; size -= 0.5) {
    ctx.font = font(weight, size, family);
    const lines = wrap(ctx, text, maxW);
    if (lines.length * size * lh <= maxH + 0.5) return { lines, lineH: size * lh };
  }
  ctx.font = font(weight, min, family);
  return { lines: wrap(ctx, text, maxW, Math.max(1, Math.floor(maxH / (min * lh)))), lineH: min * lh };
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke: string | null, rad: number, lw = 1.5): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(rad, r.h / 2, r.w / 2));
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Text with a dark rim, readable over grass, ash and gold alike. */
function rimText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, rim = 'rgba(30,20,20,.6)', lw = 3): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = rim;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** A button: a dark pill with a gold rim (dimmed until it may be pressed, lit while a finger is on it). */
function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, on: boolean, pressed: boolean, px: number): void {
  panel(ctx, r, pressed ? '#4a3b20' : on ? '#2a2233' : 'rgba(42,34,51,.4)', on ? (pressed ? '#ffe7a3' : C.gold) : null, r.h / 2, pressed ? 3 : 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const s = fit(ctx, label, r.w - 20, px, 800, SANS);
  ctx.fillStyle = on ? C.goldLight : 'rgba(255,248,230,.72)';
  ctx.fillText(s, r.x + r.w / 2, r.y + r.h / 2 + 1);
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.85);
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.05, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.05, x + r * 1.3, y - r * 0.1, x, y + r * 0.85);
  };
  path();
  ctx.fillStyle = 'rgba(40,20,20,.55)';
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = C.vermilion;
    ctx.fillRect(x - r * 1.4, y - r * 1.1, r * 2.8 * Math.min(1, fill), r * 2.2);
    ctx.restore();
  }
  path();
  ctx.strokeStyle = 'rgba(255,245,225,.95)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export class Hud {
  /** the level-up's sheet drawn this frame */
  sheet: Sheet | null = null;
  /** a finger on a card (its index) or on the reshuffle (REROLL); −1: none */
  pressed = -1;
  /** the story card's and the tally's buttons as drawn (a tap anywhere does the same) */
  storyBtn: Rect | null = null;
  tallyBtn: Rect | null = null;
  private storyCache: { key: string; h: number; titleLines: string[]; titleSize: number; body: { lines: string[]; lineH: number }; bodySize: number; pass: PassageLayout | null } | null = null;
  private xpGrad: { key: string; g: CanvasGradient } | null = null;

  /** Which card of `sh` a tap at (x, y) lands on (−1: none). */
  static cardAt(sh: Sheet | null, x: number, y: number): number {
    return sh ? sh.cards.findIndex(r => inside(r, x, y)) : -1;
  }

  /** Whether a tap at (x, y) lands on the reshuffle button of `sh`. */
  static rerollAt(sh: Sheet | null, x: number, y: number): boolean {
    return !!sh?.reroll && inside(sh.reroll, x, y);
  }

  private xpFill(ctx: CanvasRenderingContext2D, r: Rect): CanvasGradient {
    const key = `${r.x}|${r.w}`;
    if (this.xpGrad?.key === key) return this.xpGrad.g;
    const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    g.addColorStop(0, '#c8901c');
    g.addColorStop(1, '#ffe08a');
    this.xpGrad = { key, g };
    return g;
  }

  /**
   * The status band: the hearts (half hearts show) and Linda's apples, the level and its numbers, the
   * level's bar, the build's chips and the treasures.  On a phone upright and a big screen it moves
   * down while the dragon's bar shows (`bossK` 0..1), and the chips step aside for it.
   */
  drawStatus(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number, pop: number, bossK: number): void {
    const st = L.stat, u = L.u, k = sim.knight;
    const dy = L.statShift * bossK;
    const rowY = st.rowY + dy, xp = { ...st.xp, y: st.xp.y + dy };
    panel(ctx, { x: st.x - 7 * u, y: rowY - 12 * u, w: st.w + 14 * u, h: xp.y + xp.h + 6 * u - (rowY - 12 * u) }, 'rgba(30,26,40,.42)', null, 10 * u);
    const hr = st.heartR, n = k.max + sim.run.apples;
    const gap = Math.min(hr * 2.55, (st.w * 0.56) / Math.max(1, n));
    let hx = st.x + hr * 1.15;
    // the last heart beats when it is all that is left
    const low = k.hearts > 0 && k.hearts <= 1 ? 1 + 0.14 * Math.max(0, Math.sin(now * 9)) : 1;
    for (let i = 0; i < k.max; i++) {
      heart(ctx, hx, rowY + hr * 0.1, hr * (k.hit > 0 && i === Math.floor(k.hearts) ? 1.2 : i === 0 ? low : 1), clamp01(k.hearts - i));
      hx += gap;
    }
    for (let i = 0; i < sim.run.apples; i++) {
      paintApple(ctx, hx + 1, rowY, hr * 0.85);
      hx += gap * 0.92;
    }
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.font = font(700, 13 * u, SANS);
    const nums = `${fmtNum(Math.floor(sim.run.xp))} / ${fmtNum(xpNeed(sim.run.level))}`;
    rimText(ctx, nums, st.x + st.w, rowY + 0.5, '#fff8e6');
    const nw = ctx.measureText(nums).width;
    ctx.font = font(800, (14 + 3 * pop) * u, SANS);
    rimText(ctx, t('hud.level', { n: sim.run.level }), st.x + st.w - nw - 9 * u, rowY + 0.5, C.goldLight);
    panel(ctx, { x: xp.x - 2, y: xp.y - 2, w: xp.w + 4, h: xp.h + 4 }, 'rgba(20,16,28,.66)', null, (xp.h + 4) / 2);
    ctx.fillStyle = this.xpFill(ctx, xp);
    ctx.beginPath();
    ctx.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * sim.levelProgress), xp.h, xp.h / 2);
    ctx.fill();
    const chipA = L.chipsYieldToBoss ? 1 - bossK : 1;
    if (chipA > 0.02 && (sim.build.length || sim.run.treasures.length)) this.drawChips(ctx, L, sim, chipA);
  }

  /** The run's build: a chip per weapon (dark) and gear (blue) with its level, then the treasures (gold coins, overlapping when many). */
  private drawChips(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, alpha: number): void {
    const st = L.stat, u = L.u, c = st.chip, cy = st.chipY;
    const items = sim.build, trs = sim.run.treasures;
    const step = c + 4 * u, tr = c * 0.88;
    let trStep = tr + 3 * u;
    const used = items.length * step + (trs.length ? 6 * u + trs.length * trStep : 0);
    if (used > st.w && trs.length > 1) trStep = Math.max(tr * 0.45, (st.w - items.length * step - 6 * u - tr) / (trs.length - 1));
    ctx.save();
    ctx.globalAlpha *= alpha;
    let bx = st.chipX;
    for (const it of items) {
      const evo = it.level >= 6;
      panel(ctx, { x: bx, y: cy - c / 2, w: c, h: c }, isWeapon(it.id) ? 'rgba(30,26,40,.74)' : 'rgba(47,79,158,.72)', evo ? C.gold : 'rgba(255,248,230,.24)', 6 * u, 1.2);
      paintItemIcon(ctx, it.id, bx + c / 2, cy - c * 0.06, c * 0.3, evo);
      ctx.font = font(800, 11 * u, SANS);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      rimText(ctx, evo ? '★' : String(it.level), bx + c - 2 * u, cy + c / 2 - 2.5 * u, evo ? C.goldLight : '#fff', 'rgba(20,16,28,.85)', 2.5);
      bx += step;
    }
    if (trs.length) bx += 6 * u;
    for (const id of trs) {
      panel(ctx, { x: bx, y: cy - tr / 2, w: tr, h: tr }, 'rgba(120,84,20,.82)', C.gold, tr / 2, 1.2);
      paintTreasureIcon(ctx, id, bx + tr / 2, cy, tr * 0.32);
      bx += trStep;
    }
    ctx.restore();
  }

  /** The dragon's bar while he is around (or flying off for his nap): his name and road, his thirds; gold while his weak spot is open. */
  drawBoss(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number, bossK: number): void {
    const b = sim.boss;
    if (bossK <= 0.02) return;
    const r = L.boss, u = L.u;
    const open = b.fatal && b.state === 'flaw';
    ctx.save();
    ctx.globalAlpha *= bossK;
    panel(ctx, r, open ? 'rgba(90,64,10,.88)' : 'rgba(30,26,40,.8)', open ? C.gold : 'rgba(255,248,230,.2)', 9 * u);
    const pad = 10 * u;
    const name = cap(dragonName(b.spec.kind)) + (b.tier > 0 ? ` · ${roadName(b.tier)}` : '');
    const label = open ? `${flawName(b.spec.flaw)}! ×${fmtNum(b.k, b.k % 1 ? 1 : 0)}` : name;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const shown = fit(ctx, label, r.w * 0.52, 13.5 * u, 700, SERIF);
    ctx.fillStyle = open ? C.goldLight : '#fff3d6';
    ctx.fillText(shown, r.x + pad, r.y + r.h / 2 + 0.5);
    const nx = r.x + pad + ctx.measureText(shown).width + 10 * u;
    const bw = r.x + r.w - pad - nx, bh = 10 * u, by = r.y + (r.h - bh) / 2;
    if (bw >= 24) {
      panel(ctx, { x: nx, y: by, w: bw, h: bh }, 'rgba(255,255,255,.14)', null, bh / 2);
      const left = 1 - b.damage / b.all;
      ctx.fillStyle = b.state === 'flaw' ? (b.fatal ? `rgba(255,${Math.round(214 + 30 * Math.sin(now * 10))},120,1)` : C.goldLight) : C.vermilion;
      ctx.beginPath();
      ctx.roundRect(nx, by, Math.max(bh, bw * left), bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(30,26,40,.9)';
      for (let i = 1; i < 3; i++) ctx.fillRect(nx + (bw * i) / 3 - 1, by, 2, bh);
    }
    ctx.restore();
  }

  /**
   * The Miecz światła's dial, the game's one button (bottom right, under the thumb): a dark plate
   * with the charge running round it; ready, it turns gold, glows, sends rings out and says what to
   * do.  `press` (0..1): a finger just came down on it.
   */
  drawDial(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number, press: number): void {
    const sw = L.sword, r = sw.r, u = L.u, ready = sim.swordReady;
    ctx.save();
    ctx.translate(sw.x, sw.y);
    const sc = 1 - 0.1 * press;
    ctx.scale(sc, sc);
    if (ready) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, 0, 0, r * (2.1 + 0.25 * Math.sin(now * 6)), 'rgba(255,220,130,', 0.55);
      ctx.globalCompositeOperation = 'source-over';
      const q = (now * 1.2) % 1;
      ctx.strokeStyle = `rgba(255,231,163,${0.75 * (1 - q)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 3 + q * 15, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = ready ? '#c8901c' : 'rgba(30,26,40,.82)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ready ? '#fff1c4' : 'rgba(255,248,230,.32)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!ready) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 5 * u;
      ctx.strokeStyle = 'rgba(255,248,230,.15)';
      ctx.beginPath();
      ctx.arc(0, 0, r - 6 * u, 0, TAU);
      ctx.stroke();
      if (sim.charge > 0.01) {
        ctx.strokeStyle = C.gold;
        ctx.beginPath();
        ctx.arc(0, 0, r - 6 * u, -Math.PI / 2, -Math.PI / 2 + TAU * sim.charge);
        ctx.stroke();
      }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = ready ? '#fffbe8' : C.steel;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(-r * 0.36, r * 0.36);
    ctx.lineTo(r * 0.42, -r * 0.42);
    ctx.stroke();
    ctx.strokeStyle = ready ? '#7a4f10' : C.goldDeep;
    ctx.beginPath();
    ctx.moveTo(-r * 0.42, r * 0.06);
    ctx.lineTo(-r * 0.06, r * 0.42);
    ctx.stroke();
    if (press > 0.02) {
      ctx.strokeStyle = `rgba(255,255,255,${0.85 * press})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
    // its name over it, or what to do once it is ready
    const label = ready ? hand('hud.swordTap', L.touch) : t('hud.sword');
    ctx.font = font(800, (ready ? 15 : 13) * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const lw = ctx.measureText(label).width;
    const lx = Math.min(sw.x, L.right - 8 - lw / 2);
    rimText(ctx, label, lx, sw.y - r - 7 * u, ready ? C.goldLight : 'rgba(255,248,230,.96)', 'rgba(30,20,20,.72)', 3.5);
  }

  /** A short banner (a wave, the dragon, a chest, a weak spot found): over the knight, or under him while the runner's banner is up. */
  drawBanner(ctx: CanvasRenderingContext2D, L: Layout, text: string, k: number, color: string, low: boolean): void {
    if (!text || k <= 0) return;
    const u = L.u;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const sc = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate((L.left + L.right) / 2, low ? L.bannerLowY : L.bannerY);
    ctx.scale(sc, sc);
    const maxW = L.right - L.left - 40;
    // one line, or two a little smaller — never shrunk to a smudge
    let size = (L.shape === 'side' ? 20 : 24) * u;
    ctx.font = font(800, size, SERIF, true);
    let lines = [text];
    if (ctx.measureText(text).width > maxW) {
      size = Math.max(16, size * 0.8);
      ctx.font = font(800, size, SERIF, true);
      lines = wrap(ctx, text, maxW, 2);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lh = size * 1.15, y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => rimText(ctx, l, 0, y0 + i * lh, color, 'rgba(30,20,20,.6)', 5 * u));
    ctx.restore();
  }

  /** The level-up: the title and Linda's reshuffle on one row, then three cards (a bottom sheet on a phone). */
  drawChoice(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, sh: Sheet | null, now: number): void {
    const ch = sim.choice;
    this.sheet = ch ? sh : null;
    if (!ch || !sh) return;
    const u = L.u, k = Math.min(1, ch.t / 0.25);
    ctx.fillStyle = `rgba(20,16,28,${0.66 * k})`;
    ctx.fillRect(0, 0, L.w, L.h);
    if (sh.stacked) {
      const y = sh.head.y - 8;
      panel(ctx, { x: L.left + 8, y, w: L.right - L.left - 16, h: L.bottom - 2 - y }, 'rgba(36,30,46,.72)', 'rgba(226,178,60,.4)', 18);
    } else panel(ctx, { x: sh.head.x - 6 * u, y: sh.head.y - 2 * u, w: sh.head.w + 12 * u, h: sh.head.h + 4 * u }, 'rgba(36,30,46,.8)', null, 14 * u);
    // the title (and the golden cards' note) on the head row, the reshuffle at its right
    const title = ch.source === 'rest' ? t('choice.rest') : t('choice.level', { n: sim.run.level });
    const hd = sh.head, rr = sh.reroll;
    const tw = rr ? hd.w - rr.w - 12 * u : hd.w;
    const tx = rr ? hd.x + 4 * u : hd.x + hd.w / 2;
    ctx.textAlign = rr ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    const gold = ch.gold ? t('choice.gold') : '';
    const ty = gold ? hd.y + hd.h * 0.34 : hd.y + hd.h / 2;
    const ts = fit(ctx, title, tw, 20 * u, 800, SERIF, sh.stacked ? MIN_READ : 15, true);
    rimText(ctx, ts, tx, ty, C.goldLight, 'rgba(20,16,28,.55)', 3);
    if (gold) {
      const gs = fit(ctx, gold, tw, 13 * u, 700, SANS, 12);
      rimText(ctx, gs, tx, hd.y + hd.h * 0.8, '#fff3d6', 'rgba(20,16,28,.55)', 3);
    }
    if (rr) button(ctx, rr, t('hud.reroll', { n: sim.run.rerolls }), ch.t >= 0.25, this.pressed === REROLL, 14 * u);
    ch.cards.forEach((card, i) => {
      const r = sh.cards[i];
      const pop = ease.outBack(Math.min(1, Math.max(0, (ch.t - i * 0.06) / 0.3)));
      const pressed = this.pressed === i;
      const s = pop * (pressed ? 0.97 : 1);
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(s, s);
      ctx.translate(-r.w / 2, -r.h / 2);
      this.drawCard(ctx, { x: 0, y: 0, w: r.w, h: r.h }, card, sim, ch.gold, i, L, sh.stacked, now, pressed);
      ctx.restore();
    });
    // the first card is taken by itself when the time runs out
    const left = Math.max(0, RULES.choiceSec - ch.t), r0 = sh.cards[0];
    ctx.fillStyle = C.gold;
    ctx.fillRect(r0.x + 12 * u, r0.y + r0.h - 5 * u, (r0.w - 24 * u) * (left / RULES.choiceSec), 3 * u);
    if (sh.hintY !== null) {
      ctx.textAlign = 'center';
      const hs = fit(ctx, t('choice.hint'), L.right - L.left - 40, 13 * u, 600, SANS);
      rimText(ctx, hs, (L.left + L.right) / 2, sh.hintY, 'rgba(255,248,230,.92)', 'rgba(20,16,28,.5)', 3);
    }
  }

  private drawCard(ctx: CanvasRenderingContext2D, r: Rect, card: Card, sim: JerzySim, gold: boolean, i: number, L: Layout, stacked: boolean, now: number, pressed: boolean): void {
    const u = L.u, evo = card.kind === 'evo', special = card.kind === 'treasure';
    panel(ctx, r, evo || special ? '#fff4cf' : '#f6ecd2', pressed ? '#d99a1c' : evo || gold || special ? C.gold : 'rgba(120,90,40,.4)', 12 * u, pressed ? 3.5 : 1.5);
    if (evo || special) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, r.x + r.w / 2, r.y + r.h * 0.3, r.w * 0.6, 'rgba(255,200,90,', 0.2 + 0.1 * Math.sin(now * 4));
      ctx.restore();
    }
    const title = sim.cardTitle(card);
    const tag = evo ? t('card.evo') : card.kind === 'new' ? t('card.new') : card.kind === 'up' ? t('card.lv', { a: card.from, b: card.to })
      : card.kind === 'pal' ? `${t('card.pal')} · ${t('card.lv', { a: card.from, b: card.to })}` : special ? t('card.treasure') : '';
    const desc = card.kind === 'apple' ? t('card.apple.text') : card.kind === 'scales' ? t('card.scales.text')
      : card.kind === 'pal' && card.pal ? palStats(card.pal, card.to)
        : special && card.tr ? treasureText(card.tr)
          : isWeapon(card.id!) ? weaponStats(card.id as WeaponId, card.to) : gearStats(card.id as GearId, card.to);
    const notes = sim.cardNotes(card);
    const pair = card.id && isWeapon(card.id) && !evo ? t('card.pair', { name: itemName(WEAPONS[card.id as WeaponId].pair) }) : '';
    const extra = notes.duet ? t('card.duet', { name: duetName(notes.duet) }) : notes.treasure ? t('card.with', { name: treasureName(notes.treasure) }) : '';
    const note = extra || pair;
    const icon = (cx: number, cy: number, ir: number) => {
      ctx.fillStyle = evo || special ? 'rgba(226,178,60,.22)' : 'rgba(120,90,40,.1)';
      ctx.beginPath();
      ctx.arc(cx, cy, ir * 1.3, 0, TAU);
      ctx.fill();
      if (card.kind === 'pal' && card.pal) {
        PAL_POSE.t = now;
        PAL_POSE.roll = now * 6;
        paintPal(ctx, card.pal, cx, cy + ir * 0.8, ir * 2.2, PAL_POSE);
      } else if (special && card.tr) paintTreasureIcon(ctx, card.tr, cx, cy, ir * 0.85);
      else paintItemIcon(ctx, card.kind === 'apple' ? 'apple' : card.kind === 'scales' ? 'scales' : card.id!, cx, cy, ir, evo);
    };
    const tagColor = evo || special ? C.goldDeep : C.vermilionDeep;
    // the key that takes it (a keyboard's shortcut; a finger needs none)
    if (!L.touch) {
      ctx.font = font(800, 12 * u, SANS);
      ctx.fillStyle = 'rgba(42,34,51,.5)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(i + 1), r.x + 8 * u, r.y + 6 * u);
    }
    if (stacked) {
      // a full-width card: the icon in its well on the left; the name and its tag, the numbers, the note
      const pad = 11, ir = Math.min(21, r.h * 0.25);
      const icx = r.x + pad + ir * 1.3 + 4;
      icon(icx, r.y + r.h / 2, ir);
      const tx = icx + ir * 1.3 + 12, tw = r.x + r.w - pad - tx;
      const y1 = r.y + pad + 10;
      ctx.textBaseline = 'middle';
      let tagW = 0;
      if (tag) {
        // the tag takes what the name leaves (at least 40 % of the row)
        ctx.font = font(700, 17, SERIF);
        const nameW = ctx.measureText(title).width;
        ctx.textAlign = 'right';
        const tg = fit(ctx, tag, Math.max(tw * 0.4, tw - nameW - 10), 12.5, 800, SANS, MIN_TEXT);
        ctx.fillStyle = tagColor;
        ctx.fillText(tg, r.x + r.w - pad, y1);
        tagW = ctx.measureText(tg).width + 8;
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink;
      ctx.fillText(fit(ctx, title, tw - tagW, 17, 700, SERIF), tx, y1);
      const top = y1 + 13, bot = r.y + r.h - pad - (note ? 16 : 0);
      const p = para(ctx, desc, tw, bot - top, 15, MIN_READ, 500, SANS);
      ctx.fillStyle = C.inkSoft;
      ctx.textBaseline = 'top';
      p.lines.forEach((l, j) => ctx.fillText(l, tx, top + j * p.lineH));
      if (note) {
        ctx.textBaseline = 'bottom';
        const ns = fit(ctx, note, tw, 12.5, extra ? 800 : 600, SANS, MIN_TEXT);
        ctx.fillStyle = extra ? C.goldDeep : 'rgba(42,34,51,.66)';
        ctx.fillText(ns, tx, r.y + r.h - pad + 2);
      }
      return;
    }
    // a tall card (in a row): the icon on top, the name, the tag, the numbers, the note at the bottom
    const pad = 12 * u, ir = Math.min(24 * u, r.w * 0.14, r.h * 0.12);
    const cx = r.x + r.w / 2, iw = r.w - pad * 2;
    icon(cx, r.y + pad + ir * 1.3, ir);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    let y = r.y + pad + ir * 2.6 + 8 * u;
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 17 * u, SERIF);
    for (const l of wrap(ctx, title, iw, 2)) {
      ctx.fillText(l, cx, y);
      y += 20 * u;
    }
    if (tag) {
      ctx.fillStyle = tagColor;
      ctx.fillText(fit(ctx, tag, iw, 12.5 * u, 800, SANS, MIN_TEXT), cx, y + 1);
      y += 19 * u;
    }
    ctx.font = font(extra ? 800 : 600, 12.5 * u, SANS);
    const noteLines = note ? wrap(ctx, note, iw, 2) : [];
    const noteH = noteLines.length * 15 * u;
    const p = para(ctx, desc, iw, r.y + r.h - pad - noteH - 6 * u - y, 15 * u, MIN_READ, 500, SANS);
    ctx.fillStyle = C.inkSoft;
    p.lines.forEach((l, j) => ctx.fillText(l, cx, y + j * p.lineH));
    if (noteLines.length) {
      ctx.font = font(extra ? 800 : 600, 12.5 * u, SANS);
      ctx.fillStyle = extra ? C.goldDeep : 'rgba(42,34,51,.66)';
      noteLines.forEach((l, j) => ctx.fillText(l, cx, r.y + r.h - pad - noteH + j * 15 * u));
    }
  }

  /** The run's tally: what it gathered, how near the record, what each weapon did, and the button to the next run. */
  drawTally(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number): void {
    const ta = sim.tally;
    this.tallyBtn = null;
    if (!ta) return;
    const u = L.u, k = Math.min(1, ta.t / 0.3);
    ctx.fillStyle = `rgba(20,16,28,${0.62 * k})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const bars = ta.top.length;
    const { box, btn, cols } = tallyBox(L, bars);
    this.tallyBtn = btn;
    ctx.save();
    const sc = ease.outBack(k);
    ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
    ctx.scale(sc, sc);
    ctx.translate(-box.x - box.w / 2, -box.y - box.h / 2);
    panel(ctx, box, '#f6ecd2', C.gold, 14 * u);
    const x0 = box.x, w = box.w, colW = cols ? w * 0.5 : w;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(fit(ctx, t('tally.title', { n: ta.run }), w - 32, 21 * u, 800, SERIF, 15, true), x0 + w / 2, box.y + 26 * u);
    const vals: [string, string][] = [
      [t('tally.scales'), fmtNum(ta.scales)],
      [t('tally.time'), `${Math.floor(ta.time / 60)}:${String(Math.floor(ta.time % 60)).padStart(2, '0')}`],
      [t('tally.level'), String(ta.level)],
    ];
    const vy = box.y + 64 * u;
    vals.forEach(([lab, v], i) => {
      const cx = x0 + colW * (0.2 + 0.3 * i);
      ctx.font = font(800, 24 * u, SANS);
      ctx.fillStyle = i === 0 ? C.goldDeep : C.ink;
      ctx.fillText(v, cx, vy);
      if (i === 0 && ta.scales > 0) paintScale(ctx, cx - ctx.measureText(v).width / 2 - 12 * u, vy, 8 * u, 10, now);
      ctx.fillStyle = C.inkSoft;
      ctx.fillText(fit(ctx, lab, colW * 0.29, 13 * u, 600, SANS), cx, vy + 22 * u);
    });
    const line = ta.best ? t('tally.best') : ta.toBest > 0 ? t('tally.toBest', { scales: scalesText(ta.toBest) }) : '';
    if (line) {
      ctx.fillStyle = ta.best ? C.goldDeep : C.vermilionDeep;
      ctx.fillText(fit(ctx, line, colW - 28 * u, 14.5 * u, 700, SANS), x0 + colW / 2, vy + 50 * u);
    }
    // what each weapon did: the players' stat screen
    if (bars) {
      const bx = cols ? x0 + w * 0.53 : x0 + 20 * u, bw = cols ? w * 0.43 : w - 40 * u;
      let y = cols ? box.y + 58 * u : vy + 78 * u;
      ctx.textAlign = 'left';
      ctx.font = font(800, 13 * u, SANS);
      ctx.fillStyle = C.inkSoft;
      ctx.fillText(t('tally.dmg'), bx, y);
      y += 19 * u;
      const bh = 19 * u;
      for (const s of ta.top) {
        panel(ctx, { x: bx, y: y - bh / 2, w: bw, h: bh }, 'rgba(42,34,51,.12)', null, 5 * u);
        panel(ctx, { x: bx, y: y - bh / 2, w: Math.max(bh * 0.6, bw * s.share), h: bh }, 'rgba(226,178,60,.88)', null, 5 * u);
        ctx.fillStyle = C.ink;
        ctx.fillText(fit(ctx, `${sim.sourceName(s.src)} · ${Math.round(s.share * 100)}%`, bw - 12 * u, 13 * u, 700, SANS), bx + 7 * u, y + 0.5);
        y += 24 * u;
      }
      ctx.textAlign = 'center';
    }
    // the scales stay; then the button
    ctx.font = font(500, 13 * u, SANS);
    ctx.fillStyle = C.inkSoft;
    const kept = wrap(ctx, t('tally.kept'), colW - 32 * u, 2);
    const ky = btn.y - 12 * u - (kept.length - 0.5) * 16 * u;
    kept.forEach((l, i) => ctx.fillText(l, x0 + colW / 2, ky + i * 16 * u));
    button(ctx, btn, hand('tally.next', L.touch), ta.t >= RULES.tallyMin, false, 15 * u);
    ctx.restore();
  }

  /** The opening card (the first session) and the card of a land freed (its road won, the next fight), each with its button. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim): void {
    const st = sim.story;
    this.storyBtn = null;
    if (!st || st.t < 0) return;
    const u = L.u, k = Math.min(1, st.t / 0.35), out = st.dur - st.t < 0.3 ? (st.dur - st.t) / 0.3 : 1;
    const open = st.kind === 'open';
    const w = Math.min(L.right - L.left - 16, 480 * u), pad = 16 * u, tw = w - pad * 2;
    const room = L.bottom - L.top - 12, btnH = 46 * u;
    const ps = passage('eph6.16');
    const next = st.to ?? st.from;
    const key = `${st.kind}|${st.from}|${st.to}|${st.tier}|${st.first}|${w}|${room}`;
    let lay = this.storyCache?.key === key ? this.storyCache : null;
    if (!lay) {
      // measure first: the words at the largest size that fits the room (a German card on the smallest phone too)
      const titleText = open ? t('story.open.title') : t('story.land.title', { name: cap(dragonName(st.from)) });
      ctx.font = font(800, (open ? 24 : 21) * u, SERIF, true);
      const titleLines = open ? [cut(ctx, titleText, tw)] : wrap(ctx, titleText, tw, 2);
      const titleSize = (open ? 24 : 21) * u;
      const text = open ? t('story.open.text')
        : [t('story.land.sub', { town: townName(st.from), road: roadName(st.tier), next: `${townName(next)} (${roadName(st.toTier)})`, story: `${cap(dragonName(next))} ${townStory(next)}` }),
          ...(st.first ? [t('story.land.pal')] : [])].join(' ');
      const fixed = pad * 2 + titleLines.length * titleSize * 1.2 + 8 * u + 12 * u + btnH;
      let pick: { body: { lines: string[]; lineH: number }; size: number; pass: PassageLayout | null; h: number } | null = null;
      for (let size = 15 * u; size >= MIN_READ - 1e-6 && !pick; size -= 0.5) {
        ctx.font = font(500, size, SANS);
        const lines = wrap(ctx, text, tw);
        const bodyH = lines.length * size * 1.3;
        // the verse at 17 px or more: its reference line (62 % of it) then stays at the 11 px floor
        const pass = open ? layoutPassage(ctx, ps, tw, Math.max(40, room - fixed - bodyH - 10 * u), { max: 19, min: 17 }) : null;
        const h = fixed + bodyH + (pass ? pass.height + 10 * u : 0);
        const last = size - 0.5 < MIN_READ - 1e-6;
        if ((h <= room && (!pass || pass.fits)) || last) pick = { body: { lines, lineH: size * 1.3 }, size, pass, h: Math.min(room, h) };
      }
      lay = { key, h: pick!.h, titleLines, titleSize, body: pick!.body, bodySize: pick!.size, pass: pick!.pass };
      this.storyCache = lay;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(k, out));
    ctx.fillStyle = 'rgba(20,16,28,.62)';
    ctx.fillRect(0, 0, L.w, L.h);
    const h = lay.h;
    const r = { x: (L.left + L.right - w) / 2, y: L.top + 6 + Math.max(0, (room - h) * 0.4), w, h };
    panel(ctx, r, '#f6ecd2', C.gold, 14 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = r.x + w / 2;
    let y = r.y + pad;
    ctx.fillStyle = C.ink;
    ctx.font = font(800, lay.titleSize, SERIF, true);
    for (const l of lay.titleLines) {
      ctx.fillText(l, cx, y);
      y += lay.titleSize * 1.2;
    }
    y += 8 * u;
    ctx.font = font(500, lay.bodySize, SANS);
    ctx.fillStyle = C.inkSoft;
    // what does not fit the room is cut (only ever on a screen smaller than any phone checked)
    const maxBody = Math.max(1, Math.floor((r.y + h - pad - btnH - 12 * u - (lay.pass ? lay.pass.height + 10 * u : 0) - y) / lay.body.lineH));
    const body = lay.body.lines.length > maxBody ? [...lay.body.lines.slice(0, maxBody - 1), cut(ctx, lay.body.lines.slice(maxBody - 1).join(' '), tw)] : lay.body.lines;
    for (const l of body) {
      ctx.fillText(l, cx, y);
      y += lay.body.lineH;
    }
    if (lay.pass) drawPassage(ctx, ps, lay.pass, cx, y + 10 * u, { text: C.ink, ref: C.goldDeep });
    const bw = Math.min(230 * u, w - 40);
    const btn = { x: cx - bw / 2, y: r.y + h - pad * 0.75 - btnH, w: bw, h: btnH };
    this.storyBtn = btn;
    button(ctx, btn, hand(open ? 'story.tap' : 'story.next', L.touch), st.t >= 0.6, false, 15 * u);
    ctx.restore();
  }

  /** Linda's bubble over her head: under the status band, above the bottom edge, never over the dial. */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, k: number): void {
    const u = L.u;
    ctx.save();
    ctx.font = font(600, 14 * u, SANS);
    const maxW = Math.min(260 * u, L.right - L.left - 24);
    const lines = wrap(ctx, text, maxW - 22 * u, 3);
    const lh = 18 * u;
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22 * u), bh = lines.length * lh + 14 * u;
    let bx = Math.max(L.left + 8, Math.min(L.right - bw - 8, x - bw * 0.3));
    let by = Math.max(L.statBottom + 6, Math.min(L.bottom - bh - 10, y - bh - 12 * u));
    const d = L.swordHit, dTop = d.y - 26 * u;
    if (bx + bw > d.x - 6 && by + bh > dTop) {
      if (d.x - 6 - bw >= L.left + 8) bx = d.x - 6 - bw;
      else by = Math.max(L.statBottom + 6, dTop - bh - 6);
    }
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = 'rgba(42,34,51,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10 * u);
    ctx.fill();
    ctx.stroke();
    // the tail toward Linda
    const tx = Math.max(bx + 12, Math.min(bx + bw - 12, x));
    if (by + bh < y) {
      ctx.beginPath();
      ctx.moveTo(tx - 6 * u, by + bh - 1);
      ctx.lineTo(x, Math.min(y - 4, by + bh + 10 * u));
      ctx.lineTo(tx + 6 * u, by + bh - 1);
      ctx.fill();
    }
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11 * u, by + 7 * u + i * lh));
    ctx.restore();
  }
}
