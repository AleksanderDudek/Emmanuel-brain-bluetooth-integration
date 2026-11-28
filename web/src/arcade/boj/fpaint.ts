/**
 * Dobry bój through the boxer's eyes (DESIGN.md §29): the first-person camera and the painter that draws the rig's
 * 3-D joints (rig.ts — the very poses of the side view) from any angle: the opponent face on, the referee in three
 * quarters or in profile — depth-sorted capsules lit from the ring's light above, a front torso, a face with eyes —
 * and the player's own gloves at the foot of the screen.
 *
 * The world here is the player's frame: X forward (toward the opponent), Y up, Z to the player's right, in units of a
 * standing height; the player's root at 0.  A figure stands at a place (x, z) facing `yaw` (0 the player's way, π the
 * opponent's — toward the player): world = place + rotate(yaw) · joint × build.scale.
 *
 * The camera stands at the player's eyes pulled back a little (`BACK`): a real fighter's eye is so close to the other
 * that only a face and two gloves would fill the screen; a step back of the camera keeps the opponent whole from the
 * hips up — guard, shoulders, breathing, the eyes — and the player's own gloves are drawn at the screen's foot as a
 * fighter sees them, mapped from the rig (`ownGloves`): at rest in the corners, out into the frame as they strike (on
 * the rig's own path, landing exactly where the projection puts the target), up as they block.
 */
import type { Style } from './moves';
import { SKINS, TAU, clamp01, clampInt, hairColour, isHex, lerp, lit, mixHex, rgba, smooth } from './paint';
import type { Build, Joints, P3 } from './rig';
import type { Look } from './view';

// ── the camera ─────────────────────────────────────────────────────────────────────────

/** A perspective camera in the player's frame (see the header): position, turn, focal length (px), principal point. */
export interface FCam {
  x: number; y: number; z: number;
  /** + turns the view to the right, + looks up, + tilts the picture clockwise (rad) */
  yaw: number; pitch: number; roll: number;
  f: number; ox: number; oy: number;
  /** derived: the turns' cosines and sines */
  cy: number; sy: number; cp: number; sp: number; cr: number; sr: number;
}

/** The nearest depth drawn (units in front of the camera). */
export const NEAR = 0.06;

export function makeCam(o: { x: number; y: number; z: number; yaw?: number; pitch?: number; roll?: number; f: number; ox: number; oy: number }): FCam {
  const yaw = o.yaw ?? 0, pitch = o.pitch ?? 0, roll = o.roll ?? 0;
  return {
    x: o.x, y: o.y, z: o.z, yaw, pitch, roll, f: o.f, ox: o.ox, oy: o.oy,
    cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch), cr: Math.cos(roll), sr: Math.sin(roll),
  };
}

/** A projected point: screen x, y (px), the depth (units) and px per unit there (f / depth). */
export interface SP { x: number; y: number; d: number; k: number }

/** A world point in the camera's own axes: [right, up, forward]. */
export function camSpace(c: FCam, x: number, y: number, z: number): [number, number, number] {
  const dx = x - c.x, dy = y - c.y, dz = z - c.z;
  const f1 = dx * c.cy + dz * c.sy;
  const right = -dx * c.sy + dz * c.cy;
  const fwd = f1 * c.cp + dy * c.sp;
  const up = -f1 * c.sp + dy * c.cp;
  return [right, up, fwd];
}

/** A point in camera axes on the screen (the depth clamped to NEAR so nothing explodes; check `d` before trusting it). */
export function camToScreen(c: FCam, right: number, up: number, fwd: number): SP {
  const d = Math.max(NEAR, fwd);
  const u = (c.f * right) / d, v = (-c.f * up) / d;
  return { x: c.ox + u * c.cr - v * c.sr, y: c.oy + u * c.sr + v * c.cr, d: fwd, k: c.f / d };
}

export function project(c: FCam, x: number, y: number, z: number): SP {
  const [r, u, f] = camSpace(c, x, y, z);
  return camToScreen(c, r, u, f);
}

/** Where a figure stands and which way it faces (see the header). */
export interface Place { x: number; z: number; yaw: number }

/** A joint of a figure in the world. */
export function worldOf(j: P3, b: Build, pl: Place): P3 {
  const s = b.scale, c = Math.cos(pl.yaw), n = Math.sin(pl.yaw);
  const x = j[0] * s, z = j[2] * s;
  return [pl.x + c * x - n * z, j[1] * s, pl.z + n * x + c * z];
}

export const projJ = (cam: FCam, j: P3, b: Build, pl: Place): SP => { const w = worldOf(j, b, pl); return project(cam, w[0], w[1], w[2]); };

// ── the colours ────────────────────────────────────────────────────────────────────────

interface Tone { base: string; shade: string; hi: string }
interface FPal {
  skin: Tone; lip: string; kit: Tone; trim: string; glove: Tone; hair: string; boot: Tone; shirt: Tone; eye: string;
}
const tone = (b: string): Tone => ({ base: b, shade: lit(b, -0.32), hi: lit(b, 0.35) });
const palCache = new Map<string, FPal>();
/** The colours of a look (cached), as the side view's palette. */
export function fpPalette(look: Look): FPal {
  const key = `${look.skin}|${look.kit}|${look.gloves}|${look.hair}`;
  const hit = palCache.get(key);
  if (hit) return hit;
  const sk = SKINS[clampInt(look.skin, 0, 4)];
  const kit = isHex(look.kit) ? look.kit : '#3c5f9e';
  const glv = isHex(look.gloves) ? look.gloves : '#b8423a';
  const p: FPal = {
    skin: { base: sk.base, shade: sk.shade, hi: sk.hi }, lip: sk.lip,
    kit: tone(kit), trim: mixHex(kit, '#fff6e6', 0.78), glove: tone(glv),
    hair: hairColour(look.skin, look.hair), boot: tone(mixHex(kit, '#121014', 0.55)), shirt: tone('#ecebe6'),
    eye: look.skin <= 1 ? '#3a2a1e' : '#22160f',
  };
  palCache.set(key, p);
  return p;
}

