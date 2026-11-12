import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { songProblems } from '../src/arcade/kit/song';
import {
  HEMI, TEMPLATE_SIZE, canPair, dist, edgeMs, fastest, hopsTo, insideHemi, keyOf, makeBrain, type Brain,
} from '../src/arcade/synapsy/brain';
import {
  CARDS, CARD_IDS, LESSONS, LINES, LINE_COUNT, MOMENTS, REGIONS, TIPS, cardText, lessonAt, msText,
} from '../src/arcade/synapsy/content';
import { CATALOGS, t, unit } from '../src/arcade/synapsy/i18n';
import { NEURONS, bestOf, freshProgress, migrate, type SynapsyProgress } from '../src/arcade/synapsy/meta';
import { buildSong } from '../src/arcade/synapsy/music';
import { RULES, mmOf, passChance, speedOf } from '../src/arcade/synapsy/rules';
import { coachText, howto } from '../src/arcade/synapsy/index';
import { progressPanel } from '../src/arcade/synapsy/panel';
import { drawPreview } from '../src/arcade/synapsy/preview';
import mod from '../src/arcade/synapsy/index';
import { ArcadeAudio } from '../src/arcade/kit/audio';
import type { GameEnv } from '../src/arcade/kit/types';
import { SynapsyView } from '../src/arcade/synapsy/render';
import { layout, onOli, tapTargets, toBrain, toScreen } from '../src/arcade/synapsy/layout';
import { fitFont, fitLines, font, fontPx } from '../src/arcade/synapsy/paint';
import { CHECK_SIZES, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { SynapsySim, finaleFor, planBlocks, type SimEvent } from '../src/arcade/synapsy/sim';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const CALM = frame({ level: 0.08, activity: -2, calm: 0.92 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['story', 'c:pair', 'c:chain', 'c:thought', 'c:weak', 'c:lens', 'c:oli', 'c:bridge', 'c:rest', 'c:blind', 'c:speed', 'c:far', 'c:via'];

type SimOpts = { progress?: Partial<SynapsyProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): SynapsySim {
  const sim = new SynapsySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300,
    eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, seed: 12345,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no story card, no first-time marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seed: 777, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: SynapsySim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void,
  body: { balance: number | null; heartRate: number | null } | null = null): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t, body);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

function until(sim: SynapsySim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** Wire the lesson's whole path with the suggestion (as Space would), growing it until a route exists. */
function buildRoute(sim: SynapsySim, clock = { t: 0 }, f: FocusFrame = MID): number[] {
  let guard = 0;
  while (!sim.lessonRoute() && guard++ < 60) {
    sim.helpPair();
    drive(sim, 2.2, f, clock);
  }
  return sim.lessonRoute() ?? [];
}

describe('the brain', () => {
  const B: Brain = makeBrain(777);

  it('has the template’s neurons, every one inside its hemisphere, none too close to another', () => {
    expect(B.neurons).toHaveLength(TEMPLATE_SIZE);
    expect(NEURONS).toBe(TEMPLATE_SIZE);
    for (const n of B.neurons) {
      expect(insideHemi(n.x, n.y), `${n.id}`).toBe(true);
      expect(Math.sign(n.x)).toBe(n.side);
    }
    expect(B.spacing).toBeGreaterThan(0.22);
    expect(HEMI.ry).toBeGreaterThan(HEMI.rx);
  });

  it('is the same brain for the same seed and a slightly different one for another', () => {
    const a = makeBrain(5), b = makeBrain(5), c = makeBrain(6);
    expect(a.neurons.map(n => [n.x, n.y])).toEqual(b.neurons.map(n => [n.x, n.y]));
    expect(a.neurons.map(n => n.x)).not.toEqual(c.neurons.map(n => n.x));
  });

  it('wires only within a hemisphere, within reach, never an input straight to an output; the bridges are the only crossings', () => {
    for (const [a, b] of B.pairs) {
      expect(B.neurons[a].side).toBe(B.neurons[b].side);
      expect(dist(B, a, b)).toBeLessThanOrEqual(RULES.reach + 1e-9);
      expect(!!B.neurons[a].io && !!B.neurons[b].io).toBe(false);
      expect(canPair(B, a, b)).toBe(true);
    }
    expect(B.bridges).toHaveLength(2);
    for (const [l, r] of B.bridges) {
      expect(B.neurons[l].side).toBe(-1);
      expect(B.neurons[r].side).toBe(1);
      expect(B.neurons[l].region).toBe('bridge');
    }
  });

  it('puts real anatomy on it: speech on the left, the eyes at the back, the hands across the middle, memory deep', () => {
    expect(B.io.voiceL).toBeDefined();
    expect(B.io.voiceR).toBeUndefined();
    for (const k of ['eyeL', 'eyeR', 'earL', 'earR', 'handL', 'handR', 'memL', 'memR'] as const) expect(B.io[k], k).toBeDefined();
    const n = (k: keyof Brain['io']) => B.neurons[B.io[k]!];
    expect(n('eyeL').y).toBeGreaterThan(0.7);
    expect(n('eyeL').x).toBeLessThan(0);
    expect(Math.abs(n('handL').y)).toBeLessThan(0.45);
    expect(Math.abs(n('earL').x)).toBeGreaterThan(0.8);
    expect(Math.abs(n('memL').x)).toBeLessThan(0.35);
    expect(n('voiceL').y).toBeLessThan(-0.3);
  });

  it('can solve every lesson: each input reaches its output (through its waypoint), in a few links', () => {
    for (const seed of [1, 777, 99991]) {
      const b = makeBrain(seed);
      for (const L of LESSONS) {
        const from = b.io[L.from]!, to = b.io[L.to]!;
        const via = L.via ? b.io[L.via]! : -1;
        const hops = hopsTo(b, via >= 0 ? via : to);
        expect(hops[from], `${seed} ${L.id}`).toBeLessThan(9);
        expect(hops[from], `${seed} ${L.id}`).toBeGreaterThanOrEqual(2);
        if (via >= 0) expect(hopsTo(b, to)[via]).toBeLessThan(9);
      }
    }
  });

  it('finds the fastest path by conduction time: myelin beats a shorter bare way', () => {
    const edges = [{ a: 0, b: 1, ms: 30 }, { a: 1, b: 2, ms: 30 }, { a: 0, b: 3, ms: 5 }, { a: 3, b: 4, ms: 5 }, { a: 4, b: 2, ms: 5 }];
    expect(fastest(5, edges, 0, 2)).toEqual([0, 3, 4, 2]);
    expect(fastest(5, edges.slice(0, 2), 0, 4)).toBeNull();
  });

  it('turns lengths and myelin into real speeds and times (1 to 100 m/s; mm / (m/s) = ms)', () => {
    expect(speedOf(0)).toBe(RULES.vBare);
    expect(speedOf(1)).toBe(RULES.vMax);
    expect(speedOf(0.5)).toBeGreaterThan(speedOf(0.3));
    expect(mmOf(2)).toBe(RULES.brainMm);
    expect(edgeMs(0.3, 0)).toBeCloseTo(mmOf(0.3), 6);
    expect(edgeMs(0.3, 1)).toBeCloseTo(mmOf(0.3) / 100, 6);
    expect(passChance(1)).toBeCloseTo(0.5, 6);
    expect(passChance(4)).toBeGreaterThan(0.9);
    expect(passChance(0)).toBe(0);
  });
});

describe('the lessons', () => {
  it('climbs a ladder of eight, asking more each round and speed on the bridge’s lessons from the second', () => {
    expect(lessonAt(0).id).toBe('see');
    expect(lessonAt(0).limitMs).toBeNull();
    expect(lessonAt(5).limitMs).toBe(RULES.speedMs[0]);
    const r2 = lessonAt(LESSONS.length + 2);
    expect(r2.id).toBe('cross');
    expect(r2.round).toBe(1);
    expect(r2.goal).toBe(LESSONS[2].need + RULES.needRound);
    expect(r2.limitMs).toBe(RULES.speedMs[1]);
    expect(lessonAt(100).limitMs === null || lessonAt(100).limitMs! >= RULES.speedMs[2]).toBe(true);
  });
});

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates push and rest, ending on a rest', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) {
        expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        expect(b.dur).toBeLessThanOrEqual(31);
      }
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later({ planned: 300 });
    const b = sim.block;
    expect(b.kind).toBe('push');
    drive(sim, b.dur - 2, MID);
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, MID, clock);
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });

  it('judges each block once at its end', () => {
    const sim = later({ planned: 300 });
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].verdict).toBe(true);
  });
});

