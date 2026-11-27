/**
 * The skin under the lens (DESIGN.md §28, Nowe siły · Nowa skóra and Noc odnowy, depth 1), in the player's skin tone:
 *
 *   NASKOREK  the epidermis in section — the wavy basement membrane over the dermis (a capillary loop in its papilla),
 *             the basal layer's columns of young cells (a melanin cap over each nucleus, by the tone), the spinous
 *             layer's rounded cells, the granular layer, the horny layer's flat cells without nuclei
 *     warstwa   a basal stem cell divides; one daughter rises layer by layer, flattens, gives up its nucleus and
 *               reaches the surface — about 39 days from the base to the flake (Weinstein et al. 1984); the top
 *               flake lets go and the surface takes a soft sheen
 *     naprawa   night: the same skin in the night's light; one basal cell after another divides, and the gold of
 *               the night (growth hormone, carried by the blood) reaches the tissue from the capillary
 *   MIESZEK   a hair follicle — the canal from the surface, the sebaceous gland, the small muscle that raises the hair
 *             and, where it holds on, the bulge with its stem cells (Cotsarelis et al. 1990)
 *     mieszek   the bulge's stem cells wake, a stream of young cells goes down, a new bulb forms round the papilla and
 *               a new hair grows up the canal and out — about 0.35 mm a day
 *
 * Nothing moves without focus but the light: a time-lapse of weeks.
 */
import { GOLD, TAU, glow, glowEllipse, hash, mix, polyAt, rgba, type Pt } from '../kit/healthlib/paint';
import type { WorldPainter, WorldState } from '../kit/healthlib/spec';
import { cell, phase, smooth, stemCell } from './draw';
import { lookOf } from './figure';
import { tc } from './i18n';

export const NASKOREK_VIEW = { x: -60, y: -46, w: 120, h: 90 } as const;
export const MIESZEK_VIEW = { x: -48, y: -70, w: 96, h: 134 } as const;

/** the surface and the basement membrane (y grows downward) */
export const surfY = (x: number): number => -33 + 1.2 * Math.sin(x * 0.08);
export const memY = (x: number): number => 16 + 3.2 * Math.sin(x * 0.12 + 0.6);

interface ToneSkin { basal: string; spin: string; gran: string; horn: string; mel: string; melA: number; derm: string }
const SKIN: Readonly<Record<1 | 2 | 3, ToneSkin>> = {
  1: { basal: '#f0c8b8', spin: '#f6d6c6', gran: '#f2dcc6', horn: '#fbe8d6', mel: '#8a5a3a', melA: 0.25, derm: '#7a3a52' },
  2: { basal: '#dcae90', spin: '#e8c2a6', gran: '#e6ccb0', horn: '#f2dcc4', mel: '#5a3420', melA: 0.55, derm: '#6a3448' },
  3: { basal: '#b8805e', spin: '#cc9a78', gran: '#d8b090', horn: '#e8cbb0', mel: '#2a160c', melA: 0.85, derm: '#5a2a3e' },
};
const skinFor = (look: string): ToneSkin => SKIN[lookOf(look || 'f1').tone];

/** the basal cells' places (their x) and the one whose division the scene follows */
const BASAL_X: number[] = [];
for (let x = -198.4; x <= 200; x += 6.2) BASAL_X.push(x);
const STEM_X = BASAL_X.reduce((m, x) => (Math.abs(x + 6) < Math.abs(m + 6) ? x : m), 0);
/** the rising daughter's way: base → surface */
export const RISE: readonly Pt[] = [[STEM_X, memY(STEM_X) - 9], [STEM_X + 1, -2], [STEM_X + 2, -12], [STEM_X + 2.6, -21], [STEM_X + 3, -28], [STEM_X + 3.2, surfY(STEM_X + 3.2) - 1]];
/** the night's divisions along the basal layer, in turn */
const NIGHT_X = [-38, -14, 10, 34, -26, 22];

