/**
 * The rose windows of Rzeki żywej wody (DESIGN.md §13.14): church glass that blooms at a place as the light
 * gathers there — an oculus in the middle, an inner ring of petals, an outer ring turned between them, small
 * round foils at the rim, all held in dark lead and stone tracery.  Each place has its own tracery
 * (content.ts `PLACE[p].rose`): twelve lobes and lancets at the crown, a wild rose of five at the heart, a
 * trefoil and flames at the breath, drops and arches at the inner well, a quatrefoil at the feet.
 *
 * The geometry is in the window's own units (centre 0,0; radius R).  A window opens with its place's fill:
 * the oculus first, then the inner petals one by one (each filling from its base outward), then the outer
 * ones.  `openPath` gives the clip of the glass shown at a fill; the view caches it per petal count.
 */
import type { PetalShape, Rose } from './content';
import { RULES } from './rules';

/** The radii of a window's rings, as shares of R: the oculus, the inner ring's edge, the outer ring's edge. */
export const RING = { c: 0.2, i: 0.56, o: 0.97 } as const;

const TAU = Math.PI * 2;
const polar = (r: number, a: number): [number, number] => [Math.cos(a) * r, Math.sin(a) * r];

/** One piece of glass of a ring, as a path (its outline sits inside its wedge of the ring). */
export function piecePath(shape: PetalShape, a: number, aw: number, r0: number, r1: number): Path2D {
  const p = new Path2D();
  const rm = (r0 + r1) / 2;
  switch (shape) {
    case 'lobe': {
      const rho = Math.min((r1 - r0) / 2, rm * Math.sin(aw / 2)) * 0.9;
      const [x, y] = polar(rm, a);
      p.moveTo(x + rho, y);
      p.arc(x, y, rho, 0, TAU);
      break;
    }
    case 'lancet': {
      // a pointed arch: a narrow base on the inner circle, the sides swelling, the point outward
      const ra = r0 + (r1 - r0) * 0.06;
      const [bx0, by0] = polar(ra, a - aw * 0.38), [bx1, by1] = polar(ra, a + aw * 0.38);
      const [tx, ty] = polar(r1, a);
      const [c0x, c0y] = polar(r0 + (r1 - r0) * 0.72, a - aw * 0.5);
      const [c1x, c1y] = polar(r0 + (r1 - r0) * 0.72, a + aw * 0.5);
      p.moveTo(bx0, by0);
      p.quadraticCurveTo(c0x, c0y, tx, ty);
      p.quadraticCurveTo(c1x, c1y, bx1, by1);
      p.arc(0, 0, ra, a + aw * 0.38, a - aw * 0.38, true);
      p.closePath();
      break;
    }
    case 'drop': {
      // a tear: round at the inner side, pointed outward
      const rho = Math.min((r1 - r0) * 0.34, (r0 + (r1 - r0) * 0.34) * Math.sin(aw / 2)) * 0.95;
      const rc = r0 + rho * 1.1;
      const [cx, cy] = polar(rc, a);
      const [tx, ty] = polar(r1, a);
      const s0 = a + Math.PI / 2, s1 = a - Math.PI / 2;
      const [lx, ly] = [cx + Math.cos(s0) * rho, cy + Math.sin(s0) * rho];
      const [qx0, qy0] = polar(rc + (r1 - rc) * 0.45, a + Math.asin(Math.min(0.99, (rho * 1.05) / (rc + (r1 - rc) * 0.45))));
      const [qx1, qy1] = polar(rc + (r1 - rc) * 0.45, a - Math.asin(Math.min(0.99, (rho * 1.05) / (rc + (r1 - rc) * 0.45))));
      p.moveTo(lx, ly);
      p.arc(cx, cy, rho, s0, s1 + TAU, false);
      p.quadraticCurveTo(qx1, qy1, tx, ty);
      p.quadraticCurveTo(qx0, qy0, lx, ly);
      p.closePath();
      break;
    }
    case 'arch': {
      // a round-headed light: straight sides out from the inner circle, a round head at the rim
      const a0 = a - aw * 0.36, a1 = a + aw * 0.36;
      const rs = r0 + (r1 - r0) * 0.55;
      const [x0, y0] = polar(r0, a0), [x1, y1] = polar(rs, a0);
      const [hx, hy] = polar(r1, a);
      const [k0x, k0y] = polar(r1 * 1.01, a0), [k1x, k1y] = polar(r1 * 1.01, a1);
      const [x2, y2] = polar(rs, a1);
      p.moveTo(x0, y0);
      p.lineTo(x1, y1);
      p.quadraticCurveTo(k0x, k0y, hx, hy);
      p.quadraticCurveTo(k1x, k1y, x2, y2);
      p.lineTo(...polar(r0, a1));
      p.arc(0, 0, r0, a1, a0, true);
      p.closePath();
      break;
    }
  }
  return p;
}

export interface Piece { ring: 'c' | 'i' | 'o' | 'f'; index: number; a: number; aw: number; r0: number; r1: number; path: Path2D }

/** The angle of the k-th petal of a ring of n (from the top, clockwise), turned by `twist` petals. */
export const petalAngle = (k: number, n: number, twist = 0): number => -Math.PI / 2 + ((k + twist) * TAU) / n;

