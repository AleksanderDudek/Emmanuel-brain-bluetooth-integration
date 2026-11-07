/**
 * Urodzaj's data: the ladder of eleven fruits of the good land (Suika's circle, ours: olive to the
 * great cluster of Eshcol, Numbers 13:23), the drop odds, the festivals with their missions and the
 * table's decorations, the strategies for the blocks, and Feliks the sparrow's lines for every moment.
 * Everything a designer may tune without touching the rules (sim.ts); the words live in i18n.ts.
 */
import { t, type Key } from './i18n';

export type FruitKind = 'olive' | 'grape' | 'date' | 'fig' | 'apricot' | 'apple' | 'pomegranate' | 'quince' | 'melon' | 'watermelon' | 'cluster';

export interface Fruit {
  tier: number;
  kind: FruitKind;
  /** radius in W */
  r: number;
  /** points for making it by a merge: Suika's triangular ladder T(k) = k(k + 1) / 2 */
  pts: number;
  /** as inside a sentence ("Pierwszy raz: figa") */
  name: string;
  base: string;
  dark: string;
  light: string;
}

const KINDS: readonly FruitKind[] = ['olive', 'grape', 'date', 'fig', 'apricot', 'apple', 'pomegranate', 'quince', 'melon', 'watermelon', 'cluster'];

/** Suika's proportions (a clone's 24…192 px on a 640 px box), and our own colours. */
const LOOK: readonly [number, string, string, string][] = [
  [24, '#6f7a2c', '#434a14', '#a3ad5a'],    // olive
  [32, '#7d3f8c', '#4c1f5a', '#b27cc0'],    // grape
  [40, '#b8742c', '#7a4514', '#e3a862'],    // date
  [56, '#7a4a6e', '#4a2442', '#b07ca2'],    // fig
  [64, '#f09a3a', '#b8611a', '#ffc879'],    // apricot
  [72, '#d8402e', '#93231a', '#ff8a6a'],    // apple
  [84, '#b81f3c', '#6f0f22', '#ef5f74'],    // pomegranate
  [96, '#e8c23a', '#a8821a', '#fbe68a'],    // quince
  [128, '#d6d27a', '#94903e', '#f2efb2'],   // melon
  [160, '#3f8a3c', '#215820', '#7cc070'],   // watermelon
  [192, '#5b2d6e', '#311444', '#9864ae'],   // the great cluster
];

export const MAX_TIER = 11;
/** Only the five smallest fruits are dropped (Suika). */
export const DROP_TIERS = 5;

export const FRUITS: readonly Fruit[] = LOOK.map(([px, base, dark, light], i) => ({
  tier: i + 1, kind: KINDS[i], r: px / 640, pts: ((i + 1) * (i + 2)) / 2, name: t(`fruit.${i + 1}` as Key), base, dark, light,
}));

export const fruit = (tier: number): Fruit => FRUITS[Math.max(1, Math.min(MAX_TIER, Math.round(tier))) - 1];

/** A drop's tier from a uniform `u`: tiers 1–5, the small ones likelier (Suika drops the five evenly; ours lean small, it plays kinder). */
export const DROP_ODDS: readonly number[] = [0.27, 0.25, 0.2, 0.16, 0.12];

export function tierFromU(u: number): number {
  let acc = 0;
  for (let i = 0; i < DROP_ODDS.length; i++) {
    acc += DROP_ODDS[i];
    if (u < acc) return i + 1;
  }
  return DROP_ODDS.length;
}

// ── the festivals ────────────────────────────────────────────────
/** What a mission asks: a fruit made, a basket's score, a chain, stars of one basket (feats); merges and points through the festival (sums). */
export type MissionKind = 'make' | 'basket' | 'chain' | 'stars' | 'merges' | 'harvest';
export interface Mission { kind: MissionKind; n: number }

export type FestKind = 'first' | 'harvest' | 'ingather';
export type DecorId = 'obrus' | 'chleby' | 'oliwa' | 'wieniec' | 'lampy' | 'snop';
export interface Festival { kind: FestKind; decor: DecorId; missions: readonly Mission[] }

