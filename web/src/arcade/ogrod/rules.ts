/**
 * Every number of Ogród o świcie in one place, and the session's plan (DESIGN.md §23), pure and deterministic.
 *
 * One walk through the walled garden over the session's length T (3–30 minutes, or a test of a minute or less), on the
 * lead's frame (stations.ts `frameOf`, `stationsFor`):
 *
 *   arrive     the night garden after rain, the bench by the pond — whole breaths (~6 %, 20–60 s)
 *   stations   the chosen way, in order; each opens with one whole breath (the walk there, its name, the narrator)
 *              and then its acts: a push (focus does the act — the wave held in the light, the kind word written…)
 *              and a settle (a rest of whole breaths — the act settles: the tear gathered, the boat drifting…)
 *   dawn       the sunrise (the flowers open), the name called, the prayer, the close (0–10, the blessing, the verse)
 *
 * Every block has a planned start and end (`schedule`), so the walk always reaches the dawn and the session's end.
 * Time is spent in this order: the acts the player prepared (one per station at least), longer settles up to three
 * breaths, the acts a longer session repeats (a wave that comes back, the kind word written again, more roses…),
 * longer pushes up to 30 s, longer settles up to five breaths (the hands on the heart six), longer pushes up to 45 s,
 * and then a longer dawn (a way much too short for its length lets its settles grow to nine breaths first) — a player
 * who moved the rhythm dials keeps their push and their settle (the dawn takes what they leave, up to its growth; a
 * way much too short for the length lets their settles grow too, rather than a dawn of many minutes).
 * A session too short for the dials (or for a long breath) shortens the settles first, then the station's openings
 * (never under `openMin`), then the pushes (`restIn` tells the lobby the settle it keeps, for the player's own way).
 *
 * Only real focus does an act (§18.3–18.4): in a sighted push past its lead-in, with a reliable signal, while focused,
 * at `focusRate`.  The settles and the dawn are receptive and run in whole breaths.
 */
import { clamp } from '../kit/juice';
import { TIMING, frameOf, stationsFor, type StationId } from './stations';

