/**
 * The places of Dawid's lands as levels (lands.ts), drawn on the canvas at their feet (x, y) with `s` px per u, the
 * same hand as paint.ts: the landmarks (Jesse's house and sheepfold, the well of Bethlehem, a town wall, the great
 * terebinth, thorns, tents and Saul's tent, the vineyard and its tower, barley, the stone Ezel, the cave, the spring of
 * En-gedi, the wild goats' rocks, burnt Ziklag, the gate of Gath, a milestone, smooth stones by the brook, Michal's
 * window, Shammah's lentils, the Philistine camp, the giants' tents); the barriers between areas (a dry-stone wall, a
 * thorn hedge, a rocky ridge) with their pass, closed or open; the dusty paths; the things a quest finds or carries.
 * Every shape is a fill or a stroke (no per-frame gradients, no filters); the glow is paint.ts's baked sprite.
 */
import { C, ellipse, glow, hash, paintAnimal, paintDeco, paintSheep, paintTent, shadow } from './paint';
import type { Barrier, Landmark } from './lands';

const TAU = Math.PI * 2;

/** A flat-roofed stone house of Judah: walls, a darker roof edge, a door, a small window. */
function house(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k = 1): void {
  const w = s * 2.4 * k, h = s * 1.5 * k;
  shadow(ctx, x, y + s * 0.05, w * 0.6, 0.25);
  ctx.fillStyle = '#d9cbb0';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#b9a988';
  ctx.fillRect(x - w / 2, y - h * 0.25, w, h * 0.25);
  ctx.fillStyle = '#8f7a5a';
  ctx.fillRect(x - w / 2 - s * 0.08, y - h - s * 0.16, w + s * 0.16, s * 0.18);
  ctx.fillStyle = '#5a4630';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.28 * k, y);
  ctx.lineTo(x - s * 0.28 * k, y - h * 0.62);
  ctx.quadraticCurveTo(x, y - h * 0.8, x + s * 0.28 * k, y - h * 0.62);
  ctx.lineTo(x + s * 0.28 * k, y);
  ctx.fill();
  ctx.fillStyle = '#3a2c1e';
  ctx.fillRect(x + w * 0.24, y - h * 0.72, s * 0.3 * k, s * 0.26 * k);
  // a jar by the door
  ellipse(ctx, x - w * 0.36, y - s * 0.18, s * 0.14, s * 0.2, '#b8743c');
}

/** Michal's window: a two-storey house with a window high up and a rope hanging from it. */
function windowHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const w = s * 2.2, h = s * 2.6;
  shadow(ctx, x, y + s * 0.05, w * 0.6, 0.25);
  ctx.fillStyle = '#d4c3a4';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#b3a07e';
  for (let i = 0; i < 5; i++) ctx.fillRect(x - w / 2, y - h + i * s * 0.55, w, s * 0.04);
  ctx.fillStyle = '#8a7656';
  ctx.fillRect(x - w / 2 - s * 0.08, y - h - s * 0.16, w + s * 0.16, s * 0.18);
  ctx.fillStyle = '#2e2216';
  ctx.fillRect(x - s * 0.3, y - h * 0.78, s * 0.6, s * 0.5);
  ctx.fillStyle = '#e8c27a';
  ctx.fillRect(x - s * 0.24, y - h * 0.76, s * 0.48, s * 0.08);
  ctx.strokeStyle = '#a5824a';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.05, y - h * 0.6);
  ctx.quadraticCurveTo(x + s * 0.2 + Math.sin(t * 1.3) * s * 0.06, y - h * 0.3, x + s * 0.12, y - s * 0.05);
  ctx.stroke();
  ctx.fillStyle = '#5a4630';
  ctx.fillRect(x - w * 0.38, y - s * 0.9, s * 0.46, s * 0.9);
}

/** The sheepfold: a ring of stones with a gap, sheep inside. */
function fold(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    if (a > 1.2 && a < 1.9) continue;   // the gap: the shepherd lies across it at night
    const k = hash(i * 13 + 5);
    ellipse(ctx, x + Math.cos(a) * s * 2.2, y + Math.sin(a) * s * 1.1, s * 0.24, s * 0.16, k < 0.5 ? C.limeShade : '#d4c9b1');
    ellipse(ctx, x + Math.cos(a) * s * 2.2, y + Math.sin(a) * s * 1.1 - s * 0.14, s * 0.18, s * 0.1, '#e5dcc7');
  }
  for (let i = 0; i < 5; i++) paintSheep(ctx, x + (i - 2) * s * 0.6, y - s * 0.1 + ((i * 3) % 2) * s * 0.35, s * 0.9, t + i * 0.7);
}

