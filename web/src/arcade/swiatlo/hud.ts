/**
 * Światło ciała's own HUD on the canvas (the runner draws the standard one: the Mendi panel, the score,
 * the coach marks): the organ's panel at the band's height — its name, the everyday push, the value on a
 * gauge with its healthy range, what the body does — which turns into the Wiedza card when tapped (or
 * the first time an organ settles); in rest, the vagus' rest with the breath and the pulse; Zofia's
 * bubble at the end of its column away from the band; the round help button in the thumb zone; the
 * sing-along line under the HUD; the story cards.  Every text is fitted with a floor (never under 11 px;
 * what the player reads to play, 13 px and more).
 *
 * On a desk (a mouse on a desktop or a big screen, layout.ts) the same parts grow with the screen and
 * spread out: the panel keeps the live loop and adds its sources, the Wiedza card opens beside it in the
 * other column, the song shows the sung line and the next one, the button carries its key's name, and a
 * hovered panel, button or organ answers the mouse.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage } from '../kit/scripture';
import {
  ORGAN, ORGANS, cortisolCurve, depthName, factSource, factText, fixText, kickText, organName, organWhat, rangeText, sourceText,
  valueText, type OrganId,
} from './content';
import { t } from './i18n';
import { type Layout, type Rect, bubbleRect, cardRect, panelRect, storyRect } from './layout';
import { CYAN, GOLD, GOLD_HI, ICE, INK, REST, fitFont, font, mix, rgbaPrefix, rr, stars, wrap } from './paint';
import { RULES } from './rules';
import { loopDev, loopValue, type SwiatloSim } from './sim';

const PAD = 12;
/** the panel's and the bubble's padding: the phone's 12 px, grown with the type on a desk */
const padOf = (L: Pick<Layout, 'k'>): number => Math.round(PAD * L.k);
/** the sources of the rest panel's numbers: six breaths a minute, heart-rate variability (content.ts) */
const REST_SRC = ['S10', 'S13'] as const;

type Row =
  | { kind: 'text'; text: string; px: number; weight: number; color: string; italic?: boolean; serif?: boolean; lines?: number }
  | { kind: 'head'; text: string; chip: string | null; px: number }
  | { kind: 'gauge'; h: number }
  | { kind: 'curve'; h: number }
  | { kind: 'dots'; h: number }
  | { kind: 'gap'; h: number };

interface Built {
  rows: Row[];
  h: number;
  card: boolean;
  fresh: boolean;
  accent: string;
  /** the padding inside the box */
  pad: number;
  /** the head row's chip is lit (a desk's card is open beside the panel) */
  chipOn: boolean;
}

/** Lay rows out in a width: wrapped texts' line counts, the total height. */
function measure(ctx: CanvasRenderingContext2D, rows: Row[], w: number, pad: number): number {
  let h = pad * 2;
  for (const r of rows) {
    if (r.kind === 'text') {
      ctx.font = font(r.px, r.weight, r.serif, r.italic);
      const lines = wrap(ctx, r.text, w).slice(0, r.lines ?? 3);
      h += lines.length * Math.round(r.px * 1.3);
    } else if (r.kind === 'head') h += Math.round(r.px * 1.45);
    else h += r.h;
  }
  return h;
}

/**
 * The pulse line: the player's own pulse when Mendi gives one ("Twoje tętno: 66/min"); otherwise the typical
 * resting rate, said to be typical and not measured — never the heart loop's story value, never "yours".
 */
export function pulseText(sim: Pick<SwiatloSim, 'pulse'>): string {
  return sim.pulse !== null ? t('hud.pulse', { n: Math.round(sim.pulse) }) : t('hud.typical', { n: RULES.typical });
}

/** "Źródła: A; B" — the loop's sources in full, for a desk's panel (the phone shows the card's one). */
export const sourcesText = (ids: readonly string[]): string => t('hud.sources', { s: ids.map(sourceText).join('; ') });

