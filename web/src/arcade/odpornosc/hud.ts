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
import { STAGES, STAGE_GESTURE, loopSpec, pathogenName, pathogenText, placeName, stageBody, stageFocus, stageName, stageYou } from './content';
import { paintIcon, paintStagePicture } from './picture';
import { t, type Key } from './i18n';
import type { Layout } from './layout';
import { PAL, TAU, circle, fitFont, font, glow, paintPortrait, rr, wrap } from './paint';
import type { Card, OdpSim } from './sim';

const CREAM = PAL.cream;
const DARK = 'rgba(42,18,34,0.62)';

/**
 * The strip under the HUD: the six stages as dots and the stage's name (left) and the „Co się dzieje?” button
 * (right: its words where they fit, else a "?"; on a desk its key's cap, H).  Returns the pill's right edge.
 */
export function drawStrip(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, now: number, hover = false): number {
  const r = L.strip, u = L.u;
  const h = r.h;
  const dot = Math.round(3.5 * u), gap = Math.round(4 * u);
  const dotsW = STAGES.length * (dot * 2) + (STAGES.length - 1) * gap;
  const name = stageName(sim.stage);
  ctx.save();
  // the name never runs under the help button
  const nameRoom = Math.min(r.w * 0.45, 180 * u, L.help.x - 8 * u - (r.x + Math.round(10 * u) + dotsW + Math.round(20 * u)));
  const nameSize = fitFont(ctx, name, nameRoom, 14.5 * u, MIN_READ, 800);
  const nameW = ctx.measureText(name).width;
  const pillW = Math.round(10 * u) + dotsW + Math.round(8 * u) + nameW + Math.round(12 * u);
  rr(ctx, r.x, r.y, pillW, h, h / 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  let x = r.x + Math.round(10 * u) + dot;
  STAGES.forEach((_, i) => {
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
    x += dot * 2 + gap;
  });
  ctx.font = font(nameSize, 800);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = CREAM;
  ctx.fillText(name, x - gap + Math.round(4 * u), r.y + h / 2 + 0.5);
  ctx.restore();
  if (!sim.card) drawHelp(ctx, L, hover);
  return r.x + pillW;
}

/** The „Co się dzieje?” button: a light pill with a "?" (the stage's card again). */
function drawHelp(ctx: CanvasRenderingContext2D, L: Layout, hover: boolean): void {
  const b = L.help, u = L.u, h = b.h;
  const label = t('btn.help');
  ctx.save();
  const qr = h * 0.34;
  // a desk keeps room for the key's cap at the pill's right end
  const capW = L.desk ? 26 * u : 0;
  const words = b.w > h + 8 && fitFont(ctx, label, b.w - qr * 2 - 20 * u - capW, 13.5 * u, MIN_READ, 750) >= MIN_READ && ctx.measureText(label).width <= b.w - qr * 2 - 18 * u - capW;
  const w = words ? b.w : h;
  const x = b.x + b.w - w;
  rr(ctx, x, b.y, w, h, h / 2);
  ctx.fillStyle = hover ? 'rgba(255,248,239,0.96)' : 'rgba(255,248,239,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(194,65,107,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const qx = words ? x + 8 * u + qr : x + w / 2, qy = b.y + h / 2;
  circle(ctx, qx, qy, qr);
  ctx.fillStyle = '#c2416b';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = font(Math.max(MIN_READ, qr * 1.5), 900);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', qx, qy + 0.5);
  if (words) {
    fitFont(ctx, label, b.w - qr * 2 - 20 * u - capW, 13.5 * u, MIN_READ, 750);
    ctx.fillStyle = PAL.ink;
    ctx.textAlign = 'left';
    ctx.fillText(label, qx + qr + 6 * u, qy + 0.5);
  }
  ctx.restore();
  if (L.desk && words) keyCap(ctx, 'H', x + w - 16 * u, b.y + h / 2, u);
}

/**
 * The persistent "what to do now" line (round 11): the gesture's icon and the stage's goal with its progress
 * („Zapal 5 miejsc na ścianie naczynia · 2/5”), „Odpocznij…” in a rest, the burst when it is ready.  Its own row
 * on an upright phone, between the stage's pill and the button elsewhere.
 */
export function drawGoal(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, now: number, pillRight: number): void {
  const d = sim.doNow();
  if (!d) return;
  const u = L.u;
  let area = L.goal;
  if (L.goalInStrip) {
    const x0 = pillRight + 8 * u, x1 = L.help.x - 8 * u;
    area = { x: x0, y: L.strip.y, w: Math.max(0, x1 - x0), h: L.strip.h };
  }
  if (area.w < 90 * u) return;
  const h = area.h, ir = h * 0.36;
  ctx.save();
  const text = fitLine(ctx, d.text, area.w - (h + 16 * u), 14 * u, 750);
  if (!text) { ctx.restore(); return; }
  const tw = ctx.measureText(text).width;
  const w = Math.min(area.w, tw + h + 14 * u);
  const x = area.x + (area.w - w) / 2;
  rr(ctx, x, area.y, w, h, h / 2);
  ctx.fillStyle = d.icon === 'breath' ? 'rgba(28,40,60,0.62)' : 'rgba(42,18,34,0.7)';
  ctx.fill();
  ctx.strokeStyle = d.gold ? 'rgba(255,209,102,0.85)' : d.icon === 'breath' ? 'rgba(170,215,255,0.6)' : 'rgba(255,248,239,0.28)';
  ctx.lineWidth = d.gold ? 1.6 : 1.2;
  ctx.stroke();
  if (d.gold) glow(ctx, x + w / 2, area.y + h / 2, w * 0.5, '255,209,102', 0.12 + 0.08 * Math.sin(now * 5));
  paintIcon(ctx, d.icon, x + h / 2 + 2 * u, area.y + h / 2, ir, now);
  ctx.fillStyle = d.gold ? '#ffe9b3' : d.icon === 'breath' ? '#dff0ff' : CREAM;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + h + 4 * u, area.y + h / 2 + 0.5);
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

/**
 * The two round buttons: the respiratory burst (its charge ring, gold when ready) and the NET (its charges).
 * On a desk each carries its key's cap (B, N) and a hovered one is ringed.
 */
export function drawButtons(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, pressed: 'burst' | 'net' | null, now: number, flash: number, hover: 'burst' | 'net' | null = null): void {
  const u = L.u;
  for (const which of ['burst', 'net'] as const) {
    if (hover !== which || !(which === 'burst' ? sim.burstShown : sim.netShown)) continue;
    const b = which === 'burst' ? L.burst : L.net;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,248,239,0.85)';
    ctx.lineWidth = 2;
    circle(ctx, b.x, b.y, b.r + 4 * u);
    ctx.stroke();
    ctx.restore();
  }
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
  // a desk: the keys' caps on the buttons' shoulders
  if (L.desk) {
    if (sim.burstShown) keyCap(ctx, 'B', L.burst.x + L.burst.r * 0.74, L.burst.y - L.burst.r * 0.74, u);
    if (sim.netShown) keyCap(ctx, 'N', L.net.x + L.net.r * 0.74, L.net.y - L.net.r * 0.74, u);
  }
}

