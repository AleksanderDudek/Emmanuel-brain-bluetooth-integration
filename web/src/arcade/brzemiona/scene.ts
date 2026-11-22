/**
 * Brzemiona's triptych, drawn from a plain state (the play view, the calibration intro and the lobby's picture all use
 * it): the dusk sky warming to gold; on the far ridge the one prayed for — a figure of light greyed in a cloud of
 * smoke, or many such figures, or the whole world as a night globe of lights; in the middle the Cross of light on its
 * low hill; near, the player, a clear figure of light.
 *
 * The exchange has two lanes and only two: on the in-breath grey smoke lifts from the one prayed for and drifts to
 * the Cross (a stream of puffs along the smoke lane), where it waits as a small cloud — turning gold while focus is
 * held; on the out-breath the gold returns along the light lane to them, and their figure brightens as their cloud
 * thins.  No lane touches the player: the smoke is never drawn entering them (layout.ts `lanes`).  The light-only
 * variant draws no smoke at all: light gathers at the Cross from above on the in-breath and flows to them on the
 * out-breath.  Reduced motion: no streams — the clouds and the light fade instead.
 */
import type { BreathPhase } from '../kit/breath';
import { clamp } from '../kit/juice';
import { laneAt, lanes, stageOf, type Layout, type Stage } from './layout';
import {
  GOLD, GOLD_HI, LILAC, PEARL, SMOKE, SMOKE_DARK, TAU, bakeCross, bakeFigure, bakeGlobe, bakeSky, cityLights, glow, hash, label, puff, type CityLight,
  type FigureStyle, type Layer,
} from './paint';

export interface SceneState {
  time: number;
  /** the sky's warmth 0..1 (dusk → gold over the session) */
  warm: number;
  /** the one prayed for: how far they have appeared, their light (the circle turned), the cloud left around them */
  appear: number;
  light: number;
  cloud: number;
  /** the many's light and the world's (each circle turns on its own) */
  lightMany: number;
  lightWorld: number;
  /** the circle: the many around them (0..1) and the whole world (0..1) */
  many: number;
  world: number;
  /** grey smoke waiting at the Cross (0..1 of a puff), the gold there (0..1), the turning's glow (0..1) */
  waiting: number;
  gold: number;
  glow: number;
  /** the Cross resting in its light (peace, left at the Cross, the finale) */
  rest: number;
  /** the breath now, and whether the exchange's lanes run */
  phase: BreathPhase;
  p: number;
  k: number;
  flows: boolean;
  lightOnly: boolean;
  reduced: boolean;
  /** the player's clarity 0..1 (clearer in rest and the finale) */
  player: number;
  /** a tap's answer at the one prayed for: a soft ring (0..1, fading) */
  touch: number;
  whoLabel: string | null;
  youLabel: string | null;
  labelPx: number;
}

type Baked = { c: Layer; w: number; h: number; ox: number; oy: number };

export class Scene {
  private key = '';
  private skyCool: Layer | null = null;
  private skyWarm: Layer | null = null;
  private cross: Baked | null = null;
  private fig: Partial<Record<FigureStyle, Baked>> = {};
  private player: Baked | null = null;
  private globe: { c: Layer; size: number } | null = null;
  private lights: CityLight[] = [];
  S: Stage | null = null;

  /** The stage for a layout (cached by size); bakes the layers on a change. */
  stage(L: Pick<Layout, 'pic' | 'orient' | 'u' | 'desk' | 'w' | 'h'>, dpr: number, many: number): Stage {
    const key = `${L.w}x${L.h}@${dpr}|${L.orient}|${L.pic.x},${L.pic.y},${L.pic.w},${L.pic.h}|${many}`;
    if (key === this.key && this.S) return this.S;
    this.key = key;
    const S = stageOf(L, many);
    this.S = S;
    const gr = {
      ridgeY: S.ridgeY, hillY: S.hillY, nearY: S.nearY, hillX: S.cross.x, hillW: Math.max(S.cross.arm * 2.6, L.pic.w * (L.orient === 'across' ? 0.17 : 0.3)),
      orient: L.orient, personX: S.person.x, playerX: S.player.x, crossY: S.cross.y,
    };
    this.skyCool = bakeSky(L.w, L.h, dpr, false, gr);
    this.skyWarm = bakeSky(L.w, L.h, dpr, true, gr);
    this.cross = bakeCross(S.cross.h, S.cross.arm, dpr);
    this.fig = { grey: bakeFigure(S.person.H, 'grey', dpr) ?? undefined, lit: bakeFigure(S.person.H, 'lit', dpr) ?? undefined };
    this.player = bakeFigure(S.player.H, 'clear', dpr);
    this.globe = bakeGlobe(S.globe.r, dpr);
    this.lights = cityLights(Math.round(clamp(S.globe.r * 0.9, 28, 120)));
    return S;
  }

