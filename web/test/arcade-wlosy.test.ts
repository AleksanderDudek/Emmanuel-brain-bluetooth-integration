import { describe, expect, it } from 'vitest';
import {
  COLOUR, COLOURS, DEPTH, LINE_COUNT, MED, MEDS, MOMENTS, MODES, PARTS, SCENE, SCENES, TIPS, allScenes, linesOf, partName, portal, pushTip,
  sceneAt, sceneCount, step, type MedId, type SceneId,
} from '../src/arcade/wlosy/content';
import {
  ABOVE, CYCLE, CYCLE_LEN, FOL, FU, SEC_FOLLICLES, WHORL, flow, folPt, hairsIn, inOval, phaseAt, strandPath, strands, units,
} from '../src/arcade/wlosy/geo';
import { CATALOGS, hairsText, t, unit } from '../src/arcade/wlosy/i18n';
import { bestOf, choose, cleanPos, freshProgress, markSeen, medsDone, migrate, scenesGrown, setColour, setMode, type WlosyProgress } from '../src/arcade/wlosy/meta';
import { HAIRS_PER_SEC, RULES } from '../src/arcade/wlosy/rules';
import { WlosySim, finaleFor, growMult, planBlocks, resumeFrom, secText, type SimEvent } from '../src/arcade/wlosy/sim';
import { CONTROLS, hitAt, layout, pickerLayout, storyRect, tapTargets } from '../src/arcade/wlosy/layout';
import { coachText, howto } from '../src/arcade/wlosy/index';
import { font, fontPx } from '../src/arcade/wlosy/paint';
import { buildTune } from '../src/arcade/wlosy/tune';
import { hairlineY, profileStrands } from '../src/arcade/wlosy/world-head';
import { cycleAt } from '../src/arcade/wlosy/render';
import { shapeFor } from '../src/arcade/wlosy/world-follicle';
import { strandsShown } from '../src/arcade/wlosy/world-above';
import { mosaicCounts } from '../src/arcade/wlosy/world-section';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { mergeSaved } from '../src/arcade/kit/progress';
import { passage } from '../src/arcade/kit/scripture';
import { songProblems } from '../src/arcade/kit/song';
import { CHECK_SIZES, DESK_BIG, DESK_MAX, MIN_READ, MIN_TAP, MIN_TEXT, auditTargets, screenKind } from '../src/arcade/kit/mobile';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

const STEP = 1 / 60;
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.5, ...p });
const HIGH = frame({ level: 0.95, activity: 6, focused: true, hold: 10, calm: 0.05 });
const MID = frame({ level: 0.6, activity: 2.4, focused: true, hold: 4, calm: 0.35 });
const EDGE = frame({ level: 0.5, activity: 2, focused: true, hold: 0, calm: 0.45 });
const UNFOCUSED = frame({ level: 0.4, activity: 1.6, focused: false, hold: 0, calm: 0.5 });
const CALM = frame({ level: 0.1, activity: -2, calm: 0.9 });
const NONE = frame({ reliable: false, activity: null, level: 0, calm: 0, focused: false });

const ALL_SEEN = ['s.open', 'c.grow', 'c.nav', 'c.pick', 'c.breath', 'c.blind'];

type SimOpts = { progress?: Partial<WlosyProgress>; planned?: number; seed?: number; eeg?: boolean; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): WlosySim {
  const sim = new WlosySim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), plannedSec: o.planned ?? 300, eeg: o.eeg ?? false,
    tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player (no warm-up, no opening card, no coach marks). */
const later = (o: SimOpts = {}) => makeSim({ ...o, progress: { sessions: 5, pushes: 1, seen: [...ALL_SEEN], ...o.progress } });

/** Close any story card as a player would (a tap after it has been up a moment). */
const reader = (sim: WlosySim) => () => { if (sim.story && sim.story.t > 1) sim.stay(); };

