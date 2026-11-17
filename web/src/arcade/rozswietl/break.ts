/**
 * A tile breaking slowly (DESIGN §13.7; the founder, 2026-11-17: "wolniejszy rozpad" — a slower disintegration),
 * without the canvas: when a tile bursts, its cracks first run across the whole of it, from where the light pressed to
 * the border (RULES.breakCrack s); then its pieces loosen and fall away one after another — the nearest to that point
 * first — each falling for RULES.breakFall s, so the bright picture under it shows through piece by piece.  A tile
 * takes about 1.6–2.5 s from the burst to its last piece gone.  The view (render.ts) draws the pieces as pooled sprites
 * and reads the timing from here; the tests read it too.
 */
import { RULES } from './rules';

export interface BreakPiece {
  /** seconds after the burst at which the piece loosens and begins to fall */
  start: number;
  /** how long it falls (s), fading to motes at the end */
  life: number;
}

export interface BreakPlan {
  /** the crack phase (s): the cracks run across the tile, every piece still in place */
  crack: number;
  pieces: BreakPiece[];
  /** from the burst to the last piece gone (s) */
  total: number;
}

/** The seconds between two pieces loosening for a tile of `k` pieces: never more than the whole spread. */
export const breakStagger = (k: number): number => Math.min(RULES.breakStagger, RULES.breakSpread / Math.max(1, k - 1));

/**
 * The timing of a tile's `k` pieces, already ordered (the nearest to where the light pressed first): each loosens a
 * stagger after the one before (±20 %), falls for RULES.breakFall s.  `rnd` in [0, 1).
 */
export function breakPlan(k: number, rnd: () => number): BreakPlan {
  const n = Math.max(1, Math.round(k));
  const step = breakStagger(n);
  const [lo, hi] = RULES.breakFall;
  const pieces: BreakPiece[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    // jitter within ±20 % of a step, never before the piece ahead of it, never past the spread
    const start = RULES.breakCrack + Math.min(RULES.breakSpread, Math.max(0, i * step + (rnd() - 0.5) * 0.4 * step));
    // a single piece (a tile over the cap of falling pieces, or reduced motion) fades a little longer
    const life = (lo + rnd() * (hi - lo)) * (n === 1 ? 1.35 : 1);
    pieces.push({ start, life });
    total = Math.max(total, start + life);
  }
  return { crack: RULES.breakCrack, pieces, total };
}

/** How many pieces a burst of `shards` gets (4–9), as many as the cap of falling pieces still allows (≥ 1). */
export function pieceCount(shards: number, falling: number): number {
  const want = Math.max(4, Math.min(9, Math.round(4 + shards / 3)));
  const room = RULES.breakCap - falling;
  return room >= want ? want : room >= 3 ? room : 1;
}
