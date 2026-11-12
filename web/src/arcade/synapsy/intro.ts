/**
 * Synapsy's calibration scene: while the band takes its reference (`p` 0..1), the brain wakes — the
 * hemispheres glow in out of the night, the neurons light one by one from the back to the front, the links
 * the player consolidated before reappear in gold, and at the end the headband's two optodes on the forehead
 * come on.  The runner's calibration card covers the lower part of the screen, so the brain sits high.
 */
import { approach, clamp } from '../kit/juice';
import { HEMI, makeBrain, type Brain } from './brain';
import type { SynapsyProgress } from './meta';
import { C, glow, gyri, hash, hemiPath, mix, withAlpha } from './paint';

const TAU = Math.PI * 2;

export class SynapsyIntro {
  private clock = 0;
  private shown = 0;
  private brain: Brain | null = null;
  private seed = -1;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: SynapsyProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const seed = progress.seed || 7;
    if (!this.brain || this.seed !== seed) {
      this.brain = makeBrain(seed);
      this.seed = seed;
    }
    const B = this.brain;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, C.bg1);
    bg.addColorStop(1, C.bg0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const s = Math.max(30, Math.min(w * 0.4, h * 0.27));
    const cx = w / 2, cy = Math.max(s * 1.15, h * 0.32);
    ctx.globalAlpha = 0.35 + 0.65 * k;
    for (const side of [-1, 1] as const) {
      const path = hemiPath(cx, cy, s, side);
      ctx.fillStyle = C.tissue;
      ctx.fill(path);
      gyri(ctx, cx, cy, s, side, side < 0 ? 3 : 8);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = withAlpha(C.rim, 0.5);
      ctx.stroke(path);
    }
    ctx.globalAlpha = 1;
    // the links kept from before come back first, in gold
    ctx.lineCap = 'round';
    for (const [a, b] of progress.links ?? []) {
      const A = B.neurons[a], N = B.neurons[b];
      if (!A || !N) continue;
      ctx.beginPath();
      ctx.moveTo(cx + A.x * s, cy + A.y * s);
      ctx.lineTo(cx + N.x * s, cy + N.y * s);
      ctx.lineWidth = 2;
      ctx.strokeStyle = withAlpha(C.goldHi, 0.25 + 0.5 * k);
      ctx.stroke();
    }
    // the neurons wake from the back to the front as the reference fills
    ctx.globalCompositeOperation = 'lighter';
    for (const n of B.neurons) {
      const order = (1 - (n.y + 1) / 2) * 0.85 + hash(n.id) * 0.15;
      const on = clamp((k - order * 0.9) * 6);
      if (on <= 0) continue;
      const x = cx + n.x * s, y = cy + n.y * s;
      const tw = 0.7 + 0.3 * Math.sin(t * 3 + n.id);
      glow(ctx, n.io ? C.gold : C.halo, x, y, s * 0.09 * on, 0.5 * on * tw);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const n of B.neurons) {
      const order = (1 - (n.y + 1) / 2) * 0.85 + hash(n.id) * 0.15;
      const on = clamp((k - order * 0.9) * 6);
      ctx.beginPath();
      ctx.arc(cx + n.x * s, cy + n.y * s, Math.max(1.5, s * 0.022), 0, TAU);
      ctx.fillStyle = mix('#3a2f80', C.soma, on);
      ctx.fill();
    }
    // the headband over the forehead, its optodes lighting at the end
    const y0 = cy - (HEMI.ry + 0.07) * s;
    ctx.beginPath();
    ctx.ellipse(cx, y0 + s * 0.2, s * 0.62, s * 0.2, 0, Math.PI * 1.12, Math.PI * 1.88);
    ctx.lineWidth = Math.max(2, s * 0.03);
    ctx.strokeStyle = 'rgba(220,210,255,0.25)';
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * s * 0.36, y0 + s * 0.035, Math.max(2.5, s * 0.022), 0, TAU);
      ctx.fillStyle = mix('#5b4f98', '#dff4ff', clamp((k - 0.8) * 5));
      ctx.fill();
    }
  }
}
