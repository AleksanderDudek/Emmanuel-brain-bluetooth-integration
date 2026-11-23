/**
 * The rest's rhythm (DESIGN.md §19.2): how long focus lasts before a rest comes — so how often a rest comes — and
 * how long a rest lasts, set per game in the lobby, in the game's own words.
 *
 * The founder (2026-11-23): *"Poprawić tryb odpoczynku w grach (dlaczego jest tak często? Czy możemy sterować tym
 * parametrem? Chcę móc ustawić częstotliwość i długość występowania w kontekście logiki danej gry)."*  So a game
 * declares two dials (ArcadeModule.rhythm): what its focus stretch counts — seconds, or its own unit (stations,
 * pieces, thoughts) — and what its rest counts — seconds or whole breaths — with its designed default and range; the
 * lobby shows them with −/+ (src/arcade/lobby.ts), the settings keep the player's choice per game, the runner hands
 * it to the game as `env.rhythm`, and the game's plan reads it.
 *
 * Why rests at all (said in the lobby): the band's signal (blood oxygenation in the prefrontal cortex) rises a few
 * seconds into an effort and settles only after ten or more; a rest lets it return, so the next focus stands out
 * against calm — how fNIRS neurofeedback compares blocks (DESIGN §2.2) — and switching focus on and off at will is
 * itself the skill.  Under `REST_SETTLE` seconds the lobby warns that a block's verdict grows less certain.
 *
 * Pure: no DOM, no clock.  The unit words come from i18n/rhythm.ts (the page's language).
 */
import { t } from '../../i18n/rhythm';

/** One dial of a game's rhythm: its designed default, its range, and how it reads in the game's words. */
export interface RhythmDial {
  def: number;
  min: number;
  max: number;
  step: number;
  /** the dial's name in the game's words, short: "Czujność", "Drzemka", "Odpoczynek po" */
  name: string;
  /** a value in the game's words: "40 s", "2 stacje", "3 oddechy" */
  format(n: number): string;
}

export interface RhythmSpec {
  /** how long focus lasts before a rest comes (seconds, or the game's own unit: stations, pieces, thoughts) */
  focus: RhythmDial;
  /** how long a rest lasts (seconds or whole breaths) */
  rest: RhythmDial;
  /** one short line in the game's words: where the rest falls in its logic */
  note?: string;
  /** seconds a focus value takes (for the lobby's "about N rests a session"); omit to hide the count */
  focusSec?(n: number): number;
  /** seconds a rest value takes (whole breaths × the cycle) */
  restSec?(n: number): number;
}

/** The player's rhythm for a session, in the dials' units; `custom` when it differs from the game's design. */
export interface Rhythm { focus: number; rest: number; custom: boolean }

/** What the settings keep per game (only the dials the player moved away from the default matter). */
export interface SavedRhythm { focus?: number; rest?: number }

/** The usual range of a focus stretch in seconds. */
export const FOCUS_SEC = { min: 20, max: 120, step: 5 } as const;
/** The usual range of a rest in seconds. */
export const REST_SEC = { min: 10, max: 40, step: 5 } as const;
/** A rest shorter than this (s) may end before the band's signal settles back: the lobby says so. */
export const REST_SETTLE = 15;
/**
 * The kit's guidance for a block game's design (DESIGN §19.2): about 40 s of focus and 20 s of rest — rest a third
 * of the session, every ~minute — where round 1's 26 / 22 s made it nearly half, every 25 s.  Each game picks its own
 * in the context of its logic.
 */
export const DEFAULT_BLOCK_RHYTHM = { focus: 40, rest: 20 } as const;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A value on the dial: a whole step from its minimum, inside its range (anything unreadable gives the default). */
export function clampDial(d: Pick<RhythmDial, 'def' | 'min' | 'max' | 'step'>, v: unknown): number {
  const n = num(v) ?? d.def;
  const k = Math.round((n - d.min) / d.step);
  const out = Math.min(d.max, Math.max(d.min, d.min + k * d.step));
  // whole steps of 0.5 or 0.1 must not leave 0.30000000000000004 behind
  return Math.round(out * 1000) / 1000;
}