function drive(sim: WlosySim, sec: number, f: FocusFrame | ((t: number, sim: WlosySim) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
  const out: SimEvent[] = [];
  const n = Math.round(sec / STEP);
  for (let i = 0; i < n; i++) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t, sim) : f, clock.t);
    each?.(clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

/** Run until a sighted push has begun (its lead-in passed) with the scene growing, returns the clock. */
function untilSighted(sim: WlosySim, clock = { t: 0 }, f: FocusFrame = MID): { t: number } {
  let guard = 0;
  while (!(sim.sighted && sim.stage === 'at') && guard++ < 4000) drive(sim, 0.05, (_t, s) => (s.restBlock ? CALM : f), clock, reader(sim));
  return clock;
}

describe('the library (content.ts)', () => {
  it('has eight meditations and twenty-six scenes, each scene in exactly one meditation', () => {
    expect(MEDS).toHaveLength(8);
    expect(SCENES).toHaveLength(26);
    expect(allScenes()).toBe(26);
    const seen = MEDS.flatMap(m => MED[m].scenes);
    expect(new Set(seen).size).toBe(26);
    for (const s of SCENES) expect(MED[SCENE[s].med].scenes).toContain(s);
    // the founder's two themes: hair growing and the head regenerating
    expect(MED.wzrost.scenes).toContain('skos');
    expect(MED.cykl.scenes).toEqual(['anagen', 'katagen', 'nowy', 'mozaika']);
    expect(MED.skora.scenes).toContain('naskorek');
  });

  it('names a verse that exists for every meditation, Luke 12:7 among them', () => {
    for (const m of MEDS) expect(passage(MED[m].verse).text.length).toBeGreaterThan(10);
    expect(MED.wir.verse).toBe('luk12.7');
    expect(MED.cala.verse).toBe('psa3.3');
    expect(new Set(MEDS.map(m => MED[m].bell)).size).toBe(8);
  });

  it('frames every scene in a view of its world, with its labels named in all four languages', () => {
    for (const s of SCENES) {
      const sc = SCENE[s];
      expect(sc.view.w).toBeGreaterThan(5);
      expect(sc.view.h).toBeGreaterThan(5);
      for (const lb of sc.labels) {
        expect(PARTS).toContain(lb.part);
        expect(lb.from).toBeGreaterThanOrEqual(0);
        expect(lb.from).toBeLessThan(1);
      }
    }
    for (const p of PARTS) expect(partName(p).length).toBeGreaterThan(0);
  });

  it('walks the library scene by scene and round the eight, both ways', () => {
    expect(step('krazenie', 0, 1)).toEqual({ med: 'krazenie', i: 1 });
    expect(step('krazenie', 2, 1)).toEqual({ med: 'korzen', i: 0 });
    expect(step('krazenie', 0, -1)).toEqual({ med: 'cala', i: 3 });
    expect(step('cala', 3, 1)).toEqual({ med: 'krazenie', i: 0 });
    expect(sceneAt('cykl', 9)).toBe('mozaika');
    expect(sceneCount('cala')).toBe(4);
  });

  it('dives deeper from the head to the section to the follicle, each from a place of the shallower picture', () => {
    expect(DEPTH.head).toBeLessThan(DEPTH.section);
    expect(DEPTH.section).toBeLessThan(DEPTH.follicle);
    expect(portal('head', 'section')).not.toBeNull();
    expect(portal('section', 'follicle')).not.toBeNull();
    expect(portal('follicle', 'head')).toBeNull();
  });

  it('gives each hair colour a body, a sheen and its melanins (grey with few active pigment cells)', () => {
    for (const c of COLOURS) {
      expect(COLOUR[c].strand).toMatch(/^#[0-9a-f]{6}$/);
      expect(COLOUR[c].sheen).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(COLOUR.black.eu).toBeGreaterThan(COLOUR.auburn.eu);
    expect(COLOUR.grey.dens).toBeLessThan(0.3);
  });

  it('asks for the scene’s picture in a push, and every third push a counting strategy', () => {
    expect(pushTip('petla', 0)).toBe(TIPS.scene.petla);
    expect(pushTip('petla', 2)).toBe(TIPS.count);
    expect(t(TIPS.scene.petla)).toMatch(/pętlę ciepłej krwi/);
  });
});

describe('the geometry (geo.ts)', () => {
  it('slants the follicle: its bulb lies down and to the side of its mouth, the hair leaves the skin the other way', () => {
    const [bx, by] = folPt(0, FU.bottom);
    expect(by).toBeGreaterThan(80);
    expect(bx).toBeLessThan(FOL.ox - 20);
    const [tx, ty] = folPt(0, FU.tip);
    expect(ty).toBeLessThan(-30);
    expect(tx).toBeGreaterThan(FOL.ox + 10);
  });

  it('spreads the strands seen from above over the hairy scalp, from the whorl outward, lying on the head', () => {
    const list = strands(600);
    expect(list.length).toBe(600);
    for (const s of list) expect(inOval(s.x, s.y)).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i].d).toBeGreaterThanOrEqual(list[i - 1].d);
    for (const s of list.slice(0, 200)) for (const [x, y] of strandPath(s, s.len)) expect(inOval(x, y, 4)).toBe(true);
    // the hair turns clockwise round the whorl (on the screen, y down) and runs forward over the forehead
    const [vx, vy] = flow(WHORL[0] + 3, WHORL[1]);
    expect(vy).toBeGreaterThan(0);
    expect(vx).toBeGreaterThan(-1);
    expect(flow(0, ABOVE.cy - 30)[1]).toBeLessThan(0);
  });

  it('makes a square centimetre of 80 follicular units of 1–4 hairs, about 2 a unit (≈ 170 hairs/cm²)', () => {
    const list = units();
    expect(list).toHaveLength(80);
    const hairs = hairsIn(list, 80);
    expect(hairs / 80).toBeGreaterThan(1.8);
    expect(hairs / 80).toBeLessThan(2.4);
    expect(hairs).toBeGreaterThan(120);
    expect(hairs).toBeLessThan(230);
    for (const u of list) expect([1, 2, 3, 4]).toContain(u.n);
    expect(list.filter(u => u.n === 1).length).toBeGreaterThan(8);
  });

  it('keeps the cycle’s real shares: years of growth, weeks of transition, months of rest', () => {
    expect(CYCLE.anagen / CYCLE_LEN).toBeGreaterThan(0.85);
    expect(phaseAt(0.5).phase).toBe('anagen');
    expect(phaseAt((CYCLE.anagen + 0.3) / CYCLE_LEN).phase).toBe('catagen');
    expect(phaseAt(0.99).phase).toBe('telogen');
    expect(phaseAt(1.5).phase).toBe('anagen');
    // every follicle keeps its own time: the mosaic never rests all at once
    for (const g of [0, 0.3, 0.6, 1]) expect(mosaicCounts(g).anagen).toBeGreaterThan(5);
    expect(new Set(SEC_FOLLICLES.map(f => f.phase)).size).toBe(SEC_FOLLICLES.length);
  });

  it('takes the follicle through its cycle: catagen shortens it under the bulge, a new anagen grows it back', () => {
    const a = shapeFor('anagen', 0.5), t1 = shapeFor('katagen', 1), n1 = shapeFor('nowy', 1), n0 = shapeFor('nowy', 0);
    expect(a.len).toBe(FU.bottom);
    expect(t1.len).toBeCloseTo(FU.telogen, 5);
    expect(t1.club).toBe(true);
    expect(t1.bulb).toBeCloseTo(0, 5);
    expect(n0.old).not.toBeNull();
    expect(n1.len).toBeCloseTo(FU.bottom, 5);
    expect(n1.old!.out).toBeCloseTo(1, 5);
    expect(n1.tip).toBeLessThan(0);
    expect(shapeFor('katagen', 0.3).len).toBeLessThan(FU.bottom);
  });

  it('lets the hair from above appear from the whorl outward, the newest still growing', () => {
    expect(strandsShown(600, 0).whole).toBe(0);
    expect(strandsShown(600, 1).whole).toBe(600);
    const mid = strandsShown(600, 0.5);
    expect(mid.whole).toBeGreaterThan(200);
    expect(mid.growing.length).toBeGreaterThan(0);
    for (const s of mid.growing) expect(s.len).toBeLessThanOrEqual(1);
  });

  it('roots the hair in profile above its hairline, never over the ear', () => {
    const list = profileStrands();
    expect(list.length).toBeGreaterThan(250);
    for (const s of list) {
      const [x, y] = s.pts[0];
      expect(y).toBeLessThanOrEqual(hairlineY(x) + 1e-9);
      expect(x > 7 && x < 26 && y > -15).toBe(false);
    }
  });

  it('turns the cycle’s dial through the phases of each cycle scene', () => {
    expect(cycleAt('anagen', 0.5).phase).toBe('anagen');
    expect(cycleAt('katagen', 0.3).phase).toBe('catagen');
    expect(cycleAt('katagen', 0.9).phase).toBe('telogen');
    expect(cycleAt('nowy', 0.1).phase).toBe('telogen');
    expect(cycleAt('nowy', 0.8).phase).toBe('anagen');
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

  it('fits a short test session and any planned length from 10 s', () => {
    for (const planned of [10, 20, 40, 60]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(1));
        expect(plan.some(b => b.kind === 'push')).toBe(true);
        expect(plan.some(b => b.kind === 'rest')).toBe(true);
      }
    }
  });

  it('makes every 4th push blind from the 3rd session, never the first of a session', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const blinds: boolean[] = [];
    const clock = { t: 0 };
    for (let i = 0; i < 6; i++) {
      blinds.push(sim.block.kind === 'push' ? sim.block.blind : false);
      drive(sim, sim.block.dur + 0.05, frame(), clock, reader(sim));
    }
    expect(blinds[0]).toBe(false);
    expect(blinds[2]).toBe(true);
  });

  it('judges each block once at its end and tells the next block during the telegraph', () => {
    const sim = later();
    const evs = drive(sim, sim.block.dur + 0.1, HIGH);
    expect(ofType(evs, 'blockEnd')).toHaveLength(1);
    expect(ofType(evs, 'blockEnd')[0].verdict).toBe(true);
    expect(ofType(evs, 'telegraph')).toHaveLength(1);
  });
});

