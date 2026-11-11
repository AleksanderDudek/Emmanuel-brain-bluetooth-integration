/**
 * Dolina's things of the climb (paint.ts keeps the valley, the pilgrim, Ćma, the shadows and the
 * guardians): the ground in floors with the ledges' faces, the stone blocks with their numbers, the
 * stair built from them, the gates of light that merge the sword, the shadow pens and the lambs, the
 * tide of the dark (ink and smoke with ember eyes — never anything else), the way out, and what a
 * guardian throws.  All canvas paths, sizes in u times `S` (px per u); y grows downward on screen.
 */
import type { EraId } from './content';
import { C, SANS, TAU, font, glow, hash, mix, rgb, type Palette } from './paint';

// ── the ground ────────────────────────────────────────────────────
/** A floor's ground from x0 to x1 (px), its top at `top`, down to `bottom`; the meadow is grass, the dawn warm. */
export function paintGround(
  ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, S: number, pal: Palette,
  kind: 'road' | 'ledge' | 'meadow' | 'arena' | 'dawn' | 'bridge', worldX0: number,
): void {
  if (x1 <= x0 || top >= bottom) return;
  const meadow = kind === 'meadow';
  const roadTop = meadow ? [96, 140, 84] as [number, number, number] : kind === 'dawn' ? mix(pal.roadTop, [255, 200, 150], 0.35) : pal.roadTop;
  const road = meadow ? [52, 84, 56] as [number, number, number] : pal.road;
  const g = ctx.createLinearGradient(0, top, 0, Math.min(bottom, top + S * 6));
  g.addColorStop(0, rgb(roadTop));
  g.addColorStop(0.08, rgb(road));
  g.addColorStop(1, rgb(mix(road, [8, 6, 12], 0.6)));
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  // the lit top edge
  ctx.fillStyle = rgb(mix(roadTop, [255, 240, 210], meadow ? 0.25 : 0.18));
  ctx.fillRect(x0, top, x1 - x0, Math.max(2, S * 0.06));
  // the face of a floor's left end (a ledge seen from below): a darker rim
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.fillRect(x0, top, Math.max(2, S * 0.08), bottom - top);
  // courses of stone (or tufts of grass) in the earth, fixed to the world
  const unit = S * 1.3;
  const k0 = Math.floor((x0 - worldX0) / unit) - 1;
  for (let k = k0; k < k0 + Math.ceil((x1 - x0) / unit) + 3; k++) {
    const x = worldX0 + k * unit + hash(k) * unit * 0.5;
    if (x < x0 - S * 0.3 || x > x1) continue;
    if (meadow) {
      ctx.strokeStyle = 'rgba(150,200,120,.7)';
      ctx.lineWidth = Math.max(1, S * 0.04);
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x - S * 0.08, top - S * 0.18);
      ctx.moveTo(x + S * 0.06, top);
      ctx.lineTo(x + S * 0.12, top - S * 0.14);
      ctx.stroke();
      if (hash(k * 7) > 0.7) {
        ctx.fillStyle = hash(k * 3) > 0.5 ? '#f3e7b5' : '#e8b4c8';
        ctx.beginPath();
        ctx.arc(x + S * 0.2, top - S * 0.12, S * 0.05, 0, TAU);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = rgb(mix(road, [0, 0, 0], 0.3));
      ctx.fillRect(x, top + S * (0.18 + hash(k * 5) * 0.4), S * 0.32, S * 0.07);
    }
  }
}

/** A pit's rim: always faintly outlined (never a trap). */
export function paintRim(ctx: CanvasRenderingContext2D, x: number, top: number, S: number, side: -1 | 1): void {
  ctx.strokeStyle = 'rgba(255,226,170,.6)';
  ctx.lineWidth = Math.max(1.5, S * 0.05);
  ctx.setLineDash([S * 0.12, S * 0.1]);
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, top + S * 0.9);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,226,170,.5)';
  ctx.beginPath();
  ctx.arc(x - side * S * 0.06, top, S * 0.06, 0, TAU);
  ctx.fill();
}

