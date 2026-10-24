/**
 * The lobby's hero and the cards' art: a geode cut open in a dark cave, a shaft of light from its
 * crack, crystals of every cut and clarity set in the wall, a full row glowing before the harvest,
 * a drop falling from the crack; beside it the cave — stalactites that drip, druses, drifting motes.
 * In the lobby (with the player's progress) their finest specimen floats glowing in the middle and
 * the geode keeps above the hero's words; a wide card shows it large, cropped by the band.  The
 * still layer is cached per size; a frame adds only the light and the water.
 */
import { drawGeode, drawSpecimen, druse, GEODE_REACH, hash, ROCK_VARIANTS, rrect, TAU, TileCache } from './art';
import type { GeodaProgress } from './meta';
import { N, type Clarity } from './wall';

/** '#' rock, '.' empty, a letter a crystal (see GEMS_OF). */
const DEMO = [
  '#..AA.##',
  '##.AA###',
  '#C####B#',
  '.C##..B#',
  'DDDEEEDD',
  '#.##F#.#',
  '##.#F#G#',
  '#..#F.G#',
];
const GEMS_OF: Record<string, [number, Clarity]> = { A: [0, 3], B: [2, 2], C: [1, 1], D: [3, 2], E: [0, 2], F: [4, 3], G: [1, 2] };
const GLOW_ROW = 4;
/** The lobby hero's words at its foot (kicker, title, tagline; ~115 px on a phone): the geode keeps above them. */
export const HERO_TEXT = 115;
/** A card this much wider than tall is a band (the Gry page): the geode fills its height. */
const WIDE = 1.6;

const tiles = new TileCache();

interface Box { x: number; y: number; w: number; h: number }
interface Stalactite { x: number; w: number; len: number; phase: number }

export interface Frame {
  wall: Box;
  cell: number;
  rim: number;
  /** how far the geode reaches beyond the wall (px) */
  reach: number;
  /** the cave beside the geode, left and right (only the sides with room for it) */
  sides: Box[];
  /** the cave's props' size unit (px) */
  unit: number;
  hero: boolean;
  wide: boolean;
}

const rimOf = (size: number) => Math.max(4, (size / N) * 0.3);

/**
 * Where the geode goes: centred a little above the middle; in a hero too short for that (a phone)
 * fitted, rim and all, into the room above the words; in a wide band sized by its height.
 */
export function frameFor(w: number, h: number, hero: boolean): Frame {
  let size = Math.min(w * 0.52, h * 0.56), cy = h * 0.42;
  const wide = !hero && w / h > WIDE;
  if (hero && cy + size / 2 + rimOf(size) * GEODE_REACH > h - HERO_TEXT) {
    const room = h - HERO_TEXT - 10;
    // size + 2·reach(size) = room, with the rim's floor of 4 px
    size = Math.max(40, Math.min(w * 0.6, room / (1 + 0.6 * GEODE_REACH / N), room - 8 * GEODE_REACH));
    cy = 6 + room / 2;
  } else if (wide) {
    size = h * 1.15;
    cy = h * 0.6;
  }
  const cell = size / N, rim = rimOf(size), reach = rim * GEODE_REACH;
  const wall = { x: (w - size) / 2, y: cy - size / 2, w: size, h: size };
  const left = wall.x - reach - 4, right = w - (wall.x + size + reach + 4);
  const sides = [{ x: 0, y: 0, w: left, h }, { x: w - right, y: 0, w: right, h }].filter(s => s.w > 28);
  const unit = Math.max(10, Math.min(40, Math.min(h, size) * 0.12));
  return { wall, cell, rim, reach, sides, unit, hero, wide };
}

/** The stalactites over the cave beside the geode: two a side, one where it is narrow. */
function stalactites(f: Frame): Stalactite[] {
  const out: Stalactite[] = [];
  f.sides.forEach((s, k) => {
    const at = k === 0 ? [0.36, 0.78] : [0.22, 0.64];
    at.forEach((a, i) => {
      if (i && s.w < 60) return;
      out.push({ x: s.x + s.w * a, w: f.unit * (0.42 + 0.18 * hash(k * 5 + i)), len: f.unit * (1.1 + 0.9 * hash(k * 7 + i * 3)), phase: hash(k * 3 + i * 11) });
    });
  });
  return out;
}

