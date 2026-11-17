/**
 * The "what to do now" line (the clarity rule of 2026-11-17), without the canvas: one short line at the frame's top —
 * an icon and a few words — for the action the moment asks: tap a tile (the warm-up), focus (a push), focus by feel (a
 * blind push), release the flare or focus so that it can go, rest and breathe (gazing), settle (the finale).  None
 * while a card waits (its button says what to do).  It changes only when the action does, and only once the new one
 * has held RULES.nowSettle s (a flicker of focus never makes it jump).
 */
import { RULES } from './rules';
import type { RozSim } from './sim';

export type NowKind = 'warm' | 'push' | 'blind' | 'flare' | 'flareWait' | 'rest' | 'finale';

/** The drawn icon of each action. */
export type NowIcon = 'tap' | 'light' | 'veil' | 'flare' | 'breath' | 'end';

export const NOW_ICON: Record<NowKind, NowIcon> = {
  warm: 'tap', push: 'light', blind: 'veil', flare: 'flare', flareWait: 'flare', rest: 'breath', finale: 'end',
};

/** What the moment asks of the player, or null (before play, under a card, after the end). */
export function nowKind(s: Pick<RozSim, 'started' | 'phase' | 'block' | 'cardUp' | 'flareReady' | 'held' | 'pic'>): NowKind | null {
  // nothing to do but look while a transformed picture blooms (the firefly says the place's line), then its card
  if (!s.started || s.cardUp || s.phase === 'done' || s.pic?.state === 'bloom') return null;
  if (s.phase === 'finale') return 'finale';
  const b = s.block;
  if (b.kind === 'warmup') return 'warm';
  if (b.kind === 'rest') return 'rest';
  if (b.blind) return 'blind';
  if (s.flareReady) return s.held ? 'flare' : 'flareWait';
  return 'push';
}

/** The line on screen: it follows `nowKind`, but a change waits until the new action has held RULES.nowSettle s. */
export class NowLine {
  kind: NowKind | null = null;
  /** seconds the current kind has been shown */
  t = 0;
  private cand: NowKind | null = null;
  private candT = 0;

  update(dt: number, want: NowKind | null): void {
    this.t += dt;
    if (want === this.kind) {
      this.cand = null;
      return;
    }
    // from nothing (a card closed, play began) or to nothing (a card came): at once
    if (want === null || this.kind === null) {
      this.set(want);
      return;
    }
    if (want !== this.cand) {
      this.cand = want;
      this.candT = 0;
    }
    this.candT += dt;
    if (this.candT >= RULES.nowSettle) this.set(want);
  }

  private set(k: NowKind | null): void {
    this.kind = k;
    this.t = 0;
    this.cand = null;
    this.candT = 0;
  }
}
