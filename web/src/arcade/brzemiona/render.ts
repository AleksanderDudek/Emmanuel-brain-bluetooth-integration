/**
 * Brzemiona's play view: the triptych (scene.ts) from the session's state, smoothed so nothing jumps — the one prayed
 * for appearing at a call, the many and the whole world fading in as the circle widens, each circle's light, the sky
 * warming over the session, the Cross resting in its light — with the narrator over the sky, the words band, the
 * controls, the chooser and the story card (hud.ts).  Taps are routed here: a card, the chooser, a control, or the
 * picture (stay with them).
 */
import { approach, clamp } from '../kit/juice';
import type { Insets, TapTarget } from '../kit/types';
import { t, whoName } from './i18n';
import { controlLive, drawBand, drawCaption, drawChooser, drawControls, drawStory } from './hud';
import { hitAt, layout, manyCount, tapTargets, type Control, type Layout, type Rect } from './layout';
import { Scene, type SceneState } from './scene';
import type { BrzSim, CoachAt, SimEvent } from './sim';

export interface ViewOpts { reducedMotion: boolean; touch: boolean }

export class BrzView {
  L: Layout;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  readonly scene = new Scene();
  private time = 0;
  // smoothed visuals
  private appear = 0;
  private many = 0;
  private world = 0;
  private warm = 0.1;
  private rest = 0;
  private player = 0.5;
  private touchK = 0;
  private glowK = 0;
  private lightOne = 0;
  private lightMany = 0;
  private lightWorld = 0;
  hover: string | null = null;
  private storyR: Rect | null = null;
  /** the narrower circles of this burden turned whole (their light stays full); else they keep the light reached */
  private done = { one: false, many: false };

  constructor(canvas: HTMLCanvasElement, private readonly opts: ViewOpts) {
    this.ctx = canvas.getContext('2d');
    this.L = layout(360, 640, undefined, opts.touch);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.dpr = dpr;
    this.L = layout(w, h, ins, this.opts.touch);
  }

  /** The session's events: a call fades the new one in, a tap rings them. */
  on(e: SimEvent, sim: BrzSim): void {
    if (e.type === 'call') {
      this.appear = this.opts.reducedMotion ? 0.4 : 0;
      this.done = { one: sim.circle !== 'one' && sim.x <= 0, many: sim.circle === 'world' && sim.x <= 0 };
      this.snapLights(sim);
    } else if (e.type === 'circle') {
      if (e.circle === 'one') this.done.one = true;
      if (e.circle === 'many') this.done.many = true;
    } else if (e.type === 'tap') this.touchK = 1;
  }

  /** The circles' lights as they are (a new burden, a resumed one): the narrower circles are done. */
  private snapLights(sim: BrzSim): void {
    const c = sim.circle;
    this.lightOne = c === 'one' || !this.done.one ? sim.shown : 1;
    this.lightMany = c === 'many' || (c === 'world' && !this.done.many) ? sim.shown : c === 'world' ? 1 : 0;
    this.lightWorld = c === 'world' ? sim.shown : 0;
    this.many = c === 'many' || c === 'world' ? 1 : 0;
    this.world = c === 'world' ? 1 : 0;
  }

  update(dt: number, sim: BrzSim): void {
    this.time += dt;
    const c = sim.circle;
    const fade = this.opts.reducedMotion ? 0.6 : 1.1;
    const leaving = sim.stage === 'leave' || sim.stage === 'end';
    this.appear = approach(this.appear, leaving ? 0.62 : 1, dt, leaving ? 3 : fade);
    this.many = approach(this.many, c === 'many' || c === 'world' ? 1 : 0, dt, 1.4);
    this.world = approach(this.world, c === 'world' ? 1 : 0, dt, 1.6);
    const x = sim.shown;
    // a circle turned whole stays in full light; one widened by hand keeps the light it reached (it goes on growing)
    this.lightOne = approach(this.lightOne, c === 'one' || !this.done.one ? Math.max(c === 'one' ? 0 : this.lightOne, x) : 1, dt, 0.8);
    this.lightMany = approach(this.lightMany, c === 'many' ? x : c === 'world' ? (this.done.many ? 1 : Math.max(this.lightMany, x)) : 0, dt, 0.8);
    this.lightWorld = approach(this.lightWorld, c === 'world' ? x : 0, dt, 0.8);
    const share = clamp(sim.t / Math.max(1, sim.plannedSec));
    const warmTo = sim.phase !== 'play' ? 1 : clamp(0.1 + 0.55 * share + 0.06 * sim.carriedNow, 0, 0.9);
    this.warm = approach(this.warm, warmTo, dt, 4);
    this.rest = approach(this.rest, sim.restBlock || sim.phase !== 'play' ? (sim.phase !== 'play' ? 1 : 0.75) : 0, dt, 1.5);
    this.player = approach(this.player, sim.restBlock || sim.phase !== 'play' ? 1 : 0.55, dt, 1.5);
    this.touchK = approach(this.touchK, 0, dt, 0.6);
    this.glowK = approach(this.glowK, sim.loading ? 1 : 0, dt, 0.5);
  }

