/**
 * Synapsy's picture for the lobby's hero and the game card: the two hemispheres from above with a path of
 * light from the eye at the back to the hand, a thought running along it (hopping on its myelin), a second
 * one crossing the corpus callosum, the bridge glowing in step and breathing out of it, and Oli at work on an
 * axon.  In the lobby the player's own consolidated links are drawn in gold.  Drawn every frame: cheap, no state.
 */
import { clamp } from '../kit/juice';
import { HEMI, makeBrain, type Brain } from './brain';
import type { SynapsyProgress } from './meta';
import { C, glow, hemiPath, ioIcon, mix, paintOli, withAlpha } from './paint';

const TAU = Math.PI * 2;
let cached: { seed: number; brain: Brain } | null = null;

const brainOf = (seed: number): Brain => {
  if (!cached || cached.seed !== seed) cached = { seed, brain: makeBrain(seed) };
  return cached.brain;
};

/** Two demo paths on the template: the eye to the right hand, and across the bridge (by neuron order in the template). */
const SEE = [18, 14, 11, 8, 6];
const CROSS = [37, 35, 32, 13, 10, 8, 6];

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: SynapsyProgress): void {
  const B = brainOf(p?.seed || 777);
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
  bg.addColorStop(0, C.bg2);
  bg.addColorStop(1, C.bg0);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const s = Math.max(20, Math.min(w / 2.2, h / 2.15));
  const cx = w / 2, cy = h / 2 + s * 0.02;
  for (const side of [-1, 1] as const) {
    const path = hemiPath(cx, cy, s, side);
    ctx.fillStyle = C.tissue;
    ctx.fill(path);
    ctx.lineWidth = Math.max(1, s * 0.012);
    ctx.strokeStyle = withAlpha(C.rim, 0.55);
    ctx.stroke(path);
  }
  const at = (n: number) => ({ x: cx + B.neurons[n].x * s, y: cy + B.neurons[n].y * s });
  // the bridge, in step: breathing gold
  const inStep = 0.5 + 0.5 * Math.sin(t * 0.8);
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.bridgeOn, cx, cy + s * 0.13, s * (0.2 + 0.1 * inStep), 0.25 + 0.35 * inStep);
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineCap = 'round';
  // the player's kept links
  for (const [a, b] of p?.links ?? []) {
    if (!B.neurons[a] || !B.neurons[b]) continue;
    const A = at(a), N = at(b);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(N.x, N.y);
    ctx.lineWidth = Math.max(1.2, s * 0.012);
    ctx.strokeStyle = withAlpha(C.goldHi, 0.55);
    ctx.stroke();
  }
  // the demo paths, myelinated in part
  const paths = [SEE, CROSS].map(path => path.filter(n => n < B.neurons.length));
  for (const path of paths) {
    ctx.beginPath();
    path.forEach((n, i) => { const q = at(n); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
    ctx.lineWidth = Math.max(1.5, s * 0.018);
    ctx.strokeStyle = mix(C.link, C.linkHi, 0.4);
    ctx.stroke();
  }
  // neurons
  for (const n of B.neurons) {
    const q = at(n.id);
    if (n.io === 'eye' || n.io === 'hand') {
      ioIcon(ctx, n.io, q.x, q.y, Math.max(4, s * 0.05), n.side < 0 ? C.goldHi : '#bcaef0');
    } else {
      ctx.beginPath();
      ctx.arc(q.x, q.y, Math.max(1.2, s * 0.018), 0, TAU);
      ctx.fillStyle = C.soma;
      ctx.fill();
    }
  }
  // thoughts running
  ctx.globalCompositeOperation = 'lighter';
  paths.forEach((path, j) => {
    // the lobby's clock can start a hair below zero (a frame stamped before it opened): keep the phase in 0..1
    const ph = t * (j ? 0.32 : 0.45) + j * 0.4;
    const k = (((ph % 1) + 1) % 1) * (path.length - 1);
    const i = Math.max(0, Math.min(path.length - 2, Math.floor(k))), r = clamp(k - i);
    const a = at(path[i]), b = at(path[Math.min(path.length - 1, i + 1)]);
    const hop = j === 0 ? Math.round(r * 4) / 4 : r;
    const x = a.x + (b.x - a.x) * hop, y = a.y + (b.y - a.y) * hop;
    glow(ctx, j ? C.habit : C.gold, x, y, s * 0.12, 0.7);
    glow(ctx, '#ffffff', x, y, s * 0.035, 1);
  });
  ctx.globalCompositeOperation = 'source-over';
  // Oli at work on the first path
  const a = at(SEE[1]), b = at(SEE[2]);
  paintOli(ctx, (a.x + b.x) / 2 + Math.sin(t * 3) * s * 0.02, (a.y + b.y) / 2 - s * 0.08, Math.max(5, s * 0.07), t, { wrap: 1, happy: 0.8 });
  // the headband's optodes
  const y0 = cy - (HEMI.ry + 0.05) * s;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.36, y0, Math.max(1.5, s * 0.02), 0, TAU);
    ctx.fillStyle = '#dff4ff';
    ctx.fill();
  }
}
