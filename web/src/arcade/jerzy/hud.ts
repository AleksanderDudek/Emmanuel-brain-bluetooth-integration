/**
 * Jerzy i smok's own bits over the field, drawn on the canvas — never the band's panel nor the score
 * (the runner draws those): the hearts, the level's bar, the run's build, the Miecz światła's dial,
 * the dragon's bar and the short banners; the level-up's three cards with their numbers (and where
 * they are, for a tap); the run's tally; the story cards; Linda's speech bubble.
 */
import { fmtNum } from '../../i18n';
import { ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { WEAPONS, dragonName, gearStats, isWeapon, itemName, townName, townStory, weaponStats, type GearId, type WeaponId } from './content';
import { t, scales as scalesText } from './i18n';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, glow, paintApple, paintItemIcon, paintScale } from './paint';
import { RULES } from './rules';
import type { Card, JerzySim } from './sim';
import { xpNeed } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/), out: string[] = [];
  let line = '';
  for (const w of words) {
    const tryL = line ? `${line} ${w}` : w;
    if (ctx.measureText(tryL).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = tryL;
  }
  if (line) out.push(line);
  return out;
}

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke: string | null, rad: number): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: number): void {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.85);
    ctx.bezierCurveTo(x - r * 1.3, y - r * 0.1, x - r * 0.6, y - r * 1.05, x, y - r * 0.35);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.05, x + r * 1.3, y - r * 0.1, x, y + r * 0.85);
  };
  path();
  ctx.fillStyle = 'rgba(40,20,20,.45)';
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = C.vermilion;
    ctx.fillRect(x - r * 1.4, y - r * 1.1, r * 2.8 * Math.min(1, fill), r * 2.2);
    ctx.restore();
  }
  path();
  ctx.strokeStyle = 'rgba(255,245,225,.9)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

export class Hud {
  /** the cards' rects this frame (for a tap) */
  cards: Rect[] = [];
  private passage: { id: string; l: PassageLayout; w: number } | null = null;

