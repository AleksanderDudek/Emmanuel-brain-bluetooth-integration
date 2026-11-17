/**
 * Każdy włos's own words and controls on the canvas (the runner draws the standard HUD: the Mendi panel, the score,
 * the coach marks): the words band — the scene's name and what it teaches in a calm serif (pages of whole lines when
 * it does not fit), in rest the breath's count and the meditation's verse — the narrator's line, the four controls
 * (≡ ◀ ↻ ▶, their keys under them on a desk), the meditation picker, the story cards, the names of the parts on the
 * picture, the cycle's dial, the mosaic's legend, the counter of a square centimetre.  Every text has a floor: never
 * under 11 px; what the player reads, 13 px and more.
 */
import { clamp, ease } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { MED, MEDS, MODES, medName, modeName, partName, sceneName, sceneTeach, type Part, type MedId } from './content';
import { CYCLE, CYCLE_LEN, type Phase, type Rect } from './geo';
import { t } from './i18n';
import { type Control, type Layout, pickerLayout, storyRect } from './layout';
import { GOLD, GOLD_HI, INK, LILAC, PEARL, ROSE, TAU, fitFont, font, label, mix, rgba, rr, wrap } from './paint';
import { RULES } from './rules';
import type { WlosySim } from './sim';

// ── the words band ───────────────────────────────────────────────
const PAGE_SEC = 7;
const PAGE_FADE = 0.6;

interface Paged { key: string; size: number; lineH: number; pages: string[][] }
let teachMemo: Paged | null = null;
let verseMemo: { key: string; lay: PassageLayout; pages: string[][] } | null = null;

/** A text wrapped into a box: whole at the largest size from `px` down to `min` that fits, else pages of whole lines at `min`. */
function paged(ctx: CanvasRenderingContext2D, text: string, w: number, h: number, px: number, min: number, weight: number, italic: boolean): Paged {
  const key = `${text}|${Math.round(w)}|${Math.round(h)}|${px}|${min}|${weight}|${italic}`;
  if (teachMemo?.key === key) return teachMemo;
  let size = Math.max(min, px), lines: string[] = [];
  for (; size >= min; size -= 0.5) {
    ctx.font = font(size, weight, true, italic);
    lines = wrap(ctx, text, w);
    if (lines.length * Math.round(size * 1.36) <= h) break;
  }
  size = Math.max(min, size);
  ctx.font = font(size, weight, true, italic);
  lines = wrap(ctx, text, w);
  const lineH = Math.round(size * 1.36);
  const per = Math.max(1, Math.floor(h / lineH));
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
  teachMemo = { key, size, lineH, pages };
  return teachMemo;
}

/** The band's title row: the scene's name, its meditation and its place ("Pętla naczyń · Korzeń 2/3"), shortened when narrow. */
export function titleRow(sim: WlosySim): { title: string; where: string; short: string } {
  return { title: sceneName(sim.scene), where: `${medName(sim.med)} · ${sim.idx + 1}/${sim.count}`, short: `${sim.idx + 1}/${sim.count}` };
}

let rowEase = 0;
let pageClock = 0;
let lastTeach = '';

/**
 * The words band: on a phone the narrator speaks in its top row (in place of the title, one after the other); a
 * gilded rule; then what the scene teaches (pages that turn slowly when it does not fit), or in rest the breath and
 * the meditation's verse.  On a desk the narrator has its own place above it.
 */
