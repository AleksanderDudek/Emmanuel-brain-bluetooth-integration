/**
 * Zastępy's calibration intro: the dawn before the battle.  The gate of light stands on the left of
 * the causeway, the gate of ash smoulders far on the right; while the reference fills (`p` 0..1) the
 * sun rises behind the gate, its lantern brightens and the host steps out of the arch one by one to
 * stand in a file on the road.  The runner's calibration card covers the lower part of the screen, so
 * the road runs high.
 */
import { approach, clamp, ease } from '../kit/juice';
import type { ZastepyProgress } from './meta';
import { POSE, hash, paintAshGate, paintHost, paintLightGate, type Pose } from './paint';
import { HOST_IDS, type HostId } from './rules';

export class ZastepyIntro {
  private clock = 0;
  private shown = 0;
  private readonly pose: Pose = { ...POSE };

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: ZastepyProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, t = this.clock;
    const tall = h > w;
    const S = Math.max(16, Math.min(w / (tall ? 11 : 24), h / 9));
    const roadY = h * (tall ? 0.4 : 0.46);
    // the sky: night-blue lifting into dawn
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const dawn = ease.inOutSine(k);
    g.addColorStop(0, `rgb(${Math.round(60 + 187 * dawn)},${Math.round(56 + 161 * dawn)},${Math.round(92 + 68 * dawn)})`);
    g.addColorStop(0.6, `rgb(${Math.round(120 + 135 * dawn)},${Math.round(100 + 141 * dawn)},${Math.round(130 + 71 * dawn)})`);
    g.addColorStop(1, `rgb(${Math.round(150 + 96 * dawn)},${Math.round(130 + 96 * dawn)},${Math.round(150 + 50 * dawn)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const gx = w * (tall ? 0.24 : 0.2);
    // the sun behind the gate of light
    const sy = roadY - S * (2 + 4 * dawn);
    const sun = ctx.createRadialGradient(gx - S, sy, 0, gx - S, sy, Math.max(w, h) * 0.5);
    sun.addColorStop(0, `rgba(255,250,225,${0.4 + 0.6 * dawn})`);
    sun.addColorStop(0.3, `rgba(255,224,150,${0.3 * dawn})`);
    sun.addColorStop(1, 'rgba(255,224,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);
    // the stars going out
    for (let i = 0; i < 18; i++) {
      const a = clamp(1 - k * 1.6 - hash(i) * 0.3);
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(255,248,220,${a * (0.6 + 0.4 * Math.sin(t * 2 + i))})`;
      ctx.beginPath();
      ctx.arc(hash(i * 3 + 1) * w, hash(i * 7 + 2) * roadY * 0.8, 1.2 + hash(i * 5) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // the sea of clouds and the causeway
    ctx.fillStyle = `rgba(255,246,230,${0.55 + 0.35 * dawn})`;
    for (let i = 0; i < 14; i++) {
      const x = ((hash(i * 11) * w * 1.4 + t * (6 + hash(i) * 8)) % (w * 1.4)) - w * 0.2;
      ctx.beginPath();
      ctx.ellipse(x, roadY + S * (1 + hash(i * 13) * 3), S * (2 + hash(i * 17) * 3), S * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e9dcc0';
    ctx.fillRect(0, roadY - S * 0.9, w, S * 1.1);
    ctx.fillStyle = '#b9a07a';
    ctx.fillRect(0, roadY + S * 0.2, w, S * 0.5);
    paintAshGate(ctx, w * 0.9, roadY + 0.15 * S, S * 0.8, { ash: 1, t, fall: 0, sealed: false });
    paintLightGate(ctx, gx, roadY + 0.15 * S, S, { glow: 0.2 + 0.8 * k, walls: 1, t, mend: 0 });
    // the host steps out, one by one, into a file (more for a stronger gate)
    const n = Math.min(HOST_IDS.length, 3 + Math.floor((progress.gate - 1) / 2));
    for (let i = 0; i < n; i++) {
      const out = clamp((k - 0.12 - i * 0.12) * 4);
      if (out <= 0) continue;
      const id: HostId = HOST_IDS[i];
      const x = gx - S * 0.9 + out * S * (1.6 + (n - 1 - i) * 1.25);
      this.pose.t = t;
      this.pose.seed = i;
      this.pose.walk = out < 1 ? 1 : 0;
      this.pose.step = (t * 2 + i) % 2;
      ctx.globalAlpha = Math.min(1, out * 2);
      paintHost(ctx, id, x, roadY - S * 0.3 * (i % 2), S, this.pose);
      ctx.globalAlpha = 1;
    }
  }
}