/** The cave beside the geode: stalactites, druses (on the floor of a band, on the hero's walls), a few loose gems. */
function drawCave(x: CanvasRenderingContext2D, w: number, h: number, f: Frame, drips: readonly Stalactite[]): void {
  // soft dark and pale patches on the cave's walls
  for (let i = 0; i < 10; i++) {
    const bx = hash(i * 2.3 + 1) * w, by = hash(i * 5.1 + 1) * h, br = (0.1 + hash(i * 7.7) * 0.2) * Math.max(w, h);
    const b = x.createRadialGradient(bx, by, 0, bx, by, br);
    b.addColorStop(0, i % 3 ? 'rgba(0,0,0,0.2)' : 'rgba(160,130,200,0.04)');
    b.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = b;
    x.fillRect(0, 0, w, h);
  }
  for (const s of drips) {
    const g = x.createLinearGradient(s.x - s.w / 2, 0, s.x + s.w / 2, 0);
    g.addColorStop(0, '#4a4038');
    g.addColorStop(0.5, '#2e2622');
    g.addColorStop(1, '#17120f');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(s.x - s.w / 2, -1);
    x.quadraticCurveTo(s.x - s.w * 0.12, s.len * 0.55, s.x, s.len);
    x.quadraticCurveTo(s.x + s.w * 0.18, s.len * 0.5, s.x + s.w / 2, -1);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(255,236,214,0.12)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(s.x - s.w * 0.3, 0);
    x.quadraticCurveTo(s.x - s.w * 0.1, s.len * 0.5, s.x - 0.5, s.len * 0.92);
    x.stroke();
  }
  const u = f.unit;
  f.sides.forEach((s, k) => {
    const mid = s.x + s.w / 2;
    if (f.wide) {
      // the floor of the band: a druse each side, a smaller one of another mineral, loose gems
      x.save();
      x.globalAlpha = 0.85;
      druse(x, mid + (k ? 1 : -1) * s.w * 0.08, h + u * 0.3, u * 2.6, (k ? 0.12 : -0.12), 0, 11 + k);
      if (s.w > 90) druse(x, s.x + s.w * (k ? 0.82 : 0.18), h + u * 0.2, u * 1.5, k ? 0.3 : -0.3, k ? 3 : 1, 23 + k);
      x.restore();
      for (let i = 0; i < 2; i++) {
        const gx = s.x + s.w * (0.3 + 0.4 * hash(k * 9 + i * 4)), gs = u * (0.42 + 0.12 * i);
        tiles.draw(x, 'gem', (k * 2 + i) % 5, 1 + ((k + i) % 3) as Clarity, gx - gs / 2, h - gs * 1.2 - u * 0.15, gs);
      }
    } else if (f.hero && s.w > 40) {
      // the hero's cave walls: a druse grows out of a dark outcrop on each side
      const y = f.wall.y + f.wall.h * (k ? 0.36 : 0.72), ex = k ? s.x + s.w : s.x, size = Math.min(s.w * 0.9, u * 2.4);
      const rock = x.createRadialGradient(ex, y, 0, ex, y, size * 1.25);
      rock.addColorStop(0, 'rgba(24,19,16,0.95)');
      rock.addColorStop(0.6, 'rgba(24,19,16,0.6)');
      rock.addColorStop(1, 'rgba(24,19,16,0)');
      x.fillStyle = rock;
      x.fillRect(ex - size * 1.3, y - size * 1.3, size * 2.6, size * 2.6);
      x.save();
      x.globalAlpha = 0.82;
      druse(x, ex + (k ? 1 : -1) * u * 0.15, y, size, k ? -Math.PI / 2 : Math.PI / 2, 0, 31 + k);
      x.restore();
    }
  });
}

