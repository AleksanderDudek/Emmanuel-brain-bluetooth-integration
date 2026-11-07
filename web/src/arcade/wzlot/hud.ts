/**
 * Wzlot's own words over the play, drawn on the canvas (the runner's standard HUD has the panel, the
 * score and the coach marks): the flying numbers, the banners ("Grań 3!", "PORYW!"), Leon's
 * speech bubble, the dawn prompt, the opening story card with the root passage, and the day's tally
 * at nightfall with its numbers counting up and the near miss.  All of it below `hudTop`.
 */
import { clamp, ease, Floaters } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { fmtInt, metres, t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintBubble } from './paint';
import type { Tally, WzlotSim } from './sim';

interface Banner { text: string; sub: string; t: number; dur: number; color: string }

export class Hud {
  readonly floats = new Floaters();
  private banner: Banner | null = null;
  private verse: { w: number; l: PassageLayout } | null = null;
  private tallyT = 0;
  private L!: Layout;

  resize(L: Layout): void {
    this.L = L;
    this.verse = null;
  }

  /** A short banner under the HUD band (a grań, the Poryw, a nest level). */
  say(text: string, sub = '', color: string = C.gold2, dur = 1.8): void {
    this.banner = { text, sub, t: 0, dur, color };
  }

  float(text: string, x: number, y: number, color = '#fff6dc', size = 18, dur = 1.1): void {
    this.floats.add(text, x, y, { color, size: size * this.L.u, dur });
  }

  update(dt: number, sim: WzlotSim): void {
    this.floats.update(dt);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    this.tallyT = sim.dayPhase === 'tally' ? this.tallyT + dt : 0;
  }

