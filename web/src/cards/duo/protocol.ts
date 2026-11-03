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
import type { GlyphId } from '../art/glyphs';
import type { ColorId, ShapeId } from '../palette';

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
 * estimate; null before the first sync), the panel and the item.  Taps outside every item are sent
 * too (item ''), so a miss can count as an error where the game says so.
 */
export interface TapMsg { t: 'tap'; item: string; panel: number; ts: number; tb: number | null; n: number }
export interface PingMsg { t: 'ping'; a: number }
/** the pad's current clock estimate (shown on the board as the link's quality) */
export interface SyncMsg { t: 'sync'; offset: number; rtt: number }
export type PadMsg = JoinMsg | TapMsg | PingMsg | SyncMsg | { t: 'ready' } | { t: 'leave' };

const TYPES_FROM_BOARD = new Set(['hello', 'layout', 'state', 'fb', 'pong', 'bye']);
const TYPES_FROM_PAD = new Set(['join', 'tap', 'ping', 'sync', 'ready', 'leave']);

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A message from the board, or null (anything else: another app's message, a relay notice, garbage). */
export function asBoardMsg(v: unknown): BoardMsg | null {
  return isObj(v) && typeof v.t === 'string' && TYPES_FROM_BOARD.has(v.t) ? (v as unknown as BoardMsg) : null;
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
  return v as unknown as PadMsg;
}
