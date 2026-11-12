/**
 * Rozświetl's eight places, each painted in two states with one composition — the dark one the mosaic
 * shows, the bright one under it — so the light uncovers the same place transformed (DESIGN §13.7):
 *
 *   samotnosc  a lone hunched figure on a bench under a street lamp in the rain, the windows dark
 *              → the same bench in a sunny park with friends, a picnic, a kite, the windows lit
 *   smutek     a figure curled on a bed in a grey room under a dark cloud, the curtains closed
 *              → the window open, sunlight pouring in, the figure standing with arms open, flowers
 *   dlugi      a kitchen table piled with red-stamped letters under a dim bulb, the shelves empty
 *              → a shared meal, a jar of savings, a folder stamped ✓, full shelves, the family
 *   lek        a figure clinging to a narrow cliff path in fog
 *              → the same path in a clear morning, the figure standing tall at the top
 *   choroba    a pale figure in bed, the curtains drawn
 *              → the curtains open, the door open on a garden, the figure walking out into it
 *   burza      a small boat in black waves under lightning
 *              → the same boat on a calm sea at sunrise
 *   kajdany    a figure chained in a stone cell
 *              → the door open, the chains broken, the figure walking out into a field
 *   zmeczenie  a figure slumped at a desk at two in the morning, a dead plant
 *              → dawn: the plant in bloom, the figure running by the river outside the window
 *
 * Painted once per picture size into an offscreen canvas (render.ts); any aspect from 3:4 to 2:1.
 */
import {
  BRIGHT, DARK, TAU, bars, bed, bench, birds, blanket, boat, chain, chair, clockFace, cloud, darkCloud, door, ell, envelope, figure, finish,
  flowers, fog, glow, grass, ground, hero, hills, house, jar, lightning, line, makeStage, mix, picnic, plant, poly, rain, rays, rect,
  rgba, sea, shelf, sky, stars, streetLamp, sun, table, tree, vgrad, windowFrame, X, Y, type Stage,
} from './scenekit';

export type PairId = 'samotnosc' | 'smutek' | 'dlugi' | 'lek' | 'choroba' | 'burza' | 'kajdany' | 'zmeczenie';

export const PAIR_IDS: readonly PairId[] = ['samotnosc', 'smutek', 'dlugi', 'lek', 'choroba', 'burza', 'kajdany', 'zmeczenie'];

const SEEDS: Record<PairId, number> = { samotnosc: 11, smutek: 23, dlugi: 37, lek: 41, choroba: 53, burza: 67, kajdany: 71, zmeczenie: 89 };

