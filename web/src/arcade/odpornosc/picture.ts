/**
 * Odporność's teaching pictures (round 11): the finger that shows a gesture — a tap with its ripple, a drag with
 * its trail — the small icons of the "what to do now" line, and each stage's picture for its card and for the
 * lobby's glossary: the scene in miniature with the thing to touch ringed and the gesture drawn on it, looping
 * every few seconds.  All in code (paint.ts's cells), no images; cheap enough to draw every frame of a card.
 */
import { clamp, ease } from '../kit/juice';
import type { PathogenId, StageId } from './content';
import { PAL, TAU, circle, glow, paintBug, paintLymphocyte, paintMacrophage, paintNeutrophil, paintVirion, paintY, rr } from './paint';

// ── the finger ───────────────────────────────────────────────────────────────────────
/**
 * A pointing finger whose tip is at (x, y): a pale finger leaning in from the lower right, its palm under it.
 * `s` is its size (about the fingertip's length); `press` 0..1 pushes it down a little.
 */
export function paintFinger(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, press = 0, alpha = 1): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  const k = 1 - 0.08 * press;
  ctx.scale(k, k);
  const fw = s * 0.46, fl = s * 1.25;
  // the palm and the folded fingers
  rr(ctx, -fw * 0.55, fl * 0.62, fw * 2.3, s * 1.05, s * 0.36);
  ctx.fillStyle = '#fff6ee';
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, s * 0.09);
  ctx.strokeStyle = 'rgba(58,29,46,0.75)';
  ctx.stroke();
  for (let i = 1; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-fw * 0.55 + fw * 0.78 * i, fl * 0.62 + s * 0.06);
    ctx.lineTo(-fw * 0.55 + fw * 0.78 * i, fl * 0.62 + s * 0.42);
    ctx.stroke();
  }
  // the index finger
  rr(ctx, -fw / 2, 0, fw, fl, fw / 2);
  ctx.fillStyle = '#fffaf5';
  ctx.fill();
  ctx.stroke();
  // the nail
  rr(ctx, -fw * 0.28, fw * 0.16, fw * 0.56, fw * 0.62, fw * 0.24);
  ctx.fillStyle = 'rgba(232,168,176,0.65)';
  ctx.fill();
  ctx.restore();
}

/** A tap shown on (x, y): the finger comes down, a ring ripples out; `p` 0..1 runs the loop. */
export function paintTapGesture(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: number): void {
  const down = p < 0.35 ? ease.outCubic(p / 0.35) : p < 0.55 ? 1 : 1 - ease.inOutSine((p - 0.55) / 0.45);
  const lift = (1 - down) * s * 0.55;
  if (p > 0.3 && p < 0.95) {
    const k = clamp((p - 0.3) / 0.65);
    ctx.save();
    ctx.strokeStyle = `rgba(255,248,239,${0.9 * (1 - k)})`;
    ctx.lineWidth = Math.max(2, s * 0.14);
    circle(ctx, x, y, s * (0.35 + 1.1 * ease.outCubic(k)));
    ctx.stroke();
    ctx.restore();
  }
  glow(ctx, x, y, s * 1.1, '255,248,239', 0.25 * down);
  paintFinger(ctx, x + lift * 0.4, y + lift, s, down);
}

/** A drag shown from (x0, y0) to (x1, y1): the finger presses, slides along a dotted trail, lets go; `p` 0..1. */
export function paintDragGesture(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, s: number, p: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1) { paintTapGesture(ctx, x0, y0, s, p); return; }
  const move = clamp((p - 0.18) / 0.6);
  const k = ease.inOutSine(move);
  const fx = x0 + (x1 - x0) * k, fy = y0 + (y1 - y0) * k;
  const alpha = p < 0.1 ? p / 0.1 : p > 0.88 ? Math.max(0, (1 - p) / 0.12) : 1;
  // the trail: where to go, dotted, with an arrowhead
  ctx.save();
  ctx.globalAlpha *= 0.85 * alpha;
  ctx.strokeStyle = '#fff8ef';
  ctx.lineWidth = Math.max(2, s * 0.13);
  ctx.setLineDash([s * 0.28, s * 0.24]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  const a = Math.atan2(y1 - y0, x1 - x0), h = s * 0.5;
  ctx.beginPath();
  ctx.moveTo(x1 - Math.cos(a - 0.5) * h, y1 - Math.sin(a - 0.5) * h);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a + 0.5) * h, y1 - Math.sin(a + 0.5) * h);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
  glow(ctx, fx, fy, s * 1.1, '255,248,239', 0.28 * alpha);
  paintFinger(ctx, fx, fy, s, move > 0 && move < 1 ? 1 : 0.4, alpha);
}

