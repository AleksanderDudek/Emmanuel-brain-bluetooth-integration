/**
 * Geoda's HUD, drawn on the canvas: the session's carats and the specimen they make so far, the
 * block (its name, progress and the telegraph) and the band's meters for it — the drip (activity)
 * and the continuity that sets clarity in a Wzrost, the shine (calm) with its polishing mark in a
 * Szlif — and the line of hints.  Portrait puts it above the wall, landscape in a column to its
 * left.  Every string is measured against the room it has (`statusRow`, fitFont).
 */
import { clamp } from '../kit/juice';
import { fitFont, rrect, SANS, SERIF, wrap } from './art';
import { CLARITY, SIZES } from './content';
import { t } from './i18n';
import type { Layout } from './layout';
import { sizeClass } from './meta';
import { clarityOf, type GeodaSim } from './sim';

export const PHASE_COLOR = { wzrost: '#ffd48a', zbior: '#e7b9ff', szlif: '#a9d4ff' } as const;
const PHASE_NAME = { wzrost: t('block.wzrost'), zbior: t('block.zbior'), szlif: t('block.szlif') } as const;
export const INK = '#efe8dc';
/** the shine past the Szlif's pass mark */
export const POLISH_ON = '#fff0b8';

const HAIR = String.fromCharCode(8202);
/** the gap between the block's name and the telegraph (px) */
const ROW_GAP = 8;
/** the smallest type the status row shrinks to (px) */
const ROW_MIN = 9;

/** The width of `text` in Manrope at `px` and `weight`. */
export type Measure = (text: string, px: number, weight: number) => number;

export interface StatusRow { name: string; nameFs: number; tele: string | null; teleFs: number }

/** The next block's telegraph ("za chwilę szlif") and its short form for a narrow column ("→ szlif"). */
export interface Telegraph { long: string; short: string }

/** The telegraphs before a Wzrost and before a Szlif. */
export const TELEGRAPH: Readonly<Record<'wzrost' | 'szlif', Telegraph>> = {
  wzrost: { long: t('tele.wzrost'), short: t('tele.wzrostShort') },
  szlif: { long: t('tele.szlif'), short: t('tele.szlifShort') },
};

/**
 * The block's name (capitals, 700) and the telegraph (600) on one row `w` px wide, at most
 * `fs` / `small` px: the name hair-spaced when both fit, else plain, else with the short telegraph
 * ("→ szlif"), else both in smaller type down to 9 px; on the narrowest column the name alone
 * (the light, the hum and the tick still announce the block).
 */
export function statusRow(measure: Measure, name: string, tele: Telegraph | null, w: number, fs: number, small: number): StatusRow {
  const caps = name.toUpperCase(), spaced = caps.split('').join(HAIR);
  const long = tele ? tele.long : null, short = tele ? tele.short : null;
  const fits = (n: string, nf: number, tt: string | null, tf: number) => measure(n, nf, 700) + (tt ? ROW_GAP + measure(tt, tf, 600) : 0) <= w;
  for (const [n, tt] of [[spaced, long], [caps, long], [caps, short]] as const) {
    if (fits(n, fs, tt, small)) return { name: n, nameFs: fs, tele: tt, teleFs: small };
  }
  for (let nf = fs, tf = small; nf > ROW_MIN || tf > ROW_MIN;) {
    nf = Math.max(ROW_MIN, nf - 0.5);
    tf = Math.max(ROW_MIN, tf - 0.5);
    if (fits(caps, nf, short, tf)) return { name: caps, nameFs: nf, tele: short, teleFs: tf };
  }
  let nf = fs;
  while (nf > ROW_MIN && !fits(caps, nf, null, 0)) nf = Math.max(ROW_MIN, nf - 0.5);
  return { name: caps, nameFs: nf, tele: null, teleFs: small };
}