export const RULES = {
  // ── the brain ──────────────────────────────────────────────────
  /** the lead-in of a push before the brain acts (s): Mendi / HALO */
  leadIn: { fnirs: 5, eeg: 2 },
  /** focus-seconds a second past the lead-in for the average player (the plan's yardstick) */
  avgYield: 0.75,
  /** the average player finishes an act in this share of its sighted time */
  fill: 0.88,
  /** the rate's shape: (lo + k × above) × (holdLo + holdK × min(1, hold / holdFull)) */
  focusLo: 0.7,
  focusK: 0.6,
  holdLo: 0.85,
  holdK: 0.3,
  holdFull: 12,
  /** the level the rate reads is averaged over one whole breath (s, §18.4) */
  meanSec: 10,
  /** what is shown follows the truth with this time constant (s) */
  showTau: 0.9,

  // ── the rhythm (kit/rhythm.ts): an act's push (s, lead-in included), a settle's whole breaths ──
  focus: { def: 20, min: 15, max: 45, step: 5 },
  rest: { def: 2, min: 1, max: 4 },
  /** by design (dials untouched) a session shorter than this settles in one breath: more acts fit */
  shortSec: 600,
  /** settles grow to this many breaths first, then (after the repeated acts) to `restMax` (`restMaxDlon` for the hands) */
  restMid: 3,
  restMax: 5,
  /** a way much too short for the session's length: settles up to this many breaths, then a longer dawn */
  restShort: 9,
  /** pushes grow to `pushMid` (s) before the settles pass `restMid`, and to `pushMax` after */
  pushMid: 30,
  pushMax: 45,
  /** a push never shorter than the lead-in plus this (s) */
  pushMinSighted: 6,
  /** a station's opening never shorter than this (s): the camera's walk there and its name card */
  openMin: 6,
  /** the dawn may grow to this share of its frame before the settles grow past their caps */
  dawnGrow: 1.6,

  // ── a test session (≤ TIMING.testSec: app:smoke plays 40 s and wants a flower) ──
  /** the station's opening, as a share of the station's time */
  testOpen: 0.08,
  /** the settle: at most one breath, at most this share of the station */
  testRest: 0.34,
  /**
   * the act asks this share of the average player's need (app:smoke plays 40 s with the simulator's focus on about
   * half the time and wants a flower — as Złote serce's `testPour`; a real session is never a test)
   */
  testNeed: 0.4,

  // ── the acts ───────────────────────────────────────────────────
  /** waves on the pond: each feeling once, and a longer session lets feelings come back, up to this many waves */
  wavesMax: 5,
  wavesExtra: 2,
  /** the kind word written again (each time the harsh one fades a step) */
  dlonMax: 3,
  /** the letter: fold, then sail */
  listMax: 2,
  /** the gate: close it, then the rose — and more roses in a longer session */
  furtkaMax: 4,
  /** the seeds: sow each, then tend the sprouts */
  tendMax: 2,
  /** flowers: one for an act done with focus, one more for each `abideSec` focus-seconds held after it, ≤ abideMax */
  abideSec: 5,
  abideMax: 2,
  /** a push with no progress this long (s) asks gently once */
  waitSec: 12,

  // ── the dawn ───────────────────────────────────────────────────
  /** shares of the dawn: the sunrise, the name, the prayer, the close */
  dawn: { sunrise: 0.34, call: 0.26, prayer: 0.16, close: 0.24 },
  /** a dawn shorter than `prayerFrom` (s) says the prayer in the close */
  dawnShort: { sunrise: 0.4, call: 0.3, prayer: 0, close: 0.3 },
  prayerFrom: 50,
  closeMin: 14,
  /** the sky's dawn (0..1) reached by the end of the last station; the sunrise takes it to 1 */
  skyStations: 0.62,
  /** the name's part: the narrator's line before the gardener's passage, at most this long (s) */
  callSay: 6.5,
  /** the close waits up to this long (s) past the session's end for the 0–10 answer */
  rateWait: 6,
  historyMax: 30,

  // ── the camera and the voice ────────────────────────────────────
  /** the camera's walk between two places (s) */
  walkSec: 2.4,
  telegraph: 4,
  bannerSec: 5,
  readSec: 2.5,
  readPerChar: 0.07,
  readMin: 4.5,
  talkGap: 3,
  hintGap: 1.2,
  /** a tap makes the words glow again for this long (s) */
  reshowSec: 2.4,
} as const;

/** How long a line of `text` stays on screen to be read twice (s). */
export const readTime = (text: string): number => Math.max(RULES.readMin, RULES.readSec + RULES.readPerChar * [...text].length);

export const leadOf = (eeg: boolean): number => (eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs);
const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

/**
 * How fast an act moves per second for a frame, in focus-seconds: only while focused, faster above the threshold (the
 * level averaged over a whole breath) and as a focused stretch is held.  (The sim calls it only in a sighted push past
 * its lead-in with a reliable signal.)
 */
export function focusRate(meanLevel: number, focused: boolean, hold: number): number {
  if (!focused) return 0;
  const R = RULES;
  const above = clamp((fin(meanLevel, 0.5) - 0.5) / 0.5);
  return (R.focusLo + R.focusK * above) * (R.holdLo + R.holdK * clamp(Math.max(0, fin(hold, 0)) / R.holdFull));
}

/** Focus-seconds an act of a push `push` s long asks of the average player. */
export const needFor = (push: number, lead: number): number => Math.max(0.5, RULES.avgYield * Math.max(1, push - lead) * RULES.fill);

/** What the preparation brings to the stations: how many words each has (prep.ts `PrepView`). */
export interface Counts { feelings: number; stones: number; lanterns: number; seeds: number }

