/**
 * Zacheusz's own overlays on the canvas — only what the runner's standard HUD does not draw (the
 * Mendi panel and the score corner are the runner's, src/arcade/mendi.ts):
 *
 *   the level strip   under the HUD, centred: the level's code and its five special-denarius slots
 *                     (Mario's pink-coin row), filled as they are found
 *   the level card    for two seconds at a level's start: its name and the set it shows
 *   the bubble button bottom right: a soap bubble with the count; a tap rewinds a few seconds
 *   Mela's bubble     a drawn speech bubble over the goat (2–4 s, one at a time)
 *   the tally card    at the finish: denarii, specials, the crowd's cheers, the height, the stars
 *   the story card    the opening (with the root passage) and a world's end (the last with Luke 19:5)
 */
import { clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { TIERS, levelCode, levelName } from './content';
import { t, unit } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintBubble, paintCoin, type CoinKind } from './paint';
import { RULES } from './rules';
import type { LevelResult, StoryKind } from './sim';

const TAU = Math.PI * 2;

/** Rounded-rect card with a soft shadow. */
function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string = C.paper): void {
  ctx.save();
  ctx.shadowColor = 'rgba(42,30,23,.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(42,30,23,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

/** Text shrunk to fit a width. */
function fitText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, weight: number, size: number, fam: string): void {
  let sz = size;
  ctx.font = font(weight, sz, fam);
  while (sz > 9 && ctx.measureText(s).width > maxW) {
    sz -= 1;
    ctx.font = font(weight, sz, fam);
  }
  ctx.fillText(s, x, y);
}

function wrap(ctx: CanvasRenderingContext2D, s: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(/\s+/)) {
    const tryL = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryL).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}

export const tierKind = (tier: number): CoinKind => TIERS[Math.max(0, Math.min(2, tier))];

/** The level strip under the HUD: code, the five special slots. */
export function drawStrip(ctx: CanvasRenderingContext2D, L: Layout, level: number, tier: number, got: readonly boolean[], pop: number, clock: number): void {
  const r = 8 * L.u, gap = r * 2.5;
  const w = gap * 5 + 52 * L.u, h = r * 2 + 10;
  const x = L.w / 2 - w / 2, y = L.hudTop + 2;
  ctx.fillStyle = 'rgba(42,30,23,.45)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = C.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(800, 12 * L.u, SANS);
  ctx.fillText(levelCode(level), x + 24 * L.u, y + h / 2 + 1);
  for (let i = 0; i < RULES.specials; i++) {
    const cx = x + 48 * L.u + gap * (i + 0.5), cy = y + h / 2;
    const s = got[i] && pop > 0 && i === got.lastIndexOf(true) ? 1 + 0.5 * Math.sin(clamp(pop) * Math.PI) : 1;
    paintCoin(ctx, cx, cy, r * s, tierKind(tier), got[i] ? Math.sin(clock * 2 + i) * 0.4 : 0, !got[i]);
  }
}

/** The level card at a level's start (k: 0..1 over its life). */
export function drawLevelCard(ctx: CanvasRenderingContext2D, L: Layout, level: number, tier: number, replay: boolean, k: number): void {
  const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const w = Math.min(L.w - 32, 360 * L.u), h = 64 * L.u;
  const x = L.w / 2 - w / 2, y = L.hudTop + 28 * L.u - (1 - ease.outCubic(Math.min(1, k / 0.15))) * 16;
  card(ctx, x, y, w, h, 14);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  fitText(ctx, `${levelCode(level)} · ${levelName(level)}`, L.w / 2, y + h * 0.38, w - 24, 700, 20 * L.u, SERIF);
  ctx.fillStyle = C.wood2;
  const sub = replay ? t('level.replay', { tier: t(`tier.${TIERS[tier]}`) }) : t('level.new');
  fitText(ctx, sub, L.w / 2, y + h * 0.74, w - 24, 600, 12.5 * L.u, SANS);
  ctx.restore();
}

