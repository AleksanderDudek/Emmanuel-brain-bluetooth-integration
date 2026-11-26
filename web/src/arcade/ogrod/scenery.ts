/**
 * The garden's still picture (DESIGN.md §23), canvas 2D: everything of the walled garden that does not move with the
 * player's acts, drawn every frame in world units (world.ts) from shapes built once — so the colours follow the sky's
 * dawn (paint.ts ramps) without any baked texture, and a phone keeps its memory:
 *
 *   the sky      a gradient from indigo night through the blue hour and rose to gold; stars that fade; a moon that
 *                sets behind the wall; the sun that rises over it, behind the olive, with slow rays through its leaves
 *   beyond       two lines of hills and dark cypresses beyond the wall (parallax 0.5)
 *   the garden   the lawn; the old stone wall with its courses, coping and ivy, the arched gate's frame; the olive with
 *                its silver leaves; bushes along the wall; the lantern path's stones; the raised bed; the stone bench
 *   the pond     an oval of water in a ring of stones: the sky, the wall and the olive reflected (flipped, darkened),
 *                the moon's or the sun's path on the water, lily pads, two water lilies that open at dawn, drifting
 *                ripples
 *   the air      mist over the water at night, fireflies, the dew sparkling at dawn, birds crossing the morning sky,
 *                dark leaves in the near corners
 *
 * Reduced motion: nothing drifts — the mist, the fireflies and the ripples stand still, the stars do not twinkle.
 */
import { BED, BENCH, GATE, HORIZON, OLIVE, POND, VESSEL, WALL, WORLD_W, pathAt } from './world';
import { TAU, glow, glowSprite, hash, pal, rgba, type Canvas2D, type Ramp } from './paint';

/** Where the world is drawn: px per unit, the camera's world point at the view's middle, the view's middle on screen. */
export interface Cam { s: number; x: number; y: number; vx: number; vy: number }

interface Sprites { warm: Canvas2D | null; white: Canvas2D | null; cool: Canvas2D | null; gold: Canvas2D | null; fly: Canvas2D | null; rose: Canvas2D | null; sun: Canvas2D | null }

