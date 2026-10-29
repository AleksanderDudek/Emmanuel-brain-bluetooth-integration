import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, BEGINNER_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { ANCHOR, KIND, KINDS, RECIPES, STAGES, YOUNG_AT, kindsAt, nextKind, type KindId } from '../src/arcade/arka/content';
import { CATALOGS, bare, cap, t, unit } from '../src/arcade/arka/i18n';
import { BOTTOM, TOP, cellUnder, layout, railRect } from '../src/arcade/arka/layout';
import {
  STALLS, blockedAt, blockedShare, generateHold, greedyClears, removalOrder, replay, toEdge, type Hold, type HoldSpec,
} from '../src/arcade/arka/holds';
import {
  DAY_GIFT, MAX_LEAVES, addHome, doveBringsLeaf, endEvening, freshProgress, homestead, kindsOut, settle, type ArkaProgress,
} from '../src/arcade/arka/meta';
import { ArkaSim, NEUTRAL_RATE, RULES, moving, planBlocks, plankRate, plankU, type Beast, type SimEvent } from '../src/arcade/arka/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-10-25';
const STEP = 1 / 60;

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
/** Above the threshold all the time: a Day passes. */
const FOCUS = frame({ activity: 8, level: 0.9, focused: true, hold: 20, calm: 0.05 });
/** Below it: an Evening passes. */
const REST = frame({ activity: -4, level: 0.1, calm: 0.9 });
const FOG = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

type SimOpts = { progress?: Partial<ArkaProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): ArkaSim {
  const sim = new ArkaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no gift, the day's hold done): the rules one at a time. */
function quiet(o: SimOpts = {}): ArkaSim {
  return makeSim({ ...o, progress: { sessions: 6, days: 1, giftDay: DAY, dailyDay: DAY, evenings: 5, ...o.progress } });
}

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time. */
function drive(sim: ArkaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    const t = sim.now + STEP;
    sim.update(STEP, typeof f === 'function' ? f(t) : f, t);
    each?.(t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run until nothing on the deck or the landing moves. */
function settleMoves(sim: ArkaSim, f: FocusFrame = frame()): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < 600 && sim.hold.beasts.some(b => moving(b) || b.state === 'pair'); i++) out.push(...drive(sim, STEP, f));
  return out;
}

/**
 * Put a hand-made hold on the deck: `rows` of text, one character per cell — '.' empty, a kind's
 * first letter in upper case (S sheep, G goat, D donkey, C cow, H horse, M camel) followed by an
 * arrow: ^ > v <.  "S>" is a sheep facing right.
 */
function setDeck(sim: ArkaSim, rows: string[]): Beast[] {
  const letter: Record<string, KindId> = { S: 'sheep', G: 'goat', D: 'donkey', C: 'cow', H: 'horse', M: 'camel' };
  const dir: Record<string, 0 | 1 | 2 | 3> = { '^': 0, '>': 1, 'v': 2, '<': 3 };
  const cells = rows.map(r => r.split(' ').filter(Boolean));
  const h = sim.hold as unknown as { cols: number; rows: number; beasts: Beast[]; grid: Int16Array; slide: number };
  const cols = cells[0].length, nrows = cells.length;
  const grid = new Int16Array(cols * nrows).fill(-1);
  const beasts: Beast[] = [];
  cells.forEach((row, y) => row.forEach((c, x) => {
    if (c === '.') return;
    grid[y * cols + x] = beasts.length;
    beasts.push({ id: 1000 + beasts.length, kind: letter[c[0]], x, y, dir: dir[c[1]], state: 'deck', t: 0, dur: 0, dist: 0, stall: -1, owner: false, mate: null, link: false, chain: 0, since: 0, was: -1 });
  }));
  Object.assign(h, { cols, rows: nrows, beasts, grid, slide: 0 });
  sim.slots.fill(null);
  sim.chain = 0;
  sim.jamT = 0;
  return beasts;
}

// ── the generator ────────────────────────────────────────────────
const specFor = (id: keyof typeof RECIPES, nk = RECIPES[id].kinds): HoldSpec => {
  const r = RECIPES[id];
  const pairs: KindId[] = [];
  for (let i = 0; i < r.pairs; i++) pairs.push(KINDS[i % Math.min(nk, r.pairs)]);
  return { cols: r.cols, rows: r.rows, pairs, blocked: r.blocked, open: r.open };
};

describe('the holds: solvable by construction', () => {
  it('keeps at most `open` kinds open in the removal order, every pair whole', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pairs: KindId[] = ['sheep', 'goat', 'donkey', 'cow', 'sheep', 'horse', 'camel', 'goat'];
      for (const open of [2, 3]) {
        const seq = removalOrder(pairs, open, mulberry32(seed));
        expect(seq).toHaveLength(16);
        const odd = new Set<KindId>();
        for (const k of seq) {
          if (odd.has(k)) odd.delete(k); else odd.add(k);
          expect(odd.size).toBeLessThanOrEqual(open);
        }
        expect(odd.size).toBe(0);
      }
    }
  });

  it('is the same hold for the same recipe and seed, and another for another seed', () => {
    const a = generateHold(specFor('c3'), 77), b = generateHold(specFor('c3'), 77), c = generateHold(specFor('c3'), 78);
    expect(b).toEqual(a);
    expect(c).not.toEqual(a);
  });

  it('clears every hold of every recipe by its removal order with three stalls and no help', () => {
    for (const id of Object.keys(RECIPES) as (keyof typeof RECIPES)[]) {
      for (let seed = 1; seed <= 60; seed++) {
        const h = generateHold(specFor(id), seed);
        expect(h.animals, `${id} ${seed}`).toHaveLength(RECIPES[id].pairs * 2);
        expect(replay(h, h.order, STALLS), `${id} ${seed}`).toBe(true);
        // no two animals share a cell, every animal on the deck
        const cells = new Set(h.animals.map(a => a.y * h.cols + a.x));
        expect(cells.size).toBe(h.animals.length);
        for (const a of h.animals) expect(a.x >= 0 && a.y >= 0 && a.x < h.cols && a.y < h.rows).toBe(true);
      }
    }
  });

  it('lets a greedy player (a free mate first, else any free animal) clear ≥ 90 % of holds without Noah\'s hand', () => {
    let clears = 0, plays = 0;
    for (const id of ['c1', 'c2', 'c3', 'c4', 'spike', 'easy', 'great', 'daily'] as const) {
      for (let seed = 1; seed <= 50; seed++) {
        const h = generateHold(specFor(id), seed * 13);
        const rnd = mulberry32(seed * 7919 + 3);   // other plays than the generator's own check
        for (let k = 0; k < 4; k++, plays++) if (greedyClears(h, rnd)) clears++;
      }
    }
    expect(clears / plays).toBeGreaterThanOrEqual(0.9);
  });

  it('blocks about the recipe\'s share of animals at the start, none in the warm-up', () => {
    for (const id of ['c1', 'c3', 'spike', 'great'] as const) {
      let share = 0;
      for (let seed = 1; seed <= 30; seed++) share += blockedShare(generateHold(specFor(id), seed));
      expect(share / 30, id).toBeGreaterThan(RECIPES[id].blocked - 0.12);
      expect(share / 30, id).toBeLessThan(RECIPES[id].blocked + 0.08);
    }
    for (let seed = 1; seed <= 30; seed++) expect(blockedShare(generateHold({ ...specFor('warm'), anchor: { ...ANCHOR, kind: 'sheep' } }, seed))).toBe(0);
  });

  it('puts the warm-up\'s sheep on the anchor cell, free to leave', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const h = generateHold({ cols: 4, rows: 4, pairs: ['sheep', 'goat', 'donkey'], blocked: 0, open: 2, anchor: { ...ANCHOR, kind: 'sheep' } }, seed);
      const at = h.animals.find(a => a.x === ANCHOR.x && a.y === ANCHOR.y);
      expect(at?.kind, `seed ${seed}`).toBe('sheep');
      const grid = new Int16Array(16).fill(-1);
      for (const a of h.animals) grid[a.y * 4 + a.x] = a.id;
      expect(blockedAt(grid, 4, 4, at!.x, at!.y, at!.dir)).toBe(0);
    }
  });

  it('knows the way out: cells to the edge and the first animal in the way', () => {
    expect(toEdge(5, 6, 1, 2, 0)).toBe(2);
    expect(toEdge(5, 6, 1, 2, 1)).toBe(3);
    expect(toEdge(5, 6, 1, 2, 2)).toBe(3);
    expect(toEdge(5, 6, 1, 2, 3)).toBe(1);
    const grid = new Int16Array(25).fill(-1);
    grid[2 * 5 + 4] = 7;
    expect(blockedAt(grid, 5, 5, 1, 2, 1)).toBe(3);
    expect(blockedAt(grid, 5, 5, 1, 2, 3)).toBe(0);
  });
});

