/**
 * Pasterz's painter: the palette of the Judean hills in early spring (olive and sage grass, dry
 * limestone, red anemones, a cold blue stream), seen from above in a soft three-quarter light from
 * the upper left, and the sprites — the wool-blob sheep, the shepherd (the parable's man: a striped
 * mantle, a headcloth with its cord, a staff with a crook; no halo, no white robe), rocks, thorn
 * bushes, dry-stone terrace walls, the fold, the night's fire.  All in canvas paths, no images;
 * sizes in metres times `s` (px per metre).
 */

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  grass: '#a9b56a', grassDark: '#8f9d55', grassLight: '#c2c77f', dry: '#d7c48c', lush: '#93ab58',
  ink: '#3a2f25', paper: '#f6efdc', paperEdge: '#d9c9a3', gold: '#f2b632', goldDeep: '#c98a12', cream: '#fff6dc',
  wool: '#f5eedf', woolShade: '#dccfb5', face: '#3b302a', ear: '#6e5c50',
  robe: '#8b5a36', robeDark: '#6a4128', mantle: '#c9b48a', stripe: '#5a4a7a', cloth: '#ece2c8', cord: '#3c4b78', skin: '#b98761',
  staff: '#6e4a28', rock: '#cdbf9f', rockLight: '#e6dcc2', rockDark: '#a4937a', bush: '#56603a', bushLight: '#7b8749', thorn: '#8a3b22',
  water: '#6e9fb0', waterLight: '#a8d0d6', bank: '#7d8f4f', stone: '#d9cfb6', earth: '#cdb58c',
  night: '#16203c', star: '#fff3c4', fire: '#ffb347', blue: '#7fa7d9', grey: '#b8b2a6',
};

export type RGB = [number, number, number];
export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb = (c: RGB, a = 1): string => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** A soft drop shadow on the grass (the light comes from the upper left). */
function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.22): void {
  ctx.fillStyle = `rgba(52,48,22,${a})`;
  ctx.beginPath();
  ctx.ellipse(x + rx * 0.18, y + ry * 0.3, rx, ry, 0, 0, TAU);
  ctx.fill();
}

// ── sheep ─────────────────────────────────────────────────────────
export interface SheepPose {
  /** a lamb: smaller */
  small: boolean;
  /** the walk's phase (the wool bobs) and how fast (0..1) */
  bob: number;
  walking: number;
  /** lying down 0..1; looking up 0..1; grazing (head down) 0..1 */
  lie: number;
  look: number;
  graze: number;
  /** the bell's colour of a named lamb */
  bell?: string;
  /** dim (a sheep far in the dark) */
  alpha?: number;
  /** the flock's dye over the wool (none: undyed, loose) */
  dye?: string;
}

