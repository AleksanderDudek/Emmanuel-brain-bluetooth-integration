import { describe, expect, it } from 'vitest';
import {
  BIBLE, CHAPTERS, FRUITS, POWERS, PRAYERS, RANKS, REVELATIONS, SKINS, SOUNDSCAPES, STORY, TRAUMAS, verse,
} from '../src/content';
import type {
  ChantMode, FruitId, PowerId, PrayerDef, PrayerId, RankId, RealmId, SkinDef, SkinSlot, SoundscapeDef, SoundscapeId,
  TraumaBehavior, TraumaKind, Verse,
} from '../src/types';

// ─── helpers ─────────────────────────────────────────────────────────

/** `allOf<T>()([...])` only compiles when the list names every member of the union T. */
function allOf<T extends string>() {
  return <const A extends readonly T[]>(list: A & ([T] extends [A[number]] ? unknown : 'missing ids')): readonly T[] => list;
}

const TRAUMA_KINDS = allOf<TraumaKind>()([
  'lek', 'wstyd', 'gniew', 'rozpacz', 'odrzucenie', 'samotnosc', 'wina',
  'nalog', 'pycha', 'zazdrosc', 'nieprzebaczenie', 'zwatpienie', 'kontrola', 'oskarzyciel',
]);
const POWER_IDS = allOf<PowerId>()([
  'slowo', 'chleby', 'tarcza', 'ogien', 'wicher', 'golebica', 'eliasz', 'jerycho', 'dawid', 'samson',
  'manna', 'sandaly', 'pancerz', 'helm', 'ucisz', 'milosc', 'ryba', 'serce', 'przebaczenie', 'gorczyca',
]);
const FRUIT_IDS = allOf<FruitId>()(['milosc', 'radosc', 'pokoj', 'cierpliwosc', 'uprzejmosc', 'dobroc', 'wiernosc', 'lagodnosc', 'opanowanie']);
const PRAYER_IDS = allOf<PrayerId>()(['inwokacja', 'przyjmuje', 'rod', 'przebaczenie', 'zbroja', 'jezusowa', 'zagubieni', 'klamstwa', 'trisagion']);
const RANK_IDS = allOf<RankId>()(['aniol', 'archaniol', 'zwierzchnosci', 'wladze', 'moce', 'panowania', 'trony', 'cherubini', 'serafini']);
const SOUNDSCAPE_IDS = allOf<SoundscapeId>()(['psalm', 'gregorianski', 'bizantyjski', 'dzwony', 'cisza']);
const REALM_IDS = allOf<RealmId>()(['malkut', 'jesod', 'hod', 'necach', 'tiferet', 'gewura', 'chesed', 'bina', 'chochma', 'keter', 'rod', 'szeol']);

const BOOKS = new Set([
  'Rdz', 'Wj', 'Kpł', 'Lb', 'Pwt', 'Joz', 'Sdz', 'Rt', '1 Sm', '2 Sm', '1 Krl', '2 Krl', '1 Krn', '2 Krn', 'Ezd', 'Ne',
  'Est', 'Hi', 'Ps', 'Prz', 'Koh', 'Pnp', 'Iz', 'Jr', 'Lm', 'Ez', 'Dn', 'Oz', 'Jl', 'Am', 'Ab', 'Jon', 'Mi', 'Na', 'Ha',
  'So', 'Ag', 'Za', 'Ml', 'Mt', 'Mk', 'Łk', 'J', 'Dz', 'Rz', '1 Kor', '2 Kor', 'Ga', 'Ef', 'Flp', 'Kol', '1 Tes', '2 Tes',
  '1 Tm', '2 Tm', 'Tt', 'Flm', 'Hbr', 'Jk', '1 P', '2 P', '1 J', '2 J', '3 J', 'Jud', 'Ap',
]);
const REF = /^((?:[1-3] )?[A-ZŁ][a-ząćęłńóśźż]*) (\d{1,3}),(\d{1,3})(?:-(\d{1,3}))?$/u;
/** „exact words” (Ref) inside prose */
const QUOTE = /„([^”]+)”\s*\(((?:[1-3] )?[A-ZŁ][a-ząćęłńóśźż]* \d{1,3},\d{1,3}(?:-\d{1,3})?)\)/gu;
const DIACRITIC = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;

function refProblem(ref: string): string | null {
  const m = ref.match(REF);
  if (!m) return 'malformed';
  if (!BOOKS.has(m[1])) return `unknown book ${m[1]}`;
  if (Number(m[2]) < 1 || Number(m[3]) < 1) return 'chapter/verse must start at 1';
  if (m[4] !== undefined && Number(m[4]) <= Number(m[3])) return 'range must ascend';
  return null;
}

