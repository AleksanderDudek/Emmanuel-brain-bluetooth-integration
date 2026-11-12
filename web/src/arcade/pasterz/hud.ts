/**
 * Pasterz's own screen things, over the hill (the runner draws the band's panel and the score), sized for a
 * 360 px phone at u = 1 (layout.ts): nothing is drawn under MIN_TEXT, and what the player reads to play is
 * at least MIN_READ (DESIGN §12.2).
 *
 *   the ranking     Crowd City's live top list under the score: the top three and the player, each
 *                   flock's dye and count, the crown; its header names the pasture and its clock
 *   the arrows      rival flocks off screen, at the edge (clear of the ranking and Łatek's button), in
 *                   their dye with their count
 *   the compass     the lost lamb's direction after the Głos and while it bleats
 *   the stars       the night's row of twelve: each lit star is a straggler fetched
 *   the joystick    from the touch-down: its base where the finger went down (it trails a finger that runs
 *                   past its rim), its knob under the finger, a wedge on the rim toward the walk
 *   Łatek's button  the whistle in the thumb zone: pressed at the touch, its cool-down on the rim, a soft
 *                   pulse while loose sheep are in his reach; it steps aside in a night and on the tally
 *   Łatek's bubble  short lines over the dog, never over a telegraph, the banner or his button (talk.ts)
 *   the tally card  at dawn after a round: the place, the flock, the bonuses, the near miss, the
 *                   wardrobe's next piece and the next hill with its line of story
 */
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ, fitText } from '../kit/mobile';
import { wrapLines } from '../kit/scripture';
import { PLAYER_DYE } from './content';
import { sheep, t } from './i18n';
import { RANK_HEAD, RANK_ROW } from './layout';
import { C, SANS, SERIF, font, paintCrown, paintDog, paintStar } from './paint';
import type { PasterzView, Stick } from './render';
import { RULES } from './rules';
import type { PasterzSim } from './sim';

const TAU = Math.PI * 2;

const mmss = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
};

export class PasterzHud {
  private cardT = 0;
  private cardOf = -1;
  /** Łatek's button: shown (0..1), held down by a finger, its pop after a whistle and its shake when not ready */
  private btnK = 0;
  pressed = false;
  private pop = 0;
  private wob = 0;
  /** loose sheep in Łatek's reach (the button pulses), looked up a few times a second */
  private near = false;
  private nearT = 0;
  /** the joystick: shown (0..1), and where it was when the finger lifted (it fades out there) */
  private stickK = 0;
  private stickLast: Stick | null = null;
  private clock = 0;
  /** the ranking steps back (faded) while a coach mark speaks over the top band, until this session time */
  quietRankUntil = 0;
  private rankK = 1;
  /** the edge markers drawn this frame (they keep apart) */
  private readonly placed: { x: number; y: number }[] = [];

  update(dt: number, sim: PasterzSim, view: PasterzView): void {
    this.clock += dt;
    const show = this.cardShown(sim);
    if (show && sim.tally && this.cardOf !== sim.tally.round) {
      this.cardOf = sim.tally.round;
      this.cardT = 0;
    }
    this.cardT += dt;
    this.btnK = approach(this.btnK, this.whistleOn(sim) ? 1 : 0, dt, 0.07);
    this.rankK = approach(this.rankK, sim.t < this.quietRankUntil ? 0.15 : 1, dt, 0.1);
    if (this.btnK < 0.5) this.pressed = false;
    this.pop = Math.max(0, this.pop - dt * 4);
    this.wob = Math.max(0, this.wob - dt);
    this.nearT -= dt;
    if (this.nearT <= 0) {
      this.nearT = 0.25;
      this.near = this.looseInReach(sim);
    }
    if (view.stick) this.stickLast = view.stick;
    this.stickK = approach(this.stickK, view.stick ? 1 : 0, dt, view.stick ? 0.03 : 0.06);
    if (!view.stick && this.stickK < 0.02) this.stickLast = null;
  }

  private cardShown(sim: PasterzSim): boolean {
    return !!sim.tally && (sim.tallyT > 0 || sim.phase !== 'play');
  }

  /** Łatek's button is on screen: in play, by day, with no tally card. */
  whistleOn(sim: PasterzSim): boolean {
    return sim.started && sim.phase === 'play' && !sim.frozen && !sim.asleep;
  }

