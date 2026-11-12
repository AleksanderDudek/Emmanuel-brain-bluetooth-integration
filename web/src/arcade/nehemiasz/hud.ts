/**
 * Nehemiasz's own bits of the screen (the runner draws the Mendi panel and the score), phone first: the
 * panel in the thumb zone — the stores (stone, beams, bread, people, strength), the guide's button (by
 * day "Następne" with the build and its cost: a tap builds it; by night "Na mur!" with the night's
 * tally: a tap sends Nehemiah where it is hottest) and the ram's horn (a 64 px button: its charge as a
 * ring, gold and pulsing when ready) — the story cards (with a passage when the story has one), the
 * choice cards (a decree, a tower's way: stacked full width on a phone, 15–18 px) and the short banner
 * of the game's own news.  Canvas only; the cards' rectangles for taps and targets.  The cards' layouts
 * are pure functions of a measuring context, so the tests check them at every size.
 */
import { fmtNum } from '../../i18n';
import { clamp, ease } from '../kit/juice';
import { MIN_READ, fitText } from '../kit/mobile';
import { REF_FONT, VERSE_FONT, layoutPassage, passage, type PassageId, type PassageLayout } from '../kit/scripture';
import { GATES, decreeFx, decreeName, decreeRef, gateDays, gateName, kindName, markerSpec, tierName, type DecreeId } from './content';
import { t } from './i18n';
import type { Layout, Rect } from './layout';
import { room, stoneCap } from './meta';
import {
  C, SANS, SERIF, font, paintBreadIcon, paintHeartIcon, paintHornIcon, paintPeopleIcon, paintStoneIcon, paintTimberIcon, roundRect,
} from './paint';
import { RULES } from './rules';
import type { Choice, NehSim, Story } from './sim';

export interface Banner { text: string; color: string; t: number; dur: number; big: boolean }

/** What a finger is pressing right now (drawn pressed until it lifts). */
export type Press = { kind: 'guide' } | { kind: 'rush' } | { kind: 'horn' } | { kind: 'bubble' } | { kind: 'card'; i: number } | { kind: 'marker'; id: string } | null;

const STORY_VERSE: Partial<Record<Story['kind'], PassageId>> = {
  open: 'neh2.18', ono: 'neh6.3', wall: 'neh6.15', dedication: 'neh8.10', year: 'isa58.12',
};

// ── the cards' words and layouts (pure: a context only measures) ──────
export interface StoryText { kicker: string; title: string; text: string; verse?: PassageId }

export function storyText(s: Story): StoryText {
  const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const verse = STORY_VERSE[s.kind];
  switch (s.kind) {
    case 'open': return { kicker: gateName(0), title: t('story.open.title'), text: t('story.open.text'), verse };
    case 'gate': return {
      kicker: t('story.gate.kicker', { n: (s.gate % GATES.length) + 1, days: gateDays(s.gate) }),
      title: t('story.gate.title', { gate: gateName(s.gate) }),
      text: t(`gate.${GATES[s.gate % GATES.length]}.story` as Parameters<typeof t>[0]),
    };
    case 'done': return { kicker: stars(s.stars), title: t('story.done.title', { gate: gateName(s.gate) }), text: t('story.done.text', { gate: gateName(s.gate), next: gateName(s.next) }) };
    case 'horn': return { kicker: '', title: t('story.horn.title'), text: t('story.horn.text') };
    case 'ono': return { kicker: '', title: t('story.ono.title'), text: t('story.ono.text'), verse };
    case 'wall': return { kicker: stars(s.stars), title: t('story.wall.title'), text: t('story.wall.text'), verse };
    case 'dedication': return { kicker: '', title: t('story.dedication.title'), text: t('story.dedication.text'), verse };
    case 'year': return { kicker: '', title: t('story.year.title', { n: s.year + 1 }), text: t('story.year.text'), verse };
  }
}

export interface StoryLayout {
  rect: Rect;
  pad: number;
  /** the kicker line (left out on the tightest screens) */
  kicker: boolean;
  kickerPx: number;
  titlePx: number;
  titleLines: string[];
  textPx: number;
  lh: number;
  lines: string[];
  verse: PassageLayout | null;
  /** the passage's reference line, drawn at a readable size */
  refPx: number;
  footPx: number;
}

/** The room a card may take: the band under the HUD down to the screen's foot (the panel is dimmed under it). */
const cardRoom = (L: Layout) => ({ top: L.top + 8, bottom: L.h - L.ins.bottom - 8 });

