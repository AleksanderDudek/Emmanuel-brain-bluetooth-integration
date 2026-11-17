import { describe, expect, it } from 'vitest';
import { ALL_PASSAGES, LINE_COUNT, MOMENTS, PAIRS, PAIR_IDS, lineKey, pairTitle, pairVerse, taskFor } from '../src/arcade/rozswietl/content';
import { CATALOGS, t, unit } from '../src/arcade/rozswietl/i18n';
import {
  addOwn, albumCount, bestOf, choosePicture, dayPair, freshProgress, leastPair, migrate, recordPicture, removeOwn, tilesFor,
  type RozProgress,
} from '../src/arcade/rozswietl/meta';
import { RULES } from '../src/arcade/rozswietl/rules';
import { RozSim, finaleFor, planBlocks, type SimEvent } from '../src/arcade/rozswietl/sim';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_TAP, MIN_TEXT, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import { coachText, howto } from '../src/arcade/rozswietl/index';
import { cardBox, cardButton, flySpot, frameFor, layout, tapTargets } from '../src/arcade/rozswietl/layout';
import { breakPlan, breakStagger, pieceCount } from '../src/arcade/rozswietl/break';
import { NowLine, nowKind } from '../src/arcade/rozswietl/now';
import { Talk, readSec } from '../src/arcade/rozswietl/talk';
import { font, fontPx } from '../src/arcade/rozswietl/paint';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const DAY = '2026-11-12';
const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
/** at the threshold, focus held (≥ RULES.focusHold s): the light breaks tiles */
const HELD = frame({ level: 0.55, activity: 2.5, focused: true, hold: 4, calm: 0.35 });
const LOW = frame({ level: 0.15, activity: -1, focused: false, hold: 0, calm: 0.7 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.95 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['story.open', 'coach.aim', 'coach.knock', 'coach.halo', 'coach.chain', 'coach.rest', 'coach.gold', 'coach.flare', 'coach.drag', 'coach.blind'];

type SimOpts = { progress?: Partial<RozProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; aspect?: number; daySeed?: number };

function makeSim(o: SimOpts = {}): RozSim {
  const sim = new RozSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: DAY, daySeed: o.daySeed ?? 3,
    plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, aspect: o.aspect ?? 1,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card), the day's picture already seen. */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], lastDay: DAY, ...o.progress } });

function drive(sim: RozSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run until the block of a kind starts (returns the clock). */
function until(sim: RozSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }): { t: number } {
  let guard = 0;
  while ((sim.block.kind !== kind || sim.phase !== 'play') && guard++ < 4000) drive(sim, 0.25, f, clock);
  return clock;
}

/** The centre of the mosaic (its own units). */
const centre = (sim: RozSim) => ({ x: sim.pic.mosaic.w / 2, y: sim.pic.mosaic.h / 2 });

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates light and gazing, ending on gazing', () => {
    for (const planned of [180, 300, 600]) {
      const plan = planBlocks(planned, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest.at(-1)!.kind).toBe('rest');
      expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(planned - finaleFor(planned), 5);
      for (const b of rest) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 75]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
        for (const b of plan) expect(b.dur).toBeGreaterThan(0);
      }
      const sim = makeSim({ planned, progress: { sessions: 2, seen: [...ALL_SEEN] } });
      drive(sim, planned + 5, MID);
      expect(sim.phase).toBe('done');
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    drive(sim, sim.block.dur - 2, MID);
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
    expect(blinds.filter(Boolean).length).toBe(1);
  });

  it('asks for the picture’s own imagery, in turn with counting and recalling, never the same twice in a row', () => {
    for (const id of PAIR_IDS) {
      const seen: string[] = [];
      for (let n = 0; n < 12; n++) seen.push(taskFor('push', id, n));
      for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
      expect(seen).toContain(t(`pair.${id}.push1` as never));
      expect(seen).toContain(t('task.push.count'));
      const rests = Array.from({ length: 8 }, (_, n) => taskFor('rest', id, n));
      for (let i = 1; i < rests.length; i++) expect(rests[i]).not.toBe(rests[i - 1]);
    }
    const sim = later();
    expect(sim.task.length).toBeGreaterThan(10);
  });
});

