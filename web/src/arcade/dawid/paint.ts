/**
 * Dawid's painter, in the colours of the Judean hills at the golden hour — olive and sage, limestone,
 * ochre and terracotta, the blue of a brook; gold is kept for the band (the sling above the threshold)
 * and silver for the coins.  The ground of each land seen from above at a slant (pastures, stony hills,
 * the Valley of Elah, the fields of Gibeah, the wilderness of En-Gedi, the land of Gath), olive trees,
 * terebinths, limestone, thorn bushes, the brook, the shepherds' camp with its fire and buildings, the
 * gate and the lair; and the figures standing on it: people (David with his sling and harp, the lamb,
 * the companions, the people of the story, Goliath and his shield-bearer, the giants of Gath), the
 * beasts (round-eyed and a little comic; struck, they run off — nothing dies), the guardians, coins,
 * heaps, chests.  All canvas paths, no images; sizes in u (about a metre) times `s` (px per u).
 */
import type { BeastKind, BuildingId, CompanionId, Ground, GuardKind, LandSpec } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  ink: '#2b2118', inkSoft: 'rgba(43,33,24,.78)', parchment: '#f6ebd3', parchmentDeep: '#e6d2a8',
  gold: '#eab53d', goldDeep: '#b5821a', goldLight: '#ffe7a3', silver: '#e3eaf1', silverDeep: '#93a6ba',
  terracotta: '#c4643b', terracottaDeep: '#8f4127', olive: '#7f914f', oliveDeep: '#56663a', brook: '#5f9fc4', brookLight: '#a9d4ea',
  calm: '#88aae0', calmDeep: '#4a6aa6', danger: 'rgba(206,58,38,', skin: '#e3b48a', skinDark: '#b57f57', hair: '#a8462a',
  wool: '#f8f3e7', woolShade: '#d9cfbb', night: '#1b2136', ember: '#ff9a4a', fire: '#ffcf6a', lime: '#ebe2cd', limeShade: '#b9ac90',
};

const TAU = Math.PI * 2;

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** A soft radial glow (use with 'lighter' for light). */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number): void {
  if (a <= 0.003 || r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${color}${a})`);
  g.addColorStop(0.45, `${color}${a * 0.45})`);
  g.addColorStop(1, `${color}0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU);
  ctx.fill();
}

export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, a = 0.22): void {
  ellipse(ctx, x, y, rx, rx * 0.36, `rgba(40,28,14,${a})`);
}

// ── the ground of the lands ──────────────────────────────────────
export const GROUND: Record<Ground, { a: string; b: string; tuft: string; flower: string; edge: string; dust: string }> = {
  pasture: { a: '#a9b96c', b: '#94a75c', tuft: '#7f9549', flower: '#f3e6b0', edge: '#6b7d45', dust: '#c9b98a' },
  hills: { a: '#b8ab72', b: '#a4985f', tuft: '#8a8a4c', flower: '#e9d9a6', edge: '#7a7048', dust: '#d1c08e' },
  valley: { a: '#a3b166', b: '#8fa158', tuft: '#768c45', flower: '#f0e2ad', edge: '#66784a', dust: '#c5b27f' },
  fields: { a: '#c8bb6c', b: '#b7a95c', tuft: '#9a9a48', flower: '#f6dd88', edge: '#7c7a44', dust: '#dcc98d' },
  desert: { a: '#dcc391', b: '#cdb07b', tuft: '#b49a64', flower: '#efe1bf', edge: '#9c8256', dust: '#e8d6aa' },
  gath: { a: '#bfae86', b: '#ab9a74', tuft: '#8c8460', flower: '#e3d6b4', edge: '#7a6b51', dust: '#d4c4a0' },
};

export interface Deco { kind: 'olive' | 'terebinth' | 'acacia' | 'rock' | 'bush' | 'wall' | 'palm' | 'reeds'; x: number; y: number; r: number; seed: number }

/** The land's trees, rocks and walls, placed once (seeded), clear of the camp, the dens, the brook and the paths. */
export function decorate(land: LandSpec): Deco[] {
  const out: Deco[] = [];
  const kinds: Deco['kind'][] = land.ground === 'desert' ? ['acacia', 'rock', 'rock', 'bush', 'palm'] : land.ground === 'fields' ? ['olive', 'bush', 'wall', 'rock', 'olive'] : land.ground === 'gath' ? ['rock', 'terebinth', 'wall', 'bush', 'rock'] : ['olive', 'terebinth', 'rock', 'bush', 'wall', 'olive'];
  const clear = (x: number, y: number, r: number): boolean => {
    if (Math.hypot(x - land.camp[0], y - land.camp[1]) < 5.5 + r) return false;
    if (Math.hypot(x - land.gate[0], y - land.gate[1]) < 4 + r || Math.hypot(x - land.lair[0], y - land.lair[1]) < 4 + r) return false;
    for (const [, cx, cy] of land.camps) if (Math.hypot(x - cx, y - cy) < 3 + r) return false;
    for (const [, nx, ny] of land.nodes) if (Math.hypot(x - nx, y - ny) < 1.6 + r) return false;
    if (land.chest && Math.hypot(x - land.chest[0], y - land.chest[1]) < 2 + r) return false;
    for (const s of Object.values(land.spots)) if (s && Math.hypot(x - s[0], y - s[1]) < 2.2 + r) return false;
    return brookDist(land, x, y) > 1.6 + r;
  };
  let seed = land.id.length * 977;
  for (let i = 0; i < 260 && out.length < 120; i++) {
    seed++;
    const x = 1 + hash(seed * 3 + 1) * (land.w - 2), y = 1 + hash(seed * 7 + 2) * (land.h - 2);
    const kind = kinds[Math.floor(hash(seed * 11) * kinds.length)];
    const r = kind === 'wall' ? 1.6 : kind === 'rock' ? 0.5 + hash(seed) * 0.4 : kind === 'bush' ? 0.45 : 0.9 + hash(seed * 5) * 0.4;
    if (clear(x, y, r)) out.push({ kind, x, y, r, seed });
  }
  // reeds along the brook
  for (let i = 0; i < land.brook.length - 1; i++) {
    const [ax, ay] = land.brook[i], [bx, by] = land.brook[i + 1];
    for (let k = 0.2; k < 1; k += 0.35) {
      const x = ax + (bx - ax) * k + (hash(i * 31 + k * 100) - 0.5) * 1.6, y = ay + (by - ay) * k + 1.1;
      out.push({ kind: 'reeds', x, y, r: 0.4, seed: i * 7 + Math.round(k * 10) });
    }
  }
  return out;
}

/** The distance from a point to the brook (u). */
export function brookDist(land: LandSpec, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < land.brook.length - 1; i++) {
    const [ax, ay] = land.brook[i], [bx, by] = land.brook[i + 1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * k, y - ay - dy * k));
  }
  return best;
}

/**
 * The ground in sight: the land's colour, tufts and flowers (seeded per cell, so they stay put), the
 * hills beyond the map's edge, the brook with its pebbles and ripples, the dens' trampled patches.
 * `P(x, y)` maps u to px.
 */
export function paintGround(ctx: CanvasRenderingContext2D, land: LandSpec, P: (x: number, y: number) => { x: number; y: number },
  s: number, w: number, h: number, cx: number, cy: number, t: number): void {
  const g = GROUND[land.ground];
  ctx.fillStyle = g.edge;
  ctx.fillRect(0, 0, w, h);
  const o = P(0, 0), e = P(land.w, land.h);
  const grad = ctx.createLinearGradient(0, o.y, 0, e.y);
  grad.addColorStop(0, g.a);
  grad.addColorStop(1, g.b);
  ctx.fillStyle = grad;
  ctx.fillRect(o.x, o.y, e.x - o.x, e.y - o.y);
  // tufts, flowers and pebbles, cell by cell in sight
  const cell = 1.3;
  const hw = w / s / 2 + 2, hh = h / s / 2 + 2;
  const x0 = Math.floor((cx - hw) / cell), x1 = Math.ceil((cx + hw) / cell);
  const y0 = Math.floor((cy - hh) / cell), y1 = Math.ceil((cy + hh) / cell);
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const id = gx * 7919 + gy * 104729;
      const ux = (gx + hash(id)) * cell, uy = (gy + hash(id + 1)) * cell;
      const inside = ux > 0 && uy > 0 && ux < land.w && uy < land.h;
      const p = P(ux, uy);
      const k = hash(id + 2);
      if (!inside) {
        // the hills beyond: rounded slopes and stones
        ellipse(ctx, p.x, p.y, s * (0.9 + k), s * (0.5 + k * 0.4), k < 0.5 ? 'rgba(60,52,32,.22)' : 'rgba(255,240,200,.07)');
        if (k > 0.7) ellipse(ctx, p.x, p.y - s * 0.1, s * 0.35, s * 0.24, C.limeShade);
        continue;
      }
      if (k < 0.45) {
        ctx.strokeStyle = g.tuft;
        ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.beginPath();
        for (let j = -1; j <= 1; j++) {
          ctx.moveTo(p.x + j * s * 0.06, p.y);
          ctx.lineTo(p.x + j * s * 0.1 + Math.sin(t * 1.5 + id) * s * 0.02, p.y - s * (0.16 + 0.05 * Math.abs(j)));
        }
        ctx.stroke();
      } else if (k < 0.55) {
        ellipse(ctx, p.x, p.y, s * 0.05, s * 0.05, g.flower);
        ellipse(ctx, p.x + s * 0.12, p.y + s * 0.04, s * 0.04, s * 0.04, g.flower);
      } else if (k < 0.62) {
        ellipse(ctx, p.x, p.y, s * 0.09, s * 0.06, C.limeShade);
      } else if (k > 0.93) {
        ellipse(ctx, p.x, p.y, s * 0.5, s * 0.22, g.dust);
      }
    }
  }
  // the map's rim: a soft dark edge
  ctx.strokeStyle = 'rgba(50,40,20,.25)';
  ctx.lineWidth = s * 0.25;
  ctx.strokeRect(o.x, o.y, e.x - o.x, e.y - o.y);
  paintBrook(ctx, land, P, s, t);
}

