/**
 * A breath pattern for the meditations' rest (DESIGN.md §16.1): four phases, each 0–15 whole seconds — breathe
 * in, hold the breath, breathe out, stay empty — and a rest that lasts a whole number of breaths.
 *
 * The founder (2026-11-17): *"Faza odpoczynku powinna być wielokrotnością sekcji oddechowej (teraz 10 sekund =
 * 4 wdech, 6 wydech). Chcę żeby oddech można było konfigurować od 0 do 15 sekund wdech, wstrzymanie powietrza,
 * wydech, wstrzymanie bezdechu."*  So a pattern is four numbers, a phase of 0 s is skipped, and a rest block is
 * `cycles × cycle` seconds long, beginning with an in-breath (or the first phase that has any length).
 *
 * Pure: no DOM, no clock, no words (each game names the phases in its own catalog).  A pattern whose whole cycle
 * is under `BREATH_MIN_CYCLE` (e.g. all zeros) cannot guide anything, so `cleanBreath` returns the default for it.
 */

export type BreathPhase = 'in' | 'holdIn' | 'out' | 'holdOut';

/** The four phases in the order a breath walks them. */
export const BREATH_PHASES: readonly BreathPhase[] = ['in', 'holdIn', 'out', 'holdOut'];

export type BreathPattern = Readonly<Record<BreathPhase, number>>;

/** In for 4, out for 6: six breaths a minute, the games' guide since round 4. */
export const BREATH_DEFAULT: BreathPattern = { in: 4, holdIn: 0, out: 6, holdOut: 0 };

/** Each phase 0…15 whole seconds. */
export const BREATH_MAX = 15;
/** A whole cycle shorter than this guides nothing (the default stands in). */
export const BREATH_MIN_CYCLE = 2;

/** A few well-known patterns to start from (each game names them in its own words). */
export const BREATH_PRESETS: Readonly<Record<'calm' | 'even' | 'box' | 'relax', BreathPattern>> = {
  /** in 4, out 6 — the default, a long out-breath settles */
  calm: BREATH_DEFAULT,
  /** in 5, out 5 — six breaths a minute, even */
  even: { in: 5, holdIn: 0, out: 5, holdOut: 0 },
  /** 4 · 4 · 4 · 4 — the "box" */
  box: { in: 4, holdIn: 4, out: 4, holdOut: 4 },
  /** 4 · 7 · 8 — a long hold and a longer out-breath */
  relax: { in: 4, holdIn: 7, out: 8, holdOut: 0 },
};

const sec = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(0, Math.min(BREATH_MAX, Math.round(n))) : 0;
};

/** The whole cycle (s). */
export const breathCycle = (p: BreathPattern): number => p.in + p.holdIn + p.out + p.holdOut;

/**
 * A pattern from anything saved (an old progress, a hand-edited value): each phase rounded into 0…15 s; a cycle
 * under `BREATH_MIN_CYCLE` (or not an object at all) gives the default.
 */
export function cleanBreath(v: unknown): BreathPattern {
  if (!v || typeof v !== 'object') return BREATH_DEFAULT;
  const o = v as Record<string, unknown>;
  const p: BreathPattern = { in: sec(o.in), holdIn: sec(o.holdIn), out: sec(o.out), holdOut: sec(o.holdOut) };
  return breathCycle(p) < BREATH_MIN_CYCLE ? BREATH_DEFAULT : p;
}

/** One phase moved by `delta` seconds, kept inside 0…15 (the cycle may fall under the minimum: `breathOk` says so). */
export function stepBreath(p: BreathPattern, phase: BreathPhase, delta: number): BreathPattern {
  return { ...p, [phase]: sec(p[phase] + delta) };
}

/** Whether the pattern can guide a breath (its cycle at least `BREATH_MIN_CYCLE`). */
export const breathOk = (p: BreathPattern): boolean => breathCycle(p) >= BREATH_MIN_CYCLE;

export const sameBreath = (a: BreathPattern, b: BreathPattern): boolean =>
  BREATH_PHASES.every(k => a[k] === b[k]);

/** "4 · 0 · 6 · 0" — the pattern in numbers, in the phases' order. */
export const breathDigits = (p: BreathPattern): string => BREATH_PHASES.map(k => p[k]).join(' · ');

export interface BreathState {
  /** the phase now (a phase of 0 s never shows) */
  phase: BreathPhase;
  /** how far through it, 0…1 */
  p: number;
  /** seconds left in it */
  left: number;
  /** the lungs' fullness 0…1: rising in, full while held in, falling out, empty while held out (eased) */
  k: number;
  /** whole cycles completed since t = 0 */
  n: number;
}

const ease = (x: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));

/** Where the breath is `t` seconds after its first phase began (t < 0 counts as 0). */
export function breathAt(pattern: BreathPattern, t: number): BreathState {
  const p = breathOk(pattern) ? pattern : BREATH_DEFAULT;
  const cyc = breathCycle(p);
  const tt = Math.max(0, t);
  const n = Math.floor(tt / cyc);
  let x = tt - n * cyc;
  for (const phase of BREATH_PHASES) {
    const len = p[phase];
    if (len <= 0) continue;
    if (x < len) {
      const f = x / len;
      const k = phase === 'in' ? ease(f) : phase === 'holdIn' ? 1 : phase === 'out' ? 1 - ease(f) : 0;
      return { phase, p: f, left: len - x, k, n };
    }
    x -= len;
  }
  // floating-point edge: exactly at the cycle's end — the first phase with a length begins again
  const first = BREATH_PHASES.find(k => p[k] > 0) ?? 'in';
  return { phase: first, p: 0, left: p[first], k: first === 'holdIn' ? 1 : 0, n: n + 1 };
}

/**
 * A rest of whole breaths: `cycles` = the nearest whole number of cycles to `target` seconds, at least enough for
 * `min` seconds and at least one; `sec` = cycles × cycle.  E.g. the default (10 s) for a 26 s target → 3 breaths,
 * 30 s; the box (16 s) → 2 breaths, 32 s; 4 · 7 · 8 (19 s) with min 12 → 1 breath, 19 s.
 */
export function breathRest(pattern: BreathPattern, target: number, min = 0): { cycles: number; sec: number } {
  const p = breathOk(pattern) ? pattern : BREATH_DEFAULT;
  const cyc = breathCycle(p);
  const cycles = Math.max(1, Math.round(target / cyc), Math.ceil(min / cyc - 1e-9));
  return { cycles, sec: cycles * cyc };
}

/** A rest of exactly `cycles` whole breaths (a player's own count), at least one. */
export function breathRestOf(pattern: BreathPattern, cycles: number): { cycles: number; sec: number } {
  const p = breathOk(pattern) ? pattern : BREATH_DEFAULT;
  const c = Math.max(1, Math.round(Number.isFinite(cycles) ? cycles : 1));
  return { cycles: c, sec: c * breathCycle(p) };
}
