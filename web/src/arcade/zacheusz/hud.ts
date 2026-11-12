/**
 * Zacheusz's own overlays on the canvas — only what the runner's standard HUD does not draw (the
 * Mendi panel and the score corner are the runner's, src/arcade/mendi.ts) — sized for a phone first
 * (src/arcade/DESIGN.md §12: nothing under 11 px, anything to read to play at 13 px or more):
 *
 *   the level strip   under the HUD, centred (passive): the level's code and its five special-denarius
 *                     slots (Mario's pink-coin row), filled as they are found
 *   the level card    for two seconds at a level's start: its name and the set it shows
 *   the bubble button the ground band's right corner, under the thumb: a soap bubble with the count; a tap
 *                     rewinds a few seconds (it squashes on touch-down, dims without bubbles)
 *   Mela's lines      a box in the ground band under the street — never over the light road, the roofs or
 *                     the button — its tail up to the goat, 15 px
 *   the tally card    at the finish: denarii, specials, the crowd's cheers, the height, the stars
 *   the story card    the opening (with the root passage) and a world's end (the last with Luke 19:5)
 *
 * The cards return the rectangle they were drawn in: a tap there goes on (the game's `targets()`).
 */
import { clamp, ease } from '../kit/juice';
import { MIN_READ, fitText } from '../kit/mobile';
import { passage, type Passage, type PassageId, type PassageLayout, layoutPassage } from '../kit/scripture';
import { TIERS, levelCode, levelName } from './content';
import { t, unit } from './i18n';
import type { Box, Layout } from './layout';
import { C, SANS, SERIF, font, paintBubble, paintCoin, type CoinKind } from './paint';
import { RULES } from './rules';
import type { LevelResult, StoryKind } from './sim';

const TAU = Math.PI * 2;
/** The verse's reference line on a card: never under 13 px (kit/scripture's own floor is 11). */
const REF_MIN = 13;
const VERSE_FONT = '"Fraunces Variable", Fraunces, Georgia, serif';

/** A rounded card with a soft drop under it (an offset shape, not a shadowBlur: a phone's fill rate). */
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string = C.paper): void {
  ctx.fillStyle = 'rgba(42,30,23,.22)';
  ctx.beginPath();
  ctx.roundRect(x + 1, y + 5, w, h, r);
  ctx.fill();
  ctx.fillStyle = 'rgba(42,30,23,.12)';
  ctx.beginPath();
  ctx.roundRect(x - 1, y + 2, w + 2, h + 6, r + 2);
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,30,23,.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** One line of text fitted to a width (shrinking to `min`, then cut with "…"), drawn at (x, y). */
function fit(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, weight: number, size: number, fam: string, min = MIN_READ): void {
  ctx.fillText(fitText(ctx, s, maxW, size, weight, fam, Math.min(size, min)), x, y);
}

/** Words wrapped to `maxW` (the first line `indent` px shorter: a name in front of it). */
export function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number, indent = 0): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(/\s+/)) {
    if (!w) continue;
    const tryL = line ? `${line} ${w}` : w;
    const room = out.length === 0 ? maxW - indent : maxW;
    if (ctx.measureText(tryL).width > room && line) {
      out.push(line);
      line = w;
    } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}

export const tierKind = (tier: number): CoinKind => TIERS[Math.max(0, Math.min(2, tier))];

