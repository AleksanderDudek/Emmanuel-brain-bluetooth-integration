/**
 * Zastępy's painter: a dawn sky over a sea of clouds, warm on the side of the gate of light and
 * dusky toward the gate of ash; a causeway of pale stone between them; and the sprites, seen from
 * the side.  The host (Hebrews 1:14: sent, serving) is white, gold and light — robes, wings, a
 * sword, a bow, a shield, a lance, a spear of light; never a face in detail, never a halo of glamour.
 * The demons are shadows: ink and smoke with ember eyes, no gore, no signs; when beaten they come
 * apart into ash and motes of light.  All in canvas paths, no images; sizes in metres times `s`
 * (px per metre), (x, y) at the feet.
 */
import { MIN_TEXT } from '../kit/mobile';
import type { DemonId, HostId } from './rules';

export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
/** A canvas font, never under MIN_TEXT (11 px, kit/mobile): smaller text is a smudge on a phone at arm's length. */
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(Math.max(MIN_TEXT, size) * 10) / 10}px ${family}`;

export const C = {
  ink: '#2a1f2e', inkSoft: 'rgba(42,31,46,.82)', paper: '#fff8e8', gold: '#e8b04a', goldDeep: '#b97f1f', goldLight: '#ffe08a',
  cream: '#fff1c9', white: '#fffdf6', robe: '#fbf7ee', robeShade: '#e6dccb', wingBack: '#f1e2bd', skin: '#f2d6b3', hair: '#d9a441',
  light: '#fff3c4', blue: '#8fb3e8', blueDeep: '#4f6fa8', mist: '#8a7aa8',
  stone: '#e9dcc0', stoneShade: '#c9b48f', stoneDark: '#9c8566', cloud: '#fff6e6', cloudShade: '#f0d9c4',
  shadow: '#1d1622', smoke: '#3a2c3c', ember: '#ff8a3d', emberCore: '#ffd27a', ash: '#8f8592', basalt: '#2b2230', basaltLight: '#4a3a4c',
  horse: '#fbf8f0', horseShade: '#ddd3c2',
};

/** A stable pseudo-random number 0..1 from an integer. */
export function hash(i: number): number {
  let x = (i | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;

/** How a fighter stands this frame. */
export interface Pose {
  /** the clock (s) and the walk's phase; 0..1 how much it walks */
  t: number;
  step: number;
  walk: number;
  /** 0..1 a strike in progress (1 at the blow, easing out) */
  atk: number;
  /** 0..1 the flash of being hurt */
  hurt: number;
  /** 0..1 the shield of light's share */
  shield: number;
  /** 0..1 dissolving (beaten / fallen back into light) */
  gone: number;
  /** a per-fighter seed */
  seed: number;
  /** the age of the fortress (0 stone … 4 pearl): the host's dress */
  age: number;
  /** 0..1 a boss winding up its special */
  wind: number;
}

export const POSE: Pose = { t: 0, step: 0, walk: 0, atk: 0, hurt: 0, shield: 0, gone: 0, seed: 1, age: 0, wind: 0 };

/** Each age's trim (stone: gold thread; cedar: honey; bronze; gold; pearl) and its armour plate. */
export const AGE_TRIM = ['#e8b04a', '#c98a3a', '#b8743a', '#f0bf3c', '#9fb3e0'] as const;
const AGE_PLATE = ['', '', '#c4874a', '#f3cf62', '#eef1fb'] as const;

/** A soft shadow on the road under a fighter. */
export function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, a = 0.22): void {
  ctx.fillStyle = `rgba(60,40,50,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, TAU);
  ctx.fill();
}

// ── the host ──────────────────────────────────────────────────────
/** A wing from the shoulder (0, 0), sweeping back and up; `open` 0..1 lifts it. */
function wing(ctx: CanvasRenderingContext2D, len: number, open: number, back: boolean): void {
  const lift = -0.35 - 0.55 * open;
  ctx.save();
  ctx.rotate(lift);
  const g = ctx.createLinearGradient(0, 0, -len, 0);
  g.addColorStop(0, back ? C.wingBack : C.white);
  g.addColorStop(1, back ? '#e9cf94' : '#ffe9b0');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-len * 0.3, -len * 0.32, -len * 0.75, -len * 0.3, -len, -len * 0.05);
  // the scalloped trailing edge: four primaries
  for (let i = 0; i < 4; i++) {
    const a = -len + (i + 0.5) * (len * 0.22), b = -len + (i + 1) * (len * 0.22);
    ctx.quadraticCurveTo(a, len * (0.2 - i * 0.02), b, len * (0.06 - i * 0.03));
  }
  ctx.quadraticCurveTo(-len * 0.08, len * 0.08, 0, 0);
  ctx.fill();
  ctx.strokeStyle = back ? 'rgba(185,127,31,.35)' : 'rgba(185,127,31,.5)';
  ctx.lineWidth = len * 0.025;
  ctx.stroke();
  ctx.restore();
}

/** A robed figure (white with a gold hem), in metres, facing right; `k` scales it.  Returns the shoulder and the hand. */
function robed(ctx: CanvasRenderingContext2D, p: Pose, o: { k: number; wide?: number; wings?: number; arm?: number; legs?: boolean }): { sx: number; sy: number; hx: number; hy: number } {
  const k = o.k, wide = o.wide ?? 1;
  const sway = Math.sin(p.step * Math.PI) * 0.05 * p.walk;
  const open = 0.35 + 0.25 * Math.sin(p.t * 3 + p.seed) + p.atk * 0.25;
  // the far wing
  ctx.save();
  ctx.translate(-0.06 * k, -1.02 * k);
  wing(ctx, 0.85 * k * (o.wings ?? 1), open * 0.9, true);
  ctx.restore();
  // the robe
  const g = ctx.createLinearGradient(-0.3 * k, 0, 0.3 * k, 0);
  g.addColorStop(0, C.robeShade);
  g.addColorStop(0.55, C.robe);
  g.addColorStop(1, C.white);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-0.15 * k * wide, -0.98 * k);
  ctx.lineTo(0.15 * k * wide, -0.98 * k);
  ctx.quadraticCurveTo(0.22 * k * wide, -0.5 * k, (0.3 * wide + sway) * k, -0.04 * k);
  ctx.lineTo((-0.28 * wide + sway) * k, -0.04 * k);
  ctx.quadraticCurveTo(-0.22 * k * wide, -0.5 * k, -0.15 * k * wide, -0.98 * k);
  ctx.fill();
  // the hem and belt in the age's trim
  const age = Math.max(0, Math.min(4, p.age | 0));
  ctx.strokeStyle = AGE_TRIM[age];
  ctx.lineWidth = 0.05 * k;
  ctx.beginPath();
  ctx.moveTo((-0.28 * wide + sway) * k, -0.06 * k);
  ctx.lineTo((0.3 * wide + sway) * k, -0.06 * k);
  ctx.moveTo(-0.19 * k * wide, -0.58 * k);
  ctx.lineTo(0.2 * k * wide, -0.58 * k);
  ctx.stroke();
  ageDress(ctx, age, k, wide);
  // feet in the step
  if (o.legs !== false) {
    ctx.fillStyle = C.skin;
    const f = Math.sin(p.step * Math.PI) * 0.12 * p.walk;
    for (const d of [f, -f]) {
      ctx.beginPath();
      ctx.ellipse((d + 0.04) * k, -0.03 * k, 0.07 * k, 0.035 * k, 0, 0, TAU);
      ctx.fill();
    }
  }
  // the head: a soft light behind it, hair of gold, no features
  const hx = 0.03 * k, hy = -1.17 * k;
  const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 0.32 * k);
  glow.addColorStop(0, 'rgba(255,243,196,.75)');
  glow.addColorStop(1, 'rgba(255,243,196,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.32 * k, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, 0.135 * k, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.arc(hx - 0.02 * k, hy - 0.02 * k, 0.14 * k, Math.PI * 0.95, Math.PI * 2.15);
  ctx.quadraticCurveTo(hx - 0.16 * k, hy + 0.05 * k, hx - 0.12 * k, hy + 0.14 * k);
  ctx.fill();
  // the near wing
  ctx.save();
  ctx.translate(-0.1 * k, -0.98 * k);
  wing(ctx, 0.78 * k * (o.wings ?? 1), open, false);
  ctx.restore();
  const arm = o.arm ?? 0;
  const sx = 0.08 * k, sy = -0.88 * k;
  return { sx, sy, hx: sx + Math.cos(arm) * 0.32 * k, hy: sy + Math.sin(arm) * 0.32 * k };
}

