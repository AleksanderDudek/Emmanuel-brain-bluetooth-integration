/**
 * Firmament's own screen parts, drawn on the canvas over the board (the runner draws the Mendi panel
 * and the score; this never repeats them), sized for a phone first (layout.ts, DESIGN §12):
 *
 *   the goal          a strip under the HUD on a phone upright (the moves in a ring, what is still to
 *                     clear, the score bar with its stars), a card in the left column elsewhere (the
 *                     level, the moves, the goal, the bar)
 *   the telescope     the band in the world: the lens fills with light (`level`, 0.5 = the dashed
 *                     threshold ring on the lens itself), the charge ring round the rim fills toward the
 *                     next tool, a violet arc counts a long hold toward a pulsar; clouds cover it in a
 *                     blind block; in the calm sky it glows blue and three pips count the falling stars.
 *                     Round its top runs the light trail: the last 40 s, a star a second, gold above the
 *                     threshold, blue in rest, hollow without signal, hidden under a blind block's veil.
 *                     Its words go under it; on a phone upright they rise above the lens for a moment
 *                     when they change (the ring and the lens say the rest)
 *   the tray          the tools in finger-sized slots in the thumb zone: pressed under a finger, an armed
 *                     one glowing with how to use it above it; the shortcut digits only with a keyboard
 *   Bubo              the owl and his speech bubble (a touch on the sky hushes it)
 *   the cards         the story card (the constellation, the story, its passage), the goal card before a
 *                     level, the tally after it (stars, score, the constellation with the new star lit),
 *                     and out of moves (what was missing, +5 from the telescope, try again): bottom
 *                     sheets on a phone upright, their buttons under the thumb
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { fitText } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout, type PassageId } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import { MOON } from './board';
import { AIMED, CONSTELLATIONS, constName, figure, storyText, toolName } from './content';
import { pts, t } from './i18n';
import { cardRect, inRect, outButtons, type CardKind, type Layout, type Rect } from './layout';
import { C, KIND_COLOR, SANS, SERIF, font, fontPx, paintBody, paintCloudIcon, paintMoon, paintOwl, paintRock, paintStar, paintToolIcon } from './paint';
import { RULES, type FirmamentSim } from './sim';

export type Hit = { cell: number } | { slot: number } | { button: 'use' | 'retry' | 'card' };

const TAU = Math.PI * 2;
/** How long the telescope's words stay over the lens on a phone upright (s). */
const TIP_SEC = 2.8;

export class HudDraw {
  private cardKind = '';
  private cardT = 0;
  private bubble: { text: string; t: number } | null = null;
  private toolFlash: { slot: number; t: number } | null = null;
  private pips = { n: 0, t: -9 };
  private verse: { key: string; l: PassageLayout } | null = null;
  private clock = 0;
  /** the slot under a finger right now (-1: none), for its pressed look */
  pressSlot = -1;
  /** the telescope's words as a tooltip (a phone upright): what they say and since when */
  private tip: { text: string; t: number } | null = null;
  private tipKey = '';
  /** the lens's brass and glass, painted once per radius */
  private lens: { key: string; c: HTMLCanvasElement | null } | null = null;

  constructor(private readonly opts: { reducedMotion: boolean; eeg: boolean; touch: boolean }) {}

  card(kind: string, clock: number): void { this.cardKind = kind; this.cardT = clock; }
  get shown(): string { return this.cardKind; }
  say(text: string, clock: number): void { this.bubble = { text, t: clock }; }
  /** A touch on the sky: Bubo's bubble steps out of the way (it fades in a moment). */
  hush(clock: number): void {
    const b = this.bubble;
    if (b && clock - b.t > 0.5 && clock - b.t < 3) b.t = clock - 3;
  }
  flashTool(slot: number, clock: number): void { this.toolFlash = { slot, t: clock }; }
  starPip(n: number, clock: number): void { this.pips = { n, t: clock }; }
  update(dt: number): void { this.clock += dt; }

  hit(x: number, y: number, L: Layout, sim: FirmamentSim): Hit | null {
    if (sim.stage === 'out') {
      const b = outButtons(L, sim.tray.includes('moves'));
      if (b.use && inRect(b.use, x, y)) return { button: 'use' };
      if (inRect(b.retry, x, y)) return { button: 'retry' };
      return null;
    }
    if (sim.stage === 'story' || sim.stage === 'intro' || sim.stage === 'won') return { button: 'card' };
    for (let k = 0; k < Math.min(sim.traySize, L.tray.length); k++) if (inRect(L.tray[k], x, y)) return { slot: k };
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    if (L.mode === 'tall') this.drawStrip(ctx, L, sim, T);
    else this.drawGoalCard(ctx, L, sim, T);
    this.drawScope(ctx, L, sim, T);
    this.drawTray(ctx, L, sim, T);
    const kind = sim.phase === 'play' || sim.stage === 'won' ? cardOf(sim.stage) : null;
    const card = !!kind && !(kind === 'won' && sim.busyT > 0 && sim.stageT < 0.3);
    // beside a card in the middle (a phone on its side, a desktop) Bubo comments over the dimmed sky; his bubble
    // would only hide under a phone's sheet or the story's wide card, so there it waits for play
    const late = card && L.mode !== 'tall' && kind !== 'story';
    if (!late) this.drawOwl(ctx, L, sim, T, card);
    this.drawUse(ctx, L, sim);
    if (card && kind) {
      // the play waits under a card: the sky dims under it (the goal strip stays readable over a phone's sheet)
      ctx.fillStyle = 'rgba(5,7,26,.5)';
      const y0 = L.mode === 'tall' ? L.card.y - 4 : L.band.y;
      ctx.fillRect(0, y0, L.w, L.h - y0);
      if (kind === 'story') this.drawStory(ctx, L, sim, T);
      else if (kind === 'intro') this.drawIntro(ctx, L, sim, T);
      else if (kind === 'won') this.drawWon(ctx, L, sim, T);
      else this.drawOut(ctx, L, sim, T);
    }
    if (late) this.drawOwl(ctx, L, sim, T, false);
  }

