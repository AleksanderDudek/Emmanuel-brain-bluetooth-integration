/**
 * Światło ciała's words on the canvas (screen space, never zoomed): the "what to do now" line, the element's card
 * (its place in the way, the name in the serif with the Latin small under it, the guidance, the fill), Równowaga's
 * loop (the everyday push, the value on its gauge, the healthy range, what the body does), the fact card with its
 * source, the breath in rest, the three round buttons, the narrator's bubble, the picker, the story cards and, on a
 * desk, the list of the way.  Text the player reads is 13 px and more; sources and the Latin 12; never under 11.
 */
import { fmtNum } from '../../i18n';
import { fitText } from '../kit/mobile';
import { drawPassage, layoutPassage, passage } from '../kit/scripture';
import {
  LISTS, LOOP, VARIANTS, count, elName, elSource, fixText, kickText, loopValueAt, rangeText, valueText, variantLine, variantName,
  type Element,
} from './content';
import { t } from './i18n';
import { CTRLS, pickerRect, storyRect, type CtrlId, type Layout, type Rect } from './layout';
import { litIn } from './meta';
import { GOLD, GOLD_HI, ICE, INK, REST, SANS, SERIF, SILVER, fitWrap, font, rgba, rr, wrap } from './paint';
import { ROOT, VERSE, type Story, type SwiatloSim } from './sim';

const TAU = Math.PI * 2;
const CARD_BG = 'rgba(8,14,34,.82)';

/** The colour of the moment: gold while focus fills, silver blind, violet in rest, ice otherwise. */
export function toneOf(sim: SwiatloSim): string {
  if (sim.restBlock) return REST;
  if (sim.blind) return SILVER;
  if (sim.filling) return GOLD;
  return ICE;
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, edge: string, radius = 14): void {
  rr(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.fillStyle = CARD_BG;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** The "what to do now" line: an icon and a few words, in the moment's colour. */
export function drawNow(ctx: CanvasRenderingContext2D, L: Layout, now: { icon: string; text: string } | null, tone: string): void {
  if (!now) return;
  const r = L.now;
  panel(ctx, r, rgba(tone === ICE ? '#8fd6e8' : tone, 0.55), r.h / 2);
  const px = L.font.now;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = font(px + 2, 700);
  ctx.fillStyle = tone;
  ctx.fillText(now.icon, r.x + 10, r.y + r.h / 2 + 1);
  const iw = ctx.measureText(now.icon).width + 16;
  const text = fitText(ctx, now.text, r.w - iw - 12, px, 700, SANS, 13);
  ctx.fillStyle = '#f2f7ff';
  ctx.fillText(text, r.x + iw, r.y + r.h / 2 + 1);
}

interface Line { text: string; px: number; weight: number; serif?: boolean; italic?: boolean; color: string; gap?: number }

/** Lay lines out top-down in a width; returns the height used. Draws when `draw`. */
function flow(ctx: CanvasRenderingContext2D, x: number, y: number, lines: readonly Line[], draw: boolean): number {
  let yy = y;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const l of lines) {
    ctx.font = font(l.px, l.weight, l.serif, l.italic);
    if (draw) {
      ctx.fillStyle = l.color;
      ctx.fillText(l.text, x, yy);
    }
    yy += Math.round(l.px * 1.3) + (l.gap ?? 0);
  }
  return yy - y;
}

/** Wrap text into Line objects at the largest size (from px to min) that keeps it within `maxLines`. */
function para(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, min: number, maxLines: number, color: string, weight = 500, serif = false, italic = false): Line[] {
  const f = fitWrap(ctx, text, w, maxLines, px, min, weight, serif, italic);
  let lines = f.lines;
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
  }
  return lines.map((s, i) => ({ text: s, px: f.px, weight, serif, italic, color, gap: i === lines.length - 1 ? 4 : 0 }));
}