/** The well of Bethlehem: a round stone curb, dark water, a beam with its rope and bucket, jars around. */
function well(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  shadow(ctx, x, y + s * 0.1, s * 1.1, 0.25);
  ellipse(ctx, x, y - s * 0.25, s * 0.95, s * 0.48, '#b9ac90');
  ellipse(ctx, x, y - s * 0.38, s * 0.95, s * 0.46, '#d8ccb2');
  ellipse(ctx, x, y - s * 0.42, s * 0.68, s * 0.3, '#2e4a5e');
  ellipse(ctx, x - s * 0.2, y - s * 0.46, s * 0.2, s * 0.07, `rgba(200,230,250,${0.35 + 0.15 * Math.sin(t * 2)})`);
  ctx.strokeStyle = '#6b5236';
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.8, y - s * 0.3);
  ctx.lineTo(x - s * 0.8, y - s * 1.5);
  ctx.lineTo(x + s * 0.8, y - s * 1.5);
  ctx.lineTo(x + s * 0.8, y - s * 0.3);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.1, y - s * 1.5);
  ctx.lineTo(x + s * 0.1, y - s * 0.95);
  ctx.stroke();
  ellipse(ctx, x + s * 0.1, y - s * 0.9, s * 0.12, s * 0.1, '#8a6a42');
  for (const [dx, dy] of [[1.3, 0.1], [1.6, -0.1], [-1.3, 0.15]]) ellipse(ctx, x + dx * s, y + dy * s - s * 0.2, s * 0.15, s * 0.22, '#b8743c');
}

/** A stretch of a town wall with a tower at its end. */
function cityWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  const w = s * 8, h = s * 1.7;
  shadow(ctx, x, y + s * 0.05, w * 0.5, 0.2);
  ctx.fillStyle = '#cdbb98';
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = '#b5a17c';
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2, y - h + i * s * 0.55 + s * 0.4, w, s * 0.05);
  for (let i = 0; i < 12; i++) {
    const bx = x - w / 2 + (i + 0.5) * (w / 12);
    ctx.fillRect(bx - s * 0.05, y - h + (i % 2) * s * 0.3, s * 0.05, s * 0.55);
  }
  ctx.fillStyle = '#d9c8a6';
  for (let i = 0; i < 11; i++) ctx.fillRect(x - w / 2 + i * (w / 11) + s * 0.1, y - h - s * 0.28, w / 11 - s * 0.2, s * 0.3);
  // the tower
  ctx.fillStyle = '#c2ae8a';
  ctx.fillRect(x + w / 2 - s * 1.2, y - h - s * 1.1, s * 1.4, h + s * 1.1);
  ctx.fillStyle = '#2e2216';
  ctx.fillRect(x + w / 2 - s * 0.7, y - h - s * 0.6, s * 0.3, s * 0.45);
}

/** The gate of Gath: two towers and a dark arch between them. */
function cityGate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  shadow(ctx, x, y + s * 0.1, s * 3.6, 0.25);
  for (const dx of [-1.9, 1.9]) {
    ctx.fillStyle = '#b8a27a';
    ctx.fillRect(x + dx * s - s * 0.9, y - s * 3.1, s * 1.8, s * 3.1);
    ctx.fillStyle = '#cdb890';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + dx * s - s * 0.9 + i * s * 0.66, y - s * 3.45, s * 0.46, s * 0.36);
    ctx.fillStyle = '#3a2c1e';
    ctx.fillRect(x + dx * s - s * 0.12, y - s * 2.5, s * 0.24, s * 0.4);
  }
  ctx.fillStyle = '#a8916a';
  ctx.fillRect(x - s * 1.0, y - s * 2.6, s * 2.0, s * 2.6);
  ctx.fillStyle = '#20180f';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.7, y);
  ctx.lineTo(x - s * 0.7, y - s * 1.4);
  ctx.quadraticCurveTo(x, y - s * 2.2, x + s * 0.7, y - s * 1.4);
  ctx.lineTo(x + s * 0.7, y);
  ctx.fill();
  // the marks David scratched on the doors (1 Sam 21:13)
  ctx.strokeStyle = 'rgba(240,225,190,.55)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const mx = x + s * 0.95 + i * s * 0.12, my = y - s * (0.9 + (i % 2) * 0.3);
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + s * 0.08, my - s * 0.4);
  }
  ctx.stroke();
}

