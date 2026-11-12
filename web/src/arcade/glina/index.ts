/**
 * Glina (DESIGN.md §6, Glina v2): the potter's workshop after Let's Create! Pottery, in the
 * potter's house of Jeremiah 18.  Customers bring orders (a silhouette, a glaze, sometimes a band);
 * the player shapes the lump on the wheel with a finger (on the wall: in narrower, out wider; at the
 * rim: up taller, down lower) and says Gotowe; the batch is glazed (a colour dips, a drag paints a
 * band), fired (stop the heat needle in the green) and sold to customers who react, pay and tip.
 *
 * The band: a Toczenie (push) is the wheel's time — steadiness stills the wheel (the spirit level on
 * its frame, the panel's gauge), draws the master's guide line, makes the clay obey, and held focus
 * fills the master's hand for a golden spin.  A Wypał (rest) is the kiln's — calm keeps the heat
 * even: the green widens and the needle slows.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with shape.ts,
 * the numbers in rules.ts, the data in content.ts, the meta in meta.ts, Szamot's bubble in talk.ts),
 * the pictures (render.ts with scene.ts, vessel.ts, paint.ts and layout.ts; intro.ts for the
 * calibration; preview.ts for the lobby), the sound (audio.ts), the lobby's card (panel.ts), and
 * the words (i18n.ts).  Here a pointer becomes a gesture on the station in front of the player.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { TracePhase } from '../kit/trace';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { GlinaSound } from './audio';
import { bare, t, type Key } from './i18n';
import { KneadIntro } from './intro';
import { MIN_TAP } from '../kit/mobile';
import { hit, hitCircle } from './layout';
import { bestOf, freshProgress, migrate, type GlinaProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { GlinaView } from './render';
import { RULES } from './rules';
import { GlinaSim, type BlockKind, type GlinaEvent } from './sim';
import { radiusAt } from './vessel';

const phaseOf = (k: BlockKind): TracePhase => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');

type HintKey = 'wallIn' | 'wallOut' | 'rim' | 'done' | 'dip' | 'band' | 'glazeDone' | 'fire' | 'level' | 'guide' | 'kiln' | 'master' | 'blind' | 'market' | 'sell';

/**
 * A finger on the glass: what it works (the wall, the rim, a glazing stroke).  On a phone it works the clay
 * from below and from the side: where it came down (x0, y0), the wall's radius there (d0, cm) or the pot's
 * height (h0, cm), and the side of the axis it works.
 */
interface Press { id: number; mode: 'wall' | 'rim' | 'paint' | 'none'; lastU: number; x0: number; y0: number; d0: number; h0: number; side: number; done: boolean; t0: number }

/** A press on the wheel's Gotowe is a tap: it acts on the lift, within this long and this far (s, px); a drag from it works the clay. */
const TAP_SEC = 0.6, SLOP = 10;

/**
 * On a phone the hand works this far above the finger (CSS px at u = 1), so the thumb never covers the
 * clay it shapes; the wall then follows the finger's sideways move (no jump on touch-down).
 */
export const LIFT = 32;

/** The coach marks that name a key on a desktop. */
const KEYED: ReadonlySet<HintKey> = new Set<HintKey>(['done']);

class GlinaGame implements ArcadeGame {
  readonly sim: GlinaSim;
  private readonly view: GlinaView;
  private readonly sound: GlinaSound;
  private readonly intro0 = new KneadIntro();
  private press: Press | null = null;
  private now = 0;
  // the coach marks
  private readonly hinted = new Set<HintKey>();
  private hintAt = -99;
  private readonly later: { key: HintKey; at: number }[] = [];
  private wallIn = 0;
  private wallOut = 0;
  private rimUsed = 0;
  private shapeT = 0;
  private idleSaid = 0;
  /** the hint on screen */
  private shown: HintKey | null = null;