/**
 * A story card that fits the screen: the text at 16 px (shrinking step by step to 13, never under) and
 * the passage whole (its size from 17 px down to 13), centred in the room under the HUD; on the tightest
 * screen the padding narrows and the kicker gives way before anything is cut.
 */
export function storyLayout(ctx: CanvasRenderingContext2D, L: Layout, st: StoryText): StoryLayout {
  const u = L.u, room2 = cardRoom(L);
  const cw = Math.min(L.right - L.left, 560 * u);
  const availH = room2.bottom - room2.top;
  let out: StoryLayout | null = null;
  const steps: [number, boolean][] = [[1, false], [0.94, false], [0.88, false], [0.82, false], [0.76, false], [0.76, true]];
  for (const [k, tight] of steps) {
    const pad = (tight ? 12 : 18 * k) * u, inner = cw - 2 * pad;
    const kicker = !!st.kicker && !tight;
    const textPx = Math.max(MIN_READ, 16 * u * k), titlePx = Math.max(18, 24 * u * k), kickerPx = Math.max(MIN_READ, 13 * u * k), footPx = Math.max(MIN_READ, 13 * u * k);
    ctx.font = font(titlePx, 600, SERIF);
    const titleLines = wrap(ctx, st.title, inner).slice(0, 2);
    ctx.font = font(textPx, 500);
    const lines = wrap(ctx, st.text, inner);
    const lh = Math.round(textPx * 1.34);
    const gap = (tight ? 6 : 8) * u;
    const fixed = pad + (kicker ? kickerPx * 1.6 : 0) + titleLines.length * titlePx * 1.2 + gap + lines.length * lh + footPx * (tight ? 1.9 : 2.4) + pad;
    let verse: PassageLayout | null = null, refPx = 12;
    let vh = 0;
    if (st.verse) {
      const vgap = (tight ? 8 : 14) * u;
      verse = layoutPassage(ctx, passage(st.verse), inner, Math.max(40, availH - fixed - vgap), { max: Math.max(textPx, 17 * u * k), min: MIN_READ });
      refPx = Math.max(13, verse.refSize);
      vh = verse.height + (refPx - verse.refSize) + vgap;
    }
    const ch = fixed + vh;
    out = { rect: { x: L.w / 2 - cw / 2, y: 0, w: cw, h: ch }, pad, kicker, kickerPx, titlePx, titleLines, textPx, lh, lines, verse, refPx, footPx };
    if (ch <= availH && (!verse || verse.fits)) break;
  }
  const lay = out!;
  lay.rect.y = Math.max(room2.top, room2.top + (availH - lay.rect.h) / 2 - 6 * u);
  return lay;
}

export interface ChoiceText { head: string; options: { ref: string; name: string; fx: string }[] }

export function choiceText(c: Choice): ChoiceText {
  const head = c.kind === 'decree' ? t('hud.decree') : `${kindName('tower')} · ${t('hud.choose')}`;
  const options = c.options.map(opt => {
    if (c.kind === 'decree') return { ref: decreeRef(opt as DecreeId), name: decreeName(opt as DecreeId), fx: decreeFx(opt as DecreeId) };
    return {
      ref: markerSpec(c.marker ?? 't0') ? tierName('tower', 2) : '',
      name: t(opt === 'quick' ? 'tower.quick' : 'tower.far'),
      fx: opt === 'quick'
        ? t('tower.quick.text', { s: fmtNum(RULES.towerEvery[2] * RULES.towerQuick, 2), t: fmtNum(RULES.towerEvery[2], 2) })
        : t('tower.far.text'),
    };
  });
  return { head, options };
}

export interface ChoiceLayout {
  headY: number;
  headPx: number;
  cards: Rect[];
  pad: number;
  refPx: number;
  namePx: number;
  nameLh: number;
  fxPx: number;
  fxLh: number;
  names: string[][];
  fxs: string[][];
}

