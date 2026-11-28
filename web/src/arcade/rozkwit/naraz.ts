/**
 * „Wszystko naraz” — the vision's model (DESIGN.md §29): pure, no DOM; the world (world-naraz.ts) draws it and the
 * tests check it.
 *
 * One number carries the whole vision: V (0..1), how far this session's focus has gathered.  In play it is the larger
 * of two things, and neither ever falls:
 *
 *   the arc     the engine's WorldState.arc (§28.3): the session's focused growth over what the session can hold at
 *               the player's own pace — a player who keeps their pace reaches 1 at about 88 % of the session, at any
 *               length (a 3-minute session grows only two or three scenes, so the arc carries the short ones)
 *   the walk    this meditation's focused growth this session, over its four scenes — so walking „Wszystko naraz” to
 *               its end shows the whole vision, however long the session is (the growth is counted, not the scene it
 *               landed in: a blind push's growth reaches the scene current at the push's end)
 *
 * Outside play (the lobby's hero and tiles) there is no arc: the scene's own growth stands for it.
 *
 * Everything moves together with V — "naraz": the six parameters of the person (Nowe siły's Renewal: colour, skin,
 * the rested eyes, posture, hair, the quiet smile) from where each one starts to whole; the light in the heart; the
 * people around lighting one by one; the town's windows multiplying (the lit count grows as N^k — it doubles and
 * doubles again); the golden hour turning to dusk, when lights can be seen.
 */
import { PARAMS, type Renewal } from '../sily/renew';

/** the meditation's scenes, in order */
export const NARAZ = ['naraz', 'oblicze', 'profil', 'miasto'] as const;
export type NarazScene = (typeof NARAZ)[number];
export const isNaraz = (s: string): s is NarazScene => (NARAZ as readonly string[]).includes(s);

const clamp = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const phase = (v: number, a: number, b: number): number => clamp((v - a) / (b - a));
export const smooth = (x: number): number => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};

/** The vision: the session's arc or this meditation walked, whichever is further (outside play: the scene's growth). */
export function visionOf(st: { arc?: number; session?: Readonly<Record<string, number>>; g: number }): number {
  if (st.arc === undefined) return clamp(st.g);
  let walk = 0;
  for (const s of NARAZ) walk += Math.max(0, st.session?.[s] ?? 0);
  const v = Math.max(st.arc, walk / NARAZ.length);
  return Number.isFinite(v) ? clamp(v) : 0;
}

/**
 * Where each aspect stands at the start of a session: an ordinary person at the end of a day — a little slumped, a
 * little pale and tired about the eyes, the hair without its shine — never drawn as unwell (the skin starts nearer
 * renewed than Nowe siły's tired person, whose blemishes are its own story).
 */
export const START: Readonly<Renewal> = { kolor: 0.35, skora: 0.55, oczy: 0.35, postawa: 0.06, wlosy: 0.3, usmiech: 0.22 };

/** The person at V: every parameter on the same curve, from its start to whole — all at once. */
export function renewalAt(v: number): Renewal {
  const k = smooth(v);
  const out = { ...START };
  for (const p of PARAMS) out[p] = START[p] + (1 - START[p]) * k;
  return out;
}

/** the light in the heart: a small warm light from the start, growing with the vision */
export const heartAt = (v: number): number => 0.14 + 0.86 * smooth(v);

/** The people around (family, then friends): each lights over a tenth of the vision, one after another. */
export const PEOPLE_AT: readonly number[] = [0.28, 0.35, 0.42, 0.49, 0.56, 0.63, 0.7];
export const personLit = (v: number, i: number): number => smooth(phase(v, PEOPLE_AT[i] ?? 1, (PEOPLE_AT[i] ?? 1) + 0.1));

/** The town's lights: they begin when the people are lit and multiply until the whole town is lit a little before 1. */
export const CITY = { from: 0.52, to: 0.96 } as const;
/** How many of n windows are lit at V: n^k — one, two, four, … the whole town (0 before it begins). */
export function cityLit(v: number, n: number): number {
  const k = phase(v, CITY.from, CITY.to);
  if (k <= 0 || n <= 0) return 0;
  return Math.max(1, Math.min(n, Math.round(Math.pow(n, k))));
}

/** the golden hour turning to dusk (0 golden … 1 dusk, when lights are seen) */
export const duskAt = (v: number): number => smooth(phase(v, 0.1, 0.95));
/** lights rising from the lit town into the evening (joy passed on and on) */
export const risingAt = (v: number, max = 28): number => Math.round(max * phase(v, 0.62, 1));
