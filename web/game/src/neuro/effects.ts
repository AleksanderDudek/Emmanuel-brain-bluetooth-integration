/**
 * How the prefrontal cortex shapes the game (see DESIGN.md §8).
 *
 * fNIRS is slow (the haemodynamic response peaks ~10 s after the effort), so
 * the band never drives twitch actions — it drives slow quantities:
 *   focus (activation ↑)     → charges the Fire of the Spirit; held focus multiplies it (×1.5/×2/×3)
 *   hemispheric balance      → the Peace aura grows
 *   activation ↓ in Sabbath  → rest restores faster (down-regulation)
 *   balance held ≥ 8 s       → a revelation can strike the stronghold
 * Without the band (or while its signal is unreliable) the same quantities
 * come from stillness, so the game is fully playable and nobody is punished;
 * the band only adds (focus while moving, a higher multiplier).
 */
import type { BalancePause, Recommendation } from '../../../src/core/types';
import type { External } from '../sim/world';
import { bandFocus, chargeFactor, FocusCharger, THRESHOLD, type FocusReading, type FocusState } from './focus';

export interface NeuroState {
  source: 'band' | 'none';
  connected: boolean;
  streaming: boolean;
  /** signal usable right now: baseline ready, contact fine, no motion, data fresh */
  reliable: boolean;
  baselineProgress: number;
  baselineReady: boolean;
  /** prefrontal activation relative to the last minute, 0..1 (0.5 = usual) */
  activation: number | null;
  /** smoothed hemispheric asymmetry, 0..1 (0.5 = balanced) */
  asymmetry: number | null;
  balanced: boolean;
  balanceStreak: number;
  recommendation: Recommendation | null;
  heartRate: number | null;
  motion: boolean;
  paused: BalancePause | null;
}

export const NO_BAND: NeuroState = {
  source: 'none', connected: false, streaming: false, reliable: false, baselineProgress: 0, baselineReady: false,
  activation: null, asymmetry: null, balanced: false, balanceStreak: 0, recommendation: null, heartRate: null, motion: false, paused: null,
};

export type Phase = 'battle' | 'boss' | 'sabbath' | 'chapel' | 'menu';

export interface Effects extends External {
  /** heart rate for the halo pulse and the music's heartbeat swell */
  heartBpm: number | null;
  /** live focus for the HUD meter: level, source, streak multiplier */
  focus: FocusState;
  /** how much of the current Peace / rest comes from the band (0..1, for the HUD) */
  bandPeace: number;
  bandRest: number;
  bandActive: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** flames per second of focused time at ×1 (one flame ≈ 24 s); the multiplier and depth of focus scale it */
export const FIRE_BASE = 1 / 24;
/** focus read from stillness: the praying posture, and the angel on the move */
export const STILL_FOCUS = 0.62;
export const MOVING_FOCUS = 0.12;
export const REST_BASE = 0.2;        // hearts/s while resting (1 heart / 5 s)
export const REST_BAND_MAX = 0.3;    // up to +30 % with deep calm
const PEACE_TAU = 1.5;
const REVELATION_STREAK = 8;

export class NeuroEffects {
  private peace = 0;
  private revelationHold = 0;
  private readonly charger = new FocusCharger();

  update(dt: number, n: NeuroState, g: { still: number; phase: Phase }): Effects {
    const band = n.source === 'band' && n.reliable;
    const stillPeace = clamp01(g.still / 3);

    // Peace aura: balance from the band or stillness — whichever is higher (the band only adds)
    let bandPeace = 0;
    if (band && n.asymmetry !== null) {
      bandPeace = n.balanced ? clamp01(0.6 + n.balanceStreak / 20) : 0.6 * clamp01(1 - Math.abs(n.asymmetry - 0.5) / 0.25);
    }
    const target = Math.max(stillPeace, bandPeace);
    this.peace += (target - this.peace) * (1 - Math.exp(-dt / PEACE_TAU));

    // Focus charges the Fire: the band counts even on the move; stillness (prayer) is everyone's fallback
    const focus = this.charger.update(dt, focusReading(band ? bandFocus(n.activation) : null, g.still > 0.12));
    const fireRate = g.phase === 'menu' ? 0 : FIRE_BASE * chargeFactor(focus);

    // Sabbath: lowering activation (resting the prefrontal cortex) deepens the rest
    const calm = band && g.phase === 'sabbath' && n.activation !== null ? clamp01((0.5 - n.activation) / 0.3) : 0;
    const restRate = REST_BASE * (1 + REST_BAND_MAX * calm);

    // Revelation: sustained balance (band) or deep stillness and peace — either opens it
    if (g.phase === 'boss') {
      const ready = (band && n.balanced && n.balanceStreak >= REVELATION_STREAK) || (g.still >= 3 && this.peace >= 0.85);
      this.revelationHold = ready ? this.revelationHold + dt : 0;
    } else {
      this.revelationHold = 0;
    }

    return {
      peace: this.peace,
      fireRate,
      restRate,
      revelation: this.revelationHold > 0.5,
      heartBpm: n.source === 'band' && n.heartRate ? n.heartRate : null,
      focus,
      bandPeace: band ? bandPeace : 0,
      bandRest: calm,
      bandActive: band,
    };
  }

  /** A new room keeps the focus streak (concentration carries on); a new chapter (`full`) starts it afresh. */
  reset(full = false): void {
    this.peace = 0;
    this.revelationHold = 0;
    if (full) this.charger.reset();
  }
}

/**
 * Where this tick's focus comes from. The band wins once it reads as focused (it then also counts
 * while moving and can reach ×3); otherwise standing still is focus (×1.5 at most). The level is
 * the better of the two, so wearing the band never lowers anything.
 */
export function focusReading(band: number | null, still: boolean): FocusReading {
  const stillLevel = still ? STILL_FOCUS : MOVING_FOCUS;
  if (band !== null && band >= THRESHOLD) return { level: Math.max(band, stillLevel), source: 'band' };
  if (still) return { level: Math.max(stillLevel, band ?? 0), source: 'still' };
  return band !== null ? { level: Math.max(band, stillLevel), source: 'band' } : { level: stillLevel, source: 'none' };
}
