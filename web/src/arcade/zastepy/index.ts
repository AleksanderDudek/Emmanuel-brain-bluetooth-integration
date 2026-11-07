/**
 * Zastępy (the hosts), v2: a lane battler after We Are Warriors!, told after Revelation 12:7-8 — the
 * gate of light on the left, the gate of ash on the right, one road between them.  Light flows into
 * a bar; a tap on a unit card (or 1–7, Space for the cheapest ready one) sends that angel out of the
 * gate, and the units walk and fight on their own, each angel the bane (×2) of one kind of shade, so
 * the coming wave's icons say which card to send; a tap on the road (or H) raises the pillar of cloud
 * there, which no shade passes.  A campaign of chapters (five battles, the fifth a boss gate whose
 * Colossus, Locust or Dragon telegraphs its special), each new chapter a new age of the fortress
 * with the gate and the host re-dressed and stronger; stars per battle; gold buys the gate, the
 * pillar and the units, with their numbers shown.  The band is the core: in a Natarcie the level
 * speeds the flow of light (never below the base; the lantern shows it with its threshold) and a held
 * focus charges the trumpet, which also breaks a boss's special; in a Cisza the demons slow and calm
 * mends the walls and lays shields of light; the banners along the road keep the last 40 s.  Tymek,
 * the cadet chronicler, talks; story cards open the campaign and each age.  If the gate of light
 * falls the host withdraws, keeps its gold and tries again with stronger walls.
 *
 * This module wires the parts to the arcade runner (kit/types.ts): the rules (sim.ts with the road
 * in battle.ts, the numbers in rules.ts and the meta in meta.ts), the pictures (render.ts with
 * hud.ts and layout.ts, intro.ts for calibration, preview.ts for the lobby, all drawn with
 * paint.ts), the sound (audio.ts) and the lobby's card (panel.ts); the words in i18n.ts and
 * content.ts.
 */
import type { FocusFrame } from '../kit/focus';
import { buzz } from '../kit/juice';
import type { ArcadeGame, ArcadeModule, ArcadeOutcome, GameEnv, Headline, HowTo, PointerInput, SignalPhase } from '../kit/types';
import { ZastepySound } from './audio';
import { DEMON_NAME, HINTS, HOST_NAME } from './content';
import { t, unit } from './i18n';
import { bestOf, bossOf, freshProgress, migrate, type ZastepyProgress } from './meta';
import { progressPanel } from './panel';
import { drawPreview } from './preview';
import { ZastepyView } from './render';
import { ZastepySim, type SimEvent } from './sim';

class ZastepyGame implements ArcadeGame {
  private readonly sim: ZastepySim;
  private readonly view: ZastepyView;
  private readonly sound: ZastepySound;

  constructor(private readonly env: GameEnv<ZastepyProgress>) {
    this.sim = new ZastepySim({
      progress: env.progress, rng: env.rng, day: env.day, daySeed: env.daySeed, plannedSec: env.plannedSec, eeg: env.tool === 'eeg', tuning: env.tuning,
    });
    this.view = new ZastepyView(env.canvas, { reducedMotion: env.reducedMotion, eeg: env.tool === 'eeg', hudTop: () => env.hudTop() });
    this.sound = new ZastepySound(env.audio);
  }

  resize(w: number, h: number, dpr: number): void { this.view.resize(w, h, dpr); }

  intro(dt: number, p: number): void { this.view.intro(dt, p, this.env.progress); }

  start(): void {
    this.sim.start();
    this.sound.start();
    this.view.start();
    this.drain();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    this.sim.cardOn = this.view.hud.storyOn;
    this.sim.update(dt, f, t);
    this.drain();
    this.view.update(dt, this.sim);
    this.sound.update(dt);
  }

  draw(): void { this.view.draw(this.sim); }

