/**
 * Źródła's HUD and overlays on the play canvas: the block (its name, a strategy to try, its
 * progress, the telegraph), the jar count with "Równy nurt", the road strip (the stage's eight
 * valleys, its name and its Song of Ascents), the title line over the valley (a block's name, a
 * stage, a curb stone, a nest), the card slot (a closed valley, the blind Nurt's reveal, an album
 * card, the day's tree, the lesson's lines) and words rising from the fields.  Titles take turns and
 * so do cards (queue.ts).  Every string is fitted to its room — the font shrinks to its least size,
 * then the line wraps — measured only when the text or the room changes, so German and Swedish read
 * on a 390 px phone and a frame leaves no garbage.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { ALBUM, STAGES, TREES, VALLEYS_PER_STAGE } from './content';
import { bare, t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintPlace, paintTree, roundRect } from './paint';
import { Queue, type QueueOpts } from './queue';
import { RULES, isPush, type ZrodlaSim } from './sim';

/** A text fitted to a box: the font size it got, its lines. */
interface Fit { text: string; maxW: number; maxLines: number; size: number; min: number; weight: number; family: string; font: string; lines: string[]; lh: number }
const fit = (): Fit => ({ text: '', maxW: -1, maxLines: 1, size: 0, min: 0, weight: 400, family: SANS, font: '', lines: [], lh: 0 });

/** Greedy word wrap at plain spaces (a no-break space keeps a phrase whole). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Fit `text` into `maxW` × `maxLines`: shrink from `size` to `min`, then wrap; the last line ends in "…" if it still overflows. */
function fitText(ctx: CanvasRenderingContext2D, f: Fit, text: string, maxW: number, maxLines: number, size: number, min: number, weight: number, family: string): Fit {
  if (f.text === text && f.maxW === maxW && f.size === size && f.maxLines === maxLines && f.family === family && f.weight === weight) return f;
  f.text = text;
  f.maxW = maxW;
  f.maxLines = maxLines;
  f.size = size;
  f.min = min;
  f.weight = weight;
  f.family = family;
  ctx.save();
  let s = size;
  for (; s >= min; s -= 0.5) {
    ctx.font = font(weight, s, family);
    if (ctx.measureText(text).width <= maxW) break;
  }
  if (s < min) {
    // the least size, wrapped
    s = Math.max(min, size * 0.9);
    for (; s >= min; s -= 0.5) {
      ctx.font = font(weight, s, family);
      const lines = wrap(ctx, text, maxW);
      if (lines.length <= maxLines) break;
    }
    s = Math.max(s, min);
  }
  ctx.font = f.font = font(weight, s, family);
  let lines = ctx.measureText(text).width <= maxW ? [text] : wrap(ctx, text, maxW);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  ctx.restore();
  f.lines = lines;
  f.lh = Math.round(s * 1.28);
  return f;
}

/** A card in the slot: what it says and its little picture. */
export interface Card {
  kind: 'closed' | 'reveal' | 'album' | 'tree' | 'lesson' | 'stage';
  title: string;
  sub: string;
  /** the album card's place, the tree's kind (−1: none) */
  icon: number;
  dawn: boolean;
}

interface Title { text: string; color: string; size: number }
interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; f: string; w: number }

export class Hud {
  private L: Layout | null = null;
  private readonly titles = new Queue<Title>();
  private readonly cards = new Queue<Card>(0.3, 0.35);
  private readonly floats: Float[] = [];
  private readonly nameFit = fit();
  private readonly tipFit = fit();
  private readonly roadFit = fit();
  private readonly songFit = fit();
  private readonly unitFit = fit();
  private readonly steadyFit = fit();
  private readonly titleFit = fit();
  private readonly cardTitleFit = fit();
  private readonly cardSubFit = fit();
  private readonly lessonFit = fit();
  /** the jar count as drawn: it counts up toward the sim's */
  private count = 0;
  private countText = '';
  private countN = -1;
  private bump = 0;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  resize(L: Layout): void {
    this.L = L;
    for (const f of [this.nameFit, this.tipFit, this.roadFit, this.songFit, this.unitFit, this.steadyFit, this.titleFit, this.cardTitleFit, this.cardSubFit, this.lessonFit]) f.maxW = -1;
  }