export function paintBrook(ctx: CanvasRenderingContext2D, land: LandSpec, P: (x: number, y: number) => { x: number; y: number }, s: number, t: number): void {
  const pts = land.brook.map(([x, y]) => P(x, y));
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.strokeStyle = 'rgba(120,100,70,.35)';
  ctx.lineWidth = s * 1.5;
  ctx.stroke();
  path();
  ctx.strokeStyle = C.brook;
  ctx.lineWidth = s * 1.05;
  ctx.stroke();
  path();
  ctx.strokeStyle = 'rgba(140,196,224,.55)';
  ctx.lineWidth = s * 0.5;
  ctx.stroke();
  // glints drifting downstream
  ctx.strokeStyle = 'rgba(232,246,252,.75)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 0; i < land.brook.length - 1; i++) {
    const [ax, ay] = land.brook[i], [bx, by] = land.brook[i + 1];
    const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
    for (let k = 0; k < len; k += 1.1) {
      const f = ((k + t * 0.9 + hash(i * 13 + Math.round(k)) * 3) % len) / len;
      const side = (hash(i * 7 + Math.round(k * 10)) - 0.5) * 0.6;
      const p = P(ax + (bx - ax) * f + nx * side, ay + (by - ay) * f + ny * side);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.12, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
    }
  }
  // smooth stones along the banks
  for (let i = 0; i < land.brook.length - 1; i++) {
    const [ax, ay] = land.brook[i], [bx, by] = land.brook[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    for (let k = 0; k < len; k += 1.7) {
      const f = k / len, side = hash(i * 97 + k) < 0.5 ? -1 : 1;
      const p = P(ax + (bx - ax) * f, ay + (by - ay) * f + side * 0.62);
      ellipse(ctx, p.x, p.y, s * 0.1, s * 0.07, hash(i + k) < 0.5 ? '#e9e2d2' : '#cfc6b2');
    }
  }
  ctx.restore();
}

export function paintDeco(ctx: CanvasRenderingContext2D, d: Deco, x: number, y: number, s: number, t: number): void {
  const k = hash(d.seed);
  switch (d.kind) {
    case 'olive': case 'terebinth': case 'acacia': {
      const r = d.r * s;
      shadow(ctx, x + r * 0.15, y + r * 0.05, r * 0.9, 0.2);
      ctx.strokeStyle = '#6b5236';
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x - r * 0.15, y - r * 0.5, x + r * 0.05, y - r * 0.95);
      ctx.stroke();
      const sway = Math.sin(t * 0.8 + d.seed) * r * 0.03;
      if (d.kind === 'acacia') {
        ellipse(ctx, x + sway, y - r * 1.15, r * 1.05, r * 0.32, '#7d8a4a');
        ellipse(ctx, x - r * 0.2 + sway, y - r * 1.25, r * 0.7, r * 0.18, '#97a35d');
      } else {
        const dark = d.kind === 'olive' ? '#7a8b5c' : '#55703f', light = d.kind === 'olive' ? '#a3b07f' : '#77924f';
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7 + k * 3;
          ellipse(ctx, x + Math.cos(a) * r * 0.42 + sway, y - r * 1.15 + Math.sin(a) * r * 0.25, r * 0.55, r * 0.42, dark);
        }
        ellipse(ctx, x - r * 0.15 + sway, y - r * 1.32, r * 0.48, r * 0.32, light);
        if (d.kind === 'olive') for (let i = 0; i < 3; i++) ellipse(ctx, x + (hash(d.seed + i) - 0.5) * r + sway, y - r * (1 + hash(d.seed * 3 + i) * 0.5), r * 0.06, r * 0.06, '#4a4a32');
      }
      break;
    }
    case 'palm': {
      const r = d.r * s;
      shadow(ctx, x, y, r * 0.6, 0.2);
      ctx.strokeStyle = '#8a6a42';
      ctx.lineWidth = Math.max(2, r * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + r * 0.25, y - r, x + r * 0.1, y - r * 1.8);
      ctx.stroke();
      ctx.strokeStyle = '#6f8a45';
      ctx.lineWidth = Math.max(2, r * 0.12);
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.55 + Math.sin(t + i) * 0.04;
        ctx.beginPath();
        ctx.moveTo(x + r * 0.1, y - r * 1.8);
        ctx.quadraticCurveTo(x + r * 0.1 + Math.cos(a) * r * 0.6, y - r * 1.8 + Math.sin(a) * r * 0.3 - r * 0.2, x + r * 0.1 + Math.cos(a) * r, y - r * 1.8 + Math.sin(a) * r * 0.2 + r * 0.25);
        ctx.stroke();
      }
      break;
    }
    case 'rock': {
      const r = d.r * s;
      shadow(ctx, x, y + r * 0.1, r * 1.1, 0.25);
      ctx.fillStyle = C.limeShade;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.9, x - r * 0.1, y - r * (0.9 + k * 0.3));
      ctx.quadraticCurveTo(x + r * 0.8, y - r * 0.8, x + r, y);
      ctx.closePath();
      ctx.fill();
      ellipse(ctx, x - r * 0.2, y - r * 0.6, r * 0.45, r * 0.22, C.lime);
      break;
    }
    case 'bush': {
      const r = d.r * s;
      shadow(ctx, x, y, r, 0.18);
      for (let i = 0; i < 3; i++) ellipse(ctx, x + (i - 1) * r * 0.55, y - r * (0.4 + (i % 2) * 0.15), r * 0.55, r * 0.45, i === 1 ? '#8d8a52' : '#73733f');
      ellipse(ctx, x + r * 0.3, y - r * 0.75, r * 0.08, r * 0.08, '#b8584a');
      break;
    }
    case 'wall': {
      const len = d.r * s, a = k * Math.PI;
      for (let i = 0; i < 6; i++) {
        const f = i / 5 - 0.5;
        const sx = x + Math.cos(a) * len * f, sy = y + Math.sin(a) * len * f * 0.5;
        ellipse(ctx, sx, sy, s * 0.2, s * 0.13, i % 2 ? C.limeShade : '#d4c9b1');
        ellipse(ctx, sx + s * 0.05, sy - s * 0.15, s * 0.16, s * 0.1, '#e1d8c3');
      }
      break;
    }
    case 'reeds': {
      ctx.strokeStyle = '#7c8f4a';
      ctx.lineWidth = Math.max(1, s * 0.04);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const bx = x + (i - 1.5) * s * 0.1, sw = Math.sin(t * 2 + d.seed + i) * s * 0.04;
        ctx.moveTo(bx, y);
        ctx.lineTo(bx + sw, y - s * (0.45 + 0.1 * (i % 2)));
      }
      ctx.stroke();
      break;
    }
  }
}

// ── the camp: the fire, the tents, the buildings ─────────────────
export function paintFire(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, big = 1): void {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    ellipse(ctx, x + Math.cos(a) * s * 0.32 * big, y + Math.sin(a) * s * 0.16 * big, s * 0.1 * big, s * 0.07 * big, i % 2 ? '#9a8f7c' : '#bdb19a');
  }
  ellipse(ctx, x, y, s * 0.24 * big, s * 0.1 * big, '#3a2a1c');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - s * 0.3 * big, s * 1.6 * big, 'rgba(255,170,80,', 0.35 + 0.08 * Math.sin(t * 9));
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const fl = 0.75 + 0.25 * Math.sin(t * (8 + i * 3) + i);
    ctx.fillStyle = i === 0 ? C.terracotta : i === 1 ? C.ember : C.fire;
    const hh = s * (0.55 - i * 0.12) * fl * big, ww = s * (0.22 - i * 0.05) * big;
    ctx.beginPath();
    ctx.moveTo(x - ww, y);
    ctx.quadraticCurveTo(x - ww * 0.8, y - hh * 0.6, x + Math.sin(t * 6 + i) * ww * 0.4, y - hh);
    ctx.quadraticCurveTo(x + ww * 0.8, y - hh * 0.6, x + ww, y);
    ctx.closePath();
    ctx.fill();
  }
}

export function paintTent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hue: number): void {
  shadow(ctx, x, y + s * 0.05, s * 1.1, 0.25);
  ctx.fillStyle = hue ? '#4a3b31' : '#3a2f28';
  ctx.beginPath();
  ctx.moveTo(x - s * 1.1, y);
  ctx.lineTo(x - s * 0.8, y - s * 0.8);
  ctx.lineTo(x + s * 0.8, y - s * 0.85);
  ctx.lineTo(x + s * 1.1, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,200,160,.35)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (let i = 1; i < 4; i++) {
    const f = i / 4;
    ctx.beginPath();
    ctx.moveTo(x - s * 1.1 + s * 0.3 * f, y - s * 0.8 * f);
    ctx.lineTo(x + s * 1.1 - s * 0.3 * f, y - s * 0.85 * f);
    ctx.stroke();
  }
  ctx.fillStyle = '#20180f';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.25, y);
  ctx.lineTo(x, y - s * 0.55);
  ctx.lineTo(x + s * 0.25, y);
  ctx.fill();
}

