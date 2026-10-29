/**
 * Źródła's play view, all on the canvas.  It reads the sim (sim.ts) and never changes it: the valley
 * (board.ts, one painter per valley, two while one slides away and the next comes in), the HUD
 * (hud.ts), the juice on every event — ripples where a field joins, the depth's word rising, the
 * light running from the springs to the fields when a valley closes, a curb stone flying to its
 * spring, the rain, the pair fluttering down to its nest — the light moving from a pre-dawn
 * blue-violet to clear morning with the session's progress (never with the signal), and the
 * finale: the day's strip of valleys along the road, the count, the album card and the day's tree.
 * The calibration intro is intro.ts.  With reduced motion slides become cross-fades, nothing shakes,
 * and the stones still turn for 120 ms.
 */
import { fmtNum } from '../../i18n';
import { Particles, clamp, ease } from '../kit/juice';
import { ValleyPainter, paintMini, type BoardState } from './board';
import { ALBUM, DEPTH_NAME, STAGES, TREES } from './content';
import { Hud, albumCard, plus } from './hud';
import { cap, t } from './i18n';
import { CampIntro } from './intro';
import { BOTTOM, TOP, cellCentre, layout, type Layout } from './layout';
import type { ZrodlaProgress } from './meta';
import { C, SANS, SERIF, font, paintPlace, paintTree, rgba } from './paint';
import { RULES, isPush, type Run, type SimEvent, type ZrodlaSim } from './sim';

const TAU = Math.PI * 2;
const SLIDE = RULES.slide;

