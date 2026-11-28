/**
 * Złota passa's places at home (DESIGN.md §29, the film — builder P2): the bedroom at waking, the kitchen of the
 * breakfast, the bathroom's warm water, home with small children, the evening table, the window at night.  Painted in
 * the stage's units (stage.ts: y down, 0 the surface line just above the card; the heart of each within x ±1.6).
 */
import type { Place } from './life';
import type { PlaceSet } from './places';
import { TAU, glow, hash, mixHex, rgba } from './paint';
import {
  beam, books, ell, floor, lampLight, lightSwitch, person, picture, plant, poly, rect, rrect, shadow, sunPatch, tone,
  vgrad, vignette, wall, walkers, windowIn, type Ctx, type Room,
} from './stage';
import { drawAlive, drawStill, motes, steam } from './things';

const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};

/** Cabinet fronts in a row (doors with handles) between x0 and x1, from y0 to y1. */
function cabinets(c: Ctx, R: Room, x0: number, x1: number, y0: number, y1: number, col: string, w = 0.78, knob = '#c8a46a'): void {
  rect(c, x0, y0, x1 - x0, y1 - y0, tone(mixHex(col, '#000000', 0.18), R));
  const n = Math.max(1, Math.round((x1 - x0) / w));
  const dw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dw;
    c.fillStyle = lin(c, x, y0, x + dw, y1, [[0, tone(mixHex(col, '#ffffff', 0.1), R, 0.4)], [1, tone(mixHex(col, '#000000', 0.08), R, 0.2)]]);
    rrect(c, x + 0.03, y0 + 0.03, dw - 0.06, y1 - y0 - 0.06, 0.03);
    c.fill();
    c.strokeStyle = rgba('#ffffff', 0.18);
    c.lineWidth = 0.012;
    c.strokeRect(x + 0.09, y0 + 0.09, dw - 0.18, y1 - y0 - 0.18);
    ell(c, x + (i % 2 ? 0.12 : dw - 0.12), (y0 + y1) / 2, 0.03, 0.03, tone(knob, R, 0.6));
  }
}

/** Curtains at a window's sides (soft folds), from a rod above it. */
function curtains(c: Ctx, R: Room, x0: number, x1: number, y0: number, y1: number, col: string): void {
  const w = 0.42;
  rect(c, x0 - w - 0.1, y0 - 0.12, x1 - x0 + 2 * w + 0.2, 0.04, tone('#6a5a4a', R, 0.4));
  for (const [a, b] of [[x0 - w, x0 + 0.05], [x1 - 0.05, x1 + w]] as const) {
    c.fillStyle = lin(c, a, 0, b, 0, [[0, tone(mixHex(col, '#000000', 0.15), R)], [0.3, tone(mixHex(col, '#ffffff', 0.12), R, 0.6)], [0.6, tone(col, R, 0.3)], [1, tone(mixHex(col, '#000000', 0.2), R)]]);
    c.beginPath();
    c.moveTo(a, y0 - 0.1);
    c.lineTo(b, y0 - 0.1);
    c.quadraticCurveTo(b + (a < x0 ? 0.08 : -0.08), (y0 + y1) / 2, b + (a < x0 ? -0.02 : 0.02), y1 + 0.3);
    c.lineTo(a + (a < x0 ? 0.06 : -0.06), y1 + 0.3);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#000000', 0.08);
    c.lineWidth = 0.015;
    for (let i = 1; i < 4; i++) {
      const x = a + ((b - a) * i) / 4;
      c.beginPath(); c.moveTo(x, y0 - 0.08); c.lineTo(x + (a < x0 ? -0.02 : 0.02), y1 + 0.28); c.stroke();
    }
  }
}

/** A pendant lamp's shade (its light is `lampLight`). */
function pendant(c: Ctx, R: Room, x: number, y: number, s: number, col = '#e8c890'): void {
  c.strokeStyle = tone('#3a3430', R);
  c.lineWidth = 0.012;
  c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x, y - s * 0.4); c.stroke();
  c.fillStyle = lin(c, x - s, 0, x + s, 0, [[0, tone(mixHex(col, '#000000', 0.2), R, 0.3, 1)], [0.5, tone(col, R, 0.5, 1)], [1, tone(mixHex(col, '#000000', 0.25), R, 0, 1)]]);
  c.beginPath();
  c.moveTo(x - s * 0.3, y - s * 0.45);
  c.lineTo(x + s * 0.3, y - s * 0.45);
  c.lineTo(x + s, y + s * 0.1);
  c.lineTo(x - s, y + s * 0.1);
  c.closePath();
  c.fill();
  if (R.lamp > 0.05) {
    c.fillStyle = rgba('#fff2c8', 0.85 * R.lamp);
    c.beginPath(); c.ellipse(x, y + s * 0.1, s * 0.92, s * 0.12, 0, 0, TAU); c.fill();
  }
}

/** The lamp's pool of light at night on the surface and the wall (baked into the far layer). */
function lampPool(c: Ctx, R: Room, x: number, y: number, r: number): void {
  if (R.lamp <= 0.05) return;
  c.save();
  c.globalCompositeOperation = 'lighter';
  glow(c, '#ffb868', x, y, r * 2.4, 0.22 * R.lamp);
  glow(c, '#ffd8a0', x, y, r, 0.3 * R.lamp);
  c.restore();
}

/** A young person's poster on the wall: taped corners, a sun over waves (a teen's a little louder). */
function poster(c: Ctx, R: Room, x: number, y: number, w: number, h: number, loud: boolean): void {
  shadow(c, x + w * 0.52, y + h * 0.55, w * 0.6, h * 0.58, 0.12);
  c.fillStyle = lin(c, x, y, x, y + h, [[0, tone(loud ? '#3a2a6a' : '#e8d8c0', R, 0.3)], [1, tone(loud ? '#c8486a' : '#c8a888', R, 0.3)]]);
  c.fillRect(x, y, w, h);
  ell(c, x + w * 0.5, y + h * 0.42, w * 0.26, w * 0.26, tone(loud ? '#ffb84a' : '#f6e8c8', R, 0.5));
  for (let i = 0; i < 3; i++) {
    c.strokeStyle = tone(loud ? '#5ad0e0' : '#7a9ab8', R, 0.4);
    c.lineWidth = h * 0.035;
    c.beginPath();
    c.moveTo(x + w * 0.05, y + h * (0.66 + i * 0.09));
    c.bezierCurveTo(x + w * 0.3, y + h * (0.6 + i * 0.09), x + w * 0.6, y + h * (0.74 + i * 0.09), x + w * 0.95, y + h * (0.64 + i * 0.09));
    c.stroke();
  }
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const) rect(c, px - 0.05, py - 0.03, 0.1, 0.06, rgba('#f0e8c0', 0.75));
}

/** Photographs of a family on the wall: three small frames, people in them (no features). */
function photos(c: Ctx, R: Room, x: number, y: number): void {
  const frames: [number, number, number, number][] = [[0, 0, 0.42, 0.52], [0.52, 0.12, 0.36, 0.42], [0.18, 0.62, 0.5, 0.36]];
  frames.forEach(([dx, dy, w, h], i) => {
    const fx = x + dx, fy = y + dy;
    shadow(c, fx + w * 0.52, fy + h * 0.55, w * 0.6, h * 0.6, 0.12);
    rect(c, fx - 0.04, fy - 0.04, w + 0.08, h + 0.08, tone(i === 1 ? '#c8a46a' : '#6a4a32', R, 0.4));
    rect(c, fx, fy, w, h, tone(['#c8d8e0', '#e8d8b8', '#d8e4c8'][i], R, 0.3));
    for (let k = 0; k < (i === 2 ? 3 : 2); k++) {
      const px = fx + w * (0.3 + k * (i === 2 ? 0.2 : 0.4)), sz = h * (k === 2 ? 0.45 : 0.6);
      ell(c, px, fy + h - sz * 0.62, sz * 0.12, sz * 0.14, tone('#d8a888', R, 0.3));
      ell(c, px, fy + h - sz * 0.2, sz * 0.22, sz * 0.28, tone(['#5a6a8a', '#a85a4a', '#6a8a5a'][k], R, 0.3));
    }
  });
}

