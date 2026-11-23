/**
 * The way of Z głowy do serca spread over a session of 3–30 minutes (DESIGN.md §18), pure and deterministic: a list
 * of steps — pushes that need held-focus units (rules.ts `focusRate`) and rests of whole breaths — from the brow to
 * the heart, the heart's field round the person, the five circles, the one sun, the four dimensions and back into the
 * heart.  Consecutive pushes form one push block (one lead-in); a rest ends it.
 *
 *   the budget   the session after the warm-up and the finale: `restShare` of it goes to the rests (whole breaths,
 *                at least one each, more for ring 4), the rest to the pushes minus their lead-ins; each push needs
 *                its weight's share of that time × the average player's yield (`avgYield`) × `margin`, so a player
 *                at the adaptive threshold walks the whole way just inside the time, a weak session ends part-way
 *                (and the next goes on from that ring), a strong one finishes early and lights more of the world
 *   3, 5 min     every ring kept but short: rings 1–3 share one push and one rest (a breath of blessing each); the
 *                sun, the four dimensions and the return ride ring 5's push; one closing rest (5 minutes since round 15)
 *   ≥ 9 minutes  the descent stops at the mouth (the heart word said once) and the throat (a breath); the sun's rest
 *   ≥ 15         ring 5's named arcs (those who suffer, the lonely, the sick, the dying, children being born)
 *   ≥ 18         each ring's push in two halves with one breath of the heart word between (pushes stay short)
 *
 * Long sessions deepen rather than stretch: more stops, more lamps per ring (`lampsFor`), the arcs, more breaths.
 *
 * The rest's rhythm (round 15, the lobby's Rytm, kit/rhythm.ts): `circles` — a blessing after every circle (1, the
 * design: the field and each ring blessed in turn) or after every 2 or 3, which then blesses them together (one line
 * of each, at least a breath each); with 2 or more the descent's stops, the sun's rest and the long sessions' halves
 * drop out too — fewer, longer stretches of focus.  `restBreaths` — every rest that many whole breaths (at least what
 * its lines need), the rests together never more than `restCap` of the session; null keeps the designed budget.
 */
import { breathRest, breathRestOf, type BreathPattern } from '../kit/breath';
import { RINGS, ringStage, stageRing, type ArcId, type PlaceId, type RestKind, type Ring, type StageId } from './content';
import { PLACE } from '../kit/figure';
import { RULES, finaleFor, lampsFor, warmFor } from './rules';

export interface PushStep {
  kind: 'push';
  stage: StageId;
  /** the share of the stage this step walks (0..1 → from..to) */
  from: number;
  to: number;
  /** held units it needs */
  need: number;
  /** a "more" round after the way: the people it kindles lights for */
  arc?: ArcId;
}

export interface RestStep {
  kind: 'rest';
  rest: RestKind;
  /** the rings whose blessing it prays (bless; amen in a short session carries ring 5's) */
  rings: (0 | Ring)[];
  /** whole breaths */
  cycles: number;
  /** a stop on the descent: where */
  place?: PlaceId;
  /** a "more" round's rest: the people it blesses */
  arc?: ArcId;
}

export type Step = PushStep | RestStep;

export interface PlanOpts {
  plannedSec: number;
  eeg: boolean;
  firstEver: boolean;
  /** ring 4 left out today */
  skip4: boolean;
  /** the ring the circles go on from (a resumed way); 1 from the start */
  startRing: Ring;
  pattern: BreathPattern;
  /** the least warm-up a first session needs (its opening card's reading time), seconds */
  warmSec?: number;
  /** a blessing after this many circles (the field, the rings): 1 by design, up to RULES.circlesMax */
  circles?: number;
  /** each rest this many whole breaths (the player's Rytm); null or absent: the designed budget (`restShare`) */
  restBreaths?: number | null;
}

export interface Plan {
  steps: Step[];
  /** the rings this way walks, in order */
  rings: Ring[];
  /** lamps per ring this session (index 1–5; ring 5's are the world's lights, its arcs counted apart) */
  lamps: number[];
  /** ring 5's named arcs (long sessions) */
  arcs: boolean;
  /** seconds of rest, push blocks, and the effective push seconds the needs were made from */
  restSec: number;
  pushBlocks: number;
  pushSec: number;
  /** the warm-up and the finale this plan left room for (a first session's warm-up with its opening card's reading) */
  warm: number;
  finale: number;
  /** the warm-up block itself (s): it waits longer while the opening card is up */
  warmBlock: number;
}