// ── the small icons ──────────────────────────────────────────────────────────────────
export type IconKind = 'tap' | 'drag' | 'breath' | 'star';

/** The "what to do now" line's icon in a circle of radius r: a finger tapping, a finger dragging, a breath, a star. */
export function paintIcon(ctx: CanvasRenderingContext2D, kind: IconKind, x: number, y: number, r: number, t: number): void {
  ctx.save();
  circle(ctx, x, y, r);
  ctx.fillStyle = kind === 'breath' ? 'rgba(150,200,255,0.28)' : kind === 'star' ? 'rgba(255,209,102,0.3)' : 'rgba(255,248,239,0.18)';
  ctx.fill();
  if (kind === 'breath') {
    const v = 0.5 - 0.5 * Math.cos((t * TAU) / 10);
    ctx.strokeStyle = 'rgba(210,235,255,0.95)';
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    circle(ctx, x, y, r * (0.3 + 0.38 * v));
    ctx.stroke();
    ctx.fillStyle = 'rgba(210,235,255,0.9)';
    circle(ctx, x, y, r * 0.16);
    ctx.fill();
  } else if (kind === 'star') {
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU, d = i % 2 ? r * 0.3 : r * 0.68;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); else ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    }
    ctx.closePath();
    ctx.fill();
  } else {
    const s = r * 0.62;
    if (kind === 'drag') {
      ctx.strokeStyle = 'rgba(255,248,239,0.85)';
      ctx.lineWidth = Math.max(1.5, r * 0.12);
      ctx.setLineDash([r * 0.18, r * 0.16]);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.62, y - r * 0.32);
      ctx.lineTo(x + r * 0.5, y - r * 0.32);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.32, y - r * 0.5);
      ctx.lineTo(x + r * 0.55, y - r * 0.32);
      ctx.lineTo(x + r * 0.32, y - r * 0.14);
      ctx.stroke();
      paintFinger(ctx, x - r * 0.05 + Math.sin(t * 2.4) * r * 0.18, y - r * 0.12, s, 1);
    } else {
      const p = (t * 0.8) % 1;
      ctx.strokeStyle = `rgba(255,248,239,${0.9 * (1 - p)})`;
      ctx.lineWidth = Math.max(1.2, r * 0.1);
      circle(ctx, x - r * 0.12, y - r * 0.32, r * (0.15 + 0.4 * p));
      ctx.stroke();
      paintFinger(ctx, x - r * 0.12, y - r * 0.32, s, 1);
    }
  }
  ctx.restore();
}

// ── each stage's picture ─────────────────────────────────────────────────────────────
const LOOK = (t: number, seed: number, dir = 0, speed = 0) => ({ t, seed, dir, speed, eyes: true });

/**
 * The stage's picture in (x, y, w, h): the scene in miniature, the thing to touch ringed and the gesture drawn on
 * it, looping (`t` in s).  `bug` is the loop's bacterium, `virus` its cold virus.
 */
export function paintStagePicture(ctx: CanvasRenderingContext2D, stage: StageId, x: number, y: number, w: number, h: number, t: number, bug: PathogenId, virus: PathogenId): void {
  ctx.save();
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
  ctx.clip();
  const s = Math.max(1, Math.min(w / 110, h / 64));
  if (stage === 'tcells') nose(ctx, x, y, w, h, s, t, virus);
  else skin(ctx, stage, x, y, w, h, s, t, bug);
  ctx.restore();
  ctx.save();
  rr(ctx, x, y, w, h, Math.min(w, h) * 0.12);
  ctx.strokeStyle = 'rgba(194,65,107,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** A pulsing ring: "this is the thing to touch". */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color = '255,248,239'): void {
  const p = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.strokeStyle = `rgba(${color},${0.55 + 0.35 * p})`;
  const lw = Math.max(1.5, Math.min(r * 0.12, 2.2));
  ctx.lineWidth = lw;
  ctx.setLineDash([lw * 3.2, lw * 2.4]);
  ctx.lineDashOffset = -t * lw * 8;
  circle(ctx, x, y, r * (1 + 0.08 * p));
  ctx.stroke();
  ctx.setLineDash([]);
}

