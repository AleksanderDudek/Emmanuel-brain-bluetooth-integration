/**
 * The scalp cut through (DESIGN.md §15): the skin (the epidermis over the dermis), the dense connective tissue with
 * its fat, vessels and nerves, the galea's tendon, the loose tissue the scalp slides on, the pericranium and the bone
 * — S·C·A·L·P — with slanted follicles reaching into the fat, each with its gland and its little muscle.
 *
 *   siec        the capillary net grows from the deep arteries up to the skin, and a loop reaches every papilla
 *   korzenie    the papillae light one after another, each with its loop
 *   wyrastanie  the hairs grow out of the skin, each on its slant
 *   mozaika     every follicle keeps its own time: growing, regressing, resting, a new hair — a mosaic
 *   naskorek    the epidermis close up: basal cells divide, rise, flatten and flake away
 */
import { clamp, ease } from '../kit/juice';
import { COLOUR, type HairColour } from './content';
import { SEC, SEC_FOLLICLES, phaseAt, secPt, hash, type Phase, type Pt, type SecFollicle } from './geo';
import { AQUA, BLOOD, BLOOD_HI, GOLD, GOLD_HI, LILAC, PEARL, ROSE, TAU, glow, mix, rgba, smoothPath } from './paint';
import type { WorldState } from './world';

const X0 = -240, X1 = 240;

// ── the still section ────────────────────────────────────────────
export type SecVariant = 'anagen' | 'noshaft' | 'bare' | 'epi';

/**
 * The section's still parts in its units, dark so its living parts glow: the layers with their textures; the
 * follicles in anagen (with their hair above the skin, or without it while it grows), or none (the mosaic draws them
 * as they cycle); `epi` the epidermis's ground without its cells (the close-up draws them).
 */
export function bakeSection(ctx: CanvasRenderingContext2D, variant: SecVariant, colour: HairColour): void {
  bone(ctx);
  band(ctx, SEC.peri[0], SEC.peri[1], 'rgba(150,120,200,.85)');
  ctx.strokeStyle = 'rgba(226,206,255,.75)';
  ctx.lineWidth = 0.3;
  line(ctx, SEC.peri[0]);
  areolar(ctx);
  galea(ctx);
  subcutis(ctx);
  dermis(ctx, variant === 'epi');
  if (variant === 'anagen' || variant === 'noshaft') for (const f of SEC_FOLLICLES) secFollicle(ctx, f, { phase: 'anagen', k: 0.5 }, colour, variant === 'anagen' ? 1 : 0);
  epidermis(ctx, variant === 'epi');
}

function band(ctx: CanvasRenderingContext2D, y0: number, y1: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fillRect(X0, y0, X1 - X0, y1 - y0);
}

function line(ctx: CanvasRenderingContext2D, y: number): void {
  ctx.beginPath();
  ctx.moveTo(X0, y);
  ctx.lineTo(X1, y);
  ctx.stroke();
}

function bone(ctx: CanvasRenderingContext2D): void {
  const [b0] = SEC.bone;
  // the outer table, the diploë (spongy bone with its marrow spaces), the inner table, and the dark beyond
  band(ctx, b0, 150, '#160a1c');
  const ot = ctx.createLinearGradient(0, b0, 0, b0 + 4.5);
  ot.addColorStop(0, 'rgba(240,226,236,.85)');
  ot.addColorStop(1, 'rgba(200,170,196,.7)');
  band(ctx, b0, b0 + 4.5, ot);
  band(ctx, b0 + 4.5, b0 + 21, 'rgba(120,80,112,.75)');
  band(ctx, b0 + 21, b0 + 25, 'rgba(214,190,210,.72)');
  for (let i = 0; i < 180; i++) {
    const x = X0 + hash(i * 3 + 41) * (X1 - X0), y = b0 + 6 + hash(i * 5 + 42) * 13;
    ctx.beginPath();
    ctx.ellipse(x, y, 1.2 + 2.4 * hash(i * 7 + 43), 0.9 + 1.4 * hash(i * 11 + 44), hash(i + 45) * 3, 0, TAU);
    ctx.fillStyle = 'rgba(46,16,44,.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(236,206,226,.28)';
    ctx.lineWidth = 0.22;
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,244,250,.6)';
  ctx.lineWidth = 0.3;
  line(ctx, b0);
}

