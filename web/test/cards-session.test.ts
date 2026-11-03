/**
 * The session's edges: what an independent review of the exercise cards found, kept as tests —
 * late taps, a rule change cut by a pause, practice around a pause, the layer reused from one
 * session to the next, a failed save, and the band's phases around practice.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { CardsLayer, PAD_SILENT_MS, type SessionPlan } from '../src/cards/board/layer';
import { asBoardMsg, asPadMsg } from '../src/cards/duo/protocol';
import { GRACE_MS, TrialLoop, type LoopOutput } from '../src/cards/board/loop';
import { PaperRun } from '../src/cards/board/paper';
import { CARDS } from '../src/cards/catalog';
import { gameMeta } from '../src/cards/games';
import { BimanualEngine } from '../src/cards/games/bimanual';
import { TrailEngine } from '../src/cards/games/field';
import { sessionStats } from '../src/cards/games/stats';
import type { GameId, Legend, Stim, TrialSpec } from '../src/cards/games/types';
import { t } from '../src/cards/i18n';
import type { CardSession } from '../src/cards/store';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

function harness(id: GameId, level = 1, plannedSec = 60, practice = false) {
  const shows: { stim: Stim; legend: Legend | null; cue: TrialSpec['cue'] | null }[] = [];
  const out: LoopOutput = {
    show: (stim, legend, cue) => shows.push({ stim, legend, cue }), layout: () => {}, feedback: () => {}, padState: () => {},
    countdown: () => {}, level: () => {}, trial: () => {}, verdict: () => {}, end: () => {},
  };
  const loop = new TrialLoop(gameMeta(id)!, { rng: mulberry32(7), level, plannedSec, practice }, out);
  return { loop, shows };
}

function untilInput(loop: TrialLoop, from: number, step = 16): number {
  let now = from;
  while (!loop.inputOpen) {
    now += step;
    loop.tick(now);
    if (now - from > 60_000) throw new Error('input never opened');
  }
  return now;
}

describe('cards: the trial loop at its edges', () => {
  it('a tap made after the deadline does not count, even when it arrives before the timeout', () => {
    const { loop, shows } = harness('palce');
    loop.begin(0);
    const onset = untilInput(loop, 0);
    const cue = shows[shows.length - 1].stim as Extract<Stim, { kind: 'item' }>;
    const deadline = 2200;   // Kolorowe palce, level 1
    loop.tap(cue.item.id, 0, onset + deadline + 100, onset + deadline + 100);
    expect(loop.trials).toHaveLength(0);
    loop.tick(onset + deadline + GRACE_MS + 20);
    expect(loop.trials).toHaveLength(1);
    expect(loop.trials[0]).toMatchObject({ ok: false, timeout: true });
  });

  it('a tap made in time but delivered after the deadline still counts (the grace period)', () => {
    const { loop, shows } = harness('palce');
    loop.begin(0);
    const onset = untilInput(loop, 0);
    const cue = shows[shows.length - 1].stim as Extract<Stim, { kind: 'item' }>;
    loop.tick(onset + 2200 + 40);   // past the deadline, inside the grace
    loop.tap(cue.item.id, 0, onset + 2150, onset + 2240);
    expect(loop.trials).toHaveLength(1);
    expect(loop.trials[0]).toMatchObject({ ok: true, rt: 2150 });
  });

  it('a rule change cut by a pause is announced again on the next trial', () => {
    const { loop, shows } = harness('gesty', 9);   // from memory, a new rule every 8 trials
    loop.begin(0);
    let now = 0, switched = false;
    for (let k = 0; k < 14 && !switched; k++) {
      now = untilInput(loop, now);
      if (shows[shows.length - 1].cue === 'switch') { switched = true; break; }
      const eng = (loop as Any).engine;
      loop.tap(eng.map[eng.cue.id], 0, now + 400, now + 400);
      now += 400;
    }
    expect(switched).toBe(true);
    loop.pause(now + 50);
    loop.resume(now + 2000);
    now = untilInput(loop, now + 2000);
    const next = shows[shows.length - 1];
    expect(next.cue).toBe('switch');
    expect(next.legend).not.toBeNull();
  });

  it('guesses during practice are not counted as the game\'s early taps', () => {
    const { loop } = harness('palce', 1, 60, true);
    loop.begin(0);
    const now = untilInput(loop, 0);
    expect(loop.phase).toBe('practice');
    loop.tap('coral', 0, now + 30, now + 30);
    expect(loop.early).toBe(0);
  });

  it('a pause on the last practice verdict goes on to the countdown, not to one more practice trial', () => {
    const { loop, shows } = harness('palce', 1, 60, true);
    loop.begin(0);
    let now = 0, practiced = 0;
    while (loop.phase === 'practice') {
      now = untilInput(loop, now);
      if (loop.phase !== 'practice') break;
      practiced++;
      const cue = shows[shows.length - 1].stim as Extract<Stim, { kind: 'item' }>;
      loop.tap(cue.item.id, 0, now + 300, now + 300);
      now += 300;
      if (practiced === 3) { loop.pause(now + 10); loop.resume(now + 20); now += 20; }
    }
    expect(practiced).toBe(3);
    expect(loop.phase).toBe('countdown');
  });
});

describe('cards: engines at their edges', () => {
  it('Obie ręce: a wrong hand is an error, not also a timeout', () => {
    const e = new BimanualEngine({ rng: mulberry32(1), level: 1 });
    e.start();
    expect(e.tap({ item: 'L:nope', panel: 0, t: 400 })).toMatchObject({ ok: false, done: true });
    const rec = e.finish(0, 0);
    expect(rec.errors).toBe(1);
    expect(rec.timeout).toBeUndefined();
    expect(sessionStats('obie', [rec], 60).timeouts).toBe(0);
  });

  it('Szlak: a tap on a stop that does not exist (a stale layout) is ignored', () => {
    const e = new TrailEngine({ rng: mulberry32(1), level: 1 });
    e.start();
    expect(e.tap({ item: 't99', panel: 0, t: 300 })).toEqual({ ok: null, done: false });
  });
});

// ── the session layer ────────────────────────────────────────────────

function deps(status: Any) {
  const hub = Object.assign(new EventTarget(), { status, tool: status.tool });
  const puts: CardSession[] = [];
  const trainings: Any[] = [];
  const d = {
    hub, store: { put: async (s: CardSession) => { puts.push(structuredClone(s)); } },
    saveTraining: async (r: Any) => { trainings.push(r); }, mark: () => {},
    record: { start: async () => false, stop: async () => {} }, openSheet: () => {}, onSaved: () => {}, onClose: () => {},
  };
  return { d: d as Any, hub, puts, trainings };
}

const plan = (over: Partial<SessionPlan> = {}): SessionPlan => ({
  kind: 'game', games: ['palce'], seconds: 30, pad: 'local', marks: false, band: false, raw: false,
  levels: {}, practice: { palce: false }, bests: {}, ...over,
});

const flush = () => new Promise(r => setTimeout(r, 0));
const sample = (hub: EventTarget) => hub.dispatchEvent(new CustomEvent('sample', {
  detail: { tool: 'fnirs', x: 0.5, reliable: true, reason: null, warning: null, dt: 1, epoch: 1 },
}));
const buttonByText = (txt: string) => [...document.querySelectorAll('button')].find(b => b.textContent === txt) as HTMLButtonElement | undefined;

/** Ticks the layer's frame through the countdown and `ms` of play. */
function play(layer: Any, ms: number, hub?: EventTarget) {
  const t0 = performance.now();
  for (let now = t0; now < t0 + 2400 + ms + 50; now += 50) {
    layer.frame(now);
    if (hub && layer.loop?.phase === 'play' && Math.round(now) % 1000 < 50) sample(hub);
  }
}