describe('growth only from real focus (the founder’s rule)', () => {
  it('grows a scene in a sighted push only while the band reads focus', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, UNFOCUSED);
    const g0 = sim.g;
    drive(sim, 4, UNFOCUSED, clock);
    expect(sim.g).toBe(g0);
    expect(sim.growing).toBe(false);
    drive(sim, 4, MID, clock);
    expect(sim.g).toBeGreaterThan(g0);
    expect(sim.growing).toBe(true);
  });

  it('never grows in the lead-in, in rest, without a signal, or under a story card — and never takes back', () => {
    const sim = later();
    drive(sim, RULES.leadIn.fnirs - 0.5, HIGH);
    expect(sim.g).toBe(0);
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 3, NONE, clock);
    const kept = sim.g;
    drive(sim, 3, NONE, clock);
    expect(sim.g).toBe(kept);
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    const atRest = sim.g;
    const d0 = sim.deep;
    drive(sim, 12, CALM, clock);
    expect(sim.g).toBe(atRest);
    // rest deepens the picture instead
    expect(sim.deep).toBeGreaterThan(d0);
    expect(sim.meter()).toBeCloseTo(sim.calmShown, 9);
  });

  it('takes ~22–31 s of focused time a scene: faster with the level and a held focus', () => {
    const secs = (f: FocusFrame) => 1 / (growMult(f) / RULES.sceneSec);
    expect(secs(HIGH)).toBeGreaterThan(20);
    expect(secs(HIGH)).toBeLessThan(25);
    expect(secs(MID)).toBeGreaterThan(24);
    expect(secs(MID)).toBeLessThan(29);
    expect(secs(EDGE)).toBeGreaterThan(28);
    expect(secs(EDGE)).toBeLessThan(32);
    const sim = later();
    untilSighted(sim, { t: 0 }, HIGH);
    expect(sim.growRate(HIGH)).toBeCloseTo(growMult(HIGH) / RULES.sceneSec, 9);
    expect(sim.growRate(UNFOCUSED)).toBe(0);
    expect(sim.growRate(NONE)).toBe(0);
  });

  it('measured: about one scene per two push blocks at a moderate signal, none without focus', () => {
    const pace = (f: (s: WlosySim) => FocusFrame) => {
      const sim = later({ planned: 600 });
      drive(sim, 300, (_t, s) => f(s), { t: 0 }, reader(sim));
      let n = 0;
      for (const s of SCENES) if (sim.grownThis(s)) n++;
      return { n, growSec: sim.growSec, hairs: sim.score };
    };
    const mid = pace(s => (s.restBlock ? CALM : MID));
    expect(mid.n).toBeGreaterThanOrEqual(3);
    expect(mid.n).toBeLessThanOrEqual(7);
    const none = pace(s => (s.restBlock ? CALM : UNFOCUSED));
    expect(none.n).toBe(0);
    expect(none.hairs).toBe(0);
    expect(none.growSec).toBe(0);
  });

  it('a blind push grows unseen, keeps the headline still, and shows it all at its end', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = { t: 0 };
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    while (sim.blind && (sim.blockT < sim.leadIn + 0.5 || sim.stage !== 'at')) drive(sim, 0.1, HIGH, clock, reader(sim));
    const shown = sim.g, score = sim.score;
    drive(sim, 4, HIGH, clock, reader(sim));
    if (sim.blind) {
      expect(sim.meter()).toBeNull();
      expect(sim.songLevel(HIGH)).toBeNull();
      expect(sim.g).toBe(shown);
      expect(sim.score).toBe(score);
      expect(sim.hidden).toBeGreaterThan(0);
    }
    const evs: SimEvent[] = [];
    let guard = 0;
    while (sim.blind && guard++ < 2000) evs.push(...drive(sim, 0.1, HIGH, clock, reader(sim)));
    const end = ofType(evs, 'blindEnd')[0];
    expect(end).toBeTruthy();
    expect(end.hairs).toBeGreaterThan(0);
    drive(sim, RULES.revealSec + 0.3, CALM, clock, reader(sim));
    expect(sim.score).toBeGreaterThan(score);
  });

  it('the warm-up of a first session grows at half the rate (it is real focus too)', () => {
    const sim = makeSim({ tuning: BEGINNER });
    sim.story = null;
    expect(sim.block.kind).toBe('warmup');
    drive(sim, RULES.moveSec + 0.1, HIGH);
    expect(sim.growRate(HIGH)).toBeCloseTo((growMult(HIGH) / RULES.sceneSec) * RULES.warmK, 9);
  });
});

