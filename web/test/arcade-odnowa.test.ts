import { describe, expect, it } from 'vitest';
import { CARDS, CARD_IDS, LESIONS, LINE_COUNT, MOMENTS, NICHES, lines, type LesionKind } from '../src/arcade/odnowa/content';
import { NEED_SYS, OdnowaView, nowKey } from '../src/arcade/odnowa/render';
import { CATALOGS, atpText, t, unit, type Key } from '../src/arcade/odnowa/i18n';
import {
  SEEN_V, bestOf, enzymeLevel, freshProgress, levelOf, lysoLevel, migrate, mitoLevel, nicheOpen, patchOf, sessionNiche, traitState,
  type OdnowaProgress,
} from '../src/arcade/odnowa/meta';
import { RULES, need, readSec } from '../src/arcade/odnowa/rules';
import {
  COACHES, OdnowaSim, SYSTEMS, driveOf, finaleFor, needs, planBlocks, spinOf, stepSec, type NowKind, type SimEvent, type Sys,
} from '../src/arcade/odnowa/sim';
import { Talk } from '../src/arcade/odnowa/talk';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { BREATH_DEFAULT, breathCycle } from '../src/arcade/kit/breath';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import type { GameEnv } from '../src/arcade/kit/types';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';
import { CHECK_SIZES, DESK_BIG, MIN_READ, MIN_TEXT, THUMB, auditTargets } from '../src/arcade/kit/mobile';
import { CHORUS_BEATS, lineAt, seriesChorus, songProblems } from '../src/arcade/kit/song';
import { buildSong, verseBeats } from '../src/arcade/odnowa/song';
import { laneU, laneX, layout, onLane, onLens, tapTargets } from '../src/arcade/odnowa/layout';
import { font, fontPx } from '../src/arcade/odnowa/paint';
import mod, { coachText, howto } from '../src/arcade/odnowa/index';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, targetRate: 0.55, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.6, activity: 2.5, focused: true, hold: 1, calm: 0.3 });
const LOW = frame({ level: 0.2, activity: -1, focused: false, calm: 0.6 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0 });
/** focused and not calm at all */
const FOCUS0 = frame({ level: 0.9, activity: 5, focused: true, hold: 5, calm: 0 });

const ALL_SEEN = [SEEN_V, 'reveal', ...COACHES];

type SimOpts = { progress?: Partial<OdnowaProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning; niche?: 'gut' | 'skin' | 'blood' };

function makeSim(o: SimOpts = {}): OdnowaSim {
  const p = migrate({ ...freshProgress(), ...o.progress } as OdnowaProgress);
  const sim = new OdnowaSim({ progress: p, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING, niche: o.niche });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, every coach mark seen, the quick reveal). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

function drive(sim: OdnowaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run to the next block of a kind (returns the clock). */
function until(sim: OdnowaSim, kind: 'push' | 'rest', f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): { t: number } {
  let guard = 0;
  while (sim.block.kind !== kind && guard++ < 4000) drive(sim, 0.25, f, clock, each);
  return clock;
}

/** Mend every waiting lesion (a diligent player). */
const tapAll = (sim: OdnowaSim) => () => { for (let k = 0; k < 4 && sim.openLesions.length; k++) sim.repairNext(); };

/** A first session with its opening card closed by a tap. */
function first(o: SimOpts = {}): { sim: OdnowaSim; clock: { t: number } } {
  const sim = makeSim(o);
  const clock = { t: 0 };
  drive(sim, 0.7, MID, clock);
  sim.tap();
  return { sim, clock };
}

describe('the block plan', () => {
  it('opens a first-ever session with a warm-up, alternates pushes and rests and ends on a rest', () => {
    for (const sec of [180, 300, 600]) {
      const plan = planBlocks(sec, true, mulberry32(3));
      expect(plan[0].kind).toBe('warmup');
      expect(plan[0].dur).toBe(sec >= 300 ? RULES.warm.long : RULES.warm.short);
      const rest = plan.slice(1);
      rest.forEach((b, i) => expect(b.kind).toBe(i % 2 ? 'rest' : 'push'));
      expect(rest[rest.length - 1].kind).toBe('rest');
      const total = plan.reduce((s, b) => s + b.dur, 0);
      expect(total, String(sec)).toBeCloseTo(sec - finaleFor(sec), 5);
      for (const b of plan) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      for (const b of plan.filter(x => x.kind === 'push')) expect(b.dur, String(sec)).toBeLessThanOrEqual(32);
    }
  });

  it('makes every rest a whole number of breaths (4 in, 6 out), the pushes take the rest of the time', () => {
    const cyc = breathCycle(BREATH_DEFAULT);
    for (const sec of [120, 180, 300, 600]) {
      for (const firstEver of [false, true]) {
        for (const seed of [1, 7, 42]) {
          const plan = planBlocks(sec, firstEver, mulberry32(seed));
          for (const b of plan.filter(x => x.kind === 'rest')) {
            expect(b.dur % cyc, `${sec} s`).toBeCloseTo(0, 6);
            expect(b.dur).toBeGreaterThanOrEqual(20);
          }
          expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - finaleFor(sec), 5);
        }
      }
    }
  });

  it('fits a 40 s test session (?trainingSec=40) and any planned length from 10 s', () => {
    const p = planBlocks(40, true, mulberry32(1));
    expect(p.map(b => b.kind)).toEqual(['warmup', 'push', 'rest']);
    for (const sec of [10, 15, 25, 40, 60, 90, 180, 600]) {
      for (const firstEver of [false, true]) {
        const plan = planBlocks(sec, firstEver, mulberry32(sec));
        expect(plan.length).toBeGreaterThanOrEqual(2);
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('tells the block, its seconds left and, during the telegraph, the next one', () => {
    const sim = later();
    expect(sim.block.kind).toBe('push');
    const clock = { t: 0 };
    const evs = drive(sim, sim.block.dur - 1, MID, clock);
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
    expect(sim.telegraphed).toBe(true);
    drive(sim, 2, MID, clock);
    expect(sim.block.kind).toBe('rest');
  });

  it('makes every 4th push blind from the 3rd session, never the first push of a session', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 } });
    expect(sim.block.blind).toBe(false);
    const clock = { t: 0 };
    let blind = 0;
    while (sim.phase === 'play' && clock.t < 300) {
      drive(sim, 1, MID, clock);
      if (sim.blind) blind++;
    }
    expect(blind).toBeGreaterThan(0);
    const early = later({ progress: { sessions: 1, pushes: 2 } });
    const c2 = { t: 0 };
    let b2 = 0;
    while (early.phase === 'play' && c2.t < 300) {
      drive(early, 1, MID, c2);
      if (early.blind) b2++;
    }
    expect(b2).toBe(0);
  });

  it('judges each block once at its end from its last 15 s, and a calm rest leaves extra material', () => {
    const sim = later();
    const clock = until(sim, 'rest', HIGH);
    const mat0 = sim.material;
    const evs = drive(sim, sim.block.dur + 0.5, CALM, clock);
    const ends = ofType(evs, 'blockEnd');
    expect(ends).toHaveLength(1);
    expect(ends[0].block.kind).toBe('rest');
    expect(ends[0].verdict).toBe(true);
    expect(sim.passedRests).toBe(1);
    expect(sim.material).toBeGreaterThanOrEqual(mat0 + RULES.calmBonus);
  });

  it('holds the warm-up while the opening card is read (the turbine is shown after it)', () => {
    const sim = makeSim();
    drive(sim, 5, HIGH);
    expect(sim.story).not.toBeNull();
    expect(sim.blockT).toBe(0);
    expect(sim.shown('energy')).toBe(false);
    expect(sim.atp).toBe(0);
    sim.tap();
    drive(sim, 1, HIGH);
    expect(sim.shown('energy')).toBe(true);
    expect(sim.blockT).toBeGreaterThan(0.9);
  });
});

