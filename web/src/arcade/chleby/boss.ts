/**
 * The four bosses of Chleby i ryby's arenas (v3; Mob Control's boss levels), without the DOM.  Every
 * boss is hungry, not wicked: it takes bread until its pouch is full, then leaves, sated and a little
 * sheepish — nothing is beaten and nothing is ever lost for good (what it takes is fed to it).
 *
 *   Pelikan     walks down the middle, swaying, and gulps every runner he touches
 *   Kozioł      Zenek the goat stands before the tables munching; he picks the column with the most
 *               bread, lowers his head (the telegraph: a dust line), and charges down it — every
 *               runner he meets rolls back down the hill (never lost); then he trots back up
 *   Czapla      Klara the heron stands in the brook and stabs a runner within reach every moment;
 *               ripples show where she steps next, then she wades there
 *   Kormorany   two cormorants circle over the lake, mark a spot (a shadow that darkens), dive and
 *               grab the runners in the splash, then sit drying their wings — the opening
 *
 * In a rest block a boss dozes (no charges, stabs or dives) but still munches what runs into it.  A
 * net or a cart distracts it for a few seconds.  The disciples' help feeds it too (field.ts).
 */
import type { Runner } from './field';
import type { BossKind } from './meta';
import { RULES } from './rules';

export interface Bird {
  x: number;
  y: number;
  state: 'air' | 'aim' | 'dive' | 'dry' | 'rise';
  t: number;
  /** where it dives, and how long this stretch lasts */
  tx: number;
  ty: number;
  dur: number;
  side: -1 | 1;
}

export interface Boss {
  kind: BossKind;
  x: number;
  y: number;
  pouch: number;
  full: number;
  state: 'come' | 'act' | 'sated' | 'gone';
  t: number;
  /** seconds since the last gulp (the view's bulge) */
  gulp: number;
  /** seconds it stays distracted (a net, a cart) */
  stun: number;
  /** the step of its pattern and its seconds: the goat's stand/aim/charge/back, the heron's stand/ripple/step */
  phase: 'stand' | 'aim' | 'charge' | 'back' | 'ripple' | 'step';
  pt: number;
  /** how long this step lasts, and where it aims or steps (lane x) */
  dur: number;
  tx: number;
  /** the heron's next stab may come after this (s); the side she faces */
  cool: number;
  dir: 1 | -1;
  /** the cormorants */
  birds: Bird[];
  /** asleep in a rest block (the view) */
  doze: boolean;
}

export type BossEvent =
  | { type: 'gulp'; n: number; x: number; y: number; kind: BossKind }
  | { type: 'sated'; x: number; y: number; kind: BossKind }
  | { type: 'butt'; n: number; x: number; y: number }
  | { type: 'aim'; x: number; y: number; kind: BossKind }
  | { type: 'dive'; n: number; x: number; y: number }
  | { type: 'stab'; x: number; y: number };

export interface BossCtx {
  runners: Runner[];
  rest: boolean;
  rnd: () => number;
  emit: (e: BossEvent) => void;
  /** the brook's middle (the heron stands in it) */
  brookY: number;
}

/** A boss's pouch on an arena: base + per chapter (a circle counts as six chapters), × its share. */
export function pouchOf(kind: BossKind, chapter: number, circle: number): number {
  const R = RULES;
  return Math.round((R.pelikanPouch + R.pelikanPerChapter * (chapter + circle * R.chapters)) * R.pouchShare[kind]);
}

export function makeBoss(kind: BossKind, pouch: number, brookY = 11.4): Boss {
  const R = RULES;
  const b: Boss = {
    kind, x: 5, y: R.laneH + 2, pouch, full: pouch, state: 'come', t: 0, gulp: 9, stun: 0, phase: 'stand', pt: 0, dur: 2,
    tx: 5, cool: 0.6, dir: 1, birds: [], doze: false,
  };
  if (kind === 'czapla') { b.x = R.columns[1]; b.y = brookY + 6; }
  if (kind === 'kormorany') {
    b.y = R.laneH + 2.5;
    b.birds = [-1, 1].map((side, i) => ({
      x: 5 + side * 3, y: R.laneH + 2.5, state: 'air', t: 0, tx: 5, ty: 12, dur: R.kormoranAir[0] + i * 1.3, side: side as -1 | 1,
    }));
  }
  return b;
}

