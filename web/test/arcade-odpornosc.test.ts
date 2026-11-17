import { describe, expect, it } from 'vitest';
import {
  FACTS, FACT_IDS, GLOSSES, LINES, LINES_MOUSE, LINE_COUNT, LOOPS, MOMENTS, PATHOGENS, STAGES, TIPS, UNLOCKS, glossText, loopSpec,
} from '../src/arcade/odpornosc/content';
import { Captions } from '../src/arcade/odpornosc/captions';
import { Talk } from '../src/arcade/odpornosc/talk';
import { CATALOGS, t, unit } from '../src/arcade/odpornosc/i18n';
import { checkUnlocks, freshProgress, memoryOf, migrate, type OdpProgress } from '../src/arcade/odpornosc/meta';
import { RULES, readSec } from '../src/arcade/odpornosc/rules';
import { OdpSim, finaleFor, planBlocks, recruitNeed, starsFor, stageCap, waveOf, type SimEvent } from '../src/arcade/odpornosc/sim';
import { buildSong, isChorus } from '../src/arcade/odpornosc/song';
import { WORLD_H, layout, sx, sy, tapTargets, wx, wy } from '../src/arcade/odpornosc/layout';
import { fitFont, font, fontPx } from '../src/arcade/odpornosc/paint';
import { coachText, howto } from '../src/arcade/odpornosc/index';
import { CHECK_SIZES, DESK_BIG, MIN_READ, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { OdpView } from '../src/arcade/odpornosc/render';
import { drawAimTag } from '../src/arcade/odpornosc/hud';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { CHORUS_BEATS, songProblems } from '../src/arcade/kit/song';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.5, activity: 2, focused: true, hold: 1, calm: 0.4 });
const LOW = frame({ level: 0.05, activity: -3, calm: 0.95 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });

const ALL_SEEN = ['drag', 'tap', 'rings', 'roll', 'swarm', 'burst', 'net', 'rest', 'capsule', 'tcell', 'hidden', 'collagen', 'blind', 'tidy'] as const;

type SimOpts = { progress?: Partial<OdpProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): OdpSim {
  const sim = new OdpSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no first card's wait: a tap closes it). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: OdpSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Close any card the moment it can be closed. */
const closeCards = (sim: OdpSim) => () => { if (sim.card && sim.card.t > RULES.cardTap) sim.tap(sim.W / 2, 50); };

/** Run until the given stage is being played (cards closed on the way); returns the clock. */
function toStage(sim: OdpSim, stage: (typeof STAGES)[number], f: FocusFrame | ((t: number) => FocusFrame) = HIGH, clock = { t: 0 }): { t: number } {
  let guard = 0;
  const close = closeCards(sim);
  while ((sim.stage !== stage || sim.card) && guard++ < 6000) drive(sim, 0.25, f, clock, close);
  return clock;
}

/** A sim placed at a stage of a loop (from the save). */
const at = (stage: number, o: SimOpts = {}) => later({ ...o, progress: { stage, ...o.progress } });

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up and alternates alarm and rest, ending on a rest', () => {
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
    for (const planned of [10, 20, 40, 61]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
    const sim = later({ planned: 40 });
    drive(sim, 48, MID, { t: 0 }, closeCards(sim));
    expect(sim.phase).toBe('done');
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later();
    const b = sim.block;
    expect(b.kind).toBe('push');
    const evs = drive(sim, b.dur - 2, MID, { t: 0 }, closeCards(sim));
    expect(sim.telegraphed).toBe(true);
    expect(sim.next!.kind).toBe('rest');
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 8; i++) {
      if (sim.block.kind === 'push') blinds.push(sim.block.blind);
      drive(sim, sim.block.dur + 0.05, MID, clock, closeCards(sim));
    }
    expect(blinds[0]).toBe(false);
    expect(blinds.filter(Boolean).length).toBe(1);
    const young = later({ planned: 600, progress: { sessions: 1, pushes: 2 } });
    const c2 = { t: 0 };
    for (let i = 0; i < 8; i++) {
      expect(young.block.blind).toBe(false);
      drive(young, young.block.dur + 0.05, MID, c2, closeCards(young));
    }
  });

  it('judges each block once, at its end', () => {
    const sim = later();
    const clock = { t: 0 };
    const evs = drive(sim, 120, () => (sim.restBlock ? LOW : HIGH), clock, closeCards(sim));
    const ends = ofType(evs, 'blockEnd');
    const starts = ofType(evs, 'blockStart');
    expect(ends.length).toBeGreaterThanOrEqual(3);
    expect(ends.length).toBeGreaterThanOrEqual(starts.length - 1);
    expect(ends.length).toBeLessThanOrEqual(starts.length);
    for (const e of ends) expect(e.verdict).toBe(true);
  });
});