describe('energy: only from focus', () => {
  it('turns 3 ATP out of every full turn, 8 protons a turn', () => {
    expect(RULES.atpPerTurn).toBe(3);
    expect(RULES.protonsPerTurn).toBe(8);
    const sim = later();
    drive(sim, 20, HIGH);
    expect(Math.abs(sim.atp - Math.floor(sim.angle * 3) - sim.bank)).toBeLessThanOrEqual(0);
  });

  it('drives the turbine only while the player is focused: nothing without focus or without a signal', () => {
    expect(driveOf(NONE)).toBe(0);
    expect(driveOf(LOW)).toBe(0);
    expect(driveOf({ reliable: true, focused: false, level: 0.9 })).toBe(0);
    expect(driveOf({ reliable: true, focused: true, level: 0.5 })).toBeCloseTo(RULES.driveMin, 6);
    expect(driveOf({ reliable: true, focused: true, level: 0.95 })).toBe(1);
    expect(spinOf(0)).toBe(0);
    expect(spinOf(1, 1)).toBeCloseTo(RULES.spinMax * (1 + RULES.goldK), 6);
    for (const f of [LOW, NONE, CALM]) {
      const sim = later();
      drive(sim, 25, f);
      expect(sim.atp, JSON.stringify(f)).toBe(0);
      expect(sim.spin).toBe(0);
    }
  });

  it('turns faster the higher the focus, and keeps what was made when the focus goes', () => {
    const lo = later(), hi = later();
    drive(lo, 20, frame({ level: 0.55, focused: true, activity: 2.2 }));
    drive(hi, 20, frame({ level: 0.95, focused: true, activity: 6 }));
    expect(hi.atp).toBeGreaterThan(lo.atp * 1.6);
    const made = hi.atp;
    drive(hi, 5, NONE, { t: 20 });
    expect(hi.atp).toBeGreaterThanOrEqual(made);
    expect(hi.atp).toBeLessThanOrEqual(made + 4);
    expect(hi.spin).toBe(0);
  });

  it('makes no energy in a rest, even with focus (the rest asks for calm)', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    const a = sim.atp;
    drive(sim, 10, HIGH, clock);
    expect(sim.atp - a).toBeLessThanOrEqual(3);
    drive(sim, 5, HIGH, clock);
    expect(sim.spin).toBe(0);
  });

  it('turns gold for a held focus (faster), says so once a push, and counts the time', () => {
    const held = later(), short = later();
    const evs = drive(held, 20, HIGH);
    drive(short, 20, frame({ level: 0.95, activity: 6, focused: true, hold: 1 }));
    expect(held.gold).toBeGreaterThan(0.9);
    expect(short.gold).toBe(0);
    expect(held.atp).toBeGreaterThan(short.atp * 1.25);
    expect(ofType(evs, 'gold')).toHaveLength(1);
    expect(held.goldSec).toBeGreaterThan(10);
  });

  it('banks a blind push’s energy (the headline holds) and shows it when the block ends', () => {
    const sim = later({ progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    let seen = false, still = true, before = 0, block = -1;
    const evs = drive(sim, 300, HIGH, clock, () => {
      if (sim.blind) {
        if (block !== sim.blockIndex) { seen = true; block = sim.blockIndex; before = sim.atp; }
        if (sim.atp !== before) still = false;
      }
    });
    expect(seen).toBe(true);
    expect(still).toBe(true);
    const ends = ofType(evs, 'blindEnd');
    expect(ends.length).toBeGreaterThan(0);
    expect(ends[0].n).toBeGreaterThan(20);
    expect(ends[0].share).toBeGreaterThan(0.5);
    expect(sim.blindShare).toBeGreaterThan(50);
  });

  it('adds the extra mitochondria of biogenesis: more ATP at the same focus', () => {
    const plain = later(), grown = later({ progress: { atpTotal: RULES.mitoAt[1] + 10 } });
    drive(plain, 20, HIGH);
    drive(grown, 20, HIGH);
    expect(grown.mitoCount).toBe(2);
    expect(grown.atp).toBeGreaterThan(plain.atp * 1.3);
  });
});

describe('DNA: damage that waits for a tap', () => {
  it('brings damage onto the visible helix in a push, at most two at a time, and it holds still', () => {
    const sim = later();
    const evs = drive(sim, 15, MID);
    expect(ofType(evs, 'spawn').length).toBeGreaterThan(0);
    expect(sim.liveLesions.length).toBeLessThanOrEqual(RULES.laneCap);
    for (const l of sim.openLesions) {
      expect(l.u).toBeGreaterThanOrEqual(RULES.spawnU[0]);
      expect(l.u).toBeLessThanOrEqual(RULES.spawnU[1]);
    }
    const at = sim.openLesions.map(l => l.u);
    drive(sim, 3, MID, { t: 15 });
    expect(sim.openLesions.slice(0, at.length).map(l => l.u)).toEqual(at);
    if (sim.openLesions.length === 2) expect(Math.abs(sim.openLesions[0].u - sim.openLesions[1].u)).toBeGreaterThanOrEqual(RULES.spawnGap - 1e-9);
  });

  it('sends the crew with one tap: on the lane to the nearest, elsewhere to the one waiting longest; nothing open is a miss', () => {
    const sim = later();
    const clock = { t: 0 };
    while (sim.openLesions.length < 2 && clock.t < 60) drive(sim, 0.5, MID, clock);
    const [a, b] = [...sim.openLesions].sort((x, y) => x.t - y.t);
    expect(sim.aim(null)?.id).toBe(b.id);
    expect(sim.aim(a.u)?.id).toBe(a.id);
    expect(sim.tapLane(a.u)).toBe(true);
    expect(sim.lesions.find(l => l.id === a.id)?.state).toBe('fixing');
    expect(sim.repairNext()).toBe(true);
    expect(sim.lesions.find(l => l.id === b.id)?.state).toBe('fixing');
    sim.take();
    expect(sim.repairNext()).toBe(false);
    expect(ofType(sim.take(), 'miss')).toHaveLength(1);
  });

  it('runs every pathway in its real order after a single tap (BER, NER, end joining)', () => {
    for (const kind of ['oxo', 'dimer', 'dsb'] as LesionKind[]) {
      const sim = later({ niche: kind === 'dimer' ? 'skin' : 'gut', progress: { divisions: 9 } });
      const clock = { t: 0 };
      while (!sim.openLesions.some(l => l.kind === kind) && clock.t < 400) {
        if (kind === 'dsb' && sim.stage < RULES.dsbFrom) sim.stage = RULES.dsbFrom;
        drive(sim, 0.5, NONE, clock);
        for (const l of sim.openLesions) if (l.kind !== kind) sim.tapLane(l.u);
        sim.dna = 0;
        if (sim.restBlock) until(sim, 'push', NONE, clock);
      }
      const l = sim.openLesions.find(x => x.kind === kind);
      expect(l, kind).toBeDefined();
      if (!l) continue;
      sim.take();
      sim.tapLane(l.u);
      const evs = drive(sim, 4, MID, clock);
      const steps = ofType(evs, 'repairStep').filter(e => e.id === l.id).map(e => e.step);
      expect(steps, kind).toEqual([...LESIONS[kind].steps]);
      expect(ofType(evs, 'repaired').some(e => e.id === l.id)).toBe(true);
    }
  });

  it('fills the DNA bar with each repair and brings no more damage once the stage’s repairs are done', () => {
    const sim = later();
    const clock = { t: 0 };
    let full = 0;
    drive(sim, 20, NONE, clock, () => {
      tapAll(sim)();
      for (const e of sim.take()) if (e.type === 'full' && e.need === 1) full++;
    });
    expect(sim.repairsNow).toBeGreaterThanOrEqual(sim.needs.dna);
    expect(sim.dna).toBe(sim.repairsNow);
    expect(full).toBe(1);
    const evs = drive(sim, 5, NONE, clock, tapAll(sim));
    expect(sim.block.kind).toBe('push');
    expect(ofType(evs, 'spawn')).toHaveLength(0);
  });

  it('brings no damage in a rest; there the cell’s own crew mends waiting damage — only as fast as the calm allows', () => {
    const sim = later();
    const clock = until(sim, 'rest', NONE);
    const waiting = sim.openLesions.length;
    expect(waiting).toBeGreaterThan(0);
    const restless = drive(sim, 4, NONE, clock);
    expect(ofType(restless, 'spawn')).toHaveLength(0);
    expect(sim.openLesions.length).toBe(waiting);
    const evs = drive(sim, RULES.cellFix + 4, CALM, clock);
    expect(ofType(evs, 'repairStart').some(e => e.by === 'cell')).toBe(true);
    expect(ofType(evs, 'spawn')).toHaveLength(0);
  });

  it('times the steps by the enzymes’ level; a double-strand break and the cell’s own crew are slower', () => {
    expect(stepSec(1, 'oxo', 'tap')).toBeLessThan(stepSec(0, 'oxo', 'tap'));
    expect(stepSec(0, 'dsb', 'tap')).toBeGreaterThan(stepSec(0, 'oxo', 'tap'));
    expect(stepSec(0, 'oxo', 'cell')).toBeGreaterThan(stepSec(0, 'oxo', 'tap'));
  });

  it('brings each niche its own damage: UV dimers in the skin, none in the gut', () => {
    const count = (niche: 'gut' | 'skin') => {
      const sim = later({ niche, planned: 600 });
      const kinds: LesionKind[] = [];
      drive(sim, 400, MID, { t: 0 }, () => {
        for (const e of sim.take()) if (e.type === 'spawn') kinds.push(e.kind);
        tapAll(sim)();
      });
      return kinds;
    };
    expect(count('skin')).toContain('dimer');
    expect(count('gut')).not.toContain('dimer');
  });
});

describe('the clean-up: only with calm', () => {
  it('tags, wraps, carries and digests worn parts in a rest, giving building material back', () => {
    const sim = later();
    const clock = until(sim, 'rest', MID);
    const evs = drive(sim, sim.block.dur - 0.5, CALM, clock);
    expect(ofType(evs, 'part').length).toBeGreaterThan(0);
    expect(ofType(evs, 'sealed').length).toBeGreaterThan(0);
    const rec = ofType(evs, 'recycled');
    expect(rec.length).toBeGreaterThan(0);
    expect(sim.material).toBeGreaterThanOrEqual(rec.reduce((s, e) => s + e.mat, 0));
  });

  it('wraps nothing without calm (no signal, or no calm) — and loses nothing; calm finishes the job', () => {
    for (const f of [NONE, FOCUS0]) {
      const sim = later();
      const clock = until(sim, 'rest', MID);
      drive(sim, 6, f, clock);
      const wrapping = sim.parts.filter(p => p.phase === 'wrap');
      expect(wrapping.length).toBeGreaterThan(0);
      for (const p of wrapping) expect(p.k).toBe(0);
      expect(sim.material).toBe(0);
      drive(sim, 9, CALM, clock);
      expect(sim.parts.some(p => p.phase !== 'wrap' && p.phase !== 'tag') || sim.material > 0).toBe(true);
    }
  });

  it('wraps faster with deeper calm', () => {
    const k = (calm: number) => {
      const sim = later();
      const clock = until(sim, 'rest', MID);
      drive(sim, 4, frame({ level: 0.2, calm }), clock);
      return sim.parts.filter(p => p.phase === 'wrap').reduce((s, p) => Math.max(s, p.k), 0);
    };
    expect(k(0.9)).toBeGreaterThan(k(0.3) * 2);
  });

  it('brings worn parts only in a rest', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur - 1, CALM);
    expect(ofType(evs, 'part')).toHaveLength(0);
  });
});

