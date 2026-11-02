/**
 * Anioł Stróż's HUD on the play canvas: the status card (the block's name and progress or the
 * telegraph; "in your head" — a strategy to try; "the headband" — what the band drives in this
 * block; and a live chip saying what the signal does to the aura or the dream right now), the
 * headline — Zmory banished, counting up live — with the night's level, feathers and combo, the
 * window whose sky holds the band's last 40 s (kit/trace: gold above the threshold, a cool band
 * behind lullabies, a dotted gap without signal, a veil over a blind block, the lag bracket at
 * "now") and whose sill holds a star for every second, the block card after each block (its own
 * mini-curve and verdict), toasts, the words floating over the room, the choice of gifts at a
 * level-up, and the dawn.  Every string is fitted to its room so it reads on a 390 px phone in
 * German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, drawTrace, traceBars, type TraceBand, type TraceStyle } from '../kit/trace';
import { TIPS, giftById } from './content';
import { feathers as feathersText, t, unit } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintFeather, paintGiftIcon, paintSill, paintStar, paintWindow } from './paint';
import { RULES, levelNeed, type AniolSim, type BlockKind } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

/** A card after a block: its name, its verdict and the block's own curve (normalised 0..1). */
interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  bands: TraceBand[]; blind: boolean; kind: BlockKind | 'toast';
}

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'), dawn: t('block.dawn'),
  nextPush: t('next.push'), nextBlind: t('next.blind'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
  head: t('label.head'), band: t('label.band'),
  driveWarm: t('drive.warmup'), drivePush: t('drive.push'), driveBlind: t('drive.blind'), driveRest: t('drive.rest'), driveFinale: t('drive.finale'),
  above: t('live.above'), below: t('live.below'), none: t('live.none'), calm: t('live.calm'), high: t('live.high'),
  restWait: t('live.restWait'), blindChip: t('live.blind'),
  hint: t('hint.tap'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'), sen: t('hud.sen'),
};

/** The band's curve in the window's night sky: moonlight below the threshold, gold above it. */
const NIGHT: TraceStyle = {
  line: 'rgba(222,226,255,.85)', above: '#ffd36b', lineWidth: 2, aboveFill: 'rgba(255,211,107,.26)', threshold: 'rgba(222,226,255,.55)',
  focusBand: 'rgba(255,211,107,.07)', restBand: 'rgba(127,167,224,.24)', gap: 'rgba(222,226,255,.6)', veil: 'rgba(78,70,120,.93)',
  now: '#ffe7a0', glow: 'rgba(255,211,107,.4)',
};

const PX = /(\d+(?:\.\d+)?)px/;

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
  private choiceA = 0;
  private levelPop = 0;
  /** the status card's bottom this frame (its height follows its words) */
  private statusBottom = 0;
  private readonly wraps = new Map<string, string[]>();
  private readonly lag: number;
  private readonly lagLabel: string;
  /** the gift cards on screen while a choice is open (for taps) */
  readonly giftRects: Rect[] = [];

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 19 * u, SERIF), nameShort: font(500, 15.5 * u, SERIF), tip: font(560, 12 * u, SANS), tipShort: font(560, 10.5 * u, SANS), label: font(800, 9 * u, SANS), chip: font(750, 11.5 * u, SANS),
      small: font(650, 11 * u, SANS), score: font(500, 38 * u, SERIF), scoreSmall: font(500, 28 * u, SERIF), unit: font(650, 12 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true),
      cardSub: font(650, 12 * u, SANS), big: font(500, 26 * u, SERIF, true), lag: font(700, 9 * u, SANS), level: font(800, 11 * u, SANS),
      giftName: font(650, 14.5 * u, SERIF), giftText: font(600, 11.5 * u, SANS), choiceTitle: font(500, 20 * u, SERIF, true),
    };
  }

  /** the middle and the width of the room's part of the screen (cards and the choice centre there) */
  private get mx(): number { return (this.L.roomX0 + this.L.w) / 2; }
  private get aw(): number { return this.L.w - this.L.roomX0; }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 16) this.floats.shift();
  }

  popScore(): void { this.pop = 1; }
  popLevel(): void { this.levelPop = 1; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: AniolSim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, stars: number): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'push' ? (blind ? TXT.blind : TXT.push) : TXT.rest;
    let sub: string, color: string = C.text;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) });
      color = '#6a4fa0';
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'push' ? t('card.push.pass') : `${t('card.rest.pass')} · ${t('card.stars', { stars: t('stars', { n: stars }) })}`;
      color = kind === 'push' ? C.goldDeep : C.calmDeep;
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, bands: lay.bands.map(b => ({ ...b })), blind, kind });
  }

  toast(title: string, sub: string, color: string = C.text): void {
    this.pushCard({ title, sub, color, t: 0, dur: 2.6, curve: null, bands: [], blind: false, kind: 'toast' });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  update(dt: number, sim: AniolSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.4);
    }
    this.pop = Math.max(0, this.pop - dt * 2.6);
    this.levelPop = Math.max(0, this.levelPop - dt * 1.5);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length ? 1 : 0, dt, 0.5);
    this.choiceA = approach(this.choiceA, sim.choice ? 1 : 0, dt, 0.08);
  }

  draw(sim: AniolSim): void {
    this.status(sim);
    this.score(sim);
    this.levelPill(sim);
    this.drawFloats();
    this.drawCard();
    this.hintPill();
    this.finale();
    this.choice(sim);
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.9): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(247,240,226,${a})`;
    ctx.strokeStyle = 'rgba(160,140,190,.5)';
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
      if (this.wraps.size > 60) this.wraps.clear();
      this.wraps.set(key, out);
    }
    return out;
  }

  // ── the status ──────────────────────────────────────────────────
  private status(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const b = sim.block, play = sim.phase === 'play';
    const name = !play ? (sim.phase === 'done' ? TXT.dawn : TXT.finale) : b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
    let tip = play ? sim.tip : '';
    if (play && b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    const drive = !play ? (sim.phase === 'done' ? '' : TXT.driveFinale) : b.kind === 'warmup' ? TXT.driveWarm : b.kind === 'rest' ? TXT.driveRest : b.blind ? TXT.driveBlind : TXT.drivePush;
    const short = L.mode === 'short';
    const pad = (short ? 9 : 12) * u;
    const textW = r.w - 2 * pad;
    const lh = (short ? 12.5 : 14.5) * u;
    const tf = short ? this.F.tipShort : F.tip;
    // the lines first, so the card is as tall as its words
    const tipLs = tip ? this.lines(`${TXT.head} ${tip}`, textW, tf, L.tipLines) : [];
    const driveLs = drive ? this.lines(`${TXT.band} ${drive}`, textW, tf, L.driveLines) : [];
    const chip = this.chip(sim);
    const ch = (short ? 16 : 18) * u;
    const head = (short ? 34 : L.scoreInStatus ? 48 : 44) * u;
    const hh = Math.min(r.h, head + (tipLs.length + driveLs.length) * lh + (tipLs.length ? 3 * u : 0) + (driveLs.length ? 3 * u : 0) + (chip ? ch + 4 * u : 0) + 8 * u);
    const cardH = L.scoreInStatus ? Math.max(hh, 70 * u) : hh;
    this.paper(r.x, r.y, r.w, cardH);
    this.statusBottom = r.y + cardH;
    const nameW = r.w - 2 * pad - (L.scoreInStatus ? 104 * u : 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = play && b.kind === 'rest' ? '#34507e' : sim.blind ? '#5a4386' : C.text;
    ctx.font = this.fit(name, nameW, short ? F.nameShort : F.name);
    ctx.fillText(name, r.x + pad, r.y + (short ? 6 : 8) * u);
    // the block's progress, or the telegraph, under the name
    const by = r.y + (short ? 26 : 33) * u;
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
      ctx.fillStyle = 'rgba(80,70,110,.18)';
      ctx.fillRect(r.x + pad, by, nameW, 3 * u);
      ctx.fillStyle = play && b.kind === 'rest' ? C.calm : C.gold;
      ctx.fillRect(r.x + pad, by, nameW * clamp(play ? sim.blockT / b.dur : 1), 3 * u);
    }
    // two labelled lines: in your head (a strategy), and the headband (what it drives)
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
    row(TXT.head, tipLs, '#5a4fb0');
    row(TXT.band, driveLs, '#a8700c');
    // the live chip: what the signal does to the aura (or the dream) right now
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
  private chip(sim: AniolSim): { text: string; bg: string; fg: string; pulse: boolean } | null {
    if (sim.phase !== 'play') return null;
    const b = sim.block;
    if (b.kind === 'warmup') return null;
    if (b.kind === 'push') {
      if (b.blind) return { text: TXT.blindChip, bg: 'rgba(106,79,160,.16)', fg: '#5a4386', pulse: false };
      if (sim.blockT < sim.leadIn) return { text: t('live.wait', { lag: t('lag', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) }) }), bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: true };
      if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#77778a', pulse: false };
      return sim.level >= 0.5
        ? { text: TXT.above, bg: 'rgba(245,201,106,.32)', fg: '#a8700c', pulse: true }
        : { text: TXT.below, bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: false };
    }
    if (sim.blockT < sim.starLeadIn) return { text: TXT.restWait, bg: 'rgba(127,167,224,.16)', fg: C.calmDeep, pulse: true };
    if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#77778a', pulse: false };
    return sim.calm >= 0.5
      ? { text: TXT.calm, bg: 'rgba(127,167,224,.25)', fg: C.calmDeep, pulse: true }
      : { text: TXT.high, bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: false };
  }

  // ── the headline ────────────────────────────────────────────────
  private score(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.2 * ease.outBack(this.pop) * this.pop;
    // inside the status card's corner (upright): a smaller number with its unit just under it
    const inCard = L.scoreInStatus;
    const nf = inCard ? F.scoreSmall : F.score;
    ctx.font = nf;
    const nw = Math.max(ctx.measureText(String(n)).width, (ctx.font = F.unit, ctx.measureText(unit(n)).width));
    if (!inCard) this.paper(L.scoreX - nw - 22 * u, L.scoreY + 2 * u, nw + 22 * u, 66 * u, 0.86);
    ctx.save();
    ctx.translate(L.scoreX - 11 * u, L.scoreY + (inCard ? 4 : 6) * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = nf;
    ctx.fillStyle = C.text;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = C.textSoft;
    ctx.fillText(unit(n), L.scoreX - 11 * u, L.scoreY + (inCard ? 32 : 48) * u);
    void sim;
  }

  /** The night's level, its feathers to the next, the combo and the wing shield, under the HUD on the left. */
  private levelPill(sim: AniolSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const h = 22 * u;
    const short = L.mode === 'short';
    const x = short ? L.roomX0 : L.status.x, y = short ? L.scoreY + 2 * u : Math.max(this.statusBottom + 6 * u, L.mode === 'tall' ? L.sill.y + L.sill.h + 8 * u : 0);
    const label = t('hud.level', { n: sim.nightLevel + 1 });
    ctx.font = F.level;
    const lw = ctx.measureText(label).width;
    const barW = 64 * u;
    const mult = sim.mult;
    const multTxt = mult > 1 ? t('hud.mult', { n: mult }) : '';
    const mw = multTxt ? ctx.measureText(multTxt).width + 16 * u : 0;
    const w = 12 * u + 14 * u + lw + 8 * u + barW + 10 * u + mw;
    const k = 1 + 0.15 * this.levelPop;
    ctx.save();
    ctx.translate(x, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-x, -(y + h / 2));
    ctx.fillStyle = 'rgba(28,29,63,.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    paintFeather(ctx, x + 12 * u, y + h / 2, 7 * u, 0.5);
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 22 * u, y + h / 2 + 0.5);
    const bx = x + 22 * u + lw + 8 * u, byy = y + h / 2 - 3 * u;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.roundRect(bx, byy, barW, 6 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.roundRect(bx, byy, Math.max(6 * u, barW * clamp(sim.xp / levelNeed(sim.nightLevel))), 6 * u, 3 * u);
    ctx.fill();
    if (multTxt) {
      const mx = bx + barW + 8 * u;
      ctx.fillStyle = mult >= 3 ? '#ff9a52' : C.gold;
      ctx.beginPath();
      ctx.roundRect(mx, y + 3 * u, mw - 4 * u, h - 6 * u, (h - 6 * u) / 2);
      ctx.fill();
      ctx.fillStyle = C.night;
      ctx.textAlign = 'center';
      ctx.fillText(multTxt, mx + (mw - 4 * u) / 2, y + h / 2 + 0.5);
    }
    ctx.restore();
  }

  // ── the window: the band's last 40 s ────────────────────────────
  /** The window's night sky with the curve, and the sill with a star for each second; drawn with the room (under the angel). */
  drawWindow(sim: AniolSim, dawn: number, curtains: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.win, s = L.sill;
    paintWindow(ctx, r.x, r.y, r.w, r.h, sim.t, dawn, curtains);
    const box = { x: r.x + 6 * u, y: r.y + 4 * u, w: r.w - 12 * u, h: r.h - 8 * u };
    const lay = sim.trace.layout(box, sim.t);
    drawTrace(ctx, lay, { ...NIGHT, lag: { sec: this.lag, color: 'rgba(255,240,200,.85)' } });
    const last = lay.points[lay.points.length - 1];
    if (last) {
      ctx.font = this.F.lag;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255,240,200,.9)';
      ctx.fillText(this.lagLabel, lay.xOf(last.t - this.lag) - 3 * u, box.y + 1);
    }
    // the sill: one star a second, gold above the threshold, blue in a lullaby, a dot where the signal failed
    paintSill(ctx, s.x, s.y, s.w, s.h);
    const n = 40;
    const bars = traceBars(sim.trace, sim.t, n);
    const step = s.w / n, cy = s.y + s.h / 2;
    bars.forEach((b, i) => {
      const x = s.x + (i + 0.5) * step;
      if (b.empty) return;
      if (b.shown <= 0) {
        ctx.fillStyle = 'rgba(78,70,120,.85)';
        ctx.beginPath();
        ctx.arc(x, cy, step * 0.28, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (!b.reliable) {
        ctx.fillStyle = 'rgba(60,40,30,.55)';
        ctx.fillRect(x - 1, cy - 1, 2, 2);
        return;
      }
      const rr = Math.min(step * 0.48, (2.2 + b.level * 4.2) * u);
      const color = b.above ? (b.phase === 'rest' ? '#cfe0ff' : '#ffd36b') : b.phase === 'rest' ? '#9dbcf0' : 'rgba(255,248,230,.75)';
      if (b.above) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.shown * 0.5;
        ctx.fillStyle = 'rgba(255,211,107,.6)';
        ctx.beginPath();
        ctx.arc(x, cy, rr * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      paintStar(ctx, x, cy, rr, b.shown, color);
    });
    // the lag bracket over the newest stars
    const lagStars = Math.max(1, Math.round(this.lag));
    const bx0 = s.x + (n - lagStars) * step, bx1 = s.x + s.w;
    ctx.strokeStyle = 'rgba(60,35,20,.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx0 + 1, s.y + s.h - 2);
    ctx.lineTo(bx0 + 1, s.y + s.h + 2);
    ctx.lineTo(bx1 - 1, s.y + s.h + 2);
    ctx.lineTo(bx1 - 1, s.y + s.h - 2);
    ctx.stroke();
  }

  // ── the floats ──────────────────────────────────────────────────
  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.font = f.font;
      const y = f.y - f.rise * ease.outCubic(k);
      const half = ctx.measureText(f.text).width / 2 + 6;
      const x = Math.min(this.L.w - half, Math.max(half, f.x));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20,16,44,.75)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── the cards ───────────────────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(310 * u, this.aw - 32), h = (c.curve ? 100 : c.sub ? 56 : 40) * u;
    const cy = L.cardY;
    const x = this.mx - w / 2, y = cy - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(this.mx, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-this.mx, -(y + h / 2));
    ctx.shadowColor = 'rgba(10,8,30,.35)';
    ctx.shadowBlur = 16;
    this.paper(x, y, w, h, 0.96);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(c.title, w - 2 * pad, F.cardTitle);
    ctx.fillText(c.title, x + pad, y + 8 * u);
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.sub, w - 2 * pad, F.cardSub, 0.62);
    ctx.fillText(c.sub, x + pad, y + 32 * u);
    if (c.curve && c.curve.length > 1) this.miniCurve(c, x + pad, y + 52 * u, w - 2 * pad, h - 60 * u);
    ctx.restore();
  }

  /** The block's own curve in miniature; a blind block's veil lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(28,29,63,.9)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fill();
    for (const b of c.bands) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(127,167,224,.25)' : 'rgba(255,211,107,.08)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(222,226,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(x + p.x * w, y + p.ty * h) : ctx.moveTo(x + p.x * w, y + p.ty * h)));
    ctx.stroke();
    ctx.setLineDash([]);
    const reveal = c.blind ? clamp((c.t - 0.3) / 1.4) : 1;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!a.reliable || !b.reliable || b.x > reveal + 1e-6) continue;
      if (a.above && b.above) {
        ctx.fillStyle = 'rgba(255,211,107,.3)';
        ctx.beginPath();
        ctx.moveTo(x + a.x * w, y + a.ty * h);
        ctx.lineTo(x + a.x * w, y + a.y * h);
        ctx.lineTo(x + b.x * w, y + b.y * h);
        ctx.lineTo(x + b.x * w, y + b.ty * h);
        ctx.fill();
      }
      ctx.strokeStyle = a.above && b.above ? '#ffd36b' : 'rgba(222,226,255,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(78,70,120,.92)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  // ── the hint, the dawn ──────────────────────────────────────────
  private hintPill(): void {
    if (this.hintA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = this.F.cardSub;
    const w = Math.min(this.aw - 32, ctx.measureText(TXT.hint).width + 28 * u), h = 30 * u;
    const x = this.mx - w / 2, y = L.floorY - L.S * 3.9 - h;
    ctx.globalAlpha = this.hintA;
    this.paper(x, Math.max(L.hudBottom + 30 * u, y), w, h, 0.94);
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(TXT.hint, w - 16 * u, this.F.cardSub);
    ctx.fillText(TXT.hint, this.mx, Math.max(L.hudBottom + 30 * u, y) + h / 2);
    ctx.globalAlpha = 1;
  }

  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(this.aw - 32, 340 * u), h = 74 * u, x = this.mx - w / 2, y = L.cardY - h / 2;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, this.mx, y + 10 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(TXT.finaleSub, this.mx, y + 48 * u);
    ctx.globalAlpha = 1;
  }

  // ── the choice of gifts ─────────────────────────────────────────
  private choice(sim: AniolSim): void {
    this.giftRects.length = 0;
    const c = sim.choice;
    if (!c && this.choiceA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = this.choiceA;
    ctx.fillStyle = `rgba(14,12,34,${0.42 * a})`;
    ctx.fillRect(0, 0, L.w, L.h);
    if (!c) return;
    const gap = 10 * u;
    const cw = Math.min(180 * u, (this.aw - 32 - 2 * gap) / 3);
    const short = L.mode === 'short';
    const titleY = short ? L.scoreY : L.hudBottom + 14 * u;
    const ch = short ? clamp(L.floorY - titleY - 50 * u, 70 * u, 150 * u) : Math.min(150 * u, Math.max(110 * u, (L.floorY - L.hudBottom) * 0.62));
    const total = 3 * cw + 2 * gap;
    const x0 = this.mx - total / 2;
    const y0 = short ? titleY + 28 * u : Math.min(titleY + 30 * u, L.floorY - ch - 8 * u);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const title = t('level.title', { n: sim.nightLevel + 1 });
    ctx.font = this.fit(title, this.aw - 32, F.choiceTitle);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(14,12,34,.7)';
    ctx.strokeText(title, this.mx, titleY);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(title, this.mx, titleY);
    const left = Math.max(0, RULES.choiceSec - c.t);
    c.options.forEach((id, i) => {
      const g = giftById(id);
      const x = x0 + i * (cw + gap);
      const inK = ease.outBack(clamp((c.t - i * 0.06) / 0.28));
      const y = y0 + (1 - inK) * 20 * u;
      this.giftRects.push({ x, y: y0, w: cw, h: ch });
      ctx.save();
      ctx.globalAlpha = a * clamp(inK);
      ctx.shadowColor = 'rgba(255,214,120,.45)';
      ctx.shadowBlur = i === 0 ? 18 * (0.6 + 0.4 * Math.sin(sim.t * 4)) : 10;
      this.paper(x, y, cw, ch, 0.97);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = i === 0 ? C.gold : 'rgba(160,140,190,.5)';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10 * u);
      ctx.stroke();
      // the key, the picture, the name, the words
      ctx.fillStyle = 'rgba(80,70,110,.75)';
      ctx.font = F.level;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 8 * u, y + 7 * u);
      paintGiftIcon(ctx, id, x + cw / 2, y + 30 * u, 16 * u);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.text;
      ctx.font = this.fit(g.name, cw - 12 * u, F.giftName, 0.6);
      ctx.fillText(g.name, x + cw / 2, y + 56 * u);
      ctx.fillStyle = C.textSoft;
      if (ch >= 104 * u) this.lines(g.text, cw - 14 * u, F.giftText, Math.max(1, Math.floor((ch - 84 * u) / (14 * u)))).forEach((line, k) => {
        ctx.font = F.giftText;
        ctx.fillText(line, x + cw / 2, y + 78 * u + k * 14 * u);
      });
      ctx.restore();
    });
    // the hint and the time until the first is taken
    const hint = t('level.hint', { n: Math.ceil(left) });
    const hy = y0 + ch + 8 * u;
    ctx.globalAlpha = a;
    ctx.font = this.fit(hint, this.aw - 32, F.small);
    ctx.fillStyle = 'rgba(255,248,230,.9)';
    ctx.textAlign = 'center';
    if (hy + 14 * u < L.floorY + 20 * u) ctx.fillText(hint, this.mx, hy);
    const r0 = this.giftRects[0];
    ctx.fillStyle = C.gold;
    ctx.fillRect(r0.x + 8 * u, r0.y + ch - 5 * u, (cw - 16 * u) * clamp(left / RULES.choiceSec), 2.5 * u);
    ctx.globalAlpha = 1;
  }

  /** Which gift card is at a point (−1: none). */
  giftAt(x: number, y: number): number {
    return this.giftRects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  /** A feather count for a float ("+3 pióra"). */
  static feathers(n: number): string { return `+${feathersText(n)}`; }
}

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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
