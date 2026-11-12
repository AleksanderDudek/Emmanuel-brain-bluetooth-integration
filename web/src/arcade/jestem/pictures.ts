/**
 * The eighteen pictures of Ja jestem… (DESIGN §13.8), painted in code with one brush (art.ts): symbolic
 * scenes rich in light and colour, so that the pencil sketch reads and the stained glass sings.  Each
 * picture uses the geometry of scenes.ts, so its fragments are its real parts.  No dove (Arka's), no
 * butterfly (Motylarnia's), no cross, and Jesus is never shown (§13.4): the figures are the player.
 *
 *   paintPicture(id, ctx, w, h)  the whole picture into a w × h canvas (any size: painted in unit coordinates)
 */
import { Brush, mix, rgba, type FigureStyle, type Pose, type RGB } from './art';
import {
  BEZPIECZNY, BLOGOSLAWIONY, BOGATY, DZIECKO, KOCHANY, MADRY, NOWY, OCZYSZCZONY, ODWAZNY, SILNY, SPOKOJNY, SWIATLO, SZCZESLIWY,
  UZDROWIONY, WOLNY, WYBRANY, ZDROWY, ZWYCIEZCA, inPolygon, type DeclId,
} from './scenes';

const TAU = Math.PI * 2;

// ── poses ────────────────────────────────────────────────────────
const RUN: Pose = { lean: 0.26, armL: [0.8, 2.1], armR: [-0.75, -0.2], legR: [1.0, 0.22], legL: [-0.55, -1.45], head: 0.05 };
const DANCE: Pose = { lean: -0.06, armL: [-2.5, -2.85], armR: [2.35, 2.75], legL: [-0.06, 0.02], legR: [0.55, -0.45], skirt: 1, hair: 0.8 };
const STAND: Pose = { lean: 0.07, armL: [-0.28, -0.12], armR: [0.32, 0.12], legL: [-0.22, -0.12], legR: [0.3, 0.18], cloak: 1.1 };
const VICTORY: Pose = { lean: 0, armL: [-2.45, -2.75], armR: [2.45, 2.75], legL: [-0.14, -0.05], legR: [0.14, 0.05], head: 0 };
const CHILD: Pose = { lean: 0.22, armL: [-0.95, -0.45], armR: [2.25, 2.7], legR: [0.85, 0.1], legL: [-0.45, -1.7], child: true, hair: 0.3 };
const HUG_A: Pose = { lean: 0.12, armL: [1.15, 0.5], armR: [1.3, 0.75], legL: [-0.07, 0], legR: [0.07, 0.02], head: 0.32 };
const HUG_B: Pose = { lean: -0.15, armL: [-0.85, -1.5], armR: [-0.75, -1.35], legL: [-0.06, -0.02], legR: [0.06, 0], head: -0.45, hair: 0.8, skirt: 0.35 };

/** A flock of small birds (V strokes). */
function birds(b: Brush, pts: readonly (readonly [number, number, number])[], col: RGB): void {
  const c = b.ctx;
  c.strokeStyle = rgba(col, 0.85);
  c.lineCap = 'round';
  for (const [u, v, s] of pts) {
    const x = b.X(u), y = b.Y(v), S = b.S(s);
    c.lineWidth = Math.max(1, S * 0.18);
    c.beginPath();
    c.moveTo(x - S, y - S * 0.35);
    c.quadraticCurveTo(x - S * 0.4, y - S * 0.5, x, y);
    c.quadraticCurveTo(x + S * 0.4, y - S * 0.5, x + S, y - S * 0.35);
    c.stroke();
  }
}

/** A pine silhouette. */
function pine(b: Brush, u: number, base: number, hgt: number, col: RGB): void {
  const c = b.ctx;
  c.fillStyle = rgba(col);
  const w = hgt * 0.32;
  c.beginPath();
  c.moveTo(b.X(u), b.Y(base - hgt));
  for (let i = 1; i <= 4; i++) {
    const v = base - hgt + (hgt * i) / 4.4;
    c.lineTo(b.X(u + w * (i / 4) * 0.9 * (b.h / b.w)), b.Y(v));
    c.lineTo(b.X(u + w * (i / 4) * 0.45 * (b.h / b.w)), b.Y(v - hgt * 0.03));
  }
  c.lineTo(b.X(u + w * 0.5 * (b.h / b.w)), b.Y(base));
  c.lineTo(b.X(u - w * 0.5 * (b.h / b.w)), b.Y(base));
  for (let i = 4; i >= 1; i--) {
    const v = base - hgt + (hgt * i) / 4.4;
    c.lineTo(b.X(u - w * (i / 4) * 0.45 * (b.h / b.w)), b.Y(v - hgt * 0.03));
    c.lineTo(b.X(u - w * (i / 4) * 0.9 * (b.h / b.w)), b.Y(v));
  }
  c.closePath();
  c.fill();
}

/** Fruit: a round fruit with a highlight and a little leaf. */
function fruit(b: Brush, u: number, v: number, r: number, col: RGB): void {
  const c = b.ctx, x = b.X(u), y = b.Y(v), R = b.S(r);
  const g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R);
  g.addColorStop(0, rgba(mix(col, [255, 255, 230], 0.55)));
  g.addColorStop(0.6, rgba(col));
  g.addColorStop(1, rgba(mix(col, [40, 20, 20], 0.45)));
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, R, 0, TAU);
  c.fill();
}

// ── the pictures ─────────────────────────────────────────────────
function zdrowy(b: Brush): void {
  const G = ZDROWY;
  b.sky([[0, [44, 36, 96]], [0.28, [118, 70, 138]], [0.45, [228, 122, 120]], [0.56, [255, 196, 132]]]);
  b.stars(18, r => [r(), r() * 0.2], [255, 240, 230], 0.0018);
  b.streak(0.24, 0.24, 0.2, 0.03, [255, 190, 170], [150, 86, 140], 6);
  b.streak(0.84, 0.33, 0.14, 0.022, [255, 206, 176], [170, 100, 140], 5);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 222, 150], [255, 180, 120], 22, 6);
  b.ridge(G.far, [176, 112, 162], [214, 132, 140], 0.72);
  b.rimLine(G.far, [255, 214, 160], 0.7, 0.004, G.sun.x, 0.22);
  b.mist(0.6, 0.03, [255, 196, 176], 0.35);
  b.ridge(G.mid, [112, 76, 128], [84, 64, 112]);
  b.rimLine(G.mid, [255, 196, 150], 0.45, 0.003, G.sun.x, 0.25);
  b.ridge(G.near, [72, 104, 74], [26, 46, 38]);
  b.rimLine(G.near, [255, 220, 150], 0.8, 0.005, G.runner.x + 0.1, 0.32);
  // the path up the hill to the runner
  const c = b.ctx;
  c.fillStyle = b.vgrad(G.near(G.runner.x), 1, [236, 190, 140], [150, 110, 90]);
  c.beginPath();
  c.moveTo(b.X(0.62), b.Y(1.02));
  c.bezierCurveTo(b.X(0.48), b.Y(0.9), b.X(0.5), b.Y(0.8), b.X(G.runner.x + 0.02), b.Y(G.near(G.runner.x) + 0.005));
  c.lineTo(b.X(G.runner.x + 0.055), b.Y(G.near(G.runner.x + 0.05) + 0.005));
  c.bezierCurveTo(b.X(0.56), b.Y(0.8), b.X(0.6), b.Y(0.9), b.X(0.86), b.Y(1.02));
  c.closePath();
  c.fill();
  b.grass(G.near, 260, [[80, 130, 76], [110, 160, 90], [60, 100, 64], [190, 200, 120]], 0.03, 0.25, 0, 1, 0.3);
  b.flowers(70, r => { const u = r(), v = G.near(u) + 0.02 + r() * 0.24; return v < 1 && Math.abs(u - 0.6 + (v - 0.8) * 0.4) > 0.07 ? [u, v] : null; },
    [[255, 236, 140], [255, 170, 180], [255, 255, 245]], 0.011);
  birds(b, [[0.47, 0.17, 0.016], [0.52, 0.2, 0.012], [0.43, 0.21, 0.011]], [60, 40, 80]);
  b.figure(G.runner.x, G.near(G.runner.x) + 0.004, G.runner.h, RUN, { body: [36, 28, 48], rim: [255, 214, 150], from: 1 });
  b.glow(G.runner.x + 0.03, G.near(G.runner.x) - G.runner.h * 0.5, 0.14, [255, 200, 150], 0.18);
}