// ── the kitchen ───────────────────────────────────────────────────

const KITCHEN_WIN: [number, number, number, number] = [-1.5, -2.62, -0.2, -1.12];

const kitchen: PlaceSet = {
  id: 'kitchen',
  face: 0.14,
  back(c, S, R) {
    wall(c, S, R, '#f0dfbf', S.y0, 1.4);
    floor(c, S, R, '#b89a78', 1.3, 'tiles');
    // the tiles over the counter
    const ty0 = -1.02;
    rect(c, S.x0, ty0, S.x1 - S.x0, -ty0 + 0.1, tone('#e9efe9', R, 0.2));
    const tw = 0.26;
    for (let i = Math.floor(S.x0 / tw); i * tw < S.x1; i++) {
      for (let j = 0; j < 4; j++) {
        const x = i * tw, y = ty0 + j * tw;
        c.fillStyle = tone(mixHex('#eef3ee', (i + j) % 5 === 0 ? '#c8dcd8' : '#ffffff', 0.4), R, 0.3);
        c.fillRect(x + 0.008, y + 0.008, tw - 0.016, tw - 0.016);
      }
    }
    rect(c, S.x0, ty0 - 0.03, S.x1 - S.x0, 0.03, tone('#bcd0c8', R, 0.3));
    // the window over the sink, a plant on its sill, the morning sun's patch on the tiles
    windowIn(c, R, KITCHEN_WIN[0], KITCHEN_WIN[1], KITCHEN_WIN[2], KITCHEN_WIN[3], 'garden', '#f6efe2', 11);
    plant(c, R, -0.5, KITCHEN_WIN[3] + 0.04, 0.34, '#d8885a', '#6aa85a', 3);
    ell(c, -1.18, KITCHEN_WIN[3] - 0.07, 0.07, 0.11, tone('#e8c070', R, 0.5));
    sunPatch(c, R, KITCHEN_WIN[0], KITCHEN_WIN[1], KITCHEN_WIN[2], KITCHEN_WIN[3], 1.05, 1.25);
    // the cupboards above, left of the window and right over the shelf
    cabinets(c, R, S.x0, -1.95, -3.35, -2.05, '#a9c2a6', 0.8);
    cabinets(c, R, 0.25, 2.45, -3.35, -2.05, '#a9c2a6', 0.73);
    cabinets(c, R, 3.85, S.x1, -3.35, -2.05, '#a9c2a6', 0.8);
    // the shelf: jars, a radio
    rect(c, 0.25, -1.56, 1.8, 0.05, tone('#a8784a', R, 0.4));
    for (let i = 0; i < 3; i++) {
      const x = 0.42 + i * 0.26;
      c.fillStyle = rgba(tone('#e8f0f0', R, 0.5), 0.75);
      rrect(c, x - 0.09, -1.86, 0.18, 0.3, 0.04);
      c.fill();
      rect(c, x - 0.08, -1.76 + i * 0.03, 0.16, 0.18 - i * 0.03, tone(['#e8b860', '#c86a3a', '#f0e0c0'][i], R, 0.4));
      rect(c, x - 0.1, -1.9, 0.2, 0.05, tone('#a8784a', R));
    }
    // the radio (music)
    c.fillStyle = lin(c, 1.3, -1.92, 1.3, -1.56, [[0, tone('#d8a060', R, 0.5)], [1, tone('#9a6a3a', R)]]);
    rrect(c, 1.28, -1.92, 0.58, 0.36, 0.05);
    c.fill();
    ell(c, 1.45, -1.74, 0.1, 0.1, tone('#5a4636', R));
    c.strokeStyle = rgba('#000000', 0.25);
    c.lineWidth = 0.01;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(1.45, -1.74, 0.025 + i * 0.022, 0, TAU); c.stroke(); }
    rect(c, 1.62, -1.84, 0.18, 0.06, tone('#f4e8c8', R, 0.5));
    ell(c, 1.7, -1.66, 0.03, 0.03, tone('#3a3430', R));
    c.strokeStyle = tone('#3a3430', R);
    c.beginPath(); c.moveTo(1.8, -1.92); c.lineTo(1.95, -2.2); c.stroke();
    lightSwitch(c, R, 2.3, -0.62, 0.17);
    // the cupboards' undersides lit at night; the window dark then
    if (R.lamp > 0.05) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let x = 0.4; x < 2.4; x += 0.4) glow(c, '#ffd090', x, -1.95, 0.6, 0.18 * R.lamp, 0.5);
      c.restore();
    }
  },
  front(c, S, R) {
    // the counter's front: cupboard doors, a plinth; the worktop
    cabinets(c, R, S.x0, 2.55, 0.07, 1.35, '#a9c2a6', 0.62);
    rect(c, S.x0, 1.35, 2.55 - S.x0, S.y1 - 1.35, tone('#5a4a3c', R));
    vgrad(c, S.x0, -0.07, 2.55 - S.x0, 0.14, tone('#f2ece2', R, 0.6), tone('#cfc6b8', R));
    rect(c, S.x0, -0.075, 2.55 - S.x0, 0.012, rgba('#ffffff', 0.35));
    // a tea towel over the oven's handle
    c.fillStyle = tone('#f4f0e8', R, 0.4);
    c.fillRect(0.2, 0.15, 0.34, 0.62);
    for (let i = 0; i < 3; i++) rect(c, 0.2, 0.25 + i * 0.18, 0.34, 0.04, tone('#c8503a', R, 0.4));
    // the sink and the tap
    ell(c, -0.82, -0.005, 0.46, 0.045, tone('#8a949c', R));
    ell(c, -0.82, 0.0, 0.42, 0.032, tone('#5a646c', R));
    const chrome = lin(c, -0.86, 0, -0.74, 0, [[0, tone('#f0f4f6', R, 0.9)], [0.5, tone('#8a949c', R)], [1, tone('#e8eef2', R, 0.8)]]);
    c.fillStyle = chrome;
    rrect(c, -0.87, -0.32, 0.1, 0.3, 0.02);
    c.fill();
    c.strokeStyle = chrome;
    c.lineWidth = 0.06;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.82, -0.3); c.bezierCurveTo(-0.82, -0.6, -0.56, -0.62, -0.56, -0.4); c.stroke();
    ell(c, -0.82, -0.22, 0.09, 0.025, tone('#e4eaee', R, 0.7));
    // a bowl of apples, the coffee, the kettle, the bread on its board
    ell(c, -2.3, -0.06, 0.34, 0.07, tone('#d8c0a0', R, 0.4));
    drawStill(c, 'apple', R, -2.42, -0.07, 0.3);
    drawStill(c, 'apple', R, -2.16, -0.06, 0.28);
    drawStill(c, 'apple', R, -2.3, -0.2, 0.26);
    c.fillStyle = lin(c, -2.62, 0, -1.98, 0, [[0, tone('#f4ece0', R, 0.6)], [1, tone('#c8b49a', R)]]);
    c.beginPath(); c.moveTo(-2.64, -0.1); c.quadraticCurveTo(-2.3, 0.18, -1.96, -0.1); c.closePath(); c.fill();
    drawStill(c, 'cup', R, 0.45, 0.0, 0.44);
    drawStill(c, 'kettle', R, 1.1, 0.0, 0.7);
    drawStill(c, 'bread', R, 1.92, 0.01, 0.72);
    // the fridge at the side
    c.fillStyle = lin(c, 2.6, 0, 3.7, 0, [[0, tone('#f4f6f2', R, 0.6)], [0.6, tone('#e6e9e4', R, 0.3)], [1, tone('#b8bcb6', R)]]);
    rrect(c, 2.6, -3.1, 1.1, 4.6, 0.08);
    c.fill();
    rect(c, 2.6, -1.95, 1.1, 0.02, rgba('#000000', 0.18));
    rect(c, 2.72, -2.6, 0.04, 0.5, tone('#c8ccc6', R, 0.6));
    rect(c, 2.72, -1.6, 0.04, 0.7, tone('#c8ccc6', R, 0.6));
    // magnets and a child's drawing
    for (const [x, y, col] of [[3.1, -2.5, '#e8503a'], [3.4, -2.3, '#3a8ad8'], [3.3, -1.3, '#f0c040']] as const) ell(c, x, y, 0.035, 0.035, tone(col, R, 0.5));
    rect(c, 3.0, -1.5, 0.42, 0.5, tone('#fbf8ee', R, 0.5));
    ell(c, 3.12, -1.38, 0.06, 0.06, tone('#f0c040', R, 0.5));
    poly(c, [3.05, -1.06, 3.21, -1.2, 3.37, -1.06], tone('#d86a4a', R, 0.4));
    rect(c, 3.09, -1.1, 0.24, 0.08, tone('#d8a060', R, 0.4));
    vignette(c, S, 0.2);
  },
  behind(c, S, R, t) {
    // the garden beyond the window: a bird crossing it now and then, someone passing
    walkers(c, R, t, { y: KITCHEN_WIN[3] - 0.04, h: 0.42, x0: KITCHEN_WIN[0] - 0.3, x1: KITCHEN_WIN[2] + 0.3, n: 1, speed: 0.12, seed: 4, clip: KITCHEN_WIN, alpha: 0.7 });
    if (R.Lt.dusk < 0.6) {
      const ph = (t * 0.07) % 1;
      if (ph < 0.3) {
        const k = ph / 0.3;
        const x = KITCHEN_WIN[0] + (KITCHEN_WIN[2] - KITCHEN_WIN[0]) * k, y = KITCHEN_WIN[1] + 0.4 + Math.sin(k * 9) * 0.05;
        c.strokeStyle = rgba('#2a2a36', 0.7);
        c.lineWidth = 0.014;
        const fl = Math.sin(t * 14);
        c.beginPath(); c.moveTo(x - 0.06, y - 0.03 * fl); c.quadraticCurveTo(x, y, x + 0.06, y - 0.03 * fl); c.stroke();
      }
    }
    void S;
  },
  over(c, S, R, t) {
    drawAlive(c, 'cup', R, 0.45, 0.0, 0.44, t, 0.4);
    drawAlive(c, 'kettle', R, 1.1, 0.0, 0.7, t, 0.2 + 0.2 * Math.max(0, Math.sin(t * 0.13)));
    // the tap's drop, now and then
    const ph = (t * 0.35) % 1;
    if (ph < 0.25) ell(c, -0.56, -0.38 + ph * 1.4, 0.012, 0.018, rgba('#e8f4fa', 0.7));
    void S;
  },
  hot: {
    tap: [-0.68, -0.36], kettle: [1.08, -0.32], bread: [1.88, -0.22], apple: [-2.3, -0.18], cup: [0.45, -0.18], spill: [0.45, -0.1],
    fridge: [3.15, -1.4], switch: [2.3, -0.62], window: [-0.85, -1.9], sky: [-0.85, -2.2], sun: [-0.85, -2.0], rain: [-0.85, -1.9],
    rainbow: [-0.85, -2.0], bird: [-0.85, -2.1], music: [1.57, -1.74],
  },
  aim: [-0.2, -0.9],
  spot: [-0.12, 0.0, 0.5],
  has: ['tap', 'kettle', 'bread', 'apple', 'cup', 'spill', 'fridge', 'switch', 'music'],
  win: KITCHEN_WIN,
};