/** A tone darkened for depth/shade (k 0..1 toward the dark). */
const dim = (t: Tone, k: number): Tone => (k <= 0.001 ? t : { base: lit(t.base, -k), shade: lit(t.shade, -k), hi: lit(t.hi, -k) });

// ── drawing helpers ─────────────────────────────────────────────────────────────────────

/** A capsule between two screen circles (the two circles and their tangents). */
export function capsulePath(ctx: CanvasRenderingContext2D, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): void {
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy);
  ctx.beginPath();
  if (d < Math.abs(ra - rb) + 1e-6) {
    ctx.arc(ax, ay, Math.max(ra, rb), 0, TAU);
    return;
  }
  const ang = Math.atan2(dy, dx);
  const th = Math.acos(Math.max(-1, Math.min(1, (ra - rb) / d)));
  ctx.arc(ax, ay, ra, ang + th, ang + TAU - th);
  ctx.arc(bx, by, rb, ang - th, ang + th);
  ctx.closePath();
}

/**
 * A shaded limb on the screen: the shade, the side toward the light above lit inside it, a thin highlight along the
 * lit edge (the side view's look, in screen space: the ring's light is over the fighters).
 */
export function limb(ctx: CanvasRenderingContext2D, ax: number, ay: number, ra: number, bx: number, by: number, rb: number, t: Tone, flat: string | null): void {
  if (!(ra > 0.2) && !(rb > 0.2)) return;
  capsulePath(ctx, ax, ay, ra, bx, by, rb);
  if (flat) { ctx.fillStyle = flat; ctx.fill(); return; }
  ctx.fillStyle = t.shade;
  ctx.fill();
  const dx = bx - ax, dy = by - ay;
  const d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  // the light is above: the normal pointing up the screen
  if (ny > 0) { nx = -nx; ny = -ny; }
  if (Math.abs(ny) < 0.25) { const s = nx >= 0 ? 1 : -1; nx = 0.6 * s; ny = -0.8; }
  const o = 0.3;
  capsulePath(ctx, ax + nx * ra * o, ay + ny * ra * o, ra * 0.72, bx + nx * rb * o, by + ny * rb * o, rb * 0.72);
  ctx.fillStyle = t.base;
  ctx.fill();
  ctx.strokeStyle = t.hi;
  ctx.globalAlpha *= 0.55;
  ctx.lineWidth = Math.max(0.6, Math.min(ra, rb) * 0.3);
  ctx.beginPath();
  ctx.moveTo(ax + nx * ra * 0.72, ay + ny * ra * 0.72);
  ctx.lineTo(bx + nx * rb * 0.72, by + ny * rb * 0.72);
  ctx.stroke();
  ctx.globalAlpha /= 0.55;
}

// ── a figure from any angle ───────────────────────────────────────────────────────────────

export interface FigureOpts {
  look: Look;
  style: Style;
  /** the referee: a white shirt and a bow tie, dark trousers, bare hands */
  referee?: boolean;
  /** world seconds (the blink, the breath) */
  time: number;
  /** one flat colour at an alpha (the double vision after a clean hit, the slow motion's ghost) */
  ghost?: { colour: string; alpha: number } | null;
  /** the hall's light on the figure 0..1 (the slow motion dims the world) */
  light?: number;
  /** a stable number for the figure (the blink's own rhythm) */
  seed?: number;
}

interface Item { d: number; draw: () => void }

/**
 * Draw a whole figure (the rig's solved joints `j`, its build, where it stands) through the camera: legs, the torso
 * with the trunks (and a sports top in a woman's division), the head with a face and hair, the arms and gloves —
 * sorted far to near, so the guard stands in front of the face and the far arm behind the body.
 */
