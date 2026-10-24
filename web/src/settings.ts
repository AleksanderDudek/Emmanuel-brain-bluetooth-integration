/** User settings persisted in IndexedDB (survive reloads and app updates). */
import type { SessionDB } from './storage/db';
import type { StorageTarget } from './storage/format';
import type { BalanceConfig, FNIRSConfig } from './core/types';
import type { Tool } from './tools';

export type SceneId = 'hills' | 'dunes' | 'snow' | 'space';

export interface TrainingPrefs {
  minutes: 3 | 5 | 10 | 15;
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
  minutes: 3 | 5 | 10;
  sound: boolean;
  /** 0..1 */
  volume: number;
  /** short vibrations on phones that have them */
  haptics: boolean;
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
export const DEFAULT_ARCADE: ArcadePrefs = { minutes: 5, sound: true, volume: 0.6, haptics: true };
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
    training: { ...DEFAULT_TRAINING, ...saved.training },
    arcade: { ...DEFAULT_ARCADE, ...saved.arcade },
  };
}

export async function saveSettings(db: SessionDB, s: AppSettings): Promise<void> {
  await db.setSetting(KEY, s);
}
