/**
 * Procedural sprites: everything is drawn with Canvas paths, so it stays sharp
 * on any screen and skins are just colours.  Expensive bits (soft glows, the
 * shadow-creature bodies) are rendered once into small offscreen canvases.
 */

export function rgba(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
  const n = Number.parseInt(v, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function mix(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.replace('#', '').slice(0, 6), 16), pb = Number.parseInt(b.replace('#', '').slice(0, 6), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

const canvas = (size: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
};

const glowCache = new Map<string, HTMLCanvasElement>();

/** A soft radial glow (draw with 'lighter' compositing for a bloom-like look). */
export function glow(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  const [cv, g] = canvas(128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, rgba(color, 0.9));
  grad.addColorStop(0.25, rgba(color, 0.45));
  grad.addColorStop(0.6, rgba(color, 0.12));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, cv);
  c = cv;
  return c;
}

export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha = 1): void {
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(glow(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

// ─── shadow creatures (Pac-Man ghosts, gentler) ─────────────────────

const ghostCache = new Map<string, HTMLCanvasElement>();
const GHOST_PX = 96;

function ghostPath(g: CanvasRenderingContext2D, s: number, wave: number): void {
  const r = s * 0.42, cx = s / 2, top = s * 0.12, bottom = s * 0.86;
  g.beginPath();
  g.moveTo(cx - r, cx);
  g.arc(cx, top + r, r, Math.PI, 0);
  g.lineTo(cx + r, bottom);
  const bumps = 4, w = (2 * r) / bumps;
  for (let i = 0; i < bumps; i++) {
    const x0 = cx + r - i * w;
    const dip = (i + wave) % 2 === 0 ? s * 0.08 : s * 0.03;
    g.quadraticCurveTo(x0 - w / 2, bottom - dip * 2.2, x0 - w, bottom);
  }
  g.closePath();
}

/** Body of a shadow, cached per colour/state/frame. `state`: normal | weak | fright | boss. */
export function ghostSprite(color: string, state: string, frame: number): HTMLCanvasElement {
  const key = `${color}|${state}|${frame}`;
  let c = ghostCache.get(key);
  if (c) return c;
  const [cv, g] = canvas(GHOST_PX);
  const s = GHOST_PX;
  ghostPath(g, s, frame);
  const body = g.createRadialGradient(s / 2, s * 0.4, s * 0.05, s / 2, s * 0.5, s * 0.5);
  if (state === 'fright') {
    body.addColorStop(0, '#f4fbff');
    body.addColorStop(1, '#7fb6ff');
  } else if (state === 'weak') {
    body.addColorStop(0, rgba(mix(color, '#ffffff', 0.55), 0.9));
    body.addColorStop(1, rgba(mix(color, '#9aa3b5', 0.6), 0.75));
  } else {
    body.addColorStop(0, '#15131c');
    body.addColorStop(0.7, '#0b0a10');
    body.addColorStop(1, rgba(color, 0.85));
  }
  g.fillStyle = body;
  g.fill();
  g.lineWidth = s * 0.035;
  g.strokeStyle = state === 'fright' ? '#ffffff' : rgba(color, state === 'weak' ? 0.6 : 0.95);
  g.stroke();
  ghostCache.set(key, cv);
  c = cv;
  return c;
}

/** Eyes drawn live so they can look at the angel. */
export function ghostEyes(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, lookX: number, lookY: number,
                          color: string, state: string, t: number): void {
  const ex = size * 0.17, ey = -size * 0.05, er = size * 0.12;
  if (state === 'fright') {
    // Pac-Man's frightened face: small dots and a wavy mouth
    ctx.fillStyle = '#3557a8';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * ex, y + ey, er * 0.45, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#3557a8';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const px = x - size * 0.2 + (i * size * 0.4) / 6, py = y + size * 0.16 + (i % 2 ? -1 : 1) * size * 0.035;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.stroke();
    return;
  }
  if (state === 'weak') {
    // dizzy little spirals
    ctx.strokeStyle = rgba('#ffffff', 0.85);
    ctx.lineWidth = size * 0.03;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.4) {
        const rr = (a / (Math.PI * 3)) * er, px = x + s * ex + Math.cos(a + t * 6) * rr, py = y + ey + Math.sin(a + t * 6) * rr;
        if (a) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    return;
  }
  const l = Math.hypot(lookX, lookY) || 1;
  const px = (lookX / l) * er * 0.45, py = (lookY / l) * er * 0.45;
  for (const s of [-1, 1]) {
    ctx.fillStyle = rgba('#ffffff', 0.92);
    ctx.beginPath();
    ctx.ellipse(x + s * ex, y + ey, er * 0.85, er, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + s * ex + px, y + ey + py, er * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── the angel ─────────────────────────────────────────────────────

export interface AngelLook {
  robe: [string, string];
  halo: [string, string];
  wings: [string, string];
  wingCount: 2 | 4 | 6;
}

/**
 * A small round chibi angel, front-facing. `praying` closes the eyes (standing
 * still is prayer); `pulse` (0..1) swells the halo with the heartbeat.
 */
export function drawAngel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, look: AngelLook,
                          t: number, moving: boolean, praying: boolean, pulse: number): void {
  const flap = Math.sin(t * (moving ? 11 : 4)) * (moving ? 0.32 : 0.16);
  const s = size;
  // wings (behind)
  const pairs = look.wingCount / 2;
  for (let p = 0; p < pairs; p++) {
    const spread = pairs === 1 ? 0 : (p - (pairs - 1) / 2) * 0.55;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * s * 0.25, y - s * 0.05);
      ctx.rotate(side * (0.35 + spread + flap));
      const len = s * (pairs === 3 && p !== 1 ? 0.75 : 0.95);
      const grad = ctx.createLinearGradient(0, 0, side * len, -len * 0.4);
      grad.addColorStop(0, look.wings[0]);
      grad.addColorStop(1, rgba(look.wings[1], 0.75));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(side * len * 0.3, -len * 0.75, side * len * 1.05, -len * 0.6, side * len, -len * 0.05);
      // feathered trailing edge
      for (let f = 3; f >= 0; f--) {
        const fx = side * len * (0.25 + f * 0.25), fy = len * (0.05 + (3 - f) * 0.04);
        ctx.quadraticCurveTo(fx + side * len * 0.12, fy + len * 0.18, fx - side * len * 0.02, fy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.35);
      ctx.lineWidth = s * 0.03;
      ctx.stroke();
      ctx.restore();
    }
  }
  // robe
  const robe = ctx.createLinearGradient(x, y - s * 0.3, x, y + s * 0.7);
  robe.addColorStop(0, look.robe[0]);
  robe.addColorStop(1, mix(look.robe[0], look.robe[1], 0.6));
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.22, y - s * 0.12);
  ctx.quadraticCurveTo(x - s * 0.5, y + s * 0.62, x - s * 0.42, y + s * 0.66);
  ctx.quadraticCurveTo(x, y + s * 0.78, x + s * 0.42, y + s * 0.66);
  ctx.quadraticCurveTo(x + s * 0.5, y + s * 0.62, x + s * 0.22, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba(look.robe[1], 0.5);
  ctx.lineWidth = s * 0.03;
  ctx.stroke();
  // praying hands
  if (praying) {
    ctx.fillStyle = '#f7dcc4';
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.12);
    ctx.lineTo(x - s * 0.08, y + s * 0.34);
    ctx.lineTo(x + s * 0.08, y + s * 0.34);
    ctx.closePath();
    ctx.fill();
  }
  // head
  const hy = y - s * 0.34, hr = s * 0.3;
  const skin = ctx.createRadialGradient(x - hr * 0.3, hy - hr * 0.3, hr * 0.1, x, hy, hr);
  skin.addColorStop(0, '#fff3e6');
  skin.addColorStop(1, '#f2cfae');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, hy, hr, 0, Math.PI * 2);
  ctx.fill();
  // hair
  ctx.fillStyle = '#f3d27a';
  ctx.beginPath();
  ctx.arc(x, hy - hr * 0.25, hr * 0.95, Math.PI * 1.05, Math.PI * 1.95);
  ctx.quadraticCurveTo(x, hy - hr * 0.55, x - hr * 0.9, hy - hr * 0.1);
  ctx.fill();
  // face
  ctx.strokeStyle = '#5a4636';
  ctx.fillStyle = '#5a4636';
  ctx.lineWidth = s * 0.035;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (praying) ctx.arc(x + side * hr * 0.38, hy + hr * 0.12, hr * 0.14, Math.PI * 0.15, Math.PI * 0.85);   // closed, peaceful
    else ctx.arc(x + side * hr * 0.38, hy + hr * 0.1, hr * 0.1, 0, Math.PI * 2);
    if (praying) ctx.stroke(); else ctx.fill();
  }
  ctx.fillStyle = rgba('#ff9a9a', 0.35);
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * hr * 0.6, hy + hr * 0.38, hr * 0.14, 0, Math.PI * 2); ctx.fill(); }
  // halo
  const hs = 1 + 0.12 * pulse;
  const haloY = hy - hr * 1.15;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, look.halo[1], x, haloY, s * 0.55 * hs, 0.55 + 0.3 * pulse);
  ctx.restore();
  ctx.strokeStyle = look.halo[0];
  ctx.lineWidth = s * 0.07;
  ctx.beginPath();
  ctx.ellipse(x, haloY, hr * 0.95 * hs, hr * 0.32 * hs, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ─── small things ──────────────────────────────────────────────────

export function drawCross(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.fillStyle = color;
  const w = size * 0.22;
  ctx.fillRect(x - w / 2, y - size / 2, w, size);
  ctx.fillRect(x - size * 0.35, y - size * 0.22, size * 0.7, w);
}

export function drawShard(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, t: number): void {
  const s = size * (1 + 0.06 * Math.sin(t * 4));
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.5) * 0.2);
  const grad = ctx.createLinearGradient(0, -s, 0, s);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.55, -s * 0.1);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.55, -s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.8);
  ctx.lineWidth = s * 0.08;
  ctx.stroke();
  ctx.restore();
}

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, t: number): void {
  ctx.fillStyle = '#8a5a35';
  ctx.fillRect(x - size * 0.08, y - size * 0.1, size * 0.16, size * 0.5);
  const sway = Math.sin(t * 2) * size * 0.03;
  ctx.fillStyle = '#5fbf6a';
  for (const [dx, dy, r] of [[0, -0.35, 0.32], [-0.22, -0.2, 0.24], [0.22, -0.2, 0.24]] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * size + sway, y + dy * size, r * size, 0, Math.PI * 2);
    ctx.fill();
  }
}