// ── the deck and the landing ─────────────────────────────────────
describe('the deck: tap, walk, bump, the landing', () => {
  it('walks a free animal off the deck at 6 cells/s, along the rail in 0.6 s, into a stall', () => {
    const sim = quiet();
    const [s] = setDeck(sim, ['S> . .', '. . .', '. . G^']);
    sim.send(s.id);
    expect(s.state).toBe('out');
    expect(s.dur).toBeCloseTo(2.5 / 6, 5);   // two cells and a half to the edge
    expect(sim.slots[0]).toBe(s);           // its stall is held from the moment it leaves
    drive(sim, 2.5 / 6 + 0.01, frame());
    expect(s.state).toBe('rail');
    const evs = drive(sim, 0.6, frame());
    expect(s.state).toBe('stall');
    expect(ofType(evs, 'wait')).toHaveLength(1);
  });

  it('bumps into the animal in its way and walks back: nothing lost, the cell its own again', () => {
    const sim = quiet();
    const [s, g] = setDeck(sim, ['S> . G^', '. . .']);
    sim.send(s.id);
    const evs = sim.take();
    expect(s.state).toBe('bump');
    expect(ofType(evs, 'bump')[0].by).toBe(g);
    expect(s.dur).toBeCloseTo(Math.max(RULES.bumpMin, (2 * (1 + RULES.nudge)) / 6), 5);
    drive(sim, s.dur + 0.02, frame());
    expect(s.state).toBe('deck');
    expect(sim.beastAt(0, 0)).toBe(s);
    expect(sim.score).toBe(0);
  });

  it('pairs an animal with a waiting mate of its kind: both go down the ramp, +1 pair', () => {
    const sim = quiet();
    const [a, b] = setDeck(sim, ['S^ S^ C^', '. . .']);
    sim.send(a.id);
    drive(sim, 1.5, frame());
    expect(a.state).toBe('stall');
    sim.send(b.id);
    const evs = drive(sim, 1.2, frame());
    const pair = ofType(evs, 'pair');
    expect(pair).toHaveLength(1);
    expect(pair[0].link).toBe(true);   // its mate was waiting when it was sent
    expect(sim.score).toBe(1);
    expect(sim.slots[0]).toBeNull();
    expect(sim.p.settled.sheep).toBe(1);
  });

  it('pairs an animal sent while its mate is still on its way too (not a chain link)', () => {
    const sim = quiet();
    const [a, b] = setDeck(sim, ['S^ . S^', '. . .']);
    sim.send(a.id);
    sim.send(b.id);
    expect(sim.slots.filter(Boolean)).toHaveLength(1);   // one stall for the two
    const evs = drive(sim, 1.5, frame());
    const pair = ofType(evs, 'pair');
    expect(pair).toHaveLength(1);
    expect(pair[0].link).toBe(false);
    expect(sim.score).toBe(1);
  });

  it('turns an animal back at a full landing ("Pełno") unless its mate waits there', () => {
    const sim = quiet();
    const [s, g, d, c, s2] = setDeck(sim, ['S^ G^ D^ C^ S^', '. . . . .']);
    for (const b of [s, g, d]) sim.send(b.id);
    drive(sim, 1.2, frame());
    expect(sim.capacity).toBe(3);
    sim.send(c.id);
    const evs = sim.take();
    expect(ofType(evs, 'full')).toHaveLength(1);
    expect(c.state).toBe('full');
    drive(sim, c.dur + 0.02, frame());
    expect(c.state).toBe('deck');
    sim.send(s2.id);   // a sheep waits: it may go
    expect(s2.state).toBe('out');
  });

  it('chains links in a row (the chime climbs), an animal taking a stall breaks the chain', () => {
    const sim = quiet();
    const beasts = setDeck(sim, ['S^ G^ D^ . .', 'S< G< D< . .', '. . . . H>']);
    const [s1, g1, d1] = beasts;
    const [s2, g2, d2] = beasts.slice(3);
    for (const b of [s1, g1, d1]) sim.send(b.id);
    drive(sim, 1.2, frame());
    const evs: SimEvent[] = [];
    for (const b of [s2, g2, d2]) {
      sim.send(b.id);
      evs.push(...drive(sim, 0.05, frame()));
    }
    evs.push(...drive(sim, 1.5, frame()));
    expect(ofType(evs, 'pair').map(e => e.chain).sort()).toEqual([1, 2, 3]);
    expect(sim.maxChain).toBe(3);
    expect(sim.chain).toBe(3);
  });

  it('breaks a chain when an animal takes a stall', () => {
    const sim = quiet();
    const [s1, s2, g1] = setDeck(sim, ['S^ S^ G^', '. . .']);
    sim.send(s1.id);
    drive(sim, 1.2, frame());
    sim.send(s2.id);
    expect(sim.chain).toBe(1);
    sim.send(g1.id);
    expect(sim.chain).toBe(0);
  });

  it('jams when every stall is taken and nothing free can pair: Noah\'s hand after 3 s, ★★ at best', () => {
    const sim = quiet();
    // three singles go to the landing; their mates are stuck behind a row of horses, and a horse finds the landing full
    const beasts = setDeck(sim, ['S^ G^ D^ H^', 'H> H> H> .', 'S^ G^ D^ .']);
    for (const b of beasts.slice(0, 3)) sim.send(b.id);
    expect(sim.jammed()).toBe(false);          // they are still on their way
    const evs = drive(sim, 1.3, frame());
    expect(sim.jammed()).toBe(true);
    expect(ofType(evs, 'jam')).toHaveLength(1);
    const horse = beasts[3];
    sim.send(horse.id);
    expect(horse.state).toBe('full');           // "Pełno": no cost, it turns back
    drive(sim, horse.dur + 0.02, frame());     // a try restarts Noah's wait
    expect(sim.jamT).toBeLessThan(0.1);
    const hand = ofType(drive(sim, RULES.jam + 0.1, frame()), 'hand');
    expect(hand).toHaveLength(1);
    expect(hand[0].leaf).toBe(false);
    expect(hand[0].beast).toBe(beasts[0]);      // the longest-waiting
    expect(sim.hold.hands).toBe(1);
    drive(sim, RULES.back + 0.05, frame());
    expect(beasts[0].state).toBe('deck');
    expect(sim.beastAt(0, 0)).toBe(beasts[0]);
    expect(sim.jammed()).toBe(false);           // a stall is free again
  });

  it('lets an olive leaf lead a waiting animal back whenever the player wants, keeping the stars', () => {
    const sim = quiet({ progress: { leaves: 2 } });
    const [s, g] = setDeck(sim, ['S^ G^ . .', '. . . .']);
    sim.send(s.id);
    sim.send(g.id);
    drive(sim, 1.2, frame());
    sim.armLeaf();
    expect(sim.leafArmed).toBe(true);
    expect(sim.useLeaf(g.id)).toBe(true);
    expect(sim.p.leaves).toBe(1);
    expect(sim.hold.hands).toBe(0);
    expect(g.state).toBe('back');
    expect(sim.useLeaf()).toBe(true);   // L: the longest-waiting
    expect(s.state).toBe('back');
    expect(sim.useLeaf()).toBe(false);  // no leaf left
  });

  it('gives every waiting animal back with R held for 1 s (one hand for the stars)', () => {
    const sim = quiet();
    const [s, g] = setDeck(sim, ['S^ G^ . .', '. . . .']);
    sim.send(s.id);
    sim.send(g.id);
    drive(sim, 1.2, frame());
    sim.restartKey(true);
    drive(sim, 0.5, frame());
    expect(s.state).toBe('stall');
    drive(sim, 0.55, frame());
    expect(s.state).toBe('back');
    expect(g.state).toBe('back');
    expect(sim.hold.hands).toBe(1);
    sim.restartKey(false);
  });

  it('rates a hold ★★★ without Noah\'s hand, ★★ with one, ★ with more, and always clears it', () => {
    for (const [hands, stars] of [[0, 3], [1, 2], [2, 1], [5, 1]]) {
      const sim = quiet();
      const [a, b] = setDeck(sim, ['S^ S^', '. .']);
      sim.hold.hands = hands;
      sim.send(a.id);
      sim.send(b.id);
      const clear = ofType(drive(sim, 1.5, frame()), 'clear');
      expect(clear).toHaveLength(1);
      expect(clear[0].stars).toBe(stars);
    }
  });

  it('moves the cursor with the arrows (wrapping) and sends the nearest animal that can leave, a pair first', () => {
    const sim = quiet();
    const [s1, , s2] = setDeck(sim, ['S^ G^ . . .', '. . . . .', '. . . . S>', '. . . . .']);
    sim.cursor.x = 0;
    sim.cursor.y = 0;
    sim.moveCursor(-1, 0);
    expect(sim.cursor).toMatchObject({ x: 4, y: 0, shown: true });
    sim.moveCursor(1, 0);
    sim.keySend();                         // the sheep under the cursor
    expect(s1.state).toBe('out');
    sim.cursor.x = 1;
    sim.cursor.y = 2;                      // an empty cell: the nearest that can leave, the mate of the sheep on its way first
    sim.keySend();
    expect(s2.state).toBe('out');
  });

  it('does nothing to the deck in an Evening, and the deck is exactly as it was the next Day', () => {
    const sim = quiet({ planned: 180 });
    const before = sim.hold.beasts.map(b => `${b.id}:${b.x},${b.y},${b.dir},${b.state}`);
    drive(sim, sim.plan[0].dur + 0.5, frame());
    expect(sim.block.kind).toBe('evening');
    for (const b of sim.hold.beasts) sim.send(b.id);
    sim.keySend();
    expect(sim.hold.beasts.map(b => `${b.id}:${b.x},${b.y},${b.dir},${b.state}`)).toEqual(before);
  });
});

