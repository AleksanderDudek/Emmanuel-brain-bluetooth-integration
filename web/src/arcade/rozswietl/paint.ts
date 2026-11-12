/**
 * Rozświetl's small painting helpers for the play view: fonts with the 11 px floor, baked glow sprites
 * (light that feels like light without shadowBlur: radial gradients drawn once, added with "lighter"),
 * the firefly, its bubble, and the cards.  Palette: the night's ink and ash, the light's honey and gold.
 */
import { MIN_READ, MIN_TEXT, fitText } from '../kit/mobile';
import { REF_FONT, VERSE_FONT, drawPassage, layoutPassage, passage, wrapLines, type PassageId, type PassageLayout } from '../kit/scripture';
import type { Rect } from './layout';

export const SANS = REF_FONT;
export const SERIF = VERSE_FONT;
export const TAU = Math.PI * 2;

export const C = {
  wall: '#0b0d14', wall2: '#141826', ink: '#0e1018', gold: '#f6c35c', goldHi: '#fff1c4', honey: '#ffd98a', light: '#fff6d8',
  glass: 'rgba(14,16,26,.86)', glassLine: 'rgba(246,195,92,.42)', text: '#fff6e6', text2: '#d9cfbd', muted: '#a8a2b6', cool: '#9fb4dc',
};

/** A canvas font of `px` (never under the 11 px floor). */
export function font(px: number, weight = 600, family = SANS): string {
  return `${weight} ${Math.max(MIN_TEXT, Math.round(px * 10) / 10)}px ${family}`;
}

/** The size `font()` would use for `px`: never under MIN_TEXT. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, px);

// ── sprites ──────────────────────────────────────────────────────

const sprites = new Map<string, HTMLCanvasElement>();

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** A soft round glow of a colour (#rrggbb), 128 px, white-hot at the centre: draw it scaled with "lighter". */
export function glowSprite(color: string, core = 0.9): HTMLCanvasElement {
  const key = `g${color}${core}`;
  let s = sprites.get(key);
  if (s) return s;
  s = canvas(128, 128);
  const ctx = s.getContext('2d')!;
  const v = parseInt(color.slice(1), 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(255,255,255,${core})`);
  gr.addColorStop(0.12, `rgba(${r},${g},${b},${0.8 * core})`);
  gr.addColorStop(0.4, `rgba(${r},${g},${b},0.28)`);
  gr.addColorStop(0.7, `rgba(${r},${g},${b},0.08)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  sprites.set(key, s);
  return s;
}

/** Draw a glow sprite centred at (x, y) with radius r. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a = 1): void {
  if (r <= 0.5 || a <= 0.01) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

// ── the firefly ──────────────────────────────────────────────────

export interface FlyLook {
  t: number;
  /** its glow 0..1 (the breath in a rest block, a gentle pulse elsewhere) */
  glow: number;
  /** the flare's charge 0..1, and ready */
  charge: number;
  ready: boolean;
  /** talking now (it bobs) */
  talk: boolean;
  /** quiet while a blind block hides the light */
  dim: boolean;
}

