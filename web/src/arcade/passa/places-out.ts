/**
 * Złota passa's places on the way and outdoors (DESIGN.md §29, the film — builder P2): the bus with the city passing in
 * its windows, the car's windscreen and the road coming toward it, the bike's lane over its handlebars, the park, the
 * garden, the shop.  The moving world beyond a window or a windscreen is live (`beyond`, drawn before the far layer,
 * whose glass is cut out of it); the rest is baked.
 */
import type { Place } from './life';
import type { PlaceSet } from './places';
import { TAU, glow, hash, mixHex, rgbHex, rgba } from './paint';
import {
  ell, lampLight, person, poly, rect, rrect, shadow, tone, vgrad, vignette, walkers, type Ctx, type Room,
} from './stage';
import { drawStill } from './things';

const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]): CanvasGradient => {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [k, col] of stops) g.addColorStop(k, col);
  return g;
};

/** The sky of the hour over a rect (units). */
function sky(c: Ctx, R: Room, x0: number, y0: number, x1: number, y1: number): void {
  const Lt = R.Lt;
  vgrad(c, x0, y0, x1 - x0, y1 - y0, rgbHex(Lt.top), rgbHex(Lt.hor));
  const mid = c.createLinearGradient(0, y0, 0, y1);
  mid.addColorStop(0, rgba(rgbHex(Lt.mid), 0));
  mid.addColorStop(0.6, rgba(rgbHex(Lt.mid), 0.5));
  mid.addColorStop(1, rgba(rgbHex(Lt.mid), 0));
  c.fillStyle = mid;
  c.fillRect(x0, y0, x1 - x0, y1 - y0);
  if (Lt.stars > 0.05) {
    for (let i = 0; i < 40; i++) {
      c.fillStyle = rgba('#fff6e4', Lt.stars * (0.3 + 0.6 * hash(i * 3)));
      c.beginPath(); c.arc(x0 + (x1 - x0) * hash(i * 7 + 1), y0 + (y1 - y0) * 0.7 * hash(i * 11 + 2), 0.014, 0, TAU); c.fill();
    }
  }
  // soft clouds by day
  if (Lt.dusk < 0.8) {
    for (let i = 0; i < 4; i++) {
      const cx = x0 + (x1 - x0) * hash(i * 13 + 4), cy = y0 + (y1 - y0) * (0.2 + 0.3 * hash(i * 5 + 8)), s = 0.5 + 0.4 * hash(i);
      for (let k = 0; k < 5; k++) {
        ell(c, cx + (k - 2) * s * 0.42, cy - Math.sin((k / 4) * Math.PI) * s * 0.25 + s * 0.05, s * 0.42, s * 0.24, rgba(mixHex(rgbHex(Lt.mid), rgbHex(Lt.top), 0.3), 0.45 * (1 - Lt.dusk)));
        ell(c, cx + (k - 2) * s * 0.42 - 0.04, cy - Math.sin((k / 4) * Math.PI) * s * 0.25, s * 0.38, s * 0.2, rgba(mixHex(rgbHex(Lt.hor), '#ffffff', 0.55), 0.6 * (1 - Lt.dusk)));
      }
    }
  }
  // the sun's glow where it stands low
  if (R.Lt.sunI > 0.1 && Lt.dusk < 0.9) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, rgbHex(Lt.sun), (x0 + x1) / 2 + (Lt.L[0]) * 3, y1 - (y1 - y0) * (0.2 + 0.5 * Math.max(0, Lt.L[1])), 3.5, 0.3 * Lt.sunI);
    c.restore();
  }
}

/** A tree of the painterly kind (units: its foot at x, y; height h). */
function tree(c: Ctx, R: Room, x: number, y: number, h: number, leaf = '#5f9a4a', seed = 1, fruit = false): void {
  shadow(c, x, y, h * 0.32, h * 0.05, 0.25);
  c.fillStyle = lin(c, x - h * 0.05, 0, x + h * 0.05, 0, [[0, tone('#8a6448', R, 0.5)], [1, tone('#4a3424', R)]]);
  c.beginPath(); c.moveTo(x - h * 0.05, y); c.lineTo(x - h * 0.03, y - h * 0.55); c.lineTo(x + h * 0.03, y - h * 0.55); c.lineTo(x + h * 0.05, y); c.closePath(); c.fill();
  const r = h * 0.3;
  const cy = y - h * 0.66;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + seed;
    const ox = Math.cos(a) * r * 0.55, oy = Math.sin(a) * r * 0.4;
    ell(c, x + ox, cy + oy, r * 0.62, r * 0.55, tone(mixHex(leaf, '#1e3a20', 0.25), R, 0.3));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + seed * 2;
    ell(c, x + Math.cos(a) * r * 0.4 - r * 0.1, cy + Math.sin(a) * r * 0.3 - r * 0.15, r * 0.45, r * 0.38, tone(mixHex(leaf, '#d8f0a0', 0.2 * hash(i + seed)), R, 0.7));
  }
  if (fruit) for (let i = 0; i < 9; i++) ell(c, x + (hash(i * 3 + seed) - 0.5) * r * 1.5, cy + (hash(i * 7 + seed) - 0.4) * r, r * 0.07, r * 0.07, tone('#d8302a', R, 0.6));
}

/** Cut a window's glass out of a baked layer (the live world beyond shows through). */
function cut(c: Ctx, draw: () => void): void {
  c.save();
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = '#000';
  draw();
  c.restore();
}

/** The city passing a moving vehicle's window (live): houses, trees, lamps scrolling at their depths. */
function cityPassing(c: Ctx, R: Room, x0: number, x1: number, y0: number, y1: number, t: number, speed: number): void {
  const Lt = R.Lt;
  c.save();
  sky(c, R, x0, y0, x1, y1);
  const h = y1 - y0;
  const rows: [number, number, number][] = [[0.25, 0.55, 0.3], [0.6, 0.8, 1.0], [1.0, 1.0, 2.6]];
  for (const [depth, scale, sp] of rows) {
    const period = 14 * scale;
    const off = (t * speed * sp) % period;
    for (let i = -1; i < Math.ceil((x1 - x0) / (period / 7)) + 2; i++) {
      const k = (i * 7 + Math.floor((t * speed * sp) / period) * 7) | 0;
      const bw = (1.0 + 0.8 * hash(k * 3 + depth * 10)) * scale;
      const x = x0 + i * (period / 7) - off;
      const top = y1 - h * (0.35 + 0.5 * hash(k * 5 + depth * 7)) * scale;
      const col = mixHex(['#c8a088', '#a8b8c8', '#e0c890', '#b89aa8', '#98b098'][((k % 5) + 5) % 5], rgbHex(Lt.hor), 0.45 - depth * 0.3);
      if (depth < 0.9) {
        c.fillStyle = tone(mixHex(col, '#0e1226', Lt.dusk * 0.6), R, 0.4);
        c.fillRect(x, top, bw, y1 - top);
        for (let r = 0; r < 5; r++) for (let q = 0; q < 2; q++) {
          const wy = top + 0.12 * scale + r * 0.3 * scale;
          if (wy > y1 - 0.1) continue;
          const on = hash(k * 31 + r * 7 + q) < 0.55 * Lt.dusk;
          c.fillStyle = on ? '#ffd58a' : rgba('#2a3040', 0.35);
          c.fillRect(x + bw * (0.2 + q * 0.4), wy, bw * 0.2, 0.14 * scale);
        }
      } else if (hash(k) < 0.6) {
        // near: trees and lamp posts flick past
        if (hash(k * 9) < 0.5) {
          c.fillStyle = tone('#4a3424', R);
          c.fillRect(x, y1 - h * 0.6, 0.08, h * 0.6);
          ell(c, x + 0.04, y1 - h * 0.7, 0.55, 0.45, tone(mixHex('#4f8a44', '#0c1418', Lt.dusk * 0.7), R, 0.5));
        } else {
          c.fillStyle = tone('#3a3a40', R);
          c.fillRect(x, y1 - h * 0.85, 0.05, h * 0.85);
          if (Lt.lamps > 0.2) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            glow(c, '#ffd090', x + 0.025, y1 - h * 0.85, 0.5, 0.5 * Lt.lamps);
            c.restore();
          }
        }
      }
    }
  }
  c.restore();
}

