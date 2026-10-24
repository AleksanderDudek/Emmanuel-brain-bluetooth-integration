/**
 * The lobby's picture and the game card: a daylight glasshouse where butterflies flutter — the
 * player's own (up to 12 of the newest, from their stored wings) in the lobby, a few generic ones on
 * the card.  The glasshouse is painted once per size; wings are painted lazily, two per frame, and the
 * flock is kept between frames, so a frame of the lobby allocates nothing once it is painted.
 * Also the tiny pictures of the Atlas tiles: the butterfly and caterpillar cards and the recipe.
 */
import { mulberry32 } from '../../core/random';
import { reducedMotion } from '../kit/juice';
import { SPECIES, speciesById, type Species } from './content';
import { drawButterfly, drawSilhouette, paintButterfly, spriteOfRecord, wingMidY, type ButterflySprite } from './butterfly';
import { buildLeaf } from './leaf';
import type { AtlasEntry, ButterflyRec, MothProgress } from './meta';
import { canvas, ctx2d, dotSprite, drawCaterpillar, remember, rgba } from './paint';
import { paintGlasshouse } from './scenery';
import { scribble } from './wing';

const houses = new Map<string, HTMLCanvasElement>();
const lastHouse = { w: 0, h: 0, dpr: 0, c: null as HTMLCanvasElement | null };
let still: boolean | undefined;

/** The glasshouse at a size (the lobby's hero and the cards differ; a few sizes are kept). */
function house(w: number, h: number, dpr: number): HTMLCanvasElement {
  if (lastHouse.c && lastHouse.w === w && lastHouse.h === h && lastHouse.dpr === dpr) return lastHouse.c;
  const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
  let c = houses.get(key);
  if (!c) {
    c = canvas(w * dpr, h * dpr);
    const x = ctx2d(c);
    x.scale(dpr, dpr);
    paintGlasshouse(x, w, h, 0);
    remember(houses, key, c, 4);
  }
  Object.assign(lastHouse, { w, h, dpr, c });
  return c;
}

/** A butterfly of the glasshouse: its sprite, its species, its wingspan. */
interface Flier { s: ButterflySprite; sp: Species; mm: number }

const GENERIC = ['pawik', 'cytrynek', 'paz', 'ikar', 'zorzynek'];
const GENERIC_MM = [56, 54, 72, 30, 42];
/** where the card's butterflies sit (fractions of its size) */
const CARD_SPOTS: [number, number][] = [[0.22, 0.4], [0.47, 0.22], [0.7, 0.38], [0.86, 0.2]];
let generic: Flier[] | null = null;

function genericFliers(): Flier[] {
  generic ??= GENERIC.map((id, i) => {
    const sp = speciesById(id), rng = mulberry32(101 + i * 7);
    const s = paintButterfly({
      species: sp, path: scribble(rng, 260), box: buildLeaf(sp.plant).box, pigments: sp.classic, depth: 0.85,
      bold: i % 2 === 0, radiant: i === 2, aberration: null, female: false,
    }, 120);
    return { s, sp, mm: GENERIC_MM[i] };
  });
  return generic;
}

/** The player's newest 12 butterflies, newest first, and those of them painted so far (kept between frames). */
const flock = { of: null as ButterflyRec[] | null, n: -1, last: -1, px: 0, recs: [] as ButterflyRec[], fliers: [] as Flier[] };

