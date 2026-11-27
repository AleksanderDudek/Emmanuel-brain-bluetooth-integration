/**
 * "Ciało słucha" on the canvas (DESIGN.md §27, kit/inner.ts): what the health visualisations draw of the inner layer,
 * shared by the engine (kit/healthlib) and Każdy włos.
 *
 *   the word     a word for the body (or a settling-in word) under the breath guide: the serif, centred, whole
 *                (≤ 3 lines, never cut), bright on the out-breath and ~45 % on the in-breath; its gold glow follows
 *                the band's calm
 *   the cue      the word of peace on the rest's last out-breath: larger and quieter, letter-spaced, its small label
 *                above it the first time in a session
 *   received     a word held in calm on its out-breath dissolves into light: 12–18 gold motes drift from the words
 *                band to the picture's growing point over ~1.6 s (reduced motion: the word fades with a soft glow)
 *   the night    "Przed snem": a dark veil and a warm amber wash over the picture (never over the words), and a small
 *                crescent with its label in the picture's corner
 *
 * Every text has the app's floor: 13 px and more (a word ≥ 15 px on a phone, larger on a desk).  No shadowBlur, no
 * filters: glows are the paint kit's sprites.
 */
import { NIGHT, type InnerShow } from './inner';
import { clamp, ease } from './juice';
import { MIN_READ } from './mobile';
import { GOLD, GOLD_HI, INK, LILAC, PEARL, font, glow, mix, wrap } from './healthlib/paint';

export interface Box { x: number; y: number; w: number; h: number }

export type WordKind = 'word' | 'settle' | 'cue';

/** The sizes a word is drawn at (px): from `max` down to `min` until it fits in ≤ 3 lines. */
export function wordSizes(kind: WordKind, desk: boolean, u: number): { max: number; min: number } {
  if (kind === 'cue') return desk ? { max: Math.round(32 * u), min: Math.max(20, Math.round(22 * u)) } : { max: 26, min: 18 };
  return desk ? { max: Math.round(23 * u), min: Math.max(17, Math.round(17 * u)) } : { max: 20, min: 15 };
}

const MAX_LINES = 3;
/** the cue's letter-spacing (em) */
const TRACK = 0.12;
const LABEL_PX = MIN_READ;

/** The label's height above a word (its line and a small gap). */
const labelH = (): number => Math.round(LABEL_PX * 1.35) + 4;