  /**
   * A tap on a card sends, on the trumpet sounds, on the pillar's button raises it at the front, on the
   * card between battles buys or goes on, on the road raises the pillar there; a drag on the road pans.
   * While a story card is up, a tap closes it.
   */
  pointer(e: PointerInput): void {
    const hit = this.view.pointer(e.type, e.x, e.y, e.id, this.sim);
    if (!hit) return;
    switch (hit.kind) {
      case 'story': this.view.hud.hideStory(); break;
      case 'card': this.sim.send(hit.id); break;
      case 'trumpet': this.sim.sound(); break;
      case 'pillar': this.sim.raise(); break;
      case 'road': this.sim.raise(hit.x); break;
      case 'offer': this.sim.buy(hit.i); break;
      case 'go': this.sim.skip(); break;
      default: break;
    }
    this.drain();
  }

  /** 1–7 the cards (between battles 1–3 the offers), Space the cheapest, T the trumpet, H the pillar, Enter goes on. */
  key(key: string, down: boolean): boolean {
    if (this.view.hud.storyOn) {
      // any key the game uses closes the story card (after a moment to read it)
      const ours = key === ' ' || key === 'Enter' || /^[1-7htqHTQ]$/.test(key);
      if (down && ours) this.view.hud.hideStory();
      return ours;
    }
    const used = this.sim.key(key, down);
    if (used) this.drain();
    return used;
  }

  pause(paused: boolean): void {
    if (paused) this.view.release();
  }

  private drain(): void {
    for (const e of this.sim.take()) {
      if (e.type === 'teach') {
        this.env.hint(this.hintText(e.what, e.demon, e.card), this.view.anchor(e.what, this.sim, e.card), 3800);
        continue;
      }
      this.view.on(e, this.sim);
      this.sound.on(e);
      if (this.env.haptics) haptic(e);
    }
  }

  padLevel(f: FocusFrame): number | null { return this.sim.padLevel(f); }

  canStop(): boolean { return this.sim.canStop(); }

  private hintText(what: string, demon?: string, card?: string): string {
    if (what === 'counter') return t('hint.counter', { demon: demon ? DEMON_NAME[demon as keyof typeof DEMON_NAME] : '', card: card ? HOST_NAME[card as keyof typeof HOST_NAME] : '' });
    if (what === 'boss') {
      const k = bossOf(this.sim.battle.battle);
      return t(k === 'kolos' ? 'hint.boss.stomp' : k === 'szarancza' ? 'hint.boss.swarm' : 'hint.boss.breath');
    }
    return HINTS[what as keyof typeof HINTS] ?? '';
  }

  /** What the block asks of the brain, for the runner's Mendi panel and dock. */
  signal(): SignalPhase { return this.sim.signal(); }

  meter(): number | null { return this.sim.meter(); }

  headline(): Headline { return this.sim.headline(); }

  /** Ended early: the sim settles at once; its events are dropped (the view and the sound are about to go). */
  finish(): void {
    this.sim.finish();
    this.sim.take();
  }

  result(): ArcadeOutcome { return this.sim.result(); }

  destroy(): void { this.view.release(); }
}

function haptic(e: SimEvent): void {
  switch (e.type) {
    case 'sent': buzz(8); break;
    case 'trumpet': buzz([20, 40, 20, 40, 30]); break;
    case 'trumpetReady': buzz([10, 30, 10]); break;
    case 'won': buzz([15, 30, 15, 30, 40]); break;
    case 'boss': buzz([40, 60, 40]); break;
    case 'pillar': buzz([12, 20, 25]); break;
    case 'special': buzz(30); break;
    case 'nope': buzz(4); break;
    default: break;
  }
}

const mod: ArcadeModule<ZastepyProgress> = {
  freshProgress,
  create: env => new ZastepyGame(env),
  best: p => (migrate(p).sessions > 0 ? bestOf(p) : null),
  unit,
  progressPanel: (p, save) => progressPanel(p, save),
  preview: (ctx, w, h, tt, p) => drawPreview(ctx, w, h, tt, p),
  howto: (): HowTo => ({
    goal: t('howto.goal'),
    hands: [
      { gesture: 'tap', text: t('howto.cards') },
      { gesture: 'tap', text: t('howto.road') },
      { gesture: 'keys', text: t('howto.keys') },
    ],
    tips: [t('howto.tip1'), t('howto.tip2')],
  }),
};
export default mod;
