/**
 * Każda myśl's own words on the canvas (the runner draws the standard HUD): the words band — what the thought is
 * ("Lęk · czarny scenariusz", "Twoja myśl · smutek"), one short line of what to do now (an icon and a few words), and
 * the prayer that gives it to Jesus in a calm serif; in rest the true word that answers the last thought (or its
 * passage) — the rest's breath guide (kit/breathguide.ts) in the slip's place, the narrator's caption, "Nie moja",
 * the opening's story card, and the finale's closing card with its row "how heavy is it now?".  Every text has a
 * floor (never under 11 px; what is read, 13 px and more; the prayer 15 px and more) and is drawn in screen space.
 */
import { breathOf, breathWords, drawBreathGuide } from '../kit/breathguide';
import { clamp } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { blend } from './content';
import { t, type Key } from './i18n';
import { scaleParts, type Layout, type Rect } from './layout';
import { CALM, GOLD, GOLD_HI, INK, PEARL, WARM, fitFont, font, mix, rr, wrap } from './paint';
import { closeVerseFor, pageOf, type MysliSim, type NowWhat } from './sim';

export interface HudState { capK: number; capText: string; bandGlow: number; guideK: number; time: number; reduced: boolean }

/** Whether the play's words are drawn (from the start of play to its end). */
export const hudOn = (sim: MysliSim): boolean => sim.started && sim.phase !== 'done';

const NOW_COLOR: Readonly<Record<NowWhat, string>> = {
  settle: PEARL, arrive: GOLD_HI, burn: GOLD_HI, dark: '#d6d6ec', rest: CALM, valve: CALM, last: CALM, quiet: GOLD_HI, end: PEARL,
};

/** The label of the band: what the thought is, or where the session is. */
export function bandLabel(sim: MysliSim): { text: string; color: string } {
  if (sim.phase !== 'play') return { text: t('lab.end'), color: GOLD_HI };
  const b = sim.block;
  if (b.kind === 'settle') return { text: t('lab.settle', { i: sim.cue + 1 }), color: PEARL };
  if (b.kind === 'quiet') return { text: t('lab.quiet'), color: GOLD_HI };
  if (b.kind === 'rest') {
    if (b.rest === 'valve') return { text: t('lab.valve'), color: CALM };
    if (b.rest === 'last') return { text: t('lab.last'), color: CALM };
    return { text: t(sim.restPage === 'verse' && verseFits !== false ? 'lab.verse' : 'lab.rest'), color: GOLD_HI };
  }
  if (b.blind) return { text: t('lab.dark'), color: '#d6d6ec' };
  const c = sim.cur;
  if (!c) return { text: t('lab.settle', { i: 3 }), color: PEARL };
  return { text: sim.thoughtLabel, color: mix(blend(c.mix, 'ember'), '#ffffff', 0.35) };
}

// ── text helpers ─────────────────────────────────────────────────

function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

interface Wrapped { key: string; lines: string[]; size: number; lineH: number }
const wrapMemo = new Map<string, Wrapped>();

/** Text wrapped into a box: from `px` down to `min` until it fits `maxLines` (memoised). */
function wrapFit(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number, maxLines: number, weight = 500, serif = true, italic = false): Wrapped {
  const key = `${text}|${Math.round(w)}|${px}|${min}|${maxLines}|${weight}|${serif}|${italic}`;
  const hit = wrapMemo.get(key);
  if (hit) return hit;
  let size = Math.max(min, px), lines: string[] = [];
  for (; size >= min; size -= 0.5) {
    ctx.font = font(size, weight, serif, italic);
    lines = wrap(ctx, text, w);
    if (lines.length <= maxLines) break;
  }
  size = Math.max(min, size);
  ctx.font = font(size, weight, serif, italic);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  const out = { key, lines, size, lineH: Math.round(size * 1.32) };
  if (wrapMemo.size > 80) wrapMemo.clear();
  wrapMemo.set(key, out);
  return out;
}

