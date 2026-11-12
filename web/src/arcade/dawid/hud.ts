/**
 * Dawid's own bits over the map, drawn on the canvas phone first (src/arcade/DESIGN.md §12) — never the
 * band's panel nor the score (the runner draws those):
 *
 *   the bottom band   the level's badge and bar (with the rested band), health, the party's portraits with
 *                     their kit skills' dials, the treasury; the great stone and the bag as two big buttons in
 *                     the thumb zone, pressed on touch-down, with their state in words under them
 *   the top band      the quest pill (a tap follows the quest) with an arrow at the field's edge, the minimap
 *   the camp's sheet  the treasury and "Na łowy" on its edge, four tabs and the tiles (they scroll)
 *   over it all       the story cards, the speech bubbles, the short banners, the level-up's big words
 *
 * It also keeps where its controls were drawn, for the taps (index.ts) and the mobile audit (`targets`).
 * Sizes are for a 360 px phone at u = 1; nothing is drawn under MIN_TEXT, and what the player reads to play
 * is at least MIN_READ.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TAP, MIN_TEXT, fitText } from '../kit/mobile';
import { REF_FONT, VERSE_FONT, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import type { TapTarget } from '../kit/types';
import { companionSpec, type CompanionId } from './content';
import { t, xpText } from './i18n';
import { grow, type Layout, type Rect } from './layout';
import { xpNeed } from './meta';
import { C, SANS, SERIF, font, glow, paintCoin, paintPortrait } from './paint';
import { whyText, type CampTab, type DawidSim, type Tile } from './sim';

const TAU = Math.PI * 2;

export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/), out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

export function panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke: string | null, rad: number, lw = 1.5): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const TABS: readonly CampTab[] = ['ab', 'bd', 'wp', 'party'];
const TAB_KEYS = { ab: 'camp.tab.ab', bd: 'camp.tab.bd', wp: 'camp.tab.forge', party: 'camp.tab.party' } as const;

/** What a finger holds down now (drawn pressed until it lifts). */
export type PressKind = 'bag' | 'stone' | 'quest' | 'hunt' | 'tab' | 'tile';
export interface Pressed { kind: PressKind; i: number }

/** The camp's sheet as it stands this frame (it slides in), its tiles at the current scroll. */
export interface SheetNow {
  frame: Rect;
  head: Rect;
  hunt: Rect;
  tabs: Rect[];
  view: Rect;
  tiles: Rect[];
  maxScroll: number;
}

/** A tap on the sheet: "Na łowy", a tab, a tile (whole enough to buy), or its background (it scrolls). */
export type SheetHit = { kind: 'hunt' } | { kind: 'tab'; i: number } | { kind: 'tile'; i: number; whole: boolean } | { kind: 'sheet' };

/** The part of `r` inside `v` vertically (a tile in the sheet's window), or null. */
function within(r: Rect, v: Rect): Rect | null {
  const y0 = Math.max(r.y, v.y), y1 = Math.min(r.y + r.h, v.y + v.h);
  return y1 - y0 > 0.5 ? { x: r.x, y: y0, w: r.w, h: y1 - y0 } : null;
}

export class Hud {
  /** the camp sheet's scroll (px) and its fling (px/s) */
  scroll = 0;
  fling = 0;
  /** what a finger holds down now */
  pressed: Pressed | null = null;
  /** the controls as drawn this frame: the sheet, the quest pill, the story card */
  sheetShown: SheetNow | null = null;
  questBox: Rect | null = null;
  storyBox: Rect | null = null;
  /** where the quest's arrow (or marker) was drawn this frame */
  arrowAt: { x: number; y: number } | null = null;
  /** a button that said "not yet" (it shakes): which (a tile's index too) and when */
  private nope: { kind: PressKind; i: number; t: number } | null = null;
  private lastTab: CampTab | null = null;
  private passage: { id: string; l: PassageLayout; w: number; h: number } | null = null;

