/**
 * The brain Synapsy is played on, seen from above with the front at the top (the frontal poles, where the
 * headband sits) and the back at the bottom (the occipital poles, vision).  The left hemisphere is on the
 * left: the player looks down on the head of someone facing up the screen.
 *
 * A hand-made template of 19 neurons per hemisphere keeps the anatomy honest in a cartoon way and every
 * lesson solvable: vision at the back (the left occipital lobe sees the right half of the view), hearing at
 * the temporal sides, the motor strips across the middle (the left hemisphere moves the right hand),
 * Broca's area for the voice in the left frontal lobe (speech is left-lateralised in ~96 % of strong
 * right-handers), the hippocampi deep and medial (memory), the prefrontal cortex in front, and the corpus
 * callosum along the midline with two lanes (front and back) — the only links between the halves.
 * Each player's brain is the template jittered a little by their own seed, the same every session, so the
 * links they consolidate keep their neurons.
 *
 * Pure geometry and graph search, no DOM: the sim routes thoughts and suggests the next pair with it.
 */
import { mulberry32 } from '../../core/random';
import { RULES, mmOf, speedOf } from './rules';

export type RegionId = 'plan' | 'move' | 'touch' | 'hear' | 'lang' | 'mem' | 'vision' | 'bridge';
export type IoKind = 'eye' | 'ear' | 'hand' | 'voice' | 'mem';
/** an IO node by its kind and hemisphere: 'eyeL' is the eye input of the left hemisphere (the right half of the view) */
export type NodeKey = `${IoKind}${'L' | 'R'}`;

export interface Neuron {
  id: number;
  x: number;
  y: number;
  /** −1 left hemisphere, +1 right */
  side: -1 | 1;
  region: RegionId;
  io: IoKind | null;
  /** a bridge end: the lane it belongs to (0 front, 1 back), else −1 */
  lane: number;
  /** stable decoration seed (dendrites) */
  seed: number;
}

export interface Brain {
  neurons: Neuron[];
  /** every pair that may be wired (same hemisphere, within reach, not two IO nodes), a < b */
  pairs: [number, number][];
  /** the corpus callosum's two lanes: [left end, right end] */
  bridges: [number, number][];
  /** IO nodes by key */
  io: Partial<Record<NodeKey, number>>;
  /** neighbours that may be wired, per neuron */
  near: number[][];
  /** the smallest distance between two neurons (units), for the view's pick radius */
  spacing: number;
}

type Slot = readonly [key: string, x: number, y: number, region: RegionId, io?: IoKind];

/** The left hemisphere (x < 0); the right one mirrors it, with the left-only language areas turned into prefrontal / visual cortex. */
const LEFT: readonly Slot[] = [
  ['pfa', -0.32, -0.84, 'plan'],
  ['pfb', -0.64, -0.78, 'plan'],
  ['pfc', -0.18, -0.58, 'plan'],
  ['pfd', -0.48, -0.56, 'plan'],
  ['lang', -0.80, -0.50, 'lang', 'voice'],
  ['mo1', -0.32, -0.32, 'move'],
  ['hand', -0.62, -0.28, 'move', 'hand'],
  ['brA', -0.12, -0.16, 'bridge'],
  ['so1', -0.44, -0.06, 'touch'],
  ['ins', -0.76, -0.04, 'hear'],
  ['mem', -0.28, 0.18, 'mem', 'mem'],
  ['au2', -0.56, 0.20, 'hear'],
  ['ear', -0.90, 0.22, 'hear', 'ear'],
  ['brB', -0.12, 0.42, 'bridge'],
  ['pa1', -0.40, 0.44, 'vision'],
  ['wer', -0.72, 0.46, 'lang'],
  ['vi2', -0.24, 0.68, 'vision'],
  ['vi3', -0.56, 0.70, 'vision'],
  ['eye', -0.40, 0.90, 'vision', 'eye'],
];

