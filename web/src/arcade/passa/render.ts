/**
 * Złota passa's picture (DESIGN.md §26, builder B; §29 the film of a day, P2): the day as a film through the places of
 * the player's day (the street — scene.ts; every other place — places.ts on the stage, stage.ts), shot by a moving
 * camera (camera.ts: a slow dolly, a push-in on the moment's thing, a look up to the garland, a dissolve on a cut), a
 * sense or a given moment's close-up (closeup.ts) with its rack focus and its greying, the guide line as a subtitle;
 * over it the garland of lights — the streak, strung over every place (garland.ts) — the moment's card coming and
 * turning from grey to gold (card.ts), the pocket a card that did not turn goes into, the choices in the thumb zone,
 * the narrator's line, the banner and the day-streak's hanging sign by the café — from a `PassaView` on a `Layout`.
 * The class and its methods are the contract builder A's index.ts calls: `resize(layout, dpr)` on every resize,
 * `draw(ctx, view, dt, time)` every frame (ctx scaled to CSS px).
 */
import { MIN_READ } from '../kit/mobile';
import { FilmCamera, camThrough, layerXf, type Frame } from './camera';
import { CardPainter, type CardLike } from './card';
import { CloseUp, type Rect as CRect } from './closeup';
import { Garland } from './garland';
import { cardFor, choiceRects, type Layout } from './layout';
import type { LifeView, Place } from './life';
import { drawFlame } from './motifs';
import {
  FONT, SERIF, TAU, clamp01, easeOut, fitWrap, font, glow, layer, lerp, lightAt, mixHex, rgba, rr, smooth, type Light,
} from './paint';
import { PlaceLayers, aimIn, drawLive, setOf, type PlaceSet } from './places';
import { Street, project, type Cam } from './scene';
import { roomAt, stageOf, type Stage } from './stage';
import type { PassaView, Phase, Rect } from './view';
import { CAM_X, EYE, HALF, SIGN } from './world';

/** The card's width in the street (m): how small it is far down the street. */
const CARD_WORLD_W = 0.62;
/** Where a card starts, far down the street (m). */
const FAR = { x: 0.5, y: 1.35, z: 40 } as const;
/** Seconds: a card's slide into the pocket, a gone card's fade. */
const CARRY_S = 1.6, GHOST_S = 0.7;
/** The depth of a place's far layer and of the world beyond its windows (the near layer is 1): the parallax. */
export const FAR_DEPTH = 0.55, BEYOND_DEPTH = 0.35;

interface Placed { card: CardLike; cx: number; cy: number; scale: number; id: string; carried: boolean }

const idOf = (c: CardLike): string => `${c.kind}|${c.motif}|${c.what}`;

/** Where a motif's thing is on the street (world metres), for the camera's push-in. */
const STREET_HOT: Readonly<Record<string, readonly [number, number, number]>> = {
  cup: [3.85, 1.0, 10.2], tea: [3.85, 1.0, 10.2], light: [3.35, 2.6, 11.2], bus: [-4.4, 1.6, 5.8], bread: [-4.9, 1.9, 19.5],
  flower: [4.6, 0.8, 23], sky: [0, 11, 40], sun: [0, 11, 40], bird: [0.6, 7, 24], rain: [0, 6, 20], rainbow: [0, 12, 40],
  smile: [-3.9, 1.6, 16], queue: [-4.6, 1.6, 21], car: [2.2, 0.8, 16], seed: [-3.95, 1.0, 10.2], grass: [-3.95, 1.0, 10.2],
  feet: [0.6, 0.0, 8], pet: [4.86, 4.4, 16.75], window: [4.9, 6.0, 15], letter: [-4.4, 1.3, 6], phone: [0.4, 1.3, 9],
};

/** A life moment's close-up framing from its `close` (0 the wide shot … 1 the thing filling the frame). */
export function closeShot(life: LifeView | null | undefined): { alpha: number; size: number; push: number; open: number; grey: number } {
  if (!life) return { alpha: 0, size: 0, push: 0, open: 0, grey: 0 };
  const c = clamp01(life.close);
  const given = life.kind === 'given' || (!life.kind && !life.sense);
  const grey = given ? smooth(clamp01(life.without)) : 0;
  return {
    alpha: smooth((c - 0.04) / 0.16),
    size: smooth((c - 0.25) / 0.75),
    push: smooth(c / 0.3),
    open: given ? 1 - grey : smooth((c - 0.25) / 0.75),
    grey,
  };
}

export class StreetView {
  private l: Layout | null = null;
  private readonly street: Street;
  private readonly garland = new Garland();
  private readonly cardP = new CardPainter();
  private readonly places = new PlaceLayers();
  private readonly cam: FilmCamera;
  private readonly close = new CloseUp();
  private S: Stage | null = null;
  private gcam: Cam = { cx: 0, hy: 0, f: 1 };
  private dpr = 1;
  private cuts = 0;
  private snap: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private snapKey = '';
  private cardY = NaN;
  private last: Placed | null = null;
  private ghost: Placed | null = null;
  private ghostT = 1;
  private carryT = 0;
  private bump = 0;
  private lastFrom: { x: number; y: number } | null = null;
  private sayText = '';
  private sayA = 0;
  private capText = '';
  private capA = 0;
  private banText = '';
  private banA = 0;
  private choicesA = 0;
  private veil = 0;
  private greyMax = 0;
  private bloom = 0;
  private flash = 0;
  private phase: Phase | '' = '';