describe('the stages: the real order of an immune response', () => {
  it('goes alarm → recruitment → the hunt → antibodies → T cells → healing, and loops to a new place', () => {
    expect(STAGES).toEqual(['alarm', 'recruit', 'hunt', 'antibodies', 'tcells', 'heal']);
    const sim = later({ planned: 1200 });
    const clock = { t: 0 };
    const seen: string[] = [];
    let guard = 0;
    while (sim.p.loop === 1 && guard++ < 6000) {
      for (const e of drive(sim, 0.5, () => (sim.restBlock ? LOW : HIGH), clock, () => { closeCards(sim)(); if (clock.t % 1 < STEP) sim.seekNearest(); })) {
        if (e.type === 'stage') seen.push(e.stage);
      }
    }
    expect(seen.slice(0, 6)).toEqual(['alarm', 'recruit', 'hunt', 'antibodies', 'tcells', 'heal']);
    expect(sim.p.loop).toBe(2);
    expect(sim.p.loopsDone).toBe(1);
    expect(sim.stage).toBe('alarm');
    expect(loopSpec(2).place).not.toBe(loopSpec(1).place);
    expect(loopSpec(4)).toEqual(loopSpec(1));
  });

  it('alarm: the macrophage senses the bacteria and sends rings; rings that reach the vessel light its wall', () => {
    const sim = at(0);
    expect(sim.makro).toBeTruthy();
    expect(sim.bugs.length).toBe(RULES.alarm.start);
    expect(sim.scene).toBe('skin');
    sim.tap(sim.W / 2, 50);
    const evs = drive(sim, 30, HIGH, { t: 0 }, closeCards(sim));
    expect(ofType(evs, 'ring').length).toBeGreaterThan(5);
    expect(ofType(evs, 'pad').length).toBeGreaterThan(0);
    expect(sim.score).toBeGreaterThan(0);
  });

  it('alarm: focus makes the signal reach further (the threshold ring is drawn at the half)', () => {
    const sim = later();
    expect(sim.reach).toBeCloseTo(RULES.reach, 5);
    drive(sim, sim.leadIn + 8, HIGH, { t: 0 }, closeCards(sim));
    expect(sim.alarm).toBeGreaterThan(0.85);
    expect(sim.reach).toBeGreaterThan(sim.reachAt);
    expect(sim.reachAt).toBeCloseTo(RULES.reach * (1 + RULES.reachK * 0.5), 5);
  });

  it('recruitment: a tap stops a rolling cell; it crawls to a junction, squeezes through and joins the swarm', () => {
    const sim = at(1);
    const clock = { t: 0 };
    drive(sim, 0.7, MID, clock);
    sim.tap(sim.W / 2, 50);   // closes the card
    let guard = 0;
    while (!sim.flow.some(f => f.state === 'roll') && guard++ < 400) drive(sim, 0.1, MID, clock);
    const roller = sim.flow.find(f => f.state === 'roll')!;
    expect(roller).toBeTruthy();
    expect(sim.tap(roller.x, (RULES.lumenTop + RULES.lumenBot) / 2)).toBe('arrest');
    const evs = drive(sim, RULES.recruit.crawl + RULES.recruit.squeeze + 0.3, MID, clock);
    expect(ofType(evs, 'squeeze').length).toBeGreaterThan(0);
    expect(ofType(evs, 'join').length).toBeGreaterThan(0);
    expect(sim.swarm.length).toBeGreaterThan(0);
  });

  it('recruitment: a drag along the vessel stops every rolling cell it passes', () => {
    const sim = at(1);
    const clock = { t: 0 };
    let guard = 0;
    while (sim.flow.filter(f => f.state === 'roll').length < 2 && guard++ < 600) drive(sim, 0.1, HIGH, clock, closeCards(sim));
    const n = sim.flow.filter(f => f.state === 'roll').length;
    expect(sim.sweep(0, sim.W)).toBe(n);
  });

  it('the hunt: neutrophils engulf bacteria (a combo climbs), get spent after their appetite and become bodies', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    const evs = drive(sim, 40, HIGH, clock, () => { if (clock.t % 0.65 < STEP) sim.tap(sim.W / 2, 50); });
    const gulps = ofType(evs, 'gulp').filter(e => e.by === 'neut');
    expect(gulps.length).toBeGreaterThan(5);
    expect(Math.max(...ofType(evs, 'gulp').map(e => e.combo))).toBeGreaterThan(2);
    expect(sim.bacteria).toBeGreaterThanOrEqual(gulps.length);
    // appetite: Guyton's 3–20 per neutrophil
    expect(RULES.neut.appetite).toBeGreaterThanOrEqual(3);
    expect(RULES.neut.appetite).toBeLessThanOrEqual(20);
  });

  it('a held focus fills the respiratory burst; Space lets it go and the swarm engulfs at once', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    let guard = 0;
    while (!sim.burstReady && guard++ < 400) drive(sim, 0.25, HIGH, clock);
    expect(sim.burstReady).toBe(true);
    expect(sim.key(' ', true)).toBe(true);
    expect(sim.bursting).toBeGreaterThan(0);
    expect(sim.charge).toBe(0);
    const evs = drive(sim, 2, HIGH, clock);
    expect(ofType(evs, 'burstEnd')).toHaveLength(0);
    drive(sim, RULES.burstSec, HIGH, clock);
    expect(sim.bursting).toBe(0);
  });

  it('a ready burst goes off by itself after a while', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    sim.charge = 1;
    drive(sim, 0.1, HIGH, clock);
    expect(sim.burstReady).toBe(true);
    const evs = drive(sim, RULES.burstAuto + 0.5, HIGH, clock);
    expect(ofType(evs, 'burst')).toHaveLength(1);
  });

  it('a NET catches the densest cluster; the caught bacteria dissolve (and count)', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    expect(sim.nets).toBeGreaterThan(0);
    const before = sim.score;
    expect(sim.net()).toBe(true);
    expect(sim.netsUp).toHaveLength(1);
    const caught = sim.bugs.filter(b => b.netted > 0).length;
    expect(caught).toBeGreaterThan(0);
    drive(sim, RULES.net.dissolve * 1.4, HIGH, clock);
    expect(sim.score).toBeGreaterThan(before);
    expect(sim.net()).toBe(false);
  });

  it('antibodies: a dendritic cell carries a piece to the node; antibodies and complement tag the bacteria; a capsule slips until tagged', () => {
    const sim = at(3);
    const clock = toStage(sim, 'antibodies');
    expect(sim.cells.some(c => c.kind === 'dc')).toBe(true);
    const evs = drive(sim, RULES.antibodies.trip + 6, HIGH, clock);
    expect(ofType(evs, 'dc').map(e => e.phase)).toEqual(expect.arrayContaining(['grab', 'leave', 'node', 'back']));
    expect(ofType(evs, 'abWave')).toHaveLength(1);
    expect(ofType(evs, 'tag').length).toBeGreaterThan(0);
    // a capsule bounces a neutrophil off until it is tagged
    const cap = sim.bugs.find(b => b.capsule && b.tag < 1 && !b.grabbed);
    if (cap) {
      const n = sim.swarm[0];
      if (n) {
        n.x = cap.x; n.y = cap.y; n.target = cap.id;
        const ev2 = drive(sim, 0.2, MID, clock);
        expect(ofType(ev2, 'slip').length + (cap.tag >= 1 ? 1 : 0)).toBeGreaterThan(0);
      }
    }
  });

  it('memory: a pathogen met before is answered at once (no trip to the node, tagged from the start)', () => {
    const sim = at(3, { progress: { memory: { ziarniaki: 2 } } });
    expect(memoryOf(sim.p, 'ziarniaki')).toBe(2);
    const clock = toStage(sim, 'antibodies');
    expect(sim.cells.some(c => c.kind === 'dc')).toBe(false);
    const evs = drive(sim, RULES.antibodies.memoryTrip + 0.5, HIGH, clock);
    expect(ofType(evs, 'abWave')).toHaveLength(1);
    const hunt = at(2, { progress: { memory: { ziarniaki: 3 } }, seed: 4 });
    toStage(hunt, 'hunt');
    expect(hunt.bugs.some(b => b.tag >= 1)).toBe(true);
  });

  it('T cells: a tap on an infected cell sends a T cell; it docks and the cell folds itself away (the virions inside count)', () => {
    const sim = at(4);
    const clock = toStage(sim, 'tcells');
    expect(sim.scene).toBe('nose');
    expect(sim.cells.filter(c => c.kind === 'tcell').length).toBeGreaterThanOrEqual(RULES.tcells.cells);
    const i = sim.epi.findIndex(e => e.state === 'infected');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(sim.tap(sim.epi[i].x, RULES.epi.y)).toBe('cell');
    const before = sim.score;
    const evs = drive(sim, 9, MID, clock);
    expect(ofType(evs, 'dock').length).toBeGreaterThan(0);
    const folds = ofType(evs, 'fold');
    expect(folds.length).toBeGreaterThan(0);
    expect(sim.score - before).toBeGreaterThanOrEqual(folds.reduce((s, e) => s + e.n, 0) - 1);
  });

  it('T cells: an infected cell that hid its flags is found only by an NK cell (after the first T cells)', () => {
    const p = checkUnlocks({ ...freshProgress(), tcellsDone: 1 } as OdpProgress);
    expect(p).toContain('nk');
    const sim = at(4, { progress: { loop: 2, unlocks: ['nk'], tcellsDone: 1 }, seed: 9 });
    const clock = toStage(sim, 'tcells');
    expect(sim.cells.filter(c => c.kind === 'nk')).toHaveLength(2);
    sim.epi[0].state = 'hidden';
    sim.epi[0].load = 0.1;
    expect(sim.tap(sim.epi[0].x, RULES.epi.y)).toBe('cell');
    const evs = drive(sim, 20, MID, clock);
    expect(ofType(evs, 'fold').some(e => e.by === 'nk')).toBe(true);
  });

  it('interferon: the alarm protects the infected cell’s neighbours', () => {
    const sim = at(4);
    const clock = toStage(sim, 'tcells');
    drive(sim, sim.leadIn + 6, HIGH, clock);
    expect(sim.epi.some(e => e.state === 'ok' && e.protect > 0)).toBe(true);
  });

  it('healing: calm in a rest closes the wound, a drag across it lays collagen, tidying a body helps', () => {
    const sim = at(5);
    toStage(sim, 'heal');
    expect(sim.cells.some(c => c.state === 'body')).toBe(true);
    const c0 = sim.closure;
    expect(sim.stroke(sim.woundX - 12, 10, sim.woundX + 12, 14)).toBe(true);
    expect(sim.fibres).toHaveLength(1);
    expect(sim.closure).toBeGreaterThan(c0);
    expect(sim.stroke(sim.W * 0.02, 90, sim.W * 0.1, 92)).toBe(false);   // far from the wound
    const body = sim.cells.find(c => c.state === 'body')!;
    expect(sim.tap(body.x, body.y)).toBe('tidy');
    // a rest's calm heals faster than a push
    const a = at(5, { seed: 3 }), b = at(5, { seed: 3 });
    const ca = toStage(a, 'heal'), cb = toStage(b, 'heal');
    while (!a.restBlock) drive(a, 0.5, MID, ca);
    while (!b.restBlock) drive(b, 0.5, MID, cb);
    const x0 = a.closure, y0 = b.closure;
    drive(a, 12, LOW, ca);
    drive(b, 12, NONE, cb);
    expect(a.closure - x0).toBeGreaterThan(b.closure - y0);
  });

  it('weaves collagen only while healing; a rest in the battle prepares the repair by itself (round 11)', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    expect(sim.stroke(sim.woundX - 12, 10, sim.woundX + 12, 14)).toBe(false);   // not while hunting
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, closeCards(sim));
    const p0 = sim.prep;
    // the old rest-time weaving in the battle is gone (an invisible repair confused more than it added)
    expect(sim.canWeave).toBe(false);
    expect(sim.stroke(sim.woundX - 12, 10, sim.woundX + 12, 14)).toBe(false);
    drive(sim, 6, LOW, clock, closeCards(sim));
    expect(sim.prep).toBeGreaterThan(p0);
    expect(sim.closure).toBe(0);
  });

  it('a stage that runs out of time is finished by the body: no stars, nothing lost, the run goes on', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    const before = sim.score;
    const evs = drive(sim, stageCap('hunt') + 2, NONE, clock);
    const done = ofType(evs, 'stageDone');
    expect(done.length).toBeGreaterThan(0);
    if (done[0].grace) expect(done[0].stars).toBe(0);
    expect(sim.score).toBeGreaterThanOrEqual(before);
    expect(starsFor(10, 90, false)).toBe(3);
    expect(starsFor(60, 90, false)).toBe(2);
    expect(starsFor(85, 90, false)).toBe(1);
    expect(starsFor(10, 90, true)).toBe(0);
  });

  it('rest pauses the inflow and the division, and refreshes the swarm from the marrow', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, closeCards(sim));
    drive(sim, 2, LOW, clock, closeCards(sim));
    const evs = drive(sim, 10, LOW, clock, closeCards(sim));
    expect(ofType(evs, 'spawn').length).toBe(0);
    expect(ofType(evs, 'divide').length).toBe(0);
    expect(ofType(evs, 'join').length).toBeGreaterThan(0);
  });

  it('grows harder loop by loop: bigger waves, more recruits asked, more capsules', () => {
    expect(waveOf('hunt', 2)).toBeGreaterThan(waveOf('hunt', 1));
    expect(recruitNeed(3)).toBeGreaterThan(recruitNeed(1));
    expect(LOOPS.map(l => l.bug)).toEqual(['ziarniaki', 'laseczki', 'paleczki']);
  });
});

