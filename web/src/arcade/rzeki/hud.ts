/**
 * Rzeki żywej wody's own words on the canvas (the runner draws the standard HUD: the Mendi panel, the score,
 * the coach marks): the prayer band — the station's name as the maps give it ("Serce · Anahata (4)"), one short
 * line of what to do now (an icon and a few words: "Skup się na świecącym centrum", "Odpocznij — oddychaj z
 * postacią"; it changes only when the action changes) and the station's line in a calm serif, the words coming one
 * by one as the light arrives, glowing again when a tap stays with it; in rest the kit's big breath guide on top
 * (kit/breathguide.ts, round 15: the lungs' disc, the phase in a word ≥ 20 px with its seconds, "oddech 2 z 3")
 * and the station's verse to abide in under it; while the
 * stream flows, the gift of the station just lit — the narrator's caption, and the story cards (the opening's two
 * pages, what is new for a player of an earlier version, the closing cards of a way).  Every text is fitted with a
 * floor (never under 11 px; what the player reads, 13 px and more; the prayer 15 px and more), and always drawn in
 * screen space.
 */
import { breathGuideBox, breathGuideRadius, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout, type PassageId } from '../kit/scripture';
import { STATION, fromText, giftName, lineAt, stationLabel, stationName, type StationId } from './content';
import { phaseWord, t, type Key } from './i18n';
import { type Layout, type Rect, labelRowH, storyRect } from './layout';
import { GOLD, GOLD_HI, INK, LILAC, PEARL, SILVER, WATER, fitFont, font, mix, rgbaPrefix, rr, wrap } from './paint';
import { RULES } from './rules';
import { pageOf, type NowWhat, type RzekiSim } from './sim';

// ── the prayer band ──────────────────────────────────────────────

interface Wrapped { key: string; lines: string[]; size: number; lineH: number }
let wrapMemo: Wrapped | null = null;
let verseMemo: { key: string; lay: PassageLayout; pages: string[][] } | null = null;

/**
 * The prayer wrapped into the band: from `px` down to `min` until it fits `maxLines` (memoised by text and box).
 * `balance` (a desktop's column): the same number of lines, made as even as they can be — no word left alone
 * on the last line.
 */
function wrapPrayer(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number, maxLines: number, balance = false, lead = 1.34): Wrapped {
  const key = `${text}|${Math.round(w)}|${px}|${min}|${maxLines}|${balance}|${lead}`;
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
  } else if (balance && lines.length > 1) {
    // the narrowest measure that keeps the count of lines (a few halvings: memoised, so once per line of prayer)
    let lo = ctx.measureText(text).width / lines.length, hi = w;
    for (let i = 0; i < 12 && hi - lo > 1; i++) {
      const mid = (lo + hi) / 2;
      if (wrap(ctx, text, mid).length <= lines.length) hi = mid; else lo = mid;
    }
    lines = wrap(ctx, text, hi);
  }
  wrapMemo = { key, lines, size, lineH: Math.round(size * lead) };
  return wrapMemo;
}

/**
 * The label over the prayer: the way's arrow and the station with its name from the maps (`short`: the name alone,
 * for a band too narrow for the whole); where the way goes on; the dark, abiding, the stream, the whole.
 */
export function bandLabel(sim: RzekiSim, short = false): { text: string; color: string } {
  const s = sim.station, hue = STATION[s].hue;
  const arrow = sim.dir === 'down' ? '↓' : '↑';
  if (sim.stage === 'enter') {
    if (sim.resumed && sim.arrivals === 0) return { text: `${arrow} ${t('hud.resume', { from: fromText(s) })}`, color: GOLD_HI };
    return { text: `${arrow} ${t(sim.dir === 'down' ? 'hud.down' : 'hud.up')}`, color: GOLD_HI };
  }
  if (sim.stage === 'whole') return { text: t('hud.whole'), color: GOLD_HI };
  if (sim.stage === 'flow') return { text: `${arrow} ${t('hud.flow', { name: stationName(sim.nextStation ?? s) })}`, color: WATER };
  if (sim.blind) return { text: `${t('hud.dark')} · ${stationName(s)}`, color: 'rgba(214,214,236,.8)' };
  if (sim.restBlock) return { text: `${t('hud.abide')} · ${stationName(s)}`, color: LILAC };
  const own = sim.own && !short ? ` · ${t('hud.own')}` : '';
  return { text: `${arrow} ${short ? stationName(s) : stationLabel(s)}${own}`, color: hue };
}

