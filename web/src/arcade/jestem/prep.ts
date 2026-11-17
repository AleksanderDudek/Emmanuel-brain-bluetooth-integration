/**
 * Preparing a vision before play (DESIGN §13.8; the founder insists the picture is processed before the
 * game begins).  Two stages:
 *
 *   the analysis  the picture at its window's size: a declaration painted at 600 × 700 (the arched window),
 *                 an own photo loaded from the device at its own shape (its aspect within 9:16…16:9, over
 *                 about the same area: round 11 — "the mosaic takes the photo's shape"), its pixels, its edge
 *                 map, its pencil sketch, and its heart — the expensive part (≈ 60–120 ms), done in small
 *                 steps: in the lobby as
 *                 soon as the vision is chosen (one step per tick), and in the calibration's intro at the
 *                 latest (one step per frame); cached by vision
 *   the cut       the mosaic for the session's number of cells (structure-aware: smaller tiles where the
 *                 picture has detail and around its heart), each tile's colour, the fragments — cheap
 *                 (a few ms), done when the session knows its length
 *
 * Only the browser runs this (canvases); the session's rules (sim.ts) take the cut's geometry.
 */
import { mulberry32 } from '../../core/random';
import { getImage, loadPixels, pixelsToCanvas } from '../kit/images';
import { cellColors, detailWeight, edgeMap, fitCover, makeMosaic, sketch, type Pixels, type Pt } from '../kit/mosaic';
import { clamp } from '../kit/juice';
import { cleanCont, legacyCont } from './content';
import { keyDecl, keyOwn, type VisionKey } from './meta';
import { paintPicture } from './pictures';
import { RULES } from './rules';
import { SCENES, type DeclId } from './scenes';
import { buildVision, photoSpace, type Shape, type VisionGeo } from './vision';

export interface Analysis {
  key: VisionKey;
  decl: DeclId | null;
  ownId: string | null;
  /** an own picture's continuation after "ja" (plain text from the device; '' when none: the default is said) */
  word: string;
  /** the window's shape and its picture space (a declaration: the arch, PW × PH; a photo: its own rectangle) */
  shape: Shape;
  w: number;
  h: number;
  /** the picture at the window's size, its pixels, its edges, its sketch, and its heart */
  picture: HTMLCanvasElement;
  px: Pixels;
  edges: Float32Array;
  sketch: HTMLCanvasElement;
  heart: Pt;
  /** an own photo at its best size for the screen, and the window's crop of it (a declaration repaints instead) */
  photo: HTMLCanvasElement | null;
  crop: { sx: number; sy: number; sw: number; sh: number } | null;
}

export interface Prepared extends Analysis {
  n: number;
  geo: VisionGeo;
  /** each cell's mean colour (0..255) and luminance */
  colors: { r: number; g: number; b: number; lum: number }[];
}

type Step = () => void | Promise<void>;

/** A preparation in steps: `pump()` runs synchronous steps, an asynchronous one (an own photo's loading) is awaited in the background. */
export class PrepJob {
  done = false;
  failed: string | null = null;
  result: Analysis | null = null;
  private i = 0;
  private waiting = false;
  private readonly steps: Step[];

  constructor(readonly key: VisionKey, steps: (job: PrepJob) => Step[]) {
    this.steps = steps(this);
  }

  /** 0..1 */
  get progress(): number { return this.done ? 1 : this.i / Math.max(1, this.steps.length); }

  /** Run steps until `ms` have passed (at least one step), or the job waits on the device, or it is done. */
  pump(ms = 8): void {
    const t0 = now();
    while (!this.done && !this.waiting && !this.failed) {
      const step = this.steps[this.i];
      try {
        const r = step();
        if (r instanceof Promise) {
          this.waiting = true;
          r.then(() => { this.waiting = false; this.advance(); }, (e: unknown) => { this.waiting = false; this.fail(e); });
          return;
        }
      } catch (e) {
        this.fail(e);
        return;
      }
      this.advance();
      if (now() - t0 >= ms) return;
    }
  }

  /** Run to the end now (synchronous steps only; false if it must still wait or failed). */
  finish(): boolean {
    for (let guard = 0; guard < 50 && !this.done && !this.waiting && !this.failed; guard++) this.pump(1e9);
    return this.done;
  }

  private advance(): void {
    this.i++;
    if (this.i >= this.steps.length) {
      this.done = true;
      if (this.result) remember(this.result);
    }
  }