function areolar(ctx: CanvasRenderingContext2D): void {
  const [a0, a1] = SEC.areolar;
  band(ctx, a0, a1, '#1d0d26');
  ctx.strokeStyle = 'rgba(200,170,255,.2)';
  ctx.lineWidth = 0.2;
  for (let i = 0; i < 110; i++) {
    const x = X0 + hash(i * 13 + 61) * (X1 - X0), y = a0 + 0.8 + hash(i * 17 + 62) * (a1 - a0 - 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 3, y - 1.4, x + 5, y + 1.4, x + 8, y - 0.3);
    ctx.stroke();
  }
}

function galea(ctx: CanvasRenderingContext2D): void {
  const [g0, g1] = SEC.galea;
  // a tendon's sheen: pearl-silver, brightest in its middle
  const gr = ctx.createLinearGradient(0, g0, 0, g1);
  gr.addColorStop(0, 'rgba(190,180,236,.55)');
  gr.addColorStop(0.5, 'rgba(236,232,255,.62)');
  gr.addColorStop(1, 'rgba(190,180,236,.55)');
  band(ctx, g0, g1, gr);
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 0.14;
  for (let k = 0; k < 10; k++) {
    const y = g0 + 0.35 + k * ((g1 - g0 - 0.7) / 9);
    ctx.beginPath();
    for (let x = X0; x <= X1; x += 6) {
      const yy = y + 0.12 * Math.sin(x * 0.21 + k);
      if (x === X0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
}

function subcutis(ctx: CanvasRenderingContext2D): void {
  const [s0, s1] = SEC.sub;
  band(ctx, s0, s1, '#2e1232');
  // fat lobules: cells with golden rims and a faint light inside
  for (let i = 0; i < 320; i++) {
    const x = X0 + hash(i * 3 + 7) * (X1 - X0), y = s0 + 1.5 + hash(i * 5 + 8) * (s1 - s0 - 3);
    const r = 1.6 + 1.3 * hash(i * 7 + 9);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.8 + 0.3 * hash(i + 10)), hash(i + 11) * 3, 0, TAU);
    ctx.fillStyle = `rgba(255,214,160,${(0.05 + 0.06 * hash(i + 13)).toFixed(3)})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,160,.26)';
    ctx.lineWidth = 0.18;
    ctx.stroke();
  }
  // the vessels and a nerve running through it (the connective tissue is dense with them), glowing
  const op = ctx.globalCompositeOperation;
  const tube = (y: number, r: number, glowC: string, body: string, hi: string, ph: number) => {
    const p = new Path2D();
    for (let x = X0; x <= X1; x += 4) {
      const yy = y + 0.9 * Math.sin(x * 0.05 + ph);
      if (x === X0) p.moveTo(x, yy); else p.lineTo(x, yy);
    }
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = glowC;
    ctx.lineWidth = r * 4;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = body;
    ctx.lineWidth = r * 2;
    ctx.stroke(p);
    ctx.strokeStyle = hi;
    ctx.lineWidth = r * 0.5;
    ctx.stroke(p);
  };
  tube(SEC.artery, 1.2, 'rgba(255,60,90,.12)', 'rgba(255,82,110,.75)', 'rgba(255,200,180,.7)', 0);
  tube(SEC.artery + 4, 1.5, 'rgba(110,100,255,.1)', 'rgba(120,104,240,.62)', 'rgba(196,186,255,.5)', 1.2);
  tube(SEC.artery - 5.5, 0.5, 'rgba(255,230,150,.1)', 'rgba(255,236,170,.55)', 'rgba(255,250,220,.6)', 2.4);
}

function dermis(ctx: CanvasRenderingContext2D, loops: boolean): void {
  const [d0, d1] = SEC.dermis;
  const g = ctx.createLinearGradient(0, d0, 0, d1);
  g.addColorStop(0, '#5a1f4c');
  g.addColorStop(0.3, '#481a44');
  g.addColorStop(1, '#36143a');
  band(ctx, d0 - 1, d1, g);
  // collagen: soft wavy bundles that catch the light
  for (let i = 0; i < 230; i++) {
    const x = X0 + hash(i * 19 + 21) * (X1 - X0), y = d0 + 4 + hash(i * 23 + 22) * (d1 - d0 - 5);
    const l = 6 + 10 * hash(i + 23);
    ctx.strokeStyle = i % 4 ? 'rgba(255,170,214,.1)' : 'rgba(255,214,236,.18)';
    ctx.lineWidth = i % 4 ? 0.45 : 0.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + l * 0.3, y - 1, x + l * 0.6, y + 1, x + l, y);
    ctx.stroke();
  }
  if (loops) {
    // the close-up: hairpin capillary loops up into the dermal papillae, under the epidermis
    const op = ctx.globalCompositeOperation;
    for (let x = -40; x <= 40; x += (2 * Math.PI) / 0.55) {
      const c = x + Math.PI / 2 / 0.55 - (2 * Math.PI) / 0.55 / 2;
      const p = new Path2D();
      p.moveTo(c - 0.8, 12);
      p.bezierCurveTo(c - 0.9, 8, c - 0.6, 6.2, c, 6);
      p.bezierCurveTo(c + 0.6, 6.2, c + 0.9, 8, c + 0.8, 12);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,70,100,.25)';
      ctx.lineWidth = 0.7;
      ctx.stroke(p);
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = 'rgba(255,150,150,.6)';
      ctx.lineWidth = 0.18;
      ctx.stroke(p);
    }
  }
}

/** The epidermis's lower edge: it dips between the dermal papillae (the rete ridges). */
export const epiBottom = (x: number): number => SEC.epi[1] + 0.75 * Math.sin(x * 0.55);

function epidermis(ctx: CanvasRenderingContext2D, bare: boolean): void {
  ctx.beginPath();
  ctx.moveTo(X0, 0);
  for (let x = X0; x <= X1; x += 1) ctx.lineTo(x, epiBottom(x));
  ctx.lineTo(X1, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, SEC.epi[1] + 1);
  g.addColorStop(0, 'rgba(255,236,226,.95)');
  g.addColorStop(0.25, 'rgba(255,198,190,.86)');
  g.addColorStop(1, 'rgba(226,120,160,.72)');
  ctx.fillStyle = g;
  ctx.fill();
  if (!bare) {
    // the horny layer, pale, and a hint of cells
    ctx.fillStyle = 'rgba(255,250,246,.55)';
    ctx.fillRect(X0, 0, X1 - X0, 0.7);
    for (let i = 0; i < 520; i++) {
      const x = X0 + hash(i * 29 + 31) * (X1 - X0), y = 1.2 + hash(i * 31 + 32) * 3.2;
      ctx.beginPath();
      ctx.arc(x, y, 0.32, 0, TAU);
      ctx.fillStyle = 'rgba(170,90,140,.22)';
      ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255,246,236,.9)';
  ctx.lineWidth = 0.3;
  line(ctx, 0);
}

// ── a follicle of the section ────────────────────────────────────
interface Shape { len: number; bulb: number; club: boolean }

/** A section follicle's shape in a phase of its cycle: its depth, its bulb (1 whole … 0 a club), a resting club hair. */
export function shapeOf(f: SecFollicle, p: { phase: Phase; k: number }): Shape {
  const rest = 22;
  if (p.phase === 'anagen') {
    // early anagen: the new lower follicle grows down again
    const down = clamp(p.k / 0.12);
    return { len: rest + (f.len - rest) * ease.outCubic(down), bulb: 0.4 + 0.6 * down, club: false };
  }
  if (p.phase === 'catagen') return { len: f.len + (rest - f.len) * ease.inOutSine(p.k), bulb: 1 - p.k, club: p.k > 0.6 };
  return { len: rest, bulb: 0, club: true };
}

const PHASE_HUE: Readonly<Record<Phase, string>> = { anagen: GOLD, catagen: ROSE, telogen: LILAC };
export const phaseHue = (p: Phase): string => PHASE_HUE[p];

/**
 * One follicle of the section in a phase: the outer root sheath, the inner sheath, the hair (and its part above the
 * skin, `above` of its length), the bulb with its papilla — or, resting, a club hair with the papilla tucked under
 * it — the gland and the little muscle.
 */
export function secFollicle(ctx: CanvasRenderingContext2D, f: SecFollicle, p: { phase: Phase; k: number }, colour: HairColour, above: number, glowK = 0): void {
  const sh = shapeOf(f, p);
  const c = COLOUR[colour];
  const P = (v: number, u: number) => secPt(f, v, u);
  const quad = (from: number, to: number, r: number): Path2D => {
    const a = P(-r, from), b = P(r, from), cc = P(r, to), d = P(-r, to);
    const q = new Path2D();
    q.moveTo(a[0], a[1]);
    q.lineTo(b[0], b[1]);
    q.lineTo(cc[0], cc[1]);
    q.lineTo(d[0], d[1]);
    q.closePath();
    return q;
  };
  const bottom = sh.len;
  const op = ctx.globalCompositeOperation;
  // the arrector pili, from the bulge to under the epidermis (on the side of the obtuse angle)
  const m0 = P(2.6, 13), m1: Pt = [f.x + 8, 5.4];
  ctx.strokeStyle = 'rgba(255,150,140,.5)';
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(m0[0], m0[1]);
  ctx.quadraticCurveTo((m0[0] + m1[0]) / 2 + 1.5, (m0[1] + m1[1]) / 2 + 1, m1[0], m1[1]);
  ctx.stroke();
  // the sebaceous gland, two lobes by the canal, glowing gold
  for (const [v, u, r] of [[3.6, 7.5, 2.1], [4.3, 10.5, 2.3]] as const) {
    const q = P(v, u);
    glow(ctx, '#ffcf7a', q[0], q[1], r * 2.2, 0.22);
    ctx.beginPath();
    ctx.arc(q[0], q[1], r, 0, TAU);
    ctx.fillStyle = 'rgba(255,206,120,.45)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,.65)';
    ctx.lineWidth = 0.18;
    ctx.stroke();
  }
  // the outer sheath (translucent pearl, bright edges) and the inner one (rose)
  const ors = quad(0.5, Math.max(4, bottom - (sh.bulb > 0.1 ? 5 : 2)), 2.5);
  ctx.fillStyle = 'rgba(240,214,250,.3)';
  ctx.fill(ors);
  ctx.strokeStyle = 'rgba(250,232,255,.55)';
  ctx.lineWidth = 0.2;
  ctx.stroke(ors);
  if (!sh.club) {
    ctx.fillStyle = 'rgba(255,120,170,.48)';
    ctx.fill(quad(9, Math.max(9.5, bottom - 6), 1.55));
  }
  // the hair: from its base to the skin, and above it on the same slant, with its sheen
  const base = sh.club ? 14 : bottom - 7;
  const top = -16 * above;
  if (base > top) {
    ctx.fillStyle = mix(c.strand, c.sheen, 0.12);
    ctx.fill(quad(top, base, 0.85));
    const h0 = P(-0.3, top), h1 = P(-0.3, base);
    ctx.strokeStyle = rgba(c.sheen, 0.55);
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(h0[0], h0[1]);
    ctx.lineTo(h1[0], h1[1]);
    ctx.stroke();
  }
  if (sh.club) {
    // the club: a rounded brush at the hair's end, resting in the bulge
    const q = P(0, base);
    ctx.beginPath();
    ctx.arc(q[0], q[1], 1.5, 0, TAU);
    ctx.fillStyle = mix(c.strand, '#f6e6d8', 0.35);
    ctx.fill();
  }
  // the bulb with its papilla (shrinking as the follicle regresses), lit from within; or the papilla tucked under the club
  const b = P(0, bottom - 3.6);
  if (sh.bulb > 0.05) {
    const k = 0.5 + 0.5 * sh.bulb;
    glow(ctx, '#ffc0a0', b[0], b[1], 7.5 * k, 0.32);
    ctx.save();
    ctx.translate(b[0], b[1]);
    ctx.rotate(-SEC.th);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.4 * k, 4.4 * k, 0, 0, TAU);
    const bg = ctx.createRadialGradient(0, -0.5, 0.2, 0, 0, 4.4 * k);
    bg.addColorStop(0, 'rgba(255,236,220,.95)');
    bg.addColorStop(1, 'rgba(255,170,160,.6)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,232,.6)';
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0.9, 1.7 * (0.6 + 0.4 * sh.bulb), 2.3 * (0.6 + 0.4 * sh.bulb), 0, 0, TAU);
    ctx.fillStyle = 'rgba(200,100,230,.92)';
    ctx.fill();
    ctx.restore();
  } else {
    glow(ctx, '#c88cff', b[0], b[1] + 1, 4, 0.35);
    ctx.beginPath();
    ctx.arc(b[0], b[1] + 1, 1.5, 0, TAU);
    ctx.fillStyle = 'rgba(200,100,230,.85)';
    ctx.fill();
  }
  ctx.globalCompositeOperation = op;
  if (glowK > 0.01) glow(ctx, PHASE_HUE[p.phase], b[0], b[1], 6, 0.5 * glowK);
}

// ── the capillary net ────────────────────────────────────────────
interface Vessel { pts: Pt[]; t0: number; w: number; papilla?: number }

let net: Vessel[] | null = null;

/** The capillary net in the order it grows: up from the deep arteries, across the plexuses, loops into the skin, round the follicles, into every papilla. */
export function capillaries(): Vessel[] {
  if (net) return net;
  const out: Vessel[] = [];
  const wig = (x0: number, y0: number, x1: number, y1: number, n: number, amp: number, seed: number): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      pts.push([x0 + (x1 - x0) * k + amp * (hash(seed * 7 + i) - 0.5), y0 + (y1 - y0) * k + amp * 0.4 * (hash(seed * 11 + i) - 0.5)]);
    }
    return pts;
  };
  const cols = [-150, -120, -88, -66, -40, -14, 14, 38, 66, 88, 120, 150];
  cols.forEach((x, i) => out.push({ pts: wig(x, SEC.artery, x + 3 * (hash(i) - 0.5), 32, 6, 3, i + 1), t0: 0.02 * i, w: 0.75 }));
  for (let s = 0; s < 10; s++) out.push({ pts: wig(-160 + s * 32, 32 + (s % 2), -128 + s * 32, 32 - (s % 2), 8, 2, 20 + s), t0: 0.16 + 0.015 * s, w: 0.6 });
  cols.forEach((x, i) => out.push({ pts: wig(x + 6, 32, x + 4, 9, 8, 2.5, 40 + i), t0: 0.3 + 0.02 * i, w: 0.5 }));
  for (let s = 0; s < 10; s++) out.push({ pts: wig(-160 + s * 32, 8.6, -128 + s * 32, 8.6, 10, 1.4, 60 + s), t0: 0.46 + 0.012 * s, w: 0.42 });
  // hairpin loops up into the dermal papillae, under every crest of the skin's lower edge
  let n = 0;
  for (let x = -160; x <= 160; x += (2 * Math.PI) / 0.55) {
    const crest = x + Math.PI / 2 / 0.55 - (2 * Math.PI) / 0.55 / 2;
    out.push({ pts: [[crest - 0.7, 8.6], [crest - 0.6, 6.2], [crest, 5.6], [crest + 0.6, 6.2], [crest + 0.7, 8.6]], t0: 0.56 + 0.12 * hash(n++ + 70), w: 0.32 });
  }
  // round every follicle, and the loop into its papilla
  SEC_FOLLICLES.forEach((f, i) => {
    for (const side of [-1, 1]) {
      const pts: Pt[] = [];
      for (let k = 0; k <= 8; k++) {
        const u = 6 + (f.len - 12) * (k / 8);
        pts.push(secPt(f, side * (3.1 + 0.5 * Math.sin(k * 1.7 + i)), u));
      }
      out.push({ pts, t0: 0.64 + (0.13 * i) / SEC_FOLLICLES.length, w: 0.3 });
    }
    const b = f.len - 2.2;
    out.push({ pts: [secPt(f, -0.6, b + 3), secPt(f, -0.5, b), secPt(f, 0, b - 1.5), secPt(f, 0.5, b), secPt(f, 0.6, b + 3)], t0: 0.8 + (0.17 * i) / SEC_FOLLICLES.length, w: 0.34, papilla: i });
  });
  net = out;
  return out;
}

/** When each follicle's papilla is reached by its loop (the growth at which it lights). */
export const papillaLit = (i: number): number => 0.8 + (0.17 * i) / SEC_FOLLICLES.length + 0.04;

function drawNet(ctx: CanvasRenderingContext2D, g: number, st: WorldState): void {
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const v of capillaries()) {
    const r = clamp((g - v.t0) / 0.07);
    if (r <= 0) continue;
    const p = new Path2D();
    smoothPath(p, v.pts);
    let L = 0;
    for (let i = 1; i < v.pts.length; i++) L += Math.hypot(v.pts[i][0] - v.pts[i - 1][0], v.pts[i][1] - v.pts[i - 1][1]);
    if (r < 1) ctx.setLineDash([L * r, L * 2]);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(BLOOD, 0.22 + 0.1 * st.deep);
    ctx.lineWidth = v.w * 2.6;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(mix(BLOOD_HI, GOLD_HI, 0.25), 0.85);
    ctx.lineWidth = v.w;
    ctx.stroke(p);
    ctx.setLineDash([]);
  }
}

// ── the epidermis close up ───────────────────────────────────────
/**
 * The epidermis renewing: in each column cells are born at the base, rise, flatten and flake off at the top.  `o` is
 * how far the conveyor has run (in rows): it runs only while the scene grows; cells born in this scene shine.
 */
function drawEpi(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const rows = 5.4;
  const o = st.g * 6;
  const cols = 15, step = 2.25;
  for (let c = 0; c < cols; c++) {
    const x0 = -16.5 + c * step;
    const oc = o + 0.37 * c;
    const bMin = Math.ceil(oc - rows - 1.2), bMax = Math.floor(oc);
    for (let b = bMin; b <= bMax; b++) {
      const h = oc - b;
      const born = b > Math.floor(0.37 * c);
      // cells sit like bricks: every other one half a cell aside
      const x = x0 + (b % 2 ? step / 2 : 0) + 0.25 * Math.sin(b * 1.3 + c);
      let y = epiBottom(x) - 0.55 - h * 0.86;
      let a = 1;
      if (h > rows) {
        // a flake leaving the surface
        y = epiBottom(x) - 0.55 - rows * 0.86 - (h - rows) * 3.2;
        a = clamp(1 - (h - rows) / 1.2);
      }
      if (a <= 0.01) continue;
      const hh = Math.min(h, rows);
      const w = 2.05 + 0.42 * hh, ht = Math.max(0.24, 1.35 - 0.22 * hh);
      const tone = h < 1 ? '#b88ae8' : h < 3 ? '#ffb2c2' : h < 3.9 ? '#ffd4ba' : '#fff2ea';
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, ht / 2, 0, 0, TAU);
      ctx.fillStyle = rgba(tone, 0.86 * a);
      ctx.fill();
      ctx.strokeStyle = rgba(born ? GOLD_HI : '#6a3a6a', (born ? 0.75 : 0.4) * a);
      ctx.lineWidth = born ? 0.11 : 0.07;
      ctx.stroke();
      if (h < 3.4) {
        // the nucleus (gone once the cell hardens)
        ctx.beginPath();
        ctx.ellipse(x, y, Math.min(0.42, ht * 0.32) * 1.2, Math.min(0.42, ht * 0.32), 0, 0, TAU);
        ctx.fillStyle = rgba('#5a2a7a', 0.65 * a);
        ctx.fill();
      } else if (h < 3.9) {
        // granules of the granular layer
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.arc(x + k * 0.38, y + 0.04 * k, 0.09, 0, TAU);
          ctx.fillStyle = rgba('#5a2a5a', 0.75 * a);
          ctx.fill();
        }
      }
      if (h < 0.35 && st.growing) glow(ctx, GOLD, x, y, 1.6, 0.5 * (1 - h / 0.35));
    }
  }
}

// ── the frame of each scene ──────────────────────────────────────
export function drawSection(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const { scene, g } = st;
  if (scene === 'siec') {
    drawNet(ctx, g, st);
    SEC_FOLLICLES.forEach((f, i) => {
      const lit = clamp((g - papillaLit(i)) / 0.05);
      if (lit > 0) {
        const b = secPt(f, 0, f.len - 2.6);
        glow(ctx, ROSE, b[0], b[1], 5, 0.55 * lit + 0.2 * st.deep);
        glow(ctx, GOLD_HI, b[0], b[1], 2.2, 0.6 * lit);
      }
    });
  } else if (scene === 'korzenie') {
    SEC_FOLLICLES.forEach((f, i) => {
      const lit = ease.outCubic(clamp((g - (i / SEC_FOLLICLES.length) * 0.86) / 0.12));
      if (lit <= 0) return;
      const b = secPt(f, 0, f.len - 2.6);
      const loop = new Path2D();
      const L = f.len - 2.2;
      smoothPath(loop, [secPt(f, -0.6, L + 3), secPt(f, -0.5, L), secPt(f, 0, L - 1.5), secPt(f, 0.5, L), secPt(f, 0.6, L + 3)]);
      ctx.strokeStyle = rgba(BLOOD_HI, 0.85 * lit);
      ctx.lineWidth = 0.4;
      ctx.stroke(loop);
      glow(ctx, '#e08ae8', b[0], b[1], 6, 0.5 * lit + 0.25 * st.deep);
      glow(ctx, GOLD_HI, b[0], b[1], 2.6, 0.75 * lit);
    });
  } else if (scene === 'wyrastanie') {
    const c = COLOUR[st.colour];
    SEC_FOLLICLES.forEach((f, i) => {
      const k = ease.outCubic(clamp((g - (i / SEC_FOLLICLES.length) * 0.38) / 0.6));
      if (k <= 0) return;
      const a = secPt(f, 0, 0), b = secPt(f, 0, -16 * k);
      ctx.lineCap = 'round';
      ctx.strokeStyle = mix(c.strand, c.sheen, 0.1);
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      ctx.strokeStyle = rgba(c.sheen, 0.5 + 0.2 * st.deep);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(a[0] + 0.35, a[1]);
      ctx.lineTo(b[0] + 0.35, b[1]);
      ctx.stroke();
      if (st.growing) {
        const bb = secPt(f, 0, f.len - 4);
        glow(ctx, GOLD, bb[0], bb[1], 4.5, 0.5);
      }
    });
  } else if (scene === 'mozaika') {
    const T = 0.62 * g;
    SEC_FOLLICLES.forEach(f => {
      const ph = phaseAt(f.phase + T * f.speed);
      secFollicle(ctx, f, ph, st.colour, ph.phase === 'telogen' ? 0.85 : 1, 0.55 + 0.3 * st.light * (st.growing ? 1 : 0.4));
    });
  } else if (scene === 'naskorek') drawEpi(ctx, st);
  if (st.deep > 0.02) glow(ctx, '#ffb08a', 0, 20, 60, 0.1 * st.deep);
  if (scene === 'naskorek' && st.deep > 0.02) glow(ctx, AQUA, 0, 2, 12, 0.06 * st.deep);
  if (scene !== 'naskorek' && st.deep > 0.3) glow(ctx, PEARL, 0, 60, 40, 0.05 * st.deep);
}

/** The counts of the mosaic's phases at a growth (for its legend). */
export function mosaicCounts(g: number): Record<Phase, number> {
  const out: Record<Phase, number> = { anagen: 0, catagen: 0, telogen: 0 };
  for (const f of SEC_FOLLICLES) if (Math.abs(f.x) <= 84) out[phaseAt(f.phase + 0.62 * g * f.speed).phase]++;
  return out;
}