describe('the division', () => {
  it('grows the needs with the stages', () => {
    expect(needs(1)).toEqual({ atp: RULES.atpNeed[0], dna: RULES.dnaNeed[0], mat: RULES.matNeed[0] });
    expect(needs(3).atp).toBeGreaterThan(needs(2).atp);
    expect(needs(3).dna).toBe(RULES.dnaNeed[0] + 2);
    expect(needs(50).atp).toBe(RULES.atpNeed[2]);
    expect(need([5, 1, 7], 9, false)).toBe(7);
  });

  it('divides once the three needs are full and no damage is open; the daughter joins the tissue', () => {
    const sim = later();
    const clock = { t: 0 };
    let cells = 0;
    drive(sim, 200, () => (sim.restBlock ? CALM : HIGH), clock, () => {
      tapAll(sim)();
      for (const e of sim.take()) if (e.type === 'cell') cells++;
    });
    expect(sim.divisionsNow).toBeGreaterThanOrEqual(1);
    expect(cells).toBe(sim.divisionsNow);
    expect(sim.stage).toBe(sim.divisionsNow + 1);
    expect(sim.dna).toBeLessThan(sim.needs.dna + RULES.laneCap);
    sim.finish();
    expect(sim.p.tissue.gut).toBe(sim.divisionsNow);
  });

  it('holds the division at the checkpoint while damage is open, and says so on the line', () => {
    const sim = later();
    const clock = { t: 0 };
    while (!sim.openLesions.length && clock.t < 30) drive(sim, 0.25, MID, clock);
    const n = sim.needs;
    sim.stageAtp = n.atp;
    sim.material = n.mat;
    sim.dna = n.dna;
    const evs = drive(sim, 3, MID, clock);
    expect(ofType(evs, 'checkpoint')).toHaveLength(1);
    expect(sim.mitosis).toBeNull();
    expect(sim.now).toBe('check');
    tapAll(sim)();
    const after = drive(sim, 6, MID, clock);
    expect(ofType(after, 'divide')).toHaveLength(1);
  });

  it('carries spare energy and material into the next division (what was gained stays)', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 3, NONE, clock);
    while (sim.liveLesions.length) { tapAll(sim)(); drive(sim, 2, NONE, clock); }
    const n = sim.needs;
    sim.stageAtp = n.atp + 7;
    sim.material = n.mat + 2;
    sim.dna = n.dna;
    drive(sim, 9, NONE, clock);
    expect(sim.divisionsNow).toBe(1);
    expect(sim.stageAtp).toBe(7);
    expect(sim.material).toBe(2);
    expect(sim.dna).toBe(0);
  });

  it('a session ended mid-division still counts the new cell', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 3, NONE, clock);
    while (sim.liveLesions.length) { tapAll(sim)(); drive(sim, 2, NONE, clock); }
    const n = sim.needs;
    Object.assign(sim, { stageAtp: n.atp, material: n.mat, dna: n.dna });
    drive(sim, 1, NONE, clock);
    expect(sim.mitosis).not.toBeNull();
    sim.finish();
    expect(sim.divisionsNow).toBe(1);
    expect(sim.p.tissue.gut).toBe(1);
  });
});

describe('the reveal: one system at a time', () => {
  it('shows the first session energy, then DNA, then the clean-up, then the division', () => {
    const { sim, clock } = first();
    const order: Sys[] = [];
    drive(sim, 120, () => (sim.restBlock ? CALM : HIGH), clock, () => {
      tapAll(sim)();
      for (const e of sim.take()) if (e.type === 'reveal') order.push(e.sys);
    });
    expect(order).toEqual([...SYSTEMS]);
    expect(sim.p.seen).toContain('reveal');
  });

  it('opens the DNA once the turbine has made energy (or after a while), the clean-up with the first rest', () => {
    const { sim, clock } = first();
    drive(sim, RULES.dnaAfter - 1, HIGH, clock);
    expect(sim.shown('energy')).toBe(true);
    expect(sim.shown('dna')).toBe(false);
    expect(sim.lesions).toHaveLength(0);
    drive(sim, 2, HIGH, clock);
    expect(sim.shown('dna')).toBe(true);
    expect(sim.shown('clean')).toBe(false);
    // a player who never focuses still gets there, a little later
    const idle = first();
    drive(idle.sim, RULES.dnaMax - 1, LOW, idle.clock);
    expect(idle.sim.shown('dna')).toBe(false);
    drive(idle.sim, 2, LOW, idle.clock);
    expect(idle.sim.shown('dna')).toBe(true);
    until(sim, 'rest', HIGH, clock);
    drive(sim, 0.2, CALM, clock);
    expect(sim.shown('clean')).toBe(true);
    expect(sim.shown('divide')).toBe(false);
  });

  it('shows a returning player the four in a quick stagger, in the same order', () => {
    const sim = later();
    const at: Record<string, number> = {};
    drive(sim, 10, MID, { t: 0 }, tt => { for (const e of sim.take()) if (e.type === 'reveal') at[e.sys] = tt; });
    expect(Object.keys(at)).toEqual([...SYSTEMS]);
    expect(at.divide).toBeLessThan(8);
    expect(sim.slow).toBe(false);
  });

  it('teaches with coach marks in order, each once, never two at a time', () => {
    const { sim, clock } = first();
    const evs = drive(sim, 120, () => (sim.restBlock ? CALM : HIGH), clock, tapAll(sim));
    const coach = ofType(evs, 'coach').map(e => e.what);
    const order = ['turbine', 'energy', 'lane', 'repair', 'rest', 'divide'] as const;
    for (const c of order) expect(coach, c).toContain(c);
    for (let i = 1; i < order.length; i++) expect(coach.indexOf(order[i]), order[i]).toBeGreaterThan(coach.indexOf(order[i - 1]));
    expect(new Set(coach).size).toBe(coach.length);
    const again = later();
    expect(ofType(drive(again, 60, HIGH, { t: 0 }, tapAll(again)), 'coach')).toHaveLength(0);
  });

  it('keeps the key coach marks until the thing is done (the turbine turned, the damage tapped, the rest cleaned)', () => {
    const { sim, clock } = first();
    expect(sim.coachDone('turbine')).toBe(false);
    drive(sim, 5, HIGH, clock);
    expect(sim.coachDone('turbine')).toBe(true);
    drive(sim, 12, HIGH, clock);
    expect(sim.openLesions.length).toBeGreaterThan(0);
    expect(sim.coachDone('lane')).toBe(false);
    sim.repairNext();
    expect(sim.coachDone('lane')).toBe(true);
  });

  it('teaches a player of the first version again (the game changed): the explanations are forgotten, nothing else', () => {
    const p = migrate({ ...freshProgress(), sessions: 9, divisions: 6, seen: ['lane', 'turbine', 'surge', 'two'], atpTotal: 3000 } as OdnowaProgress);
    expect(p.seen).toEqual([SEEN_V]);
    expect(p.divisions).toBe(6);
    const sim = new OdnowaSim({ progress: p, rng: mulberry32(3), plannedSec: 300, eeg: false, tuning: TUNING });
    sim.start();
    expect(sim.slow).toBe(true);
    expect(sim.story).toBeNull();
    const evs = drive(sim, 4, HIGH);
    expect(ofType(evs, 'coach').map(e => e.what)).toContain('turbine');
  });
});

