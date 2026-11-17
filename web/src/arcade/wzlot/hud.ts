/**
 * Wzlot's own words over the play, drawn on the canvas (the runner's standard HUD has the panel, the
 * score and the coach marks): the flying numbers, the banners ("Grań 3!", "Poryw z głowy!"), Leon's
 * speech bubble, the dawn prompt, the opening story card with the root passage, and the day's tally
 * at nightfall with its numbers counting up and the near miss.  All of it below the HUD band and above the
 * home indicator (layout.ts).
 *
 * Round 11 (the founder could not tell how and when to steer): the cue by the eaglet — "↓ Trzymaj" in the
 * blue of the downslopes, "↑ Puść" in the orange of the upslopes — with three pips counting perfect slides
 * toward the Poryw; each slide's verdict over the eaglet ("Idealnie!", "Za wcześnie", "Za późno", why under it
 * while the cues teach); the practice valley's prompt with the gesture drawn (a fingertip pressing or lifting, a
 * mouse's button); one-line labels where they matter (by the sun, beside the first warm column).  Captions stay
 * long enough to read twice (rules.readSec); a banner keeps off a label, one text where the eye is.
 *
 * Text never goes under the kit's floor (paint.font: MIN_TEXT, 11 px); what the player reads to play — a
 * flying word, a banner, Leon's bubble, a card — is MIN_READ (13 px) or more, with a dark rim where it flies
 * over the sky and the hills (DESIGN §12).  A card or the dawn prompt is the one thing to tap while it shows
 * (a tap anywhere does it): `box` keeps where it was drawn, for the targets.
 */
import { approach, clamp, ease, Floaters } from '../kit/juice';
import { MIN_READ } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { fmtInt, metres, t, type Key } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintBubble } from './paint';
import { RULES, readSec } from './rules';
import type { Cue, Tally, Verdict, VerdictWhy, WzlotSim } from './sim';

/** What the hands do, in colour: the hold stretches (downslopes) cool blue, the let-go ones (upslopes) warm orange. */
export const CUE_RGB: Readonly<Record<Cue, string>> = { hold: '64,146,255', release: '255,132,46' };
const VERDICT_COL: Readonly<Record<Verdict, string>> = { perfect: '#ffd36b', early: '#a8d4ff', late: '#ffb784' };

/** Where the eaglet, its ground, the sun and the newest warm column are on screen this frame (px). */
export interface Scene {
  bx: number;
  by: number;
  /** the ground under the eaglet */
  gy: number;
  /** the eaglet's drawn size */
  size: number;
  sun: { x: number; y: number };
  /** the warm column the label points at (null: none in sight) */
  thermal: { x: number; y: number } | null;
}

