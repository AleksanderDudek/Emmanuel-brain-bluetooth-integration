/**
 * Zacheusz's picture for the lobby's hero and the game card: Zacchaeus running along Jericho's
 * flat roofs over a solid rope bridge, a striped awning below, denarii in an arc ahead, the
 * skyline of palms behind him (a few gold crowns) and the procession's dust far off.  In the lobby
 * (with progress) the special coin set is the one his next course shows.  Drawn every frame in the
 * lobby, so it stays cheap.
 */
import { pickCourse, courseRec, tierOf, type ZacheuszProgress } from './meta';
import {
  C, hash, paintAwning, paintCoin, paintGround, paintHigh, paintHills, paintHouse, paintPalm, paintPlain, paintProcession, paintSky, paintZacchaeus,
  restPose, type CoinKind,
} from './paint';

const pose = restPose();

export function drawPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, p?: ZacheuszProgress): void {
  const S = Math.max(16, Math.min(h / 6.5, w / 9));
  const hor = h * 0.42;
  paintSky(ctx, w, h, hor + 4, 0);
  ctx.fillStyle = C.skyLow;
  ctx.fillRect(0, hor, w, h - hor);
  paintHills(ctx, w, hor + 2, S * 0.9, t * 6, C.hillFar, 1.3, h);
  paintProcession(ctx, w * 0.84, hor + 2, S * 0.7, t, 0.4);
  paintPlain(ctx, w, hor + S * 0.45, h, t * 10, 0);
  // the skyline of palms: one a second, a few above the threshold
  const n = 26, pps = w / n, off = (t * 0.7) % 1;
  for (let i = -1; i < n + 1; i++) {
    const k = Math.floor(t * 0.7) + i;
    const lv = 0.3 + 0.55 * (0.5 + 0.5 * Math.sin(k * 0.45)) * (0.7 + 0.3 * hash(k));
    paintPalm(ctx, (i - off + 0.5) * pps, hor + S * 0.2, S * 1.25 * (0.25 + 0.75 * lv), Math.min(pps * 1.3, S * 0.6), lv > 0.6 ? 'gold' : 'green', Math.sin(t + i) * 0.3);
  }
  // the street and the roofs, scrolling
  const gy = h * 0.92, roof = gy - S * 2.6;
  const run = (t * S * 2.2) % (S * 8);
  for (let k = -1; k < Math.ceil(w / (S * 8)) + 1; k++) {
    const bx = k * S * 8 - run;
    paintHouse(ctx, bx, bx + S * 4.5, roof, gy, S, k + 40, true);
    paintHigh(ctx, 'bridge', bx + S * 4.5, bx + S * 8, roof, S, 'solid', 1, t, 0);
    paintAwning(ctx, bx + S * 5, bx + S * 7.2, gy - S * 1.4, S, k % 2 ? C.madder : C.indigo, 0, gy);
  }
  paintGround(ctx, 0, w, gy, h + 2, S, 7, 0);
  // denarii ahead in an arc, and the special set of his next course
  const kind: CoinKind = p ? tierOf(courseRec(p, pickCourse(p))) : 'silver';
  for (let i = 0; i < 5; i++) {
    const q = i / 4;
    paintCoin(ctx, w * 0.5 + q * S * 3, roof - S * (0.9 + 1.2 * Math.sin(q * Math.PI)), S * 0.16, 'denar', t * 3 + i);
  }
  paintCoin(ctx, Math.min(w - S * 0.5, w * 0.5 + S * 3.9), roof - S * 2.3, S * 0.27, kind, t * 2);
  // Zacchaeus, mid-stride on the roofs
  pose.run = t * 16;
  pose.stride = 1;
  pose.look = -0.5;
  paintZacchaeus(ctx, w * 0.32, roof, S, pose);
}
