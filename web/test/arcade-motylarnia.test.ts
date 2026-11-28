import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import type { GameEnv } from '../src/arcade/kit/types';
import motylarnia from '../src/arcade/motylarnia/index';
import { drawBubble } from '../src/arcade/motylarnia/garden';
import { DEFAULT_TUNING, type FocusFrame } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { GARDENS, LAP_GROWTH_MAX, LINES, LINE_COUNT, SPECIES, TIPS, gardenAt, speciesById } from '../src/arcade/motylarnia/content';
import { CATALOGS, t } from '../src/arcade/motylarnia/i18n';
import { PACER, computeLayout, gardenCardBox, openCard, tapTargets, toScreen, toWorld, zoomFor } from '../src/arcade/motylarnia/layout';
import { fitFont, font, fontPx } from '../src/arcade/motylarnia/paint';
import { Stick } from '../src/arcade/motylarnia/stick';
import { howto, teachText } from '../src/arcade/motylarnia/index';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TAP, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { passage as passageIn } from '../src/content/scripture';
import { drawEggs, emerge, finishGarden, freshProgress, migrate, starCount, type MothProgress } from '../src/arcade/motylarnia/meta';
import { REACH_MARK, RULES, girthOf, reachFor } from '../src/arcade/motylarnia/rules';
import { ROUND_SEC, roundFor } from '../src/arcade/motylarnia/talk';
import { MothSim, addPigment, multOf, planBlocks, sizeClass, starsOf, wingspan, type SimEvent } from '../src/arcade/motylarnia/sim';
import { decodePath, encodePath, scribble } from '../src/arcade/motylarnia/wing';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-07';
const DT = 1 / 60;

/** A player who knows the game: the controls taught, a few sessions behind them. */
function veteran(over: Partial<MothProgress> = {}): MothProgress {
  // the seventh garden: a long goal, so experiments do not spin a chrysalis by accident
  return { ...freshProgress(), sessions: 4, tut: true, lastDay: '2026-11-06', garden: 6, ...over };
}

const frame = (level: number, reliable = true): FocusFrame => ({
  reliable, activity: reliable ? (level >= 0.5 ? 5 : -1) : null, threshold: 2, level, focused: level >= 0.5, hold: 0, calm: 1 - level,
});

function newSim(o: { progress?: MothProgress; seed?: number; plannedSec?: number; eeg?: boolean; rhythm?: { focus: number; rest: number } } = {}): MothSim {
  const sim = new MothSim({
    progress: o.progress ?? veteran(), rng: mulberry32(o.seed ?? 7), day: DAY, daySeed: 4242, plannedSec: o.plannedSec ?? 300,
    eeg: o.eeg ?? false, tuning: DEFAULT_TUNING, rhythm: o.rhythm,
  });
  sim.start();
  return sim;
}

/** Advance `sec` at 60 fps with a level (or a function of the sim); `each` runs before every step; events collected. */
function run(sim: MothSim, sec: number, level: number | ((s: MothSim) => number) = 0.3, each?: (s: MothSim, i: number) => void, reliable = true): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(sec / DT); i++) {
    each?.(sim, i);
    const l = typeof level === 'function' ? level(sim) : level;
    sim.update(DT, frame(l, reliable), sim.t + DT);
    out.push(...sim.take());
  }
  return out;
}

/** Run until the block kind is `kind` (and `n` blocks in). */
function untilBlock(sim: MothSim, kind: 'push' | 'rest', level = 0.3, max = 200): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < max / DT && !(sim.block.kind === kind && sim.blockT > 0 && sim.blockT < 1); i++) {
    sim.update(DT, frame(level), sim.t + DT);
    out.push(...sim.take());
  }
  expect(sim.block.kind).toBe(kind);
  return out;
}

/** A clear field around the player (no food, rivals or birds), for clean experiments. */
function clearField(sim: MothSim): void {
  sim.food.length = 0;
  sim.rivals.length = 0;
  sim.birds.length = 0;
}

describe('the plan', () => {
  it('fills any session with push and rest blocks, ends on time and never makes a block under 10 s', () => {
    for (const planned of [10, 40, 70, 180, 300, 600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(3));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        for (const b of plan) if (b.kind !== 'warmup') expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
        if (planned >= 70) expect(Math.abs(sum - (planned - RULES.finale))).toBeLessThan(0.5);
      }
    }
    const five = planBlocks(300, false, mulberry32(1)).filter(b => b.kind === 'push');
    for (const b of five) expect(b.dur).toBeGreaterThan(19);
  });

  it('follows the rhythm the player set in the lobby: longer Apetyt, shorter Sjesta, the jitter scaled', () => {
    const mean = (bs: { dur: number }[]) => bs.reduce((s, b) => s + b.dur, 0) / bs.length;
    for (const planned of [300, 1800]) {
      for (const r of [{ focus: 120, rest: 10 }, { focus: 20, rest: 40 }, { focus: 90, rest: 15 }]) {
        const plan = planBlocks(planned, false, mulberry32(5), r);
        const push = plan.filter(b => b.kind === 'push'), rest = plan.filter(b => b.kind === 'rest');
        const k = mean(push) / mean(rest) / (r.focus / r.rest);
        expect(k).toBeGreaterThan(0.8);
        expect(k).toBeLessThan(1.2);
        expect(Math.abs(plan.reduce((s, b) => s + b.dur, 0) - (planned - RULES.finale))).toBeLessThan(0.5);
        for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-6);
        expect(plan.at(-1)!.kind).toBe('rest');
      }
    }
    // no rhythm: the designed one, the Sjesta under a third of the session; the lobby's dials start there
    const plan = planBlocks(600, false, mulberry32(5));
    const share = plan.filter(b => b.kind === 'rest').reduce((s, b) => s + b.dur, 0) / plan.reduce((s, b) => s + b.dur, 0);
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.34);
    const spec = motylarnia.rhythm!();
    expect([spec.focus.def, spec.rest.def]).toEqual([RULES.push[0], RULES.rest[0]]);
    expect([spec.focus.name, spec.rest.name]).toEqual(['Apetyt', 'Sjesta']);
  });

  it('makes every 4th push block blind from the third session, never the first of a session', () => {
    const blindAt = (sessions: number): number[] => {
      const sim = newSim({ progress: veteran({ sessions }), plannedSec: 300 });
      const seen: number[] = [];
      let pushes = 0;
      run(sim, 300, 0.6, s => {
        if (s.block.kind === 'push' && s.blockT < DT * 1.5) {
          pushes++;
          if (s.block.blind) seen.push(pushes);
        }
      });
      return seen;
    };
    expect(blindAt(1)).toEqual([]);
    const b = blindAt(4);
    expect(b.length).toBeGreaterThan(0);
    expect(b).not.toContain(1);
  });
});

