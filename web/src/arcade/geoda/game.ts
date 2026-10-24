/**
 * One Geoda session for the arcade runner (kit/types.ts): it wires the rules (sim.ts), the picture
 * (render.ts) and the sound (audio.ts) to the player's hands — drag a crystal from the tray onto
 * the wall, tap a crystal to feed it, tap the wall to set the fed one there (the next one while the
 * fed slot sprouts), hold a crystal that fits nowhere for 0.8 s to crumble it, keys 1/2/3, arrows,
 * Space and a held Backspace.  The progress (meta.ts) is credited at every block's end, and
 * "Rozłup geodę" settles the session's specimen into the cabinet — or `finish()`, when the session
 * ends before its crack.  The runner owns the clock, pause, the signal banners, saving and the
 * summary; the ambient pad follows what `padLevel` gives it.
 */
import { mulberry32 } from '../../core/random';
import type { FocusFrame } from '../kit/focus';
import { buzz, clamp } from '../kit/juice';
import type { ArcadeGame, ArcadeOutcome, GameEnv, PointerInput } from '../kit/types';
import { GeodaSound } from './audio';
import { CLARITY, MINERALS, STRATEGIES, TIERS, type Pt } from './content';
import type { FinaleView } from './finale';
import { cellAt, computeLayout, slotAt, type Layout } from './layout';
import { bestCarats, crackGeodes, depth, found, record, SessionCredit, type Cracked, type GeodaProgress } from './meta';
import { GeodaRenderer, type Hand } from './render';
import { crystalCells, GeodaSim, type GeodaEvent } from './sim';
import { EMPTY, FTUE_GAP, GEM, grabCell, N } from './wall';

const LONG_PRESS = 0.8;
const DRAG_PX = 10;
/** the hint toward a Pełna geoda shows from this many cells to fill */
const NEAR_FULL = 6;
/** the ambient pad in a Szlif: dark, a little lighter with calm (no live focus in the sound of a rest) */
const PAD_REST = 0.1, PAD_CALM = 0.2;

const cellsWord = (n: number) => (n === 1 ? 'komórka' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'komórki' : 'komórek');
/** A session length for the words: "3 min", "40 s". */
const lengthWord = (sec: number) => (Math.round(sec) % 60 === 0 ? `${Math.round(sec) / 60} min` : `${Math.round(sec)} s`);

export class GeodaGame implements ArcadeGame {
  private readonly sim: GeodaSim;
  private readonly view: GeodaRenderer;
  private readonly sound: GeodaSound;
  private readonly p: GeodaProgress;
  private layout: Layout;
  private readonly hand: Hand = { drag: null, press: null, cursor: null, back: null, hint: null, target: [] };
  private calib = 0;
  private frameDt = 0;
  /** a finger on a tray crystal; `armed`: it fits nowhere, so holding it crumbles it */
  private press: { slot: number; x: number; y: number; t: number; id: number; moved: boolean; armed: boolean } | null = null;
  private wallTap: { x: number; y: number; id: number } | null = null;
  /** a held Backspace: the slot it crumbles and for how long (s) */
  private held: { slot: number; t: number } | null = null;
  private begun = false;
  private playing = false;
  private readonly credit: SessionCredit;
  private settled: Cracked | null = null;
  private finale: FinaleView | null = null;
  private cracks = 0;
  private readonly daily: boolean;
  /** the best before this session: over all lengths (the runner's "Rekord") and for this length */
  private readonly bestBefore: number | null;
  private readonly lengthBest: number | null;
  private jam = false;
  private hintT = 0;