describe('wiring: fire together, wire together', () => {
  it('wires two neighbours tapped one after the other: a link sprouts and brings its first synapse', () => {
    const sim = later();
    const [a, b] = sim.suggest()!;
    sim.touchNeuron(a);
    drive(sim, 0.2, MID);
    sim.touchNeuron(b);
    const L = sim.link(a, b)!;
    expect(L).toBeDefined();
    expect(L.sprout).toBeGreaterThan(0);
    expect(L.syn).toBe(0);
    const before = sim.score;
    const evs = drive(sim, 2.5, MID);
    expect(ofType(evs, 'linked')).toHaveLength(1);
    expect(L.syn).toBe(1);
    expect(sim.score).toBe(before + 1);
  });

  it('thickens a wired pair fired again (toward the next synapse) and never past the maximum', () => {
    const sim = later();
    const [a, b] = sim.suggest()!;
    sim.pair(a, b);
    drive(sim, 2.5, MID);
    const L = sim.link(a, b)!;
    for (let i = 0; i < 40; i++) {
      sim.pair(a, b);
      drive(sim, 0.3, MID);
    }
    expect(L.syn).toBe(RULES.synMax);
    expect(sim.score).toBe(RULES.synMax);
  });

  it('chains a drag: A, B, C wire A–B and B–C', () => {
    const sim = later();
    const B = sim.brain;
    const a = B.io.eyeL!;
    const b = B.near[a].find(n => !B.neurons[n].io)!;
    const c = B.near[b].find(n => n !== a && !B.neurons[n].io && B.near[n].length > 1)!;
    sim.touchNeuron(a);
    sim.touchNeuron(b);
    sim.touchNeuron(c);
    expect(sim.link(a, b)).toBeDefined();
    expect(sim.link(b, c)).toBeDefined();
    expect(sim.link(a, c)).toBeUndefined();
  });

  it('says “too far” for a pair out of reach and wires nothing', () => {
    const sim = later();
    const B = sim.brain;
    const a = B.io.eyeL!;
    // just out of reach on the same side: "too far"; across the brain: a new chain starts, quietly
    const far = B.neurons.find(n => n.side === -1 && dist(B, a, n.id) > RULES.reach && dist(B, a, n.id) < RULES.reach * 1.8)!.id;
    const evs: SimEvent[] = [];
    expect(sim.pair(a, far)).toBe(false);
    evs.push(...sim.take());
    expect(ofType(evs, 'far')).toHaveLength(1);
    expect(sim.link(a, far)).toBeUndefined();
    expect(sim.pair(a, B.io.handR!)).toBe(false);
    expect(ofType(sim.take(), 'far')).toHaveLength(0);
  });

  it('keeps a neuron to five links (the budget pruning frees)', () => {
    const sim = later();
    const B = sim.brain;
    const hub = B.neurons.find(n => B.near[n.id].length > RULES.perNeuron)!;
    let made = 0;
    for (const m of B.near[hub.id]) if (sim.pair(hub.id, m)) made++;
    expect(made).toBe(RULES.perNeuron);
    expect(sim.degree(hub.id)).toBe(RULES.perNeuron);
  });

  it('grows more for a pair fired on the beat (in rhythm)', () => {
    const on = later(), off = later();
    for (const sim of [on, off]) {
      const [a, b] = sim.suggest()!;
      sim.pair(a, b);
      drive(sim, 2.5, MID);
    }
    // the beat is every 60/112 s: put one sim on it and the other between two beats
    const beat = 60 / RULES.bpm;
    const clockOn = { t: on.t }, clockOff = { t: off.t };
    drive(on, Math.ceil(on.t / beat) * beat - on.t, MID, clockOn);
    drive(off, Math.ceil(off.t / beat) * beat - off.t + beat / 2, MID, clockOff);
    expect(on.onBeat()).toBe(true);
    expect(off.onBeat()).toBe(false);
    const la = [...on.links.values()].find(l => l.lane < 0)!, lb = [...off.links.values()].find(l => l.lane < 0)!;
    const ga = la.grow, gb = lb.grow;
    on.pair(la.a, la.b);
    off.pair(lb.a, lb.b);
    expect(la.grow - ga).toBeGreaterThan((lb.grow - gb) * 1.3);
  });

  it('a tap on the free field wires the pair it lands between, thickens the link under it, and far from all only hints', () => {
    const sim = later();
    const N = sim.brain.neurons;
    const [a, b] = sim.suggest()!;
    sim.fieldTap((N[a].x + N[b].x) / 2, (N[a].y + N[b].y) / 2);
    expect(sim.link(a, b)).toBeDefined();
    drive(sim, 2.5, MID);
    const L = sim.link(a, b)!;
    const g = L.grow;
    sim.fieldTap((N[L.a].x + N[L.b].x) / 2, (N[L.a].y + N[L.b].y) / 2);
    expect(L.grow).toBeGreaterThan(g);
    // between two other neighbours: they wire too (a tap between two neurons connects them)
    const [c, d] = sim.brain.pairs.find(([p, q]) => !sim.link(p, q) && sim.canWire(p, q) && p !== a && q !== b)!;
    sim.fieldTap((N[c].x * 0.55 + N[d].x * 0.45), (N[c].y * 0.55 + N[d].y * 0.45));
    expect([...sim.links.values()].filter(l => l.lane < 0).length).toBe(2);
    const n = sim.links.size;
    sim.fieldTap(5, 5);
    expect(sim.links.size).toBe(n);
    expect(sim.hinted).toBe(sim.t);
  });
});