// ── the bedroom ───────────────────────────────────────────────────

const BED_WIN: [number, number, number, number] = [-1.65, -2.78, -0.3, -1.0];

const bedroom: PlaceSet = {
  id: 'bedroom',
  face: 0.08,
  back(c, S, R) {
    wall(c, S, R, '#ead3c6', S.y0, 1.2);
    // a faint wallpaper of stripes
    c.fillStyle = rgba('#ffffff', 0.06);
    for (let x = Math.floor(S.x0 * 4) / 4; x < S.x1; x += 0.25) c.fillRect(x, S.y0, 0.08, 1.2 - S.y0);
    // the skirting, the floor
    floor(c, S, R, '#b8875e', 0.65, 'boards');
    rect(c, S.x0, 0.55, S.x1 - S.x0, 0.1, tone('#f4ece2', R, 0.3));
    windowIn(c, R, BED_WIN[0], BED_WIN[1], BED_WIN[2], BED_WIN[3], 'roofs', '#f8f2e8', 5);
    sunPatch(c, R, BED_WIN[0], BED_WIN[1], BED_WIN[2], BED_WIN[3], 1.85, 0.5);
    if (S.age === 'teen' || S.age === 'young') poster(c, R, 0.32, -2.62, 0.62, 0.86, S.age === 'teen');
    else picture(c, R, 0.35, -2.5, 0.78, 0.56, 2);
    if (S.age === 'mid' || S.age === 'senior') photos(c, R, -3.45, -2.4);
    else picture(c, R, -3.3, -2.3, 0.5, 0.64, 7);
    // a shelf of books over the bedside table
    rect(c, 1.3, -2.06, 1.3, 0.05, tone('#9a6a44', R, 0.4));
    books(c, R, 1.34, 2.3, -2.06, 0.42, 3);
    plant(c, R, 2.45, -2.06, 0.26, '#e0e0d8', '#5f9a5a', 8);
    lightSwitch(c, R, 2.95, -1.1, 0.17);
    beam(c, R, (BED_WIN[0] + BED_WIN[2]) / 2, BED_WIN[3], 1.1, 3.2, -0.55);
  },
  front(c, S, R) {
    // the bed: its headboard at the left, the frame, the mattress, the duvet with its folds, two pillows
    c.fillStyle = lin(c, -3.1, 0, -2.75, 0, [[0, tone('#8a5e3e', R, 0.3)], [1, tone('#b0805a', R, 0.6)]]);
    rrect(c, -3.15, -1.35, 0.38, 2.1, 0.1);
    c.fill();
    rect(c, -2.8, 0.15, 3.9, 0.42, tone('#a87650', R, 0.3));
    rect(c, -2.8, 0.15, 3.9, 0.04, rgba('#ffffff', 0.15));
    rect(c, 0.95, 0.5, 0.12, 0.3, tone('#7a5236', R));
    shadow(c, -0.8, 0.82, 2.4, 0.12, 0.25);
    // pillows
    for (const [x, w] of [[-2.35, 0.78], [-1.55, 0.72]] as const) {
      c.fillStyle = lin(c, x - w / 2, -0.7, x + w / 2, -0.1, [[0, tone('#ffffff', R, 0.7)], [1, tone('#d8d0c6', R)]]);
      c.beginPath();
      c.moveTo(x - w / 2, -0.12);
      c.bezierCurveTo(x - w / 2 - 0.04, -0.5, x - w / 2 + 0.06, -0.7, x, -0.68);
      c.bezierCurveTo(x + w / 2 - 0.06, -0.7, x + w / 2 + 0.04, -0.5, x + w / 2, -0.12);
      c.closePath();
      c.fill();
    }
    // the duvet: soft, thrown back a little at the pillows
    c.fillStyle = lin(c, 0, -0.42, 0, 0.2, [[0, tone('#f0d0b8', R, 0.7)], [1, tone('#c89a80', R)]]);
    c.beginPath();
    c.moveTo(-2.75, 0.18);
    c.lineTo(-2.75, -0.2);
    c.bezierCurveTo(-2.0, -0.34, -1.3, -0.14, -1.0, -0.32);
    c.bezierCurveTo(-0.5, -0.46, 0.4, -0.36, 1.12, -0.3);
    c.quadraticCurveTo(1.22, -0.05, 1.12, 0.22);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#8a5a44', 0.25);
    c.lineWidth = 0.018;
    for (const [a, b] of [[-0.7, -0.38], [0.1, -0.36], [0.7, -0.32]] as const) {
      c.beginPath(); c.moveTo(a, b); c.quadraticCurveTo(a + 0.15, -0.1, a + 0.05, 0.16); c.stroke();
    }
    // the folded-back edge
    c.fillStyle = tone('#f8f0e6', R, 0.7);
    c.beginPath(); c.moveTo(-2.75, -0.22); c.bezierCurveTo(-2.0, -0.36, -1.3, -0.16, -1.0, -0.34); c.lineTo(-0.98, -0.24); c.bezierCurveTo(-1.3, -0.06, -2.0, -0.26, -2.75, -0.1); c.closePath(); c.fill();
    // a knit blanket over the foot of the bed
    c.fillStyle = lin(c, 0.2, 0, 1.15, 0, [[0, tone('#9ab0c8', R, 0.5)], [1, tone('#6a82a0', R)]]);
    c.beginPath(); c.moveTo(0.25, -0.38); c.quadraticCurveTo(0.7, -0.42, 1.14, -0.32); c.quadraticCurveTo(1.25, 0.0, 1.14, 0.3); c.lineTo(0.3, 0.32); c.quadraticCurveTo(0.2, 0.0, 0.25, -0.38); c.fill();
    c.strokeStyle = rgba('#ffffff', 0.16);
    c.lineWidth = 0.012;
    for (let i = 0; i < 9; i++) { const x = 0.32 + i * 0.1; c.beginPath(); c.moveTo(x, -0.36); c.lineTo(x + 0.02, 0.3); c.stroke(); }
    // the bedside table with its lamp, an alarm clock, a book
    c.fillStyle = lin(c, 1.3, 0, 2.15, 0, [[0, tone('#c89a6a', R, 0.5)], [1, tone('#8a6040', R)]]);
    c.fillRect(1.3, -0.05, 0.85, 0.8);
    rect(c, 1.27, -0.09, 0.91, 0.06, tone('#d8aa78', R, 0.6));
    rect(c, 1.38, 0.1, 0.69, 0.26, tone('#b8885a', R, 0.4));
    ell(c, 1.72, 0.23, 0.03, 0.03, tone('#e8c890', R, 0.6));
    // the lamp
    rect(c, 1.86, -0.62, 0.035, 0.53, tone('#c8a46a', R, 0.5));
    ell(c, 1.88, -0.1, 0.13, 0.03, tone('#c8a46a', R, 0.5));
    c.fillStyle = lin(c, 1.6, 0, 2.15, 0, [[0, tone('#f0dcbc', R, 0.4, 1)], [0.5, tone('#fbf0dc', R, 0.6, 1)], [1, tone('#d8c0a0', R, 0, 1)]]);
    c.beginPath(); c.moveTo(1.72, -1.0); c.lineTo(2.04, -1.0); c.lineTo(2.14, -0.6); c.lineTo(1.62, -0.6); c.closePath(); c.fill();
    lampLight(c, 1.88, -0.7, 0.35, R.lamp);
    lampPool(c, R, 1.88, -0.3, 0.8);
    // the alarm clock and a book
    ell(c, 1.5, -0.2, 0.11, 0.11, tone('#d8503a', R, 0.5));
    ell(c, 1.5, -0.2, 0.08, 0.08, tone('#fbf6ea', R, 0.6));
    c.strokeStyle = tone('#3a3430', R);
    c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(1.5, -0.2); c.lineTo(1.5, -0.26); c.moveTo(1.5, -0.2); c.lineTo(1.54, -0.18); c.stroke();
    rect(c, 1.98, -0.17, 0.3, 0.08, tone('#3f6a8a', R, 0.4));
    rect(c, 2.0, -0.25, 0.26, 0.08, tone('#d8a84a', R, 0.4));
    // a chair with a sweater over it, at the side
    c.fillStyle = tone('#8a6a4a', R, 0.3);
    c.fillRect(2.65, -1.2, 0.07, 2.0);
    c.fillRect(3.4, -1.2, 0.07, 2.0);
    rect(c, 2.6, -0.05, 0.92, 0.08, tone('#a8845a', R, 0.5));
    rect(c, 2.65, -1.2, 0.82, 0.12, tone('#a8845a', R, 0.5));
    drawStill(c, 'sweater', R, 3.06, 0.0, 0.7);
    // a rug
    c.fillStyle = lin(c, 0, 0.9, 0, 1.6, [[0, tone('#c86a5a', R, 0.4)], [1, tone('#8a4a3a', R)]]);
    c.beginPath(); c.ellipse(0.2, 1.3, 2.2, 0.4, 0, 0, TAU); c.fill();
    // the curtains
    curtains(c, R, BED_WIN[0], BED_WIN[2], BED_WIN[1], BED_WIN[3], '#e8c0a8');
    vignette(c, S, 0.22);
  },
  behind(c, S, R, t) {
    walkers(c, R, t, { y: BED_WIN[3] - 0.1, h: 0.28, x0: BED_WIN[0] - 0.2, x1: BED_WIN[2] + 0.2, n: 2, speed: 0.1, seed: 7, clip: BED_WIN, alpha: 0.6 });
    // dust in the morning beam
    if (R.sunK > 0.1) motes(c, -0.6, -2.4, 2.2, 2.2, t, R.sunK, 16);
    void S;
  },
  hot: {
    bed: [-1.6, -0.36], window: [-0.98, -1.9], sky: [-0.98, -2.3], sun: [-0.98, -2.1], rain: [-0.98, -1.9], rainbow: [-0.98, -2.0],
    switch: [2.95, -1.1], book: [2.13, -0.2], clock: [1.5, -0.2], sweater: [3.06, -0.3], bird: [-0.98, -2.2],
  },
  aim: [-0.5, -1.1],
  spot: [0.05, -0.32, 0.5],
  has: ['bed', 'switch', 'book', 'clock', 'sweater'],
  win: BED_WIN,
};

