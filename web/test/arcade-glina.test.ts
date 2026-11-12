import { describe, expect, it } from 'vitest';
import type { ArcadeAudio } from '../src/arcade/kit/audio';
import { BEGINNER_TUNING, DEFAULT_TUNING, type FocusFrame } from '../src/arcade/kit/focus';
import { CHECK_SIZES, MIN_READ, MIN_TAP, MIN_TEXT, auditTargets } from '../src/arcade/kit/mobile';
import type { ArcadeGame, GameEnv, Insets, TapTarget } from '../src/arcade/kit/types';
import glina, { LIFT } from '../src/arcade/glina/index';
import { DOCK_ROW, EDGE, layout, palette, stageScale } from '../src/arcade/glina/layout';
import { font } from '../src/arcade/glina/paint';
import { radiusAt } from '../src/arcade/glina/vessel';
import { mergeSaved } from '../src/arcade/kit/progress';
import { FORM, FORMS, LINES, MOMENTS, REACT, SHOP, STORY, TIPS, formTarget } from '../src/arcade/glina/content';
import { CATALOGS, coinsText, t } from '../src/arcade/glina/i18n';
import {
  bestOf, buy, capacity, freshProgress, migrate, nextStory, openCount, openForms, shelve, starsToNext, window_, type GlinaProgress, type PieceRec,
} from '../src/arcade/glina/meta';
import { RULES, gradeAt, needleSpeed, shapeStars, starsOf, zoneOf } from '../src/arcade/glina/rules';
import { Pot, RINGS, matchOf, targetOf } from '../src/arcade/glina/shape';
import { GlinaSim, decoOf, planBlocks, recOf, type GlinaEvent } from '../src/arcade/glina/sim';
import { mulberry32 } from '../src/core/random';
import { catalogProblems } from '../src/i18n';

// ── helpers ─────────────────────────────────────────────────────

const TUNING = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.5, focused: false, hold: 0, calm: 0.5, ...p });
const focusing = (): FocusFrame => frame({ activity: 12, level: 0.95, focused: true, hold: 10, calm: 0.05 });
const resting = (): FocusFrame => frame({ activity: -3, level: 0.08, focused: false, hold: 0, calm: 0.92 });
const lost = (): FocusFrame => frame({ reliable: false, activity: null, level: 0, calm: 0 });

const returning = (o: Partial<GlinaProgress> = {}): GlinaProgress => ({ ...freshProgress(), sessions: 4, pushes: 1, ...o });

function newSim(o: { progress?: GlinaProgress; plannedSec?: number; seed?: number; eeg?: boolean; beginner?: boolean } = {}): GlinaSim {
  return new GlinaSim({ progress: o.progress ?? freshProgress(), rng: mulberry32(o.seed ?? 3), plannedSec: o.plannedSec ?? 180, eeg: !!o.eeg, tuning: o.beginner ? BEGINNER : TUNING });
}

/** Run the sim for `sec` from `t0`, with frames from `f(t)` and an optional input each step. */
function run(sim: GlinaSim, sec: number, f: (t: number) => FocusFrame, t0 = 0, input?: (t: number) => void, dt = 0.05): GlinaEvent[] {
  const out: GlinaEvent[] = [];
  for (let t = t0; t < t0 + sec - 1e-9; t += dt) {
    input?.(t);
    sim.update(dt, f(t), t + dt);
    out.push(...sim.take());
  }
  return out;
}

/** The smoke test's crude hands: a centre tap every 0.65 s, Space every 2 s. */
function smokeHands(sim: GlinaSim): (t: number) => void {
  let nextTap = 0.3, nextSpace = 1.0;
  return t => {
    if (t >= nextTap) {
      nextTap += 0.65;
      if (sim.card) sim.dismiss();
      else if (sim.station === 'wheel' && sim.wheel === 'shape') { sim.touchWall(0.45, 0); sim.release(); }
      else if (sim.kiln === 'glaze') sim.paint(0.5);
      else if (sim.kiln === 'fire') sim.stopNeedle();
      else sim.hurry();
    }
    if (t >= nextSpace) {
      nextSpace += 2;
      sim.space();
    }
  };
}

/** A skilled potter: shapes toward the order with the finger, then Gotowe; glazes as asked; fires in the gold. */
function skilledHands(sim: GlinaSim): (t: number) => void {
  return () => {
    if (sim.card) { sim.dismiss(); return; }
    if (sim.station === 'wheel' && sim.wheel === 'shape' && sim.pot) {
      const pot = sim.pot;
      if (pot.match >= 0.93 || sim.t - sim.lastInput > 6) { sim.done(); return; }
      const w = pot.worst();
      if (w.k < 0) sim.touchRim(pot.target.H);
      else sim.touchWall(w.k / (RINGS - 1), pot.target.r[w.k]);
      return;
    }
    sim.release();
    if (sim.kiln === 'glaze') sim.glazeAsAsked();
    if (sim.kiln === 'fire') {
      const z = zoneOf(sim.heat, sim.p.kiln);
      if (sim.needle >= z.glo && sim.needle <= z.ghi) sim.stopNeedle();
    }
  };
}

// ── the clay ────────────────────────────────────────────────────