describe('the caterpillar', () => {
  it('crawls by itself and turns toward the aim at a limited rate', () => {
    const sim = newSim();
    clearField(sim);
    const h0 = { ...sim.player.segs[0] };
    run(sim, 0.5);
    expect(Math.hypot(sim.player.segs[0].x - h0.x, sim.player.segs[0].y - h0.y)).toBeGreaterThan(RULES.speed * 0.4);
    const d0 = sim.player.dir;
    sim.aim(d0 + Math.PI / 2);
    run(sim, 0.1);
    const turned = Math.abs(Math.atan2(Math.sin(sim.player.dir - d0), Math.cos(sim.player.dir - d0)));
    expect(turned).toBeGreaterThan(0.05);
    expect(turned).toBeLessThanOrEqual(RULES.turn * 0.1 + 0.02);
    run(sim, 1.5);
    expect(Math.abs(Math.sin(sim.player.dir - (d0 + Math.PI / 2)))).toBeLessThan(0.05);
  });

  it('turns with ←/→ and stays in the garden whatever it does', () => {
    const sim = newSim();
    clearField(sim);
    sim.key('ArrowLeft', true);
    const d0 = sim.player.dir;
    run(sim, 0.3);
    expect(Math.sin(sim.player.dir - d0)).toBeLessThan(-0.3);
    sim.key('ArrowLeft', false);
    sim.aim(0);
    run(sim, 30, 0.3, s => { s.aim(0); });
    for (const seg of sim.player.segs) {
      expect(seg.x).toBeGreaterThan(0);
      expect(seg.x).toBeLessThan(RULES.worldW);
      expect(seg.y).toBeGreaterThan(0);
      expect(seg.y).toBeLessThan(RULES.worldH);
    }
  });

  it('keeps its segments one spacing apart', () => {
    const sim = newSim();
    clearField(sim);
    run(sim, 3, 0.3, (s, i) => s.aim(Math.sin(i / 30) * 2));
    const s = sim.player.segs;
    for (let i = 1; i < s.length; i++) expect(Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)).toBeLessThanOrEqual(RULES.spacing + 1e-6);
  });

  it('grows with what it eats, and chains build a multiplier', () => {
    expect(multOf(1)).toBe(1);
    expect(multOf(RULES.chainStep + 1)).toBe(2);
    expect(multOf(999)).toBe(RULES.chainMax);
    const sim = newSim();
    clearField(sim);
    const h = sim.player.segs[0], len0 = sim.len;
    // a row of flowers straight ahead, one every few frames
    for (let i = 1; i <= 10; i++) sim.food.push({ id: 900 + i, kind: 'flower', x: h.x + Math.cos(sim.player.dir) * i * 14, y: h.y + Math.sin(sim.player.dir) * i * 14, r: 9, pig: i % 5, age: 0, pulled: false });
    const ev = run(sim, 1.6);
    // the row's ten flowers all eaten (an eaten flower grows again somewhere: with this seed's draw one lands in the path)
    const eats = ev.filter(e => e.type === 'eat');
    expect(sim.food.some(f => f.id > 900 && f.id <= 910)).toBe(false);
    expect(eats.length).toBeGreaterThanOrEqual(10);
    expect(eats.length).toBeLessThanOrEqual(11);
    expect(sim.len).toBeGreaterThanOrEqual(len0 + 5);
    expect(Math.max(...eats.map(e => (e.type === 'eat' ? e.mult : 0)))).toBe(2);
    expect(sim.score).toBeGreaterThan(30);
    expect(sim.palette.length).toBe(3);
  });

  it('pays for a sprint with tail crumbs, but not when long enough focus makes it free', () => {
    const sim = newSim();
    clearField(sim);
    sim.player.grow = 12;
    run(sim, 0.5);
    const len0 = sim.len;
    sim.sprint(true);
    run(sim, 3.5, 0.2);
    expect(sim.len).toBeLessThan(len0);
    expect(sim.food.filter(f => f.kind === 'crumb').length).toBeGreaterThan(0);
    // the free sprint: a sighted push block past the lead-in, level above the threshold
    const sim2 = newSim();
    untilBlock(sim2, 'push');
    clearField(sim2);
    sim2.player.grow = 12;
    run(sim2, RULES.leadIn.fnirs + 1, 0.9);
    const len1 = sim2.len;
    expect(sim2.freeSprint).toBe(true);
    sim2.sprint(true);
    run(sim2, 3, 0.9);
    expect(sim2.len).toBeGreaterThanOrEqual(len1);
  });

  it('stumbles on its own tail: curls, drops crumbs, never shrinks below the minimum, plays on', () => {
    const sim = newSim({ progress: veteran({ garden: 7 }) });
    clearField(sim);
    sim.player.grow = 30;
    run(sim, 1);
    const len0 = sim.len;
    // turn hard in circles until the head meets the body
    const ev = run(sim, 8, 0.3, s => s.key('ArrowLeft', true));
    sim.key('ArrowLeft', false);
    const st = ev.find(e => e.type === 'stumble');
    expect(st && st.type === 'stumble' && st.cause).toBe('self');
    expect(sim.len).toBeLessThan(len0 + 1);
    expect(sim.len).toBeGreaterThanOrEqual(RULES.minLen);
    expect(sim.stumbles).toBeGreaterThan(0);
    run(sim, 3);
    expect(sim.phase).toBe('play');
  });
});

describe('rivals and birds', () => {
  it('makes a rival whose head runs into the body curl up and drop crumbs, for points', () => {
    const sim = newSim();
    clearField(sim);
    const p = sim.player, h = p.segs[0];
    // a rival heading straight at the player's middle from the side
    const mid = p.segs[4];
    const r = { ...p, id: 77, sp: 'bielinek', segs: Array.from({ length: 10 }, (_, i) => ({ x: mid.x + 30 + i * 9, y: mid.y })), dir: Math.PI, want: Math.PI, curl: 0, safe: 0, away: 0, think: 5, tx: h.x, ty: h.y, grow: 0, sprinting: false };
    sim.rivals.push(r);
    p.dir = -Math.PI / 2;
    const score0 = sim.score;
    const ev = run(sim, 0.6);
    expect(ev.some(e => e.type === 'curl')).toBe(true);
    expect(sim.score).toBeGreaterThan(score0);
    expect(sim.food.filter(f => f.kind === 'crumb').length).toBeGreaterThan(2);
    expect(sim.curls).toBe(1);
  });

  it('stumbles when the head runs into a rival\'s body', () => {
    const sim = newSim();
    clearField(sim);
    const h = sim.player.segs[0], d = sim.player.dir;
    const ax = h.x + Math.cos(d) * 40, ay = h.y + Math.sin(d) * 40;
    const r = { ...sim.player, id: 78, sp: 'bielinek', segs: Array.from({ length: 20 }, (_, i) => ({ x: ax - 90 + i * 9, y: ay })), dir: Math.PI, want: Math.PI, curl: 0, safe: 0, away: 0, think: 5, tx: 0, ty: 0, grow: 0, sprinting: false };
    sim.rivals.push(r);
    sim.player.safe = 0;
    const ev = run(sim, 0.6);
    expect(ev.some(e => e.type === 'stumble' && e.cause === 'rival')).toBe(true);
  });

  it('lets a bird swoop with a shadow first; a peck on the body is a stumble, a miss nearby a near miss', () => {
    const sim = newSim();
    untilBlock(sim, 'push');
    clearField(sim);
    const b = { id: 5, x: 100, y: 100, dir: 0, state: 'walk' as const, tx: 100, ty: 100, hop: 9, timer: 0, next: 0.01, px: 0, py: 0 };
    sim.birds.push(b);
    const ev = run(sim, RULES.swoopWarn + 0.5);
    const sw = ev.findIndex(e => e.type === 'swoop'), pk = ev.findIndex(e => e.type === 'peck');
    expect(sw).toBeGreaterThanOrEqual(0);
    expect(pk).toBeGreaterThan(sw);
    // the shadow lies ahead of the head: if the caterpillar keeps going it is pecked
    expect(ev.some(e => e.type === 'stumble' && e.cause === 'bird') || ev.some(e => e.type === 'near')).toBe(true);
  });

  it('sends the birds to roost in a rest block', () => {
    const sim = newSim();
    untilBlock(sim, 'rest');
    run(sim, 0.5);
    expect(sim.birds.every(b => b.state === 'roost')).toBe(true);
    expect(sim.food.some(f => f.kind === 'dew')).toBe(true);
  });
});

