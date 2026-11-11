/**
 * Chleby i ryby's words and cards on the play canvas (v3).  The runner draws the band's panel, the
 * score and the coach marks; this draws only what belongs to the game's story: the words floating
 * over the hill ("+12", "Syci!", "Bum!"), the companion's speech bubble (Mirka on her post, the boy
 * by his basket), the banner of a new level, terrace, glutton, tier or day, the card of a level fed
 * (its stars, the baskets earned and the path of hillsides with the player's place on it), the
 * bundles' reveal (the cards flip in one by one with their rarity, "Nowa!", their level, an
 * evolution), the village card (what to build, with each building's picture), the story cards (the
 * opening with John 6:9, a chapter, a glutton's first arena, the village, the collection) and the
 * evening.  Every string is fitted to its room so it reads on a 390 px phone in German and Swedish.
 */
import { fmtNum } from '../../i18n';
import { approach, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { RARITIES, cardDef, type Drop } from './cards';
import { CHAPTERS, STORIES, bossName, bossStory, buildName, buildText, cardName } from './content';
import { isBoss, placeOf } from './field';
import { baskets as basketsText, t } from './i18n';
import type { Layout } from './layout';
import type { BossKind } from './meta';
import { C, SANS, SERIF, font, glow, paintBasket, paintStar } from './paint';
import { RULES, type ChlebySim, type Pack } from './sim';
import { RARITY_COLOR, paintBuilding, paintCardArt } from './sprites';
import type { Who } from './content';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; font: string; rise: number }
interface Bubble { who: Who; text: string; t: number; dur: number }
type StoryKind = 'open' | 'chapter' | 'boss' | 'village' | 'cards';
interface Story { kind: StoryKind; chapter: number; boss: BossKind | null; t: number; out: number }
interface Banner { title: string; sub: string; t: number; dur: number; boss: boolean }
export interface Rect { x: number; y: number; w: number; h: number }

const TXT = {
  upTitle: t('upc.title'), upGo: t('upc.go'), storyTap: t('story.tap'), openTitle: t('story.openTitle'), openText: t('story.open'),
  wonTitle: t('won.title'), wonHelp: t('won.help'), path: t('won.path'), finaleTitle: t('finale.title'), finaleSub: t('finale.sub'),
  villageTitle: t('story.village.title'), village: t('story.village'), cardsTitle: t('story.cards.title'), cards: t('story.cards'),
  fresh: t('reveal.new'), evo: t('reveal.evo'), dust: t('reveal.dust'), revealTap: t('reveal.tap'),
};