describe('Glina clay on the wheel (Let’s Create! Pottery’s shaping)', () => {
  const target = formTarget('garnek');

  it('starts from a lump: lower than the order and far from its shape', () => {
    const pot = new Pot(target);
    expect(pot.H).toBeCloseTo(RULES.lumpH * target.H, 5);
    expect(pot.match).toBeLessThan(0.7);
    expect(pot.match).toBeGreaterThanOrEqual(0);
  });

  it('a finger on the wall pulls it in or out at its height, with a soft brush', () => {
    const pot = new Pot(target);
    const before = Float64Array.from(pot.r);
    for (let i = 0; i < 30; i++) pot.wall(0.5, 2, 1 / 30, 0.5, () => 0);
    const mid = Math.round(0.5 * (RINGS - 1));
    expect(pot.r[mid]).toBeLessThan(before[mid] - 1);
    expect(Math.abs(pot.r[RINGS - 1] - before[RINGS - 1])).toBeLessThan(0.3);   // the rim is outside the brush
    for (let i = 0; i < 30; i++) pot.wall(0.5, 12, 1 / 30, 0.5, () => 0);
    expect(pot.r[mid]).toBeGreaterThan(before[mid]);
  });

  it('a finger at the rim raises or presses the pot, within its limits', () => {
    const pot = new Pot(target);
    for (let i = 0; i < 60; i++) pot.height(target.H * 3, 1 / 30);
    expect(pot.H).toBeCloseTo(RULES.hMax * target.H, 3);
    for (let i = 0; i < 90; i++) pot.height(0, 1 / 30);
    expect(pot.H).toBeCloseTo(RULES.hMin * target.H, 3);
  });

  it('a steady wheel follows the finger faster and snaps onto the order', () => {
    const a = new Pot(target), b = new Pot(target);
    const k = 7, u = k / (RINGS - 1);
    a.wall(u, target.r[k] + 0.3, 0.2, 0.2, () => 0);
    b.wall(u, target.r[k] + 0.3, 0.2, 0.95, () => 0);
    expect(Math.abs(b.r[k] - target.r[k])).toBeLessThan(Math.abs(a.r[k] - target.r[k]));
  });

  it('the wobble roughens strokes; steadiness keeps them clean', () => {
    const rough = new Pot(target), calm = new Pot(target);
    const rnd = mulberry32(5);
    for (let i = 0; i < 90; i++) {
      const u = (i % 30) / 29;
      rough.wall(u, target.r[Math.round(u * 15)], 1 / 30, 0, () => rnd() * 2 - 1);
      calm.wall(u, target.r[Math.round(u * 15)], 1 / 30, 1, () => rnd() * 2 - 1);
    }
    rough.height(target.H, 1);
    calm.height(target.H, 1);
    expect(calm.match).toBeGreaterThan(rough.match);
  });

  it('matches 1 on the order itself, and less the further it is', () => {
    expect(matchOf(target.H, target.r, target)).toBeCloseTo(1, 6);
    const r2 = target.r.map(x => x * 1.2);
    expect(matchOf(target.H, r2, target)).toBeLessThan(0.8);
    expect(matchOf(target.H * 0.7, target.r, target)).toBeLessThan(0.7);
  });

  it('the master’s hand reaches the share it is asked for', () => {
    const pot = new Pot(target);
    const k = pot.shareFor(0.8);
    pot.toward(k);
    expect(pot.match).toBeGreaterThan(0.79);
    expect(pot.match).toBeLessThan(0.86);
    expect(pot.shareFor(0.5)).toBe(0);
  });

  it('stays finite and inside its limits under thousands of random gestures', () => {
    const rnd = mulberry32(11);
    for (const f of FORMS) {
      const pot = new Pot(formTarget(f.id));
      for (let i = 0; i < 400; i++) {
        if (rnd() < 0.3) pot.height(rnd() * f.N * 3 - f.N, rnd() * 0.2);
        else pot.wall(rnd() * 1.2 - 0.1, rnd() * f.N * 2, rnd() * 0.2, rnd(), () => rnd() * 2 - 1);
        pot.true_(rnd() * 0.1, rnd());
      }
      expect(Number.isFinite(pot.H)).toBe(true);
      expect(pot.H).toBeGreaterThanOrEqual(pot.hLo - 1e-9);
      expect(pot.H).toBeLessThanOrEqual(pot.hHi + 1e-9);
      for (const r of pot.r) {
        expect(Number.isFinite(r)).toBe(true);
        expect(r).toBeGreaterThanOrEqual(RULES.rMin - 1e-9);
        expect(r).toBeLessThanOrEqual(pot.rHi + 1e-9);
      }
      expect(pot.r[0]).toBeGreaterThanOrEqual(RULES.foot * Math.max(...pot.r) - 1e-9);
    }
  });

  it('every form’s order is reachable (its foot within the clay’s limits)', () => {
    for (const f of FORMS) {
      const tg = formTarget(f.id), pot = new Pot(tg);
      pot.toward(1);
      expect(pot.match, f.id).toBeGreaterThan(0.97);
    }
  });

  it('builds a target from a height and a profile', () => {
    const tg = targetOf(10, new Float64Array(RINGS).fill(0.4));
    expect(tg.H).toBe(10);
    expect(tg.r[3]).toBeCloseTo(4, 6);
  });
});

// ── the rules ───────────────────────────────────────────────────

describe('Glina rules', () => {
  it('stars from the shape and the overall quality', () => {
    expect(shapeStars(0.5)).toBe(1);
    expect(shapeStars(0.8)).toBe(2);
    expect(shapeStars(0.95)).toBe(3);
    expect(starsOf(0.6)).toBe(1);
    expect(starsOf(0.75)).toBe(2);
    expect(starsOf(0.9)).toBe(3);
  });

  it('even heat widens the kiln’s green and slows the needle', () => {
    const cold = zoneOf(0), calm = zoneOf(1);
    expect(calm.hi - calm.lo).toBeGreaterThan(cold.hi - cold.lo);
    expect(needleSpeed(1)).toBeLessThan(needleSpeed(0));
    expect(zoneOf(0.5, 2).hi - zoneOf(0.5, 2).lo).toBeGreaterThan(zoneOf(0.5).hi - zoneOf(0.5).lo);
    expect(gradeAt(RULES.zoneC, 0.5)).toBe('perfect');
    expect(gradeAt(0.05, 0.5)).toBe('soft');
    expect(gradeAt(0.98, 0.5)).toBe('hot');
    const z = zoneOf(0.5);
    expect(gradeAt((z.lo + z.glo) / 2, 0.5)).toBe('good');
  });
});

// ── the session ─────────────────────────────────────────────────

