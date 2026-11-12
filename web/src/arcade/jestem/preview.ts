/**
 * Ja jestem…'s picture for the lobby's hero and the game card (DESIGN §13.8): the arched window in a dusky
 * chapel wall, its mosaic sketch filling with colour cell by cell from the heart, the lead turning gold,
 * then the whole window glowing with its aura — and again.  In the lobby the window is the player's next
 * vision once its sketch is prepared (prep.ts; the panel starts it), so the lobby shows the very picture the
 * game will build; on the cards it is the runner at sunrise.  The layers are baked once per picture and
 * size; a frame only composes them.
 */
import { mulberry32 } from '../../core/random';
import { pixelsToCanvas } from '../kit/images';
import { clamp } from '../kit/juice';
import { makeMosaic, sketch } from '../kit/mosaic';
import { heroWindow, type Rect } from './layout';
import { nextVision, type JestemProgress, type VisionKey } from './meta';
import { GOLD, LEAD, PAPER, TAU, blit, glowSprite, raySprite, windowPath } from './paint';
import { paintPicture } from './pictures';
import { analysed } from './prep';
import { RULES } from './rules';
import { SCENES } from './scenes';
import { buildVision, type VisionGeo } from './vision';

interface Hero {
  key: string;
  win: Rect;
  pic: HTMLCanvasElement;
  paper: HTMLCanvasElement;
  /** the cells lit so far in this turn of the loop, baked as they come (the frame draws it once) */
  glass: HTMLCanvasElement;
  shown: number;
  /** the cells' paths in the layers' own pixels */
  local: Path2D[];
  geo: VisionGeo;
  paths: Path2D[];
  order: number[];
}

let hero: Hero | null = null;
/** the cards' own picture, analysed once */
let cardSketch: { geo: VisionGeo; sketch: HTMLCanvasElement } | null = null;

const CYCLE = 16;

