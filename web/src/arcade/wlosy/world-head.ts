/**
 * The head in profile (DESIGN.md §15): a luminous head facing left, no features but the line of the face — the
 * cap of the galea over the skull between the frontal and the occipital belly of the occipitofrontalis, the five
 * arteries of the scalp coming up from the forehead, the temple, behind the ear and the back of the head and joining
 * over the crown, and the hair lying in its streams.  Drawn in the head's own units (geo.ts); the still parts are
 * baked by the view, what grows is drawn each frame.
 *
 *   czepiec   the two bellies glow from cool (tense) to warm (soft), the galea's fibres loosen, warmth spreads
 *   tetnice   the five arteries fill one after another with warm blood, then their joins over the crown
 *   cieplo    all five fill together and the whole scalp warms
 *   glowa     the hair grows to its length in the player's colour and the head lifts a little
 */
import { clamp, ease } from '../kit/juice';
import { COLOUR, type SceneId } from './content';
import { ANASTOMOSES, ARTERIES, ARTERY_PATHS, EAR, PROFILE, SKULL, hash, type Pt } from './geo';
import { BLOOD, BLOOD_HI, GOLD, GOLD_HI, PEARL, ROSE, TAU, glow, layer, mix, polyAt, polyLen, rgba, smoothPath } from './paint';
import type { WorldState } from './world';

// ── the shapes, built once ───────────────────────────────────────
let profileP: Path2D | null = null;
let earP: Path2D | null = null;
let skullP: Path2D | null = null;

function cubicPath(pts: readonly Pt[], close: boolean): Path2D {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i + 2 < pts.length; i += 3) p.bezierCurveTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], pts[i + 2][0], pts[i + 2][1]);
  if (close) p.closePath();
  return p;
}

export const profilePath = (): Path2D => (profileP ??= cubicPath(PROFILE, true));
const earPath = (): Path2D => (earP ??= cubicPath(EAR, false));
function skullPath(): Path2D {
  if (skullP) return skullP;
  const p = new Path2D();
  smoothPath(p, SKULL);
  skullP = p;
  return p;
}

/** The skull as an ellipse (centre, radii) for the hair that lies on it. */
const SK = { cx: 4, cy: -16, rx: 44, ry: 47 };
/** The crown's whorl seen from the side: the hair flows away from it. */
const WHORL_P: Pt = [13, -60];

