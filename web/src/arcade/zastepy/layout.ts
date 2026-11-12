/**
 * Where Zastępy's play view puts things (CSS px), phone first (src/arcade/DESIGN.md §8.3 and §12).  The runner's
 * HUD covers the top of the canvas (`insets().top`), a phone's home indicator its bottom, a notch its sides on its
 * side; the sky and the road run under all of them, the game's words and controls stay inside.  Sizes are for a
 * 360 px phone at u = 1 (kit/mobile `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  a phone (or a tablet) upright, the reference: right under the HUD the gates' bar — the walls of both
 *         gates with their numbers, the battle's place in the chapter between them — then Tymek and the coming
 *         wave, the road with the camera on the front (ten metres across); the thumb zone holds the light's row
 *         (the lantern, the light bar, the pillar and the trumpet as two 52 px buttons) over the unit cards: one
 *         row while a card keeps 52 px across, else two (the next card's locked preview gives way first)
 *   side  a phone on its side (a band under 340 px): the road across the whole width under the gates' bar and
 *         one strip along the bottom, held in two hands — the lantern under the left thumb, the cards in the
 *         middle with the light bar over them, the pillar and the trumpet under the right thumb
 *   wide  a desktop or a tablet on its side: the whole road in view, the light's row and the cards centred
 *         along the bottom, grown by the UI scale
 *
 * The card between battles is a bottom sheet of stacked offers on an upright phone (a centred card elsewhere);
 * the story cards fill the band's width.  All of it is pure: the tests run it at every kit/mobile CHECK_SIZES
 * entry and gate level, and `tapTargets` is what the view hit-tests and the mobile audit taps.
 */
