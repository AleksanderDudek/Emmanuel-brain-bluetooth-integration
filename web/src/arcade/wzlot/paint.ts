/**
 * Wzlot's drawing primitives (Canvas 2D, no assets), shared by the play view, the calibration
 * intro, the lobby and the progress card: the biblical wilderness by day as flat gouache layers —
 * a sky that turns from dawn through noon to dusk (and night for the finisher), three parallax
 * ranges of hills in the colours of the four lands (the Negev's rose cliffs and mesas, the acacia
 * wadi, the Jordan's green ribbon, snowy Hermon far off), the sandstone ground with its strata,
 * the eaglet in its three plumages, the parent eagle, the thermals' warm columns, the mist of an
 * unreliable signal, the cloud of a blind block, the nest on its crag, and the eight vistas.
 *
 * The eagle belongs to Wzlot alone (DESIGN.md §5).  Nothing here depicts God: the parent is an eagle
 * and only an eagle.
 */
import type { Land, Light } from './content';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';

export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

export const C = {
  ink: '#2b2219', paper: '#fbf3e4', gold: '#e9b44c', gold2: '#ffd98a', rose: '#d98c6c', warm: '#ffcf8a',
  down: '#efe6d8', down2: '#d9cdb9', brown: '#8a5a34', brown2: '#5e3d22', dark: '#3b2716', beak: '#e8b54a', eye: '#1e140c',
  sand: '#d8ae73', sand2: '#bf8e57', rim: '#f0cf98', stick: '#7a5634', stick2: '#5a3d24',
} as const;

const TAU = Math.PI * 2;

