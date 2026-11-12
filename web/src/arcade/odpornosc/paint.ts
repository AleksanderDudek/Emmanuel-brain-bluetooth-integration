/**
 * Odporność's drawing kit (all in code, no images): a palette like a stained microscope slide — rose and
 * coral tissue, pearl-white cells with lilac lobed nuclei (as Giemsa stains them), lime and gold bacteria,
 * gold antibodies — light from baked glow sprites (no shadowBlur, no ctx.filter), and the small characters:
 * Neo the neutrophil and Makro the veteran macrophage, with eyes.
 *
 * Every function draws at a given place and size in CSS px; the view decides where.
 */
import { MIN_TEXT } from '../kit/mobile';
import { REF_FONT, VERSE_FONT } from '../kit/scripture';
import { PATHOGEN, type PathogenId } from './content';

export const TAU = Math.PI * 2;
export const SANS = REF_FONT;
export const SERIF = VERSE_FONT;

export const PAL = {
  air: ['#fff6f1', '#fbe4dc'] as const,
  corneum: '#fcefe6',
  epi: '#f2d3c3',
  epiLine: '#deb3a0',
  tissue: ['#f2b4b0', '#de7f8c', '#bf5371', '#8f3456'] as const,
  fibre: 'rgba(255,232,228,0.13)',
  vesselWall: '#c4566f',
  lumen: ['#9c2f4b', '#b53c58'] as const,
  rbc: '#e2555f',
  rbcLight: '#f38a8f',
  neut: '#f7f2ff',
  neutEdge: '#c3b0ee',
  neutGranule: '#dccbff',
  lobe: '#8a63d2',
  lobeDark: '#6a45b5',
  eye: '#2b1f45',
  mac: '#ffd8a6',
  macEdge: '#dd9c5c',
  macM2: '#d3efb0',
  macM2Edge: '#8fbf62',
  macNuc: '#b0703a',
  dc: '#cdeefc',
  dcEdge: '#7cc3e0',
  tcell: '#c5e4ff',
  tcellEdge: '#6f9fd6',
  tcellNuc: '#3c6db0',
  nk: '#ead3ff',
  nkEdge: '#a27ad6',
  nkGranule: '#9a54d0',
  mast: '#ffe3ef',
  mastGranule: '#c94f80',
  gold: '#ffd166',
  goldDeep: '#e9a93c',
  c3: '#ffb35c',
  net: '#cdeeff',
  ring: '#ffd27a',
  growth: '#a8f0c6',
  ifn: '#dcc0ff',
  mastRing: '#ffb3d1',
  inflam: '255,110,110',
  ink: '#3a1d2e',
  cream: '#fff8ef',
  wood: '#b27a46',
  woodDark: '#86562d',
  woodLight: '#dcaa70',
  collagen: '#fff2e6',
  capillary: '#e46a7c',
  mucus: ['#fff7ea', '#fde8d6'] as const,
  epiNose: '#ffe1e7',
  epiNoseEdge: '#e6a9b9',
  cilia: '#f3b6c6',
  epiNuc: '#c27694',
  infected: '#e7cbff',
  flag: '#9b5de5',
};

// ── text ─────────────────────────────────────────────────────────────────────────────
/** A canvas font, never under the arcade's floor (MIN_TEXT). */
export function font(px: number, weight = 700, serif = false): string {
  const size = Math.max(MIN_TEXT, Math.round(px * 2) / 2);
  return serif ? `italic ${weight} ${size}px ${SERIF}` : `${weight} ${size}px ${SANS}`;
}

/** The px a font() call actually uses. */
export const fontPx = (px: number): number => Math.max(MIN_TEXT, Math.round(px * 2) / 2);

/** Shrink a text's size to fit `maxW` (never under `min`, never under MIN_TEXT); returns the size set. */
export function fitFont(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, min = MIN_TEXT, weight = 700, serif = false): number {
  const floor = Math.max(MIN_TEXT, min);
  let size = fontPx(Math.max(floor, px));
  ctx.font = font(size, weight, serif);
  while (size > floor && ctx.measureText(text).width > maxW) {
    size = Math.max(floor, size - 0.5);
    ctx.font = font(size, weight, serif);
  }
  return size;
}