  constructor(private readonly env: GameEnv<GeodaProgress>) {
    const p = env.progress;
    this.p = p;
    const ftue = p.sessions === 0;
    this.daily = !ftue && p.dailyDay !== env.day;
    this.bestBefore = bestCarats(p);
    this.lengthBest = p.best[String(Math.round(env.plannedSec))] ?? null;
    this.credit = new SessionCredit(p, env.day, this.daily);
    this.sim = new GeodaSim({
      plannedSec: env.plannedSec, rng: env.rng, bagRng: this.daily ? mulberry32(env.daySeed) : undefined,
      ftue, beginner: p.sessions < 3, blind: p.sessions >= 3, tuning: env.tuning,
    });
    const ctx = env.canvas.getContext('2d');
    if (!ctx) throw new Error('Brak płótna 2D');
    this.view = new GeodaRenderer(ctx, env.reducedMotion);
    this.sound = new GeodaSound(env.audio);
    this.view.onSplash = pitch => { if (this.playing || !this.begun) this.sound.drip(pitch); };
    this.layout = computeLayout(1, 1);
  }

  resize(w: number, h: number, dpr: number): void {
    this.layout = computeLayout(w, h);
    this.view.resize(w, h, dpr, this.layout);
    this.cancelHand();
  }

  /** The calibration: draw() shows the "Kropla" scene until play begins. */
  intro(dt: number, p: number): void {
    this.calib = p;
    this.frameDt += dt;
  }

  start(): void {
    this.begun = true;
    this.sound.start();
  }

  update(dt: number, f: FocusFrame, t: number): void {
    const sim = this.sim;
    this.frameDt += dt;
    if (this.begun && !this.playing) {
      // the countdown already ran on the session clock: plan the blocks for the play that is left
      sim.start(Math.max(12, this.env.plannedSec - t));
      this.playing = true;
    }
    if (!this.playing) return;
    sim.update(dt, f, t >= this.env.plannedSec, !!this.hand.drag);
    this.sound.tick(dt);
    for (const e of sim.events.splice(0)) this.onEvent(e);
    // a long press crumbles a crystal that fits nowhere (a jam); a held Backspace any crystal
    const pr = this.press;
    if (pr && !this.hand.drag) {
      pr.t += dt;
      if (pr.armed) {
        this.hand.press = { slot: pr.slot, k: clamp(pr.t / LONG_PRESS) };
        if (pr.t >= LONG_PRESS) {
          if (!sim.fitsSomewhere(pr.slot)) sim.crumble(pr.slot);
          this.press = null;
          this.hand.press = null;
        }
      }
    }
    const held = this.held;
    if (held) {
      held.t += dt;
      this.hand.press = { slot: held.slot, k: clamp(held.t / LONG_PRESS) };
      if (held.t >= LONG_PRESS) {
        sim.crumble(held.slot);
        this.held = null;
        this.hand.press = null;
      }
    }
    if (this.hand.back) {
      this.hand.back.k += dt / 0.28;
      if (this.hand.back.k >= 1) this.hand.back = null;
    }
    // the drag ends with the Wzrost (a drop may still land during the Zbiór)
    if (this.hand.drag && sim.phase !== 'wzrost' && sim.phase !== 'zbior') this.cancelHand();
    if (sim.phase === 'finale') this.finaleSounds();
    this.hintT += dt;
    this.hand.hint = this.hint();
    this.hand.target = sim.ftue && sim.round === 0 && sim.phase === 'wzrost' ? FTUE_GAP.filter(i => sim.wall.cells[i].k === EMPTY) : [];
  }

  /** Draws the time passed since the last frame (none on a redraw while paused). */
  draw(): void {
    const dt = Math.min(0.05, this.frameDt);
    this.frameDt = 0;
    if (this.playing) this.view.draw(this.sim, this.hand, this.finale, dt);
    else this.view.intro(this.calib, dt);
  }

