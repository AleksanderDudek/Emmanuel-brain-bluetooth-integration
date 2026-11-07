/**
 * Dolina's play view, all on the canvas: the valley of the shadow in parallax (the sky, the era's far
 * silhouettes, the things beside the road), the ground in floors with their ledges, pits always
 * outlined, the stone blocks with their numbers, the stair rising from the stones, the gates of light,
 * the pens and the lambs, the shadows, the guardian with its tells, the way out; the fog of the dark
 * with a circle of lamplight around the pilgrim — its radius is the lamp's reach, the band's live
 * gauge, with the threshold drawn as a dotted ring on the light itself and the rim turning gold
 * beyond it, the Świt's charge ringing the lamp — and the tide of the dark creeping from the left;
 * the pilgrim with his lamp and sword, Ćma fluttering by the lamp (and grabbing his hood to flap on
 * a double jump), the lantern posts lit gold where the band was above the threshold (the history),
 * particles, hit-stop, shake, and the game's own layer (hud.ts) on top.  It only reads the sim.
 */
import { Particles, Shake, approach, clamp, ease } from '../kit/juice';
import { passage } from '../kit/scripture';
import { eraName, guardName, weaponName, type EraId } from './content';
import { Hud } from './hud';
import { sparks as sparksText, stepsText, stonesText, t } from './i18n';
import { DolinaIntro } from './intro';
import { layout, type Layout } from './layout';
import type { DolinaProgress } from './meta';
import {
  C, PAL, SANS, TAU, font, glow, mixPal, paintEyes, paintFar, paintGuard, paintMid, paintMoth, paintPilgrim, paintPost, paintShadow, paintSky,
  type Palette, type Scene,
} from './paint';
import { LAMP_MARK, RULES, above, type DolinaSim, type SimEvent } from './sim';
import { paintBlock, paintExit, paintGate, paintGround, paintLamb, paintPen, paintRim, paintRollBrick, paintStep, paintThrow, paintTide } from './sprites';

