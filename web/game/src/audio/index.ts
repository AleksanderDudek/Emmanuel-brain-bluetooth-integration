/**
 * HolyHolyHoly audio: the game soundtrack ("Psalm 150": lyre, frame drum, tambourine, finger
 * cymbals, flute and shofar over a drone, a piece per chapter), procedural Gregorian and
 * Byzantine chant, church bells and sound effects — synthesised live with the Web Audio API, no
 * samples, no network, fully offline.
 *
 * Nothing touches Web Audio until `unlock()` (browsers let an AudioContext start only from a user
 * gesture). Before that, every method just records the desired state (soundscape, mood, volumes,
 * mute, heart rate, variations), applied on unlock; effects and the invocation are dropped. Safe
 * to import and call in Node.
 *
 * psalm.ts writes the soundtrack's pieces and arranger.ts plays them bar by bar; chant.ts
 * generates psalm-tone phrases; composer.ts turns soundscape and mood into timed cues; engine.ts
 * owns the graph and the lookahead loop; instruments.ts renders the instruments' notes, pool.ts
 * caches and plays them; voice.ts (choir), bells.ts, reverb.ts and sfx.ts make the other sounds;
 * scheduler.ts and rng.ts are shared helpers.
 */
import type { AudioApi, ChantMode, MusicMood, MusicScene, SoundscapeId } from '../types';
import { clamp, type Realm } from './chant';
import { Engine, type EngineState } from './engine';
import { nowPlayingLabel, PRESETS } from './psalm';

/** Quiet music under clearly audible effects; the game's save defaults use the same values. */
export const DEFAULT_VOLUMES: Readonly<{ master: number; music: number; sfx: number }> = { master: 0.7, music: 0.4, sfx: 0.7 };
export const DEFAULT_SOUNDSCAPE: SoundscapeId = 'psalm';

type AudioContextClass = new () => AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  const g = globalThis as { AudioContext?: AudioContextClass; webkitAudioContext?: AudioContextClass };
  return g.AudioContext ?? g.webkitAudioContext;
}

const unit = (x: number): number => (Number.isFinite(x) ? clamp(x, 0, 1) : 0);

const SOUNDSCAPES: ReadonlySet<string> = new Set<SoundscapeId>(['psalm', 'gregorianski', 'bizantyjski', 'dzwony', 'cisza']);
const SCENES: ReadonlySet<string> = new Set<MusicScene>(['menu', 'battle', 'chapel', 'sabbath', 'boss', 'victory']);
const REALMS: ReadonlySet<string> = new Set<Realm>(['heaven', 'earth', 'hell']);
const MODES: ReadonlySet<number> = new Set<ChantMode>([1, 2, 3, 4, 5, 6, 7, 8]);

/**
 * A mood the engine can trust: intensity within 0–1, a known mode and realm, and — for a caller
 * that does not send them yet — a track (the chapter piece in that mode and realm; the menu's
 * when calm in Heaven's mode 8) and a scene (from the intensity).
 */
export function normaliseMood(m: Partial<MusicMood>): MusicMood {
  const mode = MODES.has(m.mode ?? 0) ? (m.mode as ChantMode) : 1;
  const realm = REALMS.has(m.realm ?? '') ? (m.realm as Realm) : 'earth';
  const intensity = unit(m.intensity ?? 0.3);
  const track = typeof m.track === 'string' && m.track
    ? m.track
    : mode === 8 && realm === 'heaven' && intensity < 0.2
      ? 'menu'
      : (Object.values(PRESETS).find(p => p.id !== 'menu' && p.mode === mode && p.realm === realm)?.id ?? 'menu');
  const scene: MusicScene = SCENES.has(m.scene ?? '')
    ? (m.scene as MusicScene)
    : track === 'menu' ? 'menu' : intensity >= 0.85 ? 'boss' : intensity <= 0.06 ? 'sabbath' : intensity < 0.2 ? 'chapel' : 'battle';
  return { mode, intensity, realm, track, scene };
}

/** WebKit can leave ctx.resume() pending for good; never let that block the game (see `kick` below). */
const RESUME_WAIT_MS = 1000;
const within = (p: Promise<void>, ms: number): Promise<void> => Promise.race([p, new Promise<void>(r => setTimeout(r, ms))]);
const pageHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

export function createAudio(): AudioApi {
  const state: EngineState = {
    soundscape: DEFAULT_SOUNDSCAPE,
    mood: { mode: 8, intensity: 0.12, realm: 'heaven', track: 'menu', scene: 'menu' },
    volumes: { ...DEFAULT_VOLUMES },
    muted: false,
    heartRate: null,
    variations: Object.create(null) as Record<string, number>,
  };
  let engine: Engine | null = null;
  const variation = (track: string): number => state.variations[track] ?? 0;

  return {
    get unlocked() {
      return engine !== null;
    },
    get nowPlaying() {
      return nowPlayingLabel(state.soundscape, state.mood.track, variation(state.mood.track));
    },
    async unlock() {
      if (!engine) {
        const Context = audioContextClass();
        if (!Context) return;
        try {
          engine = new Engine(new Context(), state);
        } catch {
          return; // no usable audio on this device: stay silent
        }
        // iOS/Safari may leave the context suspended or 'interrupted' after the screen was locked or a call
        // came in, and resume() outside a gesture may not take: try again on the player's next touch or key
        const kick = (): void => {
          if (engine && !pageHidden() && engine.ctx.state !== 'running') void engine.resume();
        };
        for (const type of ['pointerdown', 'keydown']) globalThis.addEventListener?.(type, kick, { capture: true, passive: true });
      }
      await within(engine.resume(), RESUME_WAIT_MS);
    },
    setSoundscape(id) {
      state.soundscape = SOUNDSCAPES.has(id) ? id : DEFAULT_SOUNDSCAPE;
      engine?.setSoundscape(state.soundscape);
    },
    setMood(mood) {
      state.mood = normaliseMood(mood);
      engine?.setMood(state.mood);
    },
    playInvocation() {
      engine?.invocation();
    },
    sfx(name, opts) {
      engine?.playSfx(name, opts ?? {});
    },
    setVolumes(v) {
      state.volumes = { master: unit(v.master), music: unit(v.music), sfx: unit(v.sfx) };
      engine?.applyLevels();
    },
    setMuted(muted) {
      state.muted = muted;
      engine?.applyLevels();
    },
    setHeartRate(bpm) {
      state.heartRate = bpm !== null && Number.isFinite(bpm) && bpm > 0 ? clamp(bpm, 35, 200) : null;
      engine?.setHeartRate(state.heartRate);
    },
    nextTrack() {
      if (state.soundscape === 'psalm') state.variations[state.mood.track] = variation(state.mood.track) + 1;
      engine?.nextTrack();
    },
    suspend() {
      engine?.suspend();
    },
    resume() {
      void engine?.resume();
    },
  };
}