/** The hairline in profile: the forehead, the temple down to the sideburn, above the ear, behind it down to the nape. */
const LINE: readonly Pt[] = [[-34, -40], [-26, -36.5], [-18, -34.5], [-9, -29], [-2, -20], [2, -10], [4, -6]];
export function hairlineY(x: number): number {
  if (x < LINE[0][0]) return LINE[0][1];
  for (let i = 1; i < LINE.length; i++) {
    if (x <= LINE[i][0]) {
      const [x0, y0] = LINE[i - 1], [x1, y1] = LINE[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  if (x < 25) return -14.5;
  return Math.min(15, -14.5 + (x - 25) * 1.5);
}

const inSkull = (x: number, y: number, k = 1): boolean => ((x - SK.cx) / (SK.rx * k)) ** 2 + ((y - SK.cy) / (SK.ry * k)) ** 2 <= 1;

export interface ProfileStrand { pts: Pt[]; tone: number; top: boolean }

let strandsP: ProfileStrand[] | null = null;

/**
 * The hair in profile: roots over the side of the head above the hairline (the ear left free), each strand flowing
 * away from the crown's whorl and settling a little with its weight; the ones at the head's edge lift slightly off it
 * (the hair's volume).
 */
export function profileStrands(): ProfileStrand[] {
  if (strandsP) return strandsP;
  const out: ProfileStrand[] = [];
  const step = 2.5;
  let k = 0;
  for (let gx = -44; gx <= 50; gx += step) {
    for (let gy = -67; gy <= 18; gy += step) {
      k++;
      const x = gx + step * (hash(k * 3 + 1) - 0.5), y = gy + step * (hash(k * 5 + 2) - 0.5);
      if (!inSkull(x, y, 0.985) || y > hairlineY(x)) continue;
      if (x > 7 && x < 26 && y > -15) continue;
      let dx = x - WHORL_P[0], dy = y - WHORL_P[1];
      const d = Math.hypot(dx, dy);
      if (d < 4) {
        const a = hash(k * 7 + 3) * Math.PI * 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
      const n = Math.hypot(dx, dy) || 1;
      let vx = dx / n, vy = dy / n;
      // near the head's edge the hair lifts off it a little (volume)
      const edge = inSkull(x, y, 0.9) ? 0 : 1;
      const ox = (x - SK.cx) / SK.rx, oy = (y - SK.cy) / SK.ry, on = Math.hypot(ox, oy) || 1;
      const len = 7 + 6 * hash(k * 11 + 4) + 5 * Math.min(1, d / 40);
      // each strand has its own gentle curl and wave
      const curl = (hash(k * 17 + 6) - 0.5) * 0.16;
      const wave = 0.35 + 0.6 * hash(k * 19 + 7), ph = hash(k * 23 + 8) * 6.28;
      const pts: Pt[] = [[x, y]];
      let px = x, py = y;
      for (let i = 0; i < 7; i++) {
        vy += 0.09;
        vx += edge * 0.12 * (ox / on);
        vy += edge * 0.05 * (oy / on);
        const ca = Math.cos(curl), sa = Math.sin(curl);
        [vx, vy] = [vx * ca - vy * sa, vx * sa + vy * ca];
        const m = Math.hypot(vx, vy) || 1;
        vx /= m;
        vy /= m;
        const wv = wave * Math.sin(i * 1.3 + ph) * 0.35;
        px += vx * (len / 7) - vy * wv;
        py += vy * (len / 7) + vx * wv;
        pts.push([px, py]);
      }
      out.push({ pts, tone: hash(k * 13 + 5), top: y < -44 });
    }
  }
  strandsP = out;
  return out;
}

let capP: Path2D | null = null;

/** The hair's cap seen from the side: over the skull from the forehead's hairline to the nape, down to the hairline. */
export function hairCap(): Path2D {
  if (capP) return capP;
  const p = new Path2D();
  const front = (209 * Math.PI) / 180, back = (382 * Math.PI) / 180;
  for (let i = 0; i <= 40; i++) {
    const a = front + (back - front) * (i / 40);
    const r = 1.04;
    const x = SK.cx + SK.rx * r * Math.cos(a), y = SK.cy + SK.ry * r * Math.sin(a);
    if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
  }
  // down the back to the nape, round above the ear, the sideburn, the temple's curve, the forehead
  const line: readonly Pt[] = [[44, 12], [36, 2.5], [27, -12], [17, -15.5], [8, -14.5], [5, -9], [4, -6], [2, -10], [-2, -20], [-9, -29], [-18, -34.5], [-26, -36.5], [-34, -40]];
  p.lineTo(line[0][0], line[0][1]);
  smoothPath(p, line, false);
  p.closePath();
  capP = p;
  return p;
}

// ── the still picture ────────────────────────────────────────────
/**
 * The head's still parts, in its units: a warm glow behind it, the translucent head lit from within (fading into
 * the ground at the neck), the skull's curve, the ear, the galea's ghost, the arteries' ghosts and a ghost of the
 * hair (`hair`: 0 none, else its alpha).
 */
export function bakeHead(ctx: CanvasRenderingContext2D, hair: number): void {
  const P = profilePath();
  glow(ctx, '#a0507a', 2, -10, 95, 0.22);
  glow(ctx, '#ffb39a', -2, -30, 55, 0.12);
  const body = ctx.createLinearGradient(0, -66, 0, 76);
  body.addColorStop(0, 'rgba(255,214,200,.24)');
  body.addColorStop(0.45, 'rgba(240,170,170,.2)');
  body.addColorStop(0.8, 'rgba(190,140,200,.12)');
  body.addColorStop(1, 'rgba(160,120,200,0)');
  ctx.fillStyle = body;
  ctx.fill(P);
  ctx.save();
  ctx.clip(P);
  // the light from within: warm at the crown and the brow, a cooler depth at the jaw
  glow(ctx, '#ffd2bc', 0, -36, 46, 0.2);
  glow(ctx, '#ff9fb0', -28, -4, 26, 0.12);
  glow(ctx, '#b08cff', 6, 30, 30, 0.1);
  ctx.restore();
  // the skull's curve inside, a breath of bone
  ctx.save();
  ctx.translate(2.2, 2.6);
  ctx.scale(0.94, 0.94);
  ctx.strokeStyle = 'rgba(240,226,255,.14)';
  ctx.lineWidth = 1.4;
  ctx.stroke(skullPath());
  ctx.restore();
  // the rim of light, warm above and pearl below
  const rim = ctx.createLinearGradient(0, -66, 0, 76);
  rim.addColorStop(0, 'rgba(255,226,196,.9)');
  rim.addColorStop(0.5, 'rgba(246,220,255,.62)');
  rim.addColorStop(0.85, 'rgba(206,190,255,.3)');
  rim.addColorStop(1, 'rgba(200,180,255,0)');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,200,220,.07)';
  ctx.lineWidth = 5;
  ctx.stroke(P);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 0.75;
  ctx.stroke(P);
  // the ear
  ctx.fillStyle = 'rgba(255,200,196,.08)';
  ctx.fill(earPath());
  ctx.strokeStyle = 'rgba(255,214,206,.45)';
  ctx.lineWidth = 0.7;
  ctx.stroke(earPath());
  // the galea's ghost along the skull, the arteries' ghosts
  ctx.strokeStyle = 'rgba(232,226,255,.12)';
  ctx.lineWidth = 2.6;
  ctx.stroke(skullPath());
  ctx.lineCap = 'round';
  for (const a of ARTERIES) {
    for (const line of ARTERY_PATHS[a]) {
      const p = new Path2D();
      smoothPath(p, line);
      ctx.strokeStyle = 'rgba(255,110,140,.16)';
      ctx.lineWidth = 1.5;
      ctx.stroke(p);
    }
  }
  if (hair > 0) {
    // a ghost of the hair, so the vessels read through it
    ctx.fillStyle = `rgba(236,220,255,${(hair * 0.5).toFixed(3)})`;
    ctx.fill(hairCap());
    ctx.strokeStyle = `rgba(236,220,255,${hair.toFixed(3)})`;
    ctx.lineWidth = 0.4;
    for (const s of profileStrands()) {
      const p = new Path2D();
      smoothPath(p, s.pts);
      ctx.stroke(p);
    }
  }
}

// ── what grows ───────────────────────────────────────────────────
const arteryPaths = new Map<string, { path: Path2D; pts: readonly Pt[]; len: number }>();
function artery(a: string, i: number, line: readonly Pt[]): { path: Path2D; pts: readonly Pt[]; len: number } {
  const key = `${a}${i}`;
  let hit = arteryPaths.get(key);
  if (!hit) {
    const path = new Path2D();
    smoothPath(path, line);
    hit = { path, pts: line, len: polyLen(line) };
    arteryPaths.set(key, hit);
  }
  return hit;
}

/** How full each artery is at a growth: one after another (tetnice), or all together (cieplo). */
export function arteryFill(scene: SceneId, g: number): number[] {
  if (scene === 'cieplo') return ARTERIES.map(() => ease.inOutSine(clamp(g / 0.75)));
  if (scene !== 'tetnice') return ARTERIES.map(() => 0);
  return ARTERIES.map((_, i) => ease.inOutSine(clamp((g - i * 0.18) / 0.2)));
}

/** The head's lift in the last scene (radians, up = negative). */
export const headLift = (scene: SceneId, g: number): number => (scene === 'glowa' ? -0.12 * ease.inOutSine(clamp(g)) : 0);

export function drawHead(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const { scene, g, time } = st;
  const deep = st.deep;
  // warmth over the scalp: grows with the scene and deepens in rest
  const warm = scene === 'czepiec' ? g : scene === 'tetnice' ? g * 0.8 : scene === 'cieplo' ? g : scene === 'glowa' ? 0.6 + 0.4 * g : 0.3;
  const w = clamp(0.25 * warm + 0.3 * deep);
  if (w > 0.01) {
    for (let i = 0; i < SKULL.length; i += 2) glow(ctx, i % 4 ? '#ffb08a' : '#ff8f9a', SKULL[i][0], SKULL[i][1], 16, 0.16 * w);
    glow(ctx, '#ffcfa0', 4, -50, 34, 0.18 * w);
  }
  if (scene === 'czepiec') drawGalea(ctx, g, time, deep, st.reduced);
  if (scene === 'tetnice' || scene === 'cieplo') drawArteries(ctx, arteryFill(scene, g), scene === 'tetnice' && g > 0.9 ? (g - 0.9) / 0.1 : scene === 'cieplo' ? clamp((g - 0.6) / 0.4) : 0, time, st);
  if (scene === 'glowa') drawHair(ctx, st);
}

/** The galea and the two bellies of the occipitofrontalis: tense and cool at the start, soft and warm as it grows. */
function drawGalea(ctx: CanvasRenderingContext2D, g: number, time: number, deep: number, reduced: boolean): void {
  const soft = ease.inOutSine(clamp(g));
  // the fibres of the galea along the skull, from taut lines to soft, warm, gently waving ones
  for (let k = 0; k < 4; k++) {
    const off = 0.9 + k * 1.1;
    const p = new Path2D();
    const pts: Pt[] = SKULL.map(([x, y], i) => {
      const dx = x - SK.cx, dy = y - SK.cy, r = Math.hypot(dx, dy) || 1;
      const wave = reduced ? 0 : soft * 0.5 * Math.sin(i * 1.7 + time * 0.8 + k);
      return [x + (dx / r) * (off + wave), y + (dy / r) * (off + wave)];
    });
    smoothPath(p, pts);
    ctx.strokeStyle = rgba(mix('#d8e0ff', '#ffc6a0', soft), 0.28 + 0.2 * soft + 0.1 * deep);
    ctx.lineWidth = 0.45 + 0.25 * soft;
    ctx.stroke(p);
  }
  // the warmth spreading from both bellies over the cap toward the crown
  const reach = soft;
  for (let i = 0; i <= 10; i++) {
    const k = i / 10;
    if (k > reach) break;
    const [fx, fy] = polyAt(SKULL, k * 0.5);
    const [bx, by] = polyAt(SKULL, 1 - k * 0.5);
    glow(ctx, GOLD, fx, fy, 7, 0.22 * (1 - 0.4 * k));
    glow(ctx, GOLD, bx, by, 7, 0.22 * (1 - 0.4 * k));
  }
  // the bellies: flat muscle under the skin of the forehead and of the back of the head — violet and taut at first,
  // warm rose as they let go; their fibres run along them
  for (const path of [FRONTAL, OCCIPITAL]) {
    const hue = mix('#9d86ff', '#ff9d94', soft);
    const p = new Path2D();
    smoothPath(p, path);
    const op = ctx.globalCompositeOperation;
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgba(hue, 0.18 + 0.12 * deep);
    ctx.lineWidth = 7;
    ctx.stroke(p);
    ctx.globalCompositeOperation = op;
    ctx.strokeStyle = rgba(hue, 0.42);
    ctx.lineWidth = 4.2;
    ctx.stroke(p);
    ctx.strokeStyle = rgba(mix('#e6dcff', '#ffe2d4', soft), 0.55);
    ctx.lineWidth = 0.28;
    for (const off of [-1.4, -0.45, 0.45, 1.4]) {
      const q = new Path2D();
      smoothPath(q, offsetLine(path, off + (reduced ? 0 : soft * 0.25 * Math.sin(time * 0.7 + off * 3))));
      ctx.stroke(q);
    }
  }
}

/** A polyline moved sideways by `d` (along its normals). */
function offsetLine(pts: readonly Pt[], d: number): Pt[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], n = Math.hypot(tx, ty) || 1;
    return [p[0] - (ty / n) * d, p[1] + (tx / n) * d];
  });
}

