/**
 * Pasterz's picture: the hill seen from above with the camera on the shepherd, zooming out as his
 * flock grows (Crowd City's camera).  Bottom to top: the ground (ground.ts), the footprints (the
 * band's last 40 s on the ground: gold above the threshold, blue in a night, grey without signal,
 * veiled in a blind block), the call ring with its dotted threshold circle (the live gauge: the
 * radius is the reach, the rim turns gold above the threshold), the pens, rocks and bushes, the
 * sheep in their flocks' dyes, the shepherds with their counts and the crown, Łatek, the olive
 * trees' canopies, the night with its fires, and the screen's own things (hud.ts).
 *
 * Effects live in world metres so they stay where they happened while the camera moves.  The
 * runner draws the band's panel and the score; this view draws neither.
 */
import { approach, clamp, ease, Particles, Shake } from '../kit/juice';
import type { PasterzProgress } from './meta';
import { CLOAKS, CROOKS, DOGS, PLAYER_DYE } from './content';
import { GROUND_K, paintGround } from './ground';
import { PasterzHud } from './hud';
import { t } from './i18n';
import { PasterzIntro } from './intro';
import { layout, type Layout } from './layout';
import {
  C, PLAIN, SANS, SheepSprites, font, hash, paintBush, paintCount, paintCrown, paintDog, paintFire, paintPen, paintRock, paintSheep,
  paintShepherd, paintTree, type ShepherdLook,
} from './paint';
import { RULES } from './rules';
import { RING_MARK, type PasterzSim, type Shepherd, type SimEvent } from './sim';
import type { TraceSample } from '../kit/trace';

const TAU = Math.PI * 2;

interface Pulse { x: number; y: number; t: number; dur: number; r0: number; r1: number; color: string; width: number }
interface WFloat { text: string; x: number; y: number; t: number; dur: number; color: string; size: number }
interface Shoot { sx: number; sy: number; x: number; y: number; t: number }

export class PasterzView {
  private readonly ctx: CanvasRenderingContext2D;
  w = 1;
  h = 1;
  dpr = 1;
  L: Layout = layout(1, 1, 0);
  camX = 32;
  camY = 32;
  S = 30;
  private ground: HTMLCanvasElement | null = null;
  private groundOf = -1;
  private readonly sprites = new SheepSprites();
  /** world-space particles (metres) */
  private readonly parts = new Particles(520);
  private readonly floats: WFloat[] = [];
  private readonly pulses: Pulse[] = [];
  private readonly shoots: Shoot[] = [];
  private readonly shake: Shake;
  readonly hud: PasterzHud;
  private readonly introScene = new PasterzIntro();
  clock = 0;
  /** the finger's joystick (screen px): where it went down and where it is */
  stick: { ox: number; oy: number; x: number; y: number } | null = null;
  /** a short freeze on big moments (s) */
  stop = 0;
  /** the joins in a short window, shown as one "+n" over the shepherd */
  private joinAcc = 0;
  private joinT = 0;
  private lossAcc = 0;
  private lossT = 0;
  private fires: { x: number; y: number }[] = [];
  private lastShh = -9;
  private look: ShepherdLook = PLAIN;
  private dogCoat: [string, string] = [DOGS[0].colors[0], DOGS[0].colors[1]];

  constructor(canvas: HTMLCanvasElement, private readonly opts: { reducedMotion: boolean; eeg: boolean }) {
    this.ctx = canvas.getContext('2d')!;
    this.shake = new Shake(opts.reducedMotion);
    this.hud = new PasterzHud();
  }

  resize(w: number, h: number, dpr: number, hudTop: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.L = layout(w, h, hudTop);
  }

