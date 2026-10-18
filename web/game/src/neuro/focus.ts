/**
 * Focus — "Czuwajcie i módlcie się" (Mt 26,41). Concentration charges something the player can
 * use: the Fire of the Spirit in battle, and the prayers of the heart that open new paths.
 *
 * Every tick brings a focus level 0..1 and where it came from:
 *   band  — prefrontal activation from the Mendi band (counts even while the angel moves)
 *   voice — the short invocation recognised aloud (prayer screen)
 *   still — standing still / not touching anything: the fallback everybody has
 *
 * Holding focus at or above THRESHOLD builds a streak, and the streak raises the multiplier
 * (×1 → ×1.5 → ×2 → ×3). Each source caps the multiplier — stillness ×1.5, voice ×2, the band ×3 —
 * which is what the band adds; it never takes anything away. Dropping below the threshold keeps
 * the streak for GRACE seconds, then the multiplier steps down one tier at a time, never
 * straight back to ×1.
 */

export type FocusSource = 'band' | 'voice' | 'still' | 'none';

export const THRESHOLD = 0.55;
export const TIERS: readonly { mult: number; after: number }[] = [
  { mult: 1, after: 0 },
  { mult: 1.5, after: 8 },
  { mult: 2, after: 18 },
  { mult: 3, after: 32 },
];
/** highest tier index each source can reach */
export const SOURCE_CAP: Readonly<Record<FocusSource, number>> = { band: 3, voice: 2, still: 1, none: 0 };
/** seconds below the threshold before the multiplier starts to step down */
export const GRACE = 2.5;
const STEP_DOWN = 2.5;
const SMOOTH_TAU = 0.6;

export interface FocusReading { level: number; source: FocusSource }

export interface FocusState {
  /** smoothed focus 0..1, for the meter */
  level: number;
  source: FocusSource;
  /** at or above the threshold (or still within the grace period) */
  focused: boolean;
  /** progress clock of the multiplier (pinned at tier starts; see `held` for the time actually held) */
  streak: number;
  /** seconds of focus held without a real break (for the report and the lifetime record) */
  held: number;
  tier: number;
  mult: number;
  /** progress toward the next tier, 0..1 (1 once this source's cap is reached) */
  toNext: number;
  /** set on the tick the multiplier went up */
  tierUp: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class FocusCharger {
  private level = 0;
  private streak = 0;
  private held = 0;
  private below = 0;
  private stepT = 0;
  /** seconds spent focused only through a source below the current tier (a dip of the band while standing still) */
  private weakT = 0;
  private tier = 0;

  update(dt: number, r: FocusReading): FocusState {
    const target = Number.isFinite(r.level) ? clamp01(r.level) : 0;
    this.level += (target - this.level) * (1 - Math.exp(-dt / SMOOTH_TAU));
    const cap = SOURCE_CAP[r.source];
    const prev = this.tier;
    const stepDown = () => {
      this.stepT += dt;
      if (this.stepT < STEP_DOWN) return;
      this.stepT = 0;
      this.tier = Math.max(0, this.tier - 1);
      this.streak = TIERS[this.tier].after;   // climbing back starts from the tier kept
    };
    if (this.level >= THRESHOLD) {
      this.below = 0;
      this.held += dt;
      if (this.tier < cap) {
        this.stepT = 0;
        this.weakT = 0;
        this.streak += dt;
        while (this.tier < cap && this.streak >= TIERS[this.tier + 1].after) this.tier++;
      } else {
        // focused only through a weaker source (the band dipped, stillness holds): forgiven for GRACE seconds,
        // then progress toward the next tier fades and, above this source's cap, the tier eases down
        this.weakT += dt;
        if (this.weakT > GRACE) {
          if (this.tier > cap) stepDown();
          else {
            this.stepT = 0;
            this.streak = TIERS[this.tier].after;   // nothing is banked at the cap: a better source earns the next tier itself
          }
        }
      }
    } else {
      this.below += dt;
      if (this.below > GRACE) {
        this.held = 0;
        stepDown();
      }
    }
    const next = TIERS[this.tier + 1];
    const toNext = this.level < THRESHOLD || this.tier > cap ? 0
      : !next || this.tier >= cap ? 1 : clamp01((this.streak - TIERS[this.tier].after) / (next.after - TIERS[this.tier].after));
    return {
      level: this.level,
      source: r.source,
      focused: this.level >= THRESHOLD || this.below <= GRACE && this.streak > 0,
      streak: this.streak,
      held: this.held,
      tier: this.tier,
      mult: TIERS[this.tier].mult,
      toNext,
      tierUp: this.tier > prev,
    };
  }

  reset(): void {
    this.level = 0;
    this.streak = 0;
    this.held = 0;
    this.below = 0;
    this.stepT = 0;
    this.weakT = 0;
    this.tier = 0;
  }
}

/**
 * Charge produced per second, in units of the base rate: focused time charges fully (a little more
 * for deeper focus) times the multiplier; below the threshold a small trickle, so effort still counts.
 */
export function chargeFactor(s: FocusState): number {
  if (s.level >= THRESHOLD) return (0.75 + 0.25 * (s.level - THRESHOLD) / (1 - THRESHOLD)) * s.mult;
  return 0.25 * (s.level / THRESHOLD);
}

/** Focus from the band: activation above its usual level (0.5) reads as concentration. */
export function bandFocus(activation: number | null): number {
  return activation === null ? 0 : clamp01((activation - 0.3) / 0.5);
}