describe('the band', () => {
  it('drives the alarm only in a sighted push past its lead-in; the gauge hides in the lead-in', () => {
    const sim = later();
    expect(sim.pushBlock).toBe(true);
    drive(sim, sim.leadIn - 0.5, HIGH, { t: 0 }, closeCards(sim));
    expect(sim.meter()).toBeNull();
    expect(sim.alarm).toBe(0);
    drive(sim, 4, HIGH, { t: sim.t }, closeCards(sim));
    expect(sim.meter()).toBeGreaterThan(0.5);
  });

  it('freezes at the base without a signal: no gauge, no alarm, never a loss', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 12, NONE, clock, closeCards(sim));
    expect(sim.meter()).toBeNull();
    expect(sim.alarm).toBe(0);
    expect(sim.reach).toBeCloseTo(RULES.reach, 5);
    expect(sim.score).toBeGreaterThanOrEqual(0);
  });

  it('a blind push hides the gauge, keeps the base and reveals its share at the end (as burst charge)', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    let guard = 0;
    while (!sim.blind && guard++ < 2000) drive(sim, 0.25, HIGH, clock, closeCards(sim));
    expect(sim.blind).toBe(true);
    drive(sim, 8, HIGH, clock, closeCards(sim));
    expect(sim.meter()).toBeNull();
    expect(sim.alarm).toBeLessThan(0.01);
    expect(sim.songLevel(HIGH)).toBeNull();
    const charge = sim.charge;
    const evs: SimEvent[] = [];
    while (sim.blind) evs.push(...drive(sim, 0.25, HIGH, clock, closeCards(sim)));
    const rev = ofType(evs, 'reveal');
    expect(rev).toHaveLength(1);
    expect(rev[0].share).toBeGreaterThan(0.5);
    expect(sim.charge).toBeGreaterThanOrEqual(Math.min(1, charge));
    expect(sim.blindShare).toBeGreaterThan(50);
  });

  it('calm drives healing in a rest (the gauge shows it); the pad and the song never leak rest or blind feedback', () => {
    const sim = later();
    const clock = { t: 0 };
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, closeCards(sim));
    drive(sim, 7, LOW, clock);
    expect(sim.meter()).toBeGreaterThan(0.6);
    expect(sim.padLevel(LOW)).toBeNull();
    expect(sim.songLevel(LOW)).toBe(0.3);
    expect(sim.prep).toBeGreaterThan(0);
  });
});

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    const sim = makeSim({ tuning: BEGINNER });
    let next = 0.65, space = 2;
    const clock = { t: 0 };
    let headline = -1;
    let rises = 0;
    drive(sim, 22, HIGH, clock, t => {
      if (t >= next) { next += 0.65; sim.tap(sim.W / 2, 60); }
      if (t >= space) { space += 2; sim.key(' ', true); sim.key(' ', false); }
      if (sim.score > headline) { if (headline >= 0) rises++; headline = sim.score; }
    });
    expect(sim.result().score).toBeGreaterThan(0);
    expect(rises).toBeGreaterThan(1);
  });

  it('opens the first session with the story card and its root verse, and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.card?.kind).toBe('open');
    expect(sim.block.kind).toBe('warmup');
    expect(passage(sim.closingVerse()).text.length).toBeGreaterThan(10);
    const evs = drive(sim, 40, MID, { t: 0 }, closeCards(sim));
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('drag');
    expect(sim.p.facts).toContain('metchnikoff');
  });

  it('gives result() idempotently and the record only with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH, { t: 0 }, closeCards(sim));
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best['300']).toBe(a.score);
    const total = sim.p.total;
    sim.result();
    expect(sim.p.total).toBe(total);
  });

  it('settles once at the end (or early)', () => {
    const sim = later({ planned: 40 });
    drive(sim, 46, MID, { t: 0 }, closeCards(sim));
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    const early = later({ planned: 300 });
    drive(early, 20, MID, { t: 0 }, closeCards(early));
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('closes with a passage that exists, fitting what happened', () => {
    for (const id of ['psa103.2-3', 'psa121.7-8', 'isa54.17', 'pro17.22', 'exo23.25'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
    const sim = later();
    drive(sim, 20, HIGH, { t: 0 }, closeCards(sim));
    expect(passage(sim.result().verse!).text.length).toBeGreaterThan(10);
    expect(makeSim().closingVerse()).toBe('psa103.2-3');
  });

  it('says what the headline means and keeps the stats and highlights readable', () => {
    const sim = later();
    drive(sim, 60, HIGH, { t: 0 }, closeCards(sim));
    const r = sim.result();
    expect(r.unit).toBe(unit(r.score));
    expect(r.stats.length).toBeGreaterThanOrEqual(8);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
  });

  it('keeps the progress in a fair band over a week of 5-minute sessions (simulated play)', () => {
    let p = freshProgress();
    const loops: number[] = [];
    for (let s = 0; s < 7; s++) {
      const sim = new OdpSim({ progress: p, rng: mulberry32(11 + s), plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      const clock = { t: 0 };
      let next = 1;
      drive(sim, 304, t => (sim.restBlock ? (Math.floor(t / 7) % 2 ? LOW : MID) : Math.floor(t / 13) % 2 ? MID : HIGH), clock, t => {
        closeCards(sim)();
        if (t >= next) { next += 1.2; sim.seekNearest(); }
      });
      sim.result();
      p = sim.p;
      loops.push(p.loop + p.stage / 6);
    }
    // a loop takes about one to two sessions; the facts and the cells come over the week, not at once
    expect(loops[0]).toBeGreaterThan(1.3);
    expect(loops[0]).toBeLessThan(3.2);
    expect(loops[6]).toBeGreaterThan(4);
    expect(loops[6]).toBeLessThan(14);
    expect(p.facts.length).toBeGreaterThan(15);
    expect(p.unlocks.length).toBeGreaterThanOrEqual(3);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and starts the run fresh, keeping the count', () => {
    const p = mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as OdpProgress;
    migrate(p);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.loop).toBe(1);
    expect(p.stage).toBe(0);
    expect(p.song).toBe(true);
    expect(migrate(p)).toBe(p);
  });

  it('keeps a realistic version-1 save and repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: 9, pushes: 14, loop: 3, stage: 9, loopsDone: 'x', total: 412.7, best: { '300': 120, bad: 'x' }, bestCombo: -4,
      memory: { ziarniaki: 2, rinoA: 9, ghost: 3 }, met: { ziarniaki: 300, laseczki: 'x' }, facts: ['tlr', 'nope', 'tlr', 3], unlocks: ['nk', 'wings'],
      stars: { 'palec.hunt': 3, 'palec.alarm': 7 }, tcellsDone: 2, seen: ['drag', 4], song: 'yes', bursts: 3, nets: null, lastLen: 300,
    };
    const p = mergeSaved(freshProgress(), saved) as OdpProgress;
    migrate(p);
    expect(p.loop).toBe(3);
    expect(p.stage).toBe(STAGES.length - 1);
    expect(p.loopsDone).toBe(0);
    expect(p.total).toBe(412);
    expect(p.best).toEqual({ '300': 120 });
    expect(p.bestCombo).toBe(0);
    expect(p.memory).toEqual({ ziarniaki: 2, rinoA: 3 });
    expect(p.met).toEqual({ ziarniaki: 300 });
    expect(p.facts).toEqual(['tlr']);
    expect(p.unlocks).toEqual(['nk']);
    expect(p.stars).toEqual({ 'palec.hunt': 3, 'palec.alarm': 3 });
    expect(p.seen).toEqual(['drag']);
    expect(p.song).toBe(true);
    expect(p.nets).toBe(0);
    const sim = new OdpSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: true, tuning: TUNING });
    sim.start();
    expect(sim.card?.kind).toBe('stage');
    expect(sim.card?.back).toBe(true);
    drive(sim, 10, MID, { t: 0 }, closeCards(sim));
    expect(sim.result().score).toBeGreaterThanOrEqual(0);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, memory: 'x', facts: 5, best: [], stars: null, loop: -3 }]) {
      const p = mergeSaved(freshProgress(), junk) as OdpProgress;
      migrate(p);
      expect(p.ver).toBe(1);
      expect(p.loop).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(p.facts)).toBe(true);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Neo and Makro at least three lines a moment, each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
    expect(LINE_COUNT).toBeGreaterThan(90);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
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

  it('suggests strategies, never to concentrate harder; the how-to’s last tip says it is not a treatment', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|howto)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
    expect(CATALOGS.pl['howto.tip2']).toMatch(/nie zastępuje leczenia/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/does not replace treatment/);
    expect(TIPS.push.length).toBeGreaterThanOrEqual(5);
    expect(TIPS.push.some(s => /\d/.test(s))).toBe(true);   // one counting strategy in the rotation
  });

  it('never names a disease, never says killing, never promises healing', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/\brak\b|nowotw|cancer|Krebs|grypa|influenza|Grippe|sepsa|sepsis|COVID|odra|measles|Masern|mässling|zabij|kill|töte|döda/i);
        }
      }
    }
  });

  it('bends the headline’s unit', () => {
    expect(unit(1)).toBe('patogen');
    expect(unit(3)).toBe('patogeny');
    expect(unit(5)).toBe('patogenów');
    expect(unit(22)).toBe('patogeny');
    expect(t('pathogens', { n: 12 })).toBe('12 patogenów');
  });

  it('gives every Wiedza card a title, a sourced number and a source', () => {
    expect(FACT_IDS.length).toBeGreaterThanOrEqual(25);
    for (const f of FACTS) {
      expect(t(`fact.${f.id}` as never)).not.toMatch(/^fact\./);
      for (const l of ['pl', 'en', 'de', 'sv'] as const) expect((CATALOGS[l] as Record<string, unknown>)[`fact.${f.id}.text`], `${l}.${f.id}`).toMatch(/\d/);
      expect(f.src).toMatch(/\d{4}/);
    }
    for (const id of PATHOGENS) expect(t(`path.${id}` as never)).not.toMatch(/^path\./);
    for (const u of UNLOCKS) expect(t(`unlock.${u.id}` as never)).not.toMatch(/^unlock\./);
  });
});

