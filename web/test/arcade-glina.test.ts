import { describe, expect, it } from 'vitest';
import { BEGINNER_TUNING, DEFAULT_TUNING, FocusInput, type FocusFrame, type FocusTuning } from '../src/arcade/kit/focus';
import { passage } from '../src/arcade/kit/scripture';
import { CLAY, Clay, RINGS, U, lineAt, limits, nextStar, profileFrom, starsFor } from '../src/arcade/glina/clay';
import {
  CHAPTERS, DAY_GIFTS, FORM, FORMS, GLAZES, HOUSES, MARK, STORY, runBand, type FormId, type GlazeId, type HouseId,
} from '../src/arcade/glina/content';
import { CATALOGS, cap, cmText, t } from '../src/arcade/glina/i18n';
import {
  addToBook, addToStreet, better, buckets, dailyForm, dayGift, dayIndex, daysBetween, freshProgress, giftFor, nextIntroduction,
  nextStoryHouse, orderGlaze, receiveDayGift, rollGift, tallestOf, welcomeBack, type GlinaProgress, type VesselRec,
} from '../src/arcade/glina/meta';
import { mix } from '../src/arcade/glina/paint';
import { GlinaSim, planSession, type SimEvent } from '../src/arcade/glina/sim';
import { mulberry32 } from '../src/core/random';
import { LANGS, catalogProblems } from '../src/i18n';

const DAY = '2026-10-25';
const STEP = 1 / 60;
/** The session's tuning as the runner builds it: the kit's defaults, Glina's entry, and a beginner's on top. */
const TUNING: FocusTuning = { ...DEFAULT_TUNING, adapt: 0.08 };
const BEGINNER: FocusTuning = { ...TUNING, ...BEGINNER_TUNING };

const frame = (p: Partial<FocusFrame> = {}): FocusFrame =>
  ({ reliable: true, activity: 0, threshold: 2, level: 0.3, focused: false, hold: 0, calm: 0.7, ...p });

type SimOpts = { progress?: Partial<GlinaProgress>; planned?: number; seed?: number; day?: string; eeg?: boolean; daySeed?: number; tuning?: FocusTuning };

function makeSim(o: SimOpts = {}): GlinaSim {
  const sim = new GlinaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed ?? 1), day: o.day ?? DAY,
    daySeed: o.daySeed ?? 4242, plannedSec: o.planned ?? 300, eeg: o.eeg ?? false, tuning: o.tuning ?? TUNING,
  });
  sim.start();
  return sim;
}

/** A returning player: every household met, a few pages open, the day's story step and form done. */
function returning(extra: Partial<GlinaProgress> = {}): Partial<GlinaProgress> {
  const p = freshProgress();
  p.sessions = 6;
  p.vessels = 9;
  p.introduced = ['karczma', 'piekarnia', 'mlodzi'];
  p.steps = { karczma: 2, piekarnia: 1, mlodzi: 2 };
  p.storyDay = DAY;
  p.dailyDay = DAY;
  p.lastDay = DAY;
  p.todayN = 1;
  for (const f of ['kubek', 'misa', 'dzbanek', 'miska', 'miednica'] as FormId[]) {
    p.book[f] = { n: 2, best: rec(f, 10), tall: 10, marks: 0 };
  }
  return { ...p, ...extra };
}

function rec(f: FormId, h: number, o: Partial<VesselRec> = {}): VesselRec {
  return { f, h, q: Array(16).fill(40), stars: 2, sim: 80, wall: 1, centre: false, glaze: 'biel', runs: 40, gift: null, second: false, porcelain: false, ...o };
}

