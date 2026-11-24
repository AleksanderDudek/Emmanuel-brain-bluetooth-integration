import { describe, expect, it } from 'vitest';
import { SCRIPTURE } from '../src/content/scripture';
import { LANGS } from '../src/i18n';
import { WAROWNIA_GROUPS, WAROWNIA_KEY_VERSES, WAROWNIE, isWarowniaId, warownia, warownieIn } from '../src/arcade/kit/warownie';

describe('kit/warownie — the 24 strongholds of the series', () => {
  it('holds parts 2 and 5–27 in order, each once', () => {
    expect(WAROWNIE.map(w => w.part)).toEqual([2, ...Array.from({ length: 23 }, (_, i) => i + 5)]);
    expect(new Set(WAROWNIE.map(w => w.id)).size).toBe(24);
  });
  it('names each in four languages, short enough for a chip', () => {
    for (const w of WAROWNIE) for (const l of LANGS) {
      expect(w.name[l].trim().length, `${w.id} ${l}`).toBeGreaterThan(2);
      expect(w.name[l].length, `${w.id} ${l}`).toBeLessThanOrEqual(30);
    }
    for (const g of WAROWNIA_GROUPS) for (const l of LANGS) expect(g.name[l].length).toBeGreaterThan(2);
  });
  it('opens each with a verse that is in scripture.ts', () => {
    for (const id of [...WAROWNIE.map(w => w.verse), ...WAROWNIA_KEY_VERSES]) expect(SCRIPTURE[id], id).toBeTruthy();
  });
  it('puts every stronghold in one of five groups, none empty', () => {
    expect(WAROWNIA_GROUPS.map(g => warownieIn(g.id).length).reduce((a, b) => a + b, 0)).toBe(24);
    for (const g of WAROWNIA_GROUPS) expect(warownieIn(g.id).length).toBeGreaterThanOrEqual(4);
  });
  it('carries the series’ cautions where its parts give them', () => {
    expect(warownia('compulsions')?.care).toContain('ocd');
    expect(warownia('instability')?.care).toContain('crisis');
    expect(warownia('humiliation')?.care).toContain('crisis');
    expect(warownia('addictions')?.care).toContain('addiction');
  });
  it('reads saved ids safely', () => {
    expect(isWarowniaId('rejection')).toBe(true);
    for (const v of ['nope', 3, null, undefined, {}]) expect(isWarowniaId(v)).toBe(false);
  });
});