// ── the bathroom ──────────────────────────────────────────────────

const BATH_WIN: [number, number, number, number] = [-2.75, -2.85, -1.95, -2.1];

const bathroom: PlaceSet = {
  id: 'bathroom',
  face: 0.2,
  back(c, S, R) {
    // tiles from the floor to the ceiling, a decorative band, the floor's tiles
    rect(c, S.x0, S.y0, S.x1 - S.x0, 1.4 - S.y0, tone('#d8e8e6', R, 0.3));
    const tw = 0.3;
    for (let i = Math.floor(S.x0 / tw); i * tw < S.x1; i++) {
      for (let j = Math.floor(S.y0 / tw); j * tw < 1.4; j++) {
        c.fillStyle = tone(mixHex('#e4f0ee', hash(i * 7 + j * 13) < 0.15 ? '#c8dedc' : '#f4faf8', 0.5), R, 0.3);
        c.fillRect(i * tw + 0.01, j * tw + 0.01, tw - 0.02, tw - 0.02);
      }
    }
    rect(c, S.x0, -1.62, S.x1 - S.x0, 0.1, tone('#5a9a9a', R, 0.4));
    floor(c, S, R, '#c8c0b4', 0.9, 'tiles');
    // the frosted window high up
    windowIn(c, R, BATH_WIN[0], BATH_WIN[1], BATH_WIN[2], BATH_WIN[3], 'trees', '#ffffff', 9, 1);
    rect(c, BATH_WIN[0], BATH_WIN[1], BATH_WIN[2] - BATH_WIN[0], BATH_WIN[3] - BATH_WIN[1], rgba('#ffffff', 0.45));
    // the mirror over the basin: the room in it, softly; a light strip over it
    c.fillStyle = tone('#b8c4c4', R, 0.3);
    rrect(c, -1.04, -2.78, 1.28, 1.7, 0.12);
    c.fill();
    c.fillStyle = lin(c, -1.0, -2.74, 0.2, -1.12, [[0, tone('#e8f2f4', R, 0.6)], [0.5, tone('#c8d8dc', R, 0.3)], [1, tone('#dce8ea', R, 0.4)]]);
    rrect(c, -0.98, -2.72, 1.16, 1.58, 0.09);
    c.fill();
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba('#ffffff', 0.16);
    poly(c, [-0.9, -2.7, -0.55, -2.7, -0.95, -1.4, -0.98, -1.6], rgba('#ffffff', 0.16));
    c.restore();
    rect(c, -0.85, -2.98, 0.9, 0.1, tone('#f4f4f0', R, 0.6, 1));
    lampLight(c, -0.4, -2.88, 0.3, Math.max(R.lamp, 0.3));
    // the towel on its rail
    rect(c, 0.62, -1.88, 0.85, 0.04, tone('#c8ccd0', R, 0.7));
    c.fillStyle = lin(c, 0.7, 0, 1.4, 0, [[0, tone('#e88a6a', R, 0.4)], [0.5, tone('#f4a888', R, 0.6)], [1, tone('#c86a50', R)]]);
    c.beginPath(); c.moveTo(0.7, -1.86); c.lineTo(1.4, -1.86); c.quadraticCurveTo(1.44, -1.3, 1.38, -0.9); c.lineTo(0.72, -0.9); c.quadraticCurveTo(0.66, -1.3, 0.7, -1.86); c.fill();
    rect(c, 0.72, -1.06, 0.66, 0.05, rgba('#ffffff', 0.4));
    lightSwitch(c, R, -1.6, -1.15, 0.17);
    // the shower behind its glass at the right: the head, its hose
    rect(c, 2.0, S.y0, S.x1 - 2.0, 1.4 - S.y0, rgba(tone('#b8d0d0', R), 0.35));
    const chrome = lin(c, 2.7, 0, 3.0, 0, [[0, tone('#f0f4f6', R, 0.9)], [0.5, tone('#8a949c', R)], [1, tone('#e8eef2', R, 0.8)]]);
    c.strokeStyle = chrome;
    c.lineWidth = 0.05;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(3.3, -3.2); c.lineTo(3.3, -2.7); c.quadraticCurveTo(3.3, -2.55, 2.95, -2.55); c.stroke();
    c.fillStyle = chrome;
    c.beginPath(); c.ellipse(2.85, -2.48, 0.22, 0.07, 0, 0, TAU); c.fill();
    c.fillRect(3.25, -1.6, 0.1, 0.5);
  },
  front(c, S, R) {
    // the vanity: a white basin on a wooden cabinet, the tap
    c.fillStyle = lin(c, -1.3, 0, 0.5, 0, [[0, tone('#c8a078', R, 0.5)], [1, tone('#8a6440', R)]]);
    c.fillRect(-1.35, 0.06, 1.85, 1.0);
    rect(c, -1.3, 0.2, 0.86, 0.75, tone('#b88a60', R, 0.4));
    rect(c, -0.36, 0.2, 0.8, 0.75, tone('#b88a60', R, 0.4));
    ell(c, -0.5, 0.58, 0.03, 0.03, tone('#e8d0a0', R, 0.6));
    ell(c, -0.2, 0.58, 0.03, 0.03, tone('#e8d0a0', R, 0.6));
    vgrad(c, -1.42, -0.08, 1.98, 0.14, tone('#fbfbf8', R, 0.7), tone('#d8dcd8', R));
    ell(c, -0.43, -0.03, 0.5, 0.06, tone('#f4f6f4', R, 0.6));
    ell(c, -0.43, -0.02, 0.42, 0.045, lin(c, 0, -0.06, 0, 0.02, [[0, tone('#b8c0c4', R)], [1, tone('#eef2f2', R, 0.4)]]));
    const chrome = lin(c, -0.48, 0, -0.36, 0, [[0, tone('#f0f4f6', R, 0.9)], [0.5, tone('#8a949c', R)], [1, tone('#e8eef2', R, 0.8)]]);
    c.fillStyle = chrome;
    rrect(c, -0.48, -0.36, 0.1, 0.32, 0.02);
    c.fill();
    c.strokeStyle = chrome;
    c.lineWidth = 0.055;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-0.43, -0.34); c.quadraticCurveTo(-0.43, -0.48, -0.24, -0.44); c.stroke();
    // soap, a cup with brushes, a little plant
    ell(c, -1.12, -0.07, 0.12, 0.04, tone('#f6c8b0', R, 0.5));
    c.fillStyle = rgba(tone('#c8e0e8', R, 0.5), 0.85);
    rrect(c, 0.16, -0.32, 0.16, 0.26, 0.03);
    c.fill();
    for (const [dx, col] of [[-0.03, '#3a8ad8'], [0.04, '#e8603a']] as const) {
      c.strokeStyle = tone(col, R, 0.5);
      c.lineWidth = 0.025;
      c.beginPath(); c.moveTo(0.24 + dx, -0.24); c.lineTo(0.24 + dx * 2, -0.52); c.stroke();
    }
    plant(c, R, 0.68, -0.06, 0.3, '#f0f0ea', '#5f9a5a', 12);
    // the bath mat
    c.fillStyle = lin(c, 0, 1.1, 0, 1.5, [[0, tone('#7ab0b0', R, 0.4)], [1, tone('#4a8080', R)]]);
    rrect(c, -1.4, 1.15, 1.9, 0.36, 0.08);
    c.fill();
    // the shower's glass edge
    c.strokeStyle = rgba('#ffffff', 0.45);
    c.lineWidth = 0.03;
    c.beginPath(); c.moveTo(2.0, S.y0); c.lineTo(2.0, 1.4); c.stroke();
    vignette(c, S, 0.2);
  },
  over(c, S, R, t) {
    const ph = (t * 0.4) % 1;
    if (ph < 0.3) ell(c, -0.25, -0.4 + ph * 1.2, 0.012, 0.018, rgba('#e8f4fa', 0.7));
    // a little steam in the warm air
    if (t) steam(c, -0.43, -0.1, 0.8, t * 0.5, 0.25, 2);
    void S; void R;
  },
  hot: {
    tap: [-0.3, -0.32], shower: [2.85, -2.2], window: [-2.35, -2.45], sky: [-2.35, -2.45], sun: [-2.35, -2.45], eyes: [-0.42, -1.9],
    switch: [-1.6, -1.15], sweater: [1.05, -1.4], rain: [-2.35, -2.45],
  },
  aim: [-0.4, -1.2],
  spot: [1.05, -0.06, 0.42],
  has: ['tap', 'shower', 'switch'],
  win: BATH_WIN,
};

