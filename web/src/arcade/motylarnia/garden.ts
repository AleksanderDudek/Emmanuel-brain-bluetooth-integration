/**
 * Motylarnia's garden art (gouache on paper, seen from above): the lawn's tile, each garden's beds,
 * stones and daisies, the hedge round it, the food (leaves, the five pigment flowers, dew, crumbs and
 * the rare flower), the birds with their swoop shadow, Hieronim the snail, and the flowerbed strip
 * that keeps the band's last 40 s (one flower a second: its height the level, gold above the
 * threshold, a cool band behind a siesta, bare dotted soil where the signal failed, mist over a
 * blind block).  Sprites are painted once into small canvases and reused.
 */
import { mulberry32 } from '../../core/random';
import type { TraceBar } from '../kit/trace';
import { PIGMENTS, type Garden } from './content';
import { canvas, ctx2d, darken, font, lighten, remember, rgba, roundRect, wrapLines } from './paint';
import { RULES } from './rules';

const TAU = Math.PI * 2;

// ── the lawn ──────────────────────────────────────────────────────
const tiles = new Map<string, HTMLCanvasElement>();

/** A seamless lawn tile (`size` px): two greens in soft blobs, blades, clover. */
export function lawnTile(g: Garden, size = 256): HTMLCanvasElement {
  const key = `${g.id}:${size}`;
  const hit = tiles.get(key);
  if (hit) return hit;
  const c = canvas(size, size), x = ctx2d(c), rnd = mulberry32(size + g.len * 7);
  x.fillStyle = g.lawn[0];
  x.fillRect(0, 0, size, size);
  const wrap = (f: (dx: number, dy: number) => void) => { for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) f(dx, dy); };
  for (let i = 0; i < 22; i++) {
    const px = rnd() * size, py = rnd() * size, r = 18 + rnd() * 36;
    x.fillStyle = rgba(i % 2 ? g.lawn[1] : lighten(g.lawn[0], 0.08), 0.45);
    wrap((dx, dy) => { x.beginPath(); x.ellipse(px + dx, py + dy, r, r * 0.7, rnd() * 3, 0, TAU); x.fill(); });
  }
  x.lineCap = 'round';
  for (let i = 0; i < 260; i++) {
    const px = rnd() * size, py = rnd() * size, a = -Math.PI / 2 + (rnd() - 0.5) * 1.1, l = 3 + rnd() * 5;
    x.strokeStyle = rgba(rnd() < 0.5 ? darken(g.lawn[1], 0.25) : lighten(g.lawn[0], 0.25), 0.55);
    x.lineWidth = 1 + rnd() * 0.8;
    wrap((dx, dy) => { x.beginPath(); x.moveTo(px + dx, py + dy); x.lineTo(px + dx + Math.cos(a) * l, py + dy + Math.sin(a) * l); x.stroke(); });
  }
  for (let i = 0; i < 7; i++) {
    const px = rnd() * size, py = rnd() * size;
    x.fillStyle = rgba(darken(g.lawn[1], 0.1), 0.8);
    wrap((dx, dy) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.3;
        x.beginPath();
        x.arc(px + dx + Math.cos(a) * 3.2, py + dy + Math.sin(a) * 3.2, 3, 0, TAU);
        x.fill();
      }
    });
  }
  return remember(tiles, key, c, 6);
}

/** Things lying in a garden (seeded by its index): beds, stones, daisy patches, stepping stones. */
export interface Decor { kind: 'bed' | 'stone' | 'daisies' | 'step' | 'tuft'; x: number; y: number; w: number; h: number; a: number; seed: number }