/** Every piece of a window of radius R: the oculus, the inner petals, the outer petals, the foils at the rim. */
export function pieces(rose: Rose, R: number): Piece[] {
  const out: Piece[] = [];
  const cR = RING.c * R, iR = RING.i * R, oR = RING.o * R;
  const oc = new Path2D();
  oc.moveTo(cR * 0.86, 0);
  oc.arc(0, 0, cR * 0.86, 0, TAU);
  out.push({ ring: 'c', index: 0, a: 0, aw: TAU, r0: 0, r1: cR, path: oc });
  const ai = TAU / rose.inner;
  for (let k = 0; k < rose.inner; k++) {
    const a = petalAngle(k, rose.inner);
    out.push({ ring: 'i', index: k, a, aw: ai, r0: cR, r1: iR, path: piecePath(rose.innerShape, a, ai, cR, iR) });
  }
  const ao = TAU / rose.outer;
  for (let k = 0; k < rose.outer; k++) {
    const a = petalAngle(k, rose.outer, rose.twist);
    out.push({ ring: 'o', index: k, a, aw: ao, r0: iR, r1: oR, path: piecePath(rose.outerShape, a, ao, iR, oR) });
    // a little round foil in the gap at the rim
    const fa = a + ao / 2, fr = Math.min(R * 0.055, oR * Math.sin(ao / 2) * 0.32);
    const [fx, fy] = polar(oR - fr * 1.6, fa);
    const fp = new Path2D();
    fp.moveTo(fx + fr, fy);
    fp.arc(fx, fy, fr, 0, TAU);
    out.push({ ring: 'f', index: k, a: fa, aw: 0, r0: oR - fr * 2.6, r1: oR - fr * 0.6, path: fp });
  }
  return out;
}

/** An annular wedge (the region a petal opens in), optionally only from r0 to a share of the way to r1. */
export function wedge(path: Path2D, a: number, aw: number, r0: number, r1: number): void {
  const a0 = a - aw / 2, a1 = a + aw / 2;
  const [x0, y0] = polar(r0, a0);
  path.moveTo(x0, y0);
  path.arc(0, 0, r1, a0, a1, false);
  path.arc(0, 0, r0, a1, a0, true);
  path.closePath();
}

/** How much of a window is open at a fill: the oculus (0..1), and the inner and outer petals (fractional counts). */
export function openness(rose: Rose, fill: number): { oculus: number; inner: number; outer: number } {
  const f = Math.max(0, Math.min(1, fill));
  const innerK = Math.max(0, Math.min(1, f / RULES.innerShare));
  const outerK = Math.max(0, Math.min(1, (f - RULES.innerShare) / (1 - RULES.innerShare)));
  return { oculus: Math.min(1, f * 12), inner: innerK * rose.inner, outer: outerK * rose.outer };
}

/**
 * The clip of the glass open at a fill (window units, radius R): the oculus once any light came, the whole
 * petals open, and the petal opening now as a wedge that fills from its base outward.  Returns the clip
 * of the whole petals (`full`) and of the partial one (`part`, null when none).
 */
export function openPath(rose: Rose, R: number, fill: number): { full: Path2D; part: Path2D | null } {
  return { full: fullPath(rose, R, fill), part: partPath(rose, R, fill) };
}

/** The clip of the oculus and the whole petals open at a fill (changes only when a petal completes: cache it). */
export function fullPath(rose: Rose, R: number, fill: number): Path2D {
  const o = openness(rose, fill);
  const cR = RING.c * R, iR = RING.i * R, oR = R * 1.02;
  const full = new Path2D();
  if (o.oculus > 0) {
    full.moveTo(cR, 0);
    full.arc(0, 0, cR, 0, TAU);
  }
  const ai = TAU / rose.inner, ao = TAU / rose.outer;
  const wi = Math.floor(o.inner + 1e-9), wo = Math.floor(o.outer + 1e-9);
  for (let k = 0; k < wi; k++) wedge(full, petalAngle(k, rose.inner), ai, cR * 0.98, iR);
  for (let k = 0; k < wo; k++) wedge(full, petalAngle(k, rose.outer, rose.twist), ao, iR * 0.99, oR);
  return full;
}

/** The clip of the petal opening now: a wedge filling from its base outward (null when none is opening). */
export function partPath(rose: Rose, R: number, fill: number): Path2D | null {
  const o = openness(rose, fill);
  const cR = RING.c * R, iR = RING.i * R, oR = R * 1.02;
  const ai = TAU / rose.inner, ao = TAU / rose.outer;
  const wi = Math.floor(o.inner + 1e-9), wo = Math.floor(o.outer + 1e-9);
  if (wi < rose.inner && o.inner - wi > 0.001) {
    const part = new Path2D();
    wedge(part, petalAngle(wi, rose.inner), ai, cR * 0.98, cR + (iR - cR) * (o.inner - wi));
    return part;
  }
  if (wi >= rose.inner && wo < rose.outer && o.outer - wo > 0.001) {
    const part = new Path2D();
    wedge(part, petalAngle(wo, rose.outer, rose.twist), ao, iR * 0.99, iR + (oR - iR) * (o.outer - wo));
    return part;
  }
  return null;
}
