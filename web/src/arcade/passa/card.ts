/**
 * Złota passa's moment card (DESIGN.md §26, builder B): a postcard held up close — a stamp with the moment's motif and
 * its words.  The grey side says what happened, in quiet greys (a joy's grey is only faded: unnoticed; a snag's cool;
 * a heavy one's deep slate).  As focus turns it (`turn` 0..1) it flips over its vertical axis — drawn in slices with a
 * little perspective, the edge catching the light — to the gold side, whose words (`win`) write themselves in a warm
 * serif as focus holds (`write`).  A heavy card's other side is a soft dawn, not a gold rush; the trust card's is a
 * night-blue card with a small flame.  `glow` is focus's warm light on and behind the card — never a meter.
 */
import type { CardView } from './view';
import { drawFlame, drawMotif, goldPal, greyPal, towardGrey } from './motifs';
import { FONT, SERIF, TAU, clamp01, fitWrap, font, glow, layer, mixHex, rgba, rr, smooth } from './paint';
import { MIN_READ } from '../kit/mobile';

export interface CardOpts {
  time: number;
  reduced: boolean;
  /** the layout's base font (px) and UI scale */
  font: number;
  k: number;
  /** the card's opacity (arriving, leaving) */
  alpha?: number;
  /** the rest's breath 0..1 (the card rises and falls a hair) */
  breath?: number;
}

/** The papers: the grey sides by kind, the gold side, the heavy card's dawn, the trust card's night. */
const PAPER = {
  joy: { a: '#e6e3dc', b: '#ccc8c0', ink: '#454852', edge: '#b8b4ac' },
  snag: { a: '#d3d7df', b: '#b0b6c2', ink: '#3a404c', edge: '#9aa0ac' },
  heavy: { a: '#626a80', b: '#454b60', ink: '#eceef6', edge: '#7c8298' },
  /** (round 25) a sense moment's grey side: a quiet lilac grey (not yet noticed); a given one's: a worn warm grey */
  sense: { a: '#e6e4ec', b: '#c9c6d4', ink: '#44465a', edge: '#b2aec4' },
  given: { a: '#e9e5dd', b: '#cdc6ba', ink: '#4a463e', edge: '#bab2a4' },
  gold: { a: '#fff7e2', b: '#f6d38a', ink: '#6b4410', edge: '#d9a646' },
  dawn: { a: '#faeef2', b: '#f4d8b6', ink: '#5a3448', edge: '#d4a6a8' },
  trust: { a: '#2c3456', b: '#40365c', ink: '#f8ecd4', edge: '#e8b870' },
} as const;
type Paper = (typeof PAPER)[keyof typeof PAPER];

/** The card as drawn: the view's card, focus's glow on it (the view's `glow`). */
export type CardLike = CardView & { trust?: boolean; glow?: number };

export class CardPainter {
  private faceL: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
  private fw = 0;
  private fh = 0;
  private fdpr = 0;

  /** The point the light flies up from (the stamp's middle) for a card drawn in `r` at `scale`. */
  static lightFrom(r: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
    const pad = Math.max(8, r.h * 0.1), S = r.h - 2 * pad;
    return { x: r.x + pad + S / 2, y: r.y + pad + S / 2 };
  }