function bakeEpidermis(ctx: CanvasRenderingContext2D, variant: string, look: string): void {
  const S = skinFor(look);
  // the dermis below: collagen and a capillary loop in each papilla
  const dg = ctx.createLinearGradient(0, 10, 0, 60);
  dg.addColorStop(0, mix(S.derm, '#ffffff', 0.15));
  dg.addColorStop(1, mix(S.derm, '#1a0820', 0.4));
  ctx.fillStyle = dg;
  ctx.fillRect(-220, 8, 440, 80);
  ctx.strokeStyle = 'rgba(255,214,220,.16)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 18; i++) {
    const y = 26 + i * 2.8;
    ctx.beginPath();
    for (let x = -220; x <= 220; x += 5) {
      const yy = y + 1.4 * Math.sin(x * 0.09 + i * 1.7);
      if (x === -220) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  for (const px of [-196, -158, -120, -82, -44, -6, 32, 70, 108, 146, 184]) {
    ctx.strokeStyle = 'rgba(255,90,110,.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px - 3, 50);
    ctx.quadraticCurveTo(px - 3, memY(px) + 3, px, memY(px) + 3);
    ctx.quadraticCurveTo(px + 3, memY(px) + 3, px + 3, 50);
    ctx.stroke();
  }
  // the living epidermis: a warm ground, then its cells layer by layer
  ctx.fillStyle = mix(S.spin, '#c89a90', 0.25);
  ctx.beginPath();
  for (let x = -220; x <= 220; x += 3) ctx.lineTo(x, surfY(x));
  for (let x = 220; x >= -220; x -= 3) ctx.lineTo(x, memY(x));
  ctx.closePath();
  ctx.fill();
  // the basement membrane, a thin line of light
  ctx.strokeStyle = 'rgba(255,230,200,.7)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = -220; x <= 220; x += 3) ctx.lineTo(x, memY(x));
  ctx.stroke();
  // basal: columns with a melanin cap over the nucleus (on the sun's side)
  for (const x of BASAL_X) {
    if (Math.abs(x - STEM_X) < 1) continue;
    const y = memY(x) - 4.6;
    cell(ctx, x, y, 2.9, 4.3, 0, S.basal, '#6a4060', 0.95, 0.42);
    ctx.fillStyle = rgba(S.mel, S.melA);
    ctx.beginPath();
    ctx.ellipse(x, y - 2.0, 1.6, 0.8, 0, Math.PI, TAU);
    ctx.fill();
  }
  // spinous: rounded cells in three rows
  for (let row = 0; row < 3; row++) {
    for (let x = -202 + (row % 2) * 4.5; x <= 202; x += 9) {
      const y = 2 - row * 6.6 + 0.6 * Math.sin(x * 0.2 + row);
      if (Math.hypot(x - STEM_X - 1.5, y + 4) < 5 && row < 2) continue;
      cell(ctx, x, y, 4.4, 3.2, 0.05 * Math.sin(x), mix(S.spin, '#ffffff', 0.05 * row), '#7a5070', 0.9, 0.36);
    }
  }
  // granular: flatter, with dark granules
  for (let x = -204; x <= 204; x += 8.5) {
    const y = -21 + 0.6 * Math.sin(x * 0.3);
    cell(ctx, x, y, 4.6, 1.9, 0, S.gran, '#8a6070', 0.9, 0.3);
    ctx.fillStyle = 'rgba(70,40,60,.45)';
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.arc(x - 2.6 + j * 1.8, y + (j % 2 ? 0.5 : -0.4), 0.32, 0, TAU);
      ctx.fill();
    }
  }
  // horny: flat cells without nuclei, staggered
  for (let row = 0; row < 3; row++) {
    for (let x = -206 + row * 3.5; x <= 206; x += 11) {
      const y = surfY(x) + 1.4 + row * 2.1;
      cell(ctx, x, y, 5.4, 0.85, 0.02 * Math.sin(x), S.horn, null, 0.92);
    }
  }
  if (variant === 'noc') {
    ctx.fillStyle = 'rgba(28,30,90,.32)';
    ctx.fillRect(-220, -150, 440, 300);
  }
}