/** A sheep from above: a cloud of wool, a dark face with ears in front, facing `dir`. */
export function paintSheep(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, p: SheepPose): void {
  const k = (p.small ? 0.68 : 1) * s;
  const bob = Math.sin(p.bob * Math.PI) * p.walking;
  const lift = Math.abs(bob) * 0.05 * k;
  const len = 0.52 * k * (1 + p.lie * 0.08), wid = 0.38 * k * (1 + p.lie * 0.22);
  ctx.save();
  if (p.alpha !== undefined) ctx.globalAlpha = p.alpha;
  shadow(ctx, x, y, len * 1.02, wid * 0.95, 0.2 + 0.08 * (1 - p.lie));
  ctx.translate(x, y - lift);
  ctx.rotate(dir);
  // the head: in front, lower when grazing, raised when looking up, tucked when lying
  const hx = len * (0.92 - p.graze * 0.08 - p.lie * 0.35 + p.look * 0.06);
  const hy = p.lie * wid * 0.55;
  const hs = k * (0.15 + p.look * 0.025 - p.graze * 0.015);
  ctx.fillStyle = C.ear;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx - hs * 0.35, hy + side * hs * 1.15, hs * 0.55, hs * 0.28, side * (0.5 + p.look * 0.4), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.face;
  ctx.beginPath();
  ctx.ellipse(hx, hy, hs * 1.15, hs * 0.85, 0, 0, TAU);
  ctx.fill();
  if (p.look > 0.2) {
    ctx.fillStyle = `rgba(255,250,235,${p.look})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(hx + hs * 0.35, hy + side * hs * 0.38, Math.max(0.8, hs * 0.16), 0, TAU);
      ctx.fill();
    }
  }
  // the wool: a ring of puffs over a core, shaded away from the light
  const puffs = 8;
  const sq = 1 + bob * 0.04;
  const wool = p.dye ? rgb(mix(hex(C.wool), hex(p.dye), 0.62)) : C.wool;
  const shade = p.dye ? rgb(mix(hex(C.woolShade), hex(p.dye), 0.75)) : C.woolShade;
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(len * 0.04, wid * 0.08, len * sq, wid, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = wool;
  for (let i = 0; i < puffs; i++) {
    const a = (i / puffs) * TAU;
    const px = Math.cos(a) * len * 0.62 * sq, py = Math.sin(a) * wid * 0.6;
    ctx.beginPath();
    ctx.arc(px - len * 0.05, py - wid * 0.05, wid * 0.46, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-len * 0.06, -wid * 0.08, len * 0.68 * sq, wid * 0.68, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-len * 0.22, -wid * 0.25, len * 0.3, wid * 0.24, 0, 0, TAU);
  ctx.fill();
  if (p.bell) {
    ctx.fillStyle = p.bell;
    ctx.strokeStyle = 'rgba(40,30,20,.55)';
    ctx.lineWidth = Math.max(0.8, k * 0.02);
    ctx.beginPath();
    ctx.arc(len * 0.66, hy, Math.max(1.6, k * 0.07), 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ── the shepherd ──────────────────────────────────────────────────
/**
 * The shepherd from above: a man in a brown tunic under a striped mantle, a cream headcloth held by
 * a dark cord, a staff with a crook in his right hand; carrying the lost lamb across his shoulders.
 */
export interface ShepherdLook { mantle: string; stripe: string; staff: string; tip: string; cloth: string; cord: string }
export const PLAIN: ShepherdLook = { mantle: '#c9b48a', stripe: '#5a4a7a', staff: '#6e4a28', tip: '#6e4a28', cloth: '#ece2c8', cord: '#3c4b78' };

export function paintShepherd(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, stepT: number, walking: number, carrying: boolean, look: ShepherdLook = PLAIN): void {
  const sway = Math.sin(stepT * 5.1) * 0.09 * walking;
  shadow(ctx, x, y, 0.42 * s, 0.32 * s, 0.26);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  // feet, stepping
  ctx.fillStyle = '#4a3423';
  for (const side of [-1, 1]) {
    const f = Math.sin(stepT * 5.1 + (side > 0 ? 0 : Math.PI)) * 0.16 * walking;
    ctx.beginPath();
    ctx.ellipse((0.06 + f) * s, side * 0.12 * s, 0.1 * s, 0.05 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.rotate(sway);
  // the tunic's hem and the mantle over the shoulders (stripes run along it)
  ctx.fillStyle = C.robeDark;
  ctx.strokeStyle = 'rgba(40,26,16,.55)';
  ctx.lineWidth = Math.max(1, 0.025 * s);
  ctx.beginPath();
  ctx.ellipse(-0.03 * s, 0, 0.27 * s, 0.33 * s, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = C.robe;
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.24 * s, 0.31 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = look.mantle;
  ctx.beginPath();
  ctx.ellipse(-0.05 * s, 0, 0.17 * s, 0.32 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = look.stripe;
  ctx.lineWidth = Math.max(1, 0.025 * s);
  for (const off of [-0.16, 0.16]) {
    ctx.beginPath();
    ctx.ellipse(-0.05 * s, 0, 0.17 * s, Math.abs(off) * s * 1.9, 0, -1.2, 1.2);
    ctx.stroke();
  }
  // arms and hands
  ctx.fillStyle = C.robe;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0.1 * s, side * 0.27 * s, 0.11 * s, 0.07 * s, side * 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.skin;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(0.2 * s, side * 0.3 * s, 0.045 * s, 0, TAU);
    ctx.fill();
  }
  // the staff in the right hand, its crook forward
  ctx.strokeStyle = look.staff;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.6, 0.045 * s);
  ctx.beginPath();
  ctx.moveTo(-0.25 * s, 0.36 * s);
  ctx.lineTo(0.62 * s, 0.3 * s);
  ctx.stroke();
  ctx.strokeStyle = look.tip;
  ctx.beginPath();
  ctx.moveTo(0.62 * s, 0.3 * s);
  ctx.arc(0.62 * s, 0.22 * s, 0.08 * s, Math.PI / 2, -Math.PI / 2, true);
  ctx.stroke();
  // the lamb on the shoulders
  if (carrying) {
    ctx.fillStyle = C.woolShade;
    ctx.beginPath();
    ctx.ellipse(-0.08 * s, 0, 0.17 * s, 0.38 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.wool;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(-0.1 * s, i * 0.12 * s, 0.11 * s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = C.face;
    ctx.beginPath();
    ctx.ellipse(0.02 * s, -0.4 * s, 0.07 * s, 0.09 * s, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.ear;
    ctx.beginPath();
    ctx.ellipse(-0.07 * s, -0.43 * s, 0.05 * s, 0.025 * s, 0.6, 0, TAU);
    ctx.fill();
  }
  // the head in its headcloth, the cord around it, the cloth falling back over the neck
  ctx.fillStyle = look.cloth;
  ctx.beginPath();
  ctx.moveTo(0.02 * s, -0.13 * s);
  ctx.lineTo(-0.2 * s, -0.16 * s);
  ctx.lineTo(-0.2 * s, 0.16 * s);
  ctx.lineTo(0.02 * s, 0.13 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0.02 * s, 0, 0.14 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,100,70,.35)';
  ctx.lineWidth = Math.max(0.8, 0.015 * s);
  ctx.beginPath();
  ctx.moveTo(-0.18 * s, -0.08 * s);
  ctx.lineTo(-0.02 * s, -0.06 * s);
  ctx.moveTo(-0.18 * s, 0.08 * s);
  ctx.lineTo(-0.02 * s, 0.06 * s);
  ctx.stroke();
  ctx.strokeStyle = look.cord;
  ctx.lineWidth = Math.max(1.2, 0.03 * s);
  ctx.beginPath();
  ctx.arc(0.02 * s, 0, 0.1 * s, 0, TAU);
  ctx.stroke();
  // a glimpse of the face and the beard at the front of the cloth
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.ellipse(0.13 * s, 0, 0.035 * s, 0.07 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── the hill's things ─────────────────────────────────────────────
export function paintRock(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, s: number): void {
  const R = r * s, n = 9;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i) * 0.4;
    const q = R * (0.82 + hash(seed * 3 + i) * 0.28);
    pts.push([x + Math.cos(a) * q, y + Math.sin(a) * q * 0.86]);
  }
  shadow(ctx, x + R * 0.12, y + R * 0.1, R * 1.05, R * 0.8, 0.28);
  const path = () => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
  };
  ctx.fillStyle = C.rockDark;
  path();
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = C.rock;
  ctx.beginPath();
  ctx.ellipse(x - R * 0.12, y - R * 0.14, R * 0.86, R * 0.74, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.rockLight;
  ctx.beginPath();
  ctx.ellipse(x - R * 0.3, y - R * 0.34, R * 0.45, R * 0.3, -0.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,104,80,.45)';
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x - R * 0.2 + hash(seed) * R * 0.3, y - R * 0.6);
  ctx.lineTo(x + R * 0.05, y + R * 0.1);
  ctx.lineTo(x + R * 0.4, y + R * 0.3);
  ctx.stroke();
  ctx.restore();
}

export function paintBush(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, s: number, t: number): void {
  const R = r * s;
  shadow(ctx, x + R * 0.1, y + R * 0.15, R * 1.05, R * 0.85, 0.3);
  const n = 7;
  ctx.fillStyle = C.bush;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.5, R * (0.42 + hash(seed + 9 * i) * 0.12), 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, R * 0.6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.bushLight;
  const sway = Math.sin(t * 1.3 + seed) * 0.03 * R;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + hash(seed * 7 + i) * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.35 - R * 0.15 + sway, y + Math.sin(a) * R * 0.3 - R * 0.18, R * 0.22, 0, TAU);
    ctx.fill();
  }
  // thorns: short dark spikes around the rim, and a few red-brown haws
  ctx.strokeStyle = 'rgba(40,36,18,.75)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + hash(seed + 40 + i) * 0.3;
    const r0 = R * 0.9, r1 = R * (1.08 + hash(seed + 60 + i) * 0.1);
    ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0 * 0.92);
    ctx.lineTo(x + Math.cos(a + 0.12) * r1, y + Math.sin(a + 0.12) * r1 * 0.92);
  }
  ctx.stroke();
  ctx.fillStyle = C.thorn;
  for (let i = 0; i < 5; i++) {
    const a = hash(seed + 80 + i) * TAU, q = R * (0.2 + hash(seed + 90 + i) * 0.5);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * q, y + Math.sin(a) * q, Math.max(1.2, s * 0.045), 0, TAU);
    ctx.fill();
  }
}

/** The fold: a ring of dry stone with a gate facing `gate` (rad), packed earth inside. */
export function paintFold(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, gate: number, appear: number): void {
  const R = 3 * s * (0.6 + 0.4 * appear);
  ctx.save();
  ctx.globalAlpha = Math.min(1, appear * 1.5);
  ctx.fillStyle = 'rgba(205,181,140,.85)';
  ctx.beginPath();
  ctx.arc(x, y, R * 0.94, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,140,90,.25)';
  for (let i = 0; i < 9; i++) {
    const a = hash(i + 300) * TAU, q = R * 0.7 * Math.sqrt(hash(i + 400));
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * q, y + Math.sin(a) * q, R * 0.12, R * 0.06, a, 0, TAU);
    ctx.fill();
  }
  const gap = 0.42, n = 26;
  for (let i = 0; i < n; i++) {
    const a = gate + gap + (i / (n - 1)) * (TAU - 2 * gap);
    const h0 = hash(i + 700);
    const sx = x + Math.cos(a) * R, sy = y + Math.sin(a) * R;
    ctx.fillStyle = 'rgba(60,58,26,.25)';
    ctx.beginPath();
    ctx.ellipse(sx + s * 0.05, sy + s * 0.1, s * 0.27, s * 0.2, a, 0, TAU);
    ctx.fill();
    ctx.fillStyle = h0 < 0.4 ? C.rockDark : h0 < 0.75 ? C.rock : '#c3b494';
    ctx.beginPath();
    ctx.ellipse(sx, sy, s * 0.26, s * 0.2, a + Math.PI / 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,226,.35)';
    ctx.beginPath();
    ctx.ellipse(sx - s * 0.06, sy - s * 0.06, s * 0.12, s * 0.07, a + Math.PI / 2, 0, TAU);
    ctx.fill();
  }
  // the gateposts
  for (const side of [-1, 1]) {
    const a = gate + side * gap;
    paintRock(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R, 0.36, 900 + side, s);
  }
  ctx.restore();
}

/** The night's fire: a ring of stones, flames that flicker, and (drawn by the view) its glow. */
export function paintFire(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, k: number): void {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    ctx.fillStyle = i % 2 ? C.rockDark : C.rock;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 0.3 * s, y + Math.sin(a) * 0.26 * s, 0.1 * s, 0.08 * s, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#4a3020';
  ctx.beginPath();
  ctx.ellipse(x, y, 0.2 * s, 0.16 * s, 0, 0, TAU);
  ctx.fill();
  if (k <= 0.02) return;
  const flames: [number, string, number][] = [[1, '#e2572b', 0.34], [0.72, '#ffa43a', 0.26], [0.45, '#ffe28a', 0.17]];
  for (const [f, col, size] of flames) {
    const fl = 1 + Math.sin(t * 13 + f * 7) * 0.12 + Math.sin(t * 7.3 + f) * 0.08;
    const h = size * s * fl * k;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.55, y + h * 0.15);
    ctx.quadraticCurveTo(x - h * 0.45, y - h * 0.7, x + Math.sin(t * 9 + f) * h * 0.15, y - h * 1.3);
    ctx.quadraticCurveTo(x + h * 0.45, y - h * 0.7, x + h * 0.55, y + h * 0.15);
    ctx.closePath();
    ctx.fill();
  }
}

/** A star (four points and a soft glow). */
export function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a: number): void {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(255,240,190,.16)';
  ctx.beginPath();
  ctx.arc(x, y, r * 1.9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.star;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const q = i % 2 ? r * 0.32 : r;
    const ang = (i / 8) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** A named lamb's tile for the lobby: its face and its bell, or a soft silhouette not yet found. */
export function paintLambTile(ctx: CanvasRenderingContext2D, w: number, h: number, bell: string, found: boolean): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, found ? '#c9d48f' : '#d9d3c2');
  g.addColorStop(1, found ? '#9fb35f' : '#c4bca8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.52, s = Math.min(w, h) * 0.9;
  if (!found) {
    ctx.fillStyle = 'rgba(90,80,60,.25)';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      ctx.moveTo(cx + Math.cos(a) * s * 0.22 + s * 0.12, cy + Math.sin(a) * s * 0.18);
      ctx.arc(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.18, s * 0.12, 0, TAU);
    }
    ctx.fill();
    return;
  }
  // a front view: wool head, dark face, ears, the bell under the chin
  ctx.fillStyle = C.wool;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * s * 0.22, cy - s * 0.04 + Math.sin(a) * s * 0.16, s * 0.12, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.ear;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * s * 0.2, cy + s * 0.02, s * 0.1, s * 0.045, side * 0.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.face;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.06, s * 0.1, s * 0.13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + side * s * 0.045, cy + s * 0.03, Math.max(1, s * 0.018), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = bell;
  ctx.strokeStyle = 'rgba(40,30,20,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.24, s * 0.065, 0, TAU);
  ctx.fill();
  ctx.stroke();
}

// ── the contest's things ──────────────────────────────────────────
/** A pen of dry stone (radius r m) with its gate facing `gate`: the floor of trampled earth is in the ground; this draws the stones. */
export function paintPen(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gate: number, s: number, gapHalf: number): void {
  const R = r * s;
  const n = Math.max(18, Math.round(r * 7));
  for (let i = 0; i < n; i++) {
    const a = gate + gapHalf + (i / (n - 1)) * (TAU - 2 * gapHalf);
    const h0 = hash(i + Math.round(r * 100));
    const sx = x + Math.cos(a) * R, sy = y + Math.sin(a) * R;
    ctx.fillStyle = 'rgba(60,58,26,.25)';
    ctx.beginPath();
    ctx.ellipse(sx + s * 0.05, sy + s * 0.1, s * 0.27, s * 0.2, a, 0, TAU);
    ctx.fill();
    ctx.fillStyle = h0 < 0.4 ? C.rockDark : h0 < 0.75 ? C.rock : '#c3b494';
    ctx.beginPath();
    ctx.ellipse(sx, sy, s * 0.27, s * 0.21, a + Math.PI / 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,248,226,.35)';
    ctx.beginPath();
    ctx.ellipse(sx - s * 0.06, sy - s * 0.06, s * 0.12, s * 0.07, a + Math.PI / 2, 0, TAU);
    ctx.fill();
  }
  for (const side of [-1, 1]) {
    const a = gate + side * gapHalf;
    paintRock(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R, 0.34, 900 + side, s);
  }
}

/** An olive tree from above: a silvery canopy of clumps (drawn over the bodies, see-through near the shepherd). */
export function paintTree(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, s: number, t: number, alpha: number): void {
  const R = r * s;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(40,46,20,.28)';
  ctx.beginPath();
  ctx.ellipse(x + R * 0.25, y + R * 0.3, R * 1.02, R * 0.9, 0, 0, TAU);
  ctx.fill();
  const sway = Math.sin(t * 0.9 + seed) * R * 0.02;
  const n = 9;
  for (let pass = 0; pass < 2; pass++) {
    ctx.fillStyle = pass ? '#9aa877' : '#6f7d4b';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + hash(seed + i) * 0.6;
      const q = R * (0.45 + hash(seed + 20 + i) * 0.25) * (pass ? 0.8 : 1);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * q - (pass ? R * 0.12 : 0) + sway, y + Math.sin(a) * q - (pass ? R * 0.14 : 0), R * (pass ? 0.3 : 0.4), 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(214,224,190,.55)';
  for (let i = 0; i < 6; i++) {
    const a = hash(seed + 50 + i) * TAU, q = R * 0.55 * hash(seed + 60 + i);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * q - R * 0.2, y + Math.sin(a) * q - R * 0.25, R * 0.12, R * 0.05, a, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Łatek from above: a sheepdog with a wagging tail, his coat and patches from the wardrobe. */
export function paintDog(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number, run: number, t: number, coat: string, patch: string): void {
  shadow(ctx, x, y, 0.42 * s, 0.22 * s, 0.22);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dir);
  const k = s;
  // legs
  ctx.fillStyle = patch;
  const step = Math.sin(t * 18) * 0.08 * run;
  for (const [lx, ly, ph] of [[0.2, 0.12, 1], [0.2, -0.12, -1], [-0.22, 0.12, -1], [-0.22, -0.12, 1]] as const) {
    ctx.beginPath();
    ctx.ellipse((lx + step * ph) * k, ly * k, 0.07 * k, 0.04 * k, 0, 0, TAU);
    ctx.fill();
  }
  // tail
  const wag = Math.sin(t * (run > 0.2 ? 10 : 16)) * 0.6;
  ctx.strokeStyle = coat;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.09 * k;
  ctx.beginPath();
  ctx.moveTo(-0.3 * k, 0);
  ctx.quadraticCurveTo(-0.45 * k, wag * 0.1 * k, -0.55 * k, wag * 0.22 * k);
  ctx.stroke();
  // body
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(-0.02 * k, 0, 0.34 * k, 0.17 * k, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = patch;
  ctx.beginPath();
  ctx.ellipse(-0.08 * k, -0.04 * k, 0.15 * k, 0.11 * k, 0.4, 0, TAU);
  ctx.fill();
  // head and ears
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(0.34 * k, 0, 0.14 * k, 0.12 * k, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = patch;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(0.3 * k, side * 0.12 * k, 0.07 * k, 0.045 * k, side * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#1e1714';
  ctx.beginPath();
  ctx.arc(0.48 * k, 0, 0.035 * k, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A little gold crown, sitting at (x, y) (its base), `w` px wide. */
export function paintCrown(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, bob = 0): void {
  const h = w * 0.62, y0 = y + bob;
  ctx.save();
  ctx.fillStyle = C.goldDeep;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y0);
  ctx.lineTo(x - w / 2, y0 - h * 0.6);
  ctx.lineTo(x - w / 4, y0 - h * 0.25);
  ctx.lineTo(x, y0 - h);
  ctx.lineTo(x + w / 4, y0 - h * 0.25);
  ctx.lineTo(x + w / 2, y0 - h * 0.6);
  ctx.lineTo(x + w / 2, y0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 1.5, y0 - 1.5);
  ctx.lineTo(x - w / 2 + 1.5, y0 - h * 0.48);
  ctx.lineTo(x - w / 4, y0 - h * 0.12);
  ctx.lineTo(x, y0 - h * 0.85);
  ctx.lineTo(x + w / 4, y0 - h * 0.12);
  ctx.lineTo(x + w / 2 - 1.5, y0 - h * 0.48);
  ctx.lineTo(x + w / 2 - 1.5, y0 - 1.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  for (const dx of [-w / 2 + 1.5, 0, w / 2 - 1.5]) {
    ctx.beginPath();
    ctx.arc(x + dx, y0 - (dx === 0 ? h : h * 0.6), Math.max(1.2, w * 0.07), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A pill with a number (a flock's count over its shepherd, Crowd City style). */
export function paintCount(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, size: number): void {
  ctx.save();
  ctx.font = font(800, size, SANS);
  const w = Math.max(size * 1.6, ctx.measureText(text).width + size * 0.9), h = size * 1.35;
  ctx.fillStyle = 'rgba(40,30,20,.28)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 1, y - h / 2 + 2, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
}

/**
 * Sheep sprites, cached per dye, size and pose (standing, lying, a lamb) at the current scale, so
 * a few hundred sheep cost a drawImage each.  The sprite faces +x; the view rotates it.
 */
export class SheepSprites {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private scale = 0;
  private dpr = 1;

  /** a new scale (px per m) or pixel ratio clears the cache when it moved more than 8 % */
  setScale(s: number, dpr: number): void {
    if (Math.abs(s - this.scale) / Math.max(1, this.scale) > 0.08 || dpr !== this.dpr) {
      this.scale = s;
      this.dpr = dpr;
      this.cache.clear();
    }
  }

  get(dye: string | null, small: boolean, lie: boolean, look: boolean): { img: HTMLCanvasElement; half: number } {
    const key = `${dye}|${small ? 1 : 0}|${lie ? 1 : 0}|${look ? 1 : 0}`;
    const half = this.scale * 0.7;
    let img = this.cache.get(key);
    if (!img) {
      img = document.createElement('canvas');
      const px = Math.max(4, Math.ceil(half * 2 * this.dpr));
      img.width = img.height = px;
      const c = img.getContext('2d');
      if (c) {
        c.scale(this.dpr, this.dpr);
        paintSheep(c, half, half, this.scale, 0, { small, bob: 0, walking: 0, lie: lie ? 1 : 0, look: look ? 1 : 0, graze: 0, dye: dye ?? undefined });
      }
      this.cache.set(key, img);
    }
    return { img, half };
  }
}

export { shadow };
