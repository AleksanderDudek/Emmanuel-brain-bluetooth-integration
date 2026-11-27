/**
 * "Ciało słucha" — the health visualisations' inner layer (src/arcade/kit/inner.ts, inner-i18n.ts, innerdraw.ts,
 * innerpanel.ts; DESIGN §27): the generic words in four languages and in tone, the player's choices kept and repaired,
 * the words a rest draws, a word received only on a calm, reliable out-breath, the settling-in rest's hold given back,
 * the night's sound, and the lobby's section (happy-dom).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CUES, INTENTS, InnerTrack, InnerWords, MAX_INTENTS, NIGHT, NIGHT_CLOSERS, RECEIVED_CALM, SETTLE, absorbHold, cleanInner, cueText, freshInner,
  innerSource, loadInner, nightLevel, resetInnerMemo, saveInner, toggleIntent, type InnerPrefs,
} from '../src/arcade/kit/inner';
import { INNER } from '../src/arcade/kit/inner-i18n';
import { InnerFx, fitWord, wordLum, wordSizes } from '../src/arcade/kit/innerdraw';
import { innerPanel } from '../src/arcade/kit/innerpanel';
import { ENGINE } from '../src/arcade/kit/healthlib/i18n';
import { FORBIDDEN, maxLen, toneProblems } from '../src/arcade/kit/healthlib/check';
import { SCRIPTURE } from '../src/content/scripture';
import { LANGS, catalogProblems, type Catalog, type Lang } from '../src/i18n';

const look = (l: Lang = 'pl') => {
  const cat = INNER[l] as Readonly<Record<string, string>>;
  const extra: Record<string, string> = { 'word.m.1': 'Słowo pierwsze.', 'word.m.2': 'Słowo drugie.', 'word.m.3': 'Słowo trzecie.' };
  return { has: (k: string) => k in cat || k in extra, t: (k: string) => cat[k] ?? extra[k] ?? k };
};
const prefs = (o: Partial<InnerPrefs> = {}): InnerPrefs => ({ ...freshInner(), ...o });
const WORDLIKE = /^(intent\.[a-z]+|night|settle(?:\.night)?)\.\d$/;

/** A canvas that only measures: a character is 0.55 of the font's size wide. */
function measuring(): CanvasRenderingContext2D {
  const state = { font: '10px sans-serif' };
  const px = () => Number(String(state.font).match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10);
  return {
    get font() { return state.font; },
    set font(v: string) { state.font = v; },
    measureText: (s: string) => ({ width: [...s].length * px() * 0.55 }),
  } as unknown as CanvasRenderingContext2D;
}

describe('the inner layer’s words (inner-i18n.ts)', () => {
  it('has every text in all four languages, with the Polish placeholders', () => {
    expect(catalogProblems(INNER)).toEqual([]);
    const at = (l: Lang, k: string) => (INNER[l] as Readonly<Record<string, string>>)[k];
    for (const l of LANGS) {
      for (const i of INTENTS) for (const k of ['', '.1', '.2', '.3']) expect(at(l, `intent.${i}${k}`), `${l} ${i}${k}`).toBeTruthy();
      for (const c of CUES.filter(c => c !== 'own')) expect(at(l, `cue.${c}`)).toBeTruthy();
      expect(String(ENGINE[l]['tip.feel'])).toMatch(/\S/);
    }
    expect(LANGS.map(l => at(l, 'cue.peace'))).toEqual(['Pokój', 'Peace', 'Friede', 'Frid']);
    expect(INTENTS.map(i => at('pl', `intent.${i}`))).toEqual(['Gojenie', 'Odnowa', 'Młodość', 'Siła', 'Sprawność', 'Piękno', 'Wypoczynek', 'Radość']);
    expect(INTENTS.map(i => at('en', `intent.${i}`))).toEqual(['Healing', 'Renewal', 'Youth', 'Strength', 'Fitness', 'Beauty', 'Rest', 'Joy']);
  });

  it('keeps §24.3’s tone: never a promise, no esoteric words, no gendered Polish; a word is one out-breath', () => {
    expect(toneProblems(INNER as unknown as Record<Lang, Catalog<string>>)).toEqual([]);
    expect(toneProblems({ pl: { 'tip.feel': String(ENGINE.pl['tip.feel']) }, en: { 'tip.feel': String(ENGINE.en['tip.feel']) } })).toEqual([]);
    const more = /wszechświat|podświadom|universe|subconscious|universum|unterbewusst|undermedvet|odmład|verjüng|föryng|rejuven|programuj|program your|energy|energi/iu;
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(INNER[l])) {
        const s = String(v);
        expect(s, `${l}.${k}`).not.toMatch(more);
        const max = maxLen(k);
        if (max !== null) expect(s.length, `${l}.${k}`).toBeLessThanOrEqual(max);
        if (WORDLIKE.test(k)) expect(max, k).toBe(80);
      }
    }
    for (const l of LANGS) expect(FORBIDDEN[l].length).toBeGreaterThanOrEqual(9);
    // the intentions' words speak to the person, about the body
    for (const i of INTENTS) expect([1, 2, 3].some(n => /Tw[oóa]|Tobie|Ciebie|ciało/u.test((INNER.pl as Readonly<Record<string, string>>)[`intent.${i}.${n}`])), i).toBe(true);
  });

  it('closes a night with passages in all four editions', () => {
    expect(NIGHT_CLOSERS).toEqual(['psa4.8', 'psa127.2', 'pro3.24']);
    for (const id of NIGHT_CLOSERS) for (const l of LANGS) expect((SCRIPTURE as unknown as Record<string, Record<Lang, [string, string]>>)[id][l][0].length, `${id} ${l}`).toBeGreaterThan(20);
  });
});

