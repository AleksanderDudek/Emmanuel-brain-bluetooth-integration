/**
 * Złota passa's cards over the street (DESIGN.md §26), drawn by the game after the street's frame: the story card of a
 * first-ever dawn (what the game is, and the root verse Rom 8:28) and the verse cards (the dawn, a heavy moment's name,
 * the garland, the prayer, the close) — kit/scripture's passage on a dark scrim, faded in and out, in the layout's
 * `story` place (builder B's layout.ts) — moved below the runner's breath pacer in a rest where the two would meet.
 * Also the choices' tap targets (the layout's slots, only while the choices are open), and (round 25) the opening card
 * that asks for the age group when it was never chosen: five chips in the story place, as Stop-klatka's.
 */
import { AGES, AGE_SPAN } from '../kit/ages';
import { MIN_TAP, TAP_GAP } from '../kit/mobile';
import { passage, layoutPassage, drawPassage, REF_FONT, wrapLines, type Passage, type PassageLayout } from '../kit/scripture';
import { clamp } from '../kit/juice';
import { overlaps, pacerBox, pacerSizeAt } from '../kit/pacerspot';
import type { TapTarget } from '../kit/types';
import { ROOT } from './content';
import { t } from './i18n';
import { cardFor, type Layout } from './layout';
import type { PassaSim } from './sim';
import type { Rect } from './view';

/**
 * Where the cards go: the layout's story place when it has one, else the street's upper middle (≤ 560 px wide).  In a
 * rest (`rest`) the runner's breath pacer stands at the layout's `pacer`: a card it would cover moves down below it.
 */
export function cardRect(l: Layout, rest = false): Rect {
  const own = l.story;
  const r = own && own.w > 40 && own.h > 40 ? own : (() => {
    const w = Math.min(560, l.w - 32);
    const h = Math.min(200, Math.max(110, l.scene.h * 0.4));
    return { x: (l.w - w) / 2, y: l.scene.y + Math.max(8, l.scene.h * 0.05), w, h };
  })();
  const p = l.pacer;
  if (!rest || !p) return r;
  // the pacer's room as the kit keeps it (the big screen's, which holds on any screen)
  const box = pacerBox(p, pacerSizeAt(p, true));
  if (!overlaps(r, box)) return r;
  const y = box.y + box.h + 8;
  return { x: r.x, y, w: r.w, h: Math.max(80, r.y + r.h - y) };
}

/**
 * Where a verse goes while a moment's card is up (a heavy moment's name: Ps 34:18): above the card, in the street's
 * part under the HUD (the runner's pacer stands beside or below the card, never above it); null when there is no room.
 */
export function aboveCard(l: Layout): Rect | null {
  const c = cardFor(l, 0);
  const top = (l.band?.y ?? l.scene.y) + 6;
  const h = Math.min(170, c.y - 8 - top);
  if (h < 80) return null;
  return { x: c.x, y: c.y - 8 - h, w: c.w, h };
}

/** The ask card's measures: inner padding, title, text line, chip height, gap. */
const ASK = { pad: 14, title: 18, text: 14, line: 19, chip: Math.max(MIN_TAP, 46), gap: Math.max(TAP_GAP + 2, 8), msg: 13 };

/** A context to measure text with when none is given (hit-testing wraps the ask card's text as its drawing does). */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function measure(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    } catch {
      measureCtx = null;
    }
  }
  return measureCtx ?? null;
}

/** The ask card's text lines at a width (the same wrap in drawing and in hit-testing). */
function askLines(given: CanvasRenderingContext2D | null, w: number): string[] {
  const text = t('ask.text');
  const ctx = given ?? measure();
  if (!ctx || typeof ctx.measureText !== 'function') {
    // no canvas (a test): words shared over as many lines as ~7.4 px a character needs
    const words = text.split(' ');
    const n = Math.max(1, Math.min(4, Math.ceil(([...text].length * 7.4) / Math.max(80, w))));
    const per = Math.ceil(words.length / n);
    return Array.from({ length: n }, (_, i) => words.slice(i * per, (i + 1) * per).join(' ')).filter(Boolean);
  }
  ctx.save();
  ctx.font = `500 ${ASK.text}px ${REF_FONT}`;
  const lines = wrapLines(ctx, text, w);
  ctx.restore();
  return lines;
}

/**
 * The five age chips of the ask card in `r` (the card's place): one row when each chip is at least 52 px wide, else
 * three and two; under the title and the text (`lines` of it).
 */
