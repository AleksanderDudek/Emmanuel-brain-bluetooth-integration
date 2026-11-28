/**
 * Dobry bój through the boxer's eyes — "Oczami boksera" (DESIGN.md §29): the same fight as the side view (the same
 * `FightView` from the sim, the same rig and poses, the same HUD), seen from the player's own eyes.
 *
 *   the opponent  faces the player in the middle of the ring: the guard, the shoulders' turn, the bounce of the feet,
 *                 the breath, the eyes over the gloves (a blink now and then) — their kit, skin and hair as the ladder
 *                 gives them; behind them the ropes running to a corner's padded post (or the cage's mesh), the light
 *                 over the ring, the crowd on its tiers with its small lights
 *   the gloves    the player's own, at the screen's foot: out into the frame along the rig's own paths as the
 *                 combinations land (a jab straight, a hook round from the side, an uppercut rising), up over the chin
 *                 in a block, sweeping across in a parry; a kick's shin rises from below
 *   the head      a slip tilts and dips the view (≤ 6°), a roll dips it under the hook, a step back draws it away; a
 *                 clean hit is a soft white flash and a brief double image, never a shake; the camera moves gently
 *                 (the guard's bob a few px); with reduced motion it stays still and the moments read as fades
 *   slow motion   the world drains of colour, the incoming fist creeps at the eye along a glowing path, the gap a
 *                 chosen counter will use glows on the opponent, the energy fills the player's gloves
 *   the breaks    the referee steps in: between the two at the walk-in, over a fallen fighter for the count (in front
 *                 of the player when the player is down, the opponent away in a neutral corner), into the ring's
 *                 middle in the corner; the opponent on their stool across the ring between rounds
 *
 * The class is the side view's twin (render.ts RingView): `resize` on a new size, `draw` every frame.
 */
import { STRIKES, type StrikeId, type Style, type Target } from './moves';
import type { Layout } from './layout';
import { drawHud, type HudState } from './overlay';
import { C, FONT, TAU, clamp01, font, glow, hash, lerp, rgba, rr, smooth } from './paint';
import {
  BUILD, REF_STAND, Rig, aimAt, effectorOf, mixPose, poseFor, refPose, solve, strikeTip, targetPoint, travelT,
  type Build, type Joints, type P3, type Pose, type PoseCtx, type RefAct,
} from './rig';
import { NEAR, ease, makeCam, paintFigure, paintOwnGlove, paintOwnLeg, project, worldOf, type FCam, type OwnGlove, type Place, type SP } from './fpaint';
import { EYE, FpHall, fpCone, fpDust, fpFloor, fpRopes, type RingGeo } from './fpring';
import type { Act, FightView, Look, Phase, Rect } from './view';

const REF_LOOK: Look = { sex: 'on', skin: 1, hair: 0, kit: '#26262c', gloves: '#ffffff' };

/** How far the camera stands behind the eyes (units): the opponent whole from the hips up. */
export const BACK = 0.42;
/** The slow motion draws the camera in this much toward the action. */
const SLOW_IN = 0.12;
/** The ring's usual turn (a far corner a little left of the opponent) and its turn in the corners. */
const PSI = 0.55, PSI_CORNER = Math.PI / 4;
/** Comfort: the camera's roll and pitch never pass these (rad); the head's moves reach it at these shares. */
const ROLL_MAX = 0.105, PITCH_MAX = 0.07;

/** The spacing (units between the roots) for what the two are doing, through the eyes. */
export function fpSpacing(v: FightView): number {
  const a = v.player.act.kind, b = v.foe.act.kind;
  if (a === 'corner' || b === 'corner') return 2.9;
  if (a === 'embrace' || b === 'embrace') return 0.46;
  if (a === 'touch' || b === 'touch') return 0.68;
  if (v.phase === 'intro') return 1.7;
  if (a === 'down') return 2.1;
  if (b === 'down' || b === 'out') return 1.15;
  if (a === 'out' || a === 'cheer' || b === 'cheer') return 1.0;
  if (v.phase === 'read' || v.phase === 'end') return 0.86;
  return 0.62;
}

interface Trail { pts: { t: number; p: P3 }[] }

/** The opponent's place: facing the player at D, a step aside when the player is down (a neutral corner). */
const foePlace = (D: number, z: number): Place => ({ x: D, z, yaw: Math.PI });

export class FirstPersonView {
  private l: Layout | null = null;
  private dpr = 1;
  private readonly hall = new FpHall();
  private me: Rig;
  private foe: Rig;
  private meSex: 'ona' | 'on' = 'on';
  private foeSex: 'ona' | 'on' = 'on';
  private guardJ: Joints | null = null;
  private guardKey = '';
  private wt = 0;
  private D = 2.4;
  private foeZ = 0;
  private psi = PSI_CORNER;
  private walkPh = 0;
  private walkAmt = 0;
  private cam = { x: 0, y: EYE, z: 0, roll: 0, pitch: 0, oy: 0 };
  private camInit = false;
  private lastPhase: Phase | null = null;
  private lastEnergy = 0;
  private flash = 0;
  private hit = 0;
  private dazed = 0;
  private lastBirth = -1;
  private slowMax = 0;
  private trails = new Map<string, Trail>();
  private hud: HudState = { ghostMe: 1, ghostFoe: 1, count: null, countAge: 9, coach: null, coachAge: 0, left: 0 };
  private first = true;
  private ref = { x: 0.3, z: 1.3, yaw: Math.PI / 2, pose: { ...REF_STAND } as Pose, walk: 0, walkAmt: 0, beatAt: 0, lastCount: null as number | null, outAt: -1 };

  constructor(readonly opts: { reduced: boolean }) {
    this.me = new Rig(BUILD.on, 'boks');
    this.foe = new Rig(BUILD.on, 'boks');
  }

  resize(l: Layout, dpr: number): void {
    this.l = l;
    this.dpr = Math.max(1, Math.min(3, Number.isFinite(dpr) ? dpr : 1));
    this.camInit = false;
  }

  get layout(): Layout | null { return this.l; }

