/**
 * Latarnik's own overlays on the play canvas (version 2, mobile first).  The runner's standard HUD shows the
 * block, its strategy, the gauge and the score, so this draws only what belongs to the game:
 *
 *   the deck      the night's three lanterns, the perfect ladder (8 = Pełne światło), the night's pill with
 *                 its goal, its count and its three stars as they stand
 *   Zośka         the gull on her post and her speech bubble (talk.ts says what and when)
 *   the words     floating words ("Idealnie", "+3"), titles over the sea (a night's name, Pełne światło,
 *                 Blask latarni) and the card slot (amber, the blind reveal, an upgrade)
 *   the cards     the opening story with the root verse, and the card between two nights (its stars, the
 *                 next night's name, goal and one sentence of story)
 *
 * Titles take turns and so do cards (queue.ts); floating words keep clear of the deck, the cards, the titles
 * and each other.  Every string is fitted to its room and never drawn under the kit's floor (MIN_TEXT,
 * 11 px); what the player reads to play — the goal, a bubble, a card — is MIN_READ (13 px) or more, so it
 * reads on a 360 px phone held at arm's length (DESIGN §12).
 */
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { AMBER, DUPLICATE_OKRUCHY, SETS, TIER_NAME } from './content';
import { farShips, goalText, nightName, storyText, t } from './i18n';
import { LADDER_GAP, LADDER_R, layout, openCardRect, type Layout, type Rect } from './layout';
import { nightSpec } from './nights';
import { C, SANS, SERIF, amberSprite, paintBoat, paintGull, sprites, type AmberSprite, type BoatLook, type GullPose } from './paint';
import { Queue, type QueueOpts } from './queue';
import { RULES, TAU, type LatarnikSim } from './sim';