describe('Glina blocks', () => {
  it('fills the planned time: warm-up first for a newcomer, push/rest pairs ending in a rest', () => {
    for (const planned of [10, 40, 60, 180, 300, 600]) {
      for (const first of [true, false]) {
        const plan = planBlocks(planned, first, mulberry32(planned));
        const sum = plan.reduce((s, b) => s + b.dur, 0);
        expect(sum).toBeCloseTo(Math.max(10, planned), 5);
        expect(plan[0].kind).toBe(first ? 'warmup' : 'push');
        expect(plan[plan.length - 1].kind).toBe('rest');
        if (planned >= 180) for (const b of plan.filter(x => x.kind !== 'warmup')) expect(b.dur).toBeGreaterThanOrEqual(RULES.minBlock - 1e-9);
      }
    }
  });

  it('makes every 4th push block blind from the 3rd session, never the first of a session', () => {
    const sim = newSim({ progress: returning({ sessions: 4, pushes: 2 }), plannedSec: 300 });
    sim.start();
    run(sim, 300, () => frame());
    const pushes = sim.plan.filter(b => b.kind === 'push');
    expect(pushes[0].blind).toBe(false);
    pushes.forEach((b, i) => expect(b.blind).toBe(i > 0 && (2 + i + 1) % RULES.blindEvery === 0));
    const fresh = newSim({ progress: returning({ sessions: 1, pushes: 3 }), plannedSec: 300 });
    fresh.start();
    run(fresh, 300, () => frame());
    expect(fresh.plan.some(b => b.blind)).toBe(false);
  });

  it('tells the runner the block, the seconds left and the next block during the telegraph', () => {
    const sim = newSim({ progress: returning(), plannedSec: 120 });
    sim.start();
    expect(sim.pushBlock).toBe(true);
    expect(sim.tip).toBe(TIPS.push[(sim.session - 1) % TIPS.push.length]);
    const d = sim.plan[0].dur;
    run(sim, d - 2, () => frame());
    expect(sim.telegraphing).toBe(true);
    expect(sim.next?.kind).toBe('rest');
    expect(sim.left).toBeLessThan(2.2);
  });

  it('judges each block once at its end', () => {
    const sim = newSim({ progress: returning(), plannedSec: 120 });
    sim.start();
    const ev = run(sim, 121, t => (t < sim.plan[0].dur ? focusing() : resting()));
    const ends = ev.filter((e): e is Extract<GlinaEvent, { type: 'blockEnd' }> => e.type === 'blockEnd');
    expect(ends.length).toBe(sim.plan.length);
    expect(ends[0].verdict).toBe(true);
  });
});

describe('Glina band: steadiness and even heat', () => {
  it('a focused push stills the wheel past the lead-in, shows the guide and fills the master’s hand', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180 });
    sim.start();
    run(sim, 3, () => focusing());
    expect(sim.steady).toBeCloseTo(sim.base, 1);   // the lead-in: no say yet
    expect(sim.meter()).toBeCloseTo(sim.base, 1);
    let spun = false;
    const ev = run(sim, 18, () => focusing(), 3);
    spun = ev.some(e => e.type === 'spin');
    expect(sim.steady).toBeGreaterThan(0.8);
    expect(sim.guideSeen).toBe(true);
    expect(spun).toBe(true);
  });

  it('a poor signal freezes steadiness and the heat at neutral (never a loss), and hides the gauge', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180 });
    sim.start();
    run(sim, 15, () => lost());
    expect(sim.steady).toBeCloseTo(sim.base, 2);
    expect(sim.meter()).toBeNull();
    expect(sim.charge).toBe(0);
    run(sim, sim.plan[0].dur - 15 + 10, () => lost(), 15);
    expect(sim.restBlock).toBe(true);
    expect(sim.heat).toBeCloseTo(0.5, 2);
  });

  it('a calm rest builds even heat; the meter shows it', () => {
    const sim = newSim({ progress: returning(), plannedSec: 120 });
    sim.start();
    const d = sim.plan[0].dur;
    run(sim, d + 12, t => (t < d ? frame() : resting()));
    expect(sim.restBlock).toBe(true);
    expect(sim.heat).toBeGreaterThan(0.8);
    expect(sim.meter()).toBeCloseTo(sim.heat, 6);
  });

  it('a blind push hides the gauge and reveals its share at the end', () => {
    const sim = newSim({ progress: returning({ sessions: 4, pushes: 2 }), plannedSec: 300 });
    sim.start();
    const ev = run(sim, 300, () => focusing());
    const reveal = ev.find(e => e.type === 'reveal');
    expect(reveal).toBeTruthy();
    expect(sim.blindShare).toBeGreaterThan(80);
  });

  it('the pad follows the band only in a sighted push', () => {
    const sim = newSim({ progress: returning(), plannedSec: 120 });
    sim.start();
    run(sim, 8, () => focusing());
    expect(sim.padLevel(focusing())).toBe(focusing().level);
    run(sim, sim.plan[0].dur, () => resting(), 8);
    expect(sim.padLevel(resting())).toBeNull();
  });
});