export function drawWords(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, dt: number, caption: { text: string; k: number }): void {
  if (!sim.started || sim.story) return;
  const r = L.words;
  const cx = r.x + r.w / 2;
  // a soft veil behind the words, never a hard box
  ctx.save();
  ctx.translate(cx, r.y + r.h / 2);
  ctx.scale(r.w / 2 + 40 * L.u, r.h / 2 + 26 * L.u);
  const vg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  vg.addColorStop(0, 'rgba(10,5,22,.55)');
  vg.addColorStop(0.7, 'rgba(10,5,22,.38)');
  vg.addColorStop(1, 'rgba(10,5,22,0)');
  ctx.fillStyle = vg;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  const inRow = !L.desk;
  const cpx = Math.max(MIN_READ, L.font.caption);
  let clines: string[] = [];
  if (inRow && caption.text) {
    ctx.font = font(cpx, 600);
    clines = wrap(ctx, caption.text, r.w);
    if (clines.length > 2) clines = clines.slice(0, 2);
  }
  const want = inRow && caption.k > 0.01 && clines.length ? 1 : 0;
  rowEase += (want - rowEase) * Math.min(1, dt * 6);
  const tpx = Math.round((L.desk ? 21 : 17) * L.u);
  const rowH0 = Math.round(Math.max(tpx * 1.35, L.font.label * 1.5));
  const capH = Math.round(cpx * 1.35) * Math.max(1, clines.length);
  const rowH = rowH0 + (Math.max(rowH0, capH) - rowH0) * ease.inOutSine(clamp(rowEase));
  const rest = sim.restBlock && sim.stage !== 'whole';
  const rowMid = r.y + rowH / 2;
  ctx.textBaseline = 'middle';
  if (rowEase < 0.5) {
    ctx.globalAlpha = 1 - rowEase * 2;
    if (rest) breathRow(ctx, L, sim, cx, rowMid);
    else titleLine(ctx, L, sim, cx, rowMid, r.w, tpx);
  }
  if (rowEase > 0.5 && clines.length) {
    ctx.globalAlpha = (rowEase * 2 - 1) * clamp(caption.k);
    ctx.font = font(cpx, 600);
    ctx.textAlign = 'center';
    const lh = Math.round(cpx * 1.35);
    let y = rowMid - ((clines.length - 1) * lh) / 2;
    for (const line of clines) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.strokeText(line, cx, y);
      ctx.fillStyle = 'rgba(244,238,255,.96)';
      ctx.fillText(line, cx, y);
      y += lh;
    }
  }
  ctx.globalAlpha = 1;
  // a short gilded rule
  const ruleY = r.y + rowH + 3;
  const rw = Math.min(r.w * 0.3, 90 * L.u);
  const rg = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
  rg.addColorStop(0, 'rgba(255,217,138,0)');
  rg.addColorStop(0.5, 'rgba(255,217,138,.7)');
  rg.addColorStop(1, 'rgba(255,217,138,0)');
  ctx.fillStyle = rg;
  ctx.fillRect(cx - rw / 2, ruleY, rw, 1);
  const box = { x: r.x, y: ruleY + 7, w: r.w, h: r.y + r.h - (ruleY + 7) };
  if (box.h < 18) return;
  pageClock += dt;
  if (rest) drawVerse(ctx, L, MED[sim.med].verse, box);
  else drawTeach(ctx, L, sim, box);
}

/** The title row: the scene's name in a serif, its meditation and place smaller beside it (or its place only, when narrow). */
function titleLine(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, cx: number, y: number, w: number, tpx: number): void {
  const row = titleRow(sim);
  const label2 = sim.blind ? t('hud.dark') : sim.stage === 'whole' ? t('hud.whole') : sim.stage === 'after' ? t('hud.after') : '';
  const spx = Math.max(MIN_READ, L.font.label);
  ctx.font = font(spx, 700);
  let side = label2 || row.where;
  let sw = ctx.measureText(side).width;
  ctx.font = font(tpx, 600, true);
  let tw = ctx.measureText(row.title).width;
  const gap = 10 * L.u;
  if (tw + gap + sw > w) {
    if (!label2) {
      side = row.short;
      ctx.font = font(spx, 700);
      sw = ctx.measureText(side).width;
    }
  }
  const size = fitFont(ctx, row.title, Math.max(60, w - gap - sw), tpx, MIN_READ, 600, true);
  ctx.font = font(size, 600, true);
  tw = ctx.measureText(row.title).width;
  const x0 = cx - (tw + gap + sw) / 2;
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(row.title, x0, y);
  ctx.fillStyle = sim.stage === 'hold' || sim.stage === 'whole' ? GOLD_HI : mix('#ffe9c8', GOLD_HI, 0.4);
  ctx.fillText(row.title, x0, y);
  ctx.font = font(spx, 700);
  ctx.fillStyle = label2 ? (sim.blind ? 'rgba(214,214,236,.85)' : GOLD) : 'rgba(214,200,255,.85)';
  ctx.fillText(side, x0 + tw + gap, y + 1);
}