  /** A title over the valley for a moment; titles take turns, the more important (lower rank) first. */
  title(text: string, color: string, size: number, o: QueueOpts): void { this.titles.push({ text, color, size }, o); }

  clearTitles(): void { this.titles.clear(); }

  card(c: Card, o: QueueOpts): void {
    this.cards.push(c, o);
    this.cardTitleFit.maxW = -1;
  }

  /** A word that pops, rises and fades from a field. */
  float(text: string, x: number, y: number, color: string, size: number, dur = 1.4): void {
    const f = font(700, size, SANS);
    this.ctx.font = f;
    this.floats.push({ text, x, y, t: 0, dur, color, size, f, w: this.ctx.measureText(text).width });
    if (this.floats.length > 12) this.floats.shift();
  }

  /** The count jumps a little when jars arrive in a lump (rain, a top-up, the reveal). */
  pulse(): void { this.bump = 1; }

  update(dt: number, sim: ZrodlaSim): void {
    this.titles.update(dt);
    this.cards.update(dt);
    let n = 0;
    for (const f of this.floats) {
      f.t += dt;
      if (f.t < f.dur) this.floats[n++] = f;
    }
    this.floats.length = n;
    const want = sim.shownJars;
    this.count = want < this.count ? want : this.count + (want - this.count) * Math.min(1, dt * 6) + (want > this.count ? dt * 2 : 0);
    if (this.count > want) this.count = want;
    this.bump = Math.max(0, this.bump - dt * 2.5);
  }

  /** What shows now (tests and debugging). */
  get showing(): { title: string | null; card: string | null } {
    return { title: this.titles.head?.item.text ?? null, card: this.cards.head?.item.title ?? null };
  }

