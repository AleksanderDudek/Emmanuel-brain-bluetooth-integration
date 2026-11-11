/**
 * Dolina's own layer over the climb — only what the runner's standard HUD does not show (the Mendi
 * panel, the score corner and the coach marks are the runner's): the pack in the ground strip (the
 * sword's tier, the stones for the next stair, the oil, the streak), Ćma's speech bubble, the words
 * and numbers flying off what earned them, and the cards — the opening story with its root verse, a
 * new era, a level's way out with its stars, the dawn at the end, and short toasts.  Cards hang
 * under the runner's HUD and never cover the pilgrim's floor.
 */
import { ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageId } from '../kit/scripture';
import { paintChest, paintMate } from './cast';
import { weaponName, type CompId } from './content';
import { t } from './i18n';
import type { Layout } from './layout';
import { C, SANS, SERIF, TAU, font, paintLamp } from './paint';

interface Float { text: string; x: number; y: number; t: number; dur: number; color: string; size: number; rise: number }
type CardKind = 'story' | 'level' | 'toast' | 'finale';
interface Card {
  kind: CardKind; title: string; sub: string; t: number; dur: number; verse?: PassageId; stars?: number; lines?: [string, boolean][];
  /** v3: a companion's portrait on the card (and their name under the title); a toast's little picture */
  portrait?: CompId; sub2?: string; icon?: 'chest' | 'check';
}

export class Hud {
  private L!: Layout;
  private readonly floats: Float[] = [];
  private readonly cards: Card[] = [];
  private stonesShown = 0;
  private stonesPop = 0;
  private oilShown = 1;
  private oilPulse = 0;
  private tierPop = 0;
  private readonly wraps = new Map<string, string[]>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  resize(L: Layout): void {
    this.L = L;
    this.wraps.clear();
  }

  float(text: string, x: number, y: number, color: string, size = 15, dur = 1.1, rise = 34): void {
    this.floats.push({ text, x, y, t: 0, dur, color, size, rise });
    if (this.floats.length > 24) this.floats.shift();
  }

  popStones(): void { this.stonesPop = 1; }
  popTier(): void { this.tierPop = 1; }
  hurt(): void { this.oilPulse = 1; }

  /** A card: the opening story (with a passage), a level's end with its stars, the finale, a toast. */
  card(kind: CardKind, title: string, sub: string, dur: number, extra: Partial<Pick<Card, 'verse' | 'stars' | 'lines' | 'portrait' | 'sub2' | 'icon'>> = {}): void {
    const c: Card = { kind, title, sub, t: 0, dur, ...extra };
    if (kind === 'toast') {
      // toasts queue behind a story card and replace an older toast
      const i = this.cards.findIndex(x => x.kind === 'toast');
      if (i > 0) this.cards.splice(i, 1);
    } else if (this.cards[0]?.kind === 'toast') this.cards[0].dur = Math.min(this.cards[0].dur, this.cards[0].t + 0.25);
    this.cards.push(c);
  }

  /** A story or level card is up: Ćma and the hints wait. */
  get busy(): boolean { const c = this.cards[0]; return !!c && (c.kind === 'story' || c.kind === 'level' || c.kind === 'finale'); }

  update(dt: number, stones: number, oil: number): void {
    for (const f of this.floats) f.t += dt;
    while (this.floats.length && this.floats[0].t >= this.floats[0].dur) this.floats.shift();
    for (let i = this.floats.length - 1; i >= 0; i--) if (this.floats[i].t >= this.floats[i].dur) this.floats.splice(i, 1);
    const head = this.cards[0];
    if (head) {
      head.t += dt;
      if (head.t >= head.dur) this.cards.shift();
    }
    this.stonesShown += (stones - this.stonesShown) * Math.min(1, dt * 10);
    if (Math.abs(stones - this.stonesShown) < 0.05) this.stonesShown = stones;
    this.oilShown += (oil - this.oilShown) * Math.min(1, dt * 6);
    this.stonesPop = Math.max(0, this.stonesPop - dt * 3);
    this.oilPulse = Math.max(0, this.oilPulse - dt * 2);
    this.tierPop = Math.max(0, this.tierPop - dt * 2.5);
  }