// ── the stone blocks ─────────────────────────────────────────────
const STONE: Readonly<Record<EraId, { face: string; top: string; line: string }>> = {
  babel: { face: '#a8693f', top: '#d39a62', line: 'rgba(60,28,16,.55)' },
  twierdza: { face: '#5d5560', top: '#8a8090', line: 'rgba(20,16,24,.6)' },
  miasto: { face: '#4f6670', top: '#7f9ca6', line: 'rgba(10,22,28,.6)' },
};

export interface BlockPose {
  era: EraId;
  hp: number;
  max: number;
  tall: boolean;
  /** the number shows (inside the light, or near) */
  lit: boolean;
  /** a hit's flash 0..1 */
  hit: number;
  t: number;
  id: number;
  /** v3: the gate gallery's giant block (a big plaque, a gold rim) */
  giant?: boolean;
}

/** A stone block, its left edge at x and its base at y (px), w × h px: cut stone with its number on a plaque. */
export function paintBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, S: number, p: BlockPose): void {
  const c = STONE[p.era];
  const jig = p.hit > 0 ? Math.sin(p.t * 90) * S * 0.04 * p.hit : 0;
  ctx.save();
  ctx.translate(jig, 0);
  // the body, in two or four courses
  const rows = p.tall ? 4 : 2;
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const ry = y - (r + 1) * rh;
    const off = (r % 2) * w * 0.5;
    ctx.fillStyle = r === rows - 1 ? c.top : c.face;
    ctx.fillRect(x, ry, w, rh + 0.5);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.strokeRect(x + 0.5, ry + 0.5, w - 1, rh - 1);
    ctx.beginPath();
    const mx = x + ((off + w * 0.5) % w);
    ctx.moveTo(mx, ry);
    ctx.lineTo(mx, ry + rh);
    ctx.stroke();
  }
  // cracks grow as its light goes
  const dmg = 1 - Math.max(0, p.hp) / Math.max(1, p.max);
  if (dmg > 0.05) {
    ctx.strokeStyle = `rgba(255,230,180,${0.25 + 0.5 * dmg})`;
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    const n = 1 + Math.floor(dmg * 4);
    for (let i = 0; i < n; i++) {
      const sx = x + w * (0.2 + hash(p.id * 13 + i) * 0.6), sy = y - h * (0.15 + hash(p.id * 7 + i) * 0.7);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + w * 0.18 * (hash(i + p.id) - 0.5) * 2, sy - h * 0.18);
      ctx.lineTo(sx + w * 0.1, sy - h * 0.3);
    }
    ctx.stroke();
  }
  if (p.hit > 0) {
    ctx.fillStyle = `rgba(255,246,220,${0.55 * p.hit})`;
    ctx.fillRect(x, y - h, w, h);
  }
  if (p.giant) {
    ctx.strokeStyle = `rgba(245,195,90,${0.6 + 0.3 * Math.sin(p.t * 4)})`;
    ctx.lineWidth = Math.max(2, S * 0.07);
    ctx.strokeRect(x, y - h, w, h);
  }
  // the plaque with its number (in the fog only a question mark)
  const ph = p.giant ? S * 0.62 : Math.min(S * 0.42, h * 0.38), pw = Math.max(p.giant ? S * 1.25 : S * 0.7, w * 0.78);
  const px = x + (w - pw) / 2, py = y - h * (p.tall ? 0.62 : 0.55) - ph / 2;
  ctx.fillStyle = 'rgba(24,18,26,.78)';
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, ph * 0.3);
  ctx.fill();
  ctx.fillStyle = p.lit ? '#fff1c4' : 'rgba(255,241,196,.45)';
  ctx.font = font(800, ph * 0.78, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.lit ? String(Math.max(1, Math.ceil(p.hp))) : '?', px + pw / 2, py + ph * 0.54);
  ctx.restore();
}