/** A key's letter in a small cap, centred on (x, y). */
export function keyCap(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, u: number): void {
  const px = Math.max(MIN_READ, Math.round(12 * u));
  ctx.save();
  ctx.font = font(px, 800);
  const w = Math.max(px + 10 * u, ctx.measureText(key).width + 12 * u), h = px + 8 * u;
  rr(ctx, x - w / 2, y - h / 2, w, h, 5 * u);
  ctx.fillStyle = 'rgba(38,14,30,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.7)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(key, x, y + 0.5);
  ctx.restore();
}

/** A hovered target's tag (a desk): its name, a line about it, and what a click does — beside the point, inside the field. */
export function drawAimTag(ctx: CanvasRenderingContext2D, L: Layout, x: number, y: number, gap: number, title: string, sub: string, act: string, alpha: number): void {
  if (alpha <= 0.01) return;
  const u = L.u, pad = Math.round(8 * u);
  const tp = Math.max(MIN_READ, 13.5 * u), sp = Math.max(MIN_READ, 12.5 * u);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(tp, 800);
  const tw = ctx.measureText(title).width;
  ctx.font = font(sp, 600);
  const sw = sub ? ctx.measureText(sub).width : 0;
  ctx.font = font(sp, 700);
  const aw = ctx.measureText(act).width;
  const w = Math.max(tw, sw, aw) + 2 * pad;
  const lh = Math.round(sp * 1.3);
  const h = 2 * pad + Math.round(tp * 1.25) + (sub ? lh : 0) + lh;
  let bx = x + gap;
  if (bx + w > L.field.x + L.field.w - 6) bx = x - gap - w;
  const by = Math.max(L.field.y + 4, Math.min(L.field.y + L.field.h - h - 4, y - h / 2));
  rr(ctx, bx, by, w, h, 10 * u);
  ctx.fillStyle = 'rgba(38,14,30,0.88)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,209,102,0.55)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(tp, 800);
  ctx.fillStyle = CREAM;
  ctx.fillText(title, bx + pad, by + pad);
  let ty = by + pad + Math.round(tp * 1.25);
  if (sub) {
    ctx.font = font(sp, 600);
    ctx.fillStyle = 'rgba(255,248,239,0.78)';
    ctx.fillText(sub, bx + pad, ty);
    ty += lh;
  }
  ctx.font = font(sp, 700);
  ctx.fillStyle = PAL.gold;
  ctx.fillText(act, bx + pad, ty);
  ctx.restore();
}