describe('thoughts and paths', () => {
  it('sends the lesson’s thought from its input on the beat; without a path it goes as far as the network does and is lost', () => {
    const sim = later();
    const [a, b] = sim.suggest()!;
    sim.pair(a, b);
    const evs = drive(sim, 4, MID);
    expect(ofType(evs, 'thought').length).toBeGreaterThan(2);
    expect(ofType(evs, 'lost').length).toBeGreaterThan(0);
    expect(ofType(evs, 'arrive').filter(e => e.counted)).toHaveLength(0);
  });

  it('builds a whole path with the suggestions; thoughts arrive, strengthen it, and the lesson is learned', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    const route = buildRoute(sim, clock);
    expect(route[0]).toBe(sim.io('eyeL'));
    expect(route.at(-1)).toBe(sim.io('handL'));
    const evs = drive(sim, 40, MID, clock, t => { if (Math.round(t * 60) % 40 === 0) sim.helpPair(); });
    const arrived = ofType(evs, 'arrive').filter(e => e.counted);
    expect(arrived.length).toBeGreaterThanOrEqual(lessonAt(0).goal);
    expect(ofType(evs, 'learned')[0].lesson.id).toBe('see');
    expect(sim.p.learned).toContain('see');
    expect(sim.p.lesson).toBeGreaterThanOrEqual(1);
    expect(sim.p.regions).toEqual(expect.arrayContaining(['vision', 'move']));
    // and the next lesson begins after the celebration
    expect(ofType(evs, 'lesson').some(e => e.lesson.id === 'hear')).toBe(true);
  });

  it('loses a thought at a weak synapse now and then, a strong path almost never', () => {
    // the path held at one synapse a link, then at the most: count what arrives and what is lost on the way
    const run = (syn: number) => {
      let lost = 0, arrived = 0;
      for (const seed of [1, 2, 3, 4]) {
        const sim = later({ planned: 600, seed });
        const clock = { t: 0 };
        const route = buildRoute(sim, clock);
        const links = route.slice(1).map((n, i) => sim.link(route[i], n)!);
        sim.take();
        for (let k = 0; k < 6 * 60; k++) {
          for (const L of links) { L.syn = syn; L.grow = 0; }
          for (const e of drive(sim, 1 / 60, NONE, clock)) {
            if (e.type === 'lost' && e.why === 'weak') lost++;
            if (e.type === 'arrive') arrived++;
          }
        }
      }
      return { lost, arrived, share: lost / Math.max(1, lost + arrived) };
    };
    const weak = run(1), strong = run(RULES.synMax);
    expect(weak.lost).toBeGreaterThan(0);
    expect(strong.share).toBeLessThan(weak.share / 3);
    expect(strong.arrived).toBeGreaterThan(weak.arrived);
  });

  it('crosses the bridge for the lessons that need it, and a habit thought follows a learned path', () => {
    const sim = later({ planned: 600, progress: { lesson: 2, learned: ['see', 'hear'] } });
    expect(sim.lesson.id).toBe('cross');
    const clock = { t: 0 };
    const route = buildRoute(sim, clock);
    expect(route.length).toBeGreaterThan(3);
    const sides = new Set(route.map(n => sim.brain.neurons[n].side));
    expect(sides.size).toBe(2);
    const evs = drive(sim, 10, MID, clock);
    expect(ofType(evs, 'cross').length).toBeGreaterThan(0);
    expect(sim.p.cards).toContain('callosum');
  });

  it('counts a fast lesson’s thought only under its conduction limit — myelin makes it', () => {
    const sim = later({ planned: 600, progress: { lesson: 5, learned: ['see', 'hear', 'cross', 'name', 'recall'] } });
    expect(sim.lesson.id).toBe('catch');
    const clock = { t: 0 };
    const route = buildRoute(sim, clock);
    for (let i = 0; i + 1 < route.length; i++) sim.link(route[i], route[i + 1])!.syn = RULES.synMax;
    const slow = drive(sim, 6, MID, clock);
    expect(ofType(slow, 'slow').length).toBeGreaterThan(0);
    expect(sim.done).toBe(0);
    expect(sim.pathMs(route)).toBeGreaterThan(sim.lesson.limitMs!);
    for (let i = 0; i + 1 < route.length; i++) sim.link(route[i], route[i + 1])!.myelin = 1;
    (sim as unknown as { edgesCache: null }).edgesCache = null;
    const limit = sim.lesson.limitMs!;
    expect(sim.pathMs(sim.lessonRoute()!)).toBeLessThan(limit);
    const fast = drive(sim, 8, MID, clock);
    expect(ofType(fast, 'arrive').filter(e => e.counted).length).toBeGreaterThan(0);
    expect(sim.fastestMs).toBeLessThan(limit);
  });
});

