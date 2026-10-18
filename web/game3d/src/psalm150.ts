/**
 * "Psalm 150" for HolyHolyHoly 3D: the procedural soundtrack and sound effects of the 2D game
 * (web/game/src/audio — lyre, frame drum, flute and shofar, a piece per chapter, adaptive layers),
 * exposed as `window.Psalm150` for the GDevelop extension of the same name.
 *
 * Built into project/lib/psalm150.js by `npm run game3d:libs`; the extension lists that file as a
 * source file, so GDevelop includes it in previews and exports.
 *
 * Browsers start audio only from a user gesture, so the first pointer or key press unlocks it
 * (inside the gesture, which iOS requires); `unlock()` from events is only a fallback.
 */
import { createAudio } from '../../game/src/audio';
import { PRESETS } from '../../game/src/audio/psalm';
import type { MusicScene, SfxName } from '../../game/src/types';

const SCENES: ReadonlySet<string> = new Set<MusicScene>(['menu', 'battle', 'chapel', 'sabbath', 'boss', 'victory']);
const EFFECTS: ReadonlySet<string> = new Set<SfxName>([
  'eat', 'digest', 'shoot', 'hit', 'weaken', 'hurt', 'seed', 'grace', 'levelup', 'door', 'fragment', 'boss', 'revelation',
  'prayer_word', 'ultimate', 'bell', 'click', 'fall', 'rank', 'fire', 'flame', 'tier', 'combo',
]);

const finite = (x: number, fallback: number): number => (Number.isFinite(x) ? x : fallback);

export interface Psalm150Api {
  readonly unlocked: boolean;
  unlock(): void;
  /** `track`: a chapter id or 'menu'; `scene`: menu | battle | chapel | sabbath | boss | victory; `intensity` 0..1 */
  setMood(track: string, scene: string, intensity: number): void;
  /** `step`: scale step of melodic effects (combo length, flame number); `pan` -1..1 */
  sfx(name: string, step?: number, pan?: number, volume?: number): void;
  setVolumes(master: number, music: number, sfx: number): void;
  setMuted(muted: boolean): void;
  nextTrack(): void;
  nowPlaying(): string;
  /** the player's heart rate from the band (0 = none): a soft swell under the music */
  setHeartRate(bpm: number): void;
  /** silence everything (the tab is hidden); `resume` picks the music up where it was */
  suspend(): void;
  resume(): void;
}

export function createPsalm150(): Psalm150Api {
  const audio = createAudio();
  let moodKey = '';
  return {
    get unlocked() {
      return audio.unlocked;
    },
    unlock() {
      void audio.unlock();
    },
    setMood(track, scene, intensity) {
      const preset = PRESETS[track] ?? PRESETS.menu;
      const level = Math.min(1, Math.max(0, finite(intensity, 0.3)));
      const sceneId = (SCENES.has(scene) ? scene : 'battle') as MusicScene;
      // events may call this every frame: only pass on audible changes (intensity in 0.05 steps)
      const key = `${preset.id}|${sceneId}|${Math.round(level * 20)}`;
      if (key === moodKey) return;
      moodKey = key;
      audio.setMood({ track: preset.id, mode: preset.mode, realm: preset.realm, scene: sceneId, intensity: level });
    },
    sfx(name, step = 0, pan = 0, volume = 1) {
      if (!EFFECTS.has(name)) return;
      audio.sfx(name as SfxName, { step: Math.round(finite(step, 0)), pan: Math.min(1, Math.max(-1, finite(pan, 0))), volume: finite(volume, 1) });
    },
    setVolumes(master, music, sfx) {
      audio.setVolumes({ master: finite(master, 0.7), music: finite(music, 0.4), sfx: finite(sfx, 0.7) });
    },
    setMuted(muted) {
      audio.setMuted(Boolean(muted));
    },
    nextTrack() {
      audio.nextTrack();
    },
    nowPlaying() {
      return audio.nowPlaying;
    },
    setHeartRate(bpm) {
      audio.setHeartRate(bpm > 0 ? bpm : null);
    },
    suspend() {
      audio.suspend();
    },
    resume() {
      audio.resume();
    },
  };
}

/** Wires the API to the page: unlock on the first gesture, rest while the tab is hidden. */
export function install(target: typeof globalThis = globalThis): Psalm150Api {
  const api = createPsalm150();
  const unlockOnGesture = (): void => {
    api.unlock();
    for (const type of ['pointerdown', 'keydown']) target.removeEventListener?.(type, unlockOnGesture, { capture: true });
  };
  for (const type of ['pointerdown', 'keydown']) target.addEventListener?.(type, unlockOnGesture, { capture: true, passive: true });
  const doc = (target as { document?: Document }).document;
  doc?.addEventListener('visibilitychange', () => (doc.hidden ? api.suspend() : api.resume()));
  (target as { Psalm150?: Psalm150Api }).Psalm150 = api;
  return api;
}
