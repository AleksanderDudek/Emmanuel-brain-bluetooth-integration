/**
 * Dobry bój's ring (DESIGN.md §25, builder B): the hall, the ring or the cage, the two fighters (rig.ts), the slow
 * motion's look, the energy, the impacts and the canvas HUD (overlay.ts) — drawn from a `FightView` (view.ts) on a
 * `Layout` (layout.ts).  The class and its methods are the contract builder A's index.ts calls: `resize` on a new
 * size, `draw` every frame (the context in CSS px, already scaled by dpr).
 *
 *   the world   runs on its own clock (`timeScale`): the fighters' blends, their steps, the dust, the trails; the
 *               player's energy and the HUD run in real time (focus is not slowed)
 *   the camera  frames the two fighters in the layout's stage (a wider, calmer shot in the read and the corner, so the
 *               breath's pill clears their heads); in the slow motion it eases in toward the point of contact; a clean
 *               hit shakes it a little — none of that with reduced motion (a still frame, fades)
 *   slow motion the world desaturates and darkens (a 'saturation' blend, a veil and a vignette), the moving limbs leave
 *               trails, the incoming strike's path glows soft red-gold from the fist to its target, the energy
 *               gathers in the player's core and rings the fists; at the release a flash (not with reduced motion)
 */
import { STRIKES, type StrikeId, type Target } from './moves';
import { fighterScale, type Layout } from './layout';
import { drawHud, type HudState } from './overlay';
import { C, FONT, TAU, clamp01, glow, hash, lerp, rgba, smooth } from './paint';
import {
  BUILD, DEPTH_DROP, REF_STAND, Rig, mixPose, paintFighter, paintShadow, poseFor, refPose, solve, strikeTip, targetPoint, travelT,
  type Joints, type P3, type Paint, type Pose, type PoseCtx, type RefAct,
} from './rig';
import { Hall, crowdLights, dust, ringBack, ringFront, type Cam } from './stage';
import type { Act, FightView, FighterView, Look, Phase } from './view';

/** The referee: a white shirt, dark trousers (never one of the fighters' kits). */
const REF_LOOK: Look = { sex: 'on', skin: 1, hair: 0, kit: '#26262c', gloves: '#ffffff' };

/** The spacing between the two fighters' roots (world units) for what they are doing. */
export function spacingFor(v: FightView): number {
  const a = v.player.act.kind, b = v.foe.act.kind;
  if (a === 'corner' || b === 'corner') return 2.1;
  if (a === 'embrace' || b === 'embrace') return 0.32;
  if (a === 'touch' || b === 'touch') return 0.68;
  if (v.phase === 'intro') return 1.9;
  if (v.phase === 'count') return 1.15;
  if (a === 'out' || b === 'out' || a === 'cheer' || b === 'cheer') return 1.0;
  if (v.phase === 'read' || v.phase === 'end') return 0.86;
  return 0.62;
}

interface Trail { pts: { t: number; x: number; y: number }[] }

const isPower = (a: Act): boolean => a.kind === 'strike' && a.power >= 0.7;

export class RingView {
  private l: Layout | null = null;
  private dpr = 1;
  private readonly hall = new Hall();
  private me: Rig;
  private foe: Rig;
  private meSex: 'ona' | 'on' = 'on';
  private foeSex: 'ona' | 'on' = 'on';
  private wt = 0;
  private D = 1.9;
  private mid = 0;
  private walkPh = 0;
  private walkAmt = 0;
  private cam: Cam | null = null;
  private lastPhase: Phase | null = null;
  private lastEnergy = 0;
  private flash = 0;
  private trails = new Map<string, Trail>();
  private slowMax = 0;
  private hud: HudState = { ghostMe: 1, ghostFoe: 1, count: null, countAge: 9, coach: null, coachAge: 0, left: 0 };
  private first = true;
  private ref = { x: 1.6, z: -1.2, facing: -1, pose: { ...REF_STAND } as Pose, walk: 0, walkAmt: 0, beatAt: 0, lastCount: null as number | null, outAt: -1 };