/** The right hemisphere's own reading of a slot (no language areas there: prefrontal and visual association cortex). */
function rightOf(s: Slot): Slot {
  if (s[0] === 'lang') return [s[0], -s[1], s[2], 'plan'];
  if (s[0] === 'wer') return [s[0], -s[1], s[2], 'vision'];
  return [s[0], -s[1], s[2], s[3], s[4]];
}

export const TEMPLATE_SIZE = LEFT.length * 2;

/** No two neurons closer than this (units): the jitter never crowds a finger's pick (the template keeps ≥ 0.24). */
export const MIN_GAP = 0.235;

/**
 * The brain's outline seen from above: one egg (a superellipse, a little narrower in front) split along the
 * midline by the longitudinal fissure, so each hemisphere is a D with its straight side to the middle.
 * `half` is the half-width at its widest, `ry` the half-length, `fissure` the gap's half-width (units).
 */
export const OUTLINE = { half: 0.99, ry: 0.98, exp: 2.6, front: 0.06, fissure: 0.035 } as const;
/** The hemisphere as an egg for the old callers: its centre and radii (units). */
export const HEMI = { cx: 0.52, rx: 0.47, ry: OUTLINE.ry } as const;

/** The outline's half-width at height y (0 past the poles). */
export function halfWidth(y: number): number {
  const k = Math.min(1, Math.abs(y) / OUTLINE.ry);
  const se = Math.max(0, 1 - k ** OUTLINE.exp) ** (1 / OUTLINE.exp);
  return OUTLINE.half * se * (1 - OUTLINE.front * Math.max(0, -y));
}

/** Whether a point lies inside a hemisphere (with a margin in units): between the fissure and the outline. */
export function insideHemi(x: number, y: number, margin = 0): boolean {
  if (Math.abs(y) > OUTLINE.ry - margin) return false;
  const ax = Math.abs(x);
  return ax >= OUTLINE.fissure + margin * 0.3 && ax <= halfWidth(y) - margin;
}

/** The player's brain: the template jittered by `seed` (the same seed gives the same brain). */
export function makeBrain(seed: number): Brain {
  const rnd = mulberry32((seed >>> 0) || 1);
  const neurons: Neuron[] = [];
  const io: Partial<Record<NodeKey, number>> = {};
  const lanes: Record<string, number>[] = [{}, {}];
  const place = (s: Slot, side: -1 | 1): void => {
    const [key, x0, y0, region, kind] = s;
    const j = RULES.jitter;
    let x = x0 + (rnd() * 2 - 1) * j, y = y0 + (rnd() * 2 - 1) * j;
    // the bridge ends stay on the midline's edge; nothing leaves its hemisphere or crowds a neighbour
    if (region === 'bridge') x = x0;
    if (!insideHemi(x, y, 0.04)) { x = x0; y = y0; }
    const id = neurons.length;
    neurons.push({ id, x, y, side, region, io: kind ?? null, lane: key === 'brA' ? 0 : key === 'brB' ? 1 : -1, seed: Math.floor(rnd() * 1e9) });
    if (kind) io[`${kind}${side < 0 ? 'L' : 'R'}` as NodeKey] = id;
    if (region === 'bridge') lanes[side < 0 ? 0 : 1][key] = id;
  };
  for (const s of LEFT) place(s, -1);
  for (const s of LEFT) place(rightOf(s), 1);
  // the jitter never crowds a finger's pick: neighbours closer than MIN_GAP step apart (the bridge ends keep their x)
  for (let pass = 0; pass < 4; pass++) {
    for (let a = 0; a < neurons.length; a++) {
      for (let b = a + 1; b < neurons.length; b++) {
        const A = neurons[a], B = neurons[b];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d >= MIN_GAP || d === 0) continue;
        const push = (MIN_GAP - d) / 2 + 0.001, ux = dx / d, uy = dy / d;
        if (A.region !== 'bridge') { A.x -= ux * push; } A.y -= uy * push;
        if (B.region !== 'bridge') { B.x += ux * push; } B.y += uy * push;
      }
    }
  }
  const bridges: [number, number][] = [[lanes[0].brA, lanes[1].brA], [lanes[0].brB, lanes[1].brB]];
  const pairs: [number, number][] = [];
  const near: number[][] = neurons.map(() => []);
  let spacing = Infinity;
  for (let a = 0; a < neurons.length; a++) {
    for (let b = a + 1; b < neurons.length; b++) {
      const A = neurons[a], B = neurons[b];
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      spacing = Math.min(spacing, d);
      if (A.side !== B.side || d > RULES.reach) continue;
      if (A.io && B.io) continue;   // a thought always passes at least one relay between an input and an output
      pairs.push([a, b]);
      near[a].push(b);
      near[b].push(a);
    }
  }
  return { neurons, pairs, bridges, io, near, spacing };
}