  /** How much of Łatek's button is on screen (0..1): the world's labels give way to it. */
  get buttonK(): number { return this.btnK; }

  /** Łatek's button takes taps now (shown, not fading). */
  whistleLive(sim: PasterzSim): boolean { return this.whistleOn(sim) && this.btnK > 0.5; }

  /** A whistle went out (the button pops), or a tap came too soon (it shakes). */
  whistled(): void { this.pop = 1; }
  notReady(): void { this.wob = 0.3; }

  private looseInReach(sim: PasterzSim): boolean {
    const pl = sim.player, R2 = RULES.dogReach * RULES.dogReach;
    for (const s of sim.sheep) {
      if (s.owner !== -1) continue;
      const dx = s.x - pl.x, dy = s.y - pl.y;
      if (dx * dx + dy * dy < R2) return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const L = view.L;
    const night = sim.night > 0.5;
    const card = this.cardShown(sim);
    // in a night the row of stars takes the top band where it would cover the ranking
    if (!card && !(night && L.stars.x + L.stars.w > L.rank.x - 4)) this.ranking(ctx, sim, view);
    if (!card) {
      this.arrows(ctx, sim, view);
      this.compass(ctx, sim, view);
    }
    if (sim.night > 0.1) this.stars(ctx, sim, view);
    this.button(ctx, sim, view);
    this.talk(ctx, sim, view);
    this.joystick(ctx, sim, view);
    if (card) this.card(ctx, sim, view);
  }

  // ── the ranking ────────────────────────────────────────────────
  private ranking(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const L = view.L, r = L.rank, u = L.u;
    const order = sim.ranking();
    const me = order.findIndex(s => s.i === 0);
    const rows = order.slice(0, 3);
    if (me >= 3) rows.push(order[me]);
    const rowH = RANK_ROW * u, headH = RANK_HEAD * u, pad = 10 * u;
    const h = headH + rows.length * rowH + 6 * u;
    ctx.save();
    ctx.globalAlpha = this.rankK;
    ctx.fillStyle = 'rgba(30,26,18,.6)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, h, 12 * u);
    ctx.fill();
    ctx.textBaseline = 'middle';
    // the header: the pasture, and its clock
    const hy = r.y + headH / 2 + 2 * u;
    const clock = sim.phase === 'play' ? mmss(sim.roundLeft) : '0:00';
    ctx.font = font(800, 13.5 * u, SANS);
    const cw = ctx.measureText(clock).width;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff3c4';
    ctx.fillText(clock, r.x + r.w - pad, hy);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,248,226,.85)';
    const head = fitText(ctx, t('ui.round', { n: sim.roundIndex + 1, of: sim.roundsPlanned }), r.w - 2 * pad - cw - 6 * u, 13 * u, 700, SANS, 12);
    ctx.fillText(head, r.x + pad, hy);
    rows.forEach((s, k) => {
      const y = r.y + headH + k * rowH + rowH / 2 + 2 * u;
      const place = order.indexOf(s) + 1;
      const mine = s.i === 0;
      if (mine) {
        ctx.fillStyle = 'rgba(238,123,48,.38)';
        ctx.beginPath();
        ctx.roundRect(r.x + 4 * u, y - rowH / 2 + 1, r.w - 8 * u, rowH - 2, 7 * u);
        ctx.fill();
      }
      ctx.globalAlpha = (s.out ? 0.55 : 1) * this.rankK;
      ctx.textAlign = 'left';
      ctx.font = font(800, 13 * u, SANS);
      ctx.fillStyle = '#fff8e2';
      ctx.fillText(String(place), r.x + pad, y);
      ctx.fillStyle = mine ? PLAYER_DYE : s.dye;
      ctx.beginPath();
      ctx.arc(r.x + pad + 17 * u, y, 5.5 * u, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // the count at the right, the crown beside it, the name in what is left
      const n = String(s.n);
      ctx.font = font(800, 14 * u, SANS);
      const nw = ctx.measureText(n).width, col = Math.max(nw, ctx.measureText('000').width);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff8e2';
      ctx.fillText(n, r.x + r.w - pad, y);
      const crown = sim.crown === s.i;
      if (crown) paintCrown(ctx, r.x + r.w - pad - nw - 10 * u, y + 5 * u, 14 * u);
      const x0 = r.x + pad + 26 * u;
      const room = r.x + r.w - pad - col - 20 * u - x0;
      ctx.textAlign = 'left';
      const name = fitText(ctx, mine ? t('ui.you') : s.name, room, 13 * u, mine ? 800 : 650, SANS, 12);
      ctx.fillText(name, x0, y);
      ctx.globalAlpha = this.rankK;
    });
    ctx.restore();
  }

  /**
   * Where a thing off screen shows at the room's edge (below the HUD, above the bottom), toward it from the
   * shepherd; never over the ranking or Łatek's button.  Null when it is in sight.
   */
  private edge(view: PasterzView, sim: PasterzSim, x: number, y: number, pad: number): { x: number; y: number; a: number } | null {
    const L = view.L;
    // from the shepherd where he stands on the screen (off the middle near the hill's edge)
    const cx = clamp(view.sx(sim.player.x), L.left + pad, L.right - pad), cy = clamp(view.sy(sim.player.y), L.top + pad, L.bottom - pad);
    const x0 = L.left + pad, x1 = L.right - pad, y0 = L.top + pad, y1 = L.bottom - pad;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return null;
    const dx = x - cx, dy = y - cy;
    const a = Math.atan2(dy, dx);
    let k = Infinity;
    if (dx > 0) k = Math.min(k, (x1 - cx) / dx);
    if (dx < 0) k = Math.min(k, (x0 - cx) / dx);
    if (dy > 0) k = Math.min(k, (y1 - cy) / dy);
    if (dy < 0) k = Math.min(k, (y0 - cy) / dy);
    let ex = cx + dx * k, ey = cy + dy * k;
    const r = L.rank;
    if (ex > r.x - pad && ey < r.y + r.h + pad) ey = Math.max(ey, r.y + r.h + pad);
    const b = L.whistle.hit;
    if (this.btnK > 0.02 && ex > b.x - pad && ey > b.y - pad) {
      // beside the button: above it on the right edge, left of it on the bottom edge
      if (ex - (b.x - pad) < ey - (b.y - pad)) ex = b.x - pad;
      else ey = b.y - pad;
    }
    ex = clamp(ex, x0, x1);
    ey = clamp(ey, y0, y1);
    return { x: ex, y: ey, a };
  }

  private arrows(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    this.placed.length = 0;
    if (sim.night > 0.5) return;
    const u = view.L.u, pad = 24 * u;
    for (const s of sim.shepherds) {
      if (s.i === 0 || s.out) continue;
      const p = this.edge(view, sim, view.sx(s.x), view.sy(s.y), pad);
      if (!p) continue;
      this.apart(view, p, pad);
      this.marker(ctx, p.x, p.y, p.a, s.dye, String(s.n), u);
    }
  }

  /**
   * Two markers off the same stretch of edge: the later one slides along it to the nearest free spot, first
   * toward where its thing is, never onto Łatek's button.
   */
  private apart(view: PasterzView, p: { x: number; y: number; a: number }, pad: number): void {
    const L = view.L, gap = 32 * L.u, b = L.whistle.hit;
    const upright = p.x <= L.left + pad + 1 || p.x >= L.right - pad - 1;
    const taken = (x: number, y: number) =>
      this.placed.some(q => Math.hypot(q.x - x, q.y - y) < gap) || (this.btnK > 0.02 && x > b.x - pad && y > b.y - pad);
    if (taken(p.x, p.y)) {
      const dir = upright ? (Math.sin(p.a) >= 0 ? 1 : -1) : (Math.cos(p.a) >= 0 ? 1 : -1);
      search: for (let k = 1; k <= 6; k++) {
        for (const s of [dir, -dir]) {
          const x = upright ? p.x : clamp(p.x + s * k * gap, L.left + pad, L.right - pad);
          const y = upright ? clamp(p.y + s * k * gap, L.top + pad, L.bottom - pad) : p.y;
          if (!taken(x, y)) {
            p.x = x;
            p.y = y;
            break search;
          }
        }
      }
    }
    this.placed.push(p);
  }

  private marker(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, text: string, u: number): void {
    const r = 15 * u;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r + 8 * u, 0);
    ctx.lineTo(r - 2 * u, -7 * u);
    ctx.lineTo(r - 2 * u, 7 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(800, (text.length > 2 ? 13 : 14) * u, SANS);
    ctx.fillText(text, 0, 0.5);
    ctx.restore();
  }

  private compass(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const l = sim.lamb;
    if (l.state !== 'hidden' || sim.night > 0.5) return;
    const on = sim.compassT > 0 || l.bleat > 0;
    if (!on) return;
    const u = view.L.u;
    const p = this.edge(view, sim, view.sx(l.x), view.sy(l.y), 28 * u);
    if (!p) return;
    this.apart(view, p, 28 * u);
    const pulse = 1 + Math.sin(view.clock * 8) * 0.08;
    ctx.save();
    ctx.globalAlpha = sim.compassT > 0 ? 1 : clamp(l.bleat * 1.2);
    this.marker(ctx, p.x, p.y, p.a, '#f2cc8f', '?', u * pulse);
    ctx.font = font(800, 13 * u, SANS);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const ty = p.y > view.L.bottom - 60 * u ? p.y - 27 * u : p.y + 27 * u;
    ctx.fillStyle = 'rgba(40,30,20,.55)';
    ctx.fillText(t('fx.bee'), p.x + 1, ty + 1);
    ctx.fillStyle = '#fff6dc';
    ctx.fillText(t('fx.bee'), p.x, ty);
    ctx.restore();
  }

  /** Where the i-th star of the night's row sits (screen px). */
  starSlot(i: number, view: PasterzView): { x: number; y: number } {
    const s = view.L.stars, n = RULES.starMax;
    const k = (i + 0.5) / n;
    return { x: s.x + s.w * k, y: s.y + s.h * 0.5 + Math.sin(k * Math.PI) * -6 * view.L.u };
  }

  private stars(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const a = clamp((sim.night - 0.1) / 0.6);
    const box = view.L.stars, u = view.L.u;
    ctx.fillStyle = `rgba(10,14,36,${(0.45 * a).toFixed(3)})`;
    ctx.beginPath();
    ctx.roundRect(box.x - 8 * u, box.y - 6 * u, box.w + 16 * u, box.h + 6 * u, box.h);
    ctx.fill();
    for (let i = 0; i < RULES.starMax; i++) {
      const p = this.starSlot(i, view);
      const lit = i < sim.stars;
      const tw = lit ? 1 + Math.sin(view.clock * 3 + i) * 0.12 : 1;
      if (lit) paintStar(ctx, p.x, p.y, 8 * u * tw, a);
      else {
        ctx.fillStyle = `rgba(220,226,255,${(0.6 * a).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * u, 0, TAU);
        ctx.fill();
      }
    }
  }

  // ── the hands ──────────────────────────────────────────────────
  /**
   * The floating joystick, shown from the touch-down: a dark base with a light rim where the finger went down
   * (full speed at its rim), and the knob under the finger (held inside the rim), with a wedge on the rim
   * toward where the shepherd walks once the drag steers.  It fades out where the finger lifted.
   */
  private joystick(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const st = view.stick ?? this.stickLast;
    if (!st || this.stickK < 0.02 || sim.asleep || sim.frozen) return;
    const R = RULES.stickPx;
    const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), c = d > R ? R / d : 1;
    const kx = st.ox + dx * c, ky = st.oy + dy * c;
    ctx.save();
    ctx.globalAlpha = this.stickK;
    ctx.fillStyle = 'rgba(30,22,14,.3)';
    ctx.strokeStyle = 'rgba(255,250,232,.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(st.ox, st.oy, R, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,250,232,.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(st.ox, st.oy, R * 0.5, 0, TAU);
    ctx.stroke();
    if (st.on && d > 4) {
      const a = Math.atan2(dy, dx);
      ctx.strokeStyle = '#ffd67a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(st.ox, st.oy, R, a - 0.42, a + 0.42);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,22,14,.3)';
    ctx.beginPath();
    ctx.arc(kx, ky + 3, R * 0.44, 0, TAU);
    ctx.fill();
    ctx.fillStyle = st.on ? 'rgba(255,250,232,.95)' : 'rgba(255,250,232,.8)';
    ctx.strokeStyle = 'rgba(43,33,24,.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kx, ky, R * 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Łatek's button: a dark disc with the dog on it, the whistle's cool-down sweeping its rim (gold when ready). */
  private button(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    if (this.btnK < 0.02) return;
    const L = view.L, b = L.whistle, u = L.u, R = b.r, now = this.clock;
    const cool = clamp(sim.whistleCool / RULES.whistleCool);
    const ready = cool <= 0;
    const live = ready && this.near;
    const shake = this.wob > 0 ? Math.sin(now * 46) * 4 * u * (this.wob / 0.3) : 0;
    const k = (this.pressed ? 0.9 : 1 + 0.12 * this.pop + (live ? 0.03 * Math.sin(now * 5) : 0)) * (0.7 + 0.3 * this.btnK);
    ctx.save();
    ctx.globalAlpha = this.btnK;
    ctx.translate(b.x + shake, b.y);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(20,14,8,.3)';
    ctx.beginPath();
    ctx.arc(0, 3, R, 0, TAU);
    ctx.fill();
    ctx.fillStyle = this.pressed ? 'rgba(20,14,8,.92)' : 'rgba(40,31,22,.84)';
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,248,230,.18)';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(0, 0, R - 4 * u, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = ready ? C.gold : 'rgba(255,248,230,.9)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, R - 4 * u, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cool));
    ctx.stroke();
    if (live) {
      ctx.strokeStyle = `rgba(255,231,163,${(0.45 + 0.45 * Math.sin(now * 5)).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, R + 3 + 3 * Math.sin(now * 5), 0, TAU);
      ctx.stroke();
    }
    // Łatek, ears up, and the whistle's call over him when he can go
    ctx.globalAlpha = this.btnK * (ready ? 1 : 0.55);
    paintDog(ctx, -R * 0.03, R * 0.06, R * 1.45, -Math.PI / 2, 0, now, view.dogCoat[0], view.dogCoat[1]);
    if (ready) {
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 2.2 * u;
      ctx.lineCap = 'round';
      for (const [rr, al] of [[0.2, 0.95], [0.34, 0.7]] as const) {
        ctx.globalAlpha = this.btnK * al;
        ctx.beginPath();
        ctx.arc(R * 0.08, -R * 0.46, R * rr, -1.25, -0.25);
        ctx.stroke();
      }
    }
    ctx.restore();
    // the word under it, on a plate (the grass is busy)
    ctx.save();
    ctx.globalAlpha = this.btnK;
    ctx.font = font(800, MIN_READ * Math.min(u, 1.15), SANS);
    const word = fitText(ctx, t('ui.whistle'), b.hit.w + 12 * u, MIN_READ * Math.min(u, 1.15), 800, SANS, 12);
    const tw = ctx.measureText(word).width;
    const ly = b.y + R + 4 + 9 * u;
    ctx.fillStyle = 'rgba(30,22,14,.62)';
    ctx.beginPath();
    ctx.roundRect(b.x - tw / 2 - 7 * u, ly - 9 * u, tw + 14 * u, 18 * u, 9 * u);
    ctx.fill();
    ctx.fillStyle = ready ? '#fff3c4' : 'rgba(255,248,230,.78)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, b.x, ly + 0.5);
    ctx.restore();
  }

  // ── speech bubbles ─────────────────────────────────────────────
  /** A drawn speech bubble with its tail down to (x, y), kept in the field (clear of the HUD and Łatek's button); fades in and out over its life. */
  bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha: number, age: number, view: PasterzView, maxW = 220): void {
    const L = view.L;
    ctx.save();
    ctx.font = font(650, size, SANS);
    const lines = wrapLines(ctx, text, Math.min(maxW * L.u, L.right - L.left - 32));
    const lh = size * 1.3, pad = size * 0.7;
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2;
    const h = lines.length * lh + pad * 1.2;
    const bx = clamp(x - w / 2, L.left + 8, L.right - 8 - w);
    // over the button's column the bubble stays above it; elsewhere it may come down to the bottom
    const floor = bx + w > L.whistle.hit.x - 6 && this.btnK > 0.02 ? L.field.bottom : L.bottom - 8;
    const by = clamp(y - h - 10, L.field.top + 4, Math.max(L.field.top + 4, floor - h - 12));
    const pop = age < 0.18 ? ease.outBack(age / 0.18) : 1;
    ctx.globalAlpha = alpha * Math.min(1, age * 6);
    ctx.translate(bx + w / 2, by + h);
    ctx.scale(pop, pop);
    ctx.translate(-(bx + w / 2), -(by + h));
    ctx.fillStyle = 'rgba(255,250,236,.96)';
    ctx.strokeStyle = 'rgba(60,44,28,.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bx, by, w, h, size * 0.8);
    ctx.fill();
    ctx.stroke();
    const tx = clamp(x, bx + 14, bx + w - 14);
    if (y > by + h) {
      ctx.beginPath();
      ctx.moveTo(tx - 7, by + h - 1);
      ctx.lineTo(clamp(x, tx - 12, tx + 12), Math.min(y, by + h + 12));
      ctx.lineTo(tx + 7, by + h - 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = C.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, bx + w / 2, by + pad * 0.6 + lh * (i + 0.5)));
    ctx.restore();
  }

  private talk(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const line = sim.talk.line;
    if (!line || this.cardShown(sim)) return;
    const d = sim.dog;
    const fade = line.dur - line.t < 0.3 ? (line.dur - line.t) / 0.3 : 1;
    this.bubble(ctx, line.text, view.sx(d.x), view.sy(d.y) - view.S * 0.4, 14.5 * view.L.u, fade, line.t, view, view.L.tall ? 230 : 260);
  }

  // ── the tally card ─────────────────────────────────────────────
  /**
   * The round's tally, a sheet from the bottom that keeps under the runner's banner (a round ends where the
   * next block begins): the crown or the dawn's hill, the place, the flock and its bonuses, the total, the near
   * miss, the wardrobe's next piece, and the next hill with its line of story.  One column on a phone held
   * upright, two on a wider screen; as tall as its rows need, the story's lines dropped first when room is short.
   */
  private card(ctx: CanvasRenderingContext2D, sim: PasterzSim, view: PasterzView): void {
    const tl = sim.tally!;
    const L = view.L, room = L.card, u = L.u;
    const first = tl.place === 1 && tl.flock > 0;
    const count = (v: number) => Math.round(v * ease.outCubic(clamp((this.cardT - 0.3) / 0.9)));
    const rows: [string, string][] = [[t('tally.flock'), String(count(tl.flock))]];
    if (tl.crown > 0) rows.push([t('tally.bonus'), `+${count(tl.crown)}`]);
    if (tl.lamb > 0) rows.push([t('tally.lamb', { name: tl.lambName ?? '' }), `+${count(tl.lamb)}`]);
    const near = tl.toFirst > 0 ? t('tally.toFirst', { sheep: sheep(tl.toFirst) }) : null;
    const unlock = tl.unlock;
    const tail = tl.next ? `${t('tally.next', { hill: tl.next.name })} — ${tl.next.story}` : t('tally.final');
    const wide = L.cardWide;
    const pad = 22 * u;
    // the columns: one (the whole card) or two (the result on the left, the rest on the right)
    const lw = wide ? Math.round(room.w * 0.4) : room.w;
    const rx = wide ? room.x + lw : room.x, rw = wide ? room.w - lw : room.w;
    const head = (first ? 22 : 0) + 25 + 23;
    const score = 26;
    const extra = (near ? 21 : 0) + (unlock ? 35 : 0);
    ctx.font = font(500, 14 * u, SERIF, true);
    let lines = wrapLines(ctx, tail, rw - 2 * pad).slice(0, wide || L.w < 600 ? 2 : 3);
    const need = (k: number) => (wide
      ? 16 + Math.max(head + score + 8, rows.length * 21 + extra + k * 18) + 10
      : 16 + head + rows.length * 21 + 4 + score + extra + k * 18 + 10) * u;
    while (lines.length && need(lines.length) > room.h) lines = lines.slice(0, -1);
    const h = Math.min(room.h, need(lines.length));
    const box = { x: room.x, y: room.y + room.h - h, w: room.w, h };
    const k = ease.outBack(clamp(this.cardT / 0.35));
    const fadeOut = sim.phase === 'play' ? clamp(sim.tallyT / 0.35) : 1;
    ctx.save();
    ctx.globalAlpha = fadeOut;
    // it rises from the bottom
    ctx.translate(0, (1 - k) * 40 * u);
    ctx.fillStyle = 'rgba(30,22,12,.35)';
    ctx.beginPath();
    ctx.roundRect(box.x + 3, box.y + 5, box.w, box.h, 18 * u);
    ctx.fill();
    const g = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    g.addColorStop(0, '#fbf3df');
    g.addColorStop(1, '#efe0bd');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,60,.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textBaseline = 'middle';
    // the result: the crown or the dawn, the place, the total
    const lx = box.x + lw / 2;
    let y = box.y + 16 * u + 10 * u;
    ctx.textAlign = 'center';
    if (first) {
      paintCrown(ctx, lx, y + 6 * u, 28 * u, Math.sin(view.clock * 4) * 1.5);
      y += 22 * u;
    }
    ctx.fillStyle = C.ink;
    ctx.fillText(fitText(ctx, first ? t('tally.first') : t('tally.dawn', { hill: tl.hill.name }), lw - 2 * pad, 20 * u, 600, SERIF, 15), lx, y);
    y += 25 * u;
    ctx.font = font(800, 14 * u, SANS);
    ctx.fillStyle = first ? C.goldDeep : '#7a5a34';
    ctx.fillText(fitText(ctx, t('tally.place', { n: tl.place, of: tl.of }), lw - 2 * pad, 14 * u, 800, SANS, MIN_READ), lx, y);
    y += 23 * u;
    const total = (yy: number, x0: number, x1: number) => {
      ctx.font = font(800, 16 * u, SANS);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#b5521b';
      const v = String(count(tl.score));
      ctx.fillText(v, x1, yy);
      const vw = ctx.measureText(v).width;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5b4630';
      ctx.fillText(fitText(ctx, t('tally.score'), x1 - x0 - vw - 10 * u, 16 * u, 800, SANS, MIN_READ), x0, yy);
    };
    if (wide) {
      total(y + 8 * u, box.x + pad, box.x + lw - pad);
      ctx.strokeStyle = 'rgba(120,90,50,.25)';
      ctx.beginPath();
      ctx.moveTo(rx, box.y + 14 * u);
      ctx.lineTo(rx, box.y + box.h - 14 * u);
      ctx.stroke();
      y = box.y + 16 * u + 10 * u;
    }
    // the rows: the flock and its bonuses (and, in one column, the total under a line)
    const x0 = rx + pad, x1 = rx + rw - pad;
    for (const [label, value] of rows) {
      ctx.font = font(700, 14 * u, SANS);
      const vw = ctx.measureText(value).width;
      ctx.textAlign = 'right';
      ctx.fillStyle = C.ink;
      ctx.fillText(value, x1, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#5b4630';
      ctx.fillText(fitText(ctx, label, x1 - x0 - vw - 10 * u, 14 * u, 600, SANS, MIN_READ), x0, y);
      y += 21 * u;
    }
    if (!wide) {
      ctx.strokeStyle = 'rgba(120,90,50,.3)';
      ctx.beginPath();
      ctx.moveTo(x0 - 4 * u, y - 9 * u);
      ctx.lineTo(x1 + 4 * u, y - 9 * u);
      ctx.stroke();
      y += 4 * u;
      total(y, x0, x1);
      y += score * u;
    }
    // the near miss, the wardrobe, the next hill
    const mid = rx + rw / 2;
    ctx.textAlign = 'center';
    if (near) {
      ctx.fillStyle = '#8a4a2a';
      ctx.fillText(fitText(ctx, near, rw - 2 * pad, 13.5 * u, 700, SANS, MIN_READ), mid, y);
      y += 21 * u;
    }
    if (unlock) {
      ctx.fillStyle = '#5b4630';
      ctx.fillText(fitText(ctx, t('tally.unlock', { sheep: sheep(unlock.left) }), rw - 2 * pad, 13.5 * u, 650, SANS, MIN_READ), mid, y);
      y += 13 * u;
      const bw = rw - 2 * pad - 16 * u;
      ctx.fillStyle = 'rgba(120,90,50,.2)';
      ctx.beginPath();
      ctx.roundRect(mid - bw / 2, y, bw, 7 * u, 3.5 * u);
      ctx.fill();
      ctx.fillStyle = '#e39a3b';
      ctx.beginPath();
      ctx.roundRect(mid - bw / 2, y, Math.max(7 * u, bw * unlock.share * clamp(this.cardT / 1.2)), 7 * u, 3.5 * u);
      ctx.fill();
      y += 22 * u;
    }
    ctx.font = font(500, 14 * u, SERIF, true);
    ctx.fillStyle = '#4a3a28';
    for (const l of lines) {
      ctx.fillText(l, mid, y);
      y += 18 * u;
    }
    ctx.restore();
  }
}