describe('cards: one session after another', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('after "discard", the same game opens on a fresh board', () => {
    const { d } = deps({ tool: null, source: 'none', device: {} });
    const layer: Any = new CardsLayer(d);
    layer.open(plan());
    layer.pause();
    buttonByText(t('run.discard'))!.click();
    expect(layer.active).toBe(false);
    layer.open(plan());
    expect(layer.step).toBe('game');
    expect(document.querySelector('.k-stagebox')!.children.length).toBe(1);
  });

  it('a pause for a lost pad does not carry over into the next session\'s pairing', () => {
    const { d } = deps({ tool: null, source: 'none', device: {} });
    const layer: Any = new CardsLayer(d);
    layer.open(plan({ pad: 'channel' }));
    layer.onPad({ data: { t: 'join', v: 1, w: 1, h: 1, touch: true }, from: 'p1' });
    buttonByText(t('pair.continue'))!.click();
    play(layer, 500);
    layer.padSeen = performance.now() - 20_000;   // the phone locked
    layer.frame(performance.now() + 5000);
    expect(layer.loop.phase).toBe('paused');
    buttonByText(t('run.discard'))!.click();
    layer.open(plan({ pad: 'channel' }));
    const sheet = document.querySelector<HTMLElement>('.k-sheet')!;
    layer.onPad({ data: { t: 'join', v: 1, w: 1, h: 1, touch: true }, from: 'p2' });
    expect(layer.step).toBe('pairing');
    expect(sheet.hidden).toBe(false);
    layer.close();
  });

  it('a session with the band off saves no band, and no training result', async () => {
    const { d, hub, puts, trainings } = deps({ tool: 'fnirs', source: 'simulator', device: { name: 'Sim' } });
    const layer: Any = new CardsLayer(d);
    layer.open(plan({ band: true }));
    for (let k = 0; k < 22 && layer.step === 'baseline'; k++) sample(hub);
    expect(layer.step).toBe('game');
    play(layer, 25_000, hub);
    for (let k = 0; k < 25; k++) sample(hub);
    layer.loop.stop();
    await flush(); await flush();
    expect(puts).toHaveLength(1);
    expect(puts[0].band).not.toBeNull();
    expect(trainings).toHaveLength(1);
    buttonByText(t('sum.done'))!.click();

    (hub as Any).status = { tool: null, source: 'none', device: {} };
    layer.open(plan({ band: false }));
    play(layer, 25_000);
    layer.loop.stop();
    await flush(); await flush();
    expect(puts).toHaveLength(2);
    expect(puts[1].band).toBeNull();
    expect(trainings).toHaveLength(1);
  });

  it('a failed save still shows the summary, says so, and lets the player out', async () => {
    const { d } = deps({ tool: null, source: 'none', device: {} });
    d.store.put = async () => { throw new DOMException('closed', 'InvalidStateError'); };
    const layer: Any = new CardsLayer(d);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    layer.open(plan());
    play(layer, 25_000);
    layer.loop.stop();
    await flush(); await flush();
    err.mockRestore();
    expect(document.querySelector('.k-summary')).not.toBeNull();
    expect(document.querySelector('.k-summary')!.textContent).toContain('closed');
    buttonByText(t('sum.done'))!.click();
    expect(layer.active).toBe(false);
  });

  it('a pause during practice does not turn practice into band play', () => {
    const { d, hub } = deps({ tool: 'fnirs', source: 'simulator', device: { name: 'Sim' } });
    const layer: Any = new CardsLayer(d);
    layer.open(plan({ band: true, practice: { palce: true } }));
    for (let k = 0; k < 22 && layer.step === 'baseline'; k++) sample(hub);
    expect(layer.loop.phase).toBe('practice');
    layer.pause();
    layer.resume();
    for (let k = 0; k < 5; k++) sample(hub);
    expect(layer.loop.phase).toBe('practice');
    expect(layer.band.phase).not.toBe('play');
    expect(layer.band.scorer.series.length).toBe(0);
    layer.close();
  });
});