/**
 * What an age adds to the robe: a sash (cedar), a breastplate (bronze), a gold one with shoulder
 * guards and a circlet (gold), a pearl plate with a cool sheen (pearl).  Craft, not glamour.
 */
function ageDress(ctx: CanvasRenderingContext2D, age: number, k: number, wide: number): void {
  if (age < 1) return;
  if (age === 1) {
    ctx.strokeStyle = AGE_TRIM[1];
    ctx.lineWidth = 0.06 * k;
    ctx.beginPath();
    ctx.moveTo(-0.13 * k * wide, -0.95 * k);
    ctx.lineTo(0.17 * k * wide, -0.6 * k);
    ctx.stroke();
    return;
  }
  const plate = AGE_PLATE[age];
  const g = ctx.createLinearGradient(-0.2 * k, -0.95 * k, 0.2 * k, -0.6 * k);
  g.addColorStop(0, plate);
  g.addColorStop(0.5, age === 4 ? '#ffffff' : '#fff3d0');
  g.addColorStop(1, age === 4 ? '#c9d4f2' : plate);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-0.16 * k * wide, -0.97 * k);
  ctx.lineTo(0.17 * k * wide, -0.97 * k);
  ctx.quadraticCurveTo(0.22 * k * wide, -0.75 * k, 0.17 * k * wide, -0.6 * k);
  ctx.lineTo(-0.15 * k * wide, -0.6 * k);
  ctx.quadraticCurveTo(-0.21 * k * wide, -0.75 * k, -0.16 * k * wide, -0.97 * k);
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,30,.35)';
  ctx.lineWidth = 0.02 * k;
  ctx.stroke();
  if (age >= 3) {
    // shoulder guards and a circlet over the hair
    ctx.fillStyle = plate;
    ctx.beginPath();
    ctx.ellipse(0.09 * k, -0.95 * k, 0.11 * k, 0.06 * k, -0.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = AGE_TRIM[age];
    ctx.lineWidth = 0.035 * k;
    ctx.beginPath();
    ctx.arc(0.03 * k, -1.17 * k, 0.15 * k, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }
}

/** An arm of the robe from the shoulder to the hand. */
function arm(ctx: CanvasRenderingContext2D, a: { sx: number; sy: number; hx: number; hy: number }, k: number): void {
  ctx.strokeStyle = C.robe;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.1 * k;
  ctx.beginPath();
  ctx.moveTo(a.sx, a.sy);
  ctx.lineTo(a.hx, a.hy);
  ctx.stroke();
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(a.hx, a.hy, 0.05 * k, 0, TAU);
  ctx.fill();
}

/** A blade of light from the hand at `ang`. */
function blade(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, wid: number, glow: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  if (glow > 0.05) {
    // the glow: a wider, fainter blade under it (no per-frame shadowBlur)
    ctx.fillStyle = `rgba(255,224,138,${0.32 * Math.min(1, glow)})`;
    ctx.beginPath();
    ctx.moveTo(0, -wid * 2.1);
    ctx.lineTo(len * 0.9, -wid * 1.7);
    ctx.lineTo(len + wid * 1.4, 0);
    ctx.lineTo(len * 0.9, wid * 1.7);
    ctx.lineTo(0, wid * 2.1);
    ctx.closePath();
    ctx.fill();
  }
  const g = ctx.createLinearGradient(0, 0, len, 0);
  g.addColorStop(0, C.goldLight);
  g.addColorStop(1, C.white);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -wid);
  ctx.lineTo(len * 0.88, -wid * 0.7);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.88, wid * 0.7);
  ctx.lineTo(0, wid);
  ctx.closePath();
  ctx.fill();
  // the guard
  ctx.fillStyle = C.goldDeep;
  ctx.fillRect(-wid * 0.6, -wid * 2.4, wid * 1.2, wid * 4.8);
  ctx.restore();
}

/** The round shield with a sunburst. */
function shieldDisc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  g.addColorStop(0, C.white);
  g.addColorStop(1, '#efe2c2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = r * 0.16;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,176,74,.8)';
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.moveTo(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22);
    ctx.lineTo(x + Math.cos(a) * r * (i % 2 ? 0.55 : 0.72), y + Math.sin(a) * r * (i % 2 ? 0.55 : 0.72));
  }
  ctx.stroke();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.18, 0, TAU);
  ctx.fill();
}

