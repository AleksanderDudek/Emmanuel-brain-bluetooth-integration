/**
 * What Światło ciała shows, as data: the nine stations of the scan from the crown to the soles, each a
 * real homeostatic loop (its set point and healthy range, an everyday push out of it, what the body does
 * to come back), the Wiedza cards (one real number per organ and depth, with its source), the depths of
 * the scan (organs → cells → systems), the strategies under a block's name and the guide's moments.
 * The words are in i18n.ts; the numbers here carry their sources (DESIGN.md §13.10 lists them in full).
 *
 * Honesty (DESIGN §13.3): the values at the organs are a typical healthy body's, the speed is
 * compressed and the game says so; the only measurement is the player's pulse from Mendi.
 */
import { fmtNum, lang } from '../../i18n';
import { t, type Key } from './i18n';

export type OrganId = 'brain' | 'lungs' | 'heart' | 'liver' | 'adrenal' | 'kidney' | 'gut' | 'skin' | 'bone';
/** the scan's order, head to toe */
export const ORGANS: readonly OrganId[] = ['brain', 'lungs', 'heart', 'liver', 'adrenal', 'kidney', 'gut', 'skin', 'bone'];

/** the scan's depths: organs, then cells, then systems (the paths between them) */
export type Depth = 1 | 2 | 3;
export const DEPTHS: readonly Depth[] = [1, 2, 3];

/** what the hands do at an organ: free taps, taps with the heart's beat, taps that breathe out CO₂ */
export type Task = 'tap' | 'beat' | 'bubbles';

/** how a loop's value reads */
export type ValueKind = 'temp' | 'ph' | 'bpm' | 'glucose' | 'curve' | 'sodium' | 'renew' | 'skinph' | 'calcium';

/** an everyday push out of the range: where the value starts (in the loop's base unit) */
export interface Kick { id: string; v0: number }

export interface OrganSpec {
  id: OrganId;
  /** the station's place on the figure's axis (0 crown … 1 soles) */
  v: number;
  task: Task;
  kind: ValueKind;
  /** set point and healthy range (base units: °C, pH, /min, mg/dL, × the day's curve, mmol/L, % renewed, pH, mmol/L) */
  set: number;
  lo: number;
  hi: number;
  kicks: readonly Kick[];
  /** the organ's colours: lit (warm, glowing) and resting (deep) */
  hue: string;
  deep: string;
  /** the sources of the loop's numbers (ids of SOURCES) */
  src: readonly string[];
}

