/**
 * Dobry bój's content (DESIGN.md §25): the ladder of opponents, the player's kit, the passages each moment rests on (by
 * id from the generated src/content/scripture.ts, never typed), and what the coach speaks about.
 *
 * The opponents are sportspeople, never villains: ring names (no real people), a style of fighting, a kit.  The women's
 * and the men's division share the ladder (the opponent is of the player's division); the last rung is the champion of
 * the division.  Each style lean says which combinations they throw and which openings they give, how hard they hit
 * (`power`), how much they take (`chin`: a damage multiplier, < 1 takes less), how fast their strikes come (`speed`)
 * and how often they lead (`aggr`: the share of exchanges where they attack).
 */
import type { PassageId } from '../kit/scripture';
import { COMBOS, OPENINGS, STRIKES, type Style } from './moves';
import type { Look } from './view';

export type FoeId = 'iskra' | 'wir' | 'cien' | 'skala' | 'strzala' | 'mistrz';
export type Lean = 'jabber' | 'swarmer' | 'counter' | 'power' | 'kicker' | 'allround';

export interface Persona {
  id: FoeId;
  lean: Lean;
  power: number;
  chin: number;
  speed: number;
  aggr: number;
  /** the combinations they throw at the player, by style (moves.ts ids) */
  combos: Readonly<Record<Style, readonly string[]>>;
  /** the openings they give, by style (moves.ts ids) */
  openings: Readonly<Record<Style, readonly string[]>>;
  /** their look (the division comes from the player's) */
  skin: number;
  hair: number;
  kit: string;
  gloves: string;
}

/** The ladder, first to last: beat one → the next; lose → the same one again. */
export const LADDER: readonly Persona[] = [
  {
    id: 'iskra', lean: 'jabber', power: 0.85, chin: 1.15, speed: 1.15, aggr: 0.5,
    combos: { boks: ['1-2', '1-1-2', '1-2-3'], mma: ['1-2', '1-1-2', 'teep-2'] },
    openings: { boks: ['dropHand', 'wide'], mma: ['dropHand', 'heavyLeg'] },
    skin: 1, hair: 1, kit: '#d9a032', gloves: '#e9e2d0',
  },
  {
    id: 'wir', lean: 'swarmer', power: 0.95, chin: 1.08, speed: 1.1, aggr: 0.6,
    combos: { boks: ['1-2-3', '2-3-2', '1-2-3-2', '3b-3'], mma: ['1-2-3', '2-3-2', '1-knee'] },
    openings: { boks: ['wide', 'tired', 'square'], mma: ['wide', 'tired', 'square'] },
    skin: 3, hair: 2, kit: '#3f8f6b', gloves: '#2b2b2b',
  },
  {
    id: 'cien', lean: 'counter', power: 1, chin: 1, speed: 1.2, aggr: 0.42,
    combos: { boks: ['2-3-2', '1-4', '1-2-5-2'], mma: ['2-3-2', '1-2-bk', '1-4'] },
    openings: { boks: ['leanIn', 'dropHand'], mma: ['leanIn', 'dropHand', 'heavyLeg'] },
    skin: 0, hair: 3, kit: '#6b5fa8', gloves: '#d8d8e6',
  },
  {
    id: 'skala', lean: 'power', power: 1.15, chin: 0.92, speed: 0.9, aggr: 0.55,
    combos: { boks: ['1-ov', '1-4', '1-6-3-2'], mma: ['1-ov', '1-2-td', '1-2-lk'] },
    openings: { boks: ['square', 'tired', 'leanIn'], mma: ['square', 'heavyLeg', 'tired'] },
    skin: 4, hair: 0, kit: '#a8443a', gloves: '#f0c040',
  },
  {
    id: 'strzala', lean: 'kicker', power: 1.05, chin: 0.95, speed: 1.15, aggr: 0.55,
    combos: { boks: ['1-2-5-2', '1-2-3', '1-1-2'], mma: ['1-2-lk', '1-2-bk', '2-3-hk', 'teep-2'] },
    openings: { boks: ['dropHand', 'leanIn', 'wide'], mma: ['heavyLeg', 'dropHand', 'leanIn'] },
    skin: 2, hair: 1, kit: '#2e7fb0', gloves: '#c9e3f2',
  },
  {
    id: 'mistrz', lean: 'allround', power: 1.12, chin: 0.88, speed: 1.15, aggr: 0.55,
    combos: { boks: ['1-2-3-2', '1-6-3-2', '1-2-5-2', '2-3-2', '1-ov'], mma: ['1-2-3-2', '2-3-hk', '1-2-td', '1-2-bk', '1-knee'] },
    openings: { boks: ['dropHand', 'leanIn', 'wide', 'square', 'tired'], mma: ['dropHand', 'leanIn', 'heavyLeg', 'square', 'tired'] },
    skin: 2, hair: 0, kit: '#e2b23a', gloves: '#7a1f2b',
  },
];