describe('the hairs (the headline)', () => {
  it('counts hairs only with growth: 4 a second at a multiplier of 1, about 120 a scene', () => {
    expect(HAIRS_PER_SEC).toBe(4);
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, MID);
    const h0 = sim.hairs;
    drive(sim, 5, MID, clock);
    expect(sim.hairs - h0).toBeCloseTo(5 * HAIRS_PER_SEC * growMult(MID), 0);
    const h1 = sim.hairs;
    drive(sim, 3, UNFOCUSED, clock);
    expect(sim.hairs).toBe(h1);
  });

  it('scores with the smoke test’s crude input within 22 s (a centre tap every 0.65 s, Space every ~2 s, focus on)', () => {
    for (const fresh of [true, false]) {
      const sim = fresh ? makeSim({ tuning: BEGINNER, planned: 40 }) : later({ planned: 40 });
      let next = 0.65, space = 2;
      const clock = { t: 0 };
      const seen: number[] = [];
      drive(sim, 22, HIGH, clock, tt => {
        if (tt >= next) { next += 0.65; sim.stay(); }
        if (tt >= space) { space += 2; sim.key(' ', true); sim.key(' ', false); }
        if (Math.abs(tt - Math.round(tt)) < STEP / 2) seen.push(sim.score);
      });
      expect(sim.result().score, fresh ? 'first' : 'later').toBeGreaterThan(0);
      expect(seen.at(-1)!).toBeGreaterThan(seen[8]);
    }
  });

  it('bends the unit: 1 włos, 3 włosy, 5 włosów; a no-break space before it', () => {
    expect(unit(1)).toBe('włos');
    expect(unit(3)).toBe('włosy');
    expect(unit(5)).toBe('włosów');
    expect(unit(22)).toBe('włosy');
    expect(hairsText(5)).toBe('5 włosów');
    expect(secText(42)).toBe('42 s');
    expect(secText(102)).toBe('1:42');
  });
});