  draw(ctx: CanvasRenderingContext2D, v: FightView, dt: number, time: number): void {
    const l = this.l;
    if (!l) return;
    const reduced = this.opts.reduced || !!v.reduced;
    const rdt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    const ts = clamp01(Number.isFinite(v.timeScale) ? v.timeScale : 1);
    const wdt = rdt * ts;
    this.wt += wdt;
    const slow = clamp01(v.slow);
    const style = v.style;
    if (v.player.look.sex !== this.meSex) { this.meSex = v.player.look.sex; this.me = new Rig(BUILD[this.meSex], style); }
    if (v.foe.look.sex !== this.foeSex) { this.foeSex = v.foe.look.sex; this.foe = new Rig(BUILD[this.foeSex], style); }
    // the spacing, the opponent's step aside when the player is down, the ring's turn (circling slowly in the read)
    const Dt = fpSpacing(v);
    if (this.first) { this.D = Dt; this.psi = Dt > 2 ? PSI_CORNER : PSI; this.first = false; }
    const prevD = this.D;
    const tau = v.player.act.kind === 'touch' ? 0.3 : v.phase === 'intro' ? 0.9 : 0.35;
    this.D += (Dt - this.D) * (1 - Math.exp(-wdt / tau));
    // the player down: the opponent walks off to a neutral corner, still whole in the frame
    const st0 = l.stage ?? l.ring;
    const zT = v.player.act.kind === 'down' ? Math.max(0.2, Math.min(0.7, (st0.w / 2 / lensOf(st0)) * (2.1 + BACK) - 0.3)) : 0;
    this.foeZ += (zT - this.foeZ) * (1 - Math.exp(-wdt / 0.6));
    const vel = wdt > 0 ? Math.abs(this.D - prevD) / wdt : 0;
    const walking = vel > 0.08 ? Math.min(1, vel * 2.2) : 0;
    this.walkAmt += (walking - this.walkAmt) * Math.min(1, wdt * 8);
    this.walkPh += wdt * 10 * (this.walkAmt > 0.02 ? 1 : 0);
    const cornerish = this.D > 1.9;
    const psiT = cornerish ? PSI_CORNER : PSI + (v.phase === 'read' && !reduced ? 0.2 * Math.sin(this.wt * 0.23) : 0);
    this.psi += (psiT - this.psi) * (1 - Math.exp(-wdt / 1.2));
    // the bodies
    const vs: Target | null = v.incoming ? STRIKES[v.incoming.strike].target : v.foe.act.kind === 'strike' || v.foe.act.kind === 'tell' ? STRIKES[v.foe.act.strike].target : null;
    const walk = this.walkAmt > 0.02 ? { phase: this.walkPh, amt: this.walkAmt } : undefined;
    const pcMe: PoseCtx = { style, D: this.D, time: this.wt, vs, breath: v.breath };
    const pcFoe: PoseCtx = { style, D: this.D, time: this.wt + 0.37, vs: v.player.act.kind === 'strike' ? STRIKES[v.player.act.strike].target : null, breath: v.breath, walk };
    const jm = this.me.update(v.player.act, v.player.t, wdt, pcMe);
    const jf = eyesOverGloves(this.foe, this.foe.update(v.foe.act, v.foe.t, wdt, pcFoe), v.foe.act);
    const gk = `${style}|${this.meSex}`;
    if (this.guardKey !== gk || !this.guardJ) { this.guardKey = gk; this.guardJ = solve(poseFor({ kind: 'guard' }, 0, { style, D: 0.62, time: 0 }), BUILD[this.meSex]); }
    const g0 = this.guardJ;
    const bm = this.me.build, bf = this.foe.build;
    // the frame the opponent is framed in: the stage, its top lowered in a rest (the breath's pill clears the head)
    const stage = l.stage ?? l.ring;
    const calm = v.phase === 'read' || v.phase === 'corner' || v.phase === 'intro';
    const top = calm && l.readTop ? Math.max(stage.y, l.readTop) : stage.y;
    const fBox: Rect = { x: stage.x, y: top, w: stage.w, h: Math.max(40, stage.y + stage.h - top) };
    const f = lensOf(stage);
    const ox = stage.x + stage.w / 2;
    const oyT = fBox.y + fBox.h * 0.3;
    // the camera: at the eyes pulled back, following the head's moves gently (none with reduced motion)
    const s = bm.scale;
    const eye0: P3 = [(g0.head[0] + 0.045) * s, (g0.head[1] + 0.035) * s, 0];
    const dh: P3 = [(jm.head[0] - g0.head[0]) * s, (jm.head[1] - g0.head[1]) * s, (jm.head[2] - g0.head[2]) * s];
    const back = BACK - SLOW_IN * smooth(slow) * (reduced ? 0 : 1);
    const T = reduced
      ? { x: eye0[0] - BACK, y: eye0[1], z: 0, roll: 0, pitch: 0 }
      : {
        x: eye0[0] + dh[0] * (dh[0] < 0 ? 0.9 : 0.4) - back,
        y: eye0[1] + (bigDrop(v.player.act) ? dh[1] * 0.8 : Math.max(-0.035, Math.min(0.03, dh[1] * 0.3))),
        z: dh[2] * 0.75,
        roll: Math.max(-ROLL_MAX, Math.min(ROLL_MAX, -dh[2] * 0.62)),
        pitch: Math.max(-PITCH_MAX, Math.min(PITCH_MAX, -(jm.tilt - g0.tilt) * 0.12)),
      };
    if (!this.camInit) { this.cam = { ...T, oy: oyT }; this.camInit = true; }
    else {
      const k = 1 - Math.exp(-rdt / 0.075), ko = 1 - Math.exp(-rdt / 0.5);
      const c = this.cam;
      c.x = lerp(c.x, T.x, k); c.y = lerp(c.y, T.y, k); c.z = lerp(c.z, T.z, k);
      c.roll = lerp(c.roll, T.roll, k); c.pitch = lerp(c.pitch, T.pitch, k);
      c.oy = reduced ? oyT : lerp(c.oy, oyT, ko);
    }
    const cam = makeCam({ x: this.cam.x, y: this.cam.y, z: this.cam.z, roll: this.cam.roll, pitch: this.cam.pitch, f, ox, oy: this.cam.oy });
    const geo: RingGeo = { cx: this.D / 2, cz: this.foeZ * 0.5, psi: this.psi };
    // the panorama baked at the fight's framing; slid with the ring's turn, raised as the eye goes down
    const oyRest = stage.y + stage.h * 0.3;
    this.hall.bake(l.w, l.h, this.dpr, style, f, ox, oyRest);
    const shift = f * (this.psi - PSI);
    const lift = (f * (cam.y - EYE)) / 6;
    // a new impact on the player: the soft flash, the brief double image
    for (const im of v.impacts) {
      const birth = time - im.age;
      if (birth > this.lastBirth + 1e-3) {
        if (im.on === 'player' && im.force >= 0.25) { this.hit = Math.max(this.hit, 0.35 + 0.65 * im.force); this.dazed = reduced ? 0 : 0.45; }
      }
    }
    for (const im of v.impacts) this.lastBirth = Math.max(this.lastBirth, time - im.age);
    this.hit = Math.max(0, this.hit - rdt / 0.4);
    this.dazed = Math.max(0, this.dazed - rdt);
    if (v.phase === 'slow' && this.lastPhase !== 'slow') this.slowMax = Math.max(1, v.left ?? 1);
    if (v.phase === 'slow') this.slowMax = Math.max(this.slowMax, v.left ?? 0);
    if (this.lastPhase === 'slow' && v.phase !== 'slow' && this.lastEnergy > 0.5 && !reduced) this.flash = 1;
    this.flash = Math.max(0, this.flash - rdt / 0.45);
    this.lastPhase = v.phase;
    this.lastEnergy = v.energy;

    const W = l.w, H = l.h;
    const light = 1 - 0.35 * slow;
    // ── the world ──
    ctx.save();
    this.hall.draw(ctx, W, H, cam, shift, lift);
    this.hall.lights(ctx, cam, W, shift, lift, time, v.crowd, reduced);
    fpFloor(ctx, cam, geo, style, light);
    fpCone(ctx, cam, geo, light);
    fpRopes(ctx, cam, geo, style, light);
    if (slow > 0.01) slowLook(ctx, W, H, slow, 'world');
    // the referee and the opponent, the further first
    const fp = foePlace(this.D, this.foeZ);
    // the referee stays whole in the frame where he stands in it: his side-step is held to what the lens shows there
    const halfAt = (x: number): number => (stage.w / 2 / f) * Math.max(0.3, x - cam.x);
    const refJ = this.referee(v, wdt, time, halfAt);
    const refPl: Place = { x: this.ref.x, z: this.ref.z, yaw: this.ref.yaw };
    const refD = Math.hypot(this.ref.x - cam.x, this.ref.z - cam.z);
    const foeD = Math.hypot(this.D - cam.x, this.foeZ - cam.z);
    const drawRef = (): void => { if (refJ) paintFigure(ctx, cam, refJ, BUILD.on, refPl, { look: REF_LOOK, style, referee: true, time: this.wt, light, seed: 7 }); };
    const drawFoe = (): void => {
      this.stool(ctx, cam, jf, bf, fp);
      if (this.dazed > 0) {
        const a = 0.22 * smooth(this.dazed / 0.45);
        ctx.save();
        ctx.translate(7 * smooth(this.dazed / 0.45), 2);
        paintFigure(ctx, cam, jf, bf, fp, { look: v.foe.look, style, time: this.wt, ghost: { colour: '#f4ece4', alpha: a }, seed: 3 });
        ctx.restore();
      }
      paintFigure(ctx, cam, jf, bf, fp, { look: v.foe.look, style, time: this.wt, light, seed: 3 });
    };
    if (refD > foeD) { drawRef(); drawFoe(); } else { drawFoe(); drawRef(); }
    this.trackTrails(jf, bf, fp, v);
    this.drawTrails(ctx, cam, v, slow);
    fpDust(ctx, cam, geo, this.wt, 0.8 + 0.4 * slow, reduced);
    if (slow > 0.01) slowLook(ctx, W, H, slow, 'bodies');
    if (v.phase === 'slow' || slow > 0.05) {
      this.incomingPath(ctx, cam, v, jf, bf, fp, jm, bm, slow, time);
      this.spots(ctx, cam, v, jf, bf, fp, slow, time);
    }
    // ── the player's own: the gloves (and a kick's shin), the energy in them ──
    const gl = ownGloves(cam, v.player.act, style, this.D, jm, g0, bm, fBox, stage);
    this.legs(ctx, cam, v, jm, bm);
    const order = gl.L.ext > gl.R.ext ? (['L', 'R'] as const) : (['R', 'L'] as const);
    for (const sd of order) paintOwnGlove(ctx, gl[sd], v.player.look, style, sd === 'L' ? -1 : 1, null);
    this.energy(ctx, v, gl, fBox, time, reduced);
    this.impacts(ctx, cam, v, jf, bf, fp, gl, fBox);
    // the release's light from below (the core), the soft white of a clean hit, the dim of a knockdown
    if (this.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, C.energyHi, ox, fBox.y + fBox.h * 1.05, fBox.w * (0.3 + 0.6 * (1 - this.flash)), 0.8 * this.flash);
      ctx.fillStyle = rgba(C.warmHi, 0.2 * this.flash * this.flash);
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.restore();
    }
    if (this.hit > 0) {
      const a = (reduced ? 0.5 : 1) * this.hit * this.hit;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, '#fff6ee', ox, cam.oy + fBox.h * 0.1, Math.max(W, H) * 0.55, 0.45 * a);
      ctx.fillStyle = `rgba(255,248,240,${0.18 * a})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.restore();
    }
    const down = v.player.act.kind === 'down' || v.player.act.kind === 'out';
    this.downDim = clamp01(this.downDim + (down ? rdt / 0.6 : -rdt / 0.5));
    if (this.downDim > 0.01) vignette(ctx, W, H, 0.45 * this.downDim);
    if (v.prompt && (v.phase === 'slow' || slow > 0.3)) this.prompt(ctx, cam, v, jf, bf, fp, slow, l);
    ctx.restore();
    // ── the HUD ──
    const fallenFoe = v.foe.act.kind === 'down' || v.foe.act.kind === 'out';
    const hp = projJHead(cam, jf, bf, fp);
    this.hud.countX = fallenFoe && hp.d > NEAR ? hp.x : null;
    const target0 = v.phase === 'slow' ? v.left ?? 0 : 0;
    this.hud.left = this.slowMax > 0 ? clamp01(target0 / this.slowMax) : 0;
    drawHud(ctx, l, v, this.hud, rdt, time, reduced);
  }

  private downDim = 0;
  private refPlaced = false;

  /** The opponent's corner stool under them between rounds. */
  private stool(ctx: CanvasRenderingContext2D, cam: FCam, j: Joints, b: Build, pl: Place): void {
    if (j.stool < 0.01) return;
    const seat = worldOf([j.pel[0] - 0.02, 0.3, 0], b, pl);
    const corners = [[-0.12, -0.1], [0.12, -0.1], [0.12, 0.1], [-0.12, 0.1]].map(([dx, dz]) => [seat[0] + dx * b.scale, seat[1], seat[2] + dz * b.scale] as const);
    const top = corners.map(c => project(cam, c[0], c[1], c[2]));
    const bot = corners.map(c => project(cam, c[0], 0, c[2]));
    if (top.some(p => p.d < NEAR) || bot.some(p => p.d < NEAR)) return;
    ctx.save();
    ctx.globalAlpha = clamp01(j.stool);
    ctx.strokeStyle = '#2a1d18';
    ctx.lineWidth = Math.max(1.5, 0.02 * top[0].k);
    ctx.beginPath();
    top.forEach((p, i) => { ctx.moveTo(p.x, p.y); ctx.lineTo(bot[i].x, bot[i].y); });
    ctx.stroke();
    ctx.fillStyle = '#4a3428';
    ctx.beginPath();
    top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * The referee: out of the frame at the side while they work; at the walk-in a step behind the opponent's shoulder;
   * beside a fallen opponent for the count (one arm marking each number), in front of the player when the player is down;
   * in the ring's middle in the corner, beside the two at a fight's end.  Walks where he goes.
   */
  private referee(v: FightView, wdt: number, time: number, halfAt: (x: number) => number): Joints | null {
    const r = this.ref;
    const D = this.D;
    const meDown = v.player.act.kind === 'down' || v.player.act.kind === 'out';
    const foeDown = v.foe.act.kind === 'down' || v.foe.act.kind === 'out';
    const out = v.player.act.kind === 'out' || v.foe.act.kind === 'out';
    let tx: number, tz: number, act: RefAct = 'stand';
    let look: [number, number];
    const inside = (x: number, z: number): number => Math.sign(z) * Math.min(Math.abs(z), Math.max(0.12, halfAt(x) - 0.22));
    if (meDown) { tx = 1.15; tz = inside(1.15, -0.22); look = [0, 0]; }
    else if (foeDown) { tx = D + 0.3; tz = inside(D + 0.3, 0.5); look = [D, this.foeZ]; }
    else if (v.phase === 'intro') { tx = D + 0.6; tz = inside(D + 0.6, 0.48); look = [D / 2, 0]; }
    else if (v.phase === 'corner') { tx = D / 2 + 0.2; tz = inside(D / 2 + 0.2, 0.5); look = [D / 2, -1]; }
    else if (v.phase === 'end' || v.player.act.kind === 'embrace' || v.player.act.kind === 'cheer') { tx = D + 0.55; tz = inside(D + 0.55, -0.5); look = [D / 2, 0]; }
    else {
      // at the ropes to the side, out of the frame (he keeps his side)
      const side = r.z >= 0 ? 1 : -1;
      tx = D / 2; tz = side * 1.35; look = [D / 2, 0];
    }
    if (meDown || foeDown) {
      if (out) {
        if (r.outAt < 0) r.outAt = time;
        act = time - r.outAt < 4 ? 'wave' : 'stand';
      } else act = v.count !== null ? 'count' : 'stand';
    }
    if (!out) r.outAt = -1;
    if (v.count !== r.lastCount) { r.lastCount = v.count; r.beatAt = time; }
    // the first frame: he is already where he stands (never walking in past the eye)
    if (!this.refPlaced) { r.x = tx; r.z = tz; this.refPlaced = true; }
    const k = 1 - Math.exp(-wdt / 0.6);
    const px = r.x, pz = r.z;
    r.x += (tx - r.x) * k;
    r.z += (tz - r.z) * k;
    const vel = wdt > 0 ? Math.hypot(r.x - px, r.z - pz) / wdt : 0;
    r.walkAmt += ((vel > 0.06 ? Math.min(1, vel * 2) : 0) - r.walkAmt) * Math.min(1, wdt * 8);
    r.walk += wdt * 9;
    const yawT = Math.atan2(look[1] - r.z, look[0] - r.x);
    let dy = yawT - r.yaw;
    while (dy > Math.PI) dy -= TAU;
    while (dy < -Math.PI) dy += TAU;
    r.yaw += dy * (1 - Math.exp(-wdt / 0.3));
    const target = refPose(act, Math.min(1, (time - r.beatAt) / 0.9), time, { phase: r.walk, amt: r.walkAmt });
    r.pose = mixPose(r.pose, target, 1 - Math.exp(-wdt / 0.12));
    // out of every frame: not drawn
    if (Math.abs(r.z) > 1.2 && !meDown && !foeDown) return null;
    return solve(r.pose, BUILD.on);
  }

  /** A kick's shin, a teep's sole, a knee or a check, rising from the screen's foot (the cage). */
  private legs(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, jm: Joints, b: Build): void {
    const a = v.player.act;
    let side: 'L' | 'R' | null = null;
    if (a.kind === 'strike' || a.kind === 'tell') {
      const e = effectorOf(a.strike);
      if (e === 'fl') side = 'L';
      else if (e === 'fr') side = 'R';
    } else if (a.kind === 'defend' && a.defense === 'check') side = 'L';
    if (!side) return;
    const k = side === 'L' ? jm.kL : jm.kR, an = side === 'L' ? jm.aL : jm.aR;
    const pl: Place = { x: 0, z: 0, yaw: 0 };
    const K = project(cam, ...worldOf(k, b, pl)), A = project(cam, ...worldOf(an, b, pl));
    if (K.d < NEAR || A.d < NEAR) return;
    if (Math.min(K.y, A.y) > (this.l?.h ?? 1e4)) return;
    paintOwnLeg(ctx, { x: K.x, y: K.y, r: b.rSh[0] * b.scale * K.k }, { x: A.x, y: A.y, r: b.rSh[1] * b.scale * A.k }, v.player.look, v.style);
  }

  private trackTrails(jf: Joints, bf: Build, fp: Place, v: FightView): void {
    const add = (key: string, j: P3): void => {
      const p = worldOf(j, bf, fp);
      let tr = this.trails.get(key);
      if (!tr) { tr = { pts: [] }; this.trails.set(key, tr); }
      const last = tr.pts[tr.pts.length - 1];
      if (!last || Math.hypot(last.p[0] - p[0], last.p[1] - p[1], last.p[2] - p[2]) > 0.004 || this.wt - last.t > 0.05) tr.pts.push({ t: this.wt, p });
      while (tr.pts.length > 2 && this.wt - tr.pts[0].t > 0.6) tr.pts.shift();
      if (tr.pts.length > 90) tr.pts.splice(0, tr.pts.length - 90);
    };
    add('fL', jf.gL); add('fR', jf.gR);
    void v;
  }

  private drawTrails(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, slow: number): void {
    const power = v.foe.act.kind === 'strike' && v.foe.act.power >= 0.7;
    if (slow < 0.05 && !power) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const span = slow > 0.05 ? 0.35 : 0.14;
    const base = slow > 0.05 ? Math.max(0.4, slow) : 0.8;
    for (const [, tr] of this.trails) {
      if (tr.pts.length < 2) continue;
      for (let q = 0; q < 4; q++) {
        const a0 = (span * q) / 4, a1 = (span * (q + 1)) / 4, k = 1 - (q + 0.5) / 4;
        ctx.beginPath();
        let n = 0, kk = 0;
        for (let i = 1; i < tr.pts.length; i++) {
          const pa = tr.pts[i - 1], pb = tr.pts[i];
          const age = this.wt - pb.t;
          if (age < a0 || age > a1) continue;
          const A = project(cam, ...pa.p), B = project(cam, ...pb.p);
          if (A.d < NEAR || B.d < NEAR) continue;
          ctx.moveTo(A.x, A.y);
          ctx.lineTo(B.x, B.y);
          kk += B.k;
          n++;
        }
        if (!n) continue;
        ctx.strokeStyle = rgba(C.threat, 0.32 * k * base);
        ctx.lineWidth = Math.max(1, Math.min(14, (kk / n) * 0.03) * k);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The incoming strike's path, from the fist to where it would land on the player (at the eye, the chest, low). */
  private incomingPath(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, jf: Joints, bf: Build, fp: Place, jm: Joints, bm: Build, slow: number, time: number): void {
    const inc = v.incoming;
    if (!inc) return;
    const id: StrikeId = inc.strike;
    const c: PoseCtx = { style: v.style, D: this.D, time: this.wt };
    const pts: SP[] = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const j = solve(poseFor({ kind: 'strike', strike: id, power: 1 }, travelT(id, i / N), c), bf);
      pts.push(project(cam, ...worldOf(strikeTip(j, id), bf, fp)));
    }
    const cut = Math.round(clamp01(inc.travel) * N);
    const tip = project(cam, ...worldOf(strikeTip(jf, id), bf, fp));
    let tgt = project(cam, ...worldOf(targetPoint(jm, STRIKES[id].target), bm, { x: 0, z: 0, yaw: 0 }));
    const lh = this.l?.h ?? 600;
    if (tgt.d < NEAR || tgt.y > lh - 20) tgt = { ...tgt, x: tgt.d < NEAR ? cam.ox : tgt.x, y: Math.min(lh - 30, Math.max(cam.oy, tgt.y)) };
    const a = clamp01(slow);
    const lw = Math.max(2, Math.min(9, tip.k * 0.016));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    for (const [wid, al] of [[lw * 3.2, 0.12], [lw * 1.6, 0.25], [lw * 0.6, 0.7]] as const) {
      ctx.strokeStyle = rgba(wid > lw * 2 ? C.threat : C.threatHi, al * a * pulse);
      ctx.lineWidth = wid;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      for (let i = Math.max(1, cut + 1); i <= N; i++) if (pts[i].d > NEAR) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
    }
    // where it would land: a soft warm glow (at the eye it is the screen's middle — no ring over the opponent's face)
    glow(ctx, C.threat, tgt.x, tgt.y, Math.min(90, Math.max(24, tgt.k * 0.08)), 0.22 * a * pulse);
    glow(ctx, C.threatHi, tip.x, tip.y, Math.min(48, tip.k * 0.08), 0.3 * a);
    ctx.restore();
  }

  /** An opening shown (gold where it can be used), and the gap a chosen counter will use. */
  private spots(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, jf: Joints, bf: Build, fp: Place, slow: number, time: number): void {
    let t: Target | null = null, a = 0;
    if (v.foe.act.kind === 'open') {
      const tell = v.foe.act.tell;
      t = tell === 'square' ? 'body' : tell === 'heavyLeg' ? 'legs' : 'head';
      a = 0.55;
    } else {
      const o = v.options.find(x => x.chosen && x.kind === 'counter');
      if (o) { t = o.aim ?? 'head'; a = 0.35 * clamp01(v.energy * 1.4); }
    }
    if (!t || a <= 0) return;
    const p = project(cam, ...worldOf(targetPoint(jf, t), bf, fp));
    if (p.d < NEAR) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.7 + 0.3 * Math.sin(time * 3.2);
    glow(ctx, C.gold, p.x, p.y, p.k * 0.2, a * slow * pulse);
    ctx.strokeStyle = rgba('#fff1c4', 0.9 * a * slow * pulse);
    ctx.lineWidth = Math.max(1.5, p.k * 0.008);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.k * (t === 'head' && a < 0.5 ? 0.065 : 0.09) * (1 + 0.15 * Math.sin(time * 3.2)), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** The energy: light rising from below (the core, under the frame) into the gloves, the rings round them filling. */
  private energy(ctx: CanvasRenderingContext2D, v: FightView, gl: { L: OwnGlove; R: OwnGlove }, box: Rect, time: number, reduced: boolean): void {
    const e = clamp01(v.energy);
    const on = v.phase === 'slow' || (v.phase === 'count' && v.player.act.kind === 'down');
    if (!on && e < 0.02) return;
    const vis = on ? 1 : 0.5;
    const ready = v.ready && on;
    const pulse = ready && !reduced ? 0.8 + 0.2 * Math.sin(time * 9) : 1;
    const core = { x: box.x + box.w / 2, y: box.y + box.h * 1.08 };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, C.energy, core.x, core.y, box.w * (0.12 + 0.2 * e), (0.12 + 0.3 * e) * vis * pulse);
    for (const sd of ['L', 'R'] as const) {
      const g = gl[sd];
      if (e > 0.02) {
        const n = 4 + Math.round(e * 6);
        for (let i = 0; i < n; i++) {
          const u = reduced ? (i + 0.5) / n : (time * (0.5 + 0.6 * e) + i / n + hash(i + (sd === 'L' ? 0 : 9)) * 0.2) % 1;
          const x = lerp(core.x, g.x, u) + Math.sin(u * 6 + i) * g.r * 0.12, y = lerp(core.y, g.y, u);
          glow(ctx, C.energy, x, y, Math.max(4, g.r * 0.16), 0.5 * e * vis * Math.sin(u * Math.PI));
        }
      }
      const r = g.r * 1.18;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(C.energy, 0.12 * vis);
      ctx.lineWidth = Math.max(2, g.r * 0.06);
      ctx.beginPath();
      ctx.arc(g.x, g.y, r, 0, TAU);
      ctx.stroke();
      if (e > 0.005) {
        ctx.strokeStyle = rgba(ready ? C.energyHi : C.energy, (0.55 + 0.4 * e) * vis * pulse);
        ctx.lineWidth = Math.max(2.5, g.r * (ready ? 0.09 : 0.065));
        ctx.beginPath();
        ctx.arc(g.x, g.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * e);
        ctx.stroke();
      }
      glow(ctx, ready ? C.energyHi : C.energy, g.x, g.y, g.r * 1.5, (ready ? 0.45 : 0.25 * e) * vis * pulse);
    }
    ctx.restore();
  }

  /** The impacts: on the opponent a ring of light, rays and chalk where it lands; on the player at the guard or the eye. */
  private impacts(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, jf: Joints, bf: Build, fp: Place, gl: { L: OwnGlove; R: OwnGlove }, box: Rect): void {
    if (!v.impacts.length) return;
    const k0 = this.l?.k ?? 1;
    ctx.save();
    for (const im of v.impacts) {
      const onMe = im.on === 'player';
      const f = clamp01(im.force);
      const age = Math.max(0, im.age);
      let p: { x: number; y: number }, s: number;
      if (onMe) {
        // answered at the guard: on the glove nearer the blow; a clean one at the eye or the body
        if (f < 0.25) {
          const g = im.target === 'body' ? (gl.L.y > gl.R.y ? gl.L : gl.R) : gl.L.lift > gl.R.lift ? gl.L : gl.R;
          p = { x: g.x, y: g.y - g.r * 0.4 };
          s = g.r * 3.2;
        } else {
          p = { x: cam.ox, y: box.y + box.h * (im.target === 'head' ? 0.8 : 0.86) };
          s = box.h * 0.8;
        }
      } else {
        const q = project(cam, ...worldOf(targetPoint(jf, im.target), bf, fp));
        if (q.d < NEAR) continue;
        p = q;
        s = q.k;
      }
      if (age < 0.6 && !(onMe && f >= 0.25)) {
        const k = age / 0.6;
        ctx.globalCompositeOperation = 'lighter';
        const col = f < 0.25 ? C.calm : onMe ? C.warm : C.gold;
        ctx.strokeStyle = rgba(col, (1 - k) * (0.35 + 0.6 * f));
        ctx.lineWidth = Math.max(1.5, s * 0.012 * (1 - k));
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * (0.04 + 0.22 * smooth(k) * (0.5 + 0.5 * f)), 0, TAU);
        ctx.stroke();
        if (f > 0.5) {
          ctx.strokeStyle = rgba(C.warmHi, (1 - k) * 0.7);
          ctx.lineWidth = Math.max(1, s * 0.008);
          for (let i = 0; i < 7; i++) {
            const an = (i / 7) * TAU + hash(i + Math.round(p.x)) * 0.4;
            const r0 = s * (0.06 + 0.1 * k), r1 = r0 + s * 0.06 * (1 - k);
            ctx.beginPath();
            ctx.moveTo(p.x + Math.cos(an) * r0, p.y + Math.sin(an) * r0);
            ctx.lineTo(p.x + Math.cos(an) * r1, p.y + Math.sin(an) * r1);
            ctx.stroke();
          }
        }
        glow(ctx, col, p.x, p.y, s * 0.12, (1 - k) * 0.5 * (0.4 + f));
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 6; i++) {
          const an = (i / 6) * TAU + 0.3;
          const d = s * (0.03 + 0.09 * smooth(k));
          ctx.fillStyle = `rgba(235,225,210,${0.22 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(an) * d, p.y + Math.sin(an) * d * 0.7, s * (0.012 + 0.02 * k), 0, TAU);
          ctx.fill();
        }
      }
      if (im.text && age < 1.3) {
        const k = age / 1.3;
        const big = !/^[−-]?\d/.test(im.text);
        const fs = Math.max(15, Math.round((big ? 20 : 17) * k0));
        const floorY = (this.l ? this.l.bars.player.y + this.l.bars.player.h : 0) + fs * 1.4;
        const rise = (onMe ? box.h * 0.12 : s * 0.3) * smooth(Math.min(1, age / 0.8));
        const y = Math.max(floorY, p.y - (onMe ? box.h * 0.05 : s * 0.12) - rise);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, (1 - k) * 2.2) * Math.min(1, age / 0.08 + 0.2);
        ctx.font = `800 ${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(12,8,14,0.85)';
        ctx.lineWidth = Math.max(3, fs * 0.2);
        ctx.strokeText(im.text, p.x, y);
        ctx.fillStyle = onMe ? (f < 0.25 ? '#d8ecff' : '#fff0e0') : C.goldHi;
        ctx.fillText(im.text, p.x, y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
  }

  /** What comes or what opens, named over the opponent's head in the slow motion (clear of the bars). */
  private prompt(ctx: CanvasRenderingContext2D, cam: FCam, v: FightView, jf: Joints, bf: Build, fp: Place, slow: number, l: Layout): void {
    const text = v.prompt;
    if (!text) return;
    const hd = projJHead(cam, jf, bf, fp);
    if (hd.d < NEAR) return;
    const k = l.k ?? 1;
    const fs = Math.max(15, Math.round(16 * Math.min(k, 1.4)));
    ctx.save();
    ctx.font = font(800, fs);
    const tw = Math.min(ctx.measureText(text).width, l.w - 40);
    const w = tw + fs * 1.4, h = fs * 1.9;
    const stage = l.stage ?? l.ring;
    const minY = l.bars.player.y + l.bars.player.h + 16 * (l.k ?? 1);
    const x = Math.max(stage.x + 4, Math.min(stage.x + stage.w - w - 4, hd.x - w / 2));
    const y = Math.max(minY, hd.y - hd.k * 0.16 - h - 6);
    const a = smooth(slow);
    const opening = v.foe.act.kind === 'open';
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,7,14,0.72)';
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = rgba(opening ? C.gold : C.threat, 0.7);
    ctx.lineWidth = 1.5;
    rr(ctx, x, y, w, h, h / 2);
    ctx.stroke();
    ctx.fillStyle = opening ? C.goldHi : C.threatHi;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let s = text;
    while (s.length > 4 && ctx.measureText(s).width > tw + 0.5) s = s.slice(0, -2) + '…';
    ctx.fillText(s, x + w / 2, y + h / 2 + 1);
    ctx.restore();
  }
}

/** The opponent's head on the screen. */
function projJHead(cam: FCam, j: Joints, b: Build, pl: Place): SP {
  return project(cam, ...worldOf(j.head, b, pl));
}

/**
 * The player's own gloves on the screen, from the rig (`g0`: the guard's joints, the rest): at rest in the corners of
 * the frame; up over the chin as they block (the rig's gloves rising), higher in a cheer, down when they drop; out
 * toward where the projection puts them as they reach (a strike lands exactly on the target the opponent's face shows).
 */
export function ownGloves(cam: FCam, act: Act, style: Style, D: number, jm: Joints, g0: Joints, b: Build, box: Rect, stage: Rect): { L: OwnGlove; R: OwnGlove } {
  const S = b.scale;
  const rRest = restRadius(stage);
  const boxing = style === 'boks';
  const out = {} as { L: OwnGlove; R: OwnGlove };
  for (const sd of ['L', 'R'] as const) {
    const sgn = sd === 'L' ? -1 : 1;
    const g = sd === 'L' ? jm.gL : jm.gR, e = sd === 'L' ? jm.eL : jm.eR;
    const gg = sd === 'L' ? g0.gL : g0.gR;
    // the rest: the lead glove a little further (higher, smaller), the rear one nearer the chin
    const rest = restAt(stage, box, sd);
    const rR = rRest * (sd === 'L' ? 0.92 : 1);
    const cover = { x: cam.ox + sgn * rRest * 0.66, y: cam.oy + rRest * 1.55 };
    const high = { x: cam.ox + sgn * Math.min(stage.w * 0.4, rRest * 3.4), y: box.y + box.h * 0.48 };
    const lift = (g[1] - gg[1]) / 0.06;
    let bx: number, by: number, br: number;
    if (lift >= 0 && lift <= 1) {
      const k = ease(lift);
      bx = lerp(rest.x, cover.x, k); by = lerp(rest.y, cover.y, k); br = lerp(rR, rRest * 1.12, k);
    } else if (lift > 1) {
      const k = ease((lift - 1) / 3);
      bx = lerp(cover.x, high.x, k); by = lerp(cover.y, high.y, k); br = lerp(rRest * 1.12, rRest * 0.95, k);
    } else {
      bx = rest.x; by = rest.y + Math.min(box.h * 0.45, -lift * box.h * 0.04); br = rR;
    }
    // a glove moving across (a parry, a catch) shifts within the frame
    bx += (g[2] - gg[2]) * rRest * 3.2;
    // the reach: how far toward the act's own goal
    const sh = sd === 'L' ? jm.sL : jm.sR;
    const goal = Math.min(reachOf(act, sd, D), sh[0] + (b.ua + b.fa) * 0.96);
    const ext = clamp01((g[0] - gg[0]) / Math.max(0.08, goal - gg[0]));
    const P = project(cam, ...worldOf(g, b, { x: 0, z: 0, yaw: 0 }));
    const Pe = project(cam, ...worldOf(e, b, { x: 0, z: 0, yaw: 0 }));
    const k = P.d > NEAR * 2 ? ease(ext) : 0;
    const rP = (boxing ? 0.066 : 0.046) * S * P.k;
    const x = lerp(bx, P.x, k), y = lerp(by, P.y, k), r = lerp(br, Math.min(rP, br * 1.2), k);
    const ebx = bx + sgn * br * 0.5, eby = by + br * 2.6;
    const ex = lerp(ebx, Pe.d > NEAR ? Pe.x : ebx, k * 0.85), ey = lerp(eby, Pe.d > NEAR ? Pe.y : eby, k * 0.85);
    out[sd] = { x, y, r, ex, ey, ext, lift };
  }
  return out;
}

/** The player's gloves' size at rest for a stage (px). */
export const restRadius = (stage: Rect): number => Math.max(24, Math.min(120, stage.w * 0.1, stage.h * 0.155));

/** The player's glove at rest: the lead (left) a little further and higher, the rear one nearer, low in the frame. */
export function restAt(stage: Rect, box: Rect, sd: 'L' | 'R'): { x: number; y: number } {
  const sgn = sd === 'L' ? -1 : 1;
  const r = restRadius(stage);
  return { x: stage.x + stage.w / 2 + sgn * Math.min(stage.w * 0.3, r * 2.7), y: box.y + box.h - r * (sd === 'L' ? 0.75 : 0.45) };
}

/** Acts in which the player's whole body goes down (the view goes with it; elsewhere a dip is softened). */
const bigDrop = (a: Act): boolean => a.kind === 'down' || a.kind === 'out' || a.kind === 'rise' || a.kind === 'corner' || (a.kind === 'defend' && a.defense === 'sprawl') || (a.kind === 'strike' && a.strike === 'takedown');

/**
 * Through the eyes the guard would hide the face: the opponent's gloves sit a little lower and apart (only in this
 * view, only the hands that are not striking or reaching), so the eyes show over them as a fighter's do.
 */
function eyesOverGloves(rig: Rig, j: Joints, a: Act): Joints {
  let k = 0, skip: 'l' | 'r' | 'both' | null = null;
  switch (a.kind) {
    case 'guard': case 'tell': case 'open': case 'defend': case 'hit': case 'rise': k = 1; break;
    case 'strike': {
      const e = effectorOf(a.strike);
      k = 1;
      skip = e === 'l' ? 'l' : e === 'r' ? 'r' : a.strike === 'takedown' ? 'both' : null;
      break;
    }
    default: k = 0;
  }
  if (!k || skip === 'both') return j;
  const p = { ...rig.pose };
  if (skip !== 'l') { p.ly -= 0.04; p.lz -= 0.03; }
  if (skip !== 'r') { p.ry -= 0.03; p.rz += 0.03; }
  return solve(p, rig.build);
}

/** The lens for a stage: the opponent from the hips up at the fighting distance; never so long a phone loses the guard. */
export function lensOf(stage: Rect): number {
  return Math.max(120, Math.min(stage.h * 1.22, stage.w * 1.9));
}

/**
 * How far toward the opponent a glove can reach in an act (the frame's x at full reach): a strike's end where it
 * lands, the gloves' meeting point when touching, round the other's back in the embrace, the parry's reach.
 */
export function reachOf(a: Act, side: 'L' | 'R', D: number): number {
  if (a.kind === 'strike' || a.kind === 'tell') {
    const e = effectorOf(a.strike);
    if ((e === 'l' && side === 'L') || (e === 'r' && side === 'R')) {
      if (a.strike === 'takedown') return 0.48;
      return aimAt(STRIKES[a.strike].target, D)[0];
    }
  }
  if (a.kind === 'touch') return D / 2;
  if (a.kind === 'embrace') return D;
  if (a.kind === 'defend' && a.defense === 'parry' && side === 'R') return 0.27;
  return aimAt('head', D)[0];
}

/** The slow motion's look: the world drained of colour and darkened, then a lighter veil and a vignette over all. */
function slowLook(ctx: CanvasRenderingContext2D, W: number, H: number, slow: number, pass: 'world' | 'bodies'): void {
  const k = smooth(slow);
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.globalAlpha = (pass === 'world' ? 0.8 : 0.35) * k;
  ctx.fillStyle = '#808080';
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = `rgba(10,8,18,${(pass === 'world' ? 0.3 : 0.08) * k})`;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  if (pass === 'bodies') vignette(ctx, W, H, 0.6 * k);
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, a: number): void {
  const g = ctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(4,2,8,${clamp01(a)})`);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
}

