import { describe, expect, it } from 'vitest';
import { BREATH_DEFAULT, breathAt } from '../src/arcade/kit/breath';
import { breathGuideBox, breathGuideRadius, breathOf, breathWords, drawBreathGuide } from '../src/arcade/kit/breathguide';
import {
  blockRhythm, breathDial, clampDial, rhythmOf, restsIn, scaledBlock, secDial, stepDial, REST_SETTLE,
} from '../src/arcade/kit/rhythm';
import { pacerState } from '../src/arcade/pacer';
import { CATALOGS } from '../src/i18n/rhythm';
import { catalogProblems } from '../src/i18n';

describe('kit/rhythm', () => {
  const spec = blockRhythm({ focus: 40, rest: 20 }, { focus: 'Czujność', rest: 'Drzemka' }, 'note');

  it('keeps a dial on whole steps inside its range; anything unreadable is the default', () => {
    const d = secDial(40);
    expect(clampDial(d, 43)).toBe(45);
    expect(clampDial(d, 7)).toBe(d.min);
    expect(clampDial(d, 500)).toBe(d.max);
    expect(clampDial(d, 'x')).toBe(40);
    expect(clampDial(d, NaN)).toBe(40);
    expect(stepDial(d, d.max, 1)).toBe(d.max);
    expect(stepDial(d, 40, -1)).toBe(35);
  });

  it('reads the saved choice per game, clamped, and says when it differs from the design', () => {
    expect(rhythmOf(undefined, { focus: 60 })).toBeNull();
    expect(rhythmOf(spec, undefined)).toEqual({ focus: 40, rest: 20, custom: false });
    expect(rhythmOf(spec, { focus: 61, rest: 3 })).toEqual({ focus: 60, rest: 10, custom: true });
    expect(rhythmOf(spec, { focus: 40, rest: 20 })!.custom).toBe(false);
    expect(rhythmOf(spec, 'junk')).toEqual({ focus: 40, rest: 20, custom: false });
  });

  it('scales a block plan\'s jitter with the player\'s mean', () => {
    expect(scaledBlock([26, 4], 52)).toEqual([52, 8]);
    expect(scaledBlock([20, 3], 20)).toEqual([20, 3]);
    expect(scaledBlock([20, 3], NaN)).toEqual([20, 3]);
  });

  it('counts the rests of a session and their share of it', () => {
    expect(restsIn(spec, { focus: 40, rest: 20 }, 300)).toEqual({ rests: 5, share: 1 / 3 });
    expect(restsIn(spec, { focus: 100, rest: 20 }, 1800)!.rests).toBe(15);
    expect(restsIn({ ...spec, focusSec: undefined }, { focus: 40, rest: 20 }, 300)).toBeNull();
  });

  it('names values in the game\'s words: seconds, and whole breaths with their seconds', () => {
    expect(spec.focus.format(40)).toMatch(/^40 s$/);
    const b = breathDial(2, 'Odpoczynek', 10);
    expect(b.format(2)).toContain('20');
    expect(b.format(1)).toMatch(/1 \S+/);
    expect(REST_SETTLE).toBe(15);
  });
});

describe('kit/breathguide and the runner\'s pacer', () => {
  it('names the four phases and the breath count in the page\'s language', () => {
    const w = breathWords();
    expect(Object.values(w).every(s => s.length > 0)).toBe(true);
    expect(breathOf(2, 3)).toContain('2');
  });

  it('recommends a ring from 26 px on a phone to 60 px on a big screen', () => {
    expect(breathGuideRadius(360, 640)).toBe(26);
    expect(breathGuideRadius(3840, 2160)).toBe(60);
  });

  it('draws on a canvas without throwing, and its box holds the ring', () => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return;   // happy-dom without a canvas backend
    const o = { cx: 100, cy: 100, r: 30, sub: breathOf(1, 2) };
    const box = breathGuideBox(ctx, o);
    expect(box.x).toBeLessThanOrEqual(70);
    expect(box.y).toBeLessThanOrEqual(70);
    expect(box.w).toBeGreaterThanOrEqual(60);
    for (const t of [0, 3, 4.5, 9]) drawBreathGuide(ctx, breathAt(BREATH_DEFAULT, t), o);
  });

  it('counts the default breath from the rest\'s start, and which breath of how many', () => {
    const s = pacerState(1, 19, null);
    expect(s.b.phase).toBe('in');
    expect(s.n).toBe(1);
    expect(s.of).toBe(2);
    const later = pacerState(12, 8, null);
    expect(later.n).toBe(2);
    expect(later.of).toBe(2);
    expect(pacerState(5, null, null).of).toBeNull();
    // a game's own breath on another pattern is shown as it is, without a count
    const own = breathAt({ in: 5, holdIn: 0, out: 5, holdOut: 0 }, 6);
    expect(pacerState(6, 10, own)).toMatchObject({ b: own, of: null });
    // a game's own breath that is the default from the rest's start keeps the count
    const same = breathAt(BREATH_DEFAULT, 12);
    expect(pacerState(12, 8, same)).toMatchObject({ b: same, n: 2, of: 2 });
  });

  it('has every text in all four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });
});
