/**
 * Motylarnia's glasshouse (the butterfly house itself), painted once per size into an offscreen
 * canvas: the lobby's picture and the card art, where the atlas' butterflies flutter.
 */
import { PLANTS } from './content';
import { hash, mix, roundRect, speckle } from './paint';

const TAU = Math.PI * 2;

export function paintPaperGrain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  speckle(ctx, Math.min(1600, Math.round((w * h) / 380)), ['rgba(110,84,50,.05)', 'rgba(110,84,50,.08)', 'rgba(255,255,248,.09)', 'rgba(255,255,248,.15)'], i =>
    [hash(i * 3 + 1) * w, hash(i * 7 + 2) * h, 1, hash(i * 13 + 5)]);
}

/**
 * The Victorian glasshouse: sky through the panes, the white iron frame with its arch, a tiled
 * floor with terracotta pots of host plants, hanging greenery and light shafts.  `sunset` 0..1
 * warms it to the golden hour.
 */
export function paintGlasshouse(ctx: CanvasRenderingContext2D, w: number, h: number, sunset: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, mix('#CFE4E6', '#F2B983', sunset));
  sky.addColorStop(0.6, mix('#EEF1E2', '#F6D7A4', sunset));
  sky.addColorStop(1, mix('#E8E2CC', '#E9B98A', sunset));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const sun = ctx.createRadialGradient(w * 0.78, h * 0.2, 0, w * 0.78, h * 0.2, Math.max(w, h) * 0.7);
  sun.addColorStop(0, sunset ? 'rgba(255,226,170,.9)' : 'rgba(255,252,236,.9)');
  sun.addColorStop(0.35, 'rgba(255,244,214,.3)');
  sun.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // distant garden through the glass
  for (let i = 0; i < 22; i++) {
    const x = hash(i * 7 + 3) * w, y = h * (0.55 + 0.2 * hash(i * 5)), r = Math.min(w, h) * (0.06 + 0.1 * hash(i * 9));
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${110 + 40 * sunset},${150 - 20 * sunset},${90 - 20 * sunset},.35)`);
    g.addColorStop(1, 'rgba(110,150,90,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // the frame
  const frame = sunset ? '#FFF2DC' : '#FCFAF2', shadow = 'rgba(120,100,70,.35)';
  const lw = Math.max(2, Math.min(w, h) * 0.008);
  const archY = h * 0.34, cx = w / 2, R = w * 0.62;
  const line = (f: (c: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.strokeStyle = shadow;
    ctx.lineWidth = lw * 1.6;
    ctx.translate(1.5, 2);
    f(ctx);
    ctx.restore();
    ctx.strokeStyle = frame;
    ctx.lineWidth = lw;
    f(ctx);
  };
  ctx.lineCap = 'round';
  line(c => {
    c.beginPath();
    c.ellipse(cx, archY, R, archY * 1.05, 0, Math.PI, TAU);
    c.stroke();
  });
  line(c => {
    c.beginPath();
    c.ellipse(cx, archY, R * 0.62, archY * 0.72, 0, Math.PI, TAU);
    c.stroke();
  });
  for (let i = -3; i <= 3; i++) {
    line(c => {
      const a = Math.PI * 1.5 + i * 0.24;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 0.62, archY + Math.sin(a) * archY * 0.72);
      c.lineTo(cx + Math.cos(a) * R, archY + Math.sin(a) * archY * 1.05);
      c.stroke();
    });
  }
  for (let i = 0; i <= 6; i++) {
    const x = (w * i) / 6;
    line(c => {
      c.beginPath();
      c.moveTo(x, archY);
      c.lineTo(x, h * 0.78);
      c.stroke();
    });
  }
  line(c => {
    c.beginPath();
    c.moveTo(0, archY);
    c.lineTo(w, archY);
    c.moveTo(0, h * 0.56);
    c.lineTo(w, h * 0.56);
    c.stroke();
  });
  // a rose window in the arch
  line(c => {
    c.beginPath();
    c.arc(cx, archY * 0.62, Math.min(w, h) * 0.06, 0, TAU);
    c.stroke();
  });
  // light shafts
  for (let i = 0; i < 4; i++) {
    const x = w * (0.18 + i * 0.22);
    const g = ctx.createLinearGradient(x, 0, x + w * 0.2, h);
    g.addColorStop(0, `rgba(255,252,236,${0.14 + 0.05 * i})`);
    g.addColorStop(1, 'rgba(255,252,236,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + w * 0.06, 0);
    ctx.lineTo(x + w * 0.3, h);
    ctx.lineTo(x + w * 0.18, h);
    ctx.closePath();
    ctx.fill();
  }
  // the floor and the pots
  const floorY = h * 0.78;
  const floor = ctx.createLinearGradient(0, floorY, 0, h);
  floor.addColorStop(0, mix('#D7A07A', '#C77C52', sunset));
  floor.addColorStop(1, mix('#B57B58', '#9A5A3A', sunset));
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.strokeStyle = 'rgba(90,50,30,.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo((w * i) / 11, floorY);
    ctx.lineTo((w * i) / 11 + (i - 5.5) * w * 0.04, h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, floorY + (h - floorY) * 0.45);
  ctx.lineTo(w, floorY + (h - floorY) * 0.45);
  ctx.stroke();
  const plants = ['pokrzywa', 'kapusta', 'koniczyna', 'kruszyna', 'trawa'] as const;
  const potW = Math.min(w * 0.11, h * 0.14);
  plants.forEach((p, i) => {
    const x = w * (0.1 + i * 0.2), y = floorY + potW * 0.15;
    const look = PLANTS[p];
    // leaves
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.36, L = potW * (0.8 + 0.5 * hash(i * 7 + k));
      ctx.save();
      ctx.translate(x, y - potW * 0.3);
      ctx.rotate(a + Math.PI / 2);
      const g = ctx.createLinearGradient(0, 0, 0, -L);
      g.addColorStop(0, look.dark);
      g.addColorStop(1, look.light);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(L * 0.4, -L * 0.3, L * 0.3, -L * 0.85, 0, -L);
      ctx.bezierCurveTo(-L * 0.3, -L * 0.85, -L * 0.4, -L * 0.3, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    // the pot
    const pg = ctx.createLinearGradient(x - potW / 2, 0, x + potW / 2, 0);
    pg.addColorStop(0, '#9E5534');
    pg.addColorStop(0.45, '#D4855A');
    pg.addColorStop(1, '#8E4A2C');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(x - potW * 0.5, y - potW * 0.36);
    ctx.lineTo(x + potW * 0.5, y - potW * 0.36);
    ctx.lineTo(x + potW * 0.38, y + potW * 0.42);
    ctx.lineTo(x - potW * 0.38, y + potW * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#C9764C';
    roundRect(ctx, x - potW * 0.56, y - potW * 0.46, potW * 1.12, potW * 0.16, 3);
    ctx.fill();
  });
  // hanging vines
  ctx.strokeStyle = 'rgba(80,110,50,.7)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) {
    const x = w * (0.08 + 0.21 * i), len = h * (0.12 + 0.12 * hash(i * 5));
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + 10, len * 0.5, x - 4, len);
    ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const y = (len * k) / 6, lx = x + Math.sin(k) * 4;
      ctx.fillStyle = k % 2 ? '#6E9E48' : '#8DBF5A';
      ctx.beginPath();
      ctx.ellipse(lx + (k % 2 ? 6 : -6), y, 6, 3, k % 2 ? 0.5 : -0.5, 0, TAU);
      ctx.fill();
    }
  }
  paintPaperGrain(ctx, w, h);
}