// ── the lobby's hero and the card's small picture ─────────────────────────────────────────

const pv = { hall: new FpHall(), rigs: new Map<string, Rig>() };
const pvRig = (key: string, sex: Look['sex'], style: Style): Rig => {
  const k = `${key}|${sex}|${style}`;
  let r = pv.rigs.get(k);
  if (!r) { r = new Rig(BUILD[sex], style); pv.rigs.set(k, r); }
  return r;
};

const PV_FOE: Readonly<Record<Look['sex'], Look>> = {
  on: { sex: 'on', skin: 4, hair: 0, kit: '#a8443a', gloves: '#f0c040' },
  ona: { sex: 'ona', skin: 3, hair: 2, kit: '#a8443a', gloves: '#f0c040' },
};
const PV_ME: Look = { sex: 'on', skin: 2, hair: 0, kit: '#2c5aa0', gloves: '#c0342f' };

/**
 * The first-person picture for the lobby (the hero when the player chose it, the view's small tile on the card): the
 * opponent in guard across the ring under its light, the player's own gloves at the foot of the frame.  A phone's
 * hero keeps the scene in its upper two thirds (the title sits over its lower part).
 */
export function drawFpPreview(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, look?: Look, style?: Style): void {
  if (!(w > 0) || !(h > 0)) return;
  const st: Style = style === 'mma' ? 'mma' : 'boks';
  const me = look ?? PV_ME;
  const foeLook = { ...PV_FOE[me.sex === 'ona' ? 'ona' : 'on'] };
  if (foeLook.kit.toLowerCase() === me.kit.toLowerCase()) foeLook.kit = '#3f8f6b';
  const dpr = ctx.getTransform().a || 1;
  // a phone's hero and a card carry the title over their lower third; a desk's tall hero over its foot
  const narrow = w < 560;
  const stage: Rect = narrow ? { x: 0, y: h * 0.02, w, h: h * 0.66 } : { x: 0, y: 0, w, h: h * 0.8 };
  const f = lensOf(stage);
  const D = 0.66;
  const rm = pvRig('me', me.sex, st), rf = pvRig('foe', foeLook.sex, st);
  const c = { style: st, D, time: time * 0.9 };
  const jm = rm.set({ kind: 'guard' }, 0, c);
  const jf = eyesOverGloves(rf, rf.set({ kind: 'guard' }, 0, { ...c, time: time * 0.9 + 0.37 }), { kind: 'guard' });
  const s = rm.build.scale;
  const cam = makeCam({ x: (jm.head[0] + 0.045) * s - BACK, y: (jm.head[1] + 0.035) * s, z: 0, f, ox: w / 2, oy: stage.y + stage.h * 0.3 });
  ctx.save();
  pv.hall.bake(w, h, dpr, st, f, w / 2, cam.oy);
  const geo: RingGeo = { cx: D / 2, cz: 0, psi: PSI + 0.05 * Math.sin(time * 0.2) };
  pv.hall.draw(ctx, w, h, cam, f * (geo.psi - PSI), 0);
  pv.hall.lights(ctx, cam, w, f * (geo.psi - PSI), 0, time, 0.55, false);
  fpFloor(ctx, cam, geo, st, 1);
  fpCone(ctx, cam, geo, 1);
  fpRopes(ctx, cam, geo, st, 1);
  paintFigure(ctx, cam, jf, rf.build, foePlace(D, 0), { look: foeLook, style: st, time, seed: 3 });
  fpDust(ctx, cam, geo, time, 1, false);
  // the player's gloves at rest in the frame's corners
  const rRest = restRadius(stage);
  for (const sd of ['R', 'L'] as const) {
    const sgn = sd === 'L' ? -1 : 1;
    const bob = 0.004 * Math.sin(time * TAU * 1.55 + (sd === 'L' ? 0.6 : 1.1)) * stage.h;
    const at = restAt(stage, stage, sd);
    const x = at.x, y = at.y + bob;
    const r = rRest * (sd === 'L' ? 0.92 : 1);
    paintOwnGlove(ctx, { x, y, r, ex: x + sgn * r * 0.5, ey: y + r * 2.6, ext: 0, lift: 0 }, me, st, sgn, null);
  }
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.warm, w / 2, cam.oy, stage.w * 0.4, 0.07 + 0.03 * Math.sin(time * 0.7));
  ctx.globalCompositeOperation = 'source-over';
  vignette(ctx, w, h, 0.45);
  ctx.restore();
}

