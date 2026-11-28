/**
 * Dobry bój's HUD on the canvas (DESIGN.md §25, builder B), on `layout()`: the two health bars with the names and the
 * lives as small gloves, the rounds as dots, the slow motion's options (three big buttons in the thumb zone — the label
 * and its sub-line, the chosen one lit and filling with the energy, the coach's pick glowing softly), the "why" line
 * over them with the window's time running out under it, the coach's bubble, the big banner, the referee's count.
 * Every word comes in the view (builder A's catalog, already in the page's language); text is never under 13 px.
 */
import { MIN_READ, fitText } from '../kit/mobile';
import type { Layout } from './layout';
import { C, FONT, TAU, clamp01, font, glow, rgba, rr, smooth, wrap } from './paint';
import type { FightView, FighterView, Option } from './view';

/** What the HUD remembers between frames. */
export interface HudState {
  /** the bars' trailing "lost" part (it follows the health down slowly) */
  ghostMe: number;
  ghostFoe: number;
  /** the count shown and how long it has shown (its pulse) */
  count: number | null;
  countAge: number;
  /** the coach's line shown and its age (its fade) */
  coach: string | null;
  coachAge: number;
  /** the slow motion's time left 0..1 */
  left: number;
  /** the count over the fallen fighter (screen x; the layout's place when absent) */
  countX?: number | null;
}

/** The options' kinds: a defence (calm blue), a counter (gold), an attack (ember). */
export const KIND_COL: Readonly<Record<Option['kind'], string>> = { defense: '#9cc8ff', counter: '#f5c66a', attack: '#ff9a5a' };

const ks = (l: Layout): number => l.k ?? 1;
const px = (l: Layout, n: number): number => Math.max(MIN_READ, Math.round(n * ks(l)));

export function drawHud(ctx: CanvasRenderingContext2D, l: Layout, v: FightView, st: HudState, dt: number, time: number, reduced: boolean): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // the bars' ghosts follow the health down (and jump up with it)
  const follow = (g: number, hp: number): number => (hp >= g ? hp : Math.max(hp, g - dt * 0.35));
  st.ghostMe = follow(st.ghostMe, clamp01(v.player.hp));
  st.ghostFoe = follow(st.ghostFoe, clamp01(v.foe.hp));
  bar(ctx, l, v.player, l.bars.player, false, st.ghostMe);
  bar(ctx, l, v.foe, l.bars.foe, true, st.ghostFoe);
  rounds(ctx, l, v);
  if (v.options.length) {
    why(ctx, l, v, st.left);
    // a level's quick-time choice: its own time over the row while it is open; closed, only the move that goes stays lit
    const closed = !!v.choice && !v.choice.open;
    v.options.slice(0, l.options.length).forEach((o, i) => option(ctx, l, o, l.options[i], v.energy, v.ready, time, reduced, closed && !o.chosen));
    if (v.choice && v.choice.open) choiceTime(ctx, l, v.choice.left, Math.min(v.options.length, l.options.length));
  } else if (v.phase === 'slow' && v.why) {
    why(ctx, l, v, st.left);
  }
  // the coach: fades in on a new line
  if (v.coach !== st.coach) { st.coach = v.coach; st.coachAge = 0; } else st.coachAge += dt;
  if (v.coach && !v.options.length) coach(ctx, l, v.coach, st.coachAge, reduced);
  if (v.banner) banner(ctx, l, v.banner.text, v.banner.age, reduced);
  if (v.count !== st.count) { st.count = v.count; st.countAge = 0; } else st.countAge += dt;
  if (v.count !== null && v.count !== undefined) count(ctx, l, v.count, st.countAge, reduced, st.countX ?? null);
  ctx.restore();
}