describe('Glina orders, glazing, the kiln and the sale', () => {
  it('opens on a household’s story order, then orders open forms', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180 });
    sim.start();
    run(sim, 1, () => frame());
    expect(sim.order?.story?.house).toBe('karczma');
    expect(sim.order?.form).toBe(STORY.karczma[0]);
    const o = sim.makeOrder();
    expect(o.story).toBeNull();
    expect(openForms(sim.p)).toContain(o.form);
  });

  it('runs a whole order in the warm-up: shape, glaze, fire, sell', () => {
    const sim = newSim({ plannedSec: 300 });
    sim.start();
    expect(sim.card?.kind).toBe('open');
    run(sim, 1, () => frame());
    sim.dismiss();
    const ev = run(sim, 40, () => frame(), 1, skilledHands(sim));
    const kinds = ev.map(e => e.type);
    for (const k of ['order', 'cut', 'glazeStart', 'heat', 'fire', 'open', 'sale'] as const) expect(kinds).toContain(k);
    expect(sim.score).toBeGreaterThan(0);
    expect(sim.three).toBeGreaterThan(0);
  });

  it('Gotowe on a poor shape lets the master finish it toward the order', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180 });
    sim.start();
    run(sim, 1.5, () => frame());
    expect(sim.wheel).toBe('shape');
    sim.done();
    expect(sim.wheel).toBe('assist');
    const ev = run(sim, 2, () => frame(), 1.5);
    const cut = ev.find((e): e is Extract<GlinaEvent, { type: 'cut' }> => e.type === 'cut');
    expect(cut?.piece.assisted).toBe(true);
    expect(cut!.piece.match).toBeGreaterThan(RULES.assist - 0.02);
  });

  it('glazing: a colour dips, a drag paints a band, the decoration counts the order', () => {
    const sim = newSim({ plannedSec: 300 });
    sim.start();
    sim.card = null;
    run(sim, 1.5, () => frame());
    sim.done();
    run(sim, 3, () => frame(), 1.5);
    expect(sim.kiln).toBe('glaze');
    const pc = sim.glazing!;
    const wrong = sim.p.glazes.find(g => g !== pc.order.glaze)!;
    expect(sim.pickGlaze(wrong)).toBe(true);
    expect(pc.glaze).toBe(wrong);
    expect(decoOf(pc)).toBeLessThan(0.7);
    sim.pickGlaze(pc.order.glaze);   // a new colour: the brush only
    expect(pc.glaze).toBe(wrong);
    sim.pickGlaze(pc.order.glaze);   // the brush's own colour again: a dip
    expect(pc.glaze).toBe(pc.order.glaze);
    expect(sim.paint(0.5)).toBe(true);
    expect(pc.bands.length).toBe(1);
    sim.paint(0.52);                 // painting over the same band changes nothing
    expect(pc.bands.length).toBe(1);
    expect(decoOf(pc)).toBeCloseTo(1, 6);
  });

  it('the kiln: a stop in the gold is a perfect firing; the apprentice glazes what is late', () => {
    const sim = newSim({ progress: returning(), plannedSec: 120 });
    sim.start();
    const d = sim.plan[0].dur;
    run(sim, d + 0.5, () => frame(), 0, smokeHands(sim));
    expect(sim.restBlock).toBe(true);
    expect(['glaze', 'heat']).toContain(sim.kiln);
    let t = d + 0.5;
    while (sim.kiln !== 'fire' && t < d + 20) { sim.update(0.05, frame(), t); t += 0.05; }
    expect(sim.kiln).toBe('fire');
    const z = zoneOf(sim.heat, sim.p.kiln);
    while (!(sim.needle >= z.glo && sim.needle <= z.ghi)) { sim.update(0.01, frame(), t); t += 0.01; }
    sim.stopNeedle();
    expect(sim.fired?.grade).toBe('perfect');
  });

  it('nothing is lost: every piece made is sold by the session’s end', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180, seed: 9 });
    sim.start();
    const ev = run(sim, 180, () => frame(), 0, smokeHands(sim));
    const made = ev.filter(e => e.type === 'cut').length;
    const sold = ev.filter(e => e.type === 'sale').length + ev.filter((e): e is Extract<GlinaEvent, { type: 'market' }> => e.type === 'market').reduce((s, e) => s + e.n, 0);
    expect(made).toBeGreaterThan(2);
    expect(sold).toBe(made);
    expect(sim.batch.length).toBe(0);
    expect(sim.market.length).toBe(0);
  });

  it('a full kiln shelf sends more pieces to the market', () => {
    const sim = newSim({ progress: returning(), plannedSec: 300 });
    sim.start();
    const ev = run(sim, sim.plan[0].dur - 0.1, () => frame(), 0, smokeHands(sim));
    const cuts = ev.filter((e): e is Extract<GlinaEvent, { type: 'cut' }> => e.type === 'cut');
    expect(cuts.length).toBeGreaterThan(capacity(sim.p));
    expect(cuts.filter(c => !c.market).length).toBe(capacity(sim.p));
  });

  it('a story order with two stars or more moves the household’s story on', () => {
    const p = returning();
    const sim = newSim({ progress: p, plannedSec: 120 });
    sim.start();
    run(sim, 120, () => frame(), 0, skilledHands(sim));
    expect(p.steps.karczma).toBe(1);
    expect(sim.stories[0]).toEqual({ house: 'karczma', step: 1 });
    expect(nextStory(p)).toBe('piekarnia');
  });
});

describe('Glina smoke contract and the runner', () => {
  it('scores with only centre taps and Space within 22 s of a first-ever session', () => {
    const sim = newSim({ plannedSec: 180, beginner: true });
    sim.start();
    const ev = run(sim, 22, () => frame({ level: 0.7, calm: 0.3, activity: 4 }), 0, smokeHands(sim));
    expect(sim.score).toBeGreaterThan(0);
    expect(ev.some(e => e.type === 'sale')).toBe(true);
  });

  it('scores with the same hands in a returning session within a block pair', () => {
    const sim = newSim({ progress: returning(), plannedSec: 180 });
    sim.start();
    run(sim, sim.plan[0].dur + sim.plan[1].dur, () => frame(), 0, smokeHands(sim));
    expect(sim.score).toBeGreaterThan(0);
  });

  it('result() is idempotent and records with max', () => {
    const p = returning({ best: 5 });
    const sim = newSim({ progress: p, plannedSec: 60 });
    sim.start();
    run(sim, 60, () => frame(), 0, smokeHands(sim));
    const a = sim.result(), b = sim.result();
    expect(b).toEqual(a);
    expect(p.best).toBe(Math.max(5, a.score));
    expect(a.highlights.length).toBeGreaterThan(0);
    expect(a.verse).toBeTruthy();
    const purse = p.purse;
    sim.result();
    expect(p.purse).toBe(purse);
  });

  it('finish() settles an early end: the work in hand is sold', () => {
    const sim = newSim({ progress: returning(), plannedSec: 300 });
    sim.start();
    run(sim, 12, () => frame(), 0, smokeHands(sim));
    const before = sim.score;
    sim.finish();
    expect(sim.ended).toBe(true);
    expect(sim.score).toBeGreaterThanOrEqual(before);
    expect(sim.batch.length + sim.market.length).toBe(0);
  });

  it('plays any planned length from 10 s without errors, the headline climbing', () => {
    for (const planned of [10, 25, 40]) {
      const sim = newSim({ plannedSec: planned, seed: planned });
      sim.start();
      run(sim, planned + 1, () => frame(), 0, smokeHands(sim));
      expect(sim.ended).toBe(true);
      expect(sim.headlineSub().length).toBeGreaterThan(0);
    }
  });
});

// ── the meta ─────────────────────────────────────────────────────

