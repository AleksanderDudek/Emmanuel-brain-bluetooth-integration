/**
 * Posłaniec's hands: swipes, taps and keys turned into the runner's four moves, phone first (DESIGN
 * §7.3, §12).  A swipe acts the moment the finger has travelled SWIPE_PX from where it went down, in its
 * main direction — anywhere on the screen, the dock's chart too (it plays as the canvas's bottom edge);
 * a quick flick lifted before that, but past the tap slop, still counts on release, so a short sloppy
 * thumb stroke is a swipe and never a tap.  A press that stays within TAP_SLOP and is lifted within
 * TAP_SEC is a tap: the left third of the screen steps a lane left, the right third a lane right, the
 * middle third jumps (so does Space, the smoke test's input).  One move per touch; each finger on its
 * own.  Keys: ←/→/A/D lanes, ↑/W/Space jump, ↓/S roll.  And the coach marks' words for the hand the
 * player has.  Pure: no DOM.
 */
import { t, type Key } from './i18n';
import type { Teach } from './sim';

export type Move = 'left' | 'right' | 'jump' | 'roll';

/** a swipe acts once the finger has travelled this far (px): a thumb's short flick */
export const SWIPE_PX = 22;
/** a press that moved less than this (px) is a tap (a finger's wobble) */
export const TAP_SLOP = 12;
/** a press longer than this (s) without a swipe does nothing */
export const TAP_SEC = 0.4;
/** a press lifted within this (s) after moving past the slop is a flick: a swipe, however short */
export const FLICK_SEC = 0.3;

interface Press { x: number; y: number; t: number; used: boolean }

export class Gestures {
  private readonly presses = new Map<number, Press>();

  constructor(private width = 1280, private left = 0) {}

  /** The width the thirds divide (CSS px), from `left` (a notch's inset). */
  resize(w: number, left = 0, right = w): void {
    this.left = Math.max(0, left);
    this.width = Math.max(1, right - this.left);
  }

  /** A pointer event at play time `t` (s); returns the move it makes, if any. */
  pointer(type: 'down' | 'move' | 'up', id: number, x: number, y: number, t: number): Move | null {
    if (type === 'down') {
      this.presses.set(id, { x, y, t, used: false });
      return null;
    }
    const p = this.presses.get(id);
    if (!p) return null;
    if (type === 'move') {
      if (p.used) return null;
      const m = swipe(x - p.x, y - p.y);
      if (m) p.used = true;
      return m;
    }
    this.presses.delete(id);
    if (p.used) return null;
    const dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy);
    if (d >= SWIPE_PX) return direction(dx, dy);
    if (d >= TAP_SLOP) return t - p.t <= FLICK_SEC ? direction(dx, dy) : null;
    if (t - p.t > TAP_SEC) return null;
    return tapAt(x - this.left, this.width);
  }

  /** Whether a finger is down (the view keeps its touch ring while it is). */
  get down(): boolean { return this.presses.size > 0; }

  clear(): void { this.presses.clear(); }
}

/** The main direction of a stroke by (dx, dy). */
export function direction(dx: number, dy: number): Move {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'jump' : 'roll';
}

/** The move of a swipe by (dx, dy) px, or null while it is shorter than SWIPE_PX. */
export function swipe(dx: number, dy: number): Move | null {
  return Math.hypot(dx, dy) < SWIPE_PX ? null : direction(dx, dy);
}

/** A tap's move by where it lands across the screen: thirds. */
export function tapAt(x: number, width: number): Move {
  return x < width / 3 ? 'left' : x > (2 * width) / 3 ? 'right' : 'jump';
}

/** A key's move (null: not the game's). */
export function keyMove(key: string): Move | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  switch (k) {
    case 'ArrowLeft': case 'a': return 'left';
    case 'ArrowRight': case 'd': return 'right';
    case 'ArrowUp': case 'w': case ' ': return 'jump';
    case 'ArrowDown': case 's': return 'roll';
    default: return null;
  }
}

/**
 * A coach mark's words for the hand the player has: a finger hears of swipes and taps (never of keys), a
 * keyboard of its keys first, the swipe as the other way.
 */
export function hintText(what: Teach, touch: boolean): string {
  const keys = !touch && (what === 'jump' || what === 'roll' || what === 'lane');
  return t((keys ? `hint.${what}.keys` : `hint.${what}`) as Key);
}
