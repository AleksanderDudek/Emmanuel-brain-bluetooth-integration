/**
 * Where Kocia straż's play view puts things (CSS px), mobile first (DESIGN §11.9 "Mobile first", §12).  The
 * runner's HUD covers the top of the canvas (`insets().top`), a phone's home indicator or notch the other
 * edges; the game owns the rest, the bottom included.  Sizes start from a 360 px phone at u = 1 (kit/mobile
 * `uiScale`) and grow to 1.3 on a tablet or a desktop.
 *
 *   tall  (a phone upright, a tablet upright)  the field from the HUD down, a bar over its top edge (the fish
 *         and the stage), the wall with the cats and the gatehouse's eye; then the thumb zone: the toy
 *         chest (5 × 2, cells of 56 px and more) and the row of buttons (the three upgrades, a toy, the paw)
 *   short (a phone on its side)  three columns under the HUD's one row: the chest (2 × 5) under the left
 *         thumb, the field and the wall in the middle, the buttons one above another under the right thumb
 *   wide  (desktops, tablets on their side)  the field and the wall on the left, a column on the right: the
 *         fish, the chest, the buttons, the vintage
 *
 * The field is the sim's 10 × 10 (x across, y from the far edge down to the wall), stretched onto its
 * rectangle.  The cats sit along the wall in two groups around the eye in the middle — the view's own seats
 * (`wallRow`), spaced so that every cat is a finger-sized target even with six on a 360 px wall; the sim's
 * `cushionX` is only where their shots start, and the view bends a fresh shot out of the drawn cat.
 *
 * Everything the player taps is a rectangle here (`tapTargets`), the same ones the view hit-tests and the
 * mobile audit checks: at least MIN_TAP on the short side, apart from each other, inside the insets.
 */
import { clamp } from '../kit/juice';
import { MIN_TAP, NO_INSETS, TAP_GAP, uiScale, type Rect } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import type { BuyId } from './meta';
import { RULES } from './rules';

export type { Rect };
export type Mode = 'tall' | 'wide' | 'short';

/** The buttons along the bottom (or down the column), in order; the paw comes after them. */
export const BUYS: readonly BuyId[] = ['aim', 'paws', 'bowl', 'toy'];

export interface Layout {
  w: number;
  h: number;
  mode: Mode;
  /** UI scale: 1 on any phone, up to 1.3 on a tablet or a desktop */
  u: number;
  /** what covers each edge (the HUD band on top), and the HUD's lower edge */
  ins: Insets;
  top: number;
  /** the field (the sim's 10 × 10 maps onto it) and the scenery band above it */
  field: Rect;
  sky: Rect;
  /** px per field unit across and down, and the sprites' unit (the smaller, a little enlarged) */
  sx: number;
  sy: number;
  s: number;
  /** the wall: its band, and the line the cushions sit on */
  wall: Rect;
  seatY: number;
  /** a cat's height (px) */
  cat: number;
  /** the cats' row along the wall: the span it prefers and the narrowest edges it may use */
  row: { l: number; r: number; minL: number; minR: number };
  /** the gatehouse's eye (the band's gauge, the hunt's button) and its finger-sized target */
  eye: { x: number; y: number; r: number };
  eyeHit: Rect;
  /** the bar over the field's top: the stage's pill (the stage, the wave, the chief's courage and patience) */
  bar: Rect;
  stage: Rect;
  /** the fish in the bowl (a chip in the bar, or a row atop the column) */
  fish: Rect;
  /** the chest: its box, its cells (5 × 2, or 2 × 5 on a phone on its side), the gap between them */
  chest: Rect;
  cols: number;
  rows: number;
  cell: number;
  gap: number;
  /** the buttons */
  ups: Record<BuyId, Rect>;
  paw: Rect;
  vintage: Rect;
  /** the buttons have room for an icon, the effect and the cost side by side (else the name over the cost) */
  rich: boolean;
  /** Brother Anselm's portrait (centre, radius) and the room for his bubble to his right */
  brother: { x: number; y: number; r: number; maxW: number };
  /** where cards go (story, the vintage's question): a bottom sheet on a phone upright, else centred */
  card: Rect;
  anchor: 'bottom' | 'centre';
}