/** A unit of the host at (x, y), facing right, `s` px per metre. */
export function paintHost(ctx: CanvasRenderingContext2D, id: HostId, x: number, y: number, s: number, p: Pose = POSE): void {
  if (!(s > 0)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (p.gone > 0) {
    ctx.globalAlpha = Math.max(0, 1 - p.gone);
    ctx.translate(0, -p.gone * 0.6);
  }
  const bob = Math.abs(Math.sin(p.step * Math.PI)) * 0.04 * p.walk;
  ctx.translate(0, -bob);
  const a = p.atk;
  switch (id) {
    case 'straznik': {
      const r = robed(ctx, p, { k: 1, arm: -0.4 + a * 1.1 });
      arm(ctx, r, 1);
      blade(ctx, r.hx, r.hy, -1.25 + a * 1.9, 0.62, 0.04, 1 + a);
      break;
    }
    case 'lucznik': {
      const r = robed(ctx, p, { k: 0.96, arm: -0.15 });
      arm(ctx, r, 0.96);
      // the bow of light, drawn back before the shot
      const pull = a > 0.5 ? 0 : 0.12 * (1 - a * 2);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.arc(r.hx - 0.1, r.hy, 0.36, -1.1, 1.1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,253,246,.9)';
      ctx.lineWidth = 0.018;
      const tx = r.hx - 0.1 + Math.cos(1.1) * 0.36, ty = Math.sin(1.1) * 0.36;
      ctx.beginPath();
      ctx.moveTo(tx, r.hy - ty);
      ctx.lineTo(r.hx - 0.1 - pull - 0.1, r.hy);
      ctx.lineTo(tx, r.hy + ty);
      ctx.stroke();
      if (a < 0.5) {
        ctx.strokeStyle = C.light;
        ctx.lineWidth = 0.03;
        ctx.beginPath();
        ctx.moveTo(r.hx - 0.2 - pull, r.hy);
        ctx.lineTo(r.hx + 0.3, r.hy);
        ctx.stroke();
      }
      break;
    }
    case 'tarczownik': {
      const r = robed(ctx, p, { k: 1.06, wide: 1.25, arm: 0.1 });
      arm(ctx, r, 1.06);
      blade(ctx, r.sx - 0.05, r.sy + 0.05, -1.7 + a * 0.9, 0.45, 0.035, 0.6);
      shieldDisc(ctx, 0.3 + a * 0.08, -0.62, 0.36);
      break;
    }
    case 'wlocznik': {
      // a long spear of light held level, ready to meet a charge
      const r = robed(ctx, p, { k: 1, arm: 0.05 + a * 0.1 });
      arm(ctx, r, 1);
      const ang = -0.12 + a * 0.06, push = a * 0.25;
      ctx.save();
      ctx.translate(r.hx + push, r.hy);
      ctx.rotate(ang);
      ctx.strokeStyle = '#a2742c';
      ctx.lineWidth = 0.045;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-0.55, 0);
      ctx.lineTo(0.75, 0);
      ctx.stroke();
      ctx.restore();
      blade(ctx, r.hx + push + Math.cos(ang) * 0.72, r.hy + Math.sin(ang) * 0.72, ang, 0.32, 0.05, 1 + a);
      break;
    }
    case 'jezdziec': {
      // the white horse (Revelation 19:14), then its rider
      const gal = p.step * Math.PI * 1.4;
      ctx.fillStyle = C.horseShade;
      for (const [lx, ph] of [[-0.42, 0], [0.38, Math.PI]] as const) {
        const sw = Math.sin(gal + ph) * 0.22 * p.walk;
        ctx.beginPath();
        ctx.moveTo(lx, -0.62);
        ctx.lineTo(lx - 0.05 + sw, -0.02);
        ctx.lineTo(lx + 0.05 + sw, -0.02);
        ctx.lineTo(lx + 0.08, -0.62);
        ctx.fill();
      }
      ctx.fillStyle = C.horse;
      for (const [lx, ph] of [[-0.32, Math.PI * 0.5], [0.48, Math.PI * 1.5]] as const) {
        const sw = Math.sin(gal + ph) * 0.22 * p.walk;
        ctx.beginPath();
        ctx.moveTo(lx, -0.62);
        ctx.lineTo(lx - 0.05 + sw, -0.02);
        ctx.lineTo(lx + 0.05 + sw, -0.02);
        ctx.lineTo(lx + 0.08, -0.62);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.ellipse(0.02, -0.74, 0.62, 0.24, 0, 0, TAU);
      ctx.fill();
      // neck and head
      ctx.beginPath();
      ctx.moveTo(0.42, -0.86);
      ctx.quadraticCurveTo(0.62, -1.25, 0.82, -1.22);
      ctx.lineTo(0.95, -1.05);
      ctx.lineTo(0.84, -1.0);
      ctx.quadraticCurveTo(0.7, -0.92, 0.6, -0.7);
      ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(0.44, -0.92);
      ctx.quadraticCurveTo(0.58, -1.3, 0.78, -1.26);
      ctx.lineTo(0.7, -1.16);
      ctx.quadraticCurveTo(0.56, -1.1, 0.5, -0.86);
      ctx.fill();
      // the tail
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(-0.58, -0.82);
      ctx.quadraticCurveTo(-0.85, -0.7 + Math.sin(p.t * 6) * 0.05, -0.78, -0.42);
      ctx.stroke();
      // the rider
      ctx.save();
      ctx.translate(-0.05, -0.62);
      ctx.scale(0.78, 0.78);
      const r = robed(ctx, { ...p, walk: 0 }, { k: 1, arm: -0.05 + a * 0.15, legs: false, wings: 0.9 });
      arm(ctx, r, 1);
      blade(ctx, r.hx - 0.2, r.hy, -0.08 + a * 0.12, 1.15, 0.035, 1 + a);
      ctx.restore();
      break;
    }
    case 'serafin': {
      // six wings (Isaiah 6:2) around a core of light; fire in the hands
      const f = Math.sin(p.t * 9 + p.seed) * 0.25;
      const core = ctx.createRadialGradient(0, -0.75, 0, 0, -0.75, 0.75);
      core.addColorStop(0, 'rgba(255,253,246,1)');
      core.addColorStop(0.4, p.age >= 4 ? 'rgba(200,214,255,.8)' : p.age >= 2 ? 'rgba(255,206,110,.85)' : 'rgba(255,224,138,.8)');
      core.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, -0.75, 0.75, 0, TAU);
      ctx.fill();
      for (const [ang, len, back] of [[-2.2 + f, 0.75, true], [-0.95 - f, 0.75, false], [-2.9, 0.6, true], [-0.25, 0.6, false], [2.4 - f * 0.5, 0.5, true], [0.75 + f * 0.5, 0.5, false]] as const) {
        ctx.save();
        ctx.translate(0, -0.78);
        ctx.rotate(ang + Math.PI);
        wing(ctx, len, 0.2, back);
        ctx.restore();
      }
      ctx.fillStyle = C.white;
      ctx.beginPath();
      ctx.ellipse(0, -0.72, 0.13, 0.26, 0, 0, TAU);
      ctx.fill();
      // the flame
      const fx = 0.22, fy = -0.72, fl = 0.18 + a * 0.12 + Math.sin(p.t * 14) * 0.02;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy - fl * 0.5, fl * 1.4);
      fg.addColorStop(0, '#fffdf0');
      fg.addColorStop(0.5, '#ffd27a');
      fg.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - fl * 0.5, fy);
      ctx.quadraticCurveTo(fx, fy - fl * 2.2, fx + fl * 0.5, fy);
      ctx.quadraticCurveTo(fx, fy + fl * 0.6, fx - fl * 0.5, fy);
      ctx.fill();
      break;
    }
    case 'archaniol': {
      const r = robed(ctx, p, { k: 1.38, wide: 1.1, wings: 1.35, arm: -0.25 + a * 0.5 });
      // a breastplate of gold
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(-0.17, -1.3);
      ctx.lineTo(0.19, -1.3);
      ctx.quadraticCurveTo(0.24, -1.0, 0.16, -0.82);
      ctx.lineTo(-0.15, -0.82);
      ctx.quadraticCurveTo(-0.22, -1.0, -0.17, -1.3);
      ctx.fill();
      arm(ctx, r, 1.38);
      // the spear of light
      ctx.save();
      ctx.translate(r.hx, r.hy);
      ctx.rotate(-0.35 + a * 0.45);
      ctx.strokeStyle = C.goldDeep;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      ctx.moveTo(-0.6, 0);
      ctx.lineTo(0.6, 0);
      ctx.stroke();
      ctx.restore();
      blade(ctx, r.hx + Math.cos(-0.35 + a * 0.45) * 0.55, r.hy + Math.sin(-0.35 + a * 0.45) * 0.55, -0.35 + a * 0.45, 0.42, 0.06, 1.4 + a);
      break;
    }
  }
  // the shield of light laid in the stillness
  if (p.shield > 0.02) {
    ctx.strokeStyle = `rgba(190,215,255,${0.35 + 0.5 * p.shield})`;
    ctx.fillStyle = `rgba(190,215,255,${0.12 * p.shield})`;
    ctx.lineWidth = 0.05;
    ctx.beginPath();
    ctx.ellipse(0.1, -0.72, 0.62, 0.86, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  if (p.hurt > 0) hurtFlash(ctx, 0, -0.75, 0.55, '255,255,255', 0.4 * p.hurt);
  ctx.restore();
}

/** A soft flash of light over a body that was struck (in the sprite's metres). */
function hurtFlash(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.8, r, 0, 0, TAU);
  ctx.fill();
}