describe('the light', () => {
  it('without held focus the light only cracks: the aimed tile stops at the cap, nothing bursts (the founder, 2026-11-17)', () => {
    for (const f of [NONE, LOW, MID]) {
      const sim = later();
      const clock = { t: 0 };
      const evs = drive(sim, 24, f, clock, t => { if (Math.abs(t % 1.3) < STEP / 2) sim.tap(centre(sim)); });
      expect(ofType(evs, 'burst')).toHaveLength(0);
      expect(sim.score).toBe(0);
      expect(Math.max(...sim.pic.tiles.map(x => x.press))).toBeLessThanOrEqual(RULES.baseCap + 1e-9);
      expect(ofType(evs, 'crack').length).toBeGreaterThan(0);          // the cracks grow: the light is there
    }
    // the firefly says what breaks it (once a picture)
    const sim = later();
    drive(sim, 24, LOW);
    expect(sim.talk.said.some(l => [1, 2, 3].some(i => l === t(`say.cap.${i}` as never)))).toBe(true);
    // held focus breaks the same tiles
    const held = later();
    const evs = drive(held, 24, HELD);
    expect(ofType(evs, 'burst').length).toBeGreaterThan(0);
    expect(held.score).toBe(ofType(evs, 'burst').reduce((a, b) => a + b.shards, 0));
  });

  it('knocks crack but never break, even in held focus; a rest’s reserve only cracks', () => {
    const sim = later();
    const c = centre(sim);
    for (let i = 0; i < 40; i++) sim.tap(c);
    expect(sim.pic.tiles.every(x => !x.open)).toBe(true);
    expect(Math.max(...sim.pic.tiles.map(x => x.press))).toBeLessThanOrEqual(RULES.baseCap + 1e-9);
  });

  it('presses faster with focus in a sighted push past its lead-in: ×1.57 at the threshold, ×3 at full', () => {
    const sim = later();
    expect(sim.mult(0.2)).toBe(1);
    expect(sim.mult(0.5)).toBeCloseTo(1 + 2 * (0.2 / 0.7), 5);
    expect(sim.mult(1)).toBe(3);
    const a = later({ seed: 5 }), b = later({ seed: 5 });
    const ea = drive(a, 24, HIGH), eb = drive(b, 24, LOW);
    expect(ofType(ea, 'burst').length).toBeGreaterThan(ofType(eb, 'burst').length);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it('waits out the lead-in: the gauge is empty for the first 5 s (Mendi), 2 s (HALO)', () => {
    const sim = later();
    drive(sim, 3, HIGH);
    expect(sim.meter()).toBeNull();
    expect(sim.lightOn).toBe(false);
    drive(sim, 3, HIGH);
    expect(sim.lightOn).toBe(true);
    expect(sim.meter()).toBeGreaterThan(0.6);
    const eeg = later({ eeg: true });
    drive(eeg, 2.5, HIGH);
    expect(eeg.lightOn).toBe(true);
  });

  it('widens the halo with focus (its threshold ring at the middle) and spills light onto the neighbours', () => {
    const sim = later({ progress: { sessions: 9 } });
    drive(sim, 6, HIGH);
    expect(sim.haloR).toBeGreaterThan(sim.haloAt(0.5));
    const aim = sim.aim;
    const before = sim.pic.tiles.map(x => x.press);
    drive(sim, 1, HIGH);
    const pressed = sim.pic.tiles.filter((x, i) => i !== aim && !x.open && x.press > before[i]).length;
    expect(pressed).toBeGreaterThan(0);
  });

  it('freezes at neutral without a signal: ×1, no gauge, never a loss', () => {
    const sim = later();
    drive(sim, 8, HIGH);
    const light = sim.light;
    drive(sim, 3, NONE);
    expect(sim.lightOn).toBe(false);
    expect(sim.meter()).toBeNull();
    expect(sim.light).toBeCloseTo(light, 5);
    const tiles = sim.pic.tiles.map(x => x.press);
    drive(sim, 1, NONE);
    sim.pic.tiles.forEach((x, i) => expect(x.press).toBeGreaterThanOrEqual(tiles[i] - 1e-9));
  });

  it('aims at the tapped tile and knocks it (less when knocks come quickly); untouched the light finds the most cracked tile', () => {
    const sim = later();
    drive(sim, 0.5, NONE);
    const target = sim.pic.mosaic.cells.find(c => c.id !== sim.aim && c.ring > 0.3)!;
    sim.tap({ x: target.cx, y: target.cy });
    const evs = sim.take();
    expect(sim.aim).toBe(target.id);
    expect(ofType(evs, 'aim')[0].by).toBe('tap');
    const k1 = ofType(evs, 'knock')[0];
    expect(k1.power).toBe(1);
    sim.tap({ x: target.cx, y: target.cy });
    const k2 = ofType(sim.take(), 'knock')[0];
    expect(k2.power).toBeLessThan(1);
    expect(sim.pic.tiles[target.id].press).toBeGreaterThan(0);
    // a drag moves the light without knocking
    const other = sim.pic.mosaic.cells.find(c => c.id !== target.id && !sim.pic.tiles[c.id].open)!;
    sim.drag({ x: other.cx, y: other.cy });
    const ed = sim.take();
    expect(sim.aim).toBe(other.id);
    expect(ofType(ed, 'knock')).toHaveLength(0);
  });

  it('a centre tap aims the centre tile (the smoke contract)', () => {
    const sim = later();
    drive(sim, 2, MID);
    sim.tap(centre(sim));
    const c = sim.pic.mosaic.cells[sim.aim];
    const d = Math.hypot(c.cx - sim.pic.mosaic.w / 2, c.cy - sim.pic.mosaic.h / 2);
    expect(d).toBeLessThan(sim.pic.meanR * 2.2);
  });

  it('bursts pass light to the neighbours: chains of two and more, counted once at their end', () => {
    let longest = 0;
    for (let seed = 1; seed <= 6 && longest < 2; seed++) {
      const sim = later({ seed, progress: { sessions: 11 } });
      const evs = drive(sim, 26, HIGH);
      for (const c of ofType(evs, 'chain')) longest = Math.max(longest, c.n);
    }
    expect(longest).toBeGreaterThanOrEqual(2);
  });

  it('fills the flare from a held focus; a tap releases its wave and the bursts after it count double', () => {
    const sim = later({ progress: { sessions: 11 } });
    const clock = { t: 0 };
    let ready = false;
    drive(sim, 25, HIGH, clock, () => { if (sim.flareReady) ready = true; });
    expect(ready || sim.flares > 0).toBe(true);
    // force one if the chains took the picture away first
    if (!sim.flareReady) {
      sim.flare = 0.999;
      until(sim, 'push', HIGH, clock);
      drive(sim, 7, HIGH, clock);
    }
    if (sim.flareReady && sim.pic.state === 'play') {
      const flares = sim.flares;
      sim.tap(centre(sim));
      const evs = [...sim.take(), ...drive(sim, 1.2, HIGH, clock)];
      expect(sim.flares).toBe(flares + 1);
      expect(ofType(evs, 'flare')).toHaveLength(1);
      expect(ofType(evs, 'burst').some(b => b.double)).toBe(true);
    }
  });

  it('charges the flare only in held focus, drains it when the focus breaks, and never lets it go without focus', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 6, HIGH, clock);                                   // past the lead-in
    const short = frame({ level: 0.7, activity: 4, focused: true, hold: 1, calm: 0.1 });
    const f0 = sim.flare;
    drive(sim, 4, short, clock);                                  // focused, but not held 1.5 s yet: no charge
    expect(sim.flare).toBeCloseTo(f0, 6);
    drive(sim, 6, HIGH, clock);
    const charged = sim.flare;
    expect(charged).toBeGreaterThan(0.4);
    drive(sim, 3, LOW, clock);                                    // the focus breaks: it drains a little
    expect(sim.flare).toBeLessThan(charged);
    expect(sim.flare).toBeGreaterThan(charged - 0.15);
    // ready: without held focus a tap does not release it — the firefly says it waits
    const ready = later();
    const c2 = { t: 0 };
    drive(ready, 6, HIGH, c2);
    ready.flare = 0.9999;
    drive(ready, 0.1, HIGH, c2);
    expect(ready.flareReady).toBe(true);
    const flares = ready.flares;
    let evs = drive(ready, 8, LOW, c2, t => { if (Math.abs(t % 1) < STEP / 2) ready.tap(centre(ready)); });
    expect(ready.flares).toBe(flares);
    expect(ready.flareReady).toBe(true);
    expect(ready.flareWaiting).toBe(true);
    expect(ofType(evs, 'flareWait').length).toBeGreaterThan(0);
    // back in held focus: it goes off by itself after RULES.flareAuto s
    evs = drive(ready, RULES.flareAuto + 0.5, HIGH, c2);
    expect(ofType(evs, 'flare')).toHaveLength(1);
  });

  it('bursts only a few tiles with one wave (never most of a small picture), cracking the ones around', () => {
    for (const sessions of [1, 5, 30]) {
      const sim = later({ progress: { sessions } });
      const clock = { t: 0 };
      drive(sim, 6, HIGH, clock);
      for (const tl of sim.pic.tiles) tl.press = 0.6;           // cracked by earlier focus: the limit is the wave's own
      sim.flare = 0.9999;
      drive(sim, 0.1, HIGH, clock);
      const open0 = sim.pic.open;
      sim.tap(centre(sim));
      const evs = drive(sim, 1, frame({ ...HIGH, level: 0.3, focused: false, hold: 0 }), clock);
      const direct = ofType(evs, 'burst').filter(b => b.depth === 0).length;
      expect(direct).toBeLessThanOrEqual(sim.waveBursts());
      expect(sim.waveBursts()).toBeLessThanOrEqual(Math.max(2, Math.round(sim.pic.tiles.length * 0.12)));
      expect(sim.pic.open - open0).toBeLessThanOrEqual(sim.waveBursts());   // and no chain runs on from it
      expect(ofType(evs, 'crack').length + direct).toBeGreaterThan(direct);
    }
  });

  it('a ready flare goes by itself after a while', () => {
    const sim = later();
    drive(sim, 6, HIGH);
    sim.flare = 0.9999;
    const evs = drive(sim, RULES.flareAuto + 2, HIGH);
    expect(ofType(evs, 'flareReady').length + ofType(evs, 'flare').length).toBeGreaterThanOrEqual(1);
  });
});

