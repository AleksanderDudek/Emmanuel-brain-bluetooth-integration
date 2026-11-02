/**
 * Zastępy's HUD on the play canvas: the status on a vellum wash (the block's name, a strategy to
 * try, what the band drives right now, the block's progress and the telegraph), the headline —
 * demons beaten this session — counting up live, the battle's bar (the gate of ash's walls, or the
 * Smok), the banners along the road (the band's last 40 s: gold above the threshold, cool in a
 * Cisza, a broken pole without signal, fog over a blind block, the lag bracket at "now"), the light's
 * row (the live gauge — a tube whose fill is the level with the threshold marked, the stream out of
 * it into the light bar it drives, or in a Cisza the calm flowing into the walls — the light bar, the
 * walls, the trumpet's ring), the unit cards, the block card after each block (its own mini-curve and
 * its verdict), the toasts, the words over the road, the card between battles and the finale.
 * Every string is fitted to its room so it reads on a 390 px phone in German and Swedish.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, traceBars, type TraceBand } from '../kit/trace';
import { HOST_NAME, TIPS } from './content';
import { gold as goldText, t, unit } from './i18n';
import type { Layout, Rect } from './layout';
import { gateLevel, unitLevel } from './meta';
import { C, POSE, SANS, SERIF, coin, font, lightDrop, paintHost, paintTrumpet, type Pose } from './paint';
import { HOST, HOST_IDS, RULES, type HostId } from './rules';
import type { BlockKind, ZastepySim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

interface Card {
  title: string; sub: string; color: string; t: number; dur: number;
  curve: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[] | null;
  bands: TraceBand[]; blind: boolean; kind: BlockKind | 'toast';
}

export type Hit = { kind: 'card'; id: HostId } | { kind: 'trumpet' } | { kind: 'offer'; i: number } | { kind: 'go' };

const TXT = {
  warmup: t('block.warmup'), push: t('block.push'), blind: t('block.blind'), rest: t('block.rest'), finale: t('block.finale'),
  nextPush: t('next.push'), nextRest: t('next.rest'), nextFinale: t('next.finale'),
  walls: t('hud.walls'), light: t('hud.light'), ash: t('hud.ash'), sealed: t('hud.sealed'), smok: t('hud.smok'),
  trumpet: t('hud.trumpet'), trumpetHold: t('hud.trumpetHold'), trumpetReady: t('hud.trumpetReady'),
  hintCards: t('hint.cards'), hintFull: t('hint.full'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
  upTitle: t('up.title'), upGo: t('up.go'),
  driveWarm: t('drive.warmup'), driveBelow: t('drive.below'), driveBlind: t('drive.blind'),
  driveRestLead: t('drive.restLead'), driveNone: t('drive.none'),
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
  private tipCache = { text: '', w: -1, lines: [] as string[] };
  private finaleA = 0;
  private upA = 0;
  private clock = 0;
  private readonly lag: number;
  private readonly lagLabel: string;
  /** a card shaken by a tap that could not send (s left), and the last card sent (a press) */
  private readonly shakeT = new Map<HostId, number>();
  private readonly pressT = new Map<HostId, number>();
  private trumpetPop = 0;
  private boughtT = 0;
  /** the gate level the cards were laid out for */
  private gate = 1;
  private readonly pose: Pose = { ...POSE };
  /** the stream's motes from the gauge into the bar */
  private readonly motes: { k: number; v: number; rest: boolean }[] = [];
  private moteAcc = 0;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 20 * u, SERIF), tip: font(500, 12.5 * u, SANS), drive: font(700, 12 * u, SANS), small: font(650, 11.5 * u, SANS),
      score: font(500, 40 * u, SERIF), unit: font(650, 12.5 * u, SANS), bar: font(700, 11.5 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true),
      cardSub: font(650, 12 * u, SANS), big: font(500, 26 * u, SERIF, true), lag: font(650, 9 * u, SANS), key: font(800, 10 * u, SANS),
      cost: font(800, 12 * u, SANS), tiny: font(700, 9.5 * u, SANS), upName: font(700, 12 * u, SANS), btn: font(750, 14 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.tipCache.w = -1;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 16) this.floats.shift();
  }

  shiftFloats(dx: number): void { for (const f of this.floats) f.x += dx; }
  popScore(): void { this.pop = 1; }
  shakeCard(id: HostId): void { this.shakeT.set(id, 0.35); }
  pressCard(id: HostId): void { this.pressT.set(id, 0.25); }
  popTrumpet(): void { this.trumpetPop = 1; }
  bought(): void { this.boughtT = 1; }

  /** The card after a block: the block's curve from the sim's trace, its name and its verdict. */
  blockCard(sim: ZastepySim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, light: number): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'push' ? (blind ? TXT.blind : TXT.push) : TXT.rest;
    let sub: string, color: string = C.ink;
    if (blind) {
      sub = `${t('blind.reveal', { n: pct(share) })}${light > 0 ? ` · ${t('card.blindPay', { light: t('light', { n: light }) })}` : ''}`;
      color = '#6a4fa0';
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'push' ? t('card.push.pass') : `${t('card.rest.pass')} · ${t('card.restPay', { gold: goldText(RULES.restGold) })}`;
      color = kind === 'push' ? C.goldDeep : C.blueDeep;
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.pushCard({ title, sub, color, t: 0, dur: 3.6, curve, bands: lay.bands.map(b => ({ ...b })), blind, kind });
  }

  toast(title: string, sub: string, color: string = C.ink, dur = 2.6): void {
    this.pushCard({ title, sub, color, t: 0, dur, curve: null, bands: [], blind: false, kind: 'toast' });
  }

  private pushCard(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.6, head.t) + 0.3);
  }

  update(dt: number, sim: ZastepySim): void {
    this.clock += dt;
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.4);
    }
    for (const m of [this.shakeT, this.pressT]) for (const [k, v] of m) (v - dt <= 0 ? m.delete(k) : m.set(k, v - dt));
    this.pop = Math.max(0, this.pop - dt * 2.4);
    this.trumpetPop = Math.max(0, this.trumpetPop - dt * 1.5);
    this.boughtT = Math.max(0, this.boughtT - dt * 1.2);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.1);
    this.hintA = approach(this.hintA, sim.hint ? 1 : 0, dt, 0.2);
    this.finaleA = approach(this.finaleA, sim.phase !== 'play' ? 1 : 0, dt, 0.4);
    this.upA = approach(this.upA, sim.stage === 'upgrade' && sim.phase === 'play' ? 1 : 0, dt, 0.12);
    // the stream: motes leave the gauge as fast as the band drives
    const b = sim.battle;
    const rest = sim.calmNow > 0;
    const rate = rest ? 3 + sim.calmNow * 10 : sim.stage === 'battle' && b.light < b.lightMax ? 2 + (sim.mult - 1) * 9 : 0;
    this.moteAcc += rate * dt;
    while (this.moteAcc >= 1) {
      this.moteAcc -= 1;
      if (this.motes.length < 40) this.motes.push({ k: 0, v: 0.9 + (rest ? 0.2 : (sim.mult - 1) * 0.8), rest });
    }
    let m = 0;
    for (const o of this.motes) if ((o.k += dt * o.v) < 1) this.motes[m++] = o;
    this.motes.length = m;
  }

  draw(sim: ZastepySim): void {
    this.status(sim);
    this.score();
    this.battleBar(sim);
    this.row(sim);
    this.cardsRow(sim);
    this.drawFloats();
    this.drawCard();
    this.hintPill(sim);
    this.upgrade(sim);
    this.finale();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private vellum(x: number, y: number, w: number, h: number, a = 0.88, r = 10): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,248,232,${a})`;
    ctx.strokeStyle = 'rgba(185,127,31,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r * this.L.u);
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

  // ── the status ──────────────────────────────────────────────────
  /** What the band drives right now, in words, and its colour. */
  private drive(sim: ZastepySim): { text: string; color: string } {
    const b = sim.block;
    if (sim.phase !== 'play') return { text: '', color: C.ink };
    if (b.kind === 'warmup') return { text: TXT.driveWarm, color: C.inkSoft };
    if (b.kind === 'push') {
      if (b.blind) return { text: TXT.driveBlind, color: '#5a4386' };
      if (sim.blockT < sim.leadIn) return { text: t('drive.lead', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) }), color: C.inkSoft };
      if (!sim.reliable) return { text: TXT.driveNone, color: '#7a6f66' };
      if (sim.mult > 1.02 && sim.charge > 0 && !sim.ready) return { text: t('drive.pushTrumpet', { x: fmtNum(sim.mult, 1), n: Math.round(sim.charge * 100) }), color: C.goldDeep };
      if (sim.mult > 1.02) return { text: t('drive.push', { x: fmtNum(sim.mult, 1) }), color: C.goldDeep };
      return { text: TXT.driveBelow, color: C.inkSoft };
    }
    if (sim.calmNow > 0.12) {
      const per = (RULES.mend * sim.calmNow * sim.battle.wallsMax);
      if (sim.calmNow >= 0.5) return { text: t('drive.rest', { n: fmtNum(per, 0) }), color: C.blueDeep };
      return { text: t('drive.restLow', { n: fmtNum(per, 0) }), color: '#5d6f8f' };
    }
    if (!sim.reliable && sim.blockT >= 2) return { text: TXT.driveNone, color: '#7a6f66' };
    return { text: TXT.driveRestLead, color: '#5d6f8f' };
  }

  private status(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const b = sim.block;
    const name = sim.phase !== 'play' ? TXT.finale : b.kind === 'warmup' ? TXT.warmup : b.kind === 'rest' ? TXT.rest : b.blind ? TXT.blind : TXT.push;
    let tip = sim.phase !== 'play' ? '' : sim.tip;
    if (sim.phase === 'play' && b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    this.vellum(r.x, r.y, r.w, r.h);
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = sim.phase === 'play' && b.kind === 'rest' ? '#34507e' : sim.blind ? '#5a4386' : C.ink;
    ctx.font = this.fit(name, r.w - 2 * pad, F.name);
    ctx.fillText(name, r.x + pad, r.y + 7 * u);
    // the tip (two lines at most; one on a short screen)
    ctx.font = F.tip;
    if (this.tipCache.text !== tip || this.tipCache.w !== r.w) {
      this.tipCache = { text: tip, w: r.w, lines: wrap(ctx, tip, r.w - 2 * pad).slice(0, L.short ? 1 : 3) };
    }
    ctx.fillStyle = 'rgba(42,31,46,.82)';
    this.tipCache.lines.forEach((line, i) => ctx.fillText(line, r.x + pad, r.y + (L.short ? 28 : 31) * u + i * 15 * u));
    // what the band drives now, with a dot of its colour
    const d = this.drive(sim);
    const dy = r.y + r.h - 23 * u;
    if (d.text) {
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(r.x + pad + 4 * u, dy + 6.5 * u, 3.5 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = this.fit(d.text, r.w - 2 * pad - 12 * u, F.drive, 0.62);
      ctx.fillText(d.text, r.x + pad + 12 * u, dy);
    }
    // the block's progress, or the telegraph
    const by = r.y + r.h - 7 * u;
    const left = sim.phase === 'play' ? b.dur - sim.blockT : 0;
    if (sim.phase === 'play' && left <= RULES.telegraph) {
      const nb = sim.next;
      const txt = !nb ? TXT.nextFinale : nb.kind === 'rest' ? TXT.nextRest : TXT.nextPush;
      ctx.font = this.fit(txt, r.w * 0.55, F.tiny);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#9a5a10';
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sim.t * 6);
      ctx.fillText(txt, r.x + r.w - pad, r.y + 9 * u);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(92,74,50,.16)';
    ctx.fillRect(r.x + pad, by, r.w - 2 * pad, 2.5 * u);
    ctx.fillStyle = sim.phase === 'play' && b.kind === 'rest' ? '#6f93cc' : C.gold;
    ctx.fillRect(r.x + pad, by, (r.w - 2 * pad) * clamp(sim.phase === 'play' ? sim.blockT / b.dur : 1), 2.5 * u);
  }

  // ── the headline ────────────────────────────────────────────────
  private score(): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.18 * ease.outBack(this.pop) * this.pop;
    ctx.font = F.score;
    const nw = Math.max(ctx.measureText(String(n)).width, (ctx.font = F.unit, ctx.measureText(unit(n)).width));
    const sh = (L.short ? 56 : 70) * u;
    this.vellum(L.scoreX - nw - 22 * u, L.scoreY + 2 * u, nw + 22 * u, sh, 0.84);
    ctx.save();
    ctx.translate(L.scoreX, L.scoreY + 4 * u);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = L.short ? font(500, 32 * u, SERIF) : F.score;
    ctx.fillStyle = C.ink;
    ctx.fillText(String(n), -11 * u, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = 'rgba(42,31,46,.8)';
    ctx.fillText(unit(n), L.scoreX - 11 * u, L.scoreY + sh - 20 * u);
  }

  // ── the battle's bar ────────────────────────────────────────────
  private battleBar(sim: ZastepySim): void {
    const ctx = this.ctx, r = this.L.battle, u = this.L.u, F = this.F, b = sim.battle;
    this.vellum(r.x, r.y, r.w, r.h, 0.82, 8);
    const pad = 9 * u;
    const smok = b.smokBattle;
    const label = smok ? TXT.smok : t('hud.battle', { n: b.local + 1, c: b.circle + 1 });
    const bw = Math.min(170 * u, r.w * 0.45), bx = r.x + r.w - pad - bw, by = r.y + r.h / 2 - 4 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = smok ? '#7a2e1e' : C.ink;
    ctx.font = this.fit(label, bx - r.x - pad - 8 * u, F.bar, 0.6);
    ctx.fillText(label, r.x + pad, r.y + r.h / 2 + 0.5);
    // the gate of ash's walls (or the Smok's strength)
    let k = clamp(b.ash / b.ashMax);
    if (smok) k = b.smok ? clamp(b.smok.hp / b.smok.maxHp) : 1;
    ctx.fillStyle = 'rgba(42,31,46,.16)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, 8 * u, 4 * u);
    ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    g.addColorStop(0, '#5a3a4a');
    g.addColorStop(1, '#c2552c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(6 * u, bw * k), 8 * u, 4 * u);
    ctx.fill();
    if (smok && !b.smok) {
      ctx.font = this.fit(TXT.sealed, bw, F.tiny, 0.6);
      ctx.fillStyle = 'rgba(42,31,46,.7)';
      ctx.textAlign = 'center';
      ctx.fillText(TXT.sealed, bx + bw / 2, by + 4 * u);
    }
  }

  // ── the banners along the road: the band's last 40 s ───────────
  /** Drawn by the view between the road's far edge and the fighters. */
  banners(sim: ZastepySim, x0 = this.L.banners.x0, x1 = this.L.banners.x1): void {
    const ctx = this.ctx, L = this.L, u = L.u, B = { ...L.banners, x0, x1 };
    const span = B.x1 - B.x0;
    const n = Math.round(clamp(span / (24 * u), 14, 34));
    const bars = traceBars(sim.trace, sim.t, n);
    const step = span / n;
    const foot = B.y, top = B.y - B.h;
    const hOf = (lv: number) => B.h * (0.28 + 0.72 * clamp(lv));
    // cool bands behind the Cisza, and the veil's fog behind a blind block
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty) continue;
      if (b.phase === 'rest') {
        ctx.fillStyle = 'rgba(143,179,232,.16)';
        ctx.fillRect(B.x0 + i * step, top - 4 * u, step + 0.5, B.h + 4 * u);
      }
    }
    // the threshold: a dashed line where a banner of level 0.5 reaches
    const ty = foot - hOf(0.5);
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(B.x0, ty);
    ctx.lineTo(B.x1, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    const wave = this.clock * 3;
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty) continue;
      const x = B.x0 + (i + 0.5) * step;
      if (!b.reliable) {
        // no signal: a broken stump and a dotted foot — never a low value
        ctx.strokeStyle = 'rgba(120,108,104,.7)';
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(x, foot);
        ctx.lineTo(x, foot - B.h * 0.18);
        ctx.lineTo(x + 3 * u, foot - B.h * 0.24);
        ctx.stroke();
        ctx.setLineDash([1.5, 3]);
        ctx.beginPath();
        ctx.moveTo(x - step / 2 + 2, foot - 1);
        ctx.lineTo(x + step / 2 - 2, foot - 1);
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const ph = b.phase === 'rest';
      const hh = hOf(b.level);
      ctx.globalAlpha = b.shown;
      // the pole
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.beginPath();
      ctx.moveTo(x, foot);
      ctx.lineTo(x, foot - hh);
      ctx.stroke();
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.arc(x, foot - hh, 2.2 * u, 0, Math.PI * 2);
      ctx.fill();
      // the pennant, waving
      const above = b.above;
      const pw = Math.min(step * 0.8, 16 * u), ph2 = Math.min(10 * u, B.h * 0.22);
      const wv = Math.sin(wave + i * 0.7) * 2 * u;
      ctx.fillStyle = above ? (ph ? '#d9c27a' : C.gold) : ph ? '#bcd0ee' : '#fbf3df';
      ctx.strokeStyle = above ? C.goldDeep : ph ? '#6f8fbf' : 'rgba(150,130,100,.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, foot - hh + 2 * u);
      ctx.quadraticCurveTo(x + pw * 0.5, foot - hh + 2 * u + wv, x + pw, foot - hh + 2 * u + ph2 * 0.5 + wv * 0.5);
      ctx.quadraticCurveTo(x + pw * 0.5, foot - hh + 2 * u + ph2 + wv, x, foot - hh + 2 * u + ph2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (above && !ph) {
        ctx.fillStyle = 'rgba(255,224,138,.35)';
        ctx.beginPath();
        ctx.arc(x + pw * 0.4, foot - hh + 2 * u + ph2 * 0.5, pw * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // the veil: fog over what a blind block hides (it lifts when the block ends)
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty || b.shown >= 1) continue;
      ctx.fillStyle = `rgba(106,90,140,${0.82 * (1 - b.shown)})`;
      ctx.beginPath();
      ctx.roundRect(B.x0 + i * step - 1, top - 4 * u, step + 2, B.h + 4 * u, 4 * u);
      ctx.fill();
    }
    // the lag bracket at "now": what you do now shows there
    const lx1 = B.x1 - step / 2, lx0 = lx1 - (this.lag / sim.trace.windowSec) * span;
    const by = top - 6 * u;
    ctx.strokeStyle = 'rgba(42,31,46,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(lx0, by + 4 * u);
    ctx.lineTo(lx0, by);
    ctx.lineTo(lx1, by);
    ctx.lineTo(lx1, by + 4 * u);
    ctx.stroke();
    ctx.font = this.F.lag;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(42,31,46,.85)';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,248,232,.85)';
    ctx.strokeText(this.lagLabel, lx0 - 3 * u, by);
    ctx.fillText(this.lagLabel, lx0 - 3 * u, by);
  }

  // ── the light's row: the gauge, the light, the walls, the trumpet ─
  private row(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const tb = L.tube, lr = L.light, wr = L.walls;
    const blk = sim.block, play = sim.phase === 'play';
    const rest = play && blk.kind === 'rest';
    const blind = sim.blind;
    const live = play && blk.kind === 'push' && !blind && sim.blockT >= sim.leadIn && sim.reliable;
    // the vellum under the whole row
    this.vellum(tb.x - 6 * u, tb.y - 4 * u, L.trumpet.x + L.trumpet.r + 8 * u - tb.x + 6 * u, tb.h + 8 * u, 0.8, 12);
    // the gauge tube: its fill is the level (or the calm in a Cisza), the threshold marked across it
    const fill = rest ? sim.calm : sim.level;
    const k = blind ? 0 : (rest ? sim.calmNow > 0 || sim.reliable : live || (play && blk.kind === 'push' && sim.reliable)) ? fill : 0;
    ctx.fillStyle = 'rgba(42,31,46,.62)';
    ctx.beginPath();
    ctx.roundRect(tb.x, tb.y, tb.w, tb.h, 7 * u);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(tb.x + 2, tb.y + 2, tb.w - 4, tb.h - 4, 6 * u);
    ctx.clip();
    const fh = (tb.h - 4) * clamp(k);
    const above = k >= 0.5;
    const g = ctx.createLinearGradient(tb.x, 0, tb.x + tb.w, 0);
    if (rest) {
      g.addColorStop(0, above ? '#5f86c9' : '#9fb3d6');
      g.addColorStop(0.5, above ? '#b9d3ff' : '#d5e0f2');
      g.addColorStop(1, above ? '#5f86c9' : '#9fb3d6');
    } else {
      g.addColorStop(0, above ? '#e09a1c' : '#e8dcc0');
      g.addColorStop(0.5, above ? '#ffe9a0' : '#fffaf0');
      g.addColorStop(1, above ? '#e09a1c' : '#e8dcc0');
    }
    ctx.fillStyle = g;
    ctx.fillRect(tb.x, tb.y + tb.h - 2 - fh, tb.w, fh);
    // the surface shimmers like poured light
    if (fh > 2) {
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(tb.x, tb.y + tb.h - 2 - fh, tb.w, 2);
    }
    if (blind) {
      ctx.fillStyle = 'rgba(106,90,140,.9)';
      ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
      ctx.fillStyle = '#f2ecff';
      ctx.font = F.cost;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', tb.x + tb.w / 2, tb.y + tb.h / 2);
    }
    ctx.restore();
    // the threshold notch, wider than the tube, with a small pointer
    const ty = tb.y + 2 + (tb.h - 4) * 0.5;
    const nc = rest ? '#c9dcff' : C.goldLight;
    ctx.strokeStyle = nc;
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(tb.x - 3 * u, ty);
    ctx.lineTo(tb.x + tb.w + 3 * u, ty);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rest ? C.blueDeep : C.goldDeep;
    ctx.beginPath();
    ctx.moveTo(tb.x + tb.w + 2 * u, ty);
    ctx.lineTo(tb.x + tb.w + 8 * u, ty - 4 * u);
    ctx.lineTo(tb.x + tb.w + 8 * u, ty + 4 * u);
    ctx.fill();
    if (above && (live || (rest && sim.calmNow > 0))) {
      ctx.shadowColor = rest ? 'rgba(150,190,255,.9)' : 'rgba(255,200,80,.9)';
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = above && (live || rest) ? (rest ? '#9fc0f5' : C.gold) : 'rgba(42,31,46,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(tb.x, tb.y, tb.w, tb.h, 7 * u);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // the stream: motes from the top of the tube into the bar it drives
    const sx = tb.x + tb.w / 2, sy = tb.y + tb.h - 2 - (tb.h - 4) * clamp(k);
    for (const m of this.motes) {
      const tx = m.rest ? wr.x + 10 * u + m.k * 30 * u : lr.x + clamp(b.light / b.lightMax) * lr.w;
      const ty2 = m.rest ? wr.y + wr.h / 2 : lr.y + lr.h / 2;
      const e = ease.inOutSine(m.k);
      const x = sx + (tx - sx) * e, y = sy + (ty2 - sy) * e - Math.sin(m.k * Math.PI) * 12 * u;
      ctx.fillStyle = m.rest ? `rgba(160,195,255,${1 - m.k * 0.5})` : `rgba(255,214,110,${1 - m.k * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, (m.rest ? 2.2 : 2.6) * u, 0, Math.PI * 2);
      ctx.fill();
    }
    // the light bar, with ticks at the open cards' prices
    const lk = clamp(b.light / b.lightMax);
    ctx.fillStyle = 'rgba(42,31,46,.14)';
    ctx.beginPath();
    ctx.roundRect(lr.x, lr.y, lr.w, lr.h, lr.h / 2);
    ctx.fill();
    const lg = ctx.createLinearGradient(lr.x, 0, lr.x + lr.w, 0);
    lg.addColorStop(0, '#ffe9a8');
    lg.addColorStop(1, live && sim.mult > 1.02 ? '#ffc23a' : C.gold);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.roundRect(lr.x, lr.y, Math.max(lr.h, lr.w * lk), lr.h, lr.h / 2);
    ctx.fill();
    if (b.light > b.lightMax) {
      ctx.shadowColor = 'rgba(255,214,110,.95)';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = C.goldLight;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = 'rgba(42,31,46,.35)';
    ctx.lineWidth = 1;
    for (const id of sim.cards) {
      const x = lr.x + lr.w * clamp(HOST[id].cost / b.lightMax);
      ctx.beginPath();
      ctx.moveTo(x, lr.y + 2);
      ctx.lineTo(x, lr.y + lr.h - 2);
      ctx.stroke();
    }
    lightDrop(ctx, lr.x + 11 * u, lr.y + lr.h / 2 + 1 * u, lr.h * 0.3);
    ctx.font = F.cost;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(String(Math.floor(b.light)), lr.x + 20 * u, lr.y + lr.h / 2 + 0.5);
    // the flow's multiplier at the bar's end (×1 in grey: never below)
    const mx = live && sim.mult > 1.02 ? `×${fmtNum(sim.mult, 1)}` : blind ? '×?' : '×1';
    ctx.textAlign = 'right';
    ctx.fillStyle = live && sim.mult > 1.02 ? '#8a5a08' : 'rgba(42,31,46,.55)';
    ctx.font = live && sim.mult > 1.02 ? font(850, 13 * u, SANS) : F.cost;
    ctx.fillText(mx, lr.x + lr.w - 8 * u, lr.y + lr.h / 2 + 0.5);
    // the walls
    const wk = clamp(b.walls / b.wallsMax);
    ctx.fillStyle = 'rgba(42,31,46,.14)';
    ctx.beginPath();
    ctx.roundRect(wr.x, wr.y, wr.w, wr.h, wr.h / 2);
    ctx.fill();
    ctx.fillStyle = wk < 0.3 ? '#c2552c' : rest && sim.calmNow > 0 ? '#7fa6e0' : '#b8a27a';
    ctx.beginPath();
    ctx.roundRect(wr.x, wr.y, Math.max(wr.h, wr.w * wk), wr.h, wr.h / 2);
    ctx.fill();
    if (rest && sim.calmNow > 0) {
      const sh = (this.clock * 0.8) % 1;
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(wr.x + wr.w * wk * sh - 6 * u, wr.y, 12 * u, wr.h);
    }
    ctx.font = this.fit(TXT.walls, wr.w * 0.5, F.tiny);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(`${TXT.walls} ${Math.ceil(b.walls)}`, wr.x + 6 * u, wr.y + wr.h / 2 + 0.5);
    this.trumpetBtn(sim, live);
  }

  private trumpetBtn(sim: ZastepySim, live: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, T = L.trumpet;
    const ready = sim.ready;
    const pulse = ready ? 0.5 + 0.5 * Math.sin(this.clock * 6) : 0;
    const k = 1 + this.trumpetPop * 0.2 + pulse * 0.05;
    ctx.save();
    ctx.translate(T.x, T.y);
    ctx.scale(k, k);
    if (ready) {
      ctx.shadowColor = 'rgba(255,200,80,.95)';
      ctx.shadowBlur = 14 + pulse * 10;
    }
    ctx.fillStyle = ready ? '#fff1c9' : 'rgba(255,248,232,.9)';
    ctx.beginPath();
    ctx.arc(0, 0, T.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // the charge ring (the hold)
    ctx.strokeStyle = 'rgba(42,31,46,.15)';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(0, 0, T.r - 3 * u, 0, Math.PI * 2);
    ctx.stroke();
    if (sim.charge > 0) {
      ctx.strokeStyle = ready ? C.gold : live ? '#e8b04a' : 'rgba(232,176,74,.6)';
      ctx.lineWidth = 4 * u;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, T.r - 3 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sim.charge);
      ctx.stroke();
    }
    paintTrumpet(ctx, 1 * u, 2 * u, T.r * 1.15, ready ? C.goldDeep : 'rgba(150,120,70,.75)');
    ctx.restore();
    // the key's badge
    if (!L.short) {
      const bx = T.x + T.r * 0.72, by = T.y - T.r * 0.72;
      ctx.fillStyle = ready ? C.goldDeep : 'rgba(42,31,46,.55)';
      ctx.beginPath();
      ctx.arc(bx, by, 7 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.font = this.F.key;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', bx, by + 0.5);
    }
  }

  // ── the cards ───────────────────────────────────────────────────
  private cardRects(gate = this.gate): { id: HostId; r: Rect }[] {
    const L = this.L, u = L.u, c = L.cards;
    const ids = HOST_IDS.filter(id => HOST[id].gate <= gate);
    const next = HOST_IDS.find(id => HOST[id].gate > gate);
    if (next) ids.push(next);
    const n = ids.length, gap = 6 * u;
    const w = Math.min(112 * u, (c.w - gap * (n - 1)) / n);
    const total = w * n + gap * (n - 1);
    const x0 = c.x + (c.w - total) / 2;
    return ids.map((id, i) => ({ id, r: { x: x0 + i * (w + gap), y: c.y, w, h: c.h } }));
  }

  private cardsRow(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const gl = (this.gate = gateLevel(sim.p));
    const fighting = sim.stage === 'battle' && sim.phase !== 'done';
    const full = b.light >= b.lightMax - 0.5;
    this.cardRects().forEach(({ id, r }, i) => {
      const st = HOST[id];
      const open = st.gate <= gl;
      const cool = b.cool[id] / st.cool;
      const afford = b.light >= st.cost;
      const ready = open && fighting && cool <= 0 && afford;
      const press = this.pressT.get(id) ?? 0, shake = this.shakeT.get(id) ?? 0;
      ctx.save();
      ctx.translate(r.x + r.w / 2 + Math.sin(shake * 60) * shake * 10 * u, r.y + r.h / 2);
      const sc = 1 - press * 0.4 + (ready && full ? 0.03 * Math.sin(this.clock * 5 + i) : 0);
      ctx.scale(sc, sc);
      ctx.translate(-r.w / 2, -r.h / 2);
      if (ready) {
        ctx.shadowColor = 'rgba(255,200,80,.8)';
        ctx.shadowBlur = full ? 16 : 9;
      }
      const g = ctx.createLinearGradient(0, 0, 0, r.h);
      g.addColorStop(0, open ? '#fffaf0' : 'rgba(225,215,200,.75)');
      g.addColorStop(1, open ? '#f3e3bd' : 'rgba(200,188,170,.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, r.w, r.h, 9 * u);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = ready ? C.gold : 'rgba(185,127,31,.4)';
      ctx.lineWidth = ready ? 2.5 : 1;
      ctx.stroke();
      // the unit, painted
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(0, 0, r.w, r.h, 9 * u);
      ctx.clip();
      const big = id === 'jezdziec' || id === 'archaniol' || id === 'serafin';
      const s = Math.min(r.w / (big ? 2.1 : 1.6), r.h / (big ? 2.2 : 1.9));
      this.pose.t = this.clock;
      this.pose.seed = i;
      ctx.globalAlpha = open ? 1 : 0.35;
      paintHost(ctx, id, r.w / 2 - (id === 'jezdziec' ? 0.1 * s : 0), r.h - 20 * u * (L.short ? 0.6 : 1) + (id === 'serafin' ? -0.1 * s : 0), s, this.pose);
      ctx.globalAlpha = 1;
      // the cooldown: a shade sinking from the top
      if (open && cool > 0) {
        ctx.fillStyle = 'rgba(42,31,46,.45)';
        ctx.fillRect(0, 0, r.w, r.h * cool);
      }
      // not enough light: a dim veil with the light still to come
      if (open && !afford) {
        ctx.fillStyle = 'rgba(255,250,240,.45)';
        ctx.fillRect(0, 0, r.w, r.h);
        ctx.fillStyle = 'rgba(232,176,74,.6)';
        ctx.fillRect(0, r.h - 3 * u, r.w * clamp(b.light / st.cost), 3 * u);
      }
      ctx.restore();
      // the key, the level, the price
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = F.key;
      ctx.fillStyle = 'rgba(42,31,46,.55)';
      if (open && !L.short) ctx.fillText(String(i + 1), 5 * u, 4 * u);
      if (open) {
        const lv = unitLevel(sim.p, id);
        for (let k = 0; k < lv; k++) {
          ctx.fillStyle = C.gold;
          ctx.beginPath();
          ctx.arc(r.w - 6 * u - k * 6 * u, 7 * u, 2.2 * u, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const cy = r.h - 9 * u;
        ctx.font = F.cost;
        const cw = ctx.measureText(String(st.cost)).width;
        lightDrop(ctx, r.w / 2 - cw / 2 - 5 * u, cy, 4 * u, afford ? 1 : 0.6);
        ctx.fillStyle = afford ? C.ink : 'rgba(42,31,46,.5)';
        ctx.fillText(String(st.cost), r.w / 2 + 4 * u, cy + 0.5);
      } else {
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(42,31,46,.65)';
        const lab = t('hud.locked', { n: st.gate });
        ctx.font = this.fit(lab, r.w - 6 * u, F.tiny, 0.6);
        ctx.fillText(lab, r.w / 2, r.h - 9 * u);
      }
      ctx.restore();
    });
  }

  /** What a tap at (x, y) touches on the HUD (null: the road). */
  hit(x: number, y: number, sim: ZastepySim): Hit | null {
    const L = this.L, u = L.u;
    if (sim.stage === 'upgrade' && this.upA > 0.5) {
      for (const o of this.offerRects(sim)) if (inside(x, y, o.r)) return { kind: 'offer', i: o.i };
      if (inside(x, y, this.goRect())) return { kind: 'go' };
    }
    const T = L.trumpet;
    if (Math.hypot(x - T.x, y - T.y) <= T.r + 8 * u) return { kind: 'trumpet' };
    const gl = gateLevel(sim.p);
    for (const c of this.cardRects(gl)) if (HOST[c.id].gate <= gl && inside(x, y, { x: c.r.x - 2, y: c.r.y - 4 * u, w: c.r.w + 4, h: c.r.h + 8 * u })) return { kind: 'card', id: c.id };
    return null;
  }

  // ── the card between battles ────────────────────────────────────
  private offerRects(sim: ZastepySim): { i: number; r: Rect }[] {
    const U = this.L.upgrade, u = this.L.u, n = sim.offers.length;
    if (!n) return [];
    const gap = 8 * u, pad = 12 * u;
    const w = Math.max(40, Math.min(170 * u, (U.w - 2 * pad - gap * (n - 1)) / n));
    const top = U.y + 34 * u, h = Math.max(30, Math.min(56 * u, this.goRect().y - 8 * u - top));
    const total = w * n + gap * (n - 1);
    const x0 = U.x + (U.w - total) / 2;
    return sim.offers.map((_, i) => ({ i, r: { x: x0 + i * (w + gap), y: top, w, h } }));
  }

  private goRect(): Rect {
    const U = this.L.upgrade, u = this.L.u;
    const w = Math.min(220 * u, U.w - 40 * u), h = 30 * u;
    return { x: U.x + (U.w - w) / 2, y: U.y + U.h - h - 9 * u, w, h };
  }

  private upgrade(sim: ZastepySim): void {
    if (this.upA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, U = L.upgrade;
    ctx.save();
    ctx.globalAlpha = this.upA;
    const k = ease.outBack(this.upA);
    ctx.translate(L.w / 2, U.y + U.h / 2);
    ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
    ctx.translate(-L.w / 2, -(U.y + U.h / 2));
    ctx.shadowColor = 'rgba(40,30,20,.3)';
    ctx.shadowBlur = 18;
    this.vellum(U.x, U.y, U.w, U.h, 0.96, 14);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(TXT.upTitle, U.w * 0.6, F.cardTitle);
    ctx.fillText(TXT.upTitle, U.x + 14 * u, U.y + 18 * u);
    // the gold in hand
    const gt = fmtNum(sim.p.gold);
    ctx.font = F.cost;
    ctx.textAlign = 'right';
    ctx.fillText(gt, U.x + U.w - 14 * u, U.y + 18 * u);
    coin(ctx, U.x + U.w - 24 * u - ctx.measureText(gt).width, U.y + 18 * u, 7 * u);
    for (const { i, r } of this.offerRects(sim)) {
      const o = sim.offers[i];
      ctx.fillStyle = o.can ? '#fff6dc' : 'rgba(230,220,205,.8)';
      ctx.strokeStyle = o.can ? C.gold : 'rgba(150,130,100,.4)';
      ctx.lineWidth = o.can ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10 * u);
      ctx.fill();
      ctx.stroke();
      // the icon on the left: a little tower, or the unit
      const iw = Math.min(r.h, 42 * u), ix = r.x + 4 * u + iw / 2, base = r.y + r.h - 6 * u;
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      if (o.what === 'gate') {
        const s = Math.max(4, iw * 0.42);
        ctx.fillStyle = C.stone;
        ctx.fillRect(ix - 0.55 * s, base - 1.6 * s, 1.1 * s, 1.6 * s);
        ctx.strokeStyle = C.gold;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(ix - 0.55 * s, base - 1.6 * s, 1.1 * s, 1.6 * s);
        ctx.fillStyle = C.goldLight;
        ctx.beginPath();
        ctx.moveTo(ix - 0.25 * s, base);
        ctx.lineTo(ix - 0.25 * s, base - 0.45 * s);
        ctx.arc(ix, base - 0.45 * s, 0.25 * s, Math.PI, 0);
        ctx.lineTo(ix + 0.25 * s, base);
        ctx.fill();
      } else {
        const big = o.what === 'jezdziec' || o.what === 'archaniol' || o.what === 'serafin';
        this.pose.t = this.clock;
        paintHost(ctx, o.what, ix, base, Math.max(4, (r.h - 10 * u) / (big ? 2.2 : 1.6)), this.pose);
      }
      ctx.restore();
      // the name with its next level, the price
      const tx = r.x + iw + 10 * u, tw = r.x + r.w - 8 * u - tx;
      const name = o.what === 'gate' ? t('up.gate', { n: o.level }) : t('up.unit', { name: HOST_NAME[o.what], n: o.level });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink;
      ctx.font = this.fit(name, tw, F.upName, 0.55);
      ctx.fillText(name, tx, r.y + r.h * 0.33);
      const pt = fmtNum(o.price);
      coin(ctx, tx + 5 * u, r.y + r.h * 0.7, 5 * u);
      ctx.font = F.cost;
      ctx.fillStyle = o.can ? C.ink : '#9a3a20';
      ctx.fillText(pt, tx + 14 * u, r.y + r.h * 0.7 + 0.5);
    }
    if (this.boughtT > 0) {
      ctx.globalAlpha = this.upA * this.boughtT;
      ctx.font = F.btn;
      ctx.fillStyle = C.goldDeep;
      ctx.textAlign = 'center';
      ctx.fillText(t('up.bought'), L.w / 2, U.y + 18 * u - (1 - this.boughtT) * 8 * u);
      ctx.globalAlpha = this.upA;
    }
    // go on: a button with the auto-continue running down
    const g = this.goRect();
    const left = Math.max(0, RULES.upgradeSec - sim.stageT);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, g.h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232,176,74,.5)';
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, Math.max(g.h, g.w * (left / RULES.upgradeSec)), g.h, g.h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.textAlign = 'center';
    const lab = `${TXT.upGo} · ${t('up.auto', { n: Math.ceil(left) })}`;
    ctx.font = this.fit(lab, g.w - 16 * u, F.btn, 0.6);
    ctx.fillText(lab, g.x + g.w / 2, g.y + g.h / 2 + 0.5);
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
      ctx.save();
      ctx.translate(f.x, y);
      ctx.scale(pop, pop);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255,250,235,.85)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ── the cards over the sky ──────────────────────────────────────
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(L.cardW, L.w - 32), h = (c.curve && !L.short ? 100 : 56) * u;
    const x = clamp(L.cardX - w / 2, 16, L.w - 16 - w), y = L.cardY - (c.curve && !L.short ? 50 : 28) * u + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK) * (this.upA > 0.5 ? 0.25 : 1);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.shadowColor = 'rgba(40,30,20,.25)';
    ctx.shadowBlur = 14;
    this.vellum(x, y, w, h, 0.95);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(c.title, w - 2 * pad, F.cardTitle);
    ctx.fillText(c.title, x + pad, y + 8 * u);
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.sub, w - 2 * pad, F.cardSub, 0.62);
    ctx.fillText(c.sub, x + pad, y + 31 * u);
    if (c.curve && c.curve.length > 1 && !L.short) this.miniCurve(c, x + pad, y + 52 * u, w - 2 * pad, h - 60 * u);
    ctx.restore();
  }

  /** The block's own curve in miniature; a blind block's veil lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    for (const b of c.bands) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(143,179,232,.2)' : 'rgba(232,176,74,.12)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(92,74,50,.5)';
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
        ctx.fillStyle = 'rgba(232,176,74,.3)';
        ctx.beginPath();
        ctx.moveTo(x + a.x * w, y + a.ty * h);
        ctx.lineTo(x + a.x * w, y + a.y * h);
        ctx.lineTo(x + b.x * w, y + b.y * h);
        ctx.lineTo(x + b.x * w, y + b.ty * h);
        ctx.fill();
      }
      ctx.strokeStyle = a.above && b.above ? C.goldDeep : 'rgba(92,74,50,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(106,90,140,.85)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  // ── the hint, the finale ────────────────────────────────────────
  private hintPill(sim: ZastepySim): void {
    const b = sim.battle;
    const full = sim.stage === 'battle' && sim.phase === 'play' && b.light >= b.lightMax - 0.5 && b.t > 8;
    const a = Math.max(this.hintA, full ? 0.9 : 0);
    if (a < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const text = this.hintA > 0.3 ? TXT.hintCards : TXT.hintFull;
    ctx.font = this.F.cardSub;
    const w = Math.min(L.w - 32, ctx.measureText(text).width + 28 * u), h = 26 * u;
    const x = (L.w - w) / 2, y = L.tube.y - h - 10 * u - (L.short ? 0 : 4 * u);
    ctx.globalAlpha = a * (0.75 + 0.25 * Math.sin(this.clock * 4));
    this.vellum(x, y, w, h, 0.94, 13);
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(text, w - 16 * u, this.F.cardSub);
    ctx.fillText(text, L.w / 2, y + h / 2);
    // a bouncing arrow toward the first card
    if (this.hintA > 0.3) {
      const r = this.cardRects()[0].r;
      const bob = Math.abs(Math.sin(this.clock * 5)) * 6 * u;
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2 - 8 * u, r.y - 14 * u - bob);
      ctx.lineTo(r.x + r.w / 2 + 8 * u, r.y - 14 * u - bob);
      ctx.lineTo(r.x + r.w / 2, r.y - 3 * u - bob);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.w - 32, 340 * u), h = 74 * u, x = (L.w - w) / 2, y = L.cardY - h / 2;
    this.vellum(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, L.w / 2, y + 10 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = 'rgba(42,31,46,.8)';
    ctx.fillText(TXT.finaleSub, L.w / 2, y + 48 * u);
    ctx.globalAlpha = 1;
  }
}

const inside = (x: number, y: number, r: Rect): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

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