describe('the band', () => {
  it('keeps the reach at its base outside a sighted push block and for the lead-in, then follows the level', () => {
    expect(REACH_MARK).toBeCloseTo(reachFor(0.5));
    const sim = newSim();
    untilBlock(sim, 'push');
    run(sim, RULES.leadIn.fnirs - 1.2, 1);
    expect(sim.reach).toBeLessThan(RULES.reachBase + 1);
    expect(sim.meterValue()).toBe(0);
    run(sim, 4, 1);
    expect(sim.reach).toBeGreaterThan(REACH_MARK);
    expect(sim.meterValue()!).toBeGreaterThan(0.5);
    run(sim, 3, 0.1);
    expect(sim.reach).toBeLessThan(REACH_MARK);
    // the signal fails: neutral (the base), shown as no value
    run(sim, 3, 1, undefined, false);
    expect(sim.reach).toBeLessThan(RULES.reachBase + 2);
    expect(sim.meterValue()).toBeNull();
  });

  it('pulls food inside the reach into the mouth', () => {
    const sim = newSim();
    untilBlock(sim, 'push');
    run(sim, RULES.leadIn.fnirs + 2, 1);
    clearField(sim);
    const h = sim.player.segs[0], d = sim.player.dir;
    // to the side, out of the path, within the big reach but beyond the base one
    sim.food.push({ id: 1, kind: 'leaf', x: h.x + Math.cos(d + Math.PI / 2) * 90, y: h.y + Math.sin(d + Math.PI / 2) * 90, r: 6, pig: -1, age: 0, pulled: false });
    const ev = run(sim, 1.2, 1);
    expect(ev.some(e => e.type === 'eat')).toBe(true);
  });

  it('hides the reach in a blind push block and pays a feast at its end when it passed', () => {
    const sim = newSim({ progress: veteran({ sessions: 4 }), plannedSec: 600 });
    let feast = false, blindSeen = false;
    run(sim, 400, s => (s.block.kind === 'push' ? 0.9 : 0.1), s => {
      if (s.blind) {
        blindSeen = true;
        expect(s.reach).toBeLessThan(RULES.reachBase + 1);
        expect(s.meterValue()).toBeNull();
      }
    }).forEach(e => { if (e.type === 'feast') feast = true; });
    expect(blindSeen).toBe(true);
    expect(feast).toBe(true);
  });

  it('deepens the waiting chrysalis with calm and hatches it at the siesta\'s end (radiant only after a passed rest)', () => {
    const calm = newSim();
    calm.twig.push({ id: 1, sp: 'pawik', depth: 0.3, stars: 3, pig: [0, 1, 2], path: encodePath(scribble(mulberry32(2), 50)), len: 20, egg: null, age: 0, garden: 0 });
    untilBlock(calm, 'rest', 0.6);
    run(calm, 5, 0.1);
    const mid = calm.twig[0].depth;
    expect(mid).toBeGreaterThan(0.45);
    const ev = run(calm, 30, 0.05);
    const h = ev.find(e => e.type === 'hatch');
    expect(h && h.type === 'hatch' && h.b.radiant).toBe(true);
    expect(calm.twig.length).toBe(0);
    // a bad signal neither deepens nor counts against it
    const bad = newSim();
    bad.twig.push({ id: 1, sp: 'pawik', depth: 0.3, stars: 1, pig: [0, 1, 2], path: '', len: 20, egg: null, age: 0, garden: 0 });
    untilBlock(bad, 'rest', 0.6);
    run(bad, 5, 0.1, undefined, false);
    expect(bad.twig[0].depth).toBeCloseTo(0.3, 2);
    const ev2 = run(bad, 30, 0.1, undefined, false);
    const h2 = ev2.find(e => e.type === 'hatch');
    expect(h2 && h2.type === 'hatch' && h2.b.depth).toBe(RULES.depthFloor);
    expect(h2 && h2.type === 'hatch' && h2.b.radiant).toBe(false);
  });

  it('follows the level with the pad only in a sighted push block', () => {
    const sim = newSim();
    untilBlock(sim, 'push');
    expect(sim.padLevel(frame(0.7))).toBe(0.7);
    expect(sim.padLevel(frame(0.7, false))).toBeNull();
    untilBlock(sim, 'rest');
    expect(sim.padLevel(frame(0.7))).toBeNull();
  });

  it('judges every block once at its end and counts the verdicts', () => {
    const sim = newSim({ plannedSec: 180 });
    const ev = run(sim, 190, s => (s.block.kind === 'push' ? 0.9 : 0.1));
    const ends = ev.filter(e => e.type === 'blockEnd');
    expect(ends.length).toBe(sim.plan.length);
    expect(sim.counts.pushOk).toBeGreaterThan(0);
    expect(sim.counts.pushJudged).toBe(sim.plan.filter(b => b.kind === 'push').length);
    expect(ev.filter(e => e.type === 'telegraph').length).toBeGreaterThanOrEqual(sim.plan.length - 1);
  });
});

describe('gardens', () => {
  it('spins a chrysalis at the length goal, scores the stars and starts the next garden', () => {
    expect(starsOf(0, true)).toBe(3);
    expect(starsOf(1, false)).toBe(2);
    expect(starsOf(5, false)).toBe(1);
    const p = veteran();
    const sim = newSim({ progress: p });
    clearField(sim);
    sim.player.grow = sim.garden.len - sim.len + 0.5;
    const g0 = sim.gardenIndex;
    const ev = run(sim, RULES.spinSec + 1);
    expect(ev.some(e => e.type === 'goal')).toBe(true);
    expect(ev.some(e => e.type === 'spun')).toBe(true);
    expect(ev.some(e => e.type === 'garden')).toBe(true);
    expect(sim.gardenIndex).toBe(g0 + 1);
    expect(sim.twig.length).toBe(1);
    expect(p.garden).toBe(g0 + 1);
    expect(p.stars[g0]).toBe(2);
    expect(sim.len).toBe(RULES.startLen);
  });

  it('counts the side goal: the rare flower', () => {
    const sim = newSim({ progress: veteran({ garden: 1 }) });
    expect(sim.garden.side).toBe('rare');
    const rare = sim.rare!;
    expect(rare).not.toBeNull();
    clearField(sim);
    const h = sim.player.segs[0];
    sim.food.push({ ...rare, x: h.x + Math.cos(sim.player.dir) * 20, y: h.y + Math.sin(sim.player.dir) * 20 });
    const ev = run(sim, 0.5);
    expect(ev.some(e => e.type === 'side')).toBe(true);
    expect(sim.sideDone).toBe(true);
  });

  it('loops the map after the eighth garden, each lap longer', () => {
    expect(GARDENS.length).toBe(8);
    expect(gardenAt(8).len).toBe(GARDENS[0].len + 6);
    expect(gardenAt(9).name).toBe(GARDENS[1].name);
    const p = freshProgress();
    finishGarden(p, 0, 2);
    finishGarden(p, 0, 1);
    finishGarden(p, 1, 3);
    expect(p.stars).toEqual([2, 3]);
    expect(p.garden).toBe(2);
    expect(starCount(p)).toBe(5);
  });

  it('turns a chrysalis into a butterfly of the right species in the atlas', () => {
    const p = veteran();
    const sim = newSim({ progress: p });
    const sp = sim.player.sp;
    clearField(sim);
    sim.player.grow = sim.garden.len;
    run(sim, RULES.spinSec + 1);
    const ev = untilBlock(sim, 'rest');
    run(sim, 30, 0.1).forEach(e => ev.push(e));
    const h = ev.find(e => e.type === 'hatch');
    expect(h && h.type === 'hatch' && h.b.sp.id).toBe(sp);
    expect(p.atlas[sp].n).toBe(1);
    expect(p.butterflies.length).toBe(1);
    expect(p.butterflies[0].mm).toBeGreaterThan(speciesById(sp).span[0] * 0.8);
  });

  it('sizes butterflies by stars and depth', () => {
    expect(sizeClass(1, 0.3)).toBe(0);
    expect(sizeClass(3, 0.3)).toBe(2);
    expect(sizeClass(3, 0.9)).toBe(3);
    const sp = speciesById('paz');
    expect(wingspan(sp, 3)).toBeGreaterThan(wingspan(sp, 0));
    expect(addPigment([0, 1, 2], 3)).toEqual([1, 2, 3]);
    expect(addPigment([0, 1, 2], 0)).toEqual([1, 2, 0]);
  });
});

