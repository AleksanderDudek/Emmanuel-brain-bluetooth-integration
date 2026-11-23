/**
 * Brzemiona's words and controls on the canvas (screen space, never under the kit's 11 px; what is read at least 13):
 *
 *   the band       what to do now (one short line), whom (the circle's label, "krąg 2/3", or what comes next in a
 *                  rest), the prayer — the address at a call, the words on the breath in the exchange ("Panie Jezu, weź
 *                  ten ciężar." / "Ześlij swój pokój i miłosierdzie."), in rest a thanks and then the verse in pages —
 *                  and the breath's guide (a ring that swells in and settles out, the phase, its seconds, what flows);
 *                  in a rest the kit's big breath guide on top of the band in place of the now-line (round 15,
 *                  kit/breathguide.ts: the lungs' disc, the phase ≥ 20 px with its seconds, "oddech 2 z 3")
 *   the narrator   one line at a time over the picture's sky (atop the column on a wide screen)
 *   the controls   ≡ whom, ◎ widen, ▶ next — round, drawn icons; on a desk their keys under them and a name on hover
 *   the chooser    a card: whom to pray for, six a page
 *   the story      the first session's two pages
 */
import { breathGuideBox, breathGuideRadius, drawBreathGuide, type BreathGuideOpts } from '../kit/breathguide';
import { clamp, ease } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { allCirclesOf, itemKey } from './content';
import { addressOf, circleLabel, kindName, phaseWord, prayerOf, t, whoName, type Key } from './i18n';
import { CONTROLS, chooserLayout, storyRect, type Control, type Layout, type Rect } from './layout';
import { GOLD, GOLD_HI, LILAC, PEARL, TAU, fitLines, font, rgba, rr, wrap } from './paint';
import { readTime } from './rules';
import { BrzSim, pageOf, type NowWhat } from './sim';

const KEYS: Record<Control, string> = { list: 'M', widen: 'W', next: 'N' };
const NAMES: Record<Control, Key> = { list: 'ctl.list', widen: 'ctl.widen', next: 'ctl.next' };

/** What the band's prayer row says now, and whether it is a verse (then in pages). */
export function prayerNow(sim: BrzSim): { text: string; verse: PassageId | null } {
  if (sim.phase !== 'play' || sim.stage === 'end') return sim.stageT < 7 ? { text: t('end.line'), verse: null } : { text: '', verse: sim.verse };
  const b = sim.block;
  if (b.kind === 'warmup') return { text: sim.stage === 'call' && sim.stageT > 6 ? addressOf(sim.item, sim.circle, false) : t('warm.line'), verse: null };
  if (b.kind === 'rest') {
    const first = Math.max(5, sim.pattern.in + sim.pattern.holdIn + sim.pattern.out + sim.pattern.holdOut);
    if (b.why !== 'valve' && sim.blockT < first) return { text: t(b.leave ? 'leave.line' : 'peace.line'), verse: null };
    return { text: '', verse: sim.verse };
  }
  if (sim.stage === 'call') return { text: addressOf(sim.item, sim.circle, false), verse: null };
  if (sim.stage === 'widen') return { text: addressOf(sim.item, sim.circle, true), verse: null };
  // the exchange: the address stays through the lead-in, then the words follow the breath
  if (sim.blockT < sim.leadIn && sim.stageT < sim.leadIn) return { text: addressOf(sim.item, sim.circle, false), verse: null };
  return { text: prayerOf(sim.breath.phase, sim.circle, sim.lightOnly), verse: null };
}

/** The band's second row: whom now and the circle (n of the burden's), or what comes next during a rest. */
export function whoRow(sim: BrzSim): string {
  const q = sim.queued;
  if (sim.restBlock && q) return q.kind === 'item' ? t('hud.then', { who: whoName(sim.queue[q.index]) }) : t('hud.thenWide');
  const label = circleLabel(sim.item, sim.circle);
  const list = sim.circles.includes(sim.circle) ? sim.circles : allCirclesOf(sim.item);
  const n = list.indexOf(sim.circle) + 1, of = list.length;
  return of > 1 ? `${label} · ${t('hud.sub', { n, of })}` : label;
}

