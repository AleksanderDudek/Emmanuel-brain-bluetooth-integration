// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';
import type { PlayerState } from '../src/arcade/kit/music';
import { longestFit } from '../src/arcade/kit/playlist';
import type { GameEnv } from '../src/arcade/kit/types';
import { HeartAmbient, impulse } from '../src/arcade/kintsugi/music/ambient';
import { PLAYER_MIN, TITLE_H, cornerPlace, fitPlayer } from '../src/arcade/kintsugi/music/card';
import { CATALOGS } from '../src/arcade/kintsugi/music/i18n';
import { SessionMusic, cleanMusic, freshMusic, musicPanel, type MusicPrefs, type SessionPlayer } from '../src/arcade/kintsugi/music/index';
import { fitLine, fitOf } from '../src/arcade/kintsugi/music/panel';
import { OWN_MAX, TITLE_MAX, activeTracks, addOwn, removeOwn, setAll, setOn } from '../src/arcade/kintsugi/music/prefs';
import {
  CHORDS, KEY_PCS, MOODS, PENTA_PCS, PROGRESSIONS, chordPcs, melodyPool, nextIndex, nextNote, pc, phrase,
} from '../src/arcade/kintsugi/music/score';
import { BUILTIN } from '../src/arcade/kintsugi/music/tracks';
import type { MusicStage } from '../src/arcade/kintsugi/music/types';

const STAGES: MusicStage[] = ['arrive', 'gather', 'gold', 'beat', 'radiance', 'close'];

// ── prefs ─────────────────────────────────────────────────────────

describe('kintsugi music: the founder\'s tracks', () => {
  it('are the eleven, in his order, with their lengths', () => {
    expect(BUILTIN.map(b => b.id)).toEqual([
      'Pclv31cDTTc', 'fpT5X6HhK3g', 'UvGGetm6pZ4', '-y-5Nba_Nz4', 'qD3P7RULGIY', '1WgHGd5qfCM', 'KGiwGcmBv1Q', 'SSpH8Hsx8Q0', 'TM3ENUzUCaA', 'kYivP3gedCo', 'c1XCS0g6J4A',
    ]);
    expect(BUILTIN.map(b => b.sec)).toEqual([439, 586, 237, 239, 190, 207, 718, 224, 436, 588, 781]);
    // the three Gurmukhi mantras say what they are
    expect(BUILTIN.filter(b => b.note === 'note.mantra').map(b => b.title)).toEqual(['Sat Gur Prasad', 'Ra Ma Da Sa', 'Ong Namo']);
  });
});