function playerFliers(p: MothProgress, px: number): Flier[] {
  const all = p.butterflies, last = all.length ? all[all.length - 1].id : -1;
  if (flock.of !== all || flock.n !== all.length || flock.last !== last || flock.px !== px) {
    Object.assign(flock, { of: all, n: all.length, last, px, recs: all.slice(-12).reverse() });
    flock.fliers.length = 0;
  }
  // a couple of new wings per frame keeps the lobby smooth
  for (let k = 0; k < 2 && flock.fliers.length < flock.recs.length; k++) {
    const rec = flock.recs[flock.fliers.length];
    flock.fliers.push({ s: spriteOfRecord(rec, px), sp: speciesById(rec.sp), mm: rec.mm });
  }
  return flock.fliers;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: MothProgress): void {
  // the callers scale the context to the canvas: its width tells the device pixel ratio
  const dpr = ctx.canvas.width / w || 1;
  ctx.drawImage(house(w, h, dpr), 0, 0, w, h);
  const px = Math.min(160, Math.max(60, Math.min(w, h) * 0.14 * dpr));
  const fliers = p && p.butterflies.length ? playerFliers(p, px) : genericFliers();
  const count = p ? fliers.length : Math.min(4, fliers.length);
  // half-wingspan: from the shorter side, but a wide banner (a card) gets larger butterflies too, and
  // a young glasshouse with only a few of them shows them closer
  const few = count <= 2 ? 1.4 : count <= 5 ? 1.15 : 1;
  const base = Math.max(Math.min(w, h) * 0.075, Math.min(w * 0.035, h * 0.2)) * few;
  still ??= reducedMotion();
  for (let i = 0; i < count; i++) {
    const { s, sp, mm } = fliers[i], k = 1 + 0.13 * i;
    let x = w * (0.5 + 0.38 * Math.sin(t * 0.17 * k + i * 1.7) * Math.cos(t * 0.05 + i));
    let y = h * (0.3 + 0.17 * Math.sin(t * 0.23 * k + i * 2.3));
    let dx = Math.cos(t * 0.17 * k + i * 1.7);
    if (!p) {
      // the card: a still, so a composed flight across the glasshouse with a little drift
      const spot = CARD_SPOTS[i % CARD_SPOTS.length];
      x = w * (spot[0] + 0.02 * Math.sin(t * 0.7 + i));
      y = h * (spot[1] + 0.03 * Math.sin(t * 0.9 + i * 2));
      dx = (i % 2 ? 1 : -1) * 0.6;
    }
    const open = still ? 0.8 + 0.2 * Math.abs(Math.cos(t * 1.2 + i)) : 0.28 + 0.72 * Math.abs(Math.cos(t * (5.5 + (i % 3)) + i));
    const size = base * Math.max(0.6, Math.min(1.5, mm / 50));
    drawButterfly(ctx, s, x, y - wingMidY(sp) * size + Math.sin(t * 6 + i) * 2, size, open, dx * 0.25);
  }
}

const plainSprites = new Map<string, ButterflySprite>();

/** A species' own look without an eaten path: a tile's butterfly once its stored records are gone. */
function plainSprite(sp: Species, px: number): ButterflySprite {
  const key = `${sp.id}:${Math.round(px)}`;
  let s = plainSprites.get(key);
  if (!s) {
    s = paintButterfly({ species: sp, path: [], box: buildLeaf(sp.plant).box, pigments: sp.classic, depth: 0.8, bold: false, radiant: false, aberration: null, female: false }, px);
    plainSprites.set(key, s);
  }
  return s;
}

/** the caterpillar card's little larva in a tile's lower left (head first), and a caterpillar-only tile's larva */
const MINI_LARVA = Array.from({ length: 7 }, (_, i) => ({ x: 15.5 - i * 2, y: 35 + Math.sin(i * 0.9 + 0.6) * 0.9 }));
const TILE_LARVA = Array.from({ length: 9 }, (_, i) => ({ x: 38 - i * 3.4, y: 18 + Math.sin(i * 0.8) * 2.2 }));

/**
 * An Atlas tile's picture (52×40 CSS px).  Once a butterfly emerged: the butterfly card (the biggest
 * stored one, or the species' own look), the caterpillar card as a small larva in the lower left, and
 * the classic recipe as three dots in the lower right, faint until the classic form is earned.  Before
 * that: the caterpillar alone (with the recipe) once one hatched, else a silhouette.
 */
export function drawTile(c: HTMLCanvasElement, sp: Species, e: AtlasEntry | undefined, rec: ButterflyRec | null): void {
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio || 1) : 1;
  c.width = 52 * dpr;
  c.height = 40 * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  if (e && e.n > 0) {
    const size = 15, s = rec ? spriteOfRecord(rec, 44 * dpr) : plainSprite(sp, 44 * dpr);
    drawButterfly(ctx, s, 28, 16 - wingMidY(sp) * size, size, 1, 0);
    drawCaterpillar(ctx, MINI_LARVA, 2.3, sp.larva, 0, 0, 0, MINI_LARVA.length, dpr);
  } else if (e?.larva) {
    drawCaterpillar(ctx, TILE_LARVA, 4.2, sp.larva, 0, 0, 0, TILE_LARVA.length, dpr);
  } else {
    drawSilhouette(ctx, sp, 26, 20 - wingMidY(sp) * 15, 15, rgba('#9A8F78', 0.32));
    return;
  }
  ctx.globalAlpha = e.classic ? 1 : 0.4;
  sp.classic.forEach((pigment, k) => {
    const d = dotSprite(pigment, 2.6 * dpr);
    ctx.drawImage(d, 38 + k * 6 - d.width / dpr / 2, 35 - d.height / dpr / 2, d.width / dpr, d.height / dpr);
  });
  ctx.globalAlpha = 1;
}

/** The species of the Atlas in display order (habitat, then tier). */
export const atlasOrder = (habitat: string): Species[] => SPECIES.filter(s => s.habitat === habitat).sort((a, b) => a.tier - b.tier);