  constructor(readonly opts: { reduced: boolean }) {
    this.street = new Street(!!opts?.reduced);
    this.cam = new FilmCamera(!!opts?.reduced);
  }

  /** The layout in use. */
  get layout(): Layout | null { return this.l; }
  /** The traffic light's state on the street now (a green light may be a moment's motif). */
  get trafficLight(): 'red' | 'amber' | 'green' | 'redAmber' { return this.street.light; }
  /** The garland's camera in a place before the camera moves (the street's own; indoors strung higher). */
  garlandCam(place: Place | null | undefined): Cam { return setOf(place) ? this.gcam : this.street.camera; }
  /** The film's state (the tests and the console): the place shown, the cuts so far, the camera's frame. */
  get film(): { place: Place | null; cuts: number; frame: Frame; mix: number } {
    return { place: this.cam.place, cuts: this.cam.cutCount, frame: this.cam.frame, mix: this.cam.mix };
  }

  resize(l: Layout, dpr: number): void {
    this.l = l;
    this.dpr = Math.max(1, dpr || 1);
    const cam: Cam = l.street ?? { cx: l.w / 2, hy: l.scene.y + l.scene.h * 0.85, f: Math.max(120, Math.min(l.w * 0.6, l.scene.h * 2)) };
    this.street.resize(l.w, l.h, dpr, cam);
    this.S = { ...stageOf({ ...l, street: cam }), age: this.S?.age };
    this.places.resize(this.S, dpr);
    // indoors the garland is strung higher, across the top of the place (its first span under the HUD's edge)
    const bandY = l.band?.y ?? 0, strip = Math.max(40, cam.hy - bandY);
    this.gcam = { cx: cam.cx, hy: Math.min(cam.hy, bandY + 0.05 * strip + 0.446 * cam.f), f: cam.f };
    this.cardY = NaN;
  }

