/**
 * Dawid's play view: the map of the land around David (the camera follows him) or the cave of Adullam,
 * the band's history as footprints in the grass (gold where the signal was above the threshold), the
 * camp with its fire and buildings, the dens, the brook, the gate and the lair, the guardian's attacks
 * telegraphed in red on the ground, and — the band, drawn large — the sling's ring around David's feet: a
 * dial that fills with the whirl, the threshold a notch at its top, gold past it, the stone whirling round
 * it faster with focus, the multiplier beside it.  Then the figures (trees, beasts, David, the lamb, the
 * party, the people, the guardian), stones in flight, dust, rings, the harp's notes; the night of a blind
 * push and the dusk of the harp; and the game's own bits (hud.ts).  Juice: hit-stop (from the sim),
 * particles, flying numbers, shakes (none with reduced motion), flashes.  Under a finger: the floating
 * joystick (its base where the finger went down, its knob under it), a ring where a tap sent David, and his
 * goal marked on the ground while he walks there.  With the camp's sheet open David stands in the middle of
 * the field it leaves.
 */
import { fmtNum } from '../../i18n';
import { Floaters, Particles, Shake, approach, clamp, ease, lerp } from '../kit/juice';
import { NO_INSETS } from '../kit/mobile';
import type { Insets, TapTarget } from '../kit/types';
import { companionName, guardName, kitName, weaponName, type BuildingId, type CompanionId, type Spot } from './content';
import { Hud } from './hud';
import { t, xpText } from './i18n';
import { DawidIntro } from './intro';
import { layout, type Layout } from './layout';
import { buildingLevel, tierOf, type DawidProgress } from './meta';
import {
  C, LOOKS, SANS, decorate, ellipse, font, glow, hash, paintBeast, paintBearer, paintBuilding, paintCave, paintChest, paintCoin, paintDeco,
  paintDen, paintFire, paintGate, paintGiant, paintGround, paintHeap, paintLair, paintLamb, paintPerson, paintTent, paintThief,
  type Deco, type Look, type PersonPose,
} from './paint';
import { RULES } from './rules';
import type { DawidSim, SimEvent } from './sim';

const TAU = Math.PI * 2;

interface Banner { text: string; color: string; t: number; dur: number; big: boolean }

/** where the camp's buildings stand around the fire (u) */
export const PLOTS: Readonly<Record<BuildingId, readonly [number, number]>> = {
  ognisko: [0, 0], kuznia: [-2.3, -1.3], spichlerz: [2.3, -1.4], studnia: [-2.5, 1.4], owczarnia: [2.6, 1.5], jaskinia: [0.2, -2.7],
};
const PEOPLE: Partial<Record<Spot, keyof typeof LOOKS>> = {
  jesse: 'jesse', asahel: 'asahel', sluga: 'sluga', abiszaj: 'abiszaj', eliab: 'eliab', saul: 'saul', jonatan: 'jonatan',
  abigail: 'abigail', benajasz: 'benajasz', itaj: 'itaj', szamma: 'szamma',
};

/** A ring on the ground where a tap sent David ('go'), around him when he went hunting ('hunt'). */
interface Mark { x: number; y: number; t: number; kind: 'go' | 'hunt' }

/** The floating joystick (CSS px): where the finger went down, where it is, whether it steers yet. */
export interface Stick { ox: number; oy: number; x: number; y: number; on: boolean }

export class DawidView {
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ins: Insets = NO_INSETS;
  L: Layout = layout(800, 600, { top: 64, right: 0, bottom: 0, left: 0 });
  readonly hud = new Hud();
  /** the primary input is a finger: the cards say "tap", not "click" */
  touch = false;
  private readonly fx = new Particles(640);
  private readonly floaters = new Floaters();
  private readonly shake: Shake;
  private readonly introScene = new DawidIntro();
  private clock = 0;
  private camX = 0;
  private camY = 0;
  private flash = 0;
  private hurtFlash = 0;
  private levelPop = 0;
  private bagPop = 0;
  private questPop = 0;
  private campK = 0;
  private banner: Banner | null = null;
  private levelUp: { level: number; gain: string; t: number } | null = null;
  private restTint = 0;
  private night = 0;
  private stepPhase = 0;
  private lambStep = 0;
  private fallT = -1;
  private started = false;
  private decos: Deco[] = [];
  private decoLand = '';
  /** where David stands on the screen now (the field's middle; the room above or beside the camp's sheet) */
  private ax = 400;
  private ay = 300;
  /** the joystick while a finger is down on the field; it fades out after the finger lifts */
  stick: Stick | null = null;
  private stickLast: Stick | null = null;
  private stickK = 0;
  private marks: Mark[] = [];
  /** the tile a tap just bought (its gold bursts from there) */
  boughtTile = -1;

  constructor(canvas: HTMLCanvasElement, opts: { reducedMotion: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
  }

  resize(w: number, h: number, dpr: number, ins: Insets): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.ins = ins;
    this.L = layout(w, h, ins);
    this.anchor();
  }

  /** The runner's insets changed (the HUD band settled): lay out again. */
  setInsets(ins: Insets): void {
    const o = this.ins;
    if (Math.abs(o.top - ins.top) < 0.5 && Math.abs(o.bottom - ins.bottom) < 0.5 && Math.abs(o.left - ins.left) < 0.5 && Math.abs(o.right - ins.right) < 0.5) return;
    this.ins = ins;
    this.L = layout(this.w, this.h, ins);
    this.anchor();
  }

  /** The camp's sheet slid in this far (0..1); 0 while David sits by the fire or a story card shows. */
  get campOpen(): number { return this.campEff; }
  private campEff = 0;

  private anchor(): void {
    const e = ease.inOutSine(clamp(this.campK));
    this.ax = lerp(this.L.kx, this.L.campKx, e);
    this.ay = lerp(this.L.ky, this.L.campKy, e);
  }

  /** World (u) → canvas (CSS px). */
  toScreen(x: number, y: number): { x: number; y: number } {
    return { x: this.ax + (x - this.camX) * this.L.s, y: this.ay + (y - this.camY) * this.L.s };
  }

  /** Canvas (CSS px) → world (u). */
  toWorld(x: number, y: number): { x: number; y: number } {
    return { x: this.camX + (x - this.ax) / this.L.s, y: this.camY + (y - this.ay) / this.L.s };
  }

  /** A ring where a tap sent David: at the spot he walks to, or round him when he goes hunting (world u). */
  mark(kind: Mark['kind'], x: number, y: number): void {
    this.marks.push({ x, y, t: 0, kind });
    if (this.marks.length > 6) this.marks.shift();
  }

  /** A short word over the great stone's button ("Kamień: 43%", nothing in sight). */
  note(text: string): void {
    const st = this.L.stone, u = this.L.u;
    this.floaters.add(text, clamp(st.x, this.L.left + 90 * u, this.L.right - 90 * u), st.y - st.r - 20 * u, { color: '#fff3d6', size: 14 * u, dur: 0.9 });
  }

  /** The finger lifted: the joystick fades out where it was. */
  dropStick(): void {
    if (this.stick) this.stickLast = this.stick;
    this.stick = null;
  }