// ── the band ─────────────────────────────────────────────────────
describe('planks: steady focus by Day', () => {
  it('grows at (0.025 + 0.085·u) × (1 + min(hold, 18)/36), u from 0.35 to 0.85', () => {
    expect(plankU(0.35)).toBe(0);
    expect(plankU(0.6)).toBeCloseTo(0.5, 9);
    expect(plankU(0.95)).toBe(1);
    expect(plankRate(0.5, 0)).toBeCloseTo(0.025 + 0.085 * 0.3, 9);
    expect(plankRate(0.85, 18)).toBeCloseTo(0.11 * 1.5, 9);
    expect(plankRate(0.85, 60)).toBeCloseTo(0.11 * 1.5, 9);   // the steady bonus caps at ×1.5
    expect(NEUTRAL_RATE).toBeCloseTo(0.059, 9);
  });

  it('waits out the lead-in (5 s Mendi, 2 s HALO) before planks grow', () => {
    for (const [eeg, lead] of [[false, 5], [true, 2]] as const) {
      const sim = quiet({ eeg });
      setDeck(sim, ['S^ . G^', '. . .']);
      drive(sim, lead - 0.1, FOCUS);
      expect(sim.progress, `eeg ${eeg}`).toBe(0);
      drive(sim, 0.5, FOCUS);
      expect(sim.progress).toBeGreaterThan(0);
    }
  });

  it('lays at most three planks per hold: three stalls more', () => {
    const sim = quiet({ planned: 600 });
    setDeck(sim, ['S^ . G^', '. . .']);
    const evs = drive(sim, 25, FOCUS);
    expect(ofType(evs, 'plank')).toHaveLength(3);
    expect(sim.hold.planks).toBe(3);
    expect(sim.capacity).toBe(6);
    expect(sim.progress).toBeLessThanOrEqual(1);
  });

  it('gives every hold its first plank after 15 s of its Day time, whatever the band says', () => {
    const sim = quiet();
    setDeck(sim, ['S^ . G^', '. . .']);
    const low = frame({ level: 0, activity: -5, calm: 1 });
    let evs = drive(sim, 14.8, low);
    expect(ofType(evs, 'plank')).toHaveLength(0);
    evs = drive(sim, 0.4, low);
    const plank = ofType(evs, 'plank');
    expect(plank).toHaveLength(1);
    expect(plank[0].gift).toBe(true);
  });

  it('freezes while the signal is unreliable: no plank progress, no loss, touch still works', () => {
    const sim = quiet();
    const [s] = setDeck(sim, ['S^ . G^', '. . .']);
    drive(sim, 8, FOCUS);
    const p = sim.progress;
    drive(sim, 4, FOG);
    expect(sim.progress).toBe(p);
    sim.send(s.id);
    expect(s.state).toBe('out');
    expect(sim.padLevel(FOG)).toBeNull();
  });

  it('carries the steady stretch over a dropout: the kit restarts its hold, the planks do not', () => {
    const sim = quiet();
    setDeck(sim, ['S^ . G^', '. . .']);
    let hold = 0;
    drive(sim, 10, t => frame({ level: 0.9, activity: 8, focused: true, hold: (hold = Math.max(0, t - 0)) }));
    const before = sim.progress;
    drive(sim, 3, FOG);
    // the kit's hold starts again from 0 after the gap; the stretch counts on
    let restarted = 0;
    drive(sim, 2, () => frame({ level: 0.9, activity: 8, focused: true, hold: (restarted += STEP) }));
    const rate = (sim.progress - before) / 2;
    expect(rate).toBeGreaterThan(plankRate(sim.L, restarted) * 1.05);
    expect(hold).toBeGreaterThan(0);
  });

  it('floors a Day with fewer than 8 reliable seconds to the neutral rate\'s planks, with no verdict', () => {
    const sim = quiet({ planned: 180 });
    setDeck(sim, ['S^ . G^', '. . .']);
    const day = sim.plan[0];
    const evs = drive(sim, day.dur + 0.1, t => (t < 5 ? frame() : FOG));
    const end = ofType(evs, 'blockEnd')[0];
    expect(end.verdict).toBeNull();
    const planks = ofType(evs, 'plank').length + sim.progress;
    expect(planks).toBeGreaterThanOrEqual(NEUTRAL_RATE * (day.dur - RULES.lead) - 1e-6);
  });

  it('carves a post for a passed Day, and says honestly how close a failed one came', () => {
    const pass = quiet({ planned: 180 });
    const home = pass.p.home;
    const evs = drive(pass, pass.plan[0].dur + 0.1, FOCUS);
    expect(ofType(evs, 'post')).toHaveLength(1);
    expect(pass.p.home).toBe(home + 1);
    const fail = quiet({ planned: 180 });
    const evs2 = drive(fail, fail.plan[0].dur + 0.1, REST);
    const almost = ofType(evs2, 'almost');
    expect(almost).toHaveLength(1);
    expect(almost[0].have).toBeLessThan(almost[0].need);
    expect(almost[0].need).toBeGreaterThan(0);
  });

  it('judges with the session\'s own tuning: a beginner\'s judge leans further toward the player', () => {
    // 47 % of the window above the threshold: a beginner's Day passes, a regular one does not
    const share = (t: number) => ((t * 10) % 10 < 4.7 ? FOCUS : REST);
    const reg = quiet({ planned: 180 });
    const beg = quiet({ planned: 180, tuning: BEGINNER });
    const a = ofType(drive(reg, reg.plan[0].dur + 0.1, share), 'blockEnd')[0];
    const b = ofType(drive(beg, beg.plan[0].dur + 0.1, share), 'blockEnd')[0];
    expect(a.verdict).toBe(false);
    expect(b.verdict).toBe(true);
  });

  it('hides a blind Day\'s planks under the morning mist and shows them together at the Evening\'s telegraph', () => {
    // the 4th session, its second Day is the 4th Day counted across sessions
    const sim = quiet({ planned: 300, progress: { sessions: 3, days: 2 } });
    drive(sim, sim.plan[2].start + 0.1, FOCUS);
    expect(sim.block.blind).toBe(true);
    sim.hold.planks = 0;   // as if a new hold had just come
    sim.progress = 0;
    const cap0 = sim.capacity;
    const evs = drive(sim, sim.plan[2].dur - RULES.telegraph - 0.5, FOCUS);
    const planks = ofType(evs, 'plank');
    expect(planks.length).toBeGreaterThan(0);
    expect(planks.every(p => p.blind)).toBe(true);
    expect(sim.capacity).toBe(cap0);            // capacity stays as at the Day's start
    expect(sim.padLevel(FOCUS)).toBeNull();      // no live feedback in the sound either
    const reveal = ofType(drive(sim, 1, FOCUS), 'blindReveal');
    expect(reveal).toHaveLength(1);
    expect(reveal[0].planks).toBe(planks.length);
    expect(sim.capacity).toBe(cap0 + planks.length);
  });

  it('never makes the first Day of a session blind, and no Day before the 4th session', () => {
    const early = quiet({ planned: 600, progress: { sessions: 2, days: 3 } });
    drive(early, 600, FOCUS);
    expect(early.plan.some(b => b.blind)).toBe(false);
    const first = quiet({ planned: 600, progress: { sessions: 5, days: 3 } });
    expect(first.plan[0].blind).toBe(false);   // it would be the 4th
  });
});