  // ── the sheet's geometry and the hits ──────────────────────────────
  /** The sheet slid in by `k` (0..1), its tiles at the current scroll. */
  sheetNow(L: Layout, n: number, k: number): SheetNow {
    const S = L.sheet, e = ease.outCubic(clamp(k));
    const dx = S.dock === 'right' ? (1 - e) * (S.w + 24) : 0;
    const dy = S.dock === 'bottom' ? (1 - e) * (S.h + S.head.h) : 0;
    const mv = (r: Rect): Rect => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h });
    const rows = Math.ceil(n / S.cols);
    const maxScroll = Math.max(0, rows * (S.tileH + S.gap) - S.gap - S.view.h);
    const sc = clamp(this.scroll, 0, maxScroll);
    const view = mv(S.view);
    const tiles: Rect[] = [];
    for (let i = 0; i < n; i++) {
      const c = i % S.cols, r = Math.floor(i / S.cols);
      tiles.push({ x: view.x + c * (S.tileW + S.gap), y: view.y + r * (S.tileH + S.gap) - sc, w: S.tileW, h: S.tileH });
    }
    return { frame: mv(S), head: mv(S.head), hunt: mv(S.hunt), tabs: S.tabs.map(mv), view, tiles, maxScroll };
  }

  /** What a press at (x, y) lands on in the sheet shown, or null (outside it). */
  sheetAt(x: number, y: number): SheetHit | null {
    const g = this.sheetShown;
    if (!g) return null;
    if (inRect(grow(g.hunt), x, y)) return { kind: 'hunt' };
    const tab = g.tabs.findIndex(r => inRect(r, x, y));
    if (tab >= 0) return { kind: 'tab', i: tab };
    if (inRect(g.view, x, y)) {
      const i = g.tiles.findIndex(r => inRect(r, x, y));
      if (i >= 0) return { kind: 'tile', i, whole: (within(g.tiles[i], g.view)?.h ?? 0) >= MIN_TAP };
    }
    return inRect(g.frame, x, y) || inRect(g.head, x, y) ? { kind: 'sheet' } : null;
  }

  /** Scroll the sheet so tile `i` is whole in its window. */
  reveal(i: number): void {
    const g = this.sheetShown;
    if (!g) return;
    const r = g.tiles[i];
    if (!r) return;
    if (r.y < g.view.y) this.scroll -= g.view.y - r.y;
    else if (r.y + r.h > g.view.y + g.view.h) this.scroll += r.y + r.h - (g.view.y + g.view.h);
    this.scroll = clamp(this.scroll, 0, g.maxScroll);
    this.fling = 0;
  }

  /** The sheet's fling after a flick, and the "not yet" shake's clock. */
  update(dt: number): void {
    if (this.fling !== 0 && !this.pressed) {
      this.scroll += this.fling * dt;
      this.fling *= Math.exp(-dt * 5);
      const max = this.sheetShown?.maxScroll ?? 0;
      if (this.scroll < 0 || this.scroll > max) { this.scroll = clamp(this.scroll, 0, max); this.fling = 0; }
      if (Math.abs(this.fling) < 12) this.fling = 0;
    }
    if (this.nope) {
      this.nope.t += dt;
      if (this.nope.t > 0.4) this.nope = null;
    }
  }

  /** A control that cannot do it now shakes once (the great stone not polished yet, a tile too dear). */
  shake(kind: PressKind, i = 0): void { this.nope = { kind, i, t: 0 }; }

  private wobble(kind: PressKind, i = 0): number {
    const n = this.nope;
    return n && n.kind === kind && n.i === i ? Math.sin(n.t * 46) * 5 * (1 - n.t / 0.4) : 0;
  }

  private isPressed(kind: PressKind, i = 0): boolean { return !!this.pressed && this.pressed.kind === kind && this.pressed.i === i; }

  /**
   * The tappable controls now, as hit rectangles (CSS px), for the mobile audit and the tests: a story card
   * alone while it shows; the camp's sheet ('sheet', all the way up) or the two buttons ('buttons'); the quest pill.
   */
  targets(L: Layout, sim: DawidSim, show: 'sheet' | 'buttons' | 'none'): TapTarget[] {
    const out: TapTarget[] = [];
    const add = (label: string, r: Rect) => out.push({ label, x: r.x, y: r.y, w: r.w, h: r.h });
    if (sim.story && sim.story.t >= 0) {
      if (this.storyBox) add('story', this.storyBox);
      return out;
    }
    const g = this.sheetShown;
    if (show === 'sheet' && g) {
      add('hunt', grow(g.hunt));
      g.tabs.forEach((r, i) => add(`tab ${TABS[i]}`, r));
      g.tiles.forEach((r, i) => {
        const v = within(r, g.view);
        if (v && v.h >= MIN_TAP) add(`tile ${i}`, v);
      });
    } else if (show === 'buttons') {
      add('stone', L.stone.hit);
      add('bag', L.bag.hit);
    }
    if (this.questBox) add('quest', grow(this.questBox));
    return out;
  }

  // ── the bottom band ────────────────────────────────────────────────
  /** The level's badge and bar (with rested XP ahead of it), health, the party and the treasury: passive. */
  drawBars(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number, pop: number): void {
    const u = L.u, p = sim.p, d = sim.david;
    // the level's badge
    const lv = L.lv;
    panel(ctx, lv, pop > 0.05 ? 'rgba(120,80,20,.9)' : 'rgba(36,28,20,.8)', pop > 0.05 ? C.goldLight : 'rgba(234,181,61,.55)', lv.h / 2);
    const lvText = fitText(ctx, t('hud.level', { n: p.level }), lv.w - 10 * u, (14.5 + 3 * pop) * u, 900, SANS, 12);
    ctx.fillStyle = pop > 0.05 ? C.goldLight : '#fff8e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lvText, lv.x + lv.w / 2, lv.y + lv.h / 2 + 0.5);
    // the level's bar: the rested band ahead of the gold fill, the numbers inside
    const xp = L.xp;
    panel(ctx, { x: xp.x - 2, y: xp.y - 2, w: xp.w + 4, h: xp.h + 4 }, 'rgba(36,28,20,.75)', null, (xp.h + 4) / 2);
    const fill = sim.levelProgress, rested = sim.restedShare;
    if (rested > 0) {
      ctx.fillStyle = 'rgba(136,170,224,.75)';
      ctx.beginPath();
      ctx.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * Math.min(1, fill + rested)), xp.h, xp.h / 2);
      ctx.fill();
    }
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.roundRect(xp.x, xp.y, Math.max(xp.h, xp.w * fill), xp.h, xp.h / 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,200,.45)';
    ctx.fillRect(xp.x + xp.h / 2, xp.y + 2, Math.max(0, xp.w * fill - xp.h), xp.h * 0.22);
    const nums = `${fmtNum(Math.floor(p.xp))} / ${fmtNum(xpNeed(p.level))}`;
    let tag = '';
    if (rested > 0.01) tag = xp.w >= 200 * u ? t('hud.rested') : '×2';
    ctx.font = font(800, 13 * u, SANS);
    const tagW = tag ? ctx.measureText(tag).width + 12 * u : 0;
    const numText = fitText(ctx, nums, xp.w - tagW - 10 * u, 13 * u, 800, SANS, 12);
    outlined(ctx, numText, xp.x + (xp.w - tagW) / 2, xp.y + xp.h / 2 + 0.5, '#fff8e6', 'rgba(36,24,10,.75)', 3);
    if (tag) {
      const tr = { x: xp.x + xp.w - tagW - 1, y: xp.y + 1, w: tagW, h: xp.h - 2 };
      panel(ctx, tr, C.calmDeep, null, tr.h / 2);
      ctx.font = font(800, 13 * u, SANS);
      ctx.fillStyle = '#eef3ff';
      ctx.textAlign = 'center';
      ctx.fillText(tag, tr.x + tr.w / 2, tr.y + tr.h / 2 + 0.5);
    }
    // health
    const hp = L.hp;
    panel(ctx, { x: hp.x - 2, y: hp.y - 2, w: hp.w + 4, h: hp.h + 4 }, 'rgba(36,28,20,.75)', sim.shieldT > 0 ? 'rgba(160,200,255,.95)' : null, (hp.h + 4) / 2, 2);
    const hf = clamp(d.hp / Math.max(1, d.max));
    ctx.fillStyle = hf < 0.3 ? (Math.sin(now * 8) > 0 ? '#ff6a48' : '#c8402a') : '#d8574a';
    ctx.beginPath();
    ctx.roundRect(hp.x, hp.y, Math.max(hp.h, hp.w * hf), hp.h, hp.h / 2);
    ctx.fill();
    ctx.font = font(800, 13 * u, SANS);
    ctx.textAlign = 'center';
    outlined(ctx, `${fmtNum(Math.ceil(d.hp))} / ${fmtNum(d.max)}`, hp.x + hp.w / 2, hp.y + hp.h / 2 + 0.5, '#fff', 'rgba(60,16,8,.7)', 3);
    // the party: portraits with their kit skills' dials
    const pa = L.party;
    sim.mates.forEach((m, i) => {
      const x = pa.x + i * pa.gap, y = pa.y;
      ctx.save();
      if (m.act > 0) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, pa.r * 2.2, 'rgba(255,220,140,', 0.5 * Math.min(1, m.act));
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = 'rgba(36,28,20,.8)';
      ctx.beginPath();
      ctx.arc(x, y, pa.r + 3.5, 0, TAU);
      ctx.fill();
      paintPortrait(ctx, m.id as CompanionId, x, y, pa.r);
      const cd = companionSpec(m.id).cd, k = clamp(1 - m.cd / cd);
      ctx.strokeStyle = k >= 0.999 ? C.goldLight : 'rgba(255,248,230,.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, pa.r + 2, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
      ctx.restore();
    });
    // the treasury: a coin and the number, right-aligned
    const tr = L.treasury;
    const txt = fmtNum(p.silver);
    ctx.font = font(800, 14 * u, SANS);
    const tw = ctx.measureText(txt).width;
    const plate = { x: tr.x - tw - 32 * u, y: tr.y - 12 * u, w: tw + 32 * u, h: 24 * u };
    panel(ctx, plate, 'rgba(36,28,20,.72)', null, plate.h / 2);
    icon(ctx, 'silver', plate.x + 13 * u, tr.y, 14 * u, now);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f2f6fa';
    ctx.fillText(txt, tr.x - 7 * u, tr.y + 0.5);
  }

  /** The two buttons of the thumb zone: the great stone (its charge, "Rzuć!" when ready) and the bag (its load). */
  drawButtons(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number, bagPop: number): void {
    const u = L.u;
    // the great stone: polished, it glows and calls "Rzuć!" while there is something in sight to throw it at
    const st = L.stone, ready = sim.stoneReady, charging = sim.pushBlock || sim.charge > 0;
    const live = ready && !sim.sitting && !!sim.stoneTarget();
    const sx = st.x + this.wobble('stone');
    const sk = this.isPressed('stone') ? 0.9 : 1 + (live ? 0.05 * Math.sin(now * 6) : 0);
    ctx.save();
    if (live) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sx, st.y, st.r * 2.3, 'rgba(255,214,110,', 0.55 + 0.15 * Math.sin(now * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.translate(sx, st.y);
    ctx.scale(sk, sk);
    disc(ctx, st.r, this.isPressed('stone') ? 'rgba(20,14,8,.92)' : 'rgba(36,28,20,.84)');
    ctx.strokeStyle = 'rgba(255,248,230,.18)';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(0, 0, st.r - 4 * u, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = ready ? C.gold : 'rgba(255,248,230,.9)';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, st.r - 4 * u, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(ready ? 1 : sim.charge));
    ctx.stroke();
    if (live) {
      ctx.strokeStyle = `rgba(255,231,163,${0.5 + 0.5 * Math.sin(now * 6)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, st.r + 3 + 3 * Math.sin(now * 6), 0, TAU);
      ctx.stroke();
    }
    const sr = st.r * (ready ? 0.46 : 0.36);
    ctx.fillStyle = ready ? '#f4d27a' : charging ? '#d9d3c6' : '#8f897d';
    ctx.beginPath();
    ctx.ellipse(0, 1, sr * 1.15, sr, -0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ready ? '#fff4d2' : 'rgba(255,255,255,.55)';
    ctx.beginPath();
    ctx.ellipse(-sr * 0.35, -sr * 0.3, sr * 0.38, sr * 0.24, -0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
    const word = live ? t('hud.stoneGo') : ready ? t('hud.stoneReady') : t('pct', { n: Math.round(sim.charge * 100) });
    label(ctx, L, word, st.x, st.y + st.r + 4, ready ? C.goldLight : 'rgba(255,248,230,.92)', live ? 14 : 13, live);
    // the bag
    const bg = L.bag, load = clamp(sim.bagLoad / Math.max(1, sim.bagCap)), full = sim.bagFull;
    const bk = this.isPressed('bag') ? 0.9 : 1 + 0.1 * bagPop + (full ? 0.04 * Math.sin(now * 7) : 0);
    ctx.save();
    if (full) {
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, bg.x, bg.y, bg.r * 2.3, 'rgba(255,200,120,', 0.4 + 0.2 * Math.sin(now * 6));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.translate(bg.x + this.wobble('bag'), bg.y);
    ctx.scale(bk, bk);
    disc(ctx, bg.r, this.isPressed('bag') ? 'rgba(20,14,8,.92)' : 'rgba(36,28,20,.84)');
    ctx.strokeStyle = 'rgba(255,248,230,.18)';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.arc(0, 0, bg.r - 4 * u, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = full ? C.goldLight : C.silver;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, bg.r - 4 * u, -Math.PI / 2, -Math.PI / 2 + TAU * load);
    ctx.stroke();
    // the sack
    const R = bg.r;
    ctx.fillStyle = '#a8743f';
    ctx.beginPath();
    ctx.ellipse(0, R * 0.14, R * 0.4, R * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a4e28';
    ctx.beginPath();
    ctx.moveTo(-R * 0.17, -R * 0.2);
    ctx.lineTo(R * 0.17, -R * 0.2);
    ctx.lineTo(R * 0.24, -R * 0.4);
    ctx.lineTo(-R * 0.24, -R * 0.4);
    ctx.fill();
    paintCoin(ctx, 'silver', R * 0.05, R * 0.3, R * 0.8, now, 1);
    ctx.restore();
    label(ctx, L, full ? t('hud.home') : `${fmtNum(Math.round(sim.bagLoad))}/${fmtNum(sim.bagCap)}`, bg.x, bg.y + bg.r + 4, full ? C.goldLight : '#fff8e6', 13, full);
  }

  // ── the top band ────────────────────────────────────────────────────
  /**
   * The quest: a pill under the HUD (one line, two when the words need it; a tap follows the quest), and an
   * arrow at the field's edge toward its place (a bobbing marker over it when in sight).  `maxR` is the pill's
   * right limit now (the side sheet takes the right).
   */
  drawQuest(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, target: { x: number; y: number } | null, now: number, pop: number, maxR: number): void {
    this.questBox = null;
    this.arrowAt = null;
    const q = sim.questText();
    if (!q.text) return;
    const u = L.u, r = L.quest;
    const maxW = Math.min(r.w, maxR - r.x);
    const label = q.progress ? `${q.text} · ${q.progress}` : q.text;
    const room = maxW - 46 * u;
    ctx.font = font(700, 13.5 * u, SANS);
    let lines = [label];
    if (ctx.measureText(label).width > room) {
      lines = wrap(ctx, label, room);
      // two lines at most: the rest is cut with "…" at the same size
      if (lines.length > 2) lines = [lines[0], fitText(ctx, lines.slice(1).join(' '), room, 13.5 * u, 700, SANS, 13.5 * u)];
    }
    const tw = Math.max(...lines.map(l => ctx.measureText(l).width));
    const h = lines.length > 1 ? r.h + 17 * u : r.h;
    const w = Math.min(maxW, tw + 46 * u);
    const box = { x: r.x, y: r.y, w, h };
    this.questBox = box;
    const pressed = this.isPressed('quest');
    ctx.save();
    ctx.translate(this.wobble('quest'), 0);
    const k = (pressed ? 0.95 : 1) + 0.1 * pop;
    if (k !== 1) {
      ctx.translate(r.x + w / 2, r.y + h / 2);
      ctx.scale(k, k);
      ctx.translate(-(r.x + w / 2), -(r.y + h / 2));
    }
    panel(ctx, box, pressed ? 'rgba(20,14,8,.85)' : 'rgba(36,28,20,.76)', pop > 0 ? C.goldLight : 'rgba(234,181,61,.7)', Math.min(h / 2, 16 * u), 2);
    const cx = r.x + 14 * u, cy = r.y + h / 2;
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6 * u);
    ctx.lineTo(cx + 5 * u, cy);
    ctx.lineTo(cx, cy + 6 * u);
    ctx.lineTo(cx - 5 * u, cy);
    ctx.fill();
    ctx.fillStyle = '#fff8e6';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lh = 17 * u;
    lines.forEach((l, i) => ctx.fillText(l, r.x + 25 * u, cy + (i - (lines.length - 1) / 2) * lh + 0.5));
    // the chevron: a tap follows the quest
    ctx.strokeStyle = C.goldLight;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r.x + w - 15 * u, cy - 5 * u);
    ctx.lineTo(r.x + w - 10 * u, cy);
    ctx.lineTo(r.x + w - 15 * u, cy + 5 * u);
    ctx.stroke();
    ctx.restore();
    if (!target) return;
    // the arrow: at the field's edge toward the place, or a bobbing marker above it
    const m = 26 * u;
    const top = L.field.top + 6, bottom = L.field.bottom;
    const inside = target.x > L.left + m && target.x < L.right - m && target.y > top + m && target.y < bottom - 20 * u;
    if (inside) {
      const bob = Math.sin(now * 4) * 4 * u;
      ctx.fillStyle = C.gold;
      ctx.strokeStyle = 'rgba(36,28,20,.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(target.x, target.y - 34 * u + bob);
      ctx.lineTo(target.x - 10 * u, target.y - 52 * u + bob);
      ctx.lineTo(target.x + 10 * u, target.y - 52 * u + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      this.arrowAt = { x: target.x, y: target.y - 34 * u };
      return;
    }
    const cxs = (L.left + L.right) / 2, cys = (top + bottom) / 2;
    const a = Math.atan2(target.y - cys, target.x - cxs);
    const hx = (L.right - L.left) / 2 - m, hy = (bottom - top) / 2 - m;
    const kk = Math.min(Math.abs(hx / (Math.cos(a) || 1e-6)), Math.abs(hy / (Math.sin(a) || 1e-6)));
    const ax = cxs + Math.cos(a) * kk, ay = cys + Math.sin(a) * kk;
    this.arrowAt = { x: ax, y: ay };
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a);
    ctx.fillStyle = C.gold;
    ctx.strokeStyle = 'rgba(36,28,20,.75)';
    ctx.lineWidth = 2;
    const pulse = 1 + 0.12 * Math.sin(now * 5);
    ctx.scale(pulse * u, pulse * u);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-9, -12);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-9, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** The minimap: the land's outline, the camp, the dens, the lair and the gate, the quest's place, David. */
  drawMini(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number): void {
    const r = L.mini;
    if (!r || sim.inCave) return;
    const land = sim.land;
    const sx = r.w / land.w, sy = r.h / land.h;
    const P = (x: number, y: number) => ({ x: r.x + x * sx, y: r.y + y * sy });
    panel(ctx, r, 'rgba(36,28,20,.62)', 'rgba(255,248,230,.3)', 8);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 8);
    ctx.clip();
    ctx.strokeStyle = 'rgba(95,159,196,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    land.brook.forEach(([x, y], i) => { const p = P(x, y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    ctx.stroke();
    sim.dens.forEach((dn, i) => {
      const p = P(dn.x, dn.y);
      const alive = sim.beasts.some(b => b.den === i && b.state !== 'flee');
      ctx.fillStyle = alive ? 'rgba(220,120,90,.95)' : 'rgba(200,180,150,.35)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4, 0, TAU);
      ctx.fill();
    });
    const camp = P(land.camp[0], land.camp[1]);
    ctx.fillStyle = C.fire;
    ctx.beginPath();
    ctx.arc(camp.x, camp.y, 3.6, 0, TAU);
    ctx.fill();
    const g = sim.guard;
    if (g.state !== 'gone') {
      const lp = P(g.x, g.y);
      ctx.fillStyle = sim.guardActive ? '#ff7a5a' : 'rgba(255,140,110,.5)';
      ctx.fillRect(lp.x - 3, lp.y - 3, 6, 6);
    }
    const gp = P(land.gate[0], land.gate[1]);
    ctx.strokeStyle = sim.gateOpen ? C.goldLight : 'rgba(255,248,230,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gp.x - 4, gp.y);
    ctx.lineTo(gp.x + 4, gp.y);
    ctx.stroke();
    const qt = sim.questTarget();
    if (qt) {
      const q = P(qt.x, qt.y);
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(q.x, q.y - 5);
      ctx.lineTo(q.x + 4, q.y);
      ctx.lineTo(q.x, q.y + 5);
      ctx.lineTo(q.x - 4, q.y);
      ctx.fill();
    }
    const dp = P(sim.david.x, sim.david.y);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(dp.x, dp.y, 3.2 + Math.sin(now * 5) * 0.6, 0, TAU);
    ctx.fill();
    // the view's frame
    ctx.strokeStyle = 'rgba(255,255,255,.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(dp.x - sim.viewHW * sx, dp.y - sim.viewHH * sy, sim.viewHW * 2 * sx, sim.viewHH * 2 * sy);
    ctx.restore();
  }

  // ── the camp's sheet ─────────────────────────────────────────────────
  /** The camp's sheet: the treasury and "Na łowy" on its edge, the tabs, the tab's tiles (scrolling, clipped). */
  drawCamp(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, now: number, k: number): void {
    this.sheetShown = null;
    if (!sim.inCamp || sim.story || sim.sitting || k <= 0.01) {
      this.lastTab = null;
      return;
    }
    if (this.lastTab !== sim.campTab) {
      // a new tab (or the sheet just opened) starts at its top
      this.scroll = 0;
      this.fling = 0;
      this.lastTab = sim.campTab;
    }
    const u = L.u, S = L.sheet;
    const tiles = sim.tiles();
    const g = this.sheetNow(L, tiles.length, k);
    this.scroll = clamp(this.scroll, 0, g.maxScroll);
    this.sheetShown = g;
    ctx.save();
    ctx.globalAlpha = Math.min(1, k * 1.6);
    // the panel (at the bottom it runs off the screen's lower edge)
    const fr = S.dock === 'bottom' ? { x: g.frame.x, y: g.frame.y, w: g.frame.w, h: L.h - g.frame.y + 24 } : g.frame;
    ctx.fillStyle = 'rgba(30,20,10,.25)';
    ctx.beginPath();
    ctx.roundRect(fr.x - 1, fr.y - 3, fr.w + 2, fr.h + 4, 18 * u);
    ctx.fill();
    panel(ctx, fr, 'rgba(246,235,211,.98)', C.goldDeep, 16 * u, 2);
    // the treasury: what the camp has to spend
    const p = sim.p, head = g.head;
    const items: [('silver' | 'wood' | 'stone'), number][] = [['silver', p.silver], ['wood', p.wood], ['stone', p.stone]];
    ctx.font = font(800, 14 * u, SANS);
    const iw = 20 * u;
    let tw = 12 * u;
    for (const [, v] of items) tw += iw + 4 * u + ctx.measureText(fmtNum(v)).width + 12 * u;
    const plate = { x: head.x, y: head.y, w: Math.min(tw, g.hunt.x - head.x - 8 * u), h: head.h };
    panel(ctx, plate, C.parchmentDeep, C.goldDeep, plate.h / 2);
    let x = plate.x + 12 * u;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const [kind, v] of items) {
      const cy = plate.y + plate.h / 2;
      icon(ctx, kind, x + iw / 2, cy, kind === 'wood' ? 18 * u : 15 * u, now);
      ctx.fillStyle = C.ink;
      ctx.font = font(800, 14 * u, SANS);
      const s = fmtNum(v);
      ctx.fillText(s, x + iw + 4 * u, cy + 0.5);
      x += iw + 4 * u + ctx.measureText(s).width + 12 * u;
      if (x > plate.x + plate.w - 20 * u) break;
    }
    // "Na łowy": back to the hunt (one tap, the thumb's way out of the camp)
    const hb = g.hunt, hp = this.isPressed('hunt');
    ctx.save();
    if (hp) {
      ctx.translate(hb.x + hb.w / 2, hb.y + hb.h / 2);
      ctx.scale(0.94, 0.94);
      ctx.translate(-(hb.x + hb.w / 2), -(hb.y + hb.h / 2));
    }
    panel(ctx, hb, hp ? C.terracottaDeep : C.terracotta, 'rgba(90,40,20,.6)', hb.h / 2, 2);
    const ht = fitText(ctx, `${t('camp.hunt')} ›`, hb.w - 16 * u, 14 * u, 800, SANS, MIN_READ);
    ctx.fillStyle = '#fff8e6';
    ctx.textAlign = 'center';
    ctx.fillText(ht, hb.x + hb.w / 2, hb.y + hb.h / 2 + 0.5);
    ctx.restore();
    // tabs
    g.tabs.forEach((rr, i) => {
      const id = TABS[i], on = sim.campTab === id, pr = this.isPressed('tab', i);
      panel(ctx, rr, on ? C.terracotta : pr ? 'rgba(43,33,24,.2)' : 'rgba(43,33,24,.08)', on ? null : 'rgba(43,33,24,.14)', 12 * u);
      const label = fitText(ctx, t(TAB_KEYS[id]), rr.w - 6, 13.5 * u, 800, SANS, MIN_READ);
      ctx.fillStyle = on ? '#fff8e6' : C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, rr.x + rr.w / 2, rr.y + rr.h / 2 + 0.5);
    });
    // tiles, clipped to the window
    const v = g.view;
    ctx.save();
    ctx.beginPath();
    ctx.rect(v.x - 4, v.y, v.w + 8, v.h);
    ctx.clip();
    tiles.forEach((tile, i) => {
      const rr = g.tiles[i];
      if (rr.y > v.y + v.h || rr.y + rr.h < v.y) return;
      this.drawTile(ctx, L, sim, tile, rr, i, now);
    });
    ctx.restore();
    // more below or above: a fade and a thin bar
    if (g.maxScroll > 0) {
      const sc = this.scroll / g.maxScroll;
      const bh = Math.max(24, v.h * (v.h / (v.h + g.maxScroll)));
      ctx.fillStyle = 'rgba(43,33,24,.35)';
      ctx.beginPath();
      ctx.roundRect(v.x + v.w + 1, v.y + (v.h - bh) * sc, 3, bh, 1.5);
      ctx.fill();
      if (this.scroll < g.maxScroll - 1) fade(ctx, v.x, v.y + v.h - 14 * u, v.w, 14 * u, false);
      if (this.scroll > 1) fade(ctx, v.x, v.y, v.w, 12 * u, true);
    }
    ctx.restore();
  }

  /** One tile: its name (and level), what the next step gives, and its price or why not. */
  private drawTile(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, tile: Tile, rr: Rect, i: number, now: number): void {
    const u = L.u;
    const ok = tile.why === 'ok' || tile.why === 'in' || tile.why === 'out';
    const can = tile.why === 'ok';
    const pr = this.isPressed('tile', i);
    ctx.save();
    if (pr) {
      ctx.translate(rr.x + rr.w / 2, rr.y + rr.h / 2);
      ctx.scale(0.96, 0.96);
      ctx.translate(-(rr.x + rr.w / 2), -(rr.y + rr.h / 2));
    }
    const nope = this.wobble('tile', i);
    if (nope) ctx.translate(nope, 0);
    panel(ctx, rr, tile.why === 'in' ? 'rgba(234,181,61,.28)' : pr ? '#f3e2bb' : can ? '#fffaf0' : 'rgba(43,33,24,.06)', can ? C.gold : 'rgba(43,33,24,.2)', 10 * u, can ? 2 : 1.2);
    if (can) {
      ctx.save();
      ctx.globalAlpha *= 0.22 + 0.14 * Math.sin(now * 4 + i);
      panel(ctx, rr, 'rgba(255,220,130,.45)', null, 10 * u);
      ctx.restore();
    }
    const pad = 7 * u, room = rr.w - 2 * pad;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    // the name, with its level when it fits
    const lv = tile.kind === 'mate' || tile.kind === 'cave' || tile.lv <= 0 ? '' : ` · ${tile.lv}`;
    let title = `${tile.title}${lv}`;
    let lvAside = '';
    ctx.font = font(800, 14 * u, SANS);
    if (lv && ctx.measureText(title).width > room) {
      ctx.font = font(800, MIN_READ, SANS);
      if (ctx.measureText(title).width > room) {
        title = tile.title;
        lvAside = t('camp.lv', { n: tile.lv });
      }
    }
    ctx.fillStyle = ok ? C.ink : 'rgba(43,33,24,.55)';
    const name = fitText(ctx, title, room, 14 * u, 800, SANS, MIN_READ);
    ctx.fillText(name, rr.x + pad, rr.y + 7 * u);
    // what it gives
    ctx.fillStyle = ok ? C.inkSoft : 'rgba(43,33,24,.5)';
    const fx = fitText(ctx, tile.fx, room, 13 * u, 600, SANS, 12);
    ctx.fillText(fx, rr.x + pad, rr.y + 25 * u);
    // the price or the reason
    const reason = whyText(tile.kind, tile.id, tile.why);
    ctx.textBaseline = 'alphabetic';
    const base = rr.y + rr.h - 9 * u;
    let used = 0;
    if (!reason && tile.price) used = this.drawPrice(ctx, tile.price, rr.x + pad, base, room, u, sim, now);
    else {
      ctx.fillStyle = can ? C.goldDeep : tile.why === 'silver' ? C.terracottaDeep : 'rgba(43,33,24,.62)';
      const s = fitText(ctx, reason ?? tile.cost, room, 13 * u, 700, SANS, 12);
      ctx.fillText(s, rr.x + pad, base);
      used = ctx.measureText(s).width;
    }
    if (lvAside) {
      ctx.font = font(700, 12 * u, SANS);
      const w = ctx.measureText(lvAside).width;
      if (used + w + 10 * u <= room) {
        ctx.fillStyle = 'rgba(43,33,24,.6)';
        ctx.textAlign = 'right';
        ctx.fillText(lvAside, rr.x + rr.w - pad, base);
      }
    }
    ctx.restore();
  }

  /** A price as icons and numbers (a silver coin, brushwood, a stone), each red when the treasury lacks it; returns its width. */
  private drawPrice(ctx: CanvasRenderingContext2D, price: readonly [number, number, number], x: number, y: number, maxW: number, u: number, sim: DawidSim, now: number): number {
    const p = sim.p, have = [p.silver, p.wood, p.stone];
    let cx = x;
    const iw = 16 * u;
    ctx.font = font(800, 13 * u, SANS);
    ctx.textAlign = 'left';
    for (let i = 0; i < 3; i++) {
      if (price[i] <= 0) continue;
      const txt = fmtNum(price[i]);
      const w = iw + 3 * u + ctx.measureText(txt).width;
      if (cx > x && cx - x + w > maxW) break;
      icon(ctx, i === 0 ? 'silver' : i === 1 ? 'wood' : 'stone', cx + iw / 2, y - 4.5 * u, i === 1 ? 15 * u : 12.5 * u, now);
      ctx.fillStyle = have[i] >= price[i] ? C.ink : C.terracottaDeep;
      ctx.fillText(txt, cx + iw + 3 * u, y);
      cx += w + 9 * u;
    }
    return cx - x;
  }

  // ── cards, bubbles, banners ──────────────────────────────────────────
  /** The opening card, a land's card, a guardian driven off, the people the quests lead to. */
  drawStory(ctx: CanvasRenderingContext2D, L: Layout, sim: DawidSim, touch: boolean): void {
    this.storyBox = null;
    const st = sim.story;
    if (!st || st.t < 0) return;
    const u = L.u, k = Math.min(1, st.t / 0.35), out = st.dur - st.t < 0.3 ? (st.dur - st.t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(k, out));
    ctx.fillStyle = 'rgba(24,18,12,.6)';
    ctx.fillRect(0, 0, L.w, L.h);
    const room = L.bottom - L.top - 16;
    // a short screen (a phone on its side) gets a wider card and a little smaller words
    const short = room < 360;
    const w = Math.min(L.right - L.left - 24, (short ? 640 : 500) * u);
    const pad = (short ? 14 : 18) * u;
    const titleSize = (short ? 21 : 23) * u, titleLh = (short ? 26 : 29) * u, textSize = (short ? 14.5 : 15.5) * u, textLh = (short ? 19.5 : 21) * u;
    ctx.font = font(800, titleSize, SERIF, true);
    const titleLines = wrap(ctx, st.title, w - pad * 2).slice(0, short ? 1 : 2);
    ctx.font = font(500, textSize, SANS);
    const footer = 28 * u;
    let lines = wrap(ctx, st.text, w - pad * 2);
    const fixed = pad * 2 + titleLines.length * titleLh + 6 * u + footer;
    // the verse first: it gets its room (leaving the story two lines at least), the story the rest
    let vh = 0;
    if (st.verse) {
      const ps = passage(st.verse);
      const avail = Math.max(48, room - fixed - Math.min(lines.length, 2) * textLh - 14 * u);
      if (!this.passage || this.passage.id !== st.verse || this.passage.w !== w || this.passage.h !== avail) {
        this.passage = { id: st.verse, l: layoutPassage(ctx, ps, w - pad * 2, avail - 6, { max: short ? 16 : 18, min: 13.5 }), w, h: avail };
      }
      vh = this.passage.l.height + 4 + 14 * u;
      ctx.font = font(500, textSize, SANS);
    }
    const maxLines = Math.max(2, Math.floor((room - fixed - vh) / textLh));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s,;:.]+$/, '')}…`;
    }
    const h = Math.min(room, fixed + lines.length * textLh + vh);
    const r = { x: (L.left + L.right - w) / 2, y: L.top + Math.max(8, Math.min(40 * u, (L.bottom - L.top - h) / 3)), w, h };
    this.storyBox = r;
    panel(ctx, r, C.parchment, C.goldDeep, 16 * u, 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = r.x + r.w / 2;
    ctx.fillStyle = C.ink;
    ctx.font = font(800, titleSize, SERIF, true);
    let y = r.y + pad;
    for (const l of titleLines) { ctx.fillText(l, cx, y); y += titleLh; }
    y += 6 * u;
    ctx.font = font(500, textSize, SANS);
    ctx.fillStyle = C.inkSoft;
    for (const l of lines) { ctx.fillText(l, cx, y); y += textLh; }
    if (st.verse && this.passage) drawVerse(ctx, passage(st.verse), this.passage.l, cx, y + 12 * u);
    ctx.font = font(800, 13.5 * u, SANS);
    ctx.fillStyle = C.goldDeep;
    ctx.textBaseline = 'bottom';
    const next = st.kind === 'open' ? (touch ? t('story.tap') : t('story.tap.keys')) : touch ? t('story.next') : t('story.next.keys');
    ctx.fillText(fitText(ctx, next, w - pad * 2, 13.5 * u, 800, SANS, MIN_READ), cx, r.y + h - pad + 4 * u);
    ctx.restore();
  }

  /**
   * A speech bubble over someone's head, kept in the field (under the quest pill, above the bottom band and
   * the camp's sheet, so it never covers a control); Goliath's is red-brown.
   */
  drawBubble(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, k: number, loud: boolean, floor: number): void {
    const u = L.u;
    ctx.save();
    ctx.font = font(loud ? 800 : 650, 14.5 * u, SANS);
    const maxW = Math.min(270 * u, L.right - L.left - 24);
    const lines = wrap(ctx, text, maxW - 22 * u);
    const lh = 18.5 * u;
    const bw = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 22 * u), bh = lines.length * lh + 14 * u;
    const bx = clamp(x - bw * 0.3, L.left + 8, L.right - bw - 8);
    const by = clamp(y - bh - 12 * u, L.field.top + 2, Math.max(L.field.top + 2, floor - bh - 4));
    ctx.globalAlpha = Math.min(1, k * 4);
    ctx.fillStyle = loud ? '#7a3424' : '#fffaf0';
    ctx.strokeStyle = loud ? 'rgba(255,220,180,.6)' : 'rgba(43,33,24,.35)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12 * u);
    ctx.fill();
    ctx.stroke();
    const tx = clamp(x, bx + 14, bx + bw - 14);
    if (by + bh < y - 4) {
      ctx.beginPath();
      ctx.moveTo(tx - 7 * u, by + bh - 1);
      ctx.lineTo(x, Math.min(y - 4, by + bh + 11 * u));
      ctx.lineTo(tx + 7 * u, by + bh - 1);
      ctx.fill();
    }
    ctx.fillStyle = loud ? '#ffe9c8' : C.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, bx + 11 * u, by + 7 * u + i * lh));
    ctx.restore();
  }

  /** A short banner under the top band ("Poziom 12!", "Lew się budzi!"). */
  drawBanner(ctx: CanvasRenderingContext2D, L: Layout, text: string, k: number, color: string, big = false): void {
    const u = L.u;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const a = k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    const size = (big ? 30 : 22) * u;
    ctx.font = font(900, size, SERIF, true);
    const maxW = L.right - L.left - 28;
    const fit = Math.min(1, maxW / Math.max(1, ctx.measureText(text).width));
    ctx.font = font(900, Math.max(16, size * fit) * pop, SERIF, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = L.bannerY + (big ? 10 * u : 0);
    ctx.lineWidth = 5 * u;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(30,20,10,.65)';
    const cx = (L.left + L.right) / 2;
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, y);
    ctx.restore();
  }

  /** The level-up's big words: the number and the gains. */
  drawLevelUp(ctx: CanvasRenderingContext2D, L: Layout, level: number, gain: string, k: number, ky: number): void {
    const u = L.u;
    const pop = k < 0.2 ? ease.outElastic(k / 0.2) : 1;
    const a = k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = (L.left + L.right) / 2;
    const y = Math.max(L.field.top + 26 * u, ky - L.s * 2.6 - 20 * u * ease.outCubic(k));
    ctx.font = font(900, 38 * u * pop, SERIF, true);
    ctx.lineWidth = 6 * u;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(60,30,0,.55)';
    const text = t('hud.levelUp', { n: level });
    ctx.strokeText(text, cx, y);
    ctx.fillStyle = C.goldLight;
    ctx.fillText(text, cx, y);
    ctx.font = font(800, 15 * u, SANS);
    ctx.lineWidth = 4 * u;
    ctx.strokeText(gain, cx, y + 30 * u);
    ctx.fillStyle = '#fff8e6';
    ctx.fillText(gain, cx, y + 30 * u);
    ctx.restore();
  }

  /** "+48 XP ×3" over a beast driven off. */
  static xpWords(v: number, mult: number): string {
    return mult > 1 ? `+${xpText(v)} ×${fmtNum(mult, Number.isInteger(mult) ? 0 : 1)}` : `+${xpText(v)}`;
  }
}

