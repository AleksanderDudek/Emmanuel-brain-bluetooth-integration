/**
 * Dziewiątka's own bits on the canvas (the runner draws the band's panel and the score): the five
 * portraits (the bars of health and energy, the glow and "Stuknij!" of a full bar, the semi-auto's
 * countdown ring, the colour rank, at the well the six gear sockets), the energy dial (the band's
 * multiplier ×1…×3 with the threshold notch at ×2, gold above it), the bell (Harmony filling with gold),
 * the mission's pill and the boss's bar under the HUD, the boons' cards, the story cards, the wipe's
 * card and Klara's bubble.  It keeps only animation state; hit tests use the layout.
 */
import { fmtNum } from '../../i18n';
import { layoutPassage, drawPassage, passage, wrapLines, type PassageLayout } from '../kit/scripture';
import { approach, clamp, ease } from '../kit/juice';
import type { Hero } from './battle';
import {
  CHAPTERS, HEROES, MISSIONS_PER_CHAPTER, PIECES, RANK_COLOR,
  boonName, boonText, chapterName, dinName, heroName, heroText, ultName, type BoonId,
} from './content';
import { t, type Key } from './i18n';
import { inRect, type Layout, type Rect } from './layout';
import { growth, fitting } from './meta';
import { C, INK, SANS, SERIF, font, glow, paintBellShape, paintFace, roundRect } from './paint';
import { RULES } from './rules';
import type { DziewiatkaSim } from './sim';

const TAU = Math.PI * 2;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Text cut to a width with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, s: string, w: number): string {
  if (ctx.measureText(s).width <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (ctx.measureText(`${s.slice(0, m)}…`).width <= w) lo = m; else hi = m - 1;
  }
  return `${s.slice(0, lo)}…`;
}

/** The largest font size (≤ max) at which `s` fits `w`. */
function fitSize(ctx: CanvasRenderingContext2D, s: string, w: number, max: number, min: number, weight = 700, family = SANS): number {
  for (let px = max; px > min; px -= 0.5) {
    ctx.font = font(px, weight, family);
    if (ctx.measureText(s).width <= w) return px;
  }
  return min;
}

export class Hud {
  /** a not-ready tap wobbles its portrait; a fired one flashes */
  private readonly wobble = [0, 0, 0, 0, 0];
  private readonly flash = [0, 0, 0, 0, 0];
  private readonly shownE = [0, 0, 0, 0, 0];
  private readonly shownH = [1, 1, 1, 1, 1];
  private bellRing = 0;
  private dialShown = 1;
  private storyKey = '';
  private verse: PassageLayout | null = null;

  nope(slot: number): void { if (slot >= 0 && slot < 5) this.wobble[slot] = 1; }
  fired(slot: number): void { if (slot >= 0 && slot < 5) this.flash[slot] = 1; }
  rang(): void { this.bellRing = 1; }

