/**
 * Motylarnia's data: the five gouache pigments (each with its own pattern for colour-blind
 * players), the egg tiers with their published odds, pity limits and pyłek values, the two v1
 * habitats, the host plants, and the 18 species — wing family, ground colours, markings in the
 * wing's polar coordinates (u across the wings from the forewing's leading edge to the hindwing's
 * inner edge, s from the body to the margin), the classic three-pigment recipe, the caterpillar
 * and the pupa.  Pure data: geometry lives in leaf.ts and wing.ts, drawing in paint.ts.
 */

export type PigmentPattern = 'dot' | 'stripe' | 'ring' | 'cross' | 'petal';

export interface Pigment {
  name: string;
  color: string;
  /** a darker shade for edges and patterns */
  dark: string;
  pattern: PigmentPattern;
  /** its step on the pentatonic ladder: eating dots plays a melody */
  note: number;
}

export const PIGMENTS: readonly Pigment[] = [
  { name: 'czerwień', color: '#E0453A', dark: '#9E2A22', pattern: 'dot', note: 0 },
  { name: 'ultramaryna', color: '#3A5BD9', dark: '#22378F', pattern: 'stripe', note: 2 },
  { name: 'żółcień', color: '#F2C230', dark: '#B58612', pattern: 'ring', note: 4 },
  { name: 'zieleń', color: '#2F9E7A', dark: '#1B6A50', pattern: 'cross', note: 1 },
  { name: 'purpura', color: '#C2408F', dark: '#82245E', pattern: 'petal', note: 3 },
];
export const RED = 0, BLUE = 1, YELLOW = 2, GREEN = 3, MAGENTA = 4;

export type TierIndex = 0 | 1 | 2 | 3;

export interface Tier {
  name: string;
  /** the album tile's class (styles.css .arcade-album) */
  cls: '' | 'rare' | 'epic' | 'legend';
  /** published share of wild eggs */
  odds: number;
  /** an egg of this tier or better hatches within this many eggs (0: none needed) */
  pity: number;
  /** pyłek for a duplicate butterfly of this tier */
  dup: number;
  /** pyłek that buys a missing species' egg of this tier */
  price: number;
  color: string;
}

export const TIERS: readonly Tier[] = [
  { name: 'Pospolity', cls: '', odds: 0.62, pity: 0, dup: 5, price: 40, color: '#6F8A4A' },
  { name: 'Rzadki', cls: 'rare', odds: 0.26, pity: 5, dup: 15, price: 120, color: '#3F66C9' },
  { name: 'Wyjątkowy', cls: 'epic', odds: 0.10, pity: 15, dup: 40, price: 300, color: '#8A44C2' },
  { name: 'Legendarny', cls: 'legend', odds: 0.02, pity: 28, dup: 100, price: 800, color: '#B98310' },
];

/** Aberrations rolled at emergence (×1.5 for a radiant butterfly), and their pity in butterflies. */
export const ABERRATION_ODDS = { gyn: 0.005, albino: 0.02, melanic: 0.02 } as const;
export const RADIANT_ABERRATION_BOOST = 1.5;
export const ABERRATION_PITY = 40;
export type Aberration = keyof typeof ABERRATION_ODDS;
export const ABERRATION_NAME: Record<Aberration, string> = { gyn: 'gynandromorf', albino: 'albinotyczna', melanic: 'melanistyczna' };

export type HabitatId = 'ogrod' | 'laka';
export interface Habitat { id: HabitatId; name: string; /** butterflies needed to open it */ unlock: number }
export const HABITATS: readonly Habitat[] = [
  { id: 'ogrod', name: 'Ogród', unlock: 0 },
  { id: 'laka', name: 'Łąka', unlock: 6 },
];

export type PlantId = 'pokrzywa' | 'kapusta' | 'rzezucha' | 'kruszyna' | 'koniczyna' | 'trawa' | 'szczaw' | 'fiolek' | 'przytulia' | 'marchew';

export interface PlantLook {
  name: string;
  /** "na pokrzywie" */
  on: string;
  /** leaf greens: shadow, body, light; the vein colour */
  dark: string;
  mid: string;
  light: string;
  vein: string;
}

