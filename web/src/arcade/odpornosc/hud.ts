/**
 * Odporność's own canvas UI (the runner draws the standard HUD above it): the strip under the HUD (the six
 * stages as dots, the stage, its goal), the sing-along line, Neo's and Makro's bubble, the two round buttons
 * in the thumb zone (the respiratory burst with its charge ring, the NET with its charges) and the cards
 * (the story, a stage's card with what really happens and how long it really takes, a fact found).
 *
 * Every text goes through `font()`/`fitFont()` (never under 11 px; 13 and more for what must be read).
 */
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { STAGES, factText, factTitle, loopSpec, pathogenName, placeName, stageName, stageReal, stageText } from './content';
import { t, type Key } from './i18n';
import type { Layout } from './layout';
import { PAL, TAU, circle, fitFont, font, glow, paintPortrait, rr, wrap } from './paint';
import type { Card, OdpSim } from './sim';

const CREAM = PAL.cream;
const DARK = 'rgba(42,18,34,0.62)';

/** The stage's pill and its goal, under the runner's HUD. */
export function drawStrip(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, now: number): void {
  const r = L.strip, u = L.u;
  const h = r.h;
  // the six stages as dots
  const dot = Math.round(4 * u), gap = Math.round(5 * u);
  const dotsW = STAGES.length * (dot * 2) + (STAGES.length - 1) * gap;
  const name = stageName(sim.stage);
  const g = sim.goal();
  const goal = t(`goal.${sim.stage}` as Key, { n: g.n, all: g.all });
  ctx.save();
  // the left pill: dots and the stage's name
  const nameSize = fitFont(ctx, name, Math.min(r.w * 0.4, 180 * u), 14 * u, MIN_READ, 800);
  const nameW = ctx.measureText(name).width;
  const pillW = Math.round(10 * u) + dotsW + Math.round(8 * u) + nameW + Math.round(12 * u);
  rr(ctx, r.x, r.y, pillW, h, h / 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  let x = r.x + Math.round(10 * u) + dot;
  STAGES.forEach((s, i) => {
    const done = i < sim.stageIdx || (i === sim.stageIdx && sim.outro > 0);
    const cur = i === sim.stageIdx;
    circle(ctx, x, r.y + h / 2, dot);
    if (done) { ctx.fillStyle = PAL.gold; ctx.fill(); } else if (cur) {
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = PAL.gold;
      ctx.stroke();
      glow(ctx, x, r.y + h / 2, dot * 3, '255,209,102', 0.25 + 0.15 * Math.sin(now * 3));
    } else { ctx.fillStyle = 'rgba(255,248,239,0.25)'; ctx.fill(); }
    void s;
    x += dot * 2 + gap;
  });
  ctx.font = font(nameSize, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.fillText(name, x - gap + Math.round(4 * u), r.y + h / 2 + 0.5);
  // the goal on the right
  const room = r.w - pillW - Math.round(8 * u);
  if (room > 60) {
    const size = fitFont(ctx, goal, room - Math.round(16 * u), 13.5 * u, MIN_READ, 700);
    const gw = ctx.measureText(goal).width + Math.round(16 * u);
    rr(ctx, r.x + r.w - gw, r.y, gw, h, h / 2);
    ctx.fillStyle = DARK;
    ctx.fill();
    ctx.font = font(size, 700);
    ctx.fillStyle = sim.outro > 0 ? PAL.gold : CREAM;
    ctx.textAlign = 'center';
    ctx.fillText(goal, r.x + r.w - gw / 2, r.y + h / 2 + 0.5);
  }
  ctx.restore();
}

/**
 * Set a readable font (never under MIN_READ) that fits `maxW`, shrinking first and then cutting with "…";
 * returns the text to draw ('' when not even an ellipsis fits).
 */
export function fitLine(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number, serif = false): string {
  fitFont(ctx, text, maxW, px, MIN_READ, weight, serif);
  if (ctx.measureText(text).width <= maxW) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${text.slice(0, mid).trimEnd()}…`).width <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? `${text.slice(0, lo).trimEnd()}…` : '';
}

/** A rest's breathing guide in the song's row: a pill that swells on the in-breath and settles on the out-breath. */
export function drawBreath(ctx: CanvasRenderingContext2D, L: Layout, b: { k: number; inhale: boolean }): void {
  const r = L.song, u = L.u;
  const v = b.inhale ? 0.5 - 0.5 * Math.cos(Math.PI * b.k) : 0.5 + 0.5 * Math.cos(Math.PI * b.k);
  const word = t(b.inhale ? 'breath.in' : 'breath.out');
  ctx.save();
  const size = fitFont(ctx, word, r.w * 0.5, 14.5 * u, MIN_READ, 700);
  ctx.font = font(size, 700);
  const tw = ctx.measureText(word).width;
  const w = Math.min(r.w, tw + 48 * u + 70 * u * v), x = r.x + (r.w - w) / 2;
  rr(ctx, x, r.y, w, r.h, r.h / 2);
  ctx.fillStyle = 'rgba(28,40,60,0.5)';
  ctx.fill();
  glow(ctx, r.x + r.w / 2, r.y + r.h / 2, w * 0.55, '150,200,255', 0.1 + 0.18 * v);
  ctx.strokeStyle = 'rgba(170,215,255,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#dff0ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(word, r.x + r.w / 2, r.y + r.h / 2 + 0.5);
  // a dot that rises and falls with the breath
  circle(ctx, x + 14 * u, r.y + r.h / 2, (2.5 + 3 * v) * u);
  ctx.fillStyle = 'rgba(200,230,255,0.9)';
  ctx.fill();
  ctx.restore();
}

/** The sing-along line: the current lyric in a soft italic, a thin line under it running with the song. */
export function drawSongLine(ctx: CanvasRenderingContext2D, L: Layout, line: { text: string; p: number } | null, pulse: number, chorus: boolean): void {
  if (!line) return;
  const r = L.song, u = L.u;
  ctx.save();
  const text = fitLine(ctx, line.text, r.w - 30 * u, 14.5 * u, 500, true);
  if (!text) { ctx.restore(); return; }
  const tw = ctx.measureText(text).width;
  const w = Math.min(r.w, tw + 28 * u);
  const x = r.x + (r.w - w) / 2;
  rr(ctx, x, r.y, w, r.h, r.h / 2);
  ctx.fillStyle = 'rgba(42,18,34,0.42)';
  ctx.fill();
  if (chorus) glow(ctx, x + w / 2, r.y + r.h / 2, w * 0.45, '255,209,102', 0.08 + 0.06 * pulse);
  ctx.fillStyle = chorus ? '#ffe9b3' : CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, r.y + r.h / 2);
  ctx.strokeStyle = 'rgba(255,209,102,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 12 * u, r.y + r.h - 2);
  ctx.lineTo(x + 12 * u + (w - 24 * u) * Math.max(0, Math.min(1, line.p)), r.y + r.h - 2);
  ctx.stroke();
  ctx.restore();
}

/** Neo's (or Makro's) bubble with the portrait; it pops in and fades out.  Returns its bottom edge (px). */
export function drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, who: 'neo' | 'makro', k: number, now: number): number {
  if (!text || k <= 0) return 0;
  const u = L.u, n = L.neo;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k);
  const size = 14.5 * u;
  ctx.font = font(size, 650);
  const maxW = Math.min(n.maxW, L.strip.w - n.r * 2 - 14 * u) - 22 * u;
  let lines = wrap(ctx, text, maxW);
  let fs = size;
  while (lines.length > 3 && fs > MIN_READ) {
    fs -= 0.5;
    ctx.font = font(fs, 650);
    lines = wrap(ctx, text, maxW);
  }
  lines = lines.slice(0, 3);
  const lh = Math.round(fs * 1.28);
  const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + 22 * u;
  const bh = lines.length * lh + 14 * u;
  const bx = n.x + n.r + 10 * u, by = n.y - Math.min(n.r, bh / 2);
  const pop = k < 1 ? 0.9 + 0.1 * k : 1;
  ctx.translate(bx, by + bh / 2);
  ctx.scale(pop, pop);
  ctx.translate(-bx, -(by + bh / 2));
  rr(ctx, bx, by, bw, bh, 12 * u);
  ctx.fillStyle = who === 'neo' ? '#fbf7ff' : '#fff6e8';
  ctx.fill();
  ctx.strokeStyle = who === 'neo' ? PAL.neutEdge : PAL.macEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the tail toward the portrait
  ctx.beginPath();
  ctx.moveTo(bx + 1, n.y - 5 * u);
  ctx.lineTo(bx - 8 * u, n.y);
  ctx.lineTo(bx + 1, n.y + 5 * u);
  ctx.fillStyle = who === 'neo' ? '#fbf7ff' : '#fff6e8';
  ctx.fill();
  ctx.fillStyle = PAL.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 11 * u, by + 7 * u + i * lh));
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = Math.min(1, k);
  paintPortrait(ctx, n.x, n.y, n.r, who, now);
  ctx.restore();
  return Math.max(by + bh, n.y + n.r);
}

/** The two round buttons: the respiratory burst (its charge ring, gold when ready) and the NET (its charges). */
export function drawButtons(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, pressed: 'burst' | 'net' | null, now: number, flash: number): void {
  const u = L.u;
  if (sim.burstShown) {
    const b = L.burst, ready = sim.burstReady, down = pressed === 'burst';
    const r = b.r * (down ? 0.94 : 1);
    if (ready) glow(ctx, b.x, b.y, r * 2.2, '255,209,102', 0.45 + 0.25 * Math.sin(now * 5));
    if (sim.bursting > 0) glow(ctx, b.x, b.y, r * 2.4, '150,220,255', 0.5);
    circle(ctx, b.x, b.y, r);
    ctx.fillStyle = ready ? '#5a2a10' : 'rgba(42,18,34,0.78)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.strokeStyle = 'rgba(255,248,239,0.25)';
    circle(ctx, b.x, b.y, r - 3 * u);
    ctx.stroke();
    // the charge ring: a held focus fills it
    ctx.strokeStyle = ready ? PAL.gold : '#9fe3ff';
    ctx.lineWidth = Math.max(3, 4 * u);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(b.x, b.y, r - 3 * u, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.001, sim.bursting > 0 ? sim.bursting / 6 : sim.charge));
    ctx.stroke();
    ctx.lineCap = 'butt';
    // the icon: a starburst of oxygen sparks
    const ic = r * 0.32, cy = b.y - r * 0.16;
    ctx.strokeStyle = ready || sim.bursting > 0 ? '#fff4c8' : 'rgba(255,248,239,0.75)';
    ctx.lineWidth = Math.max(1.5, 2 * u);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + now * (ready ? 1.5 : 0.3);
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * ic * 0.35, cy + Math.sin(a) * ic * 0.35);
      ctx.lineTo(b.x + Math.cos(a) * ic * (i % 2 ? 0.8 : 1.05), cy + Math.sin(a) * ic * (i % 2 ? 0.8 : 1.05));
      ctx.stroke();
    }
    const label = t('btn.burst');
    const size = fitFont(ctx, label, r * 1.8, 13 * u, MIN_READ, 800);
    ctx.font = font(size, 800);
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y + r * 0.42);
  }
  if (sim.netShown) {
    const b = L.net, n = sim.nets, down = pressed === 'net';
    const r = b.r * (down ? 0.94 : 1);
    if (n > 0) glow(ctx, b.x, b.y, r * 1.9, '205,238,255', 0.3 + 0.15 * Math.sin(now * 3));
    circle(ctx, b.x, b.y, r);
    ctx.fillStyle = n > 0 ? 'rgba(20,52,72,0.85)' : 'rgba(42,18,34,0.6)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, 3 * u);
    ctx.strokeStyle = n > 0 ? PAL.net : 'rgba(255,248,239,0.2)';
    circle(ctx, b.x, b.y, r - 3 * u);
    ctx.stroke();
    // the icon: a little web
    const ic = r * 0.34, cy = b.y - r * 0.16;
    ctx.strokeStyle = n > 0 ? '#e6f7ff' : 'rgba(255,248,239,0.45)';
    ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.moveTo(b.x, cy);
      ctx.lineTo(b.x + Math.cos(a) * ic, cy + Math.sin(a) * ic);
    }
    ctx.stroke();
    for (const k of [0.45, 0.85]) {
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * TAU;
        if (i === 0) ctx.moveTo(b.x + Math.cos(a) * ic * k, cy + Math.sin(a) * ic * k); else ctx.lineTo(b.x + Math.cos(a) * ic * k, cy + Math.sin(a) * ic * k);
      }
      ctx.stroke();
    }
    const label = n > 1 ? `${t('btn.net')} ×${n}` : t('btn.net');
    const size = fitFont(ctx, label, r * 1.8, 13 * u, MIN_READ, 800);
    ctx.font = font(size, 800);
    ctx.fillStyle = n > 0 ? CREAM : 'rgba(255,248,239,0.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x, b.y + r * 0.42);
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,248,239,${0.25 * flash})`;
    circle(ctx, pressed === 'net' ? L.net.x : L.burst.x, pressed === 'net' ? L.net.y : L.burst.y, L.burst.r);
    ctx.fill();
  }
}

/** A card's words for the view (title, kicker, lines), in the page's language. */
export function cardWords(card: Card, sim: OdpSim): { kicker: string; title: string; text: string; real: string; extra: string[]; verse: boolean } {
  const s = card.stage;
  const spec = loopSpec(sim.p.loop);
  const extra: string[] = [];
  if (card.memory) extra.push(t('card.memory', { name: pathogenName(card.memory) }));
  if (card.fact) extra.push(`${t('card.fact')} · ${factTitle(card.fact)}: ${factText(card.fact)}`);
  switch (card.kind) {
    case 'open':
      return { kicker: placeName(spec.place), title: t('story.open.title'), text: t('story.open.text'), real: '', extra: [], verse: true };
    case 'back':
      return {
        kicker: t('story.back.title'), title: stageName(s),
        text: t('story.back.text', { loop: sim.p.loop, place: placeName(spec.place), stage: stageName(s) }), real: stageReal(s), extra, verse: false,
      };
    case 'loop':
      return {
        kicker: t('card.loopTitle', { n: sim.p.loop, place: placeName(spec.place) }), title: stageName(s),
        text: `${t(`place.${spec.place}.story` as Key)} ${stageText(s)}`, real: stageReal(s), extra, verse: false,
      };
    default:
      return { kicker: t('card.stageOf', { n: card.idx + 1 }), title: stageName(s), text: stageText(s), real: stageReal(s), extra, verse: false };
  }
}

/** The card: a bottom sheet on a phone upright, centred elsewhere; it slides in and waits for a tap (or its time). */
export function drawCard(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, card: Card, touch: boolean, now: number, cache: { key: string; verse: PassageLayout | null }): void {
  const u = L.u, R = L.card;
  const words = cardWords(card, sim);
  const inK = Math.min(1, card.t / 0.35);
  const slide = (1 - (1 - inK) ** 3) ;
  const outK = Math.max(0, Math.min(1, (card.dur - card.t) / 0.3));
  ctx.save();
  ctx.globalAlpha = Math.min(slide, outK);
  // dim the world behind
  ctx.fillStyle = 'rgba(30,10,24,0.42)';
  ctx.fillRect(0, L.top, L.w, L.h - L.top);
  const dy = L.anchor === 'bottom' ? (1 - slide) * 40 : (1 - slide) * 16;
  ctx.translate(0, dy);
  rr(ctx, R.x, R.y, R.w, R.h, 18 * u);
  const gr = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  gr.addColorStop(0, '#fff8f2');
  gr.addColorStop(1, '#fbe9e4');
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.strokeStyle = 'rgba(194,65,107,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const pad = 18 * u, x = R.x + pad, w = R.w - 2 * pad;
  let y = R.y + pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // the kicker and the title
  let size = fitFont(ctx, words.kicker, w, 13 * u, MIN_READ, 800);
  ctx.fillStyle = '#c2416b';
  ctx.fillText(words.kicker.toUpperCase() === words.kicker ? words.kicker : words.kicker, x, y);
  y += size * 1.35;
  size = fitFont(ctx, words.title, w, 24 * u, 16, 700, true);
  ctx.fillStyle = PAL.ink;
  ctx.fillText(words.title, x, y);
  y += size * 1.3;
  // the stage dots under the title
  if (card.kind !== 'open') {
    const dot = 4 * u;
    STAGES.forEach((_, i) => {
      circle(ctx, x + dot + i * (dot * 2 + 6 * u), y + dot, dot);
      ctx.fillStyle = i < card.idx ? PAL.goldDeep : i === card.idx ? '#c2416b' : 'rgba(58,29,46,0.18)';
      ctx.fill();
    });
    y += dot * 2 + 10 * u;
  }
  const bottom = R.y + R.h - pad - 18 * u;
  // the text, the real time, the extras: the largest size that fits
  const blocks: { text: string; weight: number; serif: boolean; color: string; k: number }[] = [
    { text: words.text, weight: 550, serif: false, color: PAL.ink, k: 1 },
  ];
  if (words.real) blocks.push({ text: words.real, weight: 500, serif: true, color: '#7a3a55', k: 0.93 });
  for (const e of words.extra) blocks.push({ text: e, weight: 600, serif: false, color: '#5a4a2a', k: 0.88 });
  const verseH = words.verse ? Math.min(140 * u, (bottom - y) * 0.42) : 0;
  let fs = 15.5 * u;
  let laid: { lines: string[]; size: number; b: (typeof blocks)[number] }[] = [];
  for (; fs >= MIN_READ; fs -= 0.5) {
    laid = blocks.map(b => {
      const s = Math.max(MIN_READ, fs * b.k);
      ctx.font = font(s, b.weight, b.serif);
      return { lines: wrap(ctx, b.text, w), size: s, b };
    });
    const hNeed = laid.reduce((a, l) => a + l.lines.length * l.size * 1.32 + 8 * u, 0);
    if (hNeed <= bottom - y - verseH) break;
  }
  for (const l of laid) {
    ctx.font = font(l.size, l.b.weight, l.b.serif);
    ctx.fillStyle = l.b.color;
    for (const line of l.lines) {
      if (y + l.size > bottom - verseH + 2) break;
      ctx.fillText(line, x, y);
      y += l.size * 1.32;
    }
    y += 8 * u;
  }
  if (words.verse) {
    const p = passage('psa103.2-3');
    const key = `${R.w}|${verseH}`;
    if (cache.key !== key) {
      cache.key = key;
      cache.verse = layoutPassage(ctx, p, w, Math.max(30, bottom - y), { max: 17 * u, min: MIN_READ });
    }
    if (cache.verse) drawPassage(ctx, p, cache.verse, R.x + R.w / 2, Math.max(y, bottom - cache.verse.height), { text: '#5a2a40', ref: '#a0607a' });
  }
  // the tap hint
  const hint = t(touch ? 'card.tap' : 'card.click');
  size = fitFont(ctx, hint, w, 13 * u, MIN_READ, 700);
  ctx.fillStyle = card.t >= 0.6 ? '#c2416b' : 'rgba(194,65,107,0.4)';
  ctx.textAlign = 'center';
  ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(now * 3);
  ctx.fillText(hint, R.x + R.w / 2, R.y + R.h - pad - size * 0.6);
  // a thin bar: the card's time
  ctx.globalAlpha = Math.min(slide, outK) * 0.6;
  ctx.fillStyle = '#c2416b';
  ctx.fillRect(R.x + 18 * u, R.y + R.h - 6 * u, (R.w - 36 * u) * Math.max(0, 1 - card.t / card.dur), 2);
  ctx.restore();
}
