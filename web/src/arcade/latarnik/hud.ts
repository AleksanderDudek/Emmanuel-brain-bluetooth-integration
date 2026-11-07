/**
 * Latarnik's own overlays on the play canvas (version 2).  The runner's standard HUD now shows the
 * block, its strategy, the gauge and the score, so this draws only what belongs to the game:
 *
 *   the deck      the night's three lanterns, the perfect ladder (8 = Pełne światło), the night's
 *                 goal chip with its count and its three stars as they stand
 *   Zośka         the gull on her post and her speech bubble (talk.ts says what and when)
 *   the words     floating words ("Idealnie", "+3"), titles over the sea (a night's name, Pełne
 *                 światło, Blask latarni) and the card slot (amber, the blind reveal)
 *   the cards     the opening story with the root verse, and the card between two nights (its
 *                 stars, the next night's name, goal and one sentence of story)
 *
 * Titles take turns and so do cards (queue.ts); floating words keep clear of the deck, the cards,
 * the titles and each other.  Every string is fitted to its room, so it reads on a 390 px phone.
 */
import { approach, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { AMBER, DUPLICATE_OKRUCHY, SETS, TIER_NAME } from './content';
import { farShips, goalText, nightName, storyText, t } from './i18n';
import { BOTTOM, TOP, layout, type Layout, type Rect } from './layout';
import { nightSpec } from './nights';
import { C, SANS, SERIF, amberSprite, paintBoat, paintGull, sprites, type AmberSprite, type BoatLook, type GullPose } from './paint';
import { Queue, type QueueOpts } from './queue';
import { RULES, TAU, type LatarnikSim } from './sim';

export const font = (weight: number, size: number, family: string, italic = false) => `${italic ? 'italic ' : ''}${weight} ${Math.round(size * 10) / 10}px ${family}`;

/** Advance timed items and drop the finished ones, in place (no new arrays per frame). */
export function age<T extends { t: number; dur: number }>(list: T[], dt: number): void {
  let n = 0;
  for (const it of list) {
    it.t += dt;
    if (it.t < it.dur) list[n++] = it;
  }
  list.length = n;
}

/** A font size fitted for one place on screen, with its font: measured again only when its text or room changes. */
export interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
export const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

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
interface Title { text: string; color: string; size: number; fit: number; w: number; font: string }
interface Card {
  kind: 'amber' | 'reveal' | 'note';
  piece: number; isNew: boolean; far: number;
  title: string; sub: string;
  tw: number; lines: string[]; font2: string;
  icon: AmberSprite | null; iconU: number;
}

/** The title's line, below the lamp (in R, upward positive): the runner's block banner owns the space above it. */
const TITLE_Y = -0.46;
const PAD = 3;
const MAX_BOXES = 40;
const TXT = { armed: t('hud.armed'), ladder: t('hud.ladder'), blind: t('block.blind'), open: t('open.title'), openText: t('open.text'), openTap: t('open.tap'), again: t('card.again'), rule: t('stars.rule') };

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
  private readonly bubbleWrap = { text: '', maxW: -1, lines: [] as string[] };
  private goalKey = '';
  private goalLines = { head: '', goal: '', count: '' };
  private readonly goalFit = fitSlot();
  private openLay: { lay: PassageLayout; w: number; h: number; text: string[] } | null = null;
  private between: { key: string; title: string; lines: string[]; tw: number } | null = null;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      ladder: font(650, 11.5 * u, SANS), cardTitle: font(650, 14.5 * u, SANS), cardSub: font(500, 12 * u, SANS),
      goalHead: font(750, 10.5 * u, SANS), goal: font(650, 13 * u, SANS), count: font(500, 22 * u, SERIF),
      bubble: font(600, 13.5 * u, SANS), cardBig: font(500, 26 * u, SERIF), cardLine: font(600, 13.5 * u, SANS), cardSmall: font(500, 12 * u, SANS),
    };
  }

  resize(L: Layout, dpr: number): void {
    this.L = L;
    this.dpr = dpr;
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

  float(text: string, x: number, y: number, color: string, size: number, serif = false, dur = 1.1, rise = 40): void {
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
    this.titles.push({ text, color, size, fit: 0, w: 0, font: '' }, o);
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
  }

  fitIn(slot: Fit, text: string, maxW: number, size: number, weight: number, family: string, italic = false): number {
    if (slot.text !== text || slot.maxW !== maxW || slot.size !== size) {
      this.ctx.font = font(weight, size, family, italic);
      const tw = this.ctx.measureText(text).width;
      slot.text = text;
      slot.maxW = maxW;
      slot.size = size;
      slot.fit = tw <= maxW ? size : Math.max(9, Math.floor((size * maxW) / tw * 10) / 10);
      slot.font = font(weight, slot.fit, family, italic);
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
    const { w, h, cx, cy, R, s } = this.L;
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
    const top = Math.max(TOP + 4, this.L.top), bottom = h - BOTTOM;
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

  /** The night's lanterns, the perfect ladder and the goal chip. */
  private drawDeck(sim: LatarnikSim, t: number): void {
    const { ctx, L } = this;
    const { u } = L;
    if (!sim.block) return;
    ctx.save();
    const dawn = sim.ended;
    if (!dawn) {
      this.lanterns(sim, L.lanterns.x, L.lanterns.y, u);
      this.ladder(sim, L.ladder.x, L.ladder.y, u, t);
    }
    const talking = !!sim.talk.line && L.bubbleOnGoal;
    if (!talking && !(L.portrait && this.cards.head)) this.goalChip(sim);
    ctx.restore();
    // the deck is where floating words do not go
    const s = 12.5 * u, g = L.goal;
    let nb = this.box(0, L.lanterns.x - 6, L.lanterns.y - s * 1.5, L.lanterns.x + s * 6.4, L.lanterns.y + s);
    nb = this.box(nb, L.ladder.x - Math.max(RULES.fullLight * 12 * u, 150 * u) - 6, L.ladder.y - 26 * u, L.ladder.x + 6, L.ladder.y + 6 * u);
    nb = this.box(nb, g.x - 4, g.y - 4, g.x + g.w + 4, g.y + g.h + 4);
    nb = this.box(nb, 0, 0, L.w, L.top);
    this.hudBoxes = nb;
  }

  private goalChip(sim: LatarnikSim): void {
    const { ctx, L, fonts: F } = this;
    const { u } = L;
    const g = L.goal, spec = sim.spec;
    const done = Math.min(sim.got, spec.goal);
    const key = `${spec.n}|${done}|${g.w}`;
    if (key !== this.goalKey) {
      this.goalKey = key;
      this.goalLines = {
        head: `${t('sub.night', { n: spec.n + 1, got: done, goal: spec.goal }).split(' · ')[0]} · ${nightName(spec.kind)}`.toLocaleUpperCase(),
        goal: goalText(spec.kind, spec.goal),
        count: `${done}/${spec.goal}`,
      };
    }
    const pop = this.goalPop > 0 ? 1 + 0.06 * ease.outBack(1 - this.goalPop) * this.goalPop * 4 : 1;
    ctx.save();
    ctx.fillStyle = spec.boss ? 'rgba(40,18,26,.72)' : 'rgba(8,14,32,.66)';
    ctx.strokeStyle = spec.boss ? 'rgba(255,122,89,.5)' : 'rgba(255,210,122,.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, 10 * u);
    ctx.fill();
    ctx.stroke();
    const pad = 9 * u;
    // the count, big on the right, popping when it grows
    ctx.font = F.count;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const cw = ctx.measureText(this.goalLines.count).width;
    ctx.save();
    ctx.translate(g.x + g.w - pad, g.y + g.h * 0.5 + (L.portrait ? 0 : 6 * u));
    ctx.scale(pop, pop);
    ctx.fillStyle = C.gold;
    ctx.fillText(this.goalLines.count, 0, 0);
    ctx.restore();
    // the three stars as they stand: ★ the goal, ★★ lanterns, ★★★ the streak
    const sr = 5 * u;
    const sx = L.portrait ? g.x + g.w - pad - cw - 8 * u - sr : g.x + g.w - pad - sr;
    const sy = L.portrait ? g.y + g.h * 0.5 : g.y + 11 * u;
    const st = [sim.got >= spec.goal, sim.lost <= RULES.lostStar, sim.nightStreak >= RULES.streakStar];
    for (let i = 0; i < 3; i++) {
      this.starPath(sx - (2 - i) * sr * 2.5, sy, sr);
      if (st[i]) {
        ctx.fillStyle = i === 1 ? 'rgba(255,210,122,.55)' : C.gold;
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // the night's name and its goal
    const textW = g.w - pad * 2 - (L.portrait ? cw + sr * 7.5 + 10 * u : Math.max(cw, sr * 7.5)) - 6 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = F.goalHead;
    ctx.fillStyle = spec.boss ? '#ffb39c' : 'rgba(255,210,122,.85)';
    const headY = g.y + (L.portrait ? 13 * u : 17 * u);
    ctx.fillText(clip(ctx, this.goalLines.head, textW), g.x + pad, headY);
    this.fitIn(this.goalFit, this.goalLines.goal, textW, 13 * u, 650, SANS);
    ctx.font = this.goalFit.font;
    ctx.fillStyle = C.text;
    ctx.fillText(this.goalLines.goal, g.x + pad, headY + (L.portrait ? 16 * u : 20 * u));
    if (!L.portrait && g.h > 56 * u) {
      // the squall's strength: a bar that empties boat by boat
      if (spec.boss) {
        const bw = textW, by = headY + 30 * u;
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.fillRect(g.x + pad, by, bw, 4 * u);
        ctx.fillStyle = C.coral;
        ctx.fillRect(g.x + pad, by, bw * (sim.left / spec.goal), 4 * u);
      }
    }
    ctx.restore();
  }

  private lanterns(sim: LatarnikSim, x: number, y: number, u: number): void {
    const { ctx } = this;
    const sp = sprites();
    const s = 12.5 * u;
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

  private ladder(sim: LatarnikSim, right: number, y: number, u: number, time: number): void {
    const { ctx } = this;
    const n = RULES.fullLight;
    const r = 4.2 * u, gap = 12 * u;
    const filled = sim.armed ? n : sim.streak % n;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < n; i++) {
      const x = right - r - (n - 1 - i) * gap;
      const on = i < filled;
      // the fifth diamond is the night's third star
      ctx.fillStyle = on ? C.gold : i === RULES.streakStar - 1 ? 'rgba(255,210,122,.32)' : 'rgba(255,255,255,.16)';
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
    ctx.fillStyle = sim.armed ? C.gold : 'rgba(239,232,220,.62)';
    const label = sim.armed ? TXT.armed : sim.streak > 0 ? this.streakTxt.get(sim.streak) : TXT.ladder;
    ctx.fillText(label, right, y - r - 8 * u);
  }

  /** Zośka on her post, and her bubble when she talks. */
  private drawGull(sim: LatarnikSim, t: number): void {
    const { ctx, L } = this;
    const g = L.gull;
    const line = sim.talk.line;
    this.gull.talk = !!line;
    this.gull.face = g.face;
    if (g.s > 0) paintGull(ctx, g.x, g.y - g.s, g.s, t, this.gull);
    if (!line || (L.portrait && this.cards.head)) return;
    const a = Math.min(1, line.t / 0.15, (line.dur - line.t) / 0.25);
    if (a <= 0) return;
    const b = L.bubble, F = this.fonts, u = L.u;
    const pad = 9 * u, lh = 17 * u;
    if (this.bubbleWrap.text !== line.text || this.bubbleWrap.maxW !== b.w) {
      this.bubbleWrap.text = line.text;
      this.bubbleWrap.maxW = b.w;
      this.bubbleWrap.lines = this.wrapLines(line.text, b.w - pad * 2, F.bubble);
    }
    const lines = this.bubbleWrap.lines;
    let size = 13.5 * u, f = F.bubble;
    let bh = lines.length * lh + pad * 1.4;
    const fits = bh <= b.h + 6 * u;
    if (!fits) {
      // a small room: a smaller font
      size = 12 * u;
      f = font(600, size, SANS);
      bh = Math.min(b.h + 10 * u, lines.length * size * 1.22 + pad * 1.2);
    }
    const by = L.bubbleOnGoal ? b.y + (b.h - bh) / 2 : b.y + b.h - bh;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = '#fbf6ea';
    ctx.strokeStyle = 'rgba(40,30,20,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(b.x, by, b.w, bh, 12 * u);
    ctx.fill();
    ctx.stroke();
    // the tail toward her beak
    const beakX = g.x + g.s * 0.45 * g.face, beakY = g.y - g.s * 1.12;
    const tx = clamp(beakX + 10 * u, b.x + 14 * u, b.x + b.w - 14 * u);
    const ty = L.bubbleOnGoal ? by + bh * 0.6 : by + bh;
    ctx.beginPath();
    if (g.s <= 0) {
      // no post to point at
    } else if (L.bubbleOnGoal) {
      ctx.moveTo(b.x, by + bh * 0.4);
      ctx.lineTo(beakX + 4 * u, beakY + 4 * u);
      ctx.lineTo(b.x, ty);
    } else {
      ctx.moveTo(tx - 8 * u, ty - 1);
      ctx.lineTo(beakX + 2 * u, beakY - 2 * u);
      ctx.lineTo(tx + 6 * u, ty - 1);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2016';
    ctx.font = f;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const step = fits ? lh : size * 1.22;
    lines.forEach((ln, i) => ctx.fillText(ln, b.x + pad, by + pad * 0.7 + i * step));
    ctx.restore();
  }

  private titleNow(): Title | null {
    const head = this.titles.head;
    if (!head) return null;
    const ti = head.item;
    if (!ti.fit) {
      const { R, w } = this.L;
      const slot = fitSlot();
      ti.fit = this.fitIn(slot, ti.text, Math.min(w - 32, R * 1.7), ti.size, 500, SERIF, true);
      ti.font = slot.font;
      this.ctx.font = ti.font;
      ti.w = this.ctx.measureText(ti.text).width;
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
    ctx.shadowColor = 'rgba(3,6,16,.8)';
    ctx.shadowBlur = ti.fit * 0.5;
    ctx.fillStyle = ti.color;
    ctx.fillText(ti.text, 0, 0);
    ctx.restore();
  }

  /** The card between two nights: the stars won, the next night's name, its goal and its story; or the night again. */
  private drawBetween(sim: LatarnikSim): void {
    const { ctx, L, fonts: F } = this;
    const { cx, cy, u, w, R } = L;
    const k = sim.phaseT;
    const a = Math.min(1, k / 0.25) * Math.min(1, Math.max(0, (RULES.nightCard - k) / 0.3));
    if (a <= 0) return;
    const cw = Math.min(w - 28, 340 * u, R * 2.1), pad = 14 * u;
    const won = sim.between === 'won';
    const next = won ? nightSpec(sim.p.night) : sim.spec;
    const key = `${sim.between}|${sim.spec.n}|${next.n}|${cw}`;
    if (!this.between || this.between.key !== key) {
      const title = won ? t('card.won', { n: sim.spec.n + 1 }) : TXT.again;
      const lines = won
        ? [t('card.next', { n: next.n + 1, name: nightName(next.kind) }), goalText(next.kind, next.goal), storyText(next.kind)]
        : [t('card.againSub', { n: sim.spec.n + 1, got: sim.got, goal: sim.spec.goal })];
      this.between = { key, title, lines: [], tw: cw - pad * 2 };
      this.ctx.font = F.cardSmall;
      for (let i = 0; i < lines.length; i++) {
        const f = i < 2 ? F.cardLine : F.cardSmall;
        for (const ln of this.wrapLines(lines[i], cw - pad * 2, f)) this.between.lines.push(`${i < 2 ? 'B' : 'S'}${ln}`);
      }
    }
    const lines = this.between.lines;
    const starH = won ? 38 * u : 0;
    const ch = pad * 2 + 30 * u + starH + lines.length * 18 * u + 4 * u;
    const y0 = clamp(cy - ch / 2, L.top + 4, L.h - BOTTOM - ch - 4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.9)';
    ctx.strokeStyle = won ? 'rgba(255,210,122,.45)' : 'rgba(255,122,89,.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(cx - cw / 2, y0 + (1 - ease.outCubic(Math.min(1, k / 0.35))) * 14, cw, ch, 16);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const slot = fitSlot();
    this.fitIn(slot, this.between.title, cw - pad * 2, 26 * u, 500, SERIF, true);
    ctx.font = slot.font;
    ctx.fillStyle = won ? '#ffe1d2' : '#ffb39c';
    let y = y0 + pad + 14 * u;
    ctx.fillText(this.between.title, cx, y);
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
      ctx.fillStyle = ln[0] === 'B' ? C.text : 'rgba(239,232,220,.7)';
      ctx.fillText(ln.slice(1), cx, y);
      y += 18 * u;
    }
    ctx.restore();
  }

  /** The first-ever session's opening card: the story in three sentences and the root verse. */
  private drawOpen(sim: LatarnikSim): void {
    const s = sim.story!;
    const { ctx, L, fonts: F } = this;
    const { cx, u, w, h } = L;
    const a = Math.min(1, s.t / 0.3) * Math.min(1, Math.max(0, (s.dur - s.t) / 0.3));
    const cw = Math.min(w - 24, 440 * u), pad = 16 * u;
    const top = Math.max(L.top, TOP) + 6, bottom = h - BOTTOM - 6;
    const ch = Math.min(bottom - top, 420 * u);
    const y0 = top + (bottom - top - ch) / 2;
    if (!this.openLay || this.openLay.w !== cw || this.openLay.h !== ch) {
      const text = this.wrapLines(TXT.openText, cw - pad * 2, F.cardLine);
      const verseH = ch - pad * 2 - 34 * u - text.length * 19 * u - 40 * u;
      this.openLay = { lay: layoutPassage(ctx, passage('mat5.14-16'), cw - pad * 2, Math.max(40, verseH), { max: 16, min: 10 }), w: cw, h: ch, text };
    }
    const o = this.openLay;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.93)';
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
    y += 36 * u;
    ctx.font = F.cardLine;
    ctx.fillStyle = C.text;
    for (const ln of o.text) {
      ctx.fillText(ln, cx, y);
      y += 19 * u;
    }
    y += 8 * u;
    drawPassage(ctx, passage('mat5.14-16'), o.lay, cx, y, { text: '#fff1cf', ref: C.gold });
    ctx.font = F.cardSmall;
    ctx.fillStyle = 'rgba(239,232,220,.6)';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(TXT.openTap, cx, y0 + ch - pad * 0.8);
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
    const x = sl.x, y = sl.y + (1 - ease.outCubic(Math.min(1, head.t / 0.4))) * 10;
    this.cardBox(x, y, cw, ch, a);
    ctx.save();
    ctx.globalAlpha = a;
    const tx = x + 76 * u, tw = cw - 84 * u, ix = x + 40 * u, iy = y + ch / 2;
    if (card.kind === 'amber') {
      if (!card.icon || card.iconU !== u) {
        const piece = AMBER[card.piece];
        card.icon = amberSprite(56 * u, 44 * u, this.dpr, piece.inclusion, SETS[piece.set].tone, piece.index * 1.7 + 0.3);
        card.iconU = u;
      }
      ctx.drawImage(card.icon.c, ix - card.icon.w / 2, iy - card.icon.h / 2, card.icon.w, card.icon.h);
    } else if (card.kind === 'reveal') {
      const look = this.look;
      look.lit = card.far > 0;
      look.dark = card.far === 0;
      look.alpha = a;
      paintBoat(ctx, 'drobnicowiec', ix, iy, -0.35, 27 * u, look, sprites().cream);
    } else {
      // an upgrade: the lamp's glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprites().cream, ix - 26 * u, iy - 26 * u, 52 * u, 52 * u);
      ctx.restore();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath();
      ctx.arc(ix, iy, 6 * u, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = a;
    if (card.tw !== tw) this.layoutCard(card, tw);
    const one = card.lines.length === 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = card.kind === 'amber' && !card.isNew ? C.text : C.cream;
    ctx.font = F.cardTitle;
    if (one) ctx.fillText(card.lines[0], tx, iy - 9 * u);
    else {
      ctx.fillText(card.lines[0], tx, iy - 17 * u);
      ctx.font = card.font2;
      ctx.fillText(card.lines[1], tx, iy - 0.5 * u);
    }
    ctx.font = F.cardSub;
    ctx.fillStyle = 'rgba(239,232,220,.62)';
    ctx.fillText(clip(ctx, card.sub, tw), tx, iy + (one ? 11 : 17) * u);
    ctx.restore();
  }

  private layoutCard(card: Card, tw: number): void {
    const F = this.fonts, u = this.L.u;
    const lines = this.wrapLines(card.title, tw, F.cardTitle);
    card.tw = tw;
    card.font2 = F.cardTitle;
    if (lines.length <= 1) card.lines = lines;
    else {
      const rest = lines.slice(1).join(' '), fit = fitSlot();
      card.lines = [lines[0], rest];
      this.fitIn(fit, rest, tw, 14.5 * u, 650, SANS);
      card.font2 = fit.font;
    }
  }

  private cardBox(x: number, y: number, w: number, h: number, a: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(8,12,26,.88)';
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
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

  /** `text` broken into lines of at most `maxW` in font `f`. */
  private wrapLines(text: string, maxW: number, f: string): string[] {
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
    return lines;
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
  return { kind, piece, isNew, far, title, sub, tw: -1, lines: [], font2: '', icon: null, iconU: 0 };
}