  private state(sim: BrzSim): SceneState {
    const b = sim.breath;
    const L = this.L;
    const world = this.world > 0.5;
    const who = world ? t('who.world') : whoName(sim.item);
    return {
      time: this.time, warm: this.warm, appear: this.appear,
      light: this.lightOne, cloud: 1 - (sim.circle === 'one' ? this.lightOne : sim.circle === 'many' ? this.lightMany : this.lightWorld),
      lightMany: this.lightMany, lightWorld: this.lightWorld,
      many: this.many, world: this.world,
      waiting: clamp(sim.waiting / 0.08), gold: sim.gold, glow: sim.glow, rest: this.rest,
      phase: b.phase, p: b.p, k: b.k,
      flows: sim.phase === 'play' && (!sim.restBlock || sim.stage === 'peace') && sim.stage !== 'leave',
      lightOnly: sim.lightOnly, reduced: this.opts.reducedMotion, player: this.player, touch: this.touchK,
      whoLabel: who, youLabel: t('who.you'), labelPx: L.font.label,
    };
  }

  draw(sim: BrzSim): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const L = this.L;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);
    this.scene.draw(ctx, L, this.dpr, this.state(sim), manyCount(L));
    const line = sim.talk.line;
    if (line && !sim.story && !sim.chooser) {
      const a = Math.min(1, line.t / 0.35, (line.dur - line.t) / 0.5);
      drawCaption(ctx, L, line.text, a);
    }
    drawBand(ctx, L, sim, this.glowK);
    drawControls(ctx, L, sim, this.hover && !sim.chooser && !sim.story ? (this.hover as Control) : null);
    drawChooser(ctx, L, sim, this.hover);
    this.storyR = drawStory(ctx, L, sim, this.hover === 'story');
  }

  private targetState(sim: BrzSim) {
    const ch = sim.chooser;
    const count = ch ? Math.min(6, sim.queue.length - ch.page * 6) : 0;
    return { story: sim.story ? this.storyR ?? { ...this.L.story } : null, chooser: ch ? { count, pages: sim.pages } : null, live: sim.started && sim.phase === 'play' };
  }

  /** A tap (or a click): a story card turns, the chooser answers, a control acts, the picture stays with them. */
  tap(x: number, y: number, sim: BrzSim): string | null {
    if (sim.story) {
      sim.stay();
      return 'story';
    }
    const hit = hitAt(this.L, this.targetState(sim), x, y);
    if (sim.chooser) {
      if (hit === 'close' || hit === 'outside') sim.closeChooser();
      else if (hit === 'page:prev') sim.turnPage(-1);
      else if (hit === 'page:next') sim.turnPage(1);
      else if (hit?.startsWith('item:')) sim.choose(sim.chooser.page * 6 + Number(hit.slice(5)));
      return hit;
    }
    if (hit === 'list') sim.openChooser();
    else if (hit === 'widen') sim.widen();
    else if (hit === 'next') sim.next();
    else sim.stay();
    return hit;
  }

  /** A desktop's mouse: what a click would do answers (a brighter control, its name); true when it is clickable. */
  hoverAt(x: number, y: number, sim: BrzSim): boolean {
    if (sim.story) {
      const r = this.storyR;
      this.hover = r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h ? 'story' : null;
      return true;
    }
    const hit = hitAt(this.L, this.targetState(sim), x, y);
    this.hover = hit;
    if (sim.chooser) return !!hit && hit !== 'card';
    if (hit === 'list' || hit === 'widen' || hit === 'next') return controlLive(sim, hit);
    return y >= this.L.top && sim.phase === 'play';
  }

  targets(sim: BrzSim): TapTarget[] {
    return tapTargets(this.L, this.targetState(sim));
  }

  /** Where a coach mark points (CSS px). */
  pointAt(at: CoachAt): { x: number; y: number } | null {
    const S = this.scene.S;
    const L = this.L;
    if (at === 'cross' && S) return { x: S.cross.cx, y: S.cross.cy - S.cross.h * 0.1 };
    if (at === 'person' && S) return { x: S.person.x, y: S.person.y - S.person.H * 0.9 };
    if (at === 'controls') return { x: L.ctl.list.x + L.ctl.list.w / 2, y: L.ctl.list.y };
    if (at === 'band') return { x: L.words.x + L.words.w / 2, y: L.words.y };
    return null;
  }
}
