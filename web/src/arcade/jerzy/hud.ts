/**
 * Jerzy i smok's HUD on the play canvas: the status card (the block's name and progress or the
 * telegraph; "in your head" — a strategy to try; "the headband" — what the band drives in this
 * block; and a live chip saying what the signal does to the shield or the rest right now), the
 * headline — scales knocked off, counting up live — the dragon's bar (its name, phases and scales),
 * the fight's level and skills, the block card after each block (its own mini-curve and verdict),
 * the story cards (the opening with the root passage, a new town, a dragon driven off), toasts, the
 * words floating over the arena, Princess Linda's speech bubble, the choice of skills at a level-up,
 * and the end of the fight.  Every string is fitted to its room so it reads on a 390 px phone in
 * German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { layoutPassage, drawPassage, passage, type PassageLayout } from '../kit/scripture';
import type { TraceBand } from '../kit/trace';
import { TIPS, dragonName, skillById, townName, townStory } from './content';
import { t, unit } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintSkillIcon } from './paint';
import { RULES, levelNeed, type BlockKind, type JerzySim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

/** A card after a block: its name, its verdict and the block's own curve (normalised 0..1). */
interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  bands: TraceBand[]; blind: boolean; kind: BlockKind | 'toast';
}

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'), done: t('block.done'),
  nextPush: t('next.push'), nextBlind: t('next.blind'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
  head: t('label.head'), band: t('label.band'),
  driveWarm: t('drive.warmup'), drivePush: t('drive.push'), driveBlind: t('drive.blind'), driveRest: t('drive.rest'), driveFinale: t('drive.finale'),
  above: t('live.above'), below: t('live.below'), none: t('live.none'), calm: t('live.calm'), high: t('live.high'),
  restWait: t('live.restWait'), blindChip: t('live.blind'),
  hint: t('hint.tap'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
  openTitle: t('story.open.title'), openText: t('story.open.text'), tap: t('story.tap'),
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
  private storyA = 0;
  private levelPop = 0;
  private bossHit = 0;
  /** the status card's bottom this frame (its height follows its words) */
  statusBottom = 0;
  private readonly wraps = new Map<string, string[]>();
  private verse: { key: string; l: PassageLayout } | null = null;
  /** the skill cards on screen while a choice is open (for taps) */
  readonly skillRects: Rect[] = [];

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 19 * u, SERIF), nameShort: font(500, 15.5 * u, SERIF), tip: font(560, 12 * u, SANS), tipShort: font(560, 10.5 * u, SANS), label: font(800, 9 * u, SANS), chip: font(750, 11.5 * u, SANS),
      small: font(650, 11 * u, SANS), score: font(500, 36 * u, SERIF), scoreSmall: font(500, 28 * u, SERIF), unit: font(650, 12 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true),
      cardSub: font(650, 12 * u, SANS), big: font(500, 24 * u, SERIF, true), level: font(800, 11 * u, SANS), boss: font(700, 11.5 * u, SANS),
      skillName: font(650, 14 * u, SERIF), skillText: font(600, 11.5 * u, SANS), choiceTitle: font(500, 20 * u, SERIF, true),
      bubble: font(650, 12.5 * u, SANS), storyText: font(560, 13 * u, SANS), storyTitle: font(500, 24 * u, SERIF, true),
    };
  }

  /** the middle and the width of the part of the screen cards centre in */
  private get mx(): number { return (this.L.areaX0 + this.L.w) / 2; }
  private get aw(): number { return this.L.w - this.L.areaX0; }
  private get column(): boolean { return this.L.mode !== 'tall'; }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
    this.verse = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 18) this.floats.shift();
  }

  popScore(): void { this.pop = 1; this.bossHit = 1; }
  popLevel(): void { this.levelPop = 1; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: JerzySim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, tipGiven: boolean): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'push' ? (blind ? TXT.blind : TXT.push) : TXT.rest;
    let sub: string, color: string = C.ink;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) });
      color = '#6a4fa0';
    } else if (verdict === null) sub = kind === 'rest' && tipGiven ? t('card.tip') : t('card.none');
    else if (verdict) {
      sub = kind === 'push' ? t('card.push.pass') : `${t('card.rest.pass')} · ${t('card.tip')}`;
      color = kind === 'push' ? C.goldDeep : C.calmDeep;
    } else sub = kind === 'rest' && tipGiven ? `${t('card.near', { share: pct(share), need: pct(need) })} · ${t('card.tip')}` : t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, bands: lay.bands.map(b => ({ ...b })), blind, kind });
  }

  toast(title: string, sub: string, color: string = C.ink): void {
    this.pushCard({ title, sub, color, t: 0, dur: 2.6, curve: null, bands: [], blind: false, kind: 'toast' });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  update(dt: number, sim: JerzySim): void {
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
    this.bossHit = Math.max(0, this.bossHit - dt * 4);
    this.levelPop = Math.max(0, this.levelPop - dt * 1.5);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length && !sim.story ? 1 : 0, dt, 0.5);
    this.choiceA = approach(this.choiceA, sim.choice ? 1 : 0, dt, 0.08);
    this.storyA = approach(this.storyA, sim.story ? 1 : 0, dt, 0.15);
  }

  draw(sim: JerzySim): void {
    this.status(sim);
    this.score();
    this.boss(sim);
    this.levelPill(sim);
    this.drawFloats();
    if (!sim.story || sim.story.kind !== 'open') this.drawCard();
    this.hintPill(sim);
    this.story(sim);
    this.finale();
    this.choice(sim);
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.92): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(247,238,214,${a})`;
    ctx.strokeStyle = 'rgba(150,115,60,.55)';
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
  private status(sim: JerzySim): void {
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
    ctx.fillStyle = play && b.kind === 'rest' ? '#34507e' : sim.blind ? '#5a4386' : C.ink;
    ctx.font = this.fit(name, nameW, short ? F.nameShort : F.name);
    ctx.fillText(name, r.x + pad, r.y + (short ? 6 : 8) * u);
    // the block's progress, or the telegraph, under the name
    const by = r.y + (short ? 26 : 33) * u;
    const left = play ? b.dur - sim.blockT : 0;
    if (play && left <= RULES.telegraph) {
      const nb = sim.next;
      const txt = !nb ? TXT.nextFinale : nb.kind === 'rest' ? TXT.nextRest : TXT.nextPush;
      ctx.font = this.fit(txt, nameW, F.small);
      ctx.fillStyle = '#9a4a10';
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
          ctx.fillStyle = C.inkSoft;
          ctx.fillText(line.slice(label.length + 1), r.x + pad + lw, y);
        } else {
          ctx.fillStyle = C.inkSoft;
          ctx.fillText(line, r.x + pad, y + i * lh);
        }
      });
      y += ls.length * lh + 3 * u;
    };
    row(TXT.head, tipLs, C.ultramarine);
    row(TXT.band, driveLs, C.vermilionDeep);
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
  private chip(sim: JerzySim): { text: string; bg: string; fg: string; pulse: boolean } | null {
    if (sim.phase !== 'play') return null;
    const b = sim.block;
    if (b.kind === 'warmup') return null;
    if (b.kind === 'push') {
      if (b.blind) return { text: TXT.blindChip, bg: 'rgba(106,79,160,.16)', fg: '#5a4386', pulse: false };
      if (sim.blockT < sim.leadIn) return { text: t('live.wait', { lag: t('lag', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) }) }), bg: 'rgba(80,70,50,.12)', fg: '#6a5a3a', pulse: true };
      if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#6f6f80', pulse: false };
      return sim.level >= 0.5
        ? { text: TXT.above, bg: 'rgba(226,178,60,.34)', fg: '#8a5f0c', pulse: true }
        : { text: TXT.below, bg: 'rgba(80,70,50,.12)', fg: '#6a5a3a', pulse: false };
    }
    if (sim.blockT < sim.restLeadIn) return { text: TXT.restWait, bg: 'rgba(127,167,224,.18)', fg: C.calmDeep, pulse: true };
    if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#6f6f80', pulse: false };
    return sim.calm >= 0.5
      ? { text: TXT.calm, bg: 'rgba(127,167,224,.28)', fg: C.calmDeep, pulse: true }
      : { text: TXT.high, bg: 'rgba(80,70,50,.12)', fg: '#6a5a3a', pulse: false };
  }

  // ── the headline ────────────────────────────────────────────────
  /** the y under the status card in the column modes */
  private get colY(): number { return this.statusBottom + 8 * this.L.u; }

  private score(): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.2 * ease.outBack(this.pop) * this.pop;
    const inCard = L.scoreInStatus;
    const short = L.mode === 'short';
    const nf = short ? F.nameShort.replace('500', '600') : inCard ? F.scoreSmall : F.score;
    const top = inCard ? L.scoreY : this.colY;
    let rx = L.scoreX;
    if (!inCard) {
      this.paper(L.status.x, top, L.status.w, 54 * u, 0.88);
      rx = L.status.x + L.status.w - 12 * u;
    }
    ctx.save();
    ctx.translate(rx - (inCard ? 11 * u : 0), top + (short ? 6 : inCard ? 4 : 6) * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = nf;
    ctx.fillStyle = C.ink;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = C.inkSoft;
    if (short) {
      // a phone on its side: the unit left of the number, on the name's line
      ctx.font = nf;
      const nw = ctx.measureText(String(n)).width;
      ctx.font = F.unit;
      ctx.fillText(unit(n), rx - 11 * u - nw - 5 * u, top + 9 * u);
    } else if (inCard) ctx.fillText(unit(n), rx - 11 * u, top + 32 * u);
    else {
      // the unit to the left of the number in the column's card
      ctx.font = nf;
      const nw = ctx.measureText(String(n)).width;
      ctx.font = F.unit;
      ctx.fillText(unit(n), rx - nw - 10 * u, top + 26 * u);
      // the scale: a little gold plate at the card's left
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      const sx = L.status.x + 22 * u, sy = top + 27 * u;
      ctx.moveTo(sx, sy - 12 * u);
      ctx.quadraticCurveTo(sx + 12 * u, sy - 4 * u, sx, sy + 12 * u);
      ctx.quadraticCurveTo(sx - 12 * u, sy - 4 * u, sx, sy - 12 * u);
      ctx.fill();
      ctx.fillStyle = C.goldDeep;
      ctx.fillRect(sx - 1, sy - 8 * u, 2, 16 * u);
    }
  }

  // ── the dragon's bar ────────────────────────────────────────────
  private boss(sim: JerzySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, d = sim.dragon;
    const r = L.mode === 'wide' ? { x: L.status.x, y: this.colY + 62 * u, w: L.status.w, h: 30 * u } : L.mode === 'short' ? { ...L.boss, y: this.statusBottom + 6 } : L.boss;
    this.bossRect = r;
    ctx.fillStyle = 'rgba(42,34,51,.78)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    const label = dragonName(d.spec.kind);
    const name = label.charAt(0).toUpperCase() + label.slice(1);
    const pad = 12 * u;
    ctx.font = this.fit(name, r.w * 0.42, F.boss);
    const nw = ctx.measureText(name).width;
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, r.x + pad, r.y + r.h / 2 + 0.5);
    // the bar: a segment per phase, the current one draining
    const bx = r.x + pad + nw + 10 * u, bw = Math.max(30 * u, r.x + r.w - pad - bx), bh = 8 * u, by = r.y + r.h / 2 - bh / 2;
    const all = d.phases.reduce((s, x) => s + x, 0);
    let x = bx;
    d.phases.forEach((ph, i) => {
      const w = (bw * ph) / all - 2;
      const fill = i < d.phase ? 0 : i > d.phase ? 1 : d.left / ph;
      ctx.fillStyle = 'rgba(255,255,255,.15)';
      ctx.beginPath();
      ctx.roundRect(x, by, w, bh, 3 * u);
      ctx.fill();
      if (fill > 0) {
        ctx.fillStyle = i === d.phase && this.bossHit > 0.5 ? '#ffffff' : i === d.phase ? '#e8603c' : '#b5503a';
        ctx.beginPath();
        ctx.roundRect(x, by, Math.max(2, w * fill), bh, 3 * u);
        ctx.fill();
      }
      x += w + 2;
    });
    // gone over the hills: a gold tick
    if (d.state === 'leave' || d.state === 'away') {
      ctx.fillStyle = 'rgba(42,34,51,.6)';
      ctx.fillRect(bx - 2, by - 3, bw + 4, bh + 6);
    }
  }

  private bossRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private pillBottom = 0;

  /** The fight's level, its scales to the next, and the skills taken, as small icons. */
  private levelPill(sim: JerzySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const h = 22 * u;
    let x = this.column ? L.status.x : L.pillX;
    const y = this.column ? this.bossRect.y + this.bossRect.h + (L.mode === 'short' ? 5 : 8 * u) : L.pillY;
    this.pillBottom = y + h;
    // a phone on its side: no room above the simulator's button
    if (L.mode === 'short' && y + h > L.h - 50) return;
    const label = t('hud.level', { n: sim.fightLevel + 1 });
    ctx.font = F.level;
    const lw = ctx.measureText(label).width;
    const barW = 54 * u;
    const ids = Object.keys(sim.taken).filter(id => id !== 'apple') as (keyof typeof sim.taken)[];
    const iconW = Math.min(ids.length, 6) * 18 * u;
    const w = 12 * u + lw + 8 * u + barW + 10 * u + iconW;
    const k = 1 + 0.15 * this.levelPop;
    // upright: the pill sits in the arena's bottom-right corner (Linda's corner is the left)
    if (L.mode === 'tall') x = L.w - 14 - w;
    ctx.save();
    ctx.translate(x, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-x, -(y + h / 2));
    ctx.fillStyle = 'rgba(42,34,51,.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 10 * u, y + h / 2 + 0.5);
    const bx = x + 10 * u + lw + 8 * u, byy = y + h / 2 - 3 * u;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.roundRect(bx, byy, barW, 6 * u, 3 * u);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.roundRect(bx, byy, Math.max(6 * u, barW * clamp(sim.xp / levelNeed(sim.fightLevel))), 6 * u, 3 * u);
    ctx.fill();
    ids.slice(0, 6).forEach((id, i) => paintSkillIcon(ctx, id, bx + barW + 18 * u + i * 18 * u, y + h / 2, 6.5 * u));
    ctx.restore();
  }

  // ── Linda's bubble ──────────────────────────────────────────────
  /** A speech bubble pointing at (px, py) (Linda's head), kept on screen and off the status card. */
  bubble(text: string, px: number, py: number, k: number): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const maxW = Math.min(240 * u, this.aw - 24 * u);
    const ls = this.lines(text, maxW - 20 * u, F.bubble, 3);
    ctx.font = F.bubble;
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const w = tw + 20 * u, h = ls.length * 15 * u + 12 * u;
    const minY = this.column ? TOPMIN * u : this.bossRect.y + this.bossRect.h + 30 * u;
    const x = clamp(px - w * 0.3, L.areaX0 + 8 * u, L.w - w - 8 * u);
    const y = clamp(py - h - 14 * u, minY, L.h - h - 8);
    const pop = ease.outBack(clamp(k * 4));
    ctx.save();
    ctx.globalAlpha = clamp(k * 6);
    ctx.translate(px, py);
    ctx.scale(pop, pop);
    ctx.translate(-px, -py);
    ctx.shadowColor = 'rgba(20,15,10,.3)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    // the tail toward her head
    const tx = clamp(px, x + 12 * u, x + w - 12 * u), ty = y + h;
    ctx.beginPath();
    ctx.moveTo(tx - 7 * u, ty - 1);
    ctx.lineTo(px, Math.max(ty + 6 * u, py - 4 * u));
    ctx.lineTo(tx + 7 * u, ty - 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(79,138,85,.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * u);
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 7 * u + i * 15 * u));
    ctx.restore();
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
      ctx.strokeStyle = 'rgba(30,22,16,.75)';
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
    let h = (c.curve ? 100 : c.sub ? 56 : 40) * u;
    // on a desktop the cards sit in the column under the level, off the fight; elsewhere over the arena's top
    const inCol = L.mode === 'wide' && this.pillBottom + 10 * u + h <= L.h - 70;
    const w = inCol ? L.status.w : Math.min(310 * u, this.aw - 32);
    if (!inCol && L.mode === 'short') h = Math.min(h, 80 * u);
    const cx = inCol ? L.status.x + w / 2 : this.mx;
    const x = cx - w / 2, y = (inCol ? this.pillBottom + 10 * u : L.cardY - h / 2) + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(cx, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-cx, -(y + h / 2));
    ctx.shadowColor = 'rgba(20,15,10,.35)';
    ctx.shadowBlur = 16;
    this.paper(x, y, w, h, 0.97);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(c.title, w - 2 * pad, F.cardTitle);
    ctx.fillText(c.title, x + pad, y + 8 * u);
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.sub, w - 2 * pad, F.cardSub, 0.62);
    ctx.fillText(c.sub, x + pad, y + 32 * u);
    if (c.curve && c.curve.length > 1) this.miniCurve(c, x + pad, y + 52 * u, w - 2 * pad, h - 60 * u);
    ctx.restore();
  }

  /** The block's own curve in miniature; a blind block's smoke lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(42,34,51,.9)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fill();
    for (const b of c.bands) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(127,167,224,.25)' : 'rgba(226,178,60,.08)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(244,232,200,.5)';
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
        ctx.fillStyle = 'rgba(226,178,60,.32)';
        ctx.beginPath();
        ctx.moveTo(x + a.x * w, y + a.ty * h);
        ctx.lineTo(x + a.x * w, y + a.y * h);
        ctx.lineTo(x + b.x * w, y + b.y * h);
        ctx.lineTo(x + b.x * w, y + b.ty * h);
        ctx.fill();
      }
      ctx.strokeStyle = a.above && b.above ? '#ffd36b' : 'rgba(244,232,200,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(110,104,112,.92)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  // ── the story cards ─────────────────────────────────────────────
  private story(sim: JerzySim): void {
    const s = sim.story;
    if (!s || this.storyA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = this.storyA * clamp((s.dur - s.t) / 0.4);
    ctx.save();
    ctx.globalAlpha = a;
    if (s.kind === 'open') {
      ctx.fillStyle = 'rgba(20,16,10,.45)';
      ctx.fillRect(0, 0, L.w, L.h);
      const w = Math.min(420 * u, this.aw - 28), pad = 16 * u;
      const textLs = this.lines(TXT.openText, w - 2 * pad, F.storyText, 6);
      const vw = w - 2 * pad;
      const key = `${Math.round(vw)}|${Math.round(u * 100)}`;
      if (!this.verse || this.verse.key !== key) this.verse = { key, l: layoutPassage(ctx, passage('eph6.16'), vw, 110 * u, { max: Math.round(15 * u), min: 10 }) };
      const vl = this.verse.l;
      const h = pad + 30 * u + textLs.length * 17 * u + 10 * u + vl.height + 14 * u + 18 * u + pad;
      const x = this.mx - w / 2, y = clamp(L.cardY - h / 2, L.hudBottom + 6 * u, L.h - h - 8);
      ctx.shadowColor = 'rgba(20,15,10,.4)';
      ctx.shadowBlur = 20;
      this.paper(x, y, w, h, 0.98);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = C.vermilionDeep;
      ctx.font = this.fit(TXT.openTitle, w - 2 * pad, F.storyTitle);
      ctx.fillText(TXT.openTitle, this.mx, y + pad);
      ctx.fillStyle = C.ink;
      ctx.font = F.storyText;
      let ty = y + pad + 34 * u;
      for (const l of textLs) {
        ctx.fillText(l, this.mx, ty);
        ty += 17 * u;
      }
      ty += 8 * u;
      drawPassage(ctx, passage('eph6.16'), vl, this.mx, ty, { text: '#5a3a1a', ref: C.goldDeep });
      ty += vl.height + 12 * u;
      ctx.font = F.small;
      ctx.fillStyle = C.inkSoft;
      ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(sim.t * 4));
      ctx.fillText(TXT.tap, this.mx, ty);
    } else {
      // a town's card: the new dragon's town and its habits, or the town freed
      const w = Math.min(330 * u, this.aw - 28), h = (s.kind === 'driven' && s.armoury ? 84 : 64) * u;
      const inK = ease.outBack(clamp(s.t / 0.35));
      const x = this.mx - w / 2, y = L.oy + 10 * u + (1 - inK) * -12 * u;
      ctx.shadowColor = 'rgba(20,15,10,.3)';
      ctx.shadowBlur = 14;
      this.paper(x, y, w, h, 0.96);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      if (s.kind === 'next') {
        const title = `${townName(s.dragon)} · ${cap(dragonName(s.dragon))}`;
        ctx.fillStyle = C.vermilionDeep;
        ctx.font = this.fit(title, w - 20 * u, F.cardTitle);
        ctx.fillText(title, this.mx, y + 9 * u);
        const d = sim.dragon, all = d.phases.reduce((q, v) => q + v, 0);
        const sub = d.damage > 0 && d.spec.kind === s.dragon ? t('story.progress', { left: all - d.damage, all }) : townStory(s.dragon);
        ctx.fillStyle = C.ink;
        ctx.font = this.fit(sub, w - 20 * u, F.cardSub, 0.6);
        ctx.fillText(sub, this.mx, y + 36 * u);
      } else {
        const title = t('story.driven.title', { name: cap(dragonName(s.dragon)) });
        ctx.fillStyle = C.goldDeep;
        ctx.font = this.fit(title, w - 20 * u, F.cardTitle);
        ctx.fillText(title, this.mx, y + 9 * u);
        const sub = t('story.driven.sub', { town: townName(s.dragon), next: s.next ? townName(s.next) : '' });
        ctx.fillStyle = C.ink;
        ctx.font = this.fit(sub, w - 20 * u, F.cardSub, 0.6);
        ctx.fillText(sub, this.mx, y + 36 * u);
        if (s.armoury) {
          const arm = t('story.armoury', { name: skillById(s.armoury).name });
          ctx.fillStyle = C.ultramarine;
          ctx.font = this.fit(arm, w - 20 * u, F.cardSub, 0.6);
          ctx.fillText(arm, this.mx, y + 58 * u);
        }
      }
    }
    ctx.restore();
  }

  // ── the hint, the end ───────────────────────────────────────────
  private hintPill(sim: JerzySim): void {
    if (this.hintA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = this.F.cardSub;
    const w = Math.min(this.aw - 32, ctx.measureText(TXT.hint).width + 28 * u), h = 30 * u;
    const x = this.mx - w / 2, y = L.oy + RULES.arenaH * L.S - h - 12 * u;
    ctx.globalAlpha = this.hintA;
    this.paper(x, y, w, h, 0.94);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(TXT.hint, w - 16 * u, this.F.cardSub);
    ctx.fillText(TXT.hint, this.mx, y + h / 2);
    ctx.globalAlpha = 1;
    void sim;
  }

  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(this.aw - 32, 340 * u), h = 74 * u, x = this.mx - w / 2, y = L.cardY - h / 2;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, this.mx, y + 10 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = C.inkSoft;
    ctx.fillText(TXT.finaleSub, this.mx, y + 46 * u);
    ctx.globalAlpha = 1;
  }

  // ── the choice of skills ────────────────────────────────────────
  private choice(sim: JerzySim): void {
    this.skillRects.length = 0;
    const c = sim.choice;
    if (!c && this.choiceA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = this.choiceA;
    ctx.fillStyle = `rgba(20,14,8,${0.45 * a})`;
    ctx.fillRect(0, 0, L.w, L.h);
    if (!c) return;
    const gap = 10 * u;
    const cw = Math.min(180 * u, (this.aw - 32 - 2 * gap) / 3);
    const arenaTop = L.oy - L.fenceH, arenaBottom = L.oy + RULES.arenaH * L.S;
    const titleY = Math.max(L.hudBottom + 8 * u, arenaTop);
    const ch = clamp(arenaBottom - titleY - 60 * u, 84 * u, 160 * u);
    const total = 3 * cw + 2 * gap;
    const x0 = this.mx - total / 2;
    const y0 = titleY + 30 * u;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const title = t('level.title', { n: sim.fightLevel + 1 });
    ctx.font = this.fit(title, this.aw - 32, F.choiceTitle);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,14,8,.7)';
    ctx.strokeText(title, this.mx, titleY);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(title, this.mx, titleY);
    const left = Math.max(0, RULES.choiceSec - c.t);
    c.options.forEach((id, i) => {
      const sk = skillById(id);
      const x = x0 + i * (cw + gap);
      const inK = ease.outBack(clamp((c.t - i * 0.06) / 0.28));
      const y = y0 + (1 - inK) * 20 * u;
      this.skillRects.push({ x, y: y0, w: cw, h: ch });
      ctx.save();
      ctx.globalAlpha = a * clamp(inK);
      ctx.shadowColor = 'rgba(226,178,60,.5)';
      ctx.shadowBlur = i === 0 ? 18 * (0.6 + 0.4 * Math.sin(sim.t * 4)) : 10;
      this.paper(x, y, cw, ch, 0.98);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = i === 0 ? C.gold : 'rgba(150,115,60,.5)';
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(x, y, cw, ch, 10 * u);
      ctx.stroke();
      ctx.fillStyle = 'rgba(80,60,30,.75)';
      ctx.font = F.level;
      ctx.textAlign = 'left';
      ctx.fillText(String(i + 1), x + 8 * u, y + 7 * u);
      const lv = sim.taken[id] ?? 0;
      if (id !== 'apple' && lv > 0) {
        ctx.textAlign = 'right';
        ctx.fillStyle = C.goldDeep;
        ctx.fillText(t('level.lv', { n: lv + 1 }), x + cw - 8 * u, y + 7 * u);
      }
      paintSkillIcon(ctx, id, x + cw / 2, y + 30 * u, 15 * u);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ink;
      ctx.font = this.fit(sk.name, cw - 12 * u, F.skillName, 0.6);
      ctx.fillText(sk.name, x + cw / 2, y + 54 * u);
      ctx.fillStyle = C.inkSoft;
      if (ch >= 96 * u) this.lines(sk.text, cw - 14 * u, F.skillText, Math.max(1, Math.floor((ch - 80 * u) / (14 * u)))).forEach((line, k) => {
        ctx.font = F.skillText;
        ctx.fillText(line, x + cw / 2, y + 76 * u + k * 14 * u);
      });
      ctx.restore();
    });
    const hint = t('level.hint', { n: Math.ceil(left) });
    const hy = y0 + ch + 8 * u;
    ctx.globalAlpha = a;
    ctx.font = this.fit(hint, this.aw - 32, F.small);
    ctx.fillStyle = 'rgba(255,248,230,.92)';
    ctx.textAlign = 'center';
    ctx.fillText(hint, this.mx, hy);
    const r0 = this.skillRects[0];
    ctx.fillStyle = C.gold;
    ctx.fillRect(r0.x + 8 * u, r0.y + ch - 5 * u, (cw - 16 * u) * clamp(left / RULES.choiceSec), 2.5 * u);
    ctx.globalAlpha = 1;
  }

  /** Which skill card is at a point (−1: none). */
  skillAt(x: number, y: number): number {
    return this.skillRects.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }
}

/** the top a bubble may reach in the column modes (u) */
const TOPMIN = 60;

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

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