describe('the Evening: rest, the dove and its leaf', () => {
  it('flies the dove farther while calm holds, back a little when it does not, frozen in mist', () => {
    const sim = quiet({ planned: 180 });
    drive(sim, sim.plan[0].dur + 0.1, frame());
    expect(sim.dove.state).toBe('out');
    drive(sim, 6, REST);
    const far = sim.dove.far;
    expect(far).toBeGreaterThan(0.2);
    drive(sim, 3, FOG);
    expect(sim.dove.far).toBe(far);
    drive(sim, 3, FOCUS);                      // the band climbing back after the dropout: no loss, no unearned gain
    expect(sim.dove.far).toBe(far);
    const back = quiet({ planned: 180 });
    drive(back, back.plan[0].dur + 0.1, frame());
    back.dove.far = 0.5;
    back.calm = 0.1;
    drive(back, 4, FOCUS);
    expect(back.dove.far).toBeCloseTo(0.5 - RULES.doveIn * 4, 2);
  });

  it('brings an olive leaf for a passed Evening, with an olive (a tree) after deep calm', () => {
    const sim = quiet({ planned: 180, progress: { leaves: 0 } });
    drive(sim, sim.plan[0].dur + 0.1, frame());
    const evs = drive(sim, sim.plan[1].dur, REST);
    const dove = ofType(evs, 'dove')[0];
    expect(dove).toMatchObject({ leaf: true, olive: true, grace: false, stored: true });
    expect(sim.p.leaves).toBe(1);
    expect(sim.p.olives).toBe(1);
  });

  it('brings the dove back without a leaf for a failed Evening, and nothing else is lost', () => {
    const sim = quiet({ planned: 180, progress: { leaves: 1, dry: 0 } });
    drive(sim, sim.plan[0].dur + 0.1, frame());
    const evs = drive(sim, sim.plan[1].dur, FOCUS);
    expect(ofType(evs, 'dove')[0]).toMatchObject({ leaf: false, olive: false });
    expect(sim.p.leaves).toBe(1);
    expect(sim.p.dry).toBe(1);
  });

  it('gives grace: the first Evening ever always brings a leaf, and the third after two without', () => {
    expect(doveBringsLeaf({ ...freshProgress(), evenings: 0 }, false)).toEqual({ leaf: true, grace: true });
    expect(doveBringsLeaf({ ...freshProgress(), evenings: 3, dry: 1 }, false)).toEqual({ leaf: false, grace: false });
    expect(doveBringsLeaf({ ...freshProgress(), evenings: 3, dry: 2 }, null)).toEqual({ leaf: true, grace: true });
    const p = { ...freshProgress(), evenings: 3, dry: 0, leaves: MAX_LEAVES };
    expect(endEvening(p, true)).toEqual({ stored: false });   // three in store already
    expect(p.leaves).toBe(MAX_LEAVES);
    const sim = makeSim({ planned: 180 });   // the first session: its first Evening
    drive(sim, sim.plan[0].dur + 0.1, frame());
    const evs = drive(sim, sim.plan[1].dur, FOCUS);
    expect(ofType(evs, 'dove')[0]).toMatchObject({ leaf: true, grace: true });
  });

  it('has no verdict for an Evening without 8 reliable seconds (no loss either)', () => {
    const sim = quiet({ planned: 180, progress: { leaves: 1 } });
    drive(sim, sim.plan[0].dur + 0.1, frame());
    const evs = drive(sim, sim.plan[1].dur, FOG);
    expect(ofType(evs, 'blockEnd')[0].verdict).toBeNull();
    expect(sim.p.leaves).toBe(1);
  });

  it('lets the pad follow the level only in a sighted Day', () => {
    const sim = quiet({ planned: 180 });
    drive(sim, 2, FOCUS);
    expect(sim.padLevel(FOCUS)).not.toBeNull();
    drive(sim, sim.plan[0].dur, REST);
    expect(sim.block.kind).toBe('evening');
    expect(sim.padLevel(REST)).toBeNull();
    drive(sim, 180, REST);
    expect(sim.padLevel(REST)).toBeNull();   // the finisher
  });
});