/** A resource's icon centred on (x, y), about `size` px across: a silver coin, brushwood, a stone. */
function icon(ctx: CanvasRenderingContext2D, kind: 'silver' | 'wood' | 'stone', x: number, y: number, size: number, now: number): void {
  if (kind === 'silver') {
    const s = size / 0.24;
    paintCoin(ctx, 'silver', x, y + 0.08 * s, s, now, 3);
  } else if (kind === 'wood') {
    const s = size / 0.36;
    paintCoin(ctx, 'wood', x, y + 0.1 * s, s, now, 3);
  } else {
    const s = size / 0.28;
    paintCoin(ctx, 'stone', x, y + 0.06 * s, s, now, 3);
  }
}

/** A dark disc at the origin (a button's face). */
function disc(ctx: CanvasRenderingContext2D, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,248,230,.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** A button's word under it, on a dark plate (readable on any grass). */
function label(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, color: string, size: number, bold: boolean): void {
  const u = L.u;
  const maxW = L.bag.hit.w + 8 * u;
  const s = fitText(ctx, text, maxW - 12 * u, size * u, bold ? 900 : 800, SANS, MIN_TEXT + 1);
  const w = Math.min(maxW, ctx.measureText(s).width + 12 * u), h = 18 * u;
  panel(ctx, { x: x - w / 2, y, w, h }, 'rgba(36,28,20,.8)', null, h / 2);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y + h / 2 + 0.5);
}

/** Text with a dark outline (numbers on a bar). */
function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, edge: string, lw: number): void {
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = edge;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** A soft fade over the sheet's window edge (more tiles beyond it): stacked translucent bands, no gradient. */
function fade(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, up: boolean): void {
  const n = 4;
  for (let i = 0; i < n; i++) {
    const a = 0.22 * (up ? (n - i) / n : (i + 1) / n);
    ctx.fillStyle = `rgba(246,235,211,${a})`;
    ctx.fillRect(x, y + (h / n) * i, w, h / n + 0.5);
  }
}

/** A passage on a story card: the verse (layoutPassage's lines) and its reference at a readable size. */
function drawVerse(ctx: CanvasRenderingContext2D, p: { text: string; ref: string; bible: string }, l: PassageLayout, cx: number, top: number): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.ink;
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = C.goldDeep;
  ctx.font = `600 ${Math.max(MIN_READ, l.refSize)}px ${REF_FONT}`;
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}