// ── the fixes after the second review ───────────────────────────────

describe('cards: the rule panel follows the level', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('Szlak shows the colour chain on its chain levels, and no panel on its number trails', () => {
    const { d } = deps({ tool: null, source: 'none', device: {} });
    const layer: Any = new CardsLayer(d);
    const legend = () => document.querySelector<HTMLElement>('.k-legend')!;
    layer.open(plan({ games: ['szlak'], levels: { szlak: 3 }, practice: { szlak: false } }));
    play(layer, 1500);
    expect(layer.loop.level).toBe(3);
    expect(legend().hidden).toBe(false);
    expect(legend().querySelectorAll('.k-legend-row').length).toBeGreaterThan(0);
    layer.close();

    layer.open(plan({ games: ['szlak'], levels: { szlak: 1 }, practice: { szlak: false } }));
    play(layer, 1500);
    expect(legend().hidden).toBe(true);
    layer.close();
  });
});

describe('cards: a pad that goes quiet', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('the silent seconds are not play, and the trials that timed out in them are dropped', () => {
    const { loop } = harness('palce', 1, 120);
    loop.begin(0);
    let now = 0;
    for (; loop.phase !== 'play'; now += 16) loop.tick(now);
    for (let k = 0; k < 3; k++) {
      now = untilInput(loop, now);
      const s = (loop as Any).spec as TrialSpec;
      loop.tap((s.stim as Any).item?.id ?? (s.stim as Any).items?.[0]?.id ?? '', 0, now + 300, now + 300);
      now += 400;
    }
    const kept = loop.trials.length;
    const silentFrom = now;
    // the pad is gone: trials time out one after another
    for (const end = now + 15_000; now < end; now += 16) loop.tick(now);
    expect(loop.trials.length).toBeGreaterThan(kept);
    const played = loop.playedMs(now);
    loop.lost(silentFrom, now);
    expect(loop.phase).toBe('paused');
    expect(loop.trials.filter(r => r.timeout).length).toBe(loop.trials.slice(0, kept).filter(r => r.timeout).length);
    expect(loop.trials.length).toBe(kept);
    expect(loop.playedMs(now)).toBeLessThan(played - 14_000);
    loop.resume(now + 2000);
    expect(loop.playedMs(now + 3000)).toBeCloseTo(loop.playedMs(now + 2000) + 1000, -1);
  });

  it('the board notices a silent pad within 4 s', () => {
    expect(PAD_SILENT_MS).toBeLessThanOrEqual(4000);
  });

  it('a rejoined pad gets back the items it had already marked done', () => {
    const { d } = deps({ tool: null, source: 'none', device: {} });
    const layer: Any = new CardsLayer(d);
    const sent: Any[] = [];
    layer.open(plan({ games: ['szukaj'], pad: 'channel', practice: { szukaj: false } }));
    layer.onPad({ data: { t: 'join', v: 1, w: 1, h: 1, touch: true }, from: 'p1' });
    buttonByText(t('pair.continue'))!.click();
    layer.send = (m: Any) => sent.push(m);
    layer.kept = [];
    layer.padLayout({ panels: [{ arrange: 'field', items: [] }] });
    layer.kept.push({ t: 'fb', item: 'd3', ok: true, keep: true });
    sent.length = 0;
    layer.greet();
    const types = sent.map(m => m.t);
    expect(types).toEqual(['hello', 'layout', 'fb', 'state']);
    expect(sent[2]).toMatchObject({ item: 'd3', keep: true });
    layer.padLayout({ panels: [{ arrange: 'field', items: [] }] });
    expect(layer.kept).toEqual([]);
    layer.close();
  });
});

