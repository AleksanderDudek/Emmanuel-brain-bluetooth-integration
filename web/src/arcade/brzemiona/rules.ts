/**
 * Every number of Brzemiona's rules in one place (DESIGN.md §18): the exchange at the Cross (what focus drives),
 * the breath, the rests, the blocks, the voice and the cards.  Tuning moves a number here and nowhere else; the
 * tests read the same object.
 *
 * A circle's `x` runs 0 → 1: the share of the burden's grey turned to light at the Cross and returned as peace.  It
 * grows **only from real concentration** (the series' rule, §18): in a sighted push past its lead-in, with a
 * reliable signal, while `frame.focused` — at about `needSec` seconds of focus a circle at the threshold, faster
 * above it and as the focus is held.  The rate reads the band's level **averaged over one whole breath** (≥ 10 s,
 * §18.4), so the light does not "breathe" with the Mayer wave a 5 · 5 breath strengthens.  Nothing grows in rest,
 * the lead-in, the warm-up, the finale, without a signal, below the threshold, or from taps; what is gained stays.
 */
import { clamp } from '../kit/juice';

export const RULES = {
  // ── the exchange (what focus drives) ───────────────────────────
  /** seconds of focus a circle takes at the threshold (a session of 3 minutes and more) */
  needSec: 28,
  /** shorter test sessions (under 3 minutes) scale the need down to this share at the least */
  needMinShare: 0.22,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)), `above` = (mean level − 0.5) / 0.5 */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the window the rate's level is averaged over (s): one whole breath at the least (§18.4) */
  meanSec: 10,
  /** focus during a burden's call or a widening (a push past its lead-in) starts the circle with up to this much */
  preMax: 0.2,
  /** what is shown follows the truth with this time constant (s): a breath's worth, so the picture never jumps */
  showTau: 2.5,
  /** the smoke waiting at the Cross: one puff of the burden at the most (the rest stays with them until it turns) */
  puff: 0.08,

  // ── the steps of a burden ──────────────────────────────────────
  /** the address ("Panie Jezu, przynoszę Ci…"): the new burden appears (s; inside the push's lead-in) */
  callSec: 4,
  /** a circle widens: more figures, or the night globe (s) */
  widenSec: 3,

  // ── the breath ─────────────────────────────────────────────────
  /** the rest after a circle: whole breaths nearest restTarget(T) s and at least restMin s (kit/breath.ts) */
  restMin: 8,
  /** the rest after a burden's last circle (left at the Cross) is this many breaths longer */
  leaveExtra: 1,
  restBreathsMax: 12,
  /**
   * The rest's rhythm in the lobby (round 15, kit/rhythm.ts): a rest after 1…restAfterMax circles turned (1 by design:
   * the founder's series rule, a rest after every circle) — with more, the light widens to the next circle, or the next
   * burden is called, within the same push after `onSec` of peace; and the rest's whole breaths (`restDef` by design
   * for 10 minutes, 1…restBreathsMax; taken when the player moved a dial).  `circleSec`: about how long a circle takes
   * an average player, lead-in included, for the lobby's count of rests.
   */
  restAfter: 1,
  restAfterMax: 3,
  restDef: 2,
  onSec: 1.4,
  circleSec: 40,
  /** peace held in a rest (calm at least this, a reliable signal) */
  calmAt: 0.5,

  // ── the session ────────────────────────────────────────────────
  /** the lead-in before the brain acts in a push block (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  telegraph: 4,
  /** the rest is announced when the circle is this far turned */
  telegraphX: 0.86,
  /** a push shorter than this is not judged (s) */
  minPush: 10,
  /** the safety valve: no light gained for valveStall s, or valveSec s in all while under telegraphX */
  valveSec: 150,
  valveStall: 60,
  /** the runner's banner covers the first seconds of a block: the narrator waits it out */
  bannerSec: 5,
  /** the first-ever session's warm-up (s): 30 in 5 minutes and more, 20 in 3, at most 6 in a test session */
  warm: { long: 30, short: 20, test: 6 },
  /** the quiet finale (s): everything left at the Cross */
  finale: { long: 16, short: 6 },
  settle: 4,
  minReliable: 8,
  /** the light turning this long (s) before the narrator says so; a sighted push without it this long: how it turns */
  goodSec: 5,
  waitSec: 10,

  // ── the hands ──────────────────────────────────────────────────
  /** a tap stays with them: their name and the prayer glow for this long (s) */
  reshowSec: 2.4,
  /** the chooser closes itself after this long untouched (s) */
  chooserIdle: 25,

  // ── cards and the voice ────────────────────────────────────────
  pageSec: 9,
  tapAfter: 0.6,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 2.6,
  hintGap: 1.2,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

/** The seconds of focus a circle takes in a session of `plannedSec` (the full need from 3 minutes on). */
export const needFor = (plannedSec: number): number => RULES.needSec * clamp(plannedSec / 180, RULES.needMinShare, 1);

/**
 * How far a session widens each burden: under 5 minutes the one (1), under 10 the one and the whole world (2), from
 * 10 minutes on the one, all who carry the same and the whole world (3).  Long sessions deepen, they don't stretch.
 */
export function depthFor(plannedSec: number): 1 | 2 | 3 {
  if (plannedSec < 300) return 1;
  if (plannedSec < 600) return 2;
  return 3;
}

/** The rest's target length after a circle (s): about 12 at 3 minutes, 15 at 5, 20 at 10, 30 at 30. */
export function restTargetFor(plannedSec: number): number {
  return 8 + 22 * Math.sqrt(clamp((plannedSec - 120) / 1680));
}

/**
 * How fast a circle turns per second for a frame: only while focused, faster above the threshold (the level
 * averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted push past its
 * lead-in with a reliable signal.)
 */
export function turnRate(meanLevel: number, focused: boolean, hold: number, need: number): number {
  if (!focused || need <= 0) return 0;
  const R = RULES;
  const above = clamp((meanLevel - 0.5) / 0.5);
  return ((R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, hold) / R.holdFull))) / need;
}

/**
 * A running mean over a window of seconds (the level over one whole breath, §18.4): samples in quarter-second bins,
 * so a 0.1 Hz wave (the Mayer wave, a 5 · 5 breath) averages out.  Pure.
 */
export class WindowMean {
  private readonly bins: number[] = [];
  private acc = 0;
  private accT = 0;
  private sum = 0;
  constructor(readonly sec: number, readonly bin = 0.25) {}

  push(v: number, dt: number): void {
    if (!(dt > 0) || !Number.isFinite(v)) return;
    this.acc += v * dt;
    this.accT += dt;
    while (this.accT >= this.bin) {
      const part = this.bin / this.accT;
      const val = (this.acc * part) / this.bin;
      this.acc -= this.acc * part;
      this.accT -= this.bin;
      this.bins.push(val);
      this.sum += val;
      if (this.bins.length > Math.round(this.sec / this.bin)) this.sum -= this.bins.shift()!;
    }
  }

  /** The mean so far (null before a whole bin). */
  get value(): number | null { return this.bins.length ? this.sum / this.bins.length : null; }

  /** Seconds of signal in the window. */
  get span(): number { return this.bins.length * this.bin; }

  reset(): void {
    this.bins.length = 0;
    this.acc = 0;
    this.accT = 0;
    this.sum = 0;
  }
}