describe('gazing (rest)', () => {
  it('lays gold in the seams of the uncovered pieces, faster with calm, and warms them', () => {
    const run = (f: FocusFrame) => {
      const sim = later({ seed: 2, progress: { sessions: 11 } });
      const clock = { t: 0 };
      drive(sim, sim.block.dur - 0.1, HELD, clock);
      until(sim, 'rest', HELD, clock);
      drive(sim, 18, f, clock);
      return sim;
    };
    const calm = run(CALM), none = run(NONE);
    expect(calm.pic.open).toBeGreaterThan(0);
    expect(calm.goldShare()).toBeGreaterThan(none.goldShare());
    expect(none.goldShare()).toBeGreaterThan(0);
    expect(calm.pic.tiles.filter(x => x.open).every(x => x.warm > 0)).toBe(true);
    expect(calm.meter()).toBeGreaterThan(0.6);
  });

  it('does not press the dark tiles while gazing; a tap on an uncovered piece gilds it', () => {
    const sim = later({ seed: 3, progress: { sessions: 11 } });
    const clock = { t: 0 };
    drive(sim, sim.block.dur - 0.1, MID, clock);
    until(sim, 'rest', MID, clock);
    drive(sim, 0.5, CALM, clock);
    const press = sim.pic.tiles.map(x => x.press);
    drive(sim, 4, CALM, clock);
    sim.pic.tiles.forEach((x, i) => { if (!x.open) expect(x.press).toBeCloseTo(press[i], 6); });
    const open = sim.pic.tiles.findIndex(x => x.open);
    if (open >= 0) {
      const c = sim.pic.mosaic.cells[open];
      sim.tap({ x: c.cx, y: c.cy });
      expect(ofType(sim.take(), 'gild')).toHaveLength(1);
    }
  });

  it('makes a dark tile touching gold crack faster (gold carries the light)', () => {
    const sim = later();
    drive(sim, 1, MID);
    const pic = sim.pic;
    const j = pic.mosaic.cells.findIndex(c => c.neighbors.length > 2);
    expect(sim.goldMult(j)).toBe(1);
    for (const s of pic.seamsOf[j]) pic.seams[s].gold = 1;
    expect(sim.goldMult(j)).toBeCloseTo(1 + RULES.goldPull, 5);
  });

  it('banks a little light when nothing is uncovered yet, and lands it at the next push', () => {
    const sim = later({ seed: 4, planned: 300 });
    const clock = { t: 0 };
    // no light reaches the tiles: hold the picture dark by making every tile's need huge
    for (const tl of sim.pic.tiles) tl.need = 1e6;
    until(sim, 'rest', NONE, clock);
    drive(sim, 15, CALM, clock);
    const evs: SimEvent[] = [];
    let guard = 0;
    while (sim.block.kind !== 'push' && guard++ < 400) evs.push(...drive(sim, 0.25, CALM, clock));
    expect(ofType(evs, 'reserve').length).toBe(1);
  });

  it('breathes in for 4 and out for 6 in a rest block', () => {
    const sim = later();
    const clock = { t: 0 };
    until(sim, 'rest', MID, clock);
    drive(sim, 2, CALM, clock);
    expect(sim.breath()!.inhale).toBe(true);
    drive(sim, 3, CALM, clock);
    expect(sim.breath()!.inhale).toBe(false);
  });
});

describe('by feel (blind push)', () => {
  it('hides the gauge, keeps the base light, and releases the hidden light at the end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    let guard = 0;
    while (!(sim.block.kind === 'push' && sim.block.blind) && guard++ < 50) drive(sim, sim.block.dur + 0.05, MID, clock);
    expect(sim.blind).toBe(true);
    drive(sim, 8, HIGH, clock);
    expect(sim.meter()).toBeNull();
    expect(sim.lightOn).toBe(false);
    const evs = drive(sim, sim.block.dur, HIGH, clock);
    const reveal = ofType(evs, 'reveal');
    expect(reveal).toHaveLength(1);
    expect(reveal[0].share).toBeGreaterThan(0.5);
    expect(sim.blindShare).toBeGreaterThan(50);
  });
});

