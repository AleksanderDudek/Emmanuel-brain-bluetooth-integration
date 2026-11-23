/**
 * One breath guide for every game that guides a breath (DESIGN.md §19.3): big, high-contrast, the same everywhere.
 *
 * The founder (2026-11-23): *"Poprawić widoczność i czytelność instrukcji oddechowych w grach, w których one
 * występują."*  Until round 15 each meditation drew its own small line ("Wdech · 3   oddech 2 z 3", 15 px, lilac on a
 * bright scene).  The guide reads at a glance, on any picture:
 *
 *   - a dark scrim under it (contrast on any scene, ≥ 4.5 : 1 for the words);
 *   - a ring whose inner disc fills with the lungs (rising in, full while held, falling out, small while empty), the
 *     phase's progress as an arc around it, and the phase's seconds left big inside;
 *   - the phase in a word (≥ 20 px) under or beside it, coloured by phase (and named, so colour is never the only
 *     cue), and a small line under that ("oddech 2 z 3", ≥ 13 px).
 *
 * `stack` (default) puts the word under the ring — the usual slot is the middle of the scene; `row` puts it beside the
 * ring — for a wide, short band.  Pure drawing: the caller gives the breath (kit/breath.ts `breathAt`) and the place.
 * The runner draws the same guide in DOM for games without one of their own (src/arcade/pacer.ts).
 */
import { t } from '../../i18n/rhythm';
import type { BreathPhase, BreathState } from './breath';
import { MIN_READ } from './mobile';

export const GUIDE_FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';
/** The phase word never smaller than this (CSS px). */
export const GUIDE_WORD_MIN = 20;

/** Each phase's colour (ring, arc, disc); the words stay white. */
export const PHASE_COLOR: Readonly<Record<BreathPhase, string>> = {
  in: '#9fd8ff',
  holdIn: '#ffe2a0',
  out: '#b8f0d6',
  holdOut: '#cbc4ff',
};

/** The phases in words, in the page's language: Wdech / Zatrzymaj / Wydech / Pauza. */
export function breathWords(): Record<BreathPhase, string> {
  return { in: t('breath.in'), holdIn: t('breath.holdIn'), out: t('breath.out'), holdOut: t('breath.holdOut') };
}

/** "oddech 2 z 3" in the page's language. */
export const breathOf = (n: number, of: number): string => t('breath.of', { n, of });