/** The band's label fitted to a width: the whole name from the maps, or the station's own name when that does not fit at the reading size. */
export function fitLabel(ctx: CanvasRenderingContext2D, sim: RzekiSim, w: number, px: number): { text: string; color: string; px: number } {
  const full = bandLabel(sim);
  const size = fitFont(ctx, full.text, w, px, MIN_READ, 700);
  if (ctx.measureText(full.text).width <= w + 0.5) return { ...full, px: size };
  const short = bandLabel(sim, true);
  return { ...short, px: fitFont(ctx, short.text, w, px, MIN_READ, 700) };
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
export function drawPrayer(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, dt: number, caption: { text: string; k: number }, still = false): void {
  const r = L.prayer;
  if (!sim.started || sim.story) return;
  if (sim.restBlock) {
    if (L.desk) drawRestDesk(ctx, L, sim, dt, still);
    else drawRestBand(ctx, L, sim, dt, caption, still);
    return;
  }
  if (L.desk) {
    drawPrayerDesk(ctx, L, sim);
    return;
  }
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
  const text = sim.stage === 'flow' && sim.stageT / RULES.flowSec >= 0.5 && sim.nextStation ? lineAt(sim.nextStation, sim.dir, sim.own) : sim.line;
  // the row: the label, or the narrator's line
  const lab = fitLabel(ctx, sim, r.w, Math.max(MIN_READ, L.font.label));
  const lpx = lab.px;
  const labH = Math.round(lpx * 1.5);
  const nowH = nowRowH(L);
  // The prayer is never cut for the narrator: over a prayer of three lines on the smallest phone the narrator's
  // two lines and the prayer both set a little tighter, and when even that would not fit the narrator waits.
  let tight = false, capOk = clines.length > 0;
  if (capOk) {
    ctx.font = font(L.font.prayerMin, 500, true, true);
    const need = wrap(ctx, text, r.w).length;
    const fits = (lead: number, capLead: number) => Math.round(cpx * capLead) * clines.length + nowH + need * Math.round(L.font.prayerMin * lead) <= r.h;
    if (!fits(1.34, 1.35)) {
      tight = true;
      capOk = fits(1.2, 1.2);
    }
  }
  const want = inBand && caption.k > 0.01 && capOk ? 1 : 0;
  rowEase += (want - rowEase) * Math.min(1, dt * 6);
  const capLH = Math.round(cpx * (tight ? 1.2 : 1.35)), capH = capLH * Math.max(1, clines.length);
  const rowH = labH + (Math.max(labH, capH) - labH) * ease.inOutSine(clamp(rowEase));
  // the group's height: the row, the line of what to do now, and the line wrapped
  // the lines the prayer may take: counted for the row it is going to (never fewer while the narrator eases in)
  const lead = tight && rowEase > 0.01 ? 1.2 : 1.34;
  const budget = r.h - (want ? Math.max(labH, capH) : labH) - nowH;
  const maxLines = Math.max(2, Math.min(5, Math.floor(budget / Math.round(L.font.prayerMin * lead))));
  const wr = wrapPrayer(ctx, text, r.w, Math.max(L.font.prayerMin, L.font.prayer), L.font.prayerMin, maxLines, false, lead);
  const bodyH = Math.max(wr.lines.length * wr.lineH, Math.round(26 * L.u));
  const y0 = r.y + Math.max(0, (r.h - (rowH + nowH + bodyH)) / 2);
  const rowMid = y0 + rowH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // one after the other, never both at once: the label fades out in the first half, the narrator in the second
  if (rowEase < 0.5) {
    ctx.globalAlpha = 1 - rowEase * 2;
    ctx.font = font(lpx, 700);
    ctx.fillStyle = lab.color;
    ctx.fillText(lab.text, cx, rowMid);
  }
  if (rowEase > 0.5 && clines.length) {
    ctx.globalAlpha = (rowEase * 2 - 1) * clamp(caption.k);
    drawCaptionLines(ctx, clines, cx, rowMid, cpx, capLH);
  }
  ctx.globalAlpha = 1;
  // what to do now, between the row and the line, with gilded rules either side
  drawNow(ctx, L, sim, cx, y0 + rowH + nowH / 2, r.w);
  const by = y0 + rowH + nowH;
  drawLine(ctx, L, sim, { x: r.x, y: by, w: r.w, h: bodyH }, wr);
}

/** The narrator's lines (one or two) centred on `y`, in the band. */
function drawCaptionLines(ctx: CanvasRenderingContext2D, lines: readonly string[], cx: number, y: number, px: number, lh: number): void {
  ctx.font = font(px, 600);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let yy = y - ((lines.length - 1) * lh) / 2;
  for (const line of lines) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(line, cx, yy);
    ctx.fillStyle = 'rgba(240,236,255,.95)';
    ctx.fillText(line, cx, yy);
    yy += lh;
  }
}