describe('myelin and Oli', () => {
  it('sends Oli to the barest axon of the lesson’s path; the sheath grows, faster with focus, and the speed climbs', () => {
    const base = later({ planned: 600 }), focus = later({ planned: 600 });
    const c1 = { t: 0 }, c2 = { t: 0 };
    buildRoute(base, c1);
    buildRoute(focus, c2);
    until(focus, 'push', HIGH, c2);
    drive(focus, RULES.leadFnirs + 0.2, HIGH, c2);
    for (const [sim, f, c] of [[base, NONE, c1], [focus, HIGH, c2]] as const) {
      expect(sim.sendOli()).toBe(true);
      drive(sim, 1, f, c);
    }
    const kb = base.oli.target!, kf = focus.oli.target!;
    const mb = base.links.get(kb)!.myelin, mf = focus.links.get(kf)!.myelin;
    drive(base, 4, NONE, c1);
    drive(focus, 4, HIGH, c2);
    const db = base.links.get(kb)!.myelin - mb, df = focus.links.get(kf)!.myelin - mf;
    expect(db).toBeGreaterThan(0);
    expect(df).toBeGreaterThan(db * 1.8);
  });

  it('wraps a chosen axon to the full and says how fast it is now', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    buildRoute(sim, clock);
    const L = [...sim.links.values()].find(l => l.lane < 0 && l.sprout >= 1)!;
    expect(sim.sendOli(L.key)).toBe(true);
    expect(sim.oli.chosen).toBe(true);
    const evs = drive(sim, 40, MID, clock);
    const w = ofType(evs, 'wrapped').find(e => e.key === L.key)!;
    expect(w).toBeDefined();
    expect(w.mps).toBe(RULES.vMax);
    expect(L.myelin).toBe(1);
    expect(sim.p.cards).toEqual(expect.arrayContaining(['myelin', 'oligo']));
  });

  it('has nothing to wrap before the first link', () => {
    const sim = later();
    expect(sim.sendOli()).toBe(false);
  });
});

describe('the band: growth, the bloom, the bridge', () => {
  it('grows faster in a sighted push with focus than without a signal (×1…×3 with the level), never less than the base', () => {
    const grown = (f: FocusFrame) => {
      const sim = later({ planned: 600 });
      const clock = { t: 0 };
      const [a, b] = sim.suggest()!;
      sim.pair(a, b);
      drive(sim, 2.5, f, clock);
      until(sim, 'push', f, clock);
      drive(sim, RULES.leadFnirs + 0.5, f, clock);
      const L = sim.link(a, b)!;
      const before = L.syn + L.grow;
      for (let i = 0; i < 2; i++) { sim.pair(a, b); drive(sim, 0.4, f, clock); }
      return L.syn + L.grow - before;
    };
    const hi = grown(HIGH), none = grown(NONE);
    expect(none).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(none * 2);
  });

  it('freezes at neutral without a signal: no gauge, no bloom, never a loss', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    buildRoute(sim, clock, NONE);
    const score = sim.score;
    drive(sim, 40, NONE, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.charge).toBe(0);
    expect(sim.score).toBeGreaterThanOrEqual(score);
  });

  it('fills the BDNF bloom from a held focus: every link of the path grows a synapse at once', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    buildRoute(sim, clock);
    until(sim, 'push', HIGH, clock);
    const evs = drive(sim, 20, HIGH, clock);
    const bloom = ofType(evs, 'bloom');
    expect(bloom.length).toBeGreaterThan(0);
    expect(bloom[0].links).toBeGreaterThan(0);
    expect(sim.p.cards).toContain('bdnf');
  });

  it('shows the gauge: growth in a sighted push past its lead-in, calm in rest, nothing in a blind push', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    drive(sim, 1, HIGH, clock);
    expect(sim.meter()).toBeNull();
    drive(sim, RULES.leadFnirs, HIGH, clock);
    expect(sim.meter()).toBeGreaterThan(0.8);
    until(sim, 'rest', CALM, clock);
    drive(sim, 1, CALM, clock);
    expect(sim.meter()).toBeGreaterThan(0.8);
    // to the blind push: the 4th push of all time (two before this session) is this session's second
    until(sim, 'push', MID, clock);
    expect(sim.blind).toBe(true);
    drive(sim, 8, HIGH, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.songLevel()).toBeNull();
    const evs = drive(sim, sim.block.dur, HIGH, clock);
    expect(ofType(evs, 'blind')).toHaveLength(1);
    expect(sim.blindShare).toBeGreaterThan(50);
  });

  it('lights the bridge when the halves are even, keeps it resting when they are not, and follows focus alone without a reading', () => {
    const even = later(), uneven = later(), none = later();
    const evE = drive(even, 3, MID, { t: 0 }, undefined, { balance: 0.5, heartRate: null });
    drive(uneven, 3, MID, { t: 0 }, undefined, { balance: 0.62, heartRate: null });
    expect(ofType(evE, 'step')[0]?.on).toBe(true);
    expect(even.inStep).toBe(true);
    expect(even.stepBest).toBeGreaterThan(1);
    expect(uneven.inStep).toBe(false);
    // no reading: the bridge follows focus in a sighted push, and the record never counts it
    const c = { t: 0 };
    until(none, 'push', HIGH, c);
    drive(none, RULES.leadFnirs + 2, HIGH, c, undefined, { balance: null, heartRate: null });
    expect(none.balance).toBeNull();
    expect(none.inStep).toBe(true);
    expect(none.stepBest).toBe(0);
  });

  it('passes every thought over the bridge in step and grows a crossing path more', () => {
    const sim = later({ planned: 600, progress: { lesson: 2 } });
    const clock = { t: 0 };
    const route = buildRoute(sim, clock);
    for (let i = 0; i + 1 < route.length; i++) { const L = sim.link(route[i], route[i + 1])!; if (L.lane < 0) L.syn = RULES.synMax; }
    sim.take();
    const evs = drive(sim, 12, MID, clock, undefined, { balance: 0.5, heartRate: null });
    expect(ofType(evs, 'cross').length).toBeGreaterThan(3);
    // a thought on the bridge in step is never lost there
    const ends = new Set(sim.brain.bridges.flat());
    expect(ofType(evs, 'lost').filter(e => e.why === 'weak' && ends.has(e.at) && sim.inStep)).toHaveLength(0);
    expect(sim.p.cards).toContain('sync');
  });
});