describe('the session plan', () => {
  it('plays Day 24 s, Evening 12 s and a 4 s finisher in a 40 s session', () => {
    const p = planBlocks(40, mulberry32(1));
    expect(p.blocks.map(b => [b.kind, b.start, b.dur])).toEqual([['day', 0, 24], ['evening', 24, 12]]);
    expect(p.finale).toBe(4);
  });

  it('fits Days and Evenings to 180, 300 and 600 s, ending with an Evening and the finisher, no block under 12 s', () => {
    for (const sec of [180, 300, 600]) {
      for (let seed = 1; seed <= 20; seed++) {
        const p = planBlocks(sec, mulberry32(seed));
        const rounds = Math.max(1, Math.round((sec - 5) / 48));
        expect(p.blocks).toHaveLength(rounds * 2);
        expect(p.blocks.at(-1)!.kind).toBe('evening');
        const end = p.blocks.at(-1)!.start + p.blocks.at(-1)!.dur;
        expect(end + p.finale).toBeCloseTo(sec, 6);
        for (const b of p.blocks) expect(b.dur).toBeGreaterThanOrEqual(12);
        const days = p.blocks.filter(b => b.kind === 'day').map(b => b.dur);
        for (const d of days) expect(d).toBeGreaterThan(20);
      }
    }
  });

  it('telegraphs each block 4 s ahead, plays the finisher at the end, and may stop only then', () => {
    const sim = quiet({ planned: 180 });
    const evs = drive(sim, 172, frame());
    const tele = ofType(evs, 'telegraph');
    expect(tele.length).toBe(sim.plan.length - 1);
    expect(sim.canStop()).toBe(false);
    const fin = drive(sim, 8.5, frame());
    expect(ofType(fin, 'finale')).toHaveLength(1);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('starts every session with the warm-up (4×4, 3 pairs, all free) and the sheep on the anchor cell', () => {
    for (let s = 0; s < 8; s++) {
      const sim = makeSim({ progress: { sessions: s }, seed: s + 3 });
      const h = sim.hold;
      expect([h.recipe, h.cols, h.rows, h.beasts.length]).toEqual(['warm', 4, 4, 6]);
      expect(sim.beastAt(ANCHOR.x, ANCHOR.y)?.kind).toBe('sheep');
      for (const b of h.beasts) expect(sim.blockedOf(b)).toBe(0);
    }
  });

  it('brings the day\'s hold second, the same structure for everyone that day', () => {
    const a = makeSim({ progress: { sessions: 0 }, daySeed: 99, seed: 1 });
    const b = makeSim({ progress: { sessions: 12, giftDay: DAY }, daySeed: 99, seed: 2 });
    for (const sim of [a, b]) {
      for (const x of sim.hold.beasts) { sim.send(x.id); }
      drive(sim, 0.1, frame());
      for (let i = 0; i < 40 && sim.hold.n === 1; i++) {
        sim.keySend();
        drive(sim, 0.6, frame());
      }
      expect(sim.hold.recipe).toBe('daily');
    }
    const shape = (sim: ArkaSim) => sim.hold.beasts.map(x => `${x.x},${x.y},${x.dir}`).join(' ');
    expect(shape(b)).toBe(shape(a));
    // the first player has three kinds, the other twelve: the same cells, their own animals
    expect(new Set(a.hold.beasts.map(x => x.kind)).size).toBe(3);
    expect(new Set(b.hold.beasts.map(x => x.kind)).size).toBe(6);
  });

  it('gives the day\'s first session the neighbours\' planks, the same for everyone', () => {
    const sim = makeSim({ progress: { sessions: 4, giftDay: '2026-10-24' } });
    expect(sim.p.home).toBe(DAY_GIFT);
    expect(sim.p.giftDay).toBe(DAY);
    const again = makeSim({ progress: { sessions: 5, giftDay: DAY, home: 3 } });
    expect(again.p.home).toBe(3);
  });
});

describe('the new land: kinds, young, the homestead', () => {
  it('brings three kinds in the first session, one in each of the next three, then one every second session', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 16, 30].map(kindsAt)).toEqual([3, 4, 5, 6, 6, 7, 7, 8, 11, 11, 12, 12]);
    expect(nextKind(1)).toEqual({ kind: 'cow', in: 1 });
    expect(nextKind(4)).toEqual({ kind: 'ibex', in: 2 });
    expect(nextKind(16)).toBeNull();
    expect(kindsOut(1)).toEqual(['sheep', 'goat', 'donkey']);
    expect(KIND.camel.valley).toBe('laka');
    expect(KIND.ibex.valley).toBe('wzgorza');
  });

  it('puts a session\'s new kind on deck and names it in the summary', () => {
    const sim = quiet({ progress: { sessions: 1 } });
    expect(sim.newKinds).toEqual(['cow']);
    const r = sim.result();
    expect(r.highlights[0]).toBe(t('hl.kinds', { names: KIND.cow.name }));
  });

  it('settles every pair in its kind\'s valley, and the third pair of a kind brings its young', () => {
    const p = freshProgress();
    for (let i = 1; i < YOUNG_AT; i++) expect(settle(p, 'goat')).toBe(false);
    expect(settle(p, 'goat')).toBe(true);
    expect(settle(p, 'goat')).toBe(false);
    expect(p.young).toEqual(['goat']);
    expect(p.pairs).toBe(4);
  });

  it('builds the homestead in six stages at 6, 14, 24, 36, 50 and 66 points', () => {
    expect(STAGES.map(s => s.at)).toEqual([6, 14, 24, 36, 50, 66]);
    expect(homestead(0)).toMatchObject({ built: 0, have: 0, need: 6 });
    expect(homestead(15)).toMatchObject({ built: 2, have: 1, need: 10 });
    expect(homestead(66)).toMatchObject({ built: 6, next: null });
    const p = freshProgress();
    expect(addHome(p, 5)).toEqual([]);
    expect(addHome(p, 10)).toEqual([0, 1]);
  });

  it('carries a cleared hold\'s planks down to the homestead, and the open hold\'s at the end', () => {
    const sim = quiet({ planned: 180 });
    const [a, b] = setDeck(sim, ['S^ S^', '. .']);
    sim.hold.planks = 2;
    const home = sim.p.home;
    sim.send(a.id);
    sim.send(b.id);
    const clear = ofType(drive(sim, 1.5, frame()), 'clear');
    expect(clear[0].planks).toBe(2);
    expect(sim.p.home).toBe(home + 2);
    sim.hold.planks = 1;
    const before = sim.p.home;
    sim.finish();
    expect(sim.p.home).toBeGreaterThanOrEqual(before + 1);
  });
});