export interface BreathGuideOpts {
  /** the ring's centre (CSS px) */
  cx: number;
  cy: number;
  /** the ring's radius (CSS px): `breathGuideRadius(w, h)` is the recommended one */
  r: number;
  /** the phases' words (default `breathWords()`) */
  words?: Readonly<Record<BreathPhase, string>>;
  /** a small line under the word: "oddech 2 z 3" */
  sub?: string;
  /** the whole guide's opacity (a fade in and out) */
  alpha?: number;
  /** one colour for every phase instead of PHASE_COLOR */
  accent?: string;
  /** the word under the ring (default) or beside it */
  layout?: 'stack' | 'row';
  /** the widest the words may take (CSS px); longer words shrink down to GUIDE_WORD_MIN, then 16 px */
  maxW?: number;
  /** no pulse while held */
  reducedMotion?: boolean;
  /** seconds since some start, for the held breath's slow pulse */
  time?: number;
  /** the scrim's opacity 0..1 (default 0.6); 0 for a scene that is already dark */
  scrim?: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const font = (px: number, w = 700): string => `${w} ${Math.round(px)}px ${GUIDE_FONT}`;

/** The recommended ring radius for a canvas of w × h CSS px: 26 px on a phone, up to 60 on a big screen. */
export function breathGuideRadius(w: number, h: number): number {
  return Math.round(Math.max(26, Math.min(60, Math.min(w, h) * 0.07)));
}

interface Metrics { wordPx: number; subPx: number; wordW: number; subW: number; pad: number }

function metrics(ctx: CanvasRenderingContext2D, o: BreathGuideOpts): Metrics {
  const words = o.words ?? breathWords();
  const longest = Object.values(words).reduce((a, b) => (b.length > a.length ? b : a), '');
  let wordPx = Math.max(GUIDE_WORD_MIN, Math.round(o.r * (o.layout === 'row' ? 0.62 : 0.5)));
  const maxW = o.maxW ?? Infinity;
  ctx.font = font(wordPx);
  let wordW = ctx.measureText(longest).width;
  while (wordW > maxW && wordPx > 16) {
    wordPx -= 1;
    ctx.font = font(wordPx);
    wordW = ctx.measureText(longest).width;
  }
  const subPx = Math.max(MIN_READ, Math.round(wordPx * 0.64));
  let subW = 0;
  if (o.sub) {
    ctx.font = font(subPx, 600);
    subW = ctx.measureText(o.sub).width;
  }
  return { wordPx, subPx, wordW, subW, pad: Math.max(10, Math.round(o.r * 0.3)) };
}

/** What the guide covers (its scrim), so a layout can keep other things clear of it. */
export function breathGuideBox(ctx: CanvasRenderingContext2D, o: BreathGuideOpts): { x: number; y: number; w: number; h: number } {
  const m = metrics(ctx, o), r = o.r;
  if (o.layout === 'row') {
    const textW = Math.max(m.wordW, m.subW);
    const w = m.pad + 2 * r + m.pad * 0.9 + textW + m.pad;
    const h = Math.max(2 * r, m.wordPx + (o.sub ? m.subPx * 1.3 : 0)) + 2 * m.pad * 0.7;
    return { x: o.cx - w / 2, y: o.cy - h / 2, w, h };
  }
  const textH = m.wordPx * 1.25 + (o.sub ? m.subPx * 1.35 : 0);
  const w = Math.max(2 * r + 2 * m.pad, Math.max(m.wordW, m.subW) + 2 * m.pad);
  const top = o.cy - r - m.pad * 0.8;
  const h = 2 * r + m.pad * 0.8 + r * 0.32 + textH + m.pad * 0.6;
  return { x: o.cx - w / 2, y: top, w, h };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rad: number): void {
  const q = Math.min(rad, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

/** Draw the guide for breath `b` (kit/breath.ts `breathAt`). */
export function drawBreathGuide(ctx: CanvasRenderingContext2D, b: BreathState, o: BreathGuideOpts): void {
  const a = clamp01(o.alpha ?? 1);
  if (a <= 0.01) return;
  const words = o.words ?? breathWords();
  const m = metrics(ctx, o);
  const box = breathGuideBox(ctx, o);
  const color = o.accent ?? PHASE_COLOR[b.phase];
  const row = o.layout === 'row';
  const r = o.r;
  const rx = row ? box.x + m.pad + r : o.cx, ry = row ? o.cy : o.cy;
  const hold = b.phase === 'holdIn' || b.phase === 'holdOut';
  ctx.save();
  ctx.globalAlpha = a;
  // the scrim: the words read on any picture
  const scrim = o.scrim ?? 0.6;
  if (scrim > 0) {
    ctx.fillStyle = `rgba(6,8,18,${scrim})`;
    roundRect(ctx, box.x, box.y, box.w, box.h, Math.min(box.h / 2, r * 0.9 + m.pad));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // the lungs: a disc that fills with the breath (a held breath glows softly, slowly)
  const pulse = hold && !o.reducedMotion ? 0.5 + 0.5 * Math.sin((o.time ?? 0) * 2.4) : 0;
  const k = clamp01(b.k);
  const inner = r * (0.3 + 0.62 * k);
  const g = ctx.createRadialGradient(rx, ry, inner * 0.15, rx, ry, inner);
  g.addColorStop(0, `${color}88`);
  g.addColorStop(1, `${color}${hold ? '40' : '2a'}`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(rx, ry, inner, 0, Math.PI * 2);
  ctx.fill();
  if (hold) {
    ctx.globalAlpha = a * (0.25 + 0.2 * pulse);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.beginPath();
    ctx.arc(rx, ry, inner + r * 0.06, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = a;
  }
  // the track and the phase's progress around it
  const lw = Math.max(3, r * 0.09);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.arc(rx, ry, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(b.p));
  ctx.stroke();
  // the seconds left in the phase, big in the ring
  const left = Math.max(1, Math.ceil(b.left - 1e-6));
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(Math.max(14, r * 0.78), 800);
  ctx.fillText(String(left), rx, ry + r * 0.04);
  // the phase in a word, and the small line
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 6;
  if (row) {
    const tx = rx + r + m.pad * 0.9;
    const twoLines = !!o.sub;
    const wy = twoLines ? ry - m.subPx * 0.55 : ry;
    ctx.textAlign = 'left';
    ctx.font = font(m.wordPx);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(words[b.phase], tx, wy);
    if (o.sub) {
      ctx.font = font(m.subPx, 600);
      ctx.fillStyle = 'rgba(235,240,255,.86)';
      ctx.fillText(o.sub, tx, wy + m.wordPx * 0.5 + m.subPx * 0.75);
    }
  } else {
    const wy = ry + r + r * 0.32 + m.wordPx * 0.62;
    ctx.font = font(m.wordPx);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(words[b.phase], rx, wy);
    if (o.sub) {
      ctx.font = font(m.subPx, 600);
      ctx.fillStyle = 'rgba(235,240,255,.86)';
      ctx.fillText(o.sub, rx, wy + m.wordPx * 0.62 + m.subPx * 0.8);
    }
  }
  ctx.restore();
}