// ── the demons ────────────────────────────────────────────────────
/** Two ember eyes looking ahead. */
function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, gap: number, t: number): void {
  const flick = 0.85 + 0.15 * Math.sin(t * 7);
  ctx.save();
  // the glow: a wider, fainter ember under each eye (no shadowBlur: it costs a phone a frame's worth of fill)
  ctx.fillStyle = 'rgba(255,138,61,.3)';
  for (const dx of [0, gap]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y, r * 2.1, r * 1.35 * flick, -0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.ember;
  for (const dx of [0, gap]) {
    ctx.beginPath();
    ctx.ellipse(x + dx, y, r * 1.2, r * 0.7 * flick, -0.2, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = C.emberCore;
  for (const dx of [0, gap]) {
    ctx.beginPath();
    ctx.arc(x + dx + r * 0.2, y, r * 0.38, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Smoke curling off a shadow. */
function wisps(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, sz: number, t: number, seed: number): void {
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.6 + hash(seed * 13 + i)) % 1;
    ctx.fillStyle = `rgba(58,44,60,${0.35 * (1 - ph)})`;
    ctx.beginPath();
    ctx.arc(x + (hash(seed + i * 7) - 0.5) * sz * 2 + Math.sin(t * 2 + i) * sz * 0.2, y - ph * sz * 2.2, sz * (0.35 + ph * 0.5), 0, TAU);
    ctx.fill();
  }
}

/** A shadow's body gradient: ink at the heart, smoke at the edge. */
function inkFill(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): CanvasGradient {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, '#120c16');
  g.addColorStop(0.7, C.shadow);
  g.addColorStop(1, C.smoke);
  return g;
}

/** A demon at (x, y), facing left (toward the gate of light), `s` px per metre. */
export function paintDemon(ctx: CanvasRenderingContext2D, id: DemonId, x: number, y: number, s: number, p: Pose = POSE): void {
  if (!(s > 0)) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(-s, s);
  if (p.gone > 0) {
    ctx.globalAlpha = Math.max(0, 1 - p.gone * 1.2);
    ctx.scale(1 + p.gone * 0.3, 1 - p.gone * 0.4);
  }
  const t = p.t, a = p.atk;
  const bob = Math.abs(Math.sin(p.step * Math.PI)) * 0.05 * p.walk;
  ctx.translate(0, -bob);
  switch (id) {
    case 'chochlik': {
      wisps(ctx, 0, -0.62, 3, 0.12, t, p.seed);
      ctx.fillStyle = inkFill(ctx, 0, -0.36, 0.4);
      const f = Math.sin(p.step * Math.PI) * 0.1 * p.walk;
      ctx.beginPath();
      ctx.moveTo(-0.28, -0.3);
      ctx.quadraticCurveTo(-0.3, -0.66, -0.12, -0.7);
      ctx.lineTo(-0.16, -0.86);
      ctx.lineTo(0.0, -0.72);
      ctx.lineTo(0.14, -0.88);
      ctx.lineTo(0.16, -0.7);
      ctx.quadraticCurveTo(0.34, -0.62, 0.3 + a * 0.12, -0.32);
      ctx.quadraticCurveTo(0.26, -0.08, 0.12 + f, 0);
      ctx.lineTo(0.02 + f, -0.16);
      ctx.lineTo(-0.06 - f, -0.16);
      ctx.lineTo(-0.14 - f, 0);
      ctx.quadraticCurveTo(-0.3, -0.1, -0.28, -0.3);
      ctx.fill();
      eyes(ctx, 0.06, -0.5, 0.045, 0.13, t + p.seed);
      break;
    }
    case 'cien': {
      wisps(ctx, -0.05, -1.4, 3, 0.16, t, p.seed);
      const wav = (k: number) => Math.sin(t * 3 + k + p.seed) * 0.05;
      ctx.fillStyle = inkFill(ctx, 0, -0.8, 0.9);
      ctx.beginPath();
      ctx.moveTo(-0.32, -0.02 + wav(0));
      for (let i = 1; i <= 6; i++) ctx.lineTo(-0.32 + i * 0.11, (i % 2 ? -0.16 : -0.02) + wav(i));
      ctx.quadraticCurveTo(0.42 + a * 0.15, -0.7, 0.2, -1.28);
      ctx.quadraticCurveTo(0.05, -1.62, -0.18, -1.44);
      ctx.quadraticCurveTo(-0.42, -0.9, -0.32, -0.02 + wav(0));
      ctx.fill();
      // the reaching arm
      ctx.strokeStyle = C.shadow;
      ctx.lineWidth = 0.09;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0.18, -0.95);
      ctx.quadraticCurveTo(0.42 + a * 0.3, -0.85, 0.5 + a * 0.35, -0.62 + a * 0.1);
      ctx.stroke();
      // the hood's hollow
      ctx.fillStyle = '#0a070c';
      ctx.beginPath();
      ctx.ellipse(0.1, -1.22, 0.13, 0.15, 0.3, 0, TAU);
      ctx.fill();
      eyes(ctx, 0.05, -1.22, 0.04, 0.1, t + p.seed);
      break;
    }
    case 'ogar': {
      const gal = p.step * Math.PI * 1.6;
      wisps(ctx, -0.35, -0.75, 2, 0.12, t, p.seed);
      ctx.strokeStyle = C.shadow;
      ctx.lineWidth = 0.08;
      ctx.lineCap = 'round';
      for (const [lx, ph] of [[-0.35, 0], [-0.22, Math.PI], [0.28, Math.PI * 0.5], [0.4, Math.PI * 1.5]] as const) {
        const sw = Math.sin(gal + ph) * 0.18 * p.walk;
        ctx.beginPath();
        ctx.moveTo(lx, -0.42);
        ctx.lineTo(lx + sw, -0.02);
        ctx.stroke();
      }
      ctx.fillStyle = inkFill(ctx, 0, -0.52, 0.6);
      ctx.beginPath();
      ctx.moveTo(-0.6, -0.55);
      ctx.lineTo(-0.48, -0.66);
      // the spiky ridge
      for (let i = 0; i < 6; i++) ctx.lineTo(-0.4 + i * 0.13, i % 2 ? -0.7 : -0.82);
      ctx.quadraticCurveTo(0.42, -0.72, 0.5, -0.72);
      ctx.lineTo(0.76 + a * 0.15, -0.64);
      ctx.lineTo(0.78 + a * 0.15, -0.52);
      ctx.lineTo(0.55, -0.5);
      ctx.quadraticCurveTo(0.4, -0.36, 0.1, -0.38);
      ctx.quadraticCurveTo(-0.4, -0.36, -0.6, -0.55);
      ctx.fill();
      eyes(ctx, 0.56, -0.65, 0.035, 0.0001, t + p.seed);
      break;
    }
    case 'skrzydlak': {
      const flap = Math.sin(t * 12 + p.seed) * 0.6;
      ctx.fillStyle = C.shadow;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(0, -0.4);
        ctx.scale(1, side === 1 ? 1 : 0.85);
        ctx.rotate(side === 1 ? -0.3 - flap : 0.2 + flap * 0.6);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-0.3, -0.5, -0.75, -0.42);
        ctx.lineTo(-0.62, -0.25);
        ctx.lineTo(-0.5, -0.32);
        ctx.lineTo(-0.42, -0.14);
        ctx.lineTo(-0.3, -0.2);
        ctx.lineTo(-0.2, 0.04);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = inkFill(ctx, 0.05, -0.4, 0.3);
      ctx.beginPath();
      ctx.ellipse(0.04, -0.4, 0.24, 0.15, -0.15, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0.22, -0.48);
      ctx.lineTo(0.38 + a * 0.1, -0.44);
      ctx.lineTo(0.24, -0.36);
      ctx.fill();
      eyes(ctx, 0.2, -0.45, 0.03, 0.0001, t + p.seed);
      break;
    }
    case 'bestia': {
      wisps(ctx, -0.1, -1.6, 4, 0.22, t, p.seed);
      const sw = Math.sin(p.step * Math.PI) * 0.1 * p.walk;
      ctx.fillStyle = inkFill(ctx, -0.05, -0.85, 1.1);
      ctx.beginPath();
      ctx.moveTo(-0.55, -0.02);
      ctx.lineTo(-0.38 + sw, -0.02);
      ctx.lineTo(-0.3, -0.45);
      ctx.lineTo(0.05, -0.45);
      ctx.lineTo(0.15 - sw, -0.02);
      ctx.lineTo(0.35 - sw, -0.02);
      ctx.quadraticCurveTo(0.42, -0.6, 0.36, -0.8);
      // the long arm, knuckles near the ground, raised to strike
      ctx.quadraticCurveTo(0.7 + a * 0.2, -0.75 - a * 0.4, 0.66 + a * 0.25, -0.14 - a * 0.5);
      ctx.lineTo(0.5 + a * 0.2, -0.12 - a * 0.5);
      ctx.quadraticCurveTo(0.5, -0.65, 0.3, -1.05);
      ctx.lineTo(0.42, -1.12);
      ctx.quadraticCurveTo(0.35, -1.42, 0.1, -1.5);
      ctx.quadraticCurveTo(-0.4, -1.62, -0.6, -1.2);
      ctx.quadraticCurveTo(-0.75, -0.6, -0.55, -0.02);
      ctx.fill();
      // ember cracks across the back
      ctx.strokeStyle = `rgba(255,138,61,${0.55 + 0.25 * Math.sin(t * 4 + p.seed)})`;
      ctx.lineWidth = 0.025;
      ctx.beginPath();
      ctx.moveTo(-0.45, -1.2);
      ctx.lineTo(-0.3, -1.05);
      ctx.lineTo(-0.35, -0.85);
      ctx.moveTo(-0.1, -1.38);
      ctx.lineTo(0.0, -1.15);
      ctx.stroke();
      eyes(ctx, 0.24, -1.2, 0.045, 0.1, t + p.seed);
      break;
    }
    case 'miotacz': {
      // a hunched shade with a sling of smoke, an ember in its pouch
      wisps(ctx, -0.1, -1.1, 3, 0.14, t, p.seed);
      ctx.fillStyle = inkFill(ctx, 0, -0.6, 0.8);
      const sw = Math.sin(p.step * Math.PI) * 0.08 * p.walk;
      ctx.beginPath();
      ctx.moveTo(-0.3, -0.02);
      ctx.lineTo(-0.16 + sw, -0.02);
      ctx.lineTo(-0.08, -0.3);
      ctx.lineTo(0.06, -0.3);
      ctx.lineTo(0.14 - sw, -0.02);
      ctx.lineTo(0.28, -0.02);
      ctx.quadraticCurveTo(0.32, -0.6, 0.18, -0.95);
      ctx.quadraticCurveTo(0.02, -1.18, -0.2, -1.02);
      ctx.quadraticCurveTo(-0.42, -0.6, -0.3, -0.02);
      ctx.fill();
      // the sling's whirl above the head
      const whirl = t * 9 + p.seed;
      const hx = 0.1, hy = -1.05, rr = 0.32 + a * 0.12;
      ctx.strokeStyle = 'rgba(29,22,34,.85)';
      ctx.lineWidth = 0.035;
      ctx.beginPath();
      ctx.moveTo(0.15, -0.85);
      ctx.lineTo(hx + Math.cos(whirl) * rr, hy + Math.sin(whirl) * rr * 0.4);
      ctx.stroke();
      ctx.fillStyle = C.emberCore;
      ctx.beginPath();
      ctx.arc(hx + Math.cos(whirl) * rr, hy + Math.sin(whirl) * rr * 0.4, 0.06, 0, TAU);
      ctx.fill();
      eyes(ctx, 0.1, -0.86, 0.035, 0.09, t + p.seed);
      break;
    }
    case 'kolos': {
      paintKolos(ctx, t, a, p.wind, p.step, p.walk, p.seed);
      break;
    }
    case 'szarancza': {
      paintLocust(ctx, t, a, p.wind, p.seed);
      break;
    }
    case 'smok': {
      paintSmokBody(ctx, t, Math.max(a, p.wind), p.seed);
      break;
    }
  }
  if (p.hurt > 0) {
    if (id === 'smok' || id === 'kolos' || id === 'szarancza') hurtFlash(ctx, 0.4, -1.6, 1.7, '255,214,170', 0.5 * p.hurt);
    else hurtFlash(ctx, 0.05, id === 'skrzydlak' ? -0.4 : id === 'chochlik' || id === 'ogar' ? -0.45 : -0.8, id === 'bestia' ? 0.7 : 0.45, '255,236,200', 0.35 * p.hurt);
  }
  ctx.restore();
}

/** The Colossus: a great figure of basalt and ash, ember seams, fists that come down in a stomp (facing right). */
function paintKolos(ctx: CanvasRenderingContext2D, t: number, a: number, wind: number, step: number, walk: number, seed: number): void {
  wisps(ctx, -0.2, -3.1, 6, 0.4, t, seed);
  const sw = Math.sin(step * Math.PI) * 0.12 * walk;
  const lift = wind * 0.9, slam = a;
  ctx.fillStyle = inkFill(ctx, 0, -1.7, 2.2);
  // legs
  ctx.beginPath();
  ctx.moveTo(-0.7, 0);
  ctx.lineTo(-0.55 + sw, -1.1);
  ctx.lineTo(-0.1, -1.1);
  ctx.lineTo(-0.25 - sw, 0);
  ctx.moveTo(0.05, 0);
  ctx.lineTo(0.15 - sw, -1.1);
  ctx.lineTo(0.6, -1.1);
  ctx.lineTo(0.5 + sw, 0);
  ctx.fill();
  // the trunk, broad shoulders, a small head sunk between them
  ctx.beginPath();
  ctx.moveTo(-0.75, -1.0);
  ctx.quadraticCurveTo(-1.05, -2.3, -0.6, -2.85);
  ctx.lineTo(0.75, -2.9);
  ctx.quadraticCurveTo(1.05, -2.2, 0.7, -1.0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.12, -3.05, 0.32, 0.28, 0, 0, TAU);
  ctx.fill();
  // the arms: raised for the stomp, down for a blow
  ctx.strokeStyle = C.shadow;
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.36;
  for (const side of [-1, 1]) {
    const sx = side * 0.75, sy = -2.6;
    const hx = sx + side * 0.25 + 0.4 * slam, hy = -1.2 - lift * 2.4 + slam * 0.6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + side * 0.45, (sy + hy) / 2, hx, hy);
    ctx.stroke();
    ctx.fillStyle = '#241b29';
    ctx.beginPath();
    ctx.arc(hx, hy, 0.3, 0, TAU);
    ctx.fill();
  }
  // ember seams, brighter as it winds up
  ctx.strokeStyle = `rgba(255,138,61,${0.5 + 0.4 * wind + 0.15 * Math.sin(t * 3 + seed)})`;
  ctx.lineWidth = 0.05;
  ctx.beginPath();
  ctx.moveTo(-0.4, -2.6);
  ctx.lineTo(-0.15, -2.1);
  ctx.lineTo(-0.3, -1.6);
  ctx.moveTo(0.35, -2.5);
  ctx.lineTo(0.2, -1.9);
  ctx.lineTo(0.45, -1.4);
  ctx.stroke();
  eyes(ctx, 0.22, -3.08, 0.07, 0.16, t + seed);
}

