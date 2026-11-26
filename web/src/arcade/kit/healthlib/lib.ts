/**
 * A health library as the engine reads it (DESIGN.md §24): the game's `HealthLibrary` (spec.ts) with what the engine
 * derives from it once — the meditations and scenes in order, the walk along them, the game's translator (the game's
 * catalog first, then the engine's), the names, the narrator's lines and the push strategies.  Pure, no DOM; one
 * `Lib` per library object (cached), in this page's language unless asked for another.
 */
import { format, lang as pageLang, pick, type Catalog, type Lang, type Msg, type Params } from '../../../i18n';
import { ENGINE } from './i18n';
import { RULES } from './rules';
import type { HealthLibrary, MedSpec, Pt, SceneSpec, WorldPainter } from './spec';

/** In order (all of them, then again), just this one (then stay with its picture), or this one again and again. */
export const MODES = ['order', 'one', 'repeat'] as const;
export type Mode = (typeof MODES)[number];

/** The narrator's shared moments (three lines each, `say.<moment>.1–3`); a scene's own is `at.<scene>` (1–3 lines). */
export const SHARED_MOMENTS = ['open', 'warm', 'grown', 'whole', 'good', 'rest', 'blind', 'blindEnd', 'nosignal', 'still', 'after', 'again', 'end'] as const;
export type Moment = (typeof SHARED_MOMENTS)[number] | `at.${string}`;

/** The strategies the engine words itself (the scene's own is the game's `tip.<scene>`). */
export const TIPS = {
  count: 'tip.count',
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'],
  blind: ['tip.blind.1', 'tip.blind.2'],
  warmup: 'tip.warmup',
} as const;

export type Translate = (key: string, params?: Params) => string;

export interface Lib {
  readonly spec: HealthLibrary;
  readonly id: string;
  /** the meditations' ids in order */
  readonly meds: readonly string[];
  /** every scene id, meditation by meditation */
  readonly scenes: readonly string[];
  readonly lang: Lang;
  med(id: string): MedSpec;
  scene(id: string): SceneSpec;
  /** the meditation a scene belongs to */
  medOf(scene: string): string;
  /** the i-th scene of a meditation (clamped) */
  sceneAt(med: string, i: number): string;
  sceneCount(med: string): number;
  /** one step along the library, scene by scene and meditation by meditation (wrapping round) */
  step(med: string, i: number, dir: 1 | -1): { med: string; i: number };
  world(scene: string): WorldPainter;
  /** where the growing point stands as a scene grows */
  focusAt(scene: string, g: number): Pt;
  isMed(v: unknown): v is string;
  isScene(v: unknown): v is string;
  t: Translate;
  has(key: string): boolean;
  /** "1 240 komórek" (the game's `unit` with its number) */
  unitsText(n: number): string;
  /** the unit without its number ("komórek"), for a number drawn on its own */
  unit(n: number): string;
  medName(m: string): string;
  medLine(m: string): string;
  medCare(m: string): string;
  sceneName(s: string): string;
  sceneTeach(s: string): string;
  partName(p: string): string;
  lookName(l: string): string;
  modeName(m: Mode): string;
  /** the narrator's lines for a moment, in this language */
  linesOf(m: Moment): string[];
  /** the push strategy on a scene: its picture, but every RULES.repeatEvery-th push the counting one */
  pushTip(scene: string, pushIndex: number): string;
  /** the game has a quiet tune (else a warm pad only) */
  readonly hasTune: boolean;
}

/** `t(key)` over the game's catalog then the engine's, in a language (the page's by default). */
export function translatorFor(words: Readonly<Record<Lang, Catalog<string>>>, l: Lang = pageLang): { t: Translate; has: (key: string) => boolean; msg: (key: string) => Msg | undefined } {
  const g = (words[l] ?? {}) as Readonly<Record<string, Msg | undefined>>;
  const e = ENGINE[l] as Readonly<Record<string, Msg | undefined>>;
  const gp = (words.pl ?? {}) as Readonly<Record<string, Msg | undefined>>;
  const ep = ENGINE.pl as Readonly<Record<string, Msg | undefined>>;
  const msg = (key: string): Msg | undefined => g[key] ?? e[key] ?? gp[key] ?? ep[key];
  return {
    t: (key, params) => format(pick(msg(key) ?? key, typeof params?.n === 'number' ? params.n : undefined), params),
    has: key => msg(key) !== undefined,
    msg,
  };
}