export function layout(w: number, h: number, insets: Insets = NO_INSETS): Layout {
  const W = Math.max(240, w), H = Math.max(200, h);
  const mode: Mode = W / H < 0.9 ? 'tall' : H < 460 ? 'short' : 'wide';
  const u = uiScale(W, H);
  const top = clamp(insets.top, 0, H * 0.6);
  const ins: Insets = { top, right: Math.max(0, insets.right), bottom: Math.max(0, insets.bottom), left: Math.max(0, insets.left) };
  const gap = Math.round(TAP_GAP * u);
  let field: Rect, wall: Rect, chest: Rect, fish: Rect, paw: Rect, vintage: Rect, bar: Rect, stage: Rect, card: Rect;
  let ups: Record<BuyId, Rect>;
  let row: Layout['row'];
  let cols = 5, rows = 2, cell: number, rich: boolean;
  let anchor: Layout['anchor'] = 'centre';
  if (mode === 'tall') {
    // nothing to press in the outer 16 px of a phone upright (the back swipe, a thumb's reach)
    const edge = W < 600 ? 16 : Math.round(24 * u);
    const x0 = ins.left + edge, x1 = W - ins.right - edge;
    const mid = (ins.left + W - ins.right) / 2;
    const panelW = Math.min(x1 - x0, 560 * u);
    const pad = Math.round(8 * u);
    const bh = Math.round(54 * u);
    const btnY = H - ins.bottom - pad - bh;
    const bw = (panelW - 4 * gap) / 5;
    const b = (i: number): Rect => ({ x: mid - panelW / 2 + i * (bw + gap), y: btnY, w: bw, h: bh });
    ups = { aim: b(0), paws: b(1), bowl: b(2), toy: b(3) };
    paw = b(4);
    // the chest: cells of 56 px at least (a toy under a thumb), larger where the band has room
    const band = H - ins.bottom - top;
    cell = Math.min((panelW - 4 * gap) / 5, Math.max(56, Math.min(64 * u, (band * 0.27 - gap) / 2)));
    const chestW = 5 * cell + 4 * gap, chestH = 2 * cell + gap;
    chest = { x: mid - chestW / 2, y: btnY - Math.round(10 * u) - chestH, w: chestW, h: chestH };
    // the wall (and the cats on it) grows with a tall band: a tablet's cats are not lost on its big field
    const wallH = Math.round(clamp(Math.max(50 * u, band * 0.085), 46, 90));
    wall = { x: 0, y: chest.y - Math.round(12 * u) - wallH, w: W, h: wallH };
    field = { x: 0, y: top, w: W, h: Math.max(60, wall.y - top) };
    bar = { x: x0, y: top + 4, w: x1 - x0, h: Math.round(26 * u) };
    fish = { x: bar.x, y: bar.y, w: Math.round(Math.min(112 * u, bar.w * 0.34)), h: bar.h };
    stage = { x: fish.x + fish.w + gap, y: bar.y, w: bar.x + bar.w - (fish.x + fish.w + gap), h: bar.h };
    rich = bw >= 112;
    // the vintage: a compact grapes button on a phone (its card says what it does), a labelled one on a tablet
    const vw = Math.round((rich ? 150 : 64) * u);
    vintage = { x: x1 - vw, y: bar.y + bar.h + 6, w: vw, h: Math.round(46 * u) };
    row = { l: x0, r: x1, minL: ins.left + 8, minR: W - ins.right - 8 };
    // a bottom sheet over the whole band: the play is frozen under a card, so it may cover the controls
    const cw = Math.min(x1 - x0 + 12, 560 * u);
    card = { x: mid - cw / 2, y: top + 8, w: cw, h: H - ins.bottom - pad - (top + 8) };
    anchor = 'bottom';
  } else if (mode === 'short') {
    // a phone on its side: the HUD is one row; two thumbs hold the phone at its ends
    const m = 8;
    const y0 = top + 6, y1 = H - ins.bottom - 6;
    const availH = y1 - y0;
    const bw = Math.round(clamp(W * 0.19, 112, 160 * u));
    const bx = W - ins.right - m - bw;
    const bh = Math.min(64 * u, (availH - 4 * gap) / 5);
    const stackH = 5 * bh + 4 * gap;
    const b = (i: number): Rect => ({ x: bx, y: y0 + (availH - stackH) / 2 + i * (bh + gap), w: bw, h: bh });
    ups = { aim: b(0), paws: b(1), bowl: b(2), toy: b(3) };
    paw = b(4);
    // the middle keeps room for six cats and the eye in one row of finger-sized targets
    const needMid = 7 * MIN_TAP + 6 * gap + 8;
    const x0 = ins.left + m;
    cols = 2;
    rows = 5;
    cell = Math.max(MIN_TAP + 2, Math.min((availH - 4 * gap) / 5, (bx - m - needMid - m - x0 - gap) / 2, 60 * u));
    const chestW = 2 * cell + gap, chestH = 5 * cell + 4 * gap;
    chest = { x: x0, y: y0 + (availH - chestH) / 2, w: chestW, h: chestH };
    const mx0 = chest.x + chestW + m, mx1 = bx - m;
    // the wall stands a little above the bottom: the eye's word (×1,4, the nap) reads under it
    const wallH = Math.round(clamp(H * 0.15, 48, 60));
    wall = { x: mx0, y: H - ins.bottom - wallH - 14, w: mx1 - mx0, h: wallH };
    field = { x: mx0, y: top, w: mx1 - mx0, h: Math.max(60, wall.y - top) };
    bar = { x: mx0 + 4, y: top + 4, w: mx1 - mx0 - 8, h: Math.round(26 * u) };
    fish = { x: bar.x, y: bar.y, w: Math.round(Math.min(104 * u, bar.w * 0.32)), h: bar.h };
    stage = { x: fish.x + fish.w + gap, y: bar.y, w: bar.x + bar.w - (fish.x + fish.w + gap), h: bar.h };
    // the middle column is narrow: the compact grapes button, so the brother's bubble keeps its width
    const vw = Math.round(64 * u);
    vintage = { x: mx1 - 4 - vw, y: bar.y + bar.h + 6, w: vw, h: Math.round(46 * u) };
    row = { l: mx0 + 4, r: mx1 - 4, minL: mx0, minR: mx1 };
    rich = bw >= 112;
    const cw = Math.min(W - ins.left - ins.right - 24, 600 * u);
    card = { x: (ins.left + W - ins.right) / 2 - cw / 2, y: top + 6, w: cw, h: H - ins.bottom - 6 - (top + 6) };
  } else {
    // a desktop or a tablet on its side: the column on the right under the score
    const m = Math.round(12 * u);
    const sideW = clamp(W * 0.27, 5 * 50 + 4 * gap + 2 * m, 420 * u);
    const sx = W - ins.right - sideW;
    const colX = sx + m, colW = sideW - 2 * m;
    fish = { x: colX, y: top + 6, w: colW, h: Math.round(40 * u) };
    cell = Math.min(64 * u, (colW - 4 * gap) / 5);
    const chestW = 5 * cell + 4 * gap, chestH = 2 * cell + gap;
    chest = { x: colX + (colW - chestW) / 2, y: fish.y + fish.h + Math.round(12 * u), w: chestW, h: chestH };
    const by = chest.y + chestH + Math.round(14 * u);
    const bottom = H - ins.bottom - m;
    const bh = Math.max(MIN_TAP + 4, Math.min(56 * u, (bottom - by - 2 * gap) / 2.8));
    const bw = (colW - gap) / 2;
    ups = {
      aim: { x: colX, y: by, w: bw, h: bh }, paws: { x: colX + bw + gap, y: by, w: bw, h: bh },
      bowl: { x: colX, y: by + bh + gap, w: bw, h: bh }, toy: { x: colX + bw + gap, y: by + bh + gap, w: bw, h: bh },
    };
    paw = { x: colX, y: by + 2 * (bh + gap), w: bw, h: Math.max(MIN_TAP + 4, bh * 0.8) };
    vintage = { x: colX + bw + gap, y: paw.y, w: bw, h: paw.h };
    const wallH = Math.round(clamp(70 * u, 60, 96));
    wall = { x: ins.left, y: H - ins.bottom - wallH - Math.round(18 * u), w: sx - ins.left, h: wallH };
    field = { x: ins.left, y: top, w: sx - ins.left, h: Math.max(80, wall.y - top) };
    const bw2 = Math.min(field.w - 2 * m, 560 * u);
    bar = { x: field.x + (field.w - bw2) / 2, y: top + 4, w: bw2, h: Math.round(26 * u) };
    stage = { ...bar };
    row = { l: field.x + 16, r: field.x + field.w - 16, minL: field.x + 8, minR: field.x + field.w - 8 };
    rich = true;
    const cw = Math.min(field.w - 32, 480 * u);
    card = { x: field.x + (field.w - cw) / 2, y: top + 8, w: cw, h: wall.y + wall.h - 8 - (top + 8) };
  }
  const sx = field.w / RULES.FW;
  const sy = field.h / RULES.FH;
  const s = clamp(Math.min(sx, sy * 1.25) * 1.15, 14, 56);
  const seatY = wall.y + wall.h * 0.38;
  const cat = Math.min(wall.h * 1.05, (row.r - row.l) / 7.2, 84);
  // the eye: as large as the wall allows, and narrow enough to leave six cats their targets around it
  const room = row.minR - row.minL - 2 * (3 * MIN_TAP + 2 * gap) - 2 * gap;
  const eyeR = Math.max(14, Math.min(wall.h * 0.46, 46, room / 2.2));
  const eye = { x: wall.x + wall.w / 2, y: wall.y + wall.h * 0.46, r: eyeR };
  const es = Math.max(MIN_TAP, Math.min(2.2 * eyeR, room));
  const eyeHit: Rect = { x: eye.x - es / 2, y: eye.y - es / 2, w: es, h: es };
  const sky: Rect = { x: field.x, y: 0, w: field.w, h: field.y };
  // Brother Anselm looks in from the field's top corner, under the bar, his bubble to his right
  const brR = Math.round((mode === 'short' ? 15 : 18) * u);
  const brX = field.x + Math.max(ins.left, field.x === 0 ? 16 : 0) + brR + 6;
  const brother = { x: brX, y: bar.y + bar.h + 8 + brR, r: brR, maxW: Math.max(120, Math.min(field.x + field.w - 10 - (brX + brR + 12), 380 * u)) };
  return {
    w: W, h: H, mode, u, ins, top, field, sky, sx, sy, s, wall, seatY, cat, row, eye, eyeHit, bar, stage, fish, chest, cols, rows, cell, gap,
    ups, paw, vintage, rich, brother, card, anchor,
  };
}

