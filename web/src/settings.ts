/** User settings persisted in IndexedDB (survive reloads and app updates). */
import type { SessionDB } from './storage/db';
import type { StorageTarget } from './storage/format';
import type { BalanceConfig, FNIRSConfig } from './core/types';

export interface AppSettings {
  storageTarget: StorageTarget;
  fnirsConfig?: Partial<FNIRSConfig>;
  balanceConfig?: Partial<BalanceConfig>;
  recordingDurationSec: number;
}

const KEY = 'app_settings';
export const DEFAULT_SETTINGS: AppSettings = { storageTarget: 'browser', recordingDurationSec: 600 };

export async function loadSettings(db: SessionDB): Promise<AppSettings> {
  return { ...DEFAULT_SETTINGS, ...((await db.getSetting<AppSettings>(KEY)) ?? {}) };
}

export async function saveSettings(db: SessionDB, s: AppSettings): Promise<void> {
  await db.setSetting(KEY, s);
}