/** A flexible paragraph: the largest size from `px` down to 13 px whose lines fit `avail` px of height; else cut. */
function flexPara(ctx: CanvasRenderingContext2D, text: string, w: number, px: number, avail: number, color: string, weight = 500): Line[] {
  for (let size = px; size >= 13; size -= 0.5) {
    ctx.font = font(size, weight);
    const lines = wrap(ctx, text, w);
    const lh = Math.round(size * 1.3);
    if (lines.length * lh <= avail) return lines.map(s => ({ text: s, px: size, weight, color }));
  }
  ctx.font = font(13, weight);
  const lines = wrap(ctx, text, w);
  const room = Math.max(1, Math.floor(avail / Math.round(13 * 1.3)));
  const cut = lines.slice(0, room);
  if (lines.length > room) cut[room - 1] = `${cut[room - 1].replace(/[\s,;:.]+$/, '')}…`;
  return cut.map(s => ({ text: s, px: 13, weight, color }));
}

const lineH = (l: Line): number => Math.round(l.px * 1.3) + (l.gap ?? 0);
const linesH = (ls: readonly Line[]): number => ls.reduce((s, l) => s + lineH(l), 0);

/**
 * The element's card (or its fact, or the breath in rest), inside L.card, pinned to its top; returns the rect drawn.
 * Its parts: a fixed head (the place in the way, the name, the Latin; Równowaga's push and gauge), one flexible
 * paragraph (the guidance, what the body does, the fact) that takes the height left, a fixed foot (the source, the
 * fill bar).  The paragraph shrinks to 13 px before anything is cut.
 */
