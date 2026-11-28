/**
 * Złota passa's places of the day's work (DESIGN.md §29, the film — builder P2): a classroom, a library on a campus,
 * an office over the city, work behind a shop's counter.  Painted in the stage's units (stage.ts).
 */
import type { Place } from './life';
import type { PlaceSet } from './places';
import { TAU, glow, hash, mixHex, rgbHex, rgba } from './paint';
import {
  books, ell, floor, lampLight, lightSwitch, person, picture, plant, poly, rect, rrect, shadow, sunPatch, tone, vgrad,
  vignette, wall, walkers, wallClock, windowIn, windowView, type Ctx, type Room,
} from './stage';
import { drawAlive, drawStill } from './things';

const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};

/** A wooden desk's top seen from its user's side (at y 0), its front edge, and its legs' shadow. */
function deskTop(c: Ctx, R: Room, x0: number, x1: number, col = '#c89a6a'): void {
  shadow(c, (x0 + x1) / 2, 0.75, (x1 - x0) * 0.5, 0.1, 0.25);
  c.fillStyle = lin(c, 0, -0.08, 0, 0.12, [[0, tone(mixHex(col, '#ffffff', 0.15), R, 0.6)], [1, tone(col, R, 0.3)]]);
  c.fillRect(x0, -0.08, x1 - x0, 0.2);
  rect(c, x0, 0.12, x1 - x0, 0.06, tone(mixHex(col, '#000000', 0.3), R));
  rect(c, x0, -0.085, x1 - x0, 0.012, rgba('#ffffff', 0.3));
  c.fillStyle = tone(mixHex(col, '#000000', 0.4), R);
  c.fillRect(x0 + 0.1, 0.18, 0.08, 2);
  c.fillRect(x1 - 0.18, 0.18, 0.08, 2);
}

// ── the classroom ─────────────────────────────────────────────────

const SCHOOL_WIN: [number, number, number, number] = [-3.9, -2.9, -2.45, -0.9];