/** A health bar: the name, the lives as small gloves, the bar (gold, warming toward coral as it empties). */
function bar(ctx: CanvasRenderingContext2D, l: Layout, f: FighterView, r: { x: number; y: number; w: number; h: number }, right: boolean, ghost: number): void {
  const k = ks(l);
  const fs = px(l, 14);
  // a soft scrim so the words read over the hall
  ctx.fillStyle = 'rgba(8,5,10,0.5)';
  rr(ctx, r.x - 4, r.y - 2, r.w + 8, r.h + 4, 8 * k);
  ctx.fill();
  // the lives: small gloves (filled while left)
  const n = Math.max(1, Math.min(5, f.maxLives | 0));
  const gr = Math.max(5, Math.round(5.5 * k));
  const livesW = n * (gr * 2 + 4);
  for (let i = 0; i < n; i++) {
    const cx = right ? r.x + gr + 2 + i * (gr * 2 + 4) : r.x + r.w - gr - 2 - i * (gr * 2 + 4);
    gloveIcon(ctx, cx, r.y + fs * 0.62, gr, i < f.lives, f.look.gloves, right);
  }
  // the name
  ctx.font = font(700, fs);
  ctx.fillStyle = C.ink;
  const name = fitText(ctx, f.name, r.w - livesW - 10, fs, 700, FONT);
  ctx.textAlign = right ? 'right' : 'left';
  ctx.fillText(name, right ? r.x + r.w : r.x, r.y + fs * 0.95);
  // the bar
  const by = r.y + fs * 1.3, bh = Math.max(8, Math.round(10 * k));
  const hp = clamp01(f.hp);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  rr(ctx, r.x, by, r.w, bh, bh / 2);
  ctx.fill();
  const fillTo = (x: number, col: string): void => {
    const w = r.w * x;
    if (w < 1) return;
    ctx.fillStyle = col;
    rr(ctx, right ? r.x + r.w - w : r.x, by, w, bh, bh / 2);
    ctx.fill();
  };
  fillTo(clamp01(ghost), 'rgba(255,244,228,0.38)');
  const col = hp > 0.5 ? C.gold : hp > 0.25 ? '#f2a65a' : '#ff8f70';
  fillTo(hp, col);
  // the kit's colour as a thin line under it: whose bar
  ctx.fillStyle = rgba(f.look.kit, 0.9);
  ctx.fillRect(right ? r.x + r.w - r.w * 0.3 : r.x, by + bh + 2, r.w * 0.3, Math.max(2, 2 * k));
  ctx.textAlign = 'left';
}

function gloveIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean, colour: string, right: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (right) ctx.scale(-1, 1);
  ctx.beginPath();
  ctx.ellipse(0.5, -0.5, r, r * 0.88, 0, 0, TAU);
  ctx.rect(-r * 0.55, r * 0.55, r * 1.05, r * 0.55);
  if (on) {
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(colour) ? colour : C.gold;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  ctx.restore();
}

/** The rounds as dots between the bars (the current one lit). */
function rounds(ctx: CanvasRenderingContext2D, l: Layout, v: FightView): void {
  const n = Math.max(0, Math.min(8, v.rounds | 0));
  if (!n) return;
  const k = ks(l);
  const r = Math.max(2.5, 3 * k), gap = r * 3;
  const cx = (l.bars.player.x + l.bars.player.w + l.bars.foe.x) / 2;
  const y = l.bars.player.y + l.bars.player.h + 6 * k;
  for (let i = 0; i < n; i++) {
    const x = cx + (i - (n - 1) / 2) * gap;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    if (i + 1 < v.round) { ctx.fillStyle = 'rgba(245,198,106,0.55)'; ctx.fill(); }
    else if (i + 1 === v.round) { ctx.fillStyle = C.gold; ctx.fill(); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke(); }
  }
}

/** The "why" line: a short sentence over the options (the column's top on a wide screen), the time running out under it. */
function why(ctx: CanvasRenderingContext2D, l: Layout, v: FightView, left: number): void {
  const r = l.why;
  const k = ks(l);
  const column = l.mode === 'column';
  // a narrow column reads a line or two more at 14 px than cut at 15
  const fs = px(l, column ? 14 : 15);
  const lh = Math.round(fs * (column ? 1.24 : 1.3));
  ctx.font = font(600, fs);
  const text = v.why ?? v.closed ?? null;
  const lines = text ? wrap(ctx, text, r.w - 16, column ? Math.max(1, Math.floor((r.h - 10) / lh)) : 2) : [];
  const h = column ? Math.min(r.h, lines.length * lh + 16) : r.h;
  const y0 = column ? r.y : r.y + r.h - h;
  ctx.fillStyle = 'rgba(10,7,14,0.72)';
  rr(ctx, r.x, y0, r.w, h, 10 * k);
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'center';
  const ty = y0 + (h - lines.length * lh) / 2 + fs * 0.95 - 2;
  lines.forEach((s, i) => ctx.fillText(s, r.x + r.w / 2, ty + i * lh));
  ctx.textAlign = 'left';
  // the window's time left: a thin gold line along the bottom, shrinking toward the middle
  if (v.phase === 'slow') {
    const w = (r.w - 20) * clamp01(left);
    ctx.fillStyle = rgba(C.gold, 0.85);
    ctx.fillRect(r.x + r.w / 2 - w / 2, y0 + h - 4, w, Math.max(2, 2 * k));
  }
}

/**
 * The quick-time choice's own time (a level that closes it): a thin bright line over the options' row, shrinking
 * toward its middle — the gold line under the "why" keeps the slow motion's time.
 */
