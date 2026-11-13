/**
 * Rzeki żywej wody's own words on the canvas (the runner draws the standard HUD: the Mendi panel, the score,
 * the coach marks): the prayer band — the place's name and its line in a calm serif, the words coming one by
 * one as the light arrives, glowing again when a tap stays with it; in rest the breath's count and the place's
 * verse to abide in; while the stream flows, the gift of the place just lit — the narrator's caption, and the
 * story cards (the opening's two pages, the closing cards of a way).  Every text is fitted with a floor
 * (never under 11 px; what the player reads, 13 px and more; the prayer 15 px and more).
 */
import { clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout, type PassageId } from '../kit/scripture';
import { PLACE, giftName, lineAt, placeName, type PlaceId } from './content';
import { t } from './i18n';
import { type Layout, type Rect, storyRect } from './layout';
import { GOLD, GOLD_HI, INK, LILAC, PEARL, WATER, fitFont, font, mix, rgbaPrefix, rr, wrap } from './paint';
import { RULES } from './rules';
import type { RzekiSim } from './sim';

// ── the prayer band ──────────────────────────────────────────────

interface Wrapped { key: string; lines: string[]; size: number; lineH: number }
let wrapMemo: Wrapped | null = null;
let verseMemo: { key: string; lay: PassageLayout; pages: string[][] } | null = null;

/** The prayer wrapped into the band: from `px` down to `min` until it fits `maxLines` (memoised by text and box). */
function wrapPrayer(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number, maxLines: number): Wrapped {
  const key = `${text}|${Math.round(w)}|${px}|${min}|${maxLines}`;
  if (wrapMemo?.key === key) return wrapMemo;
  let size = Math.max(min, px), lines: string[] = [];
  for (; size >= min; size -= 0.5) {
    ctx.font = font(size, 500, true, true);
    lines = wrap(ctx, text, w);
    if (lines.length <= maxLines) break;
  }
  size = Math.max(min, size);
  ctx.font = font(size, 500, true, true);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  wrapMemo = { key, lines, size, lineH: Math.round(size * 1.34) };
  return wrapMemo;
}

/** The label over the prayer: the way's arrow, the place and its number; the dark, abiding, the stream, the whole. */
export function bandLabel(sim: RzekiSim): { text: string; color: string } {
  const place = sim.place, hue = PLACE[place].hue;
  const arrow = sim.dir === 'down' ? '↓' : '↑';
  const n = sim.idx + 1;
  if (sim.stage === 'enter') return { text: `${arrow} ${t(sim.dir === 'down' ? 'hud.down' : 'hud.up')}`, color: GOLD_HI };
  if (sim.stage === 'whole') return { text: t('hud.whole'), color: GOLD_HI };
  if (sim.stage === 'flow') return { text: `${arrow} ${t('hud.flow', { name: placeName(sim.nextPlace ?? place) })}`, color: WATER };
  if (sim.blind) return { text: `${t('hud.dark')} · ${placeName(place)}`, color: 'rgba(214,214,236,.8)' };
  if (sim.restBlock) return { text: `${t('hud.abide')} · ${placeName(place)}`, color: LILAC };
  const own = sim.own ? ` · ${t('hud.own')}` : '';
  return { text: `${arrow} ${t('hud.place', { name: placeName(place), n })}${own}`, color: hue };
}

/** The narrator's line wrapped for the band's top row (at most two lines). */
function captionLines(ctx: CanvasRenderingContext2D, text: string, w: number, px: number): string[] {
  ctx.font = font(px, 600);
  let lines = wrap(ctx, text, w);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = `${lines[1].replace(/[\s,;:.]+$/, '')}…`;
  }
  return lines;
}

/** How the band's top row eases between the label (one line) and the narrator's line (one or two). */
let rowEase = 0;