/** The Locust: a great shadow insect hovering low, wings a blur, long hind legs (facing right). */
function paintLocust(ctx: CanvasRenderingContext2D, t: number, a: number, wind: number, seed: number): void {
  const hover = -0.9 + Math.sin(t * 2.4 + seed) * 0.08;
  ctx.save();
  ctx.translate(0, hover);
  wisps(ctx, -1.2, -1.2, 5, 0.3, t, seed);
  // the blur of wings
  const buzz = Math.sin(t * 40) * 0.15;
  ctx.fillStyle = `rgba(42,31,46,${0.35 + 0.2 * wind})`;
  for (const k of [0, 1]) {
    ctx.beginPath();
    ctx.ellipse(-0.6 - k * 0.2, -1.1 - k * 0.1, 1.5, 0.42 + buzz, -0.25 - k * 0.15, 0, TAU);
    ctx.fill();
  }
  // the body: a long segmented abdomen, a thorax, a blunt head
  ctx.fillStyle = inkFill(ctx, 0, -0.7, 1.8);
  ctx.beginPath();
  ctx.ellipse(-1.0, -0.62, 1.15, 0.32, 0.08, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.35, -0.82, 0.5, 0.42, -0.1, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0.95 + a * 0.2, -0.95, 0.34, 0.36, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,138,61,.35)';
  ctx.lineWidth = 0.03;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    ctx.moveTo(-1.8 + i * 0.32, -0.88);
    ctx.lineTo(-1.75 + i * 0.32, -0.38);
  }
  ctx.stroke();
  // the hind leg, folded like a hinge, and the front legs
  ctx.strokeStyle = C.shadow;
  ctx.lineWidth = 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.0, -0.7);
  ctx.lineTo(-0.7, -1.55 - wind * 0.3);
  ctx.lineTo(-0.5, 0.75 - hover);
  ctx.moveTo(0.5, -0.5);
  ctx.lineTo(0.7, 0.1);
  ctx.lineTo(0.85, 0.85 - hover);
  ctx.moveTo(0.3, -0.5);
  ctx.lineTo(0.2, 0.2);
  ctx.lineTo(0.35, 0.85 - hover);
  ctx.stroke();
  // antennae
  ctx.lineWidth = 0.035;
  ctx.beginPath();
  ctx.moveTo(1.05, -1.25);
  ctx.quadraticCurveTo(1.4, -1.9, 1.9, -1.85 + Math.sin(t * 3) * 0.1);
  ctx.moveTo(0.95, -1.25);
  ctx.quadraticCurveTo(1.2, -2.0, 1.6, -2.15 + Math.sin(t * 3 + 1) * 0.1);
  ctx.stroke();
  eyes(ctx, 1.08, -1.0, 0.07, 0.0001, t + seed);
  ctx.restore();
}