describe('what to do now: the line', () => {
  it('names the action of the moment: energy, the damage, rest, blind, the division, no signal, the end', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 2, MID, clock);
    expect(sim.now).toBe('energy');
    while (!sim.openLesions.some(l => l.t >= RULES.nowDna + 0.1) && clock.t < 40) drive(sim, 0.2, MID, clock);
    drive(sim, 0.5, MID, clock);
    expect(sim.now).toBe('dna');
    until(sim, 'rest', MID, clock);
    drive(sim, 0.1, CALM, clock);
    expect(sim.now).toBe('rest');
    drive(sim, RULES.noSignal + 0.5, NONE, clock);
    expect(sim.now).toBe('nosignal');
    const blind = later({ progress: { sessions: 4, pushes: 2 } });
    const c2 = { t: 0 };
    const kinds = new Set<NowKind>();
    drive(blind, 300, HIGH, c2, () => { tapAll(blind)(); if (blind.blind) kinds.add(blind.now); });
    expect(kinds.has('blind')).toBe(true);
    expect(blind.now).toBe('end');
  });

  it('changes only when the action changes: a quick tapper never sees the damage prompt, a change holds 2.5 s', () => {
    const quick = later();
    const seen = new Set<NowKind>();
    drive(quick, 25, MID, { t: 0 }, () => { tapAll(quick)(); seen.add(quick.now); });
    expect(seen.has('dna')).toBe(false);
    const slow = later();
    const clock = { t: 0 };
    let changes: { kind: NowKind; t: number }[] = [];
    drive(slow, 26, MID, clock, tt => {
      for (const e of slow.take()) if (e.type === 'now') changes.push({ kind: e.kind, t: tt });
      // tap 2 s after a lesion appears
      for (const l of slow.openLesions) if (l.t > 2) slow.tapLane(l.u);
    });
    changes = changes.filter(c => c.kind === 'dna' || c.kind === 'energy');
    for (let i = 1; i < changes.length; i++) expect(changes[i].t - changes[i - 1].t).toBeGreaterThanOrEqual(RULES.nowHold - 0.05);
    expect(changes.some(c => c.kind === 'dna')).toBe(true);
  });

  it('has the line in every language, short, with clicks for a mouse and taps for a finger', () => {
    const KINDS: NowKind[] = ['wait', 'energy', 'dna', 'rest', 'blind', 'check', 'divide', 'nosignal', 'end'];
    const TAP: Record<string, RegExp> = { pl: /stuk/i, en: /\btap/i, de: /tipp/i, sv: /\btryck/i };
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, string>;
      for (const k of KINDS) {
        for (const touch of [true, false]) {
          const s = cat[nowKey(k, touch)];
          expect(s, `${l}.${nowKey(k, touch)}`).toBeTruthy();
          expect(s.length, `${l}.${k}`).toBeLessThanOrEqual(56);
          if (!touch) expect(s, `${l}.${k}`).not.toMatch(TAP[l]);
        }
      }
      expect(cat['now.dna'], l).toMatch(TAP[l]);
      expect(cat['now.dna.mouse'], l).toMatch(/klik|click|klick/i);
    }
  });
});

describe('reading time: captions stay long enough to read twice', () => {
  it('gives a caption 2.5 s + 70 ms a character, never under 4.5 s', () => {
    expect(readSec('')).toBe(4.5);
    expect(readSec('x'.repeat(10))).toBe(4.5);
    expect(readSec('x'.repeat(60))).toBeCloseTo(2.5 + 0.07 * 60, 6);
    expect(readSec('x'.repeat(90))).toBeCloseTo(8.8, 6);
  });

  it('keeps each of Mito’s lines on screen its reading time, waiting (never cut) while a coach mark is up', () => {
    const talk = new Talk(lines(), mulberry32(2));
    talk.ask('push', 2, 10);
    talk.update(0.1, 0.1, false);
    const line = talk.line!;
    expect(line.dur).toBeCloseTo(readSec(line.text), 6);
    let t = 0.1;
    for (; t < line.dur - 0.5; t += 0.1) talk.update(0.1, t, false);
    // a coach mark comes: the line waits, its clock stops
    for (let i = 0; i < 50; i++) talk.update(0.1, (t += 0.1), true, false);
    expect(talk.line?.text).toBe(line.text);
    for (let i = 0; i < 8; i++) talk.update(0.1, (t += 0.1), false);
    expect(talk.line).toBeNull();
    // a card over everything cuts it
    talk.ask('rest', 2, 10);
    talk.update(2, (t += 2), false);
    expect(talk.line).not.toBeNull();
    talk.update(0.1, (t += 0.1), true, true);
    expect(talk.line).toBeNull();
  });

  it('shows the coach marks for their reading time; the first tap’s stays until the player taps', () => {
    const { game, hints } = playGame();
    let clock = 0;
    const tick = (sec: number, f: FocusFrame) => { for (let i = 0; i < Math.round(sec / STEP); i++) game.update(STEP, f, (clock += STEP)); };
    tick(0.8, HIGH);
    game.pointer!({ type: 'down', x: 180, y: 300, id: 1 });
    tick(20, HIGH);
    const shown = hints.filter(h => h.text);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    for (const h of shown) expect(h.ms, h.text).toBeGreaterThanOrEqual(readSec(h.text) * 1000 - 1);
    const lane = coachText('lane', true);
    tick(20, HIGH);
    const laneAt = hints.findIndex(h => h.text === lane);
    expect(laneAt).toBeGreaterThanOrEqual(0);
    // no tap yet: the mark stays (nothing hid it)
    expect(hints.slice(laneAt + 1).some(h => h.text === '')).toBe(false);
    // a tap anywhere sends the crew; after its reading time the mark goes
    game.pointer!({ type: 'down', x: 180, y: 300, id: 2 });
    tick(readSec(lane) + 0.5, HIGH);
    expect(hints.slice(laneAt + 1).some(h => h.text === '')).toBe(true);
    game.destroy();
  });
});

/** The whole game on a fake runner (no canvas, no sound): a first session on a small phone. */
function playGame(touch = true) {
  const hints: { text: string; ms: number }[] = [];
  const canvas = { getContext: () => null, addEventListener() {}, removeEventListener() {}, style: {} } as unknown as HTMLCanvasElement;
  const audio = { on: false, pad() {}, tone() {}, bell() {}, noiseBurst() {}, combo() {} } as unknown as ArcadeAudio;
  const ins = CHECK_SIZES[0].insets;
  const env: GameEnv<OdnowaProgress> = {
    canvas, hud: {} as HTMLElement, audio, progress: migrate({ ...freshProgress(), song: false }), rng: mulberry32(5), day: '2026-11-17', daySeed: 1,
    plannedSec: 300, tool: 'fnirs', simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
    hint: (text, _at, ms = 3500) => { hints.push({ text, ms }); }, hudTop: () => ins.top, insets: () => ins, touch,
  };
  const game = mod.create(env);
  game.resize(CHECK_SIZES[0].w, CHECK_SIZES[0].h, 1);
  game.start();
  return { game, hints, env };
}