describe('rest: consolidation, pruning, the wash', () => {
  it('replays the session’s paths, consolidating their links (kept for the next session), more often with calm', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ planned: 600 });
      const clock = { t: 0 };
      buildRoute(sim, clock);
      drive(sim, 8, MID, clock);
      until(sim, 'rest', MID, clock);
      const evs = drive(sim, 18, f, clock);
      return { sim, replays: ofType(evs, 'replay').length, kept: ofType(evs, 'consolidated').length };
    };
    const calm = run(CALM), none = run(NONE);
    expect(calm.replays).toBeGreaterThan(none.replays);
    expect(calm.kept).toBeGreaterThan(0);
    expect(calm.sim.p.cards).toEqual(expect.arrayContaining(['replay', 'sleep', 'glymph']));
  });

  it('prunes a weak idle link kindly in rest (never the lesson’s path) and its material returns to the bloom', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    // a lone link far from the lesson
    const B = sim.brain;
    const a = B.io.earR!, b = B.near[a].find(n => !B.neurons[n].io)!;
    sim.pair(a, b);
    drive(sim, 2.5, MID, clock);
    expect(sim.link(a, b)!.syn).toBe(1);
    until(sim, 'rest', NONE, clock);
    drive(sim, Math.max(0, RULES.pruneIdle - sim.link(a, b)!.idle) + 0.5, NONE, clock);
    if (sim.block.kind !== 'rest') until(sim, 'rest', NONE, clock);
    const evs = drive(sim, 12, NONE, clock);
    expect(ofType(evs, 'prune').some(e => e.key === keyOf(a, b))).toBe(true);
    expect(ofType(evs, 'pruned').some(e => e.key === keyOf(a, b))).toBe(true);
    expect(sim.link(a, b)).toBeUndefined();
    expect(sim.charge).toBeGreaterThan(0);
    expect(sim.prunedNow).toBe(1);
  });

  it('gathers waste while the network works and washes it out in rest (calm washes faster)', () => {
    const sim = later({ planned: 600 });
    const clock = { t: 0 };
    buildRoute(sim, clock);
    drive(sim, 15, MID, clock);
    expect(sim.waste).toBeGreaterThan(0.05);
    until(sim, 'rest', CALM, clock);
    const w = sim.waste;
    drive(sim, 12, CALM, clock);
    expect(sim.waste).toBeLessThan(w);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER, planned: 40 });
    let next = 0.65, space = 2;
    const clock = { t: 0 };
    drive(sim, 22, HIGH, clock, t => {
      if (t >= next) { next += 0.65; sim.fieldTap(0, -0.13); }
      if (t >= space) { space += 2; sim.key(' ', true); sim.key(' ', false); }
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.score).toBeGreaterThan(3);
  });

  it('opens the first session with the story card and teaches with coach marks one at a time', () => {
    const sim = makeSim();
    expect(sim.story).not.toBeNull();
    expect(sim.block.kind).toBe('warmup');
    const clock = { t: 0 };
    const evs = drive(sim, 30, MID, clock, t => { if (sim.story && t > 1) sim.closeStory(); if (Math.round(t * 60) % 90 === 0) sim.helpPair(); });
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach[0]).toBe('pair');
    expect(coach).toContain('chain');
    expect(sim.p.cards).toEqual(expect.arrayContaining(['neuron', 'synapse']));
  });

  it('closes the story card by itself after a while', () => {
    const sim = makeSim();
    drive(sim, RULES.storyMax + 0.5, MID);
    expect(sim.story).toBeNull();
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later();
    const clock = { t: 0 };
    buildRoute(sim, clock);
    drive(sim, 10, HIGH, clock);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best['300']).toBe(a.score);
    const total = sim.p.total;
    sim.result();
    expect(sim.p.total).toBe(total);
    expect(a.unit).toBe(unit(a.score));
    expect(a.stats.length).toBeGreaterThan(4);
  });

  it('settles once at the end (or early): consolidated links are saved, the rest is forgotten', () => {
    const sim = later({ planned: 120 });
    const clock = { t: 0 };
    buildRoute(sim, clock);
    drive(sim, 140, () => (sim.restBlock ? CALM : MID), clock);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    const cons = [...sim.links.values()].filter(l => l.lane < 0 && l.cons >= 1 && l.prune === 0).length;
    expect(sim.p.links.length).toBe(cons);
    expect(sim.p.total).toBe(sim.score);
    // and the next session starts with them
    const next = new SynapsySim({ progress: sim.p, rng: mulberry32(9), plannedSec: 300, eeg: false, tuning: TUNING, seed: 1 });
    next.start();
    expect([...next.links.values()].filter(l => l.lane < 0).length).toBe(sim.p.links.length);
    const early = later({ planned: 300 });
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('closes with a passage that exists, fitting what happened', () => {
    const sim = later();
    drive(sim, 5, MID);
    const r = sim.result();
    expect(r.verse).toBeDefined();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    const fit = ['rom12.2', 'eph4.16', 'col2.2', '1co2.16', 'psa86.11', 'psa16.7'];
    for (let s = 1; s < 12; s++) {
      const x = later({ progress: { sessions: s } });
      expect(fit).toContain(x.closingVerse());
    }
  });

  it('keeps the brain the same across sessions (the seed is chosen once)', () => {
    const p = freshProgress();
    const a = new SynapsySim({ progress: p, rng: mulberry32(1), plannedSec: 60, eeg: false, tuning: TUNING, seed: 4242 });
    expect(p.seed).toBe(4242);
    const b = new SynapsySim({ progress: p, rng: mulberry32(2), plannedSec: 60, eeg: false, tuning: TUNING, seed: 9999 });
    expect(b.brain.neurons.map(n => n.x)).toEqual(a.brain.neurons.map(n => n.x));
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and starts fresh, keeping the count', () => {
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as SynapsyProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.lesson).toBe(0);
    expect(p.links).toEqual([]);
    expect(p.song).toBe(true);
    expect(migrate(p)).toBe(p);
    const sim = new SynapsySim({ progress: p, rng: mulberry32(1), plannedSec: 120, eeg: true, tuning: TUNING, seed: 3 });
    sim.start();
    drive(sim, 5, MID);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, seed: 777, lesson: 6, learned: ['see', 'hear', 'nope', 3],
      links: [[0, 1, 3, 40], [1, 0, 2, 10], [5, 5, 1, 0], [2, 99, 1, 0], 'junk', [3, 4, 99, 300]],
      bridge: [70, 'x'], cards: ['neuron', 'ghost', 'myelin'], regions: ['vision', 'zzz'], best: { '300': 44, '60': 'x' },
      fastest: 3.2, inStep: 'long', total: 400, thoughts: 80, blooms: 3, song: 'yes', lastLen: 300, seen: ['story', 7],
    };
    const p = mergeSaved(freshProgress(), saved) as SynapsyProgress;
    migrate(p);
    expect(p.lesson).toBe(6);
    expect(p.learned).toEqual(['see', 'hear']);
    expect(p.links).toEqual([[0, 1, 3, 40], [3, 4, RULES.synMax, 100]]);
    expect(p.bridge).toEqual([70, 55]);
    expect(p.cards).toEqual(['neuron', 'myelin']);
    expect(p.regions).toEqual(['plan', 'vision']);
    expect(p.best).toEqual({ '300': 44 });
    expect(p.inStep).toBe(0);
    expect(p.song).toBe(true);
    expect(p.seen).toEqual(['story']);
    expect(bestOf(p)).toBe(44);
    const sim = new SynapsySim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: true, tuning: TUNING, seed: 1 });
    sim.start();
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, links: 'x', cards: 5, regions: null, best: [] }]) {
      const p = mergeSaved(freshProgress(), junk) as SynapsyProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.links)).toBe(true);
      expect(p.regions).toContain('plan');
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Oli at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
    expect(LINE_COUNT).toBeGreaterThan(85);
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (k.startsWith('say.')) expect((v as string).length, `${l}.${k}`).toBeLessThanOrEqual(90);
      }
    }
  });

  it('keeps Polish letters and words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v);
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) {
            if (l === 'de') expect(s, `${l}.${k}`).toMatch(/„[^„”"“]+“/);
            if (l === 'sv') expect(s, `${l}.${k}`).toMatch(/”[^„”"“]+”/);
            if (l === 'en') expect(s, `${l}.${k}`).toMatch(/“[^„”"“]+”/);
          }
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) {
      const texts = typeof v === 'string' ? [v] : Object.values(v);
      for (const s of texts) if (/[„“”"]/.test(s)) expect(s, k).toMatch(/„[^„”"“]+”/);
    }
  });

  it('suggests strategies, never to concentrate harder; the last tip says it does not treat', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip\.|howto\.)/.test(k)) continue;
        expect(v as string, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
    expect(t('howto.tip2')).toMatch(/nie leczy/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/does not replace treatment/);
    expect(TIPS.push.length).toBeGreaterThanOrEqual(5);
    expect(TIPS.rest.length).toBeGreaterThanOrEqual(3);
  });

  it('bends the headline’s unit', () => {
    expect(unit(1)).toBe('połączenie');
    expect(unit(3)).toBe('połączenia');
    expect(unit(5)).toBe('połączeń');
    expect(unit(22)).toBe('połączenia');
    expect(msText(3.24)).toBe('3,2 ms');
    expect(msText(42.4)).toBe('42 ms');
  });

  it('gives every card a sentence with its source, and every region and lesson a name', () => {
    expect(CARDS.length).toBeGreaterThanOrEqual(18);
    for (const id of CARD_IDS) {
      expect(cardText(id).length).toBeGreaterThan(20);
      expect(CARDS.find(c => c.id === id)!.src).toMatch(/\d{4}/);
    }
    for (const r of REGIONS) expect(t(`region.${r}` as 'region.plan').length).toBeGreaterThan(2);
    for (const L of LESSONS) {
      expect(t(`lesson.${L.id}.title` as 'lesson.see.title').length).toBeGreaterThan(3);
      expect(t(`lesson.${L.id}.line` as 'lesson.see.line').length).toBeLessThan(140);
    }
  });

  it('never says the band measures the bridge: the halves are the prefrontal cortex’s two sides', () => {
    for (const l of LANGS) {
      const s = CATALOGS[l]['panel.halves'] as string;
      expect(s).toMatch(/Mendi/);
      expect(s).toMatch(/HALO/);
    }
  });
});