describe('choose, walk, repeat', () => {
  it('walks back and on across meditations; only scenes grown by focus count', () => {
    const sim = later();
    drive(sim, 1, NONE);
    expect(sim.scene).toBe('czepiec');
    expect(sim.prevScene()).toBe(true);
    expect(sim.med).toBe('cala');
    expect(sim.scene).toBe('glowa');
    expect(sim.nextScene()).toBe(true);
    expect(sim.nextScene()).toBe(true);
    expect(sim.scene).toBe('tetnice');
    for (const s of SCENES) expect(sim.grownThis(s)).toBe(false);
    // keys do the same
    expect(sim.key('ArrowRight', true)).toBe(true);
    expect(sim.scene).toBe('siec');
    expect(sim.key('ArrowLeft', true)).toBe(true);
    expect(sim.scene).toBe('tetnice');
  });

  it('keeps a scene’s growth when walked back to, and grows it again from the start with “again”', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 4, HIGH, clock);
    const g = sim.g;
    expect(g).toBeGreaterThan(0.05);
    sim.nextScene();
    drive(sim, 0.5, HIGH, clock);
    sim.prevScene();
    expect(sim.g).toBeCloseTo(g, 5);
    const hairs = sim.score;
    expect(sim.key('r', true)).toBe(true);
    expect(sim.g).toBe(0);
    expect(sim.score).toBe(hairs);
  });

  it('opens the picker (≡ or M), picks a meditation (1–8 or a tap), switches the mode', () => {
    const sim = later();
    drive(sim, 1, NONE);
    expect(sim.key('m', true)).toBe(true);
    expect(sim.picker).toBe(true);
    expect(sim.talkBlocked).toBe(true);
    expect(sim.key('3', true)).toBe(true);
    expect(sim.picker).toBe(false);
    expect(sim.med).toBe('kolor');
    expect(sim.idx).toBe(0);
    sim.togglePicker();
    expect(sim.setMode('repeat')).toBe(true);
    expect(sim.p.mode).toBe('repeat');
    expect(sim.pick('cykl')).toBe(true);
    expect(sim.scene).toBe('anagen');
    expect(sim.p.chosen).toBe('cykl');
    // a tap on the picture closes an open picker, and so does a step along the scenes
    sim.togglePicker();
    sim.stay();
    expect(sim.picker).toBe(false);
    sim.togglePicker();
    sim.key('ArrowRight', true);
    expect(sim.picker).toBe(false);
    expect(sim.scene).toBe('katagen');
  });

  it('in order: a meditation grown whole closes with its card and the next one begins', () => {
    const sim = later({ planned: 900 });
    const clock = { t: 0 };
    const evs = drive(sim, 600, (_t, s) => (s.restBlock ? CALM : HIGH), clock, reader(sim));
    const wholes = ofType(evs, 'whole');
    expect(wholes[0]?.med).toBe('krazenie');
    const stories = ofType(evs, 'story').map(e => e.kind);
    expect(stories).toContain('whole');
    expect(ofType(evs, 'scene').some(e => e.med === 'korzen' && e.via === 'auto')).toBe(true);
  });

  it('repeat: the same meditation again from its first scene; just this one: it stays with its picture', () => {
    const rep = later({ planned: 900, progress: { mode: 'repeat', chosen: 'korzen', pos: { med: 'korzen', scene: 0, g: 0 } } });
    const evs = drive(rep, 600, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(rep));
    const meds = new Set(ofType(evs, 'scene').map(e => e.med));
    expect([...meds]).toEqual(['korzen']);
    expect(ofType(evs, 'whole').length).toBeGreaterThanOrEqual(1);
    const one = later({ planned: 900, progress: { mode: 'one', chosen: 'wzrost', pos: { med: 'wzrost', scene: 0, g: 0 } } });
    drive(one, 600, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(one));
    expect(one.med).toBe('wzrost');
    expect(one.stage).toBe('after');
    // the picture keeps growing as hair does: focus still counts in the end
    const h = one.score;
    drive(one, 30, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(one));
    expect(one.score).toBeGreaterThanOrEqual(h);
  });

  it('resumes where it stopped: a scene still growing keeps its growth; a grown one hands on', () => {
    expect(resumeFrom('korzen', 1, 0.4, 'order')).toEqual({ med: 'korzen', scene: 1, g: 0.4 });
    expect(resumeFrom('korzen', 1, 1, 'order')).toEqual({ med: 'korzen', scene: 2, g: 0 });
    expect(resumeFrom('korzen', 2, 1, 'order')).toEqual({ med: 'kolor', scene: 0, g: 0 });
    expect(resumeFrom('korzen', 2, 1, 'repeat')).toEqual({ med: 'korzen', scene: 0, g: 0 });
    const sim = later({ planned: 120 });
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 5, HIGH, clock);
    sim.finish();
    expect(sim.p.pos.med).toBe('krazenie');
    expect(sim.p.pos.scene).toBe(0);
    expect(sim.p.pos.g).toBeGreaterThan(0.1);
    const next = new WlosySim({ progress: sim.p, rng: mulberry32(2), plannedSec: 300, eeg: false, tuning: TUNING });
    next.start();
    expect(next.scene).toBe('czepiec');
    expect(next.g).toBeCloseTo(sim.p.pos.g, 5);
  });
});