const PX = /(\d+(?:\.\d+)?)px/;
/** the runner's block banner ends about here (CSS px from the canvas top; styles.css .arcade-banner) */
const BANNER_BOTTOM = 304;

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
  /** the village card's buttons while it is open (for taps) */
  readonly offerRects: Rect[] = [];
  goRect: Rect | null = null;
  /** the story card's box while it shows (taps on it close it) */
  storyRect: Rect | null = null;
  /** the card of a level fed while it shows (the companion's bubble keeps off it) */
  private wonRect: Rect | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private static fontsFor(u: number) {
    return {
      bubble: font(650, 12.5 * u, SANS), cardTitle: font(500, 18 * u, SERIF, true), cardSub: font(700, 12 * u, SANS),
      big: font(500, 26 * u, SERIF, true), banner: font(500, 30 * u, SERIF, true), bannerSub: font(750, 13 * u, SANS),
      storyTitle: font(500, 21 * u, SERIF, true), storyText: font(560, 13 * u, SANS), upName: font(650, 14 * u, SERIF),
      upText: font(600, 11 * u, SANS), upPrice: font(800, 12 * u, SANS), map: font(800, 10 * u, SANS), tile: font(750, 9.5 * u, SANS),
      badge: font(850, 9 * u, SANS),
    };
  }

  resize(L: Layout): void {
    this.L = L;
    this.F = Hud.fontsFor(L.u);
    this.wraps.clear();
    this.verse = null;
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 30): void {
    const u = this.L.u;
    x = clamp(x, 40 * u, this.L.w - 40 * u);
    this.floats.push({ text, x, y, t: 0, dur, color, font: font(900, size * u, SANS), rise: rise * u });
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

  update(dt: number, sim: ChlebySim): void {
    this.clock += dt;
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

  /** `at`: where the speakers stand (their bubble's tail points there). */
  draw(sim: ChlebySim, at: { mirka: { x: number; y: number }; boy: { x: number; y: number } }): void {
    this.drawFloats();
    this.drawBanner();
    this.drawWon(sim);
    this.drawReveal(sim);
    this.drawCard(sim);
    this.drawBubble(at);
    this.drawFinale();
    this.drawStory();
  }

  // ── helpers ─────────────────────────────────────────────────────
  private paper(x: number, y: number, w: number, h: number, a = 0.95): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,246,224,${a})`;
    ctx.strokeStyle = 'rgba(150,110,60,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * this.L.u);
    ctx.fill();
    ctx.stroke();
  }

  /** The font `f`, shrunk (to `min` of its size at most) so `text` fits `maxW`. */
  private fit(text: string, maxW: number, f: string, min = 0.65): string {
    const ctx = this.ctx;
    ctx.font = f;
    const w = ctx.measureText(text).width;
    if (w <= maxW) return f;
    const m = f.match(PX);
    if (!m) return f;
    const size = Math.max(Number(m[1]) * min, (Number(m[1]) * maxW) / w);
    return f.replace(m[0], `${Math.round(size * 10) / 10}px`);
  }

  /** `text` wrapped to `maxW` in font `f`, at most `max` lines (the last one ends in "…" when cut); cached. */
  private lines(text: string, maxW: number, f: string, max: number): string[] {
    const key = `${f}|${Math.round(maxW)}|${max}|${text}`;
    let out = this.wraps.get(key);
    if (!out) {
      this.ctx.font = f;
      out = wrap(this.ctx, text, maxW);
      if (out.length > max) {
        out = out.slice(0, max);
        let last = out[max - 1];
        while (last.length > 1 && this.ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
        out[max - 1] = `${last.replace(/[\s,;:.]+$/, '')}…`;
      }
      if (this.wraps.size > 120) this.wraps.clear();
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
   * Where a card's top goes: centred on the lane, but below the runner's HUD band and below its block
   * banner (it sits about 186–300 px from the top for its first seconds), unless there is no room for
   * that (a phone on its side, where the card takes the whole height).
   */
  private cardBox(h: number): number {
    const L = this.L;
    const top = L.mode === 'short' ? 8 : Math.max(L.hudTop, Math.min(BANNER_BOTTOM, L.h - h - 8));
    return clamp(L.cardY - h / 2, top, Math.max(top, L.h - h - 8));
  }

  // ── floats and the banner ───────────────────────────────────────
  private drawFloats(): void {
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
    const y = L.lane.yT + (L.lane.yB - L.lane.yT) * 0.55;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(L.cardX, y);
    ctx.scale(k, k);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxW = Math.min(L.w - 32, Math.max(L.lane.hwB * 2, 260 * u));
    ctx.font = this.fit(b.title, maxW, F.banner);
    const tw = ctx.measureText(b.title).width;
    const subLines = b.sub ? this.lines(b.sub, maxW - 24 * u, F.bannerSub, 2) : [];
    ctx.font = F.bannerSub;
    const sw = subLines.length ? Math.max(...subLines.map(l => ctx.measureText(l).width)) : 0;
    // a soft dark pill behind, so the words read over the crowd and the gates
    const bw = Math.min(L.w - 16, Math.max(tw, sw) + 60 * u);
    const bh = (52 + subLines.length * 18) * u;
    ctx.fillStyle = 'rgba(40,28,14,.45)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -26 * u, bw, bh, 26 * u);
    ctx.fill();
    ctx.font = this.fit(b.title, maxW, F.banner);
    this.outlined(b.title, 0, 0, b.boss ? '#ffd08a' : '#fff6e0', 'rgba(60,35,10,.75)', 5);
    ctx.font = F.bannerSub;
    subLines.forEach((l, i) => this.outlined(l, 0, (26 + i * 18) * u, '#fff6e0', 'rgba(60,35,10,.7)', 3.5));
    ctx.restore();
  }

  // ── a level fed: stars, baskets, the path ───────────────────────
  private drawWon(sim: ChlebySim): void {
    const a = this.wonA;
    this.wonRect = null;
    if (a < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const w = Math.min(L.w - 24, 330 * u), h = 150 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    // high on the lane, over the tables just fed (the runner's block banner sits lower)
    const y = clamp(L.lane.yT - 10 * u, L.mode === 'short' ? 8 : L.hudTop, L.h - h - 8);
    const k = clamp(sim.stageT / RULES.wonHold);
    this.wonRect = { x, y, w, h };
    ctx.save();
    ctx.globalAlpha = a;
    this.paper(x, y, w, h, 0.96);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.wonTitle, w - 24 * u, F.cardTitle);
    ctx.fillText(TXT.wonTitle, x + w / 2, y + 10 * u);
    for (let i = 0; i < 3; i++) {
      const kk = clamp((k * 3 - i * 0.35) / 0.6);
      if (kk <= 0) continue;
      paintStar(ctx, x + w / 2 + (i - 1) * 36 * u, y + 52 * u - (i === 1 ? 6 * u : 0), 15 * u * ease.outBack(kk), i < sim.lastStars);
    }
    ctx.fillStyle = C.goldDeep;
    const sub = `${sim.lastByHelp ? `${TXT.wonHelp} · ` : ''}${t('won.baskets', { baskets: basketsText(sim.lastBaskets) })}`;
    ctx.font = this.fit(sub, w - 24 * u, F.cardSub);
    ctx.fillText(sub, x + w / 2, y + 74 * u);
    this.drawPath(sim, x + 16 * u, y + 100 * u, w - 32 * u, 40 * u);
    ctx.restore();
  }

  /** The path of hillsides: the chapter's four levels as stones on a winding path, the player's place lit. */
  private drawPath(sim: ChlebySim, x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx, u = this.L.u;
    const next = sim.p.level;
    const { chapter } = placeOf(Math.max(0, next));
    const first = next - (next % RULES.chapter);
    const head = `${TXT.path} · ${CHAPTERS[chapter]}`;
    ctx.font = this.fit(head, w, this.F.map);
    ctx.fillStyle = 'rgba(58,42,24,.6)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(head, x + w / 2, y);
    const cy = y + h * 0.66;
    ctx.strokeStyle = 'rgba(150,110,60,.5)';
    ctx.lineWidth = 3 * u;
    ctx.setLineDash([5 * u, 4 * u]);
    ctx.beginPath();
    for (let i = 0; i < RULES.chapter; i++) {
      const px = x + w * (0.1 + 0.8 * (i / (RULES.chapter - 1))), py = cy + (i % 2 ? -5 : 5) * u;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < RULES.chapter; i++) {
      const L = first + i;
      const px = x + w * (0.1 + 0.8 * (i / (RULES.chapter - 1))), py = cy + (i % 2 ? -5 : 5) * u;
      const done = L < next, here = L === next;
      const r = (here ? 11 : 9) * u;
      ctx.fillStyle = done ? C.gold : here ? '#fff6e0' : 'rgba(255,246,224,.6)';
      ctx.strokeStyle = here ? C.kerchief : 'rgba(150,110,60,.7)';
      ctx.lineWidth = (here ? 2.5 : 1.2) * u;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.font = font(850, 10 * u, SANS);
      ctx.textBaseline = 'middle';
      ctx.fillText(isBoss(L) ? '!' : String(L + 1), px, py + 0.5);
      const st = sim.p.stars[L] ?? 0;
      for (let k = 0; k < st; k++) paintStar(ctx, px + (k - 1) * 7 * u, py - r - 5 * u, 3.2 * u, true);
    }
  }

  // ── the bundles' reveal ─────────────────────────────────────────
  private drawReveal(sim: ChlebySim): void {
    if (this.packA < 0.02 || this.story || !sim.reveal.length) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const packs: Pack[] = sim.reveal;
    // the best first: an evolution, a card never found, then by rarity; at most revealMax tiles (the last one says how many more)
    const rank = (d: Drop) => (d.evo ? 100 : 0) + (d.fresh ? 50 : 0) + (d.up ? 10 : 0) + RARITIES.indexOf(cardDef(d.id)?.rarity ?? 'common');
    const allDrops = packs.flatMap(k => k.drops).sort((a, b) => rank(b) - rank(a));
    const more = Math.max(0, allDrops.length - RULES.revealMax);
    const drops = more > 0 ? allDrops.slice(0, RULES.revealMax - 1) : allDrops;
    const tiles = drops.length + (more > 0 ? 1 : 0);
    const w = Math.min(L.w - 20, 400 * u);
    const per = Math.min(tiles > 5 ? 4 : 5, tiles);
    const tw = Math.min(70 * u, (w - 20 * u - (per - 1) * 6 * u) / per), th = tw * 1.38;
    const rows = Math.ceil(tiles / per);
    const h = 64 * u + rows * (th + 8 * u) + 26 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    const y = this.cardBox(h);
    ctx.save();
    ctx.globalAlpha = this.packA;
    this.paper(x, y, w, h, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    const title = t(`pack.${packs[0].why}` as 'pack.level');
    ctx.font = this.fit(title, w - 24 * u, F.cardTitle);
    ctx.fillText(title, x + w / 2, y + 10 * u);
    if (packs.length > 1) {
      const also = t('reveal.more', { n: packs.length - 1 });
      ctx.font = this.fit(also, w - 24 * u, F.cardSub);
      ctx.fillStyle = C.goldDeep;
      ctx.fillText(also, x + w / 2, y + 36 * u);
    }
    const gx = x + (w - (per * tw + (per - 1) * 6 * u)) / 2;
    drops.forEach((d, i) => {
      const k = clamp((sim.stageT - 0.35 - i * RULES.packCard) / 0.35);
      if (k <= 0) return;
      const col = i % per, row = Math.floor(i / per);
      const cx = gx + col * (tw + 6 * u) + tw / 2, cy = y + 56 * u + row * (th + 8 * u) + th / 2;
      const def = cardDef(d.id);
      const rarity = def?.rarity ?? 'common';
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(ease.outBack(k) * Math.abs(Math.cos((1 - k) * Math.PI * 0.5)) + 0.0001, ease.outBack(k));
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
      ctx.roundRect(-tw / 2, -th / 2, tw, th, 8 * u);
      ctx.fill();
      ctx.stroke();
      if (def) paintCardArt(ctx, d.id, def.kind, 0, -th * 0.12, tw * 0.42, this.clock);
      ctx.fillStyle = C.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const nm = cardName(d.id);
      ctx.font = this.fit(nm, tw - 6 * u, F.tile, 0.6);
      ctx.fillText(nm, 0, th * 0.24);
      const badge = d.dust > 0 ? `+${TXT.dust}` : d.evo ? TXT.evo : d.fresh ? TXT.fresh : t('reveal.lv', { n: d.level });
      ctx.font = this.fit(badge, tw - 4 * u, F.badge, 0.6);
      const bw = Math.min(tw - 4 * u, ctx.measureText(badge).width + 10 * u), bh = 14 * u;
      ctx.fillStyle = d.evo ? C.gold : d.fresh ? C.green : d.up ? C.honey : 'rgba(90,70,40,.25)';
      ctx.beginPath();
      ctx.roundRect(-bw / 2, th * 0.37 - bh / 2, bw, bh, bh / 2);
      ctx.fill();
      ctx.fillStyle = d.evo || d.fresh || d.up ? '#ffffff' : C.text;
      ctx.fillText(badge, 0, th * 0.37 + 0.5);
      ctx.restore();
    });
    if (more > 0) {
      // the last tile: how many more cards went into the collection
      const i = drops.length, k = clamp((sim.stageT - 0.35 - i * RULES.packCard) / 0.35);
      if (k > 0) {
        const col = i % per, row = Math.floor(i / per);
        const cx = gx + col * (tw + 6 * u) + tw / 2, cy = y + 56 * u + row * (th + 8 * u) + th / 2;
        ctx.save();
        ctx.globalAlpha *= k;
        ctx.fillStyle = 'rgba(243,193,63,.18)';
        ctx.strokeStyle = C.goldDeep;
        ctx.lineWidth = 1.5 * u;
        ctx.beginPath();
        ctx.roundRect(cx - tw / 2, cy - th / 2, tw, th, 8 * u);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.goldDeep;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = font(900, 20 * u, SANS);
        ctx.fillText(`+${more + 1}`, cx, cy);
        ctx.restore();
      }
    }
    ctx.font = font(650, 10 * u, SANS);
    ctx.fillStyle = 'rgba(58,42,24,.5)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(TXT.revealTap, x + w / 2, y + h - 8 * u);
    ctx.restore();
  }

  // ── the village card ────────────────────────────────────────────
  private drawCard(sim: ChlebySim): void {
    this.offerRects.length = 0;
    this.goRect = null;
    if (this.cardA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const list = sim.offers;
    const w = Math.min(L.w - 24, 360 * u), rowH = 50 * u;
    const h = 62 * u + list.length * (rowH + 6 * u) + 40 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    const y = this.cardBox(h);
    ctx.save();
    ctx.globalAlpha = this.cardA;
    this.paper(x, y, w, h, 0.97);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.upTitle, w - 24 * u, F.cardTitle);
    ctx.fillText(TXT.upTitle, x + w / 2, y + 10 * u);
    ctx.fillStyle = C.goldDeep;
    const bank = t('upc.bank', { baskets: basketsText(sim.p.bank) });
    ctx.font = this.fit(bank, w - 24 * u, F.cardSub);
    ctx.fillText(bank, x + w / 2, y + 36 * u);
    let ry = y + 56 * u;
    list.forEach((o, i) => {
      const r = { x: x + 10 * u, y: ry, w: w - 20 * u, h: rowH };
      this.offerRects.push(r);
      ctx.fillStyle = o.can ? 'rgba(243,193,63,.22)' : 'rgba(90,70,40,.08)';
      ctx.strokeStyle = o.can ? C.goldDeep : 'rgba(90,70,40,.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 9 * u);
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha *= o.can ? 1 : 0.55;
      paintBuilding(ctx, o.b, r.x + 26 * u, r.y + rowH * 0.78, 22 * u, o.level, this.clock);
      ctx.restore();
      const tx = r.x + 54 * u, tw = r.w - 54 * u - 66 * u;
      ctx.textAlign = 'left';
      ctx.fillStyle = o.can ? C.text : 'rgba(58,42,24,.5)';
      const nm = `${i + 1}. ${buildName(o.b)} · ${t('upc.level', { n: o.level })}`;
      ctx.font = this.fit(nm, tw, F.upName);
      ctx.fillText(nm, tx, r.y + 7 * u);
      const tl = this.lines(buildText(o.b), tw, F.upText, 2);
      ctx.font = F.upText;
      ctx.fillStyle = C.textSoft;
      tl.forEach((l, k) => ctx.fillText(l, tx, r.y + 26 * u + k * 12 * u));
      // the price: a little basket and the number
      paintBasket(ctx, r.x + r.w - 50 * u, r.y + rowH / 2 + 2 * u, 9 * u, { fill: o.can ? 0.8 : 0 });
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.font = F.upPrice;
      ctx.fillStyle = o.can ? C.goldDeep : 'rgba(58,42,24,.45)';
      ctx.fillText(fmtNum(o.price), r.x + r.w - 10 * u, r.y + rowH / 2);
      ctx.textBaseline = 'top';
      ry += rowH + 6 * u;
    });
    const left = Math.max(0, Math.ceil(RULES.cardSec - sim.stageT));
    const go = `${TXT.upGo} · ${left}`;
    ctx.font = F.upPrice;
    const gw = ctx.measureText(go).width + 34 * u, gh = 30 * u;
    const g = { x: x + w / 2 - gw / 2, y: ry + 2 * u, w: gw, h: gh };
    this.goRect = g;
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.roundRect(g.x, g.y, g.w, g.h, gh / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(go, x + w / 2, g.y + gh / 2 + 0.5);
    ctx.restore();
  }

  // ── the companion's bubble ──────────────────────────────────────
  private drawBubble(at: { mirka: { x: number; y: number }; boy: { x: number; y: number } }): void {
    const b = this.bubble;
    if (!b || this.story || this.cardA > 0.3 || this.packA > 0.3) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    const a = Math.min(1, b.t / 0.18, (b.dur - b.t) / 0.3);
    const k = b.t < 0.22 ? ease.outBack(b.t / 0.22) : 1;
    const maxW = Math.min(240 * u, L.w * 0.6);
    const ls = this.lines(b.text, maxW - 20 * u, F.bubble, 4);
    ctx.font = F.bubble;
    const tw = Math.max(...ls.map(l => ctx.measureText(l).width));
    const w = tw + 20 * u, lh = 15.5 * u, h = ls.length * lh + 14 * u;
    const p = b.who === 'mirka' ? at.mirka : at.boy;
    let above = p.y - h - 16 * u > L.hudTop;
    let x = b.who === 'mirka' ? p.x - 16 * u : p.x - w * 0.5;
    x = clamp(x, 8, L.w - w - 8);
    let y = above ? p.y - h - 14 * u : p.y + 18 * u;
    // keep off the card of a level fed: below it (or above it when there is no room below)
    const c = this.wonRect;
    if (c && x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y) {
      if (c.y + c.h + 10 * u + h < L.h - 8) { y = c.y + c.h + 10 * u; above = p.y < y; }
      else { y = Math.max(L.hudTop, c.y - h - 10 * u); above = true; }
    }
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
    const tx = clamp(p.x, x + 14 * u, x + w - 14 * u);
    ctx.beginPath();
    if (above) {
      ctx.moveTo(tx - 7 * u, y + h - 1);
      ctx.lineTo(p.x, p.y - 4 * u);
      ctx.lineTo(tx + 7 * u, y + h - 1);
    } else {
      ctx.moveTo(tx - 7 * u, y + 1);
      ctx.lineTo(p.x, p.y + 6 * u);
      ctx.lineTo(tx + 7 * u, y + 1);
    }
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x + 10 * u, y + 7 * u + i * lh));
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
    const w = Math.min(L.w - 24, (open ? 420 : 360) * u);
    const title = open ? TXT.openTitle
      : s.kind === 'chapter' ? t('story.chapter', { n: s.chapter + 1, name: CHAPTERS[s.chapter] })
        : s.kind === 'boss' && s.boss ? bossName(s.boss)
          : s.kind === 'village' ? TXT.villageTitle : TXT.cardsTitle;
    const text = open ? TXT.openText
      : s.kind === 'chapter' ? STORIES[s.chapter]
        : s.kind === 'boss' && s.boss ? bossStory(s.boss)
          : s.kind === 'village' ? TXT.village : TXT.cards;
    const tl = this.lines(text, w - 32 * u, F.storyText, 8);
    let vh = 0;
    if (open) {
      const key = `${Math.round(w)}`;
      if (!this.verse || this.verseKey !== key) {
        this.verse = layoutPassage(ctx, passage('jhn6.9'), w - 40 * u, 92 * u, { max: 15 * u, min: 10 });
        this.verseKey = key;
      }
      vh = this.verse.height + 14 * u;
    }
    const h = 44 * u + tl.length * 18 * u + vh + 28 * u;
    const x = clamp(L.cardX - w / 2, 8, L.w - w - 8);
    const y = L.mode === 'short' ? clamp((L.h - h) / 2, 6, L.h - h - 6) : this.cardBox(h);
    this.storyRect = { x, y, w, h };
    const k = s.t < 0.3 ? ease.outBack(s.t / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(k, k);
    ctx.translate(-w / 2, -h / 2);
    this.paper(0, 0, w, h, 0.97);
    ctx.fillStyle = s.kind === 'boss' ? C.pouch : C.goldDeep;
    ctx.fillRect(16 * u, 40 * u, w - 32 * u, 1.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(title, w - 28 * u, F.storyTitle);
    ctx.fillText(title, w / 2, 12 * u);
    ctx.font = F.storyText;
    ctx.fillStyle = C.textSoft;
    tl.forEach((l, i) => ctx.fillText(l, w / 2, 50 * u + i * 18 * u));
    if (open && this.verse) drawPassage(ctx, passage('jhn6.9'), this.verse, w / 2, 50 * u + tl.length * 18 * u + 10 * u, { text: '#5a4020', ref: 'rgba(90,64,32,.7)' });
    ctx.font = font(650, 10 * u, SANS);
    ctx.fillStyle = 'rgba(58,42,24,.45)';
    ctx.fillText(TXT.storyTap, w / 2, h - 18 * u);
    ctx.restore();
  }

  // ── the evening ─────────────────────────────────────────────────
  private drawFinale(): void {
    if (this.finaleA < 0.02 || this.story) return;
    const ctx = this.ctx, L = this.L, u = L.u, F = this.F;
    ctx.save();
    ctx.globalAlpha = this.finaleA;
    const w = Math.min(L.w - 24, 360 * u), h = 74 * u;
    const x = L.cardX - w / 2, y = L.lane.yT + 6 * u;
    this.paper(x, y, w, h, 0.95);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = this.fit(TXT.finaleTitle, w - 24 * u, F.big);
    ctx.fillText(TXT.finaleTitle, L.cardX, y + 12 * u);
    ctx.font = this.fit(TXT.finaleSub, w - 24 * u, F.cardSub);
    ctx.fillStyle = C.textSoft;
    ctx.fillText(TXT.finaleSub, L.cardX, y + 46 * u);
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