function uzdrowiony(b: Brush): void {
  const G = UZDROWIONY;
  b.sky([[0, [86, 112, 152]], [0.3, [146, 172, 196]], [0.62, [224, 230, 214]]]);
  b.cloud(0.78, 0.12, 0.26, 0.07, [190, 196, 206], [110, 120, 140], 9);
  b.cloud(0.95, 0.26, 0.16, 0.05, [200, 206, 214], [126, 134, 150], 7);
  b.glow(G.sun.x, G.sun.y, 0.5, [255, 240, 190], 0.5);
  for (const [u1, w1] of [[0.38, 0.12], [0.62, 0.16], [0.86, 0.1]] as const) b.beam(G.sun.x + 0.04, 0.02, u1, 0.92, 0.04, w1, [255, 246, 200], 0.16);
  b.ridge(u => 0.66 + 0.03 * Math.sin(u * 8 + 1), [150, 176, 150], [120, 150, 120]);
  for (let i = 0; i < 9; i++) b.tree(0.04 + i * 0.12, 0.64, 0.035, [96, 128, 104], [150, 180, 146], [90, 100, 90], 0.69, -1, 6);
  b.ridge(G.ground, [96, 150, 78], [46, 92, 52]);
  // a puddle mirroring the sky
  const c = b.ctx;
  c.fillStyle = b.vgrad(0.86, 0.95, [214, 226, 236], [150, 172, 196]);
  c.beginPath();
  c.ellipse(b.X(0.8), b.Y(0.9), b.S(0.12), b.S(0.03), 0, 0, TAU);
  c.fill();
  // the stump, with its rings, roots and bark
  const s = G.stump;
  c.fillStyle = b.hgrad(s.x0, s.x1, [92, 62, 44], [150, 104, 70]);
  c.beginPath();
  c.moveTo(b.X(s.x0), b.Y(s.top));
  c.lineTo(b.X(s.x1), b.Y(s.top));
  c.quadraticCurveTo(b.X(s.x1 + 0.02), b.Y(s.bottom - 0.03), b.X(s.x1 + 0.09), b.Y(s.bottom + 0.01));
  c.lineTo(b.X(s.x0 - 0.08), b.Y(s.bottom + 0.01));
  c.quadraticCurveTo(b.X(s.x0 - 0.02), b.Y(s.bottom - 0.03), b.X(s.x0), b.Y(s.top));
  c.closePath();
  c.fill();
  b.texture(70, r => [s.x0 + r() * (s.x1 - s.x0), s.top + 0.01 + r() * (s.bottom - s.top - 0.02)], [60, 40, 30], 0.6, 0.012);
  c.fillStyle = rgba([214, 172, 120]);
  c.beginPath();
  c.ellipse(b.X((s.x0 + s.x1) / 2), b.Y(s.top), b.S((s.x1 - s.x0) / 2), b.S(0.035), 0, 0, TAU);
  c.fill();
  c.strokeStyle = rgba([150, 108, 72], 0.8);
  c.lineWidth = Math.max(1, b.S(0.0025));
  for (let i = 1; i <= 6; i++) {
    c.beginPath();
    c.ellipse(b.X((s.x0 + s.x1) / 2 + 0.02), b.Y(s.top), b.S(((s.x1 - s.x0) / 2) * (i / 7)), b.S(0.035 * (i / 7)), 0, 0, TAU);
    c.stroke();
  }
  // the young tree grows from the stump
  c.strokeStyle = rgba([110, 80, 56]);
  c.lineCap = 'round';
  c.lineWidth = b.S(0.022);
  c.beginPath();
  c.moveTo(b.X(G.trunk.x + 0.02), b.Y(G.trunk.bottom));
  c.bezierCurveTo(b.X(G.trunk.x - 0.03), b.Y(0.6), b.X(G.trunk.x + 0.03), b.Y(0.5), b.X(G.trunk.x), b.Y(G.trunk.top));
  c.stroke();
  c.lineWidth = b.S(0.009);
  for (const [u2, v2] of [[0.4, 0.4], [0.6, 0.38], [0.46, 0.3], [0.56, 0.28]] as const) {
    c.beginPath();
    c.moveTo(b.X(G.trunk.x), b.Y(G.trunk.top + 0.05));
    c.quadraticCurveTo(b.X((G.trunk.x + u2) / 2), b.Y(v2 + 0.04), b.X(u2), b.Y(v2));
    c.stroke();
  }
  b.glow(G.crown.x, G.crown.y, 0.3, [220, 255, 190], 0.22);
  b.tree(G.crown.x, G.crown.y, G.crown.r, [56, 122, 58], [170, 222, 110], [110, 80, 56], G.crown.y + 0.01, -1, 26);
  b.stars(40, r => { const a = r() * TAU, d = Math.sqrt(r()) * G.crown.r; return [G.crown.x + Math.cos(a) * d, G.crown.y + Math.sin(a) * d * 0.85]; }, [255, 255, 255], 0.0025);
  b.grass(G.ground, 220, [[90, 150, 80], [120, 180, 90], [70, 120, 70]], 0.028, 0.2);
  b.flowers(26, r => { const u = r(), v = G.ground(u) + 0.03 + r() * 0.15; return u > s.x0 - 0.1 && u < s.x1 + 0.1 && v < s.bottom + 0.03 ? null : [u, v]; },
    [[255, 255, 245], [250, 220, 120]], 0.01);
}

function silny(b: Brush): void {
  const G = SILNY;
  b.sky([[0, [52, 104, 190]], [0.35, [110, 162, 226]], [0.62, [206, 228, 246]]]);
  b.glow(0.1, 0.1, 0.45, [255, 248, 220], 0.45);
  b.cloud(0.7, 0.14, 0.12, 0.03, [255, 255, 255], [200, 214, 236], 6);
  // the range: snow above, shaded faces, a rim of morning light
  b.ridge(G.peaks, [246, 250, 255], [140, 160, 200], 0.66);
  const c = b.ctx;
  c.save();
  b.ridgePath(G.peaks, 0.66);
  c.clip();
  for (const pk of [0.18, 0.6, 0.88]) {
    c.fillStyle = rgba([110, 130, 180], 0.55);
    c.beginPath();
    c.moveTo(b.X(pk), b.Y(G.peaks(pk)));
    c.lineTo(b.X(pk + 0.2), b.Y(0.66));
    c.lineTo(b.X(pk + 0.02), b.Y(0.66));
    c.closePath();
    c.fill();
  }
  c.fillStyle = b.vgrad(0.42, 0.66, [150, 170, 210], [90, 120, 120]);
  c.fillRect(0, b.Y(0.48), b.w, b.Y(0.2));
  c.restore();
  b.rimLine(G.peaks, [255, 236, 210], 0.6, 0.004, 0.2, 0.5);
  b.cloud(0.2, 0.5, 0.2, 0.035, [255, 255, 255], [196, 206, 226], 8);
  b.cloud(0.86, 0.47, 0.16, 0.03, [255, 255, 255], [200, 210, 230], 7);
  b.ridge(u => 0.6 + 0.03 * Math.sin(u * 7 + 2), [70, 110, 96], [50, 86, 76]);
  for (let i = 0; i < 16; i++) pine(b, 0.02 + i * 0.064 + b.r(-0.01, 0.01), 0.63 + b.r(0, 0.03), b.r(0.04, 0.07), [40, 78, 66]);
  b.ridge(G.rock, [136, 120, 104], [70, 60, 56]);
  b.texture(160, r => { const u = r(); return [u, G.rock(u) + 0.01 + r() * (1 - G.rock(u))]; }, [60, 50, 46], 0.5, 0.02);
  b.rimLine(G.rock, [255, 230, 190], 0.5, 0.004, 0.3, 0.35);
  // the cedar: a strong trunk and its layered, level boughs
  c.fillStyle = b.hgrad(G.cedar.x - 0.03, G.cedar.x + 0.03, [70, 46, 34], [130, 90, 60]);
  c.beginPath();
  c.moveTo(b.X(G.cedar.x - 0.035), b.Y(G.cedar.base + 0.02));
  c.quadraticCurveTo(b.X(G.cedar.x - 0.01), b.Y(0.45), b.X(G.cedar.x - 0.008), b.Y(G.cedar.top));
  c.lineTo(b.X(G.cedar.x + 0.008), b.Y(G.cedar.top));
  c.quadraticCurveTo(b.X(G.cedar.x + 0.02), b.Y(0.45), b.X(G.cedar.x + 0.04), b.Y(G.cedar.base + 0.02));
  c.closePath();
  c.fill();
  const tiers = [[0.21, 0.07, 0.02], [0.29, 0.11, -0.03], [0.37, 0.15, 0.03], [0.45, 0.2, -0.02], [0.53, 0.24, 0.04], [0.61, 0.27, -0.01]] as const;
  c.strokeStyle = rgba([70, 48, 36]);
  c.lineCap = 'round';
  for (const [v, half, off] of tiers) {
    c.lineWidth = b.S(0.006);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(b.X(G.cedar.x), b.Y(v + 0.035));
      c.quadraticCurveTo(b.X(G.cedar.x + s * half * 0.5), b.Y(v + 0.015), b.X(G.cedar.x + off + s * half * 0.92), b.Y(v + 0.01));
      c.stroke();
    }
  }
  for (const [v, half, off] of tiers) {
    // a bough: a level, ragged cloud of needles, dark beneath and sunlit on top
    for (let k = 0; k < 16; k++) {
      const du = (k / 15 - 0.5) * 2 * half;
      const cu = G.cedar.x + off + du + b.r(-0.012, 0.012);
      const cv = v + b.r(-0.006, 0.01) + Math.abs(du) * 0.06;
      const rx = b.r(0.03, 0.05) * (1 - Math.abs(du) / half * 0.35), ry = b.r(0.012, 0.02);
      c.fillStyle = rgba([24, 62, 44]);
      c.beginPath();
      c.ellipse(b.X(cu), b.Y(cv + 0.008), b.S(rx), b.S(ry), b.r(-0.15, 0.15), 0, TAU);
      c.fill();
      c.fillStyle = rgba(mix([60, 116, 70], [150, 196, 110], b.rnd() * 0.6 + (du < 0 ? 0.35 : 0)));
      c.beginPath();
      c.ellipse(b.X(cu - 0.004), b.Y(cv - 0.002), b.S(rx * 0.85), b.S(ry * 0.6), b.r(-0.15, 0.15), Math.PI, TAU);
      c.fill();
    }
    b.texture(26, r => [G.cedar.x + off + (r() - 0.5) * half * 1.9, v - 0.008 + r() * 0.02], [176, 220, 140], 0.4, 0.01);
  }
  b.glow(G.cedar.x - 0.1, 0.35, 0.25, [255, 250, 220], 0.12);
}