/** A road or a lane converging to (vx, vy) from the bottom: its surface, its edges, its dashes moving toward the viewer. */
function roadAhead(c: Ctx, R: Room, vx: number, vy: number, wNear: number, yNear: number, col: string, t: number, speed: number, dash = '#f4f0e4'): void {
  const Lt = R.Lt;
  c.fillStyle = lin(c, 0, vy, 0, yNear, [[0, tone(mixHex(col, rgbHex(Lt.hor), 0.5), R)], [1, tone(col, R, 0.3)]]);
  c.beginPath(); c.moveTo(vx - 0.03, vy); c.lineTo(vx + 0.03, vy); c.lineTo(vx + wNear, yNear); c.lineTo(vx - wNear, yNear); c.closePath(); c.fill();
  c.strokeStyle = tone('#e8e4d8', R, 0.4);
  c.lineWidth = 0.03;
  c.beginPath(); c.moveTo(vx - 0.03, vy); c.lineTo(vx - wNear * 0.96, yNear); c.moveTo(vx + 0.03, vy); c.lineTo(vx + wNear * 0.96, yNear); c.stroke();
  // the dashes: at depth z they sit at y = vy + (yNear − vy)/z
  c.fillStyle = tone(dash, R, 0.5);
  const off = t === 0 ? 0 : (t * speed) % 2;
  for (let i = 0; i < 14; i++) {
    const z0 = 1 + i * 2 - off, z1 = z0 + 0.9;
    if (z0 < 1) continue;
    const ya = vy + (yNear - vy) / z0, yb = vy + (yNear - vy) / z1;
    const wa = 0.06 / z0 * 3, wb = 0.06 / z1 * 3;
    poly(c, [vx - wa, ya, vx + wa, ya, vx + wb, yb, vx - wb, yb], tone(dash, R, 0.5));
  }
}

// ── the bus ───────────────────────────────────────────────────────

const BUS_WIN_Y: [number, number] = [-2.55, -1.15];

const bus: PlaceSet = {
  id: 'bus',
  face: 0.3,
  beyond(c, S, R, t) {
    cityPassing(c, R, S.x0, S.x1, BUS_WIN_Y[0] - 0.2, BUS_WIN_Y[1] + 0.2, t, 0.9);
  },
  back(c, S, R) {
    // the bus's far side: its panels, the windows (cut out: the city passes behind), the seats under them
    rect(c, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, tone('#e6e2d6', R, 0.3));
    rect(c, S.x0, S.y0, S.x1 - S.x0, -2.95 - S.y0, tone('#d8d4c8', R, 0.2));
    // the ceiling's light strip
    rect(c, S.x0, -3.1, S.x1 - S.x0, 0.08, tone('#fbf8f0', R, 0.3, 1));
    const ww = 1.7, gap = 0.18;
    for (let x = Math.floor(S.x0 / (ww + gap)) * (ww + gap); x < S.x1; x += ww + gap) {
      c.fillStyle = tone('#3a3a40', R);
      rrect(c, x - 0.04, BUS_WIN_Y[0] - 0.04, ww + 0.08, BUS_WIN_Y[1] - BUS_WIN_Y[0] + 0.08, 0.14);
      c.fill();
      cut(c, () => { rrect(c, x, BUS_WIN_Y[0], ww, BUS_WIN_Y[1] - BUS_WIN_Y[0], 0.12); c.fill(); });
      // a tinted band at the window's top
      rect(c, x, BUS_WIN_Y[0], ww, 0.12, rgba('#2a3a4a', 0.35));
    }
    rect(c, S.x0, BUS_WIN_Y[1] + 0.06, S.x1 - S.x0, 0.12, tone('#c8c4b8', R, 0.3));
    // the seats along the far side: blue moquette with a pattern, headrests
    for (let x = Math.floor(S.x0 / 1.0) * 1.0; x < S.x1; x += 1.0) {
      c.fillStyle = lin(c, x, -1.05, x, 0.4, [[0, tone('#3a5a9a', R, 0.4)], [1, tone('#24386a', R)]]);
      rrect(c, x + 0.08, -1.05, 0.84, 1.45, 0.12);
      c.fill();
      c.fillStyle = rgba('#f0c040', 0.25);
      for (let k = 0; k < 6; k++) c.fillRect(x + 0.2 + (k % 3) * 0.24, -0.85 + Math.floor(k / 3) * 0.4, 0.08, 0.08);
      rect(c, x + 0.16, -1.15, 0.68, 0.14, tone('#2a3a6a', R, 0.3));
    }
    // two passengers: someone with headphones, an older lady by the window
    person(c, R, -0.45, 0.0, 2.3, '#c8603a', '#2a2420', { sit: true, skin: '#c89070' });
    const hk = 2.3 / 1.7, hy = -0.98 * hk + 0.16 * hk;
    c.strokeStyle = tone('#2a2a30', R);
    c.lineWidth = 0.045;
    c.beginPath(); c.arc(-0.45, hy, 0.19, Math.PI * 1.08, Math.PI * 1.92); c.stroke();
    ell(c, -0.62, hy + 0.03, 0.05, 0.08, tone('#2a2a30', R));
    ell(c, -0.28, hy + 0.03, 0.05, 0.08, tone('#2a2a30', R));
    person(c, R, 1.55, 0.0, 2.15, '#7a8a6a', '#d8d0c8', { sit: true, skin: '#e0b8a0' });
  },
  front(c, S, R) {
    // the yellow poles, a stop button; the near seat back at the lower left; handles' rail
    rect(c, S.x0, -2.98, S.x1 - S.x0, 0.05, tone('#c8b030', R, 0.5));
    for (const x of [-2.05, 2.3]) {
      c.fillStyle = lin(c, x - 0.05, 0, x + 0.05, 0, [[0, tone('#f8d84a', R, 0.7)], [1, tone('#b89a20', R)]]);
      c.fillRect(x - 0.05, S.y0, 0.1, S.y1 - S.y0);
    }
    rrect(c, 2.22, -1.05, 0.16, 0.2, 0.04);
    c.fillStyle = tone('#d83a2a', R, 0.5);
    c.fill();
    ell(c, 2.3, -0.95, 0.04, 0.04, tone('#ff8a7a', R, 0.6));
    // the near seat's back
    c.fillStyle = lin(c, -2.9, -0.1, -2.9, 1.5, [[0, tone('#4a6aa8', R, 0.5)], [1, tone('#24386a', R)]]);
    rrect(c, -3.2, -0.08, 2.3, 2.2, 0.2);
    c.fill();
    rect(c, -2.9, -0.02, 1.7, 0.06, rgba('#ffffff', 0.12));
    c.strokeStyle = tone('#c8c8c8', R, 0.5);
    c.lineWidth = 0.06;
    c.beginPath(); c.moveTo(-2.6, 0.02); c.quadraticCurveTo(-2.05, -0.3, -1.5, 0.02); c.stroke();
    vignette(c, S, 0.18);
  },
  over(c, S, R, t) {
    // the handles swaying with the bus
    for (let x = Math.ceil(S.x0 / 0.75) * 0.75; x < S.x1; x += 0.75) {
      const a = t === 0 ? 0 : Math.sin(t * 1.3 + x * 0.3) * 0.08 + Math.sin(t * 0.37) * 0.05;
      c.save();
      c.translate(x, -2.95);
      c.rotate(a);
      c.fillStyle = tone('#3a3a40', R);
      c.fillRect(-0.025, 0, 0.05, 0.36);
      c.strokeStyle = tone('#e8e4d8', R, 0.5);
      c.lineWidth = 0.035;
      c.beginPath(); c.moveTo(-0.1, 0.36); c.lineTo(0.1, 0.36); c.lineTo(0, 0.52); c.closePath(); c.stroke();
      c.restore();
    }
    // the sun flickering through the passing trees
    if (R.sunK > 0.05 && t) {
      const f = 0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 0.9);
      c.save();
      c.globalCompositeOperation = 'lighter';
      glow(c, rgbHex(R.sun), 0, -1.0, 3.2, 0.08 * R.sunK * f, 0.6);
      c.restore();
    }
  },
  hot: {
    window: [0.2, -1.85], sky: [0.2, -2.2], sun: [0.2, -2.0], rain: [0.2, -1.85], rainbow: [0.2, -2.0], music: [-0.45, -1.4],
    bus: [0, -1.4], smile: [1.55, -1.3], light: [0.2, -1.85],
  },
  aim: [0, -1.3],
  spot: [-1.85, -0.08, 0.4],
  has: ['music', 'bus', 'smile'],
  win: [-1.7, BUS_WIN_Y[0], 1.7, BUS_WIN_Y[1]],
};