/** A building of the camp at a level (0: an empty plot with its stakes). */
export function paintBuilding(ctx: CanvasRenderingContext2D, id: BuildingId, x: number, y: number, s: number, level: number, t: number): void {
  if (level <= 0) {
    ctx.strokeStyle = 'rgba(80,60,30,.45)';
    ctx.setLineDash([s * 0.12, s * 0.12]);
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.75, s * 0.32, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const dx of [-0.6, 0.6]) {
      ctx.strokeStyle = '#7a5a34';
      ctx.beginPath();
      ctx.moveTo(x + dx * s, y);
      ctx.lineTo(x + dx * s, y - s * 0.3);
      ctx.stroke();
    }
    return;
  }
  const big = 0.85 + 0.12 * Math.min(3, level);
  const S = s * big;
  shadow(ctx, x, y + S * 0.05, S * 0.9, 0.25);
  switch (id) {
    case 'ognisko': paintFire(ctx, x, y, s, t, 1 + 0.15 * level); break;
    case 'kuznia': {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(x - S * 0.7, y - S * 0.7, S * 1.4, S * 0.7);
      ctx.fillStyle = '#5a4030';
      ctx.beginPath();
      ctx.moveTo(x - S * 0.85, y - S * 0.65);
      ctx.lineTo(x, y - S * 1.15);
      ctx.lineTo(x + S * 0.85, y - S * 0.65);
      ctx.fill();
      ctx.fillStyle = '#6b6b70';
      ctx.fillRect(x + S * 0.3, y - S * 1.35, S * 0.22, S * 0.55);
      ellipse(ctx, x - S * 0.15, y - S * 0.25, S * 0.25, S * 0.18, '#ff8a3a');
      ctx.fillStyle = '#4a4a50';
      ctx.fillRect(x + S * 0.1, y - S * 0.32, S * 0.4, S * 0.12);
      if (Math.sin(t * 3) > 0.7) ellipse(ctx, x + S * 0.41, y - S * 1.5 - (t % 1) * S * 0.3, S * 0.12, S * 0.1, 'rgba(200,200,200,.4)');
      break;
    }
    case 'spichlerz': {
      ctx.fillStyle = '#c9a26a';
      ctx.beginPath();
      ctx.ellipse(x, y - S * 0.45, S * 0.6, S * 0.5, 0, Math.PI, 0);
      ctx.lineTo(x + S * 0.6, y);
      ctx.lineTo(x - S * 0.6, y);
      ctx.fill();
      ctx.fillStyle = '#a57c48';
      ctx.fillRect(x - S * 0.6, y - S * 0.45, S * 1.2, S * 0.08);
      ctx.fillStyle = '#5a3e22';
      ctx.fillRect(x - S * 0.15, y - S * 0.38, S * 0.3, S * 0.38);
      for (let i = 0; i < level; i++) ellipse(ctx, x + S * (0.75 + i * 0.22), y - S * 0.12, S * 0.14, S * 0.12, '#d8b36a');
      break;
    }
    case 'studnia': {
      ellipse(ctx, x, y - S * 0.2, S * 0.55, S * 0.28, '#b9ac90');
      ellipse(ctx, x, y - S * 0.26, S * 0.42, S * 0.2, '#3a5a72');
      ellipse(ctx, x - S * 0.1, y - S * 0.3, S * 0.12, S * 0.05, 'rgba(200,230,250,.5)');
      ctx.strokeStyle = '#6b5236';
      ctx.lineWidth = Math.max(1.5, S * 0.07);
      ctx.beginPath();
      ctx.moveTo(x - S * 0.45, y - S * 0.2);
      ctx.lineTo(x - S * 0.45, y - S * 0.95);
      ctx.lineTo(x + S * 0.45, y - S * 0.95);
      ctx.lineTo(x + S * 0.45, y - S * 0.2);
      ctx.stroke();
      ellipse(ctx, x, y - S * 0.75, S * 0.1, S * 0.12, '#8a6a42');
      break;
    }
    case 'owczarnia': {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ellipse(ctx, x + Math.cos(a) * S * 0.85, y - S * 0.2 + Math.sin(a) * S * 0.45, S * 0.16, S * 0.12, i % 2 ? C.limeShade : C.lime);
      }
      for (let i = 0; i < 2 + level; i++) paintSheep(ctx, x + (i - 1) * S * 0.38, y - S * 0.25 + (i % 2) * S * 0.12, S * 0.55, t + i);
      break;
    }
    case 'jaskinia': {
      ctx.fillStyle = '#a8977a';
      ctx.beginPath();
      ctx.ellipse(x, y - S * 0.2, S * 1.05, S * 0.8, 0, Math.PI, 0);
      ctx.lineTo(x + S * 1.05, y);
      ctx.lineTo(x - S * 1.05, y);
      ctx.fill();
      ctx.fillStyle = '#1e1712';
      ctx.beginPath();
      ctx.ellipse(x, y, S * 0.5, S * 0.62, 0, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y - S * 0.2, S * 0.6, 'rgba(255,170,90,', 0.15 + 0.05 * Math.sin(t * 4));
      ctx.restore();
      break;
    }
  }
}

/** A sheep of the flock (scenery only: the flock is never the play's crowd). */
export function paintSheep(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  shadow(ctx, x, y + s * 0.02, s * 0.32, 0.18);
  for (let i = 0; i < 4; i++) ellipse(ctx, x + (i - 1.5) * s * 0.11, y - s * 0.28 + (i % 2) * s * 0.04, s * 0.17, s * 0.15, i % 2 ? C.woolShade : C.wool);
  ellipse(ctx, x + s * 0.26, y - s * 0.32 + Math.sin(t * 2) * s * 0.01, s * 0.09, s * 0.11, '#3b3029');
}

/** The gate to the next land: two standing stones and a barrier (open: the barrier swung aside, a warm glow). */
export function paintGate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, open: boolean, t: number): void {
  for (const dx of [-1, 1]) {
    shadow(ctx, x + dx * s * 0.9, y, s * 0.45, 0.25);
    ctx.fillStyle = C.limeShade;
    ctx.beginPath();
    ctx.moveTo(x + dx * s * 0.9 - s * 0.3, y);
    ctx.lineTo(x + dx * s * 0.9 - s * 0.22, y - s * 1.6);
    ctx.quadraticCurveTo(x + dx * s * 0.9, y - s * 1.85, x + dx * s * 0.9 + s * 0.22, y - s * 1.6);
    ctx.lineTo(x + dx * s * 0.9 + s * 0.3, y);
    ctx.fill();
    ellipse(ctx, x + dx * s * 0.85, y - s * 1.2, s * 0.1, s * 0.25, C.lime);
  }
  if (open) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - s * 0.8, s * 2.2, 'rgba(255,220,140,', 0.35 + 0.12 * Math.sin(t * 3));
    ctx.restore();
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.9, y - s * 0.5);
    ctx.lineTo(x + s * 1.6, y + s * 0.2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = Math.max(2, s * 0.12);
    for (const yy of [0.45, 0.9]) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.9, y - s * yy);
      ctx.lineTo(x + s * 0.9, y - s * yy);
      ctx.stroke();
    }
  }
}

/** The guardian's lair: a thicket (the lion), a den (the bear, the leopard), a giant's stage (Goliath, Gath). */
export function paintLair(ctx: CanvasRenderingContext2D, kind: GuardKind, x: number, y: number, s: number): void {
  if (kind === 'goliat' || kind === 'olbrzym') {
    ellipse(ctx, x, y, s * 2.2, s * 0.9, 'rgba(120,96,60,.28)');
    return;
  }
  if (kind === 'lew' || kind === 'tur') {
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + (i / 5) * Math.PI;
      ellipse(ctx, x + Math.cos(a) * s * 1.6, y - s * 0.3 + Math.sin(a) * s * 0.8, s * 0.6, s * 0.45, i % 2 ? '#6c7a3e' : '#56653a');
    }
    return;
  }
  ctx.fillStyle = '#8f8068';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.4, s * 1.6, s * 1.1, 0, Math.PI, 0);
  ctx.lineTo(x + s * 1.6, y);
  ctx.lineTo(x - s * 1.6, y);
  ctx.fill();
  ctx.fillStyle = '#2a211a';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.75, s * 0.8, 0, Math.PI, 0);
  ctx.fill();
}

/** A den's trampled patch (a burrow, a hornets' tree, a rocky den…). */
export function paintDen(ctx: CanvasRenderingContext2D, kind: BeastKind, x: number, y: number, s: number): void {
  ellipse(ctx, x, y, s * 1.6, s * 0.7, 'rgba(120,96,60,.18)');
  if (kind === 'szerszen') {
    paintDeco(ctx, { kind: 'terebinth', x, y, r: 1.1, seed: 3 }, x, y - s * 0.1, s, 0);
    ellipse(ctx, x + s * 0.35, y - s * 1.0, s * 0.2, s * 0.26, '#c9a65a');
    ellipse(ctx, x + s * 0.35, y - s * 1.0, s * 0.12, s * 0.06, '#5a4630');
  } else if (kind === 'zmija' || kind === 'skorpion') {
    for (let i = 0; i < 4; i++) ellipse(ctx, x + (i - 1.5) * s * 0.45, y + (i % 2) * s * 0.2, s * 0.24, s * 0.15, i % 2 ? C.limeShade : C.lime);
  } else {
    ellipse(ctx, x + s * 0.4, y - s * 0.05, s * 0.35, s * 0.18, '#3a2c1c');
  }
}

// ── people ───────────────────────────────────────────────────────
export interface Look {
  skin: string; hair: string; beard?: string; tunic: string; trim?: string; cloak?: string; belt?: string;
  head?: 'band' | 'scarf' | 'crown' | 'helmet' | 'feathers' | 'circlet';
  item?: 'sling' | 'bow' | 'shield' | 'basket' | 'club' | 'hoe' | 'staff' | 'spear' | 'harp' | 'none';
  /** height factor (1 = David) */
  size?: number;
  bag?: boolean;
  armour?: boolean;
}

export interface PersonPose { flip: number; step: number; walking: number; sit: number; act: number; hit: number; t: number; talk?: boolean; down?: number }