const clampU = (u: number): number => Math.max(0, Math.min(1, u));

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Scenery {
  readonly sprites: Sprites;
  private readonly p: Record<string, Path2D> = {};
  private readonly stars: { x: number; y: number; r: number; ph: number }[] = [];
  private readonly flies: { x: number; y: number; ph: number; sp: number; rx: number; ry: number }[] = [];
  private readonly dew: { x: number; y: number; ph: number }[] = [];
  private readonly mist: { x: number; y: number; w: number; h: number; sp: number; ph: number }[] = [];
  private ready = false;

  constructor(private readonly reduced: boolean) {
    this.sprites = {
      warm: glowSprite('#ffcf8a'), white: glowSprite('#fff8ea'), cool: glowSprite('#cfe0ff'), gold: glowSprite('#ffe2a0'),
      fly: glowSprite('#e4ff9e', 64), rose: glowSprite('#ffb8b0'), sun: glowSprite('#fff0c8', 256),
    };
    for (let i = 0; i < 170; i++) this.stars.push({ x: hash(i * 3 + 1), y: hash(i * 7 + 2) ** 1.5 * 0.42, r: 0.4 + 1.3 * hash(i * 11 + 3) ** 3, ph: hash(i + 99) * TAU });
    for (let i = 0; i < 22; i++) {
      const x = 0.15 + (WORLD_W - 0.3) * hash(i * 5 + 400);
      this.flies.push({ x, y: 0.5 + 0.32 * hash(i * 9 + 401), ph: hash(i + 402) * TAU, sp: 0.3 + 0.4 * hash(i + 403), rx: 0.03 + 0.05 * hash(i + 404), ry: 0.015 + 0.03 * hash(i + 405) });
    }
    for (let i = 0; i < 70; i++) this.dew.push({ x: -0.1 + (WORLD_W + 0.2) * hash(i * 13 + 500), y: 0.58 + 0.38 * hash(i * 17 + 501), ph: hash(i + 502) * TAU });
    for (let i = 0; i < 9; i++) this.mist.push({ x: POND.x - 0.6 + 1.2 * hash(i + 600), y: POND.y - 0.03 + 0.06 * hash(i + 601), w: 0.25 + 0.25 * hash(i + 602), h: 0.035 + 0.03 * hash(i + 603), sp: 0.004 + 0.008 * hash(i + 604), ph: hash(i + 605) });
  }

  // ── the shapes, built once in world units ───────────────────────

  private build(): void {
    if (this.ready || typeof Path2D === 'undefined') return;
    this.ready = true;
    const P = this.p;
    // hills beyond the wall: two lines, the far one paler
    const hills = (base: number, amp: number, seed: number): Path2D => {
      const p = new Path2D();
      p.moveTo(-2, 0.7);
      for (let i = 0; i <= 120; i++) {
        const x = -2 + ((WORLD_W + 4) * i) / 120;
        const y = base - amp * (0.55 * Math.sin(x * 2.1 + seed) + 0.3 * Math.sin(x * 5.3 + seed * 2) + 0.15 * Math.sin(x * 11 + seed));
        p.lineTo(x, y);
      }
      p.lineTo(WORLD_W + 2, 0.7);
      p.closePath();
      return p;
    };
    P.hills = hills(HORIZON - 0.075, 0.03, 1.3);
    P.hillsNear = hills(HORIZON - 0.035, 0.022, 4.1);
    // cypresses and round trees beyond the wall
    const cy = new Path2D();
    for (let i = 0; i < 26; i++) {
      const x = -1.2 + (WORLD_W + 2.4) * hash(i * 31 + 7);
      const h = 0.09 + 0.12 * hash(i * 37 + 8), wd = 0.016 + 0.014 * hash(i * 41 + 9), b = WALL.top + 0.03;
      if (hash(i * 43 + 10) < 0.7) {
        cy.moveTo(x, b);
        cy.bezierCurveTo(x - wd, b - h * 0.3, x - wd * 0.8, b - h * 0.75, x, b - h);
        cy.bezierCurveTo(x + wd * 0.8, b - h * 0.75, x + wd, b - h * 0.3, x, b);
      } else {
        // an umbrella pine: a flat, wide crown on a thin trunk
        const r = 0.025 + 0.02 * hash(i * 47 + 11), th = 0.05 + 0.04 * hash(i * 53 + 12);
        cy.rect(x - 0.002, b - th, 0.004, th);
        for (let q = -1; q <= 1; q++) {
          cy.moveTo(x + q * r * 0.7 + r, b - th - 0.004 * Math.abs(q));
          cy.ellipse(x + q * r * 0.7, b - th - 0.004 * Math.abs(q), r, r * 0.38, 0, 0, TAU);
        }
      }
    }
    P.cypress = cy;
    // the wall: one long body, rising round the gate; the arch an opening (even-odd)
    const g = GATE, a = g.w / 2 - 0.02, spring = 0.45;
    const wall = new Path2D();
    wall.moveTo(-2, WALL.top);
    wall.lineTo(g.x - 0.2, WALL.top);
    wall.bezierCurveTo(g.x - 0.14, WALL.top, g.x - 0.1, g.top - 0.02, g.x, g.top - 0.025);
    wall.bezierCurveTo(g.x + 0.1, g.top - 0.02, g.x + 0.14, WALL.top, g.x + 0.2, WALL.top);
    wall.lineTo(WORLD_W + 2, WALL.top);
    wall.lineTo(WORLD_W + 2, WALL.base);
    wall.lineTo(-2, WALL.base);
    wall.closePath();
    const arch = new Path2D();
    arch.moveTo(g.x - a, WALL.base);
    arch.lineTo(g.x - a, spring);
    arch.arc(g.x, spring, a, Math.PI, 0);
    arch.lineTo(g.x + a, WALL.base);
    arch.closePath();
    wall.addPath(arch);
    P.wall = wall;
    P.arch = arch;
    // the stones' courses and joints, and lighter and darker faces
    const joints = new Path2D(), faceL = new Path2D(), faceD = new Path2D();
    let row = 0;
    for (let y = WALL.top + 0.018; y < WALL.base - 0.005; y += 0.03, row++) {
      joints.moveTo(-2, y);
      joints.lineTo(WORLD_W + 2, y);
      let x = -2 + 0.04 * hash(row * 3 + 1);
      let k = 0;
      while (x < WORLD_W + 2) {
        const wdt = 0.055 + 0.05 * hash(row * 97 + k * 13 + 5);
        const inArch = Math.abs(x - g.x) < a + 0.01 && y > spring - a;
        if (!inArch) {
          joints.moveTo(x, y);
          joints.lineTo(x, Math.min(WALL.base, y + 0.03));
          const v = hash(row * 131 + k * 17 + 3);
          if (v < 0.22) faceL.rect(x + 0.003, y + 0.003, wdt - 0.006, 0.024);
          else if (v > 0.8) faceD.rect(x + 0.003, y + 0.003, wdt - 0.006, 0.024);
        }
        x += wdt;
        k++;
      }
    }
    P.joints = joints;
    P.faceL = faceL;
    P.faceD = faceD;
    const coping = new Path2D();
    coping.rect(-2, WALL.top - 0.012, g.x - 0.2 + 2, 0.02);
    coping.rect(g.x + 0.2, WALL.top - 0.012, WORLD_W + 2 - g.x - 0.2, 0.02);
    coping.moveTo(g.x - 0.2, WALL.top - 0.012);
    coping.bezierCurveTo(g.x - 0.14, WALL.top - 0.012, g.x - 0.1, g.top - 0.032, g.x, g.top - 0.037);
    coping.bezierCurveTo(g.x + 0.1, g.top - 0.032, g.x + 0.14, WALL.top - 0.012, g.x + 0.2, WALL.top - 0.012);
    coping.lineTo(g.x + 0.2, WALL.top + 0.008);
    coping.bezierCurveTo(g.x + 0.14, WALL.top + 0.008, g.x + 0.1, g.top - 0.012, g.x, g.top - 0.017);
    coping.bezierCurveTo(g.x - 0.1, g.top - 0.012, g.x - 0.14, WALL.top + 0.008, g.x - 0.2, WALL.top + 0.008);
    coping.closePath();
    P.coping = coping;
    // the arch's voussoirs (a ring of stones round the opening)
    const ring = new Path2D();
    ring.arc(g.x, spring, a + 0.022, Math.PI, 0);
    ring.lineTo(g.x + a, spring);
    ring.arc(g.x, spring, a, 0, Math.PI, true);
    ring.closePath();
    P.archRing = ring;
    const ringJ = new Path2D();
    for (let i = 0; i <= 9; i++) {
      const an = Math.PI + (i / 9) * Math.PI;
      ringJ.moveTo(g.x + Math.cos(an) * a, spring + Math.sin(an) * a);
      ringJ.lineTo(g.x + Math.cos(an) * (a + 0.022), spring + Math.sin(an) * (a + 0.022));
    }
    P.archJ = ringJ;
    // ivy draping over the coping in patches: a dense cap of leaves, strands hanging from it (never over the gate)
    const ivy = new Path2D(), ivyHi = new Path2D();
    const leafAt = (path: Path2D, x: number, y: number, L: number, an: number): void => {
      const c = Math.cos(an), s2 = Math.sin(an);
      const tx = x + c * L, ty = y + s2 * L;
      const nx = -s2 * L * 0.42, ny = c * L * 0.42;
      path.moveTo(x, y);
      path.quadraticCurveTo(x + c * L * 0.5 + nx, y + s2 * L * 0.5 + ny, tx, ty);
      path.quadraticCurveTo(x + c * L * 0.5 - nx, y + s2 * L * 0.5 - ny, x, y);
    };
    const patches: [number, number][] = [[-0.3, 0.32], [0.14, 0.22], [1.0, 0.3], [1.62, 0.26], [2.56, 0.22], [2.98, 0.36], [3.4, 0.3]];
    let n = 0;
    for (const [x0, wdt] of patches) {
      // the cap over the coping, thickest in the patch's middle
      for (let i = 0; i < Math.round(wdt * 420); i++, n++) {
        const u = hash(n * 7 + 1), x = x0 + wdt * u;
        if (Math.abs(x - g.x) < a + 0.05) continue;
        const thick = Math.sin(Math.PI * u);
        const y = WALL.top - 0.016 + (0.012 + 0.03 * thick) * hash(n * 11 + 2);
        const L = 0.008 + 0.007 * hash(n * 13 + 3);
        const an = -Math.PI / 2 + (hash(n * 17 + 4) - 0.5) * 2.6;
        leafAt(hash(n * 19 + 5) < 0.3 ? ivyHi : ivy, x, y, L, an);
      }
      // strands hanging down, leaves smaller toward the tip
      const strands = Math.round(wdt * 26);
      for (let k = 0; k < strands; k++, n++) {
        const sx = x0 + wdt * (0.08 + 0.84 * hash(n * 23 + 6));
        if (Math.abs(sx - g.x) < a + 0.05) continue;
        const len = (0.04 + 0.13 * hash(n * 29 + 7) ** 1.3) * (0.5 + 0.5 * Math.sin(Math.PI * (sx - x0) / wdt));
        for (let y = WALL.top + 0.01; y < WALL.top + 0.01 + len; y += 0.0085, n++) {
          const tip = (y - WALL.top) / Math.max(0.01, len);
          const lx = sx + 0.01 * Math.sin(y * 55 + k);
          const L = (0.0095 - 0.004 * tip) * (0.8 + 0.4 * hash(n * 31 + 8));
          const side = hash(n * 37 + 9) < 0.5 ? -1 : 1;
          leafAt(hash(n * 41 + 10) < 0.28 ? ivyHi : ivy, lx, y, L, Math.PI / 2 + side * (0.6 + 0.7 * hash(n * 43 + 11)));
        }
      }
    }
    P.ivy = ivy;
    P.ivyHi = ivyHi;
    // the olive: a gnarled trunk in strands, branches, a canopy in soft clumps (shadow, body, light) with silver leaves
    const o = OLIVE;
    const trunk = new Path2D();
    trunk.moveTo(o.x - 0.06, o.base + 0.004);
    trunk.bezierCurveTo(o.x - 0.025, o.base - 0.06, o.x - 0.065, o.base - 0.13, o.x - 0.03, o.base - 0.2);
    trunk.bezierCurveTo(o.x - 0.07, o.base - 0.25, o.x - 0.12, o.base - 0.27, o.x - 0.17, o.base - 0.3);
    trunk.lineTo(o.x - 0.16, o.base - 0.312);
    trunk.bezierCurveTo(o.x - 0.11, o.base - 0.29, o.x - 0.05, o.base - 0.27, o.x - 0.012, o.base - 0.235);
    trunk.bezierCurveTo(o.x - 0.005, o.base - 0.28, o.x - 0.025, o.base - 0.32, o.x + 0.005, o.base - 0.36);
    trunk.lineTo(o.x + 0.018, o.base - 0.355);
    trunk.bezierCurveTo(o.x + 0.006, o.base - 0.31, o.x + 0.026, o.base - 0.27, o.x + 0.028, o.base - 0.235);
    trunk.bezierCurveTo(o.x + 0.07, o.base - 0.27, o.x + 0.12, o.base - 0.29, o.x + 0.165, o.base - 0.305);
    trunk.lineTo(o.x + 0.168, o.base - 0.292);
    trunk.bezierCurveTo(o.x + 0.11, o.base - 0.27, o.x + 0.06, o.base - 0.21, o.x + 0.04, o.base - 0.14);
    trunk.bezierCurveTo(o.x + 0.025, o.base - 0.08, o.x + 0.055, o.base - 0.03, o.x + 0.075, o.base + 0.004);
    trunk.closePath();
    P.trunk = trunk;
    // the trunk's bark: a few long furrows
    const bark = new Path2D();
    for (let i = 0; i < 5; i++) {
      const x = o.x - 0.035 + i * 0.017;
      bark.moveTo(x, o.base);
      bark.bezierCurveTo(x + 0.01 * Math.sin(i), o.base - 0.06, x - 0.012, o.base - 0.12, x + 0.004, o.base - 0.19 - 0.02 * hash(i));
    }
    P.bark = bark;
    const shade = new Path2D(), body = new Path2D(), lite = new Path2D(), silver = new Path2D();
    const clumps: [number, number, number, number][] = [
      [-0.2, 0.3, 0.075, 0.05], [-0.12, 0.235, 0.085, 0.058], [-0.02, 0.19, 0.095, 0.062], [0.1, 0.215, 0.09, 0.058], [0.2, 0.285, 0.075, 0.05],
      [-0.06, 0.29, 0.08, 0.05], [0.07, 0.295, 0.08, 0.05], [-0.27, 0.35, 0.05, 0.032], [0.27, 0.345, 0.052, 0.032], [0.03, 0.13, 0.065, 0.045],
      [-0.15, 0.17, 0.05, 0.035], [0.17, 0.16, 0.05, 0.034],
    ];
    let li = 0;
    for (const [dx, yy, rx, ry] of clumps) {
      const cx = o.x + dx;
      // each clump a soft irregular blob: the shadow under, the body, the light on top
      const blob = (path: Path2D, ox: number, oy: number, kx: number, ky: number): void => {
        const pts = 14;
        for (let i = 0; i <= pts; i++) {
          const an = (i / pts) * TAU;
          const wob = 1 + 0.16 * Math.sin(an * 3 + dx * 40) + 0.08 * Math.sin(an * 7 + yy * 90);
          const x = cx + ox + Math.cos(an) * rx * kx * wob, y = yy + oy + Math.sin(an) * ry * ky * wob;
          if (i) path.lineTo(x, y); else path.moveTo(x, y);
        }
        path.closePath();
      };
      blob(shade, 0.006, 0.012, 1, 1);
      blob(body, 0, 0, 0.96, 0.92);
      blob(lite, -rx * 0.18, -ry * 0.3, 0.62, 0.5);
      for (let k = 0; k < 26; k++, li++) {
        const an = hash(li * 3 + 1) * TAU, rr = Math.sqrt(hash(li * 5 + 2));
        const lx = cx + Math.cos(an) * rr * rx * 1.05, ly = yy + Math.sin(an) * rr * ry * 1.05;
        if (Math.sin(an) > 0.3 && hash(li * 7 + 3) < 0.6) continue;
        leafAt(silver, lx, ly, 0.011 + 0.006 * hash(li * 11 + 4), -0.4 + 0.8 * hash(li * 13 + 5) + (hash(li) < 0.5 ? Math.PI : 0));
      }
    }
    P.oliveShade = shade;
    P.oliveBlobs = body;
    P.oliveLite = lite;
    P.oliveSilver = silver;
    // shrubs along the wall's foot: clumps of rounded masses, irregular, with gaps (not in the gate's way, nor the path's)
    const bush = new Path2D(), bushHi = new Path2D(), bushLo = new Path2D(), roses: [number, number, number][] = [];
    let x = -0.7, bi = 0;
    while (x < WORLD_W + 0.7) {
      const wdt = 0.07 + 0.12 * hash(bi * 3 + 71), ht = 0.035 + 0.055 * hash(bi * 5 + 72);
      const cx = x + wdt / 2;
      const clear = Math.abs(cx - g.x) < a + wdt / 2 + 0.03 || Math.abs(cx - pathAt(1).x) < wdt / 2 + 0.04 || Math.abs(cx - o.x + 0.005) < 0.06;
      if (!clear && hash(bi * 7 + 73) > 0.12) {
        for (let k = 0; k < 7; k++) {
          const u = (k + 0.5) / 7;
          const r = ht * (0.45 + 0.4 * Math.sin(Math.PI * u)) * (0.85 + 0.3 * hash(bi * 11 + k));
          const bx = x + wdt * u, by = WALL.base + 0.004 - r * 0.9 + 0.01 * hash(bi * 13 + k);
          bush.moveTo(bx + r, by);
          bush.arc(bx, by, r, 0, TAU);
          bushLo.moveTo(bx + r * 0.8, by + r * 0.35);
          bushLo.arc(bx, by + r * 0.35, r * 0.8, 0, TAU);
          for (let q = 0; q < 6; q++) {
            const an = -Math.PI * (0.2 + 0.6 * hash(bi * 17 + k * 5 + q));
            const rr = r * (0.55 + 0.4 * hash(bi * 19 + k * 7 + q));
            leafAt(bushHi, bx + Math.cos(an) * rr, by + Math.sin(an) * rr, r * 0.32, an + (hash(q + k) - 0.5));
          }
        }
        if (hash(bi * 23 + 74) < 0.35) for (let q = 0; q < 5; q++) roses.push([x + wdt * (0.15 + 0.7 * hash(bi * 29 + q)), WALL.base - ht * (0.6 + 0.8 * hash(bi * 31 + q)), 0.0045 + 0.002 * hash(q + bi)]);
      }
      x += wdt * (0.75 + 0.5 * hash(bi * 37 + 75));
      bi++;
    }
    P.bush = bush;
    P.bushHi = bushHi;
    P.bushLo = bushLo;
    const rosePath = new Path2D();
    for (const [rx, ry, rr] of roses) { rosePath.moveTo(rx + rr, ry); rosePath.arc(rx, ry, rr, 0, TAU); }
    P.bushRoses = rosePath;
    // the lawn: fine blades, denser toward the front; a few clover clumps and small white flowers
    const grass = new Path2D(), clover = new Path2D(), daisies = new Path2D();
    for (let i = 0; i < 900; i++) {
      const x2 = -0.4 + (WORLD_W + 0.8) * hash(i * 7 + 800), y = WALL.base + 0.015 + 0.6 * hash(i * 11 + 801) ** 0.7;
      const inPond = ((x2 - POND.x) / (POND.rx + 0.035)) ** 2 + ((y - POND.y) / (POND.ry + 0.025)) ** 2 < 1;
      const inBed = x2 > BED.x0 - 0.02 && x2 < BED.x1 + 0.02 && y > BED.y0 - 0.02 && y < BED.y1 + 0.04;
      const pq = pathAt(clampU((1 - y) / 0.44));
      const onPath = Math.abs(x2 - pq.x) < 0.035 + 0.11 * (1 - clampU((1 - y) / 0.44)) && y > 0.55;
      if (inPond || inBed || onPath) continue;
      const near = (y - WALL.base) / 0.5;
      const h = (0.006 + 0.012 * hash(i + 802)) * (0.5 + 1.2 * near);
      const lean = (hash(i + 803) - 0.5) * 0.012;
      grass.moveTo(x2, y);
      grass.quadraticCurveTo(x2 + lean * 0.3, y - h * 0.6, x2 + lean, y - h);
      if (hash(i + 804) < 0.06) { clover.moveTo(x2 + 0.006, y); clover.ellipse(x2, y, 0.006 * (0.6 + near), 0.0025 * (0.6 + near), 0, 0, TAU); }
      if (hash(i + 805) < 0.025) { const r = 0.0022 * (0.6 + near); daisies.moveTo(x2 + r, y - h); daisies.arc(x2, y - h, r, 0, TAU); }
    }
    P.grass = grass;
    P.clover = clover;
    P.daisies = daisies;
    // the lantern path: a band of gravel with stepping stones, running off the garden's front
    const path = new Path2D(), stones = new Path2D();
    const L: [number, number][] = [], Rr: [number, number][] = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30, q = pathAt(u), wd = 0.03 + 0.085 * (1 - u);
      L.push([q.x - wd, q.y]);
      Rr.push([q.x + wd, q.y]);
    }
    path.moveTo(L[0][0] - 0.03, L[0][1] + 0.35);
    for (const [x3, y] of L) path.lineTo(x3, y);
    for (const [x3, y] of Rr.reverse()) path.lineTo(x3, y);
    path.lineTo(Rr[Rr.length - 1][0] + 0.03, Rr[Rr.length - 1][1] + 0.35);
    path.closePath();
    for (let i = 0; i < 16; i++) {
      const u = (i + 0.3) / 16, q = pathAt(u), sc = 1.05 - 0.7 * u;
      const rx = (0.026 + 0.008 * hash(i + 90)) * sc, ry = 0.009 * sc;
      const ox = 0.012 * Math.sin(i * 2.3);
      stones.moveTo(q.x + ox + rx, q.y);
      stones.ellipse(q.x + ox, q.y, rx, ry, 0.08 * Math.sin(i), 0, TAU);
    }
    P.path = path;
    P.pathStones = stones;
    // the raised bed: the soil's top, a stone front and sides, clods and furrows, herbs at its corners
    const bed = new Path2D();
    bed.moveTo(BED.x0 + 0.01, BED.y0);
    bed.lineTo(BED.x1 - 0.01, BED.y0);
    bed.lineTo(BED.x1, BED.y1);
    bed.lineTo(BED.x0, BED.y1);
    bed.closePath();
    P.bed = bed;
    const edgeTop = new Path2D(), edgeFront = new Path2D();
    edgeTop.moveTo(BED.x0 - 0.002, BED.y0 - 0.008);
    edgeTop.lineTo(BED.x1 + 0.002, BED.y0 - 0.008);
    edgeTop.lineTo(BED.x1 + 0.014, BED.y1 + 0.004);
    edgeTop.lineTo(BED.x0 - 0.014, BED.y1 + 0.004);
    edgeTop.closePath();
    edgeTop.moveTo(BED.x0 + 0.01, BED.y0);
    edgeTop.lineTo(BED.x0, BED.y1);
    edgeTop.lineTo(BED.x1, BED.y1);
    edgeTop.lineTo(BED.x1 - 0.01, BED.y0);
    edgeTop.closePath();
    edgeFront.rect(BED.x0 - 0.014, BED.y1 + 0.004, BED.x1 - BED.x0 + 0.028, 0.024);
    P.bedEdge = edgeTop;
    P.bedFront = edgeFront;
    const furrow = new Path2D(), clods = new Path2D();
    for (let i = 1; i < 5; i++) {
      const y = BED.y0 + ((BED.y1 - BED.y0) * i) / 5;
      const inset = 0.01 * (1 - i / 5);
      furrow.moveTo(BED.x0 + 0.012 + inset, y);
      for (let k = 0; k <= 20; k++) furrow.lineTo(BED.x0 + 0.012 + inset + ((BED.x1 - BED.x0 - 0.024 - 2 * inset) * k) / 20, y + 0.0018 * Math.sin(k * 1.7 + i));
    }
    for (let i = 0; i < 70; i++) {
      const x4 = BED.x0 + 0.01 + (BED.x1 - BED.x0 - 0.02) * hash(i + 950), y = BED.y0 + 0.005 + (BED.y1 - BED.y0 - 0.008) * hash(i + 951);
      const r = 0.002 + 0.002 * hash(i + 952);
      clods.moveTo(x4 + r, y);
      clods.ellipse(x4, y, r, r * 0.6, 0, 0, TAU);
    }
    P.furrow = furrow;
    P.clods = clods;
    const herbs = new Path2D();
    for (const [hx, hy] of [[BED.x0 - 0.03, BED.y1 + 0.02], [BED.x1 + 0.03, BED.y1 + 0.015], [BED.x1 + 0.05, BED.y0 + 0.02]] as const) {
      for (let q = 0; q < 9; q++) leafAt(herbs, hx, hy, 0.022 + 0.01 * hash(q + hx), -Math.PI / 2 + (q - 4) * 0.22);
    }
    P.herbs = herbs;
    // the stone bench: a slab (its top lit, its front in shade) on two legs
    const b = BENCH;
    const seat = new Path2D();
    seat.moveTo(b.x - b.w / 2 + 0.012, b.y - 0.034);
    seat.lineTo(b.x + b.w / 2 - 0.012, b.y - 0.034);
    seat.lineTo(b.x + b.w / 2, b.y - 0.024);
    seat.lineTo(b.x - b.w / 2, b.y - 0.024);
    seat.closePath();
    P.seat = seat;
    const seatFront = new Path2D();
    seatFront.rect(b.x - b.w / 2, b.y - 0.024, b.w, 0.012);
    P.seatFront = seatFront;
    const legs = new Path2D();
    legs.rect(b.x - b.w / 2 + 0.03, b.y - 0.012, 0.038, 0.032);
    legs.rect(b.x + b.w / 2 - 0.068, b.y - 0.012, 0.038, 0.032);
    P.legs = legs;
    // the clay vessel on the bench (a small jar)
    const v = VESSEL, jar = new Path2D();
    jar.moveTo(v.x - 0.008, v.y - 0.035);
    jar.bezierCurveTo(v.x - 0.006, v.y - 0.028, v.x - 0.024, v.y - 0.022, v.x - 0.022, v.y - 0.008);
    jar.bezierCurveTo(v.x - 0.02, v.y + 0.0, v.x - 0.012, v.y + 0.004, v.x - 0.01, v.y + 0.005);
    jar.lineTo(v.x + 0.01, v.y + 0.005);
    jar.bezierCurveTo(v.x + 0.012, v.y + 0.004, v.x + 0.02, v.y + 0.0, v.x + 0.022, v.y - 0.008);
    jar.bezierCurveTo(v.x + 0.024, v.y - 0.022, v.x + 0.006, v.y - 0.028, v.x + 0.008, v.y - 0.035);
    jar.closePath();
    P.jar = jar;
    // the pond: water, its rim of stones, lily pads
    const pd = POND;
    const water = new Path2D();
    water.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0, TAU);
    P.water = water;
    const rim = new Path2D();
    rim.ellipse(pd.x, pd.y + 0.004, pd.rx + 0.022, pd.ry + 0.014, 0, 0, TAU);
    P.rim = rim;
    const rimStones = new Path2D(), rimDark = new Path2D();
    let an0 = 0;
    for (let i = 0; an0 < TAU; i++) {
      const front = Math.max(0, Math.sin(an0));
      const r = (0.01 + 0.009 * hash(i + 900)) * (0.65 + 0.55 * front);
      const x = pd.x + Math.cos(an0) * (pd.rx + 0.012 + 0.004 * hash(i + 901)), y = pd.y + 0.004 + Math.sin(an0) * (pd.ry + 0.007);
      const target = hash(i + 902) < 0.35 ? rimDark : rimStones;
      target.moveTo(x + r, y);
      target.ellipse(x, y, r, r * (0.38 + 0.14 * hash(i + 903)), (hash(i + 904) - 0.5) * 0.5, 0, TAU);
      an0 += (r * 1.5) / Math.max(0.05, pd.rx * Math.abs(Math.sin(an0)) + pd.ry * Math.abs(Math.cos(an0)) + 0.05);
    }
    P.rimDark = rimDark;
    P.rimStones = rimStones;
    const pads = new Path2D();
    for (const [dx, dy, r] of [[-0.3, 0.035, 0.03], [-0.24, 0.05, 0.022], [0.27, 0.04, 0.028], [0.34, 0.02, 0.02], [-0.12, -0.045, 0.018], [0.15, -0.05, 0.016], [0.32, -0.035, 0.017]] as const) {
      const x = pd.x + dx, y = pd.y + dy;
      pads.moveTo(x, y);
      pads.ellipse(x, y, r, r * 0.38, 0, 0.25, TAU - 0.05);
      pads.closePath();
    }
    P.pads = pads;
  }

  // ── the sky ─────────────────────────────────────────────────────

  /** The sky over the whole canvas (CSS px), the stars and the moon, the sun's glow rising behind the wall. */
  sky(ctx: CanvasRenderingContext2D, w: number, h: number, k: number, time: number, c: Cam, d: number): void {
    this.build();
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const horizonY = c.vy + (HORIZON - c.y) * c.s;
    const g = ctx.createLinearGradient(0, Math.min(0, horizonY - c.s * 0.6), 0, horizonY + 10);
    g.addColorStop(0, pal('skyTop', k));
    g.addColorStop(0.55, pal('skyMid', k));
    g.addColorStop(1, pal('skyLow', k));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // the dawn's glow low over the wall, behind the olive
    const sunX = this.sunX(c), sunY = this.sunY(c, k);
    if (k > 0.25) {
      const a = smooth(0.25, 0.85, k);
      const rg = ctx.createRadialGradient(sunX, horizonY, 0, sunX, horizonY, Math.max(w, h) * 0.9);
      rg.addColorStop(0, rgba('#ffd6a0', 0.55 * a));
      rg.addColorStop(0.35, rgba('#ffb4a0', 0.22 * a));
      rg.addColorStop(1, rgba('#ffb4a0', 0));
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    // the stars fade through the blue hour
    const sa = 1 - smooth(0.08, 0.5, k);
    if (sa > 0.01) {
      ctx.fillStyle = '#f4f2ff';
      const sx = (c.x - WORLD_W / 2) * c.s * 0.06;
      for (const s of this.stars) {
        const tw = this.reduced ? 0.8 : 0.6 + 0.4 * Math.sin(time * 1.3 + s.ph);
        const x = ((s.x * (w + 80) - sx) % (w + 80) + (w + 80)) % (w + 80) - 40, y = s.y * Math.max(h, horizonY + 20);
        if (y > horizonY - 8) continue;
        ctx.globalAlpha = sa * tw * (0.35 + 0.65 * s.r / 1.7);
        ctx.fillRect(x, y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }
    // the moon, setting behind the wall as the night goes
    const ma = 1 - smooth(0.4, 0.62, k);
    if (ma > 0.01) {
      const mx = c.vx + (0.75 - c.x) * c.s * 0.18 - c.s * 0.25;
      const my = c.vy + (0.13 + 0.42 * smooth(0, 0.62, k) - c.y) * c.s;
      const r = Math.max(7, c.s * 0.028);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.sprites.cool, mx, my, r * 9, 0.22 * ma);
      glow(ctx, this.sprites.white, mx, my, r * 2.6, 0.35 * ma);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = ma;
      ctx.fillStyle = '#f3f0e4';
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,170,200,0.35)';
      ctx.beginPath();
      ctx.arc(mx - r * 0.3, my - r * 0.15, r * 0.28, 0, TAU);
      ctx.arc(mx + r * 0.25, my + r * 0.3, r * 0.18, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // the sun behind the wall: its disc and glow (the wall and the hills are drawn over it)
    if (k > 0.55) {
      const a = smooth(0.55, 0.8, k);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.sprites.sun, sunX, sunY, c.s * 0.55, 0.55 * a);
      glow(ctx, this.sprites.warm, sunX, sunY, c.s * 0.16, 0.6 * a);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba('#fff6dc', a);
      ctx.beginPath();
      ctx.arc(sunX, sunY, Math.max(8, c.s * 0.042), 0, TAU);
      ctx.fill();
    }
  }

  /** The sun's place on screen (it stands far: it barely moves with the camera). */
  sunX(c: Cam): number { return c.vx + (OLIVE.x + 0.04 - c.x) * c.s * 0.85; }
  sunY(c: Cam, k: number): number { return c.vy + (WALL.top + 0.06 - 0.25 * smooth(0.6, 1, k) - c.y) * c.s; }

  // ── the world ───────────────────────────────────────────────────

  private world(ctx: CanvasRenderingContext2D, c: Cam, d: number, f = 1): void {
    const ox = c.vx - c.x * c.s + (c.x - WORLD_W / 2) * c.s * (1 - f);
    ctx.setTransform(d * c.s, 0, 0, d * c.s, d * ox, d * (c.vy - c.y * c.s));
  }

  /** Beyond the wall: the hills and the cypresses (parallax), a little haze. */
  beyond(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number): void {
    const P = this.p;
    if (!P.hills) return;
    this.world(ctx, c, d, 0.45);
    ctx.fillStyle = pal('hills', k);
    ctx.fill(P.hills);
    this.world(ctx, c, d, 0.6);
    ctx.fillStyle = pal('hillsNear', k);
    ctx.fill(P.hillsNear);
    this.world(ctx, c, d, 0.75);
    ctx.fillStyle = pal('cypress', k);
    ctx.fill(P.cypress);
  }

  /** The lawn, the wall with its gate's frame and ivy, the olive, the bushes, the grass, the path, the bed, the bench. */
  garden(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number): void {
    const P = this.p;
    if (!P.wall) return;
    this.world(ctx, c, d);
    const px = 1 / c.s;
    // the lawn
    const lg = ctx.createLinearGradient(0, WALL.base, 0, 1.25);
    lg.addColorStop(0, pal('lawnFar', k));
    lg.addColorStop(0.4, pal('lawn', k));
    lg.addColorStop(1, pal('lawnNear', k));
    ctx.fillStyle = lg;
    ctx.fillRect(-3, WALL.base - 0.01, WORLD_W + 6, 2);
    // the wall
    ctx.fillStyle = pal('wall', k);
    ctx.fill(P.wall, 'evenodd');
    ctx.save();
    ctx.clip(P.wall, 'evenodd');
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = pal('coping', k);
    ctx.fill(P.faceL);
    ctx.fillStyle = pal('wallDark', k);
    ctx.fill(P.faceD);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = pal('wallDark', k);
    ctx.lineWidth = 1.1 * px;
    ctx.stroke(P.joints);
    ctx.globalAlpha = 1;
    // shade toward the foot, and the dawn's warmth along the top
    const sg = ctx.createLinearGradient(0, WALL.top, 0, WALL.base);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = sg;
    ctx.fillRect(-3, WALL.top - 0.1, WORLD_W + 6, 0.3);
    ctx.restore();
    ctx.fillStyle = pal('coping', k);
    ctx.fill(P.coping);
    ctx.fill(P.archRing);
    ctx.strokeStyle = pal('wallDark', k);
    ctx.lineWidth = 1 * px;
    ctx.stroke(P.archJ);
    // the coping's lit edge (the moon's, then the dawn's)
    ctx.strokeStyle = rgba(k < 0.6 ? '#c8d4ff' : '#fff0d0', 0.12 + 0.2 * k);
    ctx.lineWidth = 1.2 * px;
    ctx.beginPath();
    ctx.moveTo(-3, WALL.top - 0.012);
    ctx.lineTo(GATE.x - 0.2, WALL.top - 0.012);
    ctx.moveTo(GATE.x + 0.2, WALL.top - 0.012);
    ctx.lineTo(WORLD_W + 3, WALL.top - 0.012);
    ctx.stroke();
    // ivy
    ctx.fillStyle = pal('ivy', k);
    ctx.fill(P.ivy);
    ctx.fillStyle = pal('ivyHi', k);
    ctx.fill(P.ivyHi);
    // shrubs: their shadowed base, the body, the lit leaves, a few roses (they open with the light)
    ctx.fillStyle = pal('bush', Math.max(0, k - 0.15));
    ctx.fill(P.bushLo);
    ctx.fillStyle = pal('bush', k);
    ctx.fill(P.bush);
    ctx.fillStyle = pal('bushHi', k);
    ctx.globalAlpha = 0.85;
    ctx.fill(P.bushHi);
    ctx.globalAlpha = 0.35 + 0.6 * smooth(0.3, 0.9, k);
    ctx.fillStyle = k < 0.5 ? '#6a4a62' : '#e88aa0';
    ctx.fill(P.bushRoses);
    ctx.globalAlpha = 1;
  }

  /** The olive in front of the wall. */
  olive(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, time: number): void {
    const P = this.p;
    if (!P.trunk) return;
    this.world(ctx, c, d);
    // a slow breath of wind in the leaves
    const sway = this.reduced ? 0 : Math.sin(time * 0.6) * 0.0025;
    ctx.fillStyle = pal('trunk', k);
    ctx.fill(P.trunk);
    ctx.strokeStyle = rgba('#000000', 0.3);
    ctx.lineWidth = 1.4 / c.s;
    ctx.stroke(P.bark);
    ctx.save();
    ctx.translate(sway, 0);
    ctx.fillStyle = pal('oliveDark', Math.max(0, k - 0.2));
    ctx.fill(P.oliveShade);
    ctx.fillStyle = pal('oliveDark', k);
    ctx.fill(P.oliveBlobs);
    ctx.fillStyle = pal('oliveSilver', k * 0.85);
    ctx.globalAlpha = 0.55;
    ctx.fill(P.oliveLite);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = pal('oliveSilver', k);
    ctx.fill(P.oliveSilver);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** The lawn's grass, the lantern path and the bed's soil and edge, the bench. */
  ground(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number): void {
    const P = this.p;
    if (!P.grass) return;
    this.world(ctx, c, d);
    const px = 1 / c.s;
    ctx.fillStyle = pal('bush', k);
    ctx.globalAlpha = 0.55;
    ctx.fill(P.clover);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal('ivyHi', k);
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 1 * px;
    ctx.stroke(P.grass);
    ctx.globalAlpha = 0.25 + 0.6 * smooth(0.3, 0.9, k);
    ctx.fillStyle = '#f4f0e6';
    ctx.fill(P.daisies);
    ctx.globalAlpha = 1;
    // the path's gravel (soft at its edges), its stepping stones
    ctx.fillStyle = pal('path', k * 0.9);
    ctx.globalAlpha = 0.85;
    ctx.fill(P.path);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal('pathStone', k * 0.92);
    ctx.fill(P.pathStones);
    // the bed: its stone rim, the soil, the furrows and clods, the front's shade, herbs at the corners
    ctx.fillStyle = pal('bedEdge', k);
    ctx.fill(P.bedEdge, 'evenodd');
    ctx.fillStyle = pal('soil', k);
    ctx.fill(P.bed);
    ctx.fillStyle = pal('soilHi', k);
    ctx.globalAlpha = 0.7;
    ctx.fill(P.clods);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = pal('soilHi', k);
    ctx.lineWidth = 1.1 * px;
    ctx.stroke(P.furrow);
    ctx.fillStyle = pal('wallDark', k);
    ctx.fill(P.bedFront);
    ctx.fillStyle = pal('ivyHi', k);
    ctx.fill(P.herbs);
    // the bench and its shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(BENCH.x, BENCH.y + 0.022, BENCH.w * 0.58, 0.012, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal('benchDark', k);
    ctx.fill(P.legs);
    ctx.fill(P.seatFront);
    ctx.fillStyle = pal('bench', k);
    ctx.fill(P.seat);
  }

  /** The clay vessel on the bench, glowing with the tears gathered (0, 1, 2… a little more light each). */
  vessel(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, tears: number, pulse: number): void {
    const P = this.p;
    if (!P.jar) return;
    this.world(ctx, c, d);
    ctx.fillStyle = pal('clay', k);
    ctx.fill(P.jar);
    if (tears > 0 || pulse > 0) {
      const a = Math.min(1, 0.35 + 0.15 * tears) * (0.7 + 0.3 * pulse);
      ctx.save();
      ctx.clip(P.jar);
      const g = ctx.createLinearGradient(0, VESSEL.y - 0.03, 0, VESSEL.y + 0.005);
      g.addColorStop(0, rgba('#fff2c8', 0));
      g.addColorStop(1, rgba('#ffe0a0', 0.55 * a));
      ctx.fillStyle = g;
      ctx.fillRect(VESSEL.x - 0.03, VESSEL.y - 0.04, 0.06, 0.05);
      ctx.restore();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, this.sprites.gold, VESSEL.x, VESSEL.y - 0.036, 0.03 + 0.006 * Math.min(6, tears), 0.5 * a);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /**
   * The pond: water reflecting the sky, the wall and the olive; the moon's or the sun's path on it; lily pads and two
   * water lilies (open at dawn); slow ripples.  `murk` darkens the water (a stone's settle clears it).
   */
  pond(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, time: number, murk: number): void {
    const P = this.p;
    if (!P.water) return;
    this.world(ctx, c, d);
    const pd = POND, px = 1 / c.s;
    ctx.fillStyle = pal('pathStone', k);
    ctx.globalAlpha = 0.55;
    ctx.fill(P.rim);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.clip(P.water);
    // the sky, upside down: the low sky at the far bank, the high sky near
    const wg = ctx.createLinearGradient(0, pd.y - pd.ry, 0, pd.y + pd.ry);
    wg.addColorStop(0, pal('skyLow', k));
    wg.addColorStop(0.5, pal('skyMid', k));
    wg.addColorStop(1, pal('skyTop', k));
    ctx.fillStyle = wg;
    ctx.fillRect(pd.x - pd.rx, pd.y - pd.ry, 2 * pd.rx, 2 * pd.ry);
    ctx.fillStyle = pal('waterDeep', k);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(pd.x - pd.rx, pd.y - pd.ry, 2 * pd.rx, 2 * pd.ry);
    ctx.globalAlpha = 1;
    // the wall and the olive reflected (flipped at the far bank)
    const yw = pd.y - pd.ry * 0.9;
    ctx.save();
    ctx.translate(0, 2 * yw);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = pal('wallDark', k);
    ctx.fill(P.wall, 'evenodd');
    ctx.fillStyle = pal('oliveDark', k);
    ctx.fill(P.oliveShade);
    ctx.fill(P.oliveBlobs);
    ctx.fill(P.trunk);
    ctx.fillStyle = pal('bush', k);
    ctx.fill(P.bush);
    ctx.restore();
    ctx.globalAlpha = 1;
    // the light's path on the water: the moon at night, the sun at dawn
    ctx.globalCompositeOperation = 'lighter';
    const night = 1 - smooth(0.4, 0.62, k), day = smooth(0.6, 0.9, k);
    if (night > 0.01) glow(ctx, this.sprites.cool, pd.x - 0.2, pd.y, 0.05, 0.35 * night, 0.07);
    if (day > 0.01) glow(ctx, this.sprites.warm, OLIVE.x - 0.25, pd.y - 0.02, 0.12, 0.5 * day, 0.05);
    ctx.globalCompositeOperation = 'source-over';
    // slow ripples: thin bright lines drifting across
    const t = this.reduced ? 0 : time;
    ctx.strokeStyle = rgba('#e8f0ff', 0.12 + 0.12 * k);
    ctx.lineWidth = 1 * px;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const y = pd.y - pd.ry + (2 * pd.ry * (i + 0.5)) / 9;
      const x = pd.x - pd.rx + ((t * 0.012 * (1 + (i % 3)) + hash(i + 70)) % 1) * 2 * pd.rx;
      const L = 0.04 + 0.05 * hash(i + 71);
      ctx.moveTo(x - L, y);
      ctx.quadraticCurveTo(x, y - 0.002, x + L, y);
    }
    ctx.stroke();
    if (murk > 0.01) {
      ctx.fillStyle = `rgba(8,10,16,${0.45 * murk})`;
      ctx.fillRect(pd.x - pd.rx, pd.y - pd.ry, 2 * pd.rx, 2 * pd.ry);
    }
    ctx.restore();
    // the near edge's shadow and the rim's stones
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2 * px;
    ctx.beginPath();
    ctx.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();
    ctx.fillStyle = pal('pathStone', k);
    ctx.fill(P.rimStones);
    ctx.fillStyle = pal('path', k);
    ctx.fill(P.rimDark);
    // lily pads and two water lilies, opening at dawn
    ctx.fillStyle = pal('lily', k);
    ctx.fill(P.pads);
    const open = smooth(0.6, 0.95, k);
    for (const [dx, dy, s] of [[-0.24, 0.044, 1], [0.31, 0.03, 0.85]] as const) {
      this.lily(ctx, pd.x + dx, pd.y + dy, 0.014 * s, open, k);
    }
  }

  private lily(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, open: number, k: number): void {
    const n = 8;
    ctx.fillStyle = rgba('#fbf4f2', 0.55 + 0.45 * k);
    for (let i = 0; i < n; i++) {
      const an = -Math.PI / 2 + ((i - (n - 1) / 2) / n) * (0.9 + 1.6 * open);
      const L = r * (0.7 + 0.6 * open);
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(an) * L * 0.5, y + Math.sin(an) * L * 0.25, L * 0.5, L * 0.18, an, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = rgba('#ffd86a', 0.4 + 0.6 * open);
    ctx.beginPath();
    ctx.ellipse(x, y - r * 0.15, r * 0.25, r * 0.12, 0, 0, TAU);
    ctx.fill();
  }

  /** Mist over the water and the lawn (night and the blue hour), fireflies, the dew at dawn. */
  air(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, time: number): void {
    this.world(ctx, c, d);
    const t = this.reduced ? 0 : time;
    const ma = 0.085 * (1 - smooth(0.7, 0.95, k));
    if (ma > 0.005) {
      ctx.globalCompositeOperation = 'lighter';
      const col = pal('mist', k);
      for (const m of this.mist) {
        const x = m.x + (((t * m.sp + m.ph) % 1.2) - 0.6) * 0.6;
        const spr = this.sprites.white;
        if (!spr) continue;
        ctx.globalAlpha = ma;
        ctx.drawImage(spr, x - m.w, m.y - m.h, 2 * m.w, 2 * m.h);
      }
      ctx.globalAlpha = 1;
      void col;
      ctx.globalCompositeOperation = 'source-over';
    }
    const fa = 1 - smooth(0.3, 0.6, k);
    if (fa > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      for (const f of this.flies) {
        const x = f.x + Math.sin(t * f.sp + f.ph) * f.rx, y = f.y + Math.sin(t * f.sp * 1.3 + f.ph * 2) * f.ry;
        const blink = this.reduced ? 0.7 : 0.5 + 0.5 * Math.sin(t * 2.2 + f.ph * 3) ** 2;
        glow(ctx, this.sprites.fly, x, y, 0.012, fa * blink * 0.9);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    const da = smooth(0.72, 0.95, k);
    if (da > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      for (const w of this.dew) {
        const tw = this.reduced ? 0.6 : Math.max(0, Math.sin(t * 1.7 + w.ph * 5)) ** 3;
        if (tw < 0.05) continue;
        glow(ctx, this.sprites.white, w.x, w.y, 0.006, da * tw);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** The sun's slow rays through the olive's leaves, and a few birds crossing the morning sky. */
  light(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, time: number, w: number, h: number, birds: number): void {
    const a = smooth(0.72, 1, k);
    if (a <= 0.01) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const sx = this.sunX(c), sy = this.sunY(c, k);
    ctx.globalCompositeOperation = 'lighter';
    const t = this.reduced ? 0 : time;
    for (let i = 0; i < 9; i++) {
      const an = Math.PI * (0.22 + 0.56 * (i / 8)) + 0.03 * Math.sin(t * 0.15 + i);
      const len = Math.hypot(w, h) * (0.7 + 0.3 * hash(i + 40));
      const wd = 0.03 + 0.03 * hash(i + 41);
      const gr = ctx.createLinearGradient(sx, sy, sx + Math.cos(an) * len, sy + Math.sin(an) * len);
      gr.addColorStop(0, rgba('#fff0c8', 0.13 * a));
      gr.addColorStop(1, rgba('#fff0c8', 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(an - wd) * len, sy + Math.sin(an - wd) * len);
      ctx.lineTo(sx + Math.cos(an + wd) * len, sy + Math.sin(an + wd) * len);
      ctx.fill();
    }
    glow(ctx, this.sprites.sun, sx, sy, c.s * 0.35, 0.25 * a);
    ctx.globalCompositeOperation = 'source-over';
    // birds: small dark wings, flapping, crossing from right to left
    if (birds > 0 && !this.reduced) {
      ctx.strokeStyle = rgba('#3a3040', 0.75 * a);
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const u = ((time * (0.035 + 0.01 * i) + i * 0.31) % 1.3) - 0.15;
        const bx = w * (1.05 - u), by = Math.max(c.vy - c.s * 0.25, 30) + i * 14 + Math.sin(time * 0.7 + i) * 6;
        const flap = Math.sin(time * 9 + i * 2) * 0.6;
        const sz = 6 + i * 1.5;
        ctx.beginPath();
        ctx.moveTo(bx - sz, by - sz * 0.3 * flap);
        ctx.quadraticCurveTo(bx - sz * 0.4, by - sz * 0.5 * (0.4 + flap), bx, by);
        ctx.quadraticCurveTo(bx + sz * 0.4, by - sz * 0.5 * (0.4 + flap), bx + sz, by - sz * 0.3 * flap);
        ctx.stroke();
      }
    }
  }

  /** Long grass in the near corners (the garden's front, a little parallax), lit at its edges by the dawn. */
  front(ctx: CanvasRenderingContext2D, k: number, c: Cam, d: number, w: number, h: number): void {
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const shift = (c.x - WORLD_W / 2) * c.s * 0.08;
    const L = Math.min(w, h) * 0.2;
    const blade = (x: number, len: number, an: number, wd: number, bend: number) => {
      const ex = x + Math.cos(an) * len, ey = h + 6 + Math.sin(an) * len;
      const mx = x + Math.cos(an) * len * 0.55 + bend, my = h + 6 + Math.sin(an) * len * 0.55;
      ctx.beginPath();
      ctx.moveTo(x - wd, h + 6);
      ctx.quadraticCurveTo(mx - wd * 0.5, my, ex, ey);
      ctx.quadraticCurveTo(mx + wd * 0.5, my, x + wd, h + 6);
      ctx.fill();
    };
    for (const side of [-1, 1] as const) {
      const x0 = side < 0 ? -10 - shift : w + 10 - shift;
      for (let i = 0; i < 16; i++) {
        const v = hash(i * 7 + (side < 0 ? 1 : 2));
        ctx.fillStyle = i % 3 === 0 ? pal('bushHi', k * 0.9) : pal('lawnNear', k);
        ctx.globalAlpha = 0.9;
        const an = -Math.PI / 2 - side * (0.08 + 0.55 * (i / 16)) + (v - 0.5) * 0.15;
        blade(x0 - side * (i * L * 0.045), L * (0.55 + 0.7 * hash(i + 31)), an, 2 + 3 * v, side * -L * 0.08 * (0.5 + v));
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The arch's opening as a path in world units (the gate's leaves and what lies beyond are drawn in it). */
  get archPath(): Path2D | null { this.build(); return this.p.arch ?? null; }
  get waterPath(): Path2D | null { this.build(); return this.p.water ?? null; }
  get bedPath(): Path2D | null { this.build(); return this.p.bed ?? null; }

  /** Set the world transform (for the act's drawings). */
  setWorld(ctx: CanvasRenderingContext2D, c: Cam, d: number, f = 1): void { this.world(ctx, c, d, f); }
}

export type { Ramp };
