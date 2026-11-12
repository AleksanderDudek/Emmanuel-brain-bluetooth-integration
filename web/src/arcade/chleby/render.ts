/**
 * Chleby i ryby's play view (v3): a terrace of the hillside above the Sea of Galilee seen from
 * behind the boy's basket — the lane of worn earth up the slope with its elements (pebble arrows,
 * the brook and its stepping stones, boulders), the tables of the hungry at the top with their
 * hunger bars, the gates across the lane (green, honey, grey, the jar, the disciples' gate, and the
 * golden gate whose arch is the band's gauge with the threshold notched at its top), the crowd of
 * breads running up, the champions, the gull waves waddling down and the gulls carrying bread
 * through the air, the glutton of a boss arena with its telegraphs, the boy with the basket of his
 * loadout and the champion's ring around it, the help button, Mirka on her post, and the row of
 * baskets of crumbs along the bottom.  Juice: recoil, flying numbers, crumbs and feathers, confetti,
 * a net sweeping, wind streaks, a small shake (none with reduced motion) and a hit-stop on the big
 * moments.  Words and cards are drawn by hud.ts; the runner draws the band's panel, the score and
 * the coach marks.
 */
import { fmtNum } from '../../i18n';
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { HINTS, bossName, buildName, cardName, dayName, dayText, hintFor, tierName } from './content';
import { placeOf, type Gate, type Gull, type Runner } from './field';
import { Hud } from './hud';
import { t } from './i18n';
import { ChlebyIntro } from './intro';
import {
  chlebyTargets, giantRect, helpRect, inRect, layout, laneX, revealGeo, scaleAt, toScreen, villageGeo, type Layout, type Rect,
} from './layout';
import type { ChlebyProgress, Teach } from './meta';
import {
  C, PALETTES, SANS, font, glow, paintBasket, paintBigBasket, paintBoy, paintGate, paintGoldGate, paintGrass, paintGull, paintGullWalk,
  paintLake, paintMist, paintPath, paintPelikan, paintSky, paintTable,
} from './paint';
import { RULES, fmtX, type ChlebySim, type SimEvent } from './sim';
import {
  label, paintBreadRunner, paintCamel, paintCart, paintCormorant, paintDiveShadow, paintDonkey, paintDustLine, paintGiant, paintGoat,
  paintHelpButton, paintHeron, paintJarGate, paintKoszIcon, paintPebbleChevron, paintRipples, paintRock, paintStone,
} from './sprites';

const TAU = Math.PI * 2;
/** A finger must travel this far (px) before a press becomes a drag (DESIGN §12: slop ≥ 10 px). */
const SLOP = 10;

const TXT = {
  thr: t('hud.thr'), bank: t('hud.bank'), climb: t('hud.climb'), fed: t('fx.fed'), peck: t('fx.peck'), help: t('hud.help'),
  shoo: t('fx.shoo'), wave: t('fx.wave'), fat: t('fx.fat'), sated: t('fx.sated'), disciples: t('fx.help'), embers: t('hud.embers'),
  basket: t('fx.basket'), restPass: t('fx.restPass'), brk: t('fx.break'), butt: t('fx.butt'), dive: t('fx.dive'), stab: t('fx.stab'),
  jar: t('fx.jar'), burst: t('fx.burst'), befriend: t('fx.befriend'), ram: t('fx.ram'), mission: t('fx.mission'), helpReady: t('fx.helpReady'),
  stun: t('fx.stun'),
};
const CONFETTI = ['#e5584a', '#f2c94c', '#fbf6e8', '#7fae5a', '#d65a8c'];

export type Hit =
  | { kind: 'press'; x: number }
  | { kind: 'drag'; x: number }
  | { kind: 'release' }
  | { kind: 'offer'; i: number }
  | { kind: 'go' }
  | { kind: 'story' }
  | { kind: 'help' }
  | { kind: 'pop' };

