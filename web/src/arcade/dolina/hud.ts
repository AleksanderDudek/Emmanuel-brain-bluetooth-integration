/**
 * Dolina's HUD on the play canvas: the status card (the block's name and progress or the telegraph;
 * "in your head" — a strategy to try; "the headband" — what the band drives in this block, or against
 * a guardian; and a live chip saying what the signal does to the lamp or the oil right now), the
 * headline — metres, counting up live — with the sparks, the oil jar, the combo and the lamp's
 * burst, the ridge whose night sky holds the band's last 40 s (kit/trace: gold above the threshold, a
 * cool band behind meadows, a dotted gap without signal, a veil over a blind block, the lag bracket at
 * "now") and whose row of lanterns holds one for every second, the guardian's bar, the block card
 * after each block (its own mini-curve and verdict), the story cards, toasts, the words floating over
 * the valley, the hint for the hands, Ćma's speech bubble and the dawn.  Every string is fitted to its
 * room so it reads on a 390 px phone in German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { passage, layoutPassage, drawPassage, type PassageId } from '../kit/scripture';
import { LAG_SEC, drawTrace, traceBars, type TraceBand, type TraceStyle } from '../kit/trace';
import { TIPS, guardName, type Hint } from './content';
import { metres, sparks as sparksText, t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, font, paintSmallLantern } from './paint';
import { RULES, type BlockKind, type DolinaSim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

/** A card after a block (its curve normalised 0..1), a toast, or a story card with a passage. */
interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  bands: TraceBand[]; blind: boolean; kind: BlockKind | 'toast' | 'story';
  verse?: PassageId;
}

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'), done: t('block.done'),
  nextPush: t('next.push'), nextBlind: t('next.blind'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
  head: t('label.head'), band: t('label.band'),
  driveWarm: t('drive.warmup'), drivePush: t('drive.push'), driveGuard: t('drive.guard'), driveBlind: t('drive.blind'), driveRest: t('drive.rest'), driveFinale: t('drive.finale'),
  above: t('live.above'), below: t('live.below'), none: t('live.none'), calm: t('live.calm'), high: t('live.high'),
  restWait: t('live.restWait'), blindChip: t('live.blind'), oil: t('hud.oil'), dawn: t('hud.dawn'), lamp: t('hud.lamp'), ready: t('hud.ready'),
  finaleTitle: t('finale.title'),
  hint: {
    slash: t('hint.slash'), jump: t('hint.jump'), slide: t('hint.slide'), lamp: t('hint.lamp'), parry: t('hint.parry'), open: t('hint.open'),
  } as Record<Hint, string>,
};