/** One step of the built stair (its box in px), popping in when new (`age` s). */
export function paintStep(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, S: number, era: EraId, age: number): void {
  const c = STONE[era];
  const k = Math.min(1, age / 0.18);
  const lift = (1 - k) * S * 0.8;
  ctx.globalAlpha = 0.4 + 0.6 * k;
  ctx.fillStyle = c.face;
  ctx.fillRect(x0, top - lift, x1 - x0, bottom - top);
  ctx.fillStyle = c.top;
  ctx.fillRect(x0, top - lift, x1 - x0, Math.max(2, S * 0.1));
  ctx.strokeStyle = c.line;
  ctx.lineWidth = Math.max(1, S * 0.03);
  ctx.strokeRect(x0 + 0.5, top - lift + 0.5, x1 - x0 - 1, bottom - top - 1);
  ctx.globalAlpha = 1;
}

// ── the gates ─────────────────────────────────────────────────────
/** A gate of light: the low one an arch on the road, the high one a ring hung in the air; its gift on a plaque. */
export function paintGate(ctx: CanvasRenderingContext2D, x: number, base: number, S: number, high: boolean, plus: number, taken: boolean, t: number, label: string): void {
  const a = taken ? 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = a;
  const pulse = 0.75 + 0.25 * Math.sin(t * 5 + x * 0.01);
  if (!high) {
    const h = S * 2.0, w = S * 1.1;
    ctx.strokeStyle = 'rgba(30,22,36,.9)';
    ctx.lineWidth = S * 0.16;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.lineTo(x - w / 2, base - h * 0.7);
    ctx.arc(x, base - h * 0.7, w / 2, Math.PI, 0);
    ctx.lineTo(x + w / 2, base);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,214,140,${0.85 * pulse})`;
    ctx.lineWidth = S * 0.07;
    ctx.stroke();
    if (!taken) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, base - h * 0.55, S * 1.1, 'rgba(255,200,110,', 0.25 * pulse);
      ctx.restore();
    }
    plaque(ctx, x, base - h - S * 0.35, S, label, '#ffd36b');
  } else {
    const cy = base - S * 3.2, r = S * 0.62;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (!taken) glow(ctx, x, cy, S * 1.6, 'rgba(255,220,140,', 0.4 * pulse);
    ctx.restore();
    ctx.strokeStyle = '#fff1c4';
    ctx.lineWidth = S * 0.1;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = `rgba(245,195,90,${pulse})`;
    ctx.lineWidth = S * 0.05;
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * TAU + t * 0.8;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(ang) * r * 1.15, cy + Math.sin(ang) * r * 1.15);
      ctx.lineTo(x + Math.cos(ang) * r * 1.4, cy + Math.sin(ang) * r * 1.4);
      ctx.stroke();
    }
    plaque(ctx, x, cy - r - S * 0.45, S, label, '#fff1c4');
    // a faint dotted line down to the road: "this is up here"
    ctx.strokeStyle = 'rgba(255,241,196,.25)';
    ctx.setLineDash([S * 0.08, S * 0.14]);
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, cy + r);
    ctx.lineTo(x, base - S * 2.2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  void plus;
  ctx.restore();
}

function plaque(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, text: string, color: string): void {
  ctx.font = font(800, S * 0.36, SANS);
  const w = ctx.measureText(text).width + S * 0.36, h = S * 0.5;
  ctx.fillStyle = 'rgba(24,18,26,.82)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h * 0.4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + h * 0.04);
}

// ── the pens and the lambs ───────────────────────────────────────
/** A pen of shadow (ink bars) with a lamb inside; its number on the bars. */
export function paintPen(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, S: number, p: { hp: number; lit: boolean; hit: number; t: number; id: number }): void {
  paintLamb(ctx, x + w / 2, y - S * 0.05, S * 0.9, p.t, 0, true);
  ctx.save();
  const jig = p.hit > 0 ? Math.sin(p.t * 90) * S * 0.04 : 0;
  ctx.translate(jig, 0);
  ctx.fillStyle = p.hit > 0 ? '#e8dcc8' : C.ink;
  const bars = 5;
  for (let i = 0; i < bars; i++) {
    const bx = x + (i + 0.5) * (w / bars) - S * 0.05;
    ctx.fillRect(bx, y - h, S * 0.1, h);
  }
  ctx.fillRect(x, y - h, w, S * 0.12);
  ctx.fillRect(x, y - S * 0.12, w, S * 0.12);
  // smoke curling off the bars
  for (let i = 0; i < 3; i++) {
    const k = (p.t * 0.5 + i / 3 + hash(p.id + i)) % 1;
    ctx.fillStyle = `rgba(18,14,26,${0.35 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + w * (0.2 + 0.3 * i) + Math.sin(k * 6) * S * 0.1, y - h - k * S * 0.6, S * (0.06 + 0.1 * k), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = p.lit ? '#fff1c4' : 'rgba(255,241,196,.45)';
  ctx.font = font(800, S * 0.32, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.lit ? String(Math.max(1, Math.ceil(p.hp))) : '?', x + w / 2, y - h - S * 0.28);
  ctx.restore();
}

/** A lamb, feet at (x, y), size s (≈ 1 u): cream wool, a dark face, little hops. */
export function paintLamb(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, hop: number, sad = false): void {
  const b = sad ? 0 : Math.abs(Math.sin(hop)) * s * 0.12;
  ctx.save();
  ctx.translate(x, y - b);
  // legs
  ctx.fillStyle = '#3a2a2a';
  for (const dx of [-0.18, -0.06, 0.08, 0.2]) ctx.fillRect(dx * s, -s * 0.2, s * 0.05, s * 0.2);
  // wool
  ctx.fillStyle = '#f4ead2';
  for (const [dx, dy, r] of [[-0.18, -0.32, 0.16], [0, -0.38, 0.18], [0.16, -0.32, 0.15], [-0.05, -0.26, 0.17], [0.1, -0.25, 0.15]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, TAU);
    ctx.fill();
  }
  // head
  ctx.fillStyle = '#4a3434';
  ctx.beginPath();
  ctx.ellipse(s * 0.3, -s * 0.4 + (sad ? s * 0.05 : 0), s * 0.1, s * 0.13, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(s * 0.33, -s * 0.43 + (sad ? s * 0.05 : 0), s * 0.025, 0, TAU);
  ctx.fill();
  ctx.restore();
  void t;
}

// ── the tide of the dark ─────────────────────────────────────────
/** The tide behind him: billowing ink and smoke from the left edge to its front (px), ember eyes in it. */
export function paintTide(ctx: CanvasRenderingContext2D, front: number, top: number, bottom: number, S: number, t: number, near: number): void {
  if (front < -S * 2) return;
  const g = ctx.createLinearGradient(front - S * 3, 0, front + S * 0.6, 0);
  g.addColorStop(0, 'rgba(10,7,14,.96)');
  g.addColorStop(0.75, 'rgba(18,12,24,.82)');
  g.addColorStop(1, 'rgba(18,12,24,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, top, Math.max(0, front + S * 0.6), bottom - top);
  // the billows along its front
  ctx.fillStyle = 'rgba(14,10,20,.9)';
  const n = Math.ceil((bottom - top) / (S * 0.7)) + 1;
  for (let i = 0; i < n; i++) {
    const y = top + i * S * 0.7;
    const r = S * (0.45 + 0.25 * Math.sin(t * 2.2 + i * 1.7));
    ctx.beginPath();
    ctx.arc(front + Math.sin(t * 1.6 + i) * S * 0.2, y, r, 0, TAU);
    ctx.fill();
  }
  // ember eyes in the dark (more of them when it is near)
  const eyes = 2 + Math.round(near * 4);
  for (let i = 0; i < eyes; i++) {
    const ex = front - S * (0.6 + hash(i * 11) * 2.4);
    const ey = top + (bottom - top) * (0.25 + hash(i * 5) * 0.55) + Math.sin(t * 1.3 + i) * S * 0.15;
    if (ex < 0) continue;
    const blink = (t * 0.6 + hash(i)) % 4 < 0.12;
    ctx.fillStyle = C.ember;
    for (const dx of [-S * 0.07, S * 0.07]) {
      ctx.beginPath();
      ctx.ellipse(ex + dx, ey, S * 0.045, blink ? S * 0.008 : S * 0.035, 0, 0, TAU);
      ctx.fill();
    }
  }
}

// ── the way out ──────────────────────────────────────────────────
/** The way out of a level: a tall doorway of warm light on the ledge's top. */
export function paintExit(ctx: CanvasRenderingContext2D, x: number, base: number, S: number, t: number): void {
  const w = S * 1.2, h = S * 2.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, base - h * 0.5, S * 2.6, 'rgba(255,214,150,', 0.45 + 0.1 * Math.sin(t * 3));
  ctx.restore();
  ctx.fillStyle = '#2a2033';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - S * 0.15, base);
  ctx.lineTo(x - w / 2 - S * 0.15, base - h + w / 2);
  ctx.arc(x, base - h + w / 2, w / 2 + S * 0.15, Math.PI, 0);
  ctx.lineTo(x + w / 2 + S * 0.15, base);
  ctx.fill();
  const g = ctx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, '#fff6dc');
  g.addColorStop(1, '#ffc87a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.lineTo(x - w / 2, base - h + w / 2);
  ctx.arc(x, base - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, base);
  ctx.fill();
  // motes rising through it
  for (let i = 0; i < 6; i++) {
    const k = (t * 0.4 + hash(i * 3)) % 1;
    ctx.fillStyle = `rgba(255,255,240,${0.8 * (1 - k)})`;
    ctx.beginPath();
    ctx.arc(x + (hash(i) - 0.5) * w * 0.8, base - k * h, S * 0.04, 0, TAU);
    ctx.fill();
  }
}

// ── what a guardian throws ───────────────────────────────────────
/** A throw: a brick rolling along the road, a wall sliding at him, a high beam at head height (px box). */
export function paintThrow(ctx: CanvasRenderingContext2D, kind: 'roll' | 'wall' | 'high', era: EraId, x: number, top: number, bottom: number, w: number, S: number, t: number): void {
  const c = STONE[era];
  if (kind === 'roll') {
    const r = (bottom - top) / 2;
    ctx.save();
    ctx.translate(x + w / 2, bottom - r);
    ctx.rotate(-t * 9);
    ctx.fillStyle = c.face;
    ctx.fillRect(-r, -r * 0.7, r * 2, r * 1.4);
    ctx.fillStyle = c.top;
    ctx.fillRect(-r, -r * 0.7, r * 2, r * 0.35);
    ctx.strokeStyle = c.line;
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.strokeRect(-r, -r * 0.7, r * 2, r * 1.4);
    ctx.restore();
    // dust behind it
    ctx.fillStyle = 'rgba(200,170,140,.25)';
    ctx.beginPath();
    ctx.arc(x + w + S * 0.2, bottom - S * 0.1, S * 0.14, 0, TAU);
    ctx.fill();
  } else if (kind === 'wall') {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, top, w, bottom - top);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const ry = top + r * (bottom - top) / rows;
      ctx.fillStyle = era === 'miasto' ? 'rgba(111,227,232,.35)' : era === 'twierdza' ? 'rgba(255,122,58,.35)' : 'rgba(224,162,90,.4)';
      ctx.fillRect(x + S * 0.05, ry + S * 0.05, w - S * 0.1, (bottom - top) / rows - S * 0.1);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, x, (top + bottom) / 2, S * 0.9, 'rgba(255,150,90,', 0.25);
    ctx.restore();
  } else {
    // a beam of smoke and embers (or of screen light) at head height
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const col = era === 'miasto' ? '111,227,232' : '255,140,80';
    g.addColorStop(0, `rgba(${col},.95)`);
    g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x, top, w * 0.8, bottom - top);
    ctx.fillStyle = g;
    ctx.fillRect(x, top + (bottom - top) * 0.3, w, (bottom - top) * 0.4);
  }
}

/** A rolling brick thrown by a shadow (smaller than a guardian's). */
export function paintRollBrick(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-t * 10);
  ctx.fillStyle = '#7a3e2a';
  ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2);
  ctx.fillStyle = '#a65a3a';
  ctx.fillRect(-r, -r * 0.6, r * 2, r * 0.35);
  ctx.restore();
}