describe('the session', () => {
  it('scores with the smoke test’s crude input (a centre tap every 0.65 s, Space every ~2 s, focus on) within 22 s', () => {
    for (const planned of [40, 300]) {
      const sim = makeSim({ tuning: BEGINNER, planned });
      let next = 0.65, space = 1.95;
      drive(sim, 22, HIGH, { t: 0 }, tt => {
        if (tt >= next) {
          next += 0.65;
          if (!sim.tap()) sim.repairNext();
        }
        if (tt >= space) {
          space += 1.95;
          sim.key(' ', true);
          sim.key(' ', false);
        }
      });
      expect(sim.result().score, String(planned)).toBeGreaterThan(0);
      expect(sim.atp).toBeGreaterThan(20);
      expect(sim.repairsNow).toBeGreaterThan(0);
    }
  });

  it('scores within 22 s with no input at all, focused (the opening card closes by itself)', () => {
    const sim = makeSim();
    drive(sim, 22, HIGH);
    expect(sim.story).toBeNull();
    expect(sim.atp).toBeGreaterThan(0);
  });

  it('gives result() idempotently and keeps records with Math.max', () => {
    const sim = later();
    drive(sim, 30, HIGH);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(a.unit).toBe('ATP');
    expect(sim.p.best['300']).toBe(a.score);
    sim.finish();
    const total = sim.p.atpTotal;
    sim.result();
    sim.finish();
    expect(sim.p.atpTotal).toBe(total);
  });

  it('settles once at the end (or early) and counts the session', () => {
    const sim = later({ planned: 40 });
    const clock = { t: 0 };
    drive(sim, 46, MID, clock);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.atpTotal).toBe(sim.atp);
    const early = later();
    drive(early, 20, MID);
    early.finish();
    early.finish();
    expect(early.p.sessions).toBe(6);
    expect(early.phase).toBe('done');
  });

  it('hides the gauge in a blind push and without a signal, shows calm in a rest', () => {
    const sim = later();
    drive(sim, 4, NONE);
    expect(sim.meter()).toBeNull();
    drive(sim, 2, HIGH);
    expect(sim.meter()).not.toBeNull();
    const clock = until(sim, 'rest', HIGH);
    drive(sim, 3, CALM, clock);
    expect(sim.meter()).toBeGreaterThan(0.5);
    const blind = later({ progress: { sessions: 4, pushes: 2 } });
    let hidden = true, sawBlind = false;
    drive(blind, 300, HIGH, { t: 0 }, () => {
      if (blind.blind) {
        sawBlind = true;
        if (blind.meter() !== null || blind.songLevel(HIGH) !== null || blind.padLevel(HIGH) !== null) hidden = false;
      }
    });
    expect(sawBlind).toBe(true);
    expect(hidden).toBe(true);
  });

  it('closes with a passage that exists, fitting what happened', () => {
    for (const s of [later(), makeSim(), later({ niche: 'skin' })]) {
      drive(s, 40, MID, { t: 0 }, () => { if (s.story) s.tap(); });
      const r = s.result();
      expect(r.verse).toBeDefined();
      expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    }
    expect(makeSim().closingVerse()).toBe('psa139.16');
  });

  it('keeps the headline the same as the result, with readable stats and highlights', () => {
    const sim = later();
    drive(sim, 60, MID, { t: 0 }, tapAll(sim));
    const r = sim.result();
    expect(r.score).toBe(sim.atp);
    expect(r.stats.length).toBeGreaterThanOrEqual(5);
    for (const [k, v] of r.stats) {
      expect(k.length).toBeGreaterThan(0);
      expect(v.length).toBeGreaterThan(0);
    }
    expect(r.highlights.length).toBeGreaterThan(0);
  });

  it('lets Mito speak one message at a time: never over a coach mark, a card of the view or a new cell’s toast', () => {
    const sim = later();
    const clock = { t: 0 };
    sim.holdTalk = true;
    drive(sim, 10, MID, clock);
    expect(sim.talk.said).toEqual([]);
    sim.holdTalk = false;
    sim.hintUp = true;
    drive(sim, 5, MID, clock);
    expect(sim.talk.said).toEqual([]);
    sim.hintUp = false;
    sim.hintQueued = true;
    drive(sim, 3, MID, clock);
    expect(sim.talk.said).toEqual([]);
    sim.hintQueued = false;
    // a held focus turns the turbine gold: Mito says so
    drive(sim, 5, HIGH, clock);
    expect(sim.talk.said.length).toBeGreaterThan(0);
  });

  it('answers a tap on Mito with what to do now, in his words', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 12, MID, clock);
    sim.talk.clear();
    sim.askHelp();
    drive(sim, 0.2, MID, clock);
    const help = lines()[sim.now === 'dna' ? 'help.dna' : 'help.energy'];
    expect(help).toContain(sim.talk.line?.text);
    until(sim, 'rest', MID, clock);
    drive(sim, RULES.bannerSec + 0.5, CALM, clock);
    sim.askHelp();
    drive(sim, 0.2, CALM, clock);
    expect(lines()['help.rest']).toContain(sim.talk.line?.text);
  });

  it('meets Wiedza cards in play, once each', () => {
    const sim = later({ planned: 600, niche: 'skin' });
    const evs = drive(sim, 300, () => (sim.restBlock ? CALM : HIGH), { t: 0 }, tapAll(sim));
    const ids = ofType(evs, 'card').map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['turbine', 'lesions', 'ber', 'autophagy', 'turnover', 'skin', 'speed'] as const) expect(ids, id).toContain(id);
    expect(sim.p.cards.length).toBe(ids.length);
  });
});

describe('the meta', () => {
  it('counts trait levels from the lifetime totals', () => {
    expect(levelOf([10, 20], 9)).toBe(0);
    expect(levelOf([10, 20], 20)).toBe(2);
    expect(mitoLevel({ atpTotal: RULES.mitoAt[0] })).toBe(1);
    expect(enzymeLevel({ repairs: RULES.enzymeAt[2] + 5 })).toBe(3);
    expect(lysoLevel({ recycled: 0 })).toBe(0);
    const p = freshProgress();
    p.repairs = RULES.enzymeAt[0];
    expect(traitState(p, 'enzyme')).toEqual({ level: 1, max: 3, total: RULES.enzymeAt[0], next: RULES.enzymeAt[1] });
  });

  it('opens the niches with divisions and takes them in turn, or the chosen one', () => {
    const p = freshProgress();
    expect(sessionNiche(p)).toBe('gut');
    expect(nicheOpen(p, 'skin')).toBe(false);
    p.divisions = RULES.nicheAt.blood;
    p.lastNiche = 'gut';
    expect(sessionNiche(p)).toBe('skin');
    p.lastNiche = 'skin';
    expect(sessionNiche(p)).toBe('blood');
    p.lastNiche = 'blood';
    expect(sessionNiche(p)).toBe('gut');
    p.niche = 'blood';
    expect(sessionNiche(p)).toBe('blood');
    p.divisions = 0;
    expect(sessionNiche(p)).toBe('gut');
  });

  it('grows the tissue in patches of twelve and remembers the best', () => {
    const p = freshProgress();
    p.tissue.skin = 27;
    expect(patchOf(p, 'skin')).toEqual({ patches: 2, cells: 3, of: 12 });
    expect(bestOf(p)).toBeNull();
    p.best = { '300': 400, '600': 900 };
    expect(bestOf(p)).toBe(900);
  });

  it('levels a trait up during play, once, and says so', () => {
    const sim = later({ progress: { atpTotal: RULES.mitoAt[0] - 5 } });
    const evs = drive(sim, 10, MID);
    const ups = ofType(evs, 'up');
    expect(ups).toHaveLength(1);
    expect(ups[0]).toEqual({ type: 'up', trait: 'mito', level: 1 });
    expect(sim.upsNow).toEqual(['mito']);
  });

  it('keeps a progress pace in a fair band over a week of 5-minute sessions (simulated play)', () => {
    const p = migrate(freshProgress());
    const rnd = mulberry32(77);
    for (let s = 0; s < 7; s++) {
      const sim = new OdnowaSim({ progress: p, rng: mulberry32(100 + s), plannedSec: 300, eeg: false, tuning: TUNING });
      sim.start();
      // focus about two thirds of a push, calm most of a rest, a lesion tapped within a few seconds
      drive(sim, 310, tt => (sim.restBlock ? (tt % 7 < 5 ? CALM : LOW) : tt % 9 < 6 ? HIGH : LOW), { t: 0 }, () => {
        if (sim.story) sim.tap();
        if (sim.openLesions.length && rnd() < 0.02) sim.repairNext();
      });
      sim.finish();
    }
    // a week: a dozen or more cells, two niches open, a first trait or two
    expect(p.divisions).toBeGreaterThanOrEqual(10);
    expect(p.divisions).toBeLessThanOrEqual(40);
    expect(nicheOpen(p, 'skin')).toBe(true);
    expect(mitoLevel(p) + enzymeLevel(p) + lysoLevel(p)).toBeGreaterThanOrEqual(2);
    expect(p.cards.length).toBeGreaterThanOrEqual(12);
  });

  it('makes no division at all without focus (the hands and the calm alone are not enough)', () => {
    const sim = later({ planned: 600 });
    drive(sim, 600, () => (sim.restBlock ? CALM : LOW), { t: 0 }, tapAll(sim));
    expect(sim.atp).toBe(0);
    expect(sim.divisionsNow).toBe(0);
    expect(sim.repairsNow).toBeGreaterThan(0);
    expect(sim.material).toBeGreaterThan(0);
  });
});

