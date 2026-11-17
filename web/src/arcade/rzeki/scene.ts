/**
 * A quiet picture of Rzeki żywej wody for the screens around play — the calibration intro and the lobby's hero
 * and card: the sky, the open heaven's rays, the two shells of light around the figure (picture 2's ovals), the
 * egg of light, the figure, its column, the stations of the map (those the player has lit glowing from the lobby's
 * map: windows on the midline and above the head, the three channels with their sun and moon, the Void's ring, the
 * sacrum's spiral, the hand map's lights, the soles), a stream of light walking down the column with the two
 * threads behind it, and each window opening as the stream reaches it.  Baked once per size.
 */
import { clamp, ease } from '../kit/juice';
import { HAND_COLOURS, HAND_ORDER, MAP, STATION, STATIONS, type MapId, type StationId } from './content';
import { CHANNELS, MEDALLION_R, MOON, SACRUM_PTS, SHELL, SUN, VOID, handPoint, shellPt, soleAt, spiralPts, type P } from './figure';
import {
  GOLD, GOLD_HI, MOON_SILVER, PEARL, SILVER, SUN_GOLD, WATER, auraSprite, bakeFigure, bakeRays, bakeRoses, bakeSky, bloom, columnSprite, glow, medallionSprite,
  mix, poolSprite, rgbaPrefix, type FigureLayer, type Layer, type RoseLayers,
} from './paint';
import { fullPath } from './rose';

const TAU = Math.PI * 2;

export interface SceneBox { cx: number; top: number; H: number }

interface Baked { key: string; sky: Layer | null; rays: Layer | null; raysBox: { x: number; y: number; w: number; h: number }; fig: FigureLayer | null; roses: Partial<Record<StationId, RoseLayers>> }

export class QuietScene {
  private b: Baked | null = null;

