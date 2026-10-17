/**
 * One-thumb controls (Archero style): touch or drag anywhere to get a floating
 * joystick; let go and the angel stands still — and prays (fires the Word).
 * Keyboard: WASD / arrows.
 */
import type { Joystick } from '../render/renderer';

const RADIUS = 46;
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];

export class Input {
  readonly joystick: Joystick = { active: false, ox: 0, oy: 0, x: 0, y: 0 };
  private readonly keys = new Set<string>();
  private pointer: number | null = null;
  /** test hook / scripted movement */
  override: { mx: number; my: number } | null = null;

  constructor(private readonly el: HTMLElement) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('lostpointercapture', this.up);
    window.addEventListener('keydown', this.key);
    window.addEventListener('keyup', this.key);
    window.addEventListener('blur', () => this.reset());
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private down = (e: PointerEvent): void => {
    // primary button only: a right click opens the context menu, which swallows the pointerup
    if (this.pointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.pointer = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const [x, y] = this.local(e);
    Object.assign(this.joystick, { active: true, ox: x, oy: y, x, y });
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointer) return;
    const [x, y] = this.local(e);
    const dx = x - this.joystick.ox, dy = y - this.joystick.oy, l = Math.hypot(dx, dy);
    const k = l > RADIUS ? RADIUS / l : 1;
    this.joystick.x = this.joystick.ox + dx * k;
    this.joystick.y = this.joystick.oy + dy * k;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointer) return;
    this.pointer = null;
    this.joystick.active = false;
  };

  private key = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (!MOVE_KEYS.includes(k)) return;
    if (e.type === 'keyup') {
      this.keys.delete(k);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;   // a shortcut; macOS never sends its keyup
    this.keys.add(k);
    if (e.target === document.body) e.preventDefault();
  };

  reset(): void {
    this.keys.clear();
    this.pointer = null;
    this.joystick.active = false;
  }

  /** Movement vector, length ≤ 1. */
  read(): { mx: number; my: number } {
    if (this.override) return this.override;
    let mx = 0, my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (this.joystick.active) {
      mx += (this.joystick.x - this.joystick.ox) / RADIUS;
      my += (this.joystick.y - this.joystick.oy) / RADIUS;
    }
    const l = Math.hypot(mx, my);
    return l > 1 ? { mx: mx / l, my: my / l } : { mx, my };
  }
}