export const ORGAN: Readonly<Record<OrganId, OrganSpec>> = {
  // the hypothalamus' preoptic area holds the core at 37 ± 0.5 °C (S1); sweat and wide skin vessels cool (S3, S4), narrow vessels and shivering warm (S5, S6)
  brain: { id: 'brain', v: 0.066, task: 'tap', kind: 'temp', set: 37, lo: 36.5, hi: 37.5, kicks: [{ id: 'bath', v0: 37.8 }, { id: 'cold', v0: 36.2 }], hue: '#ffd9f2', deep: '#6d4f86', src: ['S1', 'S3', 'S5'] },
  // blood pH 7.35–7.45 (S7); chemoreceptors read CO₂ and set the breath (S9)
  lungs: { id: 'lungs', v: 0.232, task: 'bubbles', kind: 'ph', set: 7.4, lo: 7.35, hi: 7.45, kicks: [{ id: 'hold', v0: 7.31 }, { id: 'fast', v0: 7.49 }], hue: '#ffd0c2', deep: '#8a4d5c', src: ['S7', 'S9'] },
  // a resting adult heart beats 60–100 a minute (S11); the vagus brakes the SA node (S12)
  heart: { id: 'heart', v: 0.27, task: 'beat', kind: 'bpm', set: 72, lo: 60, hi: 100, kicks: [{ id: 'stairs', v0: 118 }, { id: 'noise', v0: 110 }], hue: '#ff9fb0', deep: '#8c2f4a', src: ['S11', 'S12'] },
  // healthy fasting glucose 70–99 mg/dL (S17); insulin from β cells, glucagon from α cells (S19); glycogen in the liver (S18)
  liver: { id: 'liver', v: 0.33, task: 'tap', kind: 'glucose', set: 88, lo: 70, hi: 99, kicks: [{ id: 'meal', v0: 138 }, { id: 'walk', v0: 64 }], hue: '#ffcf8a', deep: '#86512c', src: ['S17', 'S18', 'S19'] },
  // cortisol follows the day (highest ~8 am, lowest after midnight, S20); its own feedback ends a rise (S22)
  adrenal: { id: 'adrenal', v: 0.362, task: 'tap', kind: 'curve', set: 1, lo: 0.8, hi: 1.2, kicks: [{ id: 'stress', v0: 1.62 }], hue: '#ffe39a', deep: '#86662a', src: ['S20', 'S22'] },
  // sodium 135–145 mmol/L (S26), ADH and thirst defend it (S26, S27)
  kidney: { id: 'kidney', v: 0.392, task: 'tap', kind: 'sodium', set: 140, lo: 135, hi: 145, kicks: [{ id: 'salty', v0: 148 }, { id: 'water', v0: 132 }], hue: '#e7b8ff', deep: '#5e3a86', src: ['S26', 'S27'] },
  // the gut's lining is renewed every ~3.5 days (S29): the share of renewed villus tips (a picture, no number shown)
  gut: { id: 'gut', v: 0.445, task: 'tap', kind: 'renew', set: 100, lo: 90, hi: 110, kicks: [{ id: 'busy', v0: 72 }], hue: '#ffc6a0', deep: '#87523a', src: ['S29'] },
  // the skin's natural surface pH is ~4.7; tap water raises it for up to ~6 h (S36)
  skin: { id: 'skin', v: 0.53, task: 'tap', kind: 'skinph', set: 4.7, lo: 4.4, hi: 5, kicks: [{ id: 'wash', v0: 5.8 }], hue: '#c6f5ff', deep: '#3c6d84', src: ['S36'] },
  // serum calcium 2.2–2.6 mmol/L (8.8–10.4 mg/dL), PTH from four parathyroids defends it (S33, S34)
  bone: { id: 'bone', v: 0.62, task: 'tap', kind: 'calcium', set: 2.4, lo: 2.2, hi: 2.6, kicks: [{ id: 'low', v0: 2.15 }], hue: '#f4f0ff', deep: '#6b6787', src: ['S33', 'S34'] },
};

/** The loop's deviation in half-ranges (|d| ≤ 1 inside the range), on the side the value is on. */
export function devOf(o: OrganSpec, v: number): number {
  return v >= o.set ? (v - o.set) / (o.hi - o.set) : -(o.set - v) / (o.set - o.lo);
}

/** The value at a deviation (the inverse of devOf). */
export function valOf(o: OrganSpec, d: number): number {
  return d >= 0 ? o.set + d * (o.hi - o.set) : o.set + d * (o.set - o.lo);
}

const NB = ' ';

/** Glucose in the page's language's habit: mg/dl in Polish and German labs, mmol/l in British and Swedish ones. */
export const glucoseMmol = (): boolean => lang === 'en' || lang === 'sv';

/** A loop's value as the panel shows it ("37,8 °C", "pH 7,31", "118/min", "138 mg/dl"); null where the picture speaks instead (cortisol, the gut). */
export function valueText(o: OrganSpec, v: number): string | null {
  switch (o.kind) {
    case 'temp': return `${fmtNum(v, 1)}${NB}°C`;
    case 'ph': return `pH${NB}${fmtNum(v, 2)}`;
    case 'bpm': return `${Math.round(v)}/min`;
    case 'glucose': return glucoseMmol() ? `${fmtNum(v / 18.016, 1)}${NB}${t('u.mmol')}` : `${Math.round(v)}${NB}mg/dl`;
    case 'sodium': return `${Math.round(v)}${NB}${t('u.mmol')}`;
    case 'skinph': return `pH${NB}${fmtNum(v, 1)}`;
    case 'calcium': return `${fmtNum(v, 2)}${NB}${t('u.mmol')}`;
    default: return null;
  }
}