export function paintFigure(ctx: CanvasRenderingContext2D, cam: FCam, j: Joints, b: Build, pl: Place, o: FigureOpts): void {
  const pal = fpPalette(o.look);
  const P = (q: P3): SP => projJ(cam, q, b, pl);
  const pts = {
    pel: P(j.pel), mid: P(j.mid), chest: P(j.chest), neck: P(j.neck), head: P(j.head),
    sL: P(j.sL), sR: P(j.sR), eL: P(j.eL), eR: P(j.eR), gL: P(j.gL), gR: P(j.gR),
    hL: P(j.hL), hR: P(j.hR), kL: P(j.kL), kR: P(j.kR), aL: P(j.aL), aR: P(j.aR),
  };
  // nothing behind the camera
  if (pts.chest.d < NEAR * 2 && pts.head.d < NEAR * 2) return;
  const flat = o.ghost ? o.ghost.colour : null;
  const lightK = clamp01(o.light ?? 1);
  const far = (d: number): number => clamp01((d - pts.chest.d) * 1.6) * 0.22 + (1 - lightK) * 0.25;
  const S = b.scale;
  const items: Item[] = [];
  const ok = (...ps: SP[]): boolean => ps.every(p => p.d > NEAR);
  ctx.save();
  if (o.ghost) ctx.globalAlpha = o.ghost.alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // the legs: the thigh with the trunks' leg over it, the shin and the foot (boots in the ring, bare feet in the cage)
  for (const side of ['L', 'R'] as const) {
    const h = side === 'L' ? pts.hL : pts.hR, k = side === 'L' ? pts.kL : pts.kR, a = side === 'L' ? pts.aL : pts.aR;
    if (!ok(h, k)) continue;
    items.push({ d: (h.d + k.d) / 2 + 0.01, draw: () => {
      const sk = dim(pal.skin, far((h.d + k.d) / 2));
      if (o.referee) {
        limb(ctx, h.x, h.y, b.rTh[0] * 1.12 * S * h.k, k.x, k.y, b.rTh[1] * 1.15 * S * k.k, dim(pal.kit, far(h.d)), flat);
        return;
      }
      limb(ctx, h.x, h.y, b.rTh[0] * S * h.k, k.x, k.y, b.rTh[1] * 1.06 * S * k.k, sk, flat);
      const len = o.style === 'mma' ? 0.7 : 0.46;
      const sx = lerp(h.x, k.x, len), sy = lerp(h.y, k.y, len), sk2 = lerp(h.k, k.k, len);
      const rHem = lerp(b.rTh[0], b.rTh[1], len) * (o.style === 'mma' ? 1.2 : 1.12) * S;
      limb(ctx, h.x, h.y, b.rTh[0] * 1.14 * S * h.k, sx, sy, rHem * sk2, dim(pal.kit, far(h.d)), flat);
      if (!flat) {
        // the hem's trim
        ctx.strokeStyle = rgba(pal.trim, 0.6);
        ctx.lineWidth = Math.max(1, 0.01 * S * sk2);
        const dx = k.x - h.x, dy = k.y - h.y, dl = Math.hypot(dx, dy) || 1;
        const nx = -dy / dl, ny = dx / dl, r = rHem * sk2 * 0.95;
        ctx.beginPath();
        ctx.moveTo(sx + nx * r, sy + ny * r);
        ctx.lineTo(sx - nx * r, sy - ny * r);
        ctx.stroke();
      }
    } });
    if (!ok(k, a)) continue;
    items.push({ d: (k.d + a.d) / 2 + 0.012, draw: () => {
      const d0 = (k.d + a.d) / 2;
      if (o.referee) {
        limb(ctx, k.x, k.y, b.rTh[1] * 1.12 * S * k.k, a.x, a.y, b.rSh[1] * 1.4 * S * a.k, dim(pal.kit, far(d0)), flat);
        ctx.fillStyle = flat ?? '#141216';
        ctx.beginPath();
        ctx.ellipse(a.x, a.y + 0.02 * S * a.k, 0.05 * S * a.k, 0.028 * S * a.k, 0, 0, TAU);
        ctx.fill();
        return;
      }
      limb(ctx, k.x, k.y, b.rSh[0] * S * k.k, a.x, a.y, b.rSh[1] * S * a.k, dim(pal.skin, far(d0)), flat);
      const boxing = o.style === 'boks';
      const ft = boxing ? dim(pal.boot, far(d0)) : dim(pal.skin, far(d0));
      // the foot, seen nearly end on: a rounded shape under the ankle (the boot's shaft up the shin)
      if (boxing) {
        const ux = k.x - a.x, uy = k.y - a.y, ul = Math.hypot(ux, uy) || 1;
        const tx = a.x + (ux / ul) * 0.085 * S * a.k, ty = a.y + (uy / ul) * 0.085 * S * a.k;
        limb(ctx, a.x, a.y, b.rSh[1] * 1.3 * S * a.k, tx, ty, b.rSh[1] * 1.22 * S * a.k, ft, flat);
      }
      ctx.fillStyle = flat ?? ft.base;
      ctx.beginPath();
      ctx.ellipse(a.x, a.y + 0.03 * S * a.k, 0.045 * S * a.k, 0.03 * S * a.k, 0, 0, TAU);
      ctx.fill();
    } });
  }

  // the torso (the braids and a bun behind it), the neck, the trunks
  items.push({ d: pts.chest.d + 0.015, draw: () => torso(ctx, pts, j, b, pal, o, flat, far) });
  // the head
  if (pts.head.d > NEAR) items.push({ d: pts.head.d - b.head * S * 0.6, draw: () => head(ctx, cam, pts, j, b, pl, pal, o, flat) });
  // the arms: the upper arm, the forearm and the glove (or a bare hand)
  for (const side of ['L', 'R'] as const) {
    const s = side === 'L' ? pts.sL : pts.sR, e = side === 'L' ? pts.eL : pts.eR, g = side === 'L' ? pts.gL : pts.gR;
    if (ok(s, e)) items.push({ d: (s.d + e.d) / 2, draw: () => {
      const sk = dim(pal.skin, far((s.d + e.d) / 2));
      // the shoulder's cap (the deltoid) and the upper arm; the referee's short sleeve
      if (o.referee) {
        limb(ctx, s.x, s.y, b.rUa[0] * 1.05 * S * s.k, e.x, e.y, b.rUa[1] * S * e.k, sk, flat);
        limb(ctx, s.x, s.y, b.rUa[0] * 1.32 * S * s.k, lerp(s.x, e.x, 0.6), lerp(s.y, e.y, 0.6), b.rUa[0] * 1.15 * S * lerp(s.k, e.k, 0.6), dim(pal.shirt, far(s.d)), flat);
        return;
      }
      limb(ctx, s.x, s.y, b.rUa[0] * 1.3 * S * s.k, lerp(s.x, e.x, 0.3), lerp(s.y, e.y, 0.3), b.rUa[0] * 1.08 * S * lerp(s.k, e.k, 0.3), sk, flat);
      limb(ctx, s.x, s.y, b.rUa[0] * 1.05 * S * s.k, e.x, e.y, b.rUa[1] * S * e.k, sk, flat);
    } });
    if (ok(e, g)) items.push({ d: (e.d + g.d) / 2 - 0.005, draw: () => {
      const sk = dim(pal.skin, far((e.d + g.d) / 2));
      limb(ctx, e.x, e.y, b.rFa[0] * S * e.k, g.x, g.y, b.rFa[1] * S * g.k, sk, flat);
    } });
    if (ok(g)) items.push({ d: g.d - 0.05 * S, draw: () => {
      if (o.referee) {
        ctx.fillStyle = flat ?? dim(pal.skin, far(g.d)).base;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 0.03 * S * g.k, 0, TAU);
        ctx.fill();
        return;
      }
      glove(ctx, e, g, b, pal, o.style, flat, far(g.d), side === 'L' ? 1 : -1, pl);
    } });
  }
  items.sort((a, c) => c.d - a.d);
  for (const it of items) it.draw();
  ctx.restore();
}