function szczesliwy(b: Brush): void {
  const G = SZCZESLIWY;
  b.sky([[0, [72, 146, 222]], [0.42, [168, 208, 240]], [0.57, [252, 236, 196]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 236, 150], [255, 214, 130], 16, 4);
  b.cloud(0.26, 0.2, 0.16, 0.05, [255, 255, 255], [214, 226, 240], 8);
  b.cloud(0.58, 0.3, 0.11, 0.035, [255, 255, 255], [220, 230, 242], 6);
  b.ridge(G.horizon, [176, 196, 112], [122, 168, 82]);
  b.tree(G.tree.x, G.tree.y, G.tree.r, [52, 104, 56], [128, 176, 86], [90, 70, 50], G.horizon(G.tree.x) + 0.01, 1, 18);
  b.ridge(u => G.horizon(u) + 0.08 + 0.015 * Math.sin(u * 6), [150, 190, 86], [92, 150, 66]);
  b.grass(u => G.horizon(u) + 0.05, 340, [[110, 170, 80], [160, 200, 100], [90, 140, 70], [210, 210, 120]], 0.035, 0.45, 0, 1, 0.2);
  b.flowers(220, r => { const u = r(), v = G.horizon(u) + 0.03 + r() ** 0.8 * 0.44; return v < 1.02 ? [u, v] : null; },
    [[232, 54, 46], [236, 70, 60], [84, 112, 224], [255, 255, 250], [255, 214, 70], [240, 120, 170]], 0.018);
  // the dance, with petals in the air
  b.glow(G.dancer.x, G.dancer.feet - G.dancer.h * 0.55, 0.22, [255, 230, 170], 0.2);
  b.figure(G.dancer.x, G.dancer.feet, G.dancer.h, DANCE, { body: [74, 44, 56], rim: [255, 226, 160], from: 1, cloth: [236, 104, 92] });
  const c = b.ctx;
  for (let i = 0; i < 26; i++) {
    const a = b.r(0, TAU), d = b.r(0.08, 0.2);
    c.fillStyle = rgba(i % 3 ? [236, 66, 60] : [255, 170, 190], 0.9);
    c.beginPath();
    c.ellipse(b.X(G.dancer.x + Math.cos(a) * d), b.Y(G.dancer.feet - G.dancer.h * 0.6 + Math.sin(a) * d * 0.7), b.S(0.007), b.S(0.004), a, 0, TAU);
    c.fill();
  }
}

function bogaty(b: Brush): void {
  const G = BOGATY;
  b.sky([[0, [120, 150, 204]], [0.35, [236, 196, 150]], [0.56, [255, 214, 150]]]);
  b.glow(0.72, 0.44, 0.5, [255, 214, 140], 0.5);
  b.ridge(() => G.ground, [170, 170, 90], [120, 130, 60]);
  for (const [u, v, r] of G.trees) {
    b.tree(u, v, r, [44, 86, 46], [128, 162, 76], [86, 64, 46], G.ground + 0.02, 1, 20);
    for (let i = 0; i < 12; i++) {
      const a = b.r(0, TAU), d = b.r(0.1, 0.85) * r;
      fruit(b, u + Math.cos(a) * d, v + Math.sin(a) * d * 0.8, 0.011, i % 3 ? [222, 60, 40] : [255, 160, 40]);
    }
  }
  for (const u1 of [0.24, 0.5, 0.8]) b.beam(0.72, 0.4, u1, 0.98, 0.02, 0.1, [255, 226, 160], 0.14);
  b.ridge(u => G.ground + 0.03 + 0.01 * Math.sin(u * 9), [190, 176, 96], [120, 120, 60]);
  b.grass(() => G.ground + 0.03, 200, [[170, 160, 80], [130, 140, 70], [210, 190, 110]], 0.025, 0.4);
  // the table, its cloth, and the harvest on it
  const c = b.ctx, T = G.table;
  c.fillStyle = b.vgrad(T.top, T.front, [176, 116, 66], [130, 82, 46]);
  b.poly([[T.x0, T.top], [T.x1, T.top], [T.x1 + 0.02, T.front], [T.x0 - 0.02, T.front]], c.fillStyle);
  c.fillStyle = rgba([96, 60, 36]);
  c.fillRect(b.X(T.x0 - 0.02), b.Y(T.front), b.S(T.x1 - T.x0 + 0.04), b.Y(0.025));
  for (const u of [T.x0 + 0.02, T.x1 - 0.05]) c.fillRect(b.X(u), b.Y(T.front + 0.02), b.S(0.03), b.Y(0.2));
  b.poly([[0.2, T.top], [0.8, T.top], [0.84, T.front], [0.16, T.front]], b.vgrad(T.top, T.front, [255, 250, 236], [226, 216, 196]));
  c.fillStyle = rgba([236, 228, 210]);
  c.fillRect(b.X(0.16), b.Y(T.front), b.S(0.68), b.Y(0.05));
  // loaves and a jug
  for (const [u, v] of [[0.16, 0.66], [0.24, 0.672]] as const) {
    c.fillStyle = b.vgrad(v - 0.03, v + 0.01, [236, 180, 100], [170, 110, 50]);
    c.beginPath();
    c.ellipse(b.X(u), b.Y(v), b.S(0.06), b.S(0.026), -0.1, 0, TAU);
    c.fill();
  }
  c.fillStyle = b.hgrad(0.76, 0.86, [170, 80, 50], [220, 120, 80]);
  c.beginPath();
  c.moveTo(b.X(0.78), b.Y(0.68));
  c.quadraticCurveTo(b.X(0.74), b.Y(0.6), b.X(0.79), b.Y(0.56));
  c.lineTo(b.X(0.84), b.Y(0.56));
  c.quadraticCurveTo(b.X(0.89), b.Y(0.6), b.X(0.85), b.Y(0.68));
  c.closePath();
  c.fill();
  // the basket: woven, overflowing
  const B = G.basket;
  for (let i = 0; i < 40; i++) {
    const a = b.r(Math.PI, TAU), d = b.r(0.2, 1);
    const cols: RGB[] = [[214, 40, 40], [240, 140, 40], [180, 200, 60], [120, 50, 130], [250, 200, 60]];
    fruit(b, B.x + Math.cos(a) * B.rx * d * 0.9, B.y - 0.01 + Math.sin(a) * B.ry * 1.6 * d, b.r(0.014, 0.022), cols[i % cols.length]);
  }
  for (let i = 0; i < 14; i++) fruit(b, B.x + 0.1 + (i % 4) * 0.012, B.y - 0.035 + Math.floor(i / 4) * 0.013, 0.008, [110, 40, 120]);
  c.fillStyle = b.vgrad(B.y - 0.02, B.y + B.ry, [200, 150, 90], [130, 90, 50]);
  c.beginPath();
  c.ellipse(b.X(B.x), b.Y(B.y), b.S(B.rx), b.S(B.ry), 0, 0, Math.PI);
  c.lineTo(b.X(B.x - B.rx), b.Y(B.y));
  c.fill();
  c.strokeStyle = rgba([110, 72, 40], 0.7);
  c.lineWidth = Math.max(1, b.S(0.003));
  for (let i = 0; i < 9; i++) {
    c.beginPath();
    c.ellipse(b.X(B.x), b.Y(B.y), b.S(B.rx * (0.3 + i * 0.08)), b.S(B.ry * (0.3 + i * 0.08)), 0, 0.2, Math.PI - 0.2);
    c.stroke();
  }
  b.glow(B.x, B.y - 0.04, 0.18, [255, 220, 150], 0.18);
}

function wolny(b: Brush): void {
  const G = WOLNY;
  b.sky([[0, [64, 126, 210]], [0.5, [150, 200, 240]], [G.horizon, [238, 242, 246]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 246, 200], [255, 236, 180], 14, 4);
  for (const [u, v, rx, ry] of G.clouds) b.cloud(u, v, rx, ry, [255, 255, 255], [200, 214, 236], 8);
  b.ridge(() => G.horizon, [96, 156, 200], [46, 96, 156], G.ledge);
  b.shimmer(G.horizon + 0.01, G.ledge, 90, [255, 250, 220], 0.7, G.sun.x - 0.05, 0.2);
  // the stone sill
  const c = b.ctx;
  c.fillStyle = b.vgrad(G.ledge, 1, [210, 190, 160], [140, 120, 100]);
  c.fillRect(0, b.Y(G.ledge), b.w, b.Y(1 - G.ledge));
  c.fillStyle = rgba([240, 228, 200]);
  c.fillRect(0, b.Y(G.ledge), b.w, b.Y(0.008));
  // the cage, its door open
  const K = G.cage, x0 = K.x - K.w / 2, x1 = K.x + K.w / 2, domeV = K.top + 0.07;
  c.fillStyle = b.vgrad(K.bottom - 0.03, K.bottom, [120, 80, 50], [70, 46, 30]);
  c.fillRect(b.X(x0 - 0.01), b.Y(K.bottom - 0.03), b.S(K.w + 0.02), b.Y(0.03));
  c.strokeStyle = rgba([226, 182, 90]);
  c.lineWidth = Math.max(1, b.S(0.0045));
  for (let i = 0; i <= 8; i++) {
    const u = x0 + (K.w * i) / 8;
    const k = (u - K.x) / (K.w / 2);
    c.beginPath();
    c.moveTo(b.X(u), b.Y(K.bottom - 0.03));
    c.lineTo(b.X(u), b.Y(domeV));
    c.quadraticCurveTo(b.X(u), b.Y(K.top + 0.07 * Math.abs(k)), b.X(K.x), b.Y(K.top));
    c.stroke();
  }
  for (const v of [domeV, (domeV + K.bottom) / 2, K.bottom - 0.035]) {
    c.beginPath();
    c.moveTo(b.X(x0), b.Y(v));
    c.lineTo(b.X(x1), b.Y(v));
    c.stroke();
  }
  c.beginPath();
  c.arc(b.X(K.x), b.Y(K.top - 0.012), b.S(0.012), 0, TAU);
  c.stroke();
  // the open door, swung out
  c.fillStyle = rgba([60, 120, 190], 0.25);
  c.beginPath();
  c.moveTo(b.X(x1 - 0.06), b.Y(domeV + 0.07));
  c.lineTo(b.X(x1 + 0.03), b.Y(domeV + 0.05));
  c.lineTo(b.X(x1 + 0.03), b.Y(domeV + 0.17));
  c.lineTo(b.X(x1 - 0.06), b.Y(domeV + 0.17));
  c.closePath();
  c.fill();
  c.strokeRect(b.X(x1 + 0.0), b.Y(domeV + 0.05), b.S(0.03), b.Y(0.12));
  // the swallow, out in the wide sky
  const bx = b.X(G.bird.x), by = b.Y(G.bird.y), S = b.S(G.bird.span);
  b.glow(G.bird.x, G.bird.y, 0.16, [255, 250, 230], 0.25);
  c.fillStyle = rgba([24, 40, 92]);
  c.beginPath();
  c.moveTo(bx - S * 0.5, by + S * 0.05);
  c.quadraticCurveTo(bx - S * 0.25, by - S * 0.08, bx - S * 0.05, by - S * 0.02);
  c.quadraticCurveTo(bx + S * 0.1, by - S * 0.32, bx + S * 0.5, by - S * 0.42);
  c.quadraticCurveTo(bx + S * 0.2, by - S * 0.12, bx + S * 0.14, by + S * 0.02);
  c.quadraticCurveTo(bx + S * 0.22, by + S * 0.05, bx + S * 0.3, by + S * 0.03);
  c.quadraticCurveTo(bx + S * 0.12, by + S * 0.12, bx - S * 0.04, by + S * 0.1);
  c.lineTo(bx - S * 0.28, by + S * 0.28);
  c.lineTo(bx - S * 0.18, by + S * 0.1);
  c.lineTo(bx - S * 0.36, by + S * 0.22);
  c.closePath();
  c.fill();
  c.fillStyle = rgba([255, 244, 236]);
  c.beginPath();
  c.ellipse(bx + S * 0.04, by + S * 0.06, S * 0.11, S * 0.035, -0.15, 0, TAU);
  c.fill();
  c.fillStyle = rgba([200, 70, 50]);
  c.beginPath();
  c.arc(bx + S * 0.2, by + S * 0.035, S * 0.022, 0, TAU);
  c.fill();
  // a feather left behind
  c.strokeStyle = rgba([40, 56, 100], 0.8);
  c.lineWidth = Math.max(1, b.S(0.003));
  c.beginPath();
  c.moveTo(b.X(0.44), b.Y(0.5));
  c.quadraticCurveTo(b.X(0.455), b.Y(0.47), b.X(0.47), b.Y(0.455));
  c.stroke();
}

function kochany(b: Brush): void {
  const G = KOCHANY;
  b.sky([[0, [66, 56, 118]], [0.28, [184, 104, 140]], [0.46, [255, 164, 118]], [0.6, [255, 214, 160]]]);
  b.streak(0.18, 0.22, 0.2, 0.035, [255, 184, 164], [150, 80, 120], 6);
  b.streak(0.8, 0.16, 0.17, 0.03, [255, 196, 174], [160, 90, 130], 6);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 226, 160], [255, 176, 120], 24, 5);
  b.glow(G.sun.x, G.sun.y + 0.04, 0.6, [255, 196, 150], 0.3);
  b.ridge(u => 0.6 + 0.025 * Math.sin(u * 6 + 1), [200, 130, 150], [170, 110, 140]);
  b.ridge(G.ground, [96, 70, 74], [46, 36, 48]);
  b.rimLine(G.ground, [255, 210, 160], 0.7, 0.004, 0.5, 0.25);
  b.grass(G.ground, 240, [[110, 84, 80], [150, 110, 90], [80, 64, 66]], 0.032, 0.3, 0, 1, 0.1);
  b.flowers(90, r => { const u = r(), v = G.ground(u) + 0.04 + r() * 0.28; return v < 1 && Math.abs(u - 0.5) > 0.12 ? [u, v] : null; },
    [[255, 170, 190], [255, 240, 240], [240, 110, 140], [255, 214, 160]], 0.016);
  b.glow(G.pair.x, G.pair.feet - G.pair.h * 0.5, 0.2, [255, 230, 180], 0.35);
  const st: FigureStyle = { body: [52, 34, 46], rim: [255, 222, 170], from: 0 };
  b.figure(G.pair.x - 0.03, G.pair.feet, G.pair.h * 1.04, HUG_A, st);
  b.figure(G.pair.x + 0.032, G.pair.feet + 0.004, G.pair.h * 0.9, HUG_B, { ...st, cloth: [70, 46, 60] });
}