describe('pictures', () => {
  it('transforms a picture: the last tiles in a chain, the bloom, its card and verse, then the next pair', () => {
    const sim = later({ seed: 7 });
    const first = sim.pic.src;
    sim.take();
    const clock = { t: 0 };
    const evs = drive(sim, 140, t => (Math.floor(t / 20) % 2 ? MID : HIGH), clock, () => { if (sim.story && sim.story.t > 1.3) sim.tapCard(); });
    const done = ofType(evs, 'done');
    expect(done.length).toBeGreaterThanOrEqual(1);
    expect(done[0].src).toEqual(first);
    expect(ofType(evs, 'finishing').length).toBeGreaterThanOrEqual(1);
    expect(ofType(evs, 'story').some(s => s.kind === 'done')).toBe(true);
    const pics = ofType(evs, 'picture');
    expect(pics.length).toBeGreaterThanOrEqual(1);
    expect(pics[0].src).not.toEqual(first);
    expect(sim.p.album[first.id].n).toBe(1);
    expect(sim.p.pictures).toBe(done.length);
  });

  it('cuts the picture again when the frame turns (a phone rotated), keeping what was uncovered', () => {
    const sim = later({ progress: { sessions: 9 }, aspect: 0.8, seed: 3 });
    const clock = { t: 0 };
    drive(sim, 14, MID, clock);
    let guard = 0;
    while ((sim.pic.state !== 'play' || sim.pic.open < 2) && guard++ < 60) drive(sim, 0.5, MID, clock);
    const share = sim.pic.open / sim.pic.tiles.length;
    const n = sim.pic.tiles.length;
    let ok = false;
    for (let i = 0; i < 20 && !ok; i++) {
      ok = sim.refit(1.9);
      if (!ok) drive(sim, 0.2, MID, clock);
    }
    expect(ok).toBe(true);
    expect(sim.pic.mosaic.w / sim.pic.mosaic.h).toBeCloseTo(1.9, 1);
    expect(sim.pic.tiles.length).toBe(n);
    expect(sim.pic.ver).toBe(1);
    expect(Math.abs(sim.pic.open / n - share)).toBeLessThan(0.3);
    expect(sim.pic.tiles[sim.aim].open).toBe(false);
    expect(sim.refit(1.95)).toBe(false);
    const before = sim.score;
    drive(sim, 12, HIGH, clock);
    expect(sim.score).toBeGreaterThan(before);
  });

  it('grows the mosaics with the sessions (Auto): 16 tiles first, 72 from the tenth session (the founder: more pieces)', () => {
    expect(RULES.tiles).toEqual([16, 20, 24, 28, 32, 40, 48, 56, 64, 72]);
    expect(tilesFor(0, 0)).toBe(16);
    expect(tilesFor(1, 0)).toBe(20);
    expect(tilesFor(3, 0)).toBe(28);
    expect(tilesFor(6, 0)).toBe(48);
    expect(tilesFor(9, 0)).toBe(72);
    expect(tilesFor(40, 0)).toBe(72);
    // a session's 2nd and 3rd picture a few more
    expect(tilesFor(1, 1)).toBe(24);
    expect(tilesFor(0, 2)).toBe(24);
    expect(tilesFor(40, 2)).toBe(80);
    expect(tilesFor(40, 9)).toBeLessThanOrEqual(RULES.tilesMax);
    // every step of Auto is at least twice what it was before 2026-11-17 at the start, never fewer later
    const old = [7, 9, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
    old.forEach((n, i) => expect(tilesFor(i, 0), `session ${i + 1}`).toBeGreaterThanOrEqual(2 * n));
    expect(makeSim().pic.tiles.length).toBe(16);
    expect(later({ progress: { sessions: 30 } }).pic.tiles.length).toBe(72);
  });

  it('lets the player choose the pieces: a fixed count for every picture, or Auto', () => {
    for (const n of RULES.tileChoices) {
      if (!n) continue;
      expect(tilesFor(0, 0, n)).toBe(n);
      expect(tilesFor(30, 2, n)).toBe(n);
      expect(later({ progress: { tilesPick: n } }).pic.tiles.length).toBe(n);
    }
    expect(RULES.tileChoices).toEqual([0, 16, 24, 32, 48, 64, 96]);
    expect(tilesFor(3, 0, 0)).toBe(tilesFor(3, 0));
    expect(tilesFor(3, 0, 13)).toBe(tilesFor(3, 0));                 // not a choice: Auto
    const saved = (tilesPick: unknown) => migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 2, tilesPick }) as RozProgress).tilesPick;
    // a current choice stays; the old card's 8 and 12 become its smallest (16); anything else is Auto
    for (const n of [16, 24, 32, 48, 64, 96]) expect(saved(n), String(n)).toBe(n);
    expect(saved(8)).toBe(16);
    expect(saved(12)).toBe(16);
    expect(saved(0)).toBe(0);
    for (const bad of [999, 36, 13, -16, '24', null, 7.5]) expect(saved(bad), String(bad)).toBe(0);
    // idempotent: a migrated 8 stays 16
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 2, tilesPick: 8 }) as RozProgress;
    expect(migrate(migrate(p)).tilesPick).toBe(16);
    expect(later({ progress: { tilesPick: 96 } }).pic.tiles.length).toBe(96);
  });

  it('keeps every tile’s need near one and the picture’s pace sensible (1.5–2.5 min of base light)', () => {
    for (const s of [0, 3, 30]) {
      const sim = later({ progress: { sessions: s } });
      const needs = sim.pic.tiles.map(x => x.need);
      const mean = needs.reduce((a, b) => a + b, 0) / needs.length;
      expect(mean).toBeGreaterThan(0.8);
      expect(mean).toBeLessThan(1.2);
      const total = sim.pic.perTile * sim.pic.tiles.length;
      expect(total).toBeGreaterThanOrEqual(90);
      expect(total).toBeLessThanOrEqual(160);
    }
  });

  it('starts each day with the day’s picture (the same for everyone), then the pair transformed least', () => {
    const p = freshProgress();
    const first = choosePicture(p, { day: DAY, daySeed: 5, ownReady: [], index: 0, prev: null });
    expect(first).toEqual({ kind: 'pair', id: dayPair(5) });
    expect(p.lastDay).toBe(DAY);
    const second = choosePicture(p, { day: DAY, daySeed: 5, ownReady: [], index: 1, prev: first });
    expect(second.id).not.toBe(first.id);
    recordPicture(p, second, 40, DAY, 5);
    const third = choosePicture(p, { day: DAY, daySeed: 5, ownReady: [], index: 2, prev: second });
    expect(third.id).not.toBe(second.id);
    expect(p.album[second.id].n).toBe(1);
  });

  it('takes the lobby’s pick first, and own pictures in turn ("both") or only ("own")', () => {
    const p = freshProgress();
    p.lastDay = DAY;
    addOwn(p, { id: 'own-a', after: 'img-a', before: null, label: 'Dom', added: 1 });
    p.pick = 'burza';
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: ['own-a'], index: 0, prev: null })).toEqual({ kind: 'pair', id: 'burza' });
    expect(p.pick).toBeNull();
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: ['own-a'], index: 1, prev: null })).toEqual({ kind: 'own', id: 'own-a' });
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: ['own-a'], index: 2, prev: null }).kind).toBe('pair');
    // not ready (its pictures not loaded): a pair instead
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: [], index: 1, prev: null }).kind).toBe('pair');
    p.source = 'own';
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: ['own-a'], index: 2, prev: null }).kind).toBe('own');
    p.source = 'builtin';
    expect(choosePicture(p, { day: DAY, daySeed: 1, ownReady: ['own-a'], index: 1, prev: null }).kind).toBe('pair');
    expect(removeOwn(p, 'own-a')?.id).toBe('own-a');
    expect(p.own).toHaveLength(0);
  });

  it('fills the album toward all eight', () => {
    const p = freshProgress();
    p.lastDay = DAY;
    const seen = new Set<string>();
    let prev = null;
    for (let i = 0; i < 8; i++) {
      const s = choosePicture(p, { day: DAY, daySeed: 1, ownReady: [], index: i, prev });
      recordPicture(p, s, 10, DAY, 1);
      seen.add(s.id);
      prev = s;
    }
    expect(seen.size).toBe(8);
    expect(albumCount(p)).toBe(8);
    expect(leastPair(p)).toBeTruthy();
  });

  it('records the day’s picture and the best gold with Math.max', () => {
    const p = freshProgress();
    recordPicture(p, { kind: 'pair', id: dayPair(9) }, 30, DAY, 9);
    recordPicture(p, { kind: 'pair', id: dayPair(9) }, 12, DAY, 9);
    expect(p.dayDone).toBe(DAY);
    expect(p.album[dayPair(9)]).toEqual({ n: 2, gold: 30, first: DAY, last: DAY });
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a 40 s first session, a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER, planned: 40 });
    let next = 0.65, space = 2;
    const clock = { t: 0 };
    drive(sim, 22, HIGH, clock, t => {
      if (t >= next) {
        next += 0.65;
        sim.tap(centre(sim));
      }
      if (t >= space) {
        space += 2;
        sim.space();
      }
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(sim.tilesBroken).toBeGreaterThanOrEqual(2);
  });

  it('scores within 22 s of held focus once the opening card is closed (it waits for the player, never time)', () => {
    const idle = makeSim({ planned: 40 });
    drive(idle, 22, HIGH);
    expect(idle.story?.kind).toBe('open');                         // no tap: the card still waits, the light rests
    expect(idle.score).toBe(0);
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 1.5, HIGH, clock);
    sim.space();                                                    // Enter or Space (or a tap on it) after its first moment
    expect(sim.story).toBeNull();
    drive(sim, 20.5, HIGH, clock);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('opens the first session with the story card and the root verse, and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story?.kind).toBe('open');
    expect(sim.story?.verse).toBe('isa60.1');
    expect(sim.block.kind).toBe('warmup');
    const clock = { t: 0 };
    const evs = drive(sim, 70, MID, clock, t => {
      if (sim.story && sim.story.t > 1.3) sim.tapCard();
      const c = sim.pic.mosaic.cells[sim.aim];
      if (Math.abs(t - 12) < STEP / 2 || Math.abs(t - 12.8) < STEP / 2) sim.tap({ x: c.cx, y: c.cy });
    });
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('aim');
    expect(coach).toContain('knock');
    expect(coach).toContain('rest');
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later({ progress: { best: 3 } });
    drive(sim, 30, HIGH);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best).toBe(Math.max(3, a.score));
    expect(a.record).toBe(a.score > 3);
    const shards = sim.p.shards;
    sim.result();
    expect(sim.p.shards).toBe(shards);
  });

  it('settles once at the end (or early)', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, MID);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    const early = later({ planned: 300 });
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('closes with a passage that exists in all four editions, fitting what happened', () => {
    for (const id of ALL_PASSAGES) for (const l of ['pl', 'en', 'de', 'sv'] as const) expect(passage(id, l).text.length, `${id} ${l}`).toBeGreaterThan(10);
    const sim = later();
    drive(sim, 20, HIGH);
    const r = sim.result();
    expect(r.verse).toBeTruthy();
    expect(ALL_PASSAGES).toContain(r.verse!);
    expect(pairVerse('smutek', 1)).toBe('psa30.5');
    expect(pairVerse('smutek', 2)).toBe('mat5.4');
    expect(pairVerse('dlugi', 2)).toBe('php4.19');
    for (const id of PAIR_IDS) expect(PAIRS[id].verses.length).toBeGreaterThan(0);
  });

  it('says what the headline means and keeps the stats readable', () => {
    const sim = later();
    drive(sim, 20, HIGH);
    const r = sim.result();
    expect(r.unit).toBe(unit(r.score));
    expect(r.stats.length).toBeGreaterThanOrEqual(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
  });

  it('keeps a session never ending early and the voice off the banners and telegraphs', () => {
    const sim = later({ planned: 120 });
    const clock = { t: 0 };
    drive(sim, 60, MID, clock, () => {
      if (sim.talk.line && sim.phase === 'play' && sim.blockIndex > 0) {
        expect(sim.blockT >= RULES.bannerSec - 0.05 || sim.talk.line.t < 0.05).toBe(true);
      }
    });
    expect(sim.phase).toBe('play');
    expect(sim.talk.said.length).toBeGreaterThan(1);
  });

  it('paces a week of 5-minute sessions sensibly: pictures done, the tiles grow, the album fills', () => {
    let p = freshProgress();
    const per: number[] = [];
    for (let s = 0; s < 7; s++) {
      const sim = new RozSim({ progress: p, rng: mulberry32(11 + s), day: `2026-11-${12 + s}`, daySeed: s * 7 + 1, plannedSec: 300, eeg: false, tuning: TUNING, aspect: 0.95 });
      sim.start();
      const clock = { t: 0 };
      let tap = 1;
      drive(sim, 304, t => (Math.floor(t / 13) % 2 ? MID : HIGH), clock, tt => {
        if (sim.story && sim.story.t > 1.3) sim.tapCard();
        if (tt >= tap) {
          tap += 2.5;
          sim.tap(centre(sim));
        }
      });
      sim.result();
      p = sim.p;
      per.push(sim.picturesDone);
    }
    expect(per[0]).toBeGreaterThanOrEqual(1);
    for (const n of per) expect(n).toBeLessThanOrEqual(6);
    expect(per.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(7);
    expect(p.sessions).toBe(7);
    expect(albumCount(p)).toBeGreaterThanOrEqual(5);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as RozProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.album).toEqual({});
    expect(migrate(p)).toBe(p);
    const sim = new RozSim({ progress: p, rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 120, eeg: true, tuning: TUNING, aspect: 1.4 });
    sim.start();
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
    expect(sim.pic.tiles.length).toBe(tilesFor(4, 0));
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, pictures: 'x', shards: 2400, best: 310, bestChain: 7, flares: -3, goldSeams: 40,
      album: { samotnosc: { n: 3, gold: 64, first: '2026-11-01', last: '2026-11-10' }, lek: { n: 0 }, junk: 'x', burza: { n: 2, gold: 400, first: 'yesterday' } },
      own: [{ id: 'own-a', after: 'img-a', before: 'img-b', label: 'Dom', added: 5 }, { id: 'own-b' }, 'junk', { id: 'own-a', after: 'dup' }],
      source: 'mine', pick: 'nope', lastDay: 12, dayDone: '2026-11-11', next: 3.7, seen: ['coach.aim', 4],
    };
    const p = mergeSaved(freshProgress(), saved) as RozProgress;
    migrate(p);
    expect(p.pictures).toBe(0);
    expect(p.flares).toBe(0);
    expect(p.album.samotnosc).toEqual({ n: 3, gold: 64, first: '2026-11-01', last: '2026-11-10' });
    expect(p.album.lek).toBeUndefined();
    expect(p.album.burza).toEqual({ n: 2, gold: 100, first: '', last: '' });
    expect(p.own.map(o => o.id)).toEqual(['own-a']);
    expect(p.own[0].before).toBe('img-b');
    expect(p.source).toBe('both');
    expect(p.pick).toBeNull();
    expect(p.lastDay).toBe('');
    expect(p.next).toBe(3);
    expect(p.seen).toEqual(['coach.aim']);
    expect(bestOf(p)).toBe(310);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, album: 'x', own: 5, seen: null, best: [] }]) {
      const p = mergeSaved(freshProgress(), junk) as RozProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.own)).toBe(true);
      expect(typeof p.album).toBe('object');
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the firefly at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) for (let i = 0; i < LINE_COUNT; i++) expect(t(lineKey(m, i)), `${m}.${i}`).not.toMatch(/^say\./);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if ((k.startsWith('say.') || k.endsWith('.reveal')) && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('suggests strategies, never to concentrate harder', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(task|howto|pair\.\w+\.(push|rest))/.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('carries the help line exactly, small but whole, in all four languages', () => {
    const plain = (l: 'pl' | 'en' | 'de' | 'sv') => (CATALOGS[l]['panel.help'] as string).replace(/ /g, ' ');
    expect(plain('pl')).toBe('Gra wspiera wyobraźnię, ale nie leczy depresji. Gdy jest Ci bardzo ciężko, porozmawiaj z kimś: 116 123 (dorośli) albo 116 111 (dzieci i młodzież) — bezpłatnie; w nagłej sytuacji 112.');
    expect(plain('en')).toBe('The game supports your imagination; it does not treat depression. If things feel very heavy, talk to someone: Samaritans 116 123 (UK and Ireland), 988 (US), findahelpline.com elsewhere; in an emergency, your local emergency number.');
    expect(plain('de')).toBe('Das Spiel stärkt die Vorstellungskraft, behandelt aber keine Depression. Wenn es dir sehr schwer geht, sprich mit jemandem: TelefonSeelsorge 0800 111 0 111 oder 0800 111 0 222 (kostenlos, rund um die Uhr); im Notfall 112.');
    expect(plain('sv')).toBe('Spelet stödjer föreställningsförmågan men behandlar inte depression. Om du mår mycket dåligt, prata med någon: Självmordslinjen 90101 (dygnet runt); i nödsituation 112.');
  });

  it('names sadness, never depression, in the game’s own words (the help line apart)', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (k === 'panel.help' || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/depres/i);
      }
    }
  });

  it('bends the headline’s unit and titles the pairs', () => {
    expect(unit(1)).toBe('odłamek');
    expect(unit(3)).toBe('odłamki');
    expect(unit(5)).toBe('odłamków');
    expect(unit(22)).toBe('odłamki');
    expect(pairTitle('samotnosc')).toBe('Samotność → Wspólnota');
    for (const id of PAIR_IDS) for (const part of ['from', 'to', 'push1', 'push2', 'rest', 'reveal']) expect(t(`pair.${id}.${part}` as never)).not.toMatch(/^pair\./);
  });
});