// ── rest: the breath guide over the verse ────────────────────────

/** The guide's phase words: Rzeki's own ("Wdech", "Zatrzymanie", "Wydech", "Bezdech"). */
const guideWords = () => ({ in: phaseWord('in'), holdIn: phaseWord('holdIn'), out: phaseWord('out'), holdOut: phaseWord('holdOut') });

/**
 * The kit's breath guide for this layout (kit/breathguide.ts), its ring and word beside it (`row`): the kit's radius
 * for the canvas, kept to under half of a short band (a phone's, ≥ 26 px always), the words fitted to the band's
 * width; centred on (cx, cy).
 */
function guideOpts(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, cx: number, cy: number, w: number, bandH: number, still: boolean): BreathGuideOpts {
  const b = sim.breath;
  const kit = breathGuideRadius(L.w, L.h);
  const pad = (r: number) => Math.max(10, Math.round(r * 0.3));
  let r = kit;
  // a short band keeps room for the verse: the guide under half of it
  while (r > 26 && 2 * r + 1.4 * pad(r) > bandH * 0.46) r--;
  const o: BreathGuideOpts = {
    cx, cy, r, layout: 'row', words: guideWords(), sub: t('hud.breathOf', { n: b.cycle, of: b.cycles }),
    maxW: Math.max(80, w - (2 * r + 2.9 * pad(r))), reducedMotion: still, time: sim.t, scrim: 0.55,
  };
  void ctx;
  return o;
}

/**
 * Rest on a phone or a tablet (the band under the figure, or beside it on its side): the breath guide on top, the
 * line of what to do now under it — on a phone held upright the narrator speaks there instead, one after the other
 * — and the verse to abide in (the gift, once a way is whole).  Beside the figure the band may reach down to the
 * play's bottom.  Centred as one group.
 */
function drawRestBand(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, dt: number, caption: { text: string; k: number }, still: boolean): void {
  const r0 = L.prayer;
  const r = L.shape === 'tall' ? r0 : { ...r0, h: Math.max(r0.h, L.bottom - 8 - r0.y) };
  const cx = r.x + r.w / 2;
  const go = guideOpts(ctx, L, sim, cx, 0, r.w, r.h, still);
  const gb = breathGuideBox(ctx, go);
  const guideH = gb.h, gap = 6;
  // under the guide: the line of what to do now, or the narrator's (a phone held upright: the band is its place).
  // The guide's word already says what to do: where the line would not fit the band's width at the reading size,
  // or would leave the verse under two lines (the smallest phone with the dock), the guide says it alone
  const inBand = L.shape === 'tall';
  const cpx = Math.max(MIN_READ, L.font.caption);
  const clines = inBand && caption.text ? captionLines(ctx, caption.text, r.w, cpx) : [];
  const want = clines.length && caption.k > 0.01 ? 1 : 0;
  rowEase += (want - rowEase) * Math.min(1, dt * 6);
  const nowOk = nowFits(ctx, sim, r.w) && r.h - guideH - gap - nowRowH(L) >= Math.round(MIN_READ * 4.4);
  const nowH = nowOk ? nowRowH(L) : 0, capLH = Math.round(cpx * 1.3), capH = capLH * Math.max(1, clines.length);
  const midH = nowH + (Math.max(nowH, capH) - nowH) * ease.inOutSine(clamp(rowEase));
  const bodyTop = guideH + gap + midH;
  const room = { x: r.x, y: 0, w: r.w, h: Math.max(0, r.h - bodyTop) };
  const bodyH = sim.stage === 'whole' ? Math.min(room.h, Math.round(40 * L.u)) : Math.min(room.h, abideHeight(ctx, L, sim.verse, room));
  const groupH = bodyTop + bodyH;
  const y0 = r.y + Math.max(0, (r.h - groupH) / 2);
  // a soft dark veil behind the words, never a hard box
  veil(ctx, L, { x: r.x, y: y0, w: r.w, h: groupH });
  drawBreathGuide(ctx, sim.breath, { ...go, cy: y0 + guideH / 2 });
  const midY = y0 + guideH + gap + midH / 2;
  if (rowEase < 0.5 && nowOk) {
    ctx.globalAlpha = 1 - rowEase * 2;
    drawNow(ctx, L, sim, cx, midY, r.w);
  }
  if (rowEase > 0.5 && clines.length) {
    ctx.globalAlpha = (rowEase * 2 - 1) * clamp(caption.k);
    drawCaptionLines(ctx, clines, cx, midY, cpx, capLH);
  }
  ctx.globalAlpha = 1;
  const box = { x: r.x, y: y0 + bodyTop, w: r.w, h: Math.max(bodyH, room.h - (y0 - r.y)) };
  if (sim.stage === 'whole') drawGift(ctx, L, sim.station, { ...box, h: bodyH }, 1);
  else drawAbide(ctx, L, sim, { ...box, h: room.h }, dt, true);
}