/** The Smok, about four metres long, hovering low (in metres, facing right; the caller mirrors). */
function paintSmokBody(ctx: CanvasRenderingContext2D, t: number, a: number, seed: number): void {
  const flap = Math.sin(t * 2.2 + seed) * 0.35;
  wisps(ctx, -1.2, -1.2, 6, 0.4, t, seed);
  // the far wing
  ctx.fillStyle = '#241b29';
  wingOfShadow(ctx, -0.3, -1.6, 2.1, -0.5 - flap);
  // the body: a serpent's curve from the tail to the chest
  ctx.fillStyle = inkFill(ctx, 0, -1.2, 2.4);
  ctx.beginPath();
  ctx.moveTo(-2.4, -0.7 + Math.sin(t * 2) * 0.12);
  ctx.quadraticCurveTo(-1.7, -1.6, -0.6, -1.25);
  ctx.quadraticCurveTo(0.2, -1.0, 0.7, -1.4);
  // the neck up to the head
  ctx.quadraticCurveTo(1.05, -1.95 + a * 0.2, 1.45, -2.0 + a * 0.25);
  ctx.lineTo(2.05 + a * 0.2, -1.85 + a * 0.3);
  ctx.lineTo(1.95 + a * 0.2, -1.66 + a * 0.35);
  ctx.lineTo(1.55, -1.7 + a * 0.25);
  ctx.quadraticCurveTo(1.15, -1.4, 0.9, -0.95);
  ctx.quadraticCurveTo(0.4, -0.55, -0.4, -0.75);
  ctx.quadraticCurveTo(-1.4, -0.9, -2.4, -0.62 + Math.sin(t * 2) * 0.12);
  ctx.fill();
  // spines along the back
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = -1.6 + i * 0.36, y = -1.32 - Math.sin((i / 6) * Math.PI) * 0.1;
    ctx.moveTo(x - 0.1, y + 0.08);
    ctx.lineTo(x, y - 0.22);
    ctx.lineTo(x + 0.1, y + 0.08);
  }
  ctx.fill();
  // legs tucked under
  ctx.strokeStyle = C.shadow;
  ctx.lineWidth = 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0.3, -0.85);
  ctx.lineTo(0.42, -0.45);
  ctx.lineTo(0.6, -0.42);
  ctx.moveTo(-0.8, -0.85);
  ctx.lineTo(-0.72, -0.48);
  ctx.lineTo(-0.55, -0.45);
  ctx.stroke();
  // the throat's ember glow before the breath
  if (a > 0.05) {
    const g = ctx.createRadialGradient(1.95, -1.78, 0, 1.95, -1.78, 0.6);
    g.addColorStop(0, `rgba(255,210,122,${0.8 * a})`);
    g.addColorStop(1, 'rgba(255,138,61,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(1.95, -1.78, 0.6, 0, TAU);
    ctx.fill();
  }
  // the near wing
  ctx.fillStyle = '#1a1320';
  wingOfShadow(ctx, -0.1, -1.45, 2.4, -0.35 + flap);
  eyes(ctx, 1.62, -1.9 + a * 0.25, 0.06, 0.0001, t + seed);
}