export class ChlebyView {
  readonly hud: Hud;
  private readonly ctx: CanvasRenderingContext2D;
  private L = layout(800, 600);
  private dpr = 1;
  private t = 0;
  private readonly parts = new Particles(500);
  private readonly shake: Shake;
  private readonly introScene = new ChlebyIntro();
  /**
   * The finger (or the mouse button) down on the field: where it came down, where it is, the aim it
   * steers.  On a touch screen the drag is relative, as in Mob Control: the basket moves with the
   * finger's sideways travel (a little faster), so the thumb can stay low and never covers the basket.
   */
  private hand: { id: number; x0: number; y0: number; x: number; y: number; last: number; moved: boolean; aim: number } | null = null;
  /** the help button under a finger (1 → 0), its shake when tapped before it is ready, its presence */
  private helpPress = 0;
  private helpShake = 0;
  private helpA = 1;
  /** how far the lane has slid right for a side sheet (px) */
  private slideX = 0;
  /** seconds of hit-stop left (the index slows the field while > 0) */
  hitStop = 0;
  /** the terrace slide: coming in (0..1) */
  private enter = 1;
  private readonly cheer = new Map<number, number>();
  private readonly gateFloat = new Map<number, { n: number; t: number }>();
  private feedAcc = 0;
  private feedAt = { x: 0, y: 0 };
  private feedT = 0;
  private snatchT = 0;
  private gulpAcc = 0;
  private ring = 0;
  private bankPop = 0;
  private mist = 0;
  private restK = 0;
  /** the net sweeping over the slope (1 → 0), the wind's streaks, the heron's stab */
  private net = 0;
  private stabT = 9;
  private helpPop = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean; insets: () => Insets; touch: boolean }) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    this.ctx = ctx;
    this.hud = new Hud(ctx);
    this.shake = new Shake(opts.reducedMotion);
    this.hud.resize(this.L);
  }

  resize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    this.L = layout(w, h, this.opts.insets());
    this.hud.resize(this.L);
  }

  get layout(): Layout { return this.L; }

  intro(dt: number, p: number, progress: ChlebyProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.L.w, this.L.h, dt, p, progress);
  }

  start(): void { this.t = 0; }

  // ── where things are ─────────────────────────────────────────────
  private P(x: number, y: number): { x: number; y: number; s: number } {
    const q = toScreen(this.L.lane, x, y);
    return { x: q.x, y: q.y + this.slideY(), s: q.s };
  }

  private slideY(): number {
    const L = this.L.lane;
    return -(1 - ease.outCubic(this.enter)) * (L.yB - L.yT) * 0.35;
  }

  /** The basket's place on screen. */
  private basketAt(sim: ChlebySim): { x: number; y: number } {
    const q = toScreen(this.L.lane, sim.x, 0);
    return { x: q.x, y: q.y - this.L.lane.boy * 0.15 };
  }

  /** Where a coach mark points (CSS px), or null when the thing is not on screen. */
  anchor(w: Teach, sim: ChlebySim): { x: number; y: number } | null {
    const q = this.anchorWorld(w, sim);
    return q ? { x: q.x + this.slideX, y: q.y } : null;
  }

  private anchorWorld(w: Teach, sim: ChlebySim): { x: number; y: number } | null {
    const f = sim.field, L = this.L;
    const gateAt = (g: Gate | undefined) => (g ? this.P(g.x, g.y) : null);
    switch (w) {
      case 'tap':
      case 'hold':
      case 'big': {
        const b = this.basketAt(sim);
        return { x: b.x, y: b.y - L.lane.boy * 1.3 };
      }
      case 'drag': return gateAt(f.gates.find(g => g.kind === 'mul'));
      case 'gold': {
        const q = gateAt(f.gold);
        return q ? { x: q.x, y: q.y - L.lane.su * q.s * 1.8 } : null;
      }
      case 'sub': return gateAt(f.gates.find(g => g.kind === 'sub'));
      case 'add': return gateAt(f.gates.find(g => g.kind === 'add'));
      case 'jar': return gateAt(f.gates.find(g => g.kind === 'jar'));
      case 'four': return gateAt(f.gates.find(g => g.kind === 'mul' && g.n >= 4));
      case 'gull': {
        const g = f.gulls.find(x => x.state === 'walk');
        return g ? this.P(g.x, g.y) : null;
      }
      case 'pelikan':
      case 'koziol':
      case 'czapla':
      case 'kormorany': return f.boss ? this.P(f.boss.x, Math.min(RULES.laneH, f.boss.y)) : null;
      case 'brook': return f.brook ? this.P(5, (f.brook.y0 + f.brook.y1) / 2) : null;
      case 'sprint': return f.pads[0] ? this.P(f.pads[0].x, (f.pads[0].y0 + f.pads[0].y1) / 2) : null;
      case 'rock': return f.rocks[0] ? this.P(f.rocks[0].x, f.rocks[0].y) : null;
      case 'burst':
      case 'osiol':
      case 'woz':
      case 'wielblad': {
        const r = f.runners.find(x => x.champ !== null);
        return r ? this.P(r.x, r.y) : null;
      }
      case 'help': {
        const h = L.help;
        return { x: h.x - this.slideX, y: h.y - h.r * 1.25 };
      }
      case 'pack': {
        const b = revealGeo(L, 4, false).box;
        return { x: b.x + b.w / 2 - this.slideX, y: b.y + 6 };
      }
      case 'rest': return { x: L.bank.x + L.bank.w / 2, y: L.bank.y - 4 };
    }
  }

  /** A coach mark's words for the hand the player has: taps and drags on a touch screen, keys as shortcuts otherwise. */
  hintText(w: Teach): string { return this.opts.touch ? HINTS[w] : hintFor(w, false); }

  /** A coach mark went up pointing at `at` (or the middle): the game's banners step aside from it. */
  hinted(at: { x: number; y: number } | null, sec: number): void { this.hud.marked(at?.y ?? this.L.cardY, sec); }

  // ── input ────────────────────────────────────────────────────────
  /**
   * A finger (or the mouse) on the canvas.  Down: a story card takes the tap; on the reveal any tap goes
   * on; on the village sheet a row builds and "Dalej" goes on; in a level the help button sends the
   * help, the giant loaf bursts, and anywhere else the basket fires a handful at once (the touch-down
   * answers at once) and pours while held.  Move: the basket follows — on a touch screen by the finger's
   * sideways travel past a 10 px slop (relative, so the thumb never covers the basket), with a mouse to
   * the pointer's x.
   */
  pointer(type: 'down' | 'move' | 'up', x: number, y: number, id: number, sim: ChlebySim): Hit | null {
    const L = this.L;
    if (type === 'down') {
      if (this.hud.storyOn) {
        this.hud.hideStory();
        return { kind: 'story' };
      }
      if (sim.stage === 'pack') return { kind: 'go' };
      if (sim.stage === 'card') {
        const v = villageGeo(L, sim.offers.length);
        const i = v.rows.findIndex(r => inRect(r, x, y));
        if (i >= 0) {
          this.hud.press(i);
          return { kind: 'offer', i };
        }
        if (inRect(v.go, x, y)) {
          this.hud.press(-1);
          return { kind: 'go' };
        }
        return null;
      }
      if (sim.stage === 'level' && sim.phase !== 'done') {
        if (inRect(helpRect(L), x, y)) {
          this.helpPress = 1;
          return { kind: 'help' };
        }
        const g = this.giantBox(sim);
        if (g && inRect(g, x, y)) return { kind: 'pop' };
      }
      this.hand = { id, x0: x, y0: y, x, y, last: x, moved: false, aim: sim.aim };
      return { kind: 'press', x: this.opts.touch ? sim.aim : this.laneAt(x) };
    }
    const d = this.hand;
    if (!d || id !== d.id) return null;
    if (type === 'move') {
      d.x = x;
      d.y = y;
      if (!this.opts.touch) return { kind: 'drag', x: this.laneAt(x) };
      if (!d.moved) {
        if (Math.abs(x - d.x0) < SLOP) return null;
        d.moved = true;
        d.last = d.x0 + Math.sign(x - d.x0) * SLOP;
      }
      d.aim = clamp(d.aim + ((x - d.last) * this.gain()) / L.lane.unit, RULES.edge, RULES.laneW - RULES.edge);
      d.last = x;
      return { kind: 'drag', x: d.aim };
    }
    this.hand = null;
    return { kind: 'release' };
  }

  release(): void { this.hand = null; }

  /** A screen x at the basket's row → lane x (u), the lane's slide taken off. */
  private laneAt(x: number): number { return clamp(laneX(this.L.lane, x - this.slideX), 0, RULES.laneW); }

  /** The relative drag's gain: the whole lane in about 60 % of the screen's width of thumb travel (never slower than 1:1). */
  private gain(): number { return clamp((2 * this.L.lane.hwB) / (0.6 * this.L.play.w), 1, 1.8); }

  /** The giant loaf's tap area (screen px), or null when none is on the lane or it is still by the basket. */
  private giantBox(sim: ChlebySim): Rect | null {
    const b = this.giantBody(sim);
    return b ? giantRect(this.L, b.x, b.y, b.r) : null;
  }

  private giantBody(sim: ChlebySim): { x: number; y: number; r: number } | null {
    const r = sim.field.runners.find(x => x.champ === 'olbrzym' && x.w > 0);
    if (!r) return null;
    const q = this.P(r.x, r.y);
    const S = this.L.lane.su * q.s;
    return { x: q.x + this.slideX, y: q.y - S, r: S * 1.5 + 8 };
  }

  /** Every control the player can tap now (ArcadeGame.targets): see layout.ts chlebyTargets. */
  targets(sim: ChlebySim): TapTarget[] {
    return chlebyTargets(this.L, {
      stage: sim.stage, idle: sim.phase === 'done' || this.hud.storyOn, offers: sim.offers.length, giant: this.giantBody(sim),
    });
  }

  /** The help button tapped before it is ready: it shakes, and its ribbon says how full it is for a moment. */
  helpWait(sim: ChlebySim): void {
    if (sim.helpReady) return;
    this.helpShake = 1;
  }

  // ── events ───────────────────────────────────────────────────────
  on(e: SimEvent, sim: ChlebySim): void {
    const hud = this.hud, L = this.L, u = L.u;
    switch (e.type) {
      case 'fire': {
        const b = this.basketAt(sim);
        if (e.champ) {
          // higher than the "ready" word, which may still be rising when the stream fires it at once
          hud.float(t('fx.go', { name: cardName(e.champ) }), b.x, b.y - L.lane.boy * 2.5, C.goldLight, 22, 1.4, 50);
          this.parts.burst(b.x, b.y - L.lane.boy * 0.6, 26, { color: C.gold, speed: 220, size: 3, life: 0.8, shape: 'spark' });
          this.shake.add(0.35);
          this.hitStop = Math.max(this.hitStop, 0.08);
        } else if (Math.random() < 0.3) this.parts.burst(b.x, b.y - L.lane.boy * 0.5, 2, { color: C.crumb, speed: 70, size: 1.8, life: 0.4, angle: -Math.PI / 2, spread: 1.2 });
        break;
      }
      case 'gate': {
        const key = e.kind === 'gold' ? 99 : Math.round(e.y * 10) * 100 + Math.round(e.x);
        const g = this.gateFloat.get(key) ?? { n: 0, t: 0 };
        g.n += e.made;
        this.gateFloat.set(key, g);
        const q = this.P(e.x, e.y);
        if (e.kind === 'gold' && e.n > 1) this.parts.burst(q.x, q.y - L.lane.su * q.s, 4, { color: C.goldLight, speed: 110, size: 2.2, life: 0.6, shape: 'spark', g: 60 });
        if (e.kind === 'add') {
          hud.float(`+${e.n}`, q.x, q.y - L.lane.su * q.s * 1.6, '#c9f2a8', 17, 0.9, 26);
          this.parts.burst(q.x, q.y - L.lane.su * q.s, 10, { color: C.greenLight, speed: 140, size: 2.4, life: 0.5 });
        }
        break;
      }
      case 'feed': {
        const q = this.P(e.x, RULES.laneH);
        this.feedAcc += e.n;
        this.feedAt = q;
        this.parts.burst(q.x, q.y - 6 * u, e.big ? 30 : 2, { color: C.crumb, speed: e.big ? 200 : 80, size: 2, life: 0.5, g: 200 });
        if (e.big) {
          hud.float(`+${e.n}`, q.x, q.y - 30 * u, C.goldLight, 26, 1.3, 40);
          this.shake.add(0.3);
          this.feedAcc = 0;
        }
        break;
      }
      case 'tableFed': {
        const q = this.P(e.x, RULES.laneH);
        this.cheer.set(e.table, 0);
        hud.float(TXT.fed, q.x, q.y - 40 * u, '#fff6e0', 22, 1.3, 30);
        this.parts.burst(q.x, q.y - 20 * u, 40, { color: CONFETTI[0], speed: 240, size: 3, life: 1.2, shape: 'square', g: 300 });
        this.parts.burst(q.x, q.y - 20 * u, 30, { color: CONFETTI[1], speed: 220, size: 3, life: 1.2, shape: 'square', g: 300 });
        this.shake.add(0.2);
        this.hitStop = Math.max(this.hitStop, 0.07);
        break;
      }
      case 'snatch': {
        const q = this.P(e.x, e.y);
        this.parts.burst(q.x, q.y - 8 * u * q.s, 3, { color: '#ffffff', speed: 90, size: 2, life: 0.6, g: 80 });
        this.snatchT -= 1;
        if (this.snatchT <= 0) {
          this.snatchT = 6;
          hud.float(`−${e.n}`, q.x, q.y - 16 * u, '#ffd0c8', 13, 0.7, 18);
        }
        break;
      }
      case 'peck': {
        const b = this.basketAt(sim);
        hud.float(TXT.peck, b.x, b.y - L.lane.boy * 1.4, '#ffd0c8', 18, 0.9, 24);
        this.parts.burst(b.x, b.y - L.lane.boy * 0.5, 8, { color: '#ffffff', speed: 120, size: 2.2, life: 0.6 });
        this.shake.add(0.25);
        break;
      }
      case 'shoo': {
        const q = this.P(e.x, e.y);
        if (Math.random() < 0.4) hud.float(TXT.shoo, q.x, q.y - 20 * u, '#e6f3f8', 13, 0.8, 22);
        break;
      }
      case 'wave': {
        const q = this.P(e.x, RULES.laneH - 1);
        hud.float(e.fat ? TXT.fat : TXT.wave, q.x, q.y + 10 * u, '#ffffff', e.fat ? 20 : 16, 1.1, 18);
        break;
      }
      case 'gulp': {
        this.gulpAcc += e.n;
        const B = sim.field.boss;
        if (B && this.gulpAcc >= 5) {
          const q = this.P(e.x, Math.min(RULES.laneH, e.y));
          hud.float(`+${this.gulpAcc}`, q.x + 20 * u, q.y - L.lane.su * q.s * 2.4, '#ffd08a', 14, 0.8, 20);
          this.gulpAcc = 0;
        }
        break;
      }
      case 'boss':
        hud.showBanner(bossName(e.kind), HINTS[e.kind], true, 2.6);
        break;
      case 'aim':
        if (e.kind === 'koziol') {
          const q = this.P(e.x, e.y);
          this.parts.burst(q.x, q.y, 8, { color: '#c8a77a', speed: 70, size: 2.4, life: 0.6, g: 40 });
        }
        break;
      case 'butt': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.butt, q.x, q.y - 30 * u, '#ffe2b0', 20, 0.9, 28);
        this.parts.burst(q.x, q.y - 10 * u, 14, { color: '#c8a77a', speed: 160, size: 2.6, life: 0.6 });
        this.shake.add(0.3);
        this.hitStop = Math.max(this.hitStop, 0.06);
        break;
      }
      case 'stab': {
        const q = this.P(e.x, e.y);
        this.stabT = 0;
        if (Math.random() < 0.35) hud.float(TXT.stab, q.x, q.y - 20 * u, '#e6f3f8', 14, 0.7, 20);
        break;
      }
      case 'dive': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.dive, q.x, q.y - 26 * u, '#d9f1f8', 20, 0.9, 26);
        this.parts.burst(q.x, q.y - 6 * u, 24, { color: '#cfe9f2', speed: 200, size: 2.6, life: 0.7, g: 260 });
        this.shake.add(0.2);
        break;
      }
      case 'sated': {
        const q = this.P(e.x, Math.min(RULES.laneH, e.y));
        hud.float(TXT.sated, q.x, q.y - 50 * u, '#ffd08a', 24, 1.5, 40);
        this.parts.burst(q.x, q.y - 30 * u, 50, { color: CONFETTI[1], speed: 260, size: 3, life: 1.3, shape: 'square', g: 300 });
        this.shake.add(0.35);
        this.hitStop = Math.max(this.hitStop, 0.09);
        break;
      }
      case 'spill': {
        const q = this.P(e.x, e.y);
        hud.float(`+${e.n}`, q.x, q.y - 30 * u, C.goldLight, 20, 1, 30);
        this.parts.burst(q.x, q.y - 14 * u, 20, { color: C.crumb, speed: 200, size: 2.6, life: 0.7 });
        break;
      }
      case 'swallow': {
        const q = this.P(e.x, e.y);
        this.parts.burst(q.x, q.y - 6 * u, 3, { color: e.jar ? C.crumb : C.greyLight, speed: 60, size: 2, life: 0.5 });
        break;
      }
      case 'break': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.brk, q.x, q.y - 30 * u, '#f3f3ee', 16, 0.9, 24);
        this.parts.burst(q.x, q.y - 10 * u, 18, { color: C.greyDark, speed: 180, size: 2.6, life: 0.7, shape: 'square' });
        this.shake.add(0.15);
        break;
      }
      case 'jarOpen': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.jar, q.x, q.y - 50 * u, C.goldLight, 20, 1.3, 30);
        this.parts.burst(q.x, q.y - 30 * u, 26, { color: C.gold, speed: 200, size: 2.6, life: 0.8, shape: 'spark' });
        this.hitStop = Math.max(this.hitStop, 0.06);
        break;
      }
      case 'befriend': {
        const q = this.P(e.x, e.y);
        hud.float(TXT.befriend, q.x, q.y - 40 * u, '#ffffff', 15, 1.2, 30);
        this.parts.burst(q.x, q.y - 20 * u, 8, { color: '#ffffff', speed: 120, size: 2, life: 0.7, g: -40 });
        break;
      }
      case 'burst': {
        const q = this.P(e.x, e.y);
        hud.float(`${TXT.burst} +${e.n}`, q.x, q.y - 40 * u, C.goldLight, 22, 1.2, 36);
        this.parts.burst(q.x, q.y - 16 * u, 40, { color: C.crumb, speed: 260, size: 3, life: 0.9 });
        this.parts.burst(q.x, q.y - 16 * u, 16, { color: C.gold, speed: 180, size: 2.5, life: 0.8, shape: 'spark' });
        this.shake.add(0.45);
        this.hitStop = Math.max(this.hitStop, 0.09);
        break;
      }
      case 'ram': {
        const q = this.P(e.x, e.y);
        if (e.n === 0) hud.float(TXT.stun, q.x, q.y - 50 * u, '#ffffff', 18, 1, 24);
        else if (Math.random() < 0.5) hud.float(TXT.ram, q.x, q.y - 30 * u, '#fff6e0', 14, 0.8, 22);
        this.parts.burst(q.x, q.y - 8 * u, 6, { color: '#ffffff', speed: 140, size: 2, life: 0.5 });
        break;
      }
      case 'helped': {
        this.helpPop = 1;
        if (e.id === 'siec') this.net = 1;
        if (e.id === 'wiatr') this.shake.add(0.15);
        hud.float(t('fx.go', { name: cardName(e.id) }), L.cardX, L.lane.yT + (L.lane.yB - L.lane.yT) * 0.35, C.goldLight, 22, 1.4, 36);
        break;
      }
      case 'helpReady': {
        // high over the button, clear of the dial's words beside the basket
        const h = L.help;
        hud.float(TXT.helpReady, h.x - this.slideX, h.y - h.r * 2.7, C.goldLight, 15, 1.4, 24);
        this.parts.burst(h.x - this.slideX, h.y, 14, { color: C.gold, speed: 140, size: 2.2, life: 0.7, shape: 'spark' });
        break;
      }
      case 'disciples':
        hud.float(TXT.disciples, L.cardX, L.lane.yT + 40 * u, '#fff6e0', 15, 2, 20);
        break;
      case 'cleared':
        if (sim.stage === 'climb') hud.showBanner(TXT.climb, '', false, 1.5);
        break;
      case 'terrace':
        this.enter = e.index > 0 ? 0 : 1;
        if (e.index > 0 && !e.arena) hud.showBanner(t('fx.terrace', { i: e.index + 1, of: e.of }), '', false, 1.6);
        this.cheer.clear();
        break;
      case 'levelStart': {
        this.enter = 0;
        const { chapter } = placeOf(e.level);
        const sub = e.terraces > 1 ? `${CHAPTER(chapter)} · ${t('fx.terrace', { i: 1, of: e.terraces })}` : CHAPTER(chapter);
        hud.showBanner(t('fx.level', { n: e.level + 1 }), sub, e.boss, 2.2);
        break;
      }
      case 'won':
        this.parts.burst(L.cardX, L.lane.yT + 20 * u, 60, { color: CONFETTI[3], speed: 300, size: 3, life: 1.5, shape: 'square', g: 300 });
        this.parts.burst(L.cardX, L.lane.yT + 20 * u, 60, { color: CONFETTI[4], speed: 300, size: 3, life: 1.5, shape: 'square', g: 300 });
        this.hitStop = Math.max(this.hitStop, 0.09);
        break;
      case 'bigReady': {
        const b = this.basketAt(sim);
        hud.float(t('fx.ready', { name: cardName(e.champ) }), b.x, b.y - L.lane.boy * 1.7, C.goldLight, 15, 1.6, 26);
        this.ring = 1;
        break;
      }
      case 'basket':
        this.bankPop = 1;
        hud.float(e.pass ? TXT.restPass : TXT.basket, L.bank.x + L.bank.w / 2, L.bank.y - 14 * u, '#fff6e0', 14, 1.2, 22);
        break;
      case 'blindPay':
        hud.float(t('fx.blindPay', { n: e.runners }), L.cardX, L.lane.yT + (L.lane.yB - L.lane.yT) * 0.45, C.goldLight, 20, 1.6, 30);
        break;
      case 'reinforce': {
        // beside the basket, clear of the banner and the champion's word
        const b = this.basketAt(sim);
        hud.float(t('fx.reinforce', { n: e.n }), b.x < L.w / 2 ? b.x + 80 * u : b.x - 80 * u, b.y - L.lane.boy * 1.4, '#fff6e0', 14, 1.2, 22);
        break;
      }
      case 'tier':
        hud.showBanner(t('fx.tier', { name: tierName(e.tier) }), '', false, 2.4);
        this.parts.burst(L.cardX, L.lane.yT + 40 * u, 50, { color: C.gold, speed: 280, size: 3, life: 1.4, shape: 'spark', g: 160 });
        break;
      case 'mission':
        // under the score corner, clear of the gates
        hud.float(TXT.mission, L.w - 110 * u, L.hudTop + 34 * u, '#c9f2a8', 17, 1.8, 26);
        break;
      case 'build':
        hud.float(t('fx.build', { name: buildName(e.b), n: e.level }), L.cardX, L.cardY - 90 * u, C.goldLight, 16, 1.5, 30);
        this.parts.burst(L.cardX, L.cardY - 60 * u, 30, { color: C.gold, speed: 220, size: 2.6, life: 1, shape: 'spark', g: 120 });
        break;
      case 'day':
        hud.showBanner(t('fx.day', { name: dayName(e.day) }), dayText(e.day), false, 3.2);
        break;
      case 'say':
        hud.say(e.who, e.text, e.dur);
        break;
      case 'story':
        hud.showStory(e.kind, e.chapter, e.boss);
        break;
      default:
        break;
    }
  }

  // ── a frame ──────────────────────────────────────────────────────
  update(dt: number, sim: ChlebySim): void {
    this.t += dt;
    this.hitStop = Math.max(0, this.hitStop - dt);
    // a side sheet slides the lane aside; the help button shows only while it can be pressed
    this.slideX = approach(this.slideX, this.L.sheet === 'side' && this.hud.sheetOn(sim) ? this.L.slide : 0, dt, 0.12);
    this.helpA = approach(this.helpA, sim.stage === 'level' && sim.phase !== 'done' ? 1 : sim.stage === 'pack' || sim.stage === 'card' ? 0 : 0.45, dt, 0.1);
    this.helpPress = Math.max(0, this.helpPress - dt * 5);
    this.helpShake = Math.max(0, this.helpShake - dt * 1.2);
    this.parts.update(dt);
    this.hud.update(dt, sim);
    this.enter = Math.min(1, this.enter + dt / 0.55);
    for (const [k, v] of this.cheer) this.cheer.set(k, v + dt);
    this.ring = Math.max(0, this.ring - dt * 0.8);
    this.bankPop = Math.max(0, this.bankPop - dt * 2.5);
    this.net = Math.max(0, this.net - dt / 1.2);
    this.helpPop = Math.max(0, this.helpPop - dt * 2);
    this.stabT += dt;
    this.mist = approach(this.mist, sim.blind ? 1 : 0, dt, 0.5);
    this.restK = approach(this.restK, sim.restBlock ? 1 : 0, dt, 0.6);
    // the numbers flying off the gates, gathered so a flood reads as one number
    for (const [k, g] of this.gateFloat) {
      g.t += dt;
      if (g.t >= 0.35 && g.n > 0) {
        const gate = k === 99 ? sim.field.gold : sim.field.gates.find(x => Math.round(x.y * 10) * 100 + Math.round(x.x) === k);
        if (gate && gate.kind !== 'add') {
          const q = this.P(gate.x, gate.y);
          const gold = gate.kind === 'gold';
          this.hud.float(`+${fmtNum(g.n)}`, q.x, q.y - this.L.lane.su * q.s * (gold ? 2.6 : 1.8), gold ? C.goldLight : '#ffe2b0', gold ? 18 : 14, 0.8, 24);
        }
        this.gateFloat.delete(k);
      } else if (g.t >= 0.35) this.gateFloat.delete(k);
    }
    // the tables' munching: one number per moment
    this.feedT += dt;
    if (this.feedT >= 0.45 && this.feedAcc > 0) {
      this.feedT = 0;
      this.hud.float(`+${fmtNum(this.feedAcc)}`, this.feedAt.x, this.feedAt.y - 26 * this.L.u, '#fff6e0', 15, 0.8, 22);
      this.feedAcc = 0;
    }
  }

  draw(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, u = L.u, t = this.t;
    const dt = 1 / 60;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = PALETTES[sim.field.plan.chapter % PALETTES.length];
    const sh = this.shake.offset(dt, 8 * u);
    ctx.save();
    ctx.translate(sh.x, sh.y);
    // the world behind
    paintSky(ctx, L.w, L.horizon, pal, t);
    paintLake(ctx, L.w, L.horizon, L.lakeD, pal, t);
    paintGrass(ctx, L.w, L.horizon + L.lakeD, L.h + 10, pal, t);
    // the hill's things slide aside together when a side sheet shows
    ctx.translate(this.slideX, 0);
    // the lane up the hill
    const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const y = (RULES.laneH + 0.6) * (i / 8);
      const a = toScreen(lane, -0.3, y), b = toScreen(lane, RULES.laneW + 0.3, y);
      left.push({ x: a.x, y: a.y }); right.push({ x: b.x, y: b.y });
    }
    left.unshift({ x: left[0].x - 6 * u, y: L.h }); right.unshift({ x: right[0].x + 6 * u, y: L.h });
    paintPath(ctx, [left, right], pal);
    // mown stripes across the lane (depth cues)
    ctx.strokeStyle = 'rgba(120,80,30,.08)';
    ctx.lineWidth = 2;
    for (let y = 2; y < RULES.laneH; y += 2) {
      const a = toScreen(lane, 0, y), b = toScreen(lane, RULES.laneW, y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    this.drawGround(sim);
    this.drawField(sim);
    this.drawBank(sim);
    this.drawBoy(sim);
    this.drawMirka(sim);
    this.drawWind(sim);
    this.parts.draw(ctx);
    this.hud.drawWorld();
    ctx.translate(-this.slideX, 0);
    this.drawHelp(sim);
    this.drawHand(sim);
    ctx.restore();
    const b = this.basketAt(sim), m = this.mirkaAt();
    this.hud.draw(sim, { mirka: { x: m.x + this.slideX, y: m.y }, boy: { x: b.x + this.slideX, y: b.y - lane.boy * 0.9 } }, [helpRect(L)]);
  }

  // ── the ground: pebble arrows, the brook and its stones, the telegraphs ──
  private drawGround(sim: ChlebySim): void {
    const ctx = this.ctx, lane = this.L.lane, f = sim.field, t = this.t;
    ctx.save();
    ctx.globalAlpha = clamp(this.enter * 1.5);
    const b = f.brook;
    if (b) {
      const a = this.P(-0.3, b.y0), c = this.P(RULES.laneW + 0.3, b.y0), d = this.P(RULES.laneW + 0.3, b.y1), e = this.P(-0.3, b.y1);
      const g = ctx.createLinearGradient(0, d.y, 0, a.y);
      g.addColorStop(0, '#5a9fb8');
      g.addColorStop(1, '#3f86a6');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(a.x - 4, a.y + 3);
      ctx.lineTo(c.x + 4, c.y + 3);
      ctx.lineTo(d.x + 4, d.y - 2);
      ctx.lineTo(e.x - 4, e.y - 2);
      ctx.closePath();
      ctx.fill();
      // the current: streaks moving its way
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const fy = b.y0 + ((i * 0.37) % 1) * (b.y1 - b.y0);
        const fx = ((((i * 1.7 + t * b.speed * b.dir * 0.8) % RULES.laneW) + RULES.laneW) % RULES.laneW);
        const p = this.P(fx, fy), q = this.P(fx + 0.9 * b.dir, fy);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }
    }
    for (const pad of f.pads) {
      const inBrook = b && pad.y0 < b.y1 && pad.y1 > b.y0;
      for (let y = pad.y0 + 0.3; y <= pad.y1 - 0.2; y += inBrook ? 0.55 : 0.8) {
        const q = this.P(pad.x, y);
        const w = pad.half * 2 * lane.unit * q.s * 0.75, S = lane.su * q.s;
        if (inBrook) {
          for (const k of [-0.3, 0.3]) paintStone(ctx, q.x + k * w * 0.6, q.y + (y * 7 % 2 - 1) * S * 0.05, S * 0.32, S * 0.16);
        } else paintPebbleChevron(ctx, q.x, q.y, w, S, 0.5 + 0.5 * Math.sin(t * 6 - y));
      }
    }
    // the gluttons' telegraphs, on the ground
    const B = f.boss;
    if (B && B.state === 'act' && !B.doze) {
      if (B.kind === 'koziol' && B.phase === 'aim') {
        const a = this.P(B.tx, B.y - 0.8), c = this.P(B.tx, RULES.koziolLow);
        paintDustLine(ctx, a.x, a.y, c.x, c.y, lane.su * a.s * 0.55, clamp(B.pt / RULES.koziolAim), t);
      }
      if (B.kind === 'czapla' && B.phase === 'ripple') {
        const q = this.P(B.tx, B.y);
        paintRipples(ctx, q.x, q.y, lane.su * q.s, clamp(B.pt / RULES.czaplaRipple), t);
      }
      if (B.kind === 'kormorany') {
        for (const w of B.birds) {
          if (w.state !== 'aim' && w.state !== 'dive') continue;
          const q = this.P(w.tx, w.ty);
          const S = lane.unit * q.s;
          paintDiveShadow(ctx, q.x, q.y, RULES.diveR * S, RULES.diveR * S * 0.42, w.state === 'dive' ? 1 : clamp(w.t / RULES.kormoranAim), t);
        }
      }
    }
    ctx.restore();
  }

  // ── the field ────────────────────────────────────────────────────
  private drawField(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, t = this.t, f = sim.field;
    const fade = sim.stage === 'climb' ? 1 - clamp(sim.stageT / RULES.climb) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, fade * clamp(this.enter * 1.5));
    // the tables at the top
    for (const tb of f.tables) {
      const q = this.P(tb.x, RULES.laneH);
      const w = tb.half * 2 * lane.unit * q.s;
      const S = lane.su * q.s;
      paintTable(ctx, q.x, q.y - S * 0.2, w, S, {
        seed: tb.id + f.plan.level * 7 + f.plan.index * 3, hunger: tb.hunger, full: tb.full, fed: tb.fed, bite: tb.bite,
        cheer: this.cheer.get(tb.id) ?? 9, rest: sim.restBlock, t, label: fmtNum(Math.max(0, Math.ceil(tb.hunger))),
      });
    }
    // everything on the lane, far to near
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const g of f.gates) items.push({ y: g.y + 0.01, draw: () => this.drawGate(g, sim) });
    for (const k of f.rocks) {
      items.push({
        y: k.y, draw: () => {
          const q = this.P(k.x, k.y);
          const rx = k.r * lane.unit * q.s;
          paintRock(ctx, q.x, q.y, rx, rx * 0.62);
        },
      });
    }
    for (const g of f.gulls) items.push({ y: g.y, draw: () => this.drawGull(g) });
    for (const r of f.runners) if (r.w > 0) items.push({ y: r.y, draw: () => this.drawRunner(r, sim) });
    const B = f.boss;
    if (B) items.push({ y: Math.min(RULES.laneH, B.y), draw: () => this.drawBoss(sim) });
    items.sort((a, b) => b.y - a.y);
    for (const it of items) it.draw();
    // the gulls carrying bread fly over it all
    for (const c of f.carriers) {
      const q = this.P(c.x, Math.min(c.y, RULES.laneH + 6));
      const S = lane.su * scaleAt(lane, Math.min(c.y, RULES.laneH));
      paintGull(ctx, q.x, q.y - S * 1.2, S * 0.85, { flap: t * 14 + c.id, dir: c.x0 < (f.tables[c.table]?.x ?? 5) ? 1 : -1, mirka: c.from === 'mewy' && c.id % 5 === 0, carry: true });
    }
    // the net sweeping over the slope
    if (this.net > 0) {
      const k = 1 - this.net;
      const q0 = this.P(-1 + k * 12, 4), q1 = this.P(-1 + k * 12, RULES.laneH - 1);
      ctx.strokeStyle = 'rgba(216,196,154,.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const y = q0.y + (q1.y - q0.y) * (i / 6);
        ctx.moveTo(q0.x - 30 * L.u, y);
        ctx.lineTo(q0.x + 30 * L.u, y + 6);
      }
      for (let i = -2; i <= 2; i++) {
        ctx.moveTo(q0.x + i * 14 * L.u, q0.y);
        ctx.lineTo(q1.x + i * 10 * L.u, q1.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBoss(sim: ChlebySim): void {
    const ctx = this.ctx, lane = this.L.lane, t = this.t, B = sim.field.boss;
    if (!B) return;
    const pouchLabel = (x: number, y: number, S: number) => {
      if (B.state === 'sated' || B.pouch <= 0) return;
      label(ctx, fmtNum(B.pouch), x, y, Math.max(11, S * 0.5), '#ffd08a', 'rgba(90,40,0,.8)');
    };
    switch (B.kind) {
      case 'pelikan': {
        const q = this.P(B.x, B.y);
        const S = lane.su * q.s * 1.25;
        paintPelikan(ctx, q.x, q.y, S, { pouch: 1 - B.pouch / Math.max(1, B.full), gulp: clamp(1 - B.gulp * 4), t, leaving: B.state === 'sated' });
        pouchLabel(q.x, q.y - S * 2.4, S);
        break;
      }
      case 'koziol': {
        const q = this.P(B.x, Math.min(RULES.laneH, B.y));
        const S = lane.su * q.s * 1.2;
        paintGoat(ctx, q.x, q.y, S, {
          t, aim: B.phase === 'aim' ? clamp(B.pt / RULES.koziolAim) : 0, charge: B.phase === 'charge', doze: B.doze, sated: B.state === 'sated', gulp: B.gulp, stun: B.stun,
        });
        pouchLabel(q.x, q.y - S * 2.1, S);
        break;
      }
      case 'czapla': {
        const q = this.P(B.x, Math.min(RULES.laneH + 4, B.y));
        const S = lane.su * q.s * 1.2;
        paintHeron(ctx, q.x, q.y, S, { t, dir: B.dir, stab: this.stabT < 0.25 ? Math.sin((this.stabT / 0.25) * Math.PI) : 0, doze: B.doze, sated: B.state === 'sated', stun: B.stun });
        pouchLabel(q.x, q.y - S * 2.2, S);
        break;
      }
      case 'kormorany': {
        for (const w of B.birds) {
          const air = w.state === 'air' || w.state === 'aim' || w.state === 'rise';
          const q = this.P(w.x, Math.min(w.y, RULES.laneH + 3));
          const S = lane.su * scaleAt(lane, Math.min(w.y, RULES.laneH)) * (air ? 0.8 : 1.15);
          paintCormorant(ctx, q.x, q.y - (air ? S * 2 : 0), S, { state: B.state === 'sated' ? 'air' : w.state, t, side: w.side });
        }
        const top = this.P(5, RULES.laneH);
        pouchLabel(top.x, top.y - lane.su * top.s * 3.3, lane.su * top.s * 1.2);
        break;
      }
    }
  }

  private drawGate(g: Gate, sim: ChlebySim): void {
    const ctx = this.ctx, lane = this.L.lane;
    const q = this.P(g.x, g.y);
    const S = lane.su * q.s;
    const w = g.half * 2 * lane.unit * q.s;
    if (g.kind === 'gold') {
      const b = sim.block;
      const mode = sim.phase !== 'play' || b.kind === 'warmup' ? 'off' : sim.blind ? 'blind' : b.kind === 'rest' ? 'rest' : sim.sighted ? 'live' : 'wait';
      const S2 = S * 1.2;
      paintGoldGate(ctx, q.x, q.y, w, S2, { mult: fmtX(sim.gold), level: sim.focus, mode, flash: g.flash, t: this.t, thr: this.L.mode === 'short' ? '' : TXT.thr, reliable: sim.reliable });
      if (this.mist > 0.02) paintMist(ctx, q.x - w * 0.8, q.y - S2 * 3, w * 1.6, S2 * 3.2, this.t, this.mist);
      return;
    }
    if (g.kind === 'jar') {
      paintJarGate(ctx, q.x, q.y, w, S, { fill: g.open > 0 ? 1 : 1 - g.left / Math.max(1, g.need), open: g.open, label: g.open > 0 ? `×${RULES.jarMult}` : `−${g.left}`, flash: g.flash, t: this.t });
      return;
    }
    const look = g.kind === 'start' || g.kind === 'help' ? 'start' : g.kind;
    const text = g.kind === 'sub' ? `−${g.left}` : g.kind === 'add' ? `+${g.n}` : `×${g.n}`;
    ctx.save();
    if (g.kind === 'add' && g.charge < 1) ctx.globalAlpha *= 0.45 + 0.4 * g.charge;
    if (g.kind === 'help') {
      ctx.globalAlpha *= clamp(g.life / 1.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, q.x, q.y - S, w * 0.8, C.goldGlow, 0.3 + 0.1 * Math.sin(this.t * 7));
      ctx.restore();
    }
    paintGate(ctx, q.x, q.y, w, S, look, text, g.flash, g.kind === 'sub' ? g.down : 0);
    ctx.restore();
  }

  private drawGull(g: Gull): void {
    const ctx = this.ctx, lane = this.L.lane;
    const q = this.P(g.x, g.y);
    const S = lane.su * q.s;
    if (g.state === 'fly') {
      const k = clamp(g.t / 1.6);
      ctx.save();
      ctx.globalAlpha *= 1 - k * 0.8;
      paintGull(ctx, q.x, q.y - S * (0.8 + k * 2), S * 0.9, { flap: this.t * 14, dir: g.dir, mirka: g.kind === 'mirka', carry: g.carry });
      ctx.restore();
      return;
    }
    paintGullWalk(ctx, q.x, q.y, S, { kind: g.kind, step: this.t * 9 + g.id, doze: g.state === 'doze', t: this.t });
  }

  private drawRunner(r: Runner, sim: ChlebySim): void {
    const ctx = this.ctx, lane = this.L.lane;
    const q = this.P(r.x, r.y);
    const S = lane.su * q.s;
    switch (r.champ) {
      case 'kosz': paintBigBasket(ctx, q.x, q.y, S, { step: r.age * 10, w: r.w, t: this.t }); return;
      case 'osiol': paintDonkey(ctx, q.x, q.y, S, { step: r.age * 9, t: this.t, worth: r.w }); return;
      case 'woz': paintCart(ctx, q.x, q.y, S, { step: r.age * 14, t: this.t, worth: r.w }); return;
      case 'olbrzym': paintGiant(ctx, q.x, q.y, S, { step: r.age * 9, t: this.t, fuse: r.fuse / RULES.champ.olbrzym.fuse, burst: r.burst }); return;
      case 'wielblad': paintCamel(ctx, q.x, q.y, S, { step: r.age * 6, t: this.t, worth: r.w }); return;
      default: break;
    }
    const gold = sim.sighted && (r.mask & (1 << sim.field.gold.id)) !== 0 && sim.gold > 1;
    paintBreadRunner(ctx, q.x, q.y, S, { look: r.look, step: r.age * (r.speed * 3.5) + r.id, w: r.w, gold, warm: r.warm, tumble: r.tumble, t: this.t });
  }

  // ── the wind off the lake ────────────────────────────────────────
  private drawWind(sim: ChlebySim): void {
    const f = sim.field;
    if (f.wind <= 0) return;
    const ctx = this.ctx, L = this.L, t = this.t;
    const k = clamp(f.wind / 1.2);
    ctx.save();
    ctx.globalAlpha = 0.5 * k;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = ((i * 97 + t * 40) % (L.w + 80)) - 40;
      const y = L.lane.yT + (((i * 53) % 100) / 100) * (L.lane.yB - L.lane.yT);
      const dy = ((t * 220 + i * 37) % 160) - 80;
      ctx.beginPath();
      ctx.moveTo(x, y + dy);
      ctx.quadraticCurveTo(x + 6, y + dy - 20, x, y + dy - 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── the help button ──────────────────────────────────────────────
  private drawHelp(sim: ChlebySim): void {
    if (sim.phase === 'done' || this.helpA < 0.02) return;
    const ctx = this.ctx, h = this.L.help;
    const pop = 1 + 0.25 * ease.outCubic(this.helpPop);
    const shake = this.opts.reducedMotion ? 0 : Math.sin(this.t * 60) * 4 * clamp(this.helpShake * 3 - 2);
    ctx.save();
    ctx.globalAlpha = this.helpA;
    // tapped too early, the ribbon says how full it is instead of its name
    const label = this.helpShake > 0 && !sim.helpReady ? t('pct', { n: Math.round(sim.helpCharge * 100) }) : TXT.help;
    paintHelpButton(ctx, h.x + shake, h.y, h.r * pop, {
      id: sim.pomoc, charge: sim.helpCharge, ready: sim.helpReady, t: this.t, label, u: this.L.u, press: this.helpPress,
    });
    ctx.restore();
  }

  /**
   * A finger on a touch screen steering the basket: a short track under it with the knob at the finger,
   * so the sideways drag reads as a slider (the finger covers the knob, never the basket).
   */
  private drawHand(sim: ChlebySim): void {
    const d = this.hand;
    if (!d || !this.opts.touch || sim.stage !== 'level' || !sim.pressing) return;
    const ctx = this.ctx, u = this.L.u;
    const half = 64 * u, y = d.y0;
    const kx = clamp(d.x, d.x0 - half, d.x0 + half);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'rgba(40,25,10,.45)';
    ctx.beginPath();
    ctx.roundRect(d.x0 - half - 8 * u, y - 7 * u, 2 * half + 16 * u, 14 * u, 7 * u);
    ctx.fill();
    ctx.strokeStyle = '#fff6e0';
    ctx.lineWidth = 2.5 * u;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (const s of [-1, 1]) {
      const ax = d.x0 + s * (half - 2 * u);
      ctx.moveTo(ax - s * 6 * u, y - 5 * u);
      ctx.lineTo(ax, y);
      ctx.lineTo(ax - s * 6 * u, y + 5 * u);
    }
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(kx, y, 13 * u, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  // ── the boy and his basket-cannon ────────────────────────────────
  private drawBoy(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, lane = L.lane, u = L.u;
    const b = this.basketAt(sim);
    const boy = lane.boy;
    const recoil = clamp(1 - sim.shotT / 0.12);
    const jam = sim.jam > 0 ? Math.sin(this.t * 40) * 3 * u : 0;
    // the aim: a soft dotted line up the lane while pouring
    if (sim.pressing && sim.stage === 'level') {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,246,224,.55)';
      ctx.lineWidth = 2 * u;
      ctx.setLineDash([4 * u, 6 * u]);
      ctx.beginPath();
      const a = toScreen(lane, sim.x, 1), c = toScreen(lane, sim.x, 7);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
    paintBoy(ctx, b.x + jam, b.y + boy * 0.35, boy, { toss: recoil, t: this.t, walk: sim.x });
    // the champion's ring around the basket: it fills with a held focus (and slowly with pouring)
    const by = b.y - boy * 0.25 - recoil * boy * 0.12;
    const R = boy * 0.95;
    const ready = sim.bigReady;
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, b.x, by, R * 2.2, C.goldGlow, 0.35 + 0.15 * Math.sin(this.t * 6) + this.ring * 0.4);
      ctx.restore();
    }
    ctx.lineWidth = Math.max(4, 5 * u);
    ctx.strokeStyle = 'rgba(60,40,15,.38)';
    ctx.beginPath();
    ctx.arc(b.x, by, R, 0, TAU);
    ctx.stroke();
    if (sim.charge > 0.004) {
      ctx.strokeStyle = ready ? C.gold : '#f3d27a';
      ctx.beginPath();
      ctx.arc(b.x, by, R, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.charge));
      ctx.stroke();
    }
    // the basket of the loadout
    if (sim.kosz === 'mama') paintBasket(ctx, b.x + jam, by, boy * 0.62, { fill: ready ? 1 : 0.75, gold: ready });
    else paintKoszIcon(ctx, sim.kosz, b.x + jam, by + boy * 0.05, boy * 0.78, this.t);
    // the oven's embers: a small arc under it
    if (sim.kosz === 'piec' && sim.ovenMax > 0) {
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.strokeStyle = 'rgba(60,30,10,.35)';
      ctx.beginPath();
      ctx.arc(b.x, by, R * 0.72, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.strokeStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(b.x, by, R * 0.72, Math.PI * 0.8 - Math.PI * 0.6 * clamp(sim.embers / sim.ovenMax), Math.PI * 0.8);
      ctx.stroke();
    }
    // the dial's words on a plate beside the ring, on the side with more room: the champion and how full
    if (sim.stage !== 'level' && sim.stage !== 'climb') return;
    const lines = [ready ? t('fx.ready', { name: cardName(sim.mistrz) }) : t('hud.ring', { name: cardName(sim.mistrz), n: Math.round(clamp(sim.charge) * 100) })];
    if (sim.kosz === 'piec') lines.push(`${TXT.embers} ${Math.ceil(sim.embers)}\u00a0s`);
    const px = 13 * u, lh = px + 3 * u;
    ctx.font = font(800, px, SANS);
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    const pw = tw + 14 * u, ph = lines.length * lh + 7 * u;
    const right = b.x + this.slideX < L.w / 2;
    const px0 = right ? Math.min(b.x + R + 8 * u, L.w - this.slideX - pw - 6) : Math.max(b.x - R - 8 * u - pw, 6 - this.slideX);
    const py0 = by - ph / 2;
    ctx.fillStyle = ready ? 'rgba(120,80,10,.82)' : 'rgba(50,32,14,.62)';
    ctx.beginPath();
    ctx.roundRect(px0, py0, pw, ph, ph / 2 > 12 * u ? 10 * u : ph / 2);
    ctx.fill();
    ctx.fillStyle = ready ? '#fff3c0' : '#fff6e0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, px0 + 7 * u, py0 + 3.5 * u + lh * (i + 0.5)));
  }

  // ── Mirka on her post ────────────────────────────────────────────
  private mirkaAt(): { x: number; y: number } {
    const p = this.L.perch;
    return { x: p.x, y: p.y - this.L.lane.boy * 1.9 };
  }

  private drawMirka(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, p = L.perch, boy = L.lane.boy;
    const postH = boy * 1.2;
    ctx.fillStyle = C.postDark;
    ctx.fillRect(p.x - 3, p.y - postH, 6, postH);
    ctx.fillStyle = C.post;
    ctx.fillRect(p.x - 3, p.y - postH, 3, postH);
    // she is out leading a wave: the post is empty
    if (sim.field.gulls.some(g => g.kind === 'mirka' && g.state !== 'fly' && g.state !== 'gone')) return;
    // the lake's wind: she holds on
    const blow = sim.field.wind > 0 ? Math.sin(this.t * 20) * 0.3 : 0;
    paintGullWalk(ctx, p.x + blow * 3, p.y - postH, boy * 0.95, { kind: 'mirka', step: Math.sin(this.t * 2) * 0.5 + blow, doze: this.restK > 0.6, t: this.t });
  }

  // ── the bank: twelve baskets of crumbs ───────────────────────────
  /**
   * The row of twelve baskets of crumbs (the signal in sight for calm): a wicker shelf along the bottom
   * of an upright phone, two rows of six in the left column on its side, under the lane on a desktop;
   * the pantry's count on a plate beside it.
   */
  private drawBank(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, B = L.bank, u = L.u;
    const n = 12, cw = B.w / B.cols, rh = B.h / B.rows;
    const r = Math.min(cw * 0.42, rh * 0.62);
    const filled = Math.min(n, sim.basketsNow);
    const pop = 1 + 0.25 * ease.outCubic(this.bankPop);
    // the shelf: the baskets read over the lane and the grass
    ctx.fillStyle = 'rgba(70,45,18,.34)';
    ctx.beginPath();
    ctx.roundRect(B.x - 6, B.y - 3, B.w + 12, B.h + 6, 9);
    ctx.fill();
    for (let i = 0; i < n; i++) {
      const col = i % B.cols, row = Math.floor(i / B.cols);
      const x = B.x + cw * (col + 0.5), y = B.y + rh * (row + 0.5) + r * 0.25;
      const fill = i < filled ? 1 : i === filled ? sim.p.crumbs : 0;
      ctx.save();
      if (i === Math.max(0, filled - 1) && this.bankPop > 0) {
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        ctx.translate(-x, -y);
      }
      ctx.globalAlpha = i < filled ? 1 : i === filled ? 0.85 : 0.6;
      paintBasket(ctx, x, y, r, { fill, gold: i < filled && this.restK > 0.5 });
      ctx.restore();
    }
    // the pantry's count on a plate
    const text = `${TXT.bank}: ${fmtNum(sim.p.bank)}`;
    const lb = L.bankLabel;
    ctx.font = font(850, 13 * u, SANS);
    const tw = ctx.measureText(text).width, ph = 19 * u;
    const x0 = lb.align === 'left' ? lb.x : lb.x - tw - 12 * u;
    const y0 = lb.base === 'bottom' ? lb.y - ph : lb.y - ph / 2;
    ctx.fillStyle = 'rgba(50,32,14,.62)';
    ctx.beginPath();
    ctx.roundRect(x0, y0, tw + 12 * u, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + 6 * u, y0 + ph / 2 + 0.5);
  }
}

const CHAPTER = (c: number): string => t(`chapter.${(c % 6) + 1}` as 'chapter.1');