/** The level strip under the HUD: the level's code, the five special slots (passive: nothing to tap). */
export function drawStrip(ctx: CanvasRenderingContext2D, L: Layout, level: number, tier: number, got: readonly boolean[], pop: number, clock: number): void {
  const u = L.u, r = 9 * u, gap = r * 2.5;
  ctx.font = font(800, 14 * u, SANS);
  const code = levelCode(level);
  const cw = Math.max(26 * u, ctx.measureText(code).width);
  const h = Math.round(r * 2 + 12 * u), w = 14 * u + cw + 8 * u + gap * RULES.specials + 6 * u;
  const x = L.w / 2 - w / 2, y = L.hudTop + 6;
  ctx.fillStyle = 'rgba(42,30,23,.5)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(code, x + 14 * u + cw / 2, y + h / 2 + 1);
  const last = got.lastIndexOf(true);
  for (let i = 0; i < RULES.specials; i++) {
    const cx = x + 14 * u + cw + 8 * u + gap * (i + 0.5), cy = y + h / 2;
    const s = got[i] && pop > 0 && i === last ? 1 + 0.5 * Math.sin(clamp(pop) * Math.PI) : 1;
    paintCoin(ctx, cx, cy, r * s, tierKind(tier), got[i] ? Math.sin(clock * 2 + i) * 0.4 : 0, !got[i]);
  }
}

