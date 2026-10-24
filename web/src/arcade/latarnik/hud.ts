/**
 * Latarnik's HUD and overlays on the play canvas: the block (name, a strategy to try, its
 * progress, the telegraph), the harbour's score, crates and stars, the watch's lanterns and the
 * ladder of perfects; floating words, the title over the sea (a block's name, a star, "Pełne
 * światło") and the cards (a watch's "Świt", a new piece of amber, the blind Konwój's reveal).
 * Titles take turns and so do cards (queue.ts).  The amber and reveal cards sit off the sea — under
 * it on a phone, in the left column when wide — and floating words keep clear of them, of the
 * HUD's blocks, of the ring's labels and of each other.  At dawn the status reads "Świt".  Every
 * string is fitted to its room, so it reads on a 390 px phone too; texts, sizes and fonts are made
 * again only when they change, so a frame leaves no garbage.
 */
import { approach, clamp, ease } from '../kit/juice';
import { AMBER, DUPLICATE_OKRUCHY, SETS, TIER_NAME } from './content';
import { bare, farShips, t } from './i18n';
import { BOTTOM, TOP, cardSlot, lanternRow, layout, type Layout, type Rect } from './layout';
import { C, SANS, SERIF, amberSprite, paintBoat, sprites, type AmberSprite, type BoatLook } from './paint';
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

/** A word that pops, rises `rise` px and fades; `x` and `off` are where the layout put it this frame. */
interface Float {
  text: string; x0: number; y: number; t: number; dur: number; color: string; size: number; font: string; rise: number;
  w: number; x: number; off: number; placed: boolean;
}
/** A title over the sea; `fit` (its font size), `font` and `w` are measured for the current layout. */
interface Title { text: string; color: string; size: number; fit: number; w: number; font: string }
/** A card's lines are written once; `tw` is the room they were laid out for, `icon` the amber drawn once. */
interface Card {
  kind: 'amber' | 'reveal';
  piece: number; isNew: boolean; far: number;
  title: string; sub: string;
  tw: number; lines: string[]; font2: string;
  icon: AmberSprite | null; iconU: number;
}

/** The title's line, above the lamp (in R). */
const TITLE_Y = 0.5;
/** Room kept around a floating word (px), and the most obstacles one can meet. */
const PAD = 3;
const MAX_BOXES = 40;
const DAWN = '#ffc9b4';
const EYEBROW_MAX = 16;
/** The words the HUD draws every frame, looked up once (the language is settled when the app loads). */
const TXT = {
  dawn: t('block.dawn'), warmup: t('block.warmup'), cisza: t('block.cisza'), konwoj: t('block.konwoj'), blind: t('block.blind'),
  nextCisza: t('next.cisza'), nextKonwoj: t('next.konwoj'), fog: t('fog'), armed: t('hud.armed'), ladder: t('hud.ladder'), soon: t('watch.soon'),
};

