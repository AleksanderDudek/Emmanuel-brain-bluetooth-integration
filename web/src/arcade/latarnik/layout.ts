/**
 * Where Latarnik's play view puts things (version 2): the largest round sea that fits under the
 * runner's standard HUD (the Mendi panel top left, the score top right: `hudTop`) and above its
 * bottom strip, and the game's own few things around it — the night's lanterns and the perfect
 * ladder, the night's goal chip, Zośka on her post with her bubble, and the card slot (amber, the
 * blind reveal).  On a portrait phone they make a deck under the sea; when wide they sit in the
 * columns beside it, below the panel and the score.  Nothing of the game's goes under the HUD.
 */
import { clamp } from '../kit/juice';

/** The runner's own UI: the top strip (timer, pause), the bottom strip (signal banner, simulator button). */
export const TOP = 64;
export const BOTTOM = 66;

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  w: number;
  h: number;
  /** the lamp, i.e. the sea's centre, and the sea's radius R */
  cx: number;
  cy: number;
  R: number;
  /** the island's radius and one boat length (px) */
  s: number;
  boat: number;
  portrait: boolean;
  /** UI scale */
  u: number;
  /** the HUD's band: the game's own things stay below it */
  top: number;
  /** the lanterns' left end and the ladder's right end, on their baselines */
  lanterns: { x: number; y: number };
  ladder: { x: number; y: number };
  goal: Rect;
  /** Zośka's post (its foot) and her size; the bubble's room */
  gull: { x: number; y: number; s: number; face: 1 | -1 };
  bubble: Rect;
  /** Zośka's bubble takes the goal chip's place while she talks (a phone, a short screen) */
  bubbleOnGoal: boolean;
  card: Rect;
}

/** The HUD's rough boxes when wide (the panel top left, the score top right), for keeping the sea clear of them. */
function hudBoxes(w: number, top: number): [number, number, number, number][] {
  return [[0, 0, Math.min(w * 0.64, 350), top], [w - Math.min(w * 0.3, 190), 0, w, top]];
}

/** Whether a circle meets a box. */
function meets(cx: number, cy: number, r: number, b: [number, number, number, number]): boolean {
  const x = clamp(cx, b[0], b[2]), y = clamp(cy, b[1], b[3]);
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

/**
 * The largest sea that fits: on a portrait phone between the HUD and the deck under the sea; when
 * wide, centred between the columns and kept clear of the panel and the score.  A small sea gets
 * a slightly larger island and boats of at least 20 px, so both read on a phone.
 */
export function layout(w: number, h: number, hudTop = TOP + 60): Layout {
  const u = clamp(Math.min(w, h) / 430, 0.84, 1.2);
  const top = Math.max(TOP, hudTop);
  const deck = 84 * u;
  const rPortrait = Math.min(w / 2 - 8, (h - top - BOTTOM - deck) / 2);
  const side = clamp(w * 0.21, 160 * u, 330);
  const rLand = Math.min((h - TOP - BOTTOM) / 2 + 4, (w - 2 * side) / 2);
  const portrait = rPortrait >= rLand * 0.92 || w < h;
  let R: number, cy: number, cx = w / 2;
  if (portrait) {
    R = Math.max(60, rPortrait);
    cy = top + 6 + Math.max(R, (h - top - BOTTOM - deck - 6) / 2);
    cy = Math.min(cy, h - BOTTOM - deck - R);
    cy = Math.max(cy, top + R * 0.92);
  } else {
    // the sea clear of the panel and the score: shrink it, let it sink a little, and on a short screen
    // slide it right of centre, where it can be larger (the left column keeps room for the deck)
    const boxes = hudBoxes(w, top);
    let best = { R: 0, cx: w / 2, cy: 0 };
    for (const k of [0.5, 0.55, 0.6, 0.64]) {
      const x = w * k;
      let r = Math.min((h - TOP - BOTTOM) / 2 + 4, Math.min(x - 160 * u, w - x - 16), (w - 2 * side) / 2 + (k - 0.5) * w);
      let y = TOP + (h - TOP - BOTTOM) / 2;
      for (let i = 0; i < 300 && r > 60 && boxes.some(b => meets(x, y, r, b)); i++) {
        r -= 1.5;
        y = Math.min(y + 1, h - BOTTOM - r);
      }
      if (r > best.R * 1.08) best = { R: r, cx: x, cy: y };
    }
    R = Math.max(60, best.R);
    cx = best.cx;
    cy = best.cy;
  }
  const s = R * (0.13 - 0.015 * clamp((R - 180) / 120));
  const L: Layout = {
    w, h, cx, cy, R, s, boat: Math.max(20, R * 0.1), portrait, u, top,
    lanterns: { x: 0, y: 0 }, ladder: { x: 0, y: 0 }, goal: { x: 0, y: 0, w: 0, h: 0 },
    gull: { x: 0, y: 0, s: 0, face: 1 }, bubble: { x: 0, y: 0, w: 0, h: 0 }, card: { x: 0, y: 0, w: 0, h: 0 }, bubbleOnGoal: false,
  };
  if (portrait) {
    // the deck: the lanterns and the ladder in a row, under it Zośka on her post beside the goal chip
    const rowA = Math.min(h - BOTTOM - 62 * u, cy + R + 18 * u);
    L.lanterns = { x: 18, y: rowA };
    L.ladder = { x: w - 18, y: rowA };
    const gs = 34 * u;
    const gy = Math.min(h - BOTTOM - 2, rowA + 14 * u + 1.32 * gs);
    L.gull = { x: 18 + gs * 0.42, y: gy, s: gs, face: 1 };
    const gx = 18 + gs + 6 * u;
    L.goal = { x: gx, y: rowA + 12 * u, w: w - 18 - gx, h: Math.max(30 * u, gy - rowA - 12 * u) };
    L.bubble = { x: gx, y: L.goal.y - 2 * u, w: L.goal.w, h: L.goal.h + 4 * u };
    L.bubbleOnGoal = true;
    L.card = { x: 16, y: Math.min(h - BOTTOM - 70 * u, cy + R + 4 * u), w: w - 32, h: 66 * u };
  } else {
    const leftW = Math.max(140, Math.min(cx - R - 36, 300 * u));
    const rightW = Math.max(140, Math.min(w - (cx + R) - 36, 290 * u));
    L.lanterns = { x: 18, y: top + 26 * u };
    L.goal = { x: 18, y: top + 44 * u, w: leftW, h: clamp(h - BOTTOM - top - 50 * u, 34 * u, 62 * u) };
    L.ladder = { x: w - 18, y: top + 26 * u };
    L.card = { x: w - 18 - rightW, y: top + 50 * u, w: rightW, h: 66 * u };
    const gs = 54 * u;
    L.gull = { x: 18 + gs * 0.42, y: h - BOTTOM - 6, s: gs, face: 1 };
    const by = L.goal.y + L.goal.h + 12 * u;
    L.bubble = { x: 18, y: by, w: leftW, h: L.gull.y - gs * 1.4 - by };
    if (L.bubble.h < 36 * u) {
      // a short screen: no room for her post; she speaks over the goal chip instead
      L.gull.s = 0;
      L.bubble = { x: L.goal.x, y: L.goal.y - 2 * u, w: L.goal.w, h: L.goal.h + 4 * u };
      L.bubbleOnGoal = true;
    }
  }
  return L;
}
