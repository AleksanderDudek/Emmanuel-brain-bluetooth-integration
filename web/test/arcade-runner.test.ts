import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hub, HubSample } from '../src/hub';
import { ArcadeRunner, type ArcadeDeps } from '../src/arcade/runner';
import type { ArcadeEntry } from '../src/arcade/registry';
import type { ArcadeGame, ArcadeModule, GameEnv } from '../src/arcade/kit/types';
import { DEFAULT_SETTINGS, type AppSettings } from '../src/settings';
import type { SessionDB } from '../src/storage/db';
import type { TrainingResult } from '../src/training/score';

interface P { best: number; coins: number }

/** A game that records what the runner asks of it. */
function stubGame(env: GameEnv<P>, opts: { padThrowsAfter?: number } = {}) {
  const calls: string[] = [];
  let score = 0;
  const game: ArcadeGame & { calls: string[] } = {
    calls,
    resize: () => calls.push('resize'),
    intro: () => undefined,
    start: () => calls.push('start'),
    update: () => undefined,
    draw: () => undefined,
    pointer: e => calls.push(`pointer:${e.type}`),
    key: (k, down) => { calls.push(`key:${k}:${down ? 'down' : 'up'}`); if (down && k === ' ') { score++; env.progress.coins++; } return true; },
    pause: on => calls.push(`pause:${on}`),
    padLevel: f => {
      if (opts.padThrowsAfter !== undefined && env.progress.coins >= opts.padThrowsAfter) throw new Error('boom');
      return f.level;
    },
    canStop: () => true,
    finish: () => calls.push('finish'),
    result: () => {
      env.progress.best = Math.max(env.progress.best, score);
      return { score, unit: 'pkt', record: score > 0, stats: [['Rzuty', String(score)]], highlights: [], verse: 'psa46.10' };
    },
    destroy: () => calls.push('destroy'),
  };
  return game;
}

const ENTRY: ArcadeEntry = {
  id: 'stub', title: 'Stub', tagline: '', text: '', how: [], tips: ['tip'], unit: 'pkt', art: '', fill: ['#000', '#111', '#222', '#333'],
  tools: ['fnirs', 'eeg'], focusChip: false, root: 'psa23.1-3', load: async () => { throw new Error('not used'); },
};

let games: ReturnType<typeof stubGame>[] = [];
const moduleWith = (opts: { createThrows?: boolean; padThrowsAfter?: number } = {}): ArcadeModule<P> => ({
  freshProgress: () => ({ best: 0, coins: 0 }),
  create: env => {
    if (opts.createThrows) throw new Error('broken game');
    const g = stubGame(env, opts);
    games.push(g);
    return g;
  },
  best: p => (p.best ? p.best : null),
  progressPanel: () => document.createElement('div'),
  preview: () => undefined,
});

const el = (tag: string, attrs: Record<string, string> = {}) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};

function setup() {
  document.body.replaceChildren(el('div', { class: 'app' }), el('div', { id: 'arcadeLayer', hidden: '' }), el('div', { id: 'toast' }));
  const hub = Object.assign(new EventTarget(), {
    tool: 'fnirs' as const,
    status: { source: 'simulator', device: { name: null }, signal: { progress: 1 } },
    fnirs: { epoch: 1 }, eeg: { epoch: 0 },
    setSimState: vi.fn(),
  });
  const saved: TrainingResult[] = [];
  const progressSaves: unknown[] = [];
  const db = {
    listTrainings: async () => [...saved],
    putTraining: async (r: TrainingResult) => { saved.push(r); return r.id; },
    setSetting: async (_k: string, v: unknown) => { progressSaves.push(v); },
    getSetting: async () => undefined,
  };
  const settings: AppSettings = structuredClone(DEFAULT_SETTINGS);
  const deps: ArcadeDeps = {
    hub: hub as unknown as Hub, db: db as unknown as SessionDB, settings, mark: vi.fn(), onSaved: vi.fn(), onExit: vi.fn(),
    history: () => [], openSheet: vi.fn(),
  };
  const runner = new ArcadeRunner(deps);
  const sample = (x: number, n = 1) => {
    for (let i = 0; i < n; i++) {
      hub.dispatchEvent(new CustomEvent<HubSample>('sample', {
        detail: { tool: 'fnirs', x, reliable: true, reason: null, warning: null, dt: 0.1, epoch: 1 },
      }));
    }
  };
  const key = (k: string, type: 'keydown' | 'keyup' = 'keydown') => document.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true }));
  const debug = () => runner.debug;
  return { runner, deps, hub, saved, progressSaves, sample, key, debug };
}

/** Calibration (20 s of reliable signal), then the 3-2-1 countdown. */
async function toPlay(t: ReturnType<typeof setup>) {
  t.sample(0, 200);
  expect(t.debug()?.stage).toBe('countdown');
  await vi.advanceTimersByTimeAsync(2500);
  expect(t.debug()?.stage).toBe('play');
}