  draw(ctx: CanvasRenderingContext2D, L: Pick<Layout, 'pic' | 'orient' | 'u' | 'desk' | 'w' | 'h'>, dpr: number, st: SceneState, many: number): Stage {
    const S = this.stage(L, dpr, many);
    // the sky: dusk, warming to gold
    if (this.skyCool) ctx.drawImage(this.skyCool, 0, 0, L.w, L.h);
    else { ctx.fillStyle = '#1b1528'; ctx.fillRect(0, 0, L.w, L.h); }
    if (this.skyWarm && st.warm > 0.01) {
      ctx.globalAlpha = clamp(st.warm);
      ctx.drawImage(this.skyWarm, 0, 0, L.w, L.h);
      ctx.globalAlpha = 1;
    }
    const tm = st.time;
    const world = clamp(st.world), manyA = clamp(st.many) * (1 - world);
    const { smoke, light } = lanes(S, L.orient, world > 0.5);

    // the Cross: its aura (stronger as smoke turns to gold, and at rest), the Cross itself
    const C = S.cross;
    ctx.globalCompositeOperation = 'lighter';
    const breathe = 0.04 * Math.sin(tm * 1.1);
    glow(ctx, GOLD, C.cx, C.cy, C.h * (1.05 + 0.45 * st.glow + 0.35 * st.rest + breathe), 0.2 + 0.4 * st.glow + 0.35 * st.rest + 0.15 * st.gold);
    glow(ctx, GOLD_HI, C.cx, C.cy, C.h * 0.42, 0.18 + 0.35 * st.glow + 0.25 * st.rest);
    ctx.globalCompositeOperation = 'source-over';
    if (this.cross) {
      const b = this.cross;
      ctx.globalAlpha = 0.82 + 0.18 * clamp(st.glow + st.rest);
      ctx.drawImage(b.c, C.x - b.ox, C.y - b.oy, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    // motes of light rising from the Cross while smoke turns to gold and in the rest
    const motes = Math.max(st.rest, st.glow * 0.6);
    if (motes > 0.03 && !st.reduced) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const ph = (tm * 0.06 + hash(i * 3 + 7)) % 1;
        const x = C.cx + (hash(i * 3 + 8) - 0.5) * C.arm * 2.4 + Math.sin(tm * 0.5 + i) * C.arm * 0.12;
        const y = C.y - ph * C.h * 1.35;
        glow(ctx, GOLD_HI, x, y, Math.max(2, C.h * 0.022), 0.55 * motes * Math.sin(Math.PI * ph));
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // the one prayed for, the many, or the whole world
    const appear = clamp(st.appear);
    if (appear > 0.01) {
      if (world > 0.01) this.drawGlobe(ctx, S, st, world * appear, clamp(st.lightWorld));
      if (manyA > 0.01) S.many.forEach((m, i) => { const l = clamp(st.lightMany * 1.25 - 0.05 * i); this.drawPerson(ctx, m.x, m.y, m.H, l, 1 - l, manyA * appear, st, i + 1); });
      if (world < 0.99) this.drawPerson(ctx, S.person.x, S.person.y, S.person.H, clamp(st.light), clamp(1 - st.light), (1 - world) * appear, st, 0);
    }

    // the exchange: the smoke lane in the in-breath, the light lane in the out-breath (never the player's way)
    if (st.flows && !st.reduced && appear > 0.5) {
      if (!st.lightOnly && st.phase === 'in') {
        const amt = clamp(st.cloud * 1.3) * (1 - 0.7 * clamp(st.waiting));
        for (let i = 0; i < 9; i++) {
          const u = clamp(st.p * 1.35 - i * 0.06);
          if (u <= 0.02 || u >= 0.98) continue;
          const [x, y] = laneAt(smoke, u);
          const wob = Math.sin(tm * 2 + i * 1.7) * S.person.H * 0.04;
          puff(ctx, SMOKE, x + wob, y, S.person.H * (0.09 + 0.07 * u), 0.55 * amt * Math.sin(Math.PI * u));
        }
      }
      if (st.lightOnly && st.phase === 'in') {
        // the light gathers at the Cross from above
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const u = clamp(st.p * 1.3 - i * 0.07);
          if (u <= 0.02 || u >= 0.98) continue;
          const y = C.cy - C.h * (1.2 - 1.2 * u);
          glow(ctx, GOLD_HI, C.cx + Math.sin(i * 2.1 + tm) * C.arm * 0.12, y, C.h * 0.08, 0.6 * Math.sin(Math.PI * u));
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      if (st.phase === 'out') {
        const amt = clamp(0.25 + st.gold * 1.5 + st.glow * 0.6);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 11; i++) {
          const u = clamp(st.p * 1.4 - i * 0.05);
          if (u <= 0.02 || u >= 0.98) continue;
          const [x, y] = laneAt(light, u);
          glow(ctx, GOLD_HI, x, y, S.person.H * (0.07 + 0.03 * Math.sin(i + tm * 3)), 0.75 * amt * Math.sin(Math.PI * u));
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    // the smoke waiting at the Cross: a small cloud, turning gold while focus is held (never drifting back)
    if (!st.lightOnly && st.waiting > 0.01) {
      const n = 7, R = C.arm * 0.55;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + tm * 0.25;
        const x = C.cx + Math.cos(a) * R * (0.6 + 0.4 * hash(i)), y = C.cy + Math.sin(a) * R * 0.55;
        const r = C.h * (0.09 + 0.05 * hash(i + 9)) * (0.6 + 0.4 * clamp(st.waiting));
        puff(ctx, SMOKE, x, y, r, 0.6 * clamp(st.waiting) * (1 - 0.8 * st.glow));
        if (st.glow > 0.02) {
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, GOLD, x, y, r * 1.1, 0.5 * clamp(st.waiting) * st.glow);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    }
    // gold at the Cross, waiting for the out-breath
    if (st.gold > 0.005) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, GOLD_HI, C.cx, C.cy, C.h * (0.2 + 0.5 * clamp(st.gold * 4)), 0.6 * clamp(st.gold * 5));
      ctx.globalCompositeOperation = 'source-over';
    }

    // the player: a clear figure of light, near; nothing of the smoke ever comes their way
    const P = S.player;
    if (this.player) {
      const b = this.player;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, LILAC, P.x, P.y - P.H * 0.5, P.H * (0.55 + 0.15 * st.player), 0.12 + 0.2 * st.player);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.72 + 0.28 * clamp(st.player);
      ctx.drawImage(b.c, P.x - b.ox, P.y - b.oy, b.w, b.h);
      ctx.globalAlpha = 1;
    }

    // a tap: a soft ring around the one prayed for (their name glows again in the band)
    if (st.touch > 0.01 && appear > 0.3) {
      const cx = world > 0.5 ? S.globe.x : S.person.x, cy = world > 0.5 ? S.globe.y : S.person.y - S.person.H * 0.5;
      const r = (world > 0.5 ? S.globe.r * 1.2 : S.person.H * 0.6) * (1.15 - 0.25 * st.touch);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.strokeStyle = `rgba(255,236,196,${(0.6 * st.touch).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    // the labels: who is prayed for, and "Ty" by the player
    if (st.whoLabel && appear > 0.3) {
      const px = st.labelPx;
      if (L.orient === 'across') {
        const y = Math.min(L.pic.y + L.pic.h - px * 0.7, (world > 0.5 ? S.globe.y + S.globe.r * 1.12 : S.person.y) + px * 0.95);
        label(ctx, st.whoLabel, S.person.x, y, px, PEARL, 'center');
      } else if (world > 0.5) label(ctx, st.whoLabel, S.globe.x + S.globe.r * 1.15 + 6, S.globe.y, px, PEARL, 'left');
      else if (manyA > 0.3) label(ctx, st.whoLabel, S.person.x, S.person.y + px * 0.85, px, PEARL, 'center');
      else label(ctx, st.whoLabel, S.person.x + S.person.H * 0.32 + 6, S.person.y - S.person.H * 0.45, px, PEARL, 'left');
    }
    if (st.youLabel) {
      const px = st.labelPx;
      if (L.orient === 'across') label(ctx, st.youLabel, P.x, Math.min(L.pic.y + L.pic.h - px * 0.7, P.y + px * 0.95), px, LILAC, 'center', 600);
      else label(ctx, st.youLabel, P.x + P.H * 0.3 + 6, P.y - P.H * 0.45, px, LILAC, 'left', 600);
    }
    return S;
  }

  /** A figure under its burden: its cloud of smoke (thinning as the light returns), the grey and the lit figure. */
  private drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, H: number, light: number, cloud: number, alpha: number, st: SceneState, seed: number): void {
    const grey = this.fig.grey, lit = this.fig.lit;
    const s = H / Math.max(1, this.S?.person.H ?? H);
    const tm = st.time;
    // the cloud around them (the light-only variant draws none: they stand dimmed instead)
    if (!st.lightOnly && cloud > 0.01) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + tm * 0.18 + seed;
        const cx = x + Math.cos(a) * H * 0.22, cy = y - H * (0.5 + 0.28 * Math.sin(a));
        puff(ctx, SMOKE_DARK, cx, cy, H * (0.26 + 0.06 * hash(i + seed * 13)), 0.55 * clamp(cloud) * alpha);
      }
    }
    if (grey) {
      ctx.globalAlpha = alpha * (1 - 0.85 * clamp(light)) * (st.lightOnly ? 0.85 : 1);
      ctx.drawImage(grey.c, x - grey.ox * s, y - grey.oy * s, grey.w * s, grey.h * s);
    }
    if (lit && light > 0.01) {
      ctx.globalAlpha = alpha * clamp(light);
      ctx.drawImage(lit.c, x - lit.ox * s, y - lit.oy * s, lit.w * s, lit.h * s);
    }
    ctx.globalAlpha = 1;
    // the peace received: a warm glow at the heart that grows with the light
    if (light > 0.02) {
      ctx.globalCompositeOperation = 'lighter';
      const pulse = st.phase === 'out' && st.flows ? 0.15 * Math.sin(Math.PI * st.p) : 0;
      glow(ctx, GOLD, x, y - H * 0.73, H * (0.35 + 0.25 * light), alpha * (0.15 + 0.3 * light + pulse));
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** The whole world: the night globe, its lights waking as the light returns, the smoke over its dark face. */
  private drawGlobe(ctx: CanvasRenderingContext2D, S: Stage, st: SceneState, alpha: number, lit: number): void {
    const G = S.globe, b = this.globe;
    if (b) {
      ctx.globalAlpha = alpha;
      ctx.drawImage(b.c, G.x - b.size / 2, G.y - b.size / 2, b.size, b.size);
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.lights) {
      const on = clamp((lit - c.at) / 0.08);
      const base = 0.18;
      const a = alpha * (base + (1 - base) * on) * (0.8 + 0.2 * Math.sin(st.time * 2 + c.at * 40));
      glow(ctx, on > 0.5 ? GOLD_HI : '#9aa8e0', G.x + c.x * G.r, G.y + c.y * G.r, G.r * 0.045 * c.size * (1 + on), a);
    }
    glow(ctx, GOLD, G.x, G.y, G.r * 1.4, alpha * 0.25 * lit);
    ctx.globalCompositeOperation = 'source-over';
    if (!st.lightOnly && lit < 0.99) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU + st.time * 0.12;
        puff(ctx, SMOKE_DARK, G.x + Math.cos(a) * G.r * 0.75, G.y + Math.sin(a) * G.r * 0.7, G.r * 0.45, 0.45 * (1 - lit) * alpha);
      }
    }
  }
}