describe('the song', () => {
  it('is a valid loop: our verses and the series’ refrain, its lines in order', () => {
    const song = buildSong();
    expect(songProblems(song)).toEqual([]);
    expect(song.beats).toBe(64 + 2 * CHORUS_BEATS);
    expect(song.lines).toHaveLength(16);
    expect(song.lines[0].text).toBe(t('song.v1.1'));
    expect(song.lines[4].text).toMatch(/Weź moc/);
    expect(isChorus(40)).toBe(true);
    expect(isChorus(10)).toBe(false);
    expect(song.bpm).toBeGreaterThanOrEqual(100);   // upbeat
  });
});

/** The size in a canvas font string. */
const pxOf = (f: string): number => Number(f.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? 0);

/** A canvas context that measures text as 0.6 em per character (enough to test fitting). */
function measuring(): CanvasRenderingContext2D {
  const ctx = { font: '10px sans-serif', measureText(text: string) { return { width: text.length * pxOf(this.font) * 0.6 } as TextMetrics; } };
  return ctx as unknown as CanvasRenderingContext2D;
}

describe('mobile first (DESIGN §12, §13.9)', () => {
  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        for (const st of [{ burst: false, net: false, card: false }, { burst: true, net: false, card: false }, { burst: true, net: true, card: false }, { burst: false, net: false, card: true }]) {
          expect(auditTargets(tapTargets(L, st), c.w, c.h, c.insets), `${c.name} ${JSON.stringify(st)}`).toEqual([]);
        }
      }
    }
  });

  it('puts the two buttons in the thumb zone, off the edges of an upright phone, at least 48 px and apart', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const b of [L.burst, L.net]) {
        expect(2 * b.r, c.name).toBeGreaterThanOrEqual(48);
        if (L.mode === 'tall') {
          expect(b.y - b.r, c.name).toBeGreaterThanOrEqual(c.h * (1 - THUMB));
          expect(b.x - b.r, c.name).toBeGreaterThanOrEqual(16);
          expect(b.x + b.r, c.name).toBeLessThanOrEqual(c.w - 16);
        }
        expect(b.y + b.r, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom);
      }
      expect(L.net.x - L.net.r - (L.burst.x + L.burst.r), c.name).toBeGreaterThanOrEqual(TAP_GAP);
    }
  });

  it('maps the whole world into the field with one scale, the vessel at the bottom, the strip under the HUD', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.W, c.name).toBeGreaterThanOrEqual(RULES.minW);
      expect(L.W, c.name).toBeLessThanOrEqual(RULES.maxW);
      expect(sy(L, RULES.skinTop), c.name).toBeGreaterThanOrEqual(L.field.y - 0.5);
      expect(sy(L, RULES.floor), c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      expect(L.strip.y, c.name).toBeGreaterThanOrEqual(c.insets.top);
      expect(L.k * WORLD_H, c.name).toBeLessThanOrEqual(L.field.h + 0.5);
      // a neutrophil stays a readable silhouette on a phone
      expect(RULES.neut.r * L.k, c.name).toBeGreaterThanOrEqual(8);
      expect(wx(L, sx(L, 37))).toBeCloseTo(37, 6);
      expect(wy(L, sy(L, 61))).toBeCloseTo(61, 6);
      // the card fits the band under the HUD
      expect(L.card.y, c.name).toBeGreaterThanOrEqual(c.insets.top - 0.5);
      expect(L.card.y + L.card.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      expect(Math.min(L.card.w, L.card.h), c.name).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });

  it('never draws text under 11 px: the font helper has a floor, fitting never shrinks under it', () => {
    expect(pxOf(font(4))).toBe(MIN_TEXT);
    expect(fontPx(6)).toBe(MIN_TEXT);
    const ctx = measuring();
    const size = fitFont(ctx, 'Wybuch tlenowy gotowy — stuknij przycisk albo Spację!', 40, 16);
    expect(size).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(ctx.font)).toBeGreaterThanOrEqual(MIN_TEXT);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a keyboard keeps them as shortcuts', () => {
    expect(howto(true).hands.some(h => h.gesture === 'keys')).toBe(false);
    expect(howto(false).hands.some(h => h.gesture === 'keys')).toBe(true);
    for (const h of howto(true).hands) expect(h.text).not.toMatch(/Spacj|klawisz/i);
    expect(coachText('burst', true)).not.toMatch(/Spacj/);
    expect(coachText('burst', false)).toMatch(/Spacj/);
    expect(howto(true).tips?.at(-1)).toMatch(/nie zastępuje leczenia/);
  });
});