/** The frontal belly under the forehead's skin, the occipital belly at the back of the head (inside the outline). */
const FRONTAL: readonly Pt[] = [[-36.6, -15], [-37.4, -23], [-37.1, -31], [-35.4, -39], [-32.4, -45.5]];
const OCCIPITAL: readonly Pt[] = [[43.2, -3], [44.8, -12], [45, -21], [43.4, -30], [40, -37]];

/** The five arteries filling with warm blood (`fills` per artery), their joins over the crown (`joins`), pulses of light along them. */
function drawArteries(ctx: CanvasRenderingContext2D, fills: number[], joins: number, time: number, st: WorldState, k = 1): void {
  const op = ctx.globalCompositeOperation;
  ctx.lineCap = 'round';
  const beat = st.reduced ? 0.5 : 0.5 + 0.5 * Math.sin(time * TAU * 1.05);
  ARTERIES.forEach((a, ai) => {
    const f = fills[ai];
    if (f <= 0.001) return;
    ARTERY_PATHS[a].forEach((line, li) => {
      // a branch fills after the trunk reaches its fork
      const fk = li === 0 ? f : clamp((f - 0.45) / 0.55);
      if (fk <= 0) return;
      const A = artery(a, li, line);
      const L = A.len * 1.08;
      ctx.setLineDash([L * fk, L * 2]);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(BLOOD, (0.22 + 0.1 * beat + 0.1 * st.deep) * k);
      ctx.lineWidth = 3.4;
      ctx.stroke(A.path);
      ctx.globalCompositeOperation = op;
      ctx.strokeStyle = rgba(mix(BLOOD_HI, GOLD_HI, st.growing ? 0.35 : 0.1), 0.95 * k);
      ctx.lineWidth = 1.05;
      ctx.stroke(A.path);
      ctx.setLineDash([]);
      // light flowing toward the crown along the filled part
      for (let j = 0; j < 3; j++) {
        const q = ((time * 0.28 + j / 3 + ai * 0.17) % 1) * fk;
        const [x, y] = polyAt(A.pts, q);
        glow(ctx, GOLD_HI, x, y, 2.6, 0.55 * k);
      }
      // the front of the filling: a warm bead
      if (fk < 1) {
        const [x, y] = polyAt(A.pts, fk);
        glow(ctx, '#ffd0a0', x, y, 4.5, 0.9 * k);
      }
    });
  });
  if (joins > 0.01) {
    ctx.globalCompositeOperation = 'lighter';
    for (const [a, b] of ANASTOMOSES) {
      ctx.strokeStyle = rgba(ROSE, 0.55 * joins * k);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.quadraticCurveTo((a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 2.5, b[0], b[1]);
      ctx.stroke();
      glow(ctx, GOLD_HI, (a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 1.5, 3, 0.5 * joins * k);
    }
    ctx.globalCompositeOperation = op;
  }
}

/** The hair in the player's colour: its cap, then every strand grown from its root to its length; a sheen moves over it. */
/** The hair's box in the head's units (its layer covers it). */
const HAIR_BOX = { x: -50, y: -73, w: 102, h: 94 };
let hairLayer: { key: string; c: HTMLCanvasElement | null } | null = null;

/**
 * The hair in the player's colour: its cap, then every strand grown from its root to its length, a sheen passing over
 * it.  Hundreds of strands, so they are drawn into a layer at the screen's scale and redrawn only when the length,
 * the sheen or the depth has moved a step; a frame draws the layer.
 */
function drawHair(ctx: CanvasRenderingContext2D, st: WorldState): void {
  const g = clamp(st.g);
  const len = Math.round((0.3 + 0.7 * ease.outCubic(g)) * 40) / 40;
  const sheenAt = st.reduced ? 0.4 : Math.round(((st.time * 0.05) % 1.5 - 0.25) * 25) / 25;
  const T = ctx.getTransform();
  const sc = Math.max(0.5, Math.hypot(T.a, T.b));
  const key = `${Math.round(sc * 20)}|${st.colour}|${len}|${sheenAt}|${Math.round(st.deep * 8)}|${Math.round(g * 10)}`;
  if (hairLayer?.key !== key) {
    const L = layer(HAIR_BOX.w * sc, HAIR_BOX.h * sc, 1);
    if (L) {
      L.ctx.setTransform(sc, 0, 0, sc, -HAIR_BOX.x * sc, -HAIR_BOX.y * sc);
      paintHair(L.ctx, st, len, sheenAt, sc);
    }
    hairLayer = { key, c: L?.c ?? null };
  }
  if (hairLayer.c) ctx.drawImage(hairLayer.c, HAIR_BOX.x, HAIR_BOX.y, HAIR_BOX.w, HAIR_BOX.h);
  glow(ctx, GOLD_HI, 4, -66, 30, 0.12 + 0.2 * g);
  glow(ctx, PEARL, 2, -72, 14, 0.08 + 0.14 * g);
}

/** The hair itself, in the head's units: the cap, the strands within it (their bodies, then their sheen), the cap's lit edge. */
function paintHair(ctx: CanvasRenderingContext2D, st: WorldState, len: number, sheenAt: number, sc: number): void {
  const c = COLOUR[st.colour];
  const g = clamp(st.g);
  const list = profileStrands();
  const cap = hairCap();
  const cg = ctx.createLinearGradient(-40, -66, 40, 10);
  cg.addColorStop(0, rgba(mix(c.strand, c.sheen, 0.25), 0.5 + 0.3 * g));
  cg.addColorStop(1, rgba(mix(c.strand, '#100810', 0.25), 0.5 + 0.3 * g));
  ctx.fillStyle = cg;
  ctx.fill(cap);
  const w = clamp(0.5 * sc, 0.8, 2) / sc;
  ctx.lineCap = 'round';
  // the strands stay within the cap: a neat silhouette, the texture inside it
  ctx.save();
  ctx.clip(cap);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (pass === 1 && i % 2) continue;
      const n = Math.max(1, Math.round(len * (s.pts.length - 1)));
      const p = new Path2D();
      smoothPath(p, s.pts.slice(0, n + 1));
      if (pass === 0) {
        ctx.strokeStyle = rgba(mix(c.strand, c.sheen, 0.08 + 0.25 * s.tone), 0.9);
        ctx.lineWidth = w;
      } else {
        // light from above and in front: the top of the head shines, a slow sheen passes along
        const x0 = (s.pts[0][0] + 44) / 94;
        const near = 1 - clamp(Math.abs(x0 - sheenAt) / 0.3);
        ctx.strokeStyle = rgba(c.sheen, ((s.top ? 0.26 : 0.1) + 0.28 * near) * (0.6 + 0.4 * s.tone) + 0.12 * st.deep);
        ctx.lineWidth = w * 0.5;
      }
      ctx.stroke(p);
    }
  }
  ctx.restore();
  // the cap's edge catches the light
  ctx.strokeStyle = rgba(c.sheen, 0.3 + 0.2 * g);
  ctx.lineWidth = w * 0.8;
  ctx.stroke(cap);
}