const school: PlaceSet = {
  id: 'school',
  face: 0.28,
  back(c, S, R) {
    wall(c, S, R, '#e8dcc0', S.y0, 1.0);
    rect(c, S.x0, -0.75, S.x1 - S.x0, 1.8, tone('#9ab8a8', R, 0.3));
    rect(c, S.x0, -0.8, S.x1 - S.x0, 0.06, tone('#7a9a88', R, 0.3));
    windowIn(c, R, SCHOOL_WIN[0], SCHOOL_WIN[1], SCHOOL_WIN[2], SCHOOL_WIN[3], 'trees', '#f4efe4', 23);
    windowIn(c, R, SCHOOL_WIN[0] - 1.9, SCHOOL_WIN[1], SCHOOL_WIN[2] - 1.9, SCHOOL_WIN[3], 'trees', '#f4efe4', 29);
    sunPatch(c, R, SCHOOL_WIN[0], SCHOOL_WIN[1], SCHOOL_WIN[2], SCHOOL_WIN[3], 2.2, 0.6);
    // the green board with soft chalk drawings: a sun, a tree, a few lines, a circle and its radius
    c.fillStyle = tone('#8a6a4a', R, 0.3);
    c.fillRect(-1.7, -2.85, 3.5, 1.75);
    c.fillStyle = lin(c, -1.6, -2.75, 1.7, -1.2, [[0, tone('#3f6a54', R, 0.3)], [1, tone('#2a4a3a', R)]]);
    c.fillRect(-1.6, -2.75, 3.3, 1.55);
    c.strokeStyle = rgba('#f4f4ea', 0.7);
    c.lineWidth = 0.02;
    c.lineCap = 'round';
    c.beginPath(); c.arc(-1.05, -2.3, 0.18, 0, TAU); c.stroke();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.moveTo(-1.05 + Math.cos(a) * 0.24, -2.3 + Math.sin(a) * 0.24); c.lineTo(-1.05 + Math.cos(a) * 0.32, -2.3 + Math.sin(a) * 0.32); c.stroke(); }
    c.beginPath(); c.moveTo(-0.5, -1.4); c.lineTo(-0.5, -1.9); c.stroke();
    c.beginPath(); c.arc(-0.5, -2.05, 0.2, 0, TAU); c.stroke();
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(0.1, -2.5 + i * 0.25); c.lineTo(0.9 - (i % 2) * 0.25, -2.5 + i * 0.25); c.stroke(); }
    c.beginPath(); c.arc(1.3, -1.8, 0.25, 0, TAU); c.moveTo(1.3, -1.8); c.lineTo(1.55, -1.8); c.stroke();
    rect(c, -1.6, -1.2, 3.3, 0.05, tone('#a8845a', R, 0.4));
    rect(c, -0.9, -1.25, 0.2, 0.04, tone('#f8f8f0', R, 0.5));
    wallClock(c, R, 2.55, -2.45, 0.24);
    picture(c, R, 2.3, -1.85, 0.9, 0.6, 31);
    // the pupils' rows: backs of heads and shoulders between the board and the near desk
    const coats = ['#5a7aa8', '#c8603a', '#6a8a5a', '#8a5a8a', '#d8a040', '#4a6a7a'];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 6; i++) {
        const x = -2.6 + i * 1.05 + (row ? 0.5 : 0) + (hash(i * 7 + row) - 0.5) * 0.2;
        const h = row ? 1.75 : 1.4;
        const y = row ? -0.4 : -0.88;
        person(c, R, x, y, h, coats[(i + row * 3) % 6], hash(i * 3 + row) < 0.5 ? '#3a2a22' : '#b8864a', { sit: true, back: true });
      }
      // their desks
      rect(c, S.x0, row ? -0.4 : -0.88, S.x1 - S.x0, row ? 0.08 : 0.06, tone('#c89a6a', R, 0.4));
    }
  },
  front(c, S, R) {
    deskTop(c, R, -2.4, 2.4);
    // a notebook with lines, a pencil case, a pencil, an apple
    c.save();
    c.translate(-0.1, -0.04);
    c.rotate(-0.06);
    rect(c, -0.42, -0.06, 0.84, 0.1, tone('#f8f6ee', R, 0.6));
    rect(c, -0.42, 0.03, 0.84, 0.02, tone('#3a6ab8', R, 0.4));
    c.restore();
    c.fillStyle = lin(c, 0.6, -0.2, 0.6, 0, [[0, tone('#e8603a', R, 0.6)], [1, tone('#a8402a', R)]]);
    rrect(c, 0.55, -0.2, 0.6, 0.16, 0.07);
    c.fill();
    rect(c, 0.6, -0.14, 0.5, 0.02, tone('#f0c040', R, 0.5));
    c.strokeStyle = tone('#f0c040', R, 0.6);
    c.lineWidth = 0.035;
    c.beginPath(); c.moveTo(-0.95, -0.05); c.lineTo(-0.55, -0.1); c.stroke();
    drawStill(c, 'apple', R, -1.5, -0.03, 0.3);
    // a backpack hanging at the desk's side
    c.fillStyle = lin(c, 1.9, 0, 2.6, 0, [[0, tone('#3a8ad8', R, 0.6)], [1, tone('#24508a', R)]]);
    rrect(c, 1.95, 0.15, 0.62, 0.8, 0.14);
    c.fill();
    rect(c, 2.05, 0.45, 0.42, 0.25, tone('#2a6ab8', R, 0.3));
    vignette(c, S, 0.18);
  },
  behind(c, S, R, t) {
    // the teacher walking slowly along the board
    walkers(c, R, t, { y: -1.0, h: 1.55, x0: -1.6, x1: 1.8, n: 1, speed: 0.05, seed: 5, alpha: 0.9, coats: ['#6a4a5a'] });
    void S;
  },
  hot: {
    book: [-0.1, -0.1], letter: [-0.1, -0.1], apple: [-1.5, -0.18], clock: [2.55, -2.45], window: [-3.2, -1.9], sky: [-3.2, -2.3],
    sun: [-3.2, -2.1], rain: [-3.2, -1.9], rainbow: [-3.2, -2.0], desk: [0, -0.2], smile: [0.4, -1.2], light: [-3.2, -1.9],
  },
  aim: [0, -1.4],
  spot: [0.95, -0.06, 0.4],
  has: ['book', 'letter', 'apple', 'clock', 'desk', 'smile'],
  win: SCHOOL_WIN,
};

