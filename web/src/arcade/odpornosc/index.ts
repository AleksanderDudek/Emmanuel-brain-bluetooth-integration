/**
 * Odporność (immunity), the series "Weź moc, obudź się" (DESIGN.md §13.9), rooted in Psalm 103:2-3.  The
 * real stages of the body's defence against a splinter's bacteria and a cold virus, as the levels of a run:
 * Alarm (a tissue macrophage senses the bacteria and sends cytokines), Rekrutacja (neutrophils roll on the
 * venule's wall, stop and squeeze through), Łowy (the swarm follows the trail and engulfs: phagosome,
 * respiratory burst, NETs), Przeciwciała (a dendritic cell carries a piece to the lymph node; antibodies and
 * complement tag the bacteria gold), Limfocyty T (cytotoxic T cells find infected cells by the virus's flags
 * and the cells fold themselves away; NK cells find the ones that hid them) and Gojenie (macrophages tidy,
 * fibroblasts weave collagen, capillaries sprout, the skin closes).  Immune memory answers a pathogen met
 * before faster; "Wiedza" cards keep one sourced number each; a song plays with the series' refrain.
 *
 * The band is the alarm: in a push block focus makes the cytokine signal reach further (the rings, the gold
 * threshold ring around Makro), calls more white cells and speeds their engulfing; a held focus fills the
 * respiratory burst.  A rest block is healing: calm settles the inflammation, the marrow refreshes the swarm,
 * and in the healing stage the wound closes.  The hands: drag to lead the swarm (it gathers above the finger),
 * tap a bacterium or an infected cell to send the defenders, tap a rolling cell in the vessel to stop it,
 * drag across the wound to lay collagen; the two round buttons let the burst and the NET go.
 *
 * This module wires the parts to the arcade runner (kit/types.ts).  It visualises real processes and trains
 * attention; it does not heal and does not replace treatment (the how-to's last tip says so).
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { SongPlayer } from '../kit/song';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { OdpSound } from './audio';
import { stageName, type Coach, type CoachAt } from './content';
import { t, unit, type Key } from './i18n';
import { OdpIntro } from './intro';
import { tapTargets, wx, wy } from './layout';
import { bestOf, freshProgress, migrate, type OdpProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { OdpView } from './render';
import { RULES } from './rules';
import { OdpSim, type SimEvent } from './sim';
import { buildSong, isChorus } from './song';

/** a finger that moves farther than this (px) drags; less is a tap */
const TAP_PX = 10;
/** a collagen stroke is laid every this many world units of a drag across the wound */
const STROKE_UNITS = 14;

class OdpGame implements ArcadeGame {
  private readonly sim: OdpSim;
  private readonly view: OdpView;
  private readonly sound: OdpSound;
  private readonly introScene = new OdpIntro();
  private song: SongPlayer | null = null;
  private ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private finger: number | null = null;
  private press: { x: number; y: number; moved: boolean; mode: 'lead' | 'sweep' | 'stroke' | null; wx: number; wy: number; lastWx: number } | null = null;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 2;
  private cardUp = false;
  private ended = false;