/** What the scene teaches, in pages of whole lines that turn slowly when it does not fit; it glows after a tap. */
function drawTeach(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, box: Rect): void {
  const text = sceneTeach(sim.scene);
  if (text !== lastTeach) {
    lastTeach = text;
    pageClock = 0;
  }
  const P = paged(ctx, text, box.w, box.h, Math.max(L.font.teachMin, L.font.teach), L.font.teachMin, 500, false);
  const n = P.pages.length;
  const i = n > 1 ? Math.floor(pageClock / PAGE_SEC) % n : 0;
  const inPage = pageClock % PAGE_SEC;
  const fade = (n > 1 ? clamp(Math.min(inPage / PAGE_FADE, (PAGE_SEC - inPage) / PAGE_FADE)) : 1) * clamp(sim.stage === 'move' ? 0.35 + sim.moveK * 1.6 : 1);
  const lines = P.pages[i];
  const glowK = clamp(sim.reshow / RULES.reshowSec);
  ctx.font = font(P.size, 500, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let y = box.y + Math.max(0, (box.h - lines.length * P.lineH) / 2) * (L.desk ? 0 : 1) + P.lineH / 2;
  ctx.globalAlpha = fade * (sim.blind ? 0.75 : 1);
  for (const line of lines) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(10,5,22,.55)';
    ctx.strokeText(line, box.x + box.w / 2, y);
    ctx.fillStyle = mix('#f4eeff', GOLD_HI, 0.15 + 0.55 * glowK);
    ctx.fillText(line, box.x + box.w / 2, y);
    y += P.lineH;
  }
  ctx.globalAlpha = 1;
  if (n > 1) {
    // the pages as small dots under the text
    const dy = Math.min(box.y + box.h - 3, y - P.lineH / 2 + P.lineH * 0.55);
    for (let k = 0; k < n; k++) {
      ctx.beginPath();
      ctx.arc(box.x + box.w / 2 + (k - (n - 1) / 2) * 9, dy, k === i ? 2.2 : 1.5, 0, TAU);
      ctx.fillStyle = k === i ? GOLD : 'rgba(255,217,138,.4)';
      ctx.fill();
    }
  }
}

/** Rest's row: the breath's turn and count, a ring beside them that swells in and settles out. */
function breathRow(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, cx: number, y: number): void {
  const b = sim.breath;
  const left = Math.max(1, Math.ceil((b.inhale ? RULES.inhale : RULES.exhale) * (1 - b.p)));
  const word = `${t(b.inhale ? 'hud.in' : 'hud.out')} · ${left}`;
  const px = Math.max(MIN_READ, Math.round(15 * L.u));
  ctx.font = font(px, 700);
  ctx.textAlign = 'center';
  const tw = ctx.measureText(word).width;
  const rx = cx - tw / 2 - px * 0.95, rad = px * (0.3 + 0.32 * b.k);
  ctx.strokeStyle = 'rgba(214,200,255,.85)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(rx, y, rad, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = LILAC;
  ctx.fillText(word, cx, y);
}

/** Rest: the meditation's verse to rest in — whole when it fits, else in pages of whole lines (never cut). */
function drawVerse(ctx: CanvasRenderingContext2D, L: Layout, id: PassageId, box: Rect): void {
  const key = `${id}|${Math.round(box.w)}|${Math.round(box.h)}|${L.font.verse}`;
  if (verseMemo?.key !== key) {
    let lay = layoutPassage(ctx, passage(id), box.w, box.h, { max: Math.max(MIN_READ, L.font.verse), min: MIN_READ });
    const pages: string[][] = [];
    if (!lay.fits) {
      lay = layoutPassage(ctx, passage(id), box.w, 100000, { max: MIN_READ, min: MIN_READ });
      const per = Math.max(1, Math.floor((box.h - lay.refSize - Math.round(lay.size * 0.55)) / lay.lineH));
      for (let i = 0; i < lay.lines.length; i += per) pages.push(lay.lines.slice(i, i + per));
    }
    verseMemo = { key, lay, pages };
  }
  const { lay, pages } = verseMemo;
  const colors = { text: 'rgba(246,238,255,.92)', ref: 'rgba(255,226,170,.78)' };
  const cx = box.x + box.w / 2;
  if (!pages.length) {
    drawPassage(ctx, passage(id), lay, cx, box.y + (L.desk ? 0 : Math.max(0, (box.h - lay.height) / 2)), colors);
    return;
  }
  const n = Math.floor(pageClock / PAGE_SEC) % pages.length, inPage = pageClock % PAGE_SEC;
  const fade = clamp(Math.min(inPage / PAGE_FADE, (PAGE_SEC - inPage) / PAGE_FADE));
  const lines = pages[n];
  const h = lines.length * lay.lineH + Math.round(lay.size * 0.55) + lay.refSize;
  ctx.globalAlpha = fade;
  drawPassage(ctx, passage(id), { ...lay, lines, height: h }, cx, box.y + (L.desk ? 0 : Math.max(0, (box.h - h) / 2)), colors);
  ctx.globalAlpha = 1;
}