  constructor(readonly opts: { reduced: boolean }) {
    this.me = new Rig(BUILD.on, 'boks');
    this.foe = new Rig(BUILD.on, 'boks');
  }

  /** the canvas changed size (CSS px; the context is already scaled by dpr) */
  resize(l: Layout, dpr: number): void {
    this.l = l;
    this.dpr = Math.max(1, Math.min(3, Number.isFinite(dpr) ? dpr : 1));
    this.cam = null;
  }

  /** The layout in use (builder A's hud reads the card and the pacer from it). */
  get layout(): Layout | null { return this.l; }

  /** every frame: `dt` real seconds since the last frame, `time` seconds since the view began */
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
    // the fighters' bodies follow their division
    if (v.player.look.sex !== this.meSex) { this.meSex = v.player.look.sex; this.me = new Rig(BUILD[this.meSex], style); }
    if (v.foe.look.sex !== this.foeSex) { this.foeSex = v.foe.look.sex; this.foe = new Rig(BUILD[this.foeSex], style); }
    // the spacing and the pair's place on the canvas (circling slowly in the read)
    const Dt = spacingFor(v);
    if (this.first) { this.D = Dt; this.first = false; }
    const prevD = this.D;
    this.D += (Dt - this.D) * (1 - Math.exp(-wdt / (v.phase === 'intro' ? 0.9 : 0.35)));
    const vel = wdt > 0 ? Math.abs(this.D - prevD) / wdt : 0;
    const walking = vel > 0.08 ? Math.min(1, vel * 2.2) : 0;
    this.walkAmt += (walking - this.walkAmt) * Math.min(1, wdt * 8);
    this.walkPh += wdt * 10 * (this.walkAmt > 0.02 ? 1 : 0);
    const midT = v.phase === 'read' && !reduced ? 0.18 * Math.sin(this.wt * 0.23) : 0;
    this.mid += (midT - this.mid) * (1 - Math.exp(-wdt / 1.2));
    // the defence's level: what is coming
    const vs: Target | null = v.incoming ? STRIKES[v.incoming.strike].target : v.foe.act.kind === 'strike' || v.foe.act.kind === 'tell' ? STRIKES[v.foe.act.strike].target : null;
    const walk = this.walkAmt > 0.02 ? { phase: this.walkPh, amt: this.walkAmt } : undefined;
    const pc = (who: FighterView, other: FighterView): PoseCtx => ({
      style, D: this.D, time: this.wt + (who === v.foe ? 0.37 : 0), vs: who === v.player ? vs : (other.act.kind === 'strike' ? STRIKES[other.act.strike].target : null),
      breath: v.breath, walk,
    });
    const jm = this.me.update(v.player.act, v.player.t, wdt, pc(v.player, v.foe));
    const jf = this.foe.update(v.foe.act, v.foe.t, wdt, pc(v.foe, v.player));
    // the camera: the stage's frame, wider in the read and the corner, easing in toward the contact in the slow motion
    const stage = l.stage ?? l.ring;
    const calm = v.phase === 'read' || v.phase === 'corner' || v.phase === 'intro';
    const top = calm && l.readTop ? l.readTop : stage.y;
    const s0 = fighterScale(stage) * 0.94;
    let s = Math.min(s0, stage.w / (this.D + 0.84), (stage.y + stage.h - top) / 1.08);
    let fy = stage.y + stage.h - Math.max(8, s * 0.05);
    let cx = this.mid;
    let ox = stage.x + stage.w / 2;
    if (!reduced && slow > 0.01) {
      const F0 = this.focusPoint(v, jm, jf, { cx, s, ox, fy });
      // zoom about a point between the contact and the floor: the contact comes closer, the feet stay in the frame
      const F: [number, number] = [F0[0], fy - 0.35 * (fy - F0[1])];
      // never more than the stage can hold: the heads stay under the bars, the feet over the why line
      const zMax = Math.max(1, (stage.h * 1.04) / (1.0 * s));
      const z = Math.min(zMax, 1 + 0.2 * smooth(slow));
      // zoom about F: F stays where it is
      const wx = cx + (F[0] - ox) / s;
      s *= z;
      cx = wx - (F[0] - ox) / s;
      fy = F[1] + (fy - F[1]) * z;
      // never let the floor rise above the stage's foot by much (the fighters stay framed), nor the heads above its top
      fy = Math.max(fy, stage.y + stage.h * 0.82);
      fy = Math.max(fy, stage.y + 0.98 * s);
      fy = Math.min(fy, stage.y + stage.h + 0.05 * s);
    }
    const target: Cam = { cx, s, ox, fy };
    if (!this.cam || reduced) this.cam = target;
    else {
      const k = 1 - Math.exp(-rdt / 0.28);
      this.cam = { cx: lerp(this.cam.cx, cx, k), s: lerp(this.cam.s, s, k), ox: lerp(this.cam.ox, ox, k), fy: lerp(this.cam.fy, fy, k) };
    }
    const cam = this.cam;
    // the hall baked at the camera's rest for this layout
    const restS = Math.min(s0, stage.w / (0.62 + 0.84));
    this.hall.bake(l.w, l.h, this.dpr, style, { cx: 0, s: restS, ox, fy: stage.y + stage.h - Math.max(8, restS * 0.05) });
    // a clean hit shakes the frame a little (not with reduced motion)
    let shake = 0;
    for (const im of v.impacts) if (im.force > 0.5 && im.age < 0.35) shake = Math.max(shake, im.force * Math.exp(-im.age / 0.09));
    const sx = reduced ? 0 : shake * 5 * Math.sin(time * 71), sy = reduced ? 0 : shake * 4 * Math.cos(time * 53);
    // phase changes: the release's flash, the slow motion's length
    if (v.phase === 'slow' && this.lastPhase !== 'slow') this.slowMax = Math.max(1, v.left ?? 1);
    if (v.phase === 'slow') this.slowMax = Math.max(this.slowMax, v.left ?? 0);
    if (this.lastPhase === 'slow' && v.phase !== 'slow' && this.lastEnergy > 0.5 && !reduced) this.flash = 1;
    this.flash = Math.max(0, this.flash - rdt / 0.45);
    this.lastPhase = v.phase;
    this.lastEnergy = v.energy;