function choiceTime(ctx: CanvasRenderingContext2D, l: Layout, left: number, n: number): void {
  if (!n) return;
  const a = l.options[0], b = l.options[n - 1];
  const k = ks(l);
  const column = l.mode === 'column';
  const x0 = column ? a.x : a.x, x1 = column ? a.x + a.w : b.x + b.w;
  const y = Math.min(a.y, b.y) - Math.max(3, 4 * k);
  const w = (x1 - x0) * clamp01(left);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x0, y, x1 - x0, Math.max(2, 2 * k));
  ctx.fillStyle = rgba(left > 0.3 ? '#cfe6ff' : C.ember, 0.95);
  ctx.fillRect((x0 + x1) / 2 - w / 2, y, w, Math.max(2, 2 * k));
  ctx.restore();
}

/** One option: a big button with its label and sub-line; chosen: lit and filling with the energy; hint: a soft glow. */
function option(ctx: CanvasRenderingContext2D, l: Layout, o: Option, r: { x: number; y: number; w: number; h: number }, energy: number, ready: boolean, time: number, reduced: boolean, dim = false): void {
  const k = ks(l);
  const col = KIND_COL[o.kind] ?? C.gold;
  const rad = 12 * k;
  ctx.save();
  if (dim) ctx.globalAlpha = 0.38;
  if (o.hint && !o.chosen) {
    const p = reduced ? 0.7 : 0.55 + 0.45 * Math.sin(time * 3);
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, C.gold, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 0.75, 0.22 * p);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = rgba(C.gold, 0.35 + 0.35 * p);
    ctx.lineWidth = 5 * k;
    rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, rad + 3);
    ctx.stroke();
  }
  ctx.fillStyle = o.chosen ? 'rgba(40,26,16,0.92)' : 'rgba(18,12,20,0.88)';
  rr(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  if (o.chosen) {
    // the energy fills the chosen move from the bottom
    const e = clamp01(energy);
    ctx.save();
    rr(ctx, r.x, r.y, r.w, r.h, rad);
    ctx.clip();
    const g = ctx.createLinearGradient(0, r.y + r.h, 0, r.y);
    g.addColorStop(0, rgba(C.energy, 0.5));
    g.addColorStop(1, rgba(C.ember, 0.25));
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y + r.h * (1 - e), r.w, r.h * e);
    ctx.restore();
  }
  ctx.strokeStyle = o.chosen ? (ready ? C.energyHi : C.energy) : rgba(col, 0.65);
  ctx.lineWidth = (o.chosen ? 2.5 : 1.5) * k;
  rr(ctx, r.x, r.y, r.w, r.h, rad);
  ctx.stroke();
  // the kind's small tab
  ctx.fillStyle = rgba(col, o.chosen ? 1 : 0.8);
  rr(ctx, r.x + 10 * k, r.y + 5 * k, 22 * k, 3.5 * k, 2 * k);
  ctx.fill();
  // the words: the label on one line (16 px, down to 14), else in two lines; the sub-line in the lines left (two
  // under a one-line label, one under a two-line label) — never cut where it fits whole
  const lf = px(l, 16), sf = px(l, 13);
  const padX = 7 * k, maxW = r.w - padX * 2;
  ctx.textAlign = 'center';
  let labels: string[];
  let lsz = lf;
  ctx.font = font(800, lf);
  if (ctx.measureText(o.label).width <= maxW) labels = [o.label];
  else {
    const one = fitText(ctx, o.label, maxW, lf, 800, FONT, Math.max(MIN_READ, lf - 2));
    if (!one.endsWith('…')) { labels = [one]; lsz = parseFloat(ctx.font.split(' ')[1]) || lf; }
    else {
      lsz = Math.max(MIN_READ, lf - 2);
      ctx.font = font(800, lsz);
      labels = wrap(ctx, o.label, maxW, 2);
    }
  }
  const lineL = Math.round(lsz * 1.08);
  const room = r.h - 8 * k - labels.length * lineL;
  const lineS = Math.round(sf * 1.12);
  let subs: string[] = [];
  if (o.sub && room >= lineS) {
    ctx.font = font(500, sf);
    const fit2 = room >= lineS * 2 + 2;
    if (ctx.measureText(o.sub).width <= maxW) subs = [o.sub];
    else if (fit2) subs = wrap(ctx, o.sub, maxW, 2);
    else subs = [fitText(ctx, o.sub, maxW, sf, 500, FONT, MIN_READ)];
  }
  const blockH = labels.length * lineL + (subs.length ? 3 + subs.length * lineS : 0);
  const top = r.y + (r.h - blockH) / 2 + 3 * k;
  ctx.fillStyle = C.ink;
  ctx.font = font(800, lsz);
  labels.forEach((s, i) => ctx.fillText(s, r.x + r.w / 2, top + lineL * (i + 0.8)));
  if (subs.length) {
    ctx.fillStyle = rgba(C.ink, 0.78);
    ctx.font = font(500, sf);
    if (subs.length === 1 && ctx.measureText(subs[0]).width > maxW) subs[0] = fitText(ctx, subs[0], maxW, sf, 500, FONT, MIN_READ);
    const y0 = top + labels.length * lineL + 3;
    subs.forEach((s, i) => ctx.fillText(s, r.x + r.w / 2, y0 + lineS * (i + 0.8)));
  }
  ctx.textAlign = 'left';
  ctx.restore();
}

