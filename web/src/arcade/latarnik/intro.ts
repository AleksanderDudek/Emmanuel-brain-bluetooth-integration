/**
 * Latarnik's calibration intro, "Zmierzch": the lighthouse at dusk seen from the shore.  While the
 * reference fills (`p` 0..1) night falls, stars come out and a lamp climbs the tower's seven
 * windows; at 1 the lantern ignites and its beam starts sweeping the sky.  The runner's
 * calibration card covers the lower part, so the tower stands high, or beside the card when wide.
 */
import { clamp } from '../kit/juice';
import { C, hash, sprites } from './paint';

const TAU = Math.PI * 2;

export class DuskIntro {
  private clock = 0;
  private ignite = 0;
  private cache: { w: number; h: number; sky: CanvasGradient; sea: CanvasGradient; body: CanvasGradient; band: CanvasGradient } | null = null;

  /** One frame in CSS pixels (the caller set the transform); `built` village steps stand on the dune. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, built: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.ignite = p >= 0.999 ? Math.min(1, this.ignite + dt / 0.6) : 0;
    const t = this.clock;
    const portrait = h > w;
    const horizon = h * (portrait ? 0.5 : 0.6);
    const x0 = portrait ? w * 0.5 : w * (w > 1100 ? 0.76 : 0.86);
    const T = Math.min(h * (portrait ? 0.28 : 0.4), portrait ? w * 0.5 : h * 0.42);
    const g = this.gradients(ctx, w, h, horizon, x0, T * 0.17);
    ctx.fillStyle = g.sky;
    ctx.fillRect(0, 0, w, horizon);
    // night falls as the reference fills
    ctx.fillStyle = `rgba(6,10,28,${0.12 + 0.4 * p})`;
    ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 80; i++) {
      const sy = hash(i + 11) * horizon * 0.8;
      ctx.globalAlpha = clamp(p * 1.4 - hash(i + 12) * 0.6) * (0.35 + 0.45 * Math.sin(t * (0.6 + hash(i)) + i) ** 2) * (1 - sy / horizon);
      ctx.beginPath();
      ctx.arc(hash(i + 10) * w, sy, hash(i + 13) < 0.12 ? 1.4 : 0.8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a young moon
    const mr = Math.max(7, T * 0.06), mx = w * (portrait ? 0.2 : 0.16), my = horizon * 0.22;
    ctx.fillStyle = 'rgba(255,244,214,.92)';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#141a3e';
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr, 0, TAU);
    ctx.fill();
    this.sea(ctx, w, h, horizon, x0, t, g.sea);
    this.dune(ctx, x0, horizon, T, p, built);
    this.tower(ctx, x0, horizon, T, p, t, g.body, g.band);
  }

  private gradients(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, x0: number, wb: number) {
    const c = this.cache;
    if (c && c.w === w && c.h === h) return c;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#0b1533');
    sky.addColorStop(0.6, '#1f2656');
    sky.addColorStop(0.82, '#4b3d72');
    sky.addColorStop(0.96, '#c27a72');
    sky.addColorStop(1, '#e0977a');
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, '#2a3466');
    sea.addColorStop(0.3, '#141d42');
    sea.addColorStop(1, '#060b1d');
    const body = ctx.createLinearGradient(x0 - wb / 2, 0, x0 + wb / 2, 0);
    body.addColorStop(0, '#ddd6cc');
    body.addColorStop(0.5, '#bbb3aa');
    body.addColorStop(1, '#6e6a6c');
    const band = ctx.createLinearGradient(x0 - wb / 2, 0, x0 + wb / 2, 0);
    band.addColorStop(0, '#b23c2a');
    band.addColorStop(1, '#6e2219');
    this.cache = { w, h, sky, sea, body, band };
    return this.cache;
  }

  /** The sea, with the dusk caught in broken ripples and, once lit, the lamp mirrored under the tower. */
  private sea(ctx: CanvasRenderingContext2D, w: number, h: number, horizon: number, x0: number, t: number, fill: CanvasGradient): void {
    ctx.fillStyle = fill;
    ctx.fillRect(0, horizon, w, h - horizon);
    const depth = h - horizon;
    for (let i = 0; i < 70; i++) {
      const row = hash(i + 200);
      const y = horizon + 3 + row * row * depth * 0.9;
      const near = (y - horizon) / depth;
      const len = (8 + 34 * hash(i + 201)) * (1 - near * 0.5);
      const x = ((hash(i + 202) * w * 1.2 + t * (6 + 8 * hash(i + 203))) % (w * 1.2)) - w * 0.1;
      ctx.globalAlpha = 0.5 * (1 - near) * (0.5 + 0.5 * Math.sin(t * 1.3 + i));
      ctx.fillStyle = near < 0.3 ? '#e9a38a' : '#7d8cc8';
      ctx.fillRect(x, y, len, 1);
    }
    if (this.ignite > 0) {
      // the lamp's light trembling on the water below the tower
      ctx.fillStyle = C.gold;
      for (let i = 0; i < 22; i++) {
        const y = horizon + 4 + i * depth * 0.03;
        const wob = Math.sin(t * 3 + i * 1.7) * (4 + i * 0.6);
        ctx.globalAlpha = this.ignite * 0.55 * (1 - i / 24) * (0.6 + 0.4 * Math.sin(t * 5 + i));
        ctx.fillRect(x0 + wob - (6 + i * 0.8), y, 12 + i * 1.6, 1.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The dune under the tower and the village's silhouettes, their windows lit as night falls. */
  private dune(ctx: CanvasRenderingContext2D, x0: number, horizon: number, T: number, p: number, built: number): void {
    const base = horizon + T * 0.05;
    ctx.fillStyle = '#0c1024';
    ctx.beginPath();
    ctx.moveTo(x0 - T * 1.1, horizon + 2);
    ctx.quadraticCurveTo(x0 - T * 0.5, base - T * 0.16, x0, base - T * 0.12);
    ctx.quadraticCurveTo(x0 + T * 0.55, base - T * 0.1, x0 + T * 1.05, horizon + 2);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < Math.min(built, 5); i++) {
      const hx = x0 + (i % 2 ? 1 : -1) * T * (0.28 + 0.16 * Math.floor(i / 2)), hy = base - T * 0.1;
      const hw = T * 0.11, hh = T * 0.07;
      ctx.fillStyle = '#0c1024';
      ctx.beginPath();
      ctx.moveTo(hx - hw / 2, hy);
      ctx.lineTo(hx - hw / 2, hy - hh);
      ctx.lineTo(hx, hy - hh * 1.7);
      ctx.lineTo(hx + hw / 2, hy - hh);
      ctx.lineTo(hx + hw / 2, hy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.globalAlpha = clamp(p * 2);
      ctx.fillRect(hx - hw * 0.12, hy - hh * 0.65, hw * 0.24, hh * 0.32);
      ctx.globalAlpha = 1;
    }
  }

  /** The striped tower: seven windows light up one by one, then the lantern ignites and sweeps. */
  private tower(ctx: CanvasRenderingContext2D, x0: number, horizon: number, T: number, p: number, t: number, body: CanvasGradient, band: CanvasGradient): void {
    const base = horizon + T * 0.05;
    const top = base - T * 0.12 - T, wb = T * 0.17, wt = T * 0.115;
    const by = base - T * 0.1;
    const sp = sprites();
    ctx.beginPath();
    ctx.moveTo(x0 - wb / 2, by);
    ctx.lineTo(x0 - wt / 2, top + T * 0.12);
    ctx.lineTo(x0 + wt / 2, top + T * 0.12);
    ctx.lineTo(x0 + wb / 2, by);
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = band;
    for (let i = 0; i < 3; i++) ctx.fillRect(x0 - wb, by - T * (0.2 + i * 0.27), wb * 2, T * 0.12);
    ctx.restore();
    for (let i = 0; i < 7; i++) {
      const wy = by - T * (0.1 + i * 0.112);
      const on = clamp((p - i / 7.4) * 9);
      ctx.fillStyle = '#20212c';
      ctx.fillRect(x0 - T * 0.016, wy - T * 0.03, T * 0.032, T * 0.05);
      if (on > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = on;
        ctx.drawImage(sp.cream, x0 - T * 0.06, wy - T * 0.065, T * 0.12, T * 0.12);
        ctx.restore();
        ctx.globalAlpha = on;
        ctx.fillStyle = C.gold;
        ctx.fillRect(x0 - T * 0.016, wy - T * 0.03, T * 0.032, T * 0.05);
        ctx.globalAlpha = 1;
      }
    }
    // the gallery, the lantern room (a faint glow until it ignites), the cap
    ctx.fillStyle = '#1b1d26';
    ctx.fillRect(x0 - wt * 0.75, top + T * 0.1, wt * 1.5, T * 0.035);
    const lit = this.ignite;
    ctx.fillStyle = lit > 0 ? '#fff4d6' : `rgba(255,200,120,${0.18 + 0.3 * p})`;
    ctx.fillRect(x0 - wt * 0.38, top + T * 0.02, wt * 0.76, T * 0.08);
    ctx.fillStyle = '#7d2a1f';
    ctx.beginPath();
    ctx.moveTo(x0 - wt * 0.5, top + T * 0.025);
    ctx.lineTo(x0, top - T * 0.04);
    ctx.lineTo(x0 + wt * 0.5, top + T * 0.025);
    ctx.closePath();
    ctx.fill();
    if (lit <= 0) return;
    const lampY = top + T * 0.06;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // seen from the shore, the turning beam swings left and right and flares when it faces us
    const phi = t * 1.7;
    const facing = Math.cos(phi), toward = Math.sin(phi);
    const len = T * 3.2 * Math.abs(facing) * lit;
    const dir = facing >= 0 ? 1 : -1;
    const beam = ctx.createLinearGradient(x0, lampY, x0 + dir * len, lampY);
    beam.addColorStop(0, `rgba(255,226,160,${0.55 * lit})`);
    beam.addColorStop(1, 'rgba(255,226,160,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(x0, lampY - T * 0.015);
    ctx.lineTo(x0 + dir * len, lampY - T * 0.22);
    ctx.lineTo(x0 + dir * len, lampY + T * 0.16);
    ctx.lineTo(x0, lampY + T * 0.015);
    ctx.closePath();
    ctx.fill();
    const flare = T * (0.25 + 0.55 * Math.max(0, toward) ** 3) * lit;
    ctx.drawImage(sp.cream, x0 - flare, lampY - flare, flare * 2, flare * 2);
    ctx.restore();
  }
}