  /**
   * Draw the picture into w × h with the figure in `box`.  `t` in seconds drives the stream; `walk` (0..1, or null
   * for the stream's own loop) where it is along the way; `glowOf(s)` how much a station glows from the map (0..1);
   * `heaven` how open the heaven is (0..1); `map` the stations shown (all by default).
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, box: SceneBox, t: number,
    o: { walk?: number | null; glowOf?: (s: StationId) => number; tierOf?: (s: StationId) => number; heaven?: number; still?: boolean; stream?: boolean; map?: MapId } = {}): void {
    const tiers = Object.fromEntries(STATIONS.map(s => [s, o.tierOf ? o.tierOf(s) : 0])) as Record<StationId, number>;
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${Math.round(box.cx)},${Math.round(box.top)},${Math.round(box.H)}|${STATIONS.map(s => tiers[s]).join('')}`;
    const H = box.H, cx = box.cx;
    const fp = (p: P): { x: number; y: number } => ({ x: cx + p[0] * H, y: box.top + p[1] * H });
    if (this.b?.key !== key) {
      const rw = Math.min(w * 1.2, H * 1.3), y0 = box.top - 0.62 * H, y1 = box.top + 0.04 * H;
      this.b = {
        key,
        sky: bakeSky(w, h, dpr, { cx, midY: box.top + H * 0.45, H }),
        rays: bakeRays(rw, y1 - y0, dpr, rw / 2),
        raysBox: { x: cx - rw / 2, y: y0, w: rw, h: y1 - y0 },
        fig: bakeFigure(box, dpr),
        roses: bakeRoses(H * 0.075, dpr, tiers),
      };
    }
    const b = this.b, list = MAP[o.map ?? 'all'].stations;
    if (b.sky) ctx.drawImage(b.sky, 0, 0, w, h);
    else {
      ctx.fillStyle = '#120c34';
      ctx.fillRect(0, 0, w, h);
    }
    const heaven = clamp(o.heaven ?? 0.6);
    bloom(ctx, '#8f7cff', cx, box.top + H * 0.45, H * 0.8, 0.2);
    glow(ctx, GOLD_HI, cx, box.top - H * 0.5, H * 0.42, 0.12 + 0.12 * heaven);
    if (b.rays) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.25 + 0.6 * heaven;
      ctx.drawImage(b.rays, b.raysBox.x, b.raysBox.y, b.raysBox.w, b.raysBox.h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    const glowOf = o.glowOf ?? (() => 0);
    const litN = list.reduce((n, s) => n + (glowOf(s) > 0 ? 1 : 0), 0) / Math.max(1, list.length);
    // the two shells of light around the whole figure, as picture 2 draws them
    for (const s of ['gateway', 'galactic'] as const) {
      if (!list.includes(s)) continue;
      const sh = SHELL[s], g = glowOf(s);
      const path = new Path2D();
      for (let i = 0; i <= 96; i++) {
        const q = fp(shellPt(sh, (i / 96) * TAU));
        if (i) path.lineTo(q.x, q.y); else path.moveTo(q.x, q.y);
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (g > 0) {
        ctx.strokeStyle = `${rgbaPrefix(STATION[s].hue)}${(0.12 * g).toFixed(3)})`;
        ctx.lineWidth = Math.max(4, H * 0.02);
        ctx.stroke(path);
      }
      ctx.strokeStyle = `rgba(235,232,255,${(0.32 + 0.4 * g).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, H * 0.0035);
      ctx.stroke(path);
      ctx.restore();
    }
    // the egg of light and the pool
    const aura = auraSprite(), pool = poolSprite();
    const breathe = o.still ? 0.5 : 0.5 + 0.5 * Math.sin(t * 0.6);
    if (aura) {
      const g = 0.9 + 0.14 * litN + 0.03 * breathe;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.35 * litN;
      ctx.drawImage(aura, cx - H * 0.33 * g, box.top + H * 0.47 - H * 0.6 * g, H * 0.66 * g, H * 1.2 * g);
      if (pool) {
        ctx.globalAlpha = 0.45;
        ctx.drawImage(pool, cx - H * 0.2, box.top + H - H * 0.025, H * 0.4, H * 0.05);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (b.fig) ctx.drawImage(b.fig.c, b.fig.box.x, b.fig.box.y, b.fig.box.w, b.fig.box.h);
    // the stream walking down the column (its own loop: 9 s down, a breath in the light, again)
    const cyc = 12, q = (t % cyc) / cyc;
    const streaming = o.stream !== false;
    const walk = streaming ? o.walk ?? (q < 0.8 ? q / 0.8 : 1) : -1;
    const whole = streaming && o.walk == null && q >= 0.8 ? Math.sin(((q - 0.8) / 0.2) * Math.PI) : 0;
    const ys = list.map(s => STATION[s].y);
    const top = box.top + Math.min(...ys) * H, bottom = box.top + Math.min(1, Math.max(...ys)) * H;
    const y = top + (bottom - top) * ease.inOutSine(clamp(walk));
    const col = columnSprite(PEARL);
    if (col) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22;
      ctx.drawImage(col, cx - H * 0.025, top, H * 0.05, bottom - top);
      ctx.globalAlpha = streaming ? 0.55 : 0.3;
      ctx.drawImage(col, cx - H * 0.03, top - H * 0.3, H * 0.06, (streaming ? y : top) - top + H * 0.3);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the threads behind the stream
    const crown = box.top - 0.022 * H;
    if (!o.still && streaming && y > crown) {
      for (const side of [-1, 1]) {
        const p = new Path2D();
        let first = true;
        for (let yy = crown; yy <= Math.min(y, box.top + H * 0.985); yy += 3) {
          const th = (TAU * (yy - crown)) / (H * 0.12) - t * TAU * 0.5;
          const taper = clamp((yy - crown) / (H * 0.03)) * clamp((y - yy) / (H * 0.03));
          const x = cx + side * H * 0.024 * taper * Math.sin(th);
          if (first) { p.moveTo(x, yy); first = false; } else p.lineTo(x, yy);
        }
        ctx.strokeStyle = `${rgbaPrefix(side < 0 ? GOLD : SILVER)}.8)`;
        ctx.lineWidth = Math.max(1, H * 0.004);
        ctx.stroke(p);
      }
    }
    // the stations: lit by the stream as it passes (and from the map)
    for (const s of list) {
      const st = STATION[s], g = glowOf(s);
      const py = box.top + st.y * H;
      const passed = streaming && py <= y + 0.5;
      const lit = Math.max(passed ? 1 : 0, g * 0.8, whole);
      switch (st.kind) {
        case 'channels': {
          ctx.save();
          ctx.lineCap = 'round';
          ctx.globalCompositeOperation = 'lighter';
          for (const [pts, hue] of [[CHANNELS.pingala, SUN_GOLD], [CHANNELS.sushumna, '#ffffff'], [CHANNELS.ida, MOON_SILVER]] as const) {
            const path = new Path2D();
            pts.forEach((p, i) => { const w2 = fp(p); if (i) path.lineTo(w2.x, w2.y); else path.moveTo(w2.x, w2.y); });
            ctx.strokeStyle = `${rgbaPrefix(hue)}${(0.1 + 0.5 * lit).toFixed(3)})`;
            ctx.lineWidth = Math.max(1, H * 0.004);
            ctx.stroke(path);
          }
          ctx.restore();
          for (const [pt, kind] of [[SUN, 'sun'], [MOON, 'moon']] as const) {
            const spr = medallionSprite(kind), m = fp(pt), r = MEDALLION_R * H * 1.35;
            if (!spr) continue;
            ctx.globalAlpha = 0.3 + 0.7 * lit;
            ctx.drawImage(spr, m.x - r, m.y - r, 2 * r, 2 * r);
            ctx.globalAlpha = 1;
          }
          break;
        }
        case 'ring': {
          const c = fp([VOID.cx, VOID.cy]);
          ctx.strokeStyle = `${rgbaPrefix(st.hue)}${(0.14 + 0.6 * lit).toFixed(3)})`;
          ctx.lineWidth = Math.max(1, H * (0.003 + 0.01 * lit));
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, VOID.rx * H, VOID.ry * H, 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'bone': {
          const path = new Path2D();
          SACRUM_PTS.forEach((p, i) => { const w2 = fp(p); if (i) path.lineTo(w2.x, w2.y); else path.moveTo(w2.x, w2.y); });
          path.closePath();
          ctx.fillStyle = `${rgbaPrefix(st.hue)}${(0.1 + 0.4 * lit).toFixed(3)})`;
          ctx.fill(path);
          ctx.strokeStyle = `${rgbaPrefix(st.hue)}${(0.3 + 0.5 * lit).toFixed(3)})`;
          ctx.lineWidth = Math.max(0.8, H * 0.003);
          ctx.stroke(path);
          if (lit > 0.05) {
            const sp = new Path2D();
            spiralPts(1, 64).forEach((p, i) => { const w2 = fp(p); if (i) sp.lineTo(w2.x, w2.y); else sp.moveTo(w2.x, w2.y); });
            ctx.strokeStyle = `rgba(255,255,255,${(0.8 * lit).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.7, H * 0.0025);
            ctx.stroke(sp);
          }
          break;
        }
        case 'hands': {
          for (const side of [-1, 1] as const) {
            for (const part of HAND_ORDER) {
              const p = fp(handPoint(part, side));
              glow(ctx, HAND_COLOURS[part], p.x, p.y, Math.max(2, H * 0.012), 0.2 + 0.7 * lit);
            }
          }
          break;
        }
        case 'feet': {
          for (const side of [-1, 1] as const) {
            const p = fp(soleAt(side));
            bloom(ctx, st.hue, p.x, p.y, H * 0.05, 0.1 + 0.4 * lit);
          }
          break;
        }
        default: {
          const c = { x: cx + st.x * H, y: py };
          const rose = b.roses[s];
          if (lit > 0.05 && rose) {
            const near = 1 - clamp(Math.abs(py - y) / (H * 0.06));
            const R = H * (0.026 + 0.036 * near) * (st.kind === 'shell' ? 0.8 : 1);
            bloom(ctx, st.hue, c.x, c.y, R * 3.4, 0.35 + 0.3 * lit);
            const k = R / rose.R;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.scale(k, k);
            ctx.globalAlpha = clamp(lit);
            if (near > 0 && near < 1 && passed) {
              ctx.drawImage(rose.lead, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
              ctx.clip(fullPath(st.rose, rose.R, 0.35 + 0.65 * near));
            }
            ctx.drawImage(rose.glass, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
            // the light coming through the glass from behind
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = clamp(lit) * 0.28;
            ctx.drawImage(rose.glass, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
            ctx.restore();
            glow(ctx, '#ffffff', c.x, c.y, R * 0.5, 0.26 * lit);
          } else {
            glow(ctx, st.hue, c.x, c.y, Math.max(3, H * 0.012) * 3.4, 0.24);
            ctx.fillStyle = `${rgbaPrefix(mix(st.hue, '#ffffff', 0.2))}.6)`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, Math.max(1.5, H * 0.0075), 0, TAU);
            ctx.fill();
          }
        }
      }
    }
    if (!o.still && streaming && walk < 1) {
      glow(ctx, WATER, cx, y, H * 0.06, 0.7);
      glow(ctx, '#ffffff', cx, y, H * 0.02, 0.9);
    }
    if (whole > 0) glow(ctx, GOLD_HI, cx, box.top + H * 0.45, H * 0.8, 0.28 * whole);
  }
}