function buildStill(w: number, h: number, dpr: number, f: Frame, drips: readonly Stalactite[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const x = c.getContext('2d')!;
  x.scale(dpr, dpr);
  const cx = f.wall.x + f.wall.w / 2, cy = f.wall.y + f.wall.h / 2;
  const g = x.createRadialGradient(cx, cy, f.wall.w * 0.2, cx, cy, Math.max(w, h) * 0.8);
  g.addColorStop(0, '#2a1f3b');
  g.addColorStop(0.5, '#171124');
  g.addColorStop(1, '#0a0710');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  tiles.setDpr(dpr);
  drawCave(x, w, h, f, drips);
  drawGeode(x, f.wall, f.rim, 2.3);
  DEMO.forEach((row, y) => [...row].forEach((ch, i) => {
    const px = f.wall.x + i * f.cell, py = f.wall.y + y * f.cell;
    tiles.draw(x, 'slate', (i + y) % 3, 0, px, py, f.cell);
    if (ch === '#') tiles.draw(x, 'rock', (i * 7 + y * 3) % ROCK_VARIANTS, 0, px, py, f.cell);
    else if (ch !== '.') {
      const [gem, cl] = GEMS_OF[ch];
      tiles.draw(x, 'gem', gem, cl, px, py, f.cell);
    }
  }));
  if (!f.hero && !f.wide) {
    // a square card (the Start page's tiles) carries its title over the lower half: the cave darkens there
    const fade = x.createLinearGradient(0, h * 0.36, 0, h);
    fade.addColorStop(0, 'rgba(10,7,16,0)');
    fade.addColorStop(0.5, 'rgba(10,7,16,0.72)');
    fade.addColorStop(1, 'rgba(10,7,16,0.86)');
    x.fillStyle = fade;
    x.fillRect(0, h * 0.36, w, h * 0.64);
  }
  return c;
}

/** The water and the dust in the cave beside the geode: a drop forms on each stalactite and falls; motes drift. */
function drawCaveLife(ctx: CanvasRenderingContext2D, h: number, t: number, f: Frame, drips: readonly Stalactite[]): void {
  const floor = f.hero ? f.wall.y + f.wall.h + f.reach : h * 0.9;
  ctx.fillStyle = 'rgba(205,228,255,0.85)';
  for (const s of drips) {
    const k = (t / 2.8 + s.phase) % 1;
    if (k < 0.6) {
      const r = 0.6 + 1.6 * (k / 0.6);
      ctx.beginPath();
      ctx.ellipse(s.x, s.len + r, r, r * 1.25, 0, 0, TAU);
      ctx.fill();
    } else {
      const fall = (k - 0.6) / 0.4, y = s.len + (floor - s.len) * fall * fall;
      ctx.globalAlpha = 1 - fall * 0.7;
      ctx.beginPath();
      ctx.ellipse(s.x, y, 1.6, 2.6, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
  for (const s of f.sides) {
    for (let i = 0; i < 6; i++) {
      const k = (hash(i * 3.1 + s.x) + t * (0.01 + hash(i + s.x) * 0.012)) % 1;
      const mx = s.x + s.w * (0.15 + 0.7 * hash(i * 7.3 + s.x)) + Math.sin(t * 0.6 + i) * 4, my = h * (1 - k);
      ctx.fillStyle = `rgba(214,200,255,${(0.28 * Math.sin(k * Math.PI)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(mx, my, 0.8 + hash(i * 2.2 + s.x) * 1.1, 0, TAU);
      ctx.fill();
    }
  }
}

/** The still layer per size (the hero and the cards), with its frame and stalactites. */
const stills = new Map<string, { img: HTMLCanvasElement; f: Frame; drips: Stalactite[] }>();

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: GeodaProgress): void {
  const dpr = ctx.getTransform().a || 1;
  const hero = p !== undefined;
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}${hero ? ':hero' : ''}`;
  let still = stills.get(key);
  if (!still) {
    if (stills.size >= 4) stills.delete(stills.keys().next().value!);
    const f = frameFor(w, h, hero), drips = stalactites(f);
    still = { img: buildStill(w, h, dpr, f, drips), f, drips };
    stills.set(key, still);
  }
  const { img, f, drips } = still;
  ctx.drawImage(img, 0, 0, w, h);
  const { wall, cell, rim } = f;
  const cx = wall.x + wall.w / 2, top = wall.y - rim * GEODE_REACH;
  drawCaveLife(ctx, h, t, f, drips);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // the shaft of light from the crack
  const a = 0.11 + 0.03 * Math.sin(t * 0.9);
  const sg = ctx.createLinearGradient(0, top, 0, wall.y + wall.h);
  sg.addColorStop(0, `rgba(255,212,138,${(a * 2.2).toFixed(3)})`);
  sg.addColorStop(0.4, `rgba(255,212,138,${a.toFixed(3)})`);
  sg.addColorStop(1, 'rgba(255,212,138,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(cx - wall.w * 0.05, top);
  ctx.lineTo(cx + wall.w * 0.05, top);
  ctx.lineTo(cx + wall.w * 0.4, wall.y + wall.h);
  ctx.lineTo(cx - wall.w * 0.28, wall.y + wall.h);
  ctx.closePath();
  ctx.fill();
  // the full row, glowing before its harvest
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
  ctx.fillStyle = `rgba(236,206,255,${(0.08 + 0.07 * pulse).toFixed(3)})`;
  rrect(ctx, wall.x + 2, wall.y + GLOW_ROW * cell + 2, wall.w - 4, cell - 4, cell * 0.2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,240,255,${(0.3 + 0.25 * pulse).toFixed(3)})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // a glint across a lśniący crystal
  const ph = (t * 0.5) % 3;
  if (ph < 0.8) {
    const gx = wall.x + 3 * cell + ph / 0.8 * cell * 2.4 - cell * 0.2;
    const gl = ctx.createLinearGradient(gx - cell * 0.3, wall.y, gx + cell * 0.3, wall.y + cell * 2);
    gl.addColorStop(0, 'rgba(255,255,255,0)');
    gl.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    gl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(wall.x + 3 * cell, wall.y, cell * 2, cell * 2);
  }
  ctx.restore();
  // a drop from the crack onto the amethyst under it, every two seconds; the crystal's next cell
  // (to the right of it) swells a little with each drop
  const k = (t % 2) / 2;
  const grow = 0.35 + 0.5 * ((Math.floor(t / 2) % 4) + Math.max(0, (k - 0.6) / 0.4)) / 4;
  const nx = wall.x + 5 * cell, ny = wall.y;
  rrect(ctx, nx + 2, ny + 2, cell - 4, cell - 4, cell * 0.2);
  ctx.strokeStyle = `rgba(255,236,190,${(0.35 + 0.25 * Math.sin(t * 4)).toFixed(3)})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.globalAlpha = 0.45 + 0.4 * grow;
  tiles.drawScaled(ctx, 'gem', 0, 3, nx, ny, cell, grow);
  ctx.globalAlpha = 1;
  const fall = Math.max(0, (k - 0.35) / 0.25);
  const dy = top + rim * 1.2;
  ctx.fillStyle = 'rgba(205,228,255,0.92)';
  if (fall <= 0) {
    const r = 1 + 2.2 * (k / 0.35);
    ctx.beginPath();
    ctx.ellipse(cx, dy + r, r, r * 1.25, 0, 0, TAU);
    ctx.fill();
  } else if (fall < 1) {
    ctx.beginPath();
    ctx.ellipse(cx, dy + (wall.y + cell * 0.4 - dy) * fall * fall, 2.2, 3.4, 0, 0, TAU);
    ctx.fill();
  } else {
    const s = Math.min(1, (k - 0.6) / 0.3);
    ctx.strokeStyle = `rgba(205,228,255,${(0.6 * (1 - s)).toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, wall.y + cell * 0.4, 3 + s * cell * 0.7, (3 + s * cell * 0.7) * 0.35, 0, 0, TAU);
    ctx.stroke();
  }
  if (p) {
    // the player's finest specimen, floating in the middle of their geode
    const star = p.star ?? { m: 0, tier: 0, cm: 0 };
    const sz = wall.w * 0.42, sy = wall.y + wall.h * 0.5 + Math.sin(t * 1.1) * cell * 0.08;
    ctx.save();
    const veil = ctx.createRadialGradient(cx, sy, 0, cx, sy, wall.w * 0.62);
    veil.addColorStop(0, 'rgba(10,7,16,0.88)');
    veil.addColorStop(0.7, 'rgba(10,7,16,0.55)');
    veil.addColorStop(1, 'rgba(10,7,16,0)');
    ctx.fillStyle = veil;
    ctx.fillRect(wall.x - rim * 2, wall.y - rim * 2, wall.w + rim * 4, wall.h + rim * 4);
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, sy, 0, cx, sy, sz);
    glow.addColorStop(0, 'rgba(214,184,255,0.35)');
    glow.addColorStop(1, 'rgba(214,184,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - sz, sy - sz, sz * 2, sz * 2);
    ctx.globalCompositeOperation = 'source-over';
    drawSpecimen(ctx, cx, sy, sz, star.m, star.tier, t);
    for (let i = 0; i < 5; i++) {
      const ang = t * 0.4 + (i / 5) * TAU, rr = sz * (0.7 + 0.15 * hash(i));
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = `rgba(255,248,226,${(0.5 * tw).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(ang) * rr, sy + Math.sin(ang) * rr * 0.6, 1.2 + tw, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
