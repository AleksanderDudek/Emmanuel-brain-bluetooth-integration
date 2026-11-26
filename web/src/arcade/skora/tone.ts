/**
 * Żywa skóra's skin tones and a few helpers its worlds share (DESIGN.md §24.3).
 *
 * The player chooses a skin tone in the lobby's card (five neutral names); the whole picture follows it — the colour
 * of the skin and its cells, and the melanin in them.  The biology behind the tones (sources in the design notes):
 * every skin colour has about the same number of melanocytes; what differs is how much melanin they make, what kind,
 * and how large its granules (melanosomes) are — in darker skin they are larger, more numerous and carried up through
 * all the layers, in lighter skin smaller, fewer and mostly near the base.  Every tone is drawn luminous on the plate:
 * each has its own warm sheen, so the darkest skin glows bronze and gold as the lightest glows peach and pearl.
 */
export const LOOKS = ['light', 'medium', 'olive', 'brown', 'dark'] as const;
export type Look = (typeof LOOKS)[number];

export interface Tone {
  /** the skin's body colour */
  skin: string;
  /** its light (rims, the horny layer, a sheen) */
  hi: string;
  /** its depth (the base of the epidermis, shadows) */
  deep: string;
  /** melanin's amount (0..1): granules per cell and how far up they are carried */
  mel: number;
  /** the granules' colour (eumelanin brown–black, a touch warmer in lighter skin) */
  gran: string;
  /** the granules' size (larger in darker skin) */
  size: number;
}

export const TONES: Readonly<Record<Look, Tone>> = {
  light: { skin: '#f4cdb8', hi: '#fff1e8', deep: '#e3a08e', mel: 0.2, gran: '#8a5634', size: 0.75 },
  medium: { skin: '#e2a684', hi: '#ffe1c9', deep: '#c98366', mel: 0.4, gran: '#6a3c22', size: 0.85 },
  olive: { skin: '#c99a6c', hi: '#f6d9a8', deep: '#a9774c', mel: 0.58, gran: '#55321b', size: 0.95 },
  brown: { skin: '#a8693f', hi: '#f0b47c', deep: '#7e4a2a', mel: 0.8, gran: '#3e2414', size: 1.08 },
  dark: { skin: '#74432a', hi: '#e2a36a', deep: '#4d2a17', mel: 1, gran: '#2c180c', size: 1.2 },
};

/** The tone of a look ('' or an unknown look: the first). */
export const toneOf = (look: string): Tone => TONES[(LOOKS as readonly string[]).includes(look) ? (look as Look) : 'light'];

/** The part of a world the canvas shows now (world units), from the context's transform — for drawing only what is seen. */
export function seen(ctx: CanvasRenderingContext2D, pad = 0): { x0: number; y0: number; x1: number; y1: number } {
  const m = ctx.getTransform?.();
  const w = ctx.canvas?.width, h = ctx.canvas?.height;
  const s = m?.a || 1, t = m?.d || 1;
  const x0 = (0 - (m?.e as number)) / s, x1 = ((w as number) - (m?.e as number)) / s, y0 = (0 - (m?.f as number)) / t, y1 = ((h as number) - (m?.f as number)) / t;
  // no transform to read (a test's fake canvas): all of it
  if (![x0, x1, y0, y1].every(Number.isFinite)) return { x0: -300, x1: 300, y0: -300, y1: 300 };
  return { x0: Math.min(x0, x1) - pad, x1: Math.max(x0, x1) + pad, y0: Math.min(y0, y1) - pad, y1: Math.max(y0, y1) + pad };
}

/** A gentle step 0..1 of a growth between two points of it. */
export const span = (g: number, a: number, b: number): number => (g <= a ? 0 : g >= b ? 1 : (g - a) / (b - a));

/**
 * The air above the skin, lit (baked): a warm haze gathering toward the surface, a few soft slanting shafts of light
 * and motes drifting in them — so a tall picture's upper part is a skin in light, not an empty dark.
 */
export function airLight(ctx: CanvasRenderingContext2D, surface: number, scale: number, a = 1): void {
  const X0 = -400, X1 = 400, top = surface - 220 * scale;
  const g = ctx.createLinearGradient(0, top, 0, surface);
  g.addColorStop(0, 'rgba(200,170,255,0)');
  g.addColorStop(0.6, `rgba(255,200,190,${(0.04 * a).toFixed(3)})`);
  g.addColorStop(1, `rgba(255,222,196,${(0.13 * a).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(X0, top, X1 - X0, surface - top);
  const op = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const x = (-220 + i * 70 + 20 * Math.sin(i * 2.3)) * scale;
    const w = (10 + 14 * ((i * 0.37) % 1)) * scale;
    const sg = ctx.createLinearGradient(0, top, 0, surface);
    sg.addColorStop(0, 'rgba(255,230,190,0)');
    sg.addColorStop(1, `rgba(255,226,190,${(0.045 * a).toFixed(3)})`);
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(x - 60 * scale, top);
    ctx.lineTo(x - 60 * scale + w, top);
    ctx.lineTo(x + w, surface);
    ctx.lineTo(x, surface);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = op;
  for (let i = 0; i < 40; i++) {
    const x = (-260 + ((i * 0.618) % 1) * 520) * scale;
    const y = surface - (4 + ((i * 0.383 + 0.1) % 1) * 160) * scale;
    const r = (0.5 + ((i * 0.71) % 1) * 1.4) * scale;
    const c = i % 3 ? '#ffe0c8' : '#e0d0ff';
    const gg = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5);
    gg.addColorStop(0, `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${(0.22 * a).toFixed(3)})`);
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
  }
}