function spokojny(b: Brush): void {
  const G = SPOKOJNY;
  b.sky([[0, [132, 144, 198]], [0.28, [206, 178, 210]], [0.45, [255, 208, 182]], [0.52, [255, 232, 206]], [0.6, [210, 200, 220]], [1, [96, 110, 160]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 240, 210], [255, 210, 180], 0);
  b.streak(0.24, 0.24, 0.2, 0.025, [255, 222, 216], [190, 160, 196], 6);
  b.streak(0.76, 0.3, 0.17, 0.02, [255, 226, 216], [196, 170, 200], 5);
  b.ridge(G.hills, [124, 122, 172], [110, 108, 160], G.shore);
  for (let i = 0; i < 26; i++) {
    const u = b.r(0, 1);
    if (Math.abs(u - 0.5) < 0.12) continue;
    pine(b, u, G.shore + 0.004, b.r(0.03, 0.07), [76, 82, 128]);
  }
  // the lake: the sky mirrored, darker toward the shore of the picture
  const c = b.ctx;
  c.fillStyle = b.vgrad(G.shore, 1, [246, 214, 200], [92, 104, 156]);
  c.fillRect(0, b.Y(G.shore), b.w, b.Y(1 - G.shore));
  c.save();
  c.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    const u = b.r(0, 1);
    if (Math.abs(u - 0.5) < 0.12) continue;
    c.fillStyle = rgba([90, 96, 140]);
    const hgt = b.r(0.02, 0.05);
    c.beginPath();
    c.moveTo(b.X(u), b.Y(G.shore + hgt));
    c.lineTo(b.X(u - 0.01), b.Y(G.shore));
    c.lineTo(b.X(u + 0.01), b.Y(G.shore));
    c.closePath();
    c.fill();
  }
  c.restore();
  b.shimmer(G.shore + 0.005, 0.95, 140, [255, 236, 210], 0.8, G.sun.x, 0.06);
  b.mist(G.shore + 0.02, 0.02, [255, 240, 236], 0.55);
  b.mist(0.66, 0.025, [236, 220, 236], 0.35);
  // the jetty
  b.poly(G.jetty, b.vgrad(0.7, 1, [168, 128, 100], [96, 70, 56]));
  c.strokeStyle = rgba([70, 50, 40], 0.7);
  c.lineWidth = Math.max(1, b.S(0.003));
  for (let i = 1; i < 14; i++) {
    const k = i / 14, v = 1 - k * 0.3;
    const uL = 0.06 + (0.41 - 0.06) * k, uR = 0.26 + (0.47 - 0.26) * k;
    c.beginPath();
    c.moveTo(b.X(uL), b.Y(v));
    c.lineTo(b.X(uR), b.Y(v));
    c.stroke();
  }
  c.fillStyle = rgba([70, 52, 44]);
  for (const [u, v] of [[0.1, 0.96], [0.25, 0.96], [0.3, 0.84], [0.41, 0.76], [0.45, 0.72]] as const) c.fillRect(b.X(u), b.Y(v), b.S(0.008), b.Y(0.04));
  // reeds
  c.strokeStyle = rgba([60, 60, 70]);
  c.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const u = b.r(0.72, 1), base = b.r(0.9, 1.01);
    c.lineWidth = Math.max(1, b.S(0.003));
    c.beginPath();
    c.moveTo(b.X(u), b.Y(base));
    c.quadraticCurveTo(b.X(u + b.r(-0.01, 0.02)), b.Y(base - 0.08), b.X(u + b.r(-0.02, 0.03)), b.Y(base - b.r(0.1, 0.2)));
    c.stroke();
  }
}

function odwazny(b: Brush): void {
  const G = ODWAZNY;
  b.sky([[0, [36, 52, 72]], [0.35, [68, 96, 116]], [0.66, [126, 152, 160]]]);
  b.cloud(0.25, 0.12, 0.3, 0.08, [110, 126, 140], [50, 62, 80], 9);
  b.cloud(0.85, 0.2, 0.25, 0.07, [116, 132, 146], [54, 66, 84], 8);
  b.poly(G.light, b.vgrad(0.06, 0.68, [255, 236, 170], [255, 220, 150]));
  const c = b.ctx;
  c.save();
  c.globalAlpha = 0.5;
  b.poly(G.light, b.vgrad(0.06, 0.68, [255, 250, 220], [255, 230, 170]));
  c.restore();
  b.glow(0.61, 0.06, 0.2, [255, 240, 200], 0.6);
  b.ridge(G.sea, [56, 120, 128], [22, 58, 76]);
  b.texture(120, r => { const u = r(); return [u, G.sea(u) + 0.02 + r() * 0.3]; }, [180, 230, 230], 0.35, 0.03);
  // the great wave: its body, its glassy face, its foam
  b.poly(G.wave, b.vgrad(0.36, 0.86, [130, 210, 210], [24, 86, 100]));
  c.save();
  c.beginPath();
  G.wave.forEach(([u, v], i) => (i ? c.lineTo(b.X(u), b.Y(v)) : c.moveTo(b.X(u), b.Y(v))));
  c.closePath();
  c.clip();
  b.glow(0.8, 0.48, 0.18, [200, 255, 250], 0.3);
  b.texture(90, r => [0.5 + r() * 0.5, 0.4 + r() * 0.45], [220, 255, 250], 0.35, 0.04);
  c.restore();
  c.fillStyle = rgba([250, 255, 255]);
  for (let i = 0; i < 36; i++) {
    const k = i / 35;
    const u = 0.66 + k * 0.33, v = 0.38 + Math.sin(k * Math.PI) * -0.03 + (k < 0.2 ? (0.2 - k) * 0.4 : 0);
    c.beginPath();
    c.arc(b.X(u), b.Y(v), b.S(b.r(0.008, 0.018)), 0, TAU);
    c.fill();
  }
  b.stars(60, r => [0.44 + r() * 0.2, 0.55 + r() * 0.18], [255, 255, 255], 0.003);
  // the rock and the one standing on it
  b.poly(G.rock, b.vgrad(0.66, 1, [70, 70, 80], [30, 30, 40]));
  b.texture(60, r => { const u = r() * 0.5, v = 0.7 + r() * 0.3; return inPolygon(u, v, G.rock) ? [u, v] : null; }, [120, 120, 130], 0.5, 0.02);
  b.glow(G.figure.x, G.figure.feet - G.figure.h * 0.6, 0.16, [255, 230, 170], 0.3);
  b.figure(G.figure.x, G.figure.feet, G.figure.h, STAND, { body: [28, 30, 40], rim: [255, 226, 160], from: 1, cloth: [150, 44, 46] });
}

