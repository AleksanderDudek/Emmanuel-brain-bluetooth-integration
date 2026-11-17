import { describe, expect, it } from 'vitest';
import {
  BREATH_DEFAULT, BREATH_MAX, BREATH_PRESETS, breathAt, breathCycle, breathDigits, breathOk, breathRest, breathRestOf,
  cleanBreath, sameBreath, stepBreath,
} from '../src/arcade/kit/breath';

describe('kit/breath — a configurable breath and rests of whole breaths', () => {
  it('the default is in 4, out 6 (10 s) and the presets are valid', () => {
    expect(breathCycle(BREATH_DEFAULT)).toBe(10);
    for (const p of Object.values(BREATH_PRESETS)) expect(breathOk(p)).toBe(true);
    expect(breathDigits(BREATH_PRESETS.box)).toBe('4 · 4 · 4 · 4');
  });

  it('cleans anything saved into 0…15 whole seconds; a cycle under 2 s gives the default', () => {
    expect(cleanBreath({ in: 3.6, holdIn: -2, out: 99, holdOut: '2' })).toEqual({ in: 4, holdIn: 0, out: BREATH_MAX, holdOut: 2 });
    expect(cleanBreath({ in: 0, holdIn: 0, out: 1, holdOut: 0 })).toEqual(BREATH_DEFAULT);
    expect(cleanBreath(null)).toEqual(BREATH_DEFAULT);
    expect(cleanBreath('x')).toEqual(BREATH_DEFAULT);
    expect(cleanBreath({ in: 0, holdIn: 15, out: 0, holdOut: 0 })).toEqual({ in: 0, holdIn: 15, out: 0, holdOut: 0 });
  });

  it('steps a phase and keeps it in range', () => {
    expect(stepBreath(BREATH_DEFAULT, 'holdIn', 1).holdIn).toBe(1);
    expect(stepBreath(BREATH_DEFAULT, 'in', -9).in).toBe(0);
    expect(stepBreath(BREATH_DEFAULT, 'out', 20).out).toBe(15);
    expect(sameBreath(stepBreath(BREATH_DEFAULT, 'in', 0), BREATH_DEFAULT)).toBe(true);
  });

  it('walks the phases in order, skipping those of 0 s, with the lungs filling and emptying', () => {
    const box = BREATH_PRESETS.box;
    expect(breathAt(box, 0).phase).toBe('in');
    expect(breathAt(box, 2).k).toBeCloseTo(0.5, 5);
    expect(breathAt(box, 5)).toMatchObject({ phase: 'holdIn', k: 1 });
    expect(breathAt(box, 9).phase).toBe('out');
    expect(breathAt(box, 13)).toMatchObject({ phase: 'holdOut', k: 0, n: 0 });
    expect(breathAt(box, 16)).toMatchObject({ phase: 'in', n: 1 });
    // the default never shows a hold
    for (let t = 0; t < 30; t += 0.25) expect(['in', 'out']).toContain(breathAt(BREATH_DEFAULT, t).phase);
    expect(breathAt(BREATH_DEFAULT, 3).left).toBeCloseTo(1, 5);
    // a pattern with no in-breath begins with the first phase that has a length
    expect(breathAt({ in: 0, holdIn: 3, out: 3, holdOut: 0 }, 0).phase).toBe('holdIn');
  });

  it('a rest is a whole number of breaths near its target, never under its minimum', () => {
    expect(breathRest(BREATH_DEFAULT, 26)).toEqual({ cycles: 3, sec: 30 });
    expect(breathRest(BREATH_PRESETS.box, 26)).toEqual({ cycles: 2, sec: 32 });
    expect(breathRest(BREATH_PRESETS.relax, 26, 12)).toEqual({ cycles: 1, sec: 19 });
    expect(breathRest({ in: 2, holdIn: 0, out: 2, holdOut: 0 }, 6, 12)).toEqual({ cycles: 3, sec: 12 });
    expect(breathRest(BREATH_DEFAULT, 1)).toEqual({ cycles: 1, sec: 10 });
    expect(breathRestOf(BREATH_PRESETS.box, 3)).toEqual({ cycles: 3, sec: 48 });
    expect(breathRestOf(BREATH_DEFAULT, 0)).toEqual({ cycles: 1, sec: 10 });
  });
});
