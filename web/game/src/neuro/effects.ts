/**
 * How the prefrontal cortex shapes the game (see DESIGN.md §8).
 *
 * fNIRS is slow (the haemodynamic response peaks ~10 s after the effort), so
 * the band never drives twitch actions — it nudges slow quantities:
 *   activation ↑ in battle  → the Spirit meter charges faster (up-regulation)
 *   hemispheric balance      → the Peace aura grows
 *   activation ↓ in Sabbath  → rest restores faster (down-regulation)
 *   balance held ≥ 8 s       → a revelation can strike the stronghold
 * Without the band (or while its signal is unreliable) the same quantities
 * come from stillness, so the game is fully playable and nobody is punished.
 */
import type { BalancePause, Recommendation } from '../../../src/core/types';
import type { External } from '../sim/world';

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
  /** heart rate for the halo pulse and the chant's heartbeat swell */
  heartBpm: number | null;
  /** how much of the current Spirit / Peace / rest comes from the band (0..1, for the HUD) */
  bandSpirit: number;
  bandPeace: number;
  bandRest: number;
  bandActive: boolean;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const SPIRIT_STILL = 2.5;     // points/s while standing still
export const SPIRIT_MOVING = 0.6;
export const SPIRIT_BAND_MAX = 0.75; // ≈ +30 % on top of stillness at full focus
export const REST_BASE = 0.2;        // hearts/s while resting (1 heart / 5 s)
export const REST_BAND_MAX = 0.3;    // up to +30 % with deep calm
const PEACE_TAU = 1.5;
const REVELATION_STREAK = 8;

export class NeuroEffects {
  private peace = 0;
  private revelationHold = 0;

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

    // Spirit: stillness (prayer) charges it; prefrontal engagement adds a bonus in battle
    const engaging = g.phase === 'battle' || g.phase === 'boss';
    const focus = band && engaging && n.activation !== null ? clamp01((n.activation - 0.5) / 0.3) : 0;
    const spiritRate = (g.still > 0.12 ? SPIRIT_STILL : SPIRIT_MOVING) + SPIRIT_BAND_MAX * focus;

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
      spiritRate,
      restRate,
      revelation: this.revelationHold > 0.5,
      heartBpm: n.source === 'band' && n.heartRate ? n.heartRate : null,
      bandSpirit: focus,
      bandPeace: band ? bandPeace : 0,
      bandRest: calm,
      bandActive: band,
    };
  }

  reset(): void {
    this.peace = 0;
    this.revelationHold = 0;
  }
}
