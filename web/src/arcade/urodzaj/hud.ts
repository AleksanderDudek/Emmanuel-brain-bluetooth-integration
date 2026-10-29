/**
 * Urodzaj's HUD on the play canvas, on cream plaques like a mosaic's inscription panel (tabula
 * ansata) so it reads over the day's terraces and the dusk alike: the harvest (a big number that
 * counts up live) with the basket's own points, the next fruit in its roundel, the ladder of the
 * nine fruit (those seen this session lit, the player's best marked), the block's name, its
 * progress and the telegraph, a strategy line, the table panel when the screen is wide, the cards
 * in the stamp slot (a verdict, a reveal, a step of the table, a guest) shown in turn, the floating
 * words over the basket and the first sessions' "drag and let go" hint.  Every string is fitted to
 * its room, so German and Swedish read on a 390 px phone; wrapped lines are made again only when
 * their text or room changes.
 */
import { approach, clamp, ease } from '../kit/juice';
import { MAX_TIER, TABLE_STEPS, fruit, guestById, type FigureLook } from './content';
import { bare, t } from './i18n';
import { type Layout } from './layout';
import { tablePoints, tableState } from './meta';
import { C, SANS, SERIF, TAU, mix, paintFruit, paintVineLeaf, stone } from './mosaic';
import { RULES, type UrodzajSim } from './sim';
import { paintGuest, paintTable } from './table';

export const font = (weight: number, size: number, family: string, italic = false): string =>
  `${italic ? 'italic ' : ''}${weight} ${Math.max(8, Math.round(size * 10) / 10)}px ${family}`;

interface Fit { text: string; maxW: number; size: number; fit: number; font: string }
const fitSlot = (): Fit => ({ text: '', maxW: -1, size: -1, fit: 0, font: '' });

/** Advance timed items and drop the finished ones, in place. */
export function age<T extends { t: number; dur: number }>(list: T[], dt: number): void {
  let n = 0;
  for (const it of list) {
    it.t += dt;
    if (it.t < it.dur) list[n++] = it;
  }
  list.length = n;
}

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

export type CardIcon = 'leaf' | 'drop' | 'almost' | 'cloud' | 'dusk' | 'table' | 'loaf' | 'guest' | 'great' | 'fruit' | 'none';

interface Card {
  title: string; sub: string; color: string; t: number; dur: number; rank: number;
  icon: CardIcon; look: FigureLook | null; step: number; tier: number;
  lines: string[]; subLines: string[]; w: number;
}

const TXT = {
  warmup: t('block.warmup'), zbior: t('block.zbior'), zbiorBlind: t('block.zbiorBlind'), rosa: t('block.rosa'), rosaBlind: t('block.rosaBlind'),
  evening: t('block.evening'), nextZbior: t('next.zbior'), nextRosa: t('next.rosa'), nextEvening: t('next.evening'),
  next: t('hud.next'), daily: t('hud.daily'), drag: t('lesson.drag'),
};

export class Hud {
  private L!: Layout;
  private dpr = 1;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private fonts = Hud.fontsFor(1);
  private readonly nameFit = fitSlot();
  private readonly nextFit = fitSlot();
  private readonly basketFit = fitSlot();
  private readonly tableFit = fitSlot();
  private readonly pillFit = fitSlot();
  private readonly tipWrap = { text: '', maxW: -1, font: '', lines: [] as string[] };
  private scorePop = 0;
  private nextPop = 0;
  /** the harvest shown: it counts up to the real one, quickly, so the headline accrues live */
  private shown = 0;
  private scoreText = '0';
  private scoreN = -1;
  private basketText = '';
  private basketN = -1;
  private pill = 0;
  private clock = 0;
  /** the width "Następny" takes beside the roundel on a phone */
  private nextW = 60;

  constructor(private readonly ctx: CanvasRenderingContext2D, private readonly rm: boolean) {}