/** A ragged wing of shadow from (x, y), `len` long, at `ang`. */
function wingOfShadow(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-len * 0.3, -len * 0.7, -len * 0.9, -len * 0.62);
  ctx.lineTo(-len * 0.78, -len * 0.38);
  ctx.lineTo(-len * 0.62, -len * 0.46);
  ctx.lineTo(-len * 0.52, -len * 0.22);
  ctx.lineTo(-len * 0.36, -len * 0.3);
  ctx.lineTo(-len * 0.28, -len * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ── the gates ─────────────────────────────────────────────────────
/** The gate of light's material in each age: shade, face, light. */
const GATE_STONE: readonly (readonly [string, string, string])[] = [
  [C.stoneShade, C.stone, '#f6ecd6'],
  ['#b99470', '#e3cba4', '#f4e4c6'],
  ['#c7a074', '#ead2a8', '#f8e9cc'],
  ['#d8b26a', '#f3dea6', '#fff3d2'],
  ['#c9cfe2', '#eef0f8', '#ffffff'],
];
/**
 * The gate of light: a tower of pale stone with a glowing arch facing the road and a lantern on top
 * (where the beam comes from).  `x` is the gate's face (world x = 0), `glow` 0..1 the flow of
 * light, `walls` 0..1 what is left of them (cracks show below 60 %).
 */
export function paintLightGate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { glow: number; walls: number; t: number; mend: number; age?: number }): { lx: number; ly: number } {
  const age = Math.max(0, Math.min(4, (o.age ?? 0) | 0));
  const w = 2.3 * s, h = 4.4 * s * (1 + 0.07 * age), x0 = x - w;
  const M = GATE_STONE[age];
  // the light falling into it from the sky
  const beam = ctx.createLinearGradient(0, y - h * 2.2, 0, y - h * 0.6);
  beam.addColorStop(0, 'rgba(255,243,196,0)');
  beam.addColorStop(1, `rgba(255,243,196,${0.18 + 0.32 * o.glow})`);
  ctx.fillStyle = beam;
  const bw = s * (0.5 + 0.9 * o.glow);
  ctx.fillRect(x0 + w / 2 - bw / 2, y - h * 2.2, bw, h * 1.6);
  // the tower
  const g = ctx.createLinearGradient(x0, 0, x, 0);
  g.addColorStop(0, M[0]);
  g.addColorStop(0.6, M[1]);
  g.addColorStop(1, M[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x0 + 0.1 * s, y - h);
  for (let i = 0; i < 4; i++) {
    const cx = x0 + 0.1 * s + (i * (w - 0.2 * s)) / 4;
    ctx.lineTo(cx, y - h - 0.3 * s);
    ctx.lineTo(cx + (w - 0.2 * s) / 8, y - h - 0.3 * s);
    ctx.lineTo(cx + (w - 0.2 * s) / 8, y - h);
  }
  ctx.lineTo(x - 0.1 * s, y - h);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  // stone courses
  ctx.strokeStyle = 'rgba(156,133,102,.35)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  for (let r = 1; r < 9; r++) {
    const yy = y - (r * h) / 9;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.05 * s, yy);
    ctx.lineTo(x - 0.05 * s, yy);
    ctx.stroke();
  }
  // the trim; the age's work on the tower: cedar beams, bronze bands and rivets, gold, pearl
  ctx.strokeStyle = AGE_TRIM[age];
  ctx.lineWidth = s * (0.08 + 0.02 * age);
  ctx.beginPath();
  ctx.moveTo(x0 + 0.1 * s, y - h + 0.05 * s);
  ctx.lineTo(x - 0.1 * s, y - h + 0.05 * s);
  ctx.stroke();
  if (age >= 1) {
    ctx.fillStyle = age === 1 ? 'rgba(150,96,44,.55)' : age === 4 ? 'rgba(170,190,240,.35)' : `rgba(${age === 2 ? '184,116,58' : '240,191,60'},.6)`;
    for (const k of [0.32, 0.62]) ctx.fillRect(x0 + 0.06 * s, y - h * k - 0.09 * s, w - 0.12 * s, 0.18 * s);
    if (age >= 2) {
      ctx.fillStyle = age === 4 ? '#ffffff' : '#fff1c9';
      for (const k of [0.32, 0.62]) for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(x0 + (0.18 + i * 0.16) * w, y - h * k, 0.045 * s, 0, TAU);
        ctx.fill();
      }
    }
    // a banner on the top, longer with each age
    const bx = x0 + 0.25 * w, by = y - h - 0.3 * s, bl = (0.8 + 0.2 * age) * s;
    ctx.strokeStyle = '#8a6a3a';
    ctx.lineWidth = Math.max(1, 0.05 * s);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx, by - 1.1 * s);
    ctx.stroke();
    ctx.fillStyle = AGE_TRIM[age];
    const wv = Math.sin(o.t * 3) * 0.08 * s;
    ctx.beginPath();
    ctx.moveTo(bx, by - 1.1 * s);
    ctx.quadraticCurveTo(bx - bl * 0.5, by - 1.0 * s + wv, bx - bl, by - 0.95 * s);
    ctx.lineTo(bx, by - 0.75 * s);
    ctx.fill();
  }
  if (age === 4) {
    // the pearl's sheen sliding up the tower
    const sh = (o.t * 0.25) % 1;
    const pg = ctx.createLinearGradient(0, y - h * sh - s, 0, y - h * sh + s);
    pg.addColorStop(0, 'rgba(255,255,255,0)');
    pg.addColorStop(0.5, 'rgba(225,232,255,.45)');
    pg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(x0 + 0.1 * s, y - h, w - 0.2 * s, h);
  }
  // the arch, glowing with the flow
  const ax = x - 0.95 * s, aw = 0.62 * s, ah = 2.1 * s;
  const ag = ctx.createRadialGradient(ax, y - ah * 0.5, 0, ax, y - ah * 0.5, ah);
  ag.addColorStop(0, '#fffdf0');
  ag.addColorStop(0.6, `rgba(255,224,138,${0.75 + 0.25 * o.glow})`);
  ag.addColorStop(1, 'rgba(255,200,90,.6)');
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.moveTo(ax - aw, y);
  ctx.lineTo(ax - aw, y - ah + aw);
  ctx.arc(ax, y - ah + aw, aw, Math.PI, 0);
  ctx.lineTo(ax + aw, y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = C.goldDeep;
  ctx.lineWidth = s * 0.06;
  ctx.stroke();
  // the lantern on top
  const lx = x0 + w * 0.55, ly = y - h - 0.75 * s;
  const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, s * (0.8 + 0.5 * o.glow));
  lg.addColorStop(0, 'rgba(255,253,240,1)');
  lg.addColorStop(0.35, 'rgba(255,224,138,.85)');
  lg.addColorStop(1, 'rgba(255,224,138,0)');
  ctx.fillStyle = lg;
  ctx.beginPath();
  ctx.arc(lx, ly, s * (0.8 + 0.5 * o.glow), 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.goldDeep;
  ctx.fillRect(lx - 0.18 * s, ly + 0.25 * s, 0.36 * s, 0.22 * s);
  // cracks as the walls give
  if (o.walls < 0.6) {
    const k = 1 - o.walls / 0.6;
    ctx.strokeStyle = `rgba(90,70,60,${0.35 + 0.5 * k})`;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.beginPath();
    const n = 1 + Math.floor(k * 4);
    for (let i = 0; i < n; i++) {
      let cx = x0 + (0.3 + hash(i * 3) * 0.4) * w, cy = y - (0.2 + hash(i * 5) * 0.7) * h;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 3; j++) {
        cx += (hash(i * 7 + j) - 0.5) * s * 0.6;
        cy += s * (0.25 + hash(i * 11 + j) * 0.3);
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
  }
  // mending: a blue-white shimmer climbing the stones
  if (o.mend > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const ph = (o.t * 0.5 + i / 6) % 1;
      ctx.fillStyle = `rgba(170,205,255,${0.35 * o.mend * Math.sin(ph * Math.PI)})`;
      ctx.beginPath();
      ctx.arc(x0 + (0.15 + hash(i * 17) * 0.7) * w, y - ph * h, s * 0.12, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  return { lx, ly };
}

/**
 * The gate of ash: a jagged arch of basalt with an ember-lit doorway and smoke over it.  `x` is the
 * gate's face (world x = road), `ash` 0..1 what is left of its walls, `fall` 0..1 its collapse.
 */
export function paintAshGate(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, o: { ash: number; t: number; fall: number; sealed: boolean }): { ex: number; ey: number } {
  const w = 2.4 * s, h = 4.6 * s * (1 - 0.75 * o.fall), x1 = x + w;
  wisps(ctx, x + w * 0.5, y - h - 0.2 * s, 6, s * 0.35, o.t, 77);
  ctx.save();
  if (o.fall > 0) ctx.globalAlpha = 1 - o.fall * 0.6;
  const g = ctx.createLinearGradient(x, 0, x1, 0);
  g.addColorStop(0, C.basaltLight);
  g.addColorStop(0.4, C.basalt);
  g.addColorStop(1, '#1a141e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 0.15 * s, y - h * 0.82);
  ctx.lineTo(x + 0.35 * s, y - h);
  ctx.lineTo(x + 0.6 * s, y - h * 0.9);
  ctx.lineTo(x + 0.95 * s, y - h * 1.08);
  ctx.lineTo(x + 1.3 * s, y - h * 0.92);
  ctx.lineTo(x + 1.7 * s, y - h * 1.04);
  ctx.lineTo(x + 2.05 * s, y - h * 0.86);
  ctx.lineTo(x1, y - h * 0.95);
  ctx.lineTo(x1, y);
  ctx.closePath();
  ctx.fill();
  // the doorway's embers
  const ax = x + 0.95 * s, aw = 0.6 * s, ah = Math.min(2.1 * s, h * 0.6);
  const dg = ctx.createRadialGradient(ax, y - ah * 0.4, 0, ax, y - ah * 0.4, ah);
  dg.addColorStop(0, o.sealed ? 'rgba(255,170,90,.95)' : 'rgba(255,190,110,.9)');
  dg.addColorStop(0.6, 'rgba(200,70,40,.85)');
  dg.addColorStop(1, 'rgba(60,20,30,.9)');
  ctx.fillStyle = dg;
  ctx.beginPath();
  ctx.moveTo(ax - aw, y);
  ctx.lineTo(ax - aw * 0.8, y - ah + aw * 0.6);
  ctx.lineTo(ax, y - ah);
  ctx.lineTo(ax + aw * 0.8, y - ah + aw * 0.6);
  ctx.lineTo(ax + aw, y);
  ctx.closePath();
  ctx.fill();
  // cracks of light as it gives way
  const k = 1 - o.ash;
  if (k > 0.05) {
    ctx.beginPath();
    const n = 1 + Math.floor(k * 6);
    for (let i = 0; i < n; i++) {
      let cx = x + (0.15 + hash(i * 3 + 1) * 0.75) * w, cy = y - (0.3 + hash(i * 5 + 2) * 0.6) * h;
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 3; j++) {
        cx += (hash(i * 7 + j + 3) - 0.5) * s * 0.7;
        cy += s * (0.2 + hash(i * 11 + j) * 0.35);
        ctx.lineTo(cx, cy);
      }
    }
    // the light through them: a wide faint stroke, then the bright line (no shadowBlur)
    ctx.strokeStyle = `rgba(255,224,138,${0.25 * k})`;
    ctx.lineWidth = Math.max(3, s * 0.16);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,236,170,${0.4 + 0.5 * k})`;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();
  }
  ctx.restore();
  return { ex: x + 1.2 * s, ey: y - h * 0.95 };
}

/** A little drop of light (the cards' price, the light bar's icon). */
export function lightDrop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1): void {
  ctx.save();
  ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(x - r * 0.3, y, 0, x, y, r * 1.4);
  g.addColorStop(0, '#fffdf0');
  g.addColorStop(1, C.gold);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.4);
  ctx.quadraticCurveTo(x + r, y - r * 0.2, x + r * 0.9, y + r * 0.25);
  ctx.arc(x, y + r * 0.25, r * 0.9, 0, Math.PI);
  ctx.quadraticCurveTo(x - r, y - r * 0.2, x, y - r * 1.4);
  ctx.fill();
  ctx.restore();
}

/** A gold coin. */
export function coin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.goldDeep;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.12, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,.9)';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.6, 0, TAU);
  ctx.stroke();
}

/** The trumpet, a long straight horn (in px, pointing right). */
export function paintTrumpet(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, len * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-len * 0.5, 0);
  ctx.lineTo(len * 0.25, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(len * 0.2, -len * 0.05);
  ctx.quadraticCurveTo(len * 0.38, -len * 0.08, len * 0.5, -len * 0.26);
  ctx.lineTo(len * 0.5, len * 0.26);
  ctx.quadraticCurveTo(len * 0.38, len * 0.08, len * 0.2, len * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-len * 0.5, 0, len * 0.07, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * The pillar of cloud (Exodus 14:19-20, it stood between the camps): a tall column of white cloud
 * with fire in its heart, standing on the road at `x`; `k` 0..1 what is left of its time, `rise`
 * 0..1 its coming down from the sky.  In px, `s` px per metre, (x, y) at its foot.
 */
export function paintPillar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, top: number, k: number, rise: number, t: number): void {
  const h = (y - top) * rise, w = 0.9 * s;
  const fade = Math.min(1, k * 4);
  ctx.save();
  ctx.globalAlpha *= fade;
  // the fire in its heart
  const fg = ctx.createLinearGradient(0, y - h, 0, y);
  fg.addColorStop(0, 'rgba(255,224,138,0)');
  fg.addColorStop(0.5, 'rgba(255,190,90,.55)');
  fg.addColorStop(1, 'rgba(255,236,170,.8)');
  ctx.fillStyle = fg;
  ctx.fillRect(x - w * 0.35, y - h, w * 0.7, h);
  // the cloud: puffs climbing the column
  for (let i = 0; i < 16; i++) {
    const ph = (i / 16 + t * 0.18) % 1;
    const py = y - ph * h;
    const r = w * (0.55 + 0.25 * Math.sin(i * 1.7 + t)) * (1 - ph * 0.25);
    const px = x + Math.sin(t * 1.3 + i * 2.1) * w * 0.18;
    ctx.fillStyle = `rgba(255,252,244,${0.55 * Math.sin(ph * Math.PI) + 0.25})`;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  // its foot swirls on the road
  ctx.strokeStyle = 'rgba(255,240,200,.85)';
  ctx.lineWidth = Math.max(1.5, 0.06 * s);
  ctx.beginPath();
  ctx.ellipse(x, y, w * (1.1 + 0.1 * Math.sin(t * 5)), w * 0.25, 0, 0, TAU);
  ctx.stroke();
  // the ring of time left, around its foot
  ctx.strokeStyle = 'rgba(185,127,31,.9)';
  ctx.lineWidth = Math.max(2, 0.08 * s);
  ctx.beginPath();
  ctx.ellipse(x, y, w * 1.35, w * 0.32, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  ctx.stroke();
  ctx.restore();
}

/**
 * Tymek, the cadet who keeps the host's chronicle: a round portrait (head and shoulders, brown curls,
 * a quill behind the ear, wing tips) for his speech bubbles.  No features beyond a cheerful tilt.
 */
export function paintTymek(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, talk: number): void {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.2) * r * 0.03 + talk * Math.abs(Math.sin(t * 12)) * r * 0.04;
  // the disc
  const g = ctx.createRadialGradient(0, -r * 0.2, 0, 0, 0, r);
  g.addColorStop(0, '#fffaf0');
  g.addColorStop(1, '#f6e2b4');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = C.gold;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, TAU);
  ctx.clip();
  ctx.translate(0, bob);
  // wing tips behind the shoulders
  ctx.fillStyle = C.white;
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sd * r * 0.55, r * 0.35, r * 0.32, r * 0.18, sd * -0.7, 0, TAU);
    ctx.fill();
  }
  // shoulders in a white robe with a honey sash
  ctx.fillStyle = C.robe;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.95, r * 0.62, r * 0.48, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#c98a3a';
  ctx.lineWidth = r * 0.1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.6);
  ctx.lineTo(r * 0.3, r * 1.0);
  ctx.stroke();
  // the head with a soft light, brown curls
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.36, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8a5a2e';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.05 + i * 0.13);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.33, r * 0.05 + Math.sin(a) * r * 0.33, r * 0.12, 0, TAU);
    ctx.fill();
  }
  // a cheerful closed-eye smile and rosy cheeks
  ctx.strokeStyle = 'rgba(70,40,30,.7)';
  ctx.lineWidth = Math.max(1, r * 0.04);
  ctx.beginPath();
  ctx.arc(-r * 0.12, r * 0.04, r * 0.05, Math.PI * 1.1, Math.PI * 1.9);
  ctx.arc(r * 0.14, r * 0.04, r * 0.05, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0.01 * r, r * 0.15, r * (0.08 + talk * 0.03 * Math.abs(Math.sin(t * 12))), 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(240,140,120,.35)';
  for (const sd of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sd * r * 0.22, r * 0.16, r * 0.06, 0, TAU);
    ctx.fill();
  }
  // the quill behind the ear
  ctx.strokeStyle = '#fffdf6';
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.05);
  ctx.quadraticCurveTo(r * 0.45, -r * 0.35, r * 0.55, -r * 0.62);
  ctx.stroke();
  ctx.strokeStyle = C.goldDeep;
  ctx.lineWidth = r * 0.025;
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.05);
  ctx.lineTo(r * 0.52, -r * 0.6);
  ctx.stroke();
  ctx.restore();
}

/** A five-pointed star (the battles' stars). */
export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * A soft round glow behind a ready button or a glowing card's badge: a radial sprite made once per colour
 * (64 px, scaled when drawn) instead of a per-frame shadowBlur, which a phone pays for in fill rate.  `rgb` as
 * "255,200,80"; `a` its strength.
 */
const GLOWS = new Map<string, HTMLCanvasElement | null>();
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a = 1): void {
  if (a <= 0.01 || r < 1) return;
  let c = GLOWS.get(rgb);
  if (c === undefined) {
    c = null;
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 64;
      const g = cv.getContext('2d');
      if (g) {
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${rgb},0.95)`);
        grad.addColorStop(0.5, `rgba(${rgb},0.45)`);
        grad.addColorStop(1, `rgba(${rgb},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        c = cv;
      }
    }
    GLOWS.set(rgb, c);
  }
  if (!c) return;
  const a0 = ctx.globalAlpha;
  ctx.globalAlpha = a0 * Math.min(1, a);
  ctx.drawImage(c, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = a0;
}

/**
 * The gates' bar's little gates, (x, y) at the foot, `s` tall: the tower of light (pale stone, a lit door, its
 * lantern) and the arch of ash (basalt with a jagged crown and an ember door).
 */
export function gateGlyph(ctx: CanvasRenderingContext2D, kind: 'light' | 'ash', x: number, y: number, s: number): void {
  ctx.save();
  if (kind === 'light') {
    const w = s * 0.6, bh = s * 0.78;
    ctx.fillStyle = C.stone;
    ctx.strokeStyle = C.stoneDark;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.rect(x - w / 2, y - bh, w, bh);
    for (let i = 0; i < 3; i++) ctx.rect(x - w / 2 + i * (w * 0.4), y - bh - s * 0.13, w * 0.2, s * 0.13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.goldLight;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.2, y);
    ctx.lineTo(x - w * 0.2, y - bh * 0.42);
    ctx.arc(x, y - bh * 0.42, w * 0.2, Math.PI, 0);
    ctx.lineTo(x + w * 0.2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.arc(x, y - bh - s * 0.2, s * 0.08, 0, TAU);
    ctx.fill();
  } else {
    const w = s * 0.7;
    ctx.fillStyle = C.basalt;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - s * 0.62);
    ctx.lineTo(x - w * 0.3, y - s * 0.95);
    ctx.lineTo(x - w * 0.1, y - s * 0.72);
    ctx.lineTo(x + w * 0.08, y - s);
    ctx.lineTo(x + w * 0.26, y - s * 0.74);
    ctx.lineTo(x + w / 2, y - s * 0.9);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.ember;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, y);
    ctx.lineTo(x - w * 0.18, y - s * 0.34);
    ctx.lineTo(x, y - s * 0.48);
    ctx.lineTo(x + w * 0.18, y - s * 0.34);
    ctx.lineTo(x + w * 0.18, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
