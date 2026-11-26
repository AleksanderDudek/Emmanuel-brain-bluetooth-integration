// @vitest-environment happy-dom
/**
 * Ogród o świcie's preparation (builder B): the word sets, freshPrep / cleanPrep / prepView, the week, the lobby's
 * section "Twoja droga" and the week's card — in four languages, with the letter never saved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogProblems, type Lang } from '../src/i18n';
import { LETTER_MAX, peekLetter, setLetter, takeLetter } from '../src/arcade/ogrod/letter';
import {
  addFriend, addOwnWord, cleanPrep, cleanWeek, forgetWords, freshPrep, prepView, removeWord, setBefore, setIntention, setOwnKind, setPair,
  setReady, setWayMode, setWithHarsh, toggleKey, toggleStation, wayOf, weekAge, weekLines, weekOf, type GardenPrep,
} from '../src/arcade/ogrod/prep';
import { CATALOGS } from '../src/arcade/ogrod/prep-i18n';
import { prepPanel, summaryOf, weekCard, type Week } from '../src/arcade/ogrod/prep-panel';
import { STATIONS, recommended, stationRoom, stationsFor } from '../src/arcade/ogrod/stations';
import { FRIENDS_MAX, OWN_LEN, PAIRS, PICK, WORDS, ownWord } from '../src/arcade/ogrod/words';

const LANGS: readonly Lang[] = ['pl', 'en', 'de', 'sv'];
const texts = (l: Lang): [string, string][] =>
  Object.entries(CATALOGS[l]).flatMap(([k, m]) => (typeof m === 'string' ? [[k, m]] : Object.values(m).map(s => [k, s as string])) as [string, string][]);

/** Polish second person (and the player's first person) that would give the player a gender. */
const GENDERED = /\p{L}+(łeś|łaś|łem|łam|łbyś|łabyś|łbym|łabym)(?!\p{L})|(?<!\p{L})(sam|sama|samotny|samotna|gotowy|gotowa|gotów|zraniony|zraniona|kochany|kochana)(?!\p{L})|\p{L}+(y|i)\/a(?!\p{L})|(?<!\p{L})(jesteś|jestem|czujesz się|czuję się|zostaniesz|zostanę)\s+\p{L}{2,}(ny|na|ty|ta|wy|wa|ły|ła)(?!\p{L})/iu;
/** The series' red lines (§18.3): no energy, vibration, healing promised, activation, manifesting, magic. */
const FORBIDDEN = /energ|wibrac|vibrat|heal|uzdrow|uleczy|uleczen|heil(t|ung|en)|helande|läk|aktywuj|aktywacj|activat|aktivier|manifest|magi[ac]|magisk/i;

/** The modules again in another language (the language is settled when they load). */
async function inLang(l: Lang) {
  localStorage.setItem('brainlink.lang', l);
  vi.resetModules();
  return {
    prep: await import('../src/arcade/ogrod/prep'),
    panel: await import('../src/arcade/ogrod/prep-panel'),
    words: await import('../src/arcade/ogrod/words'),
  };
}

const today = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── the words ─────────────────────────────────────────────────────