function* walk(value: unknown, path: string): Generator<[string, unknown]> {
  yield [path, value];
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* walk(v, Array.isArray(value) ? `${path}[${k}]` : `${path}.${k}`);
  }
}

function isVerse(x: unknown): x is Verse {
  return x !== null && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).sort().join() === 'ref,text';
}

const CONTENT = { TRAUMAS, CHAPTERS, REVELATIONS, PRAYERS, POWERS, FRUITS, RANKS, SKINS, SOUNDSCAPES, STORY };
const NODES = [...walk(CONTENT, 'content')];
const STRINGS = NODES.filter((n): n is [string, string] => typeof n[1] === 'string');
const VERSES = NODES.filter((n): n is [string, Verse] => isVerse(n[1]));
const QUOTES = STRINGS.flatMap(([path, s]) => [...s.matchAll(QUOTE)].map(m => ({ path, quote: m[1], ref: m[2] })));

/** Sentences, with quotations and references counted as part of the sentence around them. */
function sentences(s: string): number {
  const t = s.replace(/„[^”]*”(\s*\([^)]*\))?/gu, 'Q').replace(/\s*\([^)]*\)/gu, '');
  return t.split(/(?<=[.!?])\s+/u).filter(x => x.trim().length > 0).length;
}

function words(s: string): number {
  return s.split(/\s+/u).filter(w => /\p{L}/u.test(w)).length;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbDistance(a: string, b: string): number {
  const ch = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [ch(a), ch(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const HEX = /^#[0-9a-f]{6}$/;

function prayer(id: PrayerId): PrayerDef {
  const p = PRAYERS.find(x => x.id === id);
  if (!p) throw new Error(`no prayer ${id}`);
  return p;
}

// ─── Scripture ───────────────────────────────────────────────────────

describe('bible', () => {
  it('holds a curated set of well-formed refs with clean verse text', () => {
    const refs = Object.keys(BIBLE);
    expect(refs.length).toBeGreaterThanOrEqual(80);
    expect(refs.length).toBeLessThanOrEqual(130);
    for (const ref of refs) {
      expect(refProblem(ref), ref).toBeNull();
      const text = BIBLE[ref];
      expect(text.length, ref).toBeGreaterThan(0);
      expect(text, ref).toBe(text.trim());
      expect(text, ref).not.toMatch(/\s{2}|[\n\t]/u);
      expect(text, ref).toMatch(/^[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ ,.;:?!()]+$/u);
    }
  });

  it('verse() returns the exact text and throws on unknown refs', () => {
    expect(verse('Iz 6,3')).toEqual({ ref: 'Iz 6,3', text: BIBLE['Iz 6,3'] });
    expect(verse('Iz 6,3').text).toContain('Święty, święty, święty');
    expect(verse('Iz 6,3')).not.toBe(verse('Iz 6,3'));
    for (const bad of ['Iz 6,300', 'J 3,16', '', 'constructor', 'toString', '__proto__']) {
      expect(() => verse(bad), bad).toThrow(/Unknown Bible reference/);
    }
  });

  it('is the Gdańsk Bible with its own numbering (spot checks)', () => {
    expect(BIBLE['J 11,35']).toBe('I zapłakał Jezus.');
    expect(BIBLE['Ps 34,19']).toMatch(/^Bliski jest Pan/u); // Psalm titles count as verse 1
    expect(BIBLE['Jon 2,1']).toMatch(/rybę wielką/u); // Hebrew/Polish numbering, not KJV 1:17
    expect(BIBLE['Ps 46,11']).toMatch(/^Mówiąc: Uspokójcie się, a wiedzcie, żem Ja Bóg;.*na ziemi\.$/u);
    expect(BIBLE['Ap 21,4-5']).toBe(`${BIBLE['Ap 21,4-5'].split(' I rzekł')[0]} ${BIBLE['Ap 21,5']}`);
  });
});

describe('verses in the content', () => {
  it('every Verse comes from BIBLE, word for word', () => {
    expect(VERSES.length).toBeGreaterThan(100);
    for (const [path, v] of VERSES) {
      expect(refProblem(v.ref), `${path}: ${v.ref}`).toBeNull();
      expect(Object.hasOwn(BIBLE, v.ref), `${path}: ${v.ref} not in BIBLE`).toBe(true);
      expect(v.text, `${path}: ${v.ref}`).toBe(BIBLE[v.ref]);
    }
  });

  it('every quotation in the prose is exact', () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(12);
    for (const { path, quote, ref } of QUOTES) {
      expect(Object.hasOwn(BIBLE, ref), `${path}: ${ref} not in BIBLE`).toBe(true);
      expect(BIBLE[ref].toLowerCase(), `${path}: „${quote}” is not in ${ref}`).toContain(quote.toLowerCase());
    }
  });

  it('uses every verse in BIBLE, and ~80–120 distinct refs in total', () => {
    const used = new Set([...VERSES.map(([, v]) => v.ref), ...QUOTES.map(q => q.ref)]);
    expect(Object.keys(BIBLE).filter(r => !used.has(r))).toEqual([]);
    expect(used.size).toBeGreaterThanOrEqual(80);
    expect(used.size).toBeLessThanOrEqual(130);
  });
});

// ─── general text hygiene ────────────────────────────────────────────

describe('text', () => {
  it('has no empty, untrimmed or double-spaced strings', () => {
    for (const [path, s] of STRINGS) {
      expect(s.trim().length, path).toBeGreaterThan(0);
      expect(s, path).toBe(s.trim());
      expect(s, path).not.toMatch(/ {2}|\t|\n{3,}/u);
    }
  });

  it('is Polish prose with diacritics', () => {
    const prose = [
      ...CHAPTERS.flatMap(c => [c.story, c.report]),
      ...REVELATIONS.map(r => r.truth),
      ...PRAYERS.map(p => p.intro),
      ...STORY.intro, ...STORY.finale, STORY.disclaimer, STORY.crisisHelp, STORY.support, STORY.sabbath,
    ];
    for (const s of prose) expect(s, s.slice(0, 60)).toMatch(DIACRITIC);
    const all = STRINGS.map(([, s]) => s).join(' ');
    const letters = all.match(/\p{L}/gu) ?? [];
    const marked = all.match(new RegExp(DIACRITIC.source, 'gu')) ?? [];
    expect(marked.length / letters.length).toBeGreaterThan(0.03);
  });
});

// ─── traumas ─────────────────────────────────────────────────────────

describe('traumas', () => {
  const SPEC: Record<TraumaKind, [TraumaBehavior, number, number, string]> = {
    lek: ['chase', 20, 2.2, 'Ufność'],
    wstyd: ['ambush', 20, 2.4, 'Godność'],
    gniew: ['erratic', 25, 1.8, 'Łagodność'],
    rozpacz: ['shy', 18, 2.0, 'Nadzieja'],
    odrzucenie: ['chase', 16, 2.6, 'Przyjęcie'],
    samotnosc: ['shy', 18, 1.9, 'Obecność'],
    wina: ['tank', 50, 1.3, 'Przebaczenie'],
    nalog: ['splitter', 30, 2.0, 'Wolność'],
    pycha: ['tank', 55, 1.2, 'Pokora'],
    zazdrosc: ['erratic', 22, 1.9, 'Miłość'],
    nieprzebaczenie: ['tank', 45, 1.3, 'Miłosierdzie'],
    zwatpienie: ['blink', 18, 1.9, 'Wiara'],
    kontrola: ['ambush', 22, 2.2, 'Zaufanie'],
    oskarzyciel: ['ranged', 22, 1.6, 'Prawda'],
  };

  it('defines every kind exactly once, with the design stats', () => {
    expect(Object.keys(TRAUMAS).sort()).toEqual([...TRAUMA_KINDS].sort());
    for (const kind of TRAUMA_KINDS) {
      const t = TRAUMAS[kind];
      const [behavior, hp, speed, word] = SPEC[kind];
      expect(t.kind).toBe(kind);
      expect([t.behavior, t.hp, t.speed, t.truth.word], kind).toEqual([behavior, hp, speed, word]);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.color, kind).toMatch(HEX);
    }
  });

  it('has distinct rim colours', () => {
    const kinds = [...TRAUMA_KINDS];
    for (let i = 0; i < kinds.length; i++) {
      for (let j = i + 1; j < kinds.length; j++) {
        const [a, b] = [TRAUMAS[kinds[i]].color, TRAUMAS[kinds[j]].color];
        expect(rgbDistance(a, b), `${kinds[i]} vs ${kinds[j]}`).toBeGreaterThanOrEqual(70);
      }
    }
  });
});

// ─── chapters & revelations ──────────────────────────────────────────

describe('chapters', () => {
  type Spec = [RealmId, number, string, string, string, ChantMode, 'heaven' | 'earth' | 'hell', number, PrayerId?];
  const SPEC: Spec[] = [
    ['malkut', 0, 'Kołyska', 'Malkut', 'Królestwo', 1, 'earth', 300],
    ['jesod', 1, 'Dom', 'Jesod', 'Fundament', 2, 'earth', 380],
    ['hod', 2, 'Szkoła', 'Hod', 'Chwała', 3, 'earth', 460],
    ['necach', 3, 'Pierwsza miłość', 'Necach', 'Zwycięstwo', 4, 'earth', 540],
    ['tiferet', 4, 'Ambicja', 'Tiferet', 'Piękno', 5, 'earth', 620],
    ['gewura', 5, 'Gniew', 'Gewura', 'Moc', 6, 'earth', 720],
    ['chesed', 6, 'Upadek', 'Chesed', 'Miłosierdzie', 7, 'earth', 820],
    ['bina', 7, 'Ciemna noc', 'Bina', 'Zrozumienie', 2, 'heaven', 940],
    ['chochma', 8, 'Pustynia', 'Chochma', 'Mądrość', 8, 'heaven', 1080],
    ['keter', 9, 'Dom Ojca', 'Keter', 'Korona', 8, 'heaven', 1250],
    ['rod', 100, 'Drzewo rodu', 'Ród', 'Pokolenia', 1, 'earth', 700, 'rod'],
    ['szeol', 101, 'Zstąpienie', 'Szeol', 'Otchłań', 4, 'hell', 800, 'zagubieni'],
  ];

  it('follows the design, in order', () => {
    expect(CHAPTERS.map(c => c.id)).toEqual(SPEC.map(s => s[0]));
    expect(CHAPTERS.map(c => c.id).sort()).toEqual([...REALM_IDS].sort());
    CHAPTERS.forEach((c, i) => {
      const [id, order, title, name, meaning, mode, realm, hp, unlockedBy] = SPEC[i];
      expect([c.id, c.order, c.title, c.sphere.name, c.sphere.meaning, c.mode, c.realm, c.boss.hp, c.unlockedBy], id)
        .toEqual([id, order, title, name, meaning, mode, realm, hp, unlockedBy]);
      if (i > 0) expect(c.order).toBeGreaterThan(CHAPTERS[i - 1].order);
    });
  });

  it('has strongholds whose lies are their revelations', () => {
    const ids = CHAPTERS.map(c => c.revelationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHAPTERS) {
      const r = REVELATIONS.find(x => x.id === c.revelationId);
      expect(r, `${c.id}: revelation ${c.revelationId}`).toBeDefined();
      expect(c.boss.name, c.id).toMatch(/^Twierdza: \S/u);
      expect(c.boss.lie, c.id).toBe(r?.lie);
    }
  });

  it('casts 3–5 fitting traumas per chapter, the Accuser from Hod on, every kind somewhere', () => {
    for (const c of CHAPTERS) {
      expect(c.traumas.length, c.id).toBeGreaterThanOrEqual(3);
      expect(c.traumas.length, c.id).toBeLessThanOrEqual(5);
      expect(new Set(c.traumas).size, c.id).toBe(c.traumas.length);
      for (const t of c.traumas) expect(TRAUMA_KINDS, `${c.id}: ${t}`).toContain(t);
      if (c.order < 2) expect(c.traumas, c.id).not.toContain('oskarzyciel');
    }
    const cast = new Set(CHAPTERS.flatMap(c => c.traumas));
    expect(TRAUMA_KINDS.filter(k => !cast.has(k))).toEqual([]);
  });

  it('keeps stories and reports short', () => {
    for (const c of CHAPTERS) {
      expect(sentences(c.story), `${c.id} story`).toBeGreaterThanOrEqual(2);
      expect(sentences(c.story), `${c.id} story`).toBeLessThanOrEqual(4);
      expect(sentences(c.report), `${c.id} report`).toBeGreaterThanOrEqual(1);
      expect(sentences(c.report), `${c.id} report`).toBeLessThanOrEqual(2);
    }
  });

  it('cites the verses the design asks for', () => {
    const cited = (id: RealmId) => {
      const c = CHAPTERS.find(x => x.id === id);
      const r = REVELATIONS.find(x => x.id === c?.revelationId);
      return [c?.verse.ref, ...(r?.verses.map(v => v.ref) ?? [])];
    };
    expect(cited('bina')).toEqual(expect.arrayContaining(['J 11,35', 'Ga 6,2', 'Ps 34,19']));
    expect(cited('keter')).toEqual(expect.arrayContaining(['2 Kor 5,17', 'Ap 21,5']));
    expect(cited('rod')).toEqual(expect.arrayContaining(['Ez 18,20', 'Ga 3,13', '2 Kor 5,17', 'Wj 20,6']));
    expect(cited('szeol')).toEqual(expect.arrayContaining(['Ps 139,8', '1 P 3,18-19', 'Łk 19,10', 'Ef 4,9']));
    const bina = REVELATIONS.find(r => r.id === 'smutek');
    expect(bina?.truth).toMatch(/psycholog/u);
    expect(bina?.truth).toMatch(/psychiatr/u);
  });

  it('has readable palettes: dark floors (Keter may be lighter), bright accents and seeds, muted walls', () => {
    for (const c of CHAPTERS) {
      const { bg1, bg2, accent, wall, seed } = c.palette;
      for (const col of [bg1, bg2, accent, wall, seed]) expect(col, c.id).toMatch(HEX);
      const maxFloor = c.id === 'keter' ? 0.1 : 0.03;
      for (const bg of [bg1, bg2]) {
        expect(luminance(bg), `${c.id} floor`).toBeLessThanOrEqual(maxFloor);
        expect(contrast(seed, bg), `${c.id} seed`).toBeGreaterThanOrEqual(7);
        expect(contrast(accent, bg), `${c.id} accent`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(wall, bg), `${c.id} wall`).toBeGreaterThanOrEqual(1.5);
        expect(contrast(wall, bg), `${c.id} wall`).toBeLessThanOrEqual(4.5);
        for (const t of c.traumas) expect(contrast(TRAUMAS[t].color, bg), `${t} on ${c.id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe('revelations', () => {
  it('are unique, one per chapter plus extras, each with 1–3 verses and a 2–3 sentence truth', () => {
    const ids = REVELATIONS.map(r => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(REVELATIONS.length).toBeGreaterThanOrEqual(CHAPTERS.length + 4);
    for (const r of REVELATIONS) {
      expect(r.verses.length, r.id).toBeGreaterThanOrEqual(1);
      expect(r.verses.length, r.id).toBeLessThanOrEqual(3);
      expect(sentences(r.truth), r.id).toBeGreaterThanOrEqual(2);
      expect(sentences(r.truth), r.id).toBeLessThanOrEqual(3);
      expect(sentences(r.lie), r.id).toBeLessThanOrEqual(2);
    }
  });
});

// ─── prayers ─────────────────────────────────────────────────────────

describe('prayers', () => {
  const UNLOCKS: Record<PrayerId, PrayerDef['unlocks']> = {
    inwokacja: { soundscapes: ['gregorianski'], skins: ['skrzydla_golebie'], powers: ['golebica'] },
    przyjmuje: { ultimate: true, powers: ['ogien', 'wicher'], skins: ['halo_plomien'] },
    rod: { realms: ['rod'], skins: ['szata_rod'] },
    przebaczenie: { powers: ['przebaczenie', 'ucisz'] },
    zbroja: { powers: ['tarcza', 'pancerz', 'helm', 'sandaly'] },
    jezusowa: { soundscapes: ['bizantyjski'], skins: ['szata_przemienienia', 'halo_biel'] },
    zagubieni: { realms: ['szeol'], skins: ['szata_szeol'] },
    klamstwa: { codex: true, powers: ['milosc'] },
    trisagion: {},
  };

  it('are all nine, in order, unlocking what the design says', () => {
    expect(PRAYERS.map(p => p.id)).toEqual([...PRAYER_IDS]);
    for (const p of PRAYERS) expect(p.unlocks, p.id).toEqual(UNLOCKS[p.id]);
  });

  it('unlock only things that exist, consistently with how those things say they unlock', () => {
    for (const p of PRAYERS) {
      for (const realm of p.unlocks.realms ?? []) {
        expect(CHAPTERS.find(c => c.id === realm)?.unlockedBy, `${p.id} → ${realm}`).toBe(p.id);
      }
      for (const power of p.unlocks.powers ?? []) expect(POWER_IDS, `${p.id} → ${power}`).toContain(power);
      for (const skin of p.unlocks.skins ?? []) {
        expect(SKINS.find(s => s.id === skin)?.unlock, `${p.id} → ${skin}`).toEqual({ prayer: p.id });
      }
      for (const sc of p.unlocks.soundscapes ?? []) {
        const unlock = SOUNDSCAPES.find(s => s.id === sc)?.unlock;
        expect(unlock === 'default' || (typeof unlock === 'object' && unlock.prayer === p.id), `${p.id} → ${sc}`).toBe(true);
      }
    }
    const byPrayer = [...SKINS, ...SOUNDSCAPES].filter(
      (x): x is (SkinDef | SoundscapeDef) & { unlock: { prayer: PrayerId } } =>
        typeof x.unlock === 'object' && x.unlock.prayer !== undefined,
    );
    for (const x of byPrayer) {
      const u = prayer(x.unlock.prayer).unlocks;
      expect([...(u.skins ?? []), ...(u.soundscapes ?? [])], x.id).toContain(x.id);
    }
    for (const c of CHAPTERS) {
      if (c.unlockedBy) expect(prayer(c.unlockedBy).unlocks.realms, c.id).toContain(c.id);
    }
  });

  it('are prayers of the heart, not texts to read: one short line, words and plain punctuation only', () => {
    for (const p of PRAYERS) {
      const n = words(p.invocation);
      expect(n, `${p.id}: ${n} words`).toBeGreaterThanOrEqual(2);
      expect(n, `${p.id}: ${n} words`).toBeLessThanOrEqual(12);
      expect(p.invocation, p.id).toMatch(/^[\p{L} ,.!?;:]+$/u);
      expect(p.invocation.endsWith('.'), p.id).toBe(true);
      expect(p.seconds, p.id).toBeGreaterThanOrEqual(15);
      expect(p.seconds, p.id).toBeLessThanOrEqual(120);
      expect(sentences(p.intro), `${p.id} intro`).toBeLessThanOrEqual(2);
      expect(sentences(p.unlockText), `${p.id} unlockText`).toBe(1);
      expect(p.unlockText, `${p.id}: prayer opens, never pays`).toMatch(/^Modlitwa otwiera /u);
    }
  });

  it('keeps the traditional formulas, and the first prayer is short (it opens the game)', () => {
    expect(prayer('jezusowa').invocation).toBe('Panie Jezu Chryste, Synu Boży, zmiłuj się nade mną, grzesznikiem.');
    expect(prayer('trisagion').invocation).toBe('Święty Boże, Święty Mocny, Święty a Nieśmiertelny, zmiłuj się nad nami.');
    expect(prayer('inwokacja').invocation).toBe('Przyjdź, Duchu Święty.');
    expect(prayer('inwokacja').seconds).toBeLessThanOrEqual(30);
    expect(prayer('przyjmuje').invocation).toMatch(/przyjmuję Cię/u);
  });
});

// ─── powers ──────────────────────────────────────────────────────────

describe('powers', () => {
  /** name, verse, and for each level the facts its text must state (case-insensitive) */
  const SPEC: Record<PowerId, [string, string, string[][]]> = {
    slowo: ['Miecz Ducha', 'Ef 6,17', [['10 obrażeń', '2 strzały/s', 'stoisz'], ['+25% obrażeń'], ['+20% szybkostrzelności'], ['przebija jednego cienia'], ['+25% obrażeń', 'szybsze pociski']]],
    chleby: ['Rozmnożenie chlebów', 'Mt 14,20', [['2 pociski', 'wachlarz'], ['3 pociski'], ['4 pociski'], ['5 pocisków']]],
    tarcza: ['Tarcza wiary', 'Ef 6,16', [['1 tarcza', '(6)', 'ogniste strzały'], ['2 tarcze', '(6)'], ['3 tarcze', '(6)'], ['×1,6']]],
    ogien: ['Języki ognia', 'Dz 2,3', [['3,5 s', '1,8', '14 obrażeń'], ['3,1 s', '2,0', '18 obrażeń'], ['2,7 s', '2,2', '22 obrażenia'], ['2,3 s', '2,4', '26 obrażeń'], ['1,9 s', '2,6', '30 obrażeń']]],
    wicher: ['Gwałtowny wicher', 'Dz 2,2', [['6 s', 'odpycha', '0,8 s'], ['5,2 s'], ['4,4 s'], ['3,6 s']]],
    golebica: ['Gołębica', 'Mt 3,16', [['1,5 s', 'naprowadzany', '8 obrażeń'], ['1,3 s', '11 obrażeń'], ['1,1 s', '14 obrażeń'], ['0,9 s', '17 obrażeń']]],
    eliasz: ['Ogień Eliasza', '1 Krl 18,38', [['4 s', '1 losowego', '25 obrażeń'], ['2 losowe', '25 obrażeń'], ['3 losowe', '25 obrażeń'], ['4 losowe', '25 obrażeń']]],
    jerycho: ['Trąby Jerycha', 'Joz 6,20', [['7 s', 'ogniste strzały', 'promieniu 4'], ['ogłusza', '1,2 s'], ['10 obrażeń']]],
    dawid: ['Proca Dawida', '1 Sm 17,49', [['5 s', 'najsilniejszego', '40 obrażeń', 'podwójne na twierdzę'], ['4,3 s', '60 obrażeń'], ['3,6 s', '80 obrażeń'], ['2,9 s', '100 obrażeń']]],
    samson: ['Siła Samsona', 'Sdz 16,28', [['12 obrażeń', 'odrzut', '0,8 s'], ['18 obrażeń', '0,7 s'], ['24 obrażenia', '0,6 s'], ['30 obrażeń', '0,5 s']]],
    manna: ['Manna', 'Wj 16,4', [['1 serce', '25 s'], ['20 s'], ['15 s']]],
    sandaly: ['Obuwie pokoju', 'Ef 6,15', [['+10% szybkości ruchu'], ['+20%'], ['+30%']]],
    pancerz: ['Pancerz sprawiedliwości', 'Ef 6,14', [['15% szansy', 'uniknięcie rany'], ['30%'], ['45%']]],
    helm: ['Hełm zbawienia', 'Ef 6,17', [['raz w rozdziale', '2 sercami']]],
    ucisz: ['Ucisz się!', 'Mk 4,39', [['zranią', 'zamierają', '1,5 s'], ['2 s'], ['2,5 s']]],
    milosc: ['Miłość usuwa lęk', '1 J 4,18', [['12% mniej sił'], ['24% mniej sił'], ['36% mniej sił']]],
    ryba: ['Wielka ryba', 'Jon 2,1', [['zasięg pochłaniania', '+0,35'], ['+0,7'], ['+1,05']]],
    serce: ['Serce z ciała', 'Ez 36,26', [['+1 miejsce na trawienie', '+20% szybkości trawienia'], ['+2 miejsca', '+40%'], ['+3 miejsca', '+60%']]],
    przebaczenie: ['Siedemdziesiąt siedem razy', 'Mt 18,22', [['łaska', '1,5 s', '×16'], ['3 s', '×16'], ['4,5 s', '×16']]],
    gorczyca: ['Ziarnko gorczycy', 'Mt 17,20', [['co 10. ziarno', 'drzewko', 'strzela'], ['co 7. ziarno'], ['co 5. ziarno']]],
  };

  it('defines every power once, with the design numbers in its level texts', () => {
    expect(Object.keys(POWERS).sort()).toEqual([...POWER_IDS].sort());
    for (const id of POWER_IDS) {
      const p = POWERS[id];
      const [name, ref, levels] = SPEC[id];
      expect([p.id, p.name, p.verse.ref, p.maxLevel], id).toEqual([id, name, ref, levels.length]);
      expect(p.levels.length, id).toBe(p.maxLevel);
      levels.forEach((facts, i) => {
        for (const fact of facts) expect(p.levels[i].toLowerCase(), `${id} level ${i + 1}`).toContain(fact.toLowerCase());
      });
      expect(sentences(p.description), id).toBe(1);
    }
  });
});

// ─── fruits, ranks, cosmetics ────────────────────────────────────────

describe('fruits', () => {
  const SPEC: Record<FruitId, [string, string]> = {
    milosc: ['Miłość', 'jedno serce'],
    radosc: ['Radość', '10% więcej światła'],
    pokoj: ['Pokój', '0,3'],
    cierpliwosc: ['Cierpliwość', '15%'],
    uprzejmosc: ['Uprzejmość', '0,5'],
    dobroc: ['Dobroć', '1 s'],
    wiernosc: ['Wierność', '15%'],
    lagodnosc: ['Łagodność', '8%'],
    opanowanie: ['Opanowanie', '10%'],
  };

  it('are the nine fruits of Ga 5,22-23, three levels at 20/40/80 Manna', () => {
    expect(FRUITS.map(f => f.id).sort()).toEqual([...FRUIT_IDS].sort());
    expect(new Set(FRUITS.map(f => f.id)).size).toBe(FRUITS.length);
    for (const f of FRUITS) {
      const [name, fact] = SPEC[f.id];
      expect([f.name, f.maxLevel, f.costs], f.id).toEqual([name, 3, [20, 40, 80]]);
      expect(f.effect, f.id).toContain(fact);
      expect(sentences(f.effect), f.id).toBe(1);
    }
  });
});

describe('ranks', () => {
  const SPEC: [RankId, number, 2 | 4 | 6][] = [
    ['aniol', 0, 2], ['archaniol', 300, 2], ['zwierzchnosci', 900, 2], ['wladze', 1800, 2], ['moce', 3200, 2],
    ['panowania', 5000, 2], ['trony', 7500, 2], ['cherubini', 11000, 4], ['serafini', 16000, 6],
  ];

  it('are the nine choirs, lowest first, by ascending Light', () => {
    expect(RANKS.map(r => r.id)).toEqual([...RANK_IDS]);
    expect(RANKS.map(r => [r.id, r.light, r.wings])).toEqual(SPEC);
    RANKS.forEach((r, i) => {
      if (i > 0) expect(r.light).toBeGreaterThan(RANKS[i - 1].light);
      expect(sentences(r.blessing), r.id).toBe(1);
    });
    expect(RANKS.find(r => r.id === 'serafini')?.verse.ref).toBe('Iz 6,2');
  });
});

describe('cosmetics', () => {
  const SKIN_SPEC: [string, SkinSlot, SkinDef['unlock']][] = [
    ['halo_zlota', 'halo', 'default'],
    ['halo_plomien', 'halo', { prayer: 'przyjmuje' }],
    ['halo_biel', 'halo', { prayer: 'jezusowa' }],
    ['halo_blekit', 'halo', { light: 1500 }],
    ['halo_purpura', 'halo', { rank: 'trony' }],
    ['szata_lniana', 'robe', 'default'],
    ['szata_przemienienia', 'robe', { prayer: 'jezusowa' }],
    ['szata_rod', 'robe', { prayer: 'rod' }],
    ['szata_szeol', 'robe', { prayer: 'zagubieni' }],
    ['szata_krolewska', 'robe', { light: 5000 }],
    ['skrzydla_biale', 'wings', 'default'],
    ['skrzydla_golebie', 'wings', { prayer: 'inwokacja' }],
    ['skrzydla_zlote', 'wings', { rank: 'cherubini' }],
    ['skrzydla_ogniste', 'wings', { rank: 'serafini' }],
  ];

  it('has the designed skins, one default per slot, valid colours', () => {
    expect(SKINS.map(s => [s.id, s.slot, s.unlock])).toEqual(SKIN_SPEC);
    for (const slot of ['halo', 'robe', 'wings'] as const) {
      expect(SKINS.filter(s => s.slot === slot && s.unlock === 'default').length, slot).toBe(1);
    }
    for (const s of SKINS) {
      for (const c of s.colors) expect(c, s.id).toMatch(HEX);
      if (typeof s.unlock === 'object' && s.unlock.rank) expect(RANK_IDS).toContain(s.unlock.rank);
    }
  });

  it('has the designed soundscapes', () => {
    expect(SOUNDSCAPES.map(s => s.id)).toEqual([...SOUNDSCAPE_IDS]);
    expect(SOUNDSCAPES.map(s => s.unlock)).toEqual(['default', 'default', { prayer: 'jezusowa' }, { light: 1500 }, 'default']);
  });
});

// ─── story ───────────────────────────────────────────────────────────

describe('story', () => {
  it('opens with the Trisagion of Isaiah', () => {
    expect(STORY.titleVerse.ref).toBe('Iz 6,3');
  });

  it('is honest about what the game is and where to find help', () => {
    expect(STORY.disclaimer).toMatch(/terapi/u);
    expect(STORY.disclaimer).toMatch(/psycholog/u);
    expect(STORY.disclaimer).toMatch(/psychiatr/u);
    expect(STORY.disclaimer).toMatch(/duszpaster/u);
    for (const n of ['116 123', '116 111', '800 70 2222', '112']) expect(STORY.crisisHelp).toContain(n);
  });

  it('has the expected shape', () => {
    expect(STORY.intro.length).toBeGreaterThanOrEqual(2);
    expect(STORY.intro.length).toBeLessThanOrEqual(4);
    expect(STORY.fall.length).toBeGreaterThanOrEqual(4);
    expect(STORY.finale.length).toBeGreaterThanOrEqual(5);
    expect(STORY.finale.length).toBeLessThanOrEqual(8);
    expect(STORY.whispers.length).toBeGreaterThanOrEqual(24);
    expect(new Set(STORY.whispers.map(v => v.ref)).size).toBe(STORY.whispers.length);
    expect(sentences(STORY.sabbath)).toBeGreaterThanOrEqual(2);
    expect(sentences(STORY.sabbath)).toBeLessThanOrEqual(3);
  });

  it('quotes the verses the design names', () => {
    const quoted = (s: string) => [...s.matchAll(QUOTE)].map(m => m[2]);
    expect(STORY.intro.flatMap(quoted)).toContain('Ps 91,11');
    expect(STORY.fall.flatMap(quoted)).toEqual(expect.arrayContaining(['Mi 7,8', 'Prz 24,16', 'Ps 37,24']));
    expect(STORY.finale.flatMap(quoted)).toEqual(expect.arrayContaining(['Iz 6,3', 'Ap 21,4-5']));
    expect(quoted(STORY.support)).toContain('Mt 10,8');
    expect(quoted(STORY.sabbath)).toEqual(['Ps 46,11', 'Mt 11,28']);
  });
});