describe('the session', () => {
  it('plays the smoke path: centre taps every 0.65 s, Space every 2 s, simulated focus → score > 0 within 22 s', () => {
    for (const first of [true, false]) {
      const p = first ? freshProgress() : veteran();
      const sim = newSim({ progress: p, plannedSec: 60, seed: 11 });
      const scores: number[] = [];
      run(sim, 22, 0.7, (s, i) => {
        // a centre click below the head = aim down
        if (i % 39 === 0) { s.tapCard(); s.aim(Math.PI / 2); }
        if (i % 120 === 0) s.key(' ', true);
        if (i % 120 === 6) s.key(' ', false);
        if (i % 60 === 0) scores.push(s.headline().value);
      });
      expect(sim.result().score).toBeGreaterThan(0);
      expect(scores[scores.length - 1]).toBeGreaterThan(scores[Math.floor(scores.length / 2)]);
      expect(sim.headline().value).toBe(sim.result().score);
    }
  });

  it('lets a steering player finish a garden in about a minute, and focus makes the gardens come faster', () => {
    const play = (level: number): MothSim => {
      const sim = newSim({ progress: veteran({ garden: 0 }), plannedSec: 180, seed: 3 });
      run(sim, 180, s => (s.block.kind === 'push' ? level : 1 - level), (s, i) => {
        if (i % 10) return;
        // the "smart player": head for the nearest food, flowers first
        const h = s.player.segs[0];
        let best: { x: number; y: number } | null = null, bd = Infinity;
        for (const f of s.food) {
          const d = ((f.x - h.x) ** 2 + (f.y - h.y) ** 2) / (f.kind === 'flower' ? 3 : 1);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) s.aim(Math.atan2(best.y - h.y, best.x - h.x));
      });
      return sim;
    };
    const calm = play(0.3), keen = play(0.9);
    expect(calm.gardensDone).toBeGreaterThanOrEqual(2);
    expect(calm.gardensDone).toBeLessThanOrEqual(6);
    expect(keen.gardensDone).toBeGreaterThanOrEqual(calm.gardensDone);
    expect(keen.result().score).toBeGreaterThan(calm.result().score);
  });

  it('never ends early and lets the session stop at most a few seconds after time is up', () => {
    const sim = newSim({ plannedSec: 60 });
    run(sim, 55, 0.5);
    expect(sim.phase === 'finale' || sim.phase === 'done').toBe(false);
    run(sim, 6, 0.5);
    expect(sim.canStop()).toBe(true);
  });

  it('is idempotent in result() and keeps the best with Math.max', () => {
    const p = veteran({ bestSession: 5 });
    const sim = newSim({ progress: p, plannedSec: 60 });
    run(sim, 20, 0.7, (s, i) => { if (i % 39 === 0) s.aim(Math.PI / 2); });
    const a = sim.result(), b = sim.result();
    expect(a).toEqual(b);
    expect(p.bestSession).toBe(Math.max(5, a.score));
    expect(a.stats.length).toBeGreaterThanOrEqual(6);
    expect(a.highlights.length).toBeLessThanOrEqual(4);
    expect(a.verse).toBeTruthy();
  });

  it('settles an early end: the twig hatches', () => {
    const p = veteran();
    const sim = newSim({ progress: p });
    sim.twig.push({ id: 1, sp: 'cytrynek', depth: 0.6, stars: 2, pig: [0, 1, 2], path: '', len: 20, egg: null, age: 0, garden: 0 });
    sim.finish();
    expect(sim.twig.length).toBe(0);
    expect(p.atlas.cytrynek?.n).toBe(1);
    sim.finish();
    expect(p.atlas.cytrynek?.n).toBe(1);
  });

  it('teaches the controls in the first session, one at a time', () => {
    const p = freshProgress();
    const sim = newSim({ progress: p, plannedSec: 300 });
    expect(sim.plan[0].kind).toBe('warmup');
    const ev = run(sim, 40, 0.6, (s, i) => { if (i === 30) s.tapCard(); if (i === 700) s.sprint(true); if (i === 760) s.sprint(false); });
    const taught = ev.filter(e => e.type === 'teach').map(e => (e.type === 'teach' ? e.what : ''));
    expect(taught).toContain('steer');
    expect(taught).toContain('sprint');
    expect(new Set(taught).size).toBe(taught.length);
    sim.result();
    expect(p.tut).toBe(true);
  });

  it('teaches only the Sjesta in a Sjesta: a rival met there is taught at the next Apetyt', () => {
    const sim = newSim({ progress: veteran({ seen: [] }) });
    // no rival near before the Sjesta (the garden's own would be taught in the first Apetyt)
    for (let i = 0; i < 200 / DT && !(sim.block.kind === 'rest' && sim.blockT > 0); i++) {
      sim.rivals.length = 0;
      sim.update(DT, frame(0.3), sim.t + DT);
      sim.take();
    }
    expect(sim.block.kind).toBe('rest');
    clearField(sim);
    const rival = () => {
      // beside the caterpillar, a little behind, heading the other way: near, never in its path
      const h = sim.player.segs[0], d = sim.player.dir, nx = -Math.sin(d), ny = Math.cos(d);
      const x0 = h.x + nx * 150 - Math.cos(d) * 60, y0 = h.y + ny * 150 - Math.sin(d) * 60;
      sim.rivals.length = 0;
      sim.rivals.push({ ...sim.player, id: 79, sp: 'bielinek', segs: Array.from({ length: 12 }, (_, i) => ({ x: x0 + Math.cos(d) * i * 9, y: y0 + Math.sin(d) * i * 9 })), dir: d + Math.PI, want: d + Math.PI, curl: 0, safe: 0, away: 0, think: 5, tx: 0, ty: 0, grow: 0, sprinting: false });
    };
    rival();
    // through the rest of the Sjesta and into the next Apetyt, each rival mark with the block it came in
    const marks: string[] = [];
    for (let i = 0; i < 120 / DT && !(sim.block.kind === 'push' && sim.blockT > 1); i++) {
      if (sim.block.kind === 'push' && !sim.rivals.length) rival();
      sim.update(DT, frame(0.3), sim.t + DT);
      for (const e of sim.take()) if (e.type === 'teach' && e.what === 'rival') marks.push(sim.block.kind);
    }
    expect(marks).toEqual(['push']);
  });

  it('has Hieronim speak one short line at a time', () => {
    const sim = newSim({ plannedSec: 180 });
    let lines = 0, prev: unknown = null;
    run(sim, 120, s => (s.block.kind === 'push' ? 0.8 : 0.2), s => {
      if (s.talk && s.talk !== prev) lines++;
      prev = s.talk;
    });
    expect(lines).toBeGreaterThan(4);
    for (const l of sim.said) expect(l.length).toBeLessThanOrEqual(90);
  });
});

describe('progress', () => {
  it('migrates a v1 save: the best score, the sessions and the collection stay, the rest starts fresh', () => {
    const old = {
      v: 1, sessions: 7, lastDay: '2026-10-30', total: 5, hatched: 5, nextId: 6,
      butterflies: [{ id: 1, sp: 'pawik', day: '2026-10-20', mm: 55, cls: 2, f: 0, pig: [0, 1, 2], b: 70, path: encodePath(scribble(mulberry32(1), 60)) }, { junk: true }],
      atlas: { pawik: { n: 1, larva: true, best: 55, radiant: 0, classic: false, ab: 0, first: '2026-10-20' } },
      eggs: [{ sp: 'cytrynek', ready: '2026-10-31', from: 'laid' }, 'nonsense'], pity: { rare: 2, epic: 4, legend: 4, aberr: 4 }, pollen: 12,
      bestSession: 240, daily: { day: '2026-10-30', done: true, sp: 'pawik', mm: 55 },
      // a field from the v1 game this version does not know, and one of a wrong type
      garden: 'leaf', stars: 'x',
    };
    const p = migrate(mergeSaved(freshProgress(), JSON.parse(JSON.stringify(old))));
    expect(p.ver).toBe(2);
    expect(p.sessions).toBe(7);
    expect(p.bestSession).toBe(240);
    expect(p.atlas.pawik.n).toBe(1);
    expect(p.butterflies.length).toBe(1);
    expect(p.eggs.length).toBe(1);
    expect(p.garden).toBe(0);
    expect(p.stars).toEqual([]);
    expect(p.tut).toBe(false);
    expect('v' in p).toBe(false);
    // it plays from there
    const sim = new MothSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 60, eeg: false, tuning: DEFAULT_TUNING });
    sim.start();
    run(sim, 5);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
    // garbage never throws
    expect(() => migrate(mergeSaved(freshProgress(), { sessions: 'a', atlas: 3, butterflies: {}, pity: null, ver: 2, stars: [1, 'x', 9] }))).not.toThrow();
    const q = migrate(mergeSaved(freshProgress(), { ver: 2, stars: [1, 'x', 9], garden: 3 }));
    expect(q.stars).toEqual([1, 0, 3]);
    expect(q.garden).toBe(3);
  });

  it('still offers the egg cards and the atlas rules of the collection', () => {
    const p = freshProgress();
    const offers = drawEggs(p, DAY, 1, mulberry32(1));
    expect(offers[0].sp).toBe('pawik');
    const r = emerge(p, { sp: 'pawik', mm: 50, cls: 1, flags: 0, pig: [0, 1, 2], depth: 0.5, path: '', daily: false, egg: offers[0] }, DAY, mulberry32(2));
    expect(r.isNew).toBe(true);
    expect(p.total).toBe(1);
  });

  it('stores a wing path compactly and reads it back', () => {
    const path = scribble(mulberry32(4), 300);
    const s = encodePath(path);
    expect(s.length).toBeLessThan(1600);
    expect(decodePath(s).length).toBeGreaterThan(50);
  });
});

