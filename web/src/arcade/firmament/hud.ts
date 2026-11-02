/**
 * Firmament's HUD on the play canvas, around the board: the status (the block's name, what the band
 * drives right now, a strategy to try, the block's progress and the telegraph), the headline —
 * points this session — counting up live, the moves and the level's goals, the Milky Way (the
 * band's last 40 s as a band of stars: gold above the threshold, cool behind rest blocks, a dotted
 * gap without signal, clouds over a blind block, the lag bracket at "now"), the telescope's lens
 * (the live gauge: its light pool is the level, a dashed circle marks the threshold; the arc around
 * it is the light gathered toward the next instrument; the outer rim is the hold toward a pulsar),
 * the tray of instruments, the rescue, the cards (a block's verdict with its own curve, a level's
 * start and end with the constellation's map), the toasts, the words over the board and the dawn.
 * Every string is fitted to its room so it reads on a 390 px phone in German and Swedish.
 */
import { approach, clamp, ease } from '../kit/juice';
import { LAG_SEC, traceBars, type TraceBand } from '../kit/trace';
import type { ToolKind } from './board';
import { TIPS, TOOL_USE } from './content';
import { pts, t, unit } from './i18n';
import { figureOf, type Goal, type Level } from './levels';
import type { Layout, Rect } from './layout';
import { C, SANS, SERIF, font, paintBody, paintRock, paintSat, paintStar, paintToolIcon } from './paint';
import { RULES, type BlockKind, type FirmamentSim, type SimEvent } from './sim';

const TAU = Math.PI * 2;

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }

interface Card {
  kind: 'block' | 'toast' | 'level' | 'won' | 'lost';
  title: string; sub: string; color: string; t: number; dur: number;
  curve?: { x: number; y: number; ty: number; above: boolean; reliable: boolean }[];
  bands?: TraceBand[]; blind?: boolean; block?: BlockKind;
  tool?: ToolKind; level?: Level; stars?: number; goals?: Goal[];
}

