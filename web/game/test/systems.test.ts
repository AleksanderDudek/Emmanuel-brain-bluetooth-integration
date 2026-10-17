import { describe, expect, it } from 'vitest';
import { NeuroEffects, NO_BAND, REST_BASE, SPIRIT_BAND_MAX, SPIRIT_STILL, type NeuroState } from '../src/neuro/effects';
import { levenshtein, normalizeWord, PrayerMatcher, ReadAlong, similar } from '../src/prayer/matcher';
import {
  availablePowers, backupSave, buyFruit, defaultSave, exportSave, importSave, loadSave, realmUnlocked, SAVE_KEY, sanitize, skinOwned, writeSave,
} from '../src/save';
import type { ChapterDef, PrayerDef, RankDef, SkinDef } from '../src/types';

describe('prayer matcher', () => {
  it('normalises Polish words', () => {
    expect(normalizeWord('Zmiłuj,')).toBe('zmiluj');
    expect(normalizeWord('ŚWIĘTY')).toBe('swiety');
    expect(normalizeWord('—')).toBe('');
  });

  it('forgives recognition slips and inflection', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(similar('swiety', 'swiety')).toBe(true);
    expect(similar('duchu', 'duch')).toBe(true);
    expect(similar('zmiluj', 'zmilowal')).toBe(true);
    expect(similar('bog', 'mog')).toBe(false);
  });

  it('follows a prayer spoken with mistakes and skipped words', () => {
    const m = new PrayerMatcher('Przyjdź, Duchu Święty, napełnij serca swoich wiernych i zapal w nich ogień swojej miłości.');
    let p = m.feed('przyjdz duchu swiety', true);
    expect(p.pointer).toBe(3);
    p = m.feed('napełnij serce swoich', false);   // interim: tentative only
    expect(p.pointer).toBe(6);
    expect(p.matched[3]).toBe(false);
    p = m.feed('napełnij serce swoich wiernych i zapał w nich', true);
    expect(p.matched.slice(3, 10).filter(Boolean).length).toBeGreaterThanOrEqual(6);
    p = m.feed('ogień miłości', true);         // "swojej" skipped
    expect(p.done).toBe(true);
    expect(p.matched[12]).toBe(false);
  });

  it('is not fooled by unrelated speech', () => {
    const m = new PrayerMatcher('Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną grzesznikiem.');
    const p = m.feed('dzień dobry jaka dziś pogoda w warszawie', true);
    expect(p.pointer).toBe(0);
    expect(p.done).toBe(false);
  });

  it('read-along reveals at reading pace only while held', () => {
    const r = new ReadAlong('jeden dwa trzy cztery pięć sześć', 2);
    r.update(1, false);
    expect(r.revealed).toBe(0);
    r.update(1, true);
    expect(r.revealed).toBe(2);
    r.update(5, true);
    expect(r.done).toBe(true);
    expect(r.seconds).toBe(3);
  });
});

describe('neuro effects', () => {
  const band = (o: Partial<NeuroState>): NeuroState => ({
    ...NO_BAND, source: 'band', connected: true, streaming: true, reliable: true, baselineReady: true, baselineProgress: 1,
    activation: 0.5, asymmetry: 0.5, balanced: true, balanceStreak: 0, ...o,
  });
  const settle = (e: NeuroEffects, n: NeuroState, still: number, phase: 'battle' | 'boss' | 'sabbath' = 'battle', secs = 10) => {
    let fx = e.update(0, n, { still, phase });
    for (let i = 0; i < secs * 10; i++) fx = e.update(0.1, n, { still, phase });
    return fx;
  };

  it('without the band, stillness drives peace and the Spirit', () => {
    const moving = settle(new NeuroEffects(), NO_BAND, 0);
    const still = settle(new NeuroEffects(), NO_BAND, 5);
    expect(moving.peace).toBeLessThan(0.05);
    expect(still.peace).toBeGreaterThan(0.95);
    expect(still.spiritRate).toBe(SPIRIT_STILL);
    expect(still.bandActive).toBe(false);
  });

  it('balance brings peace even on the move; focus adds to the Spirit within bounds', () => {
    const fx = settle(new NeuroEffects(), band({ balanced: true, balanceStreak: 10, activation: 0.9 }), 0);
    expect(fx.peace).toBeGreaterThan(0.9);
    expect(fx.bandActive).toBe(true);
    expect(fx.spiritRate).toBeCloseTo(0.6 + SPIRIT_BAND_MAX, 5);
  });

  it('never gives less than playing without the band', () => {
    const noBand = settle(new NeuroEffects(), NO_BAND, 5);
    const imbalanced = settle(new NeuroEffects(), band({ balanced: false, asymmetry: 0.9, activation: 0.2 }), 5);
    expect(imbalanced.peace).toBeGreaterThanOrEqual(noBand.peace - 1e-9);
    expect(imbalanced.spiritRate).toBeGreaterThanOrEqual(noBand.spiritRate);
    const unreliable = settle(new NeuroEffects(), band({ reliable: false, activation: 0.9 }), 5);
    expect(unreliable.bandActive).toBe(false);
    expect(unreliable.spiritRate).toBe(SPIRIT_STILL);
  });

  it('deep calm deepens the Sabbath rest (down-regulation)', () => {
    const calm = settle(new NeuroEffects(), band({ activation: 0.1 }), 5, 'sabbath');
    expect(calm.restRate).toBeGreaterThan(REST_BASE);
    expect(calm.restRate).toBeLessThanOrEqual(REST_BASE * 1.3 + 1e-9);
  });

  it('a revelation needs sustained balance (or deep stillness) at the stronghold', () => {
    const short = settle(new NeuroEffects(), band({ balanced: true, balanceStreak: 3 }), 0, 'boss', 2);
    expect(short.revelation).toBe(false);
    const long = settle(new NeuroEffects(), band({ balanced: true, balanceStreak: 9 }), 0, 'boss', 2);
    expect(long.revelation).toBe(true);
    const still = settle(new NeuroEffects(), NO_BAND, 6, 'boss', 6);
    expect(still.revelation).toBe(true);
  });
});