describe('the screen', () => {
  it('maps world and screen both ways and keeps play below the HUD', () => {
    for (const [w, h] of [[1280, 672], [390, 694], [844, 300]]) {
      const L = computeLayout(w, h, 130);
      expect(L.play.y).toBeGreaterThanOrEqual(Math.min(h * 0.4, 130));
      expect(L.bed.y + L.bed.h).toBe(h);
      const cam = { x: 900, y: 600, z: zoomFor(L, 30) };
      const s = toScreen(L, cam, 950, 640, { x: 0, y: 0 }), back = toWorld(L, cam, s.x, s.y, { x: 0, y: 0 });
      expect(back.x).toBeCloseTo(950);
      expect(back.y).toBeCloseTo(640);
      expect(zoomFor(L, 70)).toBeLessThan(zoomFor(L, 8));
    }
    expect(girthOf(100)).toBe(RULES.girth[2]);
  });
});

describe('texts', () => {
  it('has every text in pl, en, de and sv with the same placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Hieronim at least three lines per moment, each at most 90 characters, and strategies without "harder"', () => {
    for (const [m, n] of Object.entries(LINE_COUNT)) {
      expect(n).toBeGreaterThanOrEqual(3);
      for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
        for (let i = 1; i <= n; i++) {
          const s = (CATALOGS[lang] as Record<string, unknown>)[`say.${m}.${i}`];
          expect(typeof s).toBe('string');
          expect((s as string).length, `${lang} say.${m}.${i}`).toBeLessThanOrEqual(90);
        }
      }
    }
    expect(LINES.open.length).toBe(3);
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[lang])) {
        if (!k.startsWith('tip.')) continue;
        expect(String(v)).not.toMatch(/mocniej|harder|stärker|hack|unlock/i);
      }
    }
    expect(TIPS.push.length).toBe(6);
    expect(t('unit')).toBeTruthy();
    expect(SPECIES.length).toBe(18);
  });
});

// ── mobile first ─────────────────────────────────────────────────
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)![1]);
/** A canvas stand-in that measures text a little wide (0.55 em a letter), so a fit here fits on a phone. */
function measuring(): CanvasRenderingContext2D {
  const ctx = {
    font: '10px sans-serif', save() { /* nothing */ }, restore() { /* nothing */ },
    measureText(text: string) { return { width: text.length * pxOf(this.font) * 0.55 } as TextMetrics; },
  };
  return ctx as unknown as CanvasRenderingContext2D;
}
const LANGS = ['pl', 'en', 'de', 'sv'] as const;
const word = (l: (typeof LANGS)[number], k: string): string => (CATALOGS[l] as Record<string, unknown>)[k] as string;

describe('mobile first (DESIGN §3.3, §12)', () => {
  it('keeps the play under the HUD and the flowerbed on the bottom, the passive things in the band under the HUD', () => {
    for (const c of CHECK_SIZES) {
      // a finger on a phone and a tablet, a mouse on a desktop and the big monitors (§14)
      const L = computeLayout(c.w, c.h, c.insets, c.w < 1024);
      expect(L.u).toBeGreaterThanOrEqual(1);
      expect(L.u, c.name).toBeLessThanOrEqual(Math.min(c.w, c.h) >= DESK_BIG ? DESK_MAX : 1.3);
      if (Math.min(c.w, c.h) <= 390) expect(L.u, c.name).toBe(1);
      expect(L.play.y).toBe(c.insets.top);
      expect(L.play.y + L.play.h).toBe(L.bed.y);
      expect(L.bed.y + L.bed.h).toBe(c.h);
      expect(L.bed.y, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom - 30);
      // Hieronim, the side goal's pill and his bubble: under the HUD, inside the gutters, clear of the twig
      const sx = L.snail.x - 26 * L.snail.s, sy = L.snail.y - 44 * L.snail.s;
      expect(sx, c.name).toBeGreaterThanOrEqual(c.insets.left + (c.h > c.w && c.w < 600 ? 16 : 8) - 0.01);
      expect(sy, c.name).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.pill.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.pill.x + Math.min(L.pill.maxW, 200), c.name).toBeLessThanOrEqual(Math.max(L.twig.x0 - 8, L.pill.x + L.pill.maxW) + 0.01);
      expect(L.pill.x + L.pill.maxW).toBeLessThanOrEqual(L.twig.x0 - 8 + 0.01);
      expect(L.pill.h).toBeGreaterThanOrEqual(26);
      expect(L.bubble.y).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.bubble.x + L.bubble.maxW, c.name).toBeLessThanOrEqual(L.x1 + 0.01);
      expect(L.bubble.maxW).toBeGreaterThanOrEqual(170);
      // everything passive sits in the top half, out of the thumb's way
      expect(L.pill.y + L.pill.h, c.name).toBeLessThan(c.h - (c.h - c.insets.top) * THUMB);
      expect(L.snail.y, c.name).toBeLessThan(c.h - (c.h - c.insets.top) * THUMB);
      // the floating stick: a finger-sized base, the sprint's rim beyond it, a small dead zone
      expect(2 * L.stick.r).toBeGreaterThanOrEqual(MIN_TAP * 2);
      expect(L.stick.sprint).toBeGreaterThan(L.stick.r);
      expect(L.stick.dead).toBeGreaterThanOrEqual(8);
      expect(L.stick.dead).toBeLessThan(L.stick.r / 2);
      // a phone shows the garden at 1 px per unit or more (the caterpillar stays readable), a desktop as before
      if (Math.min(c.w, c.h) < 600) expect(L.zoom, c.name).toBeGreaterThanOrEqual(1);
    }
  });

  it('fits the opening card in four languages at every size (13 px and up, 15 and up on a phone), the garden card too; each is the one target', () => {
    const ctx = measuring();
    for (const c of CHECK_SIZES) {
      const L = computeLayout(c.w, c.h, c.insets);
      for (const l of LANGS) {
        const O = openCard(ctx, L, { body: word(l, 'card.open.text') }, passageIn('2co5.17', l), (px, weight = 700, family = 'sans') => `${weight} ${fontPx(px)}px ${family}`);
        const at = `${c.name} ${l}`;
        expect(O.verse.fits, at).toBe(true);
        expect(O.box.y).toBeGreaterThanOrEqual(L.card.y);
        expect(O.box.y + O.box.h, at).toBeLessThanOrEqual(L.card.y + L.card.h + 0.01);
        for (const px of [O.bodySize, O.verse.size, O.refSize, O.tapSize]) expect(px, at).toBeGreaterThanOrEqual(MIN_READ);
        if (Math.min(c.w, c.h) < 600) expect(O.bodySize, at).toBeGreaterThanOrEqual(15);
        expect(auditTargets(tapTargets(L, O.box), c.w, c.h, c.insets), at).toEqual([]);
      }
      const g = gardenCardBox(L);
      expect(auditTargets(tapTargets(L, g), c.w, c.h, c.insets), c.name).toEqual([]);
      expect(g.y + g.h).toBeLessThanOrEqual(L.bed.y);
      // on a phone upright the garden's card is a sheet over the flowerbed, clear of the runner's block banner
      if (L.shape === 'tall') expect(g.y, c.name).toBeGreaterThan(c.insets.top + 130);
      expect(tapTargets(L, null)).toEqual([]);
    }
  });

  it('never draws text under 11 px: the font helper has a floor, the fitting helper too', () => {
    for (const px of [0, 4, 9.5, 10, 10.99, 11, 12, 13, 28]) expect(pxOf(font(px))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fontPx(14.26)).toBe(14.3);
    const ctx = measuring();
    expect(fitFont(ctx, 'Ogród 7: Bardzo długa nazwa ogrodu za płotem', 40, 22, 700, 'serif')).toBeGreaterThanOrEqual(MIN_TEXT);
  });

  it('steers with a floating stick: the drag\'s direction, a dead zone, a push past the rim sprints, a tap points', () => {
    const st = new Stick({ r: 46, knob: 21, dead: 10, sprint: 53 });
    expect(st.down(1, 200, 400, 0)).toBe(true);
    // a second finger does not take the stick over
    expect(st.down(2, 50, 50, 0)).toBe(false);
    expect(st.move(2, 60, 60)).toBeNull();
    // inside the dead zone: no heading yet
    expect(st.move(1, 204, 397)).toEqual({ aim: null, sprint: false });
    // up and to the right: the heading of the drag, wherever the thumb is on the screen
    const m = st.move(1, 230, 370)!;
    expect(m.aim).toBeCloseTo(Math.atan2(-30, 30));
    expect(m.sprint).toBe(false);
    // pushed past the rim: a sprint; pulled back inside: none
    expect(st.move(1, 200, 340)!.sprint).toBe(true);
    expect(st.move(1, 200, 370)!.sprint).toBe(false);
    // pulled far away: the base follows, the knob stays at the far edge, still a sprint
    const far = st.move(1, 200, 100)!;
    expect(far.sprint).toBe(true);
    expect(far.aim).toBeCloseTo(-Math.PI / 2);
    expect(400 - st.s!.by).toBeGreaterThan(200);
    expect(st.up(1, 2)).toEqual({ tap: false, sprintEnds: true });
    expect(st.s).toBeNull();
    // a quick tap without a drag points (the game turns toward the tapped spot)
    st.down(3, 100, 100, 5);
    st.move(3, 104, 102);
    expect(st.up(3, 5.2)).toEqual({ tap: true, sprintEnds: false });
    // a long still press is not a tap (the heading stays)
    st.down(4, 100, 100, 6);
    expect(st.up(4, 7)).toEqual({ tap: false, sprintEnds: false });
  });

  it('speaks to the hand the player has: a finger never hears of keys or a mouse, a mouse keeps them', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|blanksteg|klawisz|taste|tangent|\bkey|klik|klick|click|mysz|mouse|maus|musen|musknapp|[←→↑↓]/i;
    for (const l of LANGS) {
      for (const k of ['teach.steer', 'teach.sprint', 'how.steer', 'how.sprint', 'how.goal', 'card.tap']) {
        expect(word(l, k), `${l}.${k}`).toBeTypeOf('string');
        expect(word(l, k), `${l}.${k}`).not.toMatch(KEYS);
      }
      for (const k of ['teach.steer.keys', 'teach.sprint.keys', 'how.steer.mouse', 'how.sprint.mouse', 'how.keys', 'card.tap.keys']) expect(word(l, k), `${l}.${k}`).toMatch(KEYS);
    }
    for (const what of ['steer', 'sprint', 'eat', 'rival', 'bird', 'reach', 'rest', 'rare', 'goal'] as const) expect(teachText(what, true)).not.toMatch(KEYS);
    expect(teachText('steer', false)).toMatch(KEYS);
    expect(teachText('sprint', false)).toMatch(KEYS);
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(h => h.gesture === 'keys')).toBe(false);
    expect(touch.hands.map(h => h.text).join(' ')).not.toMatch(KEYS);
    expect(desk.hands.some(h => h.gesture === 'keys')).toBe(true);
  });
});