describe('the song', () => {
  it('is a whole song in every language: own verses around the series refrain, nothing out of the loop', () => {
    for (const l of LANGS) {
      const s = buildSong(l);
      expect(songProblems(s), l).toEqual([]);
      expect(s.bpm).toBe(RULES.bpm);
      expect(s.lines.length).toBe(16);
      for (const line of s.lines) expect(line.text.trim().length).toBeGreaterThan(5);
      expect(new Set(s.parts.map(p => p.layer))).toEqual(new Set([0, 1, 2, 3]));
    }
    expect(buildSong('pl').lines[0].text).toBe('Iskra tu i iskra tam,');
    expect(buildSong('en').lines[0].text).not.toBe(buildSong('pl').lines[0].text);
  });
});

describe('mobile first (DESIGN §12)', () => {
  const B = makeBrain(777);

  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      for (const story of [false, true]) {
        const ts = tapTargets(L, { story });
        expect(ts.length).toBe(1);
        expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}${story ? ': the story' : ''}`).toEqual([]);
      }
    }
  });

  it('puts Oli’s button in the thumb zone of a phone upright, off the side edges, over the home indicator', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      expect(L.mode, c.name).toBe('tall');
      expect(L.u).toBeLessThan(1.1);
      const zone = c.h * (1 - THUMB);
      expect(L.oli.y, c.name).toBeGreaterThanOrEqual(zone);
      expect(L.oli.w).toBeGreaterThanOrEqual(48);
      expect(L.oli.x + L.oli.w).toBeLessThanOrEqual(c.w - c.insets.right - 16 + 0.01);
      expect(L.oli.y + L.oli.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
      // the lens in the other bottom corner, the song line between them
      expect(L.lens.x - L.lens.r).toBeGreaterThanOrEqual(c.insets.left + 16 - 0.01);
      expect(L.lens.y + L.lens.r).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.song.x).toBeGreaterThanOrEqual(L.lens.x + L.lens.r);
      expect(L.song.x + L.song.w).toBeLessThanOrEqual(L.oli.x);
      expect(L.song.w).toBeGreaterThan(120);
    }
  });

  it('keeps the whole brain inside the band under the HUD, as large as the band allows, with neurons a finger apart', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      expect(L.brain.y, c.name).toBeGreaterThanOrEqual(c.insets.top - 0.5);
      expect(L.brain.y + L.brain.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      expect(L.brain.x).toBeGreaterThanOrEqual(c.insets.left - 0.5);
      expect(L.brain.x + L.brain.w).toBeLessThanOrEqual(c.w - c.insets.right + 0.5);
      // the neurons stay apart enough for a finger to pick one (the nearest wins)
      expect(B.spacing * L.s, c.name).toBeGreaterThanOrEqual(32);
      expect(L.pick).toBeGreaterThanOrEqual(22);
      for (const n of B.neurons) {
        const p = toScreen(L, n.x, n.y);
        expect(p.y, `${c.name}: ${n.id}`).toBeGreaterThan(c.insets.top);
        expect(p.y).toBeLessThan(c.h - c.insets.bottom);
      }
    }
  });

  it('sets the halves’ plate on the bridge, clear of every neuron, and the nodes clear of Oli’s button', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      for (const n of B.neurons) {
        const p = toScreen(L, n.x, n.y), r = L.soma * 1.9;
        const inX = p.x + r > L.plate.x && p.x - r < L.plate.x + L.plate.w;
        const inY = p.y + r > L.plate.y && p.y - r < L.plate.y + L.plate.h;
        expect(inX && inY, `${c.name}: neuron ${n.id} under the plate`).toBe(false);
        expect(onOli(L, p.x, p.y), `${c.name}: neuron ${n.id} under Oli`).toBe(false);
      }
    }
  });

  it('maps the screen to the brain and back, and picks the neuron under a finger', () => {
    const c = CHECK_SIZES[0];
    const L = layout(c.w, c.h, c.insets, B.spacing);
    const sim = later();
    for (const n of sim.brain.neurons) {
      const p = toScreen(L, n.x, n.y);
      const b = toBrain(L, p.x + 6, p.y - 6);
      expect(sim.neuronAt(b.x, b.y, L.pick / L.s)).toBe(n.id);
    }
  });

  it('lays a phone on its side out with the brain in the middle and columns either side', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      expect(L.mode).toBe('side');
      expect(L.lens.x + L.lens.r).toBeLessThanOrEqual(L.brain.x + 4);
      expect(L.oli.x).toBeGreaterThan(L.cx);
      expect(L.oli.y + L.oli.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
    }
  });

  it('grows on a tablet and a desktop, never past 1.3', () => {
    for (const c of CHECK_SIZES.filter(x => Math.min(x.w, x.h) > 600)) {
      const L = layout(c.w, c.h, c.insets, B.spacing);
      expect(L.u).toBeGreaterThan(1);
      expect(L.u).toBeLessThanOrEqual(1.3);
    }
  });

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it', () => {
    for (const px of [0, 3, 6.4, 8, 10.4, 10.99, 11, 12.3, 13, 30]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(4)).toContain(`${MIN_TEXT}px`);
    const ctx = measuring();
    expect(fitFont(ctx, 'Nowa karta Wiedzy: Oligodendrocyty', 20, 14, 6)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(fitFont(ctx, 'Oli', 200, 13, 11)).toBe(13);
    const f = fitLines(ctx, 'Myśl przeszła przez most! Dwieście milionów włókien, a wybrała to.', 120, 3, 14, 13);
    expect(f.size).toBeGreaterThanOrEqual(13);
    expect(f.lines.length).toBeLessThanOrEqual(3);
    expect(MIN_READ).toBe(13);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const KEYS = /spacj|space|leertaste|mellanslag|klawisz|taste|tangent|\bkey|klik|click|mysz[ąy]|mouse|maus/i;
    for (const l of LANGS) {
      const c = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['howto.goal', 'howto.tap', 'howto.drag', 'howto.oli', 'coach.pair', 'coach.oli', 'coach.speed', 'coach.chain', 'story.tap']) {
        expect(c[k], `${l}.${k}`).not.toMatch(KEYS);
      }
      for (const k of ['coach.pair.keys', 'coach.oli.keys', 'coach.speed.keys', 'howto.keys', 'story.tapKeys']) expect(c[k], `${l}.${k}`).toMatch(KEYS);
    }
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.some(x => x.gesture === 'keys')).toBe(false);
    expect(touch.hands).toHaveLength(3);
    expect(desk.hands.some(x => x.gesture === 'keys')).toBe(true);
    expect(touch.tips!.at(-1)).toBe(t('howto.tip2'));
    for (const what of ['pair', 'oli', 'speed', 'chain', 'lens'] as const) expect(coachText(what, true)).not.toMatch(KEYS);
    expect(coachText('pair', false)).toMatch(KEYS);
  });
});

/** A canvas context that measures text roughly (0.55 em a character), for the font helpers. */
function measuring(): CanvasRenderingContext2D {
  let px = 10;
  return {
    set font(f: string) { const m = f.match(/(\d+(?:\.\d+)?)px/); px = m ? Number(m[1]) : 10; },
    get font() { return `${px}px x`; },
    measureText: (s: string) => ({ width: s.length * px * 0.55 }),
  } as unknown as CanvasRenderingContext2D;
}

/**
 * A 2D context that does nothing but record the text it is asked to draw (with the font's size), enough for
 * the view to run every path of its drawing in a test.
 */
function recorder(): { ctx: CanvasRenderingContext2D; texts: { text: string; px: number }[] } {
  const texts: { text: string; px: number }[] = [];
  let font = '10px sans-serif';
  const grad = { addColorStop: () => undefined };
  const target: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * (Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10)) * 0.55 }),
    createRadialGradient: () => grad,
    createLinearGradient: () => grad,
    fillText: (s: string) => { if (String(s).trim()) texts.push({ text: String(s), px: Number(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 10) }); },
    strokeText: () => undefined,
  };
  const ctx = new Proxy(target, {
    get: (o, k) => (k in o ? o[k as string] : k === 'font' ? font : typeof k === 'string' && /^[a-z]/.test(k) && !['globalAlpha', 'lineWidth', 'fillStyle', 'strokeStyle', 'textAlign', 'textBaseline', 'lineCap', 'lineJoin', 'globalCompositeOperation', 'lineDashOffset'].includes(k) ? () => undefined : undefined),
    set: (o, k, v) => { if (k === 'font') font = String(v); else o[k as string] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
}

describe('the picture', () => {
  it('draws every state at every checked size without a fault, and never a string under 11 px', () => {
    const P2D = (globalThis as { Path2D?: unknown }).Path2D;
    if (!P2D) (globalThis as { Path2D?: unknown }).Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} };
    const { ctx, texts } = recorder();
    const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
    for (const c of CHECK_SIZES) {
      const sim = makeSim({ planned: 300, tuning: BEGINNER });
      const view = new SynapsyView(canvas, sim.brain, { reducedMotion: false, touch: c.w < 700 });
      view.resize(c.w, c.h, 1, c.insets);
      view.teach = true;
      const clock = { t: 0 };
      const frameOf = () => (sim.restBlock ? CALM : sim.pushBlock ? HIGH : MID);
      // the story card, then play through push, rest and the next push, drawing as it goes
      view.draw(sim);
      for (let i = 0; i < 70 * 6; i++) {
        drive(sim, 1 / 6, frameOf(), clock, undefined, { balance: i % 120 < 60 ? 0.5 : null, heartRate: null });
        if (i === 2) sim.closeStory();
        if (i % 3 === 0) sim.helpPair();
        if (i === 40) sim.sendOli();
        for (const e of sim.take()) view.on(e, sim);
        view.update(1 / 6, sim);
        if (i % 4 === 0) {
          view.chain = i % 8 === 0 ? { x: c.w / 2, y: c.h / 2 } : null;
          view.oliDrag = i % 12 === 0 ? { x: c.w * 0.7, y: c.h * 0.6, key: [...sim.links.keys()][0] ?? null } : null;
          view.draw(sim);
        }
      }
    }
    const small = texts.filter(x => x.px < MIN_TEXT);
    expect(small, small.slice(0, 5).map(x => `"${x.text}" ${x.px}`).join(', ')).toEqual([]);
    expect(texts.length).toBeGreaterThan(100);
    if (!P2D) delete (globalThis as { Path2D?: unknown }).Path2D;
  });

  it('builds the lobby’s card: the records, the map, the ladder, the album and the song’s switch (which saves)', () => {
    const p = { ...freshProgress(), sessions: 3, seed: 777, cards: ['neuron', 'myelin'] as SynapsyProgress['cards'], links: [[0, 1, 3, 40]] as SynapsyProgress['links'], learned: ['see'] as SynapsyProgress['learned'] };
    let saved = 0;
    const el = progressPanel(p, () => { saved++; });
    expect(el.textContent).toContain(t('panel.map'));
    expect(el.textContent).toContain(t('card.myelin.title'));
    expect(el.textContent).toContain(t('panel.note'));
    expect(el.querySelectorAll('.arcade-daily').length).toBe(CARDS.length);
    const box = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(box.checked).toBe(true);
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(p.song).toBe(false);
    expect(saved).toBe(1);
  });

  it('gives a sing-along line that follows the beat through the verses and the refrain', () => {
    const sim = later();
    const first = sim.songLine()!;
    expect(first.text).toBe(sim.song.lines[0].text);
    drive(sim, (8 * 60) / RULES.bpm + 0.05, MID);
    expect(sim.songLine()!.text).toBe(sim.song.lines[1].text);
  });
});

describe('the lobby’s picture', () => {
  it('draws at any clock, a hair below zero too (the lobby’s first frame), with or without the player’s brain', () => {
    const P2D = (globalThis as { Path2D?: unknown }).Path2D;
    if (!P2D) (globalThis as { Path2D?: unknown }).Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} };
    const { ctx } = recorder();
    const p = { ...freshProgress(), seed: 777, links: [[0, 1, 2, 0], [99, 2, 1, 0]] as SynapsyProgress['links'] };
    for (const t of [-0.004, -1.7, 0, 0.5, 3.3, 1e5]) {
      expect(() => drawPreview(ctx, 640, 480, t, p)).not.toThrow();
      expect(() => drawPreview(ctx, 200, 140, t)).not.toThrow();
    }
    if (!P2D) delete (globalThis as { Path2D?: unknown }).Path2D;
  });
});

describe('the whole game under random hands', () => {
    it('survives random hands at every size: taps, drags, Oli, keys, a resize mid-play (the whole game on a recording context)', () => {
    if (!(globalThis as { Path2D?: unknown }).Path2D) (globalThis as { Path2D?: unknown }).Path2D = class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} };
    for (const seed of [3]) {
      for (const c of CHECK_SIZES) {
        const rnd = mulberry32(seed * 97 + c.w);
        const { ctx } = recorder();
        const canvas = { getContext: () => ctx } as unknown as HTMLCanvasElement;
        const progress = mod.freshProgress() as SynapsyProgress;
        const env: GameEnv<SynapsyProgress> = {
          canvas, hud: {} as HTMLElement, audio: new ArcadeAudio(0.5, false), progress, rng: mulberry32(seed), day: '2026-11-12', daySeed: 1,
          plannedSec: 50, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false, tuning: DEFAULT_TUNING,
          hint: () => undefined, hudTop: () => c.insets.top, insets: () => c.insets, touch: c.w < 700,
          body: () => ({ balance: rnd() < 0.3 ? null : 0.4 + rnd() * 0.2, heartRate: null }),
        };
        const game = mod.create(env);
        game.resize(c.w, c.h, 1);
        game.intro(0.016, 0.5);
        game.start();
        let t = 0, down = false, id = 1, x = 0, y = 0;
        for (let i = 0; i < 60 * 20; i++) {
          const dt = rnd() < 0.05 ? 0.05 : 1 / 60;
          t += dt;
          const level = (Math.sin(t * 0.3) + 1) / 2;
          const f: FocusFrame = { reliable: rnd() > 0.05, activity: level * 6 - 2, threshold: 2, level, focused: level > 0.5, hold: 0, calm: 1 - level };
          try {
            game.update(dt, f, t);
            if (i % 2 === 0) game.draw();
            const r = rnd();
            if (!down && r < 0.06) {
              // a press: on a target, the middle, or anywhere
              const ts = game.targets?.() ?? [];
              if (ts.length && rnd() < 0.3) { const tt = ts[0]; x = tt.x + tt.w / 2; y = tt.y + tt.h / 2; }
              else { x = rnd() * c.w; y = c.insets.top + rnd() * (c.h - c.insets.top); }
              game.pointer?.({ type: 'down', x, y, id });
              down = true;
            } else if (down && r < 0.5) {
              x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60;
              game.pointer?.({ type: 'move', x, y, id });
            } else if (down && r < 0.6) {
              game.pointer?.({ type: 'up', x, y, id });
              down = false;
              id++;
            }
            if (r > 0.995) game.key?.(' ', true);
            if (r > 0.993 && r <= 0.995) game.key?.('o', true);
            if (i === 700) game.resize(c.h, c.w, 1);
            if (i === 900) game.resize(c.w, c.h, 2);
          } catch (e) {
            throw new Error(`seed ${seed}, ${c.name}, frame ${i}: ${(e as Error).stack}`);
          }
        }
        game.finish?.();
        game.result();
        game.destroy();
      }
    }
  });
});