  // ── events ────────────────────────────────────────────────────
  private onEvent(e: GeodaEvent): void {
    const sim = this.sim, haptics = this.env.haptics;
    this.view.onEvent(e, sim);
    switch (e.type) {
      case 'wzrost':
        this.sound.wzrost();
        this.hintT = 0;
        this.jam = !sim.anyFits();
        if (e.round > 0) this.creditBlock();   // a Szlif ended
        break;
      case 'zbior':
        this.creditBlock();   // the Wzrost ended
        break;
      case 'grow':
        if (!e.hidden) this.sound.grow(e.ladder);
        this.jam = !sim.anyFits();
        break;
      case 'sprout':
        if (!e.hidden) this.sound.grow(1);
        this.jam = !sim.anyFits();
        break;
      case 'select':
        this.sound.select();
        break;
      case 'place':
        this.sound.place(e.cells.length);
        if (e.lines.length) this.sound.lineReady();
        if (haptics) buzz(e.lines.length ? [10, 30, 14] : 8);
        this.jam = !sim.anyFits();
        break;
      case 'nofit':
        this.sound.nofit();
        if (haptics) buzz(4);
        break;
      case 'wait':
        this.sound.drip(0.15);
        break;
      case 'crumble':
        this.sound.crumble();
        if (haptics) buzz(25);
        this.jam = !sim.anyFits();
        break;
      case 'telegraph':
        this.sound.telegraph(e.to);
        if (haptics) buzz(6);
        break;
      case 'reveal':
        this.sound.reveal();
        break;
      case 'shatter':
        this.sound.shatter(e.index, e.cells.filter(c => c.k === GEM).length);
        if (haptics && e.index === 0) buzz([14, 40, 14]);
        break;
      case 'bonus':
        this.sound.bonus(e.lines);
        break;
      case 'regrow':
        this.jam = !sim.anyFits();
        break;
      case 'szlif':
        this.sound.szlif();
        this.creditBlock();   // the Zbiór ended
        break;
      case 'polish':
        this.sound.polish();
        if (haptics) buzz([8, 30, 8]);
        break;
      case 'finale':
        this.settle();
        break;
      default:
        break;
    }
  }

  /** A block ended: what the session earned so far goes to the progress (an early end keeps it). */
  private creditBlock(): void {
    const s = this.sim, st = s.stats;
    this.credit.add({ carats: s.carats, zoneSec: st.zoneSec, lines: st.lines, fullGeodes: st.fullGeodes });
  }

  /** "Rozłup geodę": the session's specimen goes into the cabinet (once). */
  private settle(): void {
    if (this.settled) return;
    const s = this.sim;
    this.creditBlock();
    this.settled = crackGeodes(this.p, this.env.rng, { carats: s.carats, clearShare: s.clearShare, longest: s.brain.longest, geodes: 1 + s.stats.fullGeodes });
    record(this.p, this.env.plannedSec, s.carats, s.brain.longest, this.dailyKey);
    const r = this.settled.rolls[0];
    this.finale = { m: r.specimen.m, tier: r.specimen.tier, cm: r.specimen.cm, outcome: r.outcome, dust: r.dust, extra: this.settled.rolls.length - 1 };
    this.cancelHand();
    this.hand.cursor = null;
  }

  /**
   * The session ends before its crack ("Zakończ i zapisz", the overtime limit): what its end would
   * have done happens now, without the show — the open block is judged, full lines break and pay,
   * the geode cracks into the cabinet.  For the runner, once, before the final result(); a session
   * played to its end has settled already.
   */
  finish(): void {
    if (!this.playing || this.settled) return;
    this.sim.settle();
    this.sim.events.length = 0;   // no juice: the session is over
    this.settle();
  }

  /**
   * The ambient pad's light: the focus in a Wzrost; in a Szlif dark, a little lighter with calm;
   * held still in a Ciemna komora (no feedback there, not even by ear), the Zbiór and the finale.
   */
  padLevel(f: FocusFrame): number | null {
    const sim = this.sim;
    if (sim.phase === 'ready' || (sim.phase === 'wzrost' && sim.blindSlot < 0)) return f.reliable ? f.level : 0;
    if (sim.phase === 'szlif') return PAD_REST + PAD_CALM * f.calm;
    return null;
  }

