/**
 * Dobry bój's cards over the ring (DESIGN.md §25), drawn by the fight after the ring's frame: the story card of a
 * first-ever session (what the game is, and the root verse) and the verse cards (the first corner and every second after, the read after
 * a knockdown, a fight's end, the session's end) — kit/scripture's passage on a dark scrim, faded in and out, in the
 * layout's `card` place (builder B's layout.ts) or, without one, in the ring's upper part.  Also the options' tap
 * targets (the layout's slots, only while the slow motion's options are open).
 */
import { passage, layoutPassage, drawPassage, REF_FONT, wrapLines, type Passage, type PassageLayout } from '../kit/scripture';
import { clamp } from '../kit/juice';
import { overlaps, pacerBox, pacerSizeAt } from '../kit/pacerspot';
import type { TapTarget } from '../kit/types';
import { ROOT } from './content';
import { t } from './i18n';
import type { Layout } from './layout';
import type { BojSim } from './sim';
import type { Rect } from './view';

/**
 * Where the cards go: the layout's place when it has one, else the ring's upper middle (≤ 560 px wide).  In a rest
 * (`rest`) the runner's breath pacer stands at the layout's `pacer`: a card it would cover moves down below it.
 */
export function cardRect(l: Layout, rest = false): Rect {
  const own = l.card;
  const r = own && own.w > 40 && own.h > 40 ? own : (() => {
    const w = Math.min(560, l.w - 32);
    const h = Math.min(190, Math.max(110, l.ring.h * 0.5));
    return { x: (l.w - w) / 2, y: l.ring.y + Math.max(8, l.ring.h * 0.06), w, h };
  })();
  const p = l.pacer;
  if (!rest || !p) return r;
  // the pacer's room as the kit keeps it (the big screen's, which holds on any screen)
  const box = pacerBox(p, pacerSizeAt(p, true));
  if (!overlaps(r, box)) return r;
  const y = box.y + box.h + 8;
  return { x: r.x, y, w: r.w, h: Math.max(80, r.y + r.h - y) };
}

/** The options' slots as tap targets (only while the slow motion's options are open). */
export function optionTargets(l: Layout, labels: readonly string[]): TapTarget[] {
  return labels.slice(0, l.options.length).map((label, i) => ({ label, ...l.options[i] }));
}

/** The option under a tap (−1: none). */
export function optionAt(l: Layout, n: number, x: number, y: number): number {
  for (let i = 0; i < Math.min(n, l.options.length); i++) {
    const r = l.options[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

export class Cards {
  private cache: { key: string; p: Passage; l: PassageLayout } | null = null;
  private storyA = 0;

  /** Draw the cards of this frame; `dt` real seconds. */
  draw(ctx: CanvasRenderingContext2D, sim: BojSim, l: Layout, dt: number, reduced: boolean): void {
    const r = cardRect(l, sim.restBlock);
    // the story card: in and out with the first walk-in and read of a first-ever session
    this.storyA = reduced ? (sim.story ? 1 : 0) : clamp(this.storyA + (sim.story ? dt / 0.5 : -dt / 0.4));
    if (this.storyA > 0.01) {
      this.story(ctx, r, this.storyA);
      return;
    }
    const c = sim.card;
    if (!c || sim.stage === 'slow' || sim.stage === 'sequence') return;
    // the runner's coach mark (a first-time explanation, centred) goes first: the card comes in after it
    const from = Math.max(c.t0, Math.min(sim.hintUntil, c.t0 + c.dur - 3));
    if (sim.t < from) return;
    const age = sim.t - from, left = c.t0 + c.dur - sim.t;
    const a = reduced ? 1 : clamp(Math.min(age / 0.5, left / 0.5));
    if (a <= 0.01) return;
    this.verse(ctx, c.id, r, a);
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
    ctx.fillStyle = 'rgba(14,10,16,0.82)';
    ctx.strokeStyle = 'rgba(255,214,150,0.35)';
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
    drawPassage(ctx, p, l, box.x + box.w / 2, box.y + pad, { text: '#fff4e2', ref: 'rgba(255,220,170,0.85)' });
    ctx.restore();
  }

  private story(ctx: CanvasRenderingContext2D, r: Rect, a: number): void {
    const pad = 14, w = r.w - 2 * pad;
    ctx.save();
    ctx.font = `700 18px ${REF_FONT}`;
    const title = t('story.title');
    ctx.font = `500 14px ${REF_FONT}`;
    const lines = wrapLines(ctx, t('story.text'), w);
    ctx.restore();
    const head = 24 + lines.length * 19 + 10;
    const { p, l } = this.layoutOf(ctx, ROOT, w, Math.max(40, Math.min(r.h, 220) - head - 2 * pad), r.w > 420 ? 18 : 15);
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
    ctx.fillText(title, cx, box.y + pad);
    ctx.fillStyle = '#fff4e2';
    ctx.font = `500 14px ${REF_FONT}`;
    lines.forEach((s, i) => ctx.fillText(s, cx, box.y + pad + 24 + i * 19));
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = a;
    drawPassage(ctx, p, l, cx, box.y + pad + head, { text: '#fff4e2', ref: 'rgba(255,220,170,0.85)' });
    ctx.restore();
  }
}