/** Stable pseudo-random numbers for decorations (the same every frame). */
export function hash(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── colours ──────────────────────────────────────────────────────
export type RGB = [number, number, number];

export function hex(s: string): RGB {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const rgb = (c: RGB, a = 1): string =>
  a >= 1 ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`;

/** a → b by t, into `out` (no allocation). */
export function mixInto(out: RGB, a: RGB, b: RGB, t: number): RGB {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

export const mix = (a: RGB, b: RGB, t: number): RGB => mixInto([0, 0, 0], a, b, t);

// ── the sky ──────────────────────────────────────────────────────
export interface SkyLook { top: RGB; mid: RGB; low: RGB; sun: RGB; light: RGB; night: number }

/** Keyframes across the session: dawn (0), morning, noon, afternoon, dusk (1), night (1.35). */
const SKY: readonly { at: number; top: RGB; mid: RGB; low: RGB; sun: RGB; light: RGB }[] = [
  { at: 0, top: hex('#4f5f9c'), mid: hex('#d99a96'), low: hex('#ffd2a1'), sun: hex('#ffe3b0'), light: hex('#ffb184') },
  { at: 0.22, top: hex('#6ea4da'), mid: hex('#b9daf0'), low: hex('#f6e3c3'), sun: hex('#fff3d6'), light: hex('#fff0d8') },
  { at: 0.5, top: hex('#4f97d8'), mid: hex('#a4d0ee'), low: hex('#f1e3c6'), sun: hex('#ffffff'), light: hex('#ffffff') },
  { at: 0.78, top: hex('#6a95c6'), mid: hex('#e7c39b'), low: hex('#f9cf96'), sun: hex('#ffe2a8'), light: hex('#ffe1b4') },
  { at: 1, top: hex('#46467a'), mid: hex('#df8569'), low: hex('#ffbb74'), sun: hex('#ffcf7a'), light: hex('#ff9a6a') },
  { at: 1.35, top: hex('#0f1430'), mid: hex('#25284c'), low: hex('#4a3c62'), sun: hex('#f3e7c6'), light: hex('#5a5a90') },
];

export function skyAt(phase: number, out?: SkyLook): SkyLook {
  const o = out ?? { top: [0, 0, 0], mid: [0, 0, 0], low: [0, 0, 0], sun: [0, 0, 0], light: [0, 0, 0], night: 0 };
  const p = Math.max(0, Math.min(SKY[SKY.length - 1].at, phase));
  let i = 0;
  while (i < SKY.length - 2 && SKY[i + 1].at < p) i++;
  const a = SKY[i], b = SKY[i + 1], k = (p - a.at) / (b.at - a.at);
  mixInto(o.top, a.top, b.top, k);
  mixInto(o.mid, a.mid, b.mid, k);
  mixInto(o.low, a.low, b.low, k);
  mixInto(o.sun, a.sun, b.sun, k);
  mixInto(o.light, a.light, b.light, k);
  o.night = Math.max(0, Math.min(1, (phase - 1) / 0.35));
  return o;
}

/** The sky: its gradient, the sun on its arc across the session (the moon and stars at night). */
export function paintSky(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, phase: number, s: SkyLook, t = 0): void {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgb(s.top));
  g.addColorStop(0.55, rgb(s.mid));
  g.addColorStop(1, rgb(s.low));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  // the sun climbs from the left at dawn, high at noon, down to the right at dusk
  const p = Math.min(1, phase);
  const sx = x + w * (0.12 + 0.76 * p), sy = y + h * (0.62 - 0.5 * Math.sin(Math.PI * p));
  const r = Math.max(10, Math.min(w, h) * 0.05);
  const halo = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 5);
  halo.addColorStop(0, rgb(s.sun, 0.55 * (1 - s.night)));
  halo.addColorStop(1, rgb(s.sun, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(sx - r * 5, sy - r * 5, r * 10, r * 10);
  if (s.night < 1) {
    ctx.fillStyle = rgb(s.sun, 1 - s.night);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, TAU);
    ctx.fill();
  }
  if (s.night > 0) {
    // stars and a thin moon over the nest
    for (let i = 0; i < 70; i++) {
      const px = x + hash(i * 3 + 1) * w, py = y + hash(i * 3 + 2) * h * 0.6;
      ctx.globalAlpha = s.night * (0.35 + 0.5 * hash(i * 3 + 3)) * (0.75 + 0.25 * Math.sin(t * 1.7 + i));
      ctx.fillStyle = '#fff8e6';
      ctx.fillRect(px, py, 1.4, 1.4);
    }
    ctx.globalAlpha = s.night;
    const mx = x + w * 0.78, my = y + h * 0.18, mr = r * 0.8;
    ctx.fillStyle = '#f6edd2';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgb(s.top);
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ── the four lands ───────────────────────────────────────────────
/** A land's colours: the far range, the middle range, the near range, the ground and its strata. */
export interface LandLook { far: RGB; mid: RGB; near: RGB; ground: RGB; strata: RGB; green: RGB }

export const LAND_LOOK: Readonly<Record<Land, LandLook>> = {
  negev: { far: hex('#cfa093'), mid: hex('#c07a58'), near: hex('#a95f40'), ground: hex('#dba571'), strata: hex('#bd7e4f'), green: hex('#9a8f5a') },
  wadi: { far: hex('#c9b497'), mid: hex('#ae9063'), near: hex('#8f7448'), ground: hex('#ddb67c'), strata: hex('#be9259'), green: hex('#6f7f3e') },
  jordan: { far: hex('#a7b6a0'), mid: hex('#86a070'), near: hex('#5f8450'), ground: hex('#d2b47c'), strata: hex('#b0915c'), green: hex('#4e8a45') },
  hermon: { far: hex('#9aa6be'), mid: hex('#8c9d7c'), near: hex('#6f8460'), ground: hex('#cfb27f'), strata: hex('#ac9161'), green: hex('#5f8a4a') },
};

/** A height profile for a parallax range at world x (0..1, smooth): three octaves of sines from the seed. */
export function profile(x: number, seed: number): number {
  const a = hash(seed) * TAU, b = hash(seed + 1) * TAU, c = hash(seed + 2) * TAU;
  return 0.5 + 0.28 * Math.sin(x * 1.1 + a) + 0.15 * Math.sin(x * 2.7 + b) + 0.07 * Math.sin(x * 6.3 + c);
}

/** Hermon's range: a few tall peaks; snow above SNOW. */
const SNOW = 0.74;
let snowBuf = new Float32Array(0);
const hermon = (v: number): number => 0.2 + Math.pow(Math.max(0, v), 1.6) * 0.95;

/** A mesa's flat top: the profile cut off above `cap`, its cliffs steep. */
const mesa = (v: number, cap: number): number => (v > cap ? cap + (v - cap) * 0.08 : v);

/**
 * One parallax range across the screen: `x0` is the world x at the screen's left edge seen through
 * the range's own parallax, `k` world units per px, `base` its foot (px), `amp` its height (px).
 */
export function paintRange(
  ctx: CanvasRenderingContext2D, w: number, x0: number, k: number, base: number, amp: number, color: RGB, land: Land, layer: 0 | 1 | 2, seed: number,
  bottom: number,
): void {
  ctx.fillStyle = rgb(color);
  ctx.beginPath();
  ctx.moveTo(-2, bottom);
  const step = 6;
  for (let px = -2; px <= w + step; px += step) {
    const wx = x0 + px * k;
    let v = profile(wx, seed);
    if (land === 'negev' && layer === 1) v = mesa(v, 0.62);
    if (land === 'hermon' && layer === 0) v = hermon(v);
    ctx.lineTo(px, base - v * amp);
  }
  ctx.lineTo(w + step, bottom);
  ctx.closePath();
  ctx.fill();
  // the land's mark on the range
  if (land === 'hermon' && layer === 0) {
    // snow on the high peaks: caps following the ridgeline down to a ragged lower edge, one path per peak
    const n = Math.ceil((w + step + 2) / step) + 1;
    if (snowBuf.length < n) snowBuf = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) snowBuf[i] = hermon(profile(x0 + (i * step - 2) * k, seed));
    ctx.fillStyle = 'rgba(250,252,255,.9)';
    ctx.beginPath();
    let i = 0;
    while (i < n) {
      if (snowBuf[i] <= SNOW) { i++; continue; }
      const start = i;
      while (i < n && snowBuf[i] > SNOW) i++;
      const end = i - 1;
      ctx.moveTo(start * step - 2, base - snowBuf[start] * amp);
      for (let j = start + 1; j <= end; j++) ctx.lineTo(j * step - 2, base - snowBuf[j] * amp);
      for (let j = end; j >= start; j--) {
        const v = snowBuf[j];
        const cap = Math.min(v - SNOW, 0.1 + 0.035 * Math.sin(j * 1.7) + 0.02 * Math.sin(j * 0.6));
        ctx.lineTo(j * step - 2, base - (v - cap) * amp);
      }
      ctx.closePath();
    }
    ctx.fill();
  } else if (land === 'jordan' && layer === 2) {
    // the green ribbon along the river at the range's foot, and the water's glint
    ctx.fillStyle = 'rgba(70,128,64,.75)';
    ctx.fillRect(-2, base - amp * 0.12, w + 4, amp * 0.12 + (bottom - base));
    ctx.strokeStyle = 'rgba(214,236,240,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = -2; px <= w + step; px += step) ctx.lineTo(px, base - amp * 0.05 + Math.sin((x0 + px * k) * 5) * 2);
    ctx.stroke();
  } else if (land === 'wadi' && layer === 2) {
    // acacias on the near range: flat umbrella crowns on thin trunks
    const spacing = 0.55;
    const first = Math.floor(x0 / spacing);
    for (let i = first; i < first + 40; i++) {
      if (hash(i * 7 + seed) < 0.45) continue;
      const wx = (i + hash(i + seed)) * spacing;
      const px = (wx - x0) / k;
      if (px > w + 30) break;
      if (px < -30) continue;
      const gy = base - profile(wx, seed) * amp;
      paintAcacia(ctx, px, gy + 2, amp * (0.16 + 0.08 * hash(i + 3)), color);
    }
  }
}

/** An acacia: a forked trunk under a flat crown, in the range's own darker tone. */
export function paintAcacia(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, tone: RGB): void {
  const dark = mix(tone, [40, 36, 22], 0.45);
  ctx.strokeStyle = rgb(dark);
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h * 0.55);
  ctx.lineTo(x - h * 0.25, y - h * 0.82);
  ctx.moveTo(x, y - h * 0.55);
  ctx.lineTo(x + h * 0.3, y - h * 0.85);
  ctx.stroke();
  ctx.fillStyle = rgb(mix(dark, [90, 110, 50], 0.35));
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.9, h * 0.62, h * 0.16, 0, 0, TAU);
  ctx.fill();
}

// ── the eaglet ───────────────────────────────────────────────────
export interface EagletPose {
  /** plumage stage: 1 down, 2 first feathers, 3 flight feathers */
  stage: 1 | 2 | 3;
  /** 0 wings open … 1 folded tight (a dive) */
  fold: number;
  /** the wings' spread when open: 0.55 neutral … 0.95 */
  spread: number;
  /** a wingbeat's phase (radians; 0 when gliding) */
  flap: number;
  /** soaring: a golden edge on the wings */
  glow: number;
}

const STAGE_LOOK = {
  1: { body: hex('#efe6d8'), belly: hex('#fbf6ec'), wing: hex('#ddd1bd'), tip: hex('#cbbda5'), head: hex('#f4ede1') },
  2: { body: hex('#a87a4c'), belly: hex('#e8dcc6'), wing: hex('#8a5f38'), tip: hex('#6a472a'), head: hex('#efe5d3') },
  3: { body: hex('#7a5232'), belly: hex('#a07650'), wing: hex('#5e3c22'), tip: hex('#2f1e12'), head: hex('#c9963f') },
} as const;

/**
 * The eaglet seen from the side, facing right, centred on (x, y), `size` ≈ its body length (px),
 * turned by `angle` (radians, positive = nose up).  Folded it is a tucked teardrop; open, its near
 * wing spreads above its back with feathers fanned by the plumage.
 */
export function paintEaglet(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, pose: EagletPose): void {
  const L = STAGE_LOOK[pose.stage];
  const s = size;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-angle);
  const fold = Math.max(0, Math.min(1, pose.fold));
  const open = 1 - fold;
  // the far wing, behind the body (a darker, shorter shape)
  if (open > 0.05) wing(ctx, s, open, pose, L.tip, L.tip, 0.62, -0.25);
  // the tail
  ctx.fillStyle = rgb(L.wing);
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.02);
  ctx.lineTo(-s * (0.62 + 0.06 * pose.stage), -s * 0.1 + fold * s * 0.05);
  ctx.lineTo(-s * (0.6 + 0.06 * pose.stage), s * 0.08);
  ctx.lineTo(-s * 0.3, s * 0.1);
  ctx.closePath();
  ctx.fill();
  if (pose.stage === 3) {
    // a young eagle's white tail base
    ctx.fillStyle = 'rgba(250,246,236,.92)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.34, -s * 0.03);
    ctx.lineTo(-s * 0.55, -s * 0.08);
    ctx.lineTo(-s * 0.54, s * 0.07);
    ctx.lineTo(-s * 0.33, s * 0.09);
    ctx.closePath();
    ctx.fill();
  }
  // the body: rounder in down, sleeker with feathers; tighter when folded
  const bl = s * (0.42 + 0.03 * pose.stage), bh = s * (0.25 - 0.02 * pose.stage) * (1 - 0.15 * fold);
  ctx.fillStyle = rgb(L.body);
  if (pose.stage === 1) fluff(ctx, 0, 0, bl, bh, 14);
  else {
    ctx.beginPath();
    ctx.ellipse(0, 0, bl, bh, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = rgb(L.belly);
  ctx.beginPath();
  ctx.ellipse(s * 0.04, bh * 0.45, bl * 0.7, bh * 0.5, 0, 0, Math.PI);
  ctx.fill();
  // the head and the hooked beak
  const hx = s * 0.4, hy = -s * 0.1, hr = s * (0.19 - 0.012 * pose.stage);
  ctx.fillStyle = rgb(L.head);
  if (pose.stage === 1) fluff(ctx, hx, hy, hr, hr, 10);
  else {
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.fill();
  }
  if (pose.stage === 3) {
    // the golden nape
    ctx.fillStyle = 'rgba(232,184,90,.85)';
    ctx.beginPath();
    ctx.ellipse(hx - hr * 0.45, hy - hr * 0.1, hr * 0.7, hr * 0.85, 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.beak;
  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.75, hy - hr * 0.3);
  ctx.quadraticCurveTo(hx + hr * 1.75, hy - hr * 0.25, hx + hr * 1.55, hy + hr * 0.45);
  ctx.lineTo(hx + hr * 0.8, hy + hr * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(60,40,20,.55)';
  ctx.beginPath();
  ctx.arc(hx + hr * 1.5, hy + hr * 0.38, hr * 0.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.eye;
  ctx.beginPath();
  ctx.arc(hx + hr * 0.35, hy - hr * 0.2, Math.max(1.2, hr * 0.17), 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.beginPath();
  ctx.arc(hx + hr * 0.4, hy - hr * 0.27, Math.max(0.5, hr * 0.06), 0, TAU);
  ctx.fill();
  // the near wing: folded along the body, or open over it
  if (open > 0.05) wing(ctx, s, open, pose, L.wing, L.tip, 1, 0);
  else {
    ctx.fillStyle = rgb(L.wing);
    ctx.beginPath();
    ctx.ellipse(-s * 0.06, -bh * 0.1, bl * 0.82, bh * 0.62, -0.08, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgb(L.tip, 0.6);
    ctx.lineWidth = Math.max(0.8, s * 0.02);
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, -bh * 0.05);
    ctx.lineTo(s * 0.18, -bh * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

/** One wing over the back: a fan of feathers whose span follows the spread and the beat. */
function wing(ctx: CanvasRenderingContext2D, s: number, open: number, pose: EagletPose, tone: RGB, tip: RGB, scale: number, lift: number): void {
  const span = s * (0.55 + 0.75 * pose.spread) * scale * open;
  const beat = Math.sin(pose.flap);
  const up = 0.75 + lift + 0.5 * beat;   // radians above the back
  const rx = Math.cos(up), ry = -Math.sin(up);
  const root = { x: -s * 0.02, y: -s * 0.12 };
  const tipX = root.x + rx * span - span * 0.35, tipY = root.y + ry * span;
  ctx.fillStyle = rgb(tone);
  ctx.beginPath();
  ctx.moveTo(root.x + s * 0.18, root.y + s * 0.02);
  ctx.quadraticCurveTo(root.x + rx * span * 0.5 + s * 0.1, root.y + ry * span * 0.55, tipX, tipY);
  // the trailing edge: feathers (fingered from the second plumage)
  const n = pose.stage === 1 ? 3 : pose.stage === 2 ? 5 : 7;
  const back = { x: root.x - s * 0.3, y: root.y + s * 0.04 };
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const px = tipX + (back.x - tipX) * k, py = tipY + (back.y - tipY) * k;
    const notch = pose.stage === 1 ? s * 0.05 : s * (0.05 + 0.05 * (1 - k)) * (pose.stage === 3 ? 1.5 : 1);
    ctx.quadraticCurveTo(px + notch * 0.4, py + notch, px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgb(tip, 0.7);
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  ctx.stroke();
  if (pose.stage === 3 && scale === 1) {
    // and the white patch at the base of its flight feathers
    ctx.fillStyle = 'rgba(250,246,236,.9)';
    ctx.beginPath();
    ctx.ellipse(root.x + (tipX - root.x) * 0.55, root.y + (tipY - root.y) * 0.55 + s * 0.03, span * 0.12, span * 0.06, -up + 0.4, 0, TAU);
    ctx.fill();
  }
  if (pose.glow > 0.01) {
    ctx.strokeStyle = `rgba(255,214,120,${(0.85 * pose.glow).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(root.x + s * 0.18, root.y + s * 0.02);
    ctx.quadraticCurveTo(root.x + rx * span * 0.5 + s * 0.1, root.y + ry * span * 0.55, tipX, tipY);
    ctx.stroke();
  }
}

/** A downy shape: an ellipse with a soft scalloped edge. */
function fluff(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, n: number): void {
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU, r = i % 2 ? 1.06 : 0.97;
    const px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ── the parent eagle ─────────────────────────────────────────────
/**
 * The parent: a great dark eagle with a golden nape, seen from below and the side, wings spread
 * wide with fingered primaries.  `size` ≈ its body length (px); `flap` the beat's phase; `face`
 * ±1 (right / left).
 */
export function paintEagle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle: number, flap: number, face = 1, alpha = 1): void {
  if (alpha <= 0.01) return;
  const s = size;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(face, 1);
  ctx.rotate(-angle * face);
  const beat = Math.sin(flap);
  const dark = '#3a2616', mid = '#5a3a20', light = '#7b5432';
  // both wings: a long broad shape out to fingered tips, raised and lowered by the beat
  for (const side of [-1, 1]) {
    const lift = (side < 0 ? 0.5 : 1) * (0.55 * beat + 0.15);
    const span = s * (side < 0 ? 1.15 : 1.5);
    const tx = -s * 0.15 - span * 0.25, ty = -span * Math.sin(0.35 + lift) * (side < 0 ? 0.8 : 1);
    ctx.fillStyle = side < 0 ? dark : mid;
    ctx.beginPath();
    ctx.moveTo(s * 0.18, -s * 0.05);
    ctx.quadraticCurveTo(s * 0.05, ty * 0.6, tx, ty);
    // five fingered primaries
    for (let i = 0; i < 5; i++) {
      const k = i / 4;
      const fx = tx - s * 0.08 * (1 - k) - s * 0.06 * k, fy = ty + s * 0.12 * k;
      ctx.lineTo(fx - s * 0.14, fy + s * 0.02);
      ctx.lineTo(fx + s * 0.02, fy + s * 0.08);
    }
    ctx.quadraticCurveTo(-s * 0.3, ty * 0.3 + s * 0.08, -s * 0.28, s * 0.06);
    ctx.closePath();
    ctx.fill();
    if (side > 0) {
      ctx.strokeStyle = 'rgba(160,110,60,.45)';
      ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(s * 0.1, -s * 0.04);
      ctx.quadraticCurveTo(-s * 0.05, ty * 0.45, tx + s * 0.1, ty + s * 0.16);
      ctx.stroke();
    }
  }
  // the tail, fanned
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.04);
  ctx.lineTo(-s * 0.75, -s * 0.14);
  ctx.lineTo(-s * 0.78, s * 0.1);
  ctx.lineTo(-s * 0.32, s * 0.08);
  ctx.closePath();
  ctx.fill();
  // the body and the head with its golden nape
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.42, s * 0.15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.ellipse(s * 0.05, s * 0.06, s * 0.3, s * 0.07, 0, 0, Math.PI);
  ctx.fill();
  const hx = s * 0.44, hy = -s * 0.06, hr = s * 0.12;
  ctx.fillStyle = '#c99443';
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mid;
  ctx.beginPath();
  ctx.arc(hx + hr * 0.25, hy + hr * 0.25, hr * 0.8, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = C.beak;
  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.7, hy - hr * 0.35);
  ctx.quadraticCurveTo(hx + hr * 1.9, hy - hr * 0.3, hx + hr * 1.6, hy + hr * 0.55);
  ctx.lineTo(hx + hr * 0.8, hy + hr * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.eye;
  ctx.beginPath();
  ctx.arc(hx + hr * 0.4, hy - hr * 0.2, Math.max(1.2, hr * 0.16), 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── thermals, mist, cloud, nest ──────────────────────────────────
/**
 * A thermal's column of warm air rising from a valley: a soft warm band, its shimmer lines curling
 * upward and motes of dust carried in it.  `strength` 0..1 makes it taller, warmer and busier.
 */
export function paintThermal(ctx: CanvasRenderingContext2D, x: number, floor: number, top: number, halfW: number, strength: number, t: number, alpha: number, still = false): void {
  if (alpha <= 0.01) return;
  const h = floor - top;
  const a = alpha * (0.6 + 0.4 * strength);
  const g = ctx.createLinearGradient(0, floor, 0, top);
  g.addColorStop(0, `rgba(255,186,110,${(0.55 * a).toFixed(3)})`);
  g.addColorStop(0.6, `rgba(255,208,140,${(0.28 * a).toFixed(3)})`);
  g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - halfW * 0.8, floor);
  ctx.quadraticCurveTo(x - halfW * 1.3, floor - h * 0.5, x - halfW * 1.1, top);
  ctx.lineTo(x + halfW * 1.1, top);
  ctx.quadraticCurveTo(x + halfW * 1.3, floor - h * 0.5, x + halfW * 0.8, floor);
  ctx.closePath();
  ctx.fill();
  // shimmer: wavy lines moving up
  ctx.strokeStyle = `rgba(255,246,222,${(0.55 * a).toFixed(3)})`;
  ctx.lineWidth = 1.5;
  const n = 3 + Math.round(strength * 3);
  const speed = still ? 0 : 0.35 + 0.5 * strength;
  for (let i = 0; i < n; i++) {
    const k = ((i / n + t * speed) % 1);
    const yy = floor - k * h;
    const off = (hash(i + 5) - 0.5) * halfW;
    ctx.globalAlpha = Math.sin(Math.PI * k);
    ctx.beginPath();
    for (let j = 0; j <= 8; j++) {
      const q = j / 8;
      ctx.lineTo(x + off + (q - 0.5) * halfW * 0.9, yy - Math.sin(q * TAU + t * 3 + i) * halfW * 0.12 - q * halfW * 0.3);
    }
    ctx.stroke();
  }
  // motes
  ctx.fillStyle = 'rgba(255,240,210,.9)';
  for (let i = 0; i < 6 + strength * 10; i++) {
    const k = ((hash(i * 2 + 1) + t * speed * (0.6 + 0.4 * hash(i))) % 1);
    ctx.globalAlpha = a * Math.sin(Math.PI * k);
    const px = x + Math.sin(k * 9 + i) * halfW * 0.7;
    ctx.fillRect(px, floor - k * h, 1.8, 1.8);
  }
  ctx.globalAlpha = 1;
}

/** A soft cloud of overlapping puffs (the blind block hides the parent in one). */
export function paintCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number, seed = 1, tone = '255,255,255'): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = `rgba(${tone},.95)`;
  const n = 7;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const r = h * (0.32 + 0.3 * Math.sin(Math.PI * k) + 0.12 * hash(seed + i));
    const px = x - w / 2 + w * (0.12 + 0.76 * k), py = y + h * 0.15 - r * 0.6;
    ctx.moveTo(px + r, py);
    ctx.arc(px, py, r, 0, TAU);
  }
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.05, w * 0.42, h * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A rocky spire from the ground up to its top, where the nest sits. */
export function paintSpire(ctx: CanvasRenderingContext2D, x: number, foot: number, top: number, w: number, tone: RGB, strata: RGB): void {
  ctx.fillStyle = rgb(tone);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.9, foot);
  ctx.lineTo(x - w * 0.55, top + (foot - top) * 0.35);
  ctx.lineTo(x - w * 0.5, top + 2);
  ctx.lineTo(x + w * 0.45, top);
  ctx.lineTo(x + w * 0.6, top + (foot - top) * 0.4);
  ctx.lineTo(x + w * 1.0, foot);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgb(strata, 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) {
    const yy = top + ((foot - top) * i) / 6;
    ctx.moveTo(x - w * 0.5, yy);
    ctx.lineTo(x + w * 0.5, yy + 2);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,215,.25)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, top + 2);
  ctx.lineTo(x - w * 0.1, top + 1);
  ctx.lineTo(x - w * 0.3, foot);
  ctx.lineTo(x - w * 0.9, foot);
  ctx.closePath();
  ctx.fill();
}