  /** The daily geode's day, when this session is today's daily geode and has counted. */
  private get dailyKey(): string | undefined {
    return this.daily && this.credit.counted ? this.env.day : undefined;
  }

  private finaleSounds(): void {
    const t = this.sim.finaleT;
    const at = [1.3, 1.8, 2.25];
    while (this.cracks < at.length && t >= at[this.cracks]) this.sound.crack(this.cracks++);
    if (this.cracks === at.length && t >= 2.5) {
      this.cracks++;
      this.sound.open(this.finale?.tier ?? 0);
      if (this.env.haptics) buzz([20, 40, 60]);
    }
  }

  /** The line of guidance for now: the first session's steps, a strategy, a jam, a Pełna geoda in reach. */
  private hint(): string | null {
    const sim = this.sim;
    if (sim.phase !== 'wzrost') return null;
    if (sim.blindSlot >= 0 && this.hintT < 8) return 'Ciemna komora: kryształ rośnie w ciemności, zobaczysz go przy zbiorze.';
    // a jam: no crystal fits, and one could crumble (not the Ciemna komora's, which the hands cannot reach)
    if (this.jam && sim.tray.some((c, s) => c && c.grown > 1 && s !== sim.blindSlot)) return 'Nic nie pasuje: przytrzymaj kryształ, by go rozkruszyć.';
    if (sim.ftue) {
      if (sim.round === 0) {
        const c = sim.tray[0], open = FTUE_GAP.some(i => sim.wall.cells[i].k === EMPTY);
        if (!sim.stats.placed) return c && c.grown >= 2 ? 'Przeciągnij kryształ do świecącej szczeliny.' : 'Spokojne skupienie przyspiesza kapanie.';
        if (open) return 'Domknij szczelinę: pełny rząd pęknie na końcu Wzrostu.';
        return 'Pełne linie świecą i pękają na końcu Wzrostu.';
      }
      if (sim.round === 1 && this.hintT < 10) return 'Stuknij kryształ w tacce, by go karmić. Rośnie tylko karmiony.';
      if (sim.round === 2 && this.hintT < 10) return 'Dłużej równo = czystszy kryształ: mleczny, czysty, lśniący.';
    }
    if (this.daily && sim.round === 0 && this.hintT < 7) return 'Geoda dnia: dziś ta sama ściana i nasiona dla wszystkich.';
    if (this.hintT < 6) return STRATEGIES[sim.round % STRATEGIES.length];
    const left = sim.toFull;
    if (left === 0) return 'Pełna geoda! Pęknie cała na końcu Wzrostu.';
    if (left !== null && left <= NEAR_FULL) return `Jeszcze ${left} ${cellsWord(left)} do pełnej geody.`;
    return null;
  }