describe('mobile first (DESIGN §12, §13.7)', () => {
  it('gives the picture the whole band at every checked size, inside the insets and 16 px off a phone’s sides', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      const f = frameFor(L, L.aspect);
      expect(f.x, s.name).toBeGreaterThanOrEqual(s.insets.left + (L.shape === 'wide' ? 0 : 16) - 0.5);
      expect(f.x + f.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - (L.shape === 'wide' ? 0 : 16) + 0.5);
      expect(f.y, s.name).toBeGreaterThanOrEqual(s.insets.top);
      expect(f.y + f.h, s.name).toBeLessThanOrEqual(s.h - s.insets.bottom + 0.5);
      // the picture fills the band: at least 80 % of the room's width or height
      expect(Math.max(f.w / L.room.w, f.h / L.room.h), s.name).toBeGreaterThan(0.99);
      expect(f.w * f.h, s.name).toBeGreaterThan(0.6 * (s.w - s.insets.left - s.insets.right) * (s.h - s.insets.top - s.insets.bottom));
    }
  });

  it('keeps a turned phone’s picture whole: any aspect fits the room', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      for (const a of [0.72, 1, 1.5, 2.05]) {
        const f = frameFor(L, a);
        expect(f.w / f.h).toBeCloseTo(a, 1);
        expect(f.x).toBeGreaterThanOrEqual(L.room.x - 0.5);
        expect(f.y + f.h).toBeLessThanOrEqual(L.room.y + L.room.h + 0.5);
      }
    }
  });

  it('lists only a waiting card’s button as a target: finger-sized, inside the card and the insets, at every checked size', () => {
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        const f = frameFor(L, L.aspect);
        expect(tapTargets(null)).toEqual([]);
        for (const kind of ['open', 'done'] as const) {
          const box = cardBox(L, f, kind), btn = cardButton(L, box);
          const tg = tapTargets(btn);
          expect(tg, `${s.name} ${kind}`).toHaveLength(1);
          expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name} ${kind}`).toEqual([]);
          expect(btn.h, `${s.name} ${kind}`).toBeGreaterThanOrEqual(MIN_TAP);
          expect(btn.w, `${s.name} ${kind}`).toBeGreaterThanOrEqual(200);
          expect(btn.x).toBeGreaterThanOrEqual(box.x);
          expect(btn.x + btn.w).toBeLessThanOrEqual(box.x + box.w + 0.5);
          expect(btn.y).toBeGreaterThan(box.y + box.h / 2);
          expect(btn.y + btn.h).toBeLessThanOrEqual(box.y + box.h);
          // the bright picture shows above a picture's card
          if (kind === 'done') expect(box.y - f.y, s.name).toBeGreaterThan(f.h * 0.15);
        }
      }
    }
  });

  it('puts the firefly by the frame, its bubble room at least 200 px wide', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets, true);
      const f = frameFor(L, L.aspect);
      const fly = flySpot(L, f);
      expect(fly.y, s.name).toBeLessThanOrEqual(f.y + f.h);
      expect(fly.x, s.name).toBeGreaterThan(s.insets.left);
      expect(fly.bubbleW, s.name).toBeGreaterThanOrEqual(200);
    }
  });

  it('grows on a tablet and a desktop: 1.3 at most below a big screen, up to DESK_MAX on one', () => {
    expect(layout(360, 500, CHECK_SIZES[0].insets).u).toBe(1);
    expect(layout(1280, 800, CHECK_SIZES[8].insets).u).toBeLessThanOrEqual(1.3);
    expect(layout(820, 1052, CHECK_SIZES[6].insets).u).toBeGreaterThan(1);
    for (const s of CHECK_SIZES) {
      const big = Math.min(s.w, s.h) >= DESK_BIG && s.w >= 1024;
      expect(layout(s.w, s.h, s.insets, false).u, s.name).toBeLessThanOrEqual(big ? DESK_MAX : 1.3);
    }
  });

  it('never draws text under 11 px: the font helper has a floor', () => {
    for (const px of [4, 8, 10.4, 11, 13, 20]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(6)).toMatch(/ 11px /);
    expect(font(14)).toMatch(/ 14px /);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    const touch = howto(true), mouse = howto(false);
    expect(touch.hands.some(h => h.gesture === 'keys')).toBe(false);
    expect(mouse.hands.some(h => h.gesture === 'keys')).toBe(true);
    for (const h of touch.hands) expect(h.text).not.toMatch(/Spacj|myszą|klikn/i);
    expect(coachText('flare', true)).not.toMatch(/Spacj/);
    expect(coachText('flare', false)).toMatch(/Spacj/);
    expect(coachText('drag', true)).toMatch(/palcem/);
    expect(touch.tips!.length).toBeLessThanOrEqual(2);
    // a mouse clicks: its how-to, its coach marks and the warm-up's line never say tap
    for (const h of mouse.hands) expect(h.text, h.gesture).not.toMatch(/stuk|palc/i);
    expect(mouse.hands[0].text).toMatch(/^Kliknij/);
    for (const w of ['aim', 'knock', 'flare', 'drag'] as const) {
      expect(coachText(w, false), w).not.toMatch(/stuk|palc/i);
      expect(coachText(w, false), w).toMatch(/klik|spacj|mysz/i);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, string>;
      for (const k of ['howto.click', 'task.warm.mouse', 'coach.aim.keys', 'coach.knock.keys', 'panel.choose.mouse']) expect(c[k], `${l}.${k}`).toMatch(/klik|click|klick/i);
    }
  });
});

describe('a big screen and a mouse (DESIGN §14)', () => {
  const desks = CHECK_SIZES.filter(s => ['desktop', 'big'].includes(screenKind(s.w, s.h, false)));

  it('lays a desktop out for the mouse; a finger keeps its layouts; a big screen’s picture fills its band', () => {
    expect(desks.length).toBeGreaterThanOrEqual(5);
    for (const s of CHECK_SIZES) {
      expect(layout(s.w, s.h, s.insets, true).desk, s.name).toBe(false);
      expect(layout(s.w, s.h, s.insets, false).desk, s.name).toBe(desks.includes(s));
    }
    for (const s of desks.filter(x => Math.min(x.w, x.h) >= DESK_BIG)) {
      const L = layout(s.w, s.h, s.insets, false);
      const f = frameFor(L, L.aspect);
      expect(f.w * f.h, s.name).toBeGreaterThan(0.85 * (L.right - L.left) * (L.bottom - L.top));
      expect(L.u, s.name).toBeGreaterThan(1.3);
      // the card grows with the screen (its words were sized by u)
      expect(cardBox(L, f, 'done').w, s.name).toBeGreaterThan(520 * 1.3);
    }
  });

  it('shows the tile a click would act on (hoverAt), the one a click then aims; nothing over a card', () => {
    const sim = later();
    drive(sim, 0.5, NONE);
    sim.take();
    const target = sim.pic.mosaic.cells.find(c => c.id !== sim.aim && c.ring > 0.3 && !sim.pic.tiles[c.id].open)!;
    const aim = sim.aim;
    expect(sim.hoverAt({ x: target.cx, y: target.cy })).toBe(target.id);
    // only a look: nothing aimed, nothing knocked
    expect(sim.take()).toEqual([]);
    expect(sim.aim).toBe(aim);
    sim.tap({ x: target.cx, y: target.cy });
    expect(sim.aim).toBe(target.id);
    const first = makeSim();
    if (first.story) expect(first.hoverAt({ x: target.cx, y: target.cy })).toBe(-1);
  });
});

/** Run until a picture's card is up (a returning player in held focus, the card's taps never given). */
function toCard(sim: RozSim, clock: { t: number }, f: FocusFrame | ((t: number) => FocusFrame) = HIGH): SimEvent[] {
  const evs: SimEvent[] = [];
  let guard = 0;
  while (sim.story?.kind !== 'done' && guard++ < 2400) evs.push(...drive(sim, 0.25, f, clock));
  return evs;
}

describe('round 11: the founder’s asks (2026-11-17)', () => {
  it('the card waits for the player: no picture ever follows by itself, a tap in its first moment is not taken', () => {
    const sim = later({ planned: 600, seed: 4 });
    const clock = { t: 0 };
    toCard(sim, clock);
    expect(sim.story?.kind).toBe('done');
    expect(sim.pic.state).toBe('bloom');
    // a finger still tapping the last tiles: not taken in the card's first moment
    sim.tapCard();
    sim.space();
    expect(sim.story).not.toBeNull();
    const before = sim.p.pictures;
    // two minutes untouched: the card is still there, no new picture began, nothing pressed
    const evs = drive(sim, 120, HIGH, clock);
    expect(sim.story?.kind).toBe('done');
    expect(ofType(evs, 'picture')).toHaveLength(0);
    expect(ofType(evs, 'burst')).toHaveLength(0);
    expect(sim.p.pictures).toBe(before);
    expect(sim.cardReady).toBe(true);
    // a tap (or Enter, Space) on it: the next mosaic assembles
    expect(sim.tapCard()).toBe(true);
    expect(sim.story).toBeNull();
    const next = drive(sim, 0.5, HIGH, clock);
    expect(ofType(next, 'picture')).toHaveLength(1);
    expect(sim.pic.state).toBe('assemble');
  });

  it('says the place’s line first, read in full, then shows the card', () => {
    const sim = later({ planned: 600, seed: 6 });
    const clock = { t: 0 };
    let doneAt = -1, lineEnd = -1, cardAt = -1, line = '';
    let guard = 0;
    while (cardAt < 0 && guard++ < 40000) {
      clock.t += STEP;
      sim.update(STEP, HIGH, clock.t);
      for (const e of sim.take()) {
        if (e.type === 'done') doneAt = clock.t;
        if (e.type === 'story' && e.kind === 'done') cardAt = clock.t;
      }
      if (doneAt >= 0 && sim.talk.line?.pinned) { line = sim.talk.line.text; lineEnd = clock.t; }
    }
    expect(doneAt).toBeGreaterThan(0);
    expect(line).toBe(t(`pair.${(sim.pic.src as { id: string }).id}.reveal` as never));
    expect(cardAt - doneAt).toBeGreaterThanOrEqual(RULES.cardAt - 1e-6);
    // the line stayed long enough to read twice, and the card came only after it
    expect(lineEnd - doneAt).toBeGreaterThanOrEqual(readSec(line) - 0.2);
    expect(cardAt).toBeGreaterThanOrEqual(lineEnd);
  });

  it('rests the light under a card and does not judge its seconds: a block mostly under it gets no verdict', () => {
    const sim = later({ planned: 900, seed: 4 });
    const clock = { t: 0 };
    toCard(sim, clock);
    const flare = sim.flare;
    // the block the card came in: let it end (it is judged on the seconds before the card, if most of it was play)
    const idx = sim.blockIndex;
    while (sim.blockIndex === idx) drive(sim, 0.25, HIGH, clock);
    const pushes = sim.pushes, rests = sim.rests;
    // a whole push and rest under the card: neither judged nor counted, the flare held as it was
    const evs = drive(sim, 60, HIGH, clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends.length).toBeGreaterThanOrEqual(2);
    for (const e of ends) expect(e.verdict, e.block.kind).toBeNull();
    expect(sim.pushes).toBe(pushes);
    expect(sim.rests).toBe(rests);
    expect(sim.flare).toBeCloseTo(flare, 6);
    expect(sim.meter()).toBeNull();
    expect(sim.padLevel(HIGH)).toBeNull();
    // closed in a push: the runner's banner says the block again, and its verdict counts what came after the card
    until(sim, 'push', HIGH, clock);
    expect(sim.story).not.toBeNull();
    drive(sim, 2, HIGH, clock);
    sim.tapCard();
    expect(sim.bannerUp).toBe(true);
    const after = drive(sim, sim.block.dur, HIGH, clock);
    const v = ofType(after, 'blockEnd').find(e => e.block.kind === 'push');
    expect(v?.verdict).toBe(true);
    expect(sim.pushes).toBe(pushes + 1);
  });

  it('breaks a tile slowly: cracks first, then its pieces one after another, 1.5–2.5 s in all', () => {
    const rnd = mulberry32(9);
    for (let k = 1; k <= 9; k++) {
      for (let r = 0; r < 20; r++) {
        const plan = breakPlan(k, rnd);
        expect(plan.pieces).toHaveLength(k);
        expect(plan.crack).toBeGreaterThanOrEqual(0.35);
        expect(plan.total, `k ${k}`).toBeGreaterThanOrEqual(1.5);
        expect(plan.total, `k ${k}`).toBeLessThanOrEqual(2.5);
        // every piece waits for the cracks, then they loosen in order, never all at once
        plan.pieces.forEach((p, i) => {
          expect(p.start).toBeGreaterThanOrEqual(plan.crack - 1e-9);
          if (i) expect(p.start).toBeGreaterThan(plan.pieces[i - 1].start);
          expect(p.life).toBeGreaterThanOrEqual(RULES.breakFall[0] - 1e-9);
        });
        if (k >= 4) expect(plan.pieces[k - 1].start - plan.pieces[0].start).toBeGreaterThanOrEqual(0.4);
      }
      expect(breakStagger(k)).toBeLessThanOrEqual(RULES.breakStagger);
    }
    // the cap of falling pieces: fewer pieces when many fall, one (a fading tile) at the cap
    expect(pieceCount(9, 0)).toBe(7);
    expect(pieceCount(3, 0)).toBe(5);
    expect(pieceCount(27, 0)).toBe(9);
    expect(pieceCount(9, RULES.breakCap - 4)).toBe(4);
    expect(pieceCount(9, RULES.breakCap)).toBe(1);
    expect(RULES.breakCap).toBeLessThanOrEqual(240);
    // a frame cuts at most RULES.breakFrame sprites (a whole tile's worth at least): a chain never pays all at once
    expect(RULES.breakFrame).toBeGreaterThanOrEqual(9);
    expect(RULES.breakFrame).toBeLessThan(RULES.breakCap);
  });

  it('lets the last tiles go in a slow chain (0.35–0.45 s apart) and the flare’s wave run from its centre outward', () => {
    expect(RULES.finishGap).toBeGreaterThanOrEqual(0.35);
    expect(RULES.finishGap).toBeLessThanOrEqual(0.45);
    // the finishing chain
    const sim = later({ planned: 600, seed: 4 });
    const clock = { t: 0 };
    let fin = -1;
    const times: number[] = [];
    let guard = 0;
    while (sim.pic.state !== 'bloom' && guard++ < 60000) {
      clock.t += STEP;
      sim.update(STEP, HIGH, clock.t);
      for (const e of sim.take()) {
        if (e.type === 'finishing') fin = clock.t;
        if (e.type === 'burst' && fin >= 0) times.push(clock.t);
      }
    }
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1], `link ${i}`).toBeGreaterThan(0.3);
    // the wave: nearer tiles burst first, the farthest up to RULES.waveSec later
    const w = later({ progress: { sessions: 30 }, seed: 2 });
    const c2 = { t: 0 };
    drive(w, 6, HIGH, c2);
    for (const tl of w.pic.tiles) tl.press = 0.6;                  // cracked by earlier focus: the wave's own bursts only
    w.flare = 0.9999;
    drive(w, 0.05, HIGH, c2);
    // at a dark tile near the middle (the light has opened the middle already)
    const dark = w.pic.mosaic.cells.filter(c => !w.pic.tiles[c.id].open).sort((a, b) => a.ring - b.ring)[0];
    const at = { x: dark.cx, y: dark.cy };
    w.tap(at);
    const bursts: { d: number; t: number }[] = [];
    const t0 = c2.t;
    for (let i = 0; i < 2.2 / STEP; i++) {
      c2.t += STEP;
      w.update(STEP, frame({ ...HIGH, level: 0.3, focused: false, hold: 0 }), c2.t);
      for (const e of w.take()) {
        if (e.type === 'burst' && e.depth === 0) {
          const c = w.pic.mosaic.cells[e.cell];
          bursts.push({ d: Math.hypot(c.cx - at.x, c.cy - at.y), t: c2.t - t0 });
        }
      }
    }
    expect(bursts.length).toBeGreaterThanOrEqual(2);
    expect(bursts.length).toBeLessThanOrEqual(w.waveBursts());
    // not at once: the farther tile a good while after the nearest
    expect(bursts[bursts.length - 1].t - bursts[0].t).toBeGreaterThan(0.15);
    expect(bursts[0].t).toBeLessThan(0.3);
    for (let i = 1; i < bursts.length; i++) expect(bursts[i].d).toBeGreaterThanOrEqual(bursts[i - 1].d - 1e-6);
    expect(Math.max(...bursts.map(b => b.t))).toBeLessThanOrEqual(RULES.waveLead + RULES.waveSec + 0.05);
  });

  it('keeps a picture as long as it was before the pieces doubled, or a little longer — never faster', () => {
    const old = [7, 9, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36];
    for (let i = 0; i < 14; i++) {
      const before = 95 + 1.1 * old[Math.min(old.length - 1, i)];
      const n = tilesFor(i, 0);
      const now = RULES.picBase + RULES.picPerTile * n;
      expect(now, `session ${i + 1}: ${n} tiles`).toBeGreaterThanOrEqual(before - 1e-9);
      expect(now, `session ${i + 1}: ${n} tiles`).toBeLessThanOrEqual(before * 1.12);
      expect(later({ progress: { sessions: i } }).pic.perTile * n).toBeCloseTo(now, 6);
    }
  });

  it('paces sessions as measured (focus held half of each 16 s, a tap every 2.5 s): pictures as before, twice the pieces', () => {
    const run = (sessions: number, planned: number, share: number, seed: number) => {
      const sim = new RozSim({
        progress: { ...freshProgress(), sessions, pushes: sessions * 6, seen: sessions ? [...ALL_SEEN] : [], lastDay: sessions ? DAY : '' },
        rng: mulberry32(seed), day: DAY, daySeed: 3, plannedSec: planned, eeg: false, tuning: TUNING, aspect: 1,
      });
      sim.start();
      const clock = { t: 0 };
      let hold = 0, tap = 1;
      drive(sim, planned + 4, tt => {
        const on = tt % 16 < 16 * share;
        hold = on ? hold + STEP : 0;
        return on ? frame({ level: 0.62, activity: 3, focused: true, hold, calm: 0.2 }) : frame({ level: 0.3, activity: 1, calm: 0.6 });
      }, clock, tt => {
        if (sim.story && sim.story.t > 1.5) sim.tapCard();
        if (tt >= tap) { tap += 2.5; sim.tap(centre(sim)); }
      });
      return sim;
    };
    const mean = (f: (s: RozSim) => number, sims: RozSim[]) => sims.reduce((a, s) => a + f(s), 0) / sims.length;
    const first = [1, 2, 3, 4].map(seed => run(0, 300, 0.5, seed));
    expect(mean(s => s.picturesDone, first)).toBeGreaterThanOrEqual(1);
    expect(mean(s => s.tilesBroken, first)).toBeGreaterThanOrEqual(20);
    const eleventh = [1, 2, 3].map(seed => run(10, 600, 0.5, seed));
    expect(mean(s => s.picturesDone, eleventh)).toBeGreaterThanOrEqual(1.5);
    expect(mean(s => s.picturesDone, eleventh)).toBeLessThanOrEqual(3);
    expect(mean(s => s.tilesBroken, eleventh)).toBeGreaterThanOrEqual(140);
    // little focus: progress only from it — a picture, no flare
    const low = [1, 2].map(seed => run(10, 600, 0.3, seed));
    expect(mean(s => s.flares, low)).toBe(0);
    expect(mean(s => s.picturesDone, low)).toBeLessThanOrEqual(1.5);
  });

  it('keeps every line on screen long enough to read twice (2.5 s + 70 ms a character, never under 4.5 s)', () => {
    expect(readSec('Tak.')).toBe(4.5);
    expect(readSec('x'.repeat(60))).toBeCloseTo(2.5 + 0.07 * 60, 6);
    const talk = new Talk(() => ['Krótko.', 'Ten wiersz jest dłuższy i ma w sobie około siedemdziesięciu znaków.'], mulberry32(1));
    const seen = new Map<string, number>();
    let now = 0;
    talk.ask('push', 1, 99);
    talk.ask('rest', 1, 99);
    for (let i = 0; i < 30 / STEP; i++) {
      now += STEP;
      talk.update(STEP, now, false);
      if (talk.line) seen.set(talk.line.text, talk.line.t);
    }
    for (const [text, shown] of seen) expect(shown, text).toBeGreaterThanOrEqual(readSec(text) - 2 * STEP);
    // a coach mark lasts by the same rule (index.ts asks the runner for readSec × 1000 ms)
    for (const w of ['aim', 'knock', 'halo', 'flare', 'blind'] as const) expect(readSec(coachText(w, true))).toBeGreaterThanOrEqual(4.5);
  });

  it('shows one short “what to do now” line, changed only when the action changes', () => {
    const sim = makeSim({ planned: 300 });
    expect(nowKind(sim)).toBeNull();                               // the opening card: its button says what to do
    const clock = { t: 0 };
    drive(sim, 1.5, MID, clock);
    sim.space();
    expect(nowKind(sim)).toBe('warm');
    until(sim, 'push', MID, clock);
    expect(nowKind(sim)).toBe('push');
    until(sim, 'rest', MID, clock);
    expect(nowKind(sim)).toBe('rest');
    const ready = later();
    drive(ready, 6, HIGH);
    ready.flare = 0.9999;
    drive(ready, 0.05, HIGH);
    expect(nowKind(ready)).toBe('flare');
    drive(ready, 0.05, LOW);
    expect(nowKind(ready)).toBe('flareWait');
    // the line waits RULES.nowSettle s before it follows a change, and never flickers with a moment of focus
    const line = new NowLine();
    line.update(0.1, 'push');
    expect(line.kind).toBe('push');
    for (let i = 0; i < 10; i++) {
      line.update(0.3, 'flare');
      line.update(0.3, 'flareWait');
    }
    expect(line.kind).toBe('push');
    line.update(RULES.nowSettle + 0.01, 'flare');
    line.update(0.01, 'flare');
    expect(line.kind).toBe('flare');
    line.update(0.01, null);
    expect(line.kind).toBeNull();
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, string>;
      for (const k of ['now.warm', 'now.warm.mouse', 'now.push', 'now.blind', 'now.flare', 'now.flare.mouse', 'now.flareWait', 'now.rest', 'now.finale']) {
        expect(c[k], `${l}.${k}`).toBeTruthy();
        expect(c[k].length, `${l}.${k}`).toBeLessThanOrEqual(50);
      }
      expect(c['now.warm.mouse'], l).toMatch(/klik|click|klick/i);
    }
  });

  it('glosses its own words the first time they show: the threshold, the flare', () => {
    expect(t('coach.halo')).toMatch(/próg — /);
    expect(t('coach.flare')).toMatch(/Rozbłysk \(fala światła/);
    for (const l of ['en', 'de', 'sv'] as const) {
      const c = CATALOGS[l] as Record<string, string>;
      expect(c['coach.flare'], l).toMatch(/\(/);
      expect(c['coach.halo'].length, l).toBeGreaterThan(70);
    }
  });
});