/** A vineyard: rows of vines on stakes, the grapes dark among the leaves (a few fills a row). */
function vines(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  for (let r = 0; r < 5; r++) {
    const ry = y - s * 2 + r * s * 1.0;
    ctx.strokeStyle = 'rgba(110,80,50,.55)';
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - s * 4, ry);
    ctx.lineTo(x + s * 4, ry);
    for (let i = 0; i < 8; i++) {
      const vx = x - s * 3.6 + i * s * 1.0 + (r % 2) * s * 0.5;
      ctx.moveTo(vx, ry);
      ctx.lineTo(vx, ry - s * 0.5);
    }
    ctx.stroke();
    // the leaves: one thick stroke a row, tufts swaying
    ctx.strokeStyle = r % 2 ? '#6f8a45' : '#7d984c';
    ctx.lineWidth = Math.max(3, s * 0.42);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const vx = x - s * 3.6 + i * s * 1.0 + (r % 2) * s * 0.5, sw = Math.sin(t * 0.9 + i + r) * s * 0.03;
      ctx.moveTo(vx - s * 0.2 + sw, ry - s * 0.56);
      ctx.lineTo(vx + s * 0.2 + sw, ry - s * 0.56);
    }
    ctx.stroke();
    ctx.fillStyle = '#5a3a5e';
    for (let i = r % 3; i < 8; i += 3) ellipse(ctx, x - s * 3.45 + i * s * 1.0 + (r % 2) * s * 0.5, ry - s * 0.4, s * 0.07, s * 0.09, '#5a3a5e');
  }
  ctx.restore();
}

/** A field of barley: golden rows of ears swaying (one path a row: stalks thin, ears thick and round-capped). */
function barley(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ellipse(ctx, x, y - s * 0.6, s * 3.8, s * 2.2, 'rgba(220,190,110,.35)');
  ctx.save();
  ctx.lineCap = 'round';
  for (let r = 0; r < 6; r++) {
    const ry = y - s * 2.2 + r * s * 0.7;
    const sw = (i: number) => Math.sin(t * 1.4 + i * 0.6 + r) * s * 0.05;
    ctx.strokeStyle = '#c9a24a';
    ctx.lineWidth = Math.max(1, s * 0.035);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const bx = x - s * 3.3 + i * s * 0.58 + (r % 2) * s * 0.29;
      ctx.moveTo(bx, ry);
      ctx.lineTo(bx + sw(i), ry - s * 0.36);
    }
    ctx.stroke();
    ctx.strokeStyle = '#e6c46a';
    ctx.lineWidth = Math.max(2, s * 0.1);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const bx = x - s * 3.3 + i * s * 0.58 + (r % 2) * s * 0.29;
      ctx.moveTo(bx + sw(i), ry - s * 0.38);
      ctx.lineTo(bx + sw(i) * 1.2, ry - s * 0.56);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Shammah's field of lentils: low green rows. */
function lentils(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ellipse(ctx, x, y, s * 3, s * 1.6, 'rgba(120,100,60,.25)');
  for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
    const lx = x - s * 2.6 + i * s * 0.65 + (r % 2) * s * 0.3, ly = y - s * 1.0 + r * s * 0.6;
    ellipse(ctx, lx, ly, s * 0.22, s * 0.12, (i + r) % 2 ? '#7d9a4a' : '#93ad5a');
  }
}

/** A round stone watchtower in a vineyard. */
function tower(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  shadow(ctx, x, y + s * 0.05, s * 1.1, 0.25);
  ctx.fillStyle = '#cbbd9e';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.9, y);
  ctx.lineTo(x - s * 0.75, y - s * 2.4);
  ctx.lineTo(x + s * 0.75, y - s * 2.4);
  ctx.lineTo(x + s * 0.9, y);
  ctx.fill();
  ellipse(ctx, x, y - s * 2.4, s * 0.8, s * 0.3, '#ddd0b4');
  ctx.fillStyle = '#3a2c1e';
  ctx.fillRect(x - s * 0.15, y - s * 1.7, s * 0.3, s * 0.4);
  ctx.fillStyle = '#b3a383';
  for (let i = 0; i < 4; i++) ctx.fillRect(x - s * 0.85, y - s * (0.4 + i * 0.5), s * 1.7, s * 0.04);
}