// ── home with small children ──────────────────────────────────────

const NUR_WIN: [number, number, number, number] = [0.55, -2.7, 1.95, -1.05];

const nursery: PlaceSet = {
  id: 'nursery',
  face: 0.4,
  back(c, S, R) {
    wall(c, S, R, '#f4e6be', S.y0, 0.2);
    // tiny dots on the wallpaper, a dado rail and the lower wall
    c.fillStyle = rgba('#e8a060', 0.12);
    for (let i = 0; i < 260; i++) {
      const x = S.x0 + (S.x1 - S.x0) * hash(i * 3 + 1), y = S.y0 + (-1.0 - S.y0) * hash(i * 7 + 2);
      c.beginPath(); c.arc(x, y, 0.025, 0, TAU); c.fill();
    }
    rect(c, S.x0, -0.95, S.x1 - S.x0, 0.07, tone('#fbf4e2', R, 0.4));
    rect(c, S.x0, -0.88, S.x1 - S.x0, 1.1, tone('#b8d0c0', R, 0.3));
    floor(c, S, R, '#d8b890', 0.2, 'boards');
    windowIn(c, R, NUR_WIN[0], NUR_WIN[1], NUR_WIN[2], NUR_WIN[3], 'trees', '#ffffff', 13);
    sunPatch(c, R, NUR_WIN[0], NUR_WIN[1], NUR_WIN[2], NUR_WIN[3], -1.4, 1.2);
    // children's drawings on the wall: a house under a sun, a rainbow, a flower
    const paper = (x: number, y: number, a: number, draw: () => void) => {
      c.save(); c.translate(x, y); c.rotate(a);
      shadow(c, 0.02, 0.04, 0.34, 0.26, 0.12);
      rect(c, -0.3, -0.22, 0.6, 0.44, tone('#fffdf6', R, 0.5));
      rect(c, -0.05, -0.26, 0.1, 0.06, rgba(tone('#f0e0a0', R), 0.8));
      draw();
      c.restore();
    };
    paper(-0.85, -2.35, -0.06, () => {
      rect(c, -0.16, -0.02, 0.22, 0.16, tone('#e8603a', R, 0.4));
      poly(c, [-0.19, -0.02, -0.05, -0.14, 0.09, -0.02], tone('#c83a2a', R, 0.4));
      ell(c, 0.18, -0.12, 0.06, 0.06, tone('#f8c830', R, 0.5));
      rect(c, -0.28, 0.14, 0.56, 0.04, tone('#5aaa4a', R, 0.4));
    });
    paper(-1.75, -2.15, 0.07, () => {
      const cols = ['#e8503a', '#f0a030', '#f0d040', '#5aaa4a', '#3a8ad8'];
      cols.forEach((col, i) => { c.strokeStyle = tone(col, R, 0.4); c.lineWidth = 0.025; c.beginPath(); c.arc(0, 0.15, 0.22 - i * 0.03, Math.PI, TAU); c.stroke(); });
    });
    paper(-2.7, -2.4, -0.04, () => {
      c.strokeStyle = tone('#4a8a3a', R, 0.4); c.lineWidth = 0.02;
      c.beginPath(); c.moveTo(0, 0.18); c.lineTo(0, -0.02); c.stroke();
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; ell(c, Math.cos(a) * 0.06, -0.06 + Math.sin(a) * 0.06, 0.05, 0.03, tone('#e870a0', R, 0.4), a); }
      ell(c, 0, -0.06, 0.03, 0.03, tone('#f8d040', R, 0.5));
    });
    // a shelf of toys and picture books
    rect(c, -2.55, -1.45, 1.45, 0.05, tone('#d8a878', R, 0.4));
    books(c, R, -2.5, -1.85, -1.45, 0.36, 5);
    // a little teddy sitting on the shelf, blocks
    ell(c, -1.5, -1.62, 0.13, 0.15, tone('#c8905a', R, 0.5));
    ell(c, -1.5, -1.85, 0.1, 0.09, tone('#d8a06a', R, 0.5));
    for (const s of [-1, 1]) ell(c, -1.5 + s * 0.08, -1.93, 0.035, 0.035, tone('#b8804a', R, 0.4));
    for (let i = 0; i < 3; i++) rect(c, -1.3 + i * 0.07, -1.55 - (i === 1 ? 0.1 : 0), 0.09, 0.09, tone(['#e8503a', '#3a8ad8', '#f0c040'][i], R, 0.5));
  },
  front(c, S, R) {
    // a soft rug, a tower of blocks, a teddy bear, a ball, a toy car; a high chair; the cot's bars at the side
    c.fillStyle = lin(c, 0, 0.1, 0, 1.4, [[0, tone('#e8c8d8', R, 0.4)], [1, tone('#b890a8', R)]]);
    c.beginPath(); c.ellipse(0.0, 0.7, 2.8, 0.75, 0, 0, TAU); c.fill();
    c.strokeStyle = rgba('#ffffff', 0.2);
    c.lineWidth = 0.02;
    c.beginPath(); c.ellipse(0.0, 0.7, 2.5, 0.6, 0, 0, TAU); c.stroke();
    const blocks: [number, number, string][] = [[-0.62, 0, '#e8503a'], [-0.36, 0, '#3a8ad8'], [-0.49, -0.26, '#f0c040'], [-0.49, -0.52, '#5aaa4a']];
    shadow(c, -0.49, 0.02, 0.36, 0.05, 0.3);
    for (const [x, y, col] of blocks) {
      c.fillStyle = lin(c, x - 0.12, y - 0.26, x + 0.12, y, [[0, tone(mixHex(col, '#ffffff', 0.2), R, 0.6)], [1, tone(col, R, 0.3)]]);
      rrect(c, x - 0.125, y - 0.25, 0.25, 0.25, 0.03);
      c.fill();
      ell(c, x, y - 0.125, 0.05, 0.05, rgba('#ffffff', 0.45));
    }
    // the teddy
    shadow(c, 0.42, 0.03, 0.3, 0.05, 0.3);
    const fur = '#c8905a';
    ell(c, 0.42, -0.25, 0.22, 0.25, tone(fur, R, 0.5));
    ell(c, 0.42, -0.2, 0.13, 0.15, tone('#e8c8a0', R, 0.5));
    for (const s of [-1, 1]) { ell(c, 0.42 + s * 0.2, -0.05, 0.1, 0.07, tone(fur, R, 0.4)); ell(c, 0.42 + s * 0.22, -0.32, 0.07, 0.12, tone(fur, R, 0.4), s * 0.4); }
    ell(c, 0.42, -0.6, 0.17, 0.15, tone(fur, R, 0.6));
    for (const s of [-1, 1]) { ell(c, 0.42 + s * 0.14, -0.72, 0.06, 0.06, tone(fur, R, 0.5)); ell(c, 0.42 + s * 0.14, -0.72, 0.03, 0.03, tone('#e8b890', R, 0.5)); }
    ell(c, 0.42, -0.56, 0.06, 0.045, tone('#e8c8a0', R, 0.5));
    ell(c, 0.42, -0.57, 0.02, 0.015, tone('#3a2418', R));
    for (const s of [-1, 1]) ell(c, 0.42 + s * 0.06, -0.63, 0.015, 0.015, tone('#1a1210', R));
    // a ball, a toy car
    shadow(c, 1.0, 0.1, 0.16, 0.03, 0.3);
    ell(c, 1.0, -0.04, 0.13, 0.13, lin(c, 0.88, -0.16, 1.12, 0.08, [[0, tone('#ffe080', R, 0.7)], [0.5, tone('#e8503a', R, 0.5)], [1, tone('#3a6ab8', R)]]));
    rrect(c, -1.4, -0.14, 0.42, 0.14, 0.05);
    c.fillStyle = tone('#3aa07a', R, 0.5);
    c.fill();
    for (const x of [-1.32, -1.06]) ell(c, x, 0.0, 0.05, 0.05, tone('#2a2a30', R));
    // the high chair
    c.strokeStyle = tone('#e8e0d4', R, 0.5);
    c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(1.62, 0.9); c.lineTo(1.78, -1.1); c.moveTo(2.36, 0.9); c.lineTo(2.2, -1.1); c.stroke();
    rect(c, 1.66, -1.18, 0.7, 0.1, tone('#f4ece0', R, 0.6));
    c.fillStyle = tone('#f4ece0', R, 0.4);
    rrect(c, 1.78, -1.9, 0.44, 0.75, 0.08);
    c.fill();
    rect(c, 1.5, -1.28, 1.0, 0.07, tone('#d8c8b0', R, 0.5));
    // the cot's bars at the left
    c.fillStyle = tone('#f4f0ea', R, 0.5);
    c.fillRect(-3.4, -1.3, 1.2, 0.08);
    c.fillRect(-3.4, 0.3, 1.2, 0.08);
    for (let i = 0; i < 7; i++) c.fillRect(-3.38 + i * 0.19, -1.25, 0.05, 1.6);
    vignette(c, S, 0.18);
  },
  behind(c, S, R, t) {
    walkers(c, R, t, { y: NUR_WIN[3] - 0.15, h: 0.32, x0: NUR_WIN[0] - 0.2, x1: NUR_WIN[2] + 0.2, n: 1, speed: 0.1, seed: 3, clip: NUR_WIN, alpha: 0.6 });
    // the mobile over the cot, turning slowly
    const x = -2.8, y = -2.6;
    c.strokeStyle = tone('#8a7a6a', R);
    c.lineWidth = 0.012;
    c.beginPath(); c.moveTo(x, S.y0); c.lineTo(x, y); c.moveTo(x - 0.45, y); c.lineTo(x + 0.45, y); c.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + t * 0.25;
      const px = x + Math.cos(a) * 0.4, sc = 0.7 + 0.3 * Math.sin(a);
      c.beginPath(); c.moveTo(px, y); c.lineTo(px, y + 0.3); c.stroke();
      const col = ['#f0c040', '#e870a0', '#5aa8e8', '#7ad070'][i];
      c.fillStyle = tone(col, R, 0.5);
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 0.04 : 0.09;
        const aa = (k / 10) * TAU - Math.PI / 2;
        const qx = px + Math.cos(aa) * r * sc, qy = y + 0.38 + Math.sin(aa) * r;
        if (k) c.lineTo(qx, qy); else c.moveTo(qx, qy);
      }
      c.closePath();
      c.fill();
    }
  },
  hot: {
    window: [1.25, -1.9], sky: [1.25, -2.2], sun: [1.25, -2.0], rain: [1.25, -1.9], rainbow: [1.25, -2.0], book: [-2.2, -1.62],
    bed: [-2.8, -0.6], smile: [0.42, -0.45], music: [-2.8, -2.2], bird: [1.25, -2.1],
  },
  aim: [0.0, -0.9],
  spot: [1.45, 0.08, 0.44],
  has: ['bed'],
  win: NUR_WIN,
};

