/**
 * Odnowa's data: the kinds of DNA damage and the real repair crews that mend them, the three stem-cell niches
 * (each a real tissue with its own renewal time and its own kind of damage), the worn parts autophagy
 * recycles, the "Wiedza" cards (one real number, one plain sentence and the source of each — DESIGN §13.12
 * lists them in full), the strategies for the blocks and Mito's moments.  The words are in i18n.ts.
 *
 * Accuracy first (DESIGN §13.3): every step a crew shows is the real order of the pathway —
 *   base excision repair (BER): a glycosylase removes the damaged base, APE1 nicks the backbone, polymerase β
 *     puts in one new letter, a ligase seals the nick (Dianov & Hübscher 2013; Lindahl, Nobel Prize 2015);
 *     an abasic site has lost its base already, so APE1 starts;
 *   nucleotide excision repair (NER): XPC finds the kink, TFIIH unwinds the helix, XPF and XPG cut a piece of
 *     24–32 letters out, a polymerase fills the gap and a ligase seals it (Wakasugi & Sancar 1998; Sancar,
 *     Nobel Prize 2015);
 *   a double-strand break by non-homologous end joining (NHEJ): Ku holds both ends, DNA-PKcs bridges them,
 *     ligase IV joins them — in about 30 minutes in a real cell (Mao et al. 2008).
 */
import { t, type Key } from './i18n';

// ── DNA damage and its repair ─────────────────────────────────────
export type LesionKind = 'oxo' | 'abasic' | 'dimer' | 'bulky' | 'dsb';
export const LESION_KINDS: readonly LesionKind[] = ['oxo', 'abasic', 'dimer', 'bulky', 'dsb'];
export type Path = 'ber' | 'ner' | 'nhej';
/** The crews' steps, in the pathway's order. */
export type StepId = 'glyco' | 'ape1' | 'polb' | 'lig' | 'xpc' | 'tfiih' | 'cut' | 'fill' | 'ku' | 'lig4';

export interface LesionSpec {
  kind: LesionKind;
  path: Path;
  /** the steps after each tap: one tap runs the whole repair, a two-step repair waits for a second tap */
  stages: readonly (readonly StepId[])[];
  /** ATP the repair uses (the ligase seals with ATP; TFIIH and DNA-PKcs spend it too) */
  atp: number;
  /** how many rungs the damage spans on the helix */
  span: number;
}

export const LESIONS: Readonly<Record<LesionKind, LesionSpec>> = {
  oxo: { kind: 'oxo', path: 'ber', stages: [['glyco', 'ape1', 'polb', 'lig']], atp: 1, span: 1 },
  abasic: { kind: 'abasic', path: 'ber', stages: [['ape1', 'polb', 'lig']], atp: 1, span: 1 },
  dimer: { kind: 'dimer', path: 'ner', stages: [['xpc', 'tfiih'], ['cut', 'fill', 'lig']], atp: 2, span: 2 },
  bulky: { kind: 'bulky', path: 'ner', stages: [['xpc', 'tfiih'], ['cut', 'fill', 'lig']], atp: 2, span: 2 },
  dsb: { kind: 'dsb', path: 'nhej', stages: [['ku'], ['lig4']], atp: 2, span: 1 },
};

export const lesionName = (k: LesionKind): string => t(`lesion.${k}` as Key);
export const stepName = (s: StepId): string => t(`step.${s}` as Key);
export const pathName = (p: Path): string => t(`path.${p}` as Key);

// ── the stem-cell niches ──────────────────────────────────────────
export type NicheId = 'gut' | 'skin' | 'blood';
export const NICHES: readonly NicheId[] = ['gut', 'skin', 'blood'];

export interface NicheSpec {
  id: NicheId;
  /** the session's damage: weights of the single-strand lesions (a double-strand break comes apart, rules.ts) */
  mix: Readonly<Partial<Record<Exclude<LesionKind, 'dsb'>, number>>>;
  /** the scene's tint: the cytoplasm's deep and light tones, the daughter cell's colour */
  deep: string;
  light: string;
  cell: string;
  rim: string;
}

/**
 * Skin cells meet the sun's UV (thymine dimers: up to 10^5 photoproducts in a day in the sun, Hoeijmakers
 * 2009); the gut lining meets bulky adducts from food; every cell meets oxidation and lost bases (Lindahl 1993).
 */
export const NICHE: Readonly<Record<NicheId, NicheSpec>> = {
  gut: { id: 'gut', mix: { oxo: 5, abasic: 3, bulky: 2 }, deep: '#0c2629', light: '#1f5a52', cell: '#ff9f8a', rim: '#ffd2c4' },
  skin: { id: 'skin', mix: { oxo: 3, abasic: 2, dimer: 5 }, deep: '#1a2128', light: '#4a5a52', cell: '#f3c9a0', rim: '#fff0dc' },
  blood: { id: 'blood', mix: { oxo: 5, abasic: 4, bulky: 1 }, deep: '#26141e', light: '#5a2c3c', cell: '#e5484d', rim: '#ffb3b5' },
};

export const nicheName = (n: NicheId): string => t(`niche.${n}` as Key);
export const nichePlace = (n: NicheId): string => t(`niche.${n}.place` as Key);
export const cellName = (n: NicheId): string => t(`cell.${n}` as Key);

// ── worn parts (autophagy) ────────────────────────────────────────
export type PartKind = 'mito' | 'clump' | 'perox';
export const PART_KINDS: readonly PartKind[] = ['mito', 'clump', 'perox'];
/** building material a recycled part gives back, and how often each comes */
export const PART: Readonly<Record<PartKind, { mat: number; weight: number }>> = {
  mito: { mat: 3, weight: 4 },
  clump: { mat: 2, weight: 3 },
  perox: { mat: 2, weight: 2 },
};
export const partName = (k: PartKind): string => t(`part.${k}` as Key);

