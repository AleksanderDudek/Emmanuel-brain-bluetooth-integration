/**
 * Glina's HUD and cards on the play canvas: the order chip (the form, the household, the block and
 * its time) and the day's centimetres in the band under the runner's strip; the cards in the card
 * zone — the neighbour at the gate, the cut (height, stars, the honest near miss, the wall, the
 * glaze buckets), the opening (the stamps and the neighbour's thanks), the sunset — and the coaching
 * line at a block's start; the first-ever session's hints above the clay; words that rise from the
 * wheel head ("Na środku", "Druga forma").  Every string is fitted to its room (shrunk, then
 * wrapped), so German and Swedish read on a 390 px phone; texts are laid out again only when they
 * or their room change, so a frame leaves no garbage.
 */
import { clamp, ease } from '../kit/juice';
import { DAY_GIFT_NAME, FORM, GLAZE_NAME, HINT, KILN_GIFT_NAME, RUN_NAME, WALL_NAME, type GlazeId } from './content';
import { cap, cmText, pctText, t } from './i18n';
import { bucketRects, type Layout, type Rect } from './layout';
import { C, GLAZE, SANS, SERIF, cardBox, font, star } from './paint';
import type { CutCard, FinaleCard, GlinaSim, OpenCard, Order } from './sim';

/** A text laid out for a room: its lines and font, made again only when the text, the room or the font size change. */
interface Wrap { key: string; lines: string[]; font: string; size: number }
const wrapSlot = (): Wrap => ({ key: '', lines: [], font: '', size: 0 });

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }

/** Words the HUD draws every frame, looked up once (the language is settled when the app loads). */
const TXT = {
  gate: t('block.gate'), throw: t('block.throw'), blind: t('block.blind'), cut: t('block.cut'), fire: t('block.fire'),
  closed: t('block.closed'), open: t('block.open'), finale: t('block.finale'), today: t('hud.today'),
  daily: t('gate.dailyTag'), golden: t('gate.golden'), porcelain: t('gate.porcelain'), glaze: t('cut.glaze'),
  centre: t('cut.centre'), formBest: t('cut.formBest'), calm: t('kiln.calm'), first: t('open.first'), isNew: t('open.new'),
  second: t('open.second'), enough: t('fin.enough'), nextWheel: t('next.wheel'), nextKiln: t('next.kiln'),
};

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly w: Record<string, Wrap> = {};
  private readonly buckets: Rect[] = [];
  private cardIn = 0;
  private cardKind = '';
  private todayText = '';
  private todayN = -1;

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  resize(L: Layout): void {
    this.L = L;
    for (const k of Object.keys(this.w)) this.w[k].key = '';
    this.todayN = -1;
  }

  /** The glaze buckets' rects at the cut (index.ts hit-tests taps against them). */
  bucketsAt(n: number): Rect[] { return bucketRects(this.L, n, this.buckets); }

  float(text: string, x: number, y: number, color: string, size: number, dur = 1.6): void {
    this.floats.push({ text, x, y, t: 0, dur, color, size });
    if (this.floats.length > 8) this.floats.shift();
  }

  update(dt: number, sim: GlinaSim): void {
    let n = 0;
    for (const f of this.floats) {
      f.t += dt;
      if (f.t < f.dur) this.floats[n++] = f;
    }
    this.floats.length = n;
    const kind = sim.phase === 'gate' || sim.phase === 'cut' || sim.phase === 'open' || sim.phase === 'finale' || sim.phase === 'done' ? sim.phase : '';
    if (kind !== this.cardKind) {
      this.cardKind = kind;
      this.cardIn = 0;
    }
    this.cardIn = Math.min(1, this.cardIn + dt / 0.35);
  }

  // ── text fitting ────────────────────────────────────────────────
  /** `text` wrapped to `maxW` at `size` (shrunk down to `min` first while it needs more than `lines` lines), kept in a slot. */
  private wrap(slot: string, text: string, maxW: number, size: number, weight: number, family: string, italic = false, lines = 2, min = 10): Wrap {
    const s = (this.w[slot] ??= wrapSlot());
    const key = `${text}|${Math.round(maxW)}|${size}|${weight}|${family}|${italic}|${lines}`;
    if (s.key === key) return s;
    s.key = key;
    const ctx = this.ctx;
    let sz = size;
    for (;;) {
      const f = font(weight, sz, family, italic);
      ctx.font = f;
      const ls = wrapLines(ctx, text, maxW);
      if (ls.length <= lines || sz <= min) {
        s.lines = ls.slice(0, Math.max(lines, ls.length));
        s.font = f;
        s.size = sz;
        break;
      }
      sz = Math.max(min, sz - 0.5);
    }
    return s;
  }

  /** The largest size ≤ `size` at which `text` fits `maxW` on one line. */
  private fit(slot: string, text: string, maxW: number, size: number, weight: number, family: string, italic = false): Wrap {
    const s = (this.w[slot] ??= wrapSlot());
    const key = `${text}|${Math.round(maxW)}|${size}|${weight}|${family}|${italic}|fit`;
    if (s.key === key) return s;
    s.key = key;
    this.ctx.font = font(weight, size, family, italic);
    const tw = this.ctx.measureText(text).width;
    const sz = tw <= maxW ? size : Math.max(9, Math.floor((size * maxW) / tw * 10) / 10);
    s.size = sz;
    s.font = font(weight, sz, family, italic);
    s.lines = [text];
    return s;
  }

  // ── the band ────────────────────────────────────────────────────
  drawBand(sim: GlinaSim, t: number): void {
    const { ctx, L } = this, u = L.u, o = sim.order;
    if (!o) return;
    const y0 = L.hudY + 2, x0 = 12;
    const todayW = 92 * u;
    const chipW = Math.min(L.kind === 'portrait' ? L.w - 24 - todayW - 10 : L.card.w, 330 * u);
    const chipH = L.hudH - 6;
    cardBox(ctx, x0, y0, chipW, chipH, 0.92, 12);
    const name = cap(o.form.name);
    const nf = this.fit('chipName', name, chipW - 20, 17 * u, 500, SERIF);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = nf.font;
    ctx.fillText(name, x0 + 10, y0 + chipH * 0.44);
    const blockName = this.blockName(sim);
    const sub = `${blockName} · ${o.who}`;
    const sf = this.fit('chipSub', sub, chipW - 20, 11 * u, 650, SANS);
    ctx.font = sf.font;
    ctx.fillStyle = C.muted;
    ctx.fillText(sub, x0 + 10, y0 + chipH * 0.78);
    // the block's time: a thin bar along the chip's foot (the gate, the cut and the opening on play time)
    const bw = chipW - 20;
    ctx.fillStyle = 'rgba(59,42,34,.12)';
    ctx.fillRect(x0 + 10, y0 + chipH - 5, bw, 2);
    const blockColor = sim.phase === 'throw' ? (sim.blind ? '#8A7AA0' : C.terracotta) : sim.phase === 'fire' ? C.ember : C.olive;
    ctx.fillStyle = blockColor;
    ctx.fillRect(x0 + 10, y0 + chipH - 5, bw * sim.progress, 2);
    if (sim.phase === 'throw' && sim.progress > 0.86 && !sim.blind) {
      // the telegraph: the kiln comes next
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.fillStyle = C.ember;
      ctx.beginPath();
      ctx.arc(x0 + chipW - 9, y0 + 9, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // "Dziś": the session's centimetres
    const cm = Math.round(sim.cm);
    if (cm !== this.todayN) {
      this.todayN = cm;
      this.todayText = cmText(cm, true);
    }
    const tx = L.kind === 'portrait' ? L.w - 12 - todayW : x0 + chipW + 10;
    cardBox(ctx, tx, y0, todayW, chipH, 0.92, 12);
    ctx.textAlign = 'center';
    const lf = this.fit('todayLabel', TXT.today, todayW - 12, 10 * u, 700, SANS);
    ctx.font = lf.font;
    ctx.fillStyle = C.muted;
    ctx.fillText(TXT.today.toLocaleUpperCase(), tx + todayW / 2, y0 + chipH * 0.36);
    const vf = this.fit('todayValue', this.todayText, todayW - 12, 20 * u, 500, SERIF);
    ctx.font = vf.font;
    ctx.fillStyle = C.ink;
    ctx.fillText(this.todayText, tx + todayW / 2, y0 + chipH * 0.82);
  }

  private blockName(sim: GlinaSim): string {
    switch (sim.phase) {
      case 'gate': return TXT.gate;
      case 'throw': return sim.blind ? TXT.blind : TXT.throw;
      case 'cut': return TXT.cut;
      case 'fire': return sim.closed ? TXT.closed : TXT.fire;
      case 'open': return TXT.open;
      default: return TXT.finale;
    }
  }

  // ── the cards ───────────────────────────────────────────────────
  drawCards(sim: GlinaSim, time: number): void {
    const a = ease.outCubic(this.cardIn);
    switch (sim.phase) {
      case 'gate': if (sim.order) this.gateCard(sim.order, a); break;
      case 'throw': this.tipNote(sim); break;
      case 'cut': if (sim.cutCard) this.cutCard(sim, sim.cutCard, a, time); break;
      case 'fire': this.tipNote(sim); break;
      case 'open': if (sim.openCard) this.openCard(sim.openCard, a, sim.phaseT); break;
      case 'finale': case 'done': if (sim.finaleCard) this.finaleCard(sim.finaleCard, a); break;
      default: break;
    }
  }

  private zone(a: number, h?: number): Rect {
    const c = this.L.card;
    const hh = h ?? c.h;
    const y = c.y + (1 - a) * 10;
    cardBox(this.ctx, c.x, y, c.w, hh, a, 16);
    return { x: c.x, y, w: c.w, h: hh };
  }

  private gateCard(o: Order, a: number): void {
    const { ctx, L } = this, u = L.u;
    const r = this.zone(a);
    const pad = 14 * u, w = r.w - pad * 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    let y = r.y + pad + 10 * u;
    // who comes, and what this order is
    const tag = o.kind === 'daily' ? TXT.daily : o.kind === 'golden' ? TXT.golden : o.step ? t('gate.step', { n: o.step }) : '';
    const eyebrow = tag ? `${o.who} · ${tag}` : o.who;
    const ef = this.fit('gateWho', eyebrow.toLocaleUpperCase(), w, 11 * u, 750, SANS);
    ctx.font = ef.font;
    ctx.fillStyle = o.kind === 'daily' ? C.gold : o.kind === 'golden' ? '#B0702E' : C.terracotta;
    ctx.fillText(eyebrow.toLocaleUpperCase(), r.x + pad, y);
    // the request, in their words
    const say = t('gate.say', { line: o.line });
    const room = r.h - pad * 2 - 10 * u - 30 * u - (o.porcelain ? 16 * u : 0);
    const lines = Math.max(1, Math.min(3, Math.floor(room / (19 * u))));
    const sw = this.wrap('gateSay', say, w, 16 * u, 400, SERIF, true, lines, 11);
    ctx.font = sw.font;
    ctx.fillStyle = C.ink;
    const lh = sw.size * 1.28;
    for (let i = 0; i < Math.min(lines, sw.lines.length); i++) ctx.fillText(sw.lines[i], r.x + pad, y + 8 * u + lh * (i + 1));
    y = r.y + r.h - pad - (o.porcelain ? 16 * u : 0);
    // the form and its glaze
    const form = `${cap(o.form.name)} · ${GLAZE_NAME[o.glaze]}`;
    const ff = this.fit('gateForm', form, w - 22 * u, 13 * u, 700, SANS);
    ctx.font = ff.font;
    ctx.fillStyle = C.ink;
    glazeDot(ctx, r.x + pad + 6 * u, y - 4.5 * u, 6 * u, o.glaze);
    ctx.fillText(form, r.x + pad + 18 * u, y);
    if (o.porcelain) {
      const pf = this.fit('gatePorcelain', TXT.porcelain, w, 11.5 * u, 600, SANS);
      ctx.font = pf.font;
      ctx.fillStyle = C.muted;
      ctx.fillText(TXT.porcelain, r.x + pad, y + 16 * u);
    }
    ctx.restore();
  }

  private cutCard(sim: GlinaSim, c: CutCard, a: number, time: number): void {
    const { ctx, L } = this, u = L.u;
    const r = this.zone(a);
    const pad = 14 * u, w = r.w - pad * 2;
    const first = !!sim.order?.first;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    // the height, big, and the stars
    const hText = cmText(c.h);
    const hf = this.fit('cutH', hText, w * 0.5, 28 * u, 500, SERIF);
    ctx.font = hf.font;
    ctx.fillStyle = C.ink;
    const y1 = r.y + pad + 22 * u;
    ctx.fillText(hText, r.x + pad, y1);
    const hw = ctx.measureText(hText).width;
    for (let i = 0; i < 3; i++) star(ctx, r.x + pad + hw + 18 * u + i * 19 * u, y1 - 9 * u, 8 * u, i < c.stars, i < c.stars ? C.gold : 'rgba(59,42,34,.3)');
    // the shape and the honest near miss, or the blind reveal
    const shape = t('cut.shape', { pct: pctText(c.sim) });
    const near = c.next !== null ? t(c.next >= 0.9 || (first && c.next >= 0.85) ? 'cut.toThree' : 'cut.toTwo', { pct: pctText(c.next) }) : '';
    const line2 = c.blind ? t('cut.blind', { cm: cmText(c.h) }) : near ? `${shape} · ${near}` : shape;
    const f2 = this.fit('cut2', line2, w, 13 * u, 650, SANS);
    ctx.font = f2.font;
    ctx.fillStyle = c.blind ? '#6B5B73' : C.ink;
    ctx.fillText(line2, r.x + pad, y1 + 20 * u);
    const parts = [t('cut.wall', { grade: WALL_NAME[c.wall] })];
    if (c.centre) parts.push(TXT.centre);
    if (c.formBest) parts.push(TXT.formBest);
    if (c.blind) parts.splice(0, 0, shape);
    const line3 = parts.join(' · ');
    const f3 = this.fit('cut3', line3, w, 12.5 * u, 600, SANS);
    ctx.font = f3.font;
    ctx.fillStyle = C.muted;
    ctx.fillText(line3, r.x + pad, y1 + 38 * u);
    // the buckets: the order's glaze first (highlighted), a tap picks another
    const bs = this.bucketsAt(c.buckets.length);
    for (let i = 0; i < c.buckets.length; i++) bucket(ctx, bs[i], c.buckets[i], i === sim.pick, time, u);
    if (first) {
      const hint = HINT.glaze;
      const last = bs[bs.length - 1];
      const room = r.x + r.w - pad - (last.x + last.w + 10 * u);
      if (room > 60 * u) {
        const hw2 = this.wrap('cutHint', hint, room, 11.5 * u, 600, SANS, false, 3, 9);
        ctx.font = hw2.font;
        ctx.fillStyle = C.terracotta;
        hw2.lines.forEach((ln, i) => ctx.fillText(ln, last.x + last.w + 10 * u, last.y + 14 * u + i * hw2.size * 1.25));
      }
    } else {
      const gname = GLAZE_NAME[c.buckets[sim.pick] ?? c.buckets[0]];
      const label = `${TXT.glaze}: ${gname}`;
      const last = bs[bs.length - 1];
      const room = r.x + r.w - pad - (last.x + last.w + 10 * u);
      if (room > 50 * u) {
        const lf = this.fit('cutGlaze', label, room, 12 * u, 650, SANS);
        ctx.font = lf.font;
        ctx.fillStyle = C.muted;
        ctx.fillText(label, last.x + last.w + 10 * u, last.y + last.h / 2 + 4 * u);
      }
    }
    ctx.restore();
  }

  private openCard(c: OpenCard, a: number, phaseT: number): void {
    const { ctx, L } = this, u = L.u;
    const r = this.zone(a);
    const pad = 14 * u, w = r.w - pad * 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const formName = cap(FORM[c.rec.f].name);
    const title = c.first ? TXT.first : c.isNew ? TXT.isNew : formName;
    const tf = this.fit('openTitle', title, w, 19 * u, 500, SERIF, true);
    ctx.font = tf.font;
    ctx.fillStyle = C.ink;
    let y = r.y + pad + 16 * u;
    ctx.fillText(title, r.x + pad, y);
    // at most three lines: the glaze and its runs, the calm fire, a kiln gift, Druga forma, the new page's form
    const lines: { text: string; accent: boolean }[] = [{ text: t('kiln.runs', { glaze: GLAZE_NAME[c.rec.glaze], runs: RUN_NAME[c.band] }), accent: false }];
    if (c.calm) lines.push({ text: TXT.calm, accent: true });
    if (c.gift) lines.push({ text: t('open.gift', { gift: KILN_GIFT_NAME[c.gift] }), accent: true });
    if (c.rec.second) lines.push({ text: TXT.second, accent: false });
    if ((c.first || c.isNew) && lines.length < 3) lines.push({ text: formName, accent: false });
    const room = r.h - pad * 2 - 16 * u - 40 * u;
    const nl = Math.max(1, Math.min(lines.length, 3, Math.floor(room / (16 * u))));
    for (let i = 0; i < nl; i++) {
      const lf = this.fit(`open${i}`, lines[i].text, w, 12.5 * u, i === 0 ? 650 : 600, SANS);
      ctx.font = lf.font;
      ctx.fillStyle = i === 0 ? C.ink : lines[i].accent ? '#9A5A2A' : C.muted;
      y += 17 * u;
      ctx.fillText(lines[i].text, r.x + pad, y);
    }
    // the neighbour's thanks, once the vessel has come out of the steam
    const k = clamp((phaseT - 0.9) / 0.4);
    if (k > 0) {
      ctx.globalAlpha = a * k;
      const say = t('open.thanks', { who: c.who, line: c.thanks });
      const sw = this.wrap('openThanks', say, w, 13 * u, 400, SERIF, true, 2, 10);
      ctx.font = sw.font;
      ctx.fillStyle = '#5A3A28';
      const lh = sw.size * 1.25;
      const n = Math.min(2, sw.lines.length);
      for (let i = 0; i < n; i++) ctx.fillText(sw.lines[i], r.x + pad, r.y + r.h - pad - (n - 1 - i) * lh);
    }
    ctx.restore();
  }

  private finaleCard(c: FinaleCard, a: number): void {
    const { ctx, L } = this, u = L.u;
    const rows = 2 + (c.gift ? 1 : 0) + (c.enough ? 1 : 0);
    const h = Math.min(L.card.h, (34 + rows * 19) * u + 14);
    const r = this.zone(a, h);
    const pad = 14 * u, w = r.w - pad * 2;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const tf = this.fit('finTitle', TXT.finale, w, 20 * u, 500, SERIF, true);
    ctx.font = tf.font;
    ctx.fillStyle = C.ink;
    let y = r.y + pad + 16 * u;
    ctx.fillText(TXT.finale, r.x + pad, y);
    const day = t('fin.day', { vessels: t('vessels', { n: c.vessels }), cm: cmText(c.cm, true) });
    const df = this.fit('finDay', day, w, 13.5 * u, 650, SANS);
    ctx.font = df.font;
    y += 22 * u;
    ctx.fillText(day, r.x + pad, y);
    if (c.gift) {
      const g = t('fin.gift', { gift: DAY_GIFT_NAME[c.gift] });
      const gw = this.wrap('finGift', g, w, 12.5 * u, 600, SANS, false, 2, 10);
      ctx.font = gw.font;
      ctx.fillStyle = '#9A5A2A';
      for (const ln of gw.lines.slice(0, 2)) {
        y += gw.size * 1.35;
        ctx.fillText(ln, r.x + pad, y);
      }
    }
    if (c.enough) {
      const ef = this.fit('finEnough', TXT.enough, w, 13 * u, 400, SERIF, true);
      ctx.font = ef.font;
      ctx.fillStyle = C.muted;
      y += 19 * u;
      ctx.fillText(TXT.enough, r.x + pad, y);
    }
    ctx.restore();
  }

  /** The coaching line at a block's start, a calm note in the card zone that fades after a few seconds. */
  private tipNote(sim: GlinaSim): void {
    if (!sim.tip) return;
    const k = Math.min(1, sim.tipT / 0.4) * clamp((6 - sim.tipT) / 0.8);
    if (k <= 0) return;
    const { ctx, L } = this, u = L.u;
    const c = L.card, pad = 12 * u;
    const tw = this.wrap('tip', sim.tip, c.w - pad * 2, 14 * u, 400, SERIF, true, 2, 10);
    const h = pad * 2 + tw.lines.length * tw.size * 1.3;
    cardBox(ctx, c.x, c.y, c.w, h, 0.86 * k, 14);
    ctx.save();
    ctx.globalAlpha = k;
    ctx.font = tw.font;
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    tw.lines.forEach((ln, i) => ctx.fillText(ln, c.x + pad, c.y + pad + tw.size * (1 + i * 1.3) - 2));
    ctx.restore();
  }

  // ── the hint above the clay, the floaters ───────────────────────
  /** A first-session hint in a pill above the vessel's rim (or high on the stage). */
  drawHint(sim: GlinaSim, rimY: number, t: number): void {
    const key = sim.hint;
    if (!key || key === 'glaze') return;
    const { ctx, L } = this, u = L.u;
    const text = HINT[key];
    const maxW = Math.min(L.w - 32, L.halfW * 2.1);
    const hw = this.wrap('hint', text, maxW - 24 * u, 14 * u, 650, SANS, false, 3, 10);
    ctx.font = hw.font;
    let tw = 0;
    for (const ln of hw.lines) tw = Math.max(tw, ctx.measureText(ln).width);
    const bw = tw + 24 * u, bh = hw.lines.length * hw.size * 1.3 + 14 * u;
    const cx = key === 'kiln' ? L.axis : L.axis;
    let y = rimY - bh - 26 * u;
    y = Math.max(L.card.y + (L.kind === 'portrait' ? L.card.h + 6 : 0), Math.min(y, L.foot - bh - 40 * u));
    const k = Math.min(1, sim.hintT / 0.3), pulse = 1 + 0.03 * Math.sin(t * 4);
    ctx.save();
    ctx.globalAlpha = k;
    const x = clamp(cx - bw / 2, 12, L.w - bw - 12);
    cardBox(ctx, x, y, bw, bh, 0.95, bh / 2.4, 'rgba(255,252,246,.96)');
    ctx.fillStyle = C.terracotta;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    hw.lines.forEach((ln, i) => ctx.fillText(ln, x + bw / 2, y + 7 * u + hw.size * (1 + i * 1.3) - 2));
    if (key === 'pull') {
      // a chalk arrow on the clay, pulsing upward
      const ax = L.axis, ay = rimY - 6 * u - 8 * u * ((t * 1.4) % 1);
      ctx.strokeStyle = C.chalk;
      ctx.lineWidth = 3 * u * pulse;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ax, ay + 22 * u);
      ctx.lineTo(ax, ay);
      ctx.moveTo(ax - 8 * u, ay + 8 * u);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + 8 * u, ay + 8 * u);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFloats(): void {
    const { ctx } = this;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const y = f.y - 34 * this.L.u * ease.outCubic(k);
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : Math.min(1, k / 0.12);
      ctx.font = font(500, f.size, SERIF, true);
      ctx.fillStyle = 'rgba(255,250,240,.7)';
      ctx.fillText(f.text, f.x + 1, y + 1.5);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.restore();
  }

  /** The ruler's numbers (the view draws its ticks). */
  rulerLabel(text: string, x: number, y: number, color: string, size: number, align: CanvasTextAlign = 'left'): number {
    const { ctx } = this;
    ctx.font = font(650, size, SANS);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return ctx.measureText(text).width;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
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

function glazeDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, g: GlazeId): void {
  ctx.fillStyle = GLAZE[g].c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(59,42,34,.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A glaze bucket: a wooden rim, the glaze inside with a highlight; the picked one ringed. */
function bucket(ctx: CanvasRenderingContext2D, r: Rect, g: GlazeId, on: boolean, t: number, u: number): void {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = r.w / 2;
  ctx.save();
  if (on) {
    ctx.strokeStyle = C.terracotta;
    ctx.lineWidth = 2.5 * u;
    ctx.globalAlpha *= 0.75 + 0.25 * Math.sin(t * 5);
    ctx.beginPath();
    ctx.arc(cx, cy, rad + 3.5 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = '#7A5238';
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();
  const gg = ctx.createRadialGradient(cx - rad * 0.3, cy - rad * 0.35, 0, cx, cy, rad * 0.85);
  gg.addColorStop(0, '#FFFFFF');
  gg.addColorStop(0.18, GLAZE[g].c);
  gg.addColorStop(1, GLAZE[g].pool);
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.arc(cx, cy, rad * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Words for the view's small labels. */
export const LABEL = {
  line: t('hud.line'), best: t('hud.best'), dusk: t('hud.dusk'), centre: t('fx.centre'), second: t('fx.second'),
  nextWheel: TXT.nextWheel, nextKiln: TXT.nextKiln,
};