const verseMemo = new Map<string, PassageLayout>();
function verseLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): PassageLayout {
  const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
  let l = verseMemo.get(key);
  if (!l) {
    l = layoutPassage(ctx, passage(id), w, h, { max, min: MIN_READ });
    if (verseMemo.size > 30) verseMemo.clear();
    verseMemo.set(key, l);
  }
  return l;
}

/** A soft dark veil behind words (never a hard box). */
function veil(ctx: CanvasRenderingContext2D, r: Rect, a = 0.5): void {
  ctx.save();
  rr(ctx, r.x - 8, r.y - 6, r.w + 16, r.h + 12, 14);
  ctx.fillStyle = `rgba(10,7,12,${a})`;
  ctx.fill();
  ctx.restore();
}

// ── the whole ────────────────────────────────────────────────────

export function drawHud(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim, hs: HudState): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (sim.story) {
    drawStory(ctx, L, sim);
    ctx.restore();
    return;
  }
  if (sim.phase === 'finale') {
    drawClose(ctx, L, sim);
    if (sim.asking) drawScale(ctx, L, sim);
    else drawBand(ctx, L, sim, hs);
    ctx.restore();
    return;
  }
  if (sim.restBlock && hs.guideK > 0.01) drawGuide(ctx, L, sim, hs);
  drawCaption(ctx, L, sim, hs);
  drawBand(ctx, L, sim, hs);
  if (sim.canSkip) drawSkip(ctx, L, sim);
  ctx.restore();
}

/** The rest's breath guide in the slip's place (the word beside the ring), whole breaths of the player's pattern. */
function drawGuide(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim, hs: HudState): void {
  const b = sim.breath;
  const g = L.guide;
  drawBreathGuide(ctx, b, {
    cx: g.cx, cy: g.cy, r: g.r, layout: 'row', maxW: g.maxW, words: breathWords(), sub: breathOf(b.cycle, b.cycles),
    alpha: clamp(hs.guideK), reducedMotion: hs.reduced, time: hs.time,
  });
}

/** Whether the rest's passage fits the band whole (null: not asked yet); a passage that would be cut is not shown. */
let verseFits: boolean | null = null;

/** The band's body box (under the label and the line of what to do now). */
function bodyBox(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): Rect {
  const r = L.band;
  const lpx = fitFont(ctx, bandLabel(sim).text, r.w, Math.max(MIN_READ, L.font.label), MIN_READ, 700);
  const y = r.y + 2 + Math.round(lpx * 1.6) + nowRowH(L);
  return { x: r.x, y, w: r.w, h: r.y + r.h - y - 2 };
}

/** The rest's passage laid out in the band when it is its page and it fits whole; else null (the true word stays). */
function versePage(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): PassageLayout | null {
  if (sim.restPage !== 'verse' || !sim.restVerseId) {
    verseFits = null;
    return null;
  }
  const body = bodyBox(ctx, L, sim);
  const vl = verseLayout(ctx, sim.restVerseId, body.w, body.h, Math.round(15 * L.u));
  verseFits = vl.fits;
  return vl.fits ? vl : null;
}

/** The height of the band's line of what to do now. */
export const nowRowH = (L: Pick<Layout, 'font'>): number => Math.round(Math.max(MIN_READ, L.font.now) * 1.55) + 4;

function drawBand(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim, hs: HudState): void {
  const r = L.band;
  veil(ctx, r, L.shape === 'tall' ? 0.55 : 0.42);
  const cx = r.x + r.w / 2;
  const lab = bandLabel(sim);
  const lpx = fitFont(ctx, lab.text, r.w, Math.max(MIN_READ, L.font.label), MIN_READ, 700);
  const labH = Math.round(lpx * 1.6);
  const nowH = nowRowH(L);
  let y = r.y + 2;
  ctx.font = font(lpx, 700);
  outlined(ctx, lab.text, cx, y + labH / 2, lab.color);
  y += labH;
  drawNow(ctx, L, sim, cx, y + nowH / 2, r.w);
  y += nowH;
  const body = { x: r.x, y, w: r.w, h: r.y + r.h - y - 2 };
  if (sim.restBlock) {
    const vl = versePage(ctx, L, sim);
    if (vl && sim.restVerseId) drawPassage(ctx, passage(sim.restVerseId), vl, cx, body.y + Math.max(0, (body.h - vl.height) / 2), { text: '#f4efe2', ref: 'rgba(230,226,214,.75)' });
    else drawLines(ctx, L, sim.restWord, body, '#f4efe2', 0);
    return;
  }
  // the prayer (or the settling cue), glowing again after a tap
  const col = hs.bandGlow > 0 ? mix('#f4efe2', '#fff1c9', hs.bandGlow) : '#f4efe2';
  drawLines(ctx, L, sim.line, body, col, 0);
}