describe('old saves', () => {
  it('reads the placeholder’s save ({ ver: 1, sessions: n }) and keeps the count', () => {
    const p = migrate(mergeSaved(freshProgress(), { ver: 1, sessions: 4 }) as OdnowaProgress);
    expect(p.ver).toBe(1);
    expect(p.sessions).toBe(4);
    expect(p.tissue).toEqual({ gut: 0, skin: 0, blood: 0 });
    expect(p.song).toBe(true);
    expect(migrate(p)).toBe(p);
    const sim = new OdnowaSim({ progress: p, rng: mulberry32(2), plannedSec: 180, eeg: true, tuning: TUNING });
    sim.start();
    expect(sim.session).toBe(5);
    drive(sim, 10, MID);
    expect(sim.result().score).toBeGreaterThan(0);
  });

  it('repairs fields of a wrong type', () => {
    const saved = {
      ver: 1, sessions: '3', pushes: 9, atpTotal: 5000.7, repairs: -4, recycled: 'x', divisions: 2, tissue: { gut: 5, skin: 'no' },
      log: { oxo: 3, nope: 9 }, cards: ['turbine', 'ghost', 'turbine', 7], seen: [SEEN_V, 'lane', 3], best: { '300': 420, x: 9, '600': 'y' },
      bestCombo: 99, niche: 'liver', lastNiche: 'skin', song: 'yes', lyrics: false,
    };
    const p = migrate(mergeSaved(freshProgress(), saved) as OdnowaProgress);
    expect(p.sessions).toBe(0);
    expect(p.atpTotal).toBe(5000);
    expect(p.repairs).toBe(0);
    expect(p.recycled).toBe(0);
    expect(p.tissue).toEqual({ gut: 5, skin: 0, blood: 0 });
    expect(p.divisions).toBe(5);
    expect(p.log.oxo).toBe(3);
    expect(p.cards).toEqual(['turbine']);
    expect(p.seen).toEqual([SEEN_V, 'lane']);
    expect(p.best).toEqual({ '300': 420 });
    expect(p.bestCombo).toBe(RULES.comboMax);
    expect(p.niche).toBe('auto');
    expect(p.lastNiche).toBe('skin');
    expect(p.song).toBe(true);
    expect(p.lyrics).toBe(false);
  });

  it('survives garbage', () => {
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, tissue: 'x', log: [], cards: {}, best: [] }]) {
      const p = migrate(mergeSaved(freshProgress(), junk) as OdnowaProgress);
      expect(p.ver).toBe(1);
      expect(Array.isArray(p.cards)).toBe(true);
      expect(typeof p.tissue.gut).toBe('number');
      const sim = new OdnowaSim({ progress: p, rng: mulberry32(4), plannedSec: 60, eeg: false, tuning: TUNING });
      sim.start();
      drive(sim, 3, NONE);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives Mito at least two lines a moment (three for the frequent ones), each fitting a bubble (90 characters)', () => {
    for (const m of MOMENTS) expect(LINE_COUNT[m], m).toBeGreaterThanOrEqual(m.startsWith('help.') ? 2 : 3);
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.')) expect((v as string).length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
    const all = lines();
    for (const m of MOMENTS) expect(all[m].length).toBe(LINE_COUNT[m]);
  });

  it('keeps Polish letters and Polish words out of the other languages, and quotes in each language’s marks', () => {
    for (const l of ['en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) {
          expect(s, `${l}.${k}`).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]|\b(opask[aęi]|się|albo|Gra|Graj)\b/);
          if (/[„“”"]/.test(s)) expect(s, `${l}.${k}`).toMatch(l === 'de' ? /„[^„”"“]+“/ : l === 'sv' ? /”[^„”"“]+”/ : /“[^„”"“]+”/);
        }
      }
    }
    for (const [k, v] of Object.entries(CATALOGS.pl)) if (typeof v === 'string' && /[„“”"]/.test(v)) expect(v, k).toMatch(/„[^„”"“]+”/);
  });

  it('suggests strategies, never to concentrate harder', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!/^(tip|how)\./.test(k) || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
      }
    }
  });

  it('never promises healing; the how-to’s last tip says the band measures attention and it is no treatment', () => {
    for (const l of LANGS) {
      expect(CATALOGS[l]['how.tip2'], l).toMatch(/leczenia|treatment|Behandlung|vård/);
      expect(CATALOGS[l]['how.tip2'], l).toMatch(/uwag|attention|Aufmerksamkeit|uppmärksamhet/);
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) expect(s, `${l}.${k}`).not.toMatch(/uleczy|wyleczy|heals you|cures|heilt dich|botar/i);
      }
    }
  });

  it('keeps a no-break space between a number and its unit, and before % in German and Swedish', () => {
    expect(atpText(120)).toBe('120 ATP');
    expect(unit(5)).toBe('ATP');
    for (const l of ['de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) expect(s, `${l}.${k}`).not.toMatch(/\d %|\} ?%/);
      }
    }
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        for (const s of typeof v === 'string' ? [v] : Object.values(v)) expect(s, `${l}.${k}`).not.toMatch(/(\d|\}) (dni|days|Tage|dagar|mV|min|ATP|s)\b/);
      }
    }
  });

  it('gives every Wiedza card a title, a number, a sentence and a source', () => {
    expect(CARD_IDS.length).toBeGreaterThanOrEqual(20);
    for (const c of CARDS) {
      expect(c.src.length, c.id).toBeGreaterThan(8);
      for (const part of ['title', 'num', 'text'] as const) expect(t(`card.${c.id}.${part}` as Key).length, `${c.id}.${part}`).toBeGreaterThan(2);
    }
    for (const n of NICHES) expect(t(`niche.${n}` as Key)).not.toBe(`niche.${n}`);
  });

  it('says plain words first and the biochemistry second, small: the turbine, the crew, the clean-up', () => {
    expect(t('coach.turbine')).toMatch(/^To turbina komórki \(syntaza ATP\)/);
    expect(t('lane.crew', { step: 'ligaza' })).toBe('ekipa naprawcza · ligaza');
    expect(t('coach.rest')).toMatch(/sprząta stare części \(autofagia\)/);
    for (let i = 0; i < 4; i++) expect(t(`mit.${i}` as Key)).toMatch(/^[a-zżźćńółęąś ]+ \([a-z]+\)$/);
  });
});

describe('the song', () => {
  it('is a sound song: verses of 32 beats around the series refrain, no note outside the loop', () => {
    const song = buildSong();
    expect(songProblems(song)).toEqual([]);
    expect(verseBeats()).toEqual([32, 32]);
    expect(song.beats).toBe(64 + 2 * CHORUS_BEATS);
    expect(song.lines).toHaveLength(16);
    // its own verses in the page's language, the refrain twice
    expect(song.lines[0].text).toBe(t('song.a.1'));
    expect(song.lines[8].text).toBe(t('song.b.1'));
    expect(song.lines.filter(l => l.at >= 32 && l.at < 64)).toEqual(seriesChorus(32).lines);
    expect(lineAt(song, 1)?.text).toBe(t('song.a.1'));
    // eight plucks a bar (the c-ring's protons), three bells a bar (three ATP)
    const pluck = song.parts.find(p => p.voice === 'pluck')!;
    expect(pluck.notes.filter(n => n.at >= 0 && n.at < 4)).toHaveLength(8);
    const bell = song.parts.find(p => p.voice === 'bell' && p.notes.some(n => n.at < 4))!;
    expect(bell.notes.filter(n => n.at >= 0 && n.at < 4)).toHaveLength(3);
  });

  it('follows the band in a sighted push, holds in a blind one, stays gentle in a rest', () => {
    const sim = later();
    drive(sim, 10, HIGH);
    expect(sim.songLevel(HIGH)).toBeGreaterThan(0.7);
    expect(sim.songLevel(NONE)).toBeNull();
    const clock = until(sim, 'rest', HIGH);
    drive(sim, 1, CALM, clock);
    expect(sim.songLevel(CALM)).toBe(0.3);
  });
});