/** The Wiedza card's rows: the organ and the depth, one real number, its source. */
function cardRows(sim: SwiatloSim, L: Layout): Built {
  const f = L.font, rows: Row[] = [];
  const card = sim.card!;
  const o = card.organ, d = card.depth;
  const k = L.k;
  rows.push({ kind: 'text', text: `${t('hud.knowledge')} · ${organName(o)} · ${depthName(d)}`, px: f.small, weight: 700, color: GOLD, lines: 2 });
  rows.push({ kind: 'gap', h: 4 * k });
  rows.push({ kind: 'text', text: factText(o, d), px: Math.max(MIN_READ, f.bubble), weight: 600, color: ICE, lines: 7 });
  rows.push({ kind: 'gap', h: 4 * k });
  rows.push({ kind: 'text', text: t('hud.source', { s: factSource(o, d) }), px: f.note, weight: 500, color: 'rgba(214,232,255,.72)', lines: 3 });
  return { rows, h: 0, card: true, fresh: card.fresh, accent: ORGAN[o].hue, pad: padOf(L), chipOn: false };
}

/** What the panel shows now (the loop, the way on, the rest — or, but on a desk, a Wiedza card). */
function panelRows(sim: SwiatloSim, L: Layout): Built {
  if (sim.card && !L.card) return cardRows(sim, L);
  const f = L.font, rows: Row[] = [], k = L.k, desk = L.shape === 'desk';
  const muted = 'rgba(214,232,255,.72)';
  const base = { h: 0, card: false, fresh: false, pad: padOf(L), chipOn: desk && !!sim.card };
  const scanLine = `${t('hud.scan', { n: sim.scan, depth: depthName(sim.depth) })}${sim.target === sim.day ? ` · ${t('hud.dayOrgan')}` : ''}`;
  if (sim.restBlock) {
    const b = sim.breath;
    const left = Math.ceil((b.inhale ? RULES.inhale : RULES.exhale) * (1 - b.p));
    rows.push({ kind: 'head', text: scanLine, chip: null, px: f.small });
    rows.push({ kind: 'text', text: t('hud.vagus'), px: f.name, weight: 800, color: REST, lines: 2 });
    rows.push({ kind: 'text', text: `${b.inhale ? t('hud.in') : t('hud.out')} · ${left}`, px: f.value, weight: 800, color: ICE, lines: 1 });
    const hb = sim.heartBpm();
    rows.push({ kind: 'text', text: pulseText(sim), px: Math.max(MIN_READ, hb.real ? f.text : f.small), weight: hb.real ? 700 : 500, color: hb.real ? '#ffc2cf' : muted, lines: 2 });
    const l = sim.loop;
    if (l && !l.balanced) rows.push({ kind: 'text', text: `${organName(l.organ)} · ${fixText(l.organ, l.kick)}`, px: Math.max(MIN_READ, f.small), weight: 500, color: muted, lines: 3 });
    if (desk) rows.push({ kind: 'text', text: sourcesText(REST_SRC), px: f.note, weight: 500, color: 'rgba(214,232,255,.5)', lines: 3 });
    return { ...base, rows, accent: REST };
  }
  const l = sim.loop;
  if (!l) {
    const o = sim.target;
    rows.push({ kind: 'head', text: scanLine, chip: null, px: f.small });
    rows.push({ kind: 'text', text: t('hud.next', { organ: o ? organName(o) : t('hud.feet') }), px: f.name, weight: 800, color: ICE, lines: 2 });
    if (o) rows.push({ kind: 'text', text: organWhat(o), px: f.text, weight: 500, color: muted, lines: 2 });
    rows.push({ kind: 'dots', h: 18 * k });
    return { ...base, rows, accent: CYAN };
  }
  const o = l.organ, spec = ORGAN[o];
  rows.push({ kind: 'head', text: scanLine, chip: `${t('hud.knowledge')} ›${L.keys ? ' Enter' : ''}`, px: f.small });
  rows.push({ kind: 'text', text: organName(o), px: f.name, weight: 800, color: spec.hue, lines: 2 });
  rows.push({ kind: 'text', text: organWhat(o), px: f.text, weight: 500, color: muted, lines: 2 });
  rows.push({ kind: 'text', text: kickText(o, l.kick), px: Math.max(MIN_READ, f.small), weight: 600, color: '#ffcf9e', italic: true, lines: 2 });
  const v = valueText(spec, loopValue(l));
  if (spec.kind === 'curve') rows.push({ kind: 'curve', h: 40 * k });
  else if (v) rows.push({ kind: 'text', text: v, px: f.value, weight: 800, color: l.settled ? '#b9f5d0' : '#ffd6a0', lines: 1 });
  rows.push({ kind: 'gauge', h: 16 * k });
  rows.push({ kind: 'text', text: l.balanced ? `${t('hud.inBalance')} ${stars(l.rating)}` : rangeText(spec), px: Math.max(MIN_READ, f.small), weight: 600, color: l.balanced ? GOLD_HI : muted, lines: 1 });
  rows.push({ kind: 'text', text: fixText(o, l.kick), px: f.text, weight: 600, color: ICE, lines: 3 });
  if (o === 'heart') {
    if (sim.pulse !== null) rows.push({ kind: 'text', text: pulseText(sim), px: f.text, weight: 700, color: '#ffc2cf', lines: 1 });
    else rows.push({ kind: 'text', text: pulseText(sim), px: Math.max(MIN_READ, f.small), weight: 500, color: muted, lines: 2 });
  }
  rows.push({ kind: 'text', text: t('hud.typicalBody'), px: f.note, weight: 500, color: 'rgba(214,232,255,.58)', lines: 2 });
  if (desk) rows.push({ kind: 'text', text: sourcesText(spec.src), px: f.note, weight: 500, color: 'rgba(214,232,255,.5)', lines: 4 });
  return { ...base, rows, accent: spec.hue };
}

