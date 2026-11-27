/**
 * Nowe siły's figure world (DESIGN.md §28, depth 0, no lens): the person (figure.ts) standing in a soft light, from the
 * hips up, tired at the start of every session and recovering as the session's focused growth gathers (renew.ts) —
 * and, over them, what each scene teaches, drawn as light that grows with the scene:
 *
 *   kosci    the red marrow in the flat bones lights in turn — breastbone, hip bones, spine, ribs, skull, the heads of
 *            the arm bones — and new red cells flow from them to the heart and out to the face and the hands
 *   twarz    the face close: new cells reach the skin's surface in a quiet shimmer rising from the jaw to the brow,
 *            and along the hairline the follicles wake
 *   plecy    the muscles that hold us — the trapezius, the shoulders, the long muscles beside the spine — warm in
 *            turn, and their satellite cells (aqua) wake along them
 *   sen      night: the eyes closed, deep sleep's slow waves round the head, the pituitary's pulse of growth hormone
 *            and its gold carried through the body
 *   poranek  morning: warm light comes from the side
 *   zrodla   all the sources at once: marrow, skin, muscles, the gut's lining, the night
 *   pelnia   the whole person renewed: a warm light around and rising motes
 *
 * The person is painted once per look and renewal (FigureCache); a frame composes it and draws the light.  Outside play
 * (the lobby) there is no session's arc: the scene's own growth stands for it.
 */
