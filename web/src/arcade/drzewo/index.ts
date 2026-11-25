/**
 * Drzewo nad wodą (a tree by the water): the meditation of being rooted in Christ (DESIGN.md §18), rooted in Psalm 1:3.
 * Drawn from the Chinese practice of "standing like a tree" (zhan zhuang) and prayed here as rooting in Christ (Col
 * 2:6-7): seated or standing, the figure of light rests on the ground of a cross-section at dusk; while focus is held
 * its roots grow down between the stones to a hidden stream, water rises through them, a tree of light grows through
 * the figure — trunk, branches, crown — and the nine fruits of the Spirit ripen one by one (Gal 5:22-23), each with
 * its reflection; then wind and heat pass and the tree stands.  Without focus the tree waits; nothing is lost.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts; the numbers and the plan in
 * rules.ts; the fruits, the soil and the passages in content.ts; the meta in meta.ts; the narrator in talk.ts), the
 * pictures (render.ts on tree.ts's geometry and layout.ts, paint.ts; the words in hud.ts; preview.ts for the lobby,
 * the cards and the intro), the sound (audio.ts), the lobby's card (panel.ts); the words in i18n.ts.
 */
import { BREATH_DEFAULT, breathCycle, breathOk, type BreathPattern } from '../kit/breath';
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import { coarsePointer } from '../kit/mobile';
import { breathDial, type RhythmSpec } from '../kit/rhythm';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase, TapTarget } from '../kit/types';
import { DrzewoSound } from './audio';
import { POSTURES, SEASON_MODES } from './content';
import { breathWords, cap, fruitName, t, unit } from './i18n';
import { bestOf, breathOf, freshProgress, migrate, setPosture, setSeason, type DrzewoProgress } from './meta';
import { progressPanel } from './panel';
import { DrzewoIntro, drawPreview } from './preview';
import { DrzewoView } from './render';
import { RULES, planFor, readTime } from './rules';
import { DrzewoSim, type BlockKind, type Coach, type CoachAt, type SimEvent } from './sim';

/** The breath of the last progress the module saw: the how-to names it. */
let knownBreath: BreathPattern | null = null;
const seen = (p: DrzewoProgress): DrzewoProgress => {
  knownBreath = breathOf(p);
  return p;
};

class DrzewoGame implements ArcadeGame {
  private readonly sim: DrzewoSim;
  private readonly view: DrzewoView;
  private readonly sound: DrzewoSound;
  private readonly introScene = new DrzewoIntro();
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private now = 0;
  private readonly hints: { what: Coach; at: CoachAt }[] = [];
  private hintCool = 1.5;