export const PLANTS: Record<PlantId, PlantLook> = {
  pokrzywa: { name: 'pokrzywa', on: 'na pokrzywie', dark: '#4C7A34', mid: '#74A54A', light: '#A9CF74', vein: '#C3E08E' },
  kapusta: { name: 'kapusta', on: 'na kapuście', dark: '#4E7F68', mid: '#7FAE90', light: '#BCD8BD', vein: '#D9EBD2' },
  rzezucha: { name: 'rzeżucha', on: 'na rzeżusze', dark: '#5A8A3A', mid: '#86B858', light: '#C2DE8C', vein: '#D6EBA6' },
  kruszyna: { name: 'kruszyna', on: 'na kruszynie', dark: '#3F7A34', mid: '#68A84A', light: '#A8D27A', vein: '#C6E59A' },
  koniczyna: { name: 'koniczyna', on: 'na koniczynie', dark: '#3E7438', mid: '#64A04E', light: '#9ECB7A', vein: '#C2E0A2' },
  trawa: { name: 'trawa', on: 'na trawie', dark: '#55913A', mid: '#7FBA50', light: '#BBDC82', vein: '#D2EAA0' },
  szczaw: { name: 'szczaw', on: 'na szczawiu', dark: '#557F33', mid: '#7FAE4C', light: '#B7D37A', vein: '#C98C6E' },
  fiolek: { name: 'fiołek', on: 'na fiołku', dark: '#3A6E37', mid: '#5E9A4C', light: '#96C478', vein: '#BCDDA0' },
  przytulia: { name: 'przytulia', on: 'na przytulii', dark: '#4A7E3A', mid: '#73AA52', light: '#ADD27E', vein: '#CBE6A2' },
  marchew: { name: 'marchew', on: 'na marchwi', dark: '#4F8638', mid: '#79B250', light: '#B2D77E', vein: '#CFE8A0' },
};

export type WingFamily = 'nymph' | 'pierid' | 'brimstone' | 'swallowtail' | 'lycaenid' | 'satyr' | 'skipper' | 'hawk' | 'burnet';

/** Wing markings in polar wing coordinates; sizes in half-wingspan units. */
export type Mark =
  | { k: 'eye'; u: number; s: number; r: number; rings: string[]; pupil?: string }
  | { k: 'spot'; u: number; s: number; r: number; c: string }
  | { k: 'sector'; u0: number; u1: number; s0: number; s1: number; c: string; soft?: number }
  | { k: 'chain'; u0: number; u1: number; s: number; n: number; r: number; c: string; shape?: 'dot' | 'lune' | 'tri' }
  | { k: 'bar'; u: number; s0: number; s1: number; w: number; c: string }
  | { k: 'band'; pts: [number, number][]; w: number; c: string };

export interface WingLook {
  fore: string;
  hind: string;
  marks: Mark[];
}

export interface Larva {
  body: string;
  belly: string;
  accent: string;
  pattern: 'dots' | 'stripe' | 'bands' | 'spines' | 'plain';
  head: string;
  horn?: boolean;
}

export interface Pupa { kind: 'hanging' | 'girdled'; color: string; accent: string }

export interface Species {
  id: string;
  name: string;
  habitat: HabitatId;
  tier: TierIndex;
  plant: PlantId;
  /** typical wingspan (mm): a well-fed XL butterfly may pass the top a little */
  span: [number, number];
  family: WingFamily;
  /** the male / default look; `female` overrides it (gynandromorphs show both) */
  look: WingLook;
  female?: Partial<WingLook>;
  /** dark scales at the wing base, the veins, the margin fringe, the body */
  dust: string;
  vein: string;
  fringe: string;
  body: string;
  /** the three pigments of "Forma klasyczna" (printed on the card) */
  classic: [number, number, number];
  larva: Larva;
  pupa: Pupa;
}

const ALL = { u0: 0, u1: 1 };
const border = (s0: number, c: string, u0 = 0, u1 = 1): Mark => ({ k: 'sector', u0, u1, s0, s1: 1.08, c });