describe('mobile first (DESIGN §12)', () => {
  it('gives every control a finger-sized target inside the insets, clear of the others, at every checked size and state', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const card of [false, true]) {
        const ts = tapTargets(L, { card, started: true });
        expect(auditTargets(ts, c.w, c.h, c.insets), `${c.name}${card ? ', the story card' : ''}`).toEqual([]);
        expect(ts.length).toBe(1);
      }
      expect(tapTargets(L, { card: false, started: false })).toEqual([]);
    }
  });

  it('keeps the line and the goal under the HUD, above the cell, on every screen', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        expect(L.now.y, c.name).toBeGreaterThanOrEqual(c.insets.top);
        expect(L.now.h, c.name).toBeGreaterThanOrEqual(28);
        expect(L.now.x, c.name).toBeGreaterThanOrEqual(c.insets.left);
        expect(L.now.x + L.now.w, c.name).toBeLessThanOrEqual(c.w - c.insets.right);
        expect(L.now.y + L.now.h, c.name).toBeLessThanOrEqual(L.city.y);
        for (const ch of L.chips) {
          expect(ch.x, c.name).toBeGreaterThanOrEqual(c.insets.left);
          expect(ch.x + ch.w, c.name).toBeLessThanOrEqual(c.w - c.insets.right);
          expect(ch.h, c.name).toBeGreaterThanOrEqual(30);
          // the goal never sits on the lens or the lane
          const lensClear = ch.y + ch.h <= L.lens.y - L.lens.r * 1.12 + 1 || ch.x >= L.lens.x + L.lens.r * 1.12 - 1 || ch.x + ch.w <= L.lens.x - L.lens.r * 1.12 + 1;
          expect(lensClear, `${c.name}: a chip on the lens`).toBe(true);
          expect(ch.y + ch.h, c.name).toBeLessThanOrEqual(L.lane.y);
        }
        if (L.mode === 'tall') expect(L.goalTitle.y, c.name).toBeGreaterThan(L.now.y + L.now.h);
      }
    }
  });

  it('puts the lane in the thumb zone of a phone upright, and keeps the lens big', () => {
    for (const c of CHECK_SIZES.filter(x => x.w < 600 && x.h > x.w)) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode, c.name).toBe('tall');
      const zone = c.h * (1 - THUMB);
      expect(L.lane.y, c.name).toBeGreaterThanOrEqual(zone);
      expect(L.lane.h, c.name).toBeGreaterThanOrEqual(84);
      expect(L.lane.y + L.lane.h, c.name).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.lane.x, c.name).toBeGreaterThanOrEqual(c.insets.left + 8);
      expect(L.lens.r, c.name).toBeGreaterThanOrEqual(72);
      expect(L.lens.y + L.lens.r * 1.12, c.name).toBeLessThanOrEqual(L.lane.y);
      expect(L.lens.y - L.lens.r * 1.12, c.name).toBeGreaterThanOrEqual(L.city.y - 1);
      expect(L.chipStyle).toBe('compact');
    }
  });

  it('keeps Mito, the lysosomes and the worn parts’ spots off the lens and inside the cell', () => {
    for (const c of CHECK_SIZES) {
      const L = layout(c.w, c.h, c.insets);
      for (const p of [L.mito, ...L.lysos]) {
        expect(Math.hypot(p.x - L.lens.x, p.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r + p.r * 0.6);
        expect(p.y - p.r, c.name).toBeGreaterThanOrEqual(L.city.y - 2);
        expect(p.y + p.r, c.name).toBeLessThanOrEqual(L.lane.y);
      }
      for (const s of L.spots) {
        expect(Math.hypot(s.x - L.lens.x, s.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r);
        expect(s.x, c.name).toBeGreaterThan(c.insets.left);
        expect(s.x, c.name).toBeLessThan(c.w - c.insets.right);
        expect(s.y, c.name).toBeGreaterThan(L.city.y);
        expect(s.y, c.name).toBeLessThan(L.lane.y);
      }
    }
  });

  it('keeps the clean-up clear of the goal on every screen', () => {
    for (const c of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(c.w, c.h, c.insets, touch);
        const s = Math.max(14, L.mito.r * 1.05) * 1.4;
        for (const p of [...L.spots, ...L.lysos]) {
          for (const ch of [...L.chips, ...(L.outcome ? [L.outcome] : [])]) {
            const clear = p.x + s < ch.x || p.x - s > ch.x + ch.w || p.y - s * 0.8 > ch.y + ch.h || p.y + s < ch.y;
            expect(clear, `${c.name}: ${Math.round(p.x)},${Math.round(p.y)} vs ${Math.round(ch.x)},${Math.round(ch.y)}`).toBe(true);
          }
        }
      }
    }
  });

  it('lays a phone on its side out with the lens left, the goal stacked on the right, the lane along the foot', () => {
    for (const c of CHECK_SIZES.filter(x => x.name.startsWith('phone on its side'))) {
      const L = layout(c.w, c.h, c.insets);
      expect(L.mode).toBe('short');
      expect(L.chipStyle).toBe('line');
      expect(L.lens.x + L.lens.r * 1.12).toBeLessThanOrEqual(L.chips[0].x + 1);
      expect(L.chips[2].y).toBeGreaterThan(L.chips[0].y);
      expect(L.goalTitle.y + L.goalTitle.h).toBeLessThanOrEqual(L.chips[0].y);
      expect(L.lane.y + L.lane.h).toBeLessThanOrEqual(c.h - c.insets.bottom);
      expect(L.lens.y + L.lens.r).toBeLessThanOrEqual(L.lane.y);
    }
  });

  it('maps the lane both ways and finds the lane under a finger', () => {
    const L = layout(360, 500, CHECK_SIZES[0].insets);
    for (const u of [0, 2.5, 10]) expect(laneU(L, laneX(L, u))).toBeCloseTo(u, 6);
    expect(onLens(L, L.lens.x, L.lens.y)).toBe(true);
    expect(onLens(L, L.lens.x, L.lane.y + L.lane.h / 2)).toBe(false);
    expect(onLane(L, L.lane.x + 20, L.laneMid)).toBe(true);
    expect(onLane(L, L.lens.x, L.lens.y)).toBe(false);
  });

  it('never draws a word under 11 px, and the words to read at 13 px and more', () => {
    for (const px of [0, 5, 9, 10.9, 11, 13, 22]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(4)).toMatch(/ 11px /);
    for (const c of CHECK_SIZES) expect(layout(c.w, c.h, c.insets).fs, c.name).toBeGreaterThanOrEqual(MIN_READ);
  });

  it('speaks of taps on a touch screen and of keys only with a keyboard', () => {
    expect(coachText('lane', true)).toBe(t('coach.lane'));
    expect(coachText('lane', false)).toBe(t('coach.lane.keys'));
    const touch = howto(true), desk = howto(false);
    expect(touch.hands.map(x => x.gesture)).not.toContain('keys');
    expect(desk.hands.map(x => x.gesture)).toContain('keys');
    expect(touch.tips).toHaveLength(2);
    for (const l of LANGS) {
      for (const k of ['how.tap', 'how.mito', 'coach.lane', 'now.dna', 'src.dna'] as const) expect(CATALOGS[l][k]).not.toMatch(/Spac|Space|Leertaste|mellanslag/i);
    }
  });

  it('names the three needs in the order of the bars: energy, DNA repair, building material', () => {
    expect(NEED_SYS).toEqual(['energy', 'dna', 'clean']);
    expect([t('need.energy'), t('need.dna'), t('need.mat')]).toEqual(['Energia', 'Naprawa DNA', 'Budulec']);
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
      if (!desks.includes(c)) expect(mouse, c.name).toEqual(finger);
      for (const card of [false, true]) expect(auditTargets(tapTargets(mouse, { card, started: true }), c.w, c.h, c.insets), c.name).toEqual([]);
    }
    expect(desks.length).toBe(5);
  });

  it('grows the engine on a big screen and keeps Mito, the clean-up and the goal clear of it', () => {
    for (const c of big) {
      const L = layout(c.w, c.h, c.insets, false), old = layout(c.w, c.h, c.insets, true);
      expect(L.u, c.name).toBeGreaterThan(1.3);
      expect(L.lens.r / old.lens.r, c.name).toBeGreaterThanOrEqual(1.25);
      expect(L.lens.r, c.name).toBeGreaterThanOrEqual(250);
      expect(L.lens.y + L.lens.r * 1.12, c.name).toBeLessThanOrEqual(L.lane.y);
      expect(L.lens.y - L.lens.r * 1.12, c.name).toBeGreaterThanOrEqual(L.city.y - 1);
    }
    for (const c of desks) {
      const L = layout(c.w, c.h, c.insets, false);
      expect(L.chipStyle).toBe('bar');
      for (const p of [L.mito, ...L.lysos]) {
        expect(Math.hypot(p.x - L.lens.x, p.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r + p.r * 0.6);
        expect(p.y + p.r, c.name).toBeLessThanOrEqual(L.lane.y);
      }
      for (const sp of L.spots) expect(Math.hypot(sp.x - L.lens.x, sp.y - L.lens.y), c.name).toBeGreaterThanOrEqual(L.lens.r);
      for (const ch of L.chips) expect(ch.x, c.name).toBeGreaterThanOrEqual(L.lens.x + L.lens.r * 1.12 - 1);
      expect(L.outcome, c.name).not.toBeNull();
      expect(L.goal.y + L.goal.h, c.name).toBeLessThanOrEqual(L.lane.y);
      // Mito's words have room: his bubble spans the column left of the lens
      expect(L.bubble.maxW, c.name).toBeGreaterThanOrEqual(250);
      expect(L.bubble.x + L.bubble.maxW, c.name).toBeLessThanOrEqual(L.lens.x - L.lens.r * 1.12);
      // a Wiedza card has room to show whole: its sentence and its source
      expect(L.toast.h, c.name).toBeGreaterThanOrEqual(Math.round(118 * L.u) - 1);
      expect(L.toast.y + L.toast.h, c.name).toBeLessThanOrEqual(L.lane.y);
      expect(L.toast.x, c.name).toBeGreaterThanOrEqual(0);
      for (const ch of L.chips) expect(L.toast.x + L.toast.w, `${c.name}: the card under the goal`).toBeLessThanOrEqual(ch.x - 4);
    }
  });

  it('answers a hovering mouse: Mito, a need of the goal, the lesion a click on the lane would mend, the turbine; a finger has no hover', () => {
    const sim = later();
    drive(sim, 12, MID);
    const open = sim.openLesions;
    expect(open.length).toBeGreaterThan(0);
    const l = open[0];
    const c = big[0];
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    const view = new OdnowaView(canvas, { reducedMotion: false, touch: false });
    view.resize(c.w, c.h, 1, c.insets);
    view.update(2, sim);
    const L = view.L;
    view.hover = { x: L.lens.x, y: L.lens.y };
    expect(view.overPart(sim).part).toBe('lens');
    expect(view.cursor(sim)).toBe('default');
    view.hover = { x: L.mito.x, y: L.mito.y };
    expect(view.overPart(sim).part).toBe('mito');
    expect(view.cursor(sim)).toBe('pointer');
    view.hover = { x: L.chips[1].x + 10, y: L.chips[1].y + 10 };
    expect(view.overPart(sim)).toMatchObject({ part: 'chip', id: 1 });
    view.hover = { x: laneX(L, l.u), y: L.laneMid };
    const o = view.overPart(sim);
    expect(o.part).toBe('lesion');
    expect(o.lesion?.kind).toBe(l.kind);
    expect(view.cursor(sim)).toBe('pointer');
    view.hover = { x: 4, y: L.top + 4 };
    expect(view.cursor(sim)).toBe('default');
    const touchView = new OdnowaView(canvas, { reducedMotion: false, touch: true });
    touchView.resize(c.w, c.h, 1, c.insets);
    touchView.hover = { x: L.lens.x, y: L.lens.y };
    expect(touchView.overPart(sim).part).toBeNull();
  });

  it('speaks to a mouse in clicks: the how-to, the coach marks, the line, Mito and the lobby', () => {
    const CLICK = /klik|click|klick/i;
    const TAP: Record<string, RegExp> = { pl: /stuk/i, en: /\btap/i, de: /tipp/i, sv: /\btryck/i };
    const mito = ['dsb.1', 'help.dna.1', 'help.dna.2', 'help.check.1'];
    for (const l of LANGS) {
      const cat = CATALOGS[l] as Record<string, unknown>;
      for (const k of ['how.tap.mouse', 'how.mito.mouse', 'coach.lane.keys', 'now.dna.mouse', 'panel.rules.mouse', 'src.dna.mouse', ...mito.map(m => `say.${m}.mouse`)]) {
        expect(cat[k], `${l}.${k}`).toMatch(CLICK);
        expect(cat[k], `${l}.${k}`).not.toMatch(TAP[l]);
      }
    }
    for (const h of howto(false).hands.filter(x => x.gesture !== 'keys')) expect(h.text).toMatch(CLICK);
    const touch = lines(false), mouse = lines(true);
    for (const m of MOMENTS) expect(mouse[m].length, m).toBe(touch[m].length);
    expect(Object.values(mouse).flat().some(x => /stuk/i.test(x))).toBe(false);
  });
});