import { clamp } from '../kit/juice';
import { NO_INSETS, TAP_GAP, target, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { HOST, HOST_IDS, RULES, type HostId } from './rules';

export type { Rect };
export type Shape = 'tall' | 'side' | 'wide';

/** A unit card: its unit, its box, and whether the gate has opened it (else it is the next card's preview). */
export interface CardSlot { id: HostId; r: Rect; open: boolean }

/** A round button: its centre and radius (its target is the square around it). */
export interface Disc { x: number; y: number; r: number }

/**
 * The card between battles: its box, the title (left, middle, width) and the gold (right edge, middle), the
 * chapter's map, the three offers' slots — full-width rows (`stacked`) or tiles in a row — and "go on".
 */
export interface Sheet {
  box: Rect;
  title: { x: number; y: number; w: number };
  gold: { x: number; y: number };
  map: Rect;
  offers: Rect[];
  go: Rect;
  stacked: boolean;
}

export interface Layout {
  w: number;
  h: number;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  shape: Shape;
  /** shape === 'tall' / 'side' (the painters ask) */
  tall: boolean;
  short: boolean;
  /** the primary input is a finger: no key badges */
  touch: boolean;
  ins: Insets;
  /** the runner's HUD's lower edge; the lowest y a control reaches; the controls' side margins */
  top: number;
  bottom: number;
  left: number;
  right: number;
  gap: number;
  /** px per metre of the road; the road's line (the feet of the nearest lane) and its far edge; metres in view */
  S: number;
  roadY: number;
  roadBack: number;
  viewM: number;
  /** the gates' bar under the HUD: the gate of light's walls on the left, the gate of ash's (or the boss) on the right */
  bar: Rect;
  /** Tymek's portrait (centre, radius) and the widest his bubble may grow to its right */
  tymek: { x: number; y: number; r: number; maxW: number };
  /** the coming wave's box: its right edge and top (it hangs left of there), the icons' size */
  soon: { x: number; y: number; icon: number };
  /** the banners: their foot (the road's far edge), their tallest, their left and right ends */
  banners: { y: number; h: number; x0: number; x1: number };
  /** the controls' band (below its top a tap is no road): the light's row, or the strip along the bottom */
  row: Rect;
  lantern: Disc;
  light: Rect;
  pillar: Disc;
  trumpet: Disc;
  /** the unit cards in their order (keys 1–7), and the strip they share (a tap in a gap takes the nearer card) */
  cards: CardSlot[];
  cardBand: Rect;
  rows: number;
  /** the toasts' centre and width */
  cardY: number;
  cardX: number;
  cardW: number;
  sheet: Sheet;
  /** the story card's room (it sizes to its words inside it) */
  story: Rect;
}

/** A card keeps at least this much across in one row (a portrait and its price under a thumb). */
export const CARD_MIN = 52;

/** The cards the gate has opened, in order, and the next one (shown locked while there is room). */
export function cardIds(gate: number): { open: HostId[]; next: HostId | null } {
  return { open: HOST_IDS.filter(id => HOST[id].gate <= gate), next: HOST_IDS.find(id => HOST[id].gate > gate) ?? null };
}

/** The square a round button is tapped in. */
export const discRect = (d: Disc): Rect => ({ x: d.x - d.r, y: d.y - d.r, w: 2 * d.r, h: 2 * d.r });

export function layout(w: number, h: number, insets: Partial<Insets> = NO_INSETS, touch = true, gate = 1): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const ins: Insets = { ...NO_INSETS, ...insets };
  const u = uiScale(W, H);
  const top = clamp(ins.top || 0, 0, H * 0.6);
  const band0 = H - top - Math.max(0, ins.bottom);
  const shape: Shape = W / H < 1 ? 'tall' : band0 < 340 ? 'side' : 'wide';
  const tall = shape === 'tall', side = shape === 'side';
  // nothing to press in the outer 16 px of an upright phone (the back swipe), the notch's room on its side
  const edge = tall ? (W < 600 ? 16 : Math.round(24 * u)) : side ? 10 : Math.round(12 * u);
  const left = Math.max(edge, ins.left > 0 ? ins.left + 6 : 0);
  const right = W - Math.max(edge, ins.right > 0 ? ins.right + 6 : 0);
  // over the home indicator, and clear of the canvas's last pixel (a touch on the dock arrives there)
  const bottom = H - Math.max(tall ? Math.round(8 * u) : side ? 6 : Math.round(12 * u), ins.bottom > 0 ? ins.bottom + 4 : 0);
  const A = right - left, band = bottom - top, mid = (left + right) / 2;
  const gap = Math.round(TAP_GAP * u);
  const { open, next } = cardIds(gate);

  let cards: CardSlot[], cardBand: Rect, rows = 1;
  let row: Rect, lantern: Disc, light: Rect, pillar: Disc, trumpet: Disc;
  /** a row of cards across [x0, x0 + span] at y, each at most `maxW` wide, centred */
  const lay = (ids: HostId[], x0: number, span: number, y: number, ch: number, maxW: number): CardSlot[] => {
    const n = ids.length;
    const cw = Math.min(maxW, (span - (n - 1) * gap) / n);
    const total = n * cw + (n - 1) * gap;
    const xs = x0 + (span - total) / 2;
    return ids.map((id, i) => ({ id, r: { x: xs + i * (cw + gap), y, w: cw, h: ch }, open: HOST[id].gate <= gate }));
  };

  if (shape === 'tall') {
    // the cards: one row while each keeps CARD_MIN across (the locked preview gives way first), else two rows
    const fits = (n: number) => (A - (n - 1) * gap) / n >= CARD_MIN * Math.min(u, 1.15);
    let ids: HostId[];
    if (fits(open.length + (next ? 1 : 0))) ids = next ? [...open, next] : open;
    else if (fits(open.length)) ids = open;
    else {
      ids = next ? [...open, next] : open;
      rows = 2;
    }
    const maxW = 112 * u;
    const ch = rows === 1 ? clamp(band * 0.2, 72, 92 * u) : clamp(band * 0.135, 54, 70 * u);
    const cardsH = rows * ch + (rows - 1) * gap;
    const cy = bottom - cardsH;
    if (rows === 1) cards = lay(ids, left, A, cy, ch, maxW);
    else {
      const per = Math.ceil(ids.length / 2);
      cards = [...lay(ids.slice(0, per), left, A, cy, ch, maxW), ...lay(ids.slice(per), left, A, cy + ch + gap, ch, (A - (per - 1) * gap) / per)];
    }
    cardBand = { x: left, y: cy, w: A, h: cardsH };
    // the light's row right above them: the lantern, the light bar, the pillar and the trumpet (52 px and up)
    const rowH = clamp(band * 0.14, 52, 64 * u);
    const rowY = cy - Math.round(10 * u) - rowH;
    const r = Math.min(rowH / 2, 32 * u);
    const cyRow = rowY + rowH / 2;
    trumpet = { x: right - r, y: cyRow, r };
    pillar = { x: trumpet.x - 2 * r - Math.round(10 * u), y: cyRow, r };
    lantern = { x: left + r, y: cyRow, r };
    const lx = lantern.x + r + Math.round(10 * u);
    light = { x: lx, y: rowY + rowH * 0.3, w: Math.max(40, pillar.x - r - Math.round(10 * u) - lx), h: rowH * 0.4 };
    row = { x: left - 6, y: rowY - 4, w: A + 12, h: rowH + 8 };
  } else if (side) {
    // one strip along the bottom held in two hands: the cards from the left thumb's edge, the pillar and the
    // trumpet under the right thumb; over them a slim row with the lantern (out from under a resting thumb) and
    // the light bar
    const stripH = Math.round(clamp(band * 0.21, 56, 64));
    const y0 = bottom - stripH, cyRow = y0 + stripH / 2;
    const r = Math.min(stripH / 2, 30);
    trumpet = { x: right - r, y: cyRow, r };
    pillar = { x: trumpet.x - 2 * r - 8, y: cyRow, r };
    const x0 = left, x1 = pillar.x - r - 10;
    const ids = next ? [...open, next] : open;
    cards = lay(ids, x0, x1 - x0, y0, stripH, 92);
    cardBand = { x: x0, y: y0, w: x1 - x0, h: stripH };
    const lr = 19, ly = y0 - 8 - 2 * lr;
    lantern = { x: left + lr, y: ly + lr, r: lr };
    const lx = lantern.x + lr + 10;
    light = { x: lx, y: ly + lr - 9, w: Math.max(60, x1 - lx), h: 18 };
    row = { x: left, y: ly - 4, w: A, h: bottom - (ly - 4) };
  } else {
    // a desktop or a tablet on its side: the light's row over the cards, centred
    const ids = next ? [...open, next] : open;
    const ch = clamp(band * 0.17, 72, 84 * u);
    const cy = bottom - ch;
    const rowW = Math.min(A, 700 * u);
    const rx = mid - rowW / 2;
    cards = lay(ids, rx, rowW, cy, ch, 112 * u);
    cardBand = { x: rx, y: cy, w: rowW, h: ch };
    const rowH = clamp(band * 0.12, 50, 56 * u);
    const rowY = cy - Math.round(10 * u) - rowH;
    const r = Math.min(rowH / 2, 30 * u);
    const cyRow = rowY + rowH / 2;
    trumpet = { x: rx + rowW - r, y: cyRow, r };
    pillar = { x: trumpet.x - 2 * r - Math.round(12 * u), y: cyRow, r };
    lantern = { x: rx + r, y: cyRow, r };
    const lx = lantern.x + r + Math.round(12 * u);
    light = { x: lx, y: rowY + rowH * 0.3, w: Math.max(60, pillar.x - r - Math.round(12 * u) - lx), h: rowH * 0.4 };
    row = { x: rx - 6, y: rowY - 4, w: rowW + 12, h: rowH + 8 };
  }

  // ── under the HUD: the gates' bar, Tymek on the left, the coming wave on the right ─────────────────
  const barH = Math.round((side ? 26 : 28) * u);
  const barW = tall ? A : Math.min(A * (side ? 0.72 : 1), 560 * u);
  const bar: Rect = { x: mid - barW / 2, y: top + (side ? 4 : 6), w: barW, h: barH };
  const below = bar.y + bar.h;
  const tyR = Math.round((side ? 15 : 18) * u);
  const tyX = left + tyR + 2;
  const icon = Math.round((side ? 22 : 24) * u);
  const soon = { x: right, y: below + 6, icon };
  const tymek = { x: tyX, y: below + 8 + tyR, r: tyR, maxW: Math.max(150, Math.min(right - (tyX + tyR + 12), 400 * u)) };

  // ── the road: ten metres across an upright phone (the camera follows the front), all of it on a desktop ─────
  const room = row.y - below;
  let S: number;
  if (tall) S = clamp(Math.min(W / 10.5, room / 5.2), 22, 44 * u);
  else if (side) S = clamp(Math.min(W / 21, room / 5), 18, 34);
  else S = clamp(Math.min(W / (RULES.road + 6.5), room / 5.4), 16, 48 * u);
  // the road's line: right over the controls, or — where a tall screen has room to spare — at about four fifths of
  // the band, the sea of clouds below it and no empty sky above (it keeps 6.4 m over it for Tymek, the banners, the host)
  const lowRoad = row.y + 4 - Math.max((side ? 10 : 14) * u, S * (side ? 0.5 : 0.55));
  const roadY = tall ? Math.min(lowRoad, Math.max(below + 6.4 * S, below + room * 0.78)) : lowRoad;
  const roadBack = roadY - S * 1.05;
  const bannerH = Math.max(18, Math.min(S * (tall ? 2.4 : 1.6), roadBack - below - 8 - S * 1.6));

  // ── the card between battles ──────────────────────────────────────────────────────────────────
  const pad = Math.round(12 * u), sg = Math.round(8 * u);
  const headH = Math.round(40 * u), mapH = Math.round(52 * u), goH = Math.max(48, Math.round(50 * u));
  let sheet: Sheet;
  if (tall) {
    // a bottom sheet: the title and the gold, the chapter's map, three stacked offers, "go on" under the thumb
    const tail = Math.round(6 * u);
    const fixed = pad + headH + mapH + 4 * sg + goH + tail;
    const oh = clamp((band - 4 - fixed) / 3, 54, 72 * u);
    const by = Math.max(top + 4, bottom - fixed - 3 * oh);
    const bx = Math.max(ins.left + 6, left - 8);
    const box = { x: bx, y: by, w: Math.min(W - ins.right - 6, right + 8) - bx, h: bottom - by };
    const go = { x: left, y: bottom - tail - goH, w: A, h: goH };
    const oy = by + pad + headH + mapH + sg;
    const ohFit = Math.min(oh, (go.y - sg - oy - 2 * sg) / 3);
    const offers = [0, 1, 2].map(i => ({ x: left, y: oy + i * (ohFit + sg), w: A, h: ohFit }));
    const headY = by + pad + headH / 2;
    sheet = {
      box, title: { x: left, y: headY, w: A - 96 * u }, gold: { x: right, y: headY },
      map: { x: left, y: by + pad + headH, w: A, h: mapH }, offers, go, stacked: true,
    };
  } else if (side) {
    // two columns, held in two hands: the title, the gold, the chapter's map and "go on" under the left thumb,
    // the three offers stacked under the right
    const by = top + 4, bh = bottom - by;
    const colL = clamp(A * 0.38, 190, 280);
    const ox = left + colL + 12, ow = right - pad - ox;
    const oh = clamp((bh - 2 * pad - 2 * sg) / 3, 54, 72);
    const oy = by + (bh - (3 * oh + 2 * sg)) / 2;
    const offers = [0, 1, 2].map(i => ({ x: ox, y: oy + i * (oh + sg), w: ow, h: oh }));
    const go = { x: left + pad, y: by + bh - pad - goH, w: colL - pad, h: goH };
    const titleY = by + pad + 14, goldY = titleY + 28;
    const mapY = (goldY + 14 + go.y - mapH) / 2;
    sheet = {
      box: { x: left, y: by, w: A, h: bh }, title: { x: left + pad, y: titleY, w: colL - pad }, gold: { x: left + colL, y: goldY },
      map: { x: left + pad, y: mapY, w: colL - pad, h: mapH }, offers, go, stacked: true,
    };
  } else {
    // a desktop: a card over the road, the offers as three tiles in a row
    const cw = Math.min(A, 680 * u);
    const oh = clamp(band * 0.22, 96, 112 * u);
    const need = pad + headH + mapH + sg + oh + sg + goH + pad;
    const bx = mid - cw / 2;
    const by = clamp((below + bottom - need) / 2, below + 6, Math.max(below + 6, bottom - need));
    const box = { x: bx, y: by, w: cw, h: need };
    const ow = (cw - 2 * pad - 2 * sg) / 3;
    const oy = by + pad + headH + mapH + sg;
    const offers = [0, 1, 2].map(i => ({ x: bx + pad + i * (ow + sg), y: oy, w: ow, h: oh }));
    const gw = Math.min(280 * u, cw - 2 * pad);
    const headY = by + pad + headH / 2;
    sheet = {
      box, title: { x: bx + pad, y: headY, w: cw - 2 * pad - 110 * u }, gold: { x: bx + cw - pad, y: headY },
      map: { x: bx + pad, y: by + pad + headH, w: cw - 2 * pad, h: mapH }, offers, go: { x: mid - gw / 2, y: oy + oh + sg, w: gw, h: goH }, stacked: false,
    };
  }

  // ── the story card's room ────────────────────────────────────────────────────────────────────
  let story: Rect;
  if (tall) {
    const sw = Math.min(W - ins.left - ins.right - 20, 560 * u);
    story = { x: (W - sw) / 2, y: top + 6, w: sw, h: band - 12 };
  } else if (side) {
    const sw = Math.min(A, 620);
    story = { x: mid - sw / 2, y: top + 5, w: sw, h: band - 10 };
  } else {
    const sw = Math.min(A, 560 * u), sh = Math.min(band - 24, 520 * u);
    story = { x: mid - sw / 2, y: top + (band - sh) / 2, w: sw, h: sh };
  }

  const tyBottom = tymek.y + tymek.r;
  return {
    w: W, h: H, u, shape, tall, short: side, touch, ins, top, bottom, left, right, gap,
    S, roadY, roadBack, viewM: W / S,
    bar, tymek, soon,
    banners: { y: roadBack, h: bannerH, x0: ins.left + 8, x1: W - ins.right - 8 },
    row, lantern, light, pillar, trumpet, cards, cardBand, rows,
    cardY: clamp((tyBottom + roadBack) / 2, tyBottom + 34 * u, Math.max(tyBottom + 34 * u, row.y - 70 * u)),
    cardX: mid,
    cardW: Math.min(380 * u, A),
    sheet, story,
  };
}