export function drawCard(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, pulse: number | null): Rect {
  // under the brain on an upright phone the card is short: what it must say may grow it up over the picture's foot
  const grow = L.brain && L.shape === 'tall' ? Math.round(L.stage.h * 0.42) : 0;
  const c = grow ? { x: L.card.x, y: L.card.y - grow, w: L.card.w, h: L.card.h + grow } : L.card;
  const pad = Math.round(10 * Math.min(1.6, L.u));
  const w = c.w - 2 * pad;
  const e = sim.element;
  const fact = sim.factShown ? sim.fact : null;
  const resting = !fact && (sim.restBlock || sim.phase !== 'play');
  const head: Line[] = [];
  const foot: Line[] = [];
  let flexText = '', flexColor = '#eef4ff', flexWeight = 500;
  let gauge: ((y: number) => void) | null = null;
  let gaugeH = 0;
  let ring: ((y: number) => void) | null = null;
  let ringH = 0;
  let edge = rgba(e.hue, 0.5);
  let bar = false;
  if (fact) {
    const fe = LISTS[sim.variant].find(x => x.id === fact.id) ?? e;
    edge = rgba(GOLD, 0.7);
    head.push({ text: `✦ ${t('hud.fact')}`, px: L.font.small, weight: 800, color: GOLD, gap: 2 });
    head.push(...para(ctx, elName(fe), w, L.font.name - 2, 15, 2, '#fff6e2', 700, true));
    flexText = fact.text;
    if (fe.loop) foot.push({ text: t('hud.depth', { n: fact.depth }), px: L.font.small, weight: 600, color: 'rgba(220,230,250,.7)' });
    foot.push(...para(ctx, t('hud.source', { s: elSource(fe, fact.depth) }), w, L.font.small, 12, 3, 'rgba(200,215,240,.62)', 500));
  } else if (resting) {
    edge = rgba(REST, 0.55);
    const b = sim.breath;
    const ringR = Math.round(Math.max(26, Math.min(c.w * 0.22, c.h * 0.16)));
    ringH = 2 * ringR + 12;
    ring = (y: number) => {
      const cx = c.x + c.w / 2, cy = y + ringR + 4;
      const k = sim.restBlock ? b.k : 0.5;
      ctx.strokeStyle = 'rgba(169,184,255,.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = rgba(REST, 0.18 + 0.25 * k);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR * (0.45 + 0.55 * k), 0, TAU);
      ctx.fill();
      if (sim.restBlock) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(L.font.text + 1, 800);
        ctx.fillStyle = '#f2f4ff';
        ctx.fillText(t(`hud.${b.phase}` as 'hud.in'), cx, cy - 8);
        ctx.font = font(L.font.text, 700);
        ctx.fillStyle = 'rgba(230,234,255,.85)';
        ctx.fillText(String(Math.max(1, Math.ceil(b.left - 1e-6))), cx, cy + 10);
      }
    };
    if (sim.restBlock) head.push({ text: t('hud.breath', { n: Math.min(sim.breathCycles, b.n + 1), of: sim.breathCycles }), px: L.font.small, weight: 700, color: 'rgba(220,226,255,.8)', gap: 2 });
    flexText = t('hud.restLit');
    flexWeight = 600;
    if (pulse !== null) foot.push({ text: t('hud.pulse', { n: Math.round(pulse) }), px: L.font.small, weight: 700, color: '#ffc2cf' });
    if (sim.phase === 'play') foot.push(...para(ctx, t('hud.next', { name: elName(sim.stage === 'lit' || sim.stage === 'full' ? sim.nextElement : e) }), w, L.font.small, 12, 2, 'rgba(220,230,250,.75)', 600));
  } else {
    bar = true;
    const tag = e.geo.deep ? t('hud.deep') : e.view === 'back' ? t('hud.back') : e.view === 'lat' ? t('hud.lat') : e.view === 'med' ? t('hud.med') : '';
    ctx.font = font(L.font.small, 700);
    head.push({ text: fitText(ctx, `${sim.idx + 1}/${sim.count}${tag ? ` · ${tag}` : ''}`, w, L.font.small, 700, SANS, 12), px: L.font.small, weight: 700, color: 'rgba(200,220,245,.75)', gap: 2 });
    head.push(...para(ctx, elName(e), w, L.font.name, 15, 2, '#ffffff', 700, true));
    ctx.font = font(L.font.latin, 500, true, true);
    // a narrow card of a loop keeps its room for what the body does (the Latin goes)
    if (!(e.loop && w < 200)) head.push({ text: fitText(ctx, e.latin, w, L.font.latin, 500, SERIF, 12), px: L.font.latin, weight: 500, serif: true, italic: true, color: rgba(e.hue, 0.85), gap: 4 });
    if (e.loop && sim.kick) {
      const spec = LOOP[e.loop];
      head.push(...para(ctx, kickText(e.loop, sim.kick.id), w, L.font.text, 13, 2, '#ffe2b0', 700));
      const v = loopValueAt(e.loop, sim.kick, sim.shown);
      const vt = valueText(spec, v);
      ctx.font = font(L.font.small, 600);
      const range = wrap(ctx, t('hud.range', { r: rangeText(spec) }), w);
      const rangeLH = Math.round(L.font.small * 1.3);
      const vPx = L.font.text + 3;
      ctx.font = font(vPx, 800);
      const vw = vt ? ctx.measureText(vt).width + 10 : 0;
      const rowH = Math.round(vPx * 1.3);
      gaugeH = rowH + 4 + range.length * rangeLH + 4;
      gauge = (y: number) => {
        const gx = c.x + pad;
        if (vt) {
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = font(vPx, 800);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(vt, gx, y + rowH / 2);
        }
        // the gauge beside the value: the healthy band in the middle, the dot the value now (it comes home as the light fills)
        const gy = y + rowH / 2, span = 3.2;
        const g0 = gx + vw, gw = Math.max(30, w - vw);
        const dev = (val: number) => (val >= spec.set ? (val - spec.set) / (spec.hi - spec.set) : -(spec.set - val) / (spec.set - spec.lo));
        const xOf = (d: number) => g0 + gw * (0.5 + Math.max(-1, Math.min(1, d / span)) / 2);
        rr(ctx, g0, gy - 3, gw, 6, 3);
        ctx.fillStyle = 'rgba(255,255,255,.1)';
        ctx.fill();
        ctx.fillStyle = 'rgba(140,240,190,.45)';
        ctx.fillRect(xOf(-1), gy - 3, xOf(1) - xOf(-1), 6);
        ctx.fillStyle = sim.shown >= 1 ? '#9ff0c8' : GOLD_HI;
        ctx.beginPath();
        ctx.arc(xOf(dev(v)), gy, 5, 0, TAU);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = font(L.font.small, 600);
        ctx.fillStyle = 'rgba(200,240,220,.85)';
        range.forEach((s, i) => ctx.fillText(s, gx, y + rowH + 4 + i * rangeLH));
      };
      flexText = fixText(e.loop, sim.kick.id);
      flexColor = '#e6eefc';
    } else flexText = sim.guide;
    if (pulse !== null && (e.id === 'o.heart' || e.id === 'r.heart')) foot.push({ text: t('hud.pulse', { n: Math.round(pulse) }), px: L.font.small, weight: 700, color: '#ffc2cf' });
  }
  const barH = bar ? Math.round(L.font.small * 1.35) + 16 : 0;
  const fixedH = pad + linesH(head) + gaugeH + ringH + linesH(foot) + barH + pad;
  const flex = flexPara(ctx, flexText, w, L.font.text, Math.max(Math.round(13 * 1.3), c.h - fixedH - 4), flexColor, flexWeight);
  const h = Math.min(c.h, fixedH + linesH(flex) + 4);
  // a grown card sits on the card's foot (it grows upward only as far as it needs)
  const r = { x: c.x, y: grow ? Math.min(L.card.y, L.card.y + L.card.h - h) : c.y, w: c.w, h };
  panel(ctx, r, edge);
  ctx.save();
  rr(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.clip();
  let y = r.y + pad;
  if (ring) { ring(y); y += ringH; }
  y += flow(ctx, r.x + pad, y, head, true);
  if (gauge) { gauge(y); y += gaugeH; }
  y += flow(ctx, r.x + pad, y, flex, true) + 4;
  flow(ctx, r.x + pad, y, foot, true);
  if (bar) {
    const by = r.y + r.h - pad - barH + 6;
    const fill = sim.shown;
    rr(ctx, r.x + pad, by, w, 7, 3.5);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fill();
    if (fill > 0.002) {
      rr(ctx, r.x + pad, by, Math.max(7, w * fill), 7, 3.5);
      ctx.fillStyle = sim.blind ? SILVER : sim.filling ? GOLD : rgba(ICE, 0.85);
      ctx.fill();
    }
    const state = sim.stage === 'full' || sim.stage === 'lit' || sim.stage === 'whole' ? t('hud.full')
      : sim.filling ? t('hud.filling') : sim.pushBlock && !sim.sighted ? t('hud.lead') : t('hud.waiting');
    const pct = t('hud.fill', { pct: t('pct', { n: Math.round(fill * 100) }) });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = font(L.font.small, 700);
    const full = `${pct} · ${state}`;
    const label = ctx.measureText(full).width <= w ? full : pct;
    ctx.fillStyle = sim.filling ? GOLD_HI : 'rgba(220,232,250,.82)';
    ctx.fillText(label, r.x + pad, by + 12);
  }
  ctx.restore();
  return r;
}

