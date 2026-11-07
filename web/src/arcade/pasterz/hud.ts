/**
 * Pasterz's own screen things, over the hill (the runner draws the band's panel and the score):
 *
 *   the ranking     Crowd City's live top list under the score: the top three and the player, each
 *                   flock's dye and count, the crown; its header names the pasture and its time left
 *   the arrows      rival flocks off screen, at the edge, in their dye with their count
 *   the compass     the lost lamb's direction after the Głos and while it bleats
 *   the stars       the night's row of twelve: each lit star is a straggler fetched
 *   the joystick    where the finger went down and where it steers
 *   Łatek's bubble  short lines over the dog, never over a telegraph or the banner (talk.ts)
 *   the tally card  at dawn after a round: the place, the flock, the bonuses, the near miss, the
 *                   wardrobe's next piece and the next hill with its line of story
 */
import { clamp, ease } from '../kit/juice';
import { wrapLines } from '../kit/scripture';
import { PLAYER_DYE } from './content';
import { sheep, t } from './i18n';
import { C, SANS, SERIF, font, paintCrown, paintStar } from './paint';
import type { PasterzView } from './render';
import { RULES } from './rules';
import type { PasterzSim } from './sim';

const TAU = Math.PI * 2;

const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class PasterzHud {
  private cardT = 0;
  private cardOf = -1;

  update(dt: number, sim: PasterzSim, _view: PasterzView): void {
    const show = this.cardShown(sim);
    if (show && sim.tally && this.cardOf !== sim.tally.round) {
      this.cardOf = sim.tally.round;
      this.cardT = 0;
    }
    this.cardT += dt;
  }

  private cardShown(sim: PasterzSim): boolean {
    return !!sim.tally && (sim.tallyT > 0 || sim.phase !== 'play');
  }

  draw(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const L = view.L;
    const night = sim.night > 0.5;
    if (!this.cardShown(sim) && !(night && L.tall)) this.ranking(ctx, sim, view);
    if (!this.cardShown(sim)) {
      this.arrows(ctx, sim, view);
      this.compass(ctx, sim, view);
    }
    if (sim.night > 0.1) this.stars(ctx, sim, view);
    this.joystick(ctx, view);
    this.talk(ctx, sim, view);
    if (this.cardShown(sim)) this.card(ctx, sim, view);
  }

  // ── the ranking ────────────────────────────────────────────────
  private ranking(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const L = view.L, r = L.rank, u = L.u;
    const order = sim.ranking();
    const me = order.findIndex(s => s.i === 0);
    const rows = order.slice(0, 3);
    if (me >= 3) rows.push(order[me]);
    const rowH = 19 * u, headH = 20 * u;
    const h = headH + rows.length * rowH + 8 * u;
    ctx.save();
    ctx.fillStyle = 'rgba(30,26,18,.5)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, h, 12 * u);
    ctx.fill();
    ctx.font = font(700, 10.5 * u, SANS);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,248,226,.75)';
    ctx.fillText(t('ui.round', { n: sim.roundIndex + 1, of: sim.roundsPlanned }), r.x + 10 * u, r.y + headH / 2 + 2 * u);
    ctx.textAlign = 'right';
    ctx.fillText(sim.phase === 'play' ? mmss(sim.roundLeft) : '0:00', r.x + r.w - 10 * u, r.y + headH / 2 + 2 * u);
    rows.forEach((s, k) => {
      const y = r.y + headH + k * rowH + rowH / 2 + 2 * u;
      const place = order.indexOf(s) + 1;
      const mine = s.i === 0;
      if (mine) {
        ctx.fillStyle = 'rgba(238,123,48,.35)';
        ctx.beginPath();
        ctx.roundRect(r.x + 4 * u, y - rowH / 2 + 1, r.w - 8 * u, rowH - 2, 7 * u);
        ctx.fill();
      }
      ctx.globalAlpha = s.out ? 0.5 : 1;
      ctx.textAlign = 'left';
      ctx.font = font(800, 11 * u, SANS);
      ctx.fillStyle = '#fff8e2';
      ctx.fillText(String(place), r.x + 10 * u, y);
      ctx.fillStyle = mine ? PLAYER_DYE : s.dye;
      ctx.beginPath();
      ctx.arc(r.x + 27 * u, y, 5 * u, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = font(mine ? 800 : 600, 11 * u, SANS);
      ctx.fillStyle = '#fff8e2';
      const name = mine ? t('ui.you') : s.name;
      const maxW = r.w - 76 * u;
      let label = name;
      while (label.length > 3 && ctx.measureText(label).width > maxW) label = `${label.slice(0, -2)}…`;
      ctx.fillText(label, r.x + 37 * u, y);
      ctx.textAlign = 'right';
      ctx.font = font(800, 12 * u, SANS);
      ctx.fillText(String(s.n), r.x + r.w - 10 * u, y);
      if (sim.crown === s.i) paintCrown(ctx, r.x + r.w - 10 * u - ctx.measureText(String(s.n)).width - 12 * u, y + 5 * u, 13 * u);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  /** The room the arrows stay inside (below the HUD, above the banner), minus the ranking box. */
  private edge(view: PasterzView, x: number, y: number, pad: number): { x: number; y: number; a: number } | null {
    const L = view.L;
    const cx = L.cx, cy = L.cy;
    const x0 = pad, x1 = view.w - pad, y0 = L.top + pad, y1 = L.bottom - pad;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return null;
    const dx = x - cx, dy = y - cy;
    const a = Math.atan2(dy, dx);
    let k = Infinity;
    if (dx > 0) k = Math.min(k, (x1 - cx) / dx);
    if (dx < 0) k = Math.min(k, (x0 - cx) / dx);
    if (dy > 0) k = Math.min(k, (y1 - cy) / dy);
    if (dy < 0) k = Math.min(k, (y0 - cy) / dy);
    let ex = cx + dx * k, ey = cy + dy * k;
    const r = L.rank;
    if (ex > r.x - pad && ey < r.y + r.h + pad) ey = Math.max(ey, r.y + r.h + pad);
    ex = clamp(ex, x0, x1);
    ey = clamp(ey, y0, y1);
    return { x: ex, y: ey, a };
  }

  private arrows(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    if (sim.night > 0.5) return;
    const u = view.L.u;
    for (const s of sim.shepherds) {
      if (s.i === 0 || s.out) continue;
      const p = this.edge(view, view.sx(s.x), view.sy(s.y), 22 * u);
      if (!p) continue;
      this.marker(ctx, p.x, p.y, p.a, s.dye, String(s.n), u);
    }
  }

  private marker(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, text: string, u: number): void {
    const r = 13 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r + 7 * u, 0);
    ctx.lineTo(r - 2 * u, -6 * u);
    ctx.lineTo(r - 2 * u, 6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = font(800, 11 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0.5);
    ctx.restore();
  }

  private compass(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const l = sim.lamb;
    if (l.state !== 'hidden' || sim.night > 0.5) return;
    const on = sim.compassT > 0 || l.bleat > 0;
    if (!on) return;
    const u = view.L.u;
    const p = this.edge(view, view.sx(l.x), view.sy(l.y), 26 * u);
    if (!p) return;
    const pulse = 1 + Math.sin(view.clock * 8) * 0.08;
    ctx.save();
    ctx.globalAlpha = sim.compassT > 0 ? 1 : clamp(l.bleat * 1.2);
    this.marker(ctx, p.x, p.y, p.a, '#f2cc8f', '?', u * pulse);
    ctx.font = font(800, 11 * u, SANS);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff6dc';
    ctx.fillText(t('fx.bee'), p.x, p.y + 24 * u);
    ctx.restore();
  }

  /** Where the i-th star of the night's row sits (screen px). */
  starSlot(i: number, view: PasterzView): { x: number; y: number } {
    const s = view.L.stars, n = RULES.starMax;
    const k = (i + 0.5) / n;
    return { x: s.x + s.w * k, y: s.y + s.h * 0.5 + Math.sin(k * Math.PI) * -6 * view.L.u };
  }

  private stars(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const a = clamp((sim.night - 0.1) / 0.6);
    const box = view.L.stars, u = view.L.u;
    ctx.fillStyle = `rgba(10,14,36,${(0.4 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(box.x - 8 * u, box.y - 6 * u, box.w + 16 * u, box.h + 6 * u, box.h);
    ctx.fill();
    for (let i = 0; i < RULES.starMax; i++) {
      const p = this.starSlot(i, view);
      const lit = i < sim.stars;
      const tw = lit ? 1 + Math.sin(view.clock * 3 + i) * 0.12 : 1;
      if (lit) paintStar(ctx, p.x, p.y, 7 * view.L.u * tw, a);
      else {
        ctx.fillStyle = `rgba(220,226,255,${(0.55 * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6 * view.L.u, 0, TAU);
        ctx.fill();
      }
    }
  }

  private joystick(ctx: CanvasRenderingContext2D, view: PasterzView): void {
    const s = view.stick;
    if (!s) return;
    const R = RULES.stickPx;
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy);
    const k = d > R ? R / d : 1;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.ox, s.oy, R, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.arc(s.ox + dx * k, s.oy + dy * k, 14, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ── speech bubbles ─────────────────────────────────────────────
  /** A drawn speech bubble with its tail down to (x, y); fades in and out over its life. */
  bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha: number, age: number, view: PasterzView, maxW = 220): void {
    ctx.save();
    ctx.font = font(650, size, SANS);
    const lines = wrapLines(ctx, text, maxW * view.L.u);
    const lh = size * 1.3, pad = size * 0.7;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2;
    const h = lines.length * lh + pad * 1.2;
    const L = view.L;
    const bx = clamp(x - w / 2, 8, view.w - 8 - w);
    const by = clamp(y - h - 10, L.top + 4, L.bottom - h - 50);
    const pop = age < 0.18 ? ease.outBack(age / 0.18) : 1;
    ctx.globalAlpha = alpha * Math.min(1, age * 6);
    ctx.translate(bx + w / 2, by + h);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + w / 2), -(by + h));
    ctx.fillStyle = 'rgba(255,250,236,.96)';
    ctx.strokeStyle = 'rgba(60,44,28,.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, size * 0.8);
    ctx.fill();
    ctx.stroke();
    const tx = clamp(x, bx + 14, bx + w - 14);
    if (y > by + h) {
      ctx.beginPath();
      ctx.moveTo(tx - 7, by + h - 1);
      ctx.lineTo(clamp(x, tx - 12, tx + 12), Math.min(y, by + h + 12));
      ctx.lineTo(tx + 7, by + h - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + pad * 0.6 + lh * (i + 0.5)));
    ctx.restore();
  }

  private talk(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const line = sim.talk.line;
    if (!line || this.cardShown(sim)) return;
    const d = sim.dog;
    const fade = line.dur - line.t < 0.3 ? (line.dur - line.t) / 0.3 : 1;
    this.bubble(ctx, line.text, view.sx(d.x), view.sy(d.y) - view.S * 0.4, 13.5 * view.L.u, fade, line.t, view, view.L.tall ? 200 : 250);
  }

  // ── the tally card ─────────────────────────────────────────────
  private card(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const tl = sim.tally!;
    const L = view.L, c = L.card;
    const k = ease.outBack(clamp(this.cardT / 0.35));
    const fadeOut = sim.phase === 'play' ? clamp(sim.tallyT / 0.35) : 1;
    const u = Math.min(L.u, c.h / 250);
    const count = (v: number) => Math.round(v * ease.outCubic(clamp((this.cardT - 0.3) / 0.9)));
    ctx.save();
    ctx.globalAlpha = fadeOut;
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
    // the parchment
    ctx.fillStyle = 'rgba(30,22,12,.35)';
    ctx.beginPath();
    ctx.roundRect(c.x + 3, c.y + 5, c.w, c.h, 18 * u);
    ctx.fill();
    const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
    g.addColorStop(0, '#fbf3df');
    g.addColorStop(1, '#efe0bd');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    const cx = c.x + c.w / 2;
    let y = c.y + 24 * u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const first = tl.place === 1 && tl.flock > 0;
    if (first) paintCrown(ctx, cx, y + 4 * u, 26 * u, Math.sin(view.clock * 4) * 1.5);
    y += first ? 16 * u : 0;
    ctx.fillStyle = C.ink;
    ctx.font = font(600, 19 * u, SERIF);
    ctx.fillText(first ? t('tally.first') : t('tally.dawn', { hill: tl.hill.name }), cx, y);
    y += 22 * u;
    ctx.font = font(800, 13 * u, SANS);
    ctx.fillStyle = first ? C.goldDeep : '#7a5a34';
    ctx.fillText(t('tally.place', { n: tl.place, of: tl.of }), cx, y);
    y += 22 * u;
    const row = (label: string, value: string, strong = false) => {
      ctx.font = font(strong ? 800 : 600, (strong ? 15 : 13) * u, SANS);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5b4630';
      ctx.fillText(label, c.x + 26 * u, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = strong ? '#b5521b' : C.ink;
      ctx.fillText(value, c.x + c.w - 26 * u, y);
      y += (strong ? 22 : 18) * u;
    };
    row(t('tally.flock'), String(count(tl.flock)));
    if (tl.crown > 0) row(t('tally.bonus'), `+${count(tl.crown)}`);
    if (tl.lamb > 0) row(t('tally.lamb', { name: tl.lambName ?? '' }), `+${count(tl.lamb)}`);
    ctx.strokeStyle = 'rgba(120,90,50,.3)';
    ctx.beginPath();
    ctx.moveTo(c.x + 22 * u, y - 8 * u);
    ctx.lineTo(c.x + c.w - 22 * u, y - 8 * u);
    ctx.stroke();
    y += 2 * u;
    row(t('tally.score'), String(count(tl.score)), true);
    ctx.textAlign = 'center';
    ctx.font = font(650, 12 * u, SANS);
    if (tl.toFirst > 0) {
      ctx.fillStyle = '#8a4a2a';
      ctx.fillText(t('tally.toFirst', { sheep: sheep(tl.toFirst) }), cx, y);
      y += 18 * u;
    }
    if (tl.unlock) {
      ctx.fillStyle = '#5b4630';
      ctx.fillText(t('tally.unlock', { sheep: sheep(tl.unlock.left) }), cx, y);
      y += 11 * u;
      const bw = c.w - 70 * u;
      ctx.fillStyle = 'rgba(120,90,50,.2)';
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, y, bw, 6 * u, 3 * u);
      ctx.fill();
      ctx.fillStyle = '#e39a3b';
      ctx.beginPath();
      ctx.roundRect(cx - bw / 2, y, Math.max(6 * u, bw * tl.unlock.share * clamp(this.cardT / 1.2)), 6 * u, 3 * u);
      ctx.fill();
      y += 18 * u;
    }
    ctx.font = font(500, 12.5 * u, SERIF, true);
    ctx.fillStyle = '#4a3a28';
    const tail = tl.next ? `${t('tally.next', { hill: tl.next.name })} — ${tl.next.story}` : t('tally.final');
    const lines = wrapLines(ctx, tail, c.w - 40 * u);
    for (const l of lines.slice(0, 3)) {
      if (y > c.y + c.h - 10 * u) break;
      ctx.fillText(l, cx, y);
      y += 16 * u;
    }
    ctx.restore();
  }
}