/** A station's acts: the least (1), the player's own (`want`) and the most a long session may give (`max`). */
export function actsRange(s: StationId, c: Counts): { want: number; max: number } {
  const R = RULES;
  const n = (v: number) => Math.max(1, Math.floor(fin(v, 1)));
  switch (s) {
    case 'lzy': { const f = n(c.feelings); return { want: f, max: Math.max(f, Math.min(R.wavesMax, f + R.wavesExtra)) }; }
    case 'dlon': return { want: 1, max: R.dlonMax };
    case 'list': return { want: R.listMax, max: R.listMax };
    case 'furtka': return { want: 2, max: R.furtkaMax };
    case 'kamienie': { const k = n(c.stones); return { want: k, max: k }; }
    case 'latarnie': { const k = n(c.lanterns); return { want: k, max: k }; }
    case 'nasiona': { const k = n(c.seeds); return { want: k, max: k + R.tendMax }; }
  }
}

export interface ActPlan {
  /** the push (s, lead-in included) */
  push: number;
  /** the settle: whole breaths (a test: a share of one) and its seconds */
  breaths: number;
  rest: number;
}

export interface StationPlan {
  id: StationId;
  /** the station's opening: one whole breath (a test: a share) */
  open: number;
  acts: ActPlan[];
}

export type BlockKind = 'rest' | 'push' | 'free';
/** What a block is about. */
export type BlockWhat = 'arrive' | 'open' | 'act' | 'settle' | 'sunrise' | 'call' | 'prayer' | 'close';

/** One block of the session's schedule: planned start and end (s of play). */
export interface PlanBlock { kind: BlockKind; what: BlockWhat; t0: number; t1: number; station: number; act: number }

export interface PlanOpts {
  plannedSec: number;
  /** the breath's whole cycle (s) */
  cyc: number;
  eeg: boolean;
  /** the stations chosen (prep.way; null: the recommended way) and what the preparation brings */
  way?: readonly string[] | null;
  counts?: Partial<Counts>;
  /** the rhythm: a push's seconds and a settle's whole breaths (null: the design) */
  focus?: number | null;
  rest?: number | null;
  /** the player moved a dial (kit/rhythm.ts `custom`): their push and settle are kept */
  custom?: boolean;
}

export interface Plan {
  T: number;
  lead: number;
  cyc: number;
  test: boolean;
  arriveEnd: number;
  arriveBreaths: number;
  stations: StationPlan[];
  /** the dawn's parts: the sunrise, the name, the prayer end at these; the close ends at T */
  dawnStart: number;
  sunriseEnd: number;
  callEnd: number;
  prayerEnd: number;
  /** the dials the plan was built on (after a short session fitted them) */
  push: number;
  breaths: number;
  /** the way is short for the length: settles grew past their caps (the lobby may say so) */
  short: boolean;
  /** every block, in order */
  blocks: PlanBlock[];
}

/** A focus dial value in range (the design's when absent). */
export const dialFocus = (v: number | null | undefined): number => {
  const F = RULES.focus;
  return clamp(Math.round(fin(v ?? F.def, F.def) / F.step) * F.step, F.min, F.max);
};
export const dialRest = (v: number | null | undefined): number => {
  const R = RULES.rest;
  return clamp(Math.round(fin(v ?? R.def, R.def)), R.min, R.max);
};

const COUNTS0: Counts = { feelings: 1, stones: 1, lanterns: 2, seeds: 1 };

