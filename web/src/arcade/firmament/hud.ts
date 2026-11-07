/**
 * Firmament's own screen parts, drawn on the canvas over the board (the runner draws the Mendi panel
 * and the score; this never repeats them):
 *
 *   the goal card     the level, the moves left in a big ring, what is still to clear (clouds, moons,
 *                     asteroids, bodies of a kind, or the target score) and the score bar with its stars
 *   the telescope     the band in the world: the lens fills with light (`level`, 0.5 = the dashed
 *                     threshold ring on the lens itself), the charge ring round the rim fills toward the
 *                     next tool, a violet arc counts a long hold toward a pulsar; clouds cover it in a
 *                     blind block; in the calm sky it glows blue and three pips count the falling stars.
 *                     Round its top runs the light trail: the last 40 s, a star a second, gold above the
 *                     threshold, blue in rest, hollow without signal, hidden under a blind block's veil
 *   the tray          the tools, an armed one glowing, how to use it underneath
 *   Bubo              the owl and his speech bubble
 *   the cards         the story card (the constellation, the story, its passage), the goal card before a
 *                     level, the tally after it (stars, score, the constellation with the new star lit),
 *                     and out of moves (what was missing, +5 from the telescope, try again)
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, wrapLines, type PassageLayout, type PassageId } from '../kit/scripture';
import { traceBars } from '../kit/trace';
import { MOON } from './board';
import { AIMED, CONSTELLATIONS, constName, figure, storyText, toolName } from './content';
import { pts, t } from './i18n';
import { inRect, type Layout, type Rect } from './layout';
import { C, KIND_COLOR, SANS, SERIF, font, paintBody, paintCloudIcon, paintMoon, paintOwl, paintRock, paintStar, paintToolIcon } from './paint';
import { RULES, type FirmamentSim } from './sim';

export type Hit = { cell: number } | { slot: number } | { button: 'use' | 'retry' | 'card' };

const TAU = Math.PI * 2;

export class HudDraw {
  private cardKind = '';
  private cardT = 0;
  private bubble: { text: string; t: number } | null = null;
  private toolFlash: { slot: number; t: number } | null = null;
  private pips = { n: 0, t: -9 };
  private buttons: { kind: 'use' | 'retry'; r: Rect }[] = [];
  private verse: { key: string; l: PassageLayout } | null = null;
  private clock = 0;

  constructor(private readonly opts: { reducedMotion: boolean; eeg: boolean }) {}

  card(kind: string, clock: number): void { this.cardKind = kind; this.cardT = clock; }
  get shown(): string { return this.cardKind; }
  say(text: string, clock: number): void { this.bubble = { text, t: clock }; }
  flashTool(slot: number, clock: number): void { this.toolFlash = { slot, t: clock }; }
  starPip(n: number, clock: number): void { this.pips = { n, t: clock }; }
  update(dt: number): void { this.clock += dt; }

  hit(x: number, y: number, L: Layout, sim: FirmamentSim): Hit | null {
    if (sim.stage === 'out') {
      for (const b of this.buttons) if (inRect(b.r, x, y, 6)) return { button: b.kind };
      return null;
    }
    if (sim.stage === 'story' || sim.stage === 'intro' || sim.stage === 'won') return { button: 'card' };
    for (let k = 0; k < sim.traySize; k++) if (inRect(L.tray[k], x, y, 4)) return { slot: k };
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number, w: number, h: number): void {
    this.drawGoal(ctx, L, sim, T);
    this.drawScope(ctx, L, sim, T);
    this.drawTray(ctx, L, sim, T);
    this.drawOwl(ctx, L, sim, T);
    this.buttons = [];
    if (sim.phase === 'play' || sim.stage === 'won') {
      if (sim.stage === 'story') this.drawStory(ctx, L, sim, T);
      else if (sim.stage === 'intro') this.drawIntro(ctx, L, sim, T);
      else if (sim.stage === 'won') this.drawWon(ctx, L, sim, T);
      else if (sim.stage === 'out') this.drawOut(ctx, L, sim, T);
    }
    void w; void h;
  }

  // ── the goal card ───────────────────────────────────────────────
  private drawGoal(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const g = L.goal, u = L.u, lv = sim.level;
    ctx.save();
    panel(ctx, g, 14 * u);
    const tall = L.mode === 'tall';
    const ringR = tall ? g.h * 0.42 : Math.min(g.h * 0.24, g.w * 0.17);
    const rx = g.x + 10 + ringR, ry = tall ? g.y + g.h / 2 : g.y + 14 * u + 8 + ringR + 14 * u;
    // the level's name
    ctx.textBaseline = 'middle';
    if (!tall) {
      ctx.fillStyle = C.cream;
      ctx.font = font(700, 15 * u, SERIF);
      ctx.textAlign = 'left';
      ctx.fillText(t('strip.level', { n: lv.index + 1 }), g.x + 12, g.y + 16 * u);
      ctx.font = font(600, 11 * u, SANS);
      ctx.fillStyle = C.dim;
      ctx.textAlign = 'right';
      ctx.fillText(lv.hard ? t('strip.hard') : constName(lv.constellation), g.x + g.w - 10, g.y + 16 * u);
      if (lv.hard) { ctx.fillStyle = '#ff8fb0'; ctx.fillText(t('strip.hard'), g.x + g.w - 10, g.y + 16 * u); }
    }
    // the moves in a ring (red and pulsing when few)
    const few = sim.movesLeft <= 3 && sim.stage === 'play';
    const pulse = few ? 1 + Math.sin(T * 8) * 0.05 : 1;
    ctx.beginPath();
    ctx.arc(rx, ry, ringR * pulse, 0, TAU);
    ctx.fillStyle = few ? 'rgba(120,30,60,.85)' : 'rgba(10,14,44,.9)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, ringR * 0.1);
    ctx.strokeStyle = few ? '#ff8fb0' : C.gold;
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.textAlign = 'center';
    ctx.font = font(700, ringR * 0.95, SERIF);
    ctx.fillText(String(Math.max(0, sim.movesLeft)), rx, ry + ringR * 0.04);
    if (!tall) {
      ctx.font = font(700, Math.max(8.5, ringR * 0.26), SANS);
      ctx.fillStyle = C.dim;
      ctx.fillText(t('strip.moves').toUpperCase(), rx, ry + ringR + 9 * u);
    }
    // what is left to do
    const gx = rx + ringR + 12, gw = g.x + g.w - 10 - gx;
    const iconR = tall ? g.h * 0.22 : Math.min(18 * u, gw * 0.14);
    const items = this.goalItems(sim);
    const step = Math.min(gw / Math.max(1, items.length), iconR * 4.2);
    const gy = tall ? g.y + g.h * 0.4 : ry - 4 * u;
    items.forEach((it, k) => {
      const ix = gx + iconR + k * step;
      it.icon(ctx, ix, gy, iconR, T);
      ctx.textAlign = 'left';
      ctx.font = font(800, iconR * 0.95, SANS);
      ctx.fillStyle = it.left <= 0 ? C.mint : C.cream;
      ctx.fillText(it.left <= 0 ? '✓' : it.text, ix + iconR * 1.2, gy);
    });
    // the score bar with its stars
    const by = tall ? g.y + g.h * 0.78 : g.y + g.h - 16 * u;
    const bx0 = tall ? gx : g.x + 12, bx1 = g.x + g.w - 12;
    const top = lv.stars[1] * 1.08;
    const k = clamp(sim.levelScore / top);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.roundRect(bx0, by - 3.5 * u, bx1 - bx0, 7 * u, 4 * u);
    ctx.fill();
    const grad = ctx.createLinearGradient(bx0, 0, bx1, 0);
    grad.addColorStop(0, '#9d8cff');
    grad.addColorStop(1, C.gold);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx0, by - 3.5 * u, Math.max(4, (bx1 - bx0) * k), 7 * u, 4 * u);
    ctx.fill();
    const marks = lv.goal === 'score' ? [lv.n, lv.stars[0], lv.stars[1]] : [lv.stars[0], lv.stars[1]];
    marks.forEach(m => {
      const mx = bx0 + (bx1 - bx0) * clamp(m / top);
      paintStar(ctx, mx, by, 6.5 * u + 1, sim.levelScore >= m ? 1 : 0, C.gold);
    });
    ctx.restore();
  }

  private goalItems(sim: FirmamentSim): { icon: (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, T: number) => void; left: number; text: string }[] {
    const lv = sim.level, B = sim.board;
    switch (lv.goal) {
      case 'score': {
        const left = Math.max(0, lv.n - sim.levelScore);
        return [{ icon: (c, x, y, r) => paintStar(c, x, y, r * 0.9, 1, C.gold), left, text: `${fmtNum(Math.round(sim.levelScore))} / ${fmtNum(lv.n)}` }];
      }
      case 'clouds': return [{ icon: (c, x, y, r) => paintCloudIcon(c, x, y, r), left: B.cloudLeft, text: String(B.cloudLeft) }];
      case 'moons': return [{ icon: (c, x, y, r, T) => paintMoon(c, x, y, r * 0.85, T), left: B.moonsLeft, text: String(B.moonsLeft) }];
      case 'rocks': return [{ icon: (c, x, y, r) => paintRock(c, x, y, r * 0.9, 2, 5), left: B.rocksLeft, text: String(B.rocksLeft) }];
      case 'collect': return lv.want.map(w => ({ icon: (c: CanvasRenderingContext2D, x: number, y: number, r: number) => paintBody(c, w.of, x, y, r * 0.85), left: sim.wantLeft(w.of), text: String(sim.wantLeft(w.of)) }));
    }
  }

  // ── the telescope ───────────────────────────────────────────────
  private drawScope(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const { x, y, r } = L.scope, u = L.u, look = sim.look;
    ctx.save();
    // the light trail round the top: the last 40 s, a star a second
    const bars = traceBars(sim.trace, sim.t, 40);
    const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92, tr = r * 1.32;
    bars.forEach((b, i) => {
      if (b.empty || b.shown <= 0) return;
      const a = a0 + ((a1 - a0) * i) / (bars.length - 1);
      const sx = x + Math.cos(a) * tr, sy = y + Math.sin(a) * tr;
      const lev = b.phase === 'rest' ? b.calm : b.level;
      const size = (1.2 + lev * 2.6) * Math.max(0.8, u);
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
    // the brass rim
    const rim = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    rim.addColorStop(0, '#f6d58a');
    rim.addColorStop(0.5, '#b07a2c');
    rim.addColorStop(1, '#f0c56a');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.12, 0, TAU);
    ctx.fill();
    // the lens
    const lens = ctx.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
    lens.addColorStop(0, '#1a2160');
    lens.addColorStop(1, '#050719');
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
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
      if (above) {
        // light pouring in
        ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 5; k++) {
          const ph = (T * 0.8 + k / 5) % 1;
          ctx.strokeStyle = `rgba(255,220,140,${0.5 * (1 - ph)})`;
          ctx.lineWidth = 1.5;
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
      for (let k = 0; k < 6; k++) {
        const cx = x + Math.sin(T * 0.4 + k * 1.3) * r * 0.5, cy = y + Math.cos(T * 0.3 + k) * r * 0.4;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.6);
        g.addColorStop(0, 'rgba(150,140,190,.75)');
        g.addColorStop(1, 'rgba(120,110,160,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.6, 0, TAU);
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
    ctx.lineWidth = Math.max(3, r * 0.1);
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
      ctx.strokeStyle = C.gold;
      ctx.shadowColor = C.gold;
      ctx.shadowBlur = k > 0.02 ? 8 : 0;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.06, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (sim.hold > 2 && !sim.nextPulsar) {
        ctx.strokeStyle = '#c9a8ff';
        ctx.lineWidth = Math.max(2, r * 0.05);
        ctx.beginPath();
        ctx.arc(x, y, r * 0.84, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.hold / RULES.pulsarHold));
        ctx.stroke();
      }
      if (sim.nextPulsar) paintToolIcon(ctx, 'pulsar', x + r * 0.8, y - r * 0.8, r * 0.28, T);
    }
    // the words under it
    const st = this.scopeLine(sim);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (L.mode === 'wide') {
      ctx.fillStyle = C.cream;
      ctx.font = font(700, 13 * u, SERIF);
      ctx.fillText(t('scope.title'), L.scopeText.x, L.scopeText.y);
      ctx.fillStyle = look === 'live' && sim.level01 >= 0.5 ? C.gold : C.dim;
      ctx.font = font(600, 11 * u, SANS);
      const lines = wrapLines(ctx, st, L.scopeText.w);
      lines.slice(0, 2).forEach((s, i) => ctx.fillText(s, L.scopeText.x, L.scopeText.y + 17 * u + i * 14 * u));
    } else if (!sim.armedTool) {
      // a phone: one short line under the tray
      ctx.fillStyle = look === 'live' && sim.level01 >= 0.5 ? C.gold : C.dim;
      let size = 10.5;
      ctx.font = font(650, size, SANS);
      while (size > 7.5 && ctx.measureText(st).width > L.scopeText.w) { size -= 0.5; ctx.font = font(650, size, SANS); }
      const line = wrapLines(ctx, st, L.scopeText.w)[0] ?? '';
      ctx.fillText(line, L.scopeText.x, L.scopeText.y + 2);
    }
    ctx.restore();
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
      const fl = this.toolFlash && this.toolFlash.slot === k ? Math.max(0, 1 - (this.clock - this.toolFlash.t)) : 0;
      ctx.fillStyle = armed ? 'rgba(255,210,122,.28)' : 'rgba(10,14,44,.78)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, r.w * 0.22);
      ctx.fill();
      ctx.lineWidth = armed ? 2.5 : 1.2;
      ctx.strokeStyle = armed ? C.gold : tool ? 'rgba(255,220,150,.45)' : 'rgba(246,239,220,.18)';
      if (!tool) ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (fl > 0) {
        ctx.shadowColor = C.gold;
        ctx.shadowBlur = 20 * fl;
        ctx.strokeStyle = `rgba(255,220,140,${fl})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (tool) {
        const bob = armed && !this.opts.reducedMotion ? Math.sin(T * 6) * 2 : 0;
        paintToolIcon(ctx, tool, r.x + r.w / 2, r.y + r.h / 2 + bob, r.w * 0.36 * (1 + fl * 0.3), T);
      }
      ctx.fillStyle = 'rgba(246,239,220,.4)';
      ctx.font = font(700, 9 * u + 1, SANS);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(k + 1), r.x + 4, r.y + 3);
    }
    // how to use the armed tool, or the tray's name
    const armed = sim.armedTool;
    const r0 = L.tray[0], rl = L.tray[Math.min(sim.traySize, L.tray.length) - 1];
    const cx = (r0.x + rl.x + rl.w) / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font(650, 11 * u + 0.5, SANS);
    if (armed && AIMED.includes(armed)) {
      ctx.fillStyle = C.gold;
      ctx.fillText(t(`use.${armed}` as 'use.ray'), cx, r0.y + r0.h + 5);
    } else if (L.mode === 'wide' && sim.tray.length) {
      ctx.fillStyle = C.dim;
      ctx.fillText(sim.tray.map(x => toolName(x)).join(' · '), cx, r0.y + r0.h + 5);
    }
    ctx.restore();
  }

  // ── Bubo ────────────────────────────────────────────────────────
  private drawOwl(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const o = L.owl;
    const b = this.bubble;
    const since = b ? this.clock - b.t : 99;
    const talking = since < 3.4;
    const cheer = sim.stage === 'won' ? 0.6 + Math.sin(T * 8) * 0.3 : 0;
    const hop = (sim.stage === 'won' || (this.toolFlash && this.clock - this.toolFlash.t < 0.6)) && !this.opts.reducedMotion ? Math.abs(Math.sin(T * 7)) : 0;
    paintOwl(ctx, o.x, o.y, o.r, { t: T, look: Math.sin(T * 0.5) * 0.6, hop, cheer, sleepy: sim.look === 'rest' ? 0.6 : 0 });
    if (!b || !talking) return;
    const a = since < 0.2 ? since / 0.2 : since > 3 ? (3.4 - since) / 0.4 : 1;
    const u = L.u;
    ctx.save();
    ctx.globalAlpha = clamp(a);
    ctx.font = font(650, 13 * u + 1, SANS);
    const pad = 10;
    const lines = wrapLines(ctx, b.text, L.bubble.w - pad * 2).slice(0, 4);
    const lh = 16 * u + 2;
    const bw = Math.min(L.bubble.w, Math.max(...lines.map(s => ctx.measureText(s).width)) + pad * 2);
    const bh = lines.length * lh + pad * 1.4;
    const bx = Math.max(6, Math.min(L.w - bw - 6, L.bubble.x)), by = L.bubble.y - bh;
    const pop = since < 0.2 ? ease.outBack(since / 0.2) : 1;
    ctx.translate(o.x, L.bubble.y);
    ctx.scale(pop, pop);
    ctx.translate(-o.x, -L.bubble.y);
    ctx.fillStyle = '#fff7e3';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.beginPath();
    const tx = Math.max(bx + 14, Math.min(bx + bw - 14, o.x));
    ctx.moveTo(tx - 7, by + bh - 1);
    ctx.lineTo(tx + 7, by + bh - 1);
    ctx.lineTo(o.x + o.r * 0.2, Math.min(o.y - o.r * 1.2, by + bh + 12));
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1724';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, bx + pad, by + pad * 0.7 + i * lh));
    ctx.restore();
  }

  // ── cards ───────────────────────────────────────────────────────
  private cardBox(L: Layout, hFrac: number): Rect {
    const b = L.board;
    const w = Math.min(b.w * 0.96, 560 * L.u + 40), h = Math.min(b.h * hFrac, b.h - 8);
    return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
  }

  private appear(): number { return ease.outBack(clamp((this.clock - this.cardT) / 0.35)); }

  private drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = this.cardBox(L, 0.96), u = L.u;
    const c = sim.storyConst;
    ctx.save();
    zoom(ctx, r, this.appear());
    panel(ctx, r, 18, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.gold;
    ctx.font = font(700, 11 * u + 1, SANS);
    ctx.fillText(sim.storyOpen ? 'FIRMAMENT' : t('story.const', { n: c + 1 }).toUpperCase(), r.x + r.w / 2, r.y + 14);
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 22 * u + 2, SERIF);
    ctx.fillText(sim.storyOpen ? t('bubo.name') : constName(c), r.x + r.w / 2, r.y + 30 * u + 4);
    // the constellation's figure (or Bubo at the start)
    const figH = r.h * 0.26;
    const fy = r.y + 64 * u;
    if (sim.storyOpen) paintOwl(ctx, r.x + r.w / 2, fy + figH * 0.55, figH * 0.36, { t: T, look: Math.sin(T) * 0.5 });
    else drawFigure(ctx, c, { x: r.x + r.w * 0.2, y: fy, w: r.w * 0.6, h: figH }, 0, T, -1);
    ctx.fillStyle = C.cream;
    ctx.font = font(500, 14 * u + 1, SANS);
    const lines = wrapLines(ctx, sim.storyOpen ? t('story.open') : storyText(c), r.w - 40);
    let y = fy + figH + 10;
    lines.forEach(s => { ctx.fillText(s, r.x + r.w / 2, y); y += 18 * u + 2; });
    const id: PassageId = sim.storyOpen ? 'psa147.4' : CONSTELLATIONS[c % CONSTELLATIONS.length].verse;
    const room = r.y + r.h - 34 - y;
    const key = `${id}:${Math.round(r.w)}:${Math.round(room)}`;
    if (!this.verse || this.verse.key !== key) this.verse = { key, l: layoutPassage(ctx, passage(id), r.w - 48, Math.max(30, room - 8), { max: Math.round(20 * u + 2), min: 10 }) };
    drawPassage(ctx, passage(id), this.verse.l, r.x + r.w / 2, y + 8, { text: '#f3e6c4', ref: C.gold });
    ctx.fillStyle = C.faint;
    ctx.font = font(600, 11 * u + 1, SANS);
    ctx.fillText(t('story.tap'), r.x + r.w / 2, r.y + r.h - 22);
    ctx.restore();
  }

  private drawIntro(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = this.cardBox(L, 0.62), u = L.u, lv = sim.level;
    ctx.save();
    zoom(ctx, r, this.appear());
    panel(ctx, r, 18, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = r.x + r.w / 2;
    ctx.fillStyle = lv.hard ? '#ff8fb0' : C.gold;
    ctx.font = font(800, 12 * u + 1, SANS);
    ctx.fillText((lv.hard ? t('card.hard') : constName(lv.constellation)).toUpperCase(), cx, r.y + r.h * 0.12);
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 30 * u + 2, SERIF);
    ctx.fillText(t('card.level', { n: lv.index + 1 }), cx, r.y + r.h * 0.26);
    // the goal, big
    const items = this.goalItems(sim);
    const ir = Math.min(26 * u, r.h * 0.1);
    const gw = items.length * ir * 4;
    items.forEach((it, k) => {
      const ix = cx - gw / 2 + ir * 2 + k * ir * 4;
      it.icon(ctx, ix - ir * 0.7, r.y + r.h * 0.48, ir, T);
      ctx.font = font(800, ir * 0.9, SANS);
      ctx.fillStyle = C.cream;
      ctx.textAlign = 'left';
      ctx.fillText(lv.goal === 'score' ? '' : String(lv.goal === 'collect' ? lv.want[k].n : lv.n), ix + ir * 0.5, r.y + r.h * 0.48);
    });
    ctx.textAlign = 'center';
    ctx.font = font(650, 16 * u + 1, SANS);
    ctx.fillStyle = C.cream;
    const goalText = lv.goal === 'score' ? t('goal.score', { pts: pts(lv.n) }) : t(`goal.${lv.goal}` as 'goal.clouds');
    ctx.fillText(goalText, cx, r.y + r.h * 0.66);
    ctx.fillStyle = C.dim;
    ctx.font = font(600, 13 * u + 1, SANS);
    ctx.fillText(t('card.in', { n: lv.moves }), cx, r.y + r.h * 0.77);
    ctx.fillStyle = C.faint;
    ctx.font = font(600, 11 * u + 1, SANS);
    ctx.fillText(t('card.tap'), cx, r.y + r.h * 0.9);
    ctx.restore();
  }

  private drawWon(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    if (sim.busyT > 0 && sim.stageT < 0.3) return;
    const r = this.cardBox(L, 0.86), u = L.u, lv = sim.level;
    const since = this.clock - this.cardT;
    ctx.save();
    zoom(ctx, r, this.appear());
    panel(ctx, r, 18, true);
    const cx = r.x + r.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.gold;
    ctx.font = font(700, 26 * u + 2, SERIF, true);
    ctx.fillText(t('won.title'), cx, r.y + r.h * 0.1);
    // three stars, one after another
    for (let k = 0; k < 3; k++) {
      const at = 0.35 + k * 0.35;
      const lit = k < sim.lastStars && since >= at;
      const pop = lit ? ease.outBack(clamp((since - at) / 0.3)) : 1;
      const sx = cx + (k - 1) * 46 * u, sy = r.y + r.h * 0.24 - (k === 1 ? 8 * u : 0);
      paintStar(ctx, sx, sy, (k === 1 ? 22 : 18) * u * pop, lit ? 1 : 0, C.gold);
    }
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 20 * u + 2, SANS);
    ctx.fillText(pts(sim.levelScore), cx, r.y + r.h * 0.37);
    // the map: the constellation, the stars won lit, the new one igniting
    const box = { x: r.x + r.w * 0.12, y: r.y + r.h * 0.44, w: r.w * 0.76, h: r.h * 0.38 };
    drawFigure(ctx, lv.constellation, box, lv.star + 1, T, lv.star, clamp((since - 0.8) / 0.6));
    ctx.fillStyle = C.dim;
    ctx.font = font(600, 12 * u + 1, SANS);
    const constDone = lv.star === RULES.perConst - 1;
    ctx.fillText(constDone ? t('won.const', { name: constName(lv.constellation) }) : t('won.next', { n: lv.index + 2 }), cx, r.y + r.h * 0.9);
    ctx.restore();
  }

  private drawOut(ctx: CanvasRenderingContext2D, L: Layout, sim: FirmamentSim, T: number): void {
    const r = this.cardBox(L, 0.66), u = L.u;
    ctx.save();
    zoom(ctx, r, this.appear());
    panel(ctx, r, 18, true);
    const cx = r.x + r.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.cream;
    ctx.font = font(700, 24 * u + 2, SERIF);
    ctx.fillText(t('out.title'), cx, r.y + r.h * 0.14);
    ctx.fillStyle = sim.outNear ? C.gold : C.dim;
    ctx.font = font(650, 15 * u + 1, SANS);
    ctx.fillText(t('out.left', { what: sim.outWhat }), cx, r.y + r.h * 0.29);
    const bw = Math.min(r.w - 40, 300 * u + 40), bh = 40 * u + 4;
    let y = r.y + r.h * 0.42;
    const can = sim.tray.includes('moves');
    if (can) {
      const b = { x: cx - bw / 2, y, w: bw, h: bh };
      button(ctx, b, t('out.use', { n: RULES.toolMoves }), true, u);
      paintToolIcon(ctx, 'moves', b.x + bh * 0.55, b.y + bh / 2, bh * 0.36, T);
      this.buttons.push({ kind: 'use', r: b });
      y += bh + 10;
    }
    const rb = { x: cx - bw / 2, y, w: bw, h: bh };
    button(ctx, rb, t('out.retry'), !can, u);
    this.buttons.push({ kind: 'retry', r: rb });
    // the gentle clock to the retry
    const k = clamp(sim.stageT / RULES.outSec);
    ctx.fillStyle = C.faint;
    ctx.font = font(600, 11 * u + 1, SANS);
    ctx.fillText(t('out.soon'), cx, r.y + r.h * 0.88);
    ctx.fillStyle = 'rgba(255,210,122,.6)';
    ctx.fillRect(r.x + 20, r.y + r.h - 8, (r.w - 40) * k, 3);
    ctx.restore();
  }
}

// ── small brushes ─────────────────────────────────────────────────
function panel(ctx: CanvasRenderingContext2D, r: Rect, rad: number, strong = false): void {
  ctx.save();
  ctx.fillStyle = strong ? 'rgba(12,15,48,.94)' : 'rgba(12,15,48,.78)';
  ctx.strokeStyle = strong ? 'rgba(255,220,150,.45)' : 'rgba(255,220,150,.22)';
  ctx.lineWidth = strong ? 1.5 : 1;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function zoom(ctx: CanvasRenderingContext2D, r: Rect, k: number): void {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.translate(cx, cy);
  ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = clamp(k * 1.5);
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
  ctx.font = font(750, 14 * u + 1, SANS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2 + 1);
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