/** Where along the descent (brow → heart, by length) each place lies, 0..1. */
export const PLACE_AT: Readonly<Record<PlaceId, number>> = (() => {
  const ys = RULES.descentPlaces.map(p => PLACE[p][1]);
  const y0 = ys[0], y1 = ys[ys.length - 1];
  return Object.fromEntries(RULES.descentPlaces.map((p, i) => [p, (ys[i] - y0) / (y1 - y0)])) as Record<PlaceId, number>;
})();

interface Draft { step: Step; w: number }

/** The way for a session (see the module's comment). */
export function buildPlan(o: PlanOpts): Plan {
  const T = Math.max(10, o.plannedSec), R = RULES, W = R.weight, RW = R.restWeight;
  const N = Math.max(1, Math.min(R.circlesMax, Math.round(o.circles ?? 1)));
  const short = T < R.shortBelow;
  // with a blessing after 2 or more circles, no stops between: the stretches of focus are the player's
  const stops = T >= R.stopsFrom && N === 1;
  const arcs = T >= R.arcsFrom;
  const split = T >= R.splitFrom && N === 1;
  const rings = RINGS.filter(r => r >= o.startRing && !(o.skip4 && r === 4));
  const drafts: Draft[] = [];
  const push = (stage: StageId, w: number, from = 0, to = 1) => drafts.push({ step: { kind: 'push', stage, from, to, need: 0 }, w: w * (to - from) });
  const rest = (kind: RestKind, w: number, rings: (0 | Ring)[] = [], place?: PlaceId) =>
    drafts.push({ step: { kind: 'rest', rest: kind, rings, cycles: 1, ...(place ? { place } : {}) }, w });

  // the head → the heart
  if (stops) {
    const m = PLACE_AT.mouth, th = PLACE_AT.throat;
    push('descent', W.descent, 0, m);
    rest('stop', RW.stop, [], 'mouth');
    push('descent', W.descent, m, th);
    rest('stop', RW.stop, [], 'throat');
    push('descent', W.descent, th, 1);
  } else push('descent', W.descent);
  push('heart', W.heart);
  rest('grat', RW.grat);
  // the heart's field round the person: circle 0 (blessed with the circles after it when the rhythm groups them)
  push('field', W.field);
  if (N === 1 || short && !rings.some(r => r <= 3)) rest('bless', RW.bless, [0]);

  const ringW = (r: Ring) => (r === 4 ? W.ring4 : r === 5 ? (arcs ? W.ring5Long : W.ring5) : W.ring);
  const blessW = (r: 0 | Ring) => (r === 4 ? RW.bless4 : r === 5 ? RW.bless5 : RW.bless);
  if (short) {
    const near = rings.filter(r => r <= 3);
    for (const r of near) push(ringStage(r), ringW(r));
    // the field's blessing joins the near rings' when the rhythm groups the circles
    const blessed: (0 | Ring)[] = N > 1 ? [0, ...near] : near;
    if (near.length) rest('bless', RW.bless * near.length * 0.7 + (N > 1 ? RW.bless : 0), blessed);
    if (rings.includes(4)) {
      push('ring4', ringW(4));
      rest('bless', RW.bless4, [4]);
    }
    push('ring5', ringW(5));
    push('sun', W.sun);
    push('pervade', W.pervade);
    push('back', W.back);
    rest('amen', RW.amen + RW.bless5 * 0.6, [5]);
  } else if (N > 1) {
    // the circles in groups of N (the field first): each group's pushes, then one blessing of all of them
    const circles: (0 | Ring)[] = [0, ...rings];
    for (let i = 0; i < circles.length; i += N) {
      const group = circles.slice(i, i + N);
      for (const r of group) if (r !== 0) push(ringStage(r), ringW(r));
      rest('bless', group.reduce<number>((a, r) => a + blessW(r), 0), group);
    }
    push('sun', W.sun);
    push('pervade', W.pervade);
    push('back', W.back);
    rest('amen', RW.amen);
  } else {
    for (const r of rings) {
      if (split) {
        push(ringStage(r), ringW(r), 0, 0.5);
        rest('word', RW.word);
        push(ringStage(r), ringW(r), 0.5, 1);
      } else push(ringStage(r), ringW(r));
      rest('bless', blessW(r), [r]);
    }
    push('sun', W.sun);
    if (stops) rest('sun', RW.sun);
    push('pervade', W.pervade);
    push('back', W.back);
    rest('amen', RW.amen);
  }

  // the budget: what is left after the warm-up and the finale, part for the rests (whole breaths), part for the pushes
  const warm = o.firstEver ? Math.min(T * 0.3, Math.max(warmFor(T), o.warmSec ?? 0)) : 0;
  const finale = finaleFor(T);
  const avail = Math.max(20, T - warm - finale);
  const rests = drafts.filter(d => d.step.kind === 'rest');
  const restW = rests.reduce((s, d) => s + d.w, 0);
  const restTarget = avail * R.restShare;
  let restSec = 0;
  const mins: number[] = [];
  for (const d of rests) {
    const st = d.step as RestStep;
    // at least a breath for each ring a blessing prays (one line each), two for ring 4 outside the shortest sessions
    const min = st.rest === 'bless' ? Math.max(st.rings.length, st.rings.includes(4) && !short ? 2 : 1) : st.rest === 'amen' && short ? 2 : 1;
    mins.push(min);
    // the player's own count of breaths, or the designed budget's share
    const want = o.restBreaths ? Math.round(o.restBreaths) : breathRest(o.pattern, (restTarget * d.w) / Math.max(1e-9, restW), 0).cycles;
    st.cycles = Math.max(min, want);
    restSec += breathRestOf(o.pattern, st.cycles).sec;
  }
  // the player's count never leaves the pushes without room: the rests together at most restCap of the session —
  // the most breaths a rest that fit (each still at least what its lines need)
  const cap = avail * R.restCap;
  if (o.restBreaths && restSec > cap) {
    const cyc = breathRestOf(o.pattern, 1).sec;
    const total = (n: number) => mins.reduce((a, m) => a + Math.max(m, n), 0) * cyc;
    let n = Math.round(o.restBreaths);
    while (n > 1 && total(n) > cap) n--;
    restSec = 0;
    rests.forEach((d, i) => {
      const st = d.step as RestStep;
      st.cycles = Math.max(mins[i], n);
      restSec += breathRestOf(o.pattern, st.cycles).sec;
    });
  }
  // push blocks: maximal runs of consecutive pushes
  let pushBlocks = 0;
  drafts.forEach((d, i) => { if (d.step.kind === 'push' && (i === 0 || drafts[i - 1].step.kind !== 'push')) pushBlocks++; });
  const lead = o.eeg ? R.leadIn.eeg : R.leadIn.fnirs;
  const pushSec = Math.max(8 * pushBlocks, avail - restSec - pushBlocks * (lead + 1));
  const pushes = drafts.filter(d => d.step.kind === 'push');
  const pushW = pushes.reduce((s, d) => s + d.w, 0);
  const units = pushSec * R.avgYield * R.margin;
  for (const d of pushes) (d.step as PushStep).need = Math.max(0.6, (units * d.w) / pushW);

  const lamps = [0, 1, 2, 3, 4, 5].map(r => (r === 0 ? 0 : lampsFor(r, T)));
  return { steps: drafts.map(d => d.step), rings, lamps, arcs, restSec, pushBlocks, pushSec, warm, finale, warmBlock: o.firstEver ? warmFor(T) : 0 };
}

/** The held units a "more" round needs after the way (about a ring's share, a little less). */
export function moreNeed(plan: Plan): number {
  const ringPush = plan.steps.filter((s): s is PushStep => s.kind === 'push' && stageRing(s.stage) !== null);
  const avg = ringPush.length ? ringPush.reduce((a, s) => a + s.need / Math.max(0.05, s.to - s.from), 0) / ringPush.length : 6;
  return Math.max(2, avg * (RULES.weight.more / RULES.weight.ring));
}

/** Seconds the plan takes for a player whose pushes yield `yieldPerSec` held units a second past the lead-in. */
export function planSeconds(plan: Plan, pattern: BreathPattern, eeg: boolean, yieldPerSec: number): number {
  const lead = eeg ? RULES.leadIn.eeg : RULES.leadIn.fnirs;
  const cyc = breathRestOf(pattern, 1).sec;
  let s = plan.warm;
  plan.steps.forEach((st, i) => {
    if (st.kind === 'rest') s += st.cycles * cyc;
    else {
      if (i === 0 || plan.steps[i - 1].kind !== 'push') s += lead;
      s += st.need / Math.max(1e-6, yieldPerSec);
    }
  });
  return s;
}