/** Draws the HUD; returns where the landscape column's meters end (0 in portrait: the hint has its own line). */
export function drawHud(ctx: CanvasRenderingContext2D, l: Layout, sim: GeodaSim, shown: number): number {
  const hud = l.hud;
  let bottom = 0;
  const phase = sim.phase === 'wzrost' || sim.phase === 'zbior' || sim.phase === 'szlif' ? sim.phase : null;
  const carats = Math.round(shown);
  const size = sizeClass(sim.carats);
  const goal = t(SIZES[size.size].goal, { need: size.need ?? 0 });
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (!l.landscape) {
    // carats on the left, the block and the band's meters on the right
    const colW = hud.w * 0.5;
    const big = fitFont(ctx, String(carats), Math.round(clamp(hud.h * 0.62, 32, 50)), colW * 0.62, SERIF, 500);
    const base = hud.y + big * 0.9 + 2;
    ctx.fillStyle = INK;
    ctx.fillText(String(carats), hud.x, base);
    const nw = ctx.measureText(String(carats)).width;
    ctx.font = `600 14px ${SANS}`;
    ctx.fillStyle = 'rgba(239,232,220,0.6)';
    ctx.fillText('ct', hud.x + nw + 5, base);
    fitFont(ctx, goal, 12, colW + 6, SANS, 500, ROW_MIN);
    ctx.fillStyle = 'rgba(239,232,220,0.55)';
    ctx.fillText(goal, hud.x, base + 19);
    const w = Math.min(172, colW - 8);
    if (phase) drawStatus(ctx, sim, phase, hud.x + hud.w - w, hud.y + 2, w, true);
  } else {
    // a column: carats, the goal, the block, the band's meters
    const x = hud.x, w = Math.min(hud.w, 244);
    let y = hud.y;
    const big = fitFont(ctx, String(carats), Math.round(clamp(l.cell * 1.0, 34, 68)), w * 0.66, SERIF, 500);
    y += big * 0.9;
    ctx.fillStyle = INK;
    ctx.fillText(String(carats), x, y);
    const nw = ctx.measureText(String(carats)).width;
    ctx.font = `600 ${Math.round(clamp(big * 0.26, 13, 17))}px ${SANS}`;
    ctx.fillStyle = 'rgba(239,232,220,0.6)';
    ctx.fillText('ct', x + nw + 6, y);
    y += Math.round(clamp(big * 0.36, 17, 24));
    fitFont(ctx, goal, 13, w, SANS, 500, ROW_MIN);
    ctx.fillStyle = 'rgba(239,232,220,0.55)';
    ctx.fillText(goal, x, y);
    y += clamp(l.cell * 0.55, 16, 34);
    if (phase) bottom = y + drawStatus(ctx, sim, phase, x, y, w, l.cell < 40);
  }
  ctx.restore();
  return bottom;
}

/**
 * The block (its name, progress and the telegraph), then the band's meters for it: in a Wzrost
 * the drip (activity, drops per second) and the continuity that sets clarity; in a Szlif the
 * shine (calm).  Returns the height used.
 */
