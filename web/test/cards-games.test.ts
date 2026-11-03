import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { Staircase, SpanRule } from '../src/cards/games/adaptive';
import { GAMES, dailyTrio, gameMeta, gamesOfCard } from '../src/cards/games';
import { CODE_KEY } from '../src/cards/games/sequence';
import { scatter } from '../src/cards/games/field';
import { headline, median, sessionStats } from '../src/cards/games/stats';
import type { GameEngine, GameId, Stim, TrialSpec } from '../src/cards/games/types';
import type { PadLayout } from '../src/cards/duo/protocol';

/** The right taps for a trial, worked out from what the board and the pad show (as a player would). */
export function solve(eng: GameEngine, spec: TrialSpec, layout: PadLayout): { item: string; panel: number }[] {
  const stim = (spec.frames?.length ? spec.frames[spec.frames.length - 1].stim : spec.stim) as Stim;
  const items = layout.panels.flatMap((p, panel) => p.items.map(it => ({ ...it, panel })));
  if (eng.id === 'stroop' && stim.kind === 'item') return [{ item: stim.item.label!, panel: 0 }];
  if (stim.kind === 'item') {
    // no rule: the answer looks like the cue (Kolorowe palce)
    const rule = eng.rule();
    const ans = rule ? rule.rows.find(r => r.cue.id === stim.item.id)!.answer.id : stim.item.id;
    return Array.from({ length: stim.count ?? 1 }, () => ({ item: ans, panel: 0 }));
  }
  if (stim.kind === 'pair') {
    const r = stim.right;
    const right = r.shape ? `R:${r.shape}` : r.label ? `R:${r.label}` : `R:${r.color}`;
    return [{ item: `L:${stim.left.color}`, panel: 0 }, { item: right, panel: 1 }];
  }
  if (stim.kind === 'strip') {
    const order = stim.reverse ? [...stim.items].reverse() : stim.items;
    return order.map(it => ({ item: it.color!, panel: 0 }));
  }
  if (stim.kind === 'code') return stim.digits.map(d => ({ item: CODE_KEY[d - 1], panel: 0 }));
  if (stim.kind === 'trail') {
    // the trail engine's items are in order t0, t1, … (stop k is item k)
    return items.map(it => ({ item: it.id, panel: 0 }));
  }
  if (stim.kind === 'target') {
    const want = new Set(stim.items.map(i => i.color));
    return items.filter(it => want.has(it.color)).map(it => ({ item: it.id, panel: 0 }));
  }
  return [];
}

function play(id: GameId, trials: number, correct: (i: number) => boolean, level = 1) {
  const eng = gameMeta(id)!.create({ rng: mulberry32(7), level });
  let layout = eng.layout();
  const levels: number[] = [];
  const recs = [];
  for (let i = 0; i < trials; i++) {
    const spec = eng.start();
    if (spec.layout) layout = spec.layout;
    const taps = solve(eng, spec, layout);
    expect(taps.length).toBeGreaterThan(0);
    const good = correct(i);
    let t = 300;
    for (let k = 0; k < taps.length; k++) {
      let tap = taps[k];
      if (!good && k === taps.length - 1) {
        // a wrong last tap: anything else on the same panel
        const other = layout.panels[tap.panel].items.find(it => it.id !== tap.item && !taps.some(x => x.item === it.id))
          ?? layout.panels[tap.panel].items.find(it => it.id !== tap.item)!;
        tap = { item: other.id, panel: tap.panel };
      }
      const v = eng.tap({ ...tap, t });
      t += 250;
      if (v.done) break;
    }
    const rec = eng.finish(i, i * 2000);
    recs.push(rec);
    levels.push(eng.level);
    layout = eng.layout();
  }
  return { eng, recs, levels };
}