export function ageRects(r: Rect, lines: number): Rect[] {
  const { pad, title, line, chip, gap } = ASK;
  const w = r.w - 2 * pad;
  const top = r.y + pad + title + 8 + lines * line + 10;
  const one = (w - 4 * gap) / 5 >= 52;
  const out: Rect[] = [];
  if (one) {
    const cw = (w - 4 * gap) / 5;
    for (let i = 0; i < 5; i++) out.push({ x: r.x + pad + i * (cw + gap), y: top, w: cw, h: chip });
    return out;
  }
  const c3 = (w - 2 * gap) / 3;
  for (let i = 0; i < 3; i++) out.push({ x: r.x + pad + i * (c3 + gap), y: top, w: c3, h: chip });
  const x2 = r.x + pad + (w - (2 * c3 + gap)) / 2;
  for (let i = 0; i < 2; i++) out.push({ x: x2 + i * (c3 + gap), y: top + chip + gap, w: c3, h: chip });
  return out;
}

/** The ask card's rect (the story place, as tall as its content) and its chips. */
export function askLayout(l: Layout, ctx: CanvasRenderingContext2D | null = null): { box: Rect; chips: Rect[]; lines: string[] } {
  const r = cardRect(l, false);
  const lines = askLines(ctx, r.w - 2 * ASK.pad);
  const chips = ageRects(r, lines.length);
  const last = chips[chips.length - 1];
  const h = last.y + last.h + 10 + ASK.msg + 6 + ASK.pad - r.y;
  return { box: { x: r.x, y: r.y, w: r.w, h }, chips, lines };
}

/** The age chips as tap targets while the ask card is open. */
export function askTargets(l: Layout): TapTarget[] {
  return askLayout(l).chips.map((r, i) => ({ label: AGE_SPAN[AGES[i]], ...r }));
}