describe('ArcadeRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    games = [];
    history.replaceState(null, '', '/?trainingSec=40');
  });
  afterEach(() => { vi.useRealTimers(); });

  it('runs calibration, a countdown that holds the clock, play, and saves the session with the game\'s numbers', async () => {
    const t = setup();
    const progress: P = { best: 0, coins: 0 };
    t.runner.start(ENTRY, moduleWith(), progress);
    expect(document.querySelector('.app')!.hasAttribute('inert')).toBe(true);
    expect(t.debug()?.stage).toBe('calibration');
    t.sample(0, 200);
    expect(t.debug()?.stage).toBe('countdown');
    t.sample(0.5, 20);                                // the countdown: samples do not run the session clock
    expect(t.debug()!.t).toBe(0);
    await vi.advanceTimersByTimeAsync(2500);
    expect(t.debug()?.stage).toBe('play');
    expect(games[0].calls).toContain('start');
    t.key(' ');
    t.key(' ', 'keyup');
    t.sample(0.5, 410);                               // 41 s: time is up and the game may stop
    await vi.runAllTimersAsync();
    expect(t.saved).toHaveLength(1);
    const r = t.saved[0];
    expect(r.kind).toBe('game');
    expect(r.game).toMatchObject({ id: 'stub', score: 1, unit: 'pkt', best: null });
    expect(r.played_sec).toBeGreaterThanOrEqual(40);
    expect(games[0].calls).toContain('finish');
    expect(progress).toEqual({ best: 1, coins: 1 });
    expect(t.progressSaves.at(-1)).toEqual({ best: 1, coins: 1 });
    const summary = document.querySelector('#arcadeLayer .arcade-summary')!;
    expect(summary.querySelector('.arcade-big')?.textContent).toBe('1pkt');
    expect(summary.textContent).toContain('Nowy rekord!');
    expect(summary.textContent).toContain('Wynik dnia');
    expect(summary.textContent).toContain('Seria 1 dzień');
    expect([...summary.querySelectorAll('.stat .k')].map(k => k.textContent)).toEqual(['Rzuty', 'Aktywność', 'Kontrola', 'Tlen', 'Sesja']);
    expect([...summary.querySelectorAll('.arcade-again .btn')].map(b => b.textContent)).toEqual(['Jeszcze raz', 'Gotowe']);
    // the game's closing verse, once the scripture chunk is in
    await vi.waitFor(() => expect(summary.querySelector('.arcade-verse figcaption')?.textContent).toBe('Ps 46,11 · Biblia Gdańska'));
  });

  it('pauses at the start of play when asked during the countdown, and releases held keys when the tab hides', async () => {
    const t = setup();
    t.runner.start(ENTRY, moduleWith(), { best: 0, coins: 0 });
    t.sample(0, 200);
    t.key('Escape');                                   // during the countdown: pause once play begins
    await vi.advanceTimersByTimeAsync(2500);
    expect(t.debug()?.stage).toBe('play');
    expect(games[0].calls).toContain('pause:true');
    const card = document.querySelector('#arcadeLayer .arcade-card')?.textContent ?? '';
    expect(card).toContain('Pauza');
    expect(card).toContain('Zagrane 0:00 z 0:40. Sesja krótsza niż 30 s nie zostanie zapisana.');
    expect(card).toContain('Opaska Mendi');
    t.key('Escape');                                   // resume
    t.key('ArrowLeft');
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    const calls = games[0].calls;
    expect(calls.indexOf('key:ArrowLeft:up')).toBeGreaterThan(calls.indexOf('key:ArrowLeft:down'));
    expect(calls.at(-1)).toBe('pause:true');
  });

  it('undoes an abandoned session\'s progress and saves nothing', async () => {
    const t = setup();
    const progress: P = { best: 3, coins: 10 };
    t.runner.start(ENTRY, moduleWith(), progress);
    await toPlay(t);
    t.key(' ');
    t.key(' ');
    expect(progress.coins).toBe(12);
    t.key('Escape');
    const leave = [...document.querySelectorAll<HTMLButtonElement>('#arcadeLayer .btn')].find(b => b.textContent === 'Wyjdź')!;
    leave.click();
    expect(progress).toEqual({ best: 3, coins: 10 });
    expect(t.saved).toHaveLength(0);
    expect(t.runner.active).toBe(false);
    expect(document.querySelector('.app')!.hasAttribute('inert')).toBe(false);
    expect(t.deps.onExit).toHaveBeenCalled();
  });

  it('stays usable when a game fails to start', async () => {
    const t = setup();
    expect(() => t.runner.start(ENTRY, moduleWith({ createThrows: true }), { best: 0, coins: 0 })).toThrow('broken game');
    expect(t.runner.active).toBe(false);
    expect(document.getElementById('arcadeLayer')!.hidden).toBe(true);
    expect(document.querySelector('.app')!.hasAttribute('inert')).toBe(false);
    t.runner.start(ENTRY, moduleWith(), { best: 0, coins: 0 });
    expect(t.debug()?.stage).toBe('calibration');
  });

  it('leaves Escape to an open dialog (the device sheet over the game)', async () => {
    const t = setup();
    t.runner.start(ENTRY, moduleWith(), { best: 0, coins: 0 });
    await toPlay(t);
    const dialog = el('dialog', { open: '' });
    document.body.append(dialog);
    t.key('Escape');
    expect(games[0].calls).not.toContain('pause:true');
    dialog.remove();
    t.key('Escape');
    expect(games[0].calls).toContain('pause:true');
  });

  it('keeps the training but not the half-changed progress when the game breaks after 30 s', async () => {
    const t = setup();
    const progress: P = { best: 0, coins: 0 };
    t.runner.start(ENTRY, moduleWith({ padThrowsAfter: 1 }), progress);
    await toPlay(t);
    t.sample(0.5, 310);                                // 31 s of play
    t.key(' ');                                        // the game changes its progress … and then fails
    t.sample(0.5, 1);
    await vi.runAllTimersAsync();
    expect(t.saved).toHaveLength(1);
    expect(t.saved[0].played_sec).toBeGreaterThanOrEqual(31);
    expect(progress).toEqual({ best: 0, coins: 0 });
  });
});