describe('ogród prep: the words', () => {
  it('are complete in four languages, every set word among them, none empty or too long for a chip', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const l of ['en', 'de', 'sv'] as const) expect(Object.keys(CATALOGS[l]).sort()).toEqual(Object.keys(CATALOGS.pl).sort());
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const [set, keys] of Object.entries(WORDS)) {
        for (const k of keys) {
          const s = cat[`w.${set}.${k}`];
          expect(typeof s, `${l} w.${set}.${k}`).toBe('string');
          expect((s as string).trim().length, `${l} w.${set}.${k}`).toBeGreaterThan(1);
          // a chip, a stone or a seed's word on a phone stays short; the pairs and the boundaries are whole lines
          const max = set === 'harsh' || set === 'kind' || set === 'int' ? 64 : 34;
          expect([...(s as string)].length, `${l} w.${set}.${k}`).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it('hold the sets the brief asks for, under stable keys', () => {
    expect(WORDS.feel).toHaveLength(12);
    expect(WORDS.harsh).toHaveLength(8);
    expect(WORDS.kind).toHaveLength(8);
    expect(WORDS.bound).toHaveLength(10);
    expect(WORDS.int).toHaveLength(8);
    expect(WORDS.stone).toEqual(['zal-osoba', 'zal-siebie', 'zal-stalo', 'zal-bog', 'zal-inni']);
    expect(WORDS.seed).toHaveLength(16);
    expect(PAIRS[0]).toEqual(['h1', 'k1']);
    for (const keys of Object.values(WORDS)) expect(new Set(keys).size).toBe(keys.length);
    expect(PICK).toEqual({ feel: [1, 3], bound: [1, 4], stone: [1, 3], seed: [1, 3] });
  });

  it('speak to the player in Polish without gendered forms, and never cross the series\' red lines', () => {
    for (const [k, s] of texts('pl')) expect(s, k).not.toMatch(GENDERED);
    for (const l of LANGS) for (const [k, s] of texts(l)) expect(s, `${l}.${k}`).not.toMatch(FORBIDDEN);
    // no Polish left in the other languages, and each language's own quotation marks
    for (const l of ['en', 'de', 'sv'] as const) for (const [k, s] of texts(l)) expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
    const quoted = (l: Lang) => texts(l).map(([, s]) => s).filter(s => /[„“”"]/.test(s));
    for (const s of quoted('pl')) expect(s).toMatch(/„[^„”"“]+”/);
    for (const s of quoted('de')) expect(s).toMatch(/„[^„”"“]+“/);
    for (const s of quoted('sv')) expect(s).toMatch(/”[^„”"“]+”/);
    for (const s of quoted('en')) expect(s).toMatch(/“[^„”"“]+”/);
  });

  it('carry the help lines and "not therapy" in the care line, in every language', () => {
    expect(CATALOGS.pl['p.care']).toMatch(/116 123.*116 111.*112/);
    expect(CATALOGS.pl['p.care']).toMatch(/nie terapia/);
    expect(CATALOGS.de['p.care']).toMatch(/0800 111 0 111.*112/);
    expect(CATALOGS.sv['p.care']).toMatch(/90101.*112/);
    expect(CATALOGS.en['p.care']).toMatch(/not therapy.*crisis line/);
    for (const l of LANGS) expect(String(CATALOGS[l]['p.privacy']).length).toBeGreaterThan(20);
  });

  it('cleans own words: trimmed, spaces folded, control characters gone, at most 24 characters', () => {
    expect(ownWord('  moja   tęsknota \n')).toBe('moja tęsknota');
    expect(ownWord('a\u0007b')).toBe('a b');
    expect([...ownWord('ż'.repeat(40))]).toHaveLength(OWN_LEN);
    for (const v of [null, 3, {}, '   ']) expect(ownWord(v)).toBe('');
  });
});

// ── fresh, clean, view ────────────────────────────────────────────

describe('ogród prep: freshPrep and cleanPrep', () => {
  it('fresh: good defaults for a session with no effort — one of each, a pair, a ready stone, the recommended way', () => {
    const f = freshPrep();
    expect(f.way).toBeNull();
    expect(f.feelings).toHaveLength(1);
    expect(f.kind.harsh).not.toBeNull();
    expect(f.bounds).toHaveLength(1);
    expect(f.stones).toEqual([{ w: { k: 'zal-osoba' }, ready: true }]);
    expect(f.seeds).toHaveLength(1);
    expect(f.friends).toEqual([]);
    expect(f.hurt).toBe(false);
    expect(f.before).toBeNull();
    expect(cleanPrep(freshPrep())).toEqual(f);
    for (const sec of [180, 300, 600, 900, 1800]) expect(stationsFor(sec, f.way)).toEqual(recommended(sec));
  });

  it('a missing or broken save of any kind is a fresh one', () => {
    for (const v of [undefined, null, 0, 'x', [], true, 12.5]) expect(cleanPrep(v)).toEqual(freshPrep());
    const wrong = {
      v: 7, way: 'lzy', feelings: 'smutek', kind: 'k1', bounds: {}, intention: 42, stones: [null, 1, { w: 'x' }], friends: 'Ania',
      hurt: 'yes', seeds: [{ k: 'nope' }], name: 7, before: 'high',
    };
    expect(cleanPrep(wrong)).toEqual(freshPrep());
  });

  it('repairs in place: the same object, unknown keys gone (a letter never stays), limits kept, own words cut', () => {
    const long = 'x'.repeat(60);
    const saved: Record<string, unknown> = {
      v: 1,
      way: ['nasiona', 'lzy', 'bogus', 'lzy', 'furtka'],
      feelings: [{ k: 'zal' }, { k: 'zal' }, { o: '  bezradność ' }, { k: 'pustka' }, { k: 'lek' }, { o: '' }, { x: 1 }],
      kind: { harsh: { k: 'k3' }, kind: { k: 'k3' } },
      bounds: [{ k: 'zdjecia' }, { o: long }, { k: 'noc' }, { k: 'znak' }, { k: 'profil' }, { k: 'miejsca' }],
      intention: 'i4',
      stones: [{ w: { k: 'zal-bog' }, ready: false }, { w: { k: 'zal-bog' } }, { w: { o: 'żal o czas' }, ready: 'maybe' }, { w: { k: 'zal-siebie' } }, { w: { k: 'zal-inni' } }],
      friends: ['Ania', ' ania ', 'Kuba', '', 3, 'Ola', 'Piotr', 'Zosia', 'Marek', long],
      hurt: true,
      seeds: [{ k: 'muzyka' }, { o: 'Muzyka' }, { k: 'ruch' }],
      name: '  Mario  ',
      before: 6.6,
      letter: 'Kochany…',
      extra: { a: 1 },
    };
    const out = cleanPrep(saved);
    expect(out).toBe(saved as unknown as GardenPrep);
    expect(Object.keys(saved).sort()).toEqual(Object.keys(freshPrep()).sort());
    expect('letter' in saved).toBe(false);
    expect(out.way).toEqual(['lzy', 'furtka', 'nasiona']);
    expect(out.feelings).toEqual([{ k: 'zal' }, { o: 'bezradność' }, { k: 'pustka' }]);
    // a harsh key from the kind set is not a harsh word: the kind word stays alone
    expect(out.kind).toEqual({ harsh: null, kind: { k: 'k3' } });
    expect(out.bounds).toHaveLength(4);
    expect(out.bounds[1]).toEqual({ o: 'x'.repeat(OWN_LEN) });
    expect(out.intention).toBe('i4');
    expect(out.stones).toEqual([{ w: { k: 'zal-bog' }, ready: false }, { w: { o: 'żal o czas' }, ready: true }, { w: { k: 'zal-siebie' }, ready: true }]);
    expect(out.friends).toEqual(['Ania', 'Kuba', 'Ola', 'Piotr', 'Zosia']);
    expect(out.friends).toHaveLength(FRIENDS_MAX);
    expect(out.hurt).toBe(true);
    // an own word that reads like a set's word is the same word
    expect(out.seeds).toEqual([{ k: 'muzyka' }, { k: 'ruch' }]);
    expect(out.name).toBe('Mario');
    expect(out.before).toBe(7);
  });

  it('keeps "before" a whole 0–10 or nothing, and the way a known list or the recommended one', () => {
    const b = (v: unknown) => cleanPrep({ ...freshPrep(), before: v }).before;
    expect([b(0), b(10), b(3.4), b(-1), b(11), b(NaN), b('5'), b(null), b(Infinity)]).toEqual([0, 10, 3, null, null, null, null, null, null]);
    const w = (v: unknown) => cleanPrep({ ...freshPrep(), way: v }).way;
    expect(w([])).toBeNull();
    expect(w(['x', 'y'])).toBeNull();
    expect(w([...STATIONS].reverse())).toEqual([...STATIONS]);
    expect(w({ 0: 'lzy' })).toBeNull();
  });
});

describe('ogród prep: prepView', () => {
  it('resolves the words in the page\'s language, own words as typed, lanterns me → friends → hurt → all', () => {
    const p = freshPrep();
    p.feelings = [{ k: 'tesknota' }, { o: 'bezradność' }];
    setPair(p, 1, true);
    p.bounds = [{ k: 'zdjecia' }, { o: 'jego bluza' }];
    setIntention(p, 'i3');
    p.stones = [{ w: { k: 'zal-siebie' }, ready: false }, { w: { o: 'żal o czas' }, ready: true }];
    p.friends = ['Ania', 'Kuba'];
    p.hurt = true;
    p.seeds = [{ k: 'odwaga' }, { o: 'gotowanie' }];
    p.name = 'Mario';
    p.before = 8;
    const v = prepView(p);
    expect(v.feelings).toEqual(['tęsknota', 'bezradność']);
    expect(v.harsh).toBe('Nikt mnie nie pokocha');
    expect(v.kind).toBe('Moja wartość nie zależy od jednej relacji');
    expect(v.bounds).toEqual(['zdjęcia', 'jego bluza']);
    expect(v.intention).toBe('Nie będę zaglądać na profil tej osoby');
    expect(v.stones).toEqual([{ text: 'żal do siebie', ready: false }, { text: 'żal o czas', ready: true }]);
    expect(v.lanterns.map(x => x.who)).toEqual(['me', 'friend', 'friend', 'hurt', 'all']);
    expect(v.lanterns.map(x => x.text)).toEqual(['Dla mnie', 'Ania', 'Kuba', 'Dla osoby, która mnie zraniła', 'Dla wszystkich ze złamanym sercem']);
    expect(v.seeds).toEqual(['odwaga', 'gotowanie']);
    expect(v.name).toBe('Mario');
    expect(v.before).toBe(8);
    // the one who hurt only when chosen; no name is null; the original is never changed by reading it
    p.hurt = false;
    p.name = '';
    expect(prepView(p).lanterns.map(x => x.who)).toEqual(['me', 'friend', 'friend', 'all']);
    expect(prepView(p).name).toBeNull();
    const broken = { v: 1, feelings: 'x' } as unknown as GardenPrep;
    expect(prepView(broken).feelings).toEqual(['smutek']);
    expect(broken.feelings).toBe('x');
  });

  afterEach(() => { localStorage.setItem('brainlink.lang', 'pl'); });

  it('reads naturally in English, German and Swedish', async () => {
    const want: Record<string, [string, string, string]> = {
      en: ['For me', 'For Anna', 'For everyone with a broken heart'],
      de: ['Für mich', 'Für Anna', 'Für alle mit gebrochenem Herzen'],
      sv: ['För mig', 'För Anna', 'För alla med krossat hjärta'],
    };
    for (const l of ['en', 'de', 'sv'] as const) {
      const { prep } = await inLang(l);
      const p = prep.freshPrep();
      p.friends = ['Anna'];
      const v = prep.prepView(p);
      expect(v.lanterns.map(x => x.text), l).toEqual(want[l]);
      expect(v.feelings[0], l).not.toBe('smutek');
      for (const s of [...v.feelings, v.kind, ...v.bounds, ...v.stones.map(x => x.text), ...v.seeds]) expect(s, l).not.toMatch(/[ąćęłńśźż]/);
    }
  });
});

// ── the lobby's changes ───────────────────────────────────────────

describe('ogród prep: the changes keep their limits', () => {
  it('lists: at most and at least, no doubles, own words cut', () => {
    const p = freshPrep();
    expect(toggleKey(p, 'feelings', 'smutek')).toBe('min');
    expect(toggleKey(p, 'feelings', 'zal')).toBe('ok');
    expect(addOwnWord(p, 'feelings', '  pustka w środku   i więcej słów niż trzeba  ')).toBe('ok');
    expect(p.feelings[2]).toEqual({ o: 'pustka w środku i więcej' });
    expect(toggleKey(p, 'feelings', 'lek')).toBe('max');
    expect(addOwnWord(p, 'feelings', 'Żal')).toBe('dup');
    expect(addOwnWord(p, 'feelings', '   ')).toBe('empty');
    expect(toggleKey(p, 'feelings', 'nope')).toBe('empty');
    expect(removeWord(p, 'feelings', 2)).toBe('ok');
    expect(removeWord(p, 'feelings', 9)).toBe('empty');
    expect(toggleKey(p, 'bounds', 'zdjecia')).toBe('ok');
    expect(toggleKey(p, 'bounds', 'noc')).toBe('ok');
    expect(toggleKey(p, 'bounds', 'znak')).toBe('ok');
    expect(toggleKey(p, 'bounds', 'profil')).toBe('max');
    expect(toggleKey(p, 'stones', 'zal-bog')).toBe('ok');
    expect(p.stones[1]).toEqual({ w: { k: 'zal-bog' }, ready: true });
    setReady(p, 1, false);
    expect(p.stones[1].ready).toBe(false);
    expect(cleanPrep(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('the way: a switch makes it the player\'s own, the last station stays, "Polecana" brings the recommended back', () => {
    const p = freshPrep();
    expect(wayOf(p, 300)).toEqual(recommended(300));
    expect(toggleStation(p, 'nasiona', 300)).toBe('ok');
    expect(p.way).toEqual([...recommended(300), 'nasiona']);
    for (const s of ['lzy', 'dlon', 'list'] as const) expect(toggleStation(p, s, 300)).toBe('ok');
    expect(p.way).toEqual(['nasiona']);
    expect(toggleStation(p, 'nasiona', 300)).toBe('min');
    setWayMode(p, false, 300);
    expect(p.way).toBeNull();
    setWayMode(p, true, 900);
    expect(p.way).toEqual(recommended(900));
  });

  it('the kind word, the friends, the name, before, and forgetting', () => {
    const p = freshPrep();
    setPair(p, 6, true);
    expect(p.kind).toEqual({ harsh: { k: 'h7' }, kind: { k: 'k7' } });
    setWithHarsh(p, false);
    expect(p.kind).toEqual({ harsh: null, kind: { k: 'k7' } });
    expect(setOwnKind(p, '', '  ')).toBe('empty');
    expect(setOwnKind(p, 'Wszystko psuję', 'Uczę się krok po kroku')).toBe('ok');
    expect(p.kind).toEqual({ harsh: { o: 'Wszystko psuję' }, kind: { o: 'Uczę się krok po kroku' } });
    for (const n of ['Ania', 'Kuba', 'Ola', 'Piotr', 'Zosia']) expect(addFriend(p, n)).toBe('ok');
    expect(addFriend(p, 'Marek')).toBe('max');
    expect(addFriend(p, 'ania')).toBe('dup');
    setBefore(p, 4);
    expect(p.before).toBe(4);
    setBefore(p, 12);
    expect(p.before).toBeNull();
    p.way = ['lzy'];
    p.before = 3;
    forgetWords(p);
    expect(p).toEqual({ ...freshPrep(), way: ['lzy'], before: 3 });
  });
});

// ── the week ──────────────────────────────────────────────────────

describe('ogród prep: the week', () => {
  const prepped = (): GardenPrep => {
    const p = freshPrep();
    setIntention(p, 'i1');
    p.friends = ['Ania', 'Kuba'];
    p.seeds = [{ k: 'muzyka' }, { o: 'gotowanie' }];
    return p;
  };

  it('keeps what the walked stations carried (texts for the seeds), and nothing for those not walked', () => {
    expect(weekOf(prepped(), '2026-11-25')).toEqual({ day: '2026-11-25', intention: 'i1', friends: ['Ania', 'Kuba'], seeds: ['muzyka', 'gotowanie'] });
    expect(weekOf(prepped(), '2026-11-25', ['lzy', 'dlon', 'list'])).toEqual({ day: '2026-11-25', intention: null, friends: [], seeds: [] });
    expect(weekOf(prepped(), '2026-11-25', ['latarnie']).friends).toEqual(['Ania', 'Kuba']);
  });

  it('cleans a saved week, and says it in a card for seven days', () => {
    for (const v of [null, 1, 'x', {}, { day: 'yesterday' }]) expect(cleanWeek(v)).toBeNull();
    expect(cleanWeek({ day: '2026-11-20', intention: 'bogus', friends: ['  Ola ', 3], seeds: ['muzyka', ''] }))
      .toEqual({ day: '2026-11-20', intention: null, friends: ['Ola'], seeds: ['muzyka'] });
    const w: Week = { day: '2026-11-20', intention: 'i1', friends: ['Ania', 'Kuba'], seeds: ['muzyka'] };
    expect(weekAge(w, '2026-11-25')).toBe(5);
    const lines = weekLines(w, '2026-11-25')!;
    expect(lines.head).toBe('Na ten tydzień');
    expect(lines.day).toMatch(/^Z ogrodu, /);
    expect(lines.items.map(i => i.text)).toEqual([
      'Wyciszę powiadomienia od tej osoby',
      'Napisz albo zadzwoń do: Ania, Kuba.',
      'Zrób coś małego dla tego, co zasiane: muzyka.',
      'Zacznij od jednej rzeczy.',
    ]);
    // without names it still points to a real person
    expect(weekLines({ ...w, friends: [], intention: null, seeds: [] }, '2026-11-25')!.items.map(i => i.text))
      .toEqual(['Napisz albo zadzwoń do kogoś bliskiego.', 'Zacznij od jednej rzeczy.']);
    expect(weekLines(w, '2026-11-27')).not.toBeNull();
    expect(weekLines(w, '2026-11-28')).toBeNull();
    expect(weekLines(null)).toBeNull();
  });
});

// ── the section (DOM) ─────────────────────────────────────────────

/** A lobby card: its progress, the saves (as JSON, like the app's store), the section. */
function mount(sec = 300, prep: GardenPrep = freshPrep()) {
  const progress = { prep, week: null as Week | null, sessions: 0 };
  const saves: string[] = [];
  const el = prepPanel(progress.prep, () => saves.push(JSON.stringify(progress)), () => sec);
  document.body.replaceChildren(el);
  const $ = <T extends HTMLElement = HTMLElement>(k: string): T => {
    const x = el.querySelector<T>(`[data-k="${k}"]`);
    if (!x) throw new Error(`no [data-k="${k}"]`);
    return x;
  };
  return { progress, saves, el, $, p: progress.prep };
}

const type = (input: HTMLInputElement | HTMLTextAreaElement, v: string): void => {
  input.value = v;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('ogród prep: the lobby section', () => {
  beforeEach(() => { takeLetter(); });
  afterEach(() => { takeLetter(); localStorage.setItem('brainlink.lang', 'pl'); });

  it('shows the way: seven switches as recommended, the dawn last and always on, what fits the length', () => {
    const { el, p, saves, $ } = mount(300);
    const sws = [...el.querySelectorAll<HTMLElement>('.og-st .og-sw')];
    expect(sws).toHaveLength(7);
    expect(sws.filter(s => s.getAttribute('aria-checked') === 'true').map(s => s.closest('li')!.dataset.st)).toEqual(recommended(300));
    const rows = [...el.querySelectorAll<HTMLElement>('.og-path > li')];
    expect(rows.map(r => r.dataset.st)).toEqual([...STATIONS, 'swit']);
    expect(rows[7].textContent).toMatch(/zawsze na końcu/);
    expect(el.querySelector('.og-fit')!.textContent).toBe('Na 5 min: 3 stacje, a potem świt.');
    expect($('way-rec').getAttribute('aria-checked')).toBe('true');
    expect($('way-rec').textContent).toBe('Polecana droga na 5 min');
    // a switch makes the way the player's own (and saves)
    $('sw-nasiona').click();
    expect(p.way).toEqual(['lzy', 'dlon', 'list', 'nasiona']);
    expect(saves).toHaveLength(1);
    expect(document.activeElement).toBe($('sw-nasiona'));
    expect($('way-own').getAttribute('aria-checked')).toBe('true');
    // all seven chosen at 5 minutes: what fits, and the rows that will wait say so
    p.way = [...STATIONS];
    $('way-own').click();
    const room = stationRoom(300);
    expect(room).toBeLessThan(7);
    expect(el.querySelector('.og-fit')!.textContent).toBe(`Na 5 min zmieści się ${room} stacji; reszta poczeka na dłuższą sesję.`);
    const waits = [...el.querySelectorAll<HTMLElement>('.og-st.nofit')].map(r => r.dataset.st);
    expect(waits).toEqual(STATIONS.filter(s => !stationsFor(300, STATIONS).includes(s)));
    for (const r of el.querySelectorAll('.og-st.nofit')) expect(r.textContent).toMatch(/nie zmieści się w 5 min/);
    // the last station stays, with a word why
    p.way = ['lzy'];
    $('way-own').click();
    $('sw-lzy').click();
    expect(p.way).toEqual(['lzy']);
    expect(el.querySelector('.og-msg')!.textContent).toBe('Przynajmniej jedna stacja zostaje w drodze.');
    // back to the recommended way
    $('way-rec').click();
    expect(p.way).toBeNull();
  });

  it('opens one station\'s choices at a time, and summarises each chosen station in one line', () => {
    const { el, p, $ } = mount(1800);
    expect(el.querySelectorAll('.og-sum')).toHaveLength(8);
    expect(summaryOf(p, 'lzy')).toBe('smutek');
    expect(summaryOf(p, 'dlon')).toBe('„To wszystko moja wina” → „Biorę na siebie moją część — nie całość”');
    expect(summaryOf(p, 'list')).toBe('Bez listu — popłynie zapieczętowana, pusta kartka.');
    expect(summaryOf(p, 'latarnie')).toBe('ja · wszyscy ze złamanym sercem');
    expect(el.querySelectorAll('.og-ed')).toHaveLength(0);
    $('ch-lzy').click();
    expect(el.querySelectorAll('.og-ed')).toHaveLength(1);
    expect($('ch-lzy').getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe($('ch-lzy'));
    $('ch-kamienie').click();
    expect(el.querySelectorAll('.og-ed')).toHaveLength(1);
    expect(el.querySelector('.og-ed')!.closest('li')!.dataset.st).toBe('kamienie');
    $('ch-kamienie').click();
    expect(el.querySelectorAll('.og-ed')).toHaveLength(0);
    // every editor opens without trouble
    for (const s of [...STATIONS, 'swit']) {
      $(`ch-${s}`).click();
      expect(el.querySelector('.og-ed')!.closest('li')!.dataset.st).toBe(s);
    }
  });

  it('adds and removes own words, keeps the limits with a word, and keeps the focus where it was', () => {
    const { el, p, $, saves } = mount(1800);
    $('ch-lzy').click();
    $('w-feelings-tesknota').click();
    expect(document.activeElement).toBe($('w-feelings-tesknota'));
    expect($('w-feelings-tesknota').getAttribute('aria-pressed')).toBe('true');
    type($<HTMLInputElement>('own-feelings'), '  bezradność ');
    $('own-feelings-add').click();
    expect(p.feelings).toEqual([{ k: 'smutek' }, { k: 'tesknota' }, { o: 'bezradność' }]);
    expect(el.querySelector('[data-sum="lzy"]')!.textContent).toBe('smutek · tęsknota · bezradność');
    $('w-feelings-lek').click();
    expect(p.feelings).toHaveLength(3);
    expect(el.querySelector('.og-msg')!.textContent).toBe('Najwyżej 3 — odznacz jedno, by wybrać inne.');
    $('ownw-feelings-2').click();
    expect(p.feelings).toEqual([{ k: 'smutek' }, { k: 'tesknota' }]);
    // Enter adds too
    const own = $<HTMLInputElement>('own-feelings');
    type(own, 'ulga');
    own.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(p.feelings).toEqual([{ k: 'smutek' }, { k: 'tesknota' }, { k: 'ulga' }]);
    // the lanterns: names, the one who hurt (off by default)
    $('ch-latarnie').click();
    expect($('hurt').getAttribute('aria-checked')).toBe('false');
    for (const n of ['Ania', 'Kuba']) {
      type($<HTMLInputElement>('own-friend'), n);
      $('own-friend-add').click();
    }
    expect(p.friends).toEqual(['Ania', 'Kuba']);
    $('hurt').click();
    expect(p.hurt).toBe(true);
    expect(el.querySelector('[data-sum="latarnie"]')!.textContent).toBe('ja · Ania · Kuba · osoba, która mnie zraniła · wszyscy ze złamanym sercem');
    $('friend-0').click();
    expect(p.friends).toEqual(['Kuba']);
    // the stones: "not yet" is a choice
    $('ch-kamienie').click();
    $('ready-0-false').click();
    expect(p.stones[0].ready).toBe(false);
    expect(el.textContent).toMatch(/Możesz go jeszcze potrzymać/);
    expect(el.querySelector('[data-sum="kamienie"]')!.textContent).toBe('żal do tej osoby (jeszcze nie teraz)');
    $('w-stones-zal-bog').click();
    expect(el.textContent).toMatch(/skarga też jest modlitwą/);
    // the gate's boundary
    $('ch-furtka').click();
    $('int-i2').click();
    expect(p.intention).toBe('i2');
    $('int-none').click();
    expect(p.intention).toBeNull();
    // the hand: a pair, the kind word alone, own words
    $('ch-dlon').click();
    $('pair-3').click();
    expect(p.kind).toEqual({ harsh: { k: 'h4' }, kind: { k: 'k4' } });
    $('harsh-false').click();
    expect(p.kind).toEqual({ harsh: null, kind: { k: 'k4' } });
    type($<HTMLInputElement>('own-kind'), 'Uczę się krok po kroku');
    $('own-kind-save').click();
    expect(p.kind).toEqual({ harsh: null, kind: { o: 'Uczę się krok po kroku' } });
    $('own-kind-back').click();
    expect(p.kind).toEqual({ harsh: { k: 'h1' }, kind: { k: 'k1' } });
    // the seeds
    $('ch-nasiona').click();
    $('w-seeds-odwaga').click();
    expect(p.seeds).toEqual([{ k: 'czulosc' }, { k: 'odwaga' }]);
    // the dawn's name: kept as typed, saved when the field is left
    $('ch-swit').click();
    const name = $<HTMLInputElement>('name');
    const before = saves.length;
    type(name, ' Mario ');
    expect(p.name).toBe('Mario');
    expect(saves.length).toBe(before);
    expect(el.querySelector('[data-sum="swit"]')!.textContent).toBe('Zawołanie: „Mario”');
    name.dispatchEvent(new Event('change', { bubbles: true }));
    expect(saves.length).toBe(before + 1);
    expect(JSON.parse(saves.at(-1)!).prep.name).toBe('Mario');
  });

  it('never saves the letter: it lives in letter.ts, fills the field again on a redraw, and is gone for the session', () => {
    const { el, p, $, saves } = mount(600);
    $('ch-list').click();
    const area = $<HTMLTextAreaElement>('letter');
    expect(area.maxLength).toBe(LETTER_MAX);
    const secret = 'Piszę do ciebie po raz ostatni — dziękuję za wszystko, co było dobre.';
    const n = saves.length;
    type(area, secret);
    expect(peekLetter()).toBe(secret);
    expect(saves.length).toBe(n);
    expect(el.querySelector('[data-sum="list"]')!.textContent).toBe(`List: ${[...secret].length} znaków — odpłynie i zniknie.`);
    // other changes save the progress — never with the letter in it
    $('ch-lzy').click();
    $('w-feelings-zal').click();
    $('before-6').click();
    $('ch-list').click();
    expect($<HTMLTextAreaElement>('letter').value).toBe(secret);
    expect(saves.length).toBeGreaterThan(n);
    for (const s of saves) {
      expect(s).not.toContain('Piszę do ciebie');
      expect(s).not.toMatch(/letter/i);
    }
    expect(JSON.stringify(p)).not.toContain('Piszę');
    // too long is cut at the limit
    type($<HTMLTextAreaElement>('letter'), 'a'.repeat(LETTER_MAX + 50));
    expect(peekLetter()).toHaveLength(LETTER_MAX);
    // the clear button, and "forget my words" lets it go too
    type($<HTMLTextAreaElement>('letter'), secret);
    $('letter-clear').click();
    expect(peekLetter()).toBe('');
    setLetter(secret);
    $('forget').click();
    expect(peekLetter()).toBe('');
    expect(el.textContent).toMatch(/Słowa i imiona zapomniane/);
  });

  it('asks how heavy the heart is, 0–10, optional and cleared by a second tap', () => {
    const { el, p, $ } = mount();
    const scale = el.querySelectorAll('.og-scale button');
    expect(scale).toHaveLength(11);
    $('before-7').click();
    expect(p.before).toBe(7);
    expect($('before-7').getAttribute('aria-checked')).toBe('true');
    $('before-7').click();
    expect(p.before).toBeNull();
    $('before-2').click();
    $('before-clear').click();
    expect(p.before).toBeNull();
    expect(document.activeElement).toBe($('before-2'));
    expect(el.textContent).toMatch(/Jak ciężko jest dziś twojemu sercu\?/);
    expect(el.textContent).toMatch(/116 123/);
    expect(el.textContent).toMatch(/List nie jest zapisywany/);
  });

  it('follows the lobby\'s length when another is chosen', () => {
    const len = document.createElement('div');
    len.id = 'arcadeLen';
    document.body.append(len);
    let sec = 300;
    const p = freshPrep();
    const el = prepPanel(p, () => undefined, () => sec);
    document.body.append(el);
    expect(el.querySelector('.og-fit')!.textContent).toBe('Na 5 min: 3 stacje, a potem świt.');
    sec = 1800;
    len.click();
    expect(el.querySelector('.og-fit')!.textContent).toBe('Na 30 min: 7 stacji, a potem świt.');
    expect([...el.querySelectorAll('.og-sw[aria-checked="true"]')]).toHaveLength(7);
    len.remove();
  });

  it('shows the week\'s card for seven days, and nothing for an old or missing week', () => {
    const p = freshPrep();
    expect(weekCard(p, null)).toBeNull();
    expect(weekCard(p, { day: daysAgo(8), intention: null, friends: [], seeds: [] })).toBeNull();
    const card = weekCard(p, { day: today(), intention: 'i5', friends: ['Ola'], seeds: ['odwaga', 'muzyka'] })!;
    expect(card).not.toBeNull();
    expect(card.querySelector('.og-week-title')!.textContent).toBe('Na ten tydzień');
    expect([...card.querySelectorAll('.og-week-item')].map(li => li.textContent)).toEqual([
      'Odłożę telefon godzinę przed snem', 'Napisz albo zadzwoń do: Ola.', 'Zrób coś małego dla tego, co zasiane: odwaga, muzyka.', 'Zacznij od jednej rzeczy.',
    ]);
  });

  it('reads in English, German and Swedish: no Polish, no placeholder left, nothing empty', async () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      const { prep, panel } = await inLang(l);
      const p = prep.freshPrep();
      p.way = [...STATIONS];
      p.friends = ['Anna'];
      p.hurt = true;
      p.before = 5;
      p.stones[0].ready = false;
      const el = panel.prepPanel(p, () => undefined, () => 600);
      document.body.replaceChildren(el);
      for (const s of [...STATIONS, 'swit']) {
        el.querySelector<HTMLElement>(`[data-k="ch-${s}"]`)!.click();
        const text = el.textContent ?? '';
        expect(text, `${l} ${s}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\{\w+\}|undefined|null/);
      }
      const card = panel.weekCard(p, { day: today(), intention: 'i8', friends: ['Anna'], seeds: ['x'] })!;
      expect(card.textContent, l).not.toMatch(/[ąćęłńśźż]|\{\w+\}/);
    }
  });

  it('fits a 360-px phone: every control a finger\'s size by its classes, text never under 13 px', async () => {
    // happy-dom lays nothing out: the stylesheet's own rules for the section are read instead
    const fs = await import('node:fs');
    const css = fs.readFileSync(`${process.cwd()}/src/styles.css`, 'utf8');
    const block = css.slice(css.indexOf('/* Ogród o świcie'));
    expect(block.length).toBeGreaterThan(1000);
    for (const m of block.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(13);
    for (const sel of ['.og-chip{', '.og-own{', '.og-sw{', '.og-change{', '.og-pair,.og-opt{', '.og-scale .btn{', '.og-ways .btn{']) expect(block, sel).toContain(sel);
    expect(block).toMatch(/\.og-chip\{[^}]*min-height:44px/);
    expect(block).toMatch(/\.og-sw\{[^}]*height:44px/);
    expect(block).toMatch(/\.og-change\{[^}]*min-height:44px/);
    expect(block).toMatch(/\.og-pair,\.og-opt\{[^}]*min-height:44px/);
    expect(block).toMatch(/\.og-scale \.btn\{[^}]*min-height:44px/);
    // inputs at 16 px: a phone does not zoom into them
    expect(block).toMatch(/\.og-own input,\.og-field input,\.og-ed>input\{[^}]*font-size:16px/);
    expect(block).toMatch(/\.og-letter\{[^}]*font-size:16px/);
    // no inline styles from the section (the CSP forbids style attributes)
    const { el } = mount(1800);
    for (const s of [...STATIONS, 'swit']) el.querySelector<HTMLElement>(`[data-k="ch-${s}"]`)!.click();
    expect(el.querySelectorAll('[style]')).toHaveLength(0);
  });
});