describe('the session', () => {
  it('opens the first session with the two-page card (Luke 12:7, then what this is not) and teaches with coach marks', () => {
    const sim = makeSim();
    expect(sim.story).toMatchObject({ kind: 'open', page: 0, pages: 2 });
    const clock = { t: 0 };
    drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story!.page).toBe(1);
    drive(sim, 1, MID, clock);
    sim.stay();
    expect(sim.story).toBeNull();
    const evs = drive(sim, 120, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    const coach = ofType(evs, 'coach').map(e => e.what);
    expect(coach).toContain('grow');
    expect(coach).toContain('nav');
    expect(coach).toContain('pick');
    expect(coach).toContain('breath');
    const again = makeSim({ progress: { ...sim.p } });
    expect(again.story).toBeNull();
  });

  it('gives result() idempotently and the record only with Math.max; settles once', () => {
    const sim = later();
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 8, HIGH, clock);
    const a = sim.result(), b = sim.result();
    expect(b.score).toBe(a.score);
    expect(sim.p.best['300']).toBe(a.score);
    expect(a.unit).toBe(unit(a.score));
    sim.finish();
    sim.finish();
    expect(sim.p.sessions).toBe(6);
    expect(sim.p.hairs).toBe(a.score);
    expect(sim.phase).toBe('done');
    expect(sim.canStop()).toBe(true);
  });

  it('closes with a passage that exists, Luke 12:7 the first time, and says what happened', () => {
    expect(makeSim().closingVerse()).toBe('luk12.7');
    const sim = later({ planned: 600 });
    drive(sim, 300, (_t, s) => (s.restBlock ? CALM : HIGH), { t: 0 }, reader(sim));
    const r = sim.result();
    expect(passage(r.verse!).text.length).toBeGreaterThan(10);
    expect(r.stats.length).toBe(6);
    expect(r.highlights.length).toBeGreaterThan(0);
    for (const h of r.highlights) expect(h.length).toBeLessThan(140);
    for (const id of ['2co4.16', 'psa139.16', 'isa40.31', 'psa121.1-2'] as const) expect(passage(id).text.length).toBeGreaterThan(10);
  });

  it('pays a 5-minute session a few hundred hairs at a moderate signal', () => {
    const sim = later({ planned: 300 });
    drive(sim, 300, (_t, s) => (s.restBlock ? CALM : MID), { t: 0 }, reader(sim));
    expect(sim.score).toBeGreaterThan(150);
    expect(sim.score).toBeLessThan(700);
  });

  it('keeps the narrator quiet while a coach mark is up, and says the scene’s line on arriving', () => {
    const sim = later();
    const clock = { t: 0 };
    drive(sim, 8, MID, clock);
    expect(sim.talk.said.length).toBeGreaterThan(0);
    sim.hintUntil = clock.t + 3;
    sim.talk.ask('good', 5, 10);
    drive(sim, 2.5, MID, clock);
    expect(sim.talk.line).toBeNull();
  });
});

describe('the meta', () => {
  it('chooses a meditation (resuming where it stopped when it is the same), a mode, a colour', () => {
    const p = freshProgress();
    p.pos = { med: 'korzen', scene: 1, g: 0.3 };
    expect(choose(p, 'korzen')).toBe(true);
    expect(p.pos).toEqual({ med: 'korzen', scene: 1, g: 0.3 });
    expect(choose(p, 'wir')).toBe(true);
    expect(p.pos).toEqual({ med: 'wir', scene: 0, g: 0 });
    expect(choose(p, 'nope')).toBe(false);
    expect(setMode(p, 'one')).toBe(true);
    expect(setMode(p, 'sideways')).toBe(false);
    expect(setColour(p, 'grey')).toBe(true);
    expect(setColour(p, 'green')).toBe(false);
    expect(markSeen(p, 'x')).toBe(true);
    expect(markSeen(p, 'x')).toBe(false);
  });

  it('counts the scenes grown and the meditations completed', () => {
    const p = freshProgress();
    expect(scenesGrown(p, 'korzen')).toBe(0);
    p.grown.brodawka = 2;
    p.grown.petla = 1;
    expect(scenesGrown(p, 'korzen')).toBe(2);
    p.whole.korzen = 1;
    expect(medsDone(p)).toBe(1);
    expect(bestOf(p)).toBeNull();
  });

  it('repairs a save: wrong types, a place outside the library, garbage', () => {
    const saved = { ver: 1, sessions: 3, mode: 'x', chosen: 'cykl', colour: 'blue', pos: { med: 'cykl', scene: 9, g: 4 }, grown: { petla: 2, x: 5 }, best: { 300: 400, 60: 'x' }, hairs: 12.7, song: 'no', seen: ['c.nav', 4] };
    const p = mergeSaved(freshProgress(), saved) as WlosyProgress;
    migrate(p);
    expect(p.mode).toBe('order');
    expect(p.chosen).toBe('cykl');
    expect(p.colour).toBe('brown');
    expect(p.pos).toEqual({ med: 'cykl', scene: 3, g: 0 });
    expect(p.grown.petla).toBe(2);
    expect(Object.keys(p.grown)).toEqual([...SCENES]);
    expect(p.best).toEqual({ 300: 400 });
    expect(p.hairs).toBe(12);
    expect(p.song).toBe(true);
    expect(p.seen).toEqual(['c.nav']);
    expect(cleanPos({ med: 'x' })).toEqual({ med: 'krazenie', scene: 0, g: 0 });
    for (const junk of [null, 3, 'x', [], { ver: 2 }, { ver: 1, pos: 'x', grown: 5, best: [], seen: null }]) {
      const q = mergeSaved(freshProgress(), junk) as WlosyProgress;
      migrate(q);
      expect(q.ver).toBe(1);
      expect(MEDS).toContain(q.pos.med);
      const sim = new WlosySim({ progress: q, rng: mulberry32(1), plannedSec: 60, eeg: true, tuning: TUNING });
      sim.start();
      drive(sim, 5, MID);
    }
  });
});