  // ── the goal: a strip on a phone upright ────────────────────────
  private drawStrip(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const g = L.goal, u = L.u, lv = sim.level;
    ctx.save();
    panel(ctx, g, 12 * u);
    const ringR = g.h * 0.42;
    const rx = g.x + 6 + ringR, ry = g.y + g.h / 2;
    this.movesRing(ctx, sim, rx, ry, ringR, T);
    // what is left to do, the hard tag at the end of the row
    const gx = rx + ringR + 10 * u, gx1 = g.x + g.w - 10 * u;
    const row1 = g.y + g.h * 0.36;
    let x1 = gx1;
    if (lv.hard) {
      ctx.font = font(800, 12 * u, SANS);
      ctx.fillStyle = '#ff8fb0';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const tag = t('strip.hard').toUpperCase();
      ctx.fillText(tag, gx1, row1);
      x1 = gx1 - ctx.measureText(tag).width - 10 * u;
    }
    this.goalRow(ctx, sim, gx, x1, row1, 9 * u, 15 * u, T);
    // the score bar with its stars
    this.scoreBar(ctx, sim, gx, gx1, g.y + g.h * 0.76, u);
    ctx.restore();
  }

  // ── the goal: a card in a column ────────────────────────────────
  private drawGoalCard(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const g = L.goal, u = L.u, lv = sim.level;
    ctx.save();
    panel(ctx, g, 14 * u);
    ctx.textBaseline = 'middle';
    const ty = g.y + 16 * u;
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 15 * u, SERIF);
    ctx.textAlign = 'left';
    const title = t('strip.level', { n: lv.index + 1 });
    ctx.fillText(title, g.x + 12, ty);
    const tw = ctx.measureText(title).width;
    // the hard tag, or the constellation's name where it fits
    const room = g.x + g.w - 10 - (g.x + 12 + tw + 10);
    ctx.textAlign = 'right';
    if (lv.hard) {
      ctx.fillStyle = '#ff8fb0';
      const s = fitText(ctx, t('strip.hard'), room, 12 * u, 700, SANS);
      if (s) ctx.fillText(s, g.x + g.w - 10, ty);
    } else if (room >= 70) {
      ctx.fillStyle = C.dim;
      const s = fitText(ctx, constName(lv.constellation), room, 12 * u, 600, SANS);
      if (s) ctx.fillText(s, g.x + g.w - 10, ty);
    }
    // the moves in a ring with its word under it
    const barY = g.y + g.h - 16 * u;
    const ringR = Math.max(16, Math.min((barY - 14 * u - 6 - (ty + 12 * u)) / 2.2, g.w * 0.17));
    const rx = g.x + 12 + ringR, ry = ty + 12 * u + ringR;
    this.movesRing(ctx, sim, rx, ry, ringR, T);
    ctx.fillStyle = C.dim;
    ctx.textAlign = 'center';
    ctx.font = font(700, Math.max(12, ringR * 0.26), SANS);
    ctx.fillText(t('strip.moves').toUpperCase(), rx, ry + ringR + 10 * u);
    // what is left to do: a row, or one item a line where the card is narrow
    const gx = rx + ringR + 12 * u, gx1 = g.x + g.w - 10;
    const items = this.goalItems(sim);
    const iconR = Math.min(13 * u, (gx1 - gx) * 0.12);
    const wide = (gx1 - gx) >= items.length * 92 * u;
    if (wide || items.length === 1) {
      if (lv.goal === 'score' && !wide) {
        // a narrow card: the points over the target
        paintStar(ctx, gx + iconR, ry - 9 * u, iconR * 0.9, 1, C.gold);
        ctx.textAlign = 'left';
        ctx.fillStyle = sim.levelScore >= lv.n ? C.mint : C.cream;
        const room = gx1 - (gx + iconR * 2.3);
        ctx.fillText(fitText(ctx, fmtNum(Math.round(sim.levelScore)), room, 16 * u, 800, SANS, 12), gx + iconR * 2.3, ry - 9 * u);
        ctx.fillStyle = C.dim;
        ctx.fillText(fitText(ctx, `/ ${fmtNum(lv.n)}`, room, 12 * u, 700, SANS), gx + iconR * 2.3, ry + 10 * u);
      } else this.goalRow(ctx, sim, gx, gx1, ry, iconR, 16 * u, T);
    } else {
      const lh = Math.min(iconR * 2.6, (ringR * 2.2) / items.length);
      items.forEach((it, k) => {
        const y = ry - ((items.length - 1) * lh) / 2 + k * lh;
        it.icon(ctx, gx + iconR, y, iconR, T);
        ctx.textAlign = 'left';
        ctx.font = font(800, 16 * u, SANS);
        ctx.fillStyle = it.left <= 0 ? C.mint : C.cream;
        ctx.fillText(it.left <= 0 ? it.done : it.text, gx + iconR * 2.3, y);
      });
    }
    this.scoreBar(ctx, sim, g.x + 12, g.x + g.w - 12, barY, u);
    ctx.restore();
  }

  /** The moves in a ring (red and pulsing when few). */
  private movesRing(ctx: CanvasRenderingContext2D, sim: FirmamentSim, x: number, y: number, r: number, T: number): void {
    const few = sim.movesLeft <= 3 && sim.stage === 'play';
    const pulse = few && !this.opts.reducedMotion ? 1 + Math.sin(T * 8) * 0.05 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, TAU);
    ctx.fillStyle = few ? 'rgba(120,30,60,.85)' : 'rgba(10,14,44,.9)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.strokeStyle = few ? '#ff8fb0' : C.gold;
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, r * 1.02, SERIF);
    ctx.fillText(String(Math.max(0, sim.movesLeft)), x, y + r * 0.04);
  }

  /** The goal's items in a row from x0 to x1 (an icon and what is left of it; the points of a score level fitted to the room). */
  private goalRow(ctx: CanvasRenderingContext2D, sim: FirmamentSim, x0: number, x1: number, y: number, iconR: number, px: number, T: number): void {
    const items = this.goalItems(sim);
    const step = (x1 - x0) / Math.max(1, items.length);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    items.forEach((it, k) => {
      const ix = x0 + k * step + iconR;
      it.icon(ctx, ix, y, iconR, T);
      ctx.fillStyle = it.left <= 0 ? C.mint : C.cream;
      const room = step - iconR * 2.3 - 6;
      // done: a tick (a score level keeps counting toward its stars, so it keeps its points beside the tick)
      const s = fitText(ctx, it.left <= 0 ? it.done : it.text, room, px, 800, SANS, 12);
      ctx.fillText(s, ix + iconR * 1.3, y);
    });
  }

  /** The level's score bar with its star marks (one for the goal of a score level, then two and three stars). */
  private scoreBar(ctx: CanvasRenderingContext2D, sim: FirmamentSim, x0: number, x1: number, y: number, u: number): void {
    const lv = sim.level;
    const top = lv.stars[1] * 1.08;
    const k = clamp(sim.levelScore / top);
    const bh = 6 * u;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.roundRect(x0, y - bh / 2, x1 - x0, bh, bh / 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, '#9d8cff');
    grad.addColorStop(1, C.gold);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x0, y - bh / 2, Math.max(bh, (x1 - x0) * k), bh, bh / 2);
    ctx.fill();
    const marks = lv.goal === 'score' ? [lv.n, lv.stars[0], lv.stars[1]] : [lv.stars[0], lv.stars[1]];
    for (const m of marks) paintStar(ctx, x0 + (x1 - x0) * clamp(m / top), y, 6.5 * u + 1, sim.levelScore >= m ? 1 : 0, C.gold);
  }

  private goalItems(sim: FirmamentSim): { icon: (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, T: number) => void; left: number; text: string; done: string }[] {
    const lv = sim.level, B = sim.board;
    switch (lv.goal) {
      case 'score': {
        const left = Math.max(0, lv.n - sim.levelScore), now = fmtNum(Math.round(sim.levelScore));
        return [{ icon: (c, x, y, r) => paintStar(c, x, y, r * 0.9, 1, C.gold), left, text: `${now} / ${fmtNum(lv.n)}`, done: `${now} ✓` }];
      }
      case 'clouds': return [{ icon: (c, x, y, r) => paintCloudIcon(c, x, y, r), left: B.cloudLeft, text: String(B.cloudLeft), done: '✓' }];
      case 'moons': return [{ icon: (c, x, y, r, T) => paintMoon(c, x, y, r * 0.85, T), left: B.moonsLeft, text: String(B.moonsLeft), done: '✓' }];
      case 'rocks': return [{ icon: (c, x, y, r) => paintRock(c, x, y, r * 0.9, 2, 5), left: B.rocksLeft, text: String(B.rocksLeft), done: '✓' }];
      case 'collect': return lv.want.map(w => ({ icon: (c: CanvasRenderingContext2D, x: number, y: number, r: number) => paintBody(c, w.of, x, y, r * 0.85), left: sim.wantLeft(w.of), text: String(sim.wantLeft(w.of)), done: '✓' }));
    }
  }

  // ── the telescope ───────────────────────────────────────────────
  /** The brass rim and the dark glass, painted once per radius (the frame only adds the light). */
  private lensSprite(r: number): HTMLCanvasElement | null {
    const dpr = typeof window !== 'undefined' ? Math.min(3, window.devicePixelRatio || 1) : 1;
    const key = `${Math.round(r * 10)}@${dpr}`;
    if (this.lens?.key === key) return this.lens.c;
    let c: HTMLCanvasElement | null = null;
    if (typeof document !== 'undefined') {
      const R = r * 1.14, s = Math.ceil(R * 2 + 2);
      c = document.createElement('canvas');
      c.width = Math.ceil(s * dpr);
      c.height = Math.ceil(s * dpr);
      const g = c.getContext('2d');
      if (g) {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        const x = s / 2, y = s / 2;
        const rim = g.createLinearGradient(x - r, y - r, x + r, y + r);
        rim.addColorStop(0, '#f6d58a');
        rim.addColorStop(0.5, '#b07a2c');
        rim.addColorStop(1, '#f0c56a');
        g.fillStyle = rim;
        g.beginPath();
        g.arc(x, y, r * 1.12, 0, TAU);
        g.fill();
        const lens = g.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
        lens.addColorStop(0, '#1a2160');
        lens.addColorStop(1, '#050719');
        g.fillStyle = lens;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      } else c = null;
    }
    this.lens = { key, c };
    return c;
  }

  private drawScope(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const { x, y, r } = L.scope, u = L.u, look = sim.look;
    ctx.save();
    // the light trail round the top: the last 40 s, a star a second
    const bars = traceBars(sim.trace, sim.t, 40);
    const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92, tr = r * 1.3;
    bars.forEach((b, i) => {
      if (b.empty || b.shown <= 0) return;
      const a = a0 + ((a1 - a0) * i) / (bars.length - 1);
      const sx = x + Math.cos(a) * tr, sy = y + Math.sin(a) * tr;
      const lev = b.phase === 'rest' ? b.calm : b.level;
      const size = (1.2 + lev * 2.6) * Math.max(0.8, Math.min(1.2, r / 40));
      ctx.globalAlpha = b.shown;
      if (!b.reliable) {
        ctx.strokeStyle = 'rgba(246,239,220,.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.6, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = b.phase === 'rest' ? `rgba(150,200,255,${0.35 + lev * 0.6})` : b.above ? C.gold : `rgba(246,239,220,${0.25 + lev * 0.4})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, TAU);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
    // the brass rim and the lens
    const sprite = this.lensSprite(r);
    if (sprite) {
      const s = Math.ceil(r * 1.14 * 2 + 2);
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
    } else {
      ctx.fillStyle = '#b07a2c';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.12, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0b1033';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.clip();
    const lev = sim.level01;
    if (look === 'live' || look === 'lead' || look === 'warm') {
      const above = lev >= 0.5 && look === 'live';
      const R = r * 0.94 * clamp(lev);
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, R));
      g.addColorStop(0, above ? 'rgba(255,248,214,1)' : 'rgba(220,226,255,.9)');
      g.addColorStop(0.6, above ? 'rgba(255,205,110,.85)' : 'rgba(150,160,230,.5)');
      g.addColorStop(1, above ? 'rgba(255,170,60,0)' : 'rgba(120,130,220,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R * 1.15, 0, TAU);
      ctx.fill();
      if (above && !this.opts.reducedMotion) {
        // light pouring in
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 4; k++) {
          const ph = (T * 0.8 + k / 4) % 1;
          ctx.strokeStyle = `rgba(255,220,140,${0.5 * (1 - ph)})`;
          ctx.beginPath();
          ctx.arc(x, y, r * (1 - ph * 0.6), 0, TAU);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    } else if (look === 'rest') {
      const R = r * (0.3 + 0.7 * sim.sky);
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, 'rgba(200,230,255,.9)');
      g.addColorStop(1, 'rgba(90,150,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, R, 0, TAU);
      ctx.fill();
      // a falling star crossing the lens now and then
      const ph = (T * 0.35) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - ph)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r + ph * r * 1.6, y - r * 0.6 + ph * r);
      ctx.lineTo(x - r + ph * r * 1.6 - r * 0.3, y - r * 0.6 + ph * r - r * 0.18);
      ctx.stroke();
    } else if (look === 'blind') {
      // drifting clouds: soft discs (no gradient per puff on a phone's frame)
      for (let k = 0; k < 6; k++) {
        const cx = x + Math.sin(T * 0.4 + k * 1.3) * r * 0.5, cy = y + Math.cos(T * 0.3 + k) * r * 0.4;
        ctx.fillStyle = 'rgba(140,130,180,.32)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.48, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    // the threshold ring on the lens itself (0.5 of its radius) — the line between dim and gold
    if (look !== 'blind' && look !== 'rest') {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = look === 'grey' ? 'rgba(246,239,220,.3)' : 'rgba(255,240,200,.85)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.94 * 0.5, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
    // the charge ring round the rim (toward the next tool), or the calm sky's star pips
    ctx.lineCap = 'round';
    const lw = Math.max(3, r * 0.1);
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.arc(x, y, r * 1.06, 0, TAU);
    ctx.stroke();
    if (look === 'rest') {
      ctx.strokeStyle = '#9fd0ff';
      ctx.beginPath();
      ctx.arc(x, y, r * 1.06, -Math.PI / 2, -Math.PI / 2 + TAU * sim.starProgress);
      ctx.stroke();
      for (let k = 0; k < RULES.starMax; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.42;
        const px = x + Math.cos(a) * r * 0.62, py = y + Math.sin(a) * r * 0.62 + r * 0.2;
        const lit = k < sim.starsBlock;
        const pop = lit && this.pips.n === k + 1 ? 1 + Math.max(0, 1 - (this.clock - this.pips.t) * 2) * 0.6 : 1;
        paintStar(ctx, px, py, r * 0.13 * pop, lit ? 1 : 0, '#e6f2ff');
      }
    } else if (look !== 'blind') {
      const k = clamp(sim.charge);
      if (k > 0.005) {
        // a soft glow under the ring (a wide faint stroke, not a blur)
        ctx.strokeStyle = 'rgba(255,210,122,.25)';
        ctx.lineWidth = lw * 2.4;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.06, -Math.PI / 2, -Math.PI / 2 + TAU * k);
        ctx.stroke();
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = lw;
        ctx.stroke();
      }
      if (sim.hold > 2 && !sim.nextPulsar) {
        ctx.strokeStyle = '#c9a8ff';
        ctx.lineWidth = Math.max(2, r * 0.05);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.84, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.hold / RULES.pulsarHold));
        ctx.stroke();
      }
      if (sim.nextPulsar) paintToolIcon(ctx, 'pulsar', x + r * 0.8, y - r * 0.8, r * 0.28, T);
    }
    ctx.lineCap = 'butt';
    this.scopeWords(ctx, L, sim, u);
    ctx.restore();
  }

  /** The telescope's words: under it in a column; on a phone upright a tooltip over the lens when they change. */
  private scopeWords(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, u: number): void {
    const armed = sim.armedTool;
    const aimed = !!armed && AIMED.includes(armed);
    const st = this.scopeLine(sim);
    const gold = sim.look === 'live' && sim.level01 >= 0.5;
    const tx = L.scopeText;
    if (tx) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      let y = tx.y;
      if (L.mode === 'wide') {
        ctx.fillStyle = C.cream;
        ctx.font = font(700, 15 * u, SERIF);
        ctx.fillText(t('scope.title'), tx.x, y);
        y += 21 * u;
      }
      // an armed tool's use takes the line (the tray is right under it); as many lines as the room holds, up to three
      const text = aimed ? t(`use.${armed}` as 'use.ray') : st;
      const px = 13 * Math.min(u, 1.15);
      ctx.fillStyle = aimed ? C.gold : gold ? C.gold : C.dim;
      ctx.font = font(650, px, SANS);
      const lines = wrapLines(ctx, text, tx.w);
      const lh = fontPx(px) * 1.25;
      const most = clamp(Math.floor((tx.y + tx.h - y) / lh), 1, 3);
      lines.slice(0, most).forEach((s, i) => {
        const last = i === most - 1 && lines.length > most;
        if (last) ctx.fillText(fitText(ctx, lines.slice(i).join(' '), tx.w, px, 650, SANS), tx.x, y + i * lh);
        else {
          ctx.font = font(650, px, SANS);
          ctx.fillText(s, tx.x, y + i * lh);
        }
      });
      return;
    }
    // a phone upright: what the telescope says, for a moment, when it changes (not each per cent of the charge)
    const key = this.scopeKey(sim);
    if (key !== this.tipKey) {
      this.tipKey = key;
      this.tip = key && key !== 'live' && key !== 'warm' ? { text: st, t: this.clock } : null;
    }
    if (aimed) return;
    const tip = this.tip;
    if (!tip) return;
    const since = this.clock - tip.t;
    if (since > TIP_SEC) { this.tip = null; return; }
    const a = since < 0.2 ? since / 0.2 : since > TIP_SEC - 0.4 ? (TIP_SEC - since) / 0.4 : 1;
    const s = L.scope;
    pill(ctx, L, tip.text, s.x, s.y - s.r * 1.45 - 6, gold ? C.gold : C.cream, clamp(a), u);
  }

  /** What the telescope's words are about (the charge's per cents aside): a change shows them on a phone. */
  private scopeKey(sim: FirmamentSim): string {
    if (sim.look === 'live') return sim.nextPulsar ? 'pulsar' : sim.tray.length >= sim.traySize ? 'full' : 'live';
    if (sim.look === 'rest') return `rest:${sim.starsBlock}`;
    return sim.look;
  }

  private scopeLine(sim: FirmamentSim): string {
    switch (sim.look) {
      case 'live': return sim.nextPulsar ? t('scope.pulsar') : sim.tray.length >= sim.traySize ? t('scope.full') : t('scope.charge', { n: Math.round(sim.charge * 100) });
      case 'lead': return t('scope.lead', { n: sim.leadIn });
      case 'blind': return t('scope.blind');
      case 'grey': return t('scope.grey');
      case 'rest': return t('scope.rest', { n: sim.starsBlock, all: RULES.starMax });
      default: return t('scope.warm');
    }
  }

  // ── the tray ────────────────────────────────────────────────────
  private drawTray(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const u = L.u;
    ctx.save();
    for (let k = 0; k < sim.traySize && k < L.tray.length; k++) {
      const r = L.tray[k];
      const tool = sim.tray[k];
      const armed = sim.armed === k;
      const pressed = this.pressSlot === k && !!tool;
      const fl = this.toolFlash && this.toolFlash.slot === k ? Math.max(0, 1 - (this.clock - this.toolFlash.t)) : 0;
      ctx.save();
      if (pressed) {
        // pressed under the finger: a little smaller and brighter, before the finger lifts
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        ctx.translate(cx, cy);
        ctx.scale(0.93, 0.93);
        ctx.translate(-cx, -cy);
      }
      ctx.fillStyle = armed ? 'rgba(255,210,122,.28)' : pressed ? 'rgba(60,64,120,.9)' : 'rgba(10,14,44,.82)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, r.w * 0.22);
      ctx.fill();
      if (armed || fl > 0) {
        // the glow round an armed or a new tool (a wide faint stroke, not a blur)
        ctx.strokeStyle = `rgba(255,210,122,${armed ? 0.3 : 0.45 * fl})`;
        ctx.lineWidth = 7;
        ctx.stroke();
      }
      ctx.lineWidth = armed ? 2.5 : tool ? 1.5 : 1.2;
      ctx.strokeStyle = armed ? C.gold : tool ? 'rgba(255,220,150,.55)' : 'rgba(246,239,220,.2)';
      if (!tool) ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (tool) {
        const bob = armed && !this.opts.reducedMotion ? Math.sin(T * 6) * 2 : 0;
        paintToolIcon(ctx, tool, r.x + r.w / 2, r.y + r.h / 2 + bob, r.w * 0.36 * (1 + fl * 0.3), T);
      }
      if (!this.opts.touch) {
        // the keyboard's shortcut, a desktop only
        ctx.fillStyle = 'rgba(246,239,220,.45)';
        ctx.font = font(700, 11 * u, SANS);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(k + 1), r.x + 5, r.y + 4);
      }
      ctx.restore();
    }
    // the tools' names over a desktop's tray
    const armed = sim.armedTool;
    if (L.mode === 'wide' && sim.tray.length && !armed) {
      const x0 = Math.min(...L.tray.map(r => r.x)), x1 = Math.max(...L.tray.map(r => r.x + r.w));
      const top = Math.min(...L.tray.map(r => r.y));
      ctx.fillStyle = C.dim;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const s = fitText(ctx, sim.tray.map(x => toolName(x)).join(' · '), x1 - x0 + 40, 12 * u, 650, SANS);
      ctx.fillText(s, (x0 + x1) / 2, top - 8);
    }
    ctx.restore();
  }

  /** How to use the armed tool, over its slot on a phone upright (the column's words say it elsewhere); over Bubo's bubble. */
  private drawUse(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim): void {
    const armed = sim.armedTool;
    if (!armed || !AIMED.includes(armed) || L.scopeText || sim.stage !== 'play') return;
    const r = L.tray[Math.min(sim.armed, L.tray.length - 1)];
    pill(ctx, L, t(`use.${armed}` as 'use.ray'), r.x + r.w / 2, r.y - 8, C.gold, 1, L.u);
  }

  // ── Bubo ────────────────────────────────────────────────────────
  private drawOwl(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number, quiet: boolean): void {
    const o = L.owl;
    const b = this.bubble;
    const since = b ? this.clock - b.t : 99;
    const talking = since < 3.4 && !quiet;
    const cheer = sim.stage === 'won' ? 0.6 + Math.sin(T * 8) * 0.3 : 0;
    const hop = (sim.stage === 'won' || (this.toolFlash && this.clock - this.toolFlash.t < 0.6)) && !this.opts.reducedMotion ? Math.abs(Math.sin(T * 7)) : 0;
    paintOwl(ctx, o.x, o.y, o.r, { t: T, look: Math.sin(T * 0.5) * 0.6, hop, cheer, sleepy: sim.look === 'rest' ? 0.6 : 0 });
    if (!b || !talking) return;
    const a = since < 0.2 ? since / 0.2 : since > 3 ? (3.4 - since) / 0.4 : 1;
    const uu = Math.min(L.u, 1.15);
    // a narrow column (a phone on its side) takes the line in more rows of a slightly smaller size
    const narrow = L.bubble.w < 200;
    const px = (narrow ? 13 : 14) * uu;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.font = font(650, px, SANS);
    const pad = 10;
    const all = wrapLines(ctx, b.text, L.bubble.w - pad * 2);
    const most = narrow ? 6 : 4;
    const lines = all.length > most ? [...all.slice(0, most - 1), fitText(ctx, all.slice(most - 1).join(' '), L.bubble.w - pad * 2, px, 650, SANS)] : all;
    ctx.font = font(650, px, SANS);
    const lh = fontPx(px) * 1.25;
    const bw = Math.min(L.bubble.w, Math.max(...lines.map(s => ctx.measureText(s).width)) + pad * 2);
    const bh = lines.length * lh + pad * 1.3;
    const beside = L.mode === 'wide';
    // a column's bubble rises above Bubo; a desktop's sits to his right
    const bx = clamp(L.bubble.x, 6, L.w - bw - 6);
    const by = beside ? L.bubble.y - bh / 2 : L.bubble.y - bh;
    const pop = since < 0.2 ? ease.outBack(since / 0.2) : 1;
    ctx.translate(o.x, L.bubble.y);
    ctx.scale(pop, pop);
    ctx.translate(-o.x, -L.bubble.y);
    ctx.fillStyle = '#fff7e3';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.beginPath();
    if (beside) {
      ctx.moveTo(bx + 1, by + bh * 0.4);
      ctx.lineTo(bx + 1, by + bh * 0.4 + 14);
      ctx.lineTo(o.x + o.r * 0.9, o.y - o.r * 0.2);
    } else {
      const tx = clamp(o.x, bx + 14, bx + bw - 14);
      ctx.moveTo(tx - 7, by + bh - 1);
      ctx.lineTo(tx + 7, by + bh - 1);
      ctx.lineTo(o.x + o.r * 0.2, Math.max(by + bh + 4, o.y - o.r * 1.15));
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1724';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, bx + pad, by + pad * 0.65 + i * lh));
    ctx.restore();
  }

  // ── cards ───────────────────────────────────────────────────────
  private appear(): number { return ease.outBack(clamp((this.clock - this.cardT) / 0.35)); }

  private drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = cardRect(L, 'story'), u = L.u;
    const c = sim.storyConst;
    const uu = Math.min(u, 1.15);
    ctx.save();
    zoom(ctx, r, this.appear(), L);
    panel(ctx, r, 18, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const pad = 14 * uu, cx = r.x + r.w / 2, tw = r.w - 36;
    let y = r.y + pad;
    ctx.fillStyle = C.gold;
    ctx.font = font(800, 13 * uu, SANS);
    ctx.fillText(fitText(ctx, sim.storyOpen ? 'FIRMAMENT' : t('story.const', { n: c + 1 }).toUpperCase(), tw, 13 * uu, 800, SANS), cx, y);
    y += 20 * uu;
    ctx.fillStyle = C.cream;
    const title = sim.storyOpen ? t('bubo.name') : constName(c);
    ctx.fillText(fitText(ctx, title, tw, 24 * uu, 700, SERIF, 16), cx, y);
    y += 32 * uu;
    // the story, the passage, the tap line; the figure takes what room is left between the title and the story
    ctx.font = font(500, 15 * uu, SANS);
    const lines = wrapLines(ctx, sim.storyOpen ? t('story.open') : storyText(c), tw);
    const lh = fontPx(15 * uu) * 1.32;
    const tapH = 22 * uu;
    const id: PassageId = sim.storyOpen ? 'psa147.4' : CONSTELLATIONS[c % CONSTELLATIONS.length].verse;
    const fixed = y - r.y + lines.length * lh + 10 + tapH + pad;
    const figMin = 44 * uu;
    const room = r.h - fixed - Math.min(figMin, r.h * 0.12) - 8;
    const key = `${id}:${Math.round(r.w)}:${Math.round(room)}`;
    if (!this.verse || this.verse.key !== key) this.verse = { key, l: layoutPassage(ctx, passage(id), r.w - 44, Math.max(40, room), { max: Math.round(19 * uu), min: 13 }) };
    const vh = this.verse.l.height;
    const figH = Math.max(0, Math.min(r.h * 0.3, r.h - fixed - vh - 8));
    if (figH >= 30) {
      if (sim.storyOpen) paintOwl(ctx, cx, y + figH * 0.52, figH * 0.36, { t: T, look: Math.sin(T) * 0.5 });
      else drawFigure(ctx, c, { x: cx - Math.min(r.w * 0.3, figH * 1.4), y, w: Math.min(r.w * 0.6, figH * 2.8), h: figH }, 0, T, -1);
      y += figH + 6;
    }
    ctx.fillStyle = C.cream;
    ctx.font = font(500, 15 * uu, SANS);
    lines.forEach(s => { ctx.fillText(s, cx, y); y += lh; });
    drawPassage(ctx, passage(id), this.verse.l, cx, y + 8, { text: '#f3e6c4', ref: C.gold });
    ctx.fillStyle = C.dim;
    ctx.font = font(650, 13 * uu, SANS);
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('story.tap'), cx, r.y + r.h - pad + 2);
    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = cardRect(L, 'intro'), u = L.u, lv = sim.level;
    const uu = Math.min(u, 1.15);
    ctx.save();
    zoom(ctx, r, this.appear(), L);
    panel(ctx, r, 18, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = r.x + r.w / 2, tw = r.w - 32;
    ctx.fillStyle = lv.hard ? '#ff8fb0' : C.gold;
    ctx.fillText(fitText(ctx, (lv.hard ? t('card.hard') : constName(lv.constellation)).toUpperCase(), tw, 13 * uu, 800, SANS), cx, r.y + r.h * 0.11);
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 28 * uu, SERIF);
    ctx.fillText(t('card.level', { n: lv.index + 1 }), cx, r.y + r.h * 0.26);
    // the goal, big
    const items = this.goalItems(sim);
    const ir = Math.min(22 * uu, r.h * 0.09);
    const gw = items.length * ir * 4.2;
    items.forEach((it, k) => {
      const ix = cx - gw / 2 + ir * 2.1 + k * ir * 4.2;
      it.icon(ctx, ix - ir * 0.7, r.y + r.h * 0.46, ir, T);
      ctx.font = font(800, ir * 0.95, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      if (lv.goal !== 'score') ctx.fillText(String(lv.goal === 'collect' ? lv.want[k].n : lv.n), ix + ir * 0.5, r.y + r.h * 0.46);
    });
    ctx.textAlign = 'center';
    ctx.fillStyle = C.cream;
    const goalText = lv.goal === 'score' ? t('goal.score', { pts: pts(lv.n) }) : t(`goal.${lv.goal}` as 'goal.clouds');
    ctx.fillText(fitText(ctx, goalText, tw, 17 * uu, 650, SANS, 13), cx, r.y + r.h * 0.64);
    ctx.fillStyle = C.dim;
    ctx.font = font(600, 15 * uu, SANS);
    ctx.fillText(t('card.in', { n: lv.moves }), cx, r.y + r.h * 0.77);
    ctx.fillStyle = C.faint;
    ctx.font = font(650, 13 * uu, SANS);
    ctx.fillText(t('card.tap'), cx, r.y + r.h * 0.9);
    ctx.restore();
  }

  private drawWon(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = cardRect(L, 'won'), u = L.u, lv = sim.level;
    const uu = Math.min(u, 1.15);
    const since = this.clock - this.cardT;
    ctx.save();
    zoom(ctx, r, this.appear(), L);
    panel(ctx, r, 18, true);
    const cx = r.x + r.w / 2, tw = r.w - 32;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.gold;
    ctx.fillText(fitText(ctx, t('won.title'), tw, 26 * uu, 700, SERIF, 16), cx, r.y + r.h * 0.1);
    // three stars, one after another
    const sr = Math.min(22 * uu, r.h * 0.07);
    for (let k = 0; k < 3; k++) {
      const at = 0.35 + k * 0.35;
      const lit = k < sim.lastStars && since >= at;
      const pop = lit ? ease.outBack(clamp((since - at) / 0.3)) : 1;
      const sx = cx + (k - 1) * sr * 2.3, sy = r.y + r.h * 0.24 - (k === 1 ? sr * 0.35 : 0);
      paintStar(ctx, sx, sy, (k === 1 ? sr : sr * 0.82) * pop, lit ? 1 : 0, C.gold);
    }
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 20 * uu, SANS);
    ctx.fillText(pts(sim.levelScore), cx, r.y + r.h * 0.37);
    // the map: the constellation, the stars won lit, the new one igniting
    const box = { x: r.x + r.w * 0.12, y: r.y + r.h * 0.44, w: r.w * 0.76, h: r.h * 0.36 };
    drawFigure(ctx, lv.constellation, box, lv.star + 1, T, lv.star, clamp((since - 0.8) / 0.6));
    ctx.fillStyle = C.dim;
    const constDone = lv.star === RULES.perConst - 1;
    ctx.fillText(fitText(ctx, constDone ? t('won.const', { name: constName(lv.constellation) }) : t('won.next', { n: lv.index + 2 }), tw, 15 * uu, 650, SANS, 13), cx, r.y + r.h * 0.89);
    ctx.restore();
  }

  private drawOut(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = cardRect(L, 'out'), u = L.u;
    const uu = Math.min(u, 1.15);
    ctx.save();
    zoom(ctx, r, this.appear(), L);
    panel(ctx, r, 18, true);
    const cx = r.x + r.w / 2, tw = r.w - 32;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.cream;
    ctx.fillText(fitText(ctx, t('out.title'), tw, 24 * uu, 700, SERIF, 16), cx, r.y + 32 * uu);
    ctx.fillStyle = sim.outNear ? C.gold : C.dim;
    ctx.fillText(fitText(ctx, t('out.left', { what: sim.outWhat }), tw, 16 * uu, 650, SANS, 13), cx, r.y + 66 * uu);
    const can = sim.tray.includes('moves');
    const b = outButtons(L, can);
    if (b.use) {
      button(ctx, b.use, t('out.use', { n: RULES.toolMoves }), true, uu);
      paintToolIcon(ctx, 'moves', b.use.x + b.use.h * 0.55, b.use.y + b.use.h / 2, b.use.h * 0.36, T);
    }
    button(ctx, b.retry, t('out.retry'), !can, uu);
    // the gentle clock to the retry
    const k = clamp(sim.stageT / RULES.outSec);
    ctx.fillStyle = C.faint;
    ctx.fillText(fitText(ctx, t('out.soon'), tw, 13 * uu, 600, SANS), cx, r.y + r.h - 18 * uu);
    ctx.fillStyle = 'rgba(255,210,122,.6)';
    ctx.fillRect(r.x + 20, r.y + r.h - 6, (r.w - 40) * k, 3);
    ctx.restore();
  }
}