/** The player's rhythm from what the settings kept (null: the game has no rhythm to set). */
export function rhythmOf(spec: RhythmSpec | null | undefined, saved: unknown): Rhythm | null {
  if (!spec) return null;
  const o = saved && typeof saved === 'object' ? (saved as SavedRhythm) : {};
  const focus = clampDial(spec.focus, o.focus), rest = clampDial(spec.rest, o.rest);
  return { focus, rest, custom: focus !== clampDial(spec.focus, spec.focus.def) || rest !== clampDial(spec.rest, spec.rest.def) };
}

/** One dial moved by `dir` steps (−1 / +1), kept in its range. */
export const stepDial = (d: RhythmDial, v: number, dir: number): number => clampDial(d, v + dir * d.step);

/**
 * A block plan's `[mean, jitter]` for the player's mean: the rules' jitter scaled with it (26 ± 4 s at 52 s → ± 8 s),
 * so a longer block still varies by the same share and a shorter one never jitters below its floor by much.
 */
export function scaledBlock(base: readonly [number, number], mean: number): [number, number] {
  const m = num(mean) && mean > 0 ? mean : base[0];
  return [m, base[0] > 0 ? (base[1] * m) / base[0] : base[1]];
}

/** "40 s" in the page's language. */
export const fmtSec = (n: number): string => t('rhythm.sec', { n: Math.round(n) });
/** "3 oddechy" in the page's language. */
export const fmtBreaths = (n: number): string => t('rhythm.breaths', { n });

/** A dial in seconds (defaults: the focus range); `name` defaults to the plain "Skupienie" / "Focus". */
export function secDial(def: number, name: string = t('rhythm.focus'), o: Partial<Pick<RhythmDial, 'min' | 'max' | 'step'>> = {}): RhythmDial {
  const min = o.min ?? FOCUS_SEC.min, max = o.max ?? FOCUS_SEC.max, step = o.step ?? FOCUS_SEC.step;
  return { def: clampDial({ def, min, max, step }, def), min, max, step, name, format: fmtSec };
}

/** A rest dial in seconds (10–40 s by 5) named "Odpoczynek" / "Rest" unless the game names it. */
export function restSecDial(def: number, name: string = t('rhythm.rest'), o: Partial<Pick<RhythmDial, 'min' | 'max' | 'step'>> = {}): RhythmDial {
  return secDial(def, name, { min: o.min ?? REST_SEC.min, max: o.max ?? REST_SEC.max, step: o.step ?? REST_SEC.step });
}

/**
 * A rest dial in whole breaths of `cycleSec` seconds each (1–6 breaths unless given): it reads "2 oddechy · 20 s".
 * A game whose breath pattern the player sets passes the pattern's cycle (kit/breath.ts `breathCycle`).
 */
export function breathDial(def: number, name: string = t('rhythm.rest'), cycleSec = 10, o: Partial<Pick<RhythmDial, 'min' | 'max'>> = {}): RhythmDial {
  const min = o.min ?? 1, max = o.max ?? 6, cyc = Math.max(1, cycleSec);
  return {
    def: clampDial({ def, min, max, step: 1 }, def), min, max, step: 1, name,
    format: n => t('rhythm.breathsSec', { b: fmtBreaths(n), s: Math.round(n * cyc) }),
  };
}

/**
 * The standard rhythm of a block game: focus and rest in seconds, named in the game's words (its blocks' names, or
 * the plain "Skupienie" / "Odpoczynek"), with the count of rests the lobby can show.
 */
export function blockRhythm(def: { focus: number; rest: number }, names: { focus?: string; rest?: string } = {}, note?: string): RhythmSpec {
  return {
    focus: secDial(def.focus, names.focus),
    rest: restSecDial(def.rest, names.rest),
    note,
    focusSec: n => n,
    restSec: n => n,
  };
}

/** About how many rests a session of `sec` seconds brings, and what share of it they take (null: the spec cannot say). */
export function restsIn(spec: RhythmSpec, r: Pick<Rhythm, 'focus' | 'rest'>, sec: number): { rests: number; share: number } | null {
  if (!spec.focusSec || !spec.restSec) return null;
  const f = spec.focusSec(r.focus), q = spec.restSec(r.rest);
  if (!(f > 0) || !(q >= 0) || !(sec > 0)) return null;
  // the first-ever warm-up and the finale aside, a session is pairs of focus and rest, each pair ending in a rest
  const rests = Math.max(1, Math.round(sec / (f + q)));
  return { rests, share: q / (f + q) };
}