/** The nest: a bowl of sticks, lined with down, centred on (x, y) at its rim; `size` its width. */
export function paintNest(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const s = size;
  ctx.fillStyle = C.stick2;
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.08, s * 0.5, s * 0.2, 0, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = '#efe4d0';
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.4, s * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = C.stick;
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (hash(i + 11) - 0.5) * 0.7, cx = x + (hash(i + 12) - 0.5) * s * 0.85, cy = y + s * (0.02 + 0.16 * hash(i + 13));
    ctx.moveTo(cx - Math.cos(a) * s * 0.22, cy - Math.sin(a) * s * 0.08);
    ctx.lineTo(cx + Math.cos(a) * s * 0.22, cy + Math.sin(a) * s * 0.08);
  }
  ctx.stroke();
}

// ── the vistas ───────────────────────────────────────────────────
/**
 * A vista of the land in its light: the land's ranges under a dawn or dusk sky, small enough for a
 * tile, large enough for the card over the play.  `found` false paints it as a dim silhouette.
 */
export function paintVista(ctx: CanvasRenderingContext2D, land: Land, light: Light, x: number, y: number, w: number, h: number, found = true): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.translate(x, y);
  const sky = skyAt(light === 'dawn' ? 0.04 : 0.97);
  paintSky(ctx, 0, 0, w, h, light === 'dawn' ? 0.04 : 0.96, sky);
  const L = LAND_LOOK[land];
  const k = 4.2 / Math.max(40, w);
  const seed = LANDS_SEED[land];
  const lit = (c: RGB, f: number) => mix(c, sky.light, f);
  paintRange(ctx, w, 0.3, k * 0.8, h * 0.66, h * 0.44, lit(L.far, 0.35), land, 0, seed, h);
  paintRange(ctx, w, 1.7, k, h * 0.84, h * 0.34, lit(L.mid, 0.2), land, 1, seed + 10, h);
  paintRange(ctx, w, 3.1, k * 1.3, h * 1.02, h * 0.3, lit(L.near, 0.12), land, 2, seed + 20, h);
  // a warm light from the low sun
  const g = ctx.createLinearGradient(light === 'dawn' ? 0 : w, 0, light === 'dawn' ? w : 0, 0);
  g.addColorStop(0, rgb(sky.light, 0.28));
  g.addColorStop(1, rgb(sky.light, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (!found) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(38,36,46,.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

export const LANDS_SEED: Readonly<Record<Land, number>> = { negev: 11, wadi: 23, jordan: 37, hermon: 53 };