  // ── drawing ────────────────────────────────────────────────────
  draw(sim: ZrodlaSim, alpha: number): void {
    const L = this.L;
    if (!L || alpha <= 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    this.block(sim);
    this.score(sim);
    this.road(sim);
    ctx.restore();
    this.drawFloats();
    this.drawTitle();
    this.drawCard(sim);
  }

  /** The block's name with its progress, and the strategy line (the telegraph in its last 4 s). */
  private block(sim: ZrodlaSim): void {
    const L = this.L!, ctx = this.ctx, u = L.u;
    if (sim.phase !== 'play') return;
    const b = sim.block;
    const name = t(b.kind === 'warmup' ? 'block.warmup' : b.kind === 'oaza' ? 'block.oaza' : b.kind === 'sela' ? 'block.sela' : b.blind ? 'block.blind' : 'block.nurt');
    const nf = fitText(ctx, this.nameFit, name, L.name.w, 1, 21 * u, 15, 500, SERIF);
    ctx.font = nf.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const color = b.kind === 'sela' ? '#3f6a3a' : C.ink;
    halo(ctx, nf.lines[0], L.name.x, L.name.y + nf.lh * 0.85, color);
    // the block's progress, a hairline under its name
    const w = Math.min(L.name.w, 120 * u), py = L.name.y + nf.lh + 3;
    ctx.fillStyle = 'rgba(43,42,51,.14)';
    ctx.fillRect(L.name.x, py, w, 2);
    ctx.fillStyle = b.kind === 'sela' ? C.olive : C.water;
    ctx.fillRect(L.name.x, py, w * clamp(sim.blockT / b.dur), 2);
    const next = sim.next;
    const tele = next && sim.blockT >= b.dur - RULES.telegraph;
    const tip = tele && next ? t(next.kind === 'sela' ? 'next.sela' : next.kind === 'oaza' ? 'next.oaza' : next.blind ? 'next.blind' : 'next.nurt') : sim.tip;
    const lines = L.portrait ? 2 : 3;
    const tf = fitText(ctx, this.tipFit, tip, L.tip.w, lines, 13 * u, 11, tele ? 650 : 500, SANS);
    ctx.font = tf.font;
    const tc = tele ? (next?.kind === 'sela' ? '#3f6a3a' : '#16707d') : 'rgba(43,42,51,.78)';
    tf.lines.forEach((line, i) => halo(ctx, line, L.tip.x, L.tip.y + tf.lh * (i + 0.85) + 4, tc));
  }

  /** The jar count (counting up, held with a "~" in a blind Nurt), its unit, and the steady stream's step. */
  private score(sim: ZrodlaSim): void {
    const L = this.L!, ctx = this.ctx, u = L.u, x = L.score.x + L.score.w;
    const n = Math.floor(this.count + 1e-6);
    if (n !== this.countN) {
      this.countN = n;
      this.countText = fmtNum(n);
    }
    const size = 38 * u * (1 + 0.08 * ease.outCubic(this.bump));
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(400, size, SERIF);
    const blind = sim.blind;
    halo(ctx, blind ? `~${this.countText}` : this.countText, x, L.score.y + 36 * u, C.ink);
    const uf = fitText(ctx, this.unitFit, blind ? t('hud.hidden') : bare('jars', n), L.score.w, 1, 12.5 * u, 10.5, 650, SANS);
    ctx.font = uf.font;
    halo(ctx, uf.lines[0], x, L.score.y + 36 * u + uf.lh + 1, 'rgba(43,42,51,.7)');
    // "Równy nurt ×1,2": a steady stretch's step, in a sighted Nurt only
    const b = sim.phase === 'play' ? sim.block : null;
    if (b && isPush(b.kind) && !b.blind && sim.reliable && sim.hold >= RULES.steady[0]) {
      const step = RULES.steady.filter(s => sim.hold >= s).length;
      const sf = fitText(ctx, this.steadyFit, t('hud.steady', { x: fmtNum(1 + step / 10, 1) }), L.score.w, 1, 12 * u, 10.5, 700, SANS);
      ctx.font = sf.font;
      halo(ctx, sf.lines[0], x, L.score.y + 36 * u + uf.lh + sf.lh + 3, '#16707d');
    }
    ctx.textAlign = 'left';
  }

  /** The road strip: the stage's eight valleys as dots, its name and its Song of Ascents (or what this valley is). */
  private road(sim: ZrodlaSim): void {
    const L = this.L!, ctx = this.ctx, u = L.u, r = sim.run;
    if (sim.phase !== 'play') return;
    const R = L.road;
    let label: string, song = '';
    let dots = false;
    if (r.kind === 'daily') label = t('hud.daily');
    else if (r.kind === 'oasis') label = t('hud.oasis');
    else if (r.kind === 'free') label = t('hud.free');
    else {
      const stage = Math.floor(r.idx / VALLEYS_PER_STAGE);
      label = r.kind === 'lesson' ? t('hud.lesson') : t('hud.stage', { n: stage + 1, name: STAGES[stage].name });
      song = t('hud.song', { psalm: STAGES[stage].psalm });
      dots = true;
    }
    let x = R.x;
    const cy = R.y + 7 * u;
    if (dots) {
      const stage = Math.floor(r.idx / VALLEYS_PER_STAGE), at = r.idx % VALLEYS_PER_STAGE;
      for (let i = 0; i < VALLEYS_PER_STAGE; i++) {
        const done = i < at || (i === at && r.closed) || stage * VALLEYS_PER_STAGE + i < sim.roadIndex;
        ctx.beginPath();
        ctx.arc(x + 4 * u, cy, (i === at ? 4 : 3) * u, 0, Math.PI * 2);
        if (done) {
          ctx.fillStyle = C.water;
          ctx.fill();
        } else {
          ctx.strokeStyle = i === at ? C.ink : 'rgba(43,42,51,.35)';
          ctx.lineWidth = i === at ? 1.6 : 1;
          ctx.stroke();
        }
        x += 11 * u;
      }
      x += 6 * u;
    }
    const lf = fitText(ctx, this.roadFit, label, R.x + R.w - x, 1, 12 * u, 10.5, 650, SANS);
    ctx.font = lf.font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    halo(ctx, lf.lines[0], x, cy, C.ink);
    if (song) {
      const sf = fitText(ctx, this.songFit, song, R.w, 1, 11 * u, 10, 500, SANS);
      ctx.font = sf.font;
      halo(ctx, sf.lines[0], R.x, cy + 15 * u, 'rgba(43,42,51,.6)');
    }
    ctx.textBaseline = 'alphabetic';
  }

  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.font = pop !== 1 ? font(700, f.size * pop, SANS) : f.f;
      const y = f.y - 34 * ease.outCubic(k);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(250,246,236,.85)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';
  }

