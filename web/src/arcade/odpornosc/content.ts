/**
 * Odporność's data (DESIGN.md §13.9): the six stages of a loop in their real order, the loops (where
 * the infection comes in and which pathogens it brings), the pathogens the memory keeps, the "Wiedza"
 * fact cards — each with one real number and its source — the cells that join with play, the coach
 * marks, the strategies under a block's name and Neo's moments.  The words are in i18n.ts.
 *
 * Accuracy rules (§13.3): every process shown is real and in its real order; every number on a card
 * is sourced here (and in DESIGN §13.9); time is compressed and the cards say so; no disease is named
 * and nothing claims that playing heals.
 */
import type { PassageId } from '../kit/scripture';
import { t, type Key } from './i18n';

// ── the stages of a loop ─────────────────────────────────────────────────────────────
export type StageId = 'alarm' | 'recruit' | 'hunt' | 'antibodies' | 'tcells' | 'heal';
export const STAGES: readonly StageId[] = ['alarm', 'recruit', 'hunt', 'antibodies', 'tcells', 'heal'];

export const stageName = (s: StageId): string => t(`stage.${s}` as Key);
/** what really happens and how long it really takes ("Naprawdę: …"), for the stage card */
export const stageReal = (s: StageId): string => t(`stage.${s}.real` as Key);
export const stageText = (s: StageId): string => t(`stage.${s}.text` as Key);

// ── pathogens and loops ──────────────────────────────────────────────────────────────
export type PathogenId = 'ziarniaki' | 'laseczki' | 'paleczki' | 'rinoA' | 'rinoB' | 'rinoC';
export const PATHOGENS: readonly PathogenId[] = ['ziarniaki', 'laseczki', 'paleczki', 'rinoA', 'rinoB', 'rinoC'];
export type BugShape = 'coccus' | 'rod' | 'swimmer';

export interface PathogenSpec {
  id: PathogenId;
  virus: boolean;
  shape: BugShape;
  /** body colour, its dark edge and its light */
  body: string;
  edge: string;
  light: string;
}

export const PATHOGEN: Readonly<Record<PathogenId, PathogenSpec>> = {
  // round skin bacteria in grape-like clusters (cocci, ~1 µm: Monteiro 2015)
  ziarniaki: { id: 'ziarniaki', virus: false, shape: 'coccus', body: '#9ad66b', edge: '#4f8a2c', light: '#d8f5b0' },
  // rods from soil and grit, many in a slippery capsule
  laseczki: { id: 'laseczki', virus: false, shape: 'rod', body: '#e3c94f', edge: '#9a7a18', light: '#fff1a8' },
  // gut rods that swim with flagella (run and tumble)
  paleczki: { id: 'paleczki', virus: false, shape: 'swimmer', body: '#7fd3c4', edge: '#2f8a7c', light: '#c9fff4' },
  // cold viruses (rhinoviruses: 30–50 % of colds, Heikkinen 2003), three kinds: memory is per kind
  rinoA: { id: 'rinoA', virus: true, shape: 'coccus', body: '#b07cff', edge: '#5b2fae', light: '#e6d4ff' },
  rinoB: { id: 'rinoB', virus: true, shape: 'coccus', body: '#ff8fc8', edge: '#a8306e', light: '#ffd8ee' },
  rinoC: { id: 'rinoC', virus: true, shape: 'coccus', body: '#8fa8ff', edge: '#3446a8', light: '#d8e0ff' },
};

export const pathogenName = (id: PathogenId): string => t(`path.${id}` as Key);
export const pathogenText = (id: PathogenId): string => t(`path.${id}.text` as Key);

export type PlaceId = 'palec' | 'kolano' | 'jelito';
export interface LoopSpec { place: PlaceId; bug: PathogenId; virus: PathogenId }

/** The loops in turn: a splinter in a fingertip, a scraped knee, a breach in the gut lining; then again, harder. */
export const LOOPS: readonly LoopSpec[] = [
  { place: 'palec', bug: 'ziarniaki', virus: 'rinoA' },
  { place: 'kolano', bug: 'laseczki', virus: 'rinoB' },
  { place: 'jelito', bug: 'paleczki', virus: 'rinoC' },
];

export const loopSpec = (loop: number): LoopSpec => LOOPS[(Math.max(1, Math.floor(loop)) - 1) % LOOPS.length];
export const placeName = (id: PlaceId): string => t(`place.${id}` as Key);

// ── "Wiedza": one real number per card, with its source ──────────────────────────────
export type FactId =
  | 'metchnikoff' | 'tlr' | 'cxcl8' | 'szpik' | 'procent' | 'toczenie' | 'diapedeza' | 'pelzanie' | 'fagocytoza' | 'apetyt'
  | 'zycie' | 'wybuch' | 'siec' | 'roj' | 'dendrytyczna' | 'plazmatyczna' | 'pamiec' | 'igg' | 'dopelniacz' | 'perforyna'
  | 'ctl' | 'nk' | 'rinowirus' | 'podzial' | 'efferocytoza' | 'kolagen' | 'fazy' | 'blizna' | 'tcr' | 'pamiecDluga';