const cache = new Map<Lang, WeakMap<HealthLibrary, Lib>>();

/** The engine's view of a library (cached per library object and language). */
export function libOf(spec: HealthLibrary, l: Lang = pageLang): Lib {
  let byLang = cache.get(l);
  if (!byLang) cache.set(l, (byLang = new WeakMap()));
  let lib = byLang.get(spec);
  if (!lib) byLang.set(spec, (lib = build(spec, l)));
  return lib;
}

function build(spec: HealthLibrary, l: Lang): Lib {
  const meds = spec.meds.map(m => m.id);
  const byMed = new Map(spec.meds.map(m => [m.id, m]));
  const scenes = spec.meds.flatMap(m => [...m.scenes]);
  const medOfScene = new Map<string, string>();
  for (const m of spec.meds) for (const s of m.scenes) if (!medOfScene.has(s)) medOfScene.set(s, m.id);
  const { t, has, msg } = translatorFor(spec.words, l);
  const med = (id: string): MedSpec => byMed.get(id) ?? spec.meds[0];
  const sceneCount = (m: string): number => Math.max(1, med(m).scenes.length);
  const sceneAt = (m: string, i: number): string => {
    const list = med(m).scenes;
    return list[Math.max(0, Math.min(list.length - 1, Math.floor(i)))];
  };
  const bare = (key: string, n: number): string =>
    format(pick(msg(key) ?? key, n), { n: '' }).replace(/^[+\s ]+/, '').replace(/\s{2,}/g, ' ').trim();
  let tune: boolean | null = null;
  const lib: Lib = {
    spec, id: spec.id, meds, scenes, lang: l,
    med,
    scene: id => spec.scenes[id],
    medOf: s => medOfScene.get(s) ?? meds[0],
    sceneAt,
    sceneCount,
    step(m, i, dir) {
      const j = i + dir;
      if (j >= 0 && j < sceneCount(m)) return { med: m, i: j };
      const k = (Math.max(0, meds.indexOf(m)) + dir + meds.length) % meds.length;
      const next = meds[k];
      return { med: next, i: dir > 0 ? 0 : sceneCount(next) - 1 };
    },
    world: s => spec.worlds[spec.scenes[s].world],
    focusAt(s, g) {
      const sc = spec.scenes[s];
      return spec.worlds[sc.world]?.focusAt?.(s, g) ?? sc.focus;
    },
    isMed: (v): v is string => typeof v === 'string' && byMed.has(v),
    isScene: (v): v is string => typeof v === 'string' && medOfScene.has(v),
    t, has,
    unitsText: n => t('unit', { n }),
    unit: n => bare('unit', n),
    medName: m => t(`med.${m}`),
    medLine: m => t(`med.${m}.line`),
    medCare: m => (has(`med.${m}.care`) ? t(`med.${m}.care`) : ''),
    sceneName: s => t(`scene.${s}`),
    sceneTeach: s => t(`teach.${s}`),
    partName: p => t(`part.${p}`),
    lookName: x => t(`look.${x}`),
    modeName: m => t(`mode.${m}`),
    linesOf(m) {
      const out: string[] = [];
      for (let i = 1; i <= 3; i++) if (has(`say.${m}.${i}`)) out.push(t(`say.${m}.${i}`));
      return out;
    },
    pushTip(s, pushIndex) {
      if ((pushIndex + 1) % RULES.repeatEvery === 0) return t(TIPS.count);
      return has(`tip.${s}`) ? t(`tip.${s}`) : t(TIPS.warmup);
    },
    get hasTune(): boolean {
      if (tune === null) {
        try {
          tune = spec.tune() !== null;
        } catch {
          tune = false;
        }
      }
      return tune;
    },
  };
  return lib;
}