/** The bubble button (bottom right), with the count; dim without bubbles. */
export function drawButton(ctx: CanvasRenderingContext2D, L: Layout, n: number, clock: number, press: number): void {
  const { x, y, r } = L.btn;
  ctx.save();
  ctx.globalAlpha = n > 0 ? 1 : 0.4;
  ctx.fillStyle = 'rgba(42,30,23,.35)';
  ctx.beginPath();
  ctx.arc(x, y, r + 4, 0, TAU);
  ctx.fill();
  paintBubble(ctx, x, y, r * (1 - 0.15 * press), clock);
  ctx.fillStyle = C.paper;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(800, r * 0.62, SANS);
  ctx.fillText(String(n), x, y + 1);
  ctx.font = font(700, 10 * L.u, SANS);
  ctx.fillText(t('bubble.btn'), x, y - r - 9 * L.u);
  ctx.restore();
}

/** Mela's speech bubble, its tail pointing down at (x, y). */
export function drawSpeech(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, k: number, avoid?: { x: number; y: number }): void {
  const a = k < 0.08 ? k / 0.08 : k > 0.9 ? (1 - k) / 0.1 : 1;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = font(600, 13.5 * L.u, SANS);
  const maxW = Math.min(L.w * (L.tall ? 0.78 : 0.4), 300 * L.u);
  const lines = wrap(ctx, text, maxW - 20);
  const lh = 17 * L.u;
  const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22);
  const h = lines.length * lh + 14 + 14 * L.u;
  let bx = x - w * 0.3;
  bx = Math.max(8, Math.min(L.w - w - 8, bx));
  let by = Math.max(L.hudTop + 30 * L.u, y - h - 10);
  // never over Zacchaeus: end left of him, or else rise above his head
  if (avoid) {
    const S = L.S;
    const hit = (bxx: number, byy: number) => bxx < avoid.x + S * 0.6 && bxx + w > avoid.x - S * 0.6 && byy < avoid.y && byy + h > avoid.y - S * 1.3;
    if (hit(bx, by)) {
      const left = Math.max(8, avoid.x - S * 0.7 - w);
      if (!hit(left, by) && left + w <= avoid.x - S * 0.6) bx = left;
      else by = Math.max(L.hudTop + 30 * L.u, avoid.y - S * 1.4 - h - 8);
    }
  }
  card(ctx, bx, by, w, h, 12, '#fffaf0');
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  const tx = Math.max(bx + 12, Math.min(bx + w - 12, x));
  ctx.moveTo(tx - 7, by + h - 1);
  ctx.lineTo(tx, Math.min(y, by + h + 10));
  ctx.lineTo(tx + 7, by + h - 1);
  ctx.fill();
  ctx.fillStyle = C.madder;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(800, 11 * L.u, SANS);
  ctx.fillText(t('mela'), bx + 11, by + 6);
  ctx.fillStyle = C.ink;
  ctx.font = font(600, 13.5 * L.u, SANS);
  lines.forEach((l, i) => ctx.fillText(l, bx + 11, by + 7 + 14 * L.u + i * lh));
  ctx.restore();
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

