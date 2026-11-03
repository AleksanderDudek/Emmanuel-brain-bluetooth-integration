import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogProblems } from '../src/i18n';
import { CARDS, FIXED, cardFileName, fixKey, howKey, titleKey } from '../src/cards/catalog';
import { GAMES, dailyTrio, gamesOfCard } from '../src/cards/games';
import { headline, sessionStats } from '../src/cards/games/stats';
import type { TrialRecord } from '../src/cards/games/types';
import { CATALOGS } from '../src/cards/i18n';
import { CARD_CATALOGS } from '../src/cards/i18n-cards';
import { ENTRY_CATALOGS } from '../src/cards/i18n-entry';
import { buildPdf, buildZip, crc32 } from '../src/cards/print';
import { CardStore, cardStreak, progressOf, trialsCsv, type CardSession, type GamePlay } from '../src/cards/store';
import { parseRoute } from '../src/ui/router';

const PUBLIC = resolve(__dirname, '../public/cards');

describe('cards: texts', () => {
  it('every catalog has all four languages, the same placeholders and the plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    expect(catalogProblems(CARD_CATALOGS)).toEqual([]);
    expect(catalogProblems(ENTRY_CATALOGS)).toEqual([]);
  });

  it('every card has a title and a how-to, and every corrected card says what was corrected', () => {
    const pl = CARD_CATALOGS.pl as Record<string, unknown>;
    for (const c of CARDS) {
      expect(pl[titleKey(c)], titleKey(c)).toBeTypeOf('string');
      expect(pl[howKey(c)], howKey(c)).toBeTypeOf('string');
      if (c.fixed) expect(pl[fixKey(c)], fixKey(c)).toBeTypeOf('string');
    }
  });
});

describe('cards: the set', () => {
  it('has the 32 cards, numbered in order, with their images', () => {
    expect(CARDS.map(c => c.n)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    for (const c of CARDS) {
      expect(existsSync(resolve(PUBLIC, 'full', `${c.id}.png`)), `full/${c.id}.png`).toBe(true);
      expect(existsSync(resolve(PUBLIC, 'thumb', `${c.id}.webp`)), `thumb/${c.id}.webp`).toBe(true);
      expect(cardFileName(c)).toBe(`emmanuel-karta-${c.id}.png`);
      expect(c.times.length).toBeGreaterThan(0);
      for (const [slow, mid, fast] of c.times) expect(slow >= mid && mid >= fast, `card ${c.n} times`).toBe(true);
    }
    expect([...FIXED].every(n => n >= 1 && n <= 32)).toBe(true);
  });

  it('every card is either played as a game or says why it stays on paper', () => {
    for (const c of CARDS) {
      const games = gamesOfCard(c.n);
      if (c.why) expect(games, `card ${c.n} is print-only (${c.why}) but has a game`).toEqual([]);
      else expect(games.length, `card ${c.n} has neither a game nor a reason`).toBeGreaterThan(0);
    }
    for (const g of GAMES) for (const n of g.cards) expect(n >= 1 && n <= 32).toBe(true);
  });

  it("the day's workout picks three different games, the same all day", () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const day = `2026-11-${String(d).padStart(2, '0')}`;
      const trio = dailyTrio(day);
      expect(new Set(trio).size).toBe(3);
      expect(dailyTrio(day)).toEqual(trio);
      seen.add(trio.join());
    }
    expect(seen.size).toBeGreaterThan(5); // it changes from day to day
  });
});

describe('cards: files to download', () => {
  it('crc32 is the standard one', () => {
    expect(crc32(new TextEncoder().encode('123456789')) >>> 0).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0)) >>> 0).toBe(0);
  });

  it('builds a ZIP whose entries, sizes and checksums read back', () => {
    const a = new TextEncoder().encode('hello cards');
    const b = new Uint8Array(1000).map((_, i) => i & 255);
    const zip = buildZip([{ name: 'a.txt', data: a }, { name: 'karty/b.bin', data: b }], new Date(2026, 10, 3, 12, 30, 10));
    const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // end of central directory: the last 22 bytes (no comment)
    const eocd = zip.length - 22;
    expect(v.getUint32(eocd, true)).toBe(0x06054b50);
    expect(v.getUint16(eocd + 10, true)).toBe(2);
    let cd = v.getUint32(eocd + 16, true);
    const read: { name: string; data: Uint8Array }[] = [];
    for (let k = 0; k < 2; k++) {
      expect(v.getUint32(cd, true)).toBe(0x02014b50);
      const crc = v.getUint32(cd + 16, true), size = v.getUint32(cd + 20, true);
      const nameLen = v.getUint16(cd + 28, true), extra = v.getUint16(cd + 30, true), comment = v.getUint16(cd + 32, true);
      const local = v.getUint32(cd + 42, true);
      const name = new TextDecoder().decode(zip.subarray(cd + 46, cd + 46 + nameLen));
      expect(v.getUint32(local, true)).toBe(0x04034b50);
      expect(v.getUint16(local + 8, true)).toBe(0); // stored
      const lName = v.getUint16(local + 26, true), lExtra = v.getUint16(local + 28, true);
      const data = zip.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
      expect(crc32(data) >>> 0).toBe(crc);
      read.push({ name, data });
      cd += 46 + nameLen + extra + comment;
    }
    expect(read.map(r => r.name)).toEqual(['a.txt', 'karty/b.bin']);
    expect([...read[0].data]).toEqual([...a]);
    expect([...read[1].data]).toEqual([...b]);
  });

  it('builds a PDF whose cross-reference table points at its objects', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdf([{ jpeg, width: 3840, height: 3236 }, { jpeg, width: 3840, height: 2461 }], 'Karty (test)');
    expect(new TextDecoder('latin1').decode(buildPdf([{ jpeg, width: 10, height: 10 }], 'Ćw'))).toContain('<FEFF01060077>');
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('/Count 2');
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const rows = text.slice(xref).split('\n');
    const [, count] = rows[1].split(' ').map(Number);
    for (let n = 1; n < count; n++) {
      const off = Number(rows[2 + n].slice(0, 10));
      expect(text.slice(off, off + `${n} 0 obj`.length), `object ${n}`).toBe(`${n} 0 obj`);
    }
    // the title is UTF-16, and each page draws its image inside the A4 page
    expect(text).toContain('/Title <FEFF004b00610072007400790020002800740065007300740029>');
    for (const m of text.matchAll(/q (\d+(?:\.\d+)?) 0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) cm/g)) {
      const [w, hh, x, y] = m.slice(1).map(Number);
      expect(x + w).toBeLessThanOrEqual(842);
      expect(y + hh).toBeLessThanOrEqual(595);
    }
  });
});