export const LOOKS: Record<'david' | CompanionId | 'jesse' | 'eliab' | 'saul' | 'sluga' | 'itaj' | 'bearer', Look> = {
  david: { skin: C.skin, hair: C.hair, tunic: '#e7d3a1', trim: '#b8743c', belt: '#7a4a28', item: 'sling', bag: true },
  asahel: { skin: C.skin, hair: '#3a2a1c', tunic: '#7da35a', trim: '#e7d3a1', belt: '#5a3a1c', head: 'band', item: 'none', size: 1.04 },
  abiszaj: { skin: C.skin, hair: '#2e2118', beard: '#2e2118', tunic: '#5577a8', trim: '#e2d2a8', belt: '#3a2a18', item: 'shield', size: 1.08 },
  jonatan: { skin: C.skin, hair: '#4a2e1c', beard: '#4a2e1c', tunic: '#8e3a5a', trim: '#eab53d', cloak: '#6a2a46', belt: '#e2b23c', head: 'circlet', item: 'bow', size: 1.1 },
  abigail: { skin: C.skin, hair: '#3a261a', tunic: '#c46e3e', trim: '#f0dcae', head: 'scarf', cloak: '#e7cf9a', item: 'basket', size: 1.02 },
  benajasz: { skin: C.skinDark, hair: '#2a1d14', beard: '#2a1d14', tunic: '#6e4c34', trim: '#c9a87a', belt: '#3a2a18', item: 'club', size: 1.22 },
  szamma: { skin: C.skinDark, hair: '#5a3e24', beard: '#5a3e24', tunic: '#8c8c4c', trim: '#d8c58a', belt: '#5a3e24', item: 'hoe', size: 1.1 },
  jesse: { skin: C.skin, hair: '#e8e2d6', beard: '#efeae0', tunic: '#a88a62', cloak: '#7a5e3e', item: 'staff', size: 1.05 },
  eliab: { skin: C.skin, hair: '#2a1d14', beard: '#2a1d14', tunic: '#8a6a4a', trim: '#c9b08a', belt: '#3a2a18', item: 'spear', size: 1.18 },
  saul: { skin: C.skin, hair: '#2a1d14', beard: '#3a2a1c', tunic: '#7a3a5a', trim: '#eab53d', cloak: '#5a2a4a', head: 'crown', item: 'spear', size: 1.3, armour: true },
  sluga: { skin: C.skin, hair: '#3a2a1c', tunic: '#cbb58a', trim: '#8a6a4a', belt: '#5a3a1c', item: 'none', size: 1.02 },
  itaj: { skin: C.skin, hair: '#3a2a1c', beard: '#3a2a1c', tunic: '#b8863b', trim: '#e3d6b4', head: 'feathers', item: 'spear', size: 1.12 },
  bearer: { skin: C.skin, hair: '#3a2a1c', tunic: '#a2794a', trim: '#e3d6b4', head: 'feathers', item: 'none', size: 0.95 },
};

/**
 * A person standing (or sitting, or knocked down) at (x, y) = the feet, `s` px per u: legs that walk,
 * a tunic with its trim, a belt, a cloak, a head with hair, a beard, a headdress, and what they carry.
 * David's sling is drawn by the view (its whirl is the band's gauge); here only its cord in his hand.
 */
