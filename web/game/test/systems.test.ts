import { describe, expect, it } from 'vitest';
import { FIRE_BASE, focusReading, MOVING_FOCUS, NeuroEffects, NO_BAND, REST_BASE, STILL_FOCUS, type NeuroState } from '../src/neuro/effects';
import { bandFocus, chargeFactor, FocusCharger, GRACE, THRESHOLD, TIERS, type FocusReading } from '../src/neuro/focus';
import { levenshtein, normalizeWord, RepetitionCounter, similar } from '../src/prayer/matcher';
import { PrayerSession, sessionReading, STILL_AFTER, VOICE_BONUS } from '../src/prayer/session';
import {
  availablePowers, backupSave, buyFruit, defaultSave, DEFAULT_VOLUMES, exportSave, importSave, loadSave, realmUnlocked, SAVE_KEY, sanitize, skinOwned, writeSave,
} from '../src/save';
import type { ChapterDef, PrayerDef, RankDef, SkinDef } from '../src/types';

const run = (c: FocusCharger, r: FocusReading, secs: number, dt = 0.1) => {
  let st = c.update(0, r);
  for (let i = 0; i < Math.round(secs / dt); i++) st = c.update(dt, r);
  return st;
};

describe('focus', () => {
  it('held focus climbs the multiplier: ×1 → ×1,5 → ×2 → ×3', () => {
    const c = new FocusCharger();
    const band = { level: 0.9, source: 'band' } as const;
    expect(run(c, band, 2).mult).toBe(1);
    expect(run(c, band, TIERS[1].after).mult).toBe(1.5);
    expect(run(c, band, TIERS[2].after - TIERS[1].after).mult).toBe(2);
    const top = run(c, band, TIERS[3].after - TIERS[2].after + 1);
    expect(top.mult).toBe(3);
    expect(top.toNext).toBe(1);
  });

  it('each source caps the multiplier: stillness ×1,5, voice ×2, the band ×3', () => {
    expect(run(new FocusCharger(), { level: STILL_FOCUS, source: 'still' }, 60).mult).toBe(1.5);
    expect(run(new FocusCharger(), { level: 0.8, source: 'voice' }, 60).mult).toBe(2);
    expect(run(new FocusCharger(), { level: 0.8, source: 'band' }, 60).mult).toBe(3);
    // a long stillness banks nothing beyond its cap: the band has to earn ×2 and ×3 itself
    const c = new FocusCharger();
    run(c, { level: STILL_FOCUS, source: 'still' }, 60);
    expect(run(c, { level: 0.9, source: 'band' }, 2).mult).toBe(1.5);
    expect(run(c, { level: 0.9, source: 'band' }, TIERS[2].after - TIERS[1].after).mult).toBe(2);
    // and when the band drops out, a weaker source eases the multiplier down to its own cap
    const d = new FocusCharger();
    run(d, { level: 0.9, source: 'band' }, TIERS[3].after + 1);
    expect(run(d, { level: STILL_FOCUS, source: 'still' }, 1).mult).toBe(3);
    expect(run(d, { level: STILL_FOCUS, source: 'still' }, 8).mult).toBe(1.5);
  });

  it('a band that dips for a moment while the angel stands still keeps climbing: the dip is forgiven', () => {
    const c = new FocusCharger();
    let st = c.update(0, focusReading(0.9, true));
    for (let i = 0; i < 450; i++) st = c.update(0.1, focusReading(i % 2 ? 0.4 : 0.9, true));   // 45 s, half of the ticks dipping
    expect(st.mult).toBe(2);
  });

  it('measures the time focus is actually held, beyond the tier thresholds; the progress line is empty when unfocused', () => {
    const c = new FocusCharger();
    const still = run(c, { level: STILL_FOCUS, source: 'still' }, 60);
    expect(still.held).toBeGreaterThan(55);
    expect(still.streak).toBe(TIERS[1].after);
    const moving = run(c, { level: 0.1, source: 'none' }, 1);
    expect(moving.toNext).toBe(0);
    expect(run(c, { level: 0.1, source: 'none' }, 5).held).toBe(0);   // a real break
  });

  it('a short lapse is forgiven; a long one steps the multiplier down one tier at a time', () => {
    const c = new FocusCharger();
    const band = { level: 0.9, source: 'band' } as const;
    run(c, band, TIERS[3].after + 1);
    const lapse = { level: 0.1, source: 'band' } as const;
    expect(run(c, lapse, GRACE - 0.5).mult).toBe(3);   // the level has fallen, the streak holds
    expect(run(c, lapse, 4).mult).toBe(2);             // grace over, one step down
    expect(run(c, lapse, 2.5).mult).toBe(1.5);         // and one more
    expect(run(c, { level: 0.9, source: 'band' }, 1).mult).toBe(1.5);   // back in focus: kept, climbing again
  });

  it('charges fully only when focused, more for deeper focus, times the multiplier; a trickle below', () => {
    const base = { focused: true, streak: 0, held: 0, tier: 0, toNext: 0, tierUp: false, source: 'band' as const };
    expect(chargeFactor({ ...base, level: THRESHOLD, mult: 1 })).toBeCloseTo(0.75);
    expect(chargeFactor({ ...base, level: 1, mult: 3 })).toBeCloseTo(3);
    expect(chargeFactor({ ...base, level: 0.2, mult: 1 })).toBeLessThan(0.1);
    expect(bandFocus(0.5)).toBeLessThan(THRESHOLD);   // the usual level is not concentration
    expect(bandFocus(0.7)).toBeGreaterThan(THRESHOLD);
    expect(bandFocus(null)).toBe(0);
  });
});