function bugAt(ctx: CanvasRenderingContext2D, kind: PathogenId, x: number, y: number, r: number, t: number, seed: number, tag = 0, capsule = false): void {
  if (tag >= 1) glow(ctx, x, y, r * 3.2, '255,209,102', 0.4);
  paintBug(ctx, kind, x, y, r, { a: seed * 6 + t * 0.4, t, seed, tag, c3: false, capsule, netted: false, split: 0, pop: 1, fade: 0 });
}

function skin(ctx: CanvasRenderingContext2D, stage: StageId, x: number, y: number, w: number, h: number, s: number, t: number, bug: PathogenId): void {
  // the dermis, the epidermis on top, the venule along the bottom (taller in Rekrutacja: the scene is there)
  const vesselTop = y + h * (stage === 'recruit' ? 0.56 : 0.8);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PAL.tissue[0]);
  g.addColorStop(0.6, PAL.tissue[1]);
  g.addColorStop(1, PAL.tissue[2]);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = PAL.epi;
  ctx.fillRect(x, y, w, h * 0.1);
  ctx.fillStyle = PAL.corneum;
  ctx.fillRect(x, y, w, h * 0.025);
  ctx.fillStyle = PAL.vesselWall;
  ctx.fillRect(x, vesselTop, w, y + h - vesselTop);
  const lt = vesselTop + 2 * s, lb = y + h - 2 * s;
  ctx.fillStyle = PAL.lumen[1];
  ctx.fillRect(x, lt, w, lb - lt);
  for (let i = 0; i < 8; i++) {
    const rx = x + (((t * 26 * s + i * w / 8) % (w + 16)) + w + 16) % (w + 16) - 8, ry = lt + (lb - lt) * (0.35 + 0.3 * Math.sin(i * 2.1));
    ctx.fillStyle = PAL.rbc;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 2.4 * s, 1.4 * s, 0.2, 0, TAU);
    ctx.fill();
  }
  const cyc = (t % 3.2) / 3.2;
  if (stage === 'alarm') {
    const mx = x + w * 0.3, my = y + h * 0.48;
    // the alarm's rings travel to the vessel and light its wall (the pads under them glow gold)
    for (let i = 0; i < 2; i++) {
      const k = ((t * 0.5 + i * 0.5) % 1);
      ctx.strokeStyle = `rgba(255,214,120,${0.75 * (1 - k)})`;
      ctx.lineWidth = Math.max(1.2, s);
      circle(ctx, mx, my, h * 0.6 * k);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const px = x + w * (0.08 + i * 0.17), lit = Math.abs(px - mx) < w * 0.32;
      ctx.fillStyle = lit ? '#ffd27a' : 'rgba(255,210,122,0.25)';
      rr(ctx, px - 3.5 * s, vesselTop, 7 * s, 1.4 * s, 1);
      ctx.fill();
      if (lit) glow(ctx, px, vesselTop + s, 6 * s, '255,210,122', 0.4);
    }
    const bugs = [[0.68, 0.32], [0.76, 0.46], [0.64, 0.56]];
    bugs.forEach(([bx, by], i) => bugAt(ctx, bug, x + w * bx, y + h * by, 2.2 * s, t, i / 3));
    paintMacrophage(ctx, mx, my, 8 * s, { ...LOOK(t, 0.77, 0, 0.2), m2: 0 });
    ring(ctx, mx, my, 11 * s, t);
    paintDragGesture(ctx, mx + 3 * s, my + 3 * s, x + w * 0.64, y + h * 0.45, 7 * s, cyc);
  } else if (stage === 'recruit') {
    for (let i = 0; i < 6; i++) {
      const px = x + w * (0.08 + i * 0.17);
      ctx.fillStyle = '#ffd27a';
      rr(ctx, px - 3.5 * s, vesselTop, 7 * s, 1.4 * s, 1);
      ctx.fill();
    }
    // a white cell rolls along the wall; the finger taps it; it stops and squeezes up into the skin
    const r = 4.2 * s;
    const rollX = x + w * (0.22 + 0.3 * Math.min(cyc, 0.4) / 0.4);
    if (cyc < 0.45) {
      paintNeutrophil(ctx, rollX, lt + r * 0.9, r, { ...LOOK(t, 0.3, t * 3, 0.5) });
      glow(ctx, rollX, lt, r * 1.6, '255,210,122', 0.35);
      ring(ctx, rollX, lt + r * 0.9, r * 1.55, t, '255,214,120');
    } else {
      const k = clamp((cyc - 0.45) / 0.4);
      const cy = lt + r * 0.9 - (r * 3.2) * ease.inOutSine(k);
      paintNeutrophil(ctx, x + w * 0.52, cy, r, { ...LOOK(t, 0.3, -Math.PI / 2, 0.8) });
    }
    // two more flowing by
    for (let i = 0; i < 2; i++) paintNeutrophil(ctx, x + ((t * 30 * s + i * w * 0.5) % (w + 20)) - 10, (lt + lb) / 2 + 2 * s, r * 0.8, { ...LOOK(t, 0.6 + i * 0.2, t * 3, 0), eyes: false });
    // and one already in the skin
    paintNeutrophil(ctx, x + w * 0.78, y + h * 0.3, r, { ...LOOK(t, 0.5, 0, 0.3) });
    if (cyc < 0.45) paintTapGesture(ctx, rollX, lt + r * 0.9, 7 * s, clamp(cyc / 0.45));
  } else if (stage === 'hunt' || stage === 'antibodies') {
    const ab = stage === 'antibodies';
    // bacteria ahead (gold when tagged), the swarm follows the finger toward them
    const bugs: [number, number, number, boolean][] = [[0.7, 0.3, ab ? 1 : 0, false], [0.8, 0.5, ab ? 1 : 0, false], [0.66, 0.64, 0, ab], [0.86, 0.34, 0, false]];
    bugs.forEach(([bx, by, tag, cap], i) => bugAt(ctx, bug, x + w * bx, y + h * by, 2.2 * s, t, i / 4, tag, cap));
    if (ab) for (let i = 0; i < 4; i++) {
      const k = (t * 0.35 + i / 4) % 1;
      paintY(ctx, x + w * (0.2 + i * 0.2), vesselTop - k * h * 0.6, Math.max(2.5, 1.5 * s), k * 3 + i);
    }
    const fx = x + w * (0.22 + 0.36 * ease.inOutSine(clamp((cyc - 0.18) / 0.6))), fy = y + h * (0.5 - 0.06 * Math.sin(cyc * TAU));
    for (let i = 0; i < 4; i++) {
      const a = i * 2.39996;
      const nx = fx - 12 * s + Math.cos(a) * 7 * s, ny = fy + 4 * s + Math.sin(a) * 6 * s;
      glow(ctx, nx, ny, 9 * s, '236,226,255', 0.22);
      paintNeutrophil(ctx, nx, ny, 4.2 * s, { ...LOOK(t, i / 4, 0, 0.6), gulp: i === 1 ? 0.5 + 0.5 * Math.sin(t * 3) : 0 });
    }
    paintDragGesture(ctx, x + w * 0.22, y + h * 0.42, x + w * 0.6, y + h * 0.42, 7 * s, cyc);
  } else {
    // healing: the wound in the middle closing, collagen strands across its bed, the finger lays one more
    const wx = x + w * 0.5, top = y, base = y + h * 0.1;
    const open = 0.5 + 0.5 * Math.cos(t * 0.6);
    ctx.fillStyle = '#c4566e';
    ctx.beginPath();
    ctx.moveTo(wx - 4 * s * open, top);
    ctx.quadraticCurveTo(wx - 2 * s, base, wx, base + 6 * s);
    ctx.quadraticCurveTo(wx + 2 * s, base, wx + 4 * s * open, top);
    ctx.closePath();
    ctx.fill();
    const by = y + h * 0.36, rx = w * 0.26;
    glow(ctx, wx, by, rx * 1.1, '232,120,138', 0.4);
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const dir = i % 2 ? 1 : -1, yy = by + (i - 2) * 4 * s;
      ctx.strokeStyle = 'rgba(255,242,230,0.85)';
      ctx.lineWidth = Math.max(1.2, 0.9 * s);
      ctx.beginPath();
      ctx.moveTo(wx - rx * 0.8, yy - dir * 2 * s);
      ctx.bezierCurveTo(wx - rx * 0.3, yy + dir * 3 * s, wx + rx * 0.3, yy - dir * 3 * s, wx + rx * 0.8, yy + dir * 2 * s);
      ctx.stroke();
    }
    // the strand being laid follows the finger
    const k = clamp((cyc - 0.18) / 0.6);
    if (k > 0) {
      ctx.strokeStyle = PAL.gold;
      ctx.lineWidth = Math.max(1.8, 1.3 * s);
      ctx.beginPath();
      ctx.moveTo(wx - rx * 0.9, by - 9 * s);
      ctx.lineTo(wx - rx * 0.9 + rx * 1.8 * ease.inOutSine(k), by - 9 * s);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // a fibroblast at work, capillary sprouts from below
    ctx.fillStyle = '#ffe2cf';
    ctx.beginPath();
    ctx.ellipse(wx + Math.sin(t * 0.8) * rx * 0.5, by + 10 * s, 7 * s, 1.9 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.capillary;
    ctx.lineWidth = Math.max(1, 0.9 * s);
    for (let i = 0; i < 3; i++) {
      const x0 = wx + (i - 1) * 14 * s;
      ctx.beginPath();
      ctx.moveTo(x0, vesselTop);
      ctx.quadraticCurveTo(x0 + 5 * s, vesselTop - h * 0.2, wx + (i - 1) * 4 * s, vesselTop - h * 0.38);
      ctx.stroke();
    }
    ring(ctx, wx, by - 2 * s, rx * 0.95, t);
    paintDragGesture(ctx, wx - rx * 0.9, by - 9 * s, wx + rx * 0.9, by - 9 * s, 7 * s, cyc);
  }
}