describe('cards: messages from the other screen are checked', () => {
  it('a malformed layout, state or sync is dropped; well-formed ones pass', () => {
    const good = { t: 'layout', seq: 1, layout: { panels: [{ arrange: 'grid', items: [{ id: 'a', color: 'coral' }] }] } };
    expect(asBoardMsg(good)).not.toBeNull();
    expect(asBoardMsg({ ...good, layout: { panels: [{ arrange: 'grid', items: [{ id: 'a', glyph: 'nope' }] }] } })).toBeNull();
    expect(asBoardMsg({ ...good, layout: { panels: 'x' } })).toBeNull();
    expect(asBoardMsg({ t: 'state', state: 'play', input: 'yes' })).toBeNull();
    expect(asBoardMsg({ t: 'state', state: 'play', input: true })).not.toBeNull();
    expect(asBoardMsg({ t: 'fb', item: 'a', ok: true })).not.toBeNull();
    expect(asPadMsg({ t: 'sync', offset: 1.5, rtt: 'slow' })).toBeNull();
    expect(asPadMsg({ t: 'sync', offset: 1.5, rtt: 12 })).not.toBeNull();
    expect(asPadMsg({ t: 'join', v: 1, w: 'x', h: 1, touch: true })).toBeNull();
  });
});

describe('cards: the paper session saves once, and says when it could not', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });
  afterEach(() => {
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  function toRating(run: Any) {
    run.open(CARDS[6]);
    buttonByText(t('paper.start'))!.click();
    for (let k = 0; k < 3; k++) {
      run.phase.until = 0;
      run.frame(performance.now());
      buttonByText(t('paper.done'))!.click();
    }
    run.phase.until = 0;
    run.frame(performance.now());
    expect(run.phase.kind).toBe('rate');
    expect(run.busy).toBe(true);
  }

  it('a double tap on "save" writes one session', async () => {
    const { d, puts } = deps({ tool: null, source: 'none', device: {} });
    const run: Any = new PaperRun(d);
    toRating(run);
    const save = buttonByText(t('paper.save'))!;
    save.click();
    save.click();
    await flush(); await flush();
    expect(puts).toHaveLength(1);
    expect(run.busy).toBe(false);
  });

  it('a failed save says why and can be tried again', async () => {
    const { d, puts } = deps({ tool: null, source: 'none', device: {} });
    let fail = true;
    const put = d.store.put;
    d.store.put = async (s: Any) => { if (fail) throw new Error('disk full'); return put(s); };
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const run: Any = new PaperRun(d);
    toRating(run);
    buttonByText(t('paper.save'))!.click();
    await flush(); await flush();
    err.mockRestore();
    expect(document.body.textContent).toContain('disk full');
    expect(buttonByText(t('paper.save'))!.disabled).toBe(false);
    fail = false;
    buttonByText(t('paper.save'))!.click();
    await flush(); await flush();
    expect(puts).toHaveLength(1);
  });
});