type Pts = Record<'pel' | 'mid' | 'chest' | 'neck' | 'head' | 'sL' | 'sR' | 'eL' | 'eR' | 'gL' | 'gR' | 'hL' | 'hR' | 'kL' | 'kR' | 'aL' | 'aR', SP>;

function torso(ctx: CanvasRenderingContext2D, p: Pts, j: Joints, b: Build, pal: FPal, o: FigureOpts, flat: string | null, far: (d: number) => number): void {
  const S = b.scale;
  const ref = !!o.referee;
  const sex = o.look.sex;
  // the body's own across-direction on the screen: from the right shoulder to the left (a mix with the hips' line)
  const ex0 = p.sL.x - p.sR.x, ey0 = p.sL.y - p.sR.y;
  const hx0 = p.hL.x - p.hR.x, hy0 = p.hL.y - p.hR.y;
  const el = Math.hypot(ex0, ey0) || 1, hl = Math.hypot(hx0, hy0) || 1;
  const ex = ex0 / el, ey = ey0 / el, hx = hx0 / hl, hy = hy0 / hl;
  const kC = p.chest.k, kM = p.mid.k, kP = p.pel.k;
  // the visible half-widths: the shoulders' span face on, the chest's depth in profile
  const span = el / 2, hipSpan = hl / 2;
  const wc = Math.max(span * 0.92, b.chest * S * kC * 1.12) + b.rUa[0] * S * kC * 0.35;
  const ww = Math.max(hipSpan * 0.95, b.waist * S * kM) + 0.004 * S * kM;
  const wh = Math.max(hipSpan + b.rTh[0] * S * kP * 0.75, b.waist * S * kP * 1.15);
  const rD = b.rUa[0] * 1.15 * S;
  const mid = p.mid, ch = p.chest, nk = p.neck, pel = p.pel;
  const cl = { x: lerp(mid.x, ch.x, 0.55), y: lerp(mid.y, ch.y, 0.55) };
  // braids hang behind the shoulders; a bun behind the head: both behind the body
  const hairK = o.look.hair;
  if (!flat && !ref && hairK === 2) {
    const R = b.head * S * p.head.k;
    ctx.strokeStyle = pal.hair;
    ctx.lineWidth = R * 0.22;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(p.head.x + s * R * 0.55, p.head.y + R * 0.2);
      ctx.quadraticCurveTo(p.head.x + s * R * 0.9, p.head.y + R * 1.2, p.head.x + s * R * 0.75, p.head.y + R * 2.1);
      ctx.stroke();
    }
  }
  // the neck
  limb(ctx, ch.x, ch.y, b.rNeck * 1.15 * S * kC, (nk.x + p.head.x) / 2, (nk.y + p.head.y) / 2, b.rNeck * S * nk.k, dim(pal.skin, 0.08), flat);
  const tone0 = ref ? pal.shirt : pal.skin;
  const T = dim(tone0, far(ch.d) * 0.5);
  // the trunk's outline: the shoulders' tops, the chest, the waist, the hips
  const shL = { x: p.sL.x + ex * rD * p.sL.k * 0.85, y: p.sL.y + ey * rD * p.sL.k * 0.85 - rD * p.sL.k * 0.35 };
  const shR = { x: p.sR.x - ex * rD * p.sR.k * 0.85, y: p.sR.y - ey * rD * p.sR.k * 0.85 - rD * p.sR.k * 0.35 };
  const nL = { x: nk.x + ex * b.rNeck * S * nk.k * 1.1, y: nk.y + ey * b.rNeck * S * nk.k * 1.1 + 0.012 * S * nk.k };
  const nR = { x: nk.x - ex * b.rNeck * S * nk.k * 1.1, y: nk.y - ey * b.rNeck * S * nk.k * 1.1 + 0.012 * S * nk.k };
  const cL = { x: cl.x + ex * wc, y: cl.y + ey * wc }, cR = { x: cl.x - ex * wc, y: cl.y - ey * wc };
  const mx = (ex + hx) / 2, my = (ey + hy) / 2, ml = Math.hypot(mx, my) || 1;
  const wL = { x: mid.x + (mx / ml) * ww, y: mid.y + (my / ml) * ww }, wR = { x: mid.x - (mx / ml) * ww, y: mid.y - (my / ml) * ww };
  const pL = { x: pel.x + hx * wh, y: pel.y + hy * wh + 0.02 * S * kP }, pR = { x: pel.x - hx * wh, y: pel.y - hy * wh + 0.02 * S * kP };
  ctx.beginPath();
  ctx.moveTo(nL.x, nL.y);
  ctx.quadraticCurveTo((nL.x + shL.x) / 2, Math.min(nL.y, shL.y) - 0.004 * S * kC, shL.x, shL.y);
  ctx.quadraticCurveTo(shL.x + ex * rD * kC * 0.3, (shL.y + cL.y) / 2, cL.x, cL.y);
  ctx.quadraticCurveTo(wL.x + ex * 0.006 * S * kM, wL.y, wL.x, wL.y);
  ctx.lineTo(pL.x, pL.y);
  ctx.lineTo(pR.x, pR.y);
  ctx.lineTo(wR.x, wR.y);
  ctx.quadraticCurveTo(wR.x - ex * 0.006 * S * kM, wR.y, cR.x, cR.y);
  ctx.quadraticCurveTo(shR.x - ex * rD * kC * 0.3, (shR.y + cR.y) / 2, shR.x, shR.y);
  ctx.quadraticCurveTo((nR.x + shR.x) / 2, Math.min(nR.y, shR.y) - 0.004 * S * kC, nR.x, nR.y);
  ctx.closePath();
  ctx.fillStyle = flat ?? T.base;
  ctx.fill();
  if (!flat) {
    ctx.save();
    ctx.clip();
    // lit from above: the shoulders and the chest bright, the belly toward the shade
    const top = Math.min(shL.y, shR.y), bot = Math.max(pL.y, pR.y);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, rgba(T.hi, 0.55));
    g.addColorStop(0.35, rgba(T.base, 0));
    g.addColorStop(1, rgba(T.shade, 0.75));
    ctx.fillStyle = g;
    ctx.fillRect(Math.min(cL.x, cR.x, pL.x, pR.x) - 40, top - 20, Math.abs(cL.x - cR.x) + Math.abs(pL.x - pR.x) + 80, bot - top + 40);
    // the far side in shade (the shoulder further from the eye)
    const farL = p.sL.d > p.sR.d;
    const sideX = farL ? cL.x : cR.x, sideY = farL ? cL.y : cR.y, inX = farL ? cR.x : cL.x, inY = farL ? cR.y : cL.y;
    const gs = ctx.createLinearGradient(sideX, sideY, lerp(sideX, inX, 0.6), lerp(sideY, inY, 0.6));
    gs.addColorStop(0, rgba(T.shade, 0.7));
    gs.addColorStop(1, rgba(T.shade, 0));
    ctx.fillStyle = gs;
    ctx.fillRect(Math.min(cL.x, cR.x, pL.x, pR.x) - 40, top - 20, Math.abs(cL.x - cR.x) + Math.abs(pL.x - pR.x) + 80, bot - top + 40);
    // the body's quiet lines: the chest, the middle line of the belly (face on only)
    const face = Math.abs(ex) > 0.55;
    if (face && !ref) {
      ctx.strokeStyle = T.shade;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = Math.max(0.8, 0.007 * S * kC);
      ctx.beginPath();
      if (sex === 'on') {
        // the pectorals' lower line, the sternum, the belly's line
        for (const s of [1, -1]) {
          const ax = ch.x + s * ex * wc * 0.78, ay = ch.y + s * ey * wc * 0.78 + 0.05 * S * kC;
          ctx.moveTo(ax, ay - 0.02 * S * kC);
          ctx.quadraticCurveTo(ch.x + s * ex * wc * 0.45, ay + 0.035 * S * kC, ch.x + s * ex * 0.01 * S * kC, ay + 0.01 * S * kC);
        }
      }
      ctx.moveTo(ch.x, ch.y + 0.035 * S * kC);
      ctx.lineTo(mid.x, mid.y - 0.02 * S * kM);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  // the referee's bow tie
  if (ref && !flat) {
    const bx = nk.x, by = nk.y + 0.02 * S * nk.k, r = 0.022 * S * nk.k;
    ctx.fillStyle = '#121014';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx - r * 1.4, by - r * 0.7);
    ctx.lineTo(bx - r * 1.4, by + r * 0.7);
    ctx.closePath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + r * 1.4, by - r * 0.7);
    ctx.lineTo(bx + r * 1.4, by + r * 0.7);
    ctx.closePath();
    ctx.fill();
  }
  // the sports top (a woman's division): from under the arms to the bottom of the ribs
  if (sex === 'ona' && !ref) {
    const t0 = 0.25, t1 = 0.95;
    const yA = { x: lerp(ch.x, mid.x, t0) , y: lerp(ch.y, mid.y, t0) };
    const yB = { x: lerp(ch.x, mid.x, t1), y: lerp(ch.y, mid.y, t1) };
    const w0 = wc * 1.02, w1 = lerp(wc, ww, 0.8) * 1.02;
    ctx.beginPath();
    ctx.moveTo(nL.x + ex * 0.01 * S * kC, nL.y + 0.012 * S * kC);
    ctx.lineTo(yA.x + ex * w0, yA.y + ey * w0);
    ctx.lineTo(yB.x + ex * w1, yB.y + ey * w1);
    ctx.lineTo(yB.x - ex * w1, yB.y - ey * w1);
    ctx.lineTo(yA.x - ex * w0, yA.y - ey * w0);
    ctx.lineTo(nR.x - ex * 0.01 * S * kC, nR.y + 0.012 * S * kC);
    ctx.quadraticCurveTo(ch.x, ch.y + 0.03 * S * kC, nL.x + ex * 0.01 * S * kC, nL.y + 0.012 * S * kC);
    ctx.closePath();
    ctx.fillStyle = flat ?? pal.kit.base;
    ctx.fill();
    if (!flat) {
      ctx.strokeStyle = rgba(pal.trim, 0.75);
      ctx.lineWidth = Math.max(1, 0.011 * S * kC);
      ctx.beginPath();
      ctx.moveTo(yB.x + ex * w1, yB.y + ey * w1);
      ctx.lineTo(yB.x - ex * w1, yB.y - ey * w1);
      ctx.stroke();
    }
  }
  // the trunks / shorts over the pelvis with the waistband (the referee's trousers' top)
  const wbK = 0.3;
  const wb = { x: lerp(mid.x, pel.x, wbK), y: lerp(mid.y, pel.y, wbK) };
  const wbw = lerp(ww, wh, wbK) * 1.03;
  const crotch = { x: pel.x, y: pel.y + 0.075 * S * kP };
  ctx.beginPath();
  ctx.moveTo(wb.x + hx * wbw, wb.y + hy * wbw);
  ctx.lineTo(pL.x + hx * 0.01 * S * kP, pL.y + 0.035 * S * kP);
  ctx.lineTo(crotch.x, crotch.y);
  ctx.lineTo(pR.x - hx * 0.01 * S * kP, pR.y + 0.035 * S * kP);
  ctx.lineTo(wb.x - hx * wbw, wb.y - hy * wbw);
  ctx.closePath();
  ctx.fillStyle = flat ?? pal.kit.base;
  ctx.fill();
  if (!flat) {
    ctx.strokeStyle = ref ? '#121014' : pal.trim;
    ctx.lineWidth = Math.max(1.2, 0.02 * S * kM);
    ctx.beginPath();
    ctx.moveTo(wb.x + hx * wbw, wb.y + hy * wbw);
    ctx.lineTo(wb.x - hx * wbw, wb.y - hy * wbw);
    ctx.stroke();
  }
  void j;
}