// ── a library on a campus ─────────────────────────────────────────

const LIB_WIN: [number, number, number, number] = [-1.0, -3.4, 1.0, -0.95];

const campus: PlaceSet = {
  id: 'campus',
  face: 0.5,
  back(c, S, R) {
    wall(c, S, R, '#d8c4a0', S.y0, 1.2);
    // tall shelves of books on both sides of the arched window
    for (const [x0, x1] of [[S.x0, -1.35], [1.35, S.x1]] as const) {
      rect(c, x0, S.y0, x1 - x0, 1.2 - S.y0, tone('#6a4428', R, 0.2));
      for (let r = 0; r < 7; r++) {
        const y = -3.6 + r * 0.48;
        rect(c, x0, y, x1 - x0, 0.05, tone('#8a5e3a', R, 0.4));
        books(c, R, x0 + 0.05, x1 - 0.05, y, 0.4, 41 + r * 3 + (x0 < 0 ? 0 : 50));
      }
    }
    // the arched window
    const [x0, y0, x1, y1] = LIB_WIN;
    c.save();
    c.beginPath();
    c.moveTo(x0, y1); c.lineTo(x0, y0 + 1.0); c.arc(0, y0 + 1.0, 1.0, Math.PI, TAU); c.lineTo(x1, y1); c.closePath();
    c.clip();
    windowView(c, R, x0, y0, x1, y1, 'trees', 43);
    c.restore();
    c.strokeStyle = tone('#f0e4cc', R, 0.4);
    c.lineWidth = 0.07;
    c.beginPath(); c.moveTo(x0, y1); c.lineTo(x0, y0 + 1.0); c.arc(0, y0 + 1.0, 1.0, Math.PI, TAU); c.lineTo(x1, y1); c.closePath(); c.stroke();
    c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(0, y0); c.lineTo(0, y1); c.moveTo(x0, -1.9); c.lineTo(x1, -1.9); c.moveTo(x0, y0 + 1.0); c.lineTo(x1, y0 + 1.0); c.stroke();
    sunPatch(c, R, x0, y0 + 0.6, x1, y1, 0.0, 1.3);
    // students reading at the far end of the long table
    person(c, R, -0.6, -0.06, 1.45, '#7a6a9a', '#3a2a22', { sit: true });
    person(c, R, 0.75, -0.06, 1.4, '#4a7a6a', '#c8a06a', { sit: true });
  },
  front(c, S, R) {
    deskTop(c, R, -3.0, 3.0, '#a8744a');
    // green banker's lamps, open books, notes, a cup
    for (const x of [-1.25, 1.55]) {
      rect(c, x - 0.02, -0.5, 0.04, 0.42, tone('#c8a46a', R, 0.5));
      ell(c, x, -0.08, 0.14, 0.035, tone('#c8a46a', R, 0.5));
      c.fillStyle = lin(c, 0, -0.66, 0, -0.46, [[0, tone('#3a8a5a', R, 0.6, 0.5)], [1, tone('#1e5a3a', R, 0, 0.5)]]);
      c.beginPath(); c.moveTo(x - 0.32, -0.46); c.quadraticCurveTo(x, -0.72, x + 0.32, -0.46); c.closePath(); c.fill();
      lampLight(c, x, -0.44, 0.3, Math.max(0.35, R.lamp));
    }
    drawStill(c, 'book', R, 0.1, 0.0, 0.7);
    c.save();
    c.translate(-2.2, -0.03);
    c.rotate(0.08);
    rect(c, -0.3, -0.05, 0.6, 0.08, tone('#f8f4e8', R, 0.6));
    c.restore();
    drawStill(c, 'cup', R, 1.0, 0.0, 0.32);
    vignette(c, S, 0.22);
  },
  over(c, S, R, t) {
    drawAlive(c, 'cup', R, 1.0, 0.0, 0.32, t, 0.3);
    void S;
  },
  hot: {
    book: [0.1, -0.3], window: [0, -2.1], sky: [0, -2.5], sun: [0, -2.3], rain: [0, -2.1], rainbow: [0, -2.3], light: [-1.25, -0.55],
    switch: [-1.25, -0.55], cup: [1.0, -0.16], desk: [0, -0.2],
  },
  aim: [0, -1.3],
  spot: [-0.6, -0.04, 0.42],
  has: ['book', 'light', 'switch', 'cup', 'desk'],
  win: [LIB_WIN[0], LIB_WIN[1] + 0.6, LIB_WIN[2], LIB_WIN[3]],
};