export const SPECIES: readonly Species[] = [
  // ── Ogród ───────────────────────────────────────────────────────
  {
    id: 'bielinek', name: 'bielinek kapustnik', habitat: 'ogrod', tier: 0, plant: 'kapusta', span: [50, 65], family: 'pierid',
    look: {
      fore: '#F4F1E7', hind: '#F1EEE2',
      marks: [
        { k: 'sector', u0: 0, u1: 0.2, s0: 0.64, s1: 1.08, c: '#2A2A2D', soft: 0.025 },
        { k: 'spot', u: 0.52, s: 0.6, r: 0.04, c: '#3A3A3C' },
      ],
    },
    female: {
      marks: [
        { k: 'sector', u0: 0, u1: 0.2, s0: 0.64, s1: 1.08, c: '#2A2A2D', soft: 0.025 },
        { k: 'spot', u: 0.2, s: 0.56, r: 0.05, c: '#2E2E30' },
        { k: 'spot', u: 0.34, s: 0.52, r: 0.045, c: '#2E2E30' },
        { k: 'bar', u: 0.44, s0: 0.38, s1: 0.6, w: 0.035, c: '#3A3A3C' },
        { k: 'spot', u: 0.52, s: 0.6, r: 0.04, c: '#3A3A3C' },
      ],
    },
    dust: 'rgba(55,55,60,.42)', vein: 'rgba(70,70,74,.45)', fringe: '#E9E6DC', body: '#2B2A2C',
    classic: [BLUE, YELLOW, GREEN],
    larva: { body: '#A4BC4E', belly: '#D9D66C', accent: '#1E1E1E', pattern: 'dots', head: '#55612C' },
    pupa: { kind: 'girdled', color: '#BCC47E', accent: '#2A2A2A' },
  },
  {
    id: 'zorzynek', name: 'zorzynek rzeżuchowiec', habitat: 'ogrod', tier: 1, plant: 'rzezucha', span: [35, 48], family: 'pierid',
    look: {
      fore: '#F7F5EE', hind: '#F2F2E7',
      marks: [
        { k: 'sector', u0: 0, u1: 0.34, s0: 0.5, s1: 1.08, c: '#F07A1C', soft: 0.035 },
        { k: 'sector', u0: 0, u1: 0.13, s0: 0.86, s1: 1.08, c: '#3A3532' },
        { k: 'spot', u: 0.3, s: 0.42, r: 0.032, c: '#2C2A28' },
        { k: 'chain', u0: 0.56, u1: 0.95, s: 0.56, n: 5, r: 0.075, c: 'rgba(116,148,92,.34)' },
        { k: 'chain', u0: 0.6, u1: 0.93, s: 0.82, n: 4, r: 0.065, c: 'rgba(116,148,92,.3)' },
      ],
    },
    female: {
      marks: [
        { k: 'sector', u0: 0, u1: 0.15, s0: 0.82, s1: 1.08, c: '#3A3532', soft: 0.02 },
        { k: 'spot', u: 0.3, s: 0.42, r: 0.032, c: '#2C2A28' },
        { k: 'chain', u0: 0.56, u1: 0.95, s: 0.56, n: 5, r: 0.075, c: 'rgba(116,148,92,.34)' },
        { k: 'chain', u0: 0.6, u1: 0.93, s: 0.82, n: 4, r: 0.065, c: 'rgba(116,148,92,.3)' },
      ],
    },
    dust: 'rgba(60,62,58,.38)', vein: 'rgba(90,92,86,.3)', fringe: '#EFEDE4', body: '#2E2C2A',
    classic: [RED, YELLOW, GREEN],
    larva: { body: '#7EA46E', belly: '#B6CDA3', accent: '#F4F4EA', pattern: 'stripe', head: '#6A8C5A' },
    pupa: { kind: 'girdled', color: '#A2B47E', accent: '#E6DEC0' },
  },
  {
    id: 'pawik', name: 'rusałka pawik', habitat: 'ogrod', tier: 0, plant: 'pokrzywa', span: [50, 60], family: 'nymph',
    look: {
      fore: '#A8302A', hind: '#9C2B27',
      marks: [
        border(0.93, '#4C3026'),
        { k: 'bar', u: 0.05, s0: 0.34, s1: 0.56, w: 0.06, c: '#2A1C18' },
        { k: 'spot', u: 0.05, s: 0.6, r: 0.032, c: '#E9D9A6' },
        { k: 'eye', u: 0.14, s: 0.75, r: 0.15, rings: ['#EAD8A2', '#5A2A22', '#5A78C8', '#1E191C'], pupil: '#B4C8F2' },
        { k: 'eye', u: 0.67, s: 0.6, r: 0.17, rings: ['#E4DACA', '#262126', '#6B82B9', '#373C52'], pupil: '#DAE3F4' },
      ],
    },
    dust: 'rgba(52,24,18,.6)', vein: 'rgba(60,20,15,.28)', fringe: '#5A3A2E', body: '#2A1F1C',
    classic: [RED, BLUE, YELLOW],
    larva: { body: '#1C1C21', belly: '#2E2C32', accent: '#F2F2F2', pattern: 'spines', head: '#121214' },
    pupa: { kind: 'hanging', color: '#8E8B6A', accent: '#D8B24A' },
  },
  {
    id: 'pokrzywnik', name: 'rusałka pokrzywnik', habitat: 'ogrod', tier: 0, plant: 'pokrzywa', span: [40, 50], family: 'nymph',
    look: {
      fore: '#E06E28', hind: '#D9652A',
      marks: [
        { k: 'sector', u0: 0.5, u1: 1, s0: 0, s1: 0.52, c: '#3A2A22', soft: 0.05 },
        { k: 'bar', u: 0.035, s0: 0.3, s1: 0.45, w: 0.075, c: '#231A16' },
        { k: 'spot', u: 0.05, s: 0.49, r: 0.035, c: '#F2D25A' },
        { k: 'bar', u: 0.045, s0: 0.53, s1: 0.67, w: 0.075, c: '#231A16' },
        { k: 'spot', u: 0.06, s: 0.71, r: 0.03, c: '#F2D25A' },
        { k: 'bar', u: 0.06, s0: 0.75, s1: 0.86, w: 0.06, c: '#231A16' },
        { k: 'spot', u: 0.04, s: 0.93, r: 0.024, c: '#F4EDE0' },
        { k: 'spot', u: 0.3, s: 0.4, r: 0.045, c: '#231A16' },
        { k: 'spot', u: 0.36, s: 0.6, r: 0.04, c: '#231A16' },
        border(0.9, '#2D211C'),
        { k: 'chain', u0: 0.06, u1: 0.98, s: 0.935, n: 11, r: 0.022, c: '#4D6FD1', shape: 'lune' },
      ],
    },
    dust: 'rgba(50,30,20,.6)', vein: 'rgba(60,30,15,.25)', fringe: '#3A2A22', body: '#2C221D',
    classic: [RED, YELLOW, MAGENTA],
    larva: { body: '#242024', belly: '#3A3438', accent: '#E9C43A', pattern: 'stripe', head: '#161616' },
    pupa: { kind: 'hanging', color: '#9A8A62', accent: '#D9B44A' },
  },
  {
    id: 'admiral', name: 'rusałka admirał', habitat: 'ogrod', tier: 1, plant: 'pokrzywa', span: [55, 65], family: 'nymph',
    look: {
      fore: '#221D1E', hind: '#1F1B1C',
      marks: [
        { k: 'band', pts: [[0.06, 0.42], [0.17, 0.5], [0.3, 0.6], [0.42, 0.7]], w: 0.11, c: '#D9452B' },
        { k: 'spot', u: 0.03, s: 0.72, r: 0.03, c: '#F2EEE6' },
        { k: 'spot', u: 0.07, s: 0.8, r: 0.04, c: '#F2EEE6' },
        { k: 'spot', u: 0.13, s: 0.86, r: 0.03, c: '#F2EEE6' },
        { k: 'spot', u: 0.17, s: 0.74, r: 0.026, c: '#F2EEE6' },
        { k: 'sector', u0: 0.55, u1: 0.97, s0: 0.77, s1: 0.93, c: '#D9452B' },
        { k: 'chain', u0: 0.62, u1: 0.9, s: 0.85, n: 4, r: 0.02, c: '#1F1B1C' },
        { k: 'spot', u: 0.95, s: 0.86, r: 0.035, c: '#5A73C8' },
      ],
    },
    dust: 'rgba(10,10,10,.35)', vein: 'rgba(255,255,255,.07)', fringe: '#F0ECE4', body: '#1E1A1A',
    classic: [RED, BLUE, MAGENTA],
    larva: { body: '#3A3236', belly: '#5A4E50', accent: '#E8D27A', pattern: 'spines', head: '#222222' },
    pupa: { kind: 'hanging', color: '#7E6E5E', accent: '#C9A64A' },
  },
  {
    id: 'cytrynek', name: 'cytrynek', habitat: 'ogrod', tier: 0, plant: 'kruszyna', span: [50, 60], family: 'brimstone',
    look: {
      fore: '#F3DA3A', hind: '#EFD43E',
      marks: [
        { k: 'spot', u: 0.3, s: 0.46, r: 0.03, c: '#E5791F' },
        { k: 'spot', u: 0.7, s: 0.46, r: 0.036, c: '#E5791F' },
      ],
    },
    female: { fore: '#E8EFCF', hind: '#E3EBCA' },
    dust: 'rgba(130,112,20,.2)', vein: 'rgba(150,128,30,.38)', fringe: '#D8B72E', body: '#5A5A2E',
    classic: [YELLOW, GREEN, MAGENTA],
    larva: { body: '#6FA04A', belly: '#A9C97A', accent: '#EEF3D9', pattern: 'stripe', head: '#5E8A3E' },
    pupa: { kind: 'girdled', color: '#8DB45A', accent: '#C9DC8A' },
  },
  {
    id: 'ikar', name: 'modraszek ikar', habitat: 'ogrod', tier: 0, plant: 'koniczyna', span: [25, 35], family: 'lycaenid',
    look: {
      fore: '#7387E3', hind: '#6E83DF',
      marks: [border(0.95, '#2B2E4A')],
    },
    female: {
      fore: '#7B5B40', hind: '#765840',
      marks: [
        { k: 'sector', ...ALL, s0: 0, s1: 0.32, c: 'rgba(110,130,220,.5)', soft: 0.05 },
        border(0.95, '#4A3626'),
        { k: 'chain', u0: 0.06, u1: 0.96, s: 0.87, n: 9, r: 0.03, c: '#F08A2A', shape: 'lune' },
      ],
    },
    dust: 'rgba(40,40,90,.3)', vein: 'rgba(30,30,70,.25)', fringe: '#F4F4F0', body: '#2E3046',
    classic: [BLUE, YELLOW, MAGENTA],
    larva: { body: '#7FA65A', belly: '#A8C878', accent: '#C4DA94', pattern: 'plain', head: '#3D3D2D' },
    pupa: { kind: 'girdled', color: '#9AA86A', accent: '#C2C88A' },
  },
  {
    id: 'paz', name: 'paź królowej', habitat: 'ogrod', tier: 3, plant: 'marchew', span: [65, 80], family: 'swallowtail',
    look: {
      fore: '#F1D24E', hind: '#EFCE4A',
      marks: [
        { k: 'sector', ...ALL, s0: 0, s1: 0.24, c: '#1E1A16', soft: 0.04 },
        { k: 'bar', u: 0.025, s0: 0.26, s1: 0.37, w: 0.07, c: '#1E1A16' },
        { k: 'bar', u: 0.035, s0: 0.43, s1: 0.53, w: 0.065, c: '#1E1A16' },
        { k: 'bar', u: 0.045, s0: 0.59, s1: 0.67, w: 0.055, c: '#1E1A16' },
        border(0.76, '#1E1A16'),
        { k: 'chain', u0: 0.03, u1: 0.95, s: 0.9, n: 12, r: 0.026, c: '#F1D24E', shape: 'lune' },
        { k: 'chain', u0: 0.54, u1: 0.9, s: 0.8, n: 6, r: 0.03, c: '#5B7FD8' },
        { k: 'eye', u: 0.95, s: 0.72, r: 0.06, rings: ['#2A3A8A', '#D9452B'] },
      ],
    },
    dust: 'rgba(25,20,15,.75)', vein: 'rgba(22,17,12,.85)', fringe: '#F1D24E', body: '#1E1A16',
    classic: [RED, BLUE, GREEN],
    larva: { body: '#9CCB5E', belly: '#C2DE8E', accent: '#1B1B1B', pattern: 'bands', head: '#7DA84A' },
    pupa: { kind: 'girdled', color: '#A9B87A', accent: '#D9C77A' },
  },
  {
    id: 'fruczak', name: 'fruczak gołąbek', habitat: 'ogrod', tier: 2, plant: 'przytulia', span: [40, 50], family: 'hawk',
    look: {
      fore: '#7A6D5E', hind: '#E2892E',
      marks: [
        { k: 'band', pts: [[0.03, 0.36], [0.14, 0.4], [0.26, 0.35], [0.4, 0.4]], w: 0.03, c: '#3E352C' },
        { k: 'band', pts: [[0.03, 0.62], [0.14, 0.67], [0.26, 0.61], [0.4, 0.66]], w: 0.03, c: '#3E352C' },
        { k: 'spot', u: 0.22, s: 0.5, r: 0.022, c: '#2E2620' },
        { k: 'sector', u0: 0.5, u1: 1, s0: 0.82, s1: 1.08, c: '#4A3A2A' },
        { k: 'sector', u0: 0.5, u1: 1, s0: 0, s1: 0.3, c: '#5A4A3A', soft: 0.04 },
      ],
    },
    dust: 'rgba(60,50,40,.5)', vein: 'rgba(40,30,25,.22)', fringe: '#6A5E50', body: '#5E5246',
    classic: [RED, GREEN, MAGENTA],
    larva: { body: '#7FB04E', belly: '#A9CF7A', accent: '#F4F0C8', pattern: 'stripe', head: '#6E9A44', horn: true },
    pupa: { kind: 'girdled', color: '#B39A72', accent: '#8A7452' },
  },
  // ── Łąka ────────────────────────────────────────────────────────
  {
    id: 'polowiec', name: 'polowiec szachownica', habitat: 'laka', tier: 0, plant: 'trawa', span: [45, 55], family: 'satyr',
    look: {
      fore: '#F3EEDD', hind: '#F1ECDA',
      marks: [
        { k: 'sector', u0: 0, u1: 0.46, s0: 0, s1: 0.3, c: '#26221F', soft: 0.02 },
        { k: 'bar', u: 0.07, s0: 0.36, s1: 0.58, w: 0.085, c: '#26221F' },
        { k: 'bar', u: 0.24, s0: 0.5, s1: 0.63, w: 0.075, c: '#26221F' },
        { k: 'bar', u: 0.37, s0: 0.42, s1: 0.56, w: 0.065, c: '#26221F' },
        { k: 'sector', u0: 0.55, u1: 1, s0: 0.42, s1: 0.52, c: '#26221F', soft: 0.02 },
        border(0.72, '#26221F'),
        { k: 'chain', u0: 0.03, u1: 0.96, s: 0.84, n: 10, r: 0.036, c: '#F3EEDD' },
        { k: 'chain', u0: 0.62, u1: 0.94, s: 0.84, n: 4, r: 0.016, c: '#4E4886' },
      ],
    },
    dust: 'rgba(30,28,25,.55)', vein: 'rgba(30,28,25,.5)', fringe: '#F3EEDD', body: '#2A2622',
    classic: [BLUE, YELLOW, MAGENTA],
    larva: { body: '#9BAA6A', belly: '#BCC48E', accent: '#6E7A44', pattern: 'stripe', head: '#8A9A5A' },
    pupa: { kind: 'hanging', color: '#C9B98E', accent: '#9A8A62' },
  },
  {
    id: 'przestrojnik', name: 'przestrojnik trawnik', habitat: 'laka', tier: 0, plant: 'trawa', span: [40, 50], family: 'satyr',
    look: {
      fore: '#6E5238', hind: '#694E35',
      marks: [
        { k: 'sector', u0: 0.12, u1: 0.42, s0: 0.45, s1: 0.86, c: '#D98A3E', soft: 0.045 },
        { k: 'eye', u: 0.16, s: 0.76, r: 0.058, rings: ['#1E1610'], pupil: '#F4EBDD' },
        { k: 'sector', u0: 0.6, u1: 0.95, s0: 0.5, s1: 0.62, c: 'rgba(205,150,90,.35)', soft: 0.04 },
      ],
    },
    dust: 'rgba(40,28,18,.4)', vein: 'rgba(30,20,12,.25)', fringe: '#9A8266', body: '#3A2C20',
    classic: [RED, BLUE, YELLOW],
    larva: { body: '#86A85C', belly: '#AECB86', accent: '#E6EAC8', pattern: 'stripe', head: '#7C9A52' },
    pupa: { kind: 'hanging', color: '#9DB46A', accent: '#5E6E3A' },
  },
  {
    id: 'strzepotek', name: 'strzępotek ruczajnik', habitat: 'laka', tier: 0, plant: 'trawa', span: [25, 35], family: 'satyr',
    look: {
      fore: '#E1A14A', hind: '#DA9A48',
      marks: [
        border(0.88, '#9A8466'),
        { k: 'eye', u: 0.1, s: 0.8, r: 0.05, rings: ['#F0E2BF', '#2A1E14'], pupil: '#F5F0E6' },
      ],
    },
    dust: 'rgba(110,80,40,.35)', vein: 'rgba(90,60,25,.22)', fringe: '#C8B89A', body: '#5A4630',
    classic: [RED, YELLOW, MAGENTA],
    larva: { body: '#8FB65E', belly: '#B9D48A', accent: '#E8F0C4', pattern: 'stripe', head: '#7EA452' },
    pupa: { kind: 'hanging', color: '#9CC06A', accent: '#E0E8B8' },
  },
  {
    id: 'czerwonczyk', name: 'czerwończyk nieparek', habitat: 'laka', tier: 1, plant: 'szczaw', span: [30, 40], family: 'lycaenid',
    look: {
      fore: '#E9561F', hind: '#E4521F',
      marks: [
        border(0.94, '#2B1A14'),
        { k: 'spot', u: 0.3, s: 0.47, r: 0.034, c: '#2B1A14' },
        { k: 'bar', u: 0.33, s0: 0.42, s1: 0.55, w: 0.028, c: '#2B1A14' },
        { k: 'spot', u: 0.7, s: 0.45, r: 0.022, c: '#2B1A14' },
      ],
    },
    dust: 'rgba(90,30,10,.3)', vein: 'rgba(80,25,10,.2)', fringe: '#F2EDE2', body: '#3A2418',
    classic: [RED, GREEN, MAGENTA],
    larva: { body: '#7EA454', belly: '#A6C67C', accent: '#C2DA96', pattern: 'plain', head: '#3E3A2A' },
    pupa: { kind: 'girdled', color: '#A69A6E', accent: '#6E6448' },
  },
  {
    id: 'szlaczkon', name: 'szlaczkoń siarecznik', habitat: 'laka', tier: 1, plant: 'koniczyna', span: [40, 50], family: 'pierid',
    look: {
      fore: '#F0E49E', hind: '#ECDF96',
      marks: [
        { k: 'sector', u0: 0, u1: 0.42, s0: 0.8, s1: 1.08, c: '#3E3A2E', soft: 0.02 },
        { k: 'chain', u0: 0.05, u1: 0.38, s: 0.9, n: 4, r: 0.03, c: '#F0E49E' },
        { k: 'spot', u: 0.3, s: 0.45, r: 0.03, c: '#2E2B22' },
        { k: 'spot', u: 0.68, s: 0.45, r: 0.042, c: '#F2A14A' },
        { k: 'sector', u0: 0.5, u1: 1, s0: 0.92, s1: 1.08, c: '#5A553E' },
      ],
    },
    dust: 'rgba(110,110,60,.32)', vein: 'rgba(120,112,60,.3)', fringe: '#E6A6B8', body: '#4A4632',
    classic: [RED, YELLOW, GREEN],
    larva: { body: '#78A84E', belly: '#A6C87C', accent: '#F0E07A', pattern: 'stripe', head: '#6A9446' },
    pupa: { kind: 'girdled', color: '#9AC06A', accent: '#E8E09A' },
  },
  {
    id: 'dostojka', name: 'dostojka aglaja', habitat: 'laka', tier: 3, plant: 'fiolek', span: [50, 60], family: 'nymph',
    look: {
      fore: '#E2873A', hind: '#DE8238',
      marks: [
        { k: 'sector', ...ALL, s0: 0, s1: 0.22, c: '#4A2E18', soft: 0.04 },
        { k: 'chain', u0: 0.05, u1: 0.95, s: 0.36, n: 9, r: 0.026, c: '#2A1A10' },
        { k: 'chain', u0: 0.03, u1: 0.97, s: 0.58, n: 10, r: 0.029, c: '#2A1A10' },
        { k: 'chain', u0: 0.02, u1: 0.98, s: 0.77, n: 11, r: 0.026, c: '#2A1A10' },
        { k: 'chain', u0: 0.02, u1: 0.98, s: 0.93, n: 12, r: 0.03, c: '#2A1A10', shape: 'tri' },
        border(0.97, '#2A1A10'),
      ],
    },
    dust: 'rgba(60,35,15,.55)', vein: 'rgba(40,22,10,.4)', fringe: '#EADBC0', body: '#4A3020',
    classic: [BLUE, YELLOW, GREEN],
    larva: { body: '#222024', belly: '#3A3236', accent: '#E07A3A', pattern: 'spines', head: '#141414' },
    pupa: { kind: 'hanging', color: '#7A6650', accent: '#C9A65A' },
  },
  {
    id: 'karlatek', name: 'karłątek ryska', habitat: 'laka', tier: 0, plant: 'trawa', span: [24, 30], family: 'skipper',
    look: {
      fore: '#D98A30', hind: '#D4852F',
      marks: [border(0.92, '#4A3420')],
    },
    dust: 'rgba(90,60,25,.45)', vein: 'rgba(60,40,15,.5)', fringe: '#E8D2A8', body: '#6A4A26',
    classic: [YELLOW, GREEN, MAGENTA],
    larva: { body: '#8DBA5E', belly: '#B6D68A', accent: '#E4F0BE', pattern: 'stripe', head: '#C8C08A' },
    pupa: { kind: 'girdled', color: '#B8C88A', accent: '#8A9A5A' },
  },
  {
    id: 'argus', name: 'modraszek argus', habitat: 'laka', tier: 0, plant: 'koniczyna', span: [22, 28], family: 'lycaenid',
    look: {
      fore: '#5F7BD9', hind: '#5B77D4',
      marks: [border(0.85, '#22243A')],
    },
    female: {
      fore: '#6A5240', hind: '#664E3C',
      marks: [
        border(0.92, '#3E2E22'),
        { k: 'chain', u0: 0.5, u1: 0.96, s: 0.84, n: 6, r: 0.03, c: '#F08A2A', shape: 'lune' },
      ],
    },
    dust: 'rgba(30,34,70,.35)', vein: 'rgba(20,24,60,.25)', fringe: '#F6F6F2', body: '#262A40',
    classic: [BLUE, GREEN, MAGENTA],
    larva: { body: '#86AC5E', belly: '#ACC980', accent: '#5E7A3E', pattern: 'stripe', head: '#2E2E26' },
    pupa: { kind: 'girdled', color: '#A0B070', accent: '#C8CC90' },
  },
  {
    id: 'krasnik', name: 'kraśnik sześcioplamek', habitat: 'laka', tier: 2, plant: 'koniczyna', span: [30, 38], family: 'burnet',
    look: {
      fore: '#1F2C44', hind: '#C8232C',
      marks: [
        { k: 'spot', u: 0.06, s: 0.3, r: 0.05, c: '#D3242C' },
        { k: 'spot', u: 0.3, s: 0.32, r: 0.05, c: '#D3242C' },
        { k: 'spot', u: 0.08, s: 0.56, r: 0.056, c: '#D3242C' },
        { k: 'spot', u: 0.3, s: 0.58, r: 0.05, c: '#D3242C' },
        { k: 'spot', u: 0.1, s: 0.8, r: 0.054, c: '#D3242C' },
        { k: 'spot', u: 0.27, s: 0.82, r: 0.05, c: '#D3242C' },
        { k: 'sector', u0: 0.5, u1: 1, s0: 0.86, s1: 1.08, c: '#1F2C44' },
      ],
    },
    dust: 'rgba(10,15,30,.4)', vein: 'rgba(90,120,170,.2)', fringe: '#2A3650', body: '#141C2C',
    classic: [RED, BLUE, MAGENTA],
    larva: { body: '#E8D45A', belly: '#F2E48A', accent: '#1E1E1E', pattern: 'dots', head: '#2A2A2A' },
    pupa: { kind: 'girdled', color: '#EADB8A', accent: '#C8B45A' },
  },
];

export const speciesById = (id: string): Species => SPECIES.find(s => s.id === id) ?? SPECIES[2];

/** Polish title case for the start of a line ("Rusałka pawik"). */
export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** The Polish noun form for a count: 1 motyl, 2–4 motyle (22–24…), 5+ motyli. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10, t = n % 100;
  return d >= 2 && d <= 4 && (t < 10 || t >= 20) ? few : many;
}

/**
 * The size classes: the eaten share of the leaf at which each starts.  Calibrated with a steering bot
 * in the tests: base appetite eats ~10 % of a leaf (S), chance-level focus ~17–23 % (M), held focus
 * ~29 % (L), full focus steered through fresh leaf ~35 % (XL).
 */
export const SIZE_CLASSES = ['S', 'M', 'L', 'XL'] as const;
export type SizeClass = (typeof SIZE_CLASSES)[number];
export const CLASS_FROM = [0, 0.14, 0.24, 0.32] as const;
/** a dropped chrysalis (too little reliable signal) gives middling colours at least */
export const NEUTRAL_DEPTH = 0.5;
/** each dmuchawiec adds this much to the eaten share (size, not area) */
export const DANDELION_BONUS = 0.04;
/** pyłek from a malina */
export const RASPBERRY_POLLEN = 4;