const GLYPH: Readonly<Record<CtrlId, string>> = { menu: '≡', prev: '◀', next: '▶' };
const KEY: Readonly<Record<CtrlId, string>> = { menu: 'M', prev: '←', next: '→' };
const CAP: Readonly<Record<CtrlId, 'hud.menu' | 'hud.prev' | 'hud.fwd'>> = { menu: 'hud.menu', prev: 'hud.prev', next: 'hud.fwd' };

/** The three round buttons (≡ ◀ ▶), with their captions and keys on a desk. */
export function drawControls(ctx: CanvasRenderingContext2D, L: Layout, down: Partial<Record<CtrlId, number>>, hover: CtrlId | null, dim: boolean): void {
  for (const id of CTRLS) {
    const b = L.ctrl[id];
    const press = down[id] ?? 0;
    const r = b.r * (1 - 0.06 * press);
    ctx.globalAlpha = dim ? 0.45 : 1;
    ctx.fillStyle = hover === id ? 'rgba(40,60,110,.92)' : 'rgba(14,24,52,.86)';
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hover === id ? GOLD_HI : 'rgba(170,215,240,.6)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = '#f4f9ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(r * (id === 'menu' ? 1.05 : 0.78))}px ${SANS}`;
    ctx.fillText(GLYPH[id], b.x + (id === 'next' ? 1.5 : id === 'prev' ? -1.5 : 0), b.y + 1);
    if (L.keys) {
      const cy = b.y + b.r + 6;
      ctx.font = font(L.font.cap, 700);
      ctx.fillStyle = 'rgba(225,236,250,.85)';
      ctx.textBaseline = 'top';
      ctx.fillText(fitText(ctx, t(CAP[id]), b.hit.w + 18, L.font.cap, 700, SANS, 13), b.x, cy);
      const kw = Math.max(L.font.cap * 1.8, ctx.measureText(KEY[id]).width + 12);
      const ky = cy + Math.round(L.font.cap * 1.5);
      rr(ctx, b.x - kw / 2, ky, kw, L.font.cap * 1.45, 5);
      ctx.strokeStyle = 'rgba(200,220,245,.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillText(KEY[id], b.x, ky + 2);
    }
    ctx.globalAlpha = 1;
  }
}