  // ── drawing ─────────────────────────────────────────────────────
  drawFloats(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of this.floats) {
      const k = f.t / f.dur;
      const pop = k < 0.16 ? ease.outBack(k / 0.16) : 1;
      ctx.globalAlpha = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1;
      ctx.font = font(800, f.size * this.L.u * pop, SANS);
      const y = f.y - f.rise * ease.outCubic(k);
      ctx.fillStyle = 'rgba(14,10,20,.55)';
      ctx.fillText(f.text, f.x + 1, y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  /** The pack in the ground strip, bottom right: the sword, the stones, the oil, the streak. */
  drawPack(tier: number, oil: number, combo: number, mult: number): void {
    const ctx = this.ctx, L = this.L, u = L.u;
    const hgt = 30 * u, y = L.packY - hgt / 2;
    ctx.font = font(800, 13 * u, SANS);
    const weapon = weaponName(tier);
    const ww = ctx.measureText(weapon).width + 34 * u;
    const stones = String(Math.round(this.stonesShown));
    ctx.font = font(800, 15 * u, SANS);
    const sw = ctx.measureText(stones).width + 40 * u;
    const ow = 92 * u;
    const gap = 8 * u;
    const total = ww + sw + ow + gap * 2;
    let x = Math.max(8, L.packRight - total);
    const pill = (w: number, glowK = 0) => {
      ctx.fillStyle = `rgba(20,15,26,${0.78 + 0.1 * glowK})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, hgt, hgt / 2);
      ctx.fill();
      if (glowK > 0) {
        ctx.strokeStyle = `rgba(255,214,140,${glowK})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };
    // the sword
    pill(ww, this.tierPop);
    ctx.save();
    ctx.translate(x + 15 * u, y + hgt / 2);
    ctx.rotate(-0.75);
    ctx.fillStyle = C.steel;
    ctx.fillRect(-1.6 * u, -9 * u, 3.2 * u, 13 * u);
    ctx.fillStyle = C.goldDeep;
    ctx.fillRect(-4.5 * u, 3.5 * u, 9 * u, 2 * u);
    ctx.restore();
    ctx.fillStyle = '#fff1c4';
    ctx.font = font(800, 13 * u, SANS);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(weapon, x + 26 * u, y + hgt / 2 + 1);
    x += ww + gap;
    // the stones for the next stair
    pill(sw, this.stonesPop);
    const bx = x + 15 * u, by = y + hgt / 2;
    ctx.fillStyle = '#c49a6c';
    ctx.fillRect(bx - 7 * u, by - 1 * u, 7 * u, 5 * u);
    ctx.fillRect(bx + 0.5 * u, by - 1 * u, 7 * u, 5 * u);
    ctx.fillStyle = '#e0b888';
    ctx.fillRect(bx - 3.5 * u, by - 6.5 * u, 7 * u, 5 * u);
    ctx.fillStyle = '#fff1c4';
    ctx.font = font(800, 15 * u * (1 + 0.25 * this.stonesPop), SANS);
    ctx.fillText(stones, x + 27 * u, y + hgt / 2 + 1);
    x += sw + gap;
    // the oil
    pill(ow, this.oilPulse);
    paintLamp(ctx, x + 10 * u, y + hgt / 2 + 5 * u, 8 * u, oil < 0.3 ? 1 : 0);
    const bw = ow - 34 * u, bh = 7 * u, bx2 = x + 26 * u, by2 = y + hgt / 2 - bh / 2;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    ctx.beginPath();
    ctx.roundRect(bx2, by2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = this.oilShown < 0.3 ? '#ff9a5a' : '#f5c35a';
    ctx.beginPath();
    ctx.roundRect(bx2, by2, Math.max(bh, bw * Math.max(0, Math.min(1, this.oilShown))), bh, bh / 2);
    ctx.fill();
    // the streak, over the pack
    if (combo >= 3) {
      ctx.font = font(800, 12 * u, SANS);
      ctx.textAlign = 'right';
      ctx.fillStyle = mult > 1 ? '#ffd36b' : 'rgba(255,241,196,.8)';
      ctx.fillText(mult > 1 ? `${t('hud.combo', { n: mult })} · ${combo}` : String(combo), L.packRight - 4, y - 10 * u);
    }
  }

  /** Ćma's line in a drawn bubble above her (kept on screen, under the runner's HUD). */
  drawBubble(text: string, a: number, mx: number, my: number): void {
    if (!text || a <= 0.01) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    ctx.font = font(600, 13 * u, SANS);
    const maxW = Math.min(260 * u, L.w - 40);
    const lines = this.lines(text, maxW - 22 * u, ctx.font);
    const w = Math.min(maxW, Math.max(...lines.map(s => ctx.measureText(s).width)) + 22 * u);
    const lh = 17 * u, h = lines.length * lh + 14 * u;
    let x = mx - w * 0.3;
    x = Math.max(10, Math.min(L.w - w - 10, x));
    let y = my - h - 18 * u;
    y = Math.max(L.top + 4, y);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(246,238,220,.96)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12 * u);
    ctx.fill();
    // the tail toward her
    const tx = Math.max(x + 14 * u, Math.min(x + w - 14 * u, mx));
    if (my > y + h) {
      ctx.beginPath();
      ctx.moveTo(tx - 7 * u, y + h - 1);
      ctx.lineTo(tx + 7 * u, y + h - 1);
      ctx.lineTo(tx + 2 * u, Math.min(my - 6 * u, y + h + 12 * u));
      ctx.fill();
    }
    ctx.fillStyle = C.text;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    lines.forEach((s, i) => ctx.fillText(s, x + 11 * u, y + 7 * u + i * lh));
    ctx.globalAlpha = 1;
  }

  /** The card at the head of the queue. */
  drawCards(): void {
    const c = this.cards[0];
    if (!c) return;
    const ctx = this.ctx, L = this.L, u = L.u;
    const inK = Math.min(1, c.t / 0.3), outK = Math.min(1, Math.max(0, (c.dur - c.t) / 0.35));
    const a = Math.min(inK, outK);
    if (a <= 0.01) return;
    ctx.save();
    ctx.globalAlpha = a;
    const drop = (1 - ease.outCubic(inK)) * -14 * u;
    if (c.kind === 'toast') {
      const iw = c.icon ? 30 * u : 0;
      ctx.font = font(800, 14 * u, SANS);
      const tw = ctx.measureText(c.title).width;
      ctx.font = font(600, 12 * u, SANS);
      const sw = c.sub ? ctx.measureText(c.sub).width : 0;
      const w = Math.min(L.w - 24, Math.max(tw, sw) + 32 * u + iw), h = (c.sub ? 46 : 32) * u;
      const x = (L.w - w) / 2, y = L.top + 6 * u + drop;
      ctx.fillStyle = 'rgba(20,15,26,.86)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14 * u);
      ctx.fill();
      if (c.icon === 'chest') paintChest(ctx, x + 20 * u, y + h / 2 + 2 * u, 12 * u, Math.min(1, c.t / 0.5));
      else if (c.icon === 'check') {
        ctx.strokeStyle = '#9fe08a';
        ctx.lineWidth = 3 * u;
        ctx.beginPath();
        ctx.moveTo(x + 12 * u, y + h / 2);
        ctx.lineTo(x + 18 * u, y + h / 2 + 6 * u);
        ctx.lineTo(x + 28 * u, y + h / 2 - 7 * u);
        ctx.stroke();
      }
      const cx = L.w / 2 + iw / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd36b';
      ctx.font = font(800, 14 * u, SANS);
      ctx.fillText(this.fit(c.title, w - 24 * u - iw), cx, y + 16 * u);
      if (c.sub) {
        ctx.fillStyle = 'rgba(255,241,196,.85)';
        ctx.font = font(600, 12 * u, SANS);
        ctx.fillText(this.fit(c.sub, w - 24 * u - iw), cx, y + 33 * u);
      }
      ctx.restore();
      return;
    }
    const w = L.cardW, pad = 18 * u;
    const x = (L.w - w) / 2, y = L.cardTop + drop;
    // a companion's portrait takes the card's left (the words move over)
    const pw = c.portrait ? Math.min(90 * u, w * 0.24) : 0;
    ctx.font = font(560, 13.5 * u, SANS);
    const subLines = c.sub ? this.lines(c.sub, w - 2 * pad - pw, ctx.font) : [];
    const p = c.verse ? passage(c.verse) : null;
    const room = Math.max(60 * u, L.floorLine - L.S * 1.6 - y - (50 + subLines.length * 19) * u - 2 * pad);
    const pl = p ? layoutPassage(ctx, p, w - 2 * pad, Math.min(room, 110 * u), { max: 15 * u, min: 10 }) : null;
    const starsH = c.stars !== undefined ? 34 * u : 0;
    const linesH = c.lines ? c.lines.length * 19 * u + 4 * u : 0;
    const sub2H = c.sub2 ? 22 * u : 0;
    const h = Math.max(pad * 2 + 30 * u + sub2H + subLines.length * 19 * u + (pl ? pl.height + 12 * u : 0) + starsH + linesH, c.portrait ? pw + pad * 1.4 : 0);
    ctx.fillStyle = 'rgba(246,238,220,.97)';
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16 * u);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (c.portrait) {
      // the companion, in a warm round frame, a little hop as the card comes in
      const fx = x + pad + pw / 2, fy = y + pad + pw / 2;
      ctx.fillStyle = '#2a2440';
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2 - 2, 0, TAU);
      ctx.clip();
      const hop = Math.abs(Math.sin(c.t * 5)) * pw * 0.04;
      paintMate(ctx, c.portrait, fx, fy + pw * 0.38 - hop, pw * 0.42, { run: c.t * 6, t: c.t, act: 0, gold: true, air: false, sleep: false });
      ctx.restore();
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(fx, fy, pw / 2, 0, TAU);
      ctx.stroke();
    }
    const tx = x + pad + (pw ? pw + 12 * u : 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = font(560, 24 * u, SERIF, true);
    ctx.fillText(this.fit(c.title, w - (tx - x) - pad), tx, y + pad - 2 * u);
    ctx.fillStyle = C.gold;
    ctx.fillRect(tx, y + pad + 30 * u, 44 * u, 3 * u);
    let cy = y + pad + 40 * u;
    if (c.sub2) {
      ctx.fillStyle = C.goldDeep;
      ctx.font = font(800, 16 * u, SANS);
      ctx.fillText(c.sub2, tx, cy);
      cy += sub2H;
    }
    if (c.stars !== undefined) {
      for (let i = 0; i < 3; i++) {
        const k = Math.min(1, Math.max(0, (c.t - 0.35 - i * 0.22) / 0.25));
        star(ctx, x + pad + 14 * u + i * 34 * u, cy + 12 * u, 13 * u * (i < c.stars ? 0.6 + 0.4 * ease.outBack(k) : 0.85), i < c.stars && k > 0 ? '#f5c35a' : 'rgba(42,33,51,.18)');
      }
      cy += starsH;
    }
    if (c.lines) {
      ctx.font = font(650, 13 * u, SANS);
      for (const [line, ok] of c.lines) {
        ctx.fillStyle = ok ? C.goldDeep : 'rgba(42,33,51,.45)';
        ctx.fillText(`${ok ? '★' : '☆'} ${line}`, x + pad, cy);
        cy += 19 * u;
      }
      cy += 4 * u;
    }
    ctx.fillStyle = C.textSoft;
    ctx.font = font(560, 13.5 * u, SANS);
    subLines.forEach((s, i) => ctx.fillText(s, tx, cy + i * 19 * u));
    cy += subLines.length * 19 * u + 10 * u;
    if (p && pl) drawPassage(ctx, p, pl, L.w / 2, cy, { text: C.text, ref: 'rgba(42,33,51,.6)' });
    ctx.restore();
  }

  /** A line cut to fit a width (with an ellipsis), in the current font. */
  private fit(text: string, maxW: number): string {
    const ctx = this.ctx;
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }

  private lines(text: string, maxW: number, f: string): string[] {
    const key = `${f}|${maxW}|${text}`;
    const hit = this.wraps.get(key);
    if (hit) return hit;
    const ctx = this.ctx;
    ctx.font = f;
    const out: string[] = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    if (line) out.push(line);
    if (this.wraps.size > 80) this.wraps.clear();
    this.wraps.set(key, out);
    return out;
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 10;
    const rr = i % 2 ? r * 0.45 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