export function paintPerson(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, L: Look, p: PersonPose): void {
  const k = (L.size ?? 1) * s;
  const f = p.flip >= 0 ? 1 : -1;
  ctx.save();
  if (p.down && p.down > 0) {
    shadow(ctx, x, y, k * 0.55, 0.25);
    ctx.translate(x, y - k * 0.12);
    ctx.rotate(-f * Math.PI * 0.45 * Math.min(1, p.down));
    ctx.translate(-x, -(y - k * 0.12));
  } else shadow(ctx, x, y, k * 0.32, 0.25);
  const bob = p.walking * Math.abs(Math.sin(p.step)) * k * 0.05;
  const sit = p.sit;
  const hipY = y - k * (0.62 - sit * 0.3) - bob;
  // legs
  if (sit < 0.5) {
    const sw = Math.sin(p.step) * p.walking * k * 0.14;
    ctx.strokeStyle = L.skin;
    ctx.lineWidth = Math.max(2, k * 0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - k * 0.08, hipY);
    ctx.lineTo(x - k * 0.08 + sw, y - k * 0.04);
    ctx.moveTo(x + k * 0.08, hipY);
    ctx.lineTo(x + k * 0.08 - sw, y - k * 0.04);
    ctx.stroke();
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = Math.max(2, k * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - k * 0.13 + sw, y - k * 0.03);
    ctx.lineTo(x - k * 0.01 + sw, y - k * 0.03);
    ctx.moveTo(x + k * 0.03 - sw, y - k * 0.03);
    ctx.lineTo(x + k * 0.15 - sw, y - k * 0.03);
    ctx.stroke();
  } else {
    ellipse(ctx, x, y - k * 0.12, k * 0.34, k * 0.12, L.tunic);
    ellipse(ctx, x - k * 0.22, y - k * 0.08, k * 0.08, k * 0.05, L.skin);
    ellipse(ctx, x + k * 0.22, y - k * 0.08, k * 0.08, k * 0.05, L.skin);
  }
  // the cloak behind
  if (L.cloak) {
    ctx.fillStyle = L.cloak;
    ctx.beginPath();
    ctx.moveTo(x - k * 0.24, hipY - k * 0.5);
    ctx.lineTo(x - k * 0.3 - f * k * 0.05, hipY + k * 0.25 - sit * k * 0.2);
    ctx.lineTo(x + k * 0.3 - f * k * 0.05, hipY + k * 0.25 - sit * k * 0.2);
    ctx.lineTo(x + k * 0.24, hipY - k * 0.5);
    ctx.fill();
  }
  // the tunic
  ctx.fillStyle = L.armour ? '#b8863b' : L.tunic;
  ctx.beginPath();
  ctx.moveTo(x - k * 0.2, hipY - k * 0.5);
  ctx.quadraticCurveTo(x - k * 0.27, hipY - k * 0.1, x - k * 0.24, hipY + k * 0.12);
  ctx.lineTo(x + k * 0.24, hipY + k * 0.12);
  ctx.quadraticCurveTo(x + k * 0.27, hipY - k * 0.1, x + k * 0.2, hipY - k * 0.5);
  ctx.closePath();
  ctx.fill();
  if (L.armour) {
    ctx.strokeStyle = 'rgba(90,60,20,.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - k * 0.2, hipY - k * (0.4 - i * 0.12));
      ctx.lineTo(x + k * 0.2, hipY - k * (0.4 - i * 0.12));
      ctx.stroke();
    }
  }
  if (L.trim) {
    ctx.fillStyle = L.trim;
    ctx.fillRect(x - k * 0.24, hipY + k * 0.07, k * 0.48, k * 0.05);
  }
  if (L.belt) {
    ctx.fillStyle = L.belt;
    ctx.fillRect(x - k * 0.22, hipY - k * 0.16, k * 0.44, k * 0.06);
  }
  if (L.bag) {
    ellipse(ctx, x - f * k * 0.2, hipY - k * 0.05, k * 0.12, k * 0.13, '#8a5a34');
    ctx.strokeStyle = '#6a4224';
    ctx.lineWidth = Math.max(1, k * 0.03);
    ctx.beginPath();
    ctx.moveTo(x - f * k * 0.2, hipY - k * 0.12);
    ctx.lineTo(x + f * k * 0.15, hipY - k * 0.5);
    ctx.stroke();
  }
  // arms
  const armY = hipY - k * 0.42;
  const reach = p.act > 0 ? 0.35 : 0.1;
  ctx.strokeStyle = L.skin;
  ctx.lineWidth = Math.max(2, k * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - f * k * 0.18, armY);
  ctx.lineTo(x - f * k * 0.24, armY + k * 0.28 - Math.sin(p.step) * p.walking * k * 0.05);
  ctx.moveTo(x + f * k * 0.18, armY);
  ctx.lineTo(x + f * k * (0.24 + reach), armY + k * (0.28 - reach * 0.8));
  ctx.stroke();
  const hx = x + f * k * (0.24 + reach), hy = armY + k * (0.28 - reach * 0.8);
  paintItem(ctx, L.item ?? 'none', hx, hy, k, f, p);
  // the head
  const headY = hipY - k * 0.68;
  ellipse(ctx, x, headY, k * 0.17, k * 0.18, L.skin);
  ctx.fillStyle = L.hair;
  ctx.beginPath();
  ctx.ellipse(x - f * k * 0.02, headY - k * 0.05, k * 0.18, k * 0.14, 0, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  ellipse(ctx, x - f * k * 0.14, headY, k * 0.06, k * 0.11, L.hair);
  if (L.beard) {
    ctx.fillStyle = L.beard;
    ctx.beginPath();
    ctx.ellipse(x + f * k * 0.03, headY + k * 0.1, k * 0.13, k * 0.12, 0, 0, Math.PI);
    ctx.fill();
  }
  // eyes (two dots, looking the way he faces) and, when talking, a little mouth
  ellipse(ctx, x + f * k * 0.07, headY - k * 0.01, k * 0.022, k * 0.028, '#2b2118');
  ellipse(ctx, x + f * k * 0.13, headY - k * 0.01, k * 0.018, k * 0.024, '#2b2118');
  if (p.talk && Math.sin(p.t * 18) > 0) ellipse(ctx, x + f * k * 0.1, headY + k * 0.08, k * 0.03, k * 0.02, '#7a3a2a');
  switch (L.head) {
    case 'band': ctx.fillStyle = '#e7d3a1'; ctx.fillRect(x - k * 0.18, headY - k * 0.1, k * 0.36, k * 0.05); break;
    case 'scarf':
      ctx.fillStyle = L.cloak ?? '#e7cf9a';
      ctx.beginPath();
      ctx.ellipse(x - f * k * 0.02, headY - k * 0.02, k * 0.22, k * 0.22, 0, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(x - f * k * 0.2, headY + k * 0.25);
      ctx.fill();
      break;
    case 'crown':
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(x - k * 0.16, headY - k * 0.12);
      for (let i = 0; i <= 4; i++) ctx.lineTo(x - k * 0.16 + (i * k * 0.32) / 4, headY - k * (i % 2 ? 0.2 : 0.3));
      ctx.lineTo(x + k * 0.16, headY - k * 0.12);
      ctx.fill();
      break;
    case 'circlet': ctx.fillStyle = C.gold; ctx.fillRect(x - k * 0.17, headY - k * 0.12, k * 0.34, k * 0.035); break;
    case 'helmet':
      ctx.fillStyle = '#b8863b';
      ctx.beginPath();
      ctx.ellipse(x, headY - k * 0.06, k * 0.2, k * 0.17, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - k * 0.2, headY - k * 0.07, k * 0.4, k * 0.05);
      break;
    case 'feathers':
      ctx.fillStyle = '#e8d7a8';
      for (let i = 0; i < 6; i++) {
        const fx = x - k * 0.15 + i * k * 0.06;
        ctx.beginPath();
        ctx.ellipse(fx, headY - k * 0.22, k * 0.025, k * 0.11, (i - 2.5) * 0.08, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x - k * 0.18, headY - k * 0.13, k * 0.36, k * 0.04);
      break;
    default: break;
  }
  if (p.hit > 0) {
    ctx.globalAlpha = 0.45;
    ellipse(ctx, x, hipY - k * 0.3, k * 0.32, k * 0.55, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function paintItem(ctx: CanvasRenderingContext2D, item: NonNullable<Look['item']>, hx: number, hy: number, k: number, f: number, p: PersonPose): void {
  ctx.lineCap = 'round';
  switch (item) {
    case 'staff': case 'spear':
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = Math.max(1.5, k * 0.05);
      ctx.beginPath();
      ctx.moveTo(hx, hy + k * 0.35);
      ctx.lineTo(hx + f * k * 0.04, hy - k * 0.85);
      ctx.stroke();
      if (item === 'spear') {
        ctx.fillStyle = '#c9d1dc';
        ctx.beginPath();
        ctx.moveTo(hx + f * k * 0.04, hy - k * 1.05);
        ctx.lineTo(hx + f * k * 0.04 - k * 0.05, hy - k * 0.85);
        ctx.lineTo(hx + f * k * 0.04 + k * 0.05, hy - k * 0.85);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(hx + f * k * 0.12, hy - k * 0.85, k * 0.08, Math.PI, f > 0 ? 0 : TAU);
        ctx.stroke();
      }
      break;
    case 'bow':
      ctx.strokeStyle = '#7a4a2a';
      ctx.lineWidth = Math.max(1.5, k * 0.05);
      ctx.beginPath();
      ctx.arc(hx, hy - k * 0.1, k * 0.32, f > 0 ? -1.2 : Math.PI - 1.2 + 0.4, f > 0 ? 1.2 : Math.PI + 1.2 - 0.4);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(240,230,200,.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(-1.2) * k * 0.32 * f, hy - k * 0.1 + Math.sin(-1.2) * k * 0.32);
      ctx.lineTo(hx + Math.cos(1.2) * k * 0.32 * f, hy - k * 0.1 + Math.sin(1.2) * k * 0.32);
      ctx.stroke();
      break;
    case 'shield':
      ellipse(ctx, hx + f * k * 0.05, hy - k * 0.1, k * 0.26, k * 0.32, '#8a6a42');
      ellipse(ctx, hx + f * k * 0.05, hy - k * 0.1, k * 0.2, k * 0.25, '#b08a54');
      ellipse(ctx, hx + f * k * 0.05, hy - k * 0.1, k * 0.06, k * 0.07, '#e2b23c');
      break;
    case 'basket':
      ctx.fillStyle = '#b8864a';
      ctx.beginPath();
      ctx.ellipse(hx, hy + k * 0.05, k * 0.2, k * 0.13, 0, 0, Math.PI);
      ctx.fill();
      ellipse(ctx, hx - k * 0.06, hy, k * 0.07, k * 0.05, '#e8c27a');
      ellipse(ctx, hx + k * 0.07, hy - k * 0.01, k * 0.06, k * 0.05, '#6a3a5a');
      break;
    case 'club':
      ctx.strokeStyle = '#5a3e24';
      ctx.lineWidth = Math.max(2, k * 0.09);
      ctx.beginPath();
      ctx.moveTo(hx, hy + k * 0.1);
      ctx.lineTo(hx + f * k * 0.25, hy - k * 0.45 - (p.act > 0 ? k * 0.2 : 0));
      ctx.stroke();
      break;
    case 'hoe':
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = Math.max(1.5, k * 0.05);
      ctx.beginPath();
      ctx.moveTo(hx, hy + k * 0.3);
      ctx.lineTo(hx + f * k * 0.1, hy - k * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#9aa0a8';
      ctx.fillRect(hx + f * k * 0.1 - k * 0.12, hy - k * 0.75, k * 0.24, k * 0.07);
      break;
    case 'harp': paintHarp(ctx, hx - f * k * 0.05, hy - k * 0.05, k * 0.55, p.t); break;
    case 'sling':
      ctx.strokeStyle = '#6a4224';
      ctx.lineWidth = Math.max(1, k * 0.03);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + f * k * 0.05, hy + k * 0.18);
      ctx.stroke();
      break;
    default: break;
  }
}

/** David's harp (a kinnor): a curved frame and strings that shimmer as they are played. */
export function paintHarp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.strokeStyle = '#a8642c';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.25, y + s * 0.3);
  ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.3, x - s * 0.2, y - s * 0.55);
  ctx.moveTo(x + s * 0.25, y + s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.3, x + s * 0.2, y - s * 0.55);
  ctx.moveTo(x - s * 0.25, y - s * 0.45);
  ctx.lineTo(x + s * 0.25, y - s * 0.45);
  ctx.moveTo(x - s * 0.27, y + s * 0.3);
  ctx.lineTo(x + s * 0.27, y + s * 0.3);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const sx = x - s * 0.16 + i * s * 0.08;
    ctx.strokeStyle = `rgba(255,240,200,${0.55 + 0.35 * Math.sin(t * 14 + i * 1.7)})`;
    ctx.beginPath();
    ctx.moveTo(sx, y - s * 0.43);
    ctx.lineTo(sx + Math.sin(t * 30 + i) * 0.6, y + s * 0.28);
    ctx.stroke();
  }
}

/** Kłębek, the lamb: a cloud of wool, a dark face, little hooves; it sleeps curled by the fire. */
export function paintLamb(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: { flip: number; step: number; walking: number; sleep: number; talk: boolean; t: number; scared?: number }): void {
  const f = p.flip >= 0 ? 1 : -1;
  const hop = p.walking * Math.abs(Math.sin(p.step * 1.2)) * s * 0.08;
  const k = s * 0.55;
  shadow(ctx, x, y, k * 0.5, 0.2);
  if (p.sleep > 0.5) {
    for (let i = 0; i < 5; i++) ellipse(ctx, x + Math.cos(i * 1.3) * k * 0.25, y - k * 0.25 + Math.sin(i * 1.3) * k * 0.1, k * 0.25, k * 0.2, i % 2 ? C.woolShade : C.wool);
    ellipse(ctx, x + f * k * 0.3, y - k * 0.2, k * 0.13, k * 0.11, '#2b2420');
    return;
  }
  const by = y - k * 0.42 - hop;
  ctx.strokeStyle = '#2b2420';
  ctx.lineWidth = Math.max(1.5, k * 0.08);
  for (const dx of [-0.2, -0.07, 0.08, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * k, by + k * 0.15);
    ctx.lineTo(x + dx * k + Math.sin(p.step * 1.2 + dx * 9) * p.walking * k * 0.06, y - hop * 0.3);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) ellipse(ctx, x + Math.cos(i * 1.05) * k * 0.24, by + Math.sin(i * 1.05) * k * 0.13, k * 0.2, k * 0.18, i % 2 ? C.woolShade : C.wool);
  ellipse(ctx, x, by - k * 0.05, k * 0.26, k * 0.2, C.wool);
  const hx = x + f * k * 0.34, hy = by - k * 0.12 + (p.scared ? Math.sin(p.t * 40) * k * 0.02 : 0);
  ellipse(ctx, hx, hy, k * 0.14, k * 0.15, '#2b2420');
  ellipse(ctx, hx - f * k * 0.12, hy - k * 0.04, k * 0.08, k * 0.04, '#2b2420');
  ellipse(ctx, hx + f * k * 0.04, hy - k * 0.03, k * 0.03, k * 0.035, '#ffffff');
  ellipse(ctx, hx + f * k * 0.045, hy - k * 0.03, k * 0.015, k * 0.02, '#111');
  ellipse(ctx, hx - f * k * 0.02, hy - k * 0.13, k * 0.1, k * 0.08, C.wool);
  if (p.talk && Math.sin(p.t * 16) > 0) ellipse(ctx, hx + f * k * 0.06, hy + k * 0.08, k * 0.03, k * 0.02, '#c77');
}

// ── beasts ───────────────────────────────────────────────────────
interface Quad { body: string; belly: string; dark: string; len: number; h: number; head: number; ear: number; tail: 'thin' | 'bushy' | 'tuft' | 'stub'; mane?: string; spots?: string; tusks?: boolean; horns?: boolean; tufts?: boolean }

const QUADS: Partial<Record<BeastKind | GuardKind | 'tur_g', Quad>> = {
  szakal: { body: '#c99a5b', belly: '#ecd3a4', dark: '#6a4a2a', len: 0.62, h: 0.42, head: 0.17, ear: 0.13, tail: 'bushy' },
  wilk: { body: '#8f8b86', belly: '#d8d2c8', dark: '#4a4642', len: 0.78, h: 0.5, head: 0.2, ear: 0.11, tail: 'bushy' },
  dzik: { body: '#5c4838', belly: '#7c6650', dark: '#2e241c', len: 0.85, h: 0.48, head: 0.24, ear: 0.08, tail: 'thin', tusks: true },
  hiena: { body: '#b9a276', belly: '#dccaa0', dark: '#4a3a28', len: 0.8, h: 0.55, head: 0.21, ear: 0.1, tail: 'tuft', spots: '#5a4630' },
  tur: { body: '#463529', belly: '#6a5442', dark: '#1e1612', len: 1.05, h: 0.7, head: 0.27, ear: 0.08, tail: 'tuft', horns: true },
  karakal: { body: '#c5955e', belly: '#ecd3a8', dark: '#2a1e14', len: 0.7, h: 0.48, head: 0.17, ear: 0.16, tail: 'stub', tufts: true },
  lew: { body: '#d2a24c', belly: '#ecd09a', dark: '#5a3a1c', len: 1.25, h: 0.82, head: 0.3, ear: 0.08, tail: 'tuft', mane: '#9a5a26' },
  niedzwiedzica: { body: '#6c4b33', belly: '#8c6a4c', dark: '#2e1f14', len: 1.3, h: 0.95, head: 0.32, ear: 0.1, tail: 'stub' },
  tur_g: { body: '#3a2b21', belly: '#5a4636', dark: '#140e0a', len: 1.6, h: 1.05, head: 0.36, ear: 0.1, tail: 'tuft', horns: true },
  lampart: { body: '#d9ad55', belly: '#f2dcaa', dark: '#3a2a14', len: 1.2, h: 0.72, head: 0.24, ear: 0.09, tail: 'thin', spots: '#4a3418' },
};

export interface BeastPose { flip: number; step: number; moving: number; hit: number; doze: number; t: number; air: number; tele: number; flee: number; seed: number; hidden: boolean; elite?: boolean; stun?: number }

/** A beast at (x, y) = its feet on the ground; `s` px per u; `scale` for guardians. */
export function paintBeast(ctx: CanvasRenderingContext2D, kind: BeastKind | GuardKind, x: number, y: number, s: number, p: BeastPose, scale = 1): void {
  ctx.save();
  if (p.flee > 0) ctx.globalAlpha = Math.max(0, 1 - p.flee);
  if (p.hidden) ctx.globalAlpha *= 0.35;
  if (kind === 'zmija') paintViper(ctx, x, y, s * scale, p);
  else if (kind === 'skorpion') paintScorpion(ctx, x, y, s * scale, p);
  else if (kind === 'sep') paintVulture(ctx, x, y, s * scale, p);
  else if (kind === 'szerszen') paintHornet(ctx, x, y, s * scale, p);
  else {
    const q = kind === 'tur' && scale > 1.2 ? QUADS.tur_g : QUADS[kind];
    if (q) paintQuad(ctx, x, y, s * scale, q, p);
  }
  ctx.restore();
  if (p.doze > 0.5 && p.flee <= 0) {
    ctx.fillStyle = 'rgba(240,245,255,.85)';
    ctx.font = font(800, s * 0.32, SANS);
    ctx.textAlign = 'center';
    const zz = (p.t * 0.6 + p.seed * 0.17) % 1;
    ctx.globalAlpha = 1 - zz;
    ctx.fillText('z', x + s * 0.3 * scale + zz * s * 0.3, y - s * (0.8 * scale + zz * 0.6));
    ctx.globalAlpha = 1;
  }
  if (p.stun && p.stun > 0) {
    ctx.fillStyle = C.goldLight;
    ctx.font = font(800, s * 0.26, SANS);
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const a = p.t * 5 + (i * TAU) / 3;
      ctx.fillText('★', x + Math.cos(a) * s * 0.35 * scale, y - s * 1.0 * scale + Math.sin(a) * s * 0.1);
    }
  }
}

