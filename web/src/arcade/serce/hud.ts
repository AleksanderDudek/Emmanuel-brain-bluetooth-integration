/**
 * Z głowy do serca's words on the canvas (DESIGN.md §12 clarity rules): the "now" line under the HUD (one short line
 * with an icon, changing only with the action), the words card (the heart word split on the breath — the half said now
 * bright —, a blessing's line, or its verse; the breath's phase; the stage's light as a thin bar; on a desk the way as a
 * list), the narrator's caption at the top of the picture and the story card.  Reading text ≥ 13 px, never under 11.
 *
 * Round 16 (the way in stages): each stage opens with its title card over the picture ("Etap 4 z 9" over "Krąg 1 —
 * Rodzina"), a thin line along the card's top fills with the stage's time (no ticking seconds), and the desk's way
 * list shows the nine stages.
 *
 * In rest the kit's breath guide (kit/breathguide.ts, round 15) says the breath — the lungs' disc, the phase in a word
 * ≥ 20 px with its seconds, "oddech 2 z 3": on a phone held upright in its own band over the card (the picture gives
 * it room, render.ts), on its side and on a desk at the card's foot in place of the small breath line.
 */
import { breathGuideRadius, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import type { BreathPhase } from '../kit/breath';
import { drawPassage, layoutPassage, passage, type PassageId } from '../kit/scripture';
import type { Rect } from '../kit/mobile';
import { WAY_LEN, stageTitle } from './content';
import { cap, t } from './i18n';
import type { Layout } from './layout';
import { GOLD, GOLD_HI, PEARL, ROSE, font, fitLines, rr, SERIF } from './paint';
import { RULES } from './rules';
import { STORY_PAGES, pageOf, type SerceSim, type TitleCard, type Words } from './sim';

const ICON: Record<string, string> = {
  warm: '◌', descent: '↓', heart: '◉', field: '◎', reach: '◎', kindle: '✦', sun: '☀', pervade: '✛', back: '◉', more: '✦',
  rest: '☾', grat: '☾', stop: '☾', valve: '☾', nosig: '…', end: '✦', abide: '◎',
};

/** The "now" line: an icon and one short line in a soft pill. */
export function drawNow(ctx: CanvasRenderingContext2D, L: Layout, sim: SerceSim, alpha: number): void {
  const r = L.now;
  const text = `${ICON[sim.now] ?? '·'}  ${sim.nowText}`;
  const { lines, size } = fitLines(ctx, text, r.w - 24, L.fs.now, 13, 1, 650, false, false);
  ctx.save();
  ctx.font = font(size, 650);
  const tw = Math.min(r.w, ctx.measureText(lines[0] ?? '').width + 26);
  const x = L.kind === 'tall' ? r.x + r.w / 2 - tw / 2 : r.x + (L.kind === 'desk' ? r.w / 2 - tw / 2 : 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(14,10,32,.62)';
  rr(ctx, x, r.y, tw, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = sim.now === 'nosig' ? '#d8d4ea' : GOLD_HI;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lines[0] ?? '', x + tw / 2, r.y + r.h / 2 + 0.5);
  ctx.restore();
}

// ── rest: the breath guide ───────────────────────────────────────

/** The guide's phase words: the game's own ("Wdech", "Zatrzymaj", "Wydech", "Bezdech"). */
const guideWords = (): Record<BreathPhase, string> =>
  ({ in: cap(t('br.in')), holdIn: cap(t('br.holdIn')), out: cap(t('br.out')), holdOut: cap(t('br.holdOut')) });

/** The guide's ring radius here: the kit's for the canvas (≥ 26 px), no more than a narrow card leaves room for. */
export function guideR(L: Pick<Layout, 'w' | 'h' | 'kind' | 'card'>): number {
  const kit = breathGuideRadius(L.w, L.h);
  return L.kind === 'tall' ? kit : Math.max(26, Math.min(kit, Math.round(L.card.w * 0.13)));
}

/** The guide's height in a row (its ring and a padding above and below, as kit/breathguide.ts sizes it). */
export function guideH(r: number): number {
  return Math.ceil(2 * r + 1.4 * Math.max(10, Math.round(r * 0.3)));
}

function guideOpts(L: Layout, sim: SerceSim, cx: number, cy: number, w: number, still: boolean, time: number): BreathGuideOpts {
  const b = sim.breath, r = guideR(L);
  const pad = Math.max(10, Math.round(r * 0.3));
  return {
    cx, cy, r, layout: 'row', words: guideWords(), sub: t('br.of', { n: b.cycle, of: b.cycles }),
    maxW: Math.max(80, w - (2 * r + 2.9 * pad)), reducedMotion: still, time, scrim: 0.55,
  };
}

/**
 * A phone held upright: the guide in its band between the picture and the card (render.ts gives the band `alpha`
 * as it opens), centred.
 */
export function drawGuideBand(ctx: CanvasRenderingContext2D, L: Layout, sim: SerceSim, alpha: number, still: boolean, time: number): void {
  if (!sim.restBlock || alpha <= 0.01) return;
  const gh = guideH(guideR(L));
  const o = guideOpts(L, sim, L.card.x + L.card.w / 2, L.card.y - 4 - gh / 2, L.card.w, still, time);
  drawBreathGuide(ctx, sim.breath, { ...o, alpha });
}

/** Cached passage layouts (a layout is costly; the card's size and the verse change rarely). */
const passageMemo = new Map<string, ReturnType<typeof layoutPassage>>();
function passageLayout(ctx: CanvasRenderingContext2D, id: PassageId, w: number, h: number, max: number): ReturnType<typeof layoutPassage> {
  const key = `${id}|${Math.round(w)}|${Math.round(h)}|${max}`;
  let l = passageMemo.get(key);
  if (!l) {
    l = layoutPassage(ctx, passage(id), w, h, { max, min: 12 });
    if (passageMemo.size > 40) passageMemo.clear();
    passageMemo.set(key, l);
  }
  return l;
}

/** The stage's share of light now (0..1) for the card's bar (the current push's stage). */
function stageLight(sim: SerceSim): number {
  const s = sim.stage;
  return sim.prog[s] ?? 0;
}

/**
 * The words card.  `fade` (0..1) eases a change of content in; `glow` (0..1) brightens the words after a tap.  Returns
 * nothing; the card is not a control (a tap anywhere stays with the words).
 */
export function drawCard(ctx: CanvasRenderingContext2D, L: Layout, sim: SerceSim, w: Words, fade: number, glow: number, pulse: number | null, time: number, still = false): void {
  const r = L.card;
  const pad = Math.round(12 * Math.min(L.ui, 1.5));
  ctx.save();
  ctx.fillStyle = 'rgba(16,10,34,.74)';
  rr(ctx, r.x, r.y, r.w, r.h, 14 * Math.min(L.ui, 1.4));
  ctx.fill();
  ctx.strokeStyle = `rgba(255,217,138,${0.16 + 0.3 * glow})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  const x0 = r.x + pad, x1 = r.x + r.w - pad, cw = x1 - x0;
  let y = r.y + pad;
  // the header: the stage or the ring; the pulse on the right, only when real
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const headPx = L.fs.head;
  let headW = cw;
  if (pulse !== null) {
    ctx.font = font(headPx, 600);
    const ptxt = t('pulse', { n: pulse });
    const pw = ctx.measureText(ptxt).width;
    ctx.fillStyle = 'rgba(255,190,200,.85)';
    ctx.textAlign = 'right';
    ctx.fillText(ptxt, x1, y);
    // a small beating dot before it
    const beat = 0.5 + 0.5 * Math.cos(time * Math.PI * 2 * (pulse / 60));
    ctx.globalAlpha = 0.5 + 0.5 * beat;
    ctx.fillStyle = ROSE;
    ctx.beginPath();
    ctx.arc(x1 - pw - 7, y + headPx * 0.55, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    headW = cw - pw - 18;
  }
  const head = fitLines(ctx, w.head, headW, headPx, 12, 1, 700, false, false);
  ctx.font = font(head.size, 700);
  ctx.fillStyle = GOLD;
  ctx.fillText(head.lines[0] ?? '', x0, y);
  y += Math.round(head.size * 1.5);
  // the stage's time: a thin line along the card's top, filling calmly (no seconds)
  drawStageLine(ctx, sim, x0, r.y + Math.max(4, Math.round(pad * 0.4)), cw);

  // the footer: the breath guide in rest (on a phone held upright it has its own band over the card), the stage's
  // light in a push
  const footPx = Math.max(12, Math.round(12.5 * Math.min(L.ui, 1.5)));
  const rest = sim.restBlock;
  const footH = rest ? (L.kind === 'tall' ? 0 : guideH(guideR(L))) : Math.round(footPx * 1.6);
  const footY = r.y + r.h - pad - footH;
  // the way as a list where the card keeps room for the words beside it (a rest's verse needs more: it comes first)
  const desk = L.kind !== 'tall' && footY - 6 - wayListHeight(L) - y >= (rest ? 150 : 110);
  const listH = desk ? wayListHeight(L) : 0;
  const mainBottom = footY - 6 - listH;
  const mainH = Math.max(20, mainBottom - y);

  // a new stage: its title card holds the main area for its first seconds, the words come back after it
  const tk = sim.titleK;
  ctx.globalAlpha = (0.25 + 0.75 * fade) * (1 - tk);
  if (tk > 0.99) {
    // the title alone
  } else if (w.verse) {
    const maxPx = Math.min(L.fs.verse, Math.max(13, Math.floor(mainH / 3.2)));
    const lay = passageLayout(ctx, w.verse, cw, mainH, maxPx);
    drawPassage(ctx, passage(w.verse), lay, r.x + r.w / 2, y + Math.max(0, (mainH - lay.height) / 2), { text: PEARL, ref: 'rgba(255,217,138,.78)' });
  } else if (w.word) {
    // the heart word: the half said now bright, the other dim, each on its own line(s); measured at the bolder weight
    // and shrunk until both halves fit the space, so neither ever leaves the card
    const halves = [{ text: w.main, on: w.word === 'in' }, { text: w.second, on: w.word === 'out' }];
    let size = Math.min(L.fs.main + 2, Math.max(13, Math.floor(mainH / 2.8)));
    let lines: string[][] = [];
    let lh = 0;
    for (;;) {
      lines = halves.map(hf => fitLines(ctx, hf.text, cw - 4, size, size, 2, 600, true, true).lines);
      lh = Math.round(size * 1.28);
      const total = (lines[0].length + lines[1].length) * lh + Math.round(lh * 0.25);
      if (total <= mainH || size <= 13) break;
      size -= 1;
    }
    const total = (lines[0].length + lines[1].length) * lh + Math.round(lh * 0.25);
    let yy = y + Math.max(0, (mainH - total) / 2);
    ctx.textAlign = 'center';
    halves.forEach((hf, i) => {
      ctx.font = font(size, hf.on ? 600 : 400, true, true);
      ctx.fillStyle = hf.on ? (glow > 0 ? GOLD_HI : '#fff0d8') : 'rgba(226,214,255,.42)';
      for (const ln of lines[i]) {
        ctx.fillText(ln, r.x + r.w / 2, yy);
        yy += lh;
      }
      yy += Math.round(lh * 0.25);
    });
  } else if (w.main) {
    let size = Math.min(L.fs.main + 2, Math.max(13, Math.floor(mainH / 2.2)));
    let fit = fitLines(ctx, w.main, cw, size, size, 3, 500, true, true);
    while (size > 13 && fit.lines.length * Math.round(size * 1.3) > mainH) {
      size -= 1;
      fit = fitLines(ctx, w.main, cw, size, size, 3, 500, true, true);
    }
    const lh = Math.round(fit.size * 1.3);
    let yy = y + Math.max(0, (mainH - fit.lines.length * lh) / 2);
    ctx.font = font(fit.size, 500, true, true);
    ctx.fillStyle = glow > 0 ? GOLD_HI : '#fff3e2';
    ctx.textAlign = 'center';
    for (const ln of fit.lines) {
      ctx.fillText(ln, r.x + r.w / 2, yy);
      yy += lh;
    }
  }
  ctx.globalAlpha = 1;
  if (tk > 0.01) drawTitle(ctx, L, sim.titleOf(), x0, y, cw, mainH, tk);

  if (desk) drawWayList(ctx, L, sim, x0, mainBottom + 4, cw);

  // the footer
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(footPx, 600);
  const fy = footY + footH / 2;
  // the text on the left, a bar in the room left on the right (none when the card is too narrow for both)
  const bar = (from: number, k: number, on: boolean): void => {
    const bx = from <= x0 ? x0 : Math.max(from, x1 - Math.max(60, cw * 0.4));
    const bw = x1 - bx;
    if (bw < 44) return;
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    rr(ctx, bx, fy - 3, bw, 6, 3);
    ctx.fill();
    ctx.fillStyle = on ? 'rgba(255,217,138,.95)' : 'rgba(255,217,138,.55)';
    rr(ctx, bx, fy - 3, Math.max(6, bw * k), 6, 3);
    ctx.fill();
  };
  if (rest) {
    if (L.kind !== 'tall') drawBreathGuide(ctx, sim.breath, guideOpts(L, sim, r.x + r.w / 2, fy, cw, still, time));
  } else if (sim.pushBlock) {
    const lead = sim.blockT < sim.leadIn;
    let from = x0;
    if (lead) {
      const f = fitLines(ctx, t('br.gentle'), cw, footPx, 12, 1, 600, false, false);
      ctx.font = font(f.size, 600);
      ctx.fillStyle = 'rgba(236,228,255,.7)';
      ctx.fillText(f.lines[0] ?? '', x0, fy);
      from = x0 + ctx.measureText(f.lines[0] ?? '').width + 12;
    }
    bar(from, stageLight(sim), sim.moving);
  }
  ctx.restore();
}

/** The stage's time as a thin line: its track, and how far its least length has gone (full while it runs longer). */
function drawStageLine(ctx: CanvasRenderingContext2D, sim: SerceSim, x: number, y: number, w: number): void {
  if (!sim.run || w < 40) return;
  const k = sim.stageK;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.09)';
  rr(ctx, x, y - 1, w, 2, 1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,217,138,.62)';
  rr(ctx, x, y - 1, Math.max(2, w * k), 2, 1);
  ctx.fill();
  ctx.restore();
}

/** The way as a list on a desk's card: the nine stages (◉ now, ✓ walked, ○ waiting, – left out today). */
export const wayListHeight = (L: Layout): number => Math.round(WAY_LEN * wayLine(L) + 10);
const wayLine = (L: Layout): number => Math.max(19, Math.min(24, 19 * L.ui));

function drawWayList(ctx: CanvasRenderingContext2D, L: Layout, sim: SerceSim, x: number, y: number, w: number): void {
  const lh = wayLine(L);
  const px = Math.max(12, Math.min(15, Math.round(12.5 * L.ui)));
  ctx.save();
  ctx.strokeStyle = 'rgba(255,217,138,.15)';
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  ctx.lineTo(x + w, y + 2);
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (let i = 0; i < WAY_LEN; i++) {
    const st = sim.wayState(i);
    const mark = st === 'out' ? '–' : st === 'done' ? '✓' : st === 'now' ? '◉' : '○';
    const yy = y + 10 + i * lh + lh / 2;
    ctx.font = font(px, st === 'now' ? 700 : 500);
    ctx.fillStyle = st === 'out' ? 'rgba(220,214,240,.35)' : st === 'now' ? GOLD_HI : st === 'done' ? 'rgba(255,217,138,.85)' : 'rgba(226,220,250,.55)';
    const label = fitLines(ctx, `${mark}  ${i + 1}. ${stageTitle(i)}`, w, px, 12, 1, st === 'now' ? 700 : 500, false, false);
    ctx.font = font(label.size, st === 'now' ? 700 : 500);
    ctx.fillText(label.lines[0] ?? '', x, yy);
  }
  ctx.restore();
}

/**
 * A stage's title card in the words card's main area for its first seconds (`alpha` fades it in and out; the words
 * fade back after it): "Etap 4 z 9" small in gold, the stage's name large in the serif, a line under it (the re-entry:
 * what comes after it).  The card is never under the runner's block banner, on a phone or a desk.
 */
function drawTitle(ctx: CanvasRenderingContext2D, L: Layout, c: TitleCard, x: number, y: number, w: number, h: number, alpha: number): void {
  if (alpha <= 0.01 || !c.title) return;
  const ui = Math.min(L.ui, 1.5);
  const kPx = Math.max(13, Math.round(13 * ui));
  let tPx = Math.max(18, Math.round(24 * ui));
  const sPx = Math.max(13, Math.round(13.5 * ui));
  let kick, title, sub, kl = 0, tl = 0, sl = 0, total = 0;
  for (;;) {
    kick = fitLines(ctx, c.kicker, w, kPx, 12, 1, 700, false, false);
    title = fitLines(ctx, c.title, w, tPx, 15, 2, 600, true, false);
    sub = c.sub ? fitLines(ctx, c.sub, w, sPx, 12, 2, 500, false, false) : { lines: [] as string[], size: sPx };
    kl = Math.round(kick.size * 1.5);
    tl = Math.round(title.size * 1.22);
    sl = Math.round(sub.size * 1.35);
    total = kl + title.lines.length * tl + (sub.lines.length ? 6 + sub.lines.length * sl : 0);
    if (total <= h || tPx <= 15) break;
    tPx -= 1;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const cx = x + w / 2;
  let yy = y + Math.max(0, (h - total) / 2);
  ctx.font = font(kick.size, 700);
  ctx.fillStyle = GOLD;
  ctx.fillText(kick.lines[0] ?? '', cx, yy);
  yy += kl;
  ctx.font = `600 ${title.size}px ${SERIF}`;
  ctx.fillStyle = GOLD_HI;
  for (const l of title.lines) { ctx.fillText(l, cx, yy); yy += tl; }
  if (sub.lines.length) {
    yy += 6;
    ctx.font = font(sub.size, 500);
    ctx.fillStyle = '#ece6ff';
    for (const l of sub.lines) { ctx.fillText(l, cx, yy); yy += sl; }
  }
  ctx.restore();
}

/** The narrator's line at the top of the picture, fading in and out. */
export function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, text: string, alpha: number): void {
  if (!text || alpha <= 0.01) return;
  const p = L.pic;
  const maxW = Math.min(p.w - 24, 560 * Math.min(L.ui, 1.6));
  const fit = fitLines(ctx, text, maxW, L.fs.caption, 13, 2, 500, true, true);
  const lh = Math.round(fit.size * 1.3);
  const y = p.y + 8;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(fit.size, 500, true, true);
  const tw = Math.max(...fit.lines.map(l => ctx.measureText(l).width)) + 22;
  ctx.fillStyle = 'rgba(10,8,26,.5)';
  rr(ctx, p.x + p.w / 2 - tw / 2, y - 4, tw, fit.lines.length * lh + 8, 10);
  ctx.fill();
  ctx.fillStyle = '#f7efff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  fit.lines.forEach((ln, i) => ctx.fillText(ln, p.x + p.w / 2, y + i * lh));
  ctx.restore();
}

/** The story card (the first session's opening): its rect, for the hit test. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: SerceSim, touch: boolean): Rect | null {
  const s = sim.story;
  if (!s) return null;
  const pg = pageOf(s.page);
  const box = L.story;
  const pad = Math.round(18 * Math.min(L.ui, 1.4));
  const w = box.w, cw = w - 2 * pad;
  ctx.save();
  const titlePx = Math.round(22 * Math.min(L.ui, 1.4));
  const textPx = Math.max(14, Math.round(15 * Math.min(L.ui, 1.4)));
  const title = fitLines(ctx, pg.title, cw, titlePx, 16, 2, 600, true, false);
  const body = fitLines(ctx, pg.text, cw, textPx, 13, 9, 500, false, false);
  const tl = Math.round(title.size * 1.25), bl = Math.round(body.size * 1.45);
  const footPx = Math.max(12, Math.round(12.5 * Math.min(L.ui, 1.4)));
  const versePx = Math.max(13, Math.round(15 * Math.min(L.ui, 1.4)));
  const fixed = pad + title.lines.length * tl + 10 + body.lines.length * bl + 12 + footPx * 2 + pad;
  const verseH = Math.max(40, Math.min(box.h - fixed, 170 * Math.min(L.ui, 1.4)));
  const lay = passageLayout(ctx, pg.verse, cw, verseH, versePx);
  const h = Math.min(box.h, fixed + lay.height + 8);
  const x = box.x, y = box.y + (box.h - h) / 2;
  ctx.fillStyle = 'rgba(14,9,30,.93)';
  rr(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  let yy = y + pad;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `600 ${title.size}px ${SERIF}`;
  ctx.fillStyle = GOLD_HI;
  for (const ln of title.lines) { ctx.fillText(ln, x + w / 2, yy); yy += tl; }
  yy += 10;
  ctx.font = font(body.size, 500);
  ctx.fillStyle = '#ece6ff';
  for (const ln of body.lines) { ctx.fillText(ln, x + w / 2, yy); yy += bl; }
  yy += 8;
  drawPassage(ctx, passage(pg.verse), lay, x + w / 2, yy, { text: PEARL, ref: 'rgba(255,217,138,.8)' });
  ctx.font = font(footPx, 600);
  ctx.fillStyle = 'rgba(255,217,138,.85)';
  ctx.textBaseline = 'bottom';
  const more = s.t >= RULES.tapAfter ? t(touch ? 'story.tap' : 'story.click') : '';
  ctx.fillText(`${more}${more ? ' · ' : ''}${s.page + 1}/${STORY_PAGES}`, x + w / 2, y + h - pad * 0.7);
  ctx.restore();
  return { x, y, w, h };
}
