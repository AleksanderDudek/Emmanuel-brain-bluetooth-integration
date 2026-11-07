/**
 * Where everything sits in the workshop (CSS px), for landscape and portrait: the counter with the
 * customer and the order ticket on the left, the wheel in the middle (the pot's foot on its head,
 * the spirit level on its frame, the Gotowe button beside it), the kiln with its heat gauge on the
 * right, the shelf with the cat along the back wall, and the glazing palette at the bottom.  The
 * runner's HUD covers the band above `top`: nothing that must be read or touched sits there.
 */
import { RULES } from './rules';
import { widestOf, type Target } from './shape';

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  top: number;
  portrait: boolean;
  /** a size unit: ~1 on a desktop, smaller on a phone */
  u: number;
  /** the wheel's axis, and the pot's foot (the wheel head's top) */
  axis: number;
  floor: number;
  /** the pot's room: up from the floor, and to each side of the axis */
  stageH: number;
  stageW: number;
  /** the wheel head (an ellipse) and the frame's spirit level */
  wheel: { x: number; y: number; rx: number; ry: number };
  level: Rect;
  /** the master's hand ring */
  charge: { x: number; y: number; r: number };
  done: Rect;
  ticket: Rect;
  /** the customer's feet and height (px) */
  customer: { x: number; y: number; s: number };
  kiln: Rect;
  /** the heat gauge: a half dial (its centre at the bottom) */
  gauge: { x: number; y: number; r: number };
  /** the kiln shelf where the batch dries */
  shelf: Rect;
  /** the cat on the back shelf */
  cat: { x: number; y: number; s: number };
  /** the glazing palette: the colours' row and the patterns' row */
  colors: Rect;
  patterns: Rect;
  /** the glazing wheel's floor (higher than the throwing wheel's: the palette sits under it) */
  glazeFloor: number;
}

