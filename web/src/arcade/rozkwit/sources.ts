/**
 * What Rozkwit borrows (DESIGN.md §24): each of its scenes framed in another health visualisation's picture, by
 * Rozkwit's scene id — read by the library (the scenes and worlds) and by the words (the parts' names and the
 * everyday steps are copied from the source games' catalogs, so nothing is typed twice).
 */
import { LIBRARY as KOMORKI } from '../komorki/library';
import { LIBRARY as STRAZ } from '../straz/library';
import { LIBRARY as KREGOSLUP } from '../kregoslup/library';
import { LIBRARY as KSZTALT } from '../ksztalt/library';
import { LIBRARY as RADOSC } from '../radosc/library';
import { LIBRARY as SKORA } from '../skora/library';
import { LIBRARY as SILY } from '../sily/library';
import type { SceneId as HairScene } from '../wlosy/content';
import type { Borrow } from './borrow';

export { KOMORKI, STRAZ, KREGOSLUP, KSZTALT, RADOSC, SKORA, SILY };

// ── the scenes borrowed from the engine's games ──────────────────
export const BORROWS: Readonly<Record<string, Borrow>> = {
  energia: { lib: KOMORKI, scene: 'wirnik', parts: ['rotor', 'protons', 'atp'] },
  naprawa: { lib: KOMORKI, scene: 'litera' },
  straz: { lib: STRAZ, scene: 'patrol' },
  dyski: { lib: KREGOSLUP, scene: 'noc' },
  gorset: { lib: KREGOSLUP, scene: 'gorset' },
  wyprost: { lib: KREGOSLUP, scene: 'wyprost' },
  wydech: { lib: KSZTALT, scene: 'oddech' },
  miesien: { lib: KSZTALT, scene: 'budowa' },
  postac: { lib: KSZTALT, scene: 'postac' },
  naskorek: { lib: SKORA, scene: 'wedrowka' },
  kolagen: { lib: SKORA, scene: 'fibroblast' },
  ziarno: { lib: RADOSC, scene: 'dostrzec' },
  wdziecznosc: { lib: RADOSC, scene: 'trzy' },
  plynie: { lib: RADOSC, scene: 'plynie' },
};

/** Każdy włos's scenes (through the adapter, world-hair.ts), by Rozkwit's scene id. */
export const HAIR: Readonly<Record<string, HairScene>> = { wlos: 'barwa', glowa: 'glowa' };
/** Każdy włos's part ids as Rozkwit names them (`part.wlosy_<p>`, copied from its catalogs). */
export const hairPart = (p: string): string => `wlosy_${p}`;

/** Each meditation's everyday step ("Na co dzień"), one source game's own line, word for word. */
export const CARE: Readonly<Record<string, { lib: typeof KOMORKI; key: string }>> = {
  // „Wszystko naraz”: joy told to someone close grows (Pełnia radości's own step)
  naraz: { lib: RADOSC, key: 'med.pelnia.care' },
  komorki: { lib: KOMORKI, key: 'med.noc.care' },
  postawa: { lib: KREGOSLUP, key: 'med.ruch.care' },
  sylwetka: { lib: KSZTALT, key: 'med.miesien.care' },
  skora: { lib: SKORA, key: 'med.kolagen.care' },
  radosc: { lib: RADOSC, key: 'med.wdziecznosc.care' },
  cale: { lib: KSZTALT, key: 'med.cale.care' },
};

/**
 * Rozkwit's looks are Nowe siły's (round 25): a woman or a man in three skin tones, `f1 f2 f3 m1 m2 m3` — the person of
 * „Wszystko naraz” is Nowe siły's person seen whole.  Saves from before kept Lekkość i siła's figure (`ona`/`on`); they
 * are read as the first tone of that figure (index.ts).
 */
export const LOOKS = SILY.looks;
/** an old save's figure → the look it becomes */
export const OLD_LOOK: Readonly<Record<string, string>> = { ona: 'f1', on: 'm1' };

/** The skin tone a look has (1 light, 2 olive, 3 dark), and whether it is a man's. */
const toneOf = (l: string): 1 | 2 | 3 => (l.endsWith('3') ? 3 : l.endsWith('2') ? 2 : 1);
const isMan = (l: string): boolean => l === 'on' || l.startsWith('m');

/**
 * The look each source game is told: Lekkość i siła gets the figure (`ona`/`on`); Żywa skóra paints its pictures in
 * the skin tone nearest the player's (Nowe siły's light tone is Żywa skóra's medium, olive its olive, dark its dark);
 * the others have none.
 */
export const LOOK_FOR: Readonly<Record<string, (l: string) => string>> = {
  ksztalt: l => (isMan(l) ? 'on' : 'ona'),
  skora: l => (['medium', 'olive', 'dark'] as const)[toneOf(l) - 1],
};

/** The person's looks: Nowe siły's words (the note under them is Rozkwit's own). */
export const LOOK_KEYS = ['look.f1', 'look.f2', 'look.f3', 'look.m1', 'look.m2', 'look.m3'] as const;