describe('big screens and the mouse (DESIGN §14)', () => {
  const BIG = CHECK_SIZES.filter(c => Math.min(c.w, c.h) >= DESK_BIG);
  /** every string filled on a context, with its font size */
  const texts: { text: string; px: number }[] = [];
  function quiet(canvas: unknown): CanvasRenderingContext2D {
    const gradient = { addColorStop: () => undefined };
    const state: Record<PropertyKey, unknown> = { canvas, font: '10px sans-serif', globalAlpha: 1 };
    return new Proxy(state, {
      get(target, prop) {
        if (prop in target) return target[prop];
        switch (prop) {
          case 'measureText': return (str: string) => ({ width: String(str).length * pxOf(String(state.font)) * 0.55 });
          case 'createLinearGradient': case 'createRadialGradient': case 'createConicGradient': case 'createPattern': return () => gradient;
          case 'getImageData': return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
          case 'createImageData': return (w: number, h: number) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h });
          case 'fillText': case 'strokeText': return (str: string) => { texts.push({ text: String(str), px: pxOf(String(state.font)) }); };
          default: return () => undefined;
        }
      },
      set(target, prop, value) { target[prop] = value; return true; },
    }) as unknown as CanvasRenderingContext2D;
  }
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: unknown };
  const original = proto.getContext;
  const g = globalThis as unknown as { Path2D?: unknown };
  const hadPath = 'Path2D' in g;
  beforeAll(() => {
    proto.getContext = function (this: HTMLCanvasElement) { return quiet(this); };
    if (!hadPath) g.Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} bezierCurveTo() {} closePath() {} roundRect() {} arc() {} ellipse() {} rect() {} addPath() {} };
  });
  afterAll(() => {
    proto.getContext = original;
    if (!hadPath) delete g.Path2D;
  });

  it('brings the garden closer with a big screen and grows the passive things with it', () => {
    expect(BIG.map(c => c.w)).toEqual([1190, 1587]);
    const views: number[] = [];
    for (const c of BIG) {
      const L = computeLayout(c.w, c.h, c.insets, false);
      expect(L.big && L.mouse, c.name).toBe(true);
      // the zoom grows past the desktop's 2 with the UI scale: QHD shows the garden Full HD does, larger
      expect(L.zoom, c.name).toBeCloseTo(Math.min(2 * L.u / 1.35, Math.min(c.w, c.h * 1.1) / 430), 5);
      expect(L.zoom, c.name).toBeGreaterThanOrEqual(2);
      views.push(L.play.w / L.zoom);
      // Hieronim, his line, the twig and the flowerbed at the screen's scale (they stopped at a phone's size)
      expect(L.k, c.name).toBe(L.u);
      expect(L.snail.s, c.name).toBe(L.u);
      expect(L.bed.h, c.name).toBeGreaterThanOrEqual(Math.round(36 * L.u));
      expect(L.pill.h, c.name).toBeGreaterThanOrEqual(28 * L.u - 1);
      expect(L.bubble.maxW, c.name).toBeGreaterThanOrEqual(380 * L.u - 1);
      // still under the HUD, inside the gutters, the flowerbed on the bottom
      expect(L.play.y, c.name).toBe(c.insets.top);
      expect(L.bed.y + L.bed.h, c.name).toBe(c.h);
      expect(L.snail.y - 44 * L.snail.s, c.name).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.pill.x + L.pill.maxW, c.name).toBeLessThanOrEqual(L.twig.x0 - 8 + 0.01);
    }
    expect(Math.abs(views[0] - views[1]), 'the same garden in sight').toBeLessThan(5);
    const qhd = computeLayout(BIG[1].w, BIG[1].h, BIG[1].insets, false);
    expect(qhd.zoom).toBeGreaterThan(2.5);
    // Hieronim's line at 14 px × the screen's scale
    texts.length = 0;
    drawBubble(quiet(null), 'Ogród jest duży, a ja mam czas. Pełzaj spokojnie!', 0, 0, qhd.bubble.maxW, 1, true, qhd.k);
    expect(texts.length).toBeGreaterThan(0);
    for (const x of texts) expect(x.px).toBeGreaterThanOrEqual(13 * qhd.k - 0.05);
  });

  it('keeps every phone, tablet and desktop as it was: only a mouse on a big screen changes the garden', () => {
    for (const c of CHECK_SIZES) {
      const finger = computeLayout(c.w, c.h, c.insets, true), mouse = computeLayout(c.w, c.h, c.insets, false);
      expect(computeLayout(c.w, c.h, c.insets), c.name).toEqual(finger);
      expect(finger.big || finger.k !== 1, c.name).toBe(false);
      if (Math.min(c.w, c.h) >= DESK_BIG) continue;
      const { mouse: m1, ...a } = mouse;
      const { mouse: m2, ...b } = finger;
      expect(a, c.name).toEqual(b);
      expect([m1, m2]).toEqual([true, false]);
    }
    // the zoom before the desktop pass (2026-11-13): small phone, side, tablet, desktop, laptop, Full HD under a finger
    const z = (i: number) => Math.round(computeLayout(CHECK_SIZES[i].w, CHECK_SIZES[i].h, CHECK_SIZES[i].insets, CHECK_SIZES[i].w < 1024).zoom * 100) / 100;
    expect([0, 4, 6, 7, 9].map(z)).toEqual([1, 1, 1.91, 1.72, 1.69]);
  });

  it('drops the twig under the runner\'s breath pacer in a Sjesta where its chrysalises would hide behind it, and lifts it after', () => {
    for (const c of CHECK_SIZES.filter(x => ['small phone (Chrome)', 'phone on its side (chart on)', 'desktop'].includes(x.name))) {
      const hints: { y: number }[] = [];
      const env: GameEnv<MothProgress> = {
        canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
        progress: veteran(), rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: true,
        haptics: false, tuning: DEFAULT_TUNING, hint: (_t, at) => { if (at) hints.push(at); }, hudTop: () => c.insets.top, insets: () => c.insets, touch: true,
      };
      const game = motylarnia.create(env);
      game.resize(c.w, c.h, 1);
      game.start();
      const sim = (game as unknown as { sim: MothSim }).sim;
      const view = (game as unknown as { view: { L: { w: number; play: { y: number }; twig: { y: number; len: number } }; twigSpot(): { x: number; y: number } } }).view;
      const spotY = () => view.twigSpot().y - view.L.twig.y - view.L.twig.len * 0.9;
      let time = 0;
      while (!(sim.block.kind === 'rest' && sim.blockT > 1) && time < 120) game.update(DT, frame(0.3), (time += DT));
      expect(sim.block.kind, c.name).toBe('rest');
      // an upright phone: the twig reaches the pacer's half under the play's centre; on its side and at a desk it is clear
      const phone = c.w < 500;
      expect(spotY(), c.name).toBeCloseTo(phone ? PACER.drop : 0, 6);
      while (sim.block.kind === 'rest' && time < 240) game.update(DT, frame(0.3), (time += DT));
      game.update(DT, frame(0.3), (time += DT));
      expect(spotY(), c.name).toBeCloseTo(0, 6);
      game.destroy();
    }
  });

  it('answers the mouse: a crosshair over the garden, an aim ring where the caterpillar heads, a hand over a card', () => {
    for (const c of BIG) {
      const env: GameEnv<MothProgress> = {
        canvas: document.createElement('canvas'), hud: document.createElement('div'), audio: new ArcadeAudio(0, false),
        progress: freshProgress(), rng: mulberry32(5), day: DAY, daySeed: 31, plannedSec: 90, tool: 'fnirs', simulated: true, reducedMotion: true,
        haptics: false, tuning: DEFAULT_TUNING, hint: () => {}, hudTop: () => c.insets.top, insets: () => c.insets, touch: false,
      };
      const game = motylarnia.create(env);
      game.resize(c.w, c.h, 1);
      game.start();
      const sim = (game as unknown as { sim: MothSim }).sim;
      const view = (game as unknown as { view: { mouse: { x: number; y: number } | null; headScreen(s: MothSim): { x: number; y: number } } }).view;
      let time = 0;
      const step = (sec: number, level = 0.3) => {
        for (const end = time + sec; time < end; time += DT) {
          game.update(DT, frame(level), time);
          game.draw();
        }
      };
      step(0.6);
      // the first session opens with its story card: a hand (a click closes it once it has been up a moment)
      expect(sim.card, c.name).not.toBeNull();
      expect(env.canvas.style.cursor, c.name).toBe('pointer');
      game.pointer!({ type: 'down', x: c.w / 2, y: c.h / 2, id: 1 });
      game.pointer!({ type: 'up', x: c.w / 2, y: c.h / 2, id: 1 });
      step(0.5);
      expect(sim.card, c.name).toBeNull();
      expect(env.canvas.style.cursor, c.name).toBe('crosshair');
      // the pointer steers: the ring where it is, the caterpillar turning toward it
      const h = view.headScreen(sim), tx = h.x + 300, ty = h.y - 200;
      game.pointer!({ type: 'move', x: tx, y: ty, id: 1 });
      expect(view.mouse, c.name).toEqual({ x: tx, y: ty });
      step(1);
      const p = sim.player, dir = Math.atan2(ty - h.y, tx - h.x);
      expect(Math.abs(Math.atan2(Math.sin(p.want - dir), Math.cos(p.want - dir))), c.name).toBeLessThan(0.6);
      // leaving the canvas takes the ring away; the end puts the cursor back
      env.canvas.dispatchEvent(new Event('pointerleave'));
      expect(view.mouse, c.name).toBeNull();
      game.destroy();
      expect(env.canvas.style.cursor, c.name).toBe('');
      // a finger: no cursor, no ring
      const env2 = { ...env, canvas: document.createElement('canvas'), progress: freshProgress(), touch: true };
      const g2 = motylarnia.create(env2);
      g2.resize(c.w, c.h, 1);
      g2.start();
      g2.update(DT, frame(0.3), DT);
      g2.pointer!({ type: 'move', x: 100, y: 300, id: 1 });
      expect(env2.canvas.style.cursor, c.name).toBe('');
      expect((g2 as unknown as { view: { mouse: unknown } }).view.mouse, c.name).toBeNull();
      g2.destroy();
    }
  });
});

