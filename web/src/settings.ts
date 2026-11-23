/** User settings persisted in IndexedDB (survive reloads and app updates). */
import type { SessionDB } from './storage/db';
import type { StorageTarget } from './storage/format';
import type { BalanceConfig, FNIRSConfig } from './core/types';
import type { Tool } from './tools';
import type { SavedRhythm } from './arcade/kit/rhythm';

export type SceneId = 'hills' | 'dunes' | 'snow' | 'space';

/**
 * The session lengths the player can choose, in minutes — the same list for the focus training, every arcade
 * game and the exercise cards' games (the founder, 2026-11-22: "3/5/10/15/20/25/30 min sessions").
 */
export const SESSION_MINUTES = [3, 5, 10, 15, 20, 25, 30] as const;
export type SessionMinutes = (typeof SESSION_MINUTES)[number];
/** The longest session in seconds (also the cap of the `?trainingSec=` override). */
export const MAX_SESSION_SEC = SESSION_MINUTES[SESSION_MINUTES.length - 1] * 60;

/** A saved length as one of SESSION_MINUTES: the nearest one (an old save's 1 or 2 min becomes 3), else the fallback. */
export function sessionMinutes(v: unknown, fallback: SessionMinutes = 5): SessionMinutes {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return SESSION_MINUTES.reduce((best, m) => (Math.abs(m - n) < Math.abs(best - n) ? m : best), SESSION_MINUTES[0]);
}

/** The planned seconds of a session: `?trainingSec=N` (tests and demos, ≥ 10 s, at most the longest length) or the chosen minutes. */
export function plannedSeconds(minutes: number, search: string = typeof location !== 'undefined' ? location.search : ''): number {
  const override = Number(new URLSearchParams(search).get('trainingSec'));
  return Number.isFinite(override) && override >= 10 ? Math.min(MAX_SESSION_SEC, override) : minutes * 60;
}

export interface TrainingPrefs {
  minutes: SessionMinutes;
  breathwork: boolean;
  scene: SceneId;
  glow: boolean;
  /** the view zooms out when the curve leaves it */
  zoom: boolean;
  /** points, activity and control on screen */
  hud: boolean;
  sound: boolean;
  chime: boolean;
  /** 0..1 */
  volume: number;
  mood: boolean;
}

/** The arcade games' shared preferences (src/arcade). */
export interface ArcadePrefs {
  minutes: SessionMinutes;
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** short vibrations on phones that have them */
  haptics: boolean;
  /** the signal dock under the game: the band's chart and what it means, in plain words */
  signal: boolean;
  /** the rest's rhythm each game's player set in its lobby (kit/rhythm.ts), by game id; a game not here plays as designed */
  rhythm?: Record<string, SavedRhythm>;
}

export interface AppSettings {
  storageTarget: StorageTarget;
  fnirsConfig?: Partial<FNIRSConfig>;
  balanceConfig?: Partial<BalanceConfig>;
  recordingDurationSec: number;
  /** null until the user picks a headband */
  tool: Tool | null;
  /** the source to resume on start (the band needs a click, so it resumes as "off") */
  simulator: Record<Tool, boolean>;
  training: TrainingPrefs;
  arcade: ArcadePrefs;
}

const KEY = 'app_settings';
export const DEFAULT_TRAINING: TrainingPrefs = {
  minutes: 5, breathwork: true, scene: 'hills', glow: true, zoom: true, hud: true, sound: true, chime: true, volume: 0.5, mood: true,
};
export const DEFAULT_ARCADE: ArcadePrefs = { minutes: 5, sound: true, volume: 0.6, haptics: true, signal: true };
export const DEFAULT_SETTINGS: AppSettings = {
  storageTarget: 'browser', recordingDurationSec: 600, tool: null, simulator: { fnirs: false, eeg: false }, training: DEFAULT_TRAINING,
  arcade: DEFAULT_ARCADE,
};

export async function loadSettings(db: SessionDB): Promise<AppSettings> {
  const saved = (await db.getSetting<Partial<AppSettings>>(KEY)) ?? {};
  // settings from before the tool switch: the app was fNIRS-only and started on the simulator
  const legacy = Object.keys(saved).length > 0 && !('tool' in saved);
  return {
    ...DEFAULT_SETTINGS, ...saved,
    tool: saved.tool ?? (legacy ? 'fnirs' : null),
    simulator: { ...DEFAULT_SETTINGS.simulator, ...(legacy ? { fnirs: true } : {}), ...saved.simulator },
    training: { ...DEFAULT_TRAINING, ...saved.training, minutes: sessionMinutes(saved.training?.minutes, DEFAULT_TRAINING.minutes) },
    arcade: { ...DEFAULT_ARCADE, ...saved.arcade, minutes: sessionMinutes(saved.arcade?.minutes, DEFAULT_ARCADE.minutes) },
  };
}

export async function saveSettings(db: SessionDB, s: AppSettings): Promise<void> {
  await db.setSetting(KEY, s);
}
