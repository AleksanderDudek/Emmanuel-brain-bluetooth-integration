/**
 * Posłaniec's hands: swipes, taps and keys turned into the runner's four moves.  A swipe (a finger
 * or the mouse moving more than `swipePx` from where it went down) acts the moment it is long
 * enough, in its main direction; a short press with little movement is a tap — the left third of
 * the screen steps a lane left, the right third a lane right, the middle third jumps (so does Space,
 * the smoke test's input).  Keys: ←/→/A/D lanes, ↑/W/Space jump, ↓/S slide.  Pure: no DOM.
 */
export type Move = 'left' | 'right' | 'jump' | 'slide';

export const SWIPE_PX = 30;
/** a press longer than this (s) without a swipe does nothing */
export const TAP_SEC = 0.4;

interface Press { x: number; y: number; t: number; used: boolean }

export class Gestures {
  private readonly presses = new Map<number, Press>();

  constructor(private width = 1280) {}

  resize(w: number): void { this.width = Math.max(1, w); }

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
    const m = swipe(x - p.x, y - p.y);
    if (m) return m;
    if (t - p.t > TAP_SEC) return null;
    return tapAt(x, this.width);
  }

  clear(): void { this.presses.clear(); }
}

/** The move of a swipe by (dx, dy) px, or null while it is shorter than SWIPE_PX. */
export function swipe(dx: number, dy: number): Move | null {
  if (Math.hypot(dx, dy) < SWIPE_PX) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'jump' : 'slide';
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
    case 'ArrowDown': case 's': return 'slide';
    default: return null;
  }
}
