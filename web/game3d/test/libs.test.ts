import { describe, expect, it } from 'vitest';
import { createMendiFocus } from '../src/mendi-focus';
import { createPsalm150, install as installPsalm } from '../src/psalm150';

describe('Psalm150 (the soundtrack for GDevelop)', () => {
  it('is safe to call before audio is unlocked and with bad input', () => {
    const audio = createPsalm150();
    expect(audio.unlocked).toBe(false);
    expect(() => {
      audio.setMood('malkut', 'battle', 0.4);
      audio.setMood('no-such-track', 'no-such-scene', Number.NaN);
      audio.sfx('combo', 3, 0.5);
      audio.sfx('not-an-effect', Number.NaN, 9);
      audio.setVolumes(Number.NaN, 0.4, 2);
      audio.setMuted(true);
      audio.nextTrack();
      audio.setHeartRate(0);
      audio.suspend();
      audio.resume();
    }).not.toThrow();
  });

  it('names the piece of each chapter', () => {
    const audio = createPsalm150();
    audio.setMood('keter', 'battle', 0.5);
    expect(audio.nowPlaying()).toContain('Keter');
    audio.setMood('unknown', 'menu', 0.1);
    expect(audio.nowPlaying()).toContain('Drzewo Życia');
  });

  it('publishes window.Psalm150 and unlocks on the first gesture', () => {
    const target = new EventTarget() as unknown as typeof globalThis;
    const api = installPsalm(target);
    expect((target as unknown as { Psalm150: unknown }).Psalm150).toBe(api);
  });
});

describe('MendiFocus (the focus multiplier for GDevelop)', () => {
  it('without the band, standing still is focus and reaches ×1.5, never more', () => {
    const focus = createMendiFocus();
    expect(focus.supported()).toBe(false);
    expect(focus.status()).toBe('unsupported');
    for (let t = 0; t < 60; t += 0.1) focus.update(0.1, true);
    expect(focus.focused()).toBe(true);
    expect(focus.source()).toBe('still');
    expect(focus.multiplier()).toBe(1.5);
    expect(focus.chargeFactor()).toBeGreaterThan(1);
    expect(focus.held()).toBeGreaterThan(50);
  });

  it('moving lets the multiplier step down gently, and reset starts afresh', () => {
    const focus = createMendiFocus();
    let rose = false;
    for (let t = 0; t < 20; t += 0.1) {
      focus.update(0.1, true);
      rose ||= focus.tierUp();
    }
    expect(rose).toBe(true);
    focus.update(1, false);
    expect(focus.multiplier()).toBe(1.5); // a short break is forgiven
    for (let t = 0; t < 20; t += 0.1) focus.update(0.1, false);
    expect(focus.multiplier()).toBe(1);
    expect(focus.chargeFactor()).toBeLessThan(0.25);
    focus.reset();
    expect(focus.level()).toBe(0);
    expect(focus.held()).toBe(0);
  });

  it('ignores a bad delta and reports nothing from a band that is not there', () => {
    const focus = createMendiFocus();
    focus.update(-5, true);
    expect(focus.level()).toBe(0);
    expect(focus.heartRate()).toBe(0);
    expect(focus.baselineProgress()).toBe(0);
    expect(focus.error()).toBe('');
    expect(() => focus.connect()).not.toThrow();
    expect(() => focus.disconnect()).not.toThrow();
  });
});