/** The band's curve in the ridge's night sky: lamplight below the threshold, gold above it. */
const NIGHT: TraceStyle = {
  line: 'rgba(236,226,255,.85)', above: '#ffd36b', lineWidth: 2, aboveFill: 'rgba(255,211,107,.26)', threshold: 'rgba(236,226,255,.55)',
  focusBand: 'rgba(255,211,107,.07)', restBand: 'rgba(127,200,190,.22)', gap: 'rgba(236,226,255,.6)', veil: 'rgba(84,74,112,.94)',
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
  private hintText = '';
  private finaleA = 0;
  private oilShown = 1;
  private oilPulse = 0;
  private sparkPop = 0;
  private statusBottom = 0;
  private readonly wraps = new Map<string, string[]>();
  private readonly lag: number;
  private readonly lagLabel: string;
  private guardA = 0;
  private guardHp = 1;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 19 * u, SERIF), nameShort: font(500, 15.5 * u, SERIF), tip: font(560, 12 * u, SANS), tipShort: font(560, 10.5 * u, SANS), chip: font(750, 11.5 * u, SANS),
      small: font(650, 11 * u, SANS), score: font(500, 38 * u, SERIF), scoreSmall: font(500, 28 * u, SERIF), unit: font(650, 12 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true),
      cardSub: font(650, 12 * u, SANS), big: font(500, 26 * u, SERIF, true), lag: font(700, 9 * u, SANS), pill: font(800, 11 * u, SANS),
      storyTitle: font(500, 24 * u, SERIF, true), storyText: font(560, 13 * u, SANS), bubble: font(560, 12.5 * u, SANS), guard: font(800, 11 * u, SANS),
    };
  }

  /** the middle and the width of the valley's part of the screen (cards centre there) */
  private get mx(): number { return (this.L.x0 + this.L.w) / 2; }
  private get aw(): number { return this.L.w - this.L.x0; }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, this.L.x0 + 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 18) this.floats.shift();
  }

  popScore(): void { this.pop = 1; }
  popSparks(): void { this.sparkPop = 1; }
  pulseOil(): void { this.oilPulse = 1; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: DolinaSim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, drops: number): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'push' ? (blind ? TXT.blind : TXT.push) : TXT.rest;
    let sub: string, color: string = C.text;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) });
      color = '#5a4386';
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'push' ? t('card.push.pass') : `${t('card.rest.pass')} · ${t('card.drops', { n: drops })}`;
      color = kind === 'push' ? C.goldDeep : C.calmDeep;
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, bands: lay.bands.map(b => ({ ...b })), blind, kind });
  }

  toast(title: string, sub: string, color: string = C.text, dur = 2.6): void {
    this.pushCard({ title, sub, color, t: 0, dur, curve: null, bands: [], blind: false, kind: 'toast' });
  }

  /** A story card: a title, two or three sentences and, when given, a passage under them. */
  story(title: string, sub: string, dur: number, verse?: PassageId): void {
    this.pushCard({ title, sub, color: C.text, t: 0, dur, curve: null, bands: [], blind: false, kind: 'story', verse });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1 && head.kind !== 'story') head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  /** Any card is up. */
  get cardUp(): boolean { return this.cards.length > 0; }

  /** A story card is up (the companion and the hints wait). */
  get storyUp(): boolean { return this.cards[0]?.kind === 'story'; }

  update(dt: number, sim: DolinaSim): void {
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1 && next.kind !== 'story') next.dur = Math.min(next.dur, 2.4);
    }
    this.pop = Math.max(0, this.pop - dt * 2.6);
    this.sparkPop = Math.max(0, this.sparkPop - dt * 3);
    this.oilPulse = Math.max(0, this.oilPulse - dt * 2);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.06);
    this.oilShown = approach(this.oilShown, sim.oil, dt, 0.2);
    const hint = sim.hint && !this.storyUp ? TXT.hint[sim.hint] : '';
    if (hint) this.hintText = hint;
    this.hintA = approach(this.hintA, hint ? 1 : 0, dt, 0.08);
    this.finaleA = approach(this.finaleA, sim.phase === 'done' && !this.cards.length ? 1 : 0, dt, 0.5);
    const g = sim.guard;
    this.guardA = approach(this.guardA, g && g.state !== 'leave' && g.state !== 'beaten' ? 1 : 0, dt, 0.2);
    if (g) this.guardHp = approach(this.guardHp, g.hp / g.maxHp, dt, 0.12);
  }

  draw(sim: DolinaSim): void {
    this.status(sim);
    this.score(sim);
    this.pills(sim);
    this.guardBar(sim);
    this.drawFloats();
    this.hintPill(sim);
    this.drawCard();
    this.finale(sim);
  }

  // ── helpers ─────────────────────────────────────────────────────
  paper(x: number, y: number, w: number, h: number, a = 0.9): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(246,238,220,${a})`;
    ctx.strokeStyle = 'rgba(150,120,160,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * this.L.u);
    ctx.fill();
    ctx.stroke();
  }

  /** The font `f`, shrunk (to `min` of its size at most) so `text` fits `maxW`. */
  fit(text: string, maxW: number, f: string, min = 0.7): string {
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
  lines(text: string, maxW: number, f: string, max: number): string[] {
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
  private status(sim: DolinaSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const b = sim.block, play = sim.phase === 'play';
    const name = !play ? (sim.phase === 'done' ? TXT.done : TXT.finale) : b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
    let tip = play ? sim.tip : '';
    if (play && b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    const guardOn = !!sim.guard && sim.guard.state === 'fight';
    const drive = !play ? (sim.phase === 'done' ? '' : TXT.driveFinale) : b.kind === 'warmup' ? TXT.driveWarm : b.kind === 'rest' ? TXT.driveRest
      : b.blind ? TXT.driveBlind : guardOn ? TXT.driveGuard : TXT.drivePush;
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
    ctx.fillStyle = play && b.kind === 'rest' ? C.calmDeep : sim.blind ? '#5a4386' : C.text;
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
  private chip(sim: DolinaSim): { text: string; bg: string; fg: string; pulse: boolean } | null {
    if (sim.phase !== 'play') return null;
    const b = sim.block;
    if (b.kind === 'warmup') return null;
    if (b.kind === 'push') {
      if (b.blind) return { text: TXT.blindChip, bg: 'rgba(106,79,160,.16)', fg: '#5a4386', pulse: false };
      if (sim.blockT < sim.leadIn) return { text: t('live.wait', { lag: t('lag', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) }) }), bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: true };
      if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#77778a', pulse: false };
      return sim.level >= 0.5
        ? { text: TXT.above, bg: 'rgba(245,195,90,.32)', fg: '#a8700c', pulse: true }
        : { text: TXT.below, bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: false };
    }
    if (sim.blockT < sim.restLeadIn) return { text: TXT.restWait, bg: 'rgba(127,176,200,.16)', fg: C.calmDeep, pulse: true };
    if (!sim.reliable) return { text: TXT.none, bg: 'rgba(120,120,130,.16)', fg: '#77778a', pulse: false };
    return sim.calm >= 0.5
      ? { text: TXT.calm, bg: 'rgba(127,176,200,.25)', fg: C.calmDeep, pulse: true }
      : { text: TXT.high, bg: 'rgba(80,70,110,.12)', fg: '#5c5698', pulse: false };
  }

  // ── the headline ────────────────────────────────────────────────
  private score(sim: DolinaSim): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.12 * ease.outBack(this.pop) * this.pop;
    const inCard = L.scoreInStatus;
    const nf = inCard ? F.scoreSmall : F.score;
    const unitTxt = t('unit');
    const sp = sparksText(sim.sparks);
    ctx.font = nf;
    const nw = Math.max(ctx.measureText(String(n)).width + (ctx.font = F.unit, ctx.measureText(unitTxt).width + 3 * u), ctx.measureText(`✦ ${sp}`).width);
    if (!inCard) this.paper(L.scoreX - nw - 22 * u, L.scoreY + 2 * u, nw + 22 * u, 66 * u, 0.86);
    ctx.font = F.unit;
    const uw = ctx.measureText(unitTxt).width + 3 * u;
    ctx.save();
    ctx.translate(L.scoreX - 11 * u - uw, L.scoreY + (inCard ? 4 : 6) * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = nf;
    ctx.fillStyle = C.text;
    ctx.fillText(String(n), 0, 0);
    ctx.font = F.unit;
    ctx.fillStyle = C.textSoft;
    ctx.textAlign = 'left';
    ctx.fillText(unitTxt, 3 * u, (inCard ? 14 : 22) * u);
    ctx.restore();
    // the sparks under it
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = this.sparkPop > 0 ? C.goldDeep : C.textSoft;
    const sk = 1 + 0.25 * this.sparkPop;
    ctx.save();
    ctx.translate(L.scoreX - 11 * u, L.scoreY + (inCard ? 32 : 48) * u);
    ctx.scale(sk, sk);
    ctx.fillText(`✦ ${sp}`, 0, 0);
    ctx.restore();
  }

  /** Under the status: the oil jar, the lamp's burst, the Świt's charge and the combo. */
  private pills(sim: DolinaSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const h = 22 * u;
    const short = L.mode === 'short';
    let x = short ? L.x0 + 6 : L.status.x;
    const y = short ? L.h - BOTTOM_PILLS * u - h : Math.max(this.statusBottom + 6 * u, L.mode === 'tall' ? L.row.y + L.row.h + 8 * u : 0);
    // the oil
    const k = 1 + 0.12 * this.oilPulse;
    const barW = 64 * u;
    ctx.font = F.pill;
    const lw = ctx.measureText(TXT.oil).width;
    const w1 = 12 * u + lw + 8 * u + barW + 10 * u;
    ctx.save();
    ctx.translate(x + w1 / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-(x + w1 / 2), -(y + h / 2));
    ctx.fillStyle = 'rgba(22,19,31,.74)';
    ctx.beginPath();
    ctx.roundRect(x, y, w1, h, h / 2);
    ctx.fill();
    ctx.fillStyle = C.goldLight;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.oil, x + 10 * u, y + h / 2 + 0.5);
    const bx = x + 10 * u + lw + 8 * u, byy = y + h / 2 - 3.5 * u;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.beginPath();
    ctx.roundRect(bx, byy, barW, 7 * u, 3.5 * u);
    ctx.fill();
    const low = this.oilShown < 0.3;
    ctx.fillStyle = low ? (Math.sin(sim.t * 8) > 0 ? '#ff9a52' : '#c96a3a') : '#e8b04a';
    ctx.beginPath();
    ctx.roundRect(bx, byy, Math.max(7 * u, barW * clamp(this.oilShown)), 7 * u, 3.5 * u);
    ctx.fill();
    ctx.restore();
    x += w1 + 6 * u;
    // the lamp's burst: ready or charging
    const ready = sim.burstCd <= 0;
    const lt = `${TXT.lamp} ←`;
    ctx.font = F.pill;
    const w2 = ctx.measureText(lt).width + 20 * u;
    if (!short || x + w2 < L.w) {
      ctx.fillStyle = ready ? 'rgba(245,195,90,.9)' : 'rgba(22,19,31,.74)';
      ctx.beginPath();
      ctx.roundRect(x, y, w2, h, h / 2);
      ctx.fill();
      if (!ready) {
        ctx.fillStyle = 'rgba(245,195,90,.4)';
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(h, w2 * (1 - sim.burstCd / RULES.burstCd)), h, h / 2);
        ctx.fill();
      }
      ctx.fillStyle = ready ? '#2a2133' : C.goldLight;
      ctx.textAlign = 'center';
      ctx.fillText(lt, x + w2 / 2, y + h / 2 + 0.5);
      x += w2 + 6 * u;
    }
    // the combo
    if (sim.combo >= 3) {
      const mult = sim.mult;
      const ct = mult > 1 ? `${t('hud.combo', { n: sim.combo })} · ${t('hud.mult', { n: mult })}` : t('hud.combo', { n: sim.combo });
      const w3 = ctx.measureText(ct).width + 18 * u;
      if (x + w3 < L.w - 8) {
        ctx.fillStyle = mult >= 3 ? '#ff9a52' : mult >= 2 ? C.gold : 'rgba(22,19,31,.74)';
        ctx.beginPath();
        ctx.roundRect(x, y, w3, h, h / 2);
        ctx.fill();
        ctx.fillStyle = mult >= 2 ? '#2a2133' : C.goldLight;
        ctx.textAlign = 'center';
        ctx.fillText(ct, x + w3 / 2, y + h / 2 + 0.5);
      }
    }
  }

  /** The guardian's name and its light (hits left), over the valley. */
  private guardBar(sim: DolinaSim): void {
    if (this.guardA < 0.02 || !sim.guard) return;
    const ctx = this.ctx, L = this.L, u = L.u, g = sim.guard;
    const w = Math.min(this.aw - 40 * u, 300 * u), h = 10 * u;
    const x = L.mode === 'tall' ? this.mx - w / 2 : L.w - w - 16 * u, y = L.sceneTop + (L.mode === 'short' ? 10 : 4) * u;
    ctx.globalAlpha = this.guardA;
    ctx.font = this.F.guard;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(14,10,20,.8)';
    const name = guardName(g.id);
    ctx.strokeText(name, x, y + 14 * u);
    ctx.fillStyle = g.angry ? '#ffb08a' : '#f6eedc';
    ctx.fillText(name, x, y + 14 * u);
    const by = y + 17 * u;
    ctx.fillStyle = 'rgba(14,10,20,.75)';
    ctx.beginPath();
    ctx.roundRect(x, by, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = sim.guardOpen ? '#ffd36b' : '#c9a0d0';
    ctx.beginPath();
    ctx.roundRect(x + 2, by + 2, Math.max(0, (w - 4) * clamp(this.guardHp)), h - 4, (h - 4) / 2);
    ctx.fill();
    // a notch per hit
    ctx.fillStyle = 'rgba(14,10,20,.55)';
    for (let i = 1; i < g.maxHp; i++) ctx.fillRect(x + (w * i) / g.maxHp, by + 2, 1, h - 4);
    ctx.globalAlpha = 1;
  }

  // ── the ridge: the band's last 40 s ─────────────────────────────
  /** The ridge's night sky with the curve, and the row of lanterns, one for each second. */
  drawRidge(sim: DolinaSim, dawn: number): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.ridge, s = L.row;
    // the sky: a frame of dark wood and a night that warms toward the dawn
    ctx.fillStyle = '#1c1520';
    ctx.beginPath();
    ctx.roundRect(r.x - 3, r.y - 3, r.w + 6, r.h + s.h + 9, 8 * u);
    ctx.fill();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, dawn > 0.5 ? '#4a3a62' : '#1b1630');
    g.addColorStop(1, dawn > 0.5 ? '#c0786a' : '#3a2f52');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 6 * u);
    ctx.fill();
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
    // the row of lanterns: gold above the threshold, blue-green in a meadow, unlit where the signal failed
    ctx.fillStyle = '#2a2130';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.fillStyle = '#4a3a3a';
    ctx.fillRect(s.x, s.y + s.h - 2 * u, s.w, 2 * u);
    const n = 40;
    const bars = traceBars(sim.trace, sim.t, n);
    const step = s.w / n, cy = s.y + s.h * 0.55;
    const ls = Math.min(step * 0.3, s.h * 0.3);
    bars.forEach((b, i) => {
      const x = s.x + (i + 0.5) * step;
      if (b.empty) return;
      if (b.shown <= 0) {
        paintSmallLantern(ctx, x, cy, ls, 'veil', 1);
        return;
      }
      if (!b.reliable) {
        ctx.fillStyle = 'rgba(200,180,170,.35)';
        ctx.fillRect(x - 1, s.y + s.h - 4 * u, 2, 2);
        return;
      }
      const state = b.above ? (b.phase === 'rest' ? 'rest' : 'gold') : b.phase === 'rest' ? 'rest' : 'off';
      if (b.above && b.phase !== 'rest') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = b.shown * 0.4;
        ctx.fillStyle = 'rgba(255,200,110,.7)';
        ctx.beginPath();
        ctx.arc(x, cy, Math.min(step * 0.55, ls * 1.3), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      paintSmallLantern(ctx, x, cy, ls * (0.8 + 0.35 * b.level), state, b.shown);
    });
    // the lag bracket over the newest lanterns
    const lagN = Math.max(1, Math.round(this.lag));
    const bx0 = s.x + (n - lagN) * step, bx1 = s.x + s.w;
    ctx.strokeStyle = 'rgba(255,230,180,.6)';
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
      ctx.font = this.fit(f.text, this.aw - 24, f.font, 0.55);
      const y = f.y - f.rise * ease.outCubic(k);
      const half = ctx.measureText(f.text).width / 2 + 6;
      const x = Math.min(this.L.w - half, Math.max(this.L.x0 + half, f.x));
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(20,14,26,.78)';
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
    if (c.kind === 'story') {
      this.storyCard(c, inK, outK);
      return;
    }
    const w = Math.min(310 * u, this.aw - 32), h = (c.curve ? 100 : c.sub ? 56 : 40) * u;
    const cy = L.cardY + h / 2;
    const x = this.mx - w / 2, y = cy - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(this.mx, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-this.mx, -(y + h / 2));
    ctx.shadowColor = 'rgba(10,8,20,.4)';
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

  /** The opening card and the cards between eras: a title, a few sentences, a passage. */
  private storyCard(c: Card, inK: number, outK: number): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const w = Math.min(420 * u, this.aw - 28);
    const pad = 16 * u;
    const textLs = this.lines(c.sub, w - 2 * pad, F.storyText, 5);
    const p = c.verse ? passage(c.verse) : null;
    const room = Math.max(60 * u, L.floorY - L.hudBottom - 20 * u);
    const pl = p ? layoutPassage(ctx, p, w - 2 * pad, Math.max(40 * u, room - (44 + textLs.length * 18) * u), { max: 15 * u, min: 10 }) : null;
    const h = Math.min(room, (44 + textLs.length * 18 + 8) * u + (pl ? pl.height + 8 * u : 0));
    const x = this.mx - w / 2, y = Math.max(L.hudBottom + 6 * u, (L.hudBottom + L.floorY) / 2 - h / 2 - 20 * u) + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.shadowColor = 'rgba(10,8,20,.45)';
    ctx.shadowBlur = 20;
    this.paper(x, y, w, h, 0.97);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.gold;
    ctx.fillRect(x + pad, y + 40 * u, 40 * u, 2 * u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(c.title, w - 2 * pad, F.storyTitle);
    ctx.fillText(c.title, x + pad, y + 10 * u);
    ctx.font = F.storyText;
    ctx.fillStyle = C.textSoft;
    textLs.forEach((line, i) => ctx.fillText(line, x + pad, y + 48 * u + i * 18 * u));
    if (p && pl) drawPassage(ctx, p, pl, this.mx, y + (52 + textLs.length * 18) * u, { text: '#4a3a5a', ref: C.goldDeep });
    ctx.restore();
  }

  /** The block's own curve in miniature; a blind block's veil lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(27,22,48,.92)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 4);
    ctx.fill();
    for (const b of c.bands) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(127,200,190,.22)' : 'rgba(255,211,107,.08)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(236,226,255,.5)';
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
      ctx.strokeStyle = a.above && b.above ? '#ffd36b' : 'rgba(236,226,255,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(84,74,112,.94)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  // ── the hint for the hands, the dawn ────────────────────────────
  private hintPill(sim: DolinaSim): void {
    if (this.hintA < 0.02 || !this.hintText) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const urgent = sim.hint === 'open';
    const f = urgent ? font(800, 14 * u, SANS) : this.F.cardSub;
    ctx.font = f;
    const w = Math.min(this.aw - 32, ctx.measureText(this.hintText).width + 28 * u), h = (urgent ? 32 : 28) * u;
    const x = L.runX + 1.2 * L.S - w / 2, y = L.floorY - L.S * 3.3 - h;
    const cx = clamp(x, L.x0 + 10, L.w - w - 10) + w / 2;
    const yy = Math.max(L.sceneTop + 30 * u, y);
    ctx.globalAlpha = this.hintA;
    const k = urgent ? 1 + 0.06 * Math.sin(sim.t * 14) : 1;
    ctx.save();
    ctx.translate(cx, yy + h / 2);
    ctx.scale(k, k);
    ctx.fillStyle = urgent ? 'rgba(255,211,107,.96)' : 'rgba(246,238,220,.94)';
    ctx.strokeStyle = urgent ? '#c98a24' : 'rgba(150,120,160,.5)';
    ctx.lineWidth = urgent ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(this.hintText, w - 16 * u, f);
    ctx.fillText(this.hintText, 0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private finale(sim: DolinaSim): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const sub = t('finale.sub', { metres: metres(sim.score) });
    const w = Math.min(this.aw - 32, 360 * u), h = 74 * u, x = this.mx - w / 2, y = L.cardY;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, this.mx, y + 10 * u);
    ctx.font = this.fit(sub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(sub, this.mx, y + 48 * u);
    ctx.globalAlpha = 1;
  }

  // ── Ćma's bubble ────────────────────────────────────────────────
  /** A speech bubble pointing at (ax, ay), kept inside the valley and below the HUD. */
  bubble(text: string, ax: number, ay: number, a: number): void {
    if (a <= 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const maxW = Math.min(250 * u, this.aw - 40 * u);
    const ls = this.lines(text, maxW - 20 * u, this.F.bubble, 3);
    ctx.font = this.F.bubble;
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const w = tw + 22 * u, h = ls.length * 16 * u + 14 * u;
    // above Ćma if there is room, else beside her (right, then left), always inside the valley
    let x = ax - w * 0.3, y = ay - h - 14 * u, side = 0;
    if (y < L.sceneTop + 4 * u) {
      y = clamp(ay - h / 2, L.sceneTop + 4 * u, L.floorY - h - 4 * u);
      side = ax + 18 * u + w < L.w - 8 ? 1 : -1;
      x = side > 0 ? ax + 18 * u : ax - 18 * u - w;
    }
    x = clamp(x, L.x0 + 8, L.w - w - 8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,250,236,.97)';
    ctx.strokeStyle = 'rgba(120,90,60,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    ctx.stroke();
    // the tail toward Ćma
    ctx.beginPath();
    if (side === 0) {
      const tx = clamp(ax, x + 14 * u, x + w - 14 * u);
      ctx.moveTo(tx - 6 * u, y + h - 1);
      ctx.lineTo(ax, ay - 4 * u);
      ctx.lineTo(tx + 6 * u, y + h - 1);
    } else {
      const ex = side > 0 ? x + 1 : x + w - 1, ty = clamp(ay, y + 10 * u, y + h - 10 * u);
      ctx.moveTo(ex, ty - 6 * u);
      ctx.lineTo(ax + side * 6 * u, ay);
      ctx.lineTo(ex, ty + 6 * u);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((line, i) => ctx.fillText(line, x + 11 * u, y + 7 * u + i * 16 * u));
    ctx.restore();
  }
}

/** The pills sit this far above the canvas bottom on a phone on its side (u). */
const BOTTOM_PILLS = 8;

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
