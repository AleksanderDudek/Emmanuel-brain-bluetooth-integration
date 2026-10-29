/**
 * The village table and its guests, drawn for the evening (render.ts), the wide layout's table panel
 * (hud.ts), the lobby's picture (preview.ts) and the album's tiles (panel.ts).  A long oval board on
 * trestles in the mosaic's palette; its eight steps appear as they are set (the cloth, the bread,
 * oil and honey, the bowl with the best fruit, the oil lamps, the benches, the lyre and drum, the
 * vine over it all), and the guests sit in their seats (content.ts): six behind the board, four in
 * front of it, one at each end.  Figures are simple shapes with a dark outline, each told apart by
 * the one thing they carry.
 */
import { clamp } from '../kit/juice';
import { guestById, type FigureLook } from './content';
import { C, TAU, mix, paintFruit, paintVineLeaf, stone } from './mosaic';

const OUT = 'rgba(42,38,34,.85)';

/** A guest standing or sitting with their base at (x, y), `size` tall; `face` 1 looks right. */
export function paintGuest(ctx: CanvasRenderingContext2D, look: FigureLook, x: number, y: number, size: number, face = 1, alpha = 1): void {
  const s = size * (look.small ? 0.78 : 1);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.strokeStyle = OUT;
  const headR = s * 0.15, headY = y - s + headR * 1.05;
  const shoulder = y - s * 0.68;
  // the tunic: a soft trapezoid from the shoulders to the hem
  ctx.fillStyle = look.tunic;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.16, shoulder);
  ctx.quadraticCurveTo(x, shoulder - s * 0.05, x + s * 0.16, shoulder);
  ctx.lineTo(x + s * 0.27, y);
  ctx.lineTo(x - s * 0.27, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // a belt of darker stones
  ctx.fillStyle = mix(look.tunic, C.dark, 0.35);
  ctx.fillRect(x - s * 0.2, y - s * 0.38, s * 0.4, Math.max(1.5, s * 0.04));
  // the attribute behind the body
  behind(ctx, look, x, y, s, face);
  // the head and the hair or head-cloth
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (look.cloth) {
    ctx.fillStyle = look.cloth;
    ctx.beginPath();
    ctx.moveTo(x - headR * 1.15, headY + headR * 0.2);
    ctx.arc(x, headY, headR * 1.18, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(x + headR * 1.25, shoulder + s * 0.12);
    ctx.lineTo(x + headR * 0.8, shoulder + s * 0.12);
    ctx.lineTo(x + headR * 0.85, headY);
    ctx.lineTo(x - headR * 0.85, headY);
    ctx.lineTo(x - headR * 0.8, shoulder + s * 0.12);
    ctx.lineTo(x - headR * 1.25, shoulder + s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.arc(x, headY - headR * 0.12, headR * 1.02, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
  }
  // eyes: two dark stones, looking the way they face
  ctx.fillStyle = C.dark;
  const ex = x + face * headR * 0.28;
  ctx.fillRect(ex - headR * 0.32, headY - headR * 0.05, Math.max(1, headR * 0.16), Math.max(1, headR * 0.16));
  ctx.fillRect(ex + headR * 0.16, headY - headR * 0.05, Math.max(1, headR * 0.16), Math.max(1, headR * 0.16));
  front(ctx, look, x, y, s, face);
  ctx.restore();
}

/** What is carried behind the body (staffs and crooks, the sheaf). */
function behind(ctx: CanvasRenderingContext2D, look: FigureLook, x: number, y: number, s: number, face: number): void {
  const hx = x + face * s * 0.3;
  if (look.attr === 'crook' || look.attr === 'staff') {
    ctx.strokeStyle = C.brown;
    ctx.lineWidth = Math.max(1.4, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(hx, y);
    ctx.lineTo(hx, y - s * 1.02);
    if (look.attr === 'crook') ctx.arc(hx - face * s * 0.08, y - s * 1.02, s * 0.08, 0, Math.PI, face > 0);
    ctx.stroke();
    ctx.strokeStyle = OUT;
    ctx.lineWidth = Math.max(1, s * 0.035);
  } else if (look.attr === 'sheaf' || look.attr === 'stalks') {
    const n = look.attr === 'sheaf' ? 7 : 4;
    ctx.strokeStyle = C.field;
    ctx.lineWidth = Math.max(1, s * 0.03);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.12;
      ctx.beginPath();
      ctx.moveTo(hx, y - s * 0.3);
      ctx.lineTo(hx + Math.cos(a) * s * 0.5, y - s * 0.3 + Math.sin(a) * s * 0.5);
      ctx.stroke();
      stone(ctx, hx + Math.cos(a) * s * 0.52, y - s * 0.3 + Math.sin(a) * s * 0.52, Math.max(1.5, s * 0.06), a, C.gold);
    }
    ctx.strokeStyle = OUT;
    ctx.lineWidth = Math.max(1, s * 0.035);
  }
}

/** What is held in front (a loaf, a jug, a lyre, a sickle, a hat, a shawl, a child beside them). */
function front(ctx: CanvasRenderingContext2D, look: FigureLook, x: number, y: number, s: number, face: number): void {
  const hx = x + face * s * 0.14, hy = y - s * 0.46;
  switch (look.attr) {
    case 'loaf':
      ctx.fillStyle = '#C48A4A';
      ctx.beginPath();
      ctx.ellipse(hx, hy, s * 0.14, s * 0.08, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,.7)';
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.06, hy - s * 0.02);
      ctx.lineTo(hx + s * 0.06, hy - s * 0.02);
      ctx.stroke();
      break;
    case 'jug':
      ctx.fillStyle = C.terracotta;
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.05, hy - s * 0.13);
      ctx.lineTo(hx + s * 0.05, hy - s * 0.13);
      ctx.quadraticCurveTo(hx + s * 0.13, hy, hx + s * 0.06, hy + s * 0.12);
      ctx.lineTo(hx - s * 0.06, hy + s * 0.12);
      ctx.quadraticCurveTo(hx - s * 0.13, hy, hx - s * 0.05, hy - s * 0.13);
      ctx.fill();
      ctx.stroke();
      break;
    case 'lyre':
      ctx.strokeStyle = C.ochre;
      ctx.lineWidth = Math.max(1.4, s * 0.045);
      ctx.beginPath();
      ctx.moveTo(hx - s * 0.1, hy - s * 0.16);
      ctx.quadraticCurveTo(hx - s * 0.12, hy + s * 0.1, hx, hy + s * 0.1);
      ctx.quadraticCurveTo(hx + s * 0.12, hy + s * 0.1, hx + s * 0.1, hy - s * 0.16);
      ctx.moveTo(hx - s * 0.11, hy - s * 0.12);
      ctx.lineTo(hx + s * 0.11, hy - s * 0.12);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,248,232,.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = -1; i <= 1; i++) {
        ctx.moveTo(hx + i * s * 0.04, hy - s * 0.12);
        ctx.lineTo(hx + i * s * 0.04, hy + s * 0.08);
      }
      ctx.stroke();
      break;
    case 'sickle':
      ctx.strokeStyle = '#B8B2A6';
      ctx.lineWidth = Math.max(1.4, s * 0.045);
      ctx.beginPath();
      ctx.arc(hx + face * s * 0.04, hy - s * 0.06, s * 0.11, face > 0 ? -Math.PI * 0.9 : -Math.PI * 0.1, face > 0 ? Math.PI * 0.1 : Math.PI * 0.9, face < 0);
      ctx.stroke();
      break;
    case 'hat':
      ctx.fillStyle = C.reed;
      ctx.beginPath();
      ctx.ellipse(x, y - s + s * 0.1, s * 0.26, s * 0.05, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y - s + s * 0.05, s * 0.12, s * 0.08, 0, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
      break;
    case 'shawl':
      ctx.fillStyle = mix(look.cloth ?? C.dark, C.lilac, 0.2);
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y - s * 0.66);
      ctx.lineTo(x + s * 0.2, y - s * 0.66);
      ctx.lineTo(x, y - s * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'child':
      paintGuest(ctx, { ...look, small: false, attr: 'veil', cloth: null, tunic: C.ochre }, x + face * s * 0.36, y, s * 0.5, -face);
      break;
    default:
      break;
  }
}

export interface TableOpts {
  /** steps set (0..8) */
  built: number;
  /** guest ids at the table */
  guests: readonly string[];
  /** seconds (the lamps flicker) */
  t: number;
  /** guests arriving: id → 0..1 (they fade and rise into their seat) */
  arriving?: ReadonlyMap<string, number>;
  /** the bowl's fruit (the best tier made) */
  bowl?: number;
  still?: boolean;
}

/** Where a seat is, relative to the board: x in −1..1 of its half width, row 0 behind, 1 in front, 2 an end. */
const SEATS: readonly [number, number][] = [
  [-0.78, 0], [-0.47, 0], [-0.16, 0], [0.16, 0], [0.47, 0], [0.78, 0],
  [-0.6, 1], [-0.2, 1], [0.2, 1], [0.6, 1],
  [-1.14, 2], [1.14, 2],
];

/**
 * The table centred at `cx` with its board's top at `y`, `w` wide.  Everything scales with `w`, so
 * the same picture serves a 120 px panel and the evening's full width.
 */
export function paintTable(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, o: TableOpts): void {
  const half = w / 2, th = w * 0.075, fig = w * 0.2;
  const legH = w * 0.13;
  const step = (i: number) => o.built > i;
  ctx.save();
  // the vine over the table (the pergola): two posts and a beam with leaves and grapes
  if (step(7)) {
    ctx.fillStyle = C.brown;
    ctx.fillRect(cx - half * 1.05, y - w * 0.42, w * 0.03, w * 0.42 + legH);
    ctx.fillRect(cx + half * 1.05 - w * 0.03, y - w * 0.42, w * 0.03, w * 0.42 + legH);
    ctx.fillRect(cx - half * 1.1, y - w * 0.44, w * 1.1, w * 0.025);
    for (let i = 0; i < 9; i++) {
      const lx = cx - half + (i + 0.5) * (w / 9);
      paintVineLeaf(ctx, lx, y - w * 0.43 + (i % 2) * w * 0.015, w * 0.035, (i % 3 - 1) * 0.5);
      if (i % 3 === 1) paintFruit(ctx, 8, lx + w * 0.02, y - w * 0.37, w * 0.03);
    }
  }
  // the benches (behind and in front)
  if (step(5)) {
    ctx.fillStyle = mix(C.brown, C.dark, 0.2);
    ctx.fillRect(cx - half * 0.95, y + th * 0.2 - fig * 0.18, w * 0.95, w * 0.022);
  }
  // the back row: upper bodies above the board
  seated(ctx, cx, y, half, fig, o, 0);
  // the board, its cloth, its legs
  ctx.fillStyle = mix(C.brown, C.dark, 0.25);
  ctx.fillRect(cx - half * 0.86, y + th * 0.6, w * 0.035, legH);
  ctx.fillRect(cx + half * 0.86 - w * 0.035, y + th * 0.6, w * 0.035, legH);
  ctx.fillStyle = C.brown;
  ctx.beginPath();
  ctx.ellipse(cx, y + th * 0.5, half, th * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = mix(C.brown, C.white, 0.15);
  ctx.beginPath();
  ctx.ellipse(cx, y + th * 0.35, half * 0.98, th * 0.5, 0, 0, TAU);
  ctx.fill();
  if (step(0)) {
    ctx.fillStyle = C.ground;
    ctx.beginPath();
    ctx.ellipse(cx, y + th * 0.35, half * 0.94, th * 0.48, 0, 0, TAU);
    ctx.fill();
    // the cloth's hanging edge with its woven border
    ctx.fillRect(cx - half * 0.7, y + th * 0.35, w * 0.7, th * 0.9);
    const t = Math.max(2, w * 0.012);
    for (let x = cx - half * 0.7 + t / 2, k = 0; x < cx + half * 0.7; x += t * 1.1, k++) stone(ctx, x, y + th * 1.1, t, 0.785, k % 4 < 2 ? C.blue : C.terracotta);
  }
  // what is on the board
  const top = y + th * 0.2;
  if (step(1)) for (const k of [-0.55, 0.35]) {
    // a round loaf: domed, scored three times
    const lx = cx + k * half, lw = w * 0.03, lh = w * 0.016;
    ctx.fillStyle = '#B9783C';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = Math.max(0.8, w * 0.003);
    ctx.beginPath();
    ctx.ellipse(lx, top - lh * 0.4, lw, lh, 0, Math.PI, TAU);
    ctx.lineTo(lx + lw, top);
    ctx.lineTo(lx - lw, top);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,200,.75)';
    ctx.beginPath();
    for (const d of [-0.45, 0, 0.45]) {
      ctx.moveTo(lx + (d - 0.12) * lw, top - lh * 1.05);
      ctx.lineTo(lx + (d + 0.12) * lw, top - lh * 0.45);
    }
    ctx.stroke();
  }
  if (step(2)) {
    // a jug of oil and a dish of honey
    const jx = cx - half * 0.25;
    ctx.fillStyle = C.terracotta;
    ctx.beginPath();
    ctx.moveTo(jx - w * 0.012, top - w * 0.06);
    ctx.lineTo(jx + w * 0.012, top - w * 0.06);
    ctx.quadraticCurveTo(jx + w * 0.035, top - w * 0.02, jx + w * 0.02, top);
    ctx.lineTo(jx - w * 0.02, top);
    ctx.quadraticCurveTo(jx - w * 0.035, top - w * 0.02, jx - w * 0.012, top - w * 0.06);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.ellipse(cx + half * 0.62, top, w * 0.03, w * 0.012, 0, 0, TAU);
    ctx.fill();
  }
  if (step(3)) {
    // the bowl with the best fruit
    ctx.fillStyle = C.ochre;
    ctx.beginPath();
    ctx.ellipse(cx + half * 0.08, top, w * 0.06, w * 0.022, 0, 0, Math.PI);
    ctx.fill();
    paintFruit(ctx, clamp(o.bowl ?? 5, 2, 7), cx + half * 0.08, top - w * 0.02, w * 0.028);
  }
  if (step(4)) for (const k of [-0.82, -0.05, 0.82]) {
    // the oil lamps and their flames
    const lx = cx + k * half;
    ctx.fillStyle = C.terracotta;
    ctx.beginPath();
    ctx.ellipse(lx, top, w * 0.022, w * 0.01, 0, 0, TAU);
    ctx.fill();
    const fl = o.still ? 1 : 0.85 + 0.15 * Math.sin(o.t * 9 + k * 7);
    const g = ctx.createRadialGradient(lx, top - w * 0.02, 0, lx, top - w * 0.02, w * 0.06);
    g.addColorStop(0, 'rgba(255,214,120,.55)');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - w * 0.06, top - w * 0.08, w * 0.12, w * 0.12);
    ctx.fillStyle = '#FFC85A';
    ctx.beginPath();
    ctx.ellipse(lx, top - w * 0.018 * fl, w * 0.007, w * 0.015 * fl, 0, 0, TAU);
    ctx.fill();
  }
  if (step(6)) {
    // the lyre and the little drum at the end of the board
    const mx = cx + half * 0.95;
    ctx.fillStyle = C.reed;
    ctx.beginPath();
    ctx.ellipse(mx, y + th * 1.9, w * 0.035, w * 0.015, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(mx - w * 0.035, y + th * 1.9, w * 0.07, w * 0.03);
  }
  // the ends and the front row
  seated(ctx, cx, y, half, fig, o, 2);
  if (step(5)) {
    ctx.fillStyle = mix(C.brown, C.dark, 0.1);
    ctx.fillRect(cx - half * 0.8, y + th * 1.3 + fig * 0.5, w * 0.8, w * 0.022);
  }
  seated(ctx, cx, y, half, fig, o, 1);
  ctx.restore();
}

function seated(ctx: CanvasRenderingContext2D, cx: number, y: number, half: number, fig: number, o: TableOpts, row: number): void {
  for (const id of o.guests) {
    const g = guestById(id);
    if (!g) continue;
    const [sx, r] = SEATS[g.seat] ?? [0, 0];
    if (r !== row) continue;
    const k = o.arriving?.get(id) ?? 1;
    if (k <= 0) continue;
    const x = cx + sx * half;
    const base = row === 0 ? y + fig * 0.35 : row === 1 ? y + fig * 1.2 : y + fig * 0.75;
    const size = row === 1 ? fig * 0.95 : fig;
    const face = row === 2 ? (sx < 0 ? 1 : -1) : sx < 0 ? 1 : -1;
    paintGuest(ctx, g.look, x, base + (1 - k) * fig * 0.3, size, face, k);
  }
}