describe('Scripture, the result and the texts', () => {
  it('closes with the dove\'s leaf when one came, the animals spreading out, then the rainbow, Psalm 36 and Lamentations, in turn', () => {
    const sim = quiet({ planned: 180 });
    expect(sim.closingVerse()).toBe(['gen9.13', 'psa36.6', 'lam3.22-23'][(sim.session - 1) % 3]);
    sim.leavesBrought = 1;
    const fit = ['gen8.11', 'gen9.13', 'psa36.6', 'lam3.22-23'];
    expect(sim.closingVerse()).toBe(fit[(sim.session - 1) % fit.length]);
    const first = makeSim();   // a first session: three kinds came out, the best fit first
    expect(first.closingVerse()).toBe('gen8.17');
    for (const s of [first, sim]) expect(s.closingVerse()).not.toBe('gen8.1');
    for (const id of ['gen8.11', 'gen8.17', 'gen9.13', 'psa36.6', 'lam3.22-23'] as const) expect(passage(id).text.length).toBeGreaterThan(20);
  });

  it('shows no verse during play: the closing passage comes with the summary only', () => {
    const sim = quiet({ planned: 40 });
    const evs = drive(sim, 44, frame());
    // no event carries a passage; the summary's verse is the only one
    expect(JSON.stringify(evs.map(e => e.type))).not.toMatch(/verse|passage/);
    expect(sim.result().verse).toBeDefined();
  });

  it('result() is idempotent: records with Math.max, counters only during play', () => {
    const sim = quiet({ planned: 40, progress: { sessions: 3, pairs: 10, bestSession: 4 } });
    const [a, b] = setDeck(sim, ['S^ S^', '. .']);
    sim.send(a.id);
    sim.send(b.id);
    drive(sim, 2, frame());
    const one = JSON.stringify(sim.result());
    const p1 = JSON.stringify(sim.p);
    const two = JSON.stringify(sim.result());
    expect(two).toBe(one);
    expect(JSON.stringify(sim.p)).toBe(p1);
    expect(sim.p.sessions).toBe(4);
    expect(sim.p.pairs).toBe(11);
    expect(sim.p.bestByLen['40']).toBe(1);
  });

  it('bends the headline\'s unit: 1 para, 2–4 pary, 5+ par, 12–14 par, 22–24 pary', () => {
    expect([1, 2, 4, 5, 12, 14, 21, 22, 24, 25].map(unit)).toEqual(['para', 'pary', 'pary', 'par', 'par', 'par', 'par', 'pary', 'pary', 'par']);
    expect(bare('planks', 5)).toBe('desek');
    expect(cap(KIND.sheep.name)).toBe('Owce');
  });

  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('never types a verse: the catalog holds no passage\'s words', () => {
    const all = Object.values(CATALOGS).flatMap(c => Object.values(c).flatMap(m => (typeof m === 'string' ? [m] : Object.values(m))));
    for (const id of ['gen8.1', 'gen8.11', 'gen8.17', 'gen9.13', 'psa36.6', 'lam3.22-23'] as const) {
      for (const l of ['pl', 'en', 'de', 'sv'] as const) {
        const words = passage(id, l).text.split(/\s+/).slice(0, 6).join(' ');
        expect(all.some(s => (s as string).includes(words)), `${id} ${l}`).toBe(false);
      }
    }
  });
});


