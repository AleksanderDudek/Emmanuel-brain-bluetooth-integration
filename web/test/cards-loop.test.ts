import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { TrialLoop, type LoopOutput } from '../src/cards/board/loop';
import { ClockSync } from '../src/cards/duo/clock';
import { LocalLink, padUrl, parsePadHash, newRoom, isRoom } from '../src/cards/duo/link';
import { asPadMsg } from '../src/cards/duo/protocol';
import { gameMeta } from '../src/cards/games';
import type { Stim } from '../src/cards/games/types';

/** A loop with an output that remembers what it was asked to do. */
function harness(id: 'palce' | 'sekwencja', plannedSec = 10, practice = false) {
  const log: { show: Stim[]; pad: string[]; trials: number; ended: boolean; levels: number[]; countdown: number[] } = { show: [], pad: [], trials: 0, ended: false, levels: [], countdown: [] };
  const out: LoopOutput = {
    show: s => log.show.push(s), layout: () => {}, feedback: () => {}, padState: (s, input) => log.pad.push(`${s}:${input ? 1 : 0}`),
    countdown: n => log.countdown.push(n), level: l => log.levels.push(l), trial: () => log.trials++, verdict: () => {}, end: () => { log.ended = true; },
  };
  const loop = new TrialLoop(gameMeta(id)!, { rng: mulberry32(4), level: 1, plannedSec, practice }, out);
  return { loop, log };
}

/** Drive the loop on a fake clock; `answer` is called when input opens and returns the taps to make (item, delay ms). */
function run(loop: TrialLoop, untilMs: number, answer: () => [string, number][], step = 16) {
  let pending: { item: string; at: number }[] = [];
  let wasOpen = false;
  for (let now = 0; now <= untilMs; now += step) {
    loop.tick(now);
    if (loop.inputOpen && !wasOpen) {
      let at = now;
      pending = answer().map(([item, d]) => ({ item, at: (at += d) }));
    }
    wasOpen = loop.inputOpen;
    for (const p of pending.filter(p => p.at <= now)) loop.tap(p.item, 0, p.at, now);
    pending = pending.filter(p => p.at > now);
    if (loop.phase === 'done') return now;
  }
  return untilMs;
}

describe('the board\'s trial loop', () => {
  it('counts down, plays timed trials until the time is up, and measures reaction time from the frame the cue was drawn in', () => {
    const { loop, log } = harness('palce', 10);
    loop.begin(0);
    expect(log.countdown).toEqual([3]);
    const end = run(loop, 60_000, () => {
      const cue = [...log.show].reverse().find(s => s.kind === 'item');
      return cue && cue.kind === 'item' ? [[cue.item.id, 420]] : [];
    });
    expect(log.countdown).toEqual([3, 2, 1, 0]);
    expect(log.ended).toBe(true);
    expect(loop.phase).toBe('done');
    // 10 s of play, plus the countdown, plus at most one trial's overrun
    expect(end).toBeGreaterThan(10_000);
    expect(end).toBeLessThan(10_000 + 3 * 800 + 3000);
    expect(loop.trials.length).toBeGreaterThan(5);
    for (const t of loop.trials) {
      expect(t.ok).toBe(true);
      // the tap landed 420 ms after the frame that opened input; frames are 16 ms apart
      expect(t.rt).toBeGreaterThanOrEqual(420);
      expect(t.rt).toBeLessThan(420 + 16);
    }
    expect(Math.round(loop.playedMs() / 1000)).toBeGreaterThanOrEqual(10);
  });

  it('ignores taps from before the cue and counts guesses faster than 100 ms as too early', () => {
    const { loop, log } = harness('palce', 5);
    loop.begin(0);
    run(loop, 8000, () => {
      const cue = [...log.show].reverse().find(s => s.kind === 'item');
      return cue && cue.kind === 'item' ? [[cue.item.id, 40], [cue.item.id, 400]] : [];
    });
    expect(loop.early).toBeGreaterThan(0);
    expect(loop.trials.every(t => t.rt! >= 400)).toBe(true);
  });

  it('a pause drops the trial under way and is left out of the play time', () => {
    const { loop, log } = harness('palce', 6);
    loop.begin(0);
    run(loop, 4000, () => []);
    const before = loop.trials.length;
    loop.pause(4000);
    for (let now = 4000; now < 34_000; now += 100) loop.tick(now);
    expect(loop.trials.length).toBe(before);
    loop.resume(34_000);
    const played = loop.playedMs(34_000);
    expect(played).toBeLessThan(2000);
    expect(log.pad).toContain('pause:0');
  });

  it('runs the practice first, without recording it, then the countdown', () => {
    const { loop, log } = harness('palce', 5, true);
    loop.begin(0);
    expect(loop.phase).toBe('practice');
    run(loop, 15_000, () => {
      const cue = [...log.show].reverse().find(s => s.kind === 'item');
      return cue && cue.kind === 'item' ? [[cue.item.id, 300]] : [];
    });
    expect(log.pad.some(p => p.startsWith('practice:1'))).toBe(true);
    expect(log.countdown[0]).toBe(3);
    expect(loop.trials.every(t => t.i >= 0)).toBe(true);
    expect(loop.trials[0].i).toBe(0);
  });

  it('a strip is shown colour by colour before input opens, and its time counts from there', () => {
    const { loop, log } = harness('sekwencja', 8);
    loop.begin(0);
    run(loop, 30_000, () => {
      const strip = [...log.show].reverse().find(s => s.kind === 'strip');
      return strip && strip.kind === 'strip' ? strip.items.map(it => [it.color!, 300] as [string, number]) : [];
    });
    const lits = log.show.filter(s => s.kind === 'strip' && s.lit !== null).length;
    expect(lits).toBeGreaterThanOrEqual(3);
    expect(loop.trials[0]).toMatchObject({ ok: true, n: 3 });
    expect(loop.trials[0].rt).toBeGreaterThanOrEqual(900);
  });
});