/** The tally card at a level's finish: the count-up of what it brought. */
export function drawTally(ctx: CanvasRenderingContext2D, L: Layout, res: LevelResult, k: number, nextName: string): void {
  const a = clamp(k * 6);
  ctx.save();
  ctx.globalAlpha = a;
  const w = Math.min(L.w - 28, 380 * L.u), h = Math.min(L.gy - L.hudTop - 20, 250 * L.u);
  const x = L.w / 2 - w / 2, y = Math.max(L.hudTop + 8, L.cardY - h / 2);
  card(ctx, x, y, w, h, 16);
  const u = h / 250;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.ink;
  fitText(ctx, res.world ? t('tally.world') : t('tally.title'), L.w / 2, y + 28 * u, w - 30, 700, 26 * u, SERIF);
  stars(ctx, L.w / 2, y + 66 * u, 15 * u, res.stars, k);
  // the count-up
  const c = clamp((k - 0.15) / 0.45);
  const rows: [string, string][] = [
    [t('tally.coins'), `+${Math.round(res.coins * c)}`],
    [t('tally.specials'), `${res.specials}/${RULES.specials}`],
    [t('tally.style'), `${Math.round(res.style * c)} → +${res.styleCoins}`],
    [t('tally.height'), `${res.band + 1}/5`],
  ];
  ctx.font = font(600, 14 * u, SANS);
  rows.forEach(([l, v], i) => {
    const ry = y + (104 + i * 24) * u;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.wood2;
    ctx.fillText(l, x + 24, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 15 * u, SANS);
    ctx.fillText(v, x + w - 24, ry);
    ctx.font = font(600, 14 * u, SANS);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = res.completed ? C.purple2 : C.wood2;
  const line = res.completed ? (res.tier >= 2 ? t('tally.setLast') : t('tally.set', { tier: t(`tier.${TIERS[res.tier]}`), next: t(`tier.${TIERS[res.tier + 1]}`) })) : t('tally.next', { name: nextName });
  fitText(ctx, line, L.w / 2, y + 206 * u, w - 30, 700, 13.5 * u, SANS);
  ctx.fillStyle = 'rgba(42,30,23,.5)';
  fitText(ctx, t('tally.tap'), L.w / 2, y + 230 * u, w - 30, 600, 11.5 * u, SANS);
  ctx.restore();
}

/** The story card: a title, two or three sentences, and for the opening and the end a passage. */
export class StoryCard {
  private verse: { id: PassageId; w: number; l: PassageLayout } | null = null;

  draw(ctx: CanvasRenderingContext2D, L: Layout, kind: StoryKind, world: number, k: number): void {
    const a = clamp(k * 5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,30,23,.35)';
    ctx.fillRect(0, 0, L.w, L.h);
    const key = kind === 'open' ? 'story.open' : `story.world.${world}`;
    const w = Math.min(L.w - 24, 470 * L.u);
    // measure first: the text, then the passage in the room that is left
    ctx.font = font(500, 14 * L.u, SANS);
    const lines = wrap(ctx, t(`${key}.text` as Parameters<typeof t>[0]), w - 40);
    const lh = 19 * L.u;
    const head = 34 + 32 * L.u;
    const maxH = Math.max(160, L.h - L.hudTop - 20);
    const id: PassageId | null = kind === 'open' ? 'luk19.3-4' : world >= 2 ? 'luk19.5' : null;
    const textH = lines.length * lh;
    let verseH = 0;
    if (id) {
      const room = maxH - head - textH - 12 - 40;
      if (room > 30) {
        const ps = passage(id);
        if (!this.verse || this.verse.id !== id || this.verse.w !== w) this.verse = { id, w, l: layoutPassage(ctx, ps, w - 48, Math.min(room, 160 * L.u), { max: 15, min: 10 }) };
        verseH = this.verse.l.height + 12;
      }
    }
    const h = Math.min(maxH, head + textH + verseH + 44);
    const x = L.w / 2 - w / 2, y = Math.max(L.hudTop + 10, L.hudTop + (L.h - L.hudTop - h) / 2);
    card(ctx, x, y, w, h, 18);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.madder;
    fitText(ctx, kind === 'open' ? t('world.0') : t(`world.${world}` as Parameters<typeof t>[0]), L.w / 2, y + 16, w - 30, 800, 11.5 * L.u, SANS);
    ctx.fillStyle = C.ink;
    fitText(ctx, t(`${key}.title` as Parameters<typeof t>[0]), L.w / 2, y + 34, w - 30, 700, 22 * L.u, SERIF);
    ctx.font = font(500, 14 * L.u, SANS);
    ctx.fillStyle = C.ink;
    const ty = y + head;
    lines.forEach((l, i) => ctx.fillText(l, L.w / 2, ty + i * lh));
    if (id && verseH > 0 && this.verse) drawPassage(ctx, passage(id), this.verse.l, L.w / 2, ty + textH + 12, { text: C.wood2, ref: C.madder });
    ctx.fillStyle = 'rgba(42,30,23,.5)';
    ctx.textBaseline = 'middle';
    fitText(ctx, t('story.tap'), L.w / 2, y + h - 16, w - 30, 600, 11.5 * L.u, SANS);
    ctx.restore();
  }
}

/** A big centred word for a moment (the top of the palm, a full set). */
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
  const y = L.hudTop + (L.gy - L.hudTop) * 0.28;
  ctx.strokeText(text, L.w / 2, y);
  ctx.fillStyle = color;
  ctx.fillText(text, L.w / 2, y);
  ctx.restore();
}

export { unit };
