/**
 * The two-screen protocol (src/cards/DESIGN.md §5): what the *board* (the screen with the
 * instructions, which runs the game) and the *pad* (the touch screen in the player's hands)
 * say to each other.  The board is authoritative: it builds the pad's layout, decides every
 * trial and judges every tap; the pad only draws what it is told and reports taps with their
 * time, converted to the board's clock (clock.ts).  The same messages run over every link
 * (link.ts): inside one page, between two windows, or across the local network.
 *
 * Version 1.  Every message is a small JSON object with a type `t`.
 */
import { GLYPH_IDS, type GlyphId } from '../art/glyphs';
import { ALL_SHAPE_IDS, COLOR_IDS, type ColorId, type ShapeId } from '../palette';

export const PROTOCOL = 1;

/** One thing on the pad (or on the board): a coloured dot, a gesture, a shape, a number, a die… */
export interface PadItem {
  /** what the pad sends back when this item is tapped */
  id: string;
  color?: ColorId;
  /** a gesture or hand sign, drawn in the cards' style */
  glyph?: GlyphId;
  shape?: ShapeId;
  /** a digit or a short label */
  label?: string;
  /** a die face (1–6) */
  pips?: number;
  /** free layouts ('field'): the item's centre in 0..1 of the panel, and its radius in 0..1 of the panel's shorter side */
  x?: number;
  y?: number;
  r?: number;
  /** already done (a found target, a passed trail dot): drawn faded, taps are still reported */
  done?: boolean;
  /** drawn as a crosshair ring in its colour (card 24) instead of a filled dot */
  /** 'cross': a crosshair ring in the colour (card 24's cue); 'quarter': the crosshair with the item's quarter (tl, tr, bl, br) filled */
  look?: 'cross' | 'quarter';
}

/**
 * How a panel arranges its items: a grid of buttons; a ring (the colour wheels of cards 09 and 29);
 * a hand whose five fingertips are the buttons, thumb first (card 07); the four quarters of a
 * crosshair (card 24); or free positions (the trail of card 08, the search grid of card 17).
 */
export type Arrange = 'grid' | 'ring' | 'hand' | 'quad' | 'field';

export interface PadPanel {
  arrange: Arrange;
  items: PadItem[];
  /** grid columns (default: as square as fits) */
  cols?: number;
  /** a caption above the panel ("lewa ręka") */
  caption?: string;
  /** 'field': width / height of the playing area */
  aspect?: number;
}

/** One panel for one hand, or two side by side for both hands (left panel = left hand). */
export interface PadLayout {
  panels: PadPanel[];
}

/** What the pad shows when it is not taking taps, or over its buttons. */
export type PadState = 'pairing' | 'idle' | 'practice' | 'countdown' | 'play' | 'pause' | 'done';

// ── board → pad ──────────────────────────────────────────────────

export interface HelloMsg { t: 'hello'; v: number; game: string; title: string; marks: boolean }
export interface LayoutMsg { t: 'layout'; seq: number; layout: PadLayout }
/** `text` is shown as the pad's message; `input` says whether taps count right now */
export interface StateMsg { t: 'state'; state: PadState; text?: string; input: boolean }
/** a verdict on a tap: the item flashes; `keep` leaves it marked done */
export interface FeedbackMsg { t: 'fb'; item: string; ok: boolean; keep?: boolean; panel?: number }
/** clock sync reply: `a` = the pad's ping time (echoed), `b` = the board's time on receipt */
export interface PongMsg { t: 'pong'; a: number; b: number }
export type BoardMsg = HelloMsg | LayoutMsg | StateMsg | FeedbackMsg | PongMsg | { t: 'bye' };

// ── pad → board ──────────────────────────────────────────────────

export interface JoinMsg { t: 'join'; v: number; w: number; h: number; touch: boolean }
/**
 * A tap: `ts` on the pad's clock, `tb` the same moment on the board's clock (the pad's best offset
 * estimate; null before the first sync), the panel and the item.  Taps outside every item are not sent.
 */
export interface TapMsg { t: 'tap'; item: string; panel: number; ts: number; tb: number | null; n: number }
export interface PingMsg { t: 'ping'; a: number }
/** the pad's current clock estimate (shown on the board as the link's quality) */
export interface SyncMsg { t: 'sync'; offset: number; rtt: number }
export type PadMsg = JoinMsg | TapMsg | PingMsg | SyncMsg | { t: 'ready' } | { t: 'leave' };

