import { describe, expect, it } from 'vitest';
import { LANGS, catalogProblems, lang, type Lang } from '../src/i18n';
import { CATALOGS, t, type ArcadeKey } from '../src/i18n/arcade';
import { MOUSE_CATALOGS, mouseText } from '../src/i18n/arcade-mouse';
import { ARCADE, arcadeEntry, forHands } from '../src/arcade/registry';

/** A finger's gesture named in a line (a line that names the click as well — "stuknij lub kliknij" — reads right anywhere). */
const FINGER: Readonly<Record<Lang, RegExp>> = {
  pl: /stuk|palc/i,
  en: /\btap|finger|swipe/i,
  de: /\b(tipp(e|st|en)?|antippen|wisch(e|en)?)\b(?!\.)|finger/i,
  sv: /finger|svep/i,
};
const CLICK: Readonly<Record<Lang, RegExp>> = { pl: /klik/i, en: /click/i, de: /klick/i, sv: /klick/i };

describe('the registry lines for a mouse and a keyboard', () => {
  it('give every twin in all four languages, each the twin of a registry line', () => {
    expect(catalogProblems(MOUSE_CATALOGS)).toEqual([]);
    const lines = /^[a-z]+\.(text|how[1-3]|tip[1-6])$/;
    for (const key of Object.keys(MOUSE_CATALOGS.pl)) {
      expect(key, key).toMatch(lines);
      expect(Object.keys(CATALOGS.pl), key).toContain(key);
    }
  });

  it('keep the registry to its keys’ order, which the twins follow', () => {
    for (const e of ARCADE) {
      expect(e.text, e.id).toBe(t(`${e.id}.text` as ArcadeKey));
      e.how.forEach((line, i) => expect(line, `${e.id}.how${i + 1}`).toBe(t(`${e.id}.how${i + 1}` as ArcadeKey)));
      e.tips.forEach((line, i) => expect(line, `${e.id}.tip${i + 1}`).toBe(t(`${e.id}.tip${i + 1}` as ArcadeKey)));
    }
  });

  it('name the click, never a finger, in every language', () => {
    for (const l of LANGS) {
      for (const [key, line] of Object.entries(MOUSE_CATALOGS[l])) {
        expect(line, `${l}.${key}`).not.toMatch(FINGER[l]);
        expect(line, `${l}.${key}`).toMatch(new RegExp(`${CLICK[l].source}|mysz|mouse|maus|mus|spac|leertaste|mellanslag|←|strzał|arrow|pfeil|pil`, 'i'));
        if (l !== 'pl') expect(line, `${l}.${key}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(albo|się|myszą)\b/);
      }
    }
  });

  it('cover every line of the registry that a finger’s gesture would mislead at a desktop', () => {
    // read in the source and in English (German's "Tipp" is a hint as well, Swedish "tryck" a press): the
    // twins come in all four languages by key
    for (const l of ['pl', 'en'] as const) {
      const cat = CATALOGS[l] as Readonly<Record<string, unknown>>;
      const missing = ARCADE.flatMap(e => [`${e.id}.text`, ...e.how.map((_, i) => `${e.id}.how${i + 1}`), ...e.tips.map((_, i) => `${e.id}.tip${i + 1}`)])
        .filter(key => {
          const line = cat[key];
          return typeof line === 'string' && FINGER[l].test(line) && !CLICK[l].test(line) && !(key in MOUSE_CATALOGS[l]);
        });
      expect(missing, l).toEqual([]);
    }
  });

  it('read a finger’s lines on a touch screen and their twins at a desktop', () => {
    const e = arcadeEntry('poslaniec')!;
    expect(forHands(e, true)).toEqual({ text: e.text, how: e.how, tips: e.tips });
    const desk = forHands(e, false);
    expect(desk.tips[0]).toBe(MOUSE_CATALOGS[lang]['poslaniec.tip1']);
    expect(desk.tips.slice(1)).toEqual(e.tips.slice(1));
    expect(desk.how).toEqual(e.how);
    expect(desk.text).toBe(e.text);
    const g = forHands(arcadeEntry('glina')!, false);
    expect(g.text).toBe(mouseText('glina.text'));
    expect(mouseText('geoda.how1')).toBeNull();
  });
});