/**
 * Draw the prayer band.  On a phone held upright the narrator speaks in the band's top row (it would cover
 * the crown's window above the figure), in place of the label; elsewhere its caption has a column of its
 * own.  The row, a gilded rule and the line (or, in rest, the breath and the verse) are centred as one group.
 * The words of a new line come one by one as the light arrives; a tap makes the line glow again.
 */
export function drawPrayer(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, dt: number, caption: { text: string; k: number }): void {
  const r = L.prayer;
  if (!sim.started || sim.story) return;
  // a soft dark veil behind the words, never a hard box
  if (L.shape === 'tall') {
    const g = ctx.createLinearGradient(0, r.y - 14, 0, r.y + r.h + 8);
    g.addColorStop(0, 'rgba(6,4,22,0)');
    g.addColorStop(0.2, 'rgba(6,4,22,.42)');
    g.addColorStop(0.8, 'rgba(6,4,22,.48)');
    g.addColorStop(1, 'rgba(6,4,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(L.left, r.y - 14, L.right - L.left, r.h + 22);
  } else {
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(r.w / 2 + 50, r.h / 2 + 40);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(6,4,22,.5)');
    g.addColorStop(0.65, 'rgba(6,4,22,.34)');
    g.addColorStop(1, 'rgba(6,4,22,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }
  const cx = r.x + r.w / 2;
  const inBand = L.shape === 'tall';
  const cpx = Math.max(MIN_READ, L.font.caption);
  const clines = inBand && caption.text ? captionLines(ctx, caption.text, r.w, cpx) : [];
  const want = inBand && caption.k > 0.01 && clines.length ? 1 : 0;
  rowEase += (want - rowEase) * Math.min(1, dt * 6);
  // the row: the label, or the narrator's line
  const lab = bandLabel(sim);
  const lpx = fitFont(ctx, lab.text, r.w, Math.max(MIN_READ, L.font.label), MIN_READ, 700);
  const labH = Math.round(lpx * 1.5), capH = Math.round(cpx * 1.35) * Math.max(1, clines.length);
  const rowH = labH + (Math.max(labH, capH) - labH) * ease.inOutSine(clamp(rowEase));
  const rest = sim.restBlock && sim.stage !== 'whole';
  // the group's height: the row, the rule, and what follows (the line wrapped, or the rest's breath and verse)
  const areaH = r.h - rowH - 10;
  let bodyH = areaH;
  let wr: Wrapped | null = null;
  if (!rest) {
    const maxLines = Math.max(2, Math.min(5, Math.floor(areaH / Math.round(L.font.prayerMin * 1.34))));
    wr = wrapPrayer(ctx, sim.stage === 'flow' && sim.stageT / RULES.flowSec >= 0.5 && sim.nextPlace ? lineAt(sim.nextPlace, sim.dir, sim.own) : sim.line,
      r.w, Math.max(L.font.prayerMin, L.font.prayer), L.font.prayerMin, maxLines);
    bodyH = Math.min(areaH, Math.max(wr.lines.length * wr.lineH, Math.round(26 * L.u)));
  }
  const y0 = r.y + Math.max(0, (r.h - (rowH + 10 + bodyH)) / 2);
  const rowMid = y0 + rowH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // one after the other, never both at once: the label fades out in the first half, the narrator in the second
  if (rowEase < 0.5) {
    ctx.globalAlpha = 1 - rowEase * 2;
    if (rest) drawBreathRow(ctx, L, sim, cx, rowMid);
    else {
      ctx.font = font(lpx, 700);
      ctx.fillStyle = lab.color;
      ctx.fillText(lab.text, cx, rowMid);
    }
  }
  if (rowEase > 0.5 && clines.length) {
    ctx.globalAlpha = (rowEase * 2 - 1) * clamp(caption.k);
    ctx.font = font(cpx, 600);
    const lh = Math.round(cpx * 1.35);
    let y = rowMid - ((clines.length - 1) * lh) / 2;
    for (const line of clines) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.strokeText(line, cx, y);
      ctx.fillStyle = 'rgba(240,236,255,.95)';
      ctx.fillText(line, cx, y);
      y += lh;
    }
  }
  ctx.globalAlpha = 1;
  // a short gilded rule under the row
  const rw = Math.min(r.w * 0.3, 90 * L.u);
  const ruleY = y0 + rowH + 3;
  const rg = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
  rg.addColorStop(0, 'rgba(255,217,138,0)');
  rg.addColorStop(0.5, 'rgba(255,217,138,.7)');
  rg.addColorStop(1, 'rgba(255,217,138,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(cx - rw / 2, ruleY, rw, 1);
  const box = { x: r.x, y: ruleY + 7, w: r.w, h: rest ? r.y + r.h - (ruleY + 7) : bodyH };
  if (rest || !wr) drawAbide(ctx, L, sim, box, dt);
  else drawLine(ctx, L, sim, box, wr);
}

/** The place's line (the prayer, the thanks, or the player's words, wrapped by the band), its words arriving one by one. */
function drawLine(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, box: Rect, wr: Wrapped): void {
  let alpha = 1, reveal = 99;
  if (sim.stage === 'at' || sim.stage === 'hold') reveal = sim.stage === 'at' ? sim.stageT : 99;
  else if (sim.stage === 'flow') {
    // the gift of the place just lit, then the next place's line coming
    const k = sim.stageT / RULES.flowSec;
    if (k < 0.5) {
      drawGift(ctx, L, sim.place, box, 1 - k * 2);
      return;
    }
    alpha = (k - 0.5) * 2;
  } else if (sim.stage === 'enter') {
    alpha = clamp(sim.stageT / 1.2);
  } else if (sim.stage === 'whole') {
    drawGift(ctx, L, sim.place, box, 1);
    return;
  }
  if (sim.blind) alpha *= 0.72;
  const total = wr.lines.length * wr.lineH;
  let y = box.y + Math.max(0, (box.h - total) / 2) + wr.lineH / 2;
  ctx.font = font(wr.size, 500, true, true);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const glowK = clamp(sim.reshow / RULES.reshowSec);
  const base = mix('#f3eeff', GOLD_HI, 0.25 + 0.5 * glowK);
  let word = 0;
  for (const line of wr.lines) {
    const words = line.split(' ');
    const lw = ctx.measureText(line).width;
    let x = box.x + (box.w - lw) / 2;
    for (const wd of words) {
      const a = alpha * clamp((reveal - 0.2 - word * 0.08) / 0.35);
      const ww = ctx.measureText(`${wd} `).width;
      if (a > 0.01) {
        ctx.globalAlpha = a;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(6,4,22,.55)';
        ctx.strokeText(wd, x, y);
        ctx.fillStyle = base;
        ctx.fillText(wd, x, y);
      }
      x += ww;
      word++;
    }
    y += wr.lineH;
  }
  ctx.globalAlpha = 1;
}

/** The gift of a place, large, in its glass colour: "Dar: miłość". */
function drawGift(ctx: CanvasRenderingContext2D, L: Layout, place: PlaceId, box: Rect, alpha: number): void {
  if (alpha <= 0.01) return;
  const text = t('hud.gift', { gift: giftName(place) });
  const px = fitFont(ctx, text, box.w, Math.max(17, Math.round(22 * L.u)), MIN_READ, 500, true, true);
  ctx.globalAlpha = alpha;
  ctx.font = font(px, 500, true, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(6,4,22,.6)';
  const y = box.y + box.h / 2;
  ctx.strokeText(text, box.x + box.w / 2, y);
  ctx.fillStyle = mix(PLACE[place].hue, '#ffffff', 0.35);
  ctx.fillText(text, box.x + box.w / 2, y);
  ctx.globalAlpha = 1;
}

/** Rest's row: the breath's turn and its count, a ring beside them that swells in and settles out. */
function drawBreathRow(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, cx: number, y: number): void {
  const b = sim.breath;
  const left = Math.max(1, Math.ceil((b.inhale ? RULES.inhale : RULES.exhale) * (1 - b.p)));
  const word = `${t(b.inhale ? 'hud.in' : 'hud.out')} · ${left}`;
  const px = Math.max(MIN_READ, Math.round(15 * L.u));
  ctx.font = font(px, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(word).width;
  const rx = cx - tw / 2 - px * 0.95, rad = px * (0.3 + 0.32 * b.k);
  ctx.strokeStyle = 'rgba(201,194,255,.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(rx, y, rad, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = LILAC;
  ctx.fillText(word, cx, y);
}

/** How long a page of a verse stays when the whole verse does not fit the band (s), and its crossfade. */
const VERSE_PAGE = 6.5;
const VERSE_FADE = 0.7;
let verseClock = 0;

/**
 * Rest: the place's verse to abide in.  When it does not fit the band whole even at the reading size, it is
 * shown in pages of whole lines that turn slowly, each with its reference — never cut.
 */
function drawAbide(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, box: Rect, dt = 1 / 60): void {
  const id: PassageId = sim.verse;
  const vh = box.h;
  if (vh < 28) return;
  verseClock += dt;
  const cx = box.x + box.w / 2;
  const key = `${id}|${Math.round(box.w)}|${Math.round(vh)}|${L.font.verse}`;
  if (verseMemo?.key !== key) {
    let lay = layoutPassage(ctx, passage(id), box.w, vh, { max: Math.max(MIN_READ, L.font.verse), min: MIN_READ });
    const pages: string[][] = [];
    if (!lay.fits || lay.lines.join(' ').endsWith('…')) {
      // all its lines at the reading size, in pages of what fits
      lay = layoutPassage(ctx, passage(id), box.w, 100000, { max: MIN_READ, min: MIN_READ });
      const per = Math.max(1, Math.floor((vh - lay.refSize - Math.round(lay.size * 0.55)) / lay.lineH));
      for (let i = 0; i < lay.lines.length; i += per) pages.push(lay.lines.slice(i, i + per));
      verseClock = 0;
    }
    verseMemo = { key, lay, pages };
  }
  const { lay, pages } = verseMemo;
  const colors = { text: 'rgba(246,238,255,.92)', ref: 'rgba(255,226,170,.78)' };
  if (!pages.length) {
    drawPassage(ctx, passage(id), lay, cx, box.y + Math.max(0, (vh - lay.height) / 2), colors);
    return;
  }
  const n = Math.floor(verseClock / VERSE_PAGE) % pages.length, inPage = verseClock % VERSE_PAGE;
  const fade = clamp(Math.min(inPage / VERSE_FADE, (VERSE_PAGE - inPage) / VERSE_FADE));
  const lines = pages[n];
  const h = lines.length * lay.lineH + Math.round(lay.size * 0.55) + lay.refSize;
  ctx.globalAlpha = fade;
  drawPassage(ctx, passage(id), { ...lay, lines, height: h }, cx, box.y + Math.max(0, (vh - h) / 2), colors);
  ctx.globalAlpha = 1;
}

// ── the narrator's caption ───────────────────────────────────────
export function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, text: string, alpha: number): void {
  if (!text || alpha <= 0.01) return;
  const r = L.caption;
  const px = Math.max(MIN_READ, L.font.caption);
  ctx.font = font(px, 600);
  let lines = wrap(ctx, text, r.w);
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = `${lines[1].replace(/[\s,;:.]+$/, '')}…`;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const lh = Math.round(px * 1.35);
  let y = r.y + lh / 2 + (L.shape === 'tall' ? 0 : Math.max(0, r.h - lines.length * lh));
  for (const line of lines) {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.strokeText(line, r.x + r.w / 2, y);
    ctx.fillStyle = 'rgba(240,236,255,.95)';
    ctx.fillText(line, r.x + r.w / 2, y);
    y += lh;
  }
  ctx.restore();
}

// ── the story cards ──────────────────────────────────────────────
interface Page { title: string; text: string; verse: PassageId }

function pageOf(sim: RzekiSim): Page | null {
  const s = sim.story;
  if (!s) return null;
  if (s.kind === 'open') {
    return s.page === 0
      ? { title: t('story.open.title'), text: t('story.open.text'), verse: 'isa11.2' }
      : { title: t('story.open2.title'), text: t('story.open2.text'), verse: 'jhn7.38-39' };
  }
  if (s.kind === 'down') return { title: t('story.down.title'), text: t('story.down.text'), verse: 'luk11.13' };
  return { title: t('story.up.title'), text: t('story.up.text'), verse: 'psa141.2' };
}

let storyMemo: { key: string; lay: PassageLayout; lines: string[]; titlePx: number; textPx: number; h: number } | null = null;

/** The story card: a glass card with its title, a sentence or two, its verse, and how to go on. Returns its rectangle. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim): Rect | null {
  const s = sim.story, pg = pageOf(sim);
  if (!s || !pg) return null;
  const u = L.u, inner = Math.min(L.story.w, 560 * u) - 2 * 18;
  const tapPx = 13;
  const key = `${s.kind}${s.page}|${Math.round(inner)}|${Math.round(L.story.h)}`;
  if (storyMemo?.key !== key) {
    const titlePx = fitFont(ctx, pg.title, inner, 26 * u, 18, 600, true);
    const textPx = Math.max(MIN_READ + 1, Math.round(15 * u));
    ctx.font = font(textPx, 500);
    const lines = wrap(ctx, pg.text, inner);
    const fixed = 18 + titlePx * 1.3 + 10 + lines.length * Math.round(textPx * 1.4) + 14 + tapPx * 1.5 + 16;
    const room = Math.max(60, L.story.h - fixed - 12);
    const lay = layoutPassage(ctx, passage(pg.verse), inner, room, { max: Math.max(MIN_READ, Math.round(16 * u)), min: MIN_READ });
    storyMemo = { key, lay, lines, titlePx, textPx, h: fixed + 12 + lay.height };
  }
  const m = storyMemo;
  const r = storyRect(L, m.h);
  const k = ease.outCubic(clamp(s.t / 0.35));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(4,3,16,.5)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(34,24,74,.97)');
  g.addColorStop(1, 'rgba(14,10,38,.97)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,.75)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  let y = r.y + 18;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(m.titlePx, 600, true);
  ctx.fillText(pg.title, cx, y);
  y += m.titlePx * 1.3 + 10;
  ctx.fillStyle = PEARL;
  ctx.font = font(m.textPx, 500);
  for (const line of m.lines) {
    ctx.fillText(line, cx, y);
    y += Math.round(m.textPx * 1.4);
  }
  y += 12;
  drawPassage(ctx, passage(pg.verse), m.lay, cx, y, { text: '#f6e9cf', ref: 'rgba(255,226,170,.78)' });
  y += m.lay.height + 14;
  // the pages, as dots, and how to go on
  if (s.pages > 1) {
    for (let i = 0; i < s.pages; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (s.pages - 1) / 2) * 12, y - 6, i === s.page ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = i === s.page ? GOLD : 'rgba(255,217,138,.4)';
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(226,220,255,.75)';
  ctx.font = font(tapPx, 600);
  ctx.fillText(L.touch ? t('story.tap') : t('story.tap.keys'), cx, y);
  ctx.restore();
  return r;
}

/** A gentle number that rises from what earned it ("+15"). */
export const dropFloat = (n: number): string => `+${Math.round(n)}`;

/** Colour helpers for the view. */
export const hueA = (hex: string, a: number): string => `${rgbaPrefix(hex)}${clamp(a).toFixed(3)})`;

export { MIN_TEXT };