describe('the player’s choices (inner.ts prefs)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInnerMemo();
  });
  afterEach(() => {
    localStorage.clear();
    resetInnerMemo();
  });

  it('round-trips through this device and repairs garbage', () => {
    expect(loadInner()).toEqual(freshInner());
    const p = prefs({ words: false, intents: ['joy', 'rest'], own: '  Twój oddech\n jest spokojny.  ', cue: 'own', cueOwn: 'Szalom', night: true });
    saveInner(p);
    resetInnerMemo();
    expect(loadInner()).toEqual({ v: 1, words: false, intents: ['joy', 'rest'], own: 'Twój oddech jest spokojny.', cue: 'own', cueOwn: 'Szalom', night: true });
    for (const junk of [null, 3, 'x', [], { intents: 'joy' }, { intents: ['joy', 'joy', 'nope', 'rest', 'fit', 'heal'], cue: 'nope', own: 5, night: 'yes' }]) {
      const c = cleanInner(junk);
      expect(c.v).toBe(1);
      expect(c.intents.length).toBeLessThanOrEqual(MAX_INTENTS);
      expect(CUES).toContain(c.cue);
      expect(typeof c.night).toBe('boolean');
    }
    expect(cleanInner({ intents: ['joy', 'joy', 'nope', 'rest', 'fit', 'heal'] }).intents).toEqual(['joy', 'rest', 'fit']);
    expect(cleanInner({ cue: 'own', cueOwn: '   ' }).cue).toBe('peace');
    expect(cleanInner({ own: 'x'.repeat(200) }).own).toHaveLength(80);
    localStorage.setItem('emmanuel.inner.v1', '{not json');
    resetInnerMemo();
    expect(loadInner()).toEqual(freshInner());
  });

  it('keeps at most three intentions: a fourth drops the oldest; a chip again takes it away', () => {
    const p = prefs();
    for (const i of ['heal', 'renew', 'young', 'strong'] as const) toggleIntent(p, i);
    expect(p.intents).toEqual(['renew', 'young', 'strong']);
    toggleIntent(p, 'young');
    expect(p.intents).toEqual(['renew', 'strong']);
  });
});

