/**
 * Mocne zęby's small painting helpers on top of kit/healthlib/paint.ts: the screen scale inside a bake, a line of
 * light (an additive halo under a bright core, no shadowBlur), the tissue colours of the mouth, and the game's words
 * for the few things a world writes itself (its counters).
 */
import { lang } from '../../i18n';
import { SANS, rgba } from '../kit/healthlib/paint';
import { WORDS } from './i18n';

/** Screen px per world unit inside a bake (the transform is the camera's × dpr; dpr is at most 2 in the engine). */
export function bakePx(ctx: CanvasRenderingContext2D): number {
  const t = ctx.getTransform();
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  return Math.hypot(t.a, t.b) / dpr || 1;
}

/** A path drawn as light: a soft additive halo, then a bright core (widths in screen px). */
export function lightLine(ctx: CanvasRenderingContext2D, p: Path2D, px: number, color: string, core: string, w: number, a: number): void {
  if (a <= 0.004) return;
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba(color, 0.16 * a);
  ctx.lineWidth = (w * 4.5) / px;
  ctx.stroke(p);
  ctx.strokeStyle = rgba(color, 0.32 * a);
  ctx.lineWidth = (w * 2) / px;
  ctx.stroke(p);
  ctx.globalCompositeOperation = op;
  ctx.strokeStyle = rgba(core, Math.min(1, 0.95 * a));
  ctx.lineWidth = w / px;
  ctx.stroke(p);
}

/** The mouth's palette: pearl enamel with a cool rim, warm ivory dentine, rose pulp and gums, aqua saliva. */
export const C = {
  enamel: '#f4fbff',
  enamelIn: '#cfe3f0',
  enamelRim: '#bff3ff',
  dentine: '#e9c99c',
  dentineIn: '#b88a70',
  pulp: '#8a2448',
  gum: '#d86a8c',
  gumDeep: '#8e3459',
  gumRim: '#ffc0d2',
  bone: '#3d2147',
  boneRim: '#e8d4ee',
  pdl: '#5e2442',
  cementum: '#ffe9c8',
  saliva: '#8fe3ff',
  calcium: '#ffd98a',
  phosphate: '#c9b6ff',
  fluoride: '#c8fff4',
  acid: '#ff8a5c',
  bicarb: '#9fe9ff',
  vein: '#8f7bff',
  nerve: '#fff1c9',
} as const;

/** One of the game's own words in the page's language (a world's counter). */
export function word(key: string, vars: Record<string, string | number> = {}): string {
  const cat = (WORDS[lang] ?? WORDS.pl) as Record<string, unknown>;
  let s = (cat[key] ?? (WORDS.pl as Record<string, unknown>)[key] ?? key) as string;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** A decimal written in the page's style (0,2 in pl/de/sv, 0.2 in en). */
export function dec(v: number, digits = 1): string {
  const s = v.toFixed(digits);
  return lang === 'en' ? s : s.replace('.', ',');
}

/**
 * A small text at a world point, drawn at a true screen size (the world's transform would scale a font; the canvas
 * draws it in device pixels instead).  `size` in CSS px.
 */
export function screenText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', base: CanvasTextBaseline = 'middle'): void {
  const t = ctx.getTransform();
  const a = t.a ?? 1, b = t.b ?? 0, c = t.c ?? 0, d = t.d ?? 1, e = t.e ?? 0, f = t.f ?? 0;
  const p = { x: a * x + c * y + e, y: b * x + d * y + f };
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 ${Math.round(size * dpr)}px ${SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3 * dpr;
  ctx.strokeStyle = 'rgba(8,10,24,.7)';
  ctx.strokeText(text, p.x, p.y);
  ctx.fillStyle = color;
  ctx.fillText(text, p.x, p.y);
  ctx.restore();
}