const TXT = {
  warmup: t('block.warmup'), obs: t('block.obs'), blind: t('block.blind'), night: t('block.night'), finale: t('block.finale'),
  nextObs: t('next.obs'), nextBlind: t('next.blind'), nextNight: t('next.night'), nextFinale: t('next.finale'),
  moves: t('hud.moves'), goal: t('hud.goal'), lens: t('hud.lens'), star: t('hud.star'), trayFull: t('hud.trayFull'), pulsarReady: t('hud.pulsarReady'),
  mark: t('hud.mark'), milky: t('hud.milky'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
  driveWarm: t('drive.warmup'), driveObs: t('drive.obs'), driveBlind: t('drive.blind'), driveNight: t('drive.night'), driveGrey: t('drive.grey'), driveFree: t('drive.free'),
  rescue: t('rescue.title'), restart: t('rescue.restart'), tipFocus: t('rescue.tipFocus'), tipCalm: t('rescue.tipCalm'),
  lostTitle: t('lost.title'), lostSub: t('lost.sub'), bonus: t('won.bonus'),
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
  private clock = 0;
  private finaleA = 0;
  private rescueA = 0;
  private restartBox: Rect | null = null;
  private cascadeT = 0;
  private cascadeN = 0;
  private cascadeWord = '';
  private movesPop = 0;
  private lastMoves = -1;
  private readonly lag: number;
  private readonly lagLabel: string;
  private wrapCache = new Map<string, string[]>();

  constructor(ctx: CanvasRenderingContext2D, eeg: boolean) {
    this.ctx = ctx;
    this.lag = LAG_SEC[eeg ? 'eeg' : 'fnirs'];
    this.lagLabel = t('lag', { n: this.lag });
  }

  private static fontsFor(u: number) {
    return {
      name: font(500, 18 * u, SERIF), tip: font(500, 11.5 * u, SANS), drive: font(700, 11 * u, SANS), small: font(650, 10.5 * u, SANS),
      score: font(500, 30 * u, SERIF), unit: font(650, 11 * u, SANS), moves: font(600, 24 * u, SERIF), label: font(700, 9.5 * u, SANS),
      goal: font(750, 12.5 * u, SANS), cardTitle: font(500, 17 * u, SERIF, true), cardSub: font(650, 12 * u, SANS),
      big: font(500, 26 * u, SERIF, true), cascade: font(600, 30 * u, SERIF, true), lag: font(650, 8.5 * u, SANS), lensPct: font(700, 12 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wrapCache.clear();
  }

  // ── what the view tells the HUD ─────────────────────────────────
  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 34): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(800, size * u, SANS), rise: rise * u });
    if (this.floats.length > 16) this.floats.shift();
  }

  cascade(n: number, word: string): void {
    this.cascadeN = n;
    this.cascadeWord = word;
    this.cascadeT = 1.1;
  }

  on(e: SimEvent): void {
    if (e.type === 'resolve') this.pop = 1;
  }

  blockCard(sim: FirmamentSim, kind: BlockKind, blind: boolean, verdict: boolean | null, share: number, need: number, t0: number, t1: number, tools: ToolKind[]): void {
    const lay = sim.trace.layout({ x: 0, y: 0, w: 1, h: 1 }, t1, { span: clamp(t1 - t0, 4, 40) });
    const curve = lay.points.map(p => ({ x: p.x, y: p.y, ty: p.ty, above: p.above, reliable: p.reliable }));
    const pct = (v: number) => Math.round(v * 100);
    const title = kind === 'obs' ? (blind ? TXT.blind : TXT.obs) : TXT.night;
    let sub: string, color: string = C.cream;
    if (blind) {
      sub = t('blind.reveal', { n: pct(share) }) + (tools.length ? ` · +${tools.length}` : '');
      color = C.violet;
    } else if (verdict === null) sub = t('card.none');
    else if (verdict) {
      sub = kind === 'obs' ? t('card.obs.pass') : t('card.night.pass');
      color = kind === 'obs' ? C.gold : C.cool;
    } else sub = t('card.near', { share: pct(share), need: pct(need) });
    this.push({ kind: 'block', title, sub, color, t: 0, dur: 3.4, curve, bands: lay.bands.map(b => ({ ...b })), blind, block: kind });
  }

  toast(title: string, sub: string, color: string = C.cream, tool?: ToolKind): void {
    this.push({ kind: 'toast', title, sub, color, t: 0, dur: 2.2, tool });
  }

  levelCard(level: Level, name: string, attempt: number, newTools: string[]): void {
    const title = t('level.start', { n: level.index + 1, name });
    const sub = newTools.length ? t('level.new', { list: newTools.join(', ') }) : '';
    this.dropToasts();
    this.push({ kind: 'level', title, sub, color: C.gold, t: 0, dur: attempt ? 1.8 : 2.4, level, goals: level.goals });
  }

  wonCard(level: Level, stars: number, constDone: string | null, bonus: boolean): void {
    this.dropToasts();
    this.push({
      kind: 'won', title: constDone ? t('const.done', { name: constDone }) : t('won.title', { n: level.index + 1 }), sub: bonus ? TXT.bonus : '',
      color: C.gold, t: 0, dur: RULES.wonHold + 0.6, level, stars,
    });
  }

  lostCard(): void {
    this.dropToasts();
    this.push({ kind: 'lost', title: TXT.lostTitle, sub: TXT.lostSub, color: C.cool, t: 0, dur: RULES.lostHold + 0.2 });
  }

  /** Toasts waiting behind the head card make way for a level's card (block verdicts stay). */
  private dropToasts(): void {
    for (let i = this.cards.length - 1; i >= 1; i--) if (this.cards[i].kind === 'toast') this.cards.splice(i, 1);
  }

  private push(c: Card): void {
    this.cards.push(c);
    if (this.cards.length > 5) this.cards.splice(1, 1);
    const head = this.cards[0];
    if (this.cards.length > 1 && head.kind !== 'won' && head.kind !== 'lost') head.dur = Math.min(head.dur, Math.max(1.4, head.t) + 0.3);
  }

  restartHit(x: number, y: number): boolean {
    const b = this.restartBox;
    return !!b && this.rescueA > 0.5 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  update(dt: number, sim: FirmamentSim): void {
    this.clock += dt;
    let n = 0;
    for (const f of this.floats) if ((f.t += dt) < f.dur) this.floats[n++] = f;
    this.floats.length = n;
    const head = this.cards[0];
    if (head && (head.t += dt) >= head.dur) {
      this.cards.shift();
      const next = this.cards[0];
      if (next && this.cards.length > 1 && next.kind === 'toast') next.dur = Math.min(next.dur, 1.8);
    }
    this.pop = Math.max(0, this.pop - dt * 2.4);
    this.cascadeT = Math.max(0, this.cascadeT - dt);
    this.shown = sim.score < this.shown ? sim.score : approach(this.shown, sim.score, dt, 0.18);
    if (sim.score - this.shown < 0.5) this.shown = sim.score;
    if (this.lastMoves !== sim.movesLeft) {
      if (this.lastMoves >= 0 && sim.movesLeft > this.lastMoves) this.movesPop = 1;
      this.lastMoves = sim.movesLeft;
    }
    this.movesPop = Math.max(0, this.movesPop - dt * 2);
    this.finaleA = approach(this.finaleA, sim.phase !== 'play' ? 1 : 0, dt, 0.4);
    this.rescueA = approach(this.rescueA, sim.stage === 'rescue' && sim.phase === 'play' ? 1 : 0, dt, 0.15);
  }

  draw(sim: FirmamentSim): void {
    this.status(sim);
    this.goals(sim);
    this.score();
    this.lens(sim);
    this.tray(sim);
    this.drawCascade();
    this.drawFloats();
    this.rescue(sim);
    this.drawCard();
    this.finale();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private panel(x: number, y: number, w: number, h: number, a = 0.78): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(14,18,52,${a})`;
    ctx.strokeStyle = C.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * this.L.u);
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

  private wrapped(text: string, maxW: number, f: string, lines: number): string[] {
    const key = `${f}|${maxW}|${lines}|${text}`;
    let out = this.wrapCache.get(key);
    if (!out) {
      this.ctx.font = f;
      out = wrap(this.ctx, text, maxW);
      if (out.length > lines) {
        out = out.slice(0, lines);
        out[lines - 1] = `${out[lines - 1].replace(/[\s,;:.]+$/, '')}…`;
      }
      if (this.wrapCache.size > 60) this.wrapCache.clear();
      this.wrapCache.set(key, out);
    }
    return out;
  }

  // ── the status ──────────────────────────────────────────────────
  /** The block's name, its colour, what the band drives now, and the strategy line. */
  private statusText(sim: FirmamentSim): { name: string; color: string; drive: string; driveColor: string; tip: string } {
    const b = sim.block;
    if (sim.phase !== 'play') return { name: TXT.finale, color: C.gold, drive: '', driveColor: C.gold, tip: '' };
    const tool = sim.armedTool;
    let tip = sim.tip;
    if (b.kind === 'warmup') tip = TIPS.warmup[Math.min(2, Math.floor((sim.blockT / Math.max(1, b.dur)) * 3))];
    const name = b.kind === 'warmup' ? TXT.warmup : b.kind === 'night' ? TXT.night : b.blind ? TXT.blind : TXT.obs;
    const color = b.kind === 'night' ? C.cool : b.blind ? C.violet : C.gold;
    let drive: string, driveColor: string = C.gold;
    if (tool) {
      drive = TOOL_USE[tool];
      driveColor = C.mint;
    } else if (b.kind === 'warmup') drive = TXT.driveWarm;
    else if (b.kind === 'night') {
      drive = sim.reliable ? TXT.driveNight : TXT.driveGrey;
      driveColor = C.cool;
    } else if (b.blind) {
      drive = TXT.driveBlind;
      driveColor = C.violet;
    } else if (!sim.reliable) {
      drive = TXT.driveGrey;
      driveColor = C.dim;
    } else if (sim.blockT < sim.leadIn) drive = t('drive.lead', { n: Math.max(1, Math.ceil(sim.leadIn - sim.blockT)) });
    else drive = TXT.driveObs;
    return { name, color, drive, driveColor, tip };
  }

  private status(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.status, F = this.F;
    const s = this.statusText(sim);
    this.panel(r.x, r.y, r.w, r.h);
    const pad = 11 * u;
    const w = r.w - 2 * pad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = s.color;
    ctx.font = this.fit(s.name, w, F.name);
    ctx.fillText(s.name, r.x + pad, r.y + 7 * u);
    ctx.fillStyle = s.driveColor;
    ctx.font = this.fit(s.drive, w, F.drive, 0.62);
    ctx.fillText(s.drive, r.x + pad, r.y + 29 * u);
    // the strategy: one line on a phone, up to three in a column
    const lines = Math.max(1, Math.floor((r.h - 46 * u) / (13 * u)));
    if (s.tip) {
      ctx.fillStyle = C.dim;
      this.wrapped(s.tip, w, F.tip, lines).forEach((line, i) => {
        ctx.font = F.tip;
        ctx.fillText(line, r.x + pad, r.y + 43 * u + i * 13 * u);
      });
    }
    // the block's progress, or the telegraph
    const b = sim.block, by = r.y + r.h - 5 * u;
    const left = sim.phase === 'play' ? b.dur - sim.blockT : 0;
    if (sim.phase === 'play' && left <= RULES.telegraph) {
      const nb = sim.next;
      const txt = !nb ? TXT.nextFinale : nb.kind === 'night' ? TXT.nextNight : TXT.nextObs;
      ctx.font = this.fit(txt, w * 0.6, F.small);
      const tw = ctx.measureText(txt).width;
      ctx.fillStyle = `rgba(255,214,140,${0.75 + 0.25 * Math.sin(this.clock * 6)})`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(txt, r.x + r.w - pad, r.y + 8 * u);
      ctx.textAlign = 'left';
      void tw;
    }
    ctx.fillStyle = 'rgba(246,239,220,.14)';
    ctx.fillRect(r.x + pad, by, w, 2.5 * u);
    ctx.fillStyle = s.color;
    ctx.fillRect(r.x + pad, by, w * clamp(sim.phase === 'play' ? sim.blockT / b.dur : 1), 2.5 * u);
  }

  // ── the moves and the goals ─────────────────────────────────────
  private goals(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.goals, F = this.F;
    this.panel(r.x, r.y, r.w, r.h);
    const pad = 10 * u;
    // the moves: a number in a ring
    const compact = L.tall || L.low;
    const mr = Math.min(r.h * 0.4, 22 * u);
    const mx = r.x + pad + mr, my = compact ? r.y + r.h / 2 : r.y + pad + mr + 12 * u;
    const low = sim.movesLeft <= 3 && sim.stage === 'play';
    ctx.strokeStyle = low ? `rgba(255,160,120,${0.7 + 0.3 * Math.sin(this.clock * 8)})` : 'rgba(255,214,140,.6)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.stroke();
    const k = 1 + 0.3 * this.movesPop;
    ctx.save();
    ctx.translate(mx, my + 1);
    ctx.scale(k, k);
    ctx.fillStyle = low ? '#ffb090' : C.cream;
    ctx.font = this.fit(String(sim.movesLeft), mr * 1.6, compact ? F.goal.replace(PX, `${Math.round(17 * u)}px`) : F.moves);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(sim.movesLeft), 0, 0);
    ctx.restore();
    if (!compact) {
      ctx.fillStyle = C.faint;
      ctx.font = F.label;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(TXT.moves.toUpperCase(), mx, r.y + 6 * u);
    }
    // the goals: an icon and what is left (a tick when done)
    const gx0 = mx + mr + 12 * u;
    const right = L.tall ? r.x + r.w - pad - this.scoreW() - 8 * u : r.x + r.w - pad;
    const goals = sim.level.goals;
    const slotW = Math.max(40 * u, (right - gx0) / Math.max(1, goals.length));
    const ir = Math.min(r.h * 0.3, 13 * u);
    goals.forEach((g, i) => {
      const x = gx0 + i * slotW, y = my;
      const left = sim.goalLeft(g);
      this.goalIcon(g, x + ir, y, ir);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (left === 0) {
        ctx.strokeStyle = C.mint;
        ctx.lineWidth = 2.5 * u;
        ctx.beginPath();
        ctx.moveTo(x + ir * 2 + 6 * u, y);
        ctx.lineTo(x + ir * 2 + 10 * u, y + 4 * u);
        ctx.lineTo(x + ir * 2 + 17 * u, y - 5 * u);
        ctx.stroke();
      } else {
        const txt = g.kind === 'score' ? pts(left) : String(left);
        ctx.fillStyle = C.cream;
        ctx.font = this.fit(txt, slotW - ir * 2 - 10 * u, F.goal, 0.6);
        ctx.fillText(txt, x + ir * 2 + 6 * u, y + 1);
      }
    });
    if (!compact) {
      // the level's name and its stars to win under the goals
      ctx.fillStyle = C.faint;
      ctx.font = F.label;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(TXT.goal.toUpperCase(), gx0, r.y + 6 * u);
      const lv = t('hud.level', { n: sim.level.index + 1 });
      ctx.fillStyle = C.dim;
      ctx.font = this.fit(lv, r.w - 2 * pad, F.small);
      ctx.textBaseline = 'bottom';
      ctx.fillText(lv, r.x + pad, r.y + r.h - 7 * u);
      // the stars this attempt has reached so far
      const l = sim.level;
      const got = sim.levelScore >= l.stars[1] ? 3 : sim.levelScore >= l.stars[0] ? 2 : sim.goalsDone ? 1 : 0;
      for (let s = 0; s < 3; s++) paintStar(ctx, r.x + r.w - pad - (2 - s) * 16 * u - 6 * u, r.y + r.h - 13 * u, 6 * u, s < got ? 1 : 0);
    }
  }

  private goalIcon(g: Goal, x: number, y: number, r: number): void {
    const ctx = this.ctx;
    switch (g.kind) {
      case 'score': paintStar(ctx, x, y, r, 1, C.gold); break;
      case 'collect': paintBody(ctx, g.of ?? 0, x, y, r); break;
      case 'dust':
        ctx.fillStyle = 'rgba(150,110,240,.6)';
        ctx.strokeStyle = 'rgba(214,190,255,.8)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(x - r, y - r, 2 * r, 2 * r, r * 0.35);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f2e8ff';
        for (const [dx, dy] of [[-0.4, -0.3], [0.35, -0.1], [-0.1, 0.4], [0.45, 0.45]] as const) {
          ctx.beginPath();
          ctx.arc(x + dx * r, y + dy * r, r * 0.12, 0, TAU);
          ctx.fill();
        }
        break;
      case 'rocks': paintRock(ctx, x, y, r, 1, 3); break;
      case 'sats': paintSat(ctx, x, y, r * 0.95, this.clock); break;
    }
  }

  // ── the headline ────────────────────────────────────────────────
  private scoreW(): number {
    const ctx = this.ctx;
    const n = Math.round(this.shown);
    ctx.font = this.L.tall ? this.F.goal.replace(PX, `${Math.round(19 * this.L.u)}px`) : this.F.score;
    return Math.max(ctx.measureText(String(n)).width, 34 * this.L.u);
  }

  private score(): void {
    const ctx = this.ctx, L = this.L, F = this.F, u = L.u;
    const n = Math.round(this.shown);
    const k = 1 + 0.16 * ease.outBack(this.pop) * this.pop;
    const tall = L.tall;
    const x = tall ? L.goals.x + L.goals.w - 10 * u : L.scoreX;
    const y = tall ? L.goals.y + L.goals.h / 2 - 6 * u : L.scoreY + 2 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.textAlign = 'right';
    ctx.textBaseline = tall ? 'middle' : 'top';
    ctx.font = tall ? F.goal.replace(PX, `${Math.round(19 * u)}px`) : F.score;
    ctx.fillStyle = C.gold;
    ctx.fillText(String(n), 0, 0);
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.font = F.unit;
    ctx.fillStyle = C.dim;
    ctx.fillText(unit(n), x, tall ? y + 9 * u : y + 34 * u);
  }

  // ── the Milky Way: the band's last 40 s ─────────────────────────
  drawMilky(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, r = L.milky;
    if (r.h < 8) return;
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,26,.5)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2.4);
    ctx.fill();
    ctx.clip();
    const box = { x: r.x + 8 * u, y: r.y + 3 * u, w: r.w - 16 * u, h: r.h - 6 * u };
    const lay = sim.trace.layout(box, sim.t);
    // the blocks behind the stars: cool behind rest
    for (const b of lay.bands) {
      if (b.phase === 'rest') {
        ctx.fillStyle = 'rgba(90,140,230,.18)';
        ctx.fillRect(b.x0, r.y, Math.max(1, b.x1 - b.x0), r.h);
      } else if (b.phase === 'focus') {
        ctx.fillStyle = 'rgba(255,200,110,.05)';
        ctx.fillRect(b.x0, r.y, Math.max(1, b.x1 - b.x0), r.h);
      }
    }
    // the stars of the band: one column a bar, its glow the level, gold above the threshold
    const n = Math.max(20, Math.round(box.w / (5 * u)));
    const bars = traceBars(sim.trace, sim.t, n);
    const bw = box.w / n;
    const mid = box.y + box.h * 0.5;
    ctx.globalCompositeOperation = 'lighter';
    bars.forEach((b, i) => {
      const x = box.x + (i + 0.5) * bw;
      if (b.empty || b.shown <= 0) return;
      if (!b.reliable) {
        ctx.fillStyle = 'rgba(200,210,230,.35)';
        ctx.fillRect(x - 0.6, box.y + box.h - 2, 1.2, 1.2);
        return;
      }
      const lev = clamp(b.level);
      const hh = box.h * (0.12 + 0.88 * lev);
      const col = b.above ? '255,206,110' : b.phase === 'rest' ? '150,190,255' : '205,215,240';
      ctx.fillStyle = `rgba(${col},${0.16 * b.shown})`;
      ctx.fillRect(x - bw * 0.36, box.y + box.h - hh, bw * 0.72, hh);
      ctx.fillStyle = `rgba(${col},${0.5 * b.shown})`;
      ctx.fillRect(x - bw * 0.36, box.y + box.h - hh, bw * 0.72, Math.min(hh, box.h * 0.3));
      ctx.fillStyle = `rgba(255,255,255,${0.8 * b.shown})`;
      ctx.beginPath();
      ctx.arc(x, box.y + box.h - hh, Math.max(0.8, bw * (b.above ? 0.32 : 0.2)), 0, TAU);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    // the threshold: level 0.5, dashed
    ctx.setLineDash([3 * u, 3 * u]);
    ctx.strokeStyle = 'rgba(255,240,210,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.x, box.y + box.h - box.h * (0.12 + 0.88 * 0.5));
    ctx.lineTo(box.x + box.w, box.y + box.h - box.h * (0.12 + 0.88 * 0.5));
    ctx.stroke();
    ctx.setLineDash([]);
    // clouds over a blind block
    for (const b of lay.bands) {
      if (!b.veiled) continue;
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, 'rgba(70,64,110,.92)');
      g.addColorStop(1, 'rgba(46,42,80,.92)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x0, r.y, Math.max(1, b.x1 - b.x0), r.h);
      for (let x = b.x0; x < b.x1; x += 14 * u) {
        ctx.fillStyle = 'rgba(120,112,170,.5)';
        ctx.beginPath();
        ctx.arc(x + 7 * u, r.y + r.h * 0.45 + Math.sin(x * 0.07 + this.clock) * 2, r.h * 0.32, 0, TAU);
        ctx.fill();
      }
    }
    // the band's delay at "now": a bracket, and its label
    const x1 = box.x + box.w, x0 = box.x + box.w * (1 - this.lag / sim.trace.windowSec);
    ctx.strokeStyle = 'rgba(246,239,220,.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, mid - box.h * 0.5 + 6);
    ctx.lineTo(x0, mid - box.h * 0.5 + 2);
    ctx.lineTo(x1, mid - box.h * 0.5 + 2);
    ctx.lineTo(x1, mid - box.h * 0.5 + 6);
    ctx.stroke();
    ctx.fillStyle = 'rgba(246,239,220,.85)';
    ctx.font = this.F.lag;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(this.lagLabel, x0 - 3 * u, mid - box.h * 0.5 + 1);
    if (r.w > 480 * u && r.h >= 20 * u) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(246,239,220,.45)';
      ctx.fillText(TXT.milky, box.x + 2 * u, box.y + 1);
    }
    ctx.restore();
  }

  // ── the telescope's lens ────────────────────────────────────────
  private lens(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const { x, y, r } = L.lens;
    const look = sim.lensLook;
    const ri = r * 0.74;
    // the telescope's tube behind the eyepiece
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.75);
    const tg = ctx.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
    tg.addColorStop(0, '#6d5427');
    tg.addColorStop(0.5, '#c79a4c');
    tg.addColorStop(1, '#5a4320');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(r * 0.5, -r * 0.55);
    ctx.lineTo(r * 1.45, -r * 0.4);
    ctx.lineTo(r * 1.45, r * 0.4);
    ctx.lineTo(r * 0.5, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // the brass rim
    const rg = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    rg.addColorStop(0, '#f1d08a');
    rg.addColorStop(0.5, '#a57a33');
    rg.addColorStop(1, '#6a4c1c');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // the glass
    const gg = ctx.createRadialGradient(x - ri * 0.3, y - ri * 0.3, ri * 0.1, x, y, ri);
    gg.addColorStop(0, '#1d2766');
    gg.addColorStop(1, '#070a24');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, ri, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, ri, 0, TAU);
    ctx.clip();
    // the light pool: the live level (or the night's calm)
    const live = look === 'live' || look === 'lead' || look === 'warm';
    const level = look === 'rest' ? clamp(sim.reliable ? sim.sky : 0) : clamp(sim.level01);
    if (look !== 'blind' && look !== 'grey') {
      const pr = ri * (0.08 + 0.92 * level);
      const above = level > 0.5;
      const col = look === 'rest' ? '140,190,255' : above ? '255,206,110' : '170,195,240';
      const a = look === 'lead' || look === 'warm' ? 0.45 : 0.9;
      const pg = ctx.createRadialGradient(x, y, 0, x, y, pr);
      pg.addColorStop(0, `rgba(255,255,245,${a})`);
      pg.addColorStop(0.45, `rgba(${col},${a * 0.85})`);
      pg.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = pg;
      ctx.beginPath();
      ctx.arc(x, y, pr, 0, TAU);
      ctx.fill();
    }
    if (look === 'blind') {
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1 + this.clock * 0.3;
        ctx.fillStyle = 'rgba(120,112,170,.75)';
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * ri * 0.45, y + Math.sin(a * 1.3) * ri * 0.35, ri * 0.45, 0, TAU);
        ctx.fill();
      }
    }
    if (look === 'grey') {
      ctx.fillStyle = 'rgba(160,165,180,.25)';
      ctx.fillRect(x - ri, y - ri, 2 * ri, 2 * ri);
    }
    ctx.restore();
    // the threshold: a dashed circle at level 0.5
    if (look !== 'blind') {
      ctx.setLineDash([3 * u, 3 * u]);
      ctx.strokeStyle = 'rgba(255,245,220,.75)';
      ctx.lineWidth = 1.2 * u;
      ctx.beginPath();
      ctx.arc(x, y, ri * (0.08 + 0.92 * 0.5), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (r >= 34) {
        ctx.fillStyle = 'rgba(255,245,220,.8)';
        ctx.font = this.F.lag;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(TXT.mark, x, y - ri * 0.54 - 1);
      }
    }
    // the light gathered: an arc in the rim toward the next instrument (in the night: toward the next falling star)
    const night = look === 'rest';
    const fill = night ? sim.starProgress : look === 'blind' ? 0 : sim.lens;
    const rr = (r + ri) / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = (r - ri) * 0.62;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, TAU);
    ctx.stroke();
    if (fill > 0.005) {
      ctx.strokeStyle = night ? '#a9cbff' : fill >= 1 ? `rgba(255,236,170,${0.8 + 0.2 * Math.sin(this.clock * 8)})` : C.gold;
      ctx.beginPath();
      ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(fill));
      ctx.stroke();
    }
    // the hold toward a pulsar: the outer rim
    const hold = sim.nextPulsar ? 1 : clamp(sim.hold / RULES.pulsarHold);
    if (live && (hold > 0.01 || sim.nextPulsar)) {
      ctx.strokeStyle = sim.nextPulsar ? `rgba(190,235,255,${0.75 + 0.25 * Math.sin(this.clock * 6)})` : 'rgba(200,225,255,.85)';
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.arc(x, y, r + 4 * u, -Math.PI / 2, -Math.PI / 2 + TAU * hold);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    // the lens's words: the share gathered, and what comes next
    const tx = L.lensText;
    const pct = Math.round(clamp(fill) * 100);
    ctx.textBaseline = 'top';
    if (L.tall) {
      ctx.textAlign = 'left';
      ctx.fillStyle = night ? C.cool : C.gold;
      const name = (night ? TXT.star : TXT.lens).toUpperCase();
      ctx.font = this.fit(name, tx.w, F.label, 0.6);
      ctx.fillText(name, tx.x, tx.y + tx.h * 0.18);
      ctx.font = this.fit(`${pct}%`, tx.w, F.lensPct);
      ctx.fillText(look === 'blind' ? '…' : `${pct}%`, tx.x, tx.y + tx.h * 0.18 + 13 * u);
      const note = this.lensNote(sim);
      if (note) {
        ctx.fillStyle = C.dim;
        this.wrapped(note, tx.w, F.label, 2).forEach((line, i) => {
          ctx.font = F.label;
          ctx.fillText(line, tx.x, tx.y + tx.h * 0.18 + 31 * u + i * 11 * u);
        });
      }
    } else {
      ctx.textAlign = 'center';
      ctx.fillStyle = night ? C.cool : C.gold;
      ctx.font = F.label;
      const head = `${(night ? TXT.star : TXT.lens).toUpperCase()} · ${look === 'blind' ? '…' : `${pct}%`}`;
      ctx.font = this.fit(head, L.w - x, F.lensPct);
      ctx.fillText(head, x, y - r - 26 * u);
      const note = this.lensNote(sim);
      if (note) {
        ctx.fillStyle = C.dim;
        ctx.font = F.small;
        this.wrapped(note, tx.w - 8 * u, F.small, 3).forEach((line, i) => ctx.fillText(line, x, tx.y + 4 * u + i * 13 * u));
      }
    }
  }

  private lensNote(sim: FirmamentSim): string {
    if (sim.tray.length >= sim.traySize && sim.lens >= 1) return TXT.trayFull;
    if (sim.nextPulsar) return TXT.pulsarReady;
    if (sim.lensLook === 'live' || sim.lensLook === 'lead') return t('hud.hold', { n: RULES.pulsarHold });
    return '';
  }

  // ── the tray ────────────────────────────────────────────────────
  private tray(sim: FirmamentSim): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    const n = sim.traySize;
    for (let i = 0; i < n; i++) {
      const s = L.slot(i, n);
      const tool = sim.tray[i];
      const armed = sim.armed === i;
      const lift = armed ? 4 * u : 0;
      ctx.fillStyle = tool ? 'rgba(20,26,70,.85)' : 'rgba(10,12,36,.45)';
      ctx.strokeStyle = armed ? `rgba(255,224,150,${0.8 + 0.2 * Math.sin(this.clock * 8)})` : tool ? 'rgba(255,214,140,.45)' : 'rgba(246,239,220,.18)';
      ctx.lineWidth = armed ? 2.5 * u : 1.2;
      if (!tool) ctx.setLineDash([4 * u, 4 * u]);
      ctx.beginPath();
      ctx.roundRect(s.x, s.y - lift, s.w, s.h, 10 * u);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      if (tool) {
        paintToolIcon(ctx, tool, s.x + s.w / 2, s.y + s.h / 2 - lift, s.w * 0.34, this.clock);
        if (!L.tall) {
          ctx.fillStyle = C.faint;
          ctx.font = this.F.label;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(String(i + 1), s.x + 5 * u, s.y + 4 * u - lift);
        }
      }
    }
  }

  // ── the rescue ──────────────────────────────────────────────────
  private rescue(sim: FirmamentSim): void {
    if (this.rescueA < 0.02) {
      this.restartBox = null;
      return;
    }
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const bw = L.cell * 8;
    ctx.globalAlpha = this.rescueA;
    ctx.fillStyle = 'rgba(4,6,20,.6)';
    ctx.fillRect(L.bx - 6 * u, L.by - 6 * u, bw + 12 * u, bw + 12 * u);
    const w = Math.min(bw - 16 * u, 320 * u), h = Math.min(bw - 16 * u, 200 * u);
    const x = L.bx + (bw - w) / 2, y = L.by + (bw - h) / 2;
    this.panel(x, y, w, h, 0.94);
    const cx = x + w / 2;
    const focus = sim.rescueWant === 'focus';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = focus ? C.gold : C.cool;
    ctx.font = this.fit(TXT.rescue, w - 24 * u, F.cardTitle);
    ctx.fillText(TXT.rescue, cx, y + 10 * u);
    const line = t(focus ? 'rescue.focus' : 'rescue.calm', { n: RULES.rescueMoves });
    ctx.fillStyle = C.cream;
    const lines = this.wrapped(line, w - 24 * u, F.cardSub, 2);
    lines.forEach((l, i) => {
      ctx.font = F.cardSub;
      ctx.fillText(l, cx, y + 34 * u + i * 15 * u);
    });
    // the six seconds: a ring that fills
    const rr = Math.min(26 * u, h * 0.15), ry = y + h * 0.5;
    ctx.lineWidth = 6 * u;
    ctx.strokeStyle = 'rgba(246,239,220,.15)';
    ctx.beginPath();
    ctx.arc(cx, ry, rr, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = focus ? C.gold : C.cool;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, ry, rr, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(sim.rescueP / RULES.rescueSec));
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = C.cream;
    ctx.font = F.goal;
    ctx.textBaseline = 'middle';
    ctx.fillText(t('sec', { n: Math.max(0, Math.ceil(RULES.rescueSec - sim.rescueP)) }), cx, ry);
    ctx.fillStyle = C.dim;
    ctx.font = this.fit(focus ? TXT.tipFocus : TXT.tipCalm, w - 24 * u, F.small);
    ctx.textBaseline = 'top';
    ctx.fillText(focus ? TXT.tipFocus : TXT.tipCalm, cx, ry + rr + 8 * u);
    // the window running out, and the way to start again
    ctx.fillStyle = 'rgba(246,239,220,.15)';
    ctx.fillRect(x + 14 * u, y + h - 40 * u, w - 28 * u, 2 * u);
    ctx.fillStyle = 'rgba(246,239,220,.5)';
    ctx.fillRect(x + 14 * u, y + h - 40 * u, (w - 28 * u) * clamp(1 - sim.rescueT / RULES.rescueWindow), 2 * u);
    ctx.font = F.cardSub;
    const bwid = Math.min(w - 28 * u, ctx.measureText(TXT.restart).width + 28 * u), bh = 26 * u;
    const bx = cx - bwid / 2, byy = y + h - 32 * u;
    this.restartBox = { x: bx, y: byy, w: bwid, h: bh };
    ctx.strokeStyle = 'rgba(246,239,220,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, byy, bwid, bh, bh / 2);
    ctx.stroke();
    ctx.fillStyle = C.cream;
    ctx.textBaseline = 'middle';
    ctx.font = this.fit(TXT.restart, bwid - 16 * u, F.cardSub);
    ctx.fillText(TXT.restart, cx, byy + bh / 2);
    ctx.globalAlpha = 1;
  }

  // ── words over the board ────────────────────────────────────────
  private drawCascade(): void {
    if (this.cascadeT <= 0) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const k = 1 - this.cascadeT / 1.1;
    const pop = k < 0.2 ? ease.outBack(k / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.translate(L.bx + L.cell * 4, L.by + L.cell * 2.2 - k * 16 * u);
    ctx.scale(pop, pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = this.F.cascade;
    ctx.lineWidth = 5 * u;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10,8,40,.75)';
    const text = t('fx.cascade', { n: this.cascadeN });
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = C.gold;
    ctx.fillText(text, 0, 0);
    if (this.cascadeWord) {
      ctx.font = this.F.cardTitle;
      ctx.strokeText(this.cascadeWord, 0, 30 * u);
      ctx.fillStyle = C.cream;
      ctx.fillText(this.cascadeWord, 0, 30 * u);
    }
    ctx.restore();
  }

  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
      ctx.globalAlpha = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
      ctx.font = f.font;
      ctx.save();
      ctx.translate(f.x, f.y - f.rise * ease.outCubic(k));
      ctx.scale(pop, pop);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(8,8,32,.8)';
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
    const w = Math.min(320 * u, L.w - 32, Math.max(L.cell * 8 - 8, 240));
    const h = (c.kind === 'block' ? 100 : c.kind === 'won' ? 150 : c.kind === 'level' ? 82 : 58) * u;
    const x = (L.w - w) / 2, y = L.cardY - h / 2 + (1 - inK) * -14 * u;
    ctx.save();
    ctx.globalAlpha = Math.min(1, outK);
    ctx.translate(L.w / 2, y + h / 2);
    ctx.scale(0.9 + 0.1 * inK, 0.9 + 0.1 * inK);
    ctx.translate(-L.w / 2, -(y + h / 2));
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 18;
    this.panel(x, y, w, h, 0.95);
    ctx.shadowBlur = 0;
    const pad = 12 * u;
    let tx = x + pad;
    if (c.tool) {
      paintToolIcon(ctx, c.tool, x + pad + 13 * u, y + 24 * u, 13 * u, this.clock);
      tx += 32 * u;
    }
    const centred = c.kind === 'won' || c.kind === 'lost' || c.kind === 'level';
    ctx.textAlign = centred ? 'center' : 'left';
    ctx.textBaseline = 'top';
    const ax = centred ? L.w / 2 : tx;
    ctx.fillStyle = C.cream;
    ctx.font = this.fit(c.title, w - (tx - x) - pad, F.cardTitle);
    ctx.fillText(c.title, ax, y + 9 * u);
    if (c.sub) {
      ctx.fillStyle = c.color;
      ctx.font = this.fit(c.sub, w - (tx - x) - pad, F.cardSub, 0.6);
      ctx.fillText(c.sub, ax, y + (c.kind === 'won' ? h - 24 * u : 33 * u));
    }
    if (c.kind === 'block' && c.curve && c.curve.length > 1) this.miniCurve(c, x + pad, y + 52 * u, w - 2 * pad, h - 60 * u);
    if (c.kind === 'won' && c.level) this.wonBody(c, x, y, w, h);
    if (c.kind === 'level' && c.goals) {
      const ir = 10 * u, gw = 64 * u, total = c.goals.length * gw;
      c.goals.forEach((g, i) => {
        const gx = L.w / 2 - total / 2 + i * gw + 14 * u, gy = y + h - 22 * u;
        this.goalIcon(g, gx, gy, ir);
        if (g.kind === 'dust' || g.kind === 'rocks') return;
        ctx.fillStyle = C.cream;
        ctx.font = F.goal;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(g.n), gx + ir + 5 * u, gy + 1);
      });
    }
    ctx.restore();
  }

  /** A won level: its stars, and the constellation's figure with every level's star. */
  private wonBody(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx, u = this.L.u;
    const l = c.level!, stars = c.stars ?? 1;
    const k = clamp((c.t - 0.2) / 0.9);
    for (let s = 0; s < 3; s++) {
      const on = s < stars && k * 3 > s;
      const pop = on ? ease.outBack(clamp(k * 3 - s)) : 1;
      paintStar(this.ctx, x + w / 2 + (s - 1) * 30 * u, y + 46 * u - (s === 1 ? 4 * u : 0), 11 * u * pop, on ? 1 : 0);
    }
    // the map: the constellation's figure, its levels as stars
    const fig = figureOf(l.constellation);
    const box = { x: x + 24 * u, y: y + 64 * u, w: w - 48 * u, h: h - 96 * u };
    ctx.strokeStyle = 'rgba(158,197,255,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [a, b] of fig.lines) {
      const pa = fig.pts[a], pb = fig.pts[b];
      ctx.moveTo(box.x + pa[0] * box.w, box.y + pa[1] * box.h);
      ctx.lineTo(box.x + pb[0] * box.w, box.y + pb[1] * box.h);
    }
    ctx.stroke();
    fig.pts.forEach(([px, py], i) => {
      const done = i <= l.star;
      const now = i === l.star;
      const r = (now ? 5.5 + Math.sin(this.clock * 6) * 1.2 : 4) * u;
      ctx.fillStyle = done ? C.gold : 'rgba(246,239,220,.35)';
      ctx.beginPath();
      ctx.arc(box.x + px * box.w, box.y + py * box.h, r, 0, TAU);
      ctx.fill();
      if (now) {
        ctx.strokeStyle = 'rgba(255,236,170,.8)';
        ctx.beginPath();
        ctx.arc(box.x + px * box.w, box.y + py * box.h, r + 4 * u, 0, TAU);
        ctx.stroke();
      }
    });
  }

  /** The block's own curve in miniature; a blind block's veil lifts across it, left to right. */
  private miniCurve(c: Card, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    for (const b of c.bands ?? []) {
      if (b.phase === 'free') continue;
      ctx.fillStyle = b.phase === 'rest' ? 'rgba(90,140,230,.2)' : 'rgba(255,200,110,.1)';
      ctx.fillRect(x + b.x0 * w, y, Math.max(1, (b.x1 - b.x0) * w), h);
    }
    const pts0 = c.curve!;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(246,239,220,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts0.forEach((p, i) => (i ? ctx.lineTo(x + p.x * w, y + p.ty * h) : ctx.moveTo(x + p.x * w, y + p.ty * h)));
    ctx.stroke();
    ctx.setLineDash([]);
    const reveal = c.blind ? clamp((c.t - 0.3) / 1.4) : 1;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts0.length; i++) {
      const a = pts0[i - 1], b = pts0[i];
      if (!a.reliable || !b.reliable || b.x > reveal + 1e-6) continue;
      if (a.above && b.above) {
        ctx.fillStyle = 'rgba(255,206,110,.28)';
        ctx.beginPath();
        ctx.moveTo(x + a.x * w, y + a.ty * h);
        ctx.lineTo(x + a.x * w, y + a.y * h);
        ctx.lineTo(x + b.x * w, y + b.y * h);
        ctx.lineTo(x + b.x * w, y + b.ty * h);
        ctx.fill();
      }
      ctx.strokeStyle = a.above && b.above ? C.gold : 'rgba(200,215,245,.85)';
      ctx.beginPath();
      ctx.moveTo(x + a.x * w, y + a.y * h);
      ctx.lineTo(x + b.x * w, y + b.y * h);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    if (reveal < 1) {
      ctx.fillStyle = 'rgba(70,64,110,.9)';
      ctx.fillRect(x + reveal * w, y, (1 - reveal) * w, h);
    }
  }

  private finale(): void {
    if (this.finaleA < 0.02) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.w - 32, 340 * u), h = 74 * u, x = (L.w - w) / 2, y = L.cardY - h / 2;
    this.panel(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.gold;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, this.F.big);
    ctx.fillText(TXT.finaleTitle, L.w / 2, y + 10 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, this.F.cardSub);
    ctx.fillStyle = C.dim;
    ctx.fillText(TXT.finaleSub, L.w / 2, y + 48 * u);
    ctx.globalAlpha = 1;
  }
}

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