describe('the words', () => {
  it('has every text in all four languages, with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('gives the narrator its lines, each fitting a caption (90 characters)', () => {
    for (const m of MOMENTS) {
      expect(linesOf(m).length).toBe(LINE_COUNT[m]);
      expect(linesOf(m).every(s => s.length > 5), m).toBe(true);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) if (k.startsWith('say.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
    }
  });

  it('keeps Polish letters and words out of the other languages, quotes in each language’s marks', () => {
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

  it('never promises regrowth or healing, names no disease as a target, and suggests strategies, never “harder”', () => {
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        const texts = typeof v === 'string' ? [v] : Object.values(v).filter((x): x is string => typeof x === 'string');
        for (const s of texts) {
          expect(s, `${l}.${k}`).not.toMatch(/odro(ś|s)n|odrastan|regrow|grow back|nachwachs|wächst nach|växer tillbaka|wyleczy|uzdrawia|heals|cures|heilt|botar|łysien|alopec|baldness|Glatze|kahl|skallig/i);
          if (/^(tip|howto)\./.test(k)) expect(s, `${l}.${k}`).not.toMatch(/mocniej|bardziej się skup|harder|concentrate more|stärker|mehr konzentrier|hårdare|koncentrera dig mer/i);
        }
      }
    }
  });

  it('says plainly what it is not: the opening card, the lobby’s card and the how-to’s last tip', () => {
    for (const k of ['story.open2.text', 'panel.not', 'howto.tip2'] as const) {
      expect(t(k)).toMatch(/nie leczenie/);
    }
    expect(t('howto.tip2')).toMatch(/Opaska mierzy uwagę/);
    expect(t('panel.not')).toMatch(/dermatolog/);
    expect(CATALOGS.en['howto.tip2']).toMatch(/headband measures attention/);
  });
});