  intro(dt: number, p: number, progress: PasterzProgress): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.introScene.draw(ctx, this.w, this.h, dt, p, progress);
  }

  start(sim: PasterzSim): void {
    const p = sim.p;
    const cloak = CLOAKS[p.wear.cloak] ?? CLOAKS[0], crook = CROOKS[p.wear.crook] ?? CROOKS[0], dog = DOGS[p.wear.dog] ?? DOGS[0];
    this.look = { ...PLAIN, mantle: cloak.colors[0], stripe: cloak.colors[1], staff: crook.colors[0], tip: crook.colors[1] };
    this.dogCoat = [dog.colors[0], dog.colors[1]];
    this.camX = sim.player.x;
    this.camY = sim.player.y;
    this.S = this.L.S0;
  }

  // ── coordinates ────────────────────────────────────────────────
  sx(x: number): number { return this.L.cx + (x - this.camX) * this.S; }
  sy(y: number): number { return this.L.cy + (y - this.camY) * this.S; }
  toWorld(x: number, y: number): { x: number; y: number } { return { x: this.camX + (x - this.L.cx) / this.S, y: this.camY + (y - this.L.cy) / this.S }; }
  toScreen(x: number, y: number): { x: number; y: number } { return { x: this.sx(x), y: this.sy(y) }; }
  private visible(x: number, y: number, pad: number): boolean {
    const X = this.sx(x), Y = this.sy(y);
    return X > -pad && X < this.w + pad && Y > -pad && Y < this.h + pad;
  }

  // ── a frame ────────────────────────────────────────────────────
  update(dt: number, sim: PasterzSim): void {
    this.clock += dt;
    this.stop = Math.max(0, this.stop - dt);
    const pl = sim.player, L = this.L;
    const n = pl.n + (sim.tally && sim.phase !== 'play' ? sim.tally.flock : 0);
    const wantS = L.S0 / (1 + 0.05 * Math.sqrt(n));
    this.S = approach(this.S, wantS, dt, 0.9);
    const lead = 0.35;
    this.camX = approach(this.camX, pl.x + pl.vx * lead, dt, 0.18);
    this.camY = approach(this.camY, pl.y + pl.vy * lead, dt, 0.18);
    if (Math.hypot(this.camX - pl.x, this.camY - pl.y) > 14) {
      this.camX = pl.x;
      this.camY = pl.y;
    }
    sim.viewW = this.w / 2 / this.S;
    sim.viewH = (L.bottom - L.top) / 2 / this.S;
    this.parts.update(dt);
    for (const f of this.floats) f.t += dt;
    while (this.floats.length && this.floats[0].t >= this.floats[0].dur) this.floats.shift();
    for (const p of this.pulses) p.t += dt;
    for (let i = this.pulses.length - 1; i >= 0; i--) if (this.pulses[i].t >= this.pulses[i].dur) this.pulses.splice(i, 1);
    for (const s of this.shoots) s.t += dt;
    for (let i = this.shoots.length - 1; i >= 0; i--) if (this.shoots[i].t >= 1.1) this.shoots.splice(i, 1);
    // the joins of a moment add up into one number over the shepherd
    this.joinT -= dt;
    if (this.joinAcc > 0 && this.joinT <= 0) {
      this.float(`+${this.joinAcc}`, pl.x, pl.y - 1.4, '#fff6dc', 18 + Math.min(14, this.joinAcc * 1.5), 0.9);
      this.joinAcc = 0;
    }
    this.lossT -= dt;
    if (this.lossAcc > 0 && this.lossT <= 0) {
      this.float(`−${this.lossAcc}`, pl.x + 0.8, pl.y - 1.2, '#ffd2c4', 18, 0.9);
      this.lossAcc = 0;
    }
    // motes drifting in along the ring's rim while it pulls
    if (sim.ringLook === 'live' && !sim.frozen && sim.ringR > RULES.r0 + 0.4 && !this.opts.reducedMotion) {
      if (Math.random() < dt * 22) {
        const a = Math.random() * TAU, r = sim.ringR;
        this.parts.burst(pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r, 1, {
          color: sim.ringR >= RING_MARK ? '#ffe08a' : '#fff6dc', size: 0.06, speed: 0.6, angle: a + Math.PI, spread: 0.4, g: 0, drag: 0.5, life: 1,
        });
      }
    }
    this.hud.update(dt, sim, this);
  }

  /** Big moments freeze the picture for a few frames (index.ts skips the sim meanwhile). */
  hitStop(dt: number): boolean {
    if (this.stop <= 0) return false;
    this.stop = Math.max(0, this.stop - dt);
    return true;
  }

  draw(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const off = this.shake.offset(1 / 60, 9);
    ctx.fillStyle = '#5d6b37';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(off.x, off.y);
    const W = sim.world;
    if (this.groundOf !== W.seed || !this.ground) {
      this.ground = paintGround(W);
      this.groundOf = W.seed;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.ground, this.sx(0), this.sy(0), (this.ground.width / GROUND_K) * S, (this.ground.height / GROUND_K) * S);
    this.drawPrints(sim);
    this.drawRing(sim);
    for (const p of W.pens) if (this.visible(p.x, p.y, (p.r + 1) * S)) paintPen(ctx, this.sx(p.x), this.sy(p.y), p.r, p.gate, S, RULES.penGate);
    for (const r of W.rocks) if (this.visible(r.x, r.y, 2 * S)) paintRock(ctx, this.sx(r.x), this.sy(r.y), r.r, r.seed, S);
    for (const b of W.bushes) if (this.visible(b.x, b.y, 2 * S)) paintBush(ctx, this.sx(b.x), this.sy(b.y), b.r, b.seed, S, this.clock);
    for (const tr of W.trees) {
      if (!this.visible(tr.x, tr.y, 2 * S)) continue;
      ctx.fillStyle = '#5a4128';
      ctx.beginPath();
      ctx.arc(this.sx(tr.x), this.sy(tr.y), tr.r * S, 0, TAU);
      ctx.fill();
    }
    if (sim.night > 0.05) this.drawFires(sim);
    this.drawLamb(sim);
    this.drawSheep(sim);
    this.drawShepherds(sim);
    this.drawDog(sim);
    // effects under the canopies
    ctx.save();
    ctx.translate(this.sx(0), this.sy(0));
    ctx.scale(S, S);
    this.parts.draw(ctx);
    ctx.restore();
    this.drawPulses();
    const pl = sim.player;
    for (const tr of W.trees) {
      if (!this.visible(tr.x, tr.y, 3 * S)) continue;
      const cr = 1.6 + hash(tr.seed) * 0.6;
      const under = Math.hypot(pl.x - tr.x, pl.y - tr.y) < cr + 0.4;
      paintTree(ctx, this.sx(tr.x), this.sy(tr.y), cr, tr.seed, S, this.clock, under ? 0.45 : 0.96);
    }
    this.drawNight(sim);
    this.drawLabels(sim);
    this.drawFloats();
    ctx.restore();
    this.drawShoots(sim);
    this.hud.draw(ctx, sim, this);
  }

  // ── the layers ─────────────────────────────────────────────────
  /** The footprints: the band's history on the ground, coloured by the trace at the moment of the step. */
  private drawPrints(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, samples = sim.trace.samples, now = sim.t;
    if (!sim.prints.length) return;
    let j = 0;
    for (const p of sim.prints) {
      const age = now - p.t;
      if (age > 40 || !this.visible(p.x, p.y, S)) continue;
      while (j < samples.length - 1 && samples[j + 1].t <= p.t) j++;
      const s: TraceSample | undefined = samples[j];
      const a = clamp(1 - age / 40) * 0.85;
      let col = 'rgba(92,72,48,';
      if (s) {
        const shown = !s.veiled || (s.revealedAt !== null);
        if (!s.reliable) col = 'rgba(160,160,150,';
        else if (!shown) col = 'rgba(92,72,48,';
        else if (s.phase === 'rest') col = 'rgba(110,160,230,';
        else if (s.activity !== null && s.activity >= s.threshold) col = 'rgba(255,196,64,';
        else col = 'rgba(92,72,48,';
      }
      ctx.save();
      ctx.translate(this.sx(p.x), this.sy(p.y));
      ctx.rotate(p.dir);
      ctx.fillStyle = `${col}${a.toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 0.12 * S, 0.055 * S, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The call ring: the band's live gauge drawn on the hill (radius = reach, dotted threshold, gold rim above it). */
  private drawRing(sim: PasterzSim): void {
    if (sim.night > 0.7 || sim.frozen) return;
    const ctx = this.ctx, S = this.S, pl = sim.player;
    const x = this.sx(pl.x), y = this.sy(pl.y);
    const look = sim.ringLook;
    const r = sim.ring * S;
    const above = sim.ringR >= RING_MARK - 0.02;
    const fade = 1 - sim.night;
    ctx.save();
    ctx.globalAlpha = fade;
    if (look === 'live' || sim.flareT > 0) {
      const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
      g.addColorStop(0, 'rgba(255,240,190,0)');
      g.addColorStop(1, above ? 'rgba(255,214,90,.26)' : 'rgba(255,246,220,.18)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      // the threshold, marked on the ring itself
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, RING_MARK * S, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = above ? '#ffcf4a' : 'rgba(255,248,226,.9)';
      ctx.lineWidth = above ? 4 : 2.5;
      ctx.shadowColor = above ? 'rgba(255,200,60,.8)' : 'transparent';
      ctx.shadowBlur = above ? 10 : 0;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = look === 'grey' ? 'rgba(200,200,190,.6)' : look === 'blind' ? 'rgba(120,110,170,.55)' : 'rgba(255,248,226,.55)';
      ctx.lineWidth = 2;
      if (look === 'grey') ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawFires(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S;
    if (this.fires.length !== sim.shepherds.length) this.placeFires(sim);
    for (const f of this.fires) if (this.visible(f.x, f.y, 2 * S)) paintFire(ctx, this.sx(f.x), this.sy(f.y), S, this.clock, sim.night);
  }

  private placeFires(sim: PasterzSim): void {
    this.fires = sim.shepherds.map(s => sim.world.dry(s.x + Math.cos(s.dir) * 1.3, s.y + Math.sin(s.dir) * 1.3, 0.4));
  }

  private drawLamb(sim: PasterzSim): void {
    const l = sim.lamb;
    if (l.state !== 'hidden' || !this.visible(l.x, l.y, 2 * this.S)) return;
    const ctx = this.ctx, S = this.S, x = this.sx(l.x), y = this.sy(l.y);
    const hop = l.bleat > 0 ? Math.abs(Math.sin(this.clock * 14)) * 0.12 * S : 0;
    // a soft glow so it can be found
    const g = ctx.createRadialGradient(x, y, 0, x, y, S * 1.6);
    g.addColorStop(0, 'rgba(255,240,180,.45)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, S * 1.6, 0, TAU);
    ctx.fill();
    paintSheep(ctx, x, y - hop, S, Math.sin(this.clock * 0.7) * 0.6 + 2.2, { small: true, bob: 0, walking: 0, lie: 0, look: 1, graze: 0, bell: '#d9a441' });
  }

  private drawSheep(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S;
    this.sprites.setScale(S, this.dpr);
    const dyes = sim.shepherds.map(s => s.dye);
    const pad = S;
    for (const s of sim.sheep) {
      const X = this.sx(s.x), Y = this.sy(s.y);
      if (X < -pad || X > this.w + pad || Y < -pad || Y > this.h + pad) continue;
      const dye = s.owner >= 0 ? dyes[s.owner] : s.owner === -2 ? PLAYER_DYE : null;
      const lie = s.lie > 0.5;
      const sp = this.sprites.get(dye, s.small, lie, s.look > 0.3 || s.fetch >= 0);
      const bob = Math.sin(s.bob * Math.PI) * Math.min(1, Math.hypot(s.vx, s.vy) / 2);
      const k = 1 + bob * 0.05 + s.flash * 0.25;
      ctx.save();
      ctx.translate(X, Y - Math.abs(bob) * S * 0.04);
      ctx.rotate(s.dir);
      ctx.scale(k, 1 / Math.max(0.9, k * 0.98));
      ctx.drawImage(sp.img, -sp.half, -sp.half, sp.half * 2, sp.half * 2);
      ctx.restore();
      if (s.flash > 0.05) {
        ctx.strokeStyle = `rgba(255,255,255,${(s.flash * 0.8).toFixed(3)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(X, Y, S * (0.45 + (1 - s.flash) * 0.35), 0, TAU);
        ctx.stroke();
      }
    }
  }

  private shepherdLook(s: Shepherd): ShepherdLook {
    if (s.i === 0) return this.look;
    return { mantle: s.dye, stripe: '#3b2f2a', staff: '#6e4a28', tip: '#6e4a28', cloth: '#efe6cf', cord: s.dye };
  }

  private drawShepherds(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S;
    for (const s of sim.shepherds) {
      if (!this.visible(s.x, s.y, 2 * S)) continue;
      const x = this.sx(s.x), y = this.sy(s.y);
      const size = s.i === 0 ? S * 1.12 : S * 0.98;
      if (s.i === 0 && s.grace > 0 && Math.floor(this.clock * 10) % 2 === 0) ctx.globalAlpha = 0.55;
      if (s.out) {
        // sulking: sits facing away, a little rain cloud over his head
        paintShepherd(ctx, x, y, size * 0.9, s.dir + Math.PI, 0, 0, false, this.shepherdLook(s));
        this.cloud(x, y - S * 1.1);
      } else {
        paintShepherd(ctx, x, y, size, s.dir, s.stepT, s.walking, s.i === 0 && sim.lamb.state === 'carried', this.shepherdLook(s));
      }
      ctx.globalAlpha = 1;
      if (s.i === 0) {
        // the player's marker: a soft ring at his feet in his dye
        ctx.strokeStyle = 'rgba(238,123,48,.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x, y + S * 0.05, S * 0.55, S * 0.42, 0, 0, TAU);
        ctx.stroke();
      }
    }
  }

  private cloud(x: number, y: number): void {
    const ctx = this.ctx, S = this.S;
    const k = S * 0.32;
    ctx.fillStyle = 'rgba(120,128,150,.92)';
    for (const [dx, dy, r] of [[-0.9, 0, 0.7], [0, -0.35, 0.9], [0.9, 0, 0.7], [0, 0.2, 0.8]] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * k, y + dy * k, r * k, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(110,160,230,.85)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const dx = (i - 1) * k * 0.7, ph = (this.clock * 2 + i * 0.33) % 1;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + k * (0.8 + ph * 1.2));
      ctx.lineTo(x + dx - 2, y + k * (1.2 + ph * 1.2));
      ctx.stroke();
    }
  }

  private drawDog(sim: PasterzSim): void {
    const d = sim.dog;
    if (!this.visible(d.x, d.y, 2 * this.S)) return;
    const run = clamp(Math.hypot(d.vx, d.vy) / 5);
    paintDog(this.ctx, this.sx(d.x), this.sy(d.y), this.S * 0.95, d.dir, run, this.clock, this.dogCoat[0], this.dogCoat[1]);
    if (d.bark > 0) {
      const ctx = this.ctx, x = this.sx(d.x + Math.cos(d.dir) * 0.6), y = this.sy(d.y + Math.sin(d.dir) * 0.6);
      ctx.strokeStyle = `rgba(255,255,255,${(d.bark * 1.4).toFixed(3)})`;
      ctx.lineWidth = 2;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(x, y, this.S * 0.3 * i * (1.6 - d.bark), d.dir - 0.6, d.dir + 0.6);
        ctx.stroke();
      }
    }
  }

  private drawPulses(): void {
    const ctx = this.ctx, S = this.S;
    for (const p of this.pulses) {
      const k = ease.outCubic(p.t / p.dur);
      const r = (p.r0 + (p.r1 - p.r0) * k) * S;
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = p.width;
      ctx.beginPath();
      ctx.arc(this.sx(p.x), this.sy(p.y), r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  private drawNight(sim: PasterzSim): void {
    const k = sim.night;
    if (k <= 0.02) return;
    const ctx = this.ctx, S = this.S;
    ctx.save();
    ctx.fillStyle = `rgba(16,22,52,${(0.62 * k).toFixed(3)})`;
    ctx.fillRect(-20, -20, this.w + 40, this.h + 40);
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fires) {
      if (!this.visible(f.x, f.y, 5 * S)) continue;
      const x = this.sx(f.x), y = this.sy(f.y), r = S * (3.2 + Math.sin(this.clock * 9 + f.x) * 0.15);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,170,70,${(0.42 * k).toFixed(3)})`);
      g.addColorStop(1, 'rgba(255,170,70,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** The counts over the shepherds (Crowd City's numbers), the rivals' names, the crown, and the rivals' bubbles. */
  private drawLabels(sim: PasterzSim): void {
    const ctx = this.ctx, S = this.S, u = this.L.u;
    const said: { x: number; y: number }[] = [];
    for (const s of sim.shepherds) {
      if (!this.visible(s.x, s.y, 3 * S)) continue;
      const x = this.sx(s.x), y = this.sy(s.y) - S * 0.95;
      // under the runner's HUD the off-screen arrows speak for them
      if (y < this.L.top + 8 && s.i !== 0) continue;
      if (s.out) {
        ctx.font = font(700, 11 * u, SANS);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillText(`${s.name} · ${t('ui.out')}`, x, y - S * 0.9);
        continue;
      }
      const n = s.i === 0 ? s.n : s.n;
      paintCount(ctx, x, y, String(n), s.i === 0 ? PLAYER_DYE : s.dye, (s.i === 0 ? 14 : 12.5) * u);
      if (s.i !== 0) {
        ctx.font = font(700, 10.5 * u, SANS);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = 'rgba(40,30,20,.55)';
        ctx.fillText(s.name, x + 1, y - 12 * u + 1);
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(s.name, x, y - 12 * u);
      }
      if (sim.crown === s.i) paintCrown(ctx, x, y - (s.i === 0 ? 13 : 23) * u, 18 * u, Math.sin(this.clock * 4) * 1.5);
      // one rival bubble per spot: the next one close by waits its turn
      if (s.say && s.i !== 0 && !said.some(q => Math.abs(q.x - x) < 150 * u && Math.abs(q.y - y) < 44 * u)) {
        said.push({ x, y });
        this.hud.bubble(ctx, s.say.text, x, y - 30 * u, 11 * u, 0.85, s.say.t, this);
      }
    }
  }

  private drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.18 ? ease.outBack(k / 0.18) : 1;
      const x = this.sx(f.x), y = this.sy(f.y) - 40 * ease.outCubic(k);
      ctx.globalAlpha = k > 0.65 ? Math.max(0, 1 - (k - 0.65) / 0.35) : 1;
      ctx.font = font(800, f.size * pop, SANS);
      ctx.fillStyle = 'rgba(40,24,10,.45)';
      ctx.fillText(f.text, x + 1, y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** A star's light falls from the night's row to the straggler it found. */
  private drawShoots(sim: PasterzSim): void {
    const ctx = this.ctx;
    for (const s of this.shoots) {
      const k = clamp(s.t / 0.7);
      const tx = this.sx(s.x), ty = this.sy(s.y);
      const x = s.sx + (tx - s.sx) * ease.outCubic(k), y = s.sy + (ty - s.sy) * ease.outCubic(k);
      ctx.strokeStyle = `rgba(255,240,190,${(0.9 * (1 - clamp((s.t - 0.7) / 0.4))).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.sx + (tx - s.sx) * Math.max(0, ease.outCubic(k) - 0.25), s.sy + (ty - s.sy) * Math.max(0, ease.outCubic(k) - 0.25));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = C.star;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
    }
    void sim;
  }

  // ── effects ────────────────────────────────────────────────────
  private float(text: string, x: number, y: number, color: string, size = 22, dur = 1.2): void {
    // a word over a fresh one stacks above it
    for (const f of this.floats) if (f.t < 0.8 && Math.abs(f.x - x) < 2.5 && Math.abs(f.y - y) < 1.2) y = f.y - 1.3;
    this.floats.push({ text, x, y, t: 0, dur, color, size: size * this.L.u });
    if (this.floats.length > 14) this.floats.shift();
  }

  private pulse(x: number, y: number, r0: number, r1: number, color: string, dur = 0.8, width = 3): void {
    this.pulses.push({ x, y, t: 0, dur, r0, r1, color, width });
  }

  on(e: SimEvent, sim: PasterzSim): void {
    const pl = sim.player, rm = this.opts.reducedMotion;
    switch (e.type) {
      case 'join':
        this.parts.burst(e.x, e.y, 4, { color: '#fffaf0', size: 0.09, speed: 1.6, g: 0, drag: 3, life: 0.5 });
        if (e.who === 0) {
          this.joinAcc++;
          if (this.joinT <= 0) this.joinT = 0.35;
        }
        break;
      case 'steal': {
        const col = sim.shepherds[e.to]?.dye ?? '#fff';
        this.parts.burst(e.x, e.y, 5, { color: col, size: 0.08, speed: 2.2, g: 0, drag: 3, life: 0.5, shape: 'spark' });
        if (e.to === 0) {
          this.joinAcc++;
          if (this.joinT <= 0) this.joinT = 0.35;
        } else if (e.from === 0) {
          this.lossAcc++;
          if (this.lossT <= 0) this.lossT = 0.4;
        }
        break;
      }
      case 'out':
        this.parts.burst(e.x, e.y, 18, { color: '#e8e2d0', size: 0.14, speed: 2.4, g: 0, drag: 2, life: 0.8 });
        this.float(t('fx.out'), e.x, e.y - 1.6, '#fff', 20);
        if (e.by === 0) {
          this.shake.add(0.3);
          this.stop = 0.07;
        }
        break;
      case 'tumble':
        this.parts.burst(e.x, e.y, 20, { color: '#d8c8a0', size: 0.16, speed: 2.6, g: 0, drag: 2, life: 0.9 });
        this.parts.burst(e.toX, e.toY, 12, { color: '#fff6dc', size: 0.1, speed: 1.8, g: 0, drag: 2.5, life: 0.7, shape: 'ring' });
        this.float(t('fx.tumble'), e.toX, e.toY - 1.4, '#fff6dc', 24);
        this.camX = e.toX;
        this.camY = e.toY;
        this.shake.add(0.25);
        break;
      case 'whistle':
        this.pulse(pl.x, pl.y, 0.4, 2, 'rgba(255,255,255,.8)', 0.5, 2);
        if (!e.herd && sim.asleep && this.clock - this.lastShh > 4) {
          this.lastShh = this.clock;
          this.float(t('fx.shh'), pl.x, pl.y - 1.5, '#cfe0ff', 18);
        }
        break;
      case 'herd':
        this.float(`+${e.n}`, e.x, e.y - 1, '#fff6dc', 20);
        this.pulse(e.x, e.y, 0.3, RULES.herdR, 'rgba(255,246,220,.85)', 0.5, 2);
        break;
      case 'voice':
        this.pulse(pl.x, pl.y, sim.ringR, RULES.voiceR, 'rgba(255,214,90,.9)', 1.4, 5);
        this.pulse(pl.x, pl.y, sim.ringR * 0.6, RULES.voiceR * 0.8, 'rgba(255,246,220,.7)', 1.7, 3);
        this.float(t('fx.voice'), pl.x, pl.y - 2, '#ffd65a', 30, 1.6);
        if (!rm) this.shake.add(0.35);
        this.stop = 0.08;
        break;
      case 'bleat':
        if (this.visible(e.x, e.y, 0)) this.float(t('fx.bee'), e.x, e.y - 1, '#fff6dc', 16, 1);
        break;
      case 'lambFound':
        this.parts.burst(e.x, e.y, 26, { color: '#ffe08a', size: 0.1, speed: 3, g: 0, drag: 2, life: 1.1, shape: 'spark' });
        this.float(t('fx.lamb'), e.x, e.y - 1.8, '#ffe08a', 26, 1.8);
        this.stop = 0.08;
        this.shake.add(0.2);
        break;
      case 'crown':
        if (e.who === 0) {
          this.float(t('fx.crown'), pl.x, pl.y - 2.2, '#ffd65a', 26, 1.4);
          this.parts.burst(pl.x, pl.y - 1, 16, { color: '#ffd65a', size: 0.09, speed: 2.4, g: 0, drag: 2, life: 0.9, shape: 'spark' });
        }
        break;
      case 'newRound':
        this.camX = pl.x;
        this.camY = pl.y;
        this.fires = [];
        this.parts.clear();
        this.floats.length = 0;
        this.pulses.length = 0;
        break;
      case 'blockStart':
        if (e.block.kind === 'watch') {
          this.placeFires(sim);
          this.float(t('fx.night'), pl.x, pl.y - 2, '#cfe0ff', 22, 1.6);
        }
        break;
      case 'blockEnd':
        if (e.block.kind === 'watch') this.float(t('fx.dawn'), pl.x, pl.y - 2, '#ffe6b0', 22, 1.4);
        break;
      case 'star': {
        const slot = this.hud.starSlot(e.n - 1, this);
        this.shoots.push({ sx: slot.x, sy: slot.y, x: e.x, y: e.y, t: 0 });
        break;
      }
      case 'morning':
        this.float(t('fx.morning', { lambs: t('lambs', { n: e.n }) }), pl.x, pl.y - 2.4, '#fff6dc', 20, 1.8);
        break;
      case 'flare':
        this.pulse(pl.x, pl.y, RULES.r0, e.r, 'rgba(255,214,90,.95)', 1.2, 5);
        this.float(t('fx.flare', { n: Math.round(e.share * 100) }), pl.x, pl.y - 2.2, '#ffd65a', 22, 1.6);
        break;
      case 'unlock':
        this.float(t('fx.unlock', { name: t(`skin.${e.kind}.${e.index}` as 'skin.cloak.0') }), pl.x, pl.y - 3, '#fff6dc', 18, 2.2);
        break;
      case 'hundred':
        this.float(t('fx.hundred', { n: e.season + 1 }), pl.x, pl.y - 3.4, '#ffe08a', 22, 2.2);
        break;
      case 'roundEnd':
        this.parts.burst(pl.x, pl.y, 30, { color: '#ffe08a', size: 0.1, speed: 3.5, g: 0, drag: 2, life: 1.2, shape: 'spark' });
        break;
      default:
        break;
    }
  }
}