  constructor(private readonly env: GameEnv<GlinaProgress>) {
    migrate(env.progress);
    this.sim = new GlinaSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, day: env.day });
    this.view = new GlinaView(env.canvas, { reducedMotion: env.reducedMotion });
    this.sound = new GlinaSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __glina?: unknown }).__glina = this.sim;
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr, this.env.insets()); }

  intro(dt: number, p: number): void {
    const v = this.view, s = v.size;
    v.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    v.ctx.clearRect(0, 0, s.w, s.h);
    this.intro0.draw(v.ctx, s.w, s.h, dt, p, this.env.progress, this.env.reducedMotion);
  }

  start(): void {
    this.sim.quietWhileShaping = this.env.touch;
    this.sim.start();
    this.sound.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.now = t;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt, this.sim);
    if (this.sim.wheel === 'shape') this.shapeT += dt;
    else this.shapeT = 0;
    if (this.sim.wheel === 'shape' && t - this.sim.lastInput > 8 && t - this.idleSaid > 14) {
      this.idleSaid = t;
      this.sim.talk.ask('idle', 1, 4);
    }
    this.coach();
  }

  /** The runner draws every frame, the calibration too: until play begins the intro scene stays. */
  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  // ── the hands ───────────────────────────────────────────────────
  pointer(e: PointerInput): void {
    const sim = this.sim, v = this.view, L = v.L;
    if (e.type === 'down') {
      if (this.press) return;
      this.press = { id: e.id, mode: 'none', lastU: -1, x0: e.x, y0: e.y, d0: 0, h0: 0, side: 1, done: false, t0: this.now };
      if (sim.card) {
        sim.dismiss();
        return;
      }
      // the glazing wheel: the palette's swatches and chips (finger-sized), its Gotowe, then a stroke on the piece
      const pc = sim.glazing;
      if (pc) {
        const P = v.palette(sim);
        if (hit(P.done, e.x, e.y, 2)) { v.press('glazing Gotowe'); sim.glazeDone(); this.drain(); return; }
        // the nearest swatch within a finger's reach (two neighbours' reaches may meet: the closer wins)
        let ci = -1, best = Infinity;
        P.colors.forEach((c, i) => {
          const dd = Math.hypot(e.x - c.x, e.y - c.y);
          if (dd < best && hitCircle(c, e.x, e.y, Math.max(6, MIN_TAP / 2 - c.r + 4))) { best = dd; ci = i; }
        });
        if (ci >= 0) { v.press(`glaze ${sim.p.glazes[ci]}`); sim.pickGlaze(sim.p.glazes[ci]); this.drain(); return; }
        const pi = P.patterns.findIndex(r => hit(r, e.x, e.y, 2));
        if (pi >= 0) { v.press(`pattern ${sim.p.patterns[pi]}`); sim.pickPattern(sim.p.patterns[pi]); this.drain(); return; }
        const u = this.glazeU(e.x, e.y);
        if (u !== null) {
          sim.paint(u);
          this.press.mode = 'paint';
          this.press.lastU = u;
          this.drain();
        }
        return;
      }
      if (sim.kiln === 'fire') { sim.stopNeedle(); this.drain(); return; }
      if (sim.kiln === 'open' || sim.kiln === 'sell') { sim.hurry(); return; }
      // the wheel
      if (sim.wheel === 'shape' && sim.pot && sim.order) {
        // Gotowe answers on touch-down (pressed) and acts on the lift: a finger that came down on it to work the
        // pot's foot (the hand works above the finger) and moves on shapes the clay instead
        if (hit(L.done, e.x, e.y, 2)) { v.press('Gotowe', true); this.press.done = true; return; }
        this.press.mode = this.touchClay(e.x, e.y, null);
        this.drain();
      }
      return;
    }
    const pr = this.press;
    if (!pr || pr.id !== e.id) return;
    if (pr.done) {
      if (e.type === 'move' && Math.hypot(e.x - pr.x0, e.y - pr.y0) > SLOP) {
        pr.done = false;
        v.unpress();
        pr.x0 = e.x;
        pr.y0 = e.y;
        if (sim.wheel === 'shape' && sim.pot && sim.order) pr.mode = this.touchClay(e.x, e.y, null);
        this.drain();
      } else if (e.type === 'up') {
        this.press = null;
        v.unpress();
        if (this.now - pr.t0 <= TAP_SEC) sim.done();
        this.drain();
      }
      return;
    }
    if (e.type === 'move') {
      if (pr.mode === 'wall' || pr.mode === 'rim') this.touchClay(e.x, e.y, pr.mode);
      else if (pr.mode === 'paint') {
        const u = this.glazeU(e.x, e.y);
        if (u !== null && Math.abs(u - pr.lastU) >= RULES.bandGap) {
          if (this.sim.paint(u)) pr.lastU = u;
          this.drain();
        }
      }
      return;
    }
    // up
    this.press = null;
    this.view.finger = null;
    if (pr.mode === 'wall' || pr.mode === 'rim') {
      sim.release();
      this.drain();
    }
  }

  /** The palette's swatches, chips and Gotowe while glazing; the wheel's Gotowe while shaping; a card (the clay is free play). */
  targets(): TapTarget[] { return this.view.targets(this.sim); }

  /**
   * A finger on the clay: the rim (up, or close under it) moves the height; the wall follows the finger.  With a
   * mouse the pointer is the hand.  On a phone the hand works LIFT px above the finger and follows its moves from
   * where it came down: up and down to pick the height, sideways to narrow or widen — the thumb never covers the
   * clay, and a touch never makes the wall jump.
   */
  private touchClay(x: number, y: number, mode: 'wall' | 'rim' | null): 'wall' | 'rim' | 'none' {
    const sim = this.sim, pot = sim.pot, o = sim.order, L = this.view.L;
    if (!pot || !o || sim.wheel !== 'shape') return 'none';
    const sc = this.view.scaleFor(o.target);
    const pr = this.press;
    if (this.env.touch && pr) {
      const lift = LIFT * L.u;
      this.view.finger = { x, y };
      const rimY = L.floor - pot.H * sc;
      const m = mode ?? (y - lift < rimY + RULES.rimPx * L.u ? 'rim' : 'wall');
      if (m === 'rim') {
        if (!mode) {
          pr.h0 = pot.H;
          this.rimUsed++;
        }
        sim.touchRim(pr.h0 + (pr.y0 - y) / sc);
      } else {
        const u = Math.min(1, Math.max(0, (L.floor - (y - lift)) / (pot.H * sc)));
        if (!mode) {
          pr.side = x >= L.axis ? 1 : -1;
          pr.d0 = radiusAt(pot.r, u);
        }
        const before = radiusAt(pot.r, u);
        const d = Math.max(0, pr.d0 + (pr.side * (x - pr.x0)) / sc);
        sim.touchWall(u, d);
        this.view.fingerSide = pr.side;
        if (d < before - 0.3) this.wallIn++;
        else if (d > before + 0.3) this.wallOut++;
      }
      return m;
    }
    const rimY = L.floor - pot.H * sc;
    const m = mode ?? (y < rimY + RULES.rimPx * L.u ? 'rim' : 'wall');
    if (m === 'rim') {
      sim.touchRim((L.floor - y) / sc);
      if (!mode) this.rimUsed++;
    } else {
      const u = Math.min(1, Math.max(0, (L.floor - y) / (pot.H * sc)));
      const d = Math.abs(x - L.axis) / sc;
      const before = radiusAt(pot.r, u);
      sim.touchWall(u, d);
      this.view.fingerSide = x >= L.axis ? 1 : -1;
      if (d < before - 0.3) this.wallIn++;
      else if (d > before + 0.3) this.wallOut++;
    }
    return m;
  }

  /** Where on the glazing piece a finger is (u 0..1), or null off the piece. */
  private glazeU(x: number, y: number): number | null {
    const pc = this.sim.glazing, L = this.view.L;
    if (!pc) return null;
    const sc = this.view.glazeScale(pc.order.target, this.sim);
    const u = (this.view.palette(this.sim).floor - y) / (pc.H * sc);
    if (u < -0.05 || u > 1.08) return null;
    const r = radiusAt(pc.r, Math.min(1, Math.max(0, u))) * sc;
    if (Math.abs(x - L.axis) > r + 30) return null;
    return Math.min(1, Math.max(0, u));
  }


  /** Space or Enter: finish the step in front of the player; 1–8 pick a glaze while glazing. */
  key(key: string, down: boolean): boolean {
    if (key === ' ' || key === 'Enter') {
      if (down) {
        this.sim.space();
        this.drain();
      }
      return true;
    }
    if (/^[1-8]$/.test(key)) {
      if (down && this.sim.glazing) {
        const g = this.sim.p.glazes[Number(key) - 1];
        if (g) this.sim.pickGlaze(g);
        this.drain();
      }
      return true;
    }
    return false;
  }

  pause(paused: boolean): void {
    if (paused) {
      this.press = null;
      this.sim.release();
    }
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
      this.react(e);
    }
  }

  // ── the coach marks: one mechanic at a time, when it first matters ──
  private react(e: GlinaEvent): void {
    switch (e.type) {
      case 'blockStart':
        if (e.block.kind === 'push') this.later.push({ key: e.block.blind ? 'blind' : 'level', at: this.now + RULES.bannerSec + 0.5 });
        if (e.block.kind === 'rest') this.later.push({ key: 'kiln', at: this.now + RULES.bannerSec + 0.5 });
        break;
      case 'cut':
        if (e.market) this.ask('market');
        break;
      case 'sale':
        this.ask('sell');
        break;
      case 'heat':
        this.ask('fire');
        break;
      default:
        break;
    }
  }

  private ask(key: HintKey, delay = 0): void {
    if (this.seen(key)) return;
    this.later.push({ key, at: this.now + delay });
  }

  private seen(key: HintKey): boolean { return this.hinted.has(key) || this.env.progress.seen.includes(key); }

  private coach(): void {
    const sim = this.sim;
    if (!sim.started || sim.ended || sim.card) return;
    // a hint whose moment passed is taken down
    if (this.shown && this.shown !== 'sell' && this.now - this.hintAt < 3.6 && !this.fits(this.shown)) {
      this.env.hint('');
      this.shown = null;
      this.hintAt = -99;
    }
    // the needle cannot wait: its hint goes up at once
    if (sim.kiln === 'fire' && !this.seen('fire') && this.shown !== 'fire') return void this.show('fire');
    if (sim.kiln === 'sell' && sim.sold > 0 && !this.seen('sell') && this.shown !== 'sell') return void this.show('sell');
    if (this.now - this.hintAt < 3.6 || sim.telegraphing) return;
    if (!sim.freeBlock && sim.blockT < RULES.bannerSec + 0.3) return;   // the runner's block banner is up
    // the wheel, one gesture at a time
    if (sim.wheel === 'shape' && sim.pot) {
      // the potter's order: pull the lump up, then narrow and widen the wall, then Gotowe
      if (!this.seen('rim')) return void this.show('rim');
      if ((this.rimUsed > 0 || this.shapeT > 6) && !this.seen('wallIn')) return void this.show('wallIn');
      if ((this.wallIn > 0 || this.shapeT > 10) && !this.seen('wallOut')) return void this.show('wallOut');
      if ((this.wallOut > 0 || this.shapeT > 14 || sim.pot.match > 0.75) && !this.seen('done')) return void this.show('done');
      if (sim.guide && !this.seen('guide')) return void this.show('guide');
      if (sim.charge >= 0.4 && sim.sighted && !this.seen('master')) return void this.show('master');
    }
    const pc = sim.glazing;
    if (pc) {
      if (pc.glaze === null && !this.seen('dip')) return void this.show('dip');
      if (pc.glaze !== null && !pc.bands.length && !this.seen('band')) return void this.show('band');
      if (pc.bands.length && !this.seen('glazeDone')) return void this.show('glazeDone');
    }
    this.later.sort((a, b) => a.at - b.at);
    // a hint whose moment has passed is dropped (it comes back the next time it matters)
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      if (this.seen(l.key) || this.now - l.at > 8) this.later.splice(i, 1);
    }
    const next = this.later.find(l => l.at <= this.now && this.fits(l.key));
    if (next) {
      this.later.splice(this.later.indexOf(next), 1);
      this.show(next.key);
    }
  }

  /** Whether a hint still points at something on screen now. */
  private fits(key: HintKey): boolean {
    const sim = this.sim;
    switch (key) {
      case 'fire': return sim.kiln === 'fire';
      case 'sell': return sim.kiln === 'sell';
      case 'level': case 'blind': return sim.pushBlock && sim.wheel === 'shape';
      case 'market': return sim.pushBlock && sim.market.length > 0;
      case 'kiln': return sim.restBlock;
      case 'wallIn': case 'wallOut': case 'rim': case 'done': case 'guide': return sim.wheel === 'shape';
      case 'master': return sim.pushBlock;
      case 'dip': case 'band': case 'glazeDone': return !!sim.glazing;
      default: return true;
    }
  }

  private show(key: HintKey): void {
    const sim = this.sim, v = this.view, L = v.L;
    let at: { x: number; y: number } | null = null;
    const pot = sim.pot, o = sim.order;
    const potAt = (u: number, out = 0) => {
      if (!pot || !o) return null;
      const sc = v.scaleFor(o.target);
      return { x: L.axis + radiusAt(pot.r, u) * sc + out, y: L.floor - u * pot.H * sc };
    };
    switch (key) {
      case 'wallIn': at = potAt(0.5, -6); break;
      case 'wallOut': at = potAt(0.45, 14); break;
      case 'rim': at = potAt(1, 0); break;
      case 'done': at = { x: L.done.x + L.done.w / 2, y: L.done.y }; break;
      case 'guide': at = potAt(0.6, 10); break;
      case 'master': at = { x: L.charge.x, y: L.charge.y - L.charge.r }; break;
      case 'level': case 'blind': at = { x: L.level.x + L.level.w / 2, y: L.level.y }; break;
      case 'dip': {
        // the order's own colour (it carries the mark), else the first
        const P = v.palette(sim), i = Math.max(0, sim.p.glazes.indexOf(sim.glazing?.order.glaze ?? sim.p.glazes[0]));
        const c = P.colors[i] ?? P.colors[0];
        at = !c ? null : L.portrait ? { x: c.x, y: P.top - 4 } : { x: c.x, y: c.y - c.r };
        break;
      }
      case 'band': at = { x: L.axis, y: v.palette(sim).floor - 40 }; break;
      // over the palette (never over its swatches): the mark sits above the sheet, its arrow on it
      case 'glazeDone': { const P = v.palette(sim), d = P.done; at = { x: d.x + d.w / 2, y: L.portrait ? P.top - 4 : d.y }; break; }
      case 'fire': at = { x: L.axis, y: L.floor - L.stageH * 0.45 }; break;
      case 'kiln': at = { x: L.gauge.x, y: L.gauge.y - L.gauge.r }; break;
      case 'market': at = { x: L.shelf.x + L.shelf.w * 0.8, y: L.shelf.y }; break;
      case 'sell': at = { x: L.customer.x, y: L.customer.y - L.customer.s }; break;
    }
    this.hinted.add(key);
    if (!this.env.progress.seen.includes(key)) this.env.progress.seen.push(key);
    this.hintAt = this.now;
    this.shown = key;
    this.env.hint(t((!this.env.touch && KEYED.has(key) ? `hint.${key}.keys` : `hint.${key}`) as Key), at, key === 'sell' ? 2600 : 3600);
  }

  // ── what the runner reads ───────────────────────────────────────
  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  signal(): SignalPhase {
    const s = this.sim;
    if (!s.started || s.ended) return { want: 'free', blind: false };
    const next = s.telegraphing && s.next ? phaseOf(s.next.kind) : null;
    return { want: phaseOf(s.block.kind), blind: s.blind, task: s.tip, left: s.left, next };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return { value: this.sim.score, sub: this.sim.headlineSub() }; }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome {
    const r = this.sim.result();
    return { ...r, unit: bare('unit', r.score) };
  }

  destroy(): void {
    this.press = null;
  }
}

function haptic(e: GlinaEvent): void {
  switch (e.type) {
    case 'order': buzz(10); break;
    case 'cut': buzz(12); break;
    case 'spin': buzz([20, 40, 20, 40, 60]); break;
    case 'dip': buzz(8); break;
    case 'fire': buzz(e.grade === 'perfect' ? [15, 30, 15, 30, 40] : 20); break;
    case 'sale': buzz(e.piece.stars === 3 ? [10, 30, 10] : 10); break;
    default: break;
  }
}

/** The hands in a finger's words; the keys in their own row (a phone's card leaves it out, a desktop shows it). */
const howto = (): HowTo => ({
  goal: t('how.goal'),
  hands: [
    { gesture: 'drag', text: t('how.wall') },
    { gesture: 'drag', text: t('how.rim') },
    { gesture: 'tap', text: t('how.tap') },
    { gesture: 'keys', text: t('how.keys') },
  ],
  tips: [t('how.tip1'), t('how.tip2')],
});

const mod: ArcadeModule<GlinaProgress> = {
  freshProgress,
  create: env => new GlinaGame(env),
  best: p => bestOf(migrate(p)),
  unit: n => bare('unit', n),
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p),
  howto,
};

export default mod;