// ── the evening table ─────────────────────────────────────────────

const TABLE_WIN: [number, number, number, number] = [-2.35, -2.8, -1.05, -1.15];

const table: PlaceSet = {
  id: 'table',
  face: 0.72,
  back(c, S, R) {
    wall(c, S, R, '#e6cca4', S.y0, 1.2);
    rect(c, S.x0, -0.6, S.x1 - S.x0, 0.05, tone('#f4e8d0', R, 0.3));
    rect(c, S.x0, -0.55, S.x1 - S.x0, 1.8, tone('#c8a47a', R, 0.2));
    windowIn(c, R, TABLE_WIN[0], TABLE_WIN[1], TABLE_WIN[2], TABLE_WIN[3], 'roofs', '#f6efe2', 17);
    sunPatch(c, R, TABLE_WIN[0], TABLE_WIN[1], TABLE_WIN[2], TABLE_WIN[3], 1.6, 0.9);
    // the sideboard with photos and a vase of flowers
    c.fillStyle = lin(c, 1.5, 0, 3.6, 0, [[0, tone('#9a6a44', R, 0.4)], [1, tone('#6a4428', R)]]);
    c.fillRect(1.55, -1.0, 2.1, 1.6);
    rect(c, 1.5, -1.05, 2.2, 0.07, tone('#b8865a', R, 0.5));
    picture(c, R, 2.75, -1.62, 0.38, 0.48, 21);
    picture(c, R, 3.25, -1.48, 0.3, 0.36, 23);
    drawStill(c, 'flower', R, 2.15, -1.02, 0.7);
    // the pendant lamp over the table
    pendant(c, R, 0.2, -2.35, 0.36, '#e8b870');
    lampLight(c, 0.2, -2.2, 0.5, Math.max(R.lamp, 0.15));
    lampPool(c, R, 0.2, -0.9, 1.4);
    // the people at the table: a calm presence, faces in the lamp's light — who they are follows the group's life
    // (a teen's parents, a student's friends, a family with a child, an older couple with a grandchild)
    const age = S.age ?? 'adult';
    const grey = age === 'senior' ? '#d8d4cc' : age === 'mid' ? '#6a5a4a' : '#3a2a22';
    person(c, R, -0.95, 0.0, 2.05, age === 'young' ? '#3a8a7a' : '#5a6a8a', grey, { sit: true, skin: '#e0b090' });
    person(c, R, 1.28, 0.0, 1.95, age === 'young' ? '#d8a040' : '#a85a4a', age === 'senior' ? '#e8e4dc' : '#8a6a4a', { sit: true, skin: '#d8a888' });
    if (age === 'adult' || age === 'mid' || age === 'senior') person(c, R, 0.18, 0.0, 1.35, '#e8603a', '#b8864a', { sit: true, skin: '#f0c0a0' });
    // the empty chair at the near side is the player's: its back at the front layer
  },
  front(c, S, R) {
    // the table and its cloth
    c.fillStyle = lin(c, 0, -0.06, 0, 0.9, [[0, tone('#fbf6ec', R, 0.6, 0.6)], [1, tone('#d8ccb8', R, 0, 0.4)]]);
    c.beginPath();
    c.moveTo(-3.0, -0.06);
    c.lineTo(3.0, -0.06);
    c.lineTo(3.1, 0.85);
    c.quadraticCurveTo(0, 0.95, -3.1, 0.85);
    c.closePath();
    c.fill();
    rect(c, -3.05, 0.62, 6.1, 0.06, tone('#c8603a', R, 0.4, 0.5));
    rect(c, -3.05, 0.71, 6.1, 0.03, tone('#c8603a', R, 0.4, 0.5));
    c.fillStyle = tone('#fffaf0', R, 0.7, 0.6);
    c.beginPath(); c.ellipse(0, -0.06, 3.0, 0.07, 0, 0, TAU); c.fill();
    // plates, glasses, a soup bowl, the bread basket, two candles
    for (const x of [-1.6, -0.35, 1.9]) {
      ell(c, x, -0.06, 0.34, 0.06, tone('#e8e4dc', R, 0.5, 0.6));
      ell(c, x, -0.065, 0.24, 0.04, tone('#fbfaf6', R, 0.6, 0.6));
      c.strokeStyle = tone('#b8b4ac', R, 0.5);
      c.lineWidth = 0.02;
      c.beginPath(); c.moveTo(x + 0.42, -0.1); c.lineTo(x + 0.42, 0.02); c.moveTo(x - 0.42, -0.1); c.lineTo(x - 0.42, 0.02); c.stroke();
    }
    // soup in a bowl in the middle
    ell(c, 0.4, -0.12, 0.3, 0.06, tone('#f4f0e8', R, 0.6, 0.6));
    c.fillStyle = lin(c, 0.1, 0, 0.7, 0, [[0, tone('#f4f0e8', R, 0.6, 0.6)], [1, tone('#c8c0b0', R)]]);
    c.beginPath(); c.moveTo(0.1, -0.12); c.quadraticCurveTo(0.4, 0.12, 0.7, -0.12); c.closePath(); c.fill();
    ell(c, 0.4, -0.125, 0.26, 0.045, tone('#e8a050', R, 0.5, 0.6));
    for (const x of [-1.0, 1.25]) {
      c.fillStyle = rgba(tone('#e8f0f0', R, 0.6), 0.6);
      c.beginPath(); c.moveTo(x - 0.08, -0.5); c.lineTo(x + 0.08, -0.5); c.lineTo(x + 0.06, -0.08); c.lineTo(x - 0.06, -0.08); c.closePath(); c.fill();
      rect(c, x - 0.065, -0.3, 0.13, 0.2, rgba(tone('#c83a4a', R, 0.4), 0.55));
    }
    drawStill(c, 'bread', R, 0.95, -0.02, 0.5);
    for (const x of [-0.75, 0.0]) {
      rect(c, x - 0.04, -0.62, 0.08, 0.56, tone('#fbf6ea', R, 0.6, 0.6));
      ell(c, x, -0.06, 0.08, 0.025, tone('#c8a46a', R, 0.5));
    }
    // the near chair's back (the player's place)
    c.fillStyle = lin(c, -0.6, 0, 0.6, 0, [[0, tone('#7a5236', R, 0.2)], [0.5, tone('#9a6a44', R, 0.4)], [1, tone('#6a4428', R)]]);
    rrect(c, -0.55, 0.55, 1.1, 0.16, 0.06);
    c.fill();
    c.fillRect(-0.5, 0.65, 0.09, 1.4);
    c.fillRect(0.41, 0.65, 0.09, 1.4);
    vignette(c, S, 0.25);
  },
  over(c, S, R, t) {
    // the candles' flames, the soup's warmth
    for (const x of [-0.75, 0.0]) {
      const fl = t === 0 ? 1 : 1 + 0.08 * Math.sin(t * 9 + x * 5) + 0.05 * Math.sin(t * 13.7 + x);
      c.save();
      c.globalCompositeOperation = 'lighter';
      glow(c, '#ffb860', x, -0.7, 0.45, 0.22 + 0.25 * R.night);
      c.restore();
      c.fillStyle = '#ffd070';
      c.beginPath(); c.moveTo(x, -0.63); c.bezierCurveTo(x - 0.035, -0.66, x - 0.02, -0.74 * fl, x, -0.8 * fl); c.bezierCurveTo(x + 0.02, -0.74 * fl, x + 0.035, -0.66, x, -0.63); c.fill();
      c.fillStyle = '#fff6dc';
      c.beginPath(); c.ellipse(x, -0.67, 0.012, 0.03, 0, 0, TAU); c.fill();
    }
    steam(c, 0.4, -0.16, 0.6, t, 0.35, 2);
    void S;
  },
  hot: {
    bread: [0.95, -0.2], cup: [-0.35, -0.2], tea: [-0.35, -0.2], smile: [0.2, -1.1], heart: [0.2, -0.9], window: [-1.7, -1.95],
    sky: [-1.7, -2.2], sun: [-1.7, -2.0], rain: [-1.7, -1.95], rainbow: [-1.7, -2.0], light: [0.2, -2.3], switch: [0.2, -2.3],
    flower: [2.15, -1.3],
  },
  aim: [0.1, -0.8],
  spot: [-1.6, -0.06, 0.42],
  has: ['bread', 'smile', 'heart', 'light', 'switch', 'flower'],
  win: TABLE_WIN,
};