export function gardenDecor(index: number): Decor[] {
  const rnd = mulberry32(9001 + index * 131), out: Decor[] = [];
  const W = RULES.worldW, H = RULES.worldH;
  for (let i = 0; i < 6; i++) out.push({ kind: 'bed', x: 140 + rnd() * (W - 420), y: 120 + rnd() * (H - 360), w: 160 + rnd() * 160, h: 70 + rnd() * 60, a: (rnd() - 0.5) * 0.5, seed: i });
  for (let i = 0; i < 26; i++) out.push({ kind: 'stone', x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 120), w: 8 + rnd() * 16, h: 6 + rnd() * 10, a: rnd() * 3, seed: i });
  for (let i = 0; i < 18; i++) out.push({ kind: 'daisies', x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 120), w: 30 + rnd() * 30, h: 0, a: 0, seed: i });
  for (let i = 0; i < 30; i++) out.push({ kind: 'tuft', x: 60 + rnd() * (W - 120), y: 60 + rnd() * (H - 120), w: 10 + rnd() * 12, h: 0, a: 0, seed: i });
  // a path of stepping stones across
  const y0 = 200 + rnd() * (H - 400), y1 = 200 + rnd() * (H - 400);
  for (let i = 0; i < 16; i++) {
    const k = i / 15;
    out.push({ kind: 'step', x: 80 + k * (W - 160), y: y0 + (y1 - y0) * k + Math.sin(k * 6 + index) * 50, w: 26, h: 18, a: rnd() * 0.6, seed: i });
  }
  return out;
}

