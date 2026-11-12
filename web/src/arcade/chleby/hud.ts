/**
 * Chleby i ryby's words and cards on the play canvas (v3, phone first).  The runner draws the band's
 * panel, the score and the coach marks; this draws only what belongs to the game's story: the words
 * floating over the hill ("+12", "Syci!", "Bum!"), the companion's speech bubble (Mirka on her post,
 * the boy by his basket — kept off the help button and the sheets), the banner of a new level, terrace,
 * glutton, tier or day, and the cards between levels — the level fed (its stars, the baskets earned
 * and the path of hillsides with the player's place on it), the bundles' reveal (the cards flip in one
 * by one with their rarity, "Nowa!", their level, an evolution), the village (what to build, each a
 * finger-sized row with the building's picture) and the story cards (the opening with John 6:9, a
 * chapter, a glutton's first arena, the village, the collection) — and the evening.
 *
 * On a phone held upright the cards are bottom sheets that rise into the thumb zone; on its side and on
 * a desktop, side sheets on the left (layout.ts places them, and the taps use the same rectangles).
 * Text is sized for a 360 px phone at u = 1: 14–15 px in bubbles and cards, 13 px at the least for
 * anything to read, never under 11 px (paint.ts font()); every string is fitted to its room so it reads
 * on a small phone in German and Swedish.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { MIN_READ, MIN_TEXT } from '../kit/mobile';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { RARITIES, cardDef, type Drop } from './cards';
import { CHAPTERS, STORIES, bossName, bossStory, buildName, buildText, cardName } from './content';
import { isBoss, placeOf } from './field';
import { baskets as basketsText, t } from './i18n';
import { revealGeo, sheetBox, villageGeo, wonBox, type Layout, type Rect } from './layout';
import type { BossKind } from './meta';
import { C, SANS, SERIF, font, glow, paintBasket, paintStar } from './paint';
import { RULES, type ChlebySim, type Pack } from './sim';
import { RARITY_COLOR, paintBuilding, paintCardArt } from './sprites';
import type { Who } from './content';

export type { Rect };

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Bubble { who: Who; text: string; t: number; dur: number }
type StoryKind = 'open' | 'chapter' | 'boss' | 'village' | 'cards';
interface Story { kind: StoryKind; chapter: number; boss: BossKind | null; t: number; out: number }
interface Banner { title: string; sub: string; t: number; dur: number; boss: boolean }

const TXT = {
  upTitle: t('upc.title'), upGo: t('upc.go'), storyTap: t('story.tap'), openTitle: t('story.openTitle'), openText: t('story.open'),
  wonTitle: t('won.title'), wonHelp: t('won.help'), path: t('won.path'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
  villageTitle: t('story.village.title'), village: t('story.village'), cardsTitle: t('story.cards.title'), cards: t('story.cards'),
  fresh: t('reveal.new'), evo: t('reveal.evo'), dust: t('reveal.dust'), revealTap: t('reveal.tap'),
};

const PX = /(\d+(?:\.\d+)?)px/;
const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Hud {
  private L!: Layout;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly floats: Float[] = [];
  private F = Hud.fontsFor(1);
  private finaleA = 0;
  private cardA = 0;
  private wonA = 0;
  private packA = 0;
  private bubble: Bubble | null = null;
  private story: Story | null = null;
  private banner: Banner | null = null;
  private verse: PassageLayout | null = null;
  private verseKey = '';
  private clock = 0;
  private readonly wraps = new Map<string, string[]>();
  /** the story card's box while it shows (taps on it close it) */
  storyRect: Rect | null = null;
  /** the sheet on screen now (the level fed, the reveal, the village, a story), for the bubble and the lane's slide */
  sheetRect: Rect | null = null;
  /** a row of the village sheet (or its "go on", -1) under a finger: it shows pressed for a moment */
  private pressRow = -2;
  private pressT = 0;
  /** the runner's coach mark on screen (where it points, until when): a banner steps aside for it */
  private mark: { y: number; until: number } | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private static fontsFor(u: number) {
    return {
      bubble: font(650, 14 * u, SANS), cardTitle: font(500, 19 * u, SERIF, true), cardSub: font(700, 14 * u, SANS),
      big: font(500, 24 * u, SERIF, true), banner: font(500, 28 * u, SERIF, true), bannerSub: font(750, 14 * u, SANS),
      storyTitle: font(500, 20 * u, SERIF, true), storyText: font(560, 15 * u, SANS), upName: font(750, 15 * u, SANS),
      upText: font(600, 13 * u, SANS), upPrice: font(850, 16 * u, SANS), go: font(850, 16 * u, SANS), map: font(800, 13 * u, SANS),
      stone: font(850, 13 * u, SANS), tile: font(750, 13 * u, SANS), badge: font(850, 13 * u, SANS), tap: font(650, 13 * u, SANS),
      more: font(900, 22 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
    this.verse = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const L = this.L, u = L.u;
    const f = font(900, Math.max(MIN_READ, size * u), SANS);
    // the whole word on screen (a long one by an edge, "Pomoc gotowa!" by the help button)
    this.ctx.font = f;
    const half = Math.min(L.w / 2 - 4, this.ctx.measureText(text).width / 2 + 8);
    x = clamp(x, Math.max(40 * u, half), L.w - Math.max(40 * u, half));
    // the words rise: start them low enough that they never go under the runner's HUD
    y = Math.max(y, L.hudTop + rise * u + size * u * 0.6 + 4);
    this.floats.push({ text, x, y, t: 0, dur, color, font: f, rise: rise * u });
    if (this.floats.length > 26) this.floats.shift();
  }

  say(who: Who, text: string, dur: number): void { this.bubble = { who, text, t: 0, dur }; }

  showBanner(title: string, sub: string, boss = false, dur = 2.2): void { this.banner = { title, sub, t: 0, dur, boss }; }

  showStory(kind: StoryKind, chapter: number, boss?: BossKind): void { this.story = { kind, chapter, boss: boss ?? null, t: 0, out: 0 }; }

  /** A tap hides a story card shown for a moment already; true when it did (the tap is used up). */
  hideStory(): boolean {
    const s = this.story;
    if (!s) return false;
    // the opening card holds a few seconds against eager taps, so it is read
    if (s.t < (s.kind === 'open' ? 3.5 : 1.5) || s.out > 0) return true;
    s.out = 0.001;
    return true;
  }

  get storyOn(): boolean { return this.story !== null; }

  /** The runner shows a coach mark pointing at height `y` for `sec` seconds. */
  marked(y: number, sec: number): void { this.mark = { y, until: this.clock + sec }; }

  /** A finger came down on the village sheet's row `i` (-1: "go on"): it shows pressed. */
  press(i: number): void {
    this.pressRow = i;
    this.pressT = 0.22;
  }

  update(dt: number, sim: ChlebySim): void {
    this.clock += dt;
    this.pressT = Math.max(0, this.pressT - dt);
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t >= f.dur) this.floats.splice(i, 1);
    }
    if (this.bubble) {
      this.bubble.t += dt;
      if (this.bubble.t >= this.bubble.dur) this.bubble = null;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t >= this.banner.dur) this.banner = null;
    }
    const s = this.story;
    if (s) {
      s.t += dt;
      if (s.out > 0) s.out += dt / 0.35;
      // the opening card stays 11 s at most, the others 6–7 s
      if (s.t > (s.kind === 'open' ? 11 : s.kind === 'chapter' ? 6 : 7) && s.out === 0) s.out = 0.001;
      if (s.out >= 1) this.story = null;
    }
    this.finaleA = approach(this.finaleA, sim.phase !== 'play' ? 1 : 0, dt, 0.25);
    this.cardA = approach(this.cardA, sim.stage === 'card' ? 1 : 0, dt, 0.12);
    this.wonA = approach(this.wonA, sim.stage === 'won' ? 1 : 0, dt, 0.15);
    this.packA = approach(this.packA, sim.stage === 'pack' ? 1 : 0, dt, 0.12);
  }

  /** A sheet (or a story card) is on screen or coming: the lane slides aside for a side sheet. */
  sheetOn(sim: ChlebySim): boolean {
    return this.story !== null || sim.stage === 'won' || sim.stage === 'pack' || sim.stage === 'card';
  }

  /**
   * `at`: where the speakers stand (their bubble's tail points there); `avoid`: what a bubble must not
   * cover (the help button).
   */
  draw(sim: ChlebySim, at: { mirka: { x: number; y: number }; boy: { x: number; y: number } }, avoid: Rect[]): void {
    this.sheetRect = null;
    this.drawBanner();
    this.drawWon(sim);
    this.drawReveal(sim);
    this.drawCard(sim);
    this.drawBubble(at, avoid);
    this.drawFinale();
    this.drawStory();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(r: Rect, a = 0.96): void {
    const ctx = this.ctx, u = this.L.u;
    // a shadow under the sheet so it reads as lifted over the hill
    ctx.fillStyle = 'rgba(40,25,10,.22)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y + 3, r.w, r.h, 16 * u);
    ctx.fill();
    ctx.fillStyle = `rgba(255,246,224,${a})`;
    ctx.strokeStyle = 'rgba(150,110,60,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 16 * u);
    ctx.fill();
    ctx.stroke();
    if (this.L.sheet === 'bottom') {
      // a grab bar: it is a sheet
      ctx.fillStyle = 'rgba(150,110,60,.35)';
      ctx.beginPath();
      ctx.roundRect(r.x + r.w / 2 - 18, r.y + 5, 36, 4, 2);
      ctx.fill();
    }
  }

  /**
   * Sets a font for `text` from `f` that fits `maxW` — shrunk at most to `floor` px (never under 11) —
   * and returns the text to draw, cut with "…" if even that is too wide.
   */
  private fit(text: string, maxW: number, f: string, floor = MIN_READ): string {
    const ctx = this.ctx;
    ctx.font = f;
    let w = ctx.measureText(text).width;
    if (w <= maxW || !text) return text;
    const m = f.match(PX);
    if (!m) return text;
    const size = Number(m[1]);
    const lo = Math.min(size, Math.max(MIN_TEXT, floor));
    ctx.font = f.replace(m[0], `${Math.max(lo, Math.floor(((size * maxW) / w) * 10) / 10)}px`);
    w = ctx.measureText(text).width;
    if (w <= maxW) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxW) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  }

  /** `text` wrapped to `maxW` in font `f`, at most `max` lines (the last one ends in "…" when cut); cached. */
  private lines(text: string, maxW: number, f: string, max: number): string[] {
    const key = `${f}|${Math.round(maxW)}|${max}|${text}`;
    let out = this.wraps.get(key);
    if (!out) {
      this.ctx.font = f;
      out = wrap(this.ctx, text, maxW);
      if (out.length > max) {
        out = out.slice(0, Math.max(1, max));
        const n = out.length;
        let last = out[n - 1];
        while (last.length > 1 && this.ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        out[n - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
      }
      if (this.wraps.size > 160) this.wraps.clear();
      this.wraps.set(key, out);
    }
    return out;
  }

  private outlined(text: string, x: number, y: number, fill: string, stroke = 'rgba(50,30,10,.7)', lw = 4): void {
    const ctx = this.ctx;
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw * this.L.u;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
  }

  /**
   * A sheet rising into place (`a` 0..1): from below on an upright phone, from the left on its side.
   * Call between save() and restore().
   */
  private enterSheet(r: Rect, a: number): void {
    const k = 1 - ease.outCubic(clamp(a));
    this.ctx.globalAlpha = clamp(a * 1.4);
    if (this.L.sheet === 'bottom') this.ctx.translate(0, k * (r.h * 0.35 + 24));
    else this.ctx.translate(-k * (r.w * 0.25 + 24), 0);
    this.sheetRect = r;
  }

  // ── floats and the banner ───────────────────────────────────────
  /** The words floating over the hill: drawn with the hill (they slide aside with it). */
  drawWorld(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = f.t < 0.15 ? ease.outBack(f.t / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      ctx.translate(f.x, f.y - f.rise * ease.outCubic(k));
      ctx.scale(pop, pop);
      ctx.font = f.font;
      this.outlined(f.text, 0, 0, f.color, 'rgba(50,30,10,.65)', 3.5);
      ctx.restore();
    }
  }

  private drawBanner(): void {
    const b = this.banner;
    if (!b || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, b.t / 0.2, (b.dur - b.t) / 0.4);
    const k = b.t < 0.3 ? ease.outBack(b.t / 0.3) : 1;
    // low on the lane (the runner's block banner sits high), unless a coach mark points there now
    const lane = L.lane, m = this.mark;
    const y = m && this.clock < m.until && Math.abs(m.y - L.bannerY) < 90 * u ? lane.yT + (lane.yB - lane.yT) * (m.y > L.bannerY ? 0.36 : 0.8) : L.bannerY;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(L.cardX, y);
    ctx.scale(k, k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = Math.min(L.w - 40, Math.max(L.lane.hwB * 2 - 20, 260 * u));
    const title = this.fit(b.title, maxW, F.banner, 18);
    const titleFont = ctx.font;
    const tw = ctx.measureText(title).width;
    const subLines = b.sub ? this.lines(b.sub, maxW - 16 * u, F.bannerSub, 2) : [];
    ctx.font = F.bannerSub;
    const sw = subLines.length ? Math.max(...subLines.map(l => ctx.measureText(l).width)) : 0;
    // a soft dark pill behind, so the words read over the crowd and the gates
    const bw = Math.min(L.w - 16, Math.max(tw, sw) + 48 * u);
    const lh = 19 * u;
    const bh = 50 * u + subLines.length * lh;
    ctx.fillStyle = 'rgba(40,28,14,.5)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -25 * u, bw, bh, 25 * u);
    ctx.fill();
    ctx.font = titleFont;
    this.outlined(title, 0, 0, b.boss ? '#ffd08a' : '#fff6e0', 'rgba(60,35,10,.75)', 5);
    ctx.font = F.bannerSub;
    subLines.forEach((l, i) => this.outlined(l, 0, 26 * u + i * lh, '#fff6e0', 'rgba(60,35,10,.7)', 3.5));
    ctx.restore();
  }

  // ── a level fed: stars, baskets, the path ───────────────────────
  private drawWon(sim: ChlebySim): void {
    const a = this.wonA;
    if (a < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const r = wonBox(L);
    const short = L.mode === 'short';
    const k = clamp(sim.stageT / RULES.wonHold);
    ctx.save();
    this.enterSheet(r, a);
    this.paper(r, 0.97);
    const cx = r.x + r.w / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.fillText(this.fit(TXT.wonTitle, r.w - 28 * u, F.cardTitle, MIN_READ), cx, r.y + 14 * u);
    const starY = r.y + (short ? 58 : 62) * u;
    for (let i = 0; i < 3; i++) {
      const kk = clamp((k * 3 - i * 0.35) / 0.6);
      if (kk <= 0) continue;
      paintStar(ctx, cx + (i - 1) * 44 * u, starY - (i === 1 ? 6 * u : 0), 18 * u * ease.outBack(kk), i < sim.lastStars);
    }
    ctx.fillStyle = C.goldDeep;
    const sub = `${sim.lastByHelp ? `${TXT.wonHelp} · ` : ''}${t('won.baskets', { baskets: basketsText(sim.lastBaskets) })}`;
    ctx.fillText(this.fit(sub, r.w - 28 * u, F.cardSub), cx, r.y + (short ? 82 : 90) * u);
    const py = r.y + (short ? 106 : 118) * u;
    this.drawPath(sim, r.x + 16 * u, py, r.w - 32 * u, r.y + r.h - 8 * u - py);
    ctx.restore();
  }

  /** The path of hillsides: the chapter's four levels as stones on a winding path, the player's place lit. */
  private drawPath(sim: ChlebySim, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx, u = this.L.u, F = this.F;
    const next = sim.p.level;
    const { chapter } = placeOf(Math.max(0, next));
    const first = next - (next % RULES.chapter);
    ctx.fillStyle = 'rgba(58,42,24,.72)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.fit(`${TXT.path} · ${CHAPTERS[chapter]}`, w, F.map), x + w / 2, y);
    const cy = y + 20 * u + (h - 20 * u) * 0.58;
    const px = (i: number) => x + w * (0.1 + 0.8 * (i / (RULES.chapter - 1)));
    const py = (i: number) => cy + (i % 2 ? -4 : 4) * u;
    ctx.strokeStyle = 'rgba(150,110,60,.5)';
    ctx.lineWidth = 3 * u;
    ctx.setLineDash([5 * u, 4 * u]);
    ctx.beginPath();
    for (let i = 0; i < RULES.chapter; i++) {
      if (i) ctx.lineTo(px(i), py(i));
      else ctx.moveTo(px(i), py(i));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < RULES.chapter; i++) {
      const L = first + i;
      const done = L < next, here = L === next;
      const r = (here ? 15 : 13) * u;
      ctx.fillStyle = done ? C.gold : here ? '#fff6e0' : 'rgba(255,246,224,.7)';
      ctx.strokeStyle = here ? C.kerchief : 'rgba(150,110,60,.75)';
      ctx.lineWidth = (here ? 2.5 : 1.4) * u;
      ctx.beginPath();
      ctx.arc(px(i), py(i), r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.font = F.stone;
      ctx.textBaseline = 'middle';
      ctx.fillText(isBoss(L) ? '!' : String(L + 1), px(i), py(i) + 0.5);
      const st = sim.p.stars[L] ?? 0;
      for (let k = 0; k < st; k++) paintStar(ctx, px(i) + (k - 1) * 8 * u, py(i) - r - 6 * u, 4 * u, true);
    }
  }

  // ── the bundles' reveal ─────────────────────────────────────────
  private drawReveal(sim: ChlebySim): void {
    if (this.packA < 0.02 || this.story || !sim.reveal.length) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const packs: Pack[] = sim.reveal;
    // the best first: an evolution, a card never found, then by rarity; at most the sheet's tiles (the last one says how many more)
    const rank = (d: Drop) => (d.evo ? 100 : 0) + (d.fresh ? 50 : 0) + (d.up ? 10 : 0) + RARITIES.indexOf(cardDef(d.id)?.rarity ?? 'common');
    const allDrops = packs.flatMap(k => k.drops).sort((a, b) => rank(b) - rank(a));
    const sub = packs.length > 1;
    const cap = Math.min(RULES.revealMax, revealGeo(L, allDrops.length, sub).max);
    const more = Math.max(0, allDrops.length - cap);
    const drops = more > 0 ? allDrops.slice(0, cap - 1) : allDrops;
    const g = revealGeo(L, drops.length + (more > 0 ? 1 : 0), sub);
    const r = g.box;
    ctx.save();
    this.enterSheet(r, this.packA);
    this.paper(r, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    const title = t(`pack.${packs[0].why}` as 'pack.level');
    ctx.fillText(this.fit(title, r.w - 28 * u, F.cardTitle, MIN_READ), r.x + r.w / 2, r.y + g.pad + 2 * u);
    if (sub) {
      ctx.fillStyle = C.goldDeep;
      ctx.fillText(this.fit(t('reveal.more', { n: packs.length - 1 }), r.w - 28 * u, F.cardSub), r.x + r.w / 2, r.y + g.pad + 26 * u);
    }
    drops.forEach((d, i) => {
      const k = clamp((sim.stageT - 0.35 - i * RULES.packCard) / 0.35);
      const c = g.cells[i];
      if (k <= 0 || !c) return;
      const def = cardDef(d.id);
      const rarity = def?.rarity ?? 'common';
      ctx.save();
      ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
      ctx.scale(ease.outBack(k) * Math.abs(Math.cos((1 - k) * Math.PI * 0.5)) + 0.0001, ease.outBack(k));
      const tw = c.w, th = c.h;
      if (rarity === 'legend' || rarity === 'epic' || d.evo) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, 0, 0, tw * 0.95, rarity === 'legend' || d.evo ? C.goldGlow : 'rgba(190,140,255,', 0.35 + 0.15 * Math.sin(this.clock * 6));
        ctx.restore();
      }
      ctx.fillStyle = '#fffaf0';
      ctx.strokeStyle = RARITY_COLOR[rarity];
      ctx.lineWidth = 2.5 * u;
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -th / 2, tw, th, 9 * u);
      ctx.fill();
      ctx.stroke();
      // from the bottom up: the badge, the name (one or two lines), the picture in the room left above
      const nm = this.lines(cardName(d.id), tw - 8 * u, F.tile, 2);
      const lh = 15 * u, bh = 18 * u;
      const by = th / 2 - 7 * u - bh / 2;
      const nameTop = by - bh / 2 - 4 * u - nm.length * lh;
      const artTop = -th / 2 + 6 * u, artH = nameTop - 3 * u - artTop;
      const art = Math.max(8 * u, Math.min(tw * 0.3, artH * 0.42));
      if (def) paintCardArt(ctx, d.id, def.kind, 0, artTop + artH * 0.56, art, this.clock);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      nm.forEach((l, j) => ctx.fillText(this.fit(l, tw - 8 * u, F.tile, 12), 0, nameTop + lh * (j + 0.5)));
      const badge = d.dust > 0 ? `+${TXT.dust}` : d.evo ? TXT.evo : d.fresh ? TXT.fresh : t('reveal.lv', { n: d.level });
      const bt = this.fit(badge, tw - 12 * u, F.badge, 12);
      const bw = Math.min(tw - 6 * u, ctx.measureText(bt).width + 12 * u);
      ctx.fillStyle = d.evo ? C.gold : d.fresh ? C.green : d.up ? C.honey : 'rgba(90,70,40,.22)';
      ctx.beginPath();
      ctx.roundRect(-bw / 2, by - bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = d.evo || d.fresh || d.up ? '#ffffff' : C.text;
      ctx.fillText(bt, 0, by + 0.5);
      ctx.restore();
    });
    if (more > 0) {
      // the last tile: how many more cards went into the collection
      const i = drops.length, k = clamp((sim.stageT - 0.35 - i * RULES.packCard) / 0.35), c = g.cells[i];
      if (k > 0 && c) {
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.fillStyle = 'rgba(243,193,63,.18)';
        ctx.strokeStyle = C.goldDeep;
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.roundRect(c.x, c.y, c.w, c.h, 9 * u);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.goldDeep;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = F.more;
        ctx.fillText(`+${more + 1}`, c.x + c.w / 2, c.y + c.h / 2);
        ctx.restore();
      }
    }
    ctx.fillStyle = 'rgba(58,42,24,.62)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.fit(TXT.revealTap, r.w - 28 * u, F.tap), r.x + r.w / 2, r.y + r.h - g.pad + 2 * u);
    ctx.restore();
  }

  // ── the village sheet ───────────────────────────────────────────
  private drawCard(sim: ChlebySim): void {
    if (this.cardA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const list = sim.offers;
    const v = villageGeo(L, list.length);
    const r = v.box, short = L.mode === 'short';
    ctx.save();
    this.enterSheet(r, this.cardA);
    this.paper(r, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.fillText(this.fit(TXT.upTitle, r.w - 28 * u, F.cardTitle, MIN_READ), r.x + r.w / 2, r.y + v.pad + (short ? 0 : 2) * u);
    ctx.fillStyle = C.goldDeep;
    ctx.fillText(this.fit(t('upc.bank', { baskets: basketsText(sim.p.bank) }), r.w - 28 * u, F.cardSub), r.x + r.w / 2, r.y + v.pad + (short ? 23 : 28) * u);
    list.forEach((o, i) => {
      const row = v.rows[i];
      if (!row) return;
      const pressed = this.pressRow === i && this.pressT > 0;
      ctx.fillStyle = pressed ? 'rgba(243,193,63,.5)' : o.can ? 'rgba(243,193,63,.24)' : 'rgba(90,70,40,.08)';
      ctx.strokeStyle = o.can ? C.goldDeep : 'rgba(90,70,40,.25)';
      ctx.lineWidth = o.can ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(row.x, row.y, row.w, row.h, 11 * u);
      ctx.fill();
      ctx.stroke();
      const pic = Math.min(row.h * 0.42, 24 * u);
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      paintBuilding(ctx, o.b, row.x + 8 * u + pic, row.y + row.h * 0.5 + pic * 0.75, pic, o.level, this.clock);
      ctx.restore();
      // the price on the right: a little basket and the number
      ctx.font = F.upPrice;
      const price = fmtNum(o.price);
      const pw = ctx.measureText(price).width;
      const tx = row.x + 16 * u + pic * 2, tw = row.w - (tx - row.x) - pw - 36 * u;
      const lines = row.h >= 58 * u ? 2 : 1;
      const nameY = row.y + (row.h - (19 + lines * 16) * u) / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = o.can ? C.text : 'rgba(58,42,24,.55)';
      ctx.fillText(this.fit(`${buildName(o.b)} · ${t('upc.level', { n: o.level })}`, tw, F.upName), tx, nameY);
      ctx.fillStyle = C.textSoft;
      ctx.font = F.upText;
      this.lines(buildText(o.b), tw, F.upText, lines).forEach((l, k) => ctx.fillText(l, tx, nameY + (20 + k * 16) * u));
      paintBasket(ctx, row.x + row.w - pw - 24 * u, row.y + row.h / 2 + 2 * u, 9 * u, { fill: o.can ? 0.8 : 0 });
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = F.upPrice;
      ctx.fillStyle = o.can ? C.goldDeep : 'rgba(58,42,24,.5)';
      ctx.fillText(price, row.x + row.w - 10 * u, row.y + row.h / 2 + 0.5);
    });
    const left = Math.max(0, Math.ceil(RULES.cardSec - sim.stageT));
    const g = v.go;
    const pressed = this.pressRow === -1 && this.pressT > 0;
    ctx.fillStyle = pressed ? C.greenDark : C.green;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, g.h / 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.fit(`${TXT.upGo} · ${left}`, g.w - 24 * u, F.go), g.x + g.w / 2, g.y + g.h / 2 + 0.5);
    ctx.restore();
  }

  // ── the companion's bubble ──────────────────────────────────────
  private drawBubble(at: { mirka: { x: number; y: number }; boy: { x: number; y: number } }, avoid: Rect[]): void {
    const b = this.bubble;
    if (!b || this.story || this.cardA > 0.3 || this.packA > 0.3) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, b.t / 0.18, (b.dur - b.t) / 0.3);
    const k = b.t < 0.22 ? ease.outBack(b.t / 0.22) : 1;
    const maxW = Math.min(250 * u, L.w * 0.66);
    const ls = this.lines(b.text, maxW - 22 * u, F.bubble, 4);
    ctx.font = F.bubble;
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const lh = 19 * u;
    const w = tw + 22 * u, h = ls.length * lh + 14 * u;
    const p = b.who === 'mirka' ? at.mirka : at.boy;
    const keep = [...avoid, ...(this.sheetRect ? [this.sheetRect] : [])];
    const x = clamp(b.who === 'mirka' ? p.x - 18 * u : p.x - w * 0.5, 8, L.w - w - 8);
    const top = L.hudTop + 4, low = L.h - L.ins.bottom - 4;
    // above the speaker, else below; then the first spot that covers nothing it must not
    const spots = [p.y - h - 14 * u, p.y + 18 * u];
    for (const c of keep) spots.push(c.y - h - 10 * u, c.y + c.h + 10 * u);
    let y = spots[0], best = Infinity;
    for (const s of spots) {
      if (s < top || s + h > low) continue;
      const box = { x, y: s, w, h };
      const bad = keep.reduce((n, c) => n + (overlap(box, c) ? 1 : 0), 0) * 1000 + Math.abs(s + h / 2 - p.y);
      if (bad < best) { best = bad; y = s; }
    }
    y = clamp(y, top, Math.max(top, low - h));
    const above = y + h / 2 < p.y;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(p.x, p.y);
    ctx.scale(k, k);
    ctx.translate(-p.x, -p.y);
    ctx.fillStyle = b.who === 'mirka' ? '#ffffff' : '#fff1d6';
    ctx.strokeStyle = b.who === 'mirka' ? 'rgba(214,69,58,.7)' : 'rgba(150,100,50,.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    ctx.stroke();
    // the tail, when the bubble sits next to its speaker (and the speaker is not under a sheet)
    const hidden = !!this.sheetRect && p.x > this.sheetRect.x && p.x < this.sheetRect.x + this.sheetRect.w && p.y > this.sheetRect.y && p.y < this.sheetRect.y + this.sheetRect.h;
    if (!hidden && Math.abs((above ? y + h : y) - p.y) < 60 * u) {
      const tx = clamp(p.x, x + 14 * u, x + w - 14 * u);
      ctx.beginPath();
      if (above) {
        ctx.moveTo(tx - 7 * u, y + h - 1);
        ctx.lineTo(clamp(p.x, x, x + w), Math.min(p.y - 4 * u, y + h + 12 * u));
        ctx.lineTo(tx + 7 * u, y + h - 1);
      } else {
        ctx.moveTo(tx - 7 * u, y + 1);
        ctx.lineTo(clamp(p.x, x, x + w), Math.max(p.y + 6 * u, y - 12 * u));
        ctx.lineTo(tx + 7 * u, y + 1);
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x + 11 * u, y + 7 * u + i * lh));
    ctx.restore();
  }

  // ── the story cards ─────────────────────────────────────────────
  private drawStory(): void {
    const s = this.story;
    this.storyRect = null;
    if (!s) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, s.t / 0.35) * (1 - Math.min(1, s.out));
    const open = s.kind === 'open';
    const w = Math.min(sheetBox(L, 100, true).w, (open ? 460 : 420) * u);
    const title = open ? TXT.openTitle
      : s.kind === 'chapter' ? t('story.chapter', { n: s.chapter + 1, name: CHAPTERS[s.chapter] })
        : s.kind === 'boss' && s.boss ? bossName(s.boss)
          : s.kind === 'village' ? TXT.villageTitle : TXT.cardsTitle;
    const text = open ? TXT.openText
      : s.kind === 'chapter' ? STORIES[s.chapter]
        : s.kind === 'boss' && s.boss ? bossStory(s.boss)
          : s.kind === 'village' ? TXT.village : TXT.cards;
    let vh = 0;
    if (open) {
      const key = `${Math.round(w)}`;
      if (!this.verse || this.verseKey !== key) {
        // 17 px at the least: the verse is read, and its reference line (62 % of it) stays at 11 px
        this.verse = layoutPassage(ctx, passage('jhn6.9'), w - 40 * u, 150 * u, { max: 18 * u, min: 17 });
        this.verseKey = key;
      }
      vh = this.verse.height + 10 * u;
    }
    const lh = 20 * u;
    // the title and its rule, the text, the verse, the "tap to close" line
    const fixed = 54 * u + vh + 34 * u;
    const maxLines = Math.max(3, Math.floor((L.play.h - 12 - fixed) / lh));
    const tl = this.lines(text, w - 32 * u, F.storyText, Math.min(9, maxLines));
    const h = fixed + tl.length * lh;
    const box0 = sheetBox(L, h, true);
    const box = { x: box0.x + (box0.w - w) / 2, y: box0.y, w, h: box0.h };
    this.storyRect = box;
    ctx.save();
    if (L.sheet === 'bottom' || L.mode === 'short') {
      this.enterSheet(box, a);
    } else {
      const k = s.t < 0.3 ? ease.outBack(s.t / 0.3) : 1;
      ctx.globalAlpha = a;
      ctx.translate(box.x + box.w / 2, box.y + box.h / 2);
      ctx.scale(k, k);
      ctx.translate(-box.x - box.w / 2, -box.y - box.h / 2);
      this.sheetRect = box;
    }
    ctx.globalAlpha *= 1 - Math.min(1, s.out);
    this.paper(box, 0.98);
    const x = box.x, y = box.y;
    ctx.fillStyle = s.kind === 'boss' ? C.pouch : C.goldDeep;
    ctx.fillRect(x + 16 * u, y + 44 * u, w - 32 * u, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.fillText(this.fit(title, w - 28 * u, F.storyTitle, MIN_READ), x + w / 2, y + 15 * u);
    ctx.font = F.storyText;
    ctx.fillStyle = C.textSoft;
    tl.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 54 * u + i * lh));
    if (open && this.verse) drawPassage(ctx, passage('jhn6.9'), this.verse, x + w / 2, y + 54 * u + tl.length * lh + 6 * u, { text: '#5a4020', ref: 'rgba(90,64,32,.75)' });
    ctx.fillStyle = 'rgba(58,42,24,.6)';
    ctx.textBaseline = 'bottom';
    ctx.fillText(this.fit(TXT.storyTap, w - 28 * u, F.tap), x + w / 2, y + box.h - 10 * u);
    ctx.restore();
  }

  // ── the evening ─────────────────────────────────────────────────
  private drawFinale(): void {
    if (this.finaleA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    ctx.save();
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.play.w - 16, 400 * u), h = 74 * u;
    const x = clamp(L.cardX - w / 2, L.play.x + 8, L.play.x + L.play.w - 8 - w), y = L.hudTop + 8;
    this.paper({ x, y, w, h }, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.fillText(this.fit(TXT.finaleTitle, w - 24 * u, F.big, 16), x + w / 2, y + 11 * u);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(this.fit(TXT.finaleSub, w - 24 * u, F.cardSub), x + w / 2, y + 45 * u);
    ctx.restore();
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}