  // ── hands ─────────────────────────────────────────────────────
  pointer(e: PointerInput): void {
    const sim = this.sim, l = this.layout;
    if (!this.playing) return;
    if (e.type === 'down') {
      if (this.press || this.hand.drag) return;
      if (sim.phase !== 'wzrost') return;
      const slot = slotAt(l, e.x, e.y);
      if (slot >= 0 && slot < sim.slots && sim.tray[slot]) {
        // holding a crystal to look at it is safe: only one that fits nowhere crumbles
        const armed = slot !== sim.blindSlot && sim.tray[slot]!.grown > 1 && !sim.fitsSomewhere(slot);
        this.press = { slot, x: e.x, y: e.y, t: 0, id: e.id, moved: false, armed };
        return;
      }
      if (cellAt(l, e.x, e.y)) this.wallTap = { x: e.x, y: e.y, id: e.id };
      return;
    }
    if (e.type === 'move') {
      const pr = this.press;
      if (pr && pr.id === e.id && !this.hand.drag && Math.hypot(e.x - pr.x, e.y - pr.y) > DRAG_PX) {
        pr.moved = true;
        this.hand.press = null;
        if (sim.canPlace(pr.slot)) this.hand.drag = { slot: pr.slot, x: e.x, y: e.y, anchor: null, valid: false };
        else this.press = null;
      }
      if (this.wallTap && this.wallTap.id === e.id && Math.hypot(e.x - this.wallTap.x, e.y - this.wallTap.y) > DRAG_PX * 2) this.wallTap = null;
      const d = this.hand.drag;
      if (d && pr && pr.id === e.id) {
        d.x = e.x;
        d.y = e.y;
        this.snap();
      }
      return;
    }
    // up
    const d = this.hand.drag;
    if (d && this.press?.id === e.id) {
      const placed = d.anchor && d.valid && sim.place(d.slot, d.anchor[0], d.anchor[1], true);
      if (!placed) this.hand.back = { slot: d.slot, x: d.x, y: d.y, k: 0 };
      this.hand.drag = null;
      this.press = null;
      return;
    }
    if (this.press && this.press.id === e.id) {
      // a tap (or a hold that crumbled nothing) feeds the crystal
      if (!this.press.moved) sim.select(this.press.slot);
      this.press = null;
      this.hand.press = null;
      return;
    }
    if (this.wallTap && this.wallTap.id === e.id) {
      const c = cellAt(l, e.x, e.y);
      if (c) sim.tapWall(c[0], c[1]);
      this.wallTap = null;
    }
  }

  /** Where the crystal in the hand would land: lifted a cell above the finger, snapped to the grid. */
  private snap(): void {
    const d = this.hand.drag!, l = this.layout, c = this.sim.tray[d.slot];
    if (!c) return;
    const cells = crystalCells(c), g = grabCell(cells), s = l.cell;
    const x0 = d.x - (g[0] + 0.5) * s, y0 = d.y - (g[1] + 0.5) * s - s * 1.1;
    const ax = Math.round((x0 - l.wall.x) / s), ay = Math.round((y0 - l.wall.y) / s);
    let w = 0, hh = 0;
    for (const [x, y] of cells) { w = Math.max(w, x + 1); hh = Math.max(hh, y + 1); }
    const near = ax + w > 0 && ay + hh > 0 && ax < N && ay < N;
    d.anchor = near ? [ax, ay] : null;
    d.valid = near && this.sim.wall.fits(cells, ax, ay);
  }

  key(key: string, down: boolean): boolean {
    const sim = this.sim;
    if (!this.playing) return false;
    if (key === 'Backspace') {
      if (!down) {
        this.held = null;
        this.hand.press = null;
      } else if (!this.held && sim.phase === 'wzrost' && sim.placing >= 0 && sim.tray[sim.placing]!.grown > 1) this.held = { slot: sim.placing, t: 0 };
      return true;
    }
    if (!down) return key === ' ' || key === 'Enter' || key.startsWith('Arrow') || ['1', '2', '3'].includes(key);
    if (key === '1' || key === '2' || key === '3') {
      sim.select(Number(key) - 1);
      return true;
    }
    if (key.startsWith('Arrow')) {
      const c: Pt = this.hand.cursor ?? this.startCursor();
      const [dx, dy] = key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowRight' ? [1, 0] : key === 'ArrowUp' ? [0, -1] : [0, 1];
      this.hand.cursor = this.hand.cursor ? [clamp(c[0] + dx, 0, N - 1), clamp(c[1] + dy, 0, N - 1)] : c;
      return true;
    }
    if (key === ' ' || key === 'Enter' || key === 'Spacebar') {
      sim.placeKey(this.hand.cursor);
      return true;
    }
    return false;
  }

  /** The cursor appears where the crystal in hand would go first (else in the middle). */
  private startCursor(): Pt {
    const sim = this.sim, c = sim.tray[sim.placing];
    if (c) {
      const cells = crystalCells(c), g = grabCell(cells);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (sim.wall.fits(cells, x - g[0], y - g[1])) return [x, y];
    }
    return [3, 4];
  }

