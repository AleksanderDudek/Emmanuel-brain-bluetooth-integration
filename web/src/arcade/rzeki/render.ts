/**
 * Rzeki żywej wody's play view (DESIGN.md §13.14): deep space with an open heaven and its rays coming down
 * through the gate, the two shells of light around the figure (picture 2's ovals, each with its jewel and its name
 * on its line, so they read as the stations they are), the egg of light, the pool of living water at the feet and
 * the two rivers that flow from it as the drops gather, the figure of light (it breathes with the player's pattern
 * in rest, still on a hold), the column of light along its midline with the gold and silver threads
 * spiralling along the lit part, and the stations: rose windows of church glass on the midline and above the
 * head, the three channels with their sun and moon, the Void's ring of sea-green glass, the sacrum with its spiral
 * of light, the hands and the feet turning to stained glass — each waiting, lit, or opening now with its halo of
 * light and the threshold drawn on it as a faint ring.  When a station is full and its rest is over the light flows
 * on as a stream of living water — down the midline, out along the arms, down the legs.  Beside the figure, the map
 * column (strip.ts): every station of the map, the one the light is at, the count.
 *
 * A camera (layout.ts `Cam`) eases between framings: the body, the sky above it, the whole egg of the heavens, the
 * hands near, the ground.  The world is drawn in the body framing's coordinates under one transform; every text
 * (the "+15"s, the prayer band, the caption, the story cards) is drawn in screen space, so no zoom shrinks it.
 * Per frame it composes cached layers (paint.ts) and draws a few dozen small shapes: no shadowBlur, no filters.
 */
import { clamp, ease, Floaters, Particles } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { HAND_COLOURS, HAND_ORDER, MAP, STATION, STATIONS, stationLabel, stationName, tierName, type StationId } from './content';
import {
  CHANNELS, CHEST, MEDALLION_R, MOON, SACRUM_PTS, SHELL, SPIRAL, SUN, VOID, along, enterPaths, finger, footShapes, handPoint, handShapes,
  palmCentre, shapePath, shellPt, soleAt, spiralPts, stationPts, streamPaths, type P, type Shell,
} from './figure';
import { drawCaption, drawPrayer, drawStory, dropFloat } from './hud';
import { t } from './i18n';
import { MIN_READ } from '../kit/mobile';
import { drawStrip, drawStripName, stripHit, type StripGeom, type StripState } from './strip';
import {
  CAM_MAX, NO_CAM, cameraFor, easeCam, figPt, framingOf, idleR, labelRowH, layout, litR, maxWindowR, stationXY, tapTargets, toScreen, toWorld, windowR,
  wordsAt, type Cam, type Layout, type Rect,
} from './layout';
import {
  GOLD, GOLD_HI, MOON_SILVER, PEARL, SANS, SILVER, SUN_GOLD, WATER, auraSprite, bakeFigure, bakeRays, bakeRose, bakeRoses, bakeSky, bloom, columnSprite, font, glow,
  glowSprite, hash, label, medallionSprite, mix, poolSprite, rgbaPrefix, starSprite, type FigureLayer, type Layer, type RoseLayers,
} from './paint';
import { RING, fullPath, partPath, petalAngle } from './rose';
import { RULES } from './rules';
import { LIT_UP, type RzekiSim, type SimEvent } from './sim';
import { BONE_BANDS, CHANNEL_PANES, KEYSTONE, MEDALLIONS, RING_SEGS, SHELL_SEGS, pieceK, roseOpen } from './tiles';

const TAU = Math.PI * 2;

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

interface Mote { x: number; y: number; vy: number; r: number; a: number; ph: number }
/** A drop of living water falling down the column into the pool; `label` floats up beside the pool when it lands. */
interface Drop { y: number; vy: number; x: number; hue: string; from: number; big?: boolean; label?: string; labelColor?: string }
interface Ripple { t: number; k: number }

/** A shell's name as placed beside its jewel (screen px). */
interface ShellName { text: string; x: number; y: number; hue: string; align: CanvasTextAlign; lines: string[]; px: number; a: number; box: [number, number] }

/** How a station shows now: waiting, lit (this round), or the one the light is at. */
type Look = 'idle' | 'lit' | 'current';

export class RzekiView {
  L: Layout;
  /** the camera now, and where it is going */
  cam: Cam = NO_CAM;
  private camAt: StationId | null = null;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private sky: Layer | null = null;
  private rays: Layer | null = null;
  private raysBox = { x: 0, y: 0, w: 1, h: 1 };
  private fig: FigureLayer | null = null;
  private roses: Partial<Record<StationId, RoseLayers>> = {};
  /** the craft tier each window is baked at, and the radius they are baked at */
  private roseTier: Record<StationId, number> = Object.fromEntries(STATIONS.map(s => [s, 0])) as Record<StationId, number>;
  private roseR = 1;
  private roseZoom: (s: StationId) => number = () => 1;
  private riverPts: [number, number][][] = [];
  private readonly parts = new Particles(160);
  /** the "+15"s and the words that rise: in screen space */
  private readonly floats = new Floaters();
  private motes: Mote[] = [];
  private drops: Drop[] = [];
  private ripples: Ripple[] = [];
  private dropT = 0;
  private incenseT = 0;
  private floatSide = 1;
  /** splashes in the pool since the last read (the sound's plinks) */
  splashes = 0;
  private openKey = '';
  private openFull: Path2D | null = null;
  /** juice: the window's pop when it fills, the whole figure's glow, the heaven's brightness */
  private pop = 0;
  private flash = 0;
  private heavenK = 0;
  private time = 0;
  private lastDt = 1 / 60;
  private captionK = 0;
  private lastCaption = '';
  /** the story card as last drawn (for taps and the audit) */
  storyRect: Rect | null = null;
  /**
   * A desktop's mouse (DESIGN §14): where it is, how long since it moved, and how much the station a click would
   * stay with shows it (a ring of light around that station, fading once the mouse rests).
   */
  private mouse: { x: number; y: number } | null = null;
  private mouseIdle = 99;
  private hoverK = 0;
  /** a desk layout's words: the height they stand at, eased after the station (or the stream) */
  private wordsY = Number.NaN;
  /** the map column as last drawn (the mouse's names, the coach mark) */
  private strip: StripGeom | null = null;
  /** the shells' names as this frame places them (drawn in screen space over the world), and the placements measured */
  private shellNames: ShellName[] = [];
  private readonly nameMemo = new Map<string, ShellName[]>();