// ── long sessions (15–30 min) ────────────────────────────────────

describe('Motylarnia at 15–30 minutes', () => {
  it('plans 900–1800 s to the finale: Apetyt/Sjesta pairs at their design lengths, ending on a Sjesta', () => {
    for (const planned of [900, 1200, 1500, 1800]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(Math.abs(sum - (planned - RULES.finale))).toBeLessThan(0.5);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        const core = plan.filter(b => b.kind !== 'warmup');
        core.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(core.at(-1)!.kind).toBe('rest');
        for (const b of core) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.1);
        }
      }
    }
  });

  it('plays a whole 30-min session: gardens keep coming, the world stays bounded, it reaches its finale', () => {
    const sim = newSim({ progress: veteran({ garden: 0 }), plannedSec: 1800, seed: 5 });
    let maxFood = 0, maxRival = 0, evs = 0;
    const dt = 1 / 20;
    for (let i = 0; i < 1806 / dt && sim.phase !== 'done'; i++) {
      if (i % 3 === 0) {
        const h = sim.player.segs[0];
        let best: { x: number; y: number } | null = null, bd = Infinity;
        for (const f of sim.food) {
          const d = ((f.x - h.x) ** 2 + (f.y - h.y) ** 2) / (f.kind === 'flower' ? 3 : 1);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) sim.aim(Math.atan2(best.y - h.y, best.x - h.x));
      }
      const l = sim.block.kind === 'push' ? 0.85 : 0.2;
      sim.update(dt, frame(l), sim.t + dt);
      evs += sim.take().length;
      maxFood = Math.max(maxFood, sim.food.length);
      for (const r of sim.rivals) maxRival = Math.max(maxRival, r.segs.length);
    }
    expect(sim.phase).toBe('done');
    expect(sim.t).toBeLessThan(1801);
    expect(sim.t).toBeGreaterThan(1795);
    expect(evs).toBeGreaterThan(500);
    expect(sim.gardensDone).toBeGreaterThan(8);   // past the first lap
    expect(maxFood).toBeLessThan(800);
    expect(maxRival).toBeLessThan(120);
    expect(sim.player.segs.length).toBeLessThan(200);
    expect(Number.isFinite(sim.score)).toBe(true);
    expect(sim.twig.length).toBeLessThanOrEqual(RULES.twigMax);
    const out = sim.result();
    expect(out.highlights.length).toBeLessThanOrEqual(4);
    for (const s of out.highlights) expect(s.length).toBeLessThan(160);
    for (const s of [...out.highlights, ...out.stats.flat(), sim.headline().sub]) expect(s).not.toMatch(/undefined|NaN|Infinity/);
  });

  it('plays any rhythm the player sets to its finale: 3, 10 and 30 minutes, long feeding runs or long siestas, the score still grows', () => {
    for (const plannedSec of [180, 600, 1800]) {
      for (const rhythm of [undefined, { focus: 120, rest: 10 }, { focus: 20, rest: 40 }]) {
        const name = `${plannedSec} ${rhythm ? `${rhythm.focus}/${rhythm.rest}` : 'designed'}`;
        const sim = newSim({ progress: veteran({ garden: 0 }), plannedSec, seed: 5, rhythm });
        const dt = 1 / 15;
        let at = 0, radiant = 0;
        for (let i = 0; i < (plannedSec + 6) / dt && sim.phase !== 'done'; i++) {
          if (i % 3 === 0) {
            const h = sim.player.segs[0];
            let best: { x: number; y: number } | null = null, bd = Infinity;
            for (const f of sim.food) {
              const d = ((f.x - h.x) ** 2 + (f.y - h.y) ** 2) / (f.kind === 'flower' ? 3 : 1);
              if (d < bd) { bd = d; best = f; }
            }
            if (best) sim.aim(Math.atan2(best.y - h.y, best.x - h.x));
          }
          sim.update(dt, frame(sim.block.kind === 'push' ? 0.85 : 0.2), sim.t + dt);
          for (const e of sim.take()) if (e.type === 'hatch' && e.b.radiant) radiant++;
          if (!at && sim.t >= plannedSec * 2 / 3) at = sim.score;
        }
        expect(sim.phase, name).toBe('done');
        expect(sim.score, name).toBeGreaterThan(at);
        expect(sim.twig.length, name).toBeLessThanOrEqual(RULES.twigMax);
        expect(Number.isFinite(sim.score), name).toBe(true);
        // a Sjesta of the designed length still deepens the chrysalises to radiant
        if (plannedSec >= 600 && (!rhythm || rhythm.rest >= RULES.rest[0])) expect(radiant, name).toBeGreaterThan(0);
      }
    }
  });

  it('plateaus the map\'s laps: a far lap is a harder garden, never an endless caterpillar', () => {
    for (const i of [0, 8, 40, 400]) {
      const g = gardenAt(i);
      expect(g.len).toBeLessThanOrEqual(Math.max(...GARDENS.map(x => x.len)) + 24);
      expect(g.rivals).toBeLessThanOrEqual(5);
    }
  });
});