describe('prayer of the heart', () => {
  it('normalises Polish words and forgives recognition slips and inflection', () => {
    expect(normalizeWord('Zmiłuj,')).toBe('zmiluj');
    expect(normalizeWord('ŚWIĘTY')).toBe('swiety');
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(similar('duchu', 'duch')).toBe(true);
    expect(similar('zmiluj', 'zmilowal')).toBe(true);
    expect(similar('bog', 'mog')).toBe(false);
  });

  it('counts the invocation repeated aloud, with slips and a skipped word', () => {
    const c = new RepetitionCounter('Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną, grzesznikiem.');
    expect(c.feed('panie jezu chryste synu boży zmiłuj się nade mną grzesznikiem')).toBe(1);
    expect(c.feed('panie jezu chryste synu bozy zmiluj sie nade mna grzesznikiem panie jezu chryste synu boży zmiłuj się nade mną')).toBe(1);
    expect(c.feed('grzesznikiem')).toBe(1);   // the end of the second one, in the next phrase
    expect(new RepetitionCounter('Przyjdź, Duchu Święty.').feed('przyjdź duchu święty przyjdź duchu święty przyjdź duch święty')).toBe(3);
  });

  it('is not fooled by unrelated speech', () => {
    const c = new RepetitionCounter('Przyjdź, Duchu Święty.');
    expect(c.feed('dzień dobry jaka dziś pogoda w warszawie')).toBe(0);
  });

  it('stillness fills the prayer in about its length; the band (×3) is clearly faster; restlessness only slows it', () => {
    const fill = (input: { band: number | null; idle: number }) => {
      const s = new PrayerSession('Przyjdź, Duchu Święty.', 60);
      let t = 0;
      while (!s.update(0.1, input).done && t < 400) t += 0.1;
      return t;
    };
    const still = fill({ band: null, idle: 10 });
    expect(still).toBeGreaterThan(40);
    expect(still).toBeLessThanOrEqual(60);
    const band = fill({ band: 0.95, idle: 0 });         // the band counts even while touching the screen
    expect(band).toBeLessThan(still * 0.8);
    expect(fill({ band: null, idle: STILL_AFTER - 0.5 })).toBeGreaterThan(still * 2);
  });

  it('every repetition heard aloud adds to the prayer at once and keeps the voice focused', () => {
    const s = new PrayerSession('Przyjdź, Duchu Święty.', 60);
    const before = s.update(0.1, { band: null, idle: 0 }).progress;
    expect(s.heard('przyjdź duchu święty')).toBe(1);
    const after = s.update(0.1, { band: null, idle: 0 });
    expect(after.progress - before).toBeGreaterThan((VOICE_BONUS / 60) * 0.9);
    expect(after.focus.source).toBe('voice');
    expect(sessionReading(0.9, true, true).source).toBe('band');   // the band wins when it reads as focused
    expect(sessionReading(0.2, false, true)).toEqual({ level: STILL_FOCUS, source: 'still' });
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

  it('without the band, stillness drives peace and charges the Fire (×1,5 at most)', () => {
    const moving = settle(new NeuroEffects(), NO_BAND, 0);
    const still = settle(new NeuroEffects(), NO_BAND, 5, 'battle', 20);
    expect(moving.peace).toBeLessThan(0.05);
    expect(still.peace).toBeGreaterThan(0.95);
    expect(still.focus.source).toBe('still');
    expect(still.focus.mult).toBe(1.5);
    expect(still.fireRate).toBeGreaterThan(moving.fireRate * 5);
    expect(still.bandActive).toBe(false);
  });

  it('with the band, held focus charges the Fire even on the move, up to ×3', () => {
    const fx = settle(new NeuroEffects(), band({ activation: 0.85, balanced: true, balanceStreak: 10 }), 0, 'battle', 40);
    expect(fx.focus.source).toBe('band');
    expect(fx.focus.mult).toBe(3);
    expect(fx.fireRate).toBeGreaterThan(FIRE_BASE * 2.5);
    expect(fx.peace).toBeGreaterThan(0.9);
  });

  it('never gives less than playing without the band', () => {
    for (const still of [0, 5]) {
      const noBand = settle(new NeuroEffects(), NO_BAND, still, 'battle', 30);
      for (const n of [band({ activation: 0.2, balanced: false, asymmetry: 0.9 }), band({ reliable: false, activation: 0.9 }), band({ activation: 0.9 })]) {
        const fx = settle(new NeuroEffects(), n, still, 'battle', 30);
        expect(fx.fireRate).toBeGreaterThanOrEqual(noBand.fireRate - 1e-9);
        expect(fx.peace).toBeGreaterThanOrEqual(noBand.peace - 1e-9);
      }
    }
    expect(focusReading(0.2, true)).toEqual({ level: STILL_FOCUS, source: 'still' });
    expect(focusReading(null, false)).toEqual({ level: MOVING_FOCUS, source: 'none' });
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

  it('a new room keeps the focus streak; a new chapter starts it afresh', () => {
    const e = new NeuroEffects();
    settle(e, band({ activation: 0.9 }), 0, 'battle', 20);
    e.reset();
    expect(e.update(0.1, band({ activation: 0.9 }), { still: 0, phase: 'battle' }).focus.mult).toBe(2);
    e.reset(true);
    expect(e.update(0.1, band({ activation: 0.9 }), { still: 0, phase: 'battle' }).focus.mult).toBe(1);
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
    expect(s.settings.voicePrayer).toBe(false);
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

  it('migrates version 1: quieter defaults, the game soundtrack, praying aloud only with consent', () => {
    const v1 = sanitize({ version: 1, soundscape: 'gregorianski', settings: { master: 0.8, music: 0.7, sfx: 0.8, prayerMode: 'voice', voiceConsent: true } });
    expect(v1.version).toBe(2);
    expect(v1.soundscape).toBe('psalm');
    expect([v1.settings.master, v1.settings.music, v1.settings.sfx]).toEqual([DEFAULT_VOLUMES.master, DEFAULT_VOLUMES.music, DEFAULT_VOLUMES.sfx]);
    expect(v1.settings.voicePrayer).toBe(true);
    const custom = sanitize({ version: 1, soundscape: 'dzwony', settings: { master: 0.5, music: 0.2, sfx: 0.9, prayerMode: 'read', voiceConsent: true } });
    expect(custom.soundscape).toBe('dzwony');
    expect(custom.settings.music).toBe(0.2);
    expect(custom.settings.voicePrayer).toBe(false);
    const v2 = sanitize({ version: 2, soundscape: 'gregorianski', settings: { music: 0.7, voicePrayer: true } });
    expect(v2.soundscape).toBe('gregorianski');   // a choice made in version 2 stays
    expect(v2.settings.music).toBe(0.7);
    expect(defaultSave().settings.music).toBe(0.4);
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