// ── the car ───────────────────────────────────────────────────────

const VP: [number, number] = [0.1, -1.55];

const car: PlaceSet = {
  id: 'car',
  face: 0.62,
  beyond(c, S, R, t) {
    sky(c, R, S.x0, S.y0, S.x1, VP[1] + 0.05);
    // far hills and a town's roofs on the horizon
    const Lt = R.Lt;
    c.fillStyle = tone(mixHex('#7a9a8a', rgbHex(Lt.hor), 0.55), R, 0.3);
    c.beginPath(); c.moveTo(S.x0, VP[1] + 0.05);
    for (let i = 0; i <= 20; i++) { const x = S.x0 + ((S.x1 - S.x0) * i) / 20; c.lineTo(x, VP[1] - 0.18 - 0.16 * Math.sin(i * 1.3) - 0.1 * hash(i)); }
    c.lineTo(S.x1, VP[1] + 0.05); c.closePath(); c.fill();
    // the verges
    vgrad(c, S.x0, VP[1], S.x1 - S.x0, S.y1 - VP[1], tone(mixHex('#8ab86a', rgbHex(Lt.hor), 0.4), R, 0.3), tone('#4f8a3a', R, 0.4));
    roadAhead(c, R, VP[0], VP[1], 3.4, 0.6, '#6a6a72', t, 6);
    // trees and posts passing at the sides, growing as they come
    const off = t === 0 ? 0 : (t * 6) % 3;
    for (let i = 0; i < 8; i++) {
      const z = 1 + i * 3 - off;
      if (z < 0.6) continue;
      for (const s of [-1, 1]) {
        const x = VP[0] + (s * 4.2) / z, y = VP[1] + 2.15 / z, h = 2.4 / z;
        if (hash(i * 7 + s) < 0.6) {
          c.fillStyle = tone('#4a3424', R);
          c.fillRect(x - 0.03 / z * 3, y - h * 0.5, 0.06 / z * 3, h * 0.5);
          ell(c, x, y - h * 0.72, h * 0.32, h * 0.3, tone(mixHex('#4f8a44', '#0c1418', Lt.dusk * 0.6), R, 0.5));
        } else {
          c.fillStyle = tone('#f4f0e8', R, 0.4);
          c.fillRect(x - 0.02 / z * 3, y - h * 0.22, 0.04 / z * 3, h * 0.22);
        }
      }
    }
  },
  back(c, S, R) {
    // the car's cabin: the roof's lining, the pillars, the windscreen cut out
    rect(c, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, tone('#3a3632', R, 0.1));
    cut(c, () => {
      c.beginPath();
      c.moveTo(-2.5, -0.7); c.lineTo(-2.2, -2.9); c.quadraticCurveTo(0.1, -3.15, 2.4, -2.9); c.lineTo(2.7, -0.7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(S.x0, -0.7); c.lineTo(S.x0, -2.6); c.lineTo(-2.95, -2.6); c.lineTo(-3.2, -0.7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(S.x1, -0.7); c.lineTo(S.x1, -2.6); c.lineTo(3.15, -2.6); c.lineTo(3.4, -0.7); c.closePath(); c.fill();
    });
    // the roof lining's soft light, the sun visor
    rect(c, -1.9, -3.15, 1.3, 0.18, tone('#8a8278', R, 0.3));
  },
  front(c, S, R) {
    // the dashboard: a soft curve, the radio's display, the phone in its holder; the wheel; the mirror and its charm
    c.fillStyle = lin(c, 0, -0.8, 0, 0.6, [[0, tone('#4a4540', R, 0.4)], [1, tone('#1e1c1a', R)]]);
    c.beginPath(); c.moveTo(S.x0, -0.5); c.quadraticCurveTo(0, -0.95, S.x1, -0.5); c.lineTo(S.x1, S.y1); c.lineTo(S.x0, S.y1); c.closePath(); c.fill();
    rect(c, S.x0, -0.62, S.x1 - S.x0, 0.03, rgba('#ffffff', 0.06));
    c.fillStyle = tone('#141618', R);
    rrect(c, 0.55, -0.62, 0.8, 0.3, 0.05);
    c.fill();
    c.fillStyle = tone('#3aa0c8', R, 0, 1);
    rrect(c, 0.6, -0.58, 0.7, 0.13, 0.03);
    c.fill();
    for (let i = 0; i < 3; i++) ell(c, 0.72 + i * 0.23, -0.38, 0.04, 0.04, tone('#6a6a6a', R, 0.4));
    // the phone in its holder
    rect(c, 1.62, -0.66, 0.06, 0.12, tone('#2a2a2a', R));
    c.fillStyle = tone('#1e2024', R);
    rrect(c, 1.48, -1.12, 0.34, 0.5, 0.05);
    c.fill();
    c.fillStyle = lin(c, 0, -1.08, 0, -0.66, [[0, tone('#5a8ac8', R, 0, 0.5)], [1, tone('#3a5a8a', R, 0, 0.5)]]);
    rrect(c, 1.51, -1.08, 0.28, 0.42, 0.03);
    c.fill();
    // the steering wheel at the left
    c.strokeStyle = lin(c, -2.4, -0.8, -1.0, 0.6, [[0, tone('#4a4644', R, 0.5)], [1, tone('#1a1816', R)]]);
    c.lineWidth = 0.16;
    c.beginPath(); c.arc(-1.75, 0.32, 0.92, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
    c.lineWidth = 0.12;
    c.beginPath(); c.moveTo(-2.6, 0.38); c.lineTo(-1.75, 0.3); c.lineTo(-0.9, 0.38); c.stroke();
    ell(c, -1.75, 0.32, 0.22, 0.16, tone('#2a2826', R, 0.3));
    // the rear-view mirror and a small wooden heart hanging from it
    c.fillStyle = tone('#2a2826', R);
    c.fillRect(0.06, -3.1, 0.06, 0.2);
    c.fillStyle = lin(c, -0.3, -2.95, -0.3, -2.62, [[0, tone('#3a3836', R, 0.3)], [1, tone('#1a1816', R)]]);
    rrect(c, -0.42, -2.95, 1.0, 0.34, 0.1);
    c.fill();
    c.fillStyle = lin(c, 0, -2.92, 0, -2.66, [[0, tone(mixHex(rgbHex(R.Lt.mid), '#8a9aa8', 0.5), R, 0.4)], [1, tone('#5a6a7a', R)]]);
    rrect(c, -0.37, -2.91, 0.9, 0.26, 0.08);
    c.fill();
    c.strokeStyle = tone('#c8a46a', R, 0.4);
    c.lineWidth = 0.01;
    c.beginPath(); c.moveTo(0.3, -2.62); c.lineTo(0.3, -2.3); c.stroke();
    c.fillStyle = tone('#b8804a', R, 0.5);
    c.beginPath(); c.moveTo(0.3, -2.12); c.bezierCurveTo(0.2, -2.2, 0.22, -2.3, 0.3, -2.26); c.bezierCurveTo(0.38, -2.3, 0.4, -2.2, 0.3, -2.12); c.fill();
    vignette(c, S, 0.25);
  },
  over(c, S, R, t) {
    // the windscreen's sheen, the sun's flare low ahead
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = rgba('#ffffff', 0.04 * (1 - R.night));
    poly(c, [-1.5, -2.9, -0.9, -2.9, -1.9, -0.7, -2.4, -0.7], rgba('#ffffff', 0.05 * (1 - R.night)));
    if (R.sunK > 0.1) glow(c, rgbHex(R.sun), 1.0, -1.8, 2.0, 0.18 * R.sunK);
    // at night the dashboard's soft glow and the headlights on the road
    if (R.night > 0.2) {
      glow(c, '#ffe8b0', VP[0], -0.9, 2.2, 0.18 * R.night, 0.4);
      glow(c, '#3aa0c8', 0.95, -0.5, 0.5, 0.25 * R.night);
    }
    c.restore();
    void S; void t;
  },
  hot: {
    light: [1.25, -1.9], sky: [0.1, -2.3], sun: [1.0, -2.0], rain: [0.1, -1.8], rainbow: [0.1, -2.1], music: [0.95, -0.5],
    phone: [1.65, -0.88], car: [0.1, -1.0], heart: [0.3, -2.2], window: [0.1, -1.9],
  },
  aim: [0.1, -1.5],
  spot: [-0.3, -0.72, 0.36],
  has: ['music', 'phone', 'car', 'heart'],
  win: [-2.2, -2.9, 2.4, -0.75],
};

// ── the bike ──────────────────────────────────────────────────────

const BVP: [number, number] = [0.0, -1.35];

const bike: PlaceSet = {
  id: 'bike',
  face: 0.35,
  back(c, S, R) {
    sky(c, R, S.x0, S.y0, S.x1, BVP[1] + 0.05);
    const Lt = R.Lt;
    // the city's far edge, a line of trees
    for (let i = 0; i < 14; i++) {
      const x = S.x0 + ((S.x1 - S.x0) * i) / 14, w = 0.6 + 0.5 * hash(i), h = 0.4 + 0.8 * hash(i * 3);
      rect(c, x, BVP[1] - h, w, h + 0.1, tone(mixHex('#b8a898', rgbHex(Lt.hor), 0.55), R, 0.3));
    }
    for (let i = 0; i < 18; i++) ell(c, S.x0 + ((S.x1 - S.x0) * i) / 18, BVP[1] - 0.12, 0.45, 0.25, tone(mixHex('#6a9a5a', rgbHex(Lt.hor), 0.4), R, 0.4));
    vgrad(c, S.x0, BVP[1], S.x1 - S.x0, S.y1 - BVP[1], tone(mixHex('#9ac87a', rgbHex(Lt.hor), 0.3), R, 0.4), tone('#5a9a44', R, 0.5));
    // the lane: terracotta, a footpath beside it
    c.fillStyle = tone('#d8cfc0', R, 0.4);
    c.beginPath(); c.moveTo(BVP[0] + 0.05, BVP[1]); c.lineTo(BVP[0] + 0.14, BVP[1]); c.lineTo(BVP[0] + 4.6, 1.2); c.lineTo(BVP[0] + 2.6, 1.2); c.closePath(); c.fill();
  },
  behind(c, S, R, t) {
    roadAhead(c, R, BVP[0], BVP[1], 2.4, 1.2, '#b8644a', t, 3, '#f8f4ea');
    // trees and lamps passing at the sides
    const Lt = R.Lt;
    const off = t === 0 ? 0 : (t * 3) % 2.5;
    for (let i = 0; i < 9; i++) {
      const z = 1 + i * 2.5 - off;
      if (z < 0.7) continue;
      for (const s of [-1, 1]) {
        const x = BVP[0] + (s * 3.4) / z, y = BVP[1] + 2.4 / z, h = 2.8 / z;
        if ((i + (s > 0 ? 1 : 0)) % 2) {
          c.fillStyle = tone('#5a4230', R);
          c.fillRect(x - 0.08 / z, y - h * 0.5, 0.16 / z, h * 0.5);
          ell(c, x, y - h * 0.72, h * 0.34, h * 0.3, tone(mixHex('#5f9a4a', '#0c1418', Lt.dusk * 0.6), R, 0.6));
          ell(c, x - h * 0.08, y - h * 0.8, h * 0.2, h * 0.16, tone(mixHex('#8ac86a', '#0c1418', Lt.dusk * 0.6), R, 0.7));
        } else {
          c.fillStyle = tone('#3a3a40', R);
          c.fillRect(x - 0.03 / z, y - h * 0.9, 0.06 / z, h * 0.9);
          if (Lt.lamps > 0.2) {
            c.save();
            c.globalCompositeOperation = 'lighter';
            glow(c, '#ffd090', x, y - h * 0.9, 0.8 / z, 0.5 * Lt.lamps);
            c.restore();
          }
        }
      }
    }
    // a cyclist ahead, small, and someone on the footpath
    if (t) {
      const ph = (t * 0.02) % 1;
      const z = 6 + ph * 10;
      const x = BVP[0] + 0.5 / z * 3, y = BVP[1] + 2.4 / z;
      person(c, R, x, y, 2.2 / z, '#3a8ad8', '#3a2a22', { alpha: Math.min(1, (1 - ph) * 4) });
    }
    void S;
  },
  front(c, S, R) {
    // the handlebars, their grips, a bell, the front lamp, a basket; the wheel's top at the bottom
    c.strokeStyle = tone('#1e1e22', R, 0.2);
    c.lineWidth = 0.5;
    c.beginPath(); c.arc(0, 2.3, 2.1, Math.PI * 1.25, Math.PI * 1.75); c.stroke();
    c.strokeStyle = lin(c, -2, 0, 2, 0, [[0, tone('#2a2a30', R, 0.3)], [0.5, tone('#6a6a72', R, 0.6)], [1, tone('#2a2a30', R)]]);
    c.lineWidth = 0.13;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(-2.3, 0.1); c.quadraticCurveTo(-1.2, -0.25, 0, -0.18); c.quadraticCurveTo(1.2, -0.25, 2.3, 0.1); c.stroke();
    c.lineWidth = 0.22;
    c.strokeStyle = tone('#6a4a32', R, 0.4);
    c.beginPath(); c.moveTo(-2.35, 0.12); c.lineTo(-1.85, -0.03); c.moveTo(2.35, 0.12); c.lineTo(1.85, -0.03); c.stroke();
    c.fillStyle = tone('#2a2a30', R, 0.3);
    c.fillRect(-0.1, -0.2, 0.2, 2.0);
    // the bell
    ell(c, -1.25, -0.38, 0.14, 0.12, lin(c, -1.4, 0, -1.1, 0, [[0, tone('#f0f2f4', R, 0.9)], [1, tone('#8a949c', R)]]));
    // the basket with a few flowers in it
    c.fillStyle = tone('#c8a070', R, 0.5);
    rrect(c, 0.55, -0.85, 1.1, 0.62, 0.08);
    c.fill();
    c.strokeStyle = rgba('#6a4a2a', 0.4);
    c.lineWidth = 0.02;
    for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0.6 + i * 0.14, -0.84); c.lineTo(0.6 + i * 0.14, -0.24); c.stroke(); }
    for (let j = 0; j < 4; j++) { c.beginPath(); c.moveTo(0.56, -0.78 + j * 0.15); c.lineTo(1.64, -0.78 + j * 0.15); c.stroke(); }
    drawStill(c, 'flower', R, 1.1, -0.72, 0.7);
    vignette(c, S, 0.14);
  },
  hot: {
    sky: [0, -2.3], sun: [0, -2.1], bird: [-0.9, -2.4], grass: [-1.6, -0.8], flower: [1.1, -1.1], light: [1.3, -1.8], rain: [0, -2.0],
    rainbow: [0, -2.3], feet: [0, -0.4], window: [0, -2.0],
  },
  aim: [0, -1.4],
  spot: [-0.7, -0.24, 0.38],
  has: ['flower', 'grass'],
  win: null,
};

// ── the park ──────────────────────────────────────────────────────

const park: PlaceSet = {
  id: 'park',
  face: 0.45,
  back(c, S, R) {
    sky(c, R, S.x0, S.y0, S.x1, -1.0);
    const Lt = R.Lt;
    // roofs of the city beyond the trees
    for (let i = 0; i < 16; i++) {
      const x = S.x0 + ((S.x1 - S.x0) * i) / 16, w = 0.8, h = 0.5 + 0.6 * hash(i * 3 + 1);
      c.fillStyle = tone(mixHex('#c8a898', rgbHex(Lt.hor), 0.6), R, 0.3);
      c.beginPath(); c.moveTo(x, -1.0); c.lineTo(x, -1.0 - h); c.lineTo(x + w / 2, -1.25 - h); c.lineTo(x + w, -1.0 - h); c.lineTo(x + w, -1.0); c.closePath(); c.fill();
    }
    // the lawn, a pond with its light, the path curving away
    vgrad(c, S.x0, -1.05, S.x1 - S.x0, S.y1 + 1.05, tone(mixHex('#9ac87a', rgbHex(Lt.hor), 0.3), R, 0.5), tone('#4f8a3a', R, 0.5));
    ell(c, -2.4, -0.7, 1.4, 0.18, lin(c, 0, -0.88, 0, -0.52, [[0, tone(mixHex(rgbHex(Lt.mid), '#5a8aa8', 0.4), R, 0.5)], [1, tone('#3a6a88', R)]]));
    c.fillStyle = rgba('#ffffff', 0.25 * (1 - Lt.dusk));
    c.fillRect(-3.2, -0.74, 1.4, 0.02);
    c.fillStyle = tone('#e0d4b8', R, 0.5);
    c.beginPath(); c.moveTo(0.2, -1.05); c.quadraticCurveTo(0.8, -0.7, -0.2, -0.3); c.quadraticCurveTo(-1.2, 0.2, -0.4, 1.4); c.lineTo(1.4, 1.4); c.quadraticCurveTo(0.2, 0.3, 1.0, -0.3); c.quadraticCurveTo(1.6, -0.7, 0.35, -1.05); c.closePath(); c.fill();
    // trees in the middle distance, a playground's swing frame at the side
    for (const [x, h, seed] of [[-1.6, 2.2, 1], [1.8, 2.6, 2], [3.3, 2.0, 3], [-3.6, 2.4, 4], [0.9, 1.6, 5]] as const) tree(c, R, x, -1.0 + h * 0.04, h, '#5f9a4a', seed);
    c.strokeStyle = tone('#c8503a', R, 0.4);
    c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(2.6, -0.6); c.lineTo(2.85, -1.6); c.lineTo(3.1, -0.6); c.moveTo(3.6, -0.6); c.lineTo(3.85, -1.6); c.lineTo(4.1, -0.6); c.moveTo(2.85, -1.6); c.lineTo(3.85, -1.6); c.stroke();
    // a lamp post
    c.fillStyle = tone('#2e3a34', R);
    c.fillRect(-0.95, -2.2, 0.05, 1.6);
    rrect(c, -1.04, -2.4, 0.23, 0.24, 0.04);
    c.fill();
    if (Lt.lamps > 0.1) lampLight(c, -0.925, -2.28, 0.25, Lt.lamps);
  },
  front(c, S, R) {
    // a near tree's trunk at the left with its leaves over the top, flowers along the front, the bench at the right
    c.fillStyle = lin(c, -6.2, 0, -5.4, 0, [[0, tone('#3a2a1e', R)], [0.6, tone('#7a5a40', R, 0.5)], [1, tone('#4a3424', R)]]);
    c.beginPath(); c.moveTo(-6.3, S.y1); c.lineTo(-6.05, -3.8); c.lineTo(-5.55, -3.8); c.lineTo(-5.4, S.y1); c.closePath(); c.fill();
    for (let i = 0; i < 16; i++) {
      const x = S.x0 + (S.x1 - S.x0) * hash(i * 7 + 3) * 0.7, y = S.y0 + 0.4 + 0.8 * hash(i * 3);
      ell(c, x, y, 0.9, 0.55, tone(mixHex('#4f8a44', '#2a5a2a', hash(i)), R, 0.5));
    }
    // flowers in the grass at the front
    for (let i = 0; i < 40; i++) {
      const x = S.x0 + (S.x1 - S.x0) * hash(i * 11 + 2), y = 0.05 + 0.9 * hash(i * 5 + 1);
      const col = ['#f2a0b8', '#ffd25a', '#ffffff', '#b89ae8'][i % 4];
      c.strokeStyle = tone('#3f7a34', R, 0.4);
      c.lineWidth = 0.015;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 0.18); c.stroke();
      ell(c, x, y - 0.2, 0.05, 0.05, tone(col, R, 0.7));
    }
    // the bench
    shadow(c, 1.75, 0.02, 0.85, 0.08, 0.3);
    c.fillStyle = tone('#2e3a34', R);
    for (const x of [1.05, 2.4]) c.fillRect(x, -0.55, 0.06, 0.58);
    for (let i = 0; i < 3; i++) rect(c, 0.95, -0.52 + i * 0.07, 1.6, 0.05, tone('#a8784a', R, 0.6));
    for (let i = 0; i < 3; i++) rect(c, 0.98, -1.02 + i * 0.12, 1.55, 0.07, tone('#a8784a', R, 0.6));
    vignette(c, S, 0.12);
  },
  behind(c, S, R, t) {
    walkers(c, R, t, { y: -0.75, h: 0.5, x0: -3, x1: 3.5, n: 3, speed: 0.12, seed: 11, alpha: 0.85 });
    walkers(c, R, t, { y: 0.0, h: 0.9, x0: -2.5, x1: 2.8, n: 1, speed: 0.2, seed: 21, alpha: 0.9 });
    // birds over the trees; the swing moving gently
    if (t && R.Lt.dusk < 0.7) {
      c.strokeStyle = rgba('#2a2a36', 0.6);
      c.lineWidth = 0.015;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.03 + i * 0.33) % 1;
        const x = S.x0 + (S.x1 - S.x0) * ph, y = -2.6 + 0.3 * Math.sin(t * 0.4 + i), fl = Math.sin(t * 9 + i * 2);
        c.beginPath(); c.moveTo(x - 0.08, y - 0.04 * fl); c.quadraticCurveTo(x, y, x + 0.08, y - 0.04 * fl); c.stroke();
      }
    }
    const a = t === 0 ? 0 : Math.sin(t * 1.2) * 0.35;
    c.save();
    c.translate(3.35, -1.6);
    c.rotate(a);
    c.strokeStyle = tone('#3a3a40', R);
    c.lineWidth = 0.015;
    c.beginPath(); c.moveTo(-0.12, 0); c.lineTo(-0.12, 0.75); c.moveTo(0.12, 0); c.lineTo(0.12, 0.75); c.stroke();
    rect(c, -0.16, 0.74, 0.32, 0.05, tone('#d8a040', R, 0.5));
    c.restore();
  },
  hot: {
    grass: [-0.8, -0.3], flower: [0.4, 0.0], bird: [-0.6, -2.5], sky: [0.3, -2.4], sun: [0.3, -2.2], rain: [0.3, -2.0], rainbow: [0.3, -2.2],
    pet: [0.4, -0.5], smile: [0.6, -0.9], feet: [0.2, -0.4], light: [-0.92, -2.28],
  },
  aim: [0.2, -1.2],
  spot: [1.4, -0.55, 0.36],
  has: ['grass', 'flower', 'bird', 'light'],
  win: null,
};