describe('a desk: a mouse on a desktop or a big screen (DESIGN §14)', () => {
  const desks = CHECK_SIZES.filter(c => c.w >= 1024 && c.h >= 560);
  const big = desks.filter(c => Math.min(c.w, c.h) >= DESK_BIG);

  it('chooses its layout from the screen: a desk for a mouse on a desktop, the phone’s for a finger', () => {
    for (const c of CHECK_SIZES) {
      const mouse = layout(c.w, c.h, c.insets, false), finger = layout(c.w, c.h, c.insets, true);
      expect(finger.desk, c.name).toBe(false);
      expect(mouse.desk, c.name).toBe(desks.includes(c));
      // the phones' and the tablet's layouts never change for a mouse (but the lift above a finger)
      if (!desks.includes(c)) expect({ ...mouse, lift: 0 }, c.name).toEqual({ ...finger, lift: 0 });
    }
    expect(desks.length).toBe(5);
  });

  it('fills the field with the world on a big screen: the phone’s cap lifted, the cells grown', () => {
    for (const c of big) {
      const L = layout(c.w, c.h, c.insets, false), old = layout(c.w, c.h, c.insets, true);
      expect(L.u, c.name).toBeGreaterThan(1.3);
      expect(L.k * WORLD_H, c.name).toBeGreaterThanOrEqual(L.field.h - 1);
      expect(L.k / old.k, c.name).toBeGreaterThanOrEqual(1.25);
      expect(L.W).toBeGreaterThanOrEqual(150);
      expect(L.W).toBeLessThanOrEqual(RULES.maxW);
      expect(RULES.neut.r * L.k, c.name).toBeGreaterThanOrEqual(24);
      expect(L.wx0).toBeGreaterThanOrEqual(-0.5);
      expect(L.wx1).toBeLessThanOrEqual(c.w + 0.5);
      expect(sy(L, RULES.skinTop)).toBeGreaterThanOrEqual(L.field.y - 0.5);
      expect(sy(L, RULES.floor)).toBeLessThanOrEqual(c.h - c.insets.bottom + 0.5);
      // the words grow with it (the strip, the song, the buttons follow u)
      expect(L.strip.h).toBeGreaterThanOrEqual(Math.round(26 * 1.3));
      expect(L.burst.r).toBeGreaterThanOrEqual(30 * 1.3);
    }
  });

  it('sets the buttons beside the world where it leaves margins, by the vessel, inside the canvas', () => {
    let beside = 0;
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      const gap = Math.round(14 * L.u);
      if (L.sideButtons) {
        beside++;
        expect(L.burst.x + L.burst.r, c.name).toBeCloseTo(L.wx0 - gap, 5);
        expect(L.net.x - L.net.r, c.name).toBeCloseTo(L.wx1 + gap, 5);
      }
      for (const b of [L.burst, L.net]) {
        expect(b.x - b.r, c.name).toBeGreaterThanOrEqual(c.insets.left);
        expect(b.x + b.r, c.name).toBeLessThanOrEqual(c.w - c.insets.right);
        expect(b.y + b.r, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom);
        expect(b.y, c.name).toBeGreaterThanOrEqual(sy(L, RULES.wallY) - b.r);
      }
    }
    expect(beside).toBe(3);   // the 1280 desktops and the laptop; a big screen's world fills the width
  });

  it('answers a hovering mouse with what a click would do there; a finger has no hover', () => {
    const sim = at(2);
    toStage(sim, 'hunt');
    drive(sim, 1.5, MID, { t: 100 }, closeCards(sim));
    const c = big[0];
    const canvas = { getContext: () => null, clientWidth: c.w, clientHeight: c.h } as unknown as HTMLCanvasElement;
    const view = new OdpView(canvas, { reducedMotion: false, touch: false });
    view.resize(c.w, c.h, 1, c.insets);
    const L = view.L;
    const b = sim.live.find(x => !sim.cells.some(cl => cl.kind === 'neut' && (cl.state === 'body' || cl.state === 'spent') && Math.hypot(cl.x - x.x, cl.y - x.y) <= cl.r + 8))!;
    expect(b).toBeDefined();
    expect(sim.aimAt(b.x + 1, b.y)).toMatchObject({ kind: 'bug', bug: b.kind });
    view.hover = { x: sx(L, b.x + 1), y: sy(L, b.y) };
    expect(view.overPart(sim)).toMatchObject({ part: 'aim' });
    expect(view.cursor(sim)).toBe('pointer');
    // the free tissue (nothing within a tap's reach): "grab" — a drag leads the swarm
    let free: { x: number; y: number } | null = null;
    for (let y = 20; y < 90 && !free; y += 4) for (let x = 4; x < sim.W - 4 && !free; x += 4) if (sim.aimAt(x, y).kind === 'field') free = { x, y };
    expect(free).not.toBeNull();
    view.hover = { x: sx(L, free!.x), y: sy(L, free!.y) };
    expect(view.overPart(sim).part).toBe('field');
    expect(['grab', 'crosshair']).toContain(view.cursor(sim));
    // a button is a hand too; a card takes every click
    view.hover = { x: L.burst.x, y: L.burst.y };
    if (sim.burstShown) expect(view.cursor(sim)).toBe('pointer');
    const touchView = new OdpView(canvas, { reducedMotion: false, touch: true });
    touchView.resize(c.w, c.h, 1, c.insets);
    touchView.hover = { x: sx(L, b.x), y: sy(L, b.y) };
    expect(touchView.overPart(sim).part).toBeNull();
  });

  it('tags what a click would hit in readable words, never under the floor', () => {
    const texts: { text: string; px: number }[] = [];
    let f = '10px x';
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (o, k) => (k === 'font' ? f : k === 'measureText' ? (s: string) => ({ width: s.length * Number(f.match(/(\d+(?:\.\d+)?)px/)![1]) * 0.55 })
        : k === 'fillText' ? (s: string) => texts.push({ text: s, px: Number(f.match(/(\d+(?:\.\d+)?)px/)![1]) })
        : typeof k === 'string' && /^[a-z]/.test(k) && !['globalAlpha', 'lineWidth', 'fillStyle', 'strokeStyle', 'textAlign', 'textBaseline'].includes(k) ? () => undefined : o[k as string]),
      set: (o, k, v) => { if (k === 'font') f = String(v); else o[k as string] = v; return true; },
    }) as unknown as CanvasRenderingContext2D;
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      drawAimTag(ctx, L, L.w / 2, L.h / 2, 20, t('path.ziarniaki'), t('aim.tagged'), t('aim.bug.act'), 1);
    }
    expect(texts.length).toBe(desks.length * 3);
    expect(texts.every(x => x.px >= MIN_READ)).toBe(true);
    expect(texts.map(x => x.text)).toContain(t('aim.bug.act'));
  });

  it('speaks to a mouse in clicks: the how-to, the coach marks and Neo', () => {
    const CLICK = /klik|click|klick|mysz|mouse|maus|musen/i;
    const TAP: Record<string, RegExp> = { pl: /stuk|palc/i, en: /\btap|finger/i, de: /tipp|finger/i, sv: /^tryck|finger/i };
    const keys = ['howto.drag.mouse', 'howto.tap.mouse', 'coach.drag.mouse', 'coach.tap.mouse', 'coach.roll.mouse', 'coach.swarm.mouse', 'coach.net.mouse',
      'coach.tidy.mouse', 'coach.tcell.mouse', 'coach.burst.keys', 'say.recruit.2.mouse', 'say.burstReady.2.mouse'];
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of keys) {
        expect(cat[k], `${l}.${k}`).toMatch(CLICK);
        expect(cat[k], `${l}.${k}`).not.toMatch(TAP[l]);
      }
      expect(cat['howto.keys'], `${l}.howto.keys`).toMatch(/B:/);
    }
    for (const h of howto(false).hands.filter(x => x.gesture !== 'keys')) expect(h.text).toMatch(CLICK);
    for (const what of ['drag', 'tap', 'roll', 'swarm', 'net', 'tidy', 'tcell'] as const) {
      expect(coachText(what, false), what).toMatch(CLICK);
      expect(coachText(what, true), what).not.toMatch(CLICK);
    }
    for (const m of MOMENTS) expect(LINES_MOUSE[m].length, m).toBe(LINES[m].length);
    expect(LINES_MOUSE.recruit).toContain(t('say.recruit.2.mouse'));
    expect(LINES.recruit).not.toContain(t('say.recruit.2.mouse'));
    expect(Object.values(LINES_MOUSE).flat().some(x => /stuk/i.test(x))).toBe(false);
  });
});