/** The firefly: a small dark body, two quick wings, the lantern at its tail, the flare's ring around it. */
export function paintFly(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, f: FlyLook): void {
  const bob = Math.sin(f.t * 2.1) * r * 0.25 + (f.talk ? Math.sin(f.t * 9) * r * 0.08 : 0);
  const cy = y + bob;
  // the light it carries
  ctx.globalCompositeOperation = 'lighter';
  const lit = f.dim ? 0.35 : 0.55 + 0.45 * f.glow;
  glow(ctx, x - r * 0.55, cy + r * 0.25, r * (3.2 + 2.4 * f.glow + (f.ready ? 1.6 : 0)), '#d9ff7a', lit * 0.55);
  glow(ctx, x - r * 0.55, cy + r * 0.25, r * 1.4, '#f4ffb0', lit);
  ctx.globalCompositeOperation = 'source-over';
  // the flare's ring: gold filling around it, bright when full
  if (f.charge > 0.01) {
    const rr = r * 2.3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(246,195,92,.22)';
    ctx.lineWidth = Math.max(2, r * 0.32);
    ctx.beginPath();
    ctx.arc(x, cy, rr, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = f.ready ? C.goldHi : C.gold;
    ctx.lineWidth = Math.max(2, r * (f.ready ? 0.46 : 0.34));
    ctx.beginPath();
    ctx.arc(x, cy, rr, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, f.charge));
    ctx.stroke();
    if (f.ready) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, cy, rr * 1.9, '#ffd98a', 0.5 + 0.3 * Math.sin(f.t * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  // wings
  const flap = Math.sin(f.t * 34) * 0.5 + 0.5;
  ctx.fillStyle = 'rgba(220,235,255,.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + r * 0.15, cy - r * (0.55 + 0.25 * flap), r * 0.75, r * (0.28 + 0.12 * flap), s * (0.6 + 0.35 * flap), 0, TAU);
    ctx.fill();
  }
  // body, head, the lantern
  ctx.fillStyle = '#2a2230';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.15, cy, r * 0.7, r * 0.42, -0.15, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2a38';
  ctx.beginPath();
  ctx.arc(x + r * 0.85, cy - r * 0.12, r * 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = f.dim ? '#c9d98a' : '#f4ffb0';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.55, cy + r * 0.2, r * 0.42, r * 0.36, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3a2a38';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(x + r * 1.05, cy - r * 0.3);
  ctx.quadraticCurveTo(x + r * 1.35, cy - r * 0.75, x + r * 1.55, cy - r * 0.7);
  ctx.stroke();
}

// ── the bubble ───────────────────────────────────────────────────

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export interface BubbleBox { x: number; y: number; w: number; h: number; lines: string[]; size: number }

/** Lay out a bubble's text (14 px, two or three lines) above (x, y), inside `bounds`. */
export function bubbleBox(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, bounds: Rect, u = 1): BubbleBox {
  const size = Math.max(MIN_READ + 1, 14 * u);
  ctx.font = font(size, 600);
  const pad = 10 * u;
  let lines = wrapLines(ctx, text, maxW - 2 * pad);
  if (lines.length > 4) lines = lines.slice(0, 4);
  const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 2 * pad);
  const lh = Math.round(size * 1.3);
  const h = lines.length * lh + 2 * pad - (lh - size);
  const bx = Math.min(Math.max(bounds.x + 4, x - 24 * u), bounds.x + bounds.w - w - 4);
  const by = Math.max(bounds.y + 4, y - h - 14 * u);
  return { x: bx, y: by, w, h, lines, size };
}

/** Draw the bubble with a tail toward (tx, ty); `a` its fade. */
export function paintBubble(ctx: CanvasRenderingContext2D, b: BubbleBox, tx: number, ty: number, a: number, u = 1): void {
  if (a <= 0.01) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = C.glass;
  roundRect(ctx, b.x, b.y, b.w, b.h, 12 * u);
  ctx.fill();
  // the tail
  const bx = Math.min(Math.max(tx, b.x + 16 * u), b.x + b.w - 16 * u);
  ctx.beginPath();
  ctx.moveTo(bx - 7 * u, b.y + b.h - 1);
  ctx.lineTo(tx + (bx - tx) * 0.3, Math.min(ty - 6 * u, b.y + b.h + 12 * u));
  ctx.lineTo(bx + 7 * u, b.y + b.h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.glassLine;
  ctx.lineWidth = 1;
  roundRect(ctx, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 12 * u);
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.font = font(b.size, 600);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lh = Math.round(b.size * 1.3);
  const pad = 10 * u;
  b.lines.forEach((l, i) => ctx.fillText(l, b.x + pad, b.y + pad + i * lh));
  ctx.globalAlpha = 1;
}

// ── cards ────────────────────────────────────────────────────────

export interface CardText {
  kicker: string;
  title: string;
  /** a paragraph under the title (the opening card), or a short line (the gold) */
  text: string | null;
  verse: PassageId;
  hint: string;
}

/** A card's layout, computed once per card and size (fonts fitted, the verse laid out to the room left). */
export interface CardLayout {
  box: Rect;
  kicker: { text: string; size: number; y: number };
  title: { text: string; size: number; y: number };
  body: { lines: string[]; size: number; lh: number; y: number } | null;
  verse: { layout: PassageLayout; y: number } | null;
  hint: { text: string; size: number; y: number };
}

export function cardLayout(ctx: CanvasRenderingContext2D, box: Rect, c: CardText, u = 1): CardLayout {
  const pad = Math.max(12, 16 * u);
  const iw = box.w - 2 * pad;
  let y = box.y + pad;
  const ks = Math.max(MIN_READ, 13 * u);
  const kicker = { text: fitText(ctx, c.kicker.toUpperCase(), iw, ks, 700, SANS, MIN_TEXT), size: ks, y };
  y += ks + 8 * u;
  const tsBase = Math.min(28 * u, Math.max(18, box.w / 16));
  const title = { text: fitText(ctx, c.title, iw, tsBase, 600, SERIF, 15), size: tsBase, y };
  // fitText left ctx.font at the size it settled on: keep it
  const m = ctx.font.match(/(\d+(?:\.\d+)?)px/);
  title.size = m ? Number(m[1]) : tsBase;
  y += title.size * 1.15 + 8 * u;
  let body: CardLayout['body'] = null;
  if (c.text) {
    const bs = Math.max(MIN_READ + 1, 15 * u);
    ctx.font = font(bs, 500);
    const lines = wrapLines(ctx, c.text, iw);
    const lh = Math.round(bs * 1.35);
    body = { lines, size: bs, lh, y };
    y += lines.length * lh + 8 * u;
  }
  const hs = Math.max(MIN_READ, 13 * u);
  const hintY = box.y + box.h - pad - hs;
  const room = hintY - 8 * u - y;
  let verse: CardLayout['verse'] = null;
  if (room > 34) {
    const l = layoutPassage(ctx, passage(c.verse), iw, room, { max: Math.round(17 * u), min: 13 });
    verse = { layout: l, y: y + Math.max(0, (room - l.height) / 2) };
  }
  return { box, kicker, title, body, verse, hint: { text: c.hint, size: hs, y: hintY } };
}

/** Draw a laid-out card: dark glass with a gold edge, the kicker, the title in the serif, the verse, the hint. */
export function paintCard(ctx: CanvasRenderingContext2D, L: CardLayout, c: CardText, a: number, u = 1): void {
  if (a <= 0.01) return;
  const { box } = L;
  ctx.globalAlpha = Math.min(1, a);
  ctx.fillStyle = 'rgba(10,12,20,.84)';
  roundRect(ctx, box.x, box.y, box.w, box.h, 16 * u);
  ctx.fill();
  ctx.strokeStyle = 'rgba(246,195,92,.55)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, box.x + 0.75, box.y + 0.75, box.w - 1.5, box.h - 1.5, 16 * u);
  ctx.stroke();
  const cx = box.x + box.w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.gold;
  ctx.font = font(L.kicker.size, 700);
  ctx.fillText(L.kicker.text, cx, L.kicker.y);
  ctx.fillStyle = C.text;
  ctx.font = font(L.title.size, 600, SERIF);
  ctx.fillText(L.title.text, cx, L.title.y);
  if (L.body) {
    ctx.fillStyle = C.text2;
    ctx.font = font(L.body.size, 500);
    L.body.lines.forEach((l, i) => ctx.fillText(l, cx, L.body!.y + i * L.body!.lh));
  }
  if (L.verse) drawPassage(ctx, passage(c.verse), L.verse.layout, cx, L.verse.y, { text: '#f3e9d6', ref: C.gold });
  ctx.fillStyle = C.muted;
  ctx.font = font(L.hint.size, 600);
  ctx.fillText(L.hint.text, cx, L.hint.y);
  ctx.globalAlpha = 1;
}