// ── the window at night ───────────────────────────────────────────

const NIGHT_WIN: [number, number, number, number] = [-2.3, -3.3, 2.3, -0.3];

const window_: PlaceSet = {
  id: 'window',
  face: 0.78,
  back(c, S, R) {
    wall(c, S, R, '#c8b4a0', S.y0, 1.4);
    // the big window: the city's roofs and lights, the stars, the moon at night
    const [x0, y0, x1, y1] = NIGHT_WIN;
    rect(c, x0 - 0.12, y0 - 0.12, x1 - x0 + 0.24, y1 - y0 + 0.24, tone('#8a7a6a', R));
    const Lt = R.Lt;
    // the sky and the city of the hour
    windowViewCity(c, R, x0, y0, x1, y1);
    // the moon
    if (Lt.stars > 0.2) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      glow(c, '#dfe8ff', 1.3, -2.55, 0.9, 0.35 * Lt.stars);
      c.restore();
      ell(c, 1.3, -2.55, 0.17, 0.17, '#f4f2e8');
      ell(c, 1.36, -2.6, 0.15, 0.15, mixHex('#16234f', '#0b112c', 0.5));
    }
  },
  front(c, S, R) {
    const [x0, y0, x1, y1] = NIGHT_WIN;
    // the frame and its bars (near), the deep sill, a plant, a small lamp, a cup of tea
    const fr = tone('#f0e8dc', R, 0.3);
    c.strokeStyle = fr;
    c.lineWidth = 0.12;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.lineWidth = 0.07;
    c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y1); c.moveTo(x0, -2.1); c.lineTo(x1, -2.1); c.stroke();
    vgrad(c, x0 - 0.4, y1 - 0.02, x1 - x0 + 0.8, 0.12, tone('#f8f0e4', R, 0.4), tone('#d8ccb8', R));
    rect(c, x0 - 0.4, y1 + 0.1, x1 - x0 + 0.8, S.y1 - y1, tone('#9a8a78', R));
    rect(c, x0 - 0.4, y1 + 0.1, x1 - x0 + 0.8, 0.05, rgba('#000000', 0.2));
    plant(c, R, -1.5, y1 + 0.02, 0.5, '#c8774e', '#5f9a5a', 19);
    drawStill(c, 'tea', R, 0.85, y1 + 0.02, 0.4);
    drawStill(c, 'book', R, -0.45, y1 + 0.04, 0.52);
    // a little lamp
    rect(c, 1.7, y1 - 0.42, 0.04, 0.42, tone('#c8a46a', R, 0.5));
    c.fillStyle = tone('#fbf0dc', R, 0.4, 1);
    c.beginPath(); c.moveTo(1.6, y1 - 0.72); c.lineTo(1.84, y1 - 0.72); c.lineTo(1.92, y1 - 0.42); c.lineTo(1.52, y1 - 0.42); c.closePath(); c.fill();
    lampLight(c, 1.72, y1 - 0.5, 0.3, Math.max(0.4, R.lamp));
    // the curtains at the sides
    curtains(c, R, x0 + 0.05, x1 - 0.05, y0 + 0.2, y1 - 0.3, '#8a6a8a');
    vignette(c, S, 0.3);
  },
  behind(c, S, R, t) {
    // the city's lights breathing, a few stars twinkling
    const Lt = R.Lt;
    if (Lt.dusk < 0.3) return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const x = NIGHT_WIN[0] + (NIGHT_WIN[2] - NIGHT_WIN[0]) * hash(i * 13 + 5), y = -1.3 + 0.9 * hash(i * 7 + 3);
      const tw = t === 0 ? 0.7 : 0.55 + 0.45 * Math.sin(t * (0.6 + hash(i) * 1.4) + i * 2);
      glow(c, i % 3 ? '#ffd890' : '#fff2d0', x, y, 0.12, 0.35 * tw * Lt.dusk);
    }
    for (let i = 0; i < 12; i++) {
      const x = NIGHT_WIN[0] + (NIGHT_WIN[2] - NIGHT_WIN[0]) * hash(i * 31 + 2), y = NIGHT_WIN[1] + 1.4 * hash(i * 17 + 9);
      const tw = t === 0 ? 0.7 : 0.4 + 0.6 * Math.sin(t * (1.1 + hash(i) * 1.7) + i * 3);
      glow(c, '#ffffff', x, y, 0.05, 0.8 * tw * Lt.stars);
    }
    c.restore();
    void S;
  },
  over(c, S, R, t) {
    drawAlive(c, 'tea', R, 0.85, NIGHT_WIN[3] + 0.02, 0.4, t, 0.4);
    void S;
  },
  hot: {
    sky: [0.8, -2.4], window: [0, -1.8], tea: [0.85, -0.5], cup: [0.85, -0.5], book: [-0.45, -0.45], rain: [0, -1.8], rainbow: [0, -2.0],
    sun: [0.8, -2.2], light: [1.72, -0.85], switch: [1.72, -0.85],
  },
  aim: [0.3, -1.6],
  spot: [-1.0, -0.28, 0.42],
  has: ['tea', 'book', 'light', 'switch'],
  win: NIGHT_WIN,
};