export interface Box { rect: Rect; built: Built }

/** The panel's rectangle for this frame (null while a story is up). */
export function panelBox(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, bandY: number): Box | null {
  if (sim.story || !sim.started) return null;
  const built = panelRows(sim, L);
  built.h = measure(ctx, built.rows, L.panel.w - 2 * built.pad, built.pad);
  return { rect: panelRect(L, bandY, built.h), built };
}

/** A desk's Wiedza card beside the panel, at the band's height in the other column (null: none open, or not a desk). */
export function cardBox(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, bandY: number): Box | null {
  if (!L.card || !sim.card || sim.story || !sim.started) return null;
  const built = cardRows(sim, L);
  built.h = measure(ctx, built.rows, L.card.w - 2 * built.pad, built.pad);
  const rect = cardRect(L, bandY, built.h);
  return rect ? { rect, built } : null;
}

/** Draw the panel or a card; `hover` lights its edge (a mouse over it: a click opens or closes the card). */
export function drawPanel(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, box: Box, now: number, pressed: number, hover = false): void {
  const { rect: r, built } = box;
  const pad = built.pad, k = L.k;
  const press = pressed > 0 ? 1 - 0.03 * pressed : 1;
  ctx.save();
  if (press !== 1) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(press, press);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  // the glass card
  rr(ctx, r.x, r.y, r.w, r.h, 14 * k);
  ctx.fillStyle = built.card ? 'rgba(28,24,46,.9)' : 'rgba(10,18,42,.78)';
  ctx.fill();
  ctx.lineWidth = (built.card && built.fresh ? 2 : 1.2) * (hover ? 1.6 : 1);
  ctx.strokeStyle = hover ? (built.card ? GOLD : ICE)
    : built.card ? (built.fresh ? GOLD : 'rgba(255,210,122,.55)') : `${rgbaPrefix(built.accent.startsWith('#') ? built.accent : CYAN)}.5)`;
  ctx.stroke();
  // a thin accent along the top edge
  ctx.fillStyle = `${rgbaPrefix(built.accent.startsWith('#') ? built.accent : CYAN)}.55)`;
  rr(ctx, r.x + 12 * k, r.y + 3, r.w - 24 * k, 2 * k, k);
  ctx.fill();
  const w = r.w - 2 * pad;
  let y = r.y + pad;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const l = sim.loop;
  for (const row of built.rows) {
    if (y > r.y + r.h - 6) break;
    if (row.kind === 'gap') { y += row.h; continue; }
    if (row.kind === 'head') {
      const lh = Math.round(row.px * 1.45);
      let room = w;
      if (row.chip) {
        ctx.font = font(L.font.chip, 800);
        const cw = ctx.measureText(row.chip).width + 12 * k;
        if (cw < w * 0.5) {
          room = w - cw - 6 * k;
          rr(ctx, r.x + r.w - pad - cw, y + 1, cw, lh - 4, (lh - 4) / 2);
          ctx.fillStyle = built.chipOn || hover ? 'rgba(255,210,122,.34)' : 'rgba(255,210,122,.16)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,210,122,.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = built.chipOn ? GOLD_HI : GOLD;
          ctx.textBaseline = 'middle';
          ctx.fillText(row.chip, r.x + r.w - pad - cw + 6 * k, y + 1 + (lh - 4) / 2);
          ctx.textBaseline = 'top';
        }
      }
      const size = fitFont(ctx, row.text, room, row.px, MIN_TEXT, 600);
      ctx.font = font(size, 600);
      ctx.fillStyle = 'rgba(214,232,255,.72)';
      ctx.fillText(row.text, r.x + pad, y + (lh - size) / 2);
      y += lh;
      continue;
    }
    if (row.kind === 'text') {
      ctx.font = font(row.px, row.weight, row.serif, row.italic);
      let lines = wrap(ctx, row.text, w);
      const max = row.lines ?? 3;
      if (lines.length > max) {
        lines = lines.slice(0, max);
        lines[max - 1] = `${lines[max - 1].replace(/[\s,;:.]+$/, '')}…`;
      }
      const lh = Math.round(row.px * 1.3);
      ctx.fillStyle = row.color;
      for (const line of lines) {
        const size = fitFont(ctx, line, w, row.px, MIN_TEXT, row.weight, row.serif, row.italic);
        ctx.font = font(size, row.weight, row.serif, row.italic);
        ctx.fillText(line, r.x + pad, y + (lh - size) / 2);
        y += lh;
      }
      continue;
    }
    if (row.kind === 'gauge' && l) {
      drawGauge(ctx, r.x + pad, y + 3 * k, w, row.h - 6 * k, sim);
    } else if (row.kind === 'curve' && l) {
      drawCurve(ctx, r.x + pad, y + 2 * k, w, row.h - 4 * k, sim, now, k);
    } else if (row.kind === 'dots') {
      drawDots(ctx, r.x + pad, y + 2 * k, w, row.h - 4 * k, sim);
    }
    y += row.h;
  }
  ctx.restore();
}