/** The coach's bubble: a warm paper bubble with the line, its tail toward the player's corner. */
function coach(ctx: CanvasRenderingContext2D, l: Layout, text: string, age: number, reduced: boolean): void {
  const r = l.coach;
  const k = ks(l);
  const fs = px(l, 15);
  const lh = Math.round(fs * 1.32);
  ctx.font = font(600, fs);
  const maxLines = Math.max(1, Math.min(4, Math.floor((r.h - 16) / lh)));
  const lines = wrap(ctx, text, r.w - 30 * k, maxLines);
  const tw = Math.max(...lines.map(s => ctx.measureText(s).width));
  const w = Math.min(r.w, tw + 30 * k);
  const h = lines.length * lh + 16 * k;
  const x = l.mode === 'column' ? r.x : r.x + (r.w - w) / 2;
  const y = l.mode === 'column' ? r.y : r.y + (r.h - h) / 2;
  const a = reduced ? smooth(age / 0.4) : smooth(age / 0.3);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(0, reduced ? 0 : (1 - a) * 6);
  ctx.fillStyle = 'rgba(246,239,228,0.95)';
  rr(ctx, x, y, w, h, 14 * k);
  ctx.fill();
  // the tail, toward the player's side
  ctx.beginPath();
  ctx.moveTo(x + 18 * k, y);
  ctx.lineTo(x + 26 * k, y - 8 * k);
  ctx.lineTo(x + 34 * k, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + 10 * k, y + 10 * k, 3 * k, h - 20 * k);
  ctx.fillStyle = '#2a1d18';
  lines.forEach((s, i) => ctx.fillText(s, x + 20 * k, y + 8 * k + fs + i * lh - 2));
  ctx.restore();
}

/** The big word over the ring: fades in, a warm glow behind it. */
function banner(ctx: CanvasRenderingContext2D, l: Layout, text: string, age: number, reduced: boolean): void {
  const r = l.banner;
  const k = ks(l);
  const a = smooth(age / 0.3);
  const sc = reduced ? 1 : 1 + 0.08 * (1 - smooth(age / 0.45));
  const fs = Math.max(20, Math.round(36 * k));
  ctx.save();
  ctx.globalAlpha = a;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.gold, cx, cy, Math.min(r.w * 0.5, fs * 4), 0.35 * a);
  ctx.globalCompositeOperation = 'source-over';
  ctx.translate(cx, cy);
  ctx.scale(sc, sc);
  const s = fitText(ctx, text, r.w - 16, fs, 800, FONT, 18);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,6,12,0.75)';
  ctx.lineWidth = Math.max(3, fs * 0.16);
  ctx.strokeText(s, 0, fs * 0.36);
  ctx.fillStyle = '#fff6e6';
  ctx.fillText(s, 0, fs * 0.36);
  ctx.restore();
}

/** The referee's count: a large numeral, a pulse at each new number. */
function count(ctx: CanvasRenderingContext2D, l: Layout, n: number, age: number, reduced: boolean, atX: number | null): void {
  const st = l.stage ?? l.ring;
  const r = atX === null ? l.count : { ...l.count, x: Math.max(st.x, Math.min(st.x + st.w - l.count.w, atX - l.count.w / 2)) };
  const fs = Math.max(40, Math.round(r.h * 0.78));
  const p = reduced ? 1 : 1 + 0.3 * (1 - smooth(age / 0.35));
  const a = reduced ? smooth(age / 0.25) * 0.4 + 0.6 : 1;
  ctx.save();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, C.warm, cx, cy, r.w * 0.9, 0.3);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(p, p);
  ctx.font = font(800, fs);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(10,6,12,0.8)';
  ctx.lineWidth = Math.max(4, fs * 0.1);
  const s = String(Math.max(0, Math.round(n)));
  ctx.strokeText(s, 0, fs * 0.36);
  ctx.fillStyle = '#fff6e6';
  ctx.fillText(s, 0, fs * 0.36);
  ctx.restore();
}
