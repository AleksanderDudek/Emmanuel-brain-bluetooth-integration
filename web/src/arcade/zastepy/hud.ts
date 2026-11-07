/**
 * Zastępy's own HUD on the play canvas — only what belongs to the game (the runner draws the Mendi
 * panel, the score corner and the coach marks): the battle's bar (the battle on the map, the gate of
 * ash's walls or the boss), the banners along the road (the band's last 40 s: gold above the
 * threshold, cool in a Cisza, a broken pole without signal, fog over a blind block, the lag bracket
 * at "now"), the light's row — the lantern, drawn large, whose arc is what focus drives with the
 * threshold marked at its top (or, in a Cisza, the calm that mends), the stream of motes out of it
 * into the light bar, the walls, the pillar's button and the trumpet's ring — the unit cards (each
 * with the shade it is the bane of, glowing ×2 when that shade comes), the toasts and the words over
 * the road, the stars of a battle won, Tymek's bubble, the card between battles (the chapter's map
 * and the upgrades with their numbers), the story cards and the evening.  Every string is fitted to
 * its room so it reads on a 390 px phone in German and Swedish.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { LAG_SEC, traceBars } from '../kit/trace';
import { AGES, AGE_STORY, DEMON_NAME, HOST_NAME } from './content';
import { t } from './i18n';
import type { Layout, Rect } from './layout';
import {
  ageOf, bossOf, chapterOf, flowFor, gateLevel, heroLevel, isBossBattle, pillarFor, unitLevel, unitStats, wallsFor,
} from './meta';
import { C, POSE, SANS, SERIF, coin, font, lightDrop, paintDemon, paintHost, paintLightGate, paintTrumpet, paintTymek, star, type Pose } from './paint';
import { BANE, HOST, HOST_IDS, RULES, type HostId, type WaveId } from './rules';
import type { Offer, ZastepySim } from './sim';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Toast { title: string; sub: string; color: string; t: number; dur: number }
interface Story { kind: 'open' | 'age'; age: number; t: number; out: number }

export type Hit =
  | { kind: 'card'; id: HostId } | { kind: 'trumpet' } | { kind: 'pillar' } | { kind: 'offer'; i: number } | { kind: 'go' } | { kind: 'story' }
  | { kind: 'none' };

const TXT = {
  walls: t('hud.walls'), ash: t('hud.ash'), soon: t('hud.soon'), pillar: t('hud.pillar'),
  finaleTitle: t('finale.title'), finaleSub: t('finale.sub'), upTitle: t('up.title'), upGo: t('up.go'),
  storyTap: t('story.tap'), openTitle: t('story.openTitle'), openText: t('story.open'),
};

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private readonly toasts: Toast[] = [];
  private F = Hud.fontsFor(1);
  private clock = 0;
  private readonly lag: number;
  private readonly lagLabel: string;
  private readonly shakeT = new Map<HostId, number>();
  private readonly pressT = new Map<HostId, number>();
  private trumpetPop = 0;
  private pillarPop = 0;
  private boughtT = 0;
  private finaleA = 0;
  private upA = 0;
  private gate = 1;
  private readonly pose: Pose = { ...POSE };
  /** the stream's motes from the lantern into the bar (or into the walls in a Cisza) */
  private readonly motes: { k: number; v: number; rest: boolean }[] = [];
  private moteAcc = 0;
  /** the lantern's shown value (eased) */
  private lamp = 0;
  /** Tymek's line */
  private bubble: { text: string; t: number; dur: number } | null = null;
  private story: Story | null = null;
  private verse: PassageLayout | null = null;
  private verseKey = '';
  /** the box of the story card while it shows (a tap on it closes it) */
  storyRect: Rect | null = null;
  /** the stars of a battle won, popping in (s since, how many) */
  private stars: { t: number; n: number; fresh: number } | null = null;

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      bar: font(700, 11.5 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true), cardSub: font(650, 12 * u, SANS),
      big: font(500, 26 * u, SERIF, true), lag: font(650, 9 * u, SANS), key: font(800, 10 * u, SANS),
      cost: font(800, 12 * u, SANS), tiny: font(700, 9.5 * u, SANS), upName: font(700, 12 * u, SANS), upNums: font(600, 10.5 * u, SANS),
      btn: font(750, 14 * u, SANS), mult: font(850, 15 * u, SANS), say: font(600, 12.5 * u, SANS),
      storyTitle: font(500, 21 * u, SERIF, true), storyText: font(560, 13 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.verse = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 18) this.floats.shift();
  }

  shiftFloats(dx: number): void { for (const f of this.floats) f.x += dx; }
  shakeCard(id: HostId): void { this.shakeT.set(id, 0.35); }
  pressCard(id: HostId): void { this.pressT.set(id, 0.25); }
  popTrumpet(): void { this.trumpetPop = 1; }
  popPillar(): void { this.pillarPop = 1; }
  bought(): void { this.boughtT = 1; }
  say(text: string, dur: number): void { this.bubble = { text, t: 0, dur }; }
  showStars(n: number, fresh: number): void { this.stars = { t: 0, n, fresh }; }

  toast(title: string, sub: string, color: string = C.ink, dur = 2.4): void {
    this.toasts.push({ title, sub, color, t: 0, dur });
    if (this.toasts.length > 3) this.toasts.splice(0, this.toasts.length - 3);
    const head = this.toasts[0];
    if (this.toasts.length > 1) head.dur = Math.min(head.dur, Math.max(1.2, head.t) + 0.3);
  }

  showStory(kind: 'open' | 'age', age: number): void { this.story = { kind, age, t: 0, out: 0 }; }

  /** A tap hides a story card shown for a moment already; true when one is up (the tap is used up). */
  hideStory(): boolean {
    const s = this.story;
    if (!s) return false;
    if (s.t < (s.kind === 'open' ? 2 : 1.2) || s.out > 0) return true;
    s.out = 0.001;
    return true;
  }

  get storyOn(): boolean { return this.story !== null; }

  update(dt: number, sim: ZastepySim): void {
    this.clock += dt;
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.toasts[0];
    if (head && (head.t += dt) >= head.dur) {
      this.toasts.shift();
      const next = this.toasts[0];
      if (next && this.toasts.length > 1) next.dur = Math.min(next.dur, 2);
    }
    for (const m of [this.shakeT, this.pressT]) for (const [k, v] of m) (v - dt <= 0 ? m.delete(k) : m.set(k, v - dt));
    this.trumpetPop = Math.max(0, this.trumpetPop - dt * 1.5);
    this.pillarPop = Math.max(0, this.pillarPop - dt * 1.5);
    this.boughtT = Math.max(0, this.boughtT - dt * 1.2);
    this.finaleA = approach(this.finaleA, sim.phase !== 'play' ? 1 : 0, dt, 0.4);
    this.upA = approach(this.upA, sim.stage === 'upgrade' && sim.phase === 'play' ? 1 : 0, dt, 0.12);
    if (this.bubble && (this.bubble.t += dt) >= this.bubble.dur) this.bubble = null;
    if (this.stars && (this.stars.t += dt) >= 2.6) this.stars = null;
    const s = this.story;
    if (s) {
      s.t += dt;
      if (s.out > 0) s.out += dt / 0.35;
      if (s.t > (s.kind === 'open' ? 9 : 6) && s.out === 0) s.out = 0.001;
      if (s.out >= 1) this.story = null;
    }
    // the lantern: what the band drives right now, eased
    const want = this.lampValue(sim);
    this.lamp = approach(this.lamp, want ?? 0.5, dt, 0.18);
    // the stream: motes leave the lantern as fast as the band drives
    const b = sim.battle;
    const rest = sim.calmNow > 0;
    const rate = rest ? 3 + sim.calmNow * 10 : sim.stage === 'battle' && b.light < b.lightMax ? 2 + (sim.mult - 1) * 10 : 0;
    this.moteAcc += rate * dt;
    while (this.moteAcc >= 1) {
      this.moteAcc -= 1;
      if (this.motes.length < 40) this.motes.push({ k: 0, v: 0.9 + (rest ? 0.2 : (sim.mult - 1) * 0.8), rest });
    }
    let m = 0;
    for (const o of this.motes) if ((o.k += dt * o.v) < 1) this.motes[m++] = o;
    this.motes.length = m;
  }

  /** The lantern's value: the level in a Natarcie (and the warm-up), the calm in a Cisza; null when hidden. */
  private lampValue(sim: ZastepySim): number | null {
    if (!sim.reliable || sim.blind) return null;
    return sim.restBlock ? sim.calm : sim.level;
  }

  /** Over the world: the battle's bar, the light's row, the cards, the bubble, the toasts, the cards of the story. */
  draw(sim: ZastepySim): void {
    this.battleBar(sim);
    this.row(sim);
    this.cardsRow(sim);
    this.drawFloats();
    this.drawStars();
    this.drawToast();
    this.drawBubble();
    this.upgrade(sim);
    this.finale();
    this.drawStory();
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
    const m = f.match(/(\d+(?:\.\d+)?)px/);
    if (!m) return f;
    const size = Number(m[1]);
    return f.replace(m[0], `${Math.max(size * min, size * (maxW / w)).toFixed(1)}px`);
  }

  private lines(text: string, maxW: number, f: string, max: number): string[] {
    this.ctx.font = f;
    const out = wrap(this.ctx, text, maxW);
    if (out.length > max) {
      out.length = max;
      out[max - 1] = `${out[max - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    return out;
  }

  // ── the battle's bar ────────────────────────────────────────────
  private battleBar(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, r = L.battle, b = sim.battle;
    if (this.story) return;
    this.vellum(r.x, r.y, r.w, r.h, 0.82, 11);
    const at = chapterOf(b.battle);
    const boss = isBossBattle(b.battle);
    const label = boss ? t('map.boss', { boss: DEMON_NAME[bossOf(b.battle)] }) : `${t('fx.battle', { n: at.local + 1 })} · ${t('map.chapter', { c: at.chapter + 1, age: AGES[ageOf(b.battle)] })}`;
    // the five stars-slots of the chapter on the left: where you are
    const dots = RULES.chapter, dx = 9 * u, d0 = r.x + 10 * u;
    for (let i = 0; i < dots; i++) {
      const bb = at.chapter * dots + i, here = bb === b.battle, done = bb < sim.p.battle && bb !== b.battle;
      ctx.fillStyle = i === dots - 1 ? (done ? C.goldDeep : '#3a2c3c') : done ? C.gold : here ? '#fff1c9' : 'rgba(42,31,46,.18)';
      ctx.beginPath();
      ctx.arc(d0 + i * dx, r.y + r.h / 2, (here ? 3.6 : 2.8) * u, 0, Math.PI * 2);
      ctx.fill();
      if (here) {
        ctx.strokeStyle = C.goldDeep;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    const tx = d0 + dots * dx + 2 * u;
    const barW = Math.min(r.w * 0.36, 170 * u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = boss ? '#7a2e1e' : C.ink;
    ctx.font = this.fit(label, r.x + r.w - barW - 18 * u - tx, F.bar, 0.6);
    ctx.fillText(label, tx, r.y + r.h / 2 + 0.5);
    // the gate of ash's walls (or the boss's life)
    const bx = r.x + r.w - barW - 9 * u, by = r.y + r.h * 0.3, bh = r.h * 0.4;
    const k = boss ? (b.boss ? clamp(b.boss.hp / b.boss.maxHp) : 1) : clamp(b.ash / b.ashMax);
    ctx.fillStyle = 'rgba(42,31,46,.15)';
    ctx.beginPath();
    ctx.roundRect(bx, by, barW, bh, bh / 2);
    ctx.fill();
    const g = ctx.createLinearGradient(bx, 0, bx + barW, 0);
    g.addColorStop(0, '#5a3a4a');
    g.addColorStop(1, '#c2552c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(bh, barW * k), bh, bh / 2);
    ctx.fill();
  }

  // ── the banners along the road: the band's last 40 s ───────────
  /** Drawn by the view between the road's far edge and the fighters. */
  banners(sim: ZastepySim, x0 = this.L.banners.x0, x1 = this.L.banners.x1): void {
    const ctx = this.ctx, L = this.L, u = L.u, B = { ...L.banners, x0, x1 };
    const span = B.x1 - B.x0;
    if (span < 40) return;
    const n = Math.round(clamp(span / (24 * u), 12, 34));
    const bars = traceBars(sim.trace, sim.t, n);
    const step = span / n;
    const foot = B.y, top = B.y - B.h;
    const hOf = (lv: number) => B.h * (0.28 + 0.72 * clamp(lv));
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      if (b.empty || b.phase !== 'rest') continue;
      ctx.fillStyle = 'rgba(143,179,232,.16)';
      ctx.fillRect(B.x0 + i * step, top - 4 * u, step + 0.5, B.h + 4 * u);
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

  /** The next wave's kinds over the gate of ash (the view gives the spot): "Nadchodzą" and an icon each. */
  wavePreview(sim: ZastepySim, x: number, y: number): void {
    const kinds = sim.battle.nextWave;
    if (!kinds || !kinds.length || sim.stage !== 'battle' || this.story) return;
    const ctx = this.ctx, u = this.L.u;
    const uniq = [...new Set(kinds)];
    const sz = 22 * u, gap = 4 * u;
    const w = uniq.length * (sz + gap) + 10 * u;
    const bx = clamp(x - w, 8, this.L.w - w - 8), by = y;
    const pulse = 0.85 + 0.15 * Math.sin(this.clock * 6);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = 'rgba(42,31,46,.72)';
    ctx.beginPath();
    ctx.roundRect(bx, by, w, sz + 16 * u, 8 * u);
    ctx.fill();
    ctx.fillStyle = '#ffd9b0';
    ctx.font = this.F.tiny;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(TXT.soon, bx + 5 * u, by + 2 * u);
    uniq.forEach((k, i) => {
      const cx = bx + 5 * u + i * (sz + gap) + sz / 2;
      this.pose.t = this.clock;
      this.pose.seed = i;
      this.pose.walk = 0;
      ctx.fillStyle = 'rgba(255,236,210,.18)';
      ctx.beginPath();
      ctx.arc(cx, by + 14 * u + sz / 2, sz / 2, 0, Math.PI * 2);
      ctx.fill();
      paintDemon(ctx, k, cx, by + 14 * u + sz - 2 * u, sz / (k === 'cien' || k === 'bestia' || k === 'miotacz' ? 1.75 : 1.2), this.pose);
    });
    ctx.restore();
  }

  // ── the light's row: the lantern, the light, the walls, the pillar, the trumpet ─
  private row(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const lr = L.light, wr = L.walls, R = L.row;
    const play = sim.phase === 'play';
    const rest = sim.restBlock;
    const blind = sim.blind;
    const live = sim.sighted && sim.reliable;
    // the vellum under the whole row
    this.vellum(R.x, R.y - 2 * u, R.w, R.h + 4 * u, 0.8, 12);
    this.lantern(sim, live);
    // the stream: motes from the lantern into what it drives
    const A = L.lantern;
    for (const m of this.motes) {
      const tx = m.rest ? wr.x + 10 * u + m.k * 30 * u : lr.x + clamp(b.light / b.lightMax) * lr.w;
      const ty2 = m.rest ? wr.y + wr.h / 2 : lr.y + lr.h / 2;
      const e = ease.inOutSine(m.k);
      const x = A.x + (tx - A.x) * e, y = A.y - A.r * 0.2 + (ty2 - A.y + A.r * 0.2) * e - Math.sin(m.k * Math.PI) * 14 * u;
      ctx.fillStyle = m.rest ? `rgba(160,195,255,${1 - m.k * 0.5})` : `rgba(255,214,110,${1 - m.k * 0.4})`;
      ctx.beginPath();
      ctx.arc(x, y, (m.rest ? 2.2 : 2.8) * u, 0, Math.PI * 2);
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
    const on = live && sim.mult > 1.02;
    const mx = on ? `×${fmtNum(sim.mult, 1)}` : blind ? '×?' : '×1';
    ctx.textAlign = 'right';
    ctx.fillStyle = on ? '#8a5a08' : 'rgba(42,31,46,.55)';
    ctx.font = on ? F.mult : F.cost;
    ctx.fillText(mx, lr.x + lr.w - 8 * u, lr.y + lr.h / 2 + 0.5);
    // the walls
    const wk = clamp(b.walls / b.wallsMax);
    ctx.fillStyle = 'rgba(42,31,46,.14)';
    ctx.beginPath();
    ctx.roundRect(wr.x, wr.y, wr.w, wr.h, wr.h / 2);
    ctx.fill();
    const mend = rest && sim.calmNow > 0;
    ctx.fillStyle = wk < 0.3 ? '#c2552c' : mend ? '#7fa6e0' : '#b8a27a';
    ctx.beginPath();
    ctx.roundRect(wr.x, wr.y, Math.max(wr.h, wr.w * wk), wr.h, wr.h / 2);
    ctx.fill();
    if (mend) {
      const sh = (this.clock * 0.8) % 1;
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(wr.x + wr.w * wk * sh - 6 * u, wr.y, 12 * u, wr.h);
    }
    ctx.font = this.fit(TXT.walls, wr.w * 0.5, F.tiny);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = C.ink;
    ctx.fillText(`${TXT.walls} ${Math.ceil(b.walls)}`, wr.x + 6 * u, wr.y + wr.h / 2 + 0.5);
    this.pillarBtn(sim);
    this.trumpetBtn(sim, live);
    void play;
  }

  /**
   * The lantern: the large gauge of what the band drives.  Its arc runs from the lower left over the
   * top to the lower right; the threshold is the tick at its top (0.5), gold above it.  In a Natarcie
   * its flame is the stream's strength (×1 … ×2,2 under it); in a Cisza the arc turns blue (the calm
   * that mends the walls); a blind block fogs it; without a signal it rests grey, never low.
   */
  private lantern(sim: ZastepySim, live: boolean): void {
    const ctx = this.ctx, L = this.L, u = L.u, A = L.lantern;
    const rest = sim.restBlock, blind = sim.blind, has = sim.reliable && !blind;
    const v = has ? this.lamp : 0;
    const above = has && v >= 0.5;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    // the disc
    const bg = ctx.createRadialGradient(A.x, A.y - A.r * 0.3, 0, A.x, A.y, A.r);
    bg.addColorStop(0, rest ? '#eef3ff' : '#fffaf0');
    bg.addColorStop(1, rest ? '#c9d7f2' : '#f3e0b5');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(A.x, A.y, A.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // the track and the fill
    const rr = A.r * 0.8, lw = Math.max(5, A.r * 0.2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(42,31,46,.16)';
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(A.x, A.y, rr, a0, a1);
    ctx.stroke();
    if (has) {
      if (above && (live || rest)) {
        ctx.shadowColor = rest ? 'rgba(150,190,255,.9)' : 'rgba(255,200,80,.95)';
        ctx.shadowBlur = 12;
      }
      ctx.strokeStyle = rest ? (above ? '#5f86c9' : '#9fb3d6') : above ? '#e8a21c' : '#d9c79c';
      ctx.beginPath();
      ctx.arc(A.x, A.y, rr, a0, a0 + (a1 - a0) * clamp(v));
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // the threshold tick at the top
    ctx.strokeStyle = rest ? C.blueDeep : C.goldDeep;
    ctx.lineWidth = Math.max(2, 2.4 * u);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(A.x, A.y - rr - lw * 0.9);
    ctx.lineTo(A.x, A.y - rr + lw * 0.9);
    ctx.stroke();
    // the heart: a flame as big as the stream (Natarcie), a wall stone (Cisza), fog (blind)
    const k = clamp((sim.mult - 1) / (RULES.flowTop - 1));
    if (blind) {
      ctx.fillStyle = 'rgba(106,90,140,.85)';
      ctx.beginPath();
      ctx.arc(A.x, A.y, A.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2ecff';
      ctx.font = this.F.btn;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', A.x, A.y + 1);
    } else if (rest) {
      const s = A.r * 0.22, c = sim.calmNow;
      ctx.fillStyle = c > 0 ? '#7fa6e0' : '#b8c3d8';
      for (let i = 0; i < 3; i++) {
        const row = i === 2 ? 1 : 0;
        ctx.fillRect(A.x - s * 1.05 + (i % 2) * s * 1.1 + row * s * 0.55, A.y - s * 0.2 + row * -s * 0.8, s, s * 0.7);
      }
      if (c > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 * Math.abs(Math.sin(this.clock * 3))})`;
        ctx.fillRect(A.x - s * 1.05, A.y - s * 1.0, s * 2.2, s * 1.5);
      }
    } else {
      const fh = A.r * (0.32 + 0.38 * k + 0.04 * Math.sin(this.clock * 9));
      const fx = A.x, fy = A.y + A.r * 0.18;
      const fg = ctx.createRadialGradient(fx, fy - fh * 0.4, 0, fx, fy - fh * 0.4, fh);
      fg.addColorStop(0, '#fffdf0');
      fg.addColorStop(0.5, live && k > 0 ? '#ffd27a' : '#f6e2b0');
      fg.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(fx - fh * 0.42, fy);
      ctx.quadraticCurveTo(fx - fh * 0.2, fy - fh * 1.1, fx, fy - fh * 1.25);
      ctx.quadraticCurveTo(fx + fh * 0.2, fy - fh * 1.1, fx + fh * 0.42, fy);
      ctx.quadraticCurveTo(fx, fy + fh * 0.25, fx - fh * 0.42, fy);
      ctx.fill();
    }
    // the number under it: ×n (or +n/s for the walls)
    if (!L.short || A.r > 22) {
      const txt = blind ? '' : rest ? (RULES.mend * sim.calmNow * sim.battle.wallsMax >= 0.5 ? `+${fmtNum(RULES.mend * sim.calmNow * sim.battle.wallsMax, 0)}/s` : '') : live ? `×${fmtNum(sim.mult, 1)}` : '';
      if (txt) {
        ctx.font = this.F.key;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rest ? C.blueDeep : '#8a5a08';
        ctx.fillText(txt, A.x, A.y + A.r * 0.62);
      }
    }
  }

  private pillarBtn(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, P = L.pillar, b = sim.battle;
    const ready = b.pillarReady && sim.stage === 'battle';
    const standing = b.pillar;
    const pulse = ready ? 0.5 + 0.5 * Math.sin(this.clock * 5) : 0;
    const k = 1 + this.pillarPop * 0.2 + pulse * 0.04;
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.scale(k, k);
    if (ready) {
      ctx.shadowColor = 'rgba(255,240,200,.95)';
      ctx.shadowBlur = 10 + pulse * 8;
    }
    ctx.fillStyle = ready ? '#ffffff' : 'rgba(255,248,232,.85)';
    ctx.beginPath();
    ctx.arc(0, 0, P.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // the ring: the cooldown (or the time it still stands)
    const ring = standing ? clamp(standing.t / standing.sec) : 1 - clamp(b.pillarCd / Math.max(0.01, b.pillarStats.cool));
    ctx.strokeStyle = 'rgba(42,31,46,.14)';
    ctx.lineWidth = 3.5 * u;
    ctx.beginPath();
    ctx.arc(0, 0, P.r - 3 * u, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = standing ? C.gold : ready ? '#d0b26a' : 'rgba(150,130,100,.7)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, P.r - 3 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring);
    ctx.stroke();
    // the cloud column icon
    ctx.fillStyle = ready || standing ? '#f0e6d0' : 'rgba(200,190,170,.8)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(Math.sin(i * 2 + this.clock * (ready ? 2 : 0)) * P.r * 0.08, P.r * (0.35 - i * 0.22), P.r * (0.26 - i * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ready || standing ? 'rgba(255,190,90,.75)' : 'rgba(200,170,120,.4)';
    ctx.fillRect(-P.r * 0.07, -P.r * 0.4, P.r * 0.14, P.r * 0.75);
    ctx.restore();
    if (!L.short) {
      const bx = P.x + P.r * 0.72, by = P.y - P.r * 0.72;
      ctx.fillStyle = ready ? C.goldDeep : 'rgba(42,31,46,.55)';
      ctx.beginPath();
      ctx.arc(bx, by, 7 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e8';
      ctx.font = this.F.key;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('H', bx, by + 0.5);
    }
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

  /** Where a card sits (for the coach mark). */
  cardAt(id: HostId): { x: number; y: number } | null {
    const c = this.cardRects().find(r => r.id === id);
    return c ? { x: c.r.x + c.r.w / 2, y: c.r.y } : null;
  }

  /** The shades coming or on the road that a card is the bane of. */
  private wanted(sim: ZastepySim): Set<WaveId> {
    const out = new Set<WaveId>();
    for (const k of sim.battle.nextWave ?? []) out.add(k);
    for (const f of sim.battle.fighters) if (f.side === -1 && f.state !== 'gone' && f.x < sim.battle.road - 1) out.add(f.kind as WaveId);
    return out;
  }

  private cardsRow(sim: ZastepySim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F, b = sim.battle;
    const gl = (this.gate = gateLevel(sim.p));
    const fighting = sim.stage === 'battle' && sim.phase !== 'done';
    const full = b.light >= b.lightMax - 0.5;
    const want = this.wanted(sim);
    const age = ageOf(b.battle);
    this.cardRects().forEach(({ id, r }, i) => {
      const st = HOST[id];
      const open = st.gate <= gl;
      const cool = b.cool[id] / st.cool;
      const afford = b.light >= st.cost;
      const ready = open && fighting && cool <= 0 && afford;
      const bane = BANE[id];
      const hot = open && fighting && bane !== null && want.has(bane);
      const press = this.pressT.get(id) ?? 0, shake = this.shakeT.get(id) ?? 0;
      ctx.save();
      ctx.translate(r.x + r.w / 2 + Math.sin(shake * 60) * shake * 10 * u, r.y + r.h / 2 - (hot ? 3 * u : 0));
      const sc = 1 - press * 0.4 + (ready && (full || hot) ? 0.03 * Math.sin(this.clock * 5 + i) : 0);
      ctx.scale(sc, sc);
      ctx.translate(-r.w / 2, -r.h / 2);
      if (ready || hot) {
        ctx.shadowColor = hot ? 'rgba(255,170,60,.9)' : 'rgba(255,200,80,.8)';
        ctx.shadowBlur = hot ? 18 : full ? 16 : 9;
      }
      const g = ctx.createLinearGradient(0, 0, 0, r.h);
      g.addColorStop(0, open ? '#fffaf0' : 'rgba(225,215,200,.75)');
      g.addColorStop(1, open ? (hot ? '#ffe2a8' : '#f3e3bd') : 'rgba(200,188,170,.75)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(0, 0, r.w, r.h, 9 * u);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = hot ? '#e0861c' : ready ? C.gold : 'rgba(185,127,31,.4)';
      ctx.lineWidth = hot ? 3 : ready ? 2.5 : 1;
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
      this.pose.age = age;
      this.pose.walk = 0;
      ctx.globalAlpha = open ? 1 : 0.35;
      paintHost(ctx, id, r.w / 2 - (id === 'jezdziec' ? 0.1 * s : 0) + 6 * u, r.h - 20 * u * (L.short ? 0.6 : 1) + (id === 'serafin' ? -0.1 * s : 0), s, this.pose);
      ctx.globalAlpha = 1;
      if (open && cool > 0) {
        ctx.fillStyle = 'rgba(42,31,46,.45)';
        ctx.fillRect(0, 0, r.w, r.h * cool);
      }
      if (open && !afford) {
        ctx.fillStyle = 'rgba(255,250,240,.45)';
        ctx.fillRect(0, 0, r.w, r.h);
        ctx.fillStyle = 'rgba(232,176,74,.6)';
        ctx.fillRect(0, r.h - 3 * u, r.w * clamp(b.light / st.cost), 3 * u);
      }
      ctx.restore();
      // the bane: a small shade at the lower left, "×2" when it is coming
      if (bane && open && !L.short) {
        const bx = 10 * u, by = r.h - 22 * u;
        ctx.fillStyle = hot ? 'rgba(224,134,28,.95)' : 'rgba(42,31,46,.12)';
        ctx.beginPath();
        ctx.arc(bx, by, 9 * u, 0, Math.PI * 2);
        ctx.fill();
        this.pose.age = 0;
        ctx.globalAlpha = hot ? 1 : 0.55;
        paintDemon(ctx, bane, bx, by + 7 * u, (bane === 'cien' || bane === 'bestia' || bane === 'miotacz' ? 9 : 12) * u, this.pose);
        ctx.globalAlpha = 1;
        if (hot) {
          ctx.font = F.key;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#8a3a08';
          ctx.fillText('×2', bx + 11 * u, by + 0.5);
        }
      }
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
    if (this.story) return { kind: 'story' };
    if (sim.stage === 'upgrade' && this.upA > 0.5) {
      for (const o of this.offerRects(sim)) if (inside(x, y, o.r)) return { kind: 'offer', i: o.i };
      if (inside(x, y, this.goRect())) return { kind: 'go' };
      if (inside(x, y, L.upgrade)) return { kind: 'none' };
    }
    const T = L.trumpet, P = L.pillar;
    if (Math.hypot(x - T.x, y - T.y) <= T.r + 6 * u) return { kind: 'trumpet' };
    if (Math.hypot(x - P.x, y - P.y) <= P.r + 6 * u) return { kind: 'pillar' };
    const gl = gateLevel(sim.p);
    for (const c of this.cardRects(gl)) if (HOST[c.id].gate <= gl && inside(x, y, { x: c.r.x - 2, y: c.r.y - 4 * u, w: c.r.w + 4, h: c.r.h + 8 * u })) return { kind: 'card', id: c.id };
    // the rest of the bottom rows is no road
    if (y >= L.row.y - 4 * u) return { kind: 'none' };
    return null;
  }

  // ── the card between battles ────────────────────────────────────
  private offerRects(sim: ZastepySim): { i: number; r: Rect }[] {
    const U = this.L.upgrade, u = this.L.u, n = sim.offers.length;
    if (!n) return [];
    const pad = 10 * u, gap = 8 * u;
    const top = U.y + (this.L.short ? 58 : 82) * u, bottom = this.goRect().y - 8 * u;
    const narrow = U.w < 470 * u;
    if (narrow) {
      // stacked: one offer per line
      const h = Math.max(30, Math.min(48 * u, (bottom - top - gap * (n - 1)) / n));
      return sim.offers.map((_, i) => ({ i, r: { x: U.x + pad, y: top + i * (h + gap), w: U.w - 2 * pad, h } }));
    }
    const w = (U.w - 2 * pad - gap * (n - 1)) / n;
    const h = Math.max(40, Math.min(78 * u, bottom - top));
    return sim.offers.map((_, i) => ({ i, r: { x: U.x + pad + i * (w + gap), y: top, w, h } }));
  }

  private goRect(): Rect {
    const U = this.L.upgrade, u = this.L.u;
    const w = Math.min(220 * u, U.w - 40 * u), h = 30 * u;
    return { x: U.x + (U.w - w) / 2, y: U.y + U.h - h - 9 * u, w, h };
  }

  /** Where the first offer sits (for the coach mark). */
  offerAt(): { x: number; y: number } | null {
    const U = this.L.upgrade;
    return { x: U.x + U.w / 2, y: U.y + 30 * this.L.u };
  }

  /** An offer's name and its numbers before → after. */
  private offerText(sim: ZastepySim, o: Offer): { name: string; nums: string } {
    const p = sim.p, age = ageOf(p.battle);
    if (o.what === 'gate') {
      const a = gateLevel(p);
      return {
        name: t('up.gate', { n: o.level }),
        nums: t('up.gateNums', { a: wallsFor(a), b: wallsFor(o.level), c: fmtNum(flowFor(a), 1), d: fmtNum(flowFor(o.level), 1) }),
      };
    }
    if (o.what === 'hero') {
      const a = pillarFor(heroLevel(p)), b = pillarFor(o.level);
      return { name: t('up.hero', { n: o.level }), nums: t('up.heroNums', { a: fmtNum(a.sec, a.sec % 1 ? 1 : 0), b: fmtNum(b.sec, b.sec % 1 ? 1 : 0), c: fmtNum(a.cool, a.cool % 1 ? 1 : 0), d: fmtNum(b.cool, b.cool % 1 ? 1 : 0) }) };
    }
    const a = unitStats(o.what, o.level - 1, age), b = unitStats(o.what, o.level, age);
    return { name: t('up.unit', { name: HOST_NAME[o.what], n: o.level }), nums: t('up.unitNums', { a: a.dmg, b: b.dmg, c: a.hp, d: b.hp }) };
  }

  private upgrade(sim: ZastepySim): void {
    if (this.upA < 0.02 || this.story) return;
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
    const gt = fmtNum(sim.p.gold);
    ctx.font = F.cost;
    ctx.textAlign = 'right';
    ctx.fillText(gt, U.x + U.w - 14 * u, U.y + 18 * u);
    coin(ctx, U.x + U.w - 24 * u - ctx.measureText(gt).width, U.y + 18 * u, 7 * u);
    // the chapter's map: five battles, the stars won, the boss gate, where the next battle is
    this.mapStrip(sim, U.x + 14 * u, U.y + (L.short ? 34 : 40) * u, U.w - 28 * u);
    for (const { i, r } of this.offerRects(sim)) {
      const o = sim.offers[i];
      ctx.fillStyle = o.can ? '#fff6dc' : 'rgba(230,220,205,.8)';
      ctx.strokeStyle = o.can ? C.gold : 'rgba(150,130,100,.4)';
      ctx.lineWidth = o.can ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 10 * u);
      ctx.fill();
      ctx.stroke();
      const iw = Math.min(r.h, 40 * u), ix = r.x + 4 * u + iw / 2, base = r.y + r.h - 5 * u;
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      if (o.what === 'gate') {
        paintLightGate(ctx, ix + iw * 0.25, base, Math.max(3, (r.h - 10 * u) / 5.2), { glow: 0.5, walls: 1, t: this.clock, mend: 0, age: ageOf(sim.p.battle) });
      } else if (o.what === 'hero') {
        ctx.fillStyle = '#f3ead8';
        for (let j = 0; j < 4; j++) {
          ctx.beginPath();
          ctx.arc(ix, base - (j + 0.5) * (r.h - 10 * u) / 4.2, iw * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(255,190,90,.7)';
        ctx.fillRect(ix - iw * 0.04, base - (r.h - 10 * u), iw * 0.08, r.h - 10 * u);
      } else {
        const big = o.what === 'jezdziec' || o.what === 'archaniol' || o.what === 'serafin';
        this.pose.t = this.clock;
        this.pose.age = ageOf(sim.p.battle);
        paintHost(ctx, o.what, ix, base, Math.max(4, (r.h - 10 * u) / (big ? 2.2 : 1.6)), this.pose);
      }
      ctx.restore();
      const { name, nums } = this.offerText(sim, o);
      const tx = r.x + iw + 10 * u, tw = r.x + r.w - 8 * u - tx;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = C.ink;
      const stacked = r.h < 56 * u;
      ctx.font = this.fit(name, stacked ? tw * 0.55 : tw, F.upName, 0.55);
      ctx.fillText(name, tx, r.y + r.h * (stacked ? 0.33 : 0.24));
      ctx.fillStyle = 'rgba(42,31,46,.75)';
      ctx.font = this.fit(nums, tw, F.upNums, 0.55);
      ctx.fillText(nums, tx, r.y + r.h * (stacked ? 0.72 : 0.52));
      const pt = fmtNum(o.price);
      ctx.font = F.cost;
      const px = stacked ? r.x + r.w - 10 * u - ctx.measureText(pt).width : tx + 10 * u;
      const py = r.y + r.h * (stacked ? 0.33 : 0.8);
      coin(ctx, px - 9 * u, py, 5 * u);
      ctx.fillStyle = o.can ? C.ink : '#9a3a20';
      ctx.fillText(pt, px, py + 0.5);
      // the key
      if (!L.short) {
        ctx.font = F.key;
        ctx.fillStyle = 'rgba(42,31,46,.45)';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(String(i + 1), r.x + r.w - 6 * u, r.y + 4 * u);
      }
    }
    if (this.boughtT > 0) {
      ctx.globalAlpha = this.upA * this.boughtT;
      ctx.font = F.btn;
      ctx.fillStyle = C.goldDeep;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('up.bought'), L.w / 2, U.y + 18 * u - (1 - this.boughtT) * 8 * u);
      ctx.globalAlpha = this.upA;
    }
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
    ctx.textBaseline = 'middle';
    const lab = `${TXT.upGo} · ${t('up.auto', { n: Math.ceil(left) })}`;
    ctx.font = this.fit(lab, g.w - 16 * u, F.btn, 0.6);
    ctx.fillText(lab, g.x + g.w / 2, g.y + g.h / 2 + 0.5);
    ctx.restore();
  }

  /** The chapter's five battles in a strip: stars on the won ones, the boss gate, the next battle pulsing. */
  private mapStrip(sim: ZastepySim, x: number, y: number, w: number): void {
    const ctx = this.ctx, u = this.L.u, p = sim.p;
    const at = chapterOf(p.battle), n = RULES.chapter;
    const label = t('map.chapter', { c: at.chapter + 1, age: AGES[ageOf(p.battle)] });
    ctx.font = this.fit(label, w * 0.42, this.F.tiny, 0.6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(42,31,46,.7)';
    ctx.fillText(label, x, y + 10 * u);
    const mx = x + Math.min(w * 0.45, ctx.measureText(label).width + 12 * u), mw = x + w - mx - 12 * u;
    const step = mw / (n - 1);
    ctx.strokeStyle = 'rgba(185,127,31,.5)';
    ctx.setLineDash([4 * u, 4 * u]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mx, y + 8 * u);
    ctx.lineTo(mx + mw, y + 8 * u);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < n; i++) {
      const b = at.chapter * n + i, cx = mx + i * step, cy = y + 8 * u;
      const here = b === p.battle, done = b < p.battle, boss = i === n - 1;
      const pulse = here ? 1 + 0.15 * Math.sin(this.clock * 5) : 1;
      ctx.fillStyle = boss ? (done ? C.goldDeep : '#3a2c3c') : done ? C.gold : here ? '#fff1c9' : '#efe6d6';
      ctx.strokeStyle = here ? C.goldDeep : 'rgba(42,31,46,.35)';
      ctx.lineWidth = here ? 2.5 : 1;
      ctx.beginPath();
      ctx.arc(cx, cy, (boss ? 8 : 6) * u * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (boss && !done) {
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath();
        ctx.arc(cx - 2.4 * u, cy - 0.5 * u, 1.2 * u, 0, Math.PI * 2);
        ctx.arc(cx + 2.4 * u, cy - 0.5 * u, 1.2 * u, 0, Math.PI * 2);
        ctx.fill();
      }
      const st = p.stars[b] ?? 0;
      for (let s = 0; s < 3; s++) {
        ctx.fillStyle = s < st ? C.gold : 'rgba(42,31,46,.14)';
        star(ctx, cx - 7 * u + s * 7 * u, cy + 14 * u, 3.2 * u);
      }
    }
  }

  // ── the floats, the stars, the toasts ───────────────────────────
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

  private drawStars(): void {
    const s = this.stars;
    if (!s || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const cy = L.cardY + 40 * u, r = 20 * u;
    const out = s.t > 2.1 ? 1 - (s.t - 2.1) / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, out);
    for (let i = 0; i < 3; i++) {
      const k = clamp((s.t - 0.25 - i * 0.22) / 0.3);
      const sc = k > 0 ? ease.outBack(k) : 0;
      const cx = L.w / 2 + (i - 1) * r * 2.4;
      ctx.save();
      ctx.translate(cx, cy - (i === 1 ? 8 * u : 0));
      ctx.scale(Math.max(0.001, sc), Math.max(0.001, sc));
      ctx.fillStyle = 'rgba(42,31,46,.25)';
      star(ctx, 2 * u, 3 * u, r);
      ctx.fillStyle = i < s.n ? C.gold : 'rgba(255,248,232,.7)';
      star(ctx, 0, 0, r);
      ctx.strokeStyle = i < s.n ? C.goldDeep : 'rgba(150,130,100,.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  private drawToast(): void {
    const c = this.toasts[0];
    if (!c || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const inK = ease.outBack(clamp(c.t / 0.3)), outK = clamp((c.dur - c.t) / 0.35);
    const w = Math.min(L.cardW, L.w - 32), h = (c.sub ? 54 : 36) * u;
    const x = L.cardX - w / 2, y = L.cardY - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK) * (this.upA > 0.5 ? 0.25 : 1);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-(x + w / 2), -(y + h / 2));
    ctx.shadowColor = 'rgba(40,30,20,.25)';
    ctx.shadowBlur = 14;
    this.vellum(x, y, w, h, 0.95);
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = c.color;
    ctx.font = this.fit(c.title, w - 24 * u, F.cardTitle);
    ctx.fillText(c.title, L.cardX, y + 8 * u);
    if (c.sub) {
      ctx.fillStyle = 'rgba(42,31,46,.8)';
      ctx.font = this.fit(c.sub, w - 24 * u, F.cardSub, 0.62);
      ctx.fillText(c.sub, L.cardX, y + 31 * u);
    }
    ctx.restore();
  }

  // ── Tymek ───────────────────────────────────────────────────────
  private drawBubble(): void {
    const b = this.bubble;
    const ctx = this.ctx, L = this.L, u = L.u, T = L.tymek;
    if (this.story || this.upA > 0.5) return;
    const talk = b ? 1 : 0;
    // the portrait stays in its corner; it lights up when he speaks
    ctx.save();
    ctx.globalAlpha = b ? 1 : 0.75;
    paintTymek(ctx, T.x, T.y, T.r, this.clock, b ? clamp(1 - b.t / Math.max(0.1, b.dur - 0.4)) * talk : 0);
    ctx.restore();
    if (!b) return;
    const inK = ease.outBack(clamp(b.t / 0.25)), outK = clamp((b.dur - b.t) / 0.3);
    const lines = this.lines(b.text, T.maxW - 20 * u, this.F.say, 3);
    ctx.font = this.F.say;
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    const lh = 16 * u, w = tw + 20 * u, h = lines.length * lh + 12 * u;
    const x = T.x + T.r + 10 * u, y = T.y - Math.min(h / 2, T.r);
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(x, T.y);
    ctx.scale(inK, inK);
    ctx.translate(-x, -T.y);
    ctx.fillStyle = 'rgba(255,252,242,.97)';
    ctx.strokeStyle = 'rgba(185,127,31,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10 * u);
    ctx.moveTo(x + 1, T.y - 5 * u);
    ctx.lineTo(x - 8 * u, T.y);
    ctx.lineTo(x + 1, T.y + 5 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 6 * u + i * lh));
    ctx.restore();
  }

  // ── the story cards ─────────────────────────────────────────────
  private drawStory(): void {
    const s = this.story;
    this.storyRect = null;
    if (!s) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, s.t / 0.35) * (1 - Math.min(1, s.out));
    const open = s.kind === 'open';
    const w = Math.min(L.w - 24, (open ? 440 : 360) * u);
    const title = open ? TXT.openTitle : AGES[s.age];
    const text = open ? TXT.openText : AGE_STORY[s.age];
    const tl = this.lines(text, w - 32 * u, F.storyText, 7);
    const art = open ? 0 : 74 * u;
    let vh = 0;
    if (open) {
      const key = `${Math.round(w)}`;
      if (!this.verse || this.verseKey !== key) {
        this.verse = layoutPassage(ctx, passage('rev12.7-8'), w - 40 * u, 110 * u, { max: 15 * u, min: 10 });
        this.verseKey = key;
      }
      vh = this.verse.height + 14 * u;
    }
    const h = 48 * u + art + tl.length * 18 * u + vh + 28 * u;
    const x = (L.w - w) / 2;
    const y = clamp((L.h - h) / 2, 6, Math.max(6, L.h - h - 6));
    this.storyRect = { x, y, w, h };
    // a veil over the battle (it waits)
    ctx.save();
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = '#2a1f2e';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.restore();
    const k = s.t < 0.3 ? ease.outBack(s.t / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = 'rgba(40,30,20,.35)';
    ctx.shadowBlur = 20;
    this.vellum(0, 0, w, h, 0.98, 14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(16 * u, 42 * u, w - 32 * u, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.ink;
    ctx.font = this.fit(title, w - 28 * u, F.storyTitle);
    ctx.fillText(title, w / 2, 12 * u);
    if (art) {
      // the gate in its new age
      paintLightGate(ctx, w / 2 + 1.15 * art / 6, 50 * u + art - 4 * u, art / 6.2, { glow: 0.7, walls: 1, t: this.clock, mend: 0, age: s.age });
      for (const [i, id] of (['straznik', 'tarczownik'] as const).entries()) {
        this.pose.t = this.clock;
        this.pose.age = s.age;
        this.pose.seed = i;
        paintHost(ctx, id, w / 2 + (i ? 1 : -1) * art * 0.75, 50 * u + art - 4 * u, art / 2.4, this.pose);
      }
    }
    ctx.font = F.storyText;
    ctx.fillStyle = 'rgba(42,31,46,.85)';
    tl.forEach((l, i) => ctx.fillText(l, w / 2, 52 * u + art + i * 18 * u));
    if (open && this.verse) drawPassage(ctx, passage('rev12.7-8'), this.verse, w / 2, 52 * u + tl.length * 18 * u + 10 * u, { text: '#5a4020', ref: 'rgba(90,64,32,.7)' });
    ctx.font = font(650, 10 * u, SANS);
    ctx.fillStyle = 'rgba(58,42,24,.5)';
    ctx.fillText(TXT.storyTap, w / 2, h - 18 * u);
    ctx.restore();
  }

  // ── the evening ─────────────────────────────────────────────────
  private finale(): void {
    if (this.finaleA < 0.02 || this.story) return;
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