/** Whether the line of what to do now fits a width at the reading size (its icon, a gap and the words). */
function nowFits(ctx: CanvasRenderingContext2D, sim: RzekiSim, w: number): boolean {
  ctx.font = font(MIN_READ, 700);
  // drawNow's icon (2 × 0.48 px) and gap (0.55 px) beside the words
  return ctx.measureText(t(`now.${sim.now}` as Key)).width + MIN_READ * 1.51 <= w;
}

/** The soft dark veil behind a group of words (a band across a phone; an oval beside the figure). */
function veil(ctx: CanvasRenderingContext2D, L: Layout, g: Rect): void {
  if (L.shape === 'tall') {
    const g2 = ctx.createLinearGradient(0, g.y - 14, 0, g.y + g.h + 8);
    g2.addColorStop(0, 'rgba(6,4,22,0)');
    g2.addColorStop(0.2, 'rgba(6,4,22,.42)');
    g2.addColorStop(0.8, 'rgba(6,4,22,.48)');
    g2.addColorStop(1, 'rgba(6,4,22,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(L.left, g.y - 14, L.right - L.left, g.h + 22);
    return;
  }
  ctx.save();
  ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
  ctx.scale(g.w / 2 + 50 * L.u, g.h / 2 + 40 * L.u);
  const rg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  rg.addColorStop(0, 'rgba(6,4,22,.5)');
  rg.addColorStop(0.65, 'rgba(6,4,22,.34)');
  rg.addColorStop(1, 'rgba(6,4,22,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

/**
 * How tall the rest's column is on a desktop (the guide, the line of what to do now, the verse): the view keeps
 * the column whole inside the play with it (render.ts `wordsLayout`).
 */
export function restDeskH(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim): number {
  const r = L.prayer;
  const gb = breathGuideBox(ctx, guideOpts(ctx, L, sim, 0, 0, r.w, Infinity, true));
  const room = { x: r.x, y: 0, w: r.w, h: Math.max(160, Math.round(10 * L.font.verse)) };
  return Math.ceil(gb.h + 6 + nowRowH(L) + (sim.stage === 'whole' ? Math.round(40 * L.u) : abideHeight(ctx, L, sim.verse, room)));
}

/**
 * Rest on a desktop or a big screen: the column beside the figure, from the top down — the breath guide (big: the
 * kit's radius for the screen), the line of what to do now, the verse to abide in (or the gift) — over a soft veil.
 */
function drawRestDesk(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, dt: number, still: boolean): void {
  const r = L.prayer, cx = r.x + r.w / 2;
  const go = guideOpts(ctx, L, sim, cx, 0, r.w, Infinity, still);
  const gb = breathGuideBox(ctx, go);
  const nowH = nowRowH(L), gap = 6;
  const top = r.y + gb.h + gap + nowH;
  const room = { x: r.x, y: top, w: r.w, h: Math.max(0, Math.min(L.bottom - 8, r.y + r.h) - top) };
  const bodyH = sim.stage === 'whole' ? Math.min(room.h, Math.round(40 * L.u)) : Math.min(room.h, abideHeight(ctx, L, sim.verse, room));
  veil(ctx, L, { x: r.x, y: r.y, w: r.w, h: gb.h + gap + nowH + bodyH });
  drawBreathGuide(ctx, sim.breath, { ...go, cy: r.y + gb.h / 2 });
  drawNow(ctx, L, sim, cx, r.y + gb.h + gap + nowH / 2, r.w);
  if (sim.stage === 'whole') drawGift(ctx, L, sim.station, { ...room, h: bodyH }, 1);
  else drawAbide(ctx, L, sim, room, dt, true);
}

/** The height of the band's line of what to do now (its text and a little air). */
export const nowRowH = (L: Pick<Layout, 'u' | 'desk'>): number => Math.round(nowPx(L) * 1.55) + 4;
const nowPx = (L: Pick<Layout, 'u' | 'desk'>): number => Math.max(MIN_READ, Math.round(13 * L.u));

/** The now-line's colour for what to do. */
const NOW_COLOR: Readonly<Record<NowWhat, string>> = {
  warm: PEARL, focus: GOLD_HI, dark: SILVER, rest: LILAC, valve: LILAC, end: PEARL,
};

/**
 * The line of what to do now (the round-11 clarity rule): an icon and a few words, centred between two short gilded
 * rules — "Skup się na świecącym centrum", "Odpocznij — oddychaj z postacią", "Odpocznij chwilę — centrum
 * zaczeka".  It changes only when the action changes (the block), never with the signal.
 */
function drawNow(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, cx: number, y: number, w: number): void {
  const what = sim.now;
  const text = t(`now.${what}` as Key);
  const px = fitFont(ctx, text, w - 6 * nowPx(L), nowPx(L), MIN_READ, 700);
  ctx.font = font(px, 700);
  const tw = ctx.measureText(text).width, ir = px * 0.48, gap = px * 0.55;
  const total = 2 * ir + gap + tw;
  const x0 = cx - total / 2;
  const color = NOW_COLOR[what];
  // the rules either side
  const rw = Math.min((w - total) / 2 - 8, 70 * L.u);
  if (rw > 8) {
    for (const [a, b] of [[x0 - 8 - rw, x0 - 8], [x0 + total + 8, x0 + total + 8 + rw]]) {
      const rg = ctx.createLinearGradient(a, 0, b, 0);
      const fadeLeft = a < x0;
      rg.addColorStop(0, fadeLeft ? 'rgba(255,217,138,0)' : 'rgba(255,217,138,.6)');
      rg.addColorStop(1, fadeLeft ? 'rgba(255,217,138,.6)' : 'rgba(255,217,138,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(a, y - 0.5, b - a, 1);
    }
  }
  nowIcon(ctx, what, x0 + ir, y, ir, sim);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x0 + 2 * ir + gap, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x0 + 2 * ir + gap, y);
  ctx.textAlign = 'center';
}

/** The now-line's icon: a small sun for focus, a dim moon-disc in the dark, a ring that breathes in rest, a pearl at the edges. */
function nowIcon(ctx: CanvasRenderingContext2D, what: NowWhat, x: number, y: number, r: number, sim: RzekiSim): void {
  ctx.save();
  if (what === 'focus') {
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.2, r * 0.18);
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.stroke();
    }
  } else if (what === 'dark') {
    ctx.fillStyle = 'rgba(214,214,236,.35)';
    ctx.strokeStyle = SILVER;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (what === 'rest' || what === 'valve') {
    const k = sim.restBlock ? sim.breath.k : 0.5;
    ctx.strokeStyle = LILAC;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.45 + 0.5 * k), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = PEARL;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The prayer's column on a desktop or a big screen (DESIGN §14): from the top down — its first row (the station's
 * name) level with the station, as the view keeps the column there (layout `wordsAt`), a gilded rule, then the line
 * in balanced lines — over a soft veil fitted to them.  (Rest has its own column: `drawRestDesk`.)
 */
function drawPrayerDesk(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim): void {
  const r = L.prayer, cx = r.x + r.w / 2;
  const lab = fitLabel(ctx, sim, r.w, Math.max(MIN_READ, L.font.label));
  const lpx = lab.px;
  const rowH = labelRowH(L);
  const nowH = nowRowH(L);
  const areaH = r.h - rowH - nowH;
  const box = { x: r.x, y: r.y + rowH + nowH, w: r.w, h: r.h - rowH - nowH };
  const maxLines = Math.max(2, Math.min(5, Math.floor(areaH / Math.round(L.font.prayerMin * 1.34))));
  const wr = wrapPrayer(ctx, sim.stage === 'flow' && sim.stageT / RULES.flowSec >= 0.5 && sim.nextStation ? lineAt(sim.nextStation, sim.dir, sim.own) : sim.line,
    r.w, Math.max(L.font.prayerMin, L.font.prayer), L.font.prayerMin, maxLines, true);
  const bodyH = Math.min(box.h, Math.max(wr.lines.length * wr.lineH, Math.round(26 * L.u)));
  box.h = bodyH;
  // a soft dark veil fitted to the words, never a hard box
  const groupH = rowH + nowH + bodyH;
  ctx.save();
  ctx.translate(cx, r.y + groupH / 2);
  ctx.scale(r.w / 2 + 56 * L.u, groupH / 2 + 44 * L.u);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, 'rgba(6,4,22,.5)');
  g.addColorStop(0.65, 'rgba(6,4,22,.34)');
  g.addColorStop(1, 'rgba(6,4,22,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  const rowMid = r.y + rowH / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = font(lpx, 700);
  ctx.fillStyle = lab.color;
  ctx.fillText(lab.text, cx, rowMid);
  // what to do now, under the row
  drawNow(ctx, L, sim, cx, r.y + rowH + nowH / 2, r.w);
  drawLine(ctx, L, sim, box, wr);
}

/** The station's line (the prayer, the thanks, or the player's words, wrapped by the band), its words arriving one by one. */
function drawLine(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, box: Rect, wr: Wrapped): void {
  let alpha = 1, reveal = 99;
  if (sim.stage === 'at' || sim.stage === 'hold') reveal = sim.stage === 'at' ? sim.stageT : 99;
  else if (sim.stage === 'flow') {
    // the gift of the station just lit, then the next station's line coming
    const k = sim.stageT / RULES.flowSec;
    if (k < 0.5) {
      drawGift(ctx, L, sim.station, box, 1 - k * 2);
      return;
    }
    alpha = (k - 0.5) * 2;
  } else if (sim.stage === 'enter') {
    alpha = clamp(sim.stageT / 1.2);
  } else if (sim.stage === 'whole') {
    drawGift(ctx, L, sim.station, box, 1);
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

/** The gift of a station, large, in its glass colour: "Dar: miłość". */
function drawGift(ctx: CanvasRenderingContext2D, L: Layout, station: StationId, box: Rect, alpha: number): void {
  if (alpha <= 0.01) return;
  const text = t('hud.gift', { gift: giftName(station) });
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
  ctx.fillStyle = mix(STATION[station].hue, '#ffffff', 0.35);
  ctx.fillText(text, box.x + box.w / 2, y);
  ctx.globalAlpha = 1;
}

/** How long a page of a verse stays when the whole verse does not fit the band (s), and its crossfade. */
const VERSE_PAGE = 6.5;
const VERSE_FADE = 0.7;
let verseClock = 0;

/**
 * Rest: the station's verse to abide in.  When it does not fit the band whole even at the reading size, it is
 * shown in pages of whole lines that turn slowly, each with its reference — never cut.
 */
function drawAbide(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, box: Rect, dt = 1 / 60, top = false): void {
  const id: PassageId = sim.verse;
  const vh = box.h;
  if (vh < 28) return;
  verseClock += dt;
  const cx = box.x + box.w / 2;
  const { lay, pages } = abideLayout(ctx, L, id, box);
  const colors = { text: 'rgba(246,238,255,.92)', ref: 'rgba(255,226,170,.78)' };
  if (!pages.length) {
    drawPassage(ctx, passage(id), lay, cx, box.y + (top ? 0 : Math.max(0, (vh - lay.height) / 2)), colors);
    return;
  }
  const n = Math.floor(verseClock / VERSE_PAGE) % pages.length, inPage = verseClock % VERSE_PAGE;
  const fade = clamp(Math.min(inPage / VERSE_FADE, (VERSE_PAGE - inPage) / VERSE_FADE));
  const lines = pages[n];
  const h = lines.length * lay.lineH + Math.round(lay.size * 0.55) + lay.refSize;
  ctx.globalAlpha = fade;
  drawPassage(ctx, passage(id), { ...lay, lines, height: h }, cx, box.y + (top ? 0 : Math.max(0, (vh - h) / 2)), colors);
  ctx.globalAlpha = 1;
}

/**
 * The verse laid out for its box (memoised): whole at up to the layout's verse size when it fits, else all its
 * lines at the reading size in pages of what fits.  (A passage may end with its own "…": only a layout that
 * does not fit is paged.)
 */
function abideLayout(ctx: CanvasRenderingContext2D, L: Layout, id: PassageId, box: Rect): { lay: PassageLayout; pages: string[][] } {
  const vh = box.h;
  const key = `${id}|${Math.round(box.w)}|${Math.round(vh)}|${L.font.verse}`;
  if (verseMemo?.key !== key) {
    let lay = layoutPassage(ctx, passage(id), box.w, vh, { max: Math.max(MIN_READ, L.font.verse), min: MIN_READ });
    const pages: string[][] = [];
    if (!lay.fits) {
      // all its lines at the reading size, in pages of what fits
      lay = layoutPassage(ctx, passage(id), box.w, 100000, { max: MIN_READ, min: MIN_READ });
      const per = Math.max(1, Math.floor((vh - lay.refSize - Math.round(lay.size * 0.55)) / lay.lineH));
      for (let i = 0; i < lay.lines.length; i += per) pages.push(lay.lines.slice(i, i + per));
      verseClock = 0;
    }
    verseMemo = { key, lay, pages };
  }
  return verseMemo;
}

/** How tall the verse is drawn in its box (its tallest page when it turns pages). */
function abideHeight(ctx: CanvasRenderingContext2D, L: Layout, id: PassageId, box: Rect): number {
  if (box.h < 28) return 0;
  const { lay, pages } = abideLayout(ctx, L, id, box);
  if (!pages.length) return lay.height;
  return Math.max(...pages.map(p => p.length)) * lay.lineH + Math.round(lay.size * 0.55) + lay.refSize;
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

let storyMemo: { key: string; lay: PassageLayout; lines: string[]; titlePx: number; textPx: number; h: number } | null = null;

/**
 * The story card: a glass card with its title, a sentence or two, its verse, and how to go on. Returns its
 * rectangle.  `hover`: the mouse is over it (a click turns the page) — its rim and its "go on" brighten.
 */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: RzekiSim, hover = false): Rect | null {
  const s = sim.story;
  if (!s) return null;
  const pg = pageOf(s.kind, s.page);
  const u = L.u, inner = Math.min(L.story.w, 560 * u) - 2 * 18;
  // how to go on: read from further away on a desktop, the page dots with room of their own above it
  const tapPx = L.desk ? Math.round(13 * u) : 13;
  const dotsGap = L.desk ? Math.round(14 * u) + 10 : 14, dotsUp = L.desk ? Math.round(10 * u) : 6, dotStep = L.desk ? 12 * u : 12;
  const key = `${s.kind}${s.page}|${Math.round(inner)}|${Math.round(L.story.h)}`;
  if (storyMemo?.key !== key) {
    const titlePx = fitFont(ctx, pg.title, inner, 26 * u, 18, 600, true);
    const textPx = Math.max(MIN_READ + 1, Math.round(15 * u));
    ctx.font = font(textPx, 500);
    const lines = wrap(ctx, pg.text, inner);
    const fixed = 18 + titlePx * 1.3 + 10 + lines.length * Math.round(textPx * 1.4) + dotsGap + tapPx * 1.5 + 16;
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
  ctx.strokeStyle = hover ? 'rgba(255,231,180,.95)' : 'rgba(255,217,138,.75)';
  ctx.lineWidth = hover ? 2 : 1.4;
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
  y += m.lay.height + dotsGap;
  // the pages, as dots, and how to go on
  if (s.pages > 1) {
    for (let i = 0; i < s.pages; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (s.pages - 1) / 2) * dotStep, y - dotsUp, (i === s.page ? 3 : 2) * (L.desk ? u : 1), 0, Math.PI * 2);
      ctx.fillStyle = i === s.page ? GOLD : 'rgba(255,217,138,.4)';
      ctx.fill();
    }
  }
  ctx.fillStyle = hover ? GOLD_HI : 'rgba(226,220,255,.75)';
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