interface Memo { key: string; lines: string[]; size: number }
let prayerMemo: Memo | null = null;
let verseMemo: { key: string; lay: PassageLayout; pages: string[][] } | null = null;

/** The words band. */
export function drawBand(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, glowK: number, still = false, time = 0): void {
  const B = L.words;
  if (!sim.started) return;
  ctx.save();
  rr(ctx, B.x, B.y, B.w, B.h, 14);
  ctx.fillStyle = 'rgba(16,11,28,.72)';
  ctx.fill();
  ctx.strokeStyle = sim.loading ? rgba(GOLD, 0.45) : 'rgba(220,206,240,.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const pad = Math.round(8 * Math.min(L.u, 1.6));
  const cx = B.x + B.w / 2, inner = B.w - 2 * pad;
  let y = B.y + pad;
  if (sim.restBlock && sim.phase === 'play') {
    restBand(ctx, L, sim, glowK, still, time, pad);
    ctx.restore();
    return;
  }
  // 1 · what to do now
  const nowPx = L.font.now, nowH = Math.round(nowPx * 1.45);
  drawNow(ctx, L, sim, cx, y + nowH / 2, inner);
  y += nowH;
  // 2 · whom (in a rest only what comes next, if a control chose it: the verse needs the room)
  if (!sim.restBlock || sim.queued || !L.desk && B.h > 150 || L.desk) {
    const whoPx = L.font.who, whoH = Math.round(whoPx * 1.4);
    const who = fitLines(ctx, whoRow(sim), inner, whoPx, 13, 1, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(sim.restBlock && sim.queued ? GOLD_HI : PEARL, 0.82);
    ctx.fillText(who.lines[0] ?? '', cx, y + whoH / 2);
    y += whoH + 2;
  }
  // 4 · the breath's row at the bottom; 3 · the prayer in what is left between
  const brH = Math.round(Math.max(20, L.font.small * 1.7));
  const prayBox: Rect = { x: B.x + pad, y, w: inner, h: B.y + B.h - pad - brH - y };
  const pr = prayerNow(sim);
  if (pr.verse) drawVerse(ctx, L, pr.verse, prayBox, sim);
  else drawPrayer(ctx, L, pr.text, prayBox, sim.reshow > 0 ? 1 : glowK);
  drawBreath(ctx, L, sim, cx, B.y + B.h - pad - brH / 2, inner);
  ctx.restore();
}

/**
 * A rest's band: the breath guide on top (it is what to do now), whom when there is room (or what comes next, chosen
 * by a control), and the thanks and the verse in what is left.
 */
function restBand(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, glowK: number, still: boolean, time: number, pad: number): void {
  const B = L.words;
  const cx = B.x + B.w / 2, inner = B.w - 2 * pad;
  let y = B.y + pad;
  // the guide: the kit's radius for the screen, under about 42 % of the band's height, ≥ 26 px
  const pp = (r: number) => Math.max(10, Math.round(r * 0.3));
  let r = Math.min(breathGuideRadius(L.w, L.h), Math.round(inner * 0.16));
  while (r > 26 && 2 * r + 1.4 * pp(r) > B.h * 0.42) r--;
  r = Math.max(26, r);
  const b = sim.breath;
  const o: BreathGuideOpts = {
    cx, cy: 0, r, layout: 'row',
    words: { in: phaseWord('in'), holdIn: phaseWord('holdIn'), out: phaseWord('out'), holdOut: phaseWord('holdOut') },
    sub: t('hud.breathOf', { n: b.cycle, of: b.cycles }), maxW: Math.max(80, inner - (2 * r + 2.9 * pp(r))),
    reducedMotion: still, time, scrim: 0.45,
  };
  const gh = breathGuideBox(ctx, o).h;
  drawBreathGuide(ctx, b, { ...o, cy: y + gh / 2 });
  y += gh + 4;
  // whom (or what comes next) where the band has room for it and the words
  if (sim.queued || B.y + B.h - pad - y > 120) {
    const whoPx = L.font.who, whoH = Math.round(whoPx * 1.4);
    const who = fitLines(ctx, whoRow(sim), inner, whoPx, 13, 1, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = rgba(sim.queued ? GOLD_HI : PEARL, 0.82);
    ctx.fillText(who.lines[0] ?? '', cx, y + whoH / 2);
    y += whoH + 2;
  }
  const prayBox: Rect = { x: B.x + pad, y, w: inner, h: B.y + B.h - pad - y };
  const pr = prayerNow(sim);
  if (pr.verse) drawVerse(ctx, L, pr.verse, prayBox, sim);
  else drawPrayer(ctx, L, pr.text, prayBox, sim.reshow > 0 ? 1 : glowK);
}

function drawNow(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, cx: number, y: number, w: number): void {
  const what: NowWhat = sim.now;
  const px = L.font.now;
  const text = t(`now.${what}${sim.lightOnly && (what === 'focus' || what === 'valve') ? 'Light' : ''}` as Key);
  const icon = px * 0.9;
  const fit = fitLines(ctx, text, w - icon - 6, px, 13, 1, 700);
  const tw = ctx.measureText(fit.lines[0] ?? '').width;
  const x0 = cx - (tw + icon + 6) / 2;
  const gold = sim.loading;
  // the icon: a small cross of light while the exchange asks for focus, a breath ring in rest, a dot elsewhere
  ctx.save();
  ctx.strokeStyle = gold ? GOLD_HI : what === 'rest' || what === 'leave' || what === 'valve' ? LILAC : rgba(PEARL, 0.8);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1.5, px * 0.13);
  ctx.lineCap = 'round';
  const ix = x0 + icon / 2;
  if (what === 'focus' || what === 'call') {
    ctx.beginPath();
    ctx.moveTo(ix, y - icon * 0.45);
    ctx.lineTo(ix, y + icon * 0.45);
    ctx.moveTo(ix - icon * 0.3, y - icon * 0.18);
    ctx.lineTo(ix + icon * 0.3, y - icon * 0.18);
    ctx.stroke();
  } else if (what === 'rest' || what === 'leave' || what === 'valve') {
    ctx.beginPath();
    ctx.arc(ix, y, icon * 0.36, 0, TAU);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(ix, y, icon * 0.18, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = gold ? GOLD_HI : rgba(LILAC, 0.95);
  ctx.font = font(fit.size, 700);
  ctx.fillText(fit.lines[0] ?? '', x0 + icon + 6, y);
}

/** The prayer: a serif line or two (three on a desk), centred, golden while it glows (a tap, the turning). */
function drawPrayer(ctx: CanvasRenderingContext2D, L: Layout, text: string, box: Rect, glowK: number): void {
  if (!text || box.h < 14) return;
  const maxLines = Math.max(1, Math.min(L.desk ? 4 : 3, Math.floor(box.h / (L.font.prayerMin * 1.28))));
  const key = `${text}|${Math.round(box.w)}|${Math.round(box.h)}|${L.font.prayer}`;
  if (prayerMemo?.key !== key) {
    const f = fitLines(ctx, text, box.w, L.font.prayer, L.font.prayerMin, maxLines, 500, true);
    prayerMemo = { key, lines: f.lines, size: f.size };
  }
  const m = prayerMemo;
  const lh = Math.round(m.size * 1.28);
  const total = m.lines.length * lh;
  let y = box.y + (box.h - total) / 2 + lh / 2;
  ctx.font = font(m.size, 500, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = glowK > 0.5 ? GOLD_HI : PEARL;
  for (const line of m.lines) {
    ctx.fillText(line, box.x + box.w / 2, y);
    y += lh;
  }
}

/** A verse to abide in: in pages of whole lines that turn slowly when it does not fit; never cut. */
function drawVerse(ctx: CanvasRenderingContext2D, L: Layout, id: PassageId, box: Rect, sim: BrzSim): void {
  if (box.h < 14) return;
  const p = passage(id);
  const key = `${id}|${Math.round(box.w)}|${Math.round(box.h)}|${L.font.verse}`;
  if (verseMemo?.key !== key) {
    const lay = layoutPassage(ctx, p, box.w, box.h, { max: L.font.verse, min: MIN_READ });
    let pages: string[][] = [lay.lines];
    if (!lay.fits) {
      // the smallest readable size still overflows: whole lines in pages
      ctx.font = `italic 400 ${MIN_READ}px "Fraunces Variable", Fraunces, Georgia, serif`;
      const lines = wrap(ctx, p.text, box.w);
      const lineH = Math.round(MIN_READ * 1.32);
      const per = Math.max(1, Math.floor((box.h - Math.max(11, Math.round(MIN_READ * 0.62)) - 7) / lineH));
      pages = [];
      for (let i = 0; i < lines.length; i += per) pages.push(lines.slice(i, i + per));
      lay.size = MIN_READ;
      lay.lineH = lineH;
      lay.refSize = Math.max(11, Math.round(MIN_READ * 0.62));
    }
    verseMemo = { key, lay, pages };
  }
  const m = verseMemo;
  let page = 0;
  if (m.pages.length > 1) {
    const times = m.pages.map(pg => readTime(pg.join(' ')));
    const all = times.reduce((a, b) => a + b, 0);
    let tt = sim.blockT % all;
    while (page < times.length - 1 && tt >= times[page]) tt -= times[page++];
  }
  const lines = m.pages[page];
  const lay: PassageLayout = { ...m.lay, lines, height: lines.length * m.lay.lineH + Math.round(m.lay.size * 0.55) + m.lay.refSize };
  drawPassage(ctx, p, lay, box.x + box.w / 2, box.y + Math.max(0, (box.h - lay.height) / 2), { text: '#f6e9cf', ref: 'rgba(255,226,170,.8)' });
}

/** The breath's guide: a ring that swells in and settles out, the phase's word and seconds, what flows (or the count). */
function drawBreath(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, cx: number, y: number, w: number): void {
  const b = sim.breath;
  const px = Math.max(13, L.font.small + 1);
  const r = Math.round(px * 0.62);
  const word = phaseWord(b.phase);
  const secs = `${Math.max(1, Math.ceil(b.left - 1e-6))}`;
  let cue = '';
  if (sim.restBlock) cue = t('hud.breathOf', { n: b.cycle, of: b.cycles });
  else if (sim.pushBlock || sim.warmBlock) {
    if (sim.lightOnly) cue = b.phase === 'in' ? t('hud.cueLight.in') : b.phase === 'out' ? t('hud.cue.out') : t('hud.cue.hold');
    else cue = b.phase === 'in' ? t('hud.cue.in') : b.phase === 'out' ? t('hud.cue.out') : t('hud.cue.hold');
  }
  if (sim.phase !== 'play') cue = '';
  const head = `${word} ${secs}`;
  ctx.font = font(px, 700);
  const hw = ctx.measureText(head).width;
  const restW = w - (r * 2 + 8) - hw - 10;
  const cueFit = cue ? fitLines(ctx, `· ${cue}`, Math.max(20, restW), px, 13, 1, 500) : { lines: [''], size: px };
  ctx.font = font(cueFit.size, 500);
  const cw = cue ? ctx.measureText(cueFit.lines[0]).width : 0;
  const total = r * 2 + 8 + hw + (cue ? 8 + cw : 0);
  let x = cx - total / 2;
  // the ring: its fill follows the lungs
  ctx.beginPath();
  ctx.arc(x + r, y, r, 0, TAU);
  ctx.strokeStyle = rgba(LILAC, 0.7);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + r, y, Math.max(1.5, r * (0.25 + 0.75 * b.k)), 0, TAU);
  ctx.fillStyle = sim.loading ? rgba(GOLD, 0.85) : rgba(LILAC, 0.55);
  ctx.fill();
  x += r * 2 + 8;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(px, 700);
  ctx.fillStyle = PEARL;
  ctx.fillText(head, x, y);
  x += hw + 8;
  if (cue) {
    ctx.font = font(cueFit.size, 500);
    ctx.fillStyle = rgba(PEARL, 0.72);
    ctx.fillText(cueFit.lines[0], x, y);
  }
}

/** The narrator's line over the sky (fading in and out), one or two lines on a soft dark pill. */
export function drawCaption(ctx: CanvasRenderingContext2D, L: Layout, text: string, alpha: number): void {
  if (!text || alpha <= 0.01) return;
  const C = L.caption;
  const f = fitLines(ctx, text, C.w - 20, L.font.caption, 13, 2, 600);
  const lh = Math.round(f.size * 1.32);
  const h = f.lines.length * lh + 10;
  ctx.font = font(f.size, 600);
  const w = Math.min(C.w, Math.max(...f.lines.map(l => ctx.measureText(l).width)) + 24);
  ctx.save();
  ctx.globalAlpha = clamp(alpha);
  rr(ctx, C.x + (C.w - w) / 2, C.y, w, h, 10);
  ctx.fillStyle = 'rgba(14,10,24,.62)';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f3ecff';
  f.lines.forEach((l, i) => ctx.fillText(l, C.x + C.w / 2, C.y + 5 + lh / 2 + i * lh));
  ctx.restore();
}

/** Whether a control does something now (◎ needs a wider circle). */
export function controlLive(sim: BrzSim, c: Control): boolean {
  if (!sim.canAct || sim.chooser) return false;
  if (c === 'widen') {
    if (sim.restBlock) return (sim.stage === 'peace' || sim.stage === 'pray') && !!sim.widerCircle;
    return !!sim.widerCircle && !sim.warmBlock && sim.stage !== 'leave' && sim.stage !== 'peace';
  }
  if (c === 'next') return sim.queue.length > 1 || sim.restBlock;
  return true;
}

export function drawControls(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, hover: Control | null): void {
  if (!sim.started) return;
  for (const c of CONTROLS) {
    const r = L.ctl[c];
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, R = r.w / 2;
    const live = controlLive(sim, c);
    const on = hover === c && live;
    const queued = c === 'widen' && sim.queued?.kind === 'widen' || c === 'next' && sim.queued?.kind === 'item';
    ctx.save();
    ctx.globalAlpha = live ? 1 : 0.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, TAU);
    const g = ctx.createRadialGradient(cx, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, on ? 'rgba(255,236,206,.3)' : 'rgba(255,240,230,.14)');
    g.addColorStop(1, on ? 'rgba(110,80,130,.5)' : 'rgba(30,20,46,.6)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = on || queued ? rgba(GOLD_HI, 0.85) : 'rgba(236,222,255,.42)';
    ctx.lineWidth = on || queued ? 1.8 : 1.2;
    ctx.stroke();
    icon(ctx, c, cx, cy, R * 0.42, on || queued ? GOLD_HI : PEARL);
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
    if (on) {
      const px = Math.max(MIN_READ, L.font.small);
      ctx.font = font(px, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(12,8,20,.75)';
      ctx.lineWidth = 3.5;
      ctx.strokeText(t(NAMES[c]), cx, r.y - px * 0.9);
      ctx.fillStyle = GOLD_HI;
      ctx.fillText(t(NAMES[c]), cx, r.y - px * 0.9);
    }
  }
}

/** A control's icon, drawn: ≡ a list (whom), ◎ circles widening, ▶ on. */
function icon(ctx: CanvasRenderingContext2D, c: Control, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.6, s * 0.2);
  if (c === 'next') {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y - s * 0.8);
    ctx.lineTo(x + s * 0.75, y);
    ctx.lineTo(x - s * 0.55, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
  } else if (c === 'widen') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.22, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.55, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha *= 0.65;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.92, 0, TAU);
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

/** The chooser card: whom to pray for (six a page), the current one in gold, the pages' arrows. */
export function drawChooser(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, hover: string | null): Rect | null {
  const ch = sim.chooser;
  if (!ch) return null;
  const start = ch.page * BrzSim.PER_PAGE;
  const items = sim.queue.slice(start, start + BrzSim.PER_PAGE);
  const C = chooserLayout(L, items.length, sim.pages);
  const u = L.desk ? L.u : Math.min(L.u, 1.3);
  ctx.save();
  ctx.fillStyle = 'rgba(6,4,14,.55)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, C.card.x, C.card.y, C.card.w, C.card.h, 16);
  const g = ctx.createLinearGradient(0, C.card.y, 0, C.card.y + C.card.h);
  g.addColorStop(0, 'rgb(40,30,58)');
  g.addColorStop(1, 'rgb(18,13,30)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD, 0.6);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const pad = Math.round(12 * u);
  const titlePx = Math.max(15, Math.round(17 * u));
  const tf = fitLines(ctx, t('chooser.title'), C.close.x - C.card.x - 2 * pad, titlePx, 14, 1, 600, true);
  ctx.font = font(tf.size, 600, true);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(tf.lines[0] ?? '', C.card.x + pad, C.titleY);
  // close
  const cr = C.close, ccx = cr.x + cr.w / 2, ccy = cr.y + cr.h / 2, s = Math.min(cr.w, cr.h) * 0.18;
  ctx.strokeStyle = hover === 'close' ? GOLD_HI : rgba(PEARL, 0.8);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ccx - s, ccy - s);
  ctx.lineTo(ccx + s, ccy + s);
  ctx.moveTo(ccx + s, ccy - s);
  ctx.lineTo(ccx - s, ccy + s);
  ctx.stroke();
  // the entries
  const namePx = Math.max(14, Math.round(14.5 * u)), subPx = Math.max(13, Math.round(12.5 * u));
  items.forEach((it, i) => {
    const r = C.items[i];
    const idx = start + i;
    const cur = idx === sim.index && itemKey(it) === sim.curKey;
    const hov = hover === `item:${i}`;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = cur ? 'rgba(255,217,138,.16)' : hov ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.05)';
    ctx.fill();
    ctx.strokeStyle = cur ? rgba(GOLD, 0.85) : hov ? rgba(GOLD_HI, 0.6) : 'rgba(236,222,255,.22)';
    ctx.lineWidth = cur ? 1.6 : 1;
    ctx.stroke();
    const num = L.desk && i < 9 ? `${i + 1}  ` : '';
    const sub = cur ? t('chooser.now') : it.who === 'world' ? '' : it.kind ? kindName(it.kind) : '';
    const twoRows = !!sub && r.h >= namePx * 1.3 + subPx * 1.25 + 6;
    const nf = fitLines(ctx, `${num}${whoName(it)}`, r.w - 16, namePx, 13, 1, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cur ? GOLD_HI : PEARL;
    ctx.font = font(nf.size, 700);
    const cy = r.y + r.h / 2;
    ctx.fillText(nf.lines[0] ?? '', r.x + r.w / 2, twoRows ? cy - subPx * 0.62 : cy);
    if (twoRows) {
      const sf = fitLines(ctx, sub, r.w - 16, subPx, 13, 1, 500);
      ctx.font = font(sf.size, 500);
      ctx.fillStyle = rgba(PEARL, 0.7);
      ctx.fillText(sf.lines[0] ?? '', r.x + r.w / 2, cy + namePx * 0.66);
    }
  });
  // the pages
  if (C.prev && C.nextPage) {
    for (const [r, d, k] of [[C.prev, -1, 'page:prev'], [C.nextPage, 1, 'page:next']] as const) {
      rr(ctx, r.x, r.y, r.w, r.h, 10);
      ctx.fillStyle = hover === k ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)';
      ctx.fill();
      const x = r.x + r.w / 2, y = r.y + r.h / 2, z = r.h * 0.16;
      ctx.beginPath();
      ctx.moveTo(x - d * z * 0.7, y - z);
      ctx.lineTo(x + d * z * 0.9, y);
      ctx.lineTo(x - d * z * 0.7, y + z);
      ctx.closePath();
      ctx.fillStyle = hover === k ? GOLD_HI : PEARL;
      ctx.fill();
    }
    ctx.font = font(Math.max(13, Math.round(13 * u)), 600);
    ctx.textAlign = 'center';
    ctx.fillStyle = rgba(PEARL, 0.75);
    ctx.fillText(t('chooser.page', { n: ch.page + 1, of: sim.pages }), C.card.x + C.card.w / 2, C.prev.y + C.prev.h / 2);
  }
  ctx.restore();
  return C.card;
}

let storyMemo: { key: string; lay: PassageLayout; lines: string[]; titlePx: number; textPx: number; h: number } | null = null;

/** The story card (the first session's two pages): its rectangle, the only target while it is up. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: BrzSim, hover = false): Rect | null {
  const s = sim.story;
  if (!s) return null;
  const pg = pageOf(s.kind, s.page);
  const u = L.u, inner = Math.min(L.story.w, 560 * u) - 2 * 18;
  const tapPx = L.desk ? Math.round(13 * u) : 13;
  const key = `${s.kind}${s.page}|${Math.round(inner)}|${Math.round(L.story.h)}`;
  if (storyMemo?.key !== key) {
    const tf = fitLines(ctx, pg.title, inner, 24 * Math.min(u, 1.6), 17, 1, 600, true);
    const textPx = Math.max(MIN_READ + 1, Math.round(14.5 * Math.min(u, 1.6)));
    ctx.font = font(textPx, 500);
    const lines = wrap(ctx, pg.text, inner);
    const fixed = 16 + tf.size * 1.3 + 8 + lines.length * Math.round(textPx * 1.38) + 10 + tapPx * 1.6 + 22;
    const room = Math.max(40, L.story.h - fixed - 10);
    const lay = layoutPassage(ctx, passage(pg.verse), inner, room, { max: Math.max(MIN_READ, Math.round(15 * Math.min(u, 1.6))), min: MIN_READ });
    storyMemo = { key, lay, lines, titlePx: tf.size, textPx, h: fixed + 10 + lay.height };
  }
  const m = storyMemo;
  const r = storyRect(L, m.h);
  const k = ease.outCubic(clamp(s.t / 0.35));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(6,4,14,.5)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(44,32,60,.97)');
  g.addColorStop(1, 'rgb(18,13,30)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = hover ? 'rgba(255,231,180,.95)' : 'rgba(255,217,138,.7)';
  ctx.lineWidth = hover ? 2 : 1.4;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  let y = r.y + 16;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(m.titlePx, 600, true);
  ctx.fillText(pg.title, cx, y);
  y += m.titlePx * 1.3 + 8;
  ctx.fillStyle = PEARL;
  ctx.font = font(m.textPx, 500);
  for (const line of m.lines) {
    ctx.fillText(line, cx, y);
    y += Math.round(m.textPx * 1.38);
  }
  y += 10;
  drawPassage(ctx, passage(pg.verse), m.lay, cx, y, { text: '#f6e9cf', ref: 'rgba(255,226,170,.78)' });
  y += m.lay.height + 12;
  if (s.pages > 1) {
    for (let i = 0; i < s.pages; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - (s.pages - 1) / 2) * 12, y, i === s.page ? 3 : 2, 0, TAU);
      ctx.fillStyle = i === s.page ? GOLD : 'rgba(255,217,138,.4)';
      ctx.fill();
    }
  }
  y += 10;
  ctx.fillStyle = hover ? GOLD_HI : 'rgba(226,220,255,.75)';
  ctx.font = font(tapPx, 600);
  ctx.fillText(L.touch ? t('story.tap') : t('story.tap.keys'), cx, y);
  ctx.restore();
  return r;
}