  private static fontsFor(u: number) {
    return {
      brow: font(700, 10.5 * u, SANS), tip: font(500, 13 * u, SANS), small: font(650, 12 * u, SANS),
      score: font(500, 40 * u, SERIF), unit: font(650, 12 * u, SANS),
      cardTitle: font(500, 20 * u, SERIF, true), cardSub: font(600, 12.5 * u, SANS), float: font(700, 15 * u, SANS),
    };
  }

  resize(L: Layout, dpr: number): void {
    this.L = L;
    this.dpr = dpr;
    this.fonts = Hud.fontsFor(L.u);
    this.nameFit.maxW = -1;
    this.tipWrap.maxW = -1;
    for (const c of this.cards) c.w = -1;
  }

  // ── what the view asks for ──────────────────────────────────────
  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.2, rise = 34): void {
    const u = this.L.u;
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(700, size * u, SANS), rise: (this.rm ? rise * 0.4 : rise) * u });
    if (this.floats.length > 14) this.floats.shift();
  }

  /** A card in the stamp slot, queued behind more important ones (rank 0 first). */
  card(title: string, sub: string, o: { color?: string; dur?: number; rank?: number; icon?: CardIcon; look?: FigureLook | null; step?: number; tier?: number } = {}): void {
    const c: Card = {
      title, sub, color: o.color ?? C.dark, t: 0, dur: o.dur ?? 2.6, rank: o.rank ?? 1, icon: o.icon ?? 'none',
      look: o.look ?? null, step: o.step ?? 0, tier: o.tier ?? 1, lines: [], subLines: [], w: -1,
    };
    let i = this.cards.length;
    while (i > 1 && this.cards[i - 1].rank > c.rank) i--;
    this.cards.splice(i, 0, c);
    if (this.cards.length > 7) this.cards.pop();
    const head = this.cards[0];
    if (this.cards.length > 1) head.dur = Math.min(head.dur, Math.max(1.5, head.t) + 0.3);
  }

  clearCards(): void { this.cards.length = 0; }

  popScore(): void { this.scorePop = 1; }
  popNext(): void { this.nextPop = 1; }

  update(dt: number, sim: UrodzajSim): void {
    this.clock += dt;
    age(this.floats, dt);
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1) next.dur = Math.min(next.dur, 2.3);
    }
    this.scorePop = Math.max(0, this.scorePop - dt * 2.2);
    this.nextPop = Math.max(0, this.nextPop - dt * 2.5);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.08);
    if (sim.score - this.shown < 0.5) this.shown = sim.score;
    this.pill = approach(this.pill, sim.ghost ? 1 : 0, dt, 0.18);
  }

  // ── drawing ─────────────────────────────────────────────────────
  draw(sim: UrodzajSim): void {
    const L = this.L;
    this.plaques();
    this.score(sim);
    this.nextFruit(sim);
    this.ladder(sim);
    this.status(sim);
    if (L.table) this.tablePanel(sim);
    this.drawFloats();
    this.drawCard();
    this.ghostPill();
  }

  /** The cream panels the HUD sits on: one across the top on a phone, one per column when wide. */
  private plaques(): void {
    const { ctx, L } = this;
    const u = L.u;
    ctx.save();
    if (L.portrait) {
      const top = Math.max(L.score.y - 9 * u, 62), bottom = L.tip.y + L.tip.h + 2 * u;
      plaque(ctx, 10, top, L.w - 20, bottom - top, 12 * u);
    } else {
      const lt = L.score.y - 9 * u, lb = L.score.y + L.score.h + 4 * u;
      plaque(ctx, L.score.x - 10 * u, lt, L.score.w + 20 * u, lb - lt, 12 * u);
      const rt = L.next.y - L.next.r - 10 * u, rb = L.tip.y + L.tip.h + 4 * u;
      plaque(ctx, L.ladder.x - 10 * u, rt, L.ladder.w + 20 * u, rb - rt, 12 * u);
    }
    ctx.restore();
  }

  /** The harvest: a big serif number, its unit, the basket's own points, "Kosz dnia" above on the day's first session. */
  private score(sim: UrodzajSim): void {
    const { ctx, L, fonts: F } = this;
    const u = L.u, r = L.score;
    const n = Math.round(this.shown);
    if (n !== this.scoreN) {
      this.scoreN = n;
      this.scoreText = String(n);
    }
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    let x = r.x;
    const base = r.y + 36 * Math.min(u, r.h / 44);
    if (sim.daily) {
      ctx.font = F.brow;
      ctx.fillStyle = mix(C.terracotta, C.dark, 0.2);
      ctx.fillText(TXT.daily.toLocaleUpperCase(), x, r.y + 3 * u);
    }
    const pop = this.scorePop > 0 && !this.rm ? 1 + 0.12 * ease.outElastic(1 - this.scorePop) * this.scorePop : 1;
    ctx.font = F.score;
    ctx.fillStyle = C.dark;
    const tw = ctx.measureText(this.scoreText).width;
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(pop, pop);
    ctx.fillText(this.scoreText, 0, 0);
    ctx.restore();
    x += tw + 9 * u;
    ctx.font = F.unit;
    ctx.fillStyle = C.muted;
    const unit = bare('pts', sim.score);
    ctx.fillText(unit, x, base);
    // the basket's own points, beside or under
    if (sim.basketPts !== this.basketN) {
      this.basketN = sim.basketPts;
      this.basketText = t('hud.basket', { pts: t('pts', { n: sim.basketPts }) });
    }
    const ux = x + ctx.measureText(unit).width + 10 * u;
    const right = L.portrait ? L.next.x - L.next.r - this.nextW - 14 * u : r.x + r.w;
    const room = right - ux;
    if (room > 70 * u) {
      this.fitIn(this.basketFit, this.basketText, room, 12 * u, 600, SANS);
      ctx.font = this.basketFit.font;
      ctx.fillStyle = mix(C.olive, C.dark, 0.25);
      ctx.fillText(this.basketText, ux, base);
    } else {
      this.fitIn(this.basketFit, this.basketText, right - r.x, 11 * u, 600, SANS);
      ctx.font = this.basketFit.font;
      ctx.fillStyle = mix(C.olive, C.dark, 0.25);
      ctx.fillText(this.basketText, r.x, base + 13 * u);
    }
    ctx.restore();
  }

  /** The next fruit in its roundel, "Następny" beside it. */
  private nextFruit(sim: UrodzajSim): void {
    const { ctx, L, fonts: F } = this;
    const u = L.u, n = L.next;
    ctx.save();
    const pop = this.nextPop > 0 && !this.rm ? 1 + 0.15 * Math.sin(this.nextPop * Math.PI) : 1;
    ctx.translate(n.x, n.y);
    ctx.scale(pop, pop);
    ctx.fillStyle = C.ground;
    ctx.beginPath();
    ctx.arc(0, 0, n.r, 0, TAU);
    ctx.fill();
    // a ring of stones around it
    const k = Math.max(10, Math.round((n.r * TAU) / (4.2 * u)));
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU;
      stone(ctx, Math.cos(a) * n.r, Math.sin(a) * n.r, 3.6 * u, a, i % 2 ? C.ochre : C.terracotta);
    }
    const tier = sim.upcoming;
    const fr = Math.min(n.r * 0.7, Math.max(n.r * 0.4, fruit(tier).r / fruit(4).r * n.r * 0.68));
    paintFruit(ctx, tier, 0, 0, fr);
    ctx.restore();
    ctx.save();
    ctx.font = F.brow;
    ctx.fillStyle = C.muted;
    ctx.textBaseline = 'alphabetic';
    if (L.portrait) {
      ctx.textAlign = 'right';
      this.fitIn(this.nextFit, TXT.next.toLocaleUpperCase(), 84 * u, 10 * u, 700, SANS);
      ctx.font = this.nextFit.font;
      this.nextW = ctx.measureText(TXT.next.toLocaleUpperCase()).width;
      ctx.fillText(TXT.next.toLocaleUpperCase(), n.x - n.r - 8 * u, n.y + 4 * u);
    } else {
      ctx.textAlign = 'left';
      this.fitIn(this.nextFit, TXT.next.toLocaleUpperCase(), L.ladder.w - n.r * 2 - 16 * u, 10.5 * u, 700, SANS);
      ctx.font = this.nextFit.font;
      ctx.fillText(TXT.next.toLocaleUpperCase(), n.x + n.r + 10 * u, n.y + 4 * u);
    }
    ctx.restore();
  }

  /** The ladder of the nine fruit: seen this session lit, the others faint; the player's best marked with gold. */
  private ladder(sim: UrodzajSim): void {
    const { ctx, L } = this;
    const r = L.ladder;
    const step = r.w / MAX_TIER;
    const rr = Math.min(r.h * 0.5, step * 0.38);
    ctx.save();
    for (let k = 1; k <= MAX_TIER; k++) {
      const x = r.x + step * (k - 0.5), y = r.y + r.h / 2;
      const seen = (sim.seen >> k) & 1;
      const rk = rr * (0.62 + 0.38 * (k - 1) / (MAX_TIER - 1));
      ctx.globalAlpha = seen ? 1 : 0.3;
      paintFruit(ctx, k, x, y, rk);
      if (k === sim.p.bestTier && k > 1) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.gold;
        ctx.fillRect(x - rk, r.y + r.h + 2, rk * 2, 2);
      }
    }
    ctx.restore();
  }

  /** The block's name, its bar and the telegraph, and the strategy line under it. */
  private status(sim: UrodzajSim): void {
    const { ctx, L, fonts: F } = this;
    const u = L.u, r = L.label;
    const b = sim.block;
    const evening = sim.phase !== 'play';
    const name = evening ? TXT.evening : !b ? '' : b.kind === 'warmup' ? TXT.warmup : b.kind === 'zbior' ? (b.blind ? TXT.zbiorBlind : TXT.zbior) : b.blind ? TXT.rosaBlind : TXT.rosa;
    const tone = evening ? C.lilac : !b ? C.dark : b.kind === 'rosa' ? (b.blind ? C.night : C.lapis) : b.kind === 'zbior' ? (b.blind ? C.muted : C.vine) : C.terracotta;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const barW = Math.min(r.w * 0.36, 120 * u);
    const nameSize = this.fitIn(this.nameFit, name, r.w - barW - 14 * u, 21 * u, 500, SERIF);
    ctx.font = this.nameFit.font;
    ctx.fillStyle = tone;
    ctx.fillText(name, r.x, r.y + nameSize * 0.85);
    const nameW = ctx.measureText(name).width;
    if (b && !evening) {
      // the block's bar, and the telegraph in its last seconds
      const bx = Math.min(r.x + nameW + 12 * u, r.x + r.w - barW), by = r.y + nameSize * 0.5;
      const prog = clamp(sim.blockT / Math.max(1e-6, b.dur));
      ctx.fillStyle = 'rgba(42,38,34,.14)';
      ctx.fillRect(bx, by, barW, 3);
      ctx.fillStyle = tone;
      ctx.fillRect(bx, by, barW * prog, 3);
      if (sim.blockT >= b.dur - RULES.telegraph) {
        const nx = sim.next;
        const word = !nx ? TXT.nextEvening : nx.kind === 'rosa' ? TXT.nextRosa : TXT.nextZbior;
        const pulse = this.rm ? 1 : 0.6 + 0.4 * Math.sin(this.clock * 6);
        ctx.globalAlpha = pulse;
        ctx.font = F.small;
        ctx.fillStyle = !nx ? C.lilac : nx.kind === 'rosa' ? C.lapis : C.vine;
        const tw = ctx.measureText(word).width;
        const fx = Math.max(r.x, Math.min(bx, r.x + r.w - tw));
        ctx.fillText(word, fx, by + 15 * u);
        ctx.globalAlpha = 1;
      }
    }
    // the tip
    const tr = L.tip;
    if (!evening && sim.tip) {
      const lines = this.wrapTip(sim.tip, tr.w);
      ctx.font = F.tip;
      ctx.fillStyle = 'rgba(42,38,34,.82)';
      const lh = Math.min(17 * u, tr.h / Math.max(1, L.tipLines));
      for (let i = 0; i < Math.min(L.tipLines, lines.length); i++) {
        let line = lines[i];
        if (i === L.tipLines - 1 && lines.length > L.tipLines) line = `${line}…`;
        ctx.fillText(line, tr.x, tr.y + lh * (i + 0.8));
      }
    }
    ctx.restore();
  }

  /** The wide layout's table panel: the table as it stands, "Stół n/8" and the points toward the next step. */
  private tablePanel(sim: UrodzajSim): void {
    const { ctx, L, fonts: F } = this;
    const r = L.table!, u = L.u;
    const st = tableState(tablePoints(sim.p));
    ctx.save();
    plaque(ctx, r.x - 10 * u, r.y, r.w + 20 * u, r.h, 12 * u);
    const label = t('hud.table', { n: st.built, total: TABLE_STEPS.length });
    this.fitIn(this.tableFit, label, r.w, 13 * u, 700, SANS);
    ctx.font = this.tableFit.font;
    ctx.fillStyle = C.dark;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, r.x, r.y + 20 * u);
    // the meter toward the next step
    const my = r.y + 28 * u;
    ctx.fillStyle = 'rgba(42,38,34,.14)';
    ctx.fillRect(r.x, my, r.w, 4);
    ctx.fillStyle = C.ochre;
    ctx.fillRect(r.x, my, r.w * (st.next ? clamp(st.have / st.need) : 1), 4);
    if (st.next) {
      ctx.font = F.brow;
      ctx.fillStyle = C.muted;
      const line = t('panel.setting', { name: st.next.name });
      ctx.fillText(fitText(ctx, line, r.w), r.x, my + 16 * u);
    }
    // the table: as wide as the room under the meter allows (it is about 0.62 of its width tall, the vine over it included)
    const roomTop = my + 26 * u, roomH = r.y + r.h - 10 * u - roomTop;
    const tw = Math.min(r.w * 0.8, roomH / 0.66);
    if (tw > 50) paintTable(ctx, r.x + r.w / 2, roomTop + roomH * 0.5 - tw * 0.06, tw, { built: st.built, guests: sim.p.guests, t: this.clock, bowl: sim.p.bestTier, still: this.rm });
    ctx.restore();
  }

  private drawFloats(): void {
    const { ctx, dpr, L } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = this.rm ? 1 : k < 0.16 ? ease.outBack(k / 0.16) : 1;
      const x = clamp(f.x, 50, L.w - 50);
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.setTransform(dpr * pop, 0, 0, dpr * pop, x * dpr, y * dpr);
      ctx.font = f.font;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(247,240,225,.9)';
      ctx.lineJoin = 'round';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
    }
    ctx.restore();
  }

  /** The card showing now, in the stamp slot: a medallion of stones with its sign, the title and the line. */
  private drawCard(): void {
    const c = this.cards[0];
    if (!c) return;
    const { ctx, L, fonts: F } = this;
    const u = L.u;
    const a = Math.min(1, c.t / 0.25, (c.dur - c.t) / 0.3);
    if (a <= 0) return;
    const maxW = Math.min(L.stamp.w, 380 * u);
    const iconW = c.icon === 'none' ? 0 : 44 * u;
    if (c.w !== maxW) {
      c.w = maxW;
      c.lines = this.wrapLines(c.title, maxW - 30 * u - iconW, F.cardTitle);
      c.subLines = c.sub ? this.wrapLines(c.sub, maxW - 30 * u - iconW, F.cardSub).slice(0, 3) : [];
    }
    const lh = 23 * u, sh = 16 * u;
    const ch = Math.max(iconW ? 52 * u : 0, 16 * u + c.lines.length * lh + c.subLines.length * sh);
    let tw = 0;
    ctx.save();
    ctx.font = F.cardTitle;
    for (const l of c.lines) tw = Math.max(tw, ctx.measureText(l).width);
    ctx.font = F.cardSub;
    for (const l of c.subLines) tw = Math.max(tw, ctx.measureText(l).width);
    const cw = Math.min(maxW, tw + 30 * u + iconW);
    const pop = this.rm ? 1 : c.t < 0.3 ? 0.9 + 0.1 * ease.outBack(c.t / 0.3) : 1;
    const cx = clamp(L.stamp.x, cw / 2 + 8, L.w - cw / 2 - 8), cy = L.stamp.y;
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    const x = -cw / 2, y = -ch / 2;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(42,38,34,.25)';
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 3, cw, ch, 12);
    ctx.fill();
    plaque(ctx, x, y, cw, ch, 12, 0.97);
    if (c.icon !== 'none') this.cardIcon(c, x + 14 * u + iconW / 2 - 4 * u, 0, u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let yy = y + 8 * u;
    ctx.font = F.cardTitle;
    ctx.fillStyle = c.color;
    for (const l of c.lines) {
      yy += lh;
      ctx.fillText(l, x + 14 * u + iconW, yy - 5 * u);
    }
    ctx.font = F.cardSub;
    ctx.fillStyle = 'rgba(42,38,34,.75)';
    for (const l of c.subLines) {
      yy += sh;
      ctx.fillText(l, x + 14 * u + iconW, yy - 3 * u);
    }
    ctx.restore();
  }

  private cardIcon(c: Card, x: number, y: number, u: number): void {
    const { ctx } = this;
    const R = 19 * u;
    // the medallion: a cream disc in a ring of stones
    ctx.fillStyle = c.icon === 'dusk' || c.icon === 'cloud' ? '#D9D3E2' : '#F7EFDD';
    ctx.beginPath();
    ctx.arc(x, y, R, 0, TAU);
    ctx.fill();
    const k = 18;
    for (let i = 0; i < k; i++) {
      const a = (i / k) * TAU;
      stone(ctx, x + Math.cos(a) * R, y + Math.sin(a) * R, 4 * u, a, c.icon === 'drop' || c.icon === 'dusk' ? (i % 2 ? C.blue : C.dew) : i % 2 ? C.ochre : C.terracotta);
    }
    switch (c.icon) {
      case 'leaf': paintVineLeaf(ctx, x, y + 1 * u, R * 0.62, -0.3, true); break;
      case 'drop': case 'dusk': drop(ctx, x, y + 2 * u, R * 0.5); break;
      case 'almost': {
        // a sprout: two small leaves on a stem
        ctx.strokeStyle = C.vine;
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(x, y + R * 0.5);
        ctx.lineTo(x, y - R * 0.1);
        ctx.stroke();
        paintVineLeaf(ctx, x - R * 0.22, y - R * 0.18, R * 0.3, -0.8);
        paintVineLeaf(ctx, x + R * 0.22, y - R * 0.28, R * 0.3, 0.8);
        break;
      }
      case 'cloud':
        ctx.fillStyle = '#FFFFFF';
        for (const [dx, dy, r] of [[-0.3, 0.1, 0.3], [0.05, -0.08, 0.38], [0.35, 0.12, 0.28]] as const) {
          ctx.beginPath();
          ctx.arc(x + dx * R, y + dy * R, r * R, 0, TAU);
          ctx.fill();
        }
        break;
      case 'table': paintTable(ctx, x, y - R * 0.2, R * 1.6, { built: c.step + 1, guests: [], t: 0, still: true }); break;
      case 'loaf':
        ctx.fillStyle = '#C48A4A';
        ctx.beginPath();
        ctx.ellipse(x, y + 2 * u, R * 0.55, R * 0.32, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,210,.8)';
        ctx.lineWidth = 1.4 * u;
        ctx.beginPath();
        for (const dx of [-0.2, 0, 0.2]) {
          ctx.moveTo(x + (dx - 0.06) * R, y - 0.06 * R);
          ctx.lineTo(x + (dx + 0.06) * R, y + 0.1 * R);
        }
        ctx.stroke();
        break;
      case 'guest':
        if (c.look) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(x, y, R * 0.92, 0, TAU);
          ctx.clip();
          paintGuest(ctx, c.look, x, y + R * 0.95, R * 1.7, 1);
          ctx.restore();
        }
        break;
      case 'great': paintFruit(ctx, 9, x, y + 1 * u, R * 0.7); break;
      case 'fruit': paintFruit(ctx, c.tier, x, y, R * 0.6); break;
      default: break;
    }
  }

  /** "Przesuń i puść" in the first sessions when the hand has rested 3 s: a pill over the hang line and a finger drifting along it. */
  private ghostPill(): void {
    if (this.pill < 0.02) return;
    const { ctx, L } = this;
    const u = L.u;
    const size = this.fitIn(this.pillFit, TXT.drag, L.w - 60, 14 * u, 650, SANS);
    ctx.save();
    ctx.globalAlpha = this.pill;
    ctx.font = this.pillFit.font;
    const tw = ctx.measureText(TXT.drag).width;
    const pw = tw + 26 * u, ph = size + 14 * u;
    const cx = L.cx, cy = L.hangY - L.s * 0.11 - ph;
    ctx.fillStyle = 'rgba(42,38,34,.86)';
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = C.ground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TXT.drag, cx, cy + 0.5);
    // the finger: a soft disc drifting left and right along the hang line, then a tap
    const k = this.rm ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock * 1.6);
    const fx = L.cx + (k - 0.5) * L.s * 0.6, fy = L.hangY + L.s * 0.05;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.strokeStyle = 'rgba(42,38,34,.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(fx, fy, 11 * u, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ── text helpers ────────────────────────────────────────────────
  fitIn(slot: Fit, text: string, maxW: number, size: number, weight: number, family: string, italic = false): number {
    if (slot.text !== text || slot.maxW !== maxW || slot.size !== size) {
      this.ctx.font = font(weight, size, family, italic);
      const tw = this.ctx.measureText(text).width;
      slot.text = text;
      slot.maxW = maxW;
      slot.size = size;
      slot.fit = tw <= maxW ? size : Math.max(8.5, Math.floor(((size * maxW) / tw) * 10) / 10);
      slot.font = font(weight, slot.fit, family, italic);
    }
    return slot.fit;
  }

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

/** A cream inscription panel with a dark border and a carved inner line. */
export function plaque(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, alpha = 0.86): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = C.ground;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.globalAlpha /= alpha;
  ctx.strokeStyle = 'rgba(42,38,34,.7)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(42,38,34,.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3));
  ctx.stroke();
  ctx.restore();
}

/** A dew drop: a blue teardrop with a white light. */
export function drop(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = C.blue;
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.5);
  ctx.quadraticCurveTo(x + r * 1.05, y - r * 0.2, x + r * 0.95, y + r * 0.25);
  ctx.arc(x, y + r * 0.25, r * 0.95, 0, Math.PI);
  ctx.quadraticCurveTo(x - r * 1.05, y - r * 0.2, x, y - r * 1.5);
  ctx.fill();
  ctx.fillStyle = C.dew;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, r * 0.62, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y, r * 0.22, 0, TAU);
  ctx.fill();
}

/** The text cut with "…" to fit `maxW` in the current font. */
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}

export const guestLook = (id: string): FigureLook | null => guestById(id)?.look ?? null;
