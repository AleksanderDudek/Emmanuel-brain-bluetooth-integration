/**
 * STUB (lead) — builder B ("ring") fills it: the ring, the crowd, the two fighters (rig.ts), the slow motion's look,
 * the energy ring, the bars, the options, the banners and the effects — drawn from a `FightView` (view.ts) on a
 * `Layout` (layout.ts).  The class and its methods are the contract builder A's index.ts calls.
 */
import type { Layout } from './layout';
import type { FightView } from './view';

export class RingView {
  private l: Layout | null = null;
  constructor(readonly opts: { reduced: boolean }) {}
  /** the canvas changed size (CSS px; the context is already scaled by dpr) */
  resize(l: Layout, dpr: number): void {
    void dpr;
    this.l = l;
  }
  /** every frame: `dt` real seconds since the last frame, `time` seconds since the view began */
  draw(ctx: CanvasRenderingContext2D, v: FightView, dt: number, time: number): void {
    void dt; void time;
    const l = this.l;
    if (!l) return;
    ctx.fillStyle = '#120d12';
    ctx.fillRect(0, 0, l.w, l.h);
    ctx.fillStyle = '#fff';
    ctx.font = `${l.font}px sans-serif`;
    ctx.fillText(`${v.phase} · ${v.player.act.kind} / ${v.foe.act.kind} · ${Math.round(v.energy * 100)}%`, 16, l.ring.y + 20);
    v.options.forEach((o, i) => {
      const r = l.options[i];
      if (!r) return;
      ctx.strokeStyle = o.chosen ? '#ffd27a' : '#888';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillText(o.label, r.x + 8, r.y + 30);
    });
  }
}
