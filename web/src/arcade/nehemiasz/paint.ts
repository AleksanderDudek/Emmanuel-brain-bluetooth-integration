/**
 * Nehemiasz's art, drawn with canvas paths (no images): warm Jerusalem limestone and ochre by day,
 * deep indigo by night with the amber of the watch fires.  The world is seen from the city side at a
 * slant, so the wall shows its inner face and its walk, and the raiders at its outer foot stand just
 * above its top.  Figures share one painter (robes, headwear, a tool, a walk, a flinch, a comic
 * flight); buildings grow with their level.  Everything here is stateless.
 */
import type { Band, RaiderKind } from './content';

export const C = {
  // the day
  sky0: '#f9e2b3', sky1: '#f2c886', hill0: '#d2ae6c', hill1: '#b48d52', hill2: '#8c7446', olive: '#7d8a4e', oliveDark: '#5c6838',
  ground: '#e8d3a5', groundDark: '#d8bf8b', street: '#dcc596', road: '#c8a06a', roadEdge: '#a9824f',
  stone: '#ead6ad', stoneLight: '#f7e8c8', stoneDark: '#bf9d6b', stoneDeep: '#94744a', mortar: '#d1b98c',
  rubble: '#bba57f', rubbleDark: '#8f7b5c', timber: '#a0703f', timberDark: '#6e4a28', roof: '#cf8a55', roofDark: '#a5643a',
  mud: '#d9b382', mudDark: '#b8905f', cloth: '#3f6fb5', clothRed: '#c8553d',
  // the night
  night0: '#121834', night1: '#232a4e', nightGround: '#2b2b47', nightHill: '#1c2140',
  fire: '#ffb347', fireCore: '#fff1c2', gold: '#ffd36b', goldLight: '#ffe9a8', ember: '#ff7a3d', cream: '#fff5df',
  // people
  neh: '#3f6fb5', nehDark: '#2c5290', nehSash: '#e8b64a', tirza: '#c8553d', tirzaScarf: '#e3a33b', skin: '#d9a273', skinDark: '#b8835a',
  guard: '#6b7a8c', builder: '#b0875a', baker: '#efe6d2', water: '#5f8fae',
  samaria: '#7d8f3c', arabia: '#c5702f', ammon: '#7a55a0', raider: '#40384a', raiderDark: '#2a2531',
  ink: '#2b2118', paper: '#fff6e3', paperEdge: '#e2cfa6', calm: '#9fd3e6', calmDeep: '#4f8fb0', red: '#d2553f',
};

export const SANS = '"Manrope Variable", Manrope, system-ui, sans-serif';
export const SERIF = '"Fraunces Variable", Fraunces, Georgia, serif';
export const font = (px: number, weight = 700, family = SANS): string => `${weight} ${Math.round(px)}px ${family}`;
const TAU = Math.PI * 2;

/** A stable pseudo-random number in 0..1 for an integer seed. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A soft radial glow (`rgba(r,g,b,` without the alpha) — use with 'lighter' for light. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgba: string, a: number): void {
  if (!(r > 0)) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `${rgba}${a})`);
  g.addColorStop(1, `${rgba}0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A soft shadow under something standing on the ground. */