  /** The title line over the valley's top rows, on a soft limestone plate. */
  private drawTitle(): void {
    const L = this.L!, ctx = this.ctx, head = this.titles.head;
    if (!head) return;
    const a = this.titles.alpha;
    const it = head.item;
    const tf = fitText(ctx, this.titleFit, it.text, L.title.w - 28, 2, it.size, 16, 500, SERIF);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = tf.font;
    let w = 0;
    for (const line of tf.lines) w = Math.max(w, ctx.measureText(line).width);
    const h = tf.lh * tf.lines.length + 12;
    const y0 = L.title.y - h / 2;
    ctx.fillStyle = 'rgba(246,240,228,.9)';
    ctx.shadowColor = 'rgba(60,40,24,.25)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    roundRect(ctx, L.title.x - w / 2 - 16, y0, w + 32, h, h / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = it.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    tf.lines.forEach((line, i) => ctx.fillText(line, L.title.x, y0 + 6 + tf.lh * (i + 0.5)));
    ctx.restore();
  }

  /** The card slot: a card of the queue, or the lesson's line while it lasts. */
  private drawCard(sim: ZrodlaSim): void {
    const L = this.L!, ctx = this.ctx, head = this.cards.head, u = L.u;
    let c: Card | null = head?.item ?? null, a = head ? this.cards.alpha : 0;
    if (!c && sim.lesson && sim.phase === 'play') {
      c = { kind: 'lesson', title: t(sim.lesson === 'tap' ? 'lesson.tap' : sim.lesson === 'join' ? 'lesson.join' : 'lesson.pour'), sub: '', icon: -1, dawn: false };
      a = 1;
    }
    if (!c || a <= 0) return;
    const R = L.card;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = c.kind === 'lesson' ? 'rgba(28,110,150,.9)' : 'rgba(250,246,237,.94)';
    ctx.shadowColor = 'rgba(50,36,24,.28)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    roundRect(ctx, R.x, R.y, R.w, R.h, 14 * u);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    if (c.dawn) {
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    let tx = R.x + 14 * u;
    const ih = R.h - 16 * u;
    if (c.kind === 'album' && c.icon >= 0) {
      paintPlace(ctx, c.icon, R.x + 8 * u, R.y + 8 * u, ih * 1.3, ih, c.dawn);
      tx = R.x + 16 * u + ih * 1.3;
    } else if (c.kind === 'tree' && c.icon >= 0) {
      paintTree(ctx, TREES[c.icon].kind, R.x + 8 * u + ih / 2, R.y + R.h / 2, ih * 0.42, 0, c.icon + 3);
      tx = R.x + 16 * u + ih;
    }
    const tw = R.x + R.w - 12 * u - tx;
    const light = c.kind === 'lesson';
    const tf = fitText(ctx, this.cardTitleFit, c.title, tw, c.sub ? 1 : 2, 14.5 * u, 11, 650, SANS);
    ctx.font = tf.font;
    ctx.fillStyle = light ? '#f4fbfb' : C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const sf = c.sub ? fitText(ctx, this.cardSubFit, c.sub, tw, 1, 12 * u, 10, 500, SANS) : null;
    const total = tf.lh * tf.lines.length + (sf ? sf.lh : 0);
    let y = R.y + (R.h - total) / 2;
    ctx.font = tf.font;
    for (const line of tf.lines) {
      ctx.fillText(line, tx, y + tf.lh / 2);
      y += tf.lh;
    }
    if (sf) {
      ctx.font = sf.font;
      ctx.fillStyle = light ? 'rgba(244,251,251,.8)' : 'rgba(43,42,51,.64)';
      ctx.fillText(sf.lines[0], tx, y + sf.lh / 2);
    }
    ctx.restore();
  }
}

/** Text with a soft limestone outline, so it reads over the contour lines (a stroke, not a blur: cheap on a phone). */
function halo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(244,238,226,.82)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** An album card's two lines for the card slot. */
export function albumCard(id: number, kind: 'new' | 'dawn' | 'drops' | 'dup' | 'upgrade'): Card {
  const a = ALBUM[id];
  const title = t(kind === 'new' ? 'card.new' : kind === 'dawn' ? 'card.dawn' : kind === 'drops' ? 'card.drops' : kind === 'dup' ? 'card.dup' : 'card.upgrade', { name: a.name });
  return { kind: 'album', title, sub: a.ref, icon: id, dawn: kind === 'dawn' || kind === 'upgrade' };
}

/** A float of jars arriving: "+2". */
export const plus = (n: number): string => `+${fmtNum(n)}`;