function layer(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** The cards' picture (the runner at sunrise), its mosaic and sketch: made once, small. */
function cardVision(): { geo: VisionGeo; sketch: HTMLCanvasElement } {
  if (cardSketch) return cardSketch;
  const W = 300, H = 350;
  const c = layer(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  paintPicture('zdrowy', ctx, W, H);
  const d = ctx.getImageData(0, 0, W, H);
  const sk = pixelsToCanvas(sketch({ width: W, height: H, data: d.data }, { strength: 1.45 }));
  const m = makeMosaic(RULES.PW, RULES.PH, 30, mulberry32(11), { relax: 2 });
  const s = SCENES.zdrowy;
  const geo = buildVision(m, { heart: { x: s.heart[0] * RULES.PW, y: s.heart[1] * RULES.PH }, regions: s.regions });
  cardSketch = { geo, sketch: sk };
  return cardSketch;
}

function build(key: string, w: number, h: number, decl: Parameters<typeof paintPicture>[0] | null, src: { geo: VisionGeo; sketch: HTMLCanvasElement; picture?: HTMLCanvasElement }): Hero {
  const win = heroWindow(w, h);
  const k = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const pic = layer(win.w * k, win.h * k);
  const pc = pic.getContext('2d')!;
  if (decl) paintPicture(decl, pc, pic.width, pic.height);
  else if (src.picture) pc.drawImage(src.picture, 0, 0, pic.width, pic.height);
  const paper = layer(win.w * k, win.h * k);
  paper.getContext('2d')!.drawImage(src.sketch, 0, 0, paper.width, paper.height);
  const s = win.w / RULES.PW;
  const paths = src.geo.cells.map(c => {
    const p = new Path2D();
    c.poly.forEach((q, i) => (i ? p.lineTo(win.x + q.x * s, win.y + q.y * s) : p.moveTo(win.x + q.x * s, win.y + q.y * s)));
    p.closePath();
    return p;
  });
  const order = src.geo.cells.map(c => c.id).sort((a, b) => src.geo.cells[a].heartD - src.geo.cells[b].heartD);
  const ls = pic.width / RULES.PW;
  const local = src.geo.cells.map(c => {
    const p = new Path2D();
    c.poly.forEach((q, i) => (i ? p.lineTo(q.x * ls, q.y * ls) : p.moveTo(q.x * ls, q.y * ls)));
    p.closePath();
    return p;
  });
  return { key: `${key}|${w}x${h}`, win, pic, paper, glass: layer(pic.width, pic.height), shown: 0, local, geo: src.geo, paths, order };
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: JestemProgress): void {
  // which picture: the player's next vision when its sketch is ready, else the cards' picture
  let key: VisionKey | 'card' = 'card';
  let a = null as ReturnType<typeof analysed>;
  if (p) {
    const k = nextVision(p);
    a = analysed(k);
    if (a) key = k;
  }
  if (!hero || hero.key !== `${key}|${w}x${h}`) {
    if (a) {
      const m = makeMosaic(RULES.PW, RULES.PH, 34, mulberry32(5), { relax: 2 });
      const geo = buildVision(m, { heart: a.heart, regions: a.decl ? SCENES[a.decl].regions : undefined });
      hero = build(key, w, h, a.decl, { geo, sketch: a.sketch, picture: a.photo && a.crop ? cropped(a.photo, a.crop) : a.picture });
    } else hero = build('card', w, h, 'zdrowy', cardVision());
  }
  const H = hero, W = H.win;
  // the chapel wall in the dusk
  const g = ctx.createRadialGradient(W.x + W.w / 2, W.y + W.h / 2, W.h * 0.2, W.x + W.w / 2, W.y + W.h / 2, Math.max(w, h));
  g.addColorStop(0, '#3e2c56');
  g.addColorStop(0.5, '#241a32');
  g.addColorStop(1, '#100c16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cyc = (t % CYCLE) / CYCLE;
  const fill = clamp((cyc - 0.06) / 0.62);
  const glow = clamp((cyc - 0.66) / 0.12) * (1 - clamp((cyc - 0.93) / 0.07));
  const n = Math.floor(fill * H.order.length);
  // the aura
  blit(ctx, glowSprite('255,214,160'), W.x + W.w / 2, W.y + W.h / 2, W.w * 2.4, W.h * 1.7, 0.18 + 0.25 * fill + 0.35 * glow);
  if (glow > 0) {
    ctx.save();
    ctx.translate(W.x + W.w / 2, W.y + W.h * 0.42);
    ctx.rotate(t * 0.03);
    blit(ctx, raySprite('255,226,150', 14), 0, 0, W.h * 2.2, W.h * 2.2, 0.55 * glow);
    ctx.restore();
  }
  ctx.fillStyle = '#2b2226';
  ctx.fill(windowPath(W, 6));
  ctx.save();
  ctx.clip(windowPath(W));
  ctx.fillStyle = PAPER;
  ctx.fillRect(W.x, W.y, W.w, W.h);
  ctx.drawImage(H.paper, W.x, W.y, W.w, W.h);
  // the cells lit so far (baked as they come; a new turn of the loop starts the glass again), and the one filling now
  const gc = H.glass.getContext('2d');
  if (gc) {
    if (n < H.shown) {
      gc.clearRect(0, 0, H.glass.width, H.glass.height);
      H.shown = 0;
    }
    for (; H.shown < n; H.shown++) {
      gc.save();
      gc.clip(H.local[H.order[H.shown]]);
      gc.drawImage(H.pic, 0, 0);
      gc.restore();
    }
    ctx.drawImage(H.glass, W.x, W.y, W.w, W.h);
  }
  if (n < H.order.length && fill > 0) {
    const id = H.order[n], c = H.geo.cells[id], s = W.w / RULES.PW;
    const part = fill * H.order.length - n;
    ctx.save();
    ctx.clip(H.paths[id]);
    ctx.beginPath();
    ctx.arc(W.x + c.cx * s, W.y + c.cy * s, Math.sqrt(part) * 60 * s * 1.2, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(H.pic, W.x, W.y, W.w, W.h);
    ctx.restore();
  }
  if (glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 * glow;
    ctx.drawImage(H.pic, W.x, W.y, W.w, W.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // the leading: gold where the light has come, fading at the glow
  const s = W.w / RULES.PW;
  const lit = new Set(H.order.slice(0, n));
  ctx.lineCap = 'round';
  ctx.globalAlpha = 1 - 0.85 * glow;
  const gold = new Path2D(), lead = new Path2D();
  for (const e of H.geo.edges) {
    const p = lit.has(e.a) && (e.b < 0 || lit.has(e.b)) ? gold : lead;
    p.moveTo(W.x + e.p.x * s, W.y + e.p.y * s);
    p.lineTo(W.x + e.q.x * s, W.y + e.q.y * s);
  }
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 2;
  ctx.stroke(lead);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.4;
  ctx.stroke(gold);
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.strokeStyle = 'rgba(246,212,136,0.45)';
  ctx.lineWidth = 1;
  ctx.stroke(windowPath(W, 6));
}

/** An own photo cut to the window (the analysis's crop), for the hero's picture. */
function cropped(photo: HTMLCanvasElement, crop: { sx: number; sy: number; sw: number; sh: number }): HTMLCanvasElement {
  const c = layer(RULES.PW, RULES.PH);
  c.getContext('2d')!.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, RULES.PW, RULES.PH);
  return c;
}