// ── the screen ───────────────────────────────────────────────────
const SIZES: [number, number][] = [[390, 844], [844, 390], [1280, 800], [1440, 900], [360, 640], [375, 667], [412, 915], [667, 375], [1024, 600], [768, 1024]];
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('the layout', () => {
  it('puts the warm-up\'s anchor cell under the smoke test\'s tap (50 %, 60 %) at every screen size', () => {
    for (const [w, h] of SIZES) {
      const L = layout(w, h, 4, 4, true);
      expect(cellUnder(L, w * 0.5, h * 0.6), `${w}×${h}`).toEqual({ x: ANCHOR.x, y: ANCHOR.y });
      // the tap is well inside the cell, not on a line
      expect(Math.abs(L.deck.x + (ANCHOR.x + 0.5) * L.c - w * 0.5)).toBeLessThan(0.01);
    }
  });

  it('keeps the deck, the landing and the leaf chip between the runner\'s strips and off each other', () => {
    for (const [w, h] of SIZES) {
      for (const [cols, rows, anchored] of [[4, 4, true], [5, 5, false], [6, 7, false], [7, 8, false]] as const) {
        const L = layout(w, h, cols, rows, anchored);
        const rail = railRect(L);
        const ring = { x: rail.x - L.rail / 2, y: rail.y - L.rail / 2, w: rail.w + L.rail, h: rail.h + L.rail };
        const id = `${w}×${h} ${cols}×${rows}`;
        expect(ring.y, id).toBeGreaterThanOrEqual(TOP - 0.5);
        expect(ring.y + ring.h, id).toBeLessThanOrEqual(h - 56);
        expect(ring.x, id).toBeGreaterThanOrEqual(0);
        expect(ring.x + ring.w, id).toBeLessThanOrEqual(w);
        expect(overlap(ring, L.landing), id).toBe(false);
        expect(overlap(ring, L.leaf), id).toBe(false);
        expect(overlap(L.landing, L.leaf), id).toBe(false);
        expect(L.leaf.x + L.leaf.w, id).toBeLessThanOrEqual(w - 4);
        expect(L.leaf.y + L.leaf.h, id).toBeLessThanOrEqual(h - BOTTOM);
        expect(L.leaf.w, id).toBeGreaterThanOrEqual(40);
        expect(L.landing.x + L.landing.w, id).toBeLessThanOrEqual(w);
        expect(L.land.y, id).toBeGreaterThanOrEqual(TOP);
      }
    }
  });

  it('gives a 390 px phone held upright cells of 44 px or more, up to seven columns', () => {
    for (const [cols, rows] of [[4, 4], [5, 6], [6, 7], [7, 8]]) expect(layout(390, 844, cols, rows, false).c, `${cols}×${rows}`).toBeGreaterThanOrEqual(44);
  });
});