describe('kintsugi music: cleanMusic', () => {
  it('a missing or wrong save is a fresh one', () => {
    for (const v of [undefined, null, 0, 'x', [], true]) expect(cleanMusic(v)).toEqual(freshMusic());
    expect(freshMusic()).toEqual({ mode: 'tracks', youtube: false, off: [], own: [], recent: {} });
  });

  it('keeps a good save as it is', () => {
    const m: MusicPrefs = {
      mode: 'ambient', youtube: true, off: ['KGiwGcmBv1Q', 'abcdefghijk'],
      own: [{ id: 'abcdefghijk', sec: 279, title: 'Psalm' }], recent: { qD3P7RULGIY: 1, Pclv31cDTTc: 3 },
    };
    expect(cleanMusic(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it('repairs every field of a wrong type', () => {
    const m = cleanMusic({ mode: 'loud', youtube: 'yes', off: 'KGiwGcmBv1Q', own: { id: 'abcdefghijk' }, recent: [1, 2] });
    expect(m).toEqual(freshMusic());
  });

  it('drops unknown ids from off, invalid own tracks and odd rotation values', () => {
    const m = cleanMusic({
      mode: 'silence',
      youtube: 1,
      off: ['KGiwGcmBv1Q', 'nope', 42, null, 'KGiwGcmBv1Q', 'zzzzzzzzzzz'],
      own: [
        { id: 'zzzzzzzzzzz', sec: 200, title: '  Mój   psalm  ' },
        { id: 'zzzzzzzzzzz', sec: 300, title: 'twice' },          // the same id again
        { id: 'qD3P7RULGIY', sec: 190, title: 'built-in' },       // a built-in is not an own track
        { id: 'short', sec: 200, title: 'bad id' },
        { id: 'yyyyyyyyyyy', sec: 5, title: 'too short' },
        { id: 'xxxxxxxxxxx', sec: 99999, title: 'too long' },
        { id: 'wwwwwwwwwww', sec: Number.NaN, title: 'nan' },
        { id: 'vvvvvvvvvvv', sec: 240, title: 7 },
        'junk', null,
      ],
      recent: { qD3P7RULGIY: 1, Pclv31cDTTc: Number.POSITIVE_INFINITY, UvGGetm6pZ4: 7, '<b>': 1, '1WgHGd5qfCM': '2', SSpH8Hsx8Q0: 2.2 },
    });
    expect(m.mode).toBe('silence');
    expect(m.youtube).toBe(false);
    expect(m.own).toEqual([{ id: 'zzzzzzzzzzz', sec: 200, title: 'Mój psalm' }, { id: 'vvvvvvvvvvv', sec: 240, title: 'vvvvvvvvvvv' }]);
    expect(m.off).toEqual(['KGiwGcmBv1Q', 'zzzzzzzzzzz']);
    expect(m.recent).toEqual({ qD3P7RULGIY: 1, SSpH8Hsx8Q0: 2 });
  });

  it('repairs an object in place: whoever holds it (the lobby\'s section) keeps it through a migration', () => {
    const held = { mode: 'tracks', youtube: false, off: ['nope'], own: [], recent: {}, junk: 1 } as unknown as MusicPrefs;
    const p = { music: held };
    p.music = cleanMusic(p.music);
    expect(p.music).toBe(held);
    expect(held).toEqual(freshMusic());   // the unknown id and the unknown key are gone
    held.youtube = true;                   // the section's consent …
    p.music = cleanMusic(p.music);         // … survives the game's migration running again
    expect(p.music.youtube).toBe(true);
    expect(p.music).toBe(held);
  });

  it('withstands a hostile save (huge lists, markup, prototype keys)', () => {
    const own = Array.from({ length: 500 }, (_, i) => ({ id: `a${String(i).padStart(10, '0')}`, sec: 200, title: `<img src=x onerror=alert(1)>${'x'.repeat(500)}` }));
    const m = cleanMusic(JSON.parse(`{"__proto__":{"polluted":1},"mode":"tracks","own":${JSON.stringify(own)},"recent":{"__proto__":1,"constructor":1}}`));
    expect(m.own).toHaveLength(OWN_MAX);
    for (const o of m.own) expect([...o.title].length).toBeLessThanOrEqual(TITLE_MAX);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(m.recent)).toBe(Object.prototype);
    expect(Object.keys(m.recent).every(k => k.length === 11)).toBe(true);   // only what reads as a video id
  });
});

describe('kintsugi music: the active list', () => {
  it('is the built-ins not switched off, then the own ones', () => {
    const m = freshMusic();
    expect(activeTracks(m)).toHaveLength(11);
    setOn(m, 'KGiwGcmBv1Q', false);
    setOn(m, 'c1XCS0g6J4A', false);
    const r = addOwn(m, 'https://youtu.be/abcdefghijk?si=xyz', '4:39', 'Mój', id => id);
    expect(r.ok).toBe(true);
    expect(activeTracks(m).map(x => x.id)).toEqual([...BUILTIN.map(b => b.id).filter(id => id !== 'KGiwGcmBv1Q' && id !== 'c1XCS0g6J4A'), 'abcdefghijk']);
    expect(activeTracks(m).at(-1)).toEqual({ id: 'abcdefghijk', sec: 279 });
    setOn(m, 'abcdefghijk', false);
    expect(activeTracks(m).some(x => x.id === 'abcdefghijk')).toBe(false);
    setAll(m, false);
    expect(activeTracks(m)).toEqual([]);
    setAll(m, true);
    expect(activeTracks(m)).toHaveLength(12);
    m.recent = { abcdefghijk: 1 };
    removeOwn(m, 'abcdefghijk');
    expect(m.own).toEqual([]);
    expect(m.recent).toEqual({});
  });

  it('adding an own track checks the link, the length, doubles and the limit', () => {
    const m = freshMusic();
    expect(addOwn(m, 'https://example.com/x', '4:39', '', id => id)).toEqual({ ok: false, error: 'link' });
    expect(addOwn(m, 'https://www.youtube.com/watch?v=abcdefghijk', 'soon', '', id => id)).toEqual({ ok: false, error: 'length' });
    expect(addOwn(m, 'qD3P7RULGIY', '3:10', '', id => id)).toEqual({ ok: false, error: 'dup' });
    const ok = addOwn(m, 'https://www.youtube.com/watch?v=abcdefghijk&t=10', '45:00', '', id => `YT ${id}`);
    expect(ok).toMatchObject({ ok: true, tooLong: true, track: { id: 'abcdefghijk', sec: 2700, title: 'YT abcdefghijk' } });
    expect(addOwn(m, 'abcdefghijk', '3:00', '', id => id)).toEqual({ ok: false, error: 'dup' });
    for (let i = m.own.length; i < OWN_MAX; i++) expect(addOwn(m, `b${String(i).padStart(10, '0')}`, '3:00', `n${i}`, id => id).ok).toBe(true);
    expect(addOwn(m, 'ccccccccccc', '3:00', '', id => id)).toEqual({ ok: false, error: 'full' });
  });
});

// ── the lobby section ─────────────────────────────────────────────

function lengthBox(minutes: number[], chosen: number): HTMLElement {
  document.getElementById('arcadeLen')?.remove();
  const box = document.createElement('div');
  box.id = 'arcadeLen';
  for (const m of minutes) {
    const b = document.createElement('button');
    b.setAttribute('aria-checked', String(m === chosen));
    b.dataset.min = String(m);
    b.addEventListener('click', () => box.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', String(x === b))));
    box.append(b);
  }
  document.body.append(box);
  return box;
}

describe('kintsugi music: the lobby section', () => {
  let sec = 600;
  let saves = 0;
  const panel = (m: MusicPrefs): HTMLElement => {
    const el = musicPanel(m, () => { saves++; }, () => sec);
    document.body.append(el);
    return el;
  };
  beforeEach(() => {
    document.body.replaceChildren();
    sec = 600;
    saves = 0;
  });

  it('renders the three ways, the consent box and the eleven rows', () => {
    const el = panel(freshMusic());
    const ways = [...el.querySelectorAll('[role="radio"]')];
    expect(ways.map(b => b.textContent)).toEqual(['Utwory i muzyka tła', 'Tylko muzyka tła', 'Cisza']);
    expect(ways[0].getAttribute('aria-checked')).toBe('true');
    const consent = el.querySelector('.kin-music-consent')!;
    expect(consent.textContent).toContain('youtube-nocookie.com');
    expect(consent.textContent).toContain('adres IP');
    expect(consent.textContent).toContain('reklam');
    expect(el.querySelectorAll('.kin-music-row')).toHaveLength(11);
    expect(el.querySelectorAll('.kin-music-extra')).toHaveLength(5);   // a phone shows six, then "Pokaż wszystkie"
    expect(el.querySelector('[data-k="more"]')!.textContent).toBe('Pokaż wszystkie (11)');
    // a listen link per row opens YouTube itself, never an embed or a thumbnail in the lobby
    const links = [...el.querySelectorAll<HTMLAnchorElement>('a.kin-music-yt')];
    expect(links).toHaveLength(11);
    expect(links[0].getAttribute('href')).toBe('https://www.youtube.com/watch?v=Pclv31cDTTc');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(el.querySelectorAll('iframe, img')).toHaveLength(0);
  });

  it('on an iPhone or iPad says, once the tracks are on, that they play at the phone’s volume', () => {
    const ua = Object.getOwnPropertyDescriptor(Navigator.prototype, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15' });
    try {
      const m = { ...freshMusic(), youtube: true };
      const el = panel(m);
      expect(el.querySelector('.kin-music-ios')?.textContent).toMatch(/głośnością telefonu/);
      el.querySelector<HTMLButtonElement>('[data-k="withdraw"]')!.click();
      expect(el.querySelector('.kin-music-ios')).toBeNull();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).userAgent;
      if (ua && navigator.userAgent === undefined) Object.defineProperty(Navigator.prototype, 'userAgent', ua);
    }
  });

  it('consent: "Włącz utwory z YouTube" agrees and saves; it can be withdrawn; "Tylko muzyka tła" chooses the ambient', () => {
    const m = freshMusic();
    const el = panel(m);
    el.querySelector<HTMLButtonElement>('[data-k="consent"]')!.click();
    expect(m.youtube).toBe(true);
    expect(saves).toBe(1);
    expect(el.querySelector('.kin-music-consent')).toBeNull();
    // not on an iPhone: no word about the phone's volume
    expect(el.querySelector('.kin-music-ios')).toBeNull();
    el.querySelector<HTMLButtonElement>('[data-k="withdraw"]')!.click();
    expect(m.youtube).toBe(false);
    expect(el.querySelector('.kin-music-consent')).not.toBeNull();
    const only = [...el.querySelectorAll<HTMLButtonElement>('.kin-music-consent button')].find(b => b.textContent === 'Tylko muzyka tła')!;
    only.click();
    expect(m.mode).toBe('ambient');
    expect(el.querySelectorAll('.kin-music-row')).toHaveLength(0);
    expect(saves).toBe(3);
  });

  it('a switch turns a track off and on and saves; all / none', () => {
    const m = freshMusic();
    const el = panel(m);
    const sw = () => el.querySelector<HTMLButtonElement>('[data-k="sw-KGiwGcmBv1Q"]')!;
    expect(sw().getAttribute('role')).toBe('switch');
    expect(sw().getAttribute('aria-checked')).toBe('true');
    sw().click();
    expect(m.off).toEqual(['KGiwGcmBv1Q']);
    expect(sw().getAttribute('aria-checked')).toBe('false');
    expect(saves).toBe(1);
    sw().click();
    expect(m.off).toEqual([]);
    el.querySelector<HTMLButtonElement>('[data-k="none"]')!.click();
    expect(m.off).toHaveLength(11);
    expect(el.querySelector('.kin-music-fit')!.textContent).toBe('Żaden utwór nie jest włączony — gra muzyka tła.');
    el.querySelector<HTMLButtonElement>('[data-k="all"]')!.click();
    expect(m.off).toEqual([]);
    expect(saves).toBe(4);
  });

  it('the fit line for 3, 5 and 15 minutes, re-read when the lobby\'s length changes', () => {
    const box = lengthBox([3, 5, 10, 15], 3);
    const minutes = () => Number(box.querySelector<HTMLElement>('[aria-checked="true"]')!.dataset.min);
    const m = freshMusic();
    const el = musicPanel(m, () => undefined, () => minutes() * 60);
    document.body.append(el);
    const fit = () => el.querySelector('.kin-music-fit')!.textContent!;
    expect(fit()).toBe('Na 3 min żaden utwór się nie zmieści — gra muzyka tła. Utwory mieszczą się od 5 min.');
    // every row is marked "nie zmieści się w 3 min", none hidden
    expect(el.querySelectorAll('.kin-music-row.nofit')).toHaveLength(11);
    box.querySelector<HTMLButtonElement>('[data-min="5"]')!.click();
    expect(fit()).toMatch(/^Na 5 min zmieści się 1 utwór \(w całości\), resztę czasu gra muzyka tła\.$/);
    // at 5 min only the short ones fit (longestFit(300) = 249 s)
    const nofit = [...el.querySelectorAll<HTMLElement>('.kin-music-row.nofit')].map(r => r.dataset.id);
    expect(nofit).toEqual(BUILTIN.filter(b => b.sec > longestFit(300)).map(b => b.id));
    expect(el.querySelector('[data-id="KGiwGcmBv1Q"] .kin-music-warn')!.textContent).toBe('nie zmieści się w 5 min');
    box.querySelector<HTMLButtonElement>('[data-min="15"]')!.click();
    expect(fit()).toMatch(/^Na 15 min zmieszczą się \d(–\d)? utwory \(w całości\), resztę czasu gra muzyka tła\.$/);
    // only Ong Namo (13:01) is longer than a 15-minute session leaves room for (12:27)
    expect([...el.querySelectorAll<HTMLElement>('.kin-music-row.nofit')].map(r => r.dataset.id)).toEqual(['c1XCS0g6J4A']);
  });

  it('fitOf / fitLine: none on, none fits now, none fits ever, some', () => {
    expect(fitOf([], 600)).toEqual({ kind: 'empty' });
    expect(fitOf([{ id: 'a', sec: 2400 }], 600)).toEqual({ kind: 'never' });
    expect(fitLine({ kind: 'never' }, 600)).toBe('Żaden z włączonych utworów nie mieści się nawet w 30 min — gra muzyka tła.');
    expect(fitOf([{ id: 'a', sec: 400 }], 300)).toEqual({ kind: 'none', from: 10 });
    const f = fitOf(BUILTIN, 1800);
    expect(f.kind).toBe('some');
    if (f.kind === 'some') { expect(f.lo).toBeGreaterThanOrEqual(2); expect(f.hi).toBeLessThanOrEqual(8); expect(f.lo).toBeLessThanOrEqual(f.hi); }
    expect(fitLine({ kind: 'some', lo: 2, hi: 5 }, 1200)).toBe('Na 20 min zmieści się 2–5 utworów (w całości), resztę czasu gra muzyka tła.');
    expect(fitLine({ kind: 'some', lo: 3, hi: 3 }, 900)).toBe('Na 15 min zmieszczą się 3 utwory (w całości), resztę czasu gra muzyka tła.');
  });

  it('adding own tracks: valid, a bad link, a bad length, the limit; removing one', () => {
    const m = freshMusic();
    const el = panel(m);
    const fill = (link: string, len: string, name = '') => {
      el.querySelector<HTMLInputElement>('[data-k="own-link"]')!.value = link;
      el.querySelector<HTMLInputElement>('[data-k="own-len"]')!.value = len;
      el.querySelector<HTMLInputElement>('[data-k="own-name"]')!.value = name;
      el.querySelector<HTMLButtonElement>('[data-k="own-add"]')!.click();
    };
    const msg = () => el.querySelector('.kin-music-msg')!.textContent;
    fill('https://vimeo.com/123', '4:39');
    expect(msg()).toBe('To nie wygląda na link do filmu na YouTube.');
    expect(el.querySelector('[data-k="own-link"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(m.own).toEqual([]);
    fill('https://youtu.be/abcdefghijk', 'długo');
    expect(msg()).toBe('Wpisz długość utworu, np. 4:39 (od 0:20 do 3 godzin).');
    expect(el.querySelector('[data-k="own-len"]')!.getAttribute('aria-invalid')).toBe('true');
    expect(saves).toBe(0);
    fill('https://youtu.be/abcdefghijk', '4:39', 'Mój psalm');
    expect(m.own).toEqual([{ id: 'abcdefghijk', sec: 279, title: 'Mój psalm' }]);
    expect(saves).toBe(1);
    expect(msg()).toBe('Dodano: Mój psalm.');
    const row = el.querySelector('[data-id="abcdefghijk"]')!;
    expect(row.classList.contains('own')).toBe(true);
    expect(row.textContent).toContain('własny');
    for (let i = 1; i < OWN_MAX; i++) fill(`b${String(i).padStart(10, '0')}`, '3:00');
    expect(m.own).toHaveLength(OWN_MAX);
    expect(el.querySelector<HTMLButtonElement>('[data-k="own-add"]')!.disabled).toBe(true);
    fill('ccccccccccc', '3:00');
    expect(m.own).toHaveLength(OWN_MAX);
    el.querySelector<HTMLButtonElement>('[data-id="abcdefghijk"] .kin-music-x')!.click();
    expect(m.own.some(o => o.id === 'abcdefghijk')).toBe(false);
    expect(msg()).toBe('Usunięto: Mój psalm.');
  });

  it('typed words stay text, never markup', () => {
    const m = freshMusic();
    m.own = [{ id: 'abcdefghijk', sec: 200, title: '<img src=x onerror=alert(1)>' }];
    const el = panel(m);
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('[data-id="abcdefghijk"] .kin-music-name')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });
});

// ── the session ───────────────────────────────────────────────────

class FakePlayer implements SessionPlayer {
  state: PlayerState = 'none';
  time = 0;
  duration = 0;
  error: number | null = null;
  blocked = false;
  loads: string[] = [];
  volume = -1;
  destroyed = false;
  constructor(readonly host: HTMLElement) {}
  load(id: string): void { this.loads.push(id); this.state = 'unstarted'; this.time = 0; }
  play(): void { this.state = 'playing'; }
  pause(): void { this.state = 'paused'; }
  setVolume(v: number): void { this.volume = v; }
  destroy(): void { this.destroyed = true; }
}

function sessionEnv(o: { level?: number; sec?: number } = {}): { env: GameEnv<object>; hud: HTMLElement } {
  const hud = document.createElement('div');
  document.body.append(hud);
  const env = {
    hud, audio: { ctx: null, out: null, level: o.level ?? 0.8 }, rng: mulberry32(7), plannedSec: o.sec ?? 900, touch: true,
    insets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }), hudTop: () => 0,
  } as unknown as GameEnv<object>;
  return { env, hud };
}

const consented = (): MusicPrefs => ({ ...freshMusic(), youtube: true });
const mood = { stage: 'gather' as MusicStage, light: 0.5, rest: false };

describe('kintsugi music: SessionMusic', () => {
  beforeEach(() => { document.body.replaceChildren(); });

  it('no player without consent, offline, with the sound off, in "ambient" or "silence", or when nothing fits', () => {
    const cases: [MusicPrefs, { level?: number; sec?: number }, boolean][] = [
      [freshMusic(), {}, true],
      [consented(), {}, false],
      [consented(), { level: 0 }, true],
      [{ ...consented(), mode: 'ambient' }, {}, true],
      [{ ...consented(), mode: 'silence' }, {}, true],
      [consented(), { sec: 180 }, true],
      [{ ...consented(), off: BUILTIN.map(b => b.id) }, {}, true],
    ];
    cases.forEach(([prefs, e, online], i) => {
      const { env, hud } = sessionEnv(e);
      let made = 0;
      const music = new SessionMusic(env, prefs, { player: host => { made++; return new FakePlayer(host); }, online: () => online && i !== 1 });
      music.start();
      for (let t = 0; t < 900; t += 5) music.update(t, 5, mood);
      expect(made, `case ${i}`).toBe(0);
      expect(music.plan, `case ${i}`).toBeNull();
      expect(hud.querySelector('.kin-player'), `case ${i}`).toBeNull();
      expect(music.now.show).toBe(false);
      expect(music.played).toEqual([]);
      expect(music.stat()[1]).toBe(prefs.mode === 'silence' ? 'cisza' : 'muzyka tła');
      music.destroy();
    });
  });

  it('with consent: the card shows while a track loads and plays, fades between, the rotation remembers it', () => {
    const { env, hud } = sessionEnv({ sec: 900 });
    const prefs = consented();
    prefs.recent = { Pclv31cDTTc: 3, qD3P7RULGIY: 1 };
    let player: FakePlayer | null = null;
    const music = new SessionMusic(env, prefs, { player: host => (player = new FakePlayer(host)), online: () => true });
    expect(music.plan).not.toBeNull();
    const first = music.plan!.slots[0];
    music.place({ x: 20, y: 400, w: 320, h: 228 });
    music.start();
    const card = hud.querySelector<HTMLElement>('.kin-player')!;
    expect(card).not.toBeNull();
    expect(card.classList.contains('on')).toBe(false);
    expect(player!.host.parentElement).toBe(card);
    // the frame is at least 200 × 200 inside the place given
    const frame = card.querySelector<HTMLElement>('.kin-player-frame')!;
    expect(parseFloat(frame.style.width)).toBeGreaterThanOrEqual(PLAYER_MIN);
    expect(parseFloat(frame.style.height)).toBeGreaterThanOrEqual(PLAYER_MIN);
    music.update(first.at - 1, 1, mood);
    expect(player!.loads).toEqual([]);
    music.update(first.at, 1, mood);
    expect(player!.loads).toEqual([first.id]);
    expect(card.classList.contains('on')).toBe(true);
    expect(card.querySelector('.kin-player-title')!.textContent).toMatch(/^♪ /);
    player!.state = 'playing';
    player!.duration = first.sec;
    music.update(first.at + 1, 1, mood);
    expect(music.now.phase).toBe('track');
    player!.time = 40;
    music.update(first.at + 2, 1, mood);
    expect(music.played).toEqual([first.id]);
    player!.state = 'ended';
    music.update(first.at + first.sec, 1, mood);
    expect(music.now.show).toBe(false);
    expect(card.classList.contains('on')).toBe(false);
    const after = music.recentAfter();
    expect(after[first.id]).toBe(1);
    expect(music.recentAfter()).toEqual(after);              // idempotent
    prefs.recent = after;                                     // the meditation writes it back …
    expect(music.recentAfter()).toEqual(after);              // … and it does not age twice
    expect(music.stat()).toEqual(['Muzyka', '1 utwór i muzyka tła']);
    music.destroy();
    expect(hud.querySelector('.kin-player')).toBeNull();
    expect(player!.destroyed).toBe(true);
    expect(music.played).toEqual([first.id]);
  });

  it('when the browser wants a tap: the card asks once, and "Tylko muzyka tła" ends the tracks for this session', () => {
    const { env, hud } = sessionEnv({ sec: 1800 });
    let player: FakePlayer | null = null;
    const music = new SessionMusic(env, consented(), { player: host => (player = new FakePlayer(host)), online: () => true });
    music.start();
    const first = music.plan!.slots[0];
    music.update(first.at, 1, mood);
    player!.blocked = true;
    music.update(first.at + 1, 1, mood);
    expect(music.now.tap).toBe(true);
    const tap = hud.querySelector<HTMLElement>('.kin-player-tap')!;
    expect(tap.hidden).toBe(false);
    expect(tap.textContent).toContain('Stuknij ▶ w odtwarzaczu');
    tap.querySelector<HTMLButtonElement>('button')!.click();
    expect(hud.querySelector('.kin-player')).toBeNull();
    expect(player!.destroyed).toBe(true);
    expect(music.now.phase).toBe('done');
    for (let t = first.at + 2; t < 1800; t += 10) music.update(t, 10, mood);
    expect(player!.loads).toEqual([first.id]);
    expect(music.canStop()).toBe(true);
    music.destroy();
  });

  it('pause pauses the track; finish stops it; canStop waits only for a closing fade', () => {
    const { env } = sessionEnv({ sec: 600 });
    let player: FakePlayer | null = null;
    const music = new SessionMusic(env, consented(), { player: host => (player = new FakePlayer(host)), online: () => true });
    music.start();
    const first = music.plan!.slots[0];
    music.update(first.at, 1, mood);
    player!.state = 'playing';
    music.update(first.at + 1, 1, mood);
    music.pause(true);
    expect(player!.state).toBe('paused');
    music.pause(false);
    expect(player!.state).toBe('playing');
    expect(music.canStop()).toBe(true);
    music.finish();
    expect(player!.state).toBe('paused');
    expect(player!.volume).toBe(0);
    expect(music.now.phase).toBe('done');
    music.destroy();
  });

  it('the card falls back to a lower corner, and keeps the player at least 200 × 200 in any place', () => {
    expect(fitPlayer({ x: 0, y: 0, w: 120, h: 90 })).toMatchObject({ w: 200, h: 200 });
    expect(fitPlayer({ x: 0, y: 0, w: 400, h: 253 })).toEqual({ x: 0, y: 0, w: 400, h: 225 });
    const wide = fitPlayer({ x: 100, y: 50, w: 900, h: 328 });
    expect(wide.h).toBe(300);
    expect(wide.w).toBe(533);
    expect(Math.abs(wide.x + wide.w / 2 - 550)).toBeLessThanOrEqual(1);   // centred in the place
    const c = cornerPlace(390, 664, { top: 120, right: 0, bottom: 34, left: 0 });
    expect(c.x + c.w).toBeLessThanOrEqual(390 - 12);
    expect(c.y + c.h).toBeLessThanOrEqual(664 - 34 - 12);
    expect(c.h).toBe(PLAYER_MIN + TITLE_H);
  });
});

// ── the score ─────────────────────────────────────────────────────

describe('kintsugi music: the score', () => {
  it('every chord is in E-flat major (the close\'s minor plagal the one borrowed note), every progression names real chords', () => {
    for (const [name, c] of Object.entries(CHORDS)) {
      const out = [...chordPcs(c)].filter(p => !KEY_PCS.includes(p));
      expect(out, name).toEqual(name === 'iv' ? [11] : []);
      expect(c.pad).toHaveLength(4);
      expect(Math.min(...c.pad)).toBeGreaterThan(c.bass);
    }
    for (const s of STAGES) for (const n of PROGRESSIONS[s]) expect(CHORDS[n], `${s}: ${n}`).toBeDefined();
    // the close resolves and holds the tonic
    expect(PROGRESSIONS.close.at(-1)).toBe('I');
    expect(nextIndex('close', 2)).toBe(2);
    expect(nextIndex('gather', 7)).toBe(0);
  });

  it('chords change slowly (8–18 s), the stages grow brighter towards radiance', () => {
    for (const s of STAGES) {
      expect(MOODS[s].chord[0]).toBeGreaterThanOrEqual(8);
      expect(MOODS[s].chord[1]).toBeLessThanOrEqual(18);
    }
    expect(MOODS.arrive.cutoff).toBeLessThan(MOODS.gather.cutoff);
    expect(MOODS.gather.cutoff).toBeLessThan(MOODS.gold.cutoff);
    expect(MOODS.gold.cutoff).toBeLessThan(MOODS.radiance.cutoff);
    expect(MOODS.radiance.level).toBe(Math.max(...STAGES.map(s => MOODS[s].level)));
    expect(MOODS.arrive.phrase).toBeLessThan(MOODS.radiance.phrase);
  });

  it('the melody walks the pentatonic in range, with no minor-ninth rub against the chord', () => {
    const rng = mulberry32(3);
    for (const s of STAGES) {
      const spec = MOODS[s];
      for (const name of PROGRESSIONS[s]) {
        const c = CHORDS[name];
        const pool = melodyPool(c, spec.range[0], spec.range[1]);
        expect(pool.length, `${s} ${name}`).toBeGreaterThanOrEqual(4);
        const tones = chordPcs(c);
        for (const m of pool) {
          expect(PENTA_PCS).toContain(pc(m));
          expect(m).toBeGreaterThanOrEqual(spec.range[0]);
          expect(m).toBeLessThanOrEqual(spec.range[1]);
          if (!tones.has(pc(m))) for (const t of tones) expect(pc(m - t)).not.toBe(1);
        }
        let prev: number | null = null;
        let leaps = 0;
        for (let i = 0; i < 200; i++) {
          const m = nextNote(prev, pool, c, rng);
          expect(pool).toContain(m);
          if (prev !== null && Math.abs(m - prev) > 7) leaps++;
          prev = m;
        }
        expect(leaps).toBeLessThan(40);
      }
    }
  });

  it('phrases are short, with rests; a rest block plays fewer notes', () => {
    const rng = mulberry32(11);
    for (const s of STAGES) {
      let calm = 0, busy = 0;
      for (let i = 0; i < 400; i++) {
        const p = phrase(MOODS[s], rng, false);
        const q = phrase(MOODS[s], rng, true);
        busy += p.notes.length;
        calm += q.notes.length;
        expect(p.notes.length).toBeLessThanOrEqual(MOODS[s].notes[1]);
        expect(p.next).toBeGreaterThan(0);
        for (const n of p.notes) expect(n.at).toBeLessThan(p.next);
      }
      expect(calm, s).toBeLessThan(busy * 0.7);
    }
  });
});

// ── the ambient on a recording AudioContext ───────────────────────

type Ev = [string, ...number[]];
class FParam {
  events: Ev[] = [];
  constructor(public value = 0) {}
  setValueAtTime(v: number, t: number) { this.events.push(['set', v, t]); this.value = v; return this; }
  linearRampToValueAtTime(v: number, t: number) { this.events.push(['lin', v, t]); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { if (!(v > 0)) throw new RangeError('exponential ramp to ≤ 0'); this.events.push(['exp', v, t]); return this; }
  setTargetAtTime(v: number, t: number, tau: number) { if (!(tau > 0)) throw new RangeError('tau'); this.events.push(['target', v, t, tau]); return this; }
  cancelScheduledValues(t: number) { this.events.push(['cancel', t]); return this; }
}
class FNode {
  outs: unknown[] = [];
  constructor(readonly kind: string) {}
  connect<T>(d: T): T { this.outs.push(d); return d; }
  disconnect(): void { this.outs = []; }
}
class FSource extends FNode {
  startAt = -1;
  stopAt = Infinity;
  stops = 0;
  onended: (() => void) | null = null;
  frequency = new FParam(440);
  detune = new FParam(0);
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  start(t = 0) { if (this.startAt >= 0) throw new Error('started twice'); this.startAt = t; }
  stop(t = 0) { this.stopAt = t; this.stops++; }
}
class FakeCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new FNode('destination');
  gains: (FNode & { gain: FParam })[] = [];
  sources: FSource[] = [];
  nodes: FNode[] = [];
  private add<T extends FNode>(n: T): T { this.nodes.push(n); return n; }
  createGain() { const n = Object.assign(this.add(new FNode('gain')), { gain: new FParam(1) }); this.gains.push(n); return n; }
  createOscillator() { const o = this.add(new FSource('osc')); this.sources.push(o); return o; }
  createBufferSource() { const o = this.add(new FSource('buffer')); this.sources.push(o); return o; }
  createBiquadFilter() { return Object.assign(this.add(new FNode('filter')), { type: 'lowpass', frequency: new FParam(350), Q: new FParam(1) }); }
  createConvolver() { return Object.assign(this.add(new FNode('convolver')), { buffer: null as unknown, normalize: true }); }
  createStereoPanner() { return Object.assign(this.add(new FNode('panner')), { pan: new FParam(0) }); }
  createBuffer(ch: number, len: number, sr: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: (i: number) => data[i] };
  }
}

describe('kintsugi music: the ambient heart music', () => {
  it('the reverb is a decaying, darkening stereo tail', () => {
    const ctx = new FakeCtx();
    const ir = impulse(ctx as unknown as BaseAudioContext, 5);
    expect(ir.numberOfChannels).toBe(2);
    const d = ir.getChannelData(0);
    const rms = (a: number, b: number) => Math.sqrt(d.slice(a, b).reduce((s, x) => s + x * x, 0) / (b - a));
    expect(d[0]).toBe(0);                                             // the pre-delay
    expect(rms(400, 4000)).toBeGreaterThan(rms(20000, 24000) * 20);   // decays
    expect(d.every(Number.isFinite)).toBe(true);
  });

  it('plays a whole session into the app\'s bus, never straight to the speakers, every sound rising from silence', () => {
    const ctx = new FakeCtx();
    const out = ctx.createGain();
    const amb = HeartAmbient.create({ ctx: ctx as unknown as BaseAudioContext, out: out as unknown as AudioNode }, { music: true, rng: mulberry32(5) })!;
    expect(amb).not.toBeNull();
    const before = ctx.gains.length;
    amb.start();
    const plan: [MusicStage, number][] = [['arrive', 40], ['gather', 400], ['gold', 160], ['beat', 90], ['radiance', 120], ['close', 60]];
    let t = 0;
    for (const [stage, len] of plan) {
      for (let s = 0; s < len; s += 0.05) {
        t += 0.05;
        ctx.currentTime = t;
        amb.update(0.05, { stage, light: 0.5 + 0.5 * Math.sin(t / 7), rest: Math.floor(t / 40) % 3 === 2 });
        if (Math.round(t * 20) % 97 === 0) amb.cue((['lift', 'clean', 'place', 'seam', 'beat', 'bloom'] as const)[Math.floor(t) % 6]);
        if (Math.round(t * 20) === 4000) amb.mix(0, 5);
        if (Math.round(t * 20) === 8000) amb.mix(1, 4);
      }
    }
    // nothing goes to the speakers past the app's master bus (its volume and its fade)
    for (const n of ctx.nodes) expect(n.outs).not.toContain(ctx.destination);
    expect(out.outs).toEqual([]);
    expect(ctx.nodes.some(n => n.outs.includes(out))).toBe(true);
    // chords, a melody and cues were played
    const oscs = ctx.sources.filter(s => s.kind === 'osc');
    expect(oscs.length).toBeGreaterThan(600);
    // every note's envelope starts at silence and ramps (no clicks), and none is loud
    let envs = 0;
    for (const g of ctx.gains.slice(before)) {
      const ev = g.gain.events;
      if (!ev.length || ev[0][0] !== 'set') continue;
      envs++;
      expect(ev[0][1]).toBe(0);
      expect(['lin', 'target']).toContain(ev[1]?.[0]);
      for (const e of ev) if (e[0] === 'lin') expect(e[1]).toBeLessThanOrEqual(0.25);
    }
    expect(envs).toBeGreaterThan(300);
    // every source was told when to stop, or still sounds (the last chord: 4 pads × 3 + the root's 2 + 2 shimmer; 3 slow LFOs)
    const open = oscs.filter(o => o.stopAt === Infinity);
    expect(open.length).toBeLessThanOrEqual(19);
    amb.stop();
    expect(ctx.sources.every(s => s.stopAt < Infinity)).toBe(true);
    // once stopped, nothing new is scheduled
    const n = ctx.sources.length;
    ctx.currentTime = t + 30;
    amb.update(0.05, { stage: 'radiance', light: 1, rest: false });
    amb.cue('beat');
    expect(ctx.sources.length).toBe(n);
  });

  it('in "silence" only the cues sound; without a context there is no ambient', () => {
    const ctx = new FakeCtx();
    const out = ctx.createGain();
    const amb = HeartAmbient.create({ ctx: ctx as unknown as BaseAudioContext, out: out as unknown as AudioNode }, { music: false, rng: mulberry32(5) })!;
    amb.start();
    const base = ctx.sources.length;
    for (let t = 0; t < 120; t += 0.1) { ctx.currentTime = t; amb.update(0.1, { stage: 'gather', light: 0.5, rest: false }); }
    expect(ctx.sources.length).toBe(base);
    amb.cue('place');
    expect(ctx.sources.length).toBeGreaterThan(base);
    amb.stop();
    expect(HeartAmbient.create({ ctx: null, out: null }, { music: true, rng: Math.random })).toBeNull();
    expect(HeartAmbient.create(undefined, { music: true, rng: Math.random })).toBeNull();
  });
});

// ── the words ─────────────────────────────────────────────────────

describe('kintsugi music: the texts', () => {
  it('are complete in four languages', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const l of ['en', 'de', 'sv'] as const) expect(Object.keys(CATALOGS[l]).sort()).toEqual(Object.keys(CATALOGS.pl).sort());
  });

  it('never speak of energy, vibration or healing', () => {
    const all = Object.values(CATALOGS).flatMap(c => Object.values(c).flatMap(v => (typeof v === 'string' ? [v] : Object.values(v))));
    for (const s of all) expect(s).not.toMatch(/energ|wibrac|vibrat|heal|uzdrow|uleczy|heil(t|ung|en)|helande|läk/i);
  });
});
