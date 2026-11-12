/**
 * Wzlot's own words over the play, drawn on the canvas (the runner's standard HUD has the panel, the
 * score and the coach marks): the flying numbers, the banners ("Grań 3!", "PORYW!"), Leon's
 * speech bubble, the dawn prompt, the opening story card with the root passage, and the day's tally
 * at nightfall with its numbers counting up and the near miss.  All of it below the HUD band and above the
 * home indicator (layout.ts).
 *
 * Text never goes under the kit's floor (paint.font: MIN_TEXT, 11 px); what the player reads to play — a
 * flying word, a banner, Leon's bubble, a card — is MIN_READ (13 px) or more, with a dark rim where it flies
 * over the sky and the hills (DESIGN §12).  A card or the dawn prompt is the one thing to tap while it shows
 * (a tap anywhere does it): `box` keeps where it was drawn, for the targets.
 */
import { clamp, ease, Floaters } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { fmtInt, metres, t } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintBubble } from './paint';
import type { Tally, WzlotSim } from './sim';

interface Banner { text: string; sub: string; t: number; dur: number; color: string }
/** A banner as laid out this frame: its box, its title's lines and size, its first line's middle. */
interface BannerBox { x0: number; y0: number; x1: number; y1: number; lines: string[]; size: number; lh: number; y: number; cx: number }

export class Hud {
  readonly floats = new Floaters();
  private banner: Banner | null = null;
  private verse: { w: number; h: number; l: PassageLayout; lines: string[]; size: number } | null = null;
  private tallyT = 0;
  private L!: Layout;
  /** a finger taps (and holds); a keyboard may hear of Space */
  private touch = true;
  /** where the story card, the dawn prompt or the tally card was drawn this frame (null: none on screen) */
  box: { kind: 'story' | 'dawn' | 'tally'; r: Rect } | null = null;
  /** the runner's coach mark on screen: where it points (y) and until when (the hud's clock); a banner keeps off it */
  private coachY = 0;
  private coachUntil = -1;
  private clock = 0;

  resize(L: Layout, touch = this.touch): void {
    this.L = L;
    this.touch = touch;
    this.verse = null;
  }

  /** A short banner under the HUD band (a grań, the Poryw, a nest level). */
  say(text: string, sub = '', color: string = C.gold2, dur = 1.8): void {
    this.banner = { text, sub, t: 0, dur, color };
  }

  /** A word that flies up from a spot: 13 px at the least on a phone, growing with the UI scale. */
  float(text: string, x: number, y: number, color = '#fff6dc', size = 18, dur = 1.1): void {
    this.floats.add(text, x, y, { color, size: Math.max(MIN_READ, size * this.L.u), dur });
  }

  /** A coach mark points at `y` for the next `sec` seconds (index.ts asks the runner for it). */
  coachAt(y: number, sec: number): void {
    this.coachY = y;
    this.coachUntil = this.clock + sec;
  }

  update(dt: number, sim: WzlotSim): void {
    this.clock += dt;
    this.floats.update(dt);
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    this.tallyT = sim.dayPhase === 'tally' ? this.tallyT + dt : 0;
  }

  draw(ctx: CanvasRenderingContext2D, sim: WzlotSim, speaker: { x: number; y: number }, now: number): void {
    this.box = null;
    this.drawFloats(ctx);
    // the banner is laid out first: Leon's bubble keeps off it, and it is drawn over the bubble
    const banner = this.bannerBox(ctx);
    this.drawBubble(ctx, sim, speaker, banner);
    if (banner) this.drawBanner(ctx, banner);
    if (sim.dayPhase === 'nest' && !sim.opening && sim.phase === 'play') this.drawDawn(ctx, sim, now);
    if (sim.opening) this.drawStory(ctx, sim);
    if (sim.dayPhase === 'tally' && sim.tally) this.drawTally(ctx, sim.tally, sim, now);
  }