describe('Glina meta', () => {
  it('opens forms by stars and tells the stars to the next', () => {
    const p = freshProgress();
    expect(openCount(p)).toBe(4);
    expect(starsToNext(p)).toBe(6);
    p.stars = 13;
    expect(openCount(p)).toBe(6);
    p.stars = 999;
    expect(openForms(p).length).toBe(FORMS.length);
    expect(starsToNext(p)).toBeNull();
  });

  it('the shop sells in order, with the purse', () => {
    const p = freshProgress();
    expect(buy(p, 'g.seledyn')).toBe(false);
    p.purse = 1000;
    expect(buy(p, 'w.2')).toBe(false);   // level 1 first
    expect(buy(p, 'w.1')).toBe(true);
    expect(p.wheel).toBe(1);
    expect(buy(p, 'g.seledyn')).toBe(true);
    expect(p.glazes).toContain('seledyn');
    expect(buy(p, 'g.seledyn')).toBe(false);
    expect(buy(p, 'k.1')).toBe(true);
    expect(capacity(p)).toBe(4);
    expect(p.purse).toBe(1000 - 60 - 40 - 80);
    expect(window_(p).every(it => !SHOP.find(x => x.id === it.id && x.kind === 'wheel' && x.ref === 1))).toBe(true);
  });

  it('a better piece replaces its form’s on the shelf', () => {
    const p = freshProgress();
    const rec = (stars: 1 | 2 | 3, m: number): PieceRec => ({ f: 'kubek', h: 11, q: new Array(RINGS).fill(40), g: 'biel', b: [], stars, m, gift: null });
    expect(shelve(p, rec(2, 80))).toBe('new');
    expect(shelve(p, rec(2, 70))).toBe('same');
    expect(shelve(p, rec(3, 60))).toBe('up');
    expect(p.shelf.kubek?.stars).toBe(3);
  });

  it('migrates a realistic v1 save: keeps sessions, the old record, its glazes and story steps', () => {
    const old = {
      v: 1, sessions: 7, vessels: 21, cmTotal: 312.4,
      steps: { karczma: 2, piekarnia: 4, mlodzi: 1 }, introduced: ['karczma', 'piekarnia', 'mlodzi'], storyDay: '2026-10-30',
      street: { karczma: [{ f: 'kubek', glaze: 'biel' }], piekarnia: [], mlodzi: [] },
      book: { kubek: { n: 3, best: { f: 'kubek', h: 11.2, q: [36], stars: 3, sim: 92, wall: 1, centre: true, glaze: 'biel', runs: 40, gift: null, second: false, porcelain: false }, tall: 12, marks: 3 } },
      newest: 'kubek', sinceGift: 2, sinceMoon: 11, throwsBegun: 18, firingsBegun: 17, glazes: ['biel', 'miod', 'kobalt'],
      gifts: ['kot', 'kobalt'], giftDay: '2026-10-30', dailyDay: '2026-10-30', dailyBest: 81, lastDay: '2026-10-30', todayN: 1, seconds: 2,
      bestSession: 48, tallest: 31.5, bestThree: 2,
    };
    const p = migrate(mergeSaved(freshProgress(), old));
    expect(p.ver).toBe(2);
    expect('v' in p).toBe(false);
    expect(p.sessions).toBe(7);
    expect(p.legacyCm).toBe(48);
    expect(p.best).toBe(0);
    expect(p.glazes).toEqual(expect.arrayContaining(['biel', 'miod', 'zelazo', 'kobalt']));
    expect(p.steps).toEqual({ karczma: 2, piekarnia: 4, mlodzi: 1 });
    expect(p.shelf).toEqual({});
    expect(Array.isArray(p.gifts)).toBe(false);
    expect(bestOf(p)).toBe(0);
    // and it plays
    const sim = newSim({ progress: p, plannedSec: 40 });
    sim.start();
    run(sim, 41, () => frame(), 0, smokeHands(sim));
    expect(sim.ended).toBe(true);
  });

  it('never crashes on fields of the wrong type in a v2 save', () => {
    const bad = {
      ver: 2, sessions: '3', best: null, purse: -5, glazes: 'biel', patterns: [1, 'fala', 'zzz'], wheel: 9, kiln: 'x',
      shelf: { kubek: { q: [1, 2] }, misa: 5, sloj: { h: 20, q: new Array(RINGS).fill(45), g: 'neon', b: [[50, 'biel', 'pas'], 'x'], stars: 7, m: 300 } },
      steps: { karczma: 'a', mlodzi: 9 }, gifts: [1], seen: 'x', extra: 1,
    };
    const p = migrate(mergeSaved(freshProgress(), bad));
    expect(p.sessions).toBe(0);
    expect(p.best).toBe(0);
    expect(p.purse).toBe(0);
    expect(p.glazes).toEqual(['biel', 'miod', 'zelazo']);
    expect(p.patterns).toEqual(['pas', 'fala']);
    expect(p.wheel).toBe(3);
    expect(p.kiln).toBe(0);
    expect(p.shelf.kubek).toBeUndefined();
    expect(p.shelf.sloj?.g).toBe('biel');
    expect(p.shelf.sloj?.stars).toBe(3);
    expect(p.shelf.sloj?.m).toBe(100);
    expect(p.shelf.sloj?.b.length).toBe(1);
    expect(p.steps).toEqual({ karczma: 0, piekarnia: 0, mlodzi: 4 });
    expect(p.seen).toEqual([]);
    expect('extra' in p).toBe(false);
  });

  it('a sold piece is kept small and redrawable', () => {
    const sim = newSim({ plannedSec: 300 });
    sim.start();
    sim.card = null;
    run(sim, 30, () => frame(), 0, skilledHands(sim));
    const rec = Object.values(sim.p.shelf)[0]!;
    expect(rec.q.length).toBe(RINGS);
    expect(rec.h).toBeGreaterThan(0);
    void recOf;
  });
});

// ── words ───────────────────────────────────────────────────────

describe('Glina words', () => {
  it('has every text in all four languages with the Polish placeholders and plural forms', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
  });

  it('keeps the cat’s lines short, at least three per moment, and the reactions three each', () => {
    for (const m of MOMENTS) {
      expect(LINES[m].length, m).toBeGreaterThanOrEqual(3);
      for (const s of LINES[m]) expect(s.length, s).toBeLessThanOrEqual(90);
    }
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (k.startsWith('cat.') && typeof v === 'string') expect(v.length, `${l}.${k}`).toBeLessThanOrEqual(90);
      }
    }
    for (const r of Object.values(REACT)) expect(r.length).toBe(3);
  });

  it('uses each language’s quotation marks, du in German and Swedish, no banned words in the strategies', () => {
    for (const s of Object.values(CATALOGS.de)) if (typeof s === 'string' && /[„“]/.test(s)) expect(s).toMatch(/„[^„“]+“/);
    for (const s of Object.values(CATALOGS.sv)) if (typeof s === 'string' && /”/.test(s)) expect(s).toMatch(/”[^”]+”/);
    for (const s of Object.values(CATALOGS.pl)) if (typeof s === 'string' && /„/.test(s)) expect(s).toMatch(/„[^„”]+”/);
    for (const l of ['pl', 'en', 'de', 'sv'] as const) {
      for (const [k, v] of Object.entries(CATALOGS[l])) {
        if (!k.startsWith('tip.') || typeof v !== 'string') continue;
        expect(v, `${l}.${k}`).not.toMatch(/mocniej|harder|stärker|hårdare|koncentr/i);
      }
    }
    expect(t('unit', { n: 5 })).toBe('5 sykli');
    expect(coinsText(2)).toBe('2 sykle');
    expect(FORM.kubek.name).toBe('kubek');
  });
});