/** Greedy wrap with the current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

// ── shapes ───────────────────────────────────────────────────────────────────────────
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, TAU);
}

/** A stable pseudo-random 0..1 for an integer. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── light: baked glow sprites ────────────────────────────────────────────────────────
const glows = new Map<string, HTMLCanvasElement | null>();

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** A soft round light of a colour ("r,g,b"), baked once (64 px) and drawn scaled. */
export function glowSprite(rgb: string): HTMLCanvasElement | null {
  if (glows.has(rgb)) return glows.get(rgb)!;
  const c = canvas(64, 64);
  const g = c?.getContext('2d') ?? null;
  if (c && g) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.35, `rgba(${rgb},0.45)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  glows.set(rgb, c && g ? c : null);
  return c && g ? c : null;
}

/** Additive light at (x, y) of radius r. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a: number): void {
  if (a <= 0.003 || r <= 0.5) return;
  const s = glowSprite(rgb);
  if (!s) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(s, x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = prev;
}

/** "#rrggbb" → "r,g,b" */
export function rgbOf(hex: string): string {
  const v = parseInt(hex.slice(1), 16);
  return `${(v >> 16) & 255},${(v >> 8) & 255},${v & 255}`;
}

/** Mix two "#rrggbb" colours. */
export function mix(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const c = (s: number) => Math.round(((x >> s) & 255) + (((y >> s) & 255) - ((x >> s) & 255)) * Math.max(0, Math.min(1, k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

// ── the cells ────────────────────────────────────────────────────────────────────────
/**
 * A living membrane: a soft blob of radius r that ripples and stretches toward where it goes (a pseudopod).
 * `stretch` 0..1 (speed), `dir` the heading; `ruffle` adds a macrophage's lamellipodia.
 */
export function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, dir = 0, stretch = 0, ruffle = 0): void {
  const n = 14;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const toward = Math.cos(a - dir);
    let k = 1 + 0.05 * Math.sin(3 * a + t * 2.1 + seed * 10) + 0.035 * Math.sin(5 * a - t * 2.7 + seed * 4);
    k += stretch * 0.32 * Math.max(0, toward) ** 2 - stretch * 0.08 * Math.max(0, -toward);
    if (ruffle) k += ruffle * 0.07 * Math.sin(9 * a + t * 3 + seed * 6);
    const px = x + Math.cos(a) * r * k, py = y + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export interface Look {
  t: number; seed: number;
  /** heading and speed 0..1 */
  dir: number; speed: number;
  /** pale and sleepy (spent), lit gold (the burst), no nucleus (cast a NET) */
  spent?: number; burst?: number; anucleate?: boolean;
  /** eating: 0..1 of a gulp (the cheeks puff), the phagosomes inside */
  gulp?: number;
  gut?: { color: string; k: number }[];
  /** eyes or not (small sizes skip them) */
  eyes?: boolean;
  /** dozing in a rest: half-closed eyes */
  doze?: number;
}

function eyes(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, lid = 0): void {
  const ex = Math.cos(look.dir) * r * 0.22, ey = Math.sin(look.dir) * r * 0.16;
  const sep = r * 0.3, er = Math.max(1.1, r * 0.15);
  const blink = (look.t * 0.7 + look.seed * 13) % 4.2 < 0.12 ? 0.15 : 1;
  for (const s of [-1, 1]) {
    const cx = x + ex + s * sep, cy = y - r * 0.12 + ey;
    ctx.fillStyle = PAL.eye;
    ctx.beginPath();
    ctx.ellipse(cx, cy, er, er * blink * (1 - lid * 0.55), 0, 0, TAU);
    ctx.fill();
    if (blink > 0.5 && er > 1.6) {
      ctx.fillStyle = '#ffffff';
      circle(ctx, cx - er * 0.35, cy - er * 0.35, er * 0.38);
      ctx.fill();
    }
  }
}

/** A neutrophil: pearl body, a lilac nucleus of three lobes, granules, eyes; phagosomes fizz inside. */
export function paintNeutrophil(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look): void {
  const spent = look.spent ?? 0;
  const body = spent > 0 ? mix(PAL.neut, '#d9d2e6', spent) : PAL.neut;
  const edge = spent > 0 ? mix(PAL.neutEdge, '#b9b0c8', spent) : PAL.neutEdge;
  const puff = 1 + (look.gulp ?? 0) * 0.12;
  blob(ctx, x, y, r * puff, look.t, look.seed, look.dir, look.speed);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.strokeStyle = edge;
  ctx.stroke();
  // a soft highlight on the upper left
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.34, r * 0.2, -0.6, 0, TAU);
  ctx.fill();
  // granules
  if (r >= 7) {
    ctx.fillStyle = PAL.neutGranule;
    for (let i = 0; i < 6; i++) {
      const a = look.seed * 20 + i * 1.7 + look.t * 0.3;
      circle(ctx, x + Math.cos(a) * r * 0.58, y + Math.sin(a * 1.3) * r * 0.5, Math.max(0.7, r * 0.06));
      ctx.fill();
    }
  }
  // the lobed nucleus (behind the eyes, toward the back of the cell)
  if (!look.anucleate) {
    const back = look.dir + Math.PI;
    const nx = x + Math.cos(back) * r * 0.2, ny = y + r * 0.22;
    ctx.fillStyle = spent > 0 ? mix(PAL.lobe, '#9d93ad', spent) : PAL.lobe;
    for (let i = -1; i <= 1; i++) {
      const a = back + i * 0.95 + Math.sin(look.t * 0.8 + look.seed * 5 + i) * 0.08;
      circle(ctx, nx + Math.cos(a) * r * 0.28, ny + Math.sin(a) * r * 0.16, r * (i === 0 ? 0.24 : 0.2));
      ctx.fill();
    }
    ctx.strokeStyle = PAL.lobeDark;
    ctx.lineWidth = Math.max(0.8, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(nx + Math.cos(back - 0.95) * r * 0.28, ny + Math.sin(back - 0.95) * r * 0.16);
    ctx.quadraticCurveTo(nx, ny + r * 0.05, nx + Math.cos(back + 0.95) * r * 0.28, ny + Math.sin(back + 0.95) * r * 0.16);
    ctx.stroke();
  }
  // phagosomes: what it swallowed, fizzing and shrinking
  if (look.gut) {
    look.gut.forEach((g, i) => {
      const a = look.seed * 7 + i * 2.1;
      const px = x + Math.cos(a) * r * 0.36, py = y + Math.sin(a) * r * 0.3 - r * 0.05;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      circle(ctx, px, py, r * 0.27);
      ctx.fill();
      ctx.fillStyle = g.color;
      ctx.globalAlpha = Math.max(0, 1 - g.k);
      circle(ctx, px, py, r * 0.19 * (1 - g.k * 0.7));
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  if (look.burst && look.burst > 0) {
    ctx.strokeStyle = `rgba(150,220,255,${0.5 * look.burst})`;
    ctx.lineWidth = Math.max(1, r * 0.14);
    blob(ctx, x, y, r * 1.12, look.t * 2, look.seed);
    ctx.stroke();
  }
  if (look.eyes !== false && r >= 6) eyes(ctx, x, y, r, look, Math.max(spent, look.doze ?? 0));
}

/** Makro, the veteran tissue macrophage: a big ruffled amber blob, a bean nucleus, vacuoles, wise eyes and brows; green in repair mode. */
export function paintMacrophage(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look & { m2: number; brows?: boolean }): void {
  const body = mix(PAL.mac, PAL.macM2, look.m2), edge = mix(PAL.macEdge, PAL.macM2Edge, look.m2);
  const puff = 1 + (look.gulp ?? 0) * 0.08;
  blob(ctx, x, y, r * puff, look.t * 0.7, look.seed, look.dir, look.speed * 0.6, 1);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.08);
  ctx.strokeStyle = edge;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.36, r * 0.18, -0.5, 0, TAU);
  ctx.fill();
  // vacuoles
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 4; i++) {
    const a = look.seed * 9 + i * 1.6;
    circle(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.45, r * 0.09);
    ctx.fill();
  }
  // a bean-shaped nucleus low in the cell
  ctx.fillStyle = mix(PAL.macNuc, '#6f9a4a', look.m2);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.1, y + r * 0.38, r * 0.34, r * 0.2, 0.2, 0, TAU);
  ctx.fill();
  if (look.gut) {
    look.gut.forEach((g, i) => {
      const a = look.seed * 3 + i * 1.5 + 0.6;
      const px = x + Math.cos(a) * r * 0.42, py = y + Math.sin(a) * r * 0.25;
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      circle(ctx, px, py, r * 0.2);
      ctx.fill();
      ctx.fillStyle = g.color;
      ctx.globalAlpha = Math.max(0, 1 - g.k);
      circle(ctx, px, py, r * 0.13 * (1 - g.k * 0.6));
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  if (look.eyes !== false && r >= 6) {
    eyes(ctx, x, y - r * 0.05, r * 0.8, look, 0.35);
    if (look.brows !== false) {
      // the veteran's bushy brows
      ctx.strokeStyle = mix('#8a5a30', '#4f7a34', look.m2);
      ctx.lineWidth = Math.max(1.2, r * 0.09);
      ctx.lineCap = 'round';
      const ex = Math.cos(look.dir) * r * 0.18;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x + ex + s * r * 0.12, y - r * 0.36);
        ctx.lineTo(x + ex + s * r * 0.42, y - r * 0.3 - s * 0);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }
  }
}

/** A dendritic cell: a pale star with long thin dendrites. */
export function paintDendritic(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look): void {
  ctx.strokeStyle = PAL.dcEdge;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const a = look.seed * 5 + i * (TAU / 7) + Math.sin(look.t * 1.3 + i) * 0.15;
    const len = r * (1.6 + 0.5 * Math.sin(look.t * 0.9 + i * 2));
    ctx.lineWidth = Math.max(1, r * 0.22);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a + 0.3) * len * 0.6, y + Math.sin(a + 0.3) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  blob(ctx, x, y, r, look.t, look.seed);
  ctx.fillStyle = PAL.dc;
  ctx.fill();
  ctx.strokeStyle = PAL.dcEdge;
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  if (r >= 6) eyes(ctx, x, y, r, look);
}

/** A lymphocyte: a round cell almost filled by its round nucleus (a T cell sky-blue, an NK cell lilac with granules). */
export function paintLymphocyte(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, look: Look, nk: boolean): void {
  blob(ctx, x, y, r, look.t, look.seed, look.dir, look.speed * 0.6);
  ctx.fillStyle = nk ? PAL.nk : PAL.tcell;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.11);
  ctx.strokeStyle = nk ? PAL.nkEdge : PAL.tcellEdge;
  ctx.stroke();
  ctx.fillStyle = nk ? '#b58ae0' : PAL.tcellNuc;
  ctx.globalAlpha = 0.85;
  circle(ctx, x + Math.cos(look.dir + Math.PI) * r * 0.12, y + r * 0.12, r * 0.62);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (nk && r >= 6) {
    ctx.fillStyle = PAL.nkGranule;
    for (let i = 0; i < 5; i++) {
      const a = look.seed * 11 + i * 1.3;
      circle(ctx, x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.66, r * 0.09);
      ctx.fill();
    }
  }
  if (!nk && r >= 6) {
    // T cell receptors: little dots around the membrane
    ctx.fillStyle = '#e8f4ff';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + look.t * 0.3;
      circle(ctx, x + Math.cos(a) * r * 1.02, y + Math.sin(a) * r * 1.02, Math.max(0.8, r * 0.08));
      ctx.fill();
    }
  }
  if (look.eyes !== false && r >= 6) eyes(ctx, x, y - r * 0.05, r, look);
}

/** A mast cell: a round cell packed with dark granules (its alarm is histamine and TNF). */
export function paintMast(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, seed: number, pulse: number): void {
  blob(ctx, x, y, r * (1 + pulse * 0.08), t, seed);
  ctx.fillStyle = PAL.mast;
  ctx.fill();
  ctx.strokeStyle = '#e6a6c0';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  ctx.fillStyle = PAL.mastGranule;
  for (let i = 0; i < 14; i++) {
    const a = seed * 17 + i * 2.39996, d = Math.sqrt((i + 0.5) / 14) * r * 0.72;
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.6, r * 0.09));
    ctx.fill();
  }
}

/** A spent neutrophil's apoptotic body: neat, pale bubbles (tidy, never gory). */
export function paintBody(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, fade: number): void {
  ctx.globalAlpha = Math.max(0, 1 - fade);
  for (let i = 0; i < 5; i++) {
    const a = seed * 9 + i * 1.26, d = r * (i ? 0.55 : 0);
    ctx.fillStyle = i % 2 ? '#e9e1f6' : '#ddd2ef';
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (i ? 0.36 : 0.42));
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,140,200,0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── pathogens ────────────────────────────────────────────────────────────────────────
export interface BugLook { a: number; t: number; seed: number; tag: number; c3: boolean; capsule: boolean; netted: boolean; split: number; pop: number; fade: number }

/** A bacterium (a coccus, a rod or a swimmer with flagella); gold when tagged, a halo in a capsule. */
export function paintBug(ctx: CanvasRenderingContext2D, kind: PathogenId, x: number, y: number, r: number, look: BugLook): void {
  const spec = PATHOGEN[kind];
  const s = r * look.pop;
  ctx.globalAlpha = Math.max(0, 1 - look.fade);
  if (look.capsule && look.tag < 1) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    circle(ctx, x, y, s * (spec.shape === 'coccus' ? 1.75 : 2.3));
    ctx.fill();
    ctx.stroke();
  }
  if (spec.shape === 'coccus') {
    // dividing: two spheres pulling apart
    const off = look.split * s * 0.55;
    for (const k of look.split > 0 ? [-1, 1] : [0]) {
      circle(ctx, x + Math.cos(look.a) * off * k, y + Math.sin(look.a) * off * k, s * (look.split > 0 ? 0.86 : 1));
      ctx.fillStyle = spec.body;
      ctx.fill();
      ctx.lineWidth = Math.max(1, s * 0.22);
      ctx.strokeStyle = spec.edge;
      ctx.stroke();
      ctx.fillStyle = spec.light;
      circle(ctx, x + Math.cos(look.a) * off * k - s * 0.3, y + Math.sin(look.a) * off * k - s * 0.3, s * 0.3);
      ctx.fill();
    }
  } else {
    const len = s * (1.25 + look.split * 0.4), wd = s * 0.55;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(look.a);
    if (spec.shape === 'swimmer') {
      ctx.strokeStyle = spec.edge;
      ctx.lineWidth = Math.max(0.8, s * 0.12);
      for (let f = -1; f <= 1; f++) {
        ctx.beginPath();
        ctx.moveTo(-len, f * wd * 0.4);
        for (let i = 1; i <= 6; i++) ctx.lineTo(-len - i * s * 0.35, f * wd * 0.4 + Math.sin(look.t * 14 + i * 1.3 + f) * s * 0.22);
        ctx.stroke();
      }
    }
    rr(ctx, -len, -wd, len * 2, wd * 2, wd);
    ctx.fillStyle = spec.body;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.strokeStyle = spec.edge;
    ctx.stroke();
    if (look.split > 0.2) {
      ctx.strokeStyle = spec.edge;
      ctx.beginPath();
      ctx.moveTo(0, -wd);
      ctx.lineTo(0, wd);
      ctx.stroke();
    }
    ctx.fillStyle = spec.light;
    rr(ctx, -len * 0.7, -wd * 0.65, len * 0.9, wd * 0.5, wd * 0.25);
    ctx.fill();
    ctx.restore();
  }
  if (look.tag >= 1) {
    // tagged: a gold rim and little Ys (antibodies) or orange dots (C3b)
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = Math.max(1.2, s * 0.22);
    circle(ctx, x, y, s * (spec.shape === 'coccus' ? 1.32 : 1.9));
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = look.seed * 6 + i * 2.1 + look.t * 0.6, d = s * (spec.shape === 'coccus' ? 1.45 : 2);
      if (look.c3) {
        ctx.fillStyle = PAL.c3;
        circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(1, s * 0.22));
        ctx.fill();
      } else paintY(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(2, s * 0.5), a + Math.PI / 2);
    }
  }
  ctx.globalAlpha = 1;
}

/** An antibody: a little gold Y. */
export function paintY(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = Math.max(1, s * 0.32);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.8);
  ctx.lineTo(0, 0);
  ctx.lineTo(-s * 0.6, -s * 0.7);
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 0.6, -s * 0.7);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.restore();
}

/** A virion: a tiny icosahedron (a hexagon outline) with knobs. */
export function paintVirion(ctx: CanvasRenderingContext2D, kind: PathogenId, x: number, y: number, r: number, rot: number): void {
  const spec = PATHOGEN[kind];
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) {
    const a = rot + (i / 6) * TAU;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.fillStyle = spec.body;
  ctx.fill();
  ctx.strokeStyle = spec.edge;
  ctx.lineWidth = Math.max(0.8, r * 0.25);
  ctx.stroke();
  ctx.fillStyle = spec.light;
  for (let i = 0; i < 6; i++) {
    const a = rot + (i / 6) * TAU;
    circle(ctx, x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, Math.max(0.6, r * 0.22));
    ctx.fill();
  }
}

/** A NET: a web of DNA strands with glinting granule proteins. */
export function paintNet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number, t: number, seed: number): void {
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.strokeStyle = PAL.net;
  ctx.lineWidth = 1.2;
  const n = 10;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = seed * 3 + (i / n) * TAU;
    ctx.moveTo(x, y);
    const mx = x + Math.cos(a + 0.2) * r * 0.5, my = y + Math.sin(a + 0.2) * r * 0.5;
    ctx.quadraticCurveTo(mx, my, x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.stroke();
  for (let ring = 1; ring <= 3; ring++) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = seed * 3 + (i / n) * TAU;
      const rr2 = r * (ring / 3.3) * (1 + 0.12 * Math.sin(i * 2.3 + ring + seed * 7));
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); else ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const a = seed * 3 + (i / n) * TAU, d = r * (0.3 + 0.6 * hash(i + seed * 50));
    const tw = 0.5 + 0.5 * Math.sin(t * 4 + i * 1.7);
    circle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, 1 + tw);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** The splinter: a wooden shard from the air into the skin. */
export function paintSplinter(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.translate(x0, y0);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, -w * 0.5);
  ctx.lineTo(len * 0.85, -w * 0.32);
  ctx.lineTo(len, 0);
  ctx.lineTo(len * 0.8, w * 0.36);
  ctx.lineTo(0, w * 0.5);
  ctx.closePath();
  ctx.fillStyle = PAL.wood;
  ctx.fill();
  ctx.strokeStyle = PAL.woodDark;
  ctx.lineWidth = Math.max(1, w * 0.1);
  ctx.stroke();
  ctx.strokeStyle = PAL.woodLight;
  ctx.lineWidth = Math.max(0.8, w * 0.07);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(len * 0.05, -w * 0.3 + i * w * 0.28);
    ctx.lineTo(len * 0.75, -w * 0.18 + i * w * 0.16);
    ctx.stroke();
  }
  ctx.restore();
}

/** A speech bubble's portrait: Neo (a neutrophil) or Makro (the macrophage), a face in a circle. */
export function paintPortrait(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, who: 'neo' | 'makro', t: number): void {
  ctx.fillStyle = who === 'neo' ? '#3b2a5c' : '#5c3a1e';
  circle(ctx, x, y, r * 1.08);
  ctx.fill();
  const look: Look = { t, seed: who === 'neo' ? 0.31 : 0.77, dir: Math.PI / 2, speed: 0, eyes: true };
  if (who === 'neo') paintNeutrophil(ctx, x, y + r * 0.05, r * 0.86, look);
  else paintMacrophage(ctx, x, y + r * 0.05, r * 0.86, { ...look, m2: 0 });
}