/** Feed `n` to a boss (a runner's worth, the disciples, a camel): how much it took. */
export function feedBoss(b: Boss, n: number, emit: (e: BossEvent) => void, at?: { x: number; y: number }): number {
  if (b.state !== 'act' && b.state !== 'come') return 0;
  const k = Math.min(Math.max(0, n), b.pouch);
  if (k <= 0) return 0;
  b.pouch -= k;
  b.gulp = 0;
  emit({ type: 'gulp', n: k, x: at?.x ?? b.x, y: at?.y ?? b.y, kind: b.kind });
  if (b.pouch <= 0) {
    b.pouch = 0;
    b.state = 'sated';
    b.t = 0;
    emit({ type: 'sated', x: b.x, y: b.y, kind: b.kind });
  }
  return k;
}

/** A net or a cart: the boss stops acting for `sec` (a goat mid-charge stops where it is). */
export function stunBoss(b: Boss, sec: number): void {
  if (b.state !== 'act') return;
  b.stun = Math.max(b.stun, sec);
  if (b.kind === 'koziol' && (b.phase === 'charge' || b.phase === 'aim')) { b.phase = 'back'; b.pt = 0; }
}

/** Where a boss takes bread from (lane u): circles of the munch. */
export function munchSpots(b: Boss): { x: number; y: number; r: number }[] {
  const R = RULES;
  if (b.state !== 'act') return [];
  switch (b.kind) {
    case 'pelikan': return [{ x: b.x, y: b.y, r: R.pelikanR }];
    case 'koziol': return b.phase === 'charge' || b.phase === 'back' ? [] : [{ x: b.x, y: b.y, r: R.koziolR }];
    case 'czapla': return [];
    case 'kormorany': return b.birds.filter(w => w.state === 'dry').map(w => ({ x: w.x, y: w.y, r: 0.7 }));
  }
}

/** The column (lane x) with the most bread between y0 and y1. */
function busiest(runners: readonly Runner[], y0: number, y1: number, rnd: () => number): number {
  const C = RULES.columns, w = [0, 0, 0];
  for (const r of runners) {
    if (r.y < y0 || r.y > y1) continue;
    let best = 0;
    for (let i = 1; i < C.length; i++) if (Math.abs(r.x - C[i]) < Math.abs(r.x - C[best])) best = i;
    w[best] += r.w;
  }
  const top = Math.max(...w);
  if (top <= 0) return C[Math.floor(rnd() * C.length) % C.length];
  const tied = C.filter((_, i) => w[i] === top);
  return tied[Math.floor(rnd() * tied.length) % tied.length];
}

/** The densest spot of bread in a band of the lane (for a dive), or a random one. */
function densest(runners: readonly Runner[], y0: number, y1: number, rnd: () => number): { x: number; y: number } {
  let best: Runner | null = null, bestN = 0;
  for (const r of runners) {
    if (r.y < y0 || r.y > y1 || r.champ) continue;
    let n = 0;
    for (const q of runners) if (Math.abs(q.x - r.x) < 1.4 && Math.abs(q.y - r.y) < 1.4) n += q.w;
    if (n > bestN) { bestN = n; best = r; }
  }
  // aim a little ahead of them: they run up while the shadow darkens
  if (best) return { x: best.x, y: Math.min(y1, best.y + best.speed * 0.9) };
  return { x: 1.5 + rnd() * (RULES.laneW - 3), y: y0 + rnd() * (y1 - y0) };
}

