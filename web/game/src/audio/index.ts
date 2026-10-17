/**
 * HolyHolyHoly audio: procedural Gregorian and Byzantine chant, church bells and sound effects,
 * synthesised live with the Web Audio API — no samples, no network, fully offline.
 *
 * Nothing touches Web Audio until `unlock()` (browsers let an AudioContext start only from a user
 * gesture). Before that, every method just records the desired state (soundscape, mood, volumes,
 * mute, heart rate), applied on unlock; effects and the invocation are dropped. Safe to import
 * and call in Node.
 *
 * chant.ts generates psalm-tone phrases; composer.ts turns soundscape and mood into timed cues;
 * engine.ts owns the graph and the lookahead loop; voice.ts (choir), bells.ts, reverb.ts and
 * sfx.ts make the sounds; scheduler.ts and rng.ts are shared helpers.
 */
import type { AudioApi } from '../types';
import { clamp } from './chant';
import { Engine, type EngineState } from './engine';

type AudioContextClass = new () => AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  const g = globalThis as { AudioContext?: AudioContextClass; webkitAudioContext?: AudioContextClass };
  return g.AudioContext ?? g.webkitAudioContext;
}

const unit = (x: number): number => (Number.isFinite(x) ? clamp(x, 0, 1) : 0);

/** WebKit can leave ctx.resume() pending for good; never let that block the game (see `kick` below). */
const RESUME_WAIT_MS = 1000;
const within = (p: Promise<void>, ms: number): Promise<void> => Promise.race([p, new Promise<void>(r => setTimeout(r, ms))]);
const pageHidden = (): boolean => typeof document !== 'undefined' && document.hidden;

export function createAudio(): AudioApi {
  const state: EngineState = {
    soundscape: 'gregorianski',
    mood: { mode: 1, intensity: 0.3, realm: 'earth' },
    volumes: { master: 1, music: 0.8, sfx: 0.8 },
    muted: false,
    heartRate: null,
  };
  let engine: Engine | null = null;

  return {
    get unlocked() {
      return engine !== null;
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
      state.soundscape = id;
      engine?.setSoundscape(id);
    },
    setMood(mood) {
      state.mood = { ...mood, intensity: unit(mood.intensity) };
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
    suspend() {
      engine?.suspend();
    },
    resume() {
      void engine?.resume();
    },
  };
}