// ── an office over the city ───────────────────────────────────────

const office: PlaceSet = {
  id: 'office',
  face: 0.46,
  back(c, S, R) {
    // the glass wall over the city: its mullions every so often; a soft floor below
    rect(c, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, tone('#d8d4cc', R, 0.3));
    windowView(c, R, S.x0, -3.4, S.x1, -0.75, 'city', 47);
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba('#ffffff', 0.05 * (1 - R.night));
    c.fillRect(S.x0, -3.4, S.x1 - S.x0, 2.65);
    c.restore();
    for (let x = Math.floor(S.x0 / 1.5) * 1.5; x < S.x1; x += 1.5) rect(c, x - 0.04, -3.5, 0.08, 2.8, tone('#4a4e54', R, 0.4));
    rect(c, S.x0, -0.8, S.x1 - S.x0, 0.08, tone('#4a4e54', R, 0.4));
    rect(c, S.x0, -3.5, S.x1 - S.x0, 0.1, tone('#4a4e54', R, 0.4));
    // colleagues at their desks beyond a glass partition
    rect(c, S.x0, -0.72, S.x1 - S.x0, 1.0, tone('#c8c4bc', R, 0.3));
    for (const [x, coat] of [[-2.6, '#5a6a8a'], [2.3, '#8a5a4a'], [3.6, '#6a8a6a']] as const) {
      person(c, R, x, -0.25, 1.4, coat, '#3a2a22', { sit: true });
      c.fillStyle = tone('#2a2e34', R);
      c.fillRect(x + 0.25, -0.95, 0.45, 0.32);
      rect(c, x + 0.28, -0.92, 0.39, 0.26, tone('#6a8ab8', R, 0, 0.6));
    }
    rect(c, S.x0, -0.25, S.x1 - S.x0, 0.06, tone('#e8e4dc', R, 0.4));
    c.fillStyle = rgba('#e8f0f4', 0.12);
    c.fillRect(S.x0, -1.6, S.x1 - S.x0, 1.35);
  },
  front(c, S, R) {
    deskTop(c, R, -2.8, 2.8, '#e8dcc8');
    // the screen with soft shapes of work on it, its stand, the keyboard
    c.fillStyle = tone('#1e2024', R);
    rrect(c, -0.95, -1.42, 1.9, 1.12, 0.05);
    c.fill();
    c.fillStyle = lin(c, 0, -1.36, 0, -0.38, [[0, tone('#f4f6f8', R, 0, 0.6)], [1, tone('#dfe6ee', R, 0, 0.6)]]);
    c.fillRect(-0.88, -1.36, 1.76, 0.98);
    rect(c, -0.88, -1.36, 1.76, 0.12, tone('#4a7ab8', R, 0, 0.6));
    for (let i = 0; i < 5; i++) rect(c, -0.78, -1.12 + i * 0.13, 0.7 - (i % 2) * 0.2, 0.05, tone('#a8b4c4', R, 0, 0.6));
    for (let i = 0; i < 4; i++) rect(c, 0.15 + i * 0.16, -0.5 - (0.15 + 0.3 * hash(i * 5)), 0.1, 0.15 + 0.3 * hash(i * 5), tone(['#5aa88a', '#e8a040', '#4a8ad8', '#d86a5a'][i], R, 0, 0.6));
    rect(c, -0.06, -0.3, 0.12, 0.24, tone('#3a3c40', R));
    ell(c, 0, -0.06, 0.32, 0.04, tone('#3a3c40', R));
    c.fillStyle = tone('#f4f4f0', R, 0.5);
    rrect(c, -0.7, -0.08, 1.2, 0.07, 0.02);
    c.fill();
    // a mug, a plant, a notebook, a desk lamp
    drawStill(c, 'cup', R, 1.12, 0.0, 0.34);
    plant(c, R, -1.4, -0.06, 0.52, '#f0f0ea', '#4f8a44', 51);
    c.save();
    c.translate(1.85, -0.04);
    c.rotate(0.1);
    rect(c, -0.3, -0.05, 0.6, 0.08, tone('#2a4a6a', R, 0.4));
    c.restore();
    c.strokeStyle = tone('#3a3c40', R);
    c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(-2.2, -0.05); c.lineTo(-2.05, -0.9); c.lineTo(-1.75, -1.05); c.stroke();
    c.fillStyle = tone('#3a3c40', R, 0.3);
    c.beginPath(); c.moveTo(-1.95, -1.15); c.lineTo(-1.55, -1.0); c.lineTo(-1.65, -0.86); c.closePath(); c.fill();
    lampLight(c, -1.65, -0.9, 0.25, Math.max(0.2, R.lamp));
    vignette(c, S, 0.16);
  },
  over(c, S, R, t) {
    drawAlive(c, 'cup', R, 1.12, 0.0, 0.34, t, 0.3);
    // the screen's soft glow at night
    if (R.night > 0.2) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      glow(c, '#dfe8ff', 0, -0.9, 1.6, 0.18 * R.night);
      c.restore();
    }
    void S;
  },
  hot: {
    desk: [0, -0.8], cup: [1.12, -0.16], tea: [1.12, -0.16], window: [-1.8, -2.2], sky: [-1.8, -2.6], sun: [-1.8, -2.4], rain: [-1.8, -2.2],
    rainbow: [-1.8, -2.4], flower: [-1.4, -0.5], smile: [2.3, -0.9], light: [-1.65, -0.95], switch: [-1.65, -0.95], letter: [1.85, -0.1],
  },
  aim: [0, -1.1],
  spot: [0.6, -0.06, 0.38],
  has: ['desk', 'cup', 'flower', 'smile', 'light', 'switch', 'letter'],
  win: [-3, -3.4, 3, -0.8],
};