export function layout(w: number, h: number, top: number): Layout {
  const portrait = h > w * 1.05;
  const u = Math.max(0.55, Math.min(1.15, Math.min(w / 1100, h / 640)));
  const T = Math.min(h * 0.5, Math.max(0, top));
  if (!portrait) {
    const floor = h - Math.max(48, Math.min(90, h * 0.14));
    const axis = w * 0.5;
    const stageTop = T + 22;
    const stageH = Math.max(60, floor - stageTop);
    const stageW = Math.min(w * 0.17, 260);
    const wheelRx = Math.min(stageW * 1.05, 170 * u);
    const ticketW = Math.min(250, Math.max(170, w * 0.2));
    const kilnW = Math.min(230, Math.max(130, w * 0.17));
    const kilnH = Math.min(kilnW * 1.0, (floor - T) * 0.62);
    const gaugeR = Math.min(kilnW * 0.5, (floor - T) * 0.22);
    const colH = Math.min(60, Math.max(42, h * 0.075));
    return {
      w, h, top: T, portrait, u, axis, floor, stageH, stageW,
      wheel: { x: axis, y: floor, rx: wheelRx, ry: wheelRx * 0.2 },
      level: { x: axis - 46 * u, y: floor + Math.max(14, 20 * u), w: 92 * u, h: 18 * u },
      charge: { x: axis - wheelRx - 46 * u, y: floor - 40 * u, r: 26 * u },
      done: { x: axis + wheelRx + 18 * u, y: floor - 64 * u, w: 128 * u, h: 52 * u },
      ticket: { x: 16, y: T + 10, w: ticketW, h: Math.max(70, Math.min(176, Math.max(128, (floor - T) * 0.4), floor - T - 30)) },
      customer: { x: 16 + ticketW * 0.5, y: floor + 26 * u, s: Math.min(190, (floor - T) * 0.42) },
      kiln: { x: w - kilnW - 24 * u, y: floor + 24 * u - kilnH, w: kilnW, h: kilnH },
      gauge: { x: w - kilnW / 2 - 24 * u, y: floor + 24 * u - kilnH - 18 * u, r: gaugeR },
      shelf: { x: axis + stageW + 34 * u, y: T + 44, w: Math.max(80, w - 28 - (axis + stageW + 34 * u)), h: 10 },
      cat: { x: w - 28 - 34 * u, y: T + 44, s: 46 * u },
      colors: { x: axis - 240 * u, y: h - colH - 8, w: 480 * u, h: colH },
      patterns: { x: axis - 170 * u, y: h - colH * 2 - 14, w: 340 * u, h: colH * 0.86 },
      glazeFloor: h - colH * 2 - 34,
    };
  }
  // portrait: the ticket on the left under the HUD, the kiln (with the cat on it) and the shelf on the
  // right, the pot in the middle, the customer at the bottom left, the Gotowe button and the master's
  // hand in the floor band under the wheel
  const floor = h - Math.max(76, h * 0.13);
  const ticketW = Math.min(200, w * 0.52);
  const ticketH = Math.min(150, Math.max(110, (floor - T) * 0.3));
  const axis = w * 0.5;
  const stageTop = T + ticketH + 22;
  const stageH = Math.max(60, floor - stageTop);
  const stageW = w * 0.28;
  const wheelRx = Math.min(stageW * 1.1, 130);
  const kilnW = Math.min(92, w - ticketW - 40);
  const kilnH = kilnW * 0.9;
  const colH = Math.min(52, Math.max(40, w * 0.11));
  const bandY = floor + 14;
  return {
    w, h, top: T, portrait, u, axis, floor, stageH, stageW,
    wheel: { x: axis, y: floor, rx: wheelRx, ry: wheelRx * 0.2 },
    level: { x: axis - 36, y: floor + 18, w: 72, h: 15 },
    charge: { x: 34, y: bandY + 24, r: 20 },
    done: { x: w - 122, y: bandY, w: 110, h: 46 },
    ticket: { x: 10, y: T + 8, w: ticketW, h: ticketH },
    customer: { x: 40, y: floor - 6, s: Math.min(110, stageH * 0.42) },
    kiln: { x: w - kilnW - 12, y: T + 26, w: kilnW, h: kilnH },
    gauge: { x: w - kilnW / 2 - 12, y: T + 18, r: kilnW * 0.42 },
    shelf: { x: ticketW + 22, y: T + ticketH + 6, w: w - ticketW - 30, h: 6 },
    cat: { x: w - kilnW / 2 - 12, y: T + 30, s: 34 },
    colors: { x: 8, y: h - colH - 6, w: w - 16, h: colH },
    patterns: { x: 30, y: h - colH * 2 - 12, w: w - 60, h: colH * 0.86 },
    glazeFloor: h - colH * 2 - 30,
  };
}

/** px per cm for an order, so that the tallest and widest the clay may go still fit the stage. */
export function stageScale(L: Layout, t: Target, room = L.stageH): number {
  const tall = t.H * Math.min(RULES.hMax, 1.32);
  const wide = widestOf(t.r) * 1.32;
  return Math.max(1, Math.min((room * 0.94) / tall, (L.stageW * 1.25) / wide));
}

/** The swatches of a row of `n` (circles in a rect). */
export function rowSlots(r: Rect, n: number): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  if (n <= 0) return out;
  const cell = Math.min(r.w / n, r.h * 1.5);
  const rad = Math.min(cell * 0.4, r.h * 0.44);
  const x0 = r.x + (r.w - cell * n) / 2 + cell / 2;
  for (let i = 0; i < n; i++) out.push({ x: x0 + i * cell, y: r.y + r.h / 2, r: rad });
  return out;
}

export const hit = (r: Rect, x: number, y: number, pad = 0): boolean =>
  x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

export const hitCircle = (c: { x: number; y: number; r: number }, x: number, y: number, pad = 6): boolean =>
  Math.hypot(x - c.x, y - c.y) <= c.r + pad;