  draw(ctx: CanvasRenderingContext2D, sim: WzlotSim, speaker: { x: number; y: number }, now: number): void {
    const L = this.L;
    this.floats.draw(ctx, font(800, 18 * L.u, SANS));
    this.drawBanner(ctx);
    this.drawBubble(ctx, sim, speaker);
    if (sim.dayPhase === 'nest' && !sim.opening && sim.phase === 'play') this.drawDawn(ctx, sim, now);
    if (sim.opening) this.drawStory(ctx, sim);
    if (sim.dayPhase === 'tally' && sim.tally) this.drawTally(ctx, sim.tally, sim, now);
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const b = this.banner, L = this.L;
    if (!b) return;
    const k = b.t / b.dur;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const y = L.top + (L.bottom - L.top) * (L.tall ? 0.4 : 0.42);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = 26 * L.u;
    ctx.font = font(800, size, SERIF, true);
    const maxW = L.w - 40;
    const tw = ctx.measureText(b.text).width;
    if (tw > maxW - 36) {
      size *= (maxW - 36) / tw;
      ctx.font = font(800, size, SERIF, true);
    }
    ctx.font = font(800, size * pop, SERIF, true);
    const w = Math.min(maxW, Math.max(ctx.measureText(b.text).width, 120) + 40);
    const h = (b.sub ? 64 : 44) * L.u;
    ctx.fillStyle = 'rgba(43,30,20,.72)';
    ctx.beginPath();
    ctx.roundRect(L.w / 2 - w / 2, y - 22 * L.u, w, h, h / 2.4);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, L.w / 2, y);
    if (b.sub) {
      ctx.font = font(700, 14 * L.u, SANS);
      ctx.fillStyle = '#fff6dc';
      ctx.fillText(b.sub, L.w / 2, y + 24 * L.u);
    }
    ctx.restore();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, sim: WzlotSim, sp: { x: number; y: number }): void {
    const line = sim.talk.line, L = this.L;
    if (!line) return;
    const a = clamp(line.t / 0.15) * clamp((line.dur - line.t) / 0.25);
    const maxW = Math.min(L.w * (L.tall ? 0.7 : 0.36), 300 * L.u);
    paintBubble(ctx, line.text, sp.x, sp.y - 16 * L.u, maxW, 14 * L.u, sp.x, sp.y - 6 * L.u, a,
      { x0: 8, y0: L.top + 4, x1: L.w - 8, y1: L.h - 8 });
  }

  private drawDawn(ctx: CanvasRenderingContext2D, sim: WzlotSim, now: number): void {
    const L = this.L, u = L.u;
    const pulse = 0.75 + 0.25 * Math.sin(now * 4);
    const y = L.cardY - 20 * u;
    const day = t_('dawn.day', sim.dayNo), tap = t('dawn.tap');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, 16 * u, SANS);
    const w = Math.min(L.w - 24, Math.max(ctx.measureText(tap).width, 160 * u) + 48 * u);
    ctx.fillStyle = 'rgba(43,30,20,.6)';
    ctx.beginPath();
    ctx.roundRect(L.w / 2 - w / 2, y - 26 * u, w, 82 * u, 24 * u);
    ctx.fill();
    ctx.font = font(800, 28 * u, SERIF, true);
    ctx.fillStyle = C.gold2;
    ctx.fillText(day, L.w / 2, y);
    ctx.globalAlpha = pulse;
    ctx.font = font(700, 16 * u, SANS);
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(tap, L.w / 2, y + 34 * u);
    ctx.restore();
  }

  /** A paper card centred at cardY; returns its box. */
  private card(ctx: CanvasRenderingContext2D, w: number, h: number): { x: number; y: number; w: number; h: number } {
    const L = this.L;
    const x = (L.w - w) / 2, y = clamp(L.cardY - h / 2, L.top + 4, L.h - h - 8);
    ctx.save();
    ctx.shadowColor = 'rgba(30,20,10,.35)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(251,243,228,.97)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16 * L.u);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(138,90,52,.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 12 * L.u);
    ctx.stroke();
    return { x, y, w, h };
  }

  private drawStory(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, u = L.u;
    const w = Math.min(L.w - 24, 460 * u), pad = 18 * u;
    const avail = L.bottom - L.top - 16;
    ctx.save();
    ctx.font = font(500, 14 * u, SANS);
    const lines = wrap(ctx, t('story.text'), w - pad * 2);
    const ps = passage('deu32.11');
    const head = pad + 44 * u + lines.length * 19 * u;
    const room = Math.max(30, Math.min(avail, 360 * u) - head - pad - 36 * u);
    if (!this.verse || this.verse.w !== w) this.verse = { w, l: layoutPassage(ctx, ps, w - pad * 2, room, { max: 15, min: 10 }) };
    const h = Math.min(avail, head + this.verse.l.height + pad + 36 * u);
    const box = this.card(ctx, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.brown2;
    ctx.font = font(800, 24 * u, SERIF, true);
    ctx.fillText(t('story.title'), L.w / 2, box.y + pad);
    ctx.font = font(500, 14 * u, SANS);
    ctx.fillStyle = C.ink;
    lines.forEach((l, i) => ctx.fillText(l, L.w / 2, box.y + pad + 36 * u + i * 19 * u));
    drawPassage(ctx, ps, this.verse.l, L.w / 2, box.y + head, { text: C.brown2, ref: C.brown });
    ctx.globalAlpha = sim.phaseT > 1.2 ? 0.7 + 0.3 * Math.sin(sim.phaseT * 4) : 0.4;
    ctx.font = font(700, 14 * u, SANS);
    ctx.fillStyle = C.brown;
    ctx.fillText(t('dawn.tap'), L.w / 2, box.y + h - pad - 16 * u);
    ctx.restore();
  }

  private drawTally(ctx: CanvasRenderingContext2D, tl: Tally, sim: WzlotSim, now: number): void {
    const L = this.L, u = L.u;
    const w = Math.min(L.w - 24, 380 * u), pad = 16 * u;
    const rows: [string, string][] = [
      [t_('tally.far'), `${metres(tl.metres)} · ${t('tally.gran', { n: tl.gran })}`],
      [t('tally.perfect'), String(tl.perfect)],
      [t('tally.coins'), String(tl.coins)],
      [t('tally.fever'), t('sec', { n: tl.feverSec })],
    ];
    const extra = tl.record ? t('tally.record') : tl.toRecord !== null ? t('tally.near', { n: fmtInt(tl.toRecord) }) : '';
    const h = Math.min(L.bottom - L.top - 12, (150 + rows.length * 22 + (extra ? 26 : 0)) * u);
    const box = this.card(ctx, w, h);
    const k = ease.outCubic(clamp(this.tallyT / 1.1));
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.brown2;
    ctx.font = font(800, 20 * u, SERIF, true);
    ctx.fillText(sim.phase === 'play' ? t_('tally.title', tl.day) : t('tally.last'), L.w / 2, box.y + pad);
    ctx.font = font(800, 40 * u, SANS);
    ctx.fillStyle = C.ink;
    ctx.fillText(`${fmtInt(tl.points * k)} ${t('unit')}`, L.w / 2, box.y + pad + 30 * u);
    let y = box.y + pad + 86 * u;
    ctx.font = font(600, 14 * u, SANS);
    for (const [a, b] of rows) {
      ctx.textAlign = 'left';
      ctx.fillStyle = C.brown;
      ctx.fillText(a, box.x + pad + 6, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.fillText(b, box.x + w - pad - 6, y);
      y += 22 * u;
    }
    if (extra) {
      ctx.textAlign = 'center';
      ctx.font = font(800, 16 * u, SANS);
      ctx.fillStyle = tl.record ? '#c4791d' : C.brown2;
      ctx.fillText(extra, L.w / 2, y + 4 * u);
      y += 26 * u;
    }
    if (sim.phase === 'play' && this.tallyT > 1.5) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 4);
      ctx.font = font(700, 13 * u, SANS);
      ctx.fillStyle = C.brown;
      ctx.fillText(t('tally.next'), L.w / 2, box.y + h - pad - 12 * u);
    }
    ctx.restore();
  }
}

/** A key whose only parameter is a number. */
const t_ = (key: 'dawn.day' | 'tally.title' | 'tally.far', n?: number): string => t(key, n === undefined ? undefined : { n });

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