  /** Which card a tap at (x, y) lands on (−1: none). */
  cardAt(x: number, y: number): number {
    return this.cards.findIndex(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  /** The hearts, the level's bar, the build, the sword's dial. */
  drawBars(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number, pop: number): void {
    const u = L.u, k = sim.knight;
    // the level's bar
    const xp = L.xp;
    panel(ctx, { x: xp.x - 2, y: xp.y - 2, w: xp.w + 4, h: xp.h + 4 }, 'rgba(30,26,40,.6)', null, (xp.h + 4) / 2);
    const fill = sim.levelProgress;
    const g = ctx.createLinearGradient(xp.x, 0, xp.x + xp.w, 0);
    g.addColorStop(0, '#c8901c');
    g.addColorStop(1, '#ffe08a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * fill), xp.h, xp.h / 2);
    ctx.fill();
    ctx.font = font(800, 12 * u, SANS);
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(`${fmtNum(Math.floor(sim.run.xp))} / ${fmtNum(xpNeed(sim.run.level))}`, xp.x + xp.w, xp.y - 3);
    ctx.textAlign = 'left';
    ctx.font = font(800, (13 + 4 * pop) * u, SANS);
    ctx.fillText(t('hud.level', { n: sim.run.level }), xp.x, xp.y - 3);
    // hearts (half hearts show)
    const hr = 8.5 * u, gap = hr * 2.5;
    const lw = ctx.measureText(t('hud.level', { n: sim.run.level })).width;
    let hx = xp.x + lw + 16 * u + hr;
    const hy = xp.y - 10 * u;
    for (let i = 0; i < k.max; i++) {
      heart(ctx, hx, hy, hr * (k.hit > 0 && i === Math.floor(k.hearts) ? 1.2 : 1), Math.max(0, Math.min(1, k.hearts - i)));
      hx += gap;
    }
    for (let i = 0; i < sim.run.apples; i++) {
      paintApple(ctx, hx + 2 * u, hy, hr * 0.85);
      hx += gap * 0.9;
    }
    // the build: weapons, then gear (not on a very short screen)
    let bx = xp.x, by = L.buildY;
    const showBuild = L.h >= 340;
    const br = 11 * u;
    for (const it of showBuild ? sim.build : []) {
      panel(ctx, { x: bx, y: by - br, w: br * 2, h: br * 2 }, isWeapon(it.id) ? 'rgba(30,26,40,.62)' : 'rgba(47,79,158,.55)', it.level >= 6 ? C.gold : null, 6 * u);
      paintItemIcon(ctx, it.id, bx + br, by, br * 0.62, it.level >= 6);
      ctx.font = font(800, 9 * u, SANS);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = it.level >= 6 ? C.goldLight : '#fff';
      ctx.fillText(it.level >= 6 ? '★' : String(it.level), bx + br * 2 - 2, by + br - 2);
      bx += br * 2 + 4 * u;
    }
    // the sword's dial
    const sw = L.sword;
    ctx.save();
    if (sim.swordReady) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sw.x, sw.y, sw.r * (2 + 0.3 * Math.sin(now * 6)), 'rgba(255,220,130,', 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.fillStyle = 'rgba(30,26,40,.7)';
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = sim.swordReady ? C.goldLight : C.gold;
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r - 3 * u, -Math.PI / 2, -Math.PI / 2 + TAU * sim.charge);
    ctx.stroke();
    // the blade
    ctx.strokeStyle = sim.swordReady ? '#fffbe8' : C.steel;
    ctx.lineWidth = 3 * u;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sw.x - sw.r * 0.35, sw.y + sw.r * 0.35);
    ctx.lineTo(sw.x + sw.r * 0.4, sw.y - sw.r * 0.4);
    ctx.stroke();
    ctx.strokeStyle = C.goldDeep;
    ctx.beginPath();
    ctx.moveTo(sw.x - sw.r * 0.4, sw.y + sw.r * 0.05);
    ctx.lineTo(sw.x - sw.r * 0.05, sw.y + sw.r * 0.4);
    ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = font(800, (sim.swordReady ? 13 : 10.5) * u, SANS);
    ctx.fillStyle = sim.swordReady ? C.goldLight : 'rgba(255,248,230,.85)';
    const label = sim.swordReady ? t('hud.swordTap') : t('hud.sword');
    ctx.fillText(label, Math.min(sw.x, L.w - ctx.measureText(label).width / 2 - 6), sw.y - sw.r - 4 * u);
  }

  /** The dragon's bar while he is around (or flying off for his nap). */
  drawBoss(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim): void {
    const b = sim.boss;
    if (b.state === 'away') return;
    const r = L.boss, u = L.u;
    panel(ctx, r, 'rgba(30,26,40,.7)', null, 8 * u);
    const pad = 8 * u;
    ctx.font = font(700, 12 * u, SERIF);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff3d6';
    const name = cap(dragonName(b.spec.kind));
    ctx.fillText(name, r.x + pad, r.y + r.h / 2);
    const nx = r.x + pad + ctx.measureText(name).width + 10 * u;
    const bw = r.x + r.w - pad - nx, bh = 8 * u, by = r.y + (r.h - bh) / 2;
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(nx, by, bw, bh);
    const left = 1 - b.damage / b.all;
    ctx.fillStyle = b.state === 'flaw' ? C.goldLight : C.vermilion;
    ctx.fillRect(nx, by, bw * left, bh);
    ctx.fillStyle = 'rgba(30,26,40,.9)';
    for (let i = 1; i < 3; i++) ctx.fillRect(nx + (bw * i) / 3 - 1, by, 2, bh);
  }

  /** A short banner in the middle of the band (wave, the dragon, a chest). */
  drawBanner(ctx: CanvasRenderingContext2D, L: Layout, text: string, k: number, color: string): void {
    if (!text || k <= 0) return;
    const u = L.u;
    const a = k < 0.15 ? k / 0.15 : k > 0.8 ? (1 - k) / 0.2 : 1;
    const sc = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(L.w / 2, L.bannerY);
    ctx.scale(sc, sc);
    ctx.font = font(800, 24 * u, SERIF, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 5 * u;
    ctx.strokeStyle = 'rgba(30,20,20,.55)';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** The level-up: three cards with their numbers. */
  drawChoice(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number): void {
    const ch = sim.choice;
    this.cards = [];
    if (!ch) return;
    const u = L.u, k = Math.min(1, ch.t / 0.25);
    ctx.fillStyle = `rgba(20,16,28,${0.55 * k})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const title = ch.source === 'rest' ? t('choice.rest') : t('choice.level', { n: sim.run.level });
    const n = ch.cards.length;
    const areaTop = L.top + 8 * u, areaBot = L.bottom - 8 * u;
    // a phone on its side: little height, so the cards lie in a row, each drawn like a narrow one
    const short = !L.narrow && areaBot - areaTop < 300 * u;
    let cw: number, chh: number, positions: { x: number; y: number }[];
    if (short) {
      const bot = L.h - 50;
      cw = Math.min(250 * u, (L.w - 40) / n - 10);
      chh = Math.max(64, Math.min(120 * u, bot - areaTop - 40 * u));
      const total = n * cw + (n - 1) * 10;
      positions = ch.cards.map((_, i) => ({ x: (L.w - total) / 2 + i * (cw + 10), y: areaTop + 30 * u }));
    } else if (L.narrow) {
      cw = Math.min(L.w - 28, 360);
      chh = Math.min(118 * u, (areaBot - areaTop - 70 * u) / n - 10 * u);
      const total = n * chh + (n - 1) * 10 * u;
      const y0 = areaTop + 48 * u + Math.max(0, (areaBot - areaTop - 70 * u - total) / 2);
      positions = ch.cards.map((_, i) => ({ x: (L.w - cw) / 2, y: y0 + i * (chh + 10 * u) }));
    } else {
      cw = Math.min(230 * u, (L.w - 60) / n - 16);
      chh = Math.min(215 * u, areaBot - areaTop - 90 * u);
      const total = n * cw + (n - 1) * 16 * u;
      const y0 = areaTop + 50 * u + Math.max(0, (areaBot - areaTop - 90 * u - chh) / 2);
      positions = ch.cards.map((_, i) => ({ x: (L.w - total) / 2 + i * (cw + 16 * u), y: y0 }));
    }
    const titleY = positions[0].y - (short ? 16 : 30) * u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(800, (short ? 18 : 24) * u, SERIF, true);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(title, L.w / 2, titleY);
    if (ch.gold && !short) {
      ctx.font = font(700, 12 * u, SANS);
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(t('choice.gold'), L.w / 2, titleY + 18 * u);
    }
    ch.cards.forEach((card, i) => {
      const p = positions[i];
      const pop = ease.outBack(Math.min(1, Math.max(0, (ch.t - i * 0.06) / 0.3)));
      const r = { x: p.x, y: p.y, w: cw, h: chh };
      this.cards.push(r);
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(pop, pop);
      ctx.translate(-r.w / 2, -r.h / 2);
      this.drawCard(ctx, { x: 0, y: 0, w: r.w, h: r.h }, card, sim, ch.gold, i, u, L.narrow || short, now);
      ctx.restore();
    });
    // the auto-pick countdown on the first card, and the hint
    const left = Math.max(0, RULES.choiceSec - ch.t);
    const r0 = this.cards[0];
    ctx.fillStyle = C.gold;
    ctx.fillRect(r0.x + 10 * u, r0.y + r0.h - 6 * u, (r0.w - 20 * u) * (left / RULES.choiceSec), 3 * u);
    const last = this.cards[this.cards.length - 1];
    ctx.font = font(600, 12 * u, SANS);
    ctx.fillStyle = 'rgba(255,248,230,.85)';
    ctx.textAlign = 'center';
    if (!short) ctx.fillText(t('choice.hint'), L.w / 2, Math.min(L.bottom - 4, last.y + last.h + 16 * u));
  }

  private drawCard(ctx: CanvasRenderingContext2D, r: Rect, card: Card, sim: JerzySim, gold: boolean, i: number, u: number, narrow: boolean, now: number): void {
    const evo = card.kind === 'evo';
    panel(ctx, r, evo ? '#fff4cf' : '#f6ecd2', evo || gold ? C.gold : 'rgba(120,90,40,.35)', 12 * u);
    if (evo) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, r.x + r.w / 2, r.y + r.h * 0.3, r.w * 0.6, 'rgba(255,200,90,', 0.2 + 0.1 * Math.sin(now * 4));
      ctx.restore();
    }
    const pad = 12 * u;
    ctx.fillStyle = 'rgba(42,34,51,.5)';
    ctx.font = font(800, 11 * u, SANS);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(String(i + 1), r.x + pad * 0.7, r.y + pad * 0.6);
    const iconId = card.kind === 'apple' ? 'apple' : card.kind === 'scales' ? 'scales' : card.id!;
    const title = sim.cardTitle(card);
    const tag = evo ? t('card.evo') : card.kind === 'new' ? t('card.new') : card.kind === 'up' ? t('card.lv', { a: card.from, b: card.to }) : '';
    const desc = card.kind === 'apple' ? t('card.apple.text') : card.kind === 'scales' ? t('card.scales.text')
      : isWeapon(card.id!) ? weaponStats(card.id as WeaponId, card.to) : gearStats(card.id as GearId, card.to);
    const pair = card.id && isWeapon(card.id) && !evo ? t('card.pair', { name: itemName(WEAPONS[card.id as WeaponId].pair) }) : '';
    if (narrow) {
      const ir = Math.min(r.h * 0.3, 26 * u, r.w * 0.12);
      paintItemIcon(ctx, iconId, r.x + pad + ir, r.y + r.h / 2, ir, evo);
      const tx = r.x + pad * 2 + ir * 2, tw = r.w - (tx - r.x) - pad;
      ctx.textAlign = 'left';
      ctx.fillStyle = C.ink;
      ctx.font = font(700, 16 * u, SERIF);
      ctx.fillText(title, tx, r.y + pad * 0.7);
      ctx.font = font(800, 10.5 * u, SANS);
      ctx.fillStyle = evo ? C.goldDeep : C.vermilionDeep;
      ctx.fillText(tag, tx, r.y + pad * 0.7 + 20 * u);
      ctx.font = font(500, 11.5 * u, SANS);
      ctx.fillStyle = C.inkSoft;
      wrap(ctx, desc, tw).slice(0, 2).forEach((l, j) => ctx.fillText(l, tx, r.y + pad * 0.7 + 36 * u + j * 14 * u));
      if (pair) {
        ctx.font = font(600, 10 * u, SANS);
        ctx.fillStyle = 'rgba(42,34,51,.55)';
        ctx.fillText(pair, tx, r.y + r.h - pad - 8 * u);
      }
      return;
    }
    const ir = Math.min(r.w * 0.17, 30 * u);
    paintItemIcon(ctx, iconId, r.x + r.w / 2, r.y + pad + ir + 6 * u, ir, evo);
    ctx.textAlign = 'center';
    let y = r.y + pad + ir * 2 + 18 * u;
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 18 * u, SERIF);
    wrap(ctx, title, r.w - pad * 2).slice(0, 2).forEach(l => { ctx.fillText(l, r.x + r.w / 2, y); y += 21 * u; });
    if (tag) {
      ctx.font = font(800, 11 * u, SANS);
      ctx.fillStyle = evo ? C.goldDeep : C.vermilionDeep;
      ctx.fillText(tag, r.x + r.w / 2, y + 2 * u);
      y += 20 * u;
    }
    ctx.font = font(500, 12.5 * u, SANS);
    ctx.fillStyle = C.inkSoft;
    wrap(ctx, desc, r.w - pad * 2).slice(0, 4).forEach(l => { ctx.fillText(l, r.x + r.w / 2, y); y += 16 * u; });
    if (pair) {
      ctx.font = font(600, 10.5 * u, SANS);
      ctx.fillStyle = 'rgba(42,34,51,.55)';
      ctx.fillText(pair, r.x + r.w / 2, r.y + r.h - pad - 16 * u);
    }
  }

  /** The run's tally: what it gathered, how near the record, and on to the next. */
  drawTally(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim, now: number): void {
    const ta = sim.tally;
    if (!ta) return;
    const u = L.u, k = Math.min(1, ta.t / 0.3);
    ctx.fillStyle = `rgba(20,16,28,${0.6 * k})`;
    ctx.fillRect(0, 0, L.w, L.h);
    const w = Math.min(L.w - 28, 400 * u), h = 230 * u;
    const r = { x: (L.w - w) / 2, y: L.top + Math.max(4, Math.min((L.bottom - L.top - h) / 2, L.h - L.top - h - 4)), w, h };
    ctx.save();
    ctx.translate(r.x + w / 2, r.y + h / 2);
    const sc = ease.outBack(k);
    ctx.scale(sc, sc);
    ctx.translate(-w / 2, -h / 2);
    panel(ctx, { x: 0, y: 0, w, h }, '#f6ecd2', C.gold, 14 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.font = font(800, 22 * u, SERIF, true);
    ctx.fillText(t('tally.title', { n: ta.run }), w / 2, 30 * u);
    const cols: [string, string][] = [
      [t('tally.scales'), fmtNum(ta.scales)],
      [t('tally.time'), `${Math.floor(ta.time / 60)}:${String(Math.floor(ta.time % 60)).padStart(2, '0')}`],
      [t('tally.level'), String(ta.level)],
    ];
    cols.forEach(([kk, v], i) => {
      const cx = w * (0.2 + 0.3 * i);
      ctx.font = font(800, 26 * u, SANS);
      ctx.fillStyle = i === 0 ? C.goldDeep : C.ink;
      ctx.fillText(v, cx, 78 * u);
      ctx.font = font(600, 11 * u, SANS);
      ctx.fillStyle = C.inkSoft;
      ctx.fillText(kk, cx, 102 * u);
    });
    if (ta.scales > 0) paintScale(ctx, w * 0.2 - 34 * u, 78 * u, 9 * u, 10, now);
    ctx.font = font(700, 14 * u, SANS);
    ctx.fillStyle = ta.best ? C.goldDeep : C.vermilionDeep;
    const line = ta.best ? t('tally.best') : ta.toBest > 0 ? t('tally.toBest', { scales: scalesText(ta.toBest) }) : '';
    if (line) ctx.fillText(line, w / 2, 134 * u);
    ctx.font = font(500, 12 * u, SANS);
    ctx.fillStyle = C.inkSoft;
    wrap(ctx, t('tally.kept'), w - 30 * u).slice(0, 2).forEach((l, i) => ctx.fillText(l, w / 2, 160 * u + i * 15 * u));
    if (ta.t >= RULES.tallyMin) {
      ctx.font = font(800, 13 * u, SANS);
      ctx.fillStyle = C.goldDeep;
      ctx.fillText(t('tally.next'), w / 2, h - 22 * u);
    }
    ctx.restore();
  }

  /** The opening card (the first session) and the card of a freed land. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: JerzySim): void {
    const st = sim.story;
    if (!st || st.t < 0) return;
    const u = L.u, k = Math.min(1, st.t / 0.35), out = st.dur - st.t < 0.3 ? (st.dur - st.t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(k, out));
    ctx.fillStyle = 'rgba(20,16,28,.6)';
    ctx.fillRect(0, 0, L.w, L.h);
    const w = Math.min(L.w - 24, 470 * u);
    const open = st.kind === 'open';
    const pad = 18 * u;
    // measure first: the card fits its words (and the passage) and no more
    ctx.font = font(500, 14 * u, SANS);
    const openLines = open ? wrap(ctx, t('story.open.text'), w - pad * 2).slice(0, 5) : [];
    ctx.font = font(800, 21 * u, SERIF, true);
    const next = st.to ?? st.from;
    const titleLines = open ? [] : wrap(ctx, t('story.land.title', { name: cap(dragonName(st.from)) }), w - pad * 2).slice(0, 2);
    ctx.font = font(500, 13.5 * u, SANS);
    const sub = t('story.land.sub', { town: townName(st.from), next: townName(next), story: `${cap(dragonName(next))} ${townStory(next)}` });
    const subLines = open ? [] : wrap(ctx, sub, w - pad * 2).slice(0, 4);
    const room = L.h - L.top - 16;
    const ps = passage('eph6.16');
    if (open && (!this.passage || this.passage.w !== w)) this.passage = { id: 'eph6.16', l: layoutPassage(ctx, ps, w - pad * 2, Math.max(40, room - (36 * u + openLines.length * 19 * u + pad * 2 + 40 * u)), { max: 16, min: 10 }), w };
    const h = open ? Math.min(room, pad * 2 + 36 * u + openLines.length * 19 * u + 10 * u + (this.passage?.l.height ?? 60) + 34 * u)
      : pad * 2 + titleLines.length * 26 * u + subLines.length * 18 * u + 8 * u;
    const r = { x: (L.w - w) / 2, y: L.top + Math.max(8, Math.min(40 * u, (L.h - L.top - h) / 3)), w, h };
    panel(ctx, r, '#f6ecd2', C.gold, 14 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    if (open) {
      ctx.font = font(800, 24 * u, SERIF, true);
      ctx.fillText(t('story.open.title'), L.w / 2, r.y + pad);
      ctx.font = font(500, 14 * u, SANS);
      ctx.fillStyle = C.inkSoft;
      let y = r.y + pad + 36 * u;
      for (const l of openLines) { ctx.fillText(l, L.w / 2, y); y += 19 * u; }
      if (this.passage) drawPassage(ctx, ps, this.passage.l, L.w / 2, y + 10 * u, { text: C.ink, ref: C.goldDeep });
      ctx.font = font(800, 12 * u, SANS);
      ctx.fillStyle = C.goldDeep;
      ctx.fillText(t('story.tap'), L.w / 2, r.y + h - pad - 6 * u);
    } else {
      ctx.font = font(800, 21 * u, SERIF, true);
      let y = r.y + pad;
      for (const l of titleLines) { ctx.fillText(l, L.w / 2, y); y += 26 * u; }
      ctx.font = font(500, 13.5 * u, SANS);
      ctx.fillStyle = C.inkSoft;
      for (const l of subLines) { ctx.fillText(l, L.w / 2, y + 6 * u); y += 18 * u; }
    }
    ctx.restore();
  }

  /** Linda's bubble over her head (kept on screen and under the runner's HUD). */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, k: number): void {
    const u = L.u;
    ctx.save();
    ctx.font = font(600, 13 * u, SANS);
    const maxW = Math.min(250 * u, L.w - 24);
    const lines = wrap(ctx, text, maxW - 20 * u);
    const lh = 16 * u;
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 20 * u), bh = lines.length * lh + 14 * u;
    const bx = Math.max(8, Math.min(L.w - bw - 8, x - bw * 0.3));
    const by = Math.max(L.top + 4, Math.min(L.bottom - bh - 60 * u, y - bh - 12 * u));
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = 'rgba(42,34,51,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 10 * u);
    ctx.fill();
    ctx.stroke();
    // the tail toward Linda
    const tx = Math.max(bx + 12, Math.min(bx + bw - 12, x));
    if (by + bh < y) {
      ctx.beginPath();
      ctx.moveTo(tx - 6 * u, by + bh - 1);
      ctx.lineTo(x, Math.min(y - 4, by + bh + 10 * u));
      ctx.lineTo(tx + 6 * u, by + bh - 1);
      ctx.fill();
    }
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 10 * u, by + 7 * u + i * lh));
    ctx.restore();
  }
}
