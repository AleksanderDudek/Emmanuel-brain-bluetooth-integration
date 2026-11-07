/**
 * Glina's picture for the lobby's hero and the game card: the potter's house (baked once per size),
 * the wheel turning a glazed jug with a band — in the lobby the player's best piece from the shelf —
 * the kiln glowing on the right, Szamot on the shelf with his tail swinging, and a few of the
 * player's shelf pieces beside him.  Drawn every frame in the lobby, so it stays cheap.
 */
import { FORM, FORM_IDS } from './content';
import { layout } from './layout';
import type { GlinaProgress, PieceRec } from './meta';
import { Room, cat, kilnDome, recLook } from './scene';
import { RINGS } from './shape';
import { drawVessel, look } from './vessel';

const v = look();
const tiny = look();
/** one baked room per size (the lobby's hero and the cards draw at different sizes) */
const rooms = new Map<string, Room>();

/** The card's jug: honey with a cobalt wave (made once). */
const JUG: PieceRec = (() => {
  const f = FORM.dzbanek;
  const q: number[] = [];
  for (let k = 0; k < RINGS; k++) q.push(Math.round(f.q[k] * 100));
  return { f: f.id, h: f.N, q, g: 'miod', b: [[62, 'kobalt', 'fala']], stars: 3, m: 94, gift: null };
})();

function best(p?: GlinaProgress): PieceRec {
  if (!p) return JUG;
  let out: PieceRec | null = null;
  for (const id of FORM_IDS) {
    const r = p.shelf[id];
    if (r && (!out || r.stars > out.stars || (r.stars === out.stars && r.m > out.m))) out = r;
  }
  return out ?? JUG;
}

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: GlinaProgress): void {
  if (w < 4 || h < 4) return;
  const L = layout(w, h, 0);
  const key = `${Math.round(w)}x${Math.round(h)}`;
  let room = rooms.get(key);
  if (!room) {
    if (rooms.size > 6) rooms.clear();
    room = new Room();
    rooms.set(key, room);
  }
  room.draw(ctx, L, Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
  // the kiln, softly glowing
  const kw = Math.min(w * 0.22, h * 0.5);
  kilnDome(ctx, { x: w - kw - w * 0.04, y: h * 0.86 - kw, w: kw, h: kw }, 0.55, 0.5 + 0.5 * Math.sin(t * 3));
  // the wheel and the piece on it
  const cx = w * 0.46, floor = h * 0.84, rx = Math.min(w * 0.16, h * 0.32);
  ctx.fillStyle = '#7A5A44';
  ctx.beginPath();
  ctx.ellipse(cx, floor + 3, rx, rx * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8E6A50';
  ctx.beginPath();
  ctx.ellipse(cx, floor, rx, rx * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const rec = best(p);
  let maxQ = 0;
  for (const q of rec.q) maxQ = Math.max(maxQ, q / 100);
  const scale = Math.min((h * 0.62) / Math.max(1, rec.h), (rx * 0.9) / Math.max(0.5, maxQ * rec.h));
  recLook(v, rec, cx, floor, scale, 60);
  v.rot = t * 1.4;
  v.attach = FORM[rec.f].attach;
  drawVessel(ctx, v);
  // the shelf: Szamot and a few pieces
  const sy = h * 0.3, sx = w * 0.66;
  ctx.fillStyle = '#7A5038';
  ctx.fillRect(sx - 10, sy, w * 0.3, Math.max(4, h * 0.025));
  if (p) {
    let i = 0;
    for (const id of FORM_IDS) {
      const r = p.shelf[id];
      if (!r || i >= 3) continue;
      let mq = 0;
      for (const q of r.q) mq = Math.max(mq, q / 100);
      const s = Math.min((h * 0.09) / Math.max(1, r.h), (h * 0.045) / Math.max(0.5, mq * r.h));
      drawVessel(ctx, recLook(tiny, r, sx + 14 + i * h * 0.11, sy, s, 24));
      i++;
    }
  }
  const pose = Math.sin(t * 0.5) > 0.6 ? 'sleep' : 'sit';
  cat(ctx, sx + w * 0.24, sy, Math.max(18, h * 0.16), t, pose);
}
