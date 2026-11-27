import { describe, expect, it } from 'vitest';
import { AGES, AGE_SPAN, isAge, loadAge, saveAge } from '../src/arcade/kit/ages';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, SCALE, difficultyOf, recordKey } from '../src/arcade/kit/difficulty';
import { DIFFICULTY_WORDS, difficultyName, difficultyPanel } from '../src/arcade/kit/difficultypanel';

describe('kit/difficulty — the four levels (DESIGN §29)', () => {
  it('keeps REGULAR the game as it was, and orders the levels from easy to hard', () => {
    expect([...DIFFICULTIES]).toEqual(['start', 'regular', 'advanced', 'hardcore']);
    expect(DEFAULT_DIFFICULTY).toBe('regular');
    expect(SCALE.regular).toEqual({ foe: 1, count: 1, speed: 1, self: 1, helps: 1, reward: 1 });
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const a = SCALE[DIFFICULTIES[i - 1]], b = SCALE[DIFFICULTIES[i]];
      expect(b.foe).toBeGreaterThan(a.foe);
      expect(b.self).toBeLessThan(a.self);
      expect(b.helps).toBeLessThan(a.helps);
    }
    expect(SCALE.hardcore.helps).toBe(0);
  });

  it('reads an old or a broken save as REGULAR and keeps REGULAR’s record keys', () => {
    expect(difficultyOf(undefined)).toBe('regular');
    expect(difficultyOf('nightmare')).toBe('regular');
    expect(difficultyOf('hardcore')).toBe('hardcore');
    expect(recordKey('600', 'regular')).toBe('600');
    expect(recordKey('600', 'hardcore')).toBe('600@hardcore');
  });

  it('names the levels in four languages and draws four chips that report a change', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      expect(Object.keys(DIFFICULTY_WORDS[l]).sort()).toEqual(Object.keys(DIFFICULTY_WORDS.pl).sort());
      for (const d of DIFFICULTIES) expect(difficultyName(d, l).length).toBeGreaterThan(2);
    }
    let got = '';
    const el = difficultyPanel({ value: 'regular', onChange: d => { got = d; } });
    const chips = [...el.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];
    expect(chips.map(c => c.dataset.difficulty)).toEqual([...DIFFICULTIES]);
    expect(chips.find(c => c.getAttribute('aria-checked') === 'true')?.dataset.difficulty).toBe('regular');
    chips[3].click();
    expect(got).toBe('hardcore');
    expect(el.querySelector('[aria-checked="true"]')?.getAttribute('data-difficulty')).toBe('hardcore');
  });
});

describe('kit/ages — the shared age groups', () => {
  it('lists the founder’s five groups and remembers the choice on the device', () => {
    expect([...AGES]).toEqual(['teen', 'young', 'adult', 'mid', 'senior']);
    expect(AGES.map(a => AGE_SPAN[a])).toEqual(['11–19', '20–26', '27–35', '36–50', '50+']);
    expect(isAge('mid')).toBe(true);
    expect(isAge('kid')).toBe(false);
    saveAge('senior');
    expect(loadAge()).toBe('senior');
  });
});
