/**
 * Synapsy's drawing kit: the palette (a violet night of tissue, lilac-white neurons, warm gold for growth,
 * pearl myelin, aqua for the fluid that washes the brain in rest), the font floor (never under 11 px), glows
 * baked once into small sprites and drawn with 'lighter' (no shadowBlur, no filters per frame), and the
 * shapes: the hemispheres with their gyri, a pyramidal neuron with its dendrites, the IO icons (an eye, an
 * ear, a hand, a voice, the seahorse of the hippocampus), Oli the oligodendrocyte, and the lens.
 */
import { MIN_TEXT } from '../kit/mobile';
import { OUTLINE, halfWidth, type IoKind } from './brain';

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
const TAU = Math.PI * 2;

export const C = {
  bg0: '#060518',
  bg1: '#100b2e',
  bg2: '#1c1448',
  tissue: '#1a1442',
  tissue2: '#251c5c',
  rim: '#7d6bf0',
  soma: '#f6f0ff',
  halo: '#b48cff',
  link: '#8a78ff',
  linkHi: '#e6dcff',
  gold: '#ffd27a',
  goldHi: '#fff1c8',
  thought: '#fff5de',
  habit: '#d9cbff',
  replay: '#c4f6ff',
  myelin: '#f4f0ff',
  myelinEdge: '#a6b6ff',
  node: '#8cf0ff',
  bridge: '#9b8bff',
  bridgeOn: '#ffe08a',
  csf: '#74e3ff',
  waste: '#8a7894',
  text: '#f4efff',
  dim: '#c3b8ea',
  plate: 'rgba(12,9,34,0.82)',
  plateEdge: 'rgba(186,166,255,0.38)',
  rest: '#90dcff',
  blind: '#7a6aae',
  oli: '#fff6ea',
  oliEdge: '#d7c4ff',
} as const;