describe('the two-screen games', () => {
  it('cover the cards they are built on, each card at most a few games, and every game a known card', () => {
    for (const g of GAMES) for (const c of g.cards) expect(c).toBeGreaterThanOrEqual(1), expect(c).toBeLessThanOrEqual(32);
    expect(gamesOfCard(7).map(g => g.id)).toEqual(['palce']);
    expect(gamesOfCard(32).map(g => g.id).sort()).toEqual(['obie', 'stroop']);
    expect(gamesOfCard(22)).toEqual([]);
  });

  for (const g of GAMES) {
    it(`${g.id}: a perfect player climbs to the top level and every trial is recorded as correct`, () => {
      const { eng, recs, levels } = play(g.id, 60, () => true);
      expect(recs.every(r => r.ok && r.rt !== null && r.errors === 0)).toBe(true);
      expect(Math.max(...levels)).toBe(eng.maxLevel);
    });

    it(`${g.id}: a player who always errs stays at level 1 and no trial counts`, () => {
      const { recs, levels } = play(g.id, 25, () => false);
      expect(recs.every(r => !r.ok)).toBe(true);
      expect(Math.max(...levels)).toBeLessThanOrEqual(g.id === 'sekwencja' ? 3 : 1);
    });
  }

  it('a timed-out trial is recorded as such and is not correct', () => {
    const eng = gameMeta('palce')!.create({ rng: mulberry32(1), level: 1 });
    eng.start();
    eng.timeout();
    const r = eng.finish(0, 0);
    expect(r).toMatchObject({ ok: false, rt: null, timeout: true, taps: 0 });
  });

  it('both hands: the asynchrony is the gap between the two touches', () => {
    const eng = gameMeta('obie')!.create({ rng: mulberry32(3), level: 1, fixed: true });
    const spec = eng.start();
    const [l, r] = solve(eng, spec, eng.layout());
    expect(eng.tap({ ...l, t: 500 }).done).toBe(false);
    expect(eng.tap({ ...r, t: 560 }).done).toBe(true);
    expect(eng.finish(0, 0)).toMatchObject({ ok: true, rt: 560, async: 60 });
  });

  it('the rule-switch level deals a different rule and says so', () => {
    const eng = gameMeta('gesty')!.create({ rng: mulberry32(5), level: 7 });
    const first = JSON.stringify(eng.rule());
    let switched = false;
    for (let i = 0; i < 20; i++) {
      const spec = eng.start();
      if (spec.cue === 'switch') {
        switched = true;
        expect(spec.legend).not.toBeNull();
        expect(JSON.stringify(eng.rule())).not.toEqual(first);
        break;
      }
      expect(spec.legend).toBeNull();   // the level plays the rule from memory
      for (const tap of solve(eng, spec, eng.layout())) eng.tap({ ...tap, t: 400 });
      eng.finish(i, 0);
    }
    expect(switched).toBe(true);
  });

  it('Stroop trials come congruent, incongruent and neutral, and the interference is incongruent minus congruent', () => {
    const eng = gameMeta('stroop')!.create({ rng: mulberry32(11), level: 2, fixed: true });
    const seen = new Set<number>();
    const recs = [];
    for (let i = 0; i < 80; i++) {
      const spec = eng.start();
      const ans = solve(eng, spec, eng.layout())[0];
      eng.tap({ ...ans, t: 500 });
      const r = eng.finish(i, i * 1000);
      seen.add(r.cong!);
      recs.push({ ...r, rt: r.cong === 1 ? 600 : 500 });
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
    expect(sessionStats('stroop', recs, 80).interference).toBe(100);
  });

  it('the trail accepts its stops in order only, and a wrong stop is an error that does not end it', () => {
    const eng = gameMeta('szlak')!.create({ rng: mulberry32(2), level: 1, fixed: true });
    const spec = eng.start();
    const ids = spec.layout!.panels[0].items.map(i => i.id);
    expect(eng.tap({ item: ids[3], panel: 0, t: 300 })).toMatchObject({ ok: false, done: false });
    for (let k = 0; k < ids.length; k++) eng.tap({ item: ids[k], panel: 0, t: 400 + k * 200 });
    expect(eng.finish(0, 0)).toMatchObject({ ok: true, errors: 1, done: ids.length, n: ids.length });
  });

  it('scatters field dots apart from each other', () => {
    const pts = scatter(mulberry32(9), 16, 0.13);
    for (const a of pts) for (const b of pts) if (a !== b) expect(Math.hypot((a.x - b.x) * 1.5, a.y - b.y)).toBeGreaterThan(0.08);
  });

  it('picks three games a day, one from each group, the same for everyone that day', () => {
    expect(dailyTrio('2026-11-03')).toEqual(dailyTrio('2026-11-03'));
    const days = Array.from({ length: 30 }, (_, i) => dailyTrio(`2026-11-${String(i + 1).padStart(2, '0')}`).join());
    expect(new Set(days).size).toBeGreaterThan(5);
    for (const d of days) expect(d.split(',')).toHaveLength(3);
  });
});

describe('adaptive difficulty', () => {
  it('the staircase goes up after three successes and down after two failures of four', () => {
    const s = new Staircase(2, 1, 5);
    expect([s.push(true), s.push(true), s.push(true)]).toEqual([0, 0, 1]);
    expect(s.level).toBe(3);
    expect([s.push(false), s.push(true), s.push(false)]).toEqual([0, 0, -1]);
    expect(s.level).toBe(2);
  });

  it('the span rule grows on success and shrinks after two failures in a row', () => {
    const s = new SpanRule(3, 2, 9);
    s.push(true);
    expect(s.level).toBe(4);
    s.push(false);
    expect(s.level).toBe(4);
    s.push(false);
    expect(s.level).toBe(3);
  });
});

describe('session statistics', () => {
  it('summarise reaction times by the median of the correct trials, and rate per minute of play', () => {
    const recs = [400, 500, 600, null].map((rt, i) => ({ i, level: 1, ok: rt !== null, rt, taps: 1, errors: rt === null ? 1 : 0, at: i * 1000 }));
    const s = sessionStats('palce', recs, 30);
    expect(s).toMatchObject({ trials: 4, correct: 3, accuracy: 0.75, errors: 1, medianRt: 500, iqrRt: 100, perMin: 6 });
    expect(headline('palce', s)).toBe(6);
    expect(median([3, 1, 2])).toBe(2);
  });

  it('the strip is headlined by its longest copied strip', () => {
    const recs = [3, 4, 5, 4].map((n, i) => ({ i, level: n, ok: i !== 2, rt: 1000, taps: n, errors: 0, n, done: n, at: 0 }));
    const s = sessionStats('sekwencja', recs, 60);
    expect(headline('sekwencja', s)).toBe(4);
    expect(s.spanMean).toBe(3.7);
  });
});