  update(dt: number, sim: DziewiatkaSim): void {
    for (let i = 0; i < 5; i++) {
      this.wobble[i] = Math.max(0, this.wobble[i] - dt * 3);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 2.5);
      const h = sim.battle.heroBySlot(i);
      if (h) {
        this.shownE[i] = approach(this.shownE[i], h.energy / RULES.energyMax, dt, 0.08);
        this.shownH[i] = approach(this.shownH[i], h.hp / h.max, dt, 0.12);
      }
    }
    this.bellRing = Math.max(0, this.bellRing - dt * 0.8);
    this.dialShown = approach(this.dialShown, sim.multShown, dt, 0.2);
  }

  // ── hit tests ───────────────────────────────────────────────────
  slotAt(L: Layout, x: number, y: number): number {
    return L.slots.findIndex(r => inRect(r, x, y, 3));
  }

  bellAt(L: Layout, x: number, y: number): boolean { return inRect(L.bell, x, y, 6); }

  cardAt(L: Layout, x: number, y: number): number { return L.cards.findIndex(r => inRect(r, x, y, 4)); }

  // ── the strip ───────────────────────────────────────────────────
  drawStrip(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    for (let i = 0; i < 5; i++) {
      const h = sim.battle.heroBySlot(i);
      if (h) this.portrait(ctx, L.slots[i], h, sim, clock, i);
    }
    this.dial(ctx, L, sim, clock);
    this.bell(ctx, L, sim, clock);
  }

  private portrait(ctx: CanvasRenderingContext2D, r: Rect, h: Hero, sim: DziewiatkaSim, clock: number, i: number): void {
    const ready = sim.battle.ready(h) && sim.fighting;
    const well = sim.atWell;
    const wob = this.wobble[i] > 0 ? Math.sin(this.wobble[i] * 30) * 4 * this.wobble[i] : 0;
    const pulse = ready ? 0.5 + 0.5 * Math.sin(clock * 7) : 0;
    ctx.save();
    ctx.translate(wob, ready ? -2 - pulse * 2 : 0);
    const spec = HEROES[h.kind];
    const g = growth(sim.p, h.kind);
    // the card
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.9, 'rgba(255,210,100,', 0.35 + 0.25 * pulse);
      ctx.restore();
    }
    ctx.fillStyle = h.down ? '#d8d2c8' : C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(14, r.w * 0.14));
    ctx.fill();
    ctx.lineWidth = ready ? 3 : 1.5;
    ctx.strokeStyle = ready ? C.gold : 'rgba(43,34,56,.45)';
    ctx.stroke();
    ctx.fillStyle = spec.color;
    ctx.save();
    roundRect(ctx, r.x, r.y, r.w, r.h, Math.min(14, r.w * 0.14));
    ctx.clip();
    ctx.fillRect(r.x, r.y, r.w, Math.max(4, r.h * 0.07));
    ctx.restore();
    // the face medallion with its rank ring, the countdown of the semi-auto; the stars; the name; the bars
    const tiny = r.w < 84 || r.h < 86;
    const top = r.y + Math.max(5, r.h * 0.06);
    const bh = Math.max(4, Math.min(7, r.h * 0.065));
    const barsH = 2 * bh + 3;
    const nameH = tiny ? 0 : Math.min(13, r.h * 0.12) + 4;
    const starH = Math.max(8, Math.min(11, r.h * 0.1));
    const mr = Math.max(9, Math.min(r.w * 0.27, (r.h - (top - r.y) - barsH - nameH - starH - 12) / 2));
    const mx = r.x + r.w / 2, my = top + mr + 2;
    paintFace(ctx, h.kind, mx, my, mr, clock, h.down);
    ctx.lineWidth = Math.max(2, mr * 0.13);
    ctx.strokeStyle = RANK_COLOR[g.rank] ?? '#fff';
    ctx.beginPath();
    ctx.arc(mx, my, mr + ctx.lineWidth / 2, 0, TAU);
    ctx.stroke();
    if (ready) {
      const wait = RULES.autoWait[spec.role] ?? 3;
      const k = clamp(h.readyT / wait);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = Math.max(2, mr * 0.15);
      ctx.beginPath();
      ctx.arc(mx, my, mr + ctx.lineWidth * 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k));
      ctx.stroke();
    }
    if (this.flash[i] > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mx, my, mr * 2.4, 'rgba(255,240,200,', this.flash[i] * 0.8);
      ctx.restore();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = my + mr + 3 + starH / 2;
    ctx.fillStyle = '#d4951f';
    ctx.font = font(starH, 800);
    ctx.fillText('★'.repeat(g.stars), mx, y);
    y += starH / 2 + 2;
    if (!tiny) {
      const name = heroName(h.kind);
      const px = fitSize(ctx, name, r.w - 8, Math.min(13, r.h * 0.12), 7.5, 750);
      ctx.font = font(px, 750);
      ctx.fillStyle = INK;
      ctx.fillText(name, mx, y + px / 2 + 1);
    }
    const bx = r.x + Math.max(4, r.w * 0.08), bw = r.w - 2 * Math.max(4, r.w * 0.08);
    const by1 = r.y + r.h - barsH - Math.max(4, r.h * 0.05), by2 = by1 + bh + 3;
    ctx.fillStyle = 'rgba(43,34,56,.18)';
    roundRect(ctx, bx, by1, bw, bh, bh / 2);
    ctx.fill();
    roundRect(ctx, bx, by2, bw, bh, bh / 2);
    ctx.fill();
    const hp = clamp(this.shownH[i]);
    ctx.fillStyle = hp < 0.3 ? C.hpLow : C.hp;
    if (hp > 0) { roundRect(ctx, bx, by1, bw * hp, bh, bh / 2); ctx.fill(); }
    const e = clamp(this.shownE[i]);
    const gold = sim.sighted && sim.reliable && sim.multShown >= 2;
    ctx.fillStyle = gold ? '#ffb829' : C.energy;
    if (e > 0) { roundRect(ctx, bx, by2, bw * e, bh, bh / 2); ctx.fill(); }
    if (gold && e < 1) {
      // gold sparks run along a bar the band is filling
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bx + bw * e, by2 + bh / 2, bh * 1.6, 'rgba(255,220,120,', 0.5);
      ctx.restore();
    }
    // states over the medallion
    ctx.textAlign = 'center';
    if (h.down) {
      ctx.fillStyle = 'rgba(43,34,56,.85)';
      ctx.font = font(Math.max(8, mr * 0.42), 800);
      ctx.fillText(t('hud.down'), mx, my);
    } else if (h.silence > 0 && !well) {
      ctx.fillStyle = 'rgba(43,34,56,.75)';
      ctx.font = font(Math.max(8, mr * 0.45), 800);
      ctx.fillText(t('hud.silenced'), mx, my - mr * 0.75);
    } else if (ready) {
      const px = Math.max(9, Math.min(14, r.w * 0.13));
      ctx.font = font(px, 900);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,246,227,.95)';
      ctx.strokeText(t('hud.ready'), mx, my);
      ctx.fillStyle = '#7a4a00';
      ctx.fillText(t('hud.ready'), mx, my);
    }
    // at the well: the six sockets of the next rank, a glow where a piece fits
    if (well) {
      const can = fitting(sim.p, h.kind) >= 0;
      const sr = Math.max(2.5, Math.min(5, r.w * 0.04));
      const sy = r.y + Math.max(8, r.h * 0.11);
      for (let k = 0; k < PIECES; k++) {
        const sx = r.x + r.w / 2 + (k - (PIECES - 1) / 2) * sr * 2.6;
        ctx.fillStyle = g.slots & (1 << k) ? RANK_COLOR[Math.min(RANK_COLOR.length - 1, g.rank + 1)] : 'rgba(43,34,56,.18)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, TAU);
        ctx.fill();
      }
      if (can) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, mx, my, mr * 1.7, 'rgba(255,230,160,', 0.3 + 0.2 * Math.sin(clock * 5));
        ctx.restore();
        ctx.fillStyle = '#2e7d32';
        ctx.font = font(Math.max(10, mr * 0.6), 900);
        ctx.fillText('+', mx + mr * 0.85, my - mr * 0.75);
      }
    }
    ctx.restore();
  }

  /** The band's dial: the energy multiplier ×1…×3, the threshold notch at ×2, gold above it. */
  private dial(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const r = L.dial;
    if (r.w < 30) return;
    ctx.save();
    ctx.fillStyle = 'rgba(251,241,220,.94)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(43,34,56,.45)';
    ctx.stroke();
    const live = sim.sighted && sim.reliable;
    const blind = sim.blind;
    const k = clamp((this.dialShown - 1) / RULES.multK);
    const wide = r.w > r.h * 1.6;
    const rad = wide ? Math.min(r.h * 0.34, r.w * 0.26) : Math.min(r.w * 0.34, r.h * 0.3);
    const cx = wide ? r.x + 12 + rad * 1.15 : r.x + r.w / 2;
    const cy = wide ? r.y + r.h * 0.6 : r.y + r.h * 0.5;
    const a0 = Math.PI * 0.85, a1 = Math.PI * 2.15;
    // the track, the gold part above the threshold, the threshold notch
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, rad * 0.24);
    ctx.strokeStyle = 'rgba(43,34,56,.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, a0, a1);
    ctx.stroke();
    const am = a0 + (a1 - a0) * k;
    if (!blind) {
      ctx.strokeStyle = live ? (k >= 0.5 ? '#ffb829' : '#f2c46a') : 'rgba(160,150,140,.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, rad, a0, Math.max(a0 + 0.001, am));
      ctx.stroke();
      if (live && k >= 0.5) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, cx + Math.cos(am) * rad, cy + Math.sin(am) * rad, rad * 0.6, 'rgba(255,210,100,', 0.6 + 0.2 * Math.sin(clock * 6));
        ctx.restore();
      }
    }
    const amid = (a0 + a1) / 2;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(amid) * rad * 0.7, cy + Math.sin(amid) * rad * 0.7);
    ctx.lineTo(cx + Math.cos(amid) * rad * 1.3, cy + Math.sin(amid) * rad * 1.3);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(amid) * rad * 0.7, cy + Math.sin(amid) * rad * 0.7);
    ctx.lineTo(cx + Math.cos(amid) * rad * 1.3, cy + Math.sin(amid) * rad * 1.3);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!blind) {
      // the needle
      ctx.strokeStyle = INK;
      ctx.lineWidth = Math.max(1.5, rad * 0.08);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(am) * rad * 0.8, cy + Math.sin(am) * rad * 0.8);
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2.5, rad * 0.1), 0, TAU);
    ctx.fill();
    // the words: the multiplier big, the gauge's name, "próg" by the notch
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const mult = blind ? '?' : `×${fmtNum(live ? this.dialShown : 1, 1)}`;
    const markPx = Math.max(8, Math.min(10, rad * 0.32));
    ctx.font = font(markPx, 750);
    ctx.fillStyle = 'rgba(43,34,56,.6)';
    ctx.fillText(t('hud.mark'), cx + rad * 0.62, cy - rad * 1.08);
    if (wide) {
      const tx = cx + rad * 1.3 + (r.x + r.w - (cx + rad * 1.3)) / 2;
      const tw = r.x + r.w - (cx + rad * 1.3) - 6;
      ctx.font = font(fitSize(ctx, mult, tw, Math.min(22, r.h * 0.4), 10, 900), 900);
      ctx.fillStyle = live && k >= 0.5 ? '#b36b00' : INK;
      ctx.fillText(mult, tx, r.y + r.h * 0.4);
      ctx.font = font(Math.min(11, r.h * 0.2), 750);
      ctx.fillStyle = 'rgba(43,34,56,.7)';
      ctx.fillText(fit(ctx, blind ? t('hud.blind') : t('hud.energy'), tw), tx, r.y + r.h * 0.74);
    } else {
      ctx.font = font(Math.min(17, rad * 0.55), 900);
      ctx.fillStyle = live && k >= 0.5 ? '#b36b00' : INK;
      ctx.fillText(mult, cx, cy + rad * 0.62);
      ctx.font = font(Math.min(10.5, r.w * 0.1), 750);
      ctx.fillStyle = 'rgba(43,34,56,.7)';
      ctx.fillText(fit(ctx, blind ? t('hud.blind') : t('hud.energy'), r.w - 8), cx, r.y + r.h - Math.min(10, r.h * 0.1));
    }
    if (blind) {
      ctx.fillStyle = 'rgba(160,150,180,.55)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The bell of Zacisze: Harmony fills it with gold; full, it swings and calls for a tap. */
  private bell(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const r = L.bell;
    if (r.w < 26) return;
    // full, it calls for a tap only where it can ring: in battle
    const ready = sim.harmonyReady && sim.fighting;
    ctx.save();
    ctx.fillStyle = ready ? 'rgba(255,236,170,.96)' : 'rgba(251,241,220,.94)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.lineWidth = ready ? 3 : 1.5;
    ctx.strokeStyle = ready ? C.gold : 'rgba(43,34,56,.45)';
    ctx.stroke();
    const br = Math.min(r.w * 0.3, r.h * 0.26);
    const bx = r.x + r.w / 2, by = r.y + r.h * 0.18;
    const swing = (ready ? Math.sin(clock * 6) * 0.25 : 0) + Math.sin(clock * 20) * 0.35 * this.bellRing;
    if (ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bx, by + br * 0.8, br * 3, 'rgba(255,214,120,', 0.55 + 0.2 * Math.sin(clock * 5));
      ctx.restore();
    }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(swing);
    paintBellShape(ctx, 0, 0, br, '#efe4cf', INK);
    // the gold rising inside
    const k = sim.harmonyReady ? 1 : clamp(sim.harmony);
    if (k > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(-br * 1.1, br * 1.35 - br * 1.35 * k, br * 2.2, br * 1.35 * k + 1);
      ctx.clip();
      paintBellShape(ctx, 0, 0, br, ready ? '#ffcf3a' : '#f6c44f', INK);
      ctx.restore();
    }
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = r.y + r.h - Math.min(11, r.h * 0.14);
    ctx.font = font(Math.min(11, r.w * 0.13), ready ? 900 : 750);
    ctx.fillStyle = ready ? '#7a4a00' : 'rgba(43,34,56,.7)';
    ctx.fillText(fit(ctx, ready ? t('hud.ready') : t('hud.bell'), r.w - 6), r.x + r.w / 2, ty);
    ctx.restore();
  }

  // ── under the HUD: the mission's pill, the boss's bar ───────────
  drawPill(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim): void {
    const r = L.pill, m = sim.mission, spec = m.spec;
    ctx.save();
    ctx.fillStyle = 'rgba(251,241,220,.88)';
    roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,56,.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const label = spec.floor > 0
      ? t('card.floor', { n: spec.floor })
      : `${cap(chapterName(spec.chapter.id))} · ${t('card.mission', { c: Math.floor(spec.index / MISSIONS_PER_CHAPTER) + 1, m: (spec.index % MISSIONS_PER_CHAPTER) + 1 })}`;
    const dots = spec.waves.length;
    const dr = Math.max(3, r.h * 0.17);
    const dotsW = dots * dr * 2.8;
    ctx.font = font(r.h * 0.5, 750);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fit(ctx, label, r.w - dotsW - r.h), r.x + r.h * 0.5, r.y + r.h / 2 + 0.5);
    for (let i = 0; i < dots; i++) {
      const dx = r.x + r.w - r.h * 0.5 - (dots - 1 - i) * dr * 2.8, dy = r.y + r.h / 2;
      const done = m.won > 0 || i < m.wave;
      const now = i === m.wave && m.won <= 0;
      ctx.beginPath();
      ctx.arc(dx, dy, dr, 0, TAU);
      ctx.fillStyle = done ? C.gold : now ? '#e8566a' : 'rgba(43,34,56,.18)';
      ctx.fill();
      if (now) {
        ctx.strokeStyle = INK;
        ctx.stroke();
      }
    }
    // the boss's bar
    const boss = sim.battle.boss;
    if (boss && boss.enter <= 0) {
      const b = L.bossBar;
      ctx.fillStyle = 'rgba(43,34,56,.7)';
      roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.fillStyle = '#c55a7a';
      roundRect(ctx, b.x + 1, b.y + 1, Math.max(0, (b.w - 2) * clamp(boss.hp / boss.max)), b.h - 2, (b.h - 2) / 2);
      ctx.fill();
      if (boss.mirror > 0) {
        ctx.fillStyle = 'rgba(220,230,255,.85)';
        roundRect(ctx, b.x + 1, b.y + 1, Math.max(0, (b.w - 2) * clamp(boss.mirror / Math.max(1, boss.max))), Math.max(2, b.h * 0.35), 2);
        ctx.fill();
      }
      ctx.font = font(b.h * 0.85, 800);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(cap(dinName(boss.kind)), b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      if (boss.windT >= 0) {
        // the wind-up: a red band filling under the bar — break it now
        const k = clamp(boss.windT / boss.windDur);
        ctx.fillStyle = '#ff6b4a';
        ctx.fillRect(b.x, b.y + b.h + 2, b.w * k, 3);
      }
    }
    ctx.restore();
  }

  // ── cards ───────────────────────────────────────────────────────
  drawChoice(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const c = sim.choice;
    if (!c) return;
    const k = ease.outBack(clamp(c.t / 0.35));
    ctx.save();
    ctx.fillStyle = `rgba(30,24,40,${0.45 * clamp(c.t / 0.3)})`;
    ctx.fillRect(0, L.top, L.w, L.h - L.top);
    const first = L.cards[0];
    // the title and the hint
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = font(Math.min(20, 18 * L.u), 850, SERIF);
    ctx.fillStyle = c.gold ? C.goldLight : C.cream;
    ctx.fillText(fit(ctx, c.gold ? t('card.boonGold') : t('card.boonTitle'), L.w - 24), L.w / 2, first.y - 8);
    c.ids.forEach((id, i) => {
      const r = L.cards[i];
      const lift = (1 - k) * 30 + Math.sin(clock * 2 + i) * 1.5;
      this.boonCard(ctx, r, id, c.gold, lift, L.narrow);
    });
    const last = L.cards[L.narrow ? 2 : 0];
    ctx.textBaseline = 'top';
    ctx.font = font(Math.min(12.5, 12 * L.u), 650);
    ctx.fillStyle = 'rgba(255,246,227,.85)';
    ctx.fillText(fit(ctx, t('card.boonPick'), L.w - 24), L.w / 2, last.y + last.h + 8);
    // the countdown to the first card
    const left = clamp(1 - c.t / RULES.choiceSec);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.fillRect(L.w / 2 - 50, last.y + last.h + 28, 100 * left, 3);
    ctx.restore();
  }

  private boonCard(ctx: CanvasRenderingContext2D, r: Rect, id: BoonId, gold: boolean, lift: number, narrow: boolean): void {
    ctx.save();
    ctx.translate(0, lift);
    ctx.fillStyle = gold ? '#fff2c4' : C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 16);
    ctx.fill();
    ctx.lineWidth = gold ? 3 : 1.5;
    ctx.strokeStyle = gold ? C.gold : 'rgba(43,34,56,.5)';
    ctx.stroke();
    const icon = Math.min(r.h * (narrow ? 0.62 : 0.36), r.w * 0.3);
    const ix = narrow ? r.x + 12 + icon / 2 : r.x + r.w / 2, iy = narrow ? r.y + r.h / 2 : r.y + 12 + icon / 2;
    boonIcon(ctx, id, ix, iy, icon / 2);
    ctx.fillStyle = INK;
    ctx.textAlign = narrow ? 'left' : 'center';
    ctx.textBaseline = 'top';
    const tx = narrow ? r.x + icon + 22 : r.x + r.w / 2;
    const tw = narrow ? r.w - icon - 30 : r.w - 20;
    const ty = narrow ? r.y + Math.max(6, r.h * 0.14) : iy + icon / 2 + 8;
    const name = boonName(id);
    const px = fitSize(ctx, name, tw, narrow ? 15 : 16, 10, 850);
    ctx.font = font(px, 850);
    ctx.fillText(name, tx, ty);
    ctx.font = font(narrow ? 12 : 12.5, 600);
    ctx.fillStyle = 'rgba(43,34,56,.8)';
    const lines = wrapLines(ctx, boonText(id, gold), tw).slice(0, narrow ? 2 : 3);
    lines.forEach((l, i) => ctx.fillText(l, tx, ty + px + 6 + i * 15));
    ctx.restore();
  }

  /** The story card: the opening (with the root verse), a district quiet, a newcomer, the tower. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim, clock: number): void {
    const st = sim.story;
    if (!st) return;
    const a = clamp(st.t / 0.3) * clamp((st.dur - st.t) / 0.3 + 0.2);
    const r = L.story;
    ctx.save();
    ctx.globalAlpha = Math.max(0.05, a);
    ctx.fillStyle = 'rgba(30,24,40,.55)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.fillStyle = C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 20);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    let title = '', text = '';
    if (st.kind === 'open') { title = t('story.open.title'); text = t('story.open'); }
    else if (st.kind === 'chapter') { title = t('story.chapter.title', { n: st.chapter + 1 }); text = t(`story.ch.${CHAPTERS[st.chapter].id}` as Key); }
    else if (st.kind === 'join' && st.hero) { title = t('story.join.title', { name: heroName(st.hero) }); text = `${t(`story.join.${st.hero}` as Key)} ${ultName(st.hero)}: ${heroText(st.hero)}`; }
    else { title = t('story.tower.title'); text = t('story.tower'); }
    const pad = Math.max(14, r.w * 0.05);
    let y = r.y + pad;
    if (st.kind === 'join' && st.hero) {
      const fr = Math.min(34, r.h * 0.14);
      paintFace(ctx, st.hero, r.x + r.w / 2, y + fr, fr, clock);
      y += fr * 2 + 8;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    const tp = fitSize(ctx, title, r.w - 2 * pad, Math.min(26, 22 * L.u + 4), 14, 800, SERIF);
    ctx.font = font(tp, 800, SERIF);
    ctx.fillText(title, r.x + r.w / 2, y);
    y += tp + 10;
    const fpx = Math.max(13, Math.min(15, 13.5 * L.u + 1));
    ctx.font = font(fpx, 600);
    ctx.fillStyle = 'rgba(43,34,56,.88)';
    const lines = wrapLines(ctx, text, r.w - 2 * pad);
    const lh = fpx * 1.35;
    const maxLines = Math.max(2, Math.floor((r.y + r.h - y - (st.kind === 'open' ? r.h * 0.34 : 30)) / lh));
    lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, y + i * lh));
    y += Math.min(lines.length, maxLines) * lh + 8;
    if (st.kind === 'open') {
      const p = passage('gal5.22-23');
      const key = `${r.w}x${r.h}`;
      if (!this.verse || this.storyKey !== key) {
        this.storyKey = key;
        this.verse = layoutPassage(ctx, p, r.w - 2 * pad, Math.max(40, r.y + r.h - y - 26), { max: 16, min: 10 });
      }
      drawPassage(ctx, p, this.verse, r.x + r.w / 2, y, { text: '#5a3d2b', ref: 'rgba(43,34,56,.6)' });
    }
    ctx.font = font(11.5, 650);
    ctx.fillStyle = 'rgba(43,34,56,.55)';
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('card.tap'), r.x + r.w / 2, r.y + r.h - 8);
    ctx.restore();
  }

  drawWipe(ctx: CanvasRenderingContext2D, L: Layout, sim: DziewiatkaSim): void {
    const tl = sim.tally;
    if (!tl) return;
    const a = clamp(tl.t / 0.25) * clamp((tl.dur - tl.t) / 0.25);
    const w = Math.min(L.w - 24, 420), h = 104;
    const x = (L.w - w) / 2, y = L.top + Math.max(10, (L.fieldBottom - L.top - h) / 2);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = C.paper;
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,34,56,.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = INK;
    ctx.font = font(18, 800, SERIF);
    ctx.fillText(fit(ctx, t('wipe.title'), w - 24), x + w / 2, y + 16);
    ctx.font = font(13, 600);
    ctx.fillStyle = 'rgba(43,34,56,.85)';
    wrapLines(ctx, t('wipe.text'), w - 32).slice(0, 2).forEach((l, i) => ctx.fillText(l, x + w / 2, y + 48 + i * 18));
    ctx.restore();
  }

  /** Klara's bubble above her head, kept on the canvas and under the HUD. */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, ax: number, ay: number, a: number): void {
    if (!text || a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    const px = Math.max(11, Math.min(14, 13 * L.u));
    ctx.font = font(px, 650);
    const maxW = Math.min(260, L.w * 0.62);
    const lines = wrapLines(ctx, text, maxW - 20);
    const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22);
    const h = lines.length * px * 1.3 + 14;
    let x = ax - 18;
    x = Math.max(6, Math.min(L.w - w - 6, x));
    let y = ay - h - 12;
    y = Math.max(L.top + 2 + (L.pill.h + 6), y);
    ctx.fillStyle = '#fffaf0';
    ctx.strokeStyle = 'rgba(43,34,56,.55)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
    // the tail toward Klara
    const tx = Math.max(x + 12, Math.min(x + w - 12, ax));
    ctx.beginPath();
    ctx.moveTo(tx - 7, y + h - 1);
    ctx.lineTo(tx, Math.min(ay - 2, y + h + 10));
    ctx.lineTo(tx + 7, y + h - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 11, y + 7 + i * px * 1.3));
    ctx.restore();
  }
}