/** A canvas context that draws nothing and measures text as 0.55 em a character (for the view's placement). */
function blindCtx(): CanvasRenderingContext2D {
  let f = '10px x';
  const stub = { addColorStop: () => undefined };
  const props: Record<string, unknown> = {};
  return new Proxy(props, {
    get: (o, k) => (k === 'font' ? f
      : k === 'measureText' ? (s: string) => ({ width: s.length * Number(f.match(/(\d+(?:\.\d+)?)px/)![1]) * 0.55 })
      : k in o ? o[k as string]
      : typeof k === 'string' && /^[a-z]/.test(k) ? () => stub : undefined),
    set: (o, k, v) => { if (k === 'font') f = String(v); else o[k as string] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

/** A view on a canvas of a checked size whose context draws nothing. */
function viewAt(c: (typeof CHECK_SIZES)[number], touch: boolean): OdpView {
  const ctx = blindCtx();
  const canvas = { getContext: () => ctx, clientWidth: c.w, clientHeight: c.h } as unknown as HTMLCanvasElement;
  const view = new OdpView(canvas, { reducedMotion: false, touch });
  view.resize(c.w, c.h, 1, c.insets);
  return view;
}
const SONG = { line: null, beat: 0, chorus: false, on: false };

describe('round 11: words long enough to read twice', () => {
  it('times every text by its length: 2.5 s + 70 ms a character, never under 4.5 s', () => {
    expect(readSec('')).toBe(4.5);
    expect(readSec('x'.repeat(20))).toBe(4.5);
    expect(readSec('x'.repeat(90))).toBeCloseTo(2.5 + 0.07 * 90, 6);
    // Neo's and Makro's lines: each on screen exactly that long
    const sim = later({ planned: 300 });
    const durs = new Map<string, number>();
    drive(sim, 120, MID, { t: 0 }, () => {
      closeCards(sim)();
      const l = sim.talk.line;
      if (l) durs.set(l.text, l.dur);
    });
    expect(durs.size).toBeGreaterThan(3);
    for (const [text, dur] of durs) {
      expect(dur, text).toBeCloseTo(readSec(text), 6);
      expect(dur, text).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('holds a line under the banner or a coach mark (hidden, its clock stopped); a card cuts it', () => {
    const talk = new Talk(LINES, mulberry32(3));
    talk.ask('hello', 3, 10);
    talk.update(1.1, 0, false);
    talk.update(0.1, 0.1, false);
    const line = talk.line!;
    expect(line).toBeTruthy();
    talk.update(1, 1, false);
    const t0 = line.t;
    talk.update(3, 4, true);
    expect(talk.line).toBe(line);
    expect(line.held).toBe(true);
    expect(line.t).toBe(t0);
    talk.update(0.1, 4.1, false);
    expect(line.held).toBe(false);
    talk.update(0.1, 4.2, false, true);
    expect(talk.line).toBeNull();
  });

  it('keeps toasts, word floaters, notes, the lymph node and the desk tags on screen long enough', () => {
    const sim = at(2);
    toStage(sim, 'hunt');
    const view = viewAt(CHECK_SIZES[1], true) as unknown as {
      on: OdpView['on']; toasts: { text: string; dur: number }[]; notes: { text: string; dur: number }[]; floaters: { items: { text: string; dur: number }[] };
    };
    view.on({ type: 'fact', id: 'tlr' }, sim);
    view.on({ type: 'stageDone', stage: 'hunt', stars: 3, grace: false }, sim);
    view.on({ type: 'slip', x: 20, y: 30 }, sim);
    view.on({ type: 'charging' }, sim);
    view.on({ type: 'restNote', what: 'heal', n: 3 }, sim);
    for (const x of view.toasts) expect(x.dur, x.text).toBeCloseTo(readSec(x.text), 6);
    expect(view.toasts.length).toBe(2);
    for (const n of view.notes) expect(n.dur, n.text).toBeGreaterThanOrEqual(4.5);
    expect(view.notes.length).toBe(2);
    const word = view.floaters.items.find(f => f.text === t('w.slip'))!;
    expect(word.dur).toBeGreaterThanOrEqual(4.5);
    expect(OdpView.NODE_SEC).toBeGreaterThanOrEqual(readSec(`${t('node.title')} ${t('node.text')}`));
  });

  it('a coach mark that asks for a gesture waits for it; an explanation goes once read and tapped away', () => {
    const cap = new Captions();
    const shown: string[] = [];
    cap.onShow = (_, what) => shown.push(what);
    cap.ask('drag', 'Przeciągnij palcem — Makro pójdzie za nim do bakterii', { kind: 'makro' }, 'drag', 2, { kind: 'nearBug' });
    cap.update(0.1, false, true);
    expect(cap.coach?.what).toBe('drag');
    expect(shown).toEqual(['drag']);   // remembered once shown, not when asked
    // the banner holds it: nothing ages
    cap.update(5, true, true);
    expect(cap.coach!.t).toBe(0);
    for (let i = 0; i < 150; i++) cap.update(0.1, false, true);
    expect(cap.coach?.what).toBe('drag');   // 15 s and nothing else to say: still waiting for the drag
    cap.done('drag');
    cap.update(0.1, false, true);
    expect(cap.coach).toBeNull();   // read long ago: gone the moment it is done
    // another one gives way to the next only once read (and its gesture had a few seconds more)
    cap.ask('swarm', 'Przeciągnij — rój neutrofili pójdzie za palcem i sam wyczuje bakterie', { kind: 'swarm' }, 'drag', 2, { kind: 'nearBug' });
    cap.update(0.1, false, true);
    const swarm = cap.coach!;
    cap.ask('rings', 'Twoje skupienie wzmacnia alarm', { kind: 'makro' }, null, 2);
    let t = 0;
    while (cap.coach === swarm && t < 30) { cap.update(0.1, false, true); t += 0.1; }
    expect(t).toBeGreaterThanOrEqual(swarm.read + Captions.GRACE - 0.15);
    expect(cap.coach?.what).toBe('rings');
    const rings = cap.coach!;
    expect(rings.max).toBeGreaterThanOrEqual(Math.max(rings.read, RULES.infoMin));
    cap.tapped();
    expect(cap.coach).toBe(rings);   // not read yet: a tap does not take it away
    for (let i = 0; i < 60; i++) cap.update(0.1, false, true);
    cap.tapped();
    expect(cap.coach).toBeNull();
  });

  it('shows one coach mark and one gloss at a time, the gloss only beside a coach mark already read; a card ends the coach mark', () => {
    const sim = makeSim({ planned: 300 });
    let early = 0, seen = 0;
    drive(sim, 150, MID, { t: 0 }, () => {
      closeCards(sim)();
      const c = sim.captions.coach, g = sim.captions.gloss;
      if (c && g && g.t === 0 && c.t < c.read) early++;
      if (c || g) seen++;
      if (sim.card) expect(sim.captions.coach).toBeNull();
    });
    expect(seen).toBeGreaterThan(100);
    expect(early).toBe(0);
    expect(sim.captions.glossed.length).toBeGreaterThan(2);
  });

  it('sets a gloss apart from the coach mark’s bubble on the field', () => {
    const sim = makeSim({ planned: 300 });
    const c = CHECK_SIZES[1];
    sim.setWorld(layout(c.w, c.h, c.insets, true).W);
    const view = viewAt(c, true);
    let both = 0;
    drive(sim, 90, MID, { t: 0 }, () => {
      closeCards(sim)();
      if (!sim.captions.coach || !sim.captions.gloss || sim.card) return;
      view.draw(sim, SONG);
      const a = view.coachBox, b = view.label;
      if (!a || !b) return;
      both++;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox > 1 && oy > 1, `${a.text} / ${b.text}`).toBe(false);
    });
    expect(both).toBeGreaterThan(0);
  });
});

describe('round 11: the stage cards', () => {
  it('wait for a tap: the stage does not run under a card (the blocks go on), a tap or Enter closes it', () => {
    const sim = at(1);
    expect(sim.card?.kind).toBe('stage');
    const before = sim.bugs.map(b => `${b.x.toFixed(3)},${b.y.toFixed(3)}`).join('|');
    const block0 = sim.blockT;
    drive(sim, 30, HIGH);
    expect(sim.card?.kind).toBe('stage');
    expect(sim.stageT).toBe(0);
    expect(sim.bugs.map(b => `${b.x.toFixed(3)},${b.y.toFixed(3)}`).join('|')).toBe(before);
    expect(sim.blockT + sim.blockIndex * 100).toBeGreaterThan(block0);
    expect(sim.key('Enter', true)).toBe(true);
    expect(sim.card).toBeNull();
    drive(sim, 1, HIGH);
    expect(sim.stageT).toBeGreaterThan(0.5);
  });

  it('say in three short lines what happens in the body, what you do and what focus changes (at most 70 characters)', () => {
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const s of STAGES) {
        for (const k of ['body', 'you', 'you.mouse', 'focus']) {
          const v = cat[`stage.${s}.${k}`];
          expect(typeof v, `${l} ${s}.${k}`).toBe('string');
          expect((v as string).length, `${l} ${s}.${k}`).toBeLessThanOrEqual(70);
        }
        expect(cat[`stage.${s}.you.mouse`], `${l} ${s}`).toMatch(/klik|click|klick|mysz|mouse|maus|musen/i);
      }
    }
  });

  it('are full the first times a stage begins, short later; „Co się dzieje?” shows the full card any time', () => {
    const p = { ...freshProgress(), sessions: 3, pushes: 4, seen: [...ALL_SEEN], stage: 2 };
    for (let n = 0; n < RULES.fullCards; n++) {
      const sim = new OdpSim({ progress: p, rng: mulberry32(n + 1), plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      expect(sim.card?.full, `session ${n}`).toBe(true);
    }
    const sim = new OdpSim({ progress: p, rng: mulberry32(9), plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.card?.full).toBe(false);
    expect(sim.card?.back).toBe(true);
    drive(sim, 1, MID, { t: 0 }, closeCards(sim));
    expect(sim.card).toBeNull();
    expect(sim.explain()).toBe(true);
    expect(sim.card?.kind).toBe('explain');
    expect(sim.card?.full).toBe(true);
    const stageT = sim.stageT;
    drive(sim, 5, MID, { t: 2 });
    expect(sim.stageT).toBe(stageT);
    expect(sim.key('h', true)).toBe(true);   // a second „?” while a card is up adds nothing
    expect(sim.cards).toHaveLength(1);
  });

  it('open the first session with the story, then the first stage’s card, each waiting for its tap', () => {
    const sim = makeSim();
    expect(sim.cards.map(c => c.kind)).toEqual(['open', 'stage']);
    drive(sim, 20, MID);
    expect(sim.card?.kind).toBe('open');
    sim.tap(sim.W / 2, 50);
    expect(sim.card?.kind).toBe('stage');
    expect(sim.card?.full).toBe(true);
    expect(sim.tap(sim.W / 2, 50)).toBe('none');   // a moment to see it first
    drive(sim, 1, MID, { t: 20 });
    expect(sim.tap(sim.W / 2, 50)).toBe('card');
    expect(sim.card).toBeNull();
  });

  it('puts the „Co się dzieje?” button among the targets, finger-sized, at every checked size', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        const tg = tapTargets(L, { burst: true, net: true, card: false });
        const help = tg.find(x => x.label === 'help');
        expect(help, c.name).toBeTruthy();
        expect(auditTargets(tg, c.w, c.h, c.insets), c.name).toEqual([]);
        expect(L.help.y + L.help.h, c.name).toBeLessThanOrEqual(L.field.y + 0.5);
        expect(tapTargets(L, { burst: true, net: true, card: true }).map(x => x.label), c.name).toEqual(['card']);
      }
    }
  });
});

describe('round 11: what to do now', () => {
  const PATTERNS: Record<(typeof STAGES)[number], RegExp> = {
    alarm: /^Zapal 5 miejsc na ścianie naczynia · \d\/5$/,
    recruit: /^Zatrzymaj 1\d neutrofili · \d+\/1\d$/,
    hunt: /^Oczyść falę · \d+\sbakteri/,
    antibodies: /^Oczyść falę · \d+\sbakteri/,
    tcells: /^Oczyść nos z wirusa · zakażone: \d+$/,
    heal: /^Zamknij ranę · \d+%$/,
  };

  it('gives each stage one goal line with its progress and the gesture’s icon (nothing under a card)', () => {
    STAGES.forEach((s, i) => {
      const sim = at(i);
      expect(sim.doNow(), s).toBeNull();   // the card is up
      toStage(sim, s, MID);
      while (sim.restBlock) drive(sim, 0.5, MID, { t: sim.t }, closeCards(sim));
      const d = sim.doNow()!;
      expect(d.text, s).toMatch(PATTERNS[s]);
      expect(d.icon, s).toBe(s === 'recruit' || s === 'tcells' ? 'tap' : 'drag');
    });
  });

  it('changes only when the action changes: the push keeps its words (the numbers move), a rest asks to breathe', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt', MID);
    const head = (x: string) => x.split(' · ')[0];
    const heads = new Set<string>();
    drive(sim, 6, MID, clock, () => { const d = sim.doNow(); if (d && sim.pushBlock && !sim.burstReady) heads.add(`${d.icon}|${head(d.text)}`); });
    expect(heads.size).toBe(1);
    while (!sim.restBlock) drive(sim, 0.5, MID, clock, closeCards(sim));
    expect(sim.doNow()).toMatchObject({ icon: 'breath', text: t('now.rest') });
    sim.charge = 1;
    while (!sim.pushBlock) drive(sim, 0.5, MID, clock, closeCards(sim));
    drive(sim, 0.2, MID, clock, closeCards(sim));
    if (sim.burstReady) expect(sim.doNow()).toMatchObject({ icon: 'tap', text: t('now.burst'), gold: true });
  });

  it('teaches each control the first time it matters, with the gesture drawn on the thing to touch', () => {
    const sim = makeSim({ planned: 300 });
    const kinds = new Map<string, string>();
    drive(sim, 40, MID, { t: 0 }, () => {
      closeCards(sim)();
      const c = sim.captions.coach, g = sim.gesture();
      if (c && g) kinds.set(c.what, `${g.kind}${g.to ? '>' : ''}`);
    });
    expect(kinds.get('drag')).toBe('drag>');   // from Makro to a bacterium
    // the drag coach waits for the drag: lead Makro and it is done
    const s2 = makeSim({ planned: 300 });
    drive(s2, 4, MID, { t: 0 }, closeCards(s2));
    expect(s2.captions.coach?.what).toBe('drag');
    s2.lead(s2.W * 0.6, 20);
    expect(s2.captions.coach?.done).toBe(true);
    expect(s2.gesture()).toBeNull();
    drive(s2, readSec(s2.captions.coach!.text), MID, { t: 4 });
    expect(s2.captions.coached).toContain('tap');
  });

  it('places the coach mark’s bubble by the thing, inside the field, under the goal line, never on the thing', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const sim = makeSim({ planned: 300 });
        drive(sim, 3, MID, { t: 0 }, closeCards(sim));
        sim.setWorld(layout(c.w, c.h, c.insets, touch).W);
        const view = viewAt(c, touch);
        expect(sim.captions.coach?.what, c.name).toBe('drag');
        view.draw(sim, SONG);
        const b = view.coachBox!, L = view.L;
        expect(b, c.name).toBeTruthy();
        expect(b.y, c.name).toBeGreaterThanOrEqual((L.goalInStrip ? L.strip.y + L.strip.h : L.goal.y + L.goal.h) - 0.5);
        expect(b.y + b.h, c.name).toBeLessThanOrEqual(L.field.y + L.field.h + 0.5);
        expect(b.x, c.name).toBeGreaterThanOrEqual(L.field.x - 0.5);
        expect(b.x + b.w, c.name).toBeLessThanOrEqual(L.field.x + L.field.w + 0.5);
        const onIt = b.px > b.x && b.px < b.x + b.w && b.py > b.y && b.py < b.y + b.h;
        expect(onIt, c.name).toBe(false);
      }
    }
  });
});