/** Exodus 23:16's feasts in the year's turn — the first fruits, the harvest, the ingathering — twice, the second year harder. */
export const FESTIVALS: readonly Festival[] = [
  { kind: 'first', decor: 'obrus', missions: [{ kind: 'make', n: 4 }, { kind: 'merges', n: 25 }, { kind: 'basket', n: 120 }] },
  { kind: 'harvest', decor: 'chleby', missions: [{ kind: 'make', n: 6 }, { kind: 'chain', n: 3 }, { kind: 'harvest', n: 800 }] },
  { kind: 'ingather', decor: 'oliwa', missions: [{ kind: 'make', n: 7 }, { kind: 'stars', n: 2 }, { kind: 'merges', n: 90 }] },
  { kind: 'first', decor: 'wieniec', missions: [{ kind: 'make', n: 8 }, { kind: 'basket', n: 450 }, { kind: 'chain', n: 4 }] },
  { kind: 'harvest', decor: 'lampy', missions: [{ kind: 'make', n: 9 }, { kind: 'harvest', n: 3000 }, { kind: 'stars', n: 3 }] },
  { kind: 'ingather', decor: 'snop', missions: [{ kind: 'make', n: 10 }, { kind: 'chain', n: 5 }, { kind: 'basket', n: 1000 }] },
];

/** The festival at index i: the six in turn, then the last three again (a new year), endlessly. */
export function festivalAt(i: number): Festival {
  const n = Math.max(0, Math.floor(i));
  return n < FESTIVALS.length ? FESTIVALS[n] : FESTIVALS[3 + ((n - FESTIVALS.length) % 3)];
}

export const DECORS: readonly DecorId[] = ['obrus', 'chleby', 'oliwa', 'wieniec', 'lampy', 'snop'];

export const festName = (f: Festival): string => t(`fest.${f.kind}` as Key);
export const decorName = (d: DecorId): string => t(`decor.${d}` as Key);

/** A mission in words ("Zrób figę", "Kosz za 120 pkt"). */
export function missionText(m: Mission): string {
  if (m.kind === 'make') return t('mission.make', { fruit: fruit(m.n).name });
  return t(`mission.${m.kind}` as Key, { n: m.n });
}

// ── the strategies (the panel's "W głowie"), never "concentrate harder" ──
export const TIPS = {
  warmup: t('tip.warmup'),
  push: [t('tip.push.1'), t('tip.push.2'), t('tip.push.3'), t('tip.push.4'), t('tip.push.5'), t('tip.push.6')],
  blind: [t('tip.blind.1'), t('tip.blind.2')],
  rest: [t('tip.rest.1'), t('tip.rest.2'), t('tip.rest.3'), t('tip.rest.4')],
  firstPush: t('tip.firstPush'),
  firstRest: t('tip.firstRest'),
} as const;

// ── Feliks the sparrow ───────────────────────────────────────────
export type Moment = 'open' | 'warm' | 'push' | 'blind' | 'rest' | 'good' | 'ready' | 'wind' | 'near' | 'saved' | 'basket'
  | 'big' | 'newTier' | 'glean' | 'chain' | 'pole' | 'fest' | 'end' | 'idle';

export const MOMENTS: readonly Moment[] = ['open', 'warm', 'push', 'blind', 'rest', 'good', 'ready', 'wind', 'near', 'saved', 'basket',
  'big', 'newTier', 'glean', 'chain', 'pole', 'fest', 'end', 'idle'];

/** How many lines each moment has in the catalog (say.<moment>.1 … n). */
export const LINE_COUNT = 3;

export const LINES: Readonly<Record<Moment, readonly string[]>> = Object.fromEntries(
  MOMENTS.map(m => [m, Array.from({ length: LINE_COUNT }, (_, i) => t(`say.${m}.${i + 1}` as Key))]),
) as unknown as Record<Moment, readonly string[]>;
