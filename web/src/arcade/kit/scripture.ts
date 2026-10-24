/**
 * Scripture on screen for the arcade games.  A verse appears at a resting point (a round's end, a
 * collection card, the summary), whole and with its reference — never mid-action, never as a test.
 * The texts come from src/content/scripture.ts, generated and verified in four public-domain
 * editions; a game names a passage by its id and gets it in the page's language.
 *
 *   layoutPassage / drawPassage  the canvas layout that always fits its box (the font shrinks, then wraps)
 *   verseCard                    the DOM card the runner shows in the summary (ArcadeOutcome.verse)
 */
import { passage, type Passage, type PassageId } from '../../content/scripture';
import { h } from '../../ui/dom';

export { passage, type Passage, type PassageId };

export const VERSE_FONT = '"Fraunces Variable", Fraunces, Georgia, serif';
export const REF_FONT = '"Manrope Variable", Manrope, system-ui, sans-serif';

/** Greedy word wrap with the context's current font; a word longer than the line gets a line of its own. */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export interface PassageLayout {
  lines: string[];
  /** the verse's font size and line height (CSS px) */
  size: number;
  lineH: number;
  /** the reference line's font size */
  refSize: number;
  /** verse + gap + reference */
  height: number;
  /** false: even the smallest size overflows the box; the lines are cut to it and end in "…" */
  fits: boolean;
}

/**
 * The largest font size from `max` down to `min` at which the passage, wrapped to `w`, fits `h`
 * together with its reference line.  Cheap enough for a resize or a new verse; cache the result
 * rather than calling it every frame.
 */
export function layoutPassage(ctx: CanvasRenderingContext2D, p: Passage, w: number, h: number,
  opts: { max?: number; min?: number } = {}): PassageLayout {
  const max = opts.max ?? 22, min = opts.min ?? 11;
  ctx.save();
  let out: PassageLayout | null = null;
  for (let size = max; size >= min; size -= 1) {
    ctx.font = `italic 400 ${size}px ${VERSE_FONT}`;
    const lines = wrapLines(ctx, p.text, w);
    const lineH = Math.round(size * 1.32);
    const refSize = Math.max(10, Math.round(size * 0.62));
    const height = lines.length * lineH + Math.round(size * 0.55) + refSize;
    out = { lines, size, lineH, refSize, height, fits: height <= h };
    if (out.fits) break;
  }
  ctx.restore();
  const l = out!;
  if (!l.fits) {
    const room = Math.max(1, Math.floor((h - l.refSize - Math.round(l.size * 0.55)) / l.lineH));
    if (room < l.lines.length) {
      l.lines = l.lines.slice(0, room);
      l.lines[room - 1] = `${l.lines[room - 1].replace(/[\s,;:.]+$/, '')}…`;
      l.height = room * l.lineH + Math.round(l.size * 0.55) + l.refSize;
    }
  }
  return l;
}

/** Draw a laid-out passage, centred on `cx`, from `top` down; the reference reads "Ps 46,11 · Biblia Gdańska". */
export function drawPassage(ctx: CanvasRenderingContext2D, p: Passage, l: PassageLayout, cx: number, top: number,
  colors: { text: string; ref: string }): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = colors.text;
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = colors.ref;
  ctx.font = `600 ${l.refSize}px ${REF_FONT}`;
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}

/** The summary's verse card: the passage in the page's language, its reference and edition. */
export function verseCard(id: PassageId): HTMLElement {
  const p = passage(id);
  return h('figure', { class: 'arcade-verse' }, h('blockquote', null, p.text), h('figcaption', null, `${p.ref} · ${p.bible}`));
}