describe('the smoke path', () => {
  /**
   * The smoke test's input: a click at the canvas centre (50 %, 60 %) every 0.65 s (released at
   * once), Space after every third one, the simulator's focus on (activity rises to about +20 % in
   * ~10 s).  The click finds its cell through the layout of the hold showing.
   */
  function smoke(o: SimOpts, w: number, h: number, every = 0.65): ArkaSim {
    const sim = makeSim({ planned: 40, tuning: BEGINNER, ...o });
    const focus = new FocusInput({ ...DEFAULT_TUNING, adapt: 0.08, ...BEGINNER_TUNING });
    let f = focus.push(0, true, 0.1), hub = 0, tap = every, taps = 0;
    for (let t = 0; t < 22; t += STEP) {
      hub += STEP;
      if (hub >= 0.1) {
        hub -= 0.1;
        f = focus.push(20 * (1 - Math.exp(-t / 4)), true, 0.1);
      }
      if ((tap += STEP) >= every) {
        tap -= every;
        const L = layout(w, h, sim.hold.cols, sim.hold.rows, sim.hold.recipe === 'warm');
        const cell = cellUnder(L, w * 0.5, h * 0.6);
        const b = cell ? sim.beastAt(cell.x, cell.y) : null;
        if (b) sim.send(b.id);
        if (taps++ % 3 === 0) sim.keySend();
      }
      sim.update(STEP, f, t + STEP);
      sim.take();
    }
    return sim;
  }

  it('scores within 22 s of a 40 s session in a first session, on both bands, in all three layouts', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1280, 800]] as const) {
      for (const eeg of [false, true]) {
        for (let seed = 1; seed <= 12; seed++) {
          const sim = smoke({ seed, eeg, daySeed: seed * 31 }, w, h);
          expect(sim.score, `${w}×${h} eeg ${eeg} seed ${seed}`).toBeGreaterThan(0);
          expect(sim.result().score).toBe(sim.score);
        }
      }
    }
  });

  it('makes the first pair within 3 s: the tap sends the anchor sheep, Space its mate', () => {
    const sim = makeSim({ planned: 40, tuning: BEGINNER });
    const sheep = sim.beastAt(ANCHOR.x, ANCHOR.y)!;
    sim.send(sheep.id);
    sim.keySend();
    const mate = sim.hold.beasts.find(b => b !== sheep && b.kind === 'sheep')!;
    expect(mate.state).toBe('out');
    drive(sim, 3, frame());
    expect(sim.score).toBe(1);
  });

  it('keeps scoring for a returning player too, any tap rhythm', () => {
    for (const every of [0.65, 0.66, 0.7]) {
      for (let seed = 1; seed <= 10; seed++) {
        const sim = smoke({ seed, progress: { sessions: 7, giftDay: DAY, dailyDay: DAY, evenings: 6 } }, 390, 844, every);
        expect(sim.score, `every ${every} seed ${seed}`).toBeGreaterThan(1);
      }
    }
  });
});

export { quiet, makeSim, drive, setDeck, frame, ofType, settleMoves, FOCUS, REST, FOG, STEP, DAY, TUNING, BEGINNER };
export type { Hold };
