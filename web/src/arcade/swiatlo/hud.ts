/**
 * Światło ciała's own HUD on the canvas (the runner draws the standard one: the Mendi panel, the score,
 * the coach marks): the organ's panel at the band's height — its name, the everyday push, the value on a
 * gauge with its healthy range, what the body does — which turns into the Wiedza card when tapped (or
 * the first time an organ settles); in rest, the vagus' rest with the breath and the pulse; Zofia's
 * bubble at the end of its column away from the band; the round help button in the thumb zone; the
 * sing-along line under the HUD; the story cards.  Every text is fitted with a floor (never under 11 px;
 * what the player reads to play, 13 px and more).
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage } from '../kit/scripture';
import {
  ORGAN, ORGANS, cortisolCurve, depthName, factSource, factText, fixText, kickText, organName, organWhat, rangeText, valueText,
} from './content';
import { t } from './i18n';
import { type Layout, type Rect, bubbleRect, panelRect, storyRect } from './layout';
import { CYAN, GOLD, GOLD_HI, ICE, INK, REST, fitFont, font, mix, rgbaPrefix, rr, stars, wrap } from './paint';
import { RULES } from './rules';
import { loopDev, loopValue, type SwiatloSim } from './sim';

const PAD = 12;

type Row =
  | { kind: 'text'; text: string; px: number; weight: number; color: string; italic?: boolean; serif?: boolean; lines?: number }
  | { kind: 'head'; text: string; chip: string | null; px: number }
  | { kind: 'gauge'; h: number }
  | { kind: 'curve'; h: number }
  | { kind: 'dots'; h: number }
  | { kind: 'gap'; h: number };

interface Built { rows: Row[]; h: number; card: boolean; fresh: boolean; accent: string }

/** Lay rows out in a width: wrapped texts' line counts, the total height. */
function measure(ctx: CanvasRenderingContext2D, rows: Row[], w: number): number {
  let h = PAD * 2;
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

/** What the panel shows now (the loop, the way on, the rest, or a Wiedza card). */
function panelRows(sim: SwiatloSim, L: Layout): Built {
  const f = L.font, rows: Row[] = [];
  const muted = 'rgba(214,232,255,.72)';
  const card = sim.card;
  if (card) {
    const o = card.organ, d = card.depth;
    rows.push({ kind: 'text', text: `${t('hud.knowledge')} · ${organName(o)} · ${depthName(d)}`, px: f.small, weight: 700, color: GOLD, lines: 2 });
    rows.push({ kind: 'gap', h: 4 });
    rows.push({ kind: 'text', text: factText(o, d), px: Math.max(MIN_READ, f.bubble), weight: 600, color: ICE, lines: 7 });
    rows.push({ kind: 'gap', h: 4 });
    rows.push({ kind: 'text', text: t('hud.source', { s: factSource(o, d) }), px: 12, weight: 500, color: muted, lines: 3 });
    return { rows, h: 0, card: true, fresh: card.fresh, accent: ORGAN[o].hue };
  }
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
    return { rows, h: 0, card: false, fresh: false, accent: REST };
  }
  const l = sim.loop;
  if (!l) {
    const o = sim.target;
    rows.push({ kind: 'head', text: scanLine, chip: null, px: f.small });
    rows.push({ kind: 'text', text: t('hud.next', { organ: o ? organName(o) : t('hud.feet') }), px: f.name, weight: 800, color: ICE, lines: 2 });
    if (o) rows.push({ kind: 'text', text: organWhat(o), px: f.text, weight: 500, color: muted, lines: 2 });
    rows.push({ kind: 'dots', h: 18 });
    return { rows, h: 0, card: false, fresh: false, accent: CYAN };
  }
  const o = l.organ, spec = ORGAN[o];
  rows.push({ kind: 'head', text: scanLine, chip: `${t('hud.knowledge')} ›`, px: f.small });
  rows.push({ kind: 'text', text: organName(o), px: f.name, weight: 800, color: spec.hue, lines: 2 });
  rows.push({ kind: 'text', text: organWhat(o), px: f.text, weight: 500, color: muted, lines: 2 });
  rows.push({ kind: 'text', text: kickText(o, l.kick), px: Math.max(MIN_READ, f.small), weight: 600, color: '#ffcf9e', italic: true, lines: 2 });
  const v = valueText(spec, loopValue(l));
  if (spec.kind === 'curve') rows.push({ kind: 'curve', h: 40 });
  else if (v) rows.push({ kind: 'text', text: v, px: f.value, weight: 800, color: l.settled ? '#b9f5d0' : '#ffd6a0', lines: 1 });
  rows.push({ kind: 'gauge', h: 16 });
  rows.push({ kind: 'text', text: l.balanced ? `${t('hud.inBalance')} ${stars(l.rating)}` : rangeText(spec), px: Math.max(MIN_READ, f.small), weight: 600, color: l.balanced ? GOLD_HI : muted, lines: 1 });
  rows.push({ kind: 'text', text: fixText(o, l.kick), px: f.text, weight: 600, color: ICE, lines: 3 });
  if (o === 'heart') {
    if (sim.pulse !== null) rows.push({ kind: 'text', text: pulseText(sim), px: f.text, weight: 700, color: '#ffc2cf', lines: 1 });
    else rows.push({ kind: 'text', text: pulseText(sim), px: Math.max(MIN_READ, f.small), weight: 500, color: muted, lines: 2 });
  }
  rows.push({ kind: 'text', text: t('hud.typicalBody'), px: 12, weight: 500, color: 'rgba(214,232,255,.58)', lines: 2 });
  return { rows, h: 0, card: false, fresh: false, accent: spec.hue };
}