function paintQuad(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, q: Quad, p: BeastPose): void {
  const f = p.flip >= 0 ? 1 : -1;
  const L = q.len * s, H = q.h * s;
  const lift = p.air * s;
  shadow(ctx, x, y, L * 0.55, p.air > 0 ? 0.12 : 0.22);
  const by = y - H * 0.62 - lift + (p.doze > 0.5 ? H * 0.28 : 0);
  const gait = p.moving > 0 ? Math.sin(p.step) : 0;
  const crouch = p.tele > 0 ? H * 0.12 : 0;
  // legs
  if (p.doze < 0.5) {
    ctx.strokeStyle = q.dark;
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.lineCap = 'round';
    for (const [lx, ph] of [[-0.32, 0], [-0.18, Math.PI], [0.2, Math.PI], [0.34, 0]] as const) {
      const sw = gait * Math.cos(ph) * L * 0.08;
      ctx.beginPath();
      ctx.moveTo(x + lx * L * f, by + H * 0.18 + crouch);
      ctx.lineTo(x + lx * L * f + sw, y - lift);
      ctx.stroke();
    }
  }
  // tail
  ctx.strokeStyle = q.tail === 'bushy' ? q.body : q.dark;
  ctx.lineWidth = Math.max(2, s * (q.tail === 'bushy' ? 0.12 : 0.05));
  const tw = Math.sin(p.t * 6 + p.seed) * s * 0.06;
  if (q.tail !== 'stub') {
    ctx.beginPath();
    ctx.moveTo(x - f * L * 0.45, by - H * 0.05 + crouch);
    ctx.quadraticCurveTo(x - f * L * 0.7, by - H * 0.05 + tw, x - f * L * 0.75, by + H * 0.25 + tw);
    ctx.stroke();
    if (q.tail === 'tuft') ellipse(ctx, x - f * L * 0.75, by + H * 0.27 + tw, s * 0.07, s * 0.08, q.dark);
  }
  // body
  ellipse(ctx, x, by + crouch, L * 0.5, H * 0.32, q.body);
  ellipse(ctx, x + f * L * 0.05, by + H * 0.14 + crouch, L * 0.36, H * 0.14, q.belly);
  if (q.spots) for (let i = 0; i < 6; i++) ellipse(ctx, x + (hash(p.seed + i) - 0.5) * L * 0.75, by - H * 0.1 + (hash(p.seed * 3 + i) - 0.5) * H * 0.3 + crouch, s * 0.04, s * 0.035, q.spots);
  // head
  const hx = x + f * L * 0.5, hy = by - H * 0.22 + crouch + (p.doze > 0.5 ? H * 0.2 : 0);
  if (q.mane) ellipse(ctx, hx - f * s * 0.05, hy, q.head * s * 1.45, q.head * s * 1.35, q.mane);
  ellipse(ctx, hx, hy, q.head * s, q.head * s * 0.9, q.body);
  ellipse(ctx, hx + f * q.head * s * 0.75, hy + q.head * s * 0.25, q.head * s * 0.48, q.head * s * 0.36, q.belly);
  ellipse(ctx, hx + f * q.head * s * 1.08, hy + q.head * s * 0.18, s * 0.035, s * 0.03, '#1a120c');
  // ears
  ctx.fillStyle = q.body;
  for (const ex of [-0.35, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(hx + ex * q.head * s * f - s * 0.04, hy - q.head * s * 0.6);
    ctx.lineTo(hx + ex * q.head * s * f, hy - q.head * s * 0.6 - q.ear * s);
    ctx.lineTo(hx + ex * q.head * s * f + s * 0.05, hy - q.head * s * 0.55);
    ctx.fill();
    if (q.tufts) {
      ctx.strokeStyle = '#1a120c';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx + ex * q.head * s * f, hy - q.head * s * 0.6 - q.ear * s);
      ctx.lineTo(hx + ex * q.head * s * f, hy - q.head * s * 0.6 - q.ear * s - s * 0.07);
      ctx.stroke();
    }
  }
  // the eye: round and a little comic (closed when dozing)
  const eyeX = hx + f * q.head * s * 0.3, eyeY = hy - q.head * s * 0.15;
  if (p.doze > 0.5) {
    ctx.strokeStyle = '#1a120c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, s * 0.04, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ellipse(ctx, eyeX, eyeY, s * 0.055, s * 0.06, '#fffaf0');
    ellipse(ctx, eyeX + f * s * 0.015, eyeY + (p.flee > 0 ? -s * 0.02 : 0), s * 0.028, s * 0.034, '#1a120c');
  }
  if (q.tusks) {
    ctx.strokeStyle = '#f2ead8';
    ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.beginPath();
    ctx.arc(hx + f * q.head * s * 0.85, hy + q.head * s * 0.15, s * 0.08, f > 0 ? Math.PI * 1.2 : -0.2, f > 0 ? Math.PI * 1.9 : Math.PI * 0.6, f < 0);
    ctx.stroke();
  }
  if (q.horns) {
    ctx.strokeStyle = '#efe4c8';
    ctx.lineWidth = Math.max(2, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.05, hy - q.head * s * 0.55);
    ctx.quadraticCurveTo(hx - f * s * 0.3, hy - q.head * s * 1.4, hx + f * s * 0.05, hy - q.head * s * 1.6);
    ctx.moveTo(hx + f * s * 0.08, hy - q.head * s * 0.55);
    ctx.quadraticCurveTo(hx + f * s * 0.35, hy - q.head * s * 1.3, hx + f * s * 0.3, hy - q.head * s * 1.6);
    ctx.stroke();
  }
  if (p.hit > 0) {
    ctx.globalAlpha *= 0.5;
    ellipse(ctx, x, by, L * 0.55, H * 0.4, '#ffffff');
  }
}