function head(ctx: CanvasRenderingContext2D, cam: FCam, p: Pts, j: Joints, b: Build, pl: Place, pal: FPal, o: FigureOpts, flat: string | null): void {
  const S = b.scale;
  const H = p.head;
  const R = b.head * S * H.k;
  if (R < 0.8) return;
  // which way the face looks: the figure's forward against the line from the head to the eye
  const fx = Math.cos(pl.yaw), fz = Math.sin(pl.yaw);
  const hw = worldOf(j.head, b, pl);
  const tx = cam.x - hw[0], tz = cam.z - hw[2], tl = Math.hypot(tx, tz) || 1;
  const cosA = (fx * tx + fz * tz) / tl;
  // + : the face turns toward the screen's right
  const sinA = (fx * tz - fz * tx) / tl;
  const side = -sinA;
  const hair = o.look.hair;
  const tilt = clamp01((j.tilt + 0.2) / 1.0) - 0.4;
  ctx.save();
  ctx.translate(H.x, H.y);
  // a bun behind the top of the head
  if (!flat && !o.referee && hair === 1) {
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.arc(-side * R * 0.25, -R * 0.88, R * 0.34, 0, TAU);
    ctx.fill();
  }
  // the ears (behind the face's edge)
  if (!flat && cosA > -0.2) {
    ctx.fillStyle = pal.skin.shade;
    for (const s of [-1, 1]) {
      const ux = s * 0.93 * Math.max(0.25, Math.abs(cosA)) + side * 0.25;
      if (Math.abs(ux) > 1.05) continue;
      ctx.beginPath();
      ctx.ellipse(ux * R, R * 0.08, R * 0.15, R * 0.25, 0, 0, TAU);
      ctx.fill();
    }
  }
  // the head: a skull and a jaw a little narrower
  const rx = R * 0.9, ry = R * 1.06;
  ctx.beginPath();
  ctx.moveTo(-rx, -R * 0.05);
  ctx.bezierCurveTo(-rx, -ry * 1.02, rx, -ry * 1.02, rx, -R * 0.05);
  ctx.bezierCurveTo(rx, R * 0.55, R * 0.42, ry, 0, ry);
  ctx.bezierCurveTo(-R * 0.42, ry, -rx, R * 0.55, -rx, -R * 0.05);
  ctx.closePath();
  ctx.fillStyle = flat ?? pal.skin.base;
  ctx.fill();
  if (!flat) {
    ctx.save();
    ctx.clip();
    const g = ctx.createRadialGradient(side * R * 0.25, -R * 0.45, R * 0.1, 0, R * 0.1, R * 1.25);
    g.addColorStop(0, rgba(pal.skin.hi, 0.75));
    g.addColorStop(0.5, rgba(pal.skin.base, 0));
    g.addColorStop(1, rgba(pal.skin.shade, 0.85));
    ctx.fillStyle = g;
    ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
    ctx.restore();
    if (cosA > -0.15) face(ctx, R, cosA, side, tilt, pal, o);
    hairOn(ctx, R, cosA, side, hair, pal, !!o.referee);
  }
  ctx.restore();
}