  constructor(private readonly env: GameEnv<OdpProgress>) {
    migrate(env.progress);
    this.sim = new OdpSim({ progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning });
    this.view = new OdpView(env.canvas, { reducedMotion: env.reducedMotion, touch: env.touch });
    this.sound = new OdpSound(env.audio);
    this.ctx = env.canvas.getContext('2d');
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __odpornosc?: unknown }).__odpornosc = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
    this.sim.setWorld(this.view.L.W);
  }

  intro(dt: number, p: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, this.env.progress);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
    this.sim.setWorld(this.view.L.W);
    this.sim.start();
    this.sound.start(this.env.progress.song);
    if (this.env.progress.song) {
      this.song = new SongPlayer(this.env.audio, buildSong());
      this.song.start();
    }
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt);
    this.sound.update(dt);
    this.song?.level(this.sim.songLevel(f));
    if (this.sim.phase === 'done' && !this.ended) {
      this.ended = true;
      this.song?.stop(1.6);
    }
    this.hintCool -= dt;
    const card = !!this.sim.card;
    if (card && !this.cardUp) this.env.hint('');
    this.cardUp = card;
    this.flushHints();
  }

  draw(): void {
    if (!this.sim.started) return;
    const s = this.song;
    const beat = s?.beat ?? this.sim.t * (112 / 60);
    // the sing-along line only with the song audible (sound off: no lyrics without music)
    const on = !!s && this.env.audio.on;
    this.view.draw(this.sim, { line: on && s ? s.line() : null, beat, chorus: isChorus(beat), on });
  }

  /**
   * A press on a card closes it (after a moment); on a button, the burst or the NET; on the field, a tap sends
   * the defenders (to the bacterium or infected cell under the finger, else to the nearest from there; in the
   * vessel it stops a rolling cell), and a drag leads the swarm above the finger — or, started in the vessel,
   * stops every rolling cell it passes; started at the wound while healing, lays collagen.  One finger at a time.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, view = this.view, L = view.L;
    if (e.type === 'down') {
      if (this.finger !== null && this.finger !== e.id) this.letGo();
      this.finger = e.id;
      view.touchDown(e.x, e.y);
      const hit = view.hit(e.x, e.y, sim);
      if (hit.kind === 'card') {
        sim.tap(sim.W / 2, 50);
      } else if (hit.kind === 'burst') {
        view.buttonDown('burst');
        sim.burst();
      } else if (hit.kind === 'net') {
        view.buttonDown('net');
        sim.net();
      } else {
        this.press = { x: e.x, y: e.y, moved: false, mode: null, wx: hit.x, wy: hit.y, lastWx: hit.x };
      }
      this.drain();
      return;
    }
    if (e.id !== this.finger) return;
    const pr = this.press;
    if (e.type === 'move') {
      if (!pr) return;
      if (!pr.moved && Math.hypot(e.x - pr.x, e.y - pr.y) > TAP_PX) {
        pr.moved = true;
        const inVessel = pr.wy >= RULES.wallY - 3 && sim.flow.some(f => f.state === 'roll' || f.state === 'flow');
        const atWound = sim.canWeave && Math.abs(pr.wx - sim.woundX) < 30 && pr.wy < 48;
        pr.mode = inVessel ? 'sweep' : atWound ? 'stroke' : 'lead';
        if (this.env.haptics) buzz(6);
      }
      if (!pr.moved) return;
      const ex = wx(L, e.x), ey = wy(L, e.y);
      if (pr.mode === 'sweep') {
        if (sim.sweep(pr.lastWx, ex) > 0 && this.env.haptics) buzz(8);
        pr.lastWx = ex;
        view.drag = null;
      } else if (pr.mode === 'stroke') {
        view.drag = { x: e.x, y: e.y, lx: e.x, ly: e.y, mode: 'stroke', sx0: L.ox + pr.wx * L.k, sy0: L.oy + pr.wy * L.k };
        if (Math.hypot(ex - pr.wx, ey - pr.wy) >= STROKE_UNITS) {
          if (sim.stroke(pr.wx, pr.wy, ex, ey) && this.env.haptics) buzz(10);
          pr.wx = ex;
          pr.wy = ey;
        }
      } else {
        // the swarm gathers above the finger, where the player can see it
        const ly = e.y - L.lift;
        sim.lead(wx(L, e.x), wy(L, ly));
        view.drag = { x: e.x, y: e.y, lx: e.x, ly, mode: 'lead', sx0: e.x, sy0: e.y };
      }
      this.drain();
      return;
    }
    // up
    if (pr && !pr.moved) sim.tap(pr.wx, pr.wy);
    else if (pr && pr.mode === 'stroke') {
      const ex = wx(L, e.x), ey = wy(L, e.y);
      if (Math.hypot(ex - pr.wx, ey - pr.wy) >= STROKE_UNITS * 0.5) sim.stroke(pr.wx, pr.wy, ex, ey);
    }
    this.letGo();
    this.drain();
  }

  private letGo(): void {
    this.finger = null;
    if (this.press?.mode === 'lead') this.sim.lead(null);
    this.press = null;
    this.view.drag = null;
    this.view.pressed = null;
  }

  /** Space: the burst when ready, else the defenders to the nearest target; B the burst, N a NET. */
  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used && down && (key === ' ' || key === 'b' || key === 'B') && this.sim.bursting > 0) this.view.buttonDown('burst');
    if (used && down && (key === 'n' || key === 'N')) this.view.buttonDown('net');
    if (!down) this.view.pressed = null;
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.letGo();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at the thing it explains — never over a card or mid-drag, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.card || this.press?.moved) return;
    const banner = sim.phase === 'play' && sim.block.kind !== 'warmup' && sim.blockT < RULES.bannerSec;
    if (banner) return;
    const h = this.hints.shift()!;
    if (!hintFits(h.what, sim)) return;
    const at = this.view.pointFor(h.at);
    const ms = 4200;
    this.hintCool = ms / 1000 + 1;
    sim.hushT = ms / 1000 + 0.3;
    this.env.hint(coachText(h.what, this.env.touch), at, ms);
  }

  padLevel(f: FocusFrame): number | null {
    // with the song on, the song is the room (its layers follow the alarm); the pad only plays without it
    return this.song ? null : this.sim.padLevel(f);
  }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain, its seconds left and what comes next, for the runner's panel and dock. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    if (!s.started || s.phase !== 'play' || b.kind === 'warmup') {
      const next = s.started && s.phase === 'play' && b.kind === 'warmup' && s.telegraphed && s.next ? (s.next.kind === 'push' ? 'focus' : 'rest') : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left: s.phase === 'play' ? Math.max(0, b.dur - s.blockT) : undefined, next };
    }
    const nb = s.next;
    return {
      want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left: Math.max(0, b.dur - s.blockT),
      next: s.telegraphed ? (nb ? (nb.kind === 'push' ? 'focus' : 'rest') : 'free') : null,
    };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const stage = stageName(s.stage);
    if (s.combo >= 3) return { value: s.score, sub: t('hud.subCombo', { stage, n: s.combo }) };
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= Math.max(10, best * 0.25)) return { value: s.score, sub: t('hud.subBest', { stage, left }) };
    return { value: s.score, sub: t('hud.sub', { loop: s.p.loop, stage }) };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
    this.song?.stop(1);
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] {
    const s = this.sim;
    if (!s.started) return [];
    return tapTargets(this.view.L, { burst: s.burstShown && !s.card, net: s.netShown && !s.card, card: !!s.card });
  }

  destroy(): void {
    this.letGo();
    this.song?.stop(0.4);
    this.song = null;
  }
}