/** One step of a boss: its walk, its pattern, what it takes. */
export function stepBoss(b: Boss, dt: number, c: BossCtx): void {
  const R = RULES;
  b.t += dt;
  b.gulp += dt;
  b.doze = c.rest && b.state === 'act';
  if (b.state === 'gone') return;
  if (b.state === 'sated') {
    // off it goes, sheepish
    if (b.kind === 'czapla' || b.kind === 'kormorany') {
      b.y += 4 * dt;
      b.x += (b.x < R.laneW / 2 ? -1 : 1) * 2 * dt;
      for (const w of b.birds) { w.y += 4.5 * dt; w.x += w.side * 2.5 * dt; }
    } else b.x += (b.x < R.laneW / 2 ? -1 : 1) * 2.2 * dt;
    if (b.t > 3) b.state = 'gone';
    return;
  }
  if (b.state === 'come') {
    arrive(b, dt, c);
    return;
  }
  b.stun = Math.max(0, b.stun - dt);
  // munching: whatever touches it (asleep too)
  for (const spot of munchSpots(b)) {
    for (const r of c.runners) {
      if (r.w <= 0 || b.state !== 'act') continue;
      const rr = r.champ ? R.bigR : R.runnerR;
      const dx = r.x - spot.x, dy = r.y - spot.y, d = rr + spot.r;
      if (dx * dx + dy * dy >= d * d) continue;
      r.w -= feedBoss(b, r.w, c.emit, spot);
    }
  }
  if (b.state !== 'act' || c.rest || b.stun > 0) return;
  b.pt += dt;
  switch (b.kind) {
    case 'pelikan': {
      if (b.y > R.pelikanStop) b.y = Math.max(R.pelikanStop, b.y - R.pelikanSpeed * dt);
      b.x = 5 + Math.sin(b.t * R.pelikanSway) * 2.4;
      break;
    }
    case 'koziol': goat(b, dt, c); break;
    case 'czapla': heron(b, dt, c); break;
    case 'kormorany': for (const w of b.birds) cormorant(b, w, dt, c); break;
  }
}

function arrive(b: Boss, dt: number, c: BossCtx): void {
  const R = RULES;
  switch (b.kind) {
    case 'pelikan':
      b.y -= 2.2 * dt;
      if (b.y <= R.bossY) { b.y = R.bossY; b.state = 'act'; b.t = 0; }
      break;
    case 'koziol':
      b.y -= 2 * dt;
      if (b.y <= R.koziolY) { b.y = R.koziolY; b.state = 'act'; b.t = 0; b.phase = 'stand'; b.pt = 0; b.dur = R.koziolStand[1]; }
      break;
    case 'czapla':
      b.y -= 4 * dt;
      if (b.y <= c.brookY) { b.y = c.brookY; b.state = 'act'; b.t = 0; b.phase = 'stand'; b.pt = 0; b.dur = R.czaplaStand; }
      break;
    case 'kormorany':
      b.state = 'act';
      b.t = 0;
      break;
  }
}

function goat(b: Boss, dt: number, c: BossCtx): void {
  const R = RULES;
  switch (b.phase) {
    case 'stand':
      // he wanders to the column he last faced, munching
      b.x += Math.sign(b.tx - b.x) * Math.min(Math.abs(b.tx - b.x), 3 * dt);
      if (b.pt >= b.dur) {
        b.phase = 'aim';
        b.pt = 0;
        b.tx = busiest(c.runners, R.koziolLow - 1, R.koziolY, c.rnd);
        c.emit({ type: 'aim', x: b.tx, y: b.y, kind: 'koziol' });
      }
      break;
    case 'aim':
      // trots to the column and lowers his head
      b.x += Math.sign(b.tx - b.x) * Math.min(Math.abs(b.tx - b.x), 9 * dt);
      if (b.pt >= R.koziolAim) { b.x = b.tx; b.phase = 'charge'; b.pt = 0; }
      break;
    case 'charge': {
      const y0 = b.y;
      b.y = Math.max(R.koziolLow, b.y - R.koziolCharge * dt);
      let n = 0;
      for (const r of c.runners) {
        if (r.w <= 0 || r.tumble > 0 || r.champ === 'wielblad') continue;
        if (Math.abs(r.x - b.x) > R.koziolR + 0.25 || r.y > y0 + 0.6 || r.y < b.y - R.koziolR) continue;
        r.y = Math.max(0.4, r.y - R.butt);
        r.tumble = 0.6;
        r.vx = (r.x < b.x ? -1 : 1) * (1.2 + c.rnd());
        n++;
      }
      if (n) c.emit({ type: 'butt', n, x: b.x, y: b.y });
      if (b.y <= R.koziolLow) { b.phase = 'back'; b.pt = 0; }
      break;
    }
    case 'back':
      b.y = Math.min(R.koziolY, b.y + R.koziolBack * dt);
      if (b.y >= R.koziolY) {
        b.phase = 'stand';
        b.pt = 0;
        b.dur = R.koziolStand[0] + c.rnd() * (R.koziolStand[1] - R.koziolStand[0]);
      }
      break;
    default:
      b.phase = 'stand';
  }
}