export interface Fact {
  id: FactId;
  /** the stage the card belongs to (the panel groups them) */
  stage: StageId;
  /** the source, language-neutral (authors, year, journal, PMID) */
  src: string;
}

export const FACTS: readonly Fact[] = [
  { id: 'metchnikoff', stage: 'alarm', src: 'Cavaillon 2021, J Venom Anim Toxins 27:e20200147 (PMID 33889184); Kaufmann 2019, Front Immunol 10:684 (PMID 31001278)' },
  { id: 'tlr', stage: 'alarm', src: 'Kawai & Akira 2010, Nat Immunol 11:373 (PMID 20404851)' },
  { id: 'cxcl8', stage: 'alarm', src: 'Cambier et al. 2023, Cell Mol Immunol 20:217 (PMID 36725964)' },
  { id: 'szpik', stage: 'recruit', src: 'Summers et al. 2010, Trends Immunol 31:318 (PMID 20620114)' },
  { id: 'procent', stage: 'recruit', src: 'Mestas & Hughes 2004, J Immunol 172:2731 (PMID 14978070)' },
  { id: 'toczenie', stage: 'recruit', src: 'Phillipson et al. 2006, J Exp Med 203:2569 (PMID 17116736); Ley et al. 2007, Nat Rev Immunol 7:678 (PMID 17717539)' },
  { id: 'diapedeza', stage: 'recruit', src: 'Proebstl et al. 2012, J Exp Med 209:1219 (PMID 22615129)' },
  { id: 'pelzanie', stage: 'hunt', src: 'Lämmermann et al. 2013, Nature 498:371 (PMID 23708969)' },
  { id: 'fagocytoza', stage: 'hunt', src: 'Segal 2005, Annu Rev Immunol 23:197 (PMID 15771570)' },
  { id: 'apetyt', stage: 'hunt', src: 'Guyton & Hall, Textbook of Medical Physiology, 12th ed. (2011), ch. 33' },
  { id: 'zycie', stage: 'hunt', src: 'Lahoz-Beneytez et al. 2016, Blood 127:3431 (PMID 27136946)' },
  { id: 'wybuch', stage: 'hunt', src: 'Winterbourn et al. 2016, Annu Rev Biochem 85:765 (PMID 27050287); Segal 2005 (PMID 15771570)' },
  { id: 'siec', stage: 'hunt', src: 'Brinkmann et al. 2004, Science 303:1532 (PMID 15001782); Yipp et al. 2012, Nat Med 18:1386 (PMID 22922410)' },
  { id: 'roj', stage: 'hunt', src: 'Lämmermann et al. 2013, Nature 498:371 (PMID 23708969)' },
  { id: 'podzial', stage: 'hunt', src: 'Gibson et al. 2018, Proc R Soc B 285:20180789 (PMID 29899074)' },
  { id: 'dendrytyczna', stage: 'antibodies', src: 'Hayes et al. 2019, Front Immunol 10:598 (PMID 31024523)' },
  { id: 'plazmatyczna', stage: 'antibodies', src: 'Hibi & Dosch 1986, Eur J Immunol 16:139 (PMID 2869953)' },
  { id: 'dopelniacz', stage: 'antibodies', src: 'Merle et al. 2015, Front Immunol 6:257 (PMID 26074922); Ricklin et al. 2010, Nat Immunol 11:785 (PMID 20720586)' },
  { id: 'pamiec', stage: 'antibodies', src: 'Pollard & Bijker 2021, Nat Rev Immunol 21:83 (PMID 33353987)' },
  { id: 'igg', stage: 'antibodies', src: 'Morell et al. 1970, J Clin Invest 49:673 (PMID 5443170)' },
  { id: 'rinowirus', stage: 'tcells', src: 'Heikkinen & Järvinen 2003, Lancet 361:51 (PMID 12517470)' },
  { id: 'perforyna', stage: 'tcells', src: 'Lopez et al. 2013, Blood 121:2659 (PMID 23377437)' },
  { id: 'ctl', stage: 'tcells', src: 'Halle et al. 2016, Immunity 44:233 (PMID 26872694)' },
  { id: 'nk', stage: 'tcells', src: 'Kärre et al. 1986, Nature 319:675 (PMID 3951539)' },
  { id: 'tcr', stage: 'tcells', src: 'Qi et al. 2014, PNAS 111:13139 (PMID 25157137)' },
  { id: 'efferocytoza', stage: 'heal', src: 'Serhan & Savill 2005, Nat Immunol 6:1191 (PMID 16369558); Fadok et al. 1998, J Clin Invest 101:890 (PMID 9466984); Guyton & Hall, Textbook of Medical Physiology, 12th ed. (2011), ch. 33' },
  { id: 'fazy', stage: 'heal', src: 'Landén et al. 2016, Cell Mol Life Sci 73:3861 (PMID 27180275)' },
  { id: 'kolagen', stage: 'heal', src: 'Shoulders & Raines 2009, Annu Rev Biochem 78:929 (PMID 19344236)' },
  { id: 'blizna', stage: 'heal', src: 'Landén et al. 2016, Cell Mol Life Sci 73:3861 (PMID 27180275); Wilkinson & Hardman 2020, Open Biol 10:200223 (PMID 32993416)' },
  { id: 'pamiecDluga', stage: 'heal', src: 'Amanna et al. 2007, N Engl J Med 357:1903 (PMID 17989383)' },
];