/** Paint a place in one of its two states over the whole w × h canvas. */
export function paintScene(ctx: CanvasRenderingContext2D, w: number, h: number, id: PairId, bright: boolean): void {
  if (w < 2 || h < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const s = makeStage(ctx, w, h, SEEDS[id] * 7919 + (bright ? 1 : 0), bright, GROUND[id]);
  PAINTERS[id](s);
  finish(s, bright ? 0.16 : 0.42, bright);
  ctx.restore();
}

/** Where each place's ground line sits (units under the centre). */
const GROUND: Record<PairId, number> = { samotnosc: 20, smutek: 25, dlugi: 24, lek: 28, choroba: 27, burza: -2, kajdany: 24, zmeczenie: 24 };

const PAINTERS: Record<PairId, (s: Stage) => void> = {
  samotnosc: paintSamotnosc, smutek: paintSmutek, dlugi: paintDlugi, lek: paintLek,
  choroba: paintChoroba, burza: paintBurza, kajdany: paintKajdany, zmeczenie: paintZmeczenie,
};

// ── Samotność → Wspólnota ───────────────────────────────────────

function paintSamotnosc(s: Stage): void {
  const { ctx, w, u, gy, bright } = s;
  if (bright) {
    sky(s, gy, ['#7cc6f2', '#bfe6ff', '#ffe6b4'], '#ffffff', 0.1);
    sun(s, X(s, 38), gy - 62 * u, 5 * u, 1);
    cloud(s, X(s, -34), gy - 58 * u, 4.5);
    cloud(s, X(s, 18), gy - 66 * u, 3.4, '#ffffff', 0.8);
    birds(s, X(s, -10), gy - 70 * u, 4, 1.3, '#5b6b80');
  } else {
    sky(s, gy, ['#0d111c', '#1b2232', '#2a3244'], '#8696b0', 0.05);
    stars(s, gy - 40 * u, 10, 0.25);
  }
  // the houses across the back, windows dark — or lit and alive
  const walls = bright ? ['#f2c79a', '#e9a989', '#f6dcae', '#d9b38c', '#efc6b0'] : ['#2a303e', '#262c39', '#2f3644', '#242a36', '#2c3240'];
  const roofs = bright ? ['#c0613f', '#a8573d', '#b8694a'] : ['#1c2029', '#20242e', '#1a1e27'];
  const hw = 22 * u;
  const n = Math.ceil(w / hw) + 1;
  const x0 = s.cx - Math.ceil(n / 2) * hw;
  for (let i = 0; i < n; i++) {
    const hh = (24 + ((i * 7) % 5) * 3) * u;
    house(s, x0 + i * hw + u, gy - 12 * u, hw - 2 * u, hh, walls[i % walls.length], roofs[i % roofs.length],
      bright ? '#7aa7c7' : '#1a202b', bright ? '#ffd98a' : '#8a7a4a', bright ? 0.75 : 0.06, 3, 3);
  }
  // the park: a lawn, a path, the lamp, the bench
  ground(s, gy - 12 * u, bright ? ['#9edb74', '#7cc95e', '#5aa64a'] : ['#1d2622', '#18201c', '#121814']);
  hills(s, gy - 10 * u, 3, bright ? '#86cf68' : '#1a221e', 0.4, 3);
  poly(ctx, [[X(s, -60), gy + 30 * u], [X(s, 60), gy + 30 * u], [X(s, 30), gy - 2 * u], [X(s, -30), gy - 2 * u]], bright ? '#e9d2a8' : '#262b33');
  if (!bright) {
    // puddles on the path holding the lamp's light
    for (const [dx, dy, r] of [[-22, 12, 6], [14, 18, 8], [30, 8, 4]] as const) {
      ell(ctx, X(s, dx), Y(s, dy), r * u, r * u * 0.16, '#333c4c');
      ell(ctx, X(s, dx) + u, Y(s, dy) - u * 0.2, r * u * 0.5, r * u * 0.06, rgba(DARK.lamp, 0.3));
    }
  } else {
    flowers(s, 0, w, gy - 10 * u, gy - 2 * u, 26, ['#ff8fa8', '#fff4dc', '#bfa2f2', '#ffd25e']);
  }
  tree(s, X(s, 40), gy - 4 * u, 46 * u, bright, bright ? '#7a5236' : '#30343f', BRIGHT.leaf, BRIGHT.leaf2);
  streetLamp(s, X(s, -14), gy + 2 * u, 50 * u, bright ? 0 : 0.9, DARK.lamp, bright ? '#3d4a57' : '#14171e');
  const benchX = X(s, 6), seat = 8.6 * u;
  bench(s, benchX, gy + 2 * u, 34 * u, seat, bright ? BRIGHT.wood : '#45403c', bright ? '#3d4a57' : '#16191f');
  const H = 31 * u;
  if (bright) {
    // the same person, upright now, with a friend beside and others on the grass
    figure(s, benchX - 7 * u, gy + 2 * u, H, 'sit', hero(true, 0, 1), 1);
    figure(s, benchX + 9 * u, gy + 2 * u, H, 'sitWave', hero(true, 1, 1), -1);
    picnic(s, X(s, -2), Y(s, 22), 40 * u, '#ff8a6b', '#fff4dc');
    figure(s, X(s, -12), Y(s, 19), H * 0.95, 'sitGround', hero(true, 2, 1), 1);
    figure(s, X(s, 10), Y(s, 19), H * 0.95, 'sitGround', hero(true, 3, 1), -1);
    ell(ctx, X(s, -1), Y(s, 15), 3.2 * u, 1.6 * u, '#c98a4a');
    ell(ctx, X(s, -1), Y(s, 14), 2.6 * u, 0.9 * u, '#ffd25e');
    // a child with a kite
    figure(s, X(s, -40), Y(s, 10), H * 0.62, 'armsOpen', hero(true, 4, 1), 1, 1.25);
    line(ctx, X(s, -38), Y(s, -9), X(s, -26), gy - 52 * u, rgba('#ffffff', 0.7), Math.max(1, u * 0.25));
    poly(ctx, [[X(s, -26), gy - 58 * u], [X(s, -22), gy - 52 * u], [X(s, -26), gy - 46 * u], [X(s, -30), gy - 52 * u]], '#ff8a6b');
    glow(ctx, X(s, 4), gy - 6 * u, 40 * u, '#ffd98a', 0.18);
  } else {
    // alone under the lamp, the light on the bowed back
    figure(s, benchX - 4 * u, gy + 2 * u, H * 1.06, 'sitHunch', { ...hero(false, 0, -1), rimColor: '#e8d39a' }, 1);
    glow(ctx, benchX - 2 * u, gy - 12 * u, 16 * u, DARK.lamp, 0.12);
    rain(s, 0, 0, w, s.h, Math.round(w * s.h / (u * u) * 0.09));
    fog(s, gy - 14 * u, gy + 4 * u, DARK.fog, 0.18, 3);
  }
}

// ── Smutek → Radość ─────────────────────────────────────────────

function paintSmutek(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  // the room: a back wall, a floor in perspective
  rect(ctx, 0, 0, w, gy, vgrad(ctx, 0, gy, bright ? ['#f9e8c8', '#f3d6a8'] : ['#2b303c', '#252a35']));
  rect(ctx, 0, gy - 1, w, h - gy + 1, vgrad(ctx, gy, h, bright ? ['#d9a874', '#b8804c'] : ['#22262f', '#191c23']));
  for (let i = -8; i <= 8; i++) line(ctx, s.cx + i * 6 * u, gy, s.cx + i * 14 * u, h, rgba('#000000', bright ? 0.08 : 0.18), Math.max(1, u * 0.2));
  rect(ctx, 0, gy - 1.5 * u, w, 1.5 * u, bright ? '#c48a58' : '#1d2028');
  // the window (left of the centre)
  const wx = X(s, -40), wy = gy - 62 * u, ww = 24 * u, wh = 30 * u;
  const outside = vgrad(ctx, wy, wy + wh, bright ? ['#7cc6f2', '#cdeeff'] : ['#3a4252', '#2f3644']);
  windowFrame(s, wx, wy, ww, wh, outside, bright ? '#fff4dc' : '#3a3f4b', bright ? '#ff9f8a' : '#3b4252', bright ? 0 : 1);
  if (bright) {
    tree(s, wx + ww * 0.75, wy + wh, 16 * u, true, '#7a5236', BRIGHT.leaf, BRIGHT.leaf2);
    sun(s, wx + ww * 0.25, wy + wh * 0.25, 2.4 * u, 0);
    // sunlight pouring through onto the floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(wx, wy, wx + 40 * u, gy + 20 * u);
    g.addColorStop(0, 'rgba(255,226,150,.38)');
    g.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + ww, wy);
    ctx.lineTo(wx + ww + 52 * u, gy + 26 * u);
    ctx.lineTo(wx + 22 * u, gy + 26 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    rays(s, wx + ww / 2, wy + wh / 2, 70 * u, 0.55, 0.5, 7, '#ffe6a8', 0.16);
  }
  // a picture frame on the wall
  rect(ctx, X(s, 18), gy - 58 * u, 14 * u, 10 * u, bright ? '#c48a58' : '#2f3440');
  rect(ctx, X(s, 19), gy - 57 * u, 12 * u, 8 * u, bright ? '#9fd0b0' : '#363c48');
  if (bright) poly(ctx, [[X(s, 19), gy - 49 * u], [X(s, 24), gy - 55 * u], [X(s, 28), gy - 51 * u], [X(s, 31), gy - 53 * u], [X(s, 31), gy - 49 * u]], '#5aa64a');
  // the bed
  const bx = X(s, 8), bw = 54 * u;
  const { top } = bed(s, bx, gy + 10 * u, bw, bright ? '#b9784a' : '#2f2b2a', bright ? '#fff4dc' : '#4a5163', bright ? '#ff8a6b' : '#3c4558', 1);
  // the nightstand with a vase
  rect(ctx, X(s, 38), gy - 6 * u, 10 * u, 16 * u, bright ? '#b9784a' : '#2c2827');
  rect(ctx, X(s, 37), gy - 7 * u, 12 * u, 1.6 * u, bright ? '#8f5634' : '#24201f');
  plant(s, X(s, 43), gy - 7 * u, 13 * u, bright ? 1 : 0, bright ? '#3fb7a8' : '#404858');
  const H = 31 * u;
  if (bright) {
    blanket(s, bx - bw * 0.46, bx + bw * 0.46, top, 2 * u, '#ff8a6b');
    // the same person, up, arms open in the sun
    figure(s, X(s, -14), gy + 14 * u, H * 1.05, 'armsOpen', hero(true, 1, -1), 1);
    glow(ctx, X(s, -14), gy - 10 * u, 34 * u, '#ffe6a8', 0.2);
    birds(s, wx + ww * 0.5, wy + wh * 0.4, 2, 0.9, '#4a5b70');
  } else {
    blanket(s, bx - bw * 0.46, bx + bw * 0.46, top, 1.4 * u, '#3c4558');
    figure(s, bx - 4 * u, top + 2.2 * u, H * 1.4, 'curl', { ...hero(false, 1, -1), rimColor: '#8f9bb3' }, 1);
    // the cloud indoors, low over the bed, its rain falling on the blanket
    glow(ctx, bx + 2 * u, top - 30 * u, 30 * u, '#4a5468', 0.1);
    darkCloud(s, bx + 2 * u, top - 30 * u, 7.5, '#4a5163', 0.95);
    darkCloud(s, bx + 4 * u, top - 28 * u, 5.5, '#3b4252', 0.9);
    rain(s, bx - 16 * u, top - 24 * u, 36 * u, 22 * u, 40, '#9aa8bf', 0.42, 0.06);
    glow(ctx, wx + ww / 2, wy + wh / 2, 24 * u, '#5d6a80', 0.12);
  }
}

// ── Długi → Dostatek ────────────────────────────────────────────

function paintDlugi(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  rect(ctx, 0, 0, w, gy, vgrad(ctx, 0, gy, bright ? ['#fbe7c2', '#f2cf9c'] : ['#262a33', '#20232b']));
  // tiles on the kitchen wall
  for (let y = gy - 30 * u; y < gy - 4 * u; y += 4 * u) {
    for (let x = (y / (4 * u)) % 2 ? 0 : -2 * u; x < w; x += 4 * u) {
      ctx.strokeStyle = rgba(bright ? '#c99a6a' : '#000000', bright ? 0.25 : 0.25);
      ctx.lineWidth = Math.max(1, u * 0.15);
      ctx.strokeRect(x, y, 4 * u, 4 * u);
    }
  }
  rect(ctx, 0, gy - 1, w, h - gy + 1, vgrad(ctx, gy, h, bright ? ['#c88f5a', '#9c6a3e'] : ['#1f2128', '#16181d']));
  // the window, upper right: night outside, or a morning garden
  const wx = X(s, 22), wy = gy - 66 * u, ww = 20 * u, wh = 22 * u;
  windowFrame(s, wx, wy, ww, wh, vgrad(ctx, wy, wy + wh, bright ? ['#8fd0f6', '#e8f6ff'] : ['#0e121b', '#1a2030']), bright ? '#fff4dc' : '#30343e', null, 0);
  if (bright) {
    tree(s, wx + ww * 0.3, wy + wh, 12 * u, true, '#7a5236', BRIGHT.leaf, BRIGHT.leaf2);
    glow(ctx, wx + ww / 2, wy + wh / 2, 30 * u, '#fff1c0', 0.25);
  } else stars(s, 0, 0, 0);
  // the shelves on the left: empty, or full
  const items = ['#d9534f', '#f0a63c', '#6cc26a', '#bfa2f2', '#3fb7a8', '#ffd25e', '#ff8a6b'];
  shelf(s, X(s, -26), gy - 56 * u, 34 * u, bright ? '#b9784a' : '#34302d', bright ? 1 : 0.15, bright ? items : ['#3d4250']);
  shelf(s, X(s, -26), gy - 42 * u, 34 * u, bright ? '#b9784a' : '#34302d', bright ? 1 : 0, bright ? items.slice(2) : ['#3d4250']);
  // the hanging bulb
  const lx = X(s, 0);
  line(ctx, lx, 0, lx, gy - 50 * u, bright ? '#5b4636' : '#111318', Math.max(1, u * 0.3));
  poly(ctx, [[lx - 3 * u, gy - 48 * u], [lx + 3 * u, gy - 48 * u], [lx + 1.6 * u, gy - 51 * u], [lx - 1.6 * u, gy - 51 * u]], bright ? '#3fb7a8' : '#23262d');
  ell(ctx, lx, gy - 46.5 * u, 1.6 * u, 1.9 * u, bright ? '#fff1c0' : '#a8915a');
  glow(ctx, lx, gy - 46 * u, (bright ? 34 : 22) * u, bright ? '#ffe6a8' : '#9c8650', bright ? 0.32 : 0.3);
  // the table, the chairs
  const tw = 58 * u, H = 34 * u, fy = gy + 12 * u;
  const chairs = bright ? '#8f5634' : '#2f2a28';
  chair(s, X(s, -36), fy, H, chairs, -1);
  if (bright) chair(s, X(s, 37), fy, H, chairs, 1);
  const { top } = table(s, X(s, 2), fy, tw, H * 0.47, bright ? '#b9784a' : '#3a3330');
  if (bright) {
    // the family at a shared meal
    figure(s, X(s, -36), fy, H, 'sitTable', hero(true, 0, 1), 1);
    figure(s, X(s, 37), fy, H, 'sitTable', hero(true, 1, -1), -1);
    figure(s, X(s, 14), fy, H * 0.6, 'wave', hero(true, 4, 1), -1, 1.25);
    // the meal
    ell(ctx, X(s, -10), top - 0.6 * u, 6 * u, 1.6 * u, '#fff4dc');
    ell(ctx, X(s, -10), top - 1.6 * u, 4.4 * u, 1.6 * u, '#f0a63c');
    ell(ctx, X(s, 6), top - 0.6 * u, 6 * u, 1.6 * u, '#fff4dc');
    ell(ctx, X(s, 6), top - 2.2 * u, 4.6 * u, 2.4 * u, '#c9823a');
    for (let i = 0; i < 4; i++) line(ctx, X(s, 3 + i * 2), top - 4 * u, X(s, 4 + i * 2), top - 1.6 * u, '#8f5634', Math.max(1, u * 0.3));
    ell(ctx, X(s, -22), top - 0.8 * u, 3 * u, 1 * u, '#ff8a6b');
    // a jar of savings and a folder stamped ✓
    jar(s, X(s, 22), top, 9 * u, 0.85, '#3fb7a8');
    rect(ctx, X(s, -27), top - 1.6 * u, 10 * u, 1.6 * u, '#7fb4e0');
    ctx.strokeStyle = '#2f9a58';
    ctx.lineWidth = Math.max(1, u * 0.45);
    ell(ctx, X(s, -22), top - 6 * u, 3.6 * u, 3.6 * u, rgba('#2f9a58', 0.18));
    ctx.beginPath();
    ctx.arc(X(s, -22), top - 6 * u, 3.6 * u, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(s, -23.8), top - 6 * u);
    ctx.lineTo(X(s, -22.4), top - 4.6 * u);
    ctx.lineTo(X(s, -19.8), top - 7.6 * u);
    ctx.stroke();
    plant(s, X(s, -40), gy - 42 * u, 9 * u, 1, '#ff8a6b');
  } else {
    // one person, head down at the table, under the dim bulb, the letters piling up
    figure(s, X(s, -36), fy, H, 'slumpDesk', { ...hero(false, 0, 1), rimColor: '#c9b47a' }, 1);
    const paper = '#c9c4b8';
    for (let i = 0; i < 14; i++) {
      const ex = X(s, -14 + s.rng() * 36), ey = top - (1 + (i % 5) * 1.6) * u - s.rng() * 2 * u;
      envelope(s, ex, ey, (6 + s.rng() * 3) * u, (s.rng() - 0.5) * 0.7, i % 3 ? mix(paper, '#000000', 0.15) : paper, i % 2 ? '#a83a32' : null);
    }
    envelope(s, X(s, 8), top + 14 * u, 7 * u, 0.4, mix(paper, '#000000', 0.25), '#a83a32');
    envelope(s, X(s, 30), top + 16 * u, 6 * u, -0.6, mix(paper, '#000000', 0.3), null);
  }
}

// ── Lęk → Odwaga ────────────────────────────────────────────────

function paintLek(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  // the sky and the far side of the gorge
  if (bright) {
    sky(s, h, ['#8fd0f6', '#d6f0ff', '#fff0cf'], '#ffffff', 0.08);
    sun(s, X(s, -30), gy - 70 * u, 4.5 * u, 0);
    hills(s, gy - 30 * u, 16, '#a9c9de', 0.5, 1.4);
    hills(s, gy - 16 * u, 12, '#8fbf96', 1.6, 2.2);
    hills(s, gy - 2 * u, 9, '#76b06e', 2.6, 2.6);
    // a river in the valley far below
    ctx.strokeStyle = '#8fd6f0';
    ctx.lineWidth = 1.6 * u;
    ctx.beginPath();
    ctx.moveTo(0, gy + 12 * u);
    ctx.bezierCurveTo(X(s, -40), gy + 4 * u, X(s, -20), gy + 18 * u, X(s, 0), gy + 10 * u);
    ctx.stroke();
    cloud(s, X(s, -8), gy - 62 * u, 3.2, '#ffffff', 0.85);
    birds(s, X(s, -26), gy - 46 * u, 3, 1.1, '#4a5b70');
  } else {
    sky(s, h, ['#141924', '#232a38', '#343d4f'], '#8696b0', 0.06);
    hills(s, gy - 26 * u, 16, '#29313e', 0.5, 1.4);
    hills(s, gy - 12 * u, 12, '#222935', 1.6, 2.2);
  }
  // the rock: a steep face rising to a summit on the right
  const rock = bright ? '#b48f73' : '#2c313b', rockLight = bright ? '#d6b08e' : '#3a404c', rockDark = bright ? '#8a6a52' : '#1c2028';
  const top = gy - 38 * u;
  const face: [number, number][] = [[X(s, -2), h + 2], [X(s, -6), gy + 14 * u], [X(s, 2), gy + 2 * u], [X(s, 8), gy - 12 * u], [X(s, 13), gy - 26 * u], [X(s, 20), top]];
  poly(ctx, [...face, [w + 2, top - 3 * u], [w + 2, h + 2]], rock);
  // strata and cracks in the rock
  for (let i = 0; i < 12; i++) {
    const yy = top + (i + 0.5) * 6 * u, x0 = X(s, 14 + (i % 4) * 3 + i * 0.8);
    line(ctx, x0, yy, x0 + (14 + (i % 3) * 7) * u, yy - 2.4 * u, rockDark, Math.max(1, u * 0.45));
    if (i % 3 === 0) line(ctx, x0 + 6 * u, yy, x0 + 4 * u, yy + 5 * u, rockDark, Math.max(1, u * 0.35));
  }
  poly(ctx, [[X(s, 20), top], [X(s, 28), top - 1 * u], [X(s, 22), top + 9 * u], [X(s, 15), top + 14 * u]], rockLight);
  // the ledge: a narrow shelf cut into the face, climbing from the lower left to the summit
  const ledge: [number, number][] = [[-50, 22], [-30, 17], [-14, 13], [-3, 9], [4, -3], [9, -15], [14, -27], [20, -38]];
  const path = new Path2D();
  ledge.forEach(([dx, dy], i) => (i ? path.lineTo(X(s, dx), Y(s, dy)) : path.moveTo(X(s, dx), Y(s, dy))));
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rockDark;
  ctx.lineWidth = 4.6 * u;
  ctx.save();
  ctx.translate(0, 1.6 * u);
  ctx.stroke(path);
  ctx.restore();
  ctx.strokeStyle = bright ? '#ead0aa' : '#4a5160';
  ctx.lineWidth = 3.2 * u;
  ctx.stroke(path);
  // the drop on the left of the ledge's start
  poly(ctx, [[0, h + 2], [0, Y(s, 24)], [X(s, -50), Y(s, 24)], [X(s, -30), Y(s, 19)], [X(s, -14), Y(s, 15)], [X(s, -4), Y(s, 12)], [X(s, -6), h + 2]], bright ? '#9b7a5e' : '#1b1f27');
  const H = 26 * u;
  if (bright) {
    // the summit: grass, a small tree, the same person standing tall in the morning
    poly(ctx, [[X(s, 16), top + 2 * u], [X(s, 20), top - 2 * u], [w + 2, top - 5 * u], [w + 2, top + 4 * u]], '#7cc95e');
    grass(s, X(s, 18), w, top - 1 * u, 3 * u, '#5aa64a', 40);
    flowers(s, X(s, 22), w, top - 3 * u, top + 1 * u, 8, ['#fff4dc', '#ffd25e', '#ff8fa8']);
    tree(s, X(s, 44), top - 2 * u, 24 * u, true, '#7a5236', BRIGHT.leaf, BRIGHT.leaf2);
    glow(ctx, X(s, 28), top - 14 * u, 30 * u, '#fff1c0', 0.3);
    figure(s, X(s, 28), top - 1 * u, H * 1.05, 'standTall', hero(true, 2, -1), -1);
    rays(s, X(s, -30), gy - 70 * u, 120 * u, 0.5, 0.8, 8, '#fff1c0', 0.1);
    for (let i = 0; i < 6; i++) ell(ctx, X(s, 14 + i * 4), Y(s, -30 + i * 7), 1.6 * u, 1 * u, '#6aa85a');
  } else {
    // halfway up, pressed to the rock, the fog rising out of the gorge and hiding the top
    fog(s, gy - 20 * u, h, DARK.fog, 0.4, 7);
    figure(s, X(s, 5), Y(s, -5), H, 'cling', { ...hero(false, 2, 1), rimColor: '#8f9bb3' }, 1);
    fog(s, top - 30 * u, top + 16 * u, '#6c7488', 0.5, 5);
    fog(s, gy + 6 * u, h, '#5c6478', 0.4, 4);
  }
}

// ── Choroba → Zdrowie ───────────────────────────────────────────

function paintChoroba(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  rect(ctx, 0, 0, w, gy, vgrad(ctx, 0, gy, bright ? ['#f6efd8', '#ecdcb6'] : ['#272b33', '#22252d']));
  rect(ctx, 0, gy - 1, w, h - gy + 1, vgrad(ctx, gy, h, bright ? ['#c9a06e', '#a77d4c'] : ['#1f2128', '#16181d']));
  for (let i = -8; i <= 8; i++) line(ctx, s.cx + i * 7 * u, gy, s.cx + i * 15 * u, h, rgba('#000000', bright ? 0.07 : 0.18), Math.max(1, u * 0.2));
  // the window on the left, the curtains drawn — or open on the morning
  const wx = X(s, -46), wy = gy - 60 * u, ww = 20 * u, wh = 28 * u;
  windowFrame(s, wx, wy, ww, wh, vgrad(ctx, wy, wy + wh, bright ? ['#8fd0f6', '#e8f6ff'] : ['#3b3f49', '#2c3039']), bright ? '#fff4dc' : '#34373f', bright ? '#9fd0b0' : '#4a4140', bright ? 0 : 1);
  if (bright) glow(ctx, wx + ww / 2, wy + wh / 2, 26 * u, '#fff1c0', 0.25);
  // the door on the right: closed — or open on a garden in the sun
  const dx = X(s, 24), dw = 18 * u, dh = 40 * u;
  const garden = vgrad(ctx, gy - dh, gy, bright ? ['#9fd8ff', '#e8f6ff', '#9edb74', '#6cc26a'] : ['#1a1d24', '#1a1d24']);
  door(s, dx, gy, dw, dh, bright ? 1 : 0, garden, bright ? '#b9784a' : '#3a3330', bright ? '#fff4dc' : '#2c2c30');
  if (bright) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, gy - dh, dw, dh);
    ctx.clip();
    sun(s, dx + dw * 0.7, gy - dh * 0.8, 2 * u, 0);
    tree(s, dx + dw * 0.2, gy - dh * 0.3, 14 * u, true, '#7a5236', BRIGHT.leaf, BRIGHT.leaf2);
    flowers(s, dx, dx + dw, gy - dh * 0.32, gy, 14, ['#ff8fa8', '#ffd25e', '#fff4dc', '#bfa2f2']);
    ctx.restore();
    // the light from the garden across the floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(dx, gy, dx - 30 * u, h);
    g.addColorStop(0, 'rgba(255,230,160,.35)');
    g.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(dx, gy);
    ctx.lineTo(dx + dw, gy);
    ctx.lineTo(dx + dw - 10 * u, h);
    ctx.lineTo(dx - 40 * u, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // the bed (head to the left), the nightstand
  const bx = X(s, -12), bw = 60 * u;
  const { top } = bed(s, bx, gy + 12 * u, bw, bright ? '#b9784a' : '#3a3432', bright ? '#fff4dc' : '#6b7180', bright ? '#9fd0b0' : '#454c5c', -1);
  rect(ctx, X(s, -50), gy - 4 * u, 9 * u, 16 * u, bright ? '#b9784a' : '#2c2827');
  const H = 31 * u;
  if (bright) {
    // the bed made, flowers by it, the person walking out into the garden
    blanket(s, bx - bw * 0.46, bx + bw * 0.46, top, 1.2 * u, '#9fd0b0');
    plant(s, X(s, -45.5), gy - 4 * u, 11 * u, 1, '#ff8a6b');
    figure(s, dx + dw * 0.55, gy + 1 * u, H * 0.95, 'walk', hero(true, 3, 1), 1);
    glow(ctx, dx + dw / 2, gy - dh / 2, 30 * u, '#fff1c0', 0.3);
  } else {
    // a pale figure in bed: the head on the pillow, the blanket up to the chin, an arm over it
    const hx = bx - bw * 0.36, hy = top - 1.8 * u;
    ell(ctx, hx, hy, 3.1 * u, 2.9 * u, '#8f8884', 0.2);
    ctx.fillStyle = '#2f2b2a';
    ctx.beginPath();
    ctx.ellipse(hx - 0.6 * u, hy - 0.4 * u, 3.4 * u, 3.1 * u, 0.2, Math.PI * 0.75, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    blanket(s, bx - bw * 0.31, bx + bw * 0.46, top, 4 * u, '#4f5668');
    // a glass of water and a small lamp on the nightstand
    rect(ctx, X(s, -49), gy - 9 * u, 2.4 * u, 5 * u, rgba('#c8d6e6', 0.4));
    rect(ctx, X(s, -45), gy - 11 * u, 3 * u, 7 * u, '#5a5550');
    poly(ctx, [[X(s, -47), gy - 11 * u], [X(s, -41), gy - 11 * u], [X(s, -42.5), gy - 15 * u], [X(s, -45.5), gy - 15 * u]], '#6e6a62');
    glow(ctx, X(s, -44), gy - 12 * u, 18 * u, '#9c8650', 0.3);
  }
}

// ── Burza → Pokój ───────────────────────────────────────────────

function paintBurza(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  const horizon = gy;
  if (bright) {
    sky(s, horizon, ['#6fb3e6', '#bfe1f5', '#ffd9a8', '#ffb98a'], '#ffffff', 0.08);
    sun(s, X(s, 18), horizon - 4 * u, 6 * u, 1);
    rays(s, X(s, 18), horizon - 4 * u, 110 * u, -Math.PI / 2, 2.6, 13, '#ffe6a8', 0.1);
    cloud(s, X(s, -36), horizon - 40 * u, 3.6, '#fff1e0', 0.7);
    cloud(s, X(s, 40), horizon - 52 * u, 2.8, '#fff1e0', 0.6);
    birds(s, X(s, -18), horizon - 30 * u, 3, 1.2, '#5b6b80');
    sea(s, horizon, '#2f86b0', '#ffc79a', '#fff4dc', 0.08);
    // the sun's path on the water
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const yy = horizon + (i + 0.5) * (h - horizon) / 18, half = (3 + i * 1.6) * u;
      ell(ctx, X(s, 18) + (s.rng() - 0.5) * half, yy, half * (0.4 + s.rng() * 0.5), u * 0.4, rgba('#ffe6a8', 0.35 - i * 0.012));
    }
    ctx.restore();
  } else {
    sky(s, horizon, ['#07090f', '#121826', '#1e2636'], '#8696b0', 0.05);
    darkCloud(s, X(s, -30), horizon - 56 * u, 9, '#151a25', 0.95);
    darkCloud(s, X(s, 26), horizon - 62 * u, 11, '#121722', 0.95);
    darkCloud(s, X(s, 0), horizon - 44 * u, 7, '#1b2130', 0.9);
    lightning(s, X(s, 30), horizon - 52 * u, 46 * u);
    sea(s, horizon, '#05080d', '#1a2433', '#5c6c82', 1);
    // tall dark swells
    for (const [dx, r] of [[-30, 22], [40, 26]] as const) {
      ctx.fillStyle = '#0b1018';
      ctx.beginPath();
      ctx.moveTo(X(s, dx - r), horizon + 30 * u);
      ctx.quadraticCurveTo(X(s, dx), horizon - 6 * u, X(s, dx + r), horizon + 30 * u);
      ctx.closePath();
      ctx.fill();
      line(ctx, X(s, dx - r * 0.5), horizon + 6 * u, X(s, dx + r * 0.3), horizon + 2 * u, rgba('#7d8fa8', 0.45), Math.max(1, u * 0.6));
    }
  }
  // the boat, tossed on a crest — or still on the calm
  const bx = X(s, -6), by = horizon + (bright ? 16 : 10) * u;
  const tilt = bright ? 0 : -0.3;
  if (bright) ell(ctx, bx, by + 3 * u, 26 * u, 1.8 * u, rgba('#1c4a66', 0.35));
  else {
    // the wave lifting it
    ctx.fillStyle = '#0d131d';
    ctx.beginPath();
    ctx.moveTo(X(s, -50), h + 2);
    ctx.quadraticCurveTo(X(s, -30), by - 2 * u, bx, by + 1 * u);
    ctx.quadraticCurveTo(X(s, 18), by + 4 * u, X(s, 30), h + 2);
    ctx.closePath();
    ctx.fill();
    line(ctx, X(s, -26), by + 6 * u, bx - 6 * u, by + 1.6 * u, rgba('#8fa1bb', 0.5), Math.max(1, u * 0.7));
  }
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(tilt);
  // the person in the boat: crouched against the storm, or sitting at peace facing the sunrise
  figure(s, bright ? -12 * u : -5 * u, bright ? 1 * u : -3 * u, 24 * u, bright ? 'sitWave' : 'knees', { ...hero(bright, 5, bright ? 1 : -1), rimColor: bright ? '#fff0c8' : '#b7c4f0' }, 1);
  ctx.restore();
  boat(s, bx, by, 42 * u, tilt, bright ? '#b9784a' : '#3a332e', bright ? '#fff4dc' : '#5a606e', bright ? 1 : 0);
  if (!bright) {
    // spray over the bow, rain across everything
    for (let i = 0; i < 26; i++) ell(ctx, bx + (s.rng() - 0.2) * 26 * u, by - s.rng() * 16 * u, u * (0.3 + s.rng() * 0.6), u * (0.3 + s.rng() * 0.4), rgba('#9fb0c8', 0.35));
    rain(s, 0, 0, w, h, Math.round(w * h / (u * u) * 0.12), '#9fb0c8', 0.3, 0.5);
  } else {
    glow(ctx, bx, by - 10 * u, 26 * u, '#ffe6a8', 0.16);
  }
}

// ── Kajdany → Wolność ───────────────────────────────────────────

function paintKajdany(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  // the stone walls
  const stone = bright ? '#c9b49a' : '#2a2c33', mortar = bright ? '#a8927a' : '#1c1d22';
  rect(ctx, 0, 0, w, gy, stone);
  for (let row = 0; row * 6 * u < gy; row++) {
    const y = gy - (row + 1) * 6 * u;
    rect(ctx, 0, y + 6 * u - 0.6 * u, w, 0.6 * u, mortar);
    for (let x = (row % 2) * 6 * u - 12 * u; x < w; x += 12 * u) {
      rect(ctx, x, y, 0.6 * u, 6 * u, mortar);
      if (s.rng() < 0.3) rect(ctx, x + 0.6 * u, y, 11.4 * u, 5.4 * u, rgba(bright ? '#ffffff' : '#000000', 0.06));
    }
  }
  rect(ctx, 0, gy - 1, w, h - gy + 1, vgrad(ctx, gy, h, bright ? ['#b39a7c', '#8f7558'] : ['#1d1e23', '#141518']));
  // straw on the floor, in tufts
  for (const [x0, x1] of [[-50, -30], [-14, 4], [40, 56]] as const) grass(s, X(s, x0), X(s, x1), gy + 12 * u, 2.4 * u, bright ? '#e6c46a' : '#45402e', 24);
  // the small barred window high on the left
  const wx = X(s, -40), wy = gy - 70 * u, ww = 12 * u, wh = 10 * u;
  rect(ctx, wx, wy, ww, wh, bright ? '#bfe6ff' : '#3b4458');
  bars(s, wx, wy, ww, wh, 4, bright ? '#6a5a4a' : '#121317');
  glow(ctx, wx + ww / 2, wy + wh / 2, 22 * u, bright ? '#ffffff' : '#7d8fa8', bright ? 0.2 : 0.16);
  if (!bright) {
    // the moon's sliver falling on the floor
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    poly(ctx, [[wx, wy + wh], [wx + ww, wy + wh], [wx + ww + 26 * u, gy + 12 * u], [wx + 12 * u, gy + 12 * u]], 'rgba(130,150,190,.08)');
    ctx.restore();
  }
  // the cell door on the right: bars closed — or open on a field in the sun
  const dx = X(s, 18), dw = 22 * u, dh = 44 * u;
  if (bright) {
    const field = vgrad(ctx, gy - dh, gy, ['#7cc6f2', '#d6f0ff', '#f2d27a', '#e8b84f']);
    rect(ctx, dx - 1.5 * u, gy - dh - 1.5 * u, dw + 3 * u, dh + 1.5 * u, '#8a7560');
    rect(ctx, dx, gy - dh, dw, dh, field);
    ctx.save();
    ctx.beginPath();
    ctx.rect(dx, gy - dh, dw, dh);
    ctx.clip();
    sun(s, dx + dw * 0.75, gy - dh * 0.78, 2.4 * u, 1);
    hills(s, gy - dh * 0.3, 3, '#9edb74', 0.3, 5);
    grass(s, dx, dx + dw, gy, 5 * u, '#c9a23a', 40);
    flowers(s, dx, dx + dw, gy - dh * 0.25, gy, 8, ['#ff8fa8', '#fff4dc', '#bfa2f2']);
    figure(s, dx + dw * 0.55, gy - dh * 0.06, 15 * u, 'walk', hero(true, 2, 1), 1);
    ctx.restore();
    // the barred door swung wide open against the wall
    ctx.save();
    ctx.translate(dx + dw, gy);
    ctx.transform(0.42, -0.08, 0, 1, 0, 0);
    bars(s, 0, -dh, dw, dh, 5, '#5b4c3c');
    ctx.restore();
    // sunlight pouring into the cell
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(dx, gy - dh, dx - 40 * u, h);
    g.addColorStop(0, 'rgba(255,226,150,.4)');
    g.addColorStop(1, 'rgba(255,226,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(dx, gy - dh);
    ctx.lineTo(dx + dw, gy - dh);
    ctx.lineTo(dx + dw - 12 * u, h);
    ctx.lineTo(dx - 52 * u, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    rays(s, dx + dw / 2, gy - dh * 0.6, 80 * u, Math.PI * 0.82, 0.5, 6, '#ffe6a8', 0.14);
    // the broken chains on the floor
    chain(s, X(s, -42), gy - 16 * u, X(s, -28), gy + 10 * u, 3 * u, 2.6 * u, '#7a6a5a', true);
    chain(s, X(s, -42), gy - 4 * u, X(s, -12), gy + 14 * u, 2 * u, 2.6 * u, '#7a6a5a', true);
    ell(ctx, X(s, -42), gy - 16 * u, 1.8 * u, 1.8 * u, '#6a5a4a');
    ell(ctx, X(s, -42), gy - 4 * u, 1.8 * u, 1.8 * u, '#6a5a4a');
  } else {
    rect(ctx, dx - 1.5 * u, gy - dh - 1.5 * u, dw + 3 * u, dh + 1.5 * u, '#17181c');
    rect(ctx, dx, gy - dh, dw, dh, '#0f1013');
    bars(s, dx, gy - dh, dw, dh, 5, '#3a3c44');
    // the person sitting against the wall in the moon's sliver, knees drawn up, chained
    const fx = X(s, -20), fy = gy + 11 * u, fh = 38 * u;
    figure(s, fx, fy, fh, 'knees', { ...hero(false, 2, -1), rimColor: '#b7c4e8' }, 1);
    chain(s, X(s, -42), gy - 16 * u, fx + 0.18 * fh, fy - 0.26 * fh, 3 * u, 2.6 * u, '#6a6d77');
    chain(s, X(s, -42), gy - 4 * u, fx + 0.2 * fh, fy - 0.02 * fh, 2 * u, 2.6 * u, '#6a6d77');
    ell(ctx, X(s, -42), gy - 16 * u, 1.8 * u, 1.8 * u, '#4a4c54');
    ell(ctx, X(s, -42), gy - 4 * u, 1.8 * u, 1.8 * u, '#4a4c54');
  }
}

// ── Zmęczenie → Siła ────────────────────────────────────────────

function paintZmeczenie(s: Stage): void {
  const { ctx, w, h, u, gy, bright } = s;
  // the wall with a wide window onto a riverside path
  rect(ctx, 0, 0, w, gy, bright ? '#f3e2c4' : '#22262f');
  const wx = X(s, -20), wy = gy - 64 * u, ww = 64 * u, wh = 44 * u;
  ctx.save();
  ctx.beginPath();
  ctx.rect(wx, wy, ww, wh);
  ctx.clip();
  if (bright) {
    rect(ctx, wx, wy, ww, wh, vgrad(ctx, wy, wy + wh, ['#8fc7ef', '#ffd9a8', '#ffb98a']));
    sun(s, wx + ww * 0.78, wy + wh * 0.62, 3.6 * u, 1);
    hills(s, wy + wh * 0.66, 5, '#8fbf86', 0.4, 4);
    rect(ctx, wx, wy + wh * 0.72, ww, wh * 0.1, '#7fc6e0');
    rect(ctx, wx, wy + wh * 0.8, ww, wh * 0.2, '#e7c9a3');
    tree(s, wx + ww * 0.12, wy + wh * 0.8, 18 * u, true, '#7a5236', BRIGHT.leaf, BRIGHT.leaf2);
    // the same person, running along the river at dawn
    figure(s, wx + ww * 0.48, wy + wh * 0.97, 24 * u, 'run', hero(true, 4, 1), 1);
    glow(ctx, wx + ww * 0.78, wy + wh * 0.62, 30 * u, '#ffe6a8', 0.3);
    birds(s, wx + ww * 0.6, wy + wh * 0.25, 3, 1, '#5b6b80');
  } else {
    rect(ctx, wx, wy, ww, wh, vgrad(ctx, wy, wy + wh, ['#06080d', '#0f1420', '#151b28']));
    stars(s, wy + wh * 0.5, 0, 0);
    for (let i = 0; i < 26; i++) {
      // the city at night: a few far windows still awake
      const bxx = wx + s.rng() * ww, bh = (6 + s.rng() * 14) * u;
      rect(ctx, bxx, wy + wh - bh, (3 + s.rng() * 5) * u, bh, '#0b0e15');
      if (s.rng() < 0.35) rect(ctx, bxx + u, wy + wh - bh + 2 * u, 0.8 * u, 0.8 * u, rgba('#c9a45a', 0.5));
    }
    ell(ctx, wx + ww * 0.15, wy + wh * 0.2, 2.2 * u, 2.2 * u, '#c8d0dc');
  }
  ctx.restore();
  rect(ctx, wx - 1.5 * u, wy - 1.5 * u, ww + 3 * u, 1.5 * u, bright ? '#fff4dc' : '#2e323c');
  rect(ctx, wx - 1.5 * u, wy + wh, ww + 3 * u, 1.5 * u, bright ? '#fff4dc' : '#2e323c');
  rect(ctx, wx - 1.5 * u, wy, 1.5 * u, wh, bright ? '#fff4dc' : '#2e323c');
  rect(ctx, wx + ww, wy, 1.5 * u, wh, bright ? '#fff4dc' : '#2e323c');
  rect(ctx, wx + ww / 2 - 0.6 * u, wy, 1.2 * u, wh, bright ? '#fff4dc' : '#2e323c');
  // the clock on the wall: two at night, six at dawn
  clockFace(s, X(s, -34), gy - 54 * u, 5 * u, bright ? '#fff4dc' : '#8a8f9a', bright ? '#3d3028' : '#20232b', bright ? 6 : 2, 0);
  rect(ctx, 0, gy - 1, w, h - gy + 1, vgrad(ctx, gy, h, bright ? ['#c9a06e', '#a77d4c'] : ['#1c1e25', '#131419']));
  // the desk, the lamp, the laptop, the plant (a chair at its end, where the night was spent)
  const dw = 52 * u, fh = 34 * u, fy = gy + 12 * u;
  chair(s, X(s, 18), fy, fh, bright ? '#8f5634' : '#2a2624', 1);
  const { top } = table(s, X(s, -14), fy, dw, fh * 0.47, bright ? '#b9784a' : '#2f2a28');
  plant(s, X(s, -30), top, 12 * u, bright ? 1 : 0, bright ? '#3fb7a8' : '#3e4452');
  // the desk lamp
  line(ctx, X(s, 4), top, X(s, 6), top - 12 * u, bright ? '#3d4a57' : '#16181d', Math.max(1, u * 0.7));
  line(ctx, X(s, 6), top - 12 * u, X(s, 1), top - 16 * u, bright ? '#3d4a57' : '#16181d', Math.max(1, u * 0.7));
  poly(ctx, [[X(s, -2), top - 13 * u], [X(s, 3), top - 18 * u], [X(s, 5), top - 14 * u]], bright ? '#ff8a6b' : '#22252c');
  if (bright) {
    // a tidy desk: a notebook, a glass of water, running shoes' laces hanging from the drawer
    rect(ctx, X(s, -22), top - 1.2 * u, 12 * u, 1.2 * u, '#7fb4e0');
    rect(ctx, X(s, -6), top - 4.4 * u, 2.6 * u, 4.4 * u, rgba('#bfe6ff', 0.7));
    glow(ctx, X(s, 20), gy - 20 * u, 40 * u, '#ffe6a8', 0.16);
  } else {
    glow(ctx, X(s, 0), top - 12 * u, 16 * u, '#9c8650', 0.3);
    // the laptop's cold glow, papers, the cup gone cold
    poly(ctx, [[X(s, -18), top], [X(s, -6), top], [X(s, -8), top - 9 * u], [X(s, -20), top - 9 * u]], '#3a4252');
    rect(ctx, X(s, -19.4), top - 8.4 * u, 11 * u, 7.6 * u, '#7d9cc4');
    glow(ctx, X(s, -13), top - 5 * u, 18 * u, '#6f8fbf', 0.32);
    for (let i = 0; i < 5; i++) rect(ctx, X(s, -28 + i * 0.6), top - (1 + i * 0.5) * u, 9 * u, 0.5 * u, i % 2 ? '#8f8a80' : '#a39d92');
    rect(ctx, X(s, 9), top - 3.6 * u, 3 * u, 3.6 * u, '#4a4440');
    figure(s, X(s, 18), fy, fh, 'slumpDesk', { ...hero(false, 4, 1), rimColor: '#9fb4dc' }, -1);
  }
}