  /**
   * Draw the card centred on (cx, cy) at `scale` of its size w × h (the layout's card), turned by `card.turn`.
   */
  draw(ctx: CanvasRenderingContext2D, card: CardLike, cx: number, cy: number, w: number, h: number, scale: number, o: CardOpts): void {
    const a = clamp01(o.alpha ?? 1);
    if (a <= 0.003 || !(scale > 0.004) || !(w > 4) || !(h > 4)) return;
    const turn = clamp01(card.turn);
    const th = Math.PI * smooth(turn);
    const cos = Math.cos(th), sin = Math.sin(th);
    const lift = 1 + 0.05 * sin;
    const br = o.reduced ? 0 : (clamp01(o.breath ?? 0.5) - 0.5) * 0.012;
    const s = scale * lift * (1 + br);
    const W = w * s, H = h * s;
    const gold = th > Math.PI / 2;
    const heavy = card.kind === 'heavy';
    const g = clamp01(card.glow ?? 0);
    ctx.save();
    ctx.globalAlpha = a;
    // focus's warm light behind the card (soft and rosy for a heavy card)
    if (g > 0.01 && scale > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      const col = heavy ? '#ffc8b8' : card.trust && gold ? '#ffcf90' : '#ffd88a';
      glow(ctx, col, cx, cy, Math.max(W, H) * (0.62 + 0.25 * g), (heavy ? 0.3 : 0.45) * g * a);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the card's soft shadow
    const sw = Math.max(Math.abs(cos), 0.08) * W;
    ctx.fillStyle = rgba('#0a0806', 0.28 * a);
    ctx.beginPath();
    ctx.ellipse(cx, cy + H * 0.52, sw * 0.48, Math.max(2, H * 0.06), 0, 0, TAU);
    ctx.fill();
    // the face: painted once into a layer, drawn flat or in slices while it turns
    const face = this.paintFace(ctx, card, gold, w * scale, h * scale, o);
    if (Math.abs(cos) > 0.995 && !face) {
      ctx.save();
      ctx.translate(cx - W / 2, cy - H / 2);
      ctx.scale(W / (w * scale), H / (h * scale));
      this.face(ctx, card, gold, w * scale, h * scale, o);
      ctx.restore();
    } else if (face) {
      const N = Math.abs(cos) > 0.995 ? 1 : 20;
      const D = 2.6 * W;
      const fw = face.width, fh = face.height;
      for (let i = 0; i < N; i++) {
        const b0 = i / N, b1 = (i + 1) / N;
        // the local x of this slice on the side we see (the back is read the right way round)
        const lx0 = gold ? (0.5 - b0) * W : (b0 - 0.5) * W;
        const lx1 = gold ? (0.5 - b1) * W : (b1 - 0.5) * W;
        const p0 = D / (D + lx0 * sin * 0.9), p1 = D / (D + lx1 * sin * 0.9);
        const x0 = cx + lx0 * cos * p0, x1 = cx + lx1 * cos * p1;
        const hh = H * (p0 + p1) / 2;
        const dx = Math.min(x0, x1), dw = Math.abs(x1 - x0) + 0.6;
        ctx.drawImage(face, b0 * fw, 0, fw / N, fh, dx, cy - hh / 2, dw, hh);
      }
    } else {
      // no layer (tests, no DOM): the face squeezed flat
      ctx.save();
      ctx.translate(cx - (W * Math.abs(cos)) / 2, cy - H / 2);
      ctx.scale((W * Math.max(0.02, Math.abs(cos))) / (w * scale), H / (h * scale));
      this.face(ctx, card, gold, w * scale, h * scale, o);
      ctx.restore();
    }
    // the edge catching the light at the turn's middle
    if (Math.abs(cos) < 0.35) {
      const e = 1 - Math.abs(cos) / 0.35;
      const ex = cx + (gold ? -1 : 1) * (W / 2) * cos;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = rgba(heavy ? '#ffe0d0' : '#fff0c0', 0.85 * e * a);
      ctx.lineWidth = Math.max(1.5, 3 * e * s);
      ctx.beginPath();
      ctx.moveTo(ex, cy - H * 0.52);
      ctx.lineTo(ex, cy + H * 0.52);
      ctx.stroke();
      glow(ctx, heavy ? '#ffd8c8' : '#ffe2a0', ex, cy, H * 0.6, 0.5 * e * a, 1.2);
      ctx.globalCompositeOperation = 'source-over';
    }
    // focus's warmth on the face itself, and its small motes rising
    if (g > 0.05 && Math.abs(cos) > 0.2) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * g * (heavy ? 0.1 : 0.16);
      ctx.fillStyle = heavy ? '#ffc8b0' : '#ffcf70';
      rr(ctx, cx - (W * Math.abs(cos)) / 2, cy - H / 2, W * Math.abs(cos), H, 10 * o.k * s);
      ctx.fill();
      ctx.globalAlpha = a;
      if (!o.reduced && scale > 0.5) {
        for (let i = 0; i < 7; i++) {
          const ph = (o.time * (0.22 + 0.05 * (i % 3)) + i * 0.37) % 1;
          const x = cx + (((i * 0.618) % 1) - 0.5) * W * 0.9 * Math.abs(cos) + Math.sin(o.time + i) * 4;
          const y = cy - H / 2 - ph * H * 0.5;
          glow(ctx, heavy ? '#ffd8c8' : '#ffe6a8', x, y, 6 + 6 * g, (1 - ph) * 0.6 * g * a);
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /** The face in its layer (null without a DOM). */
  private paintFace(ctx: CanvasRenderingContext2D, card: CardLike, gold: boolean, w: number, h: number, o: CardOpts): HTMLCanvasElement | null {
    const dpr = Math.min(2.5, Math.max(1, ctx.getTransform?.().a || 1));
    if (!this.faceL || Math.abs(this.fw - w) > 0.5 || Math.abs(this.fh - h) > 0.5 || this.fdpr !== dpr) {
      this.faceL = layer(w, h, dpr);
      this.fw = w;
      this.fh = h;
      this.fdpr = dpr;
    }
    const L = this.faceL;
    if (!L) return null;
    L.ctx.setTransform(1, 0, 0, 1, 0, 0);
    L.ctx.clearRect(0, 0, L.c.width, L.c.height);
    L.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.face(L.ctx, card, gold, w, h, o);
    return L.c;
  }

  /** Paint one side of the card at (0, 0) w × h. */
  face(ctx: CanvasRenderingContext2D, card: CardLike, gold: boolean, w: number, h: number, o: CardOpts): void {
    const heavy = card.kind === 'heavy';
    const trust = !!card.trust && gold;
    const P: Paper = !gold ? PAPER[card.kind as 'joy'] ?? PAPER.snag : trust ? PAPER.trust : heavy ? PAPER.dawn : PAPER.gold;
    const k = Math.max(0.6, h / 130);
    const rad = Math.min(12 * o.k, h * 0.1);
    // the paper
    const g = ctx.createLinearGradient(0, 0, w * 0.4, h * 1.2);
    g.addColorStop(0, P.a);
    g.addColorStop(1, P.b);
    ctx.fillStyle = g;
    rr(ctx, 0, 0, w, h, rad);
    ctx.fill();
    // a warm light from the stamp's side on the gold side
    if (gold && !trust) {
      const rg = ctx.createRadialGradient(h * 0.5, h * 0.5, 0, h * 0.5, h * 0.5, w * 0.7);
      rg.addColorStop(0, rgba('#ffffff', 0.45));
      rg.addColorStop(1, rgba('#ffffff', 0));
      ctx.fillStyle = rg;
      rr(ctx, 0, 0, w, h, rad);
      ctx.fill();
    }
    // the inner frame (a postcard's), corner ornaments on the gold side
    const ins = Math.max(4, 6 * k);
    ctx.strokeStyle = rgba(P.edge, gold ? 0.95 : 0.6);
    ctx.lineWidth = gold ? Math.max(1.2, 1.6 * k) : 1;
    rr(ctx, ins, ins, w - 2 * ins, h - 2 * ins, Math.max(2, rad - ins * 0.6));
    ctx.stroke();
    if (gold) {
      ctx.fillStyle = P.edge;
      for (const [x, y] of [[ins, ins], [w - ins, ins], [ins, h - ins], [w - ins, h - ins]]) {
        ctx.beginPath();
        ctx.moveTo(x, y - 3.5 * k); ctx.lineTo(x + 3.5 * k, y); ctx.lineTo(x, y + 3.5 * k); ctx.lineTo(x - 3.5 * k, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // the stamp: perforated, its picture inside (the flame for trust)
    const pad = Math.max(8, h * 0.1);
    const S = Math.min(h - 2 * pad, w * 0.42);
    const sx = pad, sy = (h - S) / 2;
    const motifPal = gold ? goldPal(card.motif, heavy) : greyPal(heavy);
    const bg = trust ? '#232a48' : motifPal.bg;
    ctx.fillStyle = gold ? '#fffaf0' : heavy ? '#6e7488' : '#eceef2';
    if (trust) ctx.fillStyle = '#1c2240';
    ctx.fillRect(sx, sy, S, S);
    // the perforation: small bites out of the stamp's edge in the paper's colour
    ctx.fillStyle = P.a;
    const bite = Math.max(1.5, S * 0.035), n = Math.max(6, Math.round(S / (bite * 3.2)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      for (const [x, y] of [[sx + t * S, sy], [sx + t * S, sy + S], [sx, sy + t * S], [sx + S, sy + t * S]]) {
        ctx.beginPath();
        ctx.arc(x, y, bite, 0, TAU);
        ctx.fill();
      }
    }
    const ip = S * 0.09;
    ctx.fillStyle = bg;
    ctx.fillRect(sx + ip, sy + ip, S - 2 * ip, S - 2 * ip);
    const mt = o.reduced ? 0 : o.time;
    if (trust) drawFlame(ctx, sx + ip, sy + ip, S - 2 * ip, mt, 1);
    else drawMotif(ctx, card.motif, sx + ip * 1.4, sy + ip * 1.4, S - 2.8 * ip, gold ? motifPal : towardGrey(motifPal, 0), mt);
    // the own moment's mark: a small pen in the corner
    if (card.own) {
      ctx.save();
      ctx.translate(w - ins - 14 * k, ins + 13 * k);
      ctx.rotate(-0.7);
      ctx.fillStyle = rgba(P.ink, 0.55);
      ctx.fillRect(-1.6 * k, -8 * k, 3.2 * k, 12 * k);
      ctx.beginPath();
      ctx.moveTo(-1.6 * k, 4 * k); ctx.lineTo(1.6 * k, 4 * k); ctx.lineTo(0, 7.5 * k);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // the words: the grey side's in a calm sans, the gold side's writing themselves in a warm serif
    const tx = sx + S + pad * 1.1, tw = w - tx - pad - (card.own ? 10 * k : 0);
    const th = h - 2 * pad;
    if (tw < 20) return;
    if (!gold) {
      const maxL = Math.max(2, Math.floor(th / (MIN_READ * 1.32)));
      const f = fitWrap(ctx, card.what, tw, maxL, o.font * 1.12, MIN_READ, 600, FONT);
      this.lines(ctx, f.lines, f.px, tx, h / 2, P.ink, 1, 1.28);
      return;
    }
    const text = card.win || '';
    if (!text) {
      // chosen nothing yet: a soft line waiting for the words
      ctx.strokeStyle = rgba(P.ink, 0.25);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, h / 2 + 6);
      ctx.lineTo(tx + tw * 0.7, h / 2 + 6);
      ctx.stroke();
      return;
    }
    const maxL = Math.max(2, Math.floor(th / (MIN_READ * 1.36)));
    const f = fitWrap(ctx, text, tw, maxL, o.font * 1.3, MIN_READ + 1, 600, SERIF, true);
    const wr = clamp01(card.write);
    this.lines(ctx, f.lines, f.px, tx, h / 2, P.ink, wr, 1.3, true, trust ? '#ffd890' : heavy ? '#e8a0a0' : '#c98a2e', o.time);
    // written: a small sparkle in the corner (a star for the streak)
    if (wr >= 0.999) {
      const x = w - ins - 12 * k, y = h - ins - 12 * k, r = 5 * k;
      ctx.fillStyle = trust ? '#ffd890' : heavy ? '#d89aa0' : '#d9a646';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU - Math.PI / 2, rr0 = i % 2 ? r * 0.4 : r;
        const px = x + Math.cos(a) * rr0, py = y + Math.sin(a) * rr0;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Lines of text centred on `cy`, left-aligned at x; `shown` 0..1 of the characters (the writing), the last one
   * fading in, a warm nib glint where the writing is.
   */
  private lines(ctx: CanvasRenderingContext2D, lines: string[], px: number, x: number, cy: number, ink: string, shown: number, lh: number, serif = false, nib = '#c98a2e', time = 0): void {
    const lineH = px * lh;
    const total = lines.reduce((n, l) => n + l.length, 0);
    let left = shown >= 0.999 ? Infinity : shown * total;
    const y0 = cy - ((lines.length - 1) * lineH) / 2;
    ctx.font = font(serif ? 600 : 600, px, serif ? SERIF : FONT, serif);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = ink;
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i], y = y0 + i * lineH;
      if (left <= 0) break;
      if (left >= ln.length) {
        ctx.fillText(ln, x, y);
        left -= ln.length;
        continue;
      }
      const whole = Math.floor(left), frac = left - whole;
      const head = ln.slice(0, whole);
      ctx.fillText(head, x, y);
      const hw = ctx.measureText(head).width;
      if (whole < ln.length) {
        ctx.save();
        ctx.globalAlpha *= frac;
        ctx.fillText(ln[whole], x + hw, y);
        ctx.restore();
      }
      // the nib's glint
      const gx = x + hw + px * 0.3, gy = y + px * 0.15;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mixHex(nib, '#ffffff', 0.4), gx, gy, px * (0.9 + 0.2 * Math.sin(time * 9)), 0.8);
      ctx.restore();
      left = 0;
    }
  }
}