// ── mobile first (DESIGN.md §12) ────────────────────────────────
const PX = /(\d+(?:\.\d+)?)px/;
const pxOf = (f: unknown): number => Number(String(f).match(PX)?.[1] ?? 10);

/** A 2D context that draws nothing: it measures text at 0.56 em a character and notes every string at its largest size. */
function fakeCtx(texts = new Map<string, number>()): CanvasRenderingContext2D {
  const state: Record<string | symbol, unknown> = { font: '10px sans-serif', globalAlpha: 1, lineWidth: 1 };
  const grad = { addColorStop: () => undefined };
  const note = (s: unknown) => {
    const k = String(s), px = pxOf(state.font);
    if (k.trim() && (state.globalAlpha as number) > 0.05) texts.set(k, Math.max(texts.get(k) ?? 0, px));
  };
  const fns: Record<string, (...a: unknown[]) => unknown> = {
    measureText: (s: unknown) => ({ width: String(s).length * pxOf(state.font) * 0.56 }),
    fillText: note, strokeText: note,
    createLinearGradient: () => grad, createRadialGradient: () => grad, createPattern: () => null,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  return new Proxy(state, {
    get: (o, k) => (typeof k === 'string' && k in fns ? fns[k] : k in o ? o[k] : () => undefined),
    set: (o, k, v) => { o[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}

const silent = new Proxy({ on: false }, { get: (o, k) => (k in o ? (o as Record<string | symbol, unknown>)[k] : () => undefined) }) as unknown as ArcadeAudio;

/** The game as the runner makes it, on a canvas that draws nothing (a finger by default, the insets of a CHECK_SIZES entry). */
function phoneGame(progress: GlinaProgress, ins: Insets, o: { texts?: Map<string, number>; touch?: boolean; planned?: number } = {}) {
  const ctx = fakeCtx(o.texts);
  const hints: string[] = [];
  const env = {
    canvas: { getContext: () => ctx } as unknown as HTMLCanvasElement, hud: document.createElement('div'), audio: silent,
    progress, rng: mulberry32(5), day: '2026-11-12', daySeed: 4242, plannedSec: o.planned ?? 180, tool: 'fnirs' as const,
    simulated: true, reducedMotion: false, haptics: false, tuning: TUNING,
    hint: (text: string) => { hints.push(text); }, hudTop: () => ins.top, insets: () => ins, touch: o.touch ?? true,
  } satisfies GameEnv<GlinaProgress>;
  const game = glina.create(env);
  return { game, sim: (game as unknown as { sim: GlinaSim }).sim, hints };
}

/** Run the game `sec` seconds at 60 frames a second, drawing every frame; `each` runs before each frame. */
function play(game: ArcadeGame, clock: { t: number }, sec: number, f: () => FocusFrame = () => frame(), each?: () => void): void {
  for (let i = 0, n = Math.round(sec * 60); i < n; i++) {
    clock.t += 1 / 60;
    each?.();
    game.update(1 / 60, f(), clock.t);
    game.draw();
  }
}

/** Play until `cond` holds (at most `max` s). */
function until(game: ArcadeGame, clock: { t: number }, cond: () => boolean, max = 30, each?: () => void): void {
  for (let i = 0; i < max * 60 && !cond(); i++) play(game, clock, 1 / 60, () => frame(), each);
}

const ALL_GLAZES = ['biel', 'miod', 'zelazo', 'seledyn', 'kobalt', 'oliwka', 'turkus', 'purpura'] as const;
const ALL_PATTERNS = ['pas', 'fala', 'kropki', 'zygzak', 'galazka'] as const;

describe('Glina: mobile first', () => {
  it('never asks for canvas text under 11 px', () => {
    for (const size of [0, 4, 8, 10.9, 11, 13, 22]) expect(pxOf(font(800, size, 'x'))).toBeGreaterThanOrEqual(MIN_TEXT);
    expect(pxOf(font(600, 15, 'x', true))).toBe(15);
  });

  it('lays out every checked screen phone first: the ticket under the HUD, a stage for the pot, Gotowe under the thumb', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      const phone = Math.min(s.w, s.h) <= 430;
      expect(L.u, s.name).toBeGreaterThanOrEqual(1);
      expect(L.u, s.name).toBeLessThanOrEqual(1.3);
      if (phone) expect(L.u, s.name).toBeLessThan(1.1);
      expect(L.portrait, s.name).toBe(s.h > s.w * 1.05);
      // the ticket: under the HUD, inside the safe edges, readable (at least 100 px tall)
      expect(L.ticket.y, s.name).toBeGreaterThanOrEqual(s.insets.top);
      expect(L.ticket.x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE);
      expect(L.ticket.x + L.ticket.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - EDGE);
      expect(L.ticket.h, s.name).toBeGreaterThanOrEqual(100);
      // room for the pot between the top band and the wheel
      expect(L.stageH, s.name).toBeGreaterThanOrEqual(phone ? 130 : 200);
      expect(L.floor - L.stageH, s.name).toBeGreaterThan(s.insets.top);
      // Gotowe: finger-sized, in the safe area, clear of the dock's row; upright under the wheel in the thumb zone
      const d = L.done;
      expect(auditTargets([{ label: 'Gotowe', ...d }], s.w, s.h, s.insets), s.name).toEqual([]);
      expect(Math.min(d.w, d.h), s.name).toBeGreaterThanOrEqual(48);
      expect(d.x, s.name).toBeGreaterThanOrEqual(s.insets.left + EDGE - 0.5);
      expect(d.x + d.w, s.name).toBeLessThanOrEqual(s.w - s.insets.right - EDGE + 0.5);
      expect(d.y + d.h, s.name).toBeLessThanOrEqual(s.h - DOCK_ROW);
      if (L.portrait) {
        // a finger working the pot's foot (the hand LIFT px above it) stays above the button
        expect(d.y, s.name).toBeGreaterThanOrEqual(L.floor + LIFT * L.u);
        expect(d.y, s.name).toBeGreaterThanOrEqual(s.h * 0.55);
        // the level beside it, never under it
        expect(L.level.x + L.level.w, s.name).toBeLessThanOrEqual(d.x - 6);
      } else {
        // on its side Gotowe stands right of the wheel, clear of the pot's widest (stageScale keeps it within 0.95 stageW)
        expect(d.x, s.name).toBeGreaterThanOrEqual(L.axis + L.stageW * 0.95);
      }
    }
  });

  it('lays the glazing palette out finger-sized and apart, with room for the piece, for 1–8 glazes and 1–5 patterns', () => {
    for (const s of CHECK_SIZES) {
      const L = layout(s.w, s.h, s.insets);
      for (const [nc, np] of [[3, 1], [3, 2], [4, 2], [5, 3], [6, 5], [8, 1], [8, 5]]) {
        const P = palette(L, nc, np);
        expect(P.colors, s.name).toHaveLength(nc);
        expect(P.patterns, s.name).toHaveLength(np > 1 ? np : 0);
        const tg: TapTarget[] = [
          ...P.colors.map((c, i) => ({ label: `glaze ${i}`, x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 })),
          ...P.patterns.map((r, i) => ({ label: `pattern ${i}`, ...r })),
          { label: 'Gotowe', ...P.done },
        ];
        expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name} ${nc}/${np}`).toEqual([]);
        for (const t0 of tg) {
          expect(t0.x, `${s.name} ${t0.label}`).toBeGreaterThanOrEqual(s.insets.left + EDGE - 0.5);
          expect(t0.x + t0.w, `${s.name} ${t0.label}`).toBeLessThanOrEqual(s.w - s.insets.right - EDGE + 0.5);
          expect(t0.y + t0.h, `${s.name} ${t0.label}`).toBeLessThanOrEqual(s.h - DOCK_ROW);
          // under the thumb upright: the palette is the screen's lower half
          if (L.portrait) expect(t0.y, `${s.name} ${t0.label}`).toBeGreaterThanOrEqual(s.h * 0.5);
        }
        // the piece keeps a stage over the palette (upright under the compact ticket)
        const top = L.portrait ? P.ticket.y + P.ticket.h + 12 : L.floor - L.stageH;
        expect(P.floor - top, `${s.name} ${nc}/${np}`).toBeGreaterThanOrEqual(80);
        // the swatches never crowd the piece's own room on its side: they sit under the floor
        expect(P.top, s.name).toBeGreaterThan(P.floor);
      }
    }
  });

  it('reports what can be tapped in each state, finger-sized and in the safe area, at every checked size', () => {
    for (const s of CHECK_SIZES) {
      const { game, sim } = phoneGame(freshProgress(), s.insets);
      game.resize(s.w, s.h, 2);
      game.start();
      const clock = { t: 0 };
      // the opening card: a tap goes on (after a moment)
      play(game, clock, 0.8);
      let tg = game.targets!();
      expect(tg.map(x => x.label), s.name).toEqual(['card']);
      expect(auditTargets(tg, s.w, s.h, s.insets), s.name).toEqual([]);
      sim.dismiss();
      // shaping: Gotowe
      until(game, clock, () => sim.wheel === 'shape');
      tg = game.targets!();
      expect(tg.map(x => x.label), s.name).toEqual(['Gotowe']);
      expect(auditTargets(tg, s.w, s.h, s.insets), s.name).toEqual([]);
      // glazing with the full palette: every swatch, chip and Gotowe
      sim.p.glazes = [...ALL_GLAZES];
      sim.p.patterns = [...ALL_PATTERNS];
      sim.done();
      until(game, clock, () => !!sim.glazing);
      tg = game.targets!();
      expect(tg, s.name).toHaveLength(8 + 5 + 1);
      expect(auditTargets(tg, s.w, s.h, s.insets), `${s.name} glazing`).toEqual([]);
      for (const t0 of tg) expect(Math.min(t0.w, t0.h), `${s.name} ${t0.label}`).toBeGreaterThanOrEqual(MIN_TAP);
      // a tap on a swatch dips the piece in that glaze, a chip picks the pattern, Gotowe sends it on
      const kob = tg.find(x => x.label === 'glaze kobalt')!;
      game.pointer!({ type: 'down', x: kob.x + kob.w / 2, y: kob.y + kob.h / 2, id: 1 });
      game.pointer!({ type: 'up', x: kob.x + kob.w / 2, y: kob.y + kob.h / 2, id: 1 });
      expect(sim.glazing?.glaze, s.name).toBe('kobalt');
      const fala = tg.find(x => x.label === 'pattern fala')!;
      game.pointer!({ type: 'down', x: fala.x + fala.w / 2, y: fala.y + fala.h / 2, id: 2 });
      game.pointer!({ type: 'up', x: fala.x + fala.w / 2, y: fala.y + fala.h / 2, id: 2 });
      expect(sim.brush.pattern, s.name).toBe('fala');
      const done = tg.find(x => x.label === 'glazing Gotowe')!;
      game.pointer!({ type: 'down', x: done.x + done.w / 2, y: done.y + done.h / 2, id: 3 });
      game.pointer!({ type: 'up', x: done.x + done.w / 2, y: done.y + done.h / 2, id: 3 });
      expect(sim.glazing, s.name).toBe(null);
      // the kiln: nothing to aim at (a tap anywhere stops the needle)
      until(game, clock, () => sim.kiln === 'fire');
      expect(game.targets!(), s.name).toEqual([]);
    }
  });

  it('on a phone the hand works above the finger: no jump on touch-down, the wall follows the sideways move', () => {
    const s = CHECK_SIZES[0];
    const { game, sim } = phoneGame(returning(), s.insets);
    game.resize(s.w, s.h, 2);
    game.start();
    const clock = { t: 0 };
    until(game, clock, () => sim.wheel === 'shape' && !!sim.pot);
    play(game, clock, 0.6);
    const L = layout(s.w, s.h, s.insets), pot = sim.pot!, sc = stageScale(L, sim.order!.target);
    // a finger right of the pot, low on it: the hand works LIFT px above it, at the wall there
    const fy = L.floor - pot.H * sc * 0.25 + LIFT;
    const u = (L.floor - (fy - LIFT)) / (pot.H * sc);
    const x0 = L.axis + radiusAt(pot.r, u) * sc + 30;
    game.pointer!({ type: 'down', x: x0, y: fy, id: 1 });
    const f0 = sim.finger!;
    expect(f0.mode).toBe('wall');
    if (f0.mode !== 'wall') return;
    expect(f0.u).toBeCloseTo(u, 2);
    expect(f0.d).toBeCloseTo(radiusAt(pot.r, u), 1);
    // 20 px inward: 20 px narrower at that height (the finger stays outside the clay)
    game.pointer!({ type: 'move', x: x0 - 20, y: fy, id: 1 });
    const f1 = sim.finger!;
    if (f1.mode !== 'wall') throw new Error('wall');
    expect(f1.d).toBeCloseTo(radiusAt(pot.r, u) - 20 / sc, 1);
    game.pointer!({ type: 'up', x: x0 - 20, y: fy, id: 1 });
    expect(sim.finger).toBe(null);
    // the rim: a finger LIFT below it pulls the pot taller as it rises, from where it is (no jump)
    const H0 = sim.pot!.H, ry = L.floor - H0 * sc + LIFT - 4;
    game.pointer!({ type: 'down', x: L.axis, y: ry, id: 2 });
    const r0 = sim.finger!;
    expect(r0.mode).toBe('rim');
    if (r0.mode === 'rim') expect(r0.H).toBeCloseTo(H0, 2);
    game.pointer!({ type: 'move', x: L.axis, y: ry - 30, id: 2 });
    const r1 = sim.finger!;
    if (r1.mode === 'rim') expect(r1.H).toBeCloseTo(H0 + 30 / sc, 2);
    game.pointer!({ type: 'up', x: L.axis, y: ry - 30, id: 2 });
    // a finger that comes down on Gotowe (under the pot's foot) and moves works the clay; a tap on it is done
    const d = L.done;
    game.pointer!({ type: 'down', x: d.x + 20, y: d.y + 10, id: 3 });
    expect(sim.wheel).toBe('shape');
    game.pointer!({ type: 'move', x: d.x + 4, y: d.y + 8, id: 3 });
    expect(sim.finger?.mode).toBe('wall');
    game.pointer!({ type: 'up', x: d.x + 4, y: d.y + 8, id: 3 });
    expect(sim.wheel).toBe('shape');
    game.pointer!({ type: 'down', x: d.x + d.w / 2, y: d.y + d.h / 2, id: 4 });
    expect(sim.wheel).toBe('shape');
    game.pointer!({ type: 'up', x: d.x + d.w / 2, y: d.y + d.h / 2, id: 4 });
    expect(sim.wheel === 'assist' || sim.wheel === 'cut').toBe(true);
  });

  it('keeps Szamot quiet while a finger works the clay on a phone', () => {
    const { game, sim } = phoneGame(returning(), CHECK_SIZES[0].insets);
    game.resize(360, 500, 2);
    game.start();
    const clock = { t: 0 };
    until(game, clock, () => sim.wheel === 'shape' && !!sim.pot);
    sim.touchWall(0.4, 3);
    expect(sim.talkBlocked).toBe(true);
    sim.release();
    expect(sim.quietWhileShaping).toBe(true);
  });

  it('draws no play text under 13 px on the smallest phone (the ticket, the cat, the cards, the palette, the gauge)', () => {
    const texts = new Map<string, number>();
    const s = CHECK_SIZES[0];
    const { game, sim } = phoneGame(freshProgress(), s.insets, { texts, planned: 120 });
    game.resize(s.w, s.h, 3);
    game.start();
    const clock = { t: 0 };
    play(game, clock, 1.2);
    sim.dismiss();
    sim.p.glazes = [...ALL_GLAZES];
    sim.p.patterns = [...ALL_PATTERNS];
    // a whole order by the sim's own hands: shape, glaze, fire, sell; the cat says his lines
    let k = 0;
    play(game, clock, 70, () => (sim.pushBlock ? focusing() : sim.restBlock ? resting() : frame()), () => {
      if (sim.card) sim.dismiss();
      if (k++ % 20 === 0 && !sim.talk.line) sim.talk.ask('good', 3, 5);
      if (sim.wheel === 'shape' && sim.pot && k % 90 === 0) sim.done();
      if (sim.glazing && k % 40 === 0) { sim.pickGlaze('kobalt'); sim.paint(0.5); sim.glazeDone(); }
      if (sim.kiln === 'fire' && k % 30 === 0) sim.stopNeedle();
    });
    // let the last words over the counter finish their pop-in (a cut run would note them mid-scale)
    play(game, clock, 2.5);
    const small = [...texts].filter(([, px]) => px < MIN_READ);
    expect(small).toEqual([]);
    expect([...texts].filter(([, px]) => px < MIN_TEXT)).toEqual([]);
    expect(texts.size).toBeGreaterThan(20);
    expect(texts.has(t('ui.order').toUpperCase())).toBe(true);
    expect(texts.has(t('ui.tapOn'))).toBe(true);
    expect(sim.sold).toBeGreaterThan(0);
  });

  it('speaks to a finger: the how-to and the coach marks name keys only on a desktop', () => {
    const how = glina.howto!();
    expect(how.hands.map(h => h.gesture)).toEqual(['drag', 'drag', 'tap', 'keys']);
    const KEYS = /Spac|Space|Leertaste|mellanslag|↑|←|WASD|klawisz|Taste|tangent|\bkey\b|1–8/i;
    for (const lang of ['pl', 'en', 'de', 'sv'] as const) {
      const cat = CATALOGS[lang] as Record<string, unknown>;
      for (const k of Object.keys(cat)) {
        if (k.endsWith('.keys') || !/^(how|hint|ui|card)\./.test(k)) continue;
        expect(String(cat[k]), `${lang} ${k}`).not.toMatch(KEYS);
      }
      expect(String(cat['how.keys']), lang).toMatch(/1–8/);
      expect(String(cat['hint.done.keys']), lang).toMatch(/spac|Space|Leertaste|mellanslag/i);
    }
  });
});