/** What the mouse can rest on (a desktop): the world's gauges explain themselves, a card lights up. */
export type WorldPart = 'sun' | 'night' | 'thermal' | 'crag' | 'card';
/** What each gauge says under the mouse (the coach marks' own words). */
const PART_TIP: Record<Exclude<WorldPart, 'card'>, Key> = { sun: 'hint.sun', night: 'hint.night', thermal: 'hint.thermal', crag: 'hint.crag' };

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
  /** the mouse's answer as laid out: its gauge, its lines and its width */
  private tipLay: { what: WorldPart; maxW: number; lines: string[]; w: number } | null = null;
  /** the verdict over the eaglet (the next replaces it) */
  private verdictNow: { v: Verdict; text: string; sub: string; t: number } | null = null;
  /** the cue's place (smoothed), the cue shown and when it changed (a pop) */
  private cueY = -1;
  private cueAt = 0;
  private cueShown: Cue | null = null;
  private cuePop = 9;
  /** the cue plate's top this frame (the verdict stays above it); the practice card's box (last frame) */
  private cueTop = Infinity;
  private practiceRect: Rect | null = null;
  /** the one-line explanations on screen: by the sun, at a warm column (their age and how long they stay) */
  private labels: { what: 'sun' | 'thermal'; t: number; dur: number; seen: boolean; wait: number }[] = [];
  /** the labels' boxes this frame: a banner keeps off them */
  private labelBoxes: Rect[] = [];

  resize(L: Layout, touch = this.touch): void {
    this.L = L;
    this.touch = touch;
    this.verse = null;
    this.cueY = -1;
  }

  /** A slide's verdict over the eaglet: its word, and why while the cues still teach. */
  verdict(v: Verdict, why: VerdictWhy, teach: boolean): void {
    const text = t(`verdict.${v}` as Key);
    const sub = teach && v !== 'perfect' ? t(`why.${why}` as Key) : '';
    this.verdictNow = { v, text, sub, t: 0 };
  }

  /** A one-line explanation where it matters: by the sun, or at the warm column; it stays long enough to read twice. */
  label(what: 'sun' | 'thermal'): void {
    const text = what === 'sun' ? t('label.sun') : `${t('label.thermal')} ${t('label.thermalSub')}`;
    this.labels = this.labels.filter(l => l.what !== what);
    this.labels.push({ what, t: 0, dur: readSec(text), seen: false, wait: 0 });
  }

  /**
   * The mouse's answer (a desktop): the part under it outlined in gold — a ring round the sun or the night, a frame
   * round a warm column, the grań's flag or a card — and, but for a card, the coach mark's words for it on a dark
   * plate beside it (13.5 px × u), under a part in the upper half of the band, over one in the lower half.
   */
  drawTip(ctx: CanvasRenderingContext2D, what: WorldPart, box: Rect, a: number): void {
    const L = this.L, u = L.u;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = 'rgba(255,214,110,.92)';
    ctx.lineWidth = Math.max(2, 2 * u);
    ctx.beginPath();
    if (what === 'sun' || what === 'night') ctx.arc(box.x + box.w / 2, box.y + box.h / 2, box.w / 2, 0, Math.PI * 2);
    else ctx.roundRect(box.x - 3, box.y - 3, box.w + 6, box.h + 6, Math.min(16 * u, (box.h + 6) / 2));
    ctx.stroke();
    if (what !== 'card') {
      const size = Math.max(MIN_READ + 0.5, 13.5 * u), pad = 10 * u, maxW = Math.min(300 * u, L.right - L.left - 24);
      if (!this.tipLay || this.tipLay.what !== what || this.tipLay.maxW !== maxW) {
        ctx.font = font(650, size, SANS);
        const lines = wrap(ctx, t(PART_TIP[what]), maxW - pad * 2);
        this.tipLay = { what, maxW, lines, w: Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2 };
      }
      const T = this.tipLay, lh = size * 1.3, h = T.lines.length * lh + pad * 1.2;
      const upper = box.y + box.h / 2 < (L.top + L.bottom) / 2;
      const x = clamp(box.x + box.w / 2 - T.w / 2, L.left + 8, L.right - 8 - T.w);
      const y = clamp(upper ? box.y + box.h + 10 * u : box.y - 10 * u - h, L.top + 4, L.foot - 8 - h);
      ctx.fillStyle = 'rgba(43,30,20,.86)';
      ctx.beginPath();
      ctx.roundRect(x, y, T.w, h, Math.min(12 * u, h / 2));
      ctx.fill();
      ctx.font = font(650, size, SANS);
      ctx.fillStyle = '#fff6dc';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      T.lines.forEach((l, i) => ctx.fillText(l, x + pad, y + pad * 0.6 + lh * (i + 0.5)));
    }
    ctx.restore();
  }

  /**
   * A short banner under the HUD band (a grań, a nest level): long enough to read twice; the next replaces it.
   * Returns how long it stays (Leon keeps quiet meanwhile).
   */
  say(text: string, sub = '', color: string = C.gold2): number {
    const dur = readSec(sub ? `${text} ${sub}` : text);
    this.banner = { text, sub, t: 0, dur, color };
    return dur;
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
    if (this.verdictNow) {
      this.verdictNow.t += dt;
      if (this.verdictNow.t >= RULES.verdictSec || sim.dayPhase !== 'fly') this.verdictNow = null;
    }
    // a label's clock runs while its thing is in sight (a warm column rises past the right edge on a phone)
    for (const l of this.labels) {
      if (l.seen) l.t += dt;
      else l.wait += dt;
    }
    this.labels = this.labels.filter(l => l.t < l.dur && l.wait < 8 && sim.dayPhase === 'fly');
    const cue = sim.cue();
    if (cue !== this.cueShown) {
      this.cueShown = cue;
      this.cuePop = 0;
    } else this.cuePop += dt;
    this.tallyT = sim.dayPhase === 'tally' ? this.tallyT + dt : 0;
  }

  draw(ctx: CanvasRenderingContext2D, sim: WzlotSim, speaker: { x: number; y: number }, now: number, scene: Scene): void {
    this.box = null;
    this.cueTop = Infinity;
    if (sim.dayPhase === 'fly') this.drawCue(ctx, sim, scene, now);
    this.drawLabels(ctx, scene);
    this.drawFloats(ctx);
    // the banner is laid out first: Leon's bubble keeps off it, and it is drawn over the bubble
    const banner = this.bannerBox(ctx);
    this.drawBubble(ctx, sim, speaker, banner);
    if (banner) this.drawBanner(ctx, banner);
    // the slide's verdict over everything but the cards: it is what the eye looks for after a slide
    this.drawVerdict(ctx, scene);
    if (sim.practice) this.drawPractice(ctx, sim, now);
    else this.practiceRect = null;
    if (sim.dayPhase === 'nest' && !sim.opening && sim.phase === 'play') this.drawDawn(ctx, sim, now);
    if (sim.opening) this.drawStory(ctx, sim);
    if (sim.dayPhase === 'tally' && sim.tally) this.drawTally(ctx, sim.tally, sim, now);
  }

  // ── when to steer: the cue, the verdict, the practice ─────────────
  /**
   * The cue by the eaglet — "↓ Trzymaj" (blue) or "↑ Puść" (orange), the colours of the slopes — on a dark plate never
   * over the slope ahead: upright in the thumb pad under the eaglet, wide behind it in the ground it has passed (over
   * its head when there is no room), with the three pips that count
   * perfect slides toward the Poryw.  As the cues fade (sim.cueLevel) the word goes and the pips stay.  While the
   * practice waits it pulses.
   */
  private drawCue(ctx: CanvasRenderingContext2D, sim: WzlotSim, sc: Scene, now: number): void {
    const L = this.L, u = L.u, cue = sim.cue();
    const level = cue ? sim.cueLevel : 0;
    const h = 36 * u, r = 13 * u, pr = 5 * u, pad = 10 * u;
    const size = Math.max(MIN_READ + 3, 17 * u);
    ctx.save();
    ctx.font = font(800, size, SANS);
    const word = cue ? t(cue === 'hold' ? 'cue.hold' : 'cue.release') : '';
    const wordW = level > 0.02 ? r * 2 + 8 * u + ctx.measureText(word).width + 14 * u : 0;
    const pipsW = 3 * pr * 2 + 2 * 7 * u + (sim.fever ? 30 * u : 0);
    const w = pad + wordW + pipsW + pad;
    // never over the slope ahead it speaks of: upright, in the thumb pad under all the ground, under the eaglet;
    // wide, behind the eaglet in the ground it has passed (under it, or over its head, where there is no room)
    const behind = sc.bx - sc.size * 0.45 - w;
    let x: number, want: number;
    if (L.tall) {
      x = clamp(sc.bx - w / 2, L.left + 6, L.right - 6 - w);
      want = Math.max(sc.gy + 18 * u, L.bottom + (L.foot - L.bottom - h) / 2);
      if (want + h > L.foot - 6) want = L.foot - 6 - h;
    } else if (behind >= L.left + 6) {
      // behind the eaglet: in the ground it has passed, or beside it where that ground is too near the foot
      x = behind;
      want = sc.gy + 6 * u;
      if (want + h > L.foot - 6) want = sc.by - h / 2;
    } else {
      x = clamp(sc.bx - w / 2, L.left + 6, L.right - 6 - w);
      want = sc.gy + 18 * u;
      if (want + h > L.foot - 6) want = Math.max(L.top + 4, sc.by - sc.size * 0.95 - h - 6 * u);
    }
    // the practice's card says the same thing louder: where the two would meet, the card alone
    const card = this.practiceRect;
    if (sim.waiting && card && x < card.x + card.w && x + w > card.x && want < card.y + card.h && want + h > card.y) {
      ctx.restore();
      return;
    }
    const dt = Math.min(0.1, this.clock - this.cueAt);
    this.cueAt = this.clock;
    this.cueY = this.cueY < 0 ? want : approach(this.cueY, want, dt, 0.06);
    const y = clamp(this.cueY, L.top + 4, L.foot - 6 - h);
    this.cueTop = y;
    const pop = this.cuePop < 0.16 ? 1 + 0.12 * (1 - this.cuePop / 0.16) : 1;
    const cx = x + w / 2, cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    ctx.translate(-cx, -cy);
    const col = cue ? CUE_RGB[cue] : '255,214,110';
    // the plate (its rim in the cue's colour, pulsing while the practice waits)
    const wait = sim.waiting ? 0.5 + 0.5 * Math.sin(now * 6) : 0;
    ctx.fillStyle = 'rgba(30,22,15,.8)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (level > 0.02) {
      ctx.strokeStyle = `rgba(${col},${(0.55 + 0.45 * wait) * level})`;
      ctx.lineWidth = (2 + 2 * wait) * u;
      ctx.stroke();
      ctx.globalAlpha = level;
      // the arrow in a disc of the cue's colour
      const ax = x + pad + r, ay = cy;
      ctx.fillStyle = `rgb(${col})`;
      ctx.beginPath();
      ctx.arc(ax, ay, r, 0, Math.PI * 2);
      ctx.fill();
      drawArrow(ctx, ax, ay, r * 0.62, cue === 'hold' ? 1 : -1, 2.6 * u);
      ctx.fillStyle = '#fff8ea';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, ax + r + 8 * u, cy + 0.5);
      ctx.globalAlpha = 1;
    }
    // the pips: perfect slides in a row toward the Poryw (all lit and ×2 in it)
    let px = x + pad + wordW + pr;
    const lit = sim.fever ? 3 : Math.min(3, sim.chain);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(px, cy, pr, 0, Math.PI * 2);
      if (i < lit) {
        ctx.fillStyle = sim.fever ? `rgba(255,214,110,${0.8 + 0.2 * Math.sin(now * 10 + i)})` : '#ffd36b';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,246,220,.7)';
        ctx.lineWidth = 1.6 * u;
        ctx.stroke();
      }
      px += pr * 2 + 7 * u;
    }
    if (sim.fever) {
      ctx.font = font(800, Math.max(MIN_READ, 14 * u), SANS);
      ctx.fillStyle = '#ffd36b';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('×2', px - 7 * u + 4 * u, cy + 0.5);
    }
    ctx.restore();
  }

  /** The verdict over the eaglet: its word in its colour, why under it (while learning), popping in and rising a little. */
  private drawVerdict(ctx: CanvasRenderingContext2D, sc: Scene): void {
    const v = this.verdictNow, L = this.L, u = L.u;
    if (!v) return;
    const k = v.t / RULES.verdictSec;
    const pop = k < 0.12 ? 0.6 + 0.4 * ease.outBack(k / 0.12) : 1;
    const a = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
    const size = Math.max(MIN_READ + 6, 23 * u), sub = Math.max(MIN_READ + 1, 14.5 * u);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = font(800, size, SANS);
    let half = ctx.measureText(v.text).width / 2;
    if (v.sub) {
      ctx.font = font(700, sub, SANS);
      half = Math.max(half, ctx.measureText(v.sub).width / 2);
    }
    half += 8;
    const x = clamp(sc.bx + 0.15 * sc.size, L.left + half, Math.max(L.left + half, L.right - half));
    const top = Math.min(sc.by - sc.size * 1.1, this.cueTop - 8 * u) - 14 * u * ease.outCubic(Math.min(1, k * 2));
    const y = clamp(top - (v.sub ? sub * 1.3 : 0) - size / 2, L.top + size, L.foot - size);
    ctx.font = font(800, size * pop, SANS);
    ctx.lineWidth = Math.max(3.5, size * 0.2);
    ctx.strokeStyle = 'rgba(36,24,14,.62)';
    ctx.strokeText(v.text, x, y);
    ctx.fillStyle = VERDICT_COL[v.v];
    ctx.fillText(v.text, x, y);
    if (v.sub) {
      ctx.font = font(700, sub, SANS);
      ctx.lineWidth = Math.max(3, sub * 0.22);
      ctx.strokeText(v.sub, x, y + size * 0.5 + sub * 0.85);
      ctx.fillStyle = '#fff8ea';
      ctx.fillText(v.sub, x, y + size * 0.5 + sub * 0.85);
    }
    ctx.restore();
  }

  /**
   * The practice valley's prompt while it waits: what to do (hold a finger anywhere / let go), why in a line, and the
   * gesture drawn — a fingertip pressing with ripples or lifting (a finger), the mouse's button pressed or let up (a
   * mouse) — on a dark card in the band's middle; "Ćwiczenie 1 z 3" over it, all through the practice.
   */
  private drawPractice(ctx: CanvasRenderingContext2D, sim: WzlotSim, now: number): void {
    const pr = sim.practice!, L = this.L, u = L.u;
    const wait = pr.step === 'waitHold' || pr.step === 'waitRelease';
    const hold = pr.step === 'waitHold';
    const cx = (L.left + L.right) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // the practice's count, small, under the HUD band
    const count = t('practice.title', { n: Math.min(RULES.practiceReps, pr.rep + 1), m: RULES.practiceReps });
    ctx.font = font(750, Math.max(MIN_READ, 14 * u), SANS);
    const cw = ctx.measureText(count).width + 24 * u, ch = 28 * u, cy0 = L.top + 10 * u;
    ctx.fillStyle = 'rgba(30,22,15,.66)';
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, cy0, cw, ch, ch / 2);
    ctx.fill();
    ctx.fillStyle = '#fff1d0';
    ctx.fillText(count, cx, cy0 + ch / 2 + 0.5);
    // after a slide's „Idealnie!” the next prompt waits a breath, so the verdict is seen first
    if (!wait || (hold && pr.rep > 0 && !pr.again && pr.stepT < 0.6)) {
      this.practiceRect = null;
      ctx.restore();
      return;
    }
    const title = hold ? (pr.again ? t('practice.again') : t(this.touch ? 'practice.hold' : 'practice.hold.keys'))
      : (pr.again ? t('practice.up') : t('practice.release'));
    const line = hold ? (pr.again ? t('practice.againSub') : t('practice.holdSub')) : t('practice.releaseSub');
    const icon = 56 * u, pad = 16 * u, maxW = Math.min(L.right - L.left - 24, 470 * u);
    const tSize = Math.max(MIN_READ + 5, 20 * u), sSize = Math.max(MIN_READ + 1, 14.5 * u);
    const textW = maxW - pad * 3 - icon;
    ctx.font = font(800, tSize, SANS);
    const tl = wrap(ctx, title, textW);
    const tw = Math.max(...tl.map(l => ctx.measureText(l).width));
    ctx.font = font(600, sSize, SANS);
    const sl = wrap(ctx, line, textW);
    const sw = Math.max(...sl.map(l => ctx.measureText(l).width));
    const w = Math.min(maxW, Math.max(tw, sw) + pad * 3 + icon);
    const h = Math.max(icon + pad * 1.4, tl.length * tSize * 1.2 + sl.length * sSize * 1.3 + pad * 1.6);
    const x = cx - w / 2, y = clamp(L.cardY - h / 2, cy0 + ch + 8 * u, L.foot - 8 - h);
    this.practiceRect = { x, y, w, h };
    const col = CUE_RGB[hold ? 'hold' : 'release'];
    ctx.fillStyle = 'rgba(30,22,15,.93)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = `rgba(${col},${0.6 + 0.4 * Math.sin(now * 6)})`;
    ctx.lineWidth = 2.5 * u;
    ctx.stroke();
    drawGesture(ctx, x + pad + icon / 2, y + h / 2, icon, hold, this.touch, now, col);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let ty = y + (h - (tl.length * tSize * 1.2 + sl.length * sSize * 1.3)) / 2;
    ctx.font = font(800, tSize, SANS);
    ctx.fillStyle = '#fff8ea';
    for (const l of tl) {
      ctx.fillText(l, x + pad * 2 + icon, ty);
      ty += tSize * 1.2;
    }
    ctx.font = font(600, sSize, SANS);
    ctx.fillStyle = `rgb(${col})`;
    for (const l of sl) {
      ctx.fillText(l, x + pad * 2 + icon, ty + 2 * u);
      ty += sSize * 1.3;
    }
    ctx.restore();
  }

  /** The one-line explanations: under the sun ("Twoje skupienie trzyma słońce wysoko"), beside the warm column. */
  private drawLabels(ctx: CanvasRenderingContext2D, sc: Scene): void {
    const L = this.L, u = L.u;
    this.labelBoxes.length = 0;
    for (const l of this.labels) {
      const at = l.what === 'sun' ? sc.sun : sc.thermal;
      l.seen = !!at && at.x < L.right - 30 * u && at.x > L.left;
      const a = clamp(l.t / 0.25) * clamp((l.dur - l.t) / 0.4);
      if (a <= 0.01 || !at || !l.seen) continue;
      const title = l.what === 'sun' ? t('label.sun') : t('label.thermal');
      const sub = l.what === 'thermal' ? t('label.thermalSub') : '';
      const tS = Math.max(MIN_READ + 1, 15 * u), sS = Math.max(MIN_READ, 13.5 * u), pad = 10 * u;
      const maxW = Math.min(L.right - L.left - 16, 320 * u);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = font(750, tS, SANS);
      const tl = wrap(ctx, title, maxW - pad * 2);
      let w = Math.max(...tl.map(s => ctx.measureText(s).width));
      ctx.font = font(600, sS, SANS);
      const sl = sub ? wrap(ctx, sub, maxW - pad * 2) : [];
      if (sl.length) w = Math.max(w, ...sl.map(s => ctx.measureText(s).width));
      w += pad * 2;
      const h = tl.length * tS * 1.25 + sl.length * sS * 1.3 + pad * 1.2;
      let x: number, y: number;
      if (l.what === 'sun') {
        // under the sun, past its halo
        x = clamp(at.x - w / 2, L.left + 8, L.right - 8 - w);
        y = clamp(at.y + L.sunR * 2.7, L.top + 4, L.foot - 8 - h);
      } else {
        // beside the column, where there is room
        const right = at.x + 0.06 * L.h + w < L.right - 8;
        x = right ? at.x + 22 * u : at.x - 22 * u - w;
        x = clamp(x, L.left + 8, L.right - 8 - w);
        y = clamp(at.y - h / 2, L.top + 4, L.foot - 8 - h);
      }
      this.labelBoxes.push({ x, y, w, h });
      ctx.fillStyle = 'rgba(30,22,15,.86)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12 * u);
      ctx.fill();
      ctx.strokeStyle = l.what === 'sun' ? 'rgba(255,211,107,.85)' : 'rgba(255,190,140,.85)';
      ctx.lineWidth = 1.6 * u;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let ty = y + pad * 0.6;
      ctx.font = font(750, tS, SANS);
      ctx.fillStyle = l.what === 'sun' ? '#ffe3a0' : '#ffd8b4';
      for (const s of tl) {
        ctx.fillText(s, x + pad, ty);
        ty += tS * 1.25;
      }
      ctx.font = font(600, sS, SANS);
      ctx.fillStyle = '#fff8ea';
      for (const s of sl) {
        ctx.fillText(s, x + pad, ty);
        ty += sS * 1.3;
      }
      ctx.restore();
    }
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
      const pop = k < 0.18 ? 0.6 + 0.4 * ease.outBack(k / 0.18) : 1;
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
    if (b.sub) {
      ctx.font = font(700, Math.max(MIN_READ + 1, 15 * u), SANS);
      tw = Math.max(tw, ctx.measureText(b.sub).width);
    }
    const w = Math.min(maxW, Math.max(tw, 120) + 40);
    const h = Math.max(44 * u, lines.length * lh + 20 * u + subH);
    let y = L.top + (L.bottom - L.top) * (L.tall ? 0.4 : 0.42);
    // the runner's coach mark (a bubble over the eaglet) passes in front of the canvas: the banner steps aside
    if (this.clock < this.coachUntil && Math.abs(this.coachY - (y - 22 * u + h / 2)) < h / 2 + 90 * u) {
      y = this.coachY > (L.top + L.bottom) / 2 ? L.top + 40 * u : Math.min(L.bottom - h + 22 * u, this.coachY + 70 * u);
    }
    // and off a label on screen (one text where the eye is): under it, or over it
    for (const r of this.labelBoxes) {
      const top = y - 22 * u;
      if (cx + w / 2 < r.x || cx - w / 2 > r.x + r.w || top + h < r.y - 6 || top > r.y + r.h + 6) continue;
      const below = r.y + r.h + 10 * u, above = r.y - 10 * u - h;
      y = (below + h <= L.foot - 8 ? below : Math.max(L.top + 4, above)) + 22 * u;
    }
    return { x0: cx - w / 2, y0: y - 22 * u, x1: cx + w / 2, y1: y - 22 * u + h, lines, size, lh, y, cx };
  }

  private drawBanner(ctx: CanvasRenderingContext2D, box: BannerBox): void {
    const b = this.banner!, L = this.L, u = L.u;
    const k = b.t / b.dur;
    // (popping in from 60 %: a word is never caught tiny)
    const pop = k < 0.15 ? 0.6 + 0.4 * ease.outBack(k / 0.15) : 1;
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

/** A thick white arrow centred at (x, y), `r` from its middle to its tip: down (dir 1) or up (−1). */
function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, dir: 1 | -1, lw: number): void {
  ctx.save();
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - dir * r);
  ctx.lineTo(x, y + dir * r);
  ctx.moveTo(x - r * 0.62, y + dir * r * 0.38);
  ctx.lineTo(x, y + dir * r);
  ctx.lineTo(x + r * 0.62, y + dir * r * 0.38);
  ctx.stroke();
  ctx.restore();
}