/** One of a stage card's three lines: its label („W ciele”, „Ty”, „Skupienie”), its words, its colour and icon. */
export interface CardLine { kind: 'body' | 'you' | 'focus'; label: string; text: string }

/** A card's words for the view, in the page's language (and for the hand the player has). */
export function cardWords(card: Card, sim: OdpSim, mouse = false): {
  kicker: string; title: string; story: string; lines: CardLine[]; memory: string; picture: boolean; verse: boolean;
} {
  const s = card.stage;
  const spec = loopSpec(sim.p.loop);
  const memory = card.memory ? t('card.memory', { name: pathogenName(card.memory) }) : '';
  if (card.kind === 'open') {
    return { kicker: placeName(spec.place), title: t('story.open.title'), story: t('story.open.text'), lines: [], memory: '', picture: false, verse: true };
  }
  if (card.kind === 'loop') {
    return {
      kicker: t('card.loopTitle', { n: sim.p.loop, place: placeName(spec.place) }), title: pathogenName(spec.bug),
      story: `${t(`place.${spec.place}.story` as Key)} ${pathogenText(spec.bug)}`, lines: [], memory: '', picture: false, verse: false,
    };
  }
  const stageOf = t('card.stageOf', { n: card.idx + 1 });
  const kicker = card.kind === 'explain' ? `${t('card.explain')} · ${stageOf}` : card.back ? `${t('story.back.title')} · ${stageOf}` : stageOf;
  const lines: CardLine[] = [];
  if (card.full) lines.push({ kind: 'body', label: t('card.body'), text: stageBody(s) });
  lines.push({ kind: 'you', label: t('card.you'), text: stageYou(s, mouse) });
  lines.push({ kind: 'focus', label: t('card.focus'), text: stageFocus(s) });
  return { kicker, title: stageName(s), story: '', lines, memory, picture: card.full, verse: false };
}

const LABEL_COLOR: Readonly<Record<CardLine['kind'], string>> = { body: '#c2416b', you: '#a8650c', focus: '#5b4fc4' };

/** A word of a card's line, with its font (the label bold and coloured). */
interface Word { text: string; label: boolean }

/** Wrap a card's line: its label (bold) then its words, greedy, each word measured in its own font. */
function wrapLine(ctx: CanvasRenderingContext2D, l: CardLine, maxW: number, size: number): Word[][] {
  const words: Word[] = [
    ...`${l.label}:`.split(/\s+/).map(w => ({ text: w, label: true })),
    ...l.text.split(/\s+/).filter(Boolean).map(w => ({ text: w, label: false })),
  ];
  const width = (w: Word) => { ctx.font = font(size, w.label ? 850 : 600); return ctx.measureText(w.text).width; };
  ctx.font = font(size, 600);
  const space = ctx.measureText(' ').width;
  const out: Word[][] = [];
  let line: Word[] = [], lw = 0;
  for (const w of words) {
    const ww = width(w);
    if (line.length && lw + space + ww > maxW) { out.push(line); line = []; lw = 0; }
    lw += (line.length ? space : 0) + ww;
    line.push(w);
  }
  if (line.length) out.push(line);
  return out;
}