/** A field point (u) on the canvas (px). */
export const toPx = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: L.field.x + x * L.sx, y: L.field.y + y * L.sy });

/** A canvas point (px) in the field (u). */
export const toField = (L: Layout, x: number, y: number): { x: number; y: number } => ({ x: (x - L.field.x) / L.sx, y: (y - L.field.y) / L.sy });

/**
 * The cats' row for `n` cushions: each cat's x, its target (from its ears to its cushion), and the eye's target
 * between the two groups (null where the wall is too narrow for it: the paw button and Space release the hunt
 * there, and it goes by itself).  The groups keep the 16 px edges while they fit and give them up, down to
 * 8 px, for six cats on a 360 px phone.
 */
export interface WallRow { x: number[]; hit: Rect[]; eye: Rect | null }

const ROWS = new WeakMap<Layout, WallRow[]>();

export function wallRow(L: Layout, n: number): WallRow {
  let memo = ROWS.get(L);
  if (!memo) ROWS.set(L, (memo = []));
  const k = Math.max(0, Math.min(RULES.slotsMax, Math.floor(n)));
  const known = memo[k];
  if (known) return known;
  const g = L.gap, cx = L.eye.x;
  const left = Math.ceil(k / 2), right = k - left;
  const big = Math.max(1, left);
  const catW = Math.max(MIN_TAP, Math.min(L.cat * 1.1, 96));
  const need = big * MIN_TAP + (big - 1) * g;
  let eye: Rect | null = L.eyeHit;
  let inner = L.eyeHit.w / 2 + g;
  const pref = Math.min(cx - inner - L.row.l, L.row.r - cx - inner);
  const most = Math.min(cx - inner - L.row.minL, L.row.minR - cx - inner);
  let half = pref >= need ? pref : Math.min(need, most);
  if (half < need) {
    // too narrow even at the narrowest edges: the eye stays a picture, its room goes to the cats
    eye = null;
    inner = g / 2;
    half = Math.min(cx - inner - L.row.minL, L.row.minR - cx - inner);
  }
  const top = L.seatY - L.cat * 0.98, bottom = L.seatY + L.cat * 0.26;
  const xs: number[] = [], hits: Rect[] = [];
  /** a group of cats across [from, from + half]: spread out while there is room, else packed edge to edge */
  const place = (count: number, from: number): void => {
    if (!count) return;
    const pitch = half / count;
    const packed = pitch - g < catW;
    const tw = packed ? Math.max(1, (half - (count - 1) * g) / count) : catW;
    for (let j = 0; j < count; j++) {
      const x = from + (packed ? tw / 2 + j * (tw + g) : pitch * (j + 0.5));
      xs.push(x);
      hits.push({ x: x - tw / 2, y: top, w: tw, h: bottom - top });
    }
  };
  // left to right: the left group from the wall's end to the eye, the right one from the eye on
  place(left, cx - inner - half);
  place(right, cx + inner);
  const out: WallRow = { x: xs, hit: hits, eye };
  memo[k] = out;
  return out;
}