/** The loop's gauge: the healthy range as a bright field, the set point's tick, the value as a dot. */
function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sim: SwiatloSim): void {
  const l = sim.loop!;
  const span = 3;   // half-ranges either side shown
  const px = (d: number) => x + w * (0.5 + clamp(d, -span, span) / (2 * span));
  rr(ctx, x, y + h * 0.25, w, h * 0.5, h * 0.25);
  ctx.fillStyle = 'rgba(255,255,255,.08)';
  ctx.fill();
  const a = px(-1), b = px(1);
  rr(ctx, a, y + h * 0.15, b - a, h * 0.7, h * 0.3);
  ctx.fillStyle = l.settled ? 'rgba(150,240,190,.35)' : 'rgba(150,240,190,.22)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(px(0) - 0.75, y, 1.5, h);
  const d = loopDev(l);
  const dx = px(d), dy = y + h / 2;
  ctx.fillStyle = l.settled ? '#b9f5d0' : '#ffcf9e';
  ctx.beginPath();
  ctx.arc(dx, dy, h * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** Cortisol's day curve: the typical shape, "now" at the device's hour, the loop's rise above it. */
function drawCurve(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sim: SwiatloSim, now: number, k = 1): void {
  const l = sim.loop!;
  ctx.strokeStyle = 'rgba(255,227,154,.55)';
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const hr = i / 2, v = cortisolCurve(hr);
    const px = x + (w * i) / 48, py = y + h - v * h * 0.85;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  const hr = sim.hour + now / 3600;
  const nx = x + (w * ((hr % 24) + 24) % 24) / 24;
  const base = cortisolCurve(hr);
  const lift = Math.max(0, loopValue(l) - 1);
  const ny = y + h - Math.min(1.15, base * (1 + lift)) * h * 0.85;
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(nx - 0.75 * k, y, 1.5 * k, h);
  ctx.fillStyle = l.settled ? '#b9f5d0' : '#ffcf9e';
  ctx.beginPath();
  ctx.arc(nx, ny, 4.5 * k, 0, Math.PI * 2);
  ctx.fill();
}

/** The scan's nine organs as dots, lit in their colours. */
function drawDots(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sim: SwiatloSim): void {
  const n = ORGANS.length, gap = w / n, r = Math.min(h / 2, gap * 0.32);
  ORGANS.forEach((o, i) => {
    const cx = x + gap * (i + 0.5), cy = y + h / 2, lit = sim.lit[o];
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = lit > 0 ? ORGAN[o].hue : 'rgba(255,255,255,.14)';
    ctx.fill();
    if (lit >= 3) {
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// ── Zofia's bubble ───────────────────────────────────────────────
export interface BubbleBox { rect: Rect; lines: string[]; px: number; k: number; name: number }

export function bubbleBox(ctx: CanvasRenderingContext2D, L: Layout, text: string, bandY: number): BubbleBox {
  const px = Math.max(MIN_READ, L.font.bubble);
  const k = L.k, pad = padOf(L);
  const w = L.bubble.w;
  ctx.font = font(px, 600);
  const lines = wrap(ctx, text, w - 2 * pad - 30 * k).slice(0, 5);
  const h = pad * 2 + 16 * k + lines.length * Math.round(px * 1.3);
  return { rect: bubbleRect(L, bandY, h), lines, px, k, name: L.font.chip };
}

export function drawBubble(ctx: CanvasRenderingContext2D, box: BubbleBox, a0: number): void {
  const { rect: r, lines, px, k } = box;
  const pad = Math.round(PAD * k);
  const a = clamp(a0);
  ctx.save();
  ctx.globalAlpha = a;
  const pop = 0.94 + 0.06 * ease.outBack(clamp(a0 * 1.6));
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(pop, pop);
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  rr(ctx, r.x, r.y, r.w, r.h, 16 * k);
  ctx.fillStyle = 'rgba(250,246,236,.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Zofia's medallion: a gold ring with her initial
  const mx = r.x + pad + 10 * k, my = r.y + pad + 10 * k;
  ctx.beginPath();
  ctx.arc(mx, my, 11 * k, 0, Math.PI * 2);
  ctx.fillStyle = '#20305a';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(13 * k, 800, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Z', mx, my + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#8a6a2a';
  ctx.font = font(box.name, 800);
  ctx.fillText(t('hud.zofia'), r.x + pad + 28 * k, r.y + pad + 3 * k);
  ctx.fillStyle = '#1d2440';
  ctx.font = font(px, 600);
  const lh = Math.round(px * 1.3);
  lines.forEach((line, i) => ctx.fillText(line, r.x + pad + 28 * k, r.y + pad + 18 * k + i * lh));
  ctx.restore();
}

// ── the round help button ────────────────────────────────────────
export type ButtonKind = 'help' | 'beat' | 'co2' | 'breath';

export function buttonKind(sim: SwiatloSim): ButtonKind {
  if (sim.restBlock) return 'breath';
  const l = sim.loop;
  if (l && !l.settled) {
    const task = ORGAN[l.organ].task;
    if (task === 'beat') return 'beat';
    if (task === 'bubbles') return 'co2';
  }
  return 'help';
}

/** The round button, its caption and (on a desk) its key's name; `hover` rings it (a mouse over it). */
export function drawButton(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, pressed: number, now: number, hover = false): void {
  const { x, y, r } = L.button;
  const kind = buttonKind(sim);
  const s = 1 - 0.08 * pressed;
  const gold = sim.goldOn;
  const q = r / 30;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // a halo that breathes (in rest) or beats (at the heart)
  let pulse = 0;
  if (kind === 'breath') pulse = sim.breath.k;
  else if (kind === 'beat') pulse = Math.max(0, 1 - sim.sinceBeat / 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r + (4 + 6 * pulse) * (L.shape === 'desk' ? q : 1), 0, Math.PI * 2);
  ctx.fillStyle = kind === 'breath' ? `rgba(169,184,255,${(0.12 + 0.18 * pulse).toFixed(3)})` : `rgba(143,214,232,${(0.1 + 0.2 * pulse).toFixed(3)})`;
  ctx.fill();
  if (hover) {
    ctx.beginPath();
    ctx.arc(0, 0, r + 3.5 * q, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(233,251,255,.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, gold ? '#fff2cc' : '#dff7ff');
  g.addColorStop(0.45, gold ? '#e6b45e' : hover ? '#6cbadf' : '#5aa9cf');
  g.addColorStop(1, gold ? '#8a5a1e' : '#1e4c7c');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // the icon
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 2.2 * (L.shape === 'desk' ? q : 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const k = q;
  if (kind === 'beat') {
    const b = 1 + 0.12 * pulse;
    ctx.save();
    ctx.scale(k * b, k * b);
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-16, 0, -12, -14, 0, -6);
    ctx.bezierCurveTo(12, -14, 16, 0, 0, 10);
    ctx.fill();
    ctx.restore();
  } else if (kind === 'co2') {
    for (const [bx, by, br] of [[-7, 6, 5], [5, -1, 6.5], [-3, -12, 4]] as const) {
      ctx.beginPath();
      ctx.arc(bx * k, (by - 2 * Math.sin(now * 2 + bx)) * k, br * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (kind === 'breath') {
    const rr2 = (6 + 8 * sim.breath.k) * k;
    ctx.beginPath();
    ctx.arc(0, 0, rr2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3 * k, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // a four-pointed spark of light
    ctx.save();
    ctx.scale(k, k);
    ctx.rotate(now * 0.4);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, rad = i % 2 === 0 ? 13 : 4;
      const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // the caption under it
  const cap = t(kind === 'beat' ? 'hud.beat' : kind === 'co2' ? 'hud.co2' : kind === 'breath' ? 'hud.breath' : 'hud.help');
  const size = fitFont(ctx, cap, L.buttonHit.w + 8 * L.k, L.font.caption, MIN_READ, 700);
  ctx.font = font(size, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  const cy = y + r + 6 * (L.shape === 'desk' ? q : 1);
  ctx.strokeText(cap, x, cy);
  ctx.fillStyle = ICE;
  ctx.fillText(cap, x, cy);
  // a desk: the key's name under the caption, as a key cap
  if (L.keys) drawKey(ctx, t('hud.key.space'), x, cy + Math.round(L.font.caption * 1.4), L.font.key, L.k);
}

/** A key's name in a little key cap, centred on x, its top at y. */
export function drawKey(ctx: CanvasRenderingContext2D, name: string, x: number, y: number, px: number, k = 1): void {
  ctx.save();
  ctx.font = font(px, 700);
  const w = ctx.measureText(name).width + 14 * k, h = px + 8 * k;
  rr(ctx, x - w / 2, y, w, h, 5 * k);
  ctx.fillStyle = 'rgba(10,18,42,.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(214,232,255,.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(233,251,255,.88)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, x, y + h / 2 + 0.5);
  ctx.restore();
}

// ── the sing-along line ──────────────────────────────────────────
export function drawLine(ctx: CanvasRenderingContext2D, L: Layout, line: { text: string; next?: string | null; p: number } | null, alpha: number): void {
  if (!line || alpha <= 0.01) return;
  if (L.shape === 'desk') {
    drawDeskLine(ctx, L, line, alpha);
    return;
  }
  const r = L.line;
  const px = fitFont(ctx, `♪ ${line.text}`, r.w, L.font.line, MIN_READ, 500, true, true);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = font(px, 500, true, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const text = `♪ ${line.text}`;
  const tw = ctx.measureText(text).width;
  const x0 = r.x + r.w / 2 - tw / 2, y = r.y + r.h / 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5,8,22,.7)';
  ctx.strokeText(text, r.x + r.w / 2, y);
  ctx.fillStyle = 'rgba(214,232,255,.62)';
  ctx.fillText(text, r.x + r.w / 2, y);
  // the part already sung, brighter
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, r.y, tw * clamp(line.p), r.h);
  ctx.clip();
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(text, r.x + r.w / 2, y);
  ctx.restore();
  ctx.restore();
}

/** A desk's song beside the scene: the sung line (gold as it is sung) and the next one under it, quieter. */
function drawDeskLine(ctx: CanvasRenderingContext2D, L: Layout, line: { text: string; next?: string | null; p: number }, alpha: number): void {
  const r = L.line;
  const lh = Math.round(L.font.line * 1.4);
  const text = `♪ ${line.text}`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const px = fitFont(ctx, text, r.w, L.font.line, MIN_READ, 500, true, true);
  ctx.font = font(px, 500, true, true);
  const tw = ctx.measureText(text).width;
  const y = r.y + lh / 2;
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5,8,22,.7)';
  ctx.strokeText(text, r.x, y);
  ctx.fillStyle = 'rgba(214,232,255,.66)';
  ctx.fillText(text, r.x, y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, tw * clamp(line.p), lh);
  ctx.clip();
  ctx.fillStyle = GOLD_HI;
  ctx.fillText(text, r.x, y);
  ctx.restore();
  if (line.next) {
    const indent = ctx.measureText('♪ ').width;
    const npx = fitFont(ctx, line.next, r.w - indent, Math.max(MIN_READ, L.font.line * 0.92), MIN_READ, 500, true, true);
    ctx.font = font(npx, 500, true, true);
    ctx.globalAlpha = alpha * 0.55;
    ctx.fillStyle = 'rgba(214,232,255,.8)';
    ctx.fillText(line.next, r.x + indent, y + lh);
  }
  ctx.restore();
}

// ── a hovered organ's tag (a desk's mouse) ──────────────────────
/** What a mouse over an organ reads: its name and its state now, with what a click does there. */
export function hoverText(sim: SwiatloSim, o: OrganId): { title: string; sub: string } {
  const l = sim.loop;
  let sub: string;
  if (l && l.organ === o) {
    if (sim.restBlock) sub = t('hover.breath');
    else if (l.settled && !sim.card) sub = t('hover.card');
    else sub = l.settled ? t('hover.lit', { stars: stars(l.rating) }) : t('hover.here');
  } else if (sim.lit[o] > 0) sub = t('hover.lit', { stars: stars(sim.lit[o]) });
  else sub = t('hover.wait');
  return { title: organName(o), sub };
}

/** The tag beside a hovered organ: right of (x, y), or left of it where the canvas ends. */
export function drawTag(ctx: CanvasRenderingContext2D, L: Layout, x: number, y: number, gap: number, title: string, sub: string, hue: string): void {
  const k = L.k, pad = Math.round(8 * k);
  ctx.save();
  ctx.font = font(L.font.tag, 800);
  const tw = ctx.measureText(title).width;
  ctx.font = font(L.font.note, 600);
  const sw = ctx.measureText(sub).width;
  const w = Math.max(tw, sw) + 2 * pad, h = pad * 2 + Math.round(L.font.tag * 1.25) + Math.round(L.font.note * 1.3);
  let bx = x + gap;
  if (bx + w > L.right - 8) bx = x - gap - w;
  const by = clamp(y - h / 2, L.top + 4, L.bottom - h - 4);
  rr(ctx, bx, by, w, h, 10 * k);
  ctx.fillStyle = 'rgba(8,14,34,.88)';
  ctx.fill();
  ctx.strokeStyle = `${rgbaPrefix(hue)}.7)`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = font(L.font.tag, 800);
  ctx.fillStyle = mix(hue, '#ffffff', 0.35);
  ctx.fillText(title, bx + pad, by + pad);
  ctx.font = font(L.font.note, 600);
  ctx.fillStyle = 'rgba(214,232,255,.8)';
  ctx.fillText(sub, bx + pad, by + pad + Math.round(L.font.tag * 1.25));
  ctx.restore();
}

// ── the story cards ──────────────────────────────────────────────
export function drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim): Rect | null {
  const s = sim.story;
  if (!s) return null;
  const u = L.u, inner = Math.min(L.story.w, 560 * u) - 2 * 18;
  const title = s.kind === 'open' ? t('story.open.title') : t('story.scan.title');
  let text: string;
  if (s.kind === 'open') text = t('story.open.text');
  else {
    const starText = stars(s.stars);
    text = s.deeper && s.next ? t('story.scan.deeper', { n: s.scan, stars: starText, depth: depthName(s.next) }) : t('story.scan.again', { n: s.scan, stars: starText });
    if (s.deeper && s.next && s.next >= 2) text = `${text} ${t(s.next === 2 ? 'story.depth.2' : 'story.depth.3')}`;
  }
  const titlePx = fitFont(ctx, title, inner, 26 * u, 18, 700, true);
  const textPx = Math.max(MIN_READ, Math.round(15 * u));
  ctx.font = font(textPx, 500);
  const lines = wrap(ctx, text, inner);
  const verseH = s.kind === 'open' ? Math.min(150 * u, L.story.h * 0.34) : 0;
  const lay = s.kind === 'open' ? layoutPassage(ctx, passage('mat6.22'), inner, verseH, { max: Math.round(16 * u), min: 12 }) : null;
  const tapPx = Math.round(13 * L.k);
  const h = 18 + titlePx * 1.3 + 8 + lines.length * Math.round(textPx * 1.35) + (lay ? 12 + lay.height : 0) + 14 + tapPx * 1.4 + 14;
  const r = storyRect(L, h);
  const k = ease.outCubic(clamp(s.t / 0.35));
  ctx.save();
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(4,7,20,.55)';
  ctx.fillRect(0, L.top, L.w, L.bottom - L.top);
  rr(ctx, r.x, r.y, r.w, r.h, 18);
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, 'rgba(24,36,72,.97)');
  g.addColorStop(1, 'rgba(12,18,42,.97)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,.75)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  let y = r.y + 18;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(titlePx, 700, true);
  ctx.fillText(title, cx, y);
  y += titlePx * 1.3 + 8;
  ctx.fillStyle = ICE;
  ctx.font = font(textPx, 500);
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += Math.round(textPx * 1.35);
  }
  if (lay) {
    y += 12;
    drawPassage(ctx, passage('mat6.22'), lay, cx, y, { text: '#f6e7c4', ref: 'rgba(255,226,170,.75)' });
    y += lay.height;
  }
  y += 14;
  ctx.fillStyle = 'rgba(214,232,255,.7)';
  ctx.font = font(tapPx, 600);
  ctx.fillText(L.touch ? t(s.kind === 'open' ? 'story.tap' : 'story.next') : t('story.tap.keys'), cx, y);
  ctx.restore();
  return r;
}

/** A gentle number that rises from what earned it ("+36 lx"). */
export const luxFloat = (n: number): string => `+${fmtNum(n)} lx`;

/** The colour of the band now: ice → gold above the threshold, violet in rest, silver when blind. */
export function bandColor(sim: SwiatloSim): { core: string; hex: string; k: number } {
  if (sim.restBlock) return { core: REST, hex: REST, k: 0 };
  if (sim.blind) return { core: '#c8d0e0', hex: '#c8d0e0', k: 0 };
  const k = sim.sighted && sim.reliable ? clamp((sim.light - 0.44) / 0.12) : 0;
  return { core: mix(ICE, GOLD, k), hex: k > 0.5 ? GOLD : ICE, k };
}