/** The healthy range as the panel shows it ("36,5–37,5 °C"), or a word where no number is shown. */
export function rangeText(o: OrganSpec): string {
  const r = (a: number, b: number, digits: number, unit: string) => `${fmtNum(a, digits)}–${fmtNum(b, digits)}${unit ? `${NB}${unit}` : ''}`;
  switch (o.kind) {
    case 'temp': return r(o.lo, o.hi, 1, '°C');
    case 'ph': return `pH${NB}${r(o.lo, o.hi, 2, '')}`;
    case 'bpm': return `${o.lo}–${o.hi}/min`;
    case 'glucose': return glucoseMmol() ? r(3.9, 5.5, 1, t('u.mmol')) : `${o.lo}–${o.hi}${NB}mg/dl`;
    case 'sodium': return `${o.lo}–${o.hi}${NB}${t('u.mmol')}`;
    case 'skinph': return t('range.skin');
    case 'calcium': return r(o.lo, o.hi, 1, t('u.mmol'));
    case 'curve': return t('range.curve');
    case 'renew': return t('range.renew');
  }
}

// ── the sources (DESIGN.md §13.10 gives them in full) ─────────────
export const SOURCES: Readonly<Record<string, string>> = {
  S1: 'Osilla i in., StatPearls: Temperature Regulation (2023)',
  S2: 'Mackowiak i in., JAMA 1992;268:1578',
  S3: 'Charkoudian, Mayo Clin Proc 2003;78:603',
  S4: 'Baker, Temperature 2019;6:211',
  S5: 'Haman, Blondin, Temperature 2017;4:217',
  S6: 'Morrison, Nakamura, Annu Rev Physiol 2019;81:285',
  S7: 'Hopkins i in., StatPearls: Acid Base Balance (2022)',
  S8: 'Ochs i in., Am J Respir Crit Care Med 2004;169:120',
  S9: 'Brinkman i in., StatPearls: Respiratory Drive (2023)',
  S10: 'Russo i in., Breathe 2017;13:298',
  S11: 'Henning, Krawiec, StatPearls: Sinus Tachycardia (2023)',
  S12: 'Hafeez i in., StatPearls: Sinus Bradycardia (2026)',
  S13: 'Lehrer, Gevirtz, Front Psychol 2014;5:756',
  S14: 'Shaffer, Ginsberg, Front Public Health 2017;5:258',
  S15: 'Schandry, Psychophysiology 1981;18:483',
  S16: 'Berthoud, Neuhuber, Auton Neurosci 2000;85:1',
  S17: 'ADA, Standards of Care in Diabetes 2025, §2 i §6',
  S18: 'Jensen i in., Front Physiol 2011;2:112',
  S19: 'Kamel-ElSayed, Mukherjee, StatPearls: Pancreas (2023)',
  S20: 'Chourpiliadis, Aeddula, StatPearls: Glucocorticoids (2023)',
  S21: 'Stalder i in., Psychoneuroendocrinology 2016;63:414',
  S22: 'Smith, Vale, Dialogues Clin Neurosci 2006;8:383',
  S23: 'Berson i in., Science 2002;295:1070',
  S24: 'Kaufman i in., StatPearls: Glomerular Filtration Rate (2023)',
  S25: 'Bertram i in., Pediatr Nephrol 2011;26:1529',
  S26: 'Rout, Afzal; Sonani, Al-Dhahir, StatPearls (2023–2026)',
  S27: 'Cuzzo i in., StatPearls: Vasopressin (2023)',
  S28: 'Helander, Fändriks, Scand J Gastroenterol 2014;49:681',
  S29: 'Darwich i in., Drug Metab Dispos 2014;42:2016',
  S30: 'Sender i in., PLoS Biol 2016;14:e1002533',
  S31: 'Bergstresser, Taylor, Br J Dermatol 1977; Iizuka, J Dermatol Sci 1994',
  S32: 'Yousef i in., StatPearls: Epidermis (2024)',
  S33: 'Sahota i in., StatPearls: Calcium (2026)',
  S34: 'Lofrese i in., StatPearls: Parathyroid (2023)',
  S35: 'Surgeon General, Bone Health and Osteoporosis (2004)',
  S36: 'Lambers i in., Int J Cosmet Sci 2006;28:359',
};

/** A source line in the page's language ("i in." is Polish for "et al."). */
export function sourceText(id: string): string {
  const s = SOURCES[id] ?? id;
  return lang === 'pl' ? s : s.replace(/ i in\./g, lang === 'de' ? ' u. a.' : lang === 'sv' ? ' m.fl.' : ' et al.').replace(/ i §/g, lang === 'de' ? ' und §' : lang === 'sv' ? ' och §' : ' and §');
}