/** A small picture for each boon. */
export function boonIcon(ctx: CanvasRenderingContext2D, id: BoonId, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillStyle = 'rgba(255,214,120,.25)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  switch (id) {
    case 'piesn':
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(-r * 0.3, r * 0.35, r * 0.2, r * 0.14, -0.4, 0, TAU);
      ctx.ellipse(r * 0.35, r * 0.2, r * 0.2, r * 0.14, -0.4, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 0.32);
      ctx.lineTo(-r * 0.12, -r * 0.45);
      ctx.lineTo(r * 0.53, -r * 0.6);
      ctx.lineTo(r * 0.53, r * 0.18);
      ctx.stroke();
      break;
    case 'zupa':
      ctx.fillStyle = '#e8a05a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.05);
      ctx.quadraticCurveTo(0, r * 0.95, r * 0.7, -r * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(43,34,56,.5)';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(k * r * 0.25, -r * 0.2);
        ctx.quadraticCurveTo(k * r * 0.25 + r * 0.12, -r * 0.45, k * r * 0.25, -r * 0.7);
        ctx.stroke();
      }
      break;
    case 'szal':
      ctx.strokeStyle = '#c94f3d';
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, -r * 0.3);
      ctx.quadraticCurveTo(0, r * 0.1, r * 0.6, -r * 0.3);
      ctx.moveTo(r * 0.3, -r * 0.15);
      ctx.lineTo(r * 0.45, r * 0.65);
      ctx.stroke();
      break;
    case 'werbel':
      ctx.fillStyle = '#e9e4f2';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.2, r * 0.6, r * 0.22, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c94f3d';
      ctx.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.6);
      ctx.strokeRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.6);
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.8);
      ctx.lineTo(-r * 0.1, -r * 0.3);
      ctx.moveTo(r * 0.7, -r * 0.8);
      ctx.lineTo(r * 0.1, -r * 0.3);
      ctx.stroke();
      break;
    case 'pierniki':
      ctx.fillStyle = '#b8742f';
      ctx.beginPath();
      ctx.arc(0, -r * 0.4, r * 0.25, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.18);
      ctx.lineTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.2, r * 0.05);
      ctx.lineTo(-r * 0.35, r * 0.6);
      ctx.lineTo(0, r * 0.35);
      ctx.lineTo(r * 0.35, r * 0.6);
      ctx.lineTo(r * 0.2, r * 0.05);
      ctx.lineTo(r * 0.55, 0);
      ctx.lineTo(r * 0.15, -r * 0.18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'klucz':
      ctx.strokeStyle = '#b8872a';
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.26, 0, TAU);
      ctx.moveTo(-r * 0.1, -r * 0.1);
      ctx.lineTo(r * 0.65, r * 0.25);
      ctx.moveTo(r * 0.45, r * 0.15);
      ctx.lineTo(r * 0.35, r * 0.4);
      ctx.stroke();
      break;
    case 'apteczka':
      ctx.fillStyle = '#f7f3ea';
      roundRect(ctx, -r * 0.6, -r * 0.45, r * 1.2, r * 0.9, r * 0.15);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#4caf6a';
      ctx.fillRect(-r * 0.1, -r * 0.32, r * 0.2, r * 0.64);
      ctx.fillRect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2);
      break;
    case 'kieszenie':
      ctx.fillStyle = '#7d93c9';
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.45);
      ctx.lineTo(r * 0.55, -r * 0.45);
      ctx.lineTo(r * 0.45, r * 0.45);
      ctx.quadraticCurveTo(0, r * 0.7, -r * 0.45, r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.5, r * 0.14, 0, TAU);
      ctx.arc(r * 0.15, -r * 0.55, r * 0.14, 0, TAU);
      ctx.fill();
      break;
  }
  ctx.restore();
}
