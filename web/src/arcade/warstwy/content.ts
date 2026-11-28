/**
 * Warstwy światła's content (DESIGN §28): the seven layers from the body outward, each with its texture and colours,
 * the kind of thing that clings to it — pictured in Scripture's own images — and its passages; the session's other
 * passages; the narrator's moments.  The tradition's names of the layers (the etheric, the astral…) are the i18n's
 * `layer.<id>.trad`; the plain names `layer.<id>`.
 *
 *   1 Ciało    (eteryczna)          a fine web of blue-silver lines close to the body   thorns caught in the web (2 Cor 12:9)
 *   2 Uczucia  (emocjonalna)        coloured clouds                                      dark stains (Ps 51:7 "wash me")
 *   3 Myśli    (mentalna)           a clear lemon-gold haze                              darts and spiky burrs (2 Cor 10:5, Eph 6:16)
 *   4 Relacje  (astralna)           rose light                                           cords to people and things (Ps 129:4)
 *   5 Wola     (wzorzec eteryczny)  a deep blue blueprint of lines                       chains and knots (Ps 107:14, Ps 116:16)
 *   6 Radość   (niebiańska)         an opalescent shimmer                                ashes (Isa 61:3)
 *   7 Duch     (ketheryczna)        a golden lattice shell                               cracks, a dark sliver in each (Ps 51:10)
 *
 * Passages only by the ids of src/content/scripture.ts (kit/scripture.ts); never paraphrased in the texts.
 */
import { inTurn, type PassageId } from '../kit/scripture';

export type LayerId = 'cialo' | 'uczucia' | 'mysli' | 'relacje' | 'wola' | 'radosc' | 'duch';
export type Thing = 'thorn' | 'stain' | 'dart' | 'cord' | 'chain' | 'ash' | 'crack';

export interface LayerSpec {
  id: LayerId;
  thing: Thing;
  /** the clear colour (its light), the dull colour (before it is cleansed), a deep tone for its texture */
  hue: string;
  dull: string;
  deep: string;
  /** the passages of its rests, in turn */
  verses: readonly PassageId[];
}

export const LAYERS: readonly LayerSpec[] = [
  { id: 'cialo', thing: 'thorn', hue: '#bfe6ff', dull: '#6f7f96', deep: '#4a9be0', verses: ['2co12.9', 'psa16.9', '1co6.19-20'] },
  { id: 'uczucia', thing: 'stain', hue: '#ffc6e2', dull: '#7c6a7c', deep: '#7fd6c8', verses: ['psa51.7', 'psa34.18', 'psa62.8'] },
  { id: 'mysli', thing: 'dart', hue: '#fff1a0', dull: '#8a8462', deep: '#ffd75a', verses: ['2co10.5', 'eph6.16', 'php4.7'] },
  { id: 'relacje', thing: 'cord', hue: '#ffa9c8', dull: '#866673', deep: '#ff7aa8', verses: ['psa129.4', 'col3.14', 'eph4.32'] },
  { id: 'wola', thing: 'chain', hue: '#8fb2ff', dull: '#4a5578', deep: '#2f56d8', verses: ['psa107.14', 'psa116.16', 'jhn8.36'] },
  { id: 'radosc', thing: 'ash', hue: '#f4ecff', dull: '#7e7a86', deep: '#c8b8ff', verses: ['isa61.3', 'jhn16.22', 'psa30.5'] },
  { id: 'duch', thing: 'crack', hue: '#ffd98a', dull: '#86704c', deep: '#f2b440', verses: ['psa51.10', '2co4.6', 'ezk36.26'] },
];

export const LAYER_IDS: readonly LayerId[] = LAYERS.map(l => l.id);

/** The session's other passages. */
export const VERSES = {
  arrive: ['mat11.28', '1pe5.7'] as readonly PassageId[],
  whole: ['1th5.23'] as readonly PassageId[],
  close: ['1jn1.7', 'psa36.9', 'num6.24-26'] as readonly PassageId[],
};

/** Every passage the meditation quotes. */
export const ALL_VERSES: readonly PassageId[] = [...new Set([...LAYERS.flatMap(l => l.verses), ...VERSES.arrive, ...VERSES.whole, ...VERSES.close])];

/** A layer's passage for its `n`-th rest (1-based), the session turning where they start. */
export const layerVerse = (k: number, n: number, session: number): PassageId => {
  const v = LAYERS[Math.max(0, Math.min(6, k))].verses;
  return v[(Math.max(1, Math.floor(n)) - 1 + Math.max(0, Math.floor(session) - 1)) % v.length];
};

/** The arrival's and the close's passage for the session (in turn). */
export const sessionVerse = (which: 'arrive' | 'close', session: number): PassageId => inTurn(VERSES[which], session);

/**
 * The narrator's moments: the arrival, a layer's first thing (per layer), a thing drawn, waiting without focus, a
 * layer closing, the grace, a rest, the whole, the close.
 */
export type Moment = 'arrive' | `begin.${LayerId}` | 'drawn' | 'wait' | 'healed' | 'grace' | 'rest' | 'whole' | 'close';
export const MOMENTS: readonly Moment[] = ['arrive', ...LAYER_IDS.map(id => `begin.${id}` as Moment), 'drawn', 'wait', 'healed', 'grace', 'rest', 'whole', 'close'];

/** Own words for a layer ("Co dziś oddajesz?"): one short line, kept only on this device. */
export const OWN_LEN = 40;

/** A typed line made clean: no control characters, single spaces, at most OWN_LEN characters. */
export function cleanOwn(v: unknown): string {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim();
  return [...s].slice(0, OWN_LEN).join('').trim();
}