/** A canvas font, never under the kit's floor (MIN_TEXT, 11 px): smaller text is a smudge on a phone. */
export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.round(Math.max(MIN_TEXT, size) * 10) / 10}px ${family}`;

/** Advance timed items and drop the finished ones, in place (no new arrays per frame). */
export function age<T extends { t: number; dur: number }>(list: T[], dt: number): void {
  let n = 0;
  for (const it of list) {
    it.t += dt;
    if (it.t < it.dur) list[n++] = it;
  }
  list.length = n;
}

/**
 * A font size fitted for one place on screen, with its font and the text as drawn (cut with "…" only when it
 * does not fit even at the floor): measured again only when its text or room changes.
 */
export interface Fit { text: string; maxW: number; size: number; fit: number; font: string; shown: string }
export const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '', shown: '' });

/** A text made from a number, made again only when the number changes (with its width in the font set then). */
export class NumText {
  private n = NaN;
  text = '';
  w = 0;
  constructor(private readonly make: (n: number) => string) {}
  get(n: number, ctx: CanvasRenderingContext2D | null = null): string {
    if (n !== this.n) {
      this.n = n;
      this.text = this.make(n);
      if (ctx) this.w = ctx.measureText(this.text).width;
    }
    return this.text;
  }
  reset(): void { this.n = NaN; }
}

interface Float {
  text: string; x0: number; y: number; t: number; dur: number; color: string; size: number; font: string; rise: number;
  w: number; x: number; off: number; placed: boolean;
}
interface Title { text: string; color: string; size: number; fit: number; w: number; font: string; shown: string }
interface Card {
  kind: 'amber' | 'reveal' | 'note';
  piece: number; isNew: boolean; far: number;
  title: string; sub: string;
  tw: number; lines: string[]; font2: string;
  icon: AmberSprite | null; iconKey: number;
}

/** The title's line, below the lamp (in R, upward positive): the runner's block banner owns the space above it. */
const TITLE_Y = -0.46;
const PAD = 3;
const MAX_BOXES = 40;
const TXT = { armed: t('hud.armed'), ladder: t('hud.ladder'), blind: t('block.blind'), open: t('open.title'), openText: t('open.text'), again: t('card.again'), rule: t('stars.rule') };

export class Hud {
  private L: Layout = layout(390, 844);
  private dpr = 1;
  private readonly floats: Float[] = [];
  private readonly titles = new Queue<Title>();
  private readonly cards = new Queue<Card>(0.3, 0.35);
  private readonly lanternPop = [0, 0, 0];
  private goalPop = 0;
  private readonly boxes = new Float32Array(MAX_BOXES * 4);
  private hudBoxes = 0;
  private readonly labels = new Float32Array(8);
  private readonly labelOn = [false, false];
  private readonly look: BoatLook = { light: 0, lit: false, dark: false, alpha: 1 };
  readonly gull: GullPose = { talk: false, cheer: 0, flap: 0, face: 1 };
  private fonts = Hud.fontsFor(1);
  private readonly streakTxt = new NumText(n => t('hud.streak', { n }));
  private readonly bubbleWrap = { text: '', maxW: -1, size: 0, lines: [] as string[] };
  private goalKey = '';
  private goal = { head: '', lines: [] as string[], count: '', font: '', headShown: '', cw: 0 };
  private openLay: { lay: PassageLayout; w: number; h: number; text: string[]; tap: string; font: string; lh: number } | null = null;
  private between: { key: string; title: string; lines: string[]; tw: number } | null = null;
  /** the opening card as last drawn (any tap on the screen closes it; the targets name it) */
  private openRect: Rect | null = null;
  /** what the "tap" lines say: a finger taps, a keyboard may press Space too */
  private touch = true;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      ladder: font(650, 13 * u, SANS), cardTitle: font(700, 15 * u, SANS), cardSub: font(500, 13 * u, SANS),
      goalHead: font(750, 12 * u, SANS), goal: font(650, 14 * u, SANS), count: font(500, 24 * u, SERIF),
      bubble: font(600, 14 * u, SANS), cardBig: font(500, 26 * u, SERIF), cardLine: font(600, 14.5 * u, SANS), cardSmall: font(500, 13.5 * u, SANS),
    };
  }

  resize(L: Layout, dpr: number, touch = this.touch): void {
    this.L = L;
    this.dpr = dpr;
    this.touch = touch;
    this.fonts = Hud.fontsFor(L.u);
    this.goalKey = '';
    this.bubbleWrap.maxW = -1;
    this.openLay = null;
    this.between = null;
    const head = this.titles.head;
    if (head) head.item.fit = 0;
    const card = this.cards.head;
    if (card) card.item.tw = -1;
  }

  float(text: string, x: number, y: number, color: string, px: number, serif = false, dur = 1.1, rise = 40): void {
    const size = Math.max(MIN_READ, px);
    const f = font(serif ? 500 : 700, size, serif ? SERIF : SANS, serif);
    this.ctx.font = f;
    const w = this.ctx.measureText(text).width;
    this.floats.push({ text, x0: x, y, t: 0, dur, color, size, font: f, rise, w, x, off: 0, placed: false });
    if (this.floats.length > 14) this.floats.shift();
  }

  /** A word about the island (crumbs, a village step), beside it on the dark water: right, else left, else above. */
  floatIsland(text: string, color: string, size: number, dur: number): void {
    const { cx, cy, s, w } = this.L;
    this.ctx.font = font(700, size, SANS);
    const tw = this.ctx.measureText(text).width;
    const right = cx + s * 1.45 + 6, left = cx - s * 1.45 - 6;
    if (right + tw <= w - 8) this.float(text, right + tw / 2, cy + s * 0.45, color, size, false, dur, 16);
    else if (left - tw >= 8) this.float(text, left - tw / 2, cy + s * 0.45, color, size, false, dur, 16);
    else this.float(text, cx, cy - s * 1.5, color, size, false, dur, 16);
  }

  title(text: string, color: string, size: number, o: QueueOpts): void {
    this.titles.push({ text, color, size, fit: 0, w: 0, font: '', shown: text }, o);
  }

  clearTitles(): void { this.titles.clear(); }

  /** A piece of amber, new or a duplicate, in the card slot. */
  card(piece: number, isNew: boolean, via: 'draw' | 'craft' | 'pity'): void {
    const a = AMBER[piece], name = a.name;
    const title = t(!isNew ? 'card.dup' : via === 'craft' ? 'card.craft' : via === 'pity' ? 'card.pity' : 'card.new', { name });
    const sub = isNew ? `${TIER_NAME[a.tier]} · ${SETS[a.set].name}` : `+${t('crumbs', { n: DUPLICATE_OKRUCHY })}`;
    this.cards.push(newCard('amber', piece, isNew, 0, title, sub), { dur: 2.8, min: 2.2, rank: 1 });
  }

  /** The blind Konwój's reveal: how many ships came in from afar. */
  reveal(far: number): void {
    this.cards.push(newCard('reveal', -1, false, far, farShips(far), TXT.blind), { dur: 3.4, min: 2.6, rank: 0 });
  }

  /** A short note in the card slot (an upgrade: what it does). */
  note(title: string, sub: string): void {
    this.cards.push(newCard('note', -1, true, 0, title, sub), { dur: 3, min: 2.2, rank: 1 });
  }

  reserve(slot: 0 | 1, x0: number, y0: number, x1: number, y1: number): void {
    const b = this.labels, j = slot * 4;
    b[j] = x0;
    b[j + 1] = y0;
    b[j + 2] = x1;
    b[j + 3] = y1;
    this.labelOn[slot] = true;
  }

  release(slot: 0 | 1): void { this.labelOn[slot] = false; }

  under(slot: 0 | 1, out: { x: number; y: number }): boolean {
    if (!this.labelOn[slot]) return false;
    const b = this.labels, j = slot * 4;
    out.x = (b[j] + b[j + 2]) / 2;
    out.y = b[j + 3];
    return true;
  }

  overTitle(x0: number, y0: number, x1: number, y1: number): boolean {
    const ti = this.titleNow();
    if (!ti) return false;
    const { cx, cy, R } = this.L;
    const y = cy - R * TITLE_Y;
    return x0 < cx + ti.w / 2 + 8 && x1 > cx - ti.w / 2 - 8 && y0 < y + ti.fit * 0.6 && y1 > y - ti.fit * 0.75;
  }

  /** What the title line and the card slot show now, and where the card is (tests and debugging). */
  get showing(): { title: string | null; card: string | null; slot: Rect } {
    const ti = this.titles.head, c = this.cards.head;
    return { title: ti ? ti.item.text : null, card: c ? c.item.title : null, slot: { ...this.L.card } };
  }

  /** The opening card where it was last drawn (null: not on screen). */
  get openCard(): Rect | null { return this.openRect; }

  popLantern(i: number): void { this.lanternPop[clamp(i, 0, 2)] = 1; }
  popLanterns(): void { this.lanternPop.fill(1); }
  popGoal(): void { this.goalPop = 1; }

  update(dt: number): void {
    this.titles.update(dt);
    this.cards.update(dt);
    for (let i = 0; i < 3; i++) this.lanternPop[i] = Math.max(0, this.lanternPop[i] - dt * 1.4);
    this.goalPop = Math.max(0, this.goalPop - dt * 2.2);
    this.gull.cheer = Math.max(0, this.gull.cheer - dt);
    this.gull.flap = Math.max(0, this.gull.flap - dt * 1.5);
    age(this.floats, dt);
    this.layoutFloats(dt);
  }

  draw(sim: LatarnikSim, t: number): void {
    this.drawDeck(sim, t);
    this.drawGull(sim, t);
    this.drawFloats();
    if (sim.phase !== 'between' && !sim.story) this.drawTitle();
    this.drawCards();
    if (sim.phase === 'between') this.drawBetween(sim);
    if (sim.story) this.drawOpen(sim);
    else this.openRect = null;
  }

  /**
   * Fit `text` to `maxW`: from `size` down to `min` (never under MIN_TEXT), then cut with "…".  Sets the
   * slot's font and the text to draw; returns the size.
   */
  fitIn(slot: Fit, text: string, maxW: number, size: number, weight: number, family: string, italic = false, min = MIN_READ): number {
    if (slot.text !== text || slot.maxW !== maxW || slot.size !== size) {
      const floor = Math.max(MIN_TEXT, Math.min(min, size));
      this.ctx.font = font(weight, size, family, italic);
      const tw = this.ctx.measureText(text).width;
      slot.text = text;
      slot.maxW = maxW;
      slot.size = size;
      slot.fit = tw <= maxW ? size : Math.max(floor, Math.floor((size * maxW) / tw * 10) / 10);
      slot.font = font(weight, slot.fit, family, italic);
      this.ctx.font = slot.font;
      slot.shown = this.ctx.measureText(text).width <= maxW + 0.5 ? text : clip(this.ctx, text, maxW);
    }
    return slot.fit;
  }

  // ── where floating words go ─────────────────────────────────────
  private box(i: number, x0: number, y0: number, x1: number, y1: number): number {
    if (i >= MAX_BOXES) return i;
    const b = this.boxes, j = i * 4;
    b[j] = x0;
    b[j + 1] = y0;
    b[j + 2] = x1;
    b[j + 3] = y1;
    return i + 1;
  }

  private layoutFloats(dt: number): void {
    const { w, cx, cy, R, s } = this.L;
    let n = this.hudBoxes;
    n = this.box(n, cx - s * 1.3, cy - s * 0.8, cx + s * 1.3, cy + s * 2.5);
    const ti = this.titleNow();
    if (ti) {
      const y = cy - R * TITLE_Y;
      n = this.box(n, cx - ti.w / 2 - 8, y - ti.fit * 0.75, cx + ti.w / 2 + 8, y + ti.fit * 0.6);
    }
    const c = this.L.card;
    if (this.cards.head) n = this.box(n, c.x, c.y - 4, c.x + c.w, c.y + c.h + 10);
    for (let i = 0; i < 2; i++) {
      const j = i * 4;
      if (this.labelOn[i]) n = this.box(n, this.labels[j], this.labels[j + 1], this.labels[j + 2], this.labels[j + 3]);
    }
    const top = this.L.top + 4, bottom = this.L.bottom;
    for (const f of this.floats) {
      const half = f.w / 2 + PAD, hh = f.size * 0.6 + PAD;
      const x = clamp(f.x0, half + 6, w - half - 6);
      const y = f.y - f.rise * ease.outCubic(f.t / f.dur);
      const want = this.clearShift(x - half, y - hh, x + half, y + hh, n, top, bottom);
      f.off = f.placed ? approach(f.off, want, dt, 0.08) : want;
      f.placed = true;
      f.x = x;
      n = this.box(n, x - half, y + f.off - hh, x + half, y + f.off + hh);
    }
  }

  private clearShift(x0: number, y0: number, x1: number, y1: number, n: number, top: number, bottom: number): number {
    if (this.clear(x0, y0, x1, y1, 0, n, top, bottom)) return 0;
    const b = this.boxes;
    let best = 0, bestAbs = Infinity;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      if (b[j] >= x1 || b[j + 2] <= x0) continue;
      const up = b[j + 1] - y1, down = b[j + 3] - y0;
      if (Math.abs(up) < bestAbs && this.clear(x0, y0, x1, y1, up, n, top, bottom)) { best = up; bestAbs = Math.abs(up); }
      if (Math.abs(down) < bestAbs && this.clear(x0, y0, x1, y1, down, n, top, bottom)) { best = down; bestAbs = Math.abs(down); }
    }
    if (bestAbs < Infinity) return best;
    return y0 < top ? top - y0 : y1 > bottom ? bottom - y1 : 0;
  }

  private clear(x0: number, y0: number, x1: number, y1: number, d: number, n: number, top: number, bottom: number): boolean {
    if (y0 + d < top - 0.01 || y1 + d > bottom + 0.01) return false;
    const b = this.boxes;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      if (b[j] < x1 && b[j + 2] > x0 && b[j + 1] < y1 + d - 0.01 && b[j + 3] > y0 + d + 0.01) return false;
    }
    return true;
  }

  // ── drawing ─────────────────────────────────────────────────────
  private drawFloats(): void {
    const { ctx, dpr } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.16 ? ease.outBack(k / 0.16) : 1;
      const y = f.y - f.rise * ease.outCubic(k) + f.off;
      ctx.setTransform(dpr * pop, 0, 0, dpr * pop, f.x * dpr, y * dpr);
      ctx.font = f.font;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.fillStyle = 'rgba(4,8,20,.55)';
      ctx.fillText(f.text, 1, 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
    }
    ctx.restore();
  }

  /** The night's lanterns, the perfect ladder and the night's pill. */
  private drawDeck(sim: LatarnikSim, t: number): void {
    const { ctx, L } = this;
    const { u } = L;
    if (!sim.block) return;
    ctx.save();
    const dawn = sim.ended;
    if (!dawn) {
      this.lanterns(sim, L.lanterns.x, L.lanterns.y, L.lanterns.s);
      this.ladder(sim, L.ladder.x, L.ladder.y, u, t);
    }
    const talking = !!sim.talk.line && L.bubbleOnGoal;
    if (!talking && !(L.cardOver === 'goal' && this.cards.head)) this.pill(sim);
    ctx.restore();
    // the deck is where floating words do not go
    const s = L.lanterns.s, g = L.goal, lad = L.ladder;
    let nb = this.box(0, L.lanterns.x - 6, L.lanterns.y - s * 1.5, L.lanterns.x + s * 6.4, L.lanterns.y + s);
    nb = this.box(nb, lad.x - Math.max(RULES.fullLight * LADDER_GAP * u, lad.label) - 6, lad.y - 26 * u, lad.x + 6, lad.y + 8 * u);
    nb = this.box(nb, g.x - 4, g.y - 4, g.x + g.w + 4, g.y + g.h + 4);
    nb = this.box(nb, 0, 0, L.w, L.top);
    this.hudBoxes = nb;
  }

  /**
   * The night's pill: the night's name and its stars on the first line, the goal under it, the count big on the
   * right.  A goal too long for one line at 13 px takes both lines (the night's name is in the score corner and
   * on its card).  A squall's pill keeps a bar of the boats still to bring through.
   */
  private pill(sim: LatarnikSim): void {
    const { ctx, L, fonts: F } = this;
    const { u } = L;
    const g = L.goal, spec = sim.spec;
    const done = Math.min(sim.got, spec.goal);
    const pad = Math.round(10 * u), sr = 5.5 * u, starsW = sr * 7;
    const key = `${spec.n}|${done}|${g.w}|${g.h}`;
    if (key !== this.goalKey) {
      this.goalKey = key;
      const count = `${done}/${spec.goal}`;
      ctx.font = F.count;
      const cw = ctx.measureText(count).width;
      const textW = g.w - pad * 2 - cw - 10 * u;
      const head = `${t('sub.night', { n: spec.n + 1, got: done, goal: spec.goal }).split(' · ')[0]} · ${nightName(spec.kind)}`.toLocaleUpperCase();
      const goal = goalText(spec.kind, spec.goal);
      const slot = fitSlot();
      this.fitIn(slot, goal, textW, 14 * u, 650, SANS);
      let lines: string[], f: string;
      if (slot.shown === goal) {
        lines = [goal];
        f = slot.font;
      } else {
        // two lines, beside the stars on the first
        f = font(650, Math.max(MIN_READ, 13.5 * u), SANS);
        lines = this.wrapLines(goal, textW - starsW - 8 * u, f, 2);
      }
      ctx.font = F.goalHead;
      this.goal = { head, lines, count, font: f, headShown: clip(ctx, head, textW - starsW - 8 * u), cw };
    }
    const G = this.goal;
    const pop = this.goalPop > 0 ? 1 + 0.06 * ease.outBack(1 - this.goalPop) * this.goalPop * 4 : 1;
    ctx.save();
    ctx.fillStyle = spec.boss ? 'rgba(40,18,26,.8)' : 'rgba(8,14,32,.78)';
    ctx.strokeStyle = spec.boss ? 'rgba(255,122,89,.5)' : 'rgba(255,210,122,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, Math.min(12 * u, g.h / 2));
    ctx.fill();
    ctx.stroke();
    // the count, big on the right, popping when it grows
    ctx.font = F.count;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(g.x + g.w - pad, g.y + g.h * 0.53);
    ctx.scale(pop, pop);
    ctx.fillStyle = C.gold;
    ctx.fillText(G.count, 0, 0);
    ctx.restore();
    // the three stars as they stand (★ the goal, ★★ lanterns, ★★★ the streak), right of the first line
    const l1 = g.y + g.h * 0.31, l2 = g.y + g.h * 0.71;
    const sx = g.x + g.w - pad - G.cw - 10 * u - sr;
    const st = [sim.got >= spec.goal, sim.lost <= RULES.lostStar, sim.nightStreak >= RULES.streakStar];
    for (let i = 0; i < 3; i++) {
      this.starPath(sx - (2 - i) * sr * 2.5, l1, sr);
      if (st[i]) {
        ctx.fillStyle = i === 1 ? 'rgba(255,210,122,.55)' : C.gold;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // the night's name and its goal (or the goal alone on both lines)
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (G.lines.length === 1) {
      ctx.font = F.goalHead;
      ctx.fillStyle = spec.boss ? '#ffb39c' : 'rgba(255,210,122,.9)';
      ctx.fillText(G.headShown, g.x + pad, l1);
      ctx.font = G.font;
      ctx.fillStyle = C.text;
      ctx.fillText(G.lines[0], g.x + pad, l2);
    } else {
      ctx.font = G.font;
      ctx.fillStyle = C.text;
      ctx.fillText(G.lines[0], g.x + pad, l1);
      ctx.fillText(G.lines[1] ?? '', g.x + pad, l2);
    }
    if (spec.boss) {
      // the squall's strength: a bar along the pill's foot that empties boat by boat
      const bw = g.w - pad * 2, by = g.y + g.h - 4 * u;
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(g.x + pad, by, bw, 2.5 * u);
      ctx.fillStyle = C.coral;
      ctx.fillRect(g.x + pad, by, bw * clamp(sim.left / spec.goal), 2.5 * u);
    }
    ctx.restore();
  }

  private lanterns(sim: LatarnikSim, x: number, y: number, s: number): void {
    const { ctx } = this;
    const sp = sprites();
    for (let i = 0; i < RULES.lanterns; i++) {
      const lx = x + s * 0.6 + i * s * 2.3;
      const on = i < sim.lanterns && sim.phase !== 'between';
      const pop = this.lanternPop[i];
      if (on) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 + 0.4 * pop;
        ctx.drawImage(sp.cream, lx - s * 2, y - s * 2.2, s * 4, s * 4);
        ctx.restore();
      }
      ctx.strokeStyle = on ? '#6b5236' : 'rgba(255,255,255,.2)';
      ctx.lineWidth = Math.max(1, s * 0.1);
      ctx.beginPath();
      ctx.arc(lx, y - s * 1.05, s * 0.24, Math.PI, TAU);
      ctx.stroke();
      ctx.fillStyle = on ? '#4a3622' : 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.moveTo(lx - s * 0.5, y - s * 0.82);
      ctx.lineTo(lx, y - s * 1.12);
      ctx.lineTo(lx + s * 0.5, y - s * 0.82);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(lx - s * 0.5, y + s * 0.62, s, s * 0.2);
      ctx.fillStyle = on ? (pop > 0 ? '#fffbe8' : C.gold) : 'rgba(255,255,255,.07)';
      ctx.beginPath();
      ctx.roundRect(lx - s * 0.36, y - s * 0.82, s * 0.72, s * 1.44, s * 0.2);
      ctx.fill();
      if (!on) {
        ctx.strokeStyle = pop > 0 ? 'rgba(255,122,89,.9)' : 'rgba(255,255,255,.22)';
        ctx.globalAlpha = pop > 0 ? Math.max(0.3, pop) : 1;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  /**
   * The perfect ladder: eight diamonds, the fifth the night's third star.  Its words stand over it where the
   * layout gives them room; else a short count ("×3") does, and nothing while it is empty.
   */
  private ladder(sim: LatarnikSim, right: number, y: number, u: number, time: number): void {
    const { ctx } = this;
    const n = RULES.fullLight;
    const r = LADDER_R * u, gap = LADDER_GAP * u;
    const filled = sim.armed ? n : sim.streak % n;
    for (let i = 0; i < n; i++) {
      const x = right - r - (n - 1 - i) * gap;
      const on = i < filled;
      // the fifth diamond is the night's third star
      ctx.fillStyle = on ? C.gold : i === RULES.streakStar - 1 ? 'rgba(255,210,122,.36)' : 'rgba(255,255,255,.2)';
      if (sim.armed) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 6 + i * 0.6);
      const big = on && i === filled - 1 ? 1.25 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y - r * big);
      ctx.lineTo(x + r * big, y);
      ctx.lineTo(x, y + r * big);
      ctx.lineTo(x - r * big, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = this.fonts.ladder;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = sim.armed ? C.gold : 'rgba(239,232,220,.72)';
    let label = sim.armed ? TXT.armed : sim.streak > 0 ? this.streakTxt.get(sim.streak) : TXT.ladder;
    if (ctx.measureText(label).width > this.L.ladder.label) label = !sim.armed && sim.streak > 0 ? `×${sim.streak}` : '';
    if (label) ctx.fillText(label, right, y - r - 8 * u);
  }

  /** Zośka on her post, and her bubble when she talks. */
  private drawGull(sim: LatarnikSim, t: number): void {
    const { ctx, L } = this;
    const g = L.gull;
    const line = sim.talk.line;
    this.gull.talk = !!line;
    this.gull.face = g.face;
    if (g.s > 0) paintGull(ctx, g.x, g.y - g.s, g.s, t, this.gull);
    if (!line || (L.cardOver && this.cards.head)) return;
    const a = Math.min(1, line.t / 0.15, (line.dur - line.t) / 0.25);
    if (a <= 0) return;
    const b = L.bubble, u = L.u;
    const pad = Math.round(9 * u);
    if (this.bubbleWrap.text !== line.text || this.bubbleWrap.maxW !== b.w) {
      // 14 px: a bubble taller than its room grows (down over the sea's edge for a moment), its words never shrink
      this.bubbleWrap.text = line.text;
      this.bubbleWrap.maxW = b.w;
      this.bubbleWrap.size = Math.max(MIN_READ + 1, 14 * u);
      this.bubbleWrap.lines = this.wrapLines(line.text, b.w - pad * 2, font(600, this.bubbleWrap.size, SANS));
    }
    const { lines, size } = this.bubbleWrap;
    const lh = size * 1.24;
    const bh = lines.length * lh + pad * 1.3;
    // on the pill it hangs from the pill's top; beside her post it stands on its foot (and grows upward)
    const by = L.bubbleOnGoal ? b.y : Math.max(L.top + 4, b.y + b.h - bh);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fbf6ea';
    ctx.strokeStyle = 'rgba(40,30,20,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(b.x, by, b.w, bh, Math.min(12 * u, bh / 2));
    ctx.fill();
    ctx.stroke();
    // the tail toward her beak
    const beakX = g.x + g.s * 0.45 * g.face, beakY = g.y - g.s * 1.12;
    ctx.beginPath();
    if (g.s <= 0) {
      // no post to point at
    } else if (L.bubbleOnGoal) {
      const ty = Math.min(by + bh * 0.62, by + 30 * u);
      ctx.moveTo(b.x, Math.max(by + 6 * u, ty - 12 * u));
      ctx.lineTo(beakX + 4 * u, beakY + 3 * u);
      ctx.lineTo(b.x, ty);
    } else {
      const ty = by + bh;
      const tx = clamp(beakX + 10 * u, b.x + 14 * u, b.x + b.w - 14 * u);
      ctx.moveTo(tx - 8 * u, ty - 1);
      ctx.lineTo(beakX + 2 * u, beakY - 2 * u);
      ctx.lineTo(tx + 6 * u, ty - 1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2016';
    ctx.font = font(600, size, SANS);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, b.x + pad, by + pad * 0.65 + lh * (i + 0.5)));
    ctx.restore();
  }

  private titleNow(): Title | null {
    const head = this.titles.head;
    if (!head) return null;
    const ti = head.item;
    if (!ti.fit) {
      const { R, w } = this.L;
      const slot = fitSlot();
      ti.fit = this.fitIn(slot, ti.text, Math.min(w - 32, Math.max(R * 1.9, 240)), ti.size, 500, SERIF, true, 15);
      ti.font = slot.font;
      ti.shown = slot.shown;
      this.ctx.font = ti.font;
      ti.w = this.ctx.measureText(ti.shown).width;
    }
    return ti;
  }

  private drawTitle(): void {
    const ti = this.titleNow();
    if (!ti) return;
    const { ctx } = this;
    const { cx, cy, R } = this.L;
    const t = this.titles.head!.t;
    const pop = t < 0.35 ? 0.9 + 0.1 * ease.outBack(t / 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = this.titles.alpha;
    ctx.translate(cx, cy - R * TITLE_Y);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = ti.font;
    // a dark rim instead of a blurred shadow: as readable over the beam, and cheap on a phone
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, ti.fit * 0.2);
    ctx.strokeStyle = 'rgba(3,6,16,.6)';
    ctx.strokeText(ti.shown, 0, 0);
    ctx.fillStyle = ti.color;
    ctx.fillText(ti.shown, 0, 0);
    ctx.restore();
  }

  /** The card between two nights: the stars won, the next night's name, its goal and its story; or the night again. */
  private drawBetween(sim: LatarnikSim): void {
    const { ctx, L, fonts: F } = this;
    const { cx, cy, u, w, R } = L;
    const k = sim.phaseT;
    const a = Math.min(1, k / 0.25) * Math.min(1, Math.max(0, (RULES.nightCard - k) / 0.3));
    if (a <= 0) return;
    const cw = Math.min(w - 28, 340 * u, Math.max(R * 2.1, 300)), pad = Math.round(14 * u);
    const won = sim.between === 'won';
    const next = won ? nightSpec(sim.p.night) : sim.spec;
    const key = `${sim.between}|${sim.spec.n}|${next.n}|${cw}`;
    if (!this.between || this.between.key !== key) {
      const title = won ? t('card.won', { n: sim.spec.n + 1 }) : TXT.again;
      const lines = won
        ? [t('card.next', { n: next.n + 1, name: nightName(next.kind) }), goalText(next.kind, next.goal), storyText(next.kind)]
        : [t('card.againSub', { n: sim.spec.n + 1, got: sim.got, goal: sim.spec.goal })];
      this.between = { key, title, lines: [], tw: cw - pad * 2 };
      for (let i = 0; i < lines.length; i++) {
        const f = i < 2 ? F.cardLine : F.cardSmall;
        for (const ln of this.wrapLines(lines[i], cw - pad * 2, f)) this.between.lines.push(`${i < 2 ? 'B' : 'S'}${ln}`);
      }
    }
    const lines = this.between.lines;
    const starH = won ? 38 * u : 0, step = 19 * u;
    const ch = pad * 2 + 30 * u + starH + lines.length * step + 4 * u;
    const y0 = clamp(cy - ch / 2, L.top + 4, L.bottom - ch - 4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.92)';
    ctx.strokeStyle = won ? 'rgba(255,210,122,.45)' : 'rgba(255,122,89,.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, y0 + (1 - ease.outCubic(Math.min(1, k / 0.35))) * 14, cw, ch, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const slot = fitSlot();
    this.fitIn(slot, this.between.title, cw - pad * 2, 26 * u, 500, SERIF, true, 16);
    ctx.font = slot.font;
    ctx.fillStyle = won ? '#ffe1d2' : '#ffb39c';
    let y = y0 + pad + 14 * u;
    ctx.fillText(slot.shown, cx, y);
    y += 22 * u;
    if (won) {
      const sr = 13 * u;
      for (let i = 0; i < 3; i++) {
        const on = i < sim.lastStars;
        const q = ease.outBack(clamp((k - 0.25 - i * 0.22) / 0.3));
        this.starPath(cx + (i - 1) * sr * 2.6, y + sr, sr * (on ? Math.max(0.01, q) : 1));
        if (on) {
          ctx.fillStyle = C.gold;
          ctx.fill();
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,.3)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
      y += starH;
    }
    for (const ln of lines) {
      ctx.font = ln[0] === 'B' ? F.cardLine : F.cardSmall;
      ctx.fillStyle = ln[0] === 'B' ? C.text : 'rgba(239,232,220,.78)';
      ctx.fillText(ln.slice(1), cx, y);
      y += step;
    }
    ctx.restore();
  }

  /** The first-ever session's opening card: the story in three sentences and the root verse. */
  private drawOpen(sim: LatarnikSim): void {
    const s = sim.story!;
    const { ctx, L, fonts: F } = this;
    const { u } = L;
    const a = Math.min(1, s.t / 0.3) * Math.min(1, Math.max(0, (s.dur - s.t) / 0.3));
    const box = openCardRect(L);
    const cw = box.w, ch = box.h, y0 = box.y, cx = box.x + cw / 2, pad = Math.round(16 * u);
    if (!this.openLay || this.openLay.w !== cw || this.openLay.h !== ch) {
      // the story at 14.5 px, a little smaller on a small phone (never under 13.5) if the verse would not fit whole
      const tap = t(this.touch ? 'open.tap' : 'open.tap.keys');
      for (const size of [14.5 * u, 14 * u, 13.5 * u]) {
        const f = font(600, Math.max(MIN_READ + 0.5, size), SANS), lh = Math.round(size * 1.31 * 10) / 10;
        const text = this.wrapLines(TXT.openText, cw - pad * 2, f);
        const verseH = ch - pad * 2 - 34 * u - text.length * lh - 8 * u - 28 * u;
        const lay = layoutPassage(ctx, passage('mat5.14-16'), cw - pad * 2, Math.max(40, verseH), { max: 16 * u, min: MIN_READ });
        this.openLay = { lay, w: cw, h: ch, text, tap, font: f, lh };
        if (lay.fits) break;
      }
    }
    const o = this.openLay!;
    const lh = o.lh;
    this.openRect = box;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.94)';
    ctx.strokeStyle = 'rgba(255,210,122,.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, y0, cw, ch, 18);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = F.cardBig;
    ctx.fillStyle = C.gold;
    let y = y0 + pad;
    ctx.fillText(TXT.open, cx, y);
    y += 34 * u;
    ctx.font = o.font;
    ctx.fillStyle = C.text;
    for (const ln of o.text) {
      ctx.fillText(ln, cx, y);
      y += lh;
    }
    y += 8 * u;
    drawPassage(ctx, passage('mat5.14-16'), o.lay, cx, y, { text: '#fff1cf', ref: C.gold });
    ctx.font = F.cardSmall;
    ctx.fillStyle = 'rgba(239,232,220,.75)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(clip(ctx, o.tap, cw - pad * 2), cx, y0 + ch - pad * 0.8);
    ctx.restore();
  }

  private drawCards(): void {
    const { ctx, fonts: F } = this;
    const { u } = this.L;
    const head = this.cards.head;
    if (!head) return;
    const a = this.cards.alpha;
    const card = head.item, sl = this.L.card;
    const cw = sl.w, ch = sl.h;
    // a short slot (the pill's place on a phone) holds one line of title and one of detail
    const compact = ch < 54 * u;
    const x = sl.x, y = sl.y + (1 - ease.outCubic(Math.min(1, head.t / 0.4))) * (compact ? 6 : 10);
    this.cardBox(x, y, cw, ch, a);
    ctx.save();
    ctx.globalAlpha = a;
    const iw = compact ? Math.min(46 * u, ch * 1.05) : 56 * u, ih = iw * 0.78;
    const ix = x + (compact ? 8 * u + iw / 2 : 40 * u), iy = y + ch / 2;
    const tx = compact ? ix + iw / 2 + 8 * u : x + 76 * u, tw = x + cw - 10 * u - tx;
    if (card.kind === 'amber') {
      const iconKey = Math.round(iw * 10);
      if (!card.icon || card.iconKey !== iconKey) {
        const piece = AMBER[card.piece];
        card.icon = amberSprite(iw, ih, this.dpr, piece.inclusion, SETS[piece.set].tone, piece.index * 1.7 + 0.3);
        card.iconKey = iconKey;
      }
      ctx.drawImage(card.icon.c, ix - card.icon.w / 2, iy - card.icon.h / 2, card.icon.w, card.icon.h);
    } else if (card.kind === 'reveal') {
      const look = this.look;
      look.lit = card.far > 0;
      look.dark = card.far === 0;
      look.alpha = a;
      paintBoat(ctx, 'drobnicowiec', ix, iy, -0.35, iw * 0.5, look, sprites().cream);
    } else {
      // an upgrade: the lamp's glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprites().cream, ix - iw * 0.46, iy - iw * 0.46, iw * 0.92, iw * 0.92);
      ctx.restore();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(ix, iy, 6 * u, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = a;
    if (card.tw !== tw) this.layoutCard(card, tw, compact);
    const one = card.lines.length === 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = card.kind === 'amber' && !card.isNew ? C.text : C.cream;
    ctx.font = card.font2;
    if (one) ctx.fillText(card.lines[0], tx, iy - (compact ? 8 : 9) * u);
    else {
      ctx.font = F.cardTitle;
      ctx.fillText(card.lines[0], tx, iy - 17 * u);
      ctx.font = card.font2;
      ctx.fillText(card.lines[1], tx, iy - 0.5 * u);
    }
    ctx.font = F.cardSub;
    ctx.fillStyle = 'rgba(239,232,220,.72)';
    ctx.fillText(clip(ctx, card.sub, tw), tx, iy + (one ? (compact ? 9 : 11) : 17) * u);
    ctx.restore();
  }

  /** The card's title: one line fitted (a short slot), or the first line whole and the rest fitted under it. */
  private layoutCard(card: Card, tw: number, compact: boolean): void {
    const F = this.fonts, u = this.L.u;
    card.tw = tw;
    const fit = fitSlot();
    if (compact) {
      this.fitIn(fit, card.title, tw, 15 * u, 700, SANS);
      card.lines = [fit.shown];
      card.font2 = fit.font;
      return;
    }
    const lines = this.wrapLines(card.title, tw, F.cardTitle);
    card.font2 = F.cardTitle;
    if (lines.length <= 1) card.lines = lines;
    else {
      const rest = lines.slice(1).join(' ');
      this.fitIn(fit, rest, tw, 15 * u, 700, SANS);
      card.lines = [lines[0], fit.shown];
      card.font2 = fit.font;
    }
  }

  private cardBox(x: number, y: number, w: number, h: number, a: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.92)';
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(16, h / 2));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private starPath(x: number, y: number, r: number): void {
    const { ctx } = this;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }

  /** `text` broken into lines of at most `maxW` in font `f`; at most `max` of them, the last cut with "…" when more would follow. */
  private wrapLines(text: string, maxW: number, f: string, max = Infinity): string[] {
    const { ctx } = this;
    ctx.font = f;
    const lines: string[] = [];
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length <= max) return lines;
    const kept = lines.slice(0, Math.max(1, max));
    kept[kept.length - 1] = clip(ctx, `${kept[kept.length - 1]} ${lines.slice(kept.length).join(' ')}`, maxW);
    return kept;
  }
}

/** `text` cut to `maxW` in the context's font, with "…" when cut. */
function clip(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

function newCard(kind: Card['kind'], piece: number, isNew: boolean, far: number, title: string, sub: string): Card {
  return { kind, piece, isNew, far, title, sub, tw: -1, lines: [], font2: '', icon: null, iconKey: 0 };
}