describe('round 11: plain words', () => {
  it('has a gloss for every term in four languages: the term, then plain words', () => {
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const g of GLOSSES) expect(cat[`gloss.${g}`], `${l} ${g}`).toMatch(/^.+?( — |: ).{8,}$/);
    }
    expect(glossText('neutrofil')).toBe('Neutrofil — biała krwinka, która zjada bakterie');
  });

  it('explains a term once, the first time its thing shows, and never again for that player', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    let guard = 0;
    while (sim.stage !== 'hunt' && guard++ < 1200) drive(sim, 0.25, HIGH, clock, () => { closeCards(sim)(); if (clock.t % 1.3 < STEP) sim.seekNearest(); });
    drive(sim, 30, HIGH, clock, () => { closeCards(sim)(); if (clock.t % 1.3 < STEP) sim.seekNearest(); });
    const shown = sim.captions.glossed;
    expect(shown).toEqual(expect.arrayContaining(['makrofag', 'bakteria', 'cytokiny', 'neutrofil']));
    expect(new Set(shown).size).toBe(shown.length);
    for (const g of shown) expect(sim.p.glossed).toContain(g);
    // the next session with this progress: none of them again
    const next = new OdpSim({ progress: sim.p, rng: mulberry32(5), plannedSec: 300, eeg: false, tuning: TUNING });
    next.start();
    drive(next, 60, HIGH, { t: 0 }, closeCards(next));
    for (const g of shown) expect(next.captions.glossed, g).not.toContain(g);
  });

  it('shows the lobby an illustrated glossary of the six stages: the picture, in the body, you, how long really', async () => {
    const { progressPanel } = await import('../src/arcade/odpornosc/panel');
    const el = progressPanel(freshProgress(), () => undefined);
    const text = el.textContent ?? '';
    expect(text).toContain(t('panel.stages'));
    for (const s of STAGES) {
      expect(text).toContain(t(`stage.${s}.real` as never));
      expect(text).toContain(t(`stage.${s}.body` as never));
    }
    expect(el.querySelectorAll('canvas').length).toBeGreaterThanOrEqual(STAGES.length);
  });
});