/** A cushion's seat on the wall (px): where the cat sits. */
export function seat(L: Layout, i: number, n: number): { x: number; y: number } {
  const r = wallRow(L, n);
  return { x: r.x[i] ?? L.eye.x, y: L.seatY };
}

/** The chest's i-th cell (px). */
export function cellRect(L: Layout, i: number): Rect {
  const c = i % L.cols, r = Math.floor(i / L.cols);
  return { x: L.chest.x + c * (L.cell + L.gap), y: L.chest.y + r * (L.cell + L.gap), w: L.cell, h: L.cell };
}

/** The vintage question's two buttons inside its card (finger-sized, at the card's foot). */
export function confirmButtons(L: Layout, c: Rect): { yes: Rect; no: Rect } {
  const u = L.u, pad = Math.round(16 * u), bw = (c.w - pad * 3) / 2, bh = Math.max(MIN_TAP + 6, Math.round(50 * u)), by = c.y + c.h - pad - bh;
  return { yes: { x: c.x + pad, y: by, w: bw, h: bh }, no: { x: c.x + pad * 2 + bw, y: by, w: bw, h: bh } };
}

export const inRect = (r: Rect, x: number, y: number, pad = 0): boolean => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;

/** What is on screen that decides the targets: the open cushions, the vintage's button, a card. */
export interface TargetState {
  slots: number;
  vintage: boolean;
  card: null | 'story' | 'confirm';
  /** the card as drawn (it sizes to its words); the layout's room for it before the first frame */
  cardBox?: Rect | null;
}

