/**
 * Arka's picture for the lobby's hero and the game card.  In the lobby (with the player's progress)
 * the new land as the player has filled it: the pairs grazing in their valleys, the young, the
 * olive trees and the homestead, with the ark resting on the mountain far off.  On the cards (no
 * progress) a corner of the deck in morning light: a few animals facing their ways and the landing
 * with a pair waiting by the door.  Drawn every frame in the lobby, so it stays cheap: the land and
 * the deck's boards are sprites made once per size.
 */
import { ease } from '../kit/juice';
import type { KindId } from './content';
import { LandPainter, type LandLook } from './land';
import { homestead, type ArkaProgress } from './meta';
import { C, paintAnimal, paintDove, paintFigure, paintPlanks, paintProfile } from './paint';

const land = new LandPainter();
const look: LandLook = { settled: {}, young: [], olives: 0, built: 0 };

let deck: { w: number; h: number; dpr: number; c: HTMLCanvasElement } | null = null;

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ArkaProgress): void {
  const dpr = ctx.getTransform().a || 1;
  if (p) {
    look.settled = p.settled;
    look.young = p.young;
    look.olives = p.olives;
    look.built = homestead(p.home).built;
    land.draw(ctx, 0, 0, w, h, t, look, { dusk: 0, zoom: Math.min(1.25, 340 / Math.max(200, h)) }, dpr);
    ark(ctx, w, h, t);
    // a new land is empty: the first pairs are on their way down from the ark
    if (p.pairs === 0) procession(ctx, w, h, t);
    return;
  }
  cardDeck(ctx, w, h, t, dpr);
}

/** The first three kinds walking two by two from the ark down toward the meadow, in a slow loop. */
function procession(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const kinds: KindId[] = ['sheep', 'sheep', 'goat', 'goat', 'donkey', 'donkey'];
  const ah = Math.max(9, h * 0.075);
  kinds.forEach((k, i) => {
    const q = ((t * 0.035 + 1 - (Math.floor(i / 2) * 0.09 + (i % 2) * 0.025)) % 1);
    const x = w * (0.68 - 0.5 * q), y = h * (0.47 + 0.33 * q);
    const a = Math.min(1, q * 8, (1 - q) * 6);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    paintProfile(ctx, k, x, y, ah * (0.7 + 0.5 * q), -1, 0);
    ctx.restore();
  });
}

/** The ark resting on the mountain's shoulder, far off, its door open. */
function ark(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const x = w * 0.71, y = h * 0.44, s = Math.min(w, h) * 0.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#5a4030';
  ctx.beginPath();
  ctx.moveTo(-s * 0.6, 0);
  ctx.lineTo(s * 0.6, 0);
  ctx.lineTo(s * 0.5, s * 0.18);
  ctx.lineTo(-s * 0.5, s * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(-s * 0.42, -s * 0.16, s * 0.84, s * 0.16);
  ctx.fillStyle = '#7f5a36';
  ctx.beginPath();
  ctx.moveTo(-s * 0.46, -s * 0.15);
  ctx.lineTo(0, -s * 0.3);
  ctx.lineTo(s * 0.46, -s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,33,27,.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#2a1d14';
  ctx.fillRect(-s * 0.06, -s * 0.12, s * 0.12, s * 0.12);
  ctx.restore();
  // the dove over the land, unhurried
  const k = (t * 0.06) % 1;
  paintDove(ctx, w * (0.1 + 0.8 * k), h * (0.22 + 0.05 * Math.sin(t * 0.9)), Math.max(12, Math.min(w, h) * 0.05), Math.sin(t * 7), false, 1);
}

/** The card: a corner of the deck in morning light, animals facing their ways, the landing above. */
function cardDeck(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dpr: number): void {
  const c = Math.round(Math.min(w / 4.6, h / 4.4));
  if (!deck || deck.w !== w || deck.h !== h || deck.dpr !== dpr) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d')!;
    g.scale(dpr, dpr);
    paintPlanks(g, 0, 0, w, h, Math.max(14, c * 0.42), [C.walnut, '#3f2d20', C.walnut2], 5);
    // the landing along the top
    paintPlanks(g, 0, h * 0.08, w, c * 0.95, c * 0.34, ['#8a6440', '#7f5a36', C.fresh], 9, true);
    g.strokeStyle = '#4a3220';
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 1; i < 5; i++) {
      g.moveTo(i * c * 1.05, h * 0.08);
      g.lineTo(i * c * 1.05, h * 0.08 + c * 0.95);
    }
    g.stroke();
    // the deck below with its rail
    const dx = (w - 4 * c) / 2, dy = h * 0.08 + c * 1.25;
    g.fillStyle = '#5a3d26';
    g.fillRect(dx - 8, dy - 8, 4 * c + 16, 3 * c + 16);
    paintPlanks(g, dx, dy, 4 * c, 3 * c, c, [C.oak2, '#94693f', '#7f5a36'], 7);
    g.strokeStyle = 'rgba(30,18,10,.55)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 1; i < 4; i++) {
      g.moveTo(dx + i * c, dy);
      g.lineTo(dx + i * c, dy + 3 * c);
    }
    g.stroke();
    // morning light
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, 'rgba(255,240,205,.28)');
    lg.addColorStop(0.6, 'rgba(255,240,205,0)');
    lg.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = lg;
    g.fillRect(0, 0, w, h);
    deck = { w, h, dpr, c: cv };
  }
  ctx.drawImage(deck.c, 0, 0, w, h);
  const dx = (w - 4 * c) / 2, dy = h * 0.08 + c * 1.25;
  // the deck's animals, each facing its way
  const herd: [KindId, number, number, number][] = [['sheep', 0, 0, 0], ['goat', 2, 0, 1], ['cow', 3, 1, 2], ['donkey', 1, 1, 3], ['sheep', 0, 2, 1], ['camel', 2, 2, 0]];
  herd.forEach(([k, x, y, d], i) => {
    const bob = Math.sin(t * 2 + i) * 0.01;
    paintAnimal(ctx, k, dx + (x + 0.5) * c, dy + (y + 0.5) * c, d, c * 0.94, dpr, { squash: bob });
  });
  // a goat walking out, and its mate waiting on the landing
  const k = ease.inOutSine((t * 0.25) % 1);
  paintAnimal(ctx, 'goat', c * 1.05 * 1.5, h * 0.08 + c * 0.5, 3, c * 0.86, dpr);
  paintAnimal(ctx, 'stork', c * 1.05 * 2.5, h * 0.08 + c * 0.5, 3, c * 0.86, dpr, { squash: 0.02 * Math.sin(t * 3) });
  void k;
  paintFigure(ctx, c * 1.05 * 0.5, h * 0.08 + c * 0.92, c * 0.82, 0.15, 0, false);
}
