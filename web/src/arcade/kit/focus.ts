/**
 * What an arcade game reads from the band (DESIGN.md §9): the focus training's activity %
 * (src/training/meter.ts) turned into game-ready quantities —
 *
 *   level    0..1, smooth, 0.5 at the threshold (speeds, light, charge rates)
 *   focused  above the threshold, short dips forgiven ("is the player focusing now")
 *   hold     seconds of the current focused stretch (Mendi's "Control")
 *   calm     0..1, how clearly below the threshold (rest and let-go phases); unlike 1 − level
 *            it fades to 0 too when the signal fails, so bad data never counts as rest
 *
 * The threshold follows the player: it moves so that about `targetRate` of the reliable time
 * lies above it — the auto-threshold of clinical neurofeedback, which keeps the reward rate where
 * people keep learning — but never sinks below `floor` (+1 % over the session's reference, the
 * training's "elevated"), so a reward always means a real rise.  Unreliable ticks (motion, contact,
 * a new baseline) neither move the threshold nor count, and after a short gap the brain-driven
 * quantities ease back to neutral: bad data never pushes the game either way.
 *
 * Blood pressure's Mayer waves (~0.1 Hz, one swing every ~10 s) pass the pipeline's 0.5 Hz
 * low-pass and look like control.  So `level` and `calm` are smoothed over ~2 s, leaving the
 * focused state needs a drop of `hysteresis` below the threshold, and dips up to `grace` are
 * forgiven: a held focus is not chopped into pieces by the pulse of the blood pressure.
 */

export interface FocusTuning {
  /** lowest and highest threshold, and where it starts (activity %) */
  floor: number;
  ceil: number;
  start: number;
  /** share of the reliable time the threshold aims to keep above it */
  targetRate: number;
  /** how fast the threshold moves (activity % per second) */
  adapt: number;
  /** a dip shorter than this keeps `focused` and the hold (s) */
  grace: number;
  /** leaving the focused state needs activity this far below the threshold (activity %) */
  hysteresis: number;
  /** logistic width of `level` and `calm` (activity %) */
  width: number;
  /** smoothing of `level` and `calm` (s) */
  tau: number;
  /** an unreliable stretch shorter than this keeps the picture (s); longer ones fade to neutral */
  gap: number;
  /** how much a block judge leans toward the player on either side (RoundJudge) */
  judgeBias: number;
}

export const DEFAULT_TUNING: FocusTuning = {
  floor: 1, ceil: 15, start: 2, targetRate: 0.6, adapt: 0.25, grace: 3, hysteresis: 1.5, width: 2.5, tau: 2, gap: 2, judgeBias: 0.1,
};

export interface FocusFrame {
  /** the signal can be used right now */
  reliable: boolean;
  /** activity % against the session's reference (the last reliable reading; null before the first one) */
  activity: number | null;
  /** the adaptive threshold (activity %) */
  threshold: number;
  level: number;
  focused: boolean;
  hold: number;
  calm: number;
}

/**
 * The first sessions lean toward the player (Barbero 2010: positive bias helps near-chance users and
 * should fade) while somebody has fewer than BEGINNER_SESSIONS: a lower floor, and block judges that
 * lean further toward the player.  The share of time above the threshold stays the game's own:
 * moving it would make focus blocks easier only by making rest blocks harder.
 */
export const BEGINNER_SESSIONS = 3;
export const BEGINNER_TUNING: Partial<FocusTuning> = { floor: 0.5, start: 1, judgeBias: 0.15 };

export const NEUTRAL_FRAME: FocusFrame = { reliable: false, activity: null, threshold: DEFAULT_TUNING.start, level: 0, focused: false, hold: 0, calm: 0 };

const logistic = (v: number) => 1 / (1 + Math.exp(-v));

export class FocusInput {
  threshold: number;
  private level = 0;
  private calm = 0;
  private hold = 0;
  private below = Infinity;
  private gapSec = 0;
  private activity: number | null = null;
  /** reliable seconds, and how many of them were above the threshold (the reward rate) */
  reliableSec = 0;
  aboveSec = 0;

  constructor(readonly tune: FocusTuning = DEFAULT_TUNING) {
    this.threshold = tune.start;
  }

  /** One hub tick: the session's activity % (null = none yet), whether it is usable, and the tick's length. */
  push(activity: number | null, reliable: boolean, dt: number): FocusFrame {
    const t = this.tune;
    const ok = reliable && activity !== null && Number.isFinite(activity) && dt > 0;
    let wantLevel: number, wantCalm: number;
    if (ok) {
      this.gapSec = 0;
      this.activity = activity;
      const above = activity >= this.threshold;
      this.reliableSec += dt;
      if (above) this.aboveSec += dt;
      // a quantile tracker: it settles where the share of time above it equals targetRate
      this.threshold += (above ? 1 - t.targetRate : -t.targetRate) * t.adapt * dt;
      this.threshold = Math.min(t.ceil, Math.max(t.floor, this.threshold));
      // hysteresis: once focused, only a clear drop below the threshold counts as leaving
      const holding = this.below <= t.grace ? activity >= this.threshold - t.hysteresis : above;
      if (holding) {
        this.below = 0;
        this.hold += dt;
      } else this.breakHold(dt);
      wantLevel = logistic((activity - this.threshold) / t.width);
      wantCalm = 1 - wantLevel;
    } else {
      this.gapSec += dt;
      this.breakHold(dt);
      const keep = this.gapSec < t.gap;
      wantLevel = keep ? this.level : 0;
      wantCalm = keep ? this.calm : 0;
    }
    const a = t.tau > 0 && dt > 0 ? 1 - Math.exp(-dt / t.tau) : 1;
    this.level += a * (wantLevel - this.level);
    this.calm += a * (wantCalm - this.calm);
    return this.frame(ok);
  }