describe('long sessions (15–30 minutes)', () => {
  it('plans 15, 20, 25 and 30 minutes to the finale: pushes of 12–32 s and rests of whole breaths, alternating, ending on a rest', () => {
    const cyc = breathCycle(BREATH_DEFAULT);
    for (const sec of [900, 1200, 1500, 1800]) {
      for (const firstEver of [true, false]) {
        const plan = planBlocks(sec, firstEver, mulberry32(sec + (firstEver ? 1 : 0)));
        const body = firstEver ? plan.slice(1) : plan;
        if (firstEver) expect(plan[0]).toMatchObject({ kind: 'warmup', dur: RULES.warm.long });
        body.forEach((b, i) => expect(b.kind, `${sec} #${i}`).toBe(i % 2 ? 'rest' : 'push'));
        expect(body.at(-1)!.kind).toBe('rest');
        expect(plan.reduce((s, b) => s + b.dur, 0)).toBeCloseTo(sec - finaleFor(sec), 5);
        for (const b of body) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
        for (const b of body.filter(x => x.kind === 'push')) expect(b.dur, String(sec)).toBeLessThanOrEqual(32);
        for (const b of body.filter(x => x.kind === 'rest')) {
          expect(b.dur % cyc, `${sec} s`).toBeCloseTo(0, 6);
          expect(b.dur).toBeLessThanOrEqual(30 + 1e-9);
        }
        // a pair about every 46–48 s: 30 minutes is some 38 pairs
        expect(body.length / 2).toBeGreaterThanOrEqual(Math.floor((sec - 60) / 50));
      }
    }
  });

  it('holds every need at its cap from the 13th stage on, so a long session keeps dividing at a steady pace', () => {
    for (const stage of [13, 20, 60, 500]) {
      expect(needs(stage)).toEqual(needs(13));
    }
    expect(needs(13).atp).toBe(RULES.atpNeed[2]);
    expect(needs(13).dna).toBe(RULES.dnaNeed[2]);
    expect(needs(13).mat).toBe(RULES.matNeed[2]);
  });

  it('plays a whole 30-minute session: division after division, no throw, finite numbers, the end, bounded lanes', () => {
    const sim = later({ planned: 1800, seed: 4 });
    const rnd = mulberry32(78);
    const clock = { t: 0 };
    let finale = false, maxLesions = 0, maxParts = 0;
    const divisions: number[] = [];
    for (let i = 0; i < 1808 / STEP; i++) {
      clock.t += STEP;
      const tt = clock.t;
      // focus about two thirds of a push, calm most of a rest, a lesion tapped within a few seconds (the week's policy)
      sim.update(STEP, sim.restBlock ? (tt % 7 < 5 ? CALM : LOW) : tt % 9 < 6 ? HIGH : LOW, tt);
      if (sim.story) sim.tap();
      if (sim.openLesions.length && rnd() < 0.02) sim.repairNext();
      for (const e of sim.take()) {
        if (e.type === 'finale') finale = true;
        if (e.type === 'cell') divisions.push(tt);
      }
      maxLesions = Math.max(maxLesions, sim.lesions.length);
      maxParts = Math.max(maxParts, sim.parts.length);
    }
    expect(finale).toBe(true);
    expect(sim.phase).toBe('done');
    expect(sim.blockIndex).toBe(sim.plan.length - 1);
    for (const v of [sim.atp, sim.stageAtp, sim.dna, sim.material, sim.bank, sim.spin, sim.angle, sim.stage]) expect(Number.isFinite(v)).toBe(true);
    // the cell keeps dividing to the end: some in the last ten minutes too
    expect(sim.divisionsNow).toBeGreaterThanOrEqual(8);
    expect(divisions.filter(t => t > 1200).length).toBeGreaterThanOrEqual(2);
    expect(maxLesions).toBeLessThanOrEqual(RULES.laneCap + 6);
    expect(maxParts).toBeLessThanOrEqual(RULES.partCap + 6);
    const r = sim.result();
    expect(r.score).toBe(sim.atp);
    expect(sim.p.best['1800']).toBe(r.score);
    for (const [k, v] of r.stats) expect(`${k} ${v}`).not.toMatch(/undefined|NaN|Infinity/);
    for (const h of r.highlights) expect(h).not.toMatch(/undefined|NaN/);
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
  });
});