/** The narrator's bubble in a rect (its height fitted to the text, at the top or the bottom of `area`). */
export function drawBubble(ctx: CanvasRenderingContext2D, L: Layout, area: Rect, atTop: boolean, text: string, k: number): Rect | null {
  if (k <= 0.01 || !text) return null;
  const pad = 9;
  const w = Math.min(area.w, 420 * L.u);
  // on a phone the narrator keeps to the stage's edge: two lines at most (13 px), the picture stays in view
  const f = L.shape === 'desk' ? { lines: wrap((ctx.font = font(L.font.bubble, 600), ctx), text, w - 2 * pad), px: L.font.bubble } : fitWrap(ctx, text, w - 2 * pad, 2, Math.min(L.font.bubble, 14), 13, 600);
  const lines = f.lines;
  const lh = Math.round(f.px * 1.32);
  const nameH = Math.round(L.font.small * 1.3);
  const h = pad + nameH + lines.length * lh + pad;
  const r = { x: area.x + (area.w - w) / 2, y: atTop ? area.y : area.y + area.h - h, w, h };
  ctx.globalAlpha = k;
  panel(ctx, r, 'rgba(255,214,150,.45)');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(L.font.small, 800);
  ctx.fillStyle = GOLD;
  ctx.fillText(t('hud.zofia'), r.x + pad, r.y + pad - 1);
  ctx.font = font(f.px, 600);
  ctx.fillStyle = '#fbf6ee';
  lines.forEach((s, i) => ctx.fillText(s, r.x + pad, r.y + pad + nameH + i * lh));
  ctx.globalAlpha = 1;
  return r;
}

/** The list of the way (a desk): the meditation's elements around the one in the light. */
export function drawList(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim): void {
  const r = L.list;
  if (!r) return;
  const list = LISTS[sim.variant];
  const rowH = Math.round(L.font.small * 1.7);
  const head = Math.round(L.font.small * 1.9);
  const rows = Math.max(3, Math.floor((r.h - head - 10) / rowH));
  const start = Math.max(0, Math.min(list.length - rows, sim.idx - Math.floor(rows / 2)));
  const h = head + Math.min(rows, list.length) * rowH + 10;
  panel(ctx, { x: r.x, y: r.y, w: r.w, h }, 'rgba(150,190,230,.35)');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(L.font.small, 800);
  ctx.fillStyle = 'rgba(220,232,250,.85)';
  ctx.fillText(fitText(ctx, `${variantName(sim.variant)} · ${litIn(sim.p, sim.variant)}/${list.length}`, r.w - 24, L.font.small, 800, SANS, 13), r.x + 12, r.y + head / 2 + 3);
  for (let i = start; i < Math.min(list.length, start + rows); i++) {
    const e = list[i];
    const y = r.y + head + (i - start) * rowH + rowH / 2;
    const cur = i === sim.idx;
    const lit = sim.isLit(e.id);
    ctx.fillStyle = cur ? GOLD : lit ? e.hue : 'rgba(200,215,240,.45)';
    ctx.font = font(L.font.small, 800);
    ctx.fillText(cur ? '◉' : lit ? '✦' : '○', r.x + 12, y);
    const tx = r.x + 12 + Math.round(L.font.small * 1.5);
    ctx.font = font(L.font.small, cur ? 800 : 600);
    ctx.fillStyle = cur ? '#ffffff' : lit ? 'rgba(240,246,255,.9)' : 'rgba(210,222,245,.6)';
    ctx.fillText(fitText(ctx, `${i + 1}. ${elName(e)}`, r.x + r.w - 10 - tx, L.font.small, cur ? 800 : 600, SANS, 13), tx, y);
  }
}