describe('what a rest shows (InnerWords through innerSource)', () => {
  it('reads the meditation’s words, the intentions’, the night’s and the cue through a translator', () => {
    const src = innerSource(prefs({ cue: 'abba' }), look('pl'));
    expect(src.med('m')).toEqual(['Słowo pierwsze.', 'Słowo drugie.', 'Słowo trzecie.']);
    expect(src.med('none')).toEqual([]);
    expect(src.intent('heal')).toHaveLength(3);
    expect(src.night()).toHaveLength(6);
    expect(src.cue()).toBe('Abba');
    expect(cueText(prefs({ cue: 'own', cueOwn: 'Szalom' }), look('pl'))).toBe('Szalom');
    expect(innerSource(prefs(), look('de')).cue()).toBe('Friede');
  });

  it('turns the settling-in words with the session, so all three come in turn (two breaths a rest)', () => {
    const P = INNER.pl as Readonly<Record<string, string>>;
    const s = (n: number, night = false) => innerSource(prefs(), look('pl'), n).settle(night);
    expect(s(1)).toEqual([P['settle.1'], P['settle.2'], P['settle.3']]);
    expect(s(2)[0]).toBe(P['settle.2']);
    expect(s(3)[0]).toBe(P['settle.3']);
    expect(s(4)[0]).toBe(P['settle.1']);
    expect(s(1, true)[0]).toBe(P['settle.night.1']);
    const w = new InnerWords(prefs(), innerSource(prefs(), look('pl'), 2));
    expect(w.rest('m', SETTLE.breaths, true).map(x => (x.kind === 'settle' ? x.text : x.kind))).toEqual([P['settle.2'], P['settle.3']]);
  });

  it('opens a meditation with its verse, then its words alternate with the player’s; the cue is last', () => {
    const p = prefs({ intents: ['joy'], own: 'Twój oddech jest spokojny.' });
    const w = new InnerWords(p, innerSource(p, look('pl')));
    expect(w.rest('m', 3).map(x => x.kind)).toEqual(['verse', 'verse', 'cue']);
    const from: string[] = [];
    for (let i = 0; i < 6; i++) {
      const r = w.rest('m', 3);
      expect(r.at(-1)).toEqual({ kind: 'cue', text: 'Pokój' });
      expect(r[0]).toEqual(r[1]);
      from.push(r[0].kind === 'word' ? r[0].from : r[0].kind);
    }
    expect(from).toEqual(['med', 'intent', 'med', 'own', 'med', 'intent']);
    // before sleep the night's words come among the player's; the word off: the verse only, no cue
    const n = prefs({ night: true });
    const wn = new InnerWords(n, innerSource(n, look('pl')));
    wn.rest('m', 3);
    wn.rest('m', 3);
    expect(wn.rest('m', 3)[0]).toMatchObject({ kind: 'word', from: 'night' });
    const off = prefs({ words: false });
    const wo = new InnerWords(off, innerSource(off, look('pl')));
    for (let i = 0; i < 3; i++) expect(wo.rest('m', 3).every(x => x.kind === 'verse')).toBe(true);
  });
});

describe('a word received in calm (InnerTrack)', () => {
  const STEP = 1 / 60;
  /** Run a rest of `breaths` with a calm and signal by the second; returns what was received. */
  function rest(track: InnerTrack, med: string, breaths: number, read: (t: number) => { calm: number; reliable: boolean }, settle = false): string[] {
    track.begin(med, breaths, settle);
    const got: string[] = [];
    const n = Math.round((breaths * track.cycle) / STEP);
    for (let i = 1; i < n; i++) {
      const t = i * STEP;
      const r = read(t);
      const g = track.update(t, STEP, r.calm, r.reliable);
      if (g) got.push(`${g.from}:${g.text}`);
    }
    const g = track.end();
    if (g) got.push(`${g.from}:${g.text}`);
    return got;
  }
  /** A track past its meditation's first rest (the verse), the player's intention "rest" chosen. */
  const fresh = () => {
    const p = prefs({ intents: ['rest'] });
    const track = new InnerTrack(new InnerWords(p, innerSource(p, look('pl'))));
    track.begin('m', 3);
    track.end();
    return track;
  };

  it('shows each breath’s word — in 4 s, out 6 s — and knows where the rest is', () => {
    const track = fresh();
    track.begin('m', 3);
    expect(track.at(1)).toMatchObject({ out: false, i: 0, n: 3, show: { kind: 'word', from: 'med' } });
    expect(track.at(4.5)!.out).toBe(true);
    expect(track.at(7)!.p).toBeCloseTo(0.5, 5);
    expect(track.at(25)!.show).toEqual({ kind: 'cue', text: 'Pokój' });
    expect(track.at(99)!.i).toBe(2);
    track.end();
    expect(track.at(1)).toBeNull();
  });

  it('counts only out-breaths held in calm with a reliable signal, the word’s and the cue’s', () => {
    const calm = fresh();
    expect(rest(calm, 'm', 3, () => ({ calm: 0.8, reliable: true }))).toEqual(['med:Słowo pierwsze.', 'med:Słowo pierwsze.', 'cue:Pokój']);
    expect(calm.received).toBe(3);
    expect(calm.receivedBy).toMatchObject({ med: 2, cue: 1 });
    // under the threshold, without a signal, or calm only on the in-breaths: nothing
    expect(rest(fresh(), 'm', 3, () => ({ calm: RECEIVED_CALM - 0.05, reliable: true }))).toEqual([]);
    expect(rest(fresh(), 'm', 3, () => ({ calm: 0.9, reliable: false }))).toEqual([]);
    expect(rest(fresh(), 'm', 3, t => ({ calm: t % 10 < 4 ? 1 : 0.1, reliable: true }))).toEqual([]);
    // calm on the last out-breath only: the cue
    expect(rest(fresh(), 'm', 3, t => ({ calm: t > 24 ? 0.9 : 0.1, reliable: true }))).toEqual(['cue:Pokój']);
    // the verse and the settling-in words are never "received"
    const p = prefs();
    const t2 = new InnerTrack(new InnerWords(p, innerSource(p, look('pl'))));
    expect(rest(t2, 'm', 3, () => ({ calm: 1, reliable: true }))).toEqual(['cue:Pokój']);
    expect(rest(t2, 'm', 2, () => ({ calm: 1, reliable: true }), true)).toEqual([]);
    expect(t2.cueRests).toBe(1);
  });
});