  constructor(private readonly env: GameEnv<DrzewoProgress>) {
    seen(migrate(env.progress));
    this.sim = new DrzewoSim({
      progress: env.progress, rng: env.rng, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning, day: env.day, rhythm: env.rhythm,
    });
    this.ctx = env.canvas.getContext('2d');
    this.view = new DrzewoView(this.ctx, { reducedMotion: env.reducedMotion, touch: env.touch, seed: Math.floor(env.rng() * 1e9) });
    this.sound = new DrzewoSound(env.audio);
    if (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search)) (globalThis as { __drzewo?: unknown }).__drzewo = this.sim;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.view.resize(w, h, dpr, this.env.insets());
  }

  intro(dt: number, p: number): void {
    if (!this.ctx) return;
    this.introScene.draw(this.ctx, this.w, this.h, dt, p, this.env.progress, this.dpr);
  }

  start(): void {
    this.view.resize(this.w, this.h, this.dpr, this.env.insets());
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
    this.hintCool -= dt;
    this.flushHints();
  }

  draw(): void {
    if (this.sim.started) this.view.draw(this.sim);
  }

  /**
   * A tap: on a story card turns its page; in the picker chooses (posture, season) or closes it; on ≡ opens the
   * picker; on a ripe fruit opens its card (again: its second reflection); on a fruit's card closes it; anywhere
   * else the words glow again — never growth.
   */
  pointer(e: PointerInput): void {
    const sim = this.sim, v = this.view;
    if (!this.env.touch) this.mouseAt(e);
    if (e.type !== 'down') return;
    v.touch(e.x, e.y);
    if (sim.story) {
      sim.stay();
      this.drain();
      return;
    }
    if (sim.picker) {
      const hit = v.pickerHit(e.x, e.y);
      if (hit.what === 'posture') { setPosture(this.env.progress, POSTURES[hit.i]); sim.touchPicker(); }
      else if (hit.what === 'season') { setSeason(this.env.progress, SEASON_MODES[hit.i]); sim.touchPicker(); }
      else if (hit.what === 'close' || hit.what === 'out') sim.closePicker();
      this.drain();
      return;
    }
    const L = v.L;
    if (e.x >= L.menu.x && e.x <= L.menu.x + L.menu.w && e.y >= L.menu.y && e.y <= L.menu.y + L.menu.h) {
      sim.openPicker();
      this.drain();
      return;
    }
    const fruit = v.fruitAt(sim, e.x, e.y);
    if (fruit) sim.openFruit(fruit);
    else sim.stay();
    if (this.env.haptics) buzz(5);
    this.drain();
  }

  /** A desktop's mouse: a fruit under it brightens, the cursor says a click does something. */
  private mouseAt(e: PointerInput): void {
    const sim = this.sim, v = this.view, L = v.L;
    const onMenu = e.x >= L.menu.x && e.x <= L.menu.x + L.menu.w && e.y >= L.menu.y && e.y <= L.menu.y + L.menu.h;
    const on = sim.story || sim.picker ? true : onMenu || !!v.hover(sim, e.x, e.y);
    this.env.canvas.style.cursor = on ? 'pointer' : '';
  }

  key(key: string, down: boolean): boolean {
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      this.view.on(e, this.sim);
      this.sound.on(e, this.sim);
      if (e.type === 'coach') this.hints.push({ what: e.what, at: e.at });
      if (this.env.haptics) haptic(e);
    }
  }

  /** The runner's coach mark, pointing at what it explains — never over a card, one at a time. */
  private flushHints(): void {
    const sim = this.sim;
    if (!this.hints.length || this.hintCool > 0 || sim.story || sim.picker || sim.card) return;
    if (sim.phase === 'play' && (sim.telegraphed || sim.blockT < RULES.bannerSec)) return;
    if (sim.talk.line) return;
    const h = this.hints.shift()!;
    const text = sim.coachWords(h.what, this.env.touch);
    const ms = Math.round(readTime(text) * 1000);
    this.hintCool = ms / 1000 + RULES.hintGap;
    sim.hintUntil = this.now + ms / 1000 + 0.3;
    this.env.hint(text, this.view.pointAt(h.at, sim), ms);
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  /** What the block asks of the brain: a push has no fixed length (it lasts until its station is full); a rest counts its breaths down. */
  signal(): SignalPhase {
    const s = this.sim, b = s.block;
    const phaseOf = (k: BlockKind | null) => (k === 'push' ? 'focus' : k === 'rest' ? 'rest' : 'free');
    const left = s.phase === 'play' && Number.isFinite(b.dur) ? Math.max(0, b.dur - s.blockT) : undefined;
    if (!s.started || s.phase !== 'play' || b.kind === 'posture') {
      const next = s.started && s.phase === 'play' && s.telegraphed ? phaseOf(s.nextKind) : null;
      return { want: 'free', blind: false, task: s.tip || undefined, left, next };
    }
    return { want: b.kind === 'push' ? 'focus' : 'rest', blind: s.blind, task: s.tip, left, next: s.telegraphed ? phaseOf(s.nextKind) : null };
  }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline {
    const s = this.sim;
    const best = bestOf(s.p);
    const left = best !== null ? best - s.score : 0;
    if (best !== null && left > 0 && left <= 2 && s.kind === 'fruit') return { value: s.score, sub: t('hud.subBest', { n: left }) };
    if (s.phase !== 'play') return { value: s.score, sub: t('hud.subEnd') };
    if (s.postureBlock) return { value: s.score, sub: t('hud.subPosture') };
    const no = s.stationNo;
    if (s.kind === 'roots') return { value: s.score, sub: t('hud.subRoots', { i: no.i, n: no.of }) };
    if (s.kind === 'trunk') return { value: s.score, sub: t('hud.subTree', { i: no.i, n: no.of }) };
    return { value: s.score, sub: t('hud.subFruit', { fruit: cap(fruitName(s.fruit)), i: no.i }) };
  }

  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  targets(): TapTarget[] { return this.view.targets(this.sim); }

  destroy(): void {
    this.env.canvas.style.cursor = '';
  }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'ripe': buzz([10, 40, 18]); break;
    case 'stream': buzz([14, 50, 14]); break;
    case 'harvest': buzz([24, 40, 40, 40, 60]); break;
    default: break;
  }
}

/** The rest's breath in words for the how-to. */
const breathTip = (p: BreathPattern | null): string => breathWords(p && breathOk(p) ? p : BREATH_DEFAULT);

/** How to play, for the hand the player has. */
export function howto(touch = coarsePointer(), breath: BreathPattern | null = knownBreath): HowTo {
  return {
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t(touch ? 'howto.tap' : 'howto.click') },
      ...(touch ? [] : [{ gesture: 'keys' as const, text: t('howto.keys') }]),
    ],
    tips: [t('howto.tip1', { breath: breathTip(breath) }), t('howto.tip2')],
  };
}

/**
 * The rest's rhythm in the lobby (kit/rhythm.ts, round 15): a rest after 1–3 stages (a layer of roots, a part of the
 * tree, a fruit; 1 by design — the water at the stream and the whole crown always rest) and its whole breaths of the
 * player's own pattern (2 by design for 10 minutes; as designed the session's own table keeps the length's rest).
 */
export function drzewoRhythm(p?: DrzewoProgress): RhythmSpec {
  const pattern = breathOf(p ? migrate(p) : freshProgress());
  const cyc = breathCycle(pattern);
  return {
    focus: {
      def: RULES.restAfter, min: 1, max: RULES.restAfterMax, step: 1, name: t('rhythm.after'),
      format: n => t('rhythm.stages', { n }),
    },
    rest: breathDial(RULES.restDef, t('rhythm.rest'), cyc, { min: 1, max: RULES.restBreathsMax }),
    note: t('rhythm.note'),
    focusSec: n => n * RULES.stageSec,
    restSec: n => n * cyc,
    // the plan keeps the rests and the wind within RULES.restCap of the session: fewer breaths in a short one
    restIn: (r, sec) => planFor(sec, pattern, false, { restAfter: r.focus, restBreaths: r.rest }).restCycles,
  };
}

const mod: ArcadeModule<DrzewoProgress> = {
  freshProgress,
  create: env => new DrzewoGame(env),
  best: p => {
    seen(migrate(p));
    return p.sessions > 0 ? bestOf(p) : null;
  },
  unit,
  progressPanel: (p, save) => progressPanel(seen(migrate(p)), () => { seen(p); save(); }),
  preview: (ctx, w, h, time, p) => drawPreview(ctx, w, h, time, p ? migrate(p) : undefined),
  howto: () => howto(),
  rhythm: p => drzewoRhythm(p),
  // the breath guide is the game's own (hud.ts, kit/breathguide.ts): the runner shows no pacer over it
  ownBreath: true,
};
export default mod;