describe('save', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  };

  it('survives garbage and keeps only well-typed fields', () => {
    const s = sanitize({ light: 'lots', manna: 12, prayers: { inwokacja: 5, bad: 'x' }, equipped: { halo: 3 }, settings: { prayerMode: 'shout' } });
    expect(s.light).toBe(0);
    expect(s.manna).toBe(12);
    expect(s.prayers).toEqual({ inwokacja: 5 });
    expect(s.equipped.halo).toBe('halo_zlota');
    expect(s.settings.prayerMode).toBe('voice');
    expect(sanitize(null)).toEqual({ ...defaultSave(), createdAt: expect.any(Number) });
  });

  it('clamps hostile numbers that could freeze the HUD or poison sums', () => {
    const s = sanitize({
      fruits: { milosc: -1, radosc: 1e9, pokoj: 0.5, bogus: 2 }, light: 1e300, manna: -5,
      stats: { traumas: -3, seconds: Infinity }, settings: { master: 7 }, cleared: { malkut: { times: -2, falls: 1e99 } },
    });
    expect(s.fruits).toEqual({ radosc: 3 });
    expect(s.light).toBe(1e12);
    expect(s.manna).toBe(0);
    expect(s.stats.traumas).toBe(0);
    expect(s.stats.seconds).toBe(0);
    expect(s.settings.master).toBe(1);
    expect(s.cleared.malkut).toMatchObject({ times: 1, falls: 1e9 });
  });

  it('keeps an unreadable save aside instead of overwriting it', () => {
    const store = mem();
    store.setItem(SAVE_KEY, '{broken');
    expect(loadSave(store).light).toBe(0);
    expect(store.getItem(`${SAVE_KEY}.corrupt`)).toBe('{broken');
  });

  it('an import never brings voice consent along; a backup keeps the old save', () => {
    const s = defaultSave();
    s.settings.voiceConsent = true;
    expect(importSave(exportSave(s)).settings.voiceConsent).toBe(false);
    const store = mem();
    writeSave(s, store);
    backupSave(store);
    expect(store.getItem(`${SAVE_KEY}.bak`)).toBe(store.getItem(SAVE_KEY));
  });

  it('round-trips through storage and backups', () => {
    const store = mem();
    const s = defaultSave();
    s.light = 1234;
    s.codex.push('r1');
    expect(writeSave(s, store)).toBe(true);
    expect(loadSave(store).light).toBe(1234);
    expect(importSave(exportSave(s)).codex).toEqual(['r1']);
    expect(() => importSave('{"light": 5}')).toThrow();
  });

  it('derives unlocks from prayers, light and rank', () => {
    const s = defaultSave();
    const prayers = [{ id: 'zbroja', unlocks: { powers: ['tarcza', 'helm'] } }] as unknown as PrayerDef[];
    expect(availablePowers(s, prayers)).not.toContain('tarcza');
    s.prayers.zbroja = 1;
    expect(availablePowers(s, prayers)).toEqual(expect.arrayContaining(['tarcza', 'helm', 'slowo']));
    const ranks = [{ id: 'aniol', light: 0 }, { id: 'archaniol', light: 300 }] as unknown as RankDef[];
    const skin = { id: 'x', slot: 'halo', unlock: { rank: 'archaniol' } } as unknown as SkinDef;
    expect(skinOwned(s, skin, ranks)).toBe(false);
    s.light = 300;
    expect(skinOwned(s, skin, ranks)).toBe(true);
  });

  it('opens spheres in order and side realms by prayer', () => {
    const s = defaultSave();
    const ch = (id: string, order: number, unlockedBy?: string) => ({ id, order, unlockedBy }) as unknown as ChapterDef;
    const all = [ch('malkut', 0), ch('jesod', 1), ch('rod', 100, 'rod')];
    expect(realmUnlocked(s, all[0], all)).toBe(true);
    expect(realmUnlocked(s, all[1], all)).toBe(false);
    s.cleared.malkut = { at: 1, falls: 0, fragments: 0, times: 1 };
    expect(realmUnlocked(s, all[1], all)).toBe(true);
    expect(realmUnlocked(s, all[2], all)).toBe(false);
    s.prayers.rod = 1;
    expect(realmUnlocked(s, all[2], all)).toBe(true);
  });

  it('buys fruits with manna', () => {
    const s = defaultSave();
    s.manna = 50;
    expect(buyFruit(s, 'milosc', [20, 40, 80], 3)).toBe(true);
    expect(buyFruit(s, 'milosc', [20, 40, 80], 3)).toBe(false);   // 30 left, next costs 40
    expect(s.fruits.milosc).toBe(1);
    expect(s.manna).toBe(30);
  });
});