/** A coach mark still makes sense now (the moment may have passed). */
function hintFits(what: Coach, sim: OdpSim): boolean {
  switch (what) {
    case 'burst': return sim.burstReady && sim.burstShown;
    case 'net': return sim.nets > 0 && sim.netShown;
    case 'rest':
    case 'tidy': return sim.restBlock;
    case 'blind': return sim.blind;
    case 'rings': return sim.pushBlock && !sim.blind && sim.scene === 'skin';
    case 'roll': return sim.stage === 'recruit';
    case 'tcell':
    case 'hidden': return sim.scene === 'nose';
    case 'collagen': return sim.canWeave;
    case 'drag':
    case 'tap': return sim.stage === 'alarm';
    case 'swarm': return sim.stage === 'hunt' || sim.stage === 'antibodies';
    default: return true;
  }
}

/** A coach mark's words for the hand the player has: a finger never hears of keys. */
export function coachText(what: Coach, touch: boolean): string {
  if (what === 'burst' && !touch) return t('coach.burst.keys');
  return t(`coach.${what}` as Key);
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'gulp': if (e.combo >= 5 && e.combo % 5 === 0) buzz(10); break;
    case 'burst': buzz([20, 30, 40]); break;
    case 'net': buzz(30); break;
    case 'arrest': buzz(8); break;
    case 'fold': buzz(12); break;
    case 'stageDone': buzz([15, 30, 15]); break;
    case 'closed': buzz([20, 40, 60]); break;
    case 'burstReady': buzz(18); break;
    default: break;
  }
}

/** How to play, for the hand the player has: the buttons on a phone, Space, B and N on a keyboard. */
export function howto(touch = coarsePointer()): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'drag', text: t('howto.drag') },
      { gesture: 'tap', text: t('howto.tap') },
      touch ? { gesture: 'tap', text: t('howto.burst') } : { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  };
}

const mod: ArcadeModule<OdpProgress> = {
  freshProgress,
  create: env => new OdpGame(env),
  best: p => {
    migrate(p);
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(migrate(p), save),
  preview: (ctx, w, h, t, p) => drawPreview(ctx, w, h, t, p ? migrate(p) : undefined),
  howto: () => howto(),
};
export default mod;