  private cancelHand(): void {
    const d = this.hand.drag;
    if (d) this.hand.back = { slot: d.slot, x: d.x, y: d.y, k: 0 };
    this.hand.drag = null;
    this.press = null;
    this.wallTap = null;
    this.hand.press = null;
    this.held = null;
  }

  pause(paused: boolean): void {
    if (paused) this.cancelHand();
  }

  canStop(): boolean {
    // time is up: the session ends after the Zbiór in progress, a drop in the hand and the 5 s crack
    return this.sim.phase === 'done';
  }

  // ── the numbers ───────────────────────────────────────────────
  result(): ArcadeOutcome {
    const s = this.sim, st = s.stats, p = this.p;
    record(p, this.env.plannedSec, s.carats, s.brain.longest, this.dailyKey);
    const share = s.clearShare, rytm = s.contrast.contrast;
    const judged = st.focusJudged + st.restJudged;
    const roll = this.settled?.rolls[0];
    const stats: [string, string][] = [
      ['Kryształy', String(st.placed)],
      ['Linie', String(st.lines)],
      ['Najdłuższa ciągłość', `${Math.round(s.brain.longest)} s`],
      ['Czyste i lśniące', share === null ? '—' : `${Math.round(share * 100)}%`],
      ['Rytm', rytm === null ? '—' : `${rytm >= 0 ? '+' : '−'}${Math.abs(rytm).toFixed(1)}%`],
      ['Bloki w normie', judged ? `${st.focusPass + st.restPass} z ${judged}` : '—'],
      ['Szlif', st.szlifs ? `${st.polished} z ${st.szlifs}` : '—'],
      ['Gablota', `${found(p)}/${MINERALS.length}`],
    ];
    // the record is the runner's (over every session length); a best for this length gets a line of its own
    const best = this.bestBefore, lengthBest = this.lengthBest;
    const isRecord = best !== null && s.carats > best;
    const hl: string[] = [];
    if (st.firstCrystal) hl.push('Pierwszy kryształ');
    if (roll) {
      const m = MINERALS[roll.specimen.m].title, tier = TIERS[roll.specimen.tier];
      hl.push(roll.outcome === 'new' ? `Nowy okaz: ${m}, ${tier}, ${roll.specimen.cm.toFixed(1)} cm`
        : roll.outcome === 'upgrade' ? `Lepszy okaz: ${m}, teraz ${tier}` : `Duplikat: ${m} → +${roll.dust} pyłu`);
    }
    if (!isRecord && lengthBest !== null && s.carats > lengthBest) hl.push(`Rekord ${lengthWord(this.env.plannedSec)}: ${s.carats} ct`);
    if (st.fullGeodes) hl.push(st.fullGeodes > 1 ? `Pełna geoda ×${st.fullGeodes}` : 'Pełna geoda!');
    const set = this.settled;
    if (set && set.crafted.length) hl.push(`Z pyłu: ${set.crafted.map(m => MINERALS[m].title).join(', ')}`);
    const level = depth(p.xp).level;
    if (level > this.credit.levelBefore) hl.push(`Głębokość ${level}`);
    if (this.dailyKey) hl.push('Geoda dnia zaliczona');
    const blind = st.blind[0];
    if (blind) hl.push(`Ciemna komora: ${blind.grown} z ${blind.total}, ${CLARITY[blind.clarity]}`);
    const finest = st.best;
    if (finest && finest.clarity >= 2 && finest.cells >= 3) hl.push(`Najczystszy kryształ: ${finest.cells} ${cellsWord(finest.cells)}, ${CLARITY[finest.clarity]}`);
    return { score: s.carats, unit: 'ct', record: isRecord, stats, highlights: hl.slice(0, 4) };
  }

  destroy(): void {
    this.cancelHand();
    this.view.onSplash = null;
  }
}