// ── long sessions (45–60 min, round 24) ─────────────────────────

describe('Motylarnia at 45–60 minutes', () => {
  it('plans 2700 and 3600 s to the finale: Apetyt/Sjesta pairs at their design lengths, ending on a Sjesta', () => {
    for (const planned of [2700, 3600]) {
      for (const first of [false, true]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(Math.abs(sum - (planned - RULES.finale))).toBeLessThan(0.5);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        const core = plan.filter(b => b.kind !== 'warmup');
        core.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
        expect(core.at(-1)!.kind).toBe('rest');
        for (const b of core) {
          expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock);
          expect(b.dur).toBeLessThanOrEqual((RULES.push[0] + RULES.push[1]) * 1.1);
        }
      }
    }
  });

  it('keeps the pool\'s turn up to 30 minutes and the ten-minute rule past it', () => {
    for (const sec of [40, 180, 600, 1800]) expect(roundFor(sec)).toBe(0);
    for (const sec of [2700, 3600]) expect(roundFor(sec)).toBe(ROUND_SEC);
  });

  it('plays a whole 60-min session: gardens all hour, the world bounded, Hieronim never twice in ten minutes, it reaches its finale', () => {
    const sim = newSim({ progress: veteran({ garden: 0 }), plannedSec: 3600, seed: 5 });
    let maxFood = 0, maxRival = 0, maxBirds = 0, maxSegs = 0, evs = 0, lastLine: unknown = null;
    const heard: { text: string; at: number }[] = [];
    const byQuarter: number[] = [];
    const dt = 1 / 20;
    for (let i = 0; i < 3606 / dt && sim.phase !== 'done'; i++) {
      if (i % 3 === 0) {
        const h = sim.player.segs[0];
        let best: { x: number; y: number } | null = null, bd = Infinity;
        for (const f of sim.food) {
          const d = ((f.x - h.x) ** 2 + (f.y - h.y) ** 2) / (f.kind === 'flower' ? 3 : 1);
          if (d < bd) { bd = d; best = f; }
        }
        if (best) sim.aim(Math.atan2(best.y - h.y, best.x - h.x));
      }
      const l = sim.block.kind === 'push' ? 0.85 : 0.2;
      sim.update(dt, frame(l), sim.t + dt);
      evs += sim.take().length;
      if (i % (900 * 20) === 0) byQuarter.push(sim.gardensDone);
      const line = sim.talk;
      if (line && line !== lastLine) heard.push({ text: line.text, at: sim.t });
      lastLine = line;
      maxFood = Math.max(maxFood, sim.food.length);
      maxBirds = Math.max(maxBirds, sim.birds.length);
      maxSegs = Math.max(maxSegs, sim.player.segs.length);
      for (const r of sim.rivals) maxRival = Math.max(maxRival, r.segs.length);
    }
    expect(sim.phase).toBe('done');
    expect(sim.t).toBeLessThan(3601);
    expect(sim.t).toBeGreaterThan(3595);
    expect(evs).toBeGreaterThan(1000);
    // the gardens keep coming in every quarter of the hour: the later laps are longer gardens (a veteran's own pace at
    // any length), and their growth stops after the fourth lap (§17.1)
    byQuarter.push(sim.gardensDone);
    expect(byQuarter.length).toBe(5);
    for (let q = 1; q < 5; q++) expect(byQuarter[q] - byQuarter[q - 1], `quarter ${q}`).toBeGreaterThanOrEqual(2);
    expect(gardenAt(sim.gardenIndex).len).toBeLessThanOrEqual(Math.max(...GARDENS.map(x => x.len)) + 6 * LAP_GROWTH_MAX);
    expect(maxFood).toBeLessThan(800);
    expect(maxRival).toBeLessThan(120);
    expect(maxBirds).toBeLessThanOrEqual(8);
    expect(maxSegs).toBeLessThan(200);
    expect(sim.hatchedList.length).toBeLessThanOrEqual(sim.plan.filter(b => b.kind === 'rest').length + 2);
    expect(sim.twig.length).toBeLessThanOrEqual(RULES.twigMax);
    // Hieronim talks in every quarter of the hour, a line again only after ten minutes (§17.1, §28)
    for (const q of [0, 900, 1800, 2700]) expect(heard.filter(h => h.at > q && h.at <= q + 900).length, `from ${q}`).toBeGreaterThan(5);
    let soonest = Infinity;
    const last = new Map<string, number>();
    for (const h of heard) {
      const was = last.get(h.text);
      if (was !== undefined) soonest = Math.min(soonest, h.at - was);
      last.set(h.text, h.at);
    }
    expect(soonest).toBeGreaterThanOrEqual(ROUND_SEC - 1);
    expect(sim.said.length).toBeLessThan(1000);
    expect(Number.isFinite(sim.score)).toBe(true);
    const out = sim.result();
    expect(out.score).toBeLessThan(10_000_000);
    expect(out.highlights.length).toBeLessThanOrEqual(4);
    for (const s of out.highlights) expect(s.length).toBeLessThan(160);
    for (const s of [...out.highlights, ...out.stats.flat(), sim.headline().sub]) expect(s).not.toMatch(/undefined|NaN|Infinity/);
  });
});