/** The open card under (x, y): on it, or in the strip's gap between two (the nearer one). */
export function cardAt(L: Layout, x: number, y: number): CardSlot | null {
  const inside = L.cards.find(c => x >= c.r.x && x <= c.r.x + c.r.w && y >= c.r.y && y <= c.r.y + c.r.h);
  if (inside) return inside;
  const g = L.gap / 2 + 1;
  let best: CardSlot | null = null, bd = Infinity;
  for (const c of L.cards) {
    if (y < c.r.y - g || y > c.r.y + c.r.h + g || x < c.r.x - g || x > c.r.x + c.r.w + g) continue;
    const d = Math.hypot(x - (c.r.x + c.r.w / 2), y - (c.r.y + c.r.h / 2));
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

/** What a finger can press now (ArcadeGame.targets): the story card, or the card between battles, or the battle's controls. */
export interface TargetState {
  /** the story card is up: its box as drawn (the layout's room before the first frame) */
  story?: Rect | null;
  /** the card between battles is up with this many offers */
  offers?: number | null;
}

export function tapTargets(L: Layout, s: TargetState = {}): TapTarget[] {
  if (s.story) return [target('story', s.story)];
  if (s.offers !== undefined && s.offers !== null) {
    return [...L.sheet.offers.slice(0, Math.max(0, Math.min(3, s.offers))).map((r, i) => target(`offer ${i + 1}`, r)), target('go on', L.sheet.go)];
  }
  return [
    ...L.cards.map(c => target(c.open ? `card ${c.id}` : `card ${c.id} (locked)`, c.r)),
    target('pillar', discRect(L.pillar)),
    target('trumpet', discRect(L.trumpet)),
  ];
}