/** Width of a text with letter-spacing (the cue), in the current font. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, px: number): number {
  const chars = [...text];
  return chars.reduce((w, c) => w + ctx.measureText(c).width, 0) + Math.max(0, chars.length - 1) * TRACK * px;
}

/** Wrap a text with letter-spacing (the cue): words onto lines no wider than `maxW`. */
function wrapTracked(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    const next = line ? `${line} ${w}` : w;
    if (line && trackedWidth(ctx, next, px) > maxW) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export interface WordFit { size: number; lines: string[]; lineH: number; h: number }

/**
 * The largest size from max to min at which a word fits its box in ≤ 3 lines.  On the smallest band (a small phone's
 * rest, where the verse too steps down to 13 px) it may go on down to MIN_READ with closer lines — a word is never cut.
 */
export function fitWord(ctx: CanvasRenderingContext2D, kind: WordKind, text: string, w: number, h: number, desk: boolean, u: number): WordFit {
  const { max, min } = wordSizes(kind, desk, u);
  const at = (size: number, lh: number): WordFit => {
    ctx.font = font(size, 500, true, kind === 'settle');
    const lines = kind === 'cue' ? wrapTracked(ctx, text, w, size) : wrap(ctx, text, w);
    const lineH = Math.round(size * (kind === 'cue' ? 1.2 : lh));
    return { size, lines, lineH, h: lines.length * lineH };
  };
  const ok = (f: WordFit): boolean => f.lines.length <= MAX_LINES && f.h <= h;
  for (let size = max; size >= min; size -= 0.5) {
    const f = at(size, 1.32);
    if (ok(f)) return f;
  }
  for (let size = min; size >= MIN_READ; size -= 0.5) {
    const f = at(size, 1.22);
    if (ok(f)) return f;
  }
  return at(MIN_READ, 1.22);
}

/** The room a word needs at its design's smallest size (its lines at `min`, and its label): the band makes room for it. */
export function wordNeed(ctx: CanvasRenderingContext2D, kind: WordKind, text: string, w: number, desk: boolean, u: number, label: boolean): number {
  const { min } = wordSizes(kind, desk, u);
  ctx.font = font(min, 500, true, kind === 'settle');
  const lines = kind === 'cue' ? wrapTracked(ctx, text, w, min) : wrap(ctx, text, w);
  return lines.length * Math.round(min * (kind === 'cue' ? 1.2 : 1.32)) + (label ? labelH() : 0);
}

/** The gap under the breath guide (px): the design's, and the least it may close to when a word needs the room. */
const GAP = 11, GAP_MIN = 3;
let roomMemo: { key: string; share: number; gap: number } | null = null;

/**
 * The rest's breath guide, sized so that the rest's longest word fits whole under it in the words band: the design's
 * share of the band (62 %) when it fits, else a little less (52 %, 44 %), and the gap under it closing (11 → 3 px) —
 * chosen once for the whole rest, so the guide never jumps.  `guide(share)` lays the guide out at a share of the band
 * (the game's `wordsGuide`); `label(show)` is the small label a show carries.  Returns the guide and the gap.
 */
export function roomForWords<G extends { box: Box }>(
  ctx: CanvasRenderingContext2D, band: Box, plan: readonly InnerShow[], label: (s: InnerShow) => string | null, desk: boolean, u: number,
  guide: (share: number) => G | null,
): { g: G | null; gap: number } {
  const words = plan.filter((x): x is Exclude<InnerShow, { kind: 'verse' }> => x.kind !== 'verse');
  if (!words.length) return { g: guide(0.62), gap: GAP };
  const key = `${words.map(x => `${x.text}|${label(x) ?? ''}`).join('|')}|${Math.round(band.w)}x${Math.round(band.h)}|${desk}|${u}`;
  if (roomMemo?.key !== key) {
    const need = Math.max(...words.map(x => wordNeed(ctx, x.kind, x.text, band.w, desk, u, label(x) !== null)));
    let pick = { share: 0.62, gap: GAP };
    search: for (const gap of [GAP, GAP_MIN]) {
      for (const share of [0.62, 0.52, 0.44]) {
        pick = { share, gap };
        const g = guide(share);
        if (g && band.y + band.h - (g.box.y + g.box.h + gap) >= need) break search;
      }
    }
    roomMemo = { key, ...pick };
  }
  return { g: guide(roomMemo.share), gap: roomMemo.gap };
}

/** How bright the word is through the breath: ~45 % on the in-breath, rising to full on the out-breath. */
export function wordLum(out: boolean, p: number): number {
  if (!out) return 0.45;
  const rise = ease.inOutSine(clamp(p / 0.14));
  const fall = 1 - ease.inOutSine(clamp((p - 0.9) / 0.1));
  return 0.45 + 0.55 * Math.min(rise, fall);
}

export interface WordArgs {
  kind: WordKind;
  text: string;
  /** the out-breath, and how far through its half (0..1) */
  out: boolean;
  p: number;
  /** the band's calm now (0..1): the gold glow */
  calm: number;
  /** a small label above (the cue's the first time, the settling-in rest's), or none */
  label?: string | null;
  desk: boolean;
  u: number;
}

interface Mote { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; delay: number; dur: number; t: number; r: number }

/**
 * One view's inner effects: where the word was last drawn, its dissolve when received, and the motes of light that
 * carry it into the picture.
 */
export class InnerFx {
  /** the last word drawn (its box on the screen) */
  wordAt: Box | null = null;
  private dissolve = { text: '', t: -1 };
  private readonly motes: Mote[] = [];
  /** the last fits (a word keeps its size for its whole rest; measuring once, not every frame) */
  private readonly fits = new Map<string, WordFit>();

  private fit(ctx: CanvasRenderingContext2D, kind: WordKind, text: string, w: number, h: number, desk: boolean, u: number): WordFit {
    const key = `${kind}|${text}|${Math.round(w)}|${Math.round(h)}|${desk}|${u}`;
    let f = this.fits.get(key);
    if (!f) {
      if (this.fits.size > 24) this.fits.clear();
      f = fitWord(ctx, kind, text, w, h, desk, u);
      this.fits.set(key, f);
    }
    return f;
  }

  constructor(private readonly reduced: boolean) {}

  /** A word was received: it dissolves into light, and (with motion) its motes drift to `to`. */
  received(text: string, to: { x: number; y: number }, rnd: () => number = Math.random): void {
    this.dissolve = { text, t: 0 };
    const at = this.wordAt;
    if (this.reduced || !at) return;
    const n = 12 + Math.floor(rnd() * 7);
    for (let i = 0; i < n; i++) {
      const x0 = at.x + at.w * (0.15 + 0.7 * rnd()), y0 = at.y + at.h * (0.2 + 0.6 * rnd());
      const x1 = to.x + (rnd() - 0.5) * 14, y1 = to.y + (rnd() - 0.5) * 14;
      // the way bows gently upward and aside, each mote a little differently
      const cx = (x0 + x1) / 2 + (rnd() - 0.5) * Math.abs(x1 - x0 + 40) * 0.6;
      const cy = Math.min(y0, y1) - 30 - 50 * rnd();
      this.motes.push({ x0, y0, cx, cy, x1, y1, delay: i * 0.045 + 0.1 * rnd(), dur: 1.15 + 0.45 * rnd(), t: 0, r: 1.4 + 1.3 * rnd() });
    }
  }

  get moving(): number { return this.motes.length; }

  update(dt: number): void {
    if (this.dissolve.t >= 0) {
      this.dissolve.t += dt;
      if (this.dissolve.t > 1.6) this.dissolve.t = -1;
    }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.t += dt;
      if (m.t > m.delay + m.dur) this.motes.splice(i, 1);
    }
  }

  /** The motes of light on their way into the picture (screen space). */
  drawMotes(ctx: CanvasRenderingContext2D): void {
    if (!this.motes.length) return;
    ctx.save();
    for (const m of this.motes) {
      const k = clamp((m.t - m.delay) / m.dur);
      if (k <= 0) continue;
      const e = ease.inOutSine(k);
      const a = 1 - e, b = e;
      const x = a * a * m.x0 + 2 * a * b * m.cx + b * b * m.x1;
      const y = a * a * m.y0 + 2 * a * b * m.cy + b * b * m.y1;
      const fade = Math.min(1, k / 0.15) * (1 - ease.inOutSine(clamp((k - 0.8) / 0.2)));
      glow(ctx, GOLD, x, y, m.r * 6, 0.7 * fade);
      ctx.globalAlpha = 0.95 * fade;
      ctx.fillStyle = GOLD_HI;
      ctx.beginPath();
      ctx.arc(x, y, m.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * A word in its box: its label (if any) at the top, the word under it — centred in the box on a phone, at its top
   * on a desk — whole, in the serif.  Returns the word's own box.
   */
  drawWord(ctx: CanvasRenderingContext2D, box: Box, w: WordArgs): Box {
    let lab = w.label ? labelH() : 0;
    let fit = this.fit(ctx, w.kind, w.text, box.w, box.h - lab, w.desk, w.u);
    // no room for the label on the smallest band: the word goes first
    if (lab && fit.h > box.h - lab) {
      lab = 0;
      fit = this.fit(ctx, w.kind, w.text, box.w, box.h, w.desk, w.u);
    }
    const cx = box.x + box.w / 2;
    let y = box.y + (w.desk ? 0 : Math.max(0, (box.h - lab - fit.h) / 2));
    // the breath's brightness; a received word goes into light, then comes back as the breath's dim word
    let lum = wordLum(w.out, w.p);
    let flare = 0;
    if (this.dissolve.t >= 0 && this.dissolve.text === w.text) {
      const t = this.dissolve.t;
      const gone = ease.inOutSine(clamp(t / 0.9)), back = ease.inOutSine(clamp((t - 1.05) / 0.5));
      lum *= 1 - gone * (1 - back);
      flare = Math.sin(Math.PI * clamp(t / 0.9));
    }
    const calm = clamp(w.calm) * (w.out ? 1 : 0.4);
    const cue = w.kind === 'cue';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (w.label && lab) {
      ctx.font = font(LABEL_PX, 700);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = cue ? GOLD : LILAC;
      drawTracked(ctx, w.label.toLocaleUpperCase(), cx, y + LABEL_PX * 0.7, LABEL_PX, 0.1);
      y += lab;
    }
    const top = y;
    ctx.font = font(fit.size, 500, true, w.kind === 'settle');
    const widths = fit.lines.map(l => (cue ? trackedWidth(ctx, l, fit.size) : ctx.measureText(l).width));
    const ww = Math.min(box.w, Math.max(0, ...widths));
    const quiet = cue ? 0.86 : 1;
    const base = cue ? mix(PEARL, GOLD, 0.3) : w.kind === 'settle' ? mix(PEARL, LILAC, 0.35) : PEARL;
    const fill = mix(base, GOLD_HI, 0.15 + 0.55 * calm);
    // the glow behind the word follows the calm (and flares as a received word dissolves)
    glow(ctx, GOLD, cx, top + fit.h / 2, Math.max(ww * 0.62, fit.h), (0.1 + 0.3 * calm) * lum * quiet + 0.35 * flare);
    ctx.globalAlpha = clamp(lum * quiet);
    ctx.lineJoin = 'round';
    for (const line of fit.lines) {
      const ly = y + fit.lineH / 2;
      if (cue) {
        ctx.fillStyle = fill;
        drawTracked(ctx, line, cx, ly, fit.size, TRACK, 'rgba(10,5,22,.55)');
      } else {
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(10,5,22,.55)';
        ctx.strokeText(line, cx, ly);
        ctx.fillStyle = fill;
        ctx.fillText(line, cx, ly);
      }
      y += fit.lineH;
    }
    ctx.restore();
    this.wordAt = { x: cx - ww / 2, y: top, w: ww, h: fit.h };
    return this.wordAt;
  }
}

/** A line with letter-spacing (em of `px`), centred at x: character by character (the canvas's own is not everywhere). */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, px: number, em: number, stroke?: string): void {
  const chars = [...text];
  const widths = chars.map(c => ctx.measureText(c).width);
  const total = widths.reduce((s, v) => s + v, 0) + Math.max(0, chars.length - 1) * em * px;
  let x = cx - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = 'left';
  if (stroke) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    let sx = x;
    chars.forEach((c, i) => {
      ctx.strokeText(c, sx, y);
      sx += widths[i] + em * px;
    });
  }
  chars.forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += widths[i] + em * px;
  });
  ctx.textAlign = align;
}

/**
 * "Przed snem" over the picture: a dark veil (less light) and a warm amber wash (multiply: less blue) — drawn under
 * the words and the controls, so they stay legible.  `k` fades it in (0..1).
 */
export function drawNightVeil(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k = 1): void {
  if (k <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(4,2,12,${(NIGHT.veil * k).toFixed(3)})`;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(255,178,104,${(NIGHT.warm * k).toFixed(3)})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** "Przed snem"'s small mark: a crescent and its label, right-aligned at (x, y) — the picture's top corner. */
export function drawNightMark(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha = 0.78): void {
  const px = MIN_READ;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(px, 700);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(text).width;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = LILAC;
  ctx.fillText(text, x, y);
  // the crescent: a disc with a disc cut out of it
  const r = px * 0.48, mx = x - tw - r - 6;
  ctx.beginPath();
  ctx.arc(mx, y, r, 0, Math.PI * 2);
  ctx.arc(mx + r * 0.55, y - r * 0.3, r * 0.82, 0, Math.PI * 2, true);
  ctx.fillStyle = GOLD;
  ctx.fill('evenodd');
  ctx.restore();
}
