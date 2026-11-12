import { describe, expect, it } from 'vitest';
import { FACTS, FACT_IDS, LINES, LINE_COUNT, LOOPS, MOMENTS, PATHOGENS, STAGES, TIPS, UNLOCKS, loopSpec } from '../src/arcade/odpornosc/content';
import { CATALOGS, t, unit } from '../src/arcade/odpornosc/i18n';
import { checkUnlocks, freshProgress, memoryOf, migrate, type OdpProgress } from '../src/arcade/odpornosc/meta';
import { RULES } from '../src/arcade/odpornosc/rules';
import { OdpSim, finaleFor, planBlocks, recruitNeed, starsFor, stageCap, waveOf, type SimEvent } from '../src/arcade/odpornosc/sim';
import { buildSong, isChorus } from '../src/arcade/odpornosc/song';
import { WORLD_H, layout, sx, sy, tapTargets, wx, wy } from '../src/arcade/odpornosc/layout';
import { fitFont, font, fontPx } from '../src/arcade/odpornosc/paint';
import { coachText, howto } from '../src/arcade/odpornosc/index';
import { CHECK_SIZES, MIN_TAP, MIN_TEXT, TAP_GAP, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { CHORUS_BEATS, songProblems } from '../src/arcade/kit/song';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

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

  it('a rest during the battle lets the player weave collagen: the repair starts under the surface', () => {
    const sim = at(2);
    const clock = toStage(sim, 'hunt');
    expect(sim.stroke(sim.woundX - 12, 10, sim.woundX + 12, 14)).toBe(false);   // not while hunting
    while (!sim.restBlock) drive(sim, 0.5, MID, clock);
    const p0 = sim.prep;
    expect(sim.canWeave).toBe(true);
    expect(sim.stroke(sim.woundX - 12, 10, sim.woundX + 12, 14)).toBe(true);
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
    while (!sim.restBlock) drive(sim, 0.5, MID, clock);
    drive(sim, 2, LOW, clock);
    const evs = drive(sim, 10, LOW, clock);
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
    expect(sim.card?.kind).toBe('back');
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