/** The stone Ezel: a great boulder with moss, where David waited (1 Sam 20:19). */
function ezel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  shadow(ctx, x, y + s * 0.1, s * 2, 0.3);
  ctx.fillStyle = '#a89c84';
  ctx.beginPath();
  ctx.moveTo(x - s * 2, y);
  ctx.quadraticCurveTo(x - s * 2.1, y - s * 1.8, x - s * 0.4, y - s * 2.3);
  ctx.quadraticCurveTo(x + s * 1.6, y - s * 2.2, x + s * 1.9, y);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x - s * 0.5, y - s * 1.6, s * 0.9, s * 0.4, '#c4b89e');
  ellipse(ctx, x + s * 0.9, y - s * 0.4, s * 0.6, s * 0.25, '#7d8a52');
  ctx.strokeStyle = 'rgba(70,58,40,.45)';
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y - s * 2.1);
  ctx.lineTo(x + s * 0.05, y - s * 1.3);
  ctx.lineTo(x + s * 0.3, y - s * 0.7);
  ctx.stroke();
}

/** A rock face with the dark arched mouth of a cave (En-gedi; David spares Saul inside, 1 Sam 24). */
function cave(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, t: number): void {
  const S = s * k;
  ctx.fillStyle = '#b59e7a';
  ctx.beginPath();
  ctx.moveTo(x - S * 4.2, y + S * 0.3);
  ctx.quadraticCurveTo(x - S * 3.6, y - S * 2.6, x - S * 1.2, y - S * 3.1);
  ctx.quadraticCurveTo(x + S * 1.4, y - S * 3.6, x + S * 3.5, y - S * 2.2);
  ctx.quadraticCurveTo(x + S * 4.4, y - S * 0.8, x + S * 4.2, y + S * 0.3);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x - S * 1.4, y - S * 2.4, S * 1.6, S * 0.5, '#cdb894');
  ellipse(ctx, x + S * 2.2, y - S * 1.7, S * 1.0, S * 0.4, '#cdb894');
  ctx.fillStyle = '#1e1712';
  ctx.beginPath();
  ctx.moveTo(x - S * 1.1, y + S * 0.2);
  ctx.quadraticCurveTo(x - S * 1.2, y - S * 1.9, x, y - S * 2.0);
  ctx.quadraticCurveTo(x + S * 1.2, y - S * 1.9, x + S * 1.1, y + S * 0.2);
  ctx.fill();
  // a drip shining in the dark
  ellipse(ctx, x + S * 0.4, y - S * (1.2 - ((t * 0.4) % 1) * 1.1), S * 0.04, S * 0.07, 'rgba(170,210,235,.8)');
}