function heron(b: Boss, dt: number, c: BossCtx): void {
  const R = RULES;
  b.cool -= dt;
  if (b.phase === 'step') {
    b.x += Math.sign(b.tx - b.x) * Math.min(Math.abs(b.tx - b.x), 6 * dt);
    if (Math.abs(b.tx - b.x) < 0.01) { b.phase = 'stand'; b.pt = 0; b.dur = R.czaplaStand; }
    return;
  }
  // the stab: the nearest runner within reach of her beak, one at a time
  if (b.cool <= 0) {
    let best: Runner | null = null, bd = Infinity;
    for (const r of c.runners) {
      if (r.w <= 0) continue;
      const dx = r.x - b.x, dy = r.y - b.y, d = dx * dx + dy * dy;
      if (d < R.czaplaReach * R.czaplaReach && d < bd) { bd = d; best = r; }
    }
    if (best) {
      b.dir = best.x < b.x ? -1 : 1;
      b.cool = R.czaplaStab;
      c.emit({ type: 'stab', x: best.x, y: best.y });
      best.w -= feedBoss(b, best.w, c.emit, best);
      if (b.state !== 'act') return;
    }
  }
  if (b.phase === 'stand' && b.pt >= b.dur) {
    const C: readonly number[] = RULES.columns;
    const others = C.filter(x => Math.abs(x - b.x) > 0.5);
    const want = busiest(c.runners, c.brookY - 4, c.brookY + 1, c.rnd);
    b.tx = others.includes(want) ? want : others[Math.floor(c.rnd() * others.length) % others.length];
    b.phase = 'ripple';
    b.pt = 0;
    c.emit({ type: 'aim', x: b.tx, y: b.y, kind: 'czapla' });
  } else if (b.phase === 'ripple' && b.pt >= R.czaplaRipple) {
    b.phase = 'step';
    b.pt = 0;
  }
}

function cormorant(b: Boss, w: Bird, dt: number, c: BossCtx): void {
  const R = RULES;
  w.t += dt;
  switch (w.state) {
    case 'air':
      // circling over the lake behind the tables
      w.x = 5 + w.side * 3 + Math.sin(b.t * 1.3 + w.side) * 1.5;
      w.y = R.laneH + 2.5 + Math.cos(b.t * 1.1 + w.side) * 0.6;
      if (w.t >= w.dur) {
        const at = densest(c.runners, 8.5, R.laneH - 2.5, c.rnd);
        w.tx = Math.max(1, Math.min(R.laneW - 1, at.x));
        w.ty = at.y;
        w.state = 'aim';
        w.t = 0;
        c.emit({ type: 'aim', x: w.tx, y: w.ty, kind: 'kormorany' });
      }
      break;
    case 'aim':
      if (w.t >= R.kormoranAim) { w.state = 'dive'; w.t = 0; }
      break;
    case 'dive': {
      const k = Math.min(1, w.t / 0.25);
      w.x += (w.tx - w.x) * k;
      w.y += (w.ty - w.y) * k;
      if (w.t >= 0.25) {
        w.x = w.tx;
        w.y = w.ty;
        let n = 0;
        for (const r of c.runners) {
          if (r.w <= 0 || b.state !== 'act') continue;
          const dx = r.x - w.x, dy = r.y - w.y;
          if (dx * dx + dy * dy > R.diveR * R.diveR) continue;
          // one gulp event for the whole splash (below), so the per-runner ones are dropped
          const took = feedBoss(b, r.w, () => {}, r);
          r.w -= took;
          n += took;
        }
        c.emit({ type: 'dive', n, x: w.x, y: w.y });
        if (n > 0) c.emit({ type: 'gulp', n, x: w.x, y: w.y, kind: 'kormorany' });
        if (b.state === 'sated') c.emit({ type: 'sated', x: w.x, y: w.y, kind: 'kormorany' });
        w.state = 'dry';
        w.t = 0;
      }
      break;
    }
    case 'dry':
      if (w.t >= R.kormoranDry) { w.state = 'rise'; w.t = 0; }
      break;
    case 'rise':
      w.y += 8 * dt;
      if (w.y >= R.laneH + 2.5 || w.t > 1) {
        w.state = 'air';
        w.t = 0;
        w.dur = R.kormoranAir[0] + c.rnd() * (R.kormoranAir[1] - R.kormoranAir[0]);
      }
      break;
  }
  // the pair's centre is the boss's place (its pouch's number hangs there)
  const ys = b.birds.map(x => x.y);
  b.x = b.birds.reduce((s, x) => s + x.x, 0) / Math.max(1, b.birds.length);
  b.y = Math.min(...ys);
}