export function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, a = 0.22): void {
  ctx.fillStyle = `rgba(40,25,10,${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.36, 0, 0, TAU);
  ctx.fill();
}

const mix = (a: string, b: string, k: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - k) + ((pb >> 16) & 255) * k);
  const g = Math.round(((pa >> 8) & 255) * (1 - k) + ((pb >> 8) & 255) * k);
  const bl = Math.round((pa & 255) * (1 - k) + (pb & 255) * k);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
};
export { mix };

// ── figures ──────────────────────────────────────────────────────
export type Hat = 'none' | 'turban' | 'scarf' | 'helmet' | 'keffiyeh' | 'tallhat' | 'pointy' | 'cap' | 'hood';
export type Tool = 'none' | 'trowel' | 'stone' | 'spear' | 'sling' | 'scroll' | 'jar' | 'bread' | 'club' | 'lamp' | 'pick' | 'horn' | 'basket';
export interface Figure {
  robe: string;
  trim?: string;
  skin?: string;
  hat: Hat;
  hatColor: string;
  flip: 1 | -1;
  /** walk phase (rad) and how much he walks (0..1) */
  step: number;
  walking: number;
  /** 0..1: an arm raised (a strike, a swing, a wave) */
  arm: number;
  tool: Tool;
  /** a white flash when struck (0..1), a flight (arms up, hat gone) */
  hit?: number;
  flee?: boolean;
  /** size × the base (1 = an ordinary adult) */
  size?: number;
  /** a wider body (Sanballat) */
  wide?: number;
  beard?: string;
  shield?: string;
}

/**
 * A person standing at (x, y) (the feet), `s` px per u.  About 0.62 u tall at size 1, robe to the
 * ankles, a head with headwear, two arms; the tool in the front hand.
 */
export function paintFigure(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, f: Figure): void {
  const k = s * 0.5 * (f.size ?? 1);
  const bob = f.walking > 0 ? Math.abs(Math.sin(f.step)) * 0.06 * k * f.walking : 0;
  const lean = f.flee ? -0.15 : 0;
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(f.flip, 1);
  ctx.rotate(lean);
  const wide = f.wide ?? 1;
  // legs (a step)
  const sw = f.walking > 0 ? Math.sin(f.step) * 0.12 * k * f.walking : 0;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = Math.max(1, k * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.08 * k, -0.3 * k);
  ctx.lineTo(-0.08 * k + sw, 0);
  ctx.moveTo(0.08 * k, -0.3 * k);
  ctx.lineTo(0.08 * k - sw, 0);
  ctx.stroke();
  // the robe: a trapezoid with a hem
  const robe = f.hit && f.hit > 0 ? mix(f.robe, '#ffffff', Math.min(1, f.hit * 2.5)) : f.robe;
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-0.17 * k * wide, -0.98 * k);
  ctx.quadraticCurveTo(-0.3 * k * wide, -0.5 * k, -0.27 * k * wide, -0.16 * k);
  ctx.lineTo(0.27 * k * wide, -0.16 * k);
  ctx.quadraticCurveTo(0.3 * k * wide, -0.5 * k, 0.17 * k * wide, -0.98 * k);
  ctx.closePath();
  ctx.fill();
  if (f.trim) {
    ctx.fillStyle = f.trim;
    ctx.fillRect(-0.27 * k * wide, -0.24 * k, 0.54 * k * wide, 0.08 * k);
    ctx.fillRect(-0.05 * k, -0.98 * k, 0.1 * k, 0.74 * k);
  }
  // the back arm
  const armY = -0.86 * k;
  ctx.strokeStyle = mix(robe, '#000000', 0.18);
  ctx.lineWidth = Math.max(1.2, k * 0.12);
  ctx.beginPath();
  ctx.moveTo(-0.14 * k * wide, armY);
  ctx.lineTo(f.flee ? -0.32 * k : -0.24 * k * wide, f.flee ? -1.35 * k : -0.5 * k);
  ctx.stroke();
  // the head
  const hy = -1.13 * k;
  ctx.fillStyle = f.skin ?? C.skin;
  ctx.beginPath();
  ctx.arc(0.02 * k, hy, 0.15 * k, 0, TAU);
  ctx.fill();
  if (f.beard) {
    ctx.fillStyle = f.beard;
    ctx.beginPath();
    ctx.ellipse(0.06 * k, hy + 0.1 * k, 0.1 * k, 0.09 * k, 0, 0, TAU);
    ctx.fill();
  }
  // an eye
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(0.09 * k, hy - 0.02 * k, Math.max(0.6, 0.025 * k), 0, TAU);
  ctx.fill();
  if (!f.flee) paintHat(ctx, 0.02 * k, hy, k, f.hat, f.hatColor);
  else {
    // the hat flies off: comic
    ctx.save();
    ctx.translate(-0.1 * k, hy - 0.5 * k);
    ctx.rotate(-0.6);
    paintHat(ctx, 0, 0, k, f.hat, f.hatColor);
    ctx.restore();
  }
  // the front arm and the tool
  const ax = f.flee ? 0.3 * k : 0.22 * k * wide, ay = f.flee ? -1.4 * k : -0.5 * k - f.arm * 0.5 * k;
  ctx.strokeStyle = robe;
  ctx.lineWidth = Math.max(1.2, k * 0.12);
  ctx.beginPath();
  ctx.moveTo(0.14 * k * wide, armY);
  ctx.lineTo(ax, ay);
  ctx.stroke();
  ctx.fillStyle = f.skin ?? C.skin;
  ctx.beginPath();
  ctx.arc(ax, ay, 0.055 * k, 0, TAU);
  ctx.fill();
  if (!f.flee) paintTool(ctx, ax, ay, k, f.tool, f.arm);
  if (f.shield) {
    ctx.fillStyle = f.shield;
    ctx.beginPath();
    ctx.ellipse(0.2 * k, -0.6 * k, 0.13 * k, 0.2 * k, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function paintHat(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, hat: Hat, color: string): void {
  ctx.fillStyle = color;
  switch (hat) {
    case 'turban':
      ctx.beginPath();
      ctx.ellipse(x, y - 0.1 * k, 0.18 * k, 0.11 * k, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.12)';
      ctx.fillRect(x - 0.17 * k, y - 0.1 * k, 0.34 * k, 0.03 * k);
      break;
    case 'scarf':
      ctx.beginPath();
      ctx.moveTo(x - 0.17 * k, y + 0.05 * k);
      ctx.quadraticCurveTo(x - 0.2 * k, y - 0.25 * k, x + 0.03 * k, y - 0.2 * k);
      ctx.quadraticCurveTo(x + 0.16 * k, y - 0.16 * k, x + 0.1 * k, y - 0.06 * k);
      ctx.lineTo(x - 0.05 * k, y - 0.05 * k);
      ctx.lineTo(x - 0.22 * k, y + 0.2 * k);
      ctx.closePath();
      ctx.fill();
      break;
    case 'keffiyeh':
      ctx.beginPath();
      ctx.moveTo(x - 0.19 * k, y + 0.16 * k);
      ctx.quadraticCurveTo(x - 0.22 * k, y - 0.24 * k, x + 0.02 * k, y - 0.2 * k);
      ctx.quadraticCurveTo(x + 0.2 * k, y - 0.2 * k, x + 0.16 * k, y - 0.04 * k);
      ctx.lineTo(x - 0.06 * k, y - 0.06 * k);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,10,0,.5)';
      ctx.lineWidth = Math.max(1, 0.035 * k);
      ctx.beginPath();
      ctx.moveTo(x - 0.17 * k, y - 0.1 * k);
      ctx.lineTo(x + 0.16 * k, y - 0.1 * k);
      ctx.stroke();
      break;
    case 'helmet':
      ctx.beginPath();
      ctx.arc(x, y - 0.04 * k, 0.16 * k, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 0.03 * k, y - 0.28 * k, 0.06 * k, 0.1 * k);
      break;
    case 'tallhat':
      ctx.beginPath();
      ctx.moveTo(x - 0.14 * k, y - 0.06 * k);
      ctx.lineTo(x - 0.11 * k, y - 0.42 * k);
      ctx.lineTo(x + 0.13 * k, y - 0.42 * k);
      ctx.lineTo(x + 0.16 * k, y - 0.06 * k);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.fillRect(x - 0.13 * k, y - 0.14 * k, 0.28 * k, 0.04 * k);
      break;
    case 'pointy':
      ctx.beginPath();
      ctx.moveTo(x - 0.16 * k, y - 0.06 * k);
      ctx.lineTo(x + 0.06 * k, y - 0.5 * k);
      ctx.lineTo(x + 0.17 * k, y - 0.06 * k);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cap':
      ctx.beginPath();
      ctx.arc(x, y - 0.07 * k, 0.15 * k, Math.PI, 0);
      ctx.fill();
      break;
    case 'hood':
      ctx.beginPath();
      ctx.arc(x, y - 0.02 * k, 0.19 * k, Math.PI * 0.95, Math.PI * 2.05);
      ctx.lineTo(x + 0.19 * k, y + 0.16 * k);
      ctx.lineTo(x - 0.19 * k, y + 0.16 * k);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      break;
  }
}

function paintTool(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, tool: Tool, arm: number): void {
  ctx.lineCap = 'round';
  switch (tool) {
    case 'trowel':
      ctx.fillStyle = '#c9ccd2';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.2 * k, y - 0.06 * k);
      ctx.lineTo(x + 0.14 * k, y + 0.06 * k);
      ctx.closePath();
      ctx.fill();
      break;
    case 'stone':
      ctx.fillStyle = C.stone;
      roundRect(ctx, x - 0.1 * k, y - 0.2 * k, 0.24 * k, 0.15 * k, 0.03 * k);
      ctx.fill();
      ctx.strokeStyle = C.stoneDark;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'spear':
      ctx.strokeStyle = C.timberDark;
      ctx.lineWidth = Math.max(1, 0.05 * k);
      ctx.beginPath();
      ctx.moveTo(x - 0.05 * k, y + 0.45 * k);
      ctx.lineTo(x + 0.05 * k, y - 0.75 * k);
      ctx.stroke();
      ctx.fillStyle = '#cfd3da';
      ctx.beginPath();
      ctx.moveTo(x + 0.05 * k, y - 0.92 * k);
      ctx.lineTo(x + 0.1 * k, y - 0.72 * k);
      ctx.lineTo(x, y - 0.72 * k);
      ctx.closePath();
      ctx.fill();
      break;
    case 'sling': {
      const a = arm * 6;
      ctx.strokeStyle = '#7a5a36';
      ctx.lineWidth = Math.max(1, 0.03 * k);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 0.3 * k, y + Math.sin(a) * 0.3 * k - 0.1 * k);
      ctx.stroke();
      ctx.fillStyle = '#d8d0c0';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 0.3 * k, y + Math.sin(a) * 0.3 * k - 0.1 * k, 0.04 * k, 0, TAU);
      ctx.fill();
      break;
    }
    case 'scroll':
      ctx.fillStyle = C.paper;
      roundRect(ctx, x - 0.04 * k, y - 0.18 * k, 0.12 * k, 0.26 * k, 0.04 * k);
      ctx.fill();
      ctx.strokeStyle = C.paperEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'jar':
      ctx.fillStyle = '#b86e3e';
      ctx.beginPath();
      ctx.ellipse(x, y - 0.3 * k, 0.11 * k, 0.15 * k, 0, 0, TAU);
      ctx.fill();
      break;
    case 'bread':
      ctx.fillStyle = '#d9a35a';
      ctx.beginPath();
      ctx.ellipse(x + 0.05 * k, y - 0.03 * k, 0.12 * k, 0.07 * k, 0, 0, TAU);
      ctx.fill();
      break;
    case 'basket':
      ctx.fillStyle = '#b8894e';
      roundRect(ctx, x - 0.12 * k, y - 0.08 * k, 0.24 * k, 0.16 * k, 0.04 * k);
      ctx.fill();
      break;
    case 'club':
      ctx.strokeStyle = '#5a3f26';
      ctx.lineWidth = Math.max(1.5, 0.07 * k);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.12 * k, y - 0.32 * k);
      ctx.stroke();
      break;
    case 'pick':
      ctx.strokeStyle = C.timberDark;
      ctx.lineWidth = Math.max(1, 0.05 * k);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.06 * k, y - 0.36 * k);
      ctx.stroke();
      ctx.strokeStyle = '#9aa0a8';
      ctx.lineWidth = Math.max(1.4, 0.06 * k);
      ctx.beginPath();
      ctx.moveTo(x - 0.1 * k, y - 0.32 * k);
      ctx.quadraticCurveTo(x + 0.06 * k, y - 0.44 * k, x + 0.22 * k, y - 0.3 * k);
      ctx.stroke();
      break;
    case 'lamp':
      ctx.fillStyle = '#b8743e';
      ctx.beginPath();
      ctx.ellipse(x + 0.05 * k, y - 0.02 * k, 0.1 * k, 0.05 * k, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.ellipse(x + 0.13 * k, y - 0.09 * k, 0.03 * k, 0.06 * k, 0, 0, TAU);
      ctx.fill();
      break;
    case 'horn':
      paintHornIcon(ctx, x + 0.12 * k, y - 0.08 * k, 0.32 * k, '#e8d4a6');
      break;
    default:
      break;
  }
}

export interface NehPose { flip: 1 | -1; step: number; walking: number; arm: number; build: number; night: boolean; t: number }
/** Nehemiah: the king's cupbearer, now governor — a blue robe with a gold sash, a white turban, the plans in his hand. */
export function paintNehemiah(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: NehPose): void {
  shadow(ctx, x, y, s * 0.24);
  paintFigure(ctx, x, y, s, {
    robe: C.neh, trim: C.nehSash, hat: 'turban', hatColor: '#f5f1e6', flip: p.flip, step: p.step, walking: p.walking,
    arm: p.build > 0 ? 0.6 + 0.4 * Math.sin(p.t * 14) : p.arm, tool: p.night ? 'none' : 'scroll', size: 1.18, beard: '#4a3626',
  });
}

export interface TirzaPose { flip: 1 | -1; step: number; walking: number; arm: number; night: boolean; talk: boolean; t: number }
/** Tirza, Shallum's daughter: ochre and red, a red-gold headscarf, a trowel by day, a lamp by night. */
export function paintTirza(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: TirzaPose): void {
  shadow(ctx, x, y, s * 0.18);
  paintFigure(ctx, x, y, s, {
    robe: C.tirza, trim: '#e8c58a', hat: 'scarf', hatColor: C.tirzaScarf, flip: p.flip, step: p.step, walking: p.walking,
    arm: p.talk ? 0.35 + 0.25 * Math.sin(p.t * 9) : p.arm, tool: p.night ? 'lamp' : 'trowel', size: 0.92,
  });
}

export type Job = 'builder' | 'quarry' | 'baker' | 'water' | 'guard' | 'slinger' | 'newcomer';
/** One of the people at work. */
export function paintWorker(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, job: Job, t: number, seed: number, flip: 1 | -1 = 1, walking = 0): void {
  const ph = t * 4 + seed * 6;
  const robes = ['#b0875a', '#9c7b56', '#c19a6b', '#8e6f4e', '#a98b62'];
  const scarf = ['#e8dcc4', '#d9c49a', '#c9b48a', '#f0e2c0'];
  const base = { flip, step: t * 9 + seed * 3, walking, size: 0.92 } as const;
  switch (job) {
    case 'builder':
      paintFigure(ctx, x, y, s, { ...base, robe: robes[seed % robes.length], hat: 'scarf', hatColor: scarf[seed % scarf.length], arm: 0.5 + 0.5 * Math.sin(ph * 2.2), tool: seed % 3 === 0 ? 'stone' : 'trowel' });
      break;
    case 'quarry':
      paintFigure(ctx, x, y, s, { ...base, robe: robes[(seed + 2) % robes.length], hat: 'cap', hatColor: '#8a6b48', arm: Math.max(0, Math.sin(ph * 1.6)), tool: 'pick' });
      break;
    case 'baker':
      paintFigure(ctx, x, y, s, { ...base, robe: C.baker, trim: '#d9c49a', hat: 'cap', hatColor: '#f6efe0', arm: 0.3 + 0.3 * Math.sin(ph), tool: 'bread' });
      break;
    case 'water':
      paintFigure(ctx, x, y, s, { ...base, robe: C.water, hat: 'scarf', hatColor: '#e8dcc4', arm: 0.9, tool: 'jar' });
      break;
    case 'guard':
      paintFigure(ctx, x, y, s, { ...base, robe: C.guard, trim: '#a8b4c2', hat: 'helmet', hatColor: '#9aa3ad', arm: 0.2, tool: 'spear', shield: '#a5643a' });
      break;
    case 'slinger':
      paintFigure(ctx, x, y, s, { ...base, robe: '#7d6a55', hat: 'scarf', hatColor: '#d9c49a', arm: 0.5 + 0.5 * Math.sin(ph * 3), tool: 'sling' });
      break;
    case 'newcomer':
      paintFigure(ctx, x, y, s, { ...base, robe: robes[(seed + 1) % robes.length], hat: 'hood', hatColor: scarf[(seed + 1) % scarf.length], arm: 0.1, tool: 'basket' });
      break;
  }
}

const BAND: Readonly<Record<Band, string>> = { samaria: C.samaria, arabia: C.arabia, ammon: C.ammon };
export const bandColor = (b: Band): string => BAND[b];

export interface RaiderPose { kind: RaiderKind; band: Band; flip: 1 | -1; step: number; walking: number; act: number; hit: number; flee: boolean; seed: number; loot: boolean; climb: number }
/**
 * A raider (a man: a dark cloak, his band's headscarf).  Ladder men carry a ladder between two, the
 * ram's crew three men and a log, the captain rides a donkey with a feathered hat; struck, they
 * flinch white; running, their arms go up and the scarf flies.
 */
export function paintRaider(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, r: RaiderPose): void {
  const band = BAND[r.band];
  const fig = (dx: number, size = 0.92, tool: Tool = 'club', arm = r.act): void => paintFigure(ctx, x + dx, y - r.climb, s, {
    robe: C.raider, trim: band, hat: 'keffiyeh', hatColor: band, flip: r.flip, step: r.step + dx * 3, walking: r.walking, arm, tool,
    hit: r.hit, flee: r.flee, size,
  });
  shadow(ctx, x, y, s * (r.kind === 'taran' ? 0.6 : r.kind === 'drabina' ? 0.42 : 0.2));
  if (r.kind === 'drabina' && !r.flee) {
    // the ladder between two of them (raised against the wall while climbing)
    ctx.strokeStyle = '#8a6438';
    ctx.lineWidth = Math.max(1.2, s * 0.05);
    const up = r.climb > 0 ? 1 : 0;
    const x0 = x - s * 0.32, x1 = x + s * 0.32, yy = y - s * 0.3 - up * s * 0.4;
    ctx.beginPath();
    ctx.moveTo(x0, yy);
    ctx.lineTo(x1, yy - up * s * 0.3);
    ctx.moveTo(x0, yy + s * 0.09);
    ctx.lineTo(x1, yy + s * 0.09 - up * s * 0.3);
    for (let i = 0; i <= 5; i++) {
      const k = i / 5;
      ctx.moveTo(x0 + (x1 - x0) * k, yy + (-up * s * 0.3) * k);
      ctx.lineTo(x0 + (x1 - x0) * k, yy + s * 0.09 + (-up * s * 0.3) * k);
    }
    ctx.stroke();
    fig(-s * 0.28, 0.88, 'none', 0.6);
    fig(s * 0.28, 0.88, 'none', 0.6);
    return;
  }
  if (r.kind === 'taran' && !r.flee) {
    fig(-s * 0.42, 0.9, 'none', 0.55);
    fig(s * 0.42, 0.9, 'none', 0.55);
    // the log
    const sw = Math.sin(r.act * Math.PI) * s * 0.12 * r.flip;
    ctx.fillStyle = '#7a5130';
    roundRect(ctx, x - s * 0.62 + sw, y - s * 0.42, s * 1.24, s * 0.14, s * 0.06);
    ctx.fill();
    ctx.fillStyle = '#5d3d22';
    ctx.beginPath();
    ctx.ellipse(x + (r.flip > 0 ? s * 0.62 : -s * 0.62) + sw, y - s * 0.35, s * 0.05, s * 0.07, 0, 0, TAU);
    ctx.fill();
    fig(0, 0.9, 'none', 0.55);
    return;
  }
  if (r.kind === 'kapitan') {
    // the donkey
    if (!r.flee || true) {
      const dy = y;
      ctx.fillStyle = '#8c7f74';
      roundRect(ctx, x - s * 0.36, dy - s * 0.42, s * 0.72, s * 0.24, s * 0.1);
      ctx.fill();
      ctx.strokeStyle = '#6e635a';
      ctx.lineWidth = Math.max(1.2, s * 0.06);
      const lg = r.walking > 0 ? Math.sin(r.step) * s * 0.06 : 0;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.26, dy - s * 0.2); ctx.lineTo(x - s * 0.26 + lg, dy);
      ctx.moveTo(x + s * 0.24, dy - s * 0.2); ctx.lineTo(x + s * 0.24 - lg, dy);
      ctx.stroke();
      const hx = x + r.flip * s * 0.42;
      ctx.fillStyle = '#8c7f74';
      ctx.beginPath();
      ctx.ellipse(hx, dy - s * 0.48, s * 0.11, s * 0.08, r.flip * -0.5, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(hx - r.flip * s * 0.02, dy - s * 0.62, s * 0.025, s * 0.09, r.flip * 0.3, 0, TAU);
      ctx.fill();
    }
    paintFigure(ctx, x - r.flip * s * 0.02, y - s * 0.32, s, {
      robe: band, trim: C.gold, hat: r.flee ? 'pointy' : 'tallhat', hatColor: '#3a2f45', flip: r.flip, step: 0, walking: 0,
      arm: r.flee ? 1 : 0.4 + 0.3 * Math.sin(r.step * 0.6), tool: 'club', hit: r.hit, flee: r.flee, size: 1.05, beard: '#3a2a1e',
    });
    return;
  }
  fig(0, 0.92, r.kind === 'procarz' ? 'sling' : r.loot ? 'basket' : 'club', r.kind === 'procarz' ? r.act : r.act * 0.8);
}

/** The villains on the hill: Sanballat (portly, green and gold, a tall hat) and Tobiah (thin, purple, a pointy hat). */
export function paintSanballat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, talk: boolean, sulk: number): void {
  shadow(ctx, x, y, s * 0.3);
  paintFigure(ctx, x, y, s, {
    robe: '#5f7a35', trim: C.gold, hat: 'tallhat', hatColor: '#3e5222', flip: 1, step: 0, walking: 0,
    arm: talk ? 0.5 + 0.4 * Math.sin(t * 7) : 0.15 + sulk * 0.6, tool: 'none', size: 1.12, wide: 1.45, beard: '#2e2318',
  });
}

export function paintTobiah(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, talk: boolean): void {
  shadow(ctx, x, y, s * 0.2);
  paintFigure(ctx, x, y, s, {
    robe: '#6b4a8a', trim: '#c9a8e6', hat: 'pointy', hatColor: '#4a2f63', flip: -1, step: 0, walking: 0,
    arm: talk ? 0.6 + 0.3 * Math.sin(t * 8) : 0.2, tool: 'scroll', size: 1.0, wide: 0.82, beard: '#3a2a1e',
  });
}

/** Tobiah's fox (Neh 4:3): a small orange fox, trotting or sitting. */
export function paintFox(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, flip: 1 | -1, trot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip, 1);
  const k = s * 0.42;
  const b = trot > 0 ? Math.abs(Math.sin(t * 12)) * 0.08 * k : 0;
  shadow(ctx, 0, 0, k * 0.5);
  ctx.fillStyle = '#e07b33';
  // tail
  ctx.beginPath();
  ctx.ellipse(-0.55 * k, -0.35 * k - b, 0.32 * k, 0.12 * k, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff2e0';
  ctx.beginPath();
  ctx.ellipse(-0.8 * k, -0.48 * k - b, 0.09 * k, 0.06 * k, -0.5, 0, TAU);
  ctx.fill();
  // body
  ctx.fillStyle = '#e07b33';
  ctx.beginPath();
  ctx.ellipse(0, -0.32 * k - b, 0.38 * k, 0.17 * k, 0, 0, TAU);
  ctx.fill();
  // legs
  ctx.strokeStyle = '#7a3d18';
  ctx.lineWidth = Math.max(1, 0.06 * k);
  const lg = trot > 0 ? Math.sin(t * 12) * 0.08 * k : 0;
  ctx.beginPath();
  ctx.moveTo(-0.22 * k, -0.2 * k - b); ctx.lineTo(-0.22 * k + lg, 0);
  ctx.moveTo(0.22 * k, -0.2 * k - b); ctx.lineTo(0.22 * k - lg, 0);
  ctx.stroke();
  // head and ears
  ctx.fillStyle = '#e07b33';
  ctx.beginPath();
  ctx.ellipse(0.42 * k, -0.48 * k - b, 0.16 * k, 0.13 * k, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0.34 * k, -0.58 * k - b); ctx.lineTo(0.36 * k, -0.78 * k - b); ctx.lineTo(0.44 * k, -0.6 * k - b);
  ctx.moveTo(0.46 * k, -0.6 * k - b); ctx.lineTo(0.52 * k, -0.78 * k - b); ctx.lineTo(0.56 * k, -0.56 * k - b);
  ctx.fill();
  ctx.fillStyle = '#fff2e0';
  ctx.beginPath();
  ctx.ellipse(0.52 * k, -0.43 * k - b, 0.08 * k, 0.05 * k, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.arc(0.6 * k, -0.45 * k - b, 0.025 * k + 0.5, 0, TAU);
  ctx.arc(0.45 * k, -0.52 * k - b, 0.02 * k + 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ── the wall ─────────────────────────────────────────────────────
/** A wall's physical height (u) for its height in tiers (0..3). */
export const wallHeightU = (h: number): number => (h <= 1 ? 0.4 * h : h <= 2 ? 0.4 + 0.35 * (h - 1) : 0.75 + 0.25 * Math.min(1, h - 2));
/** Upright sizes on screen: a u of height is this share of s. */
export const UP = 0.6;

export interface WallLook {
  /** height in tiers (0..3), integrity (0..1), breached, a tier being laid (its share, or null), night */
  h: number; hp: number; breach: boolean; working: number | null; night: boolean; t: number; seed: number;
  /** finished tiers (the parapet at 3) */
  done: number;
}

/**
 * A section of the wall, seen from the city: its walk (a band from `yOut` to `yIn`, screen y of the
 * outer and inner faces) raised by its height, and its inner face down to `yIn`.  Rubble when low,
 * courses of stone when built (rough reused stone at the first tier, dressed stone above), a
 * scaffold while a tier is laid, cracks when struck, a gap when breached.
 */
export function paintWallSeg(ctx: CanvasRenderingContext2D, x0: number, x1: number, yOut: number, yIn: number, s: number, L: WallLook): void {
  const hpx = wallHeightU(L.h) * UP * s;
  const night = L.night;
  const w = x1 - x0;
  // the rubble along the line (always a little, more when low)
  const pile = Math.max(0, 1 - L.h * 1.3);
  ctx.fillStyle = night ? '#4a4660' : C.rubble;
  for (let i = 0; i < Math.round(w / (s * 0.22)); i++) {
    const rx = x0 + (i + hash(L.seed * 31 + i)) * s * 0.22, sz = s * (0.08 + hash(i * 7 + L.seed) * 0.12) * (0.4 + pile);
    const ry = yIn - hash(i + L.seed * 3) * (yIn - yOut) * 0.8;
    ctx.fillStyle = (i % 3 === 0) ? (night ? '#3c3a52' : C.rubbleDark) : (night ? '#55516c' : C.rubble);
    roundRect(ctx, rx, ry - sz * 0.7, sz * 1.3, sz * 0.7, sz * 0.2);
    ctx.fill();
  }
  if (L.h < 0.04) return;
  const faceTop = yIn - hpx;
  const walkTop = yOut - hpx;
  const stoneA = night ? '#7d7896' : L.done >= 2 ? C.stoneLight : C.stone;
  const stoneB = night ? '#625e7c' : L.done >= 2 ? C.stone : C.stoneDark;
  // the walk (top surface)
  ctx.fillStyle = night ? '#8a85a3' : mix(stoneA, '#ffffff', 0.25);
  ctx.fillRect(x0, walkTop, w, faceTop - walkTop);
  // the inner face: courses
  ctx.fillStyle = stoneB;
  ctx.fillRect(x0, faceTop, w, hpx);
  const ch = Math.max(3, s * 0.13 * UP * 1.6);
  const rows = Math.ceil(hpx / ch);
  for (let r = 0; r < rows; r++) {
    const yy = yIn - (r + 1) * ch;
    const off = (r % 2) * s * 0.17;
    for (let xx = x0 - off; xx < x1; xx += s * 0.34) {
      const sx = Math.max(x0, xx + 1), ex = Math.min(x1, xx + s * 0.34 - 1);
      if (ex <= sx) continue;
      const tone = hash(Math.floor(xx * 3.1) + r * 17 + L.seed);
      ctx.fillStyle = tone < 0.33 ? stoneA : tone < 0.66 ? mix(stoneA, stoneB, 0.4) : mix(stoneA, stoneB, 0.15);
      ctx.fillRect(sx, Math.max(faceTop, yy + 1), ex - sx, Math.min(ch - 1.5, yIn - Math.max(faceTop, yy + 1)));
    }
  }
  // the parapet at the top tier: crenellations along the walk's outer edge
  if (L.done >= 3) {
    ctx.fillStyle = stoneA;
    for (let xx = x0; xx < x1 - s * 0.12; xx += s * 0.3) ctx.fillRect(xx, walkTop - s * 0.13, s * 0.17, s * 0.13);
  }
  // cracks where it was struck
  if (L.hp < 0.92 && !L.breach) {
    ctx.strokeStyle = 'rgba(60,40,20,.55)';
    ctx.lineWidth = 1.2;
    const n = Math.ceil((1 - L.hp) * 5);
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (0.15 + 0.7 * hash(L.seed * 5 + i)), cy = faceTop + hpx * 0.3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + s * 0.06, cy + hpx * 0.3);
      ctx.lineTo(cx - s * 0.04, cy + hpx * 0.6);
      ctx.stroke();
    }
  }
  // a breach: a gap of fallen stones in the middle
  if (L.breach) {
    const gx = x0 + w * 0.5, gw = Math.min(w * 0.45, s * 0.9);
    ctx.fillStyle = night ? '#2b2b47' : C.groundDark;
    ctx.beginPath();
    ctx.moveTo(gx - gw / 2, walkTop - 2);
    ctx.lineTo(gx - gw * 0.3, yIn);
    ctx.lineTo(gx + gw * 0.3, yIn);
    ctx.lineTo(gx + gw / 2, walkTop - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = night ? '#55516c' : C.rubble;
    for (let i = 0; i < 6; i++) {
      const rx = gx - gw * 0.35 + gw * 0.7 * hash(i + L.seed * 9), sz = s * 0.12;
      roundRect(ctx, rx, yIn - sz * (0.6 + hash(i) * 0.5), sz * 1.3, sz * 0.7, 2);
      ctx.fill();
    }
  }
  // the scaffold while a tier is laid: poles, planks, the course growing from the left
  if (L.working !== null) {
    const top = yIn - wallHeightU(Math.min(3, Math.floor(L.h) + 1)) * UP * s - s * 0.18;
    ctx.strokeStyle = night ? '#6d5a48' : C.timber;
    ctx.lineWidth = Math.max(1.2, s * 0.04);
    for (let xx = x0 + s * 0.2; xx < x1; xx += s * 0.8) {
      ctx.beginPath();
      ctx.moveTo(xx, yIn + s * 0.1);
      ctx.lineTo(xx, top);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x0 + s * 0.1, top + s * 0.12);
    ctx.lineTo(x1 - s * 0.1, top + s * 0.12);
    ctx.stroke();
    // the share laid of the next course: a gold-edged line along the top
    ctx.strokeStyle = night ? 'rgba(255,220,150,.5)' : 'rgba(255,215,120,.9)';
    ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(x0, faceTop - 1);
    ctx.lineTo(x0 + w * Math.max(0, Math.min(1, L.working)), faceTop - 1);
    ctx.stroke();
  }
}

export interface GateLook { tier: number; h: number; hp: number; breach: boolean; working: number | null; night: boolean; open: boolean; t: number }
/** The gate: an arch between two short towers; burned beams at first, then doors, bolts and bars, then a gate tower. */
export function paintGate(ctx: CanvasRenderingContext2D, x0: number, x1: number, yOut: number, yIn: number, s: number, g: GateLook): void {
  const cx = (x0 + x1) / 2, w = x1 - x0;
  const hpx = Math.max(wallHeightU(Math.max(g.h, 1)) * UP * s, s * 0.32);
  const night = g.night;
  const stone = night ? '#7d7896' : C.stone, stoneD = night ? '#625e7c' : C.stoneDark;
  const tw = w * 0.26;
  // the two flanks
  for (const fx of [x0, x1 - tw]) {
    const th = hpx + s * 0.18 + (g.tier >= 3 ? s * 0.25 : 0);
    ctx.fillStyle = stoneD;
    ctx.fillRect(fx, yIn - th, tw, th);
    ctx.fillStyle = mix(stone, '#ffffff', 0.2);
    ctx.fillRect(fx, yOut - th, tw, yIn - yOut);
    ctx.fillStyle = stone;
    for (let r = 0; r < th / (s * 0.16); r++) ctx.fillRect(fx + 1 + (r % 2) * 3, yIn - (r + 1) * s * 0.16 + 1, tw - 6, s * 0.16 - 2);
    if (g.tier >= 3) {
      ctx.fillStyle = stone;
      for (let i = 0; i < 3; i++) ctx.fillRect(fx + i * tw / 3 + 1, yOut - th - s * 0.12, tw / 3 - 3, s * 0.12);
    }
  }
  // the opening: an arch
  const ow = w - 2 * tw, oh = Math.max(s * 0.5, hpx * 0.95);
  ctx.fillStyle = night ? '#1b1c30' : '#5a4632';
  ctx.beginPath();
  ctx.moveTo(x0 + tw, yIn);
  ctx.lineTo(x0 + tw, yIn - oh + ow * 0.3);
  ctx.quadraticCurveTo(cx, yIn - oh - ow * 0.15, x1 - tw, yIn - oh + ow * 0.3);
  ctx.lineTo(x1 - tw, yIn);
  ctx.closePath();
  ctx.fill();
  // the lintel and the walk over the arch
  ctx.fillStyle = stone;
  ctx.fillRect(x0 + tw, yIn - oh - s * 0.12, ow, s * 0.12);
  if (g.tier <= 0) {
    // burned beams lying in the opening
    ctx.strokeStyle = '#2d1f16';
    ctx.lineWidth = Math.max(2, s * 0.07);
    ctx.beginPath();
    ctx.moveTo(x0 + tw + ow * 0.1, yIn - s * 0.05);
    ctx.lineTo(x1 - tw - ow * 0.2, yIn - s * 0.3);
    ctx.moveTo(x0 + tw + ow * 0.3, yIn - s * 0.02);
    ctx.lineTo(x1 - tw - ow * 0.05, yIn - s * 0.12);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,50,.35)';
    if (!night) return;
    glow(ctx, cx, yIn - s * 0.1, s * 0.4, 'rgba(255,120,50,', 0.25);
    return;
  }
  if (g.breach) {
    // the doors broken open, hanging
    ctx.fillStyle = '#6e4a28';
    ctx.save();
    ctx.translate(x0 + tw, yIn);
    ctx.rotate(-0.35);
    ctx.fillRect(0, -oh * 0.8, ow * 0.2, oh * 0.8);
    ctx.restore();
    return;
  }
  // the doors (open by day, shut at night)
  const open = g.open ? 0.82 : 0;
  const dw = ow / 2 * (1 - open);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(x0 + tw, yIn - oh * 0.92, dw, oh * 0.92);
  ctx.fillRect(x1 - tw - dw, yIn - oh * 0.92, dw, oh * 0.92);
  ctx.strokeStyle = 'rgba(40,25,10,.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + tw + (dw * i) / 3, yIn - oh * 0.92);
    ctx.lineTo(x0 + tw + (dw * i) / 3, yIn);
    ctx.moveTo(x1 - tw - (dw * i) / 3, yIn - oh * 0.92);
    ctx.lineTo(x1 - tw - (dw * i) / 3, yIn);
    ctx.stroke();
  }
  if (g.tier >= 2) {
    // bolts and bars: iron bands
    ctx.fillStyle = '#4a4f57';
    for (const yy of [0.3, 0.65]) {
      ctx.fillRect(x0 + tw, yIn - oh * yy, dw, Math.max(2, s * 0.04));
      ctx.fillRect(x1 - tw - dw, yIn - oh * yy, dw, Math.max(2, s * 0.04));
    }
    if (!g.open) ctx.fillRect(cx - ow * 0.4, yIn - oh * 0.5, ow * 0.8, Math.max(2, s * 0.05));
  }
  if (g.hp < 0.9) {
    ctx.strokeStyle = 'rgba(40,25,10,.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.1, yIn - oh * 0.7);
    ctx.lineTo(cx + s * 0.05, yIn - oh * 0.4);
    ctx.lineTo(cx - s * 0.06, yIn - oh * 0.15);
    ctx.stroke();
  }
  if (g.working !== null) {
    ctx.strokeStyle = C.timber;
    ctx.lineWidth = Math.max(1.2, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(x0 - s * 0.05, yIn);
    ctx.lineTo(x0 - s * 0.05, yIn - hpx - s * 0.4);
    ctx.moveTo(x1 + s * 0.05, yIn);
    ctx.lineTo(x1 + s * 0.05, yIn - hpx - s * 0.4);
    ctx.stroke();
  }
}

/** A watchtower on the wall: a timber platform (1), stone (2), a crenellated stone tower with a pennant (3). */
export function paintTower(ctx: CanvasRenderingContext2D, x: number, yBase: number, s: number, level: number, kind: '' | 'far' | 'quick', night: boolean, t: number): number {
  const w = s * 0.62, h = s * (0.75 + level * 0.22) * UP * 1.6;
  const top = yBase - h;
  if (level <= 1) {
    ctx.strokeStyle = night ? '#6d5a48' : C.timber;
    ctx.lineWidth = Math.max(1.5, s * 0.06);
    ctx.beginPath();
    ctx.moveTo(x - w / 2, yBase); ctx.lineTo(x - w / 2 + 3, top);
    ctx.moveTo(x + w / 2, yBase); ctx.lineTo(x + w / 2 - 3, top);
    ctx.moveTo(x - w / 2, yBase); ctx.lineTo(x + w / 2 - 3, top + h * 0.4);
    ctx.stroke();
    ctx.fillStyle = night ? '#5c4a3a' : C.timberDark;
    ctx.fillRect(x - w / 2 - 2, top - s * 0.05, w + 4, s * 0.1);
  } else {
    ctx.fillStyle = night ? '#6c6886' : C.stoneDark;
    ctx.fillRect(x - w / 2, top, w, h);
    ctx.fillStyle = night ? '#827d9c' : C.stone;
    for (let r = 0; r < h / (s * 0.15); r++) ctx.fillRect(x - w / 2 + 1 + (r % 2) * 3, yBase - (r + 1) * s * 0.15 + 1, w - 5, s * 0.15 - 2);
    ctx.fillStyle = night ? '#908bab' : C.stoneLight;
    ctx.fillRect(x - w / 2 - 2, top - s * 0.04, w + 4, s * 0.08);
    if (level >= 3) for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * w / 3, top - s * 0.15, w / 3 - 3, s * 0.12);
  }
  // a pennant for the tower's way
  if (kind) {
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2, top);
    ctx.lineTo(x + w / 2 - 2, top - s * 0.45);
    ctx.stroke();
    ctx.fillStyle = kind === 'far' ? '#3f6fb5' : '#c8553d';
    const fl = Math.sin(t * 5) * s * 0.03;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2, top - s * 0.45);
    ctx.lineTo(x + w / 2 + s * 0.25, top - s * 0.38 + fl);
    ctx.lineTo(x + w / 2 - 2, top - s * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  return top;
}

/** A watch fire's brazier on the wall walk: an iron bowl, its flame (size by its light), smoke by day. */
export function paintBrazier(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, flame: number, gold: boolean, dim: number, night: boolean, t: number): void {
  const k = s * (0.22 + 0.04 * level);
  ctx.strokeStyle = '#3d3a40';
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - k * 0.6, y); ctx.lineTo(x - k * 0.3, y - k * 0.8);
  ctx.moveTo(x + k * 0.6, y); ctx.lineTo(x + k * 0.3, y - k * 0.8);
  ctx.stroke();
  ctx.fillStyle = '#4a4650';
  ctx.beginPath();
  ctx.moveTo(x - k * 0.75, y - k * 0.95);
  ctx.quadraticCurveTo(x, y - k * 0.35, x + k * 0.75, y - k * 0.95);
  ctx.closePath();
  ctx.fill();
  const fy = y - k * 0.95;
  if (!night) {
    // embers and a wisp of smoke
    ctx.fillStyle = C.ember;
    ctx.beginPath();
    ctx.ellipse(x, fy, k * 0.45, k * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,110,100,.25)';
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.4 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(x + Math.sin(t + i) * k * 0.4, fy - p * k * 2.5, k * (0.15 + p * 0.25), 0, TAU);
      ctx.fill();
    }
    return;
  }
  const fh = k * (0.7 + flame * 1.6) * (1 - dim * 0.6);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, fy - fh * 0.3, fh * 1.6, gold ? 'rgba(255,205,100,' : 'rgba(255,170,90,', 0.35);
  ctx.restore();
  for (const [col, sc] of [[gold ? C.gold : C.fire, 1], [C.fireCore, 0.55]] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    const wob = Math.sin(t * 11 + sc * 3) * k * 0.08;
    ctx.moveTo(x - k * 0.5 * sc, fy);
    ctx.quadraticCurveTo(x - k * 0.45 * sc + wob, fy - fh * 0.6 * sc, x + wob * 2, fy - fh * sc);
    ctx.quadraticCurveTo(x + k * 0.45 * sc + wob, fy - fh * 0.6 * sc, x + k * 0.5 * sc, fy);
    ctx.closePath();
    ctx.fill();
  }
}

/** A guard post behind the wall: a booth with an awning and a rack of spears. */
export function paintPost(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean): void {
  const w = s * (0.7 + level * 0.12), h = s * 0.42;
  shadow(ctx, x, y, w * 0.6);
  ctx.fillStyle = night ? '#4e4560' : C.mudDark;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = level >= 2 ? (night ? '#4a5a7a' : '#5a7ab0') : (night ? '#6a4a40' : C.clothRed);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 3, y - h);
  ctx.lineTo(x + w / 2 + 3, y - h);
  ctx.lineTo(x + w / 2 - 2, y - h - s * 0.2);
  ctx.lineTo(x - w / 2 + 2, y - h - s * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = night ? '#6d5a48' : C.timberDark;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2 + level; i++) {
    const sx = x + w / 2 + 3 + i * 3;
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx, y - h - s * 0.25);
    ctx.stroke();
  }
}

// ── the city ─────────────────────────────────────────────────────
/** A house: a flat-roofed home of mud brick; a room on the roof at 2; a roof garden with a vine at 3. Level 0: a plot with stakes. */
export function paintHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean, seed: number): void {
  if (level <= 0) { paintPlot(ctx, x, y, s, night); return; }
  const w = s * 1.15, h = s * 0.55;
  shadow(ctx, x, y, w * 0.62);
  const wall = night ? '#5d5470' : C.mud, wallD = night ? '#4a4360' : C.mudDark;
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = night ? '#6d6484' : mix(C.mud, '#ffffff', 0.25);
  ctx.fillRect(x - w / 2 - 2, y - h - s * 0.06, w + 4, s * 0.08);
  ctx.fillStyle = night ? '#2a2638' : '#6e4a2c';
  ctx.fillRect(x - s * 0.12, y - s * 0.34, s * 0.24, s * 0.34);
  ctx.fillStyle = night ? 'rgba(255,200,120,.75)' : '#6e4a2c';
  ctx.fillRect(x + s * 0.24, y - s * 0.38, s * 0.16, s * 0.12);
  if (level >= 2) {
    ctx.fillStyle = wallD;
    ctx.fillRect(x - w / 2 + s * 0.08, y - h - s * 0.4, w * 0.45, s * 0.34);
    ctx.fillStyle = night ? 'rgba(255,200,120,.6)' : '#6e4a2c';
    ctx.fillRect(x - w / 2 + s * 0.2, y - h - s * 0.3, s * 0.12, s * 0.1);
  }
  if (level >= 3) {
    ctx.fillStyle = night ? '#3e5a3a' : '#6f8f45';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(x + s * 0.12 + i * s * 0.1, y - h - s * 0.1 - hash(seed + i) * s * 0.05, s * 0.07, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = night ? '#4a3a2a' : '#8a6a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 2, y - h);
    ctx.lineTo(x + w / 2 - 2, y - h - s * 0.3);
    ctx.lineTo(x + s * 0.05, y - h - s * 0.3);
    ctx.stroke();
  }
}

/** An empty building plot: four stakes and a cord, a few stones waiting. */
function paintPlot(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, night: boolean): void {
  if (night) return;
  const w = s * 0.5, d = s * 0.16;
  ctx.strokeStyle = 'rgba(150,110,60,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w, y - d); ctx.lineTo(x + w, y - d); ctx.lineTo(x + w, y + d); ctx.lineTo(x - w, y + d); ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = C.timberDark;
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) ctx.fillRect(x + dx * w - 1, y + dy * d - s * 0.12, 2, s * 0.13);
  ctx.fillStyle = C.rubble;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(x - w * 0.4 + i * w * 0.35, y + d * 0.2, s * 0.06, s * 0.035, 0, 0, TAU);
    ctx.fill();
  }
}

/** The bakery (the Tower of the Ovens): clay ovens with smoke and loaves; more ovens as it grows. */
export function paintBakery(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean, t: number, bread: number): void {
  if (level <= 0) { paintPlot(ctx, x, y, s, night); return; }
  shadow(ctx, x, y, s * 0.8);
  for (let i = 0; i < level; i++) {
    const ox = x - s * 0.35 + i * s * 0.36, oy = y - i * s * 0.05;
    ctx.fillStyle = night ? '#6a4a40' : '#c47a4a';
    ctx.beginPath();
    ctx.ellipse(ox, oy - s * 0.2, s * 0.24, s * 0.26, 0, Math.PI, 0);
    ctx.lineTo(ox + s * 0.24, oy);
    ctx.lineTo(ox - s * 0.24, oy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = night ? '#ff9a50' : '#3a2418';
    ctx.beginPath();
    ctx.ellipse(ox, oy - s * 0.08, s * 0.08, s * 0.07, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,150,140,.25)';
    const p = (t * 0.35 + i * 0.3) % 1;
    ctx.beginPath();
    ctx.arc(ox + Math.sin(t + i) * s * 0.06, oy - s * 0.45 - p * s * 0.6, s * (0.07 + p * 0.12), 0, TAU);
    ctx.fill();
  }
  // loaves on a board: the store
  ctx.fillStyle = night ? '#5a4a3a' : C.timber;
  ctx.fillRect(x - s * 0.5, y + s * 0.05, s, s * 0.06);
  ctx.fillStyle = '#d9a35a';
  const n = Math.min(8, Math.ceil(bread / 6));
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.ellipse(x - s * 0.42 + i * s * 0.12, y + s * 0.03, s * 0.06, s * 0.035, 0, 0, TAU);
    ctx.fill();
  }
}

/** The granary: round silos with conical tops and sacks. */
export function paintGranary(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean): void {
  if (level <= 0) { paintPlot(ctx, x, y, s, night); return; }
  shadow(ctx, x, y, s * 0.7);
  for (let i = 0; i < level; i++) {
    const ox = x - s * 0.3 + i * s * 0.32, oy = y - (i % 2) * s * 0.04;
    ctx.fillStyle = night ? '#5d5470' : C.mud;
    ctx.fillRect(ox - s * 0.15, oy - s * 0.5, s * 0.3, s * 0.5);
    ctx.fillStyle = night ? '#6a4a40' : C.roof;
    ctx.beginPath();
    ctx.moveTo(ox - s * 0.19, oy - s * 0.5);
    ctx.lineTo(ox, oy - s * 0.78);
    ctx.lineTo(ox + s * 0.19, oy - s * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = night ? '#6a5c4a' : '#d9c08a';
  for (let i = 0; i < 2 + level; i++) {
    ctx.beginPath();
    ctx.ellipse(x - s * 0.4 + i * s * 0.18, y + s * 0.02, s * 0.08, s * 0.06, 0, 0, TAU);
    ctx.fill();
  }
}

/** The well: a stone ring with a beam and a bucket; a pool with steps when it grows. */
export function paintWell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean, t: number): void {
  if (level <= 0) { paintPlot(ctx, x, y, s, night); return; }
  shadow(ctx, x, y, s * 0.5);
  const r = s * (0.28 + level * 0.06);
  ctx.fillStyle = night ? '#6c6886' : C.stoneDark;
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.12, r, r * 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = night ? '#24304a' : '#5f8fae';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.14, r * 0.72, r * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.2 + Math.sin(t) * 2, y - s * 0.16, r * 0.18, r * 0.05, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = night ? '#5c4a3a' : C.timberDark;
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y - s * 0.12);
  ctx.lineTo(x - r * 0.8, y - s * 0.7);
  ctx.lineTo(x + r * 0.8, y - s * 0.7);
  ctx.lineTo(x + r * 0.8, y - s * 0.12);
  ctx.moveTo(x, y - s * 0.7);
  ctx.lineTo(x, y - s * 0.4 - Math.sin(t * 1.3) * s * 0.06);
  ctx.stroke();
  ctx.fillStyle = '#8a6438';
  ctx.fillRect(x - s * 0.06, y - s * 0.42 - Math.sin(t * 1.3) * s * 0.06, s * 0.12, s * 0.1);
}

/** The stone yard: piles of stone by the stock, a lifting frame. */
export function paintYard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean, stone: number, cap: number): void {
  shadow(ctx, x, y, s * 0.8);
  const n = Math.max(1, Math.round((stone / Math.max(1, cap)) * 14));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / 5), col = i % 5;
    const bx = x - s * 0.55 + col * s * 0.22 + row * s * 0.1, by = y - row * s * 0.12;
    ctx.fillStyle = (i + row) % 3 === 0 ? (night ? '#6c6886' : C.stoneDark) : (night ? '#827d9c' : C.stone);
    roundRect(ctx, bx, by - s * 0.12, s * 0.2, s * 0.12, 2);
    ctx.fill();
  }
  ctx.strokeStyle = night ? '#6d5a48' : C.timber;
  ctx.lineWidth = Math.max(1.2, s * 0.045);
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y);
  ctx.lineTo(x + s * 0.5, y - s * (0.7 + level * 0.12));
  ctx.lineTo(x + s * 0.1, y - s * (0.6 + level * 0.12));
  ctx.stroke();
}

/** The governor's house: a wide house with columns, a blue awning and a long table (Neh 5:17). */
export function paintGovernor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, level: number, night: boolean): void {
  const w = s * (1.6 + level * 0.15), h = s * (0.6 + level * 0.1);
  shadow(ctx, x, y, w * 0.6);
  ctx.fillStyle = night ? '#5d5470' : C.stoneLight;
  ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = night ? '#6d6484' : '#fffaf0';
  ctx.fillRect(x - w / 2 - 3, y - h - s * 0.08, w + 6, s * 0.1);
  ctx.fillStyle = night ? '#47587a' : C.cloth;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.42, y - h * 0.55);
  ctx.lineTo(x + w * 0.42, y - h * 0.55);
  ctx.lineTo(x + w * 0.46, y - h * 0.38);
  ctx.lineTo(x - w * 0.46, y - h * 0.38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = night ? '#827d9c' : C.stone;
  for (let i = 0; i < 4; i++) ctx.fillRect(x - w * 0.4 + i * w * 0.26, y - h * 0.38, s * 0.07, h * 0.38);
  if (level >= 2) {
    ctx.fillStyle = night ? '#6d6484' : C.stone;
    ctx.fillRect(x - w * 0.25, y - h - s * 0.4, w * 0.5, s * 0.34);
  }
  ctx.fillStyle = night ? '#5a4a3a' : C.timber;
  ctx.fillRect(x - w * 0.35, y + s * 0.06, w * 0.7, s * 0.07);
}

/** The camp of the newcomers: tents. */
export function paintTents(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, n: number, night: boolean): void {
  for (let i = 0; i < n; i++) {
    const tx = x + (i % 3) * s * 0.6 - s * 0.6, ty = y + Math.floor(i / 3) * s * 0.35 - s * 0.2;
    shadow(ctx, tx, ty, s * 0.3);
    ctx.fillStyle = night ? '#5a5070' : ['#d9c49a', '#c9a67a', '#e3d2b0'][i % 3];
    ctx.beginPath();
    ctx.moveTo(tx - s * 0.3, ty);
    ctx.lineTo(tx, ty - s * 0.38);
    ctx.lineTo(tx + s * 0.3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = night ? '#2a2638' : '#7a5a3a';
    ctx.beginPath();
    ctx.moveTo(tx - s * 0.06, ty);
    ctx.lineTo(tx, ty - s * 0.2);
    ctx.lineTo(tx + s * 0.06, ty);
    ctx.closePath();
    ctx.fill();
  }
}

/** An olive tree (scenery). */
export function paintOlive(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, night: boolean, seed: number): void {
  shadow(ctx, x, y, s * 0.3, 0.15);
  ctx.strokeStyle = night ? '#3a3040' : '#6a5038';
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + s * 0.06, y - s * 0.2, x - s * 0.02, y - s * 0.38);
  ctx.stroke();
  ctx.fillStyle = night ? '#2c3a34' : C.olive;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + (hash(seed + i) - 0.5) * s * 0.4, y - s * 0.42 - hash(seed * 3 + i) * s * 0.2, s * 0.16, 0, TAU);
    ctx.fill();
  }
}

// ── icons ────────────────────────────────────────────────────────
export function paintStoneIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.stone;
  roundRect(ctx, x - r, y - r * 0.6, r * 2, r * 1.2, r * 0.25);
  ctx.fill();
  ctx.strokeStyle = C.stoneDeep;
  ctx.lineWidth = Math.max(1, r * 0.15);
  ctx.stroke();
}

export function paintTimberIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.timber;
  roundRect(ctx, x - r, y - r * 0.35, r * 2, r * 0.7, r * 0.2);
  ctx.fill();
  ctx.fillStyle = '#d9b07a';
  ctx.beginPath();
  ctx.ellipse(x + r * 0.85, y, r * 0.2, r * 0.33, 0, 0, TAU);
  ctx.fill();
}

export function paintBreadIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#d9a35a';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.62, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#a5743a';
  ctx.lineWidth = Math.max(1, r * 0.14);
  for (const dx of [-0.35, 0, 0.35]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * r - r * 0.12, y - r * 0.3);
    ctx.lineTo(x + dx * r + r * 0.12, y + r * 0.1);
    ctx.stroke();
  }
}

export function paintPeopleIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#f3e2c2'): void {
  ctx.fillStyle = color;
  for (const dx of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y - r * 0.35, r * 0.3, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + dx * r, y + r * 0.45, r * 0.42, r * 0.4, 0, Math.PI, 0);
    ctx.fill();
  }
}

export function paintHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.8);
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.3, y - r * 0.1, x, y + r * 0.8);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = '#e8604a';
  ctx.fillRect(x - r * 1.4, y + r * 0.8 - r * 1.9 * Math.max(0, Math.min(1, fill)), r * 2.8, r * 2);
  ctx.restore();
}

/** A ram's horn (the shofar): a curved, tapering horn. */
export function paintHornIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#e8d4a6'): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.9, y + r * 0.25);
  ctx.quadraticCurveTo(x - r * 0.2, y + r * 0.55, x + r * 0.55, y - r * 0.05);
  ctx.quadraticCurveTo(x + r * 0.85, y - r * 0.35, x + r * 0.8, y - r * 0.75);
  ctx.lineTo(x + r * 1.0, y - r * 0.8);
  ctx.quadraticCurveTo(x + r * 1.15, y - r * 0.2, x + r * 0.6, y + r * 0.25);
  ctx.quadraticCurveTo(x - r * 0.1, y + r * 0.85, x - r * 0.95, y + r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,30,.55)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  for (let i = 1; i < 4; i++) {
    const k = i / 4;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.9 + k * r * 1.6, y + r * 0.4 - k * r * 0.5);
    ctx.lineTo(x - r * 0.85 + k * r * 1.6, y + r * 0.2 - k * r * 0.5);
    ctx.stroke();
  }
}

export function paintChevron(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r, y - r * 0.6);
  ctx.lineTo(x, y + r * 0.5);
  ctx.lineTo(x + r, y - r * 0.6);
  ctx.lineTo(x + r * 0.55, y - r * 0.6);
  ctx.lineTo(x, y - r * 0.05);
  ctx.lineTo(x - r * 0.55, y - r * 0.6);
  ctx.closePath();
  ctx.fill();
}

/** A gate in the wall, for the lobby's map: built (doors and stars), being built (scaffold), or waiting (rubble). */
export function paintGateTile(ctx: CanvasRenderingContext2D, w: number, h: number, i: number, state: 'done' | 'now' | 'later', stars: number): void {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, state === 'later' ? '#3a3550' : '#f2cf8e');
  g.addColorStop(1, state === 'later' ? '#26233a' : '#d9a865');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 6);
  ctx.fill();
  const base = h - 7;
  if (state === 'later') {
    ctx.fillStyle = '#6a6070';
    for (let k = 0; k < 7; k++) {
      const x = 6 + hash(i * 9 + k) * (w - 12), s = 3 + hash(k + i) * 4;
      ctx.fillRect(x, base - s * 0.8, s, s * 0.8);
    }
    return;
  }
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(0, base - 12, w, 12);
  ctx.fillStyle = C.stone;
  ctx.fillRect(0, base - 12, w, 3);
  const gx = w / 2;
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(gx - 14, base - 22, 9, 22);
  ctx.fillRect(gx + 5, base - 22, 9, 22);
  ctx.fillStyle = C.stone;
  ctx.fillRect(gx - 14, base - 22, 9, 3);
  ctx.fillRect(gx + 5, base - 22, 9, 3);
  ctx.fillStyle = state === 'done' ? '#7a4c25' : '#3b2a1c';
  ctx.beginPath();
  ctx.moveTo(gx - 5, base);
  ctx.lineTo(gx - 5, base - 10);
  ctx.arc(gx, base - 10, 5, Math.PI, 0);
  ctx.lineTo(gx + 5, base);
  ctx.closePath();
  ctx.fill();
  if (state === 'now') {
    ctx.strokeStyle = C.timber;
    ctx.lineWidth = 1.2;
    for (const x of [gx - 18, gx + 18]) {
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - 24);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(gx - 18, base - 16);
    ctx.lineTo(gx + 18, base - 16);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#7a4c12';
    ctx.font = font(8, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)), gx, 2);
  }
}