/** The session's plan (see the module's comment). */
export function planFor(o: PlanOpts): Plan {
  const R = RULES;
  const T = Math.max(10, fin(o.plannedSec, 300));
  const test = T <= TIMING.testSec;
  const cyc = Math.max(2, fin(o.cyc, 10));
  const lead = leadOf(o.eeg);
  const counts: Counts = { ...COUNTS0, ...(o.counts ?? {}) };
  const custom = !!o.custom;
  const way = stationsFor(T, o.way ?? null);
  const frame = frameOf(T);

  // the arrival in whole breaths (a test: its share)
  let arrive: number, arriveBreaths: number;
  if (test) {
    arrive = frame.arrive;
    arriveBreaths = Math.max(1, Math.ceil(arrive / cyc));
  } else {
    arriveBreaths = Math.max(1, Math.round(frame.arrive / cyc));
    arrive = arriveBreaths * cyc;
  }
  const S = Math.max(1, T - arrive - frame.dawn);

  let push = dialFocus(o.focus);
  let breaths = !custom && T < R.shortSec ? R.rest.min : dialRest(o.rest);
  let short = false;
  let stations: StationPlan[];

  if (test) {
    // one station, one act: a short opening, a settle of at most a breath, the rest a push (≥ the lead-in + a few s)
    const id = way[0];
    const open = S * R.testOpen;
    const rest = Math.min(cyc, S * R.testRest);
    const p = Math.max(lead + 1, S - open - rest);
    push = p;
    breaths = 1;
    stations = [{ id, open, acts: [{ push: p, breaths: 1, rest: Math.max(0, S - open - p) }] }];
  } else {
    let open = cyc;
    const ranges = way.map(s => actsRange(s, counts));
    const acts = way.map(() => 1);
    const rests: number[][] = way.map(() => [breaths]);
    const pushes: number[][] = way.map(() => [push]);
    const used = (): number => {
      let u = 0;
      way.forEach((_, i) => { u += open; for (let a = 0; a < acts[i]; a++) u += pushes[i][a] + rests[i][a] * cyc; });
      return u;
    };
    // too short for the dials (a long custom push or settle) or for a long breath (4 · 7 · 8 at 3 minutes): settles
    // down to one breath, then the openings down to the walk there, then pushes down — so the dawn keeps its frame
    while (used() > S + 1e-6 && rests.some(r => r.some(b => b > 1))) for (const r of rests) for (let a = 0; a < r.length; a++) if (r[a] > 1) r[a]--;
    if (used() > S + 1e-6) {
      const acted = way.reduce((u, _, i) => u + pushes[i][0] + rests[i][0] * cyc, 0);
      open = clamp((S - acted) / way.length, Math.min(cyc, R.openMin), cyc);
    }
    if (used() > S + 1e-6) {
      const fixed = way.reduce((u, _, i) => u + open + rests[i][0] * cyc, 0);
      const p = Math.max(lead + R.pushMinSighted, (S - fixed) / way.length);
      pushes.forEach(ps => ps.fill(p));
    }
    breaths = Math.min(breaths, ...rests.map(r => r[0]));
    push = Math.min(push, ...pushes.map(ps => ps[0]));
    let left = S - used();
    const cost = push + breaths * cyc;
    // 1. the acts the player prepared, round the way
    const addActs = (cap: (i: number) => number): void => {
      for (let grew = true; grew;) {
        grew = false;
        for (let i = 0; i < way.length; i++) {
          if (acts[i] < cap(i) && cost <= left + 1e-6) {
            acts[i]++;
            rests[i].push(breaths);
            pushes[i].push(push);
            left -= cost;
            grew = true;
          }
        }
      }
    };
    // settles one breath longer, round the way and its acts, up to `cap` breaths
    const growRests = (cap: (i: number) => number): void => {
      for (let grew = true; grew;) {
        grew = false;
        for (let i = 0; i < way.length; i++) {
          for (let a = 0; a < acts[i]; a++) {
            if (rests[i][a] < cap(i) && cyc <= left + 1e-6) {
              rests[i][a]++;
              left -= cyc;
              grew = true;
            }
          }
        }
      }
    };
    const nActs = (): number => acts.reduce((x, y) => x + y, 0);
    // longer pushes, all alike, up to `cap` s
    const growPushes = (cap: number): void => {
      const n = nActs();
      const now = Math.min(...pushes.flat());
      const grow = Math.min(left / n, Math.max(0, cap - now));
      if (grow <= 1e-9) return;
      pushes.forEach(ps => { for (let a = 0; a < ps.length; a++) ps[a] += grow; });
      left -= grow * n;
    };
    const restCap = (i: number, k: number): number => Math.max(breaths, way[i] === 'dlon' ? k + 1 : k);
    addActs(i => ranges[i].want);
    if (!custom) growRests(() => Math.max(breaths, R.restMid));
    addActs(i => ranges[i].max);
    if (!custom) {
      growPushes(R.pushMid);
      growRests(i => restCap(i, R.restMax));
      growPushes(R.pushMax);
    }
    // a longer dawn takes what is left; a way much too short for the length lets its settles grow first, then the
    // dawn takes the rest (the sunrise in the garden) — the lobby may say the way is short (`short`)
    if (left > frame.dawn * (R.dawnGrow - 1) + 1e-6) {
      short = true;
      const keep = frame.dawn * (R.dawnGrow - 1);
      left -= keep;
      growRests(i => restCap(i, R.restShort));
      left += keep;
    }
    // (what is left runs past the last station: the schedule gives it to the dawn)
    stations = way.map((id, i) => ({
      id, open, acts: Array.from({ length: acts[i] }, (_, a) => ({ push: pushes[i][a], breaths: rests[i][a], rest: rests[i][a] * cyc })),
    }));
  }

  // the schedule
  const blocks: PlanBlock[] = [];
  let t = 0;
  const add = (kind: BlockKind, what: BlockWhat, dur: number, station = -1, act = -1): void => {
    blocks.push({ kind, what, t0: t, t1: t + Math.max(0, dur), station, act });
    t += Math.max(0, dur);
  };
  add('rest', 'arrive', arrive);
  stations.forEach((st, i) => {
    add('rest', 'open', st.open, i, -1);
    st.acts.forEach((a, k) => {
      add('push', 'act', a.push, i, k);
      if (a.rest > 0) add('rest', 'settle', a.rest, i, k);
    });
  });
  const dawnStart = t;
  const D = Math.max(1, T - dawnStart);
  // a short dawn (under `prayerFrom` s) says the prayer in the close; a longer one gives it a rest of its own
  const sh = D >= R.prayerFrom || test ? R.dawn : R.dawnShort;
  const close0 = test ? D * sh.close : Math.min(D * 0.5, Math.max(R.closeMin, D * sh.close));
  const restD = Math.max(0, D - close0);
  const sum = sh.sunrise + sh.call + sh.prayer;
  // the receptive parts in whole breaths where a part is near a breath or longer (a test: shares)
  const whole = (x: number): number => (test || x < 0.75 * cyc ? x : Math.max(1, Math.round(x / cyc)) * cyc);
  let sunrise = whole((restD * sh.sunrise) / sum);
  let call = whole((restD * sh.call) / sum);
  let prayer = sh.prayer > 0 ? whole((restD * sh.prayer) / sum) : 0;
  // the rounding never eats the close
  const closeLeast = test ? D * sh.close * 0.8 : Math.min(R.closeMin, D * 0.4);
  while (D - (sunrise + call + prayer) < closeLeast - 1e-6 && sunrise + call + prayer > 0) {
    const over = closeLeast - (D - (sunrise + call + prayer));
    if (sunrise >= call && sunrise >= prayer) sunrise = Math.max(0, sunrise - Math.max(over, sunrise > cyc ? cyc : over));
    else if (call >= prayer) call = Math.max(0, call - Math.max(over, call > cyc ? cyc : over));
    else prayer = Math.max(0, prayer - Math.max(over, prayer > cyc ? cyc : over));
  }
  add('rest', 'sunrise', sunrise);
  add('rest', 'call', call);
  add('rest', 'prayer', prayer);
  const sunriseEnd = dawnStart + sunrise, callEnd = sunriseEnd + call, prayerEnd = callEnd + prayer;
  add('free', 'close', T - prayerEnd);
  return {
    T, lead, cyc, test, arriveEnd: arrive, arriveBreaths, stations, dawnStart, sunriseEnd, callEnd, prayerEnd,
    push, breaths, short, blocks,
  };
}

/**
 * The settle a session of `sec` really keeps for the player's dials (whole breaths): the lobby's `restIn` — on the
 * player's own way and words when given (a chosen way of more stations has less room for long settles).
 */
export function restInFor(
  focus: number, rest: number, sec: number, cyc: number, way: readonly string[] | null = null, counts?: Partial<Counts>,
): number {
  const p = planFor({ plannedSec: sec, cyc, eeg: false, focus, rest, custom: true, way, counts });
  return p.breaths;
}