describe('the clock sync', () => {
  it('estimates the offset from the shortest round trip', () => {
    const c = new ClockSync();
    // board = pad + 1000; legs of 5/5, 3/40 and 2/2 ms
    c.add(0, 1005, 10, );
    c.add(100, 1103, 143);
    c.add(200, 1202, 204);
    expect(c.best(300)!.rtt).toBe(4);
    expect(c.toBoard(500, 300)).toBe(1500);
    expect(c.uncertainty(300)).toBe(2);
  });

  it('rejects impossible samples', () => {
    const c = new ClockSync();
    expect(c.add(10, 5, 5)).toBeNull();
    expect(c.toBoard(1)).toBeNull();
  });
});

describe('links and rooms', () => {
  it('a local pair passes messages like a wire, asynchronously and copied', async () => {
    const [board, pad] = LocalLink.pair();
    const got: unknown[] = [];
    board.addEventListener('message', e => got.push((e as CustomEvent).detail));
    const msg = { t: 'tap', item: 'coral', panel: 0, ts: 1, tb: 2, n: 1 };
    pad.send(msg);
    expect(got).toEqual([]);
    await Promise.resolve();
    expect(got).toEqual([{ data: msg, from: 'local' }]);
    expect((got[0] as { data: object }).data).not.toBe(msg);
    pad.close();
    expect(board.state).toBe('closed');
  });

  it('room codes avoid look-alike characters, and the pad link carries them in the fragment', () => {
    for (let i = 0; i < 50; i++) expect(newRoom()).toMatch(/^[A-HJKMNP-Z2-9]{4}$/);
    expect(isRoom('AB1C')).toBe(false);
    const url = padUrl('http://192.168.1.20:8420/app/', 'K7QM', 'relay');
    expect(url).toBe('http://192.168.1.20:8420/app/pad.html#r=K7QM&v=relay');
    expect(parsePadHash(new URL(url).hash)).toEqual({ room: 'K7QM', via: 'relay' });
    expect(parsePadHash('#r=k7qm&v=channel')).toEqual({ room: 'K7QM', via: 'channel' });
    expect(parsePadHash('#r=K7&v=relay')).toBeNull();
    expect(padUrl('http://192.168.1.20:8420/app/', 'K7QM', 'relay', 'de')).toBe('http://192.168.1.20:8420/app/pad.html?lang=de#r=K7QM&v=relay');
  });

  it('checks a pad\'s taps field by field', () => {
    expect(asPadMsg({ t: 'tap', item: 'x', panel: 0, ts: 1, tb: null, n: 1 })).not.toBeNull();
    expect(asPadMsg({ t: 'tap', item: 'x', panel: 0, ts: 'soon', tb: null, n: 1 })).toBeNull();
    expect(asPadMsg({ t: 'nope' })).toBeNull();
    expect(asPadMsg([1, 2])).toBeNull();
  });
});