/** The choice cards: stacked full width on a phone (the effect at 15 px), side by side elsewhere. */
export function choiceLayout(ctx: CanvasRenderingContext2D, L: Layout, ct: ChoiceText): ChoiceLayout {
  const u = L.u, n = ct.options.length, room2 = cardRoom(L);
  const stack = L.phone;
  const span = L.right - L.left;
  const gap = 12 * u;
  const cw = stack ? span : Math.min((span - (n - 1) * gap) / n, 300 * u);
  const availH = room2.bottom - room2.top;
  let out: ChoiceLayout | null = null;
  for (const k of [1, 0.93, 0.87, 0.8]) {
    const pad = 14 * u * k, refPx = Math.max(MIN_READ, 13 * u * k), namePx = Math.max(15, 18 * u * k), fxPx = Math.max(MIN_READ, 15 * u * k), headPx = Math.max(16, 20 * u * k);
    const nameLh = Math.round(namePx * 1.2), fxLh = Math.round(fxPx * 1.32);
    const names: string[][] = [], fxs: string[][] = [];
    let ch = 0;
    for (const o of ct.options) {
      ctx.font = font(namePx, 650, SERIF);
      const nl = wrap(ctx, o.name, cw - 2 * pad).slice(0, 2);
      ctx.font = font(fxPx, 600);
      const fl = wrap(ctx, o.fx, cw - 2 * pad).slice(0, 5);
      names.push(nl);
      fxs.push(fl);
      ch = Math.max(ch, pad + (o.ref ? refPx * 1.5 : 0) + nl.length * nameLh + 6 * u + fl.length * fxLh + pad);
    }
    const headH = headPx * 1.7;
    const totalH = headH + (stack ? n * ch + (n - 1) * gap : ch);
    const y0 = Math.max(room2.top, room2.top + (availH - totalH) / 2 - 6 * u);
    const totalW = stack ? cw : n * cw + (n - 1) * gap;
    const x0 = L.w / 2 - totalW / 2;
    const cards = ct.options.map((_, i) => ({ x: stack ? x0 : x0 + i * (cw + gap), y: y0 + headH + (stack ? i * (ch + gap) : 0), w: cw, h: ch }));
    out = { headY: y0, headPx, cards, pad, refPx, namePx, nameLh, fxPx, fxLh, names, fxs };
    if (totalH <= availH) break;
  }
  return out!;
}

/**
 * The stores' strip: five numbers with their icons at 14 px (13 on a phone on its side), shrinking to 12
 * where the strip is narrow, spread with even gaps.  `fits`: everything inside the strip.
 */
export function storesFit(ctx: CanvasRenderingContext2D, L: Layout, texts: string[]): { px: number; r: number; pad: number; gapIcon: number; widths: number[]; gap: number; fits: boolean } {
  const b = L.stores, u = L.u;
  const r = Math.min(b.h * 0.27, 8 * u), pad = Math.min(16 * u, Math.max(10, b.h * 0.34)), gapIcon = 4 * u;
  let px = (L.side ? 13 : 14) * u, widths: number[] = [], free = 0;
  for (;;) {
    ctx.font = font(px, 750);
    widths = texts.map(text => r * 2 + gapIcon + ctx.measureText(text).width);
    free = (b.w - 2 * pad - widths.reduce((a, c) => a + c, 0)) / (texts.length - 1);
    if (free >= 8 || px <= 12) break;
    px -= 1;
  }
  const gap = Math.max(6, free);
  const total = 2 * pad + widths.reduce((a, c) => a + c, 0) + gap * (texts.length - 1);
  return { px, r, pad, gapIcon, widths, gap, fits: total <= b.w + 0.5 };
}

export class Hud {
  /** the choice cards as laid out (for taps and targets) */
  cards: Rect[] = [];
  /** the story card as laid out (a tap anywhere moves on) */
  storyRect: Rect | null = null;
  private storyKey = '';
  private storyLay: StoryLayout | null = null;
  private choiceKey = '';
  private choiceLay: ChoiceLayout | null = null;
  private pulse = 0;
  /** the horn's button shakes a moment when pressed before it is ready */
  private hornNo = 0;

  constructor(private readonly touch: boolean) {}

  update(dt: number): void {
    this.pulse += dt;
    this.hornNo = Math.max(0, this.hornNo - dt);
  }

  hornNotReady(): void { this.hornNo = 0.4; }