import { GOLD, GOLD_HI, TAU, glow, glowEllipse, hash, polyAt, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { FigureCache, HEAD_K, geoOf, lookOf, type Geo } from './figure';
import { renewal, type Renewal } from './renew';

export const WHOLE = { x: -60, y: -110, w: 120, h: 136 } as const;
export const FACE = { x: -22, y: -110, w: 44, h: 50 } as const;
export const UPPER = { x: -46, y: -108, w: 92, h: 86 } as const;

const MARROW = '#ff6f61';
const MARROW_HI = '#ffc98a';
const MUSCLE = '#ffb08a';
const AQUA = '#9fe9ff';
const LILAC = '#c9b8ff';

const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const phase = (g: number, a: number, b: number): number => clamp((g - a) / (b - a));
const smooth = (x: number): number => x * x * (3 - 2 * x);

/** A point of the head, after its portrait scale (figure.ts HEAD_K, anchored at the chin). */
const headPt = (g: Geo, x: number, y: number): Pt => [x * HEAD_K, g.cy + 13 + (y - (g.cy + 13)) * HEAD_K];

/** The geometry used for fixed places (labels, the growing point): half-way between tired and upright. */
export const MID = geoOf('f', 0.5);

/** The marrow's places in the flat bones (in the order they light). */
export function marrowSites(g: Geo): { at: Pt; rx: number; ry: number }[] {
  const hip = g.sex === 'f' ? 15.4 : 14.6;
  return [
    { at: [0, g.sy + 14], rx: 2.6, ry: 9 },
    { at: [-hip, g.sy + 46], rx: 6.6, ry: 3.6 },
    { at: [hip, g.sy + 46], rx: 6.6, ry: 3.6 },
    { at: [0, g.sy + 30], rx: 2.2, ry: 12 },
    { at: [-9, g.sy + 16], rx: 6, ry: 2.2 },
    { at: [9, g.sy + 16], rx: 6, ry: 2.2 },
    { at: headPt(g, 0, g.cy - 10.5), rx: 8, ry: 3.4 },
    { at: [-(g.sx - 4.4), g.sy + 5], rx: 2.8, ry: 2.6 },
    { at: [g.sx - 4.4, g.sy + 5], rx: 2.8, ry: 2.6 },
  ];
}
/** the skull's place: its marrow is named in the words, but no light is drawn on the head (it would read as a halo) */
const SKULL = 6;
/** when each place lights (the scene's growth) */
const MARROW_AT: readonly number[] = [0.02, 0.14, 0.18, 0.3, 0.42, 0.46, 0.58, 0.7, 0.74];

/** the heart (a little left of the middle), where the new cells gather before going out */
const heartOf = (g: Geo): Pt => [3.4, g.sy + 17];

/** The ways new blood goes: from each marrow place to the heart, and out to the face and the hands. */
function flows(g: Geo): Pt[][] {
  const H = heartOf(g);
  const sites = marrowSites(g);
  const ins = sites.filter((_s, i) => i !== SKULL).map(s => [s.at, [(s.at[0] + H[0]) / 2, (s.at[1] + H[1]) / 2 - 2] as Pt, H]);
  const face = headPt(g, 0, g.cy + 4);
  const outs: Pt[][] = [
    [H, [2, g.sy - 2], [1.2, g.cy + 16], face],
    [H, [-(g.sx - 6), g.sy + 6], g.arm[1], g.arm[2], g.arm[3]],
    [H, [g.sx - 6, g.sy + 6], [-g.arm[1][0], g.arm[1][1]], [-g.arm[2][0], g.arm[2][1]], [-g.arm[3][0], g.arm[3][1]]],
  ];
  return [...ins, ...outs];
}

/** The renewal a frame shows: the session's arc and walk in play, the scene's own growth in the lobby. */
export function renewOf(st: WorldState, medOf: (s: string) => string | undefined): Renewal {
  const arc = st.arc ?? clamp(st.g);
  return renewal(arc, st.session, medOf);
}

export function makePostac(medOf: (s: string) => string | undefined): WorldPainter {
  const cache = new FigureCache();

  /** A soft light behind the person (a portrait's backdrop): night blue with a moon, or a morning window. */
  const backdrop = (ctx: CanvasRenderingContext2D, variant: string): void => {
    if (variant === 'noc') {
      glowEllipse(ctx, '#2a3a8a', 0, -50, 70, 80, 0, 0.5);
      glowEllipse(ctx, '#8aa0ff', -40, -96, 12, 12, 0, 0.4);
      glow(ctx, '#e8eeff', -40, -96, 3.6, 0.75);
      for (let i = 0; i < 22; i++) {
        const x = (hash(i * 3.1) - 0.5) * 110, y = -108 + hash(i * 7.7) * 90;
        glow(ctx, '#dfe6ff', x, y, 0.7 + hash(i) * 1.1, 0.35 * hash(i * 1.3));
      }
      return;
    }
    if (variant === 'rano') {
      glowEllipse(ctx, '#ffb27a', -44, -76, 56, 70, 0, 0.3);
      glowEllipse(ctx, '#ffe2b0', -54, -92, 22, 44, -0.2, 0.3);
      glowEllipse(ctx, '#a070c0', 36, -24, 50, 56, 0, 0.12);
      return;
    }
    glowEllipse(ctx, '#ffd2b0', -8, -78, 50, 52, 0, 0.18);
    glowEllipse(ctx, '#b48ad8', 16, -18, 54, 50, 0, 0.1);
    glowEllipse(ctx, '#ffe6c8', -6, -92, 24, 22, 0, 0.1);
  };

  /** The bones that hold red marrow, drawn as warm light (the breastbone, ribs, collarbones, spine, hip bones). */
  const drawBones = (ctx: CanvasRenderingContext2D, g: Geo, a: number): void => {
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const line = (w: number, al: number, path: () => void): void => {
      ctx.strokeStyle = rgba('#ffe2c8', al * a);
      ctx.lineWidth = w;
      ctx.beginPath();
      path();
      ctx.stroke();
    };
    const { sy, sx } = g;
    // the spine behind (small vertebrae)
    ctx.fillStyle = rgba('#ffd8c0', 0.12 * a);
    for (let k = 0; k < 11; k++) {
      const y = sy - 3 + k * 4.6;
      ctx.beginPath();
      ctx.ellipse(0, y, 1.9, 1.5, 0, 0, TAU);
      ctx.fill();
    }
    // the breastbone and the collarbones
    line(2.4, 0.3, () => { ctx.moveTo(0, sy + 3.5); ctx.lineTo(0, sy + 26); });
    for (const s of [-1, 1]) {
      line(1.3, 0.28, () => { ctx.moveTo(s * 2.4, sy + 2.4); ctx.quadraticCurveTo(s * sx * 0.45, sy - 0.4, s * (sx - 5), sy + 1.8); });
      // the ribs: out from the breastbone, round the side and down
      for (let k = 0; k < 6; k++) {
        const y0 = sy + 5 + k * 4.4;
        line(0.8, 0.2, () => { ctx.moveTo(s * 1.8, y0); ctx.bezierCurveTo(s * sx * 0.4, y0 - 3, s * (sx - 5), y0 - 1, s * (sx - 6 - k * 0.6), y0 + 5 + k); });
      }
      // the hip bone's wing: a soft fan and its crest
      const hip = g.sex === 'f' ? 17.5 : 16.5;
      ctx.fillStyle = rgba('#ffd8c0', 0.1 * a);
      ctx.beginPath();
      ctx.moveTo(s * 4, sy + 55);
      ctx.quadraticCurveTo(s * 6, sy + 42, s * (hip - 3), sy + 40);
      ctx.quadraticCurveTo(s * (hip + 0.8), sy + 41, s * (hip + 0.4), sy + 47);
      ctx.quadraticCurveTo(s * (hip - 1), sy + 52, s * (hip - 3.5), sy + 55);
      ctx.closePath();
      ctx.fill();
      line(1.2, 0.3, () => { ctx.moveTo(s * 6, sy + 44); ctx.quadraticCurveTo(s * (hip - 3), sy + 39, s * (hip + 0.4), sy + 46); });
    }
    ctx.restore();
  };

  /** The marrow scene's light: the places light in turn, the new red cells flow. */
  const drawMarrow = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number, amount = 1): void => {
    drawBones(ctx, g, smooth(phase(k, 0, 0.14)) * amount);
    marrowSites(g).forEach((s, i) => {
      if (i === SKULL) return;
      const a = smooth(phase(k, MARROW_AT[i], MARROW_AT[i] + 0.2)) * amount;
      if (a <= 0.01) return;
      const pulse = st.reduced ? 1 : 0.85 + 0.15 * Math.sin(st.time * 1.6 + i);
      glowEllipse(ctx, MARROW, s.at[0], s.at[1], s.rx * 2.6, s.ry * 2.6, 0, 0.5 * a * pulse);
      glowEllipse(ctx, MARROW_HI, s.at[0], s.at[1], s.rx * 1.1, s.ry * 1.1, 0, 0.6 * a * pulse);
    });
    const ways = flows(g);
    const n = Math.round((6 + 40 * k) * amount);
    for (let i = 0; i < n; i++) {
      const w = ways[i % ways.length];
      const q = st.reduced ? hash(i * 9.1) : (st.time * (0.16 + 0.05 * hash(i)) + hash(i * 3.7)) % 1;
      const [x, y] = polyAt(w, q);
      const fade = Math.sin(Math.PI * q);
      glow(ctx, MARROW, x, y, 2.2, 0.5 * fade * amount);
      ctx.fillStyle = rgba('#ff8f7a', 0.85 * fade * amount);
      ctx.beginPath();
      ctx.ellipse(x, y, 0.75, 0.55, i, 0, TAU);
      ctx.fill();
    }
  };

  /** The skin's shimmer: new cells reach the surface, rising from the jaw to the brow; the hairline wakes. */
  const drawSkin = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number, amount = 1): void => {
    if (k <= 0.01) return;
    // the band: where new cells are reaching the surface now; below it the skin already glows softly
    const front = g.cy + 12 - 24 * smooth(Math.min(1, k * 1.1));
    const [bx, by] = headPt(g, 0, front);
    const [, cyH] = headPt(g, 0, (front + g.cy + 12) / 2);
    glowEllipse(ctx, '#ffe9d6', bx, by, 9.6, 2.6, 0, 0.32 * amount * (1 - 0.6 * smooth(phase(k, 0.85, 1))));
    glowEllipse(ctx, '#ffe2cc', 0, cyH, 9, Math.max(0.5, (g.cy + 12 - front) * HEAD_K * 0.5), 0, 0.14 * amount);
    for (let i = 0; i < 14; i++) {
      const u = hash(i * 1.7) - 0.5;
      const y0 = front + (hash(i * 5.3) - 0.5) * 3;
      if (Math.abs(u) * 16 > 7.6 * Math.sqrt(Math.max(0, 1 - ((y0 - g.cy - 0.5) / 12.5) ** 2))) continue;
      const tw = st.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(st.time * 2.2 + i * 1.3);
      const [x, y] = headPt(g, u * 15, y0);
      glow(ctx, '#fff6ea', x, y, 0.55, 0.5 * tw * amount);
    }
    const hair = phase(k, 0.5, 1) * amount;
    if (hair > 0.01) {
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, j = Math.floor(i / 2);
        const [x, y] = headPt(g, side * (8.2 - j * 0.5), g.cy - 4 - j * 2.2);
        const tw = st.reduced ? 0.8 : 0.5 + 0.5 * Math.sin(st.time * 1.8 + i * 2.1);
        glow(ctx, AQUA, x, y, 1.1, 0.5 * hair * tw * smooth(phase(hair, j / 6, j / 6 + 0.4)));
      }
    }
  };

  /** The muscles that hold us warm in turn; satellite cells wake along them. */
  const drawMuscles = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number, amount = 1): void => {
    const bands: { pts: Pt[]; w: number; at: number; behind?: boolean }[] = [];
    for (const s of [-1, 1]) {
      bands.push({ pts: [[s * 4.6, g.sy - 3.4], [s * (g.sx * 0.55), g.sy - 1.6], [s * (g.sx - 2.6), g.sy + 3.2]], w: 2.6, at: 0.02 });
      bands.push({ pts: [[s * (g.sx - 4.6), g.sy + 1], [s * (g.sx - 0.6), g.sy + 6], [s * (g.sx - 1.6), g.sy + 14]], w: 2.6, at: 0.3 });
      // the long muscles beside the spine lie behind: drawn fainter, seen through
      bands.push({ pts: [[s * 3.2, g.sy + 2], [s * 3.6, g.sy + 24], [s * 3.4, g.sy + 46]], w: 1.6, at: 0.55, behind: true });
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of bands) {
      const a = smooth(phase(k, b.at, b.at + 0.3)) * amount * (b.behind ? 0.45 : 1);
      if (a <= 0.01) continue;
      for (const [w, al, c] of [[b.w * 3.2, 0.1, MUSCLE], [b.w * 1.4, 0.2, MUSCLE], [b.w * 0.4, 0.28, '#ffe0c8']] as const) {
        ctx.strokeStyle = rgba(c, al * a);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(b.pts[0][0], b.pts[0][1]);
        ctx.quadraticCurveTo(b.pts[1][0], b.pts[1][1], b.pts[2][0], b.pts[2][1]);
        ctx.stroke();
      }
      // the satellite cells along it: small aqua lights that wake
      for (let j = 0; j < 4; j++) {
        const q = (j + 0.5) / 4;
        const [x, y] = polyAt(b.pts, q);
        const wake = smooth(phase(a, 0.3 + j * 0.12, 0.6 + j * 0.12));
        const tw = st.reduced ? 1 : 0.7 + 0.3 * Math.sin(st.time * 2.4 + j + b.at * 9);
        glow(ctx, AQUA, x, y, 1.8, 0.6 * wake * tw);
      }
    }
  };

  /**
   * Night: deep sleep's slow waves drawn as a calm trace beside the head (as a sleep recording shows them — never rings
   * round the head, which would read as a halo), and the gold of the night's growth hormone carried down from the neck
   * through the body (the pituitary is named in the words; no light is drawn inside the head).
   */
  const drawNight = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number, amount = 1): void => {
    const [hx, hy] = headPt(g, 0, g.cy);
    const x0 = hx + 17, x1 = hx + 52;
    const amp = 1.6 + 2.6 * k;
    const shift = st.reduced ? 0 : st.time * 0.9;
    for (const [w, al] of [[2.4, 0.16], [0.8, 0.6]] as const) {
      ctx.strokeStyle = rgba(LILAC, al * smooth(phase(k, 0, 0.25)) * amount);
      ctx.lineWidth = w;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48, x = x0 + (x1 - x0) * t;
        // slow waves (under 1 a second) with a little of the faster rhythm on them
        const y = hy - 6 + amp * Math.sin(t * TAU * 1.3 - shift) * (0.6 + 0.4 * Math.sin(t * Math.PI));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const neck: Pt = [0, g.sy - 3];
    const ways: Pt[][] = [
      [neck, heartOf(g), [0, g.sy + 40]],
      [neck, [-(g.sx - 6), g.sy + 6], g.arm[1], g.arm[2]],
      [neck, [g.sx - 6, g.sy + 6], [-g.arm[1][0], g.arm[1][1]], [-g.arm[2][0], g.arm[2][1]]],
    ];
    const n = Math.round(30 * k * amount);
    for (let i = 0; i < n; i++) {
      const w = ways[i % ways.length];
      const q = st.reduced ? hash(i * 4.3) : (st.time * 0.09 + hash(i * 2.9)) % 1;
      const [x, y] = polyAt(w, q);
      glow(ctx, GOLD, x, y, 1.6, 0.55 * Math.sin(Math.PI * q) * amount);
    }
    glow(ctx, GOLD_HI, neck[0], neck[1], 2.4 + 2 * k, (0.15 + 0.3 * k) * amount);
  };

  /** The gut's lining in the belly (a warm folded light) — „Cała postać” only. */
  const drawGut = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number): void => {
    if (k <= 0.01) return;
    const y0 = g.sy + 36;
    glowEllipse(ctx, '#ffb98a', 0, y0, 13, 8, 0, 0.3 * k);
    ctx.strokeStyle = rgba('#ffd2a8', 0.45 * k);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      const x = -10 + 20 * t, y = y0 + Math.sin(t * TAU * 3 + (st.reduced ? 0 : st.time * 0.4)) * 2.2 + (t - 0.5) * 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  /** Light around the renewed person (the joy of a rested body) and motes rising. */
  const drawWarm = (ctx: CanvasRenderingContext2D, st: WorldState, g: Geo, k: number, motes: boolean): void => {
    if (!motes || k <= 0.01) return;
    const n = Math.round(26 * k);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (g.sx + 2 + 14 * hash(i * 2.3));
      const q = st.reduced ? hash(i * 6.1) : (st.time * (0.05 + 0.03 * hash(i)) + hash(i * 7.9)) % 1;
      const y = g.sy + 60 - q * 150;
      glow(ctx, i % 3 ? GOLD : '#ffe8d0', x, y, 1.4 + hash(i) * 1.2, 0.5 * Math.sin(Math.PI * q) * k);
    }
  };

  return {
    depth: 0,
    lens: false,
    // the backdrop is drawn each frame (soft sprites that never meet the picture's edge); nothing still to bake
    bake: () => undefined,
    draw(ctx: CanvasRenderingContext2D, st: WorldState): void {
      const r = renewOf(st, medOf);
      const L = lookOf(st.look || 'f1');
      const g = geoOf(L.sex, r.postawa);
      const k = clamp(st.g);
      const sc = st.scene;
      backdrop(ctx, sc === 'sen' ? 'noc' : sc === 'poranek' ? 'rano' : '');
      // the warm light around the person grows with the quiet smile (behind them)
      const warmA = 0.08 + 0.08 * r.usmiech + (sc === 'pelnia' ? 0.1 * k : 0);
      glowEllipse(ctx, '#ffcf9a', -2, -40, 38 + 6 * r.usmiech, 58, 0, warmA * (sc === 'sen' ? 0.3 : 1));
      if (sc === 'poranek') glowEllipse(ctx, '#ffd9a0', -40, -86, 50, 60, -0.3, 0.12 + 0.25 * k);
      // the person, breathing with the rest's guide
      const breathe = st.reduced ? 0 : (st.breath - 0.5) * 0.012;
      ctx.save();
      if (breathe) {
        ctx.translate(0, 20);
        ctx.scale(1 + breathe * 0.4, 1 + breathe);
        ctx.translate(0, -20);
      }
      cache.draw(ctx, st.look || 'f1', r, { closed: sc === 'sen', night: sc === 'sen' });
      ctx.restore();
      // the scene's light
      switch (sc) {
        case 'kosci':
          drawMarrow(ctx, st, g, k);
          break;
        case 'twarz':
          drawSkin(ctx, st, g, k);
          break;
        case 'plecy':
          drawMuscles(ctx, st, g, k);
          break;
        case 'sen':
          drawNight(ctx, st, g, k);
          break;
        case 'poranek': {
          // soft rays of the morning from the upper left, then its light on the face and the shoulder
          for (let i = 0; i < 4; i++) {
            const a = 0.72 + i * 0.15, len = 150;
            glowEllipse(ctx, '#ffe2b0', -70 + Math.cos(a) * len * 0.5, -118 + Math.sin(a) * len * 0.5, len * 0.5, 5 + 2 * i, a, 0.12 * (0.4 + 0.6 * k));
          }
          // the light of the morning on the face and the shoulder
          const [fx, fy] = headPt(g, -5, g.cy - 1);
          glow(ctx, '#ffe2b0', fx, fy, 10, 0.18 * k);
          glowEllipse(ctx, '#ffd9a0', -(g.sx - 4), g.sy + 4, 8, 4, 0, 0.2 * k);
          break;
        }
        case 'zrodla':
          drawMarrow(ctx, st, g, phase(k, 0, 0.3), 0.75);
          drawSkin(ctx, st, g, phase(k, 0.2, 0.5), 0.8);
          drawMuscles(ctx, st, g, phase(k, 0.4, 0.7), 0.8);
          drawGut(ctx, st, g, smooth(phase(k, 0.6, 0.85)));
          drawNight(ctx, st, g, phase(k, 0.8, 1), 0.6);
          break;
        case 'pelnia':
          drawWarm(ctx, st, g, k, true);
          break;
        default:
          break;
      }
      // rest deepens the warmth a little
      if (st.deep > 0.02) glowEllipse(ctx, '#ffb7a0', 0, g.sy + 10, 30, 40, 0, 0.08 * st.deep);
    },
    focusAt(scene: string, gr: number): Pt {
      const g = MID;
      const k = clamp(gr);
      const H = heartOf(g);
      switch (scene) {
        case 'kosci': {
          // through the bones of the trunk in the order they light (never on the head: a ring there reads as a halo)
          const s = marrowSites(g).filter((_s, i) => i !== SKULL && i < 7).map(x => x.at);
          return polyAt(s, k);
        }
        case 'twarz':
          return headPt(g, -4.6, g.cy + 6 - 12 * k);
        case 'plecy':
          return polyAt([[-(g.sx - 3), g.sy + 3], [-8, g.sy + 2], [0, g.sy + 12], [3.4, g.sy + 36]], k);
        case 'sen':
          // the night's gold arriving in the body
          return polyAt([[0, g.sy + 2], H, [0, g.sy + 36]], k);
        case 'poranek':
          // the morning light on the shoulder and the chest
          return polyAt([[-(g.sx - 4), g.sy + 4], [-8, g.sy + 10], H], k);
        case 'zrodla':
          return polyAt([[0, g.sy + 14], [-14, g.sy + 46], [0, g.sy + 36], H], k);
        case 'pelnia':
        default:
          return H;
      }
    },
  };
}