  draw(ctx: CanvasRenderingContext2D, v: PassaView, dt: number, time: number): void {
    const l = this.l;
    if (!l || !v) return;
    const step = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
    const t = Number.isFinite(time) ? time : 0;
    const reduced = !!(this.opts.reduced || v.reduced);
    const lcam: Cam = this.street.camera;
    const day = clamp01(v.day);
    const Lt = lightAt(day);
    const k = l.k ?? 1;
    if (v.phase !== this.phase) {
      if (v.phase === 'carry') this.carryT = 0;
      this.phase = v.phase;
    }
    // ── the film: the place now, where the camera aims, how far it pushes in ──
    const place = (v.place ?? 'street') as Place;
    const set = setOf(place);
    const life = v.life ?? null;
    const motif = v.card?.motif ?? null;
    const shot = closeShot(life);
    const aim = this.aimAt(set, motif, lcam);
    let push = 0, lift = 0;
    const turn = clamp01(v.card?.turn ?? 0);
    switch (v.phase) {
      case 'arrive': push = 0.06; break;
      case 'turn': push = 0.12 + 0.22 * turn; break;
      case 'name': case 'without': push = 0.1; break;
      case 'savor': push = 0.12; lift = 1; break;
      case 'evening': case 'end': lift = 0.6; break;
      default: break;
    }
    if (life) push = Math.max(push, shot.push);
    if (v.age !== undefined && v.age !== this.S?.age && this.S) {
      // the group's day: its places follow it (re-baked once)
      this.S = { ...this.S, age: v.age };
      this.places.resize(this.S, this.dpr);
    }
    const S = this.S!;
    this.places.frame();
    const fr = this.cam.update(step, { place, aim, push, lift, w: l.w, h: l.h, M: set ? S.M : 0, street: !set }, reduced);
    if (this.cam.cutCount !== this.cuts) {
      this.cuts = this.cam.cutCount;
      this.snapshot(this.cam.prev, this.cam.prevFrame, day, t, reduced);
    }
    // the scene of the place (its live parts with it), then the place before fading away over it
    const camG = this.scene(ctx, this.dpr, place, fr, day, t, step, reduced, motif, shot.open, true);
    if (this.snap && this.cam.mix < 1 && this.cam.prev) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - smooth(this.cam.mix);
      ctx.drawImage(this.snap.c, 0, 0);
      ctx.restore();
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (!set) this.sign(ctx, v, camG, Lt, k);
    // where the card stands (between its place over the choices and its free place), and where it is now
    const n = v.choices?.length ?? 0;
    const target = cardFor(l, n);
    if (!Number.isFinite(this.cardY)) this.cardY = target.y;
    this.cardY += (target.y - this.cardY) * Math.min(1, step * 7);
    const rect: Rect = { ...target, y: this.cardY };
    // ── a sense or a given moment: the close-up, the greying, the colour coming back ──
    const capH = this.captionHeight(ctx, l, life);
    const strip = this.strip(l, capH);
    let thingAt = this.aimScreen(aim, fr, !!set);
    if (life && shot.alpha > 0.004 && motif) {
      this.close.draw(ctx, {
        motif, w: l.w, h: l.h, strip, day, alpha: shot.alpha, size: shot.size, open: shot.open, grey: shot.grey, time: t, reduced, dpr: this.dpr,
        backdrop: c => { this.scene(c, (c.getTransform?.().a || 1), place, fr, day, t, 0, reduced, motif, 0, false); },
      });
      const box = CloseUp.box({ motif, w: l.w, h: l.h, strip, size: shot.size });
      if (shot.alpha > 0.5) thingAt = { x: box.x + box.w / 2, y: box.y + box.h / 2, r: Math.max(box.w, box.h) * 0.5 };
    }
    this.greying(ctx, l, life, shot.grey, v.phase, step, thingAt, reduced);
    // a heavy moment: the street grows quieter round it
    const heavyNow = v.card?.kind === 'heavy' && (v.phase === 'arrive' || v.phase === 'name' || v.phase === 'turn');
    this.veil += ((heavyNow ? 1 : 0) - this.veil) * Math.min(1, step * 1.2);
    if (this.veil > 0.01) {
      ctx.fillStyle = rgba('#141a30', 0.3 * this.veil);
      ctx.fillRect(0, 0, l.w, l.h);
    }
    const card: CardLike | null = v.card ? { ...v.card, glow: v.glow } : null;
    const carrying = v.phase === 'carry';
    let now: Placed | null = null;
    if (card) {
      // a carried card's `near` (1 → 0) is its slide into the pocket, not a trip back down the street
      const p = this.place(rect, carrying ? 1 : card.near, lcam, reduced);
      now = { card, cx: p.cx, cy: p.cy, scale: p.scale, id: idOf(card), carried: carrying };
      if (this.last && this.last.id !== now.id && !this.last.carried) { this.ghost = this.last; this.ghostT = 0; }
      this.last = now;
    } else if (this.last) {
      if (!this.last.carried) { this.ghost = this.last; this.ghostT = 0; }
      this.last = null;
    }
    // the garland over the place: the streak travels with the day
    const from = now ? CardPainter.lightFrom(this.scaled(rect, now)) : this.lastFrom;
    if (from) this.lastFrom = from;
    const calm = v.phase === 'savor' || v.phase === 'evening' || v.phase === 'name' || v.phase === 'without' ? clamp01(v.glow) : 0;
    const gopts = { lights: v.lights, flying: v.flying, time: t, reduced, calm, dusk: Lt.dusk, breath: v.breath, from, k };
    this.garland.draw(ctx, camG, gopts);
    // the evening: the edges darken, the garland is the light
    if (Lt.dusk > 0.3) {
      const vg = ctx.createRadialGradient(l.w / 2, lcam.hy - lcam.f * 0.2, Math.min(l.w, l.h) * 0.25, l.w / 2, lcam.hy, Math.hypot(l.w, l.h) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, rgba('#05060f', 0.45 * (Lt.dusk - 0.3)));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, l.w, l.h);
    }
    // a soft floor under the card and the choices on an upright screen (the words read on any place)
    if (l.mode !== 'side') {
      const y0 = (l.cardFree ?? l.card).y - 30 * k;
      const g = ctx.createLinearGradient(0, y0, 0, l.h);
      g.addColorStop(0, 'rgba(10,8,14,0)');
      g.addColorStop(1, rgba('#0a080e', 0.42));
      ctx.fillStyle = g;
      ctx.fillRect(0, y0, l.w, l.h - y0);
    }
    this.banner(ctx, v, l, step, t, reduced);
    this.caption(ctx, v, l, step, rect);
    // the pocket, then the card (arriving, turning, carried, or a gone one fading)
    this.pocket(ctx, v, l, step, t, reduced);
    if (this.ghost) {
      this.ghostT += step / GHOST_S;
      if (this.ghostT >= 1) this.ghost = null;
      else {
        const gt = this.ghostT;
        const gc = { ...this.ghost.card, glow: (this.ghost.card.glow ?? 0) * (1 - gt) };
        this.cardP.draw(ctx, gc, this.ghost.cx, this.ghost.cy - (reduced ? 0 : gt * 14 * k), l.card.w, l.card.h, this.ghost.scale * (1 - 0.04 * gt), { time: t, reduced, font: l.font, k, alpha: 1 - smooth(gt), breath: v.breath });
      }
    }
    if (carrying && now) {
      // the slide follows the card's `near` (1 → 0); my own clock when it stays put
      this.carryT = Math.max(Math.min(1, this.carryT + step / CARRY_S) * (now.card.near >= 0.999 ? 1 : 0), 1 - clamp01(now.card.near));
      const before = this.carryT;
      this.carried(ctx, now, l, t, reduced, v.breath);
      if (before >= 0.92 && this.bump === 0) this.bump = 1;
    } else if (now) {
      const rest = v.phase === 'savor' || v.phase === 'name' || v.phase === 'without';
      this.cardP.draw(ctx, now.card, now.cx, now.cy, l.card.w, l.card.h, now.scale, {
        time: t, reduced, font: l.font, k, alpha: this.arriveAlpha(now.card.near, reduced), breath: rest ? v.breath : 0.5,
      });
    }
    // the light flying up into the garland, over the card
    this.garland.flight(ctx, camG, gopts);
    this.choices(ctx, v, l, step, t);
    this.say(ctx, v, l, step, rect);
  }

  // ── the film's scene ────────────────────────────────────────────

  /**
   * Paint a place's scene at a frame of the camera into `ctx` (whose device scale is `base` px per CSS px): the street
   * (sky, the baked street, its life) or a place's layers with their live parts; returns the garland's camera there.
   */
  private scene(ctx: CanvasRenderingContext2D, base: number, place: Place | null, fr: Frame, day: number, t: number, step: number, reduced: boolean, motif: string | null, open: number, live: boolean): Cam {
    const l = this.l!, S = this.S!;
    const set = setOf(place);
    const lcam = this.street.camera;
    if (!set) {
      const xf = layerXf(fr, 1, l.w, l.h, 0);
      ctx.save();
      ctx.setTransform(base * xf.z, 0, 0, base * xf.z, base * xf.x, base * xf.y);
      this.street.sky(ctx, day, t);
      this.street.street(ctx, day);
      if (live) this.street.life(ctx, day, t, step);
      ctx.restore();
      return camThrough(lcam, xf);
    }
    const xb = layerXf(fr, FAR_DEPTH, l.w, l.h, S.M), xn = layerXf(fr, 1, l.w, l.h, S.M);
    const R = roomAt(day, set.face);
    const units = (x: { z: number; x: number; y: number }) => ctx.setTransform(base * x.z * S.u, 0, 0, base * x.z * S.u, base * (x.x + x.z * S.cx), base * (x.y + x.z * S.hy));
    ctx.save();
    if (set.beyond) {
      const xw = layerXf(fr, BEYOND_DEPTH, l.w, l.h, S.M);
      units(xw);
      set.beyond(ctx, S, R, reduced ? 0 : t, reduced);
    }
    this.places.draw(ctx, set, 'back', day, xb, base);
    if (live) { units(xb); drawLive(ctx, set, 'behind', S, R, t, reduced, motif, open); }
    this.places.draw(ctx, set, 'front', day, xn, base);
    if (live) { units(xn); drawLive(ctx, set, 'over', S, R, t, reduced, motif, open); }
    ctx.restore();
    return camThrough(this.gcam, xn);
  }

  /** The place before, at its last frame, kept for the cut's dissolve. */
  private snapshot(prev: Place | null, fr: Frame | null, day: number, t: number, reduced: boolean): void {
    const l = this.l;
    if (!l || !prev || !fr) return;
    const key = `${Math.round(l.w)}|${Math.round(l.h)}|${this.dpr}`;
    if (key !== this.snapKey || !this.snap) { this.snap = layer(l.w, l.h, this.dpr); this.snapKey = key; }
    if (!this.snap) return;
    const c = this.snap.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.snap.c.width, this.snap.c.height);
    this.scene(c, this.dpr, prev, fr, day, t, 0, reduced, null, 0, true);
    this.places.keep([prev, this.cam.place ?? prev]);
  }

  /** The camera's aim for a motif in a place (CSS px of the canvas, before the camera's move). */
  private aimAt(set: PlaceSet | null, motif: string | null, cam: Cam): { x: number; y: number } {
    const S = this.S!;
    if (set) {
      const [x, y] = aimIn(set, motif);
      return { x: S.cx + x * S.u, y: S.hy + y * S.u };
    }
    const w = STREET_HOT[motif ?? ''] ?? [0.2, 3.2, 30];
    const [px, py] = project(cam, w[0], w[1], w[2]);
    return { x: Math.max(0, Math.min(this.l!.w, px)), y: Math.max(0, Math.min(this.l!.h, py)) };
  }

  /** The aim seen through the camera now (where the thing is on the screen). */
  private aimScreen(aim: { x: number; y: number }, fr: Frame, place: boolean): { x: number; y: number; r: number } {
    const l = this.l!;
    const xf = layerXf(fr, 1, l.w, l.h, place ? this.S!.M : 0);
    return { x: aim.x * xf.z + xf.x, y: aim.y * xf.z + xf.y, r: Math.min(l.w, l.h) * 0.22 * xf.z };
  }

  /** The strip over the card where a close-up's thing stands (less the subtitle's room). */
  private strip(l: Layout, capH: number): CRect {
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const top = band.y;
    const free = l.cardFree ?? l.card;
    const bottom = Math.max(top + 40, free.y - 8 - capH);
    return { x: band.x, y: top, w: band.w, h: bottom - top };
  }

  /**
   * A given moment's greying: the place and the thing lose their colour and dim as the rest imagines it gone; when
   * focus brings it back, a warm bloom where the thing is, and a short flash of gold when all its colour is back.
   */
  private greying(ctx: CanvasRenderingContext2D, l: Layout, life: LifeView | null, grey: number, phase: Phase, step: number, at: { x: number; y: number; r: number }, reduced: boolean): void {
    const given = !!life && (life.kind === 'given' || (!life.kind && !life.sense));
    if (!given) { this.greyMax = 0; this.bloom = Math.max(0, this.bloom - step * 0.8); this.flash = Math.max(0, this.flash - step * 0.7); }
    else {
      const before = this.greyMax;
      this.greyMax = Math.max(this.greyMax * (phase === 'arrive' ? 0 : 1), grey);
      const back = phase === 'turn' && before > 0.3 ? clamp01((before - grey) / before) : 0;
      this.bloom += (back * (1 - grey * 0.5) - this.bloom) * Math.min(1, step * 2.5);
      if (phase === 'turn' && before > 0.3 && grey < 0.03 && this.flash <= 0) this.flash = 1;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - step * 0.6);
    }
    if (grey > 0.005) {
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = 0.92 * grey;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.3 * grey;
      ctx.fillStyle = '#1a1e2a';
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.restore();
    }
    const b = Math.max(this.bloom * 0.8, this.flash);
    if (b > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffd890', at.x, at.y, at.r * (1.6 + (reduced ? 0 : 0.6 * this.flash)), 0.38 * b);
      glow(ctx, '#fff4dc', at.x, at.y, at.r * 0.6, 0.3 * b);
      ctx.globalAlpha = 0.07 * b;
      ctx.fillStyle = '#ffcf80';
      ctx.fillRect(0, 0, l.w, l.h);
      ctx.restore();
    }
  }

  // ── the card's place ────────────────────────────────────────────

  /** A card at `near` (0 far down the street … 1 held up close in `r`): its centre and scale (perspective). */
  private place(r: Rect, near: number, cam: Cam, reduced: boolean): { cx: number; cy: number; scale: number } {
    const ccx = r.x + r.w / 2, ccy = r.y + r.h / 2;
    const n = clamp01(near);
    if (reduced || n >= 0.999) return { cx: ccx, cy: ccy, scale: 1 };
    const Zc = (CARD_WORLD_W * cam.f) / Math.max(1, r.w);
    if (Zc >= FAR.z) return { cx: ccx, cy: ccy, scale: 1 };
    const xc = CAM_X + ((ccx - cam.cx) * Zc) / cam.f, yc = EYE - ((ccy - cam.hy) * Zc) / cam.f;
    const u = easeOut(n);
    const z = lerp(FAR.z, Zc, u), x = lerp(FAR.x, xc, u), y = lerp(FAR.y, yc, u);
    const [px, py] = project(cam, x, y, z);
    return { cx: px, cy: py, scale: Zc / z };
  }

  private arriveAlpha(near: number, reduced: boolean): number {
    const n = clamp01(near);
    return reduced ? smooth(n / 0.5) : smooth(n / 0.1);
  }

  private scaled(r: Rect, p: Placed): Rect {
    const w = r.w * p.scale, h = r.h * p.scale;
    return { x: p.cx - w / 2, y: p.cy - h / 2, w, h };
  }

  /** A card that did not turn sliding gently into the pocket (reduced motion: fading where it is). */
  private carried(ctx: CanvasRenderingContext2D, p: Placed, l: Layout, t: number, reduced: boolean, breath: number): void {
    const u = smooth(this.carryT);
    const pk = l.pocket ?? { x: l.card.x + 24, y: l.card.y, r: 24 };
    const k = l.k ?? 1;
    if (u >= 0.999) return;
    if (reduced) {
      this.cardP.draw(ctx, p.card, p.cx, p.cy, l.card.w, l.card.h, p.scale, { time: t, reduced, font: l.font, k, alpha: 1 - u, breath });
      return;
    }
    const cx = lerp(p.cx, pk.x, u), cy = lerp(p.cy, pk.y, u) - Math.sin(u * Math.PI) * 30 * k;
    const sc = p.scale * lerp(1, 0.1, u);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.35 * u);
    this.cardP.draw(ctx, { ...p.card, glow: 0 }, 0, 0, l.card.w, l.card.h, sc, { time: t, reduced, font: l.font, k, alpha: 1 - smooth((u - 0.7) / 0.3), breath });
    ctx.restore();
  }

  // ── the pocket ─────────────────────────────────────────────────

  private pocket(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number, reduced: boolean): void {
    const count = Math.max(0, Math.floor(v.carried || 0));
    if (count <= 0 && v.phase !== 'carry') { this.bump = 0; return; }
    const pk = l.pocket ?? { x: l.card.x + 24, y: l.card.y, r: 24 };
    if (this.bump > 0) this.bump = Math.max(0, this.bump - step * 1.6);
    const b = reduced ? 0 : Math.sin(this.bump * Math.PI) * 0.12;
    const r = pk.r * (1 + b);
    const x = pk.x, y = pk.y;
    ctx.save();
    // the bag: a linen pouch, its strap, its fold
    ctx.fillStyle = rgba('#0a0806', 0.3);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.95, r * 0.8, r * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#8a6a48';
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.beginPath();
    ctx.arc(x, y - r * 0.35, r * 0.42, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    const g = ctx.createLinearGradient(x - r, y - r * 0.4, x + r, y + r);
    g.addColorStop(0, '#efe2c6');
    g.addColorStop(1, '#cdb48a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.78, y - r * 0.38);
    ctx.lineTo(x + r * 0.78, y - r * 0.38);
    ctx.quadraticCurveTo(x + r * 0.92, y + r * 0.9, x, y + r * 0.92);
    ctx.quadraticCurveTo(x - r * 0.92, y + r * 0.9, x - r * 0.78, y - r * 0.38);
    ctx.fill();
    ctx.fillStyle = '#b8986c';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.78, y - r * 0.38);
    ctx.lineTo(x + r * 0.78, y - r * 0.38);
    ctx.quadraticCurveTo(x, y + r * 0.2, x - r * 0.78, y - r * 0.38);
    ctx.fill();
    // a soft warmth in it: these cards are kept, not lost
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ffd8a0', x, y + r * 0.2, r * 1.2, 0.12 + 0.1 * Math.sin(t * 0.8));
    ctx.globalCompositeOperation = 'source-over';
    // the count
    if (count > 0) {
      const br = Math.max(11, r * 0.48);
      const bx = x + r * 0.72, by = y - r * 0.45;
      ctx.fillStyle = '#3a2c20';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#f0d8a8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fbf0dc';
      ctx.font = font(700, Math.max(MIN_READ, br * 1.05));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), bx, by + 0.5);
    }
    ctx.restore();
  }

  // ── the day-streak's sign by the café ────────────────────────────

  private sign(ctx: CanvasRenderingContext2D, v: PassaView, cam: Cam, Lt: Light, k: number): void {
    const days = Math.max(0, Math.floor(v.days || 0));
    const text = (v.sign ?? '').trim() || (days > 0 ? String(days) : '');
    // the evening's banner (the identity) takes the sign's place
    const a = 1 - smooth(this.banText ? this.banA : 0);
    if (!text || a <= 0.01) return;
    const l = this.l!;
    const z = SIGN.z;
    const [wx, wy] = project(cam, HALF, SIGN.y + 0.3, z);
    const [hx, hy] = project(cam, SIGN.x - 0.15, SIGN.y + 0.3, z);
    const px = Math.max(MIN_READ, Math.min(17 * k, (cam.f * 0.2) / z));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = font(700, px, FONT);
    const sun = !v.sign;
    const tw = ctx.measureText(text).width + (sun ? px * 1.3 : 0);
    const pad = px * 0.7;
    const bw = tw + pad * 2, bh = px * 2.1;
    // the board hangs under the bracket's end; kept inside the canvas
    let bx = hx - bw / 2;
    bx = Math.max(6, Math.min(l.w - 6 - bw, bx));
    const by = hy + px * 0.7;
    if (by > l.h || by + bh < 0) { ctx.restore(); return; }
    // the bracket from the wall (it reaches further when the board had to move in)
    ctx.strokeStyle = mixHex('#2c3430', '#000000', 0.2);
    ctx.lineWidth = Math.max(1.5, px * 0.14);
    ctx.beginPath();
    ctx.moveTo(Math.min(wx, l.w + 20), wy);
    ctx.lineTo(bx + bw / 2, hy);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.2, hy);
    ctx.lineTo(bx + bw * 0.2, by);
    ctx.moveTo(bx + bw * 0.8, hy);
    ctx.lineTo(bx + bw * 0.8, by);
    ctx.stroke();
    // the enamel board: the café's green, a gold rim, gold letters — lit by the lamps at night
    const night = Lt.dusk;
    const board = mixHex('#2f5a4a', '#1a3028', night * 0.5);
    ctx.fillStyle = board;
    rr(ctx, bx, by, bw, bh, px * 0.35);
    ctx.fill();
    ctx.strokeStyle = mixHex('#d9b25a', '#ffe6a0', night * 0.4);
    ctx.lineWidth = Math.max(1.2, px * 0.1);
    rr(ctx, bx + 2, by + 2, bw - 4, bh - 4, px * 0.28);
    ctx.stroke();
    ctx.fillStyle = mixHex('#f5d58a', '#fff2c8', night * 0.5);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = bx + pad;
    if (sun) {
      const r = px * 0.38, sx = x + r, sy = by + bh / 2;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle as string;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(sx + Math.cos(a) * r * 0.85, sy + Math.sin(a) * r * 0.85);
        ctx.lineTo(sx + Math.cos(a) * r * 1.25, sy + Math.sin(a) * r * 1.25);
        ctx.stroke();
      }
      x += px * 1.3;
    }
    ctx.fillText(text, x, by + bh / 2 + 0.5);
    if (night > 0.3) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#ffd890', bx + bw / 2, by + bh / 2, bw * 0.7, 0.12 * night);
    }
    ctx.restore();
  }

  // ── the banner over the street ──────────────────────────────────

  private banner(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number, reduced: boolean): void {
    const want = (v.banner ?? '').trim();
    if (want !== this.banText) {
      this.banA = Math.max(0, this.banA - step * 3);
      if (this.banA <= 0.01) this.banText = want;
    } else this.banA = Math.min(1, this.banA + step * (reduced ? 2 : 1));
    if (!this.banText || this.banA <= 0.01) return;
    const r = l.banner, k = l.k ?? 1;
    const top = Math.min(34 * k, Math.max(20, r.h * 0.5));
    // the identity: its first part large, after " — " a second, smaller line ("wszystko współdziała ku dobremu")
    const cut = this.banText.indexOf(' — ');
    let head = this.banText, tail = '';
    if (cut > 0) {
      ctx.font = font(600, top, SERIF);
      if (ctx.measureText(this.banText).width > r.w * 0.94) { head = this.banText.slice(0, cut); tail = this.banText.slice(cut + 3); }
    }
    const f = fitWrap(ctx, head, r.w * 0.94, tail ? 1 : 2, top, 18, 600, SERIF);
    const g2 = tail ? fitWrap(ctx, tail, r.w * 0.94, 2, Math.max(MIN_READ + 3, f.px * 0.66), MIN_READ + 2, 500, SERIF, true) : null;
    const lh = f.px * 1.18, lh2 = g2 ? g2.px * 1.25 : 0;
    const blockH = f.lines.length * lh + (g2 ? g2.lines.length * lh2 + f.px * 0.15 : 0);
    const cy = r.y + r.h / 2;
    const y0 = cy - blockH / 2 + lh / 2;
    ctx.save();
    ctx.globalAlpha = smooth(this.banA);
    // a soft dark ground for the words on any sky, then a warm glow behind them
    const tw = Math.max(...f.lines.map(s => { ctx.font = font(600, f.px, SERIF); return ctx.measureText(s).width; }));
    glow(ctx, '#0a0814', r.x + r.w / 2, cy, tw * 0.62 + f.px, 0.3, Math.min(1.2, (blockH + f.px) / (tw * 0.62 + f.px)));
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#ffcf80', r.x + r.w / 2, cy, Math.max(r.w * 0.36, f.px * 3), 0.22 + (reduced ? 0 : 0.05 * Math.sin(t * 0.9)), 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = font(600, f.px, SERIF);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff6dc';
    f.lines.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, y0 + i * lh));
    if (g2) {
      ctx.font = font(500, g2.px, SERIF, true);
      ctx.fillStyle = '#ffe6b0';
      const y2 = y0 + f.lines.length * lh - lh / 2 + f.px * 0.15 + lh2 / 2;
      g2.lines.forEach((ln, i) => ctx.fillText(ln, r.x + r.w / 2, y2 + i * lh2));
    }
    ctx.restore();
  }

  // ── the guide line: a subtitle over the close-up ─────────────────

  private capFit(ctx: CanvasRenderingContext2D, l: Layout, text: string): { lines: string[]; px: number; w: number; h: number; padX: number; padY: number } {
    const k = l.k ?? 1;
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const w = Math.min(band.w, Math.round(560 * Math.min(k, 1.6)));
    const padX = 14 * Math.min(k, 1.4), padY = 8 * Math.min(k, 1.4);
    let f = fitWrap(ctx, text, w - 2 * padX, 2, Math.max(l.font + 2, 17), MIN_READ, 500, SERIF, true);
    if (f.lines.length > 2) f = fitWrap(ctx, text, w - 2 * padX, 3, MIN_READ, MIN_READ, 500, SERIF, true);
    const lh = f.px * 1.28;
    return { lines: f.lines, px: f.px, w, h: f.lines.length * lh + 2 * padY, padX, padY };
  }

  /** The room the subtitle takes over the card (0 when there is none). */
  private captionHeight(ctx: CanvasRenderingContext2D, l: Layout, life: LifeView | null): number {
    const text = (life?.guide ?? '').trim() || (this.capA > 0.05 ? this.capText : '');
    if (!text) return 0;
    return this.capFit(ctx, l, text).h + 8;
  }

  private caption(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, card: Rect): void {
    const want = (v.life?.guide ?? '').trim();
    if (want !== this.capText) {
      this.capA = Math.max(0, this.capA - step * 4);
      if (this.capA <= 0.01) this.capText = want;
    } else this.capA = Math.min(1, this.capA + step * 2.2);
    if (!this.capText || this.capA <= 0.01) return;
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const f = this.capFit(ctx, l, this.capText);
    const lh = f.px * 1.28;
    // above the card; above the narrator's line too when it stands over the card (choices open)
    const open = (v.choices?.length ?? 0) > 0;
    const sayRoom = open && this.sayText ? Math.max(l.font, 15) * 1.3 * 2 + 30 : 0;
    const free = l.cardFree ?? l.card;
    const bottom = Math.min(card.y, free.y) - 8 - sayRoom;
    const y = Math.max(band.y, bottom - f.h);
    ctx.font = font(500, f.px, SERIF, true);
    const tw = Math.max(...f.lines.map(s => ctx.measureText(s).width));
    const bw = Math.min(f.w, tw + 2 * f.padX);
    const x = band.x + band.w / 2 - bw / 2;
    ctx.save();
    ctx.globalAlpha = smooth(this.capA);
    ctx.fillStyle = rgba('#0c0a10', 0.5);
    rr(ctx, x, y, bw, f.h, Math.min(16, f.h / 2));
    ctx.fill();
    ctx.strokeStyle = rgba('#ffe6b8', 0.18);
    ctx.lineWidth = 1;
    rr(ctx, x + 0.5, y + 0.5, bw - 1, f.h - 1, Math.min(16, f.h / 2));
    ctx.stroke();
    ctx.fillStyle = '#fff3dc';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    f.lines.forEach((ln, i) => ctx.fillText(ln, band.x + band.w / 2, y + f.padY + lh * (i + 0.5)));
    ctx.restore();
  }

  // ── the choices ────────────────────────────────────────────────

  private choices(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, t: number): void {
    const list = v.choices ?? [];
    this.choicesA = list.length ? Math.min(1, this.choicesA + step * 4) : 0;
    if (!list.length) return;
    const rects = choiceRects(l, list.length);
    const k = l.k ?? 1;
    const a = smooth(this.choicesA);
    ctx.save();
    for (let i = 0; i < list.length && i < rects.length; i++) {
      const c = list[i], r = rects[i];
      const rad = Math.min(14 * k, r.h * 0.3);
      ctx.globalAlpha = a;
      // the ground: dark warm glass, lit gold when chosen; trust's a deep night blue with a small flame
      if (c.chosen) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, c.trust ? '#ffc880' : '#ffcf70', r.x + r.w / 2, r.y + r.h / 2, r.w * 0.55, 0.28, (r.h * 2) / r.w);
        ctx.globalCompositeOperation = 'source-over';
      }
      let bg: CanvasGradient | string;
      if (c.trust) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, c.chosen ? '#3c4a7c' : 'rgba(30,36,66,0.9)');
        g.addColorStop(1, c.chosen ? '#2c3460' : 'rgba(22,26,50,0.9)');
        bg = g;
      } else if (c.chosen) {
        const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
        g.addColorStop(0, '#fbe2a0');
        g.addColorStop(1, '#eebc5c');
        bg = g;
      } else bg = 'rgba(24,18,14,0.78)';
      ctx.fillStyle = bg;
      rr(ctx, r.x, r.y, r.w, r.h, rad);
      ctx.fill();
      ctx.strokeStyle = c.chosen ? (c.trust ? '#ffd890' : '#fff2c4') : c.trust ? 'rgba(232,184,112,0.7)' : 'rgba(251,236,210,0.32)';
      ctx.lineWidth = c.chosen ? 2 : 1.2;
      rr(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, rad);
      ctx.stroke();
      // a key's number on a desk; trust's flame
      let x = r.x + 14 * Math.min(k, 1.4);
      const cy = r.y + r.h / 2;
      if (!l.touch) {
        const br = Math.max(10, 11 * Math.min(k, 1.4));
        ctx.fillStyle = c.chosen && !c.trust ? 'rgba(90,58,20,0.18)' : 'rgba(251,236,210,0.14)';
        ctx.beginPath();
        ctx.arc(x + br, cy, br, 0, TAU);
        ctx.fill();
        ctx.fillStyle = c.chosen && !c.trust ? '#6b4410' : '#f2e4cc';
        ctx.font = font(700, Math.max(MIN_READ, br * 1.15));
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x + br, cy + 0.5);
        x += br * 2 + 10;
      }
      if (c.trust) {
        const s = Math.min(r.h * 0.78, 34 * k);
        drawFlame(ctx, x - s * 0.18, cy - s * 0.52, s, t, c.chosen ? 1 : 0.6);
        x += s * 0.68;
      }
      // the label: 16 px down to 13, two lines (three only if it must), never cut
      const tw = r.x + r.w - 14 * Math.min(k, 1.4) - x;
      let f = fitWrap(ctx, c.label, tw, 2, Math.max(l.font, 15), MIN_READ, 600, FONT);
      if (f.lines.length > 2) f = fitWrap(ctx, c.label, tw, 3, MIN_READ, MIN_READ, 600, FONT);
      const lh = f.px * 1.22;
      ctx.font = font(600, f.px, FONT);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.chosen && !c.trust ? '#3a2410' : '#fbf1de';
      const y0 = cy - ((f.lines.length - 1) * lh) / 2;
      f.lines.forEach((ln, j) => ctx.fillText(ln, x, y0 + j * lh));
    }
    ctx.restore();
  }

  // ── the narrator's line ────────────────────────────────────────

  private say(ctx: CanvasRenderingContext2D, v: PassaView, l: Layout, step: number, card: Rect): void {
    const want = (v.say ?? '').trim();
    if (want !== this.sayText) {
      this.sayA = Math.max(0, this.sayA - step * 5);
      if (this.sayA <= 0.01) this.sayText = want;
    } else this.sayA = Math.min(1, this.sayA + step * 3.5);
    if (!this.sayText || this.sayA <= 0.01) return;
    const k = l.k ?? 1;
    const open = (v.choices?.length ?? 0) > 0;
    // where: its place while no choices are open; with choices, over the card when the street's strip has room
    let r: Rect = l.say;
    const band = l.band ?? { x: 0, y: 0, w: l.w, h: l.h };
    const px0 = Math.max(l.font, 15);
    if (open && !v.card) {
      // the evening's pick (the day's wins as choices, no card): the question right over them
      const rs = choiceRects(l, v.choices.length);
      const need = px0 * 1.3 * 2 + 22;
      const top = l.mode === 'side' ? l.card.y : rs[0].y - 8 - need;
      r = l.mode === 'side' ? { x: l.card.x, y: l.card.y, w: l.card.w, h: l.card.h } : { x: rs[0].x, y: Math.max(band.y, top), w: rs[0].w, h: need };
    } else if (open || (l.mode === 'side' && v.phase === 'turn' && !this.capText)) {
      const need = px0 * 1.3 * 2 + 22;
      const room = card.y - band.y - 8;
      if (room < need) return;
      const w = Math.min(band.w, Math.max(card.w, 420 * k));
      r = { x: Math.max(band.x, Math.min(band.x + band.w - w, card.x + card.w / 2 - w / 2)), y: card.y - 8 - need, w, h: need };
    }
    const padX = 14 * Math.min(k, 1.4), padY = 9 * Math.min(k, 1.4);
    const f = fitWrap(ctx, this.sayText, r.w - 2 * padX, 3, px0, MIN_READ, 500, FONT);
    const lh = f.px * 1.3;
    ctx.font = font(500, f.px, FONT);
    const tw = Math.max(...f.lines.map(s => ctx.measureText(s).width));
    const bw = Math.min(r.w, tw + 2 * padX), bh = f.lines.length * lh + 2 * padY;
    const bx = r.x + (r.w - bw) / 2, by = r.y + Math.max(0, (r.h - bh) / 2);
    ctx.save();
    ctx.globalAlpha = smooth(this.sayA);
    ctx.fillStyle = rgba('#0a0806', 0.25);
    rr(ctx, bx + 1, by + 3, bw, bh, 14 * Math.min(k, 1.4));
    ctx.fill();
    ctx.fillStyle = rgba('#fbf3e4', 0.95);
    rr(ctx, bx, by, bw, bh, 14 * Math.min(k, 1.4));
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    f.lines.forEach((ln, i) => ctx.fillText(ln, bx + bw / 2, by + padY + lh * (i + 0.5)));
    ctx.restore();
  }
}