/** The level card at a level's start (k: 0..1 over its life), under the strip. */
export function drawLevelCard(ctx: CanvasRenderingContext2D, L: Layout, level: number, tier: number, replay: boolean, k: number): void {
  const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  if (a <= 0) return;
  const u = L.u;
  ctx.save();
  ctx.globalAlpha = a;
  const w = Math.min(L.cardW, 360 * u), h = 64 * u;
  const x = L.w / 2 - w / 2, y = L.hudTop + 44 * u - (1 - ease.outCubic(Math.min(1, k / 0.15))) * 16;
  card(ctx, x, y, w, h, 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  fit(ctx, `${levelCode(level)} · ${levelName(level)}`, L.w / 2, y + h * 0.37, w - 24, 700, 20 * u, SERIF, 15);
  ctx.fillStyle = C.wood2;
  const sub = replay ? t('level.replay', { tier: t(`tier.${TIERS[tier]}`) }) : t('level.new');
  fit(ctx, sub, L.w / 2, y + h * 0.74, w - 24, 600, 14 * u, SANS);
  ctx.restore();
}

/**
 * The bubble button (the ground band's right corner), with the count; dim without bubbles or while it
 * cannot rewind (`live` false); `press` 0..1 squashes it on touch-down.  Its label sits above it upright,
 * to its left on a phone on its side (the band is one button tall there).
 */
export function drawButton(ctx: CanvasRenderingContext2D, L: Layout, n: number, clock: number, press: number, live: boolean): void {
  const { x, y, r } = L.btn;
  ctx.save();
  ctx.globalAlpha = live ? 1 : 0.45;
  ctx.fillStyle = 'rgba(42,30,23,.4)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, TAU);
  ctx.fill();
  if (press > 0) {
    // the finger's answer: a bright rim while it is down
    ctx.strokeStyle = `rgba(255,246,214,${(0.9 * press).toFixed(3)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 4 + 4 * (1 - press), 0, TAU);
    ctx.stroke();
  }
  paintBubble(ctx, x, y, r * (1 - 0.14 * press), clock);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(800, r * 0.72, SANS);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(42,30,23,.55)';
  ctx.strokeText(String(n), x, y + 1);
  ctx.fillStyle = C.paper;
  ctx.fillText(String(n), x, y + 1);
  // the label on a plate, so it reads over the ground's texture
  ctx.font = font(800, 13 * L.u, SANS);
  const label = t('bubble.btn');
  const lw = ctx.measureText(label).width + 12, lh = 18 * L.u;
  const lx = L.tall ? x : x - r - 10 - lw / 2, ly = L.tall ? y - r - 8 - lh / 2 : y;
  ctx.fillStyle = 'rgba(42,30,23,.5)';
  ctx.beginPath();
  ctx.roundRect(lx - lw / 2, ly - lh / 2, lw, lh, lh / 2);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.fillText(label, lx, ly + 1);
  ctx.restore();
}

/** How much room the button's label takes left of it on a phone on its side (Mela's box keeps clear). */
export function labelRoom(ctx: CanvasRenderingContext2D, L: Layout): number {
  if (L.tall) return 0;
  if (labelW.u !== L.u) {
    ctx.font = font(800, 13 * L.u, SANS);
    labelW.u = L.u;
    labelW.w = ctx.measureText(t('bubble.btn')).width + 22;
  }
  return labelW.w;
}
const labelW = { u: 0, w: 0 };

/** Mela's line as last laid out (a line is measured once, not every frame). */
let talkFit: { key: string; size: number; lines: string[]; nameW: number; lh: number; w: number } | null = null;

/**
 * Mela's line in the ground band under the street: a box from the left edge toward the button, its tail
 * up to her at `mx` (her feet at `my`); her name in front of the first line.  `k` 0..1 over its life.
 * The box steps down with the street when the camera climbs, and never leaves the safe area.
 */
export function drawTalk(ctx: CanvasRenderingContext2D, L: Layout, text: string, mx: number, my: number, k: number, room: number, drop = 0): Box | null {
  const a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
  if (a <= 0) return null;
  const u = L.u, pad = 10 * u;
  const maxW = Math.max(120, L.talk.w - room);
  const name = `${t('mela')}:`;
  const key = `${text}|${maxW}|${L.talk.h}|${u}`;
  let fit = talkFit && talkFit.key === key ? talkFit : null;
  if (!fit) {
    // the largest size from 15 down to 13 at which the line fits the band (measured once a line, not a frame)
    let size = 15 * u, lines: string[] = [], nameW = 0, lh = 0;
    for (; ; size -= 1) {
      ctx.font = font(800, size, SANS);
      nameW = ctx.measureText(name).width + 6 * u;
      ctx.font = font(600, size, SANS);
      lines = wrap(ctx, text, maxW - 2 * pad, nameW);
      lh = Math.round(size * 1.28);
      if (lines.length * lh + 2 * pad - 4 <= L.talk.h || size <= MIN_READ) break;
    }
    const maxLines = Math.max(1, Math.floor((L.talk.h - 2 * pad + 4) / lh));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    ctx.font = font(600, size, SANS);
    const widest = Math.max(...lines.map((l, i) => ctx.measureText(l).width + (i === 0 ? nameW : 0)));
    fit = talkFit = { key, size, lines, nameW, lh, w: Math.min(maxW, widest + 2 * pad) };
  }
  const { size, lines, nameW, lh } = fit;
  const w = fit.w, h = lines.length * lh + 2 * pad - 4;
  const x = L.talk.x;
  const y = Math.min(L.talk.y + Math.max(0, drop), L.bottom - (L.tall ? 10 : 5) - h);
  ctx.save();
  ctx.globalAlpha = a;
  card(ctx, x, y, w, h, 12, '#fffaf0');
  // the tail, up to her (when she stands above the box)
  const tx = clamp(mx, x + 14, x + w - 14);
  if (my < y - 4) {
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = 'rgba(42,30,23,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tx - 7, y + 1);
    ctx.lineTo(clamp(mx, tx - 10, tx + 10), Math.max(my + 2, y - 12 * u));
    ctx.lineTo(tx + 7, y + 1);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(tx - 6, y + 0.5, 12, 2);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.madder;
  ctx.font = font(800, size, SANS);
  ctx.fillText(name, x + pad, y + pad - 2);
  ctx.fillStyle = C.ink;
  ctx.font = font(600, size, SANS);
  lines.forEach((l, i) => ctx.fillText(l, x + pad + (i === 0 ? nameW : 0), y + pad - 2 + i * lh));
  ctx.restore();
  return { x, y, w, h };
}

/** Stars in a row (filled up to `n` of 3). */
function stars(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, k: number): void {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * r * 2.6;
    const on = i < n;
    const s = on ? ease.outBack(clamp(k * 3 - i * 0.5)) : 1;
    ctx.fillStyle = on ? C.gold : 'rgba(42,30,23,.15)';
    ctx.strokeStyle = on ? C.gold2 : 'rgba(42,30,23,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < 10; j++) {
      const rr = (j % 2 ? r * 0.45 : r) * s, b = (j * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(b) * rr, cy + Math.sin(b) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** The tally card's box: centred on the play, allowed down into the ground band (the street rests). */
export function tallyBox(L: Layout): Box {
  const u = L.u;
  const w = Math.min(L.cardW, 380 * u), h = Math.min(L.bottom - L.hudTop - 16, 262 * u);
  const y = clamp(L.cardY - h / 2, L.hudTop + 8, L.bottom - h - 8);
  return { x: L.w / 2 - w / 2, y, w, h };
}

/** The tally card at a level's finish: the count-up of what it brought.  Returns where it was drawn. */
export function drawTally(ctx: CanvasRenderingContext2D, L: Layout, res: LevelResult, k: number, nextName: string): Box {
  const box = tallyBox(L);
  const { x, y, w, h } = box;
  const a = clamp(k * 6);
  ctx.save();
  ctx.globalAlpha = a;
  card(ctx, x, y, w, h, 16);
  // the rows scale with the card (it is 262 u tall when it has the room)
  const v = h / 262;
  const pad = 20 * L.u;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  fit(ctx, res.world ? t('tally.world') : t('tally.title'), L.w / 2, y + 31 * v, w - 2 * pad, 700, 24 * v, SERIF, 17);
  stars(ctx, L.w / 2, y + 70 * v, 15 * v, res.stars, k);
  // the count-up
  const c = clamp((k - 0.15) / 0.45);
  const rows: [string, string][] = [
    [t('tally.coins'), `+${Math.round(res.coins * c)}`],
    [t('tally.specials'), `${res.specials}/${RULES.specials}`],
    [t('tally.style'), `${Math.round(res.style * c)} → +${res.styleCoins}`],
    [t('tally.height'), `${res.band + 1}/5`],
  ];
  rows.forEach(([l, val], i) => {
    const ry = y + (112 + i * 26) * v;
    ctx.font = font(800, 16 * v, SANS);
    const vw = ctx.measureText(val).width;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.wood2;
    fit(ctx, l, x + pad, ry, w - 2 * pad - vw - 12, 600, 15 * v, SANS, 14);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 16 * v, SANS);
    ctx.fillText(val, x + w - pad, ry);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = res.completed ? C.purple2 : C.wood2;
  const line = res.completed ? (res.tier >= 2 ? t('tally.setLast') : t('tally.set', { tier: t(`tier.${TIERS[res.tier]}`), next: t(`tier.${TIERS[res.tier + 1]}`) })) : t('tally.next', { name: nextName });
  fit(ctx, line, L.w / 2, y + 222 * v, w - 2 * pad, 700, 14.5 * v, SANS);
  ctx.fillStyle = 'rgba(42,30,23,.6)';
  fit(ctx, t('tally.tap'), L.w / 2, y + 246 * v, w - 2 * pad, 600, 13.5 * v, SANS);
  ctx.restore();
  return box;
}

/** A laid-out passage centred on `cx` from `top` down, its reference at least REF_MIN px ("Łk 19,3–4 · Biblia Gdańska"). */
function drawVerse(ctx: CanvasRenderingContext2D, p: Passage, l: PassageLayout, cx: number, top: number): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.wood2;
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = C.madder;
  ctx.font = font(600, Math.max(REF_MIN, l.refSize), SANS);
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
}

/** The story card: a title, two or three sentences, and for the opening and the end a passage. */
export class StoryCard {
  private verse: { id: PassageId; w: number; room: number; l: PassageLayout } | null = null;
  private wrapped: { key: string; w: number; size: number; lines: string[] } | null = null;

  /** Draws the card; returns where (a tap there goes on). */
  draw(ctx: CanvasRenderingContext2D, L: Layout, kind: StoryKind, world: number, k: number): Box {
    const a = clamp(k * 5);
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,30,23,.35)';
    ctx.fillRect(0, 0, L.w, L.h);
    const key = kind === 'open' ? 'story.open' : `story.world.${world}`;
    const w = Math.min(L.cardW, 470 * u), pad = 18 * u;
    const maxH = Math.max(160, L.bottom - L.hudTop - 16);
    // the text at 15 px (14 when a small phone needs the room), then the passage in what is left
    const text = t(`${key}.text` as Parameters<typeof t>[0]);
    const head = 16 * u + 18 * u + 8 * u + 30 * u + 10 * u;
    const foot = 14 * u + 22 * u;
    let size = 15 * u;
    let lines = this.lines(ctx, key, text, w - 2 * pad, size);
    if (head + lines.length * Math.round(size * 1.35) + foot > maxH * 0.62 && size > 14) {
      size = 14;
      lines = this.lines(ctx, key, text, w - 2 * pad, size);
    }
    const lh = Math.round(size * 1.35);
    const textH = lines.length * lh;
    const id: PassageId | null = kind === 'open' ? 'luk19.3-4' : world >= 2 ? 'luk19.5' : null;
    let verseH = 0;
    if (id) {
      const room = Math.floor(maxH - head - textH - foot - 14 * u);
      if (room > 50) {
        if (!this.verse || this.verse.id !== id || this.verse.w !== w || this.verse.room !== room) {
          this.verse = { id, w, room, l: layoutPassage(ctx, passage(id), w - 2 * pad - 8, Math.min(room, 190 * u), { max: Math.round(16 * u), min: 13 }) };
        }
        verseH = this.verse.l.height + Math.max(0, REF_MIN - this.verse.l.refSize) + 14 * u;
      }
    }
    const h = Math.min(maxH, head + textH + verseH + foot);
    const x = L.w / 2 - w / 2, y = Math.max(L.hudTop + 8, L.hudTop + (L.bottom - L.hudTop - h) / 2);
    card(ctx, x, y, w, h, 18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.madder;
    fit(ctx, kind === 'open' ? t('world.0') : t(`world.${world}` as Parameters<typeof t>[0]), L.w / 2, y + 16 * u, w - 2 * pad, 800, 13.5 * u, SANS);
    ctx.fillStyle = C.ink;
    fit(ctx, t(`${key}.title` as Parameters<typeof t>[0]), L.w / 2, y + 16 * u + 18 * u + 8 * u - 4, w - 2 * pad, 700, 23 * u, SERIF, 17);
    ctx.font = font(500, size, SANS);
    ctx.fillStyle = C.ink;
    const ty = y + head;
    lines.forEach((l, i) => ctx.fillText(l, L.w / 2, ty + i * lh));
    if (id && verseH > 0 && this.verse) drawVerse(ctx, passage(id), this.verse.l, L.w / 2, ty + textH + 14 * u);
    ctx.fillStyle = 'rgba(42,30,23,.6)';
    ctx.textBaseline = 'middle';
    fit(ctx, t('story.tap'), L.w / 2, y + h - 20 * u, w - 2 * pad, 600, 13.5 * u, SANS);
    ctx.restore();
    return { x, y, w, h };
  }

  private lines(ctx: CanvasRenderingContext2D, key: string, text: string, w: number, size: number): string[] {
    const c = this.wrapped;
    if (c && c.key === key && c.w === w && c.size === size) return c.lines;
    ctx.font = font(500, size, SANS);
    const lines = wrap(ctx, text, w);
    this.wrapped = { key, w, size, lines };
    return lines;
  }
}

/** A big centred word for a moment (the top of the palm, a full set), over the play under the strip. */
export function drawBanner(ctx: CanvasRenderingContext2D, L: Layout, text: string, k: number, color: string): void {
  if (k <= 0 || k >= 1) return;
  const s = k < 0.2 ? ease.outBack(k / 0.2) : 1;
  ctx.save();
  ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(800, 34 * L.u * s, SERIF);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(42,30,23,.75)';
  const y = L.hudTop + 50 * L.u + (L.gy - L.hudTop - 50 * L.u) * 0.22;
  ctx.strokeText(text, L.w / 2, y);
  ctx.fillStyle = color;
  ctx.fillText(text, L.w / 2, y);
  ctx.restore();
}

export { unit };
