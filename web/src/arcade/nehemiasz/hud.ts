/**
 * Nehemiasz's own bits of the screen (the runner draws the Mendi panel and the score): the stores'
 * bar (stone, beams, bread, people, strength), the guide's chip ("Następne: …" by day, the night's
 * tally after dark), the ram's horn's dial (its charge, gold and pulsing when ready), the story cards
 * (with a passage when the story has one), the choice cards (a decree, a tower's way) and the short
 * banner of the game's own news.  Canvas only; hit-tests for the cards.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageId } from '../kit/scripture';
import { GATES, decreeFx, decreeName, decreeRef, gateDays, gateName, kindName, markerSpec, tierName, type DecreeId } from './content';
import { t } from './i18n';
import type { Layout, Rect } from './layout';
import { room, stoneCap } from './meta';
import {
  C, SANS, SERIF, font, paintBreadIcon, paintHeartIcon, paintHornIcon, paintPeopleIcon, paintStoneIcon, paintTimberIcon, roundRect,
} from './paint';
import { RULES } from './rules';
import type { NehSim, Story } from './sim';

export interface Banner { text: string; color: string; t: number; dur: number; big: boolean }

const STORY_VERSE: Partial<Record<Story['kind'], PassageId>> = {
  open: 'neh2.18', ono: 'neh6.3', wall: 'neh6.15', dedication: 'neh8.10', year: 'isa58.12',
};

export class Hud {
  /** the choice cards as drawn (for taps) */
  cards: Rect[] = [];
  private storyKey = '';
  private storyLayout: ReturnType<typeof layoutPassage> | null = null;
  private pulse = 0;

  update(dt: number): void { this.pulse += dt; }

  cardAt(x: number, y: number): number {
    return this.cards.findIndex(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
  }

  draw(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, banner: Banner | null): void {
    this.bar(ctx, sim, L);
    this.guide(ctx, sim, L);
    if (sim.nightTime) this.horn(ctx, sim, L);
    if (banner) this.drawBanner(ctx, L, banner);
    this.cards = [];
    if (sim.story) this.story(ctx, sim, L);
    else if (sim.choice) this.choice(ctx, sim, L);
  }

  // ── the stores' bar ─────────────────────────────────────────────
  private bar(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const p = sim.p, b = L.bar, u = L.u;
    ctx.save();
    ctx.fillStyle = 'rgba(28,20,14,.62)';
    roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fill();
    const items: { icon: (x: number, y: number, r: number) => void; text: string; warn: boolean }[] = [
      { icon: (x, y, r) => paintStoneIcon(ctx, x, y, r), text: String(Math.floor(p.stone)), warn: p.stone >= stoneCap(p) - 0.5 },
      { icon: (x, y, r) => paintTimberIcon(ctx, x, y, r), text: String(Math.floor(p.timber)), warn: p.timber < 1 },
      { icon: (x, y, r) => paintBreadIcon(ctx, x, y, r), text: String(Math.floor(p.bread)), warn: p.bread < p.people },
      { icon: (x, y, r) => paintPeopleIcon(ctx, x, y, r), text: `${p.people}/${room(p)}`, warn: false },
      { icon: (x, y, r) => paintHeartIcon(ctx, x, y, r, p.strength), text: `${Math.round(p.strength * 100)}%`, warn: p.strength < 0.5 },
    ];
    const end = L.narrow ? b.x + b.w : L.guide.x - 6;
    const slot = (end - b.x - 10) / items.length;
    const r = Math.min(b.h * 0.26, 9 * u);
    ctx.font = font(Math.min(15, b.h * 0.42), 750);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    items.forEach((it, i) => {
      const x = b.x + 10 + i * slot + r + 2, y = b.y + b.h / 2;
      it.icon(x, y, r);
      ctx.fillStyle = it.warn ? '#ffb39a' : '#fff4dc';
      ctx.fillText(it.text, x + r + 5, y + 1);
    });
    ctx.restore();
  }

  // ── the guide's chip ────────────────────────────────────────────
  private guide(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const g = L.guide, u = L.u;
    let label: string, sub = '', on = false, cost: { stone: number; timber: number } | null = null;
    if (sim.nightTime) {
      label = `${t('stat.driven')}: ${sim.driven}`;
      sub = gateName(sim.p.gate);
    } else if (sim.guideId) {
      const mv = sim.markerView(sim.guideId);
      const m = markerSpec(sim.guideId)!;
      label = `${t('hud.next')}: ${mv.next !== null ? tierName(m.kind, mv.next) : kindName(m.kind)}`;
      cost = mv.cost;
      on = true;
    } else {
      label = t('hud.nextNone');
    }
    ctx.save();
    ctx.fillStyle = on ? 'rgba(255,236,190,.95)' : 'rgba(28,20,14,.62)';
    roundRect(ctx, g.x, g.y, g.w, g.h, g.h / 2);
    ctx.fill();
    if (on) {
      ctx.strokeStyle = `rgba(214,150,40,${0.55 + 0.35 * Math.sin(this.pulse * 4)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const fs = Math.min(14 * u, g.h * 0.42);
    ctx.font = font(fs, 750);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = on ? C.ink : '#fff4dc';
    let x = g.x + g.h * 0.45;
    if (on) {
      ctx.fillText('▶', x, g.y + g.h / 2 + 1);
      x += fs * 1.1;
    }
    // the cost at the right end
    let right = g.x + g.w - g.h * 0.4;
    if (cost) {
      const r = fs * 0.45;
      ctx.font = font(fs * 0.95, 800);
      ctx.textAlign = 'right';
      const parts: [number, (x: number, y: number, r: number) => void][] = [];
      if (cost.timber > 0) parts.push([cost.timber, (xx, yy, rr) => paintTimberIcon(ctx, xx, yy, rr)]);
      if (cost.stone > 0) parts.push([cost.stone, (xx, yy, rr) => paintStoneIcon(ctx, xx, yy, rr)]);
      for (const [n, icon] of parts) {
        ctx.fillStyle = C.ink;
        ctx.fillText(String(n), right, g.y + g.h / 2 + 1);
        right -= ctx.measureText(String(n)).width + r + 4;
        icon(right, g.y + g.h / 2, r);
        right -= r + 8;
      }
      ctx.textAlign = 'left';
      ctx.font = font(fs, 750);
    }
    const room = right - x - 4;
    let text = label;
    while (text.length > 4 && ctx.measureText(text).width > room) text = `${text.slice(0, -2)}…`;
    ctx.fillStyle = on ? C.ink : '#fff4dc';
    ctx.fillText(text, x, g.y + g.h / 2 + 1);
    if (sub && !L.narrow) {
      ctx.textAlign = 'right';
      ctx.globalAlpha = 0.7;
      ctx.fillText(sub, g.x + g.w - g.h * 0.4, g.y + g.h / 2 + 1);
    }
    ctx.restore();
  }

  // ── the horn's dial ─────────────────────────────────────────────
  private horn(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const { x, y, r } = L.horn;
    const ready = sim.hornReady;
    ctx.save();
    const pop = ready ? 1 + 0.06 * Math.sin(this.pulse * 7) : 1;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.fillStyle = ready ? 'rgba(80,50,10,.85)' : 'rgba(20,18,36,.7)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = Math.max(3, r * 0.16);
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ready ? C.gold : '#ffe2a8';
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(sim.horn));
    ctx.stroke();
    paintHornIcon(ctx, -r * 0.05, r * 0.05, r * 0.55, ready ? C.goldLight : '#d8c9a6');
    ctx.restore();
    ctx.save();
    ctx.font = font(Math.max(10, r * 0.42), 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = ready ? C.gold : 'rgba(255,244,220,.75)';
    ctx.fillText(ready ? t('hud.hornTap') : t('hud.horn'), x, y + r + 3);
    ctx.restore();
  }

  // ── the banner (the game's own news) ────────────────────────────
  private drawBanner(ctx: CanvasRenderingContext2D, L: Layout, b: Banner): void {
    const k = b.t / b.dur;
    const a = k < 0.12 ? k / 0.12 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const y = L.top + (L.bottom - L.top) * 0.6;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font((b.big ? 30 : 20) * L.u * pop, 800, b.big ? SERIF : SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(L.w - 20, ctx.measureText(b.text).width + 28 * L.u);
    const h = (b.big ? 46 : 34) * L.u;
    ctx.fillStyle = 'rgba(25,18,12,.55)';
    roundRect(ctx, L.w / 2 - w / 2, y - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    let text = b.text;
    while (text.length > 4 && ctx.measureText(text).width > w - 18) text = `${text.slice(0, -2)}…`;
    ctx.fillText(text, L.w / 2, y + 1);
    ctx.restore();
  }

  // ── the story cards ─────────────────────────────────────────────
  private story(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const s = sim.story!;
    const u = L.u;
    const a = clamp(s.t / 0.35);
    const cw = Math.min(L.w - 24, 560 * u);
    const verse = STORY_VERSE[s.kind];
    let title = '', kicker = '', text = '';
    switch (s.kind) {
      case 'open': title = t('story.open.title'); text = t('story.open.text'); kicker = gateName(0); break;
      case 'gate':
        title = t('story.gate.title', { gate: gateName(s.gate) });
        kicker = t('story.gate.kicker', { n: (s.gate % GATES.length) + 1, days: gateDays(s.gate) });
        text = t(`gate.${GATES[s.gate % GATES.length]}.story` as Parameters<typeof t>[0]);
        break;
      case 'done':
        title = t('story.done.title', { gate: gateName(s.gate) });
        kicker = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars);
        text = t('story.done.text', { gate: gateName(s.gate), next: gateName(s.next) });
        break;
      case 'horn': title = t('story.horn.title'); text = t('story.horn.text'); break;
      case 'ono': title = t('story.ono.title'); text = t('story.ono.text'); break;
      case 'wall': title = t('story.wall.title'); text = t('story.wall.text'); kicker = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars); break;
      case 'dedication': title = t('story.dedication.title'); text = t('story.dedication.text'); break;
      case 'year': title = t('story.year.title', { n: s.year + 1 }); text = t('story.year.text'); break;
    }
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,12,24,.55)';
    ctx.fillRect(0, 0, L.w, L.h);
    // measure
    ctx.font = font(15 * u, 500, SANS);
    const lines = wrap(ctx, text, cw - 44 * u);
    const lh = 21 * u;
    let vh = 0;
    const key = `${s.kind}:${verse ?? ''}:${Math.round(cw)}`;
    if (verse && this.storyKey !== key) {
      this.storyKey = key;
      this.storyLayout = layoutPassage(ctx, passage(verse), cw - 52 * u, 120 * u, { max: 17 * u, min: 11 });
    }
    if (verse && this.storyLayout) vh = this.storyLayout.height + 16 * u;
    const ch = 28 * u + (kicker ? 20 * u : 0) + 36 * u + lines.length * lh + vh + 34 * u;
    const top = Math.max(L.top * 0.6, (L.h - ch) / 2 - 10 * u);
    const x = (L.w - cw) / 2;
    const pop = ease.outBack(clamp(s.t / 0.35));
    ctx.translate(L.w / 2, top + ch / 2);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
    ctx.translate(-L.w / 2, -(top + ch / 2));
    ctx.fillStyle = C.paper;
    roundRect(ctx, x, top, cw, ch, 18 * u);
    ctx.fill();
    ctx.strokeStyle = C.paperEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    let y = top + 24 * u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (kicker) {
      ctx.font = font(12.5 * u, 800);
      ctx.fillStyle = '#a5743a';
      ctx.fillText(kicker.toUpperCase(), L.w / 2, y);
      y += 20 * u;
    }
    ctx.font = font(26 * u, 600, SERIF);
    ctx.fillStyle = C.ink;
    ctx.fillText(title, L.w / 2, y);
    y += 38 * u;
    ctx.font = font(15 * u, 500, SANS);
    ctx.fillStyle = '#4a3a2c';
    for (const line of lines) {
      ctx.fillText(line, L.w / 2, y);
      y += lh;
    }
    if (verse && this.storyLayout) {
      y += 10 * u;
      drawPassage(ctx, passage(verse), this.storyLayout, L.w / 2, y, { text: '#5a3f22', ref: '#a5743a' });
      y += this.storyLayout.height;
    }
    ctx.font = font(12 * u, 700);
    ctx.fillStyle = `rgba(120,90,50,${s.t >= RULES.minCard ? 0.85 : 0.35})`;
    ctx.fillText(t('hud.tap'), L.w / 2, top + ch - 26 * u);
    ctx.restore();
  }

  // ── the choice cards ────────────────────────────────────────────
  private choice(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const c = sim.choice!;
    const u = L.u;
    const n = c.options.length;
    const stack = L.narrow;
    const cw = stack ? Math.min(L.w - 28, 380 * u) : Math.min((L.w - 40) / n - 12, 290 * u);
    const chh = stack ? 92 * u : 156 * u;
    const gap = 12 * u;
    const totalW = stack ? cw : n * cw + (n - 1) * gap;
    const totalH = stack ? n * chh + (n - 1) * gap : chh;
    const head = 36 * u;
    const top = Math.max(L.top + 4, (L.top + L.bottom) / 2 - (totalH + head) / 2);
    const a = clamp(c.t / 0.3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,12,24,.45)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.font = font(20 * u, 650, SERIF);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff4dc';
    const headText = c.kind === 'decree' ? t('hud.decree') : `${kindName('tower')} · ${t('hud.choose')}`;
    ctx.fillText(headText, L.w / 2, top);
    const x0 = (L.w - totalW) / 2, y0 = top + head;
    c.options.forEach((opt, i) => {
      const x = stack ? x0 : x0 + i * (cw + gap), y = stack ? y0 + i * (chh + gap) : y0;
      this.cards.push({ x, y, w: cw, h: chh });
      const pop = ease.outBack(clamp((c.t - i * 0.06) / 0.3));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.fillStyle = i === 0 ? '#fff1cf' : C.paper;
      roundRect(ctx, x, y, cw, chh, 14 * u);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? '#d6a24a' : C.paperEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
      let name = '', ref = '', fx = '';
      if (c.kind === 'decree') {
        name = decreeName(opt as DecreeId);
        ref = decreeRef(opt as DecreeId);
        fx = decreeFx(opt as DecreeId);
      } else {
        name = t(opt === 'quick' ? 'tower.quick' : 'tower.far');
        fx = opt === 'quick'
          ? t('tower.quick.text', { s: fmtNum(RULES.towerEvery[2] * RULES.towerQuick, 2), t: fmtNum(RULES.towerEvery[2], 2) })
          : t('tower.far.text');
        ref = markerSpec(c.marker ?? 't0') ? tierName('tower', 2) : '';
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const pad = 14 * u;
      ctx.font = font(11.5 * u, 800);
      ctx.fillStyle = '#a5743a';
      ctx.fillText(ref.toUpperCase(), x + pad, y + pad);
      ctx.font = font(17 * u, 650, SERIF);
      ctx.fillStyle = C.ink;
      const nameLines = wrap(ctx, name, cw - 2 * pad).slice(0, 2);
      nameLines.forEach((l, k) => ctx.fillText(l, x + pad, y + pad + 17 * u + k * 21 * u));
      ctx.font = font(13 * u, 600);
      ctx.fillStyle = '#5a4632';
      const fxTop = y + pad + 17 * u + nameLines.length * 21 * u + 4 * u;
      const fxLines = wrap(ctx, fx, cw - 2 * pad).slice(0, stack ? 2 : 4);
      fxLines.forEach((l, k) => ctx.fillText(l, x + pad, fxTop + k * 17 * u));
      ctx.restore();
    });
    ctx.restore();
  }
}

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
