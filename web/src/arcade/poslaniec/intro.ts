/**
 * Posłaniec's calibration intro, "Przed świtem" (before dawn): the Roman road runs out of Ephesus
 * into the dark hills; the messenger stands at its start with the satchel of letters.  While the
 * reference fills (`p` 0..1) the night pales to dawn, the stars go out, the sun rises behind the far
 * hills and the first light runs along the road; at 1 the messenger leans forward, ready to run.
 * The runner's calibration card covers the lower part of the screen, so the messenger stands high.
 */
import { approach, clamp, ease } from '../kit/juice';
import { CLOAKS } from './content';
import { cloakOf, type PoslaniecProgress } from './meta';
import { hash, paintRunner, skyAt, type RunnerPose, type SkyLook } from './paint';
import { paintRoadView } from './preview';

export class PoslaniecIntro {
  private clock = 0;
  private shown = 0;
  private readonly sky: SkyLook = skyAt(-1);
  private readonly pose: RunnerPose = { stride: 0, air: 0, slide: 0, lean: 0, squash: 0, stumble: 0, wool: CLOAKS[0].wool, trim: CLOAKS[0].trim, t: 0, alpha: 1 };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: PoslaniecProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    skyAt(-1 + ease.inOutSine(k), this.sky);
    const tall = h > w;
    const horizon = h * (tall ? 0.42 : 0.5);
    paintRoadView(ctx, w, h, horizon, this.sky, 0, 'efez', 0, t * 0.2);
    // the stars fade as the sky pales
    if (k < 0.8) {
      ctx.fillStyle = `rgba(255,248,230,${(0.8 - k) * 1.1})`;
      for (let i = 0; i < 60; i++) {
        const x = hash(i) * w, y = hash(i + 50) * horizon * 0.7;
        const r = 0.7 + hash(i + 99) * 1.2 + 0.3 * Math.sin(t * 2 + i);
        ctx.fillRect(x, y, r, r);
      }
    }
    // the night's shade lifting from the land
    ctx.fillStyle = `rgba(14,16,40,${0.55 * (1 - k)})`;
    ctx.fillRect(0, horizon, w, h - horizon);
    // the first light running along the road
    if (k > 0.4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(w / 2, horizon, 0, w / 2, horizon, Math.max(w, h) * 0.6);
      g.addColorStop(0, `rgba(255,214,150,${(k - 0.4) * 0.6})`);
      g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // the messenger at the road's start, high enough to clear the calibration card
    const cloak = CLOAKS[cloakOf(progress)];
    const pose = this.pose;
    pose.wool = cloak.wool;
    pose.trim = cloak.trim;
    pose.t = t;
    pose.lean = k > 0.85 ? -0.08 * clamp((k - 0.85) / 0.15) : 0;
    pose.stride = k > 0.95 ? t * 0.8 : 0.5;
    const s = Math.max(30, Math.min(w, h) * 0.2);
    const fy = horizon + (h - horizon) * (tall ? 0.42 : 0.5);
    ctx.fillStyle = 'rgba(20,14,20,.3)';
    ctx.beginPath();
    ctx.ellipse(w / 2, fy, s * 0.4, s * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    paintRunner(ctx, w / 2, fy + Math.sin(t * 1.5) * 0.6, s, pose);
  }
}