function nowy(b: Brush): void {
  const G = NOWY;
  b.sky([[0, [106, 166, 230]], [0.34, [198, 224, 240]], [0.56, [255, 240, 204]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 236, 160], [255, 220, 140], 20, 4.5);
  b.ridge(u => G.surface(u) - 0.05 + 0.02 * Math.sin(u * 5), [150, 196, 140], [130, 176, 120], G.surface(0.5));
  // the soil in layers, with stones and roots
  const c = b.ctx;
  b.ridge(G.surface, [120, 84, 58], [60, 40, 30]);
  for (const [v, col] of [[0.66, [104, 70, 48]], [0.76, [86, 58, 40]], [0.88, [70, 46, 34]]] as const) {
    c.fillStyle = rgba(col, 0.6);
    c.beginPath();
    c.moveTo(0, b.Y(v));
    for (let i = 0; i <= 30; i++) c.lineTo(b.X(i / 30), b.Y(v + 0.012 * Math.sin(i * 1.3 + v * 20)));
    c.lineTo(b.w, b.h);
    c.lineTo(0, b.h);
    c.closePath();
    c.fill();
  }
  for (let i = 0; i < 22; i++) {
    const u = b.r(0, 1), v = b.r(G.surface(0.5) + 0.04, 0.98);
    if (Math.abs(u - 0.5) < 0.08 && v < 0.86) continue;
    c.fillStyle = b.vgrad(v - 0.02, v + 0.02, [176, 166, 156], [110, 100, 96]);
    c.beginPath();
    c.ellipse(b.X(u), b.Y(v), b.S(b.r(0.012, 0.03)), b.S(b.r(0.008, 0.018)), b.r(-0.4, 0.4), 0, TAU);
    c.fill();
  }
  b.texture(160, r => [r(), G.surface(0.5) + 0.02 + r() * 0.44], [40, 26, 20], 0.5, 0.015);
  // the seed, its roots, and the shoot breaking through
  c.strokeStyle = rgba([236, 220, 190], 0.85);
  c.lineWidth = Math.max(1, b.S(0.0035));
  c.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = b.r(0.3, 2.8);
    c.beginPath();
    c.moveTo(b.X(G.seed.x), b.Y(G.seed.y + 0.02));
    c.quadraticCurveTo(b.X(G.seed.x + Math.cos(a) * 0.05), b.Y(G.seed.y + 0.06), b.X(G.seed.x + Math.cos(a) * 0.12), b.Y(G.seed.y + 0.06 + Math.sin(a) * 0.08));
    c.stroke();
  }
  c.fillStyle = b.vgrad(G.seed.y - G.seed.ry, G.seed.y + G.seed.ry, [214, 170, 110], [140, 96, 54]);
  c.beginPath();
  c.ellipse(b.X(G.seed.x), b.Y(G.seed.y), b.S(G.seed.rx), b.S(G.seed.ry), -0.3, 0, TAU);
  c.fill();
  c.strokeStyle = rgba([80, 170, 70]);
  c.lineWidth = b.S(0.014);
  c.beginPath();
  c.moveTo(b.X(G.seed.x), b.Y(G.seed.y - 0.02));
  c.bezierCurveTo(b.X(0.47), b.Y(0.68), b.X(0.53), b.Y(0.55), b.X(G.shoot.x), b.Y(0.4));
  c.stroke();
  b.glow(G.shoot.x, 0.42, 0.14, [220, 255, 170], 0.3);
  for (const [s, rot] of [[-1, -0.5], [1, 0.4]] as const) {
    c.fillStyle = b.hgrad(G.shoot.x, G.shoot.x + s * 0.12, [90, 190, 70], [170, 230, 110]);
    c.beginPath();
    c.moveTo(b.X(G.shoot.x), b.Y(0.41));
    c.quadraticCurveTo(b.X(G.shoot.x + s * 0.05), b.Y(0.33 + rot * 0.02), b.X(G.shoot.x + s * 0.12), b.Y(0.35 + rot * 0.03));
    c.quadraticCurveTo(b.X(G.shoot.x + s * 0.06), b.Y(0.42), b.X(G.shoot.x), b.Y(0.41));
    c.fill();
  }
  b.stars(1, () => [G.shoot.x + 0.075, 0.355], [255, 255, 255], 0.006);
  b.grass(G.surface, 140, [[90, 160, 80], [130, 190, 90], [70, 130, 60]], 0.03, 0.005, 0, 1, 0.2);
}

function zwyciezca(b: Brush): void {
  const G = ZWYCIEZCA;
  b.sky([[0, [26, 34, 86]], [0.28, [86, 76, 148]], [0.47, [236, 146, 132]], [0.57, [255, 214, 156]]]);
  b.stars(40, r => [r(), r() * 0.25], [255, 250, 240], 0.002);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 230, 160], [255, 186, 130], 26, 7);
  for (const [u, s] of [[0.12, 0.08], [0.85, 0.1], [0.3, 0.05]] as const) {
    b.poly([[u - s, G.clouds(u) + 0.01], [u, G.clouds(u) - s * 0.9], [u + s * 0.8, G.clouds(u) + 0.01]], rgba([90, 70, 120]));
  }
  // the sea of clouds
  b.ridge(G.clouds, [255, 196, 190], [170, 130, 186]);
  for (let i = 0; i < 26; i++) {
    const u = b.r(-0.05, 1.05);
    b.cloud(u, G.clouds(u) + b.r(0.02, 0.2), b.r(0.06, 0.12), b.r(0.02, 0.04), [255, 214, 206], [180, 140, 190], 5);
  }
  b.rimLine(G.clouds, [255, 230, 190], 0.6, 0.004, 0.5, 0.3);
  // the summit and the one on it
  b.ridge(G.summit, [84, 70, 96], [40, 34, 54]);
  b.rimLine(G.summit, [255, 210, 160], 0.75, 0.005, 0.5, 0.2);
  b.texture(70, r => { const u = r(); return [u, G.summit(u) + 0.01 + r() * 0.2]; }, [120, 100, 130], 0.5, 0.02);
  b.glow(G.figure.x, G.figure.feet - G.figure.h * 0.5, 0.18, [255, 220, 170], 0.3);
  b.figure(G.figure.x, G.figure.feet + 0.003, G.figure.h, VICTORY, { body: [30, 24, 44], rim: [255, 216, 160], from: 0 });
}

function swiatlo(b: Brush): void {
  const G = SWIATLO;
  b.sky([[0, [10, 16, 50]], [0.45, [28, 38, 88]], [0.64, [58, 58, 108]]]);
  b.stars(80, r => [r(), r() * 0.5], [255, 250, 230], 0.0022);
  // the moon: a crescent
  const c = b.ctx;
  b.glow(G.moon.x, G.moon.y, 0.12, [220, 230, 255], 0.3);
  c.fillStyle = rgba([246, 244, 226]);
  c.beginPath();
  c.arc(b.X(G.moon.x), b.Y(G.moon.y), b.S(G.moon.r), 0, TAU);
  c.fill();
  c.fillStyle = rgba([16, 22, 62]);
  c.beginPath();
  c.arc(b.X(G.moon.x + G.moon.r * 0.45), b.Y(G.moon.y - G.moon.r * 0.2), b.S(G.moon.r * 0.9), 0, TAU);
  c.fill();
  b.glow(0.5, 0.42, 0.42, [255, 200, 120], 0.35);
  b.ridge(G.hill, [34, 52, 64], [16, 26, 38]);
  // the city along the crest: houses, a tower, windows of gold
  const C = G.city;
  const rows: [number, number, number][] = [];
  for (let u = C.x0; u < C.x1; u += b.r(0.035, 0.055)) rows.push([u, b.r(0.05, 0.1), b.r(0.035, 0.05)]);
  for (const [u, hgt, wid] of rows) {
    const base = G.hill(u + wid / 2) + 0.01;
    const top = Math.max(C.top + 0.08, base - hgt - (Math.abs(u - 0.5) < 0.08 ? 0.04 : 0));
    c.fillStyle = b.vgrad(top, base, [70, 64, 84], [40, 36, 54]);
    c.fillRect(b.X(u), b.Y(top), b.S(wid), b.Y(base - top));
    c.fillStyle = rgba([60, 48, 66]);
    c.beginPath();
    c.moveTo(b.X(u - 0.004), b.Y(top));
    c.lineTo(b.X(u + wid / 2), b.Y(top - 0.025));
    c.lineTo(b.X(u + wid + 0.004), b.Y(top));
    c.closePath();
    c.fill();
    for (let wy = top + 0.012; wy < base - 0.01; wy += 0.022) {
      for (let wx = u + 0.006; wx < u + wid - 0.008; wx += 0.014) {
        if (b.rnd() < 0.3) continue;
        c.fillStyle = rgba(b.rnd() < 0.5 ? [255, 214, 120] : [255, 236, 170]);
        c.fillRect(b.X(wx), b.Y(wy), b.S(0.007), b.Y(0.01));
      }
    }
  }
  // the tower in the middle
  c.fillStyle = b.vgrad(C.top, 0.5, [86, 76, 96], [50, 44, 62]);
  c.fillRect(b.X(0.475), b.Y(C.top), b.S(0.05), b.Y(0.5 - C.top));
  c.beginPath();
  c.moveTo(b.X(0.47), b.Y(C.top));
  c.lineTo(b.X(0.5), b.Y(C.top - 0.05));
  c.lineTo(b.X(0.53), b.Y(C.top));
  c.closePath();
  c.fill();
  c.fillStyle = rgba([255, 226, 150]);
  c.fillRect(b.X(0.492), b.Y(C.top + 0.03), b.S(0.016), b.Y(0.03));
  b.glow(0.5, C.top + 0.04, 0.06, [255, 230, 160], 0.6);
  b.glow(0.5, 0.45, 0.3, [255, 200, 120], 0.22);
  // the light running down the hill, a river below with its reflections
  b.stars(40, r => { const u = 0.25 + r() * 0.5; return [u, G.hill(u) + 0.02 + r() * 0.12]; }, [255, 214, 140], 0.0025);
  c.fillStyle = b.vgrad(G.river.top, G.river.bottom, [40, 50, 90], [24, 30, 64]);
  c.fillRect(0, b.Y(G.river.top), b.w, b.Y(G.river.bottom - G.river.top));
  b.shimmer(G.river.top + 0.005, G.river.bottom - 0.005, 80, [255, 210, 130], 0.7, 0.5, 0.2);
  for (let i = 0; i < 18; i++) b.tree(b.r(0, 1), G.river.top - 0.01, 0.025, [16, 28, 36], [30, 46, 54], [16, 24, 30], G.river.top + 0.01, 1, 5);
}