/** A line's small icon in the gutter: a cell (in the body), the gesture (you), the alarm's rings (focus). */
function lineIcon(ctx: CanvasRenderingContext2D, kind: CardLine['kind'], gesture: 'tap' | 'drag', x: number, y: number, r: number, now: number): void {
  if (kind === 'you') {
    ctx.save();
    circle(ctx, x, y, r);
    ctx.fillStyle = '#5a2a40';
    ctx.fill();
    ctx.restore();
    paintIcon(ctx, gesture, x, y, r, now);
    return;
  }
  ctx.save();
  if (kind === 'body') {
    circle(ctx, x, y, r * 0.8);
    ctx.fillStyle = PAL.neut;
    ctx.fill();
    ctx.strokeStyle = LABEL_COLOR.body;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
    ctx.fillStyle = PAL.lobe;
    for (let i = -1; i <= 1; i++) { circle(ctx, x + i * r * 0.28, y + r * 0.12, r * 0.2); ctx.fill(); }
  } else {
    ctx.strokeStyle = LABEL_COLOR.focus;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    const p = (now * 0.6) % 1;
    for (const k of [0.3, 0.62, 0.95]) {
      ctx.globalAlpha = k === 0.95 ? 1 - p : 1;
      circle(ctx, x, y, r * k * (k === 0.95 ? 0.7 + 0.3 * p : 1));
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * The card (round 11): a bottom sheet on a phone upright, centred elsewhere; it slides in and waits for a tap
 * (or Enter/Space) — the stage does not run under it.  A stage's full card: the kicker and the stage's name, its
 * picture (the scene in miniature, the thing to touch ringed, the gesture drawn) and three short lines — what
 * happens in the body, what you do, what focus changes; a short card keeps the last two.  The first session's
 * story card carries the root verse.
 */
export function drawCard(ctx: CanvasRenderingContext2D, L: Layout, sim: OdpSim, card: Card, touch: boolean, now: number, cache: { key: string; verse: PassageLayout | null }): void {
  const u = L.u, R = L.card;
  const words = cardWords(card, sim, !touch);
  const inK = Math.min(1, card.t / 0.35);
  const slide = 1 - (1 - inK) ** 3;
  ctx.save();
  ctx.globalAlpha = slide;
  // dim the world behind
  ctx.fillStyle = 'rgba(30,10,24,0.5)';
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
  const pad = 16 * u, x = R.x + pad, w = R.w - 2 * pad;
  let y = R.y + pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // the kicker, the title, the six stages as dots
  let size = fitFont(ctx, words.kicker, w, 13 * u, MIN_READ, 800);
  ctx.fillStyle = '#c2416b';
  ctx.fillText(words.kicker, x, y);
  y += size * 1.35;
  size = fitFont(ctx, words.title, w, 25 * u, 16, 700, true);
  ctx.fillStyle = PAL.ink;
  ctx.fillText(words.title, x, y);
  y += size * 1.25;
  if (card.kind === 'stage' || card.kind === 'explain') {
    const dot = 4 * u;
    STAGES.forEach((_, i) => {
      circle(ctx, x + dot + i * (dot * 2 + 6 * u), y + dot, dot);
      ctx.fillStyle = i < card.idx ? PAL.goldDeep : i === card.idx ? '#c2416b' : 'rgba(58,29,46,0.18)';
      ctx.fill();
    });
    y += dot * 2 + 10 * u;
  }
  // the tap hint at the bottom
  const hint = t(touch ? 'card.tap' : 'card.click');
  const hintSize = fitFont(ctx, hint, w, 13.5 * u, MIN_READ, 750);
  const bottom = R.y + R.h - pad - hintSize * 1.6;
  if (words.story) y = drawStory(ctx, words.story, x, y, w, bottom, u, words.verse, R, cache);
  else drawLines(ctx, words, x, y, w, bottom, u, now, card, sim);
  ctx.font = font(hintSize, 750);
  ctx.fillStyle = card.t >= 0.6 ? '#c2416b' : 'rgba(194,65,107,0.4)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha *= 0.78 + 0.22 * Math.sin(now * 3);
  ctx.fillText(hint, R.x + R.w / 2, R.y + R.h - pad - hintSize * 0.6);
  ctx.restore();
}

/** The story and the open card's verse. */
function drawStory(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, bottom: number, u: number, verse: boolean, R: Layout['card'], cache: { key: string; verse: PassageLayout | null }): number {
  const verseH = verse ? Math.min(150 * u, (bottom - y) * 0.45) : 0;
  let fs = 16 * u, lines: string[] = [];
  for (; fs >= MIN_READ; fs -= 0.5) {
    ctx.font = font(fs, 560);
    lines = wrap(ctx, text, w);
    if (lines.length * fs * 1.35 <= bottom - y - verseH) break;
  }
  ctx.font = font(Math.max(MIN_READ, fs), 560);
  ctx.fillStyle = PAL.ink;
  for (const l of lines) {
    if (y + fs > bottom - verseH + 2) break;
    ctx.fillText(l, x, y);
    y += fs * 1.35;
  }
  if (verse) {
    const p = passage('psa103.2-3');
    const key = `${R.w}|${verseH}`;
    if (cache.key !== key) {
      cache.key = key;
      cache.verse = layoutPassage(ctx, p, w, Math.max(30, bottom - y - 6 * u), { max: 17 * u, min: MIN_READ });
    }
    if (cache.verse) drawPassage(ctx, p, cache.verse, R.x + R.w / 2, Math.max(y + 6 * u, bottom - cache.verse.height), { text: '#5a2a40', ref: '#a0607a' });
  }
  return y;
}

/**
 * A stage card's picture and lines: the picture beside the lines on a wide card, above them on a narrow one; the
 * largest text that fits (never under the reading floor), the picture taking what is left (dropped under 64 px).
 */
function drawLines(ctx: CanvasRenderingContext2D, words: ReturnType<typeof cardWords>, x: number, y: number, w: number, bottom: number, u: number, now: number, card: Card, sim: OdpSim): void {
  // (`words` may lose its picture below when there is no room for one)
  const gutter = 30 * u, gap = 10 * u;
  const side = words.picture && w >= 440 * u;
  const pw = side ? Math.round(w * 0.4) : w;
  const tx = side ? x + pw + 14 * u : x, tw = (side ? w - pw - 14 * u : w) - gutter;
  // the largest size that fits beside or under the picture
  let fs = 16.5 * u, laid: Word[][][] = [];
  const need = (f: number) => laid.reduce((a, l) => a + l.length * f * 1.3, 0) + (laid.length - 1) * gap;
  const avail = bottom - y;
  let ph = 0;
  for (; fs >= MIN_READ; fs -= 0.5) {
    laid = words.lines.map(l => wrapLine(ctx, l, tw, fs));
    const memLines = words.memory ? Math.ceil(measure(ctx, words.memory, fs * 0.92) / Math.max(1, tw + gutter)) : 0;
    const textH = need(fs) + (memLines ? memLines * fs * 1.25 + gap : 0);
    if (!words.picture) { if (textH <= avail) break; continue; }
    if (side) { if (textH <= avail) break; continue; }
    ph = Math.min(170 * u, avail - textH - gap);
    if (ph >= 96 * u || fs <= MIN_READ + 1) break;
  }
  fs = Math.max(MIN_READ, fs);
  // no room for a picture worth the name: the lines alone, as large as they fit
  if (words.picture && !side && ph < 64 * u) {
    words = { ...words, picture: false };
    for (fs = 16.5 * u; fs > MIN_READ; fs -= 0.5) {
      laid = words.lines.map(l => wrapLine(ctx, l, tw, fs));
      if (need(fs) <= avail) break;
    }
    fs = Math.max(MIN_READ, fs);
    laid = words.lines.map(l => wrapLine(ctx, l, tw, fs));
  }
  if (words.picture) {
    const spec = loopSpec(sim.p.loop);
    if (side) {
      const h = Math.min(avail, pw * 0.72);
      paintStagePicture(ctx, card.stage, x, y + (avail - h) / 2 * 0.3, pw, h, now, spec.bug, spec.virus);
    } else if (ph >= 64 * u) {
      const pwN = Math.min(w, ph * 1.9);
      paintStagePicture(ctx, card.stage, x + (w - pwN) / 2, y, pwN, ph, now, spec.bug, spec.virus);
      y += ph + gap;
    }
  }
  const gesture = STAGE_GESTURE[card.stage];
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  let ly = y;
  laid.forEach((lines, i) => {
    const kind = words.lines[i].kind;
    lineIcon(ctx, kind, gesture, tx + gutter / 2 - 2 * u, ly + fs * 0.62, Math.min(11 * u, gutter * 0.38), now);
    for (const line of lines) {
      if (ly + fs > bottom + 2) break;
      let cx = tx + gutter;
      for (const wd of line) {
        ctx.font = font(fs, wd.label ? 850 : 600);
        ctx.fillStyle = wd.label ? LABEL_COLOR[kind] : PAL.ink;
        ctx.fillText(wd.text, cx, ly);
        cx += ctx.measureText(wd.text).width;
        ctx.font = font(fs, 600);
        cx += ctx.measureText(' ').width;
      }
      ly += fs * 1.3;
    }
    ly += gap;
  });
  if (words.memory && ly + fs < bottom) {
    const mf = Math.max(MIN_READ, fs * 0.92);
    ctx.font = font(mf, 750);
    ctx.fillStyle = '#8a5a10';
    for (const l of wrap(ctx, words.memory, tw + gutter)) {
      if (ly + mf > bottom + 2) break;
      ctx.fillText(l, tx, ly);
      ly += mf * 1.25;
    }
  }
}

function measure(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  ctx.font = font(Math.max(MIN_READ, size), 750);
  return ctx.measureText(text).width;
}