/** The age chip under a tap (−1: none). */
export function askAt(l: Layout, x: number, y: number): number {
  return askLayout(l).chips.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

/** The choices' slots as tap targets (only while the choices are open). */
export function choiceTargets(l: Layout, labels: readonly string[]): TapTarget[] {
  return labels.slice(0, l.choices.length).map((label, i) => ({ label, ...l.choices[i] }));
}

/** The choice under a tap (−1: none). */
export function choiceAt(l: Layout, n: number, x: number, y: number): number {
  for (let i = 0; i < Math.min(n, l.choices.length); i++) {
    const r = l.choices[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export class Cards {
  private cache: { key: string; p: Passage; l: PassageLayout } | null = null;
  private storyA = 0;
  private askA = 0;
  private verseA = 0;
  private lastVerse: string | null = null;

  /** Draw the cards of this frame; `dt` real seconds. */
  draw(ctx: CanvasRenderingContext2D, sim: PassaSim, l: Layout, dt: number, reduced: boolean): void {
    // a verse while the moment's card is up (the name) stands above the card; elsewhere in the story place
    const named = sim.block.what === 'name';
    const r = named ? aboveCard(l) : cardRect(l, sim.restBlock);
    if (!r) return;
    // the story card: in and out with a first-ever dawn
    this.storyA = reduced ? (sim.story ? 1 : 0) : clamp(this.storyA + (sim.story ? dt / 0.5 : -dt / 0.4));
    if (this.storyA > 0.01) {
      this.story(ctx, r, this.storyA);
      return;
    }
    // the age card (a session whose group was never chosen): in and out like the story card
    const ask = sim.askOpen;
    this.askA = reduced ? (ask ? 1 : 0) : clamp(this.askA + (ask ? dt / 0.4 : -dt / 0.4));
    if (this.askA > 0.01) {
      this.ask(ctx, l, sim, this.askA);
      return;
    }
    const v = sim.verse;
    // the runner's coach mark (a first-time explanation, centred) goes first: the card comes in after it
    const showing = !!v && sim.t >= Math.min(sim.hintUntil, v.t0 + Math.max(0, v.dur - 3)) && sim.t < v.t0 + v.dur;
    if (v) this.lastVerse = v.id;
    const left = v ? v.t0 + v.dur - sim.t : 0;
    const want = showing ? (Number.isFinite(left) ? clamp(left / 0.5) : 1) : 0;
    this.verseA = reduced ? want : want > this.verseA ? clamp(this.verseA + dt / 0.5, 0, want) : clamp(this.verseA - dt / 0.4, want, 1);
    if (this.verseA <= 0.01 || !this.lastVerse) return;
    this.verse(ctx, this.lastVerse, r, this.verseA);
  }

  private layoutOf(ctx: CanvasRenderingContext2D, id: string, w: number, h: number, max: number): { p: Passage; l: PassageLayout } {
    const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
    if (this.cache?.key !== key) {
      const p = passage(id as Parameters<typeof passage>[0]);
      this.cache = { key, p, l: layoutPassage(ctx, p, w, h, { max, min: 13 }) };
    }
    return this.cache;
  }

  private scrim(ctx: CanvasRenderingContext2D, r: Rect, a: number): void {
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,14,10,0.84)';
    ctx.strokeStyle = 'rgba(255,214,140,0.38)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private verse(ctx: CanvasRenderingContext2D, id: string, r: Rect, a: number): void {
    const pad = 14;
    const { p, l } = this.layoutOf(ctx, id, r.w - 2 * pad, r.h - 2 * pad, r.w > 420 ? 20 : 17);
    const h = Math.min(r.h, l.height + 2 * pad);
    const box = { x: r.x, y: r.y, w: r.w, h };
    this.scrim(ctx, box, a);
    ctx.save();
    ctx.globalAlpha = a;
    drawPassage(ctx, p, l, box.x + box.w / 2, box.y + pad, { text: '#fff6e4', ref: 'rgba(255,220,160,0.88)' });
    ctx.restore();
  }

  /** The age card: "Czyj to dzień?", a line, the five chips (the chosen one gold), the default or the chosen group. */
  private ask(ctx: CanvasRenderingContext2D, l: Layout, sim: PassaSim, a: number): void {
    const { box, chips, lines } = askLayout(l, ctx);
    const { pad } = ASK;
    this.scrim(ctx, box, a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = box.x + box.w / 2;
    ctx.fillStyle = '#ffd98a';
    ctx.font = `700 ${ASK.title}px ${REF_FONT}`;
    ctx.fillText(t('ask.title'), cx, box.y + pad);
    ctx.fillStyle = '#fff6e4';
    ctx.font = `500 ${ASK.text}px ${REF_FONT}`;
    lines.forEach((s, i) => ctx.fillText(s, cx, box.y + pad + ASK.title + 8 + i * ASK.line));
    chips.forEach((r, i) => {
      const on = sim.agePicked === i;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 12);
      ctx.fillStyle = on ? '#ffd98a' : 'rgba(255,236,205,0.10)';
      ctx.fill();
      ctx.lineWidth = on ? 2 : 1;
      ctx.strokeStyle = on ? '#fff1c8' : 'rgba(255,214,140,0.55)';
      ctx.stroke();
      ctx.fillStyle = on ? '#2a1b10' : '#fff6e4';
      ctx.font = `700 ${r.w < 60 ? 15 : 16}px ${REF_FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(AGE_SPAN[AGES[i]], r.x + r.w / 2, r.y + r.h / 2 + 1);
      ctx.textBaseline = 'top';
    });
    const last = chips[chips.length - 1];
    ctx.fillStyle = 'rgba(255,230,190,0.86)';
    ctx.font = `500 ${ASK.msg}px ${REF_FONT}`;
    const msg = sim.agePicked >= 0 ? t('ask.chosen', { span: AGE_SPAN[sim.age] }) : t('ask.def', { span: AGE_SPAN[sim.age] });
    ctx.fillText(msg, cx, last.y + last.h + 10, box.w - 2 * pad);
    ctx.restore();
  }

  private story(ctx: CanvasRenderingContext2D, r: Rect, a: number): void {
    const pad = 14, w = r.w - 2 * pad;
    ctx.save();
    ctx.font = `500 14px ${REF_FONT}`;
    const lines = wrapLines(ctx, t('story.text'), w);
    ctx.restore();
    const head = 24 + lines.length * 19 + 10;
    const { p, l } = this.layoutOf(ctx, ROOT, w, Math.max(40, Math.min(r.h, 240) - head - 2 * pad), r.w > 420 ? 18 : 15);
    const h = head + l.height + 2 * pad;
    const box = { x: r.x, y: r.y, w: r.w, h };
    this.scrim(ctx, box, a);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = box.x + box.w / 2;
    ctx.fillStyle = '#ffd98a';
    ctx.font = `700 18px ${REF_FONT}`;
    ctx.fillText(t('story.title'), cx, box.y + pad);
    ctx.fillStyle = '#fff6e4';
    ctx.font = `500 14px ${REF_FONT}`;
    lines.forEach((s, i) => ctx.fillText(s, cx, box.y + pad + 24 + i * 19));
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    drawPassage(ctx, p, l, cx, box.y + pad + head, { text: '#fff6e4', ref: 'rgba(255,220,160,0.88)' });
    ctx.restore();
  }
}
