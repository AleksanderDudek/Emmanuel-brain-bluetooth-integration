/**
 * Pasterz's calibration scene: the morning after the storm.  Grey clouds drift off the hill as the
 * reference fills (`p` 0..1); the village's sheep stand scattered over the grass, the shepherd and
 * Łatek wait in the middle, the rival kids' dyes show at the edges.  In the first-ever session the
 * top holds the opening card (two sentences of story and the root passage, Luke 15:4-6); later
 * the name of today's hill.  The runner's calibration card covers the lower part of the screen.
 */
import { approach, clamp, ease } from '../kit/juice';
import { drawPassage, layoutPassage, passage, type PassageLayout } from '../kit/scripture';
import { DOGS, PLAYER_DYE, RIVALS, hillAt, CLOAKS } from './content';
import { t } from './i18n';
import type { PasterzProgress } from './meta';
import { C, PLAIN, SANS, SERIF, font, hash, paintDog, paintSheep, paintShepherd } from './paint';
import { wrapLines } from '../kit/scripture';

export class PasterzIntro {
  private clock = 0;
  private shown = 0;
  private verse: { w: number; l: PassageLayout } | null = null;

  draw(ctx: CanvasRenderingContext2D, w: number, h: number, dt: number, p: number, progress: PasterzProgress): void {
    if (w < 2 || h < 2) return;
    this.clock += dt;
    this.shown = approach(this.shown, clamp(p), dt, 0.4);
    const k = this.shown, tm = this.clock;
    const tall = h > w;
    const S = Math.max(20, Math.min(w, h) / (tall ? 12 : 15));
    const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
    g.addColorStop(0, '#b9c274');
    g.addColorStop(1, '#8e9c52');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 7 + 1) * w, y = hash(i * 13 + 2) * h;
      ctx.strokeStyle = i % 3 ? 'rgba(96,112,52,.55)' : 'rgba(214,218,150,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y - S * 0.18);
      ctx.stroke();
    }
    // the scattered sheep (a few already in the rivals' dyes at the edges)
    for (let i = 0; i < 22; i++) {
      const x = (0.06 + hash(i * 5 + 9) * 0.88) * w, y = (0.42 + hash(i * 3 + 4) * 0.5) * h;
      const edge = i % 6 === 0 ? RIVALS[i % RIVALS.length].dye : undefined;
      paintSheep(ctx, x, y, S, hash(i) * 6.28 + Math.sin(tm * 0.3 + i) * 0.1, {
        small: i % 5 === 2, bob: tm + i, walking: 0, lie: 0, look: clamp(k * 2 - hash(i)), graze: 1 - k, dye: edge,
      });
    }
    // the shepherd and Łatek in the middle
    const cx = w * 0.5, cy = h * (tall ? 0.56 : 0.6);
    const cloak = CLOAKS[progress.wear?.cloak ?? 0] ?? CLOAKS[0];
    const dog = DOGS[progress.wear?.dog ?? 0] ?? DOGS[0];
    paintShepherd(ctx, cx, cy, S * 1.3, -Math.PI / 2 + Math.sin(tm * 0.5) * 0.3, 0, 0, false, { ...PLAIN, mantle: cloak.colors[0], stripe: cloak.colors[1] });
    paintDog(ctx, cx + S * 1.1, cy + S * 0.6, S * 1.1, -Math.PI / 2 + Math.sin(tm * 1.3) * 0.5, 0, tm, dog.colors[0], dog.colors[1]);
    ctx.strokeStyle = PLAYER_DYE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + S * 0.05, S * 0.7, S * 0.52, 0, 0, Math.PI * 2);
    ctx.stroke();
    // the storm's clouds drift off as the reference fills
    const storm = 1 - ease.inOutSine(k);
    ctx.fillStyle = `rgba(60,66,84,${(0.45 * storm).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const cx2 = ((hash(i + 40) * 1.4 - 0.2) * w + tm * 12 * (1 + hash(i)) + k * w * (hash(i) > 0.5 ? 0.8 : -0.8));
      const cy2 = hash(i + 60) * h * 0.8;
      const r = S * (2.5 + hash(i + 80) * 3);
      ctx.fillStyle = `rgba(120,126,142,${(0.5 * storm).toFixed(3)})`;
      for (let j = 0; j < 4; j++) {
        ctx.beginPath();
        ctx.arc(cx2 + (j - 1.5) * r * 0.6, cy2 + Math.sin(j * 2) * r * 0.2, r * (0.6 + 0.2 * (j % 2)), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (k > 0.4) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const m = ctx.createRadialGradient(w * 0.85, 0, 0, w * 0.85, 0, Math.max(w, h));
      m.addColorStop(0, `rgba(255,214,150,${((k - 0.4) * 0.45).toFixed(3)})`);
      m.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = m;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    // the opening card (first-ever session) or today's hill
    // beside the runner's calibration card on a wide screen (it covers the middle), above it otherwise
    const side = w >= 1000;
    const bw = side ? Math.min(380, (w - 540) / 2 - 24) : Math.min(w - 28, 560);
    const bx = side ? 16 : (w - bw) / 2;
    const top = side ? Math.max(66, h * 0.22) : 66;
    const mid = bx + bw / 2;
    ctx.save();
    if ((progress.sessions ?? 0) === 0) {
      ctx.font = font(500, 14, SANS);
      const story = wrapLines(ctx, t('intro.story'), bw - 32);
      if (!this.verse || this.verse.w !== bw) this.verse = { w: bw, l: layoutPassage(ctx, passage('luk15.4-6'), bw - 40, tall || side ? 170 : 96, { max: 15, min: 11 }) };
      const vh = this.verse.l.height;
      const bh = 40 + story.length * 19 + 14 + vh + 18;
      ctx.fillStyle = 'rgba(251,243,223,.94)';
      ctx.beginPath();
      ctx.roundRect(bx, top, bw, bh, 16);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(600, 19, SERIF);
      ctx.fillText(t('intro.title'), mid, top + 22);
      ctx.font = font(500, 14, SANS);
      ctx.fillStyle = '#4a3a28';
      story.forEach((l, i) => ctx.fillText(l, mid, top + 44 + i * 19));
      drawPassage(ctx, passage('luk15.4-6'), this.verse.l, mid, top + 44 + story.length * 19 + 6, { text: '#5b4630', ref: '#8a6a44' });
    } else {
      const hill = hillAt(progress.hill ?? 0);
      // the hill's line of story whole (two lines on a phone), at a size a phone reads
      ctx.font = font(500, 14, SERIF, true);
      const lines = wrapLines(ctx, hill.story, bw - 24).slice(0, 3);
      ctx.fillStyle = 'rgba(251,243,223,.9)';
      ctx.beginPath();
      ctx.roundRect(bx, top, bw, 44 + lines.length * 18, 14);
      ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = font(600, 18, SERIF);
      ctx.fillText(t('intro.hill', { hill: hill.name }), mid, top + 20);
      ctx.font = font(500, 14, SERIF, true);
      ctx.fillStyle = '#5b4630';
      lines.forEach((l, i) => ctx.fillText(l, mid, top + 42 + i * 18));
    }
    ctx.restore();
  }
}