export const FACT_IDS: readonly FactId[] = FACTS.map(f => f.id);
export const factTitle = (id: FactId): string => t(`fact.${id}` as Key);
export const factText = (id: FactId): string => t(`fact.${id}.text` as Key);
export const factSrc = (id: FactId): string => FACTS.find(f => f.id === id)?.src ?? '';

// ── cells that join with play ────────────────────────────────────────────────────────
export type UnlockId = 'tuczne' | 'nk' | 'monocyty' | 'szpik' | 'apetyt' | 'siec';

export interface UnlockSpec {
  id: UnlockId;
  /** pathogens cleared over all sessions; or the first T-cell stage done */
  total?: number;
  afterTcells?: boolean;
}

export const UNLOCKS: readonly UnlockSpec[] = [
  { id: 'tuczne', total: 40 },
  { id: 'nk', afterTcells: true },
  { id: 'monocyty', total: 200 },
  { id: 'szpik', total: 350 },
  { id: 'apetyt', total: 520 },
  { id: 'siec', total: 750 },
];

export const unlockName = (id: UnlockId): string => t(`unlock.${id}` as Key);
export const unlockText = (id: UnlockId): string => t(`unlock.${id}.text` as Key);

// ── coach marks and Neo's moments ────────────────────────────────────────────────────
export type Coach =
  | 'drag' | 'tap' | 'rings' | 'roll' | 'swarm' | 'burst' | 'net' | 'rest' | 'capsule' | 'tcell' | 'hidden' | 'collagen' | 'blind' | 'tidy';

/** where a coach mark points (the view turns it into a canvas point) */
export type CoachAt =
  | { kind: 'world'; x: number; y: number }
  | { kind: 'burst' }
  | { kind: 'net' }
  | { kind: 'free' };

export type Moment =
  | 'hello' | 'alarm' | 'pads' | 'recruit' | 'squeeze' | 'hunt' | 'gulp' | 'combo' | 'full' | 'burstReady' | 'burst' | 'net'
  | 'antibodies' | 'tag' | 'capsule' | 'tcells' | 'kill' | 'nk' | 'heal' | 'collagen' | 'closed' | 'push' | 'blind' | 'rest'
  | 'good' | 'memory' | 'divide' | 'loop' | 'grace' | 'tidy' | 'end';

export const MOMENTS: readonly Moment[] = [
  'hello', 'alarm', 'pads', 'recruit', 'squeeze', 'hunt', 'gulp', 'combo', 'full', 'burstReady', 'burst', 'net',
  'antibodies', 'tag', 'capsule', 'tcells', 'kill', 'nk', 'heal', 'collagen', 'closed', 'push', 'blind', 'rest',
  'good', 'memory', 'divide', 'loop', 'grace', 'tidy', 'end',
];

/** who says it: Neo (a young neutrophil) or Makro (the veteran tissue macrophage) */
export type Speaker = 'neo' | 'makro';
const MAKRO: ReadonlySet<Moment> = new Set<Moment>(['alarm', 'pads', 'heal', 'collagen', 'closed', 'tidy', 'grace']);
export const speakerOf = (m: Moment): Speaker => (MAKRO.has(m) ? 'makro' : 'neo');

/** each moment's lines in the page's language (i18n keys say.<moment>.1 … .n) */
function linesOf(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const k = `say.${m}.${i}` as Key;
    const s = t(k);
    if (s === k) break;
    out.push(s);
  }
  return out;
}

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(MOMENTS.map(m => [m, linesOf(m)])) as Record<Moment, string[]>;
export const LINE_COUNT = MOMENTS.reduce((s, m) => s + LINES[m].length, 0);

// ── the strategies under a block's name (imagery of the scene; one counting / recall in turn) ──
function tips(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const k = `${prefix}.${i}` as Key;
    const s = t(k);
    if (s === k) break;
    out.push(s);
  }
  return out;
}

export const TIPS = {
  warmup: tips('tip.warmup'),
  push: tips('tip.push'),
  blind: tips('tip.blind'),
  rest: tips('tip.rest'),
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
};

// ── the closing passages (DESIGN §13.5) ──────────────────────────────────────────────
export const ROOT: PassageId = 'psa103.2-3';
export const CLOSINGS = {
  /** a battle stage won with a burst or a net */
  defence: 'isa54.17' as PassageId,
  /** the wound closed: a cheerful heart */
  healed: 'pro17.22' as PassageId,
  /** the T cells kept watch, a memory formed */
  kept: 'psa121.7-8' as PassageId,
  /** a whole loop done */
  loop: 'exo23.25' as PassageId,
};