function paintViper(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: BeastPose): void {
  const f = p.flip >= 0 ? 1 : -1;
  shadow(ctx, x, y, s * 0.45, 0.15);
  ctx.strokeStyle = '#8c7a4e';
  ctx.lineWidth = Math.max(3, s * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    const px = x - f * s * 0.5 + f * k * s * 0.85, py = y - s * 0.08 + Math.sin(k * 9 + p.t * (p.moving ? 9 : 2)) * s * 0.08;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.stroke();
  ctx.strokeStyle = '#4a3a22';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.setLineDash([s * 0.06, s * 0.08]);
  ctx.stroke();
  ctx.setLineDash([]);
  const hx = x + f * s * 0.38, hy = y - s * (0.1 + (p.tele > 0 ? 0.25 : 0.05));
  ellipse(ctx, hx, hy, s * 0.13, s * 0.09, '#9a8656');
  ellipse(ctx, hx + f * s * 0.03, hy - s * 0.02, s * 0.03, s * 0.035, p.doze > 0.5 ? '#4a3a22' : '#f2d36a');
  if (p.tele > 0 || p.moving) {
    ctx.strokeStyle = '#c0453a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + f * s * 0.12, hy + s * 0.02);
    ctx.lineTo(hx + f * s * 0.2, hy + s * 0.04);
    ctx.stroke();
  }
}

function paintScorpion(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: BeastPose): void {
  const f = p.flip >= 0 ? 1 : -1;
  shadow(ctx, x, y, s * 0.45, 0.2);
  ctx.strokeStyle = '#7a5a2e';
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  for (let i = 0; i < 4; i++) {
    const lx = x + (i - 1.5) * s * 0.12, sw = Math.sin(p.step + i) * (p.moving ? s * 0.04 : 0);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(lx, y - s * 0.12);
      ctx.lineTo(lx + sw, y - s * 0.12 + side * s * 0.14);
      ctx.stroke();
    }
  }
  ellipse(ctx, x, y - s * 0.15, s * 0.28, s * 0.14, '#b48a4a');
  // the tail, curled over the back
  ctx.strokeStyle = '#b48a4a';
  ctx.lineWidth = Math.max(2, s * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - f * s * 0.25, y - s * 0.15);
  ctx.quadraticCurveTo(x - f * s * 0.55, y - s * 0.6, x - f * s * 0.1, y - s * (0.62 + (p.tele > 0 ? 0.1 : 0)));
  ctx.stroke();
  ellipse(ctx, x - f * s * 0.06, y - s * 0.6, s * 0.06, s * 0.05, '#5a3e1a');
  // claws
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + f * s * 0.25, y - s * 0.15);
    ctx.lineTo(x + f * s * 0.42, y - s * 0.15 + side * s * 0.1);
    ctx.stroke();
    ellipse(ctx, x + f * s * 0.47, y - s * 0.15 + side * s * 0.11, s * 0.07, s * 0.05, '#c49a5a');
  }
  ellipse(ctx, x + f * s * 0.2, y - s * 0.2, s * 0.025, s * 0.03, '#1a120c');
}

function paintVulture(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: BeastPose): void {
  const f = p.flip >= 0 ? 1 : -1;
  shadow(ctx, x, y, s * 0.5, 0.15);
  const by = y - s * (0.4 + p.air);
  const flap = Math.sin(p.t * (p.tele > 0 ? 4 : 8) + p.seed) * s * 0.25;
  ctx.fillStyle = '#5b4a3e';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, by);
    ctx.quadraticCurveTo(x + side * s * 0.45, by - s * 0.15 - flap, x + side * s * 0.85, by - flap * 0.6);
    ctx.quadraticCurveTo(x + side * s * 0.45, by + s * 0.05, x, by + s * 0.1);
    ctx.fill();
  }
  ellipse(ctx, x, by, s * 0.2, s * 0.15, '#6a5646');
  ellipse(ctx, x + f * s * 0.05, by - s * 0.05, s * 0.18, s * 0.06, '#efe4d0');
  ellipse(ctx, x + f * s * 0.22, by - s * 0.12, s * 0.08, s * 0.07, '#e8a99a');
  ctx.fillStyle = '#e8c27a';
  ctx.beginPath();
  ctx.moveTo(x + f * s * 0.29, by - s * 0.12);
  ctx.lineTo(x + f * s * 0.38, by - s * 0.08);
  ctx.lineTo(x + f * s * 0.28, by - s * 0.07);
  ctx.fill();
  ellipse(ctx, x + f * s * 0.24, by - s * 0.14, s * 0.02, s * 0.022, '#1a120c');
}

function paintHornet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: BeastPose): void {
  const by = y - s * (0.6 + Math.sin(p.t * 13 + p.seed) * 0.08);
  shadow(ctx, x, y, s * 0.12, 0.12);
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ellipse(ctx, x - s * 0.06, by - s * 0.08, s * 0.1, s * 0.05, '#ffffff');
  ellipse(ctx, x + s * 0.06, by - s * 0.08, s * 0.1, s * 0.05, '#ffffff');
  ctx.restore();
  ellipse(ctx, x, by, s * 0.14, s * 0.08, '#e3a92c');
  ctx.fillStyle = '#2a1d10';
  ctx.fillRect(x - s * 0.04, by - s * 0.08, s * 0.03, s * 0.16);
  ctx.fillRect(x + s * 0.03, by - s * 0.08, s * 0.03, s * 0.16);
  ellipse(ctx, x + (p.flip >= 0 ? 1 : -1) * s * 0.13, by, s * 0.05, s * 0.05, '#2a1d10');
}

/** Goliath (and the giants of Gath): a giant in bronze scale armour with a spear like a weaver's beam; falls flat on his face. */
export function paintGiant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: { flip: number; step: number; moving: number; act: number; hit: number; fall: number; t: number; daze: number; hue: number }): void {
  const f = p.flip >= 0 ? 1 : -1;
  const k = s * 2.3;
  ctx.save();
  if (p.fall > 0) {
    ctx.translate(x, y);
    ctx.rotate(f * Math.PI * 0.5 * Math.min(1, p.fall));
    ctx.translate(-x, -y);
  }
  shadow(ctx, x, y, k * 0.32, 0.3);
  const armour = p.hue ? '#9a8a6a' : '#b8863b', dark = p.hue ? '#6a5a40' : '#7a5420';
  const hipY = y - k * 0.5;
  const sw = Math.sin(p.step) * p.moving * k * 0.08;
  ctx.strokeStyle = C.skinDark;
  ctx.lineWidth = Math.max(3, k * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - k * 0.08, hipY);
  ctx.lineTo(x - k * 0.1 + sw, y - k * 0.03);
  ctx.moveTo(x + k * 0.08, hipY);
  ctx.lineTo(x + k * 0.1 - sw, y - k * 0.03);
  ctx.stroke();
  ctx.fillStyle = armour;
  ctx.fillRect(x - k * 0.13 + sw, y - k * 0.22, k * 0.08, k * 0.17);
  ctx.fillRect(x + k * 0.05 - sw, y - k * 0.22, k * 0.08, k * 0.17);
  // scale armour
  ctx.fillStyle = armour;
  ctx.beginPath();
  ctx.moveTo(x - k * 0.2, hipY - k * 0.42);
  ctx.lineTo(x - k * 0.23, hipY + k * 0.08);
  ctx.lineTo(x + k * 0.23, hipY + k * 0.08);
  ctx.lineTo(x + k * 0.2, hipY - k * 0.42);
  ctx.fill();
  ctx.fillStyle = dark;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) ellipse(ctx, x - k * 0.15 + c * k * 0.1 + (r % 2) * k * 0.05, hipY - k * 0.36 + r * k * 0.09, k * 0.035, k * 0.025, dark);
  // arms and the spear
  const armY = hipY - k * 0.35;
  ctx.strokeStyle = C.skinDark;
  ctx.lineWidth = Math.max(3, k * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - f * k * 0.2, armY);
  ctx.lineTo(x - f * k * 0.26, armY + k * 0.3);
  ctx.moveTo(x + f * k * 0.2, armY);
  ctx.lineTo(x + f * k * (0.3 + p.act * 0.15), armY + k * (0.15 - p.act * 0.2));
  ctx.stroke();
  const hx = x + f * k * (0.3 + p.act * 0.15), hy = armY + k * (0.15 - p.act * 0.2);
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = Math.max(4, k * 0.06);
  ctx.beginPath();
  ctx.moveTo(hx - f * k * 0.1, hy + k * 0.45);
  ctx.lineTo(hx + f * k * 0.12, hy - k * 0.75);
  ctx.stroke();
  ctx.fillStyle = '#c9d1dc';
  ctx.beginPath();
  ctx.moveTo(hx + f * k * 0.15, hy - k * 0.95);
  ctx.lineTo(hx + f * k * 0.08, hy - k * 0.72);
  ctx.lineTo(hx + f * k * 0.17, hy - k * 0.74);
  ctx.fill();
  // the head and the bronze helmet
  const headY = hipY - k * 0.58;
  ellipse(ctx, x, headY, k * 0.13, k * 0.14, C.skinDark);
  ctx.fillStyle = '#3a2a1c';
  ctx.beginPath();
  ctx.ellipse(x + f * k * 0.02, headY + k * 0.08, k * 0.11, k * 0.1, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = armour;
  ctx.beginPath();
  ctx.ellipse(x, headY - k * 0.05, k * 0.15, k * 0.13, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - k * 0.15, headY - k * 0.06, k * 0.3, k * 0.04);
  ellipse(ctx, x, headY - k * 0.18, k * 0.03, k * 0.06, dark);
  // eyes: a scowl (dizzy stars when he reels)
  ctx.strokeStyle = '#1a120c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + f * k * 0.03, headY - k * 0.02);
  ctx.lineTo(x + f * k * 0.09, headY);
  ctx.stroke();
  ellipse(ctx, x + f * k * 0.07, headY + k * 0.02, k * 0.015, k * 0.02, '#1a120c');
  if (p.hit > 0) {
    ctx.globalAlpha = 0.45;
    ellipse(ctx, x, hipY - k * 0.2, k * 0.3, k * 0.5, '#ffffff');
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  if (p.daze > 0 && p.fall <= 0) {
    ctx.fillStyle = C.goldLight;
    ctx.font = font(800, s * 0.4, SANS);
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const a = p.t * 4 + (i * TAU) / 3;
      ctx.fillText('★', x + Math.cos(a) * k * 0.22, headY_of(y, k) - k * 0.25 + Math.sin(a) * k * 0.05);
    }
  }
}

