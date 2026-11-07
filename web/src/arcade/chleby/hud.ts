/**
 * Chleby i ryby's HUD on the play canvas: the status card (the block's name and progress or the
 * telegraph; "in your head" — a strategy to try; "the headband" — what the band drives in this
 * block; and a live chip saying what the signal does to the golden gate or the crumbs right now),
 * the headline — people fed, counting up live — the level's strip (the hillside, the hunger left,
 * the baskets of crumbs), the block card after each block (its own mini-curve and verdict, the
 * blind reveal), toasts, the words floating over the hill, the companion's speech bubble, the story
 * cards, the card of upgrades between levels and the evening.  Every string is fitted to its room so
 * it reads on a 390 px phone in German and Swedish.
 */
import { fmtNum } from '../../i18n';
import { passage } from '../kit/scripture';
import { approach, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, type PassageLayout } from '../kit/scripture';
import { CHAPTERS, STORIES, TIPS, UP_NAME, UP_TEXT, type Who } from './content';
import { grain as grainText, t, unit } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintBasket, paintStar } from './paint';
import { RULES, type BlockKind, type ChlebySim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

/** A card after a block: its name, its verdict and the block's own curve (normalised 0..1). */
interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  blind: boolean; kind: BlockKind | 'toast';
}

interface Bubble { who: Who; text: string; t: number; dur: number }
interface Story { kind: 'open' | 'chapter'; chapter: number; t: number; dur: number; out: number }

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'), done: t('block.done'),
  nextPush: t('next.push'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
  head: t('label.head'), band: t('label.band'),
  driveWarm: t('drive.warmup'), drivePush: t('drive.push'), driveBlind: t('drive.blind'), driveRest: t('drive.rest'), driveFinale: t('drive.finale'),
  below: t('live.below'), none: t('live.none'), noneRest: t('live.noneRest'), blindChip: t('live.blind'), high: t('live.high'), restWait: t('live.restWait'), full: t('live.full'),
  hint: t('hint.press'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'), baskets: t('hud.baskets'),
  upTitle: t('upc.title'), upGo: t('upc.go'), storyTap: t('story.tap'), openTitle: t('story.openTitle'), openText: t('story.open'),
};

const PX = /(\d+(?:\.\d+)?)px/;

/** "×3" or "×3,5" in this language's style. */
export const fmtX = (m: number): string => `×${fmtNum(m, m % 1 ? 1 : 0)}`;

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private F = Hud.fontsFor(1);
  private shown = 0;
  private pop = 0;
  private hintA = 0;
  private finaleA = 0;
  private upA = 0;
  private bubble: Bubble | null = null;
  private story: Story | null = null;
  private verse: PassageLayout | null = null;
  private verseKey = '';
  private readonly wraps = new Map<string, string[]>();
  /** the upgrade card's buttons while it is open (for taps) */
  readonly offerRects: Rect[] = [];
  goRect: Rect | null = null;
  /** the status card's bottom this frame */
  statusBottom = 0;

  constructor(ctx: CanvasRenderingContext2D, private readonly lagLabel: string) {
    this.ctx = ctx;
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 19 * u, SERIF), nameShort: font(500, 15 * u, SERIF), tip: font(560, 12 * u, SANS), tipShort: font(560, 10.5 * u, SANS),
      chip: font(750, 11.5 * u, SANS), small: font(650, 11 * u, SANS), score: font(500, 38 * u, SERIF), scoreSmall: font(500, 27 * u, SERIF),
      unit: font(650, 12 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true), cardSub: font(650, 12 * u, SANS), big: font(500, 26 * u, SERIF, true),
      strip: font(750, 11.5 * u, SANS), stripBig: font(600, 14 * u, SERIF), bubble: font(650, 12.5 * u, SANS), storyTitle: font(500, 21 * u, SERIF, true),
      storyText: font(560, 13 * u, SANS), upName: font(650, 14 * u, SERIF), upText: font(600, 11 * u, SANS), upPrice: font(800, 12 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
    this.verse = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(850, size * u, SANS), rise: rise * u });
    if (this.floats.length > 22) this.floats.shift();
  }

  popScore(): void { this.pop = 1; }

  say(who: Who, text: string, dur: number): void { this.bubble = { who, text, t: 0, dur }; }

  showStory(kind: 'open' | 'chapter', chapter: number): void {
    this.story = { kind, chapter, t: 0, dur: kind === 'open' ? 11 : 6, out: 0 };
  }

  /** A tap hides a story card shown for a moment already; true when it did. */
  hideStory(): boolean {
    const s = this.story;
    // the opening card holds a few seconds against eager taps, so it is read; a chapter's card less
    if (!s || s.t < (s.kind === 'open' ? 4 : 2) || s.out > 0) return false;
    s.out = 0.001;
    return true;
  }

  get storyOn(): boolean { return this.story !== null; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: ChlebySim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'push' ? (blind ? TXT.blind : TXT.push) : TXT.rest;
    let sub: string, color: string = C.text;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) });
      color = '#55708a';
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'push' ? t('card.push.pass') : t('card.rest.pass');
      color = kind === 'push' ? C.goldDeep : C.calmDeep;
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, blind, kind });
  }

  toast(title: string, sub: string, color: string = C.text, dur = 2.6): void {
    this.pushCard({ title, sub, color, t: 0, dur, curve: null, blind: false, kind: 'toast' });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  update(dt: number, sim: ChlebySim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.4);
    }
    if (this.bubble && (this.bubble.t += dt) >= this.bubble.dur) this.bubble = null;
    const s = this.story;
    if (s) {
      s.t += dt;
      if (s.out > 0) s.out += dt * 3;
      else if (s.t >= s.dur) s.out = 0.001;
      if (s.out >= 1) this.story = null;
    }
    this.pop = Math.max(0, this.pop - dt * 2.6);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length ? 1 : 0, dt, 0.5);
    this.upA = approach(this.upA, sim.stage === 'upgrade' && sim.phase !== 'done' ? 1 : 0, dt, 0.08);
  }

  draw(sim: ChlebySim, anchors: { mirka: { x: number; y: number }; boy: { x: number; y: number } }): void {
    this.status(sim);
    this.score(sim);
    this.strip(sim);
    this.drawFloats();
    this.drawCard();
    this.hintPill();
    this.upgrade(sim);
    if (!this.story) this.drawBubble(anchors);   // a story card has the floor
    this.drawStory();
    this.finale();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.92): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,246,224,${a})`;
    ctx.strokeStyle = 'rgba(150,110,60,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * this.L.u);
    ctx.fill();
    ctx.stroke();
  }

  /** The font `f`, shrunk (to `min` of its size at most) so `text` fits `maxW`. */
  private fit(text: string, maxW: number, f: string, min = 0.7): string {
    const ctx = this.ctx;
    ctx.font = f;
    const w = ctx.measureText(text).width;
    if (w <= maxW) return f;
    const m = f.match(PX);
    if (!m) return f;
    const size = Math.max(Number(m[1]) * min, (Number(m[1]) * maxW) / w);
    return f.replace(m[0], `${Math.round(size * 10) / 10}px`);
  }

  /** `text` wrapped to `maxW` in font `f`, at most `max` lines (the last one ends in "…" when cut); cached. */
  private lines(text: string, maxW: number, f: string, max: number): string[] {
    const key = `${f}|${Math.round(maxW)}|${max}|${text}`;
    let out = this.wraps.get(key);
    if (!out) {
      this.ctx.font = f;
      out = wrap(this.ctx, text, maxW);
      if (out.length > max) {
        out = out.slice(0, max);
        let last = out[max - 1];
        while (last.length > 1 && this.ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        out[max - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
      }
      if (this.wraps.size > 80) this.wraps.clear();
      this.wraps.set(key, out);
    }
    return out;
  }

  // ── the status ──────────────────────────────────────────────────
  private status(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const b = sim.block, play = sim.phase === 'play';
    const name = !play ? (sim.phase === 'done' ? TXT.done : TXT.finale) : b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
    let tip = play ? sim.tip : '';
    if (play && b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    const drive = !play ? (sim.phase === 'done' ? '' : TXT.driveFinale) : b.kind === 'warmup' ? TXT.driveWarm : b.kind === 'rest' ? TXT.driveRest : b.blind ? TXT.driveBlind : TXT.drivePush;
    const short = L.mode === 'short';
    const pad = (short ? 9 : 12) * u;
    const textW = r.w - 2 * pad;
    const lh = (short ? 12.5 : 14.5) * u;
    const tf = short ? F.tipShort : F.tip;
    const tipLs = tip ? this.lines(`${TXT.head} ${tip}`, textW, tf, L.tipLines) : [];
    const driveText = drive && (b.kind === 'warmup' || !play) ? drive : drive ? `${TXT.band} ${drive}` : '';
    const driveLs = driveText ? this.lines(driveText, textW, tf, L.driveLines) : [];
    const chip = this.chip(sim);
    const ch = (short ? 16 : 18) * u;
    const head = (L.scoreInStatus ? 56 : 46) * u;
    const hh = Math.min(r.h, head + (tipLs.length + driveLs.length) * lh + (tipLs.length ? 3 * u : 0) + (driveLs.length ? 3 * u : 0) + (chip ? ch + 4 * u : 0) + 8 * u);
    const cardH = L.scoreInStatus ? Math.max(hh, 70 * u) : hh;
    this.paper(r.x, r.y, r.w, cardH);
    this.statusBottom = r.y + cardH;
    const nameW = r.w - 2 * pad - (L.scoreInStatus ? 104 * u : 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = play && b.kind === 'rest' ? C.calmDeep : sim.blind ? '#55708a' : C.text;
    ctx.font = this.fit(name, nameW, short ? F.nameShort : F.name);
    ctx.fillText(name, r.x + pad, r.y + (short ? 6 : 8) * u);
    const by = r.y + (short ? 26 : 34) * u;
    const left = play ? b.dur - sim.blockT : 0;
    if (play && left <= RULES.telegraph) {
      const nb = sim.next;
      const txt = !nb ? TXT.nextFinale : nb.kind === 'rest' ? TXT.nextRest : TXT.nextPush;
      ctx.font = this.fit(txt, nameW, F.small);
      ctx.fillStyle = '#9a5a10';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sim.t * 6);
      ctx.fillText(txt, r.x + pad, by - 3 * u);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = 'rgba(90,70,40,.18)';
      ctx.fillRect(r.x + pad, by, nameW, 3 * u);
      ctx.fillStyle = play && b.kind === 'rest' ? C.calm : C.gold;
      ctx.fillRect(r.x + pad, by, nameW * clamp(play ? sim.blockT / b.dur : 1), 3 * u);
    }
    let y = r.y + head;
    const row = (label: string, ls: string[], color: string) => {
      if (!ls.length) return;
      ctx.font = tf;
      ls.forEach((line, i) => {
        if (i === 0 && line.startsWith(label)) {
          ctx.fillStyle = color;
          ctx.fillText(label, r.x + pad, y);
          const lw = ctx.measureText(`${label} `).width;
          ctx.fillStyle = C.textSoft;
          ctx.fillText(line.slice(label.length + 1), r.x + pad + lw, y);
        } else {
          ctx.fillStyle = C.textSoft;
          ctx.fillText(line, r.x + pad, y + i * lh);
        }
      });
      y += ls.length * lh + 3 * u;
    };
    row(TXT.head, tipLs, '#5a6f2e');
    row(TXT.band, driveLs, '#a8700c');
    if (chip) {
      const cf = this.fit(chip.text, r.w - 2 * pad - 22 * u, F.chip, 0.7);
      ctx.font = cf;
      const cw = Math.min(r.w - 2 * pad, ctx.measureText(chip.text).width + 24 * u);
      const cy = Math.min(y + 1 * u, r.y + cardH - ch - 5 * u);
      ctx.fillStyle = chip.bg;
      ctx.beginPath();
      ctx.roundRect(r.x + pad, cy, cw, ch, ch / 2);
      ctx.fill();
      ctx.fillStyle = chip.fg;
      ctx.beginPath();
      ctx.arc(r.x + pad + 9 * u, cy + ch / 2, 3.5 * u * (chip.pulse ? 0.8 + 0.3 * Math.sin(sim.t * 7) : 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.textBaseline = 'middle';
      ctx.fillText(chip.text, r.x + pad + 17 * u, cy + ch / 2 + 0.5);
      ctx.textBaseline = 'top';
    }
  }

  /** What the band does right now, in words and a colour. */
  private chip(sim: ChlebySim): { text: string; bg: string; fg: string; pulse: boolean } | null {
    if (sim.phase !== 'play') return null;
    const b = sim.block;
    if (b.kind === 'warmup') return null;
    if (b.kind === 'push') {
      if (b.blind) return { text: TXT.blindChip, bg: 'rgba(85,112,138,.16)', fg: '#55708a', pulse: false };
      if (sim.blockT < sim.leadIn) return { text: t('live.wait', { lag: t('lag', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) }) }), bg: 'rgba(90,70,40,.1)', fg: '#7a6040', pulse: true };
      if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,110,.16)', fg: '#77776a', pulse: false };
      return sim.level >= 0.5
        ? { text: t('live.above', { x: fmtX(sim.gold).slice(1) }), bg: 'rgba(243,193,63,.32)', fg: '#a8700c', pulse: true }
        : { text: TXT.below, bg: 'rgba(90,70,40,.1)', fg: '#7a6040', pulse: false };
    }
    if (sim.basketsLevel >= RULES.basketsMax) return { text: TXT.full, bg: 'rgba(90,160,184,.2)', fg: C.calmDeep, pulse: false };
    if (sim.blockT < sim.calmLeadIn) return { text: TXT.restWait, bg: 'rgba(90,160,184,.16)', fg: C.calmDeep, pulse: true };
    if (!sim.reliable) return { text: TXT.noneRest, bg: 'rgba(120,120,110,.16)', fg: '#77776a', pulse: false };
    return sim.calm >= 0.5
      ? { text: t('live.calm', { n: Math.round(sim.calm * 100) }), bg: 'rgba(90,160,184,.25)', fg: C.calmDeep, pulse: true }
      : { text: TXT.high, bg: 'rgba(90,70,40,.1)', fg: '#7a6040', pulse: false };
  }

  // ── the headline ────────────────────────────────────────────────
  private score(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.2 * ease.outBack(this.pop) * this.pop;
    const inCard = L.scoreInStatus;
    const nf = inCard ? F.scoreSmall : F.score;
    ctx.font = nf;
    const nw = Math.max(ctx.measureText(fmtNum(n)).width, (ctx.font = F.unit, ctx.measureText(unit(n)).width));
    if (!inCard) this.paper(L.scoreX - nw - 22 * u, L.scoreY + 2 * u, nw + 22 * u, 66 * u, 0.88);
    ctx.save();
    ctx.translate(L.scoreX - 11 * u, L.scoreY + (inCard ? 4 : 6) * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = nf;
    ctx.fillStyle = C.text;
    ctx.fillText(fmtNum(n), 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = C.textSoft;
    ctx.fillText(unit(n), L.scoreX - 11 * u, L.scoreY + (inCard ? 34 : 48) * u);
    void sim;
  }

  // ── the level's strip ───────────────────────────────────────────
  private strip(sim: ChlebySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.strip, F = this.F;
    const h = sim.hill, pl = h.plan;
    const title = `${t('hud.level', { n: pl.level + 1 })} · ${CHAPTERS[pl.chapter]}`;
    const left = h.left;
    const share = h.share;
    const hungry = t('hud.hungry', { n: fmtNum(left) });
    const bk = `${sim.basketsLevel}/${RULES.basketsMax}`;
    if (L.mode === 'wide') {
      this.paper(r.x, r.y, r.w, r.h, 0.88);
      const pad = 10 * u;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = C.text;
      ctx.font = this.fit(title, r.w - 2 * pad, F.stripBig);
      ctx.fillText(title, r.x + pad, r.y + 7 * u);
      // the hunger bar
      const by = r.y + 29 * u, bw = r.w - 2 * pad - 70 * u;
      this.bar(r.x + pad, by, bw, 7 * u, share);
      ctx.font = this.fit(hungry, 66 * u, F.strip);
      ctx.fillStyle = C.textSoft;
      ctx.textBaseline = 'middle';
      ctx.fillText(hungry, r.x + pad + bw + 6 * u, by + 3.5 * u);
      // the baskets of crumbs
      ctx.font = F.strip;
      ctx.fillStyle = C.calmDeep;
      const label = `${TXT.baskets} ${bk}`;
      ctx.fillText(label, r.x + pad, r.y + 50 * u);
      const lw = ctx.measureText(label).width + 8 * u;
      this.crumbBaskets(r.x + pad + lw, r.y + 50 * u, r.w - 2 * pad - lw, sim);
      ctx.textBaseline = 'top';
      return;
    }
    // one line: title · bar · hungry · baskets
    this.paper(r.x, r.y, r.w, r.h, 0.86);
    const pad = 8 * u, cy = r.y + r.h / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const tw = Math.min(r.w * 0.42, 170 * u);
    ctx.font = this.fit(title, tw, F.strip, 0.75);
    ctx.fillStyle = C.text;
    ctx.fillText(title, r.x + pad, cy);
    const bx = r.x + pad + Math.min(tw, ctx.measureText(title).width) + 8 * u;
    const right = r.x + r.w - pad;
    ctx.font = F.strip;
    const bkw = ctx.measureText(`◦ ${bk}`).width + 14 * u;
    const bw = Math.max(30 * u, right - bkw - bx - 8 * u);
    this.bar(bx, cy - 3.5 * u, bw, 7 * u, share);
    ctx.fillStyle = 'rgba(58,42,24,.75)';
    ctx.font = font(800, 9 * u, SANS);
    ctx.textAlign = 'center';
    ctx.fillText(fmtNum(left), bx + bw / 2, cy + 0.5);
    paintBasket(ctx, right - bkw + 8 * u, cy + 1 * u, 7 * u, { fill: sim.basketsLevel ? 0.8 : 0 });
    ctx.textAlign = 'right';
    ctx.font = F.strip;
    ctx.fillStyle = C.calmDeep;
    ctx.fillText(bk, right, cy);
    ctx.textBaseline = 'top';
  }

  private bar(x: number, y: number, w: number, h: number, share: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(90,70,40,.16)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#7fae5a';
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(h, w * clamp(share)), h, h / 2);
    ctx.fill();
  }

  /** The level's baskets of crumbs as little baskets in a row (up to twelve). */
  private crumbBaskets(x: number, y: number, w: number, sim: ChlebySim): void {
    const n = RULES.basketsMax, step = Math.min(w / n, 12 * this.L.u);
    for (let i = 0; i < n; i++) {
      const on = i < sim.basketsLevel;
      const fill = on ? 1 : i === sim.basketsLevel ? sim.basketFill : 0;
      this.ctx.globalAlpha = on || fill > 0 ? 1 : 0.35;
      paintBasket(this.ctx, x + step * (i + 0.5), y + 2, step * 0.42, { fill, loaves: true });
    }
    this.ctx.globalAlpha = 1;
  }

  // ── floating words and cards ────────────────────────────────────
  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      ctx.font = f.font;
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(40,28,12,.55)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const k = c.t < 0.25 ? ease.outBack(c.t / 0.25) : 1;
    const a = c.t > c.dur - 0.35 ? Math.max(0, (c.dur - c.t) / 0.35) : 1;
    const w = Math.min(L.lane.hwB * 1.8, 300 * u, L.w - 24), hasCurve = !!c.curve && c.curve.length > 1;
    const h = (hasCurve ? 88 : 54) * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8), y = L.cardY - h / 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    this.paper(0, 0, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = c.kind === 'rest' ? C.calmDeep : C.text;
    ctx.font = this.fit(c.title, w - 20 * u, F.cardTitle);
    ctx.fillText(c.title, w / 2, 8 * u);
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.sub, w - 20 * u, F.cardSub, 0.75);
    ctx.fillText(c.sub, w / 2, 30 * u);
    if (hasCurve) {
      const bx = 14 * u, by = 50 * u, bw = w - 28 * u, bh = 30 * u;
      ctx.fillStyle = c.kind === 'rest' ? 'rgba(90,160,184,.14)' : 'rgba(243,193,63,.12)';
      ctx.fillRect(bx, by, bw, bh);
      const pts = c.curve!;
      // threshold
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(58,42,24,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(bx + p.x * bw, by + p.ty * bh) : ctx.moveTo(bx + p.x * bw, by + p.ty * bh)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i];
        if (!p0.reliable || !p1.reliable) continue;
        ctx.strokeStyle = p0.above && p1.above ? C.goldDeep : '#7a8f95';
        ctx.beginPath();
        ctx.moveTo(bx + p0.x * bw, by + p0.y * bh);
        ctx.lineTo(bx + p1.x * bw, by + p1.y * bh);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── the companion's bubble ──────────────────────────────────────
  private drawBubble(anchors: { mirka: { x: number; y: number }; boy: { x: number; y: number } }): void {
    const b = this.bubble;
    // never over a story card or the card of upgrades (its buttons must stay clear)
    if (!b || this.story || this.upA > 0.3) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, b.t / 0.18, (b.dur - b.t) / 0.3);
    const k = b.t < 0.22 ? ease.outBack(b.t / 0.22) : 1;
    const maxW = Math.min(250 * u, L.w * 0.62);
    const ls = this.lines(b.text, maxW - 20 * u, F.bubble, 4);
    ctx.font = F.bubble;
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const w = tw + 20 * u, lh = 15 * u, h = ls.length * lh + 14 * u;
    const at = b.who === 'mirka' ? anchors.mirka : anchors.boy;
    const above = b.who === 'boy' || at.y - h - 16 * u > this.statusBottomSafe();
    let x = at.x - w * (b.who === 'mirka' ? 0.25 : 0.5);
    x = clamp(x, 8, L.w - w - 8);
    const y = above ? at.y - h - 14 * u : at.y + 18 * u;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(at.x, at.y);
    ctx.scale(k, k);
    ctx.translate(-at.x, -at.y);
    ctx.fillStyle = b.who === 'mirka' ? '#ffffff' : '#fff1d6';
    ctx.strokeStyle = b.who === 'mirka' ? 'rgba(214,69,58,.65)' : 'rgba(150,100,50,.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    ctx.stroke();
    // the tail toward the speaker
    const tx = clamp(at.x, x + 14 * u, x + w - 14 * u);
    ctx.beginPath();
    if (above) {
      ctx.moveTo(tx - 7 * u, y + h - 1);
      ctx.lineTo(at.x, at.y - 4 * u);
      ctx.lineTo(tx + 7 * u, y + h - 1);
    } else {
      ctx.moveTo(tx - 7 * u, y + 1);
      ctx.lineTo(at.x, at.y + 6 * u);
      ctx.lineTo(tx + 7 * u, y + 1);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 7 * u + i * lh));
    ctx.restore();
  }

  private statusBottomSafe(): number { return Math.max(this.L.hudBottom, this.L.mode === 'short' ? 0 : this.statusBottom) + 4; }

  private hintPill(): void {
    if (this.hintA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = this.fit(TXT.hint, L.w - 40 * u, this.F.small);
    const w = ctx.measureText(TXT.hint).width + 24 * u, h = 24 * u;
    const x = L.lane.cx - w / 2, y = L.lane.yB - 64 * u;
    ctx.globalAlpha = this.hintA * (0.75 + 0.25 * Math.sin(performance.now() / 260));
    ctx.fillStyle = 'rgba(58,42,24,.78)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff6e0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.hint, L.lane.cx, y + h / 2 + 0.5);
    ctx.globalAlpha = 1;
  }

  // ── the card of upgrades ────────────────────────────────────────
  private upgrade(sim: ChlebySim): void {
    this.offerRects.length = 0;
    this.goRect = null;
    if (this.upA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const list = sim.offers;
    const w = Math.min(L.w - 24, 340 * u), rowH = 44 * u;
    const h = 64 * u + list.length * (rowH + 6 * u) + 40 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    const y = clamp(L.cardY - h / 2, L.mode === 'short' ? 8 : L.hudBottom + 4, L.h - h - 8);
    ctx.save();
    ctx.globalAlpha = this.upA;
    this.paper(x, y, w, h, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.upTitle, w - 24 * u, F.cardTitle);
    ctx.fillText(TXT.upTitle, x + w / 2, y + 10 * u);
    ctx.font = F.cardSub;
    ctx.fillStyle = C.goldDeep;
    ctx.fillText(t('upc.grain', { grain: grainText(sim.p.grain) }), x + w / 2, y + 34 * u);
    let ry = y + 56 * u;
    list.forEach((o, i) => {
      const r = { x: x + 10 * u, y: ry, w: w - 20 * u, h: rowH };
      this.offerRects.push(r);
      ctx.fillStyle = o.can ? 'rgba(243,193,63,.22)' : 'rgba(90,70,40,.08)';
      ctx.strokeStyle = o.can ? C.goldDeep : 'rgba(90,70,40,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 8 * u);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = o.can ? C.text : 'rgba(58,42,24,.5)';
      const nm = `${i + 1}. ${UP_NAME[o.u]} · ${t('upc.level', { n: o.level })}`;
      ctx.font = this.fit(nm, r.w - 90 * u, F.upName);
      ctx.fillText(nm, r.x + 10 * u, r.y + 6 * u);
      ctx.font = this.fit(UP_TEXT[o.u], r.w - 90 * u, F.upText, 0.75);
      ctx.fillStyle = C.textSoft;
      ctx.fillText(UP_TEXT[o.u], r.x + 10 * u, r.y + 25 * u);
      ctx.textAlign = 'right';
      ctx.font = F.upPrice;
      ctx.fillStyle = o.can ? C.goldDeep : 'rgba(58,42,24,.45)';
      ctx.fillText(grainText(o.price), r.x + r.w - 10 * u, r.y + 14 * u);
      ry += rowH + 6 * u;
    });
    // go on, with the seconds left
    const left = Math.max(0, Math.ceil(RULES.upgradeSec - sim.stageT));
    const go = `${TXT.upGo} · ${t('sec', { n: left })}`;
    ctx.font = F.upPrice;
    const gw = ctx.measureText(go).width + 30 * u, gh = 28 * u;
    const g = { x: x + w / 2 - gw / 2, y: ry + 2 * u, w: gw, h: gh };
    this.goRect = g;
    ctx.fillStyle = '#5f9e4a';
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, gh / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(go, x + w / 2, g.y + gh / 2 + 0.5);
    ctx.restore();
  }

  // ── the story cards ─────────────────────────────────────────────
  private drawStory(): void {
    const s = this.story;
    if (!s) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, s.t / 0.35) * (1 - Math.min(1, s.out));
    const open = s.kind === 'open';
    const w = Math.min(L.w - 24, (open ? 420 : 340) * u);
    const title = open ? TXT.openTitle : t('story.chapter', { n: s.chapter + 1, name: CHAPTERS[s.chapter] });
    const text = open ? TXT.openText : STORIES[s.chapter];
    const tl = this.lines(text, w - 32 * u, F.storyText, 6);
    let vh = 0;
    if (open) {
      const key = `${Math.round(w)}`;
      if (!this.verse || this.verseKey !== key) {
        this.verse = layoutPassage(ctx, passage('jhn6.9'), w - 40 * u, 92 * u, { max: 15 * u, min: 10 });
        this.verseKey = key;
      }
      vh = this.verse.height + 14 * u;
    }
    const h = 42 * u + tl.length * 18 * u + vh + 26 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    const y = clamp(L.mode === 'short' ? (L.h - h) / 2 : L.lane.yT + 6 * u, 6, L.h - h - 6);
    const k = s.t < 0.3 ? ease.outBack(s.t / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    this.paper(0, 0, w, h, 0.97);
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(16 * u, 38 * u, w - 32 * u, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(title, w - 28 * u, F.storyTitle);
    ctx.fillText(title, w / 2, 11 * u);
    ctx.font = F.storyText;
    ctx.fillStyle = C.textSoft;
    tl.forEach((l, i) => ctx.fillText(l, w / 2, 48 * u + i * 18 * u));
    if (open && this.verse) drawPassage(ctx, passage('jhn6.9'), this.verse, w / 2, 48 * u + tl.length * 18 * u + 10 * u, { text: '#5a4020', ref: 'rgba(90,64,32,.7)' });
    ctx.font = font(650, 10 * u, SANS);
    ctx.fillStyle = 'rgba(58,42,24,.45)';
    ctx.fillText(TXT.storyTap, w / 2, h - 18 * u);
    ctx.restore();
  }

  // ── the evening ─────────────────────────────────────────────────
  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    ctx.save();
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.w - 24, 360 * u), h = 74 * u;
    const x = L.cardX - w / 2, y = L.cardY - h / 2;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, F.big);
    ctx.fillText(TXT.finaleTitle, L.cardX, y + 12 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, F.cardSub);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(TXT.finaleSub, L.cardX, y + 46 * u);
    ctx.restore();
  }

  /** The stars of a level just fed, popping one by one (drawn by the view over the crowd). */
  drawStars(cx: number, cy: number, stars: number, k: number): void {
    const u = this.L.u;
    for (let i = 0; i < 3; i++) {
      const kk = clamp((k - i * 0.18) / 0.3);
      const s = ease.outBack(kk);
      if (kk <= 0) continue;
      paintStar(this.ctx, cx + (i - 1) * 34 * u, cy - (i === 1 ? 8 * u : 0), 14 * u * s, i < stars);
    }
  }

  get lag(): string { return this.lagLabel; }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
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
