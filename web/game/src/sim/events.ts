/** What the simulation tells the renderer, the audio and the UI (consumed once per frame). */
import type { TraumaKind } from '../types';

export type GameEvent =
  | { type: 'shoot'; x: number; y: number }
  | { type: 'hit'; x: number; y: number }
  | { type: 'weaken'; x: number; y: number; kind: TraumaKind }
  | { type: 'recover'; x: number; y: number }
  | { type: 'split'; x: number; y: number }
  | { type: 'spawn'; x: number; y: number }
  | { type: 'blink'; x: number; y: number }
  | { type: 'arrow'; x: number; y: number }
  | { type: 'eat'; x: number; y: number; kind: TraumaKind | 'boss'; mult: number }
  /** shadows eaten in a row */
  | { type: 'chain'; n: number; x: number; y: number }
  | { type: 'full'; x: number; y: number }
  | { type: 'digest'; kind: TraumaKind; light: number }
  | { type: 'truth'; word: string; x: number; y: number; kind: TraumaKind }
  | { type: 'verse'; kind: TraumaKind }
  | { type: 'seed'; x: number; y: number }
  | { type: 'grace'; x: number; y: number }
  | { type: 'graceEnd' }
  | { type: 'fragment'; x: number; y: number }
  | { type: 'door' }
  /** the room is cleansed: the remaining light flies to the angel */
  | { type: 'sweep' }
  /** a flame of the Fire of the Spirit filled (n = flames now) */
  | { type: 'flame'; n: number }
  /** a tongue of fire around the angel */
  | { type: 'tongue'; x: number; y: number; r: number }
  | { type: 'hurt'; x: number; y: number }
  | { type: 'block'; x: number; y: number }
  | { type: 'revive' }
  | { type: 'fall' }
  | { type: 'heal'; x: number; y: number }
  | { type: 'fire'; x: number; y: number; r: number }
  | { type: 'wind'; x: number; y: number; r: number }
  | { type: 'trumpet'; x: number; y: number; r: number }
  | { type: 'lightning'; x: number; y: number }
  | { type: 'punch'; x: number; y: number }
  | { type: 'stone'; x: number; y: number }
  | { type: 'tree'; x: number; y: number }
  | { type: 'freeze' }
  | { type: 'wave'; n: number }
  | { type: 'bossPhase'; phase: number }
  | { type: 'charge'; x: number; y: number }
  | { type: 'crack' }
  | { type: 'reveal' }
  | { type: 'bossEaten' }
  | { type: 'ultimate' }
  | { type: 'levelup'; level: number }
  | { type: 'sabbath' }
  | { type: 'altar' };