function nose(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, t: number, virus: PathogenId): void {
  // the airway's mucus above, a row of lining cells, the tissue below where the T cells walk
  const eTop = y + h * 0.18, eBot = y + h * 0.5;
  ctx.fillStyle = PAL.mucus[1];
  ctx.fillRect(x, y, w, eTop - y);
  const g = ctx.createLinearGradient(0, eBot, 0, y + h);
  g.addColorStop(0, '#fbd9de');
  g.addColorStop(1, '#e79aab');
  ctx.fillStyle = g;
  ctx.fillRect(x, eBot, w, y + h - eBot);
  const n = 6, cw = w / n, sick = 3;
  const cyc = (t % 3.4) / 3.4;
  for (let i = 0; i < n; i++) {
    const cx = x + cw * (i + 0.5);
    const infected = i === sick && cyc < 0.85;
    const fold = i === sick && cyc >= 0.7 ? clamp((cyc - 0.7) / 0.15) : 0;
    rr(ctx, cx - cw / 2 + 1.5, eTop + (eBot - eTop) * fold * 0.5, cw - 3, (eBot - eTop) * (1 - fold * 0.5), 5);
    ctx.fillStyle = infected ? PAL.infected : PAL.epiNose;
    ctx.fill();
    ctx.strokeStyle = infected ? '#b98ee6' : PAL.epiNoseEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = PAL.epiNuc;
    ctx.beginPath();
    ctx.ellipse(cx, eBot - (eBot - eTop) * 0.3, cw * 0.15, (eBot - eTop) * 0.13, 0, 0, TAU);
    ctx.fill();
    if (infected) {
      for (let j = 0; j < 3; j++) paintVirion(ctx, virus, cx + (j - 1) * cw * 0.2, eTop + (eBot - eTop) * 0.35, Math.max(1.6, 1.1 * s), t + j);
      // the flags (pieces of the virus) on the side facing the T cells
      for (let j = 0; j < 3; j++) {
        const fx = cx - cw * 0.3 + j * cw * 0.3;
        ctx.strokeStyle = '#7d4bc4';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(fx, eBot);
        ctx.lineTo(fx, eBot + 3.4 * s);
        ctx.stroke();
        ctx.fillStyle = PAL.flag;
        ctx.beginPath();
        ctx.moveTo(fx, eBot + 3.4 * s);
        ctx.lineTo(fx + 2.8 * s, eBot + 2.6 * s);
        ctx.lineTo(fx, eBot + 1.8 * s);
        ctx.fill();
      }
      if (cyc < 0.45) ring(ctx, cx, (eTop + eBot) / 2, cw * 0.62, t, '200,160,255');
    }
  }
  // the T cell comes up to the tapped cell and docks
  const k = clamp((cyc - 0.4) / 0.3);
  const tx = x + cw * (sick + 0.5) - (1 - k) * w * 0.25, ty = eBot + 6 * s + (1 - k) * h * 0.3;
  paintLymphocyte(ctx, tx, ty, 4 * s, LOOK(t, 0.4, -Math.PI / 2, k > 0 && k < 1 ? 0.6 : 0), false);
  if (cyc < 0.45) paintTapGesture(ctx, x + cw * (sick + 0.5), (eTop + eBot) / 2, 7 * s, clamp(cyc / 0.45));
}