  constructor(canvas: HTMLCanvasElement, private readonly o: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, { top: 134, right: 0, bottom: 0, left: 0 }, o.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.o.touch);
    this.wordsY = Number.NaN;
    this.nameMemo.clear();
    const L = this.L, H = L.fig.H;
    this.sky = bakeSky(w, h, dpr, { cx: L.fig.cx, midY: L.fig.top + H * 0.45, H });
    // the rays come down from the gate of heaven above the head to the crown
    const rw = Math.min(w * 1.2, H * 1.3), y0 = L.fig.top - 0.62 * H, y1 = L.fig.top + 0.04 * H;
    this.raysBox = { x: L.fig.cx - rw / 2, y: y0, w: rw, h: y1 - y0 };
    this.rays = bakeRays(rw, y1 - y0, dpr, rw / 2);
    // the figure and the windows baked as large as the camera will show them (the hands near, the ground)
    const zooms = (['hands', 'ground', 'sky', 'heavens'] as const).map(f => cameraFor(L, f).s);
    const figZoom = clamp(Math.max(1, ...zooms), 1, Math.min(CAM_MAX, 2600 / Math.max(1, 1.08 * H * dpr)));
    this.fig = bakeFigure(L.fig, dpr, figZoom);
    this.roseR = maxWindowR(L);
    const z = (s: StationId) => clamp(cameraFor(L, framingOf(s)).s, 1, 2.6);
    this.roseZoom = z;
    this.roses = bakeRoses(this.roseR, dpr, this.roseTier, s => z(s) * STATION[s].size, s => windowed(s));
    this.openKey = '';
    this.camAt = null;
    // the two rivers from the pool to the sides, meandering a little toward the viewer
    const ground = L.fig.top + H, cx = L.fig.cx;
    this.riverPts = [-1, 1].map(s => {
      // both run well out to the sides (the camera may draw the world smaller than the screen)
      const end = cx + s * Math.max(H * 1.4, (s < 0 ? cx - L.left : L.right - cx) + 12);
      const span = Math.abs(end - (cx + s * H * 0.16));
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40;
        pts.push([cx + s * (H * 0.16 + u * span), ground + H * (0.014 + 0.045 * u * u) + Math.sin(u * 7 + s) * H * 0.01 * u]);
      }
      return pts;
    });
    // motes in and around the egg of light
    this.motes = [];
    for (let i = 0; i < 34; i++) this.motes.push(this.newMote(i, true));
  }

  private newMote(i: number, anywhere: boolean): Mote {
    const L = this.L, H = L.fig.H;
    const x = L.fig.cx + (hash(i * 3 + this.time) - 0.5) * H * 0.8;
    const y = anywhere ? L.fig.top - H * 0.05 + hash(i * 7 + this.time) * H * 1.05 : L.fig.top + H * (0.9 + 0.15 * hash(i + this.time));
    return { x, y, vy: -(4 + 10 * hash(i * 11 + this.time)) * (H / 400), r: 0.8 + 1.8 * hash(i * 13 + this.time), a: 0.25 + 0.5 * hash(i * 17 + this.time), ph: hash(i * 19) * TAU };
  }

  /** A figure point in the world (the body framing's px). */
  private wp(p: P): { x: number; y: number } { return figPt(this.L, p[0], p[1]); }
  /** A world point on the screen now. */
  private sp(x: number, y: number): { x: number; y: number } { return toScreen(this.cam, x, y); }

  // ── events → juice ─────────────────────────────────────────────
  on(e: SimEvent, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H;
    switch (e.type) {
      case 'petal': {
        for (const q of this.tilePoint(e.station, e.n, sim)) {
          this.parts.burst(q.x, q.y, 3, { color: q.color, speed: H * 0.05, life: 0.6, size: 1.6, g: 0, drag: 2.5, shape: 'dot' });
        }
        break;
      }
      case 'full': {
        const hue = STATION[e.station].hue;
        this.pop = 1;
        for (const p of stationPts(e.station)) {
          const c = this.wp(p);
          this.parts.burst(c.x, c.y, 18, { color: hue, speed: H * 0.2, life: 1.1, size: 2, g: -10, drag: 1.8, shape: 'spark' });
          this.parts.burst(c.x, c.y, 1, { color: '#ffffff', speed: 0, life: 0.9, size: H * 0.06, g: 0, drag: 0, shape: 'ring' });
        }
        // a bright drop falls down the column into the pool; its "+15" rises there, by the water
        const a = stationXY(L, e.station);
        const from = Math.min(a.y, L.fig.top + H * 0.98);
        this.drops.push({ y: from, vy: H * 0.12, x: L.fig.cx, hue, from, big: true, label: dropFloat(e.drops), labelColor: WATER });
        break;
      }
      case 'whole': {
        this.flash = this.o.reducedMotion ? 0.5 : 1;
        this.poolFloat(dropFloat(e.drops), GOLD_HI, 18);
        // the thanks rise from the top into the open heaven (Ps 141:2); the gift pours down to the feet
        const c = figPt(L, 0, e.dir === 'up' ? -0.02 : 0.99);
        this.parts.burst(c.x, c.y, 34, e.dir === 'up'
          ? { color: GOLD, speed: H * 0.25, angle: -Math.PI / 2, spread: 0.9, life: 2.2, size: 2, g: -H * 0.05, drag: 0.8, shape: 'dot' }
          : { color: WATER, speed: H * 0.2, angle: -Math.PI / 2, spread: 2.6, life: 1.6, size: 1.8, g: H * 0.25, drag: 0.9, shape: 'dot' });
        break;
      }
      case 'enter':
        if (e.dir === 'down') this.heavenK = 1;
        break;
      case 'tier': {
        // new glass in the window: gold sparks and its name
        const c = stationXY(L, e.station);
        this.parts.burst(c.x, c.y, 28, { color: GOLD, speed: H * 0.2, life: 1.4, size: 2, g: -12, drag: 1.4, shape: 'spark' });
        this.sideFloat(tierName(e.tier), c.y, GOLD_HI);
        break;
      }
      case 'tap': {
        for (const p of stationPts(e.station)) {
          const c = this.wp(p);
          const r = e.station === sim.station && (sim.stage === 'at' || sim.stage === 'hold') ? this.curR(sim) : litR(L) * 1.4;
          this.parts.burst(c.x, c.y, 1, { color: STATION[e.station].hue, speed: 0, life: 0.7, size: r * 0.9, g: 0, drag: 0, shape: 'ring' });
        }
        break;
      }
      case 'drops':
        this.poolFloat(dropFloat(e.n), WATER, 14);
        break;
      case 'blindEnd': {
        const c = stationXY(L, sim.station);
        if (e.drops > 0) this.poolFloat(dropFloat(e.drops), SILVER, 15);
        if (e.gained > 0.005) {
          const pct = t('pct', { n: Math.round(Math.min(1, e.gained) * 100) });
          this.sideFloat(t('hud.revealed', { pct }), c.y, '#e6e8f6');
        }
        this.parts.burst(c.x, c.y, 16, { color: SILVER, speed: H * 0.16, life: 1, size: 1.8, g: -6, drag: 1.8, shape: 'spark' });
        break;
      }
      case 'gold':
        if (e.on) {
          for (const p of stationPts(sim.station)) {
            const c = this.wp(p);
            this.parts.burst(c.x, c.y, 6, { color: GOLD, speed: H * 0.08, life: 0.8, size: 1.6, g: -6, drag: 2, shape: 'dot' });
          }
        }
        break;
      default:
        break;
    }
  }

  /** Where the n-th piece of a station's glass is (world px) and its colour: the sparkle of a tick. */
  private tilePoint(s: StationId, n: number, sim: RzekiSim): { x: number; y: number; color: string }[] {
    const L = this.L, st = STATION[s], k = n - 1;
    const at = (p: P, color: string) => ({ ...this.wp(p), color });
    switch (st.kind) {
      case 'point': {
        const c = stationXY(L, s), R = this.curR(sim), rose = st.rose;
        const inner = k < rose.inner;
        const a = inner ? petalAngle(k, rose.inner) : petalAngle(k - rose.inner, rose.outer, rose.twist);
        const rr = (inner ? (RING.c + RING.i) / 2 : (RING.i + RING.o) / 2) * R;
        const color = (inner ? rose.innerEach?.[k % (rose.innerEach.length || 1)] : rose.outerEach?.[(k - rose.inner) % (rose.outerEach.length || 1)]) ?? rose.glass[inner ? 1 : 2];
        return [{ x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr, color }];
      }
      case 'shell': {
        const sh = SHELL[s as 'galactic' | 'gateway'], key = st.rose.inner + st.rose.outer;
        if (k < key) return [{ ...stationXY(L, s), color: st.rose.glass[1] }];
        const j = k - key + 1, a = (j / (SHELL_SEGS / 2)) * Math.PI, aa = sim.dir === 'down' ? a : Math.PI - a;
        return [at(shellPt(sh, aa), st.hue), at(shellPt(sh, -aa), st.hue)];
      }
      case 'channels': {
        if (k < 2) return [at(k === 0 ? SUN : MOON, k === 0 ? SUN_GOLD : MOON_SILVER)];
        const q = (k - 1) / CHANNEL_PANES, qq = sim.dir === 'down' ? q : 1 - q;
        return [at(along(CHANNELS.pingala, qq), SUN_GOLD), at(along(CHANNELS.sushumna, qq), '#ffffff'), at(along(CHANNELS.ida, qq), MOON_SILVER)];
      }
      case 'ring': {
        const a = ((k + 1) / (RING_SEGS / 2)) * Math.PI, aa = sim.dir === 'down' ? a : Math.PI - a;
        const pt = (sgn: number): P => [VOID.cx + VOID.rx * Math.sin(sgn * aa), VOID.cy - VOID.ry * Math.cos(sgn * aa)];
        return [at(pt(1), st.hue), at(pt(-1), st.hue)];
      }
      case 'bone': return [{ ...figPt(L, 0, 0.465 + (k + 0.5) * 0.012), color: st.rose.glass[2] }];
      case 'hands': {
        const part = HAND_ORDER[Math.min(HAND_ORDER.length - 1, k)];
        return [at(handPoint(part, -1), HAND_COLOURS[part]), at(handPoint(part, 1), HAND_COLOURS[part])];
      }
      case 'feet': {
        const y = 0.965 + (k > 0 ? 0.03 : 0);
        return [-1, 1].map(side => ({ ...figPt(L, side * (k > 0 ? 0.02 + 0.009 * k : 0.044), y), color: st.hue }));
      }
    }
    return [{ ...figPt(L, st.x, st.y), color: st.hue }];
  }

  /** A number that rises beside the pool, where the drops fall — never over the column and its windows. */
  private poolFloat(text: string, color: string, px: number): void {
    const L = this.L, H = L.fig.H;
    this.floatSide = -this.floatSide;
    const w = { x: L.fig.cx + this.floatSide * H * (0.27 + 0.03 * Math.random()), y: L.fig.top + H * 0.97 };
    const s = this.sp(w.x, w.y);
    this.floats.add(text, clamp(s.x, L.left + 28, L.right - 28), clamp(s.y, L.top + 50, L.bottom - 8), { color, size: px * L.u, dur: 1.7 });
  }

  /**
   * A word beside the column at a station's height, beyond the hands: on an upright phone to the right, on a wide
   * screen to the left (the prayer's column is on the right), kept inside the picture.
   */
  private sideFloat(text: string, y: number, color: string): void {
    const L = this.L, H = L.fig.H;
    const sx = this.sp(L.fig.cx + (L.shape === 'tall' ? 1 : -1) * H * 0.3, y);
    const x = L.shape === 'tall' ? Math.min(sx.x, L.right - 64) : Math.max(sx.x, L.left + 64);
    this.floats.add(text, x, clamp(sx.y, L.top + 40, L.bottom - 20), { color, size: 14 * L.u, dur: 2.4 });
  }

  /** A touch-down anywhere: a soft ring of light under the finger, at once (in the world, under the camera). */
  touch(x: number, y: number): void {
    const w = toWorld(this.cam, x, y);
    this.parts.burst(w.x, w.y, 1, { color: PEARL, speed: 0, life: 0.5, size: 12 / this.cam.s, g: 0, drag: 0, shape: 'ring' });
  }

  /** The mouse moved over the play (a desktop): the station a click would stay with answers (`drawHover`). */
  hover(x: number, y: number): void {
    if (this.o.touch) return;
    this.mouse = { x, y };
    this.mouseIdle = 0;
  }

  /** The mouse left the canvas. */
  unhover(): void {
    this.mouse = null;
  }

  /** Whether a screen point is over the figure's egg of light (a click there plainly goes to its station: a pointer cursor). */
  overFigure(x: number, y: number): boolean {
    const L = this.L, H = L.fig.H, w = toWorld(this.cam, x, y);
    const dx = (w.x - L.fig.cx) / (H * 0.36), dy = (w.y - (L.fig.top + H * 0.47)) / (H * 0.64);
    return dx * dx + dy * dy <= 1;
  }

  /** Whether a point is on the story card as last drawn. */
  overStory(x: number, y: number): boolean {
    const r = this.storyRect;
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /** The station the camera frames now: the one the light is at, or flows to; the whole map when a way is whole. */
  private frameStation(sim: RzekiSim): StationId | null {
    if (sim.stage === 'flow') return sim.nextStation ?? sim.station;
    if (sim.stage === 'whole') return null;
    return sim.station;
  }

  update(dt: number, sim: RzekiSim): void {
    this.time += dt;
    this.lastDt = dt;
    const L = this.L, H = L.fig.H;
    // the camera eases toward its framing (never a jump; reduced motion goes at once)
    const fs = sim.started ? this.frameStation(sim) : sim.station;
    const map = MAP[sim.map].stations;
    const target = fs ? cameraFor(L, framingOf(fs)) : cameraFor(L, map.includes('gateway') ? 'heavens' : 'body');
    if (this.camAt === null || this.o.reducedMotion) this.cam = target;
    else this.cam = easeCam(L, this.cam, target, 1 - Math.exp(-dt / RULES.cameraTau));
    this.camAt = fs ?? sim.station;
    // the mouse's answer comes quickly and goes slowly once it rests (a meditation is not a cursor chase)
    this.mouseIdle += dt;
    const wantHover = this.mouse && this.mouseIdle < 2.6 && !sim.story ? 1 : 0;
    this.hoverK = wantHover > this.hoverK ? Math.min(1, this.hoverK + dt * 5) : Math.max(0, this.hoverK - dt * 1.2);
    this.parts.update(dt);
    this.floats.update(dt);
    this.pop = Math.max(0, this.pop - dt * 2.2);
    this.flash = Math.max(0, this.flash - dt * 0.6);
    this.heavenK = Math.max(sim.stage === 'enter' && sim.dir === 'down' ? 1 : 0, this.heavenK - dt * 0.35);
    const line = sim.talk.line;
    this.captionK = line ? Math.min(1, this.captionK + dt * 4) : Math.max(0, this.captionK - dt * 3);
    if (line) this.lastCaption = line.text;
    // motes drift up through the egg of light
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i];
      m.y += m.vy * dt * (sim.restBlock ? 0.6 : 1);
      m.ph += dt;
      if (m.y < L.fig.top - H * 0.12) this.motes[i] = this.newMote(i + Math.floor(this.time * 7), false);
    }
    // drops of living water fall down the column into the pool, more in calm rest
    if (sim.started && !sim.story && sim.restBlock) {
      this.dropT += dt * (0.8 + 1.6 * sim.calmShown);
      const lit = map.filter(s => sim.lit[s] && STATION[s].y < 0.99);
      while (this.dropT >= 1 && this.drops.length < 24) {
        this.dropT -= 1;
        const from = lit.length ? lit[Math.floor(Math.random() * lit.length)] : sim.station;
        const y = Math.max(L.fig.top - 0.02 * H, Math.min(stationXY(L, from).y, L.fig.top + 0.95 * H));
        this.drops.push({ y, vy: H * 0.05, x: L.fig.cx + (Math.random() - 0.5) * H * 0.012, hue: STATION[from].hue, from: y });
      }
    }
    const ground = L.fig.top + H * 0.995;
    for (const d of this.drops) {
      d.vy += H * 0.5 * dt;
      d.y += d.vy * dt;
    }
    const keep: Drop[] = [];
    for (const d of this.drops) {
      if (d.y < ground) { keep.push(d); continue; }
      // into the pool: a ripple, a plink, and the drop's number rising beside the water
      this.splashes++;
      this.ripples.push({ t: 0, k: d.big ? 1.35 : 0.6 + 0.4 * Math.random() });
      if (d.label) this.poolFloat(d.label, d.labelColor ?? WATER, 15);
    }
    this.drops = keep;
    for (const r of this.ripples) r.t += dt;
    this.ripples = this.ripples.filter(r => r.t < 1.6);
    // the way up: thanks rise from the thanked stations like incense, slow gold motes drifting up
    if (sim.started && !sim.story && sim.dir === 'up' && !this.o.reducedMotion) {
      this.incenseT += dt * 3;
      while (this.incenseT >= 1) {
        this.incenseT -= 1;
        const up = map.filter(s => sim.lit[s] & LIT_UP);
        if (!up.length) break;
        const s = up[Math.floor(Math.random() * up.length)];
        const pts = stationPts(s), c = this.wp(pts[Math.floor(Math.random() * pts.length)]);
        this.parts.burst(c.x + (Math.random() - 0.5) * H * 0.02, c.y, 1, { color: Math.random() < 0.5 ? GOLD : GOLD_HI, speed: H * 0.03, angle: -Math.PI / 2, spread: 0.6, life: 2.4, size: 1.6, g: -H * 0.03, drag: 0.4, shape: 'dot' });
      }
    }
    // the stream's spray while it flows
    if ((sim.stage === 'flow' || sim.stage === 'enter') && !this.o.reducedMotion && Math.random() < dt * 20) {
      for (const hd of this.streamHeads(sim)) {
        this.parts.burst(hd.x, hd.y, 1, { color: WATER, speed: H * 0.08, angle: sim.dir === 'down' ? Math.PI / 2 : -Math.PI / 2, spread: 2.4, life: 0.7, size: 1.4, g: H * 0.2, drag: 1.5, shape: 'dot' });
      }
    }
  }

  /** The heads of the stream of light (world px): where the light is on its way between stations, or coming in. */
  private streamHeads(sim: RzekiSim): { x: number; y: number }[] {
    if (sim.stage === 'flow' && sim.nextStation) {
      const k = ease.inOutSine(clamp(sim.stageT / RULES.flowSec));
      return streamPaths(sim.station, sim.nextStation).map(p => this.wp(along(p, k)));
    }
    if (sim.stage === 'enter') {
      const k = ease.inOutSine(clamp(sim.stageT / RULES.heavenSec));
      return enterPaths(sim.station, sim.dir === 'down', -0.7).map(p => this.wp(along(p, k)));
    }
    return stationPts(sim.station).map(p => this.wp(p));
  }

  /** The y of the light on its way (world px), for the column's lit stretch and the words on a desktop. */
  private streamY(sim: RzekiSim): number {
    const hs = this.streamHeads(sim);
    return hs.reduce((s, h) => s + h.y, 0) / Math.max(1, hs.length);
  }

  // ── drawing ────────────────────────────────────────────────────
  /** Re-bake a window whose craft tier changed (the session's start, or a new tier earned). */
  private syncTiers(sim: RzekiSim): void {
    for (const s of STATIONS) {
      const k = sim.tiers[s];
      if (k === this.roseTier[s] || !windowed(s)) continue;
      this.roseTier[s] = k;
      const r = bakeRose(s, this.roseR * this.roseZoom(s) * STATION[s].size, this.dpr, k);
      if (r) this.roses[s] = r;
    }
  }

  /** The current window's radius (world px), with its pop when it fills. */
  private curR(sim: RzekiSim): number {
    return windowR(this.L, sim.fill, sim.station) * (1 + 0.1 * Math.sin(Math.PI * this.pop));
  }

  draw(sim: RzekiSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.syncTiers(sim);
    const L = this.L, H = L.fig.H, d = this.dpr, c = this.cam;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (this.sky) ctx.drawImage(this.sky, 0, 0, L.w, L.h);
    else {
      ctx.fillStyle = '#120c34';
      ctx.fillRect(0, 0, L.w, L.h);
    }
    this.drawTwinkles(ctx);
    // the world, under the camera
    ctx.setTransform(d * c.s, 0, 0, d * c.s, d * c.ox, d * c.oy);
    const rest = sim.restBlock;
    const breathe = rest ? sim.breath.k : this.o.reducedMotion ? 0.5 : 0.5 + 0.12 * Math.sin(this.time * 0.6);
    this.shellNames.length = 0;
    // the quiet halo behind the figure
    bloom(ctx, '#8f7cff', L.fig.cx, L.fig.top + H * 0.45, H * 0.8, 0.2);
    this.drawHeaven(ctx, sim);
    this.drawShells(ctx, sim);
    this.drawAura(ctx, sim, breathe);
    this.drawGround(ctx, sim);
    // the figure breathes around the chest
    const chest = { x: L.fig.cx + CHEST[0] * H, y: L.fig.top + CHEST[1] * H };
    const sc = 1 + (rest ? 0.012 : 0.004) * (breathe - 0.5);
    ctx.save();
    ctx.translate(chest.x, chest.y);
    ctx.scale(sc, sc);
    ctx.translate(-chest.x, -chest.y);
    if (this.fig) ctx.drawImage(this.fig.c, this.fig.box.x, this.fig.box.y, this.fig.box.w, this.fig.box.h);
    this.drawInnerLight(ctx, sim);
    ctx.restore();
    // a held breath: the light stays still, a soft steady glow in the chest
    if (rest && !sim.story && (sim.breath.phase === 'holdIn' || sim.breath.phase === 'holdOut')) {
      glow(ctx, sim.breath.phase === 'holdIn' ? GOLD_HI : '#c9c2ff', chest.x, chest.y, H * (sim.breath.phase === 'holdIn' ? 0.2 : 0.13), 0.22);
    }
    this.drawColumn(ctx, sim, breathe);
    this.drawThreads(ctx, sim, false);
    this.drawStations(ctx, sim, breathe);
    this.drawThreads(ctx, sim, true);
    this.drawStream(ctx, sim);
    this.drawHover(ctx, sim);
    this.drawDrops(ctx);
    this.drawMotes(ctx);
    this.parts.draw(ctx);
    if (this.flash > 0) glow(ctx, GOLD_HI, L.fig.cx, L.fig.top + H * 0.45, H * 0.85, 0.32 * Math.sin(Math.PI * Math.min(1, this.flash)));
    // the screen again: the words, the numbers, the veil, the cards
    ctx.setTransform(d, 0, 0, d, 0, 0);
    this.drawShellNames(ctx);
    this.floats.draw(ctx, `800 ${SANS}`);
    if (sim.blind) this.drawVeil(ctx);
    // the map column: every station of the map, where the light is, the count
    this.strip = drawStrip(ctx, L.strip, this.stripState(sim), L.u, d, this.time, { still: this.o.reducedMotion });
    if (this.mouse && !sim.story && this.mouseIdle < 2.6) {
      const s = stripHit(this.strip, sim.map, this.mouse.x, this.mouse.y);
      if (s) drawStripName(ctx, this.strip, sim.map, s, stationLabel(s), Math.max(MIN_READ, Math.round(13 * L.u)));
    }
    // the words: the narrator in its own column (or in the band's top row on a phone held upright), the prayer;
    // on a desktop they stand level with the station the light is at
    const k = sim.story ? 0 : this.captionK;
    const Lw = this.wordsLayout(sim);
    if (L.shape !== 'tall') drawCaption(ctx, Lw, this.lastCaption, k);
    drawPrayer(ctx, Lw, sim, this.lastDt, { text: this.lastCaption, k });
    this.storyRect = drawStory(ctx, L, sim, !!this.mouse && this.overStory(this.mouse.x, this.mouse.y));
  }

  /** What the map column shows: the stations lit this round, the one the light is at (gliding with the stream), the count. */
  private stripState(sim: RzekiSim): StripState {
    const list = MAP[sim.map].stations;
    const i = list.indexOf(sim.station);
    let at: number | null = i;
    let current: StationId | null = sim.station;
    if (sim.stage === 'flow' && sim.nextStation) {
      const j = list.indexOf(sim.nextStation);
      at = i + (j - i) * ease.inOutSine(clamp(sim.stageT / RULES.flowSec));
      current = null;
    } else if (sim.stage === 'whole') {
      at = null;
      current = null;
    }
    return {
      map: sim.map, litOf: s => sim.lit[s], tierOf: s => sim.tiers[s], current, at, dir: sim.dir, lit: sim.litCount,
      fill: sim.stage === 'hold' ? 1 : sim.stage === 'at' ? sim.fill : 0,
    };
  }

  /**
   * The two shells' names (picture 2 names its ovals beside them): beside each shell's jewel, outside the shell where
   * the screen has room, else inside it, in one line or two — never over the map column or the words.
   */
  private drawShellNames(ctx: CanvasRenderingContext2D): void {
    for (const n of this.shellNames) {
      ctx.globalAlpha = n.a;
      const lh = Math.round(n.px * 1.2);
      let y = n.y - ((n.lines.length - 1) * lh) / 2;
      for (const line of n.lines) {
        label(ctx, line, n.x, y, n.px, mix(n.hue, '#ffffff', 0.45), n.align, 700);
        y += lh;
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Place a shell's name beside its jewel (screen px): outside first, then inside; one line, then two; else none. */
  private placeShellName(ctx: CanvasRenderingContext2D, s: StationId, c: { x: number; y: number }, outward: number, r: number, a: number, fy: number): void {
    const L = this.L, text = stationName(s);
    // as large as the screen reads (13 px, grown with the screen), smaller only to fit (12 on a phone, 13 a desktop)
    const min = L.desk ? MIN_READ : 12, base = Math.max(MIN_READ, Math.round(13 * L.u));
    // the room the names may use: clear of the map column, left of the words beside the figure (or the edge), and
    // never over the figure itself (its hands, its legs) on the side the name is on
    const lo0 = L.strip.x + L.strip.w + 12, hi0 = L.shape === 'tall' ? L.right - 6 : Math.min(L.right - 6, L.prayer.x - 10);
    const body = figureHalf(fy) * L.fig.H * this.cam.s, mid = this.sp(L.fig.cx, 0).x;
    const lo = c.x > mid ? Math.max(lo0, mid + body) : lo0, hi = c.x < mid ? Math.min(hi0, mid - body) : hi0;
    if (c.y <= L.top + 8 || c.y >= L.bottom - 8) return;
    // the placements that fit are measured once per place on the screen (the camera eases: a few dozen places a move)
    const key = `${s}|${Math.round(c.x)}|${Math.round(c.y)}|${Math.round(lo)}|${Math.round(hi)}|${base}`;
    let fits = this.nameMemo.get(key);
    if (!fits) {
      fits = [];
      const sp = text.lastIndexOf(' ');
      const options: string[][] = [[text], ...(sp > 0 ? [[text.slice(0, sp), text.slice(sp + 1)]] : [])];
      for (let px = base; px >= min; px -= 1) {
        ctx.font = font(px, 700);
        for (const dir of [outward, -outward]) {
          for (const lines of options) {
            const w = Math.max(...lines.map(l => ctx.measureText(l).width));
            const x = c.x + dir * (r + 6);
            const x0 = dir > 0 ? x : x - w, x1 = dir > 0 ? x + w : x;
            if (x0 >= lo && x1 <= hi) {
              fits.push({ text, x, y: c.y, hue: STATION[s].hue, align: dir > 0 ? 'left' : 'right', lines, px, a: 1, box: [x0, x1] });
            }
          }
        }
      }
      if (this.nameMemo.size > 300) this.nameMemo.clear();
      this.nameMemo.set(key, fits);
    }
    // the first that clears the names already placed this frame (the two shells' names never touch)
    const boxOf = (n: ShellName) => {
      const hh = (n.lines.length * n.px * 1.2) / 2 + 3;
      return { x0: n.box[0] - 3, x1: n.box[1] + 3, y0: n.y - hh, y1: n.y + hh };
    };
    for (const n of fits) {
      const b = boxOf(n);
      if (this.shellNames.some(o => { const q = boxOf(o); return b.x0 < q.x1 && q.x0 < b.x1 && b.y0 < q.y1 && q.y0 < b.y1; })) continue;
      this.shellNames.push({ ...n, a });
      return;
    }
  }


  /**
   * A desk layout's words, standing level with the station the light is at, gliding with the stream to the next
   * (eased); with the whole figure in light, at the chest.  Reduced motion keeps them still at the chest.
   */
  private wordsLayout(sim: RzekiSim): Layout {
    const L = this.L;
    if (!L.desk || this.o.reducedMotion) return L;
    let target = this.sp(L.fig.cx, sim.stage === 'whole' ? L.fig.top + L.fig.H * 0.3 : this.streamY(sim)).y;
    // the runner's banner covers the top of the play in a block's first seconds: the words wait under it
    if (sim.phase === 'play' && (sim.pushBlock || sim.restBlock) && sim.blockT < RULES.bannerSec) {
      const room = Math.max(150, 0.24 * (L.bottom - L.top));
      target = Math.max(target, L.top + room + L.caption.h + 6 + labelRowH(L) / 2);
    }
    if (!Number.isFinite(this.wordsY)) this.wordsY = target;
    else this.wordsY += (target - this.wordsY) * Math.min(1, this.lastDt * 3);
    return wordsAt(L, this.wordsY);
  }

  /**
   * A desktop's hover: two arcs of light turning slowly around the station a click would stay with — the current
   * one, or the next while the stream flows there — brighter while the mouse is on the figure; it fades once the
   * mouse rests (the dashed ring further out is the threshold, a different thing).
   */
  private drawHover(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    if (this.hoverK < 0.01 || !sim.started || sim.story) return;
    const at = sim.stage === 'at' || sim.stage === 'hold';
    const s = sim.stage === 'flow' ? sim.nextStation : sim.stage === 'whole' ? null : sim.station;
    if (!s) return;
    const L = this.L, H = L.fig.H;
    const m = this.mouse;
    const k = this.hoverK * (m && this.overFigure(m.x, m.y) ? 1 : 0.55);
    for (const p of this.hoverPts(s)) {
      const c = this.wp(p);
      const R = at && s === sim.station ? this.anchorR(sim, s) : litR(L) * 1.2;
      const rr = R * 1.28 + Math.max(4, H * 0.008);
      glow(ctx, PEARL, c.x, c.y, rr * 1.3, 0.12 * k);
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, H * 0.0042);
      ctx.strokeStyle = `rgba(246,242,255,${(0.78 * k).toFixed(3)})`;
      const a0 = this.o.reducedMotion ? -Math.PI / 2 : this.time * 0.9;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.arc(c.x, c.y, rr, a0 + i * Math.PI, a0 + i * Math.PI + 1.7);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Where a station's hover rings turn: its window, the keystone of a shell, each palm, each foot. */
  private hoverPts(s: StationId): readonly P[] {
    return stationPts(s);
  }

  /** A dozen stars that twinkle slowly (the rest of the sky is baked). */
  private drawTwinkles(ctx: CanvasRenderingContext2D): void {
    const spr = starSprite();
    if (!spr || this.o.reducedMotion) return;
    const L = this.L;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const x = hash(i * 29 + 901) * L.w, y = L.top * 0.4 + hash(i * 31 + 902) * (L.h - L.top * 0.4);
      const k = 0.5 + 0.5 * Math.sin(this.time * (0.5 + hash(i + 903)) + i * 2.1);
      const r = 3 + 5 * k * hash(i + 904);
      ctx.globalAlpha = 0.15 + 0.6 * k * k;
      ctx.drawImage(spr, x - r, y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The open heaven: its rays come down through the gate, strongest as the light comes down, breathing softly. */
  private drawHeaven(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H;
    const k = this.heavenK;
    // the opening's warmth above the head (the head is lit by its own stations, never washed white)
    glow(ctx, GOLD_HI, L.fig.cx, L.fig.top - H * 0.5, H * 0.42, 0.16 + 0.12 * k);
    glow(ctx, GOLD_HI, L.fig.cx, L.fig.top - H * 0.07, H * (0.15 + 0.08 * k), 0.1 + 0.22 * k);
    if (!this.rays) return;
    const live = sim.dir === 'down' ? 0.35 + 0.25 * (sim.idx === 0 && sim.stage === 'at' ? sim.light : 0.3) : 0.3;
    const a = clamp(live + 0.5 * k) * (0.85 + 0.15 * Math.sin(this.time * 0.7));
    const r = this.raysBox;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(this.rays, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** How a station shows now. */
  private look(sim: RzekiSim, s: StationId): Look {
    if ((sim.stage === 'at' || sim.stage === 'hold') && sim.station === s) return 'current';
    return sim.lit[s] ? 'lit' : 'idle';
  }

  /** The two shells of light: faint ovals waiting, glowing outlines once lit, their glass lighting from the keystone. */
  private drawShells(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const map = MAP[sim.map].stations;
    // the shells belong to the wide views: as the camera nears the hands or the ground they fade, so their long
    // lines never cross the words beside the figure
    const near = clamp((1.8 - this.cam.s) / 0.8);
    if (near <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = near;
    for (const s of ['gateway', 'galactic'] as const) {
      if (!map.includes(s)) continue;
      const look = this.look(sim, s);
      const sh = SHELL[s], st = STATION[s];
      const fill = look === 'current' ? sim.fill : look === 'lit' ? 1 : 0;
      const segK = clamp((fill - KEYSTONE) / (1 - KEYSTONE));
      this.shellLine(ctx, sh, st.hue, look === 'idle' ? (sim.memory[s] ? 0.2 : 0.12) : 0.2, 0, Math.PI, false);
      if (segK > 0) {
        // the glass segments lit so far: from the apex down both sides (down), or from the bottom up (up)
        const down = look === 'lit' ? true : sim.dir === 'down';
        const n = SHELL_SEGS / 2, lit = segK * n;
        for (let i = 0; i < Math.ceil(lit - 1e-9); i++) {
          const q = clamp(lit - i);
          const a0 = (i / n) * Math.PI, a1 = ((i + q) / n) * Math.PI;
          const [b0, b1] = down ? [a0, a1] : [Math.PI - a1, Math.PI - a0];
          this.shellLine(ctx, sh, st.hue, look === 'lit' ? 0.5 : 1, b0 + 0.012, b1 - 0.012, true);
        }
        if (s === 'galactic' && !this.o.reducedMotion) this.shellStars(ctx, sh, segK, down);
      }
      // the keystone at the apex
      const c = this.wp([st.x, st.y]);
      if (look === 'current') this.drawCurrentPoint(ctx, sim, s, c, clamp(fill / KEYSTONE));
      else if (look === 'lit') this.drawJewel(ctx, sim, s, c);
      else this.drawIdle(ctx, sim, s, c);
      // its jewel on its own line, low on the side away from the words (picture 2 names its ovals there), and its name
      const side = this.L.shape === 'tall' ? 1 : -1;
      const mp = shellPt(sh, side * SHELL_MARK[s]), m = this.wp(mp);
      this.shellMark(ctx, sim, s, m, look, near);
      const scr = this.sp(m.x, m.y);
      this.placeShellName(ctx, s, scr, side, litR(this.L) * 1.3 * this.cam.s, near * (look === 'idle' ? 0.8 : 1), mp[1]);
    }
    ctx.restore();
  }

  /** A shell's jewel on its line: its glass once lit (gold-ringed while its light loads), its tracery while waiting. */
  private shellMark(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, c: { x: number; y: number }, look: Look, near: number): void {
    const r = litR(this.L) * 0.95, rose = this.roses[s], hue = STATION[s].hue;
    const lit = look === 'lit' || (look === 'current' && sim.fill >= 1);
    glow(ctx, hue, c.x, c.y, r * 3, (lit ? 0.42 : look === 'current' ? 0.3 + 0.3 * sim.light : 0.18) * near);
    if (rose) {
      const k = r / rose.R;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.scale(k, k);
      ctx.globalAlpha = near * (lit ? 1 : 0.85);
      ctx.drawImage(lit ? rose.glass : rose.lead, -rose.half, -rose.half, 2 * rose.half, 2 * rose.half);
      ctx.restore();
    }
    ctx.strokeStyle = `${rgbaPrefix(look === 'current' ? GOLD : hue)}${(0.7 * near).toFixed(3)})`;
    ctx.lineWidth = Math.max(1, this.L.fig.H * 0.003);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.25, 0, TAU);
    ctx.stroke();
  }

  /** A stretch of a shell's outline from angle a0 to a1 on both sides (0 the apex, π the bottom), as glass or as a faint line. */
  private shellLine(ctx: CanvasRenderingContext2D, sh: Shell, hue: string, alpha: number, a0: number, a1: number, glass: boolean): void {
    const L = this.L, H = L.fig.H;
    const path = new Path2D();
    for (const sgn of [1, -1]) {
      const steps = Math.max(2, Math.ceil(((a1 - a0) / Math.PI) * 48));
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        const w = this.wp(shellPt(sh, sgn * a));
        if (i) path.lineTo(w.x, w.y); else path.moveTo(w.x, w.y);
      }
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (glass) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `${rgbaPrefix(hue)}${(0.16 * alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(5, H * 0.022);
      ctx.stroke(path);
      ctx.strokeStyle = `${rgbaPrefix(mix(hue, '#ffffff', 0.3))}${(0.5 * alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(2, H * 0.008);
      ctx.stroke(path);
      ctx.strokeStyle = `rgba(255,255,255,${(0.75 * alpha).toFixed(3)})`;
      ctx.lineWidth = Math.max(1, H * 0.0028);
      ctx.stroke(path);
    } else {
      ctx.strokeStyle = `${rgbaPrefix(mix(hue, '#ffffff', 0.5))}${alpha.toFixed(3)})`;
      ctx.lineWidth = Math.max(1, H * 0.0028);
      ctx.stroke(path);
    }
    ctx.restore();
  }

  /** The galactic shell's starlight: small stars twinkling along its lit glass. */
  private shellStars(ctx: CanvasRenderingContext2D, sh: Shell, k: number, down: boolean): void {
    const spr = starSprite();
    if (!spr) return;
    const H = this.L.fig.H, ga = ctx.globalAlpha;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 18; i++) {
      const q = (i + 0.5) / 18;
      if (q > k) break;
      const a = (down ? q : 1 - q) * Math.PI * (i % 2 ? 1 : -1);
      const w = this.wp(shellPt(sh, a));
      const tw = 0.5 + 0.5 * Math.sin(this.time * (0.8 + hash(i + 40)) + i);
      const r = H * (0.008 + 0.01 * tw);
      ctx.globalAlpha = (0.35 + 0.5 * tw) * ga;
      ctx.drawImage(spr, w.x - r, w.y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = ga;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** The egg of light around the body: it grows with each station lit, deepens with calm, swells with the breath. */
  private drawAura(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const spr = auraSprite();
    if (!spr) return;
    const L = this.L, H = L.fig.H;
    const lit = sim.litCount / Math.max(1, sim.mapSize);
    const grow = 0.86 + 0.14 * lit + 0.03 * breathe;
    const rx = H * 0.33 * grow, ry = H * 0.6 * grow;
    const cy = L.fig.top + H * 0.47;
    const a = clamp(0.32 + 0.45 * lit + (sim.restBlock ? 0.3 * sim.calmShown : 0) + 0.25 * this.flash, 0, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a;
    ctx.drawImage(spr, L.fig.cx - rx, cy - ry, 2 * rx, 2 * ry);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The ground of light under the feet, the pool of living water with its shimmer and ripples, and the two
   * rivers flowing out of it: ribbons of water-light that meander toward the viewer, their edges soft (four
   * widths of light laid over each other), glints riding the current outward, their far ends thinning out.
   */
  private drawGround(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H, cx = L.fig.cx, ground = L.fig.top + H * 1.004;
    const reach = sim.river, t = this.time;
    if (reach > 0.04) {
      ctx.globalCompositeOperation = 'lighter';
      // the rivers come in softly as they first run out of the pool; their glints wait until there is a current
      const fadeIn = clamp((reach - 0.04) / 0.12);
      ctx.globalAlpha = fadeIn;
      this.riverPts.forEach((pts, side) => {
        const last = pts.length - 1;
        const n = Math.max(2, Math.floor(last * reach));
        const c: [number, number][] = [], hw: number[] = [];
        for (let i = 0; i <= n; i++) {
          const u = i / last, v = i / n;
          const [x, y] = pts[i];
          // a slow undulation, larger toward the viewer
          c.push([x, y + Math.sin(u * 13 - t * 0.7 + side * 2) * H * 0.004 * (0.3 + u)]);
          const grow = Math.min(1, v / 0.08), thin = Math.min(1, (1 - v) / 0.24);
          hw.push(H * (0.007 + 0.02 * u) * grow * thin + 0.3);
        }
        for (const [k, col] of RIVER_LAYERS) {
          ctx.fillStyle = col;
          ctx.fill(ribbon(c, hw, k));
        }
        // highlights flowing outward with the current (once the river is long enough to carry them)
        for (let j = 0; n >= 6 && j < 7; j++) {
          const q = (t * (0.05 + 0.011 * j) + j / 7) % 1;
          const fi = q * n, i0 = Math.floor(fi);
          if (i0 >= n) continue;
          const f = fi - i0;
          const x = c[i0][0] + (c[i0 + 1][0] - c[i0][0]) * f, y = c[i0][1] + (c[i0 + 1][1] - c[i0][1]) * f;
          glow(ctx, '#ffffff', x, y, Math.max(2.5, hw[i0] * 1.8), 0.55 * Math.sin(Math.PI * q) * fadeIn);
        }
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    // the pool: wider and brighter as the drops gather, a reflection of the column's light in it
    const spr = poolSprite(), col = columnSprite(PEARL);
    const pw = H * (0.36 + 0.14 * reach), ph = H * 0.05;
    ctx.globalCompositeOperation = 'lighter';
    if (spr) {
      ctx.globalAlpha = 0.34 + 0.4 * reach + (sim.restBlock ? 0.12 : 0);
      ctx.drawImage(spr, cx - pw / 2, ground - ph / 2, pw, ph);
    }
    if (col) {
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 1.3);
      ctx.drawImage(col, cx - H * 0.02, ground, H * 0.04, H * 0.05);
    }
    ctx.globalAlpha = 1;
    // a gentle shimmer across the water: short arcs of light that come and go
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * (0.9 + 0.3 * i) + i * 2.1);
      ctx.strokeStyle = `rgba(226,248,255,${(0.1 + 0.3 * k).toFixed(3)})`;
      ctx.lineWidth = 1 / this.cam.s;
      ctx.beginPath();
      ctx.ellipse(cx + (i - 1) * pw * 0.16, ground + (i - 1) * ph * 0.12, pw * (0.08 + 0.05 * k), ph * 0.18, 0, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // the line of the ground, faint
    const g = ctx.createLinearGradient(cx - H * 0.5, 0, cx + H * 0.5, 0);
    g.addColorStop(0, 'rgba(200,220,255,0)');
    g.addColorStop(0.5, 'rgba(220,230,255,.3)');
    g.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - H * 0.5, ground - 0.5, H, 1);
    // ripples where the drops land
    for (const r of this.ripples) {
      const k = r.t / 1.6;
      ctx.strokeStyle = `rgba(200,240,255,${(0.55 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = 1 / this.cam.s;
      ctx.beginPath();
      ctx.ellipse(cx, ground, H * (0.02 + 0.13 * k * r.k), H * (0.005 + 0.02 * k * r.k), 0, 0, TAU);
      ctx.stroke();
    }
  }

  /**
   * Inside the body: the body slowly fills with light from its lit stations, each in its own colour (the head's
   * kept soft, so its windows stay apart), a warm wash when it is nearly all lit; and the body around the current
   * station warms with its light.
   */
  private drawInnerLight(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    const L = this.L, H = L.fig.H;
    const whole = sim.stage === 'whole' ? 1 : 0;
    const calm = sim.restBlock ? sim.calmShown : 0;
    const map = MAP[sim.map].stations;
    if (this.fig) {
      ctx.save();
      ctx.clip(this.fig.clip);
      for (const s of map) {
        if (!sim.lit[s]) continue;
        const st = STATION[s];
        if (st.kind === 'shell' || st.y < -0.05 || st.y > 1.0) continue;
        const head = st.y < 0.2;
        for (const p of stationPts(s)) {
          const c = this.wp(p);
          bloom(ctx, st.hue, c.x, c.y, H * (head ? 0.11 : st.kind === 'hands' || st.kind === 'feet' ? 0.12 : 0.26), (head ? 0.08 : 0.15) + 0.08 * calm + 0.12 * this.flash);
        }
      }
      const fillK = sim.litCount / Math.max(1, sim.mapSize);
      const wash = Math.max(whole, (fillK - 0.5) * 2);
      if (wash > 0) bloom(ctx, GOLD_HI, L.fig.cx, L.fig.top + H * 0.58, H * 0.55, 0.06 + 0.12 * wash + 0.18 * this.flash);
      ctx.restore();
    }
    if (sim.stage === 'at' || sim.stage === 'hold') {
      const st = STATION[sim.station];
      if (st.y > -0.05 && st.y < 1.0 && st.kind !== 'shell') {
        const light = sim.blind ? RULES.baseLight : sim.light;
        const head = st.y < 0.2;
        for (const p of stationPts(sim.station)) {
          const c = this.wp(p);
          glow(ctx, st.hue, c.x, c.y, H * (head ? 0.08 + 0.04 * light : 0.11 + 0.11 * light + 0.05 * sim.fill), 0.1 + 0.25 * light);
        }
      }
    }
  }

  /** The column's span for the map: from its top station (or the crown) to its lowest (or the feet). */
  private columnSpan(sim: RzekiSim): { y0: number; y1: number } {
    const L = this.L, H = L.fig.H, list = MAP[sim.map].stations;
    const top = Math.min(-0.022, ...list.map(s => STATION[s].y)), bottom = Math.max(0.985, ...list.filter(s => STATION[s].kind !== 'feet').map(s => STATION[s].y));
    return { y0: L.fig.top + top * H, y1: L.fig.top + Math.min(1.0, bottom) * H };
  }

  /** The column of light along the midline: faint all the way, bright where the light has come. */
  private drawColumn(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const L = this.L, H = L.fig.H, cx = L.fig.cx;
    const pearl = columnSprite(PEARL), gold = columnSprite(GOLD_HI);
    if (!pearl || !gold) return;
    const span = this.columnSpan(sim);
    const w = H * 0.05 * (0.9 + 0.2 * breathe);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.2;
    ctx.drawImage(pearl, cx - w / 2, span.y0, w, span.y1 - span.y0);
    // the lit stretch: from heaven to the light (down), from the bottom to the light (up), the whole when whole
    const y = clamp(this.streamY(sim), span.y0, span.y1);
    let y0: number, y1: number;
    if (sim.stage === 'whole') { y0 = span.y0 - H * 0.3; y1 = span.y1; }
    else if (sim.dir === 'down') { y0 = span.y0 - H * 0.3; y1 = y; }
    else { y0 = y; y1 = span.y1; }
    if (y1 > y0 + 1) {
      const lightK = sim.blind ? 0.4 : clamp(sim.light);
      ctx.globalAlpha = clamp(0.45 + 0.35 * lightK + (sim.restBlock ? 0.15 * breathe : 0));
      ctx.drawImage(sim.dir === 'up' ? gold : pearl, cx - w * 0.6, y0, w * 1.2, y1 - y0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /**
   * The two threads, gold and silver, spiralling along the lit stretch of the column (their back halves under
   * the stations, their front halves over them): the spiral runs down as the light is received and up as thanks
   * rise, slowly in rest, fast while the stream flows.  Gold starts on the viewer's left (Pingala's side, the sun),
   * silver on the right (Ida's, the moon).
   */
  private drawThreads(ctx: CanvasRenderingContext2D, sim: RzekiSim, front: boolean): void {
    if (!sim.started) return;
    const L = this.L, H = L.fig.H, cx = L.fig.cx;
    const crown = L.fig.top - 0.022 * H, feet = L.fig.top + 0.985 * H;
    const y = clamp(this.streamY(sim), crown, feet);
    let y0: number, y1: number;
    if (sim.stage === 'whole') { y0 = crown; y1 = feet; }
    else if (sim.dir === 'down') { y0 = crown; y1 = y; }
    else { y0 = y; y1 = feet; }
    if (y1 - y0 < 4) return;
    const speed = sim.stage === 'flow' ? 1.6 : sim.restBlock ? 0.25 : 0.55;
    const phase = (sim.dir === 'down' ? -1 : 1) * this.time * TAU * speed;
    const lam = H * 0.12;
    const A = H * (0.024 + (sim.restBlock ? 0.006 * sim.breath.k : 0));
    for (const side of [-1, 1]) {
      const path = new Path2D();
      let open = false;
      for (let yy = y0; yy <= y1 + 0.1; yy += 3) {
        const th = (TAU * (yy - y0)) / lam + phase;
        const taper = clamp((yy - y0) / (H * 0.03)) * clamp((y1 - yy) / (H * 0.03));
        const x = cx + side * A * taper * Math.sin(th);
        const z = side * Math.cos(th);
        if ((z > 0) === front) {
          if (!open) { path.moveTo(x, yy); open = true; } else path.lineTo(x, yy);
        } else open = false;
      }
      const hue = side < 0 ? GOLD : SILVER;
      ctx.lineCap = 'round';
      if (front) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `${rgbaPrefix(hue)}.22)`;
        ctx.lineWidth = Math.max(3, H * 0.012);
        ctx.stroke(path);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = `${rgbaPrefix(hue)}.95)`;
        ctx.lineWidth = Math.max(1.2, H * 0.004);
        ctx.stroke(path);
      } else {
        ctx.strokeStyle = `${rgbaPrefix(hue)}.32)`;
        ctx.lineWidth = Math.max(0.8, H * 0.0028);
        ctx.stroke(path);
      }
    }
  }

  /** The stations of the map, each as it shows now — the current one last, over the others. */
  private drawStations(ctx: CanvasRenderingContext2D, sim: RzekiSim, breathe: number): void {
    const map = MAP[sim.map].stations;
    let current: StationId | null = null;
    // the large shapes first (the Void's ring, the channels, the sacrum), then the hands and feet, then the windows
    const order = [...map].sort((a, b) => rankOf(a) - rankOf(b));
    for (const s of order) {
      const look = this.look(sim, s);
      if (STATION[s].kind === 'shell') continue;
      if (look === 'current') { current = s; continue; }
      this.drawStation(ctx, sim, s, look, breathe);
    }
    if (current) this.drawStation(ctx, sim, current, 'current', breathe);
  }

  private drawStation(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, look: Look, breathe: number): void {
    const st = STATION[s];
    switch (st.kind) {
      case 'point': {
        const c = this.wp([st.x, st.y]);
        if (look === 'current') this.drawCurrentPoint(ctx, sim, s, c, sim.fill);
        else if (look === 'lit') this.drawJewel(ctx, sim, s, c, breathe);
        else this.drawIdle(ctx, sim, s, c);
        break;
      }
      case 'channels': this.drawChannels(ctx, sim, look); break;
      case 'ring': this.drawVoid(ctx, sim, look); break;
      case 'bone': this.drawSacrum(ctx, sim, look); break;
      case 'hands': this.drawHands(ctx, sim, look); break;
      case 'feet': this.drawFeet(ctx, sim, look); break;
      default: break;
    }
  }

  /** A station not lit yet: a small orb of its colour (brighter once lit earlier this session). */
  private drawIdle(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, c: { x: number; y: number }): void {
    const r = idleR(this.L), hue = STATION[s].hue;
    const mem = sim.memory[s] ? 0.12 : 0;
    glow(ctx, hue, c.x, c.y, r * 3.4, 0.2 + mem);
    ctx.fillStyle = `${rgbaPrefix(hue)}${(0.55 + mem).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.55, 0, TAU);
    ctx.fill();
  }

  /** A lit window: a jewel of light — its colour blooming onto the body, the glass lit from behind, a white-hot core; gold-ringed when thanked. */
  private drawJewel(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, c: { x: number; y: number }, breathe = 0.5): void {
    const L = this.L, st = STATION[s];
    const r = litR(L) * (1 + 0.05 * breathe);
    const head = st.y < 0.2;
    bloom(ctx, st.hue, c.x, c.y, r * (head ? 2.8 : 3.4), (head ? 0.32 : 0.44) + 0.14 * breathe + 0.2 * this.flash);
    this.drawWindow(ctx, s, c.x, c.y, r, 1, 1, 0.28);
    glow(ctx, '#ffffff', c.x, c.y, r * 0.5, 0.26 + 0.1 * breathe);
    if (sim.lit[s] & LIT_UP) this.thankRing(ctx, c, r * 1.28);
  }

  /** A thanked station's gold ring. */
  private thankRing(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, r: number): void {
    ctx.strokeStyle = 'rgba(255,217,138,.85)';
    ctx.lineWidth = Math.max(1, this.L.fig.H * 0.003);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, TAU);
    ctx.stroke();
    glow(ctx, GOLD, c.x, c.y, r * 1.6, 0.2);
  }

  /** The radius of the halo's base for the current station (its window, or the size of its shape). */
  private anchorR(sim: RzekiSim, s: StationId): number {
    const L = this.L, H = L.fig.H, k = STATION[s].kind;
    if (k === 'point' || k === 'shell') return this.curR(sim);
    if (k === 'hands') return H * 0.05;
    if (k === 'feet') return H * 0.035;
    if (k === 'bone') return H * 0.05;
    if (k === 'ring') return H * 0.06;
    return H * 0.04;
  }

  /**
   * The halo of the current station — its visible edge at R × (1 + 1.2 × light), the gauge on the station itself —
   * and the threshold as a faint dashed ring where the light stands at 0.5, gold while the light loads.
   */
  private drawHalo(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, c: { x: number; y: number }, R: number, k = 1): void {
    const L = this.L, H = L.fig.H, hue = STATION[s].hue;
    const blind = sim.blind;
    const light = blind ? RULES.baseLight : sim.light;
    const edge = R * (1 + 1.2 * light);
    glow(ctx, hue, c.x, c.y, edge / 0.55, (0.3 + 0.45 * light) * k);
    if (!blind && sim.goldOn) glow(ctx, GOLD, c.x, c.y, edge / 0.6, (0.3 + 0.5 * Math.max(0, light - 0.4)) * k);
    if (sim.pushBlock && !blind) {
      const th = R * (1 + 1.2 * 0.5);
      ctx.save();
      ctx.lineWidth = Math.max(1, H * 0.003);
      if (sim.goldOn) {
        ctx.strokeStyle = 'rgba(255,217,138,.75)';
      } else {
        ctx.setLineDash([Math.max(2, H * 0.008), Math.max(3, H * 0.012)]);
        ctx.lineDashOffset = this.time * H * 0.01;
        ctx.strokeStyle = 'rgba(236,232,255,.34)';
      }
      ctx.beginPath();
      ctx.arc(c.x, c.y, th, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The current point station (or a shell's keystone): its halo, the threshold ring, the rose window opening with the fill. */
  private drawCurrentPoint(ctx: CanvasRenderingContext2D, sim: RzekiSim, s: StationId, c: { x: number; y: number }, fill: number): void {
    const hue = STATION[s].hue;
    const R = windowR(this.L, fill, s) * (1 + 0.1 * Math.sin(Math.PI * this.pop));
    const blind = sim.blind;
    this.drawHalo(ctx, sim, s, c, R);
    bloom(ctx, mix(hue, '#ffffff', 0.35), c.x, c.y, R * 1.9, 0.18 + 0.35 * fill);
    this.drawWindow(ctx, s, c.x, c.y, R, fill, blind ? 0.7 : 1, blind ? 0.1 : 0.26);
    glow(ctx, '#ffffff', c.x, c.y, R * (0.3 + 0.2 * fill), 0.24 + 0.26 * fill);
  }

  /**
   * A rose window at (x, y) of radius R, open to `fill` (the tracery waits for the rest); `shine` adds its open
   * glass once more additively — the light coming through it from behind.
   */
  private drawWindow(ctx: CanvasRenderingContext2D, s: StationId, x: number, y: number, R: number, fill: number, alpha: number, shine = 0): void {
    const rose = this.roses[s];
    if (!rose) {
      glow(ctx, STATION[s].hue, x, y, R, alpha);
      return;
    }
    const k = R / rose.R, half = rose.half, ga = ctx.globalAlpha;
    alpha *= ga;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.globalAlpha = alpha;
    if (fill >= 1) {
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      if (shine > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * shine;
        ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      }
      ctx.restore();
      return;
    }
    ctx.drawImage(rose.lead, -half, -half, 2 * half, 2 * half);
    // the glass open so far: the whole petals (cached by count), then the petal filling now
    const sr = STATION[s].rose, o = roseOpen(sr, fill);
    const key = `${s}|${rose.R}|${Math.floor(o.inner + 1e-9)}|${Math.floor(o.outer + 1e-9)}|${o.oculus > 0 ? 1 : 0}`;
    if (key !== this.openKey || !this.openFull) {
      this.openKey = key;
      this.openFull = fullPath(sr, rose.R, fill);
    }
    ctx.save();
    ctx.clip(this.openFull);
    ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
    if (shine > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * shine;
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
    }
    ctx.restore();
    const part = partPath(sr, rose.R, fill);
    if (part) {
      ctx.save();
      ctx.clip(part);
      ctx.globalAlpha = alpha * 0.9;
      ctx.drawImage(rose.glass, -half, -half, 2 * half, 2 * half);
      ctx.restore();
    }
    ctx.restore();
  }

  /** A polyline of figure points as a world path, up to a share `k` of its length from its start (or its end). */
  private partLine(pts: readonly P[], k0: number, k1: number): Path2D {
    const p = new Path2D();
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const q = k0 + ((k1 - k0) * i) / n;
      const w = this.wp(along(pts, q));
      if (i) p.lineTo(w.x, w.y); else p.moveTo(w.x, w.y);
    }
    return p;
  }

  /**
   * The three channels: faint lines waiting; once lit, Pingala's gold, Sushumna's white and Ida's silver run along
   * the body with the sun and the crescent moon at their tops; opening, their panes light from the top down (going
   * down) or from the bottom up (going up), the three together, the sun and the moon first (or last).
   */
  private drawChannels(ctx: CanvasRenderingContext2D, sim: RzekiSim, look: Look): void {
    const H = this.L.fig.H;
    const fill = look === 'current' ? sim.fill : look === 'lit' ? 1 : 0;
    const down = look !== 'current' || sim.dir === 'down';
    const medK = down ? clamp(fill / MEDALLIONS) : clamp((fill - (1 - MEDALLIONS)) / MEDALLIONS);
    const lineK = down ? clamp((fill - MEDALLIONS) / (1 - MEDALLIONS)) : clamp(fill / (1 - MEDALLIONS));
    const lines: [readonly P[], string][] = [[CHANNELS.pingala, SUN_GOLD], [CHANNELS.sushumna, '#ffffff'], [CHANNELS.ida, MOON_SILVER]];
    if (look === 'current') {
      // the halo at the light's front as it runs along the channels (under the glass)
      const q = down ? lineK : 1 - lineK;
      const front = this.wp(along(CHANNELS.sushumna, clamp(q)));
      this.drawHalo(ctx, sim, 'channels', front, H * 0.032, 0.6);
    }
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [pts, hue] of lines) {
      ctx.strokeStyle = `${rgbaPrefix(hue)}${look === 'idle' ? (sim.memory.channels ? 0.16 : 0.09) : 0.12})`;
      ctx.lineWidth = Math.max(1, H * 0.003);
      ctx.stroke(this.partLine(pts, 0, 1));
    }
    if (lineK > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const k0 = down ? 0 : 1 - lineK, k1 = down ? lineK : 1;
      for (const [pts, hue] of lines) {
        const path = this.partLine(pts, k0, k1);
        ctx.strokeStyle = `${rgbaPrefix(hue)}.2)`;
        ctx.lineWidth = Math.max(5, H * 0.02);
        ctx.stroke(path);
        ctx.strokeStyle = `${rgbaPrefix(hue)}.85)`;
        ctx.lineWidth = Math.max(2, H * 0.007);
        ctx.stroke(path);
      }
      // the lead between the panes: a dark notch across each line every pane
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(30,20,60,.55)';
      for (const [pts] of lines) {
        for (let i = 1; i < CHANNEL_PANES; i++) {
          const q = i / CHANNEL_PANES;
          if (q < k0 || q > k1) continue;
          const w = this.wp(along(pts, q));
          ctx.beginPath();
          ctx.arc(w.x, w.y, Math.max(0.8, H * 0.0032), 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    // the sun and the moon at the tops of the side channels
    for (const [pt, kind] of [[SUN, 'sun'], [MOON, 'moon']] as const) {
      const w = this.wp(pt), r = MEDALLION_R * H;
      const spr = medallionSprite(kind);
      const a = look === 'idle' ? 0.22 : 0.25 + 0.75 * medK;
      if (medK > 0 || look !== 'idle') glow(ctx, kind === 'sun' ? SUN_GOLD : MOON_SILVER, w.x, w.y, r * 3, 0.3 * medK);
      if (spr) {
        ctx.globalAlpha = a;
        ctx.drawImage(spr, w.x - r * 1.35, w.y - r * 1.35, r * 2.7, r * 2.7);
        ctx.globalAlpha = 1;
      }
    }
    if (look === 'lit' && sim.lit.channels & LIT_UP) this.thankRing(ctx, this.wp([0, STATION.channels.y]), litR(this.L) * 1.2);
  }

  /** The Void: a faint ring waiting; a ring of sea-green glass once lit, its segments lighting from the top round (or the bottom). */
  private drawVoid(ctx: CanvasRenderingContext2D, sim: RzekiSim, look: Look): void {
    const L = this.L, H = L.fig.H, st = STATION.void;
    const c = this.wp([VOID.cx, VOID.cy]), rx = VOID.rx * H, ry = VOID.ry * H;
    const fill = look === 'current' ? sim.fill : look === 'lit' ? 1 : 0;
    const down = look !== 'current' || sim.dir === 'down';
    if (look === 'current') {
      // the halo round the Void, under its glass
      const light = sim.blind ? RULES.baseLight : sim.light;
      glow(ctx, st.hue, c.x, c.y, rx * (1.3 + 0.5 * light), 0.12 + 0.2 * light);
      if (!sim.blind && sim.goldOn) glow(ctx, GOLD, c.x, c.y, rx * 1.5, 0.16);
    }
    ctx.save();
    ctx.strokeStyle = `${rgbaPrefix(st.hue)}${look === 'idle' ? (sim.memory.void ? 0.18 : 0.1) : 0.14})`;
    ctx.lineWidth = Math.max(1, H * 0.003);
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    if (fill > 0) {
      const n = RING_SEGS / 2, lit = fill * n, band = VOID.band * H;
      ctx.lineCap = 'butt';
      for (let i = 0; i < Math.ceil(lit - 1e-9); i++) {
        const q = clamp(lit - i);
        for (const sgn of [1, -1]) {
          // angles from the top (0) round to the bottom (π) on each side
          const a0 = (i / n) * Math.PI + 0.03, a1 = ((i + q) / n) * Math.PI - 0.03;
          const [b0, b1] = down ? [a0, a1] : [Math.PI - a1, Math.PI - a0];
          if (b1 <= b0) continue;
          const toCanvas = (a: number) => -Math.PI / 2 + sgn * a;
          const s0 = toCanvas(b0), s1 = toCanvas(b1);
          ctx.beginPath();
          ctx.ellipse(c.x, c.y, rx, ry, 0, Math.min(s0, s1), Math.max(s0, s1));
          const tone = i % 2 ? st.deep : st.hue;
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `${rgbaPrefix(st.hue)}.18)`;
          ctx.lineWidth = band * 2.2;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = `${rgbaPrefix(mix(tone, '#ffffff', 0.3))}${(look === 'lit' ? 0.62 : 0.8).toFixed(2)})`;
          ctx.lineWidth = band;
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.45)';
          ctx.lineWidth = Math.max(0.8, band * 0.18);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    if (look === 'current') {
      // the threshold as a dashed ellipse just outside the ring, gold while the light loads
      if (sim.pushBlock && !sim.blind) {
        ctx.save();
        ctx.lineWidth = Math.max(1, H * 0.003);
        if (sim.goldOn) ctx.strokeStyle = 'rgba(255,217,138,.75)';
        else {
          ctx.setLineDash([Math.max(2, H * 0.008), Math.max(3, H * 0.012)]);
          ctx.lineDashOffset = this.time * H * 0.01;
          ctx.strokeStyle = 'rgba(236,232,255,.34)';
        }
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, rx * 1.22, ry * 1.22, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    } else if (look === 'lit' && sim.lit.void & LIT_UP) this.thankRing(ctx, { x: c.x, y: c.y - ry }, litR(L));
  }

  /** The sacrum: a faint triangle waiting; pearl glass in five bands with the spiral of light drawing itself as it fills. */
  private drawSacrum(ctx: CanvasRenderingContext2D, sim: RzekiSim, look: Look): void {
    const L = this.L, H = L.fig.H, st = STATION.sacrum;
    const fill = look === 'current' ? sim.fill : look === 'lit' ? 1 : 0;
    const down = look !== 'current' || sim.dir === 'down';
    const map = (x: number, y: number): [number, number] => { const w = figPt(L, x, y); return [w.x, w.y]; };
    const tri = shapePath(SACRUM_PTS, map, false);
    const c = this.wp([0, SPIRAL.cy]);
    if (look === 'current') this.drawHalo(ctx, sim, 'sacrum', c, H * 0.04, 0.55);
    ctx.save();
    if (fill > 0) {
      ctx.save();
      ctx.clip(tri);
      // five bands of glass, lit from the top (down) or the bottom (up)
      for (let i = 0; i < BONE_BANDS; i++) {
        const k = pieceK(fill, down ? i : BONE_BANDS - 1 - i, BONE_BANDS);
        if (k <= 0) continue;
        const ya = 0.462 + (i / BONE_BANDS) * 0.066, yb = 0.462 + ((i + 1) / BONE_BANDS) * 0.066;
        const a = figPt(L, -0.04, ya), b = figPt(L, 0.04, yb);
        const g = ctx.createLinearGradient(0, a.y, 0, b.y);
        const tone = i % 2 ? st.rose.glass[2] : st.rose.glass[1];
        g.addColorStop(0, mix(tone, '#ffffff', 0.45));
        g.addColorStop(1, tone);
        ctx.globalAlpha = (look === 'lit' ? 0.7 : 0.9) * k;
        ctx.fillStyle = g;
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      }
      ctx.globalAlpha = 1;
      // the lead between the bands, and the little openings of the bone in pairs
      ctx.strokeStyle = 'rgba(34,28,70,.5)';
      ctx.lineWidth = Math.max(0.6, H * 0.0022);
      for (let i = 1; i < BONE_BANDS; i++) {
        const y = 0.462 + (i / BONE_BANDS) * 0.066, a = figPt(L, -0.04, y), b = figPt(L, 0.04, y);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.strokeStyle = `${rgbaPrefix(st.hue)}${look === 'idle' ? (sim.memory.sacrum ? 0.32 : 0.2) : 0.85})`;
    ctx.lineWidth = Math.max(1, H * 0.0032);
    ctx.lineJoin = 'round';
    ctx.stroke(tri);
    // the spiral of light: three and a half turns, drawn from the centre out as the light gathers (never a serpent)
    const k = look === 'idle' ? 0 : clamp(fill);
    if (k > 0.01) {
      const pts = spiralPts(k);
      const path = new Path2D();
      pts.forEach((p, i) => { const w = this.wp(p); if (i) path.lineTo(w.x, w.y); else path.moveTo(w.x, w.y); });
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(210,228,255,.3)';
      ctx.lineWidth = Math.max(2.4, H * 0.008);
      ctx.stroke(path);
      ctx.strokeStyle = 'rgba(255,255,255,.92)';
      ctx.lineWidth = Math.max(0.9, H * 0.0028);
      ctx.stroke(path);
      const tip = this.wp(pts[pts.length - 1]);
      glow(ctx, '#ffffff', tip.x, tip.y, H * 0.012, 0.8);
    }
    ctx.restore();
    if (look === 'lit') {
      glow(ctx, st.hue, c.x, c.y, H * 0.05, 0.3);
      if (sim.lit.sacrum & LIT_UP) this.thankRing(ctx, c, H * 0.05);
    }
  }

  /** A pane waiting for light: a ghost of its glass and its lead drawn in light (as a waiting rose window). */
  private ghostPane(ctx: CanvasRenderingContext2D, pts: readonly P[], smooth: boolean, hue: string): void {
    const L = this.L, H = L.fig.H;
    const map = (x: number, y: number): [number, number] => { const w = figPt(L, x, y); return [w.x, w.y]; };
    const path = shapePath(pts, map, smooth);
    ctx.fillStyle = `${rgbaPrefix(hue)}.14)`;
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(236,232,255,.5)';
    ctx.lineWidth = Math.max(0.6, H * 0.0016);
    ctx.stroke(path);
  }

  /** A pane of glass of figure points, filled with a colour from light at its middle to the colour at its edge, leaded. */
  private pane(ctx: CanvasRenderingContext2D, pts: readonly P[], smooth: boolean, hue: string, alpha: number, centre?: P): void {
    if (alpha <= 0.01) return;
    const L = this.L, H = L.fig.H;
    const map = (x: number, y: number): [number, number] => { const w = figPt(L, x, y); return [w.x, w.y]; };
    const path = shapePath(pts, map, smooth);
    const cx = centre ?? pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length] as P, [0, 0] as P);
    const c = this.wp(cx);
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, H * 0.04);
    g.addColorStop(0, mix(hue, '#ffffff', 0.6));
    g.addColorStop(0.6, mix(hue, '#ffffff', 0.15));
    g.addColorStop(1, hue);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fill(path);
    ctx.strokeStyle = 'rgba(30,20,58,.5)';
    ctx.lineWidth = Math.max(0.5, H * 0.0018);
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  /**
   * The hands: once lit, glass of the hand map in its colours with the seven points shining; opening, both hands
   * turn to glass in the map's order — 1 the wrist, 2 the thumb, 3 the middle finger, 4 the little finger, 5 the
   * index finger, 6 the ring finger, 7 the palm — each pane growing from its root, its light coming on when whole.
   */
  private drawHands(ctx: CanvasRenderingContext2D, sim: RzekiSim, look: Look): void {
    if (look === 'idle') return;
    const L = this.L, H = L.fig.H;
    const fill = look === 'current' ? sim.fill : 1;
    const alpha = look === 'lit' ? 0.5 : 0.92;
    if (look === 'current') for (const side of [-1, 1] as const) this.drawHalo(ctx, sim, 'hands', this.wp(palmCentre(side)), H * 0.045, 0.35);
    for (const side of [-1, 1] as const) {
      const shapes = handShapes(side);
      // the hand's whole tracery waits as a ghost of glass, like a rose window's lead: it reads as a hand of glass
      if (look === 'current') {
        for (const sh of shapes) this.ghostPane(ctx, sh.pts, sh.smooth, HAND_COLOURS[sh.part]);
        const w = this.wp(handPoint('wrist', side));
        glow(ctx, HAND_COLOURS.wrist, w.x, w.y, H * 0.012, 0.25);
      }
      HAND_ORDER.forEach((part, i) => {
        const k = pieceK(fill, i, HAND_ORDER.length);
        if (k <= 0) return;
        const hue = HAND_COLOURS[part];
        if (part === 'wrist') {
          const w0 = handPoint('wrist', side), a = this.wp(w0);
          glow(ctx, hue, a.x, a.y, H * 0.016 * (0.5 + 0.5 * k), 0.7 * k);
        } else if (part === 'palm') {
          const palmShape = shapes.find(s => s.part === 'palm')!;
          this.pane(ctx, palmShape.pts, true, hue, alpha * k, palmCentre(side));
        } else {
          const f = finger(part, side);
          const tip: P = [f.a[0] + (f.b[0] - f.a[0]) * k, f.a[1] + (f.b[1] - f.a[1]) * k];
          const cap = capsulePts(f.a, tip, f.r * 0.92);
          this.pane(ctx, cap, false, hue, alpha, tip);
        }
        // the point's light, once its pane is whole
        if (k >= 1) {
          const p = this.wp(handPoint(part, side));
          glow(ctx, hue, p.x, p.y, H * (look === 'lit' ? 0.012 : 0.016), look === 'lit' ? 0.75 : 0.95);
          glow(ctx, '#ffffff', p.x, p.y, H * 0.005, 0.85);
        }
      });
      if (look === 'lit' && sim.lit.hands & LIT_UP) {
        const c = this.wp(palmCentre(side));
        this.thankRing(ctx, c, H * 0.06);
      }
    }
  }

  /** The feet: copper glass from the instep to the toes (the big toe first), the soles lighting the ground under them. */
  private drawFeet(ctx: CanvasRenderingContext2D, sim: RzekiSim, look: Look): void {
    if (look === 'idle') return;
    const L = this.L, H = L.fig.H, st = STATION.feet;
    const fill = look === 'current' ? sim.fill : 1;
    const alpha = look === 'lit' ? 0.5 : 0.9;
    if (look === 'current') this.drawHalo(ctx, sim, 'feet', this.wp([0, 0.972]), H * 0.06, 0.35);
    for (const side of [-1, 1] as const) {
      if (look === 'current') for (const sh of footShapes(side)) this.ghostPane(ctx, sh.pts, sh.smooth, st.hue);
      // the sole's light on the ground, growing with the fill
      const sole = this.wp(soleAt(side));
      bloom(ctx, st.hue, sole.x, sole.y, H * (0.03 + 0.04 * fill), (look === 'lit' ? 0.35 : 0.5) * fill);
      footShapes(side).forEach((s, i) => {
        const k = pieceK(fill, i, 6);
        if (k <= 0) return;
        const hue = i === 0 ? st.hue : mix(st.hue, i % 2 ? '#ffd2a8' : st.deep, 0.25);
        this.pane(ctx, s.pts, s.smooth, hue, alpha * k);
      });
      if (look === 'lit' && sim.lit.feet & LIT_UP) this.thankRing(ctx, this.wp([side * 0.044, 0.972]), H * 0.04);
    }
  }

  /** The stream of living water on its way: a bright head with a soft spray (two heads along the arms or the legs). */
  private drawStream(ctx: CanvasRenderingContext2D, sim: RzekiSim): void {
    if (sim.stage !== 'flow' && sim.stage !== 'enter') return;
    const H = this.L.fig.H;
    for (const hd of this.streamHeads(sim)) {
      glow(ctx, WATER, hd.x, hd.y, H * 0.07, 0.75);
      glow(ctx, '#ffffff', hd.x, hd.y, H * 0.025, 0.9);
      if (sim.stage === 'enter' && sim.dir === 'down') glow(ctx, GOLD_HI, hd.x, hd.y, H * 0.12, 0.35);
    }
  }

  private drawDrops(ctx: CanvasRenderingContext2D): void {
    const spr = glowSprite(WATER);
    if (!spr || !this.drops.length) return;
    const H = this.L.fig.H;
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.drops) {
      if (d.big) {
        // a station's drop: its own colour around a bright core, a little trail of light above it
        const r = Math.max(3, H * 0.02);
        const hs = glowSprite(d.hue);
        if (hs) {
          ctx.globalAlpha = 0.9;
          ctx.drawImage(hs, d.x - r * 1.4, d.y - r * 2.2, 2.8 * r, 3.4 * r);
          ctx.globalAlpha = 0.35;
          ctx.drawImage(hs, d.x - r * 0.6, d.y - r * 4.6, 1.2 * r, 3.6 * r);
        }
        ctx.globalAlpha = 0.95;
        ctx.drawImage(spr, d.x - r * 0.5, d.y - r * 0.7, r, 1.4 * r);
        continue;
      }
      const r = Math.max(2, H * 0.011);
      ctx.globalAlpha = 0.85;
      ctx.drawImage(spr, d.x - r, d.y - r * 1.3, 2 * r, 2.6 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawMotes(ctx: CanvasRenderingContext2D): void {
    const spr = glowSprite(PEARL);
    if (!spr) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      ctx.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(m.ph * 1.7));
      const r = m.r * 2.2;
      ctx.drawImage(spr, m.x - r, m.y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** A blind block: a soft veil of night over the figure (the light gathers unseen). */
  private drawVeil(ctx: CanvasRenderingContext2D): void {
    const L = this.L;
    ctx.fillStyle = 'rgba(6,4,22,.32)';
    if (L.desk) {
      // a desktop: over the figure's side of the band, fading out before the words beside it (no seam in the sky)
      const x1 = Math.max(1, L.prayer.x - 10 * L.u), x0 = Math.max(0, x1 - 140 * L.u);
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, 'rgba(6,4,22,.32)');
      g.addColorStop(1, 'rgba(6,4,22,0)');
      ctx.fillRect(0, L.top, x0, L.bottom - L.top);
      ctx.fillStyle = g;
      ctx.fillRect(x0, L.top, x1 - x0, L.bottom - L.top);
    } else ctx.fillRect(0, L.top, L.w, L.prayer.y - L.top);
  }

  /** Every control the player can tap now (a story card, or the current station's area), for the audit. */
  targets(sim: RzekiSim): TapTarget[] {
    if (!sim.started) return [];
    const place = sim.stage === 'flow' ? sim.nextStation : sim.stage === 'whole' ? null : sim.station;
    return tapTargets(this.L, {
      story: sim.story ? (this.storyRect ?? this.L.story) : null, place, fill: sim.stage === 'at' || sim.stage === 'hold' ? sim.fill : 0, cam: this.cam,
    });
  }

  /** A point of the play for the runner's coach mark (screen px): the current station, the chest, the pool, the map column. */
  pointAt(what: 'place' | 'chest' | 'pool' | 'strip', sim: RzekiSim): { x: number; y: number } {
    const L = this.L, H = L.fig.H;
    if (what === 'strip') {
      const g = this.strip, i = MAP[sim.map].stations.indexOf(sim.station);
      return g && i >= 0 ? { x: g.xs + g.r * 2, y: g.ys[i] } : { x: L.strip.x + L.strip.w, y: L.strip.y + L.strip.h / 2 };
    }
    if (what === 'chest') { const w = figPt(L, 0, 0.27); return this.sp(w.x, w.y); }
    if (what === 'pool') { const w = figPt(L, 0, 0.98); return this.sp(w.x, w.y); }
    const pts = stationPts(sim.station).map(p => this.wp(p));
    const top = pts.reduce((a, b) => (a.y < b.y ? a : b));
    const r = (STATION[sim.station].kind === 'point' || STATION[sim.station].kind === 'shell' ? windowR(L, sim.fill, sim.station) : H * 0.05) * 1.3;
    return this.sp(pts.reduce((s, p) => s + p.x, 0) / pts.length, top.y - r);
  }
}

/** Where each shell's jewel sits on its line: the angle from its apex (low on the side, as picture 2 names them). */
const SHELL_MARK: Readonly<Record<'galactic' | 'gateway', number>> = { galactic: 0.64 * Math.PI, gateway: 0.69 * Math.PI };

/** How far from the midline a shell's name keeps off the figure at a height (figure units): the hands, the legs, the body. */
const figureHalf = (y: number): number => (y >= 0.45 && y <= 0.64 ? 0.24 : y > 0.64 ? 0.1 : 0.12);

/** The stations drawn as rose windows in play: the points on the midline and the shells' keystones. */
const windowed = (s: StationId): boolean => STATION[s].kind === 'point' || STATION[s].kind === 'shell';

/** Draw order: the big shapes under the windows (the Void's ring, the channels, the sacrum), then the hands and the feet, then the windows. */
function rankOf(s: StationId): number {
  const k = STATION[s].kind;
  return k === 'ring' ? 0 : k === 'channels' ? 1 : k === 'bone' ? 2 : k === 'hands' || k === 'feet' ? 3 : 4;
}

/** A capsule as figure points (a finger's pane growing from its root). */
function capsulePts(a: P, b: P, r: number): P[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const out: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = ang - Math.PI / 2 + (i / 8) * Math.PI;
    out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]);
  }
  for (let i = 0; i <= 6; i++) {
    const t = ang + Math.PI / 2 + (i / 6) * Math.PI;
    out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]);
  }
  return out;
}

/** The rivers' layers of light: (width × the ribbon's half-width, colour), widest and faintest first. */
const RIVER_LAYERS: readonly (readonly [number, string])[] = [
  [2.6, 'rgba(100,180,255,.06)'], [1.7, 'rgba(130,210,255,.1)'], [1, 'rgba(180,236,255,.2)'], [0.38, 'rgba(240,252,255,.3)'],
];

/** A ribbon along a centreline with a half-width at each point (× k): its left edge forward, its right edge back. */
function ribbon(c: readonly (readonly [number, number])[], hw: readonly number[], k: number): Path2D {
  const p = new Path2D();
  const n = c.length - 1;
  const side = (i: number, sgn: number): [number, number] => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n, i + 1)];
    const tx = b[0] - a[0], ty = b[1] - a[1], len = Math.hypot(tx, ty) || 1;
    return [c[i][0] - (ty / len) * hw[i] * k * sgn, c[i][1] + (tx / len) * hw[i] * k * sgn];
  };
  const [x0, y0] = side(0, 1);
  p.moveTo(x0, y0);
  for (let i = 1; i <= n; i++) p.lineTo(...side(i, 1));
  for (let i = n; i >= 0; i--) p.lineTo(...side(i, -1));
  p.closePath();
  return p;
}