function drawStatus(ctx: CanvasRenderingContext2D, sim: GeodaSim, phase: 'wzrost' | 'zbior' | 'szlif', x: number, y: number, w: number, compact: boolean): number {
  const col = PHASE_COLOR[phase], tg = sim.telegraph;
  const fs = compact ? 11 : 13, small = compact ? 10.5 : 11.5;
  const blind = phase === 'wzrost' && sim.blindSlot >= 0;
  const bar = (bx: number, by: number, bw: number, bh: number, f: number, fill: string) => {
    rrect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.11)';
    ctx.fill();
    if (f <= 0) return;
    rrect(ctx, bx, by, Math.max(bh, bw * clamp(f)), bh, bh / 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };
  /** `text` at (tx, ty), fitted into `maxW` from `px` down */
  const put = (text: string, tx: number, ty: number, px: number, weight: number, maxW: number) => {
    fitFont(ctx, text, px, maxW, SANS, weight, ROW_MIN);
    ctx.fillText(text, tx, ty);
  };
  const measure: Measure = (text, px, weight) => {
    ctx.font = `${weight} ${px}px ${SANS}`;
    return ctx.measureText(text).width;
  };
  // the row: the block's name, and on its right the next block's telegraph
  const row = statusRow(measure, blind ? t('block.blind') : PHASE_NAME[phase], tg ? TELEGRAPH[tg.to] : null, w, fs, small);
  ctx.textAlign = 'left';
  ctx.font = `700 ${row.nameFs}px ${SANS}`;
  ctx.fillStyle = col;
  ctx.fillText(row.name, x, y + fs);
  if (tg && row.tele) {
    ctx.textAlign = 'right';
    ctx.font = `600 ${row.teleFs}px ${SANS}`;
    ctx.fillStyle = tg.to === 'wzrost' ? PHASE_COLOR.wzrost : PHASE_COLOR.szlif;
    ctx.fillText(row.tele, x + w, y + fs);
    ctx.textAlign = 'left';
  }
  let yy = y + fs + 6;
  bar(x, yy, w, compact ? 3 : 4, sim.blockProgress, col);
  yy += compact ? 10 : 20;
  /** a meter's label on the left, its value on the right, sharing the width */
  const label = (text: string, ly: number, right?: string) => {
    const rw = right ? measure(right, small, 600) : 0;
    ctx.fillStyle = 'rgba(239,232,220,0.5)';
    put(text, x, ly, small, 600, w - (right ? rw + ROW_GAP : 0));
    if (right) {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(239,232,220,0.85)';
      put(right, x + w, ly, small, 600, w * 0.6);
      ctx.textAlign = 'left';
    }
  };
  if (phase === 'wzrost') {
    // the drip: the band's activity right now
    const drip = blind ? 0 : clamp(sim.drip / 3.5);
    if (!compact) {
      label(t('meter.drip'), yy + small, blind ? t('meter.dark') : undefined);
      yy += small + 7;
    }
    ctx.fillStyle = blind ? 'rgba(200,226,255,0.25)' : 'rgba(200,226,255,0.9)';
    const g = compact ? 4.2 : 5;
    ctx.beginPath();
    ctx.moveTo(x + g, yy - g * 0.9);
    ctx.bezierCurveTo(x + g * 1.9, yy + g * 0.3, x + g * 1.6, yy + g * 1.1, x + g, yy + g * 1.1);
    ctx.bezierCurveTo(x + g * 0.4, yy + g * 1.1, x + g * 0.1, yy + g * 0.3, x + g, yy - g * 0.9);
    ctx.fill();
    bar(x + g * 2.6, yy, w - g * 2.6, compact ? 4 : 6, drip, '#bfe0ff');
    yy += compact ? 12 : 22;
    // continuity → clarity: mleczny under 4 s, czysty to 12 s, lśniący after
    const cont = sim.brain.cont, cl = clarityOf(cont);
    if (!compact) {
      label(t('meter.steady'), yy + small, blind ? '' : `${Math.floor(cont)} s`);
      yy += small + 7;
    }
    const segs = [[0, 4], [4, 12], [12, 16]] as const;
    const gap = 3, sw = (w - 2 * gap) / 16;
    let sx = x;
    const tones = ['#e9dcff', '#9fe3ff', '#fff0b8'];
    segs.forEach(([a, b], i) => {
      const ww = (b - a) * sw;
      bar(sx, yy, ww, compact ? 5 : 6, blind ? 0 : (cont - a) / (b - a), tones[i]);
      if (!compact) {
        const now = i + 1 === cl && !blind;
        ctx.fillStyle = now ? tones[i] : 'rgba(239,232,220,0.4)';
        ctx.textAlign = 'center';
        put(CLARITY[i + 1], sx + ww / 2, yy + 6 + small + 5, small - 1, now ? 700 : 500, ww + gap);
        ctx.textAlign = 'left';
      }
      sx += ww + gap;
    });
    if (compact) {
      ctx.fillStyle = 'rgba(239,232,220,0.8)';
      const clarity = cont >= 1 ? t('meter.clarity', { clarity: CLARITY[cl], sec: Math.floor(cont) }) : CLARITY[cl];
      put(blind ? t('meter.growingDark') : clarity, x, yy + 6 + small + 4, small, 600, w);
      yy += 6 + small + 6;
    } else yy += 6 + small + 8;
  } else if (phase === 'szlif') {
    // the shine fills with the calm part of the judged window; past the mark the best gem polishes
    const need = sim.polishNeed, on = sim.shine >= need && sim.bowl.length > 0;
    if (!compact) {
      label(t('meter.shine'), yy + small, on ? t('meter.polishing') : t('meter.fromCalm'));
      yy += small + 7;
    }
    const bh = compact ? 5 : 6;
    bar(x, yy, w, bh, sim.shine, on ? POLISH_ON : '#bfe0ff');
    ctx.fillStyle = on ? POLISH_ON : 'rgba(255,240,184,0.7)';
    rrect(ctx, Math.round(x + w * need) - 1, yy - 3, 2, bh + 6, 1);
    ctx.fill();
    if (compact) {
      ctx.fillStyle = on ? POLISH_ON : 'rgba(222,234,255,0.8)';
      put(on ? t('meter.shineOn') : t('meter.shineLine'), x, yy + 6 + small + 4, small, 600, w);
    }
    yy += 6 + small + 8;
  }
  return yy - y;
}

/** The line of hints: between the wall and the tray (portrait), under the meters (landscape, from `below`). */
export function drawHint(ctx: CanvasRenderingContext2D, l: Layout, text: string | null, below: number): void {
  if (!text) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (!l.landscape) {
    fitFont(ctx, text, 13.5, l.hint.w, SANS, 500, 10.5);
    ctx.fillStyle = 'rgba(239,232,220,0.8)';
    ctx.fillText(text, l.hint.x, l.hint.y);
  } else {
    // under the meters, never lower than the column's end
    const fs = l.cell < 40 ? 12.5 : 14, lh = fs * 1.4;
    ctx.font = `500 ${fs}px ${SANS}`;
    const lines = wrap(ctx, text, Math.min(l.hint.w, 250)).slice(0, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(239,232,220,0.8)';
    const last = l.hint.y - (lines.length - 1) * lh;
    const y0 = below > 0 ? Math.min(below + lh * 1.6, last) : last;
    lines.forEach((ln, i) => ctx.fillText(ln, l.hud.x, y0 + i * lh));
  }
  ctx.restore();
}