const headY_of = (y: number, k: number): number => y - k * 0.5 - k * 0.58;

/** The shield-bearer: a small man behind a big round shield, walking in front of the giant. */
export function paintBearer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flip: number, t: number, stumble: number): void {
  const f = flip >= 0 ? 1 : -1;
  paintPerson(ctx, x - f * s * 0.15, y, s, LOOKS.bearer, { flip, step: t * 8, walking: 0.5, sit: 0, act: 0, hit: 0, t, down: stumble > 0 ? 0.3 : 0 });
  const sx = x + f * s * 0.2, sy = y - s * 0.7;
  ctx.save();
  if (stumble > 0) {
    ctx.translate(sx, sy);
    ctx.rotate(f * 0.5);
    ctx.translate(-sx, -sy);
  }
  shadow(ctx, sx, y, s * 0.4, 0.2);
  ellipse(ctx, sx, sy, s * 0.42, s * 0.62, '#7a5a34');
  ellipse(ctx, sx, sy, s * 0.36, s * 0.55, '#a8804a');
  ctx.strokeStyle = '#6a4a24';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(sx, sy, s * 0.24, s * 0.38, 0, 0, TAU);
  ctx.stroke();
  ellipse(ctx, sx, sy, s * 0.08, s * 0.1, '#d8b36a');
  ctx.restore();
}

// ── things on the ground ─────────────────────────────────────────
export function paintCoin(ctx: CanvasRenderingContext2D, kind: 'silver' | 'wood' | 'stone', x: number, y: number, s: number, t: number, seed: number): void {
  if (kind === 'wood') {
    ctx.strokeStyle = '#8a6238';
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.18, y - s * (0.05 + i * 0.05));
      ctx.lineTo(x + s * 0.18, y - s * (0.1 + i * 0.03));
      ctx.stroke();
    }
    return;
  }
  if (kind === 'stone') {
    ellipse(ctx, x, y - s * 0.06, s * 0.14, s * 0.1, '#cfc6b2');
    ellipse(ctx, x - s * 0.04, y - s * 0.09, s * 0.06, s * 0.04, '#ece6d8');
    return;
  }
  const spin = Math.abs(Math.cos(t * 5 + seed));
  ellipse(ctx, x, y + s * 0.02, s * 0.13, s * 0.05, 'rgba(40,28,14,.2)');
  ellipse(ctx, x, y - s * 0.08, s * 0.12 * (0.35 + 0.65 * spin), s * 0.12, C.silverDeep);
  ellipse(ctx, x, y - s * 0.08, s * 0.09 * (0.35 + 0.65 * spin), s * 0.09, C.silver);
  if (spin > 0.85) ellipse(ctx, x - s * 0.03, y - s * 0.12, s * 0.025, s * 0.025, '#ffffff');
}

export function paintHeap(ctx: CanvasRenderingContext2D, kind: 'wood' | 'stone', x: number, y: number, s: number, ready: boolean): void {
  ctx.globalAlpha = ready ? 1 : 0.35;
  shadow(ctx, x, y, s * 0.5, 0.2);
  if (kind === 'wood') {
    ctx.strokeStyle = '#7a5530';
    ctx.lineWidth = Math.max(2, s * 0.08);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4 + i * s * 0.05, y - s * 0.05 - i * s * 0.06);
      ctx.lineTo(x + s * 0.4 - i * s * 0.04, y - s * 0.1 - i * s * 0.05);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 5; i++) ellipse(ctx, x + (i - 2) * s * 0.16, y - s * (0.08 + (i % 2) * 0.12), s * 0.16, s * 0.12, i % 2 ? '#d2c9b5' : '#b9ad95');
  }
  ctx.globalAlpha = 1;
}

export function paintChest(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kind: 'land' | 'reward' | 'gift' | 'guard' | 'floor', t: number): void {
  const bob = Math.sin(t * 3) * s * 0.04;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - s * 0.3, s * 1.1, kind === 'gift' ? 'rgba(255,200,170,' : 'rgba(220,235,255,', 0.25 + 0.1 * Math.sin(t * 4));
  ctx.restore();
  shadow(ctx, x, y, s * 0.45, 0.25);
  if (kind === 'gift') {
    // Jesse's bundle: a cloth tied at the top
    ellipse(ctx, x, y - s * 0.28 + bob, s * 0.36, s * 0.3, '#c9563a');
    ellipse(ctx, x, y - s * 0.5 + bob, s * 0.1, s * 0.08, '#e8c27a');
    ctx.fillStyle = '#f2e3b8';
    for (let i = 0; i < 4; i++) ellipse(ctx, x + (i - 1.5) * s * 0.14, y - s * 0.28 + bob, s * 0.03, s * 0.03, '#f2e3b8');
    return;
  }
  const big = kind === 'guard' || kind === 'floor' ? 1.25 : 1;
  const w = s * 0.7 * big, hh = s * 0.42 * big;
  ctx.fillStyle = kind === 'reward' ? '#8a5a8a' : '#8a5a2e';
  ctx.fillRect(x - w / 2, y - hh + bob, w, hh);
  ctx.fillStyle = kind === 'reward' ? '#a46aa4' : '#a8703a';
  ctx.beginPath();
  ctx.ellipse(x, y - hh + bob, w / 2, hh * 0.45, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = C.silverDeep;
  ctx.fillRect(x - w / 2, y - hh * 0.7 + bob, w, hh * 0.1);
  ctx.fillStyle = C.silver;
  ctx.fillRect(x - s * 0.06, y - hh * 0.85 + bob, s * 0.12, s * 0.14);
}

/** The golden jackal with the stolen cheese wheel. */
export function paintThief(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flip: number, t: number, hit: number): void {
  paintBeast(ctx, 'szakal', x, y, s, { flip, step: t * 16, moving: 1, hit, doze: 0, t, air: 0, tele: 0, flee: 0, seed: 7, hidden: false });
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - s * 0.4, s * 0.9, 'rgba(255,215,120,', 0.35);
  ctx.restore();
  const f = flip >= 0 ? 1 : -1;
  ellipse(ctx, x + f * s * 0.48, y - s * 0.22, s * 0.15, s * 0.1, '#f2d27a');
  ellipse(ctx, x + f * s * 0.48, y - s * 0.25, s * 0.15, s * 0.05, '#ffe7a3');
}

/** A companion's little portrait for the party's row (a face in a circle). */
export function paintPortrait(ctx: CanvasRenderingContext2D, id: CompanionId, x: number, y: number, r: number): void {
  const L = LOOKS[id];
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = L.tunic;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  paintPerson(ctx, x, y + r * 1.95, r * 1.05, { ...L, size: 1, item: 'none' }, { flip: 1, step: 0, walking: 0, sit: 0, act: 0, hit: 0, t: 0 });
  ctx.restore();
}

/** The cave of Adullam's arena: a dark floor, rough walls, torches, the mouth at the top. */
export function paintCave(ctx: CanvasRenderingContext2D, P: (x: number, y: number) => { x: number; y: number }, s: number, w: number, h: number, cw: number, ch: number, t: number): void {
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(0, 0, w, h);
  const o = P(0, 0), e = P(cw, ch);
  const g = ctx.createRadialGradient((o.x + e.x) / 2, (o.y + e.y) / 2, s, (o.x + e.x) / 2, (o.y + e.y) / 2, Math.max(e.x - o.x, e.y - o.y) * 0.7);
  g.addColorStop(0, '#5a4a3a');
  g.addColorStop(1, '#2e241c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse((o.x + e.x) / 2, (o.y + e.y) / 2, (e.x - o.x) / 2, (e.y - o.y) / 2, 0, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU, rx = (e.x - o.x) / 2, ry = (e.y - o.y) / 2;
    ellipse(ctx, (o.x + e.x) / 2 + Math.cos(a) * rx, (o.y + e.y) / 2 + Math.sin(a) * ry, s * (0.7 + hash(i) * 0.6), s * (0.5 + hash(i + 3) * 0.4), i % 2 ? '#3a2e24' : '#4a3c30');
  }
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i * Math.PI) / 2, rx = (e.x - o.x) / 2 * 0.86, ry = (e.y - o.y) / 2 * 0.82;
    const tx = (o.x + e.x) / 2 + Math.cos(a) * rx, ty = (o.y + e.y) / 2 + Math.sin(a) * ry;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, tx, ty - s * 0.5, s * 3, 'rgba(255,160,70,', 0.25 + 0.06 * Math.sin(t * 7 + i));
    ctx.restore();
    paintFire(ctx, tx, ty, s * 0.6, t + i);
  }
  const m = P(cw / 2, 0.6);
  ctx.fillStyle = '#0c0907';
  ctx.beginPath();
  ctx.ellipse(m.x, m.y, s * 1.3, s * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, m.x, m.y, s * 1.6, 'rgba(255,235,190,', 0.18);
  ctx.restore();
}