/** The face: eyes under calm brows (a slow blink now and then), the nose's shade, the mouth. */
function face(ctx: CanvasRenderingContext2D, R: number, cosA: number, side: number, tilt: number, pal: FPal, o: FigureOpts): void {
  const c = Math.max(0.15, cosA);
  const sh = side * 0.55;
  const vy = tilt * 0.18;
  const U = (u: number): number => (u * c + sh) * R;
  // the blink: a fifth of a second every few seconds, on the figure's own rhythm
  const per = 3.6 + ((o.seed ?? 1) % 3) * 0.7;
  const ph = ((o.time + (o.seed ?? 1) * 1.37) % per) / per;
  const blink = ph < 0.035 ? Math.sin((ph / 0.035) * Math.PI) : 0;
  // the eye sockets' soft shade
  ctx.fillStyle = rgba(pal.skin.shade, 0.45);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(U(s * 0.36), R * (0.0 + vy), R * 0.21 * c, R * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  for (const s of [-1, 1]) {
    const x = U(s * 0.36), y = R * (0.03 + vy);
    const ew = R * 0.15 * c, eh = R * 0.075 * (1 - 0.92 * blink);
    if (c < 0.35 && Math.sign(s) !== Math.sign(side || 1)) continue;
    // the white, the iris looking at the eye, a tiny light
    ctx.fillStyle = '#efe7dc';
    ctx.beginPath();
    ctx.ellipse(x, y, ew, Math.max(0.3, eh), 0, 0, TAU);
    ctx.fill();
    if (blink < 0.6) {
      ctx.fillStyle = pal.eye;
      ctx.beginPath();
      ctx.arc(x + sh * R * 0.06, y, Math.min(ew, R * 0.075), 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(x + sh * R * 0.06 - R * 0.025, y - R * 0.025, Math.max(0.4, R * 0.02), 0, TAU);
      ctx.fill();
    }
    // the upper lid: a focused, calm look
    ctx.strokeStyle = lit(pal.skin.shade, -0.25);
    ctx.lineWidth = Math.max(0.6, R * 0.04);
    ctx.beginPath();
    ctx.ellipse(x, y + R * 0.005, ew * 1.05, Math.max(0.3, eh * 1.1), 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    // the brow
    ctx.strokeStyle = lit(pal.hair, 0.08);
    ctx.lineWidth = Math.max(0.8, R * 0.075);
    ctx.beginPath();
    ctx.moveTo(U(s * 0.2), R * (-0.15 + vy));
    ctx.quadraticCurveTo(U(s * 0.38), R * (-0.21 + vy), U(s * 0.56), R * (-0.17 + vy));
    ctx.stroke();
  }
  // the nose: a soft shade down its side and under it
  ctx.strokeStyle = rgba(pal.skin.shade, 0.75);
  ctx.lineWidth = Math.max(0.6, R * 0.05);
  ctx.beginPath();
  ctx.moveTo(U(0.05 - side * 0.05), R * (0.08 + vy));
  ctx.quadraticCurveTo(U(0.1), R * (0.3 + vy), U(0.04), R * (0.38 + vy));
  ctx.stroke();
  ctx.fillStyle = rgba(pal.skin.shade, 0.6);
  ctx.beginPath();
  ctx.ellipse(U(0), R * (0.42 + vy), R * 0.12 * c, R * 0.04, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(pal.skin.hi, 0.55);
  ctx.beginPath();
  ctx.arc(U(0.02), R * (0.33 + vy), R * 0.045, 0, TAU);
  ctx.fill();
  // the mouth, closed, calm
  ctx.strokeStyle = pal.lip;
  ctx.lineWidth = Math.max(0.6, R * 0.06);
  ctx.beginPath();
  ctx.moveTo(U(-0.17), R * (0.64 + vy * 0.6));
  ctx.quadraticCurveTo(U(0), R * (0.67 + vy * 0.6), U(0.17), R * (0.64 + vy * 0.6));
  ctx.stroke();
}

/** The hair on the head, from the front: a short cap, tied back, braids in rows, or shaved. */
function hairOn(ctx: CanvasRenderingContext2D, R: number, cosA: number, side: number, hair: number, pal: FPal, ref: boolean): void {
  const c = Math.max(0.2, Math.abs(cosA));
  const back = cosA < 0;
  ctx.fillStyle = pal.hair;
  if (hair === 3 && !ref) {
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.ellipse(side * R * 0.1, -R * 0.42, R * 0.86, R * 0.62, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }
  // the cap over the top, the hairline across the forehead (higher when tied back)
  const line = hair === 1 ? -0.5 : -0.42;
  ctx.beginPath();
  ctx.moveTo(-R * 0.92, -R * 0.1);
  ctx.bezierCurveTo(-R * 0.98, -R * 1.18, R * 0.98, -R * 1.18, R * 0.92, -R * 0.1);
  if (back) ctx.lineTo(R * 0.9, R * 0.4);
  ctx.quadraticCurveTo(R * 0.7 * c + side * R * 0.2, R * line * 0.6, side * R * 0.5, R * line);
  ctx.quadraticCurveTo(-R * 0.7 * c + side * R * 0.2, R * line * 0.6, -R * 0.92, -R * 0.1);
  ctx.closePath();
  ctx.fill();
  if (hair === 2) {
    // braids in rows over the skull
    ctx.strokeStyle = lit(pal.hair, 0.25);
    ctx.lineWidth = Math.max(0.6, R * 0.05);
    for (const u of [-0.45, -0.15, 0.15, 0.45]) {
      ctx.beginPath();
      ctx.moveTo((u * c + side * 0.4) * R, R * (line - 0.02));
      ctx.quadraticCurveTo((u * 1.1 * c + side * 0.2) * R, -R * 0.95, u * 0.6 * R, -R * 1.02);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = lit(pal.hair, 0.22);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(side * R * 0.25 - R * 0.15, -R * 0.82, R * 0.36, R * 0.1, -0.25, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** An opponent's glove (or MMA's small glove), seen from the front: the forearm's end, the cuff, the padded fist. */
function glove(ctx: CanvasRenderingContext2D, e: SP, g: SP, b: Build, pal: FPal, style: Style, flat: string | null, farK: number, sideSign: number, pl: Place): void {
  const S = b.scale;
  const r = (style === 'boks' ? 0.064 : 0.042) * S * g.k;
  if (r < 0.6) return;
  const t = dim(pal.glove, farK);
  const ang = Math.atan2(g.y - e.y, g.x - e.x);
  ctx.save();
  ctx.translate(g.x, g.y);
  if (style === 'boks') {
    // the cuff toward the elbow
    const cx = -Math.cos(ang) * r * 0.9, cy = -Math.sin(ang) * r * 0.9;
    limb(ctx, cx, cy, r * 0.62, -Math.cos(ang) * r * 0.25, -Math.sin(ang) * r * 0.25, r * 0.7, t, flat);
    // the fist: round, the thumb on the inner side
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 1.04, ang, 0, TAU);
    ctx.fillStyle = flat ?? t.shade;
    ctx.fill();
    if (!flat) {
      ctx.beginPath();
      ctx.ellipse(-r * 0.08, -r * 0.14, r * 0.8, r * 0.82, ang, 0, TAU);
      ctx.fillStyle = t.base;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.42, r * 0.32, r * 0.18, -0.5, 0, TAU);
      ctx.fillStyle = rgba(t.hi, 0.6);
      ctx.fill();
      // the thumb: toward the middle of the body (the figure's left glove is on its right of the screen from the front)
      const inner = sideSign * (Math.cos(pl.yaw) < 0 ? -1 : 1);
      ctx.strokeStyle = t.shade;
      ctx.lineWidth = Math.max(0.6, r * 0.12);
      ctx.beginPath();
      ctx.ellipse(inner * r * 0.55, r * 0.15, r * 0.3, r * 0.5, inner * 0.3, 0, TAU);
      ctx.stroke();
      // the cuff's band
      ctx.strokeStyle = rgba(pal.trim, 0.9);
      ctx.lineWidth = Math.max(0.8, r * 0.22);
      ctx.beginPath();
      ctx.moveTo(cx - Math.sin(ang) * r * 0.6, cy + Math.cos(ang) * r * 0.6);
      ctx.lineTo(cx + Math.sin(ang) * r * 0.6, cy - Math.cos(ang) * r * 0.6);
      ctx.stroke();
    }
  } else {
    // the cage's small glove: the fist (skin), a pad over the knuckles, the wrap at the wrist
    const sk = dim(pal.skin, farK);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.9, ang, 0, TAU);
    ctx.fillStyle = flat ?? sk.base;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-r * 0.05, -r * 0.2, r * 0.9, r * 0.6, ang, 0, TAU);
    ctx.fillStyle = flat ?? t.base;
    ctx.fill();
    if (!flat) {
      ctx.strokeStyle = sk.shade;
      ctx.lineWidth = Math.max(0.5, r * 0.08);
      for (const u of [-0.45, -0.15, 0.15, 0.45]) {
        ctx.beginPath();
        ctx.arc(u * r, r * 0.35, r * 0.16, 0, Math.PI);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

// ── the player's own gloves ───────────────────────────────────────────────────────────────

/** One of the player's own gloves on the screen: its centre, size (radius px), the forearm's elbow end, the tilt. */
export interface OwnGlove { x: number; y: number; r: number; ex: number; ey: number; ext: number; lift: number }

/**
 * The player's glove as the player sees it: the back of the glove (the padding, the thumb along its inner side), the
 * cuff and its band toward the eye, the forearm running off the screen's foot.  `side` −1 the lead (left) hand.
 */
export function paintOwnGlove(ctx: CanvasRenderingContext2D, g: OwnGlove, look: Look, style: Style, side: number, flat: string | null): void {
  const pal = fpPalette(look);
  const r = g.r;
  if (!(r > 1)) return;
  const ang = Math.atan2(g.y - g.ey, g.x - g.ex);
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const boxing = style === 'boks';
  // the forearm: from the elbow (off the screen at rest) to the wrist
  const wx = g.x - ux * r * (boxing ? 1.05 : 0.8), wy = g.y - uy * r * (boxing ? 1.05 : 0.8);
  limb(ctx, g.ex, g.ey, r * 0.62, wx, wy, r * (boxing ? 0.5 : 0.42), pal.skin, flat);
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(ang);
  // the light from above in the glove's own turn
  const lx = Math.cos(-Math.PI / 2 - ang) * r * 0.2, ly = Math.sin(-Math.PI / 2 - ang) * r * 0.2;
  if (boxing) {
    const t = pal.glove;
    // the cuff, wide, with its band
    ctx.beginPath();
    ctx.roundRect(-r * 1.32, -r * 0.62, r * 0.85, r * 1.24, r * 0.3);
    ctx.fillStyle = flat ?? t.shade;
    ctx.fill();
    if (!flat) {
      ctx.fillStyle = rgba(pal.trim, 0.9);
      ctx.fillRect(-r * 1.02, -r * 0.6, r * 0.16, r * 1.2);
    }
    // the glove's body: knuckles away from the eye
    ctx.beginPath();
    ctx.ellipse(r * 0.05, 0, r * 1.02, r * 0.9, 0, 0, TAU);
    ctx.fillStyle = flat ?? t.shade;
    ctx.fill();
    if (!flat) {
      ctx.beginPath();
      ctx.ellipse(r * 0.05 + lx, ly, r * 0.84, r * 0.7, 0, 0, TAU);
      ctx.fillStyle = t.base;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(r * 0.2 + lx * 2.2, ly * 2.2, r * 0.42, r * 0.2, 0, 0, TAU);
      ctx.fillStyle = rgba(t.hi, 0.55);
      ctx.fill();
      // the thumb along the inner side (toward the middle of the screen)
      const inner = side < 0 ? -1 : 1;
      const tyS = -inner * Math.sign(Math.cos(ang) || 1);
      ctx.beginPath();
      ctx.ellipse(-r * 0.15, tyS * r * 0.66, r * 0.58, r * 0.28, 0, 0, TAU);
      ctx.fillStyle = t.shade;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(-r * 0.1 + lx * 0.6, tyS * r * 0.62 + ly * 0.6, r * 0.46, r * 0.19, 0, 0, TAU);
      ctx.fillStyle = t.base;
      ctx.fill();
      // the knuckles' seam
      ctx.strokeStyle = rgba(t.shade, 0.8);
      ctx.lineWidth = Math.max(1, r * 0.05);
      ctx.beginPath();
      ctx.ellipse(r * 0.35, 0, r * 0.5, r * 0.72, 0, -Math.PI * 0.42, Math.PI * 0.42);
      ctx.stroke();
    }
  } else {
    // the cage's small glove: the back of the hand padded, the fingers' knuckles curled at its front, the wrap
    const sk = pal.skin;
    ctx.beginPath();
    ctx.ellipse(r * 0.05, 0, r * 0.95, r * 0.78, 0, 0, TAU);
    ctx.fillStyle = flat ?? sk.base;
    ctx.fill();
    if (!flat) {
      ctx.fillStyle = pal.glove.base;
      ctx.beginPath();
      ctx.ellipse(-r * 0.12 + lx * 0.5, ly * 0.5, r * 0.62, r * 0.6, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = sk.shade;
      ctx.lineWidth = Math.max(1, r * 0.06);
      for (const v of [-0.45, -0.15, 0.15, 0.45]) {
        ctx.beginPath();
        ctx.arc(r * 0.7, v * r, r * 0.17, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();
      }
      ctx.fillStyle = rgba('#efe8dc', 0.9);
      ctx.fillRect(-r * 1.0, -r * 0.48, r * 0.3, r * 0.96);
    }
  }
  ctx.restore();
}

/** The player's own leg in a kick or a check: the shin and the foot rising from the screen's foot. */
export function paintOwnLeg(ctx: CanvasRenderingContext2D, k: { x: number; y: number; r: number }, a: { x: number; y: number; r: number }, look: Look, style: Style): void {
  const pal = fpPalette(look);
  limb(ctx, k.x, k.y, k.r, a.x, a.y, a.r, pal.skin, null);
  if (style === 'boks') return;
  ctx.fillStyle = pal.skin.base;
  ctx.beginPath();
  ctx.ellipse(a.x, a.y, a.r * 1.3, a.r * 0.9, Math.atan2(a.y - k.y, a.x - k.x), 0, TAU);
  ctx.fill();
}

/** Smoothly from a to b by k (a shared ease for the gloves' mapping). */
export const ease = (k: number): number => smooth(k);