// ── behind a shop's counter ───────────────────────────────────────

const COUNTER_WIN: [number, number, number, number] = [-3.3, -2.6, -0.9, -0.75];

const counter: PlaceSet = {
  id: 'counter',
  face: 0.4,
  back(c, S, R) {
    wall(c, S, R, '#e4d6bc', S.y0, 1.4);
    floor(c, S, R, '#b8a088', -0.6, 'tiles');
    // the shop window and the glass door onto the street
    windowIn(c, R, COUNTER_WIN[0], COUNTER_WIN[1], COUNTER_WIN[2], COUNTER_WIN[3], 'roofs', '#3a5a4a', 61, 1);
    c.fillStyle = tone('#3a5a4a', R, 0.3);
    c.fillRect(0.95, -2.75, 1.25, 2.15);
    windowView(c, R, 1.07, -2.62, 2.08, -0.72, 'roofs', 67);
    rect(c, 1.12, -1.7, 0.85, 0.05, tone('#c8a46a', R, 0.5));
    // a little bell over the door
    ell(c, 1.55, -2.9, 0.08, 0.07, tone('#d8b04a', R, 0.6));
    // shelves at the sides
    for (const x0 of [2.5, S.x0]) {
      const x1 = x0 < 0 ? -3.5 : S.x1;
      for (let r = 0; r < 3; r++) {
        const y = -2.7 + r * 0.7;
        rect(c, x0, y + 0.55, x1 - x0, 0.05, tone('#a8784a', R, 0.4));
        for (let x = x0 + 0.05; x < x1 - 0.2; x += 0.25) rect(c, x, y + 0.55 - 0.3 - 0.1 * hash(Math.floor(x * 9) + r), 0.2, 0.3 + 0.1 * hash(Math.floor(x * 9) + r), tone(['#e8503a', '#f0c040', '#5aaa4a', '#3a8ad8', '#f4f0e8'][Math.floor(hash(Math.floor(x * 13) + r * 7) * 5)], R, 0.4));
      }
    }
    // the customer at the counter, a calm presence
    person(c, R, -0.35, 0.6, 2.15, '#5a7a9a', '#5a3a2a', { skin: '#d8a888' });
    picture(c, R, -0.55, -2.75, 0.6, 0.45, 71);
  },
  front(c, S, R) {
    // the counter: its top at the surface line, its wooden front; the till, a bell, a jar of sweets, a card reader
    c.fillStyle = lin(c, 0, 0.05, 0, 1.6, [[0, tone('#b8865a', R, 0.4)], [1, tone('#6a4a2a', R)]]);
    c.fillRect(S.x0, 0.05, S.x1 - S.x0, S.y1);
    for (let x = Math.floor(S.x0 / 0.9) * 0.9; x < S.x1; x += 0.9) rect(c, x, 0.2, 0.02, 1.4, rgba('#000000', 0.12));
    vgrad(c, S.x0, -0.08, S.x1 - S.x0, 0.14, tone('#d8b088', R, 0.6), tone('#9a7048', R));
    rect(c, S.x0, -0.085, S.x1 - S.x0, 0.012, rgba('#ffffff', 0.3));
    // the till
    c.fillStyle = lin(c, 1.4, -0.7, 2.4, 0, [[0, tone('#5a5e64', R, 0.4)], [1, tone('#2a2c30', R)]]);
    rrect(c, 1.4, -0.42, 1.0, 0.36, 0.05);
    c.fill();
    c.fillStyle = tone('#2a2c30', R, 0.3);
    rrect(c, 1.55, -0.95, 0.65, 0.48, 0.05);
    c.fill();
    rect(c, 1.6, -0.9, 0.55, 0.3, tone('#7ac0a0', R, 0, 0.8));
    for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) rect(c, 1.5 + q * 0.22, -0.36 + r * 0.13, 0.15, 0.08, tone('#e8e4dc', R, 0.4));
    // the counter's bell
    ell(c, 0.95, -0.06, 0.14, 0.035, tone('#3a3a40', R));
    c.fillStyle = lin(c, 0.82, -0.2, 1.08, -0.06, [[0, tone('#f8e8a0', R, 0.9)], [1, tone('#b8902a', R)]]);
    c.beginPath(); c.arc(0.95, -0.07, 0.12, Math.PI, TAU); c.fill();
    ell(c, 0.95, -0.21, 0.02, 0.02, tone('#d8b04a', R, 0.6));
    // a jar of sweets
    c.fillStyle = rgba(tone('#e8f0f0', R, 0.5), 0.6);
    rrect(c, -1.5, -0.5, 0.36, 0.44, 0.08);
    c.fill();
    for (let i = 0; i < 12; i++) ell(c, -1.44 + (i % 4) * 0.08, -0.14 - Math.floor(i / 4) * 0.08, 0.035, 0.035, tone(['#e8503a', '#f0c040', '#5aaa4a', '#e870a0'][i % 4], R, 0.6));
    rect(c, -1.52, -0.55, 0.4, 0.06, tone('#c8a46a', R, 0.5));
    vignette(c, S, 0.16);
  },
  behind(c, S, R, t) {
    walkers(c, R, t, { y: COUNTER_WIN[3] - 0.08, h: 0.95, x0: COUNTER_WIN[0] - 0.4, x1: COUNTER_WIN[2] + 0.4, n: 3, speed: 0.25, seed: 13, clip: COUNTER_WIN, alpha: 0.8 });
    void S;
  },
  hot: {
    smile: [-0.35, -1.0], hand: [-0.35, -0.3], door: [1.55, -1.7], window: [-2.1, -1.7], sky: [-2.1, -2.1], sun: [-2.1, -2.0],
    rain: [-2.1, -1.7], rainbow: [-2.1, -1.9], queue: [-0.35, -1.0], clock: [-0.25, -2.5], light: [1.55, -2.9],
  },
  aim: [0, -1.1],
  spot: [0.35, -0.06, 0.4],
  has: ['smile', 'hand', 'door', 'queue'],
  win: COUNTER_WIN,
};

export const WORK_SETS: Partial<Record<Place, PlaceSet>> = { school, campus, office, counter };
void poly; void rgbHex; void lightSwitch; void vgrad;