    const W = l.w, H = l.h;
    ctx.save();
    ctx.translate(sx, sy);
    // ── the world ──
    this.hall.draw(ctx, W, H, cam, style);
    crowdLights(ctx, cam, W, time, v.crowd, reduced);
    const light = 1 - 0.35 * slow;
    ringBack(ctx, cam, W, H, style, light);
    ringFront(ctx, cam, W, H, style);
    this.referee(ctx, v, cam, wdt, time, style);
    if (slow > 0.01) this.slowLook(ctx, W, H, slow, 'world');
    const pm = this.paintOf(v.player, cam, -this.D / 2, 1, style);
    const pf = this.paintOf(v.foe, cam, this.D / 2, -1, style);
    paintShadow(ctx, jm, this.me.build, pm);
    paintShadow(ctx, jf, this.foe.build, pf);
    // the trails behind the moving limbs (the slow motion, a charged strike)
    this.trackTrails(jm, jf, pm, pf, v);
    this.drawTrails(ctx, cam, v, slow);
    for (const layer of ['far', 'body', 'near', 'top'] as const) {
      paintFighter(ctx, jf, this.foe.build, pf, this.foe.act, layer);
      paintFighter(ctx, jm, this.me.build, pm, this.me.act, layer);
    }
    dust(ctx, cam, this.wt, 0.8 + 0.4 * slow, reduced);
    // ── the slow motion's look ──
    if (slow > 0.01) this.slowLook(ctx, W, H, slow, 'bodies');
    if (v.phase === 'slow' || slow > 0.05) {
      this.incomingPath(ctx, v, jf, pf, jm, pm, slow, time);
      this.openingSpot(ctx, v, jf, pf, slow, time);
    }
    this.energy(ctx, v, jm, pm, time, reduced);
    this.impacts(ctx, v, jm, jf, pm, pf, cam);
    if (this.flash > 0) {
      const core = this.scr(midCore(jm), pm);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, C.energyHi, core[0], core[1], cam.s * (0.4 + 1.2 * (1 - this.flash)), 0.85 * this.flash);
      ctx.fillStyle = rgba(C.warmHi, 0.22 * this.flash * this.flash);
      ctx.fillRect(-20, -20, W + 40, H + 40);
      ctx.restore();
    }
    if (v.phase === 'read' || v.phase === 'corner') this.breathHalo(ctx, v, jm, pm, cam);
    ctx.restore();
    // ── the HUD (never shaken) ──
    // the count stands over the fallen fighter (clear of the referee beside them)
    const fallen = v.player.act.kind === 'down' ? pm : v.foe.act.kind === 'down' ? pf : null;
    this.hud.countX = fallen ? fallen.x + fallen.facing * (fallen === pm ? jm : jf).head[0] * cam.s : null;
    const target0 = v.phase === 'slow' ? v.left ?? 0 : 0;
    this.hud.left = this.slowMax > 0 ? clamp01(target0 / this.slowMax) : 0;
    drawHud(ctx, l, v, this.hud, rdt, time, reduced);
  }

  private paintOf(f: FighterView, cam: Cam, wx: number, facing: number, style: FightView['style']): Paint {
    return { look: f.look, style, facing, x: cam.ox + (wx - cam.cx) * cam.s, y: cam.fy, s: cam.s };
  }

  /** A frame point of a fighter on the screen. */
  private scr(j: P3, pt: Paint): [number, number] {
    const b = BUILD[pt.look.sex];
    const s = pt.s * b.scale;
    return [pt.x + pt.facing * j[0] * s, pt.y - (j[1] - j[2] * pt.facing * DEPTH_DROP) * s];
  }

  /**
   * The referee: always in the ring, out of the way — at the ropes beyond the fighters while they work, between them
   * at the walk-in, over a fallen fighter for the count (one arm marking each number), waving it off beside a fighter
   * the fight is over for.  Drawn behind the fighters (deeper in the ring), walking where he goes.
   */
  private referee(ctx: CanvasRenderingContext2D, v: FightView, cam: Cam, wdt: number, time: number, style: FightView['style']): void {
    const r = this.ref;
    const pRoot = this.mid - this.D / 2, fRoot = this.mid + this.D / 2;
    const meDown = v.player.act.kind === 'down' || v.player.act.kind === 'out';
    const foeDown = v.foe.act.kind === 'down' || v.foe.act.kind === 'out';
    const out = v.player.act.kind === 'out' || v.foe.act.kind === 'out';
    let tx: number, tz: number, facing: number, act: RefAct = 'stand';
    if (meDown || foeDown) {
      const fallen = meDown ? pRoot : fRoot, dir = meDown ? 1 : -1;
      tx = fallen + dir * 0.5;
      tz = -0.35;
      facing = -dir;
      if (out) {
        if (r.outAt < 0) r.outAt = time;
        act = time - r.outAt < 4 ? 'wave' : 'stand';
      } else act = v.count !== null ? 'count' : 'stand';
    } else if (v.phase === 'intro') {
      // between them, a step back: they touch gloves in front of him
      tx = this.mid;
      tz = -1.3;
      facing = -1;
    } else {
      // by the ropes beyond a fighter where the frame holds all of him, else out of the frame (never a sliver at an edge)
      const half = (this.l ? (this.l.stage ?? this.l.ring).w / 2 : 200) / cam.s;
      // the side he is on (he never crosses between the fighters to get there)
      const side = r.x >= this.mid ? 1 : -1;
      const at = this.D / 2 + 0.95;
      tx = this.mid + side * (at + 0.3 < half ? at : half + 0.8);
      tz = -1.2;
      facing = tx < this.mid ? 1 : -1;
    }
    if (!out) r.outAt = -1;
    if (v.count !== r.lastCount) { r.lastCount = v.count; r.beatAt = time; }
    const k = 1 - Math.exp(-wdt / 0.6);
    const px = r.x;
    r.x += (tx - r.x) * k;
    r.z += (tz - r.z) * k;
    r.facing = facing;
    const vel = wdt > 0 ? Math.abs(r.x - px) / wdt : 0;
    r.walkAmt += ((vel > 0.06 ? Math.min(1, vel * 2) : 0) - r.walkAmt) * Math.min(1, wdt * 8);
    r.walk += wdt * 9;
    const target = refPose(act, Math.min(1, (time - r.beatAt) / 0.9), time, { phase: r.walk, amt: r.walkAmt });
    r.pose = mixPose(r.pose, target, 1 - Math.exp(-wdt / 0.12));
    const j = solve(r.pose, BUILD.on);
    const p = 1 / (1 - r.z * 0.1);
    const s = cam.s * p;
    const x = cam.ox + (r.x - cam.cx) * cam.s * p;
    if (x < -s || x > (this.l?.w ?? 0) + s) return;
    const pt: Paint = { look: REF_LOOK, style, facing: r.facing, x, y: cam.fy + r.z * DEPTH_DROP * cam.s, s, referee: true };
    paintShadow(ctx, j, BUILD.on, pt);
    for (const layer of ['far', 'body', 'near', 'top'] as const) paintFighter(ctx, j, BUILD.on, pt, { kind: 'guard' }, layer);
  }

  /** Where the slow motion looks: between the incoming strike's tip and its target, or at the opening. */
  private focusPoint(v: FightView, jm: Joints, jf: Joints, cam: Cam): [number, number] {
    const pm = this.paintOf(v.player, cam, -this.D / 2, 1, v.style);
    const pf = this.paintOf(v.foe, cam, this.D / 2, -1, v.style);
    if (v.incoming) {
      const a = this.scr(strikeTip(jf, v.incoming.strike), pf);
      const b = this.scr(targetPoint(jm, STRIKES[v.incoming.strike].target), pm);
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    }
    const a = this.scr(jm.head, pm), b = this.scr(jf.head, pf);
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + cam.s * 0.1];
  }

  private trackTrails(jm: Joints, jf: Joints, pm: Paint, pf: Paint, v: FightView): void {
    const add = (key: string, j: P3, pt: Paint): void => {
      // world coordinates (independent of the camera): x across, y up
      const b = BUILD[pt.look.sex];
      const cam = this.cam!;
      const wx = cam.cx + (pt.x - cam.ox) / cam.s + pt.facing * j[0] * b.scale;
      const wy = (j[1] - j[2] * pt.facing * DEPTH_DROP) * b.scale;
      let tr = this.trails.get(key);
      if (!tr) { tr = { pts: [] }; this.trails.set(key, tr); }
      const last = tr.pts[tr.pts.length - 1];
      if (!last || Math.hypot(last.x - wx, last.y - wy) > 0.004 || this.wt - last.t > 0.05) tr.pts.push({ t: this.wt, x: wx, y: wy });
      while (tr.pts.length > 2 && this.wt - tr.pts[0].t > 0.6) tr.pts.shift();
      if (tr.pts.length > 90) tr.pts.splice(0, tr.pts.length - 90);
    };
    add('mL', jm.gL, pm); add('mR', jm.gR, pm); add('mFL', jm.aL, pm); add('mFR', jm.aR, pm);
    add('fL', jf.gL, pf); add('fR', jf.gR, pf); add('fFL', jf.aL, pf); add('fFR', jf.aR, pf);
    void v;
  }

  private drawTrails(ctx: CanvasRenderingContext2D, cam: Cam, v: FightView, slow: number): void {
    const powerMe = isPower(v.player.act), powerFoe = isPower(v.foe.act);
    if (slow < 0.05 && !powerMe && !powerFoe) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [key, tr] of this.trails) {
      const mine = key[0] === 'm';
      const lit = slow > 0.05 || (mine ? powerMe : powerFoe);
      if (!lit || tr.pts.length < 2) continue;
      const span = slow > 0.05 ? 0.35 : 0.14;
      const col = mine ? C.energy : C.threat;
      const base = slow > 0.05 ? Math.max(0.4, slow) : 0.8;
      // four strokes per trail (by age), not one per segment: cheap on a slow phone
      for (let q = 0; q < 4; q++) {
        const a0 = (span * q) / 4, a1 = (span * (q + 1)) / 4;
        const k = 1 - (q + 0.5) / 4;
        ctx.beginPath();
        let n = 0;
        for (let i = 1; i < tr.pts.length; i++) {
          const pa = tr.pts[i - 1], pb = tr.pts[i];
          const age = this.wt - pb.t;
          if (age < a0 || age > a1) continue;
          ctx.moveTo(cam.ox + (pa.x - cam.cx) * cam.s, cam.fy - pa.y * cam.s);
          ctx.lineTo(cam.ox + (pb.x - cam.cx) * cam.s, cam.fy - pb.y * cam.s);
          n++;
        }
        if (!n) continue;
        ctx.strokeStyle = rgba(col, 0.32 * k * base);
        ctx.lineWidth = Math.max(1, cam.s * 0.05 * k);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /**
   * The slow motion's look in two passes: `world` drains the hall and the ring of colour and darkens them (before the
   * fighters are drawn), `bodies` lays a lighter veil and the vignette over everything after — the fighters keep
   * some of their colour under the one light, the tell stays readable.
   */
  private slowLook(ctx: CanvasRenderingContext2D, W: number, H: number, slow: number, pass: 'world' | 'bodies'): void {
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
    if (pass === 'bodies') {
      const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.25, W / 2, H * 0.55, Math.hypot(W, H) * 0.6);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(4,2,8,${0.6 * k})`);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.restore();
  }

  /** The incoming strike's path: soft red-gold from the fist to its target, the travelled part behind it fading. */
  private incomingPath(ctx: CanvasRenderingContext2D, v: FightView, jf: Joints, pf: Paint, jm: Joints, pm: Paint, slow: number, time: number): void {
    const inc = v.incoming;
    if (!inc) return;
    const id: StrikeId = inc.strike;
    const c: PoseCtx = { style: v.style, D: this.D, time: this.wt };
    const b = this.foe.build;
    const pts: [number, number][] = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const j = solve(poseFor({ kind: 'strike', strike: id, power: 1 }, travelT(id, u), c), b);
      pts.push(this.scr(strikeTip(j, id), pf));
    }
    const now = clamp01(inc.travel);
    const cut = Math.round(now * N);
    const tip = this.scr(strikeTip(jf, id), pf);
    const tgt = this.scr(targetPoint(jm, STRIKES[id].target), pm);
    const a = clamp01(slow);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lw = Math.max(2, pf.s * 0.028);
    // ahead: from the fist to the target, a soft glowing line that breathes
    const pulse = 0.75 + 0.25 * Math.sin(time * 5);
    for (const [wid, al] of [[lw * 3.2, 0.12], [lw * 1.6, 0.25], [lw * 0.6, 0.7]] as const) {
      ctx.strokeStyle = rgba(wid > lw * 2 ? C.threat : C.threatHi, al * a * pulse);
      ctx.lineWidth = wid;
      ctx.beginPath();
      ctx.moveTo(tip[0], tip[1]);
      for (let i = Math.max(1, cut + 1); i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.lineTo(tgt[0], tgt[1]);
      ctx.stroke();
    }
    // behind: the way it came, fading
    for (let i = 1; i <= cut; i++) {
      const k = i / Math.max(1, cut);
      ctx.strokeStyle = rgba(C.threat, 0.22 * k * a);
      ctx.lineWidth = lw * (0.6 + 1.2 * k);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    // the target: a soft ring where it will land, the fist's glow
    glow(ctx, C.threat, tgt[0], tgt[1], pm.s * 0.14, 0.35 * a * pulse);
    glow(ctx, C.threatHi, tip[0], tip[1], pf.s * 0.12, 0.5 * a);
    ctx.restore();
  }

  /** An opening shown: a soft gold glow where it can be used (the chin, the body, the lead leg). */
  private openingSpot(ctx: CanvasRenderingContext2D, v: FightView, jf: Joints, pf: Paint, slow: number, time: number): void {
    if (v.foe.act.kind !== 'open') return;
    const tell = v.foe.act.tell;
    const t: Target = tell === 'square' ? 'body' : tell === 'heavyLeg' ? 'legs' : 'head';
    const p = this.scr(targetPoint(jf, t), pf);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.7 + 0.3 * Math.sin(time * 3.2);
    glow(ctx, C.gold, p[0], p[1], pf.s * 0.2, 0.55 * slow * pulse);
    ctx.strokeStyle = rgba('#fff1c4', 0.5 * slow * pulse);
    ctx.lineWidth = Math.max(1.5, pf.s * 0.008);
    ctx.beginPath();
    ctx.arc(p[0], p[1], pf.s * (0.09 + 0.015 * Math.sin(time * 3.2)), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** The energy: warm light gathering in the core and flowing to the fists, rings round the fists filling. */
  private energy(ctx: CanvasRenderingContext2D, v: FightView, jm: Joints, pm: Paint, time: number, reduced: boolean): void {
    const e = clamp01(v.energy);
    const on = v.phase === 'slow' || v.phase === 'count';
    if (!on && e < 0.02) return;
    const vis = on ? 1 : 0.5;
    const core = this.scr(midCore(jm), pm);
    const gl = this.scr(jm.gL, pm), gr = this.scr(jm.gR, pm);
    const s = pm.s;
    const ready = v.ready && on;
    const pulse = ready && !reduced ? 0.8 + 0.2 * Math.sin(time * 9) : 1;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, C.energy, core[0], core[1], s * (0.08 + 0.16 * e), (0.18 + 0.4 * e) * vis * pulse);
    glow(ctx, C.energyHi, core[0], core[1], s * (0.03 + 0.06 * e), (0.25 + 0.45 * e) * vis);
    // the flow: small lights from the core to each fist (real time: the focus is the player's, never slowed)
    if (e > 0.02) {
      const n = 4 + Math.round(e * 6);
      for (const g of [gl, gr]) {
        for (let i = 0; i < n; i++) {
          const u = reduced ? (i + 0.5) / n : (time * (0.5 + 0.6 * e) + i / n + hash(i) * 0.2) % 1;
          const x = core[0] + (g[0] - core[0]) * u + Math.sin(u * 6 + i) * s * 0.012;
          const y = core[1] + (g[1] - core[1]) * u;
          glow(ctx, C.energy, x, y, s * 0.03, 0.5 * e * vis * Math.sin(u * Math.PI));
        }
      }
    }
    // the rings round the fists
    for (const g of [gl, gr]) {
      const r = s * 0.078;
      ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(C.energy, 0.12 * vis);
      ctx.lineWidth = Math.max(2, s * 0.012);
      ctx.beginPath();
      ctx.arc(g[0], g[1], r, 0, TAU);
      ctx.stroke();
      if (e > 0.005) {
        ctx.strokeStyle = rgba(ready ? C.energyHi : C.energy, (0.55 + 0.4 * e) * vis * pulse);
        ctx.lineWidth = Math.max(2, s * (ready ? 0.016 : 0.011));
        ctx.beginPath();
        ctx.arc(g[0], g[1], r, -Math.PI / 2, -Math.PI / 2 + TAU * e);
        ctx.stroke();
      }
      if (ready) glow(ctx, C.energyHi, g[0], g[1], r * 2, 0.4 * pulse);
    }
    ctx.restore();
  }

  /** The impacts: a ring of light (cool for an answered shot, warm and brighter for a clean one), a puff, the words. */
  private impacts(ctx: CanvasRenderingContext2D, v: FightView, jm: Joints, jf: Joints, pm: Paint, pf: Paint, cam: Cam): void {
    if (!v.impacts.length) return;
    ctx.save();
    for (const im of v.impacts) {
      const onMe = im.on === 'player';
      const p = this.scr(targetPoint(onMe ? jm : jf, im.target), onMe ? pm : pf);
      const f = clamp01(im.force);
      const age = Math.max(0, im.age);
      if (age < 0.6) {
        const k = age / 0.6;
        ctx.globalCompositeOperation = 'lighter';
        const col = f < 0.25 ? C.calm : onMe ? C.warm : C.gold;
        ctx.strokeStyle = rgba(col, (1 - k) * (0.35 + 0.6 * f));
        ctx.lineWidth = Math.max(1.5, cam.s * 0.012 * (1 - k));
        ctx.beginPath();
        ctx.arc(p[0], p[1], cam.s * (0.04 + 0.22 * smooth(k) * (0.5 + 0.5 * f)), 0, TAU);
        ctx.stroke();
        if (f > 0.5) {
          // a few short rays for a clean hit
          ctx.strokeStyle = rgba(C.warmHi, (1 - k) * 0.7);
          ctx.lineWidth = Math.max(1, cam.s * 0.008);
          for (let i = 0; i < 7; i++) {
            const an = (i / 7) * TAU + hash(i + Math.round(p[0])) * 0.4;
            const r0 = cam.s * (0.06 + 0.1 * k), r1 = r0 + cam.s * 0.06 * (1 - k);
            ctx.beginPath();
            ctx.moveTo(p[0] + Math.cos(an) * r0, p[1] + Math.sin(an) * r0);
            ctx.lineTo(p[0] + Math.cos(an) * r1, p[1] + Math.sin(an) * r1);
            ctx.stroke();
          }
        }
        glow(ctx, col, p[0], p[1], cam.s * 0.12, (1 - k) * 0.5 * (0.4 + f));
        // the puff of the glove's chalk
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 6; i++) {
          const an = (i / 6) * TAU + 0.3;
          const d = cam.s * (0.03 + 0.09 * smooth(k));
          ctx.fillStyle = `rgba(235,225,210,${0.22 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(p[0] + Math.cos(an) * d, p[1] + Math.sin(an) * d * 0.7, cam.s * (0.012 + 0.02 * k), 0, TAU);
          ctx.fill();
        }
      }
      // the words, rising and fading over ~1.2 s
      if (im.text && age < 1.3) {
        const k = age / 1.3;
        const big = !/^[−-]?\d/.test(im.text);
        const fs = Math.max(15, Math.round((big ? 20 : 17) * (this.l?.k ?? 1)));
        // rising over the hit, never into the bars
        const floorY = (this.l ? this.l.bars.player.y + this.l.bars.player.h : 0) + fs * 1.4;
        const y = Math.max(floorY, p[1] - cam.s * (0.12 + 0.18 * smooth(Math.min(1, age / 0.8))));
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = Math.min(1, (1 - k) * 2.2) * Math.min(1, age / 0.08 + 0.2);
        ctx.font = `800 ${fs}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(12,8,14,0.85)';
        ctx.lineWidth = Math.max(3, fs * 0.2);
        ctx.strokeText(im.text, p[0], y);
        ctx.fillStyle = onMe ? (f < 0.25 ? '#d8ecff' : '#fff0e0') : C.goldHi;
        ctx.fillText(im.text, p[0], y);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
    ctx.restore();
  }

  /** The read and the corner: a calm halo round the player's chest that breathes with the guide. */
  private breathHalo(ctx: CanvasRenderingContext2D, v: FightView, jm: Joints, pm: Paint, cam: Cam): void {
    const b = clamp01(v.breath);
    const c = this.scr(jm.chest, pm);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, '#bfe0ff', c[0], c[1], cam.s * (0.2 + 0.12 * b), 0.07 + 0.1 * b);
    ctx.restore();
  }
}

/** The core where the energy gathers: between the middle of the spine and the chest. */
function midCore(j: Joints): P3 {
  return [(j.mid[0] + j.chest[0]) / 2 + 0.03, (j.mid[1] + j.chest[1]) / 2, 0];
}