const trial = (i: number, ok: boolean, rt: number | null, extra: Partial<TrialRecord> = {}): TrialRecord =>
  ({ i, level: 1, ok, rt, taps: 1, errors: ok ? 0 : 1, at: i * 1000, ...extra });

function play(game: GamePlay['game'], trials: TrialRecord[], levelEnd = 2): GamePlay {
  return { game, levelStart: 1, levelEnd, plannedSec: 60, playedSec: 60, trials, stats: sessionStats(game, trials, 60), early: 0 };
}

function session(id: string, start: number, plays: GamePlay[]): CardSession {
  return { v: 1, id, kind: 'game', start, end: start + 60, pad: 'local', plays, band: null, sync: null };
}

describe('cards: sessions and progress', () => {
  it('keeps sessions newest first, and settings, in a database of its own', async () => {
    const store = await CardStore.open(`cards-test-${Math.random()}`);
    await store.put(session('a', 1000, [play('palce', [trial(0, true, 500)])]));
    await store.put(session('b', 3000, []));
    await store.put(session('c', 2000, []));
    expect((await store.list()).map(s => s.id)).toEqual(['b', 'c', 'a']);
    await store.remove('c');
    expect((await store.list()).map(s => s.id)).toEqual(['b', 'a']);
    await store.set('prefs', { marks: true });
    expect(await store.get('prefs')).toEqual({ marks: true });
    await store.clear();
    expect(await store.list()).toEqual([]);
    expect(await store.get('prefs')).toEqual({ marks: true });
    store.close();
  });

  it('adds sessions up per game: level to start from, best and history', () => {
    const hl = (p: GamePlay) => headline(p.game, p.stats);
    const slow = play('palce', [trial(0, true, 900), trial(1, true, 950)], 2);
    const fast = play('palce', [trial(0, true, 400), trial(1, true, 420), trial(2, true, 410)], 3);
    const p = progressOf([session('2', 2000, [fast]), session('1', 1000, [slow, play('stroop', [])])], hl);
    const g = p.get('palce')!;
    expect(g.sessions).toBe(2);
    expect(g.level).toBe(3);
    expect(g.history.map(h => h[0])).toEqual([1000, 2000]);
    expect(g.bestAt).toBe(2000);
    expect(p.has('stroop')).toBe(false); // a game with no trials is not progress
  });

  it('counts the streak back from today, or from yesterday before the first session of today', () => {
    const now = new Date(2026, 10, 3, 18, 0).getTime();
    const day = (d: number, h = 10) => new Date(2026, 10, d, h).getTime() / 1000;
    expect(cardStreak([session('a', day(3), []), session('b', day(2), []), session('c', day(1), [])], now)).toBe(3);
    expect(cardStreak([session('b', day(2), []), session('c', day(1), [])], now)).toBe(2);
    expect(cardStreak([session('c', day(1), [])], now)).toBe(0);
  });

  it('writes one CSV row per trial, quoting what needs it', () => {
    const csv = trialsCsv([session('s,1', 1000, [play('stroop', [trial(0, true, 512, { cue: 'coral', cong: 0 }), trial(1, false, null, { timeout: true })])])]);
    const rows = csv.trimEnd().split('\n');
    expect(rows).toHaveLength(3);
    expect(rows[0].split(',')).toContain('rt_ms');
    expect(rows[1].startsWith('"s,1",')).toBe(true);
    expect(rows[1]).toContain(',stroop,0,1,1,512,');
    expect(rows[2]).toContain(',1,'); // timeout flag
  });
});

describe('cards: routes', () => {
  it('opens the cards under Trening', () => {
    expect(parseRoute('#karty')).toMatchObject({ view: 'karty', nav: 'trening', cards: null });
    expect(parseRoute('#karty/07')).toMatchObject({ view: 'karty', cards: '07' });
    expect(parseRoute('#karty/gra/palce')).toMatchObject({ view: 'karty', cards: 'gra/palce' });
    expect(parseRoute('#trening')).toMatchObject({ view: 'trening', cards: null });
  });

  it('game ids are plain words that fit in a route', () => {
    for (const g of GAMES) expect(g.id).toMatch(/^[a-z]+$/);
    expect(GAMES.map(g => g.id)).not.toContain('dzien'); // #karty/gra/dzien is the day's workout
  });

  it('the pad page has the same strict CSP as the app', () => {
    const csp = (f: string) => /http-equiv="Content-Security-Policy"\s+content="([^"]+)"/.exec(readFileSync(resolve(__dirname, '..', f), 'utf8'))?.[1];
    const pad = csp('pad.html');
    expect(pad).toBeTruthy();
    expect(pad).toContain("default-src 'self'");
    expect(pad).not.toContain('unsafe-eval');
  });
});