/** The card that a stage shows (for the targets): the story, the goal, the tally, out of moves. */
export const cardOf = (stage: string): CardKind | null => (stage === 'story' || stage === 'intro' || stage === 'won' || stage === 'out' ? stage : null);

// ── small brushes ─────────────────────────────────────────────────
function panel(ctx: CanvasRenderingContext2D, r: Rect, rad: number, strong = false): void {
  ctx.save();
  ctx.fillStyle = strong ? '#0c0f30' : 'rgba(12,15,48,.8)';
  ctx.strokeStyle = strong ? 'rgba(255,220,150,.45)' : 'rgba(255,220,150,.22)';
  ctx.lineWidth = strong ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A card's entrance: it grows from 85 % (a bottom sheet rises from below instead). */
function zoom(ctx: CanvasRenderingContext2D, r: Rect, k: number, L: Layout): void {
  ctx.globalAlpha = clamp(k * 1.5);
  if (L.anchor === 'bottom') {
    ctx.translate(0, (1 - clamp(k)) * Math.min(80, r.h * 0.3));
    return;
  }
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.translate(cx, cy);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.translate(-cx, -cy);
}

/** A short line in a dark pill centred at x with its lower edge at `bottom` (kept on the screen): the telescope's words, a tool's use. */
function pill(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, bottom: number, color: string, alpha: number, u: number): void {
  const uu = Math.min(u, 1.15);
  const maxW = Math.min(L.band.w - 12, 300 * uu);
  ctx.save();
  ctx.globalAlpha = alpha;
  const s = fitText(ctx, text, maxW - 24, 13 * uu, 700, SANS, 12);
  const w = ctx.measureText(s).width + 24, h = fontPx(13 * uu) + 14;
  const px = clamp(x - w / 2, L.band.x + 6, L.band.x + L.band.w - 6 - w);
  ctx.fillStyle = 'rgba(8,10,34,.9)';
  ctx.strokeStyle = 'rgba(255,220,150,.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px, bottom - h, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, px + w / 2, bottom - h / 2 + 0.5);
  ctx.restore();
}

function button(ctx: CanvasRenderingContext2D, r: Rect, text: string, primary: boolean, u: number): void {
  ctx.save();
  ctx.fillStyle = primary ? C.gold : 'rgba(255,255,255,.1)';
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fill();
  ctx.strokeStyle = primary ? '#fff2c8' : 'rgba(255,255,255,.3)';
  ctx.stroke();
  ctx.fillStyle = primary ? '#1d1440' : C.cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // the icon of +5 sits at the left end: the words keep clear of it
  const s = fitText(ctx, text, r.w - r.h * 2.2, 16 * u, 750, SANS, 13);
  ctx.fillText(s, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

/**
 * A constellation on the saga map: its lines, its eight stars (lit up to `lit`), the newest one
 * igniting (`fresh` ≥ 0, `k` 0..1) and the next one waiting with a soft ring.
 */
export function drawFigure(ctx: CanvasRenderingContext2D, c: number, box: Rect, lit: number, T: number, fresh: number, k = 1): void {
  const f = figure(c);
  const P = f.stars.map(([x, y]) => ({ x: box.x + x * box.w, y: box.y + y * box.h }));
  const sz = Math.max(4, Math.min(box.w, box.h) * 0.06);
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const [a, b] of f.lines) {
    const on = a < lit && b < lit;
    ctx.strokeStyle = on ? 'rgba(255,215,130,.75)' : 'rgba(246,239,220,.18)';
    ctx.setLineDash(on ? [] : [3, 4]);
    ctx.beginPath();
    ctx.moveTo(P[a].x, P[a].y);
    ctx.lineTo(P[b].x, P[b].y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  P.forEach((p, i) => {
    const isFresh = i === fresh;
    const on = i < lit && (!isFresh || k > 0);
    const s = isFresh ? sz * (1 + (1 - k) * 1.2) : sz;
    if (on) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s * 3);
      g.addColorStop(0, `rgba(255,220,140,${isFresh ? 0.5 + 0.4 * k : 0.35})`);
      g.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 3, 0, TAU);
      ctx.fill();
    }
    paintStar(ctx, p.x, p.y, s, on ? (isFresh ? k : 1) : 0, C.gold);
    if (i === lit && i < f.stars.length) {
      ctx.strokeStyle = `rgba(255,240,200,${0.4 + 0.3 * Math.sin(T * 4)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 2, 0, TAU);
      ctx.stroke();
    }
  });
  ctx.restore();
}

/** For the lobby: the kinds' colours by index (the progress card's chips). */
export const kindColor = (k: number): string => (k === MOON ? '#fff4c8' : KIND_COLOR[k]?.main ?? '#fff');
