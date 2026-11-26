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
import type { SceneId as HairScene } from '../wlosy/content';
import type { Borrow } from './borrow';

export { KOMORKI, STRAZ, KREGOSLUP, KSZTALT, RADOSC, SKORA };

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
  komorki: { lib: KOMORKI, key: 'med.noc.care' },
  postawa: { lib: KREGOSLUP, key: 'med.ruch.care' },
  sylwetka: { lib: KSZTALT, key: 'med.miesien.care' },
  skora: { lib: SKORA, key: 'med.kolagen.care' },
  radosc: { lib: RADOSC, key: 'med.wdziecznosc.care' },
  cale: { lib: KSZTALT, key: 'med.cale.care' },
};

/**
 * The look each source game is told: Rozkwit's figure (`ona`/`on`) is Lekkość i siła's own; Żywa skóra paints its
 * pictures in a skin tone and gets the middle one (Rozkwit asks only for the figure — the lobby stays simple); the
 * others have none.
 */
export const LOOK_FOR: Readonly<Record<string, (l: string) => string>> = {
  ksztalt: l => (l === 'on' ? 'on' : 'ona'),
  skora: () => 'medium',
};

/** The figure's look and the note under it: Lekkość i siła's words. */
export const LOOK_KEYS = ['look.ona', 'look.on', 'panel.look', 'panel.lookNote'] as const;