describe('the settling-in rest and the night', () => {
  it('gives the seconds it waited under a card back: the warm-up first, then the pushes, keeping the sum', () => {
    const plan = [
      { kind: 'rest', dur: 20 }, { kind: 'warmup', dur: 30 }, { kind: 'push', dur: 40 }, { kind: 'rest', dur: 30 }, { kind: 'push', dur: 40 }, { kind: 'rest', dur: 30 },
    ];
    const floor = (b: { kind: string }) => (b.kind === 'warmup' ? 6 : 12);
    expect(absorbHold(plan, 1, 33, floor)).toBeCloseTo(0, 9);
    expect(plan.map(b => b.dur)).toEqual([20, 6, 35.5, 30, 35.5, 30]);
    const tight = [{ kind: 'push', dur: 14 }, { kind: 'rest', dur: 10 }];
    expect(absorbHold(tight, 0, 10, floor)).toBeCloseTo(8, 9);
    expect(tight[0].dur).toBe(12);
  });

  it('quietens the sound before sleep and fades it to silence over the last seconds', () => {
    expect(nightLevel(0, 300)).toBeCloseTo(NIGHT.level, 9);
    expect(nightLevel(300 - NIGHT.fadeSec / 2, 300)).toBeCloseTo(NIGHT.level / 2, 9);
    expect(nightLevel(300, 300)).toBe(0);
    expect(nightLevel(400, 300)).toBe(0);
  });
});

describe('the word on the canvas (innerdraw.ts)', () => {
  it('is bright on the out-breath and ~45 % on the in-breath; larger on a desk, the cue larger still', () => {
    expect(wordLum(false, 0.5)).toBeCloseTo(0.45, 9);
    expect(wordLum(true, 0.5)).toBeCloseTo(1, 9);
    expect(wordLum(true, 0)).toBeCloseTo(0.45, 9);
    expect(wordSizes('word', false, 1).min).toBeGreaterThanOrEqual(15);
    expect(wordSizes('word', true, 1.3).min).toBeGreaterThan(wordSizes('word', false, 1).min);
    expect(wordSizes('cue', true, 1.3).max).toBeGreaterThan(wordSizes('word', true, 1.3).max);
  });

  it('fits the longest word whole in three lines at 15 px and more on the narrowest phone', () => {
    const ctx = measuring();
    for (const l of LANGS) {
      const all = Object.entries(INNER[l]).filter(([k]) => WORDLIKE.test(k)).map(([, v]) => String(v));
      const longest = all.reduce((a, b) => (b.length > a.length ? b : a));
      const f = fitWord(ctx, 'word', longest, 328, 66, false, 1);
      expect(f.size, `${l}: ${longest}`).toBeGreaterThanOrEqual(15);
      expect(f.lines.length, `${l}: ${longest}`).toBeLessThanOrEqual(3);
      expect(f.lines.join(' ')).toBe(longest);
    }
  });

  it('carries a received word into the picture as 12–18 motes (none with reduced motion)', () => {
    const fx = new InnerFx(false);
    fx.wordAt = { x: 100, y: 500, w: 160, h: 40 };
    fx.received('Pokój', { x: 180, y: 200 });
    expect(fx.moving).toBeGreaterThanOrEqual(12);
    expect(fx.moving).toBeLessThanOrEqual(18);
    for (let i = 0; i < 150; i++) fx.update(1 / 60);
    expect(fx.moving).toBe(0);
    const still = new InnerFx(true);
    still.wordAt = { x: 100, y: 500, w: 160, h: 40 };
    still.received('Pokój', { x: 180, y: 200 });
    expect(still.moving).toBe(0);
  });
});