export const dist = (b: Brain, a: number, c: number): number => Math.hypot(b.neurons[a].x - b.neurons[c].x, b.neurons[a].y - b.neurons[c].y);

/** May these two be wired (a pair within reach on one side, or the two ends of a bridge lane)? */
export function canPair(b: Brain, a: number, c: number): boolean {
  if (a === c) return false;
  return b.near[a].includes(c);
}

/** The bridge lane joining these two, or −1. */
export function laneOf(b: Brain, a: number, c: number): number {
  return b.bridges.findIndex(([l, r]) => (l === a && r === c) || (l === c && r === a));
}

/** The link key of a pair (order-free). */
export const keyOf = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** What a router needs of a link: is it there, how long does a thought take on it (ms). */
export interface Edge { a: number; b: number; ms: number }

/** The conduction time (ms) of a link of this length (units) with this myelin: mm / (m/s) = ms. */
export const edgeMs = (units: number, myelin: number): number => mmOf(units) / speedOf(myelin);

/**
 * The fastest path from `from` to `to` over `edges` (Dijkstra by conduction time), as a list of neuron ids
 * (from first), or null when `to` cannot be reached.
 */
export function fastest(n: number, edges: readonly Edge[], from: number, to: number): number[] | null {
  if (from === to) return [from];
  const adj: { to: number; ms: number }[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    adj[e.a].push({ to: e.b, ms: e.ms });
    adj[e.b].push({ to: e.a, ms: e.ms });
  }
  const best = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  best[from] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && best[i] < Infinity && (u < 0 || best[i] < best[u])) u = i;
    if (u < 0) return null;
    if (u === to) break;
    done[u] = true;
    for (const { to: v, ms } of adj[u]) {
      if (best[u] + ms < best[v]) {
        best[v] = best[u] + ms;
        prev[v] = u;
      }
    }
  }
  const path: number[] = [];
  for (let v = to; v >= 0; v = prev[v]) path.unshift(v);
  return path[0] === from ? path : null;
}

/** Every neuron reachable from `from` over `edges`. */
export function reachable(n: number, edges: readonly Edge[], from: number): Set<number> {
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (const e of edges) {
    adj[e.a].push(e.b);
    adj[e.b].push(e.a);
  }
  const seen = new Set<number>([from]);
  const stack = [from];
  while (stack.length) {
    const u = stack.pop()!;
    for (const v of adj[u]) if (!seen.has(v)) { seen.add(v); stack.push(v); }
  }
  return seen;
}

/**
 * How many links each neuron is from `goal` if every allowed pair were wired (the bridges always are): the
 * suggestion's compass.  Unreachable neurons get Infinity.
 */
export function hopsTo(b: Brain, goal: number, blocked: (a: number, c: number) => boolean = () => false): number[] {
  const n = b.neurons.length;
  const hops = new Array<number>(n).fill(Infinity);
  hops[goal] = 0;
  const queue = [goal];
  while (queue.length) {
    const u = queue.shift()!;
    const next = [...b.near[u]];
    for (const [l, r] of b.bridges) {
      if (l === u) next.push(r);
      if (r === u) next.push(l);
    }
    for (const v of next) {
      if (hops[v] !== Infinity || blocked(u, v)) continue;
      hops[v] = hops[u] + 1;
      queue.push(v);
    }
  }
  return hops;
}