// ── the garden ────────────────────────────────────────────────────

const garden: PlaceSet = {
  id: 'garden',
  face: 0.55,
  back(c, S, R) {
    sky(c, R, S.x0, S.y0, S.x1, -1.2);
    const Lt = R.Lt;
    // far allotments' trees, the fence, a shed, the apple tree
    for (let i = 0; i < 12; i++) ell(c, S.x0 + ((S.x1 - S.x0) * i) / 12, -1.4, 0.7, 0.4, tone(mixHex('#6a9a5a', rgbHex(Lt.hor), 0.45), R, 0.4));
    vgrad(c, S.x0, -1.25, S.x1 - S.x0, S.y1 + 1.25, tone(mixHex('#8ab86a', rgbHex(Lt.hor), 0.25), R, 0.5), tone('#5a8a3a', R, 0.4));
    for (let x = Math.floor(S.x0 / 0.35) * 0.35; x < S.x1; x += 0.35) {
      c.fillStyle = tone('#c8a878', R, 0.5);
      c.beginPath(); c.moveTo(x, -0.7); c.lineTo(x, -1.45); c.lineTo(x + 0.13, -1.55); c.lineTo(x + 0.26, -1.45); c.lineTo(x + 0.26, -0.7); c.closePath(); c.fill();
    }
    rect(c, S.x0, -1.35, S.x1 - S.x0, 0.06, tone('#a88858', R, 0.4));
    rect(c, S.x0, -0.95, S.x1 - S.x0, 0.06, tone('#a88858', R, 0.4));
    // the shed
    c.fillStyle = lin(c, 2.0, 0, 3.6, 0, [[0, tone('#7a9a8a', R, 0.5)], [1, tone('#4a6a5a', R)]]);
    c.fillRect(2.0, -2.1, 1.6, 1.4);
    poly(c, [1.85, -2.05, 2.8, -2.65, 3.75, -2.05], tone('#8a4a3a', R, 0.4));
    rect(c, 2.55, -1.7, 0.5, 1.0, tone('#5a7a6a', R, 0.3));
    rect(c, 2.15, -1.8, 0.3, 0.3, tone('#3a4a50', R));
    // the apple tree at the left, a sunflower row
    tree(c, R, -2.4, -0.9, 2.6, '#5f9a4a', 7, true);
    for (let i = 0; i < 4; i++) {
      const x = -1.25 + i * 0.32, h = 1.5 + 0.2 * hash(i);
      c.strokeStyle = tone('#4f8a3a', R, 0.5);
      c.lineWidth = 0.04;
      c.beginPath(); c.moveTo(x, -0.6); c.lineTo(x, -0.6 - h); c.stroke();
      ell(c, x + 0.12, -0.6 - h * 0.5, 0.12, 0.05, tone('#5f9a4a', R, 0.5), -0.4);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ell(c, x + Math.cos(a) * 0.12, -0.6 - h + Math.sin(a) * 0.12, 0.08, 0.035, tone('#f8c830', R, 0.7), a); }
      ell(c, x, -0.6 - h, 0.08, 0.08, tone('#6a4422', R, 0.3));
    }
  },
  front(c, S, R) {
    // a raised bed with rows of greens and seedlings, soil; the watering can; flowers along the front
    c.fillStyle = lin(c, 0, -0.1, 0, 0.6, [[0, tone('#a8784a', R, 0.5)], [1, tone('#6a4a2a', R)]]);
    c.fillRect(-2.8, -0.12, 5.4, 0.7);
    c.fillStyle = lin(c, 0, -0.3, 0, -0.08, [[0, tone('#6a4a32', R, 0.3)], [1, tone('#3a281c', R)]]);
    c.beginPath(); c.moveTo(-2.75, -0.1); c.quadraticCurveTo(0, -0.34, 2.55, -0.1); c.closePath(); c.fill();
    for (let i = 0; i < 18; i++) {
      const x = -2.5 + i * 0.28, y = -0.2 - 0.06 * Math.sin((i / 17) * Math.PI);
      if (i % 3 === 0) {
        // a lettuce
        for (let k = 0; k < 6; k++) ell(c, x + (k - 2.5) * 0.04, y - 0.06 - (k % 2) * 0.04, 0.1, 0.07, tone(mixHex('#8ac85a', '#4f8a3a', k / 6), R, 0.6), (k - 2.5) * 0.4);
      } else {
        // seedlings
        c.strokeStyle = tone('#6aa84a', R, 0.6);
        c.lineWidth = 0.015;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 0.12); c.stroke();
        ell(c, x - 0.04, y - 0.12, 0.04, 0.018, tone('#8ac85a', R, 0.7), -0.4);
        ell(c, x + 0.04, y - 0.12, 0.04, 0.018, tone('#8ac85a', R, 0.7), 0.4);
      }
    }
    // the watering can
    shadow(c, 1.6, -0.1, 0.4, 0.06, 0.3);
    c.fillStyle = lin(c, 1.3, 0, 1.9, 0, [[0, tone('#7ab0a8', R, 0.6)], [1, tone('#3a6a64', R)]]);
    rrect(c, 1.32, -0.62, 0.56, 0.5, 0.06);
    c.fill();
    c.strokeStyle = tone('#4a8078', R, 0.5);
    c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(1.36, -0.5); c.lineTo(1.0, -0.82); c.stroke();
    c.beginPath(); c.arc(1.6, -0.62, 0.2, Math.PI, TAU); c.stroke();
    ell(c, 0.97, -0.85, 0.06, 0.04, tone('#4a8078', R, 0.5), -0.6);
    // flowers and grass along the front
    for (let i = 0; i < 46; i++) {
      const x = S.x0 + (S.x1 - S.x0) * hash(i * 13 + 5), y = 0.62 + 0.6 * hash(i * 7);
      c.strokeStyle = tone('#3f7a34', R, 0.4);
      c.lineWidth = 0.02;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 0.05, y - 0.12, x + 0.02, y - 0.24); c.stroke();
      if (i % 3 === 0) ell(c, x + 0.02, y - 0.26, 0.05, 0.05, tone(['#f2a0b8', '#ffd25a', '#b89ae8'][i % 3 === 0 ? (i / 3) % 3 | 0 : 0], R, 0.7));
    }
    vignette(c, S, 0.12);
  },
  behind(c, S, R, t) {
    if (!t) return;
    // bees and butterflies over the beds, a bird on the fence
    c.save();
    for (let i = 0; i < 4; i++) {
      const x = -2 + 4 * ((t * 0.05 * (0.5 + hash(i)) + hash(i * 3)) % 1), y = -0.6 + Math.sin(t * 1.4 + i * 2) * 0.25;
      const fl = Math.abs(Math.sin(t * 16 + i));
      const col = i % 2 ? '#f8f0e0' : '#f0a040';
      ell(c, x - 0.04 * fl, y, 0.05 * fl + 0.01, 0.035, tone(col, R, 0.7));
      ell(c, x + 0.04 * fl, y, 0.05 * fl + 0.01, 0.035, tone(col, R, 0.7));
    }
    c.restore();
    // a cat walking along the fence's rail now and then
    const ph = (t * 0.03) % 1;
    if (ph < 0.4) {
      const x = -3.5 + (ph / 0.4) * 7, y = -1.37;
      ell(c, x, y - 0.1, 0.17, 0.08, tone('#3a3236', R, 0.3));
      ell(c, x + 0.17, y - 0.17, 0.07, 0.065, tone('#3a3236', R, 0.3));
      poly(c, [x + 0.12, y - 0.21, x + 0.14, y - 0.29, x + 0.18, y - 0.22], tone('#3a3236', R));
      poly(c, [x + 0.19, y - 0.22, x + 0.23, y - 0.29, x + 0.24, y - 0.2], tone('#3a3236', R));
      c.strokeStyle = tone('#3a3236', R);
      c.lineWidth = 0.03;
      c.beginPath(); c.moveTo(x - 0.15, y - 0.12); c.quadraticCurveTo(x - 0.3, y - 0.35, x - 0.25, y - 0.4); c.stroke();
    }
    void S;
  },
  hot: {
    seed: [-0.6, -0.36], flower: [-0.8, -2.1], grass: [0.2, 0.6], apple: [-2.4, -2.5], sun: [0.6, -2.3], sky: [0.6, -2.4], bird: [0.4, -1.5],
    rain: [0.6, -2.0], rainbow: [0.6, -2.3], pet: [0, -1.55], hand: [-0.6, -0.36],
  },
  aim: [0, -0.9],
  spot: [0.6, -0.2, 0.42],
  has: ['seed', 'flower', 'grass', 'apple', 'pet', 'hand'],
  win: null,
};