/** Words in the calm serif, wrapped and centred in a box (shrinking to the band's floor). */
function drawLines(ctx: CanvasRenderingContext2D, L: Layout, text: string, box: Rect, color: string, minus: number): void {
  const cx = box.x + box.w / 2;
  const maxLines = Math.max(1, Math.min(5, Math.floor(box.h / Math.round(L.font.lineMin * 1.32))));
  const wr = wrapFit(ctx, text, box.w, Math.max(L.font.lineMin, L.font.line - minus), L.font.lineMin, maxLines, 500, true, true);
  let ly = box.y + Math.max(0, (box.h - wr.lines.length * wr.lineH) / 2) + wr.lineH / 2;
  ctx.font = font(wr.size, 500, true, true);
  for (const line of wr.lines) {
    outlined(ctx, line, cx, ly, color);
    ly += wr.lineH;
  }
}

/** The line of what to do now (an icon and a few words). */
function drawNow(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim, cx: number, y: number, w: number): void {
  const what = sim.now;
  const text = t(`now.${what}` as Key);
  const npx = Math.max(MIN_READ, L.font.now);
  const px = fitFont(ctx, text, w - 3 * npx, npx, MIN_READ, 700);
  ctx.font = font(px, 700);
  const tw = ctx.measureText(text).width, ir = px * 0.5, gap = px * 0.5;
  const x0 = cx - (2 * ir + gap + tw) / 2;
  const color = NOW_COLOR[what];
  // the icon: a small flame for focus, a ring that breathes in rest, a dim disc in the dark, a pearl elsewhere
  ctx.save();
  const ix = x0 + ir;
  if (what === 'burn' || what === 'arrive' || what === 'quiet') {
    ctx.fillStyle = sim.goldOn ? GOLD : 'rgba(255,210,122,.55)';
    ctx.beginPath();
    ctx.moveTo(ix, y - ir * 0.95);
    ctx.quadraticCurveTo(ix + ir * 0.75, y + ir * 0.05, ix, y + ir * 0.7);
    ctx.quadraticCurveTo(ix - ir * 0.75, y + ir * 0.05, ix, y - ir * 0.95);
    ctx.fill();
  } else if (sim.restBlock) {
    ctx.strokeStyle = CALM;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(ix, y, ir * (0.4 + 0.55 * sim.breath.k), 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = what === 'dark' ? 'rgba(214,214,236,.45)' : PEARL;
    ctx.beginPath();
    ctx.arc(ix, y, ir * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = 'left';
  outlined(ctx, text, x0 + 2 * ir + gap, y, color);
  ctx.textAlign = 'center';
}

// ── the caption, "Nie moja" ──────────────────────────────────────

function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim, hs: HudState): void {
  if (hs.capK < 0.02 || !hs.capText) return;
  void sim;
  const r = L.caption;
  const px = Math.max(MIN_READ, L.font.caption);
  ctx.font = font(px, 600);
  const max = L.shape === 'tall' ? 3 : 2;
  let lines = wrap(ctx, hs.capText, r.w - 12);
  if (lines.length > max) {
    lines = lines.slice(0, max);
    lines[max - 1] = `${lines[max - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  const lh = Math.round(px * 1.35);
  const h = lines.length * lh + 8;
  ctx.save();
  ctx.globalAlpha = clamp(hs.capK);
  let maxW = 0;
  for (const l of lines) maxW = Math.max(maxW, ctx.measureText(l).width);
  // on a phone upright the caption stands on the band (bottom-aligned); elsewhere it hangs from its top
  const y0 = L.shape === 'tall' ? r.y + r.h - h : r.y;
  veil(ctx, { x: r.x + (r.w - maxW) / 2, y: y0 + 2, w: maxW, h: h - 4 }, 0.45);
  let y = y0 + 4 + lh / 2;
  for (const l of lines) {
    outlined(ctx, l, r.x + r.w / 2, y, '#f4efe2');
    y += lh;
  }
  ctx.restore();
}

/** "Nie moja": a quiet button — the thought is set aside, drifts away, and never comes back. */
function drawSkip(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): void {
  const r = L.skip;
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, r.h * 0.3);
  ctx.fillStyle = 'rgba(14,10,16,.62)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(244,240,232,.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const text = `✕ ${t('skip.btn')}`;
  const px = fitFont(ctx, text, r.w - 14, Math.max(MIN_READ, L.font.button), MIN_READ, 600);
  ctx.font = font(px, 600);
  outlined(ctx, text, r.x + r.w / 2, r.y + r.h / 2, sim.curState === 'leave' ? 'rgba(244,240,232,.5)' : PEARL);
  if (!L.touch && L.shape !== 'tall') {
    const hint = '(N)';
    const hpx = Math.max(MIN_READ, L.font.small);
    ctx.font = font(hpx, 600);
    ctx.textAlign = 'left';
    outlined(ctx, hint, r.x + r.w + 10, r.y + r.h / 2, 'rgba(240,236,226,.75)');
    ctx.textAlign = 'center';
  }
}

// ── the finale: the closing card and "how heavy is it now?" ──────

function drawClose(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): void {
  const box = L.close;
  const pad = Math.round(14 * Math.min(L.u, 1.4));
  const w = Math.min(box.w, Math.round(520 * Math.min(L.u, 1.6)));
  const innerW = w - 2 * pad;
  const title = wrapFit(ctx, t('close.title'), innerW, Math.max(18, Math.round(21 * L.u)), 16, 1, 700, true);
  const text = wrapFit(ctx, t('close.text'), innerW, Math.max(MIN_READ + 1, Math.round(15 * L.u)), MIN_READ, 5, 500, true, true);
  const id = closeVerseFor(sim.session);
  const avail = box.h - 2 * pad - title.lineH - text.lines.length * text.lineH - 20;
  const lay = avail >= 44 ? verseLayout(ctx, id, innerW, avail, Math.round(15 * L.u)) : null;
  // a passage that would be cut is left out (the summary shows one whole)
  const vl = lay && lay.fits ? lay : null;
  const h = Math.min(box.h, 2 * pad + title.lineH + 8 + text.lines.length * text.lineH + (vl ? 12 + vl.height : 0));
  const x = box.x + (box.w - w) / 2, y = box.y + Math.max(0, (box.h - h) / 2);
  ctx.save();
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(16,11,16,.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const cx = x + w / 2;
  let yy = y + pad + title.lineH / 2;
  ctx.font = font(title.size, 700, true);
  outlined(ctx, title.lines[0] ?? '', cx, yy, GOLD_HI);
  yy += title.lineH / 2 + 8 + text.lineH / 2;
  ctx.font = font(text.size, 500, true, true);
  for (const l of text.lines) {
    outlined(ctx, l, cx, yy, '#f4efe2');
    yy += text.lineH;
  }
  if (vl) drawPassage(ctx, passage(id), vl, cx, yy - text.lineH / 2 + 12, { text: '#f4efe2', ref: 'rgba(230,226,214,.75)' });
}

function drawScale(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): void {
  const S = L.scale;
  const p = scaleParts(L);
  veil(ctx, S, 0.55);
  const cx = S.x + S.w / 2;
  const ask = t('scale.ask');
  ctx.font = font(fitFont(ctx, ask, S.w - 12, Math.max(MIN_READ + 2, L.font.label + 2), MIN_READ, 700), 700);
  outlined(ctx, ask, cx, p.ask, GOLD_HI);
  p.buttons.forEach((r, i) => {
    const on = sim.after === i;
    const k = i / 10;
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    // a quiet scale from light (warm pale) to heavy (deep): never red, nothing to win
    ctx.fillStyle = on ? 'rgba(255,210,122,.35)' : `rgba(${Math.round(255 - 120 * k)},${Math.round(240 - 150 * k)},${Math.round(225 - 120 * k)},.12)`;
    ctx.fill();
    ctx.strokeStyle = on ? GOLD : 'rgba(255,255,255,.25)';
    ctx.lineWidth = on ? 2.2 : 1;
    ctx.stroke();
    ctx.restore();
    ctx.font = font(Math.max(MIN_READ + 2, L.font.button + 2), on ? 800 : 600);
    outlined(ctx, String(i), r.x + r.w / 2, r.y + r.h / 2, on ? GOLD_HI : PEARL);
  });
  const small = Math.max(MIN_READ, L.font.small);
  const ends = t(L.touch ? 'scale.ends' : 'scale.keys');
  ctx.font = font(fitFont(ctx, ends, S.w - 12, small, MIN_READ, 600), 600);
  outlined(ctx, ends, cx, p.ends, 'rgba(240,236,226,.82)');
  if (sim.weightText) {
    const th = t('scale.thanks', { w: sim.weightText });
    ctx.font = font(fitFont(ctx, th, S.w - 12, small, MIN_READ, 600), 600);
    outlined(ctx, th, cx, p.thanks, mix(WARM, '#ffffff', 0.4));
  }
}

// ── the story card ───────────────────────────────────────────────

function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: MysliSim): void {
  const s = sim.story!;
  const pg = pageOf(s.kind, s.page);
  const box = L.story;
  const pad = Math.round(18 * Math.min(L.u, 1.4));
  const w = Math.min(box.w, Math.round(520 * Math.min(L.u, 1.6)));
  const innerW = w - 2 * pad;
  const tpx = Math.max(18, Math.round(22 * L.u));
  const title = wrapFit(ctx, pg.title, innerW, tpx, 16, 2, 700, true);
  const text = wrapFit(ctx, pg.text, innerW, Math.max(MIN_READ + 1, Math.round(15 * L.u)), MIN_READ, 8, 500, false);
  const hint = t(L.touch ? 'story.tap' : 'story.click');
  const hpx = Math.max(MIN_READ, L.font.small);
  const avail = box.h - 2 * pad - title.lines.length * title.lineH - text.lines.length * text.lineH - hpx * 2 - 24;
  const vl = verseLayout(ctx, pg.verse, innerW, Math.max(40, avail), Math.round(16 * L.u));
  const h = Math.min(box.h, 2 * pad + title.lines.length * title.lineH + 10 + text.lines.length * text.lineH + 14 + vl.height + 14 + hpx * 1.6);
  const x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(6,4,8,.42)';
  ctx.fillRect(0, 0, L.w, L.h);
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = 'rgba(18,12,16,.93)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,.42)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  const cx = x + w / 2;
  let yy = y + pad + title.lineH / 2;
  ctx.font = font(title.size, 700, true);
  for (const l of title.lines) {
    outlined(ctx, l, cx, yy, GOLD_HI);
    yy += title.lineH;
  }
  yy += 10 - title.lineH / 2 + text.lineH / 2;
  ctx.font = font(text.size, 500);
  for (const l of text.lines) {
    outlined(ctx, l, cx, yy, '#f0ece2');
    yy += text.lineH;
  }
  yy += 14 - text.lineH / 2;
  drawPassage(ctx, passage(pg.verse), vl, cx, yy, { text: '#f4efe2', ref: 'rgba(230,226,214,.75)' });
  ctx.font = font(fitFont(ctx, hint, innerW, hpx, MIN_READ, 600), 600);
  outlined(ctx, hint, cx, y + h - pad * 0.5 - hpx * 0.5, 'rgba(230,226,214,.7)');
}

/** The smallest text this view ever draws (for the tests): the kit's floor. */
export const SMALLEST = MIN_TEXT;