/** Run the sim for `sec` at 60 fps; `f` may depend on the play time. */
function drive(sim: GlinaSim, sec: number, f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, each?: (t: number) => void): SimEvent[] {
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

/** Run until the sim enters `phase` (at most `max` s). */
function until(sim: GlinaSim, phase: GlinaSim['phase'], f: FocusFrame | ((t: number) => FocusFrame), clock = { t: 0 }, max = 700): SimEvent[] {
  const out: SimEvent[] = [];
  let n = 0;
  while (sim.phase !== phase && n++ < max / STEP) {
    clock.t += STEP;
    sim.update(STEP, typeof f === 'function' ? f(clock.t) : f, clock.t);
    out.push(...sim.take());
  }
  return out;
}

const ofType = <K extends SimEvent['type']>(evs: readonly SimEvent[], type: K) => evs.filter((e): e is Extract<SimEvent, { type: K }> => e.type === type);

// ── the clay ────────────────────────────────────────────────────
describe('the clay model', () => {
  const kubek = FORM.kubek;

  it('interpolates each outline monotonically through its control points', () => {
    const q = profileFrom([[0, 0.3], [0.5, 0.6], [1, 0.4]]);
    expect(q[0]).toBeCloseTo(0.3, 9);
    expect(q[RINGS - 1]).toBeCloseTo(0.4, 9);
    for (const v of q) expect(v).toBeLessThanOrEqual(0.6 + 1e-9);   // no overshoot past the highest point
    expect(FORM.dzbanek.q[0]).toBeCloseTo(0.28, 6);
    expect(FORM.miednica.q[RINGS - 1]).toBeCloseTo(1.6, 6);
  });

  it('starts as a centred lump 0.3·N high and 0.8 of the mean target radius wide, narrowing upward', () => {
    const c = new Clay(kubek);
    const mean = kubek.q.reduce((s, v) => s + v, 0) / RINGS;
    expect(c.H).toBeCloseTo(0.3 * kubek.N, 9);
    expect(c.r[5]).toBeCloseTo(0.8 * mean * kubek.N * (1 - 0.12 * U[5]), 6);
    expect(c.r[RINGS - 1]).toBeLessThan(c.r[1]);
    expect(c.opened).toBe(false);
  });

  it('pulls 0.06·N per tap, eases within the last 3 % below the line and stops at it with a contact', () => {
    const c = new Clay(kubek);
    const r5 = c.r[5];
    expect(c.tap()).toBe('moved');
    expect(c.H).toBeCloseTo(0.36 * kubek.N, 9);
    expect(c.r[5]).toBeCloseTo(r5, 9);                       // a pull raises the wall at constant radii
    expect(c.opened).toBe(true);
    const lim = limits(kubek), band = CLAY.ease * (lim.Hmax - lim.Hmin);
    c.H = c.line - band / 2;
    c.pull(1);                                                // half-way into the band: half the step at most
    expect(c.H).toBeLessThanOrEqual(c.line);
    c.H = c.line - band * 0.01;
    const before = c.H;
    c.pull(0.01);
    expect(c.H - before).toBeCloseTo(0.01 * CLAY.easeMin, 9);  // the softest stop is 0.15 of the pull
    let res = c.tap();
    while (res === 'moved') res = c.tap();
    expect(res).toBe('contact');
    expect(c.H).toBeCloseTo(c.line, 9);
    expect(c.tap()).toBe('blocked');
    expect(c.H).toBeCloseTo(c.line, 9);
  });

  it('never overpulls with taps or presses, however many', () => {
    const c = new Clay(kubek);
    for (let i = 0; i < 400; i++) {
      c.tap();
      expect(c.update(STEP, true)).toBeNull();
    }
    expect(c.second).toBe(false);
    expect(c.H).toBeCloseTo(c.line, 9);
  });

  /** Drag the wall to the line, then hold the finger `px` above the contact for `sec`. */
  function overDrag(px: number, sec: number): Clay {
    const c = new Clay(kubek);
    let y = 600;
    for (let i = 0; i < 60 && !c.atLine; i++) {
      y -= 4;
      c.drag(0, 4, y, 0.8, 16);
      c.update(STEP, true);
    }
    expect(c.atLine).toBe(true);
    const at = y;
    c.drag(0, px, at - px, 0.8, 16);
    for (let s = 0; s < sec - 1e-9; s += STEP) if (c.update(STEP, true) === 'slump') break;
    return c;
  }

  it('slumps only after a drag held 24 px past the contact for 0.6 s (23 px or 0.5 s do not)', () => {
    expect(overDrag(23, 2).second).toBe(false);
    expect(overDrag(24, 0.5).second).toBe(false);
    const c = overDrag(24, 0.62);
    expect(c.second).toBe(true);
    expect(c.slump).toBeGreaterThan(0);
    expect(c.H).toBeCloseTo(0.3 * kubek.N, 9);              // back to the lump at once
  });

  it('builds a strain the player can see coming, and it eases off when the finger comes back', () => {
    const c = overDrag(30, 0.3);
    expect(c.strain).toBeGreaterThan(0.4);
    c.drag(0, -20, 600, 0.8, 16);                            // back down near the line
    c.update(STEP, true);
    expect(c.strain).toBe(0);
    expect(c.second).toBe(false);
  });

  it('slumps after a key held at the line for 1.2 s, and gathers the lump again in 1.2 s', () => {
    const c = new Clay(kubek);
    c.keyHold = true;
    let slumped = -1, gathered = -1, t = 0;
    for (; t < 10; t += STEP) {
      const e = c.update(STEP, true);
      if (e === 'slump') slumped = t;
      if (e === 'gather') { gathered = t; break; }
      if (slumped < 0 && c.atLine) expect(c.strain).toBeLessThan(1);
    }
    expect(slumped).toBeGreaterThan(0);
    expect(gathered - slumped).toBeCloseTo(CLAY.slump, 1);
    expect(c.second).toBe(true);
    expect(c.beforeH).toBeGreaterThan(c.lim.H0);            // the view sags the wall from where it was
  });

  it('ignores input while the wall slumps', () => {
    const c = new Clay(kubek);
    c.startSlump();
    const H = c.H, r = c.r[8];
    expect(c.tap()).toBe('none');
    c.drag(20, 20, 300, 0.5, 16);
    expect(c.H).toBe(H);
    expect(c.r[8]).toBe(r);
  });

  it('widens on the finger\'s side under a Gaussian brush at the hand\'s height', () => {
    const c = new Clay(FORM.misa);
    c.H = 12;
    const before = Array.from(c.r);
    c.touch(0.8, 1);
    c.drag(10, 0, 400, 0.8, 10);
    expect(c.r[12] - before[12]).toBeGreaterThan(c.r[2] - before[2]);
    expect(c.r[12]).toBeGreaterThan(before[12]);
    c.drag(-30, 0, 400, 0.8, 10);
    expect(c.r[12]).toBeLessThan(before[12] + 0.01);
  });

  it('scores the exact target 1 and the lump pulled up against a bowl below 0.75', () => {
    for (const f of FORMS) {
      const c = new Clay(f, limits(f).Hmax);
      c.H = f.N;
      for (let k = 0; k < RINGS; k++) c.r[k] = f.N * f.q[k];
      expect(c.similarity(), f.id).toBeCloseTo(1, 9);
      expect(c.fitCount()).toBe(RINGS);
      c.intentional();                                       // every outline is a shape the clay may take
      expect(c.similarity(), f.id).toBeGreaterThan(0.985);
    }
    const bowl = new Clay(FORM.misa, limits(FORM.misa).Hmax);
    while (bowl.tap() === 'moved');
    expect(bowl.similarity()).toBeLessThan(0.75);
  });

  it('gives stars from the shape alone: ★★ from 0.75, ★★★ from 0.90 (0.70 and 0.85 for the first vessel)', () => {
    expect([starsFor(0.2), starsFor(0.749), starsFor(0.75), starsFor(0.899), starsFor(0.9)]).toEqual([1, 1, 2, 2, 3]);
    expect([starsFor(0.69, true), starsFor(0.7, true), starsFor(0.85, true)]).toEqual([1, 2, 3]);
    expect(nextStar(0.86)).toBeCloseTo(0.9, 9);              // within 5 points: the honest near miss
    expect(nextStar(0.84)).toBeNull();
    expect(nextStar(0.71)).toBeCloseTo(0.75, 9);
    expect(nextStar(0.95)).toBeNull();
  });

  it('keeps every random gesture session intentional, for every form (500 seeded sessions each)', () => {
    // the invariants are checked in plain code (millions of them) and the first broken one is reported
    const broken: string[] = [];
    const check = (ok: boolean, what: string) => { if (!ok && broken.length < 5) broken.push(what); };
    for (const f of FORMS) {
      const lim = limits(f);
      for (let s = 1; s <= 500; s++) {
        const rnd = mulberry32(s * 97 + f.N);
        const c = new Clay(f, lim.Hmin + rnd() * (lim.Hmax - lim.Hmin));
        let y = 500;
        const steps = 40 + Math.floor(rnd() * 40);
        for (let i = 0; i < steps; i++) {
          const u = rnd();
          if (u < 0.25) c.tap();
          else if (u < 0.75) {
            const dx = (rnd() - 0.5) * 120, dy = (rnd() - 0.4) * 80;
            y -= dy;
            c.touch(rnd(), rnd() < 0.5 ? -1 : 1);
            c.drag(dx, dy, y, 0.05 + rnd() * 0.95, 4 + rnd() * 20);
          } else if (u < 0.85) {
            c.keyHold = true;
            for (let k = 0; k < 30; k++) c.update(STEP, true);
            c.keyHold = false;
          } else if (u < 0.92) {
            c.release();
            y = 500;
          } else c.shape((rnd() - 0.5) * 30);
          if (rnd() < 0.05) c.line = Math.min(lim.Hmax, c.line + rnd() * 2);
          c.update(STEP, true);
          // after every step: finite, clamped, smooth, with a foot and a rim
          const at = `${f.id} #${s} step ${i}`;
          let body = 0, zig = 0;
          for (let k = 0; k < RINGS; k++) {
            check(Number.isFinite(c.r[k]), `${at}: r${k} not finite`);
            check(c.r[k] >= lim.rMin - 1e-9 && c.r[k] <= lim.rMax + 1e-9, `${at}: r${k} = ${c.r[k]} outside [rMin, rMax]`);
            if (k) body = Math.max(body, c.r[k]);
          }
          for (let k = 1; k < RINGS - 1; k++) {
            const d2 = Math.abs(c.r[k - 1] - 2 * c.r[k] + c.r[k + 1]);
            check(d2 <= CLAY.curve * c.H + 1e-6, `${at}: bend ${d2} at ring ${k} over ${CLAY.curve * c.H}`);
            zig += d2;
          }
          check(zig <= 3.2 * c.H, `${at}: zigzag ${zig}`);
          check(c.r[0] >= CLAY.footLo * body - 1e-6 && c.r[0] <= CLAY.footHi * body + 1e-6, `${at}: foot ${c.r[0]} of ${body}`);
          check(c.r[RINGS - 1] >= lim.rMin + CLAY.rim - 1e-9, `${at}: rim ${c.r[RINGS - 1]}`);
          check(c.H >= lim.H0 - 1e-9 && c.H <= Math.max(c.line, lim.H0) + 1e-9, `${at}: height ${c.H} vs line ${c.line}`);
          const sim = c.similarity();
          check(sim >= 0 && sim <= 1, `${at}: similarity ${sim}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('raises the wall at the cut toward a higher final line, keeping the share pulled and the shape', () => {
    const c = new Clay(FORM.donica);
    for (let i = 0; i < 6; i++) c.tap();
    const sim = c.similarity(), H = c.H, { H0 } = c.lim;
    const cut = c.line, fin = lineAt(FORM.donica, 0.8);
    const added = c.lastPull(cut, fin);
    expect(c.H).toBeCloseTo(H0 + (H - H0) * (fin - H0) / (cut - H0), 6);
    expect(added).toBeGreaterThan(0);
    expect(c.similarity()).toBeCloseTo(sim, 2);
    expect(c.lastPull(fin, cut)).toBe(0);                    // it never lowers a wall
    const lump = new Clay(FORM.donica);
    expect(lump.lastPull(cut, fin)).toBe(0);                 // nothing pulled, nothing to raise
  });
});

// ── the meta ────────────────────────────────────────────────────
describe('the street, the book, the gifts', () => {
  it('has twelve forms in two chapters, four story steps per household, every verse in the pool', () => {
    expect(FORMS).toHaveLength(12);
    expect(CHAPTERS.map(c => c.forms.length)).toEqual([6, 6]);
    expect(STORY.karczma).toEqual(['kubek', 'miednica', 'garnek', 'dzban']);
    expect(STORY.piekarnia).toEqual(['misa', 'sloj', 'dzbanuszek', 'lampka']);
    expect(STORY.mlodzi).toEqual(['dzbanek', 'miska', 'donica', 'zapis']);
    for (const f of FORMS) if (f.verse) expect(passage(f.verse).text.length).toBeGreaterThan(10);
    expect(FORMS.filter(f => f.verse).map(f => f.verse)).toEqual(['mat10.42', 'mat6.11', '1ki17.14', 'gen18.4', '1ki17.14', 'psa119.105', 'mic4.4', 'jer32.14']);
  });

  it('meets the households in street order and tells the story of the one with the fewest steps', () => {
    const p = freshProgress();
    expect(nextIntroduction(p)).toBe('karczma');
    p.introduced.push('karczma', 'piekarnia');
    expect(nextIntroduction(p)).toBe('mlodzi');
    p.introduced.push('mlodzi');
    expect(nextIntroduction(p)).toBeNull();
    p.steps = { karczma: 2, piekarnia: 1, mlodzi: 1 };
    expect(nextStoryHouse(p)).toBe('piekarnia');
    p.steps = { karczma: 4, piekarnia: 4, mlodzi: 4 };
    expect(nextStoryHouse(p)).toBeNull();
  });

  it('opens a page once, keeps its best vessel by stars, shape, then height, and every mark', () => {
    const p = freshProgress();
    expect(addToBook(p, rec('misa', 9, { stars: 2, sim: 80 }), MARK.centre)).toBe(true);
    expect(addToBook(p, rec('misa', 14, { stars: 1, sim: 70 }), MARK.calm)).toBe(false);
    expect(p.book.misa!.best.h).toBe(9);
    expect(tallestOf(p, 'misa')).toBe(14);
    expect(addToBook(p, rec('misa', 8, { stars: 3, sim: 91 }), MARK.moon)).toBe(false);
    expect(p.book.misa!.best.stars).toBe(3);
    expect(p.book.misa!.n).toBe(3);
    expect(p.book.misa!.marks).toBe(MARK.centre | MARK.calm | MARK.moon);
    expect(better(rec('kubek', 10, { sim: 81 }), rec('kubek', 12, { sim: 80 }))).toBe(true);
    expect(better(rec('kubek', 12), rec('kubek', 10))).toBe(true);
  });

  it('keeps the last three everyday deliveries by each door', () => {
    const p = freshProgress();
    for (const f of ['kubek', 'garnek', 'kubek', 'miednica'] as FormId[]) addToStreet(p, 'karczma', { f, glaze: 'biel' });
    expect(p.street.karczma.map(i => i.f)).toEqual(['garnek', 'kubek', 'miednica']);
  });

  it('falls back to honey, then tin white, while a glaze is locked, and offers up to three buckets', () => {
    const p = freshProgress();
    expect(orderGlaze(p, 'kobalt')).toBe('miod');
    expect(orderGlaze(p, 'biel')).toBe('biel');
    p.glazes = ['biel'];
    expect(orderGlaze(p, 'zelazo')).toBe('biel');
    p.glazes = [...GLAZES];
    expect(buckets(p, 'kobalt', 0)).toEqual(['kobalt', 'biel', 'miod']);
    expect(new Set(buckets(p, 'kobalt', 3)).size).toBe(3);
    expect(buckets(freshProgress(), 'biel', 1)).toEqual(['biel', 'miod']);
  });

  it('rolls kiln gifts at the published odds: 12 / 6 / 3 % and doubled by a calm fire (20 000 seeded rolls)', () => {
    for (const calm of [false, true]) {
      const rnd = mulberry32(calm ? 9 : 8), n = 20000, seen = { blush: 0, speckle: 0, moon: 0 };
      for (let i = 0; i < n; i++) {
        const g = giftFor(rnd(), calm);
        if (g) seen[g]++;
      }
      const k = calm ? 2 : 1;
      expect(Math.abs(seen.blush / n - 0.12 * k)).toBeLessThan(0.01);
      expect(Math.abs(seen.speckle / n - 0.06 * k)).toBeLessThan(0.01);
      expect(Math.abs(seen.moon / n - 0.03 * k)).toBeLessThan(0.01);
    }
  });

  it('never lets five vessels pass without a gift, nor thirty without moon white (pity)', () => {
    const p = freshProgress();
    const rnd = () => 0.99;                                   // the unluckiest roll every time
    const got: (string | null)[] = [];
    for (let i = 0; i < 60; i++) got.push(rollGift(p, false, rnd));
    for (let i = 0; i + 5 <= got.length; i++) expect(got.slice(i, i + 5).some(g => g !== null)).toBe(true);
    expect(got.slice(0, 30).includes('moon')).toBe(true);
    const q = freshProgress();
    expect(rollGift(q, false, () => 0.99, true)).toBe('blush');   // the first vessel's flame blush
    expect(q.sinceGift).toBe(0);
  });

  it('gives everyone the same form of the day, outline and glaze for a seed, different across days', () => {
    const a = dailyForm(12345), b = dailyForm(12345), c = dailyForm(54321);
    expect(a.f).toBe(b.f);
    expect(Array.from(a.q)).toEqual(Array.from(b.q));
    expect(a.glaze).toBe(b.glaze);
    const seen = new Set<string>();
    for (let s = 1; s < 40; s++) seen.add(dailyForm(s * 7919).f);
    expect(seen.size).toBeGreaterThan(5);
    expect(Array.from(c.q)).not.toEqual(Array.from(a.q));
    let body = 0;
    for (let k = 1; k < RINGS; k++) body = Math.max(body, a.q[k]);
    expect(a.q[0]).toBeGreaterThanOrEqual(CLAY.footLo * body - 1e-9);
  });

  it('gives the same gift at the gate to everyone who comes that day, all ten in ten days, a pigment unlocking its glaze', () => {
    expect(dayIndex('2026-01-01')).toBe(0);
    expect(daysBetween('2026-10-23', '2026-10-25')).toBe(2);
    const ten = new Set<string>();
    for (let d = 0; d < 10; d++) ten.add(dayGift(`2026-03-${String(10 + d).padStart(2, '0')}`));
    expect(ten.size).toBe(DAY_GIFTS.length);
    const p = freshProgress();
    const day = DAY_GIFTS.indexOf('kobalt');
    const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
    expect(receiveDayGift(p, date)).toBe('kobalt');
    expect(p.glazes).toContain('kobalt');
    expect(receiveDayGift(p, date)).toBeNull();               // once a day
  });

  it('welcomes back with porcelain after two days away, never sooner', () => {
    const p = freshProgress();
    expect(welcomeBack(p, DAY)).toBe(false);
    p.lastDay = '2026-10-24';
    expect(welcomeBack(p, DAY)).toBe(false);
    p.lastDay = '2026-10-23';
    expect(welcomeBack(p, DAY)).toBe(true);
  });
});

// ── the plan ────────────────────────────────────────────────────
describe('the day\'s plan', () => {
  const blocks = (plan: ReturnType<typeof planSession>) => plan.steps.filter(s => s.kind === 'throw' || s.kind === 'fire');

  it.each([[40, 1], [180, 3], [300, 5], [600, 10]])('plans %i s as %i vessels ending exactly at the planned time, no block under 12 s', (sec, n) => {
    for (const first of [true, false]) {
      const plan = planSession(sec, first, mulberry32(3));
      expect(plan.vessels).toBe(n);
      const total = plan.steps.reduce((s, x) => s + x.dur, 0) + plan.finale;
      expect(total).toBeCloseTo(sec, 6);
      for (const b of blocks(plan)) expect(b.dur).toBeGreaterThanOrEqual(12 - 1e-9);
    }
  });

  it('plays the compact cycle in 40 s: gate 3, throw 16, cut 2.5, firing 13, opening 2.5, sunset 3', () => {
    const plan = planSession(40, true, mulberry32(1));
    expect(plan.steps.map(s => [s.kind, s.dur])).toEqual([['gate', 3], ['throw', 16], ['cut', 2.5], ['fire', 13], ['open', 2.5]]);
    expect(plan.finale).toBe(3);
  });

  it('gives the first-ever vessel a 5 s gate in a normal session, taken from the blocks', () => {
    const a = planSession(180, true, mulberry32(2)), b = planSession(180, false, mulberry32(2));
    expect(a.steps[0].dur).toBe(5);
    expect(b.steps[0].dur).toBe(3.5);
    expect(blocks(a).reduce((s, x) => s + x.dur, 0)).toBeCloseTo(blocks(b).reduce((s, x) => s + x.dur, 0) - 1.5, 6);
  });

  it('gives a dropout\'s paused seconds back from later throws first; the last firing stays whole', () => {
    const sim = makeSim({ progress: returning(), planned: 300, seed: 4 });
    const lastFire = sim.plan.steps[sim.plan.steps.length - 2];
    const whole = lastFire.dur;
    const clock = { t: 0 };
    until(sim, 'throw', frame(), clock);
    // 8 s without a signal: the block clock stops while the session runs on
    drive(sim, 8, frame({ reliable: false, activity: null }), clock);
    const throws = sim.plan.steps.filter((s, i) => s.kind === 'throw' && i > sim.si);
    expect(throws.some(s => s.dur < 26)).toBe(true);
    expect(lastFire.dur).toBeCloseTo(whole, 6);
    until(sim, 'done', frame(), clock);
    expect(clock.t).toBeLessThan(300.5);
    expect(clock.t).toBeGreaterThan(296);
  });

  it('settles and plays the sunset when time is up mid-block', () => {
    const sim = makeSim({ progress: returning(), planned: 180, seed: 5 });
    const clock = { t: 0 };
    until(sim, 'throw', frame(), clock);
    // the clock is far ahead of the plan (a slow device): the session's time is up during this throw
    clock.t = 181;
    sim.tap();
    const ev = drive(sim, STEP, frame(), clock);
    expect(ofType(ev, 'cut')).toHaveLength(1);
    expect(ofType(ev, 'open')).toHaveLength(1);
    expect(sim.phase).toBe('finale');
    drive(sim, 4.2, frame(), clock);
    expect(sim.canStop()).toBe(true);
  });
});

// ── the brain ───────────────────────────────────────────────────
/** A returning player's sim, run to its first throw. */
function inThrow(o: SimOpts = {}): { sim: GlinaSim; clock: { t: number } } {
  const sim = makeSim({ planned: 300, ...o, progress: { ...returning(), ...o.progress } });
  const clock = { t: 0 };
  until(sim, 'throw', frame(), clock);
  sim.take();
  return { sim, clock };
}

describe('the chalk line (F)', () => {
  it('waits out the lag — 5 s on Mendi, 2 s on HALO — then climbs 0.125·(level − 0.35) per second', () => {
    for (const [eeg, lag] of [[false, 5], [true, 2]] as const) {
      const { sim, clock } = inThrow({ eeg });
      drive(sim, lag - 0.1, frame({ level: 0.9 }), clock);
      expect(sim.F, `lag ${lag}`).toBe(0);
      drive(sim, 4.1, frame({ level: 0.9 }), clock);
      expect(sim.F).toBeCloseTo(0.125 * 0.55 * 4, 1);
    }
  });

  it('only fills: a low level holds it, and it stops at 1', () => {
    const { sim, clock } = inThrow();
    drive(sim, 9, frame({ level: 0.9 }), clock);
    const F = sim.F;
    drive(sim, 4, frame({ level: 0.1 }), clock);
    expect(sim.F).toBeCloseTo(F, 9);
    sim.F = 0.995;
    drive(sim, 3, frame({ level: 1 }), clock);
    expect(sim.F).toBe(1);
  });

  it('freezes while the signal is unreliable, stopping the block clock at most 8 s', () => {
    const { sim, clock } = inThrow();
    drive(sim, 8, frame({ level: 0.9 }), clock);
    const F = sim.F, T = sim.T, b = sim.blockT;
    drive(sim, 5, frame({ reliable: false, activity: null, level: 0 }), clock);
    expect(sim.F).toBe(F);
    expect(sim.T).toBe(T);
    expect(sim.blockT).toBeCloseTo(b, 6);
    drive(sim, 5, frame({ reliable: false, activity: null, level: 0 }), clock);
    expect(sim.blockT - b).toBeCloseTo(2, 1);                // past 8 s of pause the block runs on
  });

  it('accrues nothing for 4 s after a dropout of 2 s or more, while the band climbs back', () => {
    const { sim, clock } = inThrow();
    drive(sim, 8, frame({ level: 0.9 }), clock);
    drive(sim, 2.5, frame({ reliable: false, activity: null }), clock);
    const F = sim.F;
    drive(sim, 3.9, frame({ level: 0.9 }), clock);
    expect(sim.F).toBe(F);
    drive(sim, 0.5, frame({ level: 0.9 }), clock);
    expect(sim.F).toBeGreaterThan(F);
  });

  it('raises the cap the wall may be pulled to, and the pad follows the line', () => {
    const { sim, clock } = inThrow();
    const clay = sim.clay!;
    expect(clay.line).toBeCloseTo(clay.lim.Hmin, 6);
    drive(sim, 14, frame({ level: 0.95 }), clock);
    expect(clay.line).toBeGreaterThan(clay.lim.Hmin + 1);
    expect(sim.padLevel(frame())).toBeCloseTo((sim.lineShown - clay.lim.Hmin) / (clay.lim.Hmax - clay.lim.Hmin), 6);
  });
});

describe('trueness (T): an even level, not a peak', () => {
  it('reaches Na środku within 12 s after the lag with a steady level, once per throw', () => {
    const { sim, clock } = inThrow();
    let at = -1;
    const ev = drive(sim, 17, frame({ level: 0.8 }), clock, () => { if (at < 0 && sim.T >= 0.5) at = sim.blockT; });
    expect(at).toBeGreaterThan(5);
    expect(at - 5).toBeLessThan(12);
    expect(ofType(ev, 'centre')).toHaveLength(1);
    expect(ofType(ev, 'true').map(e => e.step)).toEqual([1, 2]);
  });

  it('stays low for a level that swings, and at 0 for a flat low one', () => {
    // a level that wanders with sd 0.15: a Mayer-like 0.1 Hz swing and a quicker one
    const swing = (t: number) => frame({ level: clamp01(0.6 + 0.15 * Math.sin(2 * Math.PI * 0.1 * t) + 0.15 * Math.sin(2 * Math.PI * 0.16 * t + 1)) });
    const a = inThrow();
    drive(a.sim, 20, swing, a.clock);
    expect(a.sim.T).toBeLessThan(0.15);
    const b = inThrow();
    drive(b.sim, 20, frame({ level: 0.2 }), b.clock);
    expect(b.sim.T).toBe(0);
  });

  it('does not count a clean ramp as unsteadiness (the window is detrended)', () => {
    const { sim, clock } = inThrow();
    const t0 = clock.t;
    drive(sim, 20, t => frame({ level: 0.5 + 0.022 * (t - t0) }), clock);
    expect(sim.T).toBeGreaterThan(0.5);
  });

  it('only fills, and starts its window over after a dropout of 2 s', () => {
    const { sim, clock } = inThrow();
    drive(sim, 12, frame({ level: 0.8 }), clock);
    const T = sim.T;
    expect(T).toBeGreaterThan(0.1);
    drive(sim, 2.5, frame({ reliable: false, activity: null }), clock);
    drive(sim, 7.5, frame({ level: 0.8 }), clock);
    expect(sim.T).toBeCloseTo(T, 9);                         // 4 s of recovery, then 4 s to refill the window
    drive(sim, 1, frame({ level: 0.8 }), clock);
    expect(sim.T).toBeGreaterThan(T);
  });

  it('never shakes the clay: the profile is the same whatever the trueness', () => {
    const run = (level: number) => {
      const { sim, clock } = inThrow({ seed: 3 });
      drive(sim, 10, frame({ level }), clock, () => { if (Math.round(clock.t * 60) % 30 === 0) sim.tap(); });
      return Array.from(sim.clay!.r);
    };
    const steady = run(0.8), low = run(0.36);
    for (let k = 0; k < RINGS; k++) expect(low[k]).toBeCloseTo(steady[k], 9);
  });
});

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

describe('the wall grade: three band judges, once per throw', () => {
  const grade = (activity: number | ((t: number) => number), o: SimOpts = {}) => {
    const { sim, clock } = inThrow(o);
    const ev = until(sim, 'cut', t => frame({ activity: typeof activity === 'function' ? activity(t) : activity, threshold: 2, level: 0.6 }), clock);
    return ofType(ev, 'cut')[0].card;
  };

  it('grades by how far the level sits above the threshold: mocna, zgrabna, cienka, skorupka', () => {
    expect(grade(1).wall).toBe(0);
    expect(grade(2.3).wall).toBe(1);
    expect(grade(3).wall).toBe(2);
    expect(grade(4).wall).toBe(3);
    expect(grade(4).verdict).toBe(true);
    expect(grade(1).verdict).toBe(false);
  });

  it('does not count a short spike: three seconds high in a low throw stay mocna', () => {
    const { sim } = inThrow();
    const end = sim.phaseDur;
    const t0 = 0;
    const card = grade(t => (t - t0 > end - 4 && t - t0 < end - 1 ? 8 : 1));
    expect(card.wall).toBe(0);
  });

  it('gives the neutral zgrabna without a verdict when fewer than 8 reliable seconds were scored', () => {
    const { sim, clock } = inThrow();
    const ev = until(sim, 'cut', t => frame({ reliable: t % 10 < 1.2, activity: 9 }), clock);
    const card = ofType(ev, 'cut')[0].card;
    expect(card.verdict).toBeNull();
    expect(card.wall).toBe(1);
    expect(sim.F).toBeGreaterThanOrEqual(0.4);
    expect(card.centre).toBe(false);                         // floors never award a brain stamp (T 0.4 < 0.5)
  });

  it('judges with the session\'s tuning: a beginner\'s judges lean further toward the player', () => {
    const half = (t: number) => (t % 1 < 0.47 ? 3 : 1.5);   // 47 % of every second above the threshold
    expect(grade(half, { tuning: TUNING }).verdict).toBe(false);
    expect(grade(half, { tuning: BEGINNER }).verdict).toBe(true);
  });
});

describe('the firing: calm melts the ash into glaze', () => {
  const toFire = (o: SimOpts = {}) => {
    const { sim, clock } = inThrow(o);
    until(sim, 'fire', frame({ activity: 3 }), clock);
    sim.take();
    return { sim, clock };
  };

  it('runs G += 0.07·calm per second after the lag: krople, spływy, długie spływy, szklany płaszcz', () => {
    expect([0.32, 0.33, 0.65, 0.66, 0.89, 0.9].map(runBand)).toEqual([0, 1, 1, 2, 2, 3]);
    const { sim, clock } = toFire();
    drive(sim, 5 - STEP, frame({ calm: 0.8 }), clock);
    expect(sim.G).toBe(0);
    drive(sim, 5, frame({ calm: 0.8 }), clock);
    expect(sim.G).toBeCloseTo(0.07 * 0.8 * 5, 1);
  });

  it('earns Spokojny ogień from the rest judge, marking the page', () => {
    const { sim, clock } = toFire();
    const ev = until(sim, 'open', frame({ activity: -1, calm: 0.9 }), clock);
    const card = ofType(ev, 'open')[0].card;
    expect(card.calm).toBe(true);
    expect(sim.p.book[card.rec.f]!.marks & MARK.calm).toBeTruthy();
    const b = toFire({ seed: 2 });
    const ev2 = until(b.sim, 'open', frame({ activity: 6, calm: 0.1 }), b.clock);
    expect(ofType(ev2, 'open')[0].card.calm).toBe(false);
  });

  it('gives a firing without enough reliable signal the neutral runs (spływy) and no verdict', () => {
    const { sim, clock } = toFire();
    const ev = until(sim, 'open', frame({ reliable: false, activity: null, calm: 0 }), clock);
    const card = ofType(ev, 'open')[0].card;
    expect(card.band).toBe(1);
    expect(card.rec.runs).toBe(40);
    expect(card.calm).toBe(false);
  });

  it('turns the wheel out of view in the kiln: touch does nothing there', () => {
    const { sim, clock } = toFire();
    const H = sim.clay!.H;
    sim.tap();
    sim.drag(30, 30, 300, 0.5, 10);
    drive(sim, 1, frame(), clock);
    expect(sim.clay!.H).toBe(H);
  });
});

describe('blind blocks: Na wyczucie and the closed kiln', () => {
  const blindSim = (o: Partial<GlinaProgress> = {}) => makeSim({ progress: returning({ throwsBegun: 2, firingsBegun: 0, ...o }), planned: 300, seed: 6 });

  it('makes every 4th throw blind from the 3rd session, never the first vessel, the last or the form of the day', () => {
    const sim = blindSim();
    const clock = { t: 0 }, blind: boolean[] = [];
    let ev: SimEvent[] = [];
    while (sim.phase !== 'done' && clock.t < 400) {
      ev = drive(sim, 0.5, frame(), clock);
      for (const e of ofType(ev, 'throw')) blind.push(e.blind);
    }
    expect(blind).toEqual([false, true, false, false, false]);
    const early = makeSim({ progress: returning({ sessions: 1, throwsBegun: 2 }), planned: 300 });
    const c2 = { t: 0 }, b2: boolean[] = [];
    while (early.phase !== 'done' && c2.t < 400) for (const e of ofType(drive(early, 0.5, frame(), c2), 'throw')) b2.push(e.blind);
    expect(b2.every(b => !b)).toBe(true);                   // session 2: never blind yet
  });

  it('hides the line, the sheen and the pad in a blind throw, caps the wall at the dusk line, and reveals at the cut', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    while (!(sim.phase === 'throw' && sim.blind) && clock.t < 200) drive(sim, STEP, frame(), clock);
    const clay = sim.clay!;
    expect(sim.padLevel(frame())).toBeNull();
    expect(sim.shownT).toBe(0.5);
    for (let i = 0; i < 80; i++) sim.tap();
    expect(clay.H).toBeCloseTo(sim.duskLine, 6);
    const ev = until(sim, 'cut', frame({ level: 1, activity: 6 }), clock);
    expect(ofType(ev, 'centre')).toHaveLength(0);           // no Na środku moment while blind
    const card = ofType(ev, 'cut')[0].card;
    expect(card.blind).toBe(true);
    expect(card.raised).toBeGreaterThan(0);
    expect(clay.H).toBeGreaterThan(sim.duskLine);
    expect(card.centre).toBe(true);                          // the hidden trueness is revealed
  });

  it('never lowers the wall at the reveal, and the hidden line is at least the neutral one', () => {
    const sim = blindSim();
    const clock = { t: 0 };
    while (!(sim.phase === 'throw' && sim.blind) && clock.t < 200) drive(sim, STEP, frame(), clock);
    for (let i = 0; i < 80; i++) sim.tap();
    const H = sim.clay!.H;
    until(sim, 'cut', frame({ level: 0, activity: -3 }), clock);
    expect(sim.clay!.H).toBeGreaterThanOrEqual(H - 1e-9);
    expect(sim.F).toBeGreaterThanOrEqual(0.4);
  });

  it('closes every 4th firing from the 3rd session (never after a blind throw, never the last), its runs shown only at the opening', () => {
    const sim = makeSim({ progress: returning({ throwsBegun: 0, firingsBegun: 1 }), planned: 300, seed: 7 });
    const clock = { t: 0 }, closed: boolean[] = [];
    let opened: number | null = null;
    while (sim.phase !== 'done' && clock.t < 400) {
      const ev = drive(sim, STEP, frame({ calm: 0.9, activity: -1 }), clock);
      for (const e of ofType(ev, 'fire')) closed.push(e.closed);
      if (sim.phase === 'fire' && sim.closed) {
        expect(sim.shownG).toBe(0);
        expect(sim.padLevel(frame())).toBeNull();
      }
      for (const e of ofType(ev, 'open')) if (e.card.closed) opened = e.card.band;
    }
    expect(closed).toEqual([true, false, false, false, false]);
    expect(opened).toBeGreaterThanOrEqual(1);
  });
});

describe('the orders at the gate', () => {
  const orders = (sim: GlinaSim, clock = { t: 0 }) => {
    const out: { kind: string; form: FormId; house: HouseId | null; step: number }[] = [];
    while (sim.phase !== 'done' && clock.t < 700) {
      for (const e of ofType(drive(sim, 0.5, frame(), clock), 'gate')) out.push({ kind: e.order.kind, form: e.order.form.id, house: e.order.house, step: e.order.step });
    }
    return out;
  };

  it('meets the three households in the first 3-minute session, in street order', () => {
    const sim = makeSim({ planned: 180 });
    expect(orders(sim).map(o => [o.kind, o.form])).toEqual([['intro', 'kubek'], ['intro', 'misa'], ['intro', 'dzbanek']]);
    expect(sim.p.introduced).toEqual(['karczma', 'piekarnia', 'mlodzi']);
    expect(sim.p.steps).toEqual({ karczma: 1, piekarnia: 1, mlodzi: 1 });
    expect(Object.keys(sim.p.book).sort()).toEqual(['dzbanek', 'kubek', 'misa']);
  });

  it('brings one story step a day in the first slot, the form of the day in the first free slot from the second, Złota godzina last', () => {
    const sim = makeSim({ progress: returning({ storyDay: '2026-10-24', dailyDay: '2026-10-24', lastDay: '2026-10-24' }), planned: 300, seed: 9 });
    const os = orders(sim);
    expect(os[0]).toEqual({ kind: 'story', form: 'sloj', house: 'piekarnia', step: 2 });   // the fewest steps done
    expect(os[1].kind).toBe('daily');
    expect(os[1].house).toBeNull();
    expect(os.slice(2, 4).every(o => o.kind === 'everyday')).toBe(true);
    expect(os[4].kind).toBe('golden');
    expect(sim.p.storyDay).toBe(DAY);
    // the next session the same day: no story step, no form of the day
    sim.result();
    const again = makeSim({ progress: JSON.parse(JSON.stringify(sim.p)), planned: 300, seed: 10 });
    const os2 = orders(again);
    expect(os2.some(o => o.kind === 'story' || o.kind === 'daily')).toBe(false);
  });

  it('asks everyday orders only from open pages, never the same form twice in a row; Złota godzina from the easiest three', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const sim = makeSim({ progress: returning(), planned: 600, seed });
      const open = new Set(Object.keys(sim.p.book));
      const os = orders(sim);
      for (let i = 0; i < os.length; i++) {
        expect(open.has(os[i].form)).toBe(true);
        if (i) expect(os[i].form).not.toBe(os[i - 1].form);
      }
      expect(['kubek', 'miska', 'misa']).toContain(os[os.length - 1].form);
    }
  });

  it('gives the story\'s household its own lines, and an everyday order the form\'s household', () => {
    const sim = makeSim({ planned: 40 });
    expect(sim.order!.line).toBe(t('story.karczma.1'));
    expect(sim.order!.who).toBe(t('house.karczma'));
    expect(sim.order!.thanks).toBe(t('thanks.karczma.1'));
    const ret = makeSim({ progress: returning(), planned: 40, seed: 4 });
    const o = ret.order!;
    expect(o.kind).toBe('everyday');
    expect(o.house).toBe(FORM[o.form.id].house);
  });

  it('turns a household alive with its fourth step, with its sunset line and the blessing to close', () => {
    const p = returning({ steps: { karczma: 3, piekarnia: 3, mlodzi: 3 }, storyDay: '2026-10-24' });   // a tie: street order
    p.book!.garnek = { n: 1, best: rec('garnek', 14), tall: 14, marks: 0 };
    const sim = makeSim({ progress: p, planned: 40, seed: 2 });
    expect(sim.order!.form.id).toBe('dzban');
    const ev = until(sim, 'done', frame(), { t: 0 });
    expect(ofType(ev, 'alive').map(e => e.house)).toEqual(['karczma']);
    const out = sim.result();
    expect(out.highlights).toContain(t('alive.karczma'));
    expect(sim.closingVerse()).not.toBe('jer18.6');
  });
});

describe('a session\'s numbers', () => {
  it('counts the vessel on the wheel in the headline from its first pull, then its cut height', () => {
    const sim = makeSim({ planned: 40 });
    const clock = { t: 0 };
    until(sim, 'throw', frame(), clock);
    expect(sim.score).toBe(0);
    sim.tap();
    expect(sim.score).toBe(Math.round(0.36 * 11));
    until(sim, 'cut', frame(), clock);
    expect(sim.score).toBe(Math.round(sim.heights[0]));
  });

  it('result() is idempotent: records with Math.max, the session\'s counters only there', () => {
    const p = returning({ sessions: 4, throwsBegun: 10, firingsBegun: 10, bestSession: 5, tallest: 3 });
    const sim = makeSim({ progress: p, planned: 180, seed: 3 });
    until(sim, 'done', () => frame({ activity: 3, level: 0.8 }), { t: 0 }, 300);
    expect(sim.p.sessions).toBe(4);
    expect(sim.p.throwsBegun).toBe(10);
    const a = sim.result();
    const snap = JSON.stringify(sim.p);
    const b = sim.result();
    expect(b).toEqual(a);
    expect(JSON.stringify(sim.p)).toBe(snap);
    expect(sim.p.sessions).toBe(5);
    expect(sim.p.throwsBegun).toBe(13);
    expect(sim.p.bestSession).toBe(a.score);
    expect(a.record).toBe(true);
    expect(a.unit).toBe('cm');
  });

  it('counts a session only when it is saved: after an abandoned first attempt the next one is still the first', () => {
    const p = freshProgress();
    const first = new GlinaSim({ progress: p, rng: mulberry32(1), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: BEGINNER });
    first.start();
    drive(first, 2, frame());
    expect(p.sessions).toBe(0);
    const again = new GlinaSim({ progress: freshProgress(), rng: mulberry32(2), day: DAY, daySeed: 1, plannedSec: 40, eeg: false, tuning: BEGINNER });
    again.start();
    expect(again.session).toBe(1);
    expect(again.order!.first).toBe(true);
  });

  it('settles a session ended early: the vessel on the wheel is cut, fired with G ≥ 0.4, opened and delivered, once', () => {
    const sim = makeSim({ planned: 300 });
    const clock = { t: 0 };
    until(sim, 'throw', frame(), clock);
    for (let i = 0; i < 5; i++) sim.tap();
    sim.finish();
    const ev = sim.take();
    expect(ofType(ev, 'cut')).toHaveLength(1);
    expect(ofType(ev, 'open')).toHaveLength(1);
    expect(ofType(ev, 'open')[0].card.rec.runs).toBeGreaterThanOrEqual(40);
    expect(sim.phase).toBe('done');
    expect(sim.p.vessels).toBe(1);
    expect(sim.p.giftDay).toBe(DAY);                         // the day's gift, whatever the score
    sim.finish();
    expect(sim.take()).toHaveLength(0);
    expect(sim.canStop()).toBe(true);
  });

  it('gives the day\'s gift to every first session of the day, even with 0 cm', () => {
    const sim = makeSim({ progress: returning({ giftDay: '2026-10-24' }), planned: 40 });
    const ev = until(sim, 'done', frame(), { t: 0 });
    const fin = ofType(ev, 'finale')[0].card;
    expect(fin.gift).toBe(dayGift(DAY));
    expect(sim.result().highlights.join(' ')).toContain(t(`daygift.${dayGift(DAY)}` as never));
    const next = makeSim({ progress: JSON.parse(JSON.stringify(sim.p)), planned: 40 });
    expect(ofType(until(next, 'done', frame(), { t: 0 }), 'finale')[0].card.gift).toBeNull();
  });

  it('says "Na dziś wystarczy" from the day\'s third session', () => {
    const fin = (todayN: number) => {
      const sim = makeSim({ progress: returning({ todayN, lastDay: DAY }), planned: 40 });
      return ofType(until(sim, 'done', frame(), { t: 0 }), 'finale')[0].card.enough;
    };
    expect([fin(0), fin(1), fin(2)]).toEqual([false, false, true]);
  });

  it('welcomes a player back after two days away with a porcelain lump, once', () => {
    const sim = makeSim({ progress: returning({ lastDay: '2026-10-21' }), planned: 180 });
    expect(sim.order!.porcelain).toBe(true);
    sim.take();
    const ev = until(sim, 'done', frame(), { t: 0 });
    expect(ofType(ev, 'gate').every(e => !e.order.porcelain)).toBe(true);
    expect(sim.result().highlights).toContain(t('hl.porcelain'));
  });

  it('marks a Druga forma in the book and closes the session on Jeremiah 18:4 the first time ever', () => {
    const sim = makeSim({ progress: returning(), planned: 40, seed: 3 });
    const clock = { t: 0 };
    until(sim, 'throw', frame(), clock);
    sim.pressKey(true);
    drive(sim, 4, frame({ level: 0.3 }), clock);
    sim.pressKey(false);
    expect(sim.clay!.second).toBe(true);
    until(sim, 'done', frame(), clock);
    expect(sim.p.seconds).toBe(1);
    const out = sim.result();
    expect(out.verse).toBe('jer18.4');
    expect(out.highlights).toContain(t('hl.second'));
    const f = sim.made[0].f;
    expect(sim.p.book[f]!.marks & MARK.second).toBeTruthy();
  });

  it('cannot overpull the very first vessel, nor in the sponge\'s seconds', () => {
    const first = makeSim({ planned: 40 });
    const clock = { t: 0 };
    until(first, 'throw', frame(), clock);
    first.pressKey(true);
    until(first, 'cut', frame(), clock);
    expect(first.clay!.second).toBe(false);
    const sp = inThrow();
    while (!sp.sim.sponge) drive(sp.sim, STEP, frame(), sp.clock);
    sp.sim.pressKey(true);
    const H = sp.sim.clay!.H;
    drive(sp.sim, 2, frame(), sp.clock);
    expect(sp.sim.clay!.second).toBe(false);
    expect(sp.sim.clay!.H).toBe(H);                          // the sponge locks the input
  });
});

describe('verses only at resting points', () => {
  it('closes the first session with the treasure in clay jars, later ones in turn over what they fit, never the root', () => {
    const one = makeSim({ planned: 40 });
    until(one, 'done', frame(), { t: 0 });
    expect(one.result().verse).toBe('2co4.7');
    const seen = new Set<string>();
    for (let s = 2; s <= 12; s++) {
      const sim = makeSim({ progress: returning({ sessions: s - 1, seconds: 1 }), planned: 40, seed: s });
      until(sim, 'done', frame({ calm: 0.9, activity: -2 }), { t: 0 });
      const v = sim.result().verse!;
      expect(v).not.toBe('jer18.6');
      expect(v).not.toBe('isa64.8');
      seen.add(v);
    }
    expect([...seen].sort()).toEqual(['2co4.7', 'col3.23', 'psa37.7']);
    for (const id of ['jer18.4', 'num6.24-26', 'isa61.3', 'psa37.7', '2co4.7', 'col3.23'] as const) expect(passage(id).ref.length).toBeGreaterThan(3);
  });

  it('never exposes a verse during play: every phase of a session has none', () => {
    const sim = makeSim({ planned: 180 });
    const phases = new Set<string>();
    drive(sim, 190, frame(), { t: 0 }, () => {
      phases.add(sim.phase);
      expect(sim.verseNow).toBeNull();
    });
    expect([...phases].sort()).toEqual(['cut', 'done', 'finale', 'fire', 'gate', 'open', 'throw']);
  });
});

describe('padLevel: the pad never leaks feedback', () => {
  it('follows the line only in a visible throw with a reliable frame', () => {
    const sim = makeSim({ progress: returning(), planned: 300 });
    const clock = { t: 0 };
    expect(sim.padLevel(frame())).toBeNull();                // the gate
    until(sim, 'throw', frame(), clock);
    expect(sim.padLevel(frame())).not.toBeNull();
    expect(sim.padLevel(frame({ reliable: false }))).toBeNull();
    for (const ph of ['cut', 'fire', 'open'] as const) {
      until(sim, ph, frame(), clock);
      expect(sim.padLevel(frame()), ph).toBeNull();
    }
    until(sim, 'finale', frame(), clock);
    expect(sim.padLevel(frame())).toBeNull();
  });
});

// ── the smoke path ─────────────────────────────────────────────
/** The smoke test's input: a tap every 0.65 s, Space every ~1.95 s, and the simulator's focus switched on (or off). */
function smoke(o: { seed: number; eeg?: boolean; focus?: boolean; every?: number; progress?: Partial<GlinaProgress> }): { sim: GlinaSim; scoredAt: number } {
  const tune = BEGINNER;
  const sim = new GlinaSim({
    progress: { ...freshProgress(), ...o.progress }, rng: mulberry32(o.seed), day: DAY, daySeed: o.seed * 7 + 1, plannedSec: 40, eeg: !!o.eeg, tuning: tune,
  });
  sim.start();
  const focus = new FocusInput(tune), noise = mulberry32(o.seed + 5);
  let f = focus.push(0, true, 0.1), hub = 0, tap = (o.seed % 7) / 10, taps = 0, scoredAt = -1, up = false;
  for (let t = 0; t < 40 && sim.phase !== 'done'; t += STEP) {
    hub += STEP;
    if (hub >= 0.1) {
      hub -= 0.1;
      f = focus.push(o.focus === false ? (noise() - 0.5) * 2 : 20 * (1 - Math.exp(-t / 4)), true, 0.1);
    }
    sim.update(STEP, f, t);
    if (up) { sim.pressKey(false); up = false; }
    tap += STEP;
    if (tap >= (o.every ?? 0.65)) {
      tap -= o.every ?? 0.65;
      sim.tap();
      if (taps++ % 3 === 0) { sim.pressKey(true); up = true; }
    }
    sim.take();
    if (scoredAt < 0 && sim.score > 0) scoredAt = t;
  }
  return { sim, scoredAt };
}

describe('the smoke path', () => {
  it('scores within 22 s of a 40 s first session with the generic input, on Mendi and HALO, focus on or off', () => {
    for (const eeg of [false, true]) {
      for (const focus of [true, false]) {
        for (let seed = 1; seed <= 30; seed++) {
          const { sim, scoredAt } = smoke({ seed, eeg, focus });
          expect(scoredAt, `seed ${seed} eeg ${eeg} focus ${focus}`).toBeGreaterThan(0);
          expect(scoredAt).toBeLessThan(22);
          expect(sim.result().score).toBeGreaterThan(0);
        }
      }
    }
  });

  it('opens the vessel at the first tap after the gate, and with focus on lifts the line above its start by the cut', () => {
    const { sim } = smoke({ seed: 1 });
    expect(sim.heights).toHaveLength(1);
    expect(sim.heights[0]).toBeGreaterThan(FORM.kubek.N * 0.5 + 1);
    const off = smoke({ seed: 1, focus: false }).sim;
    expect(off.heights[0]).toBeLessThan(sim.heights[0]);
    expect(off.heights[0]).toBeGreaterThan(FORM.kubek.N * 0.45);
  });

  it('scores in later sessions too, with any tap rhythm', () => {
    for (const every of [0.65, 0.7, 0.9]) {
      for (let seed = 1; seed <= 20; seed++) expect(smoke({ seed, every, progress: returning() }).sim.result().score).toBeGreaterThan(0);
    }
  });
});

// ── the tuning harness ─────────────────────────────────────────
describe('the tuning harness (prints the distributions; asserts only their order and the chance bands, loosely)', () => {
  /** no control: Mayer waves, a slow drift and smoothed noise (Geoda's model); HALO's is faster and noisier */
  function chance(seed: number, eeg: boolean): (t: number) => number {
    const n = mulberry32(seed * 31 + 7), rnd = mulberry32(seed + 99);
    const gauss = () => Math.sqrt(-2 * Math.log(1 - n())) * Math.cos(2 * Math.PI * n());
    const ph = rnd() * 6.28, f = 0.08 + rnd() * 0.04, amp = 1 + rnd() * 1.5, slope = (rnd() - 0.5) * 0.02;
    let lp = 0;
    return t => {
      lp += (gauss() * (eeg ? 4 : 2.5) - lp) * (0.1 / (eeg ? 0.6 : 1.5));
      return 2 + amp * Math.sin(6.283 * f * t + ph) + slope * t + 0.8 * Math.sin(t / 47 + ph) + lp;
    };
  }

  function harness(control: boolean, eeg: boolean) {
    const grades = [0, 0, 0, 0], T: number[] = [], G: number[] = [];
    let calm = 0, fires = 0, throws = 0, centre = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const sim = makeSim({ progress: returning(), planned: 300, seed, eeg });
      const input = new FocusInput(TUNING), base = chance(seed, eeg);
      let x = 0, f = input.push(0, true, 0.1), hub = 0;
      for (let t = 0; t < 305 && sim.phase !== 'done'; t += STEP) {
        hub += STEP;
        if (hub >= 0.1) {
          hub -= 0.1;
          const want = sim.phase === 'throw' ? 7 : sim.phase === 'fire' ? -3 : x;
          x += (want - x) * (0.1 / (eeg ? 1.5 : 4));
          f = input.push(control ? base(t) * 0.5 + x : base(t), true, 0.1);
        }
        sim.update(STEP, f, t);
        for (const e of sim.take()) {
          if (e.type === 'cut') { throws++; grades[e.card.wall]++; T.push(sim.T); if (e.card.centre) centre++; }
          if (e.type === 'open') { fires++; if (e.card.calm) calm++; G.push(e.card.rec.runs / 100); }
        }
      }
    }
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    return { grades: grades.map(g => g / throws), T: mean(T), G: mean(G), calm: calm / fires, centre: centre / throws };
  }

  it('separates control from chance on both bands, with chance near the design\'s bands', () => {
    for (const eeg of [false, true]) {
      const c = harness(false, eeg), k = harness(true, eeg);
      console.info(`${eeg ? 'HALO ' : 'Mendi'} chance: walls ${c.grades.map(v => v.toFixed(2)).join('/')} T ${c.T.toFixed(2)} Na środku ${c.centre.toFixed(2)} G ${c.G.toFixed(2)} calm fire ${c.calm.toFixed(2)}`);
      console.info(`${eeg ? 'HALO ' : 'Mendi'} control: walls ${k.grades.map(v => v.toFixed(2)).join('/')} T ${k.T.toFixed(2)} Na środku ${k.centre.toFixed(2)} G ${k.G.toFixed(2)} calm fire ${k.calm.toFixed(2)}`);
      expect(k.T).toBeGreaterThan(c.T + 0.2);
      expect(k.G).toBeGreaterThan(c.G);
      expect(k.grades[3]).toBeGreaterThan(c.grades[3] + 0.5);
      expect(k.centre).toBeGreaterThan(c.centre + 0.4);
      // without control: mocna ≈ 1/3, zgrabna ≈ 1/3, cienka ≈ 1/5, skorupka ≈ 1/10; T ≈ 0.25–0.45; G ≈ spływy
      expect(c.grades[0]).toBeGreaterThan(0.15);
      expect(c.grades[0]).toBeLessThan(0.55);
      expect(c.grades[1]).toBeGreaterThan(0.15);
      expect(c.grades[2]).toBeGreaterThan(0.05);
      expect(c.grades[3]).toBeLessThan(0.3);
      expect(c.T).toBeGreaterThan(0.15);
      expect(c.T).toBeLessThan(0.6);
      expect(c.G).toBeGreaterThan(0.33);
      expect(c.G).toBeLessThan(0.8);
    }
  });
});

describe('the texts in four languages', () => {
  it('gives every text in pl, en, de and sv, with the same placeholders and the plural forms each language needs', () => {
    expect(catalogProblems(CATALOGS)).toEqual([]);
    for (const l of LANGS) expect(Object.keys(CATALOGS[l]).sort()).toEqual(Object.keys(CATALOGS.pl).sort());
  });

  it('has every form, house, glaze, gift and story key in all four languages', () => {
    const keys = Object.keys(CATALOGS.pl);
    for (const f of FORMS) for (const k of [`form.${f.id}`, `use.${f.id}`, `again.${f.id}`]) expect(keys).toContain(k);
    for (const h of HOUSES) {
      expect(keys).toContain(`house.${h}`);
      expect(keys).toContain(`alive.${h}`);
      for (let s = 1; s <= 4; s++) for (const k of [`story.${h}.${s}`, `thanks.${h}.${s}`]) expect(keys).toContain(k);
    }
    for (const g of GLAZES as readonly GlazeId[]) expect(keys).toContain(`glaze.${g}`);
    for (const g of DAY_GIFTS) expect(keys).toContain(`daygift.${g}`);
  });

  it('leaves no Polish behind: only names and numbers read the same as the Polish texts', () => {
    const same = (l: 'en' | 'de' | 'sv') => (Object.keys(CATALOGS.pl) as (keyof typeof CATALOGS.pl)[]).filter(k => JSON.stringify(CATALOGS[l][k]) === JSON.stringify(CATALOGS.pl[k]));
    const allowed = ['cm', 'unit', 'pct', 'panel.page', 'panel.steps', 'stat.contrast', 'glaze.seledyn', 'glaze.kobalt', 'cut.toTwo', 'cut.toThree',
      'hud.best'];
    for (const l of ['en', 'de', 'sv'] as const) for (const k of same(l)) expect(allowed, `${l}.${k}`).toContain(k);
  });

  it('writes names as they read inside a sentence and makes labels of them with cap(), with a no-break space before cm', () => {
    expect(FORM.dzban.name).toBe('dzban na wodę');
    expect(cap(FORM.dzban.name)).toBe('Dzban na wodę');
    expect(cmText(12.44)).toBe('12,4 cm');
    expect(cmText(12.44, true)).toBe('12 cm');
  });
});

describe('the palette', () => {
  it('mixes a colour that is itself a mix (a raw glaze toward its fired colour)', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('rgb(128,128,128)');
    const raw = mix('#2C4E9E', '#FBF7EE', 0.55);
    expect(mix(raw, '#2C4E9E', 1)).toBe('rgb(44,78,158)');
    expect(mix(raw, '#000000', 0.3)).not.toContain('NaN');
  });
});