export function drawDecor(ctx: CanvasRenderingContext2D, d: Decor, g: Garden): void {
  switch (d.kind) {
    case 'bed': {
      ctx.save();
      ctx.translate(d.x + d.w / 2, d.y + d.h / 2);
      ctx.rotate(d.a);
      ctx.fillStyle = rgba(darken(g.soil, 0.3), 0.35);
      roundRect(ctx, -d.w / 2 + 3, -d.h / 2 + 5, d.w, d.h, 22);
      ctx.fill();
      ctx.fillStyle = g.soil;
      roundRect(ctx, -d.w / 2, -d.h / 2, d.w, d.h, 22);
      ctx.fill();
      ctx.strokeStyle = rgba(lighten(g.soil, 0.25), 0.5);
      ctx.lineWidth = 2;
      for (let r = 1; r < 4; r++) {
        const y = -d.h / 2 + (d.h * r) / 4;
        ctx.beginPath();
        ctx.moveTo(-d.w / 2 + 14, y);
        ctx.lineTo(d.w / 2 - 14, y);
        ctx.stroke();
      }
      // little sprouts along the rows
      ctx.fillStyle = '#6FA548';
      for (let r = 1; r < 4; r++) {
        const y = -d.h / 2 + (d.h * r) / 4;
        for (let k = 0; k < Math.floor(d.w / 26); k++) {
          const x = -d.w / 2 + 20 + k * 26 + (r % 2) * 10;
          ctx.beginPath();
          ctx.ellipse(x - 3, y - 2, 4, 2.2, -0.6, 0, TAU);
          ctx.ellipse(x + 3, y - 2, 4, 2.2, 0.6, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
      break;
    }
    case 'stone':
      ctx.fillStyle = 'rgba(40,40,20,.18)';
      ctx.beginPath();
      ctx.ellipse(d.x + 2, d.y + 3, d.w, d.h, d.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#B9B3A2';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.w, d.h, d.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.beginPath();
      ctx.ellipse(d.x - d.w * 0.25, d.y - d.h * 0.3, d.w * 0.4, d.h * 0.3, d.a, 0, TAU);
      ctx.fill();
      break;
    case 'step':
      ctx.fillStyle = 'rgba(40,40,20,.15)';
      ctx.beginPath();
      ctx.ellipse(d.x + 2, d.y + 3, d.w, d.h, d.a, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#D8CDB4';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.w, d.h, d.a, 0, TAU);
      ctx.fill();
      break;
    case 'daisies':
      for (let k = 0; k < 6; k++) {
        const a = k * 2.4 + d.seed, r = (d.w * (0.2 + 0.8 * ((k * 37 + d.seed * 11) % 10) / 10)) / 2;
        const x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r;
        ctx.fillStyle = '#FFFDF4';
        for (let p = 0; p < 6; p++) {
          const pa = (p / 6) * TAU;
          ctx.beginPath();
          ctx.ellipse(x + Math.cos(pa) * 3, y + Math.sin(pa) * 3, 2.6, 1.3, pa, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = '#F2C230';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, TAU);
        ctx.fill();
      }
      break;
    case 'tuft':
      ctx.strokeStyle = rgba(darken(g.lawn[1], 0.3), 0.7);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(d.x + k * 2, d.y);
        ctx.quadraticCurveTo(d.x + k * 4, d.y - d.w * 0.6, d.x + k * 6, d.y - d.w);
      }
      ctx.stroke();
      break;
    default:
      break;
  }
}

/** The hedge round the garden: dark bushes along the border and the world beyond it. */
export function drawHedge(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const W = RULES.worldW, H = RULES.worldH, m = RULES.hedge;
  ctx.fillStyle = '#3F6B33';
  // beyond the garden
  if (x0 < 0) ctx.fillRect(x0, y0, -x0, y1 - y0);
  if (x1 > W) ctx.fillRect(W, y0, x1 - W, y1 - y0);
  if (y0 < 0) ctx.fillRect(x0, y0, x1 - x0, -y0);
  if (y1 > H) ctx.fillRect(x0, H, x1 - x0, y1 - H);
  const bush = (x: number, y: number, i: number) => {
    if (x < x0 - 40 || x > x1 + 40 || y < y0 - 40 || y > y1 + 40) return;
    const r = m * (0.75 + 0.3 * (((i * 53) % 7) / 7));
    ctx.fillStyle = '#355C2B';
    ctx.beginPath();
    ctx.arc(x + 3, y + 4, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = i % 3 ? '#4C7F3A' : '#57893F';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,230,140,.25)';
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, TAU);
    ctx.fill();
  };
  let i = 0;
  for (let x = -10; x <= W + 10; x += 42) { bush(x, -6, i++); bush(x, H + 6, i++); }
  for (let y = 30; y <= H - 30; y += 42) { bush(-6, y, i++); bush(W + 6, y, i++); }
}

// ── food ──────────────────────────────────────────────────────────
const foodSprites = new Map<string, HTMLCanvasElement>();
const S = 64;

/** A food sprite, `S` px square, centred; leaves and crumbs green, flowers in their pigment. */
export function foodSprite(kind: string, pig: number): HTMLCanvasElement {
  const key = `${kind}:${pig}`;
  const hit = foodSprites.get(key);
  if (hit) return hit;
  const c = canvas(S, S), x = ctx2d(c);
  x.translate(S / 2, S / 2);
  if (kind === 'leaf') {
    x.fillStyle = 'rgba(30,50,10,.25)';
    x.beginPath();
    x.ellipse(3, 4, 22, 11, 0, 0, TAU);
    x.fill();
    const g = x.createLinearGradient(-22, -10, 22, 10);
    g.addColorStop(0, '#9CCB58');
    g.addColorStop(1, '#4F8C33');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-24, 0);
    x.quadraticCurveTo(-4, -16, 24, 0);
    x.quadraticCurveTo(-4, 16, -24, 0);
    x.fill();
    x.strokeStyle = 'rgba(230,250,190,.75)';
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(-20, 0);
    x.lineTo(20, 0);
    for (const s of [-1, 1]) for (let k = -10; k <= 8; k += 9) { x.moveTo(k, 0); x.lineTo(k + 6, s * 7); }
    x.stroke();
  } else if (kind === 'crumb') {
    x.fillStyle = '#B7D77A';
    x.beginPath();
    x.arc(0, 0, 14, 0, TAU);
    x.fill();
    x.fillStyle = 'rgba(255,255,230,.6)';
    x.beginPath();
    x.arc(-4, -5, 6, 0, TAU);
    x.fill();
  } else if (kind === 'dew') {
    const g = x.createRadialGradient(-6, -8, 2, 0, 0, 20);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, 'rgba(190,230,255,.95)');
    g.addColorStop(1, 'rgba(90,160,230,.55)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, 0, 18, 0, TAU);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.8)';
    x.lineWidth = 2;
    x.beginPath();
    x.arc(0, 0, 18, -2.4, -1.2);
    x.stroke();
  } else {
    // flower (and the rare flower: more petals, two rings)
    const p = PIGMENTS[Math.max(0, pig) % PIGMENTS.length];
    const rare = kind === 'rare', n = rare ? 10 : 5, R = rare ? 28 : 24;
    x.fillStyle = 'rgba(30,40,10,.25)';
    x.beginPath();
    x.arc(3, 4, R * 0.85, 0, TAU);
    x.fill();
    for (let ring = rare ? 1 : 0; ring >= 0; ring--) {
      const rr = R * (ring ? 1 : rare ? 0.72 : 1);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + ring * 0.3;
        x.fillStyle = ring ? lighten(p.color, 0.35) : p.color;
        x.beginPath();
        x.ellipse(Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55, rr * 0.5, rr * 0.3, a, 0, TAU);
        x.fill();
        x.strokeStyle = rgba(p.dark, 0.5);
        x.lineWidth = 1.2;
        x.stroke();
      }
    }
    x.fillStyle = rare ? '#FFF2A8' : '#F6CF45';
    x.beginPath();
    x.arc(0, 0, R * 0.26, 0, TAU);
    x.fill();
    x.fillStyle = rgba(darken('#B98310', 0.2), 0.6);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9;
      x.beginPath();
      x.arc(Math.cos(a) * R * 0.13, Math.sin(a) * R * 0.13, 1.4, 0, TAU);
      x.fill();
    }
  }
  return remember(foodSprites, key, c, 24);
}

// ── birds ─────────────────────────────────────────────────────────
/** A thrush from above at (x, y) facing `dir`, `size` u long; `spread` 0..1 opens the wings; `hop` lifts it. */
export function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number, size: number, spread: number, hop: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(30,30,10,.22)';
  ctx.beginPath();
  ctx.ellipse(4, 6, size * 0.55, size * 0.35, dir, 0, TAU);
  ctx.fill();
  ctx.translate(0, -hop * 4);
  ctx.rotate(dir);
  const s = size;
  // tail
  ctx.fillStyle = '#6E4B30';
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, 0);
  ctx.lineTo(-s * 0.75, -s * 0.18);
  ctx.lineTo(-s * 0.75, s * 0.18);
  ctx.closePath();
  ctx.fill();
  // wings
  ctx.fillStyle = '#7C5536';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.25 + spread * 1.1));
    ctx.beginPath();
    ctx.ellipse(-s * 0.05, side * s * (0.12 + spread * 0.25), s * (0.38 + spread * 0.12), s * (0.14 + spread * 0.08), 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // body, speckled breast
  ctx.fillStyle = '#9A6E46';
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.4, s * 0.26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E9D6B0';
  ctx.beginPath();
  ctx.ellipse(s * 0.08, 0, s * 0.24, s * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6B4529';
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.arc(s * (0.0 + (k % 3) * 0.08), s * ((k < 3 ? -1 : 1) * 0.06), s * 0.025, 0, TAU);
    ctx.fill();
  }
  // head, eye, beak
  ctx.fillStyle = '#8A5E3B';
  ctx.beginPath();
  ctx.arc(s * 0.38, 0, s * 0.17, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#E8A53A';
  ctx.beginPath();
  ctx.moveTo(s * 0.52, -s * 0.05);
  ctx.lineTo(s * 0.7, 0);
  ctx.lineTo(s * 0.52, s * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#111';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * 0.42, side * s * 0.09, s * 0.035, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** The swoop's telegraph: a shadow that darkens and tightens, a dashed ring where the beak will land. */
export function drawSwoop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, t: number): void {
  ctx.save();
  ctx.fillStyle = `rgba(20,20,10,${(0.08 + 0.32 * k).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * (1.5 - 0.5 * k), r * (1.2 - 0.4 * k), 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(200,60,40,${(0.35 + 0.5 * k * (0.6 + 0.4 * Math.sin(t * 18))).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 7]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ── Hieronim the snail ───────────────────────────────────────────
/** Hieronim at (x, y) (his foot on the ground), `s` scale, looking right; `talk` wiggles his stalks. */
export function drawSnail(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, talk: boolean, scared: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const out = 1 - scared;
  // the foot
  ctx.fillStyle = '#CDBFA6';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.quadraticCurveTo(-20, -10, 6 + 12 * out, -12);
  ctx.quadraticCurveTo(22 * out + 8, -14, 24 * out + 6, -2);
  ctx.lineTo(-26, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(80,60,40,.25)';
  ctx.fillRect(-26, -1, 50 * out + 4, 2);
  // eye stalks
  if (out > 0.2) {
    const wig = talk ? Math.sin(t * 12) * 2 : Math.sin(t * 1.5) * 1;
    ctx.strokeStyle = '#BFAF94';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    for (const k of [0, 1]) {
      const bx = 16 * out + 4 + k * 4, tx = bx + 4 + k * 5 + wig, ty = -30 * out - k * 2;
      ctx.beginPath();
      ctx.moveTo(bx, -11);
      ctx.quadraticCurveTo(bx + 2, -20, tx, ty);
      ctx.stroke();
      ctx.fillStyle = '#2A2420';
      ctx.beginPath();
      ctx.arc(tx, ty, 2.4, 0, TAU);
      ctx.fill();
    }
    // a smile
    ctx.strokeStyle = '#7C6A52';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(20 * out + 6, -7, 3, 0.2, talk ? 2.6 + Math.sin(t * 14) * 0.3 : 2.4);
    ctx.stroke();
  }
  // the shell: a spiral house (paid off)
  const g = ctx.createRadialGradient(-12, -22, 2, -8, -16, 20);
  g.addColorStop(0, '#F3C982');
  g.addColorStop(1, '#A8662E');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(-8, -16, 17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#6E3F1A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let a = 0; a < 4.6 * Math.PI; a += 0.2) {
    const r = 1 + a * 1.1;
    const px = -8 + Math.cos(a) * r, py = -16 + Math.sin(a) * r;
    if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * A speech bubble left-anchored at (x, y), at most `maxW` wide: above the point with its tail down-left to the
 * speaker, or (`below`) hanging from it with its tail out to the left, where the speaker sits beside it.  Its
 * words at 14 px (13 at the least before a fourth line), at most four lines.
 */
export function drawBubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, alpha: number, below = false): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  let size = 14, lines: string[] = [];
  for (; ; size -= 0.5) {
    ctx.font = font(size, 600);
    lines = wrapLines(ctx, text, maxW - 24);
    if (lines.length <= 3 || size <= 13) break;
  }
  lines = lines.slice(0, 4);
  const lh = Math.round(size * 1.3);
  const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 24), h = lines.length * lh + 16;
  const bx = x, by = below ? y : y - h;
  ctx.fillStyle = 'rgba(60,40,20,.18)';
  roundRect(ctx, bx + 2, by + 3, w, h, 12);
  ctx.fill();
  ctx.fillStyle = '#FFFBEF';
  roundRect(ctx, bx, by, w, h, 12);
  ctx.fill();
  ctx.beginPath();
  if (below) {
    ctx.moveTo(bx + 2, by + 10);
    ctx.lineTo(bx - 10, by + 18);
    ctx.lineTo(bx + 2, by + 26);
  } else {
    ctx.moveTo(bx + 10, by + h - 2);
    ctx.lineTo(bx - 6, by + h + 10);
    ctx.lineTo(bx + 24, by + h - 2);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(110,80,40,.35)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = '#3B3024';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 12, by + 8 + i * lh + (lh - size) / 2));
  ctx.restore();
}

// ── the flowerbed (the band's last 40 s) ─────────────────────────
/**
 * One flower per bar along the strip: its stem height the level, its head gold above the threshold
 * and cream below; a cool band behind siesta bars, bare dotted soil where the signal failed, mist
 * over what a blind block still hides.  A dotted line marks the threshold's height, a bracket at the
 * right end the band's delay.
 */
export function drawFlowerbed(ctx: CanvasRenderingContext2D, bars: readonly TraceBar[], x0: number, y0: number, w: number, h: number, lagShare: number, lagText: string, t: number): void {
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, '#8C6A44');
  g.addColorStop(1, '#6E5134');
  ctx.fillStyle = g;
  ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = 'rgba(255,240,210,.12)';
  ctx.fillRect(x0, y0, w, 2);
  const n = bars.length, bw = w / n, ground = y0 + h - 5, top = y0 + 6, hMax = ground - top;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    if (b.phase === 'rest' && !b.empty) {
      ctx.fillStyle = 'rgba(120,170,235,.22)';
      ctx.fillRect(x0 + i * bw, y0, bw + 0.5, h);
    }
  }
  // the threshold's height
  const ty = ground - hMax * 0.5;
  ctx.strokeStyle = 'rgba(255,236,170,.55)';
  ctx.setLineDash([2, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, ty);
  ctx.lineTo(x0 + w, ty);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < n; i++) {
    const b = bars[i], cx = x0 + (i + 0.5) * bw;
    if (b.empty) continue;
    if (!b.reliable) {
      ctx.fillStyle = 'rgba(240,225,200,.5)';
      ctx.beginPath();
      ctx.arc(cx, ground, 1.2, 0, TAU);
      ctx.fill();
      continue;
    }
    const hgt = Math.max(3, b.level * hMax), shown = b.shown;
    const sway = Math.sin(t * 1.6 + i * 0.7) * 1.2;
    ctx.globalAlpha = 0.25 + 0.75 * shown;
    ctx.strokeStyle = '#5E9A3E';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, ground);
    ctx.quadraticCurveTo(cx + sway, ground - hgt * 0.6, cx + sway, ground - hgt);
    ctx.stroke();
    const r = Math.max(2, Math.min(bw * 0.42, 3 + b.level * 3.5));
    ctx.fillStyle = shown < 0.5 ? '#D9D4C8' : b.above ? '#F2C230' : '#F7F0DE';
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + i;
      ctx.beginPath();
      ctx.arc(cx + sway + Math.cos(a) * r * 0.6, ground - hgt + Math.sin(a) * r * 0.6, r * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = b.above ? '#C46A1C' : '#E2B84A';
    ctx.beginPath();
    ctx.arc(cx + sway, ground - hgt, r * 0.35, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (shown < 1) {
      ctx.fillStyle = `rgba(245,245,240,${(0.7 * (1 - shown)).toFixed(3)})`;
      ctx.fillRect(cx - bw / 2, top - 4, bw + 0.5, h);
    }
  }
  // the delay: the last `lagShare` of the strip is where "now" will still show
  const lx = x0 + w * (1 - lagShare);
  ctx.strokeStyle = 'rgba(255,248,230,.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(lx, y0 + 4);
  ctx.lineTo(lx, y0 + 1);
  ctx.lineTo(x0 + w - 3, y0 + 1);
  ctx.lineTo(x0 + w - 3, y0 + 4);
  ctx.stroke();
  // the delay's tag on the soil, on a plate (the flowers grow tall under it)
  ctx.font = font(13, 700);
  const tw = ctx.measureText(lagText).width;
  ctx.fillStyle = 'rgba(70,48,26,.72)';
  roundRect(ctx, lx - tw - 9, y0 + 2, tw + 10, 18, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,248,230,.95)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(lagText, lx - 4, y0 + 4);
}
