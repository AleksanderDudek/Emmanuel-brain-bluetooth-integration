/**
 * Odnowa's lobby picture and card art: the ATP turbine turning in its lens over a strip of the double helix,
 * golden ATP leaving it, Mito beside it — and, in the lobby, the player's own tissue: the cells grown so far
 * (gut lining, skin, blood) gathered round the lens.  Static layers are cached per size.
 */
import { NICHES } from './content';
import type { OdnowaProgress } from './meta';
import {
  C, glow, paintAtp, paintCellIcon, paintGauge, paintHelixStrip, paintLensBack, paintLensRim, paintMito, paintTurbine, rgba,
} from './paint';

const cache = new Map<string, HTMLCanvasElement | null>();

function backdrop(w: number, h: number): HTMLCanvasElement | null {
  const key = `${w}x${h}`;
  if (cache.has(key)) return cache.get(key)!;
  let c: HTMLCanvasElement | null = null;
  try {
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d');
    if (!g) c = null;
    else {
      const bg = g.createRadialGradient(w * 0.5, h * 0.42, 4, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bg.addColorStop(0, '#1f5a52');
      bg.addColorStop(0.6, '#103a3a');
      bg.addColorStop(1, '#071a1d');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        const x = ((i * 97) % 100) / 100 * w, y = ((i * 61) % 100) / 100 * h, r = 10 + ((i * 37) % 30) / 30 * Math.min(w, h) * 0.18;
        const gg = g.createRadialGradient(x, y, 0, x, y, r);
        gg.addColorStop(0, rgba(i % 2 ? '#ff9f8a' : '#8fe3c8', 0.1));
        gg.addColorStop(1, rgba(i % 2 ? '#ff9f8a' : '#8fe3c8', 0));
        g.fillStyle = gg;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // a strip of helix along the foot
      const amp = Math.max(6, h * 0.06), P = Math.round(amp * 4.4), sh = Math.round(amp * 3.6);
      g.save();
      g.globalAlpha = 0.85;
      for (let x = -P; x < w + P; x += P) {
        g.save();
        g.translate(x, h - sh - h * 0.04);
        paintHelixStrip(g, P, sh, amp);
        g.restore();
      }
      g.restore();
    }
  } catch {
    c = null;
  }
  cache.set(key, c);
  return c;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, p?: OdnowaProgress): void {
  const bg = backdrop(Math.round(w), Math.round(h));
  if (bg) ctx.drawImage(bg, 0, 0, w, h);
  else {
    ctx.fillStyle = '#103a3a';
    ctx.fillRect(0, 0, w, h);
  }
  const r = Math.max(26, Math.min(w * 0.22, h * 0.34));
  const cx = w * 0.56, cy = h * 0.44;
  const angle = time * 0.9;
  glow(ctx, '#9f8cff', cx, cy, r * 1.6, 0.35);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();
  paintLensBack(ctx, r);
  const third = Math.floor((angle % 1) * 3);
  const pulse = 1 - ((angle * 3) % 1);
  const beta: [number, number, number] = [0, 0, 0];
  beta[third] = pulse * pulse;
  paintTurbine(ctx, r, { angle, grad: 0.75, spin: 0.9, beta, surge: 0, t: time, veiled: false, rest: 0 });
  ctx.restore();
  paintGauge(ctx, cx, cy, r + Math.max(4, r * 0.08), 0.68 + 0.08 * Math.sin(time), C.vane, C.gold);
  paintLensRim(ctx, cx, cy, r, 0.4);
  // three ATP leave the turbine each turn and fly up and out
  for (let i = 0; i < 3; i++) {
    const k = ((angle * 3 + i) % 3) / 3;
    const a = -Math.PI / 2 + i * 0.5 - 0.5;
    const d = r * (0.3 + k * 1.6);
    paintAtp(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d - k * r * 0.3, Math.max(3, r * 0.08), time * 2 + i, 3);
  }
  const mr = Math.max(9, r * 0.24);
  paintMito(ctx, cx - r - mr * 2.2, cy - r * 0.35, mr, { t: time, talk: false, blink: (time % 4) < 0.12 ? 1 : 0, joy: 0.3, tired: 0, look: 0.6 });
  // the player's tissue: the cells grown so far, gathered round the lens
  if (p) {
    const cells: ('gut' | 'skin' | 'blood')[] = [];
    for (const n of NICHES) for (let i = 0; i < Math.min(8, p.tissue[n]); i++) cells.push(n);
    const cr = Math.max(5, r * 0.13);
    cells.slice(0, 18).forEach((n, i) => {
      const a = Math.PI * 0.15 + (i / 18) * Math.PI * 1.1;
      const d = r * 1.42 + (i % 2) * cr * 1.6;
      paintCellIcon(ctx, n, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, cr);
    });
  }
}