  cardAt(x: number, y: number): number {
    return this.cards.findIndex(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
  }

  /** Lay the cards out for what is on screen now (taps and targets read them before a frame is drawn). */
  layoutCards(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    this.cards = [];
    this.storyRect = null;
    if (sim.story) {
      const st = storyText(sim.story);
      const key = `${sim.story.kind}:${st.title}:${L.w}x${L.h}:${L.top}:${L.ins.bottom}`;
      if (key !== this.storyKey || !this.storyLay) {
        this.storyKey = key;
        ctx.save();
        this.storyLay = storyLayout(ctx, L, st);
        ctx.restore();
      }
      this.storyRect = this.storyLay.rect;
    } else if (sim.choice) {
      const ct = choiceText(sim.choice);
      const key = `${sim.choice.kind}:${sim.choice.options.join(',')}:${L.w}x${L.h}:${L.top}:${L.ins.bottom}`;
      if (key !== this.choiceKey || !this.choiceLay) {
        this.choiceKey = key;
        ctx.save();
        this.choiceLay = choiceLayout(ctx, L, ct);
        ctx.restore();
      }
      this.cards = this.choiceLay.cards;
    }
  }

  draw(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, banner: Banner | null, press: Press): void {
    this.panel(ctx, sim, L, press);
    if (banner) this.drawBanner(ctx, L, banner);
    this.layoutCards(ctx, sim, L);
    if (sim.story && this.storyLay) this.story(ctx, sim, L, this.storyLay);
    else if (sim.choice && this.choiceLay) this.choice(ctx, sim, L, this.choiceLay, press);
  }

  // ── the panel: the stores, the guide's button, the horn ──────────
  private panel(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, press: Press): void {
    const p = L.panel;
    // a soft dark foot, so the buttons read on sand and on the night alike
    const g = ctx.createLinearGradient(0, p.y - 16, 0, p.y + 30);
    g.addColorStop(0, 'rgba(22,16,12,0)');
    g.addColorStop(1, 'rgba(22,16,12,.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, p.y - 16, L.w, L.h - p.y + 16);
    this.stores(ctx, sim, L);
    if (sim.nightTime) {
      this.rush(ctx, sim, L, press?.kind === 'rush');
      this.horn(ctx, sim, L, press?.kind === 'horn');
    } else this.guide(ctx, sim, L, press?.kind === 'guide');
  }

  private stores(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout): void {
    const p = sim.p, b = L.stores;
    ctx.save();
    ctx.fillStyle = 'rgba(28,20,14,.74)';
    roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
    ctx.fill();
    const items: { icon: (x: number, y: number, r: number) => void; text: string; warn: boolean }[] = [
      { icon: (x, y, r) => paintStoneIcon(ctx, x, y, r), text: String(Math.floor(p.stone)), warn: p.stone >= stoneCap(p) - 0.5 },
      { icon: (x, y, r) => paintTimberIcon(ctx, x, y, r), text: String(Math.floor(p.timber)), warn: p.timber < 1 },
      { icon: (x, y, r) => paintBreadIcon(ctx, x, y, r), text: String(Math.floor(p.bread)), warn: p.bread < p.people },
      { icon: (x, y, r) => paintPeopleIcon(ctx, x, y, r), text: `${p.people}/${room(p)}`, warn: false },
      { icon: (x, y, r) => paintHeartIcon(ctx, x, y, r, p.strength), text: `${Math.round(p.strength * 100)}%`, warn: p.strength < 0.5 },
    ];
    const fit = storesFit(ctx, L, items.map(it => it.text));
    ctx.font = font(fit.px, 750);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let x = b.x + fit.pad;
    const y = b.y + b.h / 2;
    items.forEach((it, i) => {
      it.icon(x + fit.r, y, fit.r);
      ctx.fillStyle = it.warn ? '#ffb39a' : '#fff4dc';
      ctx.fillText(it.text, x + fit.r * 2 + fit.gapIcon, y + 1);
      x += fit.widths[i] + fit.gap;
    });
    ctx.restore();
  }

  /** A button's body: a rounded slab that sinks a little while pressed. */
  private slab(ctx: CanvasRenderingContext2D, r: Rect, fill: string, edge: string, edgeW: number, pressed: boolean): void {
    const k = pressed ? 0.965 : 1;
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(k, k);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    roundRect(ctx, r.x, r.y + 3, r.w, r.h, Math.min(16, r.h / 2));
    ctx.fill();
    ctx.fillStyle = fill;
    roundRect(ctx, r.x, r.y + (pressed ? 2 : 0), r.w, r.h, Math.min(16, r.h / 2));
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = edgeW;
    ctx.stroke();
  }

  /** By day: what the guide suggests and its cost; a tap builds it. */
  private guide(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, pressed: boolean): void {
    const g = L.guide, u = L.u;
    let name = '', cost: { stone: number; timber: number } | null = null;
    const on = !!sim.guideId;
    if (sim.guideId) {
      const mv = sim.markerView(sim.guideId);
      const m = markerSpec(sim.guideId)!;
      name = mv.next !== null ? tierName(m.kind, mv.next) : kindName(m.kind);
      cost = mv.cost;
    } else name = t('hud.nextNone');
    ctx.save();
    const glowA = 0.55 + 0.35 * Math.sin(this.pulse * 4);
    this.slab(ctx, g, on ? (pressed ? '#ffe2a0' : '#ffecbe') : 'rgba(28,20,14,.8)', on ? `rgba(214,150,40,${glowA})` : 'rgba(255,255,255,.18)', on ? 2.5 : 1.5, pressed);
    const dy = pressed ? 2 : 0;
    const ink = on ? C.ink : '#fff4dc';
    // the play mark
    const tx = g.x + g.h * 0.36, ty = g.y + g.h / 2 + dy, ts = g.h * 0.16;
    ctx.fillStyle = on ? '#b5761f' : 'rgba(255,244,220,.6)';
    ctx.beginPath();
    ctx.moveTo(tx - ts * 0.7, ty - ts);
    ctx.lineTo(tx + ts, ty);
    ctx.lineTo(tx - ts * 0.7, ty + ts);
    ctx.closePath();
    ctx.fill();
    // the cost at the right end
    let right = g.x + g.w - g.h * 0.32;
    if (cost) {
      const r = 7.5 * u;
      const parts: [number, (x: number, y: number, r: number) => void, boolean][] = [];
      if (cost.timber > 0) parts.push([cost.timber, (xx, yy, rr) => paintTimberIcon(ctx, xx, yy, rr), sim.p.timber >= cost.timber]);
      if (cost.stone > 0) parts.push([cost.stone, (xx, yy, rr) => paintStoneIcon(ctx, xx, yy, rr), sim.p.stone >= cost.stone]);
      ctx.font = font(15 * u, 800);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (const [n, icon, ok] of parts) {
        ctx.fillStyle = ok ? C.ink : C.red;
        ctx.fillText(String(n), right, g.y + g.h / 2 + 1 + dy);
        right -= ctx.measureText(String(n)).width + r + 4;
        icon(right, g.y + g.h / 2 + dy, r);
        right -= r + 10 * u;
      }
    }
    const x0 = tx + ts + 10 * u, avail = right - x0 - 4;
    ctx.textAlign = 'left';
    if (on) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#9a6420';
      const cap = fitText(ctx, t('hud.next').toUpperCase(), avail, 13 * u, 800, SANS, 12);
      ctx.fillText(cap, x0, g.y + g.h * 0.4 + dy);
      ctx.fillStyle = ink;
      const nm = fitText(ctx, name, avail, 16 * u, 750, SANS, MIN_READ);
      ctx.fillText(nm, x0, g.y + g.h * 0.78 + dy);
    } else {
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ink;
      const nm = fitText(ctx, name, avail, 15 * u, 700, SANS, MIN_READ);
      ctx.fillText(nm, x0, g.y + g.h / 2 + 1 + dy);
    }
    ctx.restore();
  }

  /** By night: "To the wall!" (or after a raider inside the city) with the night's tally; a tap sends Nehemiah. */
  private rush(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, pressed: boolean): void {
    const g = L.rush, u = L.u;
    const inside = sim.raiders.some(r => r.state !== 'flee' && r.y > RULES.wallIn);
    ctx.save();
    this.slab(ctx, g, pressed ? 'rgba(58,50,92,.95)' : 'rgba(34,30,60,.9)', inside ? 'rgba(255,150,120,.8)' : 'rgba(255,236,200,.4)', inside ? 2.5 : 1.5, pressed);
    const dy = pressed ? 2 : 0;
    // an arrow up, to the wall
    const ax = g.x + g.h * 0.4, ay = g.y + g.h / 2 + dy, as = g.h * 0.17;
    ctx.fillStyle = inside ? '#ffb39a' : C.goldLight;
    ctx.beginPath();
    ctx.moveTo(ax, ay - as * 1.1);
    ctx.lineTo(ax + as, ay + as * 0.1);
    ctx.lineTo(ax + as * 0.38, ay + as * 0.1);
    ctx.lineTo(ax + as * 0.38, ay + as * 1.1);
    ctx.lineTo(ax - as * 0.38, ay + as * 1.1);
    ctx.lineTo(ax - as * 0.38, ay + as * 0.1);
    ctx.lineTo(ax - as, ay + as * 0.1);
    ctx.closePath();
    ctx.fill();
    const x0 = ax + as + 10 * u, avail = g.x + g.w - x0 - g.h * 0.3;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff4dc';
    ctx.fillText(fitText(ctx, t(inside ? 'hud.chase' : 'hud.rush'), avail, 16 * u, 800, SANS, MIN_READ), x0, g.y + g.h * 0.47 + dy);
    ctx.fillStyle = 'rgba(255,244,220,.78)';
    ctx.fillText(fitText(ctx, `${t('stat.driven')}: ${sim.driven}`, avail, 13 * u, 700, SANS, 12), x0, g.y + g.h * 0.8 + dy);
    ctx.restore();
  }

  /** The ram's horn: its charge as a ring; ready, it turns gold and pulses, and a tap blows it. */
  private horn(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, pressed: boolean): void {
    const { x, y, r } = L.horn;
    const ready = sim.hornReady, u = L.u;
    const shake = this.hornNo > 0 ? Math.sin(this.hornNo * 70) * 4 * (this.hornNo / 0.4) : 0;
    ctx.save();
    ctx.translate(x + shake, y);
    if (ready) {
      // a halo that breathes (two strokes, no blur)
      const b = 0.5 + 0.5 * Math.sin(this.pulse * 6);
      ctx.strokeStyle = `rgba(255,211,107,${0.25 + 0.3 * b})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6 + 3 * b, 0, Math.PI * 2);
      ctx.stroke();
    }
    const k = (pressed ? 0.9 : 1) * (ready ? 1 + 0.04 * Math.sin(this.pulse * 6) : 1);
    ctx.scale(k, k);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.arc(0, 3, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ready ? '#6b4512' : 'rgba(22,20,40,.92)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    const lw = Math.max(4, r * 0.15);
    ctx.lineWidth = lw;
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.arc(0, 0, r - lw / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = ready ? C.gold : '#ffe2a8';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, r - lw / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(sim.horn));
    ctx.stroke();
    paintHornIcon(ctx, -r * 0.04, -r * 0.16, r * 0.5, ready ? C.goldLight : '#cdbf9e');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ready ? C.goldLight : 'rgba(255,244,220,.8)';
    const label = ready ? t('hud.hornTap') : `${Math.floor(clamp(sim.horn) * 100)}%`;
    ctx.fillText(fitText(ctx, label, r * 1.5, (ready ? 14 : 13) * u, 800, SANS, 12), 0, r * 0.45);
    ctx.restore();
  }

  // ── the banner (the game's own news) ────────────────────────────
  private drawBanner(ctx: CanvasRenderingContext2D, L: Layout, b: Banner): void {
    const k = b.t / b.dur;
    const a = k < 0.12 ? k / 0.12 : k > 0.75 ? Math.max(0, 1 - (k - 0.75) / 0.25) : 1;
    const pop = k < 0.15 ? ease.outBack(k / 0.15) : 1;
    const y = L.top + (L.bottom - L.top) * 0.42;
    const maxW = L.right - L.left;
    ctx.save();
    ctx.globalAlpha = a;
    const px = (b.big ? 26 : 18) * L.u;
    const text = fitText(ctx, b.text, maxW - 28 * L.u, px, 800, b.big ? SERIF : SANS, 14);
    const w = Math.min(maxW, ctx.measureText(text).width + 28 * L.u);
    const h = (b.big ? 44 : 34) * L.u;
    ctx.translate(L.w / 2, y);
    ctx.scale(pop, pop);
    ctx.fillStyle = 'rgba(25,18,12,.62)';
    roundRect(ctx, -w / 2, -h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = b.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);
    ctx.restore();
  }

  // ── the story cards ─────────────────────────────────────────────
  private story(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, lay: StoryLayout): void {
    const s = sim.story!, u = L.u, r = lay.rect;
    const st = storyText(s);
    const a = clamp(s.t / 0.35);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,12,24,.6)';
    ctx.fillRect(0, 0, L.w, L.h);
    const pop = ease.outBack(clamp(s.t / 0.35));
    const cx = L.w / 2;
    ctx.translate(cx, r.y + r.h / 2);
    ctx.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop);
    ctx.translate(-cx, -(r.y + r.h / 2));
    ctx.fillStyle = C.paper;
    roundRect(ctx, r.x, r.y, r.w, r.h, 18 * u);
    ctx.fill();
    ctx.strokeStyle = C.paperEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    let y = r.y + lay.pad;
    const tight = lay.pad < 14 * u;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    if (lay.kicker) {
      ctx.font = font(lay.kickerPx, 800);
      ctx.fillStyle = '#a5743a';
      ctx.fillText(st.kicker.toUpperCase(), cx, y);
      y += lay.kickerPx * 1.6;
    }
    ctx.font = font(lay.titlePx, 600, SERIF);
    ctx.fillStyle = C.ink;
    for (const line of lay.titleLines) {
      ctx.fillText(line, cx, y);
      y += lay.titlePx * 1.2;
    }
    y += (tight ? 6 : 8) * u;
    ctx.font = font(lay.textPx, 500);
    ctx.fillStyle = '#4a3a2c';
    for (const line of lay.lines) {
      ctx.fillText(line, cx, y);
      y += lay.lh;
    }
    if (st.verse && lay.verse) {
      y += (tight ? 6 : 10) * u;
      drawVerse(ctx, st.verse, lay.verse, lay.refPx, cx, y);
    }
    ctx.font = font(lay.footPx, 700);
    ctx.fillStyle = `rgba(120,90,50,${s.t >= RULES.minCard ? 0.9 : 0.4})`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t(this.touch ? 'hud.tap' : 'hud.tapKeys'), cx, r.y + r.h - lay.pad);
    ctx.restore();
  }

  // ── the choice cards ────────────────────────────────────────────
  private choice(ctx: CanvasRenderingContext2D, sim: NehSim, L: Layout, lay: ChoiceLayout, press: Press): void {
    const c = sim.choice!, u = L.u;
    const ct = choiceText(c);
    const a = clamp(c.t / 0.3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(16,12,24,.5)';
    ctx.fillRect(0, 0, L.w, L.h);
    ctx.font = font(lay.headPx, 650, SERIF);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff4dc';
    ctx.fillText(ct.head, L.w / 2, lay.headY);
    ct.options.forEach((opt, i) => {
      const r = lay.cards[i];
      const pressed = press?.kind === 'card' && press.i === i;
      const pop = ease.outBack(clamp((c.t - i * 0.06) / 0.3)) * (pressed ? 0.97 : 1);
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
      ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
      ctx.fillStyle = pressed ? '#ffe6b0' : i === 0 ? '#fff1cf' : C.paper;
      roundRect(ctx, r.x, r.y, r.w, r.h, 14 * u);
      ctx.fill();
      ctx.strokeStyle = pressed ? C.gold : i === 0 ? '#d6a24a' : C.paperEdge;
      ctx.lineWidth = pressed ? 3 : 2;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      let y = r.y + lay.pad;
      if (opt.ref) {
        ctx.font = font(lay.refPx, 800);
        ctx.fillStyle = '#a5743a';
        ctx.fillText(opt.ref.toUpperCase(), r.x + lay.pad, y);
        y += lay.refPx * 1.5;
      }
      ctx.font = font(lay.namePx, 650, SERIF);
      ctx.fillStyle = C.ink;
      for (const l of lay.names[i]) {
        ctx.fillText(l, r.x + lay.pad, y);
        y += lay.nameLh;
      }
      y += 6 * u;
      ctx.font = font(lay.fxPx, 600);
      ctx.fillStyle = '#5a4632';
      for (const l of lay.fxs[i]) {
        ctx.fillText(l, r.x + lay.pad, y);
        y += lay.fxLh;
      }
      ctx.restore();
    });
    ctx.restore();
  }
}

/** A laid-out passage, centred on `cx` from `top` down, its reference at a readable size. */
function drawVerse(ctx: CanvasRenderingContext2D, id: PassageId, l: PassageLayout, refPx: number, cx: number, top: number): void {
  const p = passage(id);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#5a3f22';
  ctx.font = `italic 400 ${l.size}px ${VERSE_FONT}`;
  l.lines.forEach((line, i) => ctx.fillText(line, cx, top + i * l.lineH));
  ctx.fillStyle = '#a5743a';
  ctx.font = `600 ${refPx}px ${REF_FONT}`;
  ctx.fillText(`${p.ref} · ${p.bible}`, cx, top + l.lines.length * l.lineH + Math.round(l.size * 0.55));
  ctx.restore();
}

/** Greedy word wrap with the context's current font. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (!w) continue;
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = w;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