/** The panel's rectangle for this frame (null while a story is up). */
export function panelBox(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, bandY: number): { rect: Rect; built: Built } | null {
  if (sim.story || !sim.started) return null;
  const built = panelRows(sim, L);
  const h = measure(ctx, built.rows, L.panel.w - 2 * PAD);
  built.h = h;
  return { rect: panelRect(L, bandY, h), built };
}

export function drawPanel(ctx: CanvasRenderingContext2D, sim: SwiatloSim, box: { rect: Rect; built: Built }, now: number, pressed: number): void {
  const { rect: r, built } = box;
  const press = pressed > 0 ? 1 - 0.03 * pressed : 1;
  ctx.save();
  if (press !== 1) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(press, press);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  // the glass card
  rr(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.fillStyle = built.card ? 'rgba(28,24,46,.9)' : 'rgba(10,18,42,.78)';
  ctx.fill();
  ctx.lineWidth = built.card && built.fresh ? 2 : 1.2;
  ctx.strokeStyle = built.card ? (built.fresh ? GOLD : 'rgba(255,210,122,.55)') : `${rgbaPrefix(built.accent.startsWith('#') ? built.accent : CYAN)}.5)`;
  ctx.stroke();
  // a thin accent along the top edge
  ctx.fillStyle = `${rgbaPrefix(built.accent.startsWith('#') ? built.accent : CYAN)}.55)`;
  rr(ctx, r.x + 12, r.y + 3, r.w - 24, 2, 1);
  ctx.fill();
  const w = r.w - 2 * PAD;
  let y = r.y + PAD;
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
        ctx.font = font(12, 800);
        const cw = ctx.measureText(row.chip).width + 12;
        if (cw < w * 0.5) {
          room = w - cw - 6;
          rr(ctx, r.x + r.w - PAD - cw, y + 1, cw, lh - 4, (lh - 4) / 2);
          ctx.fillStyle = 'rgba(255,210,122,.16)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,210,122,.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = GOLD;
          ctx.textBaseline = 'middle';
          ctx.fillText(row.chip, r.x + r.w - PAD - cw + 6, y + 1 + (lh - 4) / 2);
          ctx.textBaseline = 'top';
        }
      }
      const size = fitFont(ctx, row.text, room, row.px, MIN_TEXT, 600);
      ctx.font = font(size, 600);
      ctx.fillStyle = 'rgba(214,232,255,.72)';
      ctx.fillText(row.text, r.x + PAD, y + (lh - size) / 2);
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
        ctx.fillText(line, r.x + PAD, y + (lh - size) / 2);
        y += lh;
      }
      continue;
    }
    if (row.kind === 'gauge' && l) {
      drawGauge(ctx, r.x + PAD, y + 3, w, row.h - 6, sim);
    } else if (row.kind === 'curve' && l) {
      drawCurve(ctx, r.x + PAD, y + 2, w, row.h - 4, sim, now);
    } else if (row.kind === 'dots') {
      drawDots(ctx, r.x + PAD, y + 2, w, row.h - 4, sim);
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
function drawCurve(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sim: SwiatloSim, now: number): void {
  const l = sim.loop!;
  ctx.strokeStyle = 'rgba(255,227,154,.55)';
  ctx.lineWidth = 1.5;
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
  ctx.fillRect(nx - 0.75, y, 1.5, h);
  ctx.fillStyle = l.settled ? '#b9f5d0' : '#ffcf9e';
  ctx.beginPath();
  ctx.arc(nx, ny, 4.5, 0, Math.PI * 2);
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
export function bubbleBox(ctx: CanvasRenderingContext2D, L: Layout, text: string, bandY: number): { rect: Rect; lines: string[]; px: number } {
  const px = Math.max(MIN_READ, L.font.bubble);
  const w = L.bubble.w;
  ctx.font = font(px, 600);
  const lines = wrap(ctx, text, w - 2 * PAD - 30).slice(0, 5);
  const h = PAD * 2 + 16 + lines.length * Math.round(px * 1.3);
  return { rect: bubbleRect(L, bandY, h), lines, px };
}

export function drawBubble(ctx: CanvasRenderingContext2D, box: { rect: Rect; lines: string[]; px: number }, k: number): void {
  const { rect: r, lines, px } = box;
  const a = clamp(k);
  ctx.save();
  ctx.globalAlpha = a;
  const pop = 0.94 + 0.06 * ease.outBack(clamp(k * 1.6));
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  ctx.scale(pop, pop);
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  rr(ctx, r.x, r.y, r.w, r.h, 16);
  ctx.fillStyle = 'rgba(250,246,236,.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,.8)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Zofia's medallion: a gold ring with her initial
  const mx = r.x + PAD + 10, my = r.y + PAD + 10;
  ctx.beginPath();
  ctx.arc(mx, my, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#20305a';
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = GOLD_HI;
  ctx.font = font(13, 800, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Z', mx, my + 0.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#8a6a2a';
  ctx.font = font(12, 800);
  ctx.fillText(t('hud.zofia'), r.x + PAD + 28, r.y + PAD + 3);
  ctx.fillStyle = '#1d2440';
  ctx.font = font(px, 600);
  const lh = Math.round(px * 1.3);
  lines.forEach((line, i) => ctx.fillText(line, r.x + PAD + 28, r.y + PAD + 18 + i * lh));
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

export function drawButton(ctx: CanvasRenderingContext2D, L: Layout, sim: SwiatloSim, pressed: number, now: number): void {
  const { x, y, r } = L.button;
  const kind = buttonKind(sim);
  const s = 1 - 0.08 * pressed;
  const gold = sim.goldOn;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // a halo that breathes (in rest) or beats (at the heart)
  let pulse = 0;
  if (kind === 'breath') pulse = sim.breath.k;
  else if (kind === 'beat') pulse = Math.max(0, 1 - sim.sinceBeat / 0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r + 4 + 6 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = kind === 'breath' ? `rgba(169,184,255,${(0.12 + 0.18 * pulse).toFixed(3)})` : `rgba(143,214,232,${(0.1 + 0.2 * pulse).toFixed(3)})`;
  ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, gold ? '#fff2cc' : '#dff7ff');
  g.addColorStop(0.45, gold ? '#e6b45e' : '#5aa9cf');
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
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const k = r / 30;
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
  const size = fitFont(ctx, cap, L.buttonHit.w + 8, L.font.caption, MIN_READ, 700);
  ctx.font = font(size, 700);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.strokeText(cap, x, y + r + 6);
  ctx.fillStyle = ICE;
  ctx.fillText(cap, x, y + r + 6);
}

// ── the sing-along line ──────────────────────────────────────────
export function drawLine(ctx: CanvasRenderingContext2D, L: Layout, line: { text: string; p: number } | null, alpha: number): void {
  if (!line || alpha <= 0.01) return;
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
  const tapPx = 13;
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
export const luxFloat = (n: number): string => `+${fmtNum(n)} lx`;

/** The colour of the band now: ice → gold above the threshold, violet in rest, silver when blind. */
export function bandColor(sim: SwiatloSim): { core: string; hex: string; k: number } {
  if (sim.restBlock) return { core: REST, hex: REST, k: 0 };
  if (sim.blind) return { core: '#c8d0e0', hex: '#c8d0e0', k: 0 };
  const k = sim.sighted && sim.reliable ? clamp((sim.light - 0.44) / 0.12) : 0;
  return { core: mix(ICE, GOLD, k), hex: k > 0.5 ? GOLD : ICE, k };
}