function bakeFollicle(ctx: CanvasRenderingContext2D, look: string): void {
  const S = skinFor(look);
  const dg = ctx.createLinearGradient(0, -60, 0, 110);
  dg.addColorStop(0, mix(S.derm, '#ffffff', 0.1));
  dg.addColorStop(1, mix(S.derm, '#1a0820', 0.45));
  ctx.fillStyle = dg;
  ctx.fillRect(-200, -60, 400, 200);
  ctx.strokeStyle = 'rgba(255,214,220,.14)';
  ctx.lineWidth = 0.9;
  for (let i = 0; i < 30; i++) {
    const y = -48 + i * 5;
    ctx.beginPath();
    for (let x = -200; x <= 200; x += 6) {
      const yy = y + 2 * Math.sin(x * 0.07 + i * 1.3);
      if (x === -200) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // the epidermis on top
  ctx.fillStyle = S.spin;
  ctx.fillRect(-200, -60, 400, 8);
  ctx.fillStyle = mix(S.basal, '#6a4060', 0.15);
  ctx.fillRect(-200, -53.5, 400, 1.6);
  ctx.fillStyle = S.horn;
  ctx.fillRect(-200, -61.5, 400, 2.2);
  // neighbouring follicles and a capillary, for the place's richness
  for (const [x, a] of [[-34, 0.55], [34, 0.45]] as const) {
    ctx.strokeStyle = rgba(mix(S.basal, '#c89a90', 0.2), a);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 3, -56);
    ctx.lineTo(x + 6, 34);
    ctx.stroke();
    ctx.strokeStyle = rgba('#2a1a12', a);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 4, -66);
    ctx.lineTo(x + 6, 34);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,90,110,.6)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-200, 30);
  ctx.bezierCurveTo(-60, 20, -20, 62, 60, 50);
  ctx.quadraticCurveTo(120, 42, 200, 58);
  ctx.stroke();
  // the sebaceous gland: lobes of pale cells
  for (const [x, y, r] of [[-16, -32, 6], [-21, -27, 5], [-12, -25, 4.6]] as const) {
    ctx.fillStyle = 'rgba(255,236,190,.55)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
  // the small muscle that raises the hair, from the bulge up to the skin
  ctx.strokeStyle = 'rgba(255,140,150,.55)';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(BULGE[0] - 3, BULGE[1] + 1);
  ctx.quadraticCurveTo(-22, -18, -36, -46);
  ctx.stroke();
  // the permanent part of the follicle: surface to the bulge
  tube(ctx, CANAL.slice(0, 3), 6.4, mix(S.basal, '#c89a90', 0.2), 'rgba(255,230,210,.55)');
  // the canal's dark middle (the old hair has gone)
  ctx.strokeStyle = 'rgba(60,30,40,.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(CANAL[0][0], CANAL[0][1]);
  ctx.lineTo(CANAL[1][0], CANAL[1][1]);
  ctx.lineTo(CANAL[2][0], CANAL[2][1]);
  ctx.stroke();
  // the papilla below, waiting
  cell(ctx, PAPILLA[0], PAPILLA[1], 5.4, 4.2, 0.4, '#d88aa0', '#7a3a5a', 0.85, 0.3);
}

/** the follicle's middle line: the opening, down past the bulge to the papilla */
export const CANAL: readonly Pt[] = [[-6, -58], [-3.2, -34], [0, -12], [4, 14], [8, 40]];
export const BULGE: Pt = [-1.2, -14];
export const PAPILLA: Pt = [9, 48];

function tube(ctx: CanvasRenderingContext2D, pts: readonly Pt[], w: number, fill: string, edge: string): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = edge;
  ctx.lineWidth = w * 2 + 1.2;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w * 2;
  ctx.stroke();
}

function bake(ctx: CanvasRenderingContext2D, variant: string, look: string): void {
  if (variant === 'mieszek') bakeFollicle(ctx, look);
  else bakeEpidermis(ctx, variant, look);
}