/**
 * The gesture the practice waits for, in a box `s` wide centred at (x, y): a finger's tip pressing down with ripples
 * spreading (hold) or lifting off with an arrow up (let go); for a mouse, the mouse with its button pressed (lit,
 * pulsing) or let up (an arrow over it).  In the colour of the slope it belongs to.
 */
function drawGesture(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hold: boolean, touch: boolean, now: number, col: string): void {
  ctx.save();
  const k = (now * 0.9) % 1;
  if (touch) {
    const r = s * 0.17;
    if (hold) {
      // ripples where the finger presses
      for (let i = 0; i < 2; i++) {
        const q = (k + i * 0.5) % 1;
        ctx.strokeStyle = `rgba(${col},${(1 - q) * 0.9})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y + s * 0.18, r * (1 + q * 1.6), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // the finger: a rounded stem from below and its tip, pressed down or lifted
    const lift = hold ? 0 : s * 0.16 * Math.sin(Math.PI * k);
    const tipY = y + s * 0.18 - lift;
    ctx.fillStyle = '#f3d2b4';
    ctx.strokeStyle = 'rgba(94,61,34,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - r, tipY - r, r * 2, s * 0.5, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.ellipse(x, tipY - r * 0.35, r * 0.55, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hold) {
      ctx.fillStyle = `rgb(${col})`;
      ctx.beginPath();
      ctx.arc(x, y - s * 0.3, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      drawArrow(ctx, x, y - s * 0.3, s * 0.09, 1, 2.4);
    } else {
      ctx.fillStyle = `rgb(${col})`;
      ctx.beginPath();
      ctx.arc(x + s * 0.3, y - s * 0.28, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      drawArrow(ctx, x + s * 0.3, y - s * 0.28, s * 0.09, -1, 2.4);
    }
  } else {
    // the mouse: its body, the left button lit while held
    const w = s * 0.5, h = s * 0.74, mx = x - w / 2, my = y - h / 2 + s * 0.06;
    ctx.fillStyle = '#f4ead8';
    ctx.strokeStyle = 'rgba(94,61,34,.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mx, my, w, h, w / 2);
    ctx.fill();
    ctx.stroke();
    const press = hold ? 0.65 + 0.35 * Math.sin(now * 7) : 0;
    ctx.fillStyle = hold ? `rgba(${col},${press})` : 'rgba(255,255,255,.4)';
    ctx.beginPath();
    ctx.moveTo(mx + w / 2, my + h * 0.42);
    ctx.lineTo(mx + 2, my + h * 0.42);
    ctx.lineTo(mx + 2, my + w / 2);
    ctx.arc(mx + w / 2, my + w / 2, w / 2 - 2, Math.PI, Math.PI * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(mx, my + h * 0.42);
    ctx.lineTo(mx + w, my + h * 0.42);
    ctx.moveTo(mx + w / 2, my);
    ctx.lineTo(mx + w / 2, my + h * 0.42);
    ctx.stroke();
    const ax = x + s * 0.38, ay = y - s * 0.26;
    ctx.fillStyle = `rgb(${col})`;
    ctx.beginPath();
    ctx.arc(ax, ay, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    drawArrow(ctx, ax, ay, s * 0.09, hold ? 1 : -1, 2.4);
  }
  ctx.restore();
}

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