/** A canvas font, never under MIN_TEXT (11 px); text the player must read asks for 13 px and more itself. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);
export const font = (px: number, weight = 700, serif = false): string => `${weight} ${fontPx(px)}px ${serif ? SERIF : SANS}`;

/** Fit a text into a width by shrinking the font down to `min` px (never under MIN_TEXT); returns the size used. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 700, serif = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif);
  }
  return size;
}

/** Greedy wrap with the current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** The largest size (from px down to min) at which `text` wraps into `maxLines` of `maxW`; the lines and the size. */
export function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, px: number, min = 13, weight = 600): { lines: string[]; size: number } {
  let size = fontPx(Math.max(min, px));
  for (;;) {
    ctx.font = font(size, weight);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines || size <= Math.max(MIN_TEXT, min)) {
      if (lines.length > maxLines) {
        const cut = lines.slice(0, maxLines);
        cut[maxLines - 1] = `${cut[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
        return { lines: cut, size };
      }
      return { lines, size };
    }
    size = Math.max(Math.max(MIN_TEXT, min), size - 0.5);
  }
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

/** A soft dark plate behind passive words. */
export function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 10, edge: string = C.plateEdge, fill: string = C.plate): void {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = edge;
  ctx.stroke();
}

/** A stable pseudo-random 0..1 for an integer. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── baked sprites ────────────────────────────────────────────────
type Canvasish = HTMLCanvasElement | OffscreenCanvas;

/** A small offscreen canvas (OffscreenCanvas when there is one, else a detached <canvas>), or null (tests without canvas). */
export function makeCanvas(w: number, h: number): Canvasish | null {
  try {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
  } catch { /* Safari before 16.4 */ }
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export function ctx2d(c: Canvasish | null): CanvasRenderingContext2D | null {
  if (!c) return null;
  try {
    return (c.getContext('2d') as CanvasRenderingContext2D | null) ?? null;
  } catch {
    return null;
  }
}

const glows = new Map<string, Canvasish | null>();

/** A round glow of one colour (64 px, a soft core and a long falloff), baked once. */
export function glowSprite(color: string): Canvasish | null {
  const have = glows.get(color);
  if (have !== undefined) return have;
  const S = 64;
  const c = makeCanvas(S, S), g = ctx2d(c);
  if (c && g) {
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.22, withAlpha(color, 0.55));
    grad.addColorStop(0.55, withAlpha(color, 0.16));
    grad.addColorStop(1, withAlpha(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  }
  glows.set(color, c && g ? c : null);
  return c && g ? c : null;
}

/** Draw a baked glow of radius r (the caller sets 'lighter' and the alpha). */
export function glow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, r: number, alpha = 1): void {
  const sp = glowSprite(color);
  if (!sp || r <= 0.5 || alpha <= 0.003) return;
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * Math.min(1, alpha);
  ctx.drawImage(sp as CanvasImageSource, x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = a;
}

/** "#rrggbb" with an alpha as "rgba(…)". */
export function withAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}

/** Mix two "#rrggbb" colours. */
export function mix(a: string, b: string, k: number): string {
  const p = (s: string) => parseInt(s.replace('#', ''), 16);
  const x = p(a), y = p(b), t = Math.max(0, Math.min(1, k));
  const ch = (sh: number) => Math.round(((x >> sh) & 255) * (1 - t) + ((y >> sh) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

// ── the brain ────────────────────────────────────────────────────
/** One hemisphere's outline in px: the brain's egg on its side of the longitudinal fissure (a D, rounded at the poles). */
export function hemiPath(cx: number, cy: number, s: number, side: -1 | 1): Path2D {
  const p = new Path2D();
  const n = 48, f = OUTLINE.fissure, ry = OUTLINE.ry;
  // the outer edge from the frontal pole to the occipital pole
  for (let i = 0; i <= n; i++) {
    const y = -ry + (2 * ry * i) / n;
    const w = Math.max(f + 0.02, halfWidth(y) * (1 + 0.012 * Math.sin(i * 1.7)));
    const px = cx + side * w * s, py = cy + y * s;
    if (i === 0) p.moveTo(cx + side * (f + 0.06) * s, cy - ry * s); else p.lineTo(px, py);
  }
  // round the occipital pole into the fissure, up the straight medial side, round the frontal pole
  p.quadraticCurveTo(cx + side * f * s, cy + ry * s, cx + side * f * s, cy + (ry - 0.12) * s);
  p.lineTo(cx + side * f * s, cy - (ry - 0.12) * s);
  p.quadraticCurveTo(cx + side * f * s, cy - ry * s, cx + side * (f + 0.06) * s, cy - ry * s);
  p.closePath();
  return p;
}

/**
 * The gyri and sulci (the static layer): the central sulcus between the motor and the sensory strips, the
 * lateral fissure along the temporal lobe, and softer winding folds elsewhere — all clipped to the hemisphere.
 */
export function gyri(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, side: -1 | 1, seed: number): void {
  ctx.save();
  ctx.clip(hemiPath(cx, cy, s, side));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts: [number, number][], w: number, a: number) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(cx + side * x * s, cy + y * s) : ctx.moveTo(cx + side * x * s, cy + y * s)));
    ctx.lineWidth = Math.max(1, s * w);
    ctx.strokeStyle = `rgba(150,128,255,${a})`;
    ctx.stroke();
  };
  // the folds: winding lines running across each lobe
  for (let i = 0; i < 20; i++) {
    const h = (k: number) => hash(seed * 31 + i * 7 + k);
    const y0 = -0.92 + (i / 19) * 1.84;
    const pts: [number, number][] = [];
    const span = halfWidth(y0);
    for (let k = 0; k <= 16; k++) {
      const x = 0.05 + (k / 16) * (span - 0.02);
      pts.push([x, y0 + Math.sin(k * 0.95 + h(2) * 6) * 0.04 + Math.sin(k * 2.4 + h(3) * 6) * 0.018]);
    }
    line(pts, 0.011, 0.08 + h(4) * 0.06);
  }
  // the central sulcus (between the motor strip and the sensory strip) and the lateral fissure
  const cs: [number, number][] = [];
  for (let k = 0; k <= 12; k++) { const x = 0.06 + k * 0.075; cs.push([x, -0.22 + x * 0.12 + Math.sin(k * 1.6) * 0.022]); }
  line(cs, 0.016, 0.22);
  const lf: [number, number][] = [];
  for (let k = 0; k <= 10; k++) { const x = 0.95 - k * 0.04; lf.push([x, -0.32 + k * 0.06 + Math.sin(k * 1.3) * 0.015]); }
  line(lf, 0.014, 0.2);
  ctx.restore();
}

/** A pyramidal neuron's dendrites and soma (static: drawn once per size). */
export function neuronBody(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, color: string = C.halo): void {
  ctx.save();
  ctx.lineCap = 'round';
  const branches = 4 + Math.floor(hash(seed) * 3);
  for (let i = 0; i < branches; i++) {
    const a0 = (i / branches) * TAU + hash(seed + i) * 0.9;
    let px = x, py = y, a = a0, len = r * (2.2 + hash(seed + i * 3) * 1.6), w = Math.max(0.8, r * 0.28);
    for (let k = 0; k < 3; k++) {
      const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + Math.cos(a + 0.4) * len * 0.5, py + Math.sin(a + 0.4) * len * 0.5, nx, ny);
      ctx.lineWidth = w;
      ctx.strokeStyle = withAlpha(color, 0.32 - k * 0.08);
      ctx.stroke();
      // a twig
      if (k < 2) {
        const ta = a + (hash(seed + i * 11 + k) > 0.5 ? 0.9 : -0.9);
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.lineTo(nx + Math.cos(ta) * len * 0.55, ny + Math.sin(ta) * len * 0.55);
        ctx.lineWidth = w * 0.6;
        ctx.stroke();
      }
      px = nx; py = ny;
      a += (hash(seed + i * 5 + k) - 0.5) * 1.1;
      len *= 0.66;
      w *= 0.62;
    }
  }
  // the soma: a soft pyramid
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.15);
  ctx.quadraticCurveTo(x + r * 1.1, y + r * 0.2, x + r * 0.75, y + r * 0.8);
  ctx.quadraticCurveTo(x, y + r * 1.05, x - r * 0.75, y + r * 0.8);
  ctx.quadraticCurveTo(x - r * 1.1, y + r * 0.2, x, y - r * 1.15);
  ctx.closePath();
  ctx.fillStyle = mix(C.tissue2, color, 0.55);
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.strokeStyle = withAlpha(color, 0.75);
  ctx.stroke();
  ctx.restore();
}

/** The bright heart of a soma (dynamic: its light follows the neuron's firing). */
export function somaCore(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, k: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r * (0.42 + 0.25 * k), 0, TAU);
  ctx.fillStyle = mix(C.halo, C.soma, 0.5 + 0.5 * k);
  ctx.fill();
}

// ── icons ────────────────────────────────────────────────────────
/** An IO node's icon in a disc of radius r: eye, ear, hand, voice, or the hippocampus' seahorse. */
export function ioIcon(ctx: CanvasRenderingContext2D, kind: IoKind, x: number, y: number, r: number, color: string, ink = '#140f33'): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.strokeStyle = withAlpha('#ffffff', 0.55);
  ctx.stroke();
  ctx.translate(x, y);
  const k = r * 0.62;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = Math.max(1.3, r * 0.13);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'eye': {
      ctx.beginPath();
      ctx.moveTo(-k, 0);
      ctx.quadraticCurveTo(0, -k * 0.95, k, 0);
      ctx.quadraticCurveTo(0, k * 0.95, -k, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, k * 0.36, 0, TAU);
      ctx.fill();
      break;
    }
    case 'ear': {
      ctx.beginPath();
      ctx.moveTo(-k * 0.35, k * 0.75);
      ctx.bezierCurveTo(-k * 0.9, k * 0.2, -k * 0.75, -k, k * 0.05, -k * 0.95);
      ctx.bezierCurveTo(k * 0.9, -k * 0.9, k * 0.85, 0, k * 0.2, k * 0.25);
      ctx.bezierCurveTo(-k * 0.1, k * 0.45, k * 0.15, k * 0.8, -k * 0.2, k * 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(k * 0.05, -k * 0.3, k * 0.25, Math.PI, TAU * 0.95);
      ctx.stroke();
      break;
    }
    case 'hand': {
      // a palm and four fingers, a thumb to the side
      rr(ctx, -k * 0.55, -k * 0.05, k * 1.1, k * 0.95, k * 0.3);
      ctx.fill();
      for (let i = 0; i < 4; i++) {
        const fx = -k * 0.48 + i * k * 0.32;
        rr(ctx, fx, -k * (0.85 - (i === 1 || i === 2 ? 0.1 : 0)), k * 0.24, k * 0.9, k * 0.12);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(-k * 0.5, k * 0.35);
      ctx.lineTo(-k * 0.95, -k * 0.05);
      ctx.lineWidth = k * 0.26;
      ctx.stroke();
      break;
    }
    case 'voice': {
      ctx.beginPath();
      ctx.ellipse(-k * 0.25, 0, k * 0.42, k * 0.3, 0, 0, TAU);
      ctx.fill();
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(-k * 0.1, 0, k * (0.45 + i * 0.3), -0.6, 0.6);
        ctx.stroke();
      }
      break;
    }
    case 'mem': {
      // the hippocampus: a seahorse curl
      ctx.beginPath();
      ctx.moveTo(k * 0.15, -k * 0.85);
      ctx.bezierCurveTo(k * 0.9, -k * 0.7, k * 0.75, k * 0.05, k * 0.1, k * 0.15);
      ctx.bezierCurveTo(-k * 0.55, k * 0.25, -k * 0.35, k * 0.95, k * 0.15, k * 0.8);
      ctx.bezierCurveTo(k * 0.45, k * 0.7, k * 0.35, k * 0.42, k * 0.12, k * 0.48);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(k * 0.38, -k * 0.55, k * 0.1, 0, TAU);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ── Oli ──────────────────────────────────────────────────────────
/**
 * Oli, a young oligodendrocyte: a soft round cell with wavy arms that end in little sheets of myelin, two
 * eyes and a smile.  `t` animates the arms; `wrap` 0..1 curls them around (wrapping); `scale` for a press.
 */
export function paintOli(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, o: { wrap?: number; blink?: boolean; happy?: number; dim?: boolean } = {}): void {
  const wrapK = o.wrap ?? 0;
  ctx.save();
  ctx.translate(x, y);
  if (o.dim) ctx.globalAlpha *= 0.45;
  ctx.lineCap = 'round';
  const arms = 7;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * TAU + t * 0.35 + wrapK * t * 2.2;
    const len = r * (1.25 + 0.15 * Math.sin(t * 2 + i));
    const bend = Math.sin(t * 1.8 + i * 1.7) * 0.6 + wrapK * 1.2;
    const ex = Math.cos(a) * len, ey = Math.sin(a) * len;
    const mx = Math.cos(a + bend * 0.5) * len * 0.6, my = Math.sin(a + bend * 0.5) * len * 0.6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.lineWidth = Math.max(1.4, r * 0.16);
    ctx.strokeStyle = C.oliEdge;
    ctx.stroke();
    // the myelin paddle at the arm's end
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.24, r * 0.12, a + Math.PI / 2, 0, TAU);
    ctx.fillStyle = C.myelin;
    ctx.fill();
  }
  // the body
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, C.oli);
  g.addColorStop(1, C.oliEdge);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.82, r * 0.74, 0, 0, TAU);
  ctx.fillStyle = g;
  ctx.fill();
  // the face
  const eyeY = -r * 0.1;
  ctx.fillStyle = '#2a1f5c';
  if (o.blink) {
    ctx.fillRect(-r * 0.32, eyeY, r * 0.18, Math.max(1, r * 0.05));
    ctx.fillRect(r * 0.14, eyeY, r * 0.18, Math.max(1, r * 0.05));
  } else {
    ctx.beginPath();
    ctx.arc(-r * 0.23, eyeY, r * 0.09, 0, TAU);
    ctx.arc(r * 0.23, eyeY, r * 0.09, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  const happy = o.happy ?? 0.5;
  ctx.arc(0, r * 0.12, r * (0.16 + 0.06 * happy), 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = Math.max(1.2, r * 0.07);
  ctx.strokeStyle = '#2a1f5c';
  ctx.stroke();
  // cheeks
  ctx.fillStyle = 'rgba(255,150,190,0.35)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, r * 0.1, r * 0.1, r * 0.06, 0, 0, TAU);
  ctx.ellipse(r * 0.42, r * 0.1, r * 0.1, r * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── the lens: a synapse up close ─────────────────────────────────
export interface LensState {
  /** what the lens shows now: growth (a push), settling (rest), veiled (blind), idle */
  mode: 'grow' | 'rest' | 'blind' | 'idle';
  /** 0..1 with 0.5 at the threshold, or null (no signal) */
  value: number | null;
  t: number;
  /** the BDNF bloom's charge 0..1 */
  charge: number;
}

/**
 * The magnified synapse: the presynaptic bouton above with its vesicles, the cleft, and the dendritic spine
 * below, whose head swells with the growth (a dashed ring marks the size at the threshold; gold above it).
 * In rest the spine glows steady and aqua fluid streams past; veiled in a blind push.
 */
export function paintLens(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: LensState, label: string, fontScale = 1): void {
  ctx.save();
  // the glass
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  bg.addColorStop(0, '#2a2068');
  bg.addColorStop(1, '#0d0a28');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const v = s.value ?? 0;
  const gold = s.mode === 'grow' && s.value !== null && v >= 0.5;
  // the bouton (presynaptic) at the top
  ctx.beginPath();
  ctx.ellipse(x, y - r * 0.62, r * 0.62, r * 0.42, 0, 0, TAU);
  ctx.fillStyle = '#5a49b8';
  ctx.fill();
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + s.t * 0.6;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.32, y - r * 0.62 + Math.sin(a * 1.3) * r * 0.16, r * 0.075, 0, TAU);
    ctx.fillStyle = '#d8ccff';
    ctx.fill();
  }
  // glutamate in the cleft, more with growth
  const dots = s.mode === 'grow' ? Math.round(3 + v * 9) : s.mode === 'rest' ? 3 : 2;
  for (let i = 0; i < dots; i++) {
    const p = (s.t * 0.9 + i / dots) % 1;
    ctx.beginPath();
    ctx.arc(x + (hash(i) - 0.5) * r * 0.7, y - r * 0.24 + p * r * 0.22, r * 0.035, 0, TAU);
    ctx.fillStyle = gold ? C.gold : '#bfe9ff';
    ctx.fill();
  }
  // the spine (postsynaptic): neck and head; the head's size is the growth
  const headR = r * (0.2 + 0.32 * (s.mode === 'grow' ? v : s.mode === 'rest' ? 0.62 : 0.4));
  const neckY = y + r * 0.95;
  const headY = y + r * 0.02 + (r * 0.52 - headR) * 0.4;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.1, neckY);
  ctx.lineTo(x - r * 0.07, headY + headR * 0.6);
  ctx.lineTo(x + r * 0.07, headY + headR * 0.6);
  ctx.lineTo(x + r * 0.1, neckY);
  ctx.closePath();
  ctx.fillStyle = '#7b66e0';
  ctx.fill();
  const hg = ctx.createRadialGradient(x - headR * 0.3, headY - headR * 0.3, headR * 0.1, x, headY, headR);
  hg.addColorStop(0, gold ? C.goldHi : '#efe6ff');
  hg.addColorStop(1, gold ? '#e3a83a' : '#8b74f0');
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, TAU);
  ctx.fillStyle = hg;
  ctx.fill();
  // AMPA receptors on the head, more with growth
  const recs = s.mode === 'grow' ? Math.round(2 + v * 8) : 4;
  for (let i = 0; i < recs; i++) {
    const a = Math.PI + (i + 0.5) / recs * Math.PI;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * headR, headY + Math.sin(a) * headR, Math.max(1, r * 0.035), 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  // the threshold: the head's size at 0.5, dashed
  if (s.mode === 'grow') {
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.02 + (r * 0.52 - r * 0.36) * 0.4, r * 0.36, 0, TAU);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255,240,200,0.75)';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // rest: fluid streaming past
  if (s.mode === 'rest') {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const p = (s.t * 0.35 + i / 6) % 1;
      glow(ctx, C.csf, x - r + p * r * 2, y + Math.sin(i * 2 + s.t) * r * 0.5, r * 0.22, 0.35);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // blind: a veil
  if (s.mode === 'blind' || (s.mode !== 'idle' && s.value === null)) {
    ctx.fillStyle = 'rgba(30,22,70,0.78)';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  // the rim: gold when above the threshold; the BDNF charge as an arc around it
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = gold ? C.gold : s.mode === 'rest' ? C.rest : '#b9a8ff';
  ctx.stroke();
  if (s.charge > 0.01 && s.mode !== 'blind') {
    ctx.beginPath();
    ctx.arc(x, y, r + Math.max(3, r * 0.1), -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, s.charge));
    ctx.lineWidth = Math.max(2.5, r * 0.08);
    ctx.lineCap = 'round';
    ctx.strokeStyle = C.gold;
    ctx.stroke();
  }
  // the label under the lens's centre, on its glass (13 px, fitted to the glass, never under 11)
  const fs = fitFont(ctx, label, r * 1.7, 13 * fontScale, 11, 800);
  ctx.font = font(fs, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(8,6,24,0.85)';
  ctx.strokeText(label, x, y + r * 0.66);
  ctx.fillStyle = C.text;
  ctx.fillText(label, x, y + r * 0.66);
  ctx.restore();
}