  private fail(e: unknown): void {
    this.failed = e instanceof Error ? e.message : String(e);
  }
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ── the cache ────────────────────────────────────────────────────
const analyses = new Map<VisionKey, Analysis>();
const jobs = new Map<VisionKey, PrepJob>();

function remember(a: Analysis): void {
  analyses.delete(a.key);
  analyses.set(a.key, a);
  while (analyses.size > 3) analyses.delete(analyses.keys().next().value!);
  jobs.delete(a.key);
}

/** The finished analysis of a vision, if any. */
export const analysed = (key: VisionKey): Analysis | null => analyses.get(key) ?? null;

/** An own picture's continuation changed: the analysis keeps its picture and takes the new words. */
export function setWord(key: VisionKey, word: string): void {
  const a = analyses.get(key);
  if (a) a.word = word;
}

/** Forget an own picture's analysis (it was deleted). */
export function forget(key: VisionKey): void {
  analyses.delete(key);
  jobs.delete(key);
}

/**
 * The job preparing a vision (started on the first call; a finished one is served from the cache).  `legacy`: an
 * own picture's label is still an old single word (a save before round 11), read as "jestem {word}".
 */
export function prepare(key: VisionKey, legacy = false): PrepJob {
  const have = analyses.get(key);
  if (have) {
    const j = new PrepJob(key, () => []);
    j.result = have;
    j.done = true;
    return j;
  }
  let job = jobs.get(key);
  if (!job || job.failed) {
    job = new PrepJob(key, j => stepsFor(key, j, legacy));
    jobs.set(key, job);
  }
  return job;
}

/** In the lobby: prepare a vision in the background, a step per tick, so the page stays smooth. */
export function prepareSoon(key: VisionKey, onDone?: (ok: boolean) => void, legacy = false): PrepJob {
  const job = prepare(key, legacy);
  const tick = () => {
    if (job.done || job.failed) { onDone?.(job.done); return; }
    job.pump(12);
    setTimeout(tick, 16);
  };
  setTimeout(tick, 0);
  return job;
}

// ── the steps ────────────────────────────────────────────────────
const PW = RULES.PW, PH = RULES.PH;

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function stepsFor(key: VisionKey, job: PrepJob, legacy: boolean): Step[] {
  const decl = keyDecl(key), own = keyOwn(key);
  let W: number = PW, H: number = PH;
  const shape: Shape = decl ? 'arch' : 'rect';
  let picture: HTMLCanvasElement | null = null;
  let photo: HTMLCanvasElement | null = null;
  let crop: Analysis['crop'] = null;
  let px: Pixels | null = null;
  let edges: Float32Array | null = null;
  let sk: HTMLCanvasElement | null = null;
  let word = '';
  const out: Step[] = [];
  if (decl) {
    out.push(() => {
      picture = canvas(W, H);
      const ctx = picture.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      paintPicture(decl, ctx, W, H);
    });
  } else if (own) {
    out.push(async () => {
      const rec = await getImage(own);
      if (!rec) throw new Error('picture not found');
      word = legacy ? legacyCont(rec.label) : cleanCont(rec.label);
      const loaded = await loadPixels(rec.blob, 1280);
      photo = loaded.canvas;
      // the photo's own shape (its aspect held within 9:16…16:9), its crop, and the photo at that size for the analysis
      ({ w: W, h: H } = photoSpace(photo.width / photo.height));
      crop = fitCover(photo.width, photo.height, W, H);
      picture = canvas(W, H);
      const ctx = picture.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('no 2d context');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photo, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, W, H);
    });
  } else {
    out.push(() => { throw new Error('unknown vision'); });
  }
  out.push(() => {
    const ctx = picture!.getContext('2d', { willReadFrequently: true })!;
    const d = ctx.getImageData(0, 0, W, H);
    px = { width: d.width, height: d.height, data: d.data };
  });
  out.push(() => { edges = edgeMap(px!); });
  out.push(() => { sk = pixelsToCanvas(sketch(px!, { strength: 1.45, paper: [247, 239, 222], ink: [62, 50, 46] })); });
  out.push(() => {
    const heart = decl ? { x: SCENES[decl].heart[0] * W, y: SCENES[decl].heart[1] * H } : heartOf(edges!, W, H);
    job.result = { key, decl, ownId: own, word, shape, w: W, h: H, picture: picture!, px: px!, edges: edges!, sketch: sk!, heart, photo, crop };
  });
  return out;
}

/** An own photo's heart: the centre of its detail, pulled toward the middle (where a photo's subject usually is). */
export function heartOf(edges: Float32Array, w: number, h: number): Pt {
  let sx = 0, sy = 0, s = 0;
  const step = 4;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const dx = x / w - 0.5, dy = y / h - 0.52;
      const k = edges[y * w + x] * Math.exp(-(dx * dx + dy * dy) / (2 * 0.18 * 0.18));
      sx += x * k; sy += y * k; s += k;
    }
  }
  if (s <= 1e-9) return { x: w / 2, y: h * 0.52 };
  // halfway between the detail's centre and the middle: a busy corner never drags the start to the edge
  return { x: (sx / s + w / 2) / 2, y: (sy / s + h * 0.52) / 2 };
}

/** A seed from a vision's key and a number (the same vision cuts a little differently session by session). */
export function seedOf(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * The cut: the analysed picture cut into about `n` cells — denser where the picture has detail and around
 * its heart — with each cell's colour and the fragments (the picture's named parts, or colour clusters).
 */
export function cut(a: Analysis, n: number, seed: number): Prepared {
  const W = a.w, H = a.h;
  const detail = detailWeight(a.edges, a.px.width, a.px.height, W, H);
  const sig2 = 2 * (0.24 * Math.sqrt(W * H * (PW / PH))) ** 2;
  const weight = (x: number, y: number) => clamp(0.55 * detail(x, y) + 0.45 * Math.exp(-((x - a.heart.x) ** 2 + (y - a.heart.y) ** 2) / sig2));
  // the arch takes a few cells: ask for a few more so about `n` lie inside the window (a photo keeps them all)
  const m = makeMosaic(W, H, Math.round(a.shape === 'arch' ? n / 0.95 : n), mulberry32(seed), { weight, relax: RULES.relax });
  const all = cellColors(m, a.px);
  const geo = buildVision(m, { shape: a.shape, heart: a.heart, regions: a.decl ? SCENES[a.decl].regions : undefined, colors: all });
  return { ...a, n, geo, colors: geo.cells.map(c => all[c.m]) };
}
