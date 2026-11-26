/**
 * STUB (lead) — builder B ("street") fills it: the street through the day, the moment's card turning from grey to
 * gold, the garland of lights over the street (the streak), the pocket, the choices, the words — from a `PassaView`
 * on a `Layout`.  The class and its methods are the contract builder A's index.ts calls.
 */
import type { Layout } from './layout';
import type { PassaView } from './view';

export class StreetView {
  private l: Layout | null = null;
  constructor(readonly opts: { reduced: boolean }) {}
  resize(l: Layout, dpr: number): void { void dpr; this.l = l; }
  draw(ctx: CanvasRenderingContext2D, v: PassaView, dt: number, time: number): void {
    void dt; void time;
    const l = this.l;
    if (!l) return;
    ctx.fillStyle = '#1b1712';
    ctx.fillRect(0, 0, l.w, l.h);
    ctx.fillStyle = '#fff';
    ctx.font = `${l.font}px sans-serif`;
    ctx.fillText(`${v.phase} · ${v.card?.what ?? ''} · lights ${v.lights}`, 16, l.scene.y + 20);
    v.choices.forEach((c, i) => {
      const r = l.choices[i];
      if (!r) return;
      ctx.strokeStyle = c.chosen ? '#ffd27a' : '#888';
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillText(c.label, r.x + 8, r.y + 30);
    });
  }
}