interface Ring { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface Ghost { kind: SimEventKill['kind']; x: number; y: number; t: number; id: number }
type SimEventKill = Extract<SimEvent, { type: 'kill' }>;

const STONE_CHIP: Readonly<Record<EraId, string>> = { babel: '#d39a62', twierdza: '#8a8090', miasto: '#7f9ca6' };

export class DolinaView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 1280;
  private h = 800;
  private dpr = 1;
  private L: Layout = layout(1280, 800, 0);
  private readonly hud: Hud;
  private readonly intro0 = new DolinaIntro();
  private clock = 0;
  private started = false;
  private readonly parts = new Particles(800);
  private readonly rings: Ring[] = [];
  private readonly ghosts: Ghost[] = [];
  private readonly shake: Shake;
  private readonly rnd = Math.random;
  private runPh = 0;
  private fallK = 0;
  private flash = 0;
  private flashColor = 'rgba(255,236,190,';
  private camY = 0;
  private scene: EraId = 'babel';
  private palFrom: Palette = PAL.babel;
  private palTo: Palette = PAL.babel;
  private palK = 1;
  private meadow = 0;
  private dawnK = 0;
  private lampShown: number = RULES.flame;
  private moth = { x: 0, y: 0, vx: 0, vy: 0 };
  private mothFace = 1;
  private bubbleA = 0;
  private bubbleText = '';
  private wow = 0;

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.hud = new Hud(this.ctx);
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, hudTop: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, hudTop);
    this.hud.resize(this.L);
  }

  start(sim: DolinaSim): void {
    this.started = true;
    this.setScene(sim.era, true);
    this.camY = sim.floorY;
    const l = this.lampAt(sim);
    this.moth = { x: l.x + this.S, y: l.y - this.S, vx: 0, vy: 0 };
    if (sim.first) this.hud.card('story', t('story.title'), t('story.text'), RULES.storySec, { verse: 'psa23.4' });
    else this.hud.card('toast', t('level.title', { n: sim.level }), eraName(sim.era), 2.6);
  }

  intro(dt: number, p: number, progress: DolinaProgress): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.intro0.draw(this.ctx, this.w, this.h, dt, p, progress);
  }

  /** A card is up that Ćma and the coach wait for. */
  get busy(): boolean { return this.hud.busy; }

  private get S(): number { return this.L.S; }
  sx(x: number, sim: DolinaSim): number { return this.L.runX + (x - sim.px) * this.S; }
  sy(y: number): number { return this.L.floorLine - (y - this.camY) * this.S; }

  /** Where the lamp hangs (its light's centre). */
  private lampAt(sim: DolinaSim): { x: number; y: number } {
    return { x: this.L.runX + this.S * 0.45, y: this.sy(sim.py + 0.7) };
  }

  // ── events ──────────────────────────────────────────────────────
  on(e: SimEvent, sim: DolinaSim): void {
    const S = this.S, u = this.L.u, rnd = this.rnd;
    switch (e.type) {
      case 'jump': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        if (e.air) {
          // Ćma grabs his hood and flaps: a puff of golden moth dust
          this.parts.burst(x, y + S * 0.1, 18, { color: '#f3dca0', size: 2.4 * u, speed: 120 * u, angle: Math.PI / 2, spread: Math.PI * 0.9, g: 120, drag: 2.5, life: 0.6, rnd });
          this.ring(x, y, S * 0.2, S * 0.9, 'rgba(255,236,190,', 0.35, 3 * u);
          this.wow = 0.4;
        } else this.parts.burst(x, y, 6, { color: 'rgba(200,180,150,.7)', size: 2 * u, speed: 60 * u, angle: -Math.PI / 2, spread: Math.PI * 0.7, g: 200, life: 0.35, rnd });
        break;
      }
      case 'land':
        if (e.v > 8) this.parts.burst(this.sx(e.x, sim), this.sy(e.y), 8, { color: 'rgba(200,180,150,.6)', size: 2 * u, speed: 70 * u, angle: -Math.PI / 2, spread: Math.PI, g: 300, life: 0.35, rnd });
        break;
      case 'stomp': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.ring(x, y, S * 0.2, S * 1.2, 'rgba(255,236,190,', 0.35, 4 * u);
        this.hud.float(t('fx.stomp'), x, y - S * 0.4, '#fff1c4', 16);
        this.shake.add(0.18);
        break;
      }
      case 'strike': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, 5, { color: e.what === 'stone' ? STONE_CHIP[sim.era] : '#fff1c4', size: 2.4 * u, speed: 160 * u, angle: -Math.PI * 0.8, spread: Math.PI * 0.8, g: 600, life: 0.45, shape: 'square', rnd });
        if (e.what !== 'shadow') this.hud.float(`−${e.dmg}`, x + S * 0.2, y - S * 0.3, 'rgba(255,241,196,.9)', 12, 0.6, 22);
        if (e.what === 'guard') this.shake.add(0.1);
        break;
      }
      case 'break': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        if (e.pen) {
          this.parts.burst(x, y, 22, { color: '#f4ead2', size: 3 * u, speed: 140 * u, life: 0.8, rnd });
          this.parts.burst(x, y, 14, { color: C.ink, size: 3 * u, speed: 100 * u, g: -40, life: 0.7, rnd });
        } else {
          this.parts.burst(x, y, e.tall ? 26 : 16, { color: STONE_CHIP[sim.era], size: 3.4 * u, speed: 220 * u, angle: -Math.PI / 2, spread: Math.PI * 1.2, g: 700, life: 0.8, shape: 'square', rnd });
          this.hud.float(`+${e.stones}`, x, y - S * 0.6, '#f5c35a', 18 + Math.min(8, e.combo * 0.3), 1);
          this.hud.popStones();
        }
        this.shake.add(e.tall ? 0.16 : 0.08);
        break;
      }
      case 'kill': {
        if (e.via === 'fade') break;
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.ghosts.push({ kind: e.kind, x: e.x, y: e.y, t: 0, id: e.id });
        this.parts.burst(x, y, 16, { color: '#fff4d6', size: 2.2 * u, speed: 110 * u, g: -90, drag: 1.6, life: 0.9, rnd });
        if (e.sparks > 0 && e.via !== 'dawn' && e.via !== 'flash') this.hud.float(`+${e.sparks}`, x, y - S * 0.5, '#ffd36b', 13, 0.9);
        break;
      }
      case 'gate': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.ring(x, y, S * 0.3, S * 2.2, 'rgba(255,214,140,', 0.6, 5 * u);
        this.parts.burst(x, y, 24, { color: '#ffd36b', size: 2.6 * u, speed: 180 * u, g: 80, life: 0.9, shape: 'spark', rnd });
        this.hud.float(t('fx.gate', { n: e.plus, weapon: weaponName(e.tier) }), x, y - S * 0.6, '#fff1c4', 17, 1.4, 40);
        this.hud.popTier();
        this.flashOn(0.25);
        break;
      }
      case 'lamb':
        this.hud.float(t('fx.lamb'), this.sx(e.x, sim), this.sy(e.y) - S * 0.8, '#fff1c4', 17, 1.3);
        break;
      case 'stairs':
        if (e.n > 0) this.hud.float(t('fx.stairs', { steps: stepsText(e.n) }), this.L.runX, this.sy(sim.py + 2.2), '#f5c35a', 15, 1.4);
        if (e.answer === 'climb') this.hud.float(t('fx.short', { steps: stepsText(Math.max(1, e.need - e.n)) }), this.L.runX + S * 1.5, this.sy(sim.py + 2.8), '#ff9a5a', 14, 1.6);
        break;
      case 'step': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, 4, { color: STONE_CHIP[sim.era], size: 2.4 * u, speed: 70 * u, angle: -Math.PI / 2, spread: Math.PI, g: 500, life: 0.4, shape: 'square', rnd });
        break;
      }
      case 'climb':
        this.hud.float(t('fx.climb'), this.L.runX, this.sy(e.y + 1.6), 'rgba(255,241,196,.9)', 13, 1.2);
        break;
      case 'pit':
        this.hud.float(t('fx.pit'), this.L.runX, this.sy(sim.floorY + 1.6), '#fff1c4', 15, 1.2);
        this.wow = 0.8;
        break;
      case 'harm': {
        const x = this.sx(e.x, sim), y = this.sy(e.y);
        this.parts.burst(x, y, 10, { color: '#ffb070', size: 2.4 * u, speed: 120 * u, life: 0.5, rnd });
        this.shake.add(0.3);
        this.hud.hurt();
        this.flashOn(0.18, 'rgba(255,120,80,');
        break;
      }
      case 'caught':
        this.flashOn(0.55, 'rgba(255,200,120,');
        this.ring(this.L.runX, this.sy(e.y + 0.6), S * 0.4, S * 4, 'rgba(255,214,140,', 0.6, 6 * u);
        this.hud.card('toast', t('fx.caught'), t('fx.caughtSub', { stones: stonesText(e.spilled) }), 2.2);
        this.shake.add(0.4);
        break;
      case 'pull':
        this.hud.float(t('fx.pull'), this.L.runX, this.sy(sim.py + 1.7), '#9fe8ee', 14, 1);
        break;
      case 'dodge':
        if (e.near) this.hud.float(t('fx.near'), this.L.runX, this.sy(e.y + 2), '#fff1c4', 14, 0.9);
        break;
      case 'throw':
        this.parts.burst(this.sx(e.x, sim), this.sy(e.y), 6, { color: '#c9895a', size: 2 * u, speed: 80 * u, life: 0.4, rnd });
        break;
      case 'shotBreak':
        if (e.via !== 'past') this.parts.burst(this.sx(e.x, sim), this.sy(e.y), 8, { color: '#c9895a', size: 2.2 * u, speed: 120 * u, life: 0.5, shape: 'square', rnd });
        break;
      case 'combo':
        this.hud.float(t('fx.combo', { n: e.mult }), this.L.runX + S, this.sy(sim.py + 2.5), '#ffd36b', 22, 1.4, 44);
        this.ring(this.L.runX, this.sy(sim.py + 0.6), S * 0.4, S * 3, 'rgba(255,214,140,', 0.5, 4 * u);
        break;
      case 'dawn':
        this.flashOn(0.85);
        this.ring(this.lampAt(sim).x, this.lampAt(sim).y, S * 0.5, Math.max(this.w, this.h), 'rgba(255,246,220,', 1.1, 10 * u);
        this.hud.card('toast', t('fx.dawn'), t('fx.dawnSub'), 2.4);
        this.shake.add(0.35);
        this.wow = 1.6;
        break;
      case 'flash':
        this.flashOn(0.35 + 0.5 * e.share, 'rgba(220,214,255,');
        this.ring(this.lampAt(sim).x, this.lampAt(sim).y, S * 0.5, e.r * S, 'rgba(220,214,255,', 1, 6 * u);
        this.hud.card('toast', t('fx.flash'), t('hl.blind', { n: Math.round(e.share * 100) }), 2.4);
        break;
      case 'fall':
        this.hud.card('toast', t('fx.fall'), t('fx.fallSub', { ref: passage('mic7.8').ref }), 2.4);
        this.shake.add(0.3);
        break;
      case 'rise':
        this.ring(this.L.runX, this.sy(e.y + 0.5), S * 0.3, S * 3, 'rgba(255,214,140,', 0.8, 4 * u);
        break;
      case 'brook':
        this.hud.float(t('fx.brook'), this.L.runX + S * 0.4, this.sy(sim.py + 1.6), '#bfe6ff', 13, 1.1);
        this.hud.popStones();
        this.parts.burst(this.L.runX + S * 1.4, this.L.floorLine + S * 0.5, 6, { color: '#cfe6ff', size: 2 * u, speed: 90 * u, angle: -Math.PI / 2, spread: 0.9, g: 300, life: 0.6, rnd });
        break;
      case 'restPass':
        this.hud.card('toast', t('card.restPass', { stones: stonesText(e.stones) }), '', 2.4);
        break;
      case 'pushPass':
        this.hud.card('toast', t('card.pushPass', { sparks: sparksText(e.sparks) }), '', 2.2);
        break;
      case 'dayGift':
        this.hud.card('toast', t('card.dayGift', { sparks: sparksText(e.n) }), '', 2.6);
        break;
      case 'look':
        this.hud.card('toast', t('card.look', { name: t(`look.${Math.max(0, Math.min(3, e.look))}` as 'look.0') }), '', 3);
        break;
      case 'guard': {
        const name = guardName(e.id);
        if (e.what === 'come') this.hud.card('toast', t('gd.come', { name }), '', 2.4);
        else if (e.what === 'angry') this.hud.card('toast', t('gd.angry', { name }), '', 1.8);
        else if (e.what === 'leave') this.hud.card('toast', t('gd.leave', { name }), '', 2.4);
        else if (e.what === 'open') this.hud.float(t('gd.open'), this.w / 2, this.sy(sim.floorY + 3.6), '#ffd36b', 18, 1.2);
        else if (e.what === 'beaten') {
          this.flashOn(0.9);
          this.ring(this.sx(sim.px + 6, sim), this.sy(sim.floorY + 1.5), S, Math.max(this.w, this.h), 'rgba(255,246,220,', 1.2, 10 * u);
          this.hud.card('toast', t('gd.beaten', { name }), '', 3);
          this.shake.add(0.5);
          this.wow = 2;
        }
        break;
      }
      case 'guardHit':
        if (e.via === 'stomp') {
          this.shake.add(0.3);
          this.flashOn(0.2);
        }
        break;
      case 'level': {
        const lines: [string, boolean][] = [
          [t('level.star.top'), true],
          [t('level.star.lambs', { a: e.lambs, b: e.pens }), e.lambs >= e.pens],
          [t('level.star.tide'), !e.caught],
        ];
        this.hud.card('level', t('level.done', { n: e.level }), `+${sparksText(e.sparks)}`, RULES.cardSec, { stars: e.stars, lines });
        this.ring(this.L.runX, this.sy(sim.py + 1), S * 0.5, S * 5, 'rgba(255,214,140,', 0.9, 6 * u);
        break;
      }
      case 'era':
        this.setScene(e.era, false);
        this.hud.card('level', eraName(e.era), t(`era.${e.era}.text`), 3.2, e.lap > 0 ? { lines: [[t('era.lap', { n: e.lap + 1 }), false]] } : {});
        break;
      case 'stage':
        if (e.stage > 1) this.hud.float(t('hud.level', { n: e.level, s: e.stage }), this.w / 2, this.sy(sim.py + 3.2), '#fff1c4', 15, 1.6, 20);
        break;
      case 'post':
        if (e.lit === 'gold') this.parts.burst(this.sx(e.x + 0.3, sim), this.sy(e.y + 1.7), 6, { color: '#ffd36b', size: 1.8 * u, speed: 50 * u, g: -30, life: 0.8, rnd });
        break;
      case 'finale':
        this.hud.card('finale', t('finale.title'), t('finale.sub', { metres: t('metres', { n: sim.score }) }), 6);
        break;
      default:
        break;
    }
  }

  private ring(x: number, y: number, r0: number, r1: number, color: string, dur: number, width: number): void {
    if (this.opts.reducedMotion && r1 > this.S * 6) r1 = this.S * 6;
    this.rings.push({ x, y, t: 0, dur, r0, r1, color, width });
  }

  private setScene(era: EraId, now: boolean): void {
    this.palFrom = now ? PAL[era] : this.currentPal();
    this.palTo = PAL[era];
    this.palK = now ? 1 : 0;
    this.scene = era;
  }

  private currentPal(): Palette { return mixPal(this.palFrom, this.palTo, ease.inOutSine(this.palK)); }

  private flashOn(a: number, color = 'rgba(255,236,190,'): void {
    const k = this.opts.reducedMotion ? 0.5 : 1;
    this.flash = Math.max(this.flash, a * k);
    this.flashColor = color;
  }

  // ── a frame ─────────────────────────────────────────────────────
  update(dt: number, sim: DolinaSim): void {
    this.clock += dt;
    this.parts.update(dt);
    let n = 0;
    for (const r of this.rings) if ((r.t += dt) < r.dur) this.rings[n++] = r;
    this.rings.length = n;
    n = 0;
    for (const g of this.ghosts) if ((g.t += dt) < 0.45) this.ghosts[n++] = g;
    this.ghosts.length = n;
    this.runPh += dt * (sim.speed * 2.1) * (sim.timeScale || 0);
    this.fallK = approach(this.fallK, sim.state === 'fallen' && sim.stateT < RULES.fallSec - 0.4 ? 1 : 0, dt, 0.12);
    if (this.fallK < 0.01) this.fallK = 0;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.wow = Math.max(0, this.wow - dt);
    this.palK = Math.min(1, this.palK + dt / 2);
    this.meadow = approach(this.meadow, sim.restBlock && sim.px >= sim.meadowFrom - 2 ? 1 : 0, dt, 0.9);
    this.dawnK = approach(this.dawnK, sim.phase !== 'play' ? 1 : 0, dt, 1.4);
    this.lampShown = approach(this.lampShown, sim.lampR, dt, 0.08);
    // the camera follows his floor, and him when he climbs high
    const S = this.S;
    let want = sim.state === 'pit' ? sim.floorY : sim.floorY;
    if (sim.py - want > 3.4) want = sim.py - 3.4;
    this.camY = approach(this.camY, want, dt, 0.32);
    // Ćma flutters by the lamp; on a double jump she holds his hood and flaps; in a pit she lifts him
    const l = this.lampAt(sim);
    const hood = sim.flapAge < 0.4 || sim.state === 'pit';
    const head = { x: this.L.runX - S * 0.05, y: this.sy(sim.py + 1.35) };
    const tx = hood ? head.x : l.x + S * (0.55 + 0.35 * Math.sin(this.clock * 1.7));
    const ty = hood ? head.y : l.y - S * (0.75 + 0.25 * Math.cos(this.clock * 2.3)) + (this.meadow > 0.5 ? S * 0.2 : 0);
    const k = hood ? 40 : this.opts.reducedMotion ? 4 : 9;
    this.moth.vx += ((tx - this.moth.x) * k - this.moth.vx * (hood ? 9 : 3.2)) * dt;
    this.moth.vy += ((ty - this.moth.y) * k - this.moth.vy * (hood ? 9 : 3.2)) * dt;
    this.moth.x += this.moth.vx * dt;
    this.moth.y += this.moth.vy * dt;
    if (Math.abs(this.moth.vx) > 20) this.mothFace = this.moth.vx > 0 ? 1 : -1;
    // her line
    const line = sim.talk.current;
    if (line && !this.hud.busy) this.bubbleText = line.text;
    this.bubbleA = approach(this.bubbleA, line && !this.hud.busy && line.t < line.dur - 0.15 ? 1 : 0, dt, 0.07);
    // meadow fireflies, dawn motes
    if (this.meadow > 0.5 && this.rnd() < dt * 3) {
      this.parts.burst(this.rnd() * this.w, this.L.floorLine - this.rnd() * S * 2.5, 1, { color: '#e8f5a0', size: 1.6 * this.L.u, speed: 12, g: -6, drag: 0.5, life: 2.2, rnd: this.rnd });
    }
    this.hud.update(dt, sim.stones, sim.oil);
  }

  draw(sim: DolinaSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const pal = mixPal(mixPal(this.currentPal(), PAL.meadow, this.meadow), PAL.dawn, this.dawnK);
    const farScene: Scene = this.dawnK > 0.6 ? 'dawn' : this.meadow > 0.5 ? 'meadow' : this.scene;
    // the sky and the far valley stay still under the shake; the climb shakes
    const horizon = L.floorLine + Math.min(S * 2, this.camY * S * 0.15);
    paintSky(ctx, this.w, this.h, horizon, pal, this.clock, this.meadow * (1 - this.dawnK), this.dawnK);
    const px = sim.px * S;
    paintFar(ctx, farScene, this.w, horizon - S * 0.1, S * 0.8, px * 0.15, this.clock, pal, 1);
    paintMid(ctx, farScene, this.w, horizon + S * 0.2, S, px * 0.5, this.clock, pal, 0.75);
    ctx.save();
    const off = this.shake.offset(1 / 60, 8);
    ctx.translate(off.x, off.y);
    this.drawGround(sim, pal);
    this.drawPosts(sim);
    if (Number.isFinite(sim.exitX)) {
      const ex = this.sx(sim.exitX + 0.6, sim);
      if (ex > -S * 3 && ex < this.w + S * 3) paintExit(ctx, ex, this.sy(sim.exitY), S, this.clock);
    }
    this.drawGates(sim, false);
    this.drawBlocks(sim);
    this.drawLambs(sim);
    this.drawShadows(sim);
    this.drawShots(sim);
    this.drawGuard(sim);
    // the dark beyond the lamp's reach, then what always shows through it
    this.drawFog(sim, pal);
    this.drawThroughFog(sim);
    this.drawGates(sim, true);
    this.drawTide(sim);
    this.drawGauge(sim);
    this.drawGuardSigns(sim);
    // the pilgrim and Ćma
    const strikeK = sim.strikeAge < 0.16 ? sim.strikeAge / 0.16 : -1;
    const lifted = sim.state === 'pit' ? clamp(sim.stateT / RULES.pitSec) : 0;
    const drawY = sim.state === 'pit' ? this.sy(Math.max(sim.py, sim.floorY - 1.5)) - lifted * S * 0.2 : this.sy(sim.py);
    const lamp = paintPilgrim(ctx, L.runX, drawY, S, {
      look: sim.look, run: this.runPh, pace: clamp(sim.speed / RULES.run), air: !sim.grounded && sim.state === 'run', slide: 0,
      fall: this.fallK, slash: strikeK, lampUp: sim.live && sim.level01 > 0.5 ? 0.6 : sim.state === 'climb' ? 0.8 : 0,
      flicker: sim.oil < 0.3 ? 1 - sim.oil / 0.3 : 0,
    });
    this.drawDawnRing(sim, lamp);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    this.parts.draw(ctx);
    ctx.restore();
    for (const r of this.rings) {
      const k = r.t / r.dur;
      ctx.strokeStyle = `${r.color}${(1 - k) * 0.9})`;
      ctx.lineWidth = r.width * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease.outCubic(k), 0, TAU);
      ctx.stroke();
    }
    const hood = sim.flapAge < 0.4 || sim.state === 'pit';
    const mood = this.wow > 0 || hood ? 'wow' : this.meadow > 0.7 && sim.calm > 0.6 ? 'sleep' : sim.live && sim.level01 < 0.35 ? 'sulk' : 'happy';
    paintMoth(ctx, this.moth.x, this.moth.y, S * 0.3, this.clock * (hood ? 2.2 : 1), mood, this.mothFace);
    ctx.restore();
    // the light of a Świt, a lifted mist, a hit
    if (this.flash > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${this.flashColor}${0.5 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    }
    this.hud.drawPack(sim.tier, sim.oil, sim.combo, sim.mult);
    this.hud.drawFloats();
    this.hud.drawBubble(this.bubbleText, this.bubbleA, this.moth.x, this.moth.y - S * 0.15);
    this.hud.drawCards();
    void u;
  }

  // ── the ground and what stands on it ───────────────────────────
  private drawGround(sim: DolinaSim, pal: Palette): void {
    const ctx = this.ctx, S = this.S;
    const segs = sim.segs;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const x0 = this.sx(s.x0, sim), x1 = this.sx(s.x1, sim);
      if (x1 < -20 || x0 > this.w + 20) continue;
      const top = this.sy(s.y);
      paintGround(ctx, Math.max(-20, x0), Math.min(this.w + 20, x1), top, this.h + 20, S, pal, s.kind, this.sx(0, sim));
      // pits are always outlined: a rim where a floor stops with nothing beside it
      const next = segs[i + 1];
      if (next && next.x0 - s.x1 > 0.3) {
        paintRim(ctx, x1, top, S, 1);
        paintRim(ctx, this.sx(next.x0, sim), this.sy(next.y), S, -1);
      }
      if (s.kind === 'meadow' && this.meadow > 0.05) this.drawWater(Math.max(0, x0), Math.min(this.w, x1), top);
    }
    // the stair's steps
    for (const st of sim.steps) {
      const x0 = this.sx(st.x0, sim), x1 = this.sx(st.x1, sim);
      if (x1 < -10 || x0 > this.w + 10) continue;
      paintStep(ctx, x0, x1, this.sy(st.top), this.sy(st.y0), S, this.scene, st.age);
    }
  }

  /** Still water below the meadow's path, with the sky in it. */
  private drawWater(x0: number, x1: number, top: number): void {
    const ctx = this.ctx, S = this.S;
    const wy = top + S * 0.55;
    ctx.globalAlpha = this.meadow;
    const g = ctx.createLinearGradient(0, wy, 0, this.h);
    g.addColorStop(0, '#3b5f7e');
    g.addColorStop(1, '#22384f');
    ctx.fillStyle = g;
    ctx.fillRect(x0, wy, x1 - x0, this.h - wy);
    ctx.strokeStyle = 'rgba(220,235,255,.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = wy + 6 + i * 7;
      if (y > this.h) break;
      const x = x0 + ((i * 97 + this.clock * 12) % Math.max(1, x1 - x0 + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + S * 0.9, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawPosts(sim: DolinaSim): void {
    for (const p of sim.posts) {
      const x = this.sx(p.x, sim);
      if (x > -30 && x < this.w + 30) paintPost(this.ctx, x, this.sy(p.y), this.S, p.lit, this.clock);
    }
  }

  /** The gates: their arches under the fog, their light over it (a gate always shows where it hangs). */
  private drawGates(sim: DolinaSim, over: boolean): void {
    for (const g of sim.gates) {
      const x = this.sx(g.x, sim);
      if (x < -60 || x > this.w + 60) continue;
      if (over && Math.abs(g.x - sim.px) <= this.lampShown) continue;
      if (!over && Math.abs(g.x - sim.px) > this.lampShown + 1) continue;
      paintGate(this.ctx, x, this.sy(g.y), this.S, g.high, g.plus, g.taken, this.clock, `+${g.plus}`);
    }
  }

  private drawBlocks(sim: DolinaSim): void {
    const S = this.S;
    for (const st of sim.stonesOnRoad) {
      if (!st.alive) continue;
      const x = this.sx(st.x, sim);
      if (x > this.w + 40 || x + st.w * S < -40) continue;
      if (st.pen) paintPen(this.ctx, x, this.sy(st.y), st.w * S, st.h * S, S, { hp: st.hp, lit: st.lit, hit: st.hitT / 0.12, t: this.clock, id: st.id });
      else paintBlock(this.ctx, x, this.sy(st.y), st.w * S, st.h * S, S, { era: this.scene, hp: st.hp, max: st.max, tall: st.tall, lit: st.lit, hit: st.hitT / 0.12, t: this.clock, id: st.id });
    }
  }

  private drawLambs(sim: DolinaSim): void {
    for (const l of sim.lambs) {
      const x = this.sx(l.x, sim);
      if (x < -30 || x > this.w + 30) continue;
      paintLamb(this.ctx, x, this.sy(l.y), this.S * 0.85, this.clock, l.hop);
    }
  }

  private drawShadows(sim: DolinaSim): void {
    const ctx = this.ctx, S = this.S;
    for (const s of sim.shadows) {
      if (s.state !== 'walk') continue;
      const x = this.sx(s.x, sim);
      if (x < -40 || x > this.w + 40) continue;
      const bob = s.kind === 'pling' ? Math.sin(this.clock * 3 + s.bob) * 0.08 : 0;
      const yBase = s.kind === 'pling' ? this.sy(s.y + s.h + bob) : s.kind === 'kruk' ? this.sy(s.y + 0.4) : this.sy(s.y);
      paintShadow(ctx, x, yBase, S, {
        kind: s.kind, t: this.clock, id: s.id, hit: s.hitT, stun: s.stun, inLight: s.inLight, shield: s.kind === 'giermek' && s.hp > s.max * 0.5, crack: s.burn / Math.max(1, s.max),
        dive: s.kind === 'kruk' ? 0.5 : 0, fade: 0, pop: 1,
      });
    }
    for (const g of this.ghosts) {
      const x = this.sx(g.x, sim);
      paintShadow(ctx, x, this.sy(g.y) + S * 0.45, S, {
        kind: g.kind, t: this.clock, id: g.id, hit: 0.1, stun: 0, inLight: true, shield: false, crack: 0, dive: 0, fade: clamp(g.t / 0.45), pop: 1,
      });
    }
  }

  private drawShots(sim: DolinaSim): void {
    const S = this.S;
    for (const s of sim.shots) {
      if (!s.alive) continue;
      const x = this.sx(s.x, sim);
      if (x < -60 || x > this.w + 60) continue;
      if (!s.guard) paintRollBrick(this.ctx, x + s.w * S / 2, this.sy((s.y0 + s.y1) / 2), (s.y1 - s.y0) * S * 0.5, s.t);
      else paintThrow(this.ctx, s.kind, this.scene, x, this.sy(s.y1), this.sy(s.y0), s.w * S, S, s.t);
    }
  }

  private drawGuard(sim: DolinaSim): void {
    const g = sim.guard, a = sim.arena;
    if (!g || !a) return;
    const S = this.S;
    const x = this.sx(sim.px + g.rel, sim);
    const mv = sim.move;
    const spec = mv ? RULES.moves[mv] : null;
    const teleK = mv && spec && spec.tele > 0 && !g.acted ? clamp(g.moveT / spec.tele) : 0;
    paintGuard(this.ctx, x, this.sy(a.y), S, {
      id: g.id, t: this.clock, open: sim.guardOpen, tele: g.acted ? null : mv, teleK, hit: g.hitT > 0.08 ? g.hitT : 0, angry: g.angry,
      fade: g.state === 'beaten' ? clamp(g.st / 1.2) : g.state === 'leave' ? clamp(g.st / 1.2) : 0,
    });
  }

  /** Over the fog: the guardian's light bar, its weak point when open, the sign for the hands. */
  private drawGuardSigns(sim: DolinaSim): void {
    const g = sim.guard, a = sim.arena;
    if (!g || !a || g.state === 'beaten' || g.state === 'leave') return;
    const ctx = this.ctx, S = this.S, u = this.L.u;
    const x = this.sx(sim.px + g.rel, sim);
    // the light bar over it
    const bw = S * 2.4, bh = 7 * u, by = Math.max(this.L.top + 22 * u, this.sy(a.y + 3.9));
    const bx = x + S * 1.1 - bw / 2;
    ctx.fillStyle = 'rgba(20,15,26,.85)';
    ctx.beginPath();
    ctx.roundRect(bx - 3, by - 3, bw + 6, bh + 6, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath();
    ctx.roundRect(bx, by, Math.max(bh, bw * (g.hp / g.max)), bh, bh / 2);
    ctx.fill();
    ctx.font = font(800, 11 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#fff1c4';
    ctx.fillText(guardName(g.id), bx + bw / 2, by - 5);
    // the weak point, bowed over him while open
    if (sim.guardOpen) {
      const wx = this.sx(sim.px + g.rel + 0.35, sim), wy = this.sy(a.y + RULES.weakY + 0.25);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, wx, wy, S * 0.9, 'rgba(255,211,107,', 0.55 + 0.25 * Math.sin(this.clock * 10));
      ctx.restore();
      ctx.strokeStyle = '#ffd36b';
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(wx, wy, S * 0.35 + Math.sin(this.clock * 8) * 2, 0, TAU);
      ctx.stroke();
    }
    // the sign for the hands over the incoming throw
    const ans = sim.answer;
    if (ans && g.state === 'fight') {
      const text = t(`ans.${ans}`);
      ctx.font = font(800, 15 * u, SANS);
      const tw = ctx.measureText(text).width + 22 * u, th = 26 * u;
      const sx = Math.min(this.w - tw / 2 - 8, Math.max(tw / 2 + 8, this.L.runX + S * 2.4)), sy = Math.max(this.L.top + 14 * u, this.sy(a.y + 3.1));
      ctx.fillStyle = ans === 'open' ? 'rgba(245,195,90,.95)' : ans === 'stay' ? 'rgba(127,176,200,.95)' : 'rgba(246,238,220,.95)';
      ctx.beginPath();
      ctx.roundRect(sx - tw / 2, sy - th / 2, tw, th, th / 2);
      ctx.fill();
      ctx.fillStyle = C.text;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, sx, sy + 1);
    }
  }

  /** The dark beyond the lamp: a fog with a hole of light around the lamp (lighter in the meadow, gone at dawn). */
  private drawFog(sim: DolinaSim, pal: Palette): void {
    const ctx = this.ctx, S = this.S;
    const dark = 0.72 * (1 - 0.65 * this.meadow) * (1 - this.dawnK);
    if (dark < 0.02) return;
    const l = this.lampAt(sim);
    const r = Math.max(S * 0.8, this.lampShown * S);
    const f = pal.fog;
    const g = ctx.createRadialGradient(l.x, l.y, r * 0.6, l.x, l.y, r * 1.2);
    g.addColorStop(0, `rgba(${f[0]},${f[1]},${f[2]},0)`);
    g.addColorStop(0.7, `rgba(${f[0]},${f[1]},${f[2]},${dark * 0.5})`);
    g.addColorStop(1, `rgba(${f[0]},${f[1]},${f[2]},${dark})`);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, l.x, l.y, r * 1.05, 'rgba(255,190,110,', 0.14 + 0.12 * (sim.live ? above(sim.level01) : 0));
    ctx.restore();
  }

  /** What shows through the fog: the shadows' ember eyes, the blocks' outlines, the way out's glow. */
  private drawThroughFog(sim: DolinaSim): void {
    const ctx = this.ctx, S = this.S;
    for (const s of sim.shadows) {
      if (s.state !== 'walk' || Math.abs(s.x - sim.px) <= this.lampShown) continue;
      const x = this.sx(s.x, sim);
      if (x < -20 || x > this.w + 20) continue;
      const y = s.kind === 'pling' ? this.sy(s.y + s.h * 0.6) : this.sy(s.y + s.h * 0.68);
      paintEyes(ctx, x - S * 0.1, y, S * 0.05, this.clock, s.id, s.stun);
    }
    ctx.strokeStyle = 'rgba(255,226,170,.18)';
    ctx.lineWidth = 1;
    for (const st of sim.stonesOnRoad) {
      if (!st.alive || st.x - sim.px <= this.lampShown) continue;
      const x = this.sx(st.x, sim);
      if (x > this.w + 20) continue;
      ctx.strokeRect(x + 0.5, this.sy(st.y + st.h) + 0.5, st.w * S - 1, st.h * S - 1);
    }
  }

  /** The tide of the dark creeping from the left, and an arrow of smoke when it is off the screen. */
  private drawTide(sim: DolinaSim): void {
    if (!sim.tideOn || !Number.isFinite(sim.tideX)) return;
    const front = this.sx(sim.tideX, sim);
    const near = clamp(1 - (sim.px - sim.tideX) / RULES.tideMax);
    const top = Math.max(this.L.top - 10, this.sy(sim.floorY + 6));
    if (front > -this.S * 0.5) paintTide(this.ctx, front, top, this.h, this.S, this.clock, near);
    else {
      // off the screen: a smoky edge that thickens as it comes
      const g = this.ctx.createLinearGradient(0, 0, this.S * (0.6 + near * 1.6), 0);
      g.addColorStop(0, `rgba(10,7,14,${0.35 + 0.5 * near})`);
      g.addColorStop(1, 'rgba(10,7,14,0)');
      this.ctx.fillStyle = g;
      this.ctx.fillRect(0, top, this.S * 2.4, this.h - top);
    }
  }

  /** The live gauge: the light's rim (gold beyond the threshold) and the dotted threshold ring on the light itself. */
  private drawGauge(sim: DolinaSim): void {
    const look = sim.lampLook;
    if (look === 'flame' || look === 'blind') return;
    const ctx = this.ctx, L = this.L, S = this.S, u = L.u;
    const l = this.lampAt(sim);
    const R = this.lampShown * S, mark = (LAMP_MARK + sim.ups.lamp * RULES.lampStep) * S;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.top, this.w, L.floorLine + S * 0.6 - L.top);
    ctx.clip();
    ctx.setLineDash([3 * u, 6 * u]);
    ctx.strokeStyle = look === 'live' ? 'rgba(255,246,220,.75)' : 'rgba(255,246,220,.35)';
    ctx.lineWidth = 1.8 * u;
    ctx.beginPath();
    ctx.arc(l.x, l.y, mark, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    const over = look === 'live' && sim.level01 >= 0.5;
    ctx.strokeStyle = look === 'grey' ? 'rgba(180,176,190,.6)' : look === 'wait' ? 'rgba(255,236,190,.45)' : over ? '#ffd36b' : 'rgba(255,236,190,.8)';
    ctx.lineWidth = (over ? 3.5 : 2) * u;
    if (over) {
      ctx.shadowColor = 'rgba(255,200,90,.8)';
      ctx.shadowBlur = 12 * u;
    }
    ctx.beginPath();
    ctx.arc(l.x, l.y, R, 0, TAU);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // the threshold's name on its ring, up and ahead
    const ang = -Math.PI / 5;
    const mx = l.x + Math.cos(ang) * mark, my = l.y + Math.sin(ang) * mark;
    ctx.font = font(800, 10 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,14,26,.8)';
    ctx.strokeText(t('hud.mark'), mx, my);
    ctx.fillStyle = 'rgba(255,246,220,.9)';
    ctx.fillText(t('hud.mark'), mx, my);
    ctx.restore();
  }

  /** The Świt's charge as a ring around the lamp. */
  private drawDawnRing(sim: DolinaSim, lamp: { x: number; y: number }): void {
    if (sim.dawnCharge < 0.02) return;
    const ctx = this.ctx, S = this.S;
    const r = S * 0.36;
    ctx.strokeStyle = 'rgba(255,240,200,.25)';
    ctx.lineWidth = S * 0.06;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, r, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = sim.dawnCharge > 0.95 ? '#fff4c0' : '#ffd36b';
    ctx.lineWidth = S * 0.09;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * sim.dawnCharge);
    ctx.stroke();
    if (sim.dawnCharge > 0.6) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lamp.x, lamp.y, r * 2.6, 'rgba(255,214,120,', 0.3 * sim.dawnCharge);
      ctx.restore();
    }
  }

  /** A world point on screen (CSS px), for the coach marks. */
  toScreen(x: number, y: number, sim: DolinaSim): { x: number; y: number } {
    return { x: clamp(this.sx(x, sim), 20, this.w - 20), y: clamp(this.sy(y), this.L.top + 20, this.h - 20) };
  }
}