export class Hud {
  private L: Layout = layout(390, 844);
  private dpr = 1;
  private readonly floats: Float[] = [];
  private readonly titles = new Queue<Title>();
  private readonly cards = new Queue<Card>(0.3, 0.35);
  private watchCard: { line: string; t: number } | null = null;
  private readonly lanternPop = [0, 0, 0];
  private starPop = 0;
  /** obstacles for floating words, (x0, y0, x1, y1) each: first the HUD's blocks from the last draw */
  private readonly boxes = new Float32Array(MAX_BOXES * 4);
  private hudBoxes = 0;
  /** the reach ring's labels, reserved by the view: slot 0 the reach, slot 1 the last day's ring */
  private readonly labels = new Float32Array(8);
  private readonly labelOn = [false, false];
  /** the card slot, placed with the HUD every frame */
  private readonly slot: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly look: BoatLook = { light: 0, lit: false, dark: false, alpha: 1 };
  // fonts, texts and sizes made once per layout or per change
  private fonts = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, font: '', lines: [] as string[] };
  private readonly watchTxt = new NumText(n => t('hud.watch', { n }));
  private readonly browX = new Float32Array(EYEBROW_MAX);
  private browText = '';
  private readonly scoreTxt = new NumText(n => String(n));
  private readonly portTxt = new NumText(n => bare('hud.inPort', n));
  private readonly portFit = fitSlot();
  private readonly watchFit = fitSlot();
  private readonly crateTxt = new NumText(n => t('crates', { n }));
  private readonly streakTxt = new NumText(n => t('hud.streak', { n }));

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  private static fontsFor(u: number) {
    return {
      eyebrow: font(700, 10.5 * u, SANS), tip: font(500, 13.5 * u, SANS), next: font(650, 12.5 * u, SANS), fog: font(600, 12.5 * u, SANS),
      score: font(400, 46 * u, SERIF), scoreSub: font(650, 12 * u, SANS), ladder: font(650, 11.5 * u, SANS),
      cardTitle: font(650, 14.5 * u, SANS), cardSub: font(500, 12 * u, SANS),
      watchLine: font(650, 15 * u, SANS), watchSmall: font(500, 12.5 * u, SANS),
    };
  }

  resize(L: Layout, dpr: number): void {
    this.L = L;
    this.dpr = dpr;
    this.fonts = Hud.fontsFor(L.u);
    this.nameFit.maxW = -1;
    this.tipWrap.maxW = -1;
    this.browText = '';
    this.crateTxt.reset();
    const head = this.titles.head;
    if (head) head.item.fit = 0;
    const card = this.cards.head;
    if (card) card.item.tw = -1;
  }

  /** A word that pops, rises and fades ("Idealnie", "+3"). */
  float(text: string, x: number, y: number, color: string, size: number, serif = false, dur = 1.1, rise = 40): void {
    const f = font(serif ? 500 : 700, size, serif ? SERIF : SANS, serif);
    this.ctx.font = f;
    const w = this.ctx.measureText(text).width;
    this.floats.push({ text, x0: x, y, t: 0, dur, color, size, font: f, rise, w, x, off: 0, placed: false });
    if (this.floats.length > 14) this.floats.shift();
  }

  /** A word about the island (crumbs, the smokehouse, a new village step), beside it on the dark water: right, else left, else above. */
  floatIsland(text: string, color: string, size: number, dur: number): void {
    const { cx, cy, s, w } = this.L;
    this.ctx.font = font(700, size, SANS);
    const tw = this.ctx.measureText(text).width;
    const right = cx + s * 1.45 + 6, left = cx - s * 1.45 - 6;
    if (right + tw <= w - 8) this.float(text, right + tw / 2, cy + s * 0.45, color, size, false, dur, 16);
    else if (left - tw >= 8) this.float(text, left - tw / 2, cy + s * 0.45, color, size, false, dur, 16);
    else this.float(text, cx, cy - s * 1.5, color, size, false, dur, 16);
  }

  /** A title over the sea for a moment; titles take turns, the more important (lower rank) first. */
  title(text: string, color: string, size: number, o: QueueOpts): void {
    this.titles.push({ text, color, size, fit: 0, w: 0, font: '' }, o);
  }

  clearTitles(): void { this.titles.clear(); }

  /** The watch's "Świt" card. */
  watchEnd(watch: number, n: number): void {
    this.watchCard = { line: t('watch.line', { n: watch, boats: t('boats', { n }) }), t: 0 };
  }

  /** A piece of amber, new or a duplicate, in the card slot. */
  card(piece: number, isNew: boolean, via: 'draw' | 'craft' | 'pity'): void {
    const a = AMBER[piece], name = a.name;
    const title = t(!isNew ? 'card.dup' : via === 'craft' ? 'card.craft' : via === 'pity' ? 'card.pity' : 'card.new', { name });
    const sub = isNew ? `${TIER_NAME[a.tier]} · ${SETS[a.set].name}` : `+${t('crumbs', { n: DUPLICATE_OKRUCHY })}`;
    this.cards.push(newCard('amber', piece, isNew, 0, title, sub), { dur: 2.8, min: 2.2, rank: 1 });
  }

  /** The blind Konwój's reveal: how many ships came in from afar, in the card slot. */
  reveal(far: number): void {
    this.cards.push(newCard('reveal', -1, false, far, farShips(far), TXT.blind), { dur: 3.4, min: 2.6, rank: 0 });
  }

  /** Keep floating words off a label of the reach ring this frame (the view calls it as it draws them). */
  reserve(slot: 0 | 1, x0: number, y0: number, x1: number, y1: number): void {
    const b = this.labels, j = slot * 4;
    b[j] = x0;
    b[j + 1] = y0;
    b[j + 2] = x1;
    b[j + 3] = y1;
    this.labelOn[slot] = true;
  }

  release(slot: 0 | 1): void { this.labelOn[slot] = false; }

  /** A reserved label's centre below it (x, y), for a word that belongs to it; false when it is not drawn. */
  under(slot: 0 | 1, out: { x: number; y: number }): boolean {
    if (!this.labelOn[slot]) return false;
    const b = this.labels, j = slot * 4;
    out.x = (b[j] + b[j + 2]) / 2;
    out.y = b[j + 3];
    return true;
  }

  /** Whether a box meets the title showing now (the view lets its ring labels step back). */
  overTitle(x0: number, y0: number, x1: number, y1: number): boolean {
    const ti = this.titleNow();
    if (!ti) return false;
    const { cx, cy, R } = this.L;
    const y = cy - R * TITLE_Y;
    return x0 < cx + ti.w / 2 + 8 && x1 > cx - ti.w / 2 - 8 && y0 < y + ti.fit * 0.6 && y1 > y - ti.fit * 0.75;
  }

  /** What the title line and the card slot show now, and where the card is (tests and debugging). */
  get showing(): { title: string | null; card: string | null; slot: Rect } {
    const t = this.titles.head, c = this.cards.head;
    return { title: t ? t.item.text : null, card: c ? c.item.title : null, slot: { ...this.slot } };
  }

  popLantern(i: number): void { this.lanternPop[clamp(i, 0, 2)] = 1; }
  popLanterns(): void { this.lanternPop.fill(1); }
  popStar(): void { this.starPop = 1; }

  update(dt: number): void {
    this.titles.update(dt);
    this.cards.update(dt);
    if (this.watchCard && (this.watchCard.t += dt) > RULES.watchCard + 0.3) this.watchCard = null;
    for (let i = 0; i < 3; i++) this.lanternPop[i] = Math.max(0, this.lanternPop[i] - dt * 1.4);
    this.starPop = Math.max(0, this.starPop - dt * 0.5);
    age(this.floats, dt);
    this.layoutFloats(dt);
  }

  draw(sim: LatarnikSim, t: number): void {
    this.drawHud(sim, t);
    this.drawFloats();
    this.drawTitle();
    this.drawCards();
  }

  /** The largest font size ≤ `size` at which `text` fits `maxW`, kept in `slot` (with its font) until text or room change. */
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

  /**
   * Each word where it wants to be, unless that meets an obstacle: then the nearest free spot just
   * above or below one.  Older words keep their place and become obstacles for newer ones; a word
   * eases to a new spot instead of jumping.
   */
  private layoutFloats(dt: number): void {
    const { w, h, cx, cy, R, s, u } = this.L;
    let n = this.hudBoxes;
    n = this.box(n, cx - s * 1.3, cy - s * 0.8, cx + s * 1.3, cy + s * 2.5);   // the island with its pier
    const ti = this.titleNow();
    if (ti) {
      const y = cy - R * TITLE_Y;
      n = this.box(n, cx - ti.w / 2 - 8, y - ti.fit * 0.75, cx + ti.w / 2 + 8, y + ti.fit * 0.6);
    }
    if (this.cards.head) n = this.box(n, this.slot.x, this.slot.y - 4, this.slot.x + this.slot.w, this.slot.y + this.slot.h + 10);
    if (this.watchCard) {
      const cw = Math.min(w - 32, 270 * u), ch = 118 * u;
      n = this.box(n, cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2);
    }
    for (let i = 0; i < 2; i++) {
      const j = i * 4;
      if (this.labelOn[i]) n = this.box(n, this.labels[j], this.labels[j + 1], this.labels[j + 2], this.labels[j + 3]);
    }
    const top = TOP + 4, bottom = h - BOTTOM;
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

  /** The smallest vertical shift that keeps the box clear of the first `n` obstacles and inside [top, bottom]. */
  private clearShift(x0: number, y0: number, x1: number, y1: number, n: number, top: number, bottom: number): number {
    if (this.clear(x0, y0, x1, y1, 0, n, top, bottom)) return 0;
    const b = this.boxes;
    let best = 0, bestAbs = Infinity;
    for (let i = 0; i < n; i++) {
      const j = i * 4;
      if (b[j] >= x1 || b[j + 2] <= x0) continue;   // never in the way
      const up = b[j + 1] - y1, down = b[j + 3] - y0;
      if (Math.abs(up) < bestAbs && this.clear(x0, y0, x1, y1, up, n, top, bottom)) { best = up; bestAbs = Math.abs(up); }
      if (Math.abs(down) < bestAbs && this.clear(x0, y0, x1, y1, down, n, top, bottom)) { best = down; bestAbs = Math.abs(down); }
    }
    if (bestAbs < Infinity) return best;
    return y0 < top ? top - y0 : y1 > bottom ? bottom - y1 : 0;   // no free spot: at least stay on the stage
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

  private drawHud(sim: LatarnikSim, t: number): void {
    const { ctx, L, fonts: F } = this;
    const { w, cx, R, u, portrait } = L;
    if (!sim.block) return;
    const x0 = 18, top = TOP + 10 * u;
    const right = w - 18;
    const scoreW = 118 * u;
    const statusW = portrait ? w - 36 - scoreW - 12 : Math.max(120, cx - R - 30);
    // at dawn the night is over: the status reads "Świt", without a line, a bar or a telegraph
    const dawn = sim.phase === 'finale' || sim.phase === 'done';
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // the block: its name, the line under it, its progress, the telegraph
    const b = sim.block;
    const kind = b.kind;
    const color = dawn ? DAWN : kind === 'cisza' ? '#8cf0dd' : kind === 'konwoj' ? '#ffa48a' : C.cream;
    const name = dawn ? TXT.dawn : kind === 'warmup' ? TXT.warmup : kind === 'cisza' ? TXT.cisza : b.blind ? TXT.blind : TXT.konwoj;
    ctx.textAlign = 'left';
    ctx.font = F.eyebrow;
    ctx.fillStyle = 'rgba(239,232,220,.5)';
    this.eyebrow(sim.watch, x0, top + 10 * u, 1.6 * u);
    const nameSize = this.fitIn(this.nameFit, name, statusW, 27 * u, 500, SERIF);
    ctx.font = this.nameFit.font;
    ctx.fillStyle = color;
    ctx.fillText(name, x0, top + 10 * u + nameSize + 2);
    let y = top + 10 * u + nameSize + 8 * u;
    // the lines keep their room at dawn, so nothing below them moves
    const lines = this.wrapTip(sim.tip, statusW);
    ctx.font = F.tip;
    ctx.fillStyle = 'rgba(239,232,220,.78)';
    for (let i = 0; i < lines.length; i++) {
      y += 17 * u;
      if (!dawn) ctx.fillText(lines[i], x0, y);
    }
    y += 12 * u;
    if (!dawn) {
      const barW = Math.min(statusW, 170 * u);
      const prog = clamp(sim.blockT / b.dur);
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      ctx.fillRect(x0, y, barW, 3);
      ctx.fillStyle = color;
      ctx.fillRect(x0, y, barW * prog, 3);
      const next = sim.next;
      if (next && sim.toNext !== null && sim.toNext <= RULES.telegraph) {
        const nc = next.kind === 'cisza' ? '#8cf0dd' : '#ffa48a';
        const p = 0.5 + 0.5 * Math.sin(t * 6);
        ctx.fillStyle = nc;
        ctx.globalAlpha = 0.6 + 0.4 * p;
        ctx.beginPath();
        ctx.arc(x0 + 4, y + 17 * u, 3.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.font = F.next;
        ctx.fillText(next.kind === 'cisza' ? TXT.nextCisza : TXT.nextKonwoj, x0 + 13, y + 21 * u);
      } else if (!sim.reliable) {
        ctx.font = F.fog;
        ctx.fillStyle = 'rgba(200,214,240,.75)';
        ctx.fillText(TXT.fog, x0, y + 21 * u);
      }
    }
    const statusBottom = y + 30 * u;
    // the score: boats in the harbour, crates
    ctx.textAlign = 'right';
    const scoreSize = 46 * u;
    ctx.font = F.score;
    ctx.fillStyle = C.cream;
    const pop = this.starPop > 0 ? 1 + 0.12 * ease.outElastic(1 - this.starPop) * this.starPop : 1;
    ctx.save();
    ctx.translate(right, top + scoreSize * 0.95);
    ctx.scale(pop, pop);
    ctx.fillText(this.scoreTxt.get(sim.score), 0, 0);
    ctx.restore();
    // the words under the score keep to its column (German and Swedish run long)
    const sub = this.portTxt.get(sim.score);
    this.fitIn(this.portFit, sub, scoreW, 12 * u, 650, SANS);
    ctx.font = this.portFit.font;
    ctx.fillStyle = 'rgba(239,232,220,.62)';
    ctx.fillText(sub, right, top + scoreSize * 0.95 + 18 * u);
    ctx.font = F.scoreSub;
    ctx.fillStyle = 'rgba(255,200,120,.85)';
    const crateLine = this.crateTxt.get(sim.crates, ctx);
    ctx.fillText(crateLine, right, top + scoreSize * 0.95 + 36 * u);
    this.crateIcon(right - this.crateTxt.w - 13 * u, top + scoreSize * 0.95 + 31.5 * u, 9 * u);
    if (sim.starsWon > 0) this.starRow(right, top + scoreSize * 0.95 + 54 * u, sim.starsWon, u);
    // lanterns and the perfect ladder: under the sea on a phone, in the columns when wide
    let ly: number, sy: number;
    if (portrait) ly = sy = lanternRow(L);
    else {
      ly = statusBottom + 20 * u;
      sy = top + scoreSize * 0.95 + (sim.starsWon > 0 ? 88 : 66) * u;
    }
    this.lanterns(sim, x0, ly, u);
    this.ladder(sim, right, sy, u, t);
    ctx.restore();
    cardSlot(L, ly + 14 * u, this.slot);
    // the blocks floating words keep clear of
    const s = 12.5 * u;
    let nb = this.box(0, x0 - 6, top - 4, x0 + statusW + 6, statusBottom);
    nb = this.box(nb, right - scoreW - 12, top - 4, right + 6, top + scoreSize * 0.95 + (sim.starsWon > 0 ? 62 : 42) * u);
    nb = this.box(nb, x0 - 6, ly - s * 1.5, x0 + s * 6.4, ly + s);
    nb = this.box(nb, right - Math.max(RULES.fullLight * 12 * u, 150 * u) - 6, sy - 4.2 * u - 22 * u, right + 6, sy + 4.2 * u + 4);
    this.hudBoxes = nb;
  }

  /** "WACHTA 2", letter-spaced (the letters' offsets measured once per text and layout). */
  private eyebrow(watch: number, x: number, y: number, gap: number): void {
    const { ctx } = this;
    const text = this.watchTxt.get(watch);
    const n = Math.min(text.length, EYEBROW_MAX);
    if (this.browText !== text) {
      this.browText = text;
      let xx = 0;
      for (let i = 0; i < n; i++) {
        this.browX[i] = xx;
        xx += ctx.measureText(text[i]).width + gap;
      }
    }
    for (let i = 0; i < n; i++) ctx.fillText(text[i], x + this.browX[i], y);
  }

  /** The block's line broken to the status column (kept until the line or the room changes). */
  private wrapTip(text: string, maxW: number): string[] {
    const k = this.tipWrap, f = this.fonts.tip;
    if (k.text !== text || k.maxW !== maxW || k.font !== f) {
      k.text = text;
      k.maxW = maxW;
      k.font = f;
      k.lines = this.wrapLines(text, maxW, f);
    }
    return k.lines;
  }

  private crateIcon(x: number, y: number, s: number): void {
    const { ctx } = this;
    ctx.fillStyle = '#b8864c';
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = '#e1b878';
    ctx.fillRect(x - s / 2, y - s / 2, s, s * 0.3);
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

  private starRow(right: number, y: number, n: number, u: number): void {
    const { ctx } = this;
    const r = 6 * u, shown = Math.min(n, 8);
    for (let i = 0; i < shown; i++) {
      const x = right - r - i * r * 2.4;
      const pop = i === shown - 1 && this.starPop > 0 ? 1 + 0.6 * this.starPop : 1;
      ctx.fillStyle = C.gold;
      this.starPath(x, y, r * pop);
      ctx.fill();
    }
  }

  private lanterns(sim: LatarnikSim, x: number, y: number, u: number): void {
    const { ctx } = this;
    const sp = sprites();
    const s = 12.5 * u;
    for (let i = 0; i < RULES.lanterns; i++) {
      const lx = x + s * 0.6 + i * s * 2.3;
      const on = i < sim.lanterns && sim.phase !== 'watchEnd';
      const pop = this.lanternPop[i];
      if (on) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 + 0.4 * pop;
        ctx.drawImage(sp.cream, lx - s * 2, y - s * 2.2, s * 4, s * 4);
        ctx.restore();
      }
      // the lantern: a handle, a cap, a glass body, a base
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

  private ladder(sim: LatarnikSim, right: number, y: number, u: number, t: number): void {
    const { ctx } = this;
    const n = RULES.fullLight;
    const r = 4.2 * u, gap = 12 * u;
    const filled = sim.armed ? n : sim.streak % n;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < n; i++) {
      const x = right - r - (n - 1 - i) * gap;
      const on = i < filled;
      ctx.fillStyle = on ? C.gold : 'rgba(255,255,255,.16)';
      if (sim.armed) ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 6 + i * 0.6);
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = this.fonts.ladder;
    ctx.fillStyle = sim.armed ? C.gold : 'rgba(239,232,220,.55)';
    const label = sim.armed ? TXT.armed : sim.streak > 0 ? this.streakTxt.get(sim.streak) : TXT.ladder;
    ctx.fillText(label, right, y - r - 8 * u);
  }

  /** The title showing now, measured for the current layout (null: none). */
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
    // a soft dark halo keeps it readable over the beam and the glow
    ctx.shadowColor = 'rgba(3,6,16,.8)';
    ctx.shadowBlur = ti.fit * 0.5;
    ctx.fillStyle = ti.color;
    ctx.fillText(ti.text, 0, 0);
    ctx.restore();
  }

  private drawCards(): void {
    const { ctx, fonts: F } = this;
    const { cx, cy, u, w } = this.L;
    if (this.watchCard) {
      const k = this.watchCard.t;
      const a = Math.min(1, k / 0.25) * Math.min(1, Math.max(0, (RULES.watchCard + 0.3 - k) / 0.3));
      const cw = Math.min(w - 32, 270 * u), ch = 118 * u;
      this.cardBox(cx - cw / 2, cy - ch / 2, cw, ch, a);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      this.fitIn(this.watchFit, TXT.dawn, cw - 24, 30 * u, 500, SERIF, true);   // "Morgendämmerung" is long
      ctx.font = this.watchFit.font;
      ctx.fillStyle = '#ffe1d2';
      ctx.fillText(TXT.dawn, cx, cy - 26 * u);
      ctx.font = F.watchLine;
      ctx.fillStyle = C.text;
      ctx.fillText(this.watchCard.line, cx, cy + 8 * u);
      ctx.font = F.watchSmall;
      ctx.fillStyle = 'rgba(239,232,220,.6)';
      ctx.fillText(TXT.soon, cx, cy + 32 * u);
      ctx.restore();
    }
    const head = this.cards.head;
    if (!head) return;
    const a = this.cards.alpha;
    const card = head.item, sl = this.slot;
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
    } else {
      // a cargo ship with its lantern lit, or a dark silhouette when none came from afar
      const look = this.look;
      look.lit = card.far > 0;
      look.dark = card.far === 0;
      look.alpha = a;
      paintBoat(ctx, 'drobnicowiec', ix, iy, -0.35, 27 * u, look, sprites().cream);
    }
    ctx.globalAlpha = a;   // the icon's painter leaves the alpha at 1
    // the title on one line, or two when it does not fit
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
    ctx.fillText(card.sub, tx, iy + (one ? 11 : 17) * u);
    ctx.restore();
  }

  /** A card's title laid out for `tw` px: one line, or two (the second fitted to the room). */
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
    ctx.fillStyle = 'rgba(8,12,26,.84)';
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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

function newCard(kind: Card['kind'], piece: number, isNew: boolean, far: number, title: string, sub: string): Card {
  return { kind, piece, isNew, far, title, sub, tw: -1, lines: [], font2: '', icon: null, iconU: 0 };
}