// ── the shop ──────────────────────────────────────────────────────

const shop: PlaceSet = {
  id: 'shop',
  face: 0.4,
  back(c, S, R) {
    rect(c, S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, tone('#e8e4dc', R, 0.3));
    // the ceiling's lights
    for (let x = Math.floor(S.x0 / 1.6) * 1.6; x < S.x1; x += 1.6) {
      rect(c, x + 0.2, -3.25, 1.2, 0.08, tone('#fbfbf4', R, 0, 1));
      lampLight(c, x + 0.8, -3.2, 0.4, 0.4);
    }
    // the shelves of goods along the wall
    const goods = ['#e8503a', '#f0c040', '#3a8ad8', '#5aaa4a', '#e88ab0', '#f4f0e8', '#8a5a3a', '#f0a030'];
    for (let r = 0; r < 4; r++) {
      const y = -2.75 + r * 0.55;
      rect(c, S.x0, y + 0.45, S.x1 - S.x0, 0.06, tone('#b8b4ac', R, 0.4));
      for (let x = S.x0; x < S.x1; x += 0.22) {
        const k = Math.floor(hash(Math.floor(x * 10) + r * 97) * goods.length);
        const h = 0.25 + 0.17 * hash(Math.floor(x * 7) + r * 31);
        if (x > -2.6 && x < -1.2) continue;
        rect(c, x + 0.01, y + 0.45 - h, 0.19, h, tone(goods[k], R, 0.4));
        rect(c, x + 0.04, y + 0.45 - h * 0.7, 0.13, 0.04, rgba('#ffffff', 0.5));
      }
    }
    // the fridge cabinets' glass doors and their cool light
    c.fillStyle = tone('#c8d8e0', R, 0.3);
    c.fillRect(-2.6, -2.9, 1.4, 2.6);
    c.save();
    c.globalCompositeOperation = 'lighter';
    glow(c, '#e0f2ff', -1.9, -1.6, 1.4, 0.25);
    c.restore();
    for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) rect(c, -2.5 + q * 0.26, -2.6 + r * 0.6, 0.2, 0.3, tone(['#ffffff', '#f0e0a0', '#a8d8f0', '#f8c8c8'][(r + q) % 4], R, 0.4));
    c.strokeStyle = tone('#8a949c', R, 0.4);
    c.lineWidth = 0.03;
    c.strokeRect(-2.6, -2.9, 1.4, 2.6);
    c.beginPath(); c.moveTo(-1.9, -2.9); c.lineTo(-1.9, -0.3); c.stroke();
    // the bread rack
    rect(c, 0.6, -1.35, 1.4, 0.05, tone('#a8784a', R, 0.4));
    rect(c, 0.6, -0.8, 1.4, 0.05, tone('#a8784a', R, 0.4));
    for (let i = 0; i < 4; i++) drawStill(c, 'bread', R, 0.78 + i * 0.34, -1.33, 0.36);
  },
  front(c, S, R) {
    // the fruit and vegetables' stand at the front, the checkout at the right with its till
    c.fillStyle = lin(c, 0, 0, 0, 1.2, [[0, tone('#a8784a', R, 0.4)], [1, tone('#6a4a2a', R)]]);
    c.fillRect(-1.8, 0.0, 2.6, 1.3);
    rect(c, -1.85, -0.05, 2.7, 0.08, tone('#c8946a', R, 0.5));
    const crates: [number, string, string][] = [[-1.4, '#d8302a', 'apple'], [-0.55, '#f08a2a', 'orange'], [0.3, '#7ab84a', 'greens']];
    for (const [x, col, kind] of crates) {
      for (let i = 0; i < 9; i++) {
        const px = x + (i % 3 - 1) * 0.22 + (Math.floor(i / 3) % 2) * 0.1, py = -0.1 - Math.floor(i / 3) * 0.12;
        if (kind === 'apple') drawStill(c, 'apple', R, px, py + 0.02, 0.2);
        else if (kind === 'orange') ell(c, px, py - 0.08, 0.09, 0.09, lin(c, px - 0.08, py - 0.16, px + 0.08, py, [[0, tone('#ffc060', R, 0.7)], [1, tone(col, R, 0.3)]]));
        else ell(c, px, py - 0.07, 0.11, 0.08, tone(mixHex(col, '#4f8a3a', hash(i) * 0.5), R, 0.6));
      }
    }
    // the checkout and its till
    c.fillStyle = lin(c, 1.8, 0, 3.8, 0, [[0, tone('#e8e4dc', R, 0.4)], [1, tone('#b8b4ac', R)]]);
    c.fillRect(1.8, -0.6, 2.4, 2.0);
    rect(c, 1.8, -0.66, 2.4, 0.08, tone('#3a3a40', R, 0.3));
    c.fillStyle = tone('#2a2a30', R, 0.3);
    rrect(c, 2.9, -1.2, 0.7, 0.5, 0.05);
    c.fill();
    rect(c, 2.98, -1.12, 0.54, 0.2, tone('#5ab08a', R, 0, 1));
    // a shopping basket
    c.fillStyle = tone('#d8503a', R, 0.5);
    rrect(c, 2.0, -1.0, 0.7, 0.34, 0.05);
    c.fill();
    c.strokeStyle = tone('#d8503a', R, 0.5);
    c.lineWidth = 0.035;
    c.beginPath(); c.arc(2.35, -1.0, 0.25, Math.PI, TAU); c.stroke();
    vignette(c, S, 0.15);
  },
  behind(c, S, R, t) {
    walkers(c, R, t, { y: -0.25, h: 1.25, x0: -3.2, x1: 3.2, n: 2, speed: 0.15, seed: 31, alpha: 0.85, coats: ['#5a6a8a', '#a8604a', '#6a8a5a'] });
    // the queue at the checkout: two waiting, the cashier
    person(c, R, 2.55, -0.3, 1.5, '#6a5a8a', '#3a2a22', { back: true, alpha: 0.95 });
    person(c, R, 3.6, -0.64, 1.8, '#3a8a7a', '#8a5a3a', { sit: true, alpha: 0.95 });
    void S;
  },
  hot: {
    apple: [-1.4, -0.25], bread: [1.3, -1.45], fridge: [-1.9, -1.6], queue: [2.8, -1.2], smile: [3.6, -1.6], light: [0.8, -3.2],
    switch: [0.8, -3.2], flower: [0.3, -0.25],
  },
  aim: [0, -1.2],
  spot: [0.9, -0.05, 0.4],
  has: ['apple', 'bread', 'fridge', 'queue', 'smile'],
  win: null,
};

export const OUT_SETS: Partial<Record<Place, PlaceSet>> = { bus, car, bike, park, garden, shop };