/** The narrator's caption in its own place (a desk), at most two lines. */
export function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, text: string, alpha: number): void {
  if (!L.desk || !text || alpha <= 0.01) return;
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
  let y = r.y + r.h - lines.length * lh + lh / 2 - 4;
  for (const line of lines) {
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = INK;
    ctx.strokeText(line, r.x + r.w / 2, y);
    ctx.fillStyle = 'rgba(244,238,255,.96)';
    ctx.fillText(line, r.x + r.w / 2, y);
    y += lh;
  }
  ctx.restore();
}

// ── the controls ─────────────────────────────────────────────────
const KEYS: Readonly<Record<Control, string>> = { list: 'M', prev: '←', again: 'R', next: '→' };
const NAMES: Readonly<Record<Control, string>> = { list: 'ctl.list', prev: 'ctl.prev', again: 'ctl.again', next: 'ctl.next' };

/** The four round controls (≡ ◀ ↻ ▶): glass with a rim of light; the hovered one brighter, named above it; keys under them on a desk. */
export function drawControls(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, hover: Control | null, time: number): void {
  if (!sim.started) return;
  const live = sim.canWalk && !sim.picker;
  for (const c of ['list', 'prev', 'again', 'next'] as const) {
    const r = L.ctl[c];
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    const on = hover === c && live;
    // the next one breathes when a grown scene waits (the end of "just this one")
    const invite = c === 'next' && sim.stage === 'after' ? 0.5 + 0.5 * Math.sin(time * 2.2) : 0;
    ctx.save();
    ctx.globalAlpha = live ? 1 : 0.45;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, on ? 'rgba(255,236,206,.28)' : 'rgba(255,240,230,.14)');
    g.addColorStop(1, on ? 'rgba(120,70,140,.4)' : 'rgba(40,20,60,.45)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = on || invite > 0 ? rgba(GOLD_HI, 0.6 + 0.35 * Math.max(on ? 1 : 0, invite)) : 'rgba(236,222,255,.4)';
    ctx.lineWidth = on ? 1.8 : 1.2;
    ctx.stroke();
    icon(ctx, c, cx, cy, R * 0.42, on ? GOLD_HI : PEARL);
    ctx.restore();
    if (L.desk) {
      const kpx = Math.max(12, L.font.key);
      ctx.font = font(kpx, 700);
      const kw = Math.max(kpx * 1.6, ctx.measureText(KEYS[c]).width + kpx);
      const ky = r.y + r.h + 6, kh = Math.round(kpx * 1.45);
      rr(ctx, cx - kw / 2, ky, kw, kh, 4);
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(236,222,255,.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(236,226,255,.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(KEYS[c], cx, ky + kh / 2 + 0.5);
    }
    if (on) label(ctx, t(NAMES[c] as 'ctl.prev'), cx, r.y - Math.max(13, L.font.small) * 0.9, Math.max(MIN_READ, L.font.small), GOLD_HI, 'center', 700);
  }
}

/** A control's icon, drawn (never a font's glyph): ≡ a list, ◀ back, ↻ again, ▶ on. */
function icon(ctx: CanvasRenderingContext2D, c: Control, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.6, s * 0.2);
  if (c === 'prev' || c === 'next') {
    const d = c === 'next' ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x - d * s * 0.55, y - s * 0.8);
    ctx.lineTo(x + d * s * 0.75, y);
    ctx.lineTo(x - d * s * 0.55, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (c === 'again') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.78, -Math.PI * 0.35, Math.PI * 1.45);
    ctx.stroke();
    const a = -Math.PI * 0.35, ex = x + Math.cos(a) * s * 0.78, ey = y + Math.sin(a) * s * 0.78;
    ctx.beginPath();
    ctx.moveTo(ex - s * 0.42, ey - s * 0.22);
    ctx.lineTo(ex + s * 0.05, ey + s * 0.02);
    ctx.lineTo(ex - s * 0.08, ey + s * 0.46);
    ctx.stroke();
  } else {
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.arc(x - s * 0.62, y + k * s * 0.55, s * 0.11, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.28, y + k * s * 0.55);
      ctx.lineTo(x + s * 0.72, y + k * s * 0.55);
      ctx.stroke();
    }
  }
}