// ── Wiedza: one real number each, with its source ───────────────────
export type CardId =
  | 'turbine' | 'speed' | 'daily' | 'pumps' | 'pmf' | 'glucose' | 'powerhouse'
  | 'lesions' | 'ber' | 'ner' | 'uv' | 'dsb' | 'fidelity'
  | 'autophagy' | 'lysosome' | 'mitophagy'
  | 'turnover' | 'gut' | 'skin' | 'blood' | 'biogenesis';

export interface CardSpec { id: CardId; group: 'energy' | 'repair' | 'clean' | 'renew'; src: string }

/** In the order the panel lists them; the sources are the same in every language. */
export const CARDS: readonly CardSpec[] = [
  { id: 'turbine', group: 'energy', src: 'Watt et al. 2010, PNAS 107:16823' },
  { id: 'pumps', group: 'energy', src: 'Watt et al. 2010, PNAS; Wikström et al. 2018, Chem Rev' },
  { id: 'pmf', group: 'energy', src: 'Perry et al. 2011, BioTechniques 50:98' },
  { id: 'speed', group: 'energy', src: 'Watt et al. 2010, PNAS; Yasuda et al. 2001, Nature 410:898' },
  { id: 'daily', group: 'energy', src: 'Törnroth-Horsefield & Neutze 2008, PNAS 105:19565' },
  { id: 'glucose', group: 'energy', src: 'Flamholz, Phillips & Milo 2014, Mol Biol Cell 25:3497' },
  { id: 'powerhouse', group: 'energy', src: 'Siekevitz 1957, Scientific American 197(1):131' },
  { id: 'lesions', group: 'repair', src: 'Lindahl, Nobel lecture 2015; Hoeijmakers 2009, NEJM 361:1475' },
  { id: 'ber', group: 'repair', src: 'Dianov & Hübscher 2013, Nucleic Acids Res 41:3483' },
  { id: 'ner', group: 'repair', src: 'Wakasugi & Sancar 1998, PNAS 95:6669' },
  { id: 'uv', group: 'repair', src: 'Hoeijmakers 2009, NEJM 361:1475' },
  { id: 'dsb', group: 'repair', src: 'Mao et al. 2008, DNA Repair 7:1765' },
  { id: 'fidelity', group: 'repair', src: 'Preston et al. 2010, Semin Cancer Biol 20:281' },
  { id: 'autophagy', group: 'clean', src: 'nobelprize.org, Physiology or Medicine 2016' },
  { id: 'lysosome', group: 'clean', src: 'Xu & Ren 2015, Annu Rev Physiol 77:57' },
  { id: 'mitophagy', group: 'clean', src: 'Narendra et al. 2008, J Cell Biol 183:795' },
  { id: 'turnover', group: 'renew', src: 'Sender & Milo 2021, Nature Medicine 27:45' },
  { id: 'gut', group: 'renew', src: 'Darwich et al. 2014, Drug Metab Dispos 42:2016; Barker et al. 2007, Nature 449:1003' },
  { id: 'skin', group: 'renew', src: 'Weinstein et al. 1984, J Invest Dermatol 82:623' },
  { id: 'blood', group: 'renew', src: 'Sender & Milo 2021, Nature Medicine; OpenStax Anatomy & Physiology 2e' },
  { id: 'biogenesis', group: 'renew', src: 'Hoppeler et al. 1985, J Appl Physiol 59:320; Wu et al. 1999, Cell' },
];
export const CARD_IDS: readonly CardId[] = CARDS.map(c => c.id);
export const cardSpec = (id: CardId): CardSpec => CARDS.find(c => c.id === id)!;
export const cardTitle = (id: CardId): string => t(`card.${id}.title` as Key);
export const cardNum = (id: CardId): string => t(`card.${id}.num` as Key);
export const cardText = (id: CardId): string => t(`card.${id}.text` as Key);

// ── the strategies under a block's name (imagery of the scene, one counting and one recall in turn) ──
export const TIPS = {
  warmup: (): string => t('tip.warmup'),
  firstPush: (): string => t('tip.firstPush'),
  firstRest: (): string => t('tip.firstRest'),
  push: (): readonly string[] => [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: (): readonly string[] => [t('tip.blind.1'), t('tip.blind.2')],
  rest: (): readonly string[] => [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
};

// ── Mito's moments (each at least three lines, ≤ 90 characters) ────────
export const MOMENTS = [
  'first', 'open', 'warm', 'push', 'good', 'blind', 'rest', 'calm', 'ready', 'surge', 'repair', 'combo', 'two', 'dsb',
  'gate', 'check', 'divide', 'cell', 'upMito', 'upEnzyme', 'upLyso', 'kick', 'recycle', 'fact', 'end',
] as const;
export type Moment = typeof MOMENTS[number];

/** How many lines each moment has in the catalog (`say.<moment>.<n>`, from 1). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = {
  first: 3, open: 4, warm: 3, push: 5, good: 4, blind: 3, rest: 4, calm: 3, ready: 3, surge: 4, repair: 5, combo: 4, two: 3,
  dsb: 3, gate: 3, check: 3, divide: 3, cell: 4, upMito: 3, upEnzyme: 3, upLyso: 3, kick: 5, recycle: 4, fact: 8, end: 4,
};

/** Every moment's lines in the page's language. */
export function lines(): Readonly<Record<Moment, readonly string[]>> {
  const out = {} as Record<Moment, string[]>;
  for (const m of MOMENTS) {
    out[m] = [];
    for (let i = 1; i <= LINE_COUNT[m]; i++) out[m].push(t(`say.${m}.${i}` as Key));
  }
  return out;
}