export const FOE_IDS: readonly FoeId[] = LADDER.map(p => p.id);
export const ladderOf = (i: number): Persona => LADDER[Math.max(0, Math.min(LADDER.length - 1, Math.floor(Number.isFinite(i) ? i : 0)))];

/** The player's kit (the blue corner's trunks, red gloves) and the five skin tones' swatches for the lobby's chips. */
export const PLAYER_KIT = '#2c5aa0';
export const PLAYER_GLOVES = '#c0342f';
export const SKIN_SWATCH: readonly string[] = ['#f4d3c0', '#e3b08e', '#c68a5e', '#8d5a3a', '#5a3a26'];
export const SKINS = SKIN_SWATCH.length;
export const HAIRS = 4;

/** The player's look from the lobby's choices. */
export const playerLook = (sex: 'ona' | 'on', skin: number, hair: number): Look => ({ sex, skin, hair, kit: PLAYER_KIT, gloves: PLAYER_GLOVES });
/** An opponent's look in the player's division. */
export const foeLook = (p: Persona, sex: 'ona' | 'on'): Look => ({ sex, skin: p.skin, hair: p.hair, kit: p.kit, gloves: p.gloves });

/** Every id a persona names exists in moves.ts and belongs to the style it is listed under (the tests check it). */
export function personaProblems(): string[] {
  const out: string[] = [];
  for (const p of LADDER) {
    for (const st of ['boks', 'mma'] as const) {
      for (const c of p.combos[st]) {
        const combo = COMBOS.find(x => x.id === c);
        if (!combo) out.push(`${p.id}: combo ${c}`);
        else if (!combo.styles.includes(st) || combo.strikes.some(s => !STRIKES[s].styles.includes(st))) out.push(`${p.id}: combo ${c} not ${st}`);
      }
      for (const o of p.openings[st]) {
        const op = OPENINGS.find(x => x.id === o);
        if (!op) out.push(`${p.id}: opening ${o}`);
        else if (!op.styles.includes(st)) out.push(`${p.id}: opening ${o} not ${st}`);
      }
    }
  }
  return out;
}

// ── Scripture ────────────────────────────────────────────────────

/** The root (the registry's): "I have fought the good fight". */
export const ROOT: PassageId = '2ti4.7';

/** The passages of each moment, in turn session by session. */
export const VERSES = {
  /** the corner between rounds (the first, then every second): He trains my hands; run so as to win; strength */
  corner: ['psa144.1', '1co9.26-27', 'psa18.34', 'isa40.31', 'heb12.1', 'eph6.10-11', 'php4.13', 'jos1.9'],
  /** after a won fight */
  win: ['2ti4.7', '1ti6.12', '1co9.24'],
  /** after a lost fight, after a knockdown */
  loss: ['pro24.16', 'mic7.8'],
} as const satisfies Record<string, readonly PassageId[]>;
export type VerseKey = keyof typeof VERSES;

/** Every passage the game can show (the tests check each exists in all four languages). */
export const ALL_VERSES: readonly PassageId[] = [...new Set<PassageId>([ROOT, ...Object.values(VERSES).flat()])];

/** The passage of a moment for the n-th session (1-based), `k` more along for another showing in it. */
export function verseFor(key: VerseKey, session: number, k = 0): PassageId {
  const list: readonly PassageId[] = VERSES[key];
  const n = Math.max(1, Math.floor(Number.isFinite(session) ? session : 1)) - 1 + Math.max(0, Math.floor(k));
  return list[n % list.length];
}

/** What the coach speaks about (talk.ts; the lines are in i18n.ts as `say.<moment>.<n>`). */
export const MOMENTS = [
  'intro', 'read', 'readHit', 'readGood', 'round', 'final', 'corner', 'cornerGood', 'cornerFocus',
  'cornerHooks', 'cornerStraight', 'cornerUpper', 'cornerKicks', 'cornerShot', 'cornerOpen',
  'down', 'rise', 'foeDown', 'win', 'winKo', 'loss', 'next', 'rematch',
] as const;
export type Moment = (typeof MOMENTS)[number];
