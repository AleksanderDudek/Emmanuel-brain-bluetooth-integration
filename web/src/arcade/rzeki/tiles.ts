/**
 * The glass of each station, piece by piece (the founder's "kafelki"): how a station's fill (0 → 1) opens its
 * pieces, for every kind of station (content.ts `StationKind`).  Pure numbers, shared by the session (sim.ts: a
 * glass tick per piece, its sound and sparkle) and the view (render.ts: what is drawn open).
 *
 *   point     a rose window: the oculus at once, the inner petals one by one (the first 30 %), then the outer ones
 *   shell     its keystone window (the first quarter), then the egg's segments from the apex down both sides
 *             (going down) or from the bottom up (going up), two at a time
 *   channels  the sun and the moon (the first 12 %), then the three lancets pane by pane, all three together
 *   ring      the Void's segments, two at a time, from the top round to the bottom (or from the bottom up)
 *   bone      the sacrum's five bands of glass, one after another; its spiral draws itself with the fill
 *   hands     the hand map in its numbers' order on both hands: 1 the wrist, 2 the thumb, 3 the middle, 4 the
 *             little finger, 5 the index, 6 the ring finger, 7 the palm
 *   feet      on both feet: the instep, then the toes from the big toe to the little one
 */
import { HAND_ORDER, STATION, type Rose, type StationId } from './content';
import { RULES } from './rules';

const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** The egg's segments of a shell, the panes of a channel, the Void's segments, the sacrum's bands. */
export const SHELL_SEGS = 24;
export const CHANNEL_PANES = 8;
export const RING_SEGS = 16;
export const BONE_BANDS = 5;
/** The keystone's share of a shell's fill, the medallions' share of the channels'. */
export const KEYSTONE = 0.25;
export const MEDALLIONS = 0.12;

/** How far a rose window has opened at a fill: its inner ring first, then the outer petals (fractional counts). */
export function roseOpen(rose: Rose, fill: number): { oculus: number; inner: number; outer: number } {
  const f = clamp(fill);
  return {
    oculus: Math.min(1, f * 12),
    inner: clamp(f / RULES.innerShare) * rose.inner,
    outer: clamp((f - RULES.innerShare) / (1 - RULES.innerShare)) * rose.outer,
  };
}

/** How many glass ticks a station has in all (a petal, a segment pair, a pane row, a band, a part of the hands or feet). */
export function tileTotal(s: StationId): number {
  const st = STATION[s];
  switch (st.kind) {
    case 'point': return st.rose.inner + st.rose.outer;
    case 'shell': return st.rose.inner + st.rose.outer + SHELL_SEGS / 2;
    case 'channels': return 2 + CHANNEL_PANES;
    case 'ring': return RING_SEGS / 2;
    case 'bone': return BONE_BANDS;
    case 'hands': return HAND_ORDER.length;
    case 'feet': return 6;
  }
}

/** The ticks of a station's glass that are whole at a fill (fractional: the next one opening). */
export function tilesAt(s: StationId, fill: number): number {
  const st = STATION[s], f = clamp(fill);
  switch (st.kind) {
    case 'point': {
      const o = roseOpen(st.rose, f);
      return o.inner + o.outer;
    }
    case 'shell': {
      const o = roseOpen(st.rose, clamp(f / KEYSTONE));
      return o.inner + o.outer + clamp((f - KEYSTONE) / (1 - KEYSTONE)) * (SHELL_SEGS / 2);
    }
    case 'channels': return clamp(f / MEDALLIONS) * 2 + clamp((f - MEDALLIONS) / (1 - MEDALLIONS)) * CHANNEL_PANES;
    default: return f * tileTotal(s);
  }
}

/** The whole ticks open at a fill (the glass's sound and sparkle count them). */
export const tilesOpen = (s: StationId, fill: number): number => Math.floor(tilesAt(s, fill) + 1e-9);

/**
 * A station's share of light for each of its pieces in a row (0 waiting … 1 lit), for the pieces filled one
 * after another: `n` pieces over the fill from `from` to `to` (each piece filling from its base outward).
 */
export function pieceK(fill: number, i: number, n: number, from = 0, to = 1): number {
  const f = clamp((fill - from) / Math.max(1e-9, to - from)) * n;
  return clamp(f - i);
}