/** The spring of En-gedi: a pool with reeds and two palms. */
function spring(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, k: number, t: number): void {
  const S = s * k;
  ellipse(ctx, x, y, S * 2.4, S * 1.1, '#5f9fc4');
  ellipse(ctx, x - S * 0.3, y - S * 0.1, S * 1.8, S * 0.7, '#7fb6d4');
  for (let i = 0; i < 3; i++) {
    const r = ((t * 0.5 + i / 3) % 1) * S * 1.4;
    ctx.strokeStyle = `rgba(230,246,252,${0.5 * (1 - r / (S * 1.4))})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    ctx.ellipse(x + S * 0.4, y, r, r * 0.45, 0, 0, TAU);
    ctx.stroke();
  }
  paintDeco(ctx, { kind: 'reeds', x: 0, y: 0, r: 0.4, seed: 3 }, x - S * 2.2, y + S * 0.3, s, t);
  paintDeco(ctx, { kind: 'reeds', x: 0, y: 0, r: 0.4, seed: 5 }, x + S * 2.1, y + S * 0.4, s, t);
  paintDeco(ctx, { kind: 'palm', x: 0, y: 0, r: 1.3, seed: 2 }, x - S * 2.6, y - S * 0.4, s, t);
  paintDeco(ctx, { kind: 'palm', x: 0, y: 0, r: 1.1, seed: 4 }, x + S * 2.8, y - S * 0.2, s, t);
}

/** Rocks with wild goats on them (1 Sam 24:2). */
function goats(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  for (const [dx, dy, r] of [[-1.2, 0, 1.3], [0.9, 0.2, 1.1], [0, -0.6, 0.9]] as const) {
    paintDeco(ctx, { kind: 'rock', x: 0, y: 0, r, seed: Math.round(dx * 10 + 50) }, x + dx * s, y + dy * s, s, t);
  }
  paintAnimal(ctx, 'ibex', x - s * 0.9, y - s * 1.1, s * 0.9, { flip: 1, step: 0, moving: 0, t });
  paintAnimal(ctx, 'ibex', x + s * 0.7, y - s * 0.75, s * 0.75, { flip: -1, step: 0, moving: 0, t: t + 1 });
}

/** Burnt Ziklag: broken walls, soot, a thread of smoke. */
function ruins(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  for (const [dx, dy, k] of [[-2.4, 0.4, 0.9], [0.4, -0.4, 1.1], [2.6, 0.6, 0.8]] as const) {
    const hx = x + dx * s, hy = y + dy * s, w = s * 2.2 * k, h = s * 1.2 * k;
    shadow(ctx, hx, hy + s * 0.05, w * 0.55, 0.25);
    ctx.fillStyle = '#b3a283';
    ctx.beginPath();
    ctx.moveTo(hx - w / 2, hy);
    ctx.lineTo(hx - w / 2, hy - h);
    ctx.lineTo(hx - w * 0.1, hy - h * 0.7);
    ctx.lineTo(hx + w * 0.15, hy - h * 1.05);
    ctx.lineTo(hx + w / 2, hy - h * 0.5);
    ctx.lineTo(hx + w / 2, hy);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,30,24,.45)';
    ctx.fillRect(hx - w / 2, hy - h * 0.55, w, h * 0.12);
    ctx.fillStyle = '#2a211a';
    ctx.fillRect(hx - s * 0.2 * k, hy - h * 0.55, s * 0.4 * k, h * 0.55);
  }
  for (let i = 0; i < 4; i++) {
    const k = ((t * 0.25 + i / 4) % 1);
    ellipse(ctx, x + s * 0.6 + Math.sin(k * 4 + i) * s * 0.3, y - s * (1.6 + k * 2.4), s * (0.2 + k * 0.4), s * (0.16 + k * 0.3), `rgba(120,110,104,${0.3 * (1 - k)})`);
  }
}

/** A standing stone by the road, notched with the miles. */
function milestone(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  shadow(ctx, x, y, s * 0.4, 0.25);
  ctx.fillStyle = '#bfb196';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.3, y);
  ctx.lineTo(x - s * 0.24, y - s * 1.3);
  ctx.quadraticCurveTo(x, y - s * 1.5, x + s * 0.24, y - s * 1.3);
  ctx.lineTo(x + s * 0.3, y);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,64,44,.55)';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  for (let i = 0; i < 3; i++) { ctx.moveTo(x - s * 0.12, y - s * (0.5 + i * 0.22)); ctx.lineTo(x + s * 0.12, y - s * (0.5 + i * 0.22)); }
  ctx.stroke();
}

/** Smooth stones by the brook, white and grey, a few glinting. */
function pebbles(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  for (let i = 0; i < 9; i++) {
    const k = hash(i * 17 + 3);
    const px = x + (k - 0.5) * s * 2.6, py = y + (hash(i * 5 + 1) - 0.5) * s * 0.9;
    ellipse(ctx, px, py, s * (0.12 + k * 0.06), s * (0.08 + k * 0.04), k < 0.5 ? '#f1ece0' : '#cfc6b2');
    if (i % 3 === 0) ellipse(ctx, px - s * 0.03, py - s * 0.03, s * 0.04, s * 0.02, `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 3 + i)})`);
  }
}

/** A thorn thicket: dark tangled bushes with brown spikes. */
function thorns(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  shadow(ctx, x, y, s * 1.4, 0.2);
  for (let i = 0; i < 5; i++) ellipse(ctx, x + (i - 2) * s * 0.5, y - s * (0.4 + (i % 2) * 0.2), s * 0.55, s * 0.42, i % 2 ? '#5d6a38' : '#4b5830');
  ctx.strokeStyle = '#6e5232';
  ctx.lineWidth = Math.max(1, s * 0.035);
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = hash(i * 3) * TAU, bx = x + (hash(i * 7) - 0.5) * s * 2.2, by = y - s * (0.3 + hash(i * 11) * 0.6);
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + Math.cos(a) * s * 0.22, by + Math.sin(a) * s * 0.16);
  }
  ctx.stroke();
}

/** Saul's tent: big, striped purple and gold, a pole with a pennant. */
function kingTent(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  const S = s * 1.5;
  shadow(ctx, x, y + s * 0.05, S * 1.3, 0.25);
  ctx.fillStyle = '#6a2a4a';
  ctx.beginPath();
  ctx.moveTo(x - S * 1.3, y);
  ctx.lineTo(x - S * 0.4, y - S * 1.3);
  ctx.lineTo(x + S * 0.4, y - S * 1.3);
  ctx.lineTo(x + S * 1.3, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d9a23d';
  for (let i = -1; i <= 1; i++) ctx.fillRect(x + i * S * 0.5 - S * 0.05, y - S * 1.1 + Math.abs(i) * S * 0.45, S * 0.1, S * 1.1 - Math.abs(i) * S * 0.45);
  ctx.fillStyle = '#20180f';
  ctx.beginPath();
  ctx.moveTo(x - S * 0.3, y);
  ctx.lineTo(x, y - S * 0.75);
  ctx.lineTo(x + S * 0.3, y);
  ctx.fill();
  ctx.strokeStyle = '#6b5236';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y - S * 1.3);
  ctx.lineTo(x, y - S * 2.1);
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.moveTo(x, y - S * 2.1);
  ctx.lineTo(x + S * (0.6 + 0.05 * Math.sin(t * 3)), y - S * 1.95);
  ctx.lineTo(x, y - S * 1.8);
  ctx.fill();
}

/** The Philistine camp across the valley: tents and small figures; they run when the giant falls. */
function philistines(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, run: number): void {
  if (run >= 1) return;
  ctx.save();
  ctx.globalAlpha = 1 - run;
  for (let i = 0; i < 6; i++) {
    const tx = x + (i - 2.5) * s * 4 + run * s * 6;
    paintTent(ctx, tx, y - (i % 2) * s * 0.4, s * 0.8, 1);
    for (let j = 0; j < 2; j++) {
      const px = tx + s * (0.9 + j * 0.7) + run * s * 10, py = y - s * 1.6;
      ctx.fillStyle = 'rgba(70,52,40,.75)';
      ctx.beginPath();
      ctx.ellipse(px, py + s * 0.4, s * 0.14, s * 0.4, 0, 0, TAU);
      ctx.fill();
      ellipse(ctx, px, py - s * 0.1, s * 0.11, s * 0.11, 'rgba(70,52,40,.75)');
    }
  }
  ctx.restore();
}

/** Draw a landmark at its feet; `k` scales it; `run` (0..1) is the Philistines' flight. */
export function paintLandmark(ctx: CanvasRenderingContext2D, kind: Landmark, x: number, y: number, s: number, k: number, t: number, run = 0): void {
  switch (kind) {
    case 'house': house(ctx, x, y, s, k); break;
    case 'window': windowHouse(ctx, x, y, s, t); break;
    case 'fold': fold(ctx, x, y, s, t); break;
    case 'well': well(ctx, x, y, s, t); break;
    case 'citywall': cityWall(ctx, x, y, s); break;
    case 'citygate': cityGate(ctx, x, y, s); break;
    case 'tree': paintDeco(ctx, { kind: 'terebinth', x: 0, y: 0, r: 1.5 * k, seed: Math.round(x + y) }, x, y, s, t); break;
    case 'thorns': thorns(ctx, x, y, s); break;
    case 'tents': for (let i = 0; i < 3; i++) paintTent(ctx, x + (i - 1) * s * 2.4, y + (i % 2) * s * 0.3, s * 0.85, i % 2); break;
    case 'gianttents': for (let i = 0; i < 2; i++) paintTent(ctx, x + (i - 0.5) * s * 3.6, y + i * s * 0.4, s * 1.5, 1); break;
    case 'kingtent': kingTent(ctx, x, y, s, t); break;
    case 'vines': vines(ctx, x, y, s, t); break;
    case 'tower': tower(ctx, x, y, s); break;
    case 'barley': barley(ctx, x, y, s, t); break;
    case 'lentils': lentils(ctx, x, y, s); break;
    case 'ezel': ezel(ctx, x, y, s); break;
    case 'cave': cave(ctx, x, y, s, k, t); break;
    case 'spring': spring(ctx, x, y, s, k, t); break;
    case 'goats': goats(ctx, x, y, s, t); break;
    case 'ruins': ruins(ctx, x, y, s, t); break;
    case 'milestone': milestone(ctx, x, y, s); break;
    case 'pebbles': pebbles(ctx, x, y, s, t); break;
    case 'philistines': philistines(ctx, x, y, s, run); break;
  }
}

/** Landmarks drawn flat on the ground (under the figures, not sorted with them). */
export const FLAT: ReadonlySet<Landmark> = new Set<Landmark>(['vines', 'barley', 'lentils', 'pebbles', 'spring']);

/**
 * A piece of a barrier between two areas, one u long, at (x, y): a dry-stone wall, a thorn hedge or a rocky ridge.
 * `seed` varies it piece by piece.
 */
export function paintBarrier(ctx: CanvasRenderingContext2D, kind: Barrier, x: number, y: number, s: number, seed: number): void {
  const k = hash(seed);
  if (kind === 'wall') {
    ellipse(ctx, x, y + s * 0.1, s * 0.5, s * 0.16, 'rgba(60,50,30,.18)');
    for (let r = 0; r < 3; r++) {
      const o = (r % 2) * 0.25;
      for (let i = 0; i < 2; i++) {
        const kk = hash(seed * 3 + r * 7 + i);
        ellipse(ctx, x + (i - 0.5 + o) * s * 0.42, y - r * s * 0.2, s * (0.24 + kk * 0.04), s * 0.13, kk < 0.5 ? C.limeShade : '#d6ccb5');
        ellipse(ctx, x + (i - 0.5 + o) * s * 0.42 - s * 0.05, y - r * s * 0.2 - s * 0.05, s * 0.11, s * 0.05, '#ece3cf');
      }
    }
  } else if (kind === 'hedge') {
    for (let i = 0; i < 3; i++) ellipse(ctx, x + (i - 1) * s * 0.3, y - s * (0.35 + (i % 2) * 0.18 + k * 0.1), s * 0.42, s * 0.38, (i + seed) % 2 ? '#5d6a38' : '#4b5830');
    ctx.strokeStyle = '#6e5232';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = hash(seed * 5 + i) * TAU, bx = x + (hash(seed + i * 9) - 0.5) * s * 0.8, by = y - s * (0.3 + hash(seed * 2 + i) * 0.5);
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(a) * s * 0.2, by + Math.sin(a) * s * 0.14);
    }
    ctx.stroke();
  } else {
    // a ridge: rocks of every size, a little off the line, some with a tuft of grass
    const r = 0.4 + k * 0.5, k2 = hash(seed * 7 + 3);
    paintDeco(ctx, { kind: 'rock', x: 0, y: 0, r, seed }, x + (k2 - 0.5) * s * 0.9, y, s, 0);
    if (k2 > 0.55) paintDeco(ctx, { kind: 'rock', x: 0, y: 0, r: r * 0.55, seed: seed + 1 }, x + (0.5 - k2) * s * 1.1, y + s * 0.25, s, 0);
    if (k > 0.7) paintDeco(ctx, { kind: 'bush', x: 0, y: 0, r: 0.4, seed }, x + (k2 - 0.5) * s * 0.4 + s * 0.4, y + s * 0.1, s, 0);
  }
}

/** The pass while it is closed: a wooden gate in a wall, a tangle of thorns in a hedge, fallen rocks on a ridge. */
export function paintPassShut(ctx: CanvasRenderingContext2D, kind: Barrier, x: number, y: number, s: number): void {
  if (kind === 'wall') {
    ctx.strokeStyle = '#7a5a34';
    ctx.lineWidth = Math.max(2, s * 0.1);
    for (const dy of [-1.6, 0, 1.6]) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * s - s * 0.7);
      ctx.lineTo(x, y + dy * s + s * 0.1);
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(2, s * 0.08);
    for (const h of [0.25, 0.55]) {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.08, y - 2 * s - h * s + s * 0.6);
      ctx.lineTo(x + s * 0.08, y + 2 * s - h * s - s * 0.2);
      ctx.stroke();
    }
  } else if (kind === 'hedge') {
    for (let i = 0; i < 5; i++) paintBarrier(ctx, 'hedge', x, y + (i - 2) * s * 0.9, s, 900 + i);
  } else {
    for (let i = 0; i < 4; i++) paintBarrier(ctx, 'ridge', x + (hash(i) - 0.5) * s * 0.6, y + (i - 1.5) * s * 1.1, s, 700 + i);
  }
}

/** The open pass the chain leads to: a warm glow in the gap. */
export function paintPassGlow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y - s * 0.4, s * 2.6, 'rgba(255,220,140,', 0.3 + 0.12 * Math.sin(t * 3));
  ctx.restore();
}

/** A dusty track along a polyline (screen points), under everything. */
export function paintPath(ctx: CanvasRenderingContext2D, pts: readonly { x: number; y: number }[], s: number, dust: string): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = dust;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = s * 1.15;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = 'rgba(255,250,235,1)';
  ctx.lineWidth = s * 0.45;
  ctx.stroke();
  ctx.restore();
}

/** What a quest finds, rescues or carries, drawn where it lies (a glint marks a thing to find). */
export type Thing = 'lamb' | 'jar' | 'stone' | 'rope' | 'arrow' | 'water' | 'kid' | 'ewe' | 'flock' | 'bread' | 'corner' | 'donkey' | 'families';

export function paintThing(ctx: CanvasRenderingContext2D, kind: Thing, x: number, y: number, s: number, t: number, glint = true): void {
  if (glint) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, y - s * 0.3, s * 1.1, 'rgba(255,236,170,', 0.22 + 0.12 * Math.sin(t * 4));
    ctx.restore();
  }
  switch (kind) {
    case 'lamb': {
      const hop = Math.abs(Math.sin(t * 3)) * s * 0.05;
      shadow(ctx, x, y, s * 0.25, 0.2);
      for (let i = 0; i < 5; i++) ellipse(ctx, x + Math.cos(i * 1.3) * s * 0.12, y - s * 0.22 - hop + Math.sin(i * 1.3) * s * 0.06, s * 0.13, s * 0.11, i % 2 ? C.woolShade : C.wool);
      ellipse(ctx, x + s * 0.18, y - s * 0.26 - hop, s * 0.07, s * 0.08, '#2b2420');
      break;
    }
    case 'ewe': paintSheep(ctx, x, y, s * 1.1, t); paintThing(ctx, 'lamb', x + s * 0.5, y + s * 0.15, s, t, false); break;
    case 'flock': for (let i = 0; i < 5; i++) paintSheep(ctx, x + (i - 2) * s * 0.55, y + ((i * 3) % 2) * s * 0.3, s, t + i); break;
    case 'kid': paintAnimal(ctx, 'goat', x, y, s * 0.8, { flip: Math.sin(t) > 0 ? 1 : -1, step: 0, moving: 0, t }); break;
    case 'donkey': paintAnimal(ctx, 'donkey', x, y, s, { flip: 1, step: t * 10, moving: 0, t }); break;
    case 'jar':
      shadow(ctx, x, y, s * 0.2, 0.2);
      ellipse(ctx, x, y - s * 0.25, s * 0.18, s * 0.25, '#b8743c');
      ellipse(ctx, x, y - s * 0.48, s * 0.09, s * 0.05, '#8f5428');
      ellipse(ctx, x - s * 0.06, y - s * 0.3, s * 0.04, s * 0.1, 'rgba(255,220,180,.4)');
      break;
    case 'bread':
      ellipse(ctx, x, y - s * 0.12, s * 0.34, s * 0.16, '#a07a48');
      for (let i = 0; i < 3; i++) ellipse(ctx, x + (i - 1) * s * 0.16, y - s * 0.24, s * 0.12, s * 0.08, i === 1 ? '#f2e6c6' : '#d9a85a');
      break;
    case 'stone':
      ellipse(ctx, x, y - s * 0.06, s * 0.17, s * 0.11, '#f4efe4');
      ellipse(ctx, x - s * 0.05, y - s * 0.1, s * 0.05, s * 0.03, '#ffffff');
      break;
    case 'rope':
      ctx.strokeStyle = '#b08c54';
      ctx.lineWidth = Math.max(1.5, s * 0.07);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x, y - s * 0.08 - i * s * 0.05, s * (0.3 - i * 0.06), s * (0.13 - i * 0.02), 0, 0, TAU);
        ctx.stroke();
      }
      break;
    case 'arrow':
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = Math.max(1.5, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + s * 0.2, y - s * 0.7);
      ctx.stroke();
      ctx.fillStyle = '#e7d3a1';
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y - s * 0.7);
      ctx.lineTo(x + s * 0.1, y - s * 0.9);
      ctx.lineTo(x + s * 0.32, y - s * 0.82);
      ctx.fill();
      break;
    case 'water':
      ellipse(ctx, x, y, s * 0.45, s * 0.18, '#7fb6d4');
      ellipse(ctx, x + s * 0.32, y - s * 0.22, s * 0.2, s * 0.14, '#8a5a34');
      break;
    case 'corner':
      ctx.fillStyle = '#7a3a5a';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.2, y);
      ctx.lineTo(x + s * 0.25, y - s * 0.1);
      ctx.lineTo(x, y - s * 0.4);
      ctx.fill();
      break;
    case 'families': break;   // drawn as people by the view
  }
}
