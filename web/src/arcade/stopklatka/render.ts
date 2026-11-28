/**
 * Stop-klatka's frame (DESIGN.md §28): the picture (scene.ts) under the words (hud.ts), laid out by layout.ts for the
 * canvas and its insets.  The opening's and the close's cards and the lesson's rest sit over a quieted picture.
 */
import type { Insets, TapTarget } from '../kit/types';
import { Hud, type Hit } from './hud';
import { layout, type Layout } from './layout';
import { SceneView, type SceneLook } from './scene';
import type { StopSim } from './sim';

export class StopView {
  readonly scene = new SceneView();
  readonly hud = new Hud();
  l: Layout | null = null;
  private beatKey = '';
  private beatAt = 0;

  constructor(private readonly ctx: CanvasRenderingContext2D | null, private readonly o: { reduced: boolean; touch: boolean }) {}

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.l = layout(w, h, ins, this.o.touch);
    this.scene.resize(this.l, dpr);
    this.hud.resize(this.l, this.ctx);
  }

  draw(sim: StopSim, time: number, dpr: number): void {
    const ctx = this.ctx, l = this.l;
    if (!ctx || !l || !sim.started) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const beat = sim.scene();
    if (beat.key !== this.beatKey) {
      this.beatKey = beat.key;
      this.beatAt = time;
    }
    const w = sim.block.what;
    const look: SceneLook = {
      sat: sim.sat, cool: sim.cool, out: sim.out, flash: sim.flash, heat: sim.heat, frozen: w === 'freeze' || sim.out > 0.02 || this.o.reduced,
      t: time, since: time - this.beatAt, reduced: this.o.reduced,
    };
    this.scene.draw(ctx, beat, sim.age, look);
    // the cards' and the lesson's quiet over the picture
    const quiet = w === 'intro' || w === 'close' ? 0.42 : sim.afterPart === 'lesson' ? 0.3 * Math.min(1, (sim.t - (sim.cur?.partT0 ?? sim.t)) / 0.8) : 0;
    if (quiet > 0.01) {
      ctx.fillStyle = `rgba(16,12,20,${quiet.toFixed(3)})`;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    const speaker = beat.say && beat.from !== null && beat.from >= 0 ? this.scene.speakerAt(beat, sim.age, look) : null;
    this.hud.draw(ctx, sim, beat, speaker, time, this.o.reduced);
  }

  targets(sim: StopSim): TapTarget[] { return this.hud.targets(sim); }
  hit(sim: StopSim, x: number, y: number): Hit | null { return this.hud.hit(sim, x, y); }
}