  /**
   * The controls the player can tap now (hud.ts), for the mobile audit and the tests: the sheet's once it is
   * all the way up, the two buttons while it is down, none while it slides.
   */
  targets(sim: DawidSim): TapTarget[] {
    const k = this.campEff;
    return this.hud.targets(this.L, sim, k >= 0.98 ? 'sheet' : k < 0.5 ? 'buttons' : 'none');
  }

  /** The camp's sheet is up (its controls take taps; the bag and the stone are under it). */
  sheetOpen(sim: DawidSim): boolean {
    return sim.inCamp && !sim.story && !sim.sitting && this.campEff > 0.5;
  }

  intro(dt: number, p: number, progress: DawidProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, progress);
  }

  start(sim: DawidSim): void {
    this.started = true;
    this.camX = sim.david.x;
    this.camY = sim.david.y;
    this.anchor();
  }

  private say(text: string, color = '#fff3d6', dur = 1.8, big = false): void {
    this.banner = { text, color, t: 0, dur, big };
  }

  on(e: SimEvent, sim: DawidSim): void {
    const fx = this.fx;
    const P = (x: number, y: number) => this.toScreen(x, y);
    const u = this.L.u, s = this.L.s;
    switch (e.type) {
      case 'throw': {
        if (e.kind === 'great') {
          this.flash = Math.max(this.flash, 0.25);
          const p = P(e.x, e.y);
          fx.burst(p.x, p.y - s * 0.8, 18, { color: C.goldLight, size: 3, speed: 220, life: 0.5, g: 0, shape: 'spark' });
        } else if (e.gold) {
          const p = P(e.x, e.y);
          fx.burst(p.x, p.y - s * 0.8, 3, { color: C.goldLight, size: 2, speed: 90, life: 0.3, g: 0, shape: 'spark' });
        }
        break;
      }
      case 'hit': {
        const p = P(e.x, e.y);
        const big = e.crit || e.guard;
        this.floaters.add(fmtNum(Math.round(e.dmg)), p.x + (Math.random() - 0.5) * 18, p.y - s * (e.guard ? 1.8 : 0.9), {
          color: e.crit ? '#ffb070' : e.gold ? C.goldLight : '#ffffff', size: (big ? 18 : 14) * u * (e.crit ? 1.2 : 1), dur: 0.65,
        });
        fx.burst(p.x, p.y - s * 0.4, e.gold ? 5 : 3, { color: e.gold ? C.goldLight : '#fff6e0', size: 2, speed: 120, life: 0.25, g: 0, shape: 'spark' });
        break;
      }
      case 'blocked': {
        const p = P(e.x, e.y);
        this.floaters.add(t('hud.blocked'), p.x, p.y - s * 1.2, { color: '#ffe0b0', size: 16 * u, dur: 0.6 });
        fx.burst(p.x, p.y - s * 0.7, 6, { color: '#ffe0b0', size: 2, speed: 160, life: 0.3, g: 200, shape: 'spark' });
        break;
      }
      case 'driven': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.2, 9, { color: '#e8d9b8', size: 4, speed: 70, life: 0.7, g: -30, drag: 2.5, shape: 'dot' });
        this.floaters.add(Hud.xpWords(e.xp, e.mult), p.x, p.y - s * 1.1, { color: e.mult > 1 ? C.goldLight : '#f6f0ff', size: (e.mult > 1 ? 18 : 15) * u, dur: 1 });
        if (e.mult >= 3) this.shake.add(0.06);
        break;
      }
      case 'xp': {
        const p = P(e.x, e.y);
        this.floaters.add(`+${xpText(e.v)}`, p.x, p.y, { color: '#e8f0ff', size: 16 * u, dur: 1.1 });
        break;
      }
      case 'coin':
        this.bagPop = Math.min(1, this.bagPop + 0.25);
        break;
      case 'bagFull':
        this.say(t('hud.bagFull'), C.goldLight, 1.6);
        break;
      case 'deliver': {
        if (e.silver > 0) this.say(t('hud.deliver', { n: fmtNum(e.silver) }), '#e8f0ff', 1.6);
        const d = P(sim.david.x, sim.david.y);
        for (let i = 0; i < 14; i++) fx.burst(d.x, d.y - s * 0.6, 1, { color: i % 3 ? C.silver : C.goldLight, size: 3, speed: 260, life: 0.8, g: 260, shape: 'square' });
        break;
      }
      case 'level': {
        this.levelPop = 1;
        this.levelUp = { level: e.level, gain: t('hud.levelGain', { d: fmtNum(e.dmg), h: fmtNum(e.hp) }), t: 0 };
        this.flash = Math.max(this.flash, 0.25);
        fx.burst(this.ax, this.ay - s * 0.8, 36, { color: C.goldLight, size: 3.5, speed: 280, life: 1, g: 90, shape: 'square' });
        break;
      }
      case 'stoneReady': {
        // over the great stone's button, kept on the screen
        const st = this.L.stone, x = clamp(st.x, this.L.left + 80 * u, this.L.right - 80 * u);
        this.floaters.add(t('hud.stone'), x, st.y - st.r - 26 * u, { color: C.goldLight, size: 15 * u });
        break;
      }
      case 'stoneHit': {
        const p = P(e.x, e.y);
        this.flash = Math.max(this.flash, 0.55);
        this.shake.add(0.55);
        this.say(t('hud.stoneFx'), C.goldLight, 1.6, true);
        fx.burst(p.x, p.y - s * 0.3, 46, { color: C.goldLight, size: 3.5, speed: 330, life: 0.9, g: 120, shape: 'spark' });
        fx.burst(p.x, p.y, 20, { color: '#e8d9b8', size: 6, speed: 120, life: 1, g: -20, drag: 2, shape: 'dot' });
        break;
      }
      case 'sweep':
        break;
      case 'kit': {
        const p = P(e.x, e.y);
        this.floaters.add(kitName(e.id), p.x, p.y - s * 1.8, { color: '#fff1c8', size: 15 * u, dur: 1.1 });
        fx.burst(p.x, p.y - s * 0.8, 10, { color: '#ffe9b0', size: 2.5, speed: 150, life: 0.5, g: 0, shape: 'spark' });
        break;
      }
      case 'star':
        this.say(`${companionName(e.id)} ${t('stars', { n: e.stars })}`, C.goldLight, 1.8);
        break;
      case 'hurt':
        this.hurtFlash = 1;
        this.shake.add(0.14);
        break;
      case 'down':
        this.say(t('hud.down'), '#ffd7c8', 1.4);
        break;
      case 'wake':
        this.say(t('hud.wake'), '#fff3d6', 1.6);
        break;
      case 'guardWake':
        this.say(t('hud.guard', { name: guardName(e.kind, sim.circle) }), '#ffb8a0', 2);
        this.shake.add(0.35);
        break;
      case 'guardAct':
        if (e.pattern !== 'taunt' && e.pattern !== 'swipe') this.shake.add(0.3);
        break;
      case 'daze': {
        const g = sim.guard, p = P(g.x, g.y);
        this.floaters.add(t('hud.daze'), p.x, p.y - s * 2.6, { color: C.goldLight, size: 18 * u });
        break;
      }
      case 'guardDriven': {
        const p = P(e.x, e.y);
        this.flash = Math.max(this.flash, 0.7);
        this.shake.add(e.giant ? 0.9 : 0.6);
        this.fallT = 0;
        this.say(e.giant ? t('hud.fall', { name: guardName(e.kind, sim.circle) }) : t('hud.driven', { name: guardName(e.kind, sim.circle) }), C.goldLight, 2.4, true);
        fx.burst(p.x, p.y - s, 70, { color: C.goldLight, size: 3.5, speed: 340, life: 1.3, g: 90, shape: 'square' });
        if (e.giant) fx.burst(p.x, p.y, 30, { color: '#d9c9a4', size: 7, speed: 160, life: 1.2, g: -10, drag: 2, shape: 'dot' });
        break;
      }
      case 'gate':
        this.say(t('hud.gate'), C.goldLight, 2);
        break;
      case 'questDone': {
        this.questPop = 1;
        this.say(t('hud.questDone'), '#fff3d6', 1.5);
        // the reward flies up from the treasury
        const tr = this.L.treasury;
        this.floaters.add(`+${fmtNum(e.silver)}`, clamp(tr.x - 30 * u, this.L.left + 40, this.L.right - 40), tr.y - 18 * u, { color: C.silver, size: 16 * u });
        break;
      }
      case 'quest':
        this.questPop = 1;
        break;
      case 'buy': case 'build': case 'forge': {
        // gold from the tile that was bought (else the sheet's top)
        const g = this.hud.sheetShown, tile = g && this.boughtTile >= 0 ? g.tiles[this.boughtTile] : null;
        const x = tile ? tile.x + tile.w / 2 : g ? g.frame.x + g.frame.w / 2 : this.ax;
        const y = tile ? clamp(tile.y + tile.h / 2, g!.view.y, g!.view.y + g!.view.h) : g ? g.frame.y + 20 : this.ay;
        this.boughtTile = -1;
        fx.burst(x, y, 22, { color: C.goldLight, size: 3, speed: 200, life: 0.7, g: 160, shape: 'square' });
        if (e.type === 'forge' && e.evolved) {
          this.flash = Math.max(this.flash, 0.4);
          this.say(t('wfx.evolve', { name: weaponName(e.id, tierOf(e.level)) }), C.goldLight, 2);
        }
        break;
      }
      case 'joined':
        this.say(t('hud.joined', { name: companionName(e.id as CompanionId) }), C.goldLight, 2);
        break;
      case 'chest': case 'gift': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.4, 30, { color: e.type === 'gift' ? '#ffd7b8' : C.silver, size: 3, speed: 240, life: 0.9, g: 150, shape: 'square' });
        this.say(e.type === 'gift' ? t('hud.gift') : e.kind === 'reward' ? t('hud.reward', { n: sim.p.level }) : t('hud.chest'), e.type === 'gift' ? '#ffd7b8' : C.silver, 1.6);
        break;
      }
      case 'node': {
        const p = P(e.x, e.y);
        fx.burst(p.x, p.y - s * 0.2, 8, { color: e.kind === 'wood' ? '#a07a48' : '#d8d0bf', size: 3, speed: 120, life: 0.5, g: 220, shape: 'square' });
        break;
      }
      case 'thief':
        this.say(t('hud.thief'), C.goldLight, 1.6);
        break;
      case 'thiefCaught': {
        const p = P(e.x, e.y);
        this.say(t('hud.thiefCaught'), C.goldLight, 1.6);
        fx.burst(p.x, p.y - s * 0.4, 30, { color: C.goldLight, size: 3, speed: 240, life: 0.9, g: 150, shape: 'square' });
        break;
      }
      case 'thiefGone': {
        const p = P(e.x, e.y);
        this.floaters.add(t('hud.thiefGone'), p.x, p.y - s, { color: '#e8d9b8', size: 15 * u });
        fx.burst(p.x, p.y, 14, { color: '#d9c9a4', size: 5, speed: 90, life: 0.8, g: -20, drag: 2, shape: 'dot' });
        break;
      }
      case 'dawn':
        this.say(t('hud.dawn', { n: Math.round(e.share * 100) }), '#ffe3b0', 2.4);
        this.flash = Math.max(this.flash, 0.3);
        break;
      case 'restGift':
        this.say(t('hud.restGift'), C.calm, 2);
        break;
      case 'armour':
        this.say(t('hud.armour'), '#ffe3b0', 2);
        break;
      case 'cave':
        this.say(t('hud.cave'), '#ffe3b0', 2);
        break;
      case 'floor':
        this.say(t('hud.floorDone', { n: e.floor }), C.goldLight, 1.6);
        break;
      case 'caveOut':
        this.say(t('hud.caveOut', { n: e.floor }), '#ffe3b0', 2);
        break;
      default: break;
    }
  }

  update(dt: number, sim: DawidSim): void {
    this.clock += dt;
    const d = sim.david;
    const jump = Math.hypot(this.camX - d.x, this.camY - d.y) > 12;
    this.camX = jump ? d.x : approach(this.camX, d.x, dt, 0.12);
    this.camY = jump ? d.y : approach(this.camY, d.y, dt, 0.2);
    const w = dt * sim.timeScale;
    this.hud.update(dt);
    this.stickK = approach(this.stickK, this.stick ? 1 : 0, dt, this.stick ? 0.03 : 0.06);
    if (!this.stick && this.stickK < 0.02) this.stickLast = null;
    for (const m of this.marks) m.t += dt;
    while (this.marks.length && this.marks[0].t > 0.7) this.marks.shift();
    this.fx.update(w > 0 ? dt : dt * 0.2);
    this.floaters.update(dt);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.levelPop = Math.max(0, this.levelPop - dt * 1.6);
    this.bagPop = Math.max(0, this.bagPop - dt * 4);
    this.questPop = Math.max(0, this.questPop - dt * 2.5);
    const shown = sim.inCamp && !sim.sitting && !sim.story;
    this.campK = approach(this.campK, shown ? 1 : 0, dt, 0.08);
    this.campEff = shown ? this.campK : 0;
    this.anchor();
    if (this.fallT >= 0) this.fallT += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    if (this.levelUp) {
      this.levelUp.t += dt;
      if (this.levelUp.t >= 1.8) this.levelUp = null;
    }
    this.restTint = approach(this.restTint, sim.restBlock ? 1 : 0, dt, 0.9);
    this.night = approach(this.night, sim.blind ? 1 : 0, dt, 0.8);
    const moving = Math.hypot(d.mx, d.my) > 0.05 && d.down <= 0;
    this.stepPhase += w * (moving ? 11 : 0);
    this.lambStep += w * (sim.lamb.walking ? 12 : 0);
    if (sim.land.id !== this.decoLand) {
      this.decoLand = sim.land.id;
      this.decos = decorate(sim.land);
      this.fallT = -1;
    }
    // golden sparks off the ring above the threshold
    if (w > 0 && sim.ringLook === 'live' && sim.whirl >= 0.5 && Math.random() < dt * 10) {
      const a = sim.spinA, p = this.toScreen(d.x + Math.cos(a) * RULES.ringR, d.y + Math.sin(a) * RULES.ringR * 0.55);
      this.fx.burst(p.x, p.y, 1, { color: C.goldLight, size: 2, speed: 30, life: 0.5, g: -30, shape: 'spark' });
    }
  }

  draw(sim: DawidSim): void {
    if (!this.started) return;   // the calibration's intro owns the canvas until play begins
    const ctx = this.ctx, L = this.L, s = L.s, now = this.clock;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 10);
    ctx.save();
    ctx.translate(off.x, off.y);
    const P = (x: number, y: number) => this.toScreen(x, y);
    const inView = (x: number, y: number, pad = 3) => Math.abs(x - this.camX) < this.L.halfW + pad && Math.abs(y - this.camY) < this.L.halfH + pad;
    if (sim.inCave) paintCave(ctx, P, s, this.w, this.h, 22, 15, now);
    else {
      paintGround(ctx, sim.land, P, s, this.w, this.h, this.camX, this.camY, now);
      this.drawLandGround(ctx, sim, now, P, inView);
    }
    this.drawPrints(ctx, sim);
    this.drawMarks(ctx, sim, now);
    // things lying on the ground
    for (const n of sim.nodes) {
      if (sim.inCave || !inView(n.x, n.y)) continue;
      const p = P(n.x, n.y);
      paintHeap(ctx, n.kind, p.x, p.y, s, n.back <= 0);
    }
    for (const c of sim.chests) {
      if (!inView(c.x, c.y)) continue;
      const p = P(c.x, c.y);
      paintChest(ctx, p.x, p.y, s, c.kind, now);
    }
    for (const c of sim.coins) {
      if (!inView(c.x, c.y, 1)) continue;
      const p = P(c.x, c.y);
      paintCoin(ctx, c.kind, p.x, p.y - c.z * s, s, now, c.id);
    }
    this.drawZones(ctx, sim, now);
    if (!sim.sitting) this.drawRing(ctx, sim, now);
    // the figures, back to front
    type Fig = { y: number; f: () => void };
    const figs: Fig[] = [];
    if (!sim.inCave) for (const dc of this.decos) {
      if (!inView(dc.x, dc.y, 4)) continue;
      const p = P(dc.x, dc.y);
      if (dc.kind === 'reeds' || dc.kind === 'wall') { paintDeco(ctx, dc, p.x, p.y, s, now); continue; }
      figs.push({ y: dc.y, f: () => paintDeco(ctx, dc, p.x, p.y, s, now) });
    }
    for (const b of sim.beasts) {
      if (!inView(b.x, b.y)) continue;
      const p = P(b.x, b.y);
      figs.push({
        y: b.y, f: () => {
          ctx.save();
          if (b.age < 0.4) ctx.globalAlpha = b.age / 0.4;
          paintBeast(ctx, b.kind, p.x, p.y, s * 1.05, {
            flip: b.state === 'flee' ? (b.fx >= 0 ? 1 : -1) : b.face, step: now * (b.state === 'flee' ? 22 : 12) + b.id, moving: b.state === 'idle' ? 0.3 : 1,
            hit: b.hit, doze: b.state === 'doze' ? 1 : 0, t: now, air: b.air, tele: b.state === 'tele' ? 1 : 0, flee: b.state === 'flee' ? b.flee / RULES.fleeSec : 0,
            seed: b.id, hidden: b.hidden, stun: b.state === 'stun' ? 1 : 0,
          });
          ctx.restore();
        },
      });
    }
    this.pushPeople(ctx, figs, sim, now, P, inView);
    const d = sim.david, dp = P(d.x, d.y);
    if (sim.sitting) {
      const fp = P(d.x + 0.95, d.y + 0.25);
      figs.push({ y: d.y + 0.25, f: () => paintFire(ctx, fp.x, fp.y, s * 0.9, now) });
    }
    figs.push({
      y: d.y, f: () => {
        const look: Look = d.armour > 0 ? { ...LOOKS.david, armour: true, head: 'helmet' } : sim.sitting ? { ...LOOKS.david, item: 'harp' } : LOOKS.david;
        const pose: PersonPose = {
          flip: Math.cos(d.face) >= 0 ? 1 : -1, step: this.stepPhase, walking: Math.hypot(d.mx, d.my) > 0.05 ? 1 : 0, sit: d.sit, act: sim.mult > 1 ? 1 : 0.4,
          hit: d.hit > 0 ? 1 : 0, t: now, down: d.down > 0 ? 1 - d.down / RULES.downSec + 0.3 : 0,
        };
        ctx.save();
        if (d.safe > 0 && d.down <= 0 && Math.floor(now * 14) % 2 === 0) ctx.globalAlpha = 0.65;
        paintPerson(ctx, dp.x, dp.y, s, look, pose);
        ctx.restore();
      },
    });
    const lb = sim.lamb, lp = P(lb.x, lb.y);
    figs.push({
      y: lb.y, f: () => paintLamb(ctx, lp.x, lp.y, s, {
        flip: lb.face, step: this.lambStep, walking: lb.walking, sleep: sim.sitting && !sim.talk.line ? 1 : 0, talk: !!sim.talk.line, t: now,
        scared: sim.guardFighting ? 1 : 0,
      }),
    });
    for (const m of sim.mates) {
      const mp = P(m.x, m.y);
      figs.push({
        y: m.y, f: () => paintPerson(ctx, mp.x, mp.y, s, LOOKS[m.id], {
          flip: m.face, step: now * 11 + m.x, walking: m.walking, sit: sim.sitting ? 1 : 0, act: m.act > 0 ? 1 : 0, hit: 0, t: now,
        }),
      });
    }
    const g = sim.guard;
    if (!sim.inCave && g.state !== 'gone' && inView(g.x, g.y, 6)) figs.push({ y: g.y, f: () => this.drawGuard(ctx, sim, now) });
    const th = sim.thief;
    if (th && inView(th.x, th.y)) {
      const tp = P(th.x, th.y);
      figs.push({ y: th.y, f: () => paintThief(ctx, tp.x, tp.y, s * 1.05, Math.cos(th.dir) >= 0 ? 1 : -1, now, th.hit) });
    }
    figs.sort((a, b) => a.y - b.y);
    for (const f of figs) f.f();
    this.drawShots(ctx, sim, now);
    for (const pf of sim.puffs) {
      const p = P(pf.x, pf.y), k = pf.t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.6 * (1 - k));
      for (let i = 0; i < 4; i++) ellipse(ctx, p.x - pf.dir * s * (0.3 + i * 0.25) * (1 + k), p.y - s * (0.15 + i * 0.05), s * (0.22 + k * 0.3), s * (0.14 + k * 0.15), '#e2d3b0');
      ctx.restore();
    }
    this.drawRings(ctx, sim);
    for (const n of sim.notes) {
      const p = P(n.x, n.y), k = n.t / 2.2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = n.n % 2 ? C.goldLight : '#fff3d6';
      ctx.font = font(800, Math.max(15, s * 0.46), SANS);
      ctx.textAlign = 'center';
      ctx.fillText(n.n % 3 ? '♪' : '♫', p.x + Math.sin(k * 6 + n.n) * s * 0.4, p.y - k * s * 1.6);
      ctx.restore();
    }
    this.fx.draw(ctx);
    this.floaters.draw(ctx, SANS);
    ctx.restore();
    // the harp's dusk, the moonless night, a hurt, a flash
    if (this.restTint > 0.01) {
      ctx.fillStyle = `rgba(70,40,90,${0.2 * this.restTint})`;
      ctx.fillRect(0, 0, this.w, this.h);
      if (sim.sitting) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fp = P(d.x + 0.95, d.y);
        glow(ctx, fp.x, fp.y, s * 4, 'rgba(255,160,80,', 0.22 * this.restTint);
        ctx.restore();
      }
    }
    if (this.night > 0.01) {
      const c = P(d.x, d.y - 0.5);
      const gr = ctx.createRadialGradient(c.x, c.y, s * 1.2, c.x, c.y, s * 6);
      gr.addColorStop(0, 'rgba(10,14,36,0)');
      gr.addColorStop(1, `rgba(10,14,36,${0.72 * this.night})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.fillStyle = `rgba(230,235,255,${0.5 * this.night})`;
      for (let i = 0; i < 26; i++) {
        const x = hash(i * 13) * this.w, y = this.L.top + hash(i * 7 + 1) * (this.h - this.L.top) * 0.6;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,246,214,${0.6 * this.flash})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.hurtFlash > 0) {
      const gr = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.3, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
      gr.addColorStop(0, 'rgba(200,40,30,0)');
      gr.addColorStop(1, `rgba(200,40,30,${0.32 * this.hurtFlash})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, this.w, this.h);
    }
    // the game's own bits: the top band, the bottom band (under the camp's sheet when it is up), the sheet
    const campK = this.campEff;
    const sheet = L.sheet, side = sheet.dock === 'right';
    const qt = sim.questTarget();
    const lift = sim.quest?.kind === 'guard' ? (sim.guard.spec.giant ? 3.9 : 2.4) : sim.quest?.kind === 'visit' ? 1.8 : 0;
    const pillR = side && campK > 0.05 ? Math.min(L.right, sheet.x + (1 - ease.outCubic(campK)) * (sheet.w + 24) - 8) : L.right;
    this.hud.drawQuest(ctx, L, sim, qt ? this.toScreen(qt.x, qt.y - lift) : null, now, this.questPop, pillR);
    if (!(side && campK > 0.3)) this.hud.drawMini(ctx, L, sim, now);
    if (side || campK < 0.98) this.hud.drawBars(ctx, L, sim, now, this.levelPop);
    if (campK < 0.5) this.hud.drawButtons(ctx, L, sim, now, this.bagPop);
    this.hud.drawCamp(ctx, L, sim, now, campK);
    if (this.levelUp && !sim.story) this.hud.drawLevelUp(ctx, L, this.levelUp.level, this.levelUp.gain, this.levelUp.t / 1.8, this.ay);
    if (this.banner && !sim.story && !this.levelUp) this.hud.drawBanner(ctx, L, this.banner.text, this.banner.t / this.banner.dur, this.banner.color, this.banner.big);
    // bubbles keep above the bottom band and the sheet (never over a control)
    const floor = campK > 0.05 && !side ? Math.min(L.field.bottom, sheet.head.y + (1 - ease.outCubic(campK)) * (sheet.h + sheet.head.h) - 6)
      : Math.min(L.field.bottom, L.stone.hit.y - 6);
    if (g.tauntT > 0 && g.taunt && !sim.story && !sim.inCave) {
      const gp = P(g.x, g.y);
      this.hud.drawBubble(ctx, L, g.taunt, gp.x, gp.y - s * 2.8, 1 - g.tauntT / 2.6 + 0.3, true, floor);
    }
    const line = sim.talk.line;
    if (line && !sim.story && !this.levelUp) this.hud.drawBubble(ctx, L, line.text, lp.x, lp.y - s * 0.9, line.t, false, floor);
    const st = this.stick ?? this.stickLast;
    if (st && this.stickK > 0.02 && !sim.story) this.drawStick(ctx, st, this.stickK);
    this.hud.drawStory(ctx, L, sim, this.touch);
  }

  /** Rings on the ground where a tap sent David, and his goal while he walks to it. */
  private drawMarks(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number): void {
    const s = this.L.s;
    ctx.save();
    if (sim.mode === 'go' && !sim.inCave) {
      const p = this.toScreen(sim.goal.x, sim.goal.y), k = 0.5 + 0.5 * Math.sin(now * 5);
      ctx.strokeStyle = `rgba(255,231,163,${0.55 + 0.35 * k})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * (0.42 + 0.08 * k), s * (0.24 + 0.05 * k), 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,231,163,.85)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.08, s * 0.05, 0, 0, TAU);
      ctx.fill();
    }
    for (const m of this.marks) {
      const k = m.t / 0.7, p = this.toScreen(m.x, m.y);
      const r = s * (m.kind === 'hunt' ? 0.9 + 1.3 * ease.outCubic(k) : 0.25 + 0.65 * ease.outCubic(k));
      ctx.strokeStyle = m.kind === 'hunt' ? `rgba(255,250,232,${0.85 * (1 - k)})` : `rgba(255,231,163,${0.95 * (1 - k)})`;
      ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 0.56, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** The camp, the dens, the lair, the gate, the armies of Elah, the people waiting at their places. */
  private drawLandGround(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number, P: (x: number, y: number) => { x: number; y: number }, inView: (x: number, y: number, pad?: number) => boolean): void {
    const s = this.L.s, land = sim.land;
    for (const dn of sim.dens) {
      if (!inView(dn.x, dn.y, 4)) continue;
      const p = P(dn.x, dn.y);
      paintDen(ctx, dn.kind, p.x, p.y, s);
    }
    const [cx, cy] = land.camp;
    if (inView(cx, cy, 6)) {
      const c = P(cx, cy);
      ellipse(ctx, c.x, c.y, RULES.campR * s, RULES.campR * s, 'rgba(201,167,122,.5)');
      ctx.strokeStyle = 'rgba(120,90,50,.35)';
      ctx.setLineDash([s * 0.2, s * 0.2]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, RULES.campR * s, RULES.campR * s, 0, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      const t1 = P(cx - 1.4, cy - 2.5), t2 = P(cx + 1.6, cy - 2.7);
      paintTent(ctx, t1.x, t1.y, s, 0);
      paintTent(ctx, t2.x, t2.y, s * 0.85, 1);
      for (const [id, [bx, by]] of Object.entries(PLOTS) as [BuildingId, readonly [number, number]][]) {
        const lv = buildingLevel(sim.p, id);
        if (id === 'jaskinia' && lv <= 0) continue;
        const bp = P(cx + bx, cy + by);
        paintBuilding(ctx, id, bp.x, bp.y, s * 0.85, lv, now);
      }
    }
    if (inView(land.lair[0], land.lair[1], 6)) {
      const lp = P(land.lair[0], land.lair[1]);
      paintLair(ctx, land.guard, lp.x, lp.y, s);
    }
    if (inView(land.gate[0], land.gate[1], 6)) {
      const gp = P(land.gate[0], land.gate[1]);
      paintGate(ctx, gp.x, gp.y, s, sim.gateOpen, now);
    }
    // the Valley of Elah: Israel's tents above, the Philistines' below; they run when the giant falls
    if (land.id === 'ela') {
      const run = sim.guard.state === 'gone' || sim.guard.state === 'driven' ? clamp((this.fallT < 0 ? 9 : this.fallT) / 4) : 0;
      for (let i = 0; i < 7; i++) {
        const a = P(10 + i * 4.4, 1.6), b = P(34 + i * 4, 40.6);
        if (inView(10 + i * 4.4, 1.6, 5)) paintTent(ctx, a.x, a.y, s * 0.8, i % 2);
        if (inView(34 + i * 4, 40.6, 5) && run < 1) {
          ctx.save();
          ctx.globalAlpha = 1 - run;
          paintTent(ctx, b.x + run * s * 6, b.y, s * 0.8, 1);
          for (let j = 0; j < 3; j++) {
            const sp = P(33 + i * 4 + j, 38.6);
            ctx.fillStyle = 'rgba(70,52,40,.75)';
            ctx.beginPath();
            ctx.ellipse(sp.x + run * s * 12, sp.y - s * 0.5, s * 0.14, s * 0.4, 0, 0, TAU);
            ctx.fill();
            ellipse(ctx, sp.x + run * s * 12, sp.y - s * 1, s * 0.11, s * 0.11, 'rgba(70,52,40,.75)');
          }
          ctx.restore();
        }
      }
    }
    // the five smooth stones glint in the brook while the quest asks for them
    const q = sim.quest;
    if (q?.kind === 'visit' && q.what === 'brook') {
      const at = land.spots.brook;
      if (at && inView(at[0], at[1])) {
        const p = P(at[0], at[1]);
        for (let i = 0; i < 5; i++) {
          ellipse(ctx, p.x + (i - 2) * s * 0.22, p.y + Math.sin(i * 2) * s * 0.1, s * 0.1, s * 0.07, '#f4efe4');
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, p.x + (i - 2) * s * 0.22, p.y, s * 0.3, 'rgba(255,240,200,', 0.3 + 0.2 * Math.sin(now * 4 + i));
          ctx.restore();
        }
      }
    }
  }

  /** The people of the story at their places (those who have not joined yet), with "!" over the one the quest leads to. */
  private pushPeople(ctx: CanvasRenderingContext2D, figs: { y: number; f: () => void }[], sim: DawidSim, now: number, P: (x: number, y: number) => { x: number; y: number }, inView: (x: number, y: number, pad?: number) => boolean): void {
    if (sim.inCave) return;
    const s = this.L.s, land = sim.land, q = sim.quest;
    for (const [spot, at] of Object.entries(land.spots) as [Spot, readonly [number, number]][]) {
      const who = PEOPLE[spot];
      if (!who || !inView(at[0], at[1])) continue;
      if ((sim.p.joined as string[]).includes(spot)) continue;
      const p = P(at[0], at[1]);
      const wanted = q?.kind === 'visit' && q.what === spot;
      figs.push({
        y: at[1], f: () => {
          paintPerson(ctx, p.x, p.y, s, LOOKS[who], { flip: sim.david.x >= at[0] ? 1 : -1, step: 0, walking: 0, sit: 0, act: 0, hit: 0, t: now, talk: wanted && Math.sin(now * 2) > 0 });
          if (wanted) {
            const c = ctx;
            const bob = Math.abs(Math.sin(now * 3)) * s * 0.15;
            c.fillStyle = C.gold;
            c.strokeStyle = 'rgba(43,33,24,.7)';
            c.lineWidth = 3;
            c.font = font(900, s * 0.75, SANS);
            c.textAlign = 'center';
            c.textBaseline = 'alphabetic';
            c.strokeText('!', p.x, p.y - s * 2 - bob);
            c.fillText('!', p.x, p.y - s * 2 - bob);
          }
        },
      });
    }
  }

  /** The band, drawn large: the sling's ring around David's feet (see the file's note). */
  private drawRing(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number): void {
    const s = this.L.s, d = sim.david, p = this.toScreen(d.x, d.y);
    const R = RULES.ringR * s, Ry = R * 0.55;
    const look = sim.ringLook;
    const cy = p.y - s * 0.02;
    // the dial runs along the ring's front (in sight, in front of David): from the left through his feet to the right
    const a0 = Math.PI + 0.4, span = Math.PI + 0.8;
    const arc = (from: number, to: number) => { ctx.beginPath(); ctx.ellipse(p.x, cy, R, Ry, 0, a0 - from * span, a0 - to * span, true); };
    ctx.save();
    if (look === 'night') {
      ctx.strokeStyle = 'rgba(160,70,40,.55)';
      ctx.lineWidth = 3;
      arc(0, 1);
      ctx.stroke();
    } else {
      // the track
      ctx.strokeStyle = look === 'grey' ? 'rgba(200,200,205,.35)' : 'rgba(255,250,232,.32)';
      ctx.lineWidth = Math.max(4, s * 0.12);
      ctx.lineCap = 'round';
      arc(0, 1);
      ctx.stroke();
      // the fill: the whirl, gold past the threshold
      const lv = look === 'live' ? clamp(sim.whirl) : look === 'wait' ? 0.04 + 0.03 * Math.sin(now * 4) : 0;
      if (lv > 0.01) {
        ctx.strokeStyle = '#fff3d6';
        arc(0, Math.min(lv, 0.5));
        ctx.stroke();
        if (lv > 0.5) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, p.x, cy, R * 1.3, 'rgba(255,214,110,', 0.28);
          ctx.restore();
          ctx.strokeStyle = C.gold;
          ctx.lineWidth = Math.max(5, s * 0.15);
          arc(0.5, lv);
          ctx.stroke();
        }
      }
      // the threshold: a notch in front of David's feet, named
      if (sim.pushBlock && look !== 'grey') {
        const nx = p.x, ny = cy + Ry;
        ctx.strokeStyle = 'rgba(255,250,232,.95)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(nx, ny - s * 0.18);
        ctx.lineTo(nx, ny + s * 0.2);
        ctx.stroke();
        ctx.font = font(800, 13 * this.L.u, SANS);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(40,28,14,.7)';
        ctx.strokeText(t('hud.mark'), nx, ny + s * 0.24);
        ctx.fillStyle = 'rgba(255,250,232,.95)';
        ctx.fillText(t('hud.mark'), nx, ny + s * 0.24);
      }
      // the multiplier
      if (look === 'live' && sim.mult > 1) {
        ctx.font = font(900, (15 + sim.mult * 2) * this.L.u, SANS);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(60,30,0,.55)';
        const txt = `×${fmtNum(sim.mult, Number.isInteger(sim.mult) ? 0 : 1)}`;
        ctx.strokeText(txt, p.x + R + s * 0.2, cy - s * 0.1);
        ctx.fillStyle = C.goldLight;
        ctx.fillText(txt, p.x + R + s * 0.2, cy - s * 0.1);
      }
    }
    // the whirling stone with its trail (the great stone glows when it is ready)
    const golden = sim.mult > 1, ready = sim.stoneReady;
    for (let i = 5; i >= 0; i--) {
      const a = sim.spinA - i * 0.18 * (golden ? 1.4 : 1);
      const x = p.x + Math.cos(a) * R, y = cy + Math.sin(a) * Ry - s * 0.55;
      const r = s * (ready ? 0.16 : 0.09) * (1 - i * 0.12);
      ctx.globalAlpha = i === 0 ? 1 : 0.35 * (1 - i / 6);
      ellipse(ctx, x, y, r, r, look === 'night' ? '#8a6a5a' : golden || ready ? C.gold : '#e9e4da');
    }
    ctx.globalAlpha = 1;
    if (ready) {
      const a = sim.spinA, x = p.x + Math.cos(a) * R, y = cy + Math.sin(a) * Ry - s * 0.55;
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, x, y, s * 0.7, 'rgba(255,230,150,', 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the cord from David's hand to the stone
    const a = sim.spinA, sx = p.x + Math.cos(a) * R, sy = cy + Math.sin(a) * Ry - s * 0.55;
    ctx.strokeStyle = 'rgba(106,66,36,.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x + (Math.cos(d.face) >= 0 ? 1 : -1) * s * 0.3, p.y - s * 0.75);
    ctx.lineTo(sx, sy);
    ctx.stroke();
    ctx.restore();
  }

  private drawGuard(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number): void {
    const g = sim.guard, s = this.L.s, p = this.toScreen(g.x, g.y);
    const flip = Math.cos(g.face) >= 0 ? 1 : -1;
    const asleep = g.state === 'sleep' || g.state === 'home';
    if (g.state === 'daze') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y - s, s * 2.2, 'rgba(255,214,107,', 0.28 + 0.1 * Math.sin(now * 8));
      ctx.restore();
    }
    if (g.spec.giant) {
      const b = sim.bearer, bp = this.toScreen(b.x, b.y);
      const behind = b.y < g.y;
      const fade = g.state === 'driven' ? clamp((2.4 - g.st) / 0.8) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const giant = () => paintGiant(ctx, p.x, p.y, s, {
        flip, step: now * 6, moving: g.state === 'move' ? 1 : 0, act: g.state === 'act' || g.state === 'tele' ? 1 : 0, hit: g.hit > 0 ? 1 : 0,
        fall: g.state === 'driven' ? g.fall : 0, t: now, daze: g.state === 'daze' ? 1 : 0, hue: g.kind === 'olbrzym' ? 1 : 0,
      });
      const bearer = () => { if (g.state !== 'driven') paintBearer(ctx, bp.x, bp.y, s, Math.cos(g.bearerA) >= 0 ? 1 : -1, now, g.state === 'daze' ? 1 : 0); };
      if (behind) { bearer(); giant(); } else { giant(); bearer(); }
      ctx.restore();
    } else {
      const kind = g.kind === 'tur' ? 'tur' : g.kind;
      const flee = g.state === 'driven' ? clamp(g.st / 2.2) : 0;
      paintBeast(ctx, kind, p.x, p.y, s, {
        flip, step: now * (g.state === 'driven' ? 20 : 9), moving: g.state === 'move' || g.state === 'driven' || g.state === 'home' ? 1 : 0,
        hit: g.hit > 0 ? 1 : 0, doze: asleep ? 1 : 0, t: now, air: g.state === 'act' && g.pattern === 'pounce' ? Math.sin(clamp(g.st / g.dur) * Math.PI) * 0.8 : 0,
        tele: g.state === 'tele' ? 1 : 0, flee, seed: 3, hidden: false, stun: g.state === 'daze' ? 1 : 0,
      }, g.kind === 'tur' ? 1.5 : 1.35);
    }
    if (g.state === 'tele') {
      ctx.fillStyle = '#ffe1c8';
      ctx.font = font(900, s * 0.7, SANS);
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - s * (g.spec.giant ? 3.6 : 2.2) - Math.abs(Math.sin(now * 10)) * s * 0.2);
    }
    // its spirit: a bar over it while it fights
    if (sim.guardFighting || (g.state === 'sleep' && g.hp < g.max)) {
      const w = s * 2.4, x = p.x - w / 2, y = p.y - s * (g.spec.giant ? 3.4 : 2.3);
      ctx.fillStyle = 'rgba(36,28,20,.7)';
      ctx.beginPath();
      ctx.roundRect(x - 2, y - 2, w + 4, s * 0.2 + 4, 4);
      ctx.fill();
      ctx.fillStyle = '#e0563a';
      ctx.fillRect(x, y, w * clamp(g.hp / g.max), s * 0.2);
      ctx.font = font(800, 13 * this.L.u, SANS);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(40,24,12,.7)';
      ctx.strokeText(g.name, p.x, y - 3);
      ctx.fillStyle = '#fff8e6';
      ctx.fillText(g.name, p.x, y - 3);
    }
    if (asleep && g.hp >= g.max && !sim.guardActive) {
      ctx.fillStyle = 'rgba(240,245,255,.8)';
      ctx.font = font(800, Math.max(13, s * 0.45), SANS);
      ctx.textAlign = 'center';
      const zz = (now * 0.5) % 1;
      ctx.globalAlpha = 1 - zz;
      ctx.fillText('z', p.x + s * 0.6 + zz * s * 0.4, p.y - s * (1.6 + zz * 0.8));
      ctx.globalAlpha = 1;
    }
  }

  /** Footprints: the band's history in the grass (gold above the threshold, blue for a calm rest, grey in the night). */
  private drawPrints(ctx: CanvasRenderingContext2D, sim: DawidSim): void {
    const s = this.L.s;
    for (const pr of sim.prints) {
      const age = (sim.t - pr.t) / RULES.stepKeep;
      if (age >= 1) continue;
      const p = this.toScreen(pr.x, pr.y);
      if (p.x < -10 || p.x > this.w + 10 || p.y < -10 || p.y > this.h + 10) continue;
      const a = (1 - age) * 0.85;
      ctx.fillStyle = pr.veiled ? `rgba(120,120,130,${a * 0.6})`
        : pr.above ? (pr.phase === 'rest' ? `rgba(136,170,224,${a})` : `rgba(255,205,90,${a})`)
          : `rgba(80,62,40,${a * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.06, s * 0.1, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** The guardians' and the beasts' telegraphs: red shapes pulsing on the ground, bright when the blow comes. */
  private drawZones(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number): void {
    const s = this.L.s;
    for (const z of sim.zones) {
      const p = this.toScreen(z.x, z.y);
      const k = clamp(z.t / Math.max(0.01, z.dur));
      const a = z.live ? 0.62 : (z.small ? 0.22 : 0.3) + 0.12 * Math.sin(now * 14) + 0.25 * k;
      ctx.save();
      ctx.fillStyle = z.live ? `rgba(255,96,40,${a})` : `rgba(222,38,30,${a})`;
      ctx.strokeStyle = z.live ? 'rgba(255,236,200,.9)' : 'rgba(170,20,16,.85)';
      ctx.lineWidth = z.small ? 1.5 : 2.5;
      ctx.setLineDash(z.live ? [] : [8, 6]);
      ctx.beginPath();
      // drawn true to the hit areas (the map is not squashed)
      if (z.kind === 'cone') {
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, z.len * s, z.a - z.w, z.a + z.w);
        ctx.closePath();
      } else if (z.kind === 'lane') {
        ctx.translate(p.x, p.y);
        ctx.rotate(z.a);
        ctx.rect(0, (-z.w * s) / 2, z.len * s, z.w * s);
      } else ctx.arc(p.x, p.y, z.w * s, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawShots(ctx: CanvasRenderingContext2D, sim: DawidSim, now: number): void {
    const s = this.L.s;
    for (const sh of sim.shots) {
      const p = this.toScreen(sh.x, sh.y);
      const lift = sh.z * s;
      if (sh.kind === 'stone' || sh.kind === 'great') {
        const big = sh.kind === 'great';
        const r = s * (big ? 0.22 : 0.08);
        if (sh.gold || big) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          glow(ctx, p.x, p.y - lift, r * (big ? 5 : 3.5), 'rgba(255,214,110,', big ? 0.7 : 0.5);
          ctx.restore();
        }
        ellipse(ctx, p.x, p.y - lift, r, r, big ? '#fff0c8' : sh.gold ? C.gold : '#e6e0d4');
        if (big) for (let i = 1; i < 6; i++) {
          const q = this.toScreen(sh.x - (sh.tx - sh.x) * 0.02 * i, sh.y - (sh.ty - sh.y) * 0.02 * i);
          ellipse(ctx, q.x, q.y - lift, r * (1 - i * 0.15), r * (1 - i * 0.15), `rgba(255,220,140,${0.4 - i * 0.06})`);
        }
        continue;
      }
      const a = Math.atan2(sh.vy, sh.vx);
      ctx.save();
      ctx.translate(p.x, p.y - lift);
      ctx.rotate(a);
      ctx.strokeStyle = sh.kind === 'javelin' ? '#7a5434' : '#8a6a42';
      ctx.lineWidth = Math.max(2, s * (sh.kind === 'javelin' ? 0.07 : 0.04));
      ctx.beginPath();
      ctx.moveTo(-s * (sh.kind === 'javelin' ? 0.8 : 0.45), 0);
      ctx.lineTo(s * 0.2, 0);
      ctx.stroke();
      ctx.fillStyle = sh.gold ? C.gold : '#c9d1dc';
      ctx.beginPath();
      ctx.moveTo(s * 0.34, 0);
      ctx.lineTo(s * 0.16, -s * 0.07);
      ctx.lineTo(s * 0.16, s * 0.07);
      ctx.fill();
      ctx.restore();
    }
    void now;
  }

  private drawRings(ctx: CanvasRenderingContext2D, sim: DawidSim): void {
    const s = this.L.s;
    for (const r of sim.rings) {
      const k = clamp(r.t / r.dur);
      const p = this.toScreen(r.x, r.y);
      ctx.save();
      switch (r.kind) {
        case 'great': case 'roar': case 'stomp': case 'level': {
          const color = r.kind === 'great' ? `rgba(255,230,160,${0.9 * (1 - k)})` : r.kind === 'level' ? `rgba(255,214,110,${0.9 * (1 - k)})` : `rgba(255,140,90,${0.7 * (1 - k)})`;
          ctx.strokeStyle = color;
          ctx.lineWidth = r.kind === 'great' ? 8 : 4;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, r.r * s * (0.2 + 0.8 * k), r.r * s * 0.62 * (0.2 + 0.8 * k), 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'sweep': {
          ctx.strokeStyle = `rgba(255,250,232,${0.8 * (1 - k)})`;
          ctx.lineWidth = s * 0.12;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - s * 0.4, r.r * s, r.r * s * 0.62, 0, -Math.PI * 0.9 + k * 2, -Math.PI * 0.1 + k * 4);
          ctx.stroke();
          break;
        }
        case 'shield': {
          const d = this.toScreen(sim.david.x, sim.david.y);
          ctx.strokeStyle = `rgba(160,200,255,${0.75 * (1 - k * 0.5)})`;
          ctx.fillStyle = `rgba(160,200,255,${0.12 * (1 - k)})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y - s * 0.6, s * 0.95, s * 1.05, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'heal': {
          ctx.strokeStyle = `rgba(255,220,170,${0.8 * (1 - k)})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y - s * 0.5 - k * s, r.r * s * (0.5 + k), r.r * s * 0.5 * (0.5 + k), 0, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'dash': {
          ctx.strokeStyle = `rgba(255,250,232,${0.6 * (1 - k)})`;
          ctx.lineWidth = s * 0.25 * (1 - k);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - s * 0.5);
          const m = sim.mates.find(x => x.kit === 'dash');
          if (m) {
            const q = this.toScreen(m.x, m.y);
            ctx.lineTo(q.x, q.y - s * 0.5);
          }
          ctx.stroke();
          break;
        }
        default: break;
      }
      ctx.restore();
    }
  }

  /**
   * The floating joystick, shown from the touch-down: a dark base with a light rim where the finger went
   * down (the full speed at its rim), four marks, and the knob under the finger (held inside the rim), with
   * a wedge on the rim toward where David walks.
   */
  private drawStick(ctx: CanvasRenderingContext2D, st: Stick, k: number): void {
    const R = RULES.stickPx;
    const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), c = d > R ? R / d : 1;
    const kx = st.ox + dx * c, ky = st.oy + dy * c;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(30,22,14,.34)';
    ctx.strokeStyle = 'rgba(255,250,232,.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(st.ox, st.oy, R, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,232,.28)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(st.ox, st.oy, R * 0.5, 0, TAU);
    ctx.stroke();
    // the four marks
    ctx.fillStyle = 'rgba(255,250,232,.55)';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2, cx = st.ox + Math.cos(a) * R * 0.8, cy = st.oy + Math.sin(a) * R * 0.8;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      ctx.lineTo(cx + Math.cos(a + 2.2) * 5, cy + Math.sin(a + 2.2) * 5);
      ctx.lineTo(cx + Math.cos(a - 2.2) * 5, cy + Math.sin(a - 2.2) * 5);
      ctx.fill();
    }
    // the wedge toward the walk
    if (st.on && d > 4) {
      const a = Math.atan2(dy, dx);
      ctx.strokeStyle = C.goldLight;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, R, a - 0.42, a + 0.42);
      ctx.stroke();
    }
    // the knob
    ctx.fillStyle = 'rgba(30,22,14,.3)';
    ctx.beginPath();
    ctx.arc(kx, ky + 3, R * 0.44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = st.on ? 'rgba(255,250,232,.95)' : 'rgba(255,250,232,.8)';
    ctx.strokeStyle = 'rgba(43,33,24,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kx, ky, R * 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