/** The picker: the five meditations, each with where it goes on and how much of it is lit. */
export function drawPicker(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, hover: number): void {
  const P = pickerRect(L);
  ctx.fillStyle = 'rgba(4,8,20,.55)';
  ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, P.box, 'rgba(255,214,150,.55)', 16);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = font(L.font.title, 700, true);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(fitText(ctx, t('hud.picker'), P.box.w - P.close.w - 30, L.font.title, 700, SERIF, 15), P.box.x + 14, P.box.y + 22 * L.u);
  ctx.font = font(L.font.small, 600);
  ctx.fillStyle = 'rgba(220,230,250,.72)';
  ctx.fillText(fitText(ctx, t('hud.pickerNote'), P.box.w - P.close.w - 30, L.font.small, 600, SANS, 12), P.box.x + 14, P.box.y + 41 * L.u);
  // the close button
  const cl = P.close;
  ctx.font = `700 ${Math.round(cl.h * 0.5)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(235,242,255,.85)';
  ctx.fillText('×', cl.x + cl.w / 2, cl.y + cl.h / 2 + 1);
  VARIANTS.forEach((v, i) => {
    const r = P.rows[i];
    const cur = v === sim.variant;
    rr(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.fillStyle = hover === i ? 'rgba(50,70,120,.85)' : cur ? 'rgba(70,58,30,.75)' : 'rgba(24,36,70,.75)';
    ctx.fill();
    ctx.strokeStyle = cur ? GOLD : 'rgba(150,190,230,.35)';
    ctx.lineWidth = cur ? 1.8 : 1;
    ctx.stroke();
    const n = count(v), lit = litIn(sim.p, v), place = sim.p.pos[v];
    const right = `${place.idx + 1}/${n}${(sim.p.whole[v] ?? 0) > 0 ? ` · ✓${sim.p.whole[v]}×` : ''}`;
    ctx.textAlign = 'right';
    ctx.font = font(L.font.small, 700);
    ctx.fillStyle = cur ? GOLD_HI : 'rgba(220,232,250,.8)';
    const rw = ctx.measureText(right).width;
    ctx.fillText(right, r.x + r.w - 10, r.y + r.h / 2);
    ctx.textAlign = 'left';
    const tx = r.x + (L.keys ? 34 * L.u : 12);
    if (L.keys) {
      ctx.font = font(L.font.small, 800);
      ctx.fillStyle = 'rgba(200,220,245,.7)';
      ctx.fillText(String(i + 1), r.x + 12, r.y + r.h / 2);
    }
    const tw = r.x + r.w - 18 - rw - tx;
    ctx.font = font(L.font.text, 800);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fitText(ctx, variantName(v), tw, L.font.text, 800, SANS, 13), tx, r.y + r.h * 0.34);
    ctx.font = font(L.font.small, 600);
    ctx.fillStyle = 'rgba(210,225,248,.75)';
    ctx.fillText(fitText(ctx, `${variantLine(v)} · ✦${lit}`, tw, L.font.small, 600, SANS, 12), tx, r.y + r.h * 0.7);
  });
}

/** A story card (the opening pages, the news, a whole meditation's closing card); returns its rect. */
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, s: Story, touch: boolean): Rect {
  const w = Math.min(L.right - L.left - 24, 560 * L.u);
  const pad = Math.round(18 * Math.min(1.5, L.u));
  const iw = w - 2 * pad;
  const blocks: Line[] = [];
  let verse: ReturnType<typeof passage> | null = null;
  if (s.kind === 'open' && s.page === 0) {
    // the root verse has the first page to itself
    blocks.push(...para(ctx, t('story.open.title'), iw, L.font.title + 4, 18, 2, '#ffffff', 700, true));
    verse = passage(ROOT);
  } else if (s.kind === 'open') {
    blocks.push(...para(ctx, t('story.open.title2'), iw, L.font.title + 2, 17, 2, '#ffffff', 700, true));
    blocks.push(...para(ctx, t('story.open.text'), iw, L.font.text, 13, 5, 'rgba(238,244,255,.85)', 500));
    for (const k of ['story.open.step1', 'story.open.step2', 'story.open.step3'] as const) blocks.push(...para(ctx, t(k), iw, L.font.text + 1, 13, 4, '#eef4ff', 600));
  } else if (s.kind === 'news') {
    blocks.push(...para(ctx, t('story.news.title'), iw, L.font.title + 2, 17, 2, '#ffffff', 700, true));
    blocks.push(...para(ctx, t('story.news.text'), iw, L.font.text + 1, 13, 7, '#eef4ff', 500));
  } else {
    blocks.push(...para(ctx, t('story.whole.title'), iw, L.font.title + 2, 17, 2, '#ffffff', 700, true));
    blocks.push(...para(ctx, t('story.whole.text', { med: variantName(s.variant), n: count(s.variant) }), iw, L.font.text + 1, 13, 5, '#eef4ff', 500));
    verse = passage(VERSE[s.variant]);
  }
  const tapText = t(touch ? 'story.tap' : 'story.tap.keys');
  const textH = flow(ctx, 0, 0, blocks, false);
  const maxH = L.bottom - L.top - 16;
  const pl = verse ? layoutPassage(ctx, verse, iw, Math.max(60, Math.min(300 * L.u, maxH - textH - 2 * pad - Math.round(L.font.small * 1.6) - 14)), { max: Math.round(18 * L.u), min: 13 }) : null;
  const h = pad + textH + (pl ? pl.height + 12 : 0) + Math.round(L.font.small * 1.6) + pad;
  const r = storyRect(L, h);
  ctx.fillStyle = 'rgba(4,8,20,.5)';
  ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, r, 'rgba(255,214,150,.6)', 18);
  let y = r.y + pad;
  y += flow(ctx, r.x + pad, y, blocks, true);
  if (pl && verse) {
    drawPassage(ctx, verse, pl, r.x + r.w / 2, y + 6, { text: '#fff3d6', ref: 'rgba(255,226,170,.75)' });
    y += pl.height + 12;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = font(L.font.small, 700);
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(fitText(ctx, `${tapText}${s.pages > 1 ? ` · ${s.page + 1}/${s.pages}` : ''}`, iw, L.font.small, 700, SANS, 12), r.x + r.w / 2, r.y + r.h - pad - L.font.small);
  return r;
}

/** A desk's hover tag over an element of the picture: its name and what a click does. */
export function drawTag(ctx: CanvasRenderingContext2D, L: Layout, x: number, y: number, e: Element, state: 'here' | 'wait' | 'lit'): void {
  const name = elName(e);
  const sub = t(state === 'here' ? 'hover.here' : state === 'lit' ? 'hover.lit' : 'hover.wait');
  const px = Math.round(14 * L.k);
  ctx.font = font(px, 800);
  const w = Math.max(ctx.measureText(name).width, (ctx.font = font(px - 1, 600), ctx.measureText(sub).width)) + 20;
  const h = Math.round(px * 2.9);
  const bx = Math.min(L.right - w - 6, Math.max(L.left + 6, x + 14)), by = Math.max(L.top + 4, y - h - 10);
  panel(ctx, { x: bx, y: by, w, h }, rgba(e.hue, 0.6), 10);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(px, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(name, bx + 10, by + 6);
  ctx.font = font(px - 1, 600);
  ctx.fillStyle = 'rgba(220,232,250,.8)';
  ctx.fillText(sub, bx + 10, by + 8 + px * 1.25);
}

export const luxFloat = (n: number): string => `+${fmtNum(n)} lx`;
export { INK };
