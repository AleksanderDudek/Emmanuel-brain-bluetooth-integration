/**
 * Ja jestem…'s calibration intro (DESIGN §13.8): while the band's reference fills (`p` 0..1), the vision
 * is drawn — the founder asked that the picture be turned into a mosaic sketch before the game: first
 * the lead lines of the mosaic, from the heart outward, then the pencil sketch cell by cell.  While the
 * picture is still being analysed (an own photo loading, a first visit) a pencil is at work on blank
 * paper.  The runner's card covers the middle of the screen, so the window sits high.
 */
import { approach, clamp } from '../kit/juice';
import { introWindow, type Rect } from './layout';
import { LEAD, PAPER, TAU, blit, font, glowSprite, windowPath } from './paint';
import type { Prepared } from './prep';
import { RULES } from './rules';
import { t } from './i18n';

export class JestemIntro {
  private clock = 0;
  private shown = 0;
  private order: { edges: number[]; cells: number[]; key: string } | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, prep: Prepared | null, working: number): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    // the drawing follows the calibration, and never runs ahead of the analysis
    this.shown = approach(this.shown, prep ? clamp(p * 1.15) : 0, dt, 0.5);
    const W = introWindow(w, h);
    const g = ctx.createRadialGradient(w / 2, W.y + W.h / 2, W.h * 0.2, w / 2, W.y + W.h / 2, Math.max(w, h));
    g.addColorStop(0, '#3a2a4e');
    g.addColorStop(0.5, '#1f1628');
    g.addColorStop(1, '#0d0a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    blit(ctx, glowSprite('255,226,180'), W.x + W.w / 2, W.y + W.h / 2, W.w * 2, W.h * 1.5, 0.12 + 0.2 * this.shown);
    ctx.fillStyle = '#2b2226';
    ctx.fill(windowPath(W, 6));
    ctx.fillStyle = PAPER;
    ctx.fill(windowPath(W));
    if (!prep) {
      this.pencil(ctx, W, working);
      return;
    }
    this.sketch(ctx, W, prep);
  }

  private sketch(ctx: CanvasRenderingContext2D, W: Rect, prep: Prepared): void {
    const geo = prep.geo;
    if (!this.order || this.order.key !== `${prep.key}|${geo.cells.length}`) {
      const mid = (e: { p: { x: number; y: number }; q: { x: number; y: number } }) => Math.hypot((e.p.x + e.q.x) / 2 - geo.heart.x, (e.p.y + e.q.y) / 2 - geo.heart.y);
      const edges = geo.edges.map((_, i) => i).sort((a, b) => mid(geo.edges[a]) - mid(geo.edges[b]));
      const cells = geo.cells.map(c => c.id).sort((a, b) => geo.cells[a].heartD - geo.cells[b].heartD);
      this.order = { edges, cells, key: `${prep.key}|${geo.cells.length}` };
    }
    const k = W.w / RULES.PW, s = this.shown;
    ctx.save();
    ctx.clip(windowPath(W));
    // the pencil sketch, cell by cell from the heart (the second half of the drawing)
    const nCells = Math.floor(clamp((s - 0.35) / 0.6) * this.order.cells.length);
    if (nCells > 0) {
      const clip = new Path2D();
      for (const id of this.order.cells.slice(0, nCells)) {
        const poly = geo.cells[id].poly;
        poly.forEach((q, i) => (i ? clip.lineTo(W.x + q.x * k, W.y + q.y * k) : clip.moveTo(W.x + q.x * k, W.y + q.y * k)));
        clip.closePath();
      }
      ctx.save();
      ctx.clip(clip);
      ctx.drawImage(prep.sketch, W.x, W.y, W.w, W.h);
      ctx.restore();
    }
    // the lead lines, drawn from the heart outward (the first half)
    const nEdges = Math.floor(clamp(s / 0.5) * this.order.edges.length);
    ctx.strokeStyle = LEAD;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.4, 2.4 * (W.w / 300));
    ctx.beginPath();
    for (const i of this.order.edges.slice(0, nEdges)) {
      const e = geo.edges[i];
      ctx.moveTo(W.x + e.p.x * k, W.y + e.p.y * k);
      ctx.lineTo(W.x + e.q.x * k, W.y + e.q.y * k);
    }
    ctx.stroke();
    // the pen at the newest line
    if (nEdges > 0 && nEdges < this.order.edges.length) {
      const e = geo.edges[this.order.edges[nEdges - 1]];
      blit(ctx, glowSprite('255,214,150'), W.x + e.q.x * k, W.y + e.q.y * k, 26, 26, 0.8);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(246,212,136,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke(windowPath(W, 6));
  }

  /** Blank paper and a pencil at work, while the picture is still being prepared. */
  private pencil(ctx: CanvasRenderingContext2D, W: Rect, working: number): void {
    const a = this.clock * 2.1;
    const x = W.x + W.w * (0.5 + 0.3 * Math.cos(a)), y = W.y + W.h * (0.55 + 0.25 * Math.sin(a * 1.37));
    ctx.save();
    ctx.clip(windowPath(W));
    ctx.strokeStyle = 'rgba(62,50,46,0.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 40; i++) {
      const b = a - i * 0.05;
      const px = W.x + W.w * (0.5 + 0.3 * Math.cos(b)), py = W.y + W.h * (0.55 + 0.25 * Math.sin(b * 1.37));
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#3e322e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 22, y - 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(62,50,46,0.75)';
    ctx.font = font(13, 600);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('intro.sketch'), W.x + W.w / 2, W.y + W.h * 0.86);
    // a quiet ring of progress around the pencil's paper
    ctx.strokeStyle = 'rgba(246,212,136,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W.x + W.w / 2, W.y + W.h * 0.3, 12, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(working));
    ctx.stroke();
  }
}