  private breakHold(dt: number): void {
    this.below += dt;
    if (this.below > this.tune.grace) this.hold = 0;
  }

  private frame(reliable: boolean): FocusFrame {
    return {
      reliable, activity: this.activity, threshold: this.threshold, level: this.level,
      focused: this.below <= this.tune.grace, hold: this.hold, calm: this.calm,
    };
  }

  /** Share of the reliable time spent above the threshold so far (0..1; null before any). */
  get rewardRate(): number | null {
    return this.reliableSec > 0 ? this.aboveSec / this.reliableSec : null;
  }
}

/**
 * Judges a round once, at its end, the way fNIRS neurofeedback protocols do (the Tübingen rule:
 * enough of the last 15 s on the asked side of the threshold).  One verdict per round, from its
 * end, so the haemodynamic lag at its start does not count against the player.
 *
 * "Enough" depends on the side.  The adaptive threshold keeps the signal above it `base` of the
 * time anyway (FocusInput.targetRate), so a fixed share would pass focus rounds and fail rest
 * rounds by chance.  A focus round needs `base − bias` of the window above, a rest round
 * `1 − base − bias` below: without control either passes about two times in three (the
 * motivating reward rate of the literature), and real control passes it nearly always.
 */
export class RoundJudge {
  /** 1 = on the asked side, 0 = not, per reliable tick */
  private ticks: { ok: 0 | 1; dt: number }[] = [];
  private want: 'focus' | 'rest' = 'focus';

  constructor(readonly windowSec = 15, readonly base = DEFAULT_TUNING.targetRate, readonly bias = DEFAULT_TUNING.judgeBias) {}

  /** A judge that matches the session's tuning (its share of time above the threshold, and a beginner's bias). */
  static from(t: FocusTuning, windowSec = 15): RoundJudge {
    return new RoundJudge(windowSec, t.targetRate, t.judgeBias);
  }

  /** The share of the window a round asking for `want` needs (never below half of its side's base rate). */
  need(want: 'focus' | 'rest'): number {
    const side = want === 'focus' ? this.base : 1 - this.base;
    return Math.max(side / 2, side - this.bias);
  }

  /** `want` = what the round asks for: 'focus' (above the threshold) or 'rest' (below it). */
  push(want: 'focus' | 'rest', f: FocusFrame, dt: number): void {
    if (want !== this.want) {
      this.want = want;
      this.ticks = [];   // a new kind of round: the window starts over
    }
    if (!f.reliable || f.activity === null) return;
    const above = f.activity >= f.threshold;
    this.ticks.push({ ok: (want === 'focus' ? above : !above) ? 1 : 0, dt });
    let sec = 0;
    for (let i = this.ticks.length - 1; i >= 0; i--) {
      sec += this.ticks[i].dt;
      if (sec > this.windowSec) {
        this.ticks.splice(0, i);
        break;
      }
    }
  }

  /** Share of the window on the asked side (0..1), and whether the window holds enough data to judge. */
  get share(): number {
    let ok = 0, all = 0;
    for (const t of this.ticks) { all += t.dt; ok += t.ok * t.dt; }
    return all > 0 ? ok / all : 0;
  }

  get measured(): number { return this.ticks.reduce((s, t) => s + t.dt, 0); }

  /** The verdict: enough of the window on the asked side (a round without reliable data is no failure: null). */
  verdict(): boolean | null {
    if (this.measured < Math.min(5, this.windowSec / 3)) return null;
    return this.share >= this.need(this.want);
  }

  reset(): void { this.ticks = []; }
}

/**
 * Activity per phase of a block design (focus blocks against rest blocks), for games that ask the
 * player to alternate.  The first `lagSec` of each block are skipped: the haemodynamic response
 * needs seconds to turn, so they would blur the contrast.  The contrast (mean focus − mean rest) is
 * the measure fNIRS studies use, and it is immune to slow drift of the reference.
 */
export class BlockContrast {
  private sum = { focus: 0, rest: 0 };
  private sec = { focus: 0, rest: 0 };

  constructor(readonly lagSec = 4) {}

  /** `inBlockSec` = seconds since the current block began. */
  push(kind: 'focus' | 'rest', activity: number | null, reliable: boolean, inBlockSec: number, dt: number): void {
    if (!reliable || activity === null || !Number.isFinite(activity) || inBlockSec < this.lagSec) return;
    this.sum[kind] += activity * dt;
    this.sec[kind] += dt;
  }

  mean(kind: 'focus' | 'rest'): number | null {
    return this.sec[kind] > 0 ? this.sum[kind] / this.sec[kind] : null;
  }

  /** Mean focus − mean rest (activity %), null until both kinds were measured. */
  get contrast(): number | null {
    const f = this.mean('focus'), r = this.mean('rest');
    return f === null || r === null ? null : f - r;
  }
}