describe('the lobby’s section (innerpanel.ts)', () => {
  beforeEach(() => {
    localStorage.clear();
    resetInnerMemo();
  });
  afterEach(() => {
    localStorage.clear();
    resetInnerMemo();
  });

  it('links to the Wiedza, switches the word and the night, and saves for every health visualisation', () => {
    const el = innerPanel({ lang: 'pl' });
    expect(el.textContent).toContain('Ciało słucha');
    expect(el.querySelector('a.inner-link')!.getAttribute('href')).toBe('#wiedza/body');
    const [words, night] = [...el.querySelectorAll<HTMLInputElement>('.switch input')];
    expect(words.checked).toBe(true);
    expect(night.checked).toBe(false);
    night.checked = true;
    night.dispatchEvent(new Event('change'));
    expect(loadInner().night).toBe(true);
    // the word off: its choices step aside (the rests keep the verse), the night stays
    const w2 = el.querySelector<HTMLInputElement>('.switch input')!;
    w2.checked = false;
    w2.dispatchEvent(new Event('change'));
    expect(loadInner().words).toBe(false);
    expect(el.querySelector('.inner-chips')).toBeNull();
    expect(el.querySelectorAll('.switch input')).toHaveLength(2);
    expect(el.querySelectorAll<HTMLInputElement>('.switch input')[1].checked).toBe(true);
  });

  it('presses up to three intention chips (a fourth drops the oldest, a note says so) and keeps the own sentence on the device', () => {
    const el = innerPanel({ lang: 'pl' });
    const chip = (i: string) => el.querySelector<HTMLButtonElement>(`[data-intent="${i}"]`)!;
    expect(el.querySelector('.inner-chips')!.getAttribute('role')).toBe('group');
    for (const i of ['heal', 'renew', 'young', 'strong']) chip(i).click();
    expect(loadInner().intents).toEqual(['renew', 'young', 'strong']);
    expect(chip('heal').getAttribute('aria-pressed')).toBe('false');
    expect(chip('strong').getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain(String(INNER.pl['inner.intentsMax']));
    const own = el.querySelector<HTMLInputElement>('.inner-own input')!;
    expect(own.maxLength).toBe(80);
    own.value = 'Twój oddech jest spokojny.';
    own.dispatchEvent(new Event('input'));
    expect(loadInner().own).toBe('Twój oddech jest spokojny.');
  });

  it('chooses the word of peace, an own one only once a word is typed', () => {
    const el = innerPanel({ lang: 'en' });
    const cue = (c: string) => el.querySelector<HTMLButtonElement>(`[data-cue="${c}"]`)!;
    expect(cue('peace').getAttribute('aria-checked')).toBe('true');
    expect(cue('peace').textContent).toBe('Peace');
    cue('abba').click();
    expect(loadInner().cue).toBe('abba');
    cue('own').click();
    expect(loadInner().cue).toBe('abba');
    const inp = el.querySelector<HTMLInputElement>('.inner-cue-own input')!;
    expect(inp.maxLength).toBe(20);
    inp.value = 'Shalom';
    inp.dispatchEvent(new Event('input'));
    expect(loadInner()).toMatchObject({ cue: 'own', cueOwn: 'Shalom' });
    inp.value = '';
    inp.dispatchEvent(new Event('input'));
    expect(loadInner().cue).toBe('peace');
  });

  it('keeps the keyboard on the control just used, though the section is rebuilt', () => {
    const el = innerPanel({ lang: 'pl' });
    document.body.append(el);
    try {
      const chip = el.querySelector<HTMLButtonElement>('[data-intent="joy"]')!;
      chip.focus();
      chip.click();
      const now = document.activeElement as HTMLElement;
      expect(now).not.toBe(chip); // a new element…
      expect(now.getAttribute('data-intent')).toBe('joy'); // …in the same place
      expect(now.getAttribute('aria-pressed')).toBe('true');
      const night = el.querySelector<HTMLInputElement>('[data-k="night"]')!;
      night.focus();
      night.checked = true;
      night.dispatchEvent(new Event('change'));
      expect((document.activeElement as HTMLElement).getAttribute('data-k')).toBe('night');
      el.querySelector<HTMLButtonElement>('[data-cue="abba"]')!.focus();
      el.querySelector<HTMLButtonElement>('[data-cue="abba"]')!.click();
      expect((document.activeElement as HTMLElement).getAttribute('data-cue')).toBe('abba');
    } finally {
      el.remove();
    }
  });
});