/**
 * The Wiedza cards: one per organ and depth, each a plain sentence with one real number (or two) and its
 * source.  The texts are `fact.<organ>.<depth>` in i18n.ts.
 */
export const FACT_SRC: Readonly<Record<OrganId, readonly [string, string, string]>> = {
  brain: ['S1', 'S2', 'S3'],
  lungs: ['S8', 'S7', 'S10'],
  heart: ['S11', 'S12', 'S13'],
  liver: ['S17', 'S18', 'S19'],
  adrenal: ['S20', 'S21', 'S22'],
  kidney: ['S24', 'S25', 'S26'],
  gut: ['S28', 'S29', 'S30'],
  skin: ['S36', 'S31', 'S4'],
  bone: ['S33', 'S35', 'S34'],
};

export const cardId = (o: OrganId, d: Depth): string => `${o}:${d}`;
export const ALL_CARDS: readonly string[] = ORGANS.flatMap(o => DEPTHS.map(d => cardId(o, d)));

export const organName = (o: OrganId): string => t(`organ.${o}` as Key);
export const organWhat = (o: OrganId): string => t(`what.${o}` as Key);
export const depthName = (d: Depth): string => t(`depth.${d}` as Key);
export const kickText = (o: OrganId, kick: string): string => t(`kick.${o}.${kick}` as Key);
export const fixText = (o: OrganId, kick: string): string => t(`fix.${o}.${kick}` as Key);
export const factText = (o: OrganId, d: Depth): string => t(`fact.${o}.${d}` as Key);
export const factSource = (o: OrganId, d: Depth): string => sourceText(FACT_SRC[o][d - 1]);

// ── the strategies under a block's name (imagery of the scene, one counting and one recall among them) ──
export const TIPS = {
  warmup: ['tip.warmup.1'] as Key[],
  firstPush: 'tip.firstPush' as Key,
  firstRest: 'tip.firstRest' as Key,
  push: ['tip.push.1', 'tip.push.2', 'tip.push.3', 'tip.push.4', 'tip.push.5', 'tip.push.6'] as Key[],
  blind: ['tip.blind.1', 'tip.blind.2'] as Key[],
  rest: ['tip.rest.1', 'tip.rest.2', 'tip.rest.3', 'tip.rest.4'] as Key[],
};

// ── the guide's moments (Zofia: calm, kind, a soft humour) ──────────
export type Moment =
  | 'open' | 'warm' | 'scan' | 'push' | 'rest' | 'blind' | 'blindEnd' | 'good' | 'nosignal'
  | 'balanced' | 'golden' | 'rhythm' | 'breath' | 'pulse' | 'slower' | 'scanDone' | 'depth' | 'end' | 'idle'
  | `at.${OrganId}`;

export const MOMENTS: readonly Moment[] = [
  'open', 'warm', 'scan', 'push', 'rest', 'blind', 'blindEnd', 'good', 'nosignal', 'balanced', 'golden', 'rhythm', 'breath',
  'pulse', 'slower', 'scanDone', 'depth', 'end', 'idle', ...ORGANS.map(o => `at.${o}` as Moment),
];

/** How many variants each moment has in the catalogs (`say.<moment>.<n>`). */
export const LINE_COUNT: Readonly<Record<Moment, number>> = Object.fromEntries(MOMENTS.map(m => [m, 3])) as Record<Moment, number>;

/** A moment's lines in the page's language. */
export function linesOf(m: Moment): string[] {
  const out: string[] = [];
  for (let i = 1; i <= LINE_COUNT[m]; i++) out.push(t(`say.${m}.${i}` as Key));
  return out;
}

/** The day's organ (the same for everyone today): settling it pays double. */
export const dayOrgan = (daySeed: number): OrganId => ORGANS[(daySeed >>> 0) % ORGANS.length];

/**
 * Cortisol's typical day (S20, S21): relative to its daily mean, highest about 8 am, lowest between
 * midnight and 4 am, with the rise after waking — a smooth picture of the shape, no units.
 */
export function cortisolCurve(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  // a peak in the morning and a slow fall through the day to the night's low
  const morning = Math.exp(-((h - 8) ** 2) / (2 * 1.6 ** 2));
  const day = h >= 8 ? Math.max(0, 1 - (h - 8) / 16) : Math.max(0, (h - 3) / 5);
  return 0.15 + 0.55 * morning + 0.35 * day;
}