/** The city through the night window: far roofs in the haze, nearer ones with their windows, lit at night. */
function windowViewCity(c: Ctx, R: Room, x0: number, y0: number, x1: number, y1: number): void {
  const Lt = R.Lt;
  c.save();
  c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip();
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, mixHex('#0b112c', '#4c8ad2', Math.max(0, 1 - Lt.dusk * 1.2)));
  g.addColorStop(0.65, mixHex('#2f4280', '#a6c8ec', Math.max(0, 1 - Lt.dusk * 1.2)));
  g.addColorStop(1, mixHex('#c9857c', '#f0e4d4', Math.max(0, 1 - Lt.dusk)));
  c.fillStyle = g;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  // stars (still: the live layer twinkles them)
  for (let i = 0; i < 40; i++) {
    const x = x0 + (x1 - x0) * hash(i * 11 + 3), y = y0 + 1.6 * hash(i * 5 + 1) ** 1.3;
    c.fillStyle = rgba('#fff6e4', Lt.stars * (0.3 + 0.6 * hash(i)));
    c.beginPath(); c.arc(x, y, 0.012 + 0.014 * hash(i * 3), 0, TAU); c.fill();
  }
  for (let row = 0; row < 2; row++) {
    const base = y1 - (row ? 0.35 : 0.9);
    const col = mixHex(row ? '#2a2638' : '#3a3a52', '#8a8aa0', Math.max(0, 0.6 - Lt.dusk));
    let x = x0 - 0.2;
    let i = 0;
    while (x < x1 + 0.2) {
      const bw = 0.5 + 0.5 * hash(row * 97 + i * 7), bh = (row ? 0.9 : 0.6) + 0.7 * hash(row * 31 + i * 3);
      c.fillStyle = col;
      if (hash(i * 5 + row) < 0.4) {
        c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - bh); c.lineTo(x + bw / 2, base - bh - 0.3); c.lineTo(x + bw, base - bh); c.lineTo(x + bw, base); c.closePath(); c.fill();
      } else c.fillRect(x, base - bh, bw, bh + 0.5);
      c.fillRect(x + bw * 0.7, base - bh - 0.22, 0.08, 0.22);
      for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) {
        const on = hash(row * 1000 + i * 37 + r * 5 + q) < 0.6 * Lt.dusk;
        c.fillStyle = on ? (hash(i + r) < 0.5 ? '#ffd58a' : '#ffe8b0') : rgba('#ffffff', 0.06);
        c.fillRect(x + bw * (0.18 + q * 0.42), base - bh + 0.15 + r * 0.22, bw * 0.18, 0.1);
      }
      x += bw + 0.02;
      i++;
    }
  }
  c.restore();
}

export const HOME_SETS: Partial<Record<Place, PlaceSet>> = { kitchen, bedroom, bathroom, nursery, table, window: window_ };