describe('mobile first and the desk (DESIGN §12, §14)', () => {
  it('keeps the four controls finger-sized, inside the insets and apart at every checked size', () => {
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        const tg = tapTargets(L, { story: null, picker: false, live: true });
        expect(tg.map(x => x.label)).toEqual([...CONTROLS]);
        expect(auditTargets(tg, s.w, s.h, L.ins), `${s.name} ${touch}`).toEqual([]);
        // never in the canvas's middle, where a tap stays with the picture (and the smoke test clicks)
        expect(hitAt(L, { story: null, picker: false, live: true }, s.w / 2, s.h * 0.6), s.name).toBeNull();
      }
    }
  });

  it('keeps the picker’s every part finger-sized, inside the insets and apart at every checked size', () => {
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        const tg = tapTargets(L, { story: null, picker: true, live: true });
        expect(tg).toHaveLength(1 + MODES.length + MEDS.length);
        expect(auditTargets(tg, s.w, s.h, L.ins), `${s.name} ${touch}`).toEqual([]);
        const P = pickerLayout(L);
        expect(P.card.y).toBeGreaterThanOrEqual(L.top);
        expect(P.card.y + P.card.h).toBeLessThanOrEqual(L.bottom + 0.5);
      }
      const L = layout(s.w, s.h, s.insets, true);
      expect(auditTargets(tapTargets(L, { story: storyRect(L, 300), picker: false, live: true }), s.w, s.h, L.ins), s.name).toEqual([]);
    }
  });

  it('puts the controls in the thumb zone of an upright phone, the words above them, the picture above the words', () => {
    for (const s of CHECK_SIZES.filter(c => c.h > c.w)) {
      const L = layout(s.w, s.h, s.insets, true);
      expect(L.shape, s.name).toBe('tall');
      const c = L.ctl.next;
      expect(c.y, s.name).toBeGreaterThan(L.top + 0.55 * (L.bottom - L.top));
      expect(L.words.y + L.words.h, s.name).toBeLessThanOrEqual(c.y);
      expect(L.pic.y + L.pic.h, s.name).toBeLessThanOrEqual(L.words.y);
      expect(L.pic.y).toBeGreaterThanOrEqual(L.top);
      expect(L.pic.h, s.name).toBeGreaterThan(150);
      expect(L.words.h).toBeGreaterThanOrEqual(104);
    }
  });

  it('lays a phone on its side and a desk out with the picture left and its words and controls in a column', () => {
    for (const s of CHECK_SIZES.filter(c => c.w > c.h)) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        expect(L.words.x, s.name).toBeGreaterThanOrEqual(L.pic.x + L.pic.w);
        expect(L.words.x + L.words.w, s.name).toBeLessThanOrEqual(L.right - 8);
        expect(L.pic.y).toBeGreaterThanOrEqual(L.top - 0.5);
        expect(L.pic.y + L.pic.h, s.name).toBeLessThanOrEqual(L.bottom + 0.5);
        expect(L.ctl.next.x + L.ctl.next.w, s.name).toBeLessThanOrEqual(L.right);
      }
    }
    const desks = CHECK_SIZES.filter(s => s.w > s.h && ['desktop', 'big'].includes(screenKind(s.w, s.h, false)));
    expect(desks.length).toBeGreaterThanOrEqual(4);
    for (const s of desks) {
      const L = layout(s.w, s.h, s.insets, false);
      expect(L.desk, s.name).toBe(true);
      expect(L.pic.w, s.name).toBeGreaterThanOrEqual(0.8 * (L.bottom - L.top) - 30);
      expect(layout(s.w, s.h, s.insets, true).desk).toBe(false);
    }
  });

  it('never draws text under 11 px; what is read at least 13; it grows on a big screen', () => {
    for (const px of [4, 9, 10.9, 11, 13]) expect(fontPx(px)).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(font(6)).toMatch(/ 11px /);
    for (const s of CHECK_SIZES) {
      for (const touch of [true, false]) {
        const L = layout(s.w, s.h, s.insets, touch);
        expect(L.u).toBeGreaterThanOrEqual(1);
        expect(L.u).toBeLessThanOrEqual(Math.min(s.w, s.h) >= DESK_BIG && s.w >= 1024 ? DESK_MAX : 1.3);
        expect(L.font.teachMin).toBeGreaterThanOrEqual(15);
        for (const px of [L.font.label, L.font.caption, L.font.verse, L.font.part]) expect(px).toBeGreaterThanOrEqual(MIN_READ);
        expect(L.font.small).toBeGreaterThanOrEqual(MIN_TEXT);
        expect(L.font.key).toBeGreaterThanOrEqual(12);
        for (const c of CONTROLS) expect(Math.min(L.ctl[c].w, L.ctl[c].h)).toBeGreaterThanOrEqual(MIN_TAP);
      }
    }
    const qhd = layout(1587, 1300, { top: 118, right: 0, bottom: 0, left: 0 }, false);
    expect(qhd.u).toBeGreaterThan(1.7);
    expect(qhd.font.teach).toBeGreaterThanOrEqual(30);
  });

  it('speaks to the hand the player has: a finger never hears of keys, a mouse clicks and has keys', () => {
    const touch = howto(true), keys = howto(false);
    expect(touch.hands.every(hd => hd.gesture !== 'keys')).toBe(true);
    expect(keys.hands.some(hd => hd.gesture === 'keys')).toBe(true);
    expect(keys.hands[0].text).toMatch(/^Kliknij/);
    expect(touch.hands[0].text).toMatch(/^Stuknij/);
    expect(keys.hands.map(hd => hd.text).join(' ')).not.toMatch(/stuk/i);
    expect(keys.hands[1].text).toMatch(/←/);
    expect(coachText('nav', true)).not.toMatch(/klawisz|←/);
    expect(coachText('nav', false)).toMatch(/←/);
    expect(coachText('pick', false)).toMatch(/M/);
    for (const w of ['grow', 'breath', 'blind'] as const) expect(coachText(w, true).length).toBeGreaterThan(10);
  });
});

describe('the quiet tune (kit/song.ts)', () => {
  it('is a well-formed slow tune without words or drums', () => {
    const song = buildTune();
    expect(songProblems(song)).toEqual([]);
    expect(song.bpm).toBeLessThanOrEqual(60);
    expect(song.lines).toEqual([]);
    expect(song.parts.some(p => p.voice === 'kick' || p.voice === 'snare' || p.voice === 'hat')).toBe(false);
    expect(song.parts.find(p => p.layer === 0)?.voice).toBe('pad');
  });

  it('follows the light in a sighted push, rests gently, and holds still in a blind block', () => {
    const sim = later({ planned: 600, progress: { sessions: 4, pushes: 2 } });
    const clock = untilSighted(sim, { t: 0 }, HIGH);
    drive(sim, 1, HIGH, clock);
    expect(sim.songLevel(HIGH)).toBeCloseTo(HIGH.level, 9);
    while (!sim.restBlock) drive(sim, 0.25, MID, clock, reader(sim));
    expect(sim.songLevel(CALM)).toBeCloseTo(0.34, 9);
    while (!sim.blind) drive(sim, 0.25, (_t, s) => (s.restBlock ? CALM : MID), clock, reader(sim));
    expect(sim.songLevel(HIGH)).toBeNull();
  });
});

// the ids the sim and the panel assume (a typo in content.ts fails here, not in play)
const _ids: readonly MedId[] = ['krazenie', 'korzen', 'kolor', 'wzrost', 'wir', 'cykl', 'skora', 'cala'];
const _scenes: readonly SceneId[] = ['czepiec', 'glowa'];
void _ids;
void _scenes;