/**
 * Every control the player can tap right now, as the view hit-tests it (ArcadeGame.targets): the chest's
 * cells, the cats, the eye, the buttons, the vintage; under a card only the card (a tap anywhere closes a
 * story) or the question's two answers.  The free field (a tap marks a pest, "psst!") is not a target.
 */
export function tapTargets(L: Layout, s: TargetState): TapTarget[] {
  const r1 = (label: string, r: Rect): TapTarget => ({ label, x: r.x, y: r.y, w: r.w, h: r.h });
  if (s.card === 'story') return [r1('story', s.cardBox ?? L.card)];
  if (s.card === 'confirm') {
    const { yes, no } = confirmButtons(L, s.cardBox ?? L.card);
    return [r1('vintage: yes', yes), r1('vintage: no', no)];
  }
  const out: TapTarget[] = [];
  for (let i = 0; i < RULES.chest; i++) out.push(r1(`chest ${i + 1}`, cellRect(L, i)));
  const row = wallRow(L, s.slots);
  row.hit.forEach((r, i) => out.push(r1(`cat ${i + 1}`, r)));
  if (row.eye) out.push(r1('eye', row.eye));
  for (const id of BUYS) out.push(r1(id, L.ups[id]));
  out.push(r1('paw', L.paw));
  if (s.vintage) out.push(r1('vintage', L.vintage));
  return out;
}