/** warstwa: the stem cell divides; a daughter rises, flattens, loses its nucleus; the top flake lets go. */
function drawRise(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const S = skinFor(st.look);
  const k = st.g;
  const base: Pt = [STEM_X, memY(STEM_X) - 4.6];
  const div = phase(k, 0, 0.18);
  stemCell(ctx, base[0], base[1] + (div > 0.5 ? 0 : 0), 3.2, 0.4 + 0.6 * smooth(div * 2), st.time, st.reduced);
  const t = phase(k, 0.16, 0.88);
  if (div > 0.3) {
    const [x, y] = polyAt(RISE, smooth(t));
    const flat = smooth(phase(t, 0.35, 1));
    const col = t < 0.5 ? mix('#bfe8f0', S.spin, t * 2) : mix(S.spin, S.horn, (t - 0.5) * 2);
    // its way so far, a thread of gold
    ctx.strokeStyle = rgba(GOLD, 0.5);
    ctx.lineWidth = 0.4;
    ctx.setLineDash([1.2, 1.4]);
    ctx.beginPath();
    for (let q = 0; q <= smooth(t) + 1e-6; q += 0.04) {
      const p = polyAt(RISE, q);
      if (q === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    glow(ctx, GOLD, x, y, 7, 0.28);
    cell(ctx, x, y, 3.2 + 2.6 * flat, 3.8 - 2.9 * flat, 0, col, t < 0.62 ? mix('#5a5a9a', '#8a6a7a', t) : null, smooth(div * 2), 0.42);
    ctx.strokeStyle = rgba(GOLD, 0.8);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.4 + 2.6 * flat, 4 - 2.9 * flat, 0, 0, TAU);
    ctx.stroke();
  }
  // the top flake lets go
  const flake = phase(k, 0.84, 1);
  if (flake > 0) {
    const x = STEM_X + 9, y = surfY(STEM_X + 9) - 0.6 - 9 * smooth(flake);
    cell(ctx, x + 4 * flake, y, 5.2, 0.8, -0.3 * flake, S.horn, null, 1 - flake * 0.7);
  }
  // the surface's soft sheen as it renews
  if (k > 0.05) {
    ctx.strokeStyle = rgba('#fff6ea', 0.55 * smooth(k));
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    for (let x = -80; x <= 80; x += 3) ctx.lineTo(x, surfY(x) - 0.2);
    ctx.stroke();
    glowEllipse(ctx, '#fff0e0', 0, surfY(0) - 2, 70, 5, 0, 0.22 * smooth(k));
  }
  // the others divide quietly too
  const n = Math.round(5 * k);
  for (let i = 0; i < n; i++) {
    const x = BASAL_X[(i * 5 + 3) % BASAL_X.length];
    const tw = st.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(st.time * 1.5 + i * 2);
    glow(ctx, '#bfefff', x, memY(x) - 4.6, 3.6, 0.3 * tw);
  }
}

/** naprawa: night — basal cells divide in turn; the night's gold reaches the tissue from the capillaries. */
function drawNight(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const k = st.g;
  NIGHT_X.forEach((x0, i) => {
    const t = phase(k, 0.06 + i * 0.14, 0.26 + i * 0.14);
    if (t <= 0) return;
    const x = BASAL_X.reduce((m, b) => (Math.abs(b - x0) < Math.abs(m - x0) ? b : m), BASAL_X[0]);
    const y = memY(x) - 4.6;
    if (t < 1) {
      // the division: a spindle of gold, the two halves parting
      const s = 2.4 * smooth(t);
      glow(ctx, GOLD, x, y, 5, 0.5 * Math.sin(Math.PI * t));
      ctx.strokeStyle = rgba(GOLD, 0.7 * Math.sin(Math.PI * t));
      ctx.lineWidth = 0.3;
      for (let j = -2; j <= 2; j++) {
        ctx.beginPath();
        ctx.moveTo(x, y - 3.2);
        ctx.quadraticCurveTo(x + j * 0.9, y, x, y + 3.2);
        ctx.stroke();
      }
      cell(ctx, x, y - s, 2.6, 2.4, 0, '#cfe0ff', '#4a4a9a', 0.9, 0.4);
      cell(ctx, x, y + s * 0.4, 2.6, 2.4, 0, '#cfe0ff', '#4a4a9a', 0.9, 0.4);
    } else glow(ctx, '#bfd4ff', x, y, 4, 0.35);
  });
  // gold from the capillaries (growth hormone in the blood) drifts up into the tissue
  const n = Math.round(30 * k);
  for (let i = 0; i < n; i++) {
    const px = [-44, -6, 32][i % 3];
    const q = st.reduced ? hash(i * 2.2) : (st.time * 0.06 + hash(i * 5.1)) % 1;
    const x = px + (hash(i * 3.3) - 0.5) * 30 * q, y = memY(px) + 4 - q * 34;
    glow(ctx, GOLD, x, y, 1.6, 0.5 * Math.sin(Math.PI * q));
  }
}

/** mieszek: the bulge wakes, young cells go down, a new bulb forms, a new hair grows up and out. */
function drawFollicle(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const S = skinFor(st.look);
  const k = st.g;
  const wake = smooth(phase(k, 0, 0.2));
  // the bulge's stem cells
  for (let i = 0; i < 5; i++) {
    const a = -1.2 + i * 0.6;
    stemCell(ctx, BULGE[0] - 6.4 + Math.cos(a) * 1.8, BULGE[1] - 4 + i * 2.2, 1.9, wake * (0.6 + 0.4 * (i % 2)), st.time + i, st.reduced);
  }
  // the lower follicle grows down to the papilla
  const down = smooth(phase(k, 0.15, 0.5));
  if (down > 0) {
    const lower: Pt[] = [];
    for (let q = 0; q <= down + 1e-6; q += 0.05) lower.push(polyAt(CANAL.slice(2), q));
    if (lower.length > 1) tube(ctx, lower, 6, mix(S.basal, '#c89a90', 0.15), 'rgba(191,239,255,.5)');
    // the stream of young cells going down
    const n = Math.round(10 * down);
    for (let i = 0; i < n; i++) {
      const q = st.reduced ? (i + 0.5) / n * down : ((st.time * 0.12 + i / n) % 1) * down;
      const [x, y] = polyAt(CANAL.slice(2), q);
      glow(ctx, '#bfefff', x + 4.6, y, 1.8, 0.5);
    }
  }
  // the bulb round the papilla
  const bulb = smooth(phase(k, 0.45, 0.65));
  if (bulb > 0) {
    glow(ctx, '#ffc0a0', PAPILLA[0], PAPILLA[1] - 2, 12 * bulb, 0.35 * bulb);
    ctx.strokeStyle = rgba('#ffc8a8', 0.85 * bulb);
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(PAPILLA[0], PAPILLA[1] - 0.6, 7.4, Math.PI * 0.95, Math.PI * 2.05);
    ctx.stroke();
  }
  // the new hair: from the bulb up the canal and out
  const grow = smooth(phase(k, 0.6, 1));
  if (grow > 0) {
    const path: Pt[] = [...CANAL].reverse().map(p => [p[0], p[1]] as Pt);
    path[path.length - 1] = [-6.6, -58];
    path.push([-8, -68]);
    const hairC = st.look && lookOf(st.look).tone === 1 ? '#6a4228' : '#2a1a12';
    const pts: Pt[] = [];
    for (let q = 0; q <= grow + 1e-6; q += 0.025) pts.push(polyAt(path, q));
    if (pts.length > 1) {
      ctx.lineCap = 'round';
      for (const [w, c] of [[2.4, hairC], [0.7, rgba('#fff0dc', 0.45)]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.stroke();
      }
      const tip = pts[pts.length - 1];
      glow(ctx, GOLD, tip[0], tip[1], 4, 0.5);
    }
  }
}

export const NASKOREK_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake,
  draw(ctx, st) {
    if (st.scene === 'naprawa') drawNight(ctx, st);
    else drawRise(ctx, st);
    if (st.deep > 0.02) glowEllipse(ctx, '#ffd0c0', 0, -6, 70, 30, 0, 0.08 * st.deep);
  },
  focusAt(scene, g) {
    if (scene === 'naprawa') {
      const i = Math.min(NIGHT_X.length - 1, Math.floor(Math.max(0, g - 0.06) / 0.14));
      return [NIGHT_X[i], memY(NIGHT_X[i]) - 5];
    }
    if (g < 0.16) return [STEM_X, memY(STEM_X) - 4.6];
    return polyAt(RISE, smooth(phase(g, 0.16, 0.88)));
  },
  counter(scene, g) {
    if (scene === 'naprawa') return g > 0.1 ? tc('count.naprawa') : null;
    if (g < 0.16) return null;
    return tc('count.warstwa', Math.max(1, Math.round(39 * phase(g, 0.16, 0.88))));
  },
};

export const MIESZEK_WORLD: WorldPainter = {
  depth: 1,
  lens: true,
  bake: (ctx, _variant, look) => bake(ctx, 'mieszek', look),
  draw(ctx, st) {
    drawFollicle(ctx, st);
    if (st.deep > 0.02) glowEllipse(ctx, '#ffd0c0', 0, 0, 50, 70, 0, 0.07 * st.deep);
  },
  focusAt(_scene, g) {
    if (g < 0.2) return [BULGE[0] - 6, BULGE[1]];
    if (g < 0.5) return polyAt(CANAL.slice(2), smooth(phase(g, 0.15, 0.5)));
    if (g < 0.62) return [PAPILLA[0], PAPILLA[1] - 2];
    const path: Pt[] = [...CANAL].reverse().map(p => [p[0], p[1]] as Pt);
    return polyAt(path, smooth(phase(g, 0.6, 1)));
  },
  counter(_scene, g) {
    return g > 0.6 ? tc('count.mieszek') : null;
  },
};
