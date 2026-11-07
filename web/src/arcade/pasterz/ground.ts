/**
 * The hill's ground, painted once per round into an offscreen canvas (the view scales it with the
 * camera): grass in the hill's own greens with soft swells and darker hollows, tufts and red
 * anemones, the trampled floors of the pens, the river with its stony banks and the plank bridges,
 * and a darker rim where the hill ends.  Everything that stands (rocks, bushes, walls, trees) is
 * drawn live and crisp by the view.
 */
import { hash, C } from './paint';
import { RULES } from './rules';
import type { World } from './world';

const TAU = Math.PI * 2;
/** pixels per metre of the ground canvas */
export const GROUND_K = 14;

export function paintGround(world: World, k = GROUND_K): HTMLCanvasElement {
  const W = Math.ceil(world.w * k), H = Math.ceil(world.h * k);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const [light, dark] = world.def.grass;
  const seed = world.seed;
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // swells and hollows: big soft blotches
  for (let i = 0; i < 26; i++) {
    const x = hash(seed + i * 3) * W, y = hash(seed + i * 5 + 1) * H, r = (5 + hash(seed + i * 7) * 9) * k;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    const lighter = i % 3 !== 0;
    rg.addColorStop(0, lighter ? 'rgba(236,236,170,.22)' : 'rgba(60,80,30,.16)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // contour lines of the hills (very soft)
  ctx.strokeStyle = 'rgba(70,84,34,.12)';
  ctx.lineWidth = Math.max(1, k * 0.12);
  for (let i = 0; i < 7; i++) {
    const cx = hash(seed + 100 + i) * W, cy = hash(seed + 200 + i) * H;
    for (let ring = 1; ring <= 3; ring++) {
      const r = (4 + ring * 3 + hash(seed + 300 + i) * 4) * k;
      ctx.beginPath();
      for (let a = 0; a <= TAU + 0.01; a += 0.2) {
        const q = r * (1 + 0.12 * Math.sin(a * 3 + i));
        const px = cx + Math.cos(a) * q, py = cy + Math.sin(a) * q * 0.8;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  // tufts and flowers
  for (let i = 0; i < world.w * world.h * 0.55; i++) {
    const x = hash(seed + 1000 + i) * W, y = hash(seed + 5000 + i) * H;
    const h0 = hash(seed + 9000 + i);
    ctx.strokeStyle = h0 < 0.5 ? 'rgba(84,100,40,.55)' : 'rgba(214,214,150,.5)';
    ctx.lineWidth = Math.max(1, k * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - k * 0.08, y - k * 0.25);
    ctx.moveTo(x + k * 0.1, y);
    ctx.lineTo(x + k * 0.14, y - k * 0.28);
    ctx.stroke();
  }
  for (let i = 0; i < world.w * world.h * 0.05; i++) {
    const x = hash(seed + 20000 + i) * W, y = hash(seed + 30000 + i) * H;
    const h0 = hash(seed + 40000 + i);
    ctx.fillStyle = h0 < 0.55 ? '#d9473a' : h0 < 0.8 ? '#f4efe0' : '#e9c24a';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, k * 0.09), 0, TAU);
    ctx.fill();
  }
  // the pens' trampled floors
  for (const p of world.pens) {
    const x = p.x * k, y = p.y * k, r = p.r * k;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r * 1.05);
    rg.addColorStop(0, 'rgba(210,186,138,.95)');
    rg.addColorStop(0.85, 'rgba(196,170,120,.85)');
    rg.addColorStop(1, 'rgba(196,170,120,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.05, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(150,120,80,.2)';
    for (let i = 0; i < 12; i++) {
      const a = hash(seed + i + p.x) * TAU, q = r * 0.75 * Math.sqrt(hash(seed + i * 2 + p.y));
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * q, y + Math.sin(a) * q, r * 0.1, r * 0.05, a, 0, TAU);
      ctx.fill();
    }
    // a worn path out of the gate
    const gx = x + Math.cos(p.gate) * r, gy = y + Math.sin(p.gate) * r;
    ctx.strokeStyle = 'rgba(200,176,128,.55)';
    ctx.lineCap = 'round';
    ctx.lineWidth = k * 1.1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + Math.cos(p.gate) * k * 3.5, gy + Math.sin(p.gate) * k * 3.5);
    ctx.stroke();
  }
  // the river: banks, water, ripples, and the bridges' planks
  const line = world.riverLine(0.5);
  if (line.length) {
    const path = () => {
      ctx.beginPath();
      line.forEach((p, i) => (i ? ctx.lineTo(p.x * k, p.y * k) : ctx.moveTo(p.x * k, p.y * k)));
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#8c8f55';
    ctx.lineWidth = (RULES.riverHalf * 2 + 1.1) * k;
    path();
    ctx.stroke();
    ctx.strokeStyle = C.stone;
    ctx.lineWidth = (RULES.riverHalf * 2 + 0.5) * k;
    path();
    ctx.stroke();
    ctx.strokeStyle = C.water;
    ctx.lineWidth = RULES.riverHalf * 2 * k;
    path();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(168,208,214,.7)';
    ctx.lineWidth = RULES.riverHalf * 0.8 * k;
    path();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = Math.max(1, k * 0.08);
    for (let i = 0; i < line.length; i += 3) {
      const p = line[i], o = (hash(seed + i) - 0.5) * RULES.riverHalf * 1.4;
      const vert = world.river === 'v';
      const x = (p.x + (vert ? o : 0)) * k, y = (p.y + (vert ? 0 : o)) * k;
      ctx.beginPath();
      if (vert) { ctx.moveTo(x, y); ctx.lineTo(x, y + k * 0.7); } else { ctx.moveTo(x, y); ctx.lineTo(x + k * 0.7, y); }
      ctx.stroke();
    }
    world.bridges.forEach((_, i) => {
      const q = world.bridgeQuad(i).map(p => ({ x: p.x * k, y: p.y * k }));
      ctx.fillStyle = 'rgba(40,30,20,.3)';
      ctx.beginPath();
      q.forEach((p, j) => (j ? ctx.lineTo(p.x + k * 0.15, p.y + k * 0.2) : ctx.moveTo(p.x + k * 0.15, p.y + k * 0.2)));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#a07648';
      ctx.beginPath();
      q.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fill();
      // planks across the walk
      const n = 9;
      ctx.strokeStyle = 'rgba(80,52,28,.55)';
      ctx.lineWidth = Math.max(1, k * 0.06);
      for (let j = 1; j < n; j++) {
        const t = j / n;
        const a = { x: q[0].x + (q[3].x - q[0].x) * t, y: q[0].y + (q[3].y - q[0].y) * t };
        const b = { x: q[1].x + (q[2].x - q[1].x) * t, y: q[1].y + (q[2].y - q[1].y) * t };
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#6a4a2a';
      ctx.lineWidth = Math.max(1.5, k * 0.18);
      ctx.beginPath();
      ctx.moveTo(q[0].x, q[0].y);
      ctx.lineTo(q[3].x, q[3].y);
      ctx.moveTo(q[1].x, q[1].y);
      ctx.lineTo(q[2].x, q[2].y);
      ctx.stroke();
    });
  }
  // the rim where the hill ends
  const e = RULES.edge * k;
  ctx.fillStyle = 'rgba(70,64,40,.55)';
  ctx.fillRect(0, 0, W, e);
  ctx.fillRect(0, H - e, W, e);
  ctx.fillRect(0, 0, e, H);
  ctx.fillRect(W - e, 0, e, H);
  return cv;
}