/**
 * A label fitted to a width: one line from `px` down to `min`; if it still does not fit, wrapped into at most
 * `maxLines` lines at `min` (a word never cut); only past that is the last line shortened with "…".
 */
export function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min: number, weight: number, maxLines = 2, serif = false): { lines: string[]; size: number } {
  const size = fitFont(ctx, text, maxW, px, min, weight, serif);
  ctx.font = font(size, weight, serif);
  if (ctx.measureText(text).width <= maxW) return { lines: [text], size };
  let lines = wrap(ctx, text, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1).trimEnd();
    lines[maxLines - 1] = `${last}…`;
  }
  return { lines, size };
}

// ── the picker ───────────────────────────────────────────────────
/**
 * The meditation picker: a card over the dimmed picture — its title and a close button, the three modes as a row of
 * segments (the current one gold), the eight meditations as tiles (the current one ringed; a check once completed;
 * how many of its scenes have grown), numbered 1–8 on a desk.  Returns the card's rectangle.
 */
export function drawPicker(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, hover: string | null, grownEver: (m: MedId) => number, wholeEver: (m: MedId) => number): Rect {
  const P = pickerLayout(L);
  const u = L.desk ? L.u : Math.min(L.u, 1.3);
  ctx.save();
  ctx.fillStyle = 'rgba(6,3,14,.6)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, P.card.x, P.card.y, P.card.w, P.card.h, 18);
  const g = ctx.createLinearGradient(0, P.card.y, 0, P.card.y + P.card.h);
  g.addColorStop(0, 'rgba(46,26,72,.97)');
  g.addColorStop(1, 'rgba(20,10,36,.97)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,217,138,.7)';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  // the title and the close button
  const tpx = Math.round(18 * u);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const titleW = P.close.x - (P.card.x + 14 * u) - 8;
  const size = fitFont(ctx, t('pick.title'), titleW, tpx, MIN_READ, 600, true);
  ctx.font = font(size, 600, true);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(t('pick.title'), P.card.x + 14 * u, P.titleY);
  const cl = P.close, ccx = cl.x + cl.w / 2, ccy = cl.y + cl.h / 2, cs = cl.w * 0.18;
  ctx.strokeStyle = hover === 'close' ? GOLD_HI : 'rgba(236,222,255,.75)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ccx - cs, ccy - cs);
  ctx.lineTo(ccx + cs, ccy + cs);
  ctx.moveTo(ccx + cs, ccy - cs);
  ctx.lineTo(ccx - cs, ccy + cs);
  ctx.stroke();
  // the modes
  MODES.forEach((m, i) => {
    const r = P.modes[i];
    const on = sim.mode === m;
    const hv = hover === `mode:${m}`;
    rr(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fillStyle = on ? 'rgba(255,217,138,.2)' : hv ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.strokeStyle = on ? GOLD : hv ? 'rgba(255,236,206,.7)' : 'rgba(236,222,255,.3)';
    ctx.lineWidth = on ? 1.6 : 1;
    ctx.stroke();
    const fit = fitLines(ctx, modeName(m), r.w - 14, Math.round(14 * u), MIN_READ, 700);
    ctx.font = font(fit.size, 700);
    ctx.textAlign = 'center';
    ctx.fillStyle = on ? GOLD_HI : 'rgba(236,226,255,.9)';
    const mlh = Math.round(fit.size * 1.15);
    fit.lines.forEach((line, k) => ctx.fillText(line, r.x + r.w / 2, r.y + r.h / 2 + 0.5 + (k - (fit.lines.length - 1) / 2) * mlh));
  });
  // the eight meditations
  MEDS.forEach((m, i) => {
    const r = P.items[i];
    const cur = sim.med === m;
    const hv = hover === `med:${m}`;
    rr(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = cur ? 'rgba(255,217,138,.14)' : hv ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.045)';
    ctx.fill();
    ctx.strokeStyle = cur ? GOLD : hv ? 'rgba(255,236,206,.7)' : 'rgba(236,222,255,.22)';
    ctx.lineWidth = cur ? 1.6 : 1;
    ctx.stroke();
    const pad = 10 * u;
    const name = medName(m);
    const done = wholeEver(m) > 0;
    const of = MED[m].scenes.length, gn = grownEver(m);
    const sub = `${t('pick.done', { done: gn, of })}${done ? ' ✓' : ''}`;
    const num = L.desk ? `${i + 1}  ` : '';
    const two = r.h >= 50 * Math.min(u, 1.2);
    const spx = Math.max(MIN_READ, Math.round(12.5 * u));
    ctx.font = font(spx, 600);
    const subW = ctx.measureText(sub).width;
    ctx.textAlign = 'left';
    // the name: one line when it fits (the count under it), else two lines with the count beside the second
    let fit = fitLines(ctx, `${num}${name}`, r.w - 2 * pad - (two ? 0 : subW + 10), Math.round(14 * u), MIN_READ, 700, 1);
    let wrapped = false;
    if (two && fit.lines[0].endsWith('…')) {
      fit = fitLines(ctx, `${num}${name}`, r.w - 2 * pad - subW - 8, Math.round(14 * u), MIN_READ, 700, 2);
      wrapped = fit.lines.length > 1;
    }
    ctx.font = font(fit.size, 700);
    ctx.fillStyle = cur ? GOLD_HI : 'rgba(244,238,255,.95)';
    const nlh = Math.round(fit.size * 1.18);
    if (wrapped) fit.lines.forEach((line, k) => ctx.fillText(line, r.x + pad, r.y + r.h / 2 + (k - 0.5) * nlh));
    else ctx.fillText(fit.lines[0], r.x + pad, two ? r.y + r.h * 0.36 : r.y + r.h / 2);
    ctx.font = font(spx, 600);
    ctx.fillStyle = done ? GOLD : 'rgba(214,200,255,.8)';
    if (two && !wrapped) ctx.fillText(sub, r.x + pad, r.y + r.h * 0.7);
    else {
      ctx.textAlign = 'right';
      ctx.fillText(sub, r.x + r.w - pad, wrapped ? r.y + r.h / 2 + 0.5 * nlh : r.y + r.h / 2);
    }
  });
  ctx.restore();
  return P.card;
}

// ── the story cards ──────────────────────────────────────────────
interface Page { title: string; text: string; sub: string; verse: PassageId | null }

function pageOf(sim: WlosySim): Page | null {
  const s = sim.story;
  if (!s) return null;
  if (s.kind === 'open') {
    return s.page === 0
      ? { title: t('story.open.title'), text: t('story.open.text'), sub: '', verse: 'luk12.7' }
      : { title: t('story.open2.title'), text: t('story.open2.text'), sub: '', verse: null };
  }
  const m = s.med;
  const nextMed = MEDS[(MEDS.indexOf(m) + 1) % MEDS.length];
  const sub = sim.mode === 'order' ? t('story.next.order', { med: medName(nextMed) }) : sim.mode === 'repeat' ? t('story.next.repeat', { med: medName(m) }) : t('story.next.one');
  return { title: t('story.whole.title', { med: medName(m) }), text: t('story.whole.text'), sub, verse: MED[m].verse };
}

let storyMemo: { key: string; lay: PassageLayout | null; lines: string[]; subLines: string[]; titleLines: string[]; titlePx: number; textPx: number; h: number } | null = null;

/** The story card: a glass card with its title, a sentence or two, its verse, and how to go on.  Returns its rectangle. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: WlosySim, hover = false): Rect | null {
  const s = sim.story, pg = pageOf(sim);
  if (!s || !pg) return null;
  const u = L.u, inner = Math.min(L.story.w, 540 * u) - 2 * 18;
  const tapPx = L.desk ? Math.round(13 * u) : 13;
  const key = `${s.kind}${s.page}${pg.sub}|${Math.round(inner)}|${Math.round(L.story.h)}`;
  if (storyMemo?.key !== key) {
    const tfit = fitLines(ctx, pg.title, inner, 25 * u, 17, 600, 2, true);
    const titlePx = tfit.size;
    const textPx = Math.max(MIN_READ + 1, Math.round(15 * u));
    ctx.font = font(textPx, 500);
    const lines = wrap(ctx, pg.text, inner);
    ctx.font = font(Math.max(MIN_READ, Math.round(13.5 * u)), 700);
    const subLines = pg.sub ? wrap(ctx, pg.sub, inner) : [];
    const fixed = 18 + tfit.lines.length * titlePx * 1.3 + 10 + lines.length * Math.round(textPx * 1.4) + subLines.length * Math.round(14 * u * 1.4) + 14 + tapPx * 1.5 + 16 + (s.pages > 1 ? 14 : 0);
    let lay: PassageLayout | null = null;
    if (pg.verse) {
      const room = Math.max(60, L.story.h - fixed - 12);
      lay = layoutPassage(ctx, passage(pg.verse), inner, room, { max: Math.max(MIN_READ, Math.round(16 * u)), min: MIN_READ });
    }
    storyMemo = { key, lay, lines, subLines, titleLines: tfit.lines, titlePx, textPx, h: fixed + (lay ? 12 + lay.height : 0) };
  }
  const m = storyMemo;
  const r = storyRect(L, m.h);
  const k = ease.outCubic(clamp(s.t / 0.35));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(6,3,14,.52)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(48,26,72,.97)');
  g.addColorStop(1, 'rgba(20,10,36,.97)');
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
  for (const line of m.titleLines) {
    ctx.fillText(line, cx, y);
    y += m.titlePx * 1.3;
  }
  y += 10;
  ctx.fillStyle = PEARL;
  ctx.font = font(m.textPx, 500);
  for (const line of m.lines) {
    ctx.fillText(line, cx, y);
    y += Math.round(m.textPx * 1.4);
  }
  if (m.lay && pg.verse) {
    y += 12;
    drawPassage(ctx, passage(pg.verse), m.lay, cx, y, { text: '#f6e9cf', ref: 'rgba(255,226,170,.78)' });
    y += m.lay.height;
  }
  if (m.subLines.length) {
    y += 10;
    ctx.font = font(Math.max(MIN_READ, Math.round(13.5 * u)), 700);
    ctx.fillStyle = GOLD;
    for (const line of m.subLines) {
      ctx.fillText(line, cx, y);
      y += Math.round(14 * u * 1.4);
    }
  }
  y += 14;
  if (s.pages > 1) {
    for (let i = 0; i < s.pages; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (s.pages - 1) / 2) * 12, y + 2, i === s.page ? 3 : 2, 0, TAU);
      ctx.fillStyle = i === s.page ? GOLD : 'rgba(255,217,138,.4)';
      ctx.fill();
    }
    y += 14;
  }
  ctx.fillStyle = hover ? GOLD_HI : 'rgba(226,220,255,.75)';
  ctx.font = font(tapPx, 600);
  ctx.fillText(L.touch ? t('story.tap') : t('story.tap.keys'), cx, y);
  ctx.restore();
  return r;
}

// ── on the picture ───────────────────────────────────────────────
export interface PlacedLabel { part: Part; ax: number; ay: number; side: -1 | 1; dy: number; a: number }

/**
 * The names of the parts on the picture: a dot on the part, a hairline to its name in a small italic serif; a name
 * that would leave the picture turns to the other side; one that would cover another is left out.
 */
export function drawLabels(ctx: CanvasRenderingContext2D, L: Layout, list: readonly PlacedLabel[], box: Rect): void {
  const px = Math.max(MIN_READ, L.font.part);
  const lh = Math.round(px * 1.5);
  const taken: Rect[] = [];
  ctx.font = font(px, 500, true, true);
  ctx.textBaseline = 'middle';
  for (const lb of list) {
    if (lb.a <= 0.01) continue;
    const text = partName(lb.part);
    const tw = ctx.measureText(text).width;
    const off = Math.round(16 + 10 * L.u);
    let side = lb.side;
    const place = (s: -1 | 1) => {
      const x = lb.ax + s * off;
      const y = lb.ay + lb.dy * lh;
      return { x: s > 0 ? x : x - tw, y: y - lh / 2, w: tw, h: lh, tx: x, ty: y };
    };
    let p = place(side);
    const inside = (q: { x: number; y: number; w: number; h: number }) => q.x >= box.x + 4 && q.x + q.w <= box.x + box.w - 4 && q.y >= box.y + 2 && q.y + q.h <= box.y + box.h - 2;
    if (!inside(p)) {
      side = (-side) as -1 | 1;
      p = place(side);
    }
    if (!inside(p)) {
      // clamp it inside rather than lose it
      p.x = clamp(p.x, box.x + 4, box.x + box.w - 4 - tw);
      p.y = clamp(p.y, box.y + 2, box.y + box.h - 2 - lh);
      p.tx = side > 0 ? p.x : p.x + tw;
      p.ty = p.y + lh / 2;
    }
    if (taken.some(r => r.x < p.x + p.w + 4 && p.x < r.x + r.w + 4 && r.y < p.y + p.h && p.y < r.y + r.h)) continue;
    taken.push(p);
    ctx.save();
    ctx.globalAlpha = lb.a;
    ctx.strokeStyle = 'rgba(255,246,236,.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(lb.ax, lb.ay);
    const ex = side > 0 ? p.x - 4 : p.x + p.w + 4;
    ctx.lineTo(lb.ax + (ex - lb.ax) * 0.55, p.ty);
    ctx.lineTo(ex, p.ty);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lb.ax, lb.ay, 2.2, 0, TAU);
    ctx.fillStyle = GOLD_HI;
    ctx.fill();
    ctx.textAlign = side > 0 ? 'left' : 'right';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = INK;
    ctx.strokeText(text, p.tx, p.ty);
    ctx.fillStyle = 'rgba(255,246,236,.97)';
    ctx.fillText(text, p.tx, p.ty);
    ctx.restore();
  }
}

/**
 * The cycle's dial (the cycle scenes): a ring whose arcs are the phases' real shares of one cycle (36 months of
 * growth, 3 weeks of transition, 3 months of rest), a marker where this follicle is, and the phase's name.
 */
export function drawDial(ctx: CanvasRenderingContext2D, L: Layout, box: Rect, at: number, phase: Phase): void {
  const R = Math.round(Math.max(16, Math.min(30 * L.u, box.w * 0.08)));
  const cx = box.x + R + 18, cy = box.y + R + 16;
  const arcs: [number, number, string][] = [];
  let a0 = -Math.PI / 2;
  for (const [len, hue] of [[CYCLE.anagen, GOLD], [CYCLE.catagen, ROSE], [CYCLE.telogen, LILAC]] as const) {
    const a1 = a0 + (len / CYCLE_LEN) * TAU;
    arcs.push([a0, a1, hue]);
    a0 = a1;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R + 6, 0, TAU);
  ctx.fillStyle = 'rgba(10,5,22,.55)';
  ctx.fill();
  ctx.lineCap = 'butt';
  for (const [s, e, hue] of arcs) {
    ctx.strokeStyle = rgba(hue, 0.9);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, s + 0.03, Math.max(s + 0.06, e - 0.03));
    ctx.stroke();
  }
  const a = -Math.PI / 2 + clamp(at) * TAU;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 4, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  const name = partName(phase as Part);
  const px = Math.max(MIN_READ, Math.round(12.5 * L.u));
  ctx.font = font(px, 600);
  const tw = ctx.measureText(name).width;
  label(ctx, name, Math.max(cx, box.x + 10 + tw / 2), cy + R + 6 + px * 0.8, px, phase === 'anagen' ? GOLD_HI : phase === 'catagen' ? ROSE : LILAC, 'center', 600);
}

/** The mosaic's legend: the three phases, each with its colour and how many follicles are in it now. */
export function drawLegend(ctx: CanvasRenderingContext2D, L: Layout, box: Rect, counts: Record<Phase, number>): void {
  const px = Math.max(MIN_READ, Math.round(12.5 * L.u));
  const lh = Math.round(px * 1.55);
  let y = box.y + 12 + lh / 2;
  for (const [ph, hue] of [['anagen', GOLD], ['catagen', ROSE], ['telogen', LILAC]] as const) {
    ctx.beginPath();
    ctx.arc(box.x + 16, y, 4, 0, TAU);
    ctx.fillStyle = hue;
    ctx.fill();
    label(ctx, `${counts[ph]} · ${partName(ph as Part)}`, box.x + 26, y, px, 'rgba(255,246,236,.95)', 'left', 600);
    y += lh;
  }
}

/** A counter in a corner of the picture ("172 włosy · 1 cm²"). */
export function drawCounter(ctx: CanvasRenderingContext2D, L: Layout, box: Rect, text: string): void {
  const px = Math.max(MIN_READ, Math.round(13 * L.u));
  label(ctx, text, box.x + 14, box.y + box.h - 14 - px / 2, px, GOLD_HI, 'left', 700);
}