export class ZrodlaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 390;
  private h = 844;
  private dpr = 1;
  private started = false;
  private clock = 0;
  private playT = 0;
  /** play fades in from the intro */
  private fadeIn = 1;
  private readonly painters = new WeakMap<Run, ValleyPainter>();
  private readonly layouts = new Map<string, Layout>();
  private readonly hud: Hud;
  private readonly particles = new Particles(260);
  private readonly camp = new CampIntro();
  private slideT: number = SLIDE;
  private nestT = 1;
  private rainT = 0;
  private glint = 0;
  /** the light running through a closed valley's channels: seconds since it closed (−1: none) */
  private waveT = -1;
  private finaleT = -1;
  private readonly played: Run[] = [];
  private readonly at = { x: 0, y: 0 };
  private readonly st: BoardState = {
    t: 0, phi: 0, flowing: false, blind: false, gauge: false, veil: 0, haze: 0, curb: 0, hint: -1, cursor: -1, rest: false, reduced: false, nestIn: 1,
  };

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; plannedSec: number }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.st.reduced = opts.reducedMotion;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.layouts.clear();
  }

  /** The layout for a valley of the run's size at this screen size. */
  layoutOf(r: Run): Layout {
    const key = `${r.v.cols}x${r.v.rows}`;
    let L = this.layouts.get(key);
    if (!L) {
      L = layout(this.w, this.h, r.v.cols, r.v.rows);
      this.layouts.set(key, L);
    }
    return L;
  }

  private painter(r: Run): ValleyPainter {
    let p = this.painters.get(r);
    if (!p) {
      p = new ValleyPainter(r);
      this.painters.set(r, p);
    }
    return p;
  }

  /** What the title line and the card slot show now (tests and debugging). */
  get showing(): { title: string | null; card: string | null } { return this.hud.showing; }

  /** The calibration intro's frame. */
  intro(dt: number, p: number, progress: ZrodlaProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.camp.draw(ctx, this.w, this.h, dt, p, progress, this.dpr, this.opts.reducedMotion);
  }

  start(sim: ZrodlaSim): void {
    this.started = true;
    this.fadeIn = 1;
    this.played.length = 0;
    this.played.push(sim.run);
  }

  // ── reacting to the rules ───────────────────────────────────────
  on(e: SimEvent, sim: ZrodlaSim): void {
    const r = sim.run, L = this.layoutOf(r), u = L.u, S = L.S, reduced = this.opts.reducedMotion;
    const field = (fi: number) => cellCentre(L, r.v.fields[fi], this.at);
    switch (e.type) {
      case 'turn': {
        this.painter(r).turned(e.cell, e.dir);
        const c = cellCentre(L, e.cell, this.at);
        if (!reduced) this.particles.burst(c.x, c.y + S * 0.3, 4, { color: 'rgba(170,150,118,.7)', speed: 40, spread: Math.PI, angle: Math.PI / 2, g: 60, life: 0.4, size: 1.6 });
        break;
      }
      case 'join': {
        const c = field(e.field);
        this.particles.burst(c.x, c.y, 1, { color: C.foam, speed: 0, life: 0.8, size: S * 0.16, shape: 'ring', g: 0 });
        if (!reduced) this.particles.burst(c.x, c.y, 8, { color: C.water, speed: 70, spread: TAU, g: 120, drag: 2, life: 0.6, size: 2 });
        break;
      }
      case 'meet': {
        const c = field(e.field);
        this.hud.float(t('fx.meet'), c.x, c.y - S * 0.3, '#16707d', 15 * u, 1.8);
        this.particles.burst(c.x - S * 0.15, c.y, 1, { color: C.foam, speed: 0, life: 1, size: S * 0.22, shape: 'ring', g: 0 });
        this.particles.burst(c.x + S * 0.15, c.y, 1, { color: C.foam, speed: 0, life: 1, size: S * 0.22, shape: 'ring', g: 0 });
        break;
      }
      case 'depth': {
        const c = field(e.field);
        this.hud.float(cap(DEPTH_NAME[e.level]), c.x, c.y - S * 0.2, e.level >= 3 ? '#145a7c' : '#1a7f8c', (13 + e.level) * u, 1.6);
        if (!reduced) this.particles.burst(c.x, c.y, 10, { color: C.foam, speed: 90, spread: Math.PI * 0.9, g: 220, drag: 1.5, life: 0.7, size: 1.8 });
        break;
      }
      case 'closed': {
        this.hud.card({ kind: 'closed', title: t('card.closed', { sec: t('sec', { n: fmtNum(Math.max(1, Math.round(e.sec))) }) }), sub: '', icon: -1, dawn: false }, { dur: 3, min: 2, rank: 1 });
        if (!e.hidden) {
          this.hud.float(t('fx.bonus'), L.bx + L.bw / 2, L.by + S * 0.4, '#16707d', 22 * u, 1.6);
          this.waveT = 0;
        }
        break;
      }
      case 'oneLeft':
        this.hud.float(t('fx.oneLeft'), L.bx + L.bw / 2, L.by + L.bh * 0.08, C.ink, 14 * u, 1.8);
        break;
      case 'short': {
        const c = field(e.field);
        this.hud.float(t(`fx.short.${e.level as 1 | 2 | 3 | 4}`, { n: e.n }), c.x, c.y - S * 0.15, '#145a7c', 13 * u, 2.4);
        break;
      }
      case 'steady':
        this.hud.pulse();
        break;
      case 'telegraph':
        this.glint = RULES.telegraph;
        break;
      case 'blockStart': {
        const k = e.block.kind;
        const name = t(k === 'warmup' ? 'block.warmup' : k === 'oaza' ? 'block.oaza' : k === 'sela' ? 'block.sela' : e.block.blind ? 'block.blind' : 'block.nurt');
        this.hud.title(name, k === 'sela' ? '#3f6a3a' : '#1c5f74', 28 * u, { dur: 2.2, min: 1.4, rank: 2 });
        break;
      }
      case 'curb': {
        this.hud.title(t('fx.curb'), C.ink, 21 * u, { dur: 2, min: 1.4, rank: 1 });
        for (const s of r.v.sources) {
          const c = cellCentre(L, s.cell, this.at);
          this.particles.burst(c.x, c.y, 6, { color: '#f1e8d6', speed: 60, spread: TAU, g: 0, drag: 2.5, life: 0.8, size: 2.4, shape: 'square' });
        }
        break;
      }
      case 'reveal':
        this.hud.card({ kind: 'reveal', title: e.fields > 0 ? t('card.reveal', { n: e.fields, depth: DEPTH_NAME[Math.max(1, e.deepest)] }) : t('card.revealNone'), sub: t('block.blind'), icon: -1, dawn: false }, { dur: 3.6, min: 2.6, rank: 0 });
        this.hud.pulse();
        break;
      case 'rain':
        this.rainT = RULES.rainSec;
        this.hud.title(t('fx.rain'), '#1c5f74', 22 * u, { dur: 2, min: 1.2, rank: 2 });
        for (let fi = 0; fi < r.v.fields.length; fi++) {
          const c = field(fi);
          this.hud.float(plus(RULES.rainJars), c.x, c.y, '#1a7f8c', 15 * u, 2.2);
        }
        break;
      case 'nest':
        this.nestT = 0;
        this.hud.title(t(e.upgrade || e.nest.young ? 'fx.nest.young' : e.nest.bird === 'sparrow' ? 'fx.nest.sparrow' : 'fx.nest.swallow'), '#5a4128', 21 * u, { dur: 2.4, min: 1.6, rank: 0 });
        break;
      case 'valley':
        if (this.played[this.played.length - 1] !== sim.run) this.played.push(sim.run);
        if (sim.prev) this.slideT = 0;
        this.painter(sim.run).settle();
        this.waveT = -1;
        break;
      case 'stage':
        this.hud.title(t('fx.stage', { n: e.stage + 1, name: STAGES[e.stage].name }), '#5a4128', 22 * u, { dur: 2.6, min: 2, rank: 0 });
        break;
      case 'finale':
        this.hud.clearTitles();
        this.finaleT = 0;
        break;
      default:
        break;
    }
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: ZrodlaSim): void {
    this.clock += dt;
    if (!this.started) return;
    if (sim.phase === 'play') this.playT += dt;
    this.fadeIn = Math.max(0, this.fadeIn - dt / 0.6);
    this.slideT = Math.min(SLIDE, this.slideT + dt);
    this.nestT = Math.min(1, this.nestT + dt / RULES.nestBeat);
    this.rainT = Math.max(0, this.rainT - dt);
    this.glint = Math.max(0, this.glint - dt);
    if (this.waveT >= 0) this.waveT += dt;
    if (this.finaleT >= 0) this.finaleT += dt;
    this.painter(sim.run).update(dt, this.opts.reducedMotion, sim.blind);
    if (sim.prev) this.painter(sim.prev).update(dt, this.opts.reducedMotion);
    this.hud.update(dt, sim);
    // the rain: drops falling over the valley for its first 5 s
    if (this.rainT > 0) {
      const L = this.layoutOf(sim.run);
      const n = this.opts.reducedMotion ? 0 : Math.round(dt * 40);
      for (let i = 0; i < n; i++) {
        this.particles.burst(L.bx + Math.random() * L.bw, L.by - 20 + Math.random() * L.bh * 0.5, 1, { color: 'rgba(207,246,243,.75)', speed: 260, angle: Math.PI * 0.56, spread: 0.05, g: 400, drag: 0, life: 0.5, size: 1.6, shape: 'spark' });
      }
      if (Math.random() < dt * 6) {
        this.particles.burst(L.bx + Math.random() * L.bw, L.by + Math.random() * L.bh, 1, { color: C.foam, speed: 0, life: 0.9, size: L.S * 0.12, shape: 'ring', g: 0 });
      }
    }
    this.particles.update(dt);
  }

  draw(sim: ZrodlaSim): void {
    if (!this.started) return;
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const r = sim.run, L = this.layoutOf(r), st = this.st;
    st.t = this.clock;
    const b = sim.phase === 'play' ? sim.block : null;
    st.phi = b && isPush(b.kind) ? sim.phi : b?.kind === 'warmup' ? 0.5 : 0;
    st.flowing = sim.flowing;
    st.blind = sim.blind;
    st.gauge = !!b && (b.kind === 'warmup' || (isPush(b.kind) && !b.blind)) && sim.flowing;
    st.veil = sim.veil;
    st.haze = sim.haze;
    st.curb = sim.curbStones;
    st.hint = sim.hint;
    st.cursor = sim.cursorShown && sim.flowing ? sim.cursor : -1;
    st.rest = !!b && b.kind === 'sela';
    st.nestIn = this.nestT;
    if (this.glint > 0 && b?.kind === 'sela') st.phi = Math.max(st.phi, 0.4 * (this.glint / RULES.telegraph));
    // the valley, sliding in after the last (a cross-fade with reduced motion)
    const k = ease.inOutSine(clamp(this.slideT / SLIDE));
    if (sim.prev && k < 1) {
      const pl = this.layoutOf(sim.prev), pst = { ...st, hint: -1, cursor: -1, veil: 1 };
      if (this.opts.reducedMotion) {
        this.painter(sim.prev).draw(ctx, pl, this.dpr, pst);
        ctx.globalAlpha = k;
        this.painter(r).draw(ctx, L, this.dpr, st);
        ctx.globalAlpha = 1;
      } else {
        this.painter(sim.prev).draw(ctx, pl, this.dpr, pst, -k * w);
        this.painter(r).draw(ctx, L, this.dpr, st, (1 - k) * w);
      }
    } else this.painter(r).draw(ctx, L, this.dpr, st);
    this.wave(sim, L);
    this.particles.draw(ctx);
    this.light();
    const fin = this.finaleT >= 0 ? clamp((this.finaleT - 1) / 0.6) : 0;
    this.hud.draw(sim, 1 - fin);
    if (fin > 0) this.finale(sim, fin);
    if (this.fadeIn > 0) {
      ctx.fillStyle = rgba('#2a2438', 0.85 * this.fadeIn);
      ctx.fillRect(0, 0, w, h);
    }
  }

  /** The light running through a closed valley: from the springs out to the fields, cell by cell. */
  private wave(sim: ZrodlaSim, L: Layout): void {
    if (this.waveT < 0 || this.opts.reducedMotion) return;
    const f = sim.run.v.flow, S = L.S, ctx = this.ctx;
    let max = 1;
    for (let k = 0; k < f.count; k++) max = Math.max(max, f.dist[f.order[k]]);
    const front = (this.waveT / 1.2) * (max + 2);
    if (front > max + 3) {
      this.waveT = -1;
      return;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < f.count; k++) {
      const i = f.order[k], a = clamp(1 - Math.abs(f.dist[i] - front) / 1.5);
      if (a <= 0) continue;
      const c = cellCentre(L, i, this.at);
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, S * 0.7);
      g.addColorStop(0, rgba('#fff6d8', 0.5 * a));
      g.addColorStop(1, rgba('#fff6d8', 0));
      ctx.fillStyle = g;
      ctx.fillRect(c.x - S * 0.7, c.y - S * 0.7, S * 1.4, S * 1.4);
    }
    ctx.restore();
  }

  /** The session's light: a pre-dawn blue-violet lifting into clear morning as the session goes on. */
  private light(): void {
    const ctx = this.ctx, p = clamp(this.playT / Math.max(1, this.opts.plannedSec));
    const dusk = 0.35 * (1 - p);
    if (dusk > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = rgba(C.predawn, dusk);
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    const morning = 0.12 * p;
    if (morning > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rgba(C.morning, morning);
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
  }

  /**
   * The finale (6 s): the day's strip — this session's valleys as small tiles along the road line,
   * each with its pools, green and nest — the count of the day, the album card, the day's tree,
   * "Na dziś wystarczy." and where the road goes next.
   */
  private finale(sim: ZrodlaSim, alpha: number): void {
    const ctx = this.ctx, w = this.w, h = this.h, u = clamp(Math.min(w, h) / 430, 0.84, 1.2), T = this.finaleT;
    ctx.save();
    ctx.globalAlpha = alpha;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(236,226,206,.96)');
    bg.addColorStop(1, 'rgba(220,206,180,.97)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const top = TOP + 18 * u, bottom = h - BOTTOM - 10;
    // the road line and the tiles along it
    const runs = this.played.slice(-8), n = Math.max(1, runs.length);
    const tile = Math.min(112 * u, (w - 48) / Math.min(n, 4) - 12, (bottom - top) * 0.24);
    const rows = Math.ceil(n / 4), per = Math.min(n, 4);
    const stripY = top + 8 * u;
    ctx.strokeStyle = 'rgba(120,92,58,.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(16, stripY + tile / 2);
    ctx.lineTo(w - 16, stripY + tile / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    runs.forEach((run, i) => {
      const row = Math.floor(i / 4), col = i % 4, inRow = row === rows - 1 ? n - row * 4 : per;
      const x = (w - inRow * (tile + 12) + 12) / 2 + col * (tile + 12), y = stripY + row * (tile + 10);
      const pop = clamp((T - 1 - i * 0.12) / 0.4);
      if (pop <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha * pop;
      paintMini(ctx, run, x, y, tile, this.clock);
      ctx.restore();
    });
    let y = stripY + rows * (tile + 10) + 18 * u;
    // the count of the day
    const count = clamp((T - 2.2) / 0.8);
    if (count > 0) {
      const items: [string, string][] = [
        [t('fin.jars'), fmtNum(Math.round(sim.score * ease.outCubic(count)))],
        [t('fin.valleys'), String(sim.valleysClosed)],
        [t('fin.deepest'), sim.deepestLevel ? cap(DEPTH_NAME[sim.deepestLevel]) : '—'],
        [t('fin.nests'), String(sim.nestsBuilt)],
      ];
      const cw = Math.min(150 * u, (w - 32) / 4);
      items.forEach(([k, v], i) => {
        const cx = w / 2 + (i - 1.5) * cw;
        ctx.textAlign = 'center';
        ctx.fillStyle = C.ink;
        ctx.font = font(400, fitSize(ctx, v, cw - 6, 26 * u, 14, SERIF), SERIF);
        ctx.fillText(v, cx, y + 22 * u);
        ctx.fillStyle = 'rgba(43,42,51,.62)';
        ctx.font = font(650, fitSize(ctx, k, cw - 6, 11 * u, 9.5, SANS, 650), SANS);
        ctx.fillText(k, cx, y + 40 * u);
      });
      y += 58 * u;
    }
    // the album card and the day's tree
    const roll = sim.cardRoll;
    const cardIn = clamp((T - 3) / 0.5), treeIn = clamp((T - 3.8) / 0.5);
    const ch = Math.min(118 * u, (bottom - y) * 0.42), cwid = ch * 1.38;
    if (roll && cardIn > 0) {
      const id = roll.crafted ?? roll.id;
      const c = albumCard(id, roll.crafted !== null ? 'drops' : roll.kind === 'new' ? 'new' : roll.kind === 'dawn' ? 'dawn' : roll.kind === 'upgrade' ? 'upgrade' : 'dup');
      const s = ease.outBack(cardIn);
      const cx = sim.treeNow !== null ? w / 2 - cwid * 0.55 : w / 2;
      ctx.save();
      ctx.translate(cx, y + ch / 2);
      ctx.scale(s, s);
      ctx.shadowColor = 'rgba(60,40,24,.3)';
      ctx.shadowBlur = 16;
      paintPlace(ctx, ALBUM[id].id, -cwid / 2, -ch / 2, cwid, ch, c.dawn);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ink;
      ctx.font = font(650, fitSize(ctx, c.title, Math.min(w - 32, cwid * 1.9), 13 * u, 10.5, SANS, 650), SANS);
      ctx.globalAlpha = alpha * cardIn;
      ctx.fillText(c.title, cx, y + ch + 18 * u);
      ctx.globalAlpha = alpha;
    }
    if (sim.treeNow !== null && treeIn > 0) {
      const cx = roll ? w / 2 + cwid * 0.62 : w / 2;
      paintTree(ctx, TREES[sim.treeNow].kind, cx, y + ch * 0.45, ch * 0.3 * ease.outBack(treeIn), 0, sim.treeNow + 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ink;
      const line = t('card.tree', { tree: TREES[sim.treeNow].name });
      ctx.font = font(650, fitSize(ctx, line, roll ? w * 0.42 : w - 32, 12.5 * u, 10.5, SANS, 650), SANS);
      ctx.globalAlpha = alpha * treeIn;
      ctx.fillText(line, cx, y + ch + 18 * u);
      ctx.globalAlpha = alpha;
    }
    // "Na dziś wystarczy." and the road ahead
    const words = clamp((T - 4.6) / 0.6);
    if (words > 0) {
      ctx.globalAlpha = alpha * words;
      ctx.textAlign = 'center';
      ctx.fillStyle = C.ink;
      const ey = Math.min(bottom - 30 * u, y + ch + 58 * u);
      ctx.font = font(500, fitSize(ctx, t('fin.enough'), w - 32, 26 * u, 16, SERIF, 500), SERIF);
      ctx.fillText(t('fin.enough'), w / 2, ey);
      const idx = sim.roadIndex, stage = Math.floor(idx / 8);
      const next = idx >= 40 ? t('fin.nextFree') : t('fin.next', { n: stage + 1, name: STAGES[Math.min(stage, STAGES.length - 1)].name });
      ctx.fillStyle = 'rgba(43,42,51,.65)';
      ctx.font = font(500, fitSize(ctx, next, w - 32, 13 * u, 10.5, SANS, 500), SANS);
      ctx.fillText(next, w / 2, ey + 22 * u);
    }
    ctx.restore();
  }
}

/** The largest size from `max` down to `min` at which `text` fits `maxW`. */
function fitSize(ctx: CanvasRenderingContext2D, text: string, maxW: number, max: number, min: number, family: string, weight = 400): number {
  for (let s = max; s > min; s -= 0.5) {
    ctx.font = font(weight, s, family);
    if (ctx.measureText(text).width <= maxW) return s;
  }
  return min;
}