  /** The flying words: a dark rim under each, kept inside the band, popping in from the kit's floor. */
  private drawFloats(ctx: CanvasRenderingContext2D): void {
    const L = this.L;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of this.floats.items) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? ease.outBack(k / 0.18) : 1;
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      ctx.font = font(800, f.size * pop, SANS);
      const half = ctx.measureText(f.text).width / 2 + 6;
      const x = clamp(f.x, L.left + half, Math.max(L.left + half, L.right - half));
      const y = clamp(f.y - 46 * ease.outCubic(k), L.top + f.size, L.foot - f.size);
      ctx.lineWidth = Math.max(3, f.size * 0.2);
      ctx.strokeStyle = 'rgba(43,30,20,.55)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.restore();
  }

  /** Where the banner goes this frame and how it reads: its title on one line, or two on a narrow phone (16 px at the least). */
  private bannerBox(ctx: CanvasRenderingContext2D): BannerBox | null {
    const b = this.banner, L = this.L;
    if (!b) return null;
    const u = L.u, cx = (L.left + L.right) / 2;
    const maxW = L.right - L.left - 40, room = maxW - 36;
    let size = 26 * u;
    ctx.font = font(800, size, SERIF, true);
    let tw = ctx.measureText(b.text).width;
    let lines = [b.text];
    if (tw > room) {
      size = Math.max(19, size * room / tw);
      ctx.font = font(800, size, SERIF, true);
      if (ctx.measureText(b.text).width > room) {
        // a long title (a lesson in German) takes two lines rather than shrinking to a smudge
        size = Math.max(17, Math.min(22 * u, size));
        ctx.font = font(800, size, SERIF, true);
        lines = wrap(ctx, b.text, room);
        if (lines.length > 2) lines = [lines[0], clip(ctx, lines.slice(1).join(' '), room)];
      }
      tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    }
    const lh = size * 1.12, subH = b.sub ? 24 * u : 0;
    const w = Math.min(maxW, Math.max(tw, 120) + 40);
    const h = Math.max(44 * u, lines.length * lh + 20 * u + subH);
    let y = L.top + (L.bottom - L.top) * (L.tall ? 0.4 : 0.42);
    // the runner's coach mark (a bubble over the eaglet) passes in front of the canvas: the banner steps aside
    if (this.clock < this.coachUntil && Math.abs(this.coachY - (y - 22 * u + h / 2)) < h / 2 + 90 * u) {
      y = this.coachY > (L.top + L.bottom) / 2 ? L.top + 40 * u : Math.min(L.bottom - h + 22 * u, this.coachY + 70 * u);
    }
    return { x0: cx - w / 2, y0: y - 22 * u, x1: cx + w / 2, y1: y - 22 * u + h, lines, size, lh, y, cx };
  }

  private drawBanner(ctx: CanvasRenderingContext2D, box: BannerBox): void {
    const b = this.banner!, L = this.L, u = L.u;
    const k = b.t / b.dur;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const a = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
    const w = box.x1 - box.x0, h = box.y1 - box.y0;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(43,30,20,.76)';
    ctx.beginPath();
    ctx.roundRect(box.x0, box.y0, w, h, Math.min(h / 2.4, 26 * u));
    ctx.fill();
    ctx.font = font(800, box.size * pop, SERIF, true);
    ctx.fillStyle = b.color;
    const first = box.y0 + 22 * u;
    box.lines.forEach((l, i) => ctx.fillText(l, box.cx, first + i * box.lh));
    if (b.sub) {
      ctx.font = font(700, Math.max(MIN_READ + 1, 15 * u), SANS);
      ctx.fillStyle = '#fff6dc';
      ctx.fillText(clip(ctx, b.sub, w - 24), box.cx, first + (box.lines.length - 1) * box.lh + 24 * u);
    }
    ctx.restore();
  }

  private drawBubble(ctx: CanvasRenderingContext2D, sim: WzlotSim, sp: { x: number; y: number }, avoid: BannerBox | null): void {
    const line = sim.talk.line, L = this.L;
    if (!line) return;
    const a = clamp(line.t / 0.15) * clamp((line.dur - line.t) / 0.25);
    const maxW = Math.min((L.right - L.left) * (L.tall ? 0.74 : 0.36), 300 * L.u);
    paintBubble(ctx, line.text, sp.x, sp.y - 16 * L.u, maxW, Math.max(MIN_READ + 1, 14 * L.u), sp.x, sp.y - 6 * L.u, a,
      { x0: L.left + 8, y0: L.top + 4, x1: L.right - 8, y1: L.foot - 8 }, avoid);
  }

  private drawDawn(ctx: CanvasRenderingContext2D, sim: WzlotSim, now: number): void {
    const L = this.L, u = L.u;
    const pulse = 0.75 + 0.25 * Math.sin(now * 4);
    const y = L.cardY - 20 * u, cx = (L.left + L.right) / 2;
    const day = t_('dawn.day', sim.dayNo), tap = t(this.touch ? 'dawn.tap' : 'dawn.tap.keys');
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(700, 16 * u, SANS);
    const w = Math.min(L.right - L.left - 24, Math.max(ctx.measureText(tap).width, 160 * u) + 48 * u);
    const r = { x: cx - w / 2, y: y - 26 * u, w, h: 82 * u };
    this.box = { kind: 'dawn', r };
    ctx.fillStyle = 'rgba(43,30,20,.62)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 24 * u);
    ctx.fill();
    ctx.font = font(800, 28 * u, SERIF, true);
    ctx.fillStyle = C.gold2;
    ctx.fillText(day, cx, y);
    ctx.globalAlpha = pulse;
    ctx.font = font(700, 16 * u, SANS);
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(clip(ctx, tap, w - 20), cx, y + 34 * u);
    ctx.restore();
  }

  /** A paper card centred at cardY, kept in the band; returns its box. */
  private card(ctx: CanvasRenderingContext2D, w: number, h: number): Rect {
    const L = this.L;
    const x = (L.left + L.right - w) / 2, y = clamp(L.cardY - h / 2, L.top + 4, Math.max(L.top + 4, L.foot - h - 8));
    // its shadow: an offset shape, not a blur (cheap on a phone)
    ctx.fillStyle = 'rgba(30,20,10,.16)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 5, w, h, 16 * L.u);
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16 * L.u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(138,90,52,.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 5, w - 10, h - 10, 12 * L.u);
    ctx.stroke();
    return { x, y, w, h };
  }

  private drawStory(ctx: CanvasRenderingContext2D, sim: WzlotSim): void {
    const L = this.L, u = L.u;
    const w = Math.min(L.right - L.left - 24, 460 * u), pad = 18 * u;
    const avail = L.foot - L.top - 16;
    const cx = (L.left + L.right) / 2;
    ctx.save();
    const ps = passage('deu32.11');
    if (!this.verse || this.verse.w !== w || this.verse.h !== avail) {
      // the story at 15 px, a little smaller on a small phone (never under 13.5) if the verse would not fit whole
      for (const size of [15 * u, 14 * u, 13.5 * u]) {
        ctx.font = font(500, Math.max(MIN_READ + 0.5, size), SANS);
        const lines = wrap(ctx, t('story.text'), w - pad * 2);
        const head = pad + 44 * u + lines.length * size * 1.32;
        const room = Math.max(30, Math.min(avail, 400 * u) - head - pad - 36 * u);
        const l = layoutPassage(ctx, ps, w - pad * 2, room, { max: 16 * u, min: MIN_READ });
        this.verse = { w, h: avail, l, lines, size: Math.max(MIN_READ + 0.5, size) };
        if (l.fits) break;
      }
    }
    const v = this.verse!, lh = v.size * 1.32;
    const head = pad + 44 * u + v.lines.length * lh;
    const h = Math.min(avail, head + v.l.height + pad + 36 * u);
    const box = this.card(ctx, w, h);
    this.box = { kind: 'story', r: box };
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.brown2;
    ctx.font = font(800, 24 * u, SERIF, true);
    ctx.fillText(t('story.title'), cx, box.y + pad);
    ctx.font = font(500, v.size, SANS);
    ctx.fillStyle = C.ink;
    v.lines.forEach((l, i) => ctx.fillText(l, cx, box.y + pad + 36 * u + i * lh));
    drawPassage(ctx, ps, v.l, cx, box.y + head, { text: C.brown2, ref: C.brown });
    ctx.globalAlpha = sim.phaseT > 1.2 ? 0.7 + 0.3 * Math.sin(sim.phaseT * 4) : 0.4;
    ctx.font = font(700, 15 * u, SANS);
    ctx.fillStyle = C.brown;
    ctx.fillText(clip(ctx, t(this.touch ? 'dawn.tap' : 'dawn.tap.keys'), w - pad * 2), cx, box.y + h - pad - 16 * u);
    ctx.restore();
  }

  private drawTally(ctx: CanvasRenderingContext2D, tl: Tally, sim: WzlotSim, now: number): void {
    const L = this.L, u = L.u;
    const w = Math.min(L.right - L.left - 24, 380 * u), pad = 16 * u;
    const cx = (L.left + L.right) / 2;
    const rows: [string, string][] = [
      [t_('tally.far'), `${metres(tl.metres)} · ${t('tally.gran', { n: tl.gran })}`],
      [t('tally.perfect'), String(tl.perfect)],
      [t('tally.coins'), String(tl.coins)],
      [t('tally.fever'), t('sec', { n: tl.feverSec })],
    ];
    const extra = tl.record ? t('tally.record') : tl.toRecord !== null ? t('tally.near', { n: fmtInt(tl.toRecord) }) : '';
    const rowH = 24 * u;
    const h = Math.min(L.foot - L.top - 12, 152 * u + rows.length * rowH + (extra ? 28 * u : 0));
    const box = this.card(ctx, w, h);
    this.box = { kind: 'tally', r: box };
    const k = ease.outCubic(clamp(this.tallyT / 1.1));
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.brown2;
    ctx.font = font(800, 20 * u, SERIF, true);
    ctx.fillText(clip(ctx, sim.phase === 'play' ? t_('tally.title', tl.day) : t('tally.last'), w - pad * 2), cx, box.y + pad);
    ctx.font = font(800, 40 * u, SANS);
    ctx.fillStyle = C.ink;
    ctx.fillText(`${fmtInt(tl.points * k)} ${t('unit')}`, cx, box.y + pad + 30 * u);
    let y = box.y + pad + 86 * u;
    ctx.font = font(600, 15 * u, SANS);
    for (const [a, b] of rows) {
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.fillText(b, box.x + w - pad - 6, y);
      const bw = ctx.measureText(b).width;
      ctx.textAlign = 'left';
      ctx.fillStyle = C.brown;
      ctx.fillText(clip(ctx, a, w - pad * 2 - 18 - bw), box.x + pad + 6, y);
      y += rowH;
    }
    if (extra) {
      ctx.textAlign = 'center';
      ctx.font = font(800, 16 * u, SANS);
      ctx.fillStyle = tl.record ? '#c4791d' : C.brown2;
      ctx.fillText(clip(ctx, extra, w - pad * 2), cx, y + 4 * u);
      y += 28 * u;
    }
    if (sim.phase === 'play' && this.tallyT > 1.5) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now * 4);
      ctx.font = font(700, 15 * u, SANS);
      ctx.fillStyle = C.brown;
      ctx.fillText(clip(ctx, t(this.touch ? 'tally.next' : 'tally.next.keys'), w - pad * 2), cx, box.y + h - pad - 13 * u);
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

/** `text` cut to `maxW` in the context's font, with "…" when cut. */
function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}