describe('round 11: the mechanics made visible', () => {
  it('says where it happens that a held focus charges the burst, a gulp strengthens the alarm and calm heals', () => {
    const hunt = at(2);
    const ch = toStage(hunt, 'hunt');
    const evs = drive(hunt, 20, HIGH, ch, closeCards(hunt));
    expect(ofType(evs, 'charging')).toHaveLength(1);
    const alarm = at(0);
    const ca = { t: 0 };
    drive(alarm, 0.8, MID, ca);
    alarm.tap(alarm.W / 2, 50);
    alarm.tap(alarm.W / 2, 50);
    const ev2 = drive(alarm, 20, MID, ca, () => { if (ca.t % 1 < STEP) alarm.tap(alarm.W / 2, 50); });
    expect(ofType(ev2, 'gulpRing')).toHaveLength(1);
    const heal = at(5);
    const ck = toStage(heal, 'heal');
    while (!heal.restBlock) drive(heal, 0.5, MID, ck, closeCards(heal));
    const ev3 = drive(heal, 18, LOW, ck, closeCards(heal));
    const notes = ofType(ev3, 'restNote').filter(e => e.what === 'heal');
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n.n).toBeGreaterThanOrEqual(1);
  });

  it('lights at most the goal’s count on the vessel wall in the goal line (no more „10/5”)', () => {
    const sim = at(0);
    for (const p of sim.pads) { p.lit = 1; p.hits = RULES.alarm.padHits; }
    expect(sim.goal().n).toBe(sim.goal().all);
  });
});
