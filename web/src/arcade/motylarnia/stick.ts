/**
 * Motylarnia's floating stick (DESIGN §3.3 "Mobile first"): on a touch screen the thumb steers from
 * wherever it lands, as the original's phone controls do — the base appears under the thumb, the knob
 * follows the drag, the caterpillar turns toward the drag's direction once it leaves a small dead zone, and
 * a knob pushed past the base's rim sprints (pulled back inside it, the sprint stops).  A finger pulled far
 * past the rim drags the base along, so the stick never gets stuck out of reach.  Lifting keeps the heading;
 * a quick tap without a drag turns toward the tapped point (the original's "point or tap").  One steering
 * finger at a time.  Pure: no DOM.
 */
export interface StickSize { r: number; knob: number; dead: number; sprint: number }

export interface StickState { id: number; bx: number; by: number; x: number; y: number; t: number; moved: boolean; sprint: boolean }

/** a press lifted within this (s) without leaving the dead zone is a tap */
export const TAP_SEC = 0.35;

export class Stick {
  s: StickState | null = null;

  constructor(public size: StickSize) {}

  /** A finger down at (x, y), play time t: the base under it (false: another finger already steers). */
  down(id: number, x: number, y: number, t: number): boolean {
    if (this.s) return false;
    this.s = { id, bx: x, by: y, x, y, t, moved: false, sprint: false };
    return true;
  }

  /** The finger moved: the heading to steer to (radians, null: still in the dead zone) and whether it sprints. */
  move(id: number, x: number, y: number): { aim: number | null; sprint: boolean } | null {
    const s = this.s;
    if (!s || s.id !== id) return null;
    s.x = x;
    s.y = y;
    let dx = x - s.bx, dy = y - s.by, d = Math.hypot(dx, dy);
    if (!s.moved && d >= this.size.dead) s.moved = true;
    // pulled far past the rim: the base follows, keeping the knob at the far edge (still a sprint)
    const far = this.size.sprint + this.size.r * 0.35;
    if (d > far) {
      s.bx = x - (dx / d) * far;
      s.by = y - (dy / d) * far;
      dx = x - s.bx;
      dy = y - s.by;
      d = far;
    }
    s.sprint = s.moved && d >= this.size.sprint;
    return { aim: s.moved && d >= this.size.dead * 0.5 ? Math.atan2(dy, dx) : null, sprint: s.sprint };
  }

  /** The finger lifted: whether it was a tap (no drag, quick), and whether a sprint ends now. */
  up(id: number, t: number): { tap: boolean; sprintEnds: boolean } | null {
    const s = this.s;
    if (!s || s.id !== id) return null;
    this.s = null;
    return { tap: !s.moved && t - s.t <= TAP_SEC, sprintEnds: s.sprint };
  }

  /** The knob's place: the finger, held within the far edge. */
  knob(): { x: number; y: number } | null {
    const s = this.s;
    return s ? { x: s.x, y: s.y } : null;
  }

  clear(): void { this.s = null; }
}
