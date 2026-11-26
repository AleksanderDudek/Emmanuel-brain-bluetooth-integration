/**
 * Rozkwit reuses, it does not redraw (DESIGN.md §24): its scenes are framed in the other health visualisations'
 * pictures — the same body, seen whole.  A borrowed scene keeps the source game's world, view, growing point and
 * (a chosen few of) its named parts; the world is wrapped so that it is told the source's own scene id and look, and
 * the names of the parts are copied from the source's catalogs, so nothing is typed twice and a source's polish
 * reaches Rozkwit by itself.
 *
 * Keys: a borrowed world is `<source id>.<world>` ("komorki.membrane"); a borrowed part is `<source id>_<part>`
 * ("komorki_rotor", its word `part.komorki_rotor` = the source's `part.rotor`).
 */
import { LANGS, type Catalog, type Lang, type Msg } from '../../i18n';
import type { HealthLibrary, LabelSpec, Pt, Rect, SceneSpec, WorldPainter } from '../kit/healthlib/spec';

/** One of Rozkwit's scenes framed in another game's picture. */
export interface Borrow {
  /** the source library */
  lib: HealthLibrary;
  /** the source's scene id */
  scene: string;
  /** the source's parts to name here (in this order; default: all of the scene's labels) */
  parts?: readonly string[];
  /** a label of this scene's own (a part of Rozkwit's catalog, `part.<p>`) */
  extra?: readonly LabelSpec[];
  /** a closer or wider frame than the source's (world units of the source) */
  view?: Rect;
  /** the growing point, if not the source's */
  focus?: Pt;
}

export const worldKey = (lib: HealthLibrary, world: string): string => `${lib.id}.${world}`;
export const partKey = (lib: HealthLibrary, part: string): string => `${lib.id}_${part}`;

/** The scene record of a borrowed scene (Rozkwit's own scene id is the record's key in the library). */
export function borrowedScene(b: Borrow): SceneSpec {
  const src = b.lib.scenes[b.scene];
  if (!src) throw new Error(`rozkwit: ${b.lib.id} has no scene “${b.scene}”`);
  const pick = b.parts ? b.parts.map(p => src.labels.find(l => l.part === p)).filter((l): l is LabelSpec => !!l) : src.labels;
  const labels: LabelSpec[] = [...pick.map(l => ({ ...l, part: partKey(b.lib, l.part) })), ...(b.extra ?? [])];
  return {
    world: worldKey(b.lib, src.world),
    view: b.view ?? src.view,
    focus: b.focus ?? src.focus,
    labels,
    ...(src.variant !== undefined ? { variant: src.variant } : {}),
  };
}

/**
 * A source's world as Rozkwit's: told the source's scene id (Rozkwit's ids map to it) and the look translated
 * (Rozkwit's figure `ona`/`on` → whatever the source knows; '' for a game without looks).
 */
export function borrowedWorld(w: WorldPainter, theirs: ReadonlyMap<string, string>, look: (l: string) => string): WorldPainter {
  const id = (s: string): string => theirs.get(s) ?? s;
  const out: WorldPainter = {
    depth: w.depth,
    lens: w.lens,
    bake: (ctx, variant, l) => w.bake(ctx, variant, look(l)),
    draw: (ctx, st) => w.draw(ctx, { ...st, scene: id(st.scene), look: look(st.look) }),
  };
  const fa = w.focusAt, co = w.counter;
  if (fa) out.focusAt = (s, g) => fa(id(s), g);
  if (co) out.counter = (s, g) => co(id(s), g);
  return out;
}

/** The words a borrowed scene names (`part.<source>_<part>`), copied from the source's four catalogs. */
export function borrowedParts(borrows: readonly Borrow[]): Record<Lang, Record<string, Msg>> {
  const out = Object.fromEntries(LANGS.map(l => [l, {} as Record<string, Msg>])) as Record<Lang, Record<string, Msg>>;
  for (const b of borrows) {
    const src = b.lib.scenes[b.scene];
    if (!src) continue;
    for (const lb of src.labels) {
      if (b.parts && !b.parts.includes(lb.part)) continue;
      for (const l of LANGS) {
        const cat = b.lib.words[l] as Readonly<Record<string, Msg | undefined>>;
        const pl = b.lib.words.pl as Readonly<Record<string, Msg | undefined>>;
        const m = cat[`part.${lb.part}`] ?? pl[`part.${lb.part}`];
        if (m !== undefined) out[l][`part.${partKey(b.lib, lb.part)}`] = m;
      }
    }
  }
  return out;
}

/** A word of a source game in each language (e.g. its meditation's everyday step), for Rozkwit's own key. */
export function copied(lib: HealthLibrary, key: string): Record<Lang, Msg> {
  const pl = lib.words.pl as Readonly<Record<string, Msg | undefined>>;
  return Object.fromEntries(LANGS.map(l => {
    const cat = lib.words[l] as Readonly<Record<string, Msg | undefined>>;
    return [l, cat[key] ?? pl[key] ?? key];
  })) as Record<Lang, Msg>;
}

/** Catalogs merged key by key (later wins). */
export function mergeWords(...parts: readonly Partial<Record<Lang, Readonly<Record<string, Msg>>>>[]): Readonly<Record<Lang, Catalog<string>>> {
  return Object.fromEntries(LANGS.map(l => [l, Object.assign({}, ...parts.map(p => p[l] ?? {}))])) as Readonly<Record<Lang, Catalog<string>>>;
}