const TYPES_FROM_BOARD = new Set(['hello', 'layout', 'state', 'fb', 'pong', 'bye']);
const TYPES_FROM_PAD = new Set(['join', 'tap', 'ping', 'sync', 'ready', 'leave']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const str = (v: unknown, max: number): boolean => typeof v === 'string' && v.length <= max;
const optStr = (v: unknown, max: number): boolean => v === undefined || str(v, max);
const num = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown): boolean => v === undefined || num(v);
const optBool = (v: unknown): boolean => v === undefined || typeof v === 'boolean';
const oneOf = (v: unknown, set: readonly string[]): boolean => typeof v === 'string' && set.includes(v);
const ARRANGES: readonly Arrange[] = ['grid', 'ring', 'hand', 'quad', 'field'];
const STATES: readonly PadState[] = ['pairing', 'idle', 'practice', 'countdown', 'play', 'pause', 'done'];

function isItem(v: unknown): boolean {
  return isObj(v) && str(v.id, 32)
    && (v.color === undefined || oneOf(v.color, COLOR_IDS)) && (v.glyph === undefined || oneOf(v.glyph, GLYPH_IDS))
    && (v.shape === undefined || oneOf(v.shape, ALL_SHAPE_IDS)) && optStr(v.label, 16)
    && (v.pips === undefined || (Number.isInteger(v.pips) && (v.pips as number) >= 1 && (v.pips as number) <= 6))
    && optNum(v.x) && optNum(v.y) && optNum(v.r) && optBool(v.done)
    && (v.look === undefined || v.look === 'cross' || v.look === 'quarter');
}

/** A layout the pad can draw: one or two panels, each a known arrangement of well-formed items. */
export function isLayout(v: unknown): v is PadLayout {
  return isObj(v) && Array.isArray(v.panels) && v.panels.length >= 1 && v.panels.length <= 2
    && v.panels.every(p => isObj(p) && oneOf(p.arrange, ARRANGES) && Array.isArray(p.items) && p.items.length <= 200
      && p.items.every(isItem) && (p.cols === undefined || (Number.isInteger(p.cols) && (p.cols as number) >= 1 && (p.cols as number) <= 12))
      && optStr(p.caption, 80) && optNum(p.aspect));
}

/**
 * A message from the board, or null (anything else: another app's message, a relay notice, garbage).
 * Checked field by field: over the relay it comes from another device, and a malformed one must not
 * break the pad's drawing.
 */
export function asBoardMsg(v: unknown): BoardMsg | null {
  if (!isObj(v) || typeof v.t !== 'string' || !TYPES_FROM_BOARD.has(v.t)) return null;
  let ok: boolean;
  switch (v.t) {
    case 'hello': ok = num(v.v) && str(v.game, 32) && str(v.title, 120) && typeof v.marks === 'boolean'; break;
    case 'layout': ok = Number.isInteger(v.seq) && isLayout(v.layout); break;
    case 'state': ok = oneOf(v.state, STATES) && typeof v.input === 'boolean' && optStr(v.text, 300); break;
    case 'fb': ok = str(v.item, 32) && typeof v.ok === 'boolean' && optBool(v.keep) && (v.panel === undefined || Number.isInteger(v.panel)); break;
    case 'pong': ok = num(v.a) && num(v.b); break;
    default: ok = true;   // bye
  }
  return ok ? (v as unknown as BoardMsg) : null;
}

/** A message from a pad, or null.  Taps are checked field by field: they decide scores. */
export function asPadMsg(v: unknown): PadMsg | null {
  if (!isObj(v) || typeof v.t !== 'string' || !TYPES_FROM_PAD.has(v.t)) return null;
  if (v.t === 'tap') {
    const ok = typeof v.item === 'string' && v.item.length <= 32 && Number.isInteger(v.panel)
      && Number.isFinite(v.ts) && (v.tb === null || Number.isFinite(v.tb)) && Number.isInteger(v.n);
    return ok ? (v as unknown as TapMsg) : null;
  }
  if (v.t === 'ping') return Number.isFinite(v.a) ? (v as unknown as PingMsg) : null;
  // the sync estimate is saved with the session; the join's size and touch only shape the pairing screen
  if (v.t === 'sync') return num(v.offset) && num(v.rtt) && (v.rtt as number) >= 0 ? (v as unknown as SyncMsg) : null;
  if (v.t === 'join') return num(v.v) && num(v.w) && num(v.h) && typeof v.touch === 'boolean' ? (v as unknown as JoinMsg) : null;
  return v as unknown as PadMsg;
}