function dziecko(b: Brush): void {
  const G = DZIECKO;
  b.sky([[0, [104, 166, 234]], [0.45, [186, 218, 246]], [0.63, [255, 226, 174]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 236, 170], [255, 210, 140], 18, 5);
  b.cloud(0.2, 0.3, 0.12, 0.03, [255, 255, 255], [214, 226, 244], 7);
  b.cloud(0.88, 0.38, 0.1, 0.025, [255, 255, 255], [220, 230, 246], 6);
  // the kite: four bright quarters, a tail of bows, the string to the child's hand
  const c = b.ctx, K = G.kite;
  const kx = b.X(K.x), ky = b.Y(K.y), s = b.S(K.s);
  const quads: [RGB, number, number, number, number][] = [
    [[230, 60, 50], 0, -1, -0.7, 0], [[255, 200, 50], 0, -1, 0.7, 0], [[60, 120, 220], -0.7, 0, 0, 1.5], [[255, 140, 60], 0.7, 0, 0, 1.5],
  ];
  for (const [col, ax, ay, bx2, by2] of quads) {
    c.fillStyle = rgba(col);
    c.beginPath();
    c.moveTo(kx, ky);
    c.lineTo(kx + ax * s, ky + ay * s);
    c.lineTo(kx + bx2 * s, ky + by2 * s);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = rgba([255, 255, 255], 0.8);
  c.lineWidth = Math.max(1, b.S(0.003));
  c.beginPath();
  c.moveTo(kx, ky - s);
  c.lineTo(kx, ky + s * 1.5);
  c.moveTo(kx - s * 0.7, ky);
  c.lineTo(kx + s * 0.7, ky);
  c.stroke();
  c.strokeStyle = rgba([80, 80, 110], 0.8);
  c.beginPath();
  c.moveTo(kx, ky + s * 1.5);
  c.bezierCurveTo(kx - s * 0.6, ky + s * 2.4, kx + s * 0.4, ky + s * 3.2, kx - s * 0.3, ky + s * 4);
  c.stroke();
  for (let i = 1; i <= 4; i++) {
    const tx = kx - s * 0.1 * Math.sin(i * 1.4), ty = ky + s * (1.5 + i * 0.6);
    c.fillStyle = rgba(i % 2 ? [230, 60, 50] : [255, 200, 50]);
    c.beginPath();
    c.moveTo(tx, ty);
    c.lineTo(tx - s * 0.18, ty - s * 0.1);
    c.lineTo(tx - s * 0.18, ty + s * 0.1);
    c.closePath();
    c.moveTo(tx, ty);
    c.lineTo(tx + s * 0.18, ty - s * 0.1);
    c.lineTo(tx + s * 0.18, ty + s * 0.1);
    c.closePath();
    c.fill();
  }
  const hand = [G.child.x + 0.07, G.child.feet - G.child.h * 1.02] as const;
  c.strokeStyle = rgba([255, 255, 255], 0.75);
  c.beginPath();
  c.moveTo(kx, ky + s * 0.2);
  c.quadraticCurveTo(b.X(0.56), b.Y(0.5), b.X(hand[0]), b.Y(hand[1]));
  c.stroke();
  // the field
  b.ridge(G.horizon, [150, 200, 110], [90, 160, 70]);
  b.mist(G.horizon(0.8) + 0.01, 0.025, [255, 236, 190], 0.5);
  b.grass(G.horizon, 380, [[110, 170, 80], [150, 200, 90], [80, 140, 70], [200, 220, 120]], 0.035, 0.38, 0, 1, 0.25);
  b.flowers(120, r => { const u = r(), v = G.horizon(u) + 0.02 + r() ** 0.9 * 0.36; return v < 1.01 ? [u, v] : null; },
    [[255, 220, 60], [255, 255, 250], [255, 230, 90]], 0.014, [240, 180, 40]);
  b.glow(G.child.x, G.child.feet - G.child.h * 0.5, 0.12, [255, 236, 190], 0.25);
  b.figure(G.child.x, G.child.feet, G.child.h, CHILD, { body: [60, 52, 80], rim: [255, 226, 170], from: 1 });
}

function blogoslawiony(b: Brush): void {
  const G = BLOGOSLAWIONY;
  b.sky([[0, [112, 132, 166]], [0.3, [176, 192, 210]], [0.52, [236, 232, 206]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 244, 190], [255, 226, 160], 16, 4);
  // the rain, silver and gentle, slanting from the cloud to the fields
  const c = b.ctx;
  c.strokeStyle = rgba([226, 236, 250], 0.55);
  c.lineWidth = Math.max(1, b.S(0.0025));
  c.lineCap = 'round';
  for (let i = 0; i < 160; i++) {
    const u = b.r(G.rain.x0, G.rain.x1), v = b.r(G.cloud.y + 0.06, G.fields(u) + 0.02);
    c.beginPath();
    c.moveTo(b.X(u), b.Y(v));
    c.lineTo(b.X(u - 0.012), b.Y(v + 0.045));
    c.stroke();
  }
  b.cloud(G.cloud.x, G.cloud.y, G.cloud.rx, G.cloud.ry, [176, 186, 204], [96, 106, 130], 10);
  b.cloud(G.cloud.x + 0.12, G.cloud.y - 0.05, G.cloud.rx * 0.6, G.cloud.ry * 0.7, [196, 204, 220], [120, 130, 150], 7);
  // the fields: patchwork bands that roll, gold where the sun reaches
  const bands: [number, RGB, RGB][] = [[0, [140, 176, 96], [110, 150, 80]], [0.06, [214, 190, 96], [180, 150, 70]], [0.13, [110, 160, 80], [80, 130, 64]],
    [0.21, [226, 200, 110], [190, 160, 80]], [0.3, [96, 150, 76], [70, 120, 60]], [0.4, [200, 176, 96], [160, 140, 70]]];
  for (const [dv, top, bot] of bands) b.ridge(u => G.fields(u) + dv + 0.02 * Math.sin(u * 7 + dv * 30), top, bot);
  c.strokeStyle = rgba([60, 90, 50], 0.35);
  c.lineWidth = Math.max(1, b.S(0.002));
  for (let i = 0; i < 30; i++) {
    const v0 = G.fields(0.5) + 0.03 + i * 0.016;
    c.beginPath();
    c.moveTo(b.X(0.55 + i * 0.004), b.Y(v0));
    c.lineTo(b.X(1), b.Y(v0 + 0.05 + i * 0.002));
    c.stroke();
  }
  b.tree(G.tree.x, G.tree.y, G.tree.r, [50, 96, 56], [120, 170, 90], [80, 60, 44], G.tree.y + 0.06, 1, 12);
  b.glow(0.78, 0.66, 0.35, [255, 236, 160], 0.3);
  b.stars(70, r => { const u = G.rain.x0 + r() * (G.rain.x1 - G.rain.x0); return [u, G.fields(u) + r() * 0.05]; }, [235, 245, 255], 0.0025);
}

function madry(b: Brush): void {
  const G = MADRY;
  b.sky([[0, [44, 32, 34]], [0.6, [62, 46, 40]], [1, [36, 26, 24]]]);
  const c = b.ctx;
  // the window onto the night
  const W = G.window;
  c.fillStyle = rgba([86, 66, 54]);
  c.fillRect(b.X(W.x0 - 0.015), b.Y(W.top - 0.015), b.S(W.x1 - W.x0 + 0.03), b.Y(W.bottom - W.top + 0.03));
  c.fillStyle = b.vgrad(W.top, W.bottom, [20, 28, 70], [40, 50, 100]);
  c.fillRect(b.X(W.x0), b.Y(W.top), b.S(W.x1 - W.x0), b.Y(W.bottom - W.top));
  b.stars(24, r => [W.x0 + r() * (W.x1 - W.x0), W.top + r() * (W.bottom - W.top)], [255, 250, 220], 0.002);
  c.fillStyle = rgba([86, 66, 54]);
  c.fillRect(b.X((W.x0 + W.x1) / 2 - 0.006), b.Y(W.top), b.S(0.012), b.Y(W.bottom - W.top));
  c.fillRect(b.X(W.x0), b.Y((W.top + W.bottom) / 2 - 0.005), b.S(W.x1 - W.x0), b.Y(0.01));
  // the shelves of books
  const S = G.shelf;
  for (const v of [S.top + 0.12, S.top + 0.25, S.bottom]) {
    c.fillStyle = rgba([92, 64, 44]);
    c.fillRect(b.X(S.x0), b.Y(v), b.S(1 - S.x0), b.Y(0.012));
    let u = S.x0 + 0.01;
    while (u < 0.98) {
      const wid = b.r(0.014, 0.03), hgt = b.r(0.07, 0.1);
      const cols: RGB[] = [[140, 50, 46], [60, 90, 70], [60, 70, 120], [170, 130, 70], [110, 60, 90], [80, 110, 120]];
      c.fillStyle = rgba(mix(cols[Math.floor(b.rnd() * cols.length)], [40, 30, 30], 0.25));
      c.fillRect(b.X(u), b.Y(v - hgt), b.S(wid), b.Y(hgt));
      c.fillStyle = rgba([255, 220, 150], 0.25);
      c.fillRect(b.X(u + wid * 0.3), b.Y(v - hgt * 0.8), b.S(wid * 0.25), b.Y(0.006));
      u += wid + 0.002;
    }
  }
  // the lamp's light over everything
  b.glow(G.lamp.x, G.lamp.y - 0.06, 0.7, [255, 190, 110], 0.45);
  // the table
  c.fillStyle = b.vgrad(G.table, 1, [150, 98, 58], [80, 50, 32]);
  c.fillRect(0, b.Y(G.table), b.w, b.Y(1 - G.table));
  b.texture(80, r => [r(), G.table + 0.02 + r() * 0.3], [70, 44, 28], 0.5, 0.05);
  // the oil lamp
  const L = G.lamp;
  c.fillStyle = b.hgrad(L.x - 0.06, L.x + 0.06, [150, 100, 40], [240, 196, 110]);
  c.beginPath();
  c.ellipse(b.X(L.x), b.Y(L.y + 0.08), b.S(0.06), b.S(0.022), 0, 0, TAU);
  c.fill();
  c.beginPath();
  c.moveTo(b.X(L.x - 0.02), b.Y(L.y + 0.08));
  c.quadraticCurveTo(b.X(L.x - 0.07), b.Y(L.y + 0.03), b.X(L.x - 0.015), b.Y(L.y));
  c.lineTo(b.X(L.x + 0.015), b.Y(L.y));
  c.quadraticCurveTo(b.X(L.x + 0.07), b.Y(L.y + 0.03), b.X(L.x + 0.02), b.Y(L.y + 0.08));
  c.closePath();
  c.fill();
  b.glow(L.x, L.y - 0.03, 0.08, [255, 236, 170], 0.9);
  c.fillStyle = b.vgrad(L.y - 0.07, L.y - 0.005, [255, 255, 230], [255, 170, 60]);
  c.beginPath();
  c.moveTo(b.X(L.x), b.Y(L.y - 0.075));
  c.quadraticCurveTo(b.X(L.x + 0.02), b.Y(L.y - 0.03), b.X(L.x), b.Y(L.y - 0.005));
  c.quadraticCurveTo(b.X(L.x - 0.02), b.Y(L.y - 0.03), b.X(L.x), b.Y(L.y - 0.075));
  c.fill();
  // the open book: two curved pages, lines of text, a ribbon
  const B = G.book;
  for (const s of [-1, 1]) {
    c.fillStyle = b.hgrad(B.x, B.x + s * B.rx, [236, 222, 190], [255, 246, 222]);
    c.beginPath();
    c.moveTo(b.X(B.x), b.Y(B.y - B.ry * 0.6));
    c.quadraticCurveTo(b.X(B.x + s * B.rx * 0.5), b.Y(B.y - B.ry * 1.3), b.X(B.x + s * B.rx), b.Y(B.y - B.ry * 0.9));
    c.lineTo(b.X(B.x + s * B.rx * 1.02), b.Y(B.y + B.ry * 0.7));
    c.quadraticCurveTo(b.X(B.x + s * B.rx * 0.5), b.Y(B.y + B.ry * 0.3), b.X(B.x), b.Y(B.y + B.ry * 0.9));
    c.closePath();
    c.fill();
    c.strokeStyle = rgba([120, 100, 80], 0.5);
    c.lineWidth = Math.max(1, b.S(0.002));
    for (let i = 0; i < 7; i++) {
      const v = B.y - B.ry * 0.7 + i * B.ry * 0.21;
      c.beginPath();
      c.moveTo(b.X(B.x + s * B.rx * 0.12), b.Y(v));
      c.quadraticCurveTo(b.X(B.x + s * B.rx * 0.5), b.Y(v - B.ry * 0.25), b.X(B.x + s * B.rx * 0.88), b.Y(v - B.ry * 0.05));
      c.stroke();
    }
  }
  c.fillStyle = rgba([170, 40, 40]);
  c.fillRect(b.X(B.x + 0.004), b.Y(B.y + B.ry * 0.5), b.S(0.01), b.Y(0.07));
  b.glow(B.x, B.y - 0.02, 0.2, [255, 220, 160], 0.3);
  // a quill in its inkpot
  c.fillStyle = rgba([30, 30, 40]);
  c.beginPath();
  c.ellipse(b.X(0.13), b.Y(0.72), b.S(0.03), b.S(0.018), 0, 0, TAU);
  c.fill();
  c.strokeStyle = rgba([240, 236, 226]);
  c.lineWidth = b.S(0.006);
  c.beginPath();
  c.moveTo(b.X(0.13), b.Y(0.71));
  c.quadraticCurveTo(b.X(0.1), b.Y(0.62), b.X(0.06), b.Y(0.56));
  c.stroke();
}

function bezpieczny(b: Brush): void {
  const G = BEZPIECZNY;
  b.sky([[0, [34, 36, 84]], [0.35, [86, 76, 140]], [0.62, [230, 150, 124]], [0.8, [255, 200, 150]]]);
  b.stars(24, r => [r(), r() * 0.25], [255, 250, 236], 0.002);
  const c = b.ctx;
  for (let i = 0; i < 6; i++) {
    const v = b.r(0.1, 0.5);
    b.streak(b.r(0, 1), v, b.r(0.14, 0.26), 0.014, [236, 176, 176], [120, 90, 140], 5);
  }
  // the sea below, the rock, the tower
  b.ridge(() => G.sea, [90, 80, 130], [40, 40, 80]);
  b.shimmer(G.sea + 0.01, 0.99, 80, [255, 200, 160], 0.5, 0.75, 0.3);
  b.ridge(G.cliff, [96, 84, 92], [44, 40, 52], G.sea + 0.04);
  b.texture(150, r => { const u = r(); return [u, G.cliff(u) + 0.02 + r() * 0.14]; }, [140, 120, 130], 0.45, 0.025);
  b.rimLine(G.cliff, [255, 196, 150], 0.5, 0.004, 0.75, 0.3);
  const T = G.tower;
  b.glow((T.x0 + T.x1) / 2, (T.top + T.base) / 2, 0.45, [255, 190, 120], 0.22);
  c.fillStyle = b.hgrad(T.x0, T.x1, [96, 80, 86], [176, 140, 120]);
  c.fillRect(b.X(T.x0), b.Y(T.top), b.S(T.x1 - T.x0), b.Y(T.base - T.top));
  // battlements
  for (let i = 0; i < 5; i++) {
    const u = T.x0 - 0.012 + i * ((T.x1 - T.x0 + 0.024) / 5);
    c.fillRect(b.X(u), b.Y(T.top - 0.035), b.S((T.x1 - T.x0 + 0.024) / 5 * 0.62), b.Y(0.04));
  }
  c.fillRect(b.X(T.x0 - 0.012), b.Y(T.top - 0.004), b.S(T.x1 - T.x0 + 0.024), b.Y(0.02));
  c.strokeStyle = rgba([70, 56, 62], 0.55);
  c.lineWidth = Math.max(1, b.S(0.0022));
  for (let v = T.top + 0.03; v < T.base; v += 0.03) {
    c.beginPath();
    c.moveTo(b.X(T.x0), b.Y(v));
    c.lineTo(b.X(T.x1), b.Y(v));
    c.stroke();
  }
  // its windows and door, lit
  const lamp = (u: number, v: number, wid: number, hgt: number) => {
    b.glow(u, v, wid * 3, [255, 200, 120], 0.5);
    c.fillStyle = b.vgrad(v - hgt / 2, v + hgt / 2, [255, 236, 170], [255, 170, 70]);
    c.beginPath();
    c.moveTo(b.X(u - wid / 2), b.Y(v + hgt / 2));
    c.lineTo(b.X(u - wid / 2), b.Y(v - hgt / 2 + wid / 2));
    c.arc(b.X(u), b.Y(v - hgt / 2 + wid / 2), b.S(wid / 2), Math.PI, TAU);
    c.lineTo(b.X(u + wid / 2), b.Y(v + hgt / 2));
    c.closePath();
    c.fill();
  };
  lamp(0.5, 0.31, 0.03, 0.05);
  lamp(0.45, 0.44, 0.024, 0.045);
  lamp(0.555, 0.44, 0.024, 0.045);
  lamp(0.5, 0.56, 0.026, 0.045);
  lamp(0.5, T.base - 0.035, 0.05, 0.07);
  b.beam(0.5, T.base - 0.01, 0.5, T.base + 0.12, 0.05, 0.2, [255, 200, 120], 0.3);
}

function oczyszczony(b: Brush): void {
  const G = OCZYSZCZONY;
  b.sky([[0, [96, 166, 230]], [G.banks, [214, 236, 250]]]);
  b.sun(G.sun.x, G.sun.y, G.sun.r, [255, 250, 210], [255, 240, 190], 16, 4);
  b.cloud(0.4, 0.14, 0.13, 0.03, [255, 255, 255], [220, 232, 246], 7);
  b.ridge(u => G.banks - 0.03 + 0.02 * Math.sin(u * 6 + 1), [120, 170, 120], [96, 150, 100], G.banks + 0.02);
  b.ridge(() => G.banks, [110, 180, 90], [56, 120, 60]);
  // the stream: clear water widening toward us
  const c = b.ctx;
  c.fillStyle = b.vgrad(G.banks, 1, [150, 220, 230], [40, 150, 170]);
  c.beginPath();
  for (let i = 0; i <= 40; i++) { const v = G.banks + (1 - G.banks) * (i / 40); const [l] = G.stream(v); i ? c.lineTo(b.X(l), b.Y(v)) : c.moveTo(b.X(l), b.Y(v)); }
  for (let i = 40; i >= 0; i--) { const v = G.banks + (1 - G.banks) * (i / 40); const [, r] = G.stream(v); c.lineTo(b.X(r), b.Y(v)); }
  c.closePath();
  c.fill();
  c.save();
  c.clip();
  b.shimmer(G.banks, 1, 160, [255, 255, 255], 0.75, 0.5, 0.3);
  c.restore();
  // stones at the edges and the linen on them
  for (let i = 0; i < 24; i++) {
    const v = b.r(G.banks + 0.05, 0.99);
    const [l, r] = G.stream(v);
    const u = b.rnd() < 0.5 ? l + b.r(-0.02, 0.02) : r + b.r(-0.02, 0.02);
    c.fillStyle = b.vgrad(v - 0.02, v + 0.02, [196, 190, 180], [120, 116, 110]);
    c.beginPath();
    c.ellipse(b.X(u), b.Y(v), b.S(b.r(0.015, 0.035)), b.S(b.r(0.01, 0.02)), 0, 0, TAU);
    c.fill();
  }
  for (const [u, v, rx, ry] of G.linen) {
    c.fillStyle = b.vgrad(v - ry, v + ry, [255, 255, 255], [214, 226, 236]);
    c.beginPath();
    c.moveTo(b.X(u - rx), b.Y(v));
    c.quadraticCurveTo(b.X(u - rx * 0.5), b.Y(v - ry * 1.6), b.X(u), b.Y(v - ry * 0.8));
    c.quadraticCurveTo(b.X(u + rx * 0.5), b.Y(v - ry * 1.7), b.X(u + rx), b.Y(v - ry * 0.4));
    c.quadraticCurveTo(b.X(u + rx * 1.1), b.Y(v + ry * 0.8), b.X(u + rx * 0.6), b.Y(v + ry));
    c.quadraticCurveTo(b.X(u), b.Y(v + ry * 0.6), b.X(u - rx * 0.8), b.Y(v + ry * 0.9));
    c.closePath();
    c.fill();
    c.strokeStyle = rgba([190, 206, 220], 0.8);
    c.lineWidth = Math.max(1, b.S(0.003));
    c.beginPath();
    c.moveTo(b.X(u - rx * 0.4), b.Y(v - ry * 0.3));
    c.quadraticCurveTo(b.X(u), b.Y(v + ry * 0.2), b.X(u + rx * 0.5), b.Y(v - ry * 0.1));
    c.stroke();
    b.glow(u, v, rx * 1.4, [255, 255, 255], 0.25);
  }
  // the willow on the bank
  const W = G.willow;
  c.strokeStyle = rgba([90, 70, 50]);
  c.lineWidth = b.S(0.02);
  c.beginPath();
  c.moveTo(b.X(W.x - 0.02), b.Y(G.banks + 0.04));
  c.quadraticCurveTo(b.X(W.x - 0.03), b.Y(W.y + 0.05), b.X(W.x), b.Y(W.y - 0.02));
  c.stroke();
  b.tree(W.x, W.y, W.r * 0.7, [70, 120, 60], [150, 200, 100], [90, 70, 50], W.y, 1, 12);
  c.lineWidth = Math.max(1, b.S(0.003));
  for (let i = 0; i < 60; i++) {
    const u = W.x + b.r(-W.r, W.r), v0 = W.y + b.r(-0.03, 0.04);
    c.strokeStyle = rgba(mix([80, 140, 60], [170, 210, 110], b.rnd()), 0.85);
    c.beginPath();
    c.moveTo(b.X(u), b.Y(v0));
    c.quadraticCurveTo(b.X(u + 0.005), b.Y(v0 + 0.06), b.X(u + b.r(-0.01, 0.01)), b.Y(v0 + b.r(0.08, 0.16)));
    c.stroke();
  }
  b.grass(() => G.banks + 0.01, 160, [[90, 160, 80], [130, 190, 90]], 0.025, 0.5, 0, 1, 0.2);
  b.flowers(50, r => { const v = G.banks + 0.03 + r() * 0.5; const [l, rr] = G.stream(v); const u = r(); return u > l - 0.03 && u < rr + 0.03 ? null : [u, v]; },
    [[255, 255, 250], [255, 220, 100], [190, 160, 255]], 0.011);
}

function wybrany(b: Brush): void {
  const G = WYBRANY;
  b.sky([[0, [18, 26, 66]], [0.32, [58, 66, 118]], [1, [30, 32, 60]]]);
  b.stars(30, r => [0.3 + r() * 0.4, r() * 0.25], [255, 250, 236], 0.002);
  const c = b.ctx;
  // the street's houses in perspective, a few windows lit
  b.poly(G.left, b.hgrad(0, 0.3, [40, 44, 74], [70, 66, 96]));
  b.poly(G.right, b.hgrad(0.7, 1, [70, 66, 96], [40, 44, 74]));
  c.fillStyle = b.vgrad(0.3, G.street, [76, 66, 90], [56, 50, 72]);
  c.fillRect(b.X(0.3), b.Y(0.3), b.S(0.4), b.Y(G.street - 0.3));
  c.fillStyle = rgba([50, 42, 60]);
  c.beginPath();
  c.moveTo(b.X(0.28), b.Y(0.31));
  c.lineTo(b.X(0.5), b.Y(0.2));
  c.lineTo(b.X(0.72), b.Y(0.31));
  c.closePath();
  c.fill();
  const win = (pts: [number, number][], lit: boolean) => {
    if (lit) b.glow((pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2, 0.06, [255, 200, 120], 0.35);
    b.poly(pts, lit ? rgba([255, 214, 140]) : rgba([30, 34, 58]));
  };
  win([[0.06, 0.32], [0.14, 0.36], [0.14, 0.44], [0.06, 0.41]], true);
  win([[0.18, 0.38], [0.25, 0.41], [0.25, 0.48], [0.18, 0.46]], false);
  win([[0.18, 0.56], [0.25, 0.58], [0.25, 0.65], [0.18, 0.64]], true);
  win([[0.94, 0.32], [0.86, 0.36], [0.86, 0.44], [0.94, 0.41]], false);
  win([[0.82, 0.38], [0.75, 0.41], [0.75, 0.48], [0.82, 0.46]], true);
  win([[0.36, 0.38], [0.41, 0.38], [0.41, 0.44], [0.36, 0.44]], false);
  win([[0.59, 0.38], [0.64, 0.38], [0.64, 0.44], [0.59, 0.44]], true);
  // the cobbled street
  c.fillStyle = b.vgrad(G.street, 1, [40, 40, 60], [24, 24, 40]);
  b.poly([[0.3, G.street], [0.7, G.street], [1, 1], [0, 1]], c.fillStyle);
  for (let row = 0; row < 14; row++) {
    const v = G.street + (1 - G.street) * ((row + 0.5) / 14) ** 1.2;
    const spread = 0.2 + (v - G.street) * 1.1;
    for (let i = 0; i < 12; i++) {
      const u = 0.5 + (i / 11 - 0.5) * spread * 2 + (row % 2 ? 0.01 : 0);
      c.fillStyle = rgba([70, 66, 86], 0.8);
      c.beginPath();
      c.ellipse(b.X(u), b.Y(v), b.S(0.012 + (v - G.street) * 0.04), b.S(0.004 + (v - G.street) * 0.012), 0, 0, TAU);
      c.fill();
    }
  }
  // the light spilling from the open door
  b.poly(G.spill, b.vgrad(G.door.bottom, 1, [255, 214, 140], [255, 190, 110]));
  c.save();
  c.globalAlpha = 0.6;
  b.poly(G.spill, b.vgrad(G.door.bottom, 1, [255, 236, 180], [120, 90, 70]));
  c.restore();
  const D = G.door, dm = (D.x0 + D.x1) / 2;
  b.glow(dm, (D.top + D.bottom) / 2, 0.3, [255, 200, 120], 0.45);
  c.fillStyle = rgba([60, 44, 40]);
  c.beginPath();
  c.moveTo(b.X(D.x0 - 0.02), b.Y(D.bottom));
  c.lineTo(b.X(D.x0 - 0.02), b.Y(D.top + 0.02));
  c.arc(b.X(dm), b.Y(D.top + 0.02), b.S((D.x1 - D.x0) / 2 + 0.02), Math.PI, TAU);
  c.lineTo(b.X(D.x1 + 0.02), b.Y(D.bottom));
  c.closePath();
  c.fill();
  c.fillStyle = b.vgrad(D.top, D.bottom, [255, 248, 210], [255, 196, 110]);
  c.beginPath();
  c.moveTo(b.X(D.x0), b.Y(D.bottom));
  c.lineTo(b.X(D.x0), b.Y(D.top + 0.02));
  c.arc(b.X(dm), b.Y(D.top + 0.02), b.S((D.x1 - D.x0) / 2), Math.PI, TAU);
  c.lineTo(b.X(D.x1), b.Y(D.bottom));
  c.closePath();
  c.fill();
  // the door leaf swung inward, and flowers by the step
  b.poly([[D.x1, D.top + 0.02], [D.x1 - 0.03, D.top + 0.04], [D.x1 - 0.03, D.bottom - 0.01], [D.x1, D.bottom]], rgba([110, 70, 50]));
  for (const u of [D.x0 - 0.05, D.x1 + 0.05]) {
    c.fillStyle = rgba([150, 80, 60]);
    c.fillRect(b.X(u - 0.02), b.Y(D.bottom - 0.03), b.S(0.04), b.Y(0.03));
    b.flowers(7, r => [u + (r() - 0.5) * 0.05, D.bottom - 0.035 - r() * 0.03], [[230, 60, 70], [255, 200, 90], [255, 120, 140]], 0.012);
  }
}

const PAINTERS: Readonly<Record<DeclId, (b: Brush) => void>> = {
  zdrowy, uzdrowiony, silny, szczesliwy, bogaty, wolny, kochany, spokojny, odwazny,
  nowy, zwyciezca, swiatlo, dziecko, blogoslawiony, madry, bezpieczny, oczyszczony, wybrany,
};

/** Paint a declaration's picture into a w × h canvas (its own unit square stretched over it). */
export function paintPicture(id: DeclId, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  PAINTERS[id](new Brush(ctx, w, h, 7919 + id.length * 104729 + id.charCodeAt(0) * 31));
  ctx.restore();
}

